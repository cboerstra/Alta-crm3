import { describe, expect, it } from "vitest";
import { tourSuccessUrl } from "@shared/tourSuccessUrl";

describe("tourSuccessUrl", () => {
  const params = (url: string) => new URL(url).searchParams;

  it("carries the home, day and time to the success page", () => {
    const url = tourSuccessUrl("3380 W 3275 N, Plain City", new Date(2026, 10, 6), "10:30");
    expect(url.startsWith("https://freehomesearchutah.com/tour-scheduled.html?")).toBe(true);
    expect(params(url).get("home")).toBe("3380 W 3275 N, Plain City");
    expect(params(url).get("date")).toBe("2026-11-06");
    expect(params(url).get("time")).toBe("10:30");
    expect(params(url).has("src")).toBe(false);
  });

  it("keeps the landing page the visitor came from", () => {
    const url = tourSuccessUrl("6089 W 5050 S, Hooper", new Date(2026, 0, 9), "09:00", "plain-city-tour-b");
    expect(params(url).get("date")).toBe("2026-01-09");
    expect(params(url).get("src")).toBe("plain-city-tour-b");
  });
});
