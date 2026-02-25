import { z } from "zod";
import { adminProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { users } from "../../drizzle/schema";
import { eq, desc, sql, like, or } from "drizzle-orm";

export const userManagementRouter = router({
  // List all users with search/filter
  list: adminProcedure
    .input(
      z.object({
        search: z.string().optional(),
        role: z.enum(["all", "admin", "user"]).optional().default("all"),
      }).optional()
    )
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      const search = input?.search;
      const roleFilter = input?.role ?? "all";

      let query = db.select().from(users);

      const conditions: any[] = [];

      if (search && search.trim()) {
        const term = `%${search.trim()}%`;
        conditions.push(
          or(
            like(users.name, term),
            like(users.email, term),
            like(users.openId, term)
          )
        );
      }

      if (roleFilter !== "all") {
        conditions.push(eq(users.role, roleFilter));
      }

      if (conditions.length === 1) {
        return db.select().from(users).where(conditions[0]!).orderBy(desc(users.createdAt));
      }
      if (conditions.length === 2) {
        return db.select().from(users).where(sql`${conditions[0]} AND ${conditions[1]}`).orderBy(desc(users.createdAt));
      }

      return query.orderBy(desc(users.createdAt));
    }),

  // Get user count by role
  stats: adminProcedure.query(async () => {
    const db = await getDb();
    if (!db) return { total: 0, admins: 0, users: 0 };
    const [result] = await db
      .select({
        total: sql<number>`COUNT(*)`,
        admins: sql<number>`SUM(CASE WHEN role = 'admin' THEN 1 ELSE 0 END)`,
        users: sql<number>`SUM(CASE WHEN role = 'user' THEN 1 ELSE 0 END)`,
      })
      .from(users);
    return {
      total: Number(result?.total ?? 0),
      admins: Number(result?.admins ?? 0),
      users: Number(result?.users ?? 0),
    };
  }),

  // Update a user's role
  updateRole: adminProcedure
    .input(
      z.object({
        userId: z.number(),
        role: z.enum(["admin", "user"]),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");

      // Prevent demoting yourself
      if (input.userId === ctx.user.id && input.role === "user") {
        throw new Error("You cannot demote yourself from admin.");
      }

      await db
        .update(users)
        .set({ role: input.role })
        .where(eq(users.id, input.userId));

      return { success: true };
    }),

  // Deactivate a user (we'll use a soft approach - set role to a marker, or we can add an 'active' field)
  // For now, we'll add an isActive concept via the role - but better to keep it simple
  // Let's just provide role management for now since the schema has admin/user roles

  // Get a single user's details
  getUser: adminProcedure
    .input(z.object({ userId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return null;
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.id, input.userId))
        .limit(1);
      return user ?? null;
    }),
});
