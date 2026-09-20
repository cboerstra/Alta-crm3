/**
 * Data access for the marketing engine: campaigns, templates, automations,
 * tasks, attribution reporting and the Meta event log.
 *
 * Kept out of `db.ts` so the marketing surface stays reviewable on its own.
 * Follows the same conventions as `db.ts`: every function resolves the pooled
 * Drizzle instance itself and degrades to an empty result when the database is
 * unreachable, so a misconfigured host renders an empty CRM rather than a stack
 * trace.
 */

import { and, asc, desc, eq, gte, inArray, isNotNull, lte, or, sql } from "drizzle-orm";
import {
  campaigns, InsertCampaign, Campaign,
  campaignMetrics, InsertCampaignMetric,
  landingPageTemplates, InsertLandingPageTemplate,
  automationSequences, InsertAutomationSequence,
  automationSteps, InsertAutomationStep,
  automationEnrollments, InsertAutomationEnrollment,
  automationStepRuns,
  tasks, InsertTask,
  metaSettings, InsertMetaSettings,
  metaConversionEvents, InsertMetaConversionEvent,
  leads,
  landingPages,
  deals,
} from "../drizzle/schema";
import { getDb } from "./db";

// ═══════════════════════════════════════════════════════════════════════════
// Meta settings (single row)
// ═══════════════════════════════════════════════════════════════════════════

export async function getMetaSettings() {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(metaSettings).orderBy(asc(metaSettings.id)).limit(1);
  return rows[0] ?? null;
}

export async function upsertMetaSettings(data: Partial<InsertMetaSettings>) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const existing = await getMetaSettings();
  if (existing) {
    await db.update(metaSettings).set(data).where(eq(metaSettings.id, existing.id));
    return existing.id;
  }
  const [r] = await db.insert(metaSettings).values(data as InsertMetaSettings);
  return (r as any).insertId as number;
}

// ═══════════════════════════════════════════════════════════════════════════
// Landing page templates
// ═══════════════════════════════════════════════════════════════════════════

export async function getTemplates(opts?: { includeInactive?: boolean }) {
  const db = await getDb();
  if (!db) return [];
  const where = opts?.includeInactive ? undefined : eq(landingPageTemplates.isActive, true);
  return db.select().from(landingPageTemplates).where(where).orderBy(asc(landingPageTemplates.name));
}

export async function getTemplateById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const r = await db.select().from(landingPageTemplates).where(eq(landingPageTemplates.id, id)).limit(1);
  return r[0];
}

export async function getTemplateByKey(key: string) {
  const db = await getDb();
  if (!db) return undefined;
  const r = await db.select().from(landingPageTemplates).where(eq(landingPageTemplates.key, key)).limit(1);
  return r[0];
}

export async function createTemplate(data: InsertLandingPageTemplate) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const [r] = await db.insert(landingPageTemplates).values(data);
  return (r as any).insertId as number;
}

export async function updateTemplate(id: number, data: Partial<InsertLandingPageTemplate>) {
  const db = await getDb();
  if (!db) return;
  await db.update(landingPageTemplates).set(data).where(eq(landingPageTemplates.id, id));
}

export async function deleteTemplate(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(landingPageTemplates).where(
    and(eq(landingPageTemplates.id, id), eq(landingPageTemplates.isSystem, false))
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Campaigns
// ═══════════════════════════════════════════════════════════════════════════

export async function createCampaign(data: InsertCampaign) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const [r] = await db.insert(campaigns).values(data);
  return (r as any).insertId as number;
}

export async function getCampaigns(filters?: { status?: string; platform?: string }) {
  const db = await getDb();
  if (!db) return [];
  const conditions = [];
  if (filters?.status) conditions.push(eq(campaigns.status, filters.status as any));
  if (filters?.platform) conditions.push(eq(campaigns.platform, filters.platform as any));
  const where = conditions.length ? and(...conditions) : undefined;
  return db.select().from(campaigns).where(where).orderBy(desc(campaigns.createdAt));
}

export async function getCampaignById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const r = await db.select().from(campaigns).where(eq(campaigns.id, id)).limit(1);
  return r[0];
}

