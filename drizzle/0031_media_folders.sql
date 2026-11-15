CREATE TABLE IF NOT EXISTS media_folders (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(256) NOT NULL,
  kind ENUM('shared','campaign','custom') NOT NULL DEFAULT 'custom',
  adCampaignId INT NULL,
  createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_media_folders_campaign (adCampaignId)
);
ALTER TABLE media_library ADD COLUMN folderId INT DEFAULT NULL;
ALTER TABLE media_library MODIFY COLUMN fileType ENUM('logo','image','background','other','video') NOT NULL DEFAULT 'image';
