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
  date,
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

// ─── Agent Contacts (uploaded real estate agent database) ────────────────────
export const agentContacts = mysqlTable("agent_contacts", {
  id: int("id").autoincrement().primaryKey(),
  firstName: varchar("firstName", { length: 128 }).notNull(),
  lastName: varchar("lastName", { length: 128 }).notNull(),
  email: varchar("email", { length: 320 }).notNull(),
  phone: varchar("phone", { length: 32 }),
  brokerage: varchar("brokerage", { length: 256 }),
  licenseNumber: varchar("licenseNumber", { length: 64 }),
  city: varchar("city", { length: 128 }),
  state: varchar("state", { length: 2 }).default("UT"),
  tags: json("tags"),
  optedOut: boolean("optedOut").default(false).notNull(),
  optOutDate: timestamp("optOutDate"),
  importBatch: varchar("importBatch", { length: 64 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type AgentContact = typeof agentContacts.$inferSelect;
export type InsertAgentContact = typeof agentContacts.$inferInsert;

// ─── Mortgage Clients (past client database for email campaigns) ────────────
export const mortgageClients = mysqlTable("mortgage_clients", {
  id: int("id").autoincrement().primaryKey(),
  firstName: varchar("firstName", { length: 128 }).notNull(),
  lastName: varchar("lastName", { length: 128 }).notNull(),
  email: varchar("email", { length: 320 }).notNull(),
  phone: varchar("phone", { length: 32 }),
  address: varchar("address", { length: 512 }),
  city: varchar("city", { length: 128 }),
  state: varchar("state", { length: 2 }).default("UT"),
  zipCode: varchar("zipCode", { length: 10 }),
  loanType: varchar("loanType", { length: 64 }),
  closingDate: date("closingDate"),
  loanAmount: decimal("loanAmount", { precision: 12, scale: 2 }),
  tags: json("tags"),
  optedOut: boolean("optedOut").default(false).notNull(),
  optOutDate: timestamp("optOutDate"),
  importBatch: varchar("importBatch", { length: 64 }),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type MortgageClient = typeof mortgageClients.$inferSelect;
export type InsertMortgageClient = typeof mortgageClients.$inferInsert;

// ─── Email Campaigns (batch sends to agent contacts or mortgage clients) ────
export const emailCampaigns = mysqlTable("email_campaigns", {
  id: int("id").autoincrement().primaryKey(),
  createdBy: int("createdBy").notNull(),
  audience: mysqlEnum("audience", ["re_agent", "past_mortgage", "prospective_mortgage", "prospective_re_client"]).default("re_agent").notNull(),
  name: varchar("name", { length: 256 }).notNull(),
  subject: varchar("subject", { length: 512 }).notNull(),
  bodyHtml: text("bodyHtml").notNull(),
  fromName: varchar("fromName", { length: 128 }).default("Scott Boerstra"),
  landingPageId: int("landingPageId"),
  // Filter criteria for selecting recipients
  filterTags: json("filterTags"),
  filterBrokerage: varchar("filterBrokerage", { length: 256 }),
  filterCity: varchar("filterCity", { length: 128 }),
  filterState: varchar("filterState", { length: 2 }),
  // Batch settings
  batchSize: int("batchSize").default(50).notNull(),
  batchDelayMinutes: int("batchDelayMinutes").default(15).notNull(),
  // Campaign state
  status: mysqlEnum("status", ["draft", "scheduled", "sending", "paused", "completed", "cancelled"]).default("draft").notNull(),
  scheduledAt: timestamp("scheduledAt"),
  startedAt: timestamp("startedAt"),
  completedAt: timestamp("completedAt"),
  totalRecipients: int("totalRecipients").default(0),
  totalSent: int("totalSent").default(0),
  totalOpened: int("totalOpened").default(0),
  totalClicked: int("totalClicked").default(0),
  totalBounced: int("totalBounced").default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type EmailCampaign = typeof emailCampaigns.$inferSelect;
export type InsertEmailCampaign = typeof emailCampaigns.$inferInsert;

// ─── Campaign Recipients (per-contact send tracking) ─────────────────────────
export const campaignRecipients = mysqlTable("campaign_recipients", {
  id: int("id").autoincrement().primaryKey(),
  campaignId: int("campaignId").notNull(),
  agentContactId: int("agentContactId"),
  mortgageClientId: int("mortgageClientId"),
  leadId: int("leadId"),
  status: mysqlEnum("status", ["pending", "sent", "opened", "clicked", "bounced", "unsubscribed"]).default("pending").notNull(),
  sentAt: timestamp("sentAt"),
  openedAt: timestamp("openedAt"),
  clickedAt: timestamp("clickedAt"),
  trackingId: varchar("trackingId", { length: 64 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type CampaignRecipient = typeof campaignRecipients.$inferSelect;
export type InsertCampaignRecipient = typeof campaignRecipients.$inferInsert;

// ─── Landing Pages ────────────────────────────────────────────────────────────
export const landingPages = mysqlTable("landing_pages", {
  id: int("id").autoincrement().primaryKey(),
  createdBy: int("createdBy").notNull(),
  title: varchar("title", { length: 512 }).notNull(),
  slug: varchar("slug", { length: 128 }).notNull().unique(),
  // Page type: what audience this landing page targets
  pageType: mysqlEnum("pageType", ["re_agent", "past_mortgage", "prospective_mortgage", "prospective_re_client"]).default("prospective_mortgage").notNull(),
  // Purpose: webinar registration or advertising/lead capture
  purpose: mysqlEnum("purpose", ["webinar", "advertising"]).default("advertising").notNull(),
  // Which domain hosts this page
  hostSite: mysqlEnum("hostSite", ["altamortgagecrm", "freehomesearchutah"]).default("altamortgagecrm").notNull(),
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

// ─── Payroll: Companies (one per LLC / employer EIN) ─────────────────────────
export const payrollCompanies = mysqlTable("payroll_companies", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 256 }).notNull(),
  ein: varchar("ein", { length: 16 }),
  // How the IRS taxes the LLC — owners can only be on payroll when it is taxed as a corporation
  taxClassification: mysqlEnum("taxClassification", ["s_corp", "c_corp", "partnership", "disregarded"]).default("s_corp").notNull(),
  address: varchar("address", { length: 256 }),
  city: varchar("city", { length: 128 }),
  state: varchar("state", { length: 2 }).default("UT"),
  zip: varchar("zip", { length: 10 }),
  utahWithholdingAccount: varchar("utahWithholdingAccount", { length: 32 }),
  utahUiAccount: varchar("utahUiAccount", { length: 32 }),
  // Percent, e.g. 1.200 for 1.2% — DWS mails each employer its rate every December
  utahUiRate: decimal("utahUiRate", { precision: 6, scale: 3 }).default("1.200").notNull(),
  depositSchedule: mysqlEnum("depositSchedule", ["monthly", "semiweekly"]).default("monthly").notNull(),
  utahFilingFrequency: mysqlEnum("utahFilingFrequency", ["monthly", "quarterly", "annual"]).default("quarterly").notNull(),
  payFrequency: mysqlEnum("payFrequency", ["weekly", "biweekly", "semimonthly", "monthly", "quarterly", "annual"]).default("monthly").notNull(),
  isActive: boolean("isActive").default(true).notNull(),
  notes: text("notes"),
  createdBy: int("createdBy"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type PayrollCompany = typeof payrollCompanies.$inferSelect;
export type InsertPayrollCompany = typeof payrollCompanies.$inferInsert;

// ─── Payroll: People paid by a company (owner, spouse) ───────────────────────
export const payrollPeople = mysqlTable("payroll_people", {
  id: int("id").autoincrement().primaryKey(),
  companyId: int("companyId").notNull(),
  firstName: varchar("firstName", { length: 128 }).notNull(),
  lastName: varchar("lastName", { length: 128 }).notNull(),
  // Only the last four digits are stored; full SSNs are typed straight into the filing sites
  ssnLast4: varchar("ssnLast4", { length: 4 }),
  relationship: mysqlEnum("relationship", ["owner", "spouse", "other"]).default("owner").notNull(),
  // Form W-4
  filingStatus: mysqlEnum("filingStatus", ["single", "married_joint", "head_of_household"]).default("married_joint").notNull(),
  multipleJobs: boolean("multipleJobs").default(false).notNull(),
  dependentsCredit: decimal("dependentsCredit", { precision: 10, scale: 2 }).default("0").notNull(),
  otherIncome: decimal("otherIncome", { precision: 12, scale: 2 }).default("0").notNull(),
  deductions: decimal("deductions", { precision: 12, scale: 2 }).default("0").notNull(),
  extraWithholding: decimal("extraWithholding", { precision: 10, scale: 2 }).default("0").notNull(),
  futaExempt: boolean("futaExempt").default(false).notNull(),
  utahUiExempt: boolean("utahUiExempt").default(false).notNull(),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type PayrollPerson = typeof payrollPeople.$inferSelect;
export type InsertPayrollPerson = typeof payrollPeople.$inferInsert;

// ─── Payroll: Paychecks (amounts in cents, taxes frozen when saved) ──────────
export const payrollPaychecks = mysqlTable("payroll_paychecks", {
  id: int("id").autoincrement().primaryKey(),
  companyId: int("companyId").notNull(),
  personId: int("personId").notNull(),
  payDate: date("payDate", { mode: "string" }).notNull(),
  periodStart: date("periodStart", { mode: "string" }),
  periodEnd: date("periodEnd", { mode: "string" }),
  grossCents: int("grossCents").notNull(),
  retirement401kCents: int("retirement401kCents").default(0).notNull(),
  shareholderHealthCents: int("shareholderHealthCents").default(0).notNull(),
  federalWagesCents: int("federalWagesCents").notNull(),
  stateWagesCents: int("stateWagesCents").notNull(),
  ssWagesCents: int("ssWagesCents").notNull(),
  medicareWagesCents: int("medicareWagesCents").notNull(),
  addlMedicareWagesCents: int("addlMedicareWagesCents").default(0).notNull(),
  futaWagesCents: int("futaWagesCents").notNull(),
  utahUiWagesCents: int("utahUiWagesCents").notNull(),
  federalWithholdingCents: int("federalWithholdingCents").notNull(),
  utahWithholdingCents: int("utahWithholdingCents").notNull(),
  // True when the withholding was typed in rather than taken from the formula
  withholdingOverridden: boolean("withholdingOverridden").default(false).notNull(),
  ssEmployeeCents: int("ssEmployeeCents").notNull(),
  medicareEmployeeCents: int("medicareEmployeeCents").notNull(),
  addlMedicareCents: int("addlMedicareCents").default(0).notNull(),
  ssEmployerCents: int("ssEmployerCents").notNull(),
  medicareEmployerCents: int("medicareEmployerCents").notNull(),
  futaCents: int("futaCents").notNull(),
  utahUiCents: int("utahUiCents").notNull(),
  netPayCents: int("netPayCents").notNull(),
  memo: text("memo"),
  createdBy: int("createdBy"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type PayrollPaycheck = typeof payrollPaychecks.$inferSelect;
export type InsertPayrollPaycheck = typeof payrollPaychecks.$inferInsert;

// ─── Payroll: Tax deposits made (EFTPS, Utah TAP, DWS) ───────────────────────
export const payrollDeposits = mysqlTable("payroll_deposits", {
  id: int("id").autoincrement().primaryKey(),
  companyId: int("companyId").notNull(),
  agency: mysqlEnum("agency", ["irs_941", "irs_940", "utah_withholding", "utah_ui"]).notNull(),
  taxYear: int("taxYear").notNull(),
  quarter: int("quarter"), // null for annual (940)
  amountCents: int("amountCents").notNull(),
  depositDate: date("depositDate", { mode: "string" }).notNull(),
  confirmation: varchar("confirmation", { length: 128 }),
  createdBy: int("createdBy"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type PayrollDeposit = typeof payrollDeposits.$inferSelect;
export type InsertPayrollDeposit = typeof payrollDeposits.$inferInsert;
