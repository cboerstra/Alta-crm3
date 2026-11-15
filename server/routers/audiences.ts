import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { desc } from "drizzle-orm";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { metaAudiences } from "../../drizzle/schema";
import { getAdCampaigns } from "../marketingDb";
import { AudienceError, loadListMembers, removeAudience, syncAudience } from "../audienceSync";
import { hashMembers } from "../meta/audiences";

const LEAD_STAGES = [
  "new_lead", "registered", "attended", "no_show", "consultation_booked", "under_contract", "closed",
] as const;

const definitionSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("website"),
    days: z.number().int().min(1).max(180),
    landingPageSlug: z.string().trim().min(1).nullable().optional(),
    excludeConverters: z.boolean(),
  }),
  z.object({
    kind: z.literal("crm_list"),
    source: z.enum(["leads", "agents", "past_clients"]),
    stages: z.array(z.enum(LEAD_STAGES)).optional(),
    tag: z.string().trim().min(1).nullable().optional(),
  }),
]);

function toTrpc(err: unknown): never {
  if (err instanceof AudienceError) throw new TRPCError({ code: "BAD_REQUEST", message: err.message });
  throw err;
}

/** Audience ids an ad campaign includes or excludes, from its stored targeting. */
function audienceIdsOf(targeting: unknown): number[] {
  const t = (targeting ?? {}) as { includeAudienceIds?: unknown; excludeAudienceIds?: unknown };
  const ids = [t.includeAudienceIds, t.excludeAudienceIds].flatMap((v) => (Array.isArray(v) ? v : []));
  return ids.filter((v): v is number => typeof v === "number");
}

export const audiencesRouter = router({
  list: protectedProcedure.query(async () => {
    const db = await getDb();
    const [rows, campaigns] = await Promise.all([
      db.select().from(metaAudiences).orderBy(desc(metaAudiences.createdAt)),
      getAdCampaigns(),
    ]);
    return rows.map((row) => ({
      ...row,
      usedBy: campaigns.filter((c) => audienceIdsOf(c.targeting).includes(row.id)).map((c) => ({ id: c.id, name: c.name })),
    }));
  }),

  /** How many CRM contacts a list would upload, before creating it. */
  previewList: protectedProcedure
    .input(z.object({ source: z.enum(["leads", "agents", "past_clients"]), stages: z.array(z.enum(LEAD_STAGES)).optional(), tag: z.string().nullable().optional() }))
    .query(async ({ input }) => {
      const members = await loadListMembers({ kind: "crm_list", ...input });
      return { contacts: members.length, matchable: hashMembers(members).length };
    }),

  /** Create in the CRM and in Meta. A Meta failure leaves the row with its error, ready to retry. */
  create: protectedProcedure
    .input(z.object({ name: z.string().trim().min(1, "Name the audience").max(200), definition: definitionSchema }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      const [result] = await db.insert(metaAudiences).values({
        name: input.name,
        kind: input.definition.kind,
        definition: input.definition,
        createdBy: ctx.user.id,
      });
      const id = Number(result.insertId);
      try {
        return await syncAudience(id);
      } catch (err) {
        toTrpc(err);
      }
    }),

  sync: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      try {
        return await syncAudience(input.id);
      } catch (err) {
        toTrpc(err);
      }
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const campaigns = await getAdCampaigns();
      const users = campaigns.filter((c) => audienceIdsOf(c.targeting).includes(input.id));
      if (users.length) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Used by ${users.map((c) => c.name).join(", ")}. Remove it from those campaigns first.`,
        });
      }
      try {
        await removeAudience(input.id);
      } catch (err) {
        toTrpc(err);
      }
      return { success: true };
    }),
});
