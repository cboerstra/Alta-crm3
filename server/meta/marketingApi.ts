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

import { MIN_HOUSING_RADIUS_MILES } from "../../shared/metaGeo";
import { normalizePlatforms } from "../../shared/metaPlacements";
import { graphRequest, MetaApiError } from "./graph";

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
  /** A point and radius in miles; housing ads need at least 15 miles. */
  customLocations?: Array<{ name?: string; latitude: number; longitude: number; radius: number }>;
  cities?: Array<{ key: string; radius?: number; distance_unit?: "mile" | "kilometer" }>;
  ageMin?: number;
  ageMax?: number;
  genders?: number[];       // 1 = male, 2 = female; omit for all
  interests?: Array<{ id: string; name?: string }>;
  /** Where the ad runs: facebook, instagram, threads, messenger, audience_network. Defaults to Facebook and Instagram. */
  platforms?: string[];
  /** Meta Custom Audience ids to show to, and to leave out. */
  customAudiences?: string[];
  excludedCustomAudiences?: string[];
  /** Raw passthrough for anything the helper above doesn't model. */
  raw?: Record<string, unknown>;
};

export type MetaCreative = {
  primaryText: string;
  headline?: string;
  description?: string;
  imageUrl?: string;
  imageHash?: string;
  /** Video ad (Reels, Stories, Feed): a public MP4/MOV address, or the id once uploaded to Meta. */
  videoUrl?: string;
  videoId?: string;
  /** Cover image for the video; Meta's own thumbnail is used when absent. */
  thumbnailUrl?: string;
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
  // A whole country only when nothing narrower is set; Meta would otherwise
  // deliver to the union, i.e. the entire country.
  const narrower = !!(targeting.customLocations?.length || targeting.cities?.length || targeting.regions?.length);
  if (targeting.countries?.length && !narrower) geo.countries = targeting.countries;
  // ZIP codes are never sent: the Housing special ad category rejects them
  // (#2909042). The publisher stops a campaign that still has them.
  if (targeting.regions?.length) geo.regions = targeting.regions.map((key) => ({ key }));
  if (targeting.cities?.length) {
    geo.cities = targeting.cities.map((c) => ({
      key: c.key,
      radius: Math.max(MIN_HOUSING_RADIUS_MILES, c.radius ?? MIN_HOUSING_RADIUS_MILES),
      distance_unit: c.distance_unit ?? "mile",
    }));
  }
  if (targeting.customLocations?.length) {
    geo.custom_locations = targeting.customLocations.map((l) => ({
      latitude: l.latitude,
      longitude: l.longitude,
      radius: Math.max(MIN_HOUSING_RADIUS_MILES, l.radius),
      distance_unit: "mile",
    }));
  }
  if (Object.keys(geo).length === 0) geo.countries = ["US"];

  const spec: Record<string, unknown> = {
    geo_locations: geo,
    age_min: targeting.ageMin ?? 18,
    age_max: targeting.ageMax ?? 65,
    // Housing ad sets with set targeting must state this explicitly or Meta
    // rejects them. 0 keeps delivery inside the targeting configured here.
    targeting_automation: { advantage_audience: 0 },
    // The chosen platforms, every position on each (Feed, Stories, Reels…).
    // Never left automatic: Meta would add Threads, which fails unless the ad
    // account has been given the Threads profile (#4588023).
    publisher_platforms: normalizePlatforms(targeting.platforms),
  };
  if (targeting.genders?.length) spec.genders = targeting.genders;
  if (targeting.interests?.length) {
    spec.flexible_spec = [{ interests: targeting.interests.map((i) => ({ id: i.id, name: i.name })) }];
  }
  if (targeting.customAudiences?.length) spec.custom_audiences = targeting.customAudiences.map((id) => ({ id }));
  if (targeting.excludedCustomAudiences?.length) {
    spec.excluded_custom_audiences = targeting.excludedCustomAudiences.map((id) => ({ id }));
  }
  return { ...spec, ...(targeting.raw ?? {}) };
}

// ─── Campaign level ──────────────────────────────────────────────────────────

