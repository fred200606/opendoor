-- OpenDoor: create the two MySQL schemas and their users (run once as root).
-- Each service owns its own schema; the users cannot read each other's data.
-- Replace both CHANGE_ME values first and put the same values in
--   services/core-api/.env          (DB_PASSWORD)
--   services/insights-service/.env  (CACHE_DB_PASSWORD)
-- Usage: mysql -u root -p < docs/setup/create-databases.sql

CREATE DATABASE IF NOT EXISTS opendoor_core  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE DATABASE IF NOT EXISTS opendoor_core_test CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE DATABASE IF NOT EXISTS insights_cache CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE USER IF NOT EXISTS 'opendoor_core'@'localhost' IDENTIFIED BY 'CHANGE_ME_CORE';
CREATE USER IF NOT EXISTS 'insights'@'localhost'      IDENTIFIED BY 'CHANGE_ME_INSIGHTS';

GRANT ALL PRIVILEGES ON opendoor_core.*      TO 'opendoor_core'@'localhost';
GRANT ALL PRIVILEGES ON opendoor_core_test.* TO 'opendoor_core'@'localhost';
GRANT ALL PRIVILEGES ON insights_cache.*     TO 'insights'@'localhost';
FLUSH PRIVILEGES;
