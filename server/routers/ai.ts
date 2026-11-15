import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import { adminProcedure, protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { aiSettings } from "../../drizzle/schema";
import { ENV } from "../_core/env";
import { DEFAULT_MODELS, MODEL_CHOICES, getActiveAi, getAiSettings, testProvider, type AiProvider } from "../aiProvider";

export const aiRouter = router({
  /** Everything but the key, which only ever shows as a last-four hint. */
  getSettings: adminProcedure.query(async () => {
    const s = await getAiSettings();
    const provider = (s?.provider === "openai" ? "openai" : "anthropic") as AiProvider;
    return {
      configured: !!s?.apiKey,
      provider,
      model: s?.model || DEFAULT_MODELS[provider],
      keyHint: s?.apiKey ? `••••${s.apiKey.slice(-4)}` : "",
      enabled: s?.enabled ?? true,
      lastVerifiedAt: s?.lastVerifiedAt ?? null,
      lastError: s?.lastError ?? null,
      builtInAvailable: !!ENV.forgeApiKey,
      models: MODEL_CHOICES,
    };
  }),

  /** Whether AI features will work, for the screens that use them. */
  status: protectedProcedure.query(async () => {
    const active = await getActiveAi();
    return { connected: !!active || !!ENV.forgeApiKey, provider: active?.provider ?? (ENV.forgeApiKey ? "built-in" : null) };
  }),

  /** Save and test the key with a tiny request. A failed test saves nothing. */
  save: adminProcedure
    .input(z.object({
      provider: z.enum(["anthropic", "openai"]),
      /** Blank keeps the saved key (only when the provider is unchanged). */
      apiKey: z.string().trim().optional(),
      model: z.string().trim().min(1).max(128),
      enabled: z.boolean(),
    }))
    .mutation(async ({ input, ctx }) => {
      const existing = await getAiSettings();
      const sameProvider = existing?.provider === input.provider;
      const apiKey = input.apiKey || (sameProvider ? existing?.apiKey : "") || "";
      if (!apiKey) throw new TRPCError({ code: "BAD_REQUEST", message: "Paste the API key" });

      try {
        await testProvider({ provider: input.provider, apiKey, model: input.model });
      } catch (err) {
        throw new TRPCError({ code: "BAD_REQUEST", message: err instanceof Error ? err.message : String(err) });
      }

      const values = {
        provider: input.provider,
        apiKey,
        model: input.model,
        enabled: input.enabled,
        lastVerifiedAt: new Date(),
        lastError: null,
        updatedBy: ctx.user.id,
      };
      const db = await getDb();
      if (existing) await db.update(aiSettings).set(values).where(eq(aiSettings.id, existing.id));
      else await db.insert(aiSettings).values(values);
      return { success: true };
    }),

  setEnabled: adminProcedure
    .input(z.object({ enabled: z.boolean() }))
    .mutation(async ({ input }) => {
      const s = await getAiSettings();
      if (!s) throw new TRPCError({ code: "NOT_FOUND", message: "AI is not set up yet." });
      const db = await getDb();
      await db.update(aiSettings).set({ enabled: input.enabled }).where(eq(aiSettings.id, s.id));
      return { success: true };
    }),
});
