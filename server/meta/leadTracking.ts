/**
 * Wires a captured lead into the marketing engine:
 *
 *   1. resolve which campaign the click came from,
 *   2. persist first-touch attribution onto the lead,
 *   3. report the conversion to Meta server-side (Conversions API),
 *   4. enrol the lead in the campaign's nurture sequence.
 *
 * Steps 3 and 4 are best-effort. A Meta outage or a misconfigured pixel must
 * never cost the business the lead itself, so every failure here is logged and
 * swallowed; the lead row is already committed by the time this runs.
 */

import {
  findCampaignForAttribution,
  getMetaSettings,
  logConversionEvent,
  updateConversionEvent,
} from "../marketingDb";
import { getLeadById, updateLead, logActivity } from "../db";
import { enrollLead } from "../automations/engine";
import { sendConversionEvents, generateEventId, type CapiConfig } from "./conversionsApi";
import { describeAttribution, type NormalizedAttribution } from "./attribution";

export type TrackedLandingPage = {
  id: number;
  title: string;
  slug: string;
  campaignId?: number | null;
  metaPixelId?: string | null;
  trackingEnabled?: boolean | null;
  capiEnabled?: boolean | null;
  conversionEventName?: string | null;
  conversionValue?: string | number | null;
};

/**
 * Resolves the pixel + token to use for a page: the page's own override when set,
 * otherwise the account-wide settings. Returns null when the Conversions API is
 * not usable, so callers can skip silently instead of logging failures forever.
 */
export async function resolveCapiConfig(page?: TrackedLandingPage | null): Promise<CapiConfig | null> {
  const settings = await getMetaSettings();
  if (!settings) return null;
  if (!settings.capiEnabled) return null;
  if (page && page.capiEnabled === false) return null;
  if (page && page.trackingEnabled === false) return null;

  const pixelId = page?.metaPixelId || settings.pixelId;
  const accessToken = settings.capiAccessToken || settings.accessToken;
  if (!pixelId || !accessToken) return null;

  return {
    pixelId,
    accessToken,
    apiVersion: settings.apiVersion ?? undefined,
    testEventCode: settings.capiTestEventCode ?? undefined,
  };
}

export type TrackLeadInput = {
  leadId: number;
  page?: TrackedLandingPage | null;
  attribution: NormalizedAttribution;
  /** Event id minted by the browser, reused so Meta de-duplicates the pair. */
  eventId?: string;
};

export type TrackLeadResult = {
  campaignId: number | null;
  capiStatus: "sent" | "failed" | "skipped";
  capiDetail?: string;
  enrolledSequenceId: number | null;
};

