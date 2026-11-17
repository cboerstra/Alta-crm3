import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { eq, sql } from "drizzle-orm";
import { adminProcedure, protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { landingPages, websites } from "../../drizzle/schema";
import { CRM_SITE_KEY, clearWebsiteCache, listWebsites, normalizeSiteUrl, siteKeyFor } from "../websites";

const urlInput = z.string().trim().min(3).max(255);

async function requireDb() {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
  return db;
}

function parseUrl(input: string): string {
  const url = normalizeSiteUrl(input);
  if (!url) throw new TRPCError({ code: "BAD_REQUEST", message: "Enter the site's https address, e.g. https://example.com" });
  return url;
}

export const websitesRouter = router({
  /** Every website with how many landing pages it hosts. */
  list: protectedProcedure.query(async () => {
    const db = await requireDb();
    const rows = await listWebsites(true);
    const counts = await db
      .select({ hostSite: landingPages.hostSite, n: sql<number>`count(*)` })
      .from(landingPages)
      .groupBy(landingPages.hostSite);
    const byKey = new Map(counts.map((c) => [c.hostSite, Number(c.n)]));
    return rows
      .map((w) => ({ ...w, isCrm: w.siteKey === CRM_SITE_KEY, pageCount: byKey.get(w.siteKey) ?? 0 }))
      .sort((a, b) => (a.isCrm === b.isCrm ? a.name.localeCompare(b.name) : a.isCrm ? -1 : 1));
  }),

  add: adminProcedure
    .input(z.object({ url: urlInput, name: z.string().trim().max(128).optional() }))
    .mutation(async ({ input }) => {
      const db = await requireDb();
      const baseUrl = parseUrl(input.url);
      const siteKey = siteKeyFor(baseUrl);
      const existing = (await listWebsites(true)).find((w) => w.siteKey === siteKey || w.baseUrl === baseUrl);
      if (existing) throw new TRPCError({ code: "CONFLICT", message: `${existing.name} is already in the list` });
      const name = input.name || new URL(baseUrl).hostname.replace(/^www\./, "");
      await db.insert(websites).values({ siteKey, name, baseUrl });
      clearWebsiteCache();
      return { siteKey, name, baseUrl };
    }),

  update: adminProcedure
    .input(z.object({ id: z.number().int(), url: urlInput, name: z.string().trim().min(1).max(128) }))
    .mutation(async ({ input }) => {
      const db = await requireDb();
      const baseUrl = parseUrl(input.url);
      await db.update(websites).set({ name: input.name, baseUrl }).where(eq(websites.id, input.id));
      clearWebsiteCache();
      return { success: true };
    }),

  remove: adminProcedure
    .input(z.object({ id: z.number().int() }))
    .mutation(async ({ input }) => {
      const db = await requireDb();
      const site = (await listWebsites(true)).find((w) => w.id === input.id);
      if (!site) throw new TRPCError({ code: "NOT_FOUND", message: "Website not found" });
      if (site.siteKey === CRM_SITE_KEY) throw new TRPCError({ code: "BAD_REQUEST", message: "The CRM's own site can't be removed" });
      const [{ n }] = await db
        .select({ n: sql<number>`count(*)` })
        .from(landingPages)
        .where(eq(landingPages.hostSite, site.siteKey));
      if (Number(n) > 0) {
        throw new TRPCError({ code: "BAD_REQUEST", message: `${Number(n)} landing page(s) are hosted on ${site.name}. Move them to another site first.` });
      }
      await db.delete(websites).where(eq(websites.id, input.id));
      clearWebsiteCache();
      return { success: true };
    }),
});
