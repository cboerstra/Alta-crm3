import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, DollarSign, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import { useLocation } from "wouter";

export default function Deals() {
  const [, setLocation] = useLocation();
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({
    title: "", value: "", leadId: "", stage: "prospect",
  });

  const { data: deals, isLoading, refetch } = trpc.deals.list.useQuery();
  const { data: leadsData } = trpc.leads.list.useQuery({ limit: 500 });

  const createMutation = trpc.deals.create.useMutation({
    onSuccess: () => { toast.success("Deal created"); setShowCreate(false); setForm({ title: "", value: "", leadId: "", stage: "prospect" }); refetch(); },
    onError: (e) => toast.error(e.message),
  });

  const updateMutation = trpc.deals.update.useMutation({
    onSuccess: () => { toast.success("Deal updated"); refetch(); },
    onError: (e) => toast.error(e.message),
  });

  const totalValue = deals?.reduce((sum, d) => sum + Number(d.value ?? 0), 0) ?? 0;
  const wonValue = deals?.filter((d) => d.stage === "closed_won").reduce((sum, d) => sum + Number(d.value ?? 0), 0) ?? 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ fontFamily: "Raleway, sans-serif" }}>Deals</h1>
          <p className="text-muted-foreground text-sm mt-1">Track and manage your deals</p>
        </div>
        <Dialog open={showCreate} onOpenChange={setShowCreate}>
          <DialogTrigger asChild>
            <Button className="bg-brand-green hover:bg-brand-green-dark text-white gap-2">
              <Plus className="h-4 w-4" /> New Deal
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle style={{ fontFamily: "Raleway, sans-serif" }}>Create Deal</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-2">
              <div>
                <Label>Deal Title *</Label>
                <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
              </div>
              <div>
                <Label>Value ($) *</Label>
                <Input type="number" value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} placeholder="0.00" />
              </div>
              <div>
                <Label>Linked Lead *</Label>
                <Select value={form.leadId} onValueChange={(v) => setForm({ ...form, leadId: v })}>
                  <SelectTrigger><SelectValue placeholder="Select lead..." /></SelectTrigger>
                  <SelectContent>
                    {leadsData?.items.map((l) => (
                      <SelectItem key={l.id} value={l.id.toString()}>{l.firstName} {l.lastName}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                className="bg-brand-green hover:bg-brand-green-dark text-white"
                disabled={!form.title || !form.value || !form.leadId || createMutation.isPending}
                onClick={() => createMutation.mutate({
                  title: form.title,
                  value: Number(form.value),
                  leadId: Number(form.leadId),
                })}
              >
                {createMutation.isPending ? "Creating..." : "Create Deal"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-brand-green/10 flex items-center justify-center">
              <DollarSign className="h-5 w-5 text-brand-green" />
            </div>
            <div>
              <p className="text-2xl font-bold" style={{ fontFamily: "Raleway, sans-serif" }}>${totalValue.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground">Total Pipeline</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-brand-gold/10 flex items-center justify-center">
              <TrendingUp className="h-5 w-5 text-brand-gold" />
            </div>
            <div>
              <p className="text-2xl font-bold" style={{ fontFamily: "Raleway, sans-serif" }}>${wonValue.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground">Won Revenue</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-blue-100 flex items-center justify-center">
              <DollarSign className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold" style={{ fontFamily: "Raleway, sans-serif" }}>{deals?.length ?? 0}</p>
              <p className="text-xs text-muted-foreground">Total Deals</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Deals List */}
      <Card className="border-0 shadow-sm overflow-hidden">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground">Loading deals...</div>
          ) : !deals?.length ? (
            <div className="p-12 text-center">
              <DollarSign className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-muted-foreground">No deals yet</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/30">
                  <th className="text-left p-3 font-semibold text-xs uppercase tracking-wider text-muted-foreground">Deal</th>
                  <th className="text-left p-3 font-semibold text-xs uppercase tracking-wider text-muted-foreground">Value</th>
                  <th className="text-left p-3 font-semibold text-xs uppercase tracking-wider text-muted-foreground">Stage</th>
                  <th className="text-left p-3 font-semibold text-xs uppercase tracking-wider text-muted-foreground">Lead</th>
                  <th className="text-left p-3 font-semibold text-xs uppercase tracking-wider text-muted-foreground">Created</th>
                </tr>
              </thead>
              <tbody>
                {deals.map((deal) => (
                  <tr key={deal.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                    <td className="p-3 font-medium">{deal.title}</td>
                    <td className="p-3 text-brand-gold font-semibold">${Number(deal.value ?? 0).toLocaleString()}</td>
                    <td className="p-3">
                      <Select value={deal.stage} onValueChange={(v) => updateMutation.mutate({ id: deal.id, stage: v as any })}>
                        <SelectTrigger className="w-[140px] h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {["prospect", "qualified", "proposal", "negotiation", "closed_won", "closed_lost"].map((s) => (
                            <SelectItem key={s} value={s}>{s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="p-3 text-muted-foreground">
                      <Button variant="link" size="sm" className="h-auto p-0 text-xs" onClick={() => setLocation(`/leads/${deal.leadId}`)}>
                        View Lead
                      </Button>
                    </td>
                    <td className="p-3 text-muted-foreground text-xs">{new Date(deal.createdAt).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
