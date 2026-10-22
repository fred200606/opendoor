<?php

namespace App\Services;

use App\Enums\ApplicationStatus;
use App\Enums\UserRole;
use App\Models\Application;
use App\Models\JobPosting;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\DB;

/**
 * M8 admin analytics for the dashboard charts (Decision 2026-10-22d). Aggregates only – no
 * candidate, needs or feedback is identifiable. Applications to postings the employer deleted are
 * left out, as in the rest of the admin dashboard.
 */
class AdminAnalytics
{
    public const WEEKS = 12;

    public const TOP_NEEDS = 6;

    /** @return array<string, mixed> */
    public function summary(): array
    {
        return [
            'weeks' => $this->weeks(),
            'funnel' => $this->funnel(),
            'needs' => $this->needs(),
            'delivery' => $this->delivery(),
        ];
    }

    /** @return Builder<Application> */
    private function applications(): Builder
    {
        return Application::query()->whereHas('jobPosting', fn (Builder $posting) => $posting->whereNull('job_postings.deleted_at'));
    }

    /**
     * The last 12 Manila weeks (Monday start, the current one last): applications made, hires
     * confirmed and accounts created (job seekers and employers). Counted in PHP so the same code
     * runs on MySQL and SQLite; the volumes are small.
     *
     * @return list<array{week_start: string, applications: int, hires: int, new_accounts: int}>
     */
    private function weeks(): array
    {
        $since = self::firstWeek()->timezone(config('app.timezone'));

        return self::perWeek([
            'applications' => $this->applications()->where('created_at', '>=', $since)->pluck('created_at'),
            'hires' => $this->applications()->where('status', ApplicationStatus::Hired)->where('hired_at', '>=', $since)->pluck('hired_at'),
            'new_accounts' => User::query()->whereIn('role', [UserRole::Candidate, UserRole::Employer])->where('created_at', '>=', $since)->pluck('created_at'),
        ]);
    }

    /** Monday 00:00 (Manila) of the first of the last 12 weeks. */
    public static function firstWeek(): CarbonImmutable
    {
        return CarbonImmutable::now('Asia/Manila')->startOfWeek(CarbonImmutable::MONDAY)->subWeeks(self::WEEKS - 1);
    }

    /**
     * Timestamps per series → one row per Manila week since firstWeek(), the current one last:
     * ['week_start' => 'Y-m-d', <series> => count, ...]. Shared with the employer dashboard.
     *
     * @param  array<string, iterable<mixed>>  $series
     * @return list<array<string, int|string>>
     */
    public static function perWeek(array $series): array
    {
        $first = self::firstWeek();
        $weekOf = fn ($at) => CarbonImmutable::parse($at)->timezone('Asia/Manila')->startOfWeek(CarbonImmutable::MONDAY)->toDateString();
        $counts = array_map(fn ($dates) => collect($dates)->countBy($weekOf), $series);

        return collect(range(0, self::WEEKS - 1))->map(function (int $offset) use ($first, $counts) {
            $week = $first->addWeeks($offset)->toDateString();

            return ['week_start' => $week, ...array_map(fn ($perWeek) => (int) ($perWeek[$week] ?? 0), $counts)];
        })->all();
    }

    /**
     * Applications that reached each stage. A stage the employer skipped counts as passed (a hire
     * also reached "contacted"), so the numbers never grow from one stage to the next; a closed
     * application counts up to the stages whose date it has.
     *
     * @return array{submitted: int, reviewed: int, shortlisted: int, contacted: int, hired: int}
     */
    private function funnel(): array
    {
        $reached = function (string $dateColumn, array $statuses): int {
            return $this->applications()
                ->where(fn (Builder $query) => $query->whereNotNull($dateColumn)->orWhereIn('status', $statuses))
                ->count();
        };

        return [
            'submitted' => $this->applications()->count(),
            'reviewed' => $reached('reviewed_at', ['reviewed', 'shortlisted', 'contacted', 'hired', 'rejected']),
            'shortlisted' => $reached('shortlisted_at', ['shortlisted', 'contacted', 'hired']),
            'contacted' => $reached('contacted_at', ['contacted', 'hired']),
            'hired' => $this->applications()->where('status', ApplicationStatus::Hired)->count(),
        ];
    }

    /**
     * The accommodations job seekers need most, against how many open jobs offer them: where the
     * supply gap is. Percentages are of all job seekers with a profile and of all visible postings.
     *
     * @return array{job_seekers: int, open_jobs: int, top: list<array{accommodation_id: int, name: string, job_seekers: int, open_jobs: int}>}
     */
    private function needs(): array
    {
        $openJobs = JobPosting::query()->visible()->pluck('id');
        $offered = DB::table('job_posting_accommodation')
            ->whereIn('job_posting_id', $openJobs)
            ->selectRaw('accommodation_id, count(*) as total')
            ->groupBy('accommodation_id')
            ->pluck('total', 'accommodation_id');

        $top = DB::table('candidate_accommodation')
            ->join('accommodations', 'accommodations.id', '=', 'candidate_accommodation.accommodation_id')
            ->selectRaw('accommodations.id, accommodations.name, count(*) as total')
            ->groupBy('accommodations.id', 'accommodations.name')
            ->orderByDesc('total')
            ->orderBy('accommodations.name')
            ->limit(self::TOP_NEEDS)
            ->get()
            ->map(fn ($row) => [
                'accommodation_id' => (int) $row->id,
                'name' => $row->name,
                'job_seekers' => (int) $row->total,
                'open_jobs' => (int) ($offered[$row->id] ?? 0),
            ])
            ->all();

        return [
            'job_seekers' => DB::table('candidate_profiles')->count(),
            'open_jobs' => $openJobs->count(),
            'top' => $top,
        ];
    }

    /**
     * How the promised accommodations were delivered, over every rated item of the non-hidden
     * responses (the same items the trust scores use).
     *
     * @return array{delivered: int, partial: int, not_delivered: int}
     */
    private function delivery(): array
    {
        $totals = DB::table('feedback_items')
            ->join('feedback', 'feedback.id', '=', 'feedback_items.feedback_id')
            ->where('feedback.is_hidden', false)
            ->selectRaw('feedback_items.rating, count(*) as total')
            ->groupBy('feedback_items.rating')
            ->pluck('total', 'rating');

        return collect(['delivered', 'partial', 'not_delivered'])->mapWithKeys(fn (string $rating) => [$rating => (int) ($totals[$rating] ?? 0)])->all();
    }
}
