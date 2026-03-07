import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { adminProcedure, router } from "../_core/trpc";
import { getIntegration, upsertIntegration } from "../db";
import { verifyGmailCredentials, sendEmail } from "../email";

export const integrationsRouter = router({
  getStatus: adminProcedure.query(async ({ ctx }) => {
    const [zoom, google, twilio, gmail] = await Promise.all([
      getIntegration(ctx.user.id, "zoom"),
      getIntegration(ctx.user.id, "google_calendar"),
      getIntegration(ctx.user.id, "twilio"),
      getIntegration(ctx.user.id, "gmail"),
    ]);
    return {
      zoom: zoom
        ? { connected: true, email: zoom.accountEmail, accountId: zoom.accountId }
        : { connected: false },
      google: google
        ? { connected: true, email: google.accountEmail }
        : { connected: false },
      twilio: twilio
        ? {
            connected: true,
            accountSid: twilio.accountId ?? "",
            fromPhone: twilio.accountEmail ?? "",
            authTokenHint: twilio.accessToken ? `****${twilio.accessToken.slice(-4)}` : "",
            enabled: (twilio.metadata as { enabled?: boolean } | null)?.enabled !== false,
          }
        : { connected: false },
      gmail: gmail
        ? {
            connected: true,
            gmailAddress: gmail.accountEmail ?? "",
            appPasswordHint: gmail.accessToken ? `****${gmail.accessToken.slice(-4)}` : "",
            enabled: (gmail.metadata as { enabled?: boolean } | null)?.enabled !== false,
          }
        : { connected: false },
    };
  }),

  // ─── Gmail SMTP ───────────────────────────────────────────────────────────────

  connectGmail: adminProcedure
    .input(z.object({
      gmailAddress: z.string().email("Must be a valid Gmail address"),
      appPassword: z.string().min(1, "App Password is required"),
    }))
    .mutation(async ({ input, ctx }) => {
      const addr = input.gmailAddress.trim().toLowerCase();
      const pass = input.appPassword.trim().replace(/\s/g, ""); // strip spaces from 16-char password
      // Verify credentials by connecting to Gmail SMTP
      try {
        await verifyGmailCredentials(addr, pass);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes("Invalid login") || msg.includes("Username and Password") || msg.includes("535")) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Gmail rejected these credentials. Make sure you are using an App Password (not your regular Gmail password). Generate one at myaccount.google.com → Security → 2-Step Verification → App Passwords.",
          });
        }
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Could not connect to Gmail: ${msg}`,
        });
      }
      await upsertIntegration({
        userId: ctx.user.id,
        provider: "gmail",
        accessToken: pass,
        accountEmail: addr,
        metadata: { enabled: true },
      });
      return { success: true };
    }),

  testGmail: adminProcedure
    .input(z.object({ toEmail: z.string().email("Must be a valid email address") }))
    .mutation(async ({ input, ctx }) => {
      const gmail = await getIntegration(ctx.user.id, "gmail");
      if (!gmail?.accessToken || !gmail.accountEmail) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Gmail is not configured." });
      }
      try {
        await sendEmail(gmail.accountEmail, gmail.accessToken, {
          from: `Clarke & Associates CRM <${gmail.accountEmail}>`,
          to: input.toEmail,
          subject: "✅ Clarke & Associates CRM — Gmail connection verified",
          html: `<p>Your Gmail integration is working correctly.</p><p>Emails from the CRM will be sent from <strong>${gmail.accountEmail}</strong>.</p>`,
        });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        throw new TRPCError({ code: "BAD_REQUEST", message: `Failed to send test email: ${msg}` });
      }
      return { success: true };
    }),

  toggleGmail: adminProcedure
    .input(z.object({ enabled: z.boolean() }))
    .mutation(async ({ input, ctx }) => {
      const gmail = await getIntegration(ctx.user.id, "gmail");
      if (!gmail) throw new TRPCError({ code: "NOT_FOUND", message: "Gmail is not configured." });
      await upsertIntegration({
        userId: ctx.user.id,
        provider: "gmail",
        accessToken: gmail.accessToken ?? undefined,
        accountEmail: gmail.accountEmail ?? undefined,
        metadata: { ...(gmail.metadata as object ?? {}), enabled: input.enabled },
      });
      return { success: true };
    }),

  disconnectGmail: adminProcedure.mutation(async ({ ctx }) => {
    const { getDb } = await import("../db");
    const { integrations } = await import("../../drizzle/schema");
    const { and, eq } = await import("drizzle-orm");
    const db = await getDb();
    if (db) {
      await db.delete(integrations).where(
        and(eq(integrations.userId, ctx.user.id), eq(integrations.provider, "gmail"))
      );
    }
    return { success: true };
  }),

  connectZoom: adminProcedure
    .input(z.object({
      accessToken: z.string(),
      refreshToken: z.string().optional(),
      accountId: z.string().optional(),
      accountEmail: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      await upsertIntegration({
        userId: ctx.user.id,
        provider: "zoom",
        accessToken: input.accessToken,
        refreshToken: input.refreshToken,
        accountId: input.accountId,
        accountEmail: input.accountEmail,
      });
      return { success: true };
    }),

  connectGoogle: adminProcedure
    .input(z.object({
      accessToken: z.string(),
      refreshToken: z.string().optional(),
      accountEmail: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      await upsertIntegration({
        userId: ctx.user.id,
        provider: "google_calendar",
        accessToken: input.accessToken,
        refreshToken: input.refreshToken,
        accountEmail: input.accountEmail,
      });
      return { success: true };
    }),

  // ─── Twilio SMS ────────────────────────────────────────────────────────────

  connectTwilio: adminProcedure
    .input(z.object({
      accountSid: z.string().min(1, "Account SID is required"),
      authToken: z.string().min(1, "Auth Token is required"),
      fromPhone: z.string().min(1, "From phone number is required"),
    }))
    .mutation(async ({ input, ctx }) => {
      // Normalize the Account SID (trim whitespace)
      const accountSid = input.accountSid.trim();
      const authToken = input.authToken.trim();
      // Validate credentials by calling Twilio's accounts endpoint
      const credentials = Buffer.from(`${accountSid}:${authToken}`).toString("base64");
      let res: Response;
      try {
        res = await fetch(
          `https://api.twilio.com/2010-04-01/Accounts/${accountSid}.json`,
          { headers: { Authorization: `Basic ${credentials}` } }
        );
      } catch (fetchErr) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Could not reach Twilio. Please check your internet connection and try again.",
        });
      }
      if (res.status === 401) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Twilio rejected these credentials (401 Unauthorized). Double-check that your Account SID starts with 'AC' and that the Auth Token is copied exactly from the Twilio Console dashboard — no extra spaces.",
        });
      }
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({})) as { message?: string; code?: number };
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: errBody.message
            ? `Twilio error: ${errBody.message}`
            : `Twilio returned an unexpected error (HTTP ${res.status}). Please verify your Account SID and Auth Token.`,
        });
      }
      const account = (await res.json()) as { friendly_name?: string; status?: string };
      if (account.status && account.status !== "active") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Twilio account is not active (status: ${account.status}). Please activate your Twilio account at console.twilio.com.`,
        });
      }
      await upsertIntegration({
        userId: ctx.user.id,
        provider: "twilio",
        accessToken: authToken,          // stored as accessToken
        accountId: accountSid,           // stored as accountId
        accountEmail: input.fromPhone.trim(),  // stored as accountEmail (repurposed)
        metadata: { enabled: true, friendlyName: account.friendly_name ?? "" },
      });
      return { success: true };
    }),

  testTwilio: adminProcedure
    .input(z.object({ toPhone: z.string().min(1) }))
    .mutation(async ({ input, ctx }) => {
      const twilio = await getIntegration(ctx.user.id, "twilio");
      if (!twilio?.accessToken || !twilio.accountId || !twilio.accountEmail) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Twilio is not configured." });
      }
      // Normalize the destination phone: strip spaces, dashes, parentheses, then ensure E.164
      let toPhone = input.toPhone.trim().replace(/[\s\-().]/g, "");
      if (!toPhone.startsWith("+")) {
        toPhone = `+1${toPhone}`; // default to US country code
      }
      // Basic E.164 sanity check: + followed by 7-15 digits
      if (!/^\+[1-9]\d{6,14}$/.test(toPhone)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `"${input.toPhone}" doesn't look like a valid phone number. Use E.164 format, e.g. +15550001234 (include country code).`,
        });
      }
      const credentials = Buffer.from(`${twilio.accountId}:${twilio.accessToken}`).toString("base64");
      const body = new URLSearchParams({
        From: twilio.accountEmail,
        To: toPhone,
        Body: "✅ Clarke & Associates CRM — Twilio SMS connection verified successfully!",
      });
      const res = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${twilio.accountId}/Messages.json`,
        { method: "POST", headers: { Authorization: `Basic ${credentials}`, "Content-Type": "application/x-www-form-urlencoded" }, body }
      );
      if (!res.ok) {
        const err = (await res.json()) as { message?: string; code?: number };
        // Twilio error code 21211 = invalid To number
        if (err.code === 21211 || (err.message && err.message.toLowerCase().includes("invalid 'to'"))) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `The destination number "${toPhone}" was rejected by Twilio. Make sure it is a real, reachable phone number in E.164 format (e.g. +15550001234). Trial Twilio accounts can only send to verified numbers — verify the number at console.twilio.com/phone-numbers/verified.`,
          });
        }
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: err.message ?? "Failed to send test SMS. Check your Twilio account for details.",
        });
      }
      return { success: true };
    }),

  toggleTwilio: adminProcedure
    .input(z.object({ enabled: z.boolean() }))
    .mutation(async ({ input, ctx }) => {
      const twilio = await getIntegration(ctx.user.id, "twilio");
      if (!twilio) throw new TRPCError({ code: "NOT_FOUND", message: "Twilio is not configured." });
      await upsertIntegration({
        userId: ctx.user.id,
        provider: "twilio",
        accessToken: twilio.accessToken ?? undefined,
        accountId: twilio.accountId ?? undefined,
        accountEmail: twilio.accountEmail ?? undefined,
        metadata: { ...(twilio.metadata as object ?? {}), enabled: input.enabled },
      });
      return { success: true };
    }),

  disconnectTwilio: adminProcedure.mutation(async ({ ctx }) => {
    const { getDb } = await import("../db");
    const { integrations } = await import("../../drizzle/schema");
    const { and, eq } = await import("drizzle-orm");
    const db = await getDb();
    if (db) {
      await db.delete(integrations).where(
        and(eq(integrations.userId, ctx.user.id), eq(integrations.provider, "twilio"))
      );
    }
    return { success: true };
  }),

  // ─── Generic disconnect (Zoom / Google) ───────────────────────────────────

  disconnect: adminProcedure
    .input(z.object({ provider: z.enum(["zoom", "google_calendar"]) }))
    .mutation(async ({ input, ctx }) => {
      const { getDb } = await import("../db");
      const { integrations } = await import("../../drizzle/schema");
      const { and, eq } = await import("drizzle-orm");
      const db = await getDb();
      if (db) {
        await db.delete(integrations).where(
          and(eq(integrations.userId, ctx.user.id), eq(integrations.provider, input.provider))
        );
      }
      return { success: true };
    }),

  // Simulate creating a Zoom webinar (in production, call Zoom API)
  createZoomWebinar: adminProcedure
    .input(z.object({
      title: z.string(),
      scheduledAt: z.number(),
      durationMinutes: z.number(),
      description: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const integration = await getIntegration(ctx.user.id, "zoom");
      if (!integration) throw new Error("Zoom not connected");
      // In production: call Zoom API with integration.accessToken
      const mockId = `zoom_${Date.now()}`;
      return {
        zoomWebinarId: mockId,
        joinUrl: `https://zoom.us/j/${mockId}`,
        startUrl: `https://zoom.us/s/${mockId}`,
      };
    }),
});
