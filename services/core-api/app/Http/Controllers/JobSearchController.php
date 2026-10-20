<?php

namespace App\Http\Controllers;

use App\Enums\UserRole;
use App\Enums\WorkSetup;
use App\Http\Resources\JobPostingResource;
use App\Models\JobPosting;
use App\Services\MatchingService;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Pagination\LengthAwarePaginator;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

/**
 * M5: search open postings. Candidates get `match` on every posting (MatchingService, Decision
 * 2026-10-21); with match=1 ("Recommended for me") the list is ranked by the match score, then by
 * the requested sort. `work_setup[]` filters for everyone; `distance` (km) keeps a candidate's
 * nearby jobs plus every remote one. Candidates also get `saved` (M12).
 */
class JobSearchController extends Controller
{
    public const PER_PAGE = 12;

    /** Distances (km) a candidate can choose. */
    public const DISTANCES = [10, 25, 50, 100];

    /** Columns the score needs; ranking loads only these for every matching posting. */
    private const SCORE_COLUMNS = ['id', 'work_setup', 'employment_type', 'skills', 'education_level', 'experience_years', 'location_psgc', 'location_lat', 'location_lon', 'location_province_psgc', 'closes_at', 'created_at'];

    public function index(Request $request): AnonymousResourceCollection
    {
        $filters = $request->validate([
            'q' => ['nullable', 'string', 'max:100'],
            'category' => ['nullable', 'integer'],
            'accommodations' => ['nullable', 'array', 'max:30'],
            'accommodations.*' => ['integer'],
            'work_setup' => ['nullable', 'array', 'max:3'],
            'work_setup.*' => [Rule::enum(WorkSetup::class)],
            'distance' => ['nullable', 'integer', Rule::in(self::DISTANCES)],
            'match' => ['nullable', 'boolean'],
            'sort' => ['nullable', Rule::in(['best', 'newest', 'closing'])],
            'page' => ['nullable', 'integer', 'min:1'],
        ]);

        $viewer = $request->user('sanctum');
        $matcher = MatchingService::for($viewer);
        $matchMode = $matcher !== null && $request->boolean('match');
        $sort = $filters['sort'] ?? 'best';

        $query = JobPosting::query()->visible();
        $this->filter($query, $filters);

        // Only a candidate whose city has a known centre point can filter by distance.
        $within = ! empty($filters['distance']) ? $matcher?->withinSql((int) $filters['distance']) : null;
        if ($within) {
            $query->where(fn (Builder $near) => $near->where('work_setup', WorkSetup::Remote)->orWhereRaw($within));
        }

        $postings = $matchMode ? $this->ranked($request, $query, $matcher, $sort) : $this->ordered($query, $sort);
        if ($matcher) {
            $postings->getCollection()->each($matcher->annotate(...));
        }

        if ($viewer?->role === UserRole::Candidate) {
            $savedIds = $viewer->candidateProfile?->savedJobs()
                ->whereKey($postings->getCollection()->modelKeys())
                ->pluck('job_postings.id')
                ->all() ?? [];
            $postings->getCollection()->each(fn (JobPosting $posting) => $posting->setAttribute('saved', in_array($posting->id, $savedIds, true)));
        }

        return JobPostingResource::collection($postings)->additional(['meta' => [
            'match_mode' => $matchMode,
            'distance' => $within ? (int) $filters['distance'] : null,
        ]]);
    }

    /**
     * @param  Builder<JobPosting>  $query
     * @return LengthAwarePaginator<int, JobPosting>
     */
    private function ordered(Builder $query, string $sort): LengthAwarePaginator
    {
        $sort === 'closing' ? $query->orderBy('closes_at') : $query->latest();

        return $query->orderByDesc('id')->with(JobPostingController::RELATIONS)->paginate(self::PER_PAGE)->withQueryString();
    }

    /**
     * "Recommended for me": every matching posting is scored (only the columns the score needs),
     * the best come first, then the requested sort (best/newest = newest, closing = soonest).
     *
     * @param  Builder<JobPosting>  $query
     * @return LengthAwarePaginator<int, JobPosting>
     */
    private function ranked(Request $request, Builder $query, MatchingService $matcher, string $sort): LengthAwarePaginator
    {
        $candidates = (clone $query)->get(array_map(fn ($column) => "job_postings.{$column}", self::SCORE_COLUMNS));
        $offered = DB::table('job_posting_accommodation')
            ->whereIn('job_posting_id', $candidates->modelKeys())
            ->get(['job_posting_id', 'accommodation_id'])
            ->groupBy('job_posting_id')
            ->map(fn ($rows) => $rows->pluck('accommodation_id')->map(fn ($id) => (int) $id)->all());

        $scores = $candidates->mapWithKeys(fn (JobPosting $posting) => [
            $posting->id => $matcher->evaluate($posting, $offered[$posting->id] ?? [])['score'] ?? -1,
        ]);
        $order = $candidates->sort(function (JobPosting $a, JobPosting $b) use ($scores, $sort) {
            return [$scores[$b->id], $sort === 'closing' ? $a->closes_at : $b->created_at, $b->id]
                <=> [$scores[$a->id], $sort === 'closing' ? $b->closes_at : $a->created_at, $a->id];
        })->modelKeys();

        $page = LengthAwarePaginator::resolveCurrentPage();
        $ids = array_slice($order, ($page - 1) * self::PER_PAGE, self::PER_PAGE);
        $items = JobPosting::query()->with(JobPostingController::RELATIONS)->whereKey($ids)->get()
            ->sortBy(fn (JobPosting $posting) => array_search($posting->id, $ids, true))->values();

        return new LengthAwarePaginator($items, count($order), self::PER_PAGE, $page, [
            'path' => $request->url(),
            'query' => $request->query(),
        ]);
    }

    /**
     * Keyword (title, description, company name), category, work setups, and accommodations the
     * posting must all offer.
     *
     * @param  Builder<JobPosting>  $query
     * @param  array<string, mixed>  $filters
     */
    private function filter(Builder $query, array $filters): void
    {
        $keyword = trim($filters['q'] ?? '');
        if ($keyword !== '') {
            // '!' as LIKE escape character: works the same on MySQL and SQLite (tests).
            $like = '%'.str_replace(['!', '%', '_'], ['!!', '!%', '!_'], $keyword).'%';
            $query->where(fn (Builder $match) => $match
                ->whereRaw("title like ? escape '!'", [$like])
                ->orWhereRaw("description like ? escape '!'", [$like])
                ->orWhereHas('employer', fn (Builder $employer) => $employer->whereRaw("company_name like ? escape '!'", [$like])));
        }

        if (! empty($filters['category'])) {
            $query->where('category_id', $filters['category']);
        }

        if (! empty($filters['work_setup'])) {
            $query->whereIn('work_setup', array_unique($filters['work_setup']));
        }

        $required = array_values(array_unique($filters['accommodations'] ?? []));
        if ($required !== []) {
            $query->whereHas('accommodations', fn (Builder $offered) => $offered->whereIn('accommodations.id', $required), '>=', count($required));
        }
    }
}
