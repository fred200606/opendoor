<?php

namespace App\Notifications;

use App\Enums\HiringParty;
use App\Enums\HiringReportAction;
use App\Models\Application;
use App\Models\HiringReport;

/**
 * M9 in-app notice (and M13 email) about a hiring report (Decision 2026-10-22b): a new report goes
 * to the party that has to answer, each answer to the reporter. Opens the application page.
 */
class HiringReportUpdate extends AppNotice
{
    public function __construct(
        private readonly Application $application,
        private readonly HiringReport $report,
        private readonly HiringReportAction $action,
    ) {
        parent::__construct();
    }

    /** Needs jobPosting.employer.user and candidateProfile.user. Cancellations send nothing (the withdrawal or rejection notice says it). */
    public static function sendFor(Application $application, HiringReport $report, HiringReportAction $action): void
    {
        if ($action === HiringReportAction::Cancelled) {
            return;
        }

        $recipient = self::recipient($report, $action) === HiringParty::Employer
            ? $application->jobPosting->employer->user
            : $application->candidateProfile->user;

        $recipient->notify(new self($application, $report, $action));
    }

    private static function recipient(HiringReport $report, HiringReportAction $action): HiringParty
    {
        return $action === HiringReportAction::Reported ? $report->respondent() : $report->reported_by;
    }

    protected function subject(object $notifiable): string
    {
        return "Hiring confirmation: {$this->application->jobPosting->title}";
    }

    public function databaseType(object $notifiable): string
    {
        return 'hiring_report';
    }

    /**
     * @return array<string, mixed>
     */
    public function toArray(object $notifiable): array
    {
        $application = $this->application;
        $title = $application->jobPosting->title;
        $company = $application->jobPosting->employer->company_name;
        $candidate = $application->candidateProfile->user->name;
        $toCandidate = self::recipient($this->report, $this->action) === HiringParty::Candidate;
        $other = $toCandidate ? $company : $candidate;
        $startDate = $this->report->start_date->format('F j, Y');

        $message = match ($this->action) {
            HiringReportAction::Reported => $toCandidate
                ? "{$company} reported that you were hired for {$title}, starting {$startDate}. Please confirm it, or tell them it is not yet or not correct."
                : "{$candidate} reported being hired for {$title}, starting {$startDate}. Please confirm it, or tell them it is not yet or not correct.",
            HiringReportAction::Confirmed => $toCandidate
                ? "Congratulations! {$company} confirmed that you were hired for {$title}. You can rate the promised accommodations from ".$application->feedbackOpensOn()->format('F j, Y').'.'
                : "{$candidate} confirmed being hired for {$title}. Hired — confirmed.",
            HiringReportAction::NotYet => "{$other} answered \"Not yet\" to the hiring report for {$title}. The proposed start date is {$startDate}.",
            HiringReportAction::Disputed => "{$other} said the hiring report for {$title} is not correct. The application stays at its current stage.",
            HiringReportAction::Cancelled => '',
        };

        return [
            'message' => $message,
            'url' => ($toCandidate ? '/candidate/applications/' : '/employer/applications/').$application->id,
            'application_id' => $application->id,
            'hiring_report_id' => $this->report->id,
            'action' => $this->action->value,
        ];
    }
}
