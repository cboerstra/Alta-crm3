-- Migration 0029: bulk email sender (Brevo or any SMTP relay) for real-estate campaigns.
-- runAutoMigrations() in server/db.ts also creates this on startup.
CREATE TABLE IF NOT EXISTS bulk_email_settings (
  id INT AUTO_INCREMENT PRIMARY KEY,
  host VARCHAR(255) NULL,
  port INT NOT NULL DEFAULT 587,
  username VARCHAR(320) NULL,
  password TEXT NULL,
  fromEmail VARCHAR(320) NULL,
  fromName VARCHAR(128) NULL,
  replyTo VARCHAR(320) NULL,
  dailyLimit INT NOT NULL DEFAULT 290,
  enabled TINYINT(1) NOT NULL DEFAULT 0,
  lastVerifiedAt TIMESTAMP NULL,
  lastError TEXT NULL,
  updatedBy INT NULL,
  createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
