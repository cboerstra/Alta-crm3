/**
 * Email Service for Clarke & Associates CRM
 *
 * Handles sending confirmation emails, reminders, and follow-ups.
 * Reminder emails use the active SMS/Email template body so all content
 * is managed from the Settings → SMS & Email Templates tab.
 */
import { getDb, getLeadById, getWebinarById, getWebinarSessionById, getSmsTemplate } from "./db";
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
 * Map email_reminders.type → sms_templates.trigger
 */
const REMINDER_TYPE_TO_TRIGGER: Record<string, string> = {
  registration_confirmation: "registered",
  reminder_24h: "reminder_24h",
  reminder_1h: "reminder_1h",
  reminder_10min: "reminder_1h", // closest match — use 1h template for 10-min too
  no_show_followup: "no_show",
};

/**
 * Retrieve the active Gmail integration.
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
 * Resolve {{placeholders}} in a template body using lead + webinar data.
 */
export async function resolveTemplateBody(
  body: string,
  leadId: number,
  webinarId?: number | null,
): Promise<string> {
  let result = body;

  // Lead variables
  const lead = await getLeadById(leadId).catch(() => null);
  if (lead) {
    result = result.replace(/\{\{first_name\}\}/g, lead.firstName ?? "there");
    result = result.replace(/\{\{last_name\}\}/g, lead.lastName ?? "");
    result = result.replace(/\{\{full_name\}\}/g,
      [lead.firstName, lead.lastName].filter(Boolean).join(" ") || "there");
  }

  // Webinar variables
  const wid = webinarId ?? (lead as any)?.webinarId;
  if (wid) {
    const webinar = await getWebinarById(wid).catch(() => null);
    if (webinar) {
      result = result.replace(/\{\{webinar_title\}\}/g, webinar.title ?? "");
      const joinUrl = (webinar as any).zoomJoinUrl ?? (webinar as any).replayUrl ?? "";
      result = result.replace(/\{\{webinar_link\}\}/g, joinUrl);
    }
  }

  // Session variables
  const sessionId = (lead as any)?.webinarSessionId;
  if (sessionId) {
    const session = await getWebinarSessionById(sessionId).catch(() => null);
    if (session) {
      result = result.replace(/\{\{session_date\}\}/g,
        new Date((session as any).sessionDate).toLocaleString("en-US", {
          weekday: "long", month: "long", day: "numeric", year: "numeric",
          hour: "numeric", minute: "2-digit",
        }));
      if ((session as any).zoomJoinUrl) {
        result = result.replace(/\{\{webinar_link\}\}/g, (session as any).zoomJoinUrl);
      }
    }
  }

  // Strip any remaining unresolved placeholders
  result = result.replace(/\{\{[^}]+\}\}/g, "");
  return result;
}

/**
 * Process pending email reminders that are due to be sent.
 * For each reminder, looks up the active SMS/Email template for the
 * matching trigger type and uses that body (with variable substitution)
 * instead of the hardcoded stored body.
 */
export async function processPendingReminders(): Promise<number> {
  const db = await getDb();
  if (!db) return 0;

  try {
    const now = new Date();
    const pending = await db
      .select({
        id: emailReminders.id,
        type: emailReminders.type,
        subject: emailReminders.subject,
        body: emailReminders.body,
        attachmentUrl: emailReminders.attachmentUrl,
        leadId: emailReminders.leadId,
        webinarId: emailReminders.webinarId,
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

      // ── Determine whether this reminder should be sent as an email ──
      // Only registration_confirmation is always sent via email.
      // Reminder types (24h, 1h, 10min) are SMS-only UNLESS the template has an
      // explicit emailSubject configured — in that case send via email too.
      let shouldSendEmail = reminder.type === "registration_confirmation";
      let emailBody = reminder.body ?? "";
      const emailSubject = reminder.subject ?? "Notification from Clarke & Associates";

      if (reminder.type !== "registration_confirmation") {
        const triggerKey = REMINDER_TYPE_TO_TRIGGER[reminder.type ?? ""];
        if (triggerKey) {
          try {
            const template = await getSmsTemplate(triggerKey as any);
            // Only send as email if the template has an explicit emailSubject set
            if (template && template.isActive && template.emailSubject) {
              shouldSendEmail = true;
              if (template.body) {
                const resolved = await resolveTemplateBody(
                  template.body,
                  reminder.leadId,
                  reminder.webinarId,
                );
                emailBody = `<div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.7;color:#333;max-width:600px;">${resolved.replace(/\n/g, "<br>")}</div>`;
              }
            } else {
              // No emailSubject → SMS-only reminder, mark as sent without emailing
              console.log(`[Email] Skipping email for SMS-only reminder type '${reminder.type}' (id=${reminder.id})`);
              await db.update(emailReminders)
                .set({ status: "sent", sentAt: new Date() })
                .where(eq(emailReminders.id, reminder.id));
              continue;
            }
          } catch (e) {
            console.error(`[Email] Failed to load template for trigger ${triggerKey}:`, e);
          }
        } else {
          // Unknown type — skip silently
          await db.update(emailReminders).set({ status: "sent", sentAt: new Date() }).where(eq(emailReminders.id, reminder.id));
          continue;
        }
      } else {
        // registration_confirmation: wrap stored body in clean HTML if not already HTML
        if (emailBody && !emailBody.includes("<")) {
          emailBody = `<div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.7;color:#333;max-width:600px;">${emailBody.replace(/\n/g, "<br>")}</div>`;
        }
      }

      if (!shouldSendEmail) {
        await db.update(emailReminders).set({ status: "sent", sentAt: new Date() }).where(eq(emailReminders.id, reminder.id));
        continue;
      }

      console.log(`[Email] Sending ${reminder.type} email to ${reminder.leadEmail}, attachmentUrl=${reminder.attachmentUrl ?? "none"}`);

      const success = await sendEmail({
        to: reminder.leadEmail,
        subject: emailSubject,
        body: emailBody,
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
