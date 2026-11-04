import { describe, expect, it } from "vitest";
import { campaignSection, canEditCampaign, lockedFieldsInUpdate } from "@shared/adCampaignRules";

describe("campaignSection", () => {
  const now = new Date("2026-11-04T18:00:00Z");

  it("keeps drafts in their own section, even past the end date", () => {
    expect(campaignSection({ status: "draft" }, now)).toBe("draft");
    expect(campaignSection({ status: "draft", endDate: "2026-01-01" }, now)).toBe("draft");
  });

  it("treats active, paused and scheduled campaigns as running", () => {
    for (const status of ["active", "paused", "scheduled"]) {
      expect(campaignSection({ status }, now)).toBe("running");
    }
  });

  it("treats completed and archived campaigns as finished", () => {
    expect(campaignSection({ status: "completed" }, now)).toBe("finished");
    expect(campaignSection({ status: "archived" }, now)).toBe("finished");
  });

  it("finishes a campaign only after its whole end date has passed", () => {
    expect(campaignSection({ status: "active", endDate: new Date("2026-11-04") }, now)).toBe("running");
    expect(campaignSection({ status: "active", endDate: new Date("2026-11-03") }, now)).toBe("finished");
  });
});

describe("canEditCampaign", () => {
  it("allows edits until the ad exists on Meta", () => {
    expect(canEditCampaign({ status: "draft" })).toBe(true);
    expect(canEditCampaign({ status: "draft", metaAdId: null })).toBe(true);
    expect(canEditCampaign({ status: "paused", metaAdId: "123" })).toBe(false);
  });
});

describe("lockedFieldsInUpdate", () => {
  it("lets budget changes through and flags content changes", () => {
    expect(lockedFieldsInUpdate({ dailyBudget: 40 })).toEqual([]);
    expect(lockedFieldsInUpdate({ name: "New", creative: null, dailyBudget: 40 })).toEqual(["name", "creative"]);
    expect(lockedFieldsInUpdate({ name: undefined })).toEqual([]);
  });
});
