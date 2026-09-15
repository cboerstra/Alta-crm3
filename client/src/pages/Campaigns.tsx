import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Megaphone, Plus, Sparkles, Loader2, AlertTriangle, CheckCircle2,
  DollarSign, MousePointerClick, Users, TrendingUp, Settings2,
} from "lucide-react";
import { toast } from "sonner";
import { useLocation } from "wouter";

const STATUS_STYLES: Record<string, string> = {
  draft: "bg-gray-100 text-gray-700 border-gray-200",
  scheduled: "bg-blue-100 text-blue-700 border-blue-200",
  active: "bg-green-100 text-green-700 border-green-200",
  paused: "bg-amber-100 text-amber-700 border-amber-200",
  completed: "bg-slate-100 text-slate-700 border-slate-200",
  archived: "bg-slate-100 text-slate-500 border-slate-200",
};

const OBJECTIVES = [
  { value: "OUTCOME_LEADS", label: "Leads — collect contact details" },
  { value: "OUTCOME_TRAFFIC", label: "Traffic — send visits to the page" },
  { value: "OUTCOME_AWARENESS", label: "Awareness — maximise reach" },
  { value: "OUTCOME_ENGAGEMENT", label: "Engagement — likes, comments, shares" },
  { value: "OUTCOME_SALES", label: "Sales — optimise for conversions" },
];

const CTA_OPTIONS = ["LEARN_MORE", "SIGN_UP", "GET_QUOTE", "APPLY_NOW", "CONTACT_US", "GET_OFFER", "SUBSCRIBE"];

