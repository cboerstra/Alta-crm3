// ─── Payroll data access ─────────────────────────────────────────────────────
// Kept apart from db.ts so the payroll feature lives in a few files.

import { and, asc, eq, gte, lte } from "drizzle-orm";
import { getDb } from "./db";
import {
  payrollCompanies, InsertPayrollCompany, PayrollCompany,
  payrollPeople, InsertPayrollPerson, PayrollPerson,
  payrollPaychecks, PayrollPaycheck,
  payrollDeposits, InsertPayrollDeposit,
} from "../drizzle/schema";
import { computePaycheck, grossUpForNet, type FilingStatus, type W4 } from "../shared/payrollTax";
import type { ReportCompany, ReportDeposit, ReportPaycheck, ReportPerson } from "../shared/payrollReports";

async function db() {
  const d = await getDb();
  if (!d) throw new Error("DB unavailable");
  return d;
}

export const PERIODS_PER_YEAR: Record<PayrollCompany["payFrequency"], number> = {
  weekly: 52, biweekly: 26, semimonthly: 24, monthly: 12, quarterly: 4, annual: 1,
};

// ─── Companies ───────────────────────────────────────────────────────────────
export async function listCompanies() {
  return (await db()).select().from(payrollCompanies).orderBy(asc(payrollCompanies.name));
}

export async function getCompany(id: number): Promise<PayrollCompany | undefined> {
  const [row] = await (await db()).select().from(payrollCompanies).where(eq(payrollCompanies.id, id));
  return row;
}

export async function createCompany(data: InsertPayrollCompany) {
  const [r] = await (await db()).insert(payrollCompanies).values(data);
  return (r as any).insertId as number;
}

export async function updateCompany(id: number, data: Partial<InsertPayrollCompany>) {
  await (await db()).update(payrollCompanies).set(data).where(eq(payrollCompanies.id, id));
}

export async function deleteCompany(id: number) {
  const d = await db();
  await d.delete(payrollPaychecks).where(eq(payrollPaychecks.companyId, id));
  await d.delete(payrollDeposits).where(eq(payrollDeposits.companyId, id));
  await d.delete(payrollPeople).where(eq(payrollPeople.companyId, id));
  await d.delete(payrollCompanies).where(eq(payrollCompanies.id, id));
}

// ─── People ──────────────────────────────────────────────────────────────────
export async function listPeople(companyId: number) {
  return (await db()).select().from(payrollPeople)
    .where(eq(payrollPeople.companyId, companyId))
    .orderBy(asc(payrollPeople.lastName), asc(payrollPeople.firstName));
}

export async function getPerson(id: number): Promise<PayrollPerson | undefined> {
  const [row] = await (await db()).select().from(payrollPeople).where(eq(payrollPeople.id, id));
  return row;
}

export async function createPerson(data: InsertPayrollPerson) {
  const [r] = await (await db()).insert(payrollPeople).values(data);
  return (r as any).insertId as number;
}

export async function updatePerson(id: number, data: Partial<InsertPayrollPerson>) {
  await (await db()).update(payrollPeople).set(data).where(eq(payrollPeople.id, id));
}

export async function deletePerson(id: number) {
  const d = await db();
  await d.delete(payrollPaychecks).where(eq(payrollPaychecks.personId, id));
  await d.delete(payrollPeople).where(eq(payrollPeople.id, id));
}

// ─── Paychecks ───────────────────────────────────────────────────────────────
const yearRange = (year: number) => [`${year}-01-01`, `${year}-12-31`] as const;

export async function listPaychecks(companyId: number, year: number) {
  const [from, to] = yearRange(year);
  return (await db()).select().from(payrollPaychecks)
    .where(and(eq(payrollPaychecks.companyId, companyId), gte(payrollPaychecks.payDate, from), lte(payrollPaychecks.payDate, to)))
    .orderBy(asc(payrollPaychecks.payDate), asc(payrollPaychecks.id));
}

export async function getPaycheck(id: number): Promise<PayrollPaycheck | undefined> {
  const [row] = await (await db()).select().from(payrollPaychecks).where(eq(payrollPaychecks.id, id));
  return row;
}

export function w4Of(p: PayrollPerson): W4 {
  return {
    filingStatus: p.filingStatus as FilingStatus,
    multipleJobs: p.multipleJobs,
    dependentsCredit: Number(p.dependentsCredit),
    otherIncome: Number(p.otherIncome),
    deductions: Number(p.deductions),
    extraWithholding: Number(p.extraWithholding),
  };
}

export interface PaycheckEntry {
  payDate: string;
  grossCents: number;
  retirement401kCents: number;
  shareholderHealthCents: number;
  federalWithholdingCents: number | null; // null = use the formula
  utahWithholdingCents: number | null;
}