export async function updateCampaign(id: number, data: Partial<InsertCampaign>) {
  const db = await getDb();
  if (!db) return;
  await db.update(campaigns).set(data).where(eq(campaigns.id, id));
}

export async function deleteCampaign(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(campaignMetrics).where(eq(campaignMetrics.campaignId, id));
  await db.delete(campaigns).where(eq(campaigns.id, id));
}

/**
 * Resolves the campaign a lead belongs to from the attribution it arrived with.
 * Matching is deliberately ordered strongest-signal-first: the Meta campaign id
 * is authoritative, the landing page is next, and the utm_campaign tag is the
 * last resort because anyone can type one into a URL.
 */
export async function findCampaignForAttribution(input: {
  metaCampaignId?: string;
  landingPageId?: number;
  utmCampaign?: string;
}): Promise<Campaign | undefined> {
  const db = await getDb();
  if (!db) return undefined;

  if (input.metaCampaignId) {
    const byMeta = await db.select().from(campaigns)
      .where(eq(campaigns.metaCampaignId, input.metaCampaignId)).limit(1);
    if (byMeta[0]) return byMeta[0];
  }
  if (input.landingPageId) {
    const byPage = await db.select().from(campaigns)
      .where(eq(campaigns.landingPageId, input.landingPageId))
      .orderBy(desc(campaigns.createdAt)).limit(1);
    if (byPage[0]) return byPage[0];
  }
  if (input.utmCampaign) {
    const byUtm = await db.select().from(campaigns)
      .where(eq(campaigns.utmCampaign, input.utmCampaign))
      .orderBy(desc(campaigns.createdAt)).limit(1);
    if (byUtm[0]) return byUtm[0];
  }
  return undefined;
}

// ═══════════════════════════════════════════════════════════════════════════
// Campaign metrics
// ═══════════════════════════════════════════════════════════════════════════

/** Upserts one day of insights, keyed on (campaignId, date). */
export async function upsertCampaignMetric(data: InsertCampaignMetric) {
  const db = await getDb();
  if (!db) return;
  const existing = await db.select({ id: campaignMetrics.id }).from(campaignMetrics)
    .where(and(eq(campaignMetrics.campaignId, data.campaignId), eq(campaignMetrics.date, data.date)))
    .limit(1);
  if (existing[0]) {
    await db.update(campaignMetrics).set({ ...data, fetchedAt: new Date() })
      .where(eq(campaignMetrics.id, existing[0].id));
  } else {
    await db.insert(campaignMetrics).values(data);
  }
}

export async function getCampaignMetrics(campaignId: number, opts?: { since?: string; until?: string }) {
  const db = await getDb();
  if (!db) return [];
  const conditions = [eq(campaignMetrics.campaignId, campaignId)];
  if (opts?.since) conditions.push(gte(campaignMetrics.date, opts.since));
  if (opts?.until) conditions.push(lte(campaignMetrics.date, opts.until));
  return db.select().from(campaignMetrics).where(and(...conditions)).orderBy(asc(campaignMetrics.date));
}

/** Aggregate spend/impressions/clicks per campaign, for the unified dashboard. */
export async function getCampaignSpendTotals(campaignIds?: number[]) {
  const db = await getDb();
  if (!db) return [];
  const where = campaignIds?.length ? inArray(campaignMetrics.campaignId, campaignIds) : undefined;
  const rows = await db.select({
    campaignId: campaignMetrics.campaignId,
    spend: sql<string>`sum(${campaignMetrics.spend})`,
    impressions: sql<number>`sum(${campaignMetrics.impressions})`,
    clicks: sql<number>`sum(${campaignMetrics.clicks})`,
    reportedLeads: sql<number>`sum(${campaignMetrics.reportedLeads})`,
  }).from(campaignMetrics).where(where).groupBy(campaignMetrics.campaignId);
  return rows.map((r) => ({
    campaignId: r.campaignId,
    spend: Number(r.spend ?? 0),
    impressions: Number(r.impressions ?? 0),
    clicks: Number(r.clicks ?? 0),
    reportedLeads: Number(r.reportedLeads ?? 0),
  }));
}

