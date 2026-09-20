import { describe, expect, it } from "vitest";
import crypto from "crypto";
import { normalizeAttribution, buildFbc, describeAttribution, clientIpFromRequest } from "./meta/attribution";
import { buildUserData, buildEventPayload, normalizePhone } from "./meta/conversionsApi";
import { buildDestinationUrl } from "./meta/publisher";
import { buildTargetingSpec, normalizeAdAccountId, toMinorUnits, extractLeadCount } from "./meta/marketingApi";
import { resolvePlaceholders } from "./automations/engine";
import { detectPixelInMarkup, pageViewEventId } from "../client/src/lib/metaPixel";

const sha256 = (v: string) => crypto.createHash("sha256").update(v).digest("hex");

describe("attribution normalization", () => {
  it("keeps real click parameters", () => {
    const a = normalizeAttribution({
      utmSource: "facebook",
      utmMedium: "paid_social",
      utmCampaign: "weber-county-grant",
      metaAdId: "120210987654321",
    });
    expect(a.utmSource).toBe("facebook");
    expect(a.utmCampaign).toBe("weber-county-grant");
    expect(a.metaAdId).toBe("120210987654321");
  });

  it("discards Meta macros that were never substituted", () => {
    const a = normalizeAttribution({
      metaCampaignId: "{{campaign.id}}",
      metaAdName: "{{ad.name}}",
      utmSource: "facebook",
    });
    expect(a.metaCampaignId).toBeUndefined();
    expect(a.metaAdName).toBeUndefined();
    expect(a.utmSource).toBe("facebook");
  });

  it("discards the literal strings 'undefined' and 'null'", () => {
    const a = normalizeAttribution({ utmContent: "undefined", utmTerm: "null" });
    expect(a.utmContent).toBeUndefined();
    expect(a.utmTerm).toBeUndefined();
  });

  it("rebuilds fbc from fbclid when the cookie is missing", () => {
    const a = normalizeAttribution({ fbclid: "IwAR0abc123" });
    expect(a.fbc).toMatch(/^fb\.1\.\d+\.IwAR0abc123$/);
  });

  it("prefers the browser's own _fbc cookie over a rebuilt one", () => {
    const a = normalizeAttribution({ fbclid: "IwAR0abc123", fbc: "fb.1.1700000000000.IwAR0abc123" });
    expect(a.fbc).toBe("fb.1.1700000000000.IwAR0abc123");
  });

  it("builds fbc in Meta's documented format", () => {
    const at = new Date(1_700_000_000_000);
    expect(buildFbc("abc", at)).toBe("fb.1.1700000000000.abc");
  });

  it("carries request context onto the record", () => {
    const a = normalizeAttribution({}, { ip: "203.0.113.7", userAgent: "Mozilla/5.0" });
    expect(a.clientIpAddress).toBe("203.0.113.7");
    expect(a.clientUserAgent).toBe("Mozilla/5.0");
  });

  it("describes an empty record as direct traffic", () => {
    expect(describeAttribution(normalizeAttribution({}))).toBe("direct / none");
  });

  it("summarises a paid click for the activity feed", () => {
    const a = normalizeAttribution({
      utmSource: "facebook",
      utmMedium: "paid_social",
      utmCampaign: "Weber County Grant",
      metaAdName: "Grant carousel v2",
    });
    expect(describeAttribution(a)).toBe("facebook / paid_social · Weber County Grant · ad: Grant carousel v2");
  });
});

describe("client IP resolution", () => {
  it("takes the first hop from x-forwarded-for", () => {
    const ip = clientIpFromRequest({ headers: { "x-forwarded-for": "203.0.113.7, 10.0.0.1" } } as any);
    expect(ip).toBe("203.0.113.7");
  });

  it("prefers cf-connecting-ip over x-forwarded-for", () => {
    const ip = clientIpFromRequest({
      headers: { "cf-connecting-ip": "198.51.100.4", "x-forwarded-for": "203.0.113.7" },
    } as any);
    expect(ip).toBe("198.51.100.4");
  });
});

