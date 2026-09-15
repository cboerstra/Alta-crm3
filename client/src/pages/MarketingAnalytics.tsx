import { trpc } from "@/lib/trpc";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  BarChart3, RefreshCw, Loader2, TrendingUp, DollarSign, Users, Target, Info,
} from "lucide-react";
import { toast } from "sonner";
import { useLocation } from "wouter";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from "recharts";

const money = (n: number | null | undefined) =>
  n == null ? "—" : `$${Number(n).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

const moneyPrecise = (n: number | null | undefined) =>
  n == null ? "—" : `$${Number(n).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;

export default function MarketingAnalytics() {
  const [, navigate] = useLocation();
  const utils = trpc.useUtils();

  const { data: overview, isLoading: overviewLoading } = trpc.marketing.overview.useQuery();
  const { data: performance, isLoading: perfLoading } = trpc.marketing.campaignPerformance.useQuery();
  const { data: channels } = trpc.marketing.attributionBreakdown.useQuery();
  const { data: ads } = trpc.marketing.adBreakdown.useQuery();

  const syncAll = trpc.marketing.syncAllMetrics.useMutation({
    onSuccess: (r) => {
      toast.success(`Synced ${r.campaigns} campaign(s)`);
      utils.marketing.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const funnelData = (performance ?? [])
    .filter((r) => r.leads > 0 || r.spend > 0)
    .slice(0, 10)
    .map((r) => ({
      name: r.campaignName.length > 22 ? `${r.campaignName.slice(0, 22)}…` : r.campaignName,
      leads: r.leads,
      consultations: r.consultations,
      closed: r.closed,
    }));

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <BarChart3 className="h-6 w-6 text-brand-green" /> Marketing analytics
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Ad spend joined to closed loans — what each campaign actually produced.
          </p>
        </div>
        <Button variant="outline" size="sm" disabled={syncAll.isPending} onClick={() => syncAll.mutate()}>
          {syncAll.isPending
            ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
            : <RefreshCw className="h-3.5 w-3.5 mr-1.5" />}
          Sync from Meta
        </Button>
      </div>

      {/* ─── Headline numbers ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          {
            label: "Ad spend",
            value: overviewLoading ? "…" : money(overview?.spend),
            sub: `${overview?.campaignCount ?? 0} campaign${overview?.campaignCount === 1 ? "" : "s"}`,
            icon: DollarSign,
          },
          {
            label: "Leads",
            value: overviewLoading ? "…" : String(overview?.leads ?? 0),
            sub: overview?.costPerLead ? `${moneyPrecise(overview.costPerLead)} per lead` : "—",
            icon: Users,
          },
          {
            label: "Closed loans",
            value: overviewLoading ? "…" : String(overview?.closed ?? 0),
            sub: overview?.costPerClosedLoan ? `${money(overview.costPerClosedLoan)} per closed loan` : "—",
            icon: Target,
          },
          {
            label: "Closed revenue",
            value: overviewLoading ? "…" : money(overview?.closedRevenue),
            sub: overview?.roas ? `${overview.roas.toFixed(2)}× return on spend` : "no spend recorded",
            icon: TrendingUp,
          },
        ].map((stat) => (
          <Card key={stat.label}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{stat.label}</p>
                <stat.icon className="h-4 w-4 text-muted-foreground" />
              </div>
              <p className="text-2xl font-bold mt-1">{stat.value}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{stat.sub}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="campaigns">
        <TabsList>
          <TabsTrigger value="campaigns">By campaign</TabsTrigger>
          <TabsTrigger value="channels">By channel</TabsTrigger>
          <TabsTrigger value="ads">By ad</TabsTrigger>
        </TabsList>

        <TabsContent value="campaigns" className="pt-4 space-y-4">
          {funnelData.length > 0 && (
            <Card>
              <CardContent className="p-4">
                <p className="text-sm font-semibold mb-3">Leads → consultations → closed</p>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={funnelData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} angle={-15} textAnchor="end" height={60} />
                      <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="leads" name="Leads" fill="#94a3b8" radius={[3, 3, 0, 0]} />
                      <Bar dataKey="consultations" name="Consultations" fill="#2563eb" radius={[3, 3, 0, 0]} />
                      <Bar dataKey="closed" name="Closed" fill="#16a34a" radius={[3, 3, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardContent className="p-0">
              {perfLoading ? (
                <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
              ) : !performance || performance.length === 0 ? (
                <div className="py-12 text-center">
                  <BarChart3 className="h-8 w-8 mx-auto text-muted-foreground/50" />
                  <p className="text-sm text-muted-foreground mt-2">
                    Nothing to report yet. Create a campaign and start capturing leads.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="border-b bg-muted/30">
                      <tr className="text-left">
                        <th className="p-3 font-medium">Campaign</th>
                        <th className="p-3 font-medium text-right">Spend</th>
                        <th className="p-3 font-medium text-right">Leads</th>
                        <th className="p-3 font-medium text-right">Cost / lead</th>
                        <th className="p-3 font-medium text-right">Consults</th>
                        <th className="p-3 font-medium text-right">Closed</th>
                        <th className="p-3 font-medium text-right">Cost / loan</th>
                        <th className="p-3 font-medium text-right">Revenue</th>
                        <th className="p-3 font-medium text-right">ROAS</th>
                      </tr>
                    </thead>
                    <tbody>
                      {performance.map((row) => (
                        <tr
                          key={row.campaignId ?? "none"}
                          className={`border-b last:border-0 ${row.campaignId ? "hover:bg-muted/30 cursor-pointer" : "bg-muted/10"}`}
                          onClick={() => row.campaignId && navigate(`/campaigns/${row.campaignId}`)}
                        >
                          <td className="p-3">
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{row.campaignName}</span>
                              {row.status !== "n/a" && (
                                <Badge variant="outline" className="text-[10px]">{row.status}</Badge>
                              )}
                            </div>
                          </td>
                          <td className="p-3 text-right">{money(row.spend)}</td>
                          <td className="p-3 text-right">{row.leads}</td>
                          <td className="p-3 text-right">{row.costPerLead ? moneyPrecise(row.costPerLead) : "—"}</td>
                          <td className="p-3 text-right">{row.consultations}</td>
                          <td className="p-3 text-right font-medium">{row.closed}</td>
                          <td className="p-3 text-right">{row.costPerClosedLoan ? money(row.costPerClosedLoan) : "—"}</td>
                          <td className="p-3 text-right">{money(row.closedRevenue)}</td>
                          <td className="p-3 text-right">
                            {row.roas != null ? (
                              <span className={row.roas >= 1 ? "text-green-700 font-medium" : "text-amber-700"}>
                                {row.roas.toFixed(2)}×
                              </span>
                            ) : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>

          <div className="flex items-start gap-2 text-xs text-muted-foreground">
            <Info className="h-3.5 w-3.5 shrink-0 mt-0.5" />
            <p>
              Spend comes from Meta's insights API and lags a few hours. Leads, consultations and closed
              loans come from this CRM, attributed by the click parameters recorded when the lead first
              landed — so the pairing holds up months after the ad stopped running.
            </p>
          </div>
        </TabsContent>

        <TabsContent value="channels" className="pt-4">
          <Card>
            <CardContent className="p-0">
              {!channels || channels.length === 0 ? (
                <div className="py-12 text-center">
                  <p className="text-sm text-muted-foreground">No attribution data yet.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="border-b bg-muted/30">
                      <tr className="text-left">
                        <th className="p-3 font-medium">Source</th>
                        <th className="p-3 font-medium">Medium</th>
                        <th className="p-3 font-medium text-right">Leads</th>
                        <th className="p-3 font-medium text-right">Closed</th>
                        <th className="p-3 font-medium text-right">Close rate</th>
                        <th className="p-3 font-medium text-right">Revenue</th>
                      </tr>
                    </thead>
                    <tbody>
                      {channels.map((row, i) => (
                        <tr key={`${row.source}-${row.medium}-${i}`} className="border-b last:border-0">
                          <td className="p-3 font-medium">{row.source}</td>
                          <td className="p-3 text-muted-foreground">{row.medium}</td>
                          <td className="p-3 text-right">{row.leads}</td>
                          <td className="p-3 text-right">{row.closed}</td>
                          <td className="p-3 text-right">
                            {row.leads > 0 ? `${((row.closed / row.leads) * 100).toFixed(1)}%` : "—"}
                          </td>
                          <td className="p-3 text-right">{money(row.revenue)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="ads" className="pt-4">
          <Card>
            <CardContent className="p-0">
              {!ads || ads.length === 0 ? (
                <div className="py-12 text-center">
                  <p className="text-sm text-muted-foreground">
                    No ad-level data yet. This fills in once leads arrive from published Meta ads.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="border-b bg-muted/30">
                      <tr className="text-left">
                        <th className="p-3 font-medium">Ad</th>
                        <th className="p-3 font-medium">Ad set</th>
                        <th className="p-3 font-medium">Campaign</th>
                        <th className="p-3 font-medium text-right">Leads</th>
                        <th className="p-3 font-medium text-right">Closed</th>
                        <th className="p-3 font-medium text-right">Revenue</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ads.map((row) => (
                        <tr key={row.metaAdId ?? Math.random()} className="border-b last:border-0">
                          <td className="p-3">
                            <p className="font-medium">{row.metaAdName ?? "Unnamed ad"}</p>
                            <p className="text-xs text-muted-foreground font-mono">{row.metaAdId}</p>
                          </td>
                          <td className="p-3 text-muted-foreground">{row.metaAdsetName ?? "—"}</td>
                          <td className="p-3 text-muted-foreground">{row.metaCampaignName ?? "—"}</td>
                          <td className="p-3 text-right">{row.leads}</td>
                          <td className="p-3 text-right">{row.closed}</td>
                          <td className="p-3 text-right">{money(row.revenue)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
