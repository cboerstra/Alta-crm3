import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

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
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: vi.fn(),
    } as unknown as TrpcContext["res"],
  };
}

function createPublicContext(): TrpcContext {
  return {
    user: null,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: vi.fn(),
    } as unknown as TrpcContext["res"],
  };
}

describe("CRM Router Structure", () => {
  it("should have all expected routers wired", () => {
    const caller = appRouter.createCaller(createAuthContext());
    // Verify all routers exist by checking they are callable
    expect(caller.auth).toBeDefined();
    expect(caller.leads).toBeDefined();
    expect(caller.webinars).toBeDefined();
    expect(caller.landingPages).toBeDefined();
    expect(caller.deals).toBeDefined();
    expect(caller.sms).toBeDefined();
    expect(caller.analytics).toBeDefined();
    expect(caller.scheduling).toBeDefined();
    expect(caller.integrations).toBeDefined();
  });
});

describe("Auth", () => {
  it("auth.me returns user when authenticated", async () => {
    const ctx = createAuthContext({ name: "Clarke Agent" });
    const caller = appRouter.createCaller(ctx);
    const result = await caller.auth.me();
    expect(result).toBeDefined();
    expect(result?.name).toBe("Clarke Agent");
    expect(result?.email).toBe("agent@clarke.com");
  });

  it("auth.me returns null when not authenticated", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.auth.me();
    expect(result).toBeNull();
  });

  it("auth.logout clears cookie and returns success", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.auth.logout();
    expect(result).toEqual({ success: true });
  });
});

describe("Leads Router", () => {
  it("leads.list requires authentication", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    await expect(caller.leads.list({})).rejects.toThrow();
  });

  it("leads.list returns items and total", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.leads.list({ limit: 10, offset: 0 });
    expect(result).toHaveProperty("items");
    expect(result).toHaveProperty("total");
    expect(Array.isArray(result.items)).toBe(true);
    expect(typeof result.total).toBe("number");
  });

  it("leads.create creates a new lead and returns id", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.leads.create({
      firstName: "John",
      lastName: "Doe",
      email: `john.doe.${Date.now()}@test.com`,
      phone: "555-0100",
      source: "webinar",
      campaign: "spring-2026",
    });
    expect(result).toHaveProperty("id");
    expect(typeof result.id).toBe("number");
    expect(result.id).toBeGreaterThan(0);
  });

  it("leads.create validates email format", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.leads.create({
        firstName: "Bad",
        lastName: "Email",
        email: "not-an-email",
      })
    ).rejects.toThrow();
  });

  it("leads.getById returns the created lead", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const { id } = await caller.leads.create({
      firstName: "Jane",
      lastName: "Smith",
      email: `jane.smith.${Date.now()}@test.com`,
      source: "landing_page",
    });
    const lead = await caller.leads.getById({ id });
    expect(lead).toBeDefined();
    expect(lead?.firstName).toBe("Jane");
    expect(lead?.lastName).toBe("Smith");
    expect(lead?.stage).toBe("new_lead");
  });

  it("leads.updateStage changes the lead stage", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const { id } = await caller.leads.create({
      firstName: "Stage",
      lastName: "Test",
      email: `stage.test.${Date.now()}@test.com`,
    });
    const result = await caller.leads.updateStage({ id, stage: "registered" });
    expect(result).toEqual({ success: true });
    const updated = await caller.leads.getById({ id });
    expect(updated?.stage).toBe("registered");
  });

  it("leads.addNote logs a note activity", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const { id } = await caller.leads.create({
      firstName: "Note",
      lastName: "Test",
      email: `note.test.${Date.now()}@test.com`,
    });
    const result = await caller.leads.addNote({ leadId: id, content: "Called the lead, very interested." });
    expect(result).toEqual({ success: true });
  });

  it("leads.getActivity returns activity log for a lead", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const { id } = await caller.leads.create({
      firstName: "Activity",
      lastName: "Test",
      email: `activity.test.${Date.now()}@test.com`,
    });
    await caller.leads.addNote({ leadId: id, content: "Follow-up needed" });
    const activities = await caller.leads.getActivity({ leadId: id });
    expect(Array.isArray(activities)).toBe(true);
    expect(activities.length).toBeGreaterThanOrEqual(1);
    // Should have at least the creation activity and the note
    const noteActivity = activities.find((a) => a.type === "note");
    expect(noteActivity).toBeDefined();
    expect(noteActivity?.content).toBe("Follow-up needed");
  });

  it("leads.list supports search filter", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const ts = Date.now();
    await caller.leads.create({
      firstName: "Searchable",
      lastName: "Lead",
      email: `searchable.${ts}@test.com`,
    });
    const result = await caller.leads.list({ search: "Searchable", limit: 10 });
    expect(result.items.length).toBeGreaterThanOrEqual(1);
    expect(result.items[0]?.firstName).toBe("Searchable");
  });
});

