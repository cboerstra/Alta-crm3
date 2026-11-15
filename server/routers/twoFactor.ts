import { TRPCError } from "@trpc/server";
import bcrypt from "bcrypt";
import QRCode from "qrcode";
import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import * as db from "../db";
import {
  buildOtpAuthUri,
  checkSecondFactor,
  decryptSecret,
  encryptSecret,
  generateBackupCodes,
  generateSecret,
  hashBackupCode,
  twoFactorLimiter,
  verifyTotp,
} from "../twoFactor";

async function requirePassword(user: { passwordHash: string | null }, password: string) {
  if (!user.passwordHash || !(await bcrypt.compare(password, user.passwordHash))) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "Incorrect password" });
  }
}

function throttled(key: string) {
  const wait = twoFactorLimiter.retryAfter(key);
  if (wait > 0) {
    throw new TRPCError({
      code: "TOO_MANY_REQUESTS",
      message: `Too many incorrect codes. Try again in ${Math.ceil(wait / 60)} minute(s).`,
    });
  }
}

/** Re-authenticate: current password plus a valid TOTP/backup code. */
async function requireReauth(user: { id: number; passwordHash: string | null }, password: string, code: string) {
  const key = `u:${user.id}`;
  throttled(key);
  await requirePassword(user, password);
  const row = await db.getTwoFactor(user.id);
  if (!row?.enabled) throw new TRPCError({ code: "BAD_REQUEST", message: "Two-factor authentication is not enabled" });
  const result = await checkSecondFactor(row, code, (id, patch) => db.updateTwoFactorState(id, patch));
  if (!result.ok) {
    twoFactorLimiter.fail(key);
    throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid authentication code" });
  }
  twoFactorLimiter.reset(key);
}

export const twoFactorRouter = router({
  status: protectedProcedure.query(async ({ ctx }) => {
    const row = await db.getTwoFactor(ctx.user.id);
    return {
      enabled: !!row?.enabled,
      backupCodesRemaining: row?.enabled ? (row.backupCodeHashes ?? []).length : 0,
    };
  }),

  // Step 1 of enrollment: needs the password. Stores an unconfirmed secret and
  // returns it (plus a QR code) exactly once for the authenticator app.
  beginSetup: protectedProcedure
    .input(z.object({ password: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.user.email) throw new TRPCError({ code: "BAD_REQUEST", message: "Your account has no email address" });
      await requirePassword(ctx.user, input.password);
      const existing = await db.getTwoFactor(ctx.user.id);
      if (existing?.enabled) {
        throw new TRPCError({ code: "CONFLICT", message: "Two-factor authentication is already enabled. Disable it first to re-enroll." });
      }
      const secret = generateSecret();
      await db.saveTwoFactorPending(ctx.user.id, encryptSecret(secret));
      const uri = buildOtpAuthUri(secret, ctx.user.email);
      const qrDataUrl = await QRCode.toDataURL(uri, { margin: 1, width: 224 });
      return { secret, uri, qrDataUrl };
    }),

  // Step 2: prove the app works by entering a code, then receive backup codes (shown once).
  confirmSetup: protectedProcedure
    .input(z.object({ code: z.string().regex(/^\d{6}$/, "Enter the 6-digit code") }))
    .mutation(async ({ ctx, input }) => {
      const key = `u:${ctx.user.id}`;
      throttled(key);
      const row = await db.getTwoFactor(ctx.user.id);
      if (!row || row.enabled) throw new TRPCError({ code: "BAD_REQUEST", message: "No enrollment in progress" });
      const step = verifyTotp(decryptSecret(row.secretEnc), input.code);
      if (step === null) {
        twoFactorLimiter.fail(key);
        throw new TRPCError({ code: "UNAUTHORIZED", message: "That code didn't match. Check your phone's clock and try again." });
      }
      twoFactorLimiter.reset(key);
      const backupCodes = generateBackupCodes();
      await db.enableTwoFactor(ctx.user.id, backupCodes.map(hashBackupCode), step);
      return { backupCodes };
    }),

  disable: protectedProcedure
    .input(z.object({ password: z.string().min(1), code: z.string().min(6) }))
    .mutation(async ({ ctx, input }) => {
      await requireReauth(ctx.user, input.password, input.code);
      await db.deleteTwoFactor(ctx.user.id);
      return { success: true } as const;
    }),

  regenerateBackupCodes: protectedProcedure
    .input(z.object({ password: z.string().min(1), code: z.string().min(6) }))
    .mutation(async ({ ctx, input }) => {
      await requireReauth(ctx.user, input.password, input.code);
      const backupCodes = generateBackupCodes();
      await db.updateTwoFactorState(ctx.user.id, { backupCodeHashes: backupCodes.map(hashBackupCode) });
      return { backupCodes };
    }),
});
