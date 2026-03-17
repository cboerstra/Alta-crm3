-- ============================================================
-- Clarke CRM — Definitive Schema v4
-- Built directly from drizzle/schema.ts (every table, every column)
-- Safe to run on a fresh database. Uses CREATE TABLE IF NOT EXISTS
-- so it won't destroy existing tables.
--
-- HOW TO USE:
--   phpMyAdmin → select u833783884_AltaCRM → Import tab
--   → Choose this file → Go
--   You should see: "All 16 tables created successfully!"
-- ============================================================

SET FOREIGN_KEY_CHECKS = 0;

-- ─── users ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `users` (
  `id`             int            NOT NULL AUTO_INCREMENT,
  `openId`         varchar(64)    NOT NULL,
  `name`           text,
  `email`          varchar(320),
  `loginMethod`    varchar(64),
  `role`           enum('user','admin') NOT NULL DEFAULT 'user',
  `schedulingSlug` varchar(64),
  `avatarUrl`      text,
  `phone`          varchar(32),
  `passwordHash`   text,
  `createdAt`      timestamp      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt`      timestamp      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `lastSignedIn`   timestamp      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `users_openId_unique` (`openId`),
  UNIQUE KEY `users_email_unique` (`email`)
);

-- ─── integrations ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `integrations` (
  `id`             int            NOT NULL AUTO_INCREMENT,
  `userId`         int            NOT NULL,
  `provider`       enum('zoom','google_calendar','twilio','gmail') NOT NULL,
  `accessToken`    text,
  `refreshToken`   text,
  `tokenExpiresAt` timestamp      NULL,
  `accountId`      varchar(256),
  `accountEmail`   varchar(320),
  `metadata`       json,
  `createdAt`      timestamp      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt`      timestamp      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
);

-- ─── webinars ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `webinars` (
  `id`                    int           NOT NULL AUTO_INCREMENT,
  `createdBy`             int           NOT NULL,
  `title`                 varchar(512)  NOT NULL,
  `description`           text,
  `scheduledAt`           timestamp     NOT NULL,
  `durationMinutes`       int           DEFAULT 60,
  `zoomWebinarId`         varchar(256),
  `zoomJoinUrl`           text,
  `zoomStartUrl`          text,
  `replayUrl`             text,
  `googleCalendarEventId` varchar(256),
  `landingPageId`         int,
  `status`                enum('draft','scheduled','live','completed','cancelled') NOT NULL DEFAULT 'draft',
  `createdAt`             timestamp     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt`             timestamp     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
);

-- ─── webinar_sessions ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `webinar_sessions` (
  `id`              int          NOT NULL AUTO_INCREMENT,
  `webinarId`       int          NOT NULL,
  `sessionDate`     timestamp    NOT NULL,
  `durationMinutes` int          DEFAULT 60,
  `maxAttendees`    int,
  `zoomJoinUrl`     text,
  `zoomStartUrl`    text,
  `label`           varchar(256),
  `createdAt`       timestamp    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
);

-- ─── landing_pages ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `landing_pages` (
  `id`                       int           NOT NULL AUTO_INCREMENT,
  `createdBy`                int           NOT NULL,
  `title`                    varchar(512)  NOT NULL,
  `slug`                     varchar(128)  NOT NULL,
  `headline`                 text,
  `subheadline`              text,
  `ctaText`                  varchar(256),
  `campaignTag`              varchar(128),
  `sourceTag`                varchar(128),
  `webinarId`                int,
  `isActive`                 tinyint(1)    NOT NULL DEFAULT 1,
  `customCss`                text,
  `backgroundImageUrl`       text,
  `accentColor`              varchar(16)   DEFAULT '#C9A84C',
  `artworkUrl`               text,
  `enabledFields`            json,
  `optInLabel`               text,
  `showOptIn`                tinyint(1)    DEFAULT 1,
  `confirmationEmailSubject` varchar(512),
  `confirmationEmailBody`    text,
  `confirmationPdfUrl`       text,
  `bodyText`                 text,
  `createdAt`                timestamp     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt`                timestamp     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `landing_pages_slug_unique` (`slug`)
);