describe("Deals Router", () => {
  let leadId: number;

  beforeEach(async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.leads.create({
      firstName: "Deal",
      lastName: "Lead",
      email: `deal.lead.${Date.now()}@test.com`,
    });
    leadId = result.id;
  });

  it("deals.list returns array of deals", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.deals.list({});
    expect(Array.isArray(result)).toBe(true);
  });

  it("deals.create creates a deal with value tracking", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.deals.create({
      leadId,
      title: "123 Main St Purchase",
      value: 450000,
      stage: "prospect",
      propertyAddress: "123 Main St, Springfield",
    });
    expect(result).toHaveProperty("id");
    expect(typeof result.id).toBe("number");
  });

  it("deals.update changes deal stage and value", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const { id } = await caller.deals.create({
      leadId,
      title: "456 Oak Ave",
      value: 350000,
      stage: "prospect",
    });
    const result = await caller.deals.update({
      id,
      stage: "qualified",
      value: 375000,
    });
    expect(result).toEqual({ success: true });
  });

  it("deals.revenueMetrics returns revenue tracking data", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.deals.revenueMetrics();
    expect(result).toHaveProperty("totalPipeline");
    expect(result).toHaveProperty("closedRevenue");
    expect(result).toHaveProperty("avgDealSize");
    expect(result).toHaveProperty("dealsByStage");
    expect(typeof result.totalPipeline).toBe("number");
    expect(typeof result.closedRevenue).toBe("number");
  });
});

describe("Webinars Router", () => {
  it("webinars.list returns array", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.webinars.list();
    expect(Array.isArray(result)).toBe(true);
  });

  it("webinars.create creates a webinar", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.webinars.create({
      title: "First-Time Homebuyer Webinar",
      scheduledAt: Date.now() + 7 * 24 * 60 * 60 * 1000,
      durationMinutes: 60,
      description: "Learn the basics of home buying",
    });
    expect(result).toHaveProperty("id");
    expect(typeof result.id).toBe("number");
  });

  it("webinars.getById returns created webinar", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const { id } = await caller.webinars.create({
      title: "Investment Property Webinar",
      scheduledAt: Date.now() + 14 * 24 * 60 * 60 * 1000,
      durationMinutes: 90,
    });
    const webinar = await caller.webinars.getById({ id });
    expect(webinar).toBeDefined();
    expect(webinar?.title).toBe("Investment Property Webinar");
    expect(webinar?.status).toBe("scheduled");
  });

  it("webinars.getAttendanceStats returns stats", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const { id } = await caller.webinars.create({
      title: "Stats Test Webinar",
      scheduledAt: Date.now() + 7 * 24 * 60 * 60 * 1000,
      durationMinutes: 60,
    });
    const stats = await caller.webinars.getAttendanceStats({ webinarId: id });
    expect(stats).toHaveProperty("registered");
    expect(stats).toHaveProperty("attended");
    expect(stats).toHaveProperty("no_show");
  });
});

describe("Landing Pages Router", () => {
  it("landingPages.list returns array", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.landingPages.list();
    expect(Array.isArray(result)).toBe(true);
  });

  it("landingPages.create creates a page with slug", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const slug = `test-page-${Date.now()}`;
    const result = await caller.landingPages.create({
      title: "Spring Webinar LP",
      slug,
      headline: "Join Our Free Webinar",
      subheadline: "Learn about real estate investing",
      ctaText: "Register Now",
      campaignTag: "spring-2026",
      sourceTag: "facebook_ads",
    });
    expect(result).toHaveProperty("id");
    expect(typeof result.id).toBe("number");
  });

  it("landingPages.getBySlug returns page by slug (public)", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const slug = `slug-test-${Date.now()}`;
    await caller.landingPages.create({
      title: "Slug Test Page",
      slug,
      headline: "Test Headline",
    });
    // Public access
    const publicCaller = appRouter.createCaller(createPublicContext());
    const page = await publicCaller.landingPages.getBySlug({ slug });
    expect(page).toBeDefined();
    expect(page?.title).toBe("Slug Test Page");
    expect(page?.slug).toBe(slug);
  });

  it("landingPages.create rejects duplicate slugs", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const slug = `dup-slug-${Date.now()}`;
    await caller.landingPages.create({ title: "First", slug });
    await expect(
      caller.landingPages.create({ title: "Second", slug })
    ).rejects.toThrow("Slug already in use");
  });

  it("landingPages.delete removes a page", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const slug = `del-test-${Date.now()}`;
    const { id } = await caller.landingPages.create({ title: "To Delete", slug });
    const result = await caller.landingPages.delete({ id });
    expect(result).toEqual({ success: true });
  });
});

