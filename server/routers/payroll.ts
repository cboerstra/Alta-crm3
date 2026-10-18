import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { adminProcedure, router } from "../_core/trpc";
import {
  listCompanies, getCompany, createCompany, updateCompany, deleteCompany,
  listPeople, getPerson, createPerson, updatePerson, deletePerson,
  listPaychecks, getPaycheck, previewPaycheck, grossUpPaycheck, savePaycheck, deletePaycheck,
  listDeposits, getDeposit, createDeposit, updateDeposit, deleteDeposit,
  recomputeCompanyYear, loadReportData,
} from "../payrollDb";
import {
  buildForm941, buildForm940, buildUtahForm3, buildUtahWithholding, buildW2s, filingCalendar,
} from "../../shared/payrollReports";
import { getTaxYear } from "../../shared/payrollTax";

// Payroll holds tax IDs and pay amounts, so every procedure is admin-only.

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD");
const cents = z.number().int().min(0);
const year = z.number().int().min(2020).max(2100);
const quarter = z.number().int().min(1).max(4);

const companyFields = z.object({
  name: z.string().min(1),
  ein: z.string().regex(/^\d{2}-?\d{7}$/, "EIN is 9 digits (12-3456789)").or(z.literal("")).optional(),
  taxClassification: z.enum(["s_corp", "c_corp", "partnership", "disregarded"]),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().max(2).optional(),
  zip: z.string().max(10).optional(),
  utahWithholdingAccount: z.string().optional(),
  utahUiAccount: z.string().optional(),
  utahUiRate: z.number().min(0).max(20), // percent
  depositSchedule: z.enum(["monthly", "semiweekly"]),
  utahFilingFrequency: z.enum(["monthly", "quarterly", "annual"]),
  payFrequency: z.enum(["weekly", "biweekly", "semimonthly", "monthly", "quarterly", "annual"]),
  isActive: z.boolean().optional(),
  notes: z.string().optional(),
});

const personFields = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  ssnLast4: z.string().regex(/^\d{4}$/, "Last 4 digits only").or(z.literal("")).optional(),
  relationship: z.enum(["owner", "spouse", "other"]),
  filingStatus: z.enum(["single", "married_joint", "head_of_household"]),
  multipleJobs: z.boolean(),
  dependentsCredit: z.number().min(0),
  otherIncome: z.number().min(0),
  deductions: z.number().min(0),
  extraWithholding: z.number().min(0),
  futaExempt: z.boolean(),
  utahUiExempt: z.boolean(),
  isActive: z.boolean().optional(),
});

const paycheckFields = z.object({
  companyId: z.number(),
  personId: z.number(),
  payDate: isoDate,
  periodStart: isoDate.nullable().optional(),
  periodEnd: isoDate.nullable().optional(),
  grossCents: cents.min(1),
  retirement401kCents: cents,
  shareholderHealthCents: cents,
  federalWithholdingCents: cents.nullable(),
  utahWithholdingCents: cents.nullable(),
  memo: z.string().nullable().optional(),
});

const depositFields = z.object({
  companyId: z.number(),
  agency: z.enum(["irs_941", "irs_940", "utah_withholding", "utah_ui"]),
  taxYear: year,
  quarter: quarter.nullable(),
  amountCents: cents.min(1),
  depositDate: isoDate,
  confirmation: z.string().optional(),
});

/** 940 deposits are annual; everything else needs its quarter. */
function checkDeposit<T extends z.infer<typeof depositFields>>(input: T): T {
  if (input.agency !== "irs_940" && input.quarter === null) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Pick the quarter this deposit is for" });
  }
  return { ...input, quarter: input.agency === "irs_940" ? null : input.quarter };
}

const money = (n: number) => n.toFixed(2);

async function requireCompany(id: number) {
  const c = await getCompany(id);
  if (!c) throw new TRPCError({ code: "NOT_FOUND", message: "Company not found" });
  return c;
}

async function requirePerson(id: number, companyId: number) {
  const p = await getPerson(id);
  if (!p || p.companyId !== companyId) throw new TRPCError({ code: "NOT_FOUND", message: "Person not found for this company" });
  return p;
}

async function requireReportData(companyId: number, y: number) {
  const data = await loadReportData(companyId, y);
  if (!data) throw new TRPCError({ code: "NOT_FOUND", message: "Company not found" });
  return data;
}

