import { and, desc, eq, gte, lte, sql, like, or, inArray, isNotNull } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import mysql2 from "mysql2/promise";
import {
  InsertUser, users,
  leads, InsertLead, Lead,
  webinars, InsertWebinar,
  landingPages, InsertLandingPage,
  activityLog, InsertActivityLog,
  smsMessages,
  emailReminders,
  deals, InsertDeal,
  availability,
  bookings, InsertBooking,
  integrations,
  webinarSessions, InsertWebinarSession,
  pendingInvites, InsertPendingInvite,
  smsTemplates, InsertSmsTemplate, SmsTemplate,
} from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;
let _dbInitError: string | null = null;

/**
 * Returns the Drizzle database instance.
 * Uses an explicit mysql2 connection pool so SSL options can be injected
 * for remote hosts (e.g. Hostinger) that require encrypted connections.
 * Throws with a descriptive message when DATABASE_URL is missing or the
 * connection cannot be established.
 */
export async function getDb() {
  if (_db) return _db;
  if (_dbInitError) throw new Error(_dbInitError);

  const url = process.env.DATABASE_URL;
  if (!url) {
    const msg = "DATABASE_URL environment variable is not set. " +
      "Add it in Hostinger → Node.js → Environment Variables as: " +
      "mysql://USER:PASS@HOST:3306/DBNAME";
    _dbInitError = msg;
    throw new Error(msg);
  }

  try {
    // Parse the URL to decide whether to add SSL.
    // Hostinger remote MySQL (and most cloud MySQL) requires SSL.
    // If the URL already contains ssl= params, respect them.
    // Otherwise add ssl: { rejectUnauthorized: false } as a safe default
    // that works with self-signed certs common on shared hosting.
    const hasExplicitSsl = url.includes("ssl=") || url.includes("sslmode=");
    const pool = mysql2.createPool(
      hasExplicitSsl
        ? { uri: url }
        : { uri: url, ssl: { rejectUnauthorized: false } }
    );

    // Test the connection immediately so we get a clear error at startup
    // rather than a cryptic failure on the first user action.
    await pool.query("SELECT 1");
    console.log("[Database] Connected successfully");

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    _db = drizzle(pool as any);
    return _db;
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    _dbInitError = `Database connection failed: ${msg}. Check DATABASE_URL and ensure the MySQL server is reachable.`;
    console.error("[Database]", _dbInitError);
    throw new Error(_dbInitError);
  }
}

// ─── Users ────────────────────────────────────────────────────────────────────
export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required");
  const db = await getDb();
  if (!db) return;
  const values: InsertUser = { openId: user.openId };
  const updateSet: Record<string, unknown> = {};
  const textFields = ["name", "email", "loginMethod"] as const;
  textFields.forEach((f) => {
    const v = user[f];
    if (v === undefined) return;
    values[f] = v ?? null;
    updateSet[f] = v ?? null;
  });
  if (user.lastSignedIn !== undefined) { values.lastSignedIn = user.lastSignedIn; updateSet.lastSignedIn = user.lastSignedIn; }
  if (user.role !== undefined) { values.role = user.role; updateSet.role = user.role; }
  else if (user.openId === ENV.ownerOpenId) { values.role = "admin"; updateSet.role = "admin"; }
  if (!values.lastSignedIn) values.lastSignedIn = new Date();
  if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = new Date();
  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const r = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return r[0];
}
export async function getUserByEmail(email: string) {
  const db = await getDb();
  if (!db) throw new Error("Database connection unavailable");
  const r = await db.select().from(users).where(eq(users.email, email)).limit(1);
  return r[0];
}

export async function createUserWithPassword(data: {
  openId: string;
  name: string;
  email: string;
  passwordHash: string;
  role: "admin" | "user";
}) {
  const db = await getDb();
  if (!db) throw new Error("Database connection unavailable — check DATABASE_URL");
  await db.insert(users).values({
    openId: data.openId,
    name: data.name,
    email: data.email,
    passwordHash: data.passwordHash,
    loginMethod: "email",
    role: data.role,
    lastSignedIn: new Date(),
  });
  const r = await db.select().from(users).where(eq(users.email, data.email)).limit(1);
  if (!r[0]) throw new Error("User insert succeeded but row not found — check DB permissions");
  return r[0];
}
export async function updateUserPassword(userId: number, passwordHash: string) {
  const db = await getDb();
  if (!db) return;
  await db.update(users).set({ passwordHash }).where(eq(users.id, userId));
}

