CREATE TABLE `automation_enrollments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sequenceId` int NOT NULL,
	`leadId` int NOT NULL,
	`campaignId` int,
	`status` enum('active','completed','cancelled','failed') NOT NULL DEFAULT 'active',
	`currentStepOrder` int NOT NULL DEFAULT 0,
	`nextRunAt` timestamp,
	`lastError` text,
	`startedAt` timestamp NOT NULL DEFAULT (now()),
	`completedAt` timestamp,
	CONSTRAINT `automation_enrollments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `automation_sequences` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(256) NOT NULL,
	`description` text,
	`triggerType` enum('campaign_lead','lead_created','stage_change','manual') NOT NULL DEFAULT 'campaign_lead',
	`triggerValue` varchar(128),
	`isActive` boolean NOT NULL DEFAULT true,
	`createdBy` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `automation_sequences_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `automation_step_runs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`enrollmentId` int NOT NULL,
	`stepId` int NOT NULL,
	`leadId` int NOT NULL,
	`status` enum('sent','skipped','failed') NOT NULL,
	`detail` text,
	`ranAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `automation_step_runs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `automation_steps` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sequenceId` int NOT NULL,
	`stepOrder` int NOT NULL DEFAULT 0,
	`type` enum('email','sms','call_task','wait','stage_change','notify_owner') NOT NULL,
	`delayMinutes` int NOT NULL DEFAULT 0,
	`subject` varchar(512),
	`body` text,
	`taskTitle` varchar(512),
	`taskNotes` text,
	`assignTo` int,
	`targetStage` varchar(64),
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `automation_steps_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `campaign_metrics` (
	`id` int AUTO_INCREMENT NOT NULL,
	`campaignId` int NOT NULL,
	`date` varchar(10) NOT NULL,
	`impressions` int NOT NULL DEFAULT 0,
	`reach` int NOT NULL DEFAULT 0,
	`clicks` int NOT NULL DEFAULT 0,
	`spend` decimal(12,2) NOT NULL DEFAULT '0.00',
	`reportedLeads` int NOT NULL DEFAULT 0,
	`cpc` decimal(12,4),
	`cpm` decimal(12,4),
	`ctr` decimal(8,4),
	`raw` json,
	`fetchedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `campaign_metrics_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `campaigns` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(256) NOT NULL,
	`description` text,
	`platform` enum('meta','google','other') NOT NULL DEFAULT 'meta',
	`objective` enum('OUTCOME_LEADS','OUTCOME_TRAFFIC','OUTCOME_AWARENESS','OUTCOME_ENGAGEMENT','OUTCOME_SALES') NOT NULL DEFAULT 'OUTCOME_LEADS',
	`status` enum('draft','scheduled','active','paused','completed','archived') NOT NULL DEFAULT 'draft',
	`landingPageId` int,
	`sequenceId` int,
	`dailyBudget` decimal(12,2),
	`lifetimeBudget` decimal(12,2),
	`bidStrategy` varchar(64) DEFAULT 'LOWEST_COST_WITHOUT_CAP',
	`startDate` timestamp,
	`endDate` timestamp,
	`targeting` json,
	`creative` json,
	`utmSource` varchar(128) DEFAULT 'facebook',
	`utmMedium` varchar(128) DEFAULT 'paid_social',
	`utmCampaign` varchar(128),
	`utmContent` varchar(128),
	`metaCampaignId` varchar(64),
	`metaAdSetId` varchar(64),
	`metaAdId` varchar(64),
	`metaCreativeId` varchar(64),
	`metaAdAccountId` varchar(64),
	`syncStatus` enum('local','syncing','synced','error') NOT NULL DEFAULT 'local',
	`syncError` text,
	`lastSyncedAt` timestamp,
	`aiGenerated` boolean NOT NULL DEFAULT false,
	`aiPrompt` text,
	`createdBy` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `campaigns_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `landing_page_templates` (
	`id` int AUTO_INCREMENT NOT NULL,
	`key` varchar(128) NOT NULL,
	`name` varchar(256) NOT NULL,
	`description` text,
	`category` enum('home_value','grant','purchase','refinance','webinar','general') NOT NULL DEFAULT 'general',
	`headline` text,
	`subheadline` text,
	`bodyText` text,
	`ctaText` varchar(256),
	`steps` json,
	`enabledFields` json,
	`accentColor` varchar(16) DEFAULT '#C9A84C',
	`textColor` varchar(16) DEFAULT '#FFFFFF',
	`backgroundHtmlUrl` text,
	`artworkUrl` text,
	`thumbnailUrl` text,
	`confirmationEmailSubject` varchar(512),
	`confirmationEmailBody` text,
	`conversionEventName` varchar(64) DEFAULT 'Lead',
	`isSystem` boolean NOT NULL DEFAULT false,
	`isActive` boolean NOT NULL DEFAULT true,
	`createdBy` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `landing_page_templates_id` PRIMARY KEY(`id`),
	CONSTRAINT `landing_page_templates_key_unique` UNIQUE(`key`)
);
--> statement-breakpoint
CREATE TABLE `meta_conversion_events` (
	`id` int AUTO_INCREMENT NOT NULL,
	`leadId` int,
	`campaignId` int,
	`landingPageId` int,
	`eventName` varchar(64) NOT NULL,
	`eventId` varchar(128) NOT NULL,
	`eventTime` timestamp NOT NULL DEFAULT (now()),
	`pixelId` varchar(64),
	`actionSource` varchar(32) DEFAULT 'website',
	`value` decimal(12,2),
	`currency` varchar(8) DEFAULT 'USD',
	`status` enum('pending','sent','failed','skipped') NOT NULL DEFAULT 'pending',
	`responseCode` int,
	`responseBody` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `meta_conversion_events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `meta_settings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`adAccountId` varchar(64),
	`businessId` varchar(64),
	`pageId` varchar(64),
	`instagramActorId` varchar(64),
	`accessToken` text,
	`tokenExpiresAt` timestamp,
	`pixelId` varchar(64),
	`capiAccessToken` text,
	`capiTestEventCode` varchar(64),
	`capiEnabled` boolean NOT NULL DEFAULT true,
	`pixelEnabled` boolean NOT NULL DEFAULT true,
	`publishEnabled` boolean NOT NULL DEFAULT false,
	`apiVersion` varchar(16) NOT NULL DEFAULT 'v21.0',
	`lastVerifiedAt` timestamp,
	`lastVerifyError` text,
	`updatedBy` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `meta_settings_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `tasks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`leadId` int,
	`campaignId` int,
	`assignedTo` int,
	`title` varchar(512) NOT NULL,
	`notes` text,
	`type` enum('call','email','follow_up','other') NOT NULL DEFAULT 'call',
	`dueAt` timestamp,
	`status` enum('open','completed','cancelled') NOT NULL DEFAULT 'open',
	`completedAt` timestamp,
	`completedBy` int,
	`createdBy` int,
	`source` varchar(64) DEFAULT 'manual',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `tasks_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `landing_pages` ADD `templateId` int;--> statement-breakpoint
ALTER TABLE `landing_pages` ADD `campaignId` int;--> statement-breakpoint
ALTER TABLE `landing_pages` ADD `metaPixelId` varchar(64);--> statement-breakpoint
ALTER TABLE `landing_pages` ADD `trackingEnabled` boolean DEFAULT true;--> statement-breakpoint
ALTER TABLE `landing_pages` ADD `capiEnabled` boolean DEFAULT true;--> statement-breakpoint
ALTER TABLE `landing_pages` ADD `conversionEventName` varchar(64) DEFAULT 'Lead';--> statement-breakpoint
ALTER TABLE `landing_pages` ADD `conversionValue` decimal(12,2);--> statement-breakpoint
ALTER TABLE `leads` ADD `campaignId` int;--> statement-breakpoint
ALTER TABLE `leads` ADD `utmSource` varchar(128);--> statement-breakpoint
ALTER TABLE `leads` ADD `utmMedium` varchar(128);--> statement-breakpoint
ALTER TABLE `leads` ADD `utmCampaign` varchar(128);--> statement-breakpoint
ALTER TABLE `leads` ADD `utmContent` varchar(128);--> statement-breakpoint
ALTER TABLE `leads` ADD `utmTerm` varchar(128);--> statement-breakpoint
ALTER TABLE `leads` ADD `fbclid` varchar(512);--> statement-breakpoint
ALTER TABLE `leads` ADD `fbc` varchar(512);--> statement-breakpoint
ALTER TABLE `leads` ADD `fbp` varchar(128);--> statement-breakpoint
ALTER TABLE `leads` ADD `gclid` varchar(512);--> statement-breakpoint
ALTER TABLE `leads` ADD `metaCampaignId` varchar(64);--> statement-breakpoint
ALTER TABLE `leads` ADD `metaCampaignName` varchar(256);--> statement-breakpoint
ALTER TABLE `leads` ADD `metaAdsetId` varchar(64);--> statement-breakpoint
ALTER TABLE `leads` ADD `metaAdsetName` varchar(256);--> statement-breakpoint
ALTER TABLE `leads` ADD `metaAdId` varchar(64);--> statement-breakpoint
ALTER TABLE `leads` ADD `metaAdName` varchar(256);--> statement-breakpoint
ALTER TABLE `leads` ADD `metaPlacement` varchar(128);--> statement-breakpoint
ALTER TABLE `leads` ADD `landingUrl` text;--> statement-breakpoint
ALTER TABLE `leads` ADD `referrerUrl` text;--> statement-breakpoint
ALTER TABLE `leads` ADD `clientIpAddress` varchar(64);--> statement-breakpoint
ALTER TABLE `leads` ADD `clientUserAgent` text;--> statement-breakpoint
ALTER TABLE `leads` ADD `attributionCapturedAt` timestamp;