/**
 * Meta Conversions API (server-side events).
 *
 * The browser pixel and this module report the *same* conversion. Meta
 * de-duplicates them by `event_name` + `event_id`, so the landing page mints an
 * event id, sends it with the lead, and we reuse it here. If the browser event is
 * blocked (ad blocker, iOS tracking prevention, Safari), the server event still
 * lands — which is the whole point of running both.
 *
 * All personally identifiable fields are SHA-256 hashed after normalization, per
 * Meta's matching spec. Raw PII never leaves this process.
 */

import crypto from "crypto";
import { graphRequest, MetaApiError } from "./graph";

export type CapiUserData = {
  email?: string | null;
  phone?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
  country?: string | null;
  fbc?: string | null;
  fbp?: string | null;
  clientIpAddress?: string | null;
  clientUserAgent?: string | null;
  externalId?: string | number | null;
};

export type CapiEvent = {
  eventName: string;
  eventId: string;
  eventTime?: Date;
  eventSourceUrl?: string | null;
  actionSource?: "website" | "system_generated" | "phone_call" | "chat" | "email" | "other";
  value?: number | null;
  currency?: string;
  userData: CapiUserData;
  customData?: Record<string, unknown>;
};

export type CapiConfig = {
  pixelId: string;
  accessToken: string;
  apiVersion?: string;
  testEventCode?: string | null;
};

const sha256 = (value: string) => crypto.createHash("sha256").update(value).digest("hex");

/** Meta requires lowercase, whitespace-stripped values before hashing. */
function hashNormalized(value: string | null | undefined, normalizer: (v: string) => string): string | undefined {
  if (!value) return undefined;
  const normalized = normalizer(String(value));
  if (!normalized) return undefined;
  return sha256(normalized);
}

const lower = (v: string) => v.trim().toLowerCase();
const alphaOnly = (v: string) => v.trim().toLowerCase().replace(/[^a-z]/g, "");

/**
 * Phone numbers hash as digits only, in E.164 without the leading "+".
 * A bare 10-digit US number gets the country code prepended — without it the
 * hash will not match Meta's records and the event contributes nothing.
 */
export function normalizePhone(raw: string): string {
  let digits = raw.replace(/\D/g, "");
  if (digits.length === 10) digits = `1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return digits;
  return digits;
}

export function buildUserData(user: CapiUserData): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const em = hashNormalized(user.email, lower);
  if (em) out.em = [em];
  const ph = hashNormalized(user.phone, normalizePhone);
  if (ph) out.ph = [ph];
  const fn = hashNormalized(user.firstName, alphaOnly);
  if (fn) out.fn = [fn];
  const ln = hashNormalized(user.lastName, alphaOnly);
  if (ln) out.ln = [ln];
  const ct = hashNormalized(user.city, alphaOnly);
  if (ct) out.ct = [ct];
  const st = hashNormalized(user.state, alphaOnly);
  if (st) out.st = [st];
  const zp = hashNormalized(user.zip, (v) => v.trim().toLowerCase().replace(/\s/g, "").slice(0, 5));
  if (zp) out.zp = [zp];
  const country = hashNormalized(user.country, alphaOnly);
  if (country) out.country = [country];
  if (user.externalId != null && String(user.externalId).length > 0) {
    out.external_id = [sha256(String(user.externalId))];
  }
  // Click/browser ids and request context are sent unhashed — Meta expects them raw.
  if (user.fbc) out.fbc = user.fbc;
  if (user.fbp) out.fbp = user.fbp;
  if (user.clientIpAddress) out.client_ip_address = user.clientIpAddress;
  if (user.clientUserAgent) out.client_user_agent = user.clientUserAgent;
  return out;
}

export function buildEventPayload(event: CapiEvent): Record<string, unknown> {
  const customData: Record<string, unknown> = { ...(event.customData ?? {}) };
  if (event.value != null) {
    customData.value = event.value;
    customData.currency = event.currency ?? "USD";
  }
  const payload: Record<string, unknown> = {
    event_name: event.eventName,
    event_id: event.eventId,
    event_time: Math.floor((event.eventTime ?? new Date()).getTime() / 1000),
    action_source: event.actionSource ?? "website",
    user_data: buildUserData(event.userData),
  };
  if (event.eventSourceUrl) payload.event_source_url = event.eventSourceUrl;
  if (Object.keys(customData).length > 0) payload.custom_data = customData;
  return payload;
}

export type CapiSendResult = {
  ok: boolean;
  status: number;
  eventsReceived?: number;
  fbTraceId?: string;
  error?: string;
  body?: string;
};

/** Sends one or more events to the pixel's `/events` edge. */
export async function sendConversionEvents(config: CapiConfig, events: CapiEvent[]): Promise<CapiSendResult> {
  if (events.length === 0) return { ok: true, status: 200, eventsReceived: 0 };
  if (!config.pixelId || !config.accessToken) {
    return { ok: false, status: 0, error: "Conversions API is not configured (missing pixel id or access token)" };
  }

  const body: Record<string, unknown> = { data: events.map(buildEventPayload) };
  if (config.testEventCode) body.test_event_code = config.testEventCode;

  try {
    const res = await graphRequest<{ events_received?: number; fbtrace_id?: string }>({
      path: `${config.pixelId}/events`,
      method: "POST",
      accessToken: config.accessToken,
      apiVersion: config.apiVersion,
      body,
    });
    return {
      ok: true,
      status: 200,
      eventsReceived: res?.events_received,
      fbTraceId: res?.fbtrace_id,
      body: JSON.stringify(res).slice(0, 2000),
    };
  } catch (err) {
    if (err instanceof MetaApiError) {
      return { ok: false, status: err.status, error: err.message, fbTraceId: err.fbtraceId };
    }
    return { ok: false, status: 0, error: err instanceof Error ? err.message : String(err) };
  }
}

/** Stable event id when the browser did not supply one. */
export function generateEventId(prefix = "srv"): string {
  return `${prefix}_${Date.now().toString(36)}_${crypto.randomBytes(6).toString("hex")}`;
}
