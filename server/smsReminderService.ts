/**
 * SMS Reminder Service
 * Processes pending sms_reminders rows and sends them via Telnyx.
 * Runs on a 60-second interval alongside the email reminder processor.
 */
import { getPendingSmsReminders, markSmsReminderSent, markSmsReminderFailed, createSmsMessage, getDb } from "./db";
import { resolveTemplateBody } from "./emailService";
import { integrations } from "../drizzle/schema";
import { eq } from "drizzle-orm";

async function getTelnyxConfig(): Promise<{ accessToken: string; accountEmail: string } | null> {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(integrations).where(eq(integrations.provider, "twilio")).limit(1);
  const row = rows[0];
  if (!row?.accessToken || !row.accountEmail) return null;
  const enabled = (row.metadata as { enabled?: boolean } | null)?.enabled !== false;
  if (!enabled) return null;
  return { accessToken: row.accessToken, accountEmail: row.accountEmail };
}

const normalizePhone = (p: string) => {
  const digits = p.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return `+${digits}`;
};

export async function processPendingSmsReminders(): Promise<number> {
  try {
    const now = new Date();
    const pending = await getPendingSmsReminders(now);
    if (!pending || pending.length === 0) return 0;

    const config = await getTelnyxConfig();
    if (!config) return 0; // Telnyx not configured

    const fromPhone = normalizePhone(config.accountEmail);
    let sent = 0;

    for (const reminder of pending) {
      // Skip leads without phone or SMS consent
      if (!reminder.leadPhone || !reminder.smsConsent) {
        await markSmsReminderFailed(reminder.id);
        continue;
      }

      const toPhone = normalizePhone(reminder.leadPhone);

      // Resolve any remaining {{placeholders}} in the stored body
      let body = reminder.body ?? "";
      try {
        body = await resolveTemplateBody(body, reminder.leadId, reminder.webinarId);
      } catch (_) {
        // Use raw body if resolution fails
      }

      if (!body.trim()) {
        await markSmsReminderFailed(reminder.id);
        continue;
      }

      try {
        const res = await fetch("https://api.telnyx.com/v2/messages", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${config.accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ from: fromPhone, to: toPhone, text: body }),
        });

        if (res.ok) {
          await markSmsReminderSent(reminder.id);
          // Log to sms_messages so it appears in the lead's SMS inbox
          await createSmsMessage({
            leadId: reminder.leadId,
            direction: "outbound",
            body,
            status: "sent",
          });
          sent++;
        } else {
          const err = await res.json().catch(() => ({})) as { errors?: Array<{ detail?: string }> };
          const detail = err.errors?.[0]?.detail ?? `HTTP ${res.status}`;
          console.error(`[SMS Reminder] Failed to send reminder ${reminder.id}: ${detail}`);
          await markSmsReminderFailed(reminder.id);
        }
      } catch (e) {
        console.error(`[SMS Reminder] Error sending reminder ${reminder.id}:`, e);
        await markSmsReminderFailed(reminder.id);
      }
    }

    if (sent > 0) console.log(`[SMS Reminder] Sent ${sent} SMS reminder(s)`);
    return sent;
  } catch (error) {
    console.error("[SMS Reminder] Error processing pending reminders:", error);
    return 0;
  }
}
