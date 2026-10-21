// ─── Payroll tax engine ──────────────────────────────────────────────────────
// Pure functions shared by the server (stores the results) and the client
// (previews a paycheck before it is saved). All money is integer cents.
//
// Sources for the yearly constants:
//   Federal: IRS Pub 15-T (percentage method, Worksheet 1A), Rev. Proc. 2025-32,
//            SSA wage base announcement.
//   Utah:    Pub 14 (withholding formula), DWS UI wage base.
// Re-check these each January (and Utah mid-year — the 2026 rate cut to 4.45%
// arrived in a June 2026 Pub 14 revision).

export type FilingStatus = "single" | "married_joint" | "head_of_household";

interface Bracket { upTo: number | null; rate: number } // upTo in dollars of taxable income

export interface TaxYearTable {
  year: number;
  ssWageBase: number;       // dollars
  ssRate: number;           // employee and employer each
  medicareRate: number;     // employee and employer each
  addlMedicareRate: number; // employee only
  addlMedicareThreshold: number;
  futaRate: number;         // net of the full state credit
  futaWageBase: number;
  utahUiWageBase: number;
  /** Federal standard deduction by status — Pub 15-T builds this into its tables. */
  standardDeduction: Record<FilingStatus, number>;
  brackets: Record<FilingStatus, Bracket[]>;
  utah: {
    rate: number;
    baseAllowance: { single: number; married: number };
    phaseOutStart: { single: number; married: number };
    phaseOutRate: number;
  };
}

const RATES = [0.10, 0.12, 0.22, 0.24, 0.32, 0.35, 0.37];
const brackets = (tops: number[]): Bracket[] =>
  RATES.map((rate, i) => ({ rate, upTo: i < tops.length ? tops[i] : null }));

export const TAX_YEARS: Record<number, TaxYearTable> = {
  2025: {
    year: 2025,
    ssWageBase: 176_100,
    ssRate: 0.062,
    medicareRate: 0.0145,
    addlMedicareRate: 0.009,
    addlMedicareThreshold: 200_000,
    futaRate: 0.006,
    futaWageBase: 7_000,
    utahUiWageBase: 48_900,
    standardDeduction: { single: 15_000, married_joint: 30_000, head_of_household: 22_500 },
    brackets: {
      single: brackets([11_925, 48_475, 103_350, 197_300, 250_525, 626_350]),
      married_joint: brackets([23_850, 96_950, 206_700, 394_600, 501_050, 751_600]),
      head_of_household: brackets([17_000, 64_850, 103_350, 197_300, 250_500, 626_350]),
    },
    utah: {
      rate: 0.045,
      baseAllowance: { single: 450, married: 900 },
      phaseOutStart: { single: 9_107, married: 18_213 },
      phaseOutRate: 0.013,
    },
  },
  2026: {
    year: 2026,
    ssWageBase: 184_500,
    ssRate: 0.062,
    medicareRate: 0.0145,
    addlMedicareRate: 0.009,
    addlMedicareThreshold: 200_000,
    futaRate: 0.006,
    futaWageBase: 7_000,
    utahUiWageBase: 50_700,
    standardDeduction: { single: 16_100, married_joint: 32_200, head_of_household: 24_150 },
    brackets: {
      single: brackets([12_400, 50_400, 105_700, 201_775, 256_225, 640_600]),
      married_joint: brackets([24_800, 100_800, 211_400, 403_550, 512_450, 768_700]),
      head_of_household: brackets([17_700, 67_450, 105_700, 201_775, 256_200, 640_600]),
    },
    utah: {
      rate: 0.0445,
      baseAllowance: { single: 485, married: 970 },
      phaseOutStart: { single: 9_348, married: 18_696 },
      phaseOutRate: 0.013,
    },
  },
};

/** Table for a year; falls back to the closest year we have (and says so). */
export function getTaxYear(year: number): { table: TaxYearTable; exact: boolean } {
  if (TAX_YEARS[year]) return { table: TAX_YEARS[year], exact: true };
  const years = Object.keys(TAX_YEARS).map(Number).sort((a, b) => a - b);
  const fallback = year < years[0] ? years[0] : years[years.length - 1];
  return { table: TAX_YEARS[fallback], exact: false };
}

