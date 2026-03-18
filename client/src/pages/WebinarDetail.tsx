import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useLocation, useParams } from "wouter";
import {
  ArrowLeft, Calendar, Clock, Users, UserCheck, UserX,
  ExternalLink, Plus, Trash2, Video, CheckCircle, AlertCircle, Loader2,
} from "lucide-react";
import { toast } from "sonner";

export default function WebinarDetail() {
  const params = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const webinarId = Number(params.id);

  const [showRegister, setShowRegister] = useState(false);
  const [selectedLeadId, setSelectedLeadId] = useState<string>("");

  const [showAddSession, setShowAddSession] = useState(false);
  const [sessionForm, setSessionForm] = useState({
    sessionDate: "",
    sessionTime: "09:00",
    durationMinutes: 60,
    label: "",
  });
  const [lastCreatedSession, setLastCreatedSession] = useState<{
    zoomCreated: boolean;
    zoomMeetingId?: string;
    zoomJoinUrl?: string;
    zoomStartUrl?: string;
  } | null>(null);

  const { data: webinar, refetch } = trpc.webinars.getById.useQuery({ id: webinarId });
  const { data: zoomStatus } = trpc.integrations.getStatus.useQuery();
  const zoomConnected = zoomStatus?.zoom?.connected ?? false;

  const { data: leadsData } = trpc.leads.list.useQuery({ limit: 500 });
  const registeredLeads = leadsData?.items.filter((l) => l.webinarId === webinarId) ?? [];
  const unregisteredLeads = leadsData?.items.filter((l) => !l.webinarId) ?? [];

  const sessions = webinar?.sessions ?? [];

  const registerLead = trpc.webinars.registerLead.useMutation({
    onSuccess: () => { toast.success("Lead registered"); setShowRegister(false); refetch(); },
    onError: (e) => toast.error(e.message),
  });

  const updateAttendance = trpc.webinars.updateAttendance.useMutation({
    onSuccess: () => { toast.success("Attendance updated"); refetch(); },
    onError: (e) => toast.error(e.message),
  });

  const addSession = trpc.webinars.addSession.useMutation({
    onSuccess: (result) => {
      setLastCreatedSession({
        zoomCreated: result.zoomCreated,
        zoomMeetingId: result.zoomMeetingId ?? undefined,
        zoomJoinUrl: result.zoomJoinUrl ?? undefined,
        zoomStartUrl: result.zoomStartUrl ?? undefined,
      });
      if (result.zoomCreated) {
        toast.success("Session created and Zoom meeting scheduled!");
      } else {
        toast.success("Session added");
      }
      refetch();
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteSession = trpc.webinars.deleteSession.useMutation({
    onSuccess: () => { toast.success("Session deleted"); refetch(); },
    onError: (e) => toast.error(e.message),
  });

  const handleAddSession = () => {
    if (!sessionForm.sessionDate) {
      toast.error("Please select a date for the session");
      return;
    }
    setLastCreatedSession(null);
    const dt = new Date(`${sessionForm.sessionDate}T${sessionForm.sessionTime}`);
    addSession.mutate({
      webinarId,
      sessionDate: dt.getTime(),
      durationMinutes: sessionForm.durationMinutes,
      label: sessionForm.label || undefined,
    });
  };

  const resetAddSessionForm = () => {
    setSessionForm({ sessionDate: "", sessionTime: "09:00", durationMinutes: 60, label: "" });
    setLastCreatedSession(null);
  };

  if (!webinar) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" onClick={() => setLocation("/webinars")} className="gap-1">
        <ArrowLeft className="h-4 w-4" /> Back to Webinars
      </Button>

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold" style={{ fontFamily: "Raleway, sans-serif" }}>{webinar.title}</h1>
          {webinar.description && <p className="text-muted-foreground mt-1">{webinar.description}</p>}
          <div className="flex items-center gap-4 mt-3 text-sm text-muted-foreground flex-wrap">
            <span className="flex items-center gap-1"><Calendar className="h-4 w-4" /> {new Date(webinar.scheduledAt).toLocaleDateString()}</span>
            <span className="flex items-center gap-1"><Clock className="h-4 w-4" /> {new Date(webinar.scheduledAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
            <span className="flex items-center gap-1"><Clock className="h-4 w-4" /> {webinar.durationMinutes} min</span>
            <Badge className="text-xs">{webinar.status}</Badge>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          {webinar.zoomJoinUrl && (
            <a href={webinar.zoomJoinUrl} target="_blank" rel="noopener noreferrer">
              <Button variant="outline" className="gap-2"><ExternalLink className="h-4 w-4" /> Join Zoom</Button>
            </a>
          )}

          {/* Add Session Dialog */}
          <Dialog open={showAddSession} onOpenChange={(open) => { setShowAddSession(open); if (!open) resetAddSessionForm(); }}>
            <DialogTrigger asChild>
              <Button variant="outline" className="gap-2">
                <Plus className="h-4 w-4" /> Add Session
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Add New Session</DialogTitle>
              </DialogHeader>

              {/* Zoom status banner */}
              {zoomConnected ? (
                <div className="flex items-start gap-2 p-3 rounded-lg bg-green-50 border border-green-200 text-sm text-green-800">
                  <CheckCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  <span>Zoom is connected — a meeting will be created automatically on Zoom when you add this session.</span>
                </div>
              ) : (
                <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200 text-sm text-amber-800">
                  <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  <span>
                    Zoom is not connected. The session will be saved without a Zoom meeting.{" "}
                    <a href="/settings" className="underline font-medium">Connect Zoom in Settings</a> to enable automatic meeting creation.
                  </span>
                </div>
              )}

              {/* Show result after creation */}
              {lastCreatedSession && (
                <div className={`p-3 rounded-lg border text-sm space-y-1 ${lastCreatedSession.zoomCreated ? "bg-green-50 border-green-200 text-green-800" : "bg-muted border-border"}`}>
                  {lastCreatedSession.zoomCreated ? (
                    <>
                      <p className="font-medium flex items-center gap-1"><CheckCircle className="h-4 w-4" /> Zoom meeting created!</p>
                      {lastCreatedSession.zoomMeetingId && (
                        <p className="text-xs">Meeting ID: <span className="font-mono font-semibold">{lastCreatedSession.zoomMeetingId}</span></p>
                      )}
                      {lastCreatedSession.zoomJoinUrl && (
                        <p className="text-xs">
                          Join URL:{" "}
                          <a href={lastCreatedSession.zoomJoinUrl} target="_blank" rel="noopener noreferrer" className="underline break-all">
                            {lastCreatedSession.zoomJoinUrl}
                          </a>
                        </p>
                      )}
                    </>
                  ) : (
                    <p className="text-xs text-muted-foreground">Session saved without Zoom meeting.</p>
                  )}
                </div>
              )}

              <div className="space-y-4 py-1">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label>Date <span className="text-destructive">*</span></Label>
                    <Input
                      type="date"
                      value={sessionForm.sessionDate}
                      onChange={(e) => setSessionForm({ ...sessionForm, sessionDate: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>Time</Label>
                    <Input
                      type="time"
                      value={sessionForm.sessionTime}
                      onChange={(e) => setSessionForm({ ...sessionForm, sessionTime: e.target.value })}
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label>Duration (minutes)</Label>
                  <Input
                    type="number"
                    min={15}
                    value={sessionForm.durationMinutes}
                    onChange={(e) => setSessionForm({ ...sessionForm, durationMinutes: Number(e.target.value) })}
                  />
                </div>
                <div className="space-y-1">
                  <Label>Label (optional)</Label>
                  <Input
                    placeholder="e.g. Morning Session, Evening Session"
                    value={sessionForm.label}
                    onChange={(e) => setSessionForm({ ...sessionForm, label: e.target.value })}
                  />
                </div>
                <Button
                  className="w-full bg-brand-green hover:bg-brand-green-dark text-white"
                  disabled={!sessionForm.sessionDate || addSession.isPending}
                  onClick={handleAddSession}
                >
                  {addSession.isPending ? (
                    <span className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      {zoomConnected ? "Creating Zoom meeting..." : "Adding session..."}
                    </span>
                  ) : (
                    zoomConnected ? "Add Session & Create Zoom Meeting" : "Add Session"
                  )}
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          {/* Register Lead Dialog */}
          <Dialog open={showRegister} onOpenChange={setShowRegister}>
            <DialogTrigger asChild>
              <Button className="bg-brand-green hover:bg-brand-green-dark text-white gap-2">
                <Users className="h-4 w-4" /> Register Lead
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Register Lead for Webinar</DialogTitle></DialogHeader>
              <div className="space-y-4 py-2">
                <Select value={selectedLeadId} onValueChange={setSelectedLeadId}>
                  <SelectTrigger><SelectValue placeholder="Select a lead..." /></SelectTrigger>
                  <SelectContent>
                    {unregisteredLeads.map((l) => (
                      <SelectItem key={l.id} value={l.id.toString()}>
                        {l.firstName} {l.lastName} ({l.email})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  className="w-full bg-brand-green hover:bg-brand-green-dark text-white"
                  disabled={!selectedLeadId || registerLead.isPending}
                  onClick={() => registerLead.mutate({ leadId: Number(selectedLeadId), webinarId })}
                >
                  {registerLead.isPending ? "Registering..." : "Register"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-blue-100 flex items-center justify-center">
              <Users className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold" style={{ fontFamily: "Raleway, sans-serif" }}>{webinar.stats?.registered ?? 0}</p>
              <p className="text-xs text-muted-foreground">Registered</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-green-100 flex items-center justify-center">
              <UserCheck className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold" style={{ fontFamily: "Raleway, sans-serif" }}>{webinar.stats?.attended ?? 0}</p>
              <p className="text-xs text-muted-foreground">Attended</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-red-100 flex items-center justify-center">
              <UserX className="h-5 w-5 text-red-600" />
            </div>
            <div>
              <p className="text-2xl font-bold" style={{ fontFamily: "Raleway, sans-serif" }}>{webinar.stats?.no_show ?? 0}</p>
              <p className="text-xs text-muted-foreground">No Show</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Sessions */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <CardTitle className="text-base" style={{ fontFamily: "Raleway, sans-serif" }}>
            Sessions ({sessions.length})
          </CardTitle>
          {zoomConnected && (
            <Badge className="bg-green-100 text-green-700 gap-1 text-xs">
              <CheckCircle className="h-3 w-3" /> Zoom Connected
            </Badge>
          )}
        </CardHeader>
        <CardContent>
          {sessions.length === 0 ? (
            <div className="text-center py-8">
              <Video className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No sessions yet.</p>
              <p className="text-xs text-muted-foreground mt-1">
                {zoomConnected
                  ? "Click \"Add Session\" to create a session and automatically schedule it on Zoom."
                  : "Click \"Add Session\" to create a session. Connect Zoom in Settings to auto-create Zoom meetings."}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {sessions.map((session) => (
                <div key={session.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/20 hover:bg-muted/40 transition-colors gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-9 w-9 rounded-lg bg-brand-green/10 flex items-center justify-center flex-shrink-0">
                      <Video className="h-4 w-4 text-brand-green" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">
                        {session.label ?? "Session"}{" "}
                        <span className="text-muted-foreground font-normal">
                          — {new Date(session.sessionDate).toLocaleDateString()} at{" "}
                          {new Date(session.sessionDate).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </p>
                      <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                        <p className="text-xs text-muted-foreground">{session.durationMinutes} min</p>
                        {session.zoomJoinUrl && (
                          <p className="text-xs text-muted-foreground truncate max-w-[220px]">
                            <span className="text-brand-green font-medium">Zoom</span>{" "}
                            {session.zoomJoinUrl.replace("https://", "")}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {session.zoomJoinUrl && (
                      <a href={session.zoomJoinUrl} target="_blank" rel="noopener noreferrer">
                        <Button variant="outline" size="sm" className="h-7 text-xs gap-1">
                          <ExternalLink className="h-3 w-3" /> Join
                        </Button>
                      </a>
                    )}
                    {session.zoomStartUrl && (
                      <a href={session.zoomStartUrl} target="_blank" rel="noopener noreferrer">
                        <Button size="sm" className="h-7 text-xs gap-1 bg-brand-green hover:bg-brand-green-dark text-white">
                          <Video className="h-3 w-3" /> Start
                        </Button>
                      </a>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                      onClick={() => {
                        if (confirm("Delete this session?")) {
                          deleteSession.mutate({ sessionId: session.id });
                        }
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Registered Leads */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-base" style={{ fontFamily: "Raleway, sans-serif" }}>Registered Leads</CardTitle>
        </CardHeader>
        <CardContent>
          {registeredLeads.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No leads registered yet</p>
          ) : (
            <div className="space-y-2">
              {registeredLeads.map((lead) => (
                <div key={lead.id} className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/30 transition-colors">
                  <div className="flex items-center gap-3 cursor-pointer" onClick={() => setLocation(`/leads/${lead.id}`)}>
                    <div className="h-8 w-8 rounded-full bg-brand-green/10 flex items-center justify-center flex-shrink-0">
                      <span className="text-xs font-semibold text-brand-green">{lead.firstName.charAt(0)}{lead.lastName.charAt(0)}</span>
                    </div>
                    <div>
                      <p className="text-sm font-medium">{lead.firstName} {lead.lastName}</p>
                      <p className="text-xs text-muted-foreground">{lead.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Select
                      value={lead.attendanceStatus ?? "registered"}
                      onValueChange={(v) => updateAttendance.mutate({ leadId: lead.id, status: v as any })}
                    >
                      <SelectTrigger className="w-[130px] h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="registered">Registered</SelectItem>
                        <SelectItem value="attended">Attended</SelectItem>
                        <SelectItem value="no_show">No Show</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
