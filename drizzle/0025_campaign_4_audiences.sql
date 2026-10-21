-- Migration 0025: Expand campaign audiences and landing page types to 4 categories
-- Audiences: re_agent, past_mortgage, prospective_mortgage, prospective_re_client

-- 1. Expand email_campaigns.audience enum
-- First update existing values to new enum names
UPDATE `email_campaigns` SET `audience` = 're_agent' WHERE `audience` = 'agents';
UPDATE `email_campaigns` SET `audience` = 'past_mortgage' WHERE `audience` = 'mortgage_clients';

ALTER TABLE `email_campaigns` MODIFY COLUMN `audience` enum('re_agent','past_mortgage','prospective_mortgage','prospective_re_client') NOT NULL DEFAULT 're_agent';

-- 2. Expand landing_pages.pageType enum
-- First update existing values to new enum names
UPDATE `landing_pages` SET `pageType` = 'prospective_re_client' WHERE `pageType` = 'real_estate_consumer';
UPDATE `landing_pages` SET `pageType` = 're_agent' WHERE `pageType` = 'real_estate_agent';
UPDATE `landing_pages` SET `pageType` = 'prospective_mortgage' WHERE `pageType` = 'mortgage';

ALTER TABLE `landing_pages` MODIFY COLUMN `pageType` enum('re_agent','past_mortgage','prospective_mortgage','prospective_re_client') NOT NULL DEFAULT 'prospective_mortgage';

-- 3. Add leadId column to campaign_recipients (for prospective campaigns targeting leads)
ALTER TABLE `campaign_recipients` ADD COLUMN `leadId` int NULL AFTER `mortgageClientId`;
CREATE INDEX `idx_recipient_lead` ON `campaign_recipients` (`leadId`);
