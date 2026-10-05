<?php

namespace App\Services;

use App\Enums\UserRole;
use App\Models\Accommodation;
use App\Models\JobPosting;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Collection;

/**
 * M5 "Matches my needs": compares postings with a candidate's accommodation needs.
 * Only the needs are used – never the disability type (RA 10173).
 */
class NeedsMatcher
{
    /**
     * @param  Collection<int, Accommodation>  $needs
     */
    private function __construct(private readonly Collection $needs) {}

    /** The viewer's needs, or null when the viewer is not a candidate with saved needs. */
    public static function for(?User $viewer): ?self
    {
        if ($viewer?->role !== UserRole::Candidate || ! $viewer->candidateProfile) {
            return null;
        }

        $needs = $viewer->candidateProfile->accommodations()->orderBy('accommodations.id')->get(['accommodations.id', 'accommodations.name']);

        return $needs->isEmpty() ? null : new self($needs);
    }

    /**
     * Adds `met` (how many of the needs the posting offers) for ranking.
     *
     * @param  Builder<JobPosting>  $query
     */
    public function withMetCount(Builder $query): void
    {
        $query->withCount(['accommodations as met' => fn (Builder $offered) => $offered->whereIn('accommodations.id', $this->needs->modelKeys())]);
    }

    /** Sets `match` on a posting whose accommodations are loaded (read by JobPostingResource). */
    public function annotate(JobPosting $posting): void
    {
        $offered = $posting->accommodations->modelKeys();
        $missing = $this->needs->reject(fn (Accommodation $need) => in_array($need->id, $offered, true));

        $posting->setAttribute('match', [
            'met' => $this->needs->count() - $missing->count(),
            'total' => $this->needs->count(),
            'missing' => $missing->map(fn (Accommodation $need) => ['id' => $need->id, 'name' => $need->name])->values()->all(),
        ]);
    }
}
