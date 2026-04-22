import { describe, expect, it, vi } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import { renderEmailTemplate } from "./emailService";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createMockUser(overrides?: Partial<AuthenticatedUser>): AuthenticatedUser {
  return {
    id: 1,
    openId: "test-user-001",
    email: "agent@clarke.com",
    name: "Test Agent",
    loginMethod: "manus",
    role: "admin",
    schedulingSlug: "test-agent",
    avatarUrl: null,
    phone: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
    ...overrides,
  };
}

function createAuthContext(userOverrides?: Partial<AuthenticatedUser>): TrpcContext {
  return {
    user: createMockUser(userOverrides),
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: vi.fn() } as unknown as TrpcContext["res"],
  };
}

function createPublicContext(): TrpcContext {
  return {
    user: null,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: vi.fn() } as unknown as TrpcContext["res"],
  };
}

describe("Enhanced Landing Pages", () => {
  it("creates landing page with configurable form fields", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const slug = `fields-test-${Date.now()}`;
    const result = await caller.landingPages.create({
      title: "Configurable Fields Test",
      slug,
      headline: "Test Headline",
      enabledFields: ["firstName", "lastName", "email", "phone", "sessionSelect", "optIn"],
      showOptIn: true,
      optInLabel: "I agree to receive communications",
    });
    expect(result).toHaveProperty("id");

    const page = await caller.landingPages.getBySlug({ slug });
    expect(page).toBeDefined();
    expect(page?.showOptIn).toBe(true);
    expect(page?.optInLabel).toBe("I agree to receive communications");
    expect(Array.isArray(page?.enabledFields)).toBe(true);
    const fields = page?.enabledFields as string[];
    expect(fields).toContain("firstName");
    expect(fields).toContain("sessionSelect");
    expect(fields).toContain("optIn");
  });

  it("creates landing page with body text and confirmation email settings", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const slug = `email-config-${Date.now()}`;
    const result = await caller.landingPages.create({
      title: "Email Config Test",
      slug,
      bodyText: "This is a detailed description of the event.",
      confirmationEmailSubject: "Welcome to our webinar!",
      confirmationEmailBody: "Dear {{firstName}}, thank you for registering.",
    });
    expect(result).toHaveProperty("id");

    const page = await caller.landingPages.getBySlug({ slug });
    expect(page?.bodyText).toBe("This is a detailed description of the event.");
    expect(page?.confirmationEmailSubject).toBe("Welcome to our webinar!");
    expect(page?.confirmationEmailBody).toContain("{{firstName}}");
  });

  it("updates landing page with new fields", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const slug = `update-fields-${Date.now()}`;
    const { id } = await caller.landingPages.create({
      title: "Update Fields Test",
      slug,
    });

    await caller.landingPages.update({
      id,
      enabledFields: ["firstName", "lastName", "email"],
      showOptIn: false,
      bodyText: "Updated body text",
    });

    const page = await caller.landingPages.getBySlug({ slug });
    expect(page?.showOptIn).toBe(false);
    expect(page?.bodyText).toBe("Updated body text");
  });

  it("stores html background urls on landing pages", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const slug = `html-background-${Date.now()}`;
    const { id } = await caller.landingPages.create({
      title: "HTML Background Test",
      slug,
    });

    await caller.landingPages.update({
      id,
      backgroundHtmlUrl: "/uploads/test-background.html",
    });

    const page = await caller.landingPages.getBySlug({ slug });
    expect((page as any)?.backgroundHtmlUrl).toBe("/uploads/test-background.html");
  });
});

describe("Webinar with Sessions and Landing Page", () => {
  it("creates webinar with auto-generated landing page", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.webinars.create({
      title: "Auto LP Webinar",
      scheduledAt: Date.now() + 14 * 24 * 60 * 60 * 1000,
      durationMinutes: 60,
      createLandingPage: true,
      landingPageSlug: `auto-lp-${Date.now()}`,
    });
    expect(result).toHaveProperty("id");
    expect(result).toHaveProperty("landingPageId");
    expect(result.landingPageId).toBeDefined();
    expect(typeof result.landingPageId).toBe("number");
  });

  it("creates webinar with additional sessions", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const baseTime = Date.now() + 14 * 24 * 60 * 60 * 1000;
    const result = await caller.webinars.create({
      title: "Multi-Session Webinar",
      scheduledAt: baseTime,
      durationMinutes: 60,
      additionalSessions: [
        { sessionDate: baseTime + 24 * 60 * 60 * 1000, durationMinutes: 60, label: "Evening Session" },
        { sessionDate: baseTime + 48 * 60 * 60 * 1000, durationMinutes: 90, label: "Weekend Session" },
      ],
    });
    expect(result).toHaveProperty("id");

    const webinar = await caller.webinars.getById({ id: result.id });
    expect(webinar).toBeDefined();
    expect(webinar?.title).toBe("Multi-Session Webinar");
  });

  it("creates webinar without landing page when flag is false", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.webinars.create({
      title: "No LP Webinar",
      scheduledAt: Date.now() + 7 * 24 * 60 * 60 * 1000,
      durationMinutes: 45,
      createLandingPage: false,
    });
    expect(result).toHaveProperty("id");
    // landingPageId should be null/undefined
    expect(result.landingPageId).toBeFalsy();
  });
});

