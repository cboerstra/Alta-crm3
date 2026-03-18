import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { useLocation } from "wouter";
import { Plus, Video, Calendar, Clock, ExternalLink, Trash2, FileText, Search, Filter, Users, X, CheckCircle, Loader2, Copy, AlertCircle } from "lucide-react";
import { toast } from "sonner";

const statusColors: Record<string, string> = {
  draft: "bg-gray-100 text-gray-700",
  scheduled: "bg-blue-100 text-blue-700",
  live: "bg-green-100 text-green-700",
  completed: "bg-brand-gold/10 text-brand-gold",
  cancelled: "bg-red-100 text-red-700",
};

// Created webinar result with Zoom data
type CreatedWebinar = {
  id: number;
  zoomWebinarId?: string;
  zoomJoinUrl?: string;
  zoomStartUrl?: string;
  zoomCreated: boolean;
  landingPageId?: number;
};

// Additional session result with Zoom data
type CreatedSession = {
  sessionId: number;
  label: string;
  zoomWebinarId?: string;
  zoomJoinUrl?: string;
  zoomStartUrl?: string;
  zoomCreated: boolean;
  sessionDate: string;
};

export default function Webinars() {
  const [, setLocation] = useLocation();
  const [showCreate, setShowCreate] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [deleteId, setDeleteId] = useState<number | null>(null);

  // Form state for step 1
  const [form, setForm] = useState({
    title: "", description: "", scheduledAt: "", durationMinutes: 60,
    createLandingPage: true, landingPageSlug: "",
  });

  // Step 2 state: after webinar is created
  const [createdWebinar, setCreatedWebinar] = useState<CreatedWebinar | null>(null);
  const [createdSessions, setCreatedSessions] = useState<CreatedSession[]>([]);

  // Additional session form (shown after primary is created)
  const [addSessionForm, setAddSessionForm] = useState({ date: "", durationMinutes: 60, label: "" });
  const [addingSession, setAddingSession] = useState(false);

  // Selection state
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);

  const { data: webinars, isLoading, refetch } = trpc.webinars.list.useQuery();
  const { data: integrationStatus } = trpc.integrations.getStatus.useQuery();
  const zoomConnected = integrationStatus?.zoom?.connected === true;

  const createMutation = trpc.webinars.create.useMutation({
    onSuccess: (data) => {
      setCreatedWebinar(data);
      if (data.zoomCreated) {
        toast.success(`Zoom meeting created! ID: ${data.zoomWebinarId}`, { duration: 5000 });
      }
      if (data.landingPageId) {
        toast.success("Landing page auto-created and linked", { duration: 4000 });
      }
      refetch();
    },
    onError: (e) => toast.error(e.message),
  });

  const addSessionMutation = trpc.webinars.addSession.useMutation({
    onSuccess: (data) => {
      setCreatedSessions(prev => [...prev, {
        sessionId: data.id,
        label: addSessionForm.label || "Additional Session",
        zoomWebinarId: data.zoomMeetingId ?? undefined,
        zoomJoinUrl: data.zoomJoinUrl ?? undefined,
        zoomStartUrl: data.zoomStartUrl ?? undefined,
        zoomCreated: data.zoomCreated ?? false,
        sessionDate: addSessionForm.date,
      }]);
      setAddSessionForm({ date: "", durationMinutes: 60, label: "" });
      setAddingSession(false);
      if (data.zoomCreated) {
        toast.success(`Zoom meeting created for additional session! ID: ${data.zoomMeetingId}`);
      } else {
        toast.success("Session added");
      }
      refetch();
    },
    onError: (e) => {
      toast.error(e.message);
      setAddingSession(false);
    },
  });

  const deleteMutation = trpc.webinars.delete.useMutation({
    onSuccess: () => {
      toast.success("Webinar deleted");
      setDeleteId(null);
      refetch();
    },
    onError: (e) => toast.error(e.message),
  });

  const bulkDeleteMutation = trpc.webinars.bulkDelete.useMutation({
    onSuccess: (data) => {
      toast.success(`${data.count} webinar${data.count === 1 ? "" : "s"} deleted`);
      setSelected(new Set());
      refetch();
    },
    onError: (e) => toast.error(e.message || "Failed to delete webinars"),
  });

  function resetForm() {
    setForm({ title: "", description: "", scheduledAt: "", durationMinutes: 60, createLandingPage: true, landingPageSlug: "" });
    setCreatedWebinar(null);
    setCreatedSessions([]);
    setAddSessionForm({ date: "", durationMinutes: 60, label: "" });
    setAddingSession(false);
  }

  const handleCreate = () => {
    if (!form.title) return toast.error("Webinar title is required");
    if (!form.scheduledAt) return toast.error("Date & time is required");
    createMutation.mutate({
      title: form.title,
      description: form.description || undefined,
      scheduledAt: new Date(form.scheduledAt).getTime(),
      durationMinutes: form.durationMinutes,
      createLandingPage: form.createLandingPage,
      landingPageSlug: form.landingPageSlug || undefined,
    });
  };

  const handleAddSession = () => {
    if (!createdWebinar) return;
    if (!addSessionForm.date) return toast.error("Session date & time is required");
    setAddingSession(true);
    addSessionMutation.mutate({
      webinarId: createdWebinar.id,
      sessionDate: new Date(addSessionForm.date).getTime(),
      durationMinutes: addSessionForm.durationMinutes,
      label: addSessionForm.label || undefined,
    });
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard`);
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

  // Selection helpers
  const filteredIds = filtered.map(w => w.id);
  const allSelected = filteredIds.length > 0 && filteredIds.every(id => selected.has(id));
  const someSelected = filteredIds.some(id => selected.has(id));

  const toggleSelectAll = () => {
    if (allSelected) {
      const next = new Set(selected);
      filteredIds.forEach(id => next.delete(id));
      setSelected(next);
    } else {
      const next = new Set(selected);
      filteredIds.forEach(id => next.add(id));
      setSelected(next);
    }
  };

  const toggleSelect = (id: number) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  };

  // Zoom credentials display component
  const ZoomCredentialsPanel = ({ label, zoomWebinarId, zoomJoinUrl, zoomStartUrl, zoomCreated }: {
    label: string;
    zoomWebinarId?: string;
    zoomJoinUrl?: string;
    zoomStartUrl?: string;
    zoomCreated: boolean;
  }) => (
    <div className="rounded-lg border bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <CheckCircle className="h-5 w-5 text-green-600" />
        <p className="text-sm font-semibold text-green-700 dark:text-green-300">{label} — Zoom Meeting Created</p>
      </div>
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground font-medium">Zoom Webinar ID</p>
            <p className="text-sm font-mono font-semibold truncate">{zoomWebinarId || "—"}</p>
          </div>
          {zoomWebinarId && (
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0 shrink-0" onClick={() => copyToClipboard(zoomWebinarId, "Zoom Webinar ID")}>
              <Copy className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground font-medium">Zoom Join URL</p>
            {zoomJoinUrl ? (
              <a href={zoomJoinUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-brand-green underline break-all">{zoomJoinUrl}</a>
            ) : (
              <p className="text-sm text-muted-foreground italic">—</p>
            )}
          </div>
          {zoomJoinUrl && (
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0 shrink-0" onClick={() => copyToClipboard(zoomJoinUrl, "Join URL")}>
              <Copy className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground font-medium">Zoom Start URL (Host)</p>
            {zoomStartUrl ? (
              <a href={zoomStartUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-brand-green underline break-all line-clamp-1">{zoomStartUrl.substring(0, 80)}...</a>
            ) : (
              <p className="text-sm text-muted-foreground italic">—</p>
            )}
          </div>
          {zoomStartUrl && (
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0 shrink-0" onClick={() => copyToClipboard(zoomStartUrl, "Start URL")}>
              <Copy className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
        <div>
          <p className="text-xs text-muted-foreground font-medium">Replay URL</p>
          <p className="text-sm text-muted-foreground italic">Available after webinar ends — edit on the webinar detail page</p>
        </div>
      </div>
    </div>
  );

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
              <DialogTitle style={{ fontFamily: "Raleway, sans-serif" }}>
                {createdWebinar ? "Webinar Created" : "Schedule New Webinar"}
              </DialogTitle>
            </DialogHeader>

            {/* ─── STEP 1: Create Webinar Form ─── */}
            {!createdWebinar && (
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
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                    <Video className="h-4 w-4" /> Zoom Session <span className="text-red-500">*</span>
                  </h3>
                  <p className="text-xs text-muted-foreground -mt-2">Set the date & time for your webinar session.</p>

                  {/* Zoom status banner */}
                  {zoomConnected ? (
                    <div className="p-3 rounded-lg border bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800">
                      <div className="flex items-center gap-2">
                        <CheckCircle className="h-4 w-4 text-green-600" />
                        <p className="text-sm font-medium text-green-700 dark:text-green-300">Zoom Connected</p>
                      </div>
                      <p className="text-xs text-green-600 dark:text-green-400 mt-1">A Zoom meeting will be automatically created and the Zoom Webinar ID, Join URL, and Start URL will be displayed after you click "Create."</p>
                    </div>
                  ) : (
                    <div className="p-3 rounded-lg border bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800">
                      <div className="flex items-center gap-2">
                        <AlertCircle className="h-4 w-4 text-amber-600" />
                        <p className="text-sm font-medium text-amber-700 dark:text-amber-300">Zoom Not Connected</p>
                      </div>
                      <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                        Go to <a href="/settings" className="underline font-medium">Settings → Zoom</a> to connect your Zoom account. Without Zoom, the session will be created without Zoom meeting details.
                      </p>
                    </div>
                  )}

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
                      <div className="text-xs text-muted-foreground mb-1">/lp/<span className="font-mono">{form.landingPageSlug || autoSlug || "auto-generated"}</span></div>
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
                  {createMutation.isPending ? (
                    <span className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      {zoomConnected ? "Creating Webinar & Zoom Meeting..." : "Creating Webinar..."}
                    </span>
                  ) : (
                    zoomConnected ? "Create Webinar & Zoom Session" : "Create Webinar"
                  )}
                </Button>
              </div>
            )}

            {/* ─── STEP 2: Webinar Created — Show Zoom Credentials ─── */}
            {createdWebinar && (
              <div className="space-y-5 py-2">
                {/* Success header */}
                <div className="flex items-center gap-3 p-3 rounded-lg bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800">
                  <CheckCircle className="h-6 w-6 text-green-600 shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-green-700 dark:text-green-300">Webinar "{form.title}" created successfully!</p>
                    {createdWebinar.landingPageId && (
                      <p className="text-xs text-green-600 dark:text-green-400 mt-0.5">Landing page auto-created and linked.</p>
                    )}
                  </div>
                </div>

                {/* Primary Session Zoom Credentials */}
                <div>
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Primary Session — Zoom Credentials</h3>
                  {createdWebinar.zoomCreated ? (
                    <ZoomCredentialsPanel
                      label="Primary Session"
                      zoomWebinarId={createdWebinar.zoomWebinarId}
                      zoomJoinUrl={createdWebinar.zoomJoinUrl}
                      zoomStartUrl={createdWebinar.zoomStartUrl}
                      zoomCreated={true}
                    />
                  ) : (
                    <div className="rounded-lg border bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800 p-4">
                      <div className="flex items-center gap-2">
                        <AlertCircle className="h-5 w-5 text-amber-600" />
                        <p className="text-sm font-medium text-amber-700 dark:text-amber-300">Zoom meeting was not created</p>
                      </div>
                      <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                        {zoomConnected
                          ? "Zoom is connected but the meeting creation failed. Check your Zoom credentials in Settings → Zoom, or add Zoom details manually on the webinar detail page."
                          : "Zoom is not connected. Go to Settings → Zoom to connect, then add sessions from the webinar detail page."}
                      </p>
                    </div>
                  )}
                </div>

                {/* Additional Sessions Created */}
                {createdSessions.length > 0 && (
                  <div className="space-y-3">
                    <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Additional Sessions</h3>
                    {createdSessions.map((session, idx) => (
                      <div key={session.sessionId}>
                        {session.zoomCreated ? (
                          <ZoomCredentialsPanel
                            label={session.label || `Session ${idx + 2}`}
                            zoomWebinarId={session.zoomWebinarId}
                            zoomJoinUrl={session.zoomJoinUrl}
                            zoomStartUrl={session.zoomStartUrl}
                            zoomCreated={true}
                          />
                        ) : (
                          <div className="rounded-lg border p-3 bg-muted/20">
                            <p className="text-sm font-medium">{session.label || `Session ${idx + 2}`}</p>
                            <p className="text-xs text-muted-foreground">
                              {new Date(session.sessionDate).toLocaleString()} — No Zoom meeting created
                            </p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                <Separator />

                {/* Add Additional Session Form */}
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                    <Plus className="h-4 w-4" /> Add Additional Session
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Offer multiple dates so leads can choose the session that works best for them.
                    {zoomConnected && " A Zoom meeting will be automatically created for each additional session."}
                  </p>
                  <div className="p-3 rounded-lg border bg-card space-y-3">
                    <div>
                      <Label>Session Label (optional)</Label>
                      <Input
                        value={addSessionForm.label}
                        onChange={(e) => setAddSessionForm({ ...addSessionForm, label: e.target.value })}
                        placeholder="e.g., Evening Session, Saturday Session"
                        className="text-sm"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label>Date & Time <span className="text-red-500">*</span></Label>
                        <Input
                          type="datetime-local"
                          value={addSessionForm.date}
                          onChange={(e) => setAddSessionForm({ ...addSessionForm, date: e.target.value })}
                          className="text-sm"
                        />
                      </div>
                      <div>
                        <Label>Duration (minutes)</Label>
                        <Input
                          type="number"
                          value={addSessionForm.durationMinutes}
                          onChange={(e) => setAddSessionForm({ ...addSessionForm, durationMinutes: Number(e.target.value) })}
                          className="text-sm"
                        />
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      className="w-full gap-2"
                      disabled={!addSessionForm.date || addSessionMutation.isPending}
                      onClick={handleAddSession}
                    >
                      {addSessionMutation.isPending ? (
                        <span className="flex items-center gap-2">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          {zoomConnected ? "Creating Session & Zoom Meeting..." : "Adding Session..."}
                        </span>
                      ) : (
                        <>
                          <Plus className="h-4 w-4" />
                          {zoomConnected ? "Add Session & Create Zoom Meeting" : "Add Session"}
                        </>
                      )}
                    </Button>
                  </div>
                </div>

                <Separator />

                {/* Done button */}
                <div className="flex gap-3">
                  <Button
                    className="flex-1 bg-brand-green hover:bg-brand-green-dark text-white h-11"
                    onClick={() => {
                      setShowCreate(false);
                      resetForm();
                      setLocation(`/webinars/${createdWebinar.id}`);
                    }}
                  >
                    Go to Webinar Detail Page
                  </Button>
                  <Button
                    variant="outline"
                    className="h-11"
                    onClick={() => {
                      setShowCreate(false);
                      resetForm();
                    }}
                  >
                    Close
                  </Button>
                </div>
              </div>
            )}
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
            onChange={(e) => { setSearch(e.target.value); setSelected(new Set()); }}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setSelected(new Set()); }}>
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

      {/* Bulk Action Toolbar */}
      {selected.size > 0 && (
        <div className="flex items-center justify-between rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-2.5">
          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold text-foreground">
              {selected.size} webinar{selected.size === 1 ? "" : "s"} selected
            </span>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs text-muted-foreground gap-1"
              onClick={() => setSelected(new Set())}
            >
              <X className="h-3.5 w-3.5" />
              Clear selection
            </Button>
          </div>
          <Button
            variant="destructive"
            size="sm"
            className="gap-2"
            onClick={() => setConfirmBulkDelete(true)}
            disabled={bulkDeleteMutation.isPending}
          >
            <Trash2 className="h-4 w-4" />
            Delete {selected.size} Webinar{selected.size === 1 ? "" : "s"}
          </Button>
        </div>
      )}

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
          {/* Select-all row */}
          {filtered.length > 1 && (
            <div className="flex items-center gap-3 px-1 pb-1">
              <Checkbox
                checked={allSelected}
                data-state={someSelected && !allSelected ? "indeterminate" : undefined}
                onCheckedChange={toggleSelectAll}
                aria-label="Select all visible webinars"
                className="border-muted-foreground/40"
              />
              <span className="text-xs text-muted-foreground">
                {allSelected ? "Deselect all" : `Select all ${filtered.length} webinars`}
              </span>
            </div>
          )}

          {filtered.map((webinar) => {
            const isSelected = selected.has(webinar.id);
            return (
              <Card
                key={webinar.id}
                className={`border-0 shadow-sm hover:shadow-md transition-all cursor-pointer group ${isSelected ? "ring-1 ring-destructive/40 bg-destructive/5" : ""}`}
                onClick={() => setLocation(`/webinars/${webinar.id}`)}
              >
                <CardContent className="p-5">
                  <div className="flex items-start gap-3">
                    {/* Checkbox */}
                    <div className="pt-0.5" onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => toggleSelect(webinar.id)}
                        aria-label={`Select ${webinar.title}`}
                        className="border-muted-foreground/40"
                      />
                    </div>

                    <div className="flex-1 min-w-0">
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
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}

          {filtered.length > 0 && (
            <p className="text-xs text-muted-foreground text-center pt-1">
              Showing {filtered.length} of {webinars.length} webinar{webinars.length !== 1 ? "s" : ""}
            </p>
          )}
        </div>
      )}

      {/* Single Delete Confirmation */}
      <AlertDialog open={deleteId !== null} onOpenChange={(open) => { if (!open) setDeleteId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="h-5 w-5" />
              Delete Webinar?
            </AlertDialogTitle>
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

      {/* Bulk Delete Confirmation */}
      <AlertDialog open={confirmBulkDelete} onOpenChange={setConfirmBulkDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="h-5 w-5" />
              Delete {selected.size} Webinar{selected.size === 1 ? "" : "s"}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              You are about to permanently delete <strong>{selected.size} webinar{selected.size === 1 ? "" : "s"}</strong> and all their sessions. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                bulkDeleteMutation.mutate({ ids: Array.from(selected) });
                setConfirmBulkDelete(false);
              }}
            >
              Delete {selected.size} Webinar{selected.size === 1 ? "" : "s"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
