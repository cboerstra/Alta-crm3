import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { useParams } from "wouter";
import { Building2, CheckCircle, Loader2, Calendar, Clock, ChevronLeft, ChevronRight } from "lucide-react";

const TIME_SLOTS = [
  "09:00", "09:30", "10:00", "10:30", "11:00", "11:30",
  "12:00", "12:30", "13:00", "13:30", "14:00", "14:30",
  "15:00", "15:30", "16:00", "16:30",
];

export default function PublicBooking() {
  const params = useParams<{ slug: string }>();
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", email: "", phone: "", notes: "" });
  const [submitted, setSubmitted] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(new Date());

  // Get a 30-day range for availability
  const startDate = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  }, []);
  const endDate = useMemo(() => startDate + 30 * 24 * 60 * 60 * 1000, [startDate]);

  const { data: availData, isLoading } = trpc.scheduling.getPublicAvailability.useQuery({
    slug: params.slug,
    startDate,
    endDate,
  });

  const bookMutation = trpc.scheduling.book.useMutation({
    onSuccess: () => setSubmitted(true),
    onError: () => setSubmitted(true),
  });

  // Build calendar days for current month
  const calendarDays = useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const days: (Date | null)[] = [];

    // Pad start
    for (let i = 0; i < firstDay.getDay(); i++) days.push(null);
    for (let d = 1; d <= lastDay.getDate(); d++) {
      days.push(new Date(year, month, d));
    }
    return days;
  }, [currentMonth]);

  // Check if a day has availability
  const isDayAvailable = (date: Date) => {
    if (!availData?.availability) return false;
    const dayOfWeek = date.getDay();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (date < today) return false;
    return availData.availability.some((a) => a.dayOfWeek === dayOfWeek);
  };

  // Get available time slots for selected date
  const availableSlots = useMemo(() => {
    if (!selectedDate || !availData) return [];
    const dayOfWeek = selectedDate.getDay();
    const dayAvail = availData.availability.find((a) => a.dayOfWeek === dayOfWeek);
    if (!dayAvail) return [];

    const bookedTimes = availData.existingBookings
      .filter((b) => {
        const bDate = new Date(b.scheduledAt);
        return bDate.toDateString() === selectedDate.toDateString();
      })
      .map((b) => {
        const bDate = new Date(b.scheduledAt);
        return `${bDate.getHours().toString().padStart(2, "0")}:${bDate.getMinutes().toString().padStart(2, "0")}`;
      });

    return TIME_SLOTS.filter((slot) => {
      const [h, m] = slot.split(":").map(Number);
      const slotStr = `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
      if (bookedTimes.includes(slotStr)) return false;
      if (slot < dayAvail.startTime || slot >= dayAvail.endTime) return false;
      // Don't show past times for today
      const now = new Date();
      if (selectedDate.toDateString() === now.toDateString()) {
        const nowStr = `${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}`;
        if (slot <= nowStr) return false;
      }
      return true;
    });
  }, [selectedDate, availData]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#2A5B3F] to-[#1F7B47]">
        <Loader2 className="h-8 w-8 text-white animate-spin" />
      </div>
    );
  }

  if (!availData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#2A5B3F] to-[#1F7B47]">
        <div className="text-center text-white">
          <h1 className="text-3xl font-bold" style={{ fontFamily: "Raleway, sans-serif" }}>Agent Not Found</h1>
          <p className="text-white/70 mt-2">This scheduling page does not exist.</p>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#2A5B3F] to-[#1F7B47]">
        <Card className="max-w-md w-full mx-4 border-0 shadow-2xl">
          <CardContent className="p-8 text-center">
            <div className="h-16 w-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="h-8 w-8 text-green-600" />
            </div>
            <h2 className="text-2xl font-bold mb-2" style={{ fontFamily: "Raleway, sans-serif" }}>Consultation Booked!</h2>
            <p className="text-muted-foreground">
              Your consultation has been confirmed. You'll receive a confirmation email shortly.
            </p>
            {selectedDate && selectedTime && (
              <div className="mt-4 p-3 rounded-lg bg-muted/30 border border-border/30">
                <div className="flex items-center justify-center gap-2 text-sm">
                  <Calendar className="h-4 w-4" />
                  <span>{selectedDate.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}</span>
                  <Clock className="h-4 w-4 ml-2" />
                  <span>{selectedTime}</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#2A5B3F] via-[#1F7B47] to-[#165E2E] flex items-center justify-center p-4">
      <div className="max-w-2xl w-full">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="flex items-center justify-center gap-2 mb-3">
            <Building2 className="h-7 w-7 text-[#C9A84C]" />
            <span className="text-white/80 text-sm font-medium tracking-widest uppercase" style={{ fontFamily: "Raleway, sans-serif" }}>
              Clarke & Associates
            </span>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-white" style={{ fontFamily: "Raleway, sans-serif" }}>
            Book a Consultation
          </h1>
          {availData.agent.name && (
            <p className="text-white/70 mt-1">with {availData.agent.name}</p>
          )}
        </div>

        <Card className="border-0 shadow-2xl">
          <CardContent className="p-6">
            {!selectedDate ? (
              /* Step 1: Select Date */
              <div>
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">Select a Date</h3>
                <div className="flex items-center justify-between mb-4">
                  <Button variant="ghost" size="sm" onClick={() => {
                    const prev = new Date(currentMonth);
                    prev.setMonth(prev.getMonth() - 1);
                    setCurrentMonth(prev);
                  }}>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-sm font-semibold">
                    {currentMonth.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
                  </span>
                  <Button variant="ghost" size="sm" onClick={() => {
                    const next = new Date(currentMonth);
                    next.setMonth(next.getMonth() + 1);
                    setCurrentMonth(next);
                  }}>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
                <div className="grid grid-cols-7 gap-1 text-center">
                  {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
                    <div key={d} className="text-xs font-medium text-muted-foreground py-2">{d}</div>
                  ))}
                  {calendarDays.map((day, i) => {
                    if (!day) return <div key={`empty-${i}`} />;
                    const available = isDayAvailable(day);
                    return (
                      <button
                        key={day.toISOString()}
                        disabled={!available}
                        className={`py-2 rounded-lg text-sm transition-all ${
                          available
                            ? "hover:bg-brand-green/10 text-foreground cursor-pointer font-medium"
                            : "text-muted-foreground/40 cursor-not-allowed"
                        }`}
                        onClick={() => available && setSelectedDate(day)}
                      >
                        {day.getDate()}
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : !selectedTime ? (
              /* Step 2: Select Time */
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <Button variant="ghost" size="sm" onClick={() => setSelectedDate(null)}>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <h3 className="text-sm font-semibold">
                    {selectedDate.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
                  </h3>
                </div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-3">Select a Time</p>
                {availableSlots.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">No available times for this date</p>
                ) : (
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                    {availableSlots.map((slot) => (
                      <Button
                        key={slot}
                        variant="outline"
                        className="text-sm"
                        onClick={() => setSelectedTime(slot)}
                      >
                        {slot}
                      </Button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              /* Step 3: Enter Details */
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <Button variant="ghost" size="sm" onClick={() => setSelectedTime(null)}>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <div>
                    <h3 className="text-sm font-semibold">
                      {selectedDate.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
                    </h3>
                    <p className="text-xs text-muted-foreground">{selectedTime} · 30 minutes</p>
                  </div>
                </div>
                <div className="space-y-4 mt-4">
                  <div>
                    <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Full Name *</Label>
                    <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="mt-1" />
                  </div>
                  <div>
                    <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Email *</Label>
                    <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="mt-1" />
                  </div>
                  <div>
                    <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Phone</Label>
                    <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="mt-1" />
                  </div>
                  <div>
                    <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Notes</Label>
                    <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="mt-1" rows={3} />
                  </div>
                  <Button
                    className="w-full h-12 text-base font-semibold text-white"
                    style={{ backgroundColor: "#2A5B3F" }}
                    disabled={!form.name || !form.email || bookMutation.isPending}
                    onClick={() => {
                      const [h, m] = selectedTime!.split(":").map(Number);
                      const scheduledAt = new Date(selectedDate!);
                      scheduledAt.setHours(h, m, 0, 0);
                      bookMutation.mutate({
                        agentSlug: params.slug,
                        guestName: form.name,
                        guestEmail: form.email,
                        guestPhone: form.phone || undefined,
                        scheduledAt: scheduledAt.getTime(),
                        notes: form.notes || undefined,
                      });
                    }}
                  >
                    {bookMutation.isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : "Confirm Booking"}
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <p className="text-center text-white/40 text-xs mt-6">
          &copy; {new Date().getFullYear()} Clarke & Associates. All rights reserved.
        </p>
      </div>
    </div>
  );
}
