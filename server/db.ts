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
let _pool: mysql2.Pool | null = null;
let _dbInitError: string | null = null;

/**
 * Returns the Drizzle database instance.
 * Uses an explicit mysql2 connection pool so SSL options can be injected
 * for remote hosts (e.g. Hostinger) that require encrypted connections.
 * Throws with a descriptive message when DATABASE_URL is missing or the
 * connection cannot be established.
 */
/** Returns the raw mysql2 pool for executing raw SQL that bypasses Drizzle's query builder. */
export async function getPool(): Promise<mysql2.Pool> {
  await getDb(); // ensure pool is initialized
  if (!_pool) throw new Error("DB pool unavailable");
  return _pool;
}

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

    _pool = pool;
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

export async function getUserById(id: number) {
  const db = await getDb();
  if (!db) return null;
  const [user] = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return user ?? null;
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
  externalId?: string;
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

/**
 * Find an integration by provider regardless of which user saved it.
 * Useful for shared org-wide credentials like Zoom S2S OAuth.
 */
export async function getGlobalIntegration(provider: "zoom" | "google_calendar" | "twilio" | "gmail") {
  const db = await getDb();
  if (!db) return undefined;
  const r = await db.select().from(integrations)
    .where(eq(integrations.provider, provider)).limit(1);
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
    // Sent immediately when a new lead submits a landing page form or is added manually.
    trigger: "new_lead",
    body: "Hi {{first_name}}, thanks for your interest in Clarke & Associates! We help families navigate the home-buying process with confidence. A member of our team will reach out to you shortly. Reply STOP to opt out.",
    isActive: true,
  },
  {
    // Sent as soon as a lead registers for a webinar session.
    trigger: "registered",
    body: "Hi {{first_name}}, you're registered for {{webinar_title}} on {{session_date}}! We're excited to have you join us. Your link to attend: {{webinar_link}}. Add it to your calendar so you don't miss it! Reply STOP to opt out.",
    isActive: true,
  },
  {
    // Sent 24 hours before the webinar starts.
    trigger: "reminder_24h",
    body: "Hi {{first_name}}, your webinar {{webinar_title}} is TOMORROW on {{session_date}}! We have some great information prepared for you. Your join link: {{webinar_link}}. See you there! Reply STOP to opt out.",
    isActive: true,
  },
  {
    // Sent 1 hour before the webinar starts.
    trigger: "reminder_1h",
    body: "Hi {{first_name}}, {{webinar_title}} starts in 1 HOUR! Don't miss out — join us here: {{webinar_link}}. We're looking forward to seeing you! Reply STOP to opt out.",
    isActive: true,
  },
  {
    // Sent after the webinar to leads who attended.
    trigger: "attended",
    body: "Hi {{first_name}}, thank you for attending {{webinar_title}} today! We hope you found it valuable. Ready to take the next step toward homeownership? Reply to this message or call us to schedule a free consultation. Reply STOP to opt out.",
    isActive: true,
  },
  {
    // Sent after the webinar to leads who registered but did not attend.
    trigger: "no_show",
    body: "Hi {{first_name}}, we missed you at {{webinar_title}}! Life gets busy — we understand. We'd love to connect and share what you missed. Reply here to get the replay or to schedule a quick call with our team. Reply STOP to opt out.",
    isActive: true,
  },
  {
    // Sent when a lead books a consultation appointment.
    trigger: "consultation_booked",
    body: "Hi {{first_name}}, your consultation with Clarke & Associates Mortgage is confirmed! Please check your email for the meeting details and any documents to review beforehand. We look forward to speaking with you soon. Reply STOP to opt out.",
    isActive: true,
  },
  {
    // Sent when a deal is marked as under contract.
    trigger: "under_contract",
    body: "Hi {{first_name}}, exciting news — you're officially under contract! Congratulations! The Clarke & Associates team is here to guide you through every step of the closing process. We'll be in touch with next steps shortly. Reply STOP to opt out.",
    isActive: true,
  },
  {
    // Sent when a deal is closed/won.
    trigger: "deal_closed",
    body: "Hi {{first_name}}, CONGRATULATIONS on closing your home! 🏠 It has been a true pleasure working with you at Clarke & Associates Mortgage. Wishing you many happy years in your new home. Please don't hesitate to refer friends and family our way! Reply STOP to opt out.",
    isActive: true,
  },
];