describe("Analytics Router", () => {
  it("analytics.dashboard returns metrics", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.analytics.dashboard();
    expect(result).toBeDefined();
    expect(result).toHaveProperty("totalLeads");
    expect(result).toHaveProperty("closedDeals");
    expect(result).toHaveProperty("attendanceRate");
    expect(result).toHaveProperty("leadsByStage");
    expect(result).toHaveProperty("leadsBySource");
    expect(result).toHaveProperty("recentLeads");
  });

  it("analytics.revenue returns revenue data", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.analytics.revenue();
    expect(result).toHaveProperty("totalPipeline");
    expect(result).toHaveProperty("closedRevenue");
    expect(result).toHaveProperty("avgDealSize");
    expect(result).toHaveProperty("dealsByStage");
  });
});

describe("Integrations Router", () => {
  it("integrations.getStatus returns zoom and google status", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.integrations.getStatus();
    expect(result).toHaveProperty("zoom");
    expect(result).toHaveProperty("google");
    expect(result.zoom).toHaveProperty("connected");
    expect(result.google).toHaveProperty("connected");
  });

  it("integrations.connectZoom stores zoom credentials", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.integrations.connectZoom({
      accessToken: "test_zoom_token",
      refreshToken: "test_refresh",
      accountEmail: "zoom@clarke.com",
    });
    expect(result).toEqual({ success: true });
    // Verify it's now connected
    const status = await caller.integrations.getStatus();
    expect(status.zoom.connected).toBe(true);
  });

  it("integrations.disconnect removes integration", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    // First connect
    await caller.integrations.connectZoom({
      accessToken: "test_token",
      accountEmail: "zoom@clarke.com",
    });
    // Then disconnect
    const result = await caller.integrations.disconnect({ provider: "zoom" });
    expect(result).toEqual({ success: true });
  });
});

describe("Scheduling Router", () => {
  it("scheduling.getMyAvailability returns array", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.scheduling.getMyAvailability();
    expect(Array.isArray(result)).toBe(true);
  });

  it("scheduling.setAvailability saves availability slots", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    await caller.scheduling.setAvailability({
      slots: [
        { dayOfWeek: 1, startTime: "09:00", endTime: "17:00" },
        { dayOfWeek: 2, startTime: "09:00", endTime: "17:00" },
        { dayOfWeek: 3, startTime: "09:00", endTime: "17:00" },
        { dayOfWeek: 4, startTime: "09:00", endTime: "17:00" },
        { dayOfWeek: 5, startTime: "09:00", endTime: "17:00" },
      ],
    });
    const result = await caller.scheduling.getMyAvailability();
    expect(result.length).toBe(5);
  });

  it("scheduling.getMyBookings returns array", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.scheduling.getMyBookings();
    expect(Array.isArray(result)).toBe(true);
  });
});

describe("SMS Router", () => {
  it("sms.getByLead returns messages array", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const { id } = await caller.leads.create({
      firstName: "SMS",
      lastName: "Test",
      email: `sms.test.${Date.now()}@test.com`,
      smsConsent: true,
    });
    const result = await caller.sms.getByLead({ leadId: id });
    expect(Array.isArray(result)).toBe(true);
  });

  it("sms.send validates lead data before attempting Telnyx send", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    // Lead with consent but no phone — should fail with phone error
    const { id: noPhoneId } = await caller.leads.create({
      firstName: "Consent",
      lastName: "NoPhone",
      email: `consent.nophone.${Date.now()}@test.com`,
      smsConsent: true,
    });
    await expect(
      caller.sms.send({ leadId: noPhoneId, body: "Hello!" })
    ).rejects.toThrow("Lead has no phone number");

    // Lead with consent and phone — should fail with Telnyx config error (no API key in test env)
    const { id: withPhoneId } = await caller.leads.create({
      firstName: "Consent",
      lastName: "WithPhone",
      email: `consent.phone.${Date.now()}@test.com`,
      phone: "+15550001234",
      smsConsent: true,
    });
    // In test env, no Telnyx integration is stored, so it throws config error;
    // if somehow a real Telnyx call is made, it will throw an API error — both are acceptable.
    await expect(
      caller.sms.send({ leadId: withPhoneId, body: "Hello! Reminder about your consultation." })
    ).rejects.toThrow();
  });

  it("sms.send rejects when no consent", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const { id } = await caller.leads.create({
      firstName: "No",
      lastName: "Consent",
      email: `noconsent.${Date.now()}@test.com`,
      smsConsent: false,
    });
    await expect(
      caller.sms.send({ leadId: id, body: "This should fail" })
    ).rejects.toThrow("Lead has not consented to SMS");
  });
});
