ALTER TABLE `landing_pages` ADD `backgroundHtmlUrl` text;--> statement-breakpoint
ALTER TABLE `landing_pages` ADD `logoOnHtmlBackground` boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE `landing_pages` ADD `formEmbedded` boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE `landing_pages` ADD `formEnabled` boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `landing_pages` ADD `smsConsentEnabled` boolean DEFAULT true NOT NULL;