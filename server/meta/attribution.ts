/**
 * Attribution capture.
 *
 * The browser collects click parameters (utm_*, fbclid) plus Meta's own first-party
 * cookies (_fbp, _fbc) and posts them alongside the lead. This module normalizes
 * that payload into the columns stored on the lead record.
 *
 * `fbc` is the click identifier Meta wants on Conversions API calls. When the
 * browser cookie is missing — common on the very first visit, because the pixel
 * sets `_fbc` asynchronously — we rebuild it from `fbclid` using Meta's documented
 * format: `fb.<subdomain-index>.<creation-timestamp-ms>.<fbclid>`.
 */

import { z } from "zod";

export const attributionInputSchema = z.object({
  utmSource: z.string().max(128).optional(),
  utmMedium: z.string().max(128).optional(),
  utmCampaign: z.string().max(128).optional(),
  utmContent: z.string().max(128).optional(),
  utmTerm: z.string().max(128).optional(),
  fbclid: z.string().max(512).optional(),
  fbc: z.string().max(512).optional(),
  fbp: z.string().max(128).optional(),
  gclid: z.string().max(512).optional(),
  // Meta macro substitutions ({{campaign.id}} etc.) appended to the destination URL
  metaCampaignId: z.string().max(64).optional(),
  metaCampaignName: z.string().max(256).optional(),
  metaAdsetId: z.string().max(64).optional(),
  metaAdsetName: z.string().max(256).optional(),
  metaAdId: z.string().max(64).optional(),
  metaAdName: z.string().max(256).optional(),
  metaPlacement: z.string().max(128).optional(),
  landingUrl: z.string().max(2048).optional(),
  referrerUrl: z.string().max(2048).optional(),
  /** Client-generated event id, shared with the browser pixel so Meta de-duplicates. */
  eventId: z.string().max(128).optional(),
});

export type AttributionInput = z.infer<typeof attributionInputSchema>;

export type NormalizedAttribution = {
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
  clientIpAddress?: string;
  clientUserAgent?: string;
  attributionCapturedAt: Date;
};

/** Meta's macro placeholders arrive literally when a macro isn't substituted. */
function clean(value?: string | null): string | undefined {
  if (value == null) return undefined;
  const trimmed = String(value).trim();
  if (!trimmed) return undefined;
  if (/^\{\{.*\}\}$/.test(trimmed)) return undefined; // unsubstituted macro
  if (trimmed.toLowerCase() === "undefined" || trimmed.toLowerCase() === "null") return undefined;
  return trimmed;
}

function truncate(value: string | undefined, max: number): string | undefined {
  if (value === undefined) return undefined;
  return value.length > max ? value.slice(0, max) : value;
}

/**
 * Builds Meta's `fbc` value from a raw fbclid.
 * Format: fb.<subdomainIndex>.<timestampMs>.<fbclid>
 * We always use subdomain index 1 (the value Meta's own pixel writes for
 * `example.com` style domains) and the capture time as the creation timestamp.
 */
export function buildFbc(fbclid: string, capturedAt: Date = new Date()): string {
  return `fb.1.${capturedAt.getTime()}.${fbclid}`;
}

export function normalizeAttribution(
  input: AttributionInput | undefined,
  context?: { ip?: string | null; userAgent?: string | null }
): NormalizedAttribution {
  const capturedAt = new Date();
  const a = input ?? {};

  const fbclid = clean(a.fbclid);
  let fbc = clean(a.fbc);
  if (!fbc && fbclid) fbc = buildFbc(fbclid, capturedAt);

  return {
    utmSource: truncate(clean(a.utmSource), 128),
    utmMedium: truncate(clean(a.utmMedium), 128),
    utmCampaign: truncate(clean(a.utmCampaign), 128),
    utmContent: truncate(clean(a.utmContent), 128),
    utmTerm: truncate(clean(a.utmTerm), 128),
    fbclid: truncate(fbclid, 512),
    fbc: truncate(fbc, 512),
    fbp: truncate(clean(a.fbp), 128),
    gclid: truncate(clean(a.gclid), 512),
    metaCampaignId: truncate(clean(a.metaCampaignId), 64),
    metaCampaignName: truncate(clean(a.metaCampaignName), 256),
    metaAdsetId: truncate(clean(a.metaAdsetId), 64),
    metaAdsetName: truncate(clean(a.metaAdsetName), 256),
    metaAdId: truncate(clean(a.metaAdId), 64),
    metaAdName: truncate(clean(a.metaAdName), 256),
    metaPlacement: truncate(clean(a.metaPlacement), 128),
    landingUrl: truncate(clean(a.landingUrl), 2048),
    referrerUrl: truncate(clean(a.referrerUrl), 2048),
    clientIpAddress: truncate(clean(context?.ip ?? undefined), 64),
    clientUserAgent: truncate(clean(context?.userAgent ?? undefined), 1024),
    attributionCapturedAt: capturedAt,
  };
}

/**
 * Reads the caller's IP from the request, honouring the proxy headers used by
 * the hosts this CRM runs behind (Hostinger, Railway, CloudFront).
 */
export function clientIpFromRequest(req: {
  headers: Record<string, string | string[] | undefined>;
  socket?: { remoteAddress?: string };
  ip?: string;
}): string | undefined {
  const header = (name: string) => {
    const raw = req.headers[name];
    if (!raw) return undefined;
    const value = Array.isArray(raw) ? raw[0] : raw;
    return value.split(",")[0]?.trim() || undefined;
  };
  return (
    header("cf-connecting-ip") ??
    header("x-real-ip") ??
    header("x-forwarded-for") ??
    req.ip ??
    req.socket?.remoteAddress ??
    undefined
  );
}

/**
 * Human-readable one-liner for the activity feed, e.g.
 * "facebook / paid_social · Weber County Grant · ad 120210…".
 */
export function describeAttribution(a: NormalizedAttribution): string {
  const parts: string[] = [];
  if (a.utmSource || a.utmMedium) parts.push(`${a.utmSource ?? "direct"} / ${a.utmMedium ?? "none"}`);
  if (a.utmCampaign) parts.push(a.utmCampaign);
  if (a.metaAdName) parts.push(`ad: ${a.metaAdName}`);
  else if (a.metaAdId) parts.push(`ad: ${a.metaAdId}`);
  if (a.metaPlacement) parts.push(a.metaPlacement);
  return parts.length ? parts.join(" · ") : "direct / none";
}
