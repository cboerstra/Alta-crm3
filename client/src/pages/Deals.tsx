import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, DollarSign, TrendingUp, User, Search, ExternalLink, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useLocation } from "wouter";

const STAGES = ["prospect", "qualified", "proposal", "negotiation", "closed_won", "closed_lost"] as const;
type Stage = typeof STAGES[number];

const STAGE_COLORS: Record<Stage, string> = {
  prospect: "bg-gray-100 text-gray-700 border-gray-200",
  qualified: "bg-blue-100 text-blue-700 border-blue-200",
  proposal: "bg-amber-100 text-amber-700 border-amber-200",
  negotiation: "bg-orange-100 text-orange-700 border-orange-200",
  closed_won: "bg-green-100 text-green-700 border-green-200",
  closed_lost: "bg-red-100 text-red-700 border-red-200",
};

function stageLabel(s: Stage) {
  return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Searchable lead picker */
function LeadPicker({
  value,
  onChange,
}: {
  value: { id: number; name: string; email: string } | null;
  onChange: (lead: { id: number; name: string; email: string } | null) => void;
}) {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const { data: results, isFetching } = trpc.deals.searchLeads.useQuery(
    { query: search || undefined },
    { enabled: open }
  );

  return (
    <div className="relative">
      {value ? (
        <div className="flex items-center justify-between p-2.5 border rounded-md bg-muted/30">
          <div className="flex items-center gap-2 min-w-0">
            <User className="h-4 w-4 text-muted-foreground shrink-0" />
            <div className="min-w-0">
              <p className="text-sm font-medium truncate">{value.name}</p>
              <p className="text-xs text-muted-foreground truncate">{value.email}</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs shrink-0"
            onClick={() => { onChange(null); setSearch(""); }}
          >
            Change
          </Button>
        </div>
      ) : (
        <div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => { setSearch(e.target.value); setOpen(true); }}
              onFocus={() => setOpen(true)}
              onBlur={() => setTimeout(() => setOpen(false), 200)}
              placeholder="Search leads by name or email..."
              className="pl-9"
            />
            {isFetching && (
              <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
            )}
          </div>
          {open && results && results.length > 0 && (
            <div className="absolute z-50 w-full mt-1 bg-background border rounded-md shadow-lg max-h-48 overflow-y-auto">
              {results.map((lead) => (
                <button
                  key={lead.id}
                  type="button"
                  className="w-full text-left px-3 py-2 hover:bg-muted/50 transition-colors"
                  onMouseDown={() => {
                    onChange({ id: lead.id, name: lead.name, email: lead.email });
                    setSearch("");
                    setOpen(false);
                  }}
                >
                  <p className="text-sm font-medium">{lead.name}</p>
                  <p className="text-xs text-muted-foreground">{lead.email}</p>
                </button>
              ))}
            </div>
          )}
          {open && results?.length === 0 && search && (
            <div className="absolute z-50 w-full mt-1 bg-background border rounded-md shadow-lg px-3 py-2 text-sm text-muted-foreground">
              No leads found for "{search}"
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function Deals() {
  const [, setLocation] = useLocation();
  const [showCreate, setShowCreate] = useState(false);
  const [stageFilter, setStageFilter] = useState<string>("all");
  const [form, setForm] = useState({ title: "", value: "", notes: "", propertyAddress: "" });
  const [selectedLead, setSelectedLead] = useState<{ id: number; name: string; email: string } | null>(null);

  const { data: deals, isLoading, refetch } = trpc.deals.list.useQuery();

  const createMutation = trpc.deals.create.useMutation({
    onSuccess: () => {
      toast.success("Deal created");
      setShowCreate(false);
      setForm({ title: "", value: "", notes: "", propertyAddress: "" });
      setSelectedLead(null);
      refetch();
    },
    onError: (e) => toast.error(e.message),
  });

  const updateMutation = trpc.deals.update.useMutation({
    onSuccess: () => { toast.success("Stage updated"); refetch(); },
    onError: (e) => toast.error(e.message),
  });

  const filteredDeals = useMemo(() => {
    if (!deals) return [];
    if (stageFilter === "all") return deals;
    return deals.filter((d) => d.stage === stageFilter);
  }, [deals, stageFilter]);

  const totalValue = deals?.reduce((sum, d) => sum + Number(d.value ?? 0), 0) ?? 0;
  const wonValue = deals?.filter((d) => d.stage === "closed_won").reduce((sum, d) => sum + Number(d.value ?? 0), 0) ?? 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ fontFamily: "Raleway, sans-serif" }}>Deals</h1>
          <p className="text-muted-foreground text-sm mt-1">Every deal is linked to a lead in your CRM</p>
        </div>
        <Dialog
          open={showCreate}
          onOpenChange={(o) => {
            setShowCreate(o);
            if (!o) { setSelectedLead(null); setForm({ title: "", value: "", notes: "", propertyAddress: "" }); }
          }}
        >
          <DialogTrigger asChild>
            <Button className="bg-brand-green hover:bg-brand-green-dark text-white gap-2">
              <Plus className="h-4 w-4" /> New Deal
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle style={{ fontFamily: "Raleway, sans-serif" }}>Create Deal</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-2">
              <div>
                <Label className="mb-1.5 block">
                  Linked Lead <span className="text-red-500">*</span>
                </Label>
                <LeadPicker value={selectedLead} onChange={setSelectedLead} />
                {!selectedLead && (
                  <p className="text-xs text-muted-foreground mt-1">Search and select the lead this deal belongs to.</p>
                )}
              </div>
              <div>
                <Label>Deal Title <span className="text-red-500">*</span></Label>
                <Input
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="e.g. 123 Main St Refinance"
                />
              </div>
              <div>
                <Label>Value ($) <span className="text-red-500">*</span></Label>
                <Input
                  type="number"
                  value={form.value}
                  onChange={(e) => setForm({ ...form, value: e.target.value })}
                  placeholder="0.00"
                />
              </div>
              <div>
                <Label>Property Address</Label>
                <Input
                  value={form.propertyAddress}
                  onChange={(e) => setForm({ ...form, propertyAddress: e.target.value })}
                  placeholder="Optional"
                />
              </div>
              <div>
                <Label>Notes</Label>
                <Input
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  placeholder="Optional"
                />
              </div>
              <Button
                className="bg-brand-green hover:bg-brand-green-dark text-white h-10"
                disabled={!form.title || !form.value || !selectedLead || createMutation.isPending}
                onClick={() => createMutation.mutate({
                  title: form.title,
                  value: Number(form.value),
                  leadId: selectedLead!.id,
                  propertyAddress: form.propertyAddress || undefined,
                  notes: form.notes || undefined,
                })}
              >
                {createMutation.isPending
                  ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Creating...</>
                  : "Create Deal"}
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

      {/* Stage filter pills */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs text-muted-foreground font-medium">Filter:</span>
        {(["all", ...STAGES] as const).map((s) => (
          <button
            key={s}
            onClick={() => setStageFilter(s)}
            className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
              stageFilter === s
                ? "bg-brand-green text-white border-brand-green"
                : "bg-background text-muted-foreground border-border hover:border-brand-green/50"
            }`}
          >
            {s === "all" ? "All" : stageLabel(s as Stage)}
          </button>
        ))}
      </div>

      {/* Deals Table */}
      <Card className="border-0 shadow-sm overflow-hidden">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground">Loading deals...</div>
          ) : !filteredDeals.length ? (
            <div className="p-12 text-center">
              <DollarSign className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-muted-foreground font-medium">No deals found</p>
              <p className="text-sm text-muted-foreground mt-1">
                {stageFilter !== "all" ? "Try a different stage filter, or " : ""}
                Create a new deal by selecting a lead first.
              </p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/30">
                  <th className="text-left p-3 font-semibold text-xs uppercase tracking-wider text-muted-foreground">Deal</th>
                  <th className="text-left p-3 font-semibold text-xs uppercase tracking-wider text-muted-foreground">Lead</th>
                  <th className="text-left p-3 font-semibold text-xs uppercase tracking-wider text-muted-foreground">Value</th>
                  <th className="text-left p-3 font-semibold text-xs uppercase tracking-wider text-muted-foreground">Stage</th>
                  <th className="text-left p-3 font-semibold text-xs uppercase tracking-wider text-muted-foreground">Created</th>
                </tr>
              </thead>
              <tbody>
                {filteredDeals.map((deal) => (
                  <tr key={deal.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                    <td className="p-3">
                      <p className="font-medium">{deal.title}</p>
                      {(deal as any).propertyAddress && (
                        <p className="text-xs text-muted-foreground truncate max-w-[200px]">{(deal as any).propertyAddress}</p>
                      )}
                    </td>
                    <td className="p-3">
                      <button
                        className="flex items-center gap-1.5 group text-left"
                        onClick={() => setLocation(`/leads/${deal.leadId}`)}
                      >
                        <div className="h-7 w-7 rounded-full bg-brand-green/10 flex items-center justify-center shrink-0">
                          <User className="h-3.5 w-3.5 text-brand-green" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium group-hover:text-brand-green transition-colors truncate">
                            {(deal as any).leadFirstName} {(deal as any).leadLastName}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">{(deal as any).leadEmail}</p>
                        </div>
                        <ExternalLink className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                      </button>
                    </td>
                    <td className="p-3 text-brand-gold font-semibold">${Number(deal.value ?? 0).toLocaleString()}</td>
                    <td className="p-3">
                      <Select
                        value={deal.stage}
                        onValueChange={(v) => updateMutation.mutate({ id: deal.id, stage: v as Stage })}
                      >
                        <SelectTrigger className="w-auto h-auto border-0 p-0 shadow-none focus:ring-0 bg-transparent">
                          <Badge className={`${STAGE_COLORS[deal.stage as Stage]} text-xs font-medium cursor-pointer`}>
                            {stageLabel(deal.stage as Stage)}
                          </Badge>
                        </SelectTrigger>
                        <SelectContent>
                          {STAGES.map((s) => (
                            <SelectItem key={s} value={s}>{stageLabel(s)}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
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
