import bcrypt from "bcrypt";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

// ── In-memory stand-in for the db module ────────────────────────────────────
const store = vi.hoisted(() => {
  process.env.JWT_SECRET = "test-secret-for-2fa-tests-0123456789"; // before ENV is read
  return { users: [] as any[], tf: new Map<number, any>() };
});

vi.mock("./db", () => ({
  getUserByEmail: async (email: string) => store.users.find((u) => u.email === email),
  getUserById: async (id: number) => store.users.find((u) => u.id === id) ?? null,
  upsertUser: async () => {},
  updateUserPassword: async (id: number, passwordHash: string) => {
    store.users.find((u) => u.id === id).passwordHash = passwordHash;
  },
  getTwoFactor: async (userId: number) => store.tf.get(userId) ?? null,
  saveTwoFactorPending: async (userId: number, secretEnc: string) => {
    store.tf.set(userId, { userId, secretEnc, enabled: false, backupCodeHashes: null, lastUsedStep: null });
  },
  enableTwoFactor: async (userId: number, backupCodeHashes: string[], lastUsedStep: number) => {
    Object.assign(store.tf.get(userId), { enabled: true, backupCodeHashes, lastUsedStep });
  },
  updateTwoFactorState: async (userId: number, patch: any) => {
    Object.assign(store.tf.get(userId), patch);
  },
  deleteTwoFactor: async (userId: number) => {
    store.tf.delete(userId);
  },
  getAllUsers: async () => store.users,
  getDb: async () => null,
}));

import { appRouter } from "./routers";
import {
  AttemptLimiter,
  base32Decode,
  base32Encode,
  decryptSecret,
  encryptSecret,
  generateBackupCodes,
  consumeBackupCode,
  hashBackupCode,
  signPendingLogin,
  totpAt,
  twoFactorIpLimiter,
  twoFactorLimiter,
  verifyTotp,
} from "./twoFactor";
import { sdk } from "./_core/sdk";

function makeCtx(user: any = null) {
  const cookies: Record<string, string> = {};
  const ctx = {
    user,
    req: { protocol: "https", headers: {}, ip: "203.0.113.9" },
    res: {
      cookie: (name: string, value: string) => {
        cookies[name] = value;
      },
      clearCookie: () => {},
    },
  } as unknown as TrpcContext;
  return { ctx, cookies };
}

async function seedUser() {
  const user = {
    id: 1,
    openId: "local_1",
    name: "Test Admin",
    email: "admin@example.com",
    role: "admin",
    passwordHash: await bcrypt.hash("correct-horse", 4),
  };
  store.users = [user];
  store.tf.clear();
  return user;
}

describe("TOTP primitives", () => {
  // RFC 6238 Appendix B, SHA-1 secret "12345678901234567890"; expected 8-digit
  // codes 94287082 (t=59) and 07081804 (t=1111111109), i.e. last 6 digits.
  const rfcSecret = base32Encode(Buffer.from("12345678901234567890"));

  it("matches the RFC 6238 test vectors", () => {
    expect(totpAt(rfcSecret, 59_000)).toBe("287082");
    expect(totpAt(rfcSecret, 1_111_111_109_000)).toBe("081804");
  });

  it("round-trips base32", () => {
    const raw = Buffer.from("hello-2fa-world!");
    expect(base32Decode(base32Encode(raw)).equals(raw)).toBe(true);
  });

  it("accepts the current and adjacent windows, rejects far ones", () => {
    const now = 1_700_000_000_000;
    expect(verifyTotp(rfcSecret, totpAt(rfcSecret, now), null, now)).not.toBeNull();
    expect(verifyTotp(rfcSecret, totpAt(rfcSecret, now - 30_000), null, now)).not.toBeNull();
    expect(verifyTotp(rfcSecret, totpAt(rfcSecret, now - 120_000), null, now)).toBeNull();
  });

  it("refuses to accept the same step twice (replay)", () => {
    const now = 1_700_000_000_000;
    const code = totpAt(rfcSecret, now);
    const step = verifyTotp(rfcSecret, code, null, now)!;
    expect(verifyTotp(rfcSecret, code, step, now)).toBeNull();
  });

  it("rejects malformed codes", () => {
    expect(verifyTotp(rfcSecret, "12345")).toBeNull();
    expect(verifyTotp(rfcSecret, "abcdef")).toBeNull();
  });
});

