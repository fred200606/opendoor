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
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

class ApplicationWorkflowTest extends TestCase
{
    use RefreshDatabase;

    private User $employerUser;

    private User $candidateUser;

    private JobPosting $posting;

    private CandidateProfile $profile;

    protected function setUp(): void
    {
        parent::setUp();

        $employer = Employer::factory()->verified()->create(['company_name' => 'Bright Path BPO']);
        $this->employerUser = $employer->user;
        $this->posting = JobPosting::factory()->open()->create(['employer_id' => $employer->id, 'title' => 'Data Encoder']);
        $this->profile = CandidateProfile::factory()
            ->needing(Accommodation::factory()->create(['name' => 'Remote work']))
            ->create(['headline' => 'Encoder', 'disability_type' => 'Low vision', 'show_disability' => false]);
        $this->candidateUser = $this->profile->user;
        $this->candidateUser->update(['name' => 'Maria Santos']);
    }

    private function application(ApplicationStatus $status = ApplicationStatus::Pending): Application
    {
        return Application::factory()->for($this->posting)->for($this->profile)->status($status)->create();
    }

    private function changeStatus(User $actor, Application $application, string $to): TestResponse
    {
        Sanctum::actingAs($actor);

        return $this->patchJson("/api/applications/{$application->id}/status", ['status' => $to]);
    }

    /** @return iterable<string, array{string, string, string, string}> [from, to, actor, notified party] */
    public static function allowedTransitions(): iterable
    {
        yield 'employer reviews' => ['pending', 'reviewed', 'employer', 'candidate'];
        yield 'candidate withdraws a pending one' => ['pending', 'withdrawn', 'candidate', 'employer'];
        yield 'candidate withdraws a reviewed one' => ['reviewed', 'withdrawn', 'candidate', 'employer'];
        yield 'employer rejects' => ['reviewed', 'rejected', 'employer', 'candidate'];
        yield 'employer hires' => ['reviewed', 'hired', 'employer', 'candidate'];
        yield 'candidate confirms the hire' => ['reviewed', 'hired', 'candidate', 'employer'];
    }

    #[DataProvider('allowedTransitions')]
    public function test_allowed_transitions_notify_the_other_party(string $from, string $to, string $actor, string $notified): void
    {
        $application = $this->application(ApplicationStatus::from($from));
        $users = ['employer' => $this->employerUser, 'candidate' => $this->candidateUser];

        $this->changeStatus($users[$actor], $application, $to)->assertOk()->assertJsonPath('status', $to);

        $this->assertSame($to, $application->fresh()->status->value);
        $notice = $users[$notified]->notifications()->sole();
        $this->assertSame('application_status_changed', $notice->type);
        $this->assertSame($to, $notice->data['status']);
        $this->assertSame("/{$notified}/applications/{$application->id}", $notice->data['url']);
        $this->assertSame(0, $users[$actor]->notifications()->count());
    }

    /** @return iterable<string, array{string, string, string}> [from, to, actor] */
    public static function refusedTransitions(): iterable
    {
        yield 'hire without review' => ['pending', 'hired', 'employer'];
        yield 'reject without review' => ['pending', 'rejected', 'employer'];
        yield 'rejected → hired' => ['rejected', 'hired', 'employer'];
        yield 'hired → rejected' => ['hired', 'rejected', 'employer'];
        yield 'withdrawn → reviewed' => ['withdrawn', 'reviewed', 'employer'];
        yield 'hired → withdrawn' => ['hired', 'withdrawn', 'candidate'];
        yield 'reviewed → reviewed' => ['reviewed', 'reviewed', 'employer'];
        yield 'candidate rejects' => ['reviewed', 'rejected', 'candidate'];
        yield 'candidate marks reviewed' => ['pending', 'reviewed', 'candidate'];
        yield 'employer withdraws' => ['pending', 'withdrawn', 'employer'];
    }

    #[DataProvider('refusedTransitions')]
    public function test_refused_transitions(string $from, string $to, string $actor): void
    {
        $application = $this->application(ApplicationStatus::from($from));

        $this->changeStatus($actor === 'employer' ? $this->employerUser : $this->candidateUser, $application, $to)
            ->assertUnprocessable()
            ->assertJsonPath('error.code', 'INVALID_STATUS_TRANSITION');

        $this->assertSame($from, $application->fresh()->status->value);
        $this->assertDatabaseCount('notifications', 0);
    }

    public function test_status_must_be_a_target_status(): void
    {
        $this->changeStatus($this->employerUser, $this->application(), 'pending')
            ->assertUnprocessable()
            ->assertJsonPath('error.code', 'VALIDATION_FAILED')
            ->assertJsonValidationErrors(['status']);
    }

