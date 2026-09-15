import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { adminProcedure, protectedProcedure, publicProcedure, router } from "../_core/trpc";
import {
  getAdLevelBreakdown,
  getAttributionBreakdown,
  getCampaignPerformance,
  getConversionEvents,
  getLandingPagesForCampaignPicker,
  getMetaSettings,
  upsertMetaSettings,
} from "../marketingDb";
import { getLeadById, getLandingPageBySlug, updateLandingPage, getLandingPageById } from "../db";
import { verifyAdAccount, normalizeAdAccountId } from "../meta/marketingApi";
import { tokenHint } from "../meta/graph";
import { sendConversionEvents, generateEventId } from "../meta/conversionsApi";
import { reportLeadConversion } from "../meta/leadTracking";
import { syncAllCampaignMetrics, getPublicBaseUrl } from "../meta/publisher";
import { clientIpFromRequest, normalizeAttribution, attributionInputSchema } from "../meta/attribution";

export const marketingRouter = router({
  // ═══════════════════════════════════════════════════════════════════════
  // Meta account settings
  // ═══════════════════════════════════════════════════════════════════════

  /** Redacted settings for the Settings → Meta Ads panel. */
  getSettings: adminProcedure.query(async () => {
    const s = await getMetaSettings();
    if (!s) {
      return {
        configured: false,
        adAccountId: "", businessId: "", pageId: "", instagramActorId: "",
        pixelId: "", capiTestEventCode: "", apiVersion: "v21.0",
        accessTokenHint: "", capiAccessTokenHint: "",
        capiEnabled: true, pixelEnabled: true, publishEnabled: false,
        lastVerifiedAt: null, lastVerifyError: null,
        publicBaseUrl: getPublicBaseUrl(),
      };
    }
    return {
      configured: !!(s.adAccountId && s.accessToken),
      adAccountId: s.adAccountId ?? "",
      businessId: s.businessId ?? "",
      pageId: s.pageId ?? "",
      instagramActorId: s.instagramActorId ?? "",
      pixelId: s.pixelId ?? "",
      capiTestEventCode: s.capiTestEventCode ?? "",
      apiVersion: s.apiVersion ?? "v21.0",
      // Tokens are never sent back to the browser, only a last-four hint.
      accessTokenHint: tokenHint(s.accessToken),
      capiAccessTokenHint: tokenHint(s.capiAccessToken),
      capiEnabled: s.capiEnabled,
      pixelEnabled: s.pixelEnabled,
      publishEnabled: s.publishEnabled,
      lastVerifiedAt: s.lastVerifiedAt,
      lastVerifyError: s.lastVerifyError,
      publicBaseUrl: getPublicBaseUrl(),
    };
  }),

  saveSettings: adminProcedure
    .input(z.object({
      adAccountId: z.string().optional(),
      businessId: z.string().optional(),
      pageId: z.string().optional(),
      instagramActorId: z.string().optional(),
      pixelId: z.string().optional(),
      apiVersion: z.string().optional(),
      capiTestEventCode: z.string().optional(),
      // Blank means "leave the stored token alone" — the UI only ever shows a hint.
      accessToken: z.string().optional(),
      capiAccessToken: z.string().optional(),
      capiEnabled: z.boolean().optional(),
      pixelEnabled: z.boolean().optional(),
      publishEnabled: z.boolean().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const data: Record<string, unknown> = { updatedBy: ctx.user.id };
      if (input.adAccountId !== undefined) {
        data.adAccountId = input.adAccountId ? normalizeAdAccountId(input.adAccountId) : null;
      }
      for (const key of ["businessId", "pageId", "instagramActorId", "pixelId", "apiVersion", "capiTestEventCode"] as const) {
        if (input[key] !== undefined) data[key] = input[key] || null;
      }
      for (const key of ["capiEnabled", "pixelEnabled", "publishEnabled"] as const) {
        if (input[key] !== undefined) data[key] = input[key];
      }
      if (input.accessToken) data.accessToken = input.accessToken.trim();
      if (input.capiAccessToken) data.capiAccessToken = input.capiAccessToken.trim();

      await upsertMetaSettings(data);
      return { success: true };
    }),

  /** Reads the ad account back from Meta to prove the credentials work. */
  verifyConnection: adminProcedure.mutation(async () => {
    const s = await getMetaSettings();
    if (!s?.adAccountId || !s.accessToken) {
      throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Enter an ad account ID and access token first" });
    }
    try {
      const account = await verifyAdAccount({
        adAccountId: s.adAccountId,
        accessToken: s.accessToken,
        apiVersion: s.apiVersion ?? undefined,
      });
      await upsertMetaSettings({ lastVerifiedAt: new Date(), lastVerifyError: null });
      return {
        ok: true,
        account,
        // account_status 1 = ACTIVE; anything else can't run ads.
        warning: account.accountStatus !== 1
          ? `Ad account status is ${account.accountStatus} — ads cannot run until it is active.`
          : null,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await upsertMetaSettings({ lastVerifyError: message });
      throw new TRPCError({ code: "BAD_REQUEST", message });
    }
  }),

  /** Fires a TestEvent so Events Manager shows the server connection is live. */
  sendTestEvent: adminProcedure.mutation(async () => {
    const s = await getMetaSettings();
    const pixelId = s?.pixelId;
    const token = s?.capiAccessToken || s?.accessToken;
    if (!pixelId || !token) {
      throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Enter a pixel ID and access token first" });
    }
    const res = await sendConversionEvents(
      { pixelId, accessToken: token, apiVersion: s?.apiVersion ?? undefined, testEventCode: s?.capiTestEventCode ?? undefined },
      [{
        eventName: "PageView",
        eventId: generateEventId("test"),
        actionSource: "system_generated",
        userData: { email: "test@altamortgagegroup.net", country: "us" },
      }]
    );
    if (!res.ok) throw new TRPCError({ code: "BAD_REQUEST", message: res.error ?? "Test event failed" });
    return { ok: true, eventsReceived: res.eventsReceived ?? 1 };
  }),

  // ═══════════════════════════════════════════════════════════════════════
  // Public pixel config (read by landing pages, no auth)
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * The pixel id a public landing page should load. Public on purpose — a pixel
   * id is not a secret, it ships in the page source on every site that uses one.
   * Access tokens are never included here.
   */
  publicPixelConfig: publicProcedure
    .input(z.object({ slug: z.string() }))
    .query(async ({ input }) => {
      const [settings, page] = await Promise.all([
        getMetaSettings(),
        getLandingPageBySlug(input.slug),
      ]);
      if (!settings?.pixelEnabled) return { pixelId: null, eventName: "Lead", enabled: false };
      if (page && (page as any).trackingEnabled === false) {
        return { pixelId: null, eventName: "Lead", enabled: false };
      }
      const pixelId = (page as any)?.metaPixelId || settings.pixelId || null;
      return {
        pixelId,
        eventName: (page as any)?.conversionEventName || "Lead",
        enabled: !!pixelId,
      };
    }),

  // ═══════════════════════════════════════════════════════════════════════
  // Landing page tracking settings
  // ═══════════════════════════════════════════════════════════════════════

  getPageTracking: protectedProcedure
    .input(z.object({ landingPageId: z.number() }))
    .query(async ({ input }) => {
      const page = await getLandingPageById(input.landingPageId);
      if (!page) return null;
      return {
        trackingEnabled: (page as any).trackingEnabled ?? true,
        capiEnabled: (page as any).capiEnabled ?? true,
        metaPixelId: (page as any).metaPixelId ?? "",
        conversionEventName: (page as any).conversionEventName ?? "Lead",
        conversionValue: (page as any).conversionValue != null ? Number((page as any).conversionValue) : null,
        campaignId: (page as any).campaignId ?? null,
        templateId: (page as any).templateId ?? null,
      };
    }),

  updatePageTracking: protectedProcedure
    .input(z.object({
      landingPageId: z.number(),
      trackingEnabled: z.boolean().optional(),
      capiEnabled: z.boolean().optional(),
      metaPixelId: z.string().nullable().optional(),
      conversionEventName: z.string().optional(),
      conversionValue: z.number().nullable().optional(),
      campaignId: z.number().nullable().optional(),
    }))
    .mutation(async ({ input }) => {
      const { landingPageId, conversionValue, ...rest } = input;
      await updateLandingPage(landingPageId, {
        ...rest,
        ...(conversionValue !== undefined
          ? { conversionValue: conversionValue != null ? String(conversionValue) : null }
          : {}),
      } as any);
      return { success: true };
    }),

  landingPagePicker: protectedProcedure.query(() => getLandingPagesForCampaignPicker()),

  // ═══════════════════════════════════════════════════════════════════════
  // Unified analytics
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Ad spend joined to CRM outcomes. This is the report the whole build exists
   * for: which campaign produced which closed loan, and what it cost.
   */
  campaignPerformance: protectedProcedure
    .input(z.object({ since: z.date().optional(), until: z.date().optional() }).optional())
    .query(({ input }) => getCampaignPerformance({ since: input?.since, until: input?.until })),

  attributionBreakdown: protectedProcedure
    .input(z.object({ since: z.date().optional(), until: z.date().optional() }).optional())
    .query(({ input }) => getAttributionBreakdown({ since: input?.since, until: input?.until })),

  adBreakdown: protectedProcedure
    .input(z.object({ campaignId: z.number().optional(), limit: z.number().optional() }).optional())
    .query(({ input }) => getAdLevelBreakdown({ campaignId: input?.campaignId, limit: input?.limit })),

  /** Rolled-up totals for the marketing dashboard header. */
  overview: protectedProcedure
    .input(z.object({ since: z.date().optional(), until: z.date().optional() }).optional())
    .query(async ({ input }) => {
      const rows = await getCampaignPerformance({ since: input?.since, until: input?.until });
      const totals = rows.reduce(
        (acc, r) => ({
          spend: acc.spend + r.spend,
          impressions: acc.impressions + r.impressions,
          clicks: acc.clicks + r.clicks,
          leads: acc.leads + r.leads,
          consultations: acc.consultations + r.consultations,
          closed: acc.closed + r.closed,
          closedRevenue: acc.closedRevenue + r.closedRevenue,
        }),
        { spend: 0, impressions: 0, clicks: 0, leads: 0, consultations: 0, closed: 0, closedRevenue: 0 }
      );
      return {
        ...totals,
        costPerLead: totals.leads > 0 && totals.spend > 0 ? totals.spend / totals.leads : null,
        costPerClosedLoan: totals.closed > 0 && totals.spend > 0 ? totals.spend / totals.closed : null,
        roas: totals.spend > 0 ? totals.closedRevenue / totals.spend : null,
        campaignCount: rows.filter((r) => r.campaignId != null).length,
      };
    }),

  /** Refreshes insights for every published campaign. */
  syncAllMetrics: protectedProcedure.mutation(async () => {
    try {
      return await syncAllCampaignMetrics();
    } catch (err) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: err instanceof Error ? err.message : "Metrics sync failed",
      });
    }
  }),

  // ═══════════════════════════════════════════════════════════════════════
  // Conversion event log + manual reporting
  // ═══════════════════════════════════════════════════════════════════════

  conversionEvents: protectedProcedure
    .input(z.object({ leadId: z.number().optional(), campaignId: z.number().optional(), limit: z.number().optional() }).optional())
    .query(({ input }) => getConversionEvents(input)),

  /**
   * Reports a downstream conversion for a lead (consultation booked, loan closed).
   * Feeding these back to Meta is what lets its optimizer chase closed loans
   * rather than form fills.
   */
  reportConversion: protectedProcedure
    .input(z.object({
      leadId: z.number(),
      eventName: z.enum(["Schedule", "Lead", "CompleteRegistration", "Purchase", "SubmitApplication", "Contact"]),
      value: z.number().optional(),
    }))
    .mutation(async ({ input }) => {
      const lead = await getLeadById(input.leadId);
      if (!lead) throw new TRPCError({ code: "NOT_FOUND", message: "Lead not found" });
      const result = await reportLeadConversion(input.leadId, input.eventName, { value: input.value });
      if (!result.ok) throw new TRPCError({ code: "BAD_REQUEST", message: result.detail });
      return result;
    }),

  /**
   * Server-side PageView for a landing page visit. Called by the public page so
   * the view is recorded even when the browser pixel is blocked.
   */
  trackPageView: publicProcedure
    .input(z.object({ slug: z.string(), attribution: attributionInputSchema.optional() }))
    .mutation(async ({ input, ctx }) => {
      try {
        const page = await getLandingPageBySlug(input.slug);
        if (!page || !page.isActive) return { tracked: false };
        const { resolveCapiConfig } = await import("../meta/leadTracking");
        const config = await resolveCapiConfig(page as any);
        if (!config) return { tracked: false };

        const attribution = normalizeAttribution(input.attribution, {
          ip: clientIpFromRequest(ctx.req as any),
          userAgent: ctx.req.headers["user-agent"] ?? null,
        });

        const res = await sendConversionEvents(config, [{
          eventName: "PageView",
          eventId: input.attribution?.eventId || generateEventId("pv"),
          eventSourceUrl: attribution.landingUrl,
          actionSource: "website",
          userData: {
            fbc: attribution.fbc,
            fbp: attribution.fbp,
            clientIpAddress: attribution.clientIpAddress,
            clientUserAgent: attribution.clientUserAgent,
            country: "us",
          },
        }]);
        return { tracked: res.ok };
      } catch (err) {
        // A tracking failure must never surface on a public landing page.
        console.error("[CAPI] trackPageView failed:", err);
        return { tracked: false };
      }
    }),
});
