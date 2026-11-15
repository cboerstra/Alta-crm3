// The AI provider the CRM's AI features use (campaign drafting, lead scoring),
// set in Settings → AI. invokeLLM routes here when a key is saved and switched
// on; otherwise it falls back to the BUILT_IN_FORGE_* environment.

import Anthropic from "@anthropic-ai/sdk";
import { getDb } from "./db";
import { aiSettings, type AiSettings } from "../drizzle/schema";

export type AiProvider = "anthropic" | "openai";

export const DEFAULT_MODELS: Record<AiProvider, string> = {
  anthropic: "claude-opus-5-5",
  openai: "gpt-5",
};

export const MODEL_CHOICES: Record<AiProvider, { id: string; label: string }[]> = {
  anthropic: [
    { id: "claude-opus-5-5", label: "Claude Opus 5.5 (best quality)" },
    { id: "claude-sonnet-5-5", label: "Claude Sonnet 5.5 (faster, cheaper)" },
    { id: "claude-haiku-5-5", label: "Claude Haiku 5.5 (fastest, cheapest)" },
  ],
  openai: [
    { id: "gpt-5", label: "GPT-5" },
    { id: "gpt-5-mini", label: "GPT-5 mini" },
  ],
};

export async function getAiSettings(): Promise<AiSettings | null> {
  const db = await getDb();
  if (!db) return null;
  const [row] = await db.select().from(aiSettings).limit(1);
  return row ?? null;
}

export type ActiveAi = { provider: AiProvider; apiKey: string; model: string };

/** The saved provider, if it is switched on and has a key. */
export async function getActiveAi(): Promise<ActiveAi | null> {
  let s: AiSettings | null = null;
  try {
    s = await getAiSettings();
  } catch {
    return null; // table not there yet: fall back to the environment
  }
  if (!s?.enabled || !s.apiKey) return null;
  const provider = (s.provider === "openai" ? "openai" : "anthropic") as AiProvider;
  return { provider, apiKey: s.apiKey, model: s.model || DEFAULT_MODELS[provider] };
}

// ─── Shapes shared with server/_core/llm.ts (OpenAI chat-completions style) ──

type Part = { type: string; text?: string; image_url?: { url: string } };
export type ChatMessage = { role: string; content: string | Part[] };
export type JsonSchemaFormat = { type: "json_schema"; json_schema: { name: string; schema: Record<string, unknown> } };
export type ChatResult = {
  id: string;
  created: number;
  model: string;
  choices: Array<{ index: number; message: { role: "assistant"; content: string }; finish_reason: string | null }>;
};

function textOf(content: string | Part[]): string {
  return typeof content === "string" ? content : content.map((p) => p.text ?? "").join("\n");
}

function toResult(id: string, model: string, text: string, finish: string | null): ChatResult {
  return {
    id,
    created: Math.floor(Date.now() / 1000),
    model,
    choices: [{ index: 0, message: { role: "assistant", content: text }, finish_reason: finish }],
  };
}

// ─── Claude ──────────────────────────────────────────────────────────────────

async function callClaude(ai: ActiveAi, messages: ChatMessage[], format: JsonSchemaFormat | null, maxTokens: number): Promise<ChatResult> {
  const client = new Anthropic({ apiKey: ai.apiKey });
  const system = messages.filter((m) => m.role === "system").map((m) => textOf(m.content)).join("\n\n");
  const turns: Anthropic.MessageParam[] = messages
    .filter((m) => m.role === "user" || m.role === "assistant")
    .map((m) => {
      if (typeof m.content === "string") return { role: m.role as "user" | "assistant", content: m.content };
      const blocks: Anthropic.ContentBlockParam[] = [];
      for (const p of m.content) {
        if (p.type === "text" && p.text) blocks.push({ type: "text", text: p.text });
        else if (p.type === "image_url" && p.image_url?.url) blocks.push({ type: "image", source: { type: "url", url: p.image_url.url } });
      }
      return { role: m.role as "user" | "assistant", content: blocks };
    });

  try {
    const response = await client.messages.create({
      model: ai.model,
      max_tokens: maxTokens,
      ...(system ? { system } : {}),
      messages: turns,
      output_config: {
        effort: "medium",
        ...(format ? { format: { type: "json_schema" as const, schema: format.json_schema.schema } } : {}),
      },
    });
    if (response.stop_reason === "refusal") {
      throw new Error("Claude declined this request. Try rephrasing it.");
    }
    const text = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("");
    return toResult(response.id, response.model, text, response.stop_reason);
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError) throw new Error("Claude rejected the API key. Check it in Settings → AI.");
    if (err instanceof Anthropic.PermissionDeniedError) throw new Error("This Claude API key can't use that model. Pick another in Settings → AI.");
    if (err instanceof Anthropic.NotFoundError) throw new Error(`Claude doesn't recognize the model "${ai.model}". Pick another in Settings → AI.`);
    if (err instanceof Anthropic.RateLimitError) throw new Error("Claude is rate-limiting this key. Wait a minute and try again, or check the account's credit balance.");
    if (err instanceof Anthropic.APIError) throw new Error(`Claude error ${err.status ?? ""}: ${err.message}`);
    throw err;
  }
}

// ─── OpenAI ──────────────────────────────────────────────────────────────────

async function callOpenAI(ai: ActiveAi, messages: ChatMessage[], format: JsonSchemaFormat | null, maxTokens: number): Promise<ChatResult> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${ai.apiKey}` },
    body: JSON.stringify({
      model: ai.model,
      messages,
      max_completion_tokens: maxTokens,
      ...(format ? { response_format: format } : {}),
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    if (res.status === 401) throw new Error("OpenAI rejected the API key. Check it in Settings → AI.");
    if (res.status === 429) throw new Error("OpenAI is rate-limiting this key, or the account is out of credit.");
    throw new Error(`OpenAI error ${res.status}: ${body.slice(0, 300)}`);
  }
  const json = await res.json() as any;
  const choice = json.choices?.[0];
  return toResult(json.id, json.model, choice?.message?.content ?? "", choice?.finish_reason ?? null);
}

export async function callProvider(
  ai: ActiveAi,
  messages: ChatMessage[],
  format: JsonSchemaFormat | null,
  maxTokens = 16000,
): Promise<ChatResult> {
  return ai.provider === "openai"
    ? callOpenAI(ai, messages, format, maxTokens)
    : callClaude(ai, messages, format, maxTokens);
}

/** A tiny request, to check a key and model before saving them. */
export async function testProvider(ai: ActiveAi): Promise<void> {
  const r = await callProvider(ai, [{ role: "user", content: "Reply with the single word: ok" }], null, 1024);
  if (!r.choices[0]?.message.content) throw new Error("The AI answered with nothing. Try another model.");
}
