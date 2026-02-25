import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { leadsRouter } from "./routers/leads";
import { webinarsRouter } from "./routers/webinars";
import { landingPagesRouter } from "./routers/landingPages";
import { dealsRouter } from "./routers/deals";
import { smsRouter } from "./routers/sms";
import { analyticsRouter } from "./routers/analytics";
import { schedulingRouter } from "./routers/scheduling";
import { integrationsRouter } from "./routers/integrations";
import { mediaRouter } from "./routers/media";
import { userManagementRouter } from "./routers/userManagement";

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),
  leads: leadsRouter,
  webinars: webinarsRouter,
  landingPages: landingPagesRouter,
  deals: dealsRouter,
  sms: smsRouter,
  analytics: analyticsRouter,
  scheduling: schedulingRouter,
  integrations: integrationsRouter,
  media: mediaRouter,
  userManagement: userManagementRouter,
});

export type AppRouter = typeof appRouter;
