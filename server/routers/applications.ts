/**
 * Mortgage applications submitted on the website, read through its staff API.
 *
 * Every procedure requires a signed-in CRM user. Upstream failures are mapped
 * to precise tRPC errors so the page can tell "not connected" from "website
 * database down" from "no such application".
 */

import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import {
  deleteApplication,
  getApplication,
  isWebsiteStaffApiConfigured,
  listApplicationDocuments,
  listApplications,
  listDrafts,
  regenerateMismo,
  REVIEW_STATUSES,
  updateApplicationData,
  updateApplicationReview,
  WebsiteApiError,
} from "../websiteStaffApi";
import { applicationEditSchema } from "../applicationEdit";

function toTrpcError(err: unknown): TRPCError {
  if (err instanceof WebsiteApiError) {
    const code =
      err.status === 404 ? "NOT_FOUND"
      : err.status === 401 ? "UNAUTHORIZED"
      : err.status === 503 ? "SERVICE_UNAVAILABLE"
      : err.status === 502 ? "BAD_GATEWAY"
      : "INTERNAL_SERVER_ERROR";
    return new TRPCError({ code, message: err.message });
  }
  return new TRPCError({
    code: "INTERNAL_SERVER_ERROR",
    message: err instanceof Error ? err.message : "Unexpected error talking to the website",
  });
}

export const applicationsRouter = router({
  /** Whether the CRM has been pointed at the website. Cheap; no network call. */
  status: protectedProcedure.query(() => ({
    configured: isWebsiteStaffApiConfigured(),
  })),

  list: protectedProcedure
    .input(
      z
        .object({
          q: z.string().trim().max(200).optional(),
          page: z.number().int().min(1).max(10_000).optional(),
        })
        .optional()
    )
    .query(async ({ input }) => {
      try {
        return await listApplications({ q: input?.q, page: input?.page });
      } catch (err) {
        throw toTrpcError(err);
      }
    }),

  get: protectedProcedure
    .input(z.object({ refNumber: z.string().trim().min(1).max(20) }))
    .query(async ({ input }) => {
      try {
        return await getApplication(input.refNumber);
      } catch (err) {
        throw toTrpcError(err);
      }
    }),

  /** Status and notes are the only fields the CRM may change on an application. */
  updateReview: protectedProcedure
    .input(
      z
        .object({
          refNumber: z.string().trim().min(1).max(20),
          reviewStatus: z.enum(REVIEW_STATUSES).optional(),
          staffNotes: z.string().max(10_000).nullable().optional(),
        })
        .refine((v) => v.reviewStatus !== undefined || v.staffNotes !== undefined, {
          message: "Nothing to update",
        })
    )
    .mutation(async ({ input, ctx }) => {
      try {
        const updated = await updateApplicationReview(input.refNumber, {
          reviewStatus: input.reviewStatus,
          staffNotes: input.staffNotes,
        });
        console.log(
          `[Applications] ${ctx.user.email ?? ctx.user.openId} set ${updated.refNumber} to ${updated.reviewStatus}`
        );
        return updated;
      } catch (err) {
        throw toTrpcError(err);
      }
    }),

  /** Correct borrower-entered fields; the website re-validates and regenerates the MISMO document. */
  updateData: protectedProcedure
    .input(z.object({ refNumber: z.string().trim().min(1).max(20), edit: applicationEditSchema }))
    .mutation(async ({ input, ctx }) => {
      const fields = Object.keys(input.edit);
      if (fields.length === 0) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Nothing to update" });
      }
      try {
        const result = await updateApplicationData(input.refNumber, input.edit);
        console.log(`[Applications] ${ctx.user.email ?? ctx.user.openId} edited ${result.refNumber}: ${result.fields.join(", ")}`);
        return result;
      } catch (err) {
        throw toTrpcError(err);
      }
    }),

  /** Rebuild the MISMO document with the website's current generator. */
  regenerateMismo: protectedProcedure
    .input(z.object({ refNumber: z.string().trim().min(1).max(20) }))
    .mutation(async ({ input, ctx }) => {
      try {
        const result = await regenerateMismo(input.refNumber);
        console.log(`[Applications] ${ctx.user.email ?? ctx.user.openId} regenerated MISMO for ${result.refNumber}`);
        return result;
      } catch (err) {
        throw toTrpcError(err);
      }
    }),

  delete: protectedProcedure
    .input(z.object({ refNumber: z.string().trim().min(1).max(20) }))
    .mutation(async ({ input, ctx }) => {
      try {
        const result = await deleteApplication(input.refNumber);
        console.log(
          `[Applications] ${ctx.user.email ?? ctx.user.openId} deleted ${result.refNumber}` +
            ` (documents: ${result.documentsRemoved}, drafts: ${result.draftsRemoved})`
        );
        return result;
      } catch (err) {
        throw toTrpcError(err);
      }
    }),

  /** Documents the borrower uploaded through the website portal. */
  documents: protectedProcedure
    .input(z.object({ refNumber: z.string().trim().min(1).max(20) }))
    .query(async ({ input }) => {
      try {
        return await listApplicationDocuments(input.refNumber);
      } catch (err) {
        throw toTrpcError(err);
      }
    }),

  drafts: protectedProcedure
    .input(z.object({ page: z.number().int().min(1).max(10_000).optional() }).optional())
    .query(async ({ input }) => {
      try {
        return await listDrafts({ page: input?.page });
      } catch (err) {
        throw toTrpcError(err);
      }
    }),
});
