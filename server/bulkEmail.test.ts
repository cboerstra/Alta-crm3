import { describe, expect, it } from "vitest";
import { estimateFinish, remainingToday, usesBulkSender } from "./bulkEmail";

const now = new Date("2026-10-28T12:00:00Z");
const hours = (h: number) => new Date(now.getTime() + h * 3600_000);

describe("remainingToday", () => {
  it("allows the rest of the day's limit", () => {
    expect(remainingToday({ sent: 100, oldestSentAt: hours(-5) }, 290, now)).toEqual({ remaining: 190, nextSlotAt: null });
  });

  it("at the limit, waits until the oldest send leaves the 24-hour window", () => {
    const { remaining, nextSlotAt } = remainingToday({ sent: 290, oldestSentAt: hours(-20) }, 290, now);
    expect(remaining).toBe(0);
    // 4 hours from now, plus a minute's margin.
    expect(nextSlotAt!.getTime()).toBe(hours(4).getTime() + 60_000);
  });

  it("never goes negative when the limit was lowered below what was already sent", () => {
    expect(remainingToday({ sent: 300, oldestSentAt: hours(-1) }, 100, now).remaining).toBe(0);
  });
});

describe("estimateFinish", () => {
  it("2,400 agents at 290 a day, starting fresh, takes 8 more days", () => {
    // 290 go today; 2,110 remain → 8 more days.
    expect(estimateFinish(2400, 290, 290, now)!.getTime()).toBe(hours(8 * 24).getTime());
  });

  it("finishes today when today's allowance covers it", () => {
    expect(estimateFinish(50, 290, 100, now)).toEqual(now);
  });

  it("has nothing to estimate when nothing is pending", () => {
    expect(estimateFinish(0, 290, 290, now)).toBeNull();
  });
});

describe("usesBulkSender", () => {
  it("is for the real-estate side only", () => {
    expect(usesBulkSender("re_agent")).toBe(true);
    expect(usesBulkSender("prospective_re_client")).toBe(true);
    expect(usesBulkSender("past_mortgage")).toBe(false);
    expect(usesBulkSender("prospective_mortgage")).toBe(false);
  });
});
