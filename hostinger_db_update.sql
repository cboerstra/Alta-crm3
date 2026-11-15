-- ============================================================
-- Clarke & Associates CRM — Hostinger Database Update
-- Run this in phpMyAdmin → SQL tab on database u833783884_AltaCRM
-- Safe to run on an existing database — uses IF NOT EXISTS / IF EXISTS
-- guards so nothing is overwritten or duplicated.
-- ============================================================

-- Every statement names the schema explicitly. phpMyAdmin does not keep USE /
-- DATABASE() stable across a multi-statement paste, so nothing here relies on it.
USE `u833783884_AltaCRM`;

-- 1. Add passwordHash column to users (migration 0007)
--    Skips silently if the column already exists.
SET @col_exists = (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = 'u833783884_AltaCRM'
    AND TABLE_NAME   = 'users'
    AND COLUMN_NAME  = 'passwordHash'
);
SET @sql = IF(@col_exists = 0,
  'ALTER TABLE `u833783884_AltaCRM`.`users` ADD COLUMN `passwordHash` text',
  'SELECT ''passwordHash column already exists'' AS info'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 2. Add unique constraint on users.email (migration 0008)
--    Skips silently if the constraint already exists.
SET @idx_exists = (
  SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS
  WHERE TABLE_SCHEMA      = 'u833783884_AltaCRM'
    AND TABLE_NAME        = 'users'
    AND CONSTRAINT_NAME   = 'users_email_unique'
    AND CONSTRAINT_TYPE   = 'UNIQUE'
);
SET @sql2 = IF(@idx_exists = 0,
  'ALTER TABLE `u833783884_AltaCRM`.`users` ADD CONSTRAINT `users_email_unique` UNIQUE (`email`)',
  'SELECT ''users_email_unique already exists'' AS info'
);
PREPARE stmt2 FROM @sql2; EXECUTE stmt2; DEALLOCATE PREPARE stmt2;

-- 3. Create sms_templates table (migration 0009)
CREATE TABLE IF NOT EXISTS `u833783884_AltaCRM`.`sms_templates` (
  `id`        int          NOT NULL AUTO_INCREMENT,
  `trigger`   enum(
                'new_lead','registered','reminder_24h','reminder_1h',
                'attended','no_show','consultation_booked','deal_closed'
              ) NOT NULL,
  `body`      text         NOT NULL,
  `isActive`  tinyint(1)   NOT NULL DEFAULT 1,
  `createdBy` int          DEFAULT NULL,
  `createdAt` timestamp    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `sms_templates_id`      PRIMARY KEY (`id`),
  CONSTRAINT `sms_templates_trigger_unique` UNIQUE (`trigger`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 4. Add logoOnHtmlBackground column to landing_pages
SET @col4_exists = (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = 'u833783884_AltaCRM'
    AND TABLE_NAME   = 'landing_pages'
    AND COLUMN_NAME  = 'logoOnHtmlBackground'
);
SET @sql4 = IF(@col4_exists = 0,
  'ALTER TABLE `u833783884_AltaCRM`.`landing_pages` ADD COLUMN `logoOnHtmlBackground` tinyint(1) NOT NULL DEFAULT 0',
  'SELECT ''logoOnHtmlBackground column already exists'' AS info'
);
PREPARE stmt4 FROM @sql4; EXECUTE stmt4; DEALLOCATE PREPARE stmt4;

-- 5. Add formEmbedded column to landing_pages
SET @col5_exists = (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = 'u833783884_AltaCRM'
    AND TABLE_NAME   = 'landing_pages'
    AND COLUMN_NAME  = 'formEmbedded'
);
SET @sql5 = IF(@col5_exists = 0,
  'ALTER TABLE `u833783884_AltaCRM`.`landing_pages` ADD COLUMN `formEmbedded` tinyint(1) NOT NULL DEFAULT 0',
  'SELECT ''formEmbedded column already exists'' AS info'
);
PREPARE stmt5 FROM @sql5; EXECUTE stmt5; DEALLOCATE PREPARE stmt5;

-- 6. Add formEnabled column to landing_pages (migration 0020)
--    Off = an uploaded HTML page renders without the CRM lead form.
SET @col6_exists = (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = 'u833783884_AltaCRM'
    AND TABLE_NAME   = 'landing_pages'
    AND COLUMN_NAME  = 'formEnabled'
);
SET @sql6 = IF(@col6_exists = 0,
  'ALTER TABLE `u833783884_AltaCRM`.`landing_pages` ADD COLUMN `formEnabled` tinyint(1) NOT NULL DEFAULT 1',
  'SELECT ''formEnabled column already exists'' AS info'
);
PREPARE stmt6 FROM @sql6; EXECUTE stmt6; DEALLOCATE PREPARE stmt6;

-- 7. Add smsConsentEnabled column to landing_pages (migration 0020)
--    Off = the phone field is collected without the SMS-consent checkbox.
SET @col7_exists = (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = 'u833783884_AltaCRM'
    AND TABLE_NAME   = 'landing_pages'
    AND COLUMN_NAME  = 'smsConsentEnabled'
);
SET @sql7 = IF(@col7_exists = 0,
  'ALTER TABLE `u833783884_AltaCRM`.`landing_pages` ADD COLUMN `smsConsentEnabled` tinyint(1) NOT NULL DEFAULT 1',
  'SELECT ''smsConsentEnabled column already exists'' AS info'
);
PREPARE stmt7 FROM @sql7; EXECUTE stmt7; DEALLOCATE PREPARE stmt7;

-- 8. Add headScripts column to landing_pages (auto-migration 0033)
--    Tracking pixels / tags injected into the public page's <head>.
--    The app also adds this itself on startup; here for completeness.
SET @col8_exists = (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = 'u833783884_AltaCRM'
    AND TABLE_NAME   = 'landing_pages'
    AND COLUMN_NAME  = 'headScripts'
);
SET @sql8 = IF(@col8_exists = 0,
  'ALTER TABLE `u833783884_AltaCRM`.`landing_pages` ADD COLUMN `headScripts` text DEFAULT NULL',
  'SELECT ''headScripts column already exists'' AS info'
);
PREPARE stmt8 FROM @sql8; EXECUTE stmt8; DEALLOCATE PREPARE stmt8;

-- 9. Payroll tables (auto-migration 0034 / drizzle 0022)
--    Quarterly payroll reporting for the owner's LLCs.
--    The app also creates these itself on startup; here for completeness.
CREATE TABLE IF NOT EXISTS `u833783884_AltaCRM`.`payroll_companies` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(256) NOT NULL,
	`ein` varchar(16),
	`taxClassification` enum('s_corp','c_corp','partnership','disregarded') NOT NULL DEFAULT 's_corp',
	`address` varchar(256),
	`city` varchar(128),
	`state` varchar(2) DEFAULT 'UT',
	`zip` varchar(10),
	`utahWithholdingAccount` varchar(32),
	`utahUiAccount` varchar(32),
	`utahUiRate` decimal(6,3) NOT NULL DEFAULT '1.200',
	`depositSchedule` enum('monthly','semiweekly') NOT NULL DEFAULT 'monthly',
	`utahFilingFrequency` enum('monthly','quarterly','annual') NOT NULL DEFAULT 'quarterly',
	`payFrequency` enum('weekly','biweekly','semimonthly','monthly','quarterly','annual') NOT NULL DEFAULT 'monthly',
	`isActive` boolean NOT NULL DEFAULT true,
	`notes` text,
	`createdBy` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `payroll_companies_id` PRIMARY KEY(`id`)
);;

CREATE TABLE IF NOT EXISTS `u833783884_AltaCRM`.`payroll_deposits` (
	`id` int AUTO_INCREMENT NOT NULL,
	`companyId` int NOT NULL,
	`agency` enum('irs_941','irs_940','utah_withholding','utah_ui') NOT NULL,
	`taxYear` int NOT NULL,
	`quarter` int,
	`amountCents` int NOT NULL,
	`depositDate` date NOT NULL,
	`confirmation` varchar(128),
	`createdBy` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `payroll_deposits_id` PRIMARY KEY(`id`)
);;

CREATE TABLE IF NOT EXISTS `u833783884_AltaCRM`.`payroll_paychecks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`companyId` int NOT NULL,
	`personId` int NOT NULL,
	`payDate` date NOT NULL,
	`periodStart` date,
	`periodEnd` date,
	`grossCents` int NOT NULL,
	`retirement401kCents` int NOT NULL DEFAULT 0,
	`shareholderHealthCents` int NOT NULL DEFAULT 0,
	`federalWagesCents` int NOT NULL,
	`stateWagesCents` int NOT NULL,
	`ssWagesCents` int NOT NULL,
	`medicareWagesCents` int NOT NULL,
	`addlMedicareWagesCents` int NOT NULL DEFAULT 0,
	`futaWagesCents` int NOT NULL,
	`utahUiWagesCents` int NOT NULL,
	`federalWithholdingCents` int NOT NULL,
	`utahWithholdingCents` int NOT NULL,
	`withholdingOverridden` boolean NOT NULL DEFAULT false,
	`ssEmployeeCents` int NOT NULL,
	`medicareEmployeeCents` int NOT NULL,
	`addlMedicareCents` int NOT NULL DEFAULT 0,
	`ssEmployerCents` int NOT NULL,
	`medicareEmployerCents` int NOT NULL,
	`futaCents` int NOT NULL,
	`utahUiCents` int NOT NULL,
	`netPayCents` int NOT NULL,
	`memo` text,
	`createdBy` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `payroll_paychecks_id` PRIMARY KEY(`id`)
);;

CREATE TABLE IF NOT EXISTS `u833783884_AltaCRM`.`payroll_people` (
	`id` int AUTO_INCREMENT NOT NULL,
	`companyId` int NOT NULL,
	`firstName` varchar(128) NOT NULL,
	`lastName` varchar(128) NOT NULL,
	`ssnLast4` varchar(4),
	`relationship` enum('owner','spouse','other') NOT NULL DEFAULT 'owner',
	`filingStatus` enum('single','married_joint','head_of_household') NOT NULL DEFAULT 'married_joint',
	`multipleJobs` boolean NOT NULL DEFAULT false,
	`dependentsCredit` decimal(10,2) NOT NULL DEFAULT '0',
	`otherIncome` decimal(12,2) NOT NULL DEFAULT '0',
	`deductions` decimal(12,2) NOT NULL DEFAULT '0',
	`extraWithholding` decimal(10,2) NOT NULL DEFAULT '0',
	`futaExempt` boolean NOT NULL DEFAULT false,
	`utahUiExempt` boolean NOT NULL DEFAULT false,
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `payroll_people_id` PRIMARY KEY(`id`)
);;

-- ============================================================
-- Verification — should show all 12 items as OK
-- ============================================================
SELECT
  'passwordHash column'   AS check_item,
  IF(COUNT(*) > 0, 'OK', 'MISSING') AS status
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = 'u833783884_AltaCRM' AND TABLE_NAME = 'users' AND COLUMN_NAME = 'passwordHash'

UNION ALL

SELECT
  'users_email_unique constraint',
  IF(COUNT(*) > 0, 'OK', 'MISSING')
FROM information_schema.TABLE_CONSTRAINTS
WHERE TABLE_SCHEMA = 'u833783884_AltaCRM' AND TABLE_NAME = 'users' AND CONSTRAINT_NAME = 'users_email_unique'

UNION ALL

SELECT
  'sms_templates table',
  IF(COUNT(*) > 0, 'OK', 'MISSING')
FROM information_schema.TABLES
WHERE TABLE_SCHEMA = 'u833783884_AltaCRM' AND TABLE_NAME = 'sms_templates'

UNION ALL

SELECT
  'logoOnHtmlBackground column',
  IF(COUNT(*) > 0, 'OK', 'MISSING')
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = 'u833783884_AltaCRM' AND TABLE_NAME = 'landing_pages' AND COLUMN_NAME = 'logoOnHtmlBackground'

UNION ALL

SELECT
  'formEmbedded column',
  IF(COUNT(*) > 0, 'OK', 'MISSING')
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = 'u833783884_AltaCRM' AND TABLE_NAME = 'landing_pages' AND COLUMN_NAME = 'formEmbedded'

UNION ALL

SELECT
  'formEnabled column',
  IF(COUNT(*) > 0, 'OK', 'MISSING')
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = 'u833783884_AltaCRM' AND TABLE_NAME = 'landing_pages' AND COLUMN_NAME = 'formEnabled'

UNION ALL

SELECT
  'smsConsentEnabled column',
  IF(COUNT(*) > 0, 'OK', 'MISSING')
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = 'u833783884_AltaCRM' AND TABLE_NAME = 'landing_pages' AND COLUMN_NAME = 'smsConsentEnabled'

UNION ALL

SELECT
  'headScripts column',
  IF(COUNT(*) > 0, 'OK', 'MISSING')
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = 'u833783884_AltaCRM' AND TABLE_NAME = 'landing_pages' AND COLUMN_NAME = 'headScripts'

UNION ALL

SELECT
  'payroll_companies table',
  IF(COUNT(*) > 0, 'OK', 'MISSING')
FROM information_schema.TABLES
WHERE TABLE_SCHEMA = 'u833783884_AltaCRM' AND TABLE_NAME = 'payroll_companies'

UNION ALL

SELECT
  'payroll_people table',
  IF(COUNT(*) > 0, 'OK', 'MISSING')
FROM information_schema.TABLES
WHERE TABLE_SCHEMA = 'u833783884_AltaCRM' AND TABLE_NAME = 'payroll_people'

UNION ALL

SELECT
  'payroll_paychecks table',
  IF(COUNT(*) > 0, 'OK', 'MISSING')
FROM information_schema.TABLES
WHERE TABLE_SCHEMA = 'u833783884_AltaCRM' AND TABLE_NAME = 'payroll_paychecks'

UNION ALL

SELECT
  'payroll_deposits table',
  IF(COUNT(*) > 0, 'OK', 'MISSING')
FROM information_schema.TABLES
WHERE TABLE_SCHEMA = 'u833783884_AltaCRM' AND TABLE_NAME = 'payroll_deposits';

-- ═══════════════════════════════════════════════════════════════════════
-- Agent Campaigns (migration 0023)
-- ═══════════════════════════════════════════════════════════════════════

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
  `optOutDate` timestamp NULL,
  `importBatch` varchar(64),
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_agent_email` (`email`),
  INDEX `idx_agent_brokerage` (`brokerage`),
  INDEX `idx_agent_opted_out` (`optedOut`)
);

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
  `scheduledAt` timestamp NULL,
  `startedAt` timestamp NULL,
  `completedAt` timestamp NULL,
  `totalRecipients` int DEFAULT 0,
  `totalSent` int DEFAULT 0,
  `totalOpened` int DEFAULT 0,
  `totalClicked` int DEFAULT 0,
  `totalBounced` int DEFAULT 0,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_campaign_status` (`status`)
);

CREATE TABLE IF NOT EXISTS `campaign_recipients` (
  `id` int AUTO_INCREMENT PRIMARY KEY,
  `campaignId` int NOT NULL,
  `agentContactId` int NOT NULL,
  `status` enum('pending','sent','opened','clicked','bounced','unsubscribed') NOT NULL DEFAULT 'pending',
  `sentAt` timestamp NULL,
  `openedAt` timestamp NULL,
  `clickedAt` timestamp NULL,
  `trackingId` varchar(64),
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_recipient_campaign` (`campaignId`),
  INDEX `idx_recipient_contact` (`agentContactId`),
  INDEX `idx_recipient_tracking` (`trackingId`)
);

