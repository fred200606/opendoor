# Core Service image – used by the CI integration test (docker compose) and Railway.
# Local development runs natively (php artisan serve), see README.
# FrankenPHP serves the app (classic mode); migrations are not run here: Railway's pre-deploy
# command / the CI workflow run `php artisan migrate --force`.
FROM dunglas/frankenphp:1-php8.4

RUN install-php-extensions pdo_mysql soap intl opcache zip
COPY --from=composer:2 /usr/bin/composer /usr/bin/composer

WORKDIR /app
ENV APP_ENV=production \
    APP_DEBUG=false \
    LOG_CHANNEL=stderr \
    PORT=8001

# Dependencies first so they are cached while only the code changes.
COPY composer.json composer.lock ./
RUN composer install --no-dev --no-interaction --no-progress --prefer-dist --no-scripts --no-autoloader

COPY . .
RUN composer dump-autoload --no-dev --optimize \
    && php artisan package:discover --ansi \
    && mkdir -p storage/app/private storage/app/public storage/framework/cache/data \
        storage/framework/sessions storage/framework/views storage/logs bootstrap/cache

EXPOSE 8001
HEALTHCHECK --interval=5s --timeout=3s --start-period=10s --retries=20 \
    CMD php -r 'exit(@file_get_contents("http://127.0.0.1:" . getenv("PORT") . "/up") === false ? 1 : 0);'
CMD ["sh", "docker/start.sh"]
