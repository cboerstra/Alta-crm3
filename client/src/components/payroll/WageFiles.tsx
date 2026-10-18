import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertTriangle, Download, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import {
  buildDwsWageFile, buildSsaW2File, buildUtahW2File, validateInputs,
  type FileCompany, type FileEmployee, type SubmitterInfo,
} from "@shared/efw2";
import type { PayrollOutputs } from "./format";

type AData = PayrollOutputs["annualReports"];
type QData = PayrollOutputs["quarterReports"];

// Submitter/contact details are remembered per company in this browser; SSNs never are.
const contactKey = (companyId: number) => `payroll.submitter.${companyId}`;
function loadSubmitter(companyId: number): SubmitterInfo {
  const empty = { bsoUserId: "", contactName: "", contactPhone: "", contactEmail: "" };
  try {
    return { ...empty, ...JSON.parse(localStorage.getItem(contactKey(companyId)) ?? "{}") };
  } catch {
    return empty;
  }
}
function saveSubmitter(companyId: number, s: SubmitterInfo) {
  try {
    localStorage.setItem(contactKey(companyId), JSON.stringify(s));
  } catch {
    // storage unavailable — the form just won't be prefilled next time
  }
}

function download(text: string, filename: string) {
  const url = URL.createObjectURL(new Blob([text], { type: "text/plain" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const slug = (s: string) => s.replace(/[^A-Za-z0-9]+/g, "_").replace(/^_|_$/g, "");

function toFileCompany(c: AData["companyInfo"]): FileCompany {
  return {
    name: c.name, ein: c.ein, address: c.address, city: c.city, state: c.state, zip: c.zip,
    utahWithholdingAccount: c.utahWithholdingAccount, utahUiAccount: c.utahUiAccount,
  };
}

interface Person { personId: number; firstName: string; lastName: string; ssnLast4: string | null }

/** Full-SSN inputs; each must end in the last four on file. */
function SsnFields({ people, ssns, setSsns }: { people: Person[]; ssns: Record<number, string>; setSsns: (s: Record<number, string>) => void }) {
  return (
    <div className="grid gap-3">
      {people.map((p) => {
        const typed = (ssns[p.personId] ?? "").replace(/\D/g, "");
        const mismatch = typed.length === 9 && p.ssnLast4 && !typed.endsWith(p.ssnLast4);
        return (
          <div key={p.personId}>
            <Label className="mb-1.5 block">{p.firstName} {p.lastName} — full SSN{p.ssnLast4 ? ` (ends ${p.ssnLast4})` : ""}</Label>
            <Input type="password" autoComplete="off" inputMode="numeric" placeholder="123-45-6789"
              value={ssns[p.personId] ?? ""} onChange={(e) => setSsns({ ...ssns, [p.personId]: e.target.value })} />
            {mismatch && <p className="text-xs text-destructive mt-1">Doesn't end in {p.ssnLast4} — check the number.</p>}
          </div>
        );
      })}
    </div>
  );
}

const employeesFrom = (people: Person[], ssns: Record<number, string>): FileEmployee[] =>
  people.map((p) => ({ firstName: p.firstName, lastName: p.lastName, ssn: ssns[p.personId] ?? "" }));

const mismatches = (people: Person[], ssns: Record<number, string>) =>
  people.filter((p) => p.ssnLast4 && !(ssns[p.personId] ?? "").replace(/\D/g, "").endsWith(p.ssnLast4))
    .map((p) => `${p.firstName} ${p.lastName}: SSN doesn't end in ${p.ssnLast4}.`);

function Errors({ errors }: { errors: string[] }) {
  if (!errors.length) return null;
  return (
    <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive space-y-1">
      {errors.map((e) => <p key={e}>{e}</p>)}
    </div>
  );
}

const PrivacyNote = () => (
  <p className="flex gap-2 text-xs text-muted-foreground">
    <ShieldCheck className="h-4 w-4 shrink-0" />
    The file is built in this browser. Full SSNs are not sent to the server or saved anywhere — you'll retype them each time.
  </p>
);

// ─── W-2 files (SSA + Utah TAP) ──────────────────────────────────────────────
export function W2FilesButton({ data }: { data: AData }) {
  const company = data.companyInfo;
  const w2s = data.w2.w2s;
  const [open, setOpen] = useState(false);
  const [ssns, setSsns] = useState<Record<number, string>>({});
  const [submitter, setSubmitter] = useState<SubmitterInfo>(() => loadSubmitter(company.id));
  const [errors, setErrors] = useState<string[]>([]);

  const build = (kind: "ssa" | "utah") => {
    const employees = employeesFrom(w2s, ssns);
    const errs = [...validateInputs(toFileCompany(company), employees, submitter), ...mismatches(w2s, ssns)];
    if (kind === "utah" && !company.utahWithholdingAccount) errs.push("Add the Utah withholding account number to the company first.");
    setErrors(errs);
    if (errs.length) return;
    saveSubmitter(company.id, submitter);
    const input = {
      company: toFileCompany(company),
      year: data.w2.year,
      submitter,
      w2s: w2s.map((w, i) => ({ employee: employees[i], amounts: w })),
    };
    try {
      if (kind === "ssa") download(buildSsaW2File(input), `W2REPORT_${slug(company.name)}_${data.w2.year}.txt`);
      else download(buildUtahW2File(input), `UT_W2_${slug(company.name)}_${data.w2.year}.txt`);
      toast.success("File downloaded");
    } catch (e: any) {
      setErrors([e.message]);
    }
  };

  if (!w2s.length) return null;
  const set = (patch: Partial<SubmitterInfo>) => setSubmitter({ ...submitter, ...patch });

  return (
    <>
      <Button variant="outline" size="sm" className="gap-1" onClick={() => { setOpen(true); setErrors([]); setSsns({}); }}>
        <Download className="h-3.5 w-3.5" /> W-2 upload files
      </Button>
      <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setSsns({}); }}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>W-2 upload files — {company.name} {data.w2.year}</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <Label className="mb-1.5 block">SSA Business Services Online user ID</Label>
                <Input maxLength={8} value={submitter.bsoUserId} onChange={(e) => set({ bsoUserId: e.target.value.toUpperCase() })} />
              </div>
              <div>
                <Label className="mb-1.5 block">Contact name</Label>
                <Input value={submitter.contactName} onChange={(e) => set({ contactName: e.target.value })} />
              </div>
              <div>
                <Label className="mb-1.5 block">Contact phone</Label>
                <Input value={submitter.contactPhone} onChange={(e) => set({ contactPhone: e.target.value })} />
              </div>
              <div className="col-span-2">
                <Label className="mb-1.5 block">Contact email</Label>
                <Input type="email" value={submitter.contactEmail} onChange={(e) => set({ contactEmail: e.target.value })} />
              </div>
            </div>
            <SsnFields people={w2s} ssns={ssns} setSsns={setSsns} />
            <PrivacyNote />
            <Errors errors={errors} />
            <div className="rounded-md bg-muted/40 p-3 text-xs text-muted-foreground space-y-1">
              <p><b>SSA:</b> in Business Services Online, run the file through <b>AccuWage Online</b> first, then use "Submit Wage File".</p>
              <p><b>Utah:</b> in TAP, open the withholding account → "Submit W-2s / 1099s" → upload the Utah file along with the TC-941R totals.</p>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => build("utah")}><Download className="h-4 w-4 mr-1" /> Utah TAP file</Button>
            <Button className="bg-brand-green hover:bg-brand-green-dark text-white" onClick={() => build("ssa")}>
              <Download className="h-4 w-4 mr-1" /> SSA file
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ─── DWS quarterly wage file ─────────────────────────────────────────────────
export function DwsFileButton({ data }: { data: QData }) {
  const company = data.companyInfo;
  const f = data.utahForm3;
  const [open, setOpen] = useState(false);
  const [ssns, setSsns] = useState<Record<number, string>>({});
  const [errors, setErrors] = useState<string[]>([]);

  const build = () => {
    const employees = employeesFrom(f.employees, ssns);
    const errs = [...validateInputs(toFileCompany(company), employees), ...mismatches(f.employees, ssns)];
    if (!company.utahUiAccount) errs.push("Add the DWS UI account number to the company first.");
    setErrors(errs);
    if (errs.length) return;
    try {
      download(
        buildDwsWageFile({
          company: toFileCompany(company), year: f.year, quarter: f.quarter,
          wages: f.employees.map((e, i) => ({ employee: employees[i], wagesCents: e.wages })),
        }),
        `UT_DWS_${slug(company.name)}_${f.year}Q${f.quarter}.txt`,
      );
      toast.success("File downloaded");
    } catch (e: any) {
      setErrors([e.message]);
    }
  };

  if (!f.employees.length) return null;

  return (
    <>
      <Button variant="outline" size="sm" className="gap-1" onClick={() => { setOpen(true); setErrors([]); setSsns({}); }}>
        <Download className="h-3.5 w-3.5" /> DWS wage file
      </Button>
      <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setSsns({}); }}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>DWS wage file — {company.name} Q{f.quarter} {f.year}</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-2">
            <SsnFields people={f.employees} ssns={ssns} setSsns={setSsns} />
            <PrivacyNote />
            <Errors errors={errors} />
            <div className="flex gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <p>
                Built from the parts of DWS's MMREF layout that could be confirmed. Upload it in Employer Online Services and
                check that the wage list it shows matches the Form 3 above before you submit. If DWS rejects it, enter the
                wages by hand — it's one line per person.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button className="bg-brand-green hover:bg-brand-green-dark text-white" onClick={build}>
              <Download className="h-4 w-4 mr-1" /> Download file
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
