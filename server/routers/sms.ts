import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { createSmsMessage, getSmsByLeadId, logActivity, getLeadById } from "../db";

export const smsRouter = router({
  getByLead: protectedProcedure
    .input(z.object({ leadId: z.number() }))
    .query(({ input }) => getSmsByLeadId(input.leadId)),

  send: protectedProcedure
    .input(z.object({
      leadId: z.number(),
      body: z.string().min(1).max(1600),
    }))
    .mutation(async ({ input, ctx }) => {
      const lead = await getLeadById(input.leadId);
      if (!lead) throw new Error("Lead not found");
      if (!lead.smsConsent) throw new Error("Lead has not consented to SMS");
      // In production, integrate Twilio/similar here
      await createSmsMessage({
        leadId: input.leadId,
        direction: "outbound",
        body: input.body,
        status: "sent",
        sentBy: ctx.user.id,
      });
      await logActivity({
        leadId: input.leadId,
        userId: ctx.user.id,
        type: "sms_sent",
        title: "SMS sent",
        content: input.body,
      });
      return { success: true };
    }),

  receiveWebhook: protectedProcedure
    .input(z.object({
      leadId: z.number(),
      body: z.string(),
      externalId: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      await createSmsMessage({
        leadId: input.leadId,
        direction: "inbound",
        body: input.body,
        status: "received",
      });
      await logActivity({
        leadId: input.leadId,
        type: "sms_received",
        title: "SMS received",
        content: input.body,
      });
      return { success: true };
    }),
});
