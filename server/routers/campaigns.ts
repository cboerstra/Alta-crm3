import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { adminProcedure, protectedProcedure, router } from "../_core/trpc";
import {
  createCampaign,
  deleteCampaign,
  getCampaignById,
  getCampaignMetrics,
  getCampaigns,
  getCampaignSpendTotals,
  getLeadsForCampaign,
  getMetaSettings,
  getSequenceById,
  updateCampaign,
} from "../marketingDb";
import { getLandingPageById, getLandingPageBySlug, updateLandingPage } from "../db";
import {
  buildDestinationUrl,
  getPublicBaseUrl,
  publishCampaign,
  setCampaignDelivery,
  syncCampaignBudget,
  syncCampaignMetrics,
  CampaignPublishError,
} from "../meta/publisher";
import { draftCampaignWithAI } from "../marketingAi";

const objectiveEnum = z.enum([
  "OUTCOME_LEADS",
  "OUTCOME_TRAFFIC",
  "OUTCOME_AWARENESS",
  "OUTCOME_ENGAGEMENT",
  "OUTCOME_SALES",
]);

const statusEnum = z.enum(["draft", "scheduled", "active", "paused", "completed", "archived"]);

const targetingSchema = z.object({
  countries: z.array(z.string()).optional(),
  zips: z.array(z.string()).optional(),
  regions: z.array(z.string()).optional(),
  cities: z.array(z.object({
    key: z.string(),
    radius: z.number().optional(),
    distance_unit: z.enum(["mile", "kilometer"]).optional(),
  })).optional(),
  ageMin: z.number().min(18).max(65).optional(),
  ageMax: z.number().min(18).max(65).optional(),
  genders: z.array(z.number()).optional(),
  interests: z.array(z.object({ id: z.string(), name: z.string().optional() })).optional(),
  raw: z.record(z.string(), z.unknown()).optional(),
});

const creativeSchema = z.object({
  primaryText: z.string().optional(),
  headline: z.string().optional(),
  description: z.string().optional(),
  imageUrl: z.string().optional(),
  imageHash: z.string().optional(),
  callToAction: z.string().optional(),
});

/** Slug-safe utm_campaign value derived from the campaign name. */
function toUtmCampaign(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 128);
}

function toPublishError(err: unknown): TRPCError {
  if (err instanceof CampaignPublishError) {
    return new TRPCError({
      code: err.stage === "credentials" || err.stage === "disabled" ? "PRECONDITION_FAILED" : "BAD_REQUEST",
      message: err.message,
    });
  }
  return new TRPCError({
    code: "INTERNAL_SERVER_ERROR",
    message: err instanceof Error ? err.message : "Campaign operation failed",
  });
}

