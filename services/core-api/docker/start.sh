#!/bin/sh
# Container start (Dockerfile CMD): cache config and routes from the environment, then serve.
set -e

php artisan config:cache
php artisan route:cache

exec frankenphp php-server --listen ":${PORT:-8001}" --root public/
