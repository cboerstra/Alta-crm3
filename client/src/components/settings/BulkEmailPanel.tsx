import { useEffect, useRef, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Loader2, Send, Users } from "lucide-react";
import { toast } from "sonner";

/**
 * The bulk email sender (Brevo or any SMTP relay) that real-estate campaigns
 * go out through, from the brokerage's own domain, at a daily pace.
 */
export default function BulkEmailPanel() {
  const utils = trpc.useUtils();
  const settings = trpc.bulkEmail.getSettings.useQuery();
  const usage = trpc.bulkEmail.usage.useQuery(undefined, { refetchInterval: 60_000 });
  const [form, setForm] = useState({
    host: "smtp-relay.brevo.com", port: 587, username: "", password: "",
    fromEmail: "", fromName: "", replyTo: "", dailyLimit: 290, enabled: true,
  });
  const [testTo, setTestTo] = useState("");

  // Fill the form from what's saved once, when it first loads. Doing it on
  // every refetch overwrote whatever had been typed meanwhile.
  const filled = useRef(false);
  useEffect(() => {
    const s = settings.data;
    if (!s || filled.current) return;
    filled.current = true;
    setForm({
      host: s.host, port: s.port, username: s.username, password: "",
      fromEmail: s.fromEmail, fromName: s.fromName, replyTo: s.replyTo,
      dailyLimit: s.dailyLimit, enabled: s.configured ? s.enabled : true,
    });
  }, [settings.data]);

  const refresh = () => { utils.bulkEmail.invalidate(); };
  const save = trpc.bulkEmail.save.useMutation({
    onSuccess: () => { toast.success("Connected and saved"); setForm((f) => ({ ...f, password: "" })); refresh(); },
    onError: (e) => toast.error(e.message),
  });
  const toggle = trpc.bulkEmail.setEnabled.useMutation({ onSuccess: refresh, onError: (e) => toast.error(e.message) });
  const test = trpc.bulkEmail.sendTest.useMutation({
    onSuccess: () => toast.success(`Test sent to ${testTo}. Check that it landed in the inbox, not spam.`),
    onError: (e) => toast.error(e.message),
  });

  const s = settings.data;
  if (settings.isLoading) {
    return (
      <Card><CardContent className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading bulk email settings…
      </CardContent></Card>
    );
  }
  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => setForm((f) => ({ ...f, [key]: value }));

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="h-4 w-4" /> Bulk email for agent campaigns (Brevo)
          </CardTitle>
          {s?.configured && (
            <div className="flex items-center gap-2">
              <Badge variant={s.enabled ? "default" : "secondary"}>{s.enabled ? "On" : "Off"}</Badge>
              <Switch checked={s.enabled} disabled={toggle.isPending}
                onCheckedChange={(enabled) => toggle.mutate({ enabled })} aria-label="Use bulk email for agent campaigns" />
            </div>
          )}
        </div>
        <CardDescription>
          Email campaigns to real estate agents and real-estate prospects go out through this sender, from your own
          domain, a set number per day. Mortgage email keeps using Gmail. In Brevo, find these under
          <strong> SMTP &amp; API → SMTP</strong>.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {usage.data?.active && (
          <div className="rounded-md border bg-muted/40 px-3 py-2 text-sm">
            Sending as <strong>{usage.data.fromEmail}</strong> · {usage.data.sentLast24h} of {usage.data.dailyLimit} used in the
            last 24 hours
            {usage.data.remaining === 0 && usage.data.nextSlotAt
              ? ` · more allowed from ${new Date(usage.data.nextSlotAt).toLocaleString()}`
              : ` · ${usage.data.remaining} left`}
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-3">
          <div className="sm:col-span-2 space-y-1">
            <Label htmlFor="bulk-host">SMTP server</Label>
            <Input id="bulk-host" value={form.host} onChange={(e) => set("host", e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="bulk-port">Port</Label>
            <Input id="bulk-port" type="number" value={form.port} onChange={(e) => set("port", parseInt(e.target.value) || 587)} />
          </div>
          <div className="space-y-1 sm:col-span-2">
            <Label htmlFor="bulk-user">Login</Label>
            <Input id="bulk-user" placeholder="e.g. 8a1b2c001@smtp-brevo.com" autoComplete="off"
              value={form.username} onChange={(e) => set("username", e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="bulk-pass">SMTP key</Label>
            <Input id="bulk-pass" type="password" autoComplete="new-password"
              placeholder={s?.passwordHint ? `Saved (${s.passwordHint}); blank keeps it` : "Paste the SMTP key"}
              value={form.password} onChange={(e) => set("password", e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="bulk-from">From address</Label>
            <Input id="bulk-from" type="email" placeholder="scott@freehomesearchutah.com"
              value={form.fromEmail} onChange={(e) => set("fromEmail", e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="bulk-name">From name</Label>
            <Input id="bulk-name" placeholder="Scott Boerstra" value={form.fromName} onChange={(e) => set("fromName", e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="bulk-reply">Replies go to (optional)</Label>
            <Input id="bulk-reply" type="email" placeholder="Defaults to the From address"
              value={form.replyTo} onChange={(e) => set("replyTo", e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="bulk-limit">Emails per day</Label>
            <Input id="bulk-limit" type="number" min={1} value={form.dailyLimit}
              onChange={(e) => set("dailyLimit", parseInt(e.target.value) || 1)} />
          </div>
          <p className="sm:col-span-2 self-end text-xs text-muted-foreground">
            Keep this a little under your plan's daily cap (Brevo free: 300), so a test email or retry never goes over.
            Campaigns send this many per 24 hours, then pick up again on their own.
          </p>
        </div>

        {s?.lastError && <p className="text-sm text-destructive">Last problem: {s.lastError}</p>}
        {s?.lastVerifiedAt && !s.lastError && (
          <p className="flex items-center gap-1 text-xs text-muted-foreground">
            <CheckCircle2 className="h-3.5 w-3.5 text-green-600" /> Login checked {new Date(s.lastVerifiedAt).toLocaleString()}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <Button disabled={save.isPending || !form.host || !form.username || !form.fromEmail}
            onClick={() => save.mutate({ ...form, password: form.password || undefined })}>
            {save.isPending && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
            {s?.configured ? "Save" : "Connect"}
          </Button>
          {s?.configured && (
            <>
              <Input className="h-9 w-[240px]" type="email" placeholder="Send a test to…"
                value={testTo} onChange={(e) => setTestTo(e.target.value)} />
              <Button variant="outline" disabled={!testTo || test.isPending} onClick={() => test.mutate({ to: testTo })}>
                {test.isPending ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Send className="mr-1 h-4 w-4" />}
                Send test
              </Button>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
