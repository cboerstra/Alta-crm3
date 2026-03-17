import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { adminProcedure, router } from "../_core/trpc";
import { getSmsTemplates, upsertSmsTemplate, resetSmsTemplate } from "../db";
import type { SmsTemplate } from "../../drizzle/schema";

const TRIGGER_LABELS: Record<SmsTemplate["trigger"], string> = {
  new_lead: "New Lead",
  registered: "Webinar Registration",
  reminder_24h: "24-Hour Reminder",
  reminder_1h: "1-Hour Reminder",
  attended: "Post-Webinar (Attended)",
  no_show: "Post-Webinar (No Show)",
  consultation_booked: "Consultation Booked",
  deal_closed: "Deal Closed",
};

const TRIGGER_DESCRIPTIONS: Record<SmsTemplate["trigger"], string> = {
  new_lead: "Sent immediately when a new lead is created manually or via a landing page.",
  registered: "Sent when a lead registers for a webinar session.",
  reminder_24h: "Sent 24 hours before a webinar session starts.",
  reminder_1h: "Sent 1 hour before a webinar session starts.",
  attended: "Sent after a webinar to leads who attended.",
  no_show: "Sent after a webinar to leads who registered but did not attend.",
  consultation_booked: "Sent when a lead books a consultation.",
  deal_closed: "Sent when a deal is marked as closed/won.",
};

export const smsTemplatesRouter = router({
  list: adminProcedure.query(async () => {
    const templates = await getSmsTemplates();
    return templates.map((t) => ({
      ...t,
      label: TRIGGER_LABELS[t.trigger],
      description: TRIGGER_DESCRIPTIONS[t.trigger],
    }));
  }),

  upsert: adminProcedure
    .input(
      z.object({
        trigger: z.enum([
          "new_lead",
          "registered",
          "reminder_24h",
          "reminder_1h",
          "attended",
          "no_show",
          "consultation_booked",
          "deal_closed",
        ]),
        body: z.string().min(1, "Template body cannot be empty").max(1600, "SMS body cannot exceed 1600 characters"),
        isActive: z.boolean(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      await upsertSmsTemplate(input.trigger, input.body, input.isActive, ctx.user.id);
      return { success: true };
    }),

  reset: adminProcedure
    .input(
      z.object({
        trigger: z.enum([
          "new_lead",
          "registered",
          "reminder_24h",
          "reminder_1h",
          "attended",
          "no_show",
          "consultation_booked",
          "deal_closed",
        ]),
      }),
    )
    .mutation(async ({ input }) => {
      await resetSmsTemplate(input.trigger);
      return { success: true };
    }),
});
