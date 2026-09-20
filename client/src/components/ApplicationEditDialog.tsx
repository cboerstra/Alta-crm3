import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Pencil } from "lucide-react";

type Fields = Record<string, unknown>;

// Field definitions mirror the website's application form, step by step.
type Def =
  | { key: string; label: string; kind: "text" | "date" | "email" | "tel" }
  | { key: string; label: string; kind: "money" | "number" }
  | { key: string; label: string; kind: "select"; options: [string, string][] }
  | { key: string; label: string; kind: "bool" };

const SECTIONS: { title: string; fields: Def[] }[] = [
  {
    title: "Loan",
    fields: [
      { key: "loanPurpose", label: "Purpose", kind: "select", options: [["purchase", "Purchase"], ["refinance", "Refinance"], ["home-equity", "Home equity"]] },
      { key: "propertyType", label: "Property type", kind: "select", options: [["single-family", "Single family"], ["condo", "Condo"], ["townhome", "Townhome"], ["multi-family", "Multi-family"], ["manufactured", "Manufactured"]] },
      { key: "propertyUse", label: "Property use", kind: "select", options: [["primary", "Primary residence"], ["secondary", "Second home"], ["investment", "Investment"]] },
      { key: "purchasePrice", label: "Purchase price / value", kind: "money" },
      { key: "loanAmount", label: "Loan amount", kind: "money" },
      { key: "downPayment", label: "Down payment", kind: "money" },
      { key: "currentBalance", label: "Current balance (refi)", kind: "money" },
    ],
  },
  {
    title: "Borrower",
    fields: [
      { key: "firstName", label: "First name", kind: "text" },
      { key: "middleName", label: "Middle name", kind: "text" },
      { key: "lastName", label: "Last name", kind: "text" },
      { key: "suffix", label: "Suffix", kind: "text" },
      { key: "dateOfBirth", label: "Date of birth", kind: "date" },
      { key: "maritalStatus", label: "Marital status", kind: "select", options: [["single", "Single"], ["married", "Married"], ["separated", "Separated"], ["divorced", "Divorced"], ["widowed", "Widowed"]] },
      { key: "phone", label: "Phone", kind: "tel" },
      { key: "email", label: "Email", kind: "email" },
    ],
  },
  {
    title: "Current address",
    fields: [
      { key: "currentAddress.street", label: "Street", kind: "text" },
      { key: "currentAddress.city", label: "City", kind: "text" },
      { key: "currentAddress.state", label: "State", kind: "text" },
      { key: "currentAddress.zip", label: "ZIP", kind: "text" },
      { key: "yearsAtAddress", label: "Years at address", kind: "number" },
      { key: "housingStatus", label: "Housing", kind: "select", options: [["own", "Own"], ["rent", "Rent"], ["other", "Other"]] },
      { key: "monthlyHousingPayment", label: "Monthly housing payment", kind: "money" },
    ],
  },
  {
    title: "Employment & income",
    fields: [
      { key: "employmentStatus", label: "Employment", kind: "select", options: [["employed", "Employed"], ["self-employed", "Self-employed"], ["retired", "Retired"], ["other", "Other"]] },
      { key: "employerName", label: "Employer", kind: "text" },
      { key: "jobTitle", label: "Job title", kind: "text" },
      { key: "yearsAtJob", label: "Years at job", kind: "number" },
      { key: "monthlyIncome", label: "Monthly income", kind: "money" },
    ],
  },
  {
    title: "Debts & credit",
    fields: [
      { key: "monthlyAutoLoan", label: "Auto loan / mo", kind: "money" },
      { key: "monthlyStudentLoan", label: "Student loan / mo", kind: "money" },
      { key: "monthlyCreditCards", label: "Credit cards / mo", kind: "money" },
      { key: "monthlyChildSupport", label: "Child support / mo", kind: "money" },
      { key: "monthlyOtherDebt", label: "Other debt / mo", kind: "money" },
      { key: "creditScoreRange", label: "Credit score", kind: "select", options: [["excellent", "Excellent (740+)"], ["good", "Good (670–739)"], ["fair", "Fair (580–669)"], ["below-fair", "Below 580"], ["not-sure", "Not sure"]] },
    ],
  },
  {
    title: "Declarations",
    fields: [
      { key: "usCitizen", label: "Citizenship", kind: "select", options: [["yes", "U.S. citizen"], ["permanent-resident", "Permanent resident"], ["other", "Other"]] },
      { key: "primaryResidence", label: "Will occupy as primary residence", kind: "bool" },
      { key: "firstTimeBuyer", label: "First-time homebuyer", kind: "bool" },
      { key: "veteran", label: "Veteran / active military", kind: "bool" },
      { key: "downPaymentBorrowed", label: "Down payment is borrowed", kind: "bool" },
      { key: "bankruptcy", label: "Bankruptcy in past 7 years", kind: "bool" },
      { key: "foreclosure", label: "Foreclosure in past 7 years", kind: "bool" },
      { key: "outstandingJudgments", label: "Outstanding judgments", kind: "bool" },
    ],
  },
];

