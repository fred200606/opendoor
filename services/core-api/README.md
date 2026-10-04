# OpenDoor Core Service

Laravel 13 + Sanctum + MySQL 8. Owns auth/roles, profiles, postings, matching, applications, feedback + trust score, dashboards, notifications, moderation and master data. Runs on port **8001**, reached only through the gateway (`/api/*`) or by Insights (`/internal/*`).

## Local setup (Windows, no Docker)

```powershell
composer install
copy .env.example .env      # then fill DB_PASSWORD, DEMO_PASSWORD, SERVICE_KEY_INSIGHTS, REGISTRY_SOAP_PASSWORD
php artisan key:generate
php artisan migrate --seed  # needs the databases from docs/setup/create-databases.sql
php artisan serve --port=8001
```

Tests use in-memory SQLite (`phpunit.xml`): `php artisan test`.
