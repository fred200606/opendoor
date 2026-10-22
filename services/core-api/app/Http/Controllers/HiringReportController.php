<?php

namespace App\Http\Controllers;

use App\Enums\HiringParty;
use App\Enums\HiringReportAction;
use App\Enums\HiringReportStatus;
use App\Exceptions\ApiException;
use App\Http\Resources\ApplicationResource;
use App\Models\Application;
use App\Models\HiringReport;
use App\Models\User;
use App\Notifications\HiringReportUpdate;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;

/**
 * Decision 2026-10-22b: hired only by mutual confirmation. Either party reports the hire with a
 * proposed start date; the other answers Confirm (application becomes hired), Not yet (stays
 * pending, may carry a new start date) or Incorrect (disputed, stage unchanged). Never
 * confirmed automatically; one pending report per application at a time.
 */
class HiringReportController extends Controller
{
    /** How far ahead a start date may be proposed. */
    private const MAX_DAYS_AHEAD = 365;

    public function store(Request $request, Application $application): JsonResponse
    {
        Gate::authorize('reportHiring', $application);
        $user = $request->user();
        $data = $request->validate(['start_date' => $this->startDateRules($application)]);

        $report = DB::transaction(function () use ($application, $user, $data) {
            $locked = Application::query()->lockForUpdate()->findOrFail($application->id);
            if (! $locked->status->isInProgress()) {
                throw new ApiException(
                    'INVALID_STATUS_TRANSITION',
                    "A hire can no longer be reported for an application that is {$locked->status->value}.",
                    422,
                );
            }
            if ($locked->pendingHiringReport()->exists()) {
                throw new ApiException('HIRING_REPORT_PENDING', 'A hiring report is already waiting for an answer.', 409);
            }

            $by = $this->party($locked, $user);
            $report = $locked->hiringReports()->forceCreate([
                'reported_by' => $by,
                'reporter_id' => $user->id,
                'start_date' => $data['start_date'],
            ]);
            $report->record(HiringReportAction::Reported, $by, $user, $data['start_date']);

            return $report;
        });

        return $this->respondWith($application, $report, HiringReportAction::Reported, 201);
    }

    public function respond(Request $request, Application $application, HiringReport $hiringReport): JsonResponse
    {
        Gate::authorize('reportHiring', $application);
        $user = $request->user();
        $data = $request->validate([
            'answer' => ['required', Rule::in(['confirm', 'not_yet', 'incorrect'])],
            // Only "Not yet" may move the start date (e.g. the first day was postponed).
            'start_date' => ['nullable', 'prohibited_unless:answer,not_yet', ...array_slice($this->startDateRules($application), 1)],
        ]);

        $action = DB::transaction(function () use ($application, $hiringReport, $user, $data) {
            $locked = Application::query()->lockForUpdate()->findOrFail($application->id);
            $report = HiringReport::query()->lockForUpdate()->findOrFail($hiringReport->id);
            if (! $report->isPending()) {
                throw new ApiException('HIRING_REPORT_CLOSED', "This hiring report was already answered ({$report->status->value}).", 409);
            }
            $by = $this->party($locked, $user);
            if ($by !== $report->respondent()) {
                throw new ApiException('FORBIDDEN', 'Only the other party can answer this hiring report.', 403);
            }

            $action = match ($data['answer']) {
                'confirm' => HiringReportAction::Confirmed,
                'not_yet' => HiringReportAction::NotYet,
                'incorrect' => HiringReportAction::Disputed,
            };
            $startDate = $data['start_date'] ?? null;

            if ($action === HiringReportAction::NotYet) {
                if ($startDate) {
                    $report->start_date = $startDate;
                }
                $report->save();
            } else {
                $report->forceFill([
                    'status' => $action === HiringReportAction::Confirmed ? HiringReportStatus::Confirmed : HiringReportStatus::Disputed,
                    'responded_at' => now(),
                ])->save();
            }
            $report->record($action, $by, $user, $startDate);

            if ($action === HiringReportAction::Confirmed) {
                $locked->markHired($report);
            }

            return $action;
        });

        return $this->respondWith($application, $hiringReport->fresh(), $action, 200);
    }

    /** @return list<mixed> */
    private function startDateRules(Application $application): array
    {
        return [
            'required', 'date_format:Y-m-d',
            'after_or_equal:'.$application->created_at->toDateString(),
            'before_or_equal:'.now()->addDays(self::MAX_DAYS_AHEAD)->toDateString(),
        ];
    }

    private function party(Application $application, User $user): HiringParty
    {
        return $application->isByCandidate($user) ? HiringParty::Candidate : HiringParty::Employer;
    }

    /** Tells the other party (the respondent of a new report, otherwise the reporter) and returns the application. */
    private function respondWith(Application $application, HiringReport $report, HiringReportAction $action, int $status): JsonResponse
    {
        $application = $application->fresh(ApplicationController::RELATIONS);
        HiringReportUpdate::sendFor($application, $report, $action);

        return (new ApplicationResource($application))->response()->setStatusCode($status);
    }
}
