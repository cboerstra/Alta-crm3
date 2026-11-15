import { describe, expect, it } from "vitest";
import { buildVideoStorySpec } from "./meta/marketingApi";
import { absoluteMediaUrl } from "./meta/publisher";

const creative = {
  primaryText: "Still thinking about the Plain City home?",
  headline: "Special Financing Available",
  description: "Alta Mortgage Group · NMLS 565137",
  callToAction: "LEARN_MORE",
  destinationUrl: "https://altamortgagecrm.net/lp/plain-city?utm_source=facebook",
  videoId: "9876",
};

describe("video ad creative", () => {
  it("builds video_data with the link on the call to action", () => {
    const spec = buildVideoStorySpec("111", creative, { imageUrl: "https://cdn/thumb.jpg" }, "222") as any;
    expect(spec.page_id).toBe("111");
    expect(spec.instagram_user_id).toBe("222");
    expect(spec.link_data).toBeUndefined();
    expect(spec.video_data).toEqual({
      video_id: "9876",
      message: creative.primaryText,
      title: creative.headline,
      link_description: creative.description,
      image_url: "https://cdn/thumb.jpg",
      call_to_action: { type: "LEARN_MORE", value: { link: creative.destinationUrl } },
    });
  });

  it("prefers an uploaded cover over a thumbnail address", () => {
    const spec = buildVideoStorySpec("1", creative, { imageHash: "abc", imageUrl: "x" }) as any;
    expect(spec.video_data.image_hash).toBe("abc");
    expect(spec.video_data.image_url).toBeUndefined();
    expect(spec.instagram_user_id).toBeUndefined();
  });

  it("makes uploaded files absolute for Meta", () => {
    expect(absoluteMediaUrl("/uploads/a.mp4", "https://altamortgagecrm.net")).toBe("https://altamortgagecrm.net/uploads/a.mp4");
    expect(absoluteMediaUrl("https://cdn/x.mp4", "https://altamortgagecrm.net")).toBe("https://cdn/x.mp4");
    expect(absoluteMediaUrl(undefined, "https://a")).toBeUndefined();
  });
});

import { buildDestinationUrl, landingPageSiteUrl } from "./meta/publisher";
describe("landing page site", () => {
  it("links FreeHomeSearchUtah pages to that site", () => {
    const base = landingPageSiteUrl("freehomesearchutah", "https://altamortgagecrm.net");
    expect(buildDestinationUrl({ baseUrl: base, slug: "plain-city-tour", utmSource: "facebook" }))
      .toMatch(/^https:\/\/freehomesearchutah\.com\/lp\/plain-city-tour\?/);
    expect(landingPageSiteUrl("altamortgagecrm", "https://altamortgagecrm.net")).toBe("https://altamortgagecrm.net");
    expect(landingPageSiteUrl(null, "https://altamortgagecrm.net")).toBe("https://altamortgagecrm.net");
  });
});
