<?php

namespace App\Services;

use App\Models\CandidateProfile;
use App\Models\JobPosting;

/**
 * Fills a profile's or posting's centre point and province from the Insights Service (Decision
 * 2026-10-21). When Insights is down nothing changes and `locations:resolve` tries again later.
 */
class LocationResolver
{
    public function __construct(private readonly InsightsPlaces $places) {}

    public function resolve(CandidateProfile|JobPosting $model): void
    {
        if (! $model->location_psgc) {
            return;
        }

        $place = $this->places->find($model->location_psgc);
        if ($place === false) {
            return;
        }

        // Called from the model's `saved` event, before Eloquent syncs the original: without this, a
        // checked_at equal to the old one (same second) would not count as changed and not be saved.
        $model->syncOriginal();
        $model->forceFill([
            'location_lat' => $place['lat'] ?? null,
            'location_lon' => $place['lon'] ?? null,
            'location_province_psgc' => $place['province_code'] ?? null,
            'location_checked_at' => now(),
        ])->saveQuietly();
    }
}
