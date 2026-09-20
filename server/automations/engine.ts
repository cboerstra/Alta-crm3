/**
 * Automation sequence engine.
 *
 * A sequence is an ordered list of steps (email, SMS, call task, wait, stage
 * change). Enrolling a lead creates an enrollment row pointing at step 1 with a
 * `nextRunAt`; a scheduler tick then walks the enrollment forward one step at a
 * time. State lives entirely in the database, so a restart mid-sequence resumes
 * exactly where it left off rather than replaying or dropping steps.
 *
 * Steps run at most once per enrollment: the enrollment's `currentStepOrder` is
 * advanced in the same pass that executes the step, and a failed step is logged
 * and skipped rather than retried forever — a permanently bad email address must
 * not wedge the rest of the nurture track.
 */

import {
  getSequenceById,
  getSequenceSteps,
  createEnrollment,
  findActiveEnrollment,
  updateEnrollment,
  getDueEnrollments,
  logStepRun,
  createTask,
  getSequences,
} from "../marketingDb";
import {
  getLeadById,
  updateLead,
  updateLeadStage,
  logActivity,
  createSmsMessage,
  getAnyTelnyxConfig,
} from "../db";
import type { AutomationStep } from "../../drizzle/schema";

// ─── Placeholder resolution ──────────────────────────────────────────────────

export type LeadLike = {
  id: number;
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  phone?: string | null;
  utmCampaign?: string | null;
};

/**
 * Resolves the `{{placeholder}}` tokens used across templates. Supports both the
 * camelCase and snake_case spellings already in use elsewhere in the CRM, then
 * strips anything left unresolved so leads never receive a raw `{{token}}`.
 */
export function resolvePlaceholders(
  template: string,
  lead: LeadLike,
  extra?: Record<string, string | undefined>
): string {
  const fullName = [lead.firstName, lead.lastName].filter(Boolean).join(" ") || "there";
  const map: Record<string, string> = {
    firstName: lead.firstName ?? "there",
    first_name: lead.firstName ?? "there",
    lastName: lead.lastName ?? "",
    last_name: lead.lastName ?? "",
    fullName,
    full_name: fullName,
    email: lead.email ?? "",
    phone: lead.phone ?? "",
    campaign: lead.utmCampaign ?? "",
    ...Object.fromEntries(Object.entries(extra ?? {}).map(([k, v]) => [k, v ?? ""])),
  };
  let out = template;
  for (const [key, value] of Object.entries(map)) {
    out = out.replace(new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, "g"), value);
  }
  return out.replace(/\{\{[^}]*\}\}/g, "");
}

// ─── Enrollment ──────────────────────────────────────────────────────────────

export type EnrollResult =
  | { enrolled: true; enrollmentId: number }
  | { enrolled: false; reason: string };

/**
 * Puts a lead into a sequence. Re-enrolling a lead that is already active in the
 * same sequence is a no-op — a lead who fills out two forms from one campaign
 * should not get every text twice.
 */
export async function enrollLead(
  sequenceId: number,
  leadId: number,
  opts?: { campaignId?: number | null; force?: boolean }
): Promise<EnrollResult> {
  const sequence = await getSequenceById(sequenceId);
  if (!sequence) return { enrolled: false, reason: "Sequence not found" };
  if (!sequence.isActive && !opts?.force) return { enrolled: false, reason: "Sequence is inactive" };

  if (!opts?.force) {
    const existing = await findActiveEnrollment(sequenceId, leadId);
    if (existing) return { enrolled: false, reason: "Lead is already enrolled" };
  }

  const steps = await getSequenceSteps(sequenceId);
  const activeSteps = steps.filter((s) => s.isActive);
  if (activeSteps.length === 0) return { enrolled: false, reason: "Sequence has no steps" };

  const first = activeSteps[0];
  const nextRunAt = new Date(Date.now() + (first.delayMinutes ?? 0) * 60_000);

  const enrollmentId = await createEnrollment({
    sequenceId,
    leadId,
    campaignId: opts?.campaignId ?? null,
    status: "active",
    currentStepOrder: 0,
    nextRunAt,
  });

  await logActivity({
    leadId,
    type: "system",
    title: `Enrolled in automation: ${sequence.name}`,
    content: `${activeSteps.length} step${activeSteps.length === 1 ? "" : "s"}; first step runs ${nextRunAt.toLocaleString("en-US")}`,
    metadata: { sequenceId, enrollmentId },
  });

  return { enrolled: true, enrollmentId };
}

