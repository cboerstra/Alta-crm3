-- ============================================================
-- Clarke & Associates CRM — Complete Database Schema (v2)
-- Run this in phpMyAdmin → SQL tab on u833783884_AltaCRM
-- ============================================================

SET FOREIGN_KEY_CHECKS = 0;

-- ── Users ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `users` (
  `id` int AUTO_INCREMENT NOT NULL,
  `openId` varchar(256) NOT NULL,
  `name` text NOT NULL,
  `email` varchar(320),
  `avatarUrl` text,
  `phone` varchar(32),
  `role` enum('user','admin') NOT NULL DEFAULT 'user',
  `loginMethod` enum('oauth','password') NOT NULL DEFAULT 'oauth',
  `passwordHash` text,
  `schedulingSlug` varchar(64),
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `users_id` PRIMARY KEY(`id`),
  CONSTRAINT `users_openId_unique` UNIQUE(`openId`),
  CONSTRAINT `users_email_unique` UNIQUE(`email`)
);

-- ── Integrations ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `integrations` (
  `id` int AUTO_INCREMENT NOT NULL,
  `userId` int NOT NULL,
  `provider` enum('zoom','google_calendar','twilio','gmail') NOT NULL,
  `accessToken` text,
  `refreshToken` text,
  `tokenExpiresAt` timestamp,
  `accountId` varchar(256),
  `accountEmail` varchar(320),
  `metadata` json,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `integrations_id` PRIMARY KEY(`id`)
);

-- ── Webinars ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `webinars` (
  `id` int AUTO_INCREMENT NOT NULL,
  `createdBy` int NOT NULL,
  `title` varchar(512) NOT NULL,
  `description` text,
  `scheduledAt` timestamp NOT NULL,
  `durationMinutes` int DEFAULT 60,
  `zoomWebinarId` varchar(256),
  `zoomJoinUrl` text,
  `zoomStartUrl` text,
  `replayUrl` text,
  `googleCalendarEventId` varchar(256),
  `landingPageId` int,
  `status` enum('draft','scheduled','live','completed','cancelled') NOT NULL DEFAULT 'draft',
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `webinars_id` PRIMARY KEY(`id`)
);

-- ── Webinar Sessions ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `webinar_sessions` (
  `id` int AUTO_INCREMENT NOT NULL,
  `webinarId` int NOT NULL,
  `sessionDate` timestamp NOT NULL,
  `durationMinutes` int DEFAULT 60,
  `maxAttendees` int,
  `zoomJoinUrl` text,
  `zoomStartUrl` text,
  `label` varchar(256),
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  CONSTRAINT `webinar_sessions_id` PRIMARY KEY(`id`)
);

-- ── Landing Pages ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `landing_pages` (
  `id` int AUTO_INCREMENT NOT NULL,
  `createdBy` int NOT NULL,
  `title` varchar(512) NOT NULL,
  `slug` varchar(256) NOT NULL,
  `headline` varchar(512),
  `subheadline` text,
  `ctaText` varchar(256) DEFAULT 'Register Now',
  `campaignTag` varchar(256),
  `sourceTag` varchar(256),
  `webinarId` int,
  `isActive` boolean NOT NULL DEFAULT true,
  `customCss` text,
  `backgroundImageUrl` text,
  `accentColor` varchar(32) DEFAULT '#C9A84C',
  `artworkUrl` text,
  `enabledFields` json,
  `optInLabel` text,
  `showOptIn` boolean DEFAULT true,
  `confirmationEmailSubject` varchar(512),
  `confirmationEmailBody` text,
  `confirmationPdfUrl` text,
  `bodyText` text,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `landing_pages_id` PRIMARY KEY(`id`),
  CONSTRAINT `landing_pages_slug_unique` UNIQUE(`slug`)
);

-- ── Media Library ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `media_library` (
  `id` int AUTO_INCREMENT NOT NULL,
  `uploadedBy` int NOT NULL,
  `fileName` varchar(512) NOT NULL,
  `fileUrl` text NOT NULL,
  `fileKey` text NOT NULL,
  `fileType` enum('logo','image','background','other') NOT NULL DEFAULT 'image',
  `mimeType` varchar(128),
  `fileSize` int,
  `label` varchar(256),
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  CONSTRAINT `media_library_id` PRIMARY KEY(`id`)
);

-- ── Landing Page Media ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `landing_page_media` (
  `id` int AUTO_INCREMENT NOT NULL,
  `landingPageId` int NOT NULL,
  `mediaId` int NOT NULL,
  `placement` enum('foreground_logo','foreground_image','background') NOT NULL DEFAULT 'foreground_logo',
  `sortOrder` int DEFAULT 0,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  CONSTRAINT `landing_page_media_id` PRIMARY KEY(`id`)
);

