<?php

namespace Tests\Feature\SavedJobs;

use App\Enums\JobPostingStatus;
use App\Models\Accommodation;
use App\Models\CandidateProfile;
use App\Models\JobPosting;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/** M12: candidates bookmark visible postings and find them under Saved jobs. */
class SavedJobTest extends TestCase
{
    use RefreshDatabase;

    private User $candidate;

    private JobPosting $posting;

    protected function setUp(): void
    {
        parent::setUp();

        $this->candidate = User::factory()->candidate()->create();
        $this->posting = JobPosting::factory()->open()->create(['title' => 'Data Encoder']);
    }

    public function test_a_candidate_saves_a_posting_once(): void
    {
        Sanctum::actingAs($this->candidate);
        $url = "/api/candidate/saved-jobs/{$this->posting->id}";

        $this->postJson($url)->assertCreated()->assertJsonPath('id', $this->posting->id)->assertJsonPath('saved', true);
        $this->postJson($url)->assertOk()->assertJsonPath('saved', true);

        $this->assertSame(1, DB::table('saved_jobs')->count());
        $this->assertSame([$this->posting->id], CandidateProfile::for($this->candidate)->savedJobs()->pluck('job_postings.id')->all());
    }

    public function test_search_results_say_which_postings_the_candidate_saved(): void
    {
        $other = JobPosting::factory()->open()->create(['title' => 'Chat Support']);
        CandidateProfile::for($this->candidate)->savedJobs()->attach($this->posting->id);
        CandidateProfile::for(User::factory()->candidate()->create())->savedJobs()->attach($other->id);

        Sanctum::actingAs($this->candidate);
        $saved = collect($this->getJson('/api/job-postings')->assertOk()->json('data'))->pluck('saved', 'id')->all();

        $this->assertSame(true, $saved[$this->posting->id]);
        $this->assertSame(false, $saved[$other->id]);
    }

    public function test_guests_and_employers_get_no_saved_flag_in_search(): void
    {
        $this->getJson('/api/job-postings')->assertOk()->assertJsonMissingPath('data.0.saved');

        Sanctum::actingAs(User::factory()->employer()->create());
        $this->getJson('/api/job-postings')->assertOk()->assertJsonMissingPath('data.0.saved');
    }

    public function test_the_list_shows_own_visible_saved_postings_newest_saved_first(): void
    {
        $older = JobPosting::factory()->open()->create(['title' => 'Chat Support']);
        $closed = JobPosting::factory()->open()->create();
        $deleted = JobPosting::factory()->open()->create();
        $notMine = JobPosting::factory()->open()->create();

        $profile = CandidateProfile::for($this->candidate);
        $this->travel(-3)->days();
        $profile->savedJobs()->attach([$older->id, $closed->id, $deleted->id]);
        $this->travelBack();
        $profile->savedJobs()->attach($this->posting->id);
        CandidateProfile::for(User::factory()->candidate()->create())->savedJobs()->attach($notMine->id);

        $closed->forceFill(['status' => JobPostingStatus::Closed])->save();
        $deleted->delete();

        Sanctum::actingAs($this->candidate);
        $this->getJson('/api/candidate/saved-jobs')
            ->assertOk()
            ->assertJsonPath('meta.total', 2)
            ->assertJsonPath('meta.per_page', 12)
            ->assertJsonPath('data.0.title', 'Data Encoder')
            ->assertJsonPath('data.1.title', 'Chat Support')
            ->assertJsonPath('data.0.saved', true)
            ->assertJsonMissingPath('data.0.pivot');

        // The bookmark on the closed posting stays and shows again when it reopens.
        $closed->forceFill(['status' => JobPostingStatus::Open])->save();
        $this->getJson('/api/candidate/saved-jobs')->assertJsonPath('meta.total', 3);
    }

