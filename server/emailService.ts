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
import { emailReminders } from "../drizzle/schema";
import { eq, and, lte, isNull } from "drizzle-orm";
import { notifyOwner } from "./_core/notification";

export type EmailPayload = {
  to: string;
  subject: string;
  body: string;
  attachmentUrl?: string;
  attachmentName?: string;
};

/**
 * Send an email. In production, replace this with your email provider's API.
 * Currently logs the email and notifies the owner.
 */
export async function sendEmail(payload: EmailPayload): Promise<boolean> {
  try {
    // Log the email for development/debugging
    console.log(`[Email] Sending to ${payload.to}: ${payload.subject}`);
    if (payload.attachmentUrl) {
      console.log(`[Email] Attachment: ${payload.attachmentUrl}`);
    }

    // Notify the owner about the email being sent (for monitoring)
    await notifyOwner({
      title: `Email Sent: ${payload.subject}`,
      content: `To: ${payload.to}\n\n${payload.body.substring(0, 500)}${payload.attachmentUrl ? `\n\nAttachment: ${payload.attachmentUrl}` : ""}`,
    }).catch(() => {});

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
    const pending = await db.select()
      .from(emailReminders)
      .where(
        and(
          eq(emailReminders.status, "pending"),
          lte(emailReminders.scheduledAt, now)
        )
      )
      .limit(50);

    let sent = 0;
    for (const reminder of pending) {
      const success = await sendEmail({
        to: "lead@example.com", // In production, join with leads table to get email
        subject: reminder.subject ?? "Notification",
        body: reminder.body ?? "",
        attachmentName: reminder.attachmentUrl ? "attachment.pdf" : undefined,
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
