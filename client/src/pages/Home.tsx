import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Video, Calendar, DollarSign, TrendingUp, UserCheck, UserX, Target } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";

const COLORS = ["#2A5B3F", "#C9A84C", "#1F7B47", "#3D9B63", "#E8D48B", "#165E2E", "#8B7332"];

function StatCard({ title, value, icon: Icon, subtitle, color }: {
  title: string; value: string | number; icon: any; subtitle?: string; color?: string;
}) {
  return (
    <Card className="relative overflow-hidden border-0 shadow-sm hover:shadow-md transition-shadow">
      <div className="absolute top-0 left-0 w-1 h-full" style={{ backgroundColor: color || "#2A5B3F" }} />
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{title}</p>
            <p className="text-2xl font-bold mt-1 text-foreground" style={{ fontFamily: "Raleway, sans-serif" }}>{value}</p>
            {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
          </div>
          <div className="h-10 w-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${color || "#2A5B3F"}15` }}>
            <Icon className="h-5 w-5" style={{ color: color || "#2A5B3F" }} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function Home() {
  const { data: metrics, isLoading } = trpc.analytics.dashboard.useQuery();
  const { data: revenue } = trpc.deals.revenueMetrics.useQuery();

  const stageData = metrics?.leadsByStage?.map((s) => ({
    name: s.stage.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
    value: Number(s.count),
  })) ?? [];

  const sourceData = metrics?.leadsBySource?.map((s) => ({
    name: s.source || "Direct",
    value: Number(s.count),
  })) ?? [];

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold" style={{ fontFamily: "Raleway, sans-serif" }}>Dashboard</h1>
          <p className="text-muted-foreground text-sm mt-1">Welcome to Clarke & Associates CRM</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="border-0 shadow-sm">
              <CardContent className="p-5">
                <div className="animate-pulse space-y-3">
                  <div className="h-3 w-20 bg-muted rounded" />
                  <div className="h-7 w-16 bg-muted rounded" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold" style={{ fontFamily: "Raleway, sans-serif" }}>Dashboard</h1>
        <p className="text-muted-foreground text-sm mt-1">Overview of your CRM performance</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total Leads" value={metrics?.totalLeads ?? 0} icon={Users} color="#2A5B3F" subtitle="All time" />
        <StatCard title="Attendance Rate" value={`${metrics?.attendanceRate ?? 0}%`} icon={UserCheck} color="#1F7B47" subtitle="Webinar attendance" />
        <StatCard title="Closed Deals" value={metrics?.closedDeals ?? 0} icon={Target} color="#C9A84C" subtitle="Completed" />
        <StatCard title="Revenue" value={`$${(revenue?.closedRevenue ?? 0).toLocaleString()}`} icon={DollarSign} color="#3D9B63" subtitle="Closed won" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold" style={{ fontFamily: "Raleway, sans-serif" }}>Pipeline Overview</CardTitle>
          </CardHeader>
          <CardContent>
            {stageData.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={stageData} margin={{ top: 5, right: 20, left: 0, bottom: 60 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} angle={-35} textAnchor="end" interval={0} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip contentStyle={{ borderRadius: "8px", border: "none", boxShadow: "0 4px 12px rgba(0,0,0,0.1)" }} />
                  <Bar dataKey="value" fill="#2A5B3F" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[280px] flex items-center justify-center text-muted-foreground text-sm">
                No pipeline data yet. Add leads to see the overview.
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold" style={{ fontFamily: "Raleway, sans-serif" }}>Leads by Source</CardTitle>
          </CardHeader>
          <CardContent>
            {sourceData.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie data={sourceData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={3} dataKey="value" label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}>
                    {sourceData.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ borderRadius: "8px", border: "none", boxShadow: "0 4px 12px rgba(0,0,0,0.1)" }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[280px] flex items-center justify-center text-muted-foreground text-sm">
                No source data yet. Capture leads to see distribution.
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Leads */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold" style={{ fontFamily: "Raleway, sans-serif" }}>Recent Leads</CardTitle>
        </CardHeader>
        <CardContent>
          {metrics?.recentLeads && metrics.recentLeads.length > 0 ? (
            <div className="space-y-3">
              {metrics.recentLeads.map((lead) => (
                <div key={lead.id} className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-full bg-brand-green/10 flex items-center justify-center">
                      <span className="text-xs font-semibold text-brand-green">
                        {lead.firstName.charAt(0)}{lead.lastName.charAt(0)}
                      </span>
                    </div>
                    <div>
                      <p className="text-sm font-medium">{lead.firstName} {lead.lastName}</p>
                      <p className="text-xs text-muted-foreground">{lead.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs px-2 py-0.5 rounded-full bg-brand-green/10 text-brand-green font-medium">
                      {lead.stage.replace(/_/g, " ")}
                    </span>
                    {lead.score !== null && lead.score > 0 && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-brand-gold/10 text-brand-gold font-medium">
                        Score: {lead.score}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground py-4 text-center">No leads yet. Create your first lead to get started.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
