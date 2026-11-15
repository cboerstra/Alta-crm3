/**
 * Publishes a CRM campaign to Meta and pulls its performance back.
 *
 * The destination URL is built here rather than in the UI, because getting it
 * right is what makes six-month-later attribution work: every ad points at the
 * campaign's landing page with UTM tags *and* Meta's dynamic macros
 * ({{campaign.id}}, {{adset.id}}, {{ad.id}}), so the landing page can record the
 * exact ad that produced each lead without any manual URL bookkeeping.
 */

import {
  createMetaAd,
  createMetaAdCreative,
  createMetaAdSet,
  createMetaCampaign,
  getAdVideoStatus,
  uploadAdVideo,
  fetchCampaignInsights,
  extractLeadCount,
  updateAdSetBudget,
  updateObjectStatus,
  type MetaCredentials,
  type MetaCreative,
  type MetaTargeting,
} from "./marketingApi";
import { MetaApiError } from "./graph";
import {
  getAdCampaignById,
  getMetaSettings,
  updateAdCampaign,
  upsertAdCampaignMetric,
} from "../marketingDb";
import { getLandingPageById } from "../db";
import { resolveMetaAudienceIds } from "../audienceSync";
import type { AdCampaign } from "../../drizzle/schema";

export class CampaignPublishError extends Error {
  readonly stage: string;
  constructor(stage: string, message: string) {
    super(message);
    this.name = "CampaignPublishError";
    this.stage = stage;
  }
}

/** Public base URL of this CRM, used to build ad destination links. */
export function getPublicBaseUrl(): string {
  const raw =
    process.env.PUBLIC_BASE_URL ||
    process.env.APP_BASE_URL ||
    process.env.VITE_APP_URL ||
    "";
  return raw.replace(/\/+$/, "");
}

/** Pages hosted on FreeHomeSearchUtah.com are served there, so ads must link there too. */
export function landingPageSiteUrl(hostSite: string | null | undefined, crmBaseUrl: string): string {
  return hostSite === "freehomesearchutah" ? "https://freehomesearchutah.com" : crmBaseUrl;
}

/** Uploaded files are stored as /uploads/…; Meta needs the full public address to download them. */
export function absoluteMediaUrl(url: string | undefined, baseUrl: string): string | undefined {
  if (!url) return undefined;
  return url.startsWith("/") ? `${baseUrl}${url}` : url;
}

/** Run one publishing step; a failure names the step, e.g. "Ad set: …". */
async function step<T>(label: string, fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`${label}: ${message}`);
  }
}

const VIDEO_WAIT_MS = 45_000;
const VIDEO_POLL_MS = 5_000;

/**
 * Upload the campaign's video to Meta once and wait briefly for processing.
 * Meta often needs a minute or two for a Reel; publishing again picks up
 * where this left off, because the video id is saved on the campaign.
 */
async function ensureVideoReady(
  campaign: AdCampaign,
  creds: Awaited<ReturnType<typeof resolveCredentials>>,
  baseUrl: string,
): Promise<string> {
  const creative = (campaign.creative ?? {}) as Partial<MetaCreative>;
  let videoId = creative.videoId;
  if (!videoId) {
    videoId = await uploadAdVideo(creds, absoluteMediaUrl(creative.videoUrl, baseUrl)!, `${campaign.name} — Video`);
    await updateAdCampaign(campaign.id, { creative: { ...creative, videoId } as any });
  }
  const deadline = Date.now() + VIDEO_WAIT_MS;
  for (;;) {
    const { status, message } = await getAdVideoStatus(creds, videoId);
    if (status === "ready") return videoId;
    if (status === "error") {
      // Clear the id so the next publish uploads the video again.
      await updateAdCampaign(campaign.id, { creative: { ...creative, videoId: undefined } as any });
      throw new Error(`Meta couldn't process the video${message ? `: ${message}` : ""}. Check it's an MP4 or MOV under 4 GB, then publish again.`);
    }
    if (Date.now() >= deadline) {
      throw new Error("Meta is still processing the video. Publish again in a minute or two; the campaign and ad set are already set up and won't be duplicated.");
    }
    await new Promise((resolve) => setTimeout(resolve, VIDEO_POLL_MS));
  }
}

