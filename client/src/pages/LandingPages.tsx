import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, FileText, ExternalLink, Copy, Trash2, Edit } from "lucide-react";
import { toast } from "sonner";

export default function LandingPages() {
  const [showCreate, setShowCreate] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState({
    title: "", slug: "", headline: "", subheadline: "", ctaText: "Register Now",
    campaignTag: "", sourceTag: "", webinarId: undefined as number | undefined,
    isActive: true, accentColor: "#C9A84C",
  });

  const { data: pages, isLoading, refetch } = trpc.landingPages.list.useQuery();
  const { data: webinars } = trpc.webinars.list.useQuery();

  const createMutation = trpc.landingPages.create.useMutation({
    onSuccess: () => { toast.success("Landing page created"); setShowCreate(false); resetForm(); refetch(); },
    onError: (e) => toast.error(e.message),
  });

  const updateMutation = trpc.landingPages.update.useMutation({
    onSuccess: () => { toast.success("Landing page updated"); setEditId(null); resetForm(); refetch(); },
    onError: (e) => toast.error(e.message),
  });

  const deleteMutation = trpc.landingPages.delete.useMutation({
    onSuccess: () => { toast.success("Landing page deleted"); refetch(); },
    onError: (e) => toast.error(e.message),
  });

  function resetForm() {
    setForm({ title: "", slug: "", headline: "", subheadline: "", ctaText: "Register Now", campaignTag: "", sourceTag: "", webinarId: undefined, isActive: true, accentColor: "#C9A84C" });
  }

  function openEdit(page: any) {
    setForm({
      title: page.title, slug: page.slug, headline: page.headline || "",
      subheadline: page.subheadline || "", ctaText: page.ctaText || "Register Now",
      campaignTag: page.campaignTag || "", sourceTag: page.sourceTag || "",
      webinarId: page.webinarId || undefined, isActive: page.isActive,
      accentColor: page.accentColor || "#C9A84C",
    });
    setEditId(page.id);
  }

  const copyUrl = (slug: string) => {
    navigator.clipboard.writeText(`${window.location.origin}/lp/${slug}`);
    toast.success("URL copied to clipboard");
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ fontFamily: "Raleway, sans-serif" }}>Landing Pages</h1>
          <p className="text-muted-foreground text-sm mt-1">Create and manage lead capture pages</p>
        </div>
        <Dialog open={showCreate || editId !== null} onOpenChange={(v) => { if (!v) { setShowCreate(false); setEditId(null); resetForm(); } else setShowCreate(true); }}>
          <DialogTrigger asChild>
            <Button className="bg-brand-green hover:bg-brand-green-dark text-white gap-2">
              <Plus className="h-4 w-4" /> Create Page
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle style={{ fontFamily: "Raleway, sans-serif" }}>
                {editId ? "Edit Landing Page" : "Create Landing Page"}
              </DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-2">
              <div>
                <Label>Title *</Label>
                <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
              </div>
              {!editId && (
                <div>
                  <Label>URL Slug *</Label>
                  <div className="flex items-center gap-1 text-sm text-muted-foreground mb-1">
                    <span>{window.location.origin}/lp/</span>
                  </div>
                  <Input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-") })} placeholder="spring-webinar-2026" />
                </div>
              )}
              <div>
                <Label>Headline</Label>
                <Input value={form.headline} onChange={(e) => setForm({ ...form, headline: e.target.value })} placeholder="Join Our Free Webinar" />
              </div>
              <div>
                <Label>Subheadline</Label>
                <Textarea value={form.subheadline} onChange={(e) => setForm({ ...form, subheadline: e.target.value })} placeholder="Learn the secrets to..." />
              </div>
              <div>
                <Label>CTA Button Text</Label>
                <Input value={form.ctaText} onChange={(e) => setForm({ ...form, ctaText: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Source Tag</Label>
                  <Input value={form.sourceTag} onChange={(e) => setForm({ ...form, sourceTag: e.target.value })} placeholder="facebook" />
                </div>
                <div>
                  <Label>Campaign Tag</Label>
                  <Input value={form.campaignTag} onChange={(e) => setForm({ ...form, campaignTag: e.target.value })} placeholder="spring-2026" />
                </div>
              </div>
              <div>
                <Label>Link to Webinar</Label>
                <Select value={form.webinarId?.toString() ?? "none"} onValueChange={(v) => setForm({ ...form, webinarId: v === "none" ? undefined : Number(v) })}>
                  <SelectTrigger><SelectValue placeholder="Select webinar..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No webinar</SelectItem>
                    {webinars?.map((w) => (
                      <SelectItem key={w.id} value={w.id.toString()}>{w.title}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center justify-between">
                <Label>Active</Label>
                <Switch checked={form.isActive} onCheckedChange={(v) => setForm({ ...form, isActive: v })} />
              </div>
              <Button
                className="bg-brand-green hover:bg-brand-green-dark text-white"
                disabled={!form.title || (!editId && !form.slug)}
                onClick={() => {
                  if (editId) {
                    updateMutation.mutate({ id: editId, ...form, webinarId: form.webinarId });
                  } else {
                    createMutation.mutate(form);
                  }
                }}
              >
                {editId ? "Update Page" : "Create Page"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="grid gap-4">{[1, 2].map((i) => <Card key={i} className="border-0 shadow-sm"><CardContent className="p-6"><div className="animate-pulse space-y-3"><div className="h-5 w-48 bg-muted rounded" /><div className="h-3 w-32 bg-muted rounded" /></div></CardContent></Card>)}</div>
      ) : !pages?.length ? (
        <Card className="border-0 shadow-sm">
          <CardContent className="p-12 text-center">
            <FileText className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-muted-foreground">No landing pages yet</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {pages.map((page) => (
            <Card key={page.id} className="border-0 shadow-sm">
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-base font-semibold" style={{ fontFamily: "Raleway, sans-serif" }}>{page.title}</h3>
                      <Badge variant={page.isActive ? "default" : "secondary"} className={page.isActive ? "bg-brand-green text-white" : ""}>
                        {page.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">/lp/{page.slug}</p>
                    <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                      {page.sourceTag && <span>Source: {page.sourceTag}</span>}
                      {page.campaignTag && <span>Campaign: {page.campaignTag}</span>}
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => copyUrl(page.slug)}>
                      <Copy className="h-4 w-4" />
                    </Button>
                    <a href={`/lp/${page.slug}`} target="_blank" rel="noopener noreferrer">
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0"><ExternalLink className="h-4 w-4" /></Button>
                    </a>
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => openEdit(page)}>
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-destructive" onClick={() => deleteMutation.mutate({ id: page.id })}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
