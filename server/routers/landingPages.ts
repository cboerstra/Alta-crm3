import { z } from "zod";
import { protectedProcedure, publicProcedure, router } from "../_core/trpc";
import {
  createLandingPage, getLandingPages, getLandingPageBySlug,
  getLandingPageById, updateLandingPage, deleteLandingPage,
  getWebinarSessions,
} from "../db";
import { storagePut } from "../storage";
import { nanoid } from "nanoid";

export const landingPagesRouter = router({
  list: protectedProcedure.query(() => getLandingPages()),

  getBySlug: publicProcedure
    .input(z.object({ slug: z.string() }))
    .query(async ({ input }) => {
      const page = await getLandingPageBySlug(input.slug);
      if (!page) return null;
      // Also fetch webinar sessions if linked
      let sessions: any[] = [];
      if (page.webinarId) {
        sessions = await getWebinarSessions(page.webinarId);
      }
      return { ...page, sessions };
    }),

  getById: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const page = await getLandingPageById(input.id);
      if (!page) return null;
      let sessions: any[] = [];
      if (page.webinarId) {
        sessions = await getWebinarSessions(page.webinarId);
      }
      return { ...page, sessions };
    }),

  create: protectedProcedure
    .input(z.object({
      title: z.string().min(1),
      slug: z.string().min(1).regex(/^[a-z0-9-]+$/, "Slug must be lowercase alphanumeric with hyphens"),
      headline: z.string().optional(),
      subheadline: z.string().optional(),
      bodyText: z.string().optional(),
      ctaText: z.string().optional(),
      campaignTag: z.string().optional(),
      sourceTag: z.string().optional(),
      webinarId: z.number().optional(),
      isActive: z.boolean().default(true),
      accentColor: z.string().optional(),
      // NEW fields
      enabledFields: z.array(z.string()).optional(),
      optInLabel: z.string().optional(),
      showOptIn: z.boolean().optional(),
      confirmationEmailSubject: z.string().optional(),
      confirmationEmailBody: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const existing = await getLandingPageBySlug(input.slug);
      if (existing) throw new Error("Slug already in use");
      const id = await createLandingPage({
        ...input,
        createdBy: ctx.user.id,
        enabledFields: input.enabledFields ?? ["firstName", "lastName", "email", "phone"],
      });
      return { id };
    }),

  update: protectedProcedure
    .input(z.object({
      id: z.number(),
      title: z.string().optional(),
      headline: z.string().optional(),
      subheadline: z.string().optional(),
      bodyText: z.string().optional(),
      ctaText: z.string().optional(),
      campaignTag: z.string().optional(),
      sourceTag: z.string().optional(),
      webinarId: z.number().nullable().optional(),
      isActive: z.boolean().optional(),
      accentColor: z.string().optional(),
      enabledFields: z.array(z.string()).optional(),
      optInLabel: z.string().optional(),
      showOptIn: z.boolean().optional(),
      confirmationEmailSubject: z.string().optional(),
      confirmationEmailBody: z.string().optional(),
      artworkUrl: z.string().nullable().optional(),
      confirmationPdfUrl: z.string().nullable().optional(),
    }))
    .mutation(async ({ input }) => {
      const { id, ...data } = input;
      await updateLandingPage(id, data as any);
      return { success: true };
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      await deleteLandingPage(input.id);
      return { success: true };
    }),

  // Upload artwork image for a landing page
  uploadArtwork: protectedProcedure
    .input(z.object({
      landingPageId: z.number(),
      fileBase64: z.string(),
      fileName: z.string(),
      contentType: z.string(),
    }))
    .mutation(async ({ input }) => {
      const buffer = Buffer.from(input.fileBase64, "base64");
      const ext = input.fileName.split(".").pop() ?? "jpg";
      const key = `landing-pages/${input.landingPageId}/artwork-${nanoid()}.${ext}`;
      const { url } = await storagePut(key, buffer, input.contentType);
      await updateLandingPage(input.landingPageId, { artworkUrl: url });
      return { url };
    }),

  // Upload PDF for confirmation email attachment
  uploadPdf: protectedProcedure
    .input(z.object({
      landingPageId: z.number(),
      fileBase64: z.string(),
      fileName: z.string(),
    }))
    .mutation(async ({ input }) => {
      const buffer = Buffer.from(input.fileBase64, "base64");
      const key = `landing-pages/${input.landingPageId}/pdf-${nanoid()}.pdf`;
      const { url } = await storagePut(key, buffer, "application/pdf");
      await updateLandingPage(input.landingPageId, { confirmationPdfUrl: url });
      return { url };
    }),
});
