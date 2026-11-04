type CampaignState = {
  status: string;
  endDate?: Date | string | null;
  metaAdId?: string | null;
};

export type CampaignSection = "running" | "draft" | "finished";

const DAY_MS = 24 * 60 * 60 * 1000;

/** Which list a campaign belongs in. A campaign counts as finished once its whole end date has passed. */
export function campaignSection(campaign: CampaignState, now: Date = new Date()): CampaignSection {
  if (campaign.status === "draft") return "draft";
  if (campaign.status === "completed" || campaign.status === "archived") return "finished";
  if (campaign.endDate && now.getTime() > new Date(campaign.endDate).getTime() + DAY_MS) return "finished";
  return "running";
}

/**
 * The whole campaign can be edited until its ad exists on Meta. After that, edits
 * to the copy or targeting wouldn't reach the live ad, so only the budget can change.
 * A publish that failed partway has no ad yet, so it can still be corrected.
 */
export function canEditCampaign(campaign: CampaignState): boolean {
  return !campaign.metaAdId;
}

const FIELDS_LOCKED_AFTER_PUBLISH = [
  "name", "objective", "landingPageId", "targeting", "creative", "startDate", "endDate",
] as const;

/** The fields in an update that can't be applied to a campaign already published to Meta. */
export function lockedFieldsInUpdate(update: Record<string, unknown>): string[] {
  return FIELDS_LOCKED_AFTER_PUBLISH.filter((field) => update[field] !== undefined);
}
