import { PDFDocument, type PDFForm } from "pdf-lib";
import type { buildForm941 } from "./payrollReports";

/**
 * Fills the official IRS Form 941 (and Schedule B when needed) so it can be printed, signed and mailed.
 * Field names come from the IRS fillable PDFs in client/public/irs-forms. The IRS reissues the 941
 * each year ("941 for 2026"), so a new year needs its PDF added to FORM_941_TEMPLATES and its
 * field names re-checked before use.
 */

export const FORM_941_TEMPLATES: Record<number, { form941: string; scheduleB: string }> = {
  2026: { form941: "/irs-forms/f941-2026.pdf", scheduleB: "/irs-forms/f941sb-2024-03.pdf" },
};

/** Where a Utah employer mails the 941 (irs.gov "Where to file your taxes for Form 941"). */
export const FORM_941_MAIL_TO = {
  withoutPayment: ["Department of the Treasury", "Internal Revenue Service", "Ogden, UT 84201-0005"],
  withPayment: ["Internal Revenue Service", "P.O. Box 932100", "Louisville, KY 40293-2100"],
};

export type Form941Data = ReturnType<typeof buildForm941>;

export type Form941Company = {
  name: string;
  ein: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
};

export type Form941Signer = {
  name: string;
  title: string;
  phone: string;
  /** Only used when line 15 shows an overpayment */
  overpayment: "apply" | "refund";
};

/** The 941 splits money into a dollars box and a cents box. */
function money(cents: number): [string, string] {
  const neg = cents < 0;
  const abs = Math.abs(cents);
  const dollars = Math.floor(abs / 100).toLocaleString("en-US");
  return [`${neg ? "-" : ""}${dollars}`, String(abs % 100).padStart(2, "0")];
}

/** Looks fields up by page and short name (f1_12), since the same short name repeats across pages. */
function fieldIndex(form: PDFForm) {
  const byKey = new Map<string, string>();
  for (const f of form.getFields()) {
    const name = f.getName();
    const page = name.match(/Page(\d+)\[0\]/)?.[1];
    const short = name.match(/\.([cf]\d+_\d+)\[(\d+)\]$/);
    if (page && short) byKey.set(`${page}:${short[1]}[${short[2]}]`, name);
  }
  const find = (page: number, short: string) => {
    const key = `${page}:${short.includes("[") ? short : `${short}[0]`}`;
    const name = byKey.get(key);
    if (!name) throw new Error(`IRS form field ${key} not found — the PDF layout may have changed`);
    return name;
  };
  return {
    text: (page: number, short: string, value: string) => form.getTextField(find(page, short)).setText(value),
    money: (page: number, dollarsField: string, centsField: string, cents: number) => {
      const [d, c] = money(cents);
      form.getTextField(find(page, dollarsField)).setText(d);
      form.getTextField(find(page, centsField)).setText(c);
    },
    check: (page: number, short: string) => form.getCheckBox(find(page, short)).check(),
  };
}

const einParts = (ein: string | null) => {
  const digits = (ein ?? "").replace(/\D/g, "");
  return [digits.slice(0, 2), digits.slice(2, 9)] as const;
};