/**
 * Builds the ad's destination URL for a campaign's landing page.
 * Meta substitutes the `{{...}}` macros at delivery time; anything it cannot
 * substitute arrives literally and is discarded by the attribution normalizer.
 */
export function buildDestinationUrl(opts: {
  baseUrl: string;
  slug: string;
  utmSource?: string | null;
  utmMedium?: string | null;
  utmCampaign?: string | null;
  utmContent?: string | null;
}): string {
  const base = `${opts.baseUrl.replace(/\/+$/, "")}/lp/${opts.slug}`;
  const params = new URLSearchParams();
  params.set("utm_source", opts.utmSource || "facebook");
  params.set("utm_medium", opts.utmMedium || "paid_social");
  if (opts.utmCampaign) params.set("utm_campaign", opts.utmCampaign);
  if (opts.utmContent) params.set("utm_content", opts.utmContent);

  // URLSearchParams percent-encodes the braces, which stops Meta substituting the
  // macros — so they are appended raw, after the encoded portion.
  const macros = [
    "meta_campaign_id={{campaign.id}}",
    "meta_campaign_name={{campaign.name}}",
    "meta_adset_id={{adset.id}}",
    "meta_adset_name={{adset.name}}",
    "meta_ad_id={{ad.id}}",
    "meta_ad_name={{ad.name}}",
    "meta_placement={{placement}}",
  ].join("&");

  return `${base}?${params.toString()}&${macros}`;
}

async function resolveCredentials(): Promise<MetaCredentials> {
  const settings = await getMetaSettings();
  if (!settings?.adAccountId || !settings.accessToken) {
    throw new CampaignPublishError("credentials", "Connect a Meta ad account in Settings → Meta Ads first");
  }
  return {
    adAccountId: settings.adAccountId,
    accessToken: settings.accessToken,
    apiVersion: settings.apiVersion ?? undefined,
    pageId: settings.pageId,
    instagramActorId: settings.instagramActorId,
  };
}

export type PublishResult = {
  metaCampaignId: string;
  metaAdSetId: string;
  metaCreativeId: string;
  metaAdId: string;
  destinationUrl: string;
};

/**
 * Creates (or completes) the Campaign → Ad Set → Creative → Ad chain on Meta.
 *
 * Each id is written back to the CRM as soon as Meta returns it. If a later step
 * fails, re-running skips what already exists instead of creating duplicates —
 * the ad account stays clean and the operator can just fix the error and retry.
 */
