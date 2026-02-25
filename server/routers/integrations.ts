import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { getIntegration, upsertIntegration } from "../db";

export const integrationsRouter = router({
  getStatus: protectedProcedure.query(async ({ ctx }) => {
    const [zoom, google] = await Promise.all([
      getIntegration(ctx.user.id, "zoom"),
      getIntegration(ctx.user.id, "google_calendar"),
    ]);
    return {
      zoom: zoom ? { connected: true, email: zoom.accountEmail, accountId: zoom.accountId } : { connected: false },
      google: google ? { connected: true, email: google.accountEmail } : { connected: false },
    };
  }),

  connectZoom: protectedProcedure
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

  connectGoogle: protectedProcedure
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

  disconnect: protectedProcedure
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
  createZoomWebinar: protectedProcedure
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
      // Returning simulated response
      const mockId = `zoom_${Date.now()}`;
      return {
        zoomWebinarId: mockId,
        joinUrl: `https://zoom.us/j/${mockId}`,
        startUrl: `https://zoom.us/s/${mockId}`,
      };
    }),
});