export async function fill941(template: Uint8Array, f: Form941Data, company: Form941Company, signer: Form941Signer) {
  const doc = await PDFDocument.load(template);
  const form = doc.getForm();
  const x = fieldIndex(form);
  const [ein1, ein2] = einParts(company.ein);
  const cityLine = [company.city, company.state, company.zip].filter(Boolean).join(" ");

  // Header
  x.text(1, "f1_1", ein1);
  x.text(1, "f1_2", ein2);
  x.text(1, "f1_3", company.name);
  x.text(1, "f1_5", company.address ?? "");
  x.text(1, "f1_6", company.city ?? "");
  x.text(1, "f1_7", company.state ?? "");
  x.text(1, "f1_8", company.zip ?? "");
  x.check(1, `c1_1[${f.quarter - 1}]`);

  // Part 1
  x.text(1, "f1_12", String(f.line1));
  x.money(1, "f1_13", "f1_14", f.line2);
  x.money(1, "f1_15", "f1_16", f.line3);
  if (f.line4NoSocialSecurityWages) {
    x.check(1, "c1_3");
  } else {
    x.money(1, "f1_17", "f1_18", f.line5a.wages);
    x.money(1, "f1_19", "f1_20", f.line5a.tax);
    x.money(1, "f1_25", "f1_26", f.line5c.wages);
    x.money(1, "f1_27", "f1_28", f.line5c.tax);
    if (f.line5d.wages > 0) {
      x.money(1, "f1_29", "f1_30", f.line5d.wages);
      x.money(1, "f1_31", "f1_32", f.line5d.tax);
    }
    x.money(1, "f1_33", "f1_34", f.line5e);
  }
  x.money(1, "f1_37", "f1_38", f.line6);
  if (f.line7 !== 0) x.money(1, "f1_39", "f1_40", f.line7);
  x.money(1, "f1_45", "f1_46", f.line10);
  x.money(1, "f1_49", "f1_50", f.line12);
  x.money(1, "f1_51", "f1_52", f.line13);
  x.money(1, "f1_53", "f1_54", f.line14BalanceDue);
  if (f.line15Overpayment > 0) {
    x.money(1, "f1_55", "f1_56", f.line15Overpayment);
    x.check(1, signer.overpayment === "apply" ? "c1_4[0]" : "c1_4[1]");
  }

  // Page 2 header and Part 2 (line 16)
  x.text(2, "f1_3", company.name);
  x.text(2, "f1_1", ein1);
  x.text(2, "f1_2", ein2);
  const needsScheduleB = !f.line16.under2500 && f.line16.schedule === "semiweekly";
  if (f.line16.under2500) {
    x.check(2, "c2_1[0]");
  } else if (needsScheduleB) {
    x.check(2, "c2_1[2]");
  } else {
    x.check(2, "c2_1[1]");
    x.money(2, "f2_1", "f2_2", f.line16.months[0]);
    x.money(2, "f2_3", "f2_4", f.line16.months[1]);
    x.money(2, "f2_5", "f2_6", f.line16.months[2]);
    x.money(2, "f2_7", "f2_8", f.line16.total);
  }

  // Part 4: no third-party designee. Part 5: signer (signature and date are written by hand).
  x.check(2, "c2_4[1]");
  x.text(2, "f2_13", signer.name);
  x.text(2, "f2_14", signer.title);
  x.text(2, "f2_15", signer.phone);

  // Page 3 is the 941-V payment voucher — only useful when mailing a check with the return
  if (f.line14BalanceDue > 0) {
    x.text(3, "f1_1", ein1);
    x.text(3, "f1_2", ein2);
    x.money(3, "f4_2", "f4_3", f.line14BalanceDue);
    x.check(3, `c4_1[${f.quarter - 1}]`);
    x.text(3, "f1_3", company.name);
    x.text(3, "f4_5", company.address ?? "");
    x.text(3, "f4_6", cityLine);
  } else {
    doc.removePage(2);
  }

  return { doc, needsScheduleB };
}

export async function fillScheduleB(template: Uint8Array, f: Form941Data, company: Form941Company) {
  const doc = await PDFDocument.load(template);
  const form = doc.getForm();
  const x = fieldIndex(form);
  const digits = (company.ein ?? "").replace(/\D/g, "");
  for (let i = 0; i < 9; i++) x.text(1, `f1_0${i + 1}`, digits[i] ?? "");
  x.text(1, "f1_10", company.name);
  String(f.year).split("").forEach((d, i) => x.text(1, `f1_${11 + i}`, d));
  x.check(1, `c1_1[${f.quarter - 1}]`);

  // Each month is 31 day boxes (dollars + cents fields), then the month total
  const firstMonth = (f.quarter - 1) * 3;
  const monthTotals = [0, 0, 0];
  for (const { date, amount } of f.line16.scheduleB) {
    const m = Number(date.slice(5, 7)) - 1 - firstMonth;
    const day = Number(date.slice(8, 10));
    const n = 15 + m * 64 + (day - 1) * 2;
    x.money(1, `f1_${n}`, `f1_${n + 1}`, amount);
    monthTotals[m] += amount;
  }
  monthTotals.forEach((t, m) => {
    const n = 77 + m * 64;
    x.money(1, `f1_${n}`, `f1_${n + 1}`, t);
  });
  x.money(1, "f1_207", "f1_208", f.line16.total);
  return doc;
}

/** The complete packet to print: 941 (+ voucher if a balance is due) followed by Schedule B when required. */
export async function build941Packet(
  templates: { form941: Uint8Array; scheduleB: Uint8Array },
  f: Form941Data,
  company: Form941Company,
  signer: Form941Signer,
) {
  const { doc, needsScheduleB } = await fill941(templates.form941, f, company, signer);
  doc.getForm().updateFieldAppearances();
  if (needsScheduleB) {
    const sb = await fillScheduleB(templates.scheduleB, f, company);
    sb.getForm().updateFieldAppearances();
    // Flatten Schedule B so its field names can't collide with the 941's once merged
    sb.getForm().flatten();
    const [page] = await doc.copyPages(sb, [0]);
    doc.addPage(page);
  }
  return doc.save();
}
