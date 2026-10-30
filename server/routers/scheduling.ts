import { z } from "zod";
import { protectedProcedure, publicProcedure, router } from "../_core/trpc";
import {
  getAvailabilityByUser, upsertAvailability, createBooking, getBookings,
  getBookingsByDateRange, getUserBySchedulingSlug, updateUserSchedulingSlug,
  logActivity, updateLead, createLead, notifyAdminsBySms,
} from "../db";
import { sendTourInvite } from "../tourRequest";

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
    }))
    .mutation(async ({ input }) => {
      const user = await getUserBySchedulingSlug(input.agentSlug);
      if (!user) throw new Error("Agent not found");
      if (input.home) return bookTour(user, input);
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
}) {
  const home = input.home!;
  const phone = input.guestPhone?.trim();
  if (!phone) throw new Error("Please add a phone number so we can confirm your tour.");
  const [firstName, ...rest] = input.guestName.trim().split(/\s+/);
  const start = new Date(input.scheduledAt);

  const leadId = await createLead({
    firstName,
    lastName: rest.join(" ") || "-",
    email: input.guestEmail.trim().toLowerCase(),
    phone,
    source: "tour_request",
    campaign: `freehomesearchutah.com — Tour: ${home}`,
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
    content: `${home}\n${start.toLocaleString("en-US", { timeZone: "America/Denver" })} (Mountain)${input.notes?.trim() ? `\nNotes: ${input.notes.trim()}` : ""}`,
  });

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
