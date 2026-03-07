import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { protectedProcedure, router } from "../_core/trpc";
import { createDeal, getDeals, getDealById, updateDeal, getRevenueMetrics, logActivity, getLeads } from "../db";

export const dealsRouter = router({
  list: protectedProcedure
    .input(z.object({ stage: z.string().optional(), leadId: z.number().optional() }).optional())
    .query(({ input }) => getDeals(input)),

  /** Search leads by name/email for the deal lead-picker */
  searchLeads: protectedProcedure
    .input(z.object({ query: z.string().optional() }))
    .query(async ({ input }) => {
      const result = await getLeads({ search: input.query, limit: 20 });
      return result.items.map((l: any) => ({
        id: l.id,
        name: `${l.firstName} ${l.lastName}`,
        email: l.email,
        phone: l.phone ?? null,
      }));
    }),

  getById: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(({ input }) => getDealById(input.id)),

  create: protectedProcedure
    .input(z.object({
      leadId: z.number().min(1, "A lead must be selected to create a deal"),
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
      leadId: z.number().optional(),
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
      if (!deal) throw new TRPCError({ code: "NOT_FOUND", message: "Deal not found" });
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