/**
 * Replace legacy camelCase placeholder names with the canonical snake_case names
 * that the SMS send procedure resolves. Safe to run on every startup — it only
 * touches rows that still contain the old names.
 */
export async function migrateDefaultSmsTemplates(): Promise<void> {
  const db = await getDb();
  if (!db) return;
  // Map of old placeholder → new canonical placeholder
  const RENAMES: [RegExp, string][] = [
    [/\{\{firstName\}\}/g, "{{first_name}}"],
    [/\{\{lastName\}\}/g, "{{last_name}}"],
    [/\{\{fullName\}\}/g, "{{full_name}}"],
    [/\{\{webinarTitle\}\}/g, "{{webinar_title}}"],
    [/\{\{sessionDate\}\}/g, "{{session_date}}"],
    [/\{\{sessionTime\}\}/g, "{{session_date}}"],
    [/\{\{joinUrl\}\}/g, "{{webinar_link}}"],
    [/\{\{replayUrl\}\}/g, "{{webinar_link}}"],
    [/\{\{schedulingUrl\}\}/g, "{{webinar_link}}"],
    [/\{\{consultationDate\}\}/g, "{{session_date}}"],
    [/\{\{reviewUrl\}\}/g, "{{webinar_link}}"],
  ];

  const rows = await db.select().from(smsTemplates);
  for (const row of rows) {
    let updated = row.body;
    for (const [pattern, replacement] of RENAMES) {
      updated = updated.replace(pattern, replacement);
    }
    if (updated !== row.body) {
      await db
        .update(smsTemplates)
        .set({ body: updated, updatedAt: new Date() })
        .where(eq(smsTemplates.trigger, row.trigger));
    }
  }

  // NOTE: We do NOT auto-reset template bodies here — users may have customised
  // them and we must not overwrite their changes on server restart.
}

export async function getSmsTemplates(): Promise<SmsTemplate[]> {
  const db = await getDb();
  if (!db) return [];
  const rows = await db.select().from(smsTemplates).orderBy(smsTemplates.trigger);
  // If no templates exist yet, seed defaults and return them
  if (rows.length === 0) {
    // Use raw pool to avoid Drizzle DEFAULT keyword issue on some MySQL versions
    const pool = await getPool();
    for (const t of DEFAULT_SMS_TEMPLATES) {
      await pool.execute(
        "INSERT INTO `sms_templates` (`trigger`, `body`, `isActive`) VALUES (?, ?, ?)",
        [t.trigger, t.body, t.isActive ? 1 : 0],
      );
    }
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
    // Use raw pool to avoid Drizzle DEFAULT keyword issue on some MySQL versions
    const pool = await getPool();
    if (createdBy !== undefined) {
      await pool.execute(
        "INSERT INTO `sms_templates` (`trigger`, `body`, `isActive`, `createdBy`) VALUES (?, ?, ?, ?)",
        [trigger, body, isActive ? 1 : 0, createdBy],
      );
    } else {
      await pool.execute(
        "INSERT INTO `sms_templates` (`trigger`, `body`, `isActive`) VALUES (?, ?, ?)",
        [trigger, body, isActive ? 1 : 0],
      );
    }
  }
}

export async function resetSmsTemplate(trigger: SmsTemplate["trigger"]): Promise<void> {
  const db = await getDb();
  if (!db) return;
  const def = DEFAULT_SMS_TEMPLATES.find((t) => t.trigger === trigger);
  if (!def) return;
  await db.update(smsTemplates).set({ body: def.body, isActive: def.isActive, updatedAt: new Date() }).where(eq(smsTemplates.trigger, trigger));
}

