/**
 * Email Service for Clarke & Associates CRM
 * 
 * Handles sending confirmation emails, reminders, and follow-ups.
 * Uses the notification system for owner alerts and stores email records
 * in the emailReminders table for tracking and scheduling.
 * 
 * In production, integrate with an email provider like SendGrid, Mailgun,
 * or Amazon SES by implementing the sendEmail function below.
 */

import { getDb } from "./db";
import { emailReminders, leads, integrations } from "../drizzle/schema";
import { eq, and, lte } from "drizzle-orm";
import { notifyOwner } from "./_core/notification";
import { sendEmail as sendGmailEmail } from "./email";

export type EmailPayload = {
  to: string;
  subject: string;
  body: string;
  attachmentUrl?: string;
};

/**
 * Retrieve the active Gmail integration for any admin user.
 * Returns credentials or null if not configured/enabled.
 */
async function getGmailCredentials(): Promise<{ gmailAddress: string; appPassword: string } | null> {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(integrations).where(eq(integrations.provider, "gmail")).limit(1);
  const row = rows[0];
  if (!row?.accessToken || !row.accountEmail) return null;
  const enabled = (row.metadata as { enabled?: boolean } | null)?.enabled !== false;
  if (!enabled) return null;
  return { gmailAddress: row.accountEmail, appPassword: row.accessToken };
}

/**
 * Send an email via Gmail SMTP if configured, otherwise log and notify owner.
 */
export async function sendEmail(payload: EmailPayload): Promise<boolean> {
  try {
    const creds = await getGmailCredentials();
    if (creds) {
      await sendGmailEmail(creds.gmailAddress, creds.appPassword, {
        from: `Clarke & Associates CRM <${creds.gmailAddress}>`,
        to: payload.to,
        subject: payload.subject,
        html: payload.body.includes("<") ? payload.body : `<p>${payload.body.replace(/\n/g, "<br>")}</p>`,
        attachmentUrl: payload.attachmentUrl,
      });
      console.log(`[Email] Sent via Gmail to ${payload.to}: ${payload.subject}`);
    } else {
      // No Gmail configured — log and notify owner so nothing is silently lost
      console.log(`[Email] Gmail not configured. Would send to ${payload.to}: ${payload.subject}`);
      await notifyOwner({
        title: `Email Queued (Gmail not connected): ${payload.subject}`,
        content: `To: ${payload.to}\n\n${payload.body.substring(0, 500)}${payload.attachmentUrl ? `\n\nAttachment: ${payload.attachmentUrl}` : ""}`,
      }).catch(() => {});
    }
    return true;
  } catch (error) {
    console.error("[Email] Failed to send:", error);
    return false;
  }
}

/**
 * Process pending email reminders that are due to be sent.
 * Call this on a schedule (e.g., every minute via cron).
 */
export async function processPendingReminders(): Promise<number> {
  const db = await getDb();
  if (!db) return 0;

  try {
    const now = new Date();
    // Join with leads to get the recipient email address
    const pending = await db
      .select({
        id: emailReminders.id,
        subject: emailReminders.subject,
        body: emailReminders.body,
        attachmentUrl: emailReminders.attachmentUrl,
        leadEmail: leads.email,
      })
      .from(emailReminders)
      .innerJoin(leads, eq(emailReminders.leadId, leads.id))
      .where(and(eq(emailReminders.status, "pending"), lte(emailReminders.scheduledAt, now)))
      .limit(50);

    let sent = 0;
    for (const reminder of pending) {
      if (!reminder.leadEmail) {
        await db.update(emailReminders).set({ status: "failed" }).where(eq(emailReminders.id, reminder.id));
        continue;
      }
      const success = await sendEmail({
        to: reminder.leadEmail,
        subject: reminder.subject ?? "Notification from Clarke & Associates",
        body: reminder.body ?? "",
        attachmentUrl: reminder.attachmentUrl ?? undefined,
      });

      await db.update(emailReminders)
        .set({
          status: success ? "sent" : "failed",
          sentAt: success ? new Date() : undefined,
        })
        .where(eq(emailReminders.id, reminder.id));

      if (success) sent++;
    }

    return sent;
  } catch (error) {
    console.error("[Email] Error processing reminders:", error);
    return 0;
  }
}

/**
 * Replace template placeholders in email content
 */
export function renderEmailTemplate(
  template: string,
  vars: Record<string, string>
): string {
  let result = template;
  for (const [key, value] of Object.entries(vars)) {
    result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, "g"), value);
  }
  return result;
}
