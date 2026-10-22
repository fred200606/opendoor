<?php

namespace Tests\Feature\Dashboards;

use App\Enums\ApplicationStatus;
use App\Enums\HiringParty;
use App\Enums\HiringReportAction;
use App\Models\Application;
use App\Models\CandidateProfile;
use App\Models\Employer;
use App\Models\HiringReport;
use App\Models\JobPosting;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/** Employer dashboard: needs attention, recent activity and the weekly chart (Decision 2026-10-22f). */
class EmployerDashboardTest extends TestCase
{
    use RefreshDatabase;

    private Employer $employer;

    protected function setUp(): void
    {
        parent::setUp();
        // Thursday 22 October 2026, 10:00 Manila: the current week starts Monday 19 October.
        Carbon::setTestNow(Carbon::parse('2026-10-22 10:00', 'Asia/Manila'));
        $this->employer = Employer::factory()->verified()->create();
    }

    protected function tearDown(): void
    {
        Carbon::setTestNow();
        parent::tearDown();
    }

    private function applicant(string $name): CandidateProfile
    {
        return CandidateProfile::factory()->for(User::factory()->candidate()->state(['name' => $name]))->create();
    }

    private function apply(JobPosting $posting, string $name, string $at, ApplicationStatus $status = ApplicationStatus::Pending): Application
    {
        Carbon::setTestNow(Carbon::parse($at, 'Asia/Manila'));
        $application = Application::factory()->for($posting)->for($this->applicant($name))->status($status)->create();
        Carbon::setTestNow(Carbon::parse('2026-10-22 10:00', 'Asia/Manila'));

        return $application;
    }

    private function report(Application $application, HiringParty $by, string $at): HiringReport
    {
        Carbon::setTestNow(Carbon::parse($at, 'Asia/Manila'));
        $report = $application->hiringReports()->forceCreate([
            'reported_by' => $by,
            'reporter_id' => $by === HiringParty::Employer ? $this->employer->user_id : $application->candidateProfile->user_id,
            'start_date' => '2026-11-02',
        ]);
        $report->record(HiringReportAction::Reported, $by, null, '2026-11-02');
        Carbon::setTestNow(Carbon::parse('2026-10-22 10:00', 'Asia/Manila'));

        return $report;
    }

    public function test_needs_attention_lists_new_applications_per_job_and_hiring_reports_to_answer(): void
    {
        $encoder = JobPosting::factory()->for($this->employer)->open()->create(['title' => 'Data Encoder']);
        $support = JobPosting::factory()->for($this->employer)->open()->create(['title' => 'Customer Support']);
        $closed = JobPosting::factory()->for($this->employer)->closed()->create(['title' => 'Packer']);

        $this->apply($encoder, 'Ana Cruz', '2026-10-20 09:00');
        $this->apply($encoder, 'Ben Reyes', '2026-10-21 09:00');
        $this->apply($support, 'Cara Lim', '2026-10-21 10:00');
        $this->apply($support, 'Dan Uy', '2026-10-21 11:00', ApplicationStatus::Reviewed); // opened: not new
        $this->apply($closed, 'Eve Tan', '2026-10-21 12:00'); // job closed: not waiting
        $byCandidate = $this->apply($support, 'Fe Santos', '2026-10-01 09:00', ApplicationStatus::Contacted);
        $this->report($byCandidate, HiringParty::Candidate, '2026-10-21 15:00');
        // The employer's own report waits for the candidate, not for the employer.
        $this->report($this->apply($encoder, 'Gil Ong', '2026-10-01 09:00', ApplicationStatus::Contacted), HiringParty::Employer, '2026-10-21 16:00');
        $this->apply(JobPosting::factory()->open()->create(), 'Other Employer Applicant', '2026-10-21 09:00');

        Sanctum::actingAs($this->employer->user);
        $this->getJson('/api/employer/dashboard')
            ->assertOk()
            ->assertJsonPath('attention.new_applications', [
                ['job_posting_id' => $encoder->id, 'title' => 'Data Encoder', 'count' => 2],
                ['job_posting_id' => $support->id, 'title' => 'Customer Support', 'count' => 1],
            ])
            ->assertJsonPath('attention.hiring_reports', [[
                'application_id' => $byCandidate->id,
                'hiring_report_id' => $byCandidate->hiringReports()->first()->id,
                'job_title' => 'Customer Support',
                'candidate_name' => 'Fe Santos',
                'start_date' => '2026-11-02',
            ]]);
    }

    public function test_recent_activity_is_newest_first_own_applicants_only_and_names_no_needs(): void
    {
        $posting = JobPosting::factory()->for($this->employer)->open()->create(['title' => 'Data Encoder']);
        $first = $this->apply($posting, 'Ana Cruz', '2026-10-19 09:00', ApplicationStatus::Contacted);
        $this->report($first, HiringParty::Candidate, '2026-10-21 08:00');
        $this->apply($posting, 'Ben Reyes', '2026-10-20 09:00');
        $this->apply(JobPosting::factory()->open()->create(), 'Other Employer Applicant', '2026-10-21 09:00');

        Sanctum::actingAs($this->employer->user);
        $activity = $this->getJson('/api/employer/dashboard')->assertOk()->json('recent_activity');

        $this->assertSame(
            [['hiring_reported', 'candidate', 'Ana Cruz'], ['application_received', 'candidate', 'Ben Reyes'], ['application_received', 'candidate', 'Ana Cruz']],
            array_map(fn ($item) => [$item['type'], $item['by'], $item['candidate_name']], $activity),
        );
        $this->assertSame(['type', 'by', 'application_id', 'job_title', 'candidate_name', 'at'], array_keys($activity[0]));
        $this->assertSame('Data Encoder', $activity[0]['job_title']);
    }

    public function test_recent_activity_keeps_the_latest_eight(): void
    {
        $posting = JobPosting::factory()->for($this->employer)->open()->create();
        foreach (range(1, 10) as $day) {
            $this->apply($posting, "Applicant {$day}", sprintf('2026-10-%02d 09:00', $day));
        }

        Sanctum::actingAs($this->employer->user);
        $activity = $this->getJson('/api/employer/dashboard')->json('recent_activity');
        $this->assertCount(8, $activity);
        $this->assertSame('Applicant 10', $activity[0]['candidate_name']);
        $this->assertSame('Applicant 3', $activity[7]['candidate_name']);
    }

    public function test_weeks_count_applications_and_confirmed_hires_per_manila_week(): void
    {
        $posting = JobPosting::factory()->for($this->employer)->open()->create();
        $this->apply($posting, 'This Monday', '2026-10-19 00:30');
        $this->apply($posting, 'Last Sunday', '2026-10-18 23:30');
        $this->apply($posting, 'Too old', '2026-07-01 09:00');
        Application::factory()->for($posting)->hired('2026-10-20 03:00:00')->create();
        $this->apply(JobPosting::factory()->open()->create(), 'Other Employer Applicant', '2026-10-21 09:00');

        Sanctum::actingAs($this->employer->user);
        $weeks = $this->getJson('/api/employer/dashboard')->assertJsonCount(12, 'weeks')->json('weeks');

        $this->assertSame(['week_start' => '2026-08-03', 'applications' => 0, 'hires' => 0], $weeks[0]);
        $this->assertSame(['week_start' => '2026-10-12', 'applications' => 1, 'hires' => 0], $weeks[10]);
        // The hired application was created now (Thursday), so it counts as received this week too.
        $this->assertSame(['week_start' => '2026-10-19', 'applications' => 2, 'hires' => 1], $weeks[11]);
    }
}