const money = (n: number | null | undefined) =>
  n == null ? "—" : `$${Number(n).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;

type DraftState = {
  name: string;
  description: string;
  objective: string;
  dailyBudget: string;
  lifetimeBudget: string;
  endDate: string;
  landingPageId: string;
  templateId: string;
  newPageTitle: string;
  sequenceId: string;
  primaryText: string;
  headline: string;
  adDescription: string;
  imageUrl: string;
  callToAction: string;
  zips: string;
};

const EMPTY_DRAFT: DraftState = {
  name: "", description: "", objective: "OUTCOME_LEADS",
  dailyBudget: "35", lifetimeBudget: "", endDate: "",
  landingPageId: "", templateId: "", newPageTitle: "",
  sequenceId: "", primaryText: "", headline: "", adDescription: "",
  imageUrl: "", callToAction: "LEARN_MORE", zips: "",
};

/** Banner explaining what still has to be connected before ads can run. */
function ConnectionBanner() {
  const { data: status } = trpc.campaigns.connectionStatus.useQuery();
  const [, navigate] = useLocation();
  if (!status) return null;

  const missing: string[] = [];
  if (!status.adAccountConnected) missing.push("Meta ad account");
  if (!status.pageConnected) missing.push("Facebook Page");
  if (!status.pixelConfigured) missing.push("pixel ID");
  if (!status.baseUrlConfigured) missing.push("public site URL (PUBLIC_BASE_URL)");

  if (missing.length === 0 && status.publishEnabled) return null;

  return (
    <Card className="border-amber-200 bg-amber-50">
      <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center gap-3">
        <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-amber-900">
            {missing.length > 0
              ? `Campaigns can be built and tracked now — publishing to Meta needs: ${missing.join(", ")}.`
              : "Publishing to Meta is switched off. Campaigns stay local until you enable it."}
          </p>
          <p className="text-xs text-amber-800 mt-0.5">
            Landing pages, attribution and nurture sequences all work without this.
          </p>
        </div>
        <Button size="sm" variant="outline" className="shrink-0" onClick={() => navigate("/settings")}>
          <Settings2 className="h-3.5 w-3.5 mr-1.5" /> Open settings
        </Button>
      </CardContent>
    </Card>
  );
}

/** The plain-language campaign brief → full draft flow. */
function AiDraftPanel({ onApply }: { onApply: (draft: any) => void }) {
  const [prompt, setPrompt] = useState("");
  const draftMutation = trpc.campaigns.draftWithAI.useMutation({
    onSuccess: (result) => {
      onApply(result);
      toast.success("Draft ready — review everything before publishing");
    },
    onError: (err) => toast.error(err.message),
  });

  return (
    <Card className="border-dashed">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-brand-gold" />
          <h3 className="text-sm font-semibold">Draft a campaign with AI</h3>
        </div>
        <p className="text-xs text-muted-foreground">
          Describe the campaign in plain English — "create a Facebook campaign for the Weber County
          down payment grant". You get ad copy, targeting, budget, landing page copy and a follow-up
          sequence to review. Nothing is created on Meta until you publish it yourself.
        </p>
        <Textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Create a Facebook campaign for the Weber County down payment grant, targeting Ogden first-time buyers, $40/day"
          rows={3}
          className="text-sm"
        />
        <Button
          size="sm"
          disabled={prompt.trim().length < 5 || draftMutation.isPending}
          onClick={() => draftMutation.mutate({ prompt: prompt.trim() })}
        >
          {draftMutation.isPending
            ? <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> Drafting…</>
            : <><Sparkles className="h-3.5 w-3.5 mr-1.5" /> Draft campaign</>}
        </Button>
      </CardContent>
    </Card>
  );
}

export default function Campaigns() {
  const [, navigate] = useLocation();
  const [createOpen, setCreateOpen] = useState(false);
  const [draft, setDraft] = useState<DraftState>(EMPTY_DRAFT);
  const [aiNotes, setAiNotes] = useState<string[]>([]);
  const [aiPrompt, setAiPrompt] = useState<string | null>(null);
  const [pageMode, setPageMode] = useState<"existing" | "template">("existing");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const utils = trpc.useUtils();
  const { data: campaigns, isLoading } = trpc.campaigns.list.useQuery(
    statusFilter === "all" ? undefined : { status: statusFilter as any }
  );
  const { data: pages } = trpc.marketing.landingPagePicker.useQuery();
  const { data: templates } = trpc.templates.list.useQuery();
  const { data: sequences } = trpc.automations.list.useQuery();

  const createPageFromTemplate = trpc.templates.createLandingPage.useMutation();
  const createCampaign = trpc.campaigns.create.useMutation();

  const resetForm = () => {
    setDraft(EMPTY_DRAFT);
    setAiNotes([]);
    setAiPrompt(null);
    setPageMode("existing");
  };

  const applyAiDraft = (result: any) => {
    const d = result.draft;
    setAiPrompt(d.name);
    setAiNotes(d.notes ?? []);
    setDraft((prev) => ({
      ...prev,
      name: d.name ?? prev.name,
      description: d.description ?? "",
      objective: d.objective ?? "OUTCOME_LEADS",
      dailyBudget: d.dailyBudget != null ? String(d.dailyBudget) : prev.dailyBudget,
      lifetimeBudget: d.lifetimeBudget != null ? String(d.lifetimeBudget) : "",
      primaryText: d.creative?.primaryText ?? "",
      headline: d.creative?.headline ?? "",
      adDescription: d.creative?.description ?? "",
      callToAction: d.creative?.callToAction ?? "LEARN_MORE",
      zips: (d.targeting?.zips ?? []).join(", "),
      templateId: result.matchedTemplateId ? String(result.matchedTemplateId) : prev.templateId,
      newPageTitle: d.landingPage?.title ?? prev.newPageTitle,
    }));
    if (result.matchedTemplateId) setPageMode("template");
    setCreateOpen(true);
  };

  const submit = async () => {
    if (!draft.name.trim()) {
      toast.error("Give the campaign a name");
      return;
    }
    const daily = draft.dailyBudget ? Number(draft.dailyBudget) : null;
    const lifetime = draft.lifetimeBudget ? Number(draft.lifetimeBudget) : null;
    if (!daily && !lifetime) {
      toast.error("Set a daily or lifetime budget");
      return;
    }
    if (lifetime && !draft.endDate) {
      toast.error("A lifetime budget needs an end date");
      return;
    }

    try {
      // Stamp out the landing page first so the campaign can be wired to it in
      // one step — a campaign without a destination cannot be published.
      let landingPageId: number | null = draft.landingPageId ? Number(draft.landingPageId) : null;
      if (pageMode === "template") {
        if (!draft.templateId) {
          toast.error("Pick a template for the landing page");
          return;
        }
        const title = draft.newPageTitle.trim() || draft.name.trim();
        const created = await createPageFromTemplate.mutateAsync({
          templateId: Number(draft.templateId),
          title,
          campaignTag: draft.name.trim(),
          sourceTag: "facebook",
          isActive: true,
        });
        landingPageId = created.id;
        toast.success(`Landing page created at /lp/${created.slug}`);
      }

      const zips = draft.zips
        .split(",")
        .map((z) => z.trim())
        .filter(Boolean)
        .map((z) => (z.includes(":") ? z : `US:${z}`));

      const result = await createCampaign.mutateAsync({
        name: draft.name.trim(),
        description: draft.description.trim() || undefined,
        objective: draft.objective as any,
        landingPageId,
        sequenceId: draft.sequenceId ? Number(draft.sequenceId) : null,
        dailyBudget: daily,
        lifetimeBudget: lifetime,
        endDate: draft.endDate ? new Date(draft.endDate) : null,
        targeting: zips.length > 0 ? { countries: ["US"], zips, ageMin: 18, ageMax: 65 } : null,
        creative: draft.primaryText
          ? {
              primaryText: draft.primaryText,
              headline: draft.headline || undefined,
              description: draft.adDescription || undefined,
              imageUrl: draft.imageUrl || undefined,
              callToAction: draft.callToAction,
            }
          : null,
        aiGenerated: !!aiPrompt,
        aiPrompt: aiPrompt ?? undefined,
      });

      toast.success("Campaign created as a draft");
      utils.campaigns.list.invalidate();
      utils.marketing.landingPagePicker.invalidate();
      setCreateOpen(false);
      resetForm();
      navigate(`/campaigns/${result.id}`);
    } catch (err: any) {
      toast.error(err?.message ?? "Could not create the campaign");
    }
  };

  const totals = useMemo(() => {
    if (!campaigns) return { spend: 0, clicks: 0, leads: 0, active: 0 };
    return campaigns.reduce(
      (acc, c) => ({
        spend: acc.spend + (c.totals?.spend ?? 0),
        clicks: acc.clicks + (c.totals?.clicks ?? 0),
        leads: acc.leads + (c.totals?.reportedLeads ?? 0),
        active: acc.active + (c.status === "active" ? 1 : 0),
      }),
      { spend: 0, clicks: 0, leads: 0, active: 0 }
    );
  }, [campaigns]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Megaphone className="h-6 w-6 text-brand-green" /> Campaigns
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Facebook and Instagram campaigns, their landing pages, and the follow-up they trigger.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[150px] h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="paused">Paused</SelectItem>
              <SelectItem value="archived">Archived</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={() => { resetForm(); setCreateOpen(true); }}>
            <Plus className="h-4 w-4 mr-1.5" /> New campaign
          </Button>
        </div>
      </div>

      <ConnectionBanner />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: "Total spend", value: money(totals.spend), icon: DollarSign },
          { label: "Clicks", value: totals.clicks.toLocaleString(), icon: MousePointerClick },
          { label: "Leads (Meta)", value: totals.leads.toLocaleString(), icon: Users },
          { label: "Active campaigns", value: String(totals.active), icon: TrendingUp },
        ].map((stat) => (
          <Card key={stat.label}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{stat.label}</p>
                <stat.icon className="h-4 w-4 text-muted-foreground" />
              </div>
              <p className="text-2xl font-bold mt-1">{stat.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <AiDraftPanel onApply={applyAiDraft} />

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : !campaigns || campaigns.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <Megaphone className="h-10 w-10 mx-auto text-muted-foreground/50" />
            <h3 className="mt-3 font-semibold">No campaigns yet</h3>
            <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
              Start with a landing page from a template, wire it to a nurture sequence, then push the
              campaign to Meta when you're ready to spend.
            </p>
            <Button className="mt-4" onClick={() => { resetForm(); setCreateOpen(true); }}>
              <Plus className="h-4 w-4 mr-1.5" /> Create your first campaign
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {campaigns.map((c) => (
            <Card
              key={c.id}
              className="hover:border-brand-green/40 transition-colors cursor-pointer"
              onClick={() => navigate(`/campaigns/${c.id}`)}
            >
              <CardContent className="p-4">
                <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold truncate">{c.name}</h3>
                      <Badge variant="outline" className={STATUS_STYLES[c.status] ?? ""}>{c.status}</Badge>
                      {c.aiGenerated && (
                        <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">
                          <Sparkles className="h-3 w-3 mr-1" /> AI draft
                        </Badge>
                      )}
                      {c.syncStatus === "error" && (
                        <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
                          <AlertTriangle className="h-3 w-3 mr-1" /> sync error
                        </Badge>
                      )}
                      {c.syncStatus === "synced" && (
                        <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                          <CheckCircle2 className="h-3 w-3 mr-1" /> on Meta
                        </Badge>
                      )}
                    </div>
                    {c.description && (
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{c.description}</p>
                    )}
                    <p className="text-xs text-muted-foreground mt-1">
                      {c.dailyBudget ? `${money(Number(c.dailyBudget))}/day` : null}
                      {c.lifetimeBudget ? `${money(Number(c.lifetimeBudget))} lifetime` : null}
                      {c.utmCampaign ? ` · utm_campaign=${c.utmCampaign}` : null}
                    </p>
                  </div>
                  <div className="grid grid-cols-4 gap-4 lg:gap-6 shrink-0">
                    {[
                      { label: "Spend", value: money(c.totals?.spend) },
                      { label: "Impr.", value: (c.totals?.impressions ?? 0).toLocaleString() },
                      { label: "Clicks", value: (c.totals?.clicks ?? 0).toLocaleString() },
                      { label: "Leads", value: (c.totals?.reportedLeads ?? 0).toLocaleString() },
                    ].map((m) => (
                      <div key={m.label} className="text-right">
                        <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{m.label}</p>
                        <p className="text-sm font-semibold">{m.value}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* ─── Create campaign dialog ─────────────────────────────────────── */}
      <Dialog open={createOpen} onOpenChange={(open) => { setCreateOpen(open); if (!open) resetForm(); }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>New campaign</DialogTitle>
            <DialogDescription>
              Everything is saved as a draft. Nothing reaches Meta until you publish it from the
              campaign page.
            </DialogDescription>
          </DialogHeader>

          {aiNotes.length > 0 && (
            <div className="rounded-md border border-amber-200 bg-amber-50 p-3 space-y-1">
              <p className="text-xs font-semibold text-amber-900">Review before publishing</p>
              <ul className="text-xs text-amber-800 list-disc pl-4 space-y-0.5">
                {aiNotes.map((note, i) => <li key={i}>{note}</li>)}
              </ul>
            </div>
          )}

          <Tabs defaultValue="basics">
            <TabsList className="w-full justify-start flex-wrap h-auto">
              <TabsTrigger value="basics">Basics &amp; budget</TabsTrigger>
              <TabsTrigger value="page">Landing page</TabsTrigger>
              <TabsTrigger value="creative">Ad creative</TabsTrigger>
              <TabsTrigger value="followup">Follow-up</TabsTrigger>
            </TabsList>

            <TabsContent value="basics" className="space-y-4 pt-4">
              <div className="space-y-1.5">
                <Label>Campaign name</Label>
                <Input
                  value={draft.name}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                  placeholder="Weber County Grant — Spring"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Internal notes</Label>
                <Textarea
                  value={draft.description}
                  onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                  rows={2}
                  placeholder="What this campaign is for, who it targets"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Objective</Label>
                <Select value={draft.objective} onValueChange={(v) => setDraft({ ...draft, objective: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {OBJECTIVES.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid sm:grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label>Daily budget ($)</Label>
                  <Input
                    type="number" min="1"
                    value={draft.dailyBudget}
                    onChange={(e) => setDraft({ ...draft, dailyBudget: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Lifetime budget ($)</Label>
                  <Input
                    type="number" min="1"
                    value={draft.lifetimeBudget}
                    onChange={(e) => setDraft({ ...draft, lifetimeBudget: e.target.value })}
                    placeholder="optional"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>End date</Label>
                  <Input
                    type="date"
                    value={draft.endDate}
                    onChange={(e) => setDraft({ ...draft, endDate: e.target.value })}
                  />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Set one or the other. A lifetime budget requires an end date — Meta rejects it otherwise.
              </p>
              <div className="space-y-1.5">
                <Label>Target ZIP codes</Label>
                <Input
                  value={draft.zips}
                  onChange={(e) => setDraft({ ...draft, zips: e.target.value })}
                  placeholder="84401, 84403, 84404"
                />
                <p className="text-xs text-muted-foreground">
                  Comma separated. Mortgage ads run under Meta's housing category, which blocks
                  targeting by age, gender and tight radiuses — geography stays broad on purpose.
                </p>
              </div>
            </TabsContent>

            <TabsContent value="page" className="space-y-4 pt-4">
              <div className="flex items-center gap-3">
                <Button
                  type="button"
                  size="sm"
                  variant={pageMode === "existing" ? "default" : "outline"}
                  onClick={() => setPageMode("existing")}
                >
                  Use an existing page
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={pageMode === "template" ? "default" : "outline"}
                  onClick={() => setPageMode("template")}
                >
                  Build from a template
                </Button>
              </div>

              {pageMode === "existing" ? (
                <div className="space-y-1.5">
                  <Label>Landing page</Label>
                  <Select
                    value={draft.landingPageId}
                    onValueChange={(v) => setDraft({ ...draft, landingPageId: v })}
                  >
                    <SelectTrigger><SelectValue placeholder="Choose a page" /></SelectTrigger>
                    <SelectContent>
                      {(pages ?? []).map((p) => (
                        <SelectItem key={p.id} value={String(p.id)}>
                          {p.title} — /lp/{p.slug}{p.isActive ? "" : " (inactive)"}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <Label>Template</Label>
                    <Select value={draft.templateId} onValueChange={(v) => setDraft({ ...draft, templateId: v })}>
                      <SelectTrigger><SelectValue placeholder="Choose a template" /></SelectTrigger>
                      <SelectContent>
                        {(templates ?? []).map((t) => (
                          <SelectItem key={t.id} value={String(t.id)}>{t.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {draft.templateId && (
                      <p className="text-xs text-muted-foreground">
                        {(templates ?? []).find((t) => String(t.id) === draft.templateId)?.description}
                      </p>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <Label>New page title</Label>
                    <Input
                      value={draft.newPageTitle}
                      onChange={(e) => setDraft({ ...draft, newPageTitle: e.target.value })}
                      placeholder="Weber County Down Payment Grant"
                    />
                    <p className="text-xs text-muted-foreground">
                      The URL is generated from this. The page is created live with the pixel and
                      Conversions API already switched on.
                    </p>
                  </div>
                </div>
              )}
            </TabsContent>

            <TabsContent value="creative" className="space-y-4 pt-4">
              <div className="space-y-1.5">
                <Label>Primary text</Label>
                <Textarea
                  value={draft.primaryText}
                  onChange={(e) => setDraft({ ...draft, primaryText: e.target.value })}
                  rows={4}
                  placeholder="The main body of the ad."
                />
              </div>
              <div className="grid sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Headline</Label>
                  <Input
                    value={draft.headline}
                    onChange={(e) => setDraft({ ...draft, headline: e.target.value })}
                    placeholder="Up to $15,000 in grant help"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Link description</Label>
                  <Input
                    value={draft.adDescription}
                    onChange={(e) => setDraft({ ...draft, adDescription: e.target.value })}
                    placeholder="See if you qualify"
                  />
                </div>
              </div>
              <div className="grid sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Image URL</Label>
                  <Input
                    value={draft.imageUrl}
                    onChange={(e) => setDraft({ ...draft, imageUrl: e.target.value })}
                    placeholder="https://…/ad-image.jpg"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Call to action</Label>
                  <Select value={draft.callToAction} onValueChange={(v) => setDraft({ ...draft, callToAction: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {CTA_OPTIONS.map((c) => (
                        <SelectItem key={c} value={c}>{c.replace(/_/g, " ").toLowerCase()}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                No rates, payments or approval promises in ad copy — mortgage advertising rules apply
                and Meta rejects ads that break them.
              </p>
            </TabsContent>

            <TabsContent value="followup" className="space-y-4 pt-4">
              <div className="space-y-1.5">
                <Label>Nurture sequence</Label>
                <Select value={draft.sequenceId} onValueChange={(v) => setDraft({ ...draft, sequenceId: v })}>
                  <SelectTrigger><SelectValue placeholder="No automated follow-up" /></SelectTrigger>
                  <SelectContent>
                    {(sequences ?? []).map((s) => (
                      <SelectItem key={s.id} value={String(s.id)}>
                        {s.name} ({s.stepCount} step{s.stepCount === 1 ? "" : "s"})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Every lead from this campaign's landing page is enrolled automatically — texts,
                  emails and call tasks fire on the schedule the sequence defines.
                </p>
              </div>
              {(!sequences || sequences.length === 0) && (
                <div className="rounded-md border bg-muted/30 p-3">
                  <p className="text-xs text-muted-foreground">
                    No sequences yet. You can create the campaign now and attach one later from
                    Automations.
                  </p>
                </div>
              )}
            </TabsContent>
          </Tabs>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button
              onClick={submit}
              disabled={createCampaign.isPending || createPageFromTemplate.isPending}
            >
              {createCampaign.isPending || createPageFromTemplate.isPending
                ? <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> Creating…</>
                : "Create campaign"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
