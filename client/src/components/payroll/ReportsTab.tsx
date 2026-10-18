import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertTriangle, Printer } from "lucide-react";
import { fmtDate, printElement, type PayrollOutputs } from "./format";

/** Amount as typed on a form: 1,234.56 */
const amt = (cents: number) => (cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function Line({ n, label, value, wages, note }: { n: string; label: string; value?: number | string; wages?: number; note?: string }) {
  return (
    <tr className="border-b last:border-0">
      <td className="py-1.5 pr-3 align-top font-mono text-xs text-muted-foreground w-12">{n}</td>
      <td className="py-1.5 pr-3">
        {label}
        {note && <div className="text-xs text-muted-foreground muted">{note}</div>}
      </td>
      <td className="py-1.5 pr-3 text-right tabular-nums num text-muted-foreground w-32">{wages !== undefined ? amt(wages) : ""}</td>
      <td className="py-1.5 text-right tabular-nums num font-medium w-32">{typeof value === "number" ? amt(value) : value}</td>
    </tr>
  );
}

function FormCard({ id, title, subtitle, children }: { id: string; title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base">{title}</CardTitle>
            <p className="text-sm text-muted-foreground">{subtitle}</p>
          </div>
          <Button variant="outline" size="sm" className="gap-1" onClick={() => printElement(id, title)}>
            <Printer className="h-3.5 w-3.5" /> Print
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div id={id}>
          <h2 className="hidden print:block">{title}</h2>
          <p className="hidden print:block">{subtitle}</p>
          {children}
        </div>
      </CardContent>
    </Card>
  );
}

const Tbl = ({ children, head }: { children: React.ReactNode; head?: [string, string] }) => (
  <table className="w-full text-sm">
    {head && (
      <thead>
        <tr className="border-b text-xs text-muted-foreground">
          <th className="text-left py-1 font-normal">Line</th>
          <th className="text-left py-1 font-normal" />
          <th className="text-right py-1 font-normal num">{head[0]}</th>
          <th className="text-right py-1 font-normal num">{head[1]}</th>
        </tr>
      </thead>
    )}
    <tbody>{children}</tbody>
  </table>
);

function YearWarning({ exact, year }: { exact: boolean; year: number }) {
  if (exact) return null;
  return (
    <div className="flex gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
      <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
      There's no tax table for {year} in the app yet, so wage bases and rates come from the nearest year. Update shared/payrollTax.ts before filing.
    </div>
  );
}

export function QuarterlyReports({ companyId, year }: { companyId: number; year: number }) {
  const [quarter, setQuarter] = useState(() => {
    // Default to the quarter most recently ended — the one due next
    const now = new Date();
    const q = Math.floor(now.getMonth() / 3);
    return now.getFullYear() === year ? Math.max(1, q) : 4;
  });
  const { data, isLoading } = trpc.payroll.quarterReports.useQuery({ companyId, year, quarter });

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <span className="text-sm text-muted-foreground">Quarter</span>
        <Select value={String(quarter)} onValueChange={(v) => setQuarter(Number(v))}>
          <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
          <SelectContent>{[1, 2, 3, 4].map((q) => <SelectItem key={q} value={String(q)}>Q{q} {year}</SelectItem>)}</SelectContent>
        </Select>
        {data && <span className="text-sm text-muted-foreground">All three are due {fmtDate(data.form941.dueDate)}</span>}
      </div>
      {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
      {data && (
        <>
          <YearWarning exact={data.exactTaxYear} year={year} />
          <F941 data={data} />
          <UtahWithholding data={data} />
          <Form3 data={data} />
        </>
      )}
    </div>
  );
}

type QData = PayrollOutputs["quarterReports"];
type AData = PayrollOutputs["annualReports"];

function F941({ data }: { data: QData }) {
  const f = data.form941;
  const c = data.companyInfo;
  return (
    <FormCard id="f941" title={`Form 941 — Q${f.quarter} ${f.year}`} subtitle={`${c.name} · EIN ${c.ein || "—"} · File at irs.gov (e-file through a provider) or mail · Due ${fmtDate(f.dueDate)}`}>
      <Tbl head={["Column 1", "Amount"]}>
        <Line n="1" label="Number of employees paid for the pay period including the 12th of the third month" value={String(f.line1)} />
        <Line n="2" label="Wages, tips, and other compensation" value={f.line2} />
        <Line n="3" label="Federal income tax withheld" value={f.line3} />
        <Line n="4" label="No wages subject to social security or Medicare tax" value={f.line4NoSocialSecurityWages ? "☑ Check" : "—"} />
        <Line n="5a" label="Taxable social security wages × 0.124" wages={f.line5a.wages} value={f.line5a.tax} />
        <Line n="5b" label="Taxable social security tips × 0.124" wages={0} value={0} />
        <Line n="5c" label="Taxable Medicare wages & tips × 0.029" wages={f.line5c.wages} value={f.line5c.tax} />
        <Line n="5d" label="Wages subject to Additional Medicare Tax × 0.009" wages={f.line5d.wages} value={f.line5d.tax} />
        <Line n="5e" label="Total social security and Medicare taxes" value={f.line5e} />
        <Line n="6" label="Total taxes before adjustments" value={f.line6} />
        <Line n="7" label="Current quarter's adjustment for fractions of cents" value={f.line7} />
        <Line n="10" label="Total taxes after adjustments" value={f.line10} />
        <Line n="11" label="Qualified small business payroll tax credit / other credits" value={0} />
        <Line n="12" label="Total taxes after adjustments and nonrefundable credits" value={f.line12} />
        <Line n="13" label="Total deposits for this quarter" value={f.line13} note="From deposits recorded with agency 'IRS — Form 941'." />
        <Line n="14" label="Balance due" value={f.line14BalanceDue} />
        <Line n="15" label="Overpayment" value={f.line15Overpayment} />
      </Tbl>
      <h3 className="text-sm font-medium mt-4 mb-1">Part 2 — Line 16 deposit schedule</h3>
      {f.line16.under2500 ? (
        <p className="text-sm">Line 12 is under $2,500: check the first box (no deposit schedule needed, assuming the prior quarter was also under $2,500). You may pay with the return.</p>
      ) : f.line16.schedule === "monthly" ? (
        <Tbl>
          <Line n="16" label="Monthly schedule depositor — Month 1" value={f.line16.months[0]} />
          <Line n="" label="Month 2" value={f.line16.months[1]} />
          <Line n="" label="Month 3" value={f.line16.months[2]} />
          <Line n="" label="Total liability for quarter (must equal line 12)" value={f.line16.total} />
        </Tbl>
      ) : (
        <>
          <p className="text-sm mb-1">Semiweekly depositor: check the third box and attach Schedule B with these daily liabilities.</p>
          <Tbl>
            {f.line16.scheduleB.map((r) => <Line key={r.date} n="B" label={fmtDate(r.date)} value={r.amount} />)}
            <Line n="" label="Total" value={f.line16.total} />
          </Tbl>
        </>
      )}
    </FormCard>
  );
}

function UtahWithholding({ data }: { data: QData }) {
  const u = data.utahWithholding;
  const c = data.companyInfo;
  return (
    <FormCard id="utwh" title={`Utah withholding return — Q${u.quarter} ${u.year}`}
      subtitle={`${c.name} · Utah account ${c.utahWithholdingAccount || "—"} · File in Taxpayer Access Point (tap.utah.gov) · Due ${fmtDate(u.dueDate)}${c.utahFilingFrequency !== "quarterly" ? ` · Note: this company is set to file ${c.utahFilingFrequency}` : ""}`}>
      <Tbl>
        <Line n="" label="Utah wages paid this quarter" value={u.utahWages} />
        <Line n="" label="Utah income tax withheld" value={u.utahWithheld} />
        <Line n="" label="Payments already made for this quarter" value={u.payments} />
        <Line n="" label="Balance due" value={u.balanceDue} />
        {u.overpayment > 0 && <Line n="" label="Overpayment" value={u.overpayment} />}
      </Tbl>
    </FormCard>
  );
}

function Form3({ data }: { data: QData }) {
  const f = data.utahForm3;
  const c = data.companyInfo;
  return (
    <FormCard id="form3" title={`Utah DWS Form 3 — Q${f.quarter} ${f.year}`}
      subtitle={`${c.name} · DWS account ${c.utahUiAccount || "—"} · File at jobs.utah.gov (Employer Online Services) · Due ${fmtDate(f.dueDate)}`}>
      <Tbl>
        <Line n="1" label="Covered workers in pay period including the 12th — Month 1" value={String(f.workersBy12th[0])} />
        <Line n="" label="Month 2" value={String(f.workersBy12th[1])} />
        <Line n="" label="Month 3" value={String(f.workersBy12th[2])} />
        <Line n="2" label="Total wages paid this quarter" value={f.totalWages} />
        <Line n="3" label={`Excess wages (over $${f.wageBase.toLocaleString()} per worker for ${f.year})`} value={f.excessWages} />
        <Line n="4" label="Taxable wages" value={f.taxableWages} />
        <Line n="5" label={`Contribution due at ${(f.rate * 100).toFixed(3)}%`} value={f.contribution} />
        <Line n="" label="Payments already made" value={f.payments} />
        <Line n="" label="Balance due" value={f.balanceDue} />
      </Tbl>
      <h3 className="text-sm font-medium mt-4 mb-1">Wage detail (enter each worker's full SSN on the DWS site)</h3>
      {f.employees.length === 0 ? <p className="text-sm text-muted-foreground">No covered wages this quarter.</p> : (
        <table className="w-full text-sm">
          <thead><tr className="border-b text-xs text-muted-foreground"><th className="text-left py-1 font-normal">Name</th><th className="text-left py-1 font-normal">SSN</th><th className="text-right py-1 font-normal num">Quarter wages</th></tr></thead>
          <tbody>
            {f.employees.map((e) => (
              <tr key={e.name} className="border-b last:border-0">
                <td className="py-1.5">{e.name}</td>
                <td className="py-1.5 font-mono">•••-••-{e.ssnLast4 || "????"}</td>
                <td className="py-1.5 text-right tabular-nums num">{amt(e.wages)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </FormCard>
  );
}

export function AnnualReports({ companyId, year }: { companyId: number; year: number }) {
  const { data, isLoading } = trpc.payroll.annualReports.useQuery({ companyId, year });
  if (isLoading) return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (!data) return null;
  return (
    <div className="space-y-4">
      <YearWarning exact={data.exactTaxYear} year={year} />
      <F940 data={data} />
      <W2s data={data} />
    </div>
  );
}

function F940({ data }: { data: AData }) {
  const f = data.form940;
  const c = data.companyInfo;
  return (
    <FormCard id="f940" title={`Form 940 — ${f.year}`} subtitle={`${c.name} · EIN ${c.ein || "—"} · Utah is a single-state, non-credit-reduction filer (line 1a: UT) · Due ${fmtDate(f.dueDate)}`}>
      <Tbl>
        <Line n="1a" label="State where you paid state unemployment tax" value="UT" />
        <Line n="3" label="Total payments to all employees" value={f.line3} />
        <Line n="4" label="Payments exempt from FUTA tax" value={f.line4} note="Shareholder health premiums (4a fringe benefits) and pay to FUTA-exempt people (4e other)." />
        <Line n="5" label="Total of payments made to each employee in excess of $7,000" value={f.line5} />
        <Line n="6" label="Subtotal (line 4 + line 5)" value={f.line6} />
        <Line n="7" label="Total taxable FUTA wages (line 3 − line 6)" value={f.line7} />
        <Line n="8" label="FUTA tax before adjustments (line 7 × 0.006)" value={f.line8} />
        <Line n="12" label="Total FUTA tax after adjustments" value={f.line12} />
        <Line n="13" label="FUTA tax deposited for the year" value={f.line13} />
        <Line n="14" label="Balance due" value={f.line14BalanceDue} />
        <Line n="15" label="Overpayment" value={f.line15Overpayment} />
      </Tbl>
      <h3 className="text-sm font-medium mt-4 mb-1">Part 5 — quarterly FUTA liability {f.part5Required ? "(required: line 12 is over $500)" : "(not required: line 12 is $500 or less)"}</h3>
      <Tbl>
        {f.quarterlyLiability.map((v, i) => <Line key={i} n={`16${"abcd"[i]}`} label={`Quarter ${i + 1}`} value={v} />)}
      </Tbl>
      <p className="text-xs text-muted-foreground mt-2">FUTA must be deposited by the end of the month after any quarter in which the undeposited amount passes $500.</p>
    </FormCard>
  );
}

function W2s({ data }: { data: AData }) {
  const r = data.w2;
  const c = data.companyInfo;
  return (
    <>
      <FormCard id="w2" title={`W-2s and W-3 — ${r.year}`} subtitle={`${c.name} · EIN ${c.ein || "—"} · File with SSA (Business Services Online) and give copies to employees · Due ${fmtDate(r.dueDate)}`}>
        {r.w2s.length === 0 && <p className="text-sm text-muted-foreground">No wages paid in {r.year}.</p>}
        {r.w2s.map((w) => (
          <div key={w.name} className="mb-4">
            <h3 className="text-sm font-medium mb-1">{w.name} · SSN •••-••-{w.ssnLast4 || "????"}</h3>
            <Tbl>
              <Line n="1" label="Wages, tips, other compensation" value={w.box1} />
              <Line n="2" label="Federal income tax withheld" value={w.box2} />
              <Line n="3" label="Social security wages" value={w.box3} />
              <Line n="4" label="Social security tax withheld" value={w.box4} />
              <Line n="5" label="Medicare wages and tips" value={w.box5} />
              <Line n="6" label="Medicare tax withheld (incl. Additional Medicare)" value={w.box6} />
              {w.box12D > 0 && <Line n="12" label="Code D — 401(k) elective deferrals" value={w.box12D} />}
              {w.box13Retirement && <Line n="13" label="Retirement plan" value="☑" />}
              {w.box14Health > 0 && <Line n="14" label="S-corp 2% shareholder health insurance (included in box 1)" value={w.box14Health} />}
              <Line n="15" label="State / employer's state ID" value={`UT ${c.utahWithholdingAccount || ""}`} />
              <Line n="16" label="State wages" value={w.box16} />
              <Line n="17" label="State income tax" value={w.box17} />
            </Tbl>
          </div>
        ))}
        {r.w2s.length > 0 && (
          <>
            <h3 className="text-sm font-medium mb-1">W-3 totals ({r.w3.count} W-2{r.w3.count === 1 ? "" : "s"})</h3>
            <Tbl>
              <Line n="1" label="Wages, tips, other compensation" value={r.w3.box1} />
              <Line n="2" label="Federal income tax withheld" value={r.w3.box2} />
              <Line n="3" label="Social security wages" value={r.w3.box3} />
              <Line n="4" label="Social security tax withheld" value={r.w3.box4} />
              <Line n="5" label="Medicare wages and tips" value={r.w3.box5} />
              <Line n="6" label="Medicare tax withheld" value={r.w3.box6} />
              <Line n="16" label="State wages" value={r.w3.box16} />
              <Line n="17" label="State income tax" value={r.w3.box17} />
            </Tbl>
          </>
        )}
      </FormCard>
      <FormCard id="tc941r" title={`Utah TC-941R annual reconciliation — ${r.year}`} subtitle={`${c.name} · Utah account ${c.utahWithholdingAccount || "—"} · File in TAP with W-2 data · Due ${fmtDate(r.dueDate)}`}>
        <Tbl>
          <Line n="" label="Number of W-2s" value={String(r.tc941r.w2Count)} />
          <Line n="" label="Total Utah wages" value={r.tc941r.utahWages} />
          <Line n="" label="Total Utah tax withheld (from W-2s)" value={r.tc941r.utahWithheld} />
          <Line n="" label="Total payments made for the year" value={r.tc941r.payments} />
          <Line n="" label="Balance due" value={r.tc941r.balanceDue} />
        </Tbl>
      </FormCard>
    </>
  );
}
