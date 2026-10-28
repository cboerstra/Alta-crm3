import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { agentContacts } from "../../drizzle/schema";
import { eq, like, or, and, desc, sql, inArray } from "drizzle-orm";
import { cleanTag } from "@shared/csv";

/** Stored tags as a clean array, whatever shape the JSON column returns. */
function tagList(value: unknown): string[] {
  let v = value;
  if (typeof v === "string") {
    try { v = JSON.parse(v); } catch { return []; }
  }
  return Array.isArray(v) ? v.filter((t): t is string => typeof t === "string") : [];
}

const tagSchema = z.string().transform(cleanTag).pipe(z.string().min(1, "Tag is empty"));

export const agentContactsRouter = router({
  list: protectedProcedure
    .input(z.object({
      search: z.string().optional(),
      brokerage: z.string().optional(),
      city: z.string().optional(),
      tag: z.string().optional(),
      optedOut: z.boolean().optional(),
      limit: z.number().default(50),
      offset: z.number().default(0),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      const conditions = [];

      if (input.search) {
        const s = `%${input.search}%`;
        conditions.push(or(
          like(agentContacts.firstName, s),
          like(agentContacts.lastName, s),
          like(agentContacts.email, s),
          like(agentContacts.brokerage, s),
        ));
      }
      if (input.brokerage) conditions.push(eq(agentContacts.brokerage, input.brokerage));
      if (input.city) conditions.push(eq(agentContacts.city, input.city));
      if (input.optedOut !== undefined) conditions.push(eq(agentContacts.optedOut, input.optedOut));
      if (input.tag) {
        conditions.push(sql`JSON_CONTAINS(${agentContacts.tags}, ${JSON.stringify(input.tag)}, '$')`);
      }

      const where = conditions.length > 0 ? and(...conditions) : undefined;

      const [rows, countResult] = await Promise.all([
        db.select().from(agentContacts).where(where)
          .orderBy(desc(agentContacts.createdAt))
          .limit(input.limit).offset(input.offset),
        db.select({ count: sql<number>`count(*)` }).from(agentContacts).where(where),
      ]);

      return { contacts: rows, total: countResult[0]?.count ?? 0 };
    }),

  getById: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      const rows = await db.select().from(agentContacts).where(eq(agentContacts.id, input.id)).limit(1);
      return rows[0] ?? null;
    }),

  create: protectedProcedure
    .input(z.object({
      firstName: z.string().min(1),
      lastName: z.string().min(1),
      email: z.string().email(),
      phone: z.string().optional(),
      brokerage: z.string().optional(),
      licenseNumber: z.string().optional(),
      city: z.string().optional(),
      state: z.string().max(2).default("UT"),
      tags: z.array(z.string()).optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      const result = await db.insert(agentContacts).values({
        ...input,
        tags: input.tags ?? [],
      });
      return { id: result[0].insertId };
    }),

  update: protectedProcedure
    .input(z.object({
      id: z.number(),
      firstName: z.string().optional(),
      lastName: z.string().optional(),
      email: z.string().email().optional(),
      phone: z.string().optional(),
      brokerage: z.string().optional(),
      licenseNumber: z.string().optional(),
      city: z.string().optional(),
      state: z.string().max(2).optional(),
      tags: z.array(z.string()).optional(),
      optedOut: z.boolean().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      const { id, ...data } = input;
      if (data.optedOut !== undefined) {
        // Opting back in clears the date, so "opted out on" never outlives the opt-out.
        (data as any).optOutDate = data.optedOut ? new Date() : null;
      }
      if (data.tags) data.tags = Array.from(new Set(data.tags.map(cleanTag).filter(Boolean)));
      await db.update(agentContacts).set(data).where(eq(agentContacts.id, id));
      return { success: true };
    }),

  /** Tag, untag, or opt in/out several contacts at once. */
  bulkUpdate: protectedProcedure
    .input(z.object({
      ids: z.array(z.number()).min(1).max(5000),
      addTag: tagSchema.optional(),
      removeTag: tagSchema.optional(),
      optedOut: z.boolean().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (input.optedOut !== undefined) {
        await db.update(agentContacts)
          .set({ optedOut: input.optedOut, optOutDate: input.optedOut ? new Date() : null })
          .where(inArray(agentContacts.id, input.ids));
      }
      if (input.addTag || input.removeTag) {
        const rows = await db.select({ id: agentContacts.id, tags: agentContacts.tags })
          .from(agentContacts).where(inArray(agentContacts.id, input.ids));
        for (const row of rows) {
          let tags = tagList(row.tags);
          if (input.addTag && !tags.includes(input.addTag)) tags = [...tags, input.addTag];
          if (input.removeTag) tags = tags.filter((t) => t !== input.removeTag);
          await db.update(agentContacts).set({ tags }).where(eq(agentContacts.id, row.id));
        }
      }
      return { updated: input.ids.length };
    }),

  /** Every tag in use, with how many contacts carry it. */
  tags: protectedProcedure.query(async () => {
    const db = await getDb();
    const rows = await db.select({ tags: agentContacts.tags }).from(agentContacts)
      .where(sql`${agentContacts.tags} IS NOT NULL`);
    const counts = new Map<string, number>();
    for (const row of rows) for (const tag of tagList(row.tags)) counts.set(tag, (counts.get(tag) ?? 0) + 1);
    return Array.from(counts, ([tag, count]) => ({ tag, count })).sort((a, b) => a.tag.localeCompare(b.tag));
  }),

  delete: protectedProcedure
    .input(z.object({ ids: z.array(z.number()).min(1) }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      for (const id of input.ids) {
        await db.delete(agentContacts).where(eq(agentContacts.id, id));
      }
      return { deleted: input.ids.length };
    }),

  importCsv: protectedProcedure
    .input(z.object({
      contacts: z.array(z.object({
        firstName: z.string(),
        lastName: z.string(),
        email: z.string().email(),
        phone: z.string().optional(),
        brokerage: z.string().optional(),
        licenseNumber: z.string().optional(),
        city: z.string().optional(),
        state: z.string().max(2).optional(),
        tags: z.array(z.string()).optional(),
      })),
      batchLabel: z.string().optional(),
      /** Applied to every contact in the file, including ones already on the list. */
      tag: tagSchema.optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      const batchId = (input.batchLabel || `import_${Date.now()}`).slice(0, 64);
      let imported = 0;
      let skipped = 0;
      let tagged = 0;

      for (const contact of input.contacts) {
        const existing = await db.select({ id: agentContacts.id, tags: agentContacts.tags })
          .from(agentContacts)
          .where(eq(agentContacts.email, contact.email))
          .limit(1);

        if (existing.length > 0) {
          skipped++;
          // Already on the list: leave their details alone, but do mark them,
          // or tagging an import would silently miss everyone you already had.
          const tags = tagList(existing[0].tags);
          if (input.tag && !tags.includes(input.tag)) {
            await db.update(agentContacts).set({ tags: [...tags, input.tag] })
              .where(eq(agentContacts.id, existing[0].id));
            tagged++;
          }
          continue;
        }

        const tags = Array.from(new Set([...(contact.tags ?? []).map(cleanTag), ...(input.tag ? [input.tag] : [])])).filter(Boolean);
        await db.insert(agentContacts).values({
          ...contact,
          state: contact.state || "UT",
          tags,
          importBatch: batchId,
        });
        imported++;
      }

      return { imported, skipped, tagged, batchId };
    }),

  brokerages: protectedProcedure.query(async () => {
    const db = await getDb();
    const rows = await db.selectDistinct({ brokerage: agentContacts.brokerage })
      .from(agentContacts)
      .where(sql`${agentContacts.brokerage} IS NOT NULL AND ${agentContacts.brokerage} != ''`)
      .orderBy(agentContacts.brokerage);
    return rows.map(r => r.brokerage).filter(Boolean) as string[];
  }),

  cities: protectedProcedure.query(async () => {
    const db = await getDb();
    const rows = await db.selectDistinct({ city: agentContacts.city })
      .from(agentContacts)
      .where(sql`${agentContacts.city} IS NOT NULL AND ${agentContacts.city} != ''`)
      .orderBy(agentContacts.city);
    return rows.map(r => r.city).filter(Boolean) as string[];
  }),

  stats: protectedProcedure.query(async () => {
    const db = await getDb();
    const [total] = await db.select({ count: sql<number>`count(*)` }).from(agentContacts);
    const [optedOut] = await db.select({ count: sql<number>`count(*)` }).from(agentContacts)
      .where(eq(agentContacts.optedOut, true));
    return {
      total: total?.count ?? 0,
      active: (total?.count ?? 0) - (optedOut?.count ?? 0),
      optedOut: optedOut?.count ?? 0,
    };
  }),
});
