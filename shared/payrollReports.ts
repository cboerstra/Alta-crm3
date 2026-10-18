// ─── Payroll report builders ─────────────────────────────────────────────────
// Turn stored paychecks and deposits into the numbers for each filing. Pure
// functions over plain rows so the router and the tests share one path.
// All money is integer cents.

import { getTaxYear } from "./payrollTax";

export interface ReportCompany {
  id: number;
  name: string;
  ein: string | null;
  utahWithholdingAccount: string | null;
  utahUiAccount: string | null;
  utahUiRate: number; // fraction, e.g. 0.012
  depositSchedule: "monthly" | "semiweekly";
}

export interface ReportPerson {
  id: number;
  firstName: string;
  lastName: string;
  ssnLast4: string | null;
  futaExempt: boolean;
  utahUiExempt: boolean;
}

export interface ReportPaycheck {
  personId: number;
  payDate: Date;
  periodStart: Date | null;
  periodEnd: Date | null;
  grossCents: number;
  retirement401kCents: number;
  shareholderHealthCents: number;
  federalWagesCents: number;
  stateWagesCents: number;
  ssWagesCents: number;
  medicareWagesCents: number;
  addlMedicareWagesCents: number;
  futaWagesCents: number;
  utahUiWagesCents: number;
  federalWithholdingCents: number;
  utahWithholdingCents: number;
  ssEmployeeCents: number;
  medicareEmployeeCents: number;
  addlMedicareCents: number;
  ssEmployerCents: number;
  medicareEmployerCents: number;
  futaCents: number;
  utahUiCents: number;
}

export type DepositAgency = "irs_941" | "irs_940" | "utah_withholding" | "utah_ui";

export interface ReportDeposit {
  agency: DepositAgency;
  taxYear: number;
  quarter: number | null; // null for annual (940)
  amountCents: number;
}

const sum = <T>(rows: T[], f: (r: T) => number) => rows.reduce((a, r) => a + f(r), 0);
const pct = (cents: number, rate: number) => Math.round(cents * rate);

/** Quarter (1-4) a pay date falls in. Taxes follow the date wages are paid, not earned. */
export const quarterOf = (d: Date) => Math.floor(d.getUTCMonth() / 3) + 1;
export const inQuarter = (d: Date, year: number, q: number) => d.getUTCFullYear() === year && quarterOf(d) === q;

/** Last day of the month after the quarter (941, Utah withholding, DWS Form 3). */
export function quarterDueDate(year: number, q: number): Date {
  return new Date(Date.UTC(year, q * 3 + 1, 0));
}

/** 941 line 1 / Form 3 monthly counts: people paid for a pay period that includes the 12th. */
function paidOnThe12th(checks: ReportPaycheck[], year: number, month: number): Set<number> {
  const the12th = Date.UTC(year, month, 12);
  const ids = new Set<number>();
  for (const c of checks) {
    if (c.periodStart && c.periodEnd) {
      if (c.periodStart.getTime() <= the12th && c.periodEnd.getTime() >= the12th) ids.add(c.personId);
    } else if (c.payDate.getUTCFullYear() === year && c.payDate.getUTCMonth() === month) {
      // No period recorded — count anyone paid that month.
      ids.add(c.personId);
    }
  }
  return ids;
}

const liabilityOf = (c: ReportPaycheck) =>
  c.federalWithholdingCents + c.ssEmployeeCents + c.ssEmployerCents +
  c.medicareEmployeeCents + c.medicareEmployerCents + c.addlMedicareCents;

