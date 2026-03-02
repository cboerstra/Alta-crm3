import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { useLocation } from "wouter";
import { Plus, Video, Calendar, Clock, ExternalLink, Trash2, FileText, Search, Filter, Users } from "lucide-react";
import { toast } from "sonner";

const statusColors: Record<string, string> = {
  draft: "bg-gray-100 text-gray-700",
  scheduled: "bg-blue-100 text-blue-700",
  live: "bg-green-100 text-green-700",
  completed: "bg-brand-gold/10 text-brand-gold",
  cancelled: "bg-red-100 text-red-700",
};

type SessionDraft = {
  id: string;
  date: string;
  durationMinutes: number;
  label: string;
  zoomJoinUrl: string;
};

export default function Webinars() {
  const [, setLocation] = useLocation();
  const [showCreate, setShowCreate] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [form, setForm] = useState({
    title: "", description: "", scheduledAt: "", durationMinutes: 60,
    zoomJoinUrl: "", zoomWebinarId: "", replayUrl: "",
    createLandingPage: true, landingPageSlug: "",
  });
  const [additionalSessions, setAdditionalSessions] = useState<SessionDraft[]>([]);

  const { data: webinars, isLoading, refetch } = trpc.webinars.list.useQuery();

  const createMutation = trpc.webinars.create.useMutation({
    onSuccess: (data) => {
      toast.success("Webinar created successfully!");
      if (data.landingPageId) toast.success("Landing page auto-created and linked", { duration: 4000 });
      setShowCreate(false);
      resetForm();
      refetch();
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteMutation = trpc.webinars.delete.useMutation({
    onSuccess: () => {
      toast.success("Webinar deleted");
      setDeleteId(null);
      refetch();
    },
    onError: (e) => toast.error(e.message),
  });

  function resetForm() {
    setForm({ title: "", description: "", scheduledAt: "", durationMinutes: 60, zoomJoinUrl: "", zoomWebinarId: "", replayUrl: "", createLandingPage: true, landingPageSlug: "" });
    setAdditionalSessions([]);
  }

  function addSession() {
    setAdditionalSessions(prev => [...prev, { id: crypto.randomUUID(), date: "", durationMinutes: 60, label: "", zoomJoinUrl: "" }]);
  }

  function updateSession(id: string, field: keyof SessionDraft, value: string | number) {
    setAdditionalSessions(prev => prev.map(s => s.id === id ? { ...s, [field]: value } : s));
  }

  function removeSession(id: string) {
    setAdditionalSessions(prev => prev.filter(s => s.id !== id));
  }

  const handleCreate = () => {
    if (!form.title) return toast.error("Webinar title is required");
    if (!form.scheduledAt) return toast.error("Date & time is required");
    createMutation.mutate({
      title: form.title,
      description: form.description || undefined,
      scheduledAt: new Date(form.scheduledAt).getTime(),
      durationMinutes: form.durationMinutes,
      zoomJoinUrl: form.zoomJoinUrl || undefined,
      zoomWebinarId: form.zoomWebinarId || undefined,
      replayUrl: form.replayUrl || undefined,
      createLandingPage: form.createLandingPage,
      landingPageSlug: form.landingPageSlug || undefined,
      additionalSessions: additionalSessions.filter(s => s.date).map(s => ({
        sessionDate: new Date(s.date).getTime(),
        durationMinutes: s.durationMinutes,
        label: s.label || undefined,
        zoomJoinUrl: s.zoomJoinUrl || undefined,
      })),
    });
  };

  const autoSlug = form.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

  // Client-side filtering
  const filtered = useMemo(() => {
    if (!webinars) return [];
    let result = webinars;
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(w => w.title.toLowerCase().includes(q) || (w.description ?? "").toLowerCase().includes(q));
    }
    if (statusFilter !== "all") {
      result = result.filter(w => w.status === statusFilter);
    }
    return result;
  }, [webinars, search, statusFilter]);

  const webinarToDelete = webinars?.find(w => w.id === deleteId);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ fontFamily: "Raleway, sans-serif" }}>Webinars</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {webinars?.length ?? 0} webinar{(webinars?.length ?? 0) !== 1 ? "s" : ""} total
          </p>
        </div>
        <Dialog open={showCreate} onOpenChange={(v) => { if (!v) resetForm(); setShowCreate(v); }}>
          <DialogTrigger asChild>
            <Button className="bg-brand-green hover:bg-brand-green-dark text-white gap-2">
              <Plus className="h-4 w-4" /> Schedule Webinar
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle style={{ fontFamily: "Raleway, sans-serif" }}>Schedule New Webinar</DialogTitle>
            </DialogHeader>
            <div className="space-y-5 py-2">
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Event Details</h3>
                <div>
                  <Label>Webinar Title <span className="text-red-500">*</span></Label>
                  <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="First-Time Homebuyer Webinar" />
                </div>
                <div>
                  <Label>Description</Label>
                  <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="What attendees will learn..." rows={3} />
                </div>
              </div>
              <Separator />
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Primary Session <span className="text-red-500">*</span></h3>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Date & Time <span className="text-red-500">*</span></Label>
                    <Input type="datetime-local" value={form.scheduledAt} onChange={(e) => setForm({ ...form, scheduledAt: e.target.value })} />
                  </div>
                  <div>
                    <Label>Duration (minutes)</Label>
                    <Input type="number" value={form.durationMinutes} onChange={(e) => setForm({ ...form, durationMinutes: Number(e.target.value) })} />
                  </div>
                </div>
              </div>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Additional Sessions</h3>
                  <Button variant="outline" size="sm" onClick={addSession} className="gap-1">
                    <Plus className="h-3 w-3" /> Add Session
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">Offer multiple dates so leads can choose the session that works best for them.</p>
                {additionalSessions.map((session) => (
                  <div key={session.id} className="p-3 rounded-lg border bg-card space-y-2">
                    <div className="flex items-center justify-between">
                      <Input placeholder="Session label (e.g., Evening Session)" value={session.label} onChange={(e) => updateSession(session.id, "label", e.target.value)} className="text-sm h-8" />
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-destructive ml-2" onClick={() => removeSession(session.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <Input type="datetime-local" value={session.date} onChange={(e) => updateSession(session.id, "date", e.target.value)} className="text-sm h-8" />
                      <Input type="number" placeholder="Duration (min)" value={session.durationMinutes} onChange={(e) => updateSession(session.id, "durationMinutes", Number(e.target.value))} className="text-sm h-8" />
                    </div>
                    <Input placeholder="Zoom join URL (optional)" value={session.zoomJoinUrl} onChange={(e) => updateSession(session.id, "zoomJoinUrl", e.target.value)} className="text-sm h-8" />
                  </div>
                ))}
              </div>
              <Separator />
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Zoom Integration</h3>
                <div>
                  <Label>Zoom Webinar ID</Label>
                  <Input value={form.zoomWebinarId} onChange={(e) => setForm({ ...form, zoomWebinarId: e.target.value })} placeholder="123 456 7890" />
                </div>
                <div>
                  <Label>Zoom Join URL</Label>
                  <Input value={form.zoomJoinUrl} onChange={(e) => setForm({ ...form, zoomJoinUrl: e.target.value })} placeholder="https://zoom.us/j/..." />
                </div>
                <div>
                  <Label>Replay URL (for no-show follow-up)</Label>
                  <Input value={form.replayUrl} onChange={(e) => setForm({ ...form, replayUrl: e.target.value })} placeholder="https://..." />
                </div>
              </div>
              <Separator />
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Landing Page</h3>
                <div className="flex items-center justify-between p-3 rounded-lg border bg-card">
                  <div>
                    <p className="text-sm font-medium">Auto-create registration landing page</p>
                    <p className="text-xs text-muted-foreground">A lead capture page will be created and linked to this webinar</p>
                  </div>
                  <Switch checked={form.createLandingPage} onCheckedChange={(v) => setForm({ ...form, createLandingPage: v })} />
                </div>
                {form.createLandingPage && (
                  <div>
                    <Label>Custom URL Slug (optional)</Label>
                    <div className="text-xs text-muted-foreground mb-1">/lp/<span className="font-medium">{form.landingPageSlug || autoSlug || "your-slug"}</span></div>
                    <Input
                      value={form.landingPageSlug}
                      onChange={(e) => setForm({ ...form, landingPageSlug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-") })}
                      placeholder={autoSlug || "custom-slug"}
                    />
                  </div>
                )}
              </div>
              <Button
                className="w-full bg-brand-green hover:bg-brand-green-dark text-white h-11"
                disabled={!form.title || !form.scheduledAt || createMutation.isPending}
                onClick={handleCreate}
              >
                {createMutation.isPending ? "Creating..." : "Schedule Webinar & Create Event"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Search & Filter Bar */}
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search webinars..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40 gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="scheduled">Scheduled</SelectItem>
            <SelectItem value="live">Live</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Webinar List */}
      {isLoading ? (
        <div className="grid gap-4">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="border-0 shadow-sm">
              <CardContent className="p-6">
                <div className="animate-pulse space-y-3">
                  <div className="h-5 w-48 bg-muted rounded" />
                  <div className="h-3 w-32 bg-muted rounded" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : !webinars?.length ? (
        <Card className="border-0 shadow-sm">
          <CardContent className="p-12 text-center">
            <Video className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-muted-foreground">No webinars yet</p>
            <p className="text-xs text-muted-foreground mt-1">Schedule your first webinar to get started</p>
          </CardContent>
        </Card>
      ) : filtered.length === 0 ? (
        <Card className="border-0 shadow-sm">
          <CardContent className="p-12 text-center">
            <Search className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-muted-foreground">No webinars match your search</p>
            <Button variant="ghost" size="sm" className="mt-2" onClick={() => { setSearch(""); setStatusFilter("all"); }}>Clear filters</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {filtered.map((webinar) => (
            <Card
              key={webinar.id}
              className="border-0 shadow-sm hover:shadow-md transition-all cursor-pointer group"
              onClick={() => setLocation(`/webinars/${webinar.id}`)}
            >
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <h3 className="text-base font-semibold truncate" style={{ fontFamily: "Raleway, sans-serif" }}>{webinar.title}</h3>
                      <Badge className={`text-xs shrink-0 ${statusColors[webinar.status] || ""}`}>{webinar.status}</Badge>
                      {webinar.landingPageId && (
                        <Badge variant="outline" className="text-[10px] gap-1 shrink-0">
                          <FileText className="h-2.5 w-2.5" /> Landing Page
                        </Badge>
                      )}
                    </div>
                    {webinar.description && (
                      <p className="text-sm text-muted-foreground line-clamp-1 mb-2">{webinar.description}</p>
                    )}
                    <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3.5 w-3.5 text-brand-green" />
                        {new Date(webinar.scheduledAt).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" })}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5 text-brand-green" />
                        {new Date(webinar.scheduledAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </span>
                      <span className="flex items-center gap-1">
                        <Users className="h-3.5 w-3.5 text-brand-green" />
                        {webinar.durationMinutes} min
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-1 ml-3 shrink-0">
                    {webinar.zoomJoinUrl && (
                      <a href={webinar.zoomJoinUrl} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>
                        <Button variant="outline" size="sm" className="gap-1 text-xs">
                          <ExternalLink className="h-3 w-3" /> Zoom
                        </Button>
                      </a>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={(e) => { e.stopPropagation(); setDeleteId(webinar.id); }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
          {filtered.length > 0 && (
            <p className="text-xs text-muted-foreground text-center pt-1">
              Showing {filtered.length} of {webinars.length} webinar{webinars.length !== 1 ? "s" : ""}
            </p>
          )}
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteId !== null} onOpenChange={(open) => { if (!open) setDeleteId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Webinar?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete <strong>"{webinarToDelete?.title}"</strong> and all its sessions. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteId && deleteMutation.mutate({ id: deleteId })}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete Webinar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
