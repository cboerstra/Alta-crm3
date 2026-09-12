import { useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, ChevronLeft, ChevronRight, FileText, Search } from "lucide-react";

const STEP_LABELS = [
  "Loan information",
  "Personal information",
  "Employment & income",
  "Assets & liabilities",
  "Declarations",
  "Review & submit",
];

function money(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "—";
  return `$${value.toLocaleString("en-US")}`;
}

function when(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });
}

const purposeLabel: Record<string, string> = {
  purchase: "Purchase",
  refinance: "Refinance",
  "home-equity": "Home Equity",
};

function StatusBadge({ value }: { value: string }) {
  const tone: Record<string, string> = {
    written: "bg-emerald-100 text-emerald-700",
    sent: "bg-emerald-100 text-emerald-700",
    pending: "bg-amber-100 text-amber-700",
    skipped: "bg-muted text-muted-foreground",
    failed: "bg-red-100 text-red-700",
  };
  return <Badge variant="outline" className={`border-0 ${tone[value] ?? ""}`}>{value}</Badge>;
}

/**
 * The website answers with a specific status when it cannot serve data. Show
 * the reason, not a generic error, so whoever is looking knows whether to
 * check the website's configuration or the CRM's.
 */
function UpstreamProblem({ message }: { message: string }) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
      <div>
        <div className="font-medium">Could not load from the website</div>
        <div className="mt-1 text-amber-800">{message}</div>
      </div>
    </div>
  );
}

function NotConnected() {
  return (
    <Card>
      <CardContent className="py-12 text-center">
        <FileText className="mx-auto h-10 w-10 text-muted-foreground/50" />
        <h2 className="mt-4 text-lg font-semibold">Website not connected</h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
          Applications are read from altamortgagegroup.net. Set{" "}
          <code className="rounded bg-muted px-1">WEBSITE_STAFF_API_URL</code> and{" "}
          <code className="rounded bg-muted px-1">WEBSITE_STAFF_API_KEY</code> in the CRM&apos;s environment and
          restart it.
        </p>
      </CardContent>
    </Card>
  );
}

