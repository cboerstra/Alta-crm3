import { useEffect, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Loader2, CheckCircle2, AlertTriangle, Facebook, Send, ShieldCheck, ExternalLink,
} from "lucide-react";
import { toast } from "sonner";

/**
 * Meta Ads connection panel.
 *
 * Tokens are write-only from the browser's point of view: the server returns a
 * last-four hint, never the value, and a blank field means "leave what's stored
 * alone". That keeps a long-lived system user token out of the client bundle and
 * out of anyone's browser devtools.
 */
export default function MetaSettingsPanel() {
  const utils = trpc.useUtils();
  const { data: settings, isLoading } = trpc.marketing.getSettings.useQuery();

  const [form, setForm] = useState({
    adAccountId: "", businessId: "", pageId: "", instagramActorId: "",
    pixelId: "", capiTestEventCode: "", apiVersion: "v21.0",
    accessToken: "", capiAccessToken: "",
  });
  const [toggles, setToggles] = useState({ pixelEnabled: true, capiEnabled: true, publishEnabled: false });

  useEffect(() => {
    if (!settings) return;
    setForm((prev) => ({
      ...prev,
      adAccountId: settings.adAccountId,
      businessId: settings.businessId,
      pageId: settings.pageId,
      instagramActorId: settings.instagramActorId,
      pixelId: settings.pixelId,
      capiTestEventCode: settings.capiTestEventCode,
      apiVersion: settings.apiVersion,
    }));
    setToggles({
      pixelEnabled: settings.pixelEnabled,
      capiEnabled: settings.capiEnabled,
      publishEnabled: settings.publishEnabled,
    });
  }, [settings]);

  const save = trpc.marketing.saveSettings.useMutation({
    onSuccess: () => {
      toast.success("Meta settings saved");
      setForm((prev) => ({ ...prev, accessToken: "", capiAccessToken: "" }));
      utils.marketing.getSettings.invalidate();
      utils.campaigns.connectionStatus.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const verify = trpc.marketing.verifyConnection.useMutation({
    onSuccess: (res) => {
      if (res.warning) toast.warning(res.warning);
      else toast.success(`Connected to ${res.account.name ?? res.account.id}`);
      utils.marketing.getSettings.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const testEvent = trpc.marketing.sendTestEvent.useMutation({
    onSuccess: () => toast.success("Test event accepted — check Events Manager → Test Events"),
    onError: (err) => toast.error(err.message),
  });

  if (isLoading) {
    return <div className="flex justify-center py-12"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
  }

  const connected = settings?.configured;

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Facebook className="h-5 w-5 text-blue-600" />
              <h3 className="font-semibold">Meta Marketing API</h3>
            </div>
            <Badge variant="outline" className={connected ? "bg-green-50 text-green-700 border-green-200" : ""}>
              {connected ? <><CheckCircle2 className="h-3 w-3 mr-1" /> connected</> : "not connected"}
            </Badge>
          </div>

          <p className="text-xs text-muted-foreground">
            Create a system user in Meta Business Settings, give it the{" "}
            <code>ads_management</code> and <code>business_management</code> permissions, assign it to
            your ad account and Page, and paste its token below.
          </p>

          {settings?.lastVerifyError && (
            <div className="rounded-md border border-red-200 bg-red-50 p-3 flex gap-2">
              <AlertTriangle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
              <p className="text-xs text-red-800 break-words">{settings.lastVerifyError}</p>
            </div>
          )}

          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Ad account ID</Label>
              <Input
                value={form.adAccountId}
                onChange={(e) => setForm({ ...form, adAccountId: e.target.value })}
                placeholder="act_1234567890"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Business ID</Label>
              <Input
                value={form.businessId}
                onChange={(e) => setForm({ ...form, businessId: e.target.value })}
                placeholder="optional"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Facebook Page ID</Label>
              <Input
                value={form.pageId}
                onChange={(e) => setForm({ ...form, pageId: e.target.value })}
                placeholder="The Page ads run as"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Instagram account ID</Label>
              <Input
                value={form.instagramActorId}
                onChange={(e) => setForm({ ...form, instagramActorId: e.target.value })}
                placeholder="optional — enables Instagram placements"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>System user access token</Label>
            <Input
              type="password"
              value={form.accessToken}
              onChange={(e) => setForm({ ...form, accessToken: e.target.value })}
              placeholder={settings?.accessTokenHint ? `Stored (${settings.accessTokenHint}) — leave blank to keep` : "Paste the token"}
            />
          </div>

          <div className="flex gap-2">
            <Button
              size="sm"
              disabled={save.isPending}
              onClick={() => save.mutate({ ...form, ...toggles })}
            >
              {save.isPending ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : null}
              Save
            </Button>
            <Button size="sm" variant="outline" disabled={verify.isPending} onClick={() => verify.mutate()}>
              {verify.isPending ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <ShieldCheck className="h-3.5 w-3.5 mr-1.5" />}
              Test connection
            </Button>
          </div>

          {settings?.lastVerifiedAt && (
            <p className="text-xs text-muted-foreground">
              Last verified {new Date(settings.lastVerifiedAt).toLocaleString()}
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-4">
          <h3 className="font-semibold">Pixel &amp; Conversions API</h3>
          <p className="text-xs text-muted-foreground">
            The pixel runs in the visitor's browser; the Conversions API reports the same conversion
            from the server with a shared event ID, so Meta counts it once. Running both is what keeps
            attribution intact when a browser blocks the pixel.
          </p>

          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Pixel ID</Label>
              <Input
                value={form.pixelId}
                onChange={(e) => setForm({ ...form, pixelId: e.target.value })}
                placeholder="1234567890123456"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Test event code</Label>
              <Input
                value={form.capiTestEventCode}
                onChange={(e) => setForm({ ...form, capiTestEventCode: e.target.value })}
                placeholder="TEST12345 — clear once live"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Conversions API token</Label>
            <Input
              type="password"
              value={form.capiAccessToken}
              onChange={(e) => setForm({ ...form, capiAccessToken: e.target.value })}
              placeholder={
                settings?.capiAccessTokenHint
                  ? `Stored (${settings.capiAccessTokenHint}) — leave blank to keep`
                  : "Leave blank to reuse the Marketing API token"
              }
            />
          </div>

          <Separator />

          <div className="space-y-3">
            {[
              {
                key: "pixelEnabled" as const,
                title: "Load the pixel on landing pages",
                hint: "Turn off to stop all browser-side tracking.",
              },
              {
                key: "capiEnabled" as const,
                title: "Send server-side conversions",
                hint: "Lead, Schedule and Purchase events reported from the CRM.",
              },
              {
                key: "publishEnabled" as const,
                title: "Allow publishing campaigns to Meta",
                hint: "Safety switch. Until this is on, campaigns stay local and no ad objects are created.",
              },
            ].map((row) => (
              <div key={row.key} className="flex items-center justify-between rounded-md border p-3">
                <div className="min-w-0 pr-3">
                  <p className="text-sm font-medium">{row.title}</p>
                  <p className="text-xs text-muted-foreground">{row.hint}</p>
                </div>
                <Switch
                  checked={toggles[row.key]}
                  onCheckedChange={(checked) => setToggles({ ...toggles, [row.key]: checked })}
                />
              </div>
            ))}
          </div>

          <div className="flex gap-2">
            <Button size="sm" disabled={save.isPending} onClick={() => save.mutate({ ...form, ...toggles })}>
              {save.isPending ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : null}
              Save
            </Button>
            <Button size="sm" variant="outline" disabled={testEvent.isPending} onClick={() => testEvent.mutate()}>
              {testEvent.isPending ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Send className="h-3.5 w-3.5 mr-1.5" />}
              Send test event
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-2">
          <h3 className="font-semibold">Public site URL</h3>
          <p className="text-xs text-muted-foreground">
            Ads link to landing pages on this domain. Set the <code>PUBLIC_BASE_URL</code> environment
            variable and restart — it cannot be changed from here, because a wrong value would send
            live ad traffic to a dead link.
          </p>
          <div className="rounded-md border bg-muted/30 p-2.5 flex items-center gap-2">
            <code className="text-xs flex-1 break-all">
              {settings?.publicBaseUrl || "not set"}
            </code>
            {settings?.publicBaseUrl && (
              <a href={settings.publicBaseUrl} target="_blank" rel="noreferrer">
                <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
              </a>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
