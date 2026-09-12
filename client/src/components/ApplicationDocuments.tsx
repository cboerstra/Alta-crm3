import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, CheckCircle2, Download, FileText, ShieldAlert } from "lucide-react";

function humanSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function when(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });
}

/**
 * Documents the borrower uploaded through the website portal, grouped by
 * the slot they filed them under. Downloads go through the CRM server, which
 * checks the session and streams the decrypted file from the website.
 */
export function ApplicationDocuments({ refNumber }: { refNumber: string }) {
  const { data, isLoading, error } = trpc.applications.documents.useQuery({ refNumber });

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Documents from the borrower</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}

        {error && (
          <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <div>{error.message}</div>
          </div>
        )}

        {data && (
          <>
            <div className="mb-3 flex items-start gap-2 rounded-md bg-muted/50 p-2.5 text-xs text-muted-foreground">
              <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>
                Files are checked by type and encrypted, but <strong>not scanned for malware</strong>.
                Open them with an up-to-date PDF reader or image viewer, never in a browser tab.
              </span>
            </div>

            <div className="space-y-4">
              {data.slots.map((slot) => {
                const files = data.documents.filter((d) => d.slot === slot.id);
                const complete = slot.required > 0 && files.length >= slot.required;
                return (
                  <div key={slot.id}>
                    <div className="flex items-center gap-2 text-sm font-medium">
                      {complete ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                      ) : (
                        <FileText className="h-4 w-4 text-muted-foreground" />
                      )}
                      {slot.label}
                      {slot.required > 0 && (
                        <Badge variant="outline" className={`border-0 ${complete ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                          {Math.min(files.length, slot.required)} of {slot.required}
                        </Badge>
                      )}
                    </div>
                    {files.length === 0 ? (
                      <p className="ml-6 mt-1 text-xs text-muted-foreground">Nothing uploaded yet.</p>
                    ) : (
                      <ul className="ml-6 mt-1 divide-y rounded-md border">
                        {files.map((f) => (
                          <li key={f.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                            <div className="min-w-0">
                              <div className="truncate font-medium">{f.filename}</div>
                              <div className="text-xs text-muted-foreground">
                                {humanSize(f.byteSize)} · {when(f.uploadedAt)}
                              </div>
                            </div>
                            {/*
                              A plain link: the browser downloads it and the
                              session cookie goes along. Never rendered inline.
                            */}
                            <a
                              href={`/api/applications/documents/${f.id}`}
                              download={f.filename}
                              className="inline-flex shrink-0 items-center gap-1 rounded-md border px-2.5 py-1.5 text-xs font-medium hover:bg-muted"
                            >
                              <Download className="h-3.5 w-3.5" /> Download
                            </a>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
