<?php

namespace Tests\Feature\Moderation;

use App\Models\Accommodation;
use App\Models\Application;
use App\Models\Employer;
use App\Models\Feedback;
use App\Models\JobPosting;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/** M10: anonymous feedback list for admins; hiding a response recalculates the trust score. */
class FeedbackModerationTest extends TestCase
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
        $this->posting = JobPosting::factory()->open()->withAccommodations($this->ramp, $this->interpreter)
            ->create(['employer_id' => $this->employer->id, 'title' => 'Data Encoder']);
    }

    private function respond(string $interpreter, string $ramp, ?JobPosting $posting = null, ?string $comments = null): Feedback
    {
        $posting ??= $this->posting;
        $application = Application::factory()->for($posting)->hired(now()->subDays(40)->toDateTimeString())->create();

        return Feedback::submit($application, [$this->interpreter->id => $interpreter, $this->ramp->id => $ramp], $comments);
    }

    public function test_lists_anonymous_responses_newest_first(): void
    {
        $older = $this->respond('delivered', 'partial', comments: 'Interpreter came every day.');
        $older->forceFill(['created_at' => now()->subDay()])->saveQuietly();
        $newer = $this->respond('not_delivered', 'delivered');
        Sanctum::actingAs(User::factory()->admin()->create());

        $response = $this->getJson('/api/admin/feedback')
            ->assertOk()
            ->assertJsonPath('meta.total', 2)
            ->assertJsonPath('data.0.id', $newer->id)
            ->assertJsonPath('data.1.id', $older->id)
            ->assertJsonPath('data.1.employer.id', $this->employer->id)
            ->assertJsonPath('data.1.employer.verified', true)
            ->assertJsonPath('data.1.job_title', 'Data Encoder')
            ->assertJsonPath('data.1.is_hidden', false)
            ->assertJsonPath('data.1.comments', 'Interpreter came every day.')
            ->assertJsonPath('data.1.items', [
                ['accommodation_id' => $this->interpreter->id, 'name' => 'Sign language interpreter', 'rating' => 'delivered'],
                ['accommodation_id' => $this->ramp->id, 'name' => 'Wheelchair-accessible entrance', 'rating' => 'partial'],
            ]);

        // Nothing that identifies the candidate
        $this->assertSame(['id', 'employer', 'job_title', 'is_hidden', 'comments', 'items', 'created_at'], array_keys($response->json('data.0')));
    }

    public function test_filters_by_employer_and_hidden(): void
    {
        $visible = $this->respond('delivered', 'delivered');
        $hidden = $this->respond('not_delivered', 'not_delivered');
        $hidden->forceFill(['is_hidden' => true])->save();
        $otherPosting = JobPosting::factory()->open()->withAccommodations($this->ramp, $this->interpreter)->create();
        $other = $this->respond('partial', 'partial', $otherPosting);
        Sanctum::actingAs(User::factory()->admin()->create());

        $this->getJson("/api/admin/feedback?employer_id={$this->employer->id}")->assertJsonPath('meta.total', 2);
        $this->getJson("/api/admin/feedback?employer_id={$otherPosting->employer_id}")->assertJsonPath('meta.total', 1)->assertJsonPath('data.0.id', $other->id);
        $this->getJson('/api/admin/feedback?hidden=1')->assertJsonPath('meta.total', 1)->assertJsonPath('data.0.id', $hidden->id)->assertJsonPath('data.0.is_hidden', true);
        $this->getJson("/api/admin/feedback?hidden=0&employer_id={$this->employer->id}")->assertJsonPath('meta.total', 1)->assertJsonPath('data.0.id', $visible->id);
        $this->getJson('/api/admin/feedback?hidden=yes')->assertUnprocessable()->assertJsonValidationErrors('hidden');
    }

    public function test_hiding_and_showing_a_response_recalculates_the_trust_score(): void
    {
        $this->respond('delivered', 'delivered');
        $this->respond('delivered', 'delivered');
        $this->respond('delivered', 'delivered');
        $harsh = $this->respond('not_delivered', 'not_delivered');
        $this->assertSame(75, $this->employer->fresh()->trust_score);
        Sanctum::actingAs(User::factory()->admin()->create());

        $this->patchJson("/api/admin/feedback/{$harsh->id}/hide", ['hidden' => true])->assertNoContent();
        $this->assertTrue($harsh->fresh()->is_hidden);
        $this->assertSame(100, $this->employer->fresh()->trust_score);
        $this->assertSame(3, $this->employer->fresh()->feedback_count);

        $this->patchJson("/api/admin/feedback/{$harsh->id}/hide", ['hidden' => false])->assertNoContent();
        $this->assertSame(75, $this->employer->fresh()->trust_score);
        $this->assertSame(4, $this->employer->fresh()->feedback_count);
    }

    public function test_hide_needs_a_boolean_and_an_existing_response(): void
    {
        $feedback = $this->respond('delivered', 'partial');
        Sanctum::actingAs(User::factory()->admin()->create());

        $this->patchJson("/api/admin/feedback/{$feedback->id}/hide", [])->assertUnprocessable()->assertJsonValidationErrors('hidden');
        $this->patchJson('/api/admin/feedback/999999/hide', ['hidden' => true])->assertNotFound();
        $this->assertFalse($feedback->fresh()->is_hidden);
    }

    public function test_only_admins_moderate_feedback(): void
    {
        $feedback = $this->respond('delivered', 'partial');

        foreach ([$this->employer->user, $feedback->application->candidateProfile->user] as $user) {
            Sanctum::actingAs($user);
            $this->getJson('/api/admin/feedback')->assertForbidden();
            $this->patchJson("/api/admin/feedback/{$feedback->id}/hide", ['hidden' => true])->assertForbidden();
        }
        $this->assertFalse($feedback->fresh()->is_hidden);
    }
}
