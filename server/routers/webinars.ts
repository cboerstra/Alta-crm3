import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import {
  createWebinar, getWebinars, getWebinarById, updateWebinar,
  getWebinarAttendanceStats, logActivity, updateLead, getLeadById,
  createEmailReminder, getRemindersByLead,
  createWebinarSession, getWebinarSessions, deleteWebinarSessions, getWebinarSessionById,
  createLandingPage, getLandingPageBySlug, updateLandingPage,
  deleteWebinar,
} from "../db";

export const webinarsRouter = router({
  list: protectedProcedure
    .input(z.object({ search: z.string().optional(), status: z.string().optional() }).optional())
    .query(async ({ input }) => {
      const all = await getWebinars();
      let result = all;
      if (input?.search) {
        const q = input.search.toLowerCase();
        result = result.filter(w =>
          w.title.toLowerCase().includes(q) ||
          (w.description ?? "").toLowerCase().includes(q)
        );
      }
      if (input?.status && input.status !== "all") {
        result = result.filter(w => w.status === input.status);
      }
      return result;
    }),

  getById: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const webinar = await getWebinarById(input.id);
      if (!webinar) return null;
      const [stats, sessions] = await Promise.all([
        getWebinarAttendanceStats(input.id),
        getWebinarSessions(input.id),
      ]);
      return { ...webinar, stats, sessions };
    }),

  // Enhanced create: supports multiple sessions and auto-creates a landing page
  create: protectedProcedure
    .input(z.object({
      title: z.string().min(1),
      description: z.string().optional(),
      scheduledAt: z.number(), // unix ms - primary date
      durationMinutes: z.number().default(60),
      zoomJoinUrl: z.string().url().optional(),
      zoomStartUrl: z.string().optional(),
      zoomWebinarId: z.string().optional(),
      replayUrl: z.string().optional(),
      // Additional sessions (multiple dates)
      additionalSessions: z.array(z.object({
        sessionDate: z.number(), // unix ms
        durationMinutes: z.number().default(60),
        label: z.string().optional(),
        zoomJoinUrl: z.string().optional(),
      })).optional(),
      // Auto-create landing page
      createLandingPage: z.boolean().optional(),
      landingPageSlug: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      // Create the webinar
      const webinarId = await createWebinar({
        title: input.title,
        description: input.description,
        scheduledAt: new Date(input.scheduledAt),
        durationMinutes: input.durationMinutes,
        zoomJoinUrl: input.zoomJoinUrl,
        zoomStartUrl: input.zoomStartUrl,
        zoomWebinarId: input.zoomWebinarId,
        replayUrl: input.replayUrl,
        createdBy: ctx.user.id,
        status: "scheduled",
      });

      // Create the primary session
      await createWebinarSession({
        webinarId,
        sessionDate: new Date(input.scheduledAt),
        durationMinutes: input.durationMinutes,
        label: "Primary Session",
        zoomJoinUrl: input.zoomJoinUrl,
      });

      // Create additional sessions
      if (input.additionalSessions?.length) {
        for (const s of input.additionalSessions) {
          await createWebinarSession({
            webinarId,
            sessionDate: new Date(s.sessionDate),
            durationMinutes: s.durationMinutes,
            label: s.label,
            zoomJoinUrl: s.zoomJoinUrl,
          });
        }
      }

      // Auto-create landing page if requested
      let landingPageId: number | undefined;
      if (input.createLandingPage) {
        const baseSlug = input.landingPageSlug || input.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
        let slug = baseSlug;
        let attempt = 0;
        while (await getLandingPageBySlug(slug)) {
          attempt++;
          slug = `${baseSlug}-${attempt}`;
        }
        landingPageId = await createLandingPage({
          createdBy: ctx.user.id,
          title: `${input.title} - Registration`,
          slug,
          headline: input.title,
          subheadline: input.description ?? "Register for our upcoming webinar",
          ctaText: "Register Now",
          webinarId,
          isActive: true,
          enabledFields: ["firstName", "lastName", "email", "phone", "sessionSelect", "optIn"],
          showOptIn: true,
          optInLabel: "I agree to receive communications about this event and future opportunities",
          confirmationEmailSubject: `You're registered for ${input.title}!`,
          confirmationEmailBody: `Thank you for registering! We look forward to seeing you at ${input.title}.`,
        });
        // Link landing page back to webinar
        await updateWebinar(webinarId, { landingPageId });
      }

      return { id: webinarId, landingPageId };
    }),

  update: protectedProcedure
    .input(z.object({
      id: z.number(),
      title: z.string().optional(),
      description: z.string().optional(),
      scheduledAt: z.number().optional(),
      durationMinutes: z.number().optional(),
      zoomJoinUrl: z.string().optional(),
      zoomStartUrl: z.string().optional(),
      zoomWebinarId: z.string().optional(),
      replayUrl: z.string().optional(),
      status: z.enum(["draft", "scheduled", "live", "completed", "cancelled"]).optional(),
    }))
    .mutation(async ({ input }) => {
      const { id, scheduledAt, ...rest } = input;
      await updateWebinar(id, {
        ...rest,
        ...(scheduledAt ? { scheduledAt: new Date(scheduledAt) } : {}),
      });
      return { success: true };
    }),

  // Manage sessions for a webinar
  setSessions: protectedProcedure
    .input(z.object({
      webinarId: z.number(),
      sessions: z.array(z.object({
        sessionDate: z.number(),
        durationMinutes: z.number().default(60),
        label: z.string().optional(),
        zoomJoinUrl: z.string().optional(),
        maxAttendees: z.number().optional(),
      })),
    }))
    .mutation(async ({ input }) => {
      await deleteWebinarSessions(input.webinarId);
      for (const s of input.sessions) {
        await createWebinarSession({
          webinarId: input.webinarId,
          sessionDate: new Date(s.sessionDate),
          durationMinutes: s.durationMinutes,
          label: s.label,
          zoomJoinUrl: s.zoomJoinUrl,
          maxAttendees: s.maxAttendees,
        });
      }
      return { success: true };
    }),

  getSessions: protectedProcedure
    .input(z.object({ webinarId: z.number() }))
    .query(({ input }) => getWebinarSessions(input.webinarId)),

  registerLead: protectedProcedure
    .input(z.object({
      leadId: z.number(),
      webinarId: z.number(),
      sessionId: z.number().optional(),
      zoomJoinUrl: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const webinar = await getWebinarById(input.webinarId);
      if (!webinar) throw new Error("Webinar not found");

      // Get session join URL if a specific session was selected
      let joinUrl = input.zoomJoinUrl ?? webinar.zoomJoinUrl ?? undefined;
      if (input.sessionId) {
        const session = await getWebinarSessionById(input.sessionId);
        if (session?.zoomJoinUrl) joinUrl = session.zoomJoinUrl;
      }

      await updateLead(input.leadId, {
        webinarId: input.webinarId,
        webinarSessionId: input.sessionId,
        zoomJoinUrl: joinUrl,
        attendanceStatus: "registered",
        stage: "registered",
      });
      await logActivity({
        leadId: input.leadId,
        userId: ctx.user.id,
        type: "webinar_registered",
        title: `Registered for webinar: ${webinar.title}`,
        content: `Webinar scheduled for ${webinar.scheduledAt.toISOString()}`,
      });
      // Schedule email reminders
      const webinarTime = webinar.scheduledAt.getTime();
      const reminders = [
        { type: "registration_confirmation" as const, offset: 0, subject: `You're registered for ${webinar.title}` },
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
            leadId: input.leadId,
            webinarId: input.webinarId,
            type: r.type,
            scheduledAt,
            subject: r.subject,
            body: `Join link: ${joinUrl ?? "TBD"}`,
          });
        }
      }
      return { success: true };
    }),

  updateAttendance: protectedProcedure
    .input(z.object({
      leadId: z.number(),
      status: z.enum(["registered", "attended", "no_show"]),
    }))
    .mutation(async ({ input, ctx }) => {
      const lead = await getLeadById(input.leadId);
      if (!lead) throw new Error("Lead not found");
      const newStage = input.status === "attended" ? "attended"
        : input.status === "no_show" ? "no_show"
        : "registered";
      await updateLead(input.leadId, {
        attendanceStatus: input.status,
        stage: newStage as any,
      });
      await logActivity({
        leadId: input.leadId,
        userId: ctx.user.id,
        type: input.status === "attended" ? "webinar_attended"
          : input.status === "no_show" ? "webinar_no_show"
          : "webinar_registered",
        title: `Attendance updated: ${input.status.replace("_", " ")}`,
      });
      // Schedule no-show follow-up
      if (input.status === "no_show" && lead.webinarId) {
        const webinar = await getWebinarById(lead.webinarId);
        if (webinar) {
          await createEmailReminder({
            leadId: input.leadId,
            webinarId: lead.webinarId,
            type: "no_show_followup",
            scheduledAt: new Date(Date.now() + 2 * 60 * 60 * 1000),
            subject: `We missed you at ${webinar.title} — Watch the replay`,
            body: `Replay link: ${webinar.replayUrl ?? "Coming soon"}`,
          });
        }
      }
      return { success: true };
    }),

  getAttendanceStats: protectedProcedure
    .input(z.object({ webinarId: z.number() }))
    .query(({ input }) => getWebinarAttendanceStats(input.webinarId)),

  getReminders: protectedProcedure
    .input(z.object({ leadId: z.number() }))
    .query(({ input }) => getRemindersByLead(input.leadId)),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      await deleteWebinar(input.id);
      return { success: true };
    }),
});
