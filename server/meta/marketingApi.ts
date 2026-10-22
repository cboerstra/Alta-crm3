/**
 * Meta Marketing API — create and control ad campaigns from inside the CRM.
 *
 * Meta's object model is three levels deep, and all three must exist before an
 * ad can run:
 *
 *   Campaign  → objective + status
 *     Ad Set  → budget, schedule, targeting, optimization goal
 *       Ad    → creative (image, copy, destination URL)
 *
 * `publishCampaign` walks that chain in order and records each id as it goes, so
 * a failure halfway through still leaves the CRM knowing what was created —
 * re-running picks up where it stopped instead of orphaning objects in the ad
 * account.
 *
 * Everything is created PAUSED. Nothing in this CRM starts spending money
 * without someone explicitly activating it.
 */

import { graphRequest } from "./graph";

export type MetaCredentials = {
  adAccountId: string;      // act_123456789
  accessToken: string;
  apiVersion?: string;
  pageId?: string | null;
  instagramActorId?: string | null;
};

export type MetaTargeting = {
  countries?: string[];
  /** Meta geo "key" values for cities/regions/zips, e.g. { zips: ["US:84401"] } */
  zips?: string[];
  regions?: string[];
  cities?: Array<{ key: string; radius?: number; distance_unit?: "mile" | "kilometer" }>;
  ageMin?: number;
  ageMax?: number;
  genders?: number[];       // 1 = male, 2 = female; omit for all
  interests?: Array<{ id: string; name?: string }>;
  /** Raw passthrough for anything the helper above doesn't model. */
  raw?: Record<string, unknown>;
};

export type MetaCreative = {
  primaryText: string;
  headline?: string;
  description?: string;
  imageUrl?: string;
  imageHash?: string;
  callToAction?: string;    // LEARN_MORE, SIGN_UP, GET_QUOTE…
  destinationUrl: string;
};

/** Normalizes "123456789" → "act_123456789". */
export function normalizeAdAccountId(id: string): string {
  const trimmed = id.trim();
  return trimmed.startsWith("act_") ? trimmed : `act_${trimmed.replace(/^act/, "")}`;
}

/** Meta budgets are in the currency's minor unit (cents for USD). */
export function toMinorUnits(dollars: number | string): number {
  return Math.round(Number(dollars) * 100);
}

export function buildTargetingSpec(t: MetaTargeting | undefined | null): Record<string, unknown> {
  const targeting = t ?? {};
  const geo: Record<string, unknown> = {};
  if (targeting.countries?.length) geo.countries = targeting.countries;
  if (targeting.zips?.length) geo.zips = targeting.zips.map((key) => ({ key }));
  if (targeting.regions?.length) geo.regions = targeting.regions.map((key) => ({ key }));
  if (targeting.cities?.length) {
    geo.cities = targeting.cities.map((c) => ({
      key: c.key,
      radius: c.radius ?? 15,
      distance_unit: c.distance_unit ?? "mile",
    }));
  }
  if (Object.keys(geo).length === 0) geo.countries = ["US"];

  const spec: Record<string, unknown> = {
    geo_locations: geo,
    age_min: targeting.ageMin ?? 25,
    age_max: targeting.ageMax ?? 65,
  };
  if (targeting.genders?.length) spec.genders = targeting.genders;
  if (targeting.interests?.length) {
    spec.flexible_spec = [{ interests: targeting.interests.map((i) => ({ id: i.id, name: i.name })) }];
  }
  return { ...spec, ...(targeting.raw ?? {}) };
}

// ─── Campaign level ──────────────────────────────────────────────────────────

export async function createMetaCampaign(
  creds: MetaCredentials,
  input: { name: string; objective: string; status?: "PAUSED" | "ACTIVE"; specialAdCategories?: string[] }
): Promise<{ id: string }> {
  return graphRequest<{ id: string }>({
    path: `${normalizeAdAccountId(creds.adAccountId)}/campaigns`,
    method: "POST",
    accessToken: creds.accessToken,
    apiVersion: creds.apiVersion,
    body: {
      name: input.name,
      objective: input.objective,
      status: input.status ?? "PAUSED",
      // Mortgage advertising is a regulated category on Meta. Declaring it is
      // mandatory — omitting it gets the ad rejected, or the account flagged.
      special_ad_categories: input.specialAdCategories ?? ["HOUSING"],
    },
  });
}

