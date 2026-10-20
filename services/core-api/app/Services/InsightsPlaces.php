<?php

namespace App\Services;

use App\Http\Middleware\EnsureServiceKey;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * Core → Insights place lookups (Decision 2026-10-21): GET /internal/places/{code} with the shared
 * service key, a short timeout and no retries. Never blocks saving a profile or posting.
 */
class InsightsPlaces
{
    public function enabled(): bool
    {
        return filled(config('services.insights.url')) && filled(config('services.insights.key'));
    }

    /**
     * @return array{province_code: string|null, region_code: string, lat: float|null, lon: float|null}|null|false
     *                                                                                                             the place; null when Insights does not know the code; false when Insights is off or unavailable
     */
    public function find(string $code): array|null|false
    {
        if (! $this->enabled()) {
            return false;
        }

        try {
            $response = Http::baseUrl(rtrim((string) config('services.insights.url'), '/'))
                ->timeout(config('services.insights.timeout'))
                ->acceptJson()
                ->withHeaders([EnsureServiceKey::HEADER => (string) config('services.insights.key')])
                ->get("/internal/places/{$code}");
        } catch (ConnectionException) {
            Log::warning('Insights place lookup failed', ['psgc' => $code, 'error' => 'connection']);

            return false;
        }

        if ($response->notFound()) {
            return null;
        }
        if (! $response->successful() || ! is_array($response->json())) {
            Log::warning('Insights place lookup failed', ['psgc' => $code, 'status' => $response->status()]);

            return false;
        }

        $place = $response->json();

        return [
            'province_code' => is_string($place['province_code'] ?? null) ? $place['province_code'] : null,
            'region_code' => (string) ($place['region_code'] ?? ''),
            'lat' => is_numeric($place['lat'] ?? null) ? (float) $place['lat'] : null,
            'lon' => is_numeric($place['lon'] ?? null) ? (float) $place['lon'] : null,
        ];
    }
}