export const campaignsRouter = router({
  // ─── Read ──────────────────────────────────────────────────────────────────

  list: protectedProcedure
    .input(z.object({ status: statusEnum.optional() }).optional())
    .query(async ({ input }) => {
      const items = await getCampaigns({ status: input?.status });
      const totals = await getCampaignSpendTotals(items.map((c) => c.id));
      const byId = new Map(totals.map((t) => [t.campaignId, t]));
      return items.map((c) => ({
        ...c,
        totals: byId.get(c.id) ?? { campaignId: c.id, spend: 0, impressions: 0, clicks: 0, reportedLeads: 0 },
      }));
    }),

  getById: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const campaign = await getCampaignById(input.id);
      if (!campaign) return null;

      const [metrics, leads, page, sequence] = await Promise.all([
        getCampaignMetrics(input.id),
        getLeadsForCampaign(input.id, 200),
        campaign.landingPageId ? getLandingPageById(campaign.landingPageId) : Promise.resolve(undefined),
        campaign.sequenceId ? getSequenceById(campaign.sequenceId) : Promise.resolve(undefined),
      ]);

      const baseUrl = getPublicBaseUrl();
      const destinationUrl = page && baseUrl
        ? buildDestinationUrl({
            baseUrl,
            slug: page.slug,
            utmSource: campaign.utmSource,
            utmMedium: campaign.utmMedium,
            utmCampaign: campaign.utmCampaign ?? campaign.name,
            utmContent: campaign.utmContent,
          })
        : null;

      // CRM-side outcomes, which is what makes this different from Ads Manager.
      const totals = metrics.reduce(
        (acc, m) => ({
          spend: acc.spend + Number(m.spend ?? 0),
          impressions: acc.impressions + Number(m.impressions ?? 0),
          clicks: acc.clicks + Number(m.clicks ?? 0),
          reportedLeads: acc.reportedLeads + Number(m.reportedLeads ?? 0),
        }),
        { spend: 0, impressions: 0, clicks: 0, reportedLeads: 0 }
      );

      const crmLeads = leads.length;
      const consultations = leads.filter((l) =>
        ["consultation_booked", "under_contract", "closed"].includes(l.stage)
      ).length;
      const closed = leads.filter((l) => l.stage === "closed").length;
      const closedRevenue = leads
        .filter((l) => l.stage === "closed")
        .reduce((sum, l) => sum + Number(l.dealValue ?? 0), 0);

      return {
        ...campaign,
        landingPage: page ?? null,
        sequence: sequence ?? null,
        destinationUrl,
        metrics,
        leads,
        summary: {
          ...totals,
          crmLeads,
          consultations,
          closed,
          closedRevenue,
          costPerLead: crmLeads > 0 && totals.spend > 0 ? totals.spend / crmLeads : null,
          costPerClosedLoan: closed > 0 && totals.spend > 0 ? totals.spend / closed : null,
          roas: totals.spend > 0 ? closedRevenue / totals.spend : null,
        },
      };
    }),

  metrics: protectedProcedure
    .input(z.object({ id: z.number(), since: z.string().optional(), until: z.string().optional() }))
    .query(({ input }) => getCampaignMetrics(input.id, { since: input.since, until: input.until })),

  // ─── Write ─────────────────────────────────────────────────────────────────

  create: protectedProcedure
    .input(z.object({
      name: z.string().min(1, "Name is required"),
      description: z.string().optional(),
      objective: objectiveEnum.default("OUTCOME_LEADS"),
      landingPageId: z.number().nullable().optional(),
      sequenceId: z.number().nullable().optional(),
      dailyBudget: z.number().positive().nullable().optional(),
      lifetimeBudget: z.number().positive().nullable().optional(),
      startDate: z.date().nullable().optional(),
      endDate: z.date().nullable().optional(),
      targeting: targetingSchema.nullable().optional(),
      creative: creativeSchema.nullable().optional(),
      utmSource: z.string().optional(),
      utmMedium: z.string().optional(),
      utmCampaign: z.string().optional(),
      utmContent: z.string().optional(),
      aiGenerated: z.boolean().optional(),
      aiPrompt: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      if (input.lifetimeBudget && !input.endDate) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "A lifetime budget needs an end date" });
      }
      if (!input.dailyBudget && !input.lifetimeBudget) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Set a daily or lifetime budget" });
      }

      const id = await createCampaign({
        name: input.name,
        description: input.description,
        objective: input.objective,
        status: "draft",
        landingPageId: input.landingPageId ?? null,
        sequenceId: input.sequenceId ?? null,
        dailyBudget: input.dailyBudget != null ? String(input.dailyBudget) : null,
        lifetimeBudget: input.lifetimeBudget != null ? String(input.lifetimeBudget) : null,
        startDate: input.startDate ?? null,
        endDate: input.endDate ?? null,
        targeting: (input.targeting ?? null) as any,
        creative: (input.creative ?? null) as any,
        utmSource: input.utmSource ?? "facebook",
        utmMedium: input.utmMedium ?? "paid_social",
        utmCampaign: input.utmCampaign ?? toUtmCampaign(input.name),
        utmContent: input.utmContent ?? null,
        aiGenerated: input.aiGenerated ?? false,
        aiPrompt: input.aiPrompt ?? null,
        createdBy: ctx.user.id,
      });

      // Claim the landing page so lead capture can resolve the campaign even when
      // the click parameters are stripped (shared links, copy-pasted URLs).
      if (input.landingPageId) {
        await updateLandingPage(input.landingPageId, { campaignId: id } as any);
      }

      return { id };
    }),

  update: protectedProcedure
    .input(z.object({
      id: z.number(),
      name: z.string().min(1).optional(),
      description: z.string().nullable().optional(),
      objective: objectiveEnum.optional(),
      status: statusEnum.optional(),
      landingPageId: z.number().nullable().optional(),
      sequenceId: z.number().nullable().optional(),
      dailyBudget: z.number().positive().nullable().optional(),
      lifetimeBudget: z.number().positive().nullable().optional(),
      startDate: z.date().nullable().optional(),
      endDate: z.date().nullable().optional(),
      targeting: targetingSchema.nullable().optional(),
      creative: creativeSchema.nullable().optional(),
      utmSource: z.string().optional(),
      utmMedium: z.string().optional(),
      utmCampaign: z.string().optional(),
      utmContent: z.string().nullable().optional(),
    }))
    .mutation(async ({ input }) => {
      const { id, dailyBudget, lifetimeBudget, targeting, creative, ...rest } = input;
      const existing = await getCampaignById(id);
      if (!existing) throw new TRPCError({ code: "NOT_FOUND", message: "Campaign not found" });

      const data: Record<string, unknown> = { ...rest };
      if (dailyBudget !== undefined) data.dailyBudget = dailyBudget != null ? String(dailyBudget) : null;
      if (lifetimeBudget !== undefined) data.lifetimeBudget = lifetimeBudget != null ? String(lifetimeBudget) : null;
      if (targeting !== undefined) data.targeting = targeting;
      if (creative !== undefined) data.creative = creative;

      await updateCampaign(id, data as any);

      if (input.landingPageId) {
        await updateLandingPage(input.landingPageId, { campaignId: id } as any);
      }

      // Keep a live ad set's budget in step with the CRM. A failure here is
      // reported but must not roll back the local edit.
      const budgetChanged = dailyBudget !== undefined || lifetimeBudget !== undefined;
      if (budgetChanged && existing.metaAdSetId) {
        try {
          await syncCampaignBudget(id);
        } catch (err) {
          return {
            success: true,
            warning: `Saved locally, but Meta rejected the budget change: ${err instanceof Error ? err.message : String(err)}`,
          };
        }
      }

      return { success: true };
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const campaign = await getCampaignById(input.id);
      if (campaign?.metaCampaignId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "This campaign exists on Meta. Archive it instead so its spend history and attribution stay intact.",
        });
      }
      await deleteCampaign(input.id);
      return { success: true };
    }),

  archive: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      await updateCampaign(input.id, { status: "archived" });
      return { success: true };
    }),

  // ─── Meta sync ─────────────────────────────────────────────────────────────

  /** Previews the exact destination URL an ad would use, macros and all. */
  previewDestinationUrl: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const campaign = await getCampaignById(input.id);
      if (!campaign?.landingPageId) return { url: null, reason: "No landing page attached" };
      const page = await getLandingPageById(campaign.landingPageId);
      if (!page) return { url: null, reason: "Landing page not found" };
      const baseUrl = getPublicBaseUrl();
      if (!baseUrl) return { url: null, reason: "PUBLIC_BASE_URL is not configured" };
      return {
        url: buildDestinationUrl({
          baseUrl,
          slug: page.slug,
          utmSource: campaign.utmSource,
          utmMedium: campaign.utmMedium,
          utmCampaign: campaign.utmCampaign ?? campaign.name,
          utmContent: campaign.utmContent,
        }),
        reason: null,
      };
    }),

  publish: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      try {
        return await publishCampaign(input.id);
      } catch (err) {
        throw toPublishError(err);
      }
    }),

  setDelivery: adminProcedure
    .input(z.object({ id: z.number(), active: z.boolean() }))
    .mutation(async ({ input }) => {
      try {
        return await setCampaignDelivery(input.id, input.active);
      } catch (err) {
        throw toPublishError(err);
      }
    }),

  syncMetrics: protectedProcedure
    .input(z.object({ id: z.number(), datePreset: z.string().optional() }))
    .mutation(async ({ input }) => {
      try {
        const rows = await syncCampaignMetrics(input.id, { datePreset: input.datePreset ?? "last_30d" });
        return { rows };
      } catch (err) {
        throw toPublishError(err);
      }
    }),

  // ─── AI drafting ───────────────────────────────────────────────────────────

  /**
   * Drafts a complete campaign from a plain-language brief
   * ("create a Facebook campaign for the Weber County grant").
   * Returns a proposal only — nothing is saved and nothing reaches Meta until
   * someone reviews it and clicks create.
   */
  draftWithAI: protectedProcedure
    .input(z.object({
      prompt: z.string().min(3, "Describe the campaign you want"),
      landingPageSlug: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const page = input.landingPageSlug ? await getLandingPageBySlug(input.landingPageSlug) : null;
      try {
        return await draftCampaignWithAI({ prompt: input.prompt, landingPage: page ?? null });
      } catch (err) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: err instanceof Error ? err.message : "AI drafting failed",
        });
      }
    }),

  /** Whether Meta is wired up — drives the empty states in the Campaigns UI. */
  connectionStatus: protectedProcedure.query(async () => {
    const settings = await getMetaSettings();
    return {
      adAccountConnected: !!(settings?.adAccountId && settings.accessToken),
      pageConnected: !!settings?.pageId,
      pixelConfigured: !!settings?.pixelId,
      capiConfigured: !!(settings?.pixelId && (settings.capiAccessToken || settings.accessToken)) && !!settings?.capiEnabled,
      publishEnabled: !!settings?.publishEnabled,
      baseUrlConfigured: !!getPublicBaseUrl(),
      lastVerifiedAt: settings?.lastVerifiedAt ?? null,
    };
  }),
});
