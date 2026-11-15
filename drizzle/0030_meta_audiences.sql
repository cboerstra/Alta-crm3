-- Migration 0030: Meta Custom Audiences for retargeting (website visitors and CRM lists).
-- runAutoMigrations() in server/db.ts also creates this on startup.
CREATE TABLE IF NOT EXISTS meta_audiences (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  kind ENUM('website','crm_list') NOT NULL,
  definition JSON NOT NULL,
  metaAudienceId VARCHAR(64) NULL,
  status ENUM('pending','ready','syncing','error') NOT NULL DEFAULT 'pending',
  memberCount INT NULL,
  sizeLow INT NULL,
  sizeHigh INT NULL,
  lastSyncedAt TIMESTAMP NULL,
  lastError TEXT NULL,
  createdBy INT NULL,
  createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
