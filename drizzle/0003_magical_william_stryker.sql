CREATE TABLE `landing_page_media` (
	`id` int AUTO_INCREMENT NOT NULL,
	`landingPageId` int NOT NULL,
	`mediaId` int NOT NULL,
	`placement` enum('foreground_logo','foreground_image','background') NOT NULL DEFAULT 'foreground_logo',
	`sortOrder` int DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `landing_page_media_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `media_library` (
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
