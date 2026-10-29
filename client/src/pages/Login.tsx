import { useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Eye, EyeOff, Lock, Mail } from "lucide-react";
import { getLoginUrl, isManus } from "@/const";

export default function Login() {
  const [, setLocation] = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(
    new URLSearchParams(window.location.search).get("error") === "2fa_password_required"
      ? "This account uses two-factor authentication. Sign in with your email, password and code."
      : null
  );
  const [pendingToken, setPendingToken] = useState<string | null>(null);
  const [code, setCode] = useState("");

  const finish = () => {
    setLocation("/");
    window.location.reload();
  };

  const loginMutation = trpc.auth.login.useMutation({
    onSuccess: (res) => {
      if (res.twoFactorRequired) {
        setPendingToken(res.pendingToken);
        setPassword("");
        return;
      }
      finish();
    },
    onError: (err) => {
      setError(err.message);
    },
  });

  const verifyMutation = trpc.auth.verifyTwoFactor.useMutation({
    onSuccess: finish,
    onError: (err) => {
      setError(err.message);
      if (/expired/i.test(err.message)) setPendingToken(null);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (pendingToken) {
      verifyMutation.mutate({ pendingToken, code });
    } else {
      loginMutation.mutate({ email, password });
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        {/* Logo / Branding */}
        <div className="text-center space-y-2">
          <div className="flex justify-center">
            <img src="/alta-logo.png" alt="Alta Mortgage Group" className="h-24 w-auto" />
          </div>
          <p className="text-muted-foreground text-sm">CRM Platform</p>
        </div>

        <Card className="border shadow-md">
          <CardHeader className="space-y-1 pb-4">
            <CardTitle className="text-xl font-heading">Sign in</CardTitle>
            <CardDescription>Enter your credentials to access the CRM</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {pendingToken ? (
                <div className="space-y-2">
                  <Label htmlFor="code">Authentication code</Label>
                  <Input
                    id="code"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    placeholder="6-digit code or backup code"
                    autoComplete="one-time-code"
                    autoFocus
                    required
                  />
                  <p className="text-xs text-muted-foreground">
                    Open your authenticator app, or enter one of your backup codes.
                  </p>
                  <Button
                    type="submit"
                    className="w-full bg-brand-green hover:bg-brand-green/90 text-white"
                    disabled={verifyMutation.isPending}
                  >
                    {verifyMutation.isPending ? "Verifying…" : "Verify"}
                  </Button>
                  <button
                    type="button"
                    className="w-full text-xs text-muted-foreground hover:underline"
                    onClick={() => { setPendingToken(null); setCode(""); setError(null); }}
                  >
                    Back to sign in
                  </button>
                </div>
              ) : (<>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-9"
                    required
                    autoComplete="email"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-9 pr-10"
                    required
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                className="w-full bg-brand-green hover:bg-brand-green/90 text-white"
                disabled={loginMutation.isPending}
              >
                {loginMutation.isPending ? "Signing in…" : "Sign in"}
              </Button>
              </>)}
            </form>

            {/* Manus OAuth option if configured */}
            {isManus() && (
              <>
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-card px-2 text-muted-foreground">or</span>
                  </div>
                </div>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => { window.location.href = getLoginUrl(); }}
                >
                  Sign in with Manus
                </Button>
              </>
            )}

            {/* Setup link — only shown when no users exist */}
            <p className="text-center text-xs text-muted-foreground">
              First time?{" "}
              <a href="/setup" className="text-brand-green hover:underline font-medium">
                Set up your account
              </a>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
