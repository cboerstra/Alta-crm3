import { afterEach, describe, expect, it, vi } from "vitest";
import { createMetaAdCreative, uploadAdVideo } from "./meta/marketingApi";

const creds = { adAccountId: "act_1", accessToken: "t", pageId: "p1", instagramActorId: "ig1" } as any;
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const capabilityError = () => json(400, { error: { message: "(#3) Application does not have the capability to make this API call.", code: 3 } });

afterEach(() => vi.unstubAllGlobals());

describe("Meta permission fallbacks", () => {
  it("sends the video bytes when Meta won't fetch the file address", async () => {
    const calls: { url: string; body: unknown }[] = [];
    vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
      calls.push({ url: String(url), body: init?.body });
      if (calls.length === 1) return capabilityError();
      if (String(url).endsWith("reel.mp4")) return new Response(new Uint8Array([1, 2, 3]), { headers: { "content-type": "video/mp4" } });
      return json(200, { id: "vid9" });
    }));
    await expect(uploadAdVideo(creds, "https://crm.example/uploads/reel.mp4", "Reel")).resolves.toBe("vid9");
    expect(JSON.parse(calls[0].body as string)).toMatchObject({ file_url: "https://crm.example/uploads/reel.mp4" });
    expect(calls[2].body).toBeInstanceOf(FormData);
    expect((calls[2].body as FormData).get("source")).toBeInstanceOf(Blob);
  });

  it("retries the creative without the Instagram account on a permission error", async () => {
    const bodies: any[] = [];
    vi.stubGlobal("fetch", vi.fn(async (_url: string, init?: RequestInit) => {
      bodies.push(JSON.parse(init!.body as string));
      return bodies.length === 1 ? capabilityError() : json(200, { id: "cr1" });
    }));
    const res = await createMetaAdCreative(creds, {
      name: "x",
      creative: { primaryText: "Hi", destinationUrl: "https://a.b", imageHash: "h" },
    });
    expect(res.id).toBe("cr1");
    expect(bodies[0].object_story_spec.instagram_user_id).toBe("ig1");
    expect(bodies[1].object_story_spec.instagram_user_id).toBeUndefined();
  });

  it("does not retry other errors", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => json(400, { error: { message: "Invalid parameter", code: 100 } })));
    await expect(createMetaAdCreative(creds, {
      name: "x", creative: { primaryText: "Hi", destinationUrl: "https://a.b", imageHash: "h" },
    })).rejects.toThrow("Invalid parameter");
  });
});