describe("Conversions API payloads", () => {
  it("hashes email lowercase and trimmed", () => {
    const data = buildUserData({ email: "  Person@Example.COM " });
    expect(data.em).toEqual([sha256("person@example.com")]);
  });

  it("adds the US country code to a bare 10-digit phone before hashing", () => {
    expect(normalizePhone("(801) 555-0134")).toBe("18015550134");
    const data = buildUserData({ phone: "(801) 555-0134" });
    expect(data.ph).toEqual([sha256("18015550134")]);
  });

  it("strips punctuation from names before hashing", () => {
    const data = buildUserData({ firstName: " O'Brien " });
    expect(data.fn).toEqual([sha256("obrien")]);
  });

  it("never sends raw PII", () => {
    const serialized = JSON.stringify(buildUserData({
      email: "person@example.com",
      phone: "8015550134",
      firstName: "Dana",
      lastName: "Reyes",
    }));
    expect(serialized).not.toContain("person@example.com");
    expect(serialized).not.toContain("Dana");
    expect(serialized).not.toContain("8015550134");
  });

  it("passes click and browser identifiers through unhashed", () => {
    const data = buildUserData({ fbc: "fb.1.1700000000000.abc", fbp: "fb.1.1700000000000.99", clientIpAddress: "203.0.113.7" });
    expect(data.fbc).toBe("fb.1.1700000000000.abc");
    expect(data.fbp).toBe("fb.1.1700000000000.99");
    expect(data.client_ip_address).toBe("203.0.113.7");
  });

  it("hashes the external id so a lead id cannot be read off the wire", () => {
    const data = buildUserData({ externalId: 42 });
    expect(data.external_id).toEqual([sha256("42")]);
  });

  it("omits fields that were not provided", () => {
    const data = buildUserData({ email: "person@example.com" });
    expect(data.ph).toBeUndefined();
    expect(data.fn).toBeUndefined();
  });

  it("builds an event with a unix-second timestamp and the shared event id", () => {
    const payload = buildEventPayload({
      eventName: "Lead",
      eventId: "lp_abc123",
      eventTime: new Date(1_700_000_000_000),
      userData: { email: "person@example.com" },
    });
    expect(payload.event_name).toBe("Lead");
    expect(payload.event_id).toBe("lp_abc123");
    expect(payload.event_time).toBe(1_700_000_000);
    expect(payload.action_source).toBe("website");
  });

  it("attaches value and currency to custom_data when a value is given", () => {
    const payload = buildEventPayload({
      eventName: "Purchase",
      eventId: "x",
      value: 4200,
      userData: {},
    });
    expect(payload.custom_data).toMatchObject({ value: 4200, currency: "USD" });
  });
});

describe("ad destination URL", () => {
  const url = buildDestinationUrl({
    baseUrl: "https://crm.example.com/",
    slug: "weber-grant",
    utmSource: "facebook",
    utmMedium: "paid_social",
    utmCampaign: "weber-county-grant",
  });

  it("points at the landing page without a doubled slash", () => {
    expect(url.startsWith("https://crm.example.com/lp/weber-grant?")).toBe(true);
  });

  it("carries the UTM tags", () => {
    expect(url).toContain("utm_source=facebook");
    expect(url).toContain("utm_campaign=weber-county-grant");
  });

  it("leaves Meta's macros unencoded so Meta can substitute them", () => {
    expect(url).toContain("meta_ad_id={{ad.id}}");
    expect(url).toContain("meta_campaign_id={{campaign.id}}");
    expect(url).not.toContain("%7B%7B");
  });

  it("defaults the source and medium when a campaign has none", () => {
    const bare = buildDestinationUrl({ baseUrl: "https://c.example.com", slug: "p" });
    expect(bare).toContain("utm_source=facebook");
    expect(bare).toContain("utm_medium=paid_social");
  });
});