describe("secret storage and backup codes", () => {
  it("encrypts secrets, never storing plaintext, and detects tampering", () => {
    const enc = encryptSecret("JBSWY3DPEHPK3PXP");
    expect(enc).not.toContain("JBSWY3DPEHPK3PXP");
    expect(decryptSecret(enc)).toBe("JBSWY3DPEHPK3PXP");
    const tampered = enc.slice(0, -4) + (enc.endsWith("AAAA") ? "BBBB" : "AAAA");
    expect(() => decryptSecret(tampered)).toThrow();
  });

  it("makes 10 unique codes that are single-use and format-insensitive", () => {
    const codes = generateBackupCodes();
    expect(new Set(codes).size).toBe(10);
    const hashes = codes.map(hashBackupCode);
    const left = consumeBackupCode(codes[3].toUpperCase().replace("-", " "), hashes)!;
    expect(left).toHaveLength(9);
    expect(consumeBackupCode(codes[3], left)).toBeNull();
    expect(consumeBackupCode("zzzzz-zzzzz", hashes)).toBeNull();
  });
});

describe("AttemptLimiter", () => {
  it("locks after the limit and unlocks after the lock period", () => {
    const l = new AttemptLimiter(3, 1000, 5000);
    for (let i = 0; i < 3; i++) l.fail("k", 0);
    expect(l.retryAfter("k", 100)).toBeGreaterThan(0);
    expect(l.retryAfter("k", 6000)).toBe(0);
  });
});