// ═══════════════════════════════════════════════════════════════════════════
// Automation sequences
// ═══════════════════════════════════════════════════════════════════════════

export async function createSequence(data: InsertAutomationSequence) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const [r] = await db.insert(automationSequences).values(data);
  return (r as any).insertId as number;
}

export async function getSequences() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(automationSequences).orderBy(desc(automationSequences.createdAt));
}

export async function getSequenceById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const r = await db.select().from(automationSequences).where(eq(automationSequences.id, id)).limit(1);
  return r[0];
}

export async function updateSequence(id: number, data: Partial<InsertAutomationSequence>) {
  const db = await getDb();
  if (!db) return;
  await db.update(automationSequences).set(data).where(eq(automationSequences.id, id));
}

export async function deleteSequence(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(automationSteps).where(eq(automationSteps.sequenceId, id));
  await db.delete(automationEnrollments).where(eq(automationEnrollments.sequenceId, id));
  await db.delete(automationSequences).where(eq(automationSequences.id, id));
}

export async function getSequenceSteps(sequenceId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(automationSteps)
    .where(eq(automationSteps.sequenceId, sequenceId))
    .orderBy(asc(automationSteps.stepOrder), asc(automationSteps.id));
}

export async function createStep(data: InsertAutomationStep) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const [r] = await db.insert(automationSteps).values(data);
  return (r as any).insertId as number;
}

export async function updateStep(id: number, data: Partial<InsertAutomationStep>) {
  const db = await getDb();
  if (!db) return;
  await db.update(automationSteps).set(data).where(eq(automationSteps.id, id));
}

export async function deleteStep(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(automationSteps).where(eq(automationSteps.id, id));
}

/** Replaces a sequence's steps wholesale — how the visual builder saves. */
export async function replaceSequenceSteps(sequenceId: number, steps: Omit<InsertAutomationStep, "sequenceId">[]) {
  const db = await getDb();
  if (!db) return;
  await db.delete(automationSteps).where(eq(automationSteps.sequenceId, sequenceId));
  if (steps.length === 0) return;
  await db.insert(automationSteps).values(
    steps.map((s, i) => ({ ...s, sequenceId, stepOrder: s.stepOrder ?? i }))
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Enrollments
// ═══════════════════════════════════════════════════════════════════════════

export async function createEnrollment(data: InsertAutomationEnrollment) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const [r] = await db.insert(automationEnrollments).values(data);
  return (r as any).insertId as number;
}

export async function getEnrollment(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const r = await db.select().from(automationEnrollments).where(eq(automationEnrollments.id, id)).limit(1);
  return r[0];
}

export async function getEnrollmentsForLead(leadId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(automationEnrollments)
    .where(eq(automationEnrollments.leadId, leadId))
    .orderBy(desc(automationEnrollments.startedAt));
}

export async function findActiveEnrollment(sequenceId: number, leadId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const r = await db.select().from(automationEnrollments).where(and(
    eq(automationEnrollments.sequenceId, sequenceId),
    eq(automationEnrollments.leadId, leadId),
    eq(automationEnrollments.status, "active"),
  )).limit(1);
  return r[0];
}

export async function updateEnrollment(id: number, data: Partial<InsertAutomationEnrollment>) {
  const db = await getDb();
  if (!db) return;
  await db.update(automationEnrollments).set(data).where(eq(automationEnrollments.id, id));
}

/** Enrollments whose next step is due. Ordered oldest-first so nothing starves. */
export async function getDueEnrollments(limit = 50) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(automationEnrollments).where(and(
    eq(automationEnrollments.status, "active"),
    isNotNull(automationEnrollments.nextRunAt),
    lte(automationEnrollments.nextRunAt, new Date()),
  )).orderBy(asc(automationEnrollments.nextRunAt)).limit(limit);
}