export async function publishCampaign(campaignId: number): Promise<PublishResult> {
  const campaign = await getAdCampaignById(campaignId);
  if (!campaign) throw new CampaignPublishError("load", "Campaign not found");

  const settings = await getMetaSettings();
  if (!settings?.publishEnabled) {
    throw new CampaignPublishError(
      "disabled",
      "Publishing to Meta is turned off. Enable it in Settings → Meta Ads once you are ready to create live ad objects."
    );
  }

  const creds = await resolveCredentials();

  if (!campaign.landingPageId) {
    throw new CampaignPublishError("landing_page", "Attach a landing page before publishing");
  }
  const page = await getLandingPageById(campaign.landingPageId);
  if (!page) throw new CampaignPublishError("landing_page", "The attached landing page no longer exists");

  const baseUrl = getPublicBaseUrl();
  if (!baseUrl) {
    throw new CampaignPublishError(
      "config",
      "Set PUBLIC_BASE_URL (e.g. https://crm.altamortgagegroup.net) so ads can link to your landing pages"
    );
  }

  const destinationUrl = buildDestinationUrl({
    baseUrl: landingPageSiteUrl((page as any).hostSite, baseUrl),
    slug: page.slug,
    utmSource: campaign.utmSource,
    utmMedium: campaign.utmMedium,
    utmCampaign: campaign.utmCampaign ?? campaign.name,
    utmContent: campaign.utmContent,
  });

  const creativeInput = (campaign.creative ?? {}) as Partial<MetaCreative>;
  if (!creativeInput.primaryText) {
    throw new CampaignPublishError("creative", "Add ad copy (primary text) before publishing");
  }

  const zipTargets = ((campaign.targeting ?? {}) as MetaTargeting).zips ?? [];
  if (zipTargets.length > 0) {
    throw new CampaignPublishError(
      "targeting",
      "Housing ads can't target ZIP codes. Edit the campaign and choose a target area (a town and a radius of 15 miles or more), then publish again.",
    );
  }

  // CRM audience ids → Meta audience ids, checked before anything is created in Meta.
  const storedTargeting = (campaign.targeting ?? {}) as MetaTargeting & {
    includeAudienceIds?: number[];
    excludeAudienceIds?: number[];
  };
  const { includeAudienceIds, excludeAudienceIds, ...metaTargeting } = storedTargeting;
  let targeting: MetaTargeting | null = campaign.targeting ? metaTargeting : null;
  try {
    const include = await resolveMetaAudienceIds(includeAudienceIds ?? []);
    const exclude = await resolveMetaAudienceIds(excludeAudienceIds ?? []);
    if (include.length || exclude.length) {
      targeting = { ...metaTargeting, customAudiences: include, excludedCustomAudiences: exclude };
    }
  } catch (err) {
    throw new CampaignPublishError("audiences", err instanceof Error ? err.message : String(err));
  }

  await updateAdCampaign(campaignId, { syncStatus: "syncing", syncError: null });

  try {
    // ── Campaign ───────────────────────────────────────────────────────────
    let metaCampaignId = campaign.metaCampaignId ?? undefined;
    if (!metaCampaignId) {
      const created = await step("Campaign", () => createMetaCampaign(creds, {
        name: campaign.name,
        objective: campaign.objective,
        status: "PAUSED",
      }));
      metaCampaignId = created.id;
      await updateAdCampaign(campaignId, { metaCampaignId, metaAdAccountId: creds.adAccountId });
    }

    // ── Ad set ─────────────────────────────────────────────────────────────
    let metaAdSetId = campaign.metaAdSetId ?? undefined;
    if (!metaAdSetId) {
      const created = await step("Ad set", () => createMetaAdSet(creds, {
        name: `${campaign.name} — Ad Set`,
        campaignId: metaCampaignId!,
        dailyBudget: campaign.dailyBudget ? Number(campaign.dailyBudget) : null,
        lifetimeBudget: campaign.lifetimeBudget ? Number(campaign.lifetimeBudget) : null,
        startTime: campaign.startDate,
        endTime: campaign.endDate,
        targeting,
        bidStrategy: campaign.bidStrategy ?? undefined,
        pixelId: (page as any).metaPixelId || settings.pixelId,
        conversionEvent: (page as any).conversionEventName || "Lead",
        status: "PAUSED",
      }));
      metaAdSetId = created.id;
      await updateAdCampaign(campaignId, { metaAdSetId });
    }

    // ── Creative ───────────────────────────────────────────────────────────
    let metaCreativeId = campaign.metaCreativeId ?? undefined;
    if (!metaCreativeId) {
      const videoId = creativeInput.videoUrl
        ? await step("Video upload", () => ensureVideoReady(campaign, creds, baseUrl))
        : undefined;
      const created = await step("Ad creative", () => createMetaAdCreative(creds, {
        name: `${campaign.name} — Creative`,
        creative: {
          primaryText: creativeInput.primaryText!,
          headline: creativeInput.headline,
          description: creativeInput.description,
          imageUrl: absoluteMediaUrl(creativeInput.imageUrl, baseUrl),
          imageHash: creativeInput.imageHash,
          videoId,
          thumbnailUrl: absoluteMediaUrl(creativeInput.thumbnailUrl, baseUrl),
          callToAction: creativeInput.callToAction,
          destinationUrl,
        },
      }));
      metaCreativeId = created.id;
      await updateAdCampaign(campaignId, { metaCreativeId });
    }

    // ── Ad ─────────────────────────────────────────────────────────────────
    let metaAdId = campaign.metaAdId ?? undefined;
    if (!metaAdId) {
      const created = await step("Ad", () => createMetaAd(creds, {
        name: `${campaign.name} — Ad`,
        adSetId: metaAdSetId!,
        creativeId: metaCreativeId!,
        status: "PAUSED",
      }));
      metaAdId = created.id;
      await updateAdCampaign(campaignId, { metaAdId });
    }

    await updateAdCampaign(campaignId, {
      syncStatus: "synced",
      syncError: null,
      lastSyncedAt: new Date(),
      // Objects exist on Meta but are paused — the operator activates deliberately.
      status: campaign.status === "draft" ? "paused" : campaign.status,
    });

    return { metaCampaignId, metaAdSetId, metaCreativeId, metaAdId, destinationUrl };
  } catch (err) {
    const message =
      err instanceof MetaApiError ? err.message
      : err instanceof Error ? err.message
      : String(err);
    await updateAdCampaign(campaignId, { syncStatus: "error", syncError: message });
    throw new CampaignPublishError("publish", message);
  }
}

