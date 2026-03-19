import "dotenv/config";
import express from "express";
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
import { registerWebsiteLeadRoute } from "../websiteLeads";
import { getIntegration, createSmsMessage, logActivity, getLeads, migrateDefaultSmsTemplates, runAutoMigrations } from "../db";

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
  if (!process.env.DATABASE_URL) missingEnvVars.push("DATABASE_URL");
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

  const app = express();
  const server = createServer(app);
  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  // OAuth callback under /api/oauth/callback
  registerOAuthRoutes(app);

  // ── Website Lead Capture (from altamortgagegroup.net) ───────────────────────
  registerWebsiteLeadRoute(app);

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
        if (lead) {
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
  app.use("/uploads", express.static(uploadsDir, {
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
      const allowed = ["image/jpeg", "image/png", "image/gif", "image/webp", "image/svg+xml"];
      if (allowed.includes(file.mimetype)) {
        cb(null, true);
      } else {
        cb(new Error(`File type not allowed: ${file.mimetype}`));
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

  // POST /api/upload-pdf — authenticated PDF upload (up to 25MB)
  app.post("/api/upload-pdf", pdfUpload.single("file"), async (req, res) => {
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

  // POST /api/upload — authenticated multipart upload
  app.post("/api/upload", upload.single("file"), async (req, res) => {
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
      console.error("[Upload] Error:", err);
      res.status(500).json({ error: err.message ?? "Upload failed" });
    }
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

  // Email reminder scheduler: process pending reminders every 60 seconds
  setInterval(async () => {
    try {
      const sent = await processPendingReminders();
      if (sent > 0) console.log(`[Email Scheduler] Sent ${sent} reminder(s)`);
    } catch (err) {
      console.error("[Email Scheduler] Error:", err);
    }
  }, 60_000);
}

startServer().catch(console.error);