-- ─── leads ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `leads` (
  `id`                    int           NOT NULL AUTO_INCREMENT,
  `firstName`             varchar(128)  NOT NULL,
  `lastName`              varchar(128)  NOT NULL,
  `email`                 varchar(320)  NOT NULL,
  `phone`                 varchar(32),
  `source`                varchar(128),
  `campaign`              varchar(128),
  `landingPageId`         int,
  `assignedTo`            int,
  `stage`                 enum('new_lead','registered','attended','no_show','consultation_booked','under_contract','closed') NOT NULL DEFAULT 'new_lead',
  `score`                 int           DEFAULT 0,
  `scoreReason`           text,
  `scoredAt`              timestamp     NULL,
  `smsConsent`            tinyint(1)    DEFAULT 0,
  `contactOptIn`          tinyint(1)    DEFAULT 0,
  `webinarId`             int,
  `webinarSessionId`      int,
  `zoomRegistrantId`      varchar(256),
  `zoomJoinUrl`           text,
  `attendanceStatus`      enum('registered','attended','no_show'),
  `consultationBookedAt`  timestamp     NULL,
  `googleCalendarEventId` varchar(256),
  `dealValue`             decimal(12,2),
  `dealClosedAt`          timestamp     NULL,
  `quickNote`             text,
  `createdAt`             timestamp     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt`             timestamp     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
);

-- ─── activity_log ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `activity_log` (
  `id`        int          NOT NULL AUTO_INCREMENT,
  `leadId`    int          NOT NULL,
  `userId`    int,
  `type`      enum('note','stage_change','email_sent','sms_sent','sms_received','webinar_registered','webinar_attended','webinar_no_show','consultation_booked','deal_created','deal_updated','score_updated','call_logged','confirmation_email','system') NOT NULL,
  `title`     varchar(512) NOT NULL,
  `content`   text,
  `metadata`  json,
  `createdAt` timestamp    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
);

-- ─── sms_messages ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `sms_messages` (
  `id`         int          NOT NULL AUTO_INCREMENT,
  `leadId`     int          NOT NULL,
  `direction`  enum('outbound','inbound') NOT NULL,
  `body`       text         NOT NULL,
  `status`     enum('queued','sent','delivered','failed','received') NOT NULL DEFAULT 'queued',
  `externalId` varchar(256),
  `sentBy`     int,
  `createdAt`  timestamp    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
);

-- ─── email_reminders ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `email_reminders` (
  `id`            int          NOT NULL AUTO_INCREMENT,
  `leadId`        int          NOT NULL,
  `webinarId`     int          NOT NULL,
  `type`          enum('registration_confirmation','reminder_24h','reminder_1h','reminder_10min','no_show_followup') NOT NULL,
  `scheduledAt`   timestamp    NOT NULL,
  `sentAt`        timestamp    NULL,
  `status`        enum('pending','sent','failed','cancelled') NOT NULL DEFAULT 'pending',
  `subject`       varchar(512),
  `body`          text,
  `attachmentUrl` text,
  `createdAt`     timestamp    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
);

-- ─── deals ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `deals` (
  `id`                 int          NOT NULL AUTO_INCREMENT,
  `leadId`             int          NOT NULL,
  `assignedTo`         int,
  `title`              varchar(512) NOT NULL,
  `value`              decimal(12,2) NOT NULL,
  `stage`              enum('prospect','qualified','proposal','negotiation','closed_won','closed_lost') NOT NULL DEFAULT 'prospect',
  `propertyAddress`    text,
  `expectedCloseDate`  timestamp    NULL,
  `actualCloseDate`    timestamp    NULL,
  `notes`              text,
  `createdAt`          timestamp    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt`          timestamp    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
);

-- ─── availability ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `availability` (
  `id`         int         NOT NULL AUTO_INCREMENT,
  `userId`     int         NOT NULL,
  `dayOfWeek`  int         NOT NULL,
  `startTime`  varchar(8)  NOT NULL,
  `endTime`    varchar(8)  NOT NULL,
  `isActive`   tinyint(1)  NOT NULL DEFAULT 1,
  PRIMARY KEY (`id`)
);

-- ─── bookings ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `bookings` (
  `id`                    int          NOT NULL AUTO_INCREMENT,
  `userId`                int          NOT NULL,
  `leadId`                int,
  `guestName`             varchar(256) NOT NULL,
  `guestEmail`            varchar(320) NOT NULL,
  `guestPhone`            varchar(32),
  `scheduledAt`           timestamp    NOT NULL,
  `durationMinutes`       int          DEFAULT 30,
  `notes`                 text,
  `googleCalendarEventId` varchar(256),
  `status`                enum('confirmed','cancelled','completed') NOT NULL DEFAULT 'confirmed',
  `createdAt`             timestamp    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt`             timestamp    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
);

-- ─── media_library ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `media_library` (
  `id`         int          NOT NULL AUTO_INCREMENT,
  `uploadedBy` int          NOT NULL,
  `fileName`   varchar(512) NOT NULL,
  `fileUrl`    text         NOT NULL,
  `fileKey`    text         NOT NULL,
  `fileType`   enum('logo','image','background','other') NOT NULL DEFAULT 'image',
  `mimeType`   varchar(128),
  `fileSize`   int,
  `label`      varchar(256),
  `createdAt`  timestamp    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
);

-- ─── pending_invites ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `pending_invites` (
  `id`         int          NOT NULL AUTO_INCREMENT,
  `email`      varchar(320) NOT NULL,
  `name`       text,
  `role`       enum('user','admin') NOT NULL DEFAULT 'user',
  `token`      varchar(128) NOT NULL,
  `invitedBy`  int          NOT NULL,
  `acceptedAt` timestamp    NULL,
  `expiresAt`  timestamp    NOT NULL,
  `createdAt`  timestamp    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `pending_invites_token_unique` (`token`)
);

-- ─── landing_page_media ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `landing_page_media` (
  `id`            int         NOT NULL AUTO_INCREMENT,
  `landingPageId` int         NOT NULL,
  `mediaId`       int         NOT NULL,
  `placement`     enum('foreground_logo','foreground_image','background') NOT NULL DEFAULT 'foreground_logo',
  `sortOrder`     int         DEFAULT 0,
  `createdAt`     timestamp   NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
);

-- ─── __drizzle_migrations ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `__drizzle_migrations` (
  `id`         int    NOT NULL AUTO_INCREMENT,
  `hash`       text   NOT NULL,
  `created_at` bigint,
  PRIMARY KEY (`id`)
);

SET FOREIGN_KEY_CHECKS = 1;

SELECT 'All 16 tables created successfully!' AS result;