const getPath = (obj: Fields, key: string): unknown =>
  key.split(".").reduce<unknown>((o, k) => (o && typeof o === "object" ? (o as Fields)[k] : undefined), obj);

function setPath(obj: Fields, key: string, value: unknown): void {
  const parts = key.split(".");
  let cur = obj;
  for (const p of parts.slice(0, -1)) {
    if (typeof cur[p] !== "object" || cur[p] === null) cur[p] = {};
    cur = cur[p] as Fields;
  }
  cur[parts[parts.length - 1]] = value;
}

/** String form for the inputs. Numbers and booleans round-trip through parse(). */
const toInput = (v: unknown): string => (v === undefined || v === null ? "" : String(v));

function parse(def: Def, raw: string | boolean): unknown {
  if (def.kind === "bool") return Boolean(raw);
  const s = String(raw).trim();
  if (def.kind === "money" || def.kind === "number") {
    if (s === "") return undefined;
    const n = Number(s.replace(/[$,]/g, ""));
    return Number.isFinite(n) ? n : undefined;
  }
  return s;
}

export function ApplicationEditDialog({ refNumber, editable }: { refNumber: string; editable: Fields | null }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Record<string, string | boolean>>({});
  const utils = trpc.useUtils();

  const initial = useMemo(() => {
    const out: Record<string, string | boolean> = {};
    if (!editable) return out;
    for (const s of SECTIONS) for (const f of s.fields) {
      const v = getPath(editable, f.key);
      out[f.key] = f.kind === "bool" ? Boolean(v) : toInput(v);
    }
    return out;
  }, [editable]);

  useEffect(() => { if (open) setDraft(initial); }, [open, initial]);

  const save = trpc.applications.updateData.useMutation({
    onSuccess: (result) => {
      utils.applications.get.invalidate({ refNumber });
      utils.applications.list.invalidate();
      toast.success(`Saved ${result.fields.length} field${result.fields.length === 1 ? "" : "s"}`);
      if (result.mismo.status === "written") toast.success("MISMO document regenerated");
      else toast.warning(`Saved, but the MISMO document could not be regenerated: ${result.mismo.error ?? "unknown error"}`);
      setOpen(false);
    },
    onError: (e) => toast.error(e.message || "Could not save"),
  });

  const changed = useMemo(() => {
    const edit: Fields = {};
    for (const s of SECTIONS) for (const f of s.fields) {
      if (draft[f.key] === initial[f.key]) continue;
      const v = parse(f, draft[f.key]);
      if (v === undefined && f.kind !== "bool") continue;
      setPath(edit, f.key, v);
    }
    return edit;
  }, [draft, initial]);
  const changedCount = Object.keys(changed).length;

  if (!editable) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline"><Pencil className="mr-2 h-4 w-4" /> Edit</Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit application {refNumber}</DialogTitle>
          <DialogDescription>
            Corrections to what the borrower entered. The website re-checks the whole application and
            regenerates the MISMO document on save. The borrower&apos;s consent and e-signature cannot be changed.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-2">
          {SECTIONS.map((section) => (
            <fieldset key={section.title} className="space-y-3">
              <legend className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">{section.title}</legend>
              <div className="grid gap-3 sm:grid-cols-2">
                {section.fields.map((f) => {
                  const id = `edit-${f.key.replace(/\./g, "-")}`;
                  const value = draft[f.key];
                  if (f.kind === "bool") {
                    return (
                      <label key={f.key} htmlFor={id} className="flex items-center gap-2 text-sm sm:col-span-2">
                        <Checkbox id={id} checked={Boolean(value)} onCheckedChange={(c) => setDraft((d) => ({ ...d, [f.key]: c === true }))} />
                        {f.label}
                      </label>
                    );
                  }
                  if (f.kind === "select") {
                    return (
                      <div key={f.key} className="space-y-1">
                        <Label htmlFor={id}>{f.label}</Label>
                        <Select value={String(value ?? "")} onValueChange={(v) => setDraft((d) => ({ ...d, [f.key]: v }))}>
                          <SelectTrigger id={id}><SelectValue placeholder="—" /></SelectTrigger>
                          <SelectContent>
                            {f.options.map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                    );
                  }
                  const type = f.kind === "money" || f.kind === "number" ? "number" : f.kind;
                  return (
                    <div key={f.key} className="space-y-1">
                      <Label htmlFor={id}>{f.label}</Label>
                      <Input
                        id={id}
                        type={type}
                        inputMode={type === "number" ? "decimal" : undefined}
                        step={f.kind === "money" ? "0.01" : f.kind === "number" ? "0.1" : undefined}
                        value={String(value ?? "")}
                        onChange={(e) => setDraft((d) => ({ ...d, [f.key]: e.target.value }))}
                      />
                    </div>
                  );
                })}
              </div>
            </fieldset>
          ))}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <span className="mr-auto self-center text-sm text-muted-foreground">
            {changedCount === 0 ? "No changes" : `${changedCount} field${changedCount === 1 ? "" : "s"} changed`}
          </span>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button disabled={changedCount === 0 || save.isPending} onClick={() => save.mutate({ refNumber, edit: changed })}>
            {save.isPending ? "Saving…" : "Save changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
