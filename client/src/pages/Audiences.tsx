import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Target, Plus, RefreshCw, Trash2, Loader2, Globe, ListChecks } from "lucide-react";
import { toast } from "sonner";

const STAGES: { value: string; label: string }[] = [
  { value: "new_lead", label: "New lead" },
  { value: "registered", label: "Registered" },
  { value: "attended", label: "Attended" },
  { value: "no_show", label: "No show" },
  { value: "consultation_booked", label: "Consultation booked" },
  { value: "under_contract", label: "Under contract" },
  { value: "closed", label: "Closed" },
];
const stageLabel = (v: string) => STAGES.find((s) => s.value === v)?.label ?? v;

type Source = "leads" | "agents" | "past_clients";
type Form =
  | { kind: "website"; name: string; days: string; landingPageSlug: string; excludeConverters: boolean }
  | { kind: "crm_list"; name: string; source: Source; stages: string[]; tag: string };

const PRESETS: { label: string; hint: string; form: Form }[] = [
  {
    label: "Visited a landing page, didn't apply",
    hint: "Retarget: last 30 days",
    form: { kind: "website", name: "Landing page visitors – no application (30 days)", days: "30", landingPageSlug: "", excludeConverters: true },
  },
  {
    label: "Leads who haven't booked yet",
    hint: "Retarget: CRM leads",
    form: { kind: "crm_list", name: "Leads – not yet booked", source: "leads", stages: ["new_lead", "registered", "attended", "no_show"], tag: "" },
  },
  {
    label: "Already converted",
    hint: "Leave out of prospecting ads",
    form: { kind: "crm_list", name: "Converted – leave out", source: "leads", stages: ["consultation_booked", "under_contract", "closed"], tag: "" },
  },
  {
    label: "Past clients",
    hint: "Referrals and refinance",
    form: { kind: "crm_list", name: "Past clients", source: "past_clients", stages: [], tag: "" },
  },
];

function describe(def: any): string {
  if (def?.kind === "website") {
    const where = def.landingPageSlug ? `/lp/${def.landingPageSlug}` : "any landing page";
    return `Visited ${where} in the last ${def.days} days${def.excludeConverters ? ", didn't submit a lead form" : ""}`;
  }
  if (def?.source === "leads") {
    return def.stages?.length ? `Leads in: ${def.stages.map(stageLabel).join(", ")}` : "All leads";
  }
  const who = def?.source === "agents" ? "Agents" : "Past clients";
  return `${who}${def?.tag ? ` tagged "${def.tag}"` : ""}, opted-out left out`;
}

function sizeText(a: { sizeLow: number | null; sizeHigh: number | null }) {
  if (a.sizeLow == null && a.sizeHigh == null) return "Meta is still sizing it";
  if (a.sizeHigh != null && a.sizeLow != null && a.sizeHigh > a.sizeLow) {
    return `${a.sizeLow.toLocaleString()}–${a.sizeHigh.toLocaleString()} people`;
  }
  return `about ${(a.sizeLow ?? a.sizeHigh)!.toLocaleString()} people`;
}

const STATUS: Record<string, { label: string; className: string }> = {
  ready: { label: "In sync", className: "bg-green-100 text-green-800" },
  syncing: { label: "Syncing", className: "bg-blue-100 text-blue-800" },
  pending: { label: "Not in Meta yet", className: "bg-gray-100 text-gray-700" },
  error: { label: "Sync failed", className: "bg-red-100 text-red-800" },
};