// ─── Ad set level ────────────────────────────────────────────────────────────

export async function createMetaAdSet(
  creds: MetaCredentials,
  input: {
    name: string;
    campaignId: string;
    dailyBudget?: number | null;
    lifetimeBudget?: number | null;
    startTime?: Date | null;
    endTime?: Date | null;
    targeting?: MetaTargeting | null;
    optimizationGoal?: string;
    billingEvent?: string;
    bidStrategy?: string;
    pixelId?: string | null;
    conversionEvent?: string;
    status?: "PAUSED" | "ACTIVE";
  }
): Promise<{ id: string }> {
  const body: Record<string, unknown> = {
    name: input.name,
    campaign_id: input.campaignId,
    billing_event: input.billingEvent ?? "IMPRESSIONS",
    optimization_goal: input.optimizationGoal ?? "OFFSITE_CONVERSIONS",
    bid_strategy: input.bidStrategy ?? "LOWEST_COST_WITHOUT_CAP",
    targeting: buildTargetingSpec(input.targeting),
    status: input.status ?? "PAUSED",
    // Housing campaigns must repeat the special ad category at the ad set level.
    targeting_optimization_types: undefined,
  };

  if (input.dailyBudget) body.daily_budget = toMinorUnits(input.dailyBudget);
  if (input.lifetimeBudget) body.lifetime_budget = toMinorUnits(input.lifetimeBudget);
  if (input.startTime) body.start_time = input.startTime.toISOString();
  if (input.endTime) body.end_time = input.endTime.toISOString();

  // A lifetime budget without an end time is rejected by Meta.
  if (input.lifetimeBudget && !input.endTime) {
    throw new Error("A lifetime budget requires an end date");
  }

  // Optimizing for conversions requires telling Meta which pixel event to chase.
  if (input.pixelId && (body.optimization_goal === "OFFSITE_CONVERSIONS")) {
    body.promoted_object = {
      pixel_id: input.pixelId,
      custom_event_type: (input.conversionEvent ?? "LEAD").toUpperCase(),
    };
  }

  return graphRequest<{ id: string }>({
    path: `${normalizeAdAccountId(creds.adAccountId)}/adsets`,
    method: "POST",
    accessToken: creds.accessToken,
    apiVersion: creds.apiVersion,
    body,
  });
}

// ─── Creative + ad level ─────────────────────────────────────────────────────

/** Uploads an image by URL and returns Meta's image hash. */
export async function uploadAdImage(creds: MetaCredentials, imageUrl: string): Promise<string | undefined> {
  const res = await graphRequest<{ images?: Record<string, { hash?: string }> }>({
    path: `${normalizeAdAccountId(creds.adAccountId)}/adimages`,
    method: "POST",
    accessToken: creds.accessToken,
    apiVersion: creds.apiVersion,
    body: { url: imageUrl },
  });
  const first = res?.images ? Object.values(res.images)[0] : undefined;
  return first?.hash;
}

export async function createMetaAdCreative(
  creds: MetaCredentials,
  input: { name: string; creative: MetaCreative }
): Promise<{ id: string }> {
  if (!creds.pageId) {
    throw new Error("A Facebook Page must be connected before an ad creative can be created");
  }

  let imageHash = input.creative.imageHash;
  if (!imageHash && input.creative.imageUrl) {
    imageHash = await uploadAdImage(creds, input.creative.imageUrl);
  }

  const linkData: Record<string, unknown> = {
    link: input.creative.destinationUrl,
    message: input.creative.primaryText,
    call_to_action: { type: input.creative.callToAction ?? "LEARN_MORE" },
  };
  if (input.creative.headline) linkData.name = input.creative.headline;
  if (input.creative.description) linkData.description = input.creative.description;
  if (imageHash) linkData.image_hash = imageHash;

  const objectStorySpec: Record<string, unknown> = {
    page_id: creds.pageId,
    link_data: linkData,
  };
  if (creds.instagramActorId) objectStorySpec.instagram_actor_id = creds.instagramActorId;

  return graphRequest<{ id: string }>({
    path: `${normalizeAdAccountId(creds.adAccountId)}/adcreatives`,
    method: "POST",
    accessToken: creds.accessToken,
    apiVersion: creds.apiVersion,
    body: { name: input.name, object_story_spec: objectStorySpec },
  });
}

