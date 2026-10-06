<?php

namespace App\Http\Controllers\Internal;

use App\Http\Controllers\Controller;
use App\Models\Accommodation;
use App\Models\JobPosting;
use App\Services\TrustScoreService;
use Illuminate\Http\JsonResponse;

/**
 * GET /internal/job-postings/{id}/summary – what the Insights Service needs for the Workplace
 * Accessibility Snapshot (InternalPostingSummary in docs/openapi.yaml). Only postings anyone may
 * see (open, approved, not deleted); everything else is 404 so the snapshot reveals nothing more.
 */
class PostingSummaryController extends Controller
{
    public function __invoke(int $id, TrustScoreService $trustScores): JsonResponse
    {
        $posting = JobPosting::query()->visible()
            ->with(['employer', 'accommodations' => fn ($query) => $query->orderBy('name')])
            ->findOrFail($id);

        return response()->json([
            'id' => $posting->id,
            'address' => $posting->address,
            'psgc_code' => $posting->location_psgc,
            'location_label' => $posting->location_label,
            'accommodations' => $posting->accommodations->map(fn (Accommodation $accommodation) => [
                'id' => $accommodation->id,
                'name' => $accommodation->name,
                'group' => $accommodation->group,
            ])->all(),
            'trust_score' => [
                ...$posting->employer->trustScoreSummary(),
                'breakdown' => $trustScores->breakdown($posting->employer),
            ],
        ]);
    }
}
