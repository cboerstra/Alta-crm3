// Safeguards that keep a campaign from emailing anyone twice: one send loop per
// campaign, and an atomic claim on each recipient before their email goes out.

import { and, eq } from "drizzle-orm";
import type { MySql2Database } from "drizzle-orm/mysql2";
import { campaignRecipients } from "../drizzle/schema";

export interface SendJob {
  campaignId: number;
}

const jobs = new Map<number, SendJob>();

/**
 * Register a campaign's send loop, retiring any loop already registered. A
 * paused loop can be asleep between batches when the campaign is resumed; it
 * has to stay retired when it wakes, or both loops send to the same people.
 */
export function startSendJob(campaignId: number): SendJob {
  const job: SendJob = { campaignId };
  jobs.set(campaignId, job);
  return job;
}

export function isSendJobLive(job: SendJob): boolean {
  return jobs.get(job.campaignId) === job;
}

export function stopSendJob(campaignId: number): void {
  jobs.delete(campaignId);
}

/** A retired loop finishing must not unregister the loop that replaced it. */
export function finishSendJob(job: SendJob): void {
  if (jobs.get(job.campaignId) === job) jobs.delete(job.campaignId);
}

export function anySendJobActive(): boolean {
  return jobs.size > 0;
}

type Db = MySql2Database<Record<string, unknown>>;

/**
 * Take a recipient before emailing them. Only one caller can win, even across
 * two server processes during a deploy, and the send counts toward the daily
 * limit from this moment. If the server dies between this and the send, that
 * person misses the email instead of ever getting it twice.
 */
export async function claimRecipient(db: Db, recipientId: number): Promise<boolean> {
  const [result] = await db.update(campaignRecipients)
    .set({ status: "sent", sentAt: new Date() })
    .where(and(eq(campaignRecipients.id, recipientId), eq(campaignRecipients.status, "pending")));
  return (result as { affectedRows?: number }).affectedRows === 1;
}

/** Give a claim back. Only for a send the relay definitely did not accept. */
export async function releaseRecipient(db: Db, recipientId: number): Promise<void> {
  await db.update(campaignRecipients)
    .set({ status: "pending", sentAt: null })
    .where(eq(campaignRecipients.id, recipientId));
}

/** Nodemailer's codes for failing before any email was handed over. */
const NOT_SENT_CODES = new Set(["ECONNECTION", "EDNS", "EAUTH", "ETLS"]);
const OVER_LIMIT = /quota|limit|exceed|too many/i;

/**
 * "stop": the relay can't take mail right now, so nothing was delivered and
 * the rest of the list would fail too. Pause and keep the recipient pending.
 * "failed": this recipient alone. That includes timeouts after the email was
 * handed over, which may have gone out, so they are never retried.
 */
export function classifySendFailure(err: unknown): "stop" | "failed" {
  const e = (err ?? {}) as { code?: string; command?: string; responseCode?: number; response?: string };
  if (e.responseCode && e.responseCode >= 400 && e.responseCode < 500) return "stop";
  if (e.response && OVER_LIMIT.test(e.response)) return "stop";
  if (e.code && NOT_SENT_CODES.has(e.code)) return "stop";
  if (e.command === "CONN") return "stop";
  return "failed";
}
