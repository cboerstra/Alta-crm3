import { z } from "zod";
import { protectedProcedure, publicProcedure, router } from "../_core/trpc";
import {
  createLead, getLeads, getLeadById, updateLead, updateLeadStage,
  logActivity, getActivityByLeadId, updateLeadScore,
  getLandingPageBySlug, getWebinarById, getWebinarSessionById,
  createEmailReminder, deleteLead, deleteLeads, notifyAdminsBySms,
  sendLeadNotifications, getSmsTemplate,
} from "../db";
import { invokeLLM } from "../_core/llm";
import { notifyOwner } from "../_core/notification";

const stageEnum = z.enum([
  "new_lead", "registered", "attended", "no_show",
  "consultation_booked", "under_contract", "closed",
]);

export const leadsRouter = router({
  list: protectedProcedure
    .input(z.object({
      stage: z.string().optional(),
      source: z.string().optional(),
      search: z.string().optional(),
      limit: z.number().default(50),
      offset: z.number().default(0),
    }))
    .query(({ input }) => getLeads(input)),

  getById: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(({ input }) => getLeadById(input.id)),

  create: protectedProcedure
    .input(z.object({
      firstName: z.string().min(1),
      lastName: z.string().min(1),
      email: z.string().email(),
      phone: z.string().optional(),
      source: z.string().optional(),
      campaign: z.string().optional(),
      landingPageId: z.number().optional(),
      webinarId: z.number().optional(),
      smsConsent: z.boolean().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const id = await createLead({ ...input, stage: "new_lead" });
      await logActivity({
        leadId: id,
        userId: ctx.user.id,
        type: "system",
        title: "Lead created",
        content: `Lead created from ${input.source ?? "direct entry"}`,
      });
      // Fire SMS + email for new lead (fire-and-forget)
      sendLeadNotifications(id, "new_lead", ctx.user.id).catch(() => {});
      return { id };
    }),

  update: protectedProcedure
    .input(z.object({
      id: z.number(),
      firstName: z.string().optional(),
      lastName: z.string().optional(),
      email: z.string().email().optional(),
      phone: z.string().optional(),
      source: z.string().optional(),
      campaign: z.string().optional(),
      quickNote: z.string().optional(),
      smsConsent: z.boolean().optional(),
      assignedTo: z.number().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const { id, ...data } = input;
      await updateLead(id, data);
      await logActivity({ leadId: id, userId: ctx.user.id, type: "system", title: "Lead updated" });
      return { success: true };
    }),

  updateStage: protectedProcedure
    .input(z.object({ id: z.number(), stage: stageEnum }))
    .mutation(async ({ input, ctx }) => {
      const prev = await getLeadById(input.id);
      await updateLeadStage(input.id, input.stage);
      await logActivity({
        leadId: input.id,
        userId: ctx.user.id,
        type: "stage_change",
        title: `Stage changed to ${input.stage.replace(/_/g, " ")}`,
        content: `Previous stage: ${prev?.stage ?? "unknown"}`,
      });
      // Map stage names to SMS template triggers
      const stageToTrigger: Partial<Record<string, "consultation_booked" | "under_contract" | "deal_closed">> = {
        consultation_booked: "consultation_booked",
        under_contract: "under_contract",
        closed: "deal_closed",
      };
      const triggerKey = stageToTrigger[input.stage];
      if (triggerKey) {
        sendLeadNotifications(input.id, triggerKey, ctx.user.id).catch(() => {});
      }
      return { success: true };
    }),

  addNote: protectedProcedure
    .input(z.object({ leadId: z.number(), content: z.string().min(1) }))
    .mutation(async ({ input, ctx }) => {
      await logActivity({
        leadId: input.leadId,
        userId: ctx.user.id,
        type: "note",
        title: "Note added",
        content: input.content,
      });
      return { success: true };
    }),

  getActivity: protectedProcedure
    .input(z.object({ leadId: z.number() }))
    .query(({ input }) => getActivityByLeadId(input.leadId)),

  scoreWithLLM: protectedProcedure
    .input(z.object({ leadId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const lead = await getLeadById(input.leadId);
      if (!lead) throw new Error("Lead not found");
      const activity = await getActivityByLeadId(input.leadId);
      const prompt = `You are a real estate CRM lead scoring expert. Analyze this lead and return a JSON score.

Lead Data:
- Name: ${lead.firstName} ${lead.lastName}
- Email: ${lead.email}
- Phone: ${lead.phone ?? "not provided"}
- Source: ${lead.source ?? "unknown"}
- Campaign: ${lead.campaign ?? "unknown"}
- Pipeline Stage: ${lead.stage}
- Attendance Status: ${lead.attendanceStatus ?? "not registered"}
- SMS Consent: ${lead.smsConsent ? "yes" : "no"}
- Contact Opt-In: ${lead.contactOptIn ? "yes" : "no"}
- Deal Value: ${lead.dealValue ?? "none"}
- Consultation Booked: ${lead.consultationBookedAt ? "yes" : "no"}
- Activity Count: ${activity.length}
- Recent Activities: ${activity.slice(0, 5).map((a) => a.title).join(", ")}

Score the lead 0-100 based on engagement, intent signals, and pipeline progress. Return JSON: {"score": number, "reason": "brief explanation"}`;

      const response = await invokeLLM({
        messages: [{ role: "user", content: prompt }],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "lead_score",
            strict: true,
            schema: {
              type: "object",
              properties: {
                score: { type: "integer" },
                reason: { type: "string" },
              },
              required: ["score", "reason"],
              additionalProperties: false,
            },
          },
        },
      });
      const content = response.choices[0]?.message?.content;
      const parsed = typeof content === "string" ? JSON.parse(content) : content;
      const score = Math.min(100, Math.max(0, parsed.score));
      await updateLeadScore(input.leadId, score, parsed.reason);
      await logActivity({
        leadId: input.leadId,
        userId: ctx.user.id,
        type: "score_updated",
        title: `Lead score updated to ${score}/100`,
        content: parsed.reason,
      });
      return { score, reason: parsed.reason };
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      await deleteLead(input.id);
      return { success: true };
    }),

  bulkDelete: protectedProcedure
    .input(z.object({ ids: z.array(z.number()).min(1) }))
    .mutation(async ({ input }) => {
      await deleteLeads(input.ids);
      return { success: true, count: input.ids.length };
    }),

  // Public endpoint for landing page form submissions
  captureFromLandingPage: publicProcedure
    .input(z.object({
      firstName: z.string().min(1),
      lastName: z.string().min(1),
      email: z.string().email(),
      phone: z.string().optional(),
      slug: z.string(),
      smsConsent: z.boolean().optional(),
      contactOptIn: z.boolean().optional(),
      webinarSessionId: z.number().optional(),
    }))
    .mutation(async ({ input }) => {
      const page = await getLandingPageBySlug(input.slug);
      if (!page || !page.isActive) throw new Error("Landing page not found");

      // Create the lead
      const id = await createLead({
        firstName: input.firstName,
        lastName: input.lastName,
        email: input.email,
        phone: input.phone,
        source: page.sourceTag ?? "landing_page",
        campaign: page.campaignTag,
        landingPageId: page.id,
        webinarId: page.webinarId ?? undefined,
        webinarSessionId: input.webinarSessionId,
        smsConsent: input.smsConsent ?? false,
        contactOptIn: input.contactOptIn ?? false,
        stage: page.webinarId ? "registered" : "new_lead",
        attendanceStatus: page.webinarId ? "registered" : undefined,
      });

      await logActivity({
        leadId: id,
        type: "system",
        title: "Lead captured from landing page",
        content: `Captured via landing page: ${page.title}`,
      });

      // If linked to webinar, get join URL from session or webinar
      let joinUrl: string | undefined;
      if (page.webinarId) {
        const webinar = await getWebinarById(page.webinarId);
        joinUrl = webinar?.zoomJoinUrl ?? undefined;
        if (input.webinarSessionId) {
          const session = await getWebinarSessionById(input.webinarSessionId);
          if (session?.zoomJoinUrl) joinUrl = session.zoomJoinUrl;
        }
        if (joinUrl) {
          await updateLead(id, { zoomJoinUrl: joinUrl });
        }

        // Log webinar registration activity
        await logActivity({
          leadId: id,
          type: "webinar_registered",
          title: `Registered for webinar: ${webinar?.title ?? "Unknown"}`,
        });

        // Schedule email reminders for the webinar
        if (webinar) {
          // Resolve session date for placeholder
          let sessionDateStr = webinar.scheduledAt.toLocaleString("en-US", {
            month: "long", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit",
          });
          if (input.webinarSessionId) {
            const sess = await getWebinarSessionById(input.webinarSessionId);
            if (sess) {
              sessionDateStr = sess.sessionDate.toLocaleString("en-US", {
                month: "long", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit",
              });
            }
          }
          // Helper to resolve all placeholders in a template string
          // Supports both {{camelCase}} (legacy landing page style) and {{snake_case}} (SMS template style)
          const resolve = (tpl: string) => tpl
            .replace(/\{\{firstName\}\}|\{\{first_name\}\}/g, input.firstName)
            .replace(/\{\{lastName\}\}|\{\{last_name\}\}/g, input.lastName)
            .replace(/\{\{fullName\}\}|\{\{full_name\}\}/g, `${input.firstName} ${input.lastName}`)
            .replace(/\{\{webinarTitle\}\}|\{\{webinar_title\}\}/g, webinar.title)
            .replace(/\{\{joinUrl\}\}|\{\{webinar_link\}\}/g, joinUrl ?? "")
            .replace(/\{\{date\}\}|\{\{session_date\}\}/g, sessionDateStr);

          // Load the registered SMS template to use as the confirmation email body
          const registeredTemplate = await getSmsTemplate("registered");

          const webinarTime = webinar.scheduledAt.getTime();
          const reminders = [
            { type: "registration_confirmation" as const, offset: 0, subject: resolve(registeredTemplate?.emailSubject || `You're registered for ${webinar.title}!`) },
            { type: "reminder_24h" as const, offset: -24 * 60 * 60 * 1000, subject: `Reminder: ${webinar.title} is tomorrow` },
            { type: "reminder_1h" as const, offset: -60 * 60 * 1000, subject: `Starting soon: ${webinar.title}` },
            { type: "reminder_10min" as const, offset: -10 * 60 * 1000, subject: `Starting in 10 minutes: ${webinar.title}` },
          ];
          for (const r of reminders) {
            const scheduledAt = r.type === "registration_confirmation"
              ? new Date()
              : new Date(webinarTime + r.offset);
            if (scheduledAt > new Date() || r.type === "registration_confirmation") {
              await createEmailReminder({
                leadId: id,
                webinarId: page.webinarId,
                type: r.type,
                scheduledAt,
                subject: r.subject,
                body: r.type === "registration_confirmation"
                  ? resolve(registeredTemplate?.body || `Thank you for registering for ${webinar.title}!`)
                  : `Join link: ${joinUrl ?? "TBD"}`,
                attachmentUrl: r.type === "registration_confirmation" ? (page.confirmationPdfUrl ?? undefined) : undefined,
              });
            }
          }
        }
      } else {
        // Non-webinar landing page: send confirmation email
        if (page.confirmationEmailSubject) {
          const resolveNonWebinar = (tpl: string) => tpl
            .replace(/\{\{firstName\}\}/g, input.firstName)
            .replace(/\{\{lastName\}\}/g, input.lastName)
            .replace(/\{\{fullName\}\}/g, `${input.firstName} ${input.lastName}`);
          await createEmailReminder({
            leadId: id,
            webinarId: 0,
            type: "registration_confirmation",
            scheduledAt: new Date(),
            subject: resolveNonWebinar(page.confirmationEmailSubject),
            body: resolveNonWebinar(page.confirmationEmailBody ?? "Thank you for your interest!"),
            attachmentUrl: page.confirmationPdfUrl ?? undefined,
          });
        }
      }

      // Notify owner about new lead (Manus platform notification)
      try {
        await notifyOwner({
          title: "New Lead Captured",
          content: `${input.firstName} ${input.lastName} (${input.email}) signed up via ${page.title}`,
        });
      } catch (e) {
        // Non-critical, don't fail the capture
      }

      // Fire SMS + email for the lead (new_lead or registered trigger)
      const landingTrigger = page.webinarId ? "registered" : "new_lead";
      sendLeadNotifications(id, landingTrigger).catch(() => {});

      // Notify admins via SMS (fire-and-forget — never blocks the response)
      const adminSmsBody = [
        `New lead registered: ${input.firstName} ${input.lastName}`,
        input.phone ? `Phone: ${input.phone}` : null,
        `Email: ${input.email}`,
        `Source: ${page.title}`,
      ].filter(Boolean).join(" | ");
      notifyAdminsBySms(adminSmsBody).catch(() => {/* silently ignore */});

      return { id, webinarId: page.webinarId, joinUrl };
    }),
});
