import { useEffect, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Info } from "lucide-react";
import CompaniesTab from "@/components/payroll/CompaniesTab";
import PaychecksTab from "@/components/payroll/PaychecksTab";
import DepositsTab from "@/components/payroll/DepositsTab";
import { AnnualReports, QuarterlyReports } from "@/components/payroll/ReportsTab";
import { fmtDate, usd } from "@/components/payroll/format";

const thisYear = new Date().getFullYear();
const YEARS = [thisYear + 1, thisYear, thisYear - 1, thisYear - 2];

function Overview({ year }: { year: number }) {
  const { data, isLoading } = trpc.payroll.overview.useQuery({ year });
  if (isLoading) return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (!data || data.rows.length === 0) {
    return <Card><CardContent className="py-10 text-center text-muted-foreground">Add a company on the Companies tab to get started.</CardContent></Card>;
  }

  const today = new Date();
  const upcoming = data.calendar
    .filter((r) => new Date(r.due) >= new Date(today.getFullYear(), today.getMonth(), today.getDate()))
    .slice(0, 6);

  return (
    <div className="space-y-4">
      {!data.exactTaxYear && (
        <p className="text-sm text-amber-700">No tax table for {year} yet — amounts use the nearest year's rates.</p>
      )}
      {upcoming.length > 0 && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Next filings (each company)</CardTitle></CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {upcoming.map((r) => (
              <Badge key={r.form + r.period} variant="outline" className="py-1">{r.form} · {r.period} · due {fmtDate(r.due)}</Badge>
            ))}
          </CardContent>
        </Card>
      )}
      {data.rows.map(({ company, quarters, peopleCount }) => (
        <Card key={company.id}>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{company.name} <span className="text-sm font-normal text-muted-foreground">· {peopleCount} on payroll</span></CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-xs text-muted-foreground">
                  <th className="text-left py-1 font-normal">Quarter</th>
                  <th className="text-right py-1 font-normal">Wages</th>
                  <th className="text-right py-1 font-normal">IRS 941 owed / paid</th>
                  <th className="text-right py-1 font-normal">Utah w/h owed / paid</th>
                  <th className="text-right py-1 font-normal">Utah UI owed / paid</th>
                  <th className="text-right py-1 font-normal">Due</th>
                </tr>
              </thead>
              <tbody>
                {quarters.map((q) => {
                  const short = q.irsOwed > q.irsPaid || q.utahOwed > q.utahPaid || q.uiOwed > q.uiPaid;
                  return (
                    <tr key={q.quarter} className="border-b last:border-0">
                      <td className="py-1.5">Q{q.quarter} <span className="text-xs text-muted-foreground">({q.paycheckCount} checks)</span></td>
                      <td className="py-1.5 text-right tabular-nums">{usd(q.wages)}</td>
                      <td className="py-1.5 text-right tabular-nums">{usd(q.irsOwed)} / {usd(q.irsPaid)}</td>
                      <td className="py-1.5 text-right tabular-nums">{usd(q.utahOwed)} / {usd(q.utahPaid)}</td>
                      <td className="py-1.5 text-right tabular-nums">{usd(q.uiOwed)} / {usd(q.uiPaid)}</td>
                      <td className={`py-1.5 text-right ${short ? "text-amber-700 font-medium" : ""}`}>{fmtDate(q.dueDate)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export default function Payroll() {
  const [year, setYear] = useState(thisYear);
  const [tab, setTab] = useState("overview");
  const { data: companies = [] } = trpc.payroll.listCompanies.useQuery();
  const [companyId, setCompanyId] = useState<number | null>(null);

  useEffect(() => {
    if (companies.length && !companies.some((c) => c.id === companyId)) setCompanyId(companies[0].id);
  }, [companies, companyId]);

  const needsCompany = ["paychecks", "deposits", "quarterly", "annual"].includes(tab);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold" style={{ fontFamily: "Raleway, sans-serif" }}>Payroll</h1>
          <p className="text-muted-foreground text-sm mt-1">Owner payroll and quarterly filings for your Utah companies</p>
        </div>
        <div className="flex gap-2">
          {needsCompany && companies.length > 0 && (
            <Select value={companyId ? String(companyId) : ""} onValueChange={(v) => setCompanyId(Number(v))}>
              <SelectTrigger className="w-56"><SelectValue placeholder="Company" /></SelectTrigger>
              <SelectContent>{companies.map((c) => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}</SelectContent>
            </Select>
          )}
          <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
            <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
            <SelectContent>{YEARS.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="companies">Companies</TabsTrigger>
          <TabsTrigger value="paychecks">Paychecks</TabsTrigger>
          <TabsTrigger value="deposits">Tax deposits</TabsTrigger>
          <TabsTrigger value="quarterly">Quarterly reports</TabsTrigger>
          <TabsTrigger value="annual">Year-end</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4"><Overview year={year} /></TabsContent>
        <TabsContent value="companies" className="mt-4"><CompaniesTab year={year} /></TabsContent>
        {companyId && (
          <>
            <TabsContent value="paychecks" className="mt-4"><PaychecksTab companyId={companyId} year={year} /></TabsContent>
            <TabsContent value="deposits" className="mt-4"><DepositsTab companyId={companyId} year={year} /></TabsContent>
            <TabsContent value="quarterly" className="mt-4"><QuarterlyReports companyId={companyId} year={year} /></TabsContent>
            <TabsContent value="annual" className="mt-4"><AnnualReports companyId={companyId} year={year} /></TabsContent>
          </>
        )}
        {needsCompany && !companyId && (
          <p className="text-sm text-muted-foreground mt-4">Add a company first.</p>
        )}
      </Tabs>

      <div className="flex gap-2 rounded-md border bg-muted/30 p-3 text-xs text-muted-foreground">
        <Info className="h-4 w-4 shrink-0" />
        <p>
          This tool prepares the numbers; it doesn't file returns or move money. Enter them on the IRS, Utah TAP and DWS sites
          (or give them to your CPA). Tax tables cover 2025–2026 (federal Pub 15-T, Utah Pub 14 at 4.45% for 2026) and must be
          updated each January.
        </p>
      </div>
    </div>
  );
}
