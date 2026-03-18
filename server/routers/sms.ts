import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { protectedProcedure, router } from "../_core/trpc";
import { createSmsMessage, getSmsByLeadId, logActivity, getLeadById, getIntegration, getNextWebinarForLead } from "../db";

export const smsRouter = router({
  getByLead: protectedProcedure
    .input(z.object({ leadId: z.number() }))
    .query(({ input }) => getSmsByLeadId(input.leadId)),

  getNextWebinarLink: protectedProcedure
    .input(z.object({ leadId: z.number() }))
    .query(async ({ input }) => {
      return getNextWebinarForLead(input.leadId);
    }),

  send: protectedProcedure
    .input(z.object({
      leadId: z.number(),
      body: z.string().min(1).max(1600),
    }))
    .mutation(async ({ input, ctx }) => {
      const lead = await getLeadById(input.leadId);
      if (!lead) throw new TRPCError({ code: "NOT_FOUND", message: "Lead not found" });
      if (!lead.smsConsent) throw new TRPCError({ code: "BAD_REQUEST", message: "Lead has not consented to SMS" });
      if (!lead.phone) throw new TRPCError({ code: "BAD_REQUEST", message: "Lead has no phone number" });

      // Resolve placeholder variables in the message body
      let resolvedBody = input.body;
      if (resolvedBody.includes("{{webinar_link}}") || resolvedBody.includes("{{webinar_title}}") || resolvedBody.includes("{{session_date}}")) {
        const webinarInfo = await getNextWebinarForLead(input.leadId);
        resolvedBody = resolvedBody
          .replace(/\{\{webinar_link\}\}/g, webinarInfo?.joinUrl ?? "[webinar link unavailable]")
          .replace(/\{\{webinar_title\}\}/g, webinarInfo?.webinarTitle ?? "Upcoming Webinar")
          .replace(/\{\{session_date\}\}/g, webinarInfo?.sessionDate
            ? new Date(webinarInfo.sessionDate).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" })
            : "[date TBD]"
          );
      }
      resolvedBody = resolvedBody
        .replace(/\{\{first_name\}\}/g, lead.firstName ?? "")
        .replace(/\{\{last_name\}\}/g, lead.lastName ?? "")
        .replace(/\{\{full_name\}\}/g, [lead.firstName, lead.lastName].filter(Boolean).join(" ") || "there");

      // Send via Telnyx
      const telnyx = await getIntegration(ctx.user.id, "twilio"); // stored as "twilio" provider key
      if (!telnyx?.accessToken || !telnyx.accountEmail) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Telnyx SMS is not configured. Go to Settings → SMS to connect Telnyx." });
      }
      const meta = telnyx.metadata as { enabled?: boolean } | null;
      if (meta?.enabled === false) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "SMS sending is currently disabled. Enable it in Settings → SMS." });
      }

      let toPhone = lead.phone.trim().replace(/[\s\-().]/g, "");
      if (!toPhone.startsWith("+")) toPhone = `+1${toPhone}`;

      // Normalize the stored from number to E.164 as a safety net
      let fromPhone = (telnyx.accountEmail ?? "").trim().replace(/[\s\-().]/g, "");
      if (!fromPhone.startsWith("+")) fromPhone = `+1${fromPhone}`;

      const res = await fetch("https://api.telnyx.com/v2/messages", {
        method: "POST",
        headers: { Authorization: `Bearer ${telnyx.accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from: fromPhone, to: toPhone, text: resolvedBody }),
      });

      let externalId: string | undefined;
      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { errors?: Array<{ detail?: string }> };
        const detail = err.errors?.[0]?.detail ?? `Telnyx error (HTTP ${res.status})`;
        throw new TRPCError({ code: "BAD_REQUEST", message: detail });
      } else {
        const data = await res.json().catch(() => ({})) as { data?: { id?: string } };
        externalId = data?.data?.id;
      }

      await createSmsMessage({
        leadId: input.leadId,
        direction: "outbound",
        body: resolvedBody,
        status: "sent",
        sentBy: ctx.user.id,
      });
      await logActivity({
        leadId: input.leadId,
        userId: ctx.user.id,
        type: "sms_sent",
        title: "SMS sent",
        content: resolvedBody,
      });
      return { success: true, externalId };
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