// ─── Form 941 ────────────────────────────────────────────────────────────────
export function buildForm941(company: ReportCompany, checks: ReportPaycheck[], deposits: ReportDeposit[], year: number, q: number) {
  const qc = checks.filter((c) => inQuarter(c.payDate, year, q));
  const firstMonth = (q - 1) * 3;

  const line2 = sum(qc, (c) => c.federalWagesCents);
  const line3 = sum(qc, (c) => c.federalWithholdingCents);
  const ssWages = sum(qc, (c) => c.ssWagesCents);
  const medWages = sum(qc, (c) => c.medicareWagesCents);
  const addlWages = sum(qc, (c) => c.addlMedicareWagesCents);
  const line5a = pct(ssWages, 0.124);
  const line5c = pct(medWages, 0.029);
  const line5d = pct(addlWages, 0.009);
  const line5e = line5a + line5c + line5d;
  const line6 = line3 + line5e;
  const actual = sum(qc, liabilityOf);
  const line7 = actual - line6; // fractions of cents from rounding each check
  const line10 = line6 + line7;
  const line12 = line10;
  const line13 = sum(deposits.filter((d) => d.agency === "irs_941" && d.taxYear === year && d.quarter === q), (d) => d.amountCents);

  const monthly = [0, 1, 2].map((i) =>
    sum(qc.filter((c) => c.payDate.getUTCMonth() === firstMonth + i), liabilityOf));

  // Schedule B: liability by pay date, for semiweekly depositors
  const byDay = new Map<string, number>();
  for (const c of qc) {
    const key = c.payDate.toISOString().slice(0, 10);
    byDay.set(key, (byDay.get(key) ?? 0) + liabilityOf(c));
  }

  return {
    company: company.name,
    ein: company.ein,
    year,
    quarter: q,
    dueDate: quarterDueDate(year, q),
    line1: paidOnThe12th(qc, year, firstMonth + 2).size,
    line2,
    line3,
    line4NoSocialSecurityWages: ssWages === 0 && medWages === 0,
    line5a: { wages: ssWages, tax: line5a },
    line5b: { wages: 0, tax: 0 },
    line5c: { wages: medWages, tax: line5c },
    line5d: { wages: addlWages, tax: line5d },
    line5e,
    line6,
    line7,
    line10,
    line11: 0,
    line12,
    line13,
    line14BalanceDue: Math.max(0, line12 - line13),
    line15Overpayment: Math.max(0, line13 - line12),
    line16: {
      // Under $2,500 for the quarter: no deposit schedule needed (assuming the prior quarter was too).
      under2500: line12 < 250_000,
      schedule: company.depositSchedule,
      months: monthly,
      total: sum(monthly, (m) => m),
      scheduleB: Array.from(byDay.entries()).sort().map(([date, amount]) => ({ date, amount })),
    },
  };
}

// ─── Utah withholding return (quarterly, filed in TAP) ───────────────────────
export function buildUtahWithholding(company: ReportCompany, checks: ReportPaycheck[], deposits: ReportDeposit[], year: number, q: number) {
  const qc = checks.filter((c) => inQuarter(c.payDate, year, q));
  const withheld = sum(qc, (c) => c.utahWithholdingCents);
  const paid = sum(deposits.filter((d) => d.agency === "utah_withholding" && d.taxYear === year && d.quarter === q), (d) => d.amountCents);
  return {
    company: company.name,
    account: company.utahWithholdingAccount,
    year,
    quarter: q,
    dueDate: quarterDueDate(year, q),
    utahWages: sum(qc, (c) => c.stateWagesCents),
    utahWithheld: withheld,
    payments: paid,
    balanceDue: Math.max(0, withheld - paid),
    overpayment: Math.max(0, paid - withheld),
  };
}

// ─── Utah DWS Form 3 (Employer's Quarterly Contribution Report) ──────────────
export function buildUtahForm3(company: ReportCompany, people: ReportPerson[], checks: ReportPaycheck[], deposits: ReportDeposit[], year: number, q: number) {
  const covered = new Set(people.filter((p) => !p.utahUiExempt).map((p) => p.id));
  const qc = checks.filter((c) => inQuarter(c.payDate, year, q) && covered.has(c.personId));
  const firstMonth = (q - 1) * 3;

  const employees = people
    .filter((p) => covered.has(p.id))
    .map((p) => {
      const mine = qc.filter((c) => c.personId === p.id);
      return {
        name: `${p.lastName}, ${p.firstName}`,
        ssnLast4: p.ssnLast4,
        wages: sum(mine, (c) => c.grossCents),
        taxableWages: sum(mine, (c) => c.utahUiWagesCents),
      };
    })
    .filter((e) => e.wages > 0);

  const totalWages = sum(employees, (e) => e.wages);
  const taxableWages = sum(employees, (e) => e.taxableWages);
  const contribution = pct(taxableWages, company.utahUiRate);
  const paid = sum(deposits.filter((d) => d.agency === "utah_ui" && d.taxYear === year && d.quarter === q), (d) => d.amountCents);

  return {
    company: company.name,
    account: company.utahUiAccount,
    year,
    quarter: q,
    dueDate: quarterDueDate(year, q),
    wageBase: getTaxYear(year).table.utahUiWageBase,
    workersBy12th: [0, 1, 2].map((i) => paidOnThe12th(qc, year, firstMonth + i).size),
    employees,
    totalWages,
    excessWages: totalWages - taxableWages,
    taxableWages,
    rate: company.utahUiRate,
    contribution,
    payments: paid,
    balanceDue: Math.max(0, contribution - paid),
  };
}

