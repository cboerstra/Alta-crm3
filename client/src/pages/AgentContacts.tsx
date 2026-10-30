import { useState, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Plus, Upload, Search, Trash2, Users, UserX, UserCheck, Pencil, Tag, X, FileSpreadsheet, CheckCircle2, AlertTriangle,
} from "lucide-react";
import { readContactCsv, cleanTag, type ContactImport, type ContactField } from "@shared/csv";

type Contact = {
  id: number; firstName: string; lastName: string; email: string; phone: string | null;
  brokerage: string | null; licenseNumber: string | null; city: string | null; state: string | null;
  tags: unknown; optedOut: boolean; optOutDate: Date | string | null;
};

function tagsOf(c: { tags: unknown }): string[] {
  return Array.isArray(c.tags) ? (c.tags as unknown[]).filter((t): t is string => typeof t === "string") : [];
}

const FIELD_LABELS: Record<ContactField, string> = {
  firstName: "First name", lastName: "Last name", fullName: "Full name", email: "Email", phone: "Phone",
  brokerage: "Brokerage", licenseNumber: "License #", city: "City", state: "State",
};

const ALL = "__all__";

export default function AgentContacts() {
  const utils = trpc.useUtils();
  const [search, setSearch] = useState("");
  const [tagFilter, setTagFilter] = useState(ALL);
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "optedOut">("all");
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<Contact | null>(null);
  const [showImport, setShowImport] = useState(false);
  const [bulkTag, setBulkTag] = useState("");
  const [form, setForm] = useState({
    firstName: "", lastName: "", email: "", phone: "",
    brokerage: "", licenseNumber: "", city: "", state: "UT",
  });

  const { data, isLoading } = trpc.agentContacts.list.useQuery({
    search: search || undefined,
    tag: tagFilter === ALL ? undefined : tagFilter,
    optedOut: statusFilter === "all" ? undefined : statusFilter === "optedOut",
    limit: 50, offset: page * 50,
  });
  const stats = trpc.agentContacts.stats.useQuery();
  const tags = trpc.agentContacts.tags.useQuery();

  const invalidate = () => utils.agentContacts.invalidate();
  const createMutation = trpc.agentContacts.create.useMutation({
    onSuccess: () => { invalidate(); setShowCreate(false); resetForm(); },
  });
  const deleteMutation = trpc.agentContacts.delete.useMutation({
    onSuccess: () => { invalidate(); setSelected(new Set()); },
  });
  const bulkMutation = trpc.agentContacts.bulkUpdate.useMutation({
    onSuccess: () => { invalidate(); setBulkTag(""); },
  });

  function resetForm() {
    setForm({ firstName: "", lastName: "", email: "", phone: "", brokerage: "", licenseNumber: "", city: "", state: "UT" });
  }

  const contacts = (data?.contacts ?? []) as Contact[];
  const pageIds = contacts.map((c) => c.id);
  const allOnPageSelected = pageIds.length > 0 && pageIds.every((id) => selected.has(id));
  const toggle = (id: number) => setSelected((prev) => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });
  const selectedIds = Array.from(selected);
  const resetPaging = () => { setPage(0); setSelected(new Set()); };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-bold">Agent Contacts</h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowImport(true)}>
            <Upload className="w-4 h-4 mr-2" /> Import CSV
          </Button>
          <Button onClick={() => setShowCreate(true)}>
            <Plus className="w-4 h-4 mr-2" /> Add Contact
          </Button>
        </div>
      </div>

      {stats.data && (
        <div className="grid grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Total Contacts</CardTitle></CardHeader>
            <CardContent><div className="flex items-center gap-2"><Users className="w-5 h-5 text-blue-500" /><span className="text-2xl font-bold">{stats.data.total}</span></div></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Active</CardTitle></CardHeader>
            <CardContent><div className="flex items-center gap-2"><UserCheck className="w-5 h-5 text-green-500" /><span className="text-2xl font-bold">{stats.data.active}</span></div></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Opted Out</CardTitle></CardHeader>
            <CardContent><div className="flex items-center gap-2"><UserX className="w-5 h-5 text-red-500" /><span className="text-2xl font-bold">{stats.data.optedOut}</span></div></CardContent>
          </Card>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-2 flex-1 min-w-[220px] max-w-md">
          <Search className="w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search by name, email, or brokerage..." value={search}
            onChange={(e) => { setSearch(e.target.value); resetPaging(); }} />
        </div>
        <Select value={tagFilter} onValueChange={(v) => { setTagFilter(v); resetPaging(); }}>
          <SelectTrigger className="w-[200px]"><Tag className="w-3.5 h-3.5 mr-1" /><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All tags</SelectItem>
            {(tags.data ?? []).map((t) => (
              <SelectItem key={t.tag} value={t.tag}>{t.tag} ({t.count})</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={(v: any) => { setStatusFilter(v); resetPaging(); }}>
          <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Any status</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="optedOut">Opted out</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {selected.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-md border bg-muted/40 px-3 py-2 text-sm">
          <span className="font-medium">{selected.size} selected</span>
          <Input
            placeholder="Tag, e.g. Ogden agents"
            value={bulkTag}
            onChange={(e) => setBulkTag(e.target.value)}
            list="agent-tag-options"
            className="h-8 w-[200px]"
          />
          <Button size="sm" variant="outline" disabled={!cleanTag(bulkTag) || bulkMutation.isPending}
            onClick={() => bulkMutation.mutate({ ids: selectedIds, addTag: bulkTag })}>
            <Tag className="w-3.5 h-3.5 mr-1" /> Add tag
          </Button>
          <Button size="sm" variant="outline" disabled={!cleanTag(bulkTag) || bulkMutation.isPending}
            onClick={() => bulkMutation.mutate({ ids: selectedIds, removeTag: bulkTag })}>
            Remove tag
          </Button>
          <Button size="sm" variant="outline" disabled={bulkMutation.isPending}
            onClick={() => bulkMutation.mutate({ ids: selectedIds, optedOut: true })}>
            <UserX className="w-3.5 h-3.5 mr-1" /> Mark opted out
          </Button>
          <Button size="sm" variant="outline" disabled={bulkMutation.isPending}
            onClick={() => bulkMutation.mutate({ ids: selectedIds, optedOut: false })}>
            <UserCheck className="w-3.5 h-3.5 mr-1" /> Mark active
          </Button>
          <Button size="sm" variant="ghost" className="text-destructive" disabled={deleteMutation.isPending}
            onClick={() => { if (confirm(`Delete ${selected.size} contact(s)?`)) deleteMutation.mutate({ ids: selectedIds }); }}>
            <Trash2 className="w-3.5 h-3.5 mr-1" /> Delete
          </Button>
          <Button size="sm" variant="ghost" className="ml-auto" onClick={() => setSelected(new Set())}>Clear</Button>
        </div>
      )}
      <datalist id="agent-tag-options">
        {(tags.data ?? []).map((t) => <option key={t.tag} value={t.tag} />)}
      </datalist>

      <div className="border rounded-md">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8">
                <Checkbox
                  aria-label="Select all on this page"
                  checked={allOnPageSelected}
                  onCheckedChange={(v) => setSelected((prev) => {
                    const next = new Set(prev);
                    pageIds.forEach((id) => (v ? next.add(id) : next.delete(id)));
                    return next;
                  })}
                />
              </TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Brokerage</TableHead>
              <TableHead>Tags</TableHead>
              <TableHead>Status</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={8} className="text-center py-8">Loading...</TableCell></TableRow>
            ) : contacts.length === 0 ? (
              <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">No contacts found</TableCell></TableRow>
            ) : contacts.map((c) => (
              <TableRow key={c.id} data-state={selected.has(c.id) ? "selected" : undefined}>
                <TableCell>
                  <Checkbox aria-label={`Select ${c.firstName} ${c.lastName}`} checked={selected.has(c.id)} onCheckedChange={() => toggle(c.id)} />
                </TableCell>
                <TableCell className="font-medium">{c.firstName} {c.lastName}</TableCell>
                <TableCell>{c.email}</TableCell>
                <TableCell>{c.phone || "—"}</TableCell>
                <TableCell>{c.brokerage || "—"}</TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {tagsOf(c).map((t) => <Badge key={t} variant="outline" className="font-normal">{t}</Badge>)}
                  </div>
                </TableCell>
                <TableCell>
                  {c.optedOut
                    ? <Badge variant="destructive">Opted Out</Badge>
                    : <Badge variant="secondary">Active</Badge>}
                </TableCell>
                <TableCell className="whitespace-nowrap">
                  <Button variant="ghost" size="sm" aria-label={`Edit ${c.firstName} ${c.lastName}`} onClick={() => setEditing(c)}>
                    <Pencil className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="sm" aria-label={`Delete ${c.firstName} ${c.lastName}`} onClick={() => {
                    if (confirm(`Delete ${c.firstName} ${c.lastName}?`))
                      deleteMutation.mutate({ ids: [c.id] });
                  }}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {data && data.total > 50 && (
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">
            Showing {page * 50 + 1}–{Math.min((page + 1) * 50, data.total)} of {data.total}
          </span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(p => p - 1)}>Previous</Button>
            <Button variant="outline" size="sm" disabled={(page + 1) * 50 >= data.total} onClick={() => setPage(p => p + 1)}>Next</Button>
          </div>
        </div>
      )}

      {/* Create Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Agent Contact</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <Input placeholder="First Name *" value={form.firstName} onChange={e => setForm(f => ({ ...f, firstName: e.target.value }))} />
            <Input placeholder="Last Name *" value={form.lastName} onChange={e => setForm(f => ({ ...f, lastName: e.target.value }))} />
            <Input placeholder="Email *" type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} className="col-span-2" />
            <Input placeholder="Phone" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
            <Input placeholder="Brokerage" value={form.brokerage} onChange={e => setForm(f => ({ ...f, brokerage: e.target.value }))} />
            <Input placeholder="License #" value={form.licenseNumber} onChange={e => setForm(f => ({ ...f, licenseNumber: e.target.value }))} />
            <Input placeholder="City" value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button disabled={!form.firstName || !form.lastName || !form.email || createMutation.isPending}
              onClick={() => createMutation.mutate(form)}>
              {createMutation.isPending ? "Creating..." : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {editing && (
        <EditContactDialog
          contact={editing}
          tagOptions={(tags.data ?? []).map((t) => t.tag)}
          onClose={() => setEditing(null)}
          onSaved={() => { invalidate(); setEditing(null); }}
        />
      )}

      <ImportDialog
        open={showImport}
        onOpenChange={setShowImport}
        tagOptions={(tags.data ?? []).map((t) => t.tag)}
        onImported={invalidate}
      />
    </div>
  );
}

function EditContactDialog({
  contact, tagOptions, onClose, onSaved,
}: {
  contact: Contact;
  tagOptions: string[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    firstName: contact.firstName, lastName: contact.lastName, email: contact.email,
    phone: contact.phone ?? "", brokerage: contact.brokerage ?? "", licenseNumber: contact.licenseNumber ?? "",
    city: contact.city ?? "", state: contact.state ?? "UT",
  });
  const [tags, setTags] = useState<string[]>(tagsOf(contact));
  const [newTag, setNewTag] = useState("");
  const [optedOut, setOptedOut] = useState(contact.optedOut);
  const update = trpc.agentContacts.update.useMutation({ onSuccess: onSaved });

  const addTag = () => {
    const t = cleanTag(newTag);
    if (t && !tags.includes(t)) setTags([...tags, t]);
    setNewTag("");
  };
  const field = (key: keyof typeof form, placeholder: string, extra = "") => (
    <Input placeholder={placeholder} value={form[key]} className={extra}
      onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))} />
  );

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Edit {contact.firstName} {contact.lastName}</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          {field("firstName", "First Name *")}
          {field("lastName", "Last Name")}
          {field("email", "Email *", "col-span-2")}
          {field("phone", "Phone")}
          {field("brokerage", "Brokerage")}
          {field("licenseNumber", "License #")}
          {field("city", "City")}
        </div>

        <div className="space-y-2">
          <Label>Tags</Label>
          <div className="flex flex-wrap gap-1">
            {tags.length === 0 && <span className="text-xs text-muted-foreground">No tags yet.</span>}
            {tags.map((t) => (
              <Badge key={t} variant="outline" className="gap-1 font-normal">
                {t}
                <button type="button" aria-label={`Remove tag ${t}`} onClick={() => setTags(tags.filter((x) => x !== t))}>
                  <X className="w-3 h-3" />
                </button>
              </Badge>
            ))}
          </div>
          <div className="flex gap-2">
            <Input placeholder="Add a tag, e.g. Ogden agents" value={newTag} list="agent-edit-tag-options"
              onChange={(e) => setNewTag(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTag(); } }} />
            <Button type="button" variant="outline" onClick={addTag} disabled={!cleanTag(newTag)}>Add</Button>
          </div>
          <datalist id="agent-edit-tag-options">{tagOptions.map((t) => <option key={t} value={t} />)}</datalist>
        </div>

        <div className="flex items-start justify-between gap-4 rounded-md border p-3">
          <div>
            <Label htmlFor="edit-opted-out">Opted out of emails</Label>
            <p className="text-xs text-muted-foreground mt-0.5">
              Opted-out agents are left out of every email campaign. Turn this back on only if they asked to be included again.
            </p>
          </div>
          <Switch id="edit-opted-out" checked={optedOut} onCheckedChange={setOptedOut} />
        </div>

        {update.error && <p className="text-sm text-destructive">{update.error.message}</p>}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            // Imports can leave the last name blank, so only first name and email are required here.
            disabled={!form.firstName || !form.email || update.isPending}
            onClick={() => update.mutate({ id: contact.id, ...form, tags, optedOut })}
          >
            {update.isPending ? "Saving..." : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ImportDialog({
  open, onOpenChange, tagOptions, onImported,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tagOptions: string[];
  onImported: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState("");
  const [parsed, setParsed] = useState<ContactImport | null>(null);
  const [readError, setReadError] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [tag, setTag] = useState("");
  const importMutation = trpc.agentContacts.importCsv.useMutation({ onSuccess: onImported });

  const reset = () => {
    setFileName(""); setParsed(null); setReadError(""); setTag(""); importMutation.reset();
  };
  const close = (next: boolean) => { if (!next) reset(); onOpenChange(next); };

  const readFile = (file: File | undefined) => {
    if (!file) return;
    setReadError(""); importMutation.reset();
    if (!/\.csv$/i.test(file.name) && file.type !== "text/csv") {
      setReadError(`${file.name} isn't a CSV file. In Excel or Google Sheets, use File → Save as / Download → CSV.`);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const result = readContactCsv(String(reader.result ?? ""));
      setFileName(file.name);
      setParsed(result);
    };
    reader.onerror = () => setReadError("Could not read that file.");
    reader.readAsText(file);
  };

  const found = parsed ? (Object.keys(parsed.columns) as ContactField[]) : [];
  const hasEmailColumn = parsed?.columns.email !== undefined;
  const hasName = found.includes("firstName") || found.includes("lastName") || found.includes("fullName");
  const result = importMutation.data;

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Import Agent Contacts from CSV</DialogTitle>
          <DialogDescription>
            Any columns in any order. An email column is required; name, phone, brokerage, license #, city and state are
            picked up when present. Agents already on your list are not duplicated.
          </DialogDescription>
        </DialogHeader>

        {result ? (
          <div className="space-y-3 text-sm">
            <div className="flex items-start gap-2 rounded-md border border-green-200 bg-green-50 p-3 text-green-900">
              <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" />
              <div>
                <div className="font-medium">{result.imported} new agent{result.imported === 1 ? "" : "s"} added.</div>
                {result.skipped > 0 && (
                  <div>{result.skipped} already on your list{tag ? ` (${result.tagged} of them newly tagged "${cleanTag(tag)}")` : ""}.</div>
                )}
                {parsed && parsed.skippedRows.length > 0 && (
                  <div>{parsed.skippedRows.length} row{parsed.skippedRows.length === 1 ? "" : "s"} skipped for having no valid email.</div>
                )}
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={reset}>Import another file</Button>
              <Button onClick={() => close(false)}>Done</Button>
            </DialogFooter>
          </div>
        ) : (
          <>
            {/* A real, focusable drop zone over a hidden <input>: the bare input
                was easy to miss inside the dialog and took no drops. */}
            <div
              role="button"
              tabIndex={0}
              aria-label="Choose a CSV file"
              onClick={() => inputRef.current?.click()}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); inputRef.current?.click(); } }}
              onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setDragOver(true); }}
              onDragEnter={(e) => { e.preventDefault(); e.stopPropagation(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => { e.preventDefault(); e.stopPropagation(); setDragOver(false); readFile(e.dataTransfer.files?.[0]); }}
              className={`flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed px-4 py-6 text-center transition-colors ${
                dragOver ? "border-primary bg-primary/5" : "border-muted-foreground/30 hover:border-primary/60 hover:bg-muted/40"
              }`}
            >
              <FileSpreadsheet className="w-8 h-8 text-muted-foreground" />
              <div className="mt-2 text-sm font-medium">
                {fileName ? fileName : dragOver ? "Drop to read the file" : "Drag a CSV here, or click to choose"}
              </div>
              <div className="text-xs text-muted-foreground">{fileName ? "Click or drop to use a different file" : ".csv files from Excel, Google Sheets or your MLS"}</div>
              <input
                ref={inputRef}
                type="file"
                accept=".csv,text/csv"
                className="sr-only"
                onChange={(e) => { readFile(e.target.files?.[0]); e.target.value = ""; }}
              />
            </div>

            {readError && <p className="text-sm text-destructive">{readError}</p>}

            {parsed && (
              <div className="space-y-3 text-sm">
                {!hasEmailColumn ? (
                  <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-amber-900">
                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                    <div>
                      No email column found. The columns in this file are: {parsed.headers.filter(Boolean).join(", ") || "(none)"}.
                      Rename the email column to "Email" and try again.
                    </div>
                  </div>
                ) : (
                  <>
                    <div>
                      <span className="font-medium">{parsed.contacts.length} agent{parsed.contacts.length === 1 ? "" : "s"} ready to import</span>
                      {parsed.skippedRows.length > 0 && (
                        <span className="text-muted-foreground">
                          {" "}· {parsed.skippedRows.length} row{parsed.skippedRows.length === 1 ? "" : "s"} without a valid email will be skipped
                          {parsed.skippedRows.length <= 10 ? ` (line${parsed.skippedRows.length === 1 ? "" : "s"} ${parsed.skippedRows.join(", ")})` : ""}
                        </span>
                      )}
                    </div>
                    <div className="rounded-md border">
                      <div className="border-b bg-muted/40 px-3 py-1.5 text-xs font-medium text-muted-foreground">Columns recognized</div>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-1 px-3 py-2 text-xs">
                        {found.filter((f) => !(f === "fullName" && (found.includes("firstName") || found.includes("lastName")))).map((f) => (
                          <div key={f}><span className="text-muted-foreground">{FIELD_LABELS[f]}:</span> “{parsed.headers[parsed.columns[f]!]}”</div>
                        ))}
                      </div>
                      {!hasName && <div className="px-3 pb-2 text-xs text-amber-700">No name column found; names will show as "Unknown" until edited.</div>}
                    </div>
                    {parsed.contacts.length > 0 && (
                      <div className="text-xs text-muted-foreground">
                        First row: {parsed.contacts[0].firstName} {parsed.contacts[0].lastName} · {parsed.contacts[0].email}
                        {parsed.contacts[0].brokerage ? ` · ${parsed.contacts[0].brokerage}` : ""}
                      </div>
                    )}
                    <div className="space-y-1">
                      <Label htmlFor="import-tag">Tag these agents (optional)</Label>
                      <Input id="import-tag" placeholder="e.g. Ogden agents, Oct open house" value={tag} list="agent-import-tag-options"
                        onChange={(e) => setTag(e.target.value)} />
                      <datalist id="agent-import-tag-options">{tagOptions.map((t) => <option key={t} value={t} />)}</datalist>
                      <p className="text-xs text-muted-foreground">
                        Agents already on your list get the tag too. Use it to pick who gets an email campaign.
                      </p>
                    </div>
                  </>
                )}
              </div>
            )}

            {importMutation.error && <p className="text-sm text-destructive">{importMutation.error.message}</p>}
            <DialogFooter>
              <Button variant="outline" onClick={() => close(false)}>Cancel</Button>
              <Button
                disabled={!parsed || !hasEmailColumn || parsed.contacts.length === 0 || importMutation.isPending}
                onClick={() => parsed && importMutation.mutate({
                  contacts: parsed.contacts,
                  batchLabel: fileName.replace(/\.csv$/i, ""),
                  tag: cleanTag(tag) || undefined,
                })}
              >
                {importMutation.isPending ? "Importing..." : parsed ? `Import ${parsed.contacts.length} agent${parsed.contacts.length === 1 ? "" : "s"}` : "Import"}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
