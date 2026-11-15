import crypto from "crypto";
import { describe, expect, it } from "vitest";
import { buildWebsiteRule, hashMember, hashMembers } from "./meta/audiences";
import { buildTargetingSpec } from "./meta/marketingApi";

const sha = (v: string) => crypto.createHash("sha256").update(v).digest("hex");

describe("buildWebsiteRule", () => {
  it("targets all landing pages and excludes Lead events", () => {
    const rule = buildWebsiteRule("123", { kind: "website", days: 30, excludeConverters: true }) as any;
    const inc = rule.inclusions.rules[0];
    expect(inc.event_sources).toEqual([{ id: "123", type: "pixel" }]);
    expect(inc.retention_seconds).toBe(30 * 86400);
    expect(inc.filter.filters[0]).toEqual({ field: "url", operator: "i_contains", value: "/lp/" });
    expect(rule.exclusions.rules[0].filter.filters[0]).toEqual({ field: "event", operator: "eq", value: "Lead" });
  });

  it("narrows to one page, caps at 180 days, and can skip exclusions", () => {
    const rule = buildWebsiteRule("1", { kind: "website", days: 400, landingPageSlug: "plain-city", excludeConverters: false }) as any;
    expect(rule.inclusions.rules[0].retention_seconds).toBe(180 * 86400);
    expect(rule.inclusions.rules[0].filter.filters[0].value).toBe("/lp/plain-city");
    expect(rule.exclusions).toBeUndefined();
  });
});

describe("hashMember", () => {
  it("normalizes before hashing", () => {
    const row = hashMember({ email: "  Jane@Example.COM ", phone: "(801) 555-1234", firstName: "Jane", lastName: "O'Neil" })!;
    expect(row[0]).toBe(sha("jane@example.com"));
    expect(row[1]).toBe(sha("18015551234"));
    expect(row[2]).toBe(sha("jane"));
    expect(row[3]).toBe(sha("oneil"));
  });

  it("drops contacts with no email or phone", () => {
    expect(hashMember({ firstName: "Only", lastName: "Name" })).toBeNull();
  });

  it("de-duplicates the same person", () => {
    expect(hashMembers([{ email: "a@b.co" }, { email: "A@B.co" }, { email: "c@d.co" }])).toHaveLength(2);
  });
});

describe("buildTargetingSpec audiences", () => {
  it("maps include and exclude audiences", () => {
    const spec = buildTargetingSpec({ customAudiences: ["11"], excludedCustomAudiences: ["22", "33"] });
    expect(spec.custom_audiences).toEqual([{ id: "11" }]);
    expect(spec.excluded_custom_audiences).toEqual([{ id: "22" }, { id: "33" }]);
  });

  it("leaves them out when empty", () => {
    const spec = buildTargetingSpec({ customAudiences: [] });
    expect(spec).not.toHaveProperty("custom_audiences");
    expect(spec).not.toHaveProperty("excluded_custom_audiences");
  });
});

describe("buildTargetingSpec housing geography", () => {
  it("targets areas with a 15-mile minimum and never sends ZIP codes", () => {
    const spec = buildTargetingSpec({
      countries: ["US"],
      zips: ["US:84401"],
      customLocations: [
        { name: "Ogden", latitude: 41.223, longitude: -111.9738, radius: 25 },
        { name: "Tiny", latitude: 41, longitude: -112, radius: 5 },
      ],
    }) as any;
    expect(spec.geo_locations.zips).toBeUndefined();
    expect(spec.geo_locations.countries).toBeUndefined();
    expect(spec.geo_locations.custom_locations).toEqual([
      { latitude: 41.223, longitude: -111.9738, radius: 25, distance_unit: "mile" },
      { latitude: 41, longitude: -112, radius: 15, distance_unit: "mile" },
    ]);
  });

  it("falls back to the country only when nothing narrower is set", () => {
    expect((buildTargetingSpec({ countries: ["US"] }) as any).geo_locations).toEqual({ countries: ["US"] });
  });
});
