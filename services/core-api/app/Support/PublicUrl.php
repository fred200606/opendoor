<?php

namespace App\Support;

use DateTimeInterface;
use Illuminate\Support\Facades\URL;

/** Links the browser opens directly (through the gateway, never Core's own host). */
class PublicUrl
{
    /**
     * Temporary signed link for a private file. The signature covers the path and query only
     * (relative), so it stays valid when the gateway forwards the request unchanged.
     *
     * @param  array<string, mixed>  $parameters
     */
    public static function signed(string $routeName, array $parameters, DateTimeInterface $expires): string
    {
        $path = URL::temporarySignedRoute($routeName, $expires, $parameters, absolute: false);

        return self::origin().$path;
    }

    /** Scheme, host and port of PUBLIC_API_URL (e.g. http://localhost:8080). */
    private static function origin(): string
    {
        $url = parse_url(config('opendoor.public_api_url'));

        return $url['scheme'].'://'.$url['host'].(isset($url['port']) ? ':'.$url['port'] : '');
    }
}
