import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { adminProcedure, router } from "../_core/trpc";
import { getIntegration, upsertIntegration } from "../db";
import { verifyGmailCredentials, sendEmail } from "../email";

export const integrationsRouter = router({
  getStatus: adminProcedure.query(async ({ ctx }) => {
    const [zoom, google, telnyx, gmail] = await Promise.all([
      getIntegration(ctx.user.id, "zoom"),
      getIntegration(ctx.user.id, "google_calendar"),
      getIntegration(ctx.user.id, "twilio"), // stored as "twilio" provider key for backwards compat
      getIntegration(ctx.user.id, "gmail"),
    ]);
    return {
      zoom: zoom
        ? { connected: true, email: zoom.accountEmail, accountId: zoom.accountId }
        : { connected: false },
      google: google
        ? { connected: true, email: google.accountEmail }
        : { connected: false },
      telnyx: telnyx
        ? {
            connected: true,
            apiKeyHint: telnyx.accessToken ? `****${telnyx.accessToken.slice(-4)}` : "",
            fromPhone: telnyx.accountEmail ?? "",
            enabled: (telnyx.metadata as { enabled?: boolean } | null)?.enabled !== false,
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

  // ─── Telnyx SMS ────────────────────────────────────────────────────────────

  connectTelnyx: adminProcedure
    .input(z.object({
      apiKey: z.string().min(1, "API Key is required"),
      fromPhone: z.string().min(1, "From phone number is required"),
    }))
    .mutation(async ({ input, ctx }) => {
      const apiKey = input.apiKey.trim();
      // Validate credentials by calling Telnyx's profile endpoint
      let res: Response;
      try {
        res = await fetch("https://api.telnyx.com/v2/messaging_profiles?page[size]=1", {
          headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        });
      } catch (fetchErr) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Could not reach Telnyx. Please check your internet connection and try again.",
        });
      }
      if (res.status === 401 || res.status === 403) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Telnyx rejected this API key. Copy it from telnyx.com → Auth → API Keys and make sure it starts with 'KEY'.",
        });
      }
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({})) as { errors?: Array<{ detail?: string }> };
        const detail = errBody.errors?.[0]?.detail;
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: detail ? `Telnyx error: ${detail}` : `Telnyx returned an unexpected error (HTTP ${res.status}).`,
        });
      }
      // Normalize to E.164 (+1XXXXXXXXXX) before saving
      let fromPhone = input.fromPhone.trim().replace(/[\s\-().]/g, "");
      if (!fromPhone.startsWith("+")) fromPhone = `+1${fromPhone}`;
      await upsertIntegration({
        userId: ctx.user.id,
        provider: "twilio", // reuse existing provider key for backwards compat
        accessToken: apiKey,
        accountEmail: fromPhone,
        metadata: { enabled: true, provider: "telnyx" },
      });
      return { success: true };
    }),

  updateTelnyxFromPhone: adminProcedure
    .input(z.object({ fromPhone: z.string().min(1, "From phone number is required") }))
    .mutation(async ({ input, ctx }) => {
      const telnyx = await getIntegration(ctx.user.id, "twilio");
      if (!telnyx?.accessToken) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Telnyx is not configured. Connect it first." });
      }
      // Normalize to E.164
      let fromPhone = input.fromPhone.trim().replace(/[\s\-().]/g, "");
      if (!fromPhone.startsWith("+")) fromPhone = `+1${fromPhone}`;
      if (!/^\+[1-9]\d{6,14}$/.test(fromPhone)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `"${input.fromPhone}" is not a valid phone number. Use E.164 format, e.g. +18016487711.`,
        });
      }
      await upsertIntegration({
        userId: ctx.user.id,
        provider: "twilio",
        accessToken: telnyx.accessToken,
        accountId: telnyx.accountId ?? undefined,
        accountEmail: fromPhone,
        metadata: (telnyx.metadata as Record<string, unknown>) ?? { enabled: true, provider: "telnyx" },
      });
      return { success: true, fromPhone };
    }),

  testTelnyx: adminProcedure
    .input(z.object({ toPhone: z.string().optional() }))
    .mutation(async ({ input, ctx }) => {
      const telnyx = await getIntegration(ctx.user.id, "twilio");
      if (!telnyx?.accessToken || !telnyx.accountEmail) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Telnyx is not configured." });
      }
      // Default to the configured from number if no toPhone provided
      const rawPhone = (input.toPhone ?? telnyx.accountEmail).trim();
      let toPhone = rawPhone.replace(/[\s\-().]/g, "");
      if (!toPhone.startsWith("+")) toPhone = `+1${toPhone}`;
      if (!/^\+[1-9]\d{6,14}$/.test(toPhone)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `"${rawPhone}" doesn't look like a valid phone number. Use E.164 format, e.g. +15550001234.`,
        });
      }
      const res = await fetch("https://api.telnyx.com/v2/messages", {
        method: "POST",
        headers: { Authorization: `Bearer ${telnyx.accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: telnyx.accountEmail,
          to: toPhone,
          text: "✅ Clarke & Associates CRM — Telnyx SMS connection verified successfully!",
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { errors?: Array<{ detail?: string }> };
        const detail = err.errors?.[0]?.detail ?? "Failed to send test SMS. Check your Telnyx account for details.";
        throw new TRPCError({ code: "BAD_REQUEST", message: detail });
      }
      return { success: true, sentTo: toPhone };
    }),

  toggleTelnyx: adminProcedure
    .input(z.object({ enabled: z.boolean() }))
    .mutation(async ({ input, ctx }) => {
      const telnyx = await getIntegration(ctx.user.id, "twilio");
      if (!telnyx) throw new TRPCError({ code: "NOT_FOUND", message: "Telnyx is not configured." });
      await upsertIntegration({
        userId: ctx.user.id,
        provider: "twilio",
        accessToken: telnyx.accessToken ?? undefined,
        accountId: telnyx.accountId ?? undefined,
        accountEmail: telnyx.accountEmail ?? undefined,
        metadata: { ...(telnyx.metadata as object ?? {}), enabled: input.enabled },
      });
      return { success: true };
    }),

  disconnectTelnyx: adminProcedure.mutation(async ({ ctx }) => {
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
