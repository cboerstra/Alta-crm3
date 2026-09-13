import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";

const COLORS = ["#2A5B3F", "#C9A84C", "#1F7B47", "#8B5CF6", "#3B82F6", "#EF4444"];

export default function Revenue() {
  const { data: metrics, isLoading } = trpc.deals.revenueMetrics.useQuery();
  const { data: deals } = trpc.deals.list.useQuery();

  const stageData = metrics?.dealsByStage?.map((s) => ({
    name: s.stage.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
    value: s.total,
    count: s.count,
  })) ?? [];

  const pieData = deals ? [
    { name: "Won", value: deals.filter((d) => d.stage === "closed_won").length },
    { name: "Active", value: deals.filter((d) => !["closed_won", "closed_lost"].includes(d.stage)).length },
    { name: "Lost", value: deals.filter((d) => d.stage === "closed_lost").length },
  ].filter((d) => d.value > 0) : [];

  const totalDeals = deals?.length ?? 0;
  const wonDeals = deals?.filter((d) => d.stage === "closed_won").length ?? 0;
  const winRate = totalDeals > 0 ? Math.round((wonDeals / totalDeals) * 100) : 0;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold" style={{ fontFamily: "Raleway, sans-serif" }}>Revenue</h1>
          <p className="text-muted-foreground text-sm mt-1">Loading revenue data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold" style={{ fontFamily: "Raleway, sans-serif" }}>Revenue Dashboard</h1>
        <p className="text-muted-foreground text-sm mt-1">Financial overview and deal analytics</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-0 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 left-0 w-1 h-full bg-brand-green" />
          <CardContent className="p-5">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Total Pipeline</p>
            <p className="text-2xl font-bold mt-1" style={{ fontFamily: "Raleway, sans-serif" }}>
              ${(metrics?.totalPipeline ?? 0).toLocaleString()}
            </p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 left-0 w-1 h-full bg-brand-gold" />
          <CardContent className="p-5">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Closed Revenue</p>
            <p className="text-2xl font-bold mt-1" style={{ fontFamily: "Raleway, sans-serif" }}>
              ${(metrics?.closedRevenue ?? 0).toLocaleString()}
            </p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500" />
          <CardContent className="p-5">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Avg Deal Size</p>
            <p className="text-2xl font-bold mt-1" style={{ fontFamily: "Raleway, sans-serif" }}>
              ${(metrics?.avgDealSize ?? 0).toLocaleString()}
            </p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 left-0 w-1 h-full bg-purple-500" />
          <CardContent className="p-5">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Win Rate</p>
            <p className="text-2xl font-bold mt-1" style={{ fontFamily: "Raleway, sans-serif" }}>
              {winRate}%
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base" style={{ fontFamily: "Raleway, sans-serif" }}>Pipeline Value by Stage</CardTitle>
          </CardHeader>
          <CardContent>
            {stageData.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={stageData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={(v: number) => [`$${v.toLocaleString()}`, "Value"]} contentStyle={{ borderRadius: "8px", border: "none", boxShadow: "0 4px 12px rgba(0,0,0,0.1)" }} />
                  <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                    {stageData.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[280px] flex items-center justify-center text-muted-foreground text-sm">
                No deal data yet
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base" style={{ fontFamily: "Raleway, sans-serif" }}>Deal Outcomes</CardTitle>
          </CardHeader>
          <CardContent>
            {pieData.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={3} dataKey="value">
                    {pieData.map((_, i) => (
                      <Cell key={i} fill={["#2A5B3F", "#C9A84C", "#EF4444"][i]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ borderRadius: "8px", border: "none", boxShadow: "0 4px 12px rgba(0,0,0,0.1)" }} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[280px] flex items-center justify-center text-muted-foreground text-sm">
                No deal data yet
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
