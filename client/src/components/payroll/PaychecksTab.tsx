import { useEffect, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { fmtDate, fromCents, todayIso, toCents, usd, type PayrollOutputs } from "./format";

type Paycheck = PayrollOutputs["listPaychecks"][number];
type CentsKey = { [K in keyof Paycheck]: Paycheck[K] extends number ? K : never }[keyof Paycheck];

const emptyForm = {
  personId: "", payDate: todayIso(), periodStart: "", periodEnd: "",
  gross: "", retirement401k: "", shareholderHealth: "",
  federalWithholding: "", utahWithholding: "", memo: "",
};

/** Debounce form edits so the preview query doesn't fire on every keystroke. */
function useDebounced<T>(value: T, ms = 350) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

export default function PaychecksTab({ companyId, year }: { companyId: number; year: number }) {
  const utils = trpc.useUtils();
  const { data: people = [] } = trpc.payroll.listPeople.useQuery({ companyId });
  const { data: checks = [], isLoading } = trpc.payroll.listPaychecks.useQuery({ companyId, year });
  const [dialog, setDialog] = useState<{ id?: number; form: typeof emptyForm } | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const save = trpc.payroll.savePaycheck.useMutation({
    onSuccess: () => { toast.success("Paycheck saved"); setDialog(null); utils.payroll.invalidate(); },
    onError: (e) => toast.error(e.message),
  });
  const remove = trpc.payroll.deletePaycheck.useMutation({
    onSuccess: () => { toast.success("Paycheck deleted"); utils.payroll.invalidate(); },
    onError: (e) => toast.error(e.message),
  });

  const f = dialog?.form;
  const payload = f && f.personId && toCents(f.gross) > 0 && /^\d{4}-\d{2}-\d{2}$/.test(f.payDate)
    ? {
        id: dialog?.id,
        companyId,
        personId: Number(f.personId),
        payDate: f.payDate,
        periodStart: f.periodStart || null,
        periodEnd: f.periodEnd || null,
        grossCents: toCents(f.gross),
        retirement401kCents: toCents(f.retirement401k),
        shareholderHealthCents: toCents(f.shareholderHealth),
        federalWithholdingCents: f.federalWithholding === "" ? null : toCents(f.federalWithholding),
        utahWithholdingCents: f.utahWithholding === "" ? null : toCents(f.utahWithholding),
        memo: f.memo || null,
      }
    : null;
  const debounced = useDebounced(payload);
  const { data: preview } = trpc.payroll.previewPaycheck.useQuery(debounced!, { enabled: !!debounced });

  const set = (patch: Partial<typeof emptyForm>) => dialog && setDialog({ ...dialog, form: { ...dialog.form, ...patch } });
  const personName = (id: number) => {
    const p = people.find((x) => x.id === id);
    return p ? `${p.firstName} ${p.lastName}` : "—";
  };

  const openNew = () => {
    setShowAdvanced(false);
    setDialog({ form: { ...emptyForm, personId: people.length === 1 ? String(people[0].id) : "" } });
  };
  const openEdit = (c: Paycheck) => {
    setShowAdvanced(!!(c.retirement401kCents || c.shareholderHealthCents || c.periodStart));
    setDialog({
      id: c.id,
      form: {
        personId: String(c.personId), payDate: c.payDate, periodStart: c.periodStart ?? "", periodEnd: c.periodEnd ?? "",
        gross: fromCents(c.grossCents), retirement401k: fromCents(c.retirement401kCents), shareholderHealth: fromCents(c.shareholderHealthCents),
        // Keep what was actually withheld on the check
        federalWithholding: (c.federalWithholdingCents / 100).toFixed(2), utahWithholding: (c.utahWithholdingCents / 100).toFixed(2),
        memo: c.memo ?? "",
      },
    });
  };

  const total = (k: CentsKey) => checks.reduce((a, c) => a + c[k], 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Enter each paycheck on the date it was paid. Taxes are reported by pay date.</p>
        <Button className="bg-brand-green hover:bg-brand-green-dark text-white gap-2" onClick={openNew} disabled={people.length === 0}>
          <Plus className="h-4 w-4" /> Add paycheck
        </Button>
      </div>
      {people.length === 0 && (
        <Card><CardContent className="py-8 text-center text-muted-foreground">Add a person to this company on the Companies tab first.</CardContent></Card>
      )}

      {checks.length > 0 && (
        <Card>
          <CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Pay date</TableHead>
                  <TableHead>Person</TableHead>
                  <TableHead className="text-right">Gross</TableHead>
                  <TableHead className="text-right">Federal</TableHead>
                  <TableHead className="text-right">Utah</TableHead>
                  <TableHead className="text-right">SS + Medicare</TableHead>
                  <TableHead className="text-right">Net pay</TableHead>
                  <TableHead className="text-right">Employer taxes</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {checks.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell>{fmtDate(c.payDate)}</TableCell>
                    <TableCell>
                      {personName(c.personId)}
                      {c.withholdingOverridden && <Badge variant="outline" className="ml-2 text-[10px]">manual w/h</Badge>}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{usd(c.grossCents)}</TableCell>
                    <TableCell className="text-right tabular-nums">{usd(c.federalWithholdingCents)}</TableCell>
                    <TableCell className="text-right tabular-nums">{usd(c.utahWithholdingCents)}</TableCell>
                    <TableCell className="text-right tabular-nums">{usd(c.ssEmployeeCents + c.medicareEmployeeCents + c.addlMedicareCents)}</TableCell>
                    <TableCell className="text-right tabular-nums font-medium">{usd(c.netPayCents)}</TableCell>
                    <TableCell className="text-right tabular-nums">{usd(c.ssEmployerCents + c.medicareEmployerCents + c.futaCents + c.utahUiCents)}</TableCell>
                    <TableCell className="text-right whitespace-nowrap">
                      <Button variant="ghost" size="sm" className="gap-1" onClick={() => openEdit(c)}><Pencil className="h-3.5 w-3.5" /> Edit</Button>
                      <Button variant="ghost" size="sm" className="gap-1 text-destructive hover:text-destructive"
                        onClick={() => confirm(`Delete the ${fmtDate(c.payDate)} paycheck for ${personName(c.personId)}?`) && remove.mutate({ id: c.id })}>
                        <Trash2 className="h-3.5 w-3.5" /> Delete
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell colSpan={2}>{year} total</TableCell>
                  <TableCell className="text-right tabular-nums">{usd(total("grossCents"))}</TableCell>
                  <TableCell className="text-right tabular-nums">{usd(total("federalWithholdingCents"))}</TableCell>
                  <TableCell className="text-right tabular-nums">{usd(total("utahWithholdingCents"))}</TableCell>
                  <TableCell className="text-right tabular-nums">{usd(total("ssEmployeeCents") + total("medicareEmployeeCents") + total("addlMedicareCents"))}</TableCell>
                  <TableCell className="text-right tabular-nums">{usd(total("netPayCents"))}</TableCell>
                  <TableCell className="text-right tabular-nums">{usd(total("ssEmployerCents") + total("medicareEmployerCents") + total("futaCents") + total("utahUiCents"))}</TableCell>
                  <TableCell />
                </TableRow>
              </TableFooter>
            </Table>
          </CardContent>
        </Card>
      )}
      {!isLoading && checks.length === 0 && people.length > 0 && (
        <Card><CardContent className="py-8 text-center text-muted-foreground">No paychecks in {year} yet.</CardContent></Card>
      )}

      <Dialog open={!!dialog} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{dialog?.id ? "Edit paycheck" : "Add paycheck"}</DialogTitle></DialogHeader>
          {f && (
            <div className="grid sm:grid-cols-2 gap-6 py-2">
              <div className="grid gap-3 content-start">
                <div>
                  <Label className="mb-1.5 block">Paid to</Label>
                  <Select value={f.personId} onValueChange={(v) => set({ personId: v })}>
                    <SelectTrigger><SelectValue placeholder="Choose person" /></SelectTrigger>
                    <SelectContent>
                      {people.map((p) => <SelectItem key={p.id} value={String(p.id)}>{p.firstName} {p.lastName}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="mb-1.5 block">Pay date</Label>
                  <Input type="date" value={f.payDate} onChange={(e) => set({ payDate: e.target.value })} />
                </div>
                <div>
                  <Label className="mb-1.5 block">Gross pay ($)</Label>
                  <Input type="number" step="0.01" value={f.gross} onChange={(e) => set({ gross: e.target.value })} placeholder="0.00" />
                </div>
                <div>
                  <Label className="mb-1.5 block">Federal income tax withheld ($)</Label>
                  <Input type="number" step="0.01" value={f.federalWithholding} onChange={(e) => set({ federalWithholding: e.target.value })}
                    placeholder={preview ? `Auto: ${(preview.suggestedFederalWithholdingCents / 100).toFixed(2)}` : "Leave blank for W-4 amount"} />
                </div>
                <div>
                  <Label className="mb-1.5 block">Utah income tax withheld ($)</Label>
                  <Input type="number" step="0.01" value={f.utahWithholding} onChange={(e) => set({ utahWithholding: e.target.value })}
                    placeholder={preview ? `Auto: ${(preview.suggestedUtahWithholdingCents / 100).toFixed(2)}` : "Leave blank for Pub 14 amount"} />
                  <p className="text-xs text-muted-foreground mt-1">Leave withholding blank to use the calculated amount, or type what you actually withheld.</p>
                </div>
                <button type="button" className="text-xs text-brand-green underline text-left" onClick={() => setShowAdvanced(!showAdvanced)}>
                  {showAdvanced ? "Hide" : "Show"} 401(k), health insurance, pay period, memo
                </button>
                {showAdvanced && (
                  <>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className="mb-1.5 block text-xs">Period start</Label>
                        <Input type="date" value={f.periodStart} onChange={(e) => set({ periodStart: e.target.value })} />
                      </div>
                      <div>
                        <Label className="mb-1.5 block text-xs">Period end</Label>
                        <Input type="date" value={f.periodEnd} onChange={(e) => set({ periodEnd: e.target.value })} />
                      </div>
                    </div>
                    <div>
                      <Label className="mb-1.5 block text-xs">Pre-tax 401(k) deferral ($)</Label>
                      <Input type="number" step="0.01" value={f.retirement401k} onChange={(e) => set({ retirement401k: e.target.value })} />
                    </div>
                    <div>
                      <Label className="mb-1.5 block text-xs">S-corp 2% shareholder health premiums ($)</Label>
                      <Input type="number" step="0.01" value={f.shareholderHealth} onChange={(e) => set({ shareholderHealth: e.target.value })} />
                      <p className="text-xs text-muted-foreground mt-1">Added to W-2 box 1 / state wages; not Social Security, Medicare or FUTA wages.</p>
                    </div>
                    <div>
                      <Label className="mb-1.5 block text-xs">Memo</Label>
                      <Input value={f.memo} onChange={(e) => set({ memo: e.target.value })} />
                    </div>
                  </>
                )}
              </div>

              <div className="rounded-lg border bg-muted/30 p-4 text-sm space-y-1 content-start h-fit">
                <p className="font-medium mb-2">Paycheck preview</p>
                {!preview && <p className="text-muted-foreground">Choose a person and enter gross pay.</p>}
                {preview && (
                  <>
                    <Row label="Gross pay" value={toCents(f.gross)} />
                    {toCents(f.retirement401k) > 0 && <Row label="401(k) deferral" value={-toCents(f.retirement401k)} />}
                    <Row label="Federal income tax" value={-preview.federalWithholdingCents} />
                    <Row label="Utah income tax" value={-preview.utahWithholdingCents} />
                    <Row label="Social Security (6.2%)" value={-preview.ssEmployeeCents} />
                    <Row label="Medicare (1.45%)" value={-preview.medicareEmployeeCents} />
                    {preview.addlMedicareCents > 0 && <Row label="Additional Medicare (0.9%)" value={-preview.addlMedicareCents} />}
                    <div className="border-t pt-1 mt-1"><Row label="Net pay" value={preview.netPayCents} bold /></div>
                    <p className="font-medium pt-3">Employer cost</p>
                    <Row label="Social Security match" value={preview.ssEmployerCents} />
                    <Row label="Medicare match" value={preview.medicareEmployerCents} />
                    <Row label="FUTA (0.6%)" value={preview.futaCents} />
                    <Row label="Utah unemployment" value={preview.utahUiCents} />
                    {!preview.exactTaxYear && (
                      <p className="text-xs text-amber-700 pt-2">No tax table for this year yet — using the nearest year. Check the withholding amounts.</p>
                    )}
                  </>
                )}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog(null)}>Cancel</Button>
            <Button className="bg-brand-green hover:bg-brand-green-dark text-white" disabled={!payload || save.isPending}
              onClick={() => payload && save.mutate(payload)}>Save paycheck</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Row({ label, value, bold }: { label: string; value: number; bold?: boolean }) {
  return (
    <div className={`flex justify-between ${bold ? "font-semibold" : ""}`}>
      <span>{label}</span>
      <span className="tabular-nums">{usd(value)}</span>
    </div>
  );
}
