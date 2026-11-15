import { useEffect, useRef, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CheckCircle2, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";

type Provider = "anthropic" | "openai";

const KEY_HELP: Record<Provider, { url: string; where: string; placeholder: string }> = {
  anthropic: { url: "https://console.anthropic.com/settings/keys", where: "console.anthropic.com → Settings → API Keys", placeholder: "sk-ant-…" },
  openai: { url: "https://platform.openai.com/api-keys", where: "platform.openai.com → API keys", placeholder: "sk-…" },
};

/** The AI provider (Claude or OpenAI) behind campaign drafting and lead scoring. */
export default function AiSettingsPanel() {
  const utils = trpc.useUtils();
  const settings = trpc.ai.getSettings.useQuery();
  const [form, setForm] = useState<{ provider: Provider; apiKey: string; model: string; enabled: boolean }>({
    provider: "anthropic", apiKey: "", model: "claude-opus-5-5", enabled: true,
  });

  const filled = useRef(false);
  useEffect(() => {
    const s = settings.data;
    if (!s || filled.current) return;
    filled.current = true;
    setForm({ provider: s.provider, apiKey: "", model: s.model, enabled: s.enabled });
  }, [settings.data]);

  const refresh = () => { utils.ai.invalidate(); };
  const save = trpc.ai.save.useMutation({
    onSuccess: () => { toast.success("AI connected and saved"); setForm((f) => ({ ...f, apiKey: "" })); refresh(); },
    onError: (e) => toast.error(e.message),
  });
  const toggle = trpc.ai.setEnabled.useMutation({ onSuccess: refresh, onError: (e) => toast.error(e.message) });

  const s = settings.data;
  if (settings.isLoading || !s) {
    return (
      <Card><CardContent className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading AI settings…
      </CardContent></Card>
    );
  }

  const models = s.models[form.provider];
  const providerChanged = form.provider !== s.provider;
  const help = KEY_HELP[form.provider];

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles className="h-4 w-4" /> AI connection
          </CardTitle>
          {s.configured && (
            <div className="flex items-center gap-2">
              <Badge variant={s.enabled ? "default" : "secondary"}>{s.enabled ? "On" : "Off"}</Badge>
              <Switch checked={s.enabled} disabled={toggle.isPending}
                onCheckedChange={(enabled) => toggle.mutate({ enabled })} aria-label="Use this AI provider" />
            </div>
          )}
        </div>
        <CardDescription>
          Powers <strong>Draft a campaign with AI</strong> on Ad Campaigns and AI lead scoring. Usage is billed to
          your own Claude or OpenAI account.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {s.configured && s.lastVerifiedAt && (
          <div className="flex items-center gap-2 rounded-md border bg-muted/40 px-3 py-2 text-sm">
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            Connected to {s.provider === "anthropic" ? "Claude" : "OpenAI"} ({s.model}) · key {s.keyHint} · checked{" "}
            {new Date(s.lastVerifiedAt).toLocaleString()}
          </div>
        )}
        {!s.configured && !s.builtInAvailable && (
          <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
            AI isn't connected yet, so the AI buttons won't work. Add a key below.
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label>Provider</Label>
            <Select value={form.provider}
              onValueChange={(v) => {
                const provider = v as Provider;
                setForm((f) => ({ ...f, provider, model: s.models[provider][0].id }));
              }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="anthropic">Claude (Anthropic)</SelectItem>
                <SelectItem value="openai">OpenAI</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Model</Label>
            <Select value={form.model} onValueChange={(model) => setForm((f) => ({ ...f, model }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {models.map((m) => <SelectItem key={m.id} value={m.id}>{m.label}</SelectItem>)}
                {!models.some((m) => m.id === form.model) && <SelectItem value={form.model}>{form.model}</SelectItem>}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1 sm:col-span-2">
            <Label htmlFor="ai-key">API key</Label>
            <Input id="ai-key" type="password" autoComplete="new-password"
              placeholder={s.keyHint && !providerChanged ? `Saved (${s.keyHint}); blank keeps it` : help.placeholder}
              value={form.apiKey} onChange={(e) => setForm((f) => ({ ...f, apiKey: e.target.value }))} />
            <p className="text-xs text-muted-foreground">
              Create one at{" "}
              <a href={help.url} target="_blank" rel="noreferrer" className="underline">{help.where}</a>.
              The account needs billing or credit set up.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Switch id="ai-enabled" checked={form.enabled} onCheckedChange={(enabled) => setForm((f) => ({ ...f, enabled }))} />
          <Label htmlFor="ai-enabled">Use this provider for AI features</Label>
        </div>

        <Button disabled={save.isPending} onClick={() => save.mutate(form)}>
          {save.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
          Test &amp; save
        </Button>
      </CardContent>
    </Card>
  );
}