/** Year-to-date wage totals for a person from paychecks dated before `payDate` (excluding one id). */
async function ytdBefore(companyId: number, personId: number, payDate: string, excludeId?: number) {
  const year = Number(payDate.slice(0, 4));
  const rows = (await listPaychecks(companyId, year))
    .filter((c) => c.personId === personId && c.id !== excludeId && c.payDate < payDate);
  return {
    ssWagesCents: rows.reduce((a, c) => a + c.ssWagesCents, 0),
    medicareWagesCents: rows.reduce((a, c) => a + c.medicareWagesCents, 0),
    futaWagesCents: rows.reduce((a, c) => a + c.futaWagesCents, 0),
    utahUiWagesCents: rows.reduce((a, c) => a + c.utahUiWagesCents, 0),
  };
}

/** What a paycheck would look like, without saving it. */
export async function previewPaycheck(company: PayrollCompany, person: PayrollPerson, entry: PaycheckEntry, excludeId?: number) {
  return computePaycheck({
    grossCents: entry.grossCents,
    retirement401kCents: entry.retirement401kCents,
    shareholderHealthCents: entry.shareholderHealthCents,
    periodsPerYear: PERIODS_PER_YEAR[company.payFrequency],
    payYear: Number(entry.payDate.slice(0, 4)),
    w4: w4Of(person),
    futaExempt: person.futaExempt,
    utahUiExempt: person.utahUiExempt,
    utahUiRate: Number(company.utahUiRate) / 100,
    ytd: await ytdBefore(company.id, person.id, entry.payDate, excludeId),
    federalWithholdingOverrideCents: entry.federalWithholdingCents,
    utahWithholdingOverrideCents: entry.utahWithholdingCents,
  });
}

/** Gross pay needed for a target take-home on this date, using the formula withholding. */
export async function grossUpPaycheck(
  company: PayrollCompany,
  person: PayrollPerson,
  entry: { payDate: string; targetNetCents: number; retirement401kCents: number; shareholderHealthCents: number },
  excludeId?: number,
) {
  return grossUpForNet({
    targetNetCents: entry.targetNetCents,
    retirement401kCents: entry.retirement401kCents,
    shareholderHealthCents: entry.shareholderHealthCents,
    periodsPerYear: PERIODS_PER_YEAR[company.payFrequency],
    payYear: Number(entry.payDate.slice(0, 4)),
    w4: w4Of(person),
    futaExempt: person.futaExempt,
    utahUiExempt: person.utahUiExempt,
    utahUiRate: Number(company.utahUiRate) / 100,
    ytd: await ytdBefore(company.id, person.id, entry.payDate, excludeId),
  });
}

function storedFields(r: ReturnType<typeof computePaycheck>) {
  const { suggestedFederalWithholdingCents, suggestedUtahWithholdingCents, exactTaxYear, ...stored } = r;
  return stored;
}

export async function savePaycheck(
  company: PayrollCompany,
  person: PayrollPerson,
  entry: PaycheckEntry & { periodStart?: string | null; periodEnd?: string | null; memo?: string | null },
  opts: { id?: number; userId: number },
) {
  const r = await previewPaycheck(company, person, entry, opts.id);
  const row = {
    companyId: company.id,
    personId: person.id,
    payDate: entry.payDate,
    periodStart: entry.periodStart ?? null,
    periodEnd: entry.periodEnd ?? null,
    grossCents: entry.grossCents,
    retirement401kCents: entry.retirement401kCents,
    shareholderHealthCents: entry.shareholderHealthCents,
    withholdingOverridden: entry.federalWithholdingCents !== null || entry.utahWithholdingCents !== null,
    memo: entry.memo ?? null,
    ...storedFields(r),
  };
  const d = await db();
  let id = opts.id;
  if (id) {
    const before = await getPaycheck(id);
    await d.update(payrollPaychecks).set(row).where(eq(payrollPaychecks.id, id));
    if (before && before.payDate.slice(0, 4) !== entry.payDate.slice(0, 4)) {
      await recomputeYear(company, person, Number(before.payDate.slice(0, 4)));
    }
  } else {
    const [res] = await d.insert(payrollPaychecks).values({ ...row, createdBy: opts.userId });
    id = (res as any).insertId as number;
  }
  // A back-dated or edited check moves every later check's wage-base position
  await recomputeYear(company, person, Number(entry.payDate.slice(0, 4)));
  return id!;
}

export async function deletePaycheck(id: number) {
  const check = await getPaycheck(id);
  if (!check) return;
  await (await db()).delete(payrollPaychecks).where(eq(payrollPaychecks.id, id));
  const [company, person] = await Promise.all([getCompany(check.companyId), getPerson(check.personId)]);
  if (company && person) await recomputeYear(company, person, Number(check.payDate.slice(0, 4)));
}

