import { describe, expect, it } from "vitest";
import { buildDwsWageFile, buildSsaW2File, buildUtahW2File, validateInputs, type W2FileInput } from "../shared/efw2";

const company = {
  name: "Boerstra Holdings, LLC", ein: "12-3456789", address: "123 E Main St.", city: "Salt Lake City",
  state: "UT", zip: "84101-1234", utahWithholdingAccount: "12345678-002-WTH", utahUiAccount: "1234567",
};
const sam = { firstName: "Sam", lastName: "Boerstra", ssn: "123-45-6789" };
const jo = { firstName: "Jo-Anne", lastName: "O'Brien", ssn: "234567890" };
const submitter = { bsoUserId: "ABCD1234", contactName: "Sam Boerstra", contactPhone: "(801) 555-1212", contactEmail: "sam@example.com" };

const amounts = (box1: number, d = 0) => ({
  box1, box2: 100_00, box3: box1 + d, box4: Math.round((box1 + d) * 0.062), box5: box1 + d, box6: Math.round((box1 + d) * 0.0145),
  box12D: d, box13Retirement: d > 0, box16: box1, box17: 50_00,
});

const input: W2FileInput = {
  company, year: 2026, submitter,
  w2s: [{ employee: sam, amounts: amounts(60_000_00, 5_000_00) }, { employee: jo, amounts: amounts(12_000_00) }],
};

/** 1-based inclusive slice, matching how the specs number positions. */
const at = (line: string, start: number, end: number) => line.slice(start - 1, end);
const linesOf = (file: string) => {
  expect(file.endsWith("\r\n")).toBe(true);
  const lines = file.slice(0, -2).split("\r\n");
  for (const l of lines) expect(l).toHaveLength(512);
  return lines;
};

describe("SSA EFW2 W-2 file", () => {
  const lines = linesOf(buildSsaW2File(input));

  it("has RA, RE, one RW per employee, RT, RF", () => {
    expect(lines.map((l) => l.slice(0, 2))).toEqual(["RA", "RE", "RW", "RW", "RT", "RF"]);
  });

  it("RA carries the submitter EIN, BSO user ID and contact", () => {
    const ra = lines[0];
    expect(at(ra, 3, 11)).toBe("123456789");
    expect(at(ra, 12, 19)).toBe("ABCD1234");
    expect(at(ra, 36, 37)).toBe("98");
    expect(at(ra, 38, 94).trim()).toBe("BOERSTRA HOLDINGS LLC");
    expect(at(ra, 163, 167)).toBe("84101");
    expect(at(ra, 168, 171)).toBe("1234");
    expect(at(ra, 423, 437).trim()).toBe("8015551212");
    expect(at(ra, 500, 500)).toBe("L");
  });

  it("RE carries the tax year, EIN and employment code", () => {
    const re = lines[1];
    expect(at(re, 3, 6)).toBe("2026");
    expect(at(re, 8, 16)).toBe("123456789");
    expect(at(re, 40, 96).trim()).toBe("BOERSTRA HOLDINGS LLC");
    expect(at(re, 119, 140).trim()).toBe("123 E MAIN ST");
    expect(at(re, 141, 162).trim()).toBe("SALT LAKE CITY");
    expect(at(re, 163, 164)).toBe("UT");
    expect(at(re, 174, 174)).toBe("N");
    expect(at(re, 219, 219)).toBe("R");
  });

  it("RW puts amounts in cents, zero-filled, at their positions", () => {
    const rw = lines[2];
    expect(at(rw, 3, 11)).toBe("123456789");
    expect(at(rw, 12, 26).trim()).toBe("SAM");
    expect(at(rw, 42, 61).trim()).toBe("BOERSTRA");
    expect(at(rw, 188, 198)).toBe("00006000000");
    expect(at(rw, 199, 209)).toBe("00000010000");
    expect(at(rw, 210, 220)).toBe("00006500000");
    expect(at(rw, 287, 297)).toBe("00000500000");
    expect(at(rw, 265, 275)).toBe(" ".repeat(11));
    expect(at(rw, 488, 488)).toBe("1");
    expect(at(lines[3], 488, 488)).toBe("0");
    expect(at(lines[3], 12, 26).trim()).toBe("JO-ANNE");
    expect(at(lines[3], 42, 61).trim()).toBe("O'BRIEN");
  });

  it("RT totals and RF count", () => {
    const rt = lines[4];
    expect(at(rt, 3, 9)).toBe("0000002");
    expect(at(rt, 10, 24)).toBe(String(72_000_00).padStart(15, "0"));
    expect(at(rt, 145, 159)).toBe(String(5_000_00).padStart(15, "0"));
    expect(at(lines[5], 8, 16)).toBe("000000002");
  });
});

describe("Utah TAP W-2 file", () => {
  const lines = linesOf(buildUtahW2File(input));

  it("adds an RS after each RW and no RV", () => {
    expect(lines.map((l) => l.slice(0, 2))).toEqual(["RA", "RE", "RW", "RS", "RW", "RS", "RT", "RF"]);
  });

  it("RS has state code 49, account without hyphens, state wages and tax", () => {
    const rs = lines[3];
    expect(at(rs, 3, 4)).toBe("49");
    expect(at(rs, 5, 9)).toBe("     ");
    expect(at(rs, 10, 18)).toBe("123456789");
    expect(at(rs, 248, 267).trim()).toBe("12345678002WTH");
    expect(at(rs, 274, 275)).toBe("49");
    expect(at(rs, 276, 286)).toBe("00006000000");
    expect(at(rs, 287, 297)).toBe("00000005000");
  });
});

describe("Utah DWS wage file", () => {
  const lines = linesOf(buildDwsWageFile({
    company, year: 2026, quarter: 3,
    wages: [{ employee: sam, wagesCents: 15_000_00 }, { employee: jo, wagesCents: 3_000_50 }],
  }));

  it("RE has quarter month and DWS number; RS has period and wages", () => {
    expect(lines.map((l) => l.slice(0, 2))).toEqual(["RE", "RS", "RS", "RT"]);
    expect(at(lines[0], 222, 223)).toBe("09");
    expect(at(lines[0], 224, 233)).toBe("0001234567");
    expect(at(lines[1], 197, 202)).toBe("092026");
    expect(at(lines[1], 214, 224)).toBe("00001500000");
    expect(at(lines[2], 214, 224)).toBe("00000300050");
    expect(at(lines[3], 3, 9)).toBe("0000002");
  });
});

describe("validation", () => {
  it("passes good input", () => {
    expect(validateInputs(company, [sam, jo], submitter)).toEqual([]);
  });

  it("catches bad SSNs, missing address and submitter fields", () => {
    const errs = validateInputs({ ...company, address: "", ein: "123" }, [{ ...sam, ssn: "000-12-3456" }],
      { ...submitter, bsoUserId: "abc", contactEmail: "" });
    expect(errs.join(" ")).toMatch(/EIN/);
    expect(errs.join(" ")).toMatch(/address/);
    expect(errs.join(" ")).toMatch(/SSN/);
    expect(errs.join(" ")).toMatch(/BSO/);
    expect(errs.join(" ")).toMatch(/email/);
  });
});
