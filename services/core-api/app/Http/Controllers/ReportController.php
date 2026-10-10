<?php

namespace App\Http\Controllers;

use App\Enums\ReportStatus;
use App\Http\Resources\ReportResource;
use App\Models\JobPosting;
use App\Models\Report;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

/** M10: a candidate reports a misleading posting for admin review. */
class ReportController extends Controller
{
    /**
     * Only postings the candidate can see (open, approved, not deleted); others are 404. One open
     * report per candidate and posting – after an admin resolves it, the candidate may report again.
     */
    public function store(Request $request, JobPosting $jobPosting): JsonResponse
    {
        abort_unless($jobPosting->isVisible(), 404);

        $data = $request->validate([
            'reason' => ['required', 'string', 'max:1000'],
        ], [
            'reason.required' => 'Tell us what is wrong with this posting.',
        ]);

        $alreadyOpen = Report::query()
            ->where('job_posting_id', $jobPosting->id)
            ->where('reporter_id', $request->user()->id)
            ->where('status', ReportStatus::Open)
            ->exists();
        if ($alreadyOpen) {
            throw ValidationException::withMessages(['reason' => 'You have already reported this posting. An administrator will review it.']);
        }

        $report = new Report(['reason' => $data['reason']]);
        $report->reporter()->associate($request->user());
        $report->jobPosting()->associate($jobPosting);
        $report->save();

        return (new ReportResource($report->refresh()))->response()->setStatusCode(201);
    }
}
