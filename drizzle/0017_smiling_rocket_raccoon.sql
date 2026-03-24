CREATE TABLE `sms_reminders` (
	`id` int AUTO_INCREMENT NOT NULL,
	`leadId` int NOT NULL,
	`webinarId` int NOT NULL,
	`type` enum('reminder_24h','reminder_1h','reminder_10min') NOT NULL,
	`scheduledAt` timestamp NOT NULL,
	`sentAt` timestamp,
	`status` enum('pending','sent','failed','cancelled') NOT NULL DEFAULT 'pending',
	`body` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `sms_reminders_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `sms_templates` ADD `smsBody` text;