ALTER TABLE `landing_pages` ADD COLUMN IF NOT EXISTS `pageType` enum('real_estate_consumer','real_estate_agent','mortgage') NOT NULL DEFAULT 'mortgage' AFTER `slug`;

-- Verify agent campaign tables
SELECT 'agent_contacts table', IF(COUNT(*) > 0, 'OK', 'MISSING')
FROM information_schema.TABLES
WHERE TABLE_SCHEMA = 'u833783884_AltaCRM' AND TABLE_NAME = 'agent_contacts'
UNION ALL
SELECT 'email_campaigns table', IF(COUNT(*) > 0, 'OK', 'MISSING')
FROM information_schema.TABLES
WHERE TABLE_SCHEMA = 'u833783884_AltaCRM' AND TABLE_NAME = 'email_campaigns'
UNION ALL
SELECT 'campaign_recipients table', IF(COUNT(*) > 0, 'OK', 'MISSING')
FROM information_schema.TABLES
WHERE TABLE_SCHEMA = 'u833783884_AltaCRM' AND TABLE_NAME = 'campaign_recipients';

-- ═══════════════════════════════════════════════════════════════════════
-- Mortgage Clients (migration 0024)
-- ═══════════════════════════════════════════════════════════════════════

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

ALTER TABLE `email_campaigns` ADD COLUMN IF NOT EXISTS `audience` enum('agents','mortgage_clients') NOT NULL DEFAULT 'agents' AFTER `createdBy`;
ALTER TABLE `campaign_recipients` ADD COLUMN IF NOT EXISTS `mortgageClientId` int AFTER `agentContactId`;

