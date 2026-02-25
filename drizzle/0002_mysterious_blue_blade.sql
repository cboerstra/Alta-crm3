CREATE TABLE `webinar_sessions` (
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
--> statement-breakpoint
ALTER TABLE `activity_log` MODIFY COLUMN `type` enum('note','stage_change','email_sent','sms_sent','sms_received','webinar_registered','webinar_attended','webinar_no_show','consultation_booked','deal_created','deal_updated','score_updated','call_logged','confirmation_email','system') NOT NULL;--> statement-breakpoint
ALTER TABLE `email_reminders` ADD `attachmentUrl` text;--> statement-breakpoint
ALTER TABLE `landing_pages` ADD `artworkUrl` text;--> statement-breakpoint
ALTER TABLE `landing_pages` ADD `enabledFields` json;--> statement-breakpoint
ALTER TABLE `landing_pages` ADD `optInLabel` text;--> statement-breakpoint
ALTER TABLE `landing_pages` ADD `showOptIn` boolean DEFAULT true;--> statement-breakpoint
ALTER TABLE `landing_pages` ADD `confirmationEmailSubject` varchar(512);--> statement-breakpoint
ALTER TABLE `landing_pages` ADD `confirmationEmailBody` text;--> statement-breakpoint
ALTER TABLE `landing_pages` ADD `confirmationPdfUrl` text;--> statement-breakpoint
ALTER TABLE `landing_pages` ADD `bodyText` text;--> statement-breakpoint
ALTER TABLE `leads` ADD `contactOptIn` boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE `leads` ADD `webinarSessionId` int;--> statement-breakpoint
ALTER TABLE `webinars` ADD `landingPageId` int;