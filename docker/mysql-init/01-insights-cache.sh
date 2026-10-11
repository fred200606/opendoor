#!/bin/sh
# MySQL container init (docker-compose.yml, first start only): the Insights cache schema and its
# own user, next to Core's opendoor_core (created by MYSQL_DATABASE/MYSQL_USER). Each service
# owns its schema; neither user can read the other's.
set -e

mysql -uroot -p"$MYSQL_ROOT_PASSWORD" <<SQL
CREATE DATABASE IF NOT EXISTS insights_cache CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS 'insights'@'%' IDENTIFIED BY '${INSIGHTS_DB_PASSWORD}';
GRANT ALL PRIVILEGES ON insights_cache.* TO 'insights'@'%';
SQL
