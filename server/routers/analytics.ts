import { protectedProcedure, router } from "../_core/trpc";
import { getDashboardMetrics, getRevenueMetrics, getLeadsBySource, getLeadsByStage } from "../db";

export const analyticsRouter = router({
  dashboard: protectedProcedure.query(() => getDashboardMetrics()),
  revenue: protectedProcedure.query(() => getRevenueMetrics()),
  leadsBySource: protectedProcedure.query(() => getLeadsBySource()),
  leadsByStage: protectedProcedure.query(() => getLeadsByStage()),
});