export async function logStepRun(data: {
  enrollmentId: number;
  stepId: number;
  leadId: number;
  status: "sent" | "skipped" | "failed";
  detail?: string;
}) {
  const db = await getDb();
  if (!db) return;
  await db.insert(automationStepRuns).values(data);
}

export async function getStepRunsForEnrollment(enrollmentId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(automationStepRuns)
    .where(eq(automationStepRuns.enrollmentId, enrollmentId))
    .orderBy(asc(automationStepRuns.ranAt));
}

// ═══════════════════════════════════════════════════════════════════════════
// Tasks
// ═══════════════════════════════════════════════════════════════════════════

export async function createTask(data: InsertTask) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const [r] = await db.insert(tasks).values(data);
  return (r as any).insertId as number;
}

export async function getTasks(filters?: { status?: string; assignedTo?: number; leadId?: number; limit?: number }) {
  const db = await getDb();
  if (!db) return [];
  const conditions = [];
  if (filters?.status) conditions.push(eq(tasks.status, filters.status as any));
  if (filters?.assignedTo) conditions.push(eq(tasks.assignedTo, filters.assignedTo));
  if (filters?.leadId) conditions.push(eq(tasks.leadId, filters.leadId));
  const where = conditions.length ? and(...conditions) : undefined;
  return db.select().from(tasks).where(where)
    .orderBy(asc(tasks.dueAt), desc(tasks.createdAt))
    .limit(filters?.limit ?? 200);
}

export async function updateTask(id: number, data: Partial<InsertTask>) {
  const db = await getDb();
  if (!db) return;
  await db.update(tasks).set(data).where(eq(tasks.id, id));
}

export async function deleteTask(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(tasks).where(eq(tasks.id, id));
}

// ═══════════════════════════════════════════════════════════════════════════
// Meta conversion event log
// ═══════════════════════════════════════════════════════════════════════════

export async function logConversionEvent(data: InsertMetaConversionEvent) {
  const db = await getDb();
  if (!db) return undefined;
  const [r] = await db.insert(metaConversionEvents).values(data);
  return (r as any).insertId as number;
}

export async function updateConversionEvent(id: number, data: Partial<InsertMetaConversionEvent>) {
  const db = await getDb();
  if (!db) return;
  await db.update(metaConversionEvents).set(data).where(eq(metaConversionEvents.id, id));
}

export async function getConversionEvents(filters?: { leadId?: number; campaignId?: number; limit?: number }) {
  const db = await getDb();
  if (!db) return [];
  const conditions = [];
  if (filters?.leadId) conditions.push(eq(metaConversionEvents.leadId, filters.leadId));
  if (filters?.campaignId) conditions.push(eq(metaConversionEvents.campaignId, filters.campaignId));
  const where = conditions.length ? and(...conditions) : undefined;
  return db.select().from(metaConversionEvents).where(where)
    .orderBy(desc(metaConversionEvents.createdAt)).limit(filters?.limit ?? 100);
}

// ═══════════════════════════════════════════════════════════════════════════
// Attribution reporting
// ═══════════════════════════════════════════════════════════════════════════

export type CampaignPerformanceRow = {
  campaignId: number | null;
  campaignName: string;
  status: string;
  spend: number;
  impressions: number;
  clicks: number;
  leads: number;
  consultations: number;
  closed: number;
  closedRevenue: number;
  costPerLead: number | null;
  costPerClosedLoan: number | null;
  roas: number | null;
  conversionRate: number;
};

