import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Play, Pause, Eye, Trash2, Mail, Send, BarChart3, Pencil } from "lucide-react";

const STATUS_COLORS: Record<string, string> = {
  draft: "secondary",
  scheduled: "outline",
  sending: "default",
  paused: "secondary",
  completed: "default",
  cancelled: "destructive",
};

export default function Campaigns() {
  const utils = trpc.useUtils();
  const [showCreate, setShowCreate] = useState(false);
  const [showDetail, setShowDetail] = useState<number | null>(null);
  const [editing, setEditing] = useState<{ id: number; status: string } | null>(null);
  const recipientsLocked = editing?.status === "paused";
  const [form, setForm] = useState({
    audience: "re_agent" as "re_agent" | "past_mortgage" | "prospective_mortgage" | "prospective_re_client",
    name: "", subject: "", bodyHtml: "", fromName: "Scott Boerstra",
    filterBrokerage: "", filterCity: "", filterState: "", filterLoanType: "", filterTag: "",
    batchSize: 50, batchDelayMinutes: 15,
  });

  const { data, isLoading } = trpc.campaigns.list.useQuery({ limit: 50 });
  const detail = trpc.campaigns.getById.useQuery(
    { id: showDetail! }, { enabled: showDetail !== null }
  );
  const brokerages = trpc.agentContacts.brokerages.useQuery();
  const agentTags = trpc.agentContacts.tags.useQuery();
  const bulkUsage = trpc.bulkEmail.usage.useQuery();
  const agentCities = trpc.agentContacts.cities.useQuery();
  const mcCities = trpc.mortgageClients.cities.useQuery();
  const loanTypes = trpc.mortgageClients.loanTypes.useQuery();

  const previewCount = trpc.campaigns.previewRecipients.useQuery({
    audience: form.audience,
    filterBrokerage: form.filterBrokerage || undefined,
    filterCity: form.filterCity || undefined,
    filterState: form.filterState || undefined,
    filterLoanType: form.filterLoanType || undefined,
    filterTags: form.audience === "re_agent" && form.filterTag ? [form.filterTag] : undefined,
  }, { enabled: showCreate && !recipientsLocked });

  const createMutation = trpc.campaigns.create.useMutation({
    onSuccess: () => { utils.campaigns.invalidate(); closeForm(); },
  });
  const updateMutation = trpc.campaigns.update.useMutation({
    onSuccess: () => { utils.campaigns.invalidate(); closeForm(); },
    onError: (err) => alert(err.message),
  });
  const sendMutation = trpc.campaigns.send.useMutation({
    onSuccess: () => utils.campaigns.invalidate(),
  });
  const pauseMutation = trpc.campaigns.pause.useMutation({
    onSuccess: () => utils.campaigns.invalidate(),
  });
  const deleteMutation = trpc.campaigns.delete.useMutation({
    onSuccess: () => utils.campaigns.invalidate(),
  });

  function resetForm() {
    setForm({
      audience: "re_agent", name: "", subject: "", bodyHtml: "", fromName: "Scott Boerstra",
      filterBrokerage: "", filterCity: "", filterState: "", filterLoanType: "", filterTag: "",
      batchSize: 50, batchDelayMinutes: 15,
    });
  }

  function closeForm() {
    setShowCreate(false);
    setEditing(null);
    resetForm();
  }

  async function openEdit(id: number) {
    const c = await utils.campaigns.getById.fetch({ id });
    if (!c) return;
    const tags = Array.isArray(c.filterTags) ? (c.filterTags as string[]) : [];
    setForm({
      audience: c.audience as typeof form.audience,
      name: c.name, subject: c.subject, bodyHtml: c.bodyHtml, fromName: c.fromName ?? "",
      filterBrokerage: c.filterBrokerage ?? "", filterCity: c.filterCity ?? "", filterState: c.filterState ?? "",
      filterLoanType: "", filterTag: tags[0] ?? "",
      batchSize: c.batchSize, batchDelayMinutes: c.batchDelayMinutes,
    });
    setEditing({ id, status: c.status });
    setShowCreate(true);
  }

  function saveEdit() {
    if (!editing) return;
    const content = {
      id: editing.id, name: form.name, subject: form.subject, bodyHtml: form.bodyHtml, fromName: form.fromName,
      batchSize: form.batchSize, batchDelayMinutes: form.batchDelayMinutes,
    };
    updateMutation.mutate(recipientsLocked ? content : {
      ...content,
      audience: form.audience,
      filterTags: form.audience === "re_agent" && form.filterTag ? [form.filterTag] : [],
      filterBrokerage: form.filterBrokerage || null,
      filterCity: form.filterCity || null,
      filterState: form.filterState || null,
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Email Campaigns</h1>
        <Button onClick={() => setShowCreate(true)}>
          <Plus className="w-4 h-4 mr-2" /> New Campaign
        </Button>
      </div>

      <div className="border rounded-md">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Subject</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Recipients</TableHead>
              <TableHead>Sent</TableHead>
              <TableHead>Opened</TableHead>
              <TableHead>Clicked</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={8} className="text-center py-8">Loading...</TableCell></TableRow>
            ) : data?.campaigns.length === 0 ? (
              <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">No campaigns yet</TableCell></TableRow>
            ) : data?.campaigns.map((c) => (
              <TableRow key={c.id}>
                <TableCell className="font-medium">{c.name}</TableCell>
                <TableCell className="max-w-[360px] truncate" title={c.subject}>{c.subject}</TableCell>
                <TableCell>
                  <Badge variant={STATUS_COLORS[c.status] as any}>{c.status}</Badge>
                </TableCell>
                <TableCell>{c.totalRecipients}</TableCell>
                <TableCell>{c.totalSent}</TableCell>
                <TableCell>{c.totalOpened}</TableCell>
                <TableCell>{c.totalClicked}</TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="sm" onClick={() => setShowDetail(c.id)}>
                      <Eye className="w-4 h-4" />
                    </Button>
                    {(c.status === "draft" || c.status === "paused") && (
                      <Button variant="ghost" size="sm" title="Edit campaign" onClick={() => openEdit(c.id)}>
                        <Pencil className="w-4 h-4" />
                      </Button>
                    )}
                    {c.status === "draft" && (
                      <Button variant="ghost" size="sm" onClick={() => {
                        if (confirm(`Send campaign "${c.name}" to all matching recipients?`))
                          sendMutation.mutate({ id: c.id });
                      }}>
                        <Play className="w-4 h-4 text-green-600" />
                      </Button>
                    )}
                    {c.status === "sending" && (
                      <Button variant="ghost" size="sm" onClick={() => pauseMutation.mutate({ id: c.id })}>
                        <Pause className="w-4 h-4 text-yellow-600" />
                      </Button>
                    )}
                    {c.status === "paused" && (
                      <Button variant="ghost" size="sm" onClick={() => {
                        if (confirm(`Resume sending "${c.name}"?`))
                          sendMutation.mutate({ id: c.id });
                      }}>
                        <Play className="w-4 h-4 text-green-600" />
                      </Button>
                    )}
                    {(c.status === "draft" || c.status === "cancelled") && (
                      <Button variant="ghost" size="sm" onClick={() => {
                        if (confirm(`Delete campaign "${c.name}"?`))
                          deleteMutation.mutate({ id: c.id });
                      }}>
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Create Campaign Dialog */}
      <Dialog open={showCreate} onOpenChange={open => { if (!open) closeForm(); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? "Edit Email Campaign" : "Create Email Campaign"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            {recipientsLocked && (
              <p className="rounded-md border bg-muted/40 p-3 text-sm">
                This campaign is paused. Changes to the subject, body and batch settings apply to the emails it still has to send. The audience and recipient filters can't change once sending has started.
              </p>
            )}
            <div>
              <label className="text-sm font-medium mb-1 block">Audience</label>
              <Select disabled={recipientsLocked} value={form.audience} onValueChange={(v: any) => setForm(f => ({ ...f, audience: v, filterBrokerage: "", filterCity: "", filterLoanType: "", filterTag: "" }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="re_agent">Real Estate Agent</SelectItem>
                  <SelectItem value="past_mortgage">Past Mortgage Client</SelectItem>
                  <SelectItem value="prospective_mortgage">Prospective Mortgage Client</SelectItem>
                  <SelectItem value="prospective_re_client">Prospective Real Estate Client</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Input placeholder="Campaign Name *" value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            <Input placeholder="Email Subject *" value={form.subject}
              onChange={e => setForm(f => ({ ...f, subject: e.target.value }))} />
            <Input placeholder="From Name" value={form.fromName}
              onChange={e => setForm(f => ({ ...f, fromName: e.target.value }))} />

            <div>
              <label className="text-sm font-medium mb-1 block">Email Body (HTML)</label>
              <Textarea placeholder="<h2>Hello {{first_name}},</h2><p>...</p>" value={form.bodyHtml}
                onChange={e => setForm(f => ({ ...f, bodyHtml: e.target.value }))} rows={8} />
              <p className="text-xs text-muted-foreground mt-1">
                Variables: {"{{first_name}}"}, {"{{last_name}}"}, {"{{full_name}}"}
              </p>
            </div>

            {!recipientsLocked && (<div className="border-t pt-4">
              <h3 className="text-sm font-medium mb-3">Recipient Filters</h3>
              <div className="grid grid-cols-3 gap-3">
                {form.audience === "re_agent" && (
                  <div>
                    <label className="text-xs text-muted-foreground">Tag</label>
                    <Select value={form.filterTag || "__all__"} onValueChange={v => setForm(f => ({ ...f, filterTag: v === "__all__" ? "" : v }))}>
                      <SelectTrigger><SelectValue placeholder="Any tag" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__all__">Any tag</SelectItem>
                        {agentTags.data?.map(t => <SelectItem key={t.tag} value={t.tag}>{t.tag} ({t.count})</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                {form.audience === "re_agent" && (
                  <div>
                    <label className="text-xs text-muted-foreground">Brokerage</label>
                    <Select value={form.filterBrokerage} onValueChange={v => setForm(f => ({ ...f, filterBrokerage: v === "__all__" ? "" : v }))}>
                      <SelectTrigger><SelectValue placeholder="All brokerages" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__all__">All brokerages</SelectItem>
                        {brokerages.data?.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                {form.audience === "past_mortgage" && (
                  <div>
                    <label className="text-xs text-muted-foreground">Loan Type</label>
                    <Select value={form.filterLoanType} onValueChange={v => setForm(f => ({ ...f, filterLoanType: v === "__all__" ? "" : v }))}>
                      <SelectTrigger><SelectValue placeholder="All types" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__all__">All types</SelectItem>
                        {loanTypes.data?.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                {(form.audience === "re_agent" || form.audience === "past_mortgage") && (
                  <div>
                    <label className="text-xs text-muted-foreground">City</label>
                    <Select value={form.filterCity} onValueChange={v => setForm(f => ({ ...f, filterCity: v === "__all__" ? "" : v }))}>
                      <SelectTrigger><SelectValue placeholder="All cities" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__all__">All cities</SelectItem>
                        {(form.audience === "re_agent" ? agentCities : mcCities).data?.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                {(form.audience === "re_agent" || form.audience === "past_mortgage") && (
                  <div>
                    <label className="text-xs text-muted-foreground">State</label>
                    <Input placeholder="e.g. UT" maxLength={2} value={form.filterState}
                      onChange={e => setForm(f => ({ ...f, filterState: e.target.value.toUpperCase() }))} />
                  </div>
                )}
                {(form.audience === "prospective_mortgage" || form.audience === "prospective_re_client") && (
                  <p className="text-xs text-muted-foreground col-span-3">
                    Targets all leads in the system. Additional lead filters coming soon.
                  </p>
                )}
              </div>
              {previewCount.data && (
                <p className="text-sm mt-2">
                  <Mail className="w-4 h-4 inline mr-1" />
                  <strong>{previewCount.data.count}</strong> matching {form.audience === "re_agent" ? "agents" : form.audience === "past_mortgage" ? "past clients" : "leads"}
                  {(form.audience === "re_agent" || form.audience === "past_mortgage") && (
                    <span className="text-muted-foreground"> · opted-out contacts are always left out, and every email carries an unsubscribe link</span>
                  )}
                </p>
              )}
              {previewCount.data && (
                <p className="text-xs text-muted-foreground mt-1">
                  {(form.audience === "re_agent" || form.audience === "prospective_re_client") && bulkUsage.data?.active
                    ? <>Sends from <strong>{bulkUsage.data.fromEmail}</strong>, {bulkUsage.data.dailyLimit} per day
                        {previewCount.data.count > bulkUsage.data.dailyLimit
                          ? ` — about ${Math.ceil(previewCount.data.count / bulkUsage.data.dailyLimit)} days for everyone. It carries on by itself each day.`
                          : "."}</>
                    : "Sends from your Gmail account."}
                </p>
              )}
            </div>)}

            <div className="border-t pt-4">
              <h3 className="text-sm font-medium mb-3">Batch Settings</h3>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground">Batch Size</label>
                  <Input type="number" min={1} max={200} value={form.batchSize}
                    onChange={e => setForm(f => ({ ...f, batchSize: parseInt(e.target.value) || 50 }))} />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Delay Between Batches (minutes)</label>
                  <Input type="number" min={1} max={120} value={form.batchDelayMinutes}
                    onChange={e => setForm(f => ({ ...f, batchDelayMinutes: parseInt(e.target.value) || 15 }))} />
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeForm}>Cancel</Button>
            {editing ? (
              <Button disabled={!form.name || !form.subject || !form.bodyHtml || updateMutation.isPending} onClick={saveEdit}>
                {updateMutation.isPending ? "Saving..." : "Save Changes"}
              </Button>
            ) : (
            <Button disabled={!form.name || !form.subject || !form.bodyHtml || createMutation.isPending}
              onClick={() => createMutation.mutate({
                ...form,
                filterTags: form.audience === "re_agent" && form.filterTag ? [form.filterTag] : undefined,
                filterBrokerage: form.filterBrokerage || undefined,
                filterCity: form.filterCity || undefined,
                filterState: form.filterState || undefined,
                filterLoanType: form.filterLoanType || undefined,
              })}>
              {createMutation.isPending ? "Creating..." : "Create Campaign"}
            </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Campaign Detail Dialog */}
      <Dialog open={showDetail !== null} onOpenChange={() => setShowDetail(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{detail.data?.name}</DialogTitle></DialogHeader>
          {detail.data && (
            <div className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground">Subject</p>
                <p className="font-medium">{detail.data.subject}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Status</p>
                <Badge variant={STATUS_COLORS[detail.data.status] as any}>{detail.data.status}</Badge>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <Card>
                  <CardHeader className="pb-1"><CardTitle className="text-xs text-muted-foreground">Sent</CardTitle></CardHeader>
                  <CardContent><span className="text-xl font-bold">{detail.data.totalSent}</span><span className="text-muted-foreground">/{detail.data.totalRecipients}</span></CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-1"><CardTitle className="text-xs text-muted-foreground">Open Rate</CardTitle></CardHeader>
                  <CardContent><span className="text-xl font-bold">{(detail.data.totalSent ?? 0) > 0 ? Math.round(((detail.data.totalOpened ?? 0) / (detail.data.totalSent ?? 1)) * 100) : 0}%</span></CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-1"><CardTitle className="text-xs text-muted-foreground">Click Rate</CardTitle></CardHeader>
                  <CardContent><span className="text-xl font-bold">{(detail.data.totalSent ?? 0) > 0 ? Math.round(((detail.data.totalClicked ?? 0) / (detail.data.totalSent ?? 1)) * 100) : 0}%</span></CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-1"><CardTitle className="text-xs text-muted-foreground">Bounced</CardTitle></CardHeader>
                  <CardContent><span className="text-xl font-bold">{detail.data.totalBounced}</span></CardContent>
                </Card>
              </div>
              {detail.data.recipientStats && (
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Recipient Breakdown</p>
                  <div className="flex gap-2 flex-wrap">
                    {Object.entries(detail.data.recipientStats).map(([k, v]) => (
                      v > 0 && <Badge key={k} variant="outline">{k}: {v}</Badge>
                    ))}
                  </div>
                </div>
              )}
              {detail.data.pacing && (
                <div className="rounded-md border bg-muted/40 p-3 text-sm space-y-0.5">
                  <p>Sending from <strong>{detail.data.pacing.sender}</strong>, up to {detail.data.pacing.dailyLimit} per day.</p>
                  <p className="text-muted-foreground">
                    {detail.data.pacing.sentLast24h} sent in the last 24 hours
                    {detail.data.pacing.remainingToday === 0 && detail.data.pacing.nextSlotAt
                      ? ` · today's limit is used; sending resumes ${new Date(detail.data.pacing.nextSlotAt).toLocaleString()}`
                      : ` · ${detail.data.pacing.remainingToday} more allowed now`}
                  </p>
                  {detail.data.pacing.estimatedFinish && detail.data.recipientStats.pending > 0 && (
                    <p className="text-muted-foreground">
                      {detail.data.recipientStats.pending} still to send · expected to finish around {new Date(detail.data.pacing.estimatedFinish).toLocaleDateString()}
                    </p>
                  )}
                </div>
              )}
              <div>
                <p className="text-sm text-muted-foreground mb-1">Batch Settings</p>
                <p className="text-sm">{detail.data.batchSize} emails per batch, {detail.data.batchDelayMinutes} min delay</p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
