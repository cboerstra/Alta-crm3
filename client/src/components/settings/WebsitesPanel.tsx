import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Check, ExternalLink, Loader2, Pencil, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";

/** The domains landing pages can be hosted on. Ads for a page link to its domain. */
export function WebsitesPanel() {
  const utils = trpc.useUtils();
  const { data: sites = [], isLoading } = trpc.websites.list.useQuery();
  const [url, setUrl] = useState("");
  const [name, setName] = useState("");
  const [editing, setEditing] = useState<{ id: number; name: string; url: string } | null>(null);
  const done = () => utils.websites.list.invalidate();
  const add = trpc.websites.add.useMutation({
    onSuccess: (r) => { toast.success(`${r.name} added`); setUrl(""); setName(""); done(); },
    onError: (e) => toast.error(e.message),
  });
  const update = trpc.websites.update.useMutation({
    onSuccess: () => { toast.success("Website updated"); setEditing(null); done(); },
    onError: (e) => toast.error(e.message),
  });
  const remove = trpc.websites.remove.useMutation({
    onSuccess: () => { toast.success("Website removed"); done(); },
    onError: (e) => toast.error(e.message),
  });

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div>
          <h3 className="font-semibold">Websites</h3>
          <p className="text-xs text-muted-foreground">
            Domains your landing pages can be hosted on. Pick one per page in Landing Pages; its ads link there.
            A new domain must forward <code>/lp/</code> and <code>/schedule/</code> to this CRM (as
            freehomesearchutah.com does), or its links will show "not found".
          </p>
        </div>

        {isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        ) : (
          <ul className="divide-y rounded-md border">
            {sites.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center gap-2 p-2.5">
                {editing?.id === s.id ? (
                  <>
                    <Input className="h-8 flex-1 min-w-[140px]" value={editing.name} aria-label="Name"
                      onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
                    <Input className="h-8 flex-[2] min-w-[180px]" value={editing.url} aria-label="Address"
                      onChange={(e) => setEditing({ ...editing, url: e.target.value })} />
                    <Button size="sm" variant="ghost" aria-label="Save" disabled={update.isPending}
                      onClick={() => update.mutate({ id: s.id, name: editing.name, url: editing.url })}>
                      <Check className="h-4 w-4" />
                    </Button>
                    <Button size="sm" variant="ghost" aria-label="Cancel" onClick={() => setEditing(null)}>
                      <X className="h-4 w-4" />
                    </Button>
                  </>
                ) : (
                  <>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {s.name} {s.isCrm && <Badge variant="secondary" className="ml-1 text-[10px]">CRM</Badge>}
                      </p>
                      <a href={s.baseUrl} target="_blank" rel="noreferrer" className="text-xs text-muted-foreground inline-flex items-center gap-1 break-all">
                        {s.baseUrl} <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                    <span className="text-xs text-muted-foreground">{s.pageCount} page{s.pageCount === 1 ? "" : "s"}</span>
                    <Button size="sm" variant="ghost" aria-label={`Edit ${s.name}`}
                      onClick={() => setEditing({ id: s.id, name: s.name, url: s.baseUrl })}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    {!s.isCrm && (
                      <Button size="sm" variant="ghost" aria-label={`Remove ${s.name}`} disabled={remove.isPending || s.pageCount > 0}
                        title={s.pageCount > 0 ? "Move its landing pages to another site first" : undefined}
                        onClick={() => { if (confirm(`Remove ${s.name}?`)) remove.mutate({ id: s.id }); }}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </>
                )}
              </li>
            ))}
          </ul>
        )}

        <form className="flex flex-wrap gap-2" onSubmit={(e) => { e.preventDefault(); if (url.trim()) add.mutate({ url, name: name || undefined }); }}>
          <Input className="flex-[2] min-w-[200px]" placeholder="https://example.com" value={url} onChange={(e) => setUrl(e.target.value)} aria-label="Website address" />
          <Input className="flex-1 min-w-[140px]" placeholder="Name (optional)" value={name} onChange={(e) => setName(e.target.value)} aria-label="Website name" />
          <Button type="submit" disabled={!url.trim() || add.isPending}>
            {add.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Plus className="h-4 w-4 mr-1" />} Add website
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
