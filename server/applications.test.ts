// The applications router and the MISMO download route, with the website
// stubbed at the fetch boundary. Nothing here touches the network or the
// CRM database.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Express, Request, Response } from "express";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import { registerDocumentDownloadRoute, registerMismoDownloadRoute } from "./websiteStaffApi";

vi.mock("./_core/sdk", () => ({
  sdk: { authenticateRequest: vi.fn() },
}));
import { sdk } from "./_core/sdk";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function mockUser(overrides?: Partial<AuthenticatedUser>): AuthenticatedUser {
  return {
    id: 2,
    openId: "test-user-002",
    email: "officer@alta.test",
    name: "Loan Officer",
    loginMethod: "manus",
    role: "user",
    schedulingSlug: null,
    avatarUrl: null,
    phone: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
    ...overrides,
  };
}

function ctx(user: AuthenticatedUser | null): TrpcContext {
  return {
    user,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: vi.fn() } as unknown as TrpcContext["res"],
  };
}

function jsonResponse(status: number, body: unknown, headers: Record<string, string> = {}): globalThis.Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...headers },
  });
}

const savedEnv: Record<string, string | undefined> = {};

beforeEach(() => {
  for (const k of ["WEBSITE_STAFF_API_URL", "WEBSITE_STAFF_API_KEY"]) {
    savedEnv[k] = process.env[k];
    delete process.env[k];
  }
});