export async function getAllUsers() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(users).orderBy(desc(users.createdAt));
}

export async function updateUserSchedulingSlug(userId: number, slug: string) {
  const db = await getDb();
  if (!db) return;
  await db.update(users).set({ schedulingSlug: slug }).where(eq(users.id, userId));
}

// ─── Leads ────────────────────────────────────────────────────────────────────
export async function createLead(data: InsertLead) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const [result] = await db.insert(leads).values(data);
  return (result as any).insertId as number;
}

export async function getLeads(filters?: {
  stage?: string;
  source?: string;
  search?: string;
  assignedTo?: number;
  limit?: number;
  offset?: number;
}) {
  const db = await getDb();
  if (!db) return { items: [], total: 0 };
  const conditions = [];
  if (filters?.stage) conditions.push(eq(leads.stage, filters.stage as any));
  if (filters?.source) conditions.push(eq(leads.source, filters.source));
  if (filters?.assignedTo) conditions.push(eq(leads.assignedTo, filters.assignedTo));
  if (filters?.search) {
    const s = `%${filters.search}%`;
    conditions.push(or(like(leads.firstName, s), like(leads.lastName, s), like(leads.email, s)));
  }
  const where = conditions.length > 0 ? and(...conditions) : undefined;
  const [items, countResult] = await Promise.all([
    db.select().from(leads).where(where).orderBy(desc(leads.createdAt))
      .limit(filters?.limit ?? 50).offset(filters?.offset ?? 0),
    db.select({ count: sql<number>`count(*)` }).from(leads).where(where),
  ]);
  return { items, total: Number(countResult[0]?.count ?? 0) };
}

export async function getLeadById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const r = await db.select().from(leads).where(eq(leads.id, id)).limit(1);
  return r[0];
}

export async function updateLead(id: number, data: Partial<InsertLead>) {
  const db = await getDb();
  if (!db) return;
  await db.update(leads).set(data).where(eq(leads.id, id));
}

export async function updateLeadStage(id: number, stage: Lead["stage"]) {
  const db = await getDb();
  if (!db) return;
  await db.update(leads).set({ stage }).where(eq(leads.id, id));
}

export async function getLeadsByStage() {
  const db = await getDb();
  if (!db) return [];
  return db.select({
    stage: leads.stage,
    count: sql<number>`count(*)`,
  }).from(leads).groupBy(leads.stage);
}

export async function getLeadsBySource() {
  const db = await getDb();
  if (!db) return [];
  return db.select({
    source: leads.source,
    count: sql<number>`count(*)`,
  }).from(leads).groupBy(leads.source);
}

export async function updateLeadScore(id: number, score: number, reason: string) {
  const db = await getDb();
  if (!db) return;
  await db.update(leads).set({ score, scoreReason: reason, scoredAt: new Date() }).where(eq(leads.id, id));
}

// ─── Webinars ─────────────────────────────────────────────────────────────────
export async function createWebinar(data: InsertWebinar) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const [r] = await db.insert(webinars).values(data);
  return (r as any).insertId as number;
}

export async function getWebinars() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(webinars).orderBy(desc(webinars.scheduledAt));
}

export async function getWebinarById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const r = await db.select().from(webinars).where(eq(webinars.id, id)).limit(1);
  return r[0];
}

export async function updateWebinar(id: number, data: Partial<InsertWebinar>) {
  const db = await getDb();
  if (!db) return;
  await db.update(webinars).set(data).where(eq(webinars.id, id));
}

export async function getWebinarAttendanceStats(webinarId: number) {
  const db = await getDb();
  if (!db) return { registered: 0, attended: 0, no_show: 0 };
  const rows = await db.select({
    status: leads.attendanceStatus,
    count: sql<number>`count(*)`,
  }).from(leads).where(eq(leads.webinarId, webinarId)).groupBy(leads.attendanceStatus);
  const stats = { registered: 0, attended: 0, no_show: 0 };
  rows.forEach((r) => {
    if (r.status === "registered") stats.registered = Number(r.count);
    if (r.status === "attended") stats.attended = Number(r.count);
    if (r.status === "no_show") stats.no_show = Number(r.count);
  });
  return stats;
}

