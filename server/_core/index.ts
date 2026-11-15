import "dotenv/config";
import express, { type RequestHandler } from "express";
import { createServer } from "http";
import net from "net";
import path from "path";
import fs from "fs";
import multer from "multer";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { processPendingReminders } from "../emailService";
import { processPendingSmsReminders } from "../smsReminderService";
import { securityHeaders, sandboxUploads, rateLimit, requireSession } from "./security";
import { registerWebsiteLeadRoute } from "../websiteLeads";
import { registerDocumentDownloadRoute, registerMismoDownloadRoute } from "../websiteStaffApi";
import { getIntegration, createSmsMessage, logActivity, getLeads, updateLead, migrateDefaultSmsTemplates, runAutoMigrations } from "../db";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  // ── Startup environment validation ──────────────────────────────────────────
  const missingEnvVars: string[] = [];
  if (!process.env.JWT_SECRET) missingEnvVars.push("JWT_SECRET");
  // DB can be configured via either DATABASE_URL or the discrete DB_* vars.
  const hasDiscreteDbVars =
    !!process.env.DB_HOST && !!process.env.DB_USER && !!process.env.DB_NAME;
  if (!process.env.DATABASE_URL && !hasDiscreteDbVars) {
    missingEnvVars.push("DATABASE_URL or DB_HOST/DB_USER/DB_NAME");
  }
  if (missingEnvVars.length > 0) {
    console.error(
      `[Startup] CRITICAL: Missing required environment variables: ${missingEnvVars.join(", ")}. ` +
      `Set these in Hostinger → Node.js → Environment Variables and restart the app.`
    );
    // Generate a temporary JWT_SECRET so the server can still start and show
    // a meaningful error to the user instead of crashing with "zero-length key".
    if (!process.env.JWT_SECRET) {
      const crypto = await import("crypto");
      process.env.JWT_SECRET = crypto.randomBytes(32).toString("hex");
      console.warn(
        "[Startup] JWT_SECRET is not set — generated a temporary random secret. " +
        "Sessions will be invalidated on every restart until you set JWT_SECRET permanently."
      );
    }
  }

  // Warm up the DB connection at startup so [Database] log lines appear in
  // the boot log (and misconfiguration is caught immediately, not on the
  // first user action). Failure here is non-fatal — getDb() will retry and
  // surface the same error to whichever endpoint is hit first.
  try {
    const { getDb } = await import("../db");
    await getDb();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[Startup] DB warm-up failed (server will still start): ${msg}`);
  }

  const app = express();
  const server = createServer(app);
  // Behind Hostinger's reverse proxy: trust one hop so req.ip is the real client (rate limiting).
  app.set("trust proxy", 1);
  app.use(securityHeaders);
  // Brute-force protection: 10 login attempts / 15 min per IP, 5 registrations / hour per IP.
  // tRPC batches calls into one URL (e.g. /api/trpc/auth.me,auth.login), so match by substring.
  const limitTrpc = (proc: string, windowMs: number, max: number): RequestHandler => {
    const limiter = rateLimit({ windowMs, max, methods: ["POST"] });
    return (req, res, next) => (req.path.startsWith("/api/trpc/") && req.path.includes(proc) ? limiter(req, res, next) : next());
  };
  app.use(limitTrpc("auth.login", 15 * 60_000, 10));
  app.use(limitTrpc("auth.setPassword", 15 * 60_000, 5));
  app.use(limitTrpc("auth.register", 60 * 60_000, 5));
  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  // OAuth callback under /api/oauth/callback
  registerOAuthRoutes(app);

  // ── Website Lead Capture (from altamortgagegroup.net) ───────────────────────
  registerWebsiteLeadRoute(app);

  // ── Mortgage application documents (read from altamortgagegroup.net) ───────
  registerMismoDownloadRoute(app);
  registerDocumentDownloadRoute(app);

  // ── Telnyx SMS Webhooks ──────────────────────────────────────────────────────
  // Primary webhook: receives inbound SMS from Telnyx
  app.post("/api/sms/webhook", async (req, res) => {
    try {
      const payload = req.body;
      const eventType: string = payload?.data?.event_type ?? "";
      if (eventType === "message.received") {
        const msg = payload.data.payload;
        const fromPhone: string = msg?.from?.phone_number ?? "";
        const body: string = msg?.text ?? "";
        const externalId: string = msg?.id ?? "";
        // Find lead by phone number
        const leadsResult = await getLeads();
        const lead = leadsResult.items.find((l: any) => {
          const clean = (p: string) => p?.replace(/\D/g, "").slice(-10);
          return clean(l.phone ?? "") === clean(fromPhone);
        });
        // Helper to send an auto-reply via Telnyx
        const sendAutoReply = async (toPhone: string, replyBody: string) => {
          try {
            const { integrations } = await import("../../drizzle/schema");
            const { eq } = await import("drizzle-orm");
            const { getDb } = await import("../db");
            const db = await getDb();
            if (!db) return;
            const rows = await db.select().from(integrations).where(eq(integrations.provider, "twilio")).limit(1);
            const row = rows[0];
            if (!row?.accessToken || !row.accountEmail) return;
            const normalizePhone = (p: string) => {
              const digits = p.replace(/\D/g, "");
              if (digits.length === 10) return `+1${digits}`;
              if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
              return `+${digits}`;
            };
            const fromPhone = normalizePhone(row.accountEmail);
            await fetch("https://api.telnyx.com/v2/messages", {
              method: "POST",
              headers: { Authorization: `Bearer ${row.accessToken}`, "Content-Type": "application/json" },
              body: JSON.stringify({ from: fromPhone, to: toPhone, text: replyBody }),
            });
          } catch (e) {
            console.error("[Telnyx] Auto-reply error:", e);
          }
        };

        const keyword = body.trim().toUpperCase();

        if (keyword === "STOP" || keyword === "STOPALL" || keyword === "UNSUBSCRIBE" || keyword === "CANCEL" || keyword === "END" || keyword === "QUIT") {
          // Opt the lead out and log
          if (lead) {
            await updateLead(lead.id, { smsConsent: false });
            await createSmsMessage({ leadId: lead.id, direction: "inbound", body, status: "received" });
            await logActivity({
              leadId: lead.id,
              type: "sms_received",
              title: "SMS opt-out received (STOP)",
              content: body,
            });
          }
          // 10DLC-required STOP auto-response — must include brand name
          await sendAutoReply(fromPhone, "Alta Mortgage Group & Equity Real Estate: You have been unsubscribed and will receive no further messages. No action is needed. For help, reply HELP or contact us at info@altamortgagegroup.net.");
        } else if (keyword === "HELP" || keyword === "INFO") {
          // 10DLC-required HELP auto-response
          if (lead) {
            await createSmsMessage({ leadId: lead.id, direction: "inbound", body, status: "received" });
            await logActivity({ leadId: lead.id, type: "sms_received", title: "SMS HELP request received", content: body });
          }
          await sendAutoReply(fromPhone, "Alta Mortgage Group & Equity Real Estate: For help, contact us at info@altamortgagegroup.net or call (801) 628-9400. Msg & data rates may apply. Reply STOP to unsubscribe.");
        } else if (lead) {
          await createSmsMessage({
            leadId: lead.id,
            direction: "inbound",
            body,
            status: "received",
          });
          await logActivity({
            leadId: lead.id,
            type: "sms_received",
            title: "SMS received",
            content: body,
          });
        } else {
          console.log(`[Telnyx] Inbound SMS from unknown number: ${fromPhone}`);
        }
      }
      res.status(200).json({ received: true });
    } catch (err) {
      console.error("[Telnyx] Webhook error:", err);
      res.status(200).json({ received: true }); // always 200 to prevent Telnyx retries
    }
  });

  // Secondary webhook: delivery status callbacks from Telnyx
  app.post("/api/sms/status", async (req, res) => {
    try {
      const payload = req.body;
      const eventType: string = payload?.data?.event_type ?? "";
      const externalId: string = payload?.data?.payload?.id ?? "";
      if (externalId && (eventType === "message.sent" || eventType === "message.delivered" || eventType === "message.failed")) {
        const statusMap: Record<string, string> = {
          "message.sent": "sent",
          "message.delivered": "delivered",
          "message.failed": "failed",
        };
        const newStatus = statusMap[eventType] ?? "sent";
        const { getDb } = await import("../db");
        const { smsMessages } = await import("../../drizzle/schema");
        const { eq } = await import("drizzle-orm");
        const db = await getDb();
        if (db) {
          await db.update(smsMessages).set({ status: newStatus as any }).where(eq(smsMessages.externalId, externalId));
        }
      }
      res.status(200).json({ received: true });
    } catch (err) {
      console.error("[Telnyx] Status callback error:", err);
      res.status(200).json({ received: true });
    }
  });

  // ── Local File Upload Endpoint ──────────────────────────────────────────────
  // Determine uploads directory: prefer a persistent path outside the app bundle
  const uploadsDir = process.env.UPLOADS_DIR
    ? path.resolve(process.env.UPLOADS_DIR)
    : path.resolve(process.cwd(), "uploads");
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
    console.log(`[Upload] Created uploads directory: ${uploadsDir}`);
  }

  // Serve uploaded files as static assets under /uploads/*
  app.use("/uploads", sandboxUploads, express.static(uploadsDir, {
    maxAge: "7d",
    etag: true,
  }));

  // Multer disk storage — saves files to local uploads directory
  const upload = multer({
    storage: multer.diskStorage({
      destination: (_req, _file, cb) => cb(null, uploadsDir),
      filename: (_req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase() || '.bin';
        cb(null, `${Date.now()}-${Math.random().toString(36).slice(2, 9)}${ext}`);
      },
    }),
    limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
    fileFilter: (_req, file, cb) => {
      const allowedMimes = ["image/jpeg", "image/png", "image/gif", "image/webp", "image/svg+xml", "application/octet-stream"];
      const allowedExts = [".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg"];
      const ext = path.extname(file.originalname).toLowerCase();
      if (allowedMimes.includes(file.mimetype) && allowedExts.includes(ext)) {
        cb(null, true);
      } else if (allowedExts.includes(ext)) {
        cb(null, true);
      } else {
        cb(new Error(`File type not allowed: ${file.mimetype || "unknown"} (${ext || "no extension"})`));
      }
    },
  });

  // Multer for PDF uploads (separate instance with larger limit and PDF filter)
  const pdfUpload = multer({
    storage: multer.diskStorage({
      destination: (_req, _file, cb) => cb(null, uploadsDir),
      filename: (_req, file, cb) => {
        const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
        cb(null, `${Date.now()}-${Math.random().toString(36).slice(2, 9)}-${safeName}`);
      },
    }),
    limits: { fileSize: 25 * 1024 * 1024 }, // 25 MB
    fileFilter: (_req, file, cb) => {
      if (file.mimetype === "application/pdf") {
        cb(null, true);
      } else {
        cb(new Error(`Only PDF files are allowed, got: ${file.mimetype}`));
      }
    },
  });

  // Multer for HTML uploads (landing page background templates)
  const htmlUpload = multer({
    storage: multer.diskStorage({
      destination: (_req, _file, cb) => cb(null, uploadsDir),
      filename: (_req, file, cb) => {
        const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_");
        cb(null, `${Date.now()}-${Math.random().toString(36).slice(2, 9)}-${safeName}`);
      },
    }),
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      const allowedMimeTypes = ["text/html", "application/xhtml+xml"];
      if (allowedMimeTypes.includes(file.mimetype) || ext === ".html" || ext === ".htm") {
        cb(null, true);
      } else {
        cb(new Error(`Only HTML files are allowed, got: ${file.mimetype || ext || "unknown"}`));
      }
    },
  });

  const wrapUpload = (middleware: RequestHandler): RequestHandler => {
    return (req, res, next) => {
      middleware(req, res, (err?: unknown) => {
        if (!err) {
          next();
          return;
        }

        if (err instanceof multer.MulterError) {
          res.status(400).json({ error: err.message || "Upload failed" });
          return;
        }

        if (err instanceof Error) {
          res.status(400).json({ error: err.message || "Upload failed" });
          return;
        }

        next(err);
      });
    };
  };

  // POST /api/upload-pdf — authenticated PDF upload (up to 25MB)
  app.post("/api/upload-pdf", requireSession, wrapUpload(pdfUpload.single("file")), async (req, res) => {
    try {
      const { sdk } = await import("./sdk");
      let userId: number | null = null;
      try {
        const user = await sdk.authenticateRequest(req as any);
        userId = user?.id ?? null;
      } catch { /* not authenticated */ }
      if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }
      if (!req.file) { res.status(400).json({ error: "No file provided" }); return; }
      const url = `/uploads/${req.file.filename}`;
      res.json({ url, filename: req.file.originalname, size: req.file.size });
    } catch (err: any) {
      console.error("[Upload-PDF] Error:", err);
      res.status(500).json({ error: err.message ?? "Upload failed" });
    }
  });

  // POST /api/upload-html — authenticated HTML upload (up to 10MB)
  app.post("/api/upload-html", requireSession, wrapUpload(htmlUpload.single("file")), async (req, res) => {
    try {
      const { sdk } = await import("./sdk");
      let userId: number | null = null;
      try {
        const user = await sdk.authenticateRequest(req as any);
        userId = user?.id ?? null;
      } catch { /* not authenticated */ }
      if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }
      if (!req.file) { res.status(400).json({ error: "No file provided" }); return; }
      const url = `/uploads/${req.file.filename}`;
      res.json({ url, filename: req.file.originalname, size: req.file.size });
    } catch (err: any) {
      console.error("[Upload-HTML] Error:", err);
      res.status(500).json({ error: err.message ?? "Upload failed" });
    }
  });

  // POST /api/upload — authenticated multipart upload
  app.post("/api/upload", requireSession, wrapUpload(upload.single("file")), async (req, res) => {
    try {
      const { sdk } = await import("./sdk");
      let userId: number | null = null;
      try {
        const user = await sdk.authenticateRequest(req as any);
        userId = user?.id ?? null;
      } catch { /* not authenticated */ }
      if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }
      if (!req.file) { res.status(400).json({ error: "No file provided" }); return; }
      const url = `/uploads/${req.file.filename}`;
      res.json({ url, filename: req.file.filename, size: req.file.size });
    } catch (err: any) {
      console.error("[Upload] Error:", err);
      res.status(500).json({ error: err.message ?? "Upload failed" });
    }
  });

  // ── Open Graph meta tag injection for /lp/:slug ──────────────────────────
  // Facebook/Twitter crawlers don't execute JS, so we intercept landing page
  // URLs server-side and inject og:image, og:title, og:description into the HTML.
  app.get("/lp/:slug", async (req, res, next) => {
    try {
      const { getLandingPageBySlug, getLandingPageLogos } = await import("../db");
      const page = await getLandingPageBySlug(req.params.slug);
      if (!page || !page.isActive) { next(); return; }

      // Get the first foreground logo URL for og:image
      const logoUrls = await getLandingPageLogos(page.id);
      const ogImage = logoUrls[0] ?? "";

      const title = page.title ?? "Register Now";
      const description = (page as any).subheadline ?? (page as any).headline ?? "Sign up to reserve your spot.";
      const pageUrl = `${req.protocol}://${req.get("host")}/lp/${req.params.slug}`;

      // Read the built index.html and inject OG tags into <head>
      let htmlPath: string;
      if (process.env.NODE_ENV === "development") {
        htmlPath = path.resolve(process.cwd(), "client", "index.html");
      } else {
        htmlPath = path.resolve(import.meta.dirname, "public", "index.html");
      }

      if (!fs.existsSync(htmlPath)) { next(); return; }
      let html = fs.readFileSync(htmlPath, "utf-8");

      const ogTags = [
        `<meta property="og:type" content="website" />`,
        `<meta property="og:url" content="${pageUrl}" />`,
        `<meta property="og:title" content="${title.replace(/"/g, '&quot;')}" />`,
        `<meta property="og:description" content="${description.replace(/"/g, '&quot;')}" />`,
        ogImage ? `<meta property="og:image" content="${ogImage}" />` : "",
        ogImage ? `<meta property="og:image:width" content="400" />` : "",
        ogImage ? `<meta property="og:image:height" content="400" />` : "",
        `<meta name="twitter:card" content="summary_large_image" />`,
        `<meta name="twitter:title" content="${title.replace(/"/g, '&quot;')}" />`,
        `<meta name="twitter:description" content="${description.replace(/"/g, '&quot;')}" />`,
        ogImage ? `<meta name="twitter:image" content="${ogImage}" />` : "",
        `<title>${title.replace(/</g, '&lt;')}</title>`,
      ].filter(Boolean).join("\n    ");

      // Replace the existing <title> and inject OG tags before </head>
      html = html.replace(/<title>[^<]*<\/title>/, "");
      html = html.replace("</head>", `  ${ogTags}\n  </head>`);

      res.status(200).set({ "Content-Type": "text/html" }).end(html);
    } catch (err) {
      console.error("[OG] Error injecting meta tags:", err);
      next();
    }
  });

  // ── Campaign Tracking (open pixel + click redirect + unsubscribe) ───────────
  app.get("/api/track/open", async (req, res) => {
    try {
      const tid = req.query.tid as string;
      if (tid) {
        const { getDb } = await import("../db");
        const { campaignRecipients, emailCampaigns } = await import("../../drizzle/schema");
        const { eq, sql } = await import("drizzle-orm");
        const db = await getDb();
        const [r] = await db.select().from(campaignRecipients)
          .where(eq(campaignRecipients.trackingId, tid)).limit(1);
        if (r && !r.openedAt) {
          await db.update(campaignRecipients).set({ status: "opened", openedAt: new Date() })
            .where(eq(campaignRecipients.id, r.id));
          await db.update(emailCampaigns).set({ totalOpened: sql`totalOpened + 1` })
            .where(eq(emailCampaigns.id, r.campaignId));
        }
      }
    } catch (e) { console.error("[Track] open error:", e); }
    const pixel = Buffer.from("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7", "base64");
    res.set({ "Content-Type": "image/gif", "Cache-Control": "no-store" }).end(pixel);
  });

  app.get("/api/track/click", async (req, res) => {
    try {
      const tid = req.query.tid as string;
      const url = req.query.url as string;
      if (tid) {
        const { getDb } = await import("../db");
        const { campaignRecipients, emailCampaigns } = await import("../../drizzle/schema");
        const { eq, sql } = await import("drizzle-orm");
        const db = await getDb();
        const [r] = await db.select().from(campaignRecipients)
          .where(eq(campaignRecipients.trackingId, tid)).limit(1);
        if (r && !r.clickedAt) {
          await db.update(campaignRecipients).set({ status: "clicked", clickedAt: new Date() })
            .where(eq(campaignRecipients.id, r.id));
          await db.update(emailCampaigns).set({ totalClicked: sql`totalClicked + 1` })
            .where(eq(emailCampaigns.id, r.campaignId));
        }
      }
      if (url) return res.redirect(url);
    } catch (e) { console.error("[Track] click error:", e); }
    res.status(400).send("Missing url");
  });

  // Unsubscribe from a campaign email. Opening the link only shows a button:
  // mail security scanners (Outlook Safe Links and similar) open every link in
  // a message, and a link that unsubscribed on GET opted people out before
  // they ever read the email. The button, and the one-click POST that Gmail
  // and Yahoo send from the List-Unsubscribe header, do the unsubscribing.
  const unsubscribePage = (title: string, body: string) =>
    `<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"><title>${title}</title></head>` +
    `<body style="font-family:-apple-system,Segoe UI,sans-serif;text-align:center;padding:60px 20px;color:#222">` +
    `<h2>${title}</h2>${body}</body></html>`;

  app.get("/unsubscribe", (req, res) => {
    const tid = typeof req.query.tid === "string" ? req.query.tid : "";
    if (!/^[a-zA-Z0-9]{8,64}$/.test(tid)) {
      res.status(400).send(unsubscribePage("This unsubscribe link is incomplete", "<p>Reply to the email and ask to be removed, and we will take care of it.</p>"));
      return;
    }
    res.set("X-Robots-Tag", "noindex").send(unsubscribePage(
      "Unsubscribe from these emails?",
      `<form method="post" action="/unsubscribe?tid=${tid}">` +
        `<button type="submit" style="font-size:16px;padding:12px 28px;border-radius:8px;border:0;background:#1F7B47;color:#fff;cursor:pointer">Unsubscribe</button>` +
      `</form><p style="color:#666;font-size:14px;margin-top:16px">You will stop receiving these emails from us.</p>`
    ));
  });

  app.post("/unsubscribe", async (req, res) => {
    const tid = typeof req.query.tid === "string" ? req.query.tid : "";
    try {
      const { unsubscribeByTrackingId } = await import("../unsubscribe");
      await unsubscribeByTrackingId(tid);
    } catch (e) {
      console.error("[Track] unsubscribe error:", e);
    }
    // One-click (RFC 8058) senders only need a 2xx; a person gets the page.
    res.set("X-Robots-Tag", "noindex").send(unsubscribePage(
      "You have been unsubscribed",
      "<p>You will no longer receive these emails from us.</p>"
    ));
  });

  // Allow freehomesearchutah.com to load assets and call APIs cross-origin (landing page proxy)
  app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (origin && (origin === "https://freehomesearchutah.com")) {
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type");
      res.setHeader("Access-Control-Allow-Credentials", "true");
    }
    if (req.method === "OPTIONS") { res.sendStatus(204); return; }
    next();
  });

  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });

  // Auto-run schema migrations to keep production DB in sync
  runAutoMigrations().catch((err) =>
    console.error("[Startup] Auto-migration error:", err)
  );

  // One-time migration: upgrade legacy placeholder names in SMS templates
  migrateDefaultSmsTemplates().catch((err) =>
    console.error("[Startup] SMS template migration error:", err)
  );

  // Seed the built-in landing page templates the campaign builder stamps pages from.
  // Runs after auto-migration so the table exists on a first boot.
  setTimeout(() => {
    import("../marketingTemplates")
      .then(({ seedSystemTemplates }) => seedSystemTemplates())
      .catch((err) => console.error("[Startup] Template seed error:", err));
  }, 5_000);

  // A campaign paced over several days outlives a deploy: pick it back up.
  setTimeout(() => {
    import("../routers/campaigns")
      .then(({ resumeSendingCampaigns }) => resumeSendingCampaigns())
      .catch((err) => console.error("[Startup] Campaign resume error:", err));
  }, 15_000);

  // Email reminder scheduler: process pending reminders every 60 seconds
  setInterval(async () => {
    try {
      const sent = await processPendingReminders();
      if (sent > 0) console.log(`[Email Scheduler] Sent ${sent} reminder(s)`);
    } catch (err) {
      console.error("[Email Scheduler] Error:", err);
    }
  }, 60_000);
  // SMS reminder scheduler: process pending SMS reminders every 60 seconds
  setInterval(async () => {
    try {
      await processPendingSmsReminders();
    } catch (err) {
      console.error("[SMS Reminder Scheduler] Error:", err);
    }
  }, 60_000);

  // Automation scheduler: advance nurture sequences whose next step is due.
  setInterval(async () => {
    try {
      const { processDueEnrollments } = await import("../automations/engine");
      const executed = await processDueEnrollments();
      if (executed > 0) console.log(`[Automation Scheduler] Ran ${executed} step(s)`);
    } catch (err) {
      console.error("[Automation Scheduler] Error:", err);
    }
  }, 60_000);

  // Meta insights sync: refresh campaign spend/impressions hourly. Meta's
  // reporting lags by a few hours anyway, so polling faster buys nothing and
  // just burns API quota.
  const syncMetaMetrics = async () => {
    try {
      const { getMetaSettings } = await import("../marketingDb");
      const settings = await getMetaSettings();
      if (!settings?.adAccountId || !settings.accessToken) return; // not connected yet
      const { syncAllCampaignMetrics } = await import("../meta/publisher");
      const result = await syncAllCampaignMetrics();
      if (result.rows > 0) {
        console.log(`[Meta Insights] Synced ${result.rows} day(s) across ${result.campaigns} campaign(s)`);
      }
    } catch (err) {
      console.error("[Meta Insights] Sync error:", err);
    }
  };
  setInterval(syncMetaMetrics, 60 * 60_000);
  setTimeout(syncMetaMetrics, 30_000);
}

startServer().catch(console.error);