    public function test_saved_postings_carry_the_match_for_candidates_with_needs(): void
    {
        $ramp = Accommodation::factory()->create(['name' => 'Wheelchair-accessible entrance']);
        $interpreter = Accommodation::factory()->create(['name' => 'Sign language interpreter']);
        $profile = CandidateProfile::factory()->needing($ramp, $interpreter)->create();
        $offersRamp = JobPosting::factory()->open()->withAccommodations($ramp)->create();
        $profile->savedJobs()->attach($offersRamp->id);

        Sanctum::actingAs($profile->user);
        $this->getJson('/api/candidate/saved-jobs')
            ->assertOk()
            ->assertJsonPath('data.0.match.met', 1)
            ->assertJsonPath('data.0.match.total', 2)
            ->assertJsonPath('data.0.match.missing.0.name', 'Sign language interpreter');
    }

    public function test_removing_is_idempotent_and_works_for_postings_no_longer_visible(): void
    {
        $profile = CandidateProfile::for($this->candidate);
        $profile->savedJobs()->attach($this->posting->id);
        $this->posting->delete();

        Sanctum::actingAs($this->candidate);
        $this->deleteJson("/api/candidate/saved-jobs/{$this->posting->id}")->assertNoContent();
        $this->deleteJson("/api/candidate/saved-jobs/{$this->posting->id}")->assertNoContent();
        $this->deleteJson('/api/candidate/saved-jobs/999999')->assertNoContent();

        $this->assertSame(0, DB::table('saved_jobs')->count());
    }

    public function test_a_candidate_cannot_remove_another_candidates_bookmark(): void
    {
        $other = CandidateProfile::for(User::factory()->candidate()->create());
        $other->savedJobs()->attach($this->posting->id);

        Sanctum::actingAs($this->candidate);
        $this->deleteJson("/api/candidate/saved-jobs/{$this->posting->id}")->assertNoContent();

        $this->assertSame(1, $other->savedJobs()->count());
    }

    public function test_postings_that_are_not_visible_cannot_be_saved(): void
    {
        $draft = JobPosting::factory()->create();
        $pending = JobPosting::factory()->open()->unverifiedEmployer()->create();
        $closed = JobPosting::factory()->closed()->create();
        $deleted = JobPosting::factory()->open()->create();
        $deleted->delete();

        Sanctum::actingAs($this->candidate);
        foreach ([$draft, $pending, $closed, $deleted] as $posting) {
            $this->postJson("/api/candidate/saved-jobs/{$posting->id}")->assertNotFound()->assertJsonPath('error.code', 'NOT_FOUND');
        }
        $this->postJson('/api/candidate/saved-jobs/999999')->assertNotFound();

        $this->assertSame(0, DB::table('saved_jobs')->count());
    }

    public function test_job_details_tell_a_candidate_whether_the_posting_is_saved(): void
    {
        Sanctum::actingAs($this->candidate);
        $url = "/api/job-postings/{$this->posting->id}";

        $this->getJson($url)->assertOk()->assertJsonPath('saved', false);
        CandidateProfile::for($this->candidate)->savedJobs()->attach($this->posting->id);
        $this->getJson($url)->assertJsonPath('saved', true);

        // Guests, employers and admins get no `saved` field (search results: see below).
        $this->app['auth']->forgetGuards();
        $this->getJson($url)->assertOk()->assertJsonMissingPath('saved');
        Sanctum::actingAs(User::factory()->admin()->create());
        $this->getJson($url)->assertJsonMissingPath('saved');
    }

    public function test_only_candidates_have_saved_jobs(): void
    {
        $this->getJson('/api/candidate/saved-jobs')->assertUnauthorized();
        $this->postJson("/api/candidate/saved-jobs/{$this->posting->id}")->assertUnauthorized();

        foreach ([User::factory()->employer()->create(), User::factory()->admin()->create()] as $user) {
            Sanctum::actingAs($user);
            $this->getJson('/api/candidate/saved-jobs')->assertForbidden();
            $this->postJson("/api/candidate/saved-jobs/{$this->posting->id}")->assertForbidden();
            $this->deleteJson("/api/candidate/saved-jobs/{$this->posting->id}")->assertForbidden();
        }
    }
}
