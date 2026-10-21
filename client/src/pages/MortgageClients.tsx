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

export default function MortgageClients() {
  const utils = trpc.useUtils();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [showCreate, setShowCreate] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [form, setForm] = useState({
    firstName: "", lastName: "", email: "", phone: "",
    address: "", city: "", state: "UT", zipCode: "",
    loanType: "", closingDate: "", loanAmount: "", notes: "",
  });
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data, isLoading } = trpc.mortgageClients.list.useQuery({
    search: search || undefined, limit: 50, offset: page * 50,
  });
  const stats = trpc.mortgageClients.stats.useQuery();

  const createMutation = trpc.mortgageClients.create.useMutation({
    onSuccess: () => { utils.mortgageClients.invalidate(); setShowCreate(false); resetForm(); },
  });
  const deleteMutation = trpc.mortgageClients.delete.useMutation({
    onSuccess: () => utils.mortgageClients.invalidate(),
  });
  const importMutation = trpc.mortgageClients.importCsv.useMutation({
    onSuccess: (result) => {
      utils.mortgageClients.invalidate();
      setShowImport(false);
      alert(`Import complete: ${result.imported} imported, ${result.skipped} skipped (duplicates)`);
    },
  });

  function resetForm() {
    setForm({
      firstName: "", lastName: "", email: "", phone: "",
      address: "", city: "", state: "UT", zipCode: "",
      loanType: "", closingDate: "", loanAmount: "", notes: "",
    });
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
      const clients: any[] = [];

      for (let i = 1; i < lines.length; i++) {
        const vals = lines[i].split(",").map(v => v.trim().replace(/^"|"$/g, ""));
        const row: Record<string, string> = {};
        headers.forEach((h, idx) => { row[h] = vals[idx] || ""; });

        const firstName = row.firstname || row.first_name || row.first || "";
        const lastName = row.lastname || row.last_name || row.last || "";
        const email = row.email || row.email_address || "";

        if (!email) continue;

        clients.push({
          firstName: firstName || "Unknown",
          lastName: lastName || "",
          email,
          phone: row.phone || row.phone_number || undefined,
          address: row.address || row.street || undefined,
          city: row.city || undefined,
          state: row.state || "UT",
          zipCode: row.zip || row.zipcode || row.zip_code || undefined,
          loanType: row.loantype || row.loan_type || row.type || undefined,
          closingDate: row.closingdate || row.closing_date || row.closed || undefined,
          loanAmount: row.loanamount || row.loan_amount || row.amount || undefined,
          notes: row.notes || undefined,
        });
      }

      if (clients.length === 0) { alert("No valid clients found in CSV"); return; }
      importMutation.mutate({ clients, batchLabel: file.name.replace(".csv", "") });
    };
    reader.readAsText(file);
  }

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Past Mortgage Clients</h1>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setShowImport(true)}>
              <Upload className="w-4 h-4 mr-2" /> Import CSV
            </Button>
            <Button onClick={() => setShowCreate(true)}>
              <Plus className="w-4 h-4 mr-2" /> Add Client
            </Button>
          </div>
        </div>

        {stats.data && (
          <div className="grid grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Total Clients</CardTitle></CardHeader>
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
          <Input placeholder="Search by name, email, or address..." value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0); }} className="max-w-md" />
        </div>

        <div className="border rounded-md">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>City</TableHead>
                <TableHead>Loan Type</TableHead>
                <TableHead>Closing Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={8} className="text-center py-8">Loading...</TableCell></TableRow>
              ) : data?.clients.length === 0 ? (
                <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">No clients found</TableCell></TableRow>
              ) : data?.clients.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.firstName} {c.lastName}</TableCell>
                  <TableCell>{c.email}</TableCell>
                  <TableCell>{c.phone || "—"}</TableCell>
                  <TableCell>{c.city || "—"}</TableCell>
                  <TableCell>{c.loanType || "—"}</TableCell>
                  <TableCell>{c.closingDate ? new Date(c.closingDate).toLocaleDateString() : "—"}</TableCell>
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
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>Add Past Mortgage Client</DialogTitle></DialogHeader>
            <div className="grid grid-cols-2 gap-3">
              <Input placeholder="First Name *" value={form.firstName} onChange={e => setForm(f => ({ ...f, firstName: e.target.value }))} />
              <Input placeholder="Last Name *" value={form.lastName} onChange={e => setForm(f => ({ ...f, lastName: e.target.value }))} />
              <Input placeholder="Email *" type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} className="col-span-2" />
              <Input placeholder="Phone" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
              <Input placeholder="Loan Type (FHA, Conv, VA...)" value={form.loanType} onChange={e => setForm(f => ({ ...f, loanType: e.target.value }))} />
              <Input placeholder="Address" value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} className="col-span-2" />
              <Input placeholder="City" value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))} />
              <div className="flex gap-2">
                <Input placeholder="State" maxLength={2} value={form.state} onChange={e => setForm(f => ({ ...f, state: e.target.value.toUpperCase() }))} className="w-20" />
                <Input placeholder="Zip" value={form.zipCode} onChange={e => setForm(f => ({ ...f, zipCode: e.target.value }))} />
              </div>
              <Input type="date" placeholder="Closing Date" value={form.closingDate} onChange={e => setForm(f => ({ ...f, closingDate: e.target.value }))} />
              <Input placeholder="Loan Amount" value={form.loanAmount} onChange={e => setForm(f => ({ ...f, loanAmount: e.target.value }))} />
              <Input placeholder="Notes" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} className="col-span-2" />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
              <Button disabled={!form.firstName || !form.email || createMutation.isPending}
                onClick={() => createMutation.mutate({
                  ...form,
                  loanType: form.loanType || undefined,
                  closingDate: form.closingDate || undefined,
                  loanAmount: form.loanAmount || undefined,
                  notes: form.notes || undefined,
                  address: form.address || undefined,
                  zipCode: form.zipCode || undefined,
                  phone: form.phone || undefined,
                })}>
                {createMutation.isPending ? "Creating..." : "Create"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Import Dialog */}
        <Dialog open={showImport} onOpenChange={setShowImport}>
          <DialogContent>
            <DialogHeader><DialogTitle>Import Past Mortgage Clients from CSV</DialogTitle></DialogHeader>
            <p className="text-sm text-muted-foreground">
              Upload a CSV with columns: firstName, lastName, email, phone, address, city, state, zipCode, loanType, closingDate, loanAmount, notes.
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
