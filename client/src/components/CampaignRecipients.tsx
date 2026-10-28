import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Download, Search } from "lucide-react";

type Status = "all" | "pending" | "sent" | "opened" | "clicked" | "bounced" | "unsubscribed";

const STATUS_LABEL: Record<Exclude<Status, "all">, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  pending: { label: "Waiting", variant: "outline" },
  sent: { label: "Sent", variant: "secondary" },
  opened: { label: "Opened", variant: "default" },
  clicked: { label: "Clicked", variant: "default" },
  bounced: { label: "Failed", variant: "destructive" },
  unsubscribed: { label: "Unsubscribed", variant: "destructive" },
};

const PAGE = 25;

function when(value: Date | string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

function csvCell(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

/** Every recipient of a campaign: who has been sent the email, when, and who is still waiting. */
export default function CampaignRecipients({ campaignId, campaignName }: { campaignId: number; campaignName: string }) {
  const utils = trpc.useUtils();
  const [status, setStatus] = useState<Status>("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [downloading, setDownloading] = useState(false);
  const { data, isLoading } = trpc.campaigns.recipients.useQuery(
    { campaignId, status, search: search || undefined, limit: PAGE, offset: page * PAGE },
    { refetchInterval: 60_000 },
  );

  const download = async () => {
    setDownloading(true);
    try {
      const all = await utils.campaigns.recipients.fetch({ campaignId, status, search: search || undefined, limit: 5000, offset: 0 });
      const lines = ["First Name,Last Name,Email,Status,Sent,Opened"].concat(
        all.rows.map((r) => [r.firstName ?? "", r.lastName ?? "", r.email ?? "", STATUS_LABEL[r.status].label, when(r.sentAt), when(r.openedAt)]
          .map(csvCell).join(",")),
      );
      const url = URL.createObjectURL(new Blob([lines.join("\n")], { type: "text/csv" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = `${campaignName.replace(/[^\w-]+/g, "_")}_recipients.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setDownloading(false);
    }
  };

  const total = data?.total ?? 0;
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-sm text-muted-foreground mr-auto">Recipients</p>
        <div className="relative">
          <Search className="absolute left-2 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
          <Input className="h-8 w-[200px] pl-7" placeholder="Search name or email" value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0); }} />
        </div>
        <Select value={status} onValueChange={(v) => { setStatus(v as Status); setPage(0); }}>
          <SelectTrigger className="h-8 w-[150px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Everyone</SelectItem>
            <SelectItem value="pending">Waiting to send</SelectItem>
            <SelectItem value="sent">Sent</SelectItem>
            <SelectItem value="opened">Opened</SelectItem>
            <SelectItem value="clicked">Clicked</SelectItem>
            <SelectItem value="bounced">Failed</SelectItem>
            <SelectItem value="unsubscribed">Unsubscribed</SelectItem>
          </SelectContent>
        </Select>
        <Button size="sm" variant="outline" disabled={downloading || total === 0} onClick={download}>
          <Download className="mr-1 h-3.5 w-3.5" /> {downloading ? "Preparing…" : "CSV"}
        </Button>
      </div>

      <div className="max-h-[320px] overflow-y-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Sent</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={4} className="py-6 text-center text-sm">Loading…</TableCell></TableRow>
            ) : data?.rows.length === 0 ? (
              <TableRow><TableCell colSpan={4} className="py-6 text-center text-sm text-muted-foreground">
                {status === "all" && !search ? "No recipients yet. They are listed once the campaign is sent." : "No one matches."}
              </TableCell></TableRow>
            ) : data?.rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="whitespace-nowrap">{[r.firstName, r.lastName].filter(Boolean).join(" ") || "—"}</TableCell>
                <TableCell>{r.email ?? "—"}</TableCell>
                <TableCell><Badge variant={STATUS_LABEL[r.status].variant}>{STATUS_LABEL[r.status].label}</Badge></TableCell>
                <TableCell className="whitespace-nowrap text-muted-foreground">{when(r.sentAt)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {total > PAGE && (
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{page * PAGE + 1}–{Math.min((page + 1) * PAGE, total)} of {total}</span>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>Previous</Button>
            <Button size="sm" variant="outline" disabled={(page + 1) * PAGE >= total} onClick={() => setPage((p) => p + 1)}>Next</Button>
          </div>
        </div>
      )}
    </div>
  );
}
