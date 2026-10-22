<?php

namespace Tests\Feature\Applications;

use App\Enums\ApplicationStatus;
use App\Models\Accommodation;
use App\Models\Application;
use App\Models\CandidateProfile;
use App\Models\Employer;
use App\Models\JobPosting;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Testing\TestResponse;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/** Decision 2026-10-22b: hired only by mutual confirmation of a hiring report. */
class HiringReportTest extends TestCase
{
    use RefreshDatabase;

    private User $employerUser;

    private User $candidateUser;

    private JobPosting $posting;

    private Application $application;

    protected function setUp(): void
    {
        parent::setUp();
        Carbon::setTestNow(Carbon::parse('2026-10-01 10:00', 'Asia/Manila'));

        $employer = Employer::factory()->verified()->create(['company_name' => 'Bright Path BPO']);
        $this->employerUser = $employer->user;
        $this->posting = JobPosting::factory()->open()->withAccommodations(Accommodation::factory()->create(['name' => 'Remote work']))
            ->create(['employer_id' => $employer->id, 'title' => 'Data Encoder']);
        $profile = CandidateProfile::factory()->create();
        $this->candidateUser = $profile->user;
        $this->candidateUser->update(['name' => 'Maria Santos']);
        $this->application = Application::factory()->for($this->posting)->for($profile)->status(ApplicationStatus::Contacted)
            ->create(['created_at' => now()->subDays(10)]);
    }

    protected function tearDown(): void
    {
        Carbon::setTestNow();
        parent::tearDown();
    }

    private function report(User $actor, string $startDate = '2026-10-05', ?Application $application = null): TestResponse
    {
        Sanctum::actingAs($actor);

        return $this->postJson('/api/applications/'.($application ?? $this->application)->id.'/hiring-reports', ['start_date' => $startDate]);
    }

    private function answer(User $actor, int $reportId, string $answer, array $extra = []): TestResponse
    {
        Sanctum::actingAs($actor);

        return $this->postJson("/api/applications/{$this->application->id}/hiring-reports/{$reportId}/response", ['answer' => $answer, ...$extra]);
    }

    /** @return list<string> */
    private function messages(User $user): array
    {
        return $user->notifications()->reorder('created_at')->get()->pluck('data.message')->all();
    }

    public function test_employer_reports_and_the_candidate_confirms(): void
    {
        $id = $this->report($this->employerUser)
            ->assertCreated()
            ->assertJsonPath('status', 'contacted')
            ->assertJsonPath('hiring_reports.0.reported_by', 'employer')
            ->assertJsonPath('hiring_reports.0.start_date', '2026-10-05')
            ->assertJsonPath('hiring_reports.0.status', 'pending')
            ->assertJsonPath('hiring_reports.0.can_respond', false)
            ->json('hiring_reports.0.id');

        $notice = $this->candidateUser->notifications()->sole();
        $this->assertSame('hiring_report', $notice->type);
        $this->assertSame('Bright Path BPO reported that you were hired for Data Encoder, starting October 5, 2026. Please confirm it, or tell them it is not yet or not correct.', $notice->data['message']);
        $this->assertSame("/candidate/applications/{$this->application->id}", $notice->data['url']);

        Sanctum::actingAs($this->candidateUser);
        $this->getJson("/api/applications/{$this->application->id}")->assertJsonPath('hiring_reports.0.can_respond', true);

        $this->travel(1)->hour();
        $this->answer($this->candidateUser, $id, 'confirm')
            ->assertOk()
            ->assertJsonPath('status', 'hired')
            ->assertJsonPath('hired_at', now()->toIso8601String())
            ->assertJsonPath('hire_start_date', '2026-10-05')
            ->assertJsonPath('feedback_opens_on', '2026-11-04')
            ->assertJsonPath('hiring_reports.0.status', 'confirmed')
            ->assertJsonPath('hiring_reports.0.can_respond', false)
            ->assertJsonPath('hiring_reports.0.events.*.action', ['reported', 'confirmed'])
            ->assertJsonPath('hiring_reports.0.events.*.actor_role', ['employer', 'candidate']);

        // The promised accommodations are recorded at the confirmation (M7).
        $this->assertSame(['Remote work'], $this->application->fresh()->accommodationsAtHire->pluck('name')->all());
        $this->assertSame(['Maria Santos confirmed being hired for Data Encoder. Hired — confirmed.'], $this->messages($this->employerUser));
    }

    public function test_candidate_reports_and_the_employer_confirms(): void
    {
        $id = $this->report($this->candidateUser, '2026-09-28')->assertCreated()->json('hiring_reports.0.id');
        $this->assertSame(['Maria Santos reported being hired for Data Encoder, starting September 28, 2026. Please confirm it, or tell them it is not yet or not correct.'], $this->messages($this->employerUser));
        $this->assertSame("/employer/applications/{$this->application->id}", $this->employerUser->notifications()->sole()->data['url']);

        $this->answer($this->employerUser, $id, 'confirm')->assertOk()->assertJsonPath('status', 'hired')->assertJsonPath('feedback_opens_on', '2026-10-28');
        $this->assertSame(
            ['Congratulations! Bright Path BPO confirmed that you were hired for Data Encoder. You can rate the promised accommodations from October 28, 2026.'],
            $this->messages($this->candidateUser),
        );
    }

