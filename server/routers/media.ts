import { z } from "zod";
import { adminProcedure, publicProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { mediaLibrary, landingPageMedia } from "../../drizzle/schema";
import { storagePut } from "../storage";
import { nanoid } from "nanoid";
import { eq, desc, inArray } from "drizzle-orm";

export const mediaRouter = router({
  // List all media items
  list: adminProcedure
    .input(z.object({
      fileType: z.enum(["logo", "image", "background", "other"]).optional(),
    }).optional())
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      const query = db.select().from(mediaLibrary).orderBy(desc(mediaLibrary.createdAt));
      const results = await query;
      if (input?.fileType) {
        return results.filter(r => r.fileType === input.fileType);
      }
      return results;
    }),

  // Upload a new media item (accepts a URL returned by /api/upload)
  upload: adminProcedure
    .input(z.object({
      fileUrl: z.string(),          // URL from /api/upload (e.g. /uploads/filename.jpg)
      fileKey: z.string(),          // filename on disk
      fileName: z.string(),
      contentType: z.string(),
      fileSize: z.number().default(0),
      fileType: z.enum(["logo", "image", "background", "other"]).default("image"),
      label: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const [result] = await db.insert(mediaLibrary).values({
        uploadedBy: ctx.user.id,
        fileName: input.fileName,
        fileUrl: input.fileUrl,
        fileKey: input.fileKey,
        fileType: input.fileType,
        mimeType: input.contentType,
        fileSize: input.fileSize,
        label: input.label || input.fileName.replace(/\.[^.]+$/, ""),
      }).$returningId();
      return { id: result.id, url: input.fileUrl, key: input.fileKey };
    }),

  // Update media item label/type
  update: adminProcedure
    .input(z.object({
      id: z.number(),
      label: z.string().optional(),
      fileType: z.enum(["logo", "image", "background", "other"]).optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const { id, ...data } = input;
      const updateData: Record<string, unknown> = {};
      if (data.label !== undefined) updateData.label = data.label;
      if (data.fileType !== undefined) updateData.fileType = data.fileType;
      if (Object.keys(updateData).length > 0) {
        await db.update(mediaLibrary).set(updateData).where(eq(mediaLibrary.id, id));
      }
      return { success: true };
    }),

  // Delete a media item
  delete: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      // Also remove any landing page associations
      await db.delete(landingPageMedia).where(eq(landingPageMedia.mediaId, input.id));
      await db.delete(mediaLibrary).where(eq(mediaLibrary.id, input.id));
      return { success: true };
    }),

  // ─── Landing Page Media Associations ───
  // Get media items for a landing page
  getForLandingPage: publicProcedure
    .input(z.object({ landingPageId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      const associations = await db.select().from(landingPageMedia)
        .where(eq(landingPageMedia.landingPageId, input.landingPageId))
        .orderBy(landingPageMedia.sortOrder);
      if (!associations.length) return [];
      const mediaIds = associations.map(a => a.mediaId);
      const items = await db.select().from(mediaLibrary).where(inArray(mediaLibrary.id, mediaIds));
      const itemMap = new Map(items.map(i => [i.id, i]));
      return associations.map(a => ({
        ...a,
        media: itemMap.get(a.mediaId) || null,
      })).filter(a => a.media);
    }),

  // Set media items for a landing page (replace all)
  setForLandingPage: adminProcedure
    .input(z.object({
      landingPageId: z.number(),
      items: z.array(z.object({
        mediaId: z.number(),
        placement: z.enum(["foreground_logo", "foreground_image", "background"]),
        sortOrder: z.number().default(0),
      })),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      // Remove existing associations
      await db.delete(landingPageMedia).where(eq(landingPageMedia.landingPageId, input.landingPageId));
      // Insert new ones
      if (input.items.length > 0) {
        await db.insert(landingPageMedia).values(
          input.items.map(item => ({
            landingPageId: input.landingPageId,
            mediaId: item.mediaId,
            placement: item.placement,
            sortOrder: item.sortOrder,
          }))
        );
      }
      return { success: true };
    }),

  // Get media by slug (public - for rendering landing pages)
  getForLandingPageBySlug: publicProcedure
    .input(z.object({ slug: z.string() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      // First find the landing page
      const { landingPages } = await import("../../drizzle/schema");
      const [page] = await db.select({ id: landingPages.id }).from(landingPages).where(eq(landingPages.slug, input.slug)).limit(1);
      if (!page) return [];
      const associations = await db.select().from(landingPageMedia)
        .where(eq(landingPageMedia.landingPageId, page.id))
        .orderBy(landingPageMedia.sortOrder);
      if (!associations.length) return [];
      const mediaIds = associations.map(a => a.mediaId);
      const items = await db.select().from(mediaLibrary).where(inArray(mediaLibrary.id, mediaIds));
      const itemMap = new Map(items.map(i => [i.id, i]));
      return associations.map(a => ({
        ...a,
        media: itemMap.get(a.mediaId) || null,
      })).filter(a => a.media);
    }),
});
