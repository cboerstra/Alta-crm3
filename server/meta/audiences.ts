/**
 * Custom Audiences: who a retargeting ad set shows to, or leaves out.
 *
 * Two kinds:
 *  - website: built by Meta from the pixel, e.g. "visited a landing page in the
 *    last 30 days and did not submit the form". Meta keeps it current itself.
 *  - crm_list: CRM contacts uploaded as SHA-256 hashes (Meta never receives an
 *    email or phone number in the clear). Replaced in full on every sync, so
 *    someone who left the list in the CRM leaves it in Meta too.
 *
 * Housing ads may use both, but not lookalikes, which Meta disallows under the
 * HOUSING special ad category.
 */

import crypto from "crypto";
import { graphRequest } from "./graph";
import { normalizeAdAccountId, type MetaCredentials } from "./marketingApi";
import { normalizePhone } from "./conversionsApi";

export type WebsiteAudienceDefinition = {
  kind: "website";
  /** Look-back window, 1–180 days (Meta's maximum). */
  days: number;
  /** Only visitors of this landing page; all landing pages when absent. */
  landingPageSlug?: string | null;
  /** Leave out anyone the pixel saw submit a lead form in the same window. */
  excludeConverters: boolean;
};

export type CrmListSource = "leads" | "agents" | "past_clients";

export type CrmListAudienceDefinition = {
  kind: "crm_list";
  source: CrmListSource;
  /** Leads only: pipeline stages to include; all stages when empty. */
  stages?: string[];
  /** Agents and past clients only: contacts carrying this tag; everyone when absent. */
  tag?: string | null;
};

export type AudienceDefinition = WebsiteAudienceDefinition | CrmListAudienceDefinition;

const DAY_SECONDS = 24 * 60 * 60;
const MAX_RETENTION_DAYS = 180;

/**
 * Meta's rule for a pixel-based audience. Landing pages are served at /lp/<slug>,
 * so "visited a landing page" is a URL filter on /lp/. Converters are excluded by
 * the Lead event the landing pages already send.
 */
export function buildWebsiteRule(pixelId: string, def: WebsiteAudienceDefinition): Record<string, unknown> {
  const retention = Math.min(Math.max(Math.round(def.days), 1), MAX_RETENTION_DAYS) * DAY_SECONDS;
  const eventSources = [{ id: pixelId, type: "pixel" }];
  const path = def.landingPageSlug ? `/lp/${def.landingPageSlug}` : "/lp/";
  const rule: Record<string, unknown> = {
    inclusions: {
      operator: "or",
      rules: [{
        event_sources: eventSources,
        retention_seconds: retention,
        filter: { operator: "and", filters: [{ field: "url", operator: "i_contains", value: path }] },
      }],
    },
  };
  if (def.excludeConverters) {
    rule.exclusions = {
      operator: "or",
      rules: [{
        event_sources: eventSources,
        retention_seconds: retention,
        filter: { operator: "and", filters: [{ field: "event", operator: "eq", value: "Lead" }] },
      }],
    };
  }
  return rule;
}

// ─── Customer-list hashing ────────────────────────────────────────────────────

export const CUSTOMER_LIST_SCHEMA = ["EMAIL", "PHONE", "FN", "LN"] as const;

const sha256 = (v: string) => crypto.createHash("sha256").update(v).digest("hex");
const hashOrEmpty = (v: string) => (v ? sha256(v) : "");

export type ListMember = { email?: string | null; phone?: string | null; firstName?: string | null; lastName?: string | null };

/**
 * One customer-list row in CUSTOMER_LIST_SCHEMA order, normalized the way Meta
 * requires before hashing. Null when the contact has neither email nor phone,
 * since a name alone matches nobody.
 */
export function hashMember(m: ListMember): string[] | null {
  const email = (m.email ?? "").trim().toLowerCase();
  const phone = m.phone ? normalizePhone(m.phone) : "";
  if (!email.includes("@") && phone.length < 10) return null;
  const name = (v?: string | null) => (v ?? "").trim().toLowerCase().replace(/[^a-z]/g, "");
  return [
    email.includes("@") ? sha256(email) : "",
    phone.length >= 10 ? sha256(phone) : "",
    hashOrEmpty(name(m.firstName)),
    hashOrEmpty(name(m.lastName)),
  ];
}

