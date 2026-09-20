import {
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  varchar,
  boolean,
  decimal,
  json,
} from "drizzle-orm/mysql-core";

// ─── Users ───────────────────────────────────────────────────────────────────
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }).unique(),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  schedulingSlug: varchar("schedulingSlug", { length: 64 }),
  avatarUrl: text("avatarUrl"),
  phone: varchar("phone", { length: 32 }),
  passwordHash: text("passwordHash"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// ─── Integrations (Zoom, Google Calendar) ────────────────────────────────────
export const integrations = mysqlTable("integrations", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  provider: mysqlEnum("provider", ["zoom", "google_calendar", "twilio", "gmail"]).notNull(),
  accessToken: text("accessToken"),
  refreshToken: text("refreshToken"),
  tokenExpiresAt: timestamp("tokenExpiresAt"),
  accountId: varchar("accountId", { length: 256 }),
  accountEmail: varchar("accountEmail", { length: 320 }),
  metadata: json("metadata"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Integration = typeof integrations.$inferSelect;

// ─── Webinars ─────────────────────────────────────────────────────────────────
export const webinars = mysqlTable("webinars", {
  id: int("id").autoincrement().primaryKey(),
  createdBy: int("createdBy").notNull(),
  title: varchar("title", { length: 512 }).notNull(),
  description: text("description"),
  scheduledAt: timestamp("scheduledAt").notNull(),
  durationMinutes: int("durationMinutes").default(60),
  zoomWebinarId: varchar("zoomWebinarId", { length: 256 }),
  zoomJoinUrl: text("zoomJoinUrl"),
  zoomStartUrl: text("zoomStartUrl"),
  replayUrl: text("replayUrl"),
  googleCalendarEventId: varchar("googleCalendarEventId", { length: 256 }),
  // Link to auto-created landing page
  landingPageId: int("landingPageId"),
  status: mysqlEnum("status", ["draft", "scheduled", "live", "completed", "cancelled"]).default("draft").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Webinar = typeof webinars.$inferSelect;
export type InsertWebinar = typeof webinars.$inferInsert;

// ─── Webinar Sessions (multiple dates for a webinar) ─────────────────────────
export const webinarSessions = mysqlTable("webinar_sessions", {
  id: int("id").autoincrement().primaryKey(),
  webinarId: int("webinarId").notNull(),
  sessionDate: timestamp("sessionDate").notNull(),
  durationMinutes: int("durationMinutes").default(60),
  maxAttendees: int("maxAttendees"),
  zoomWebinarId: varchar("zoomWebinarId", { length: 256 }),
  zoomJoinUrl: text("zoomJoinUrl"),
  zoomStartUrl: text("zoomStartUrl"),
  replayUrl: text("replayUrl"),
  label: varchar("label", { length: 256 }), // e.g. "Morning Session", "Evening Session"
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type WebinarSession = typeof webinarSessions.$inferSelect;
export type InsertWebinarSession = typeof webinarSessions.$inferInsert;

// ─── Landing Pages ────────────────────────────────────────────────────────────
export const landingPages = mysqlTable("landing_pages", {
  id: int("id").autoincrement().primaryKey(),
  createdBy: int("createdBy").notNull(),
  title: varchar("title", { length: 512 }).notNull(),
  slug: varchar("slug", { length: 128 }).notNull().unique(),
  headline: text("headline"),
  subheadline: text("subheadline"),
  ctaText: varchar("ctaText", { length: 256 }),
  campaignTag: varchar("campaignTag", { length: 128 }),
  sourceTag: varchar("sourceTag", { length: 128 }),
  webinarId: int("webinarId"),
  isActive: boolean("isActive").default(true).notNull(),
  customCss: text("customCss"),
  backgroundImageUrl: text("backgroundImageUrl"),
  accentColor: varchar("accentColor", { length: 16 }).default("#C9A84C"),
  textColor: varchar("textColor", { length: 16 }).default("#FFFFFF"),
  // NEW: Artwork / hero image uploaded by host
  artworkUrl: text("artworkUrl"),
  // NEW: Standalone HTML background uploaded for the landing page
  backgroundHtmlUrl: text("backgroundHtmlUrl"),
  // NEW: Background image focal point position (CSS object-position value)
  artworkPosition: varchar("artworkPosition", { length: 64 }).default("center"),
  // NEW: Configurable form fields (JSON array of enabled fields)
  // e.g. ["firstName","lastName","email","phone","sessionSelect","optIn"]
  enabledFields: json("enabledFields"),
  // NEW: Opt-in consent label text
  optInLabel: text("optInLabel"),
  // NEW: Whether opt-in checkbox is shown
  showOptIn: boolean("showOptIn").default(true),
  // NEW: Confirmation email settings
  confirmationEmailSubject: varchar("confirmationEmailSubject", { length: 512 }),
  confirmationEmailBody: text("confirmationEmailBody"),
  // NEW: PDF attachment URL for confirmation email
  confirmationPdfUrl: text("confirmationPdfUrl"),
  // NEW: Body text / description for the landing page
  bodyText: text("bodyText"),
  // NEW: Background overlay opacity (0.0 = fully transparent, 1.0 = fully opaque dark overlay)
  bgOverlayOpacity: decimal("bgOverlayOpacity", { precision: 3, scale: 2 }).default("0.50"),
  // NEW: Logo size in pixels (height). Default 64px.
  logoSize: int("logoSize").default(64),
  // NEW: Show logo overlaid on top of the HTML background (above the iframe)
  logoOnHtmlBackground: boolean("logoOnHtmlBackground").default(false),
  // NEW: Embed the registration form directly into the HTML background template
  formEmbedded: boolean("formEmbedded").default(false),

  // Whether the CRM lead-capture form is rendered at all. Off = an uploaded
  // HTML page is shown exactly as uploaded and submissions are refused.
  formEnabled: boolean("formEnabled").default(true).notNull(),
  // Whether the 10DLC SMS-consent checkbox accompanies the phone field. Off =
  // phone is still collected but no consent is asked and no opt-in text is sent.
  smsConsentEnabled: boolean("smsConsentEnabled").default(true).notNull(),
  // Tracking snippets (Meta pixel, Google tag, ...) injected into <head> on
  // the public page only. Staff-entered, so treated as trusted markup.
  headScripts: text("headScripts"),


  // ─── Tracking / attribution ───────────────────────────────────────────────
  // Template this page was stamped out from (null for hand-built pages)
  templateId: int("templateId"),
  // Campaign that owns this page — drives the "one campaign, one page" wiring
  campaignId: int("campaignId"),
  // Per-page pixel override; falls back to the global meta_settings pixel
  metaPixelId: varchar("metaPixelId", { length: 64 }),
  trackingEnabled: boolean("trackingEnabled").default(true),
  capiEnabled: boolean("capiEnabled").default(true),
  // Meta standard event fired on submit
  conversionEventName: varchar("conversionEventName", { length: 64 }).default("Lead"),
  // Estimated value reported with the conversion event
  conversionValue: decimal("conversionValue", { precision: 12, scale: 2 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type LandingPage = typeof landingPages.$inferSelect;
export type InsertLandingPage = typeof landingPages.$inferInsert;

// ─── Leads ────────────────────────────────────────────────────────────────────
export const leads = mysqlTable("leads", {
  id: int("id").autoincrement().primaryKey(),
  firstName: varchar("firstName", { length: 128 }).notNull(),
  lastName: varchar("lastName", { length: 128 }).notNull(),
  email: varchar("email", { length: 320 }).notNull(),
  phone: varchar("phone", { length: 32 }),
  source: varchar("source", { length: 128 }),
  campaign: varchar("campaign", { length: 128 }),
  landingPageId: int("landingPageId"),
  assignedTo: int("assignedTo"),
  stage: mysqlEnum("stage", [
    "new_lead",
    "registered",
    "attended",
    "no_show",
    "consultation_booked",
    "under_contract",
    "closed",
  ]).default("new_lead").notNull(),
  score: int("score").default(0),
  scoreReason: text("scoreReason"),
  scoredAt: timestamp("scoredAt"),
  smsConsent: boolean("smsConsent").default(false),
  // NEW: Opt-in / contact consent from landing page
  contactOptIn: boolean("contactOptIn").default(false),
  webinarId: int("webinarId"),
  // NEW: Selected webinar session
  webinarSessionId: int("webinarSessionId"),
  zoomRegistrantId: varchar("zoomRegistrantId", { length: 256 }),
  zoomJoinUrl: text("zoomJoinUrl"),
  attendanceStatus: mysqlEnum("attendanceStatus", ["registered", "attended", "no_show"]),
  consultationBookedAt: timestamp("consultationBookedAt"),
  googleCalendarEventId: varchar("googleCalendarEventId", { length: 256 }),
  dealValue: decimal("dealValue", { precision: 12, scale: 2 }),
  dealClosedAt: timestamp("dealClosedAt"),
  quickNote: text("quickNote"),

  // ─── Attribution ──────────────────────────────────────────────────────────
  // Captured once, at first touch, and never overwritten. Six months from now
  // this is what tells you which ad produced a closed loan.
  campaignId: int("campaignId"),
  utmSource: varchar("utmSource", { length: 128 }),
  utmMedium: varchar("utmMedium", { length: 128 }),
  utmCampaign: varchar("utmCampaign", { length: 128 }),
  utmContent: varchar("utmContent", { length: 128 }),
  utmTerm: varchar("utmTerm", { length: 128 }),
  // Meta click + browser identifiers (required for good Conversions API matching)
  fbclid: varchar("fbclid", { length: 512 }),
  fbc: varchar("fbc", { length: 512 }),
  fbp: varchar("fbp", { length: 128 }),
  gclid: varchar("gclid", { length: 512 }),
  // Meta ad hierarchy, resolved from the click parameters
  metaCampaignId: varchar("metaCampaignId", { length: 64 }),
  metaCampaignName: varchar("metaCampaignName", { length: 256 }),
  metaAdsetId: varchar("metaAdsetId", { length: 64 }),
  metaAdsetName: varchar("metaAdsetName", { length: 256 }),
  metaAdId: varchar("metaAdId", { length: 64 }),
  metaAdName: varchar("metaAdName", { length: 256 }),
  metaPlacement: varchar("metaPlacement", { length: 128 }),
  // Raw context of the visit
  landingUrl: text("landingUrl"),
  referrerUrl: text("referrerUrl"),
  clientIpAddress: varchar("clientIpAddress", { length: 64 }),
  clientUserAgent: text("clientUserAgent"),
  attributionCapturedAt: timestamp("attributionCapturedAt"),

  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Lead = typeof leads.$inferSelect;
export type InsertLead = typeof leads.$inferInsert;

// ─── Activity Log ─────────────────────────────────────────────────────────────
export const activityLog = mysqlTable("activity_log", {
  id: int("id").autoincrement().primaryKey(),
  leadId: int("leadId").notNull(),
  userId: int("userId"),
  type: mysqlEnum("type", [
    "note",
    "stage_change",
    "email_sent",
    "sms_sent",
    "sms_received",
    "webinar_registered",
    "webinar_attended",
    "webinar_no_show",
    "consultation_booked",
    "deal_created",
    "deal_updated",
    "score_updated",
    "call_logged",
    "confirmation_email",
    "system",
  ]).notNull(),
  title: varchar("title", { length: 512 }).notNull(),
  content: text("content"),
  metadata: json("metadata"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ActivityLog = typeof activityLog.$inferSelect;
export type InsertActivityLog = typeof activityLog.$inferInsert;

// ─── SMS Messages ─────────────────────────────────────────────────────────────
export const smsMessages = mysqlTable("sms_messages", {
  id: int("id").autoincrement().primaryKey(),
  leadId: int("leadId").notNull(),
  direction: mysqlEnum("direction", ["outbound", "inbound"]).notNull(),
  body: text("body").notNull(),
  status: mysqlEnum("status", ["queued", "sent", "delivered", "failed", "received"]).default("queued").notNull(),
  externalId: varchar("externalId", { length: 256 }),
  sentBy: int("sentBy"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type SmsMessage = typeof smsMessages.$inferSelect;

// ─── Email Reminders ──────────────────────────────────────────────────────────
// ─── SMS Reminders (scheduled outbound SMS) ──────────────────────────────────
export const smsReminders = mysqlTable("sms_reminders", {
  id: int("id").autoincrement().primaryKey(),
  leadId: int("leadId").notNull(),
  webinarId: int("webinarId").notNull(),
  type: mysqlEnum("type", [
    "reminder_24h",
    "reminder_1h",
    "reminder_10min",
  ]).notNull(),
  scheduledAt: timestamp("scheduledAt").notNull(),
  sentAt: timestamp("sentAt"),
  status: mysqlEnum("status", ["pending", "sent", "failed", "cancelled"]).default("pending").notNull(),
  body: text("body"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const emailReminders = mysqlTable("email_reminders", {
  id: int("id").autoincrement().primaryKey(),
  leadId: int("leadId").notNull(),
  webinarId: int("webinarId").notNull(),
  type: mysqlEnum("type", [
    "registration_confirmation",
    "reminder_24h",
    "reminder_1h",
    "reminder_10min",
    "no_show_followup",
  ]).notNull(),
  scheduledAt: timestamp("scheduledAt").notNull(),
  sentAt: timestamp("sentAt"),
  status: mysqlEnum("status", ["pending", "sent", "failed", "cancelled"]).default("pending").notNull(),
  subject: varchar("subject", { length: 512 }),
  body: text("body"),
  // NEW: PDF attachment URL for confirmation emails
  attachmentUrl: text("attachmentUrl"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type EmailReminder = typeof emailReminders.$inferSelect;

// ─── Deals ────────────────────────────────────────────────────────────────────
export const deals = mysqlTable("deals", {
  id: int("id").autoincrement().primaryKey(),
  leadId: int("leadId").notNull(),
  assignedTo: int("assignedTo"),
  title: varchar("title", { length: 512 }).notNull(),
  value: decimal("value", { precision: 12, scale: 2 }).notNull(),
  stage: mysqlEnum("stage", [
    "prospect",
    "qualified",
    "proposal",
    "negotiation",
    "closed_won",
    "closed_lost",
  ]).default("prospect").notNull(),
  propertyAddress: text("propertyAddress"),
  expectedCloseDate: timestamp("expectedCloseDate"),
  actualCloseDate: timestamp("actualCloseDate"),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Deal = typeof deals.$inferSelect;
export type InsertDeal = typeof deals.$inferInsert;

// ─── Scheduling: Availability ─────────────────────────────────────────────────
export const availability = mysqlTable("availability", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  dayOfWeek: int("dayOfWeek").notNull(),
  startTime: varchar("startTime", { length: 8 }).notNull(),
  endTime: varchar("endTime", { length: 8 }).notNull(),
  isActive: boolean("isActive").default(true).notNull(),
});

// ─── Scheduling: Bookings ─────────────────────────────────────────────────────
export const bookings = mysqlTable("bookings", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  leadId: int("leadId"),
  guestName: varchar("guestName", { length: 256 }).notNull(),
  guestEmail: varchar("guestEmail", { length: 320 }).notNull(),
  guestPhone: varchar("guestPhone", { length: 32 }),
  scheduledAt: timestamp("scheduledAt").notNull(),
  durationMinutes: int("durationMinutes").default(30),
  notes: text("notes"),
  googleCalendarEventId: varchar("googleCalendarEventId", { length: 256 }),
  status: mysqlEnum("status", ["confirmed", "cancelled", "completed"]).default("confirmed").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Booking = typeof bookings.$inferSelect;
export type InsertBooking = typeof bookings.$inferInsert;

// ─── Media Library (Corporate Logos & Images) ───────────────────────────────
export const mediaLibrary = mysqlTable("media_library", {
  id: int("id").autoincrement().primaryKey(),
  uploadedBy: int("uploadedBy").notNull(),
  fileName: varchar("fileName", { length: 512 }).notNull(),
  fileUrl: text("fileUrl").notNull(),
  fileKey: text("fileKey").notNull(),
  fileType: mysqlEnum("fileType", ["logo", "image", "background", "other"]).default("image").notNull(),
  mimeType: varchar("mimeType", { length: 128 }),
  fileSize: int("fileSize"),
  label: varchar("label", { length: 256 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type MediaItem = typeof mediaLibrary.$inferSelect;
export type InsertMediaItem = typeof mediaLibrary.$inferInsert;

// ─── Pending Invites ─────────────────────────────────────────────────────────
export const pendingInvites = mysqlTable("pending_invites", {
  id: int("id").autoincrement().primaryKey(),
  email: varchar("email", { length: 320 }).notNull(),
  name: text("name"),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  token: varchar("token", { length: 128 }).notNull().unique(),
  invitedBy: int("invitedBy").notNull(),
  acceptedAt: timestamp("acceptedAt"),
  expiresAt: timestamp("expiresAt").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type PendingInvite = typeof pendingInvites.$inferSelect;
export type InsertPendingInvite = typeof pendingInvites.$inferInsert;

// ─── Landing Page Media (many-to-many: foreground logos/images per landing page) ─
export const landingPageMedia = mysqlTable("landing_page_media", {
  id: int("id").autoincrement().primaryKey(),
  landingPageId: int("landingPageId").notNull(),
  mediaId: int("mediaId").notNull(),
  placement: mysqlEnum("placement", ["foreground_logo", "foreground_image", "background"]).default("foreground_logo").notNull(),
  sortOrder: int("sortOrder").default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type LandingPageMedia = typeof landingPageMedia.$inferSelect;

// ─── SMS Templates ────────────────────────────────────────────────────────────
export const smsTemplates = mysqlTable("sms_templates", {
  id: int("id").autoincrement().primaryKey(),
  trigger: mysqlEnum("trigger", [
    "new_lead",
    "registered",
    "reminder_24h",
    "reminder_1h",
    "reminder_10min",
    "attended",
    "no_show",
    "consultation_booked",
    "under_contract",
    "deal_closed",
  ]).notNull(),
  body: text("body").notNull(),
  // Optional email subject line — used when this template is sent as an email (e.g. registered trigger)
  emailSubject: varchar("emailSubject", { length: 512 }),
  // How many minutes before the webinar to send this reminder (negative = before, null = use default)
  // e.g. -1440 = 24h before, -60 = 1h before, -10 = 10min before
  sendOffsetMinutes: int("sendOffsetMinutes"),
  // Optional SMS body for reminder triggers — separate from the email body
  smsBody: text("smsBody"),
  isActive: boolean("isActive").default(true).notNull(),
  createdBy: int("createdBy"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type SmsTemplate = typeof smsTemplates.$inferSelect;
export type InsertSmsTemplate = typeof smsTemplates.$inferInsert;

// ═══════════════════════════════════════════════════════════════════════════
// MARKETING ENGINE — Campaigns, Attribution, Automations
// ═══════════════════════════════════════════════════════════════════════════

// ─── Meta (Facebook/Instagram) account settings ──────────────────────────────
// Single-row configuration table holding the credentials the CRM uses to talk
// to Meta's Marketing API (campaign management) and Conversions API (server-side
// events). Kept separate from `integrations` because Meta needs many more
// fields than the generic OAuth shape.
export const metaSettings = mysqlTable("meta_settings", {
  id: int("id").autoincrement().primaryKey(),
  // Marketing API
  adAccountId: varchar("adAccountId", { length: 64 }),      // act_123456789
  businessId: varchar("businessId", { length: 64 }),
  pageId: varchar("pageId", { length: 64 }),                // Facebook Page used as the ad's identity
  instagramActorId: varchar("instagramActorId", { length: 64 }),
  accessToken: text("accessToken"),                          // system user token
  tokenExpiresAt: timestamp("tokenExpiresAt"),
  // Pixel / Conversions API
  pixelId: varchar("pixelId", { length: 64 }),
  capiAccessToken: text("capiAccessToken"),
  capiTestEventCode: varchar("capiTestEventCode", { length: 64 }),
  capiEnabled: boolean("capiEnabled").default(true).notNull(),
  pixelEnabled: boolean("pixelEnabled").default(true).notNull(),
  // Safety switch: when false, campaign pushes stay local (draft only)
  publishEnabled: boolean("publishEnabled").default(false).notNull(),
  apiVersion: varchar("apiVersion", { length: 16 }).default("v21.0").notNull(),
  lastVerifiedAt: timestamp("lastVerifiedAt"),
  lastVerifyError: text("lastVerifyError"),
  updatedBy: int("updatedBy"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type MetaSettings = typeof metaSettings.$inferSelect;
export type InsertMetaSettings = typeof metaSettings.$inferInsert;

// ─── Landing Page Templates ──────────────────────────────────────────────────
// Reusable, branded starting points ("home value", "grant", "refi"…). A campaign
// picks a template and the CRM stamps out a real landing page from it.
export const landingPageTemplates = mysqlTable("landing_page_templates", {
  id: int("id").autoincrement().primaryKey(),
  key: varchar("key", { length: 128 }).notNull().unique(),  // stable identifier, e.g. "home-value"
  name: varchar("name", { length: 256 }).notNull(),
  description: text("description"),
  category: mysqlEnum("category", [
    "home_value",
    "grant",
    "purchase",
    "refinance",
    "webinar",
    "general",
  ]).default("general").notNull(),
  // Default copy — merged into the new landing page, with {{placeholders}} resolved
  headline: text("headline"),
  subheadline: text("subheadline"),
  bodyText: text("bodyText"),
  ctaText: varchar("ctaText", { length: 256 }),
  // Multi-step flow definition (e.g. address → value → contact). JSON array of steps.
  steps: json("steps"),
  enabledFields: json("enabledFields"),
  accentColor: varchar("accentColor", { length: 16 }).default("#C9A84C"),
  textColor: varchar("textColor", { length: 16 }).default("#FFFFFF"),
  backgroundHtmlUrl: text("backgroundHtmlUrl"),
  artworkUrl: text("artworkUrl"),
  thumbnailUrl: text("thumbnailUrl"),
  confirmationEmailSubject: varchar("confirmationEmailSubject", { length: 512 }),
  confirmationEmailBody: text("confirmationEmailBody"),
  // Meta standard event this template reports on submit (Lead, CompleteRegistration…)
  conversionEventName: varchar("conversionEventName", { length: 64 }).default("Lead"),
  // System templates ship with the CRM and cannot be deleted
  isSystem: boolean("isSystem").default(false).notNull(),
  isActive: boolean("isActive").default(true).notNull(),
  createdBy: int("createdBy"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type LandingPageTemplate = typeof landingPageTemplates.$inferSelect;
export type InsertLandingPageTemplate = typeof landingPageTemplates.$inferInsert;

// ─── Automation Sequences ────────────────────────────────────────────────────
export const automationSequences = mysqlTable("automation_sequences", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 256 }).notNull(),
  description: text("description"),
  // What puts a lead into this sequence
  triggerType: mysqlEnum("triggerType", [
    "campaign_lead",   // lead captured from a campaign's landing page
    "lead_created",    // any new lead
    "stage_change",    // lead moved into triggerValue stage
    "manual",          // enrolled by a user
  ]).default("campaign_lead").notNull(),
  triggerValue: varchar("triggerValue", { length: 128 }),
  isActive: boolean("isActive").default(true).notNull(),
  createdBy: int("createdBy"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type AutomationSequence = typeof automationSequences.$inferSelect;
export type InsertAutomationSequence = typeof automationSequences.$inferInsert;

export const automationSteps = mysqlTable("automation_steps", {
  id: int("id").autoincrement().primaryKey(),
  sequenceId: int("sequenceId").notNull(),
  stepOrder: int("stepOrder").default(0).notNull(),
  type: mysqlEnum("type", [
    "email",
    "sms",
    "call_task",
    "wait",
    "stage_change",
    "notify_owner",
  ]).notNull(),
  // Minutes to wait after the previous step before running this one
  delayMinutes: int("delayMinutes").default(0).notNull(),
  subject: varchar("subject", { length: 512 }),
  body: text("body"),
  // call_task
  taskTitle: varchar("taskTitle", { length: 512 }),
  taskNotes: text("taskNotes"),
  assignTo: int("assignTo"),
  // stage_change
  targetStage: varchar("targetStage", { length: 64 }),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type AutomationStep = typeof automationSteps.$inferSelect;
export type InsertAutomationStep = typeof automationSteps.$inferInsert;

export const automationEnrollments = mysqlTable("automation_enrollments", {
  id: int("id").autoincrement().primaryKey(),
  sequenceId: int("sequenceId").notNull(),
  leadId: int("leadId").notNull(),
  campaignId: int("campaignId"),
  status: mysqlEnum("status", ["active", "completed", "cancelled", "failed"]).default("active").notNull(),
  currentStepOrder: int("currentStepOrder").default(0).notNull(),
  nextRunAt: timestamp("nextRunAt"),
  lastError: text("lastError"),
  startedAt: timestamp("startedAt").defaultNow().notNull(),
  completedAt: timestamp("completedAt"),
});

export type AutomationEnrollment = typeof automationEnrollments.$inferSelect;
export type InsertAutomationEnrollment = typeof automationEnrollments.$inferInsert;

export const automationStepRuns = mysqlTable("automation_step_runs", {
  id: int("id").autoincrement().primaryKey(),
  enrollmentId: int("enrollmentId").notNull(),
  stepId: int("stepId").notNull(),
  leadId: int("leadId").notNull(),
  status: mysqlEnum("status", ["sent", "skipped", "failed"]).notNull(),
  detail: text("detail"),
  ranAt: timestamp("ranAt").defaultNow().notNull(),
});

export type AutomationStepRun = typeof automationStepRuns.$inferSelect;

// ─── Tasks (call tasks produced by automations, worked by loan officers) ─────
export const tasks = mysqlTable("tasks", {
  id: int("id").autoincrement().primaryKey(),
  leadId: int("leadId"),
  campaignId: int("campaignId"),
  assignedTo: int("assignedTo"),
  title: varchar("title", { length: 512 }).notNull(),
  notes: text("notes"),
  type: mysqlEnum("type", ["call", "email", "follow_up", "other"]).default("call").notNull(),
  dueAt: timestamp("dueAt"),
  status: mysqlEnum("status", ["open", "completed", "cancelled"]).default("open").notNull(),
  completedAt: timestamp("completedAt"),
  completedBy: int("completedBy"),
  createdBy: int("createdBy"),
  source: varchar("source", { length: 64 }).default("manual"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Task = typeof tasks.$inferSelect;
export type InsertTask = typeof tasks.$inferInsert;

// ─── Campaigns ───────────────────────────────────────────────────────────────
// The control-center record. Ties budget + creative + landing page + automation
// together, and mirrors the objects Meta creates on its side.
export const campaigns = mysqlTable("campaigns", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 256 }).notNull(),
  description: text("description"),
  platform: mysqlEnum("platform", ["meta", "google", "other"]).default("meta").notNull(),
  objective: mysqlEnum("objective", [
    "OUTCOME_LEADS",
    "OUTCOME_TRAFFIC",
    "OUTCOME_AWARENESS",
    "OUTCOME_ENGAGEMENT",
    "OUTCOME_SALES",
  ]).default("OUTCOME_LEADS").notNull(),
  status: mysqlEnum("status", [
    "draft",
    "scheduled",
    "active",
    "paused",
    "completed",
    "archived",
  ]).default("draft").notNull(),
  // Wiring
  landingPageId: int("landingPageId"),
  sequenceId: int("sequenceId"),
  // Budget (USD). Meta wants minor units; we store dollars and convert on push.
  dailyBudget: decimal("dailyBudget", { precision: 12, scale: 2 }),
  lifetimeBudget: decimal("lifetimeBudget", { precision: 12, scale: 2 }),
  bidStrategy: varchar("bidStrategy", { length: 64 }).default("LOWEST_COST_WITHOUT_CAP"),
  startDate: timestamp("startDate"),
  endDate: timestamp("endDate"),
  // Targeting + creative, kept as JSON so the shape can evolve with Meta's API
  targeting: json("targeting"),
  creative: json("creative"),
  // UTM tags stamped onto the landing page URL
  utmSource: varchar("utmSource", { length: 128 }).default("facebook"),
  utmMedium: varchar("utmMedium", { length: 128 }).default("paid_social"),
  utmCampaign: varchar("utmCampaign", { length: 128 }),
  utmContent: varchar("utmContent", { length: 128 }),
  // Meta mirror IDs
  metaCampaignId: varchar("metaCampaignId", { length: 64 }),
  metaAdSetId: varchar("metaAdSetId", { length: 64 }),
  metaAdId: varchar("metaAdId", { length: 64 }),
  metaCreativeId: varchar("metaCreativeId", { length: 64 }),
  metaAdAccountId: varchar("metaAdAccountId", { length: 64 }),
  syncStatus: mysqlEnum("syncStatus", ["local", "syncing", "synced", "error"]).default("local").notNull(),
  syncError: text("syncError"),
  lastSyncedAt: timestamp("lastSyncedAt"),
  // AI drafting provenance
  aiGenerated: boolean("aiGenerated").default(false).notNull(),
  aiPrompt: text("aiPrompt"),
  createdBy: int("createdBy"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Campaign = typeof campaigns.$inferSelect;
export type InsertCampaign = typeof campaigns.$inferInsert;

// ─── Campaign Metrics (daily insights pulled from Meta) ──────────────────────
export const campaignMetrics = mysqlTable("campaign_metrics", {
  id: int("id").autoincrement().primaryKey(),
  campaignId: int("campaignId").notNull(),
  // YYYY-MM-DD, one row per campaign per day
  date: varchar("date", { length: 10 }).notNull(),
  impressions: int("impressions").default(0).notNull(),
  reach: int("reach").default(0).notNull(),
  clicks: int("clicks").default(0).notNull(),
  spend: decimal("spend", { precision: 12, scale: 2 }).default("0.00").notNull(),
  // Leads as Meta counts them (pixel/CAPI reported)
  reportedLeads: int("reportedLeads").default(0).notNull(),
  cpc: decimal("cpc", { precision: 12, scale: 4 }),
  cpm: decimal("cpm", { precision: 12, scale: 4 }),
  ctr: decimal("ctr", { precision: 8, scale: 4 }),
  raw: json("raw"),
  fetchedAt: timestamp("fetchedAt").defaultNow().notNull(),
});

export type CampaignMetric = typeof campaignMetrics.$inferSelect;
export type InsertCampaignMetric = typeof campaignMetrics.$inferInsert;

// ─── Meta Conversions API event log ──────────────────────────────────────────
// Every server-side event we send, with the eventId used to de-duplicate against
// the browser pixel. Gives a paper trail when Events Manager disagrees with us.
export const metaConversionEvents = mysqlTable("meta_conversion_events", {
  id: int("id").autoincrement().primaryKey(),
  leadId: int("leadId"),
  campaignId: int("campaignId"),
  landingPageId: int("landingPageId"),
  eventName: varchar("eventName", { length: 64 }).notNull(),
  eventId: varchar("eventId", { length: 128 }).notNull(),
  eventTime: timestamp("eventTime").defaultNow().notNull(),
  pixelId: varchar("pixelId", { length: 64 }),
  actionSource: varchar("actionSource", { length: 32 }).default("website"),
  value: decimal("value", { precision: 12, scale: 2 }),
  currency: varchar("currency", { length: 8 }).default("USD"),
  status: mysqlEnum("status", ["pending", "sent", "failed", "skipped"]).default("pending").notNull(),
  responseCode: int("responseCode"),
  responseBody: text("responseBody"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type MetaConversionEvent = typeof metaConversionEvents.$inferSelect;
export type InsertMetaConversionEvent = typeof metaConversionEvents.$inferInsert;
