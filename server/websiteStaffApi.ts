/**
 * Read-only client for the website's staff API.
 *
 * The public site (altamortgagegroup.net) stores every submitted mortgage
 * application, the MISMO v3.4 document generated for it, and any in-progress
 * drafts. It exposes them at /api/staff/* behind a shared key. This module is
 * the only place in the CRM that holds that key or talks to those routes.
 *
 * Direction matters: the website already calls INTO this CRM with
 * WEBSITE_API_KEY (see websiteLeads.ts). This is the reverse path, and the
 * two keys are deliberately different secrets.
 *
 * Env:
 *   WEBSITE_STAFF_API_URL  e.g. https://altamortgagegroup.net/api/staff
 *   WEBSITE_STAFF_API_KEY  must match STAFF_API_KEY on the website
 *
 * Every function throws WebsiteApiError with the upstream status so the
 * tRPC layer can turn it into a precise message ("website says the database
 * is unavailable") instead of a generic failure.
 */

import type { Express, Request, Response } from "express";
import { sdk } from "./_core/sdk";

export class WebsiteApiError extends Error {
  constructor(
    public readonly status: number,
    message: string
  ) {
    super(message);
    this.name = "WebsiteApiError";
  }
}

export type DeliveryStatus = "pending" | "sent" | "failed" | "skipped";
export type MismoStatus = "pending" | "written" | "failed" | "skipped";

export interface ApplicationListItem {
  refNumber: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  loanPurpose: string;
  loanAmount: number | null;
  createdAt: string;
  mismoStatus: MismoStatus;
  crmStatus: DeliveryStatus;
  emailStatus: DeliveryStatus;
}

export interface ApplicationListPage {
  items: ApplicationListItem[];
  total: number;
  page: number;
  pageSize: number;
}

export interface SummaryRow {
  label: string;
  value: string;
}
export interface SummarySection {
  title: string;
  rows: SummaryRow[];
}

export interface ApplicationDetail extends ApplicationListItem {
  ssnLast4: string | null;
  mismoPath: string | null;
  mismoSha256: string | null;
  mismoError: string | null;
  crmResponse: string | null;
  emailError: string | null;
  /** Null when the website could not rebuild it (a row from an older schema). */
  summary: SummarySection[] | null;
  mismoFilename: string | null;
  mismoAvailable: boolean;
}

export interface DraftItem {
  id: number;
  email: string;
  firstName: string | null;
  lastName: string | null;
  furthestStep: number;
  remindersSent: number;
  lastReminderAt: string | null;
  optedOut: boolean;
  submittedRef: string | null;
  startedAt: string;
  lastActivityAt: string;
}

export interface DraftPage {
  items: DraftItem[];
  total: number;
  page: number;
}

const REF_PATTERN = /^ALT-[A-Z2-9]{5}$/;
const REQUEST_TIMEOUT_MS = 15_000;

function config(): { baseUrl: string; key: string } | null {
  const baseUrl = process.env.WEBSITE_STAFF_API_URL?.trim().replace(/\/+$/, "");
  const key = process.env.WEBSITE_STAFF_API_KEY?.trim();
  if (!baseUrl || !key) return null;
  return { baseUrl, key };
}

export function isWebsiteStaffApiConfigured(): boolean {
  return config() !== null;
}

async function request(pathname: string, query?: Record<string, string | number | undefined>): Promise<globalThis.Response> {
  const cfg = config();
  if (!cfg) {
    throw new WebsiteApiError(503, "Website connection is not configured (WEBSITE_STAFF_API_URL / WEBSITE_STAFF_API_KEY)");
  }

  const url = new URL(`${cfg.baseUrl}${pathname}`);
  for (const [k, v] of Object.entries(query ?? {})) {
    if (v !== undefined && v !== "") url.searchParams.set(k, String(v));
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(url, {
      headers: { Authorization: `Bearer ${cfg.key}`, Accept: "application/json" },
      signal: controller.signal,
    });
  } catch (err) {
    const msg = err instanceof Error && err.name === "AbortError" ? "Website did not respond in time" : `Could not reach website: ${err instanceof Error ? err.message : String(err)}`;
    throw new WebsiteApiError(502, msg);
  } finally {
    clearTimeout(timer);
  }
}

async function requestJson<T>(pathname: string, query?: Record<string, string | number | undefined>): Promise<T> {
  const res = await request(pathname, query);
  if (!res.ok) {
    let detail = "";
    try {
      const body = (await res.json()) as { error?: unknown };
      if (typeof body?.error === "string") detail = body.error;
    } catch {
      // Non-JSON error body; the status is enough.
    }
    throw new WebsiteApiError(res.status, detail || `Website answered ${res.status}`);
  }
  return (await res.json()) as T;
}

export function listApplications(input: { q?: string; page?: number }): Promise<ApplicationListPage> {
  return requestJson<ApplicationListPage>("/applications", { q: input.q, page: input.page });
}

export function getApplication(refNumber: string): Promise<ApplicationDetail> {
  const ref = refNumber.toUpperCase();
  if (!REF_PATTERN.test(ref)) throw new WebsiteApiError(404, "Not found");
  return requestJson<ApplicationDetail>(`/applications/${ref}`);
}

export function listDrafts(input: { page?: number }): Promise<DraftPage> {
  return requestJson<DraftPage>("/drafts", { page: input.page });
}

/**
 * GET /api/applications/:ref/mismo — stream the MISMO document to a signed-in
 * CRM user. Authenticated with the same session cookie tRPC uses; the
 * website key never leaves the server. Each download is logged with who took
 * it, because these are complete mortgage applications.
 */
export function registerMismoDownloadRoute(app: Express): void {
  app.get("/api/applications/:ref/mismo", async (req: Request, res: Response) => {
    let user: Awaited<ReturnType<typeof sdk.authenticateRequest>> | null = null;
    try {
      user = await sdk.authenticateRequest(req);
    } catch {
      user = null;
    }
    if (!user) {
      res.status(401).json({ error: "Sign in to download applications" });
      return;
    }

    const ref = String(req.params.ref ?? "").toUpperCase();
    if (!REF_PATTERN.test(ref)) {
      res.status(404).json({ error: "Not found" });
      return;
    }

    let upstream: globalThis.Response;
    try {
      upstream = await request(`/applications/${ref}/mismo`);
    } catch (err) {
      const status = err instanceof WebsiteApiError ? err.status : 502;
      res.status(status).json({ error: err instanceof Error ? err.message : "Download failed" });
      return;
    }

    if (!upstream.ok) {
      let detail = `Website answered ${upstream.status}`;
      try {
        const body = (await upstream.json()) as { error?: unknown };
        if (typeof body?.error === "string") detail = body.error;
      } catch {
        // keep the default
      }
      res.status(upstream.status).json({ error: detail });
      return;
    }

    const body = Buffer.from(await upstream.arrayBuffer());
    const disposition = upstream.headers.get("content-disposition") ?? `attachment; filename="${ref}.xml"`;

    console.log(`[MISMO download] ${user.email ?? user.openId} downloaded ${ref} (${body.byteLength} bytes)`);

    res
      .status(200)
      .set({
        "Content-Type": "application/xml; charset=utf-8",
        "Content-Length": String(body.byteLength),
        "Content-Disposition": disposition,
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      })
      .send(body);
  });
}