/**
 * The report that answers "what produced this closed loan?".
 *
 * Joins CRM outcomes (leads → consultations → closed loans → revenue) onto ad
 * spend, per campaign. Revenue comes from `deals.value` on won deals, falling
 * back to the lead's own `dealValue` when the loan was closed on the lead record
 * without a separate deal — both paths exist in this CRM.
 */
export async function getCampaignPerformance(opts?: { since?: Date; until?: Date }): Promise<CampaignPerformanceRow[]> {
  const db = await getDb();
  if (!db) return [];

  const allCampaigns = await db.select().from(campaigns).orderBy(desc(campaigns.createdAt));
  const spendTotals = await getCampaignSpendTotals();
  const spendByCampaign = new Map(spendTotals.map((s) => [s.campaignId, s]));

  const dateConditions = [];
  if (opts?.since) dateConditions.push(gte(leads.createdAt, opts.since));
  if (opts?.until) dateConditions.push(lte(leads.createdAt, opts.until));

  // Lead-side outcomes grouped by campaign.
  const leadRows = await db.select({
    campaignId: leads.campaignId,
    leadCount: sql<number>`count(*)`,
    consultations: sql<number>`sum(case when ${leads.stage} in ('consultation_booked','under_contract','closed') then 1 else 0 end)`,
    closed: sql<number>`sum(case when ${leads.stage} = 'closed' then 1 else 0 end)`,
    leadRevenue: sql<string>`sum(case when ${leads.stage} = 'closed' then coalesce(${leads.dealValue}, 0) else 0 end)`,
  }).from(leads)
    .where(dateConditions.length ? and(...dateConditions) : undefined)
    .groupBy(leads.campaignId);

  // Won-deal revenue attributed through the lead that produced the deal.
  const dealRows = await db.select({
    campaignId: leads.campaignId,
    dealRevenue: sql<string>`sum(${deals.value})`,
    dealCount: sql<number>`count(*)`,
  }).from(deals)
    .innerJoin(leads, eq(deals.leadId, leads.id))
    .where(eq(deals.stage, "closed_won"))
    .groupBy(leads.campaignId);

  const leadsByCampaign = new Map(leadRows.map((r) => [r.campaignId ?? null, r]));
  const dealsByCampaign = new Map(dealRows.map((r) => [r.campaignId ?? null, r]));

  const buildRow = (
    campaignId: number | null,
    campaignName: string,
    status: string
  ): CampaignPerformanceRow => {
    const spend = spendByCampaign.get(campaignId ?? -1);
    const l = leadsByCampaign.get(campaignId);
    const d = dealsByCampaign.get(campaignId);
    const leadCount = Number(l?.leadCount ?? 0);
    const closed = Number(l?.closed ?? 0);
    // Prefer explicit deal revenue; fall back to lead-level close value.
    const closedRevenue = Number(d?.dealRevenue ?? 0) || Number(l?.leadRevenue ?? 0);
    const spendTotal = Number(spend?.spend ?? 0);
    return {
      campaignId,
      campaignName,
      status,
      spend: spendTotal,
      impressions: Number(spend?.impressions ?? 0),
      clicks: Number(spend?.clicks ?? 0),
      leads: leadCount,
      consultations: Number(l?.consultations ?? 0),
      closed,
      closedRevenue,
      costPerLead: leadCount > 0 && spendTotal > 0 ? spendTotal / leadCount : null,
      costPerClosedLoan: closed > 0 && spendTotal > 0 ? spendTotal / closed : null,
      roas: spendTotal > 0 ? closedRevenue / spendTotal : null,
      conversionRate: leadCount > 0 ? (closed / leadCount) * 100 : 0,
    };
  };

  const rows = allCampaigns.map((c) => buildRow(c.id, c.name, c.status));

  // Leads that arrived without a campaign still need somewhere to land, or the
  // totals on this page won't match the Leads page and nobody will trust either.
  const unattributed = leadsByCampaign.get(null);
  if (unattributed && Number(unattributed.leadCount) > 0) {
    rows.push(buildRow(null, "Unattributed", "n/a"));
  }

  return rows;
}