export const toCents = (dollars: number | string | null | undefined): number =>
  Math.round(Number(dollars ?? 0) * 100);
export const fromCents = (cents: number): number => Math.round(cents) / 100;
const pct = (cents: number, rate: number) => Math.round(cents * rate);

function taxOnBrackets(taxable: number, list: Bracket[], scale = 1): number {
  let tax = 0;
  let floor = 0;
  for (const b of list) {
    const top = b.upTo === null ? Infinity : b.upTo * scale;
    if (taxable <= floor) break;
    tax += (Math.min(taxable, top) - floor) * b.rate;
    floor = top;
  }
  return tax;
}

export interface W4 {
  filingStatus: FilingStatus;
  multipleJobs: boolean;   // Step 2 checkbox
  dependentsCredit: number; // Step 3, dollars per year
  otherIncome: number;      // Step 4(a)
  deductions: number;       // Step 4(b)
  extraWithholding: number; // Step 4(c), dollars per pay period
}

/**
 * Federal income tax withholding, Pub 15-T annual percentage method
 * (Worksheet 1A). With Step 2 unchecked the STANDARD schedule equals the
 * regular brackets applied above the standard deduction; with Step 2 checked
 * both the deduction and the brackets are halved.
 */
export function federalWithholdingCents(taxablePerPeriodCents: number, periodsPerYear: number, w4: W4, table: TaxYearTable): number {
  const annualWages = (taxablePerPeriodCents / 100) * periodsPerYear;
  const scale = w4.multipleJobs ? 0.5 : 1;
  const adjusted = annualWages + w4.otherIncome - w4.deductions - table.standardDeduction[w4.filingStatus] * scale;
  const annualTax = Math.max(0, taxOnBrackets(Math.max(0, adjusted), table.brackets[w4.filingStatus], scale) - w4.dependentsCredit);
  return Math.max(0, Math.round((annualTax / periodsPerYear) * 100) + toCents(w4.extraWithholding));
}

/** Utah withholding, Pub 14 formula: flat rate less a base allowance that phases out at 1.3%. */
export function utahWithholdingCents(taxablePerPeriodCents: number, periodsPerYear: number, filingStatus: FilingStatus, table: TaxYearTable): number {
  const u = table.utah;
  const key = filingStatus === "married_joint" ? "married" : "single";
  const annualWages = (taxablePerPeriodCents / 100) * periodsPerYear;
  const allowance = Math.max(0, u.baseAllowance[key] - Math.max(0, annualWages - u.phaseOutStart[key]) * u.phaseOutRate);
  const annualTax = Math.max(0, annualWages * u.rate - allowance);
  return Math.round((annualTax / periodsPerYear) * 100);
}

export interface PaycheckInput {
  grossCents: number;
  retirement401kCents: number;   // employee pre-tax deferral: out of income-tax wages, still FICA/FUTA wages
  shareholderHealthCents: number; // S-corp 2% shareholder health premiums: income-tax wages only
  periodsPerYear: number;
  payYear: number;
  w4: W4;
  futaExempt: boolean;
  utahUiExempt: boolean;
  utahUiRate: number; // e.g. 0.012 for 1.2%
  /** Year-to-date amounts for this person at this company before this check. */
  ytd: { ssWagesCents: number; medicareWagesCents: number; futaWagesCents: number; utahUiWagesCents: number };
  /** Pass to keep amounts the user entered instead of the formula's suggestion. */
  federalWithholdingOverrideCents?: number | null;
  utahWithholdingOverrideCents?: number | null;
}

export interface PaycheckResult {
  federalWagesCents: number;  // W-2 box 1 / 941 line 2
  stateWagesCents: number;    // W-2 box 16
  ssWagesCents: number;
  medicareWagesCents: number;
  addlMedicareWagesCents: number;
  futaWagesCents: number;
  utahUiWagesCents: number;
  federalWithholdingCents: number;
  suggestedFederalWithholdingCents: number;
  utahWithholdingCents: number;
  suggestedUtahWithholdingCents: number;
  ssEmployeeCents: number;
  medicareEmployeeCents: number;
  addlMedicareCents: number;
  ssEmployerCents: number;
  medicareEmployerCents: number;
  futaCents: number;
  utahUiCents: number;
  netPayCents: number;
  exactTaxYear: boolean;
}

