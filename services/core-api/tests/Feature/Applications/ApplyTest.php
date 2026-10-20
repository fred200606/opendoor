<?php

namespace Tests\Feature\Applications;

use App\Models\Application;
use App\Models\CandidateProfile;
use App\Models\Employer;
use App\Models\JobPosting;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Testing\TestResponse;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class ApplyTest extends TestCase
{
    use RefreshDatabase;

    private User $candidate;

    private JobPosting $posting;

    protected function setUp(): void
    {
        parent::setUp();

        $this->candidate = User::factory()->candidate()->create(['name' => 'Maria Santos']);
        CandidateProfile::factory()->for($this->candidate)->create();
        $employer = Employer::factory()->verified()->create(['company_name' => 'Bright Path BPO']);
        $this->posting = JobPosting::factory()->open()->create(['employer_id' => $employer->id, 'title' => 'Data Encoder']);
        Sanctum::actingAs($this->candidate);
    }

    private function apply(?JobPosting $posting = null, array $body = []): TestResponse
    {
        return $this->postJson('/api/job-postings/'.($posting ?? $this->posting)->id.'/applications', $body);
    }

    public function test_candidate_applies_and_the_employer_is_notified(): void
    {
        $this->apply(body: ['cover_note' => 'I have 3 years of encoding experience.', 'interview_request' => 'Captions during the online interview, please.'])
            ->assertCreated()
            ->assertJsonPath('job_posting_id', $this->posting->id)
            ->assertJsonPath('status', 'pending')
            ->assertJsonPath('cover_note', 'I have 3 years of encoding experience.')
            ->assertJsonPath('hired_at', null)
            ->assertJsonPath('feedback_opens_on', null)
            ->assertJsonPath('job_posting.title', 'Data Encoder')
            ->assertJsonMissingPath('candidate');

        $application = Application::sole();
        $this->assertSame($this->candidate->id, $application->candidateProfile->user_id);

        $notice = $this->posting->employer->user->notifications()->sole();
        $this->assertSame('application_received', $notice->type);
        $this->assertSame('Maria Santos applied for Data Encoder.', $notice->data['message']);
        $this->assertSame("/employer/applications/{$application->id}", $notice->data['url']);
        $this->assertSame(0, $this->candidate->notifications()->count());
    }

    public function test_job_details_tell_a_candidate_about_an_earlier_application(): void
    {
        $this->getJson("/api/job-postings/{$this->posting->id}")->assertOk()->assertJsonPath('my_application', null);

        $id = $this->apply()->json('id');
        $this->getJson("/api/job-postings/{$this->posting->id}")
            ->assertJsonPath('my_application.id', $id)
            ->assertJsonPath('my_application.status', 'pending');

        // Not part of the response for guests, employers or search results.
        $this->getJson('/api/job-postings')->assertJsonMissingPath('data.0.my_application');
        Sanctum::actingAs($this->posting->employer->user);
        $this->getJson("/api/job-postings/{$this->posting->id}")->assertJsonMissingPath('my_application');
        $this->app['auth']->forgetGuards();
        $this->getJson("/api/job-postings/{$this->posting->id}")->assertJsonMissingPath('my_application');
    }

    public function test_an_incomplete_profile_must_be_completed_first(): void
    {
        $this->candidate->candidateProfile->update(['skills' => ['Typing'], 'preferred_work_setups' => []]);

        $this->apply()
            ->assertUnprocessable()
            ->assertJsonPath('error.code', 'PROFILE_INCOMPLETE')
            ->assertJsonPath('error.message', 'Complete your profile before you apply: where you live, at least 3 skills, your education and your work preferences.');
        $this->assertSame(0, Application::count());

        // A brand-new candidate has no profile at all.
        Sanctum::actingAs(User::factory()->candidate()->create());
        $this->apply()->assertUnprocessable()->assertJsonPath('error.code', 'PROFILE_INCOMPLETE');
    }

    public function test_applying_twice_is_a_conflict(): void
    {
        $this->apply()->assertCreated();

        $this->apply()->assertStatus(409)->assertJsonPath('error.code', 'ALREADY_APPLIED');
        $this->assertSame(1, Application::count());
    }

    public function test_closed_postings_do_not_accept_applications(): void
    {
        $closed = JobPosting::factory()->closed()->create();
        $this->apply($closed)->assertUnprocessable()->assertJsonPath('error.code', 'POSTING_CLOSED');

        // Still open, but the closing date has passed (the nightly auto-close has not run yet).
        $expired = JobPosting::factory()->open()->create(['closes_at' => now()->subDay()->toDateString()]);
        $this->apply($expired)->assertUnprocessable()->assertJsonPath('error.code', 'POSTING_CLOSED');

        // The closing day itself still counts.
        $lastDay = JobPosting::factory()->open()->create(['closes_at' => now()->toDateString()]);
        $this->apply($lastDay)->assertCreated();
    }

    public function test_unpublished_or_deleted_postings_are_not_found(): void
    {
        $this->apply(JobPosting::factory()->create())->assertNotFound()->assertJsonPath('error.code', 'NOT_FOUND');
        $this->apply(JobPosting::factory()->open()->unverifiedEmployer()->create())->assertNotFound();

        $deleted = JobPosting::factory()->open()->create();
        $deleted->delete();
        $this->apply($deleted)->assertNotFound();
    }

    public function test_only_candidates_can_apply(): void
    {
        foreach ([User::factory()->employer()->create(), User::factory()->admin()->create()] as $user) {
            Sanctum::actingAs($user);
            $this->apply()->assertForbidden()->assertJsonPath('error.code', 'FORBIDDEN');
        }

        $this->app['auth']->forgetGuards();
        $this->apply()->assertUnauthorized();
        $this->assertSame(0, Application::count());
    }

    public function test_application_text_is_validated(): void
    {
        $this->apply(body: ['cover_note' => str_repeat('a', 2001), 'interview_request' => str_repeat('b', 1001)])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['cover_note', 'interview_request']);
    }

    public function test_employer_posting_list_counts_applicants(): void
    {
        $this->apply()->assertCreated();
        Application::factory()->for($this->posting)->for(CandidateProfile::factory())->create();

        Sanctum::actingAs($this->posting->employer->user);
        $this->getJson('/api/employer/job-postings')->assertOk()->assertJsonPath('data.0.applicants_count', 2);
    }
}