// ─── Webinar Sessions ────────────────────────────────────────────────────────
export async function createWebinarSession(data: InsertWebinarSession) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const [r] = await db.insert(webinarSessions).values(data);
  return (r as any).insertId as number;
}

export async function getWebinarSessions(webinarId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(webinarSessions)
    .where(eq(webinarSessions.webinarId, webinarId))
    .orderBy(webinarSessions.sessionDate);
}

export async function deleteWebinarSessions(webinarId: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(webinarSessions).where(eq(webinarSessions.webinarId, webinarId));
}

export async function deleteWebinar(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(webinarSessions).where(eq(webinarSessions.webinarId, id));
  await db.delete(webinars).where(eq(webinars.id, id));
}
export async function deleteWebinars(ids: number[]) {
  const db = await getDb();
  if (!db) return;
  for (const id of ids) {
    await db.delete(webinarSessions).where(eq(webinarSessions.webinarId, id));
  }
  await db.delete(webinars).where(inArray(webinars.id, ids));
}

export async function getWebinarSessionById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const r = await db.select().from(webinarSessions).where(eq(webinarSessions.id, id)).limit(1);
  return r[0];
}

// ─── Landing Pages ────────────────────────────────────────────────────────────
export async function createLandingPage(data: InsertLandingPage) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const [r] = await db.insert(landingPages).values(data);
  return (r as any).insertId as number;
}

// MySQL may return JSON columns as raw strings — normalise them into arrays/objects
function normalizeLandingPage<T extends { enabledFields?: unknown }>(p: T): T {
  return {
    ...p,
    enabledFields: typeof p.enabledFields === "string"
      ? JSON.parse(p.enabledFields)
      : (p.enabledFields ?? ["firstName", "lastName", "email", "phone"]),
  };
}
export async function getLandingPages() {
  const db = await getDb();
  if (!db) return [];
  const rows = await db.select().from(landingPages).orderBy(desc(landingPages.createdAt));
  return rows.map(normalizeLandingPage);
}
export async function getLandingPagesWithLeadCount() {
  const db = await getDb();
  if (!db) return [];
  const pages = await db.select().from(landingPages).orderBy(desc(landingPages.createdAt));
  const counts = await db
    .select({ landingPageId: leads.landingPageId, count: sql<number>`count(*)` })
    .from(leads)
    .where(isNotNull(leads.landingPageId))
    .groupBy(leads.landingPageId);
  const countMap = new Map(counts.map(c => [c.landingPageId, Number(c.count)]));
  return pages.map(p => ({ ...normalizeLandingPage(p), leadCount: countMap.get(p.id) ?? 0 }));
}
export async function getLandingPageBySlug(slug: string) {
  const db = await getDb();
  if (!db) return undefined;
  const r = await db.select().from(landingPages).where(eq(landingPages.slug, slug)).limit(1);
  return r[0] ? normalizeLandingPage(r[0]) : undefined;
}
export async function getLandingPageById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const r = await db.select().from(landingPages).where(eq(landingPages.id, id)).limit(1);
  return r[0] ? normalizeLandingPage(r[0]) : undefined;
}

export async function updateLandingPage(id: number, data: Partial<InsertLandingPage>) {
  const db = await getDb();
  if (!db) return;
  await db.update(landingPages).set(data).where(eq(landingPages.id, id));
}

export async function deleteLandingPage(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(landingPages).where(eq(landingPages.id, id));
}

// ─── Activity Log ─────────────────────────────────────────────────────────────
export async function logActivity(data: InsertActivityLog) {
  const db = await getDb();
  if (!db) return;
  await db.insert(activityLog).values(data);
}

export async function getActivityByLeadId(leadId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(activityLog).where(eq(activityLog.leadId, leadId)).orderBy(desc(activityLog.createdAt));
}

// ─── SMS Messages ─────────────────────────────────────────────────────────────
export async function createSmsMessage(data: {
  leadId: number;
  direction: "outbound" | "inbound";
  body: string;
  status?: "queued" | "sent" | "delivered" | "failed" | "received";
  sentBy?: number;
}) {
  const db = await getDb();
  if (!db) return;
  await db.insert(smsMessages).values(data as any);
}

