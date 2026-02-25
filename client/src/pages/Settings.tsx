import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Settings, Video, Calendar, CheckCircle, AlertCircle } from "lucide-react";
import { toast } from "sonner";

export default function SettingsPage() {
  const { data: status, refetch } = trpc.integrations.getStatus.useQuery();

  const [zoomForm, setZoomForm] = useState({ accessToken: "", accountId: "", accountEmail: "" });
  const [gcalForm, setGcalForm] = useState({ accessToken: "", accountEmail: "" });

  const connectZoom = trpc.integrations.connectZoom.useMutation({
    onSuccess: () => { toast.success("Zoom connected"); refetch(); },
    onError: (e: any) => toast.error(e.message),
  });

  const connectGoogle = trpc.integrations.connectGoogle.useMutation({
    onSuccess: () => { toast.success("Google Calendar connected"); refetch(); },
    onError: (e: any) => toast.error(e.message),
  });

  const disconnect = trpc.integrations.disconnect.useMutation({
    onSuccess: () => { toast.success("Disconnected"); refetch(); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold" style={{ fontFamily: "Raleway, sans-serif" }}>Settings</h1>
        <p className="text-muted-foreground text-sm mt-1">Manage integrations and preferences</p>
      </div>

      <Tabs defaultValue="zoom" className="space-y-4">
        <TabsList className="bg-muted/30">
          <TabsTrigger value="zoom" className="gap-1"><Video className="h-3.5 w-3.5" /> Zoom</TabsTrigger>
          <TabsTrigger value="google" className="gap-1"><Calendar className="h-3.5 w-3.5" /> Google Calendar</TabsTrigger>
          <TabsTrigger value="general" className="gap-1"><Settings className="h-3.5 w-3.5" /> General</TabsTrigger>
        </TabsList>

        <TabsContent value="zoom">
          <Card className="border-0 shadow-sm">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base" style={{ fontFamily: "Raleway, sans-serif" }}>Zoom Integration</CardTitle>
                {status?.zoom.connected ? (
                  <Badge className="bg-green-100 text-green-700 gap-1"><CheckCircle className="h-3 w-3" /> Connected</Badge>
                ) : (
                  <Badge variant="secondary" className="gap-1"><AlertCircle className="h-3 w-3" /> Not Connected</Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Connect your Zoom account to create webinars and auto-register leads. Provide your Zoom Server-to-Server OAuth access token.
              </p>
              {status?.zoom.connected ? (
                <div className="space-y-3">
                  <div className="p-3 rounded-lg bg-green-50 border border-green-200">
                    <p className="text-sm font-medium text-green-800">Zoom is connected</p>
                    {"email" in status.zoom && status.zoom.email && (
                      <p className="text-xs text-green-600 mt-1">Account: {status.zoom.email}</p>
                    )}
                  </div>
                  <Button variant="outline" className="text-destructive" onClick={() => disconnect.mutate({ provider: "zoom" })}>
                    Disconnect Zoom
                  </Button>
                </div>
              ) : (
                <>
                  <div>
                    <Label>Access Token</Label>
                    <Input type="password" value={zoomForm.accessToken} onChange={(e) => setZoomForm({ ...zoomForm, accessToken: e.target.value })} placeholder="Enter Zoom access token" />
                  </div>
                  <div>
                    <Label>Account ID (optional)</Label>
                    <Input value={zoomForm.accountId} onChange={(e) => setZoomForm({ ...zoomForm, accountId: e.target.value })} placeholder="Zoom Account ID" />
                  </div>
                  <div>
                    <Label>Account Email (optional)</Label>
                    <Input value={zoomForm.accountEmail} onChange={(e) => setZoomForm({ ...zoomForm, accountEmail: e.target.value })} placeholder="zoom@company.com" />
                  </div>
                  <Button
                    className="bg-brand-green hover:bg-brand-green-dark text-white"
                    disabled={!zoomForm.accessToken || connectZoom.isPending}
                    onClick={() => connectZoom.mutate(zoomForm)}
                  >
                    {connectZoom.isPending ? "Connecting..." : "Connect Zoom"}
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="google">
          <Card className="border-0 shadow-sm">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base" style={{ fontFamily: "Raleway, sans-serif" }}>Google Calendar Integration</CardTitle>
                {status?.google.connected ? (
                  <Badge className="bg-green-100 text-green-700 gap-1"><CheckCircle className="h-3 w-3" /> Connected</Badge>
                ) : (
                  <Badge variant="secondary" className="gap-1"><AlertCircle className="h-3 w-3" /> Not Connected</Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Connect Google Calendar to sync webinar events and consultation bookings automatically.
              </p>
              {status?.google.connected ? (
                <div className="space-y-3">
                  <div className="p-3 rounded-lg bg-green-50 border border-green-200">
                    <p className="text-sm font-medium text-green-800">Google Calendar is connected</p>
                    {"email" in status.google && status.google.email && (
                      <p className="text-xs text-green-600 mt-1">Account: {status.google.email}</p>
                    )}
                  </div>
                  <Button variant="outline" className="text-destructive" onClick={() => disconnect.mutate({ provider: "google_calendar" })}>
                    Disconnect Google Calendar
                  </Button>
                </div>
              ) : (
                <>
                  <div>
                    <Label>Access Token</Label>
                    <Input type="password" value={gcalForm.accessToken} onChange={(e) => setGcalForm({ ...gcalForm, accessToken: e.target.value })} placeholder="Enter Google access token" />
                  </div>
                  <div>
                    <Label>Account Email (optional)</Label>
                    <Input value={gcalForm.accountEmail} onChange={(e) => setGcalForm({ ...gcalForm, accountEmail: e.target.value })} placeholder="you@gmail.com" />
                  </div>
                  <Button
                    className="bg-brand-green hover:bg-brand-green-dark text-white"
                    disabled={!gcalForm.accessToken || connectGoogle.isPending}
                    onClick={() => connectGoogle.mutate(gcalForm)}
                  >
                    {connectGoogle.isPending ? "Connecting..." : "Connect Google Calendar"}
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="general">
          <Card className="border-0 shadow-sm">
            <CardHeader>
              <CardTitle className="text-base" style={{ fontFamily: "Raleway, sans-serif" }}>General Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 rounded-lg bg-muted/30 border border-border/30">
                <h3 className="text-sm font-semibold mb-2">About Clarke & Associates CRM</h3>
                <p className="text-sm text-muted-foreground">
                  A comprehensive CRM platform for real estate webinar-based lead generation.
                  Manage leads, webinars, landing pages, deals, and scheduling all in one place.
                </p>
              </div>
              <div className="p-4 rounded-lg bg-muted/30 border border-border/30">
                <h3 className="text-sm font-semibold mb-2">Email Reminders</h3>
                <p className="text-sm text-muted-foreground">
                  Automated email reminders are sent at these intervals: immediately after registration,
                  24 hours before, 1 hour before, and 10 minutes before each webinar.
                  No-show follow-up emails with replay links are sent automatically.
                </p>
              </div>
              <div className="p-4 rounded-lg bg-muted/30 border border-border/30">
                <h3 className="text-sm font-semibold mb-2">SMS Notifications</h3>
                <p className="text-sm text-muted-foreground">
                  SMS reminders are sent to leads who have granted consent at 24 hours, 1 hour,
                  and 10 minutes before webinars. Two-way SMS messaging is available on lead profiles.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
