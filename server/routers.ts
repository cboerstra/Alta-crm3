import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import bcrypt from "bcrypt";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { getSessionCookieOptions } from "./_core/cookies";
import { ENV } from "./_core/env";
import { sdk } from "./_core/sdk";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import * as db from "./db";
import { leadsRouter } from "./routers/leads";
import { webinarsRouter } from "./routers/webinars";
import { landingPagesRouter } from "./routers/landingPages";
import { dealsRouter } from "./routers/deals";
import { smsRouter } from "./routers/sms";
import { analyticsRouter } from "./routers/analytics";
import { schedulingRouter } from "./routers/scheduling";
import { integrationsRouter } from "./routers/integrations";
import { mediaRouter } from "./routers/media";
import { userManagementRouter } from "./routers/userManagement";

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
    // ── Email/password login (works without Manus OAuth) ──────────────────
    login: publicProcedure
      .input(z.object({ email: z.string().email(), password: z.string().min(1) }))
      .mutation(async ({ input, ctx }) => {
        const user = await db.getUserByEmail(input.email);
        if (!user || !user.passwordHash) {
          throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid email or password" });
        }
        const valid = await bcrypt.compare(input.password, user.passwordHash);
        if (!valid) {
          throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid email or password" });
        }
        await db.upsertUser({ openId: user.openId, lastSignedIn: new Date() });
        const sessionToken = await sdk.signSession(
          { openId: user.openId, appId: ENV.appId || "standalone", name: user.name || "" },
          { expiresInMs: ONE_YEAR_MS }
        );
        const cookieOptions = getSessionCookieOptions(ctx.req);
        ctx.res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });
        return { success: true, user };
      }),
    // ── Register first admin (only allowed when no users exist yet) ───────
    register: publicProcedure
      .input(z.object({
        name: z.string().min(1),
        email: z.string().email(),
        password: z.string().min(8, "Password must be at least 8 characters"),
      }))
      .mutation(async ({ input, ctx }) => {
        const allUsers = await db.getAllUsers();
        if (allUsers.length > 0) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Registration is closed. Contact your admin to create an account." });
        }
        const existing = await db.getUserByEmail(input.email);
        if (existing) {
          throw new TRPCError({ code: "CONFLICT", message: "An account with this email already exists" });
        }
        const passwordHash = await bcrypt.hash(input.password, 12);
        const openId = `local_${Date.now()}_${Math.random().toString(36).slice(2)}`;
        await db.upsertUser({
          openId,
          name: input.name,
          email: input.email,
          loginMethod: "email",
          role: "admin",
          lastSignedIn: new Date(),
        });
        const user = await db.getUserByEmail(input.email);
        if (!user) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to create user" });
        await db.updateUserPassword(user.id, passwordHash);
        const sessionToken = await sdk.signSession(
          { openId, appId: ENV.appId || "standalone", name: input.name },
          { expiresInMs: ONE_YEAR_MS }
        );
        const cookieOptions = getSessionCookieOptions(ctx.req);
        ctx.res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });
        return { success: true };
      }),
    // ── Set/change password for existing user (admin or self) ─────────────
    setPassword: publicProcedure
      .input(z.object({ email: z.string().email(), password: z.string().min(8) }))
      .mutation(async ({ input }) => {
        const user = await db.getUserByEmail(input.email);
        if (!user) throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
        const passwordHash = await bcrypt.hash(input.password, 12);
        await db.updateUserPassword(user.id, passwordHash);
        return { success: true };
      }),
  }),
  leads: leadsRouter,
  webinars: webinarsRouter,
  landingPages: landingPagesRouter,
  deals: dealsRouter,
  sms: smsRouter,
  analytics: analyticsRouter,
  scheduling: schedulingRouter,
  integrations: integrationsRouter,
  media: mediaRouter,
  userManagement: userManagementRouter,
});

export type AppRouter = typeof appRouter;
