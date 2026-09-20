import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { protectedProcedure, router } from "../_core/trpc";
import {
  createTemplate,
  deleteTemplate,
  getTemplateById,
  getTemplates,
  updateTemplate,
} from "../marketingDb";
import { createLandingPage, getLandingPageBySlug, getLandingPageById } from "../db";
import { nanoid } from "nanoid";

const categoryEnum = z.enum(["home_value", "grant", "purchase", "refinance", "webinar", "general"]);

/** Turns a title into a URL-safe slug, with a short suffix when it collides. */
async function uniqueSlug(base: string): Promise<string> {
  const root = base.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 100) || "page";
  const existing = await getLandingPageBySlug(root);
  if (!existing) return root;
  return `${root}-${nanoid(4).toLowerCase()}`;
}

/** Fills `{{token}}` placeholders in template copy from the values supplied. */
function fillTokens(text: string | null | undefined, tokens: Record<string, string>): string | undefined {
  if (!text) return undefined;
  let out = text;
  for (const [key, value] of Object.entries(tokens)) {
    out = out.replace(new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, "g"), value);
  }
  // Leave nothing dangling — an unfilled {{city}} on a live page looks broken.
  return out.replace(/\{\{[^}]*\}\}/g, "").replace(/\s{2,}/g, " ").trim();
}