/** Lead counts grouped by first-touch source/medium, for the channel mix chart. */
export async function getAttributionBreakdown(opts?: { since?: Date; until?: Date }) {
  const db = await getDb();
  if (!db) return [];
  const conditions = [];
  if (opts?.since) conditions.push(gte(leads.createdAt, opts.since));
  if (opts?.until) conditions.push(lte(leads.createdAt, opts.until));
  const rows = await db.select({
    source: sql<string>`coalesce(${leads.utmSource}, ${leads.source}, 'direct')`,
    medium: sql<string>`coalesce(${leads.utmMedium}, 'none')`,
    leadCount: sql<number>`count(*)`,
    closed: sql<number>`sum(case when ${leads.stage} = 'closed' then 1 else 0 end)`,
    revenue: sql<string>`sum(case when ${leads.stage} = 'closed' then coalesce(${leads.dealValue}, 0) else 0 end)`,
  }).from(leads)
    .where(conditions.length ? and(...conditions) : undefined)
    .groupBy(sql`1`, sql`2`)
    .orderBy(desc(sql`count(*)`));
  return rows.map((r) => ({
    source: r.source ?? "direct",
    medium: r.medium ?? "none",
    leads: Number(r.leadCount ?? 0),
    closed: Number(r.closed ?? 0),
    revenue: Number(r.revenue ?? 0),
  }));
}

/** Per-ad performance — the "which creative actually worked" view. */
export async function getAdLevelBreakdown(opts?: { campaignId?: number; limit?: number }) {
  const db = await getDb();
  if (!db) return [];
  const conditions = [isNotNull(leads.metaAdId)];
  if (opts?.campaignId) conditions.push(eq(leads.campaignId, opts.campaignId));
  const rows = await db.select({
    metaAdId: leads.metaAdId,
    metaAdName: leads.metaAdName,
    metaAdsetId: leads.metaAdsetId,
    metaAdsetName: leads.metaAdsetName,
    metaCampaignName: leads.metaCampaignName,
    leadCount: sql<number>`count(*)`,
    closed: sql<number>`sum(case when ${leads.stage} = 'closed' then 1 else 0 end)`,
    revenue: sql<string>`sum(case when ${leads.stage} = 'closed' then coalesce(${leads.dealValue}, 0) else 0 end)`,
  }).from(leads)
    .where(and(...conditions))
    .groupBy(leads.metaAdId, leads.metaAdName, leads.metaAdsetId, leads.metaAdsetName, leads.metaCampaignName)
    .orderBy(desc(sql`count(*)`))
    .limit(opts?.limit ?? 50);
  return rows.map((r) => ({
    metaAdId: r.metaAdId,
    metaAdName: r.metaAdName,
    metaAdsetId: r.metaAdsetId,
    metaAdsetName: r.metaAdsetName,
    metaCampaignName: r.metaCampaignName,
    leads: Number(r.leadCount ?? 0),
    closed: Number(r.closed ?? 0),
    revenue: Number(r.revenue ?? 0),
  }));
}

/** Leads attributed to one campaign, newest first. */
export async function getLeadsForCampaign(campaignId: number, limit = 100) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(leads)
    .where(eq(leads.campaignId, campaignId))
    .orderBy(desc(leads.createdAt))
    .limit(limit);
}

export async function getLandingPagesForCampaignPicker() {
  const db = await getDb();
  if (!db) return [];
  return db.select({
    id: landingPages.id,
    title: landingPages.title,
    slug: landingPages.slug,
    isActive: landingPages.isActive,
    campaignId: landingPages.campaignId,
  }).from(landingPages).orderBy(desc(landingPages.createdAt));
}
