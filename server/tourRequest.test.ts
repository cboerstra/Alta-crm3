import { describe, expect, it } from "vitest";
import { buildTourIcs, googleCalendarLink, escapeHtml, type TourRequest } from "./tourRequest";

const tour: TourRequest = {
  bookingId: 42,
  home: "3380 W 3275 N, Plain City",
  guestName: "Jane Smith",
  guestEmail: "jane@example.com",
  guestPhone: "801-555-1234",
  notes: "Pre-approved; bringing her mom",
  start: new Date("2026-11-03T17:30:00Z"),
  durationMinutes: 30,
  agentName: "Scott Boerstra",
  agentEmail: "scott@example.com",
};

describe("buildTourIcs", () => {
  const ics = buildTourIcs(tour, "crm@example.com", new Date("2026-10-30T12:00:00Z"));
  const unfolded = ics.replace(/\r\n /g, "");

  it("is a REQUEST invite with UTC start and end", () => {
    expect(ics).toContain("METHOD:REQUEST");
    expect(ics).toContain("DTSTART:20261103T173000Z");
    expect(ics).toContain("DTEND:20261103T180000Z");
    expect(ics).toContain("UID:tour-42@altamortgagecrm.net");
  });

  it("escapes commas and semicolons and keeps client details", () => {
    expect(unfolded).toContain("LOCATION:3380 W 3275 N\\, Plain City");
    expect(unfolded).toContain("SUMMARY:Tour: 3380 W 3275 N\\, Plain City — Jane Smith\\, 801-555-1234");
    expect(unfolded).toContain("Phone: 801-555-1234\\nEmail: jane@example.com");
    expect(unfolded).toContain("Notes: Pre-approved\\; bringing her mom");
  });

  it("invites the agent", () => {
    expect(unfolded).toContain("mailto:scott@example.com");
  });

  it("uses CRLF and folds long lines to 75 octets", () => {
    for (const line of ics.split("\r\n")) expect(Buffer.byteLength(line, "utf8")).toBeLessThanOrEqual(75);
    expect(ics.endsWith("\r\n")).toBe(true);
  });
});

describe("googleCalendarLink", () => {
  it("prefills title, time and location", () => {
    const url = new URL(googleCalendarLink(tour));
    expect(url.searchParams.get("action")).toBe("TEMPLATE");
    expect(url.searchParams.get("dates")).toBe("20261103T173000Z/20261103T180000Z");
    expect(url.searchParams.get("location")).toBe("3380 W 3275 N, Plain City");
    expect(url.searchParams.get("text")).toContain("Jane Smith");
  });
});

describe("escapeHtml", () => {
  it("neutralizes markup from the link's home value", () => {
    expect(escapeHtml(`<img src=x onerror="alert(1)">`)).toBe("&lt;img src=x onerror=&quot;alert(1)&quot;&gt;");
  });
});
