import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useLocation } from "wouter";
import { Plus, Search, Users, Filter, ChevronLeft, ChevronRight, Sparkles } from "lucide-react";
import { toast } from "sonner";

const STAGES = [
  { value: "all", label: "All Stages" },
  { value: "new_lead", label: "New Lead" },
  { value: "registered", label: "Registered" },
  { value: "attended", label: "Attended" },
  { value: "no_show", label: "No Show" },
  { value: "consultation_booked", label: "Consultation Booked" },
  { value: "under_contract", label: "Under Contract" },
  { value: "closed", label: "Closed" },
];

const stageColors: Record<string, string> = {
  new_lead: "bg-blue-100 text-blue-700",
  registered: "bg-brand-green/10 text-brand-green",
  attended: "bg-emerald-100 text-emerald-700",
  no_show: "bg-red-100 text-red-700",
  consultation_booked: "bg-brand-gold/10 text-brand-gold",
  under_contract: "bg-purple-100 text-purple-700",
  closed: "bg-gray-100 text-gray-700",
};

export default function Leads() {
  const [, setLocation] = useLocation();
  const [search, setSearch] = useState("");
  const [stage, setStage] = useState("all");
  const [page, setPage] = useState(0);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ firstName: "", lastName: "", email: "", phone: "", source: "", campaign: "" });

  const stableSearch = useMemo(() => search, [search]);
  const { data, isLoading, refetch } = trpc.leads.list.useQuery({
    search: stableSearch || undefined,
    stage: stage !== "all" ? stage : undefined,
    limit: 20,
    offset: page * 20,
  });

  const createMutation = trpc.leads.create.useMutation({
    onSuccess: () => {
      toast.success("Lead created successfully");
      setShowCreate(false);
      setForm({ firstName: "", lastName: "", email: "", phone: "", source: "", campaign: "" });
      refetch();
    },
    onError: (e) => toast.error(e.message),
  });

  const scoreMutation = trpc.leads.scoreWithLLM.useMutation({
    onSuccess: (data) => {
      toast.success(`Lead scored: ${data.score}/100`);
      refetch();
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ fontFamily: "Raleway, sans-serif" }}>Leads</h1>
          <p className="text-muted-foreground text-sm mt-1">{data?.total ?? 0} total leads</p>
        </div>
        <Dialog open={showCreate} onOpenChange={setShowCreate}>
          <DialogTrigger asChild>
            <Button className="bg-brand-green hover:bg-brand-green-dark text-white gap-2">
              <Plus className="h-4 w-4" /> Add Lead
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle style={{ fontFamily: "Raleway, sans-serif" }}>Create New Lead</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-2">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>First Name *</Label>
                  <Input value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} />
                </div>
                <div>
                  <Label>Last Name *</Label>
                  <Input value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} />
                </div>
              </div>
              <div>
                <Label>Email *</Label>
                <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </div>
              <div>
                <Label>Phone</Label>
                <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Source</Label>
                  <Input placeholder="e.g. Facebook, Google" value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })} />
                </div>
                <div>
                  <Label>Campaign</Label>
                  <Input placeholder="e.g. Spring 2026" value={form.campaign} onChange={(e) => setForm({ ...form, campaign: e.target.value })} />
                </div>
              </div>
              <Button
                className="bg-brand-green hover:bg-brand-green-dark text-white"
                disabled={!form.firstName || !form.lastName || !form.email || createMutation.isPending}
                onClick={() => createMutation.mutate(form)}
              >
                {createMutation.isPending ? "Creating..." : "Create Lead"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search leads..." className="pl-9" value={search} onChange={(e) => { setSearch(e.target.value); setPage(0); }} />
        </div>
        <Select value={stage} onValueChange={(v) => { setStage(v); setPage(0); }}>
          <SelectTrigger className="w-[180px]">
            <Filter className="h-4 w-4 mr-2" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STAGES.map((s) => (
              <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Lead Table */}
      <Card className="border-0 shadow-sm overflow-hidden">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground">Loading leads...</div>
          ) : !data?.items.length ? (
            <div className="p-12 text-center">
              <Users className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-muted-foreground">No leads found</p>
              <p className="text-xs text-muted-foreground mt-1">Create your first lead or adjust filters</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/30">
                    <th className="text-left p-3 font-semibold text-xs uppercase tracking-wider text-muted-foreground">Name</th>
                    <th className="text-left p-3 font-semibold text-xs uppercase tracking-wider text-muted-foreground">Email</th>
                    <th className="text-left p-3 font-semibold text-xs uppercase tracking-wider text-muted-foreground">Phone</th>
                    <th className="text-left p-3 font-semibold text-xs uppercase tracking-wider text-muted-foreground">Source</th>
                    <th className="text-left p-3 font-semibold text-xs uppercase tracking-wider text-muted-foreground">Stage</th>
                    <th className="text-left p-3 font-semibold text-xs uppercase tracking-wider text-muted-foreground">Score</th>
                    <th className="text-left p-3 font-semibold text-xs uppercase tracking-wider text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((lead) => (
                    <tr
                      key={lead.id}
                      className="border-b border-border/50 hover:bg-muted/20 transition-colors cursor-pointer"
                      onClick={() => setLocation(`/leads/${lead.id}`)}
                    >
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <div className="h-8 w-8 rounded-full bg-brand-green/10 flex items-center justify-center shrink-0">
                            <span className="text-xs font-semibold text-brand-green">{lead.firstName.charAt(0)}{lead.lastName.charAt(0)}</span>
                          </div>
                          <span className="font-medium">{lead.firstName} {lead.lastName}</span>
                        </div>
                      </td>
                      <td className="p-3 text-muted-foreground">{lead.email}</td>
                      <td className="p-3 text-muted-foreground">{lead.phone || "—"}</td>
                      <td className="p-3 text-muted-foreground">{lead.source || "Direct"}</td>
                      <td className="p-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${stageColors[lead.stage] || "bg-gray-100 text-gray-700"}`}>
                          {lead.stage.replace(/_/g, " ")}
                        </span>
                      </td>
                      <td className="p-3">
                        {lead.score !== null && lead.score > 0 ? (
                          <span className="text-xs font-semibold text-brand-gold">{lead.score}/100</span>
                        ) : (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs gap-1"
                            onClick={(e) => { e.stopPropagation(); scoreMutation.mutate({ leadId: lead.id }); }}
                          >
                            <Sparkles className="h-3 w-3" /> Score
                          </Button>
                        )}
                      </td>
                      <td className="p-3">
                        <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={(e) => { e.stopPropagation(); setLocation(`/leads/${lead.id}`); }}>
                          View
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {data && data.total > 20 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {page * 20 + 1}–{Math.min((page + 1) * 20, data.total)} of {data.total}
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(page - 1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" disabled={(page + 1) * 20 >= data.total} onClick={() => setPage(page + 1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
