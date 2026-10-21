import { useState, useRef } from "react";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Upload, Search, Trash2, Users, UserX, UserCheck } from "lucide-react";

export default function AgentContacts() {
  const utils = trpc.useUtils();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [showCreate, setShowCreate] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [form, setForm] = useState({
    firstName: "", lastName: "", email: "", phone: "",
    brokerage: "", licenseNumber: "", city: "", state: "UT",
  });
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data, isLoading } = trpc.agentContacts.list.useQuery({
    search: search || undefined, limit: 50, offset: page * 50,
  });
  const stats = trpc.agentContacts.stats.useQuery();

  const createMutation = trpc.agentContacts.create.useMutation({
    onSuccess: () => { utils.agentContacts.invalidate(); setShowCreate(false); resetForm(); },
  });
  const deleteMutation = trpc.agentContacts.delete.useMutation({
    onSuccess: () => utils.agentContacts.invalidate(),
  });
  const importMutation = trpc.agentContacts.importCsv.useMutation({
    onSuccess: (result) => {
      utils.agentContacts.invalidate();
      setShowImport(false);
      alert(`Import complete: ${result.imported} imported, ${result.skipped} skipped (duplicates)`);
    },
  });

  function resetForm() {
    setForm({ firstName: "", lastName: "", email: "", phone: "", brokerage: "", licenseNumber: "", city: "", state: "UT" });
  }

  function handleCsvUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const lines = text.split("\n").map(l => l.trim()).filter(Boolean);
      if (lines.length < 2) { alert("CSV must have a header row and at least one data row"); return; }

      const headers = lines[0].split(",").map(h => h.trim().toLowerCase().replace(/[^a-z_]/g, ""));
      const contacts: any[] = [];

      for (let i = 1; i < lines.length; i++) {
        const vals = lines[i].split(",").map(v => v.trim().replace(/^"|"$/g, ""));
        const row: Record<string, string> = {};
        headers.forEach((h, idx) => { row[h] = vals[idx] || ""; });

        const firstName = row.firstname || row.first_name || row.first || "";
        const lastName = row.lastname || row.last_name || row.last || "";
        const email = row.email || row.email_address || row.member_email || row.memberemail || "";

        if (!email) continue;

        contacts.push({
          firstName: firstName || "Unknown",
          lastName: lastName || "",
          email,
          phone: row.phone || row.phone_number || undefined,
          brokerage: row.brokerage || row.company || row.office || row.office_name || row.officename || undefined,
          licenseNumber: row.license || row.licensenumber || row.license_number || undefined,
          city: row.city || undefined,
          state: row.state || "UT",
        });
      }

      if (contacts.length === 0) { alert("No valid contacts found in CSV"); return; }
      importMutation.mutate({ contacts, batchLabel: file.name.replace(".csv", "") });
    };
    reader.readAsText(file);
  }

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
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

        <div className="flex items-center gap-2">
          <Search className="w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search by name, email, or brokerage..." value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0); }} className="max-w-md" />
        </div>

        <div className="border rounded-md">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Brokerage</TableHead>
                <TableHead>City</TableHead>
                <TableHead>Status</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8">Loading...</TableCell></TableRow>
              ) : data?.contacts.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No contacts found</TableCell></TableRow>
              ) : data?.contacts.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.firstName} {c.lastName}</TableCell>
                  <TableCell>{c.email}</TableCell>
                  <TableCell>{c.phone || "—"}</TableCell>
                  <TableCell>{c.brokerage || "—"}</TableCell>
                  <TableCell>{c.city || "—"}</TableCell>
                  <TableCell>
                    {c.optedOut
                      ? <Badge variant="destructive">Opted Out</Badge>
                      : <Badge variant="secondary">Active</Badge>}
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="sm" onClick={() => {
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
              <Button disabled={!form.firstName || !form.email || createMutation.isPending}
                onClick={() => createMutation.mutate(form)}>
                {createMutation.isPending ? "Creating..." : "Create"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Import Dialog */}
        <Dialog open={showImport} onOpenChange={setShowImport}>
          <DialogContent>
            <DialogHeader><DialogTitle>Import Agent Contacts from CSV</DialogTitle></DialogHeader>
            <p className="text-sm text-muted-foreground">
              Upload a CSV file with columns: First Name, Last Name, Email (or Member E-mail), Phone, Brokerage (or Office Name), License Number, City, State.
              Duplicate emails will be skipped.
            </p>
            <input ref={fileInputRef} type="file" accept=".csv" onChange={handleCsvUpload} className="mt-2" />
            {importMutation.isPending && <p className="text-sm">Importing...</p>}
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowImport(false)}>Cancel</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
