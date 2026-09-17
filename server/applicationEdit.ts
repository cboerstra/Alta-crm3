/**
 * The borrower-entered fields a loan officer may correct from the CRM, as
 * the website's application form defines them. Kept in step with
 * applicationSchema in AltamortgageWebsite3/src/lib/schemas.ts; the website
 * validates the merged result again, so a drift here fails loudly rather
 * than silently.
 */

import { z } from "zod";

const money = z.number().nonnegative();

export const applicationEditSchema = z
  .object({
    loanPurpose: z.enum(["purchase", "refinance", "home-equity"]),
    propertyType: z.enum(["single-family", "condo", "townhome", "multi-family", "manufactured"]),
    propertyUse: z.enum(["primary", "secondary", "investment"]),
    purchasePrice: money,
    loanAmount: money,
    downPayment: money,
    currentBalance: money,

    firstName: z.string().trim().min(1),
    middleName: z.string().trim(),
    lastName: z.string().trim().min(1),
    suffix: z.string().trim(),
    dateOfBirth: z.string().trim().min(1),
    maritalStatus: z.enum(["single", "married", "separated", "divorced", "widowed"]),
    phone: z.string().trim().min(10),
    email: z.string().trim().email(),
    currentAddress: z
      .object({
        street: z.string().trim().min(1),
        city: z.string().trim().min(1),
        state: z.string().trim().min(2),
        zip: z.string().trim().min(5),
      })
      .partial(),
    yearsAtAddress: money,
    housingStatus: z.enum(["own", "rent", "other"]),
    monthlyHousingPayment: money,

    employmentStatus: z.enum(["employed", "self-employed", "retired", "other"]),
    employerName: z.string().trim(),
    jobTitle: z.string().trim(),
    yearsAtJob: money,
    monthlyIncome: money,

    monthlyAutoLoan: money,
    monthlyStudentLoan: money,
    monthlyCreditCards: money,
    monthlyChildSupport: money,
    monthlyOtherDebt: money,
    creditScoreRange: z.enum(["excellent", "good", "fair", "below-fair", "not-sure"]),

    usCitizen: z.enum(["yes", "permanent-resident", "other"]),
    bankruptcy: z.boolean(),
    foreclosure: z.boolean(),
    outstandingJudgments: z.boolean(),
    downPaymentBorrowed: z.boolean(),
    primaryResidence: z.boolean(),
    veteran: z.boolean(),
    firstTimeBuyer: z.boolean(),
  })
  .partial()
  .strict();

export type ApplicationEdit = z.infer<typeof applicationEditSchema>;
