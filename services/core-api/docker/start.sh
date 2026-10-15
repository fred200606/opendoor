#!/bin/sh
# Container start (Dockerfile CMD): cache config and routes from the environment, then serve.
set -e

php artisan config:cache
php artisan route:cache

# RUN_SCHEDULER=1 (Railway): the Free Trial allows 5 services, so the scheduler (expired postings,
# rating reminders, queued password-reset emails) runs next to the web server in this container
# instead of in its own service (decision 2026-10-15). CI leaves it off.
if [ "${RUN_SCHEDULER:-0}" = "1" ]; then
    php artisan schedule:work &
fi

exec frankenphp php-server --listen ":${PORT:-8001}" --root public/
