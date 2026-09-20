import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { protectedProcedure, router } from "../_core/trpc";
import {
  cancelEnrollment,
  enrollLead,
  processDueEnrollments,
} from "../automations/engine";
import {
  createSequence,
  createTask,
  deleteSequence,
  deleteTask,
  getEnrollmentsForLead,
  getSequenceById,
  getSequences,
  getSequenceSteps,
  getStepRunsForEnrollment,
  getTasks,
  replaceSequenceSteps,
  updateSequence,
  updateTask,
  getEnrollment,
} from "../marketingDb";

const stepTypeEnum = z.enum(["email", "sms", "call_task", "wait", "stage_change", "notify_owner"]);
const triggerEnum = z.enum(["campaign_lead", "lead_created", "stage_change", "manual"]);

const stepSchema = z.object({
  type: stepTypeEnum,
  delayMinutes: z.number().min(0).max(60 * 24 * 365).default(0),
  subject: z.string().nullable().optional(),
  body: z.string().nullable().optional(),
  taskTitle: z.string().nullable().optional(),
  taskNotes: z.string().nullable().optional(),
  assignTo: z.number().nullable().optional(),
  targetStage: z.string().nullable().optional(),
  isActive: z.boolean().default(true),
});

/** A sequence whose steps can't do anything is a silent failure — catch it here. */
function validateSteps(steps: z.infer<typeof stepSchema>[]) {
  steps.forEach((step, i) => {
    const position = `Step ${i + 1}`;
    if ((step.type === "email" || step.type === "sms") && !step.body?.trim()) {
      throw new TRPCError({ code: "BAD_REQUEST", message: `${position}: add the message body` });
    }
    if (step.type === "email" && !step.subject?.trim()) {
      throw new TRPCError({ code: "BAD_REQUEST", message: `${position}: add an email subject` });
    }
    if (step.type === "stage_change" && !step.targetStage) {
      throw new TRPCError({ code: "BAD_REQUEST", message: `${position}: choose the stage to move the lead to` });
    }
    if (step.type === "sms" && (step.body?.length ?? 0) > 1000) {
      throw new TRPCError({ code: "BAD_REQUEST", message: `${position}: SMS body is too long` });
    }
  });
}

