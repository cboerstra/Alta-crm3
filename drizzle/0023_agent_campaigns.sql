-- Agent Contacts
CREATE TABLE IF NOT EXISTS `agent_contacts` (
  `id` int AUTO_INCREMENT PRIMARY KEY,
  `firstName` varchar(128) NOT NULL,
  `lastName` varchar(128) NOT NULL,
  `email` varchar(320) NOT NULL,
  `phone` varchar(32),
  `brokerage` varchar(256),
  `licenseNumber` varchar(64),
  `city` varchar(128),
  `state` varchar(2) DEFAULT 'UT',
  `tags` json,
  `optedOut` boolean NOT NULL DEFAULT false,
  `optOutDate` timestamp,
  `importBatch` varchar(64),
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_agent_email` (`email`),
  INDEX `idx_agent_brokerage` (`brokerage`),
  INDEX `idx_agent_opted_out` (`optedOut`)
);

-- Email Campaigns
CREATE TABLE IF NOT EXISTS `email_campaigns` (
  `id` int AUTO_INCREMENT PRIMARY KEY,
  `createdBy` int NOT NULL,
  `name` varchar(256) NOT NULL,
  `subject` varchar(512) NOT NULL,
  `bodyHtml` text NOT NULL,
  `fromName` varchar(128) DEFAULT 'Scott Boerstra',
  `landingPageId` int,
  `filterTags` json,
  `filterBrokerage` varchar(256),
  `filterCity` varchar(128),
  `filterState` varchar(2),
  `batchSize` int NOT NULL DEFAULT 50,
  `batchDelayMinutes` int NOT NULL DEFAULT 15,
  `status` enum('draft','scheduled','sending','paused','completed','cancelled') NOT NULL DEFAULT 'draft',
  `scheduledAt` timestamp,
  `startedAt` timestamp,
  `completedAt` timestamp,
  `totalRecipients` int DEFAULT 0,
  `totalSent` int DEFAULT 0,
  `totalOpened` int DEFAULT 0,
  `totalClicked` int DEFAULT 0,
  `totalBounced` int DEFAULT 0,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_campaign_status` (`status`)
);

-- Campaign Recipients
CREATE TABLE IF NOT EXISTS `campaign_recipients` (
  `id` int AUTO_INCREMENT PRIMARY KEY,
  `campaignId` int NOT NULL,
  `agentContactId` int NOT NULL,
  `status` enum('pending','sent','opened','clicked','bounced','unsubscribed') NOT NULL DEFAULT 'pending',
  `sentAt` timestamp,
  `openedAt` timestamp,
  `clickedAt` timestamp,
  `trackingId` varchar(64),
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  INDEX `idx_recipient_campaign` (`campaignId`),
  INDEX `idx_recipient_contact` (`agentContactId`),
  INDEX `idx_recipient_tracking` (`trackingId`)
);

-- Add pageType to landing_pages
ALTER TABLE `landing_pages` ADD COLUMN `pageType` enum('real_estate_consumer','real_estate_agent','mortgage') NOT NULL DEFAULT 'mortgage' AFTER `slug`;