export const templatesRouter = router({
  list: protectedProcedure
    .input(z.object({ includeInactive: z.boolean().optional() }).optional())
    .query(({ input }) => getTemplates({ includeInactive: input?.includeInactive })),

  getById: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(({ input }) => getTemplateById(input.id)),

  create: protectedProcedure
    .input(z.object({
      key: z.string().min(1).regex(/^[a-z0-9-]+$/, "Key must be lowercase letters, numbers and hyphens"),
      name: z.string().min(1),
      description: z.string().optional(),
      category: categoryEnum.default("general"),
      headline: z.string().optional(),
      subheadline: z.string().optional(),
      bodyText: z.string().optional(),
      ctaText: z.string().optional(),
      enabledFields: z.array(z.string()).optional(),
      accentColor: z.string().optional(),
      textColor: z.string().optional(),
      backgroundHtmlUrl: z.string().optional(),
      artworkUrl: z.string().optional(),
      thumbnailUrl: z.string().optional(),
      confirmationEmailSubject: z.string().optional(),
      confirmationEmailBody: z.string().optional(),
      conversionEventName: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const id = await createTemplate({
        ...input,
        enabledFields: (input.enabledFields ?? ["firstName", "lastName", "email", "phone"]) as any,
        isSystem: false,
        createdBy: ctx.user.id,
      });
      return { id };
    }),

  update: protectedProcedure
    .input(z.object({
      id: z.number(),
      name: z.string().min(1).optional(),
      description: z.string().nullable().optional(),
      category: categoryEnum.optional(),
      headline: z.string().nullable().optional(),
      subheadline: z.string().nullable().optional(),
      bodyText: z.string().nullable().optional(),
      ctaText: z.string().nullable().optional(),
      enabledFields: z.array(z.string()).optional(),
      accentColor: z.string().optional(),
      textColor: z.string().optional(),
      backgroundHtmlUrl: z.string().nullable().optional(),
      artworkUrl: z.string().nullable().optional(),
      thumbnailUrl: z.string().nullable().optional(),
      confirmationEmailSubject: z.string().nullable().optional(),
      confirmationEmailBody: z.string().nullable().optional(),
      conversionEventName: z.string().optional(),
      isActive: z.boolean().optional(),
    }))
    .mutation(async ({ input }) => {
      const { id, enabledFields, ...rest } = input;
      await updateTemplate(id, {
        ...rest,
        ...(enabledFields ? { enabledFields: enabledFields as any } : {}),
      } as any);
      return { success: true };
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const template = await getTemplateById(input.id);
      if (!template) throw new TRPCError({ code: "NOT_FOUND", message: "Template not found" });
      if (template.isSystem) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Built-in templates can't be deleted. Deactivate it instead, or duplicate and edit the copy.",
        });
      }
      await deleteTemplate(input.id);
      return { success: true };
    }),

  /**
   * Stamps a real landing page out of a template. This is the "select or build a
   * branded landing page" step of campaign creation — the page is created live
   * and ready to receive traffic, with tracking switched on by default.
   */
  createLandingPage: protectedProcedure
    .input(z.object({
      templateId: z.number(),
      title: z.string().min(1),
      slug: z.string().regex(/^[a-z0-9-]+$/).optional(),
      campaignId: z.number().nullable().optional(),
      webinarId: z.number().nullable().optional(),
      /** Values for the template's {{tokens}}, e.g. { city: "Ogden", grantAmount: "$15,000" } */
      tokens: z.record(z.string(), z.string()).optional(),
      campaignTag: z.string().optional(),
      sourceTag: z.string().optional(),
      isActive: z.boolean().default(true),
      metaPixelId: z.string().optional(),
      conversionValue: z.number().nullable().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const template = await getTemplateById(input.templateId);
      if (!template) throw new TRPCError({ code: "NOT_FOUND", message: "Template not found" });

      const slug = input.slug ? await uniqueSlug(input.slug) : await uniqueSlug(input.title);
      const tokens = input.tokens ?? {};

      const id = await createLandingPage({
        title: input.title,
        slug,
        headline: fillTokens(template.headline, tokens),
        subheadline: fillTokens(template.subheadline, tokens),
        bodyText: fillTokens(template.bodyText, tokens),
        ctaText: template.ctaText ?? "Get Started",
        campaignTag: input.campaignTag,
        sourceTag: input.sourceTag ?? "facebook",
        webinarId: input.webinarId ?? undefined,
        isActive: input.isActive,
        accentColor: template.accentColor ?? undefined,
        textColor: template.textColor ?? undefined,
        backgroundHtmlUrl: template.backgroundHtmlUrl ?? undefined,
        artworkUrl: template.artworkUrl ?? undefined,
        enabledFields: (template.enabledFields ?? ["firstName", "lastName", "email", "phone"]) as any,
        confirmationEmailSubject: fillTokens(template.confirmationEmailSubject, tokens),
        confirmationEmailBody: fillTokens(template.confirmationEmailBody, tokens),
        templateId: template.id,
        campaignId: input.campaignId ?? null,
        metaPixelId: input.metaPixelId,
        trackingEnabled: true,
        capiEnabled: true,
        conversionEventName: template.conversionEventName ?? "Lead",
        conversionValue: input.conversionValue != null ? String(input.conversionValue) : null,
        createdBy: ctx.user.id,
      } as any);

      const page = await getLandingPageById(id);
      return { id, slug, page };
    }),

  /** Saves an existing landing page back as a reusable template. */
  createFromLandingPage: protectedProcedure
    .input(z.object({
      landingPageId: z.number(),
      key: z.string().min(1).regex(/^[a-z0-9-]+$/),
      name: z.string().min(1),
      category: categoryEnum.default("general"),
      description: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const page = await getLandingPageById(input.landingPageId);
      if (!page) throw new TRPCError({ code: "NOT_FOUND", message: "Landing page not found" });

      const id = await createTemplate({
        key: input.key,
        name: input.name,
        category: input.category,
        description: input.description,
        headline: page.headline,
        subheadline: page.subheadline,
        bodyText: page.bodyText,
        ctaText: page.ctaText,
        enabledFields: page.enabledFields as any,
        accentColor: page.accentColor,
        textColor: page.textColor,
        backgroundHtmlUrl: page.backgroundHtmlUrl,
        artworkUrl: page.artworkUrl,
        confirmationEmailSubject: page.confirmationEmailSubject,
        confirmationEmailBody: page.confirmationEmailBody,
        conversionEventName: (page as any).conversionEventName ?? "Lead",
        isSystem: false,
        createdBy: ctx.user.id,
      });
      return { id };
    }),
});
