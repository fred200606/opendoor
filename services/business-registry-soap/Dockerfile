# Business Registry (simulated DTI/SEC SOAP service) – used by the CI integration test and Railway.
# Plain PHP, no Composer. The SQLite registry is (re)seeded at every start: it only holds demo data.
FROM dunglas/frankenphp:1-php8.4

RUN install-php-extensions soap

WORKDIR /app
COPY . .
ENV PORT=8003

EXPOSE 8003
HEALTHCHECK --interval=5s --timeout=3s --start-period=5s --retries=20 \
    CMD php -r 'exit(@file_get_contents("http://127.0.0.1:" . getenv("PORT") . "/health") === false ? 1 : 0);'
CMD ["sh", "-c", "php seed.php && exec frankenphp php-server --listen \":${PORT}\" --root public/"]
