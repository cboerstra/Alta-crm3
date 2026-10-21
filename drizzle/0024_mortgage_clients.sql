-- Mortgage Clients (past client database)
CREATE TABLE IF NOT EXISTS `mortgage_clients` (
  `id` int AUTO_INCREMENT PRIMARY KEY,
  `firstName` varchar(128) NOT NULL,
  `lastName` varchar(128) NOT NULL,
  `email` varchar(320) NOT NULL,
  `phone` varchar(32),
  `address` varchar(512),
  `city` varchar(128),
  `state` varchar(2) DEFAULT 'UT',
  `zipCode` varchar(10),
  `loanType` varchar(64),
  `closingDate` date,
  `loanAmount` decimal(12,2),
  `tags` json,
  `optedOut` boolean NOT NULL DEFAULT false,
  `optOutDate` timestamp NULL,
  `importBatch` varchar(64),
  `notes` text,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_mc_email` (`email`),
  INDEX `idx_mc_city` (`city`),
  INDEX `idx_mc_opted_out` (`optedOut`),
  INDEX `idx_mc_closing_date` (`closingDate`)
);

-- Add audience column to email_campaigns
ALTER TABLE `email_campaigns` ADD COLUMN `audience` enum('agents','mortgage_clients') NOT NULL DEFAULT 'agents' AFTER `createdBy`;

-- Add mortgageClientId to campaign_recipients
ALTER TABLE `campaign_recipients` ADD COLUMN `mortgageClientId` int AFTER `agentContactId`;
ALTER TABLE `campaign_recipients` MODIFY COLUMN `agentContactId` int NULL;
CREATE INDEX `idx_recipient_mc` ON `campaign_recipients` (`mortgageClientId`);
