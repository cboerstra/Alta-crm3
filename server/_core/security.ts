import crypto from "crypto";
import type { NextFunction, Request, RequestHandler, Response } from "express";

/** Constant-time string comparison (safe for secrets of differing length). */
export function safeEqual(a: string, b: string): boolean {
  const ha = crypto.createHash("sha256").update(a).digest();
  const hb = crypto.createHash("sha256").update(b).digest();
  return crypto.timingSafeEqual(ha, hb);
}

/** Baseline security headers. Deliberately no CSP, which could break the app/landing pages. */
export const securityHeaders: RequestHandler = (req, res, next) => {
  res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  // Landing pages may be framed/proxied by partner sites; protect the staff app only.
  if (!req.path.startsWith("/lp/") && !req.path.startsWith("/uploads/")) {
    res.setHeader("X-Frame-Options", "SAMEORIGIN");
  }
  next();
};

/**
 * Uploaded files are served from the CRM's own origin. Sandbox them so an
 * uploaded SVG/HTML file cannot run script with the staff session's privileges
 * when opened directly. Images embedded via <img> are unaffected.
 */
export const sandboxUploads: RequestHandler = (_req, res, next) => {
  res.setHeader("Content-Security-Policy", "sandbox; default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'");
  res.setHeader("X-Content-Type-Options", "nosniff");
  next();
};

/** Small in-memory fixed-window rate limiter (per process; fine for a single Node instance). */
export function rateLimit(opts: {
  windowMs: number;
  max: number;
  key?: (req: Request) => string;
  methods?: string[];
}): RequestHandler {
  const hits = new Map<string, { count: number; resetAt: number }>();
  const keyFn = opts.key ?? ((req: Request) => req.ip ?? "unknown");
  setInterval(() => {
    const now = Date.now();
    hits.forEach((v, k) => { if (v.resetAt <= now) hits.delete(k); });
  }, Math.max(opts.windowMs, 60_000)).unref();

  return (req: Request, res: Response, next: NextFunction) => {
    if (opts.methods && !opts.methods.includes(req.method)) return next();
    const now = Date.now();
    const k = keyFn(req);
    const entry = hits.get(k);
    if (!entry || entry.resetAt <= now) {
      hits.set(k, { count: 1, resetAt: now + opts.windowMs });
      return next();
    }
    entry.count++;
    if (entry.count > opts.max) {
      res.setHeader("Retry-After", Math.ceil((entry.resetAt - now) / 1000));
      res.status(429).json({ error: "Too many attempts. Please try again later." });
      return;
    }
    next();
  };
}

/** Reject unauthenticated requests BEFORE any request body (e.g. multipart upload) is processed. */
export const requireSession: RequestHandler = async (req, res, next) => {
  try {
    const { sdk } = await import("./sdk");
    const user = await sdk.authenticateRequest(req as any);
    if (user?.id) return next();
  } catch {
    /* fall through to 401 */
  }
  res.status(401).json({ error: "Unauthorized" });
};
