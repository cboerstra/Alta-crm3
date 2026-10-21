-- Migration 0027: Add contactType and fromDomain to sms_templates
ALTER TABLE `sms_templates`
  ADD COLUMN `contactType` enum('re_agent','re_client','re_webinar','mortgage_client','mortgage_prospect','mortgage_webinar') NOT NULL DEFAULT 'mortgage_prospect' AFTER `trigger`,
  ADD COLUMN `fromDomain` enum('altamortgagecrm','freehomesearchutah') NOT NULL DEFAULT 'altamortgagecrm' AFTER `contactType`;

-- Backfill: webinar-related triggers get mortgage_webinar contact type
UPDATE `sms_templates` SET `contactType` = 'mortgage_webinar'
WHERE `trigger` IN ('registered', 'reminder_24h', 'reminder_1h', 'reminder_10min', 'attended', 'no_show');