// ─── Form 940 (annual FUTA) ──────────────────────────────────────────────────
export function buildForm940(company: ReportCompany, people: ReportPerson[], checks: ReportPaycheck[], deposits: ReportDeposit[], year: number) {
  const { table } = getTaxYear(year);
  const yc = checks.filter((c) => c.payDate.getUTCFullYear() === year);
  const exemptIds = new Set(people.filter((p) => p.futaExempt).map((p) => p.id));

  const line3 = sum(yc, (c) => c.grossCents + c.shareholderHealthCents);
  // Line 4: health premiums (fringe benefit) plus all pay to FUTA-exempt people (e.g. a spouse of a sole owner)
  const line4 = sum(yc, (c) => c.shareholderHealthCents + (exemptIds.has(c.personId) ? c.grossCents : 0));
  const line5 = sum(people.filter((p) => !exemptIds.has(p.id)), (p) =>
    Math.max(0, sum(yc.filter((c) => c.personId === p.id), (c) => c.grossCents) - table.futaWageBase * 100));
  const line6 = line4 + line5;
  const line7 = line3 - line6;
  const line8 = pct(line7, table.futaRate);
  const line12 = line8;
  const line13 = sum(deposits.filter((d) => d.agency === "irs_940" && d.taxYear === year), (d) => d.amountCents);

  return {
    company: company.name,
    ein: company.ein,
    year,
    dueDate: new Date(Date.UTC(year + 1, 0, 31)),
    line3,
    line4,
    line5,
    line6,
    line7,
    line8,
    line12,
    line13,
    line14BalanceDue: Math.max(0, line12 - line13),
    line15Overpayment: Math.max(0, line13 - line12),
    // Part 5 is required only when line 12 is over $500
    part5Required: line12 > 50_000,
    quarterlyLiability: [1, 2, 3, 4].map((q) => sum(yc.filter((c) => quarterOf(c.payDate) === q), (c) => c.futaCents)),
  };
}

// ─── W-2 / W-3 and Utah TC-941R ──────────────────────────────────────────────
export function buildW2s(company: ReportCompany, people: ReportPerson[], checks: ReportPaycheck[], deposits: ReportDeposit[], year: number) {
  const yc = checks.filter((c) => c.payDate.getUTCFullYear() === year);
  const w2s = people
    .map((p) => {
      const mine = yc.filter((c) => c.personId === p.id);
      const box12D = sum(mine, (c) => c.retirement401kCents);
      return {
        name: `${p.firstName} ${p.lastName}`,
        ssnLast4: p.ssnLast4,
        box1: sum(mine, (c) => c.federalWagesCents),
        box2: sum(mine, (c) => c.federalWithholdingCents),
        box3: sum(mine, (c) => c.ssWagesCents),
        box4: sum(mine, (c) => c.ssEmployeeCents),
        box5: sum(mine, (c) => c.medicareWagesCents),
        box6: sum(mine, (c) => c.medicareEmployeeCents + c.addlMedicareCents),
        box12D,
        box13Retirement: box12D > 0,
        box14Health: sum(mine, (c) => c.shareholderHealthCents),
        box15: "UT",
        box16: sum(mine, (c) => c.stateWagesCents),
        box17: sum(mine, (c) => c.utahWithholdingCents),
      };
    })
    .filter((w) => w.box1 > 0 || w.box5 > 0);

  const total = (k: "box1" | "box2" | "box3" | "box4" | "box5" | "box6" | "box16" | "box17") => sum(w2s, (w) => w[k]);
  const utahPaid = sum(deposits.filter((d) => d.agency === "utah_withholding" && d.taxYear === year), (d) => d.amountCents);

  return {
    company: company.name,
    ein: company.ein,
    utahWithholdingAccount: company.utahWithholdingAccount,
    year,
    dueDate: new Date(Date.UTC(year + 1, 0, 31)),
    w2s,
    w3: {
      count: w2s.length,
      box1: total("box1"), box2: total("box2"), box3: total("box3"),
      box4: total("box4"), box5: total("box5"), box6: total("box6"),
      box16: total("box16"), box17: total("box17"),
    },
    tc941r: {
      w2Count: w2s.length,
      utahWages: total("box16"),
      utahWithheld: total("box17"),
      payments: utahPaid,
      balanceDue: Math.max(0, total("box17") - utahPaid),
    },
  };
}

/** Upcoming filings for a company in a year: quarterly forms plus the January annuals. */
export function filingCalendar(year: number) {
  const rows: { form: string; period: string; due: Date }[] = [];
  for (const q of [1, 2, 3, 4]) {
    const due = quarterDueDate(year, q);
    rows.push({ form: "IRS Form 941", period: `Q${q} ${year}`, due });
    rows.push({ form: "Utah withholding return (TAP)", period: `Q${q} ${year}`, due });
    rows.push({ form: "Utah DWS Form 3", period: `Q${q} ${year}`, due });
  }
  const jan31 = new Date(Date.UTC(year + 1, 0, 31));
  rows.push({ form: "IRS Form 940", period: `${year}`, due: jan31 });
  rows.push({ form: "W-2s / W-3 (SSA)", period: `${year}`, due: jan31 });
  rows.push({ form: "Utah TC-941R + W-2s", period: `${year}`, due: jan31 });
  return rows;
}