/**
 * Enrolls a lead into every active sequence matching a trigger.
 * `campaign_lead` sequences are handled by the campaign wiring instead, so they
 * are deliberately excluded here to avoid double-enrollment.
 */
export async function runTrigger(
  triggerType: "lead_created" | "stage_change",
  leadId: number,
  triggerValue?: string
): Promise<number> {
  const sequences = await getSequences();
  let count = 0;
  for (const seq of sequences) {
    if (!seq.isActive) continue;
    if (seq.triggerType !== triggerType) continue;
    if (triggerType === "stage_change" && seq.triggerValue && seq.triggerValue !== triggerValue) continue;
    const result = await enrollLead(seq.id, leadId);
    if (result.enrolled) count += 1;
  }
  return count;
}

export async function cancelEnrollment(enrollmentId: number, reason?: string): Promise<void> {
  await updateEnrollment(enrollmentId, {
    status: "cancelled",
    completedAt: new Date(),
    lastError: reason ?? null,
  });
}

// ─── Step execution ──────────────────────────────────────────────────────────

/** Sends a one-off SMS through Telnyx, honouring the lead's consent flag. */
async function sendAdHocSms(leadId: number, body: string): Promise<{ ok: boolean; detail: string }> {
  const lead = await getLeadById(leadId);
  if (!lead?.phone) return { ok: false, detail: "Lead has no phone number" };
  // 10DLC compliance: never text a lead who has not opted in.
  if (!lead.smsConsent) return { ok: false, detail: "Lead has not consented to SMS" };

  const config = await getAnyTelnyxConfig();
  if (!config?.accessToken || !config.accountEmail) return { ok: false, detail: "SMS is not configured" };
  if ((config.metadata as { enabled?: boolean } | null)?.enabled === false) {
    return { ok: false, detail: "SMS sending is disabled" };
  }

  const normalize = (p: string) => {
    const clean = p.trim().replace(/[\s\-().]/g, "");
    return clean.startsWith("+") ? clean : `+1${clean}`;
  };

  const res = await fetch("https://api.telnyx.com/v2/messages", {
    method: "POST",
    headers: { Authorization: `Bearer ${config.accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: normalize(config.accountEmail), to: normalize(lead.phone), text: body }),
  });

  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { errors?: Array<{ detail?: string }> };
    return { ok: false, detail: err.errors?.[0]?.detail ?? `Telnyx returned ${res.status}` };
  }

  await createSmsMessage({ leadId, direction: "outbound", body, status: "sent" });
  await logActivity({ leadId, type: "sms_sent", title: "Automation SMS sent", content: body });
  return { ok: true, detail: body.slice(0, 200) };
}

async function sendAdHocEmail(leadId: number, subject: string, body: string): Promise<{ ok: boolean; detail: string }> {
  const lead = await getLeadById(leadId);
  if (!lead?.email) return { ok: false, detail: "Lead has no email address" };
  const { sendEmail } = await import("../emailService");
  const html = body.includes("<") ? body : `<p>${body.replace(/\n/g, "<br>")}</p>`;
  const sent = await sendEmail({ to: lead.email, subject, body: html });
  if (!sent) return { ok: false, detail: "Email delivery failed" };
  await logActivity({ leadId, type: "email_sent", title: `Automation email sent: ${subject}`, content: body });
  return { ok: true, detail: subject };
}

/** Executes a single step against a lead. Never throws — failures are reported. */
export async function executeStep(
  step: AutomationStep,
  leadId: number,
  campaignId?: number | null
): Promise<{ status: "sent" | "skipped" | "failed"; detail: string }> {
  const lead = await getLeadById(leadId);
  if (!lead) return { status: "failed", detail: "Lead no longer exists" };

  const ctx = { campaign: undefined as string | undefined };

  try {
    switch (step.type) {
      case "wait":
        return { status: "sent", detail: `Waited ${step.delayMinutes} minute(s)` };

      case "email": {
        if (!step.body) return { status: "skipped", detail: "Step has no email body" };
        const subject = resolvePlaceholders(step.subject ?? "A quick note from Alta Mortgage", lead, ctx);
        const body = resolvePlaceholders(step.body, lead, ctx);
        const r = await sendAdHocEmail(leadId, subject, body);
        return { status: r.ok ? "sent" : "failed", detail: r.detail };
      }

      case "sms": {
        if (!step.body) return { status: "skipped", detail: "Step has no SMS body" };
        const body = resolvePlaceholders(step.body, lead, ctx);
        const r = await sendAdHocSms(leadId, body);
        // A missing phone or withheld consent is an expected outcome, not a fault.
        return { status: r.ok ? "sent" : "skipped", detail: r.detail };
      }

      case "call_task": {
        const title = resolvePlaceholders(
          step.taskTitle || `Call ${lead.firstName ?? ""} ${lead.lastName ?? ""}`.trim(),
          lead,
          ctx
        );
        const notes = step.taskNotes ? resolvePlaceholders(step.taskNotes, lead, ctx) : undefined;
        await createTask({
          leadId,
          campaignId: campaignId ?? null,
          assignedTo: step.assignTo ?? lead.assignedTo ?? null,
          title,
          notes,
          type: "call",
          dueAt: new Date(),
          status: "open",
          source: "automation",
        });
        await logActivity({ leadId, type: "system", title: `Call task created: ${title}`, content: notes });
        return { status: "sent", detail: title };
      }

      case "stage_change": {
        if (!step.targetStage) return { status: "skipped", detail: "Step has no target stage" };
        await updateLeadStage(leadId, step.targetStage as any);
        await logActivity({
          leadId,
          type: "stage_change",
          title: `Stage changed to ${step.targetStage.replace(/_/g, " ")} by automation`,
        });
        return { status: "sent", detail: step.targetStage };
      }

      case "notify_owner": {
        const { notifyOwner } = await import("../_core/notification");
        const content = resolvePlaceholders(
          step.body || `${lead.firstName} ${lead.lastName} reached a step in an automation.`,
          lead,
          ctx
        );
        await notifyOwner({ title: step.subject || "Automation alert", content });
        return { status: "sent", detail: content.slice(0, 200) };
      }

      default:
        return { status: "skipped", detail: `Unknown step type: ${String(step.type)}` };
    }
  } catch (err) {
    return { status: "failed", detail: err instanceof Error ? err.message : String(err) };
  }
}

// ─── Scheduler ───────────────────────────────────────────────────────────────

/**
 * Advances every enrollment whose next step is due. Called on a timer from the
 * server entry point, alongside the existing email and SMS reminder schedulers.
 * Returns the number of steps executed so the caller can log a heartbeat.
 */
export async function processDueEnrollments(limit = 50): Promise<number> {
  const due = await getDueEnrollments(limit);
  if (due.length === 0) return 0;

  let executed = 0;

  for (const enrollment of due) {
    try {
      const steps = (await getSequenceSteps(enrollment.sequenceId)).filter((s) => s.isActive);
      const index = enrollment.currentStepOrder ?? 0;
      const step = steps[index];

      // Ran off the end of the sequence — the lead has completed the track.
      if (!step) {
        await updateEnrollment(enrollment.id, {
          status: "completed",
          completedAt: new Date(),
          nextRunAt: null,
        });
        continue;
      }

      const result = await executeStep(step, enrollment.leadId, enrollment.campaignId);
      await logStepRun({
        enrollmentId: enrollment.id,
        stepId: step.id,
        leadId: enrollment.leadId,
        status: result.status,
        detail: result.detail,
      });
      executed += 1;

      const nextIndex = index + 1;
      const nextStep = steps[nextIndex];
      if (!nextStep) {
        await updateEnrollment(enrollment.id, {
          status: "completed",
          completedAt: new Date(),
          currentStepOrder: nextIndex,
          nextRunAt: null,
          lastError: result.status === "failed" ? result.detail : null,
        });
      } else {
        await updateEnrollment(enrollment.id, {
          currentStepOrder: nextIndex,
          nextRunAt: new Date(Date.now() + (nextStep.delayMinutes ?? 0) * 60_000),
          lastError: result.status === "failed" ? result.detail : null,
        });
      }
    } catch (err) {
      // One broken enrollment must not stop the rest of the queue.
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[Automation] Enrollment ${enrollment.id} failed:`, msg);
      await updateEnrollment(enrollment.id, { status: "failed", lastError: msg, nextRunAt: null });
    }
  }

  return executed;
}
