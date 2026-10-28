// The bulk email sender: an SMTP relay such as Brevo that real-estate
// campaigns go out through, from the brokerage's own domain, instead of
// Gmail. Relays cap sends per day (Brevo's free plan: 300), so campaigns pace
// themselves against `dailyLimit` over a rolling 24 hours.

import nodemailer, { type Transporter } from "nodemailer";
import { and, eq, gte, inArray, isNotNull, sql } from "drizzle-orm";
import { getDb } from "./db";
import { bulkEmailSettings, campaignRecipients, emailCampaigns, type BulkEmailSettings } from "../drizzle/schema";

/** Audiences mailed by the real-estate side, and so through the bulk sender. */
export const BULK_AUDIENCES = ["re_agent", "prospective_re_client"] as const;

export function usesBulkSender(audience: string): boolean {
  return (BULK_AUDIENCES as readonly string[]).includes(audience);
}

export async function getBulkEmailSettings(): Promise<BulkEmailSettings | null> {
  const db = await getDb();
  if (!db) return null;
  const [row] = await db.select().from(bulkEmailSettings).limit(1);
  return row ?? null;
}

export interface BulkSender {
  transporter: Transporter;
  fromEmail: string;
  fromName: string | null;
  replyTo?: string;
  dailyLimit: number;
}

/** Ready to send: switched on and fully filled in. */
export function isUsable(s: BulkEmailSettings | null): s is BulkEmailSettings & {
  host: string; username: string; password: string; fromEmail: string;
} {
  return !!(s && s.enabled && s.host && s.username && s.password && s.fromEmail);
}

export function createBulkTransport(s: { host: string; port: number; username: string; password: string }): Transporter {
  return nodemailer.createTransport({
    host: s.host,
    port: s.port,
    // 465 is implicit TLS; 587 and 2525 upgrade with STARTTLS.
    secure: s.port === 465,
    requireTLS: s.port !== 465,
    auth: { user: s.username, pass: s.password },
    // One connection, reused for the whole batch.
    pool: true,
    maxConnections: 1,
    // nodemailer waits up to 10 minutes on a silent server by default, which
    // would hang the Settings screen and a campaign batch.
    connectionTimeout: 20_000,
    greetingTimeout: 20_000,
    socketTimeout: 60_000,
  });
}

/** The configured sender, or null when bulk email is off or incomplete. */
export async function getBulkSender(): Promise<BulkSender | null> {
  const s = await getBulkEmailSettings();
  if (!isUsable(s)) return null;
  return {
    transporter: createBulkTransport(s),
    fromEmail: s.fromEmail,
    fromName: s.fromName,
    replyTo: s.replyTo || undefined,
    dailyLimit: s.dailyLimit,
  };
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Campaign emails sent through the bulk sender in the last 24 hours, and when
 * the oldest of them falls out of the window. A rolling window keeps every
 * calendar day under the limit too, whenever the relay resets its count.
 */
export async function bulkUsage(now = new Date()): Promise<{ sent: number; oldestSentAt: Date | null }> {
  const db = await getDb();
  const since = new Date(now.getTime() - DAY_MS);
  const [row] = await db
    .select({ sent: sql<number>`count(*)`, oldest: sql<Date | null>`min(${campaignRecipients.sentAt})` })
    .from(campaignRecipients)
    .innerJoin(emailCampaigns, eq(campaignRecipients.campaignId, emailCampaigns.id))
    .where(and(
      isNotNull(campaignRecipients.sentAt),
      gte(campaignRecipients.sentAt, since),
      inArray(emailCampaigns.audience, [...BULK_AUDIENCES]),
    ));
  const oldest = row?.oldest ? new Date(row.oldest) : null;
  return { sent: Number(row?.sent ?? 0), oldestSentAt: oldest };
}

/** How many may go now, and if none, when the next one may. */
export function remainingToday(
  usage: { sent: number; oldestSentAt: Date | null },
  dailyLimit: number,
  now = new Date(),
): { remaining: number; nextSlotAt: Date | null } {
  const remaining = Math.max(0, dailyLimit - usage.sent);
  if (remaining > 0) return { remaining, nextSlotAt: null };
  const next = usage.oldestSentAt ? new Date(usage.oldestSentAt.getTime() + DAY_MS + 60_000) : new Date(now.getTime() + 60 * 60_000);
  return { remaining, nextSlotAt: next };
}

/**
 * When `pending` more emails will have gone out, sending `dailyLimit` a day.
 * Approximate: assumes each day's allowance is used as soon as it frees up.
 */
export function estimateFinish(pending: number, dailyLimit: number, remainingNow: number, now = new Date()): Date | null {
  if (pending <= 0) return null;
  if (pending <= remainingNow) return now;
  const days = Math.ceil((pending - remainingNow) / Math.max(1, dailyLimit));
  return new Date(now.getTime() + days * DAY_MS);
}