export async function getSmsByLeadId(leadId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(smsMessages).where(eq(smsMessages.leadId, leadId)).orderBy(smsMessages.createdAt);
}

// ─── Email Reminders ──────────────────────────────────────────────────────────
export async function createEmailReminder(data: {
  leadId: number;
  webinarId: number;
  type: typeof emailReminders.$inferInsert["type"];
  scheduledAt: Date;
  subject: string;
  body: string;
  attachmentUrl?: string;
}) {
  const db = await getDb();
  if (!db) return;
  await db.insert(emailReminders).values(data as any);
}

export async function getPendingReminders(before: Date) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(emailReminders)
    .where(and(eq(emailReminders.status, "pending"), lte(emailReminders.scheduledAt, before)));
}

export async function markReminderSent(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(emailReminders).set({ status: "sent", sentAt: new Date() }).where(eq(emailReminders.id, id));
}

export async function getRemindersByLead(leadId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(emailReminders).where(eq(emailReminders.leadId, leadId)).orderBy(emailReminders.scheduledAt);
}

// ─── Deals ────────────────────────────────────────────────────────────────────
export async function createDeal(data: InsertDeal) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const [r] = await db.insert(deals).values(data);
  return (r as any).insertId as number;
}

export async function getDeals(filters?: { assignedTo?: number; stage?: string; leadId?: number }) {
  const db = await getDb();
  if (!db) return [];
  const conditions = [];
  if (filters?.assignedTo) conditions.push(eq(deals.assignedTo, filters.assignedTo));
  if (filters?.stage) conditions.push(eq(deals.stage, filters.stage as any));
  if (filters?.leadId) conditions.push(eq(deals.leadId, filters.leadId));
  const where = conditions.length > 0 ? and(...conditions) : undefined;
  const rows = await db
    .select({
      id: deals.id,
      leadId: deals.leadId,
      assignedTo: deals.assignedTo,
      title: deals.title,
      value: deals.value,
      stage: deals.stage,
      propertyAddress: deals.propertyAddress,
      expectedCloseDate: deals.expectedCloseDate,
      actualCloseDate: deals.actualCloseDate,
      notes: deals.notes,
      createdAt: deals.createdAt,
      updatedAt: deals.updatedAt,
      leadFirstName: leads.firstName,
      leadLastName: leads.lastName,
      leadEmail: leads.email,
      leadPhone: leads.phone,
    })
    .from(deals)
    .innerJoin(leads, eq(deals.leadId, leads.id))
    .where(where)
    .orderBy(desc(deals.createdAt));
  return rows;
}
export async function getDealById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db
    .select({
      id: deals.id,
      leadId: deals.leadId,
      assignedTo: deals.assignedTo,
      title: deals.title,
      value: deals.value,
      stage: deals.stage,
      propertyAddress: deals.propertyAddress,
      expectedCloseDate: deals.expectedCloseDate,
      actualCloseDate: deals.actualCloseDate,
      notes: deals.notes,
      createdAt: deals.createdAt,
      updatedAt: deals.updatedAt,
      leadFirstName: leads.firstName,
      leadLastName: leads.lastName,
      leadEmail: leads.email,
      leadPhone: leads.phone,
    })
    .from(deals)
    .innerJoin(leads, eq(deals.leadId, leads.id))
    .where(eq(deals.id, id))
    .limit(1);
  return rows[0];
}

export async function updateDeal(id: number, data: Partial<InsertDeal>) {
  const db = await getDb();
  if (!db) return;
  await db.update(deals).set(data).where(eq(deals.id, id));
}

export async function getRevenueMetrics() {
  const db = await getDb();
  if (!db) return { totalPipeline: 0, closedRevenue: 0, avgDealSize: 0, dealsByStage: [] };
  const [metrics, byStage] = await Promise.all([
    db.select({
      totalPipeline: sql<number>`sum(value)`,
      closedRevenue: sql<number>`sum(case when stage = 'closed_won' then value else 0 end)`,
      avgDealSize: sql<number>`avg(value)`,
    }).from(deals),
    db.select({
      stage: deals.stage,
      count: sql<number>`count(*)`,
      total: sql<number>`sum(value)`,
    }).from(deals).groupBy(deals.stage),
  ]);
  return {
    totalPipeline: Number(metrics[0]?.totalPipeline ?? 0),
    closedRevenue: Number(metrics[0]?.closedRevenue ?? 0),
    avgDealSize: Number(metrics[0]?.avgDealSize ?? 0),
    dealsByStage: byStage.map((r) => ({ stage: r.stage, count: Number(r.count), total: Number(r.total) })),
  };
}

