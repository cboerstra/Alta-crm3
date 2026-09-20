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

-- ============================================================
-- Verification — should show all 8 items as OK
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
WHERE TABLE_SCHEMA = 'u833783884_AltaCRM' AND TABLE_NAME = 'landing_pages' AND COLUMN_NAME = 'headScripts';
