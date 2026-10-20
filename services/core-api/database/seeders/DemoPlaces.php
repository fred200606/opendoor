<?php

namespace Database\Seeders;

use Illuminate\Database\Eloquent\Model;

/**
 * City centre points of the demo locations (Decision 2026-10-21), so a fresh seed can rank by
 * distance without the Insights Service (approximate city centres). NCR cities have no province.
 */
final class DemoPlaces
{
    /** @var array<string, array{lat: float, lon: float, province: string|null}> */
    public const POINTS = [
        '1381300000' => ['lat' => 14.676041, 'lon' => 121.043700, 'province' => null], // Quezon City
        '1381200000' => ['lat' => 14.576377, 'lon' => 121.085110, 'province' => null], // City of Pasig
        '1380300000' => ['lat' => 14.554729, 'lon' => 121.024445, 'province' => null], // City of Makati
    ];

    /** Sets the point with the city, so the model does not ask Insights for it. */
    public static function apply(Model $model): void
    {
        $point = self::POINTS[$model->location_psgc] ?? null;
        if ($point) {
            $model->forceFill([
                'location_lat' => $point['lat'],
                'location_lon' => $point['lon'],
                'location_province_psgc' => $point['province'],
                'location_checked_at' => now(),
            ]);
        }
    }
}