// ─── Scheduling ───────────────────────────────────────────────────────────────
export async function getAvailabilityByUser(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(availability).where(and(eq(availability.userId, userId), eq(availability.isActive, true)));
}

export async function upsertAvailability(userId: number, slots: { dayOfWeek: number; startTime: string; endTime: string }[]) {
  const db = await getDb();
  if (!db) return;
  await db.delete(availability).where(eq(availability.userId, userId));
  if (slots.length > 0) {
    await db.insert(availability).values(slots.map((s) => ({ ...s, userId, isActive: true })));
  }
}

export async function createBooking(data: InsertBooking) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const [r] = await db.insert(bookings).values(data);
  return (r as any).insertId as number;
}

export async function getBookings(userId?: number) {
  const db = await getDb();
  if (!db) return [];
  const where = userId ? eq(bookings.userId, userId) : undefined;
  return db.select().from(bookings).where(where).orderBy(desc(bookings.scheduledAt));
}

export async function getBookingsByDateRange(userId: number, start: Date, end: Date) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(bookings).where(
    and(eq(bookings.userId, userId), gte(bookings.scheduledAt, start), lte(bookings.scheduledAt, end))
  );
}

export async function getUserBySchedulingSlug(slug: string) {
  const db = await getDb();
  if (!db) return undefined;
  const r = await db.select().from(users).where(eq(users.schedulingSlug, slug)).limit(1);
  return r[0];
}

// ─── Integrations ─────────────────────────────────────────────────────────────
export async function getIntegration(userId: number, provider: "zoom" | "google_calendar" | "twilio" | "gmail") {
  const db = await getDb();
  if (!db) return undefined;
  const r = await db.select().from(integrations)
    .where(and(eq(integrations.userId, userId), eq(integrations.provider, provider))).limit(1);
  return r[0];
}

export async function upsertIntegration(data: {
  userId: number;
  provider: "zoom" | "google_calendar" | "twilio" | "gmail";
  accessToken?: string;
  refreshToken?: string;
  tokenExpiresAt?: Date;
  accountId?: string;
  accountEmail?: string;
  metadata?: Record<string, unknown>;
}) {
  const db = await getDb();
  if (!db) return;
  const existing = await getIntegration(data.userId, data.provider);
  if (existing) {
    await db.update(integrations).set(data as any).where(eq(integrations.id, existing.id));
  } else {
    await db.insert(integrations).values(data as any);
  }
}

export async function deleteIntegration(userId: number, provider: "zoom" | "google_calendar" | "twilio" | "gmail") {
  const db = await getDb();
  if (!db) return;
  await db.delete(integrations).where(and(eq(integrations.userId, userId), eq(integrations.provider, provider)));
}

// ─── Analytics ────────────────────────────────────────────────────────────────
export async function getDashboardMetrics() {
  const db = await getDb();
  if (!db) return null;
  const [
    totalLeads,
    leadsByStage,
    leadsBySource,
    closedDeals,
    revenueResult,
    webinarStats,
    recentLeads,
  ] = await Promise.all([
    db.select({ count: sql<number>`count(*)` }).from(leads),
    db.select({ stage: leads.stage, count: sql<number>`count(*)` }).from(leads).groupBy(leads.stage),
    db.select({ source: leads.source, count: sql<number>`count(*)` }).from(leads).groupBy(leads.source),
    db.select({ count: sql<number>`count(*)` }).from(leads).where(eq(leads.stage, "closed")),
    db.select({ total: sql<number>`sum(value)` }).from(deals).where(eq(deals.stage, "closed_won")),
    db.select({
      total: sql<number>`count(*)`,
      attended: sql<number>`sum(case when attendanceStatus = 'attended' then 1 else 0 end)`,
    }).from(leads).where(sql`attendanceStatus is not null`),
    db.select().from(leads).orderBy(desc(leads.createdAt)).limit(5),
  ]);
  const totalAttended = Number(webinarStats[0]?.attended ?? 0);
  const totalRegistered = Number(webinarStats[0]?.total ?? 0);
  return {
    totalLeads: Number(totalLeads[0]?.count ?? 0),
    closedDeals: Number(closedDeals[0]?.count ?? 0),
    closedRevenue: Number(revenueResult[0]?.total ?? 0),
    attendanceRate: totalRegistered > 0 ? Math.round((totalAttended / totalRegistered) * 100) : 0,
    leadsByStage: leadsByStage.map((r) => ({ stage: r.stage, count: Number(r.count) })),
    leadsBySource: leadsBySource.map((r) => ({ source: r.source ?? "Direct", count: Number(r.count) })),
    recentLeads,
  };
}

