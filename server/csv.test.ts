import { describe, expect, it } from "vitest";
import { cleanTag, matchColumns, parseCsv, readContactCsv } from "@shared/csv";

describe("parseCsv", () => {
  it("keeps commas and quotes inside quoted fields", () => {
    expect(parseCsv('Name,Office\n"Smith, Jane","The ""Best"" Realty, LLC"\n')).toEqual([
      ["Name", "Office"],
      ["Smith, Jane", 'The "Best" Realty, LLC'],
    ]);
  });

  it("handles Windows line endings, a byte-order mark and blank lines", () => {
    expect(parseCsv("﻿a,b\r\n1,2\r\n\r\n3,4")).toEqual([["a", "b"], ["1", "2"], ["3", "4"]]);
  });

  it("keeps a line break inside a quoted field", () => {
    expect(parseCsv('a,b\n"line one\nline two",x')).toEqual([["a", "b"], ["line one\nline two", "x"]]);
  });
});

describe("matchColumns", () => {
  it("recognizes MLS roster headers", () => {
    const map = matchColumns(["Member First Name", "Member Last Name", "Member E-mail", "Office Name", "Cell Phone"]);
    expect(map).toEqual({ firstName: 0, lastName: 1, email: 2, brokerage: 3, phone: 4 });
  });
});

describe("readContactCsv", () => {
  it("imports a four-column sheet with a single Name column", () => {
    const out = readContactCsv("Name,Email,Phone,Brokerage\nJane Q. Smith,JANE@Example.com,801-555-1234,Wasatch Realty\n");
    expect(out.contacts).toEqual([
      { firstName: "Jane", lastName: "Q. Smith", email: "jane@example.com", phone: "801-555-1234", brokerage: "Wasatch Realty",
        licenseNumber: undefined, city: undefined, state: undefined },
    ]);
  });

  it("splits 'Last, First' names", () => {
    expect(readContactCsv('Agent,Email\n"Smith, Jane",j@x.com').contacts[0]).toMatchObject({ firstName: "Jane", lastName: "Smith" });
  });

  it("prefers separate first and last name columns over a full name", () => {
    const out = readContactCsv("Name,First Name,Last Name,Email\nJ Smith,Jane,Smith,j@x.com");
    expect(out.contacts[0]).toMatchObject({ firstName: "Jane", lastName: "Smith" });
  });

  it("skips rows without a valid email and reports their line numbers", () => {
    const out = readContactCsv("Email,First Name\nok@x.com,A\n,B\nnot-an-email,C\nalso@x.com,D");
    expect(out.contacts.map((c) => c.email)).toEqual(["ok@x.com", "also@x.com"]);
    expect(out.skippedRows).toEqual([3, 4]);
  });

  it("keeps two-letter states and drops anything else", () => {
    const out = readContactCsv("Email,State\na@x.com,ut\nb@x.com,Utah");
    expect(out.contacts.map((c) => c.state)).toEqual(["UT", undefined]);
  });

  it("reports when there is no email column at all", () => {
    const out = readContactCsv("Name,Phone\nJane,123");
    expect(out.columns.email).toBeUndefined();
    expect(out.contacts).toHaveLength(0);
  });
});

describe("cleanTag", () => {
  it("trims, collapses spaces and caps length", () => {
    expect(cleanTag("  Ogden   agents ")).toBe("Ogden agents");
    expect(cleanTag("x".repeat(80))).toHaveLength(64);
  });
});
