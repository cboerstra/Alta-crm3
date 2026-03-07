import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { adminProcedure, router } from "../_core/trpc";
import { getIntegration, upsertIntegration } from "../db";

export const integrationsRouter = router({
  getStatus: adminProcedure.query(async ({ ctx }) => {
    const [zoom, google, twilio] = await Promise.all([
      getIntegration(ctx.user.id, "zoom"),
      getIntegration(ctx.user.id, "google_calendar"),
      getIntegration(ctx.user.id, "twilio"),
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
            // Never expose the raw auth token — return a masked hint only
            authTokenHint: twilio.accessToken ? `****${twilio.accessToken.slice(-4)}` : "",
            enabled: (twilio.metadata as { enabled?: boolean } | null)?.enabled !== false,
          }
        : { connected: false },
    };
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
      // Validate credentials by calling Twilio's accounts endpoint
      const credentials = Buffer.from(`${input.accountSid}:${input.authToken}`).toString("base64");
      const res = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${input.accountSid}.json`,
        { headers: { Authorization: `Basic ${credentials}` } }
      );
      if (!res.ok) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Invalid Twilio credentials. Please check your Account SID and Auth Token.",
        });
      }
      const account = (await res.json()) as { friendly_name?: string; status?: string };
      if (account.status && account.status !== "active") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Twilio account is not active (status: ${account.status}).`,
        });
      }
      await upsertIntegration({
        userId: ctx.user.id,
        provider: "twilio",
        accessToken: input.authToken,          // stored as accessToken
        accountId: input.accountSid,           // stored as accountId
        accountEmail: input.fromPhone,         // stored as accountEmail (repurposed)
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
      const credentials = Buffer.from(`${twilio.accountId}:${twilio.accessToken}`).toString("base64");
      const body = new URLSearchParams({
        From: twilio.accountEmail,
        To: input.toPhone,
        Body: "✅ Clarke & Associates CRM — Twilio SMS connection verified successfully!",
      });
      const res = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${twilio.accountId}/Messages.json`,
        { method: "POST", headers: { Authorization: `Basic ${credentials}`, "Content-Type": "application/x-www-form-urlencoded" }, body }
      );
      if (!res.ok) {
        const err = (await res.json()) as { message?: string };
        throw new TRPCError({ code: "BAD_REQUEST", message: err.message ?? "Failed to send test SMS." });
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