// ─── Lead Delete ──────────────────────────────────────────────────────────────
export async function deleteLead(id: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  // Delete related records first to avoid FK constraint issues
  await db.delete(activityLog).where(eq(activityLog.leadId, id));
  await db.delete(smsMessages).where(eq(smsMessages.leadId, id));
  await db.delete(emailReminders).where(eq(emailReminders.leadId, id));
  await db.delete(leads).where(eq(leads.id, id));
}

export async function deleteLeads(ids: number[]): Promise<void> {
  if (ids.length === 0) return;
  const db = await getDb();
  if (!db) return;
  await db.delete(activityLog).where(inArray(activityLog.leadId, ids));
  await db.delete(smsMessages).where(inArray(smsMessages.leadId, ids));
  await db.delete(emailReminders).where(inArray(emailReminders.leadId, ids));
  await db.delete(leads).where(inArray(leads.id, ids));
}

// ─── Pending Invites ──────────────────────────────────────────────────────────
export async function createInvite(data: InsertPendingInvite): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const [result] = await db.insert(pendingInvites).values(data).$returningId();
  return result!.id;
}

export async function getInviteByToken(token: string) {
  const db = await getDb();
  if (!db) return null;
  const [invite] = await db
    .select()
    .from(pendingInvites)
    .where(eq(pendingInvites.token, token))
    .limit(1);
  return invite ?? null;
}

export async function acceptInvite(token: string): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db
    .update(pendingInvites)
    .set({ acceptedAt: new Date() })
    .where(eq(pendingInvites.token, token));
}

export async function listInvites(invitedBy?: number) {
  const db = await getDb();
  if (!db) return [];
  const query = db.select().from(pendingInvites).orderBy(desc(pendingInvites.createdAt));
  return query;
}

export async function deleteInvite(id: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.delete(pendingInvites).where(eq(pendingInvites.id, id));
}

// ─── SMS Templates ────────────────────────────────────────────────────────────

const DEFAULT_SMS_TEMPLATES: Omit<InsertSmsTemplate, "createdBy">[] = [
  {
    trigger: "new_lead",
    body: "Hi {{firstName}}, thanks for your interest in Alta Mortgage! We'll be in touch shortly. Reply STOP to opt out.",
    isActive: true,
  },
  {
    trigger: "registered",
    body: "Hi {{firstName}}, you're registered for {{webinarTitle}} on {{sessionDate}}! Join link: {{joinUrl}}. Reply STOP to opt out.",
    isActive: true,
  },
  {
    trigger: "reminder_24h",
    body: "Hi {{firstName}}, reminder: {{webinarTitle}} is tomorrow at {{sessionTime}}. Join: {{joinUrl}}. Reply STOP to opt out.",
    isActive: true,
  },
  {
    trigger: "reminder_1h",
    body: "Hi {{firstName}}, {{webinarTitle}} starts in 1 hour! Join now: {{joinUrl}}. Reply STOP to opt out.",
    isActive: true,
  },
  {
    trigger: "attended",
    body: "Hi {{firstName}}, thanks for attending {{webinarTitle}}! Ready to take the next step? Book a free consultation: {{schedulingUrl}}. Reply STOP to opt out.",
    isActive: false,
  },
  {
    trigger: "no_show",
    body: "Hi {{firstName}}, we missed you at {{webinarTitle}}! Watch the replay: {{replayUrl}}. Questions? Reply here. Reply STOP to opt out.",
    isActive: false,
  },
  {
    trigger: "consultation_booked",
    body: "Hi {{firstName}}, your consultation with Clarke & Associates is confirmed for {{consultationDate}}. We look forward to speaking with you! Reply STOP to opt out.",
    isActive: true,
  },
  {
    trigger: "deal_closed",
    body: "Hi {{firstName}}, congratulations on your new home! It was a pleasure working with you. Please leave us a review: {{reviewUrl}}. Reply STOP to opt out.",
    isActive: false,
  },
];

