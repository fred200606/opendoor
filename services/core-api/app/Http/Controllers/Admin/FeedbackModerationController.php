<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Resources\AdminFeedbackResource;
use App\Models\Feedback;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Http\Response;

/**
 * M10: feedback moderation. Responses stay anonymous (AdminFeedbackResource has no candidate
 * data); hiding one takes it out of the trust score (FeedbackObserver recalculates).
 */
class FeedbackModerationController extends Controller
{
    /** Newest first; `employer_id` and `hidden=0|1` filter. */
    public function index(Request $request): AnonymousResourceCollection
    {
        $filters = $request->validate([
            'employer_id' => ['nullable', 'integer', 'min:1'],
            'hidden' => ['nullable', 'in:0,1'],
            'page' => ['nullable', 'integer', 'min:1'],
        ]);

        $query = Feedback::query()->with(['application.jobPosting.employer', 'items.accommodation']);
        if (! empty($filters['employer_id'])) {
            $query->whereHas('application.jobPosting', fn (Builder $posting) => $posting->where('employer_id', $filters['employer_id']));
        }
        if (isset($filters['hidden'])) {
            $query->where('is_hidden', (bool) $filters['hidden']);
        }

        return AdminFeedbackResource::collection($query->latest()->orderByDesc('id')->paginate(12)->withQueryString());
    }

    public function hide(Request $request, Feedback $feedback): Response
    {
        $data = $request->validate(['hidden' => ['required', 'boolean']]);

        $feedback->is_hidden = $data['hidden'];
        $feedback->save();

        return response()->noContent();
    }
}
