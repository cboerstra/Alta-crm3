import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertTriangle, Building2, Pencil, Plus, Trash2, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { CLASSIFICATION_LABELS, FILING_STATUS_LABELS, type PayrollOutputs } from "./format";

type Company = PayrollOutputs["listCompanies"][number];
type Person = PayrollOutputs["listPeople"][number];

const emptyCompany = {
  name: "", ein: "", taxClassification: "s_corp" as Company["taxClassification"],
  address: "", city: "", state: "UT", zip: "",
  utahWithholdingAccount: "", utahUiAccount: "", utahUiRate: "1.2",
  depositSchedule: "monthly" as Company["depositSchedule"],
  utahFilingFrequency: "quarterly" as Company["utahFilingFrequency"],
  payFrequency: "monthly" as Company["payFrequency"],
  isActive: true, notes: "",
};

const emptyPerson = {
  firstName: "", lastName: "", ssnLast4: "", relationship: "owner" as Person["relationship"],
  filingStatus: "married_joint" as Person["filingStatus"], multipleJobs: false,
  dependentsCredit: "0", otherIncome: "0", deductions: "0", extraWithholding: "0",
  futaExempt: false, utahUiExempt: false, isActive: true,
};

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <Label className="mb-1.5 block">{label}</Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground mt-1">{hint}</p>}
    </div>
  );
}

/** Owners of an LLC that isn't taxed as a corporation can't be W-2 employees of it. */
function ownerWarning(company: Company, people: Person[]) {
  const corp = company.taxClassification === "s_corp" || company.taxClassification === "c_corp";
  if (corp || !people.some((p) => p.relationship === "owner")) return null;
  return company.taxClassification === "disregarded"
    ? "A single-member LLC that hasn't elected S-corp status can't pay its owner W-2 wages — the owner pays self-employment tax instead. Only a spouse or other employee belongs on payroll here. If you filed Form 2553, change the tax classification to S-corp."
    : "Partners in a multi-member LLC can't be W-2 employees of it — they receive guaranteed payments instead. If the LLC elected S-corp status, change the tax classification.";
}

