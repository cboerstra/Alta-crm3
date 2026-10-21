import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { mortgageClients } from "../../drizzle/schema";
import { eq, like, or, and, desc, sql } from "drizzle-orm";

export const mortgageClientsRouter = router({
  list: protectedProcedure
    .input(z.object({
      search: z.string().optional(),
      city: z.string().optional(),
      loanType: z.string().optional(),
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
          like(mortgageClients.firstName, s),
          like(mortgageClients.lastName, s),
          like(mortgageClients.email, s),
          like(mortgageClients.address, s),
        ));
      }
      if (input.city) conditions.push(eq(mortgageClients.city, input.city));
      if (input.loanType) conditions.push(eq(mortgageClients.loanType, input.loanType));
      if (input.optedOut !== undefined) conditions.push(eq(mortgageClients.optedOut, input.optedOut));
      if (input.tag) {
        conditions.push(sql`JSON_CONTAINS(${mortgageClients.tags}, ${JSON.stringify(input.tag)}, '$')`);
      }

      const where = conditions.length > 0 ? and(...conditions) : undefined;

      const [rows, countResult] = await Promise.all([
        db.select().from(mortgageClients).where(where)
          .orderBy(desc(mortgageClients.createdAt))
          .limit(input.limit).offset(input.offset),
        db.select({ count: sql<number>`count(*)` }).from(mortgageClients).where(where),
      ]);

      return { clients: rows, total: countResult[0]?.count ?? 0 };
    }),

  getById: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      const rows = await db.select().from(mortgageClients).where(eq(mortgageClients.id, input.id)).limit(1);
      return rows[0] ?? null;
    }),

  create: protectedProcedure
    .input(z.object({
      firstName: z.string().min(1),
      lastName: z.string().min(1),
      email: z.string().email(),
      phone: z.string().optional(),
      address: z.string().optional(),
      city: z.string().optional(),
      state: z.string().max(2).default("UT"),
      zipCode: z.string().optional(),
      loanType: z.string().optional(),
      closingDate: z.string().optional(),
      loanAmount: z.string().optional(),
      tags: z.array(z.string()).optional(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      const { closingDate, ...rest } = input;
      const result = await db.insert(mortgageClients).values({
        ...rest,
        closingDate: closingDate ? new Date(closingDate) : null,
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
      address: z.string().optional(),
      city: z.string().optional(),
      state: z.string().max(2).optional(),
      zipCode: z.string().optional(),
      loanType: z.string().optional(),
      closingDate: z.string().nullable().optional(),
      loanAmount: z.string().nullable().optional(),
      tags: z.array(z.string()).optional(),
      notes: z.string().nullable().optional(),
      optedOut: z.boolean().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      const { id, closingDate, ...data } = input;
      const setData: any = { ...data };
      if (closingDate !== undefined) {
        setData.closingDate = closingDate ? new Date(closingDate) : null;
      }
      if (data.optedOut === true) {
        setData.optOutDate = new Date();
      }
      await db.update(mortgageClients).set(setData).where(eq(mortgageClients.id, id));
      return { success: true };
    }),

  delete: protectedProcedure
    .input(z.object({ ids: z.array(z.number()).min(1) }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      for (const id of input.ids) {
        await db.delete(mortgageClients).where(eq(mortgageClients.id, id));
      }
      return { deleted: input.ids.length };
    }),

  importCsv: protectedProcedure
    .input(z.object({
      clients: z.array(z.object({
        firstName: z.string(),
        lastName: z.string(),
        email: z.string().email(),
        phone: z.string().optional(),
        address: z.string().optional(),
        city: z.string().optional(),
        state: z.string().max(2).optional(),
        zipCode: z.string().optional(),
        loanType: z.string().optional(),
        closingDate: z.string().optional(),
        loanAmount: z.string().optional(),
        tags: z.array(z.string()).optional(),
        notes: z.string().optional(),
      })),
      batchLabel: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      const batchId = input.batchLabel || `import_${Date.now()}`;
      let imported = 0;
      let skipped = 0;

      for (const client of input.clients) {
        const existing = await db.select({ id: mortgageClients.id })
          .from(mortgageClients)
          .where(eq(mortgageClients.email, client.email))
          .limit(1);

        if (existing.length > 0) {
          skipped++;
          continue;
        }

        const { closingDate: cd, ...clientRest } = client;
        await db.insert(mortgageClients).values({
          ...clientRest,
          closingDate: cd ? new Date(cd) : null,
          state: client.state || "UT",
          tags: client.tags ?? [],
          importBatch: batchId,
        });
        imported++;
      }

      return { imported, skipped, batchId };
    }),

  cities: protectedProcedure.query(async () => {
    const db = await getDb();
    const rows = await db.selectDistinct({ city: mortgageClients.city })
      .from(mortgageClients)
      .where(sql`${mortgageClients.city} IS NOT NULL AND ${mortgageClients.city} != ''`)
      .orderBy(mortgageClients.city);
    return rows.map(r => r.city).filter(Boolean) as string[];
  }),

  loanTypes: protectedProcedure.query(async () => {
    const db = await getDb();
    const rows = await db.selectDistinct({ loanType: mortgageClients.loanType })
      .from(mortgageClients)
      .where(sql`${mortgageClients.loanType} IS NOT NULL AND ${mortgageClients.loanType} != ''`)
      .orderBy(mortgageClients.loanType);
    return rows.map(r => r.loanType).filter(Boolean) as string[];
  }),

  stats: protectedProcedure.query(async () => {
    const db = await getDb();
    const [total] = await db.select({ count: sql<number>`count(*)` }).from(mortgageClients);
    const [optedOut] = await db.select({ count: sql<number>`count(*)` }).from(mortgageClients)
      .where(eq(mortgageClients.optedOut, true));
    return {
      total: total?.count ?? 0,
      active: (total?.count ?? 0) - (optedOut?.count ?? 0),
      optedOut: optedOut?.count ?? 0,
    };
  }),
});