    public function test_hiring_records_who_and_when_and_when_feedback_opens(): void
    {
        // 1 Oct 23:30 Manila → feedback opens on 31 Oct (calendar day 30, Asia/Manila).
        Carbon::setTestNow(Carbon::parse('2026-10-01 23:30', 'Asia/Manila'));
        $byEmployer = $this->application(ApplicationStatus::Reviewed);
        $this->changeStatus($this->employerUser, $byEmployer, 'hired')
            ->assertOk()
            ->assertJsonPath('hire_confirmed_by', 'employer')
            ->assertJsonPath('feedback_opens_on', '2026-10-31');
        $this->assertSame('2026-10-01 23:30:00', $byEmployer->fresh()->hired_at->timezone('Asia/Manila')->toDateTimeString());
        $this->assertStringContainsString('October 31, 2026', $this->candidateUser->notifications()->sole()->data['message']);

        // 16:00 UTC is already 2 Oct 00:00 in Manila → 1 Nov.
        Carbon::setTestNow(Carbon::parse('2026-10-01 16:00', 'UTC'));
        $other = Application::factory()->for(JobPosting::factory()->open())->for($this->profile)->status(ApplicationStatus::Reviewed)->create();
        $this->changeStatus($this->candidateUser, $other, 'hired')
            ->assertOk()
            ->assertJsonPath('hire_confirmed_by', 'candidate')
            ->assertJsonPath('feedback_opens_on', '2026-11-01');
    }

    public function test_employer_opening_a_pending_application_marks_it_reviewed_once(): void
    {
        $application = $this->application();

        // The candidate looking at it changes nothing.
        Sanctum::actingAs($this->candidateUser);
        $this->getJson("/api/applications/{$application->id}")->assertOk()->assertJsonPath('status', 'pending');

        Sanctum::actingAs($this->employerUser);
        $this->getJson("/api/applications/{$application->id}")->assertOk()->assertJsonPath('status', 'reviewed');
        $this->getJson("/api/applications/{$application->id}")->assertOk()->assertJsonPath('status', 'reviewed');

        $this->assertSame(1, $this->candidateUser->notifications()->count());
        $this->assertSame('Bright Path BPO is reviewing your application for Data Encoder.', $this->candidateUser->notifications()->sole()->data['message']);
    }

    public function test_only_the_two_parties_see_or_change_an_application(): void
    {
        $application = $this->application();
        $strangers = [
            Employer::factory()->create()->user,
            CandidateProfile::factory()->create()->user,
            User::factory()->admin()->create(),
        ];

        foreach ($strangers as $stranger) {
            Sanctum::actingAs($stranger);
            $this->getJson("/api/applications/{$application->id}")->assertForbidden()->assertJsonPath('error.code', 'FORBIDDEN');
            $this->patchJson("/api/applications/{$application->id}/status", ['status' => 'reviewed'])->assertForbidden();
        }

        $this->assertSame('pending', $application->fresh()->status->value);
    }

    public function test_employer_sees_the_candidate_needs_but_not_a_hidden_disability(): void
    {
        $application = $this->application(ApplicationStatus::Reviewed);
        Sanctum::actingAs($this->employerUser);

        $this->getJson("/api/applications/{$application->id}")
            ->assertOk()
            ->assertJsonPath('candidate.name', 'Maria Santos')
            ->assertJsonPath('candidate.headline', 'Encoder')
            ->assertJsonPath('candidate.accommodations.0.name', 'Remote work')
            ->assertJsonPath('candidate.disability_type', null)
            ->assertJsonPath('candidate.resume_url', null);

        $this->profile->forceFill(['show_disability' => true, 'resume_path' => 'resumes/cv.pdf'])->save();
        $response = $this->getJson("/api/applications/{$application->id}")->assertJsonPath('candidate.disability_type', 'Low vision');
        $this->assertStringStartsWith("http://localhost:8080/api/resumes/{$this->profile->id}?expires=", $response->json('candidate.resume_url'));
    }

    public function test_lists_show_only_own_applications_with_filters(): void
    {
        $mine = $this->application();
        $hired = Application::factory()->for(JobPosting::factory()->open()->create(['employer_id' => $this->posting->employer_id]))->for($this->profile)->hired()->create();
        $otherCandidate = Application::factory()->for($this->posting)->for(CandidateProfile::factory())->create();
        $elsewhere = Application::factory()->create();

        Sanctum::actingAs($this->candidateUser);
        $response = $this->getJson('/api/applications')->assertOk()->assertJsonPath('meta.total', 2);
        $this->assertEqualsCanonicalizing([$mine->id, $hired->id], array_column($response->json('data'), 'id'));
        $response->assertJsonMissingPath('data.0.candidate');
        $this->getJson('/api/applications?status=hired')->assertJsonPath('meta.total', 1)->assertJsonPath('data.0.id', $hired->id);

        Sanctum::actingAs($this->employerUser);
        $response = $this->getJson('/api/applications')->assertOk()->assertJsonPath('meta.total', 3);
        $this->assertNotContains($elsewhere->id, array_column($response->json('data'), 'id'));
        $this->getJson("/api/applications?job_posting_id={$this->posting->id}")->assertJsonPath('meta.total', 2);
        $this->assertNotNull($this->getJson("/api/applications?job_posting_id={$this->posting->id}")->json('data.0.candidate.name'));

        // Deleting a posting keeps its applications.
        $this->posting->delete();
        $this->getJson("/api/applications?job_posting_id={$this->posting->id}")->assertJsonPath('meta.total', 2);
        $this->getJson("/api/applications/{$otherCandidate->id}")->assertOk()->assertJsonPath('job_posting.title', 'Data Encoder');
    }

    public function test_list_filters_are_validated(): void
    {
        Sanctum::actingAs($this->candidateUser);

        $this->getJson('/api/applications?status=interviewing')->assertUnprocessable()->assertJsonValidationErrors(['status']);
        Sanctum::actingAs(User::factory()->admin()->create());
        $this->getJson('/api/applications')->assertForbidden();
    }
}
