import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AGENCY_LABELS, fmtDate, todayIso, toCents, usd } from "./format";

type Agency = keyof typeof AGENCY_LABELS;

export default function DepositsTab({ companyId, year }: { companyId: number; year: number }) {
  const utils = trpc.useUtils();
  const { data: deposits = [] } = trpc.payroll.listDeposits.useQuery({ companyId, year });
  const [form, setForm] = useState<{ agency: Agency; quarter: string; amount: string; depositDate: string; confirmation: string } | null>(null);

  const create = trpc.payroll.createDeposit.useMutation({
    onSuccess: () => { toast.success("Deposit recorded"); setForm(null); utils.payroll.invalidate(); },
    onError: (e) => toast.error(e.message),
  });
  const remove = trpc.payroll.deleteDeposit.useMutation({
    onSuccess: () => { toast.success("Deposit deleted"); utils.payroll.invalidate(); },
  });

  const set = (patch: Partial<NonNullable<typeof form>>) => form && setForm({ ...form, ...patch });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Record each tax payment so the reports can show what's still owed.</p>
        <Button className="bg-brand-green hover:bg-brand-green-dark text-white gap-2"
          onClick={() => setForm({ agency: "irs_941", quarter: String(Math.floor(new Date().getMonth() / 3) + 1), amount: "", depositDate: todayIso(), confirmation: "" })}>
          <Plus className="h-4 w-4" /> Record deposit
        </Button>
      </div>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          {deposits.length === 0 ? (
            <p className="py-8 text-center text-muted-foreground">No deposits recorded for {year}.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date paid</TableHead>
                  <TableHead>Paid to</TableHead>
                  <TableHead>For</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Confirmation #</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {deposits.map((d) => (
                  <TableRow key={d.id}>
                    <TableCell>{fmtDate(d.depositDate)}</TableCell>
                    <TableCell>{AGENCY_LABELS[d.agency]}</TableCell>
                    <TableCell>{d.quarter ? `Q${d.quarter} ${d.taxYear}` : d.taxYear}</TableCell>
                    <TableCell className="text-right tabular-nums">{usd(d.amountCents)}</TableCell>
                    <TableCell className="font-mono text-xs">{d.confirmation}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" onClick={() => confirm("Delete this deposit?") && remove.mutate({ id: d.id })}>
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!form} onOpenChange={(o) => !o && setForm(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Record tax deposit</DialogTitle></DialogHeader>
          {form && (
            <div className="grid gap-3 py-2">
              <div>
                <Label className="mb-1.5 block">Paid to</Label>
                <Select value={form.agency} onValueChange={(v) => set({ agency: v as Agency })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(AGENCY_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              {form.agency !== "irs_940" && (
                <div>
                  <Label className="mb-1.5 block">For quarter ({year})</Label>
                  <Select value={form.quarter} onValueChange={(v) => set({ quarter: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {[1, 2, 3, 4].map((q) => <SelectItem key={q} value={String(q)}>Q{q}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div>
                <Label className="mb-1.5 block">Amount ($)</Label>
                <Input type="number" step="0.01" value={form.amount} onChange={(e) => set({ amount: e.target.value })} />
              </div>
              <div>
                <Label className="mb-1.5 block">Date paid</Label>
                <Input type="date" value={form.depositDate} onChange={(e) => set({ depositDate: e.target.value })} />
              </div>
              <div>
                <Label className="mb-1.5 block">Confirmation # (optional)</Label>
                <Input value={form.confirmation} onChange={(e) => set({ confirmation: e.target.value })} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setForm(null)}>Cancel</Button>
            <Button className="bg-brand-green hover:bg-brand-green-dark text-white" disabled={!form || toCents(form.amount) <= 0 || create.isPending}
              onClick={() => form && create.mutate({
                companyId, agency: form.agency, taxYear: year,
                quarter: form.agency === "irs_940" ? null : Number(form.quarter),
                amountCents: toCents(form.amount), depositDate: form.depositDate,
                confirmation: form.confirmation || undefined,
              })}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