export async function createSmsTemplate(
  trigger: SmsTemplate["trigger"],
  body: string,
  isActive: boolean,
  createdBy?: number,
  emailSubject?: string,
): Promise<SmsTemplate> {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  // Use raw pool to avoid Drizzle emitting DEFAULT keyword for auto-columns,
  // which fails on some MySQL versions (e.g., Hostinger shared hosting).
  const pool = await getPool();
  if (createdBy !== undefined) {
    await pool.execute(
      "INSERT INTO `sms_templates` (`trigger`, `body`, `isActive`, `createdBy`, `emailSubject`) VALUES (?, ?, ?, ?, ?)",
      [trigger, body, isActive ? 1 : 0, createdBy, emailSubject ?? null],
    );
  } else {
    await pool.execute(
      "INSERT INTO `sms_templates` (`trigger`, `body`, `isActive`, `emailSubject`) VALUES (?, ?, ?, ?)",
      [trigger, body, isActive ? 1 : 0, emailSubject ?? null],
    );
  }
  const [rows] = await pool.execute(
    "SELECT * FROM `sms_templates` WHERE `id` = LAST_INSERT_ID() LIMIT 1",
  );
  const row = Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
  return row as SmsTemplate;
}

export async function updateSmsTemplate(
  id: number,
  body: string,
  isActive: boolean,
  emailSubject?: string | null,
): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.update(smsTemplates).set({ body, isActive, emailSubject: emailSubject ?? null, updatedAt: new Date() }).where(eq(smsTemplates.id, id));
}

