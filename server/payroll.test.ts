import { describe, expect, it } from "vitest";
import {
  computePaycheck,
  federalWithholdingCents,
  utahWithholdingCents,
  TAX_YEARS,
  getTaxYear,
  type W4,
  type PaycheckInput,
} from "../shared/payrollTax";
import {
  buildForm941,
  buildForm940,
  buildUtahForm3,
  buildUtahWithholding,
  buildW2s,
  quarterDueDate,
  type ReportCompany,
  type ReportPaycheck,
  type ReportPerson,
} from "../shared/payrollReports";

const T26 = TAX_YEARS[2026];
const single: W4 = { filingStatus: "single", multipleJobs: false, dependentsCredit: 0, otherIncome: 0, deductions: 0, extraWithholding: 0 };

describe("federal withholding (Pub 15-T annual percentage method)", () => {
  it("matches the 2026 STANDARD single schedule", () => {
    // $60,000/yr: 1,240 + (43,900 - 12,400) x 12% = 5,020/yr -> 418.33/mo
    expect(federalWithholdingCents(500_000, 12, single, T26)).toBe(41_833);
  });

  it("halves deduction and brackets when Step 2 is checked", () => {
    const w4: W4 = { ...single, filingStatus: "married_joint", multipleJobs: true };
    // 100,000 - 16,100 = 83,900 on half MFJ brackets: 1,240 + 4,560 + 7,370
    expect(federalWithholdingCents(10_000_000, 1, w4, T26)).toBe(1_317_000);
  });

  it("applies dependents credit and extra withholding", () => {
    const w4: W4 = { ...single, dependentsCredit: 2_000, extraWithholding: 50 };
    // (5,020 - 2,000) / 12 = 251.67, + 50
    expect(federalWithholdingCents(500_000, 12, w4, T26)).toBe(30_167);
  });

  it("never goes negative", () => {
    expect(federalWithholdingCents(50_000, 12, { ...single, dependentsCredit: 5_000 }, T26)).toBe(0);
  });
});

describe("Utah withholding (Pub 14)", () => {
  it("allowance fully phased out at higher wages", () => {
    // 60,000 x 4.45% = 2,670 / 12
    expect(utahWithholdingCents(500_000, 12, "single", T26)).toBe(22_250);
  });

  it("partially phased-out allowance", () => {
    // 534 - (485 - 2,652 x 1.3%) = 83.476 / 12 = 6.956
    expect(utahWithholdingCents(100_000, 12, "single", T26)).toBe(696);
  });

  it("uses the 2025 rate for 2025", () => {
    expect(utahWithholdingCents(500_000, 12, "single", TAX_YEARS[2025])).toBe(22_500);
  });
});

describe("computePaycheck", () => {
  const base: PaycheckInput = {
    grossCents: 1_000_000,
    retirement401kCents: 0,
    shareholderHealthCents: 0,
    periodsPerYear: 12,
    payYear: 2026,
    w4: single,
    futaExempt: false,
    utahUiExempt: false,
    utahUiRate: 0.012,
    ytd: { ssWagesCents: 0, medicareWagesCents: 0, futaWagesCents: 0, utahUiWagesCents: 0 },
  };

  it("caps social security, FUTA and Utah UI at their wage bases", () => {
    const r = computePaycheck({
      ...base,
      ytd: { ssWagesCents: 18_400_000, medicareWagesCents: 19_500_000, futaWagesCents: 600_000, utahUiWagesCents: 5_000_000 },
    });
    expect(r.ssWagesCents).toBe(50_000);
    expect(r.ssEmployeeCents).toBe(3_100);
    expect(r.ssEmployerCents).toBe(3_100);
    expect(r.addlMedicareWagesCents).toBe(500_000);
    expect(r.addlMedicareCents).toBe(4_500);
    expect(r.futaWagesCents).toBe(100_000);
    expect(r.futaCents).toBe(600);
    expect(r.utahUiWagesCents).toBe(70_000);
    expect(r.utahUiCents).toBe(840);
  });

  it("401(k) reduces income-tax wages only; shareholder health adds to them only", () => {
    const r = computePaycheck({ ...base, retirement401kCents: 100_000, shareholderHealthCents: 50_000 });
    expect(r.federalWagesCents).toBe(950_000);
    expect(r.stateWagesCents).toBe(950_000);
    expect(r.ssWagesCents).toBe(1_000_000);
    expect(r.medicareWagesCents).toBe(1_000_000);
    expect(r.futaWagesCents).toBe(700_000);
  });

  it("keeps user-entered withholding and still reports the suggestion", () => {
    const r = computePaycheck({ ...base, federalWithholdingOverrideCents: 123_45, utahWithholdingOverrideCents: 0 });
    expect(r.federalWithholdingCents).toBe(12_345);
    expect(r.utahWithholdingCents).toBe(0);
    expect(r.suggestedFederalWithholdingCents).toBeGreaterThan(0);
    expect(r.netPayCents).toBe(1_000_000 - 12_345 - 62_000 - 14_500);
  });

  it("exempt people accrue no FUTA or Utah UI", () => {
    const r = computePaycheck({ ...base, futaExempt: true, utahUiExempt: true });
    expect(r.futaCents).toBe(0);
    expect(r.utahUiCents).toBe(0);
  });

  it("falls back to the nearest table for years we don't have", () => {
    expect(getTaxYear(2030)).toMatchObject({ exact: false, table: { year: 2026 } });
    expect(computePaycheck({ ...base, payYear: 2030 }).exactTaxYear).toBe(false);
  });
});

