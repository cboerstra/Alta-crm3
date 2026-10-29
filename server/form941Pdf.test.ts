import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";
import { PDFDocument } from "pdf-lib";
import { build941Packet, fill941, fillScheduleB, FORM_941_TEMPLATES, type Form941Data } from "../shared/form941Pdf";

const publicDir = path.resolve(import.meta.dirname, "..", "client", "public");
const load = (url: string) => new Uint8Array(fs.readFileSync(path.join(publicDir, url)));
const templates = { form941: load(FORM_941_TEMPLATES[2026].form941), scheduleB: load(FORM_941_TEMPLATES[2026].scheduleB) };

const company = { name: "Boerstra Holdings, LLC", ein: "12-3456789", address: "123 E Main St.", city: "Salt Lake City", state: "UT", zip: "84101" };
const signer = { name: "Jane Owner", title: "Managing Member", phone: "801-555-0100", overpayment: "apply" as const };

const base: Form941Data = {
  company: company.name, ein: company.ein, year: 2026, quarter: 3, dueDate: "2026-11-02",
  line1: 2, line2: 1_500_000, line3: 180_000, line4NoSocialSecurityWages: false,
  line5a: { wages: 1_500_000, tax: 186_000 }, line5b: { wages: 0, tax: 0 },
  line5c: { wages: 1_500_000, tax: 43_500 }, line5d: { wages: 0, tax: 0 },
  line5e: 229_500, line6: 409_500, line7: -3, line10: 409_497, line11: 0, line12: 409_497,
  line13: 400_000, line14BalanceDue: 9_497, line15Overpayment: 0,
  line16: { under2500: false, schedule: "monthly", months: [136_499, 136_499, 136_499], total: 409_497, scheduleB: [] },
};

const value = (doc: PDFDocument, page: number, short: string) => {
  const f = doc.getForm().getFields().find((x) => x.getName().includes(`Page${page}[0]`) && x.getName().endsWith(`.${short}[0]`));
  if (!f) throw new Error(`no field ${short}`);
  return doc.getForm().getTextField(f.getName()).getText();
};
const checked = (doc: PDFDocument, page: number, name: string) =>
  doc.getForm().getCheckBox(doc.getForm().getFields().find((x) => x.getName().includes(`Page${page}[0]`) && x.getName().endsWith(`.${name}`))!.getName()).isChecked();

describe("Form 941 PDF", () => {
  it("fills header, Part 1 lines and the monthly deposit schedule", async () => {
    const { doc, needsScheduleB } = await fill941(templates.form941, base, company, signer);
    expect(needsScheduleB).toBe(false);
    expect(value(doc, 1, "f1_1")).toBe("12");
    expect(value(doc, 1, "f1_2")).toBe("3456789");
    expect(value(doc, 1, "f1_3")).toBe("Boerstra Holdings, LLC");
    expect(checked(doc, 1, "c1_1[2]")).toBe(true); // Q3
    expect(value(doc, 1, "f1_12")).toBe("2");
    expect([value(doc, 1, "f1_13"), value(doc, 1, "f1_14")]).toEqual(["15,000", "00"]);
    expect([value(doc, 1, "f1_19"), value(doc, 1, "f1_20")]).toEqual(["1,860", "00"]);
    expect([value(doc, 1, "f1_39"), value(doc, 1, "f1_40")]).toEqual(["-0", "03"]); // line 7
    expect([value(doc, 1, "f1_49"), value(doc, 1, "f1_50")]).toEqual(["4,094", "97"]); // line 12
    expect([value(doc, 1, "f1_53"), value(doc, 1, "f1_54")]).toEqual(["94", "97"]); // line 14
    expect(checked(doc, 2, "c2_1[1]")).toBe(true); // monthly depositor
    expect([value(doc, 2, "f2_7"), value(doc, 2, "f2_8")]).toEqual(["4,094", "97"]);
    expect(value(doc, 2, "f2_13")).toBe("Jane Owner");
    // Balance due keeps the 941-V voucher page, filled with the amount
    expect(doc.getPageCount()).toBe(3);
    expect([value(doc, 3, "f4_2"), value(doc, 3, "f4_3")]).toEqual(["94", "97"]);
  });

  it("drops the voucher when nothing is due and marks the overpayment choice", async () => {
    const f = { ...base, line13: 420_000, line14BalanceDue: 0, line15Overpayment: 10_503 };
    const { doc } = await fill941(templates.form941, f, company, { ...signer, overpayment: "refund" });
    expect(doc.getPageCount()).toBe(2);
    expect([value(doc, 1, "f1_55"), value(doc, 1, "f1_56")]).toEqual(["105", "03"]);
    expect(checked(doc, 1, "c1_4[1]")).toBe(true);
  });

  it("puts semiweekly liabilities on Schedule B by day", async () => {
    const f: Form941Data = {
      ...base,
      line16: { ...base.line16, schedule: "semiweekly", scheduleB: [{ date: "2026-07-15", amount: 200_000 }, { date: "2026-09-30", amount: 209_497 }] },
    };
    const sb = await fillScheduleB(templates.scheduleB, f, company);
    expect(value(sb, 1, "f1_10")).toBe("Boerstra Holdings, LLC");
    expect(["f1_11", "f1_12", "f1_13", "f1_14"].map((s) => value(sb, 1, s)).join("")).toBe("2026");
    expect([value(sb, 1, "f1_43"), value(sb, 1, "f1_44")]).toEqual(["2,000", "00"]); // July 15
    expect([value(sb, 1, "f1_77"), value(sb, 1, "f1_78")]).toEqual(["2,000", "00"]); // July total
    expect([value(sb, 1, "f1_201"), value(sb, 1, "f1_202")]).toEqual(["2,094", "97"]); // Sept 30
    expect([value(sb, 1, "f1_207"), value(sb, 1, "f1_208")]).toEqual(["4,094", "97"]);

    const packet = await PDFDocument.load(await build941Packet(templates, f, company, signer));
    expect(packet.getPageCount()).toBe(4); // 941 (2) + voucher + Schedule B
  });
});