export async function createMetaCampaign(
  creds: MetaCredentials,
  input: { name: string; objective: string; status?: "PAUSED" | "ACTIVE"; specialAdCategories?: string[] }
): Promise<{ id: string }> {
  // Mortgage advertising is a regulated category on Meta. Declaring it is
  // mandatory — omitting it gets the ad rejected, or the account flagged.
  const specialAdCategories = input.specialAdCategories ?? ["HOUSING"];
  return graphRequest<{ id: string }>({
    path: `${normalizeAdAccountId(creds.adAccountId)}/campaigns`,
    method: "POST",
    accessToken: creds.accessToken,
    apiVersion: creds.apiVersion,
    body: {
      name: input.name,
      objective: input.objective,
      status: input.status ?? "PAUSED",
      special_ad_categories: specialAdCategories,
      // Meta requires the country whenever a special ad category is declared.
      ...(specialAdCategories.length > 0 ? { special_ad_category_country: ["US"] } : {}),
      // Budgets live on the ad set, and Meta requires this flag in that case.
      is_adset_budget_sharing_enabled: false,
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
  const path = `${normalizeAdAccountId(creds.adAccountId)}/adimages`;
  const hashOf = (res: { images?: Record<string, { hash?: string }> }) =>
    res?.images ? Object.values(res.images)[0]?.hash : undefined;
  try {
    return hashOf(await graphRequest({
      path, method: "POST", accessToken: creds.accessToken, apiVersion: creds.apiVersion,
      body: { url: imageUrl },
    }));
  } catch (err) {
    if (!(err instanceof MetaApiError) || err.status === 0) throw err;
    console.warn(`[Meta] adimages with url failed (${err.code ?? err.status}: ${err.message}); sending the image bytes instead`);
  }
  // Same fallback as videos: the app may not be allowed to have Meta fetch a URL.
  const file = await fetch(imageUrl);
  if (!file.ok) throw new Error(`Couldn't read the image at ${imageUrl} (HTTP ${file.status}) to send it to Meta`);
  const bytes = Buffer.from(await file.arrayBuffer()).toString("base64");
  return hashOf(await graphRequest({
    path, method: "POST", accessToken: creds.accessToken, apiVersion: creds.apiVersion,
    timeoutMs: 60_000,
    body: { bytes },
  }));
}

/**
 * Upload a video to the ad account. Meta is first asked to fetch it from its
 * public address; if the app isn't allowed that call (#3) or Meta can't fetch
 * it, the CRM downloads the file itself and sends the bytes.
 */
export async function uploadAdVideo(creds: MetaCredentials, videoUrl: string, name?: string): Promise<string> {
  const path = `${normalizeAdAccountId(creds.adAccountId)}/advideos`;
  try {
    const res = await graphRequest<{ id: string }>({
      path, method: "POST", accessToken: creds.accessToken, apiVersion: creds.apiVersion,
      timeoutMs: 120_000,
      body: { file_url: videoUrl, name },
    });
    return res.id;
  } catch (err) {
    if (!(err instanceof MetaApiError) || err.status === 0) throw err;
    console.warn(`[Meta] advideos with file_url failed (${err.code ?? err.status}: ${err.message}); sending the file bytes instead`);
  }
  const file = await fetch(videoUrl);
  if (!file.ok) throw new Error(`Couldn't read the video at ${videoUrl} (HTTP ${file.status}) to send it to Meta`);
  const form = new FormData();
  form.append("source", new Blob([await file.arrayBuffer()], { type: file.headers.get("content-type") || "video/mp4" }), "ad-video.mp4");
  if (name) form.append("name", name);
  const res = await graphRequest<{ id: string }>({
    path, method: "POST", accessToken: creds.accessToken, apiVersion: creds.apiVersion,
    timeoutMs: 300_000,
    form,
  });
  return res.id;
}

export type VideoStatus = "ready" | "processing" | "error";

/** Where Meta is with a video: an ad can only use it once it is ready. */
export async function getAdVideoStatus(creds: MetaCredentials, videoId: string): Promise<{ status: VideoStatus; message?: string }> {
  const res = await graphRequest<{ status?: { video_status?: string; processing_phase?: { errors?: Array<{ message?: string }> } } }>({
    path: videoId,
    accessToken: creds.accessToken,
    apiVersion: creds.apiVersion,
    query: { fields: "status" },
  });
  const raw = res.status?.video_status;
  if (raw === "ready") return { status: "ready" };
  if (raw === "error") return { status: "error", message: res.status?.processing_phase?.errors?.[0]?.message };
  return { status: "processing" };
}

/** Meta's preferred auto-generated thumbnail, used as the cover when none was uploaded. */
export async function getAdVideoThumbnail(creds: MetaCredentials, videoId: string): Promise<string | undefined> {
  const res = await graphRequest<{ data?: Array<{ uri?: string; is_preferred?: boolean }> }>({
    path: `${videoId}/thumbnails`,
    accessToken: creds.accessToken,
    apiVersion: creds.apiVersion,
  });
  const thumbs = res.data ?? [];
  return (thumbs.find((t) => t.is_preferred) ?? thumbs[0])?.uri;
}

/**
 * The object_story_spec for a video ad. Placed by Advantage+ placements in
 * Facebook and Instagram Reels, Stories and Feed; a vertical 9:16 video fits Reels best.
 */
export function buildVideoStorySpec(
  pageId: string,
  creative: MetaCreative & { videoId: string },
  cover: { imageUrl?: string; imageHash?: string },
  instagramUserId?: string | null,
): Record<string, unknown> {
  const videoData: Record<string, unknown> = {
    video_id: creative.videoId,
    message: creative.primaryText,
    call_to_action: { type: creative.callToAction ?? "LEARN_MORE", value: { link: creative.destinationUrl } },
  };
  if (creative.headline) videoData.title = creative.headline;
  if (creative.description) videoData.link_description = creative.description;
  if (cover.imageHash) videoData.image_hash = cover.imageHash;
  else if (cover.imageUrl) videoData.image_url = cover.imageUrl;
  const spec: Record<string, unknown> = { page_id: pageId, video_data: videoData };
  if (instagramUserId) spec.instagram_user_id = instagramUserId;
  return spec;
}

export async function createMetaAdCreative(
  creds: MetaCredentials,
  input: { name: string; creative: MetaCreative }
): Promise<{ id: string }> {
  if (!creds.pageId) {
    throw new Error("A Facebook Page must be connected before an ad creative can be created");
  }

  if (input.creative.videoId) {
    let cover: { imageUrl?: string; imageHash?: string } = {};
    if (input.creative.thumbnailUrl) {
      // A cover that won't upload isn't worth failing the ad over: Meta's own frame is used instead.
      cover.imageHash = await uploadAdImage(creds, input.creative.thumbnailUrl).catch((err) => {
        console.warn(`[Meta] Cover image upload failed, using Meta's thumbnail: ${err instanceof Error ? err.message : err}`);
        return undefined;
      });
    }
    if (!cover.imageHash) cover = { imageUrl: await getAdVideoThumbnail(creds, input.creative.videoId) };
    if (!cover.imageHash && !cover.imageUrl) {
      throw new Error("Meta hasn't made a cover image for the video yet. Upload a cover image or publish again in a minute.");
    }
    const send = (instagramUserId?: string | null) => graphRequest<{ id: string }>({
      path: `${normalizeAdAccountId(creds.adAccountId)}/adcreatives`,
      method: "POST",
      accessToken: creds.accessToken,
      apiVersion: creds.apiVersion,
      body: {
        name: input.name,
        object_story_spec: buildVideoStorySpec(
          creds.pageId!, input.creative as MetaCreative & { videoId: string }, cover, instagramUserId,
        ),
      },
    });
    return withoutInstagramOnPermissionError(creds, send);
  }

  let imageHash = input.creative.imageHash;
  if (!imageHash && input.creative.imageUrl) {
    imageHash = await uploadAdImage(creds, input.creative.imageUrl).catch((err) => {
      throw new Error(`Image upload: ${err instanceof Error ? err.message : String(err)}`);
    });
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
  // Meta replaced instagram_actor_id with instagram_user_id in v22.
  if (creds.instagramActorId) objectStorySpec.instagram_user_id = creds.instagramActorId;

  const send = (instagramUserId?: string | null) => {
    const spec = { ...objectStorySpec };
    if (instagramUserId) spec.instagram_user_id = instagramUserId; else delete spec.instagram_user_id;
    return graphRequest<{ id: string }>({
      path: `${normalizeAdAccountId(creds.adAccountId)}/adcreatives`,
      method: "POST",
      accessToken: creds.accessToken,
      apiVersion: creds.apiVersion,
      body: { name: input.name, object_story_spec: spec },
    });
  };
  return withoutInstagramOnPermissionError(creds, send);
}

/**
 * Create the creative with the connected Instagram account. If Meta refuses the
 * Instagram identity for lack of permission (#3, #10, #200), create it without
 * one: Meta then shows the ad on Instagram under the Facebook Page.
 */
async function withoutInstagramOnPermissionError<T>(
  creds: MetaCredentials,
  send: (instagramUserId?: string | null) => Promise<T>,
): Promise<T> {
  try {
    return await send(creds.instagramActorId);
  } catch (err) {
    const permission = err instanceof MetaApiError && [3, 10, 200].includes(err.code ?? -1);
    if (!creds.instagramActorId || !permission) throw err;
    console.warn(`[Meta] Creative refused with the Instagram account (${(err as MetaApiError).code}); retrying without it`);
    return send(null);
  }
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

/** Delete a campaign on Meta; its ad sets and ads go with it. */
export async function deleteMetaObject(creds: MetaCredentials, objectId: string): Promise<void> {
  await graphRequest({ path: objectId, method: "DELETE", accessToken: creds.accessToken, apiVersion: creds.apiVersion });
}

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