afterEach(() => {
  for (const [k, v] of Object.entries(savedEnv)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

function configure() {
  process.env.WEBSITE_STAFF_API_URL = "https://site.test/api/staff";
  process.env.WEBSITE_STAFF_API_KEY = "shared-key";
}

describe("applications router", () => {
  it("refuses every procedure without a session", async () => {
    const caller = appRouter.createCaller(ctx(null));
    await expect(caller.applications.documents({ refNumber: "ALT-AAAAA" })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(caller.applications.status()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(caller.applications.list({})).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(caller.applications.get({ refNumber: "ALT-AAAAA" })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(caller.applications.drafts({})).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("reports not configured without calling the website", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const caller = appRouter.createCaller(ctx(mockUser()));

    expect(await caller.applications.status()).toEqual({ configured: false });
    await expect(caller.applications.list({})).rejects.toMatchObject({
      code: "SERVICE_UNAVAILABLE",
      message: expect.stringContaining("WEBSITE_STAFF_API_URL"),
    });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("sends the key as a bearer token and passes the query through", async () => {
    configure();
    const page = { items: [], total: 0, page: 2, pageSize: 50 };
    const fetchSpy = vi.fn().mockResolvedValue(jsonResponse(200, page));
    vi.stubGlobal("fetch", fetchSpy);

    const caller = appRouter.createCaller(ctx(mockUser()));
    expect(await caller.applications.list({ q: "dana@example.test", page: 2 })).toEqual(page);

    const [url, init] = fetchSpy.mock.calls[0] as [URL, RequestInit];
    expect(url.toString()).toBe("https://site.test/api/staff/applications?q=dana%40example.test&page=2");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer shared-key");
  });

  it("surfaces the website's own reason when its database is down", async () => {
    configure();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(503, { error: "Database not configured or unreachable" })));
    const caller = appRouter.createCaller(ctx(mockUser()));
    await expect(caller.applications.list({})).rejects.toMatchObject({
      code: "SERVICE_UNAVAILABLE",
      message: "Database not configured or unreachable",
    });
  });

  it("maps an unknown reference to NOT_FOUND", async () => {
    configure();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(404, { error: "Not found" })));
    const caller = appRouter.createCaller(ctx(mockUser()));
    await expect(caller.applications.get({ refNumber: "ALT-ZZZZZ" })).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("rejects a malformed reference before any network call", async () => {
    configure();
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const caller = appRouter.createCaller(ctx(mockUser()));
    await expect(caller.applications.get({ refNumber: "../etc" })).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("explains an unreachable website instead of a bare failure", async () => {
    configure();
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("fetch failed")));
    const caller = appRouter.createCaller(ctx(mockUser()));
    await expect(caller.applications.drafts({})).rejects.toMatchObject({
      code: "BAD_GATEWAY",
      message: expect.stringContaining("Could not reach website"),
    });
  });
});

describe("GET /api/applications/:ref/mismo", () => {
  type Handler = (req: Request, res: Response) => Promise<void>;
  let handler: Handler;

  beforeEach(() => {
    const app = { get: vi.fn((_path: string, h: Handler) => { handler = h; }) } as unknown as Express;
    registerMismoDownloadRoute(app);
  });

  function fakeRes() {
    const res = {
      statusCode: 200,
      headers: {} as Record<string, string>,
      body: undefined as unknown,
      status(code: number) { this.statusCode = code; return this; },
      set(h: Record<string, string>) { Object.assign(this.headers, h); return this; },
      json(b: unknown) { this.body = b; return this; },
      send(b: unknown) { this.body = b; return this; },
    };
    return res as typeof res & Response;
  }

  it("requires a signed-in CRM user", async () => {
    vi.mocked(sdk.authenticateRequest).mockRejectedValue(new Error("no cookie"));
    const res = fakeRes();
    await handler({ params: { ref: "ALT-AAAAA" } } as unknown as Request, res);
    expect(res.statusCode).toBe(401);
  });

  it("streams the document with attachment headers and logs who took it", async () => {
    configure();
    vi.mocked(sdk.authenticateRequest).mockResolvedValue(mockUser());
    const xml = "<MESSAGE/>";
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(xml, {
          status: 200,
          headers: {
            "content-type": "application/xml",
            "content-disposition": 'attachment; filename="ALT-AAAAA-20260908T143012Z.xml"',
          },
        })
      )
    );
    const log = vi.spyOn(console, "log").mockImplementation(() => {});

    const res = fakeRes();
    await handler({ params: { ref: "alt-aaaaa" } } as unknown as Request, res);

    expect(res.statusCode).toBe(200);
    expect(res.headers["Content-Disposition"]).toContain("ALT-AAAAA-20260908T143012Z.xml");
    expect(res.headers["X-Content-Type-Options"]).toBe("nosniff");
    expect(res.headers["Cache-Control"]).toBe("no-store");
    expect(Buffer.isBuffer(res.body) && res.body.toString("utf8")).toBe(xml);
    expect(log).toHaveBeenCalledWith(expect.stringContaining("officer@alta.test downloaded ALT-AAAAA"));
  });

  it("passes the website's status and reason through on failure", async () => {
    configure();
    vi.mocked(sdk.authenticateRequest).mockResolvedValue(mockUser());
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(409, { error: "No MISMO document was written for this application" })));
    const res = fakeRes();
    await handler({ params: { ref: "ALT-AAAAA" } } as unknown as Request, res);
    expect(res.statusCode).toBe(409);
    expect((res.body as { error: string }).error).toContain("No MISMO document");
  });
});

describe("GET /api/applications/documents/:id", () => {
  type Handler = (req: Request, res: Response) => Promise<void>;
  let handler: Handler;

  beforeEach(() => {
    const app = { get: vi.fn((_path: string, h: Handler) => { handler = h; }) } as unknown as Express;
    registerDocumentDownloadRoute(app);
  });

  function fakeRes() {
    const res = {
      statusCode: 200,
      headers: {} as Record<string, string>,
      body: undefined as unknown,
      status(code: number) { this.statusCode = code; return this; },
      set(h: Record<string, string>) { Object.assign(this.headers, h); return this; },
      json(b: unknown) { this.body = b; return this; },
      send(b: unknown) { this.body = b; return this; },
    };
    return res as typeof res & Response;
  }

  it("requires a signed-in CRM user", async () => {
    vi.mocked(sdk.authenticateRequest).mockResolvedValue(null as never);
    const res = fakeRes();
    await handler({ params: { id: "12" } } as unknown as Request, res);
    expect(res.statusCode).toBe(401);
  });

  it("rejects a non-numeric id before calling the website", async () => {
    configure();
    vi.mocked(sdk.authenticateRequest).mockResolvedValue(mockUser());
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const res = fakeRes();
    await handler({ params: { id: "../etc" } } as unknown as Request, res);
    expect(res.statusCode).toBe(404);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("passes the website's content type and filename through as a download", async () => {
    configure();
    vi.mocked(sdk.authenticateRequest).mockResolvedValue(mockUser());
    const pdf = "%PDF-1.7 fake";
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(pdf, {
          status: 200,
          headers: {
            "content-type": "application/pdf",
            "content-disposition": "attachment; filename=\"statement.pdf\"; filename*=UTF-8''statement.pdf",
          },
        })
      )
    );
    const log = vi.spyOn(console, "log").mockImplementation(() => {});

    const res = fakeRes();
    await handler({ params: { id: "12" } } as unknown as Request, res);

    expect(res.statusCode).toBe(200);
    expect(res.headers["Content-Type"]).toBe("application/pdf");
    expect(res.headers["Content-Disposition"]).toContain("statement.pdf");
    expect(res.headers["X-Content-Type-Options"]).toBe("nosniff");
    expect(Buffer.isBuffer(res.body) && res.body.toString("utf8")).toBe(pdf);
    expect(log).toHaveBeenCalledWith(expect.stringContaining("officer@alta.test downloaded document-12"));
  });
});
