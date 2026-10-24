import { MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/**
 * Click-to-text: opens the phone's texting app with the number and a
 * pre-filled message. Sends from whatever phone you tap it on (your cell).
 * Nothing is sent automatically.
 */

// Edit or add templates here. {name} becomes the contact's first name.
export const TEXT_TEMPLATES: { label: string; body: string }[] = [
  { label: "Check-in", body: "Hi {name}, Scott with Alta Mortgage Group checking in. Let me know if you have any questions on your application." },
  { label: "Application received", body: "Hi {name}, thanks for applying with Alta Mortgage Group. I've received your application and will be in touch within one business day. - Scott" },
  { label: "Documents needed", body: "Hi {name}, Scott with Alta Mortgage Group. We still need your last two pay stubs and bank statements to keep your file moving." },
  { label: "Rate lock reminder", body: "Hi {name}, this is Scott with Alta Mortgage Group. Your rate lock expires soon. Do you have a minute to talk today?" },
  { label: "Clear to close", body: "Hi {name}, great news! Your loan is clear to close. I'll call shortly with the closing details. - Scott, Alta Mortgage Group" },
];

export function toE164(phone: string): string {
  const d = phone.replace(/\D/g, "");
  if (d.length === 10) return "+1" + d;
  if (d.length === 11 && d.startsWith("1")) return "+" + d;
  return d ? "+" + d : "";
}

// "?&body=" works on both iPhone and Android.
export function smsLink(phone: string, body = ""): string {
  const num = toE164(phone);
  return `sms:${num}${body ? `?&body=${encodeURIComponent(body)}` : ""}`;
}

export function TextButton({ phone, firstName }: { phone?: string | null; firstName?: string | null }) {
  if (!phone || !toE164(phone)) return null;
  const name = firstName?.trim() || "there";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="h-7 gap-1 px-2">
          <MessageSquare className="h-3.5 w-3.5" /> Text
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuLabel>Text from your phone</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {TEXT_TEMPLATES.map((t) => (
          <DropdownMenuItem key={t.label} asChild>
            <a href={smsLink(phone, t.body.replace(/\{name\}/g, name))}>{t.label}</a>
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <a href={smsLink(phone)}>Blank message</a>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
