import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getUserBySchedulingSlug: vi.fn(),
  getLandingPageBySlug: vi.fn(),
  createLead: vi.fn(),
  createBooking: vi.fn(),
  logActivity: vi.fn(),
  notifyAdminsBySms: vi.fn(),
  trackCapturedLead: vi.fn(),
  sendTourInvite: vi.fn(),
}));

vi.mock("./db", () => ({
  getAvailabilityByUser: vi.fn(), upsertAvailability: vi.fn(), getBookings: vi.fn(),
  getBookingsByDateRange: vi.fn(), updateUserSchedulingSlug: vi.fn(), updateLead: vi.fn(),
  getUserBySchedulingSlug: mocks.getUserBySchedulingSlug,
  getLandingPageBySlug: mocks.getLandingPageBySlug,
  createLead: mocks.createLead,
  createBooking: mocks.createBooking,
  logActivity: mocks.logActivity,
  notifyAdminsBySms: mocks.notifyAdminsBySms,
}));
vi.mock("./meta/leadTracking", () => ({ trackCapturedLead: mocks.trackCapturedLead }));
vi.mock("./tourRequest", async (original) => ({
  ...(await original<typeof import("./tourRequest")>()),
  sendTourInvite: mocks.sendTourInvite,
}));

import { schedulingRouter } from "./routers/scheduling";
import { tourCampaign } from "./tourRequest";

const caller = schedulingRouter.createCaller({
  req: { headers: { "user-agent": "test-agent" }, socket: { remoteAddress: "203.0.113.9" } },
  res: {},
  user: null,
} as any);

const tour = {
  agentSlug: "scott-boerstra",
  guestName: "Jane Smith",
  guestEmail: "jane@example.com",
  guestPhone: "801-555-1234",
  scheduledAt: Date.UTC(2026, 10, 7, 17, 0),
  home: "3380 W 3275 N, Plain City",
};

describe("scheduling.book attribution", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getUserBySchedulingSlug.mockResolvedValue({ id: 1, name: "Scott", email: "scott@example.com" });
    mocks.createLead.mockResolvedValue(58);
    mocks.createBooking.mockResolvedValue(7);
    mocks.logActivity.mockResolvedValue(undefined);
    mocks.notifyAdminsBySms.mockResolvedValue(undefined);
    mocks.trackCapturedLead.mockResolvedValue({});
    mocks.sendTourInvite.mockResolvedValue(true);
  });

  it("credits the landing page and passes along the ad details", async () => {
    const page = { id: 61, slug: "plain-city-tour-a", title: "Tour A" };
    mocks.getLandingPageBySlug.mockResolvedValue(page);

    await caller.book({
      ...tour,
      src: "plain-city-tour-a",
      attribution: { utmSource: "facebook", utmContent: "ad-2", fbclid: "abc", eventId: "evt1" },
    });

    expect(mocks.createLead.mock.calls[0][0].landingPageId).toBe(61);
    const tracked = mocks.trackCapturedLead.mock.calls[0][0];
    expect(tracked).toMatchObject({ leadId: 58, page, eventId: "evt1" });
    expect(tracked.attribution).toMatchObject({
      utmSource: "facebook",
      utmContent: "ad-2",
      fbclid: "abc",
      clientIpAddress: "203.0.113.9",
      clientUserAgent: "test-agent",
    });
    expect(mocks.logActivity.mock.calls[0][0].content).toContain("Came from: plain-city-tour-a");
  });

  it("does not report a tour booked straight from a listing page", async () => {
    await caller.book(tour);

    expect(mocks.getLandingPageBySlug).not.toHaveBeenCalled();
    expect(mocks.createLead.mock.calls[0][0].landingPageId).toBeUndefined();
    expect(mocks.trackCapturedLead).not.toHaveBeenCalled();
  });

  it("keeps the source in the activity log when no page has that slug yet", async () => {
    mocks.getLandingPageBySlug.mockResolvedValue(undefined);

    await caller.book({ ...tour, src: "plain-city-tour-b" });

    expect(mocks.createLead.mock.calls[0][0].landingPageId).toBeUndefined();
    expect(mocks.trackCapturedLead).not.toHaveBeenCalled();
    expect(mocks.logActivity.mock.calls[0][0].content).toContain("Came from: plain-city-tour-b");
  });

  it("still books when tracking values are invalid", async () => {
    const result = await caller.book({
      ...tour,
      src: "NOT A SLUG!",
      attribution: { utmSource: "x".repeat(500) },
    });

    expect(result).toEqual({ id: 7 });
    expect(mocks.getLandingPageBySlug).not.toHaveBeenCalled();
    expect(mocks.trackCapturedLead).not.toHaveBeenCalled();
  });

  it("still books when attribution tracking fails", async () => {
    mocks.trackCapturedLead.mockRejectedValue(new Error("meta down"));

    await expect(
      caller.book({ ...tour, attribution: { utmSource: "facebook" } })
    ).resolves.toEqual({ id: 7 });
    expect(mocks.sendTourInvite).toHaveBeenCalled();
  });
});

describe("tourCampaign", () => {
  it("fits the leads.campaign column even with a very long address", () => {
    expect(tourCampaign("A".repeat(200)).length).toBeLessThanOrEqual(128);
  });
});
