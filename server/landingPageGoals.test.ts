import { describe, expect, it } from "vitest";
import { GOAL_PRESETS, detectGoal, hasWebinarMismatch } from "../client/src/lib/landingPageGoals";

describe("landing page goals", () => {
  it("only webinar wording mentions a webinar", () => {
    for (const [goal, p] of Object.entries(GOAL_PRESETS)) {
      const webinarish = /webinarTitle|joinUrl|registered/i.test(p.confirmationEmailSubject + p.confirmationEmailBody);
      expect(webinarish).toBe(goal === "webinar");
    }
  });

  it("detects the goal of a saved page", () => {
    expect(detectGoal({ webinarId: 4 })).toBe("webinar");
    expect(detectGoal({ confirmationEmailSubject: GOAL_PRESETS.property.confirmationEmailSubject })).toBe("property");
    expect(detectGoal({ confirmationEmailSubject: "Custom subject" })).toBe("info");
  });

  it("flags webinar wording on a page with no webinar", () => {
    const webinar = GOAL_PRESETS.webinar;
    expect(hasWebinarMismatch({ confirmationEmailSubject: webinar.confirmationEmailSubject, confirmationEmailBody: webinar.confirmationEmailBody })).toBe(true);
    expect(hasWebinarMismatch({ webinarId: 2, confirmationEmailSubject: webinar.confirmationEmailSubject })).toBe(false);
    expect(hasWebinarMismatch({ confirmationEmailSubject: "Thanks", confirmationEmailBody: "Hi {{firstName}}" })).toBe(false);
  });
});

import { plainTextToHtml } from "./routers/leads";
describe("plainTextToHtml", () => {
  it("keeps line breaks and leaves HTML alone", () => {
    expect(plainTextToHtml("Hi Ann,\n\nThanks")).toContain("Hi Ann,<br><br>Thanks");
    expect(plainTextToHtml("<p>Hi</p>")).toBe("<p>Hi</p>");
    expect(plainTextToHtml("A & B")).toContain("A &amp; B");
  });
});
