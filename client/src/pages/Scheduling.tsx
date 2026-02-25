import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar, Clock, Copy, ExternalLink, Settings, Users } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/_core/hooks/useAuth";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export default function Scheduling() {
  const { user } = useAuth();
  const [slug, setSlug] = useState("");

  const { data: availability, refetch: refetchAvail } = trpc.scheduling.getMyAvailability.useQuery();
  const { data: bookings } = trpc.scheduling.getMyBookings.useQuery();

  const setAvailability = trpc.scheduling.setAvailability.useMutation({
    onSuccess: () => { toast.success("Availability updated"); refetchAvail(); },
    onError: (e) => toast.error(e.message),
  });

  const setSchedulingSlug = trpc.scheduling.setSchedulingSlug.useMutation({
    onSuccess: () => toast.success("Scheduling URL updated"),
    onError: (e) => toast.error(e.message),
  });

  const [slots, setSlots] = useState<{ dayOfWeek: number; startTime: string; endTime: string; active: boolean }[]>(
    DAYS.map((_, i) => {
      const existing = availability?.find((a) => a.dayOfWeek === i);
      return {
        dayOfWeek: i,
        startTime: existing?.startTime || "09:00",
        endTime: existing?.endTime || "17:00",
        active: !!existing,
      };
    })
  );

  // Update slots when availability loads
  if (availability && slots.every((s) => !s.active) && availability.length > 0) {
    const updated = DAYS.map((_, i) => {
      const existing = availability.find((a) => a.dayOfWeek === i);
      return {
        dayOfWeek: i,
        startTime: existing?.startTime || "09:00",
        endTime: existing?.endTime || "17:00",
        active: !!existing,
      };
    });
    setSlots(updated);
  }

  const bookingUrl = user?.schedulingSlug ? `${window.location.origin}/schedule/${user.schedulingSlug}` : null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold" style={{ fontFamily: "Raleway, sans-serif" }}>Scheduling</h1>
        <p className="text-muted-foreground text-sm mt-1">Manage your availability and bookings</p>
      </div>

      <Tabs defaultValue="availability" className="space-y-4">
        <TabsList className="bg-muted/30">
          <TabsTrigger value="availability">Availability</TabsTrigger>
          <TabsTrigger value="bookings">Bookings</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="availability">
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-base" style={{ fontFamily: "Raleway, sans-serif" }}>Weekly Availability</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {slots.map((slot, i) => (
                <div key={i} className="flex items-center gap-4 py-2 border-b border-border/30 last:border-0">
                  <div className="w-28">
                    <Switch checked={slot.active} onCheckedChange={(v) => {
                      const updated = [...slots];
                      updated[i] = { ...updated[i], active: v };
                      setSlots(updated);
                    }} />
                  </div>
                  <span className="w-24 text-sm font-medium">{DAYS[i]}</span>
                  {slot.active ? (
                    <div className="flex items-center gap-2">
                      <Input
                        type="time"
                        value={slot.startTime}
                        onChange={(e) => {
                          const updated = [...slots];
                          updated[i] = { ...updated[i], startTime: e.target.value };
                          setSlots(updated);
                        }}
                        className="w-32 h-8"
                      />
                      <span className="text-muted-foreground">to</span>
                      <Input
                        type="time"
                        value={slot.endTime}
                        onChange={(e) => {
                          const updated = [...slots];
                          updated[i] = { ...updated[i], endTime: e.target.value };
                          setSlots(updated);
                        }}
                        className="w-32 h-8"
                      />
                    </div>
                  ) : (
                    <span className="text-sm text-muted-foreground">Unavailable</span>
                  )}
                </div>
              ))}
              <Button
                className="bg-brand-green hover:bg-brand-green-dark text-white mt-4"
                onClick={() => {
                  const active = slots.filter((s) => s.active).map(({ dayOfWeek, startTime, endTime }) => ({ dayOfWeek, startTime, endTime }));
                  setAvailability.mutate({ slots: active });
                }}
              >
                Save Availability
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="bookings">
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-base" style={{ fontFamily: "Raleway, sans-serif" }}>Upcoming Bookings</CardTitle>
            </CardHeader>
            <CardContent>
              {bookings && bookings.length > 0 ? (
                <div className="space-y-3">
                  {bookings.map((booking) => (
                    <div key={booking.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border/30">
                      <div>
                        <p className="text-sm font-medium">{booking.guestName}</p>
                        <p className="text-xs text-muted-foreground">{booking.guestEmail}</p>
                        <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                          <Calendar className="h-3 w-3" /> {new Date(booking.scheduledAt).toLocaleDateString()}
                          <Clock className="h-3 w-3 ml-1" /> {new Date(booking.scheduledAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          <span>({booking.durationMinutes} min)</span>
                        </div>
                      </div>
                      <Badge variant={booking.status === "confirmed" ? "default" : "secondary"}>
                        {booking.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-8">No bookings yet</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings">
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-base" style={{ fontFamily: "Raleway, sans-serif" }}>Booking URL</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Your Scheduling Slug</Label>
                <div className="flex gap-2 mt-1">
                  <div className="flex items-center text-sm text-muted-foreground bg-muted/30 px-3 rounded-l-md border border-r-0">
                    /schedule/
                  </div>
                  <Input
                    value={slug || user?.schedulingSlug || ""}
                    onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"))}
                    className="rounded-l-none"
                    placeholder="your-name"
                  />
                  <Button
                    className="bg-brand-green hover:bg-brand-green-dark text-white"
                    onClick={() => setSchedulingSlug.mutate({ slug: slug || user?.schedulingSlug || "" })}
                  >
                    Save
                  </Button>
                </div>
              </div>
              {bookingUrl && (
                <div className="p-3 rounded-lg bg-muted/30 border border-border/30">
                  <p className="text-xs text-muted-foreground mb-1">Your public booking URL:</p>
                  <div className="flex items-center gap-2">
                    <code className="text-sm flex-1 truncate">{bookingUrl}</code>
                    <Button variant="ghost" size="sm" onClick={() => { navigator.clipboard.writeText(bookingUrl); toast.success("Copied!"); }}>
                      <Copy className="h-4 w-4" />
                    </Button>
                    <a href={bookingUrl} target="_blank" rel="noopener noreferrer">
                      <Button variant="ghost" size="sm"><ExternalLink className="h-4 w-4" /></Button>
                    </a>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