export function computePaycheck(input: PaycheckInput): PaycheckResult {
  const { table, exact } = getTaxYear(input.payYear);
  const gross = input.grossCents;
  const federalWages = Math.max(0, gross - input.retirement401kCents + input.shareholderHealthCents);
  const ficaWages = gross;

  const ssBase = toCents(table.ssWageBase);
  const ssWages = Math.max(0, Math.min(ficaWages, ssBase - input.ytd.ssWagesCents));
  const addlThreshold = toCents(table.addlMedicareThreshold);
  const addlMedicareWages = Math.max(0, input.ytd.medicareWagesCents + ficaWages - Math.max(addlThreshold, input.ytd.medicareWagesCents));
  const futaWages = input.futaExempt ? 0 : Math.max(0, Math.min(gross, toCents(table.futaWageBase) - input.ytd.futaWagesCents));
  const utahUiWages = input.utahUiExempt ? 0 : Math.max(0, Math.min(gross, toCents(table.utahUiWageBase) - input.ytd.utahUiWagesCents));

  const suggestedFed = federalWithholdingCents(federalWages, input.periodsPerYear, input.w4, table);
  const suggestedUt = utahWithholdingCents(federalWages, input.periodsPerYear, input.w4.filingStatus, table);
  const fed = input.federalWithholdingOverrideCents ?? suggestedFed;
  const ut = input.utahWithholdingOverrideCents ?? suggestedUt;

  const ssEe = pct(ssWages, table.ssRate);
  const medEe = pct(ficaWages, table.medicareRate);
  const addl = pct(addlMedicareWages, table.addlMedicareRate);

  return {
    federalWagesCents: federalWages,
    stateWagesCents: federalWages,
    ssWagesCents: ssWages,
    medicareWagesCents: ficaWages,
    addlMedicareWagesCents: addlMedicareWages,
    futaWagesCents: futaWages,
    utahUiWagesCents: utahUiWages,
    federalWithholdingCents: fed,
    suggestedFederalWithholdingCents: suggestedFed,
    utahWithholdingCents: ut,
    suggestedUtahWithholdingCents: suggestedUt,
    ssEmployeeCents: ssEe,
    medicareEmployeeCents: medEe,
    addlMedicareCents: addl,
    ssEmployerCents: pct(ssWages, table.ssRate),
    medicareEmployerCents: pct(ficaWages, table.medicareRate),
    futaCents: pct(futaWages, table.futaRate),
    utahUiCents: pct(utahUiWages, input.utahUiRate),
    netPayCents: gross - input.retirement401kCents - fed - ut - ssEe - medEe - addl,
    exactTaxYear: exact,
  };
}

export type GrossUpInput = Omit<PaycheckInput, "grossCents" | "federalWithholdingOverrideCents" | "utahWithholdingOverrideCents"> & {
  targetNetCents: number;
};

/**
 * Gross-up: the smallest gross pay whose take-home is at least the target,
 * with withholding from the W-4 / Pub 14 formulas and the same wage-base caps
 * as a real paycheck. Net rises with gross (every tax rate is under 100%), so
 * a binary search over cents finds it; rounding can leave net a cent over.
 */
export function grossUpForNet(input: GrossUpInput): { grossCents: number; result: PaycheckResult } {
  const { targetNetCents, ...rest } = input;
  const at = (grossCents: number) => computePaycheck({ ...rest, grossCents });
  const floor = targetNetCents + rest.retirement401kCents;
  let lo = Math.max(1, floor);
  let hi = Math.max(lo * 2, lo + 100_000);
  while (at(hi).netPayCents < targetNetCents) hi *= 2;
  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2);
    if (at(mid).netPayCents >= targetNetCents) hi = mid;
    else lo = mid + 1;
  }
  return { grossCents: lo, result: at(lo) };
}