-- ── Leads ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `leads` (
  `id` int AUTO_INCREMENT NOT NULL,
  `firstName` varchar(256) NOT NULL,
  `lastName` varchar(256) NOT NULL,
  `email` varchar(320),
  `phone` varchar(32),
  `source` varchar(256),
  `campaignTag` varchar(256),
  `sourceTag` varchar(256),
  `stage` enum('new_lead','registered','attended','no_show','consult_booked','closed_won','closed_lost','nurture') NOT NULL DEFAULT 'new_lead',
  `score` int DEFAULT 0,
  `assignedTo` int,
  `smsOptIn` boolean NOT NULL DEFAULT false,
  `contactOptIn` boolean DEFAULT false,
  `notes` text,
  `landingPageId` int,
  `webinarId` int,
  `webinarSessionId` int,
  `zoomRegistrantId` varchar(256),
  `zoomJoinUrl` text,
  `attendanceStatus` enum('registered','attended','no_show'),
  `consultationBookedAt` timestamp,
  `googleCalendarEventId` varchar(256),
  `dealValue` decimal(12,2),
  `dealClosedAt` timestamp,
  `quickNote` text,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `leads_id` PRIMARY KEY(`id`)
);

-- ── Activity Log ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `activity_log` (
  `id` int AUTO_INCREMENT NOT NULL,
  `leadId` int NOT NULL,
  `userId` int,
  `type` enum('note','stage_change','email_sent','sms_sent','sms_received','webinar_registered','webinar_attended','webinar_no_show','consultation_booked','deal_created','deal_updated','score_updated','call_logged','confirmation_email','system') NOT NULL,
  `content` text,
  `metadata` json,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  CONSTRAINT `activity_log_id` PRIMARY KEY(`id`)
);

-- ── Email Reminders ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `email_reminders` (
  `id` int AUTO_INCREMENT NOT NULL,
  `leadId` int NOT NULL,
  `subject` varchar(512) NOT NULL,
  `body` text NOT NULL,
  `attachmentUrl` text,
  `scheduledAt` timestamp NOT NULL,
  `status` enum('pending','sent','failed','cancelled') NOT NULL DEFAULT 'pending',
  `sentAt` timestamp,
  `createdBy` int,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  CONSTRAINT `email_reminders_id` PRIMARY KEY(`id`)
);

-- ── SMS Messages ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `sms_messages` (
  `id` int AUTO_INCREMENT NOT NULL,
  `leadId` int NOT NULL,
  `direction` enum('outbound','inbound') NOT NULL,
  `body` text NOT NULL,
  `status` enum('queued','sent','delivered','failed','received') NOT NULL DEFAULT 'queued',
  `externalId` varchar(256),
  `sentBy` int,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  CONSTRAINT `sms_messages_id` PRIMARY KEY(`id`)
);

-- ── Deals ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `deals` (
  `id` int AUTO_INCREMENT NOT NULL,
  `leadId` int NOT NULL,
  `assignedTo` int,
  `title` varchar(512) NOT NULL,
  `value` decimal(12,2),
  `stage` enum('prospect','proposal','negotiation','closed_won','closed_lost') NOT NULL DEFAULT 'prospect',
  `closedAt` timestamp,
  `notes` text,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `deals_id` PRIMARY KEY(`id`)
);

-- ── Pending Invites ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `pending_invites` (
  `id` int AUTO_INCREMENT NOT NULL,
  `email` varchar(320) NOT NULL,
  `name` text,
  `role` enum('user','admin') NOT NULL DEFAULT 'user',
  `token` varchar(128) NOT NULL,
  `invitedBy` int NOT NULL,
  `acceptedAt` timestamp,
  `expiresAt` timestamp NOT NULL,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  CONSTRAINT `pending_invites_id` PRIMARY KEY(`id`),
  CONSTRAINT `pending_invites_token_unique` UNIQUE(`token`)
);

-- ── Drizzle Migrations Tracking ───────────────────────────────
CREATE TABLE IF NOT EXISTS `__drizzle_migrations` (
  `id` int AUTO_INCREMENT NOT NULL,
  `hash` text NOT NULL,
  `created_at` bigint,
  CONSTRAINT `__drizzle_migrations_id` PRIMARY KEY(`id`)
);

SET FOREIGN_KEY_CHECKS = 1;

SELECT 'All tables created successfully!' AS result;
