import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { AlertCircle, AlertTriangle, CheckCircle2, KeyRound, MailX, UserX } from "lucide-react";

type Outcome = "sent" | "no_match" | "rate_limited" | "email_not_configured" | "email_failed" | "error";

/**
 * Each outcome in the loan officer's terms: what happened, and what to do
 * about it. The borrower was told "a code is on its way" in every one of
 * these cases, so this is the only place the difference is visible.
 */
const OUTCOMES: Record<Outcome, { label: string; tone: string; icon: typeof CheckCircle2; advice: string }> = {
  sent: {
    label: "Code emailed",
    tone: "bg-emerald-100 text-emerald-700",
    icon: CheckCircle2,
    advice:
      "Delivered to the mail server. If they still can't find it: check spam or junk, and use only the newest code — each new one cancels the last.",
  },
  no_match: {
    label: "No application with this email",
    tone: "bg-amber-100 text-amber-800",
    icon: UserX,
    advice:
      "Nothing was sent. They most likely applied with a different email, or mistyped it. Ask which address is on their application.",
  },
  rate_limited: {
    label: "Code limit reached",
    tone: "bg-amber-100 text-amber-800",
    icon: KeyRound,
    advice:
      "Nothing was sent: they had already been sent the maximum codes for the period. The newest code they received still works; otherwise they wait and try again.",
  },
  email_not_configured: {
    label: "Not sent — email not set up",
    tone: "bg-red-100 text-red-700",
    icon: MailX,
    advice:
      "The website has no outgoing mail configured, so no borrower is receiving codes. Set SMTP_HOST, SMTP_USER and SMTP_PASS on the website.",
  },
  email_failed: {
    label: "Not sent — mail server refused",
    tone: "bg-red-100 text-red-700",
    icon: MailX,
    advice: "The mail server rejected the message; its reason is shown. Check the website's SMTP credentials.",
  },
  error: {
    label: "Not sent — system error",
    tone: "bg-red-100 text-red-700",
    icon: AlertTriangle,
    advice:
      "The website hit an error; the detail is shown. If it mentions a table that does not exist, run the portal section of the website's db/schema.sql.",
  },
};

/** Outcomes that mean codes are failing for everyone, not one borrower. */
const SYSTEMIC: Outcome[] = ["email_not_configured", "email_failed", "error"];

function when(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });
}

/**
 * Borrower-portal sign-in attempts, read from the website. With `email`, one
 * borrower's; without, everyone's — which is how a sign-in under a different
 * address than the application's gets found, since it belongs to no
 * application.
 */
export function PortalSignInLog({
  email,
  title = "Portal sign-in attempts",
  description,
  limit = 25,
  allowProblemsFilter = false,
}: {
  email?: string;
  title?: string;
  description?: string;
  limit?: number;
  allowProblemsFilter?: boolean;
}) {
  const [problemsOnly, setProblemsOnly] = useState(false);
  const { data, isLoading, error } = trpc.applications.portalLoginEvents.useQuery(
    { email, limit, problemsOnly },
    // The log answers "is this working right now", so keep it fresh.
    { refetchInterval: 60_000 }
  );

  const events = data?.events ?? [];
  const systemic = events.find((e) => SYSTEMIC.includes(e.outcome as Outcome));

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-base">{title}</CardTitle>
          {allowProblemsFilter && (
            <div className="flex items-center gap-2">
              <Switch id="portal-problems-only" checked={problemsOnly} onCheckedChange={setProblemsOnly} />
              <Label htmlFor="portal-problems-only" className="text-xs font-normal text-muted-foreground">
                Problems only
              </Label>
            </div>
          )}
        </div>
        {description && <p className="text-xs text-muted-foreground">{description}</p>}
      </CardHeader>
      <CardContent>
        {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}

        {error && (
          <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <div>{error.message}</div>
          </div>
        )}

        {systemic && (
          <div className="mb-3 flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-900">
            <MailX className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <div className="font-medium">Sign-in codes are failing to send.</div>
              <div className="mt-0.5 text-xs">
                This is not one borrower's mistake — it affects everyone using the portal until it is fixed.{" "}
                {OUTCOMES[systemic.outcome as Outcome].advice}
              </div>
            </div>
          </div>
        )}

        {data && events.length === 0 && (
          <p className="text-sm text-muted-foreground">
            {email
              ? "This borrower has not tried to sign in to the portal."
              : problemsOnly
                ? "No failed sign-ins."
                : "No portal sign-in attempts yet."}
          </p>
        )}

        {events.length > 0 && (
          <ul className="divide-y rounded-md border">
            {events.map((e) => {
              const meta = OUTCOMES[e.outcome as Outcome] ?? OUTCOMES.error;
              const Icon = meta.icon;
              return (
                <li key={e.id} className="space-y-1 px-3 py-2.5">
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <Badge variant="outline" className={`border-0 ${meta.tone}`}>
                      {meta.label}
                    </Badge>
                    {!email && <span className="font-medium">{e.email}</span>}
                    <span className="ml-auto text-xs text-muted-foreground">{when(e.createdAt)}</span>
                  </div>
                  <p className="pl-6 text-xs text-muted-foreground">{meta.advice}</p>
                  {e.detail && e.outcome !== "sent" && (
                    <p className="pl-6 font-mono text-[11px] text-muted-foreground break-words">{e.detail}</p>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
