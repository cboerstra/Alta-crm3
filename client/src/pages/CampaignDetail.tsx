import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useParams, useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  ArrowLeft, Loader2, Upload, Play, Pause, RefreshCw, ExternalLink, Copy,
  AlertTriangle, CheckCircle2, DollarSign, Users, TrendingUp, Target,
} from "lucide-react";
import { toast } from "sonner";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from "recharts";

const money = (n: number | null | undefined) =>
  n == null ? "—" : `$${Number(n).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;

const STATUS_STYLES: Record<string, string> = {
  draft: "bg-gray-100 text-gray-700 border-gray-200",
  scheduled: "bg-blue-100 text-blue-700 border-blue-200",
  active: "bg-green-100 text-green-700 border-green-200",
  paused: "bg-amber-100 text-amber-700 border-amber-200",
  completed: "bg-slate-100 text-slate-700 border-slate-200",
  archived: "bg-slate-100 text-slate-500 border-slate-200",
};

const STAGE_LABELS: Record<string, string> = {
  new_lead: "New",
  registered: "Registered",
  attended: "Attended",
  no_show: "No show",
  consultation_booked: "Consultation",
  under_contract: "Under contract",
  closed: "Closed",
};

export default function CampaignDetail() {
  const params = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const campaignId = Number(params.id);
  const utils = trpc.useUtils();

  const [budgetOpen, setBudgetOpen] = useState(false);
  const [dailyBudget, setDailyBudget] = useState("");

  const { data: campaign, isLoading } = trpc.campaigns.getById.useQuery(
    { id: campaignId },
    { enabled: Number.isFinite(campaignId) }
  );

  const publish = trpc.campaigns.publish.useMutation({
    onSuccess: () => {
      toast.success("Campaign created on Meta — it starts paused, so nothing is spending yet");
      utils.campaigns.getById.invalidate({ id: campaignId });
    },
    onError: (err) => toast.error(err.message),
  });

  const setDelivery = trpc.campaigns.setDelivery.useMutation({
    onSuccess: (res) => {
      toast.success(res.status === "active" ? "Campaign is live" : "Campaign paused");
      utils.campaigns.getById.invalidate({ id: campaignId });
    },
    onError: (err) => toast.error(err.message),
  });

  const syncMetrics = trpc.campaigns.syncMetrics.useMutation({
    onSuccess: (res) => {
      toast.success(res.rows > 0 ? `Pulled ${res.rows} day(s) of insights` : "No new insights yet");
      utils.campaigns.getById.invalidate({ id: campaignId });
    },
    onError: (err) => toast.error(err.message),
  });

  const updateCampaign = trpc.campaigns.update.useMutation({
    onSuccess: (res: any) => {
      if (res?.warning) toast.warning(res.warning);
      else toast.success("Budget updated");
      setBudgetOpen(false);
      utils.campaigns.getById.invalidate({ id: campaignId });
    },
    onError: (err) => toast.error(err.message),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!campaign) {
    return (
      <Card>
        <CardContent className="p-12 text-center">
          <h3 className="font-semibold">Campaign not found</h3>
          <Button variant="outline" className="mt-4" onClick={() => navigate("/campaigns")}>
            Back to campaigns
          </Button>
        </CardContent>
      </Card>
    );
  }

  const s = campaign.summary;
  const chartData = (campaign.metrics ?? []).map((m) => ({
    date: m.date,
    spend: Number(m.spend ?? 0),
    clicks: Number(m.clicks ?? 0),
    leads: Number(m.reportedLeads ?? 0),
  }));

  const isPublished = !!campaign.metaCampaignId;
  const isLive = campaign.status === "active";

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" className="-ml-2" onClick={() => navigate("/campaigns")}>
        <ArrowLeft className="h-4 w-4 mr-1.5" /> Campaigns
      </Button>

      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-bold tracking-tight truncate">{campaign.name}</h1>
            <Badge variant="outline" className={STATUS_STYLES[campaign.status] ?? ""}>{campaign.status}</Badge>
            {isPublished && (
              <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                <CheckCircle2 className="h-3 w-3 mr-1" /> on Meta
              </Badge>
            )}
          </div>
          {campaign.description && (
            <p className="text-sm text-muted-foreground mt-1">{campaign.description}</p>
          )}
          <p className="text-xs text-muted-foreground mt-1">
            {campaign.dailyBudget ? `${money(Number(campaign.dailyBudget))}/day` : ""}
            {campaign.lifetimeBudget ? `${money(Number(campaign.lifetimeBudget))} lifetime` : ""}
            {campaign.utmCampaign ? ` · utm_campaign=${campaign.utmCampaign}` : ""}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap shrink-0">
          <Button
            variant="outline" size="sm"
            onClick={() => {
              setDailyBudget(campaign.dailyBudget ? String(Number(campaign.dailyBudget)) : "");
              setBudgetOpen(true);
            }}
          >
            <DollarSign className="h-3.5 w-3.5 mr-1.5" /> Budget
          </Button>
          {isPublished && (
            <Button
              variant="outline" size="sm"
              disabled={syncMetrics.isPending}
              onClick={() => syncMetrics.mutate({ id: campaignId })}
            >
              {syncMetrics.isPending
                ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                : <RefreshCw className="h-3.5 w-3.5 mr-1.5" />}
              Sync insights
            </Button>
          )}
          {!isPublished ? (
            <Button size="sm" disabled={publish.isPending} onClick={() => publish.mutate({ id: campaignId })}>
              {publish.isPending
                ? <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> Publishing…</>
                : <><Upload className="h-3.5 w-3.5 mr-1.5" /> Publish to Meta</>}
            </Button>
          ) : (
            <Button
              size="sm"
              variant={isLive ? "outline" : "default"}
              disabled={setDelivery.isPending}
              onClick={() => setDelivery.mutate({ id: campaignId, active: !isLive })}
            >
              {setDelivery.isPending
                ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                : isLive
                  ? <Pause className="h-3.5 w-3.5 mr-1.5" />
                  : <Play className="h-3.5 w-3.5 mr-1.5" />}
              {isLive ? "Pause delivery" : "Start delivery"}
            </Button>
          )}
        </div>
      </div>

      {campaign.syncStatus === "error" && campaign.syncError && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-4 flex gap-3">
            <AlertTriangle className="h-5 w-5 text-red-600 shrink-0" />
            <div className="min-w-0">
              <p className="text-sm font-medium text-red-900">Meta rejected the last sync</p>
              <p className="text-xs text-red-800 mt-0.5 break-words">{campaign.syncError}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ─── Funnel: spend through to closed loans ───────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: "Spend", value: money(s.spend), sub: `${s.impressions.toLocaleString()} impressions` },
          { label: "Leads in CRM", value: String(s.crmLeads), sub: s.costPerLead ? `${money(s.costPerLead)} per lead` : `${s.clicks.toLocaleString()} clicks` },
          { label: "Consultations", value: String(s.consultations), sub: `${s.closed} closed` },
          { label: "Closed revenue", value: money(s.closedRevenue), sub: s.roas ? `${s.roas.toFixed(2)}× return on spend` : "no spend recorded" },
        ].map((stat) => (
          <Card key={stat.label}>
            <CardContent className="p-4">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{stat.label}</p>
              <p className="text-2xl font-bold mt-1">{stat.value}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{stat.sub}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="performance">
        <TabsList>
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="leads">Leads ({campaign.leads?.length ?? 0})</TabsTrigger>
          <TabsTrigger value="setup">Setup</TabsTrigger>
        </TabsList>

        <TabsContent value="performance" className="pt-4">
          <Card>
            <CardContent className="p-4">
              {chartData.length === 0 ? (
                <div className="py-12 text-center">
                  <TrendingUp className="h-8 w-8 mx-auto text-muted-foreground/50" />
                  <p className="text-sm text-muted-foreground mt-2">
                    {isPublished
                      ? "No insights yet. Meta reports with a few hours' delay — the CRM syncs hourly."
                      : "Publish this campaign to Meta to start collecting spend and delivery data."}
                  </p>
                </div>
              ) : (
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                      <YAxis yAxisId="left" tick={{ fontSize: 11 }} />
                      <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Legend />
                      <Line yAxisId="left" type="monotone" dataKey="spend" name="Spend ($)" stroke="#C9A84C" strokeWidth={2} dot={false} />
                      <Line yAxisId="right" type="monotone" dataKey="clicks" name="Clicks" stroke="#2563eb" strokeWidth={2} dot={false} />
                      <Line yAxisId="right" type="monotone" dataKey="leads" name="Leads" stroke="#16a34a" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="leads" className="pt-4">
          <Card>
            <CardContent className="p-0">
              {!campaign.leads || campaign.leads.length === 0 ? (
                <div className="py-12 text-center">
                  <Users className="h-8 w-8 mx-auto text-muted-foreground/50" />
                  <p className="text-sm text-muted-foreground mt-2">
                    No leads attributed to this campaign yet.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="border-b bg-muted/30">
                      <tr className="text-left">
                        <th className="p-3 font-medium">Lead</th>
                        <th className="p-3 font-medium">Stage</th>
                        <th className="p-3 font-medium">Ad</th>
                        <th className="p-3 font-medium">Captured</th>
                      </tr>
                    </thead>
                    <tbody>
                      {campaign.leads.map((lead: any) => (
                        <tr
                          key={lead.id}
                          className="border-b last:border-0 hover:bg-muted/30 cursor-pointer"
                          onClick={() => navigate(`/leads/${lead.id}`)}
                        >
                          <td className="p-3">
                            <p className="font-medium">{lead.firstName} {lead.lastName}</p>
                            <p className="text-xs text-muted-foreground">{lead.email}</p>
                          </td>
                          <td className="p-3">
                            <Badge variant="outline">{STAGE_LABELS[lead.stage] ?? lead.stage}</Badge>
                          </td>
                          <td className="p-3 text-xs text-muted-foreground">
                            {lead.metaAdName || lead.metaAdId || "—"}
                          </td>
                          <td className="p-3 text-xs text-muted-foreground">
                            {new Date(lead.createdAt).toLocaleDateString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="setup" className="pt-4 space-y-4">
          <Card>
            <CardContent className="p-4 space-y-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Landing page</p>
                {campaign.landingPage ? (
                  <div className="flex items-center gap-2 mt-1">
                    <a
                      href={`/lp/${campaign.landingPage.slug}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-sm font-medium text-brand-green hover:underline"
                    >
                      {campaign.landingPage.title}
                    </a>
                    <ExternalLink className="h-3 w-3 text-muted-foreground" />
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground mt-1">
                    None attached — a campaign needs a destination before it can be published.
                  </p>
                )}
              </div>

              <Separator />

              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Nurture sequence
                </p>
                <p className="text-sm mt-1">
                  {campaign.sequence
                    ? campaign.sequence.name
                    : "None — leads from this campaign get no automated follow-up."}
                </p>
              </div>

              <Separator />

              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Ad destination URL
                </p>
                {campaign.destinationUrl ? (
                  <div className="mt-1 flex items-start gap-2">
                    <code className="text-xs bg-muted px-2 py-1.5 rounded flex-1 break-all">
                      {campaign.destinationUrl}
                    </code>
                    <Button
                      size="sm" variant="ghost" className="shrink-0"
                      onClick={() => {
                        navigator.clipboard.writeText(campaign.destinationUrl!);
                        toast.success("Copied");
                      }}
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground mt-1">
                    Attach a landing page and set PUBLIC_BASE_URL to generate this.
                  </p>
                )}
                <p className="text-xs text-muted-foreground mt-1.5">
                  Meta substitutes the <code>{"{{...}}"}</code> macros at delivery, so every lead records
                  the exact ad, ad set and campaign that produced it.
                </p>
              </div>

              {isPublished && (
                <>
                  <Separator />
                  <div className="grid sm:grid-cols-2 gap-3 text-xs">
                    {[
                      ["Meta campaign", campaign.metaCampaignId],
                      ["Ad set", campaign.metaAdSetId],
                      ["Creative", campaign.metaCreativeId],
                      ["Ad", campaign.metaAdId],
                    ].map(([label, value]) => (
                      <div key={label as string}>
                        <p className="text-muted-foreground">{label}</p>
                        <p className="font-mono">{(value as string) ?? "—"}</p>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {!!campaign.creative && (
            <Card>
              <CardContent className="p-4 space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Ad copy</p>
                <p className="text-sm whitespace-pre-wrap">{(campaign.creative as any).primaryText}</p>
                {(campaign.creative as any).headline && (
                  <p className="text-sm font-semibold">{(campaign.creative as any).headline}</p>
                )}
                {(campaign.creative as any).description && (
                  <p className="text-xs text-muted-foreground">{(campaign.creative as any).description}</p>
                )}
              </CardContent>
            </Card>
          )}

          {!!campaign.targeting && (
            <Card>
              <CardContent className="p-4 space-y-1">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
                  <Target className="h-3.5 w-3.5" /> Targeting
                </p>
                <pre className="text-xs bg-muted p-2 rounded overflow-x-auto">
                  {JSON.stringify(campaign.targeting, null, 2)}
                </pre>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* ─── Budget dialog ────────────────────────────────────────────────── */}
      <Dialog open={budgetOpen} onOpenChange={setBudgetOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change daily budget</DialogTitle>
            <DialogDescription>
              {isPublished
                ? "This pushes straight to the live ad set on Meta."
                : "Saved locally until the campaign is published."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label>Daily budget ($)</Label>
            <Input
              type="number" min="1"
              value={dailyBudget}
              onChange={(e) => setDailyBudget(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBudgetOpen(false)}>Cancel</Button>
            <Button
              disabled={!dailyBudget || updateCampaign.isPending}
              onClick={() => updateCampaign.mutate({ id: campaignId, dailyBudget: Number(dailyBudget) })}
            >
              {updateCampaign.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
