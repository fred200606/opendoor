<?php

namespace App\Http\Controllers;

use App\Enums\ApplicationStatus;
use App\Enums\FeedbackRating;
use App\Exceptions\ApiException;
use App\Models\Application;
use App\Models\Feedback;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

/**
 * M7: the hired candidate rates each accommodation the posting advertised at the time of hire –
 * once, from calendar day 30 after the confirmed start date (Asia/Manila). Never log the request body (RA 10173).
 */
class FeedbackController extends Controller
{
    public function form(Application $application): JsonResponse
    {
        Gate::authorize('giveFeedback', $application);
        $this->ensureHired($application);

        return response()->json([
            'opens_on' => $application->feedbackOpensOn()->toDateString(),
            'is_open' => $application->isFeedbackOpen(),
            'submitted' => $application->feedback()->exists(),
            'items' => $application->accommodationsAtHire()->orderBy('accommodations.name')->get()
                ->map(fn ($accommodation) => ['accommodation_id' => $accommodation->id, 'name' => $accommodation->name])
                ->all(),
        ]);
    }

    public function store(Request $request, Application $application): JsonResponse
    {
        Gate::authorize('giveFeedback', $application);
        $this->ensureHired($application);
        if (! $application->isFeedbackOpen()) {
            throw new ApiException(
                'FEEDBACK_NOT_OPEN',
                'Feedback opens on '.$application->feedbackOpensOn()->toDateString().', 30 days after your confirmed start date.',
                422,
            );
        }
        if ($application->feedback()->exists()) {
            $this->alreadySubmitted();
        }

        $rateable = $application->accommodationsAtHire()->pluck('accommodations.id')->all();
        $data = $request->validate([
            'items' => ['required', 'array', 'min:1'],
            'items.*.accommodation_id' => ['required', 'integer', 'distinct', Rule::in($rateable)],
            'items.*.rating' => ['required', Rule::enum(FeedbackRating::class)],
            'comments' => ['nullable', 'string', 'max:2000'],
        ], [
            'items.*.accommodation_id.in' => 'This accommodation was not part of the job posting when you were hired.',
        ]);

        $ratings = collect($data['items'])->pluck('rating', 'accommodation_id')->all();
        if (array_diff($rateable, array_keys($ratings)) !== []) {
            throw ValidationException::withMessages(['items' => 'Rate every accommodation listed in the form.']);
        }

        try {
            $feedback = Feedback::submit($application, $ratings, $data['comments'] ?? null);
        } catch (UniqueConstraintViolationException) {
            $this->alreadySubmitted();
        }

        return response()->json([
            'id' => $feedback->id,
            'application_id' => $application->id,
            'items_rated' => count($ratings),
        ], 201);
    }

    private function ensureHired(Application $application): void
    {
        if ($application->status !== ApplicationStatus::Hired) {
            throw new ApiException('FEEDBACK_NOT_OPEN', 'Only hired applications can be rated.', 422);
        }
    }

    private function alreadySubmitted(): never
    {
        throw new ApiException('FEEDBACK_EXISTS', 'You have already rated this job.', 409);
    }
}