describe("reports", () => {
  const company: ReportCompany = {
    id: 1, name: "Test LLC", ein: "12-3456789", utahWithholdingAccount: "W1", utahUiAccount: "U1",
    utahUiRate: 0.012, depositSchedule: "monthly",
  };
  const owner: ReportPerson = { id: 1, firstName: "Sam", lastName: "Owner", ssnLast4: "1111", futaExempt: false, utahUiExempt: false };
  const spouse: ReportPerson = { id: 2, firstName: "Pat", lastName: "Owner", ssnLast4: "2222", futaExempt: true, utahUiExempt: true };

  function check(personId: number, iso: string, gross: number, ytd = { ss: 0, med: 0, futa: 0, ui: 0 }, exempt = false): ReportPaycheck {
    const r = computePaycheck({
      grossCents: gross, retirement401kCents: 0, shareholderHealthCents: 0, periodsPerYear: 12, payYear: 2026,
      w4: single, futaExempt: exempt, utahUiExempt: exempt, utahUiRate: 0.012,
      ytd: { ssWagesCents: ytd.ss, medicareWagesCents: ytd.med, futaWagesCents: ytd.futa, utahUiWagesCents: ytd.ui },
    });
    const d = new Date(iso + "T00:00:00Z");
    return { personId, payDate: d, periodStart: null, periodEnd: null, grossCents: gross, retirement401kCents: 0, shareholderHealthCents: 0, ...r };
  }

  // Owner $3,333.33 in Jan, Feb, Mar (odd cents force a line 7 adjustment); spouse $1,000 in Mar; owner $5,000 in Apr
  const checks: ReportPaycheck[] = [
    check(1, "2026-01-31", 333_333),
    check(1, "2026-02-28", 333_333, { ss: 333_333, med: 333_333, futa: 333_333, ui: 333_333 }),
    check(1, "2026-03-31", 333_333, { ss: 666_666, med: 666_666, futa: 666_666, ui: 666_666 }),
    check(2, "2026-03-31", 100_000, undefined, true),
    check(1, "2026-04-30", 500_000, { ss: 999_999, med: 999_999, futa: 700_000, ui: 999_999 }),
  ];
  const people = [owner, spouse];

  it("941 totals, rounding line and balance", () => {
    const f = buildForm941(company, checks, [{ agency: "irs_941", taxYear: 2026, quarter: 1, amountCents: 100_000 }], 2026, 1);
    expect(f.line1).toBe(2);
    expect(f.line2).toBe(1_099_999);
    expect(f.line5a.wages).toBe(1_099_999);
    expect(f.line5a.tax).toBe(Math.round(1_099_999 * 0.124));
    expect(f.line5c.tax).toBe(Math.round(1_099_999 * 0.029));
    const perCheck = checks.slice(0, 4).reduce((a, c) =>
      a + c.federalWithholdingCents + c.ssEmployeeCents * 2 + c.medicareEmployeeCents * 2 + c.addlMedicareCents, 0);
    expect(f.line12).toBe(perCheck);
    expect(f.line6 + f.line7).toBe(perCheck);
    expect(f.line13).toBe(100_000);
    expect(f.line14BalanceDue).toBe(perCheck - 100_000);
    expect(f.line16.total).toBe(f.line12);
    expect(f.dueDate.toISOString().slice(0, 10)).toBe("2026-04-30");
  });

  it("Utah withholding return", () => {
    const u = buildUtahWithholding(company, checks, [], 2026, 2);
    expect(u.utahWages).toBe(500_000);
    expect(u.utahWithheld).toBe(checks[4].utahWithholdingCents);
  });

  it("DWS Form 3 leaves out exempt people and splits excess wages", () => {
    const f = buildUtahForm3(company, people, checks, [], 2026, 1);
    expect(f.employees).toHaveLength(1);
    expect(f.totalWages).toBe(999_999);
    expect(f.excessWages).toBe(0);
    expect(f.contribution).toBe(Math.round(999_999 * 0.012));
    expect(f.workersBy12th).toEqual([1, 1, 1]);
  });

  it("940 treats exempt spouse pay as line 4 and caps at $7,000", () => {
    const f = buildForm940(company, people, checks, [], 2026);
    expect(f.line3).toBe(1_599_999);
    expect(f.line4).toBe(100_000);
    expect(f.line5).toBe(1_499_999 - 700_000);
    expect(f.line7).toBe(700_000);
    expect(f.line8).toBe(4_200);
    expect(f.quarterlyLiability.reduce((a, b) => a + b, 0)).toBe(4_200);
  });

  it("W-2s and W-3 totals", () => {
    const r = buildW2s(company, people, checks, [], 2026);
    expect(r.w2s).toHaveLength(2);
    expect(r.w2s[0].box1).toBe(1_499_999);
    expect(r.w3.box1).toBe(1_599_999);
    expect(r.tc941r.utahWithheld).toBe(checks.reduce((a, c) => a + c.utahWithholdingCents, 0));
  });

  it("due dates fall on the last day of the month after the quarter", () => {
    expect(quarterDueDate(2026, 3).toISOString().slice(0, 10)).toBe("2026-10-31");
    expect(quarterDueDate(2026, 4).toISOString().slice(0, 10)).toBe("2027-01-31");
  });
});