describe("login flow with 2FA", () => {
  beforeEach(async () => {
    twoFactorLimiter.reset("u:1");
    twoFactorIpLimiter.reset("ip:203.0.113.9");
    await seedUser();
  });

  async function enroll() {
    const { ctx } = makeCtx(store.users[0]);
    const caller = appRouter.createCaller(ctx);
    const setup = await caller.auth.twoFactor.beginSetup({ password: "correct-horse" });
    const { backupCodes } = await caller.auth.twoFactor.confirmSetup({ code: totpAt(setup.secret, Date.now()) });
    return { secret: setup.secret, backupCodes, caller };
  }

  it("without 2FA, password login sets the session immediately", async () => {
    const { ctx, cookies } = makeCtx();
    const res = await appRouter.createCaller(ctx).auth.login({ email: "admin@example.com", password: "correct-horse" });
    expect(res.twoFactorRequired).toBe(false);
    expect(cookies.app_session_id).toBeTruthy();
  });

  it("enrollment needs the password, shows a QR, and stores only ciphertext", async () => {
    const { ctx } = makeCtx(store.users[0]);
    const caller = appRouter.createCaller(ctx);
    await expect(caller.auth.twoFactor.beginSetup({ password: "wrong" })).rejects.toThrow(/Incorrect password/);
    const setup = await caller.auth.twoFactor.beginSetup({ password: "correct-horse" });
    expect(setup.qrDataUrl.startsWith("data:image/png;base64,")).toBe(true);
    expect(setup.uri).toContain("otpauth://totp/");
    expect(store.tf.get(1).secretEnc).not.toContain(setup.secret);
    // not enabled until a code is confirmed
    expect((await caller.auth.twoFactor.status()).enabled).toBe(false);
    await expect(caller.auth.twoFactor.confirmSetup({ code: "000000" })).rejects.toThrow();
  });

  it("with 2FA on, the password step issues NO session, only a pending token", async () => {
    const { secret } = await enroll();
    const { ctx, cookies } = makeCtx();
    const res: any = await appRouter.createCaller(ctx).auth.login({ email: "admin@example.com", password: "correct-horse" });
    expect(res.twoFactorRequired).toBe(true);
    expect(res.user).toBeUndefined();
    expect(cookies.app_session_id).toBeUndefined();
    // the pending token is not a valid session
    expect(await sdk.verifySession(res.pendingToken)).toBeNull();

    // wrong code: no session
    await expect(appRouter.createCaller(ctx).auth.verifyTwoFactor({ pendingToken: res.pendingToken, code: "000000" })).rejects.toThrow(/Invalid authentication code/);
    expect(cookies.app_session_id).toBeUndefined();

    // right code (next step, since enrollment consumed the current one): session issued
    const code = totpAt(secret, Date.now() + 30_000);
    const ok = await appRouter.createCaller(ctx).auth.verifyTwoFactor({ pendingToken: res.pendingToken, code });
    expect(ok.success).toBe(true);
    expect(cookies.app_session_id).toBeTruthy();
    expect((await sdk.verifySession(cookies.app_session_id))?.openId).toBe("local_1");
  });

  it("a backup code works once", async () => {
    const { backupCodes } = await enroll();
    const login = async () => {
      const { ctx, cookies } = makeCtx();
      const r: any = await appRouter.createCaller(ctx).auth.login({ email: "admin@example.com", password: "correct-horse" });
      return { ctx, cookies, token: r.pendingToken as string };
    };
    const a = await login();
    const ok = await appRouter.createCaller(a.ctx).auth.verifyTwoFactor({ pendingToken: a.token, code: backupCodes[0] });
    expect(ok.usedBackupCode).toBe(true);
    expect(ok.backupCodesRemaining).toBe(9);
    const b = await login();
    await expect(appRouter.createCaller(b.ctx).auth.verifyTwoFactor({ pendingToken: b.token, code: backupCodes[0] })).rejects.toThrow(/Invalid/);
  });

  it("rate-limits repeated wrong codes, even a correct one afterwards", async () => {
    const { secret } = await enroll();
    const { ctx, cookies } = makeCtx();
    const { pendingToken }: any = await appRouter.createCaller(ctx).auth.login({ email: "admin@example.com", password: "correct-horse" });
    const verify = (code: string) => appRouter.createCaller(ctx).auth.verifyTwoFactor({ pendingToken, code });
    for (let i = 0; i < 5; i++) await expect(verify("111111")).rejects.toThrow(/Invalid/);
    await expect(verify(totpAt(secret, Date.now() + 30_000))).rejects.toThrow(/Too many/);
    expect(cookies.app_session_id).toBeUndefined();
  });

  it("rejects an expired/forged pending token", async () => {
    await enroll();
    const { ctx } = makeCtx();
    await expect(appRouter.createCaller(ctx).auth.verifyTwoFactor({ pendingToken: "garbage", code: "123456" })).rejects.toThrow(/expired/);
    const forgedForOther = await signPendingLogin(999);
    await expect(appRouter.createCaller(ctx).auth.verifyTwoFactor({ pendingToken: forgedForOther, code: "123456" })).rejects.toThrow(/expired/);
  });

  it("disable and backup-code regeneration require password + a valid code", async () => {
    const { secret, backupCodes, caller } = await enroll();
    await expect(caller.auth.twoFactor.disable({ password: "wrong", code: backupCodes[1] })).rejects.toThrow(/Incorrect password/);
    const regen = await caller.auth.twoFactor.regenerateBackupCodes({ password: "correct-horse", code: backupCodes[1] });
    expect(regen.backupCodes).toHaveLength(10);
    // the old set is gone
    await expect(caller.auth.twoFactor.disable({ password: "correct-horse", code: backupCodes[2] })).rejects.toThrow(/Invalid/);
    await caller.auth.twoFactor.disable({ password: "correct-horse", code: regen.backupCodes[0] });
    expect((await caller.auth.twoFactor.status()).enabled).toBe(false);
    void secret;
  });

  it("setPassword is no longer callable anonymously or on other accounts", async () => {
    const { ctx } = makeCtx();
    await expect(appRouter.createCaller(ctx).auth.setPassword({ email: "admin@example.com", password: "hacked-pass-1" })).rejects.toThrow();
    store.users.push({ id: 2, openId: "local_2", name: "Bob", email: "bob@example.com", role: "user", passwordHash: "x" });
    const { ctx: bobCtx } = makeCtx(store.users[1]);
    await expect(appRouter.createCaller(bobCtx).auth.setPassword({ email: "admin@example.com", password: "hacked-pass-1" })).rejects.toThrow(/only change your own/);
  });
});
