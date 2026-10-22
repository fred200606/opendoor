<?php

namespace Tests\Feature\Feedback;

use App\Models\Accommodation;
use App\Models\Application;
use App\Models\Employer;
use App\Models\Feedback;
use App\Models\JobPosting;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/** M7: trust score math, publish threshold, hidden responses and the public breakdown. */
class TrustScoreTest extends TestCase
{
    use RefreshDatabase;

    private Employer $employer;

    private Accommodation $interpreter;

    private Accommodation $ramp;

    private JobPosting $posting;

    protected function setUp(): void
    {
        parent::setUp();

        $this->employer = Employer::factory()->verified()->create();
        $this->interpreter = Accommodation::factory()->create(['name' => 'Sign language interpreter']);
        $this->ramp = Accommodation::factory()->create(['name' => 'Wheelchair-accessible entrance']);
        $this->posting = JobPosting::factory()->open()->withAccommodations($this->interpreter, $this->ramp)
            ->create(['employer_id' => $this->employer->id]);
    }

    /** @param  array<int, string>  $ratings  accommodation_id => rating */
    private function respond(array $ratings, ?JobPosting $posting = null): Feedback
    {
        $application = Application::factory()->for($posting ?? $this->posting)->contacted(now()->subDays(40)->toDateTimeString())->create();

        return Feedback::submit($application, $ratings);
    }

    /** One response rating the interpreter and the ramp. */
    private function respondBoth(string $interpreter, string $ramp): Feedback
    {
        return $this->respond([$this->interpreter->id => $interpreter, $this->ramp->id => $ramp]);
    }

    public function test_the_score_is_hidden_until_three_responses(): void
    {
        $this->respondBoth('delivered', 'delivered');
        $this->respondBoth('delivered', 'not_delivered');

        $this->getJson("/api/employers/{$this->employer->id}/trust-score")
            ->assertOk()
            ->assertExactJson(['published' => false, 'score' => null, 'based_on' => 2, 'breakdown' => []]);
        $this->assertSame(75, $this->employer->fresh()->trust_score, 'Stored even before it is published');
        $this->getJson("/api/employers/{$this->employer->id}")->assertJsonPath('trust_score', ['published' => false, 'score' => null, 'based_on' => 2]);
    }

    public function test_three_responses_publish_the_score_and_the_breakdown(): void
    {
        // Points: interpreter 1 + 0.5 + 0 = 1.5, ramp 1 + 1 + 0.5 = 2.5 → 4 of 6 → 66.67 → 67.
        $this->respondBoth('delivered', 'delivered');
        $this->respondBoth('partial', 'delivered');
        $this->respondBoth('not_delivered', 'partial');

        $this->getJson("/api/employers/{$this->employer->id}/trust-score")
            ->assertOk()
            ->assertExactJson([
                'published' => true,
                'score' => 67,
                'based_on' => 3,
                'breakdown' => [
                    ['accommodation_id' => $this->interpreter->id, 'name' => 'Sign language interpreter', 'delivered' => 1, 'partial' => 1, 'not_delivered' => 1, 'of' => 3],
                    ['accommodation_id' => $this->ramp->id, 'name' => 'Wheelchair-accessible entrance', 'delivered' => 2, 'partial' => 1, 'not_delivered' => 0, 'of' => 3],
                ],
            ]);

        $this->getJson("/api/employers/{$this->employer->id}")->assertJsonPath('trust_score', ['published' => true, 'score' => 67, 'based_on' => 3]);
        $this->getJson("/api/job-postings/{$this->posting->id}")->assertJsonPath('trust_score.score', 67);
    }

    public function test_half_percentages_round_up(): void
    {
        // 1 + 1 + 0.5 + 0 = 2.5 of 4 items = 62.5 % → 63.
        $single = JobPosting::factory()->open()->withAccommodations($this->interpreter)->create(['employer_id' => $this->employer->id]);
        $this->respondBoth('delivered', 'delivered');
        $this->respond([$this->interpreter->id => 'partial'], $single);
        $this->respond([$this->interpreter->id => 'not_delivered'], $single);

        $this->assertSame(63, $this->employer->fresh()->trust_score);
    }

    public function test_hidden_responses_leave_the_score(): void
    {
        $this->respondBoth('delivered', 'delivered');
        $this->respondBoth('delivered', 'delivered');
        $this->respondBoth('delivered', 'delivered');
        $harsh = $this->respondBoth('not_delivered', 'not_delivered');
        $this->assertSame([75, 4], [$this->employer->fresh()->trust_score, $this->employer->fresh()->feedback_count]);

        $harsh->forceFill(['is_hidden' => true])->save();
        $this->assertSame([100, 3], [$this->employer->fresh()->trust_score, $this->employer->fresh()->feedback_count]);

        Feedback::query()->where('id', '!=', $harsh->id)->first()->forceFill(['is_hidden' => true])->save();
        $this->getJson("/api/employers/{$this->employer->id}/trust-score")
            ->assertJsonPath('published', false)->assertJsonPath('based_on', 2)->assertJsonPath('breakdown', []);

        $harsh->forceFill(['is_hidden' => false])->save();
        $this->getJson("/api/employers/{$this->employer->id}/trust-score")
            ->assertJsonPath('published', true)->assertJsonPath('score', 67)->assertJsonPath('based_on', 3);
    }

    public function test_responses_to_deleted_postings_count_and_other_employers_do_not(): void
    {
        $this->respondBoth('delivered', 'delivered');
        $this->respondBoth('delivered', 'delivered');
        $this->posting->delete();
        $this->respondBoth('partial', 'partial');

        $other = JobPosting::factory()->open()->withAccommodations($this->interpreter)->create();
        $this->respond([$this->interpreter->id => 'not_delivered'], $other);

        $this->assertSame([83, 3], [$this->employer->fresh()->trust_score, $this->employer->fresh()->feedback_count]);
        $this->assertSame([0, 1], [$other->employer->fresh()->trust_score, $other->employer->fresh()->feedback_count]);
    }

    public function test_recalculating_does_not_touch_the_employer_updated_at(): void
    {
        $this->employer->forceFill(['updated_at' => now()->subWeek()])->save();
        $before = $this->employer->fresh()->updated_at;

        $this->respondBoth('delivered', 'delivered');

        $this->assertEquals($before, $this->employer->fresh()->updated_at);
    }

    public function test_unknown_employers_are_not_found(): void
    {
        $this->getJson('/api/employers/999/trust-score')->assertNotFound()->assertJsonPath('error.code', 'NOT_FOUND');
    }
}
