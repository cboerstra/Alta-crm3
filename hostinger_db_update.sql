-- ============================================================
-- Clarke & Associates CRM — Hostinger Database Update
-- Run this in phpMyAdmin → SQL tab on database u833783884_AltaCRM
-- Safe to run on an existing database — uses IF NOT EXISTS / IF EXISTS
-- guards so nothing is overwritten or duplicated.
-- ============================================================

-- 1. Add passwordHash column to users (migration 0007)
--    Skips silently if the column already exists.
SET @col_exists = (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME   = 'users'
    AND COLUMN_NAME  = 'passwordHash'
);
SET @sql = IF(@col_exists = 0,
  'ALTER TABLE `users` ADD COLUMN `passwordHash` text',
  'SELECT ''passwordHash column already exists'' AS info'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 2. Add unique constraint on users.email (migration 0008)
--    Skips silently if the constraint already exists.
SET @idx_exists = (
  SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS
  WHERE TABLE_SCHEMA      = DATABASE()
    AND TABLE_NAME        = 'users'
    AND CONSTRAINT_NAME   = 'users_email_unique'
    AND CONSTRAINT_TYPE   = 'UNIQUE'
);
SET @sql2 = IF(@idx_exists = 0,
  'ALTER TABLE `users` ADD CONSTRAINT `users_email_unique` UNIQUE (`email`)',
  'SELECT ''users_email_unique already exists'' AS info'
);
PREPARE stmt2 FROM @sql2; EXECUTE stmt2; DEALLOCATE PREPARE stmt2;

-- 3. Create sms_templates table (migration 0009)
CREATE TABLE IF NOT EXISTS `sms_templates` (
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

-- ============================================================
-- Verification — should show all 3 items as OK
-- ============================================================
SELECT
  'passwordHash column'   AS check_item,
  IF(COUNT(*) > 0, 'OK', 'MISSING') AS status
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'passwordHash'

UNION ALL

SELECT
  'users_email_unique constraint',
  IF(COUNT(*) > 0, 'OK', 'MISSING')
FROM information_schema.TABLE_CONSTRAINTS
WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND CONSTRAINT_NAME = 'users_email_unique'

UNION ALL

SELECT
  'sms_templates table',
  IF(COUNT(*) > 0, 'OK', 'MISSING')
FROM information_schema.TABLES
WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sms_templates';
