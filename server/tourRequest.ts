import { createGmailTransporter } from "./email";
import { getGmailCredentials } from "./emailService";

export type TourRequest = {
  bookingId: number;
  home: string;
  guestName: string;
  guestEmail: string;
  guestPhone?: string;
  notes?: string;
  start: Date;
  durationMinutes: number;
  agentName: string;
  agentEmail: string;
};

function icsDate(d: Date): string {
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

function icsText(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

// RFC 5545: content lines longer than 75 octets continue on lines starting with a space.
function fold(line: string): string {
  const bytes = Buffer.from(line, "utf8");
  if (bytes.length <= 75) return line;
  const parts: string[] = [];
  let start = 0;
  while (start < bytes.length) {
    let end = Math.min(start + (parts.length === 0 ? 75 : 74), bytes.length);
    // Never split a multi-byte character.
    while (end < bytes.length && (bytes[end] & 0xc0) === 0x80) end--;
    parts.push(bytes.subarray(start, end).toString("utf8"));
    start = end;
  }
  return parts.join("\r\n ");
}

export function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

export function tourTitle(t: TourRequest): string {
  return `Tour: ${t.home} — ${t.guestName}${t.guestPhone ? `, ${t.guestPhone}` : ""}`;
}

function tourDetails(t: TourRequest): string {
  return [
    `Home: ${t.home}`,
    `Client: ${t.guestName}`,
    t.guestPhone ? `Phone: ${t.guestPhone}` : null,
    `Email: ${t.guestEmail}`,
    t.notes ? `Notes: ${t.notes}` : null,
    "Requested through FreeHomeSearchUtah.com",
  ].filter(Boolean).join("\n");
}

export function buildTourIcs(t: TourRequest, organizerEmail: string, now = new Date()): string {
  const end = new Date(t.start.getTime() + t.durationMinutes * 60_000);
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Alta CRM//Tour Requests//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:REQUEST",
    "BEGIN:VEVENT",
    `UID:tour-${t.bookingId}@altamortgagecrm.net`,
    `DTSTAMP:${icsDate(now)}`,
    `DTSTART:${icsDate(t.start)}`,
    `DTEND:${icsDate(end)}`,
    `SUMMARY:${icsText(tourTitle(t))}`,
    `LOCATION:${icsText(t.home)}`,
    `DESCRIPTION:${icsText(tourDetails(t))}`,
    `ORGANIZER;CN=${icsText("FreeHomeSearchUtah.com")}:mailto:${organizerEmail}`,
    `ATTENDEE;CN=${icsText(t.agentName)};ROLE=REQ-PARTICIPANT;PARTSTAT=NEEDS-ACTION;RSVP=TRUE:mailto:${t.agentEmail}`,
    "STATUS:CONFIRMED",
    "SEQUENCE:0",
    "END:VEVENT",
    "END:VCALENDAR",
  ].map(fold).join("\r\n") + "\r\n";
}

export function googleCalendarLink(t: TourRequest): string {
  const end = new Date(t.start.getTime() + t.durationMinutes * 60_000);
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: tourTitle(t),
    dates: `${icsDate(t.start)}/${icsDate(end)}`,
    details: tourDetails(t),
    location: t.home,
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

/**
 * Email the agent a calendar invite for a tour request. Gmail adds invites to
 * Google Calendar on its own; the button in the body covers accounts that don't.
 */
export async function sendTourInvite(t: TourRequest): Promise<boolean> {
  const creds = await getGmailCredentials();
  if (!creds) {
    console.warn("[Tour] Gmail not configured; no calendar invite sent for booking", t.bookingId);
    return false;
  }
  const when = t.start.toLocaleString("en-US", {
    timeZone: "America/Denver", weekday: "long", month: "long", day: "numeric", hour: "numeric", minute: "2-digit",
  });
  const rows = tourDetails(t).split("\n").map(escapeHtml).join("<br>");
  const html =
    `<p><strong>New tour request</strong> for ${escapeHtml(when)} (Mountain).</p>` +
    `<p>${rows}</p>` +
    `<p><a href="${escapeHtml(googleCalendarLink(t))}" style="display:inline-block;padding:10px 16px;background:#1a73e8;color:#fff;border-radius:6px;text-decoration:none">Add to Google Calendar</a></p>` +
    `<p style="color:#666;font-size:12px">Reply to this email to reach ${escapeHtml(t.guestName)} directly.</p>`;

  const transporter = createGmailTransporter(creds.gmailAddress, creds.appPassword);
  try {
    await transporter.sendMail({
      from: `FreeHomeSearchUtah.com <${creds.gmailAddress}>`,
      to: t.agentEmail,
      replyTo: t.guestEmail,
      subject: tourTitle(t),
      html,
      text: `${tourDetails(t)}\n\nAdd to Google Calendar: ${googleCalendarLink(t)}`,
      icalEvent: { method: "REQUEST", filename: "tour.ics", content: buildTourIcs(t, creds.gmailAddress) },
    });
    return true;
  } finally {
    transporter.close();
  }
}