export async function getSmsTemplates(): Promise<SmsTemplate[]> {
  const db = await getDb();
  if (!db) return [];
  const rows = await db.select().from(smsTemplates).orderBy(smsTemplates.trigger);
  // If no templates exist yet, seed defaults and return them
  if (rows.length === 0) {
    await db.insert(smsTemplates).values(DEFAULT_SMS_TEMPLATES);
    return db.select().from(smsTemplates).orderBy(smsTemplates.trigger);
  }
  return rows;
}

export async function getSmsTemplate(trigger: SmsTemplate["trigger"]): Promise<SmsTemplate | null> {
  const db = await getDb();
  if (!db) return null;
  const [row] = await db.select().from(smsTemplates).where(eq(smsTemplates.trigger, trigger)).limit(1);
  return row ?? null;
}

export async function upsertSmsTemplate(
  trigger: SmsTemplate["trigger"],
  body: string,
  isActive: boolean,
  createdBy?: number,
): Promise<void> {
  const db = await getDb();
  if (!db) return;
  const existing = await getSmsTemplate(trigger);
  if (existing) {
    await db.update(smsTemplates).set({ body, isActive, updatedAt: new Date() }).where(eq(smsTemplates.trigger, trigger));
  } else {
    await db.insert(smsTemplates).values({ trigger, body, isActive, createdBy });
  }
}

export async function resetSmsTemplate(trigger: SmsTemplate["trigger"]): Promise<void> {
  const db = await getDb();
  if (!db) return;
  const def = DEFAULT_SMS_TEMPLATES.find((t) => t.trigger === trigger);
  if (!def) return;
  await db.update(smsTemplates).set({ body: def.body, isActive: def.isActive, updatedAt: new Date() }).where(eq(smsTemplates.trigger, trigger));
}

// ─── Next Webinar for Lead ────────────────────────────────────────────────────
export async function getNextWebinarForLead(leadId: number) {
  const db = await getDb();
  if (!db) return null;
  // First check if the lead has a specific join URL stored (from registration)
  const lead = await getLeadById(leadId);
  if (!lead) return null;

  // If lead has a stored join URL, return it with the webinar info
  if (lead.zoomJoinUrl && lead.webinarId) {
    const webinar = await getWebinarById(lead.webinarId);
    let sessionDate: Date | null = null;
    if (lead.webinarSessionId) {
      const sessions = await getWebinarSessions(lead.webinarId);
      const session = sessions.find((s) => s.id === lead.webinarSessionId);
      if (session) sessionDate = new Date(session.sessionDate);
    } else if (webinar?.scheduledAt) {
      sessionDate = new Date(webinar.scheduledAt);
    }
    return {
      joinUrl: lead.zoomJoinUrl,
      webinarTitle: webinar?.title ?? "Upcoming Webinar",
      sessionDate,
    };
  }

  // Otherwise, find the next upcoming webinar session across all webinars
  const now = new Date();
  const upcomingSessions = await db
    .select({
      sessionId: webinarSessions.id,
      sessionDate: webinarSessions.sessionDate,
      zoomJoinUrl: webinarSessions.zoomJoinUrl,
      webinarId: webinarSessions.webinarId,
    })
    .from(webinarSessions)
    .where(sql`${webinarSessions.sessionDate} > ${now}`)
    .orderBy(webinarSessions.sessionDate)
    .limit(1);

  if (upcomingSessions.length > 0) {
    const s = upcomingSessions[0];
    const webinar = s.webinarId ? await getWebinarById(s.webinarId) : undefined;
    return {
      joinUrl: s.zoomJoinUrl ?? webinar?.zoomJoinUrl ?? null,
      webinarTitle: webinar?.title ?? "Upcoming Webinar",
      sessionDate: s.sessionDate ? new Date(s.sessionDate) : null,
    };
  }

  return null;
}