    public function test_not_yet_keeps_the_report_pending_and_may_move_the_start_date(): void
    {
        $id = $this->report($this->employerUser)->json('hiring_reports.0.id');

        $this->answer($this->candidateUser, $id, 'not_yet', ['start_date' => '2026-10-12'])
            ->assertOk()
            ->assertJsonPath('status', 'contacted')
            ->assertJsonPath('hiring_reports.0.status', 'pending')
            ->assertJsonPath('hiring_reports.0.start_date', '2026-10-12')
            ->assertJsonPath('hiring_reports.0.events.1.action', 'not_yet')
            ->assertJsonPath('hiring_reports.0.events.1.start_date', '2026-10-12');
        $this->assertSame(['Maria Santos answered "Not yet" to the hiring report for Data Encoder. The proposed start date is October 12, 2026.'], $this->messages($this->employerUser));

        // A plain "Not yet" keeps the date; the candidate can still confirm later.
        $this->answer($this->candidateUser, $id, 'not_yet')->assertOk()->assertJsonPath('hiring_reports.0.start_date', '2026-10-12');
        $this->answer($this->candidateUser, $id, 'confirm')->assertOk()->assertJsonPath('hire_start_date', '2026-10-12');
    }

    public function test_incorrect_disputes_the_report_and_keeps_the_stage(): void
    {
        $id = $this->report($this->candidateUser)->json('hiring_reports.0.id');

        $this->answer($this->employerUser, $id, 'incorrect')
            ->assertOk()
            ->assertJsonPath('status', 'contacted')
            ->assertJsonPath('hired_at', null)
            ->assertJsonPath('hiring_reports.0.status', 'disputed')
            ->assertJsonPath('hiring_reports.0.events.1.action', 'disputed');
        $this->assertSame(
            'Bright Path BPO said the hiring report for Data Encoder is not correct. The application stays at its current stage.',
            $this->messages($this->candidateUser)[0],
        );

        // The history stays; a new report can be made.
        $this->report($this->employerUser)->assertCreated()
            ->assertJsonPath('hiring_reports.0.status', 'disputed')
            ->assertJsonPath('hiring_reports.1.status', 'pending');
    }

    public function test_one_pending_report_at_a_time(): void
    {
        $this->report($this->employerUser)->assertCreated();

        $this->report($this->candidateUser)->assertStatus(409)->assertJsonPath('error.code', 'HIRING_REPORT_PENDING');
        $this->report($this->employerUser)->assertStatus(409);
        $this->assertSame(1, $this->application->hiringReports()->count());
    }

    public function test_only_the_other_party_answers_and_only_once(): void
    {
        $id = $this->report($this->employerUser)->json('hiring_reports.0.id');

        $this->answer($this->employerUser, $id, 'confirm')->assertForbidden()->assertJsonPath('error.code', 'FORBIDDEN');
        foreach ([Employer::factory()->create()->user, CandidateProfile::factory()->create()->user, User::factory()->admin()->create()] as $stranger) {
            $this->answer($stranger, $id, 'confirm')->assertForbidden();
            $this->report($stranger)->assertForbidden();
        }
        $this->assertSame('contacted', $this->application->fresh()->status->value);

        $this->answer($this->candidateUser, $id, 'incorrect')->assertOk();
        $this->answer($this->candidateUser, $id, 'confirm')->assertStatus(409)->assertJsonPath('error.code', 'HIRING_REPORT_CLOSED');

        // A report of another application is not found under this one.
        $other = Application::factory()->for(JobPosting::factory()->open()->create(['employer_id' => $this->posting->employer_id]))
            ->status(ApplicationStatus::Reviewed)->create(['created_at' => now()->subDay()]);
        $otherId = $this->report($this->employerUser, '2026-10-02', $other)->assertCreated()->json('hiring_reports.0.id');
        $this->answer($this->employerUser, $otherId, 'confirm')->assertNotFound();
    }

