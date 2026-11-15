import { z } from "zod";
import { adminProcedure, publicProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { mediaLibrary, landingPageMedia, mediaFolders, adCampaigns } from "../../drizzle/schema";
import { storagePut } from "../storage";
import { nanoid } from "nanoid";
import { eq, desc, inArray, isNull, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";

const FILE_TYPES = ["logo", "image", "background", "other", "video"] as const;
export const SHARED_FOLDER_NAME = "Shared Assets";

/**
 * Make sure the standing folders exist: one Shared Assets folder and one folder
 * per ad campaign, named after it. Cheap enough to run on every folder listing.
 */
async function ensureStandingFolders(db: NonNullable<Awaited<ReturnType<typeof getDb>>>) {
  const [folders, campaigns] = await Promise.all([
    db.select().from(mediaFolders),
    db.select({ id: adCampaigns.id, name: adCampaigns.name }).from(adCampaigns),
  ]);
  if (!folders.some((f) => f.kind === "shared")) {
    await db.insert(mediaFolders).values({ name: SHARED_FOLDER_NAME, kind: "shared" });
  }
  for (const c of campaigns) {
    const folder = folders.find((f) => f.kind === "campaign" && f.adCampaignId === c.id);
    if (!folder) {
      await db.insert(mediaFolders).values({ name: c.name, kind: "campaign", adCampaignId: c.id }).catch(() => {});
    } else if (folder.name !== c.name) {
      await db.update(mediaFolders).set({ name: c.name }).where(eq(mediaFolders.id, folder.id));
    }
  }
}

export const mediaRouter = router({
  /** Folders with item counts: Shared Assets, then campaigns (newest first), then custom folders. */
  folders: adminProcedure.query(async () => {
    const db = await getDb();
    if (!db) return { folders: [], unfiled: 0, total: 0 };
    await ensureStandingFolders(db);
    const [folders, counts] = await Promise.all([
      db.select().from(mediaFolders),
      db.select({ folderId: mediaLibrary.folderId, n: sql<number>`count(*)` }).from(mediaLibrary).groupBy(mediaLibrary.folderId),
    ]);
    const countOf = (id: number | null) => Number(counts.find((c) => c.folderId === id)?.n ?? 0);
    const rank = { shared: 0, campaign: 1, custom: 2 } as const;
    const sorted = folders
      .map((f) => ({ ...f, count: countOf(f.id) }))
      .sort((a, b) =>
        rank[a.kind] - rank[b.kind] ||
        (a.kind === "campaign" ? (b.adCampaignId ?? 0) - (a.adCampaignId ?? 0) : a.name.localeCompare(b.name)));
    // Items in a folder that no longer exists count as unfiled.
    const known = new Set(folders.map((f) => f.id));
    const unfiled = counts.filter((c) => c.folderId === null || !known.has(c.folderId)).reduce((n, c) => n + Number(c.n), 0);
    return { folders: sorted, unfiled, total: counts.reduce((n, c) => n + Number(c.n), 0) };
  }),

  createFolder: adminProcedure
    .input(z.object({ name: z.string().trim().min(1, "Name the folder").max(256) }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const [result] = await db.insert(mediaFolders).values({ name: input.name, kind: "custom" }).$returningId();
      return { id: result.id };
    }),

  renameFolder: adminProcedure
    .input(z.object({ id: z.number(), name: z.string().trim().min(1, "Name the folder").max(256) }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const [folder] = await db.select().from(mediaFolders).where(eq(mediaFolders.id, input.id)).limit(1);
      if (!folder) throw new TRPCError({ code: "NOT_FOUND", message: "Folder not found" });
      if (folder.kind === "campaign") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Campaign folders follow the campaign's name. Rename the campaign instead." });
      }
      await db.update(mediaFolders).set({ name: input.name }).where(eq(mediaFolders.id, input.id));
      return { success: true };
    }),

  /** Delete a custom folder. Its files are kept and become unfiled. */
  deleteFolder: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const [folder] = await db.select().from(mediaFolders).where(eq(mediaFolders.id, input.id)).limit(1);
      if (!folder) return { success: true };
      if (folder.kind !== "custom") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Only folders you created can be deleted." });
      }
      await db.update(mediaLibrary).set({ folderId: null }).where(eq(mediaLibrary.folderId, input.id));
      await db.delete(mediaFolders).where(eq(mediaFolders.id, input.id));
      return { success: true };
    }),

  // List all media items
  list: adminProcedure
    .input(z.object({
      fileType: z.enum(FILE_TYPES).optional(),
      /** A folder id, "unfiled" for items in no folder, or omitted for everything. */
      folderId: z.union([z.number(), z.literal("unfiled")]).optional(),
    }).optional())
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      const where = input?.folderId === "unfiled" ? isNull(mediaLibrary.folderId)
        : typeof input?.folderId === "number" ? eq(mediaLibrary.folderId, input.folderId)
        : undefined;
      const results = await db.select().from(mediaLibrary).where(where).orderBy(desc(mediaLibrary.createdAt));
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
      fileType: z.enum(FILE_TYPES).default("image"),
      label: z.string().optional(),
      folderId: z.number().nullable().optional(),
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
        folderId: input.folderId ?? null,
      }).$returningId();
      return { id: result.id, url: input.fileUrl, key: input.fileKey };
    }),

  // Update media item label/type
  update: adminProcedure
    .input(z.object({
      id: z.number(),
      label: z.string().optional(),
      fileType: z.enum(FILE_TYPES).optional(),
      folderId: z.number().nullable().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      const { id, ...data } = input;
      const updateData: Record<string, unknown> = {};
      if (data.label !== undefined) updateData.label = data.label;
      if (data.fileType !== undefined) updateData.fileType = data.fileType;
      if (data.folderId !== undefined) updateData.folderId = data.folderId;
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