export async function createMetaAd(
  creds: MetaCredentials,
  input: { name: string; adSetId: string; creativeId: string; status?: "PAUSED" | "ACTIVE" }
): Promise<{ id: string }> {
  return graphRequest<{ id: string }>({
    path: `${normalizeAdAccountId(creds.adAccountId)}/ads`,
    method: "POST",
    accessToken: creds.accessToken,
    apiVersion: creds.apiVersion,
    body: {
      name: input.name,
      adset_id: input.adSetId,
      creative: { creative_id: input.creativeId },
      status: input.status ?? "PAUSED",
    },
  });
}

// ─── Control + reporting ─────────────────────────────────────────────────────

export async function updateObjectStatus(
  creds: MetaCredentials,
  objectId: string,
  status: "ACTIVE" | "PAUSED" | "ARCHIVED" | "DELETED"
): Promise<{ success: boolean }> {
  return graphRequest<{ success: boolean }>({
    path: objectId,
    method: "POST",
    accessToken: creds.accessToken,
    apiVersion: creds.apiVersion,
    body: { status },
  });
}

export async function updateAdSetBudget(
  creds: MetaCredentials,
  adSetId: string,
  input: { dailyBudget?: number | null; lifetimeBudget?: number | null }
): Promise<{ success: boolean }> {
  const body: Record<string, unknown> = {};
  if (input.dailyBudget != null) body.daily_budget = toMinorUnits(input.dailyBudget);
  if (input.lifetimeBudget != null) body.lifetime_budget = toMinorUnits(input.lifetimeBudget);
  if (Object.keys(body).length === 0) return { success: true };
  return graphRequest<{ success: boolean }>({
    path: adSetId,
    method: "POST",
    accessToken: creds.accessToken,
    apiVersion: creds.apiVersion,
    body,
  });
}

export type MetaInsightRow = {
  date_start: string;
  date_stop: string;
  impressions?: string;
  reach?: string;
  clicks?: string;
  spend?: string;
  cpc?: string;
  cpm?: string;
  ctr?: string;
  actions?: Array<{ action_type: string; value: string }>;
};

/**
 * Daily insights for one Meta campaign. `datePreset` accepts Meta's presets
 * ("last_30d", "maximum"); `since`/`until` override it with an explicit range.
 */
export async function fetchCampaignInsights(
  creds: MetaCredentials,
  metaCampaignId: string,
  opts?: { datePreset?: string; since?: string; until?: string }
): Promise<MetaInsightRow[]> {
  const query: Record<string, string> = {
    fields: "impressions,reach,clicks,spend,cpc,cpm,ctr,actions",
    time_increment: "1",
    level: "campaign",
    limit: "500",
  };
  if (opts?.since && opts?.until) {
    query.time_range = JSON.stringify({ since: opts.since, until: opts.until });
  } else {
    query.date_preset = opts?.datePreset ?? "last_30d";
  }

  const res = await graphRequest<{ data?: MetaInsightRow[] }>({
    path: `${metaCampaignId}/insights`,
    accessToken: creds.accessToken,
    apiVersion: creds.apiVersion,
    query,
  });
  return res?.data ?? [];
}

/** Pulls the lead-ish conversion count out of Meta's `actions` array. */
export function extractLeadCount(row: MetaInsightRow): number {
  const actions = row.actions ?? [];
  const leadTypes = new Set([
    "lead",
    "offsite_conversion.fb_pixel_lead",
    "onsite_conversion.lead_grouped",
    "offsite_conversion.fb_pixel_complete_registration",
  ]);
  let total = 0;
  for (const a of actions) {
    if (leadTypes.has(a.action_type)) total += Number(a.value) || 0;
  }
  return total;
}

/** Verifies credentials by reading the ad account back. */
export async function verifyAdAccount(creds: MetaCredentials): Promise<{
  id: string;
  name?: string;
  currency?: string;
  accountStatus?: number;
}> {
  const res = await graphRequest<{ id: string; name?: string; currency?: string; account_status?: number }>({
    path: normalizeAdAccountId(creds.adAccountId),
    accessToken: creds.accessToken,
    apiVersion: creds.apiVersion,
    query: { fields: "id,name,currency,account_status" },
  });
  return { id: res.id, name: res.name, currency: res.currency, accountStatus: res.account_status };
}
