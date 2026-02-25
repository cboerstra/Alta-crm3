CREATE TABLE `activity_log` (
	`id` int AUTO_INCREMENT NOT NULL,
	`leadId` int NOT NULL,
	`userId` int,
	`type` enum('note','stage_change','email_sent','sms_sent','sms_received','webinar_registered','webinar_attended','webinar_no_show','consultation_booked','deal_created','deal_updated','score_updated','call_logged','system') NOT NULL,
	`title` varchar(512) NOT NULL,
	`content` text,
	`metadata` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `activity_log_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `availability` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`dayOfWeek` int NOT NULL,
	`startTime` varchar(8) NOT NULL,
	`endTime` varchar(8) NOT NULL,
	`isActive` boolean NOT NULL DEFAULT true,
	CONSTRAINT `availability_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `bookings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`leadId` int,
	`guestName` varchar(256) NOT NULL,
	`guestEmail` varchar(320) NOT NULL,
	`guestPhone` varchar(32),
	`scheduledAt` timestamp NOT NULL,
	`durationMinutes` int DEFAULT 30,
	`notes` text,
	`googleCalendarEventId` varchar(256),
	`status` enum('confirmed','cancelled','completed') NOT NULL DEFAULT 'confirmed',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `bookings_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `deals` (
	`id` int AUTO_INCREMENT NOT NULL,
	`leadId` int NOT NULL,
	`assignedTo` int,
	`title` varchar(512) NOT NULL,
	`value` decimal(12,2) NOT NULL,
	`stage` enum('prospect','qualified','proposal','negotiation','closed_won','closed_lost') NOT NULL DEFAULT 'prospect',
	`propertyAddress` text,
	`expectedCloseDate` timestamp,
	`actualCloseDate` timestamp,
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `deals_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `email_reminders` (
	`id` int AUTO_INCREMENT NOT NULL,
	`leadId` int NOT NULL,
	`webinarId` int NOT NULL,
	`type` enum('registration_confirmation','reminder_24h','reminder_1h','reminder_10min','no_show_followup') NOT NULL,
	`scheduledAt` timestamp NOT NULL,
	`sentAt` timestamp,
	`status` enum('pending','sent','failed','cancelled') NOT NULL DEFAULT 'pending',
	`subject` varchar(512),
	`body` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `email_reminders_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `integrations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`provider` enum('zoom','google_calendar') NOT NULL,
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
--> statement-breakpoint
CREATE TABLE `landing_pages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`createdBy` int NOT NULL,
	`title` varchar(512) NOT NULL,
	`slug` varchar(128) NOT NULL,
	`headline` text,
	`subheadline` text,
	`ctaText` varchar(256),
	`campaignTag` varchar(128),
	`sourceTag` varchar(128),
	`webinarId` int,
	`isActive` boolean NOT NULL DEFAULT true,
	`customCss` text,
	`backgroundImageUrl` text,
	`accentColor` varchar(16) DEFAULT '#C9A84C',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `landing_pages_id` PRIMARY KEY(`id`),
	CONSTRAINT `landing_pages_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `leads` (
	`id` int AUTO_INCREMENT NOT NULL,
	`firstName` varchar(128) NOT NULL,
	`lastName` varchar(128) NOT NULL,
	`email` varchar(320) NOT NULL,
	`phone` varchar(32),
	`source` varchar(128),
	`campaign` varchar(128),
	`landingPageId` int,
	`assignedTo` int,
	`stage` enum('new_lead','registered','attended','no_show','consultation_booked','under_contract','closed') NOT NULL DEFAULT 'new_lead',
	`score` int DEFAULT 0,
	`scoreReason` text,
	`scoredAt` timestamp,
	`smsConsent` boolean DEFAULT false,
	`webinarId` int,
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
--> statement-breakpoint
CREATE TABLE `sms_messages` (
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
--> statement-breakpoint
CREATE TABLE `webinars` (
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
	`status` enum('draft','scheduled','live','completed','cancelled') NOT NULL DEFAULT 'draft',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `webinars_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `users` ADD `schedulingSlug` varchar(64);--> statement-breakpoint
ALTER TABLE `users` ADD `avatarUrl` text;--> statement-breakpoint
ALTER TABLE `users` ADD `phone` varchar(32);