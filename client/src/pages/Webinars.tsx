import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useLocation } from "wouter";
import { Plus, Video, Calendar, Users, Clock, ExternalLink } from "lucide-react";
import { toast } from "sonner";

const statusColors: Record<string, string> = {
  draft: "bg-gray-100 text-gray-700",
  scheduled: "bg-blue-100 text-blue-700",
  live: "bg-green-100 text-green-700",
  completed: "bg-brand-gold/10 text-brand-gold",
  cancelled: "bg-red-100 text-red-700",
};

export default function Webinars() {
  const [, setLocation] = useLocation();
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({
    title: "", description: "", scheduledAt: "", durationMinutes: 60,
    zoomJoinUrl: "", replayUrl: "",
  });

  const { data: webinars, isLoading, refetch } = trpc.webinars.list.useQuery();

  const createMutation = trpc.webinars.create.useMutation({
    onSuccess: () => {
      toast.success("Webinar created");
      setShowCreate(false);
      setForm({ title: "", description: "", scheduledAt: "", durationMinutes: 60, zoomJoinUrl: "", replayUrl: "" });
      refetch();
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ fontFamily: "Raleway, sans-serif" }}>Webinars</h1>
          <p className="text-muted-foreground text-sm mt-1">Manage your webinar events</p>
        </div>
        <Dialog open={showCreate} onOpenChange={setShowCreate}>
          <DialogTrigger asChild>
            <Button className="bg-brand-green hover:bg-brand-green-dark text-white gap-2">
              <Plus className="h-4 w-4" /> Create Webinar
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle style={{ fontFamily: "Raleway, sans-serif" }}>Create Webinar</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-2">
              <div>
                <Label>Title *</Label>
                <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
              </div>
              <div>
                <Label>Description</Label>
                <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Date & Time *</Label>
                  <Input type="datetime-local" value={form.scheduledAt} onChange={(e) => setForm({ ...form, scheduledAt: e.target.value })} />
                </div>
                <div>
                  <Label>Duration (min)</Label>
                  <Input type="number" value={form.durationMinutes} onChange={(e) => setForm({ ...form, durationMinutes: Number(e.target.value) })} />
                </div>
              </div>
              <div>
                <Label>Zoom Join URL</Label>
                <Input placeholder="https://zoom.us/j/..." value={form.zoomJoinUrl} onChange={(e) => setForm({ ...form, zoomJoinUrl: e.target.value })} />
              </div>
              <div>
                <Label>Replay URL (for no-show follow-up)</Label>
                <Input placeholder="https://..." value={form.replayUrl} onChange={(e) => setForm({ ...form, replayUrl: e.target.value })} />
              </div>
              <Button
                className="bg-brand-green hover:bg-brand-green-dark text-white"
                disabled={!form.title || !form.scheduledAt || createMutation.isPending}
                onClick={() => createMutation.mutate({
                  ...form,
                  scheduledAt: new Date(form.scheduledAt).getTime(),
                  zoomJoinUrl: form.zoomJoinUrl || undefined,
                  replayUrl: form.replayUrl || undefined,
                })}
              >
                {createMutation.isPending ? "Creating..." : "Create Webinar"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="grid gap-4">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="border-0 shadow-sm"><CardContent className="p-6"><div className="animate-pulse space-y-3"><div className="h-5 w-48 bg-muted rounded" /><div className="h-3 w-32 bg-muted rounded" /></div></CardContent></Card>
          ))}
        </div>
      ) : !webinars?.length ? (
        <Card className="border-0 shadow-sm">
          <CardContent className="p-12 text-center">
            <Video className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-muted-foreground">No webinars yet</p>
            <p className="text-xs text-muted-foreground mt-1">Create your first webinar to get started</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {webinars.map((webinar) => (
            <Card
              key={webinar.id}
              className="border-0 shadow-sm hover:shadow-md transition-all cursor-pointer"
              onClick={() => setLocation(`/webinars/${webinar.id}`)}
            >
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-base font-semibold" style={{ fontFamily: "Raleway, sans-serif" }}>{webinar.title}</h3>
                      <Badge className={`text-xs ${statusColors[webinar.status] || ""}`}>{webinar.status}</Badge>
                    </div>
                    {webinar.description && <p className="text-sm text-muted-foreground line-clamp-2">{webinar.description}</p>}
                    <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1"><Calendar className="h-3.5 w-3.5" /> {new Date(webinar.scheduledAt).toLocaleDateString()}</span>
                      <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> {new Date(webinar.scheduledAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                      <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> {webinar.durationMinutes} min</span>
                    </div>
                  </div>
                  {webinar.zoomJoinUrl && (
                    <a href={webinar.zoomJoinUrl} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>
                      <Button variant="outline" size="sm" className="gap-1 text-xs">
                        <ExternalLink className="h-3 w-3" /> Zoom
                      </Button>
                    </a>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