export async function deleteSmsTemplate(id: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.delete(smsTemplates).where(eq(smsTemplates.id, id));
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

// ─── Admin SMS Notifications ──────────────────────────────────────────────────

/**
 * Returns the first active Telnyx integration row found in the database,
 * regardless of which admin user created it. Telnyx is an org-wide integration
 * so we don't need to scope it to a specific userId here.
 */
export async function getAnyTelnyxConfig() {
  const db = await getDb();
  if (!db) return null;
  const rows = await db
    .select()
    .from(integrations)
    .where(eq(integrations.provider, "twilio")) // stored under "twilio" provider key
    .limit(10);
  // Return the first row that has both an API key (accessToken) and a from-number (accountEmail)
  return rows.find((r) => r.accessToken && r.accountEmail) ?? null;
}

/**
 * Returns all admin-role users who have a phone number stored on their profile.
 * These are the recipients for internal admin SMS notifications.
 */
export async function getAdminUsersWithPhone() {
  const db = await getDb();
  if (!db) return [];
  return db
    .select({ id: users.id, name: users.name, phone: users.phone })
    .from(users)
    .where(and(eq(users.role, "admin"), isNotNull(users.phone)));
}

/**
 * Fire-and-forget: sends an SMS to every admin who has a phone number,
 * using the configured Telnyx integration. Errors are logged but never thrown.
 *
 * @param message  The text body to send (plain string, no placeholders).
 */
export async function notifyAdminsBySms(message: string): Promise<void> {
  try {
    const config = await getAnyTelnyxConfig();
    if (!config) return; // Telnyx not configured — silently skip

    const meta = config.metadata as { enabled?: boolean } | null;
    if (meta?.enabled === false) return; // SMS disabled — silently skip

    const admins = await getAdminUsersWithPhone();
    if (admins.length === 0) return; // No admins with phone numbers — silently skip

    const fromPhone = config.accountEmail!; // accountEmail stores the from-number
    const apiKey = config.accessToken!;

    await Promise.allSettled(
      admins.map(async (admin) => {
        let toPhone = admin.phone!.trim().replace(/[\s\-().]/g, "");
        if (!toPhone.startsWith("+")) toPhone = `+1${toPhone}`;
        await fetch("https://api.telnyx.com/v2/messages", {
          method: "POST",
          headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({ from: fromPhone, to: toPhone, text: message }),
        });
      }),
    );
  } catch (err) {
    console.error("[notifyAdminsBySms] Error sending admin notification:", err);
  }
}

/**
 * Resolve and send an SMS template to a specific lead via Telnyx.
 * - Skips silently if the template is inactive, the lead has no phone, or Telnyx is not configured.
 * - Resolves {{first_name}}, {{webinar_title}}, {{session_date}}, {{webinar_link}} placeholders.
 * - Logs the sent message to sms_messages and the activity log.
 * - Never throws — errors are caught and logged so callers are never blocked.
 */
export async function sendLeadSms(
  leadId: number,
  trigger: SmsTemplate["trigger"],
  sentByUserId?: number,
): Promise<void> {
  try {
    const [template, lead, config] = await Promise.all([
      getSmsTemplate(trigger),
      getLeadById(leadId),
      getAnyTelnyxConfig(),
    ]);
    if (!template || !template.isActive) return;
    if (!lead?.phone) return;
    if (!config?.accessToken || !config?.accountEmail) return;
    const meta = config.metadata as { enabled?: boolean } | null;
    if (meta?.enabled === false) return;
    if (!lead.smsConsent) return;

    // Resolve placeholders
    let body = template.body;
    body = body.replace(/\{\{first_name\}\}/g, lead.firstName ?? "there");
    body = body.replace(/\{\{last_name\}\}/g, lead.lastName ?? "");
    body = body.replace(/\{\{full_name\}\}/g, [lead.firstName, lead.lastName].filter(Boolean).join(" ") || "there");

    // Resolve webinar-specific placeholders if the lead is linked to a webinar
    if (lead.webinarId) {
      const webinar = await getWebinarById(lead.webinarId);
      if (webinar) {
        body = body.replace(/\{\{webinar_title\}\}/g, webinar.title ?? "");
        body = body.replace(/\{\{webinar_link\}\}/g, webinar.zoomJoinUrl ?? webinar.replayUrl ?? "");
      }
    }
    if (lead.webinarSessionId) {
      const session = await getWebinarSessionById(lead.webinarSessionId);
      if (session) {
        body = body.replace(/\{\{session_date\}\}/g, new Date(session.sessionDate).toLocaleString("en-US", {
          month: "long", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit",
        }));
        // Override webinar_link with session-specific join URL if available
        if (session.zoomJoinUrl) body = body.replace(/\{\{webinar_link\}\}/g, session.zoomJoinUrl);
      }
    }
    // Strip any unresolved placeholders
    body = body.replace(/\{\{[^}]+\}\}/g, "");

    // Normalize phone numbers to E.164
    let toPhone = lead.phone.trim().replace(/[\s\-().]/g, "");
    if (!toPhone.startsWith("+")) toPhone = `+1${toPhone}`;
    let fromPhone = config.accountEmail.trim().replace(/[\s\-().]/g, "");
    if (!fromPhone.startsWith("+")) fromPhone = `+1${fromPhone}`;

    const res = await fetch("https://api.telnyx.com/v2/messages", {
      method: "POST",
      headers: { Authorization: `Bearer ${config.accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: fromPhone, to: toPhone, text: body }),
    });

    if (res.ok) {
      const db = await getDb();
      if (db) {
        await createSmsMessage({ leadId, direction: "outbound", body, status: "sent", sentBy: sentByUserId });
        await logActivity({
          leadId,
          userId: sentByUserId,
          type: "sms_sent",
          title: `Auto SMS sent (${trigger})`,
          content: body,
        });
      }
    } else {
      const err = await res.json().catch(() => ({})) as { errors?: Array<{ detail?: string }> };
      console.error(`[sendLeadSms] Telnyx error for lead ${leadId} trigger ${trigger}:`, err.errors?.[0]?.detail ?? res.status);
    }
  } catch (err) {
    console.error(`[sendLeadSms] Unexpected error for lead ${leadId} trigger ${trigger}:`, err);
  }
}

/**
 * Send an email to a lead using the active SMS template body as the email body.
 * Falls back gracefully if no email is configured or lead has no email.
 */
export async function sendLeadEmail(
  leadId: number,
  trigger: SmsTemplate["trigger"],
  sentByUserId?: number,
): Promise<void> {
  try {
    const { sendEmail } = await import("./emailService");
    const [template, lead] = await Promise.all([
      getSmsTemplate(trigger),
      getLeadById(leadId),
    ]);
    if (!template || !template.isActive) return;
    if (!lead?.email) return;

    // Resolve placeholders (same logic as sendLeadSms)
    let body = template.body;
    body = body.replace(/\{\{first_name\}\}/g, lead.firstName ?? "there");
    body = body.replace(/\{\{last_name\}\}/g, lead.lastName ?? "");
    body = body.replace(/\{\{full_name\}\}/g, [lead.firstName, lead.lastName].filter(Boolean).join(" ") || "there");

    if (lead.webinarId) {
      const webinar = await getWebinarById(lead.webinarId);
      if (webinar) {
        body = body.replace(/\{\{webinar_title\}\}/g, webinar.title ?? "");
        body = body.replace(/\{\{webinar_link\}\}/g, webinar.zoomJoinUrl ?? webinar.replayUrl ?? "");
      }
    }
    if (lead.webinarSessionId) {
      const session = await getWebinarSessionById(lead.webinarSessionId);
      if (session) {
        body = body.replace(/\{\{session_date\}\}/g, new Date(session.sessionDate).toLocaleString("en-US", {
          month: "long", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit",
        }));
        if (session.zoomJoinUrl) body = body.replace(/\{\{webinar_link\}\}/g, session.zoomJoinUrl);
      }
    }
    body = body.replace(/\{\{[^}]+\}\}/g, "");

    // Build a subject line from the trigger
    const subjectMap: Record<string, string> = {
      new_lead: "Welcome to Clarke & Associates Mortgage!",
      registered: "You're Registered — Here's Your Webinar Info",
      reminder_24h: "Reminder: Your Webinar is Tomorrow",
      reminder_1h: "Starting Soon: Your Webinar Begins in 1 Hour",
      attended: "Thank You for Attending!",
      no_show: "We Missed You — Here's the Replay",
      consultation_booked: "Your Consultation is Confirmed",
      under_contract: "Congratulations — You're Under Contract!",
      deal_closed: "Congratulations on Your New Home!",
    };
    const subject = subjectMap[trigger] ?? "Message from Clarke & Associates Mortgage";

    // Convert plain text to basic HTML
    const html = `<p>${body.replace(/\n/g, "<br>")}</p>`;

    await sendEmail({ to: lead.email, subject, body: html });

    const db = await getDb();
    if (db) {
      await logActivity({
        leadId,
        userId: sentByUserId,
        type: "email_sent",
        title: `Auto email sent (${trigger})`,
        content: body,
      });
    }
  } catch (err) {
    console.error(`[sendLeadEmail] Unexpected error for lead ${leadId} trigger ${trigger}:`, err);
  }
}

/**
 * Fire both SMS and email for a lead trigger simultaneously.
 * SMS is only sent if lead has phone + smsConsent.
 * Email is only sent if lead has email + Gmail is configured.
 */
export async function sendLeadNotifications(
  leadId: number,
  trigger: SmsTemplate["trigger"],
  sentByUserId?: number,
): Promise<void> {
  await Promise.all([
    sendLeadSms(leadId, trigger, sentByUserId),
    sendLeadEmail(leadId, trigger, sentByUserId),
  ]);
}

// ─── SMS Inbox helpers ────────────────────────────────────────────────────────

/** Returns one row per lead that has at least one SMS message, with the latest message body/time and unread count */
export async function getSmsConversations() {
  const db = await getDb();
  if (!db) return [];
  // Get all leads that have SMS messages
  const rows = await db
    .select({
      leadId: smsMessages.leadId,
      lastBody: smsMessages.body,
      lastDirection: smsMessages.direction,
      lastAt: smsMessages.createdAt,
    })
    .from(smsMessages)
    .orderBy(desc(smsMessages.createdAt));

  // Deduplicate: keep only the latest message per lead
  const seen = new Set<number>();
  const latest: typeof rows = [];
  for (const row of rows) {
    if (!seen.has(row.leadId)) {
      seen.add(row.leadId);
      latest.push(row);
    }
  }

  // Count unread (inbound + no readAt) per lead
  const unreadRows = await db
    .select({ leadId: smsMessages.leadId, count: smsMessages.id })
    .from(smsMessages)
    .where(and(eq(smsMessages.direction, "inbound"), eq(smsMessages.status, "received")));

  const unreadMap: Record<number, number> = {};
  for (const r of unreadRows) {
    unreadMap[r.leadId] = (unreadMap[r.leadId] ?? 0) + 1;
  }

  // Attach lead info
  const allLeads = await db.select().from(leads);
  const leadMap = Object.fromEntries(allLeads.map((l) => [l.id, l]));

  return latest.map((row) => ({
    leadId: row.leadId,
    leadName: leadMap[row.leadId] ? `${leadMap[row.leadId].firstName} ${leadMap[row.leadId].lastName}` : "Unknown",
    leadPhone: leadMap[row.leadId]?.phone ?? "",
    lastBody: row.lastBody,
    lastDirection: row.lastDirection,
    lastAt: row.lastAt,
    unread: unreadMap[row.leadId] ?? 0,
  }));
}

/** Mark all inbound messages for a lead as read (status -> delivered) */
export async function markSmsRead(leadId: number) {
  const db = await getDb();
  if (!db) return;
  await db
    .update(smsMessages)
    .set({ status: "delivered" })
    .where(and(eq(smsMessages.leadId, leadId), eq(smsMessages.direction, "inbound"), eq(smsMessages.status, "received")));
}


// ─── Auto-Migrations ─────────────────────────────────────────────────────────
// Runs safe ALTER TABLE statements on startup to ensure the production DB
// schema matches what the code expects. Each migration checks if the column
// already exists before adding it, so it's idempotent and safe to run
// on every server start.
export async function runAutoMigrations(): Promise<void> {
  const db = await getDb();
  if (!db) return;

  const migrations: { table: string; column: string; sql: string }[] = [
    // 0010: Add zoomWebinarId to webinar_sessions
    {
      table: "webinar_sessions",
      column: "zoomWebinarId",
      sql: "ALTER TABLE `webinar_sessions` ADD COLUMN `zoomWebinarId` varchar(256) DEFAULT NULL",
    },
    // 0010: Add replayUrl to webinar_sessions
    {
      table: "webinar_sessions",
      column: "replayUrl",
      sql: "ALTER TABLE `webinar_sessions` ADD COLUMN `replayUrl` text DEFAULT NULL",
    },
    // 0011: Add artworkPosition to landing_pages
    {
      table: "landing_pages",
      column: "artworkPosition",
      sql: "ALTER TABLE `landing_pages` ADD COLUMN `artworkPosition` varchar(64) DEFAULT 'center'",
    },
    // 0012: Add bgOverlayOpacity to landing_pages
    {
      table: "landing_pages",
      column: "bgOverlayOpacity",
      sql: "ALTER TABLE `landing_pages` ADD COLUMN `bgOverlayOpacity` DECIMAL(3,2) DEFAULT 0.50",
    },
    // 0013: Add enabledFields to landing_pages
    {
      table: "landing_pages",
      column: "enabledFields",
      sql: "ALTER TABLE `landing_pages` ADD COLUMN `enabledFields` json DEFAULT NULL",
    },
    // 0014: Add optInLabel to landing_pages
    {
      table: "landing_pages",
      column: "optInLabel",
      sql: "ALTER TABLE `landing_pages` ADD COLUMN `optInLabel` text DEFAULT NULL",
    },
    // 0015: Add showOptIn to landing_pages
    {
      table: "landing_pages",
      column: "showOptIn",
      sql: "ALTER TABLE `landing_pages` ADD COLUMN `showOptIn` tinyint(1) DEFAULT 1",
    },
    // 0016: Add confirmationEmailSubject to landing_pages
    {
      table: "landing_pages",
      column: "confirmationEmailSubject",
      sql: "ALTER TABLE `landing_pages` ADD COLUMN `confirmationEmailSubject` varchar(512) DEFAULT NULL",
    },
    // 0017: Add confirmationEmailBody to landing_pages
    {
      table: "landing_pages",
      column: "confirmationEmailBody",
      sql: "ALTER TABLE `landing_pages` ADD COLUMN `confirmationEmailBody` text DEFAULT NULL",
    },
    // 0018: Add confirmationPdfUrl to landing_pages
    {
      table: "landing_pages",
      column: "confirmationPdfUrl",
      sql: "ALTER TABLE `landing_pages` ADD COLUMN `confirmationPdfUrl` text DEFAULT NULL",
    },
    // 0019: Add bodyText to landing_pages
    {
      table: "landing_pages",
      column: "bodyText",
      sql: "ALTER TABLE `landing_pages` ADD COLUMN `bodyText` text DEFAULT NULL",
    },
    // 0020: Add artworkUrl to landing_pages
    {
      table: "landing_pages",
      column: "artworkUrl",
      sql: "ALTER TABLE `landing_pages` ADD COLUMN `artworkUrl` text DEFAULT NULL",
    },
    // 0021: Add customCss to landing_pages
    {
      table: "landing_pages",
      column: "customCss",
      sql: "ALTER TABLE `landing_pages` ADD COLUMN `customCss` text DEFAULT NULL",
    },
    // 0022: Add accentColor to landing_pages
    {
      table: "landing_pages",
      column: "accentColor",
      sql: "ALTER TABLE `landing_pages` ADD COLUMN `accentColor` varchar(16) DEFAULT '#C9A84C'",
    },
    // 0023: Add backgroundImageUrl to landing_pages
    {
      table: "landing_pages",
      column: "backgroundImageUrl",
      sql: "ALTER TABLE `landing_pages` ADD COLUMN `backgroundImageUrl` text DEFAULT NULL",
    },
    // 0024: Add emailSubject to sms_templates (for registration confirmation email subject)
    {
      table: "sms_templates",
      column: "emailSubject",
      sql: "ALTER TABLE `sms_templates` ADD COLUMN `emailSubject` varchar(512) DEFAULT NULL",
    },
  ];

  for (const m of migrations) {
    try {
      // Check if column already exists
      const [rows] = await (db as any).execute(
        `SELECT COUNT(*) as cnt FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = '${m.table}' AND COLUMN_NAME = '${m.column}'`
      );
      const exists = Array.isArray(rows) && (rows as any)[0]?.cnt > 0;
      if (!exists) {
        await (db as any).execute(m.sql);
        console.log(`[Auto-Migration] Added column ${m.table}.${m.column}`);
      }
    } catch (err) {
      // Column might already exist (duplicate column error 1060) — that's fine
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("Duplicate column")) {
        // Already exists, skip
      } else {
        console.error(`[Auto-Migration] Failed to add ${m.table}.${m.column}:`, msg);
      }
    }
  }

  console.log("[Auto-Migration] Schema check complete");
}
