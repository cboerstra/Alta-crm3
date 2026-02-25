import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { createDeal, getDeals, getDealById, updateDeal, getRevenueMetrics, logActivity } from "../db";

export const dealsRouter = router({
  list: protectedProcedure
    .input(z.object({ stage: z.string().optional() }).optional())
    .query(({ input }) => getDeals(input)),

  getById: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(({ input }) => getDealById(input.id)),

  create: protectedProcedure
    .input(z.object({
      leadId: z.number(),
      title: z.string().min(1),
      value: z.number().positive(),
      propertyAddress: z.string().optional(),
      expectedCloseDate: z.number().optional(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const id = await createDeal({
        ...input,
        value: input.value.toString() as any,
        assignedTo: ctx.user.id,
        expectedCloseDate: input.expectedCloseDate ? new Date(input.expectedCloseDate) : undefined,
      });
      await logActivity({
        leadId: input.leadId,
        userId: ctx.user.id,
        type: "deal_created",
        title: `Deal created: ${input.title}`,
        content: `Value: $${input.value.toLocaleString()}`,
        metadata: { dealId: id },
      });
      return { id };
    }),

  update: protectedProcedure
    .input(z.object({
      id: z.number(),
      title: z.string().optional(),
      value: z.number().optional(),
      stage: z.enum(["prospect", "qualified", "proposal", "negotiation", "closed_won", "closed_lost"]).optional(),
      propertyAddress: z.string().optional(),
      expectedCloseDate: z.number().optional(),
      actualCloseDate: z.number().optional(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const deal = await getDealById(input.id);
      if (!deal) throw new Error("Deal not found");
      const { id, value, expectedCloseDate, actualCloseDate, ...rest } = input;
      await updateDeal(id, {
        ...rest,
        ...(value !== undefined ? { value: value.toString() as any } : {}),
        ...(expectedCloseDate ? { expectedCloseDate: new Date(expectedCloseDate) } : {}),
        ...(actualCloseDate ? { actualCloseDate: new Date(actualCloseDate) } : {}),
      });
      await logActivity({
        leadId: deal.leadId,
        userId: ctx.user.id,
        type: "deal_updated",
        title: `Deal updated: ${deal.title}`,
        content: input.stage ? `Stage changed to ${input.stage}` : "Deal details updated",
      });
      return { success: true };
    }),

  revenueMetrics: protectedProcedure.query(() => getRevenueMetrics()),
});
