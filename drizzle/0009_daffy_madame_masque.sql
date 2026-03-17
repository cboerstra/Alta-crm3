CREATE TABLE `sms_templates` (
	`id` int AUTO_INCREMENT NOT NULL,
	`trigger` enum('new_lead','registered','reminder_24h','reminder_1h','attended','no_show','consultation_booked','deal_closed') NOT NULL,
	`body` text NOT NULL,
	`isActive` boolean NOT NULL DEFAULT true,
	`createdBy` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `sms_templates_id` PRIMARY KEY(`id`),
	CONSTRAINT `sms_templates_trigger_unique` UNIQUE(`trigger`)
);
