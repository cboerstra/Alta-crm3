/**
 * Thin wrapper around Meta's Graph API.
 *
 * Every call in the marketing engine goes through `graphRequest` so that
 * error handling, API versioning and token injection live in exactly one place.
 * Meta returns errors as HTTP 4xx with a JSON `error` envelope; we surface the
 * human-readable message rather than the raw body, because those messages
 * ("Ad account is disabled", "Invalid parameter: daily_budget too low") are what
 * an operator actually needs to see in the CRM.
 */

export const DEFAULT_GRAPH_VERSION = "v26.0";

/**
 * The version a request actually uses. `meta_settings.apiVersion` keeps whatever
 * was saved earlier (its column default is still v21.0) and the settings panel has
 * no field to change it, so a stored value older than the default is ignored.
 * Otherwise an existing row would stay pinned to a version Meta has expired.
 */
export function resolveGraphVersion(requested?: string | null): string {
  const parse = (v: string) => {
    const m = /^v(\d+)\.(\d+)$/.exec(v.trim());
    return m ? Number(m[1]) * 1000 + Number(m[2]) : null;
  };
  const wanted = requested ? parse(requested) : null;
  const floor = parse(DEFAULT_GRAPH_VERSION)!;
  return wanted !== null && wanted >= floor ? requested!.trim() : DEFAULT_GRAPH_VERSION;
}

export class MetaApiError extends Error {
  readonly status: number;
  readonly code?: number;
  readonly subcode?: number;
  readonly type?: string;
  readonly fbtraceId?: string;

  constructor(message: string, opts: { status: number; code?: number; subcode?: number; type?: string; fbtraceId?: string }) {
    super(message);
    this.name = "MetaApiError";
    this.status = opts.status;
    this.code = opts.code;
    this.subcode = opts.subcode;
    this.type = opts.type;
    this.fbtraceId = opts.fbtraceId;
  }
}

export type GraphRequestOptions = {
  /** Path after the version, e.g. "act_123/campaigns" — no leading slash. */
  path: string;
  method?: "GET" | "POST" | "DELETE";
  accessToken: string;
  apiVersion?: string;
  /** Query string parameters (GET) */
  query?: Record<string, string | number | undefined>;
  /** JSON body (POST) */
  body?: Record<string, unknown>;
  timeoutMs?: number;
};

export async function graphRequest<T = any>(opts: GraphRequestOptions): Promise<T> {
  const version = resolveGraphVersion(opts.apiVersion);
  const url = new URL(`https://graph.facebook.com/${version}/${opts.path}`);
  for (const [key, value] of Object.entries(opts.query ?? {})) {
    if (value !== undefined && value !== null && value !== "") url.searchParams.set(key, String(value));
  }

  const method = opts.method ?? "GET";
  const headers: Record<string, string> = {
    Authorization: `Bearer ${opts.accessToken}`,
  };
  let body: string | undefined;
  if (method === "POST" && opts.body) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(opts.body);
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? 20_000);

  let res: Response;
  try {
    res = await fetch(url.toString(), { method, headers, body, signal: controller.signal });
  } catch (err) {
    clearTimeout(timer);
    const msg = err instanceof Error && err.name === "AbortError"
      ? "Meta API request timed out"
      : `Meta API request failed: ${err instanceof Error ? err.message : String(err)}`;
    throw new MetaApiError(msg, { status: 0 });
  }
  clearTimeout(timer);

  const text = await res.text();
  let json: any = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    /* non-JSON response — fall through and report the raw text */
  }

  if (!res.ok) {
    const e = json?.error;
    throw new MetaApiError(e?.error_user_msg || e?.message || text || `Meta API error ${res.status}`, {
      status: res.status,
      code: e?.code,
      subcode: e?.error_subcode,
      type: e?.type,
      fbtraceId: e?.fbtrace_id,
    });
  }

  return json as T;
}

/** Redacts a token down to a display hint, e.g. "****a1b2". */
export function tokenHint(token?: string | null): string {
  if (!token) return "";
  return `****${token.slice(-4)}`;
}
