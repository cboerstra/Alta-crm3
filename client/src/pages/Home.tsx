import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useLocation } from "wouter";
import {
  Users, Video, Calendar, DollarSign, TrendingUp, UserCheck,
  Target, ArrowRight, Plus, Clock, Activity, Star
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, AreaChart, Area
} from "recharts";

const BRAND_COLORS = ["#2A5B3F", "#C9A84C", "#1F7B47", "#3D9B63", "#E8D48B", "#165E2E", "#8B7332"];

const stageLabels: Record<string, string> = {
  new_lead: "New Lead", registered: "Registered", attended: "Attended",
  no_show: "No Show", consultation_booked: "Consult Booked",
  under_contract: "Under Contract", closed: "Closed",
};

function StatCard({ title, value, icon: Icon, subtitle, color, trend }: {
  title: string; value: string | number; icon: any; subtitle?: string; color?: string; trend?: string;
}) {
  return (
    <Card className="relative overflow-hidden border-0 shadow-sm hover:shadow-md transition-all duration-200 group">
      <div className="absolute top-0 left-0 w-1 h-full rounded-l" style={{ backgroundColor: color || "#2A5B3F" }} />
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{title}</p>
            <p className="text-3xl font-bold mt-2 text-foreground" style={{ fontFamily: "Raleway, sans-serif" }}>{value}</p>
            {subtitle && <p className="text-xs text-muted-foreground mt-1.5">{subtitle}</p>}
            {trend && (
              <p className="text-xs mt-1.5 flex items-center gap-1" style={{ color: color || "#2A5B3F" }}>
                <TrendingUp className="h-3 w-3" /> {trend}
              </p>
            )}
          </div>
          <div className="h-12 w-12 rounded-xl flex items-center justify-center transition-transform group-hover:scale-110" style={{ backgroundColor: `${color || "#2A5B3F"}18` }}>
            <Icon className="h-6 w-6" style={{ color: color || "#2A5B3F" }} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function SectionHeader({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  return (
    <div className="flex items-center justify-between mb-3">
      <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">{title}</h2>
      {action && onAction && (
        <Button variant="ghost" size="sm" className="text-xs gap-1 h-7 text-brand-green hover:text-brand-green-dark" onClick={onAction}>
          {action} <ArrowRight className="h-3 w-3" />
        </Button>
      )}
    </div>
  );
}

export default function Home() {
  const [, setLocation] = useLocation();
  const { data: metrics, isLoading } = trpc.analytics.dashboard.useQuery();
  const { data: revenue } = trpc.deals.revenueMetrics.useQuery();
  const { data: webinars } = trpc.webinars.list.useQuery();

  const stageData = metrics?.leadsByStage?.map((s) => ({
    name: stageLabels[s.stage] || s.stage.replace(/_/g, " "),
    value: Number(s.count),
  })) ?? [];

  const sourceData = metrics?.leadsBySource?.map((s) => ({
    name: s.source || "Direct",
    value: Number(s.count),
  })) ?? [];

  // Upcoming webinars (next 30 days)
  const now = Date.now();
  const upcomingWebinars = webinars
    ?.filter(w => w.scheduledAt.getTime() > now && w.status !== "cancelled")
    .sort((a, b) => a.scheduledAt.getTime() - b.scheduledAt.getTime())
    .slice(0, 3) ?? [];

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
                  <div className="h-8 w-16 bg-muted rounded" />
                  <div className="h-3 w-24 bg-muted rounded" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  const consultationBooked = metrics?.leadsByStage?.find(s => s.stage === "consultation_booked")?.count ?? 0;
  const attendanceRate = metrics?.attendanceRate ?? 0;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ fontFamily: "Raleway, sans-serif" }}>Dashboard</h1>
          <p className="text-muted-foreground text-sm mt-1">Clarke & Associates CRM — Performance Overview</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setLocation("/leads")}>
            <Plus className="h-3.5 w-3.5" /> Add Lead
          </Button>
          <Button size="sm" className="gap-1.5 bg-brand-green hover:bg-brand-green-dark text-white" onClick={() => setLocation("/webinars")}>
            <Video className="h-3.5 w-3.5" /> Schedule Webinar
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Leads"
          value={(metrics?.totalLeads ?? 0).toLocaleString()}
          icon={Users}
          color="#2A5B3F"
          subtitle="All time"
        />
        <StatCard
          title="Attendance Rate"
          value={`${attendanceRate}%`}
          icon={UserCheck}
          color="#1F7B47"
          subtitle="Webinar attendance"
          trend={attendanceRate >= 50 ? "Above average" : undefined}
        />
        <StatCard
          title="Consultations"
          value={Number(consultationBooked).toLocaleString()}
          icon={Calendar}
          color="#C9A84C"
          subtitle="Booked"
        />
        <StatCard
          title="Closed Revenue"
          value={`$${(revenue?.closedRevenue ?? 0).toLocaleString()}`}
          icon={DollarSign}
          color="#3D9B63"
          subtitle={`${metrics?.closedDeals ?? 0} closed deals`}
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Pipeline Bar Chart — wider */}
        <Card className="border-0 shadow-sm lg:col-span-3">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold" style={{ fontFamily: "Raleway, sans-serif" }}>Pipeline Overview</CardTitle>
              <Button variant="ghost" size="sm" className="text-xs gap-1 h-7 text-brand-green" onClick={() => setLocation("/pipeline")}>
                View Pipeline <ArrowRight className="h-3 w-3" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {stageData.length > 0 ? (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={stageData} margin={{ top: 5, right: 10, left: -10, bottom: 55 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-35} textAnchor="end" interval={0} />
                  <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{ borderRadius: "8px", border: "none", boxShadow: "0 4px 12px rgba(0,0,0,0.1)", fontSize: "12px" }}
                    formatter={(v: any) => [v, "Leads"]}
                  />
                  <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                    {stageData.map((_, i) => (
                      <Cell key={i} fill={BRAND_COLORS[i % BRAND_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[260px] flex flex-col items-center justify-center text-muted-foreground gap-3">
                <Activity className="h-10 w-10 text-muted-foreground/30" />
                <p className="text-sm">No pipeline data yet</p>
                <Button variant="outline" size="sm" onClick={() => setLocation("/leads")}>Add your first lead</Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Leads by Source Pie — narrower */}
        <Card className="border-0 shadow-sm lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold" style={{ fontFamily: "Raleway, sans-serif" }}>Leads by Source</CardTitle>
          </CardHeader>
          <CardContent>
            {sourceData.length > 0 ? (
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie
                    data={sourceData}
                    cx="50%" cy="45%"
                    innerRadius={55} outerRadius={90}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {sourceData.map((_, i) => (
                      <Cell key={i} fill={BRAND_COLORS[i % BRAND_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ borderRadius: "8px", border: "none", boxShadow: "0 4px 12px rgba(0,0,0,0.1)", fontSize: "12px" }}
                    formatter={(v: any, name: any) => [v, name]}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[260px] flex flex-col items-center justify-center text-muted-foreground gap-3">
                <Target className="h-10 w-10 text-muted-foreground/30" />
                <p className="text-sm">No source data yet</p>
              </div>
            )}
            {/* Source legend */}
            {sourceData.length > 0 && (
              <div className="mt-2 space-y-1">
                {sourceData.slice(0, 4).map((item, i) => (
                  <div key={i} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5">
                      <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: BRAND_COLORS[i % BRAND_COLORS.length] }} />
                      <span className="text-muted-foreground truncate max-w-[100px]">{item.name}</span>
                    </div>
                    <span className="font-medium">{item.value}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Bottom Row: Recent Leads + Upcoming Webinars */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Leads */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2">
            <SectionHeader title="Recent Leads" action="View All" onAction={() => setLocation("/leads")} />
          </CardHeader>
          <CardContent className="pt-0">
            {metrics?.recentLeads && metrics.recentLeads.length > 0 ? (
              <div className="space-y-1">
                {metrics.recentLeads.slice(0, 6).map((lead) => (
                  <div
                    key={lead.id}
                    className="flex items-center justify-between py-2.5 border-b border-border/40 last:border-0 cursor-pointer hover:bg-muted/30 rounded px-1 transition-colors"
                    onClick={() => setLocation(`/leads/${lead.id}`)}
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full bg-brand-green/10 flex items-center justify-center flex-shrink-0">
                        <span className="text-xs font-bold text-brand-green">
                          {lead.firstName.charAt(0)}{lead.lastName.charAt(0)}
                        </span>
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{lead.firstName} {lead.lastName}</p>
                        <p className="text-xs text-muted-foreground truncate">{lead.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                        {stageLabels[lead.stage] || lead.stage}
                      </Badge>
                      {lead.score !== null && lead.score > 70 && (
                        <Star className="h-3.5 w-3.5 text-brand-gold fill-brand-gold" />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-8 text-center">
                <Users className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">No leads yet</p>
                <Button variant="outline" size="sm" className="mt-3" onClick={() => setLocation("/leads")}>
                  <Plus className="h-3.5 w-3.5 mr-1" /> Add First Lead
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Upcoming Webinars */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2">
            <SectionHeader title="Upcoming Webinars" action="View All" onAction={() => setLocation("/webinars")} />
          </CardHeader>
          <CardContent className="pt-0">
            {upcomingWebinars.length > 0 ? (
              <div className="space-y-3">
                {upcomingWebinars.map((webinar) => {
                  const daysUntil = Math.ceil((webinar.scheduledAt.getTime() - now) / (1000 * 60 * 60 * 24));
                  return (
                    <div
                      key={webinar.id}
                      className="flex items-start gap-3 p-3 rounded-lg border border-border/50 hover:border-brand-green/30 hover:bg-brand-green/5 cursor-pointer transition-all"
                      onClick={() => setLocation(`/webinars/${webinar.id}`)}
                    >
                      <div className="h-10 w-10 rounded-lg bg-brand-green/10 flex flex-col items-center justify-center flex-shrink-0">
                        <span className="text-[10px] font-bold text-brand-green uppercase">
                          {webinar.scheduledAt.toLocaleDateString("en-US", { month: "short" })}
                        </span>
                        <span className="text-sm font-bold text-brand-green leading-none">
                          {webinar.scheduledAt.getDate()}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold truncate" style={{ fontFamily: "Raleway, sans-serif" }}>{webinar.title}</p>
                        <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          <span>{webinar.scheduledAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                          <span>·</span>
                          <span>{webinar.durationMinutes} min</span>
                        </div>
                      </div>
                      <Badge
                        variant="outline"
                        className={`text-[10px] flex-shrink-0 ${daysUntil <= 1 ? "border-red-300 text-red-600" : daysUntil <= 7 ? "border-brand-gold text-brand-gold" : "border-brand-green/30 text-brand-green"}`}
                      >
                        {daysUntil === 0 ? "Today" : daysUntil === 1 ? "Tomorrow" : `${daysUntil}d`}
                      </Badge>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="py-8 text-center">
                <Video className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">No upcoming webinars</p>
                <Button variant="outline" size="sm" className="mt-3" onClick={() => setLocation("/webinars")}>
                  <Plus className="h-3.5 w-3.5 mr-1" /> Schedule Webinar
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
