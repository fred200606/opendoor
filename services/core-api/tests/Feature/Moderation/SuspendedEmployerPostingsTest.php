<?php

namespace Tests\Feature\Moderation;

use App\Models\Application;
use App\Models\CandidateProfile;
use App\Models\JobPosting;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/** M10: a suspended employer's postings are hidden until the suspension is lifted (no data changes). */
class SuspendedEmployerPostingsTest extends TestCase
{
    use RefreshDatabase;

    private const KEY = 'test-service-key';

    private JobPosting $posting;

    private User $candidate;

    protected function setUp(): void
    {
        parent::setUp();

        config(['services.insights.key' => self::KEY]);
        $this->posting = JobPosting::factory()->open()->create(['title' => 'Data Encoder']);
        $this->candidate = User::factory()->candidate()->create();
    }

    private function suspendEmployer(bool $suspended = true): void
    {
        Sanctum::actingAs(User::factory()->admin()->create());
        $this->patchJson("/api/admin/users/{$this->posting->employer->user_id}/suspend", ['suspended' => $suspended])->assertOk();
        $this->app['auth']->forgetGuards();
    }

    public function test_search_details_and_the_employer_page_hide_the_postings(): void
    {
        $id = $this->posting->id;
        $employerId = $this->posting->employer_id;
        $this->suspendEmployer();

        $this->getJson('/api/job-postings')->assertOk()->assertJsonPath('meta.total', 0);
        $this->getJson("/api/job-postings/{$id}")->assertNotFound()->assertJsonPath('error.code', 'NOT_FOUND');
        $this->getJson("/api/employers/{$employerId}")->assertOk()->assertJsonPath('open_postings', []);

        Sanctum::actingAs($this->candidate);
        $this->getJson("/api/job-postings/{$id}")->assertNotFound();

        // Admins still see it (to review the account).
        Sanctum::actingAs(User::factory()->admin()->create());
        $this->getJson("/api/job-postings/{$id}")->assertOk();
    }

    public function test_candidates_cannot_apply_save_or_report_and_saved_lists_skip_it(): void
    {
        $closed = JobPosting::factory()->closed()->create(['employer_id' => $this->posting->employer_id]);
        CandidateProfile::for($this->candidate)->savedJobs()->attach($this->posting->id);
        $this->suspendEmployer();

        Sanctum::actingAs($this->candidate);
        $this->postJson("/api/job-postings/{$this->posting->id}/applications")->assertNotFound();
        // A closed posting of a suspended employer is 404 too, not POSTING_CLOSED.
        $this->postJson("/api/job-postings/{$closed->id}/applications")->assertNotFound();
        $this->postJson("/api/candidate/saved-jobs/{$this->posting->id}")->assertNotFound();
        $this->postJson("/api/job-postings/{$this->posting->id}/reports", ['reason' => 'Gone?'])->assertNotFound();
        $this->getJson('/api/candidate/saved-jobs')->assertOk()->assertJsonPath('meta.total', 0);

        // The bookmark is kept and can still be removed.
        $this->assertSame(1, CandidateProfile::for($this->candidate)->savedJobs()->count());
        $this->deleteJson("/api/candidate/saved-jobs/{$this->posting->id}")->assertNoContent();
    }

    public function test_insights_summary_is_404(): void
    {
        $this->suspendEmployer();

        $this->getJson("/internal/job-postings/{$this->posting->id}/summary", ['X-Service-Key' => self::KEY])->assertNotFound();
    }

    public function test_candidates_keep_their_existing_applications(): void
    {
        $application = Application::factory()->create([
            'job_posting_id' => $this->posting->id,
            'candidate_profile_id' => CandidateProfile::for($this->candidate)->id,
        ]);
        $this->suspendEmployer();

        Sanctum::actingAs($this->candidate);
        $this->getJson('/api/applications')->assertOk()->assertJsonPath('data.0.id', $application->id);
        $this->getJson("/api/applications/{$application->id}")->assertOk()->assertJsonPath('job_posting.title', 'Data Encoder');
    }

    public function test_lifting_the_suspension_shows_the_postings_again(): void
    {
        $this->suspendEmployer();
        $this->getJson('/api/job-postings')->assertJsonPath('meta.total', 0);

        $this->suspendEmployer(false);
        $this->getJson('/api/job-postings')->assertJsonPath('meta.total', 1);
        $this->getJson("/api/job-postings/{$this->posting->id}")->assertOk()->assertJsonPath('status', 'open');
    }
}
