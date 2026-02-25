import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import {
  createWebinar, getWebinars, getWebinarById, updateWebinar,
  getWebinarAttendanceStats, logActivity, updateLead, getLeadById,
  createEmailReminder, getRemindersByLead,
} from "../db";

export const webinarsRouter = router({
  list: protectedProcedure.query(() => getWebinars()),

  getById: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const webinar = await getWebinarById(input.id);
      if (!webinar) return null;
      const stats = await getWebinarAttendanceStats(input.id);
      return { ...webinar, stats };
    }),

  create: protectedProcedure
    .input(z.object({
      title: z.string().min(1),
      description: z.string().optional(),
      scheduledAt: z.number(), // unix ms
      durationMinutes: z.number().default(60),
      zoomJoinUrl: z.string().url().optional(),
      zoomStartUrl: z.string().optional(),
      zoomWebinarId: z.string().optional(),
      replayUrl: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const id = await createWebinar({
        ...input,
        scheduledAt: new Date(input.scheduledAt),
        createdBy: ctx.user.id,
        status: "scheduled",
      });
      return { id };
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

  registerLead: protectedProcedure
    .input(z.object({
      leadId: z.number(),
      webinarId: z.number(),
      zoomJoinUrl: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const webinar = await getWebinarById(input.webinarId);
      if (!webinar) throw new Error("Webinar not found");
      await updateLead(input.leadId, {
        webinarId: input.webinarId,
        zoomJoinUrl: input.zoomJoinUrl ?? webinar.zoomJoinUrl ?? undefined,
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
      const now = webinar.scheduledAt.getTime();
      const reminders = [
        { type: "registration_confirmation" as const, offset: 0, subject: `You're registered for ${webinar.title}` },
        { type: "reminder_24h" as const, offset: -24 * 60 * 60 * 1000, subject: `Reminder: ${webinar.title} is tomorrow` },
        { type: "reminder_1h" as const, offset: -60 * 60 * 1000, subject: `Starting soon: ${webinar.title}` },
        { type: "reminder_10min" as const, offset: -10 * 60 * 1000, subject: `Starting in 10 minutes: ${webinar.title}` },
      ];
      for (const r of reminders) {
        const scheduledAt = r.type === "registration_confirmation"
          ? new Date()
          : new Date(now + r.offset);
        if (scheduledAt > new Date() || r.type === "registration_confirmation") {
          await createEmailReminder({
            leadId: input.leadId,
            webinarId: input.webinarId,
            type: r.type,
            scheduledAt,
            subject: r.subject,
            body: `Join link: ${input.zoomJoinUrl ?? webinar.zoomJoinUrl ?? "TBD"}`,
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
            scheduledAt: new Date(Date.now() + 2 * 60 * 60 * 1000), // 2h after marking
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
});
