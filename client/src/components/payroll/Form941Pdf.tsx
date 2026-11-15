import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FileDown, Mail } from "lucide-react";
import { toast } from "sonner";
import { build941Packet, FORM_941_MAIL_TO, FORM_941_TEMPLATES, type Form941Signer } from "@shared/form941Pdf";
import { usd, type PayrollOutputs } from "./format";

type QData = PayrollOutputs["quarterReports"];

// The person who signs is remembered per company in this browser
const signerKey = (companyId: number) => `payroll.signer941.${companyId}`;
function loadSigner(companyId: number): Form941Signer {
  const empty: Form941Signer = { name: "", title: "", phone: "", overpayment: "apply" };
  try {
    return { ...empty, ...JSON.parse(localStorage.getItem(signerKey(companyId)) ?? "{}") };
  } catch {
    return empty;
  }
}
function saveSigner(companyId: number, s: Form941Signer) {
  try {
    localStorage.setItem(signerKey(companyId), JSON.stringify(s));
  } catch {
    // storage unavailable — the form just won't be prefilled next time
  }
}

const fetchPdf = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Couldn't load the IRS form (${url})`);
  return new Uint8Array(await res.arrayBuffer());
};

const slug = (s: string) => s.replace(/[^A-Za-z0-9]+/g, "_").replace(/^_|_$/g, "");

export function Form941PdfButton({ data }: { data: QData }) {
  const company = data.companyInfo;
  const f = data.form941;
  const template = FORM_941_TEMPLATES[f.year];
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [signer, setSigner] = useState<Form941Signer>(() => loadSigner(company.id));
  const set = (patch: Partial<Form941Signer>) => setSigner({ ...signer, ...patch });

  if (!template) {
    return (
      <Button variant="outline" size="sm" className="gap-1" disabled title={`The IRS 941 for ${f.year} hasn't been added to the app yet`}>
        <FileDown className="h-3.5 w-3.5" /> 941 PDF
      </Button>
    );
  }

  const problems = [
    !company.ein && "Add the company's EIN first.",
    !company.address && "Add the company's address first.",
    !signer.name.trim() && "Enter the name of the person signing.",
  ].filter(Boolean) as string[];
  const needsScheduleB = !f.line16.under2500 && f.line16.schedule === "semiweekly";
  const mailTo = f.line14BalanceDue > 0 ? FORM_941_MAIL_TO.withPayment : FORM_941_MAIL_TO.withoutPayment;

  const build = async () => {
    if (problems.length) return;
    setBusy(true);
    try {
      saveSigner(company.id, signer);
      const [form941, scheduleB] = await Promise.all([fetchPdf(template.form941), fetchPdf(template.scheduleB)]);
      const bytes = await build941Packet({ form941, scheduleB }, f, company, signer);
      const url = URL.createObjectURL(new Blob([bytes as Uint8Array<ArrayBuffer>],{ type: "application/pdf" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = `Form941_${slug(company.name)}_${f.year}Q${f.quarter}.pdf`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast.success("Form 941 downloaded");
      setOpen(false);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Button variant="outline" size="sm" className="gap-1" onClick={() => setOpen(true)}>
        <FileDown className="h-3.5 w-3.5" /> 941 PDF
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Form 941 PDF — {company.name} Q{f.quarter} {f.year}</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-2">
            <p className="text-sm text-muted-foreground">
              Fills in the official IRS form with the numbers above
              {needsScheduleB ? ", plus Schedule B with each day's liability" : ""}
              {f.line14BalanceDue > 0 ? `, plus the 941-V voucher for the ${usd(f.line14BalanceDue)} balance due` : ""}.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="mb-1.5 block">Signer's name</Label>
                <Input value={signer.name} onChange={(e) => set({ name: e.target.value })} />
              </div>
              <div>
                <Label className="mb-1.5 block">Title</Label>
                <Input placeholder="Managing Member" value={signer.title} onChange={(e) => set({ title: e.target.value })} />
              </div>
              <div className="col-span-2">
                <Label className="mb-1.5 block">Best daytime phone</Label>
                <Input value={signer.phone} onChange={(e) => set({ phone: e.target.value })} />
              </div>
              {f.line15Overpayment > 0 && (
                <div className="col-span-2">
                  <Label className="mb-1.5 block">Overpayment of {usd(f.line15Overpayment)} (line 15)</Label>
                  <Select value={signer.overpayment} onValueChange={(v) => set({ overpayment: v as Form941Signer["overpayment"] })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="apply">Apply to next return</SelectItem>
                      <SelectItem value="refund">Send a refund (by check)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
            {problems.length > 0 && (
              <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive space-y-1">
                {problems.map((p) => <p key={p}>{p}</p>)}
              </div>
            )}
            <div className="rounded-md bg-muted/40 p-3 text-xs text-muted-foreground space-y-2">
              <p>Print it, then <b>sign and date page 2</b> by hand. Check the numbers against the form above before you mail it.</p>
              <div className="flex gap-2">
                <Mail className="h-4 w-4 shrink-0" />
                <div>
                  <p>Mail {f.line14BalanceDue > 0 ? "with your check" : "to"}:</p>
                  {mailTo.map((l) => <p key={l} className="font-medium text-foreground">{l}</p>)}
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button className="bg-brand-green hover:bg-brand-green-dark text-white" disabled={busy || problems.length > 0} onClick={build}>
              <FileDown className="h-4 w-4 mr-1" /> {busy ? "Building…" : "Download PDF"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
