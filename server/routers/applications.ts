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
  getApplication,
  isWebsiteStaffApiConfigured,
  listApplications,
  listDrafts,
  WebsiteApiError,
} from "../websiteStaffApi";

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
