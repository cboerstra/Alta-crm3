import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, AlertTriangle, CheckCircle2, Download } from "lucide-react";
import { toast } from "sonner";
import {
  applyIntegration,
  detectForms,
  type DetectedForm,
  type DetectionResult,
  type MappingDecision,
  type TargetField,
  TARGET_FIELD_LABELS,
} from "@/lib/htmlFormIntegrator";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** URL of the currently-uploaded HTML file (preferred source). */
  htmlUrl: string | null;
  /** If the file hasn't been uploaded yet (new page), read from the pending File. */
  pendingFile: File | null;
  /** Default source tag to suggest. */
  defaultSource?: string;
  /** Called when the user applies the transform. Receives the new HTML blob. */
  onApply: (transformedHtml: Blob, filename: string) => Promise<void> | void;
};

const TARGET_CHOICES: TargetField[] = [
  "firstName",
  "lastName",
  "fullName",
  "email",
  "phone",
  "message",
  "smsConsent",
  "loanType",
  "ignore",
];

export function IntegrateCodeDialog({
  open,
  onOpenChange,
  htmlUrl,
  pendingFile,
  defaultSource,
  onApply,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [sourceHtml, setSourceHtml] = useState<string | null>(null);
  const [detection, setDetection] = useState<DetectionResult | null>(null);
  const [selectedFormIndex, setSelectedFormIndex] = useState(0);
  const [overrides, setOverrides] = useState<Record<string, TargetField>>({});
  const [apiKey, setApiKey] = useState("");
  const [scriptOrigin, setScriptOrigin] = useState("");
  const [source, setSource] = useState(defaultSource ?? "website_form");
  const [loanType, setLoanType] = useState("");
  const [successRedirect, setSuccessRedirect] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  useEffect(() => {
    if (!open) return;
    setLoadError(null);
    setSourceHtml(null);
    setDetection(null);
    setOverrides({});
    setSelectedFormIndex(0);
    setSource(defaultSource ?? "website_form");
    // Seed script origin with the CRM's own origin (current location) so the
    // generated HTML points back to the server that's serving the embed script.
    if (typeof window !== "undefined" && !scriptOrigin) {
      setScriptOrigin(window.location.origin);
    }

    (async () => {
      setLoading(true);
      try {
        let text: string;
        if (pendingFile) {
          text = await pendingFile.text();
        } else if (htmlUrl) {
          const res = await fetch(htmlUrl, { credentials: "include" });
          if (!res.ok) throw new Error(`Failed to load HTML (HTTP ${res.status})`);
          text = await res.text();
        } else {
          throw new Error("No HTML file to integrate. Upload one first.");
        }
        setSourceHtml(text);
        const result = detectForms(text);
        setDetection(result);
      } catch (err: any) {
        setLoadError(err?.message ?? "Failed to load HTML");
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, htmlUrl, pendingFile]);

  const currentForm: DetectedForm | undefined = useMemo(
    () => detection?.forms?.[selectedFormIndex],
    [detection, selectedFormIndex]
  );

  const decision: MappingDecision = useMemo(
    () => ({
      formIndex: selectedFormIndex,
      mapping: overrides,
      apiKey,
      scriptOrigin,
      source,
      loanType: loanType.trim() || undefined,
      successRedirect: successRedirect.trim() || undefined,
      successMessage: successMessage.trim() || undefined,
    }),
    [selectedFormIndex, overrides, apiKey, scriptOrigin, source, loanType, successRedirect, successMessage]
  );

  const canApply = !!apiKey.trim() && !!currentForm;

  async function handleApply() {
    if (!sourceHtml || !detection || !currentForm) return;
    if (!apiKey.trim()) {
      toast.error("API key is required.");
      return;
    }
    setApplying(true);
    try {
      const result = applyIntegration(sourceHtml, detection, decision);
      if (result.warnings.length > 0) {
        result.warnings.forEach((w) => toast.warning(w));
      }
      const blob = new Blob([result.html], { type: "text/html" });
      const filename = `integrated-${Date.now()}.html`;
      await onApply(blob, filename);
      toast.success(`Integration applied. ${result.changes.length} change${result.changes.length === 1 ? "" : "s"}.`);
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to apply integration");
    } finally {
      setApplying(false);
    }
  }

  function handleDownload() {
    if (!sourceHtml || !detection || !currentForm) return;
    if (!apiKey.trim()) {
      toast.error("API key is required.");
      return;
    }
    const result = applyIntegration(sourceHtml, detection, decision);
    const blob = new Blob([result.html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `integrated-${Date.now()}.html`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[92vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Integrate Code into Uploaded HTML</DialogTitle>
          <DialogDescription>
            Detects the form in your uploaded HTML, maps its inputs to CRM fields, and injects the
            embed script. You can correct any mapping the auto-detector got wrong before applying.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 pr-3 -mr-3">
          {loading && (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading HTML...
            </div>
          )}

          {loadError && (
            <div className="flex items-start gap-2 rounded-md bg-destructive/10 text-destructive p-3 text-sm">
              <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
              <div>{loadError}</div>
            </div>
          )}

          {!loading && detection && detection.forms.length === 0 && (
            <div className="flex items-start gap-2 rounded-md bg-muted p-3 text-sm">
              <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
              <div>
                No <code>&lt;form&gt;</code> element was found in the uploaded HTML. The integrator
                needs a form tag to wire up submissions. Add one in your source and re-upload.
              </div>
            </div>
          )}

          {!loading && currentForm && (
            <div className="space-y-5">
              {detection!.forms.length > 1 && (
                <div className="space-y-1.5">
                  <Label className="text-sm font-semibold">Which form to wire</Label>
                  <Select
                    value={String(selectedFormIndex)}
                    onValueChange={(v) => setSelectedFormIndex(Number(v))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {detection!.forms.map((f) => (
                        <SelectItem key={f.index} value={String(f.index)}>
                          Form #{f.index + 1} — {f.inputCount} input{f.inputCount === 1 ? "" : "s"}
                          {f.action ? ` (posts to ${f.action})` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5 col-span-2">
                  <Label className="text-sm font-semibold">Website API Key *</Label>
                  <Input
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="Your WEBSITE_API_KEY"
                    autoComplete="off"
                  />
                  <p className="text-xs text-muted-foreground">
                    Gets baked into the HTML as <code>data-api-key</code>. Visible in the page
                    source — it's a shared key, not a secret.
                  </p>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm font-semibold">Script Origin</Label>
                  <Input
                    value={scriptOrigin}
                    onChange={(e) => setScriptOrigin(e.target.value)}
                    placeholder="https://crm.yourdomain.com"
                  />
                  <p className="text-xs text-muted-foreground">Where <code>alta-form-embed.js</code> is served from.</p>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm font-semibold">Source tag</Label>
                  <Input
                    value={source}
                    onChange={(e) => setSource(e.target.value)}
                    placeholder="webinar_form"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm font-semibold">Loan Type (optional)</Label>
                  <Input
                    value={loanType}
                    onChange={(e) => setLoanType(e.target.value)}
                    placeholder="FHA, DSCR..."
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm font-semibold">Success Redirect (optional)</Label>
                  <Input
                    value={successRedirect}
                    onChange={(e) => setSuccessRedirect(e.target.value)}
                    placeholder="/thanks.html"
                  />
                </div>
                <div className="space-y-1.5 col-span-2">
                  <Label className="text-sm font-semibold">Success Message (optional)</Label>
                  <Input
                    value={successMessage}
                    onChange={(e) => setSuccessMessage(e.target.value)}
                    placeholder="Thanks! Check your email for the webinar link."
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label className="text-sm font-semibold">Detected Inputs</Label>
                  <span className="text-xs text-muted-foreground">
                    {currentForm.inputs.length} found
                  </span>
                </div>
                <div className="border rounded-md divide-y">
                  {currentForm.inputs.length === 0 && (
                    <div className="p-3 text-sm text-muted-foreground">
                      No user-fillable inputs detected in this form.
                    </div>
                  )}
                  {currentForm.inputs.map((inp) => {
                    const override = overrides[inp.id] ?? inp.suggested;
                    const isRecognized = override !== "ignore";
                    return (
                      <div key={inp.id} className="p-3 grid grid-cols-[1fr_220px] gap-3 items-start">
                        <div className="min-w-0">
                          <div className="text-sm font-medium truncate flex items-center gap-2">
                            {isRecognized ? (
                              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                            ) : (
                              <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                            )}
                            <code className="text-xs">{inp.originalName || "(no name)"}</code>
                            <span className="text-[10px] text-muted-foreground">
                              {inp.tag}
                              {inp.type ? `/${inp.type}` : ""}
                            </span>
                          </div>
                          {inp.context && (
                            <div className="text-xs text-muted-foreground truncate mt-0.5">
                              {inp.context}
                            </div>
                          )}
                        </div>
                        <Select
                          value={override}
                          onValueChange={(v) =>
                            setOverrides((prev) => ({ ...prev, [inp.id]: v as TargetField }))
                          }
                        >
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {TARGET_CHOICES.map((t) => (
                              <SelectItem key={t} value={t} className="text-xs">
                                {TARGET_FIELD_LABELS[t]}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    );
                  })}
                </div>
              </div>

              {detection!.hasEmbedScript && (
                <div className="text-xs text-muted-foreground rounded-md bg-muted p-2">
                  Note: this HTML already includes the embed script tag — it will be updated to
                  point at your Script Origin.
                </div>
              )}
            </div>
          )}
        </ScrollArea>

        <DialogFooter className="flex-col-reverse sm:flex-row sm:justify-between gap-2 border-t pt-3">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={applying}>
            Cancel
          </Button>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={handleDownload}
              disabled={!canApply || applying}
              title="Download the transformed HTML without saving to the landing page"
            >
              <Download className="h-4 w-4 mr-1" /> Download
            </Button>
            <Button
              onClick={handleApply}
              disabled={!canApply || applying}
              className="bg-brand-green hover:bg-brand-green-dark text-white"
            >
              {applying ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : null}
              Apply & Save
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
