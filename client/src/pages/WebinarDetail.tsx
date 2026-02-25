import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useLocation, useParams } from "wouter";
import { ArrowLeft, Calendar, Clock, Users, UserCheck, UserX, Video, Link2, ExternalLink } from "lucide-react";
import { toast } from "sonner";

export default function WebinarDetail() {
  const params = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const webinarId = Number(params.id);
  const [showRegister, setShowRegister] = useState(false);
  const [selectedLeadId, setSelectedLeadId] = useState<string>("");

  const { data: webinar, refetch } = trpc.webinars.getById.useQuery({ id: webinarId });
  const { data: leadsData } = trpc.leads.list.useQuery({ limit: 500 });
  const registeredLeads = leadsData?.items.filter((l) => l.webinarId === webinarId) ?? [];
  const unregisteredLeads = leadsData?.items.filter((l) => !l.webinarId) ?? [];

  const registerLead = trpc.webinars.registerLead.useMutation({
    onSuccess: () => { toast.success("Lead registered"); setShowRegister(false); refetch(); },
    onError: (e) => toast.error(e.message),
  });

  const updateAttendance = trpc.webinars.updateAttendance.useMutation({
    onSuccess: () => { toast.success("Attendance updated"); refetch(); },
    onError: (e) => toast.error(e.message),
  });

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
        <div className="flex gap-2">
          {webinar.zoomJoinUrl && (
            <a href={webinar.zoomJoinUrl} target="_blank" rel="noopener noreferrer">
              <Button variant="outline" className="gap-2"><ExternalLink className="h-4 w-4" /> Join Zoom</Button>
            </a>
          )}
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
