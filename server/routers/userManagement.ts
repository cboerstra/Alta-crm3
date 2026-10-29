import { z } from "zod";
import bcrypt from "bcrypt";
import { adminProcedure, router } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import { getDb, createInvite, listInvites, deleteInvite, deleteTwoFactor } from "../db";
import { users, pendingInvites, userTwoFactor } from "../../drizzle/schema";
import { eq, desc, sql, like, or } from "drizzle-orm";
import { nanoid } from "nanoid";

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

  // Which users have 2FA turned on (for a badge in the user list)
  twoFactorUserIds: adminProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [] as number[];
    const rows = await db.select({ userId: userTwoFactor.userId }).from(userTwoFactor).where(eq(userTwoFactor.enabled, true));
    return rows.map((r) => r.userId);
  }),

  // Lost phone AND backup codes: an admin can clear a user's 2FA so they can
  // sign in with just their password and re-enroll. Re-authenticates the admin.
  resetTwoFactor: adminProcedure
    .input(z.object({ userId: z.number(), adminPassword: z.string().min(1) }))
    .mutation(async ({ input, ctx }) => {
      if (!ctx.user.passwordHash || !(await bcrypt.compare(input.adminPassword, ctx.user.passwordHash))) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Incorrect password" });
      }
      if (input.userId === ctx.user.id) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Use Settings → Security to disable your own two-factor authentication." });
      }
      await deleteTwoFactor(input.userId);
      return { success: true };
    }),

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

  // Update a user's profile (name, email, phone, role, optional new password)
  updateUser: adminProcedure
    .input(
      z.object({
        userId: z.number(),
        name: z.string().min(1, "Name is required"),
        email: z.string().email("Invalid email"),
        phone: z.string().optional(),
        role: z.enum(["admin", "user"]),
        newPassword: z.string().min(6, "Password must be at least 6 characters").optional().or(z.literal("")),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");

      // Prevent self-demotion
      if (input.userId === ctx.user.id && input.role === "user") {
        throw new Error("You cannot demote yourself from admin.");
      }

      const updateData: Record<string, unknown> = {
        name: input.name,
        email: input.email,
        phone: input.phone || null,
        role: input.role,
      };

      if (input.newPassword && input.newPassword.trim().length >= 6) {
        updateData.passwordHash = await bcrypt.hash(input.newPassword, 12);
      }

      await db.update(users).set(updateData as any).where(eq(users.id, input.userId));
      return { success: true };
    }),

  // Remove a user from the system
  deleteUser: adminProcedure
    .input(z.object({ userId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      if (input.userId === ctx.user.id) throw new Error("You cannot delete your own account.");
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      await db.delete(users).where(eq(users.id, input.userId));
      return { success: true };
    }),

  // Create an invite for a new employee
  createInvite: adminProcedure
    .input(z.object({
      email: z.string().email(),
      name: z.string().min(1),
      role: z.enum(["admin", "user"]).default("user"),
    }))
    .mutation(async ({ input, ctx }) => {
      const token = nanoid(32);
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
      await createInvite({
        email: input.email,
        name: input.name,
        role: input.role,
        token,
        invitedBy: ctx.user.id,
        expiresAt,
      });
      return { token, expiresAt };
    }),

  // List all pending invites
  listInvites: adminProcedure.query(async () => {
    return listInvites();
  }),

  // Delete/revoke an invite
  deleteInvite: adminProcedure
    .input(z.object({ inviteId: z.number() }))
    .mutation(async ({ input }) => {
      await deleteInvite(input.inviteId);
      return { success: true };
    }),
});
