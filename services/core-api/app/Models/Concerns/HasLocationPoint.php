<?php

namespace App\Models\Concerns;

use App\Services\LocationResolver;
use Illuminate\Database\Eloquent\Model;

/**
 * A city (location_psgc) with its centre point and province from the Insights Service (Decision
 * 2026-10-21). Changing the city clears the old point; after saving, the new one is looked up at
 * once (short timeout). Setting the point together with the city (seeders) keeps it.
 */
trait HasLocationPoint
{
    public static function bootHasLocationPoint(): void
    {
        static::saving(function (Model $model) {
            if ($model->isDirty('location_psgc') && ! $model->isDirty('location_lat')) {
                $model->forceFill(['location_lat' => null, 'location_lon' => null, 'location_province_psgc' => null, 'location_checked_at' => null]);
            }
        });

        static::saved(function (Model $model) {
            if ($model->location_psgc && $model->location_checked_at === null && ($model->wasRecentlyCreated || $model->wasChanged('location_psgc'))) {
                app(LocationResolver::class)->resolve($model);
            }
        });
    }

    public function hasLocationPoint(): bool
    {
        return $this->location_lat !== null && $this->location_lon !== null;
    }
}
