-- Clarke & Associates CRM — Complete Database Schema
-- Run this in phpMyAdmin SQL tab on database: u833783884_AltaCRM
-- Generated from all migrations (0000 through 0008)

SET FOREIGN_KEY_CHECKS = 0;

-- ─── Users ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `users` (
  `id` int AUTO_INCREMENT NOT NULL,
  `openId` varchar(64) NOT NULL,
  `name` text,
  `email` varchar(320),
  `loginMethod` varchar(64),
  `role` enum('user','admin') NOT NULL DEFAULT 'user',
  `schedulingSlug` varchar(64),
  `avatarUrl` text,
  `phone` varchar(32),
  `passwordHash` text,
  `lastSignedIn` timestamp,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `users_id` PRIMARY KEY(`id`),
  CONSTRAINT `users_openId_unique` UNIQUE(`openId`),
  CONSTRAINT `users_email_unique` UNIQUE(`email`)
);

-- ─── Integrations ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `integrations` (
  `id` int AUTO_INCREMENT NOT NULL,
  `userId` int NOT NULL,
  `provider` enum('zoom','google_calendar','twilio','gmail') NOT NULL,
  `accessToken` text,
  `refreshToken` text,
  `tokenExpiresAt` timestamp,
  `accountEmail` varchar(320),
  `accountId` varchar(256),
  `isEnabled` boolean NOT NULL DEFAULT true,
  `metadata` json,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `integrations_id` PRIMARY KEY(`id`)
);

-- ─── Webinars ─────────────────────────────────────────────────────────────────
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

-- ─── Webinar Sessions ─────────────────────────────────────────────────────────
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

-- ─── Landing Pages ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `landing_pages` (
  `id` int AUTO_INCREMENT NOT NULL,
  `createdBy` int NOT NULL,
  `webinarId` int,
  `title` varchar(512) NOT NULL,
  `slug` varchar(128) NOT NULL,
  `headline` text,
  `subheadline` text,
  `ctaText` varchar(256),
  `accentColor` varchar(32),
  `artworkUrl` text,
  `enabledFields` json,
  `optInLabel` text,
  `showOptIn` boolean DEFAULT true,
  `confirmationEmailSubject` varchar(512),
  `confirmationEmailBody` text,
  `confirmationPdfUrl` text,
  `bodyText` text,
  `isActive` boolean NOT NULL DEFAULT true,
  `leadCount` int NOT NULL DEFAULT 0,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `landing_pages_id` PRIMARY KEY(`id`),
  CONSTRAINT `landing_pages_slug_unique` UNIQUE(`slug`)
);

-- ─── Media Library ────────────────────────────────────────────────────────────
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

-- ─── Landing Page Media ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `landing_page_media` (
  `id` int AUTO_INCREMENT NOT NULL,
  `landingPageId` int NOT NULL,
  `mediaId` int NOT NULL,
  `placement` enum('foreground_logo','foreground_image','background') NOT NULL DEFAULT 'foreground_logo',
  `sortOrder` int DEFAULT 0,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  CONSTRAINT `landing_page_media_id` PRIMARY KEY(`id`)
);

-- ─── Leads ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `leads` (
  `id` int AUTO_INCREMENT NOT NULL,
  `firstName` varchar(256) NOT NULL,
  `lastName` varchar(256),
  `email` varchar(320) NOT NULL,
  `phone` varchar(32),
  `source` varchar(128),
  `campaign` varchar(256),
  `stage` enum('new_lead','registered','attended','no_show','consult_booked','under_contract','closed') NOT NULL DEFAULT 'new_lead',
  `score` int DEFAULT 0,
  `scoreReason` text,
  `notes` text,
  `smsOptIn` boolean NOT NULL DEFAULT false,
  `contactOptIn` boolean DEFAULT false,
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

-- ─── Activity Log ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `activity_log` (
  `id` int AUTO_INCREMENT NOT NULL,
  `leadId` int NOT NULL,
  `userId` int,
  `type` enum('note','stage_change','email_sent','sms_sent','sms_received','webinar_registered','webinar_attended','webinar_no_show','consultation_booked','deal_created','deal_updated','score_updated','call_logged','confirmation_email','system') NOT NULL,
  `title` varchar(512) NOT NULL,
  `content` text,
  `metadata` json,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  CONSTRAINT `activity_log_id` PRIMARY KEY(`id`)
);

-- ─── SMS Messages ─────────────────────────────────────────────────────────────
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

-- ─── Email Reminders ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `email_reminders` (
  `id` int AUTO_INCREMENT NOT NULL,
  `leadId` int NOT NULL,
  `webinarId` int,
  `type` enum('registration_confirmation','24h_reminder','1h_reminder','10min_reminder','no_show_followup','confirmation_email') NOT NULL,
  `scheduledAt` timestamp NOT NULL,
  `sentAt` timestamp,
  `status` enum('pending','sent','failed','cancelled') NOT NULL DEFAULT 'pending',
  `subject` varchar(512),
  `body` text,
  `attachmentUrl` text,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  CONSTRAINT `email_reminders_id` PRIMARY KEY(`id`)
);

-- ─── Deals ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `deals` (
  `id` int AUTO_INCREMENT NOT NULL,
  `leadId` int NOT NULL,
  `createdBy` int NOT NULL,
  `title` varchar(512) NOT NULL,
  `value` decimal(12,2),
  `stage` enum('prospect','qualified','proposal','negotiation','closed_won','closed_lost') NOT NULL DEFAULT 'prospect',
  `propertyAddress` text,
  `propertyType` varchar(128),
  `expectedCloseDate` timestamp,
  `actualCloseDate` timestamp,
  `notes` text,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `deals_id` PRIMARY KEY(`id`)
);

-- ─── Availability ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `availability` (
  `id` int AUTO_INCREMENT NOT NULL,
  `userId` int NOT NULL,
  `dayOfWeek` int NOT NULL,
  `startTime` varchar(8) NOT NULL,
  `endTime` varchar(8) NOT NULL,
  `isActive` boolean NOT NULL DEFAULT true,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  CONSTRAINT `availability_id` PRIMARY KEY(`id`)
);

-- ─── Bookings ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `bookings` (
  `id` int AUTO_INCREMENT NOT NULL,
  `userId` int NOT NULL,
  `leadId` int,
  `guestName` varchar(256) NOT NULL,
  `guestEmail` varchar(320) NOT NULL,
  `guestPhone` varchar(32),
  `scheduledAt` timestamp NOT NULL,
  `durationMinutes` int NOT NULL DEFAULT 30,
  `status` enum('pending','confirmed','cancelled','completed') NOT NULL DEFAULT 'pending',
  `notes` text,
  `googleCalendarEventId` varchar(256),
  `zoomJoinUrl` text,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  CONSTRAINT `bookings_id` PRIMARY KEY(`id`)
);

-- ─── Pending Invites ──────────────────────────────────────────────────────────
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

-- ─── Drizzle Migrations Tracking ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `__drizzle_migrations` (
  `id` int AUTO_INCREMENT NOT NULL,
  `hash` text NOT NULL,
  `created_at` bigint,
  CONSTRAINT `__drizzle_migrations_id` PRIMARY KEY(`id`)
);

SET FOREIGN_KEY_CHECKS = 1;

SELECT 'All 15 tables created successfully!' AS result;