    public function test_withdrawal_or_rejection_cancels_a_pending_report(): void
    {
        $id = $this->report($this->employerUser)->json('hiring_reports.0.id');
        Sanctum::actingAs($this->candidateUser);
        $this->patchJson("/api/applications/{$this->application->id}/status", ['status' => 'withdrawn'])
            ->assertOk()
            ->assertJsonPath('hiring_reports.0.status', 'cancelled')
            ->assertJsonPath('hiring_reports.0.events.1.action', 'cancelled')
            ->assertJsonPath('hiring_reports.0.events.1.actor_role', 'candidate');
        $this->answer($this->candidateUser, $id, 'confirm')->assertStatus(409);
        // Only the withdrawal notice, no separate one for the cancelled report.
        $this->assertSame(['application_status_changed'], $this->employerUser->notifications()->pluck('type')->all());
        $this->assertSame(['hiring_report'], $this->candidateUser->notifications()->pluck('type')->all());

        $rejected = Application::factory()->for($this->posting)->status(ApplicationStatus::Shortlisted)->create(['created_at' => now()->subDay()]);
        $this->report($rejected->candidateProfile->user, '2026-10-01', $rejected)->assertCreated();
        Sanctum::actingAs($this->employerUser);
        $this->patchJson("/api/applications/{$rejected->id}/status", ['status' => 'rejected'])
            ->assertOk()
            ->assertJsonPath('hiring_reports.0.status', 'cancelled')
            ->assertJsonPath('hiring_reports.0.events.1.actor_role', 'employer');
    }

    public function test_a_final_application_cannot_get_a_report(): void
    {
        foreach ([ApplicationStatus::Rejected, ApplicationStatus::Withdrawn] as $status) {
            $this->application->forceFill(['status' => $status])->save();
            $this->report($this->employerUser)->assertUnprocessable()->assertJsonPath('error.code', 'INVALID_STATUS_TRANSITION');
        }

        $hired = Application::factory()->for($this->posting)->hired()->create();
        $this->report($this->employerUser, '2026-10-01', $hired)->assertUnprocessable();
        $this->assertSame(1, $hired->hiringReports()->count());
    }

    public function test_job_closed_keeps_the_stage_and_a_hire_can_still_be_reported(): void
    {
        Sanctum::actingAs($this->candidateUser);
        $this->getJson("/api/applications/{$this->application->id}")->assertJsonPath('job_closed', false);

        $this->posting->forceFill(['status' => 'closed'])->save();
        $this->getJson("/api/applications/{$this->application->id}")->assertJsonPath('status', 'contacted')->assertJsonPath('job_closed', true);
        $this->getJson('/api/applications')->assertJsonPath('data.0.job_closed', true);

        $id = $this->report($this->employerUser)->assertCreated()->json('hiring_reports.0.id');
        // Hired is final, so it is no longer shown as "Job closed" – also once the posting is deleted.
        $this->answer($this->candidateUser, $id, 'confirm')->assertOk()->assertJsonPath('status', 'hired')->assertJsonPath('job_closed', false);

        $open = Application::factory()->for($this->posting)->status(ApplicationStatus::Reviewed)->create();
        $this->posting->forceFill(['status' => 'open'])->save();
        $this->posting->delete();
        Sanctum::actingAs($this->employerUser);
        $this->getJson("/api/applications/{$open->id}")->assertJsonPath('job_closed', true);
        $this->getJson("/api/applications/{$this->application->id}")->assertJsonPath('job_closed', false);
    }

    public function test_the_start_date_is_validated(): void
    {
        $this->report($this->employerUser, '05/10/2026')->assertUnprocessable()->assertJsonValidationErrors(['start_date']);
        // Not before the application was made, not more than a year ahead.
        $this->report($this->employerUser, '2026-09-20')->assertUnprocessable()->assertJsonValidationErrors(['start_date']);
        $this->report($this->employerUser, '2027-10-02')->assertUnprocessable()->assertJsonValidationErrors(['start_date']);
        Sanctum::actingAs($this->employerUser);
        $this->postJson("/api/applications/{$this->application->id}/hiring-reports")->assertUnprocessable()->assertJsonValidationErrors(['start_date']);
        $this->assertSame(0, $this->application->hiringReports()->count());

        $id = $this->report($this->employerUser, '2027-10-01')->assertCreated()->json('hiring_reports.0.id');
        $this->answer($this->candidateUser, $id, 'maybe')->assertUnprocessable()->assertJsonValidationErrors(['answer']);
        // Only "Not yet" may change the start date.
        $this->answer($this->candidateUser, $id, 'confirm', ['start_date' => '2026-10-05'])->assertUnprocessable()->assertJsonValidationErrors(['start_date']);
        $this->answer($this->candidateUser, $id, 'not_yet', ['start_date' => 'soon'])->assertUnprocessable()->assertJsonValidationErrors(['start_date']);
        $this->assertSame('pending', $this->application->hiringReports()->sole()->status->value);
    }

    public function test_a_report_is_never_confirmed_automatically(): void
    {
        $this->report($this->employerUser)->assertCreated();

        $this->travel(90)->days();
        $this->artisan('feedback:remind')->assertSuccessful();
        Sanctum::actingAs($this->candidateUser);
        $this->getJson("/api/applications/{$this->application->id}")
            ->assertJsonPath('status', 'contacted')
            ->assertJsonPath('hiring_reports.0.status', 'pending')
            ->assertJsonPath('feedback_opens_on', null);
    }
}