/** Starts or pauses delivery of an already-published campaign. */
export async function setCampaignDelivery(
  campaignId: number,
  active: boolean
): Promise<{ status: AdCampaign["status"] }> {
  const campaign = await getAdCampaignById(campaignId);
  if (!campaign) throw new CampaignPublishError("load", "Campaign not found");

  // Local-only campaigns just flip their CRM status.
  if (!campaign.metaCampaignId) {
    const status = active ? "active" : "paused";
    await updateAdCampaign(campaignId, { status });
    return { status };
  }

  const creds = await resolveCredentials();
  const metaStatus = active ? "ACTIVE" : "PAUSED";

  try {
    // Ad set and ad must both be live for delivery; pausing the campaign alone is
    // enough to stop it, but we mirror the state down the chain so the ad account
    // reads the way the CRM does.
    await updateObjectStatus(creds, campaign.metaCampaignId, metaStatus);
    if (campaign.metaAdSetId) await updateObjectStatus(creds, campaign.metaAdSetId, metaStatus);
    if (campaign.metaAdId) await updateObjectStatus(creds, campaign.metaAdId, metaStatus);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await updateAdCampaign(campaignId, { syncStatus: "error", syncError: message });
    throw new CampaignPublishError("status", message);
  }

  const status = active ? "active" : "paused";
  await updateAdCampaign(campaignId, { status, syncStatus: "synced", syncError: null, lastSyncedAt: new Date() });
  return { status };
}

/** Pushes a budget change to the live ad set. */
export async function syncCampaignBudget(campaignId: number): Promise<void> {
  const campaign = await getAdCampaignById(campaignId);
  if (!campaign?.metaAdSetId) return;
  const creds = await resolveCredentials();
  await updateAdSetBudget(creds, campaign.metaAdSetId, {
    dailyBudget: campaign.dailyBudget ? Number(campaign.dailyBudget) : null,
    lifetimeBudget: campaign.lifetimeBudget ? Number(campaign.lifetimeBudget) : null,
  });
  await updateAdCampaign(campaignId, { lastSyncedAt: new Date() });
}

/** Pulls daily insights for one campaign and stores them. Returns rows written. */
export async function syncCampaignMetrics(
  campaignId: number,
  opts?: { datePreset?: string; since?: string; until?: string }
): Promise<number> {
  const campaign = await getAdCampaignById(campaignId);
  if (!campaign?.metaCampaignId) return 0;

  const creds = await resolveCredentials();
  const rows = await fetchCampaignInsights(creds, campaign.metaCampaignId, opts);

  for (const row of rows) {
    await upsertAdCampaignMetric({
      adCampaignId: campaignId,
      date: row.date_start,
      impressions: Number(row.impressions ?? 0),
      reach: Number(row.reach ?? 0),
      clicks: Number(row.clicks ?? 0),
      spend: String(Number(row.spend ?? 0).toFixed(2)),
      reportedLeads: extractLeadCount(row),
      cpc: row.cpc ? String(Number(row.cpc).toFixed(4)) : null,
      cpm: row.cpm ? String(Number(row.cpm).toFixed(4)) : null,
      ctr: row.ctr ? String(Number(row.ctr).toFixed(4)) : null,
      raw: row as any,
    });
  }

  await updateAdCampaign(campaignId, { lastSyncedAt: new Date() });
  return rows.length;
}

/** Refreshes insights for every campaign that has been published to Meta. */
export async function syncAllCampaignMetrics(): Promise<{ campaigns: number; rows: number }> {
  const { getAdCampaigns } = await import("../marketingDb");
  const all = await getAdCampaigns();
  const published = all.filter((c) => c.metaCampaignId);
  let rows = 0;
  for (const c of published) {
    try {
      rows += await syncCampaignMetrics(c.id, { datePreset: "last_30d" });
    } catch (err) {
      console.error(`[Meta] Metrics sync failed for campaign ${c.id}:`, err instanceof Error ? err.message : err);
    }
  }
  return { campaigns: published.length, rows };
}
