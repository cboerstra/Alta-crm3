/**
 * Zoom Server-to-Server OAuth helper
 *
 * Credentials required (stored in the "zoom" integration row):
 *   accountId   → Zoom Account ID
 *   accessToken → Client ID  (we reuse this column)
 *   refreshToken→ Client Secret (we reuse this column)
 *
 * Flow:
 *   1. POST https://zoom.us/oauth/token?grant_type=account_credentials&account_id=<ACCOUNT_ID>
 *      with Basic auth (clientId:clientSecret)
 *   2. Use the returned bearer token for subsequent API calls (expires in 1 hour)
 */

interface ZoomTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  scope: string;
}

interface ZoomMeetingResponse {
  id: number;           // numeric meeting ID
  uuid: string;
  host_id: string;
  topic: string;
  type: number;
  start_time: string;
  duration: number;
  join_url: string;
  start_url: string;
  password?: string;
}

export interface ZoomCredentials {
  accountId: string;
  clientId: string;
  clientSecret: string;
}

export interface CreateMeetingOptions {
  topic: string;
  startTime: Date;   // UTC
  durationMinutes: number;
  agenda?: string;
  password?: string;
}

export interface ZoomMeetingResult {
  meetingId: string;
  joinUrl: string;
  startUrl: string;
  password?: string;
}

/**
 * Fetch a short-lived bearer token via Server-to-Server OAuth.
 */
export async function getZoomAccessToken(creds: ZoomCredentials): Promise<string> {
  const basic = Buffer.from(`${creds.clientId}:${creds.clientSecret}`).toString("base64");
  const url = `https://zoom.us/oauth/token?grant_type=account_credentials&account_id=${encodeURIComponent(creds.accountId)}`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { reason?: string; message?: string };
    throw new Error(
      `Zoom token request failed (${res.status}): ${body.reason ?? body.message ?? "Unknown error"}. ` +
      "Check your Account ID, Client ID, and Client Secret in Settings → Integrations → Zoom."
    );
  }
  const data = await res.json() as ZoomTokenResponse;
  return data.access_token;
}

/**
 * Create a Zoom meeting and return the meeting ID, join URL, and start URL.
 * Uses the /users/me/meetings endpoint (creates under the authenticated account's user).
 */
export async function createZoomMeeting(
  creds: ZoomCredentials,
  options: CreateMeetingOptions
): Promise<ZoomMeetingResult> {
  const token = await getZoomAccessToken(creds);

  // Format start_time as ISO 8601 UTC (Zoom expects "2026-03-20T09:00:00Z")
  const startTimeIso = options.startTime.toISOString().replace(".000Z", "Z");

  const body = {
    topic: options.topic,
    type: 2, // 2 = Scheduled meeting
    start_time: startTimeIso,
    duration: options.durationMinutes,
    timezone: "UTC",
    agenda: options.agenda ?? "",
    settings: {
      host_video: true,
      participant_video: true,
      join_before_host: false,
      mute_upon_entry: true,
      waiting_room: true,
      auto_recording: "none",
    },
    ...(options.password ? { password: options.password } : {}),
  };

  const res = await fetch("https://api.zoom.us/v2/users/me/meetings", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { message?: string; code?: number };
    throw new Error(
      `Zoom create meeting failed (${res.status}): ${err.message ?? "Unknown error"}.`
    );
  }

  const data = await res.json() as ZoomMeetingResponse;
  return {
    meetingId: String(data.id),
    joinUrl: data.join_url,
    startUrl: data.start_url,
    password: data.password,
  };
}
