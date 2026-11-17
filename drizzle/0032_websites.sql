CREATE TABLE IF NOT EXISTS websites (
  id INT AUTO_INCREMENT PRIMARY KEY,
  siteKey VARCHAR(64) NOT NULL UNIQUE,
  name VARCHAR(128) NOT NULL,
  baseUrl VARCHAR(255) NOT NULL,
  createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
ALTER TABLE landing_pages MODIFY COLUMN hostSite VARCHAR(64) NOT NULL DEFAULT 'altamortgagecrm';
INSERT IGNORE INTO websites (siteKey, name, baseUrl) VALUES
  ('altamortgagecrm', 'altamortgagecrm.net', 'https://altamortgagecrm.net'),
  ('freehomesearchutah', 'freehomesearchutah.com', 'https://freehomesearchutah.com');