describe("Lead Capture with Enhanced Fields", () => {
  it("captures lead from landing page with opt-in consent", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const slug = `capture-optin-${Date.now()}`;
    await caller.landingPages.create({
      title: "Opt-In Test LP",
      slug,
      showOptIn: true,
      isActive: true,
    });

    const publicCaller = appRouter.createCaller(createPublicContext());
    const result = await publicCaller.leads.captureFromLandingPage({
      slug,
      firstName: "OptIn",
      lastName: "Lead",
      email: `optin.${Date.now()}@test.com`,
      contactOptIn: true,
      smsConsent: true,
    });
    expect(result).toHaveProperty("id");
    expect(result.id).toBeGreaterThan(0);
  });

  it("captures lead with webinar session selection", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const baseTime = Date.now() + 14 * 24 * 60 * 60 * 1000;
    const webinarResult = await caller.webinars.create({
      title: "Session Select Webinar",
      scheduledAt: baseTime,
      durationMinutes: 60,
      createLandingPage: true,
      landingPageSlug: `session-select-${Date.now()}`,
      additionalSessions: [
        { sessionDate: baseTime + 24 * 60 * 60 * 1000, durationMinutes: 60, label: "Session 2" },
      ],
    });

    // Get the landing page slug
    const pages = await caller.landingPages.list();
    const linkedPage = pages.find(p => p.webinarId === webinarResult.id);
    expect(linkedPage).toBeDefined();

    if (linkedPage) {
      const publicCaller = appRouter.createCaller(createPublicContext());
      const result = await publicCaller.leads.captureFromLandingPage({
        slug: linkedPage.slug,
        firstName: "Session",
        lastName: "Picker",
        email: `session.picker.${Date.now()}@test.com`,
      });
      expect(result).toHaveProperty("id");
      expect(result.webinarId).toBe(webinarResult.id);
    }
  });

  it("rejects capture from inactive landing page", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const slug = `inactive-${Date.now()}`;
    const { id } = await caller.landingPages.create({
      title: "Inactive Page",
      slug,
      isActive: true,
    });
    // Deactivate it
    await caller.landingPages.update({ id, isActive: false });

    const publicCaller = appRouter.createCaller(createPublicContext());
    await expect(
      publicCaller.leads.captureFromLandingPage({
        slug,
        firstName: "Should",
        lastName: "Fail",
        email: "fail@test.com",
      })
    ).rejects.toThrow("Landing page not found");
  });
});

describe("Email Template Rendering", () => {
  it("replaces template placeholders correctly", () => {
    const template = "Hello {{firstName}} {{lastName}}, welcome to {{webinarTitle}}!";
    const result = renderEmailTemplate(template, {
      firstName: "John",
      lastName: "Doe",
      webinarTitle: "Homebuyer 101",
    });
    expect(result).toBe("Hello John Doe, welcome to Homebuyer 101!");
  });

  it("handles multiple occurrences of same placeholder", () => {
    const template = "Hi {{firstName}}! {{firstName}}, your link is {{joinUrl}}.";
    const result = renderEmailTemplate(template, {
      firstName: "Jane",
      joinUrl: "https://zoom.us/j/123",
    });
    expect(result).toBe("Hi Jane! Jane, your link is https://zoom.us/j/123.");
  });

  it("leaves unmatched placeholders intact", () => {
    const template = "Hello {{firstName}}, date: {{date}}";
    const result = renderEmailTemplate(template, {
      firstName: "Test",
    });
    expect(result).toBe("Hello Test, date: {{date}}");
  });
});
