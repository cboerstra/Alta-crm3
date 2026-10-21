-- Migration 0026: Add purpose and hostSite columns to landing_pages
ALTER TABLE `landing_pages`
  ADD COLUMN `purpose` enum('webinar','advertising') NOT NULL DEFAULT 'advertising' AFTER `pageType`,
  ADD COLUMN `hostSite` enum('altamortgagecrm','freehomesearchutah') NOT NULL DEFAULT 'altamortgagecrm' AFTER `purpose`;

-- Backfill: pages linked to a webinar get purpose = 'webinar'
UPDATE `landing_pages` SET `purpose` = 'webinar' WHERE `webinarId` IS NOT NULL;
