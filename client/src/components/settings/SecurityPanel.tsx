import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ShieldCheck, ShieldOff, Copy } from "lucide-react";
import { toast } from "sonner";

type Setup = { secret: string; qrDataUrl: string };

export default function SecurityPanel() {
  const utils = trpc.useUtils();
  const status = trpc.auth.twoFactor.status.useQuery();
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [setup, setSetup] = useState<Setup | null>(null);
  const [backupCodes, setBackupCodes] = useState<string[] | null>(null);
  const [mode, setMode] = useState<"idle" | "disable" | "regen">("idle");

  const reset = () => {
    setPassword("");
    setCode("");
    setSetup(null);
    setMode("idle");
  };
  const onError = (e: { message: string }) => toast.error(e.message);

  const begin = trpc.auth.twoFactor.beginSetup.useMutation({
    onSuccess: (d) => {
      setSetup({ secret: d.secret, qrDataUrl: d.qrDataUrl });
      setPassword("");
    },
    onError,
  });
  const confirm = trpc.auth.twoFactor.confirmSetup.useMutation({
    onSuccess: (d) => {
      setBackupCodes(d.backupCodes);
      reset();
      utils.auth.twoFactor.status.invalidate();
      toast.success("Two-factor authentication is on");
    },
    onError,
  });
  const disable = trpc.auth.twoFactor.disable.useMutation({
    onSuccess: () => {
      reset();
      utils.auth.twoFactor.status.invalidate();
      toast.success("Two-factor authentication is off");
    },
    onError,
  });
  const regen = trpc.auth.twoFactor.regenerateBackupCodes.useMutation({
    onSuccess: (d) => {
      setBackupCodes(d.backupCodes);
      reset();
      utils.auth.twoFactor.status.invalidate();
    },
    onError,
  });

  const enabled = status.data?.enabled;

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2" style={{ fontFamily: "Raleway, sans-serif" }}>
          {enabled ? <ShieldCheck className="h-4 w-4 text-green-600" /> : <ShieldOff className="h-4 w-4 text-muted-foreground" />}
          Two-factor authentication
          <Badge variant={enabled ? "default" : "secondary"}>{enabled ? "On" : "Off"}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 max-w-md">
        <p className="text-sm text-muted-foreground">
          Adds a 6-digit code from an authenticator app (Google Authenticator, Authy, 1Password, Microsoft Authenticator)
          to your password when you sign in.
        </p>

        {backupCodes && (
          <div className="p-4 rounded-lg border border-amber-300 bg-amber-50 space-y-2">
            <p className="text-sm font-semibold">Save your backup codes</p>
            <p className="text-xs text-muted-foreground">
              Each works once if you lose your phone. They will not be shown again.
            </p>
            <div className="grid grid-cols-2 gap-1 font-mono text-sm">
              {backupCodes.map((c) => <span key={c}>{c}</span>)}
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(backupCodes.join("\n")); toast.success("Copied"); }}>
                <Copy className="h-3.5 w-3.5 mr-1" /> Copy
              </Button>
              <Button size="sm" onClick={() => setBackupCodes(null)}>I've saved them</Button>
            </div>
          </div>
        )}

        {!enabled && !setup && (
          <div className="space-y-2">
            <Label htmlFor="tf-pass">Confirm your password to begin</Label>
            <Input id="tf-pass" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
            <Button disabled={!password || begin.isPending} onClick={() => begin.mutate({ password })}>
              Set up two-factor authentication
            </Button>
          </div>
        )}

        {!enabled && setup && (
          <div className="space-y-3">
            <p className="text-sm">1. Scan this QR code with your authenticator app.</p>
            <img src={setup.qrDataUrl} alt="2FA QR code" className="border rounded-md" width={224} height={224} />
            <p className="text-xs text-muted-foreground">
              Can't scan? Enter this key manually: <span className="font-mono select-all">{setup.secret}</span>
            </p>
            <p className="text-sm">2. Enter the 6-digit code it shows.</p>
            <Input
              inputMode="numeric"
              maxLength={6}
              placeholder="123456"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              autoComplete="one-time-code"
            />
            <div className="flex gap-2">
              <Button disabled={code.length !== 6 || confirm.isPending} onClick={() => confirm.mutate({ code })}>Turn on</Button>
              <Button variant="outline" onClick={reset}>Cancel</Button>
            </div>
          </div>
        )}

        {enabled && mode === "idle" && (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">Backup codes remaining: {status.data?.backupCodesRemaining}</p>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setMode("regen")}>New backup codes</Button>
              <Button variant="destructive" onClick={() => setMode("disable")}>Turn off</Button>
            </div>
          </div>
        )}

        {enabled && mode !== "idle" && (
          <div className="space-y-2">
            <p className="text-sm">
              {mode === "disable" ? "Turn off two-factor authentication" : "Replace your backup codes"} — confirm it's you:
            </p>
            <Input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
            <Input placeholder="Authenticator or backup code" value={code} onChange={(e) => setCode(e.target.value)} autoComplete="one-time-code" />
            <div className="flex gap-2">
              <Button
                variant={mode === "disable" ? "destructive" : "default"}
                disabled={!password || code.length < 6 || disable.isPending || regen.isPending}
                onClick={() => (mode === "disable" ? disable : regen).mutate({ password, code })}
              >
                Confirm
              </Button>
              <Button variant="outline" onClick={reset}>Cancel</Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
