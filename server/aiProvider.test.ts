import { describe, it, expect, vi, beforeEach } from "vitest";

const create = vi.fn();
vi.mock("@anthropic-ai/sdk", () => {
  class APIError extends Error { status?: number }
  class Anthropic { messages = { create }; constructor(_: unknown) {} }
  Object.assign(Anthropic, {
    APIError,
    AuthenticationError: class extends APIError {},
    PermissionDeniedError: class extends APIError {},
    NotFoundError: class extends APIError {},
    RateLimitError: class extends APIError {},
  });
  return { default: Anthropic };
});
vi.mock("./db", () => ({ getDb: vi.fn() }));

import { callProvider } from "./aiProvider";

const ai = { provider: "anthropic" as const, apiKey: "k", model: "claude-opus-5-5" };

describe("callProvider (Claude)", () => {
  beforeEach(() => create.mockReset());

  it("moves system text out of messages and passes the JSON schema", async () => {
    create.mockResolvedValue({ id: "m1", model: "claude-opus-5-5", stop_reason: "end_turn", content: [{ type: "text", text: '{"score":5}' }] });
    const schema = { type: "object", properties: { score: { type: "integer" } }, required: ["score"], additionalProperties: false };
    const r = await callProvider(ai, [
      { role: "system", content: "Be brief" },
      { role: "user", content: "Score it" },
    ], { type: "json_schema", json_schema: { name: "s", schema } }, 4000);

    const req = create.mock.calls[0][0];
    expect(req.system).toBe("Be brief");
    expect(req.messages).toEqual([{ role: "user", content: "Score it" }]);
    expect(req.output_config.format).toEqual({ type: "json_schema", schema });
    expect(req.max_tokens).toBe(4000);
    expect(r.choices[0].message.content).toBe('{"score":5}');
  });

  it("reports a refusal instead of returning empty text", async () => {
    create.mockResolvedValue({ id: "m2", model: "x", stop_reason: "refusal", content: [] });
    await expect(callProvider(ai, [{ role: "user", content: "hi" }], null)).rejects.toThrow(/declined/);
  });
});
