import { z } from "zod";
import { protectedProcedure, publicProcedure, router } from "../_core/trpc";
import {
  createLandingPage, getLandingPages, getLandingPagesWithLeadCount, getLandingPageBySlug,
  getLandingPageById, updateLandingPage, deleteLandingPage,
  getWebinarSessions,
} from "../db";
import { storagePut } from "../storage";
import { nanoid } from "nanoid";

export const landingPagesRouter = router({
  list: protectedProcedure.query(() => getLandingPagesWithLeadCount()),

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
      textColor: z.string().optional(),
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
      textColor: z.string().optional(),
      enabledFields: z.array(z.string()).optional(),
      optInLabel: z.string().optional(),
      showOptIn: z.boolean().optional(),
      confirmationEmailSubject: z.string().optional(),
      confirmationEmailBody: z.string().optional(),
      artworkUrl: z.string().nullable().optional(),
      artworkPosition: z.string().optional(),
      confirmationPdfUrl: z.string().nullable().optional(),
      bgOverlayOpacity: z.number().min(0).max(1).optional(),
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

  duplicate: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const page = await getLandingPageById(input.id);
      if (!page) throw new Error("Landing page not found");
      // Generate a unique slug by appending a short ID
      const newSlug = `${page.slug}-copy-${nanoid(4)}`;
      const id = await createLandingPage({
        title: `${page.title} (Copy)`,
        slug: newSlug,
        headline: page.headline ?? undefined,
        subheadline: page.subheadline ?? undefined,
        bodyText: page.bodyText ?? undefined,
        ctaText: page.ctaText ?? undefined,
        campaignTag: page.campaignTag ?? undefined,
        sourceTag: page.sourceTag ?? undefined,
        webinarId: page.webinarId ?? undefined,
        isActive: false, // start as draft
        accentColor: page.accentColor ?? undefined,
        enabledFields: page.enabledFields ?? ["firstName", "lastName", "email", "phone"],
        optInLabel: page.optInLabel ?? undefined,
        showOptIn: page.showOptIn ?? false,
        confirmationEmailSubject: page.confirmationEmailSubject ?? undefined,
        confirmationEmailBody: page.confirmationEmailBody ?? undefined,
        artworkUrl: page.artworkUrl ?? undefined,
        createdBy: ctx.user.id,
      });
      return { id, slug: newSlug };
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
