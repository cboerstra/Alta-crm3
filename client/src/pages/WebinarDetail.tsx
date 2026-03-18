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
import { ArrowLeft, Calendar, Clock, Users, UserCheck, UserX, ExternalLink, Plus, Trash2, Video } from "lucide-react";
import { toast } from "sonner";

export default function WebinarDetail() {
  const params = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const webinarId = Number(params.id);

  // Register lead dialog
  const [showRegister, setShowRegister] = useState(false);
  const [selectedLeadId, setSelectedLeadId] = useState<string>("");

  // Add session dialog
  const [showAddSession, setShowAddSession] = useState(false);
  const [sessionForm, setSessionForm] = useState({
    sessionDate: "",
    sessionTime: "09:00",
    durationMinutes: 60,
    label: "",
    zoomJoinUrl: "",
    zoomStartUrl: "",
  });

  const utils = trpc.useUtils();

  const { data: webinar, refetch } = trpc.webinars.getById.useQuery({ id: webinarId });
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
    onSuccess: () => {
      toast.success("Session added");
      setShowAddSession(false);
      setSessionForm({ sessionDate: "", sessionTime: "09:00", durationMinutes: 60, label: "", zoomJoinUrl: "", zoomStartUrl: "" });
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
    const dt = new Date(`${sessionForm.sessionDate}T${sessionForm.sessionTime}`);
    addSession.mutate({
      webinarId,
      sessionDate: dt.getTime(),
      durationMinutes: sessionForm.durationMinutes,
      label: sessionForm.label || undefined,
      zoomJoinUrl: sessionForm.zoomJoinUrl || undefined,
      zoomStartUrl: sessionForm.zoomStartUrl || undefined,
    });
  };

  if (!webinar) {
    return <div className="flex items-center justify-center h-64"><p className="text-muted-foreground">Loading...</p></div>;
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
          <div className="flex items-center gap-4 mt-3 text-sm text-muted-foreground">
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
          <Dialog open={showAddSession} onOpenChange={setShowAddSession}>
            <DialogTrigger asChild>
              <Button variant="outline" className="gap-2">
                <Plus className="h-4 w-4" /> Add Session
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader><DialogTitle>Add New Session</DialogTitle></DialogHeader>
              <div className="space-y-4 py-2">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label>Date</Label>
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
                <div className="space-y-1">
                  <Label>Zoom Join URL (optional)</Label>
                  <Input
                    placeholder="https://zoom.us/j/..."
                    value={sessionForm.zoomJoinUrl}
                    onChange={(e) => setSessionForm({ ...sessionForm, zoomJoinUrl: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <Label>Zoom Start URL (optional)</Label>
                  <Input
                    placeholder="https://zoom.us/s/..."
                    value={sessionForm.zoomStartUrl}
                    onChange={(e) => setSessionForm({ ...sessionForm, zoomStartUrl: e.target.value })}
                  />
                </div>
                <Button
                  className="w-full bg-brand-green hover:bg-brand-green-dark text-white"
                  disabled={!sessionForm.sessionDate || addSession.isPending}
                  onClick={handleAddSession}
                >
                  {addSession.isPending ? "Adding..." : "Add Session"}
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
        </CardHeader>
        <CardContent>
          {sessions.length === 0 ? (
            <div className="text-center py-8">
              <Video className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No sessions yet. Click "Add Session" to create one.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {sessions.map((session) => (
                <div key={session.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/20 hover:bg-muted/40 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-lg bg-brand-green/10 flex items-center justify-center flex-shrink-0">
                      <Video className="h-4 w-4 text-brand-green" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">
                        {session.label ?? "Session"}{" "}
                        <span className="text-muted-foreground font-normal">
                          — {new Date(session.sessionDate).toLocaleDateString()} at {new Date(session.sessionDate).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </p>
                      <p className="text-xs text-muted-foreground">{session.durationMinutes} min</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {session.zoomJoinUrl && (
                      <a href={session.zoomJoinUrl} target="_blank" rel="noopener noreferrer">
                        <Button variant="outline" size="sm" className="h-7 text-xs gap-1">
                          <ExternalLink className="h-3 w-3" /> Join
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
                    <div className="h-8 w-8 rounded-full bg-brand-green/10 flex items-center justify-center">
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
