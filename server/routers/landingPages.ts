import { z } from "zod";
import { protectedProcedure, publicProcedure, router } from "../_core/trpc";
import {
  createLandingPage, getLandingPages, getLandingPageBySlug,
  getLandingPageById, updateLandingPage, deleteLandingPage,
} from "../db";

export const landingPagesRouter = router({
  list: protectedProcedure.query(() => getLandingPages()),

  getBySlug: publicProcedure
    .input(z.object({ slug: z.string() }))
    .query(({ input }) => getLandingPageBySlug(input.slug)),

  getById: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(({ input }) => getLandingPageById(input.id)),

  create: protectedProcedure
    .input(z.object({
      title: z.string().min(1),
      slug: z.string().min(1).regex(/^[a-z0-9-]+$/, "Slug must be lowercase alphanumeric with hyphens"),
      headline: z.string().optional(),
      subheadline: z.string().optional(),
      ctaText: z.string().optional(),
      campaignTag: z.string().optional(),
      sourceTag: z.string().optional(),
      webinarId: z.number().optional(),
      isActive: z.boolean().default(true),
      accentColor: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const existing = await getLandingPageBySlug(input.slug);
      if (existing) throw new Error("Slug already in use");
      const id = await createLandingPage({ ...input, createdBy: ctx.user.id });
      return { id };
    }),

  update: protectedProcedure
    .input(z.object({
      id: z.number(),
      title: z.string().optional(),
      headline: z.string().optional(),
      subheadline: z.string().optional(),
      ctaText: z.string().optional(),
      campaignTag: z.string().optional(),
      sourceTag: z.string().optional(),
      webinarId: z.number().optional(),
      isActive: z.boolean().optional(),
      accentColor: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const { id, ...data } = input;
      await updateLandingPage(id, data);
      return { success: true };
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      await deleteLandingPage(input.id);
      return { success: true };
    }),
});
