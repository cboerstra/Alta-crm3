CREATE TABLE `pending_invites` (
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