export const payrollRouter = router({
  // ─── Companies ─────────────────────────────────────────────────────────────
  listCompanies: adminProcedure.query(() => listCompanies()),

  createCompany: adminProcedure.input(companyFields).mutation(async ({ input, ctx }) => {
    const id = await createCompany({ ...input, utahUiRate: input.utahUiRate.toFixed(3), createdBy: ctx.user.id });
    return { id };
  }),

  updateCompany: adminProcedure
    .input(companyFields.partial().extend({ id: z.number(), recomputeYear: year.optional() }))
    .mutation(async ({ input }) => {
      await requireCompany(input.id);
      const { id, utahUiRate, recomputeYear, ...rest } = input;
      await updateCompany(id, { ...rest, ...(utahUiRate !== undefined ? { utahUiRate: utahUiRate.toFixed(3) } : {}) });
      // A new UI rate or pay frequency changes the stored amounts for the year being viewed
      if (recomputeYear) await recomputeCompanyYear(id, recomputeYear);
      return { success: true };
    }),

  deleteCompany: adminProcedure.input(z.object({ id: z.number() })).mutation(async ({ input }) => {
    await requireCompany(input.id);
    await deleteCompany(input.id);
    return { success: true };
  }),

  // ─── People ────────────────────────────────────────────────────────────────
  listPeople: adminProcedure.input(z.object({ companyId: z.number() })).query(({ input }) => listPeople(input.companyId)),

  createPerson: adminProcedure
    .input(personFields.extend({ companyId: z.number() }))
    .mutation(async ({ input }) => {
      await requireCompany(input.companyId);
      const id = await createPerson({
        ...input,
        dependentsCredit: money(input.dependentsCredit),
        otherIncome: money(input.otherIncome),
        deductions: money(input.deductions),
        extraWithholding: money(input.extraWithholding),
      });
      return { id };
    }),

  updatePerson: adminProcedure
    .input(personFields.partial().extend({ id: z.number(), recomputeYear: year.optional() }))
    .mutation(async ({ input }) => {
      const person = await getPerson(input.id);
      if (!person) throw new TRPCError({ code: "NOT_FOUND", message: "Person not found" });
      const { id, recomputeYear, dependentsCredit, otherIncome, deductions, extraWithholding, ...rest } = input;
      await updatePerson(id, {
        ...rest,
        ...(dependentsCredit !== undefined ? { dependentsCredit: money(dependentsCredit) } : {}),
        ...(otherIncome !== undefined ? { otherIncome: money(otherIncome) } : {}),
        ...(deductions !== undefined ? { deductions: money(deductions) } : {}),
        ...(extraWithholding !== undefined ? { extraWithholding: money(extraWithholding) } : {}),
      });
      // Exemption changes move FUTA / Utah UI amounts on checks already entered
      if (recomputeYear) await recomputeCompanyYear(person.companyId, recomputeYear);
      return { success: true };
    }),

  deletePerson: adminProcedure.input(z.object({ id: z.number() })).mutation(async ({ input }) => {
    await deletePerson(input.id);
    return { success: true };
  }),

  // ─── Paychecks ─────────────────────────────────────────────────────────────
  listPaychecks: adminProcedure
    .input(z.object({ companyId: z.number(), year }))
    .query(({ input }) => listPaychecks(input.companyId, input.year)),

  previewPaycheck: adminProcedure
    .input(paycheckFields.extend({ id: z.number().optional() }))
    .query(async ({ input }) => {
      const company = await requireCompany(input.companyId);
      const person = await requirePerson(input.personId, input.companyId);
      return previewPaycheck(company, person, input, input.id);
    }),

  grossUp: adminProcedure
    .input(z.object({
      companyId: z.number(),
      personId: z.number(),
      payDate: isoDate,
      targetNetCents: cents.min(1).max(100_000_000),
      retirement401kCents: cents,
      shareholderHealthCents: cents,
      id: z.number().optional(), // when editing, leave this check out of year-to-date
    }))
    .query(async ({ input }) => {
      const company = await requireCompany(input.companyId);
      const person = await requirePerson(input.personId, input.companyId);
      return grossUpPaycheck(company, person, input, input.id);
    }),

  savePaycheck: adminProcedure
    .input(paycheckFields.extend({ id: z.number().optional() }))
    .mutation(async ({ input, ctx }) => {
      const company = await requireCompany(input.companyId);
      const person = await requirePerson(input.personId, input.companyId);
      if (input.id) {
        const existing = await getPaycheck(input.id);
        if (!existing || existing.companyId !== company.id) throw new TRPCError({ code: "NOT_FOUND", message: "Paycheck not found" });
      }
      if (input.retirement401kCents > input.grossCents) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "401(k) deferral can't exceed gross pay" });
      }
      const id = await savePaycheck(company, person, input, { id: input.id, userId: ctx.user.id });
      return { id };
    }),

  deletePaycheck: adminProcedure.input(z.object({ id: z.number() })).mutation(async ({ input }) => {
    await deletePaycheck(input.id);
    return { success: true };
  }),

  // ─── Deposits ──────────────────────────────────────────────────────────────
  listDeposits: adminProcedure
    .input(z.object({ companyId: z.number(), year }))
    .query(({ input }) => listDeposits(input.companyId, input.year)),

  createDeposit: adminProcedure.input(depositFields).mutation(async ({ input, ctx }) => {
    await requireCompany(input.companyId);
    const id = await createDeposit({ ...checkDeposit(input), createdBy: ctx.user.id });
    return { id };
  }),

  updateDeposit: adminProcedure
    .input(depositFields.extend({ id: z.number() }))
    .mutation(async ({ input }) => {
      const existing = await getDeposit(input.id);
      if (!existing || existing.companyId !== input.companyId) throw new TRPCError({ code: "NOT_FOUND", message: "Deposit not found" });
      const { id, ...rest } = input;
      await updateDeposit(id, { ...checkDeposit(rest), confirmation: rest.confirmation ?? null });
      return { success: true };
    }),

  deleteDeposit: adminProcedure.input(z.object({ id: z.number() })).mutation(async ({ input }) => {
    await deleteDeposit(input.id);
    return { success: true };
  }),

  // ─── Reports ───────────────────────────────────────────────────────────────
  quarterReports: adminProcedure
    .input(z.object({ companyId: z.number(), year, quarter }))
    .query(async ({ input }) => {
      const d = await requireReportData(input.companyId, input.year);
      return {
        exactTaxYear: getTaxYear(input.year).exact,
        form941: buildForm941(d.company, d.checks, d.deposits, input.year, input.quarter),
        utahWithholding: buildUtahWithholding(d.company, d.checks, d.deposits, input.year, input.quarter),
        utahForm3: buildUtahForm3(d.company, d.people, d.checks, d.deposits, input.year, input.quarter),
        companyInfo: d.raw,
      };
    }),

  annualReports: adminProcedure
    .input(z.object({ companyId: z.number(), year }))
    .query(async ({ input }) => {
      const d = await requireReportData(input.companyId, input.year);
      return {
        exactTaxYear: getTaxYear(input.year).exact,
        form940: buildForm940(d.company, d.people, d.checks, d.deposits, input.year),
        w2: buildW2s(d.company, d.people, d.checks, d.deposits, input.year),
        companyInfo: d.raw,
      };
    }),

  /** One row per company per quarter: what's owed vs deposited, for the overview. */
  overview: adminProcedure.input(z.object({ year })).query(async ({ input }) => {
    const companies = (await listCompanies()).filter((c) => c.isActive);
    const rows = [];
    for (const c of companies) {
      const d = await requireReportData(c.id, input.year);
      const quarters = [1, 2, 3, 4].map((q) => {
        const f941 = buildForm941(d.company, d.checks, d.deposits, input.year, q);
        const ut = buildUtahWithholding(d.company, d.checks, d.deposits, input.year, q);
        const f3 = buildUtahForm3(d.company, d.people, d.checks, d.deposits, input.year, q);
        return {
          quarter: q,
          dueDate: f941.dueDate,
          wages: f941.line2,
          irsOwed: f941.line12, irsPaid: f941.line13,
          utahOwed: ut.utahWithheld, utahPaid: ut.payments,
          uiOwed: f3.contribution, uiPaid: f3.payments,
          paycheckCount: d.checks.filter((k) => Math.floor(k.payDate.getUTCMonth() / 3) + 1 === q).length,
        };
      });
      rows.push({ company: c, peopleCount: d.people.length, quarters });
    }
    return { rows, calendar: filingCalendar(input.year), exactTaxYear: getTaxYear(input.year).exact };
  }),
});
