import { z } from "zod";
import { protectedProcedure, publicProcedure, router } from "../_core/trpc";
import {
  getAvailabilityByUser, upsertAvailability, createBooking, getBookings,
  getBookingsByDateRange, getUserBySchedulingSlug, updateUserSchedulingSlug,
  logActivity, updateLead,
} from "../db";

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
      notes: z.string().optional(),
      leadId: z.number().optional(),
    }))
    .mutation(async ({ input }) => {
      const user = await getUserBySchedulingSlug(input.agentSlug);
      if (!user) throw new Error("Agent not found");
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