export default function Audiences() {
  const utils = trpc.useUtils();
  const { data: audiences = [], isLoading } = trpc.audiences.list.useQuery();
  const [form, setForm] = useState<Form | null>(null);

  const sync = trpc.audiences.sync.useMutation({
    onSuccess: (row) => {
      utils.audiences.list.invalidate();
      if (row?.status === "error") toast.error(row.lastError ?? "Sync failed");
      else toast.success("Synced to Meta");
    },
    onError: (e) => toast.error(e.message),
  });
  const remove = trpc.audiences.delete.useMutation({
    onSuccess: () => { utils.audiences.list.invalidate(); toast.success("Audience deleted"); },
    onError: (e) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Target className="h-6 w-6 text-brand-green" /> Audiences
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Who your Facebook ads retarget or leave out. CRM lists re-sync to Meta every day.
          </p>
        </div>
        <Button onClick={() => setForm(PRESETS[0].form)}>
          <Plus className="h-4 w-4 mr-1" /> New audience
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : audiences.length === 0 ? (
        <Card>
          <CardContent className="p-6 space-y-4">
            <p className="text-sm text-muted-foreground">Start from one of these. You can rename or adjust it before saving.</p>
            <div className="grid gap-3 sm:grid-cols-2">
              {PRESETS.map((p) => (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => setForm(p.form)}
                  className="rounded-lg border p-4 text-left hover:bg-muted/50 transition-colors"
                >
                  <div className="font-medium text-sm">{p.label}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{p.hint}</div>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {audiences.map((a) => {
            const status = STATUS[a.status] ?? STATUS.pending;
            const busy = (sync.isPending && sync.variables?.id === a.id) || a.status === "syncing";
            return (
              <Card key={a.id}>
                <CardContent className="p-4 flex flex-col sm:flex-row sm:items-start gap-3">
                  <div className="shrink-0 mt-0.5 text-muted-foreground">
                    {a.kind === "website" ? <Globe className="h-5 w-5" /> : <ListChecks className="h-5 w-5" />}
                  </div>
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{a.name}</span>
                      <Badge variant="secondary" className={status.className}>{status.label}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{describe(a.definition)}</p>
                    <p className="text-xs text-muted-foreground">
                      {a.kind === "crm_list" && a.memberCount != null && `${a.memberCount.toLocaleString()} contacts uploaded · `}
                      {a.metaAudienceId && `${sizeText(a)} · `}
                      {a.lastSyncedAt ? `Synced ${new Date(a.lastSyncedAt).toLocaleString()}` : "Never synced"}
                    </p>
                    {a.usedBy.length > 0 && (
                      <p className="text-xs text-muted-foreground">Used by: {a.usedBy.map((c) => c.name).join(", ")}</p>
                    )}
                    {a.status === "error" && a.lastError && <p className="text-xs text-red-600">{a.lastError}</p>}
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <Button size="sm" variant="outline" disabled={busy} onClick={() => sync.mutate({ id: a.id })}>
                      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                      <span className="ml-1">Sync now</span>
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      aria-label={`Delete ${a.name}`}
                      disabled={remove.isPending}
                      onClick={() => {
                        if (confirm(`Delete "${a.name}" here and in Meta?`)) remove.mutate({ id: a.id });
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <AudienceDialog form={form} onClose={() => setForm(null)} onChange={setForm} />
    </div>
  );
}

function AudienceDialog({ form, onChange, onClose }: { form: Form | null; onChange: (f: Form) => void; onClose: () => void }) {
  const utils = trpc.useUtils();
  const { data: pages = [] } = trpc.marketing.landingPagePicker.useQuery(undefined, { enabled: !!form });
  const { data: agentTags = [] } = trpc.agentContacts.tags.useQuery(undefined, {
    enabled: form?.kind === "crm_list" && form.source === "agents",
  });
  const list = form?.kind === "crm_list" ? form : null;
  const preview = trpc.audiences.previewList.useQuery(
    { source: list?.source ?? "leads", stages: list?.stages as any, tag: list?.tag || null },
    { enabled: !!list },
  );

  const create = trpc.audiences.create.useMutation({
    onSuccess: (row) => {
      utils.audiences.list.invalidate();
      if (row?.status === "error") toast.error(`Saved, but Meta sync failed: ${row.lastError}`);
      else toast.success("Audience created in Meta");
      onClose();
    },
    onError: (e) => toast.error(e.message),
  });

  if (!form) return null;

  const submit = () => {
    const definition = form.kind === "website"
      ? {
          kind: "website" as const,
          days: Math.min(180, Math.max(1, Number(form.days) || 30)),
          landingPageSlug: form.landingPageSlug || null,
          excludeConverters: form.excludeConverters,
        }
      : {
          kind: "crm_list" as const,
          source: form.source,
          stages: form.source === "leads" ? (form.stages as any) : undefined,
          tag: form.source !== "leads" ? form.tag || null : null,
        };
    create.mutate({ name: form.name, definition });
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>New audience</DialogTitle>
          <DialogDescription>Created in your Meta ad account as a Custom Audience.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {PRESETS.map((p) => (
              <Button key={p.label} type="button" size="sm" variant="outline" className="h-7 text-xs" onClick={() => onChange(p.form)}>
                {p.label}
              </Button>
            ))}
          </div>

          <div className="space-y-1.5">
            <Label>Name</Label>
            <Input value={form.name} onChange={(e) => onChange({ ...form, name: e.target.value })} />
          </div>

          <div className="space-y-1.5">
            <Label>Who</Label>
            <Select
              value={form.kind === "website" ? "website" : form.source}
              onValueChange={(v) =>
                onChange(v === "website"
                  ? { kind: "website", name: form.name, days: "30", landingPageSlug: "", excludeConverters: true }
                  : { kind: "crm_list", name: form.name, source: v as Source, stages: [], tag: "" })
              }
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="website">Website visitors (from your Meta Pixel)</SelectItem>
                <SelectItem value="leads">CRM leads</SelectItem>
                <SelectItem value="agents">Agent contacts</SelectItem>
                <SelectItem value="past_clients">Past mortgage clients</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {form.kind === "website" ? (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Visited in the last</Label>
                  <div className="flex items-center gap-2">
                    <Input type="number" min={1} max={180} value={form.days} onChange={(e) => onChange({ ...form, days: e.target.value })} />
                    <span className="text-sm text-muted-foreground">days</span>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>Page</Label>
                  <Select value={form.landingPageSlug || "__all"} onValueChange={(v) => onChange({ ...form, landingPageSlug: v === "__all" ? "" : v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__all">Any landing page</SelectItem>
                      {pages.map((p) => <SelectItem key={p.id} value={p.slug}>{p.title}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <label className="flex items-center justify-between gap-3 text-sm">
                <span>Leave out people who submitted the form</span>
                <Switch checked={form.excludeConverters} onCheckedChange={(v) => onChange({ ...form, excludeConverters: v })} />
              </label>
              <p className="text-xs text-muted-foreground">
                Meta fills this from visits it has already seen, up to 180 days back. It needs about 100 people before ads can use it.
              </p>
            </>
          ) : (
            <>
              {form.source === "leads" ? (
                <div className="space-y-1.5">
                  <Label>Stages (none ticked = all leads)</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {STAGES.map((s) => (
                      <label key={s.value} className="flex items-center gap-2 text-sm">
                        <Checkbox
                          checked={form.stages.includes(s.value)}
                          onCheckedChange={(v) =>
                            onChange({ ...form, stages: v === true ? [...form.stages, s.value] : form.stages.filter((x) => x !== s.value) })
                          }
                        />
                        {s.label}
                      </label>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="space-y-1.5">
                  <Label>Tag (optional)</Label>
                  {form.source === "agents" && agentTags.length > 0 ? (
                    <Select value={form.tag || "__all"} onValueChange={(v) => onChange({ ...form, tag: v === "__all" ? "" : v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__all">Everyone</SelectItem>
                        {agentTags.map((t) => <SelectItem key={t.tag} value={t.tag}>{t.tag} ({t.count})</SelectItem>)}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input value={form.tag} placeholder="Everyone" onChange={(e) => onChange({ ...form, tag: e.target.value })} />
                  )}
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                {preview.isLoading
                  ? "Counting…"
                  : preview.data
                    ? `${preview.data.contacts.toLocaleString()} contacts, ${preview.data.matchable.toLocaleString()} with an email or phone to upload.`
                    : ""}{" "}
                Uploaded hashed; Meta never sees the raw emails or phones. Opted-out contacts are never included.
              </p>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} disabled={create.isPending || !form.name.trim()}>
            {create.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />} Create audience
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
