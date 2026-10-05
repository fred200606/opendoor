<?php

namespace App\Http\Controllers;

use App\Http\Resources\JobPostingResource;
use App\Models\JobPosting;
use App\Services\NeedsMatcher;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Validation\Rule;

/**
 * M5: search open postings. Candidates with saved needs get `match` on every posting; with
 * match=1 the list is ranked by needs met (full matches first), then by the requested sort.
 */
class JobSearchController extends Controller
{
    public const PER_PAGE = 12;

    public function index(Request $request): AnonymousResourceCollection
    {
        $filters = $request->validate([
            'q' => ['nullable', 'string', 'max:100'],
            'category' => ['nullable', 'integer'],
            'accommodations' => ['nullable', 'array', 'max:30'],
            'accommodations.*' => ['integer'],
            'match' => ['nullable', 'boolean'],
            'sort' => ['nullable', Rule::in(['best', 'newest', 'closing'])],
            'page' => ['nullable', 'integer', 'min:1'],
        ]);

        $matcher = NeedsMatcher::for($request->user('sanctum'));
        $matchMode = $matcher !== null && $request->boolean('match');

        $query = JobPosting::query()->visible()->with(JobPostingController::RELATIONS);
        $this->filter($query, $filters);

        if ($matchMode) {
            // Everyone has the same number of needs, so "full matches first" = most needs met first.
            $matcher->withMetCount($query);
            $query->orderByDesc('met');
        }
        // best = needs met (match mode only), then newest.
        ($filters['sort'] ?? 'best') === 'closing' ? $query->orderBy('closes_at') : $query->latest();
        $query->orderByDesc('id');

        $postings = $query->paginate(self::PER_PAGE)->withQueryString();
        if ($matcher) {
            $postings->getCollection()->each($matcher->annotate(...));
        }

        return JobPostingResource::collection($postings)->additional(['meta' => ['match_mode' => $matchMode]]);
    }

    /**
     * Keyword (title, description, company name), category, and accommodations the posting must all offer.
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

        $required = array_values(array_unique($filters['accommodations'] ?? []));
        if ($required !== []) {
            $query->whereHas('accommodations', fn (Builder $offered) => $offered->whereIn('accommodations.id', $required), '>=', count($required));
        }
    }
}
