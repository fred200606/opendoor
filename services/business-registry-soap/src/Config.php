<?php

declare(strict_types=1);

namespace OpenDoor\Registry;

/**
 * Settings from the process environment, falling back to the service's .env file (local runs).
 * Never print the values: REGISTRY_SOAP_PASSWORD is a secret.
 */
final class Config
{
    /** @var array<string, string>|null */
    private static ?array $file = null;

    public static function get(string $key, ?string $default = null): ?string
    {
        $value = getenv($key);
        if ($value !== false && $value !== '') {
            return $value;
        }

        return self::fromFile()[$key] ?? $default;
    }

    public static function root(): string
    {
        return dirname(__DIR__);
    }

    public static function databasePath(): string
    {
        return self::get('REGISTRY_DB_PATH') ?? self::root().'/data/registry.db';
    }

    /** @return array<string, string> */
    private static function fromFile(): array
    {
        if (self::$file !== null) {
            return self::$file;
        }

        self::$file = [];
        $path = self::root().'/.env';
        if (is_readable($path)) {
            foreach (file($path, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) ?: [] as $line) {
                if (str_starts_with(ltrim($line), '#') || ! str_contains($line, '=')) {
                    continue;
                }
                [$key, $value] = explode('=', $line, 2);
                self::$file[trim($key)] = trim(trim($value), '"\'');
            }
        }

        return self::$file;
    }
}
