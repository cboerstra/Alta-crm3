/**
 * Browser-side attribution capture.
 *
 * Reads the click parameters off the landing URL, pairs them with Meta's own
 * first-party cookies (`_fbp`, `_fbc`), and stores the result for the lifetime of
 * the visit. First touch wins: if someone arrives from an ad, wanders off, and
 * comes back directly before submitting, the ad still gets the credit — which is
 * the whole point of recording this at all.
 *
 * Nothing here is sensitive; it is the same data Meta's pixel already sees. It is
 * captured explicitly so the CRM owns a copy that survives ad blockers and
 * outlives Meta's own attribution window.
 */

const STORAGE_KEY = "alta:attribution";

export type Attribution = {
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmContent?: string;
  utmTerm?: string;
  fbclid?: string;
  fbc?: string;
  fbp?: string;
  gclid?: string;
  metaCampaignId?: string;
  metaCampaignName?: string;
  metaAdsetId?: string;
  metaAdsetName?: string;
  metaAdId?: string;
  metaAdName?: string;
  metaPlacement?: string;
  landingUrl?: string;
  referrerUrl?: string;
  eventId?: string;
  capturedAt?: string;
};

/** Reads a cookie by name; returns undefined rather than an empty string. */
function readCookie(name: string): string | undefined {
  if (typeof document === "undefined") return undefined;
  const match = document.cookie.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : undefined;
}

/** Meta macros arrive literally when unsubstituted — drop those. */
function clean(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  if (!trimmed || /^\{\{.*\}\}$/.test(trimmed)) return undefined;
  return trimmed;
}

/** A short random id, shared between the browser pixel and the server event. */
export function generateEventId(): string {
  const random =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID().replace(/-/g, "").slice(0, 16)
      : Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 10);
  return `lp_${Date.now().toString(36)}_${random}`;
}

function readStored(): Attribution | null {
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Attribution) : null;
  } catch {
    // Private browsing or storage disabled — attribution still works for this
    // pageview, it just won't survive a navigation.
    return null;
  }
}

function persist(attribution: Attribution): void {
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(attribution));
  } catch {
    /* non-fatal */
  }
}

/** Parses the current URL into an attribution record. */
export function readFromUrl(search?: string): Attribution {
  const params = new URLSearchParams(search ?? (typeof window !== "undefined" ? window.location.search : ""));
  const get = (key: string) => clean(params.get(key));

  return {
    utmSource: get("utm_source"),
    utmMedium: get("utm_medium"),
    utmCampaign: get("utm_campaign"),
    utmContent: get("utm_content"),
    utmTerm: get("utm_term"),
    fbclid: get("fbclid"),
    gclid: get("gclid"),
    metaCampaignId: get("meta_campaign_id"),
    metaCampaignName: get("meta_campaign_name"),
    metaAdsetId: get("meta_adset_id"),
    metaAdsetName: get("meta_adset_name"),
    metaAdId: get("meta_ad_id"),
    metaAdName: get("meta_ad_name"),
    metaPlacement: get("meta_placement"),
  };
}

function hasSignal(a: Attribution): boolean {
  return Boolean(
    a.utmSource || a.utmCampaign || a.fbclid || a.gclid || a.metaCampaignId || a.metaAdId
  );
}

/**
 * Captures attribution for this visit and returns it.
 *
 * Call once per landing page mount. On a repeat visit within the same session,
 * the original click data is preserved and only the volatile cookie values
 * (`_fbp`, `_fbc`) are refreshed — the pixel writes those asynchronously, so they
 * are often absent on the very first read.
 */
export function captureAttribution(): Attribution {
  if (typeof window === "undefined") return {};

  const fromUrl = readFromUrl();
  const stored = readStored();

  // First touch wins, unless this visit carries new click data.
  const base: Attribution = hasSignal(fromUrl) ? fromUrl : (stored ?? fromUrl);

  const attribution: Attribution = {
    ...base,
    fbp: readCookie("_fbp") ?? base.fbp,
    fbc: readCookie("_fbc") ?? base.fbc,
    landingUrl: base.landingUrl ?? window.location.href,
    referrerUrl: base.referrerUrl ?? (document.referrer || undefined),
    eventId: base.eventId ?? generateEventId(),
    capturedAt: base.capturedAt ?? new Date().toISOString(),
  };

  persist(attribution);
  return attribution;
}

/** The stored attribution, refreshed against the current cookies. */
export function getAttribution(): Attribution {
  if (typeof window === "undefined") return {};
  const stored = readStored();
  if (!stored) return captureAttribution();
  const refreshed: Attribution = {
    ...stored,
    fbp: readCookie("_fbp") ?? stored.fbp,
    fbc: readCookie("_fbc") ?? stored.fbc,
  };
  persist(refreshed);
  return refreshed;
}

/** Strips empty values so the payload stays small and the server sees only real data. */
export function toSubmitPayload(attribution: Attribution): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(attribution)) {
    if (key === "capturedAt") continue;
    if (typeof value === "string" && value.trim()) out[key] = value.trim();
  }
  return out;
}
