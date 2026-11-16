-- Migration 0031: AI provider key (Claude or OpenAI) for campaign drafting and lead scoring.
-- runAutoMigrations() in server/db.ts also creates this on startup.
CREATE TABLE IF NOT EXISTS ai_settings (
  id INT AUTO_INCREMENT PRIMARY KEY,
  provider VARCHAR(32) NOT NULL DEFAULT 'anthropic',
  apiKey TEXT NULL,
  model VARCHAR(128) NULL,
  enabled TINYINT(1) NOT NULL DEFAULT 1,
  lastVerifiedAt TIMESTAMP NULL,
  lastError TEXT NULL,
  updatedBy INT NULL,
  createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