function CompanyCard({ company, year, onEdit }: { company: Company; year: number; onEdit: () => void }) {
  const utils = trpc.useUtils();
  const { data: people = [] } = trpc.payroll.listPeople.useQuery({ companyId: company.id });
  const [personDialog, setPersonDialog] = useState<{ id?: number; form: typeof emptyPerson } | null>(null);

  const createPerson = trpc.payroll.createPerson.useMutation();
  const updatePerson = trpc.payroll.updatePerson.useMutation();
  const deletePerson = trpc.payroll.deletePerson.useMutation({
    onSuccess: () => { toast.success("Removed"); utils.payroll.invalidate(); },
    onError: (e) => toast.error(e.message),
  });

  const savePerson = async () => {
    if (!personDialog) return;
    const f = personDialog.form;
    const data = {
      ...f,
      dependentsCredit: Number(f.dependentsCredit) || 0,
      otherIncome: Number(f.otherIncome) || 0,
      deductions: Number(f.deductions) || 0,
      extraWithholding: Number(f.extraWithholding) || 0,
    };
    try {
      if (personDialog.id) await updatePerson.mutateAsync({ id: personDialog.id, ...data, recomputeYear: year });
      else await createPerson.mutateAsync({ companyId: company.id, ...data });
      toast.success("Saved");
      setPersonDialog(null);
      utils.payroll.invalidate();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const warning = ownerWarning(company, people);
  const setP = (patch: Partial<typeof emptyPerson>) => personDialog && setPersonDialog({ ...personDialog, form: { ...personDialog.form, ...patch } });

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Building2 className="h-5 w-5 text-brand-green" /> {company.name}
              {!company.isActive && <Badge variant="outline">Inactive</Badge>}
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              {CLASSIFICATION_LABELS[company.taxClassification]} · EIN {company.ein || "—"} · UI rate {Number(company.utahUiRate)}% · Paid {company.payFrequency} · {company.depositSchedule} depositor
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={onEdit} className="gap-1"><Pencil className="h-3.5 w-3.5" /> Edit</Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {warning && (
          <div className="flex gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" /> {warning}
          </div>
        )}
        <div className="divide-y rounded-md border">
          {people.length === 0 && <p className="p-3 text-sm text-muted-foreground">No one on payroll yet.</p>}
          {people.map((p) => (
            <div key={p.id} className="flex items-center justify-between p-3 text-sm">
              <div>
                <span className="font-medium">{p.firstName} {p.lastName}</span>
                <span className="text-muted-foreground"> · {p.relationship} · SSN •••{p.ssnLast4 || "—"} · {FILING_STATUS_LABELS[p.filingStatus]}</span>
                {p.futaExempt && <Badge variant="outline" className="ml-2">FUTA exempt</Badge>}
                {p.utahUiExempt && <Badge variant="outline" className="ml-1">UI exempt</Badge>}
              </div>
              <div className="flex gap-1">
                <Button variant="ghost" size="sm" onClick={() => setPersonDialog({
                  id: p.id,
                  form: {
                    ...emptyPerson, ...p, ssnLast4: p.ssnLast4 ?? "",
                    dependentsCredit: String(Number(p.dependentsCredit)), otherIncome: String(Number(p.otherIncome)),
                    deductions: String(Number(p.deductions)), extraWithholding: String(Number(p.extraWithholding)),
                  },
                })}><Pencil className="h-3.5 w-3.5" /></Button>
                <Button variant="ghost" size="sm" onClick={() => {
                  if (confirm(`Remove ${p.firstName} and all of their paychecks?`)) deletePerson.mutate({ id: p.id });
                }}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
              </div>
            </div>
          ))}
        </div>
        <Button variant="outline" size="sm" className="gap-1" onClick={() => setPersonDialog({ form: { ...emptyPerson } })}>
          <UserPlus className="h-3.5 w-3.5" /> Add person
        </Button>
      </CardContent>

      <Dialog open={!!personDialog} onOpenChange={(o) => !o && setPersonDialog(null)}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{personDialog?.id ? "Edit person" : "Add person"} — {company.name}</DialogTitle></DialogHeader>
          {personDialog && (
            <div className="grid gap-4 py-2">
              <div className="grid grid-cols-2 gap-3">
                <Field label="First name"><Input value={personDialog.form.firstName} onChange={(e) => setP({ firstName: e.target.value })} /></Field>
                <Field label="Last name"><Input value={personDialog.form.lastName} onChange={(e) => setP({ lastName: e.target.value })} /></Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="SSN — last 4 only" hint="The full SSN is never stored here.">
                  <Input maxLength={4} value={personDialog.form.ssnLast4} onChange={(e) => setP({ ssnLast4: e.target.value.replace(/\D/g, "") })} />
                </Field>
                <Field label="Relationship">
                  <Select value={personDialog.form.relationship} onValueChange={(v) => setP({ relationship: v as Person["relationship"] })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="owner">Owner</SelectItem>
                      <SelectItem value="spouse">Spouse</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
              </div>
              <p className="text-sm font-medium border-t pt-3">Form W-4</p>
              <Field label="Filing status (Step 1c)">
                <Select value={personDialog.form.filingStatus} onValueChange={(v) => setP({ filingStatus: v as Person["filingStatus"] })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(FILING_STATUS_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
              <div className="flex items-center justify-between rounded-md border p-3">
                <div>
                  <p className="text-sm font-medium">Step 2 — multiple jobs box checked</p>
                  <p className="text-xs text-muted-foreground">Check if paid by more than one of your companies, or both spouses work.</p>
                </div>
                <Switch checked={personDialog.form.multipleJobs} onCheckedChange={(v) => setP({ multipleJobs: v })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Step 3 — dependents ($/yr)"><Input type="number" value={personDialog.form.dependentsCredit} onChange={(e) => setP({ dependentsCredit: e.target.value })} /></Field>
                <Field label="Step 4a — other income ($/yr)"><Input type="number" value={personDialog.form.otherIncome} onChange={(e) => setP({ otherIncome: e.target.value })} /></Field>
                <Field label="Step 4b — deductions ($/yr)"><Input type="number" value={personDialog.form.deductions} onChange={(e) => setP({ deductions: e.target.value })} /></Field>
                <Field label="Step 4c — extra per check ($)"><Input type="number" value={personDialog.form.extraWithholding} onChange={(e) => setP({ extraWithholding: e.target.value })} /></Field>
              </div>
              <p className="text-sm font-medium border-t pt-3">Exemptions</p>
              <div className="flex items-center justify-between rounded-md border p-3">
                <div>
                  <p className="text-sm font-medium">Exempt from FUTA (Form 940)</p>
                  <p className="text-xs text-muted-foreground">E.g. a spouse employed by a single-member LLC owned by the other spouse.</p>
                </div>
                <Switch checked={personDialog.form.futaExempt} onCheckedChange={(v) => setP({ futaExempt: v })} />
              </div>
              <div className="flex items-center justify-between rounded-md border p-3">
                <div>
                  <p className="text-sm font-medium">Exempt from Utah unemployment</p>
                  <p className="text-xs text-muted-foreground">Left off DWS Form 3. Confirm with DWS before using.</p>
                </div>
                <Switch checked={personDialog.form.utahUiExempt} onCheckedChange={(v) => setP({ utahUiExempt: v })} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setPersonDialog(null)}>Cancel</Button>
            <Button className="bg-brand-green hover:bg-brand-green-dark text-white" onClick={savePerson}
              disabled={!personDialog?.form.firstName || !personDialog?.form.lastName}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

export default function CompaniesTab({ year }: { year: number }) {
  const utils = trpc.useUtils();
  const { data: companies = [], isLoading } = trpc.payroll.listCompanies.useQuery();
  const [dialog, setDialog] = useState<{ id?: number; form: typeof emptyCompany } | null>(null);
  const createCompany = trpc.payroll.createCompany.useMutation();
  const updateCompany = trpc.payroll.updateCompany.useMutation();
  const deleteCompany = trpc.payroll.deleteCompany.useMutation();

  const set = (patch: Partial<typeof emptyCompany>) => dialog && setDialog({ ...dialog, form: { ...dialog.form, ...patch } });

  const save = async () => {
    if (!dialog) return;
    const data = { ...dialog.form, utahUiRate: Number(dialog.form.utahUiRate) || 0 };
    try {
      if (dialog.id) await updateCompany.mutateAsync({ id: dialog.id, ...data, recomputeYear: year });
      else await createCompany.mutateAsync(data);
      toast.success("Company saved");
      setDialog(null);
      utils.payroll.invalidate();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const remove = async () => {
    if (!dialog?.id) return;
    if (!confirm(`Delete ${dialog.form.name} and ALL of its people, paychecks and deposits? This can't be undone.`)) return;
    await deleteCompany.mutateAsync({ id: dialog.id });
    toast.success("Company deleted");
    setDialog(null);
    utils.payroll.invalidate();
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button className="bg-brand-green hover:bg-brand-green-dark text-white gap-2" onClick={() => setDialog({ form: { ...emptyCompany } })}>
          <Plus className="h-4 w-4" /> Add company
        </Button>
      </div>
      {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
      {!isLoading && companies.length === 0 && (
        <Card><CardContent className="py-10 text-center text-muted-foreground">Add your first company to get started.</CardContent></Card>
      )}
      {companies.map((c) => (
        <CompanyCard key={c.id} company={c} year={year} onEdit={() => setDialog({
          id: c.id,
          form: {
            ...emptyCompany,
            ...Object.fromEntries(Object.entries(c).map(([k, v]) => [k, v ?? ""])),
            utahUiRate: String(Number(c.utahUiRate)),
            isActive: c.isActive,
          } as typeof emptyCompany,
        })} />
      ))}

      <Dialog open={!!dialog} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{dialog?.id ? "Edit company" : "Add company"}</DialogTitle></DialogHeader>
          {dialog && (
            <div className="grid gap-4 py-2">
              <Field label="Company name (as registered)"><Input value={dialog.form.name} onChange={(e) => set({ name: e.target.value })} /></Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="EIN"><Input placeholder="12-3456789" value={dialog.form.ein} onChange={(e) => set({ ein: e.target.value })} /></Field>
                <Field label="Federal tax classification">
                  <Select value={dialog.form.taxClassification} onValueChange={(v) => set({ taxClassification: v as Company["taxClassification"] })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(CLASSIFICATION_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </Field>
              </div>
              <Field label="Street address"><Input value={dialog.form.address} onChange={(e) => set({ address: e.target.value })} /></Field>
              <div className="grid grid-cols-3 gap-3">
                <Field label="City"><Input value={dialog.form.city} onChange={(e) => set({ city: e.target.value })} /></Field>
                <Field label="State"><Input maxLength={2} value={dialog.form.state} onChange={(e) => set({ state: e.target.value.toUpperCase() })} /></Field>
                <Field label="ZIP"><Input value={dialog.form.zip} onChange={(e) => set({ zip: e.target.value })} /></Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Utah withholding account #"><Input value={dialog.form.utahWithholdingAccount} onChange={(e) => set({ utahWithholdingAccount: e.target.value })} /></Field>
                <Field label="Utah DWS UI account #"><Input value={dialog.form.utahUiAccount} onChange={(e) => set({ utahUiAccount: e.target.value })} /></Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Utah UI rate (%)" hint="From your DWS rate notice each December.">
                  <Input type="number" step="0.001" value={dialog.form.utahUiRate} onChange={(e) => set({ utahUiRate: e.target.value })} />
                </Field>
                <Field label="How often you pay yourself">
                  <Select value={dialog.form.payFrequency} onValueChange={(v) => set({ payFrequency: v as Company["payFrequency"] })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {["weekly", "biweekly", "semimonthly", "monthly", "quarterly", "annual"].map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="IRS deposit schedule" hint="Monthly unless your lookback-period liability topped $50,000.">
                  <Select value={dialog.form.depositSchedule} onValueChange={(v) => set({ depositSchedule: v as Company["depositSchedule"] })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="monthly">Monthly</SelectItem>
                      <SelectItem value="semiweekly">Semiweekly</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Utah withholding filing">
                  <Select value={dialog.form.utahFilingFrequency} onValueChange={(v) => set({ utahFilingFrequency: v as Company["utahFilingFrequency"] })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="monthly">Monthly</SelectItem>
                      <SelectItem value="quarterly">Quarterly</SelectItem>
                      <SelectItem value="annual">Annual</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
              </div>
              <Field label="Notes"><Textarea rows={2} value={dialog.form.notes} onChange={(e) => set({ notes: e.target.value })} /></Field>
              <div className="flex items-center justify-between rounded-md border p-3">
                <p className="text-sm font-medium">Active</p>
                <Switch checked={dialog.form.isActive} onCheckedChange={(v) => set({ isActive: v })} />
              </div>
            </div>
          )}
          <DialogFooter className="gap-2">
            {dialog?.id && <Button variant="outline" className="text-destructive mr-auto" onClick={remove}>Delete</Button>}
            <Button variant="outline" onClick={() => setDialog(null)}>Cancel</Button>
            <Button className="bg-brand-green hover:bg-brand-green-dark text-white" onClick={save} disabled={!dialog?.form.name}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
