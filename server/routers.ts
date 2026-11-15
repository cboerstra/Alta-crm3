import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import bcrypt from "bcrypt";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { getSessionCookieOptions } from "./_core/cookies";
import { ENV } from "./_core/env";
import { sdk } from "./_core/sdk";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import * as db from "./db";
import { twoFactorRouter } from "./routers/twoFactor";
import {
  checkSecondFactor,
  signPendingLogin,
  twoFactorIpLimiter,
  twoFactorLimiter,
  verifyPendingLogin,
} from "./twoFactor";
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
import { smsTemplatesRouter } from "./routers/smsTemplates";
import { applicationsRouter } from "./routers/applications";
import { adCampaignsRouter } from "./routers/adCampaigns";
import { templatesRouter } from "./routers/templates";
import { automationsRouter } from "./routers/automations";
import { marketingRouter } from "./routers/marketing";
import { payrollRouter } from "./routers/payroll";
import { agentContactsRouter } from "./routers/agentContacts";
import { bulkEmailRouter } from "./routers/bulkEmail";
import { campaignsRouter } from "./routers/campaigns";
import { mortgageClientsRouter } from "./routers/mortgageClients";

function clientIp(req: { headers: Record<string, string | string[] | undefined>; ip?: string }): string {
  const fwd = req.headers["x-forwarded-for"];
  const first = (Array.isArray(fwd) ? fwd[0] : fwd)?.split(",")[0]?.trim();
  return first || req.ip || "unknown";
}

/** Issue the session cookie once every required factor has passed. */
async function startSession(
  ctx: { req: Parameters<typeof getSessionCookieOptions>[0]; res: { cookie: (...args: any[]) => unknown } },
  user: { openId: string; name: string | null },
) {
  await db.upsertUser({ openId: user.openId, lastSignedIn: new Date() });
  const sessionToken = await sdk.signSession(
    { openId: user.openId, appId: ENV.appId || "standalone", name: user.name || "" },
    { expiresInMs: ONE_YEAR_MS }
  );
  const cookieOptions = getSessionCookieOptions(ctx.req);
  ctx.res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });
}

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
        // Password is right. If 2FA is on, do NOT issue a session yet — hand back
        // a short-lived pending token that only verifyTwoFactor accepts.
        const tf = await db.getTwoFactor(user.id);
        if (tf?.enabled) {
          return { success: true, twoFactorRequired: true, pendingToken: await signPendingLogin(user.id) } as const;
        }
        await startSession(ctx, user);
        return { success: true, twoFactorRequired: false, user } as const;
      }),
    // ── Second step of login for accounts with 2FA enabled ────────────────
    verifyTwoFactor: publicProcedure
      .input(z.object({ pendingToken: z.string().min(1), code: z.string().min(6).max(32) }))
      .mutation(async ({ input, ctx }) => {
        const userId = await verifyPendingLogin(input.pendingToken);
        if (userId === null) {
          throw new TRPCError({ code: "UNAUTHORIZED", message: "Your sign-in expired. Enter your password again." });
        }
        const userKey = `u:${userId}`;
        const ipKey = `ip:${clientIp(ctx.req)}`;
        const wait = Math.max(twoFactorLimiter.retryAfter(userKey), twoFactorIpLimiter.retryAfter(ipKey));
        if (wait > 0) {
          throw new TRPCError({
            code: "TOO_MANY_REQUESTS",
            message: `Too many incorrect codes. Try again in ${Math.ceil(wait / 60)} minute(s).`,
          });
        }
        const user = await db.getUserById(userId);
        const row = await db.getTwoFactor(userId);
        if (!user || !row?.enabled) {
          throw new TRPCError({ code: "UNAUTHORIZED", message: "Your sign-in expired. Enter your password again." });
        }
        const result = await checkSecondFactor(row, input.code, (id, patch) => db.updateTwoFactorState(id, patch));
        if (!result.ok) {
          twoFactorLimiter.fail(userKey);
          twoFactorIpLimiter.fail(ipKey);
          throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid authentication code" });
        }
        twoFactorLimiter.reset(userKey);
        await startSession(ctx, user);
        return {
          success: true,
          user,
          backupCodesRemaining: (await db.getTwoFactor(userId))?.backupCodeHashes?.length ?? 0,
          usedBackupCode: result.usedBackupCode,
        };
      }),
    twoFactor: twoFactorRouter,
    // ── Register first admin (only allowed when no users exist yet) ───────
    register: publicProcedure
      .input(z.object({
        name: z.string().min(1),
        email: z.string().email(),
        password: z.string().min(8, "Password must be at least 8 characters"),
      }))
      .mutation(async ({ input, ctx }) => {
        try {
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
          // Use direct insert instead of upsertUser so DB errors are not silently swallowed
          const user = await db.createUserWithPassword({
            openId,
            name: input.name,
            email: input.email,
            passwordHash,
            role: "admin",
          });
          const sessionToken = await sdk.signSession(
            { openId, appId: ENV.appId || "standalone", name: input.name },
            { expiresInMs: ONE_YEAR_MS }
          );
          const cookieOptions = getSessionCookieOptions(ctx.req);
          ctx.res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });
          return { success: true, userId: user.id };
        } catch (err) {
          if (err instanceof TRPCError) throw err;
          // Surface the real DB error message to help diagnose Hostinger issues
          const msg = err instanceof Error ? err.message : String(err);
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: `Failed to create account: ${msg}` });
        }
      }),
    // ── Set/change password for existing user (admin or self) ─────────────
    // Must be authenticated: it used to be public, which let anyone reset any
    // account's password and walk around both the password and 2FA.
    setPassword: protectedProcedure
      .input(z.object({ email: z.string().email(), password: z.string().min(8) }))
      .mutation(async ({ input, ctx }) => {
        const user = await db.getUserByEmail(input.email);
        if (!user) throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
        if (user.id !== ctx.user.id && ctx.user.role !== "admin") {
          throw new TRPCError({ code: "FORBIDDEN", message: "You can only change your own password" });
        }
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
  smsTemplates: smsTemplatesRouter,
  applications: applicationsRouter,
  adCampaigns: adCampaignsRouter,
  templates: templatesRouter,
  automations: automationsRouter,
  marketing: marketingRouter,
  payroll: payrollRouter,
  agentContacts: agentContactsRouter,
  bulkEmail: bulkEmailRouter,
  campaigns: campaignsRouter,
  mortgageClients: mortgageClientsRouter,
});

export type AppRouter = typeof appRouter;
