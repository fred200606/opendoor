<?php

namespace Tests\Feature\Internal;

use App\Models\Accommodation;
use App\Models\Application;
use App\Models\Employer;
use App\Models\Feedback;
use App\Models\JobPosting;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

/** Core → Insights: GET /internal/job-postings/{id}/summary behind the service key (T16). */
class PostingSummaryTest extends TestCase
{
    use RefreshDatabase;

    private const KEY = 'test-service-key-0123456789abcdef';

    private Employer $employer;

    private Accommodation $ramp;

    private Accommodation $interpreter;

    private JobPosting $posting;

    protected function setUp(): void
    {
        parent::setUp();

        config(['services.insights.key' => self::KEY]);

        $this->employer = Employer::factory()->verified()->create();
        $this->ramp = Accommodation::factory()->create(['name' => 'Wheelchair-accessible entrance', 'group' => 'physical_access']);
        $this->interpreter = Accommodation::factory()->create(['name' => 'Sign language interpreter', 'group' => 'communication']);
        $this->posting = JobPosting::factory()->open()->withAccommodations($this->ramp, $this->interpreter)->create([
            'employer_id' => $this->employer->id,
            'address' => '123 Quezon Ave.',
            'location_psgc' => '1307404000',
            'location_label' => 'Quezon City, Metro Manila',
        ]);
    }

    /** @param  array<string, string>  $headers */
    private function summary(?JobPosting $posting = null, array $headers = ['X-Service-Key' => self::KEY])
    {
        return $this->getJson('/internal/job-postings/'.($posting ?? $this->posting)->id.'/summary', $headers);
    }

    public function test_returns_the_summary_with_an_unpublished_score(): void
    {
        $this->summary()
            ->assertOk()
            ->assertExactJson([
                'id' => $this->posting->id,
                'address' => '123 Quezon Ave.',
                'psgc_code' => '1307404000',
                'location_label' => 'Quezon City, Metro Manila',
                'accommodations' => [
                    ['id' => $this->interpreter->id, 'name' => 'Sign language interpreter', 'group' => 'communication'],
                    ['id' => $this->ramp->id, 'name' => 'Wheelchair-accessible entrance', 'group' => 'physical_access'],
                ],
                'trust_score' => ['published' => false, 'score' => null, 'based_on' => 0, 'breakdown' => []],
            ]);
    }

    public function test_a_published_score_comes_with_its_breakdown(): void
    {
        foreach (['delivered', 'delivered', 'partial'] as $rating) {
            $application = Application::factory()->for($this->posting)->hired(now()->subDays(40)->toDateTimeString())->create();
            Feedback::submit($application, [$this->ramp->id => 'delivered', $this->interpreter->id => $rating]);
        }

        // 6 items: 5 delivered + 1 partial = 5.5 / 6 → 91.67 → 92.
        $this->summary()
            ->assertOk()
            ->assertJsonPath('trust_score.published', true)
            ->assertJsonPath('trust_score.score', 92)
            ->assertJsonPath('trust_score.based_on', 3)
            ->assertJsonPath('trust_score.breakdown', [
                ['accommodation_id' => $this->interpreter->id, 'name' => 'Sign language interpreter', 'delivered' => 2, 'partial' => 1, 'not_delivered' => 0, 'of' => 3],
                ['accommodation_id' => $this->ramp->id, 'name' => 'Wheelchair-accessible entrance', 'delivered' => 3, 'partial' => 0, 'not_delivered' => 0, 'of' => 3],
            ]);
    }

    public function test_t16_a_call_without_the_service_key_is_refused(): void
    {
        $this->summary(headers: [])
            ->assertUnauthorized()
            ->assertJsonPath('error.code', 'UNAUTHENTICATED')
            ->assertJsonStructure(['error' => ['code', 'message', 'request_id']]);
    }

    public function test_a_wrong_service_key_is_refused(): void
    {
        $this->summary(headers: ['X-Service-Key' => 'wrong'])->assertUnauthorized()->assertJsonPath('error.code', 'UNAUTHENTICATED');
    }

    public function test_an_unset_service_key_refuses_every_call(): void
    {
        config(['services.insights.key' => '']);

        $this->summary(headers: ['X-Service-Key' => ''])->assertUnauthorized();
        $this->summary()->assertUnauthorized();
    }

    public function test_a_user_token_is_not_a_service_key(): void
    {
        Sanctum::actingAs(User::factory()->admin()->create());

        $this->summary(headers: [])->assertUnauthorized();
    }

    public function test_the_key_is_checked_before_the_posting_is_looked_up(): void
    {
        $this->getJson('/internal/job-postings/999999/summary')->assertUnauthorized();
    }

    /** @return array<string, array{string}> */
    public static function hiddenPostings(): array
    {
        return ['draft' => ['draft'], 'unverified employer' => ['unverified'], 'closed' => ['closed'], 'deleted' => ['deleted']];
    }

    #[DataProvider('hiddenPostings')]
    public function test_postings_nobody_may_see_are_not_found(string $state): void
    {
        $posting = match ($state) {
            'draft' => JobPosting::factory()->create(['employer_id' => $this->employer->id]),
            'unverified' => JobPosting::factory()->open()->unverifiedEmployer()->create(),
            'closed' => JobPosting::factory()->closed()->create(['employer_id' => $this->employer->id]),
            'deleted' => tap(JobPosting::factory()->open()->create(['employer_id' => $this->employer->id]))->delete(),
        };

        $this->summary($posting)->assertNotFound()->assertJsonPath('error.code', 'NOT_FOUND');
    }

    public function test_an_unknown_posting_is_not_found(): void
    {
        $this->getJson('/internal/job-postings/999999/summary', ['X-Service-Key' => self::KEY])->assertNotFound();
    }

    public function test_the_gateway_style_api_prefix_does_not_reach_internal_routes(): void
    {
        $this->getJson('/api/internal/job-postings/'.$this->posting->id.'/summary', ['X-Service-Key' => self::KEY])->assertNotFound();
    }
}
