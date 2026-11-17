// The websites landing pages are served on. Cached briefly because the
// cross-origin check runs on every API request.

import { getDb } from "./db";
import { websites, type Website } from "../drizzle/schema";

export const CRM_SITE_KEY = "altamortgagecrm";

let cache: { at: number; rows: Website[] } | null = null;
const TTL_MS = 60_000;

export async function listWebsites(fresh = false): Promise<Website[]> {
  if (!fresh && cache && Date.now() - cache.at < TTL_MS) return cache.rows;
  const db = await getDb();
  const rows = db ? await db.select().from(websites) : [];
  cache = { at: Date.now(), rows };
  return rows;
}

export function clearWebsiteCache() {
  cache = null;
}

/** "https://www.Example.com/path" → "https://www.example.com"; null when it isn't an https address. */
export function normalizeSiteUrl(input: string): string | null {
  let raw = input.trim();
  if (!/^[a-z]+:\/\//i.test(raw)) raw = "https://" + raw;
  try {
    const u = new URL(raw);
    if (u.protocol !== "https:" || !u.hostname.includes(".")) return null;
    return `https://${u.hostname.toLowerCase()}${u.port ? `:${u.port}` : ""}`;
  } catch {
    return null;
  }
}

/** A stable key from the domain: "https://www.my-homes.com" → "myhomescom". */
export function siteKeyFor(baseUrl: string): string {
  return new URL(baseUrl).hostname.replace(/^www\./, "").replace(/[^a-z0-9]/g, "").slice(0, 64);
}

/** Base URL for a landing page's host site; the CRM's own address when unknown. */
export async function siteBaseUrl(siteKey: string | null | undefined, crmBaseUrl: string): Promise<string> {
  if (!siteKey || siteKey === CRM_SITE_KEY) return crmBaseUrl;
  const site = (await listWebsites()).find((w) => w.siteKey === siteKey);
  return site?.baseUrl ?? crmBaseUrl;
}

/** Whether a browser origin is one of our websites (and so may call the CRM API cross-site). */
export async function isWebsiteOrigin(origin: string): Promise<boolean> {
  const sites = await listWebsites();
  const o = origin.toLowerCase();
  return sites.some((w) => {
    const base = w.baseUrl.toLowerCase();
    const host = new URL(base).hostname;
    return o === base || o === `https://www.${host.replace(/^www\./, "")}` || o === `https://${host.replace(/^www\./, "")}`;
  });
}
