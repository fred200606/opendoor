<?php

namespace Tests\Feature\Search;

use App\Models\Accommodation;
use App\Models\CandidateProfile;
use App\Models\Category;
use App\Models\Employer;
use App\Models\JobPosting;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Testing\TestResponse;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class JobSearchTest extends TestCase
{
    use RefreshDatabase;

    private Accommodation $ramp;

    private Accommodation $interpreter;

    private Accommodation $remote;

    private Accommodation $parking;

    protected function setUp(): void
    {
        parent::setUp();

        $this->ramp = Accommodation::factory()->create(['name' => 'Wheelchair-accessible entrance']);
        $this->interpreter = Accommodation::factory()->create(['name' => 'Sign language interpreter']);
        $this->remote = Accommodation::factory()->create(['name' => 'Remote work']);
        $this->parking = Accommodation::factory()->create(['name' => 'Accessible parking']);
    }

    /** Open posting created $daysAgo days ago. */
    private function posting(string $title, array $accommodations = [], int $daysAgo = 0, array $attributes = []): JobPosting
    {
        return JobPosting::factory()->open()->withAccommodations(...$accommodations)->create([
            'title' => $title,
            'created_at' => now()->subDays($daysAgo),
            ...$attributes,
        ]);
    }

    private function candidateNeeding(Accommodation ...$needs): User
    {
        $profile = CandidateProfile::factory()->needing(...$needs)->create();

        return $profile->user;
    }

    /** @return list<string> */
    private function titles(TestResponse $response): array
    {
        return array_column($response->json('data'), 'title');
    }

    public function test_guests_see_only_open_approved_postings_newest_first(): void
    {
        $this->posting('Older', daysAgo: 3);
        $this->posting('Newer', daysAgo: 1);
        JobPosting::factory()->create(['title' => 'Draft']);
        JobPosting::factory()->pending()->create(['title' => 'Pending']);
        JobPosting::factory()->closed()->create(['title' => 'Closed']);
        $this->posting('Deleted')->delete();

        $response = $this->getJson('/api/job-postings')
            ->assertOk()
            ->assertJsonPath('meta.total', 2)
            ->assertJsonPath('meta.per_page', 12)
            ->assertJsonPath('meta.match_mode', false)
            ->assertJsonPath('data.0.match', null);

        $this->assertSame(['Newer', 'Older'], $this->titles($response));
    }

    public function test_results_are_paginated_by_12(): void
    {
        foreach (range(1, 13) as $day) {
            $this->posting("Job {$day}", daysAgo: $day);
        }

        // Page links point at the gateway (PUBLIC_API_URL), not at Core's own host.
        $this->getJson('http://127.0.0.1:8001/api/job-postings?sort=newest')
            ->assertJsonPath('meta.path', 'http://localhost:8080/api/job-postings')
            ->assertJsonPath('links.next', 'http://localhost:8080/api/job-postings?sort=newest&page=2');

        $this->getJson('/api/job-postings?page=2')
            ->assertOk()
            ->assertJsonPath('meta.current_page', 2)
            ->assertJsonPath('meta.last_page', 2)
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.title', 'Job 13');
    }

    public function test_keyword_searches_title_description_and_company_name(): void
    {
        $this->posting('Data Encoder');
        $this->posting('Clerk', attributes: ['description' => 'Encode payroll DATA every week.']);
        $this->posting('Tester', attributes: ['employer_id' => Employer::factory()->create(['company_name' => 'Datos Inc.'])->id]);
        $this->posting('Cashier');

        $this->assertEqualsCanonicalizing(['Data Encoder', 'Clerk'], $this->titles($this->getJson('/api/job-postings?q=data')));
        $this->assertSame(['Tester'], $this->titles($this->getJson('/api/job-postings?q=datos')));
    }

    public function test_like_wildcards_in_the_keyword_are_literal(): void
    {
        $this->posting('50% commission sales agent');
        $this->posting('500 pesos daily');
        $this->posting('Data_entry clerk');
        $this->posting('Dataxentry clerk');

        $this->assertSame(['50% commission sales agent'], $this->titles($this->getJson('/api/job-postings?q='.urlencode('50%'))));
        $this->assertSame(['Data_entry clerk'], $this->titles($this->getJson('/api/job-postings?q=Data_entry')));
    }

    public function test_category_filter(): void
    {
        $it = Category::factory()->create();
        $this->posting('Web developer', attributes: ['category_id' => $it->id]);
        $this->posting('Cashier');

        $this->assertSame(['Web developer'], $this->titles($this->getJson("/api/job-postings?category={$it->id}")));
    }

    public function test_accommodation_filter_requires_every_selected_accommodation(): void
    {
        $this->posting('Both', [$this->ramp, $this->interpreter, $this->remote]);
        $this->posting('Ramp only', [$this->ramp]);
        $this->posting('None');

        $query = "accommodations[]={$this->ramp->id}&accommodations[]={$this->interpreter->id}&accommodations[]={$this->ramp->id}";
        $this->assertSame(['Both'], $this->titles($this->getJson("/api/job-postings?{$query}")));
    }

    public function test_match_mode_ranks_full_matches_first_then_by_needs_met(): void
    {
        $this->posting('One of three', [$this->ramp], daysAgo: 1);
        $this->posting('None of three', [$this->parking], daysAgo: 0);
        $this->posting('All three', [$this->ramp, $this->interpreter, $this->remote, $this->parking], daysAgo: 5);
        $this->posting('Two of three, older', [$this->ramp, $this->remote], daysAgo: 4);
        $this->posting('Two of three, newer', [$this->interpreter, $this->remote], daysAgo: 2);
        Sanctum::actingAs($this->candidateNeeding($this->ramp, $this->interpreter, $this->remote));

        $response = $this->getJson('/api/job-postings?match=1')->assertOk()->assertJsonPath('meta.match_mode', true);

        $this->assertSame(['All three', 'Two of three, newer', 'Two of three, older', 'One of three', 'None of three'], $this->titles($response));
        $response
            ->assertJsonPath('data.0.match', ['met' => 3, 'total' => 3, 'missing' => []])
            ->assertJsonPath('data.3.match.met', 1)
            ->assertJsonPath('data.3.match.missing', [
                ['id' => $this->interpreter->id, 'name' => 'Sign language interpreter'],
                ['id' => $this->remote->id, 'name' => 'Remote work'],
            ]);
    }

    public function test_match_mode_uses_the_requested_sort_within_the_same_number_of_needs_met(): void
    {
        $this->posting('Closes later', [$this->ramp], attributes: ['closes_at' => now()->addDays(20)->toDateString()]);
        $this->posting('Closes sooner', [$this->ramp], attributes: ['closes_at' => now()->addDays(5)->toDateString()]);
        $this->posting('Closes first, no match', attributes: ['closes_at' => now()->addDay()->toDateString()]);
        Sanctum::actingAs($this->candidateNeeding($this->ramp));

        $this->assertSame(
            ['Closes sooner', 'Closes later', 'Closes first, no match'],
            $this->titles($this->getJson('/api/job-postings?match=1&sort=closing')),
        );
    }

    public function test_without_match_mode_candidates_still_see_their_match_but_the_order_is_unchanged(): void
    {
        $this->posting('Full match, older', [$this->ramp], daysAgo: 3);
        $this->posting('No match, newer', daysAgo: 1);
        Sanctum::actingAs($this->candidateNeeding($this->ramp));

        $response = $this->getJson('/api/job-postings?match=0')->assertOk()->assertJsonPath('meta.match_mode', false);

        $this->assertSame(['No match, newer', 'Full match, older'], $this->titles($response));
        $response->assertJsonPath('data.0.match.met', 0)->assertJsonPath('data.1.match.met', 1);
    }

    public function test_no_match_mode_without_saved_needs_or_for_other_roles(): void
    {
        $this->posting('Job', [$this->ramp]);

        // A disability type alone is never used for matching.
        $candidate = CandidateProfile::factory()->create(['disability_type' => 'Mobility', 'show_disability' => true])->user;
        foreach ([$candidate, User::factory()->candidate()->create(), User::factory()->employer()->create(), User::factory()->admin()->create()] as $user) {
            Sanctum::actingAs($user);
            $this->getJson('/api/job-postings?match=1')
                ->assertOk()
                ->assertJsonPath('meta.match_mode', false)
                ->assertJsonPath('data.0.match', null);
        }

        $this->app['auth']->forgetGuards();
        $this->getJson('/api/job-postings?match=1')->assertOk()->assertJsonPath('meta.match_mode', false);
    }

    public function test_job_details_include_the_match_for_candidates_with_needs(): void
    {
        $posting = $this->posting('Data Encoder', [$this->ramp, $this->parking]);

        $this->getJson("/api/job-postings/{$posting->id}")->assertOk()->assertJsonPath('match', null);

        Sanctum::actingAs($this->candidateNeeding($this->ramp, $this->interpreter));
        $this->getJson("/api/job-postings/{$posting->id}")
            ->assertOk()
            ->assertJsonPath('match', [
                'met' => 1,
                'total' => 2,
                'missing' => [['id' => $this->interpreter->id, 'name' => 'Sign language interpreter']],
            ]);
    }

    public function test_search_parameters_are_validated(): void
    {
        $this->getJson('/api/job-postings?sort=cheapest&category=abc&accommodations[]=x&page=0')
            ->assertUnprocessable()
            ->assertJsonPath('error.code', 'VALIDATION_FAILED')
            ->assertJsonValidationErrors(['sort', 'category', 'accommodations.0', 'page']);
    }
}