/**
 * Re-run the wage-base caps for one person's year in pay-date order. Income
 * tax withheld is kept as stored — it was already taken from the check — so
 * only Social Security, Medicare, FUTA and Utah UI amounts can change.
 */
export async function recomputeYear(company: PayrollCompany, person: PayrollPerson, year: number) {
  const d = await db();
  const checks = (await listPaychecks(company.id, year)).filter((c) => c.personId === person.id);
  const ytd = { ssWagesCents: 0, medicareWagesCents: 0, futaWagesCents: 0, utahUiWagesCents: 0 };
  for (const c of checks) {
    const r = computePaycheck({
      grossCents: c.grossCents,
      retirement401kCents: c.retirement401kCents,
      shareholderHealthCents: c.shareholderHealthCents,
      periodsPerYear: PERIODS_PER_YEAR[company.payFrequency],
      payYear: year,
      w4: w4Of(person),
      futaExempt: person.futaExempt,
      utahUiExempt: person.utahUiExempt,
      utahUiRate: Number(company.utahUiRate) / 100,
      ytd: { ...ytd },
      federalWithholdingOverrideCents: c.federalWithholdingCents,
      utahWithholdingOverrideCents: c.utahWithholdingCents,
    });
    const stored = storedFields(r);
    const changed = (Object.keys(stored) as (keyof typeof stored)[]).some((k) => stored[k] !== (c as any)[k]);
    if (changed) await d.update(payrollPaychecks).set(stored).where(eq(payrollPaychecks.id, c.id));
    ytd.ssWagesCents += r.ssWagesCents;
    ytd.medicareWagesCents += r.medicareWagesCents;
    ytd.futaWagesCents += r.futaWagesCents;
    ytd.utahUiWagesCents += r.utahUiWagesCents;
  }
}

/** After a company or person setting changes (UI rate, exemptions), refresh the year's caps. */
export async function recomputeCompanyYear(companyId: number, year: number) {
  const company = await getCompany(companyId);
  if (!company) return;
  for (const p of await listPeople(companyId)) await recomputeYear(company, p, year);
}

// ─── Deposits ────────────────────────────────────────────────────────────────
export async function listDeposits(companyId: number, year: number) {
  return (await db()).select().from(payrollDeposits)
    .where(and(eq(payrollDeposits.companyId, companyId), eq(payrollDeposits.taxYear, year)))
    .orderBy(asc(payrollDeposits.depositDate));
}

export async function createDeposit(data: InsertPayrollDeposit) {
  const [r] = await (await db()).insert(payrollDeposits).values(data);
  return (r as any).insertId as number;
}

export async function getDeposit(id: number) {
  const [row] = await (await db()).select().from(payrollDeposits).where(eq(payrollDeposits.id, id));
  return row;
}

export async function updateDeposit(id: number, data: Partial<InsertPayrollDeposit>) {
  await (await db()).update(payrollDeposits).set(data).where(eq(payrollDeposits.id, id));
}

export async function deleteDeposit(id: number) {
  await (await db()).delete(payrollDeposits).where(eq(payrollDeposits.id, id));
}

// ─── Report inputs ───────────────────────────────────────────────────────────
const utcDate = (s: string | null) => (s ? new Date(`${s}T00:00:00Z`) : null);

export function toReportCompany(c: PayrollCompany): ReportCompany {
  return {
    id: c.id,
    name: c.name,
    ein: c.ein,
    utahWithholdingAccount: c.utahWithholdingAccount,
    utahUiAccount: c.utahUiAccount,
    utahUiRate: Number(c.utahUiRate) / 100,
    depositSchedule: c.depositSchedule,
  };
}

export async function loadReportData(companyId: number, year: number) {
  const company = await getCompany(companyId);
  if (!company) return null;
  const [people, checks, deposits] = await Promise.all([
    listPeople(companyId), listPaychecks(companyId, year), listDeposits(companyId, year),
  ]);
  return {
    company: toReportCompany(company),
    raw: company,
    people: people.map((p): ReportPerson => ({
      id: p.id, firstName: p.firstName, lastName: p.lastName, ssnLast4: p.ssnLast4,
      futaExempt: p.futaExempt, utahUiExempt: p.utahUiExempt,
    })),
    checks: checks.map((c): ReportPaycheck => ({
      ...c,
      payDate: utcDate(c.payDate)!,
      periodStart: utcDate(c.periodStart),
      periodEnd: utcDate(c.periodEnd),
    })),
    deposits: deposits.map((d): ReportDeposit => ({
      agency: d.agency, taxYear: d.taxYear, quarter: d.quarter, amountCents: d.amountCents,
    })),
  };
}

