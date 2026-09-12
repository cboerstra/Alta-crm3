import { useParams, Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ApplicationDocuments } from "@/components/ApplicationDocuments";
import { AlertCircle, ArrowLeft, Download, FileText } from "lucide-react";

function when(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString("en-US", { dateStyle: "long", timeStyle: "short" });
}

function StatusLine({ label, status, detail }: { label: string; status: string; detail?: string | null }) {
  const tone: Record<string, string> = {
    written: "bg-emerald-100 text-emerald-700",
    sent: "bg-emerald-100 text-emerald-700",
    pending: "bg-amber-100 text-amber-700",
    skipped: "bg-muted text-muted-foreground",
    failed: "bg-red-100 text-red-700",
  };
  return (
    <div className="flex items-start justify-between gap-4 py-2">
      <span className="text-sm text-muted-foreground">{label}</span>
      <div className="text-right">
        <Badge variant="outline" className={`border-0 ${tone[status] ?? ""}`}>{status}</Badge>
        {detail && <div className="mt-1 max-w-xs break-words text-xs text-muted-foreground">{detail}</div>}
      </div>
    </div>
  );
}

export default function ApplicationDetail() {
  const { ref } = useParams<{ ref: string }>();
  const refNumber = (ref ?? "").toUpperCase();
  const { data: app, isLoading, error } = trpc.applications.get.useQuery({ refNumber }, { enabled: refNumber !== "" });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href="/applications" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> All applications
          </Link>
          <h1 className="mt-1 font-mono text-2xl font-bold">{refNumber}</h1>
          {app && (
            <p className="text-sm text-muted-foreground">
              {app.firstName} {app.lastName} · submitted {when(app.createdAt)}
            </p>
          )}
        </div>

        {app && (
          <Button asChild disabled={!app.mismoAvailable}>
            {/*
              A plain link, not a fetch: the browser handles the download and
              the session cookie goes with it. The CRM server checks the
              session, then streams the file from the website.
            */}
            <a href={`/api/applications/${app.refNumber}/mismo`} download={app.mismoFilename ?? undefined}>
              <Download className="mr-2 h-4 w-4" /> Download MISMO XML
            </a>
          </Button>
        )}
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}

      {error && (
        <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <div className="font-medium">{error.data?.code === "NOT_FOUND" ? "No application with that reference number" : "Could not load from the website"}</div>
            {error.data?.code !== "NOT_FOUND" && <div className="mt-1 text-amber-800">{error.message}</div>}
          </div>
        </div>
      )}

      {app && (
        <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
          <div className="space-y-6">
            {app.summary ? (
              app.summary.map((section) => (
                <Card key={section.title}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">{section.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <dl className="divide-y">
                      {section.rows.map((row) => (
                        <div key={row.label} className="grid grid-cols-[minmax(0,40%)_1fr] gap-4 py-2 text-sm">
                          <dt className="text-muted-foreground">{row.label}</dt>
                          <dd className="break-words">{row.value}</dd>
                        </div>
                      ))}
                    </dl>
                  </CardContent>
                </Card>
              ))
            ) : (
              <Card>
                <CardContent className="py-8 text-center text-sm text-muted-foreground">
                  <FileText className="mx-auto mb-3 h-8 w-8 text-muted-foreground/50" />
                  The website could not rebuild the summary for this application (it was submitted under an
                  older form version). The MISMO document, if written, still has the full record.
                </CardContent>
              </Card>
            )}

            <ApplicationDocuments refNumber={app.refNumber} />
          </div>

          <div className="space-y-6">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-base">Delivery</CardTitle></CardHeader>
              <CardContent className="divide-y">
                <StatusLine label="MISMO document" status={app.mismoStatus} detail={app.mismoError ?? app.mismoFilename} />
                <StatusLine label="Sent to CRM" status={app.crmStatus} detail={app.crmStatus === "failed" ? app.crmResponse : null} />
                <StatusLine label="Loan officer email" status={app.emailStatus} detail={app.emailError} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-base">Contact</CardTitle></CardHeader>
              <CardContent className="space-y-1 text-sm">
                <div><a className="text-primary hover:underline" href={`mailto:${app.email}`}>{app.email}</a></div>
                {app.phone && <div><a className="text-primary hover:underline" href={`tel:${app.phone}`}>{app.phone}</a></div>}
                {app.ssnLast4 && <div className="text-muted-foreground">SSN ending {app.ssnLast4}</div>}
              </CardContent>
            </Card>

            {app.mismoSha256 && (
              <p className="break-all px-1 text-xs text-muted-foreground">
                SHA-256 {app.mismoSha256}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
