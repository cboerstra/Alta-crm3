import { describe, expect, it } from "vitest";
import { normalizeSiteUrl, siteKeyFor } from "./websites";
import { landingPageSiteUrl } from "./meta/publisher";

describe("websites", () => {
  it("normalizes addresses to an https origin", () => {
    expect(normalizeSiteUrl("www.Example.com/some/page")).toBe("https://www.example.com");
    expect(normalizeSiteUrl("https://homes.example.org/")).toBe("https://homes.example.org");
    expect(normalizeSiteUrl("http://example.com")).toBeNull();
    expect(normalizeSiteUrl("localhost")).toBeNull();
    expect(normalizeSiteUrl("not a url")).toBeNull();
  });

  it("derives a key from the domain", () => {
    expect(siteKeyFor("https://www.my-homes.com")).toBe("myhomescom");
    expect(siteKeyFor("https://freehomesearchutah.com")).toBe("freehomesearchutahcom");
  });

  it("links ads to the page's own website", () => {
    const sites = [{ siteKey: "ogdenhomescom", baseUrl: "https://ogdenhomes.com" }];
    expect(landingPageSiteUrl("ogdenhomescom", "https://altamortgagecrm.net", sites)).toBe("https://ogdenhomes.com");
    expect(landingPageSiteUrl("gone", "https://altamortgagecrm.net", sites)).toBe("https://altamortgagecrm.net");
  });
});