function Pager({ page, total, pageSize, onPage }: { page: number; total: number; pageSize: number; onPage: (p: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  return (
    <div className="flex items-center justify-between border-t px-4 py-3 text-sm text-muted-foreground">
      <span>
        {total === 0 ? "No results" : `Page ${page} of ${pages} · ${total} total`}
      </span>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => onPage(page - 1)}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Button variant="outline" size="sm" disabled={page >= pages} onClick={() => onPage(page + 1)}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

function SubmittedTab() {
  const [, navigate] = useLocation();
  const [search, setSearch] = useState("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);

  const { data, isLoading, error } = trpc.applications.list.useQuery({ q: q || undefined, page });

  return (
    <>
      <form
        className="mb-4 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          setPage(1);
          setQ(search.trim());
        }}
      >
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Reference number or email"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Button type="submit" variant="outline">Search</Button>
      </form>

      {error && <UpstreamProblem message={error.message} />}

      {!error && (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/30">
                    {["Reference", "Applicant", "Purpose", "Loan amount", "Submitted", "MISMO", "CRM", "Email"].map((h) => (
                      <th key={h} className="p-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {isLoading && (
                    <tr><td colSpan={8} className="p-6 text-center text-muted-foreground">Loading…</td></tr>
                  )}
                  {!isLoading && data?.items.length === 0 && (
                    <tr><td colSpan={8} className="p-6 text-center text-muted-foreground">No applications yet.</td></tr>
                  )}
                  {data?.items.map((a) => (
                    <tr
                      key={a.refNumber}
                      className="cursor-pointer border-b hover:bg-muted/30"
                      onClick={() => navigate(`/applications/${a.refNumber}`)}
                    >
                      <td className="p-3 font-mono font-medium">{a.refNumber}</td>
                      <td className="p-3">
                        <div className="font-medium">{a.firstName} {a.lastName}</div>
                        <div className="text-xs text-muted-foreground">{a.email}</div>
                      </td>
                      <td className="p-3">{purposeLabel[a.loanPurpose] ?? a.loanPurpose}</td>
                      <td className="p-3">{money(a.loanAmount)}</td>
                      <td className="p-3 whitespace-nowrap">{when(a.createdAt)}</td>
                      <td className="p-3"><StatusBadge value={a.mismoStatus} /></td>
                      <td className="p-3"><StatusBadge value={a.crmStatus} /></td>
                      <td className="p-3"><StatusBadge value={a.emailStatus} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {data && <Pager page={data.page} total={data.total} pageSize={data.pageSize} onPage={setPage} />}
          </CardContent>
        </Card>
      )}
    </>
  );
}

function DraftsTab() {
  const [page, setPage] = useState(1);
  const { data, isLoading, error } = trpc.applications.drafts.useQuery({ page });

  return (
    <>
      <p className="mb-4 text-sm text-muted-foreground">
        Applicants who entered their name and email but have not submitted. The website reminds them
        by email at 1 hour, 24 hours and 7 days after their last edit, and deletes the draft after 30 days.
      </p>

      {error && <UpstreamProblem message={error.message} />}

      {!error && (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/30">
                    {["Applicant", "Reached", "Last activity", "Reminders", "Status"].map((h) => (
                      <th key={h} className="p-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {isLoading && (
                    <tr><td colSpan={5} className="p-6 text-center text-muted-foreground">Loading…</td></tr>
                  )}
                  {!isLoading && data?.items.length === 0 && (
                    <tr><td colSpan={5} className="p-6 text-center text-muted-foreground">No drafts in progress.</td></tr>
                  )}
                  {data?.items.map((d) => (
                    <tr key={d.id} className="border-b">
                      <td className="p-3">
                        <div className="font-medium">
                          {[d.firstName, d.lastName].filter(Boolean).join(" ") || <span className="text-muted-foreground">Name not entered</span>}
                        </div>
                        <div className="text-xs text-muted-foreground">{d.email}</div>
                      </td>
                      <td className="p-3">
                        Step {Math.min(d.furthestStep + 1, STEP_LABELS.length)} of {STEP_LABELS.length}
                        <div className="text-xs text-muted-foreground">{STEP_LABELS[Math.min(d.furthestStep, STEP_LABELS.length - 1)]}</div>
                      </td>
                      <td className="p-3 whitespace-nowrap">{when(d.lastActivityAt)}</td>
                      <td className="p-3">
                        {d.remindersSent} of 3
                        {d.lastReminderAt && <div className="text-xs text-muted-foreground">last {when(d.lastReminderAt)}</div>}
                      </td>
                      <td className="p-3">
                        {d.submittedRef ? (
                          <Badge variant="outline" className="border-0 bg-emerald-100 text-emerald-700">Submitted {d.submittedRef}</Badge>
                        ) : d.optedOut ? (
                          <Badge variant="outline" className="border-0 bg-muted text-muted-foreground">Opted out</Badge>
                        ) : (
                          <Badge variant="outline" className="border-0 bg-amber-100 text-amber-700">In progress</Badge>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {data && <Pager page={data.page} total={data.total} pageSize={50} onPage={setPage} />}
          </CardContent>
        </Card>
      )}
    </>
  );
}

export default function Applications() {
  const { data: status, isLoading } = trpc.applications.status.useQuery();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Applications</h1>
        <p className="text-sm text-muted-foreground">Mortgage applications submitted on altamortgagegroup.net</p>
      </div>

      {isLoading ? null : !status?.configured ? (
        <NotConnected />
      ) : (
        <Tabs defaultValue="submitted">
          <TabsList>
            <TabsTrigger value="submitted">Submitted</TabsTrigger>
            <TabsTrigger value="drafts">In progress</TabsTrigger>
          </TabsList>
          <TabsContent value="submitted" className="mt-4"><SubmittedTab /></TabsContent>
          <TabsContent value="drafts" className="mt-4"><DraftsTab /></TabsContent>
        </Tabs>
      )}
    </div>
  );
}
