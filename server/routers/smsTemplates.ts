import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { adminProcedure, router } from "../_core/trpc";
import { getSmsTemplates, upsertSmsTemplate, resetSmsTemplate, createSmsTemplate, updateSmsTemplate, deleteSmsTemplate } from "../db";
import type { SmsTemplate } from "../../drizzle/schema";

export const TRIGGER_VALUES = [
  "new_lead",
  "registered",
  "reminder_24h",
  "reminder_1h",
  "reminder_10min",
  "attended",
  "no_show",
  "consultation_booked",
  "under_contract",
  "deal_closed",
] as const;

export const TRIGGER_LABELS: Record<SmsTemplate["trigger"], string> = {
  new_lead: "New Lead",
  registered: "Webinar Registration",
  reminder_24h: "24-Hour Reminder",
  reminder_1h: "1-Hour Reminder",
  reminder_10min: "10-Minute Reminder",
  attended: "Post-Webinar (Attended)",
  no_show: "Post-Webinar (No Show)",
  consultation_booked: "Consultation Booked",
  under_contract: "Under Contract",
  deal_closed: "Deal Closed",
};

export const TRIGGER_DESCRIPTIONS: Record<SmsTemplate["trigger"], string> = {
  new_lead: "Sent immediately when a new lead is created manually or via a landing page.",
  registered: "Sent when a lead registers for a webinar session.",
  reminder_24h: "Sent before a webinar session starts (default: 24 hours). Use the send-time selector to customize.",
  reminder_1h: "Sent before a webinar session starts (default: 1 hour). Use the send-time selector to customize.",
  reminder_10min: "Sent before a webinar session starts (default: 10 minutes). Use the send-time selector to customize.",
  attended: "Sent after a webinar to leads who attended.",
  no_show: "Sent after a webinar to leads who registered but did not attend.",
  consultation_booked: "Sent when a lead books a consultation.",
  under_contract: "Sent when a deal is marked as under contract.",
  deal_closed: "Sent when a deal is marked as closed/won.",
};

const TRIGGER_ORDER: SmsTemplate["trigger"][] = [
  "new_lead",
  "registered",
  "reminder_24h",
  "reminder_1h",
  "reminder_10min",
  "attended",
  "no_show",
  "consultation_booked",
  "under_contract",
  "deal_closed",
];

const triggerEnum = z.enum(TRIGGER_VALUES);

export const smsTemplatesRouter = router({
  list: adminProcedure.query(async () => {
    const templates = await getSmsTemplates();
    const enriched = templates.map((t) => ({
      ...t,
      label: TRIGGER_LABELS[t.trigger],
      description: TRIGGER_DESCRIPTIONS[t.trigger],
    }));
    // Sort by trigger order, then by id within same trigger
    return enriched.sort((a, b) => {
      const ai = TRIGGER_ORDER.indexOf(a.trigger);
      const bi = TRIGGER_ORDER.indexOf(b.trigger);
      if (ai !== bi) return ai - bi;
      return a.id - b.id;
    });
  }),

  create: adminProcedure
    .input(
      z.object({
        trigger: triggerEnum,
        body: z.string().min(1, "Template body cannot be empty").max(1600, "SMS body cannot exceed 1600 characters"),
        isActive: z.boolean().default(true),
        emailSubject: z.string().max(512).optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const template = await createSmsTemplate(input.trigger, input.body, input.isActive, ctx.user.id, input.emailSubject);
      return { success: true, id: template.id };
    }),

  update: adminProcedure
    .input(
      z.object({
        id: z.number(),
        body: z.string().min(1, "Template body cannot be empty").max(1600, "SMS body cannot exceed 1600 characters"),
        isActive: z.boolean(),
        emailSubject: z.string().max(512).nullable().optional(),
        sendOffsetMinutes: z.number().nullable().optional(),
        smsBody: z.string().nullable().optional(),
      }),
    )
    .mutation(async ({ input }) => {
      await updateSmsTemplate(input.id, input.body, input.isActive, input.emailSubject, input.sendOffsetMinutes, input.smsBody);
      return { success: true };
    }),

  delete: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      await deleteSmsTemplate(input.id);
      return { success: true };
    }),

  // Legacy upsert kept for backward compat
  upsert: adminProcedure
    .input(
      z.object({
        trigger: triggerEnum,
        body: z.string().min(1).max(1600),
        isActive: z.boolean(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      await upsertSmsTemplate(input.trigger, input.body, input.isActive, ctx.user.id);
      return { success: true };
    }),

  reset: adminProcedure
    .input(z.object({ trigger: triggerEnum }))
    .mutation(async ({ input }) => {
      await resetSmsTemplate(input.trigger);
      return { success: true };
    }),
});
