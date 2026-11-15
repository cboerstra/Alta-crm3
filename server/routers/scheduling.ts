import { z } from "zod";
import { protectedProcedure, publicProcedure, router } from "../_core/trpc";
import {
  getAvailabilityByUser, upsertAvailability, createBooking, getBookings,
  getBookingsByDateRange, getUserBySchedulingSlug, updateUserSchedulingSlug,
  logActivity, updateLead, createLead, notifyAdminsBySms, getLandingPageBySlug,
} from "../db";
import { attributionInputSchema, clientIpFromRequest, normalizeAttribution, type AttributionInput } from "../meta/attribution";
import { trackCapturedLead, type TrackedLandingPage } from "../meta/leadTracking";
import { isAfterTodayInUtah, sendTourInvite, tourCampaign } from "../tourRequest";

export const schedulingRouter = router({
  getMyAvailability: protectedProcedure
    .query(({ ctx }) => getAvailabilityByUser(ctx.user.id)),

  setAvailability: protectedProcedure
    .input(z.object({
      slots: z.array(z.object({
        dayOfWeek: z.number().min(0).max(6),
        startTime: z.string(),
        endTime: z.string(),
      })),
    }))
    .mutation(({ input, ctx }) => upsertAvailability(ctx.user.id, input.slots)),

  setSchedulingSlug: protectedProcedure
    .input(z.object({ slug: z.string().min(2).regex(/^[a-z0-9-]+$/) }))
    .mutation(({ input, ctx }) => updateUserSchedulingSlug(ctx.user.id, input.slug)),

  getMyBookings: protectedProcedure
    .query(({ ctx }) => getBookings(ctx.user.id)),

  getPublicAvailability: publicProcedure
    .input(z.object({
      slug: z.string(),
      startDate: z.number(), // unix ms
      endDate: z.number(),
    }))
    .query(async ({ input }) => {
      const user = await getUserBySchedulingSlug(input.slug);
      if (!user) throw new Error("Agent not found");
      const availability = await getAvailabilityByUser(user.id);
      const existingBookings = await getBookingsByDateRange(
        user.id,
        new Date(input.startDate),
        new Date(input.endDate)
      );
      return {
        agent: { id: user.id, name: user.name, email: user.email },
        availability,
        existingBookings: existingBookings.map((b) => ({
          scheduledAt: b.scheduledAt,
          durationMinutes: b.durationMinutes,
        })),
      };
    }),

  book: publicProcedure
    .input(z.object({
      agentSlug: z.string(),
      guestName: z.string().min(1),
      guestEmail: z.string().email(),
      guestPhone: z.string().optional(),
      scheduledAt: z.number(),
      durationMinutes: z.number().default(30),
      notes: z.string().max(2000).optional(),
      leadId: z.number().optional(),
      // Set when the booking page was opened from a listing's "Request a tour" button.
      home: z.string().trim().min(1).max(200).optional(),
      // Tracking must never cost a booking, so bad values are dropped instead of rejected.
      src: z.string().regex(/^[a-z0-9-]+$/).max(128).optional().catch(undefined),
      attribution: attributionInputSchema.optional().catch(undefined),
    }))
    .mutation(async ({ input, ctx }) => {
      const user = await getUserBySchedulingSlug(input.agentSlug);
      if (!user) throw new Error("Agent not found");
      if (input.home) {
        return bookTour(user, input, {
          ip: clientIpFromRequest(ctx.req as any),
          userAgent: ctx.req.headers["user-agent"] ?? null,
        });
      }
      const id = await createBooking({
        userId: user.id,
        leadId: input.leadId,
        guestName: input.guestName,
        guestEmail: input.guestEmail,
        guestPhone: input.guestPhone,
        scheduledAt: new Date(input.scheduledAt),
        durationMinutes: input.durationMinutes,
        notes: input.notes,
        status: "confirmed",
      });
      if (input.leadId) {
        await updateLead(input.leadId, {
          stage: "consultation_booked",
          consultationBookedAt: new Date(input.scheduledAt),
        });
        await logActivity({
          leadId: input.leadId,
          type: "consultation_booked",
          title: "Consultation booked",
          content: `Booked with ${user.name} for ${new Date(input.scheduledAt).toLocaleString()}`,
        });
      }
      return { id };
    }),
});

type Agent = NonNullable<Awaited<ReturnType<typeof getUserBySchedulingSlug>>>;

async function bookTour(agent: Agent, input: {
  guestName: string; guestEmail: string; guestPhone?: string;
  scheduledAt: number; durationMinutes: number; notes?: string; home?: string;
  src?: string; attribution?: AttributionInput;
}, request: { ip?: string | null; userAgent?: string | null }) {
  const home = input.home!;
  const phone = input.guestPhone?.trim();
  if (!phone) throw new Error("Please add a phone number so we can confirm your tour.");
  const [firstName, ...rest] = input.guestName.trim().split(/\s+/);
  const start = new Date(input.scheduledAt);
  if (!isAfterTodayInUtah(start)) throw new Error("Tours can't be booked online for today. Please call or text to arrange one.");
  const page = input.src ? await getLandingPageBySlug(input.src) : undefined;

  const leadId = await createLead({
    firstName,
    lastName: rest.join(" ") || "-",
    email: input.guestEmail.trim().toLowerCase(),
    phone,
    source: "tour_request",
    campaign: tourCampaign(home),
    landingPageId: page?.id,
    stage: "new_lead",
  });
  const notes = [`Tour of ${home}`, input.notes?.trim()].filter(Boolean).join("\n");
  const id = await createBooking({
    userId: agent.id,
    leadId,
    guestName: input.guestName.trim(),
    guestEmail: input.guestEmail.trim(),
    guestPhone: phone,
    scheduledAt: start,
    durationMinutes: input.durationMinutes,
    notes,
    status: "confirmed",
  });
  await logActivity({
    leadId,
    type: "system",
    title: "Tour requested from website",
    content: `${home}\n${start.toLocaleString("en-US", { timeZone: "America/Denver" })} (Mountain)${input.src ? `\nCame from: ${input.src}` : ""}${input.notes?.trim() ? `\nNotes: ${input.notes.trim()}` : ""}`,
  });

  // Only ad and landing page traffic is tracked: a tour booked straight from a
  // listing page has nothing to attribute and shouldn't be reported to Meta.
  const attribution = normalizeAttribution(input.attribution, request);
  if (page || attribution.utmSource || attribution.utmCampaign || attribution.fbclid || attribution.gclid || attribution.metaAdId) {
    await trackCapturedLead({
      leadId,
      page: page as TrackedLandingPage | undefined,
      attribution,
      eventId: input.attribution?.eventId,
    }).catch((err) => console.error(`[Tour] Attribution failed for lead ${leadId}:`, err));
  }

  if (agent.email) {
    sendTourInvite({
      bookingId: id, home, guestName: input.guestName.trim(), guestEmail: input.guestEmail.trim(),
      guestPhone: phone, notes: input.notes?.trim() || undefined, start,
      durationMinutes: input.durationMinutes, agentName: agent.name ?? "Agent", agentEmail: agent.email,
    }).catch((err) => console.error(`[Tour] Invite email failed for booking ${id}:`, err));
  }
  notifyAdminsBySms(
    `Tour request: ${home} | ${input.guestName.trim()} ${phone} | ${start.toLocaleString("en-US", { timeZone: "America/Denver", dateStyle: "short", timeStyle: "short" })}`
  ).catch(() => {});

  return { id };
}
