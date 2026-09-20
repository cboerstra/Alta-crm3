import { useEffect, useState } from "react";
import { useParams, Link, useLocation } from "wouter";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { ApplicationDocuments } from "@/components/ApplicationDocuments";
import { ApplicationEditDialog } from "@/components/ApplicationEditDialog";
import { REVIEW_LABELS, ReviewStatusBadge, type ReviewStatus } from "@/components/ReviewStatus";
import { AlertCircle, ArrowLeft, Download, FileText, RefreshCw, Trash2 } from "lucide-react";

function when(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString("en-US", { dateStyle: "long", timeStyle: "short" });
}

function ReviewCard({
  refNumber,
  reviewStatus,
  staffNotes,
  reviewedAt,
}: {
  refNumber: string;
  reviewStatus: ReviewStatus;
  staffNotes: string | null;
  reviewedAt: string | null;
}) {
  const utils = trpc.useUtils();
  const [notes, setNotes] = useState(staffNotes ?? "");
  useEffect(() => setNotes(staffNotes ?? ""), [staffNotes]);

  const update = trpc.applications.updateReview.useMutation({
    onSuccess: (updated) => {
      utils.applications.get.setData({ refNumber }, updated);
      utils.applications.list.invalidate();
      toast.success("Saved");
    },
    onError: (e) => toast.error(e.message || "Could not save"),
  });

  const notesDirty = notes !== (staffNotes ?? "");

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Review</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="review-status">Status</Label>
          <Select
            value={reviewStatus}
            disabled={update.isPending}
            onValueChange={(v) => update.mutate({ refNumber, reviewStatus: v as ReviewStatus })}
          >
            <SelectTrigger id="review-status"><SelectValue /></SelectTrigger>
            <SelectContent>
              {(Object.keys(REVIEW_LABELS) as ReviewStatus[]).map((s) => (
                <SelectItem key={s} value={s}>{REVIEW_LABELS[s]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="review-notes">Notes</Label>
          <Textarea
            id="review-notes"
            rows={5}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Only visible to CRM users"
          />
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-muted-foreground">
              {reviewedAt ? `Updated ${when(reviewedAt)}` : "Not reviewed yet"}
            </span>
            <Button
              size="sm"
              disabled={!notesDirty || update.isPending}
              onClick={() => update.mutate({ refNumber, staffNotes: notes.trim() === "" ? null : notes })}
            >
              Save notes
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function RegenerateButton({ refNumber }: { refNumber: string }) {
  const utils = trpc.useUtils();
  const regen = trpc.applications.regenerateMismo.useMutation({
    onSuccess: (result) => {
      utils.applications.get.invalidate({ refNumber });
      toast.success(`MISMO document regenerated (${result.mismoFilename})`);
    },
    onError: (e) => toast.error(e.message || "Could not regenerate"),
  });
  return (
    <Button variant="outline" disabled={regen.isPending} onClick={() => regen.mutate({ refNumber })}>
      <RefreshCw className={`mr-2 h-4 w-4${regen.isPending ? " animate-spin" : ""}`} />
      {regen.isPending ? "Regenerating…" : "Regenerate MISMO"}
    </Button>
  );
}

function DeleteButton({ refNumber, applicant }: { refNumber: string; applicant: string }) {
  const [, navigate] = useLocation();
  const utils = trpc.useUtils();
  const del = trpc.applications.delete.useMutation({
    onSuccess: (result) => {
      utils.applications.list.invalidate();
      utils.applications.drafts.invalidate();
      const extras = [
        result.documentsRemoved > 0 ? `${result.documentsRemoved} document${result.documentsRemoved === 1 ? "" : "s"}` : null,
        result.draftsRemoved > 0 ? `${result.draftsRemoved} draft${result.draftsRemoved === 1 ? "" : "s"}` : null,
      ].filter(Boolean);
      toast.success(`Deleted ${result.refNumber}${extras.length ? ` and ${extras.join(", ")}` : ""}`);
      for (const w of result.warnings) toast.warning(w);
      navigate("/applications");
    },
    onError: (e) => toast.error(e.message || "Could not delete"),
  });

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="outline" className="text-destructive hover:bg-destructive/10 hover:text-destructive">
          <Trash2 className="mr-2 h-4 w-4" /> Delete
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete application {refNumber}?</AlertDialogTitle>
          <AlertDialogDescription>
            This permanently removes {applicant}&apos;s application and its MISMO document from the website.
            If it is their only application, their uploaded documents and any unfinished draft are removed too.
            This cannot be undone. The CRM lead, if one was created, is not affected.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            disabled={del.isPending}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            onClick={(e) => {
              e.preventDefault();
              del.mutate({ refNumber });
            }}
          >
            {del.isPending ? "Deleting…" : "Delete permanently"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
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
          <div className="mt-1 flex items-center gap-3">
            <h1 className="font-mono text-2xl font-bold">{refNumber}</h1>
            {app && <ReviewStatusBadge value={app.reviewStatus} />}
          </div>
          {app && (
            <p className="text-sm text-muted-foreground">
              {app.firstName} {app.lastName} · submitted {when(app.createdAt)}
            </p>
          )}
        </div>

        {app && (
          <div className="flex flex-wrap items-center gap-2">
            <DeleteButton refNumber={app.refNumber} applicant={`${app.firstName} ${app.lastName}`} />
            <ApplicationEditDialog refNumber={app.refNumber} editable={app.editable} />
            <RegenerateButton refNumber={app.refNumber} />
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
          </div>
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
            <ReviewCard
              refNumber={app.refNumber}
              reviewStatus={app.reviewStatus}
              staffNotes={app.staffNotes}
              reviewedAt={app.reviewedAt}
            />

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