/** Hashed rows, de-duplicated so one person isn't counted twice. */
export function hashMembers(members: ListMember[]): string[][] {
  const seen = new Set<string>();
  const rows: string[][] = [];
  for (const m of members) {
    const row = hashMember(m);
    if (!row) continue;
    const key = row[0] || row[1];
    if (seen.has(key)) continue;
    seen.add(key);
    rows.push(row);
  }
  return rows;
}

// ─── Graph API calls ──────────────────────────────────────────────────────────

export async function createWebsiteAudience(
  creds: MetaCredentials,
  input: { name: string; description?: string; pixelId: string; definition: WebsiteAudienceDefinition }
): Promise<{ id: string }> {
  return graphRequest<{ id: string }>({
    path: `${normalizeAdAccountId(creds.adAccountId)}/customaudiences`,
    method: "POST",
    accessToken: creds.accessToken,
    apiVersion: creds.apiVersion,
    body: {
      name: input.name,
      description: input.description,
      rule: JSON.stringify(buildWebsiteRule(input.pixelId, input.definition)),
      // Include visits from before the audience existed, as far back as the window.
      prefill: true,
    },
  });
}

export async function createCustomerListAudience(
  creds: MetaCredentials,
  input: { name: string; description?: string }
): Promise<{ id: string }> {
  return graphRequest<{ id: string }>({
    path: `${normalizeAdAccountId(creds.adAccountId)}/customaudiences`,
    method: "POST",
    accessToken: creds.accessToken,
    apiVersion: creds.apiVersion,
    body: {
      name: input.name,
      description: input.description,
      subtype: "CUSTOM",
      customer_file_source: "USER_PROVIDED_ONLY",
    },
  });
}

const BATCH = 10_000; // Meta's limit per request.

/**
 * Replace a customer list's members with `rows`, in batches of one replace
 * session, so the audience is never briefly empty or half old, half new.
 */
export async function replaceAudienceMembers(creds: MetaCredentials, audienceId: string, rows: string[][]): Promise<number> {
  const sessionId = Number(String(Date.now()).slice(-9) + String(Math.floor(Math.random() * 1000)).padStart(3, "0"));
  const batches = Math.max(1, Math.ceil(rows.length / BATCH));
  let received = 0;
  for (let i = 0; i < batches; i++) {
    const chunk = rows.slice(i * BATCH, (i + 1) * BATCH);
    const result = await graphRequest<{ num_received?: number }>({
      path: `${audienceId}/usersreplace`,
      method: "POST",
      accessToken: creds.accessToken,
      apiVersion: creds.apiVersion,
      timeoutMs: 60_000,
      body: {
        payload: { schema: CUSTOMER_LIST_SCHEMA, data: chunk },
        session: {
          session_id: sessionId,
          batch_seq: i + 1,
          last_batch_flag: i === batches - 1,
          estimated_num_total: rows.length,
        },
      },
    });
    received += result.num_received ?? chunk.length;
  }
  return received;
}

export type AudienceInfo = {
  approximate_count_lower_bound?: number;
  approximate_count_upper_bound?: number;
  delivery_status?: { code?: number; description?: string };
  operation_status?: { code?: number; description?: string };
};

export async function getAudienceInfo(creds: MetaCredentials, audienceId: string): Promise<AudienceInfo> {
  return graphRequest<AudienceInfo>({
    path: audienceId,
    accessToken: creds.accessToken,
    apiVersion: creds.apiVersion,
    query: { fields: "approximate_count_lower_bound,approximate_count_upper_bound,delivery_status,operation_status" },
  });
}

export async function deleteAudience(creds: MetaCredentials, audienceId: string): Promise<void> {
  await graphRequest({ path: audienceId, method: "DELETE", accessToken: creds.accessToken, apiVersion: creds.apiVersion });
}