export const automationsRouter = router({
  // ─── Sequences ─────────────────────────────────────────────────────────────

  list: protectedProcedure.query(async () => {
    const sequences = await getSequences();
    return Promise.all(
      sequences.map(async (s) => ({ ...s, stepCount: (await getSequenceSteps(s.id)).length }))
    );
  }),

  getById: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const sequence = await getSequenceById(input.id);
      if (!sequence) return null;
      const steps = await getSequenceSteps(input.id);
      return { ...sequence, steps };
    }),

  create: protectedProcedure
    .input(z.object({
      name: z.string().min(1),
      description: z.string().optional(),
      triggerType: triggerEnum.default("campaign_lead"),
      triggerValue: z.string().optional(),
      isActive: z.boolean().default(true),
      steps: z.array(stepSchema).default([]),
    }))
    .mutation(async ({ input, ctx }) => {
      validateSteps(input.steps);
      const id = await createSequence({
        name: input.name,
        description: input.description,
        triggerType: input.triggerType,
        triggerValue: input.triggerValue,
        isActive: input.isActive,
        createdBy: ctx.user.id,
      });
      if (input.steps.length > 0) {
        await replaceSequenceSteps(id, input.steps.map((s, i) => ({ ...s, stepOrder: i })) as any);
      }
      return { id };
    }),

  update: protectedProcedure
    .input(z.object({
      id: z.number(),
      name: z.string().min(1).optional(),
      description: z.string().nullable().optional(),
      triggerType: triggerEnum.optional(),
      triggerValue: z.string().nullable().optional(),
      isActive: z.boolean().optional(),
      /** When present, replaces the whole step list — how the builder saves. */
      steps: z.array(stepSchema).optional(),
    }))
    .mutation(async ({ input }) => {
      const { id, steps, ...rest } = input;
      if (Object.keys(rest).length > 0) await updateSequence(id, rest as any);
      if (steps) {
        validateSteps(steps);
        await replaceSequenceSteps(id, steps.map((s, i) => ({ ...s, stepOrder: i })) as any);
      }
      return { success: true };
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      await deleteSequence(input.id);
      return { success: true };
    }),

  // ─── Enrollments ───────────────────────────────────────────────────────────

  enroll: protectedProcedure
    .input(z.object({ sequenceId: z.number(), leadId: z.number(), campaignId: z.number().optional() }))
    .mutation(async ({ input }) => {
      const result = await enrollLead(input.sequenceId, input.leadId, { campaignId: input.campaignId ?? null });
      if (!result.enrolled) throw new TRPCError({ code: "BAD_REQUEST", message: result.reason });
      return { enrollmentId: result.enrollmentId };
    }),

  cancelEnrollment: protectedProcedure
    .input(z.object({ enrollmentId: z.number(), reason: z.string().optional() }))
    .mutation(async ({ input }) => {
      await cancelEnrollment(input.enrollmentId, input.reason ?? "Cancelled by user");
      return { success: true };
    }),

  enrollmentsForLead: protectedProcedure
    .input(z.object({ leadId: z.number() }))
    .query(async ({ input }) => {
      const enrollments = await getEnrollmentsForLead(input.leadId);
      const sequences = await getSequences();
      const byId = new Map(sequences.map((s) => [s.id, s]));
      return enrollments.map((e) => ({ ...e, sequenceName: byId.get(e.sequenceId)?.name ?? "Deleted sequence" }));
    }),

  enrollmentHistory: protectedProcedure
    .input(z.object({ enrollmentId: z.number() }))
    .query(async ({ input }) => {
      const enrollment = await getEnrollment(input.enrollmentId);
      if (!enrollment) return null;
      const [runs, steps] = await Promise.all([
        getStepRunsForEnrollment(input.enrollmentId),
        getSequenceSteps(enrollment.sequenceId),
      ]);
      const stepsById = new Map(steps.map((s) => [s.id, s]));
      return {
        enrollment,
        runs: runs.map((r) => ({ ...r, step: stepsById.get(r.stepId) ?? null })),
      };
    }),

  /** Runs the scheduler immediately — useful when testing a sequence. */
  runDueNow: protectedProcedure.mutation(async () => {
    const executed = await processDueEnrollments(100);
    return { executed };
  }),

  // ─── Tasks ─────────────────────────────────────────────────────────────────

  tasks: protectedProcedure
    .input(z.object({
      status: z.enum(["open", "completed", "cancelled"]).optional(),
      assignedTo: z.number().optional(),
      leadId: z.number().optional(),
      mineOnly: z.boolean().optional(),
    }).optional())
    .query(({ input, ctx }) =>
      getTasks({
        status: input?.status ?? "open",
        assignedTo: input?.mineOnly ? ctx.user.id : input?.assignedTo,
        leadId: input?.leadId,
      })
    ),

  createTask: protectedProcedure
    .input(z.object({
      leadId: z.number().nullable().optional(),
      campaignId: z.number().nullable().optional(),
      assignedTo: z.number().nullable().optional(),
      title: z.string().min(1),
      notes: z.string().optional(),
      type: z.enum(["call", "email", "follow_up", "other"]).default("call"),
      dueAt: z.date().nullable().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const id = await createTask({
        ...input,
        assignedTo: input.assignedTo ?? ctx.user.id,
        createdBy: ctx.user.id,
        source: "manual",
      } as any);
      return { id };
    }),

  completeTask: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      await updateTask(input.id, { status: "completed", completedAt: new Date(), completedBy: ctx.user.id });
      return { success: true };
    }),

  updateTask: protectedProcedure
    .input(z.object({
      id: z.number(),
      title: z.string().min(1).optional(),
      notes: z.string().nullable().optional(),
      assignedTo: z.number().nullable().optional(),
      dueAt: z.date().nullable().optional(),
      status: z.enum(["open", "completed", "cancelled"]).optional(),
    }))
    .mutation(async ({ input }) => {
      const { id, ...data } = input;
      await updateTask(id, data as any);
      return { success: true };
    }),

  deleteTask: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      await deleteTask(input.id);
      return { success: true };
    }),
});
