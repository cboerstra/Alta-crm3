import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import { adminProcedure, protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { bulkEmailSettings } from "../../drizzle/schema";
import {
  bulkUsage, createBulkTransport, getBulkEmailSettings, isUsable, remainingToday,
} from "../bulkEmail";

function errorText(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  if (/535|auth|Invalid login|Username and Password/i.test(msg)) {
    return "The server rejected the login. Check the SMTP login and key (in Brevo: SMTP & API → SMTP).";
  }
  if (/ENOTFOUND|EAI_AGAIN/i.test(msg)) return "That SMTP server name could not be found. Check the server address.";
  if (/ETIMEDOUT|ECONNREFUSED|ECONNRESET|Timeout/i.test(msg)) {
    return "The SMTP server didn't respond. Check the server address and port (Brevo: smtp-relay.brevo.com, 587) and the login.";
  }
  return msg;
}

export const bulkEmailRouter = router({
  /** Everything but the SMTP key, which only ever shows as a last-four hint. */
  getSettings: adminProcedure.query(async () => {
    const s = await getBulkEmailSettings();
    return {
      configured: !!s,
      host: s?.host ?? "smtp-relay.brevo.com",
      port: s?.port ?? 587,
      username: s?.username ?? "",
      passwordHint: s?.password ? `••••${s.password.slice(-4)}` : "",
      fromEmail: s?.fromEmail ?? "",
      fromName: s?.fromName ?? "",
      replyTo: s?.replyTo ?? "",
      dailyLimit: s?.dailyLimit ?? 290,
      enabled: s?.enabled ?? false,
      lastVerifiedAt: s?.lastVerifiedAt ?? null,
      lastError: s?.lastError ?? null,
    };
  }),

  /** Save and check the login against the server. A failed check saves nothing. */
  save: adminProcedure
    .input(z.object({
      host: z.string().trim().min(1, "Enter the SMTP server"),
      port: z.number().int().min(1).max(65535),
      username: z.string().trim().min(1, "Enter the SMTP login"),
      /** Blank keeps the saved key. */
      password: z.string().trim().optional(),
      fromEmail: z.string().trim().email("Enter the address emails come from"),
      fromName: z.string().trim().max(128).optional(),
      replyTo: z.union([z.literal(""), z.string().trim().email("Enter a valid reply-to address")]).optional(),
      dailyLimit: z.number().int().min(1).max(100000),
      enabled: z.boolean(),
    }))
    .mutation(async ({ input, ctx }) => {
      const existing = await getBulkEmailSettings();
      const password = input.password || existing?.password || "";
      if (!password) throw new TRPCError({ code: "BAD_REQUEST", message: "Enter the SMTP key" });

      try {
        await createBulkTransport({ host: input.host, port: input.port, username: input.username, password }).verify();
      } catch (err) {
        throw new TRPCError({ code: "BAD_REQUEST", message: errorText(err) });
      }

      const values = {
        host: input.host,
        port: input.port,
        username: input.username,
        password,
        fromEmail: input.fromEmail.toLowerCase(),
        fromName: input.fromName || null,
        replyTo: input.replyTo || null,
        dailyLimit: input.dailyLimit,
        enabled: input.enabled,
        lastVerifiedAt: new Date(),
        lastError: null,
        updatedBy: ctx.user.id,
      };
      const db = await getDb();
      if (existing) await db.update(bulkEmailSettings).set(values).where(eq(bulkEmailSettings.id, existing.id));
      else await db.insert(bulkEmailSettings).values(values);
      return { success: true };
    }),

  setEnabled: adminProcedure
    .input(z.object({ enabled: z.boolean() }))
    .mutation(async ({ input }) => {
      const s = await getBulkEmailSettings();
      if (!s) throw new TRPCError({ code: "NOT_FOUND", message: "Bulk email is not set up yet." });
      const db = await getDb();
      await db.update(bulkEmailSettings).set({ enabled: input.enabled }).where(eq(bulkEmailSettings.id, s.id));
      return { success: true };
    }),

  /** One real email through the relay, so the From domain and inbox placement can be seen. */
  sendTest: adminProcedure
    .input(z.object({ to: z.string().email("Enter a valid address") }))
    .mutation(async ({ input }) => {
      const s = await getBulkEmailSettings();
      if (!s?.host || !s.username || !s.password || !s.fromEmail) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Save the SMTP settings first." });
      }
      const transporter = createBulkTransport({ host: s.host, port: s.port, username: s.username, password: s.password });
      try {
        await transporter.sendMail({
          from: s.fromName ? `${s.fromName} <${s.fromEmail}>` : s.fromEmail,
          replyTo: s.replyTo || undefined,
          to: input.to,
          subject: "Test from your CRM's bulk email sender",
          html: `<p>This came through your bulk email sender (${s.host}) from <strong>${s.fromEmail}</strong>.</p>` +
            `<p>If it landed in spam, check the domain's SPF and DKIM records in your sender's dashboard.</p>`,
        });
      } catch (err) {
        const message = errorText(err);
        const db = await getDb();
        await db.update(bulkEmailSettings).set({ lastError: message }).where(eq(bulkEmailSettings.id, s.id));
        throw new TRPCError({ code: "BAD_REQUEST", message });
      } finally {
        transporter.close();
      }
      return { success: true };
    }),

  /** Today's pace, for the campaign screens. */
  usage: protectedProcedure.query(async () => {
    const s = await getBulkEmailSettings();
    if (!isUsable(s)) return { active: false as const };
    const usage = await bulkUsage();
    const { remaining, nextSlotAt } = remainingToday(usage, s.dailyLimit);
    return { active: true as const, fromEmail: s.fromEmail, dailyLimit: s.dailyLimit, sentLast24h: usage.sent, remaining, nextSlotAt };
  }),
});
