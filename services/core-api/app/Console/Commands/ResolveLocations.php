<?php

namespace App\Console\Commands;

use App\Models\CandidateProfile;
use App\Models\JobPosting;
use App\Services\InsightsPlaces;
use App\Services\LocationResolver;
use Illuminate\Console\Attributes\Description;
use Illuminate\Console\Attributes\Signature;
use Illuminate\Console\Command;
use Illuminate\Database\Eloquent\Builder;

/**
 * Looks up the centre point of profiles and postings that have a city but no point yet (Decision
 * 2026-10-21): never asked (Insights was down when they were saved) or asked more than a day ago
 * without an answer. A few per run, so Nominatim's 1 request per second is never a problem.
 */
#[Signature('locations:resolve {--limit=25 : Places per kind and run}')]
#[Description('Look up missing city centre points for job matching')]
class ResolveLocations extends Command
{
    public function handle(InsightsPlaces $places, LocationResolver $resolver): int
    {
        if (! $places->enabled()) {
            $this->info('Place lookups are off (INSIGHTS_INTERNAL_URL is empty).');

            return self::SUCCESS;
        }

        $limit = max(1, (int) $this->option('limit'));
        $done = 0;
        foreach ([CandidateProfile::query(), JobPosting::query()] as $query) {
            $query->whereNotNull('location_psgc')
                ->whereNull('location_lat')
                ->where(fn (Builder $due) => $due->whereNull('location_checked_at')->orWhere('location_checked_at', '<', now()->subDay()))
                ->orderBy('id')
                ->limit($limit)
                ->get()
                ->each(function ($model) use ($resolver, &$done) {
                    $resolver->resolve($model);
                    $done += (int) $model->hasLocationPoint();
                });
        }

        $this->info("Found the centre point of {$done} place(s).");

        return self::SUCCESS;
    }
}