-- ============================================================
-- Migration 0025: Expand campaign audiences and landing page types to 4 categories
-- ============================================================

-- Update existing audience values to new enum names
UPDATE `email_campaigns` SET `audience` = 're_agent' WHERE `audience` = 'agents';
UPDATE `email_campaigns` SET `audience` = 'past_mortgage' WHERE `audience` = 'mortgage_clients';
ALTER TABLE `email_campaigns` MODIFY COLUMN `audience` enum('re_agent','past_mortgage','prospective_mortgage','prospective_re_client') NOT NULL DEFAULT 're_agent';

-- Update existing pageType values to new enum names
UPDATE `landing_pages` SET `pageType` = 'prospective_re_client' WHERE `pageType` = 'real_estate_consumer';
UPDATE `landing_pages` SET `pageType` = 're_agent' WHERE `pageType` = 'real_estate_agent';
UPDATE `landing_pages` SET `pageType` = 'prospective_mortgage' WHERE `pageType` = 'mortgage';
ALTER TABLE `landing_pages` MODIFY COLUMN `pageType` enum('re_agent','past_mortgage','prospective_mortgage','prospective_re_client') NOT NULL DEFAULT 'prospective_mortgage';

-- Add leadId column to campaign_recipients for prospective campaigns targeting leads
ALTER TABLE `campaign_recipients` ADD COLUMN IF NOT EXISTS `leadId` int NULL AFTER `mortgageClientId`;
CREATE INDEX IF NOT EXISTS `idx_recipient_lead` ON `campaign_recipients` (`leadId`);

-- Verify
SELECT 'mortgage_clients table', IF(COUNT(*) > 0, 'OK', 'MISSING')
FROM information_schema.TABLES
WHERE TABLE_SCHEMA = 'u833783884_AltaCRM' AND TABLE_NAME = 'mortgage_clients';

SELECT 'audience enum updated', `audience` FROM `email_campaigns` LIMIT 1;
SELECT 'pageType enum updated', `pageType` FROM `landing_pages` LIMIT 1;

-- Two-factor authentication (TOTP). Also created automatically on app start.
CREATE TABLE IF NOT EXISTS `user_two_factor` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `userId` INT NOT NULL UNIQUE,
  `secretEnc` TEXT NOT NULL,
  `enabled` TINYINT(1) NOT NULL DEFAULT 0,
  `backupCodeHashes` JSON NULL,
  `lastUsedStep` INT NULL,
  `enabledAt` TIMESTAMP NULL,
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