export async function trackCapturedLead(input: TrackLeadInput): Promise<TrackLeadResult> {
  const { leadId, page, attribution } = input;

  const result: TrackLeadResult = {
    campaignId: null,
    capiStatus: "skipped",
    enrolledSequenceId: null,
  };

  // ── 1. Resolve the campaign ──────────────────────────────────────────────
  let campaign = null;
  try {
    campaign =
      (await findCampaignForAttribution({
        metaCampaignId: attribution.metaCampaignId,
        landingPageId: page?.id,
        utmCampaign: attribution.utmCampaign,
      })) ?? null;
    if (!campaign && page?.campaignId) {
      const { getCampaignById } = await import("../marketingDb");
      campaign = (await getCampaignById(page.campaignId)) ?? null;
    }
    result.campaignId = campaign?.id ?? null;
  } catch (err) {
    console.error("[Attribution] Campaign resolution failed:", err);
  }

  // ── 2. Persist attribution ───────────────────────────────────────────────
  try {
    await updateLead(leadId, {
      campaignId: campaign?.id ?? null,
      utmSource: attribution.utmSource ?? null,
      utmMedium: attribution.utmMedium ?? null,
      utmCampaign: attribution.utmCampaign ?? campaign?.utmCampaign ?? null,
      utmContent: attribution.utmContent ?? null,
      utmTerm: attribution.utmTerm ?? null,
      fbclid: attribution.fbclid ?? null,
      fbc: attribution.fbc ?? null,
      fbp: attribution.fbp ?? null,
      gclid: attribution.gclid ?? null,
      metaCampaignId: attribution.metaCampaignId ?? campaign?.metaCampaignId ?? null,
      metaCampaignName: attribution.metaCampaignName ?? null,
      metaAdsetId: attribution.metaAdsetId ?? null,
      metaAdsetName: attribution.metaAdsetName ?? null,
      metaAdId: attribution.metaAdId ?? null,
      metaAdName: attribution.metaAdName ?? null,
      metaPlacement: attribution.metaPlacement ?? null,
      landingUrl: attribution.landingUrl ?? null,
      referrerUrl: attribution.referrerUrl ?? null,
      clientIpAddress: attribution.clientIpAddress ?? null,
      clientUserAgent: attribution.clientUserAgent ?? null,
      attributionCapturedAt: attribution.attributionCapturedAt,
    } as any);

    await logActivity({
      leadId,
      type: "system",
      title: "Attribution captured",
      content: describeAttribution(attribution),
      metadata: {
        campaignId: campaign?.id ?? null,
        campaignName: campaign?.name ?? null,
        utm: {
          source: attribution.utmSource,
          medium: attribution.utmMedium,
          campaign: attribution.utmCampaign,
          content: attribution.utmContent,
          term: attribution.utmTerm,
        },
        meta: {
          campaignId: attribution.metaCampaignId,
          adsetId: attribution.metaAdsetId,
          adId: attribution.metaAdId,
          placement: attribution.metaPlacement,
        },
      },
    });
  } catch (err) {
    console.error("[Attribution] Failed to store attribution:", err);
  }

  // ── 3. Conversions API ───────────────────────────────────────────────────
  try {
    const config = await resolveCapiConfig(page);
    if (config) {
      const lead = await getLeadById(leadId);
      const eventName = page?.conversionEventName || "Lead";
      const eventId = input.eventId || generateEventId("lead");
      const value = page?.conversionValue != null ? Number(page.conversionValue) : undefined;

      const logId = await logConversionEvent({
        leadId,
        campaignId: campaign?.id ?? null,
        landingPageId: page?.id ?? null,
        eventName,
        eventId,
        pixelId: config.pixelId,
        actionSource: "website",
        value: value != null ? String(value) : null,
        currency: "USD",
        status: "pending",
      });

      const send = await sendConversionEvents(config, [
        {
          eventName,
          eventId,
          eventSourceUrl: attribution.landingUrl,
          actionSource: "website",
          value: value ?? null,
          currency: "USD",
          userData: {
            email: lead?.email,
            phone: lead?.phone,
            firstName: lead?.firstName,
            lastName: lead?.lastName,
            country: "us",
            fbc: attribution.fbc,
            fbp: attribution.fbp,
            clientIpAddress: attribution.clientIpAddress,
            clientUserAgent: attribution.clientUserAgent,
            externalId: leadId,
          },
          customData: {
            lead_id: leadId,
            landing_page: page?.slug,
            campaign: campaign?.name,
          },
        },
      ]);

      result.capiStatus = send.ok ? "sent" : "failed";
      result.capiDetail = send.ok ? `events_received=${send.eventsReceived ?? 1}` : send.error;

      if (logId) {
        await updateConversionEvent(logId, {
          status: send.ok ? "sent" : "failed",
          responseCode: send.status,
          responseBody: (send.ok ? send.body : send.error)?.slice(0, 2000) ?? null,
        });
      }
      if (!send.ok) {
        console.error(`[CAPI] Lead event failed for lead ${leadId}: ${send.error}`);
      }
    } else {
      result.capiDetail = "Conversions API not configured for this page";
    }
  } catch (err) {
    result.capiStatus = "failed";
    result.capiDetail = err instanceof Error ? err.message : String(err);
    console.error("[CAPI] Unexpected error:", err);
  }

  // ── 4. Nurture sequence ──────────────────────────────────────────────────
  try {
    if (campaign?.sequenceId) {
      const enrolled = await enrollLead(campaign.sequenceId, leadId, { campaignId: campaign.id });
      if (enrolled.enrolled) result.enrolledSequenceId = campaign.sequenceId;
    }
  } catch (err) {
    console.error("[Automation] Enrollment failed:", err);
  }

  return result;
}

/**
 * Reports a later-stage conversion (a booked consultation, a closed loan) back to
 * Meta so its optimization sees the outcomes that actually matter, not just form
 * fills. Uses the click identifiers stored on the lead at first touch.
 */
export async function reportLeadConversion(
  leadId: number,
  eventName: string,
  opts?: { value?: number; currency?: string }
): Promise<{ ok: boolean; detail: string }> {
  try {
    const lead = await getLeadById(leadId);
    if (!lead) return { ok: false, detail: "Lead not found" };

    const config = await resolveCapiConfig(null);
    if (!config) return { ok: false, detail: "Conversions API not configured" };

    const eventId = generateEventId(eventName.toLowerCase());
    const logId = await logConversionEvent({
      leadId,
      campaignId: (lead as any).campaignId ?? null,
      eventName,
      eventId,
      pixelId: config.pixelId,
      actionSource: "system_generated",
      value: opts?.value != null ? String(opts.value) : null,
      currency: opts?.currency ?? "USD",
      status: "pending",
    });

    const send = await sendConversionEvents(config, [
      {
        eventName,
        eventId,
        actionSource: "system_generated",
        value: opts?.value ?? null,
        currency: opts?.currency ?? "USD",
        eventSourceUrl: (lead as any).landingUrl ?? undefined,
        userData: {
          email: lead.email,
          phone: lead.phone,
          firstName: lead.firstName,
          lastName: lead.lastName,
          country: "us",
          fbc: (lead as any).fbc,
          fbp: (lead as any).fbp,
          clientIpAddress: (lead as any).clientIpAddress,
          clientUserAgent: (lead as any).clientUserAgent,
          externalId: leadId,
        },
        customData: { lead_id: leadId },
      },
    ]);

    if (logId) {
      await updateConversionEvent(logId, {
        status: send.ok ? "sent" : "failed",
        responseCode: send.status,
        responseBody: (send.ok ? send.body : send.error)?.slice(0, 2000) ?? null,
      });
    }

    if (send.ok) {
      await logActivity({
        leadId,
        type: "system",
        title: `Conversion reported to Meta: ${eventName}`,
        content: opts?.value != null ? `Value: $${opts.value.toLocaleString()}` : undefined,
      });
    }

    return { ok: send.ok, detail: send.ok ? `events_received=${send.eventsReceived ?? 1}` : (send.error ?? "failed") };
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    console.error(`[CAPI] reportLeadConversion(${eventName}) failed:`, detail);
    return { ok: false, detail };
  }
}