describe("Marketing API helpers", () => {
  it("normalizes an ad account id", () => {
    expect(normalizeAdAccountId("1234567890")).toBe("act_1234567890");
    expect(normalizeAdAccountId("act_1234567890")).toBe("act_1234567890");
    expect(normalizeAdAccountId("  act_1234567890 ")).toBe("act_1234567890");
  });

  it("converts dollars to the minor units Meta expects", () => {
    expect(toMinorUnits(35)).toBe(3500);
    expect(toMinorUnits("19.99")).toBe(1999);
  });

  it("defaults targeting to the US when no geography is given", () => {
    const spec = buildTargetingSpec(null) as any;
    expect(spec.geo_locations.countries).toEqual(["US"]);
  });

  it("shapes zips the way the Graph API wants them", () => {
    const spec = buildTargetingSpec({ zips: ["US:84401", "US:84403"] }) as any;
    expect(spec.geo_locations.zips).toEqual([{ key: "US:84401" }, { key: "US:84403" }]);
  });

  it("sums every lead-shaped action from an insights row", () => {
    const count = extractLeadCount({
      date_start: "2026-01-01",
      date_stop: "2026-01-01",
      actions: [
        { action_type: "lead", value: "3" },
        { action_type: "offsite_conversion.fb_pixel_lead", value: "2" },
        { action_type: "link_click", value: "40" },
      ],
    });
    expect(count).toBe(5);
  });

  it("reports zero leads when the row has no actions", () => {
    expect(extractLeadCount({ date_start: "2026-01-01", date_stop: "2026-01-01" })).toBe(0);
  });
});

describe("automation placeholders", () => {
  const lead = { id: 1, firstName: "Dana", lastName: "Reyes", email: "dana@example.com", phone: "8015550134" };

  it("resolves camelCase and snake_case spellings alike", () => {
    expect(resolvePlaceholders("Hi {{firstName}} / {{first_name}}", lead)).toBe("Hi Dana / Dana");
  });

  it("builds a full name", () => {
    expect(resolvePlaceholders("{{fullName}}", lead)).toBe("Dana Reyes");
  });

  it("falls back to a friendly greeting when the first name is missing", () => {
    expect(resolvePlaceholders("Hi {{firstName}}", { id: 2 })).toBe("Hi there");
  });

  it("strips placeholders it cannot resolve rather than sending raw tokens", () => {
    expect(resolvePlaceholders("Rate: {{mystery_token}}!", lead)).toBe("Rate: !");
  });

  it("tolerates whitespace inside the braces", () => {
    expect(resolvePlaceholders("Hi {{ firstName }}", lead)).toBe("Hi Dana");
  });
});

describe("pasted-pixel detection", () => {
  // Landing pages can carry staff-pasted tracking code. If a Meta Pixel is in
  // there and the CRM loads its own too, both send PageView — and Meta does not
  // de-duplicate PageView. These guard the hand-off that prevents that.

  const metaSnippet = `
    <!-- Meta Pixel Code -->
    <script>
      !function(f,b,e,v,n,t,s){/* ... */}(window, document,'script');
      fbq('init', '1234567890123456');
      fbq('track', 'PageView');
    </script>
  `;

  it("finds the pixel id in a standard Meta snippet", () => {
    expect(detectPixelInMarkup(metaSnippet)).toBe("1234567890123456");
  });

  it("handles double quotes and odd spacing", () => {
    expect(detectPixelInMarkup(`fbq( "init" , "999888777" )`)).toBe("999888777");
  });

  it("handles template literals", () => {
    expect(detectPixelInMarkup("fbq('init', `555444333`)")).toBe("555444333");
  });

  it("reports 'unknown' when an init call is present but the id is templated", () => {
    expect(detectPixelInMarkup("fbq('init', PIXEL_ID);")).toBe("unknown");
  });

  it("ignores a Google tag with no Meta pixel", () => {
    const googleOnly = `<script async src="https://www.googletagmanager.com/gtag/js?id=G-ABC"></script>`;
    expect(detectPixelInMarkup(googleOnly)).toBeNull();
  });

  it("does not fire on a mention of fbq without an init call", () => {
    expect(detectPixelInMarkup("fbq('track', 'Lead');")).toBeNull();
  });

  it("treats empty or missing markup as no pixel", () => {
    expect(detectPixelInMarkup("")).toBeNull();
    expect(detectPixelInMarkup(null)).toBeNull();
    expect(detectPixelInMarkup(undefined)).toBeNull();
  });
});

describe("PageView event id", () => {
  it("derives a distinct id from the visit's base id", () => {
    expect(pageViewEventId("lp_abc123")).toBe("lp_abc123_pv");
  });

  it("matches the suffix the server applies, so the pair de-duplicates", () => {
    // server/routers/marketing.ts builds `${eventId}_pv` for the same visit.
    const base = "lp_xyz789";
    const browserSide = pageViewEventId(base);
    const serverSide = `${base}_pv`;
    expect(browserSide).toBe(serverSide);
  });
});
