import crypto from "crypto";
import { SignJWT, jwtVerify } from "jose";
import { ENV } from "./_core/env";

// ─── TOTP (RFC 6238, SHA-1, 6 digits, 30s) ────────────────────────────────────
// Implemented on node:crypto so there is no extra dependency to audit.

const BASE32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const STEP_SECONDS = 30;
const DIGITS = 6;
/** Codes from the previous/next 30s window are accepted to absorb clock drift. */
const WINDOW = 1;

export function base32Encode(buf: Buffer): string {
  let bits = 0;
  let value = 0;
  let out = "";
  for (let i = 0; i < buf.length; i++) {
    value = (value << 8) | buf[i];
    bits += 8;
    while (bits >= 5) {
      out += BASE32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += BASE32[(value << (5 - bits)) & 31];
  return out;
}

export function base32Decode(str: string): Buffer {
  const clean = str.replace(/=+$/, "").replace(/\s+/g, "").toUpperCase();
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const ch of clean) {
    const idx = BASE32.indexOf(ch);
    if (idx === -1) throw new Error("Invalid base32 character");
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

export function generateSecret(): string {
  return base32Encode(crypto.randomBytes(20)); // 160 bits, per RFC 4226
}

function hotp(secret: Buffer, counter: number): string {
  const msg = Buffer.alloc(8);
  msg.writeBigUInt64BE(BigInt(counter));
  const hmac = crypto.createHmac("sha1", secret).update(msg).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const bin =
    ((hmac[offset] & 0x7f) << 24) |
    (hmac[offset + 1] << 16) |
    (hmac[offset + 2] << 8) |
    hmac[offset + 3];
  return String(bin % 10 ** DIGITS).padStart(DIGITS, "0");
}

export function totpAt(secretBase32: string, atMs: number): string {
  return hotp(base32Decode(secretBase32), Math.floor(atMs / 1000 / STEP_SECONDS));
}

/**
 * Check a 6-digit code. Returns the matching time step (so the caller can
 * refuse to accept the same step twice), or null when no step matches.
 * Only steps strictly newer than `lastUsedStep` are accepted.
 */
export function verifyTotp(
  secretBase32: string,
  code: string,
  lastUsedStep: number | null = null,
  nowMs: number = Date.now(),
): number | null {
  if (!/^\d{6}$/.test(code)) return null;
  const secret = base32Decode(secretBase32);
  const currentStep = Math.floor(nowMs / 1000 / STEP_SECONDS);
  let matched: number | null = null;
  for (let w = -WINDOW; w <= WINDOW; w++) {
    const step = currentStep + w;
    const expected = Buffer.from(hotp(secret, step));
    // Check every window (no early exit) so timing doesn't reveal which matched.
    if (crypto.timingSafeEqual(expected, Buffer.from(code)) && matched === null) {
      matched = step;
    }
  }
  if (matched === null) return null;
  if (lastUsedStep !== null && matched <= lastUsedStep) return null;
  return matched;
}

export function buildOtpAuthUri(secretBase32: string, accountEmail: string, issuer = "Alta CRM"): string {
  const label = `${encodeURIComponent(issuer)}:${encodeURIComponent(accountEmail)}`;
  const params = new URLSearchParams({
    secret: secretBase32,
    issuer,
    algorithm: "SHA1",
    digits: String(DIGITS),
    period: String(STEP_SECONDS),
  });
  return `otpauth://totp/${label}?${params.toString()}`;
}

// ─── Secret encryption (AES-256-GCM) ──────────────────────────────────────────
// Key: TWO_FACTOR_ENC_KEY (any string, hashed) if set, else derived from
// JWT_SECRET so existing installs work without a new env var. Set a dedicated
// TWO_FACTOR_ENC_KEY in production so rotating JWT_SECRET doesn't lock users out.

function encryptionKey(): Buffer {
  const material = process.env.TWO_FACTOR_ENC_KEY || ENV.cookieSecret;
  if (!material) throw new Error("No key material available for 2FA secret encryption");
  const salt = process.env.TWO_FACTOR_ENC_KEY ? "alta-crm-2fa-v1" : "alta-crm-2fa-v1-jwt";
  return crypto.createHash("sha256").update(salt).update(material).digest();
}

export function encryptSecret(plain: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1:${iv.toString("base64")}:${tag.toString("base64")}:${enc.toString("base64")}`;
}

export function decryptSecret(payload: string): string {
  const [version, ivB64, tagB64, dataB64] = payload.split(":");
  if (version !== "v1" || !ivB64 || !tagB64 || !dataB64) throw new Error("Unrecognised 2FA secret format");
  const decipher = crypto.createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(dataB64, "base64")), decipher.final()]).toString("utf8");
}

// ─── Backup codes ─────────────────────────────────────────────────────────────

const BACKUP_CODE_COUNT = 10;

/** Format: xxxxx-xxxxx (10 chars from a 32-symbol alphabet, ~50 bits). */
export function generateBackupCodes(): string[] {
  const alphabet = "abcdefghjkmnpqrstuvwxyz23456789"; // no ambiguous 0/o/1/l/i
  return Array.from({ length: BACKUP_CODE_COUNT }, () => {
    const bytes = crypto.randomBytes(10);
    let s = "";
    for (let i = 0; i < bytes.length; i++) s += alphabet[bytes[i] % alphabet.length];
    return `${s.slice(0, 5)}-${s.slice(5)}`;
  });
}

export function normalizeBackupCode(input: string): string {
  return input.trim().toLowerCase().replace(/[\s-]/g, "");
}

/** Keyed hash so a database leak alone can't be used to test guesses offline. */
export function hashBackupCode(code: string): string {
  const key = crypto.createHash("sha256").update("alta-crm-2fa-backup").update(process.env.TWO_FACTOR_ENC_KEY || ENV.cookieSecret).digest();
  return crypto.createHmac("sha256", key).update(normalizeBackupCode(code)).digest("hex");
}

/** If `input` matches an unused backup code, return the remaining hashes; otherwise null. */
export function consumeBackupCode(input: string, hashes: string[]): string[] | null {
  const candidate = Buffer.from(hashBackupCode(input), "hex");
  let matchIdx = -1;
  hashes.forEach((h, i) => {
    const hb = Buffer.from(h, "hex");
    if (hb.length === candidate.length && crypto.timingSafeEqual(hb, candidate) && matchIdx === -1) matchIdx = i;
  });
  if (matchIdx === -1) return null;
  return hashes.filter((_, i) => i !== matchIdx);
}

// ─── Rate limiting ────────────────────────────────────────────────────────────
// In-memory sliding window; the CRM runs as a single PM2 process. A restart
// clears it, which is acceptable because each pending-login token also expires
// after a few minutes and is bound to a single user.

type Bucket = { fails: number[]; lockedUntil: number };

export class AttemptLimiter {
  private buckets = new Map<string, Bucket>();
  constructor(
    private maxFails: number,
    private windowMs: number,
    private lockMs: number,
  ) {}

  /** Seconds the caller must wait, or 0 when allowed. */
  retryAfter(key: string, now = Date.now()): number {
    const b = this.buckets.get(key);
    if (!b || b.lockedUntil <= now) return 0;
    return Math.ceil((b.lockedUntil - now) / 1000);
  }

  fail(key: string, now = Date.now()) {
    const b = this.buckets.get(key) ?? { fails: [], lockedUntil: 0 };
    b.fails = b.fails.filter((t) => now - t < this.windowMs);
    b.fails.push(now);
    if (b.fails.length >= this.maxFails) {
      b.lockedUntil = now + this.lockMs;
      b.fails = [];
    }
    this.buckets.set(key, b);
    if (this.buckets.size > 5000) this.prune(now);
  }

  reset(key: string) {
    this.buckets.delete(key);
  }

  private prune(now: number) {
    this.buckets.forEach((b, k) => {
      if (b.lockedUntil <= now && b.fails.every((t: number) => now - t >= this.windowMs)) this.buckets.delete(k);
    });
  }
}

/** 5 wrong codes in 15 minutes locks that account's 2FA entry for 15 minutes. */
export const twoFactorLimiter = new AttemptLimiter(5, 15 * 60_000, 15 * 60_000);
/** Same policy per client IP, so one attacker can't walk through many accounts. */
export const twoFactorIpLimiter = new AttemptLimiter(20, 15 * 60_000, 15 * 60_000);

// ─── Pending-login token ──────────────────────────────────────────────────────
// After the password step for a 2FA user we hand back this short-lived token
// instead of a session cookie. It is signed with the same secret as sessions but
// carries `purpose: "2fa"` and no openId/appId/name, so sdk.verifySession rejects
// it and it can never act as a session.


const PENDING_TTL_SECONDS = 5 * 60;

export async function signPendingLogin(userId: number): Promise<string> {
  return new SignJWT({ purpose: "2fa", uid: userId })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setExpirationTime(Math.floor(Date.now() / 1000) + PENDING_TTL_SECONDS)
    .sign(new TextEncoder().encode(ENV.cookieSecret));
}

export async function verifyPendingLogin(token: string): Promise<number | null> {
  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(ENV.cookieSecret), { algorithms: ["HS256"] });
    if (payload.purpose !== "2fa" || typeof payload.uid !== "number") return null;
    return payload.uid;
  } catch {
    return null;
  }
}

// ─── Second-factor check (TOTP or backup code) ────────────────────────────────

export type SecondFactorResult = { ok: true; usedBackupCode: boolean } | { ok: false };

/**
 * Validate `code` against the user's enrolled factor. A TOTP step is accepted
 * once only; a backup code is consumed on use. Persists that state on success.
 */
export async function checkSecondFactor(
  row: { userId: number; secretEnc: string; backupCodeHashes: string[] | null; lastUsedStep: number | null },
  code: string,
  persist: (userId: number, patch: { backupCodeHashes?: string[]; lastUsedStep?: number }) => Promise<void>,
): Promise<SecondFactorResult> {
  const trimmed = code.trim();
  if (/^\d{6}$/.test(trimmed)) {
    const step = verifyTotp(decryptSecret(row.secretEnc), trimmed, row.lastUsedStep);
    if (step === null) return { ok: false };
    await persist(row.userId, { lastUsedStep: step });
    return { ok: true, usedBackupCode: false };
  }
  const remaining = consumeBackupCode(trimmed, row.backupCodeHashes ?? []);
  if (!remaining) return { ok: false };
  await persist(row.userId, { backupCodeHashes: remaining });
  return { ok: true, usedBackupCode: true };
}
