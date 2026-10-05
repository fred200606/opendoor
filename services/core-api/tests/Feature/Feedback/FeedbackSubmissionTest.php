<?php

namespace Tests\Feature\Feedback;

use App\Enums\ApplicationStatus;
use App\Models\Accommodation;
use App\Models\Application;
use App\Models\CandidateProfile;
use App\Models\Employer;
use App\Models\Feedback;
use App\Models\JobPosting;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Testing\TestResponse;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/** M7: feedback form and submission – window, once only, only the hired candidate. */
class FeedbackSubmissionTest extends TestCase
{
    use RefreshDatabase;

    private Accommodation $interpreter;

    private Accommodation $remote;

    private JobPosting $posting;

    private CandidateProfile $profile;

    protected function setUp(): void
    {
        parent::setUp();

        $this->interpreter = Accommodation::factory()->create(['name' => 'Sign language interpreter']);
        $this->remote = Accommodation::factory()->create(['name' => 'Remote work']);
        $employer = Employer::factory()->verified()->create();
        $this->posting = JobPosting::factory()->open()
            ->withAccommodations($this->remote, $this->interpreter)
            ->create(['employer_id' => $employer->id]);
        $this->profile = CandidateProfile::factory()->create();
    }

    protected function tearDown(): void
    {
        Carbon::setTestNow();
        parent::tearDown();
    }

    private function hired(string $at = '2026-08-01 10:00:00'): Application
    {
        return Application::factory()->for($this->posting)->for($this->profile)->hired($at)->create();
    }

    /** @param  array<int, string>|null  $ratings  accommodation_id => rating */
    private function submit(Application $application, ?array $ratings = null, ?User $as = null): TestResponse
    {
        Sanctum::actingAs($as ?? $this->profile->user);
        $ratings ??= [$this->interpreter->id => 'partial', $this->remote->id => 'delivered'];

        return $this->postJson("/api/applications/{$application->id}/feedback", [
            'items' => collect($ratings)->map(fn ($rating, $id) => ['accommodation_id' => $id, 'rating' => $rating])->values()->all(),
            'comments' => 'The interpreter came only to team meetings.',
        ]);
    }

    public function test_the_form_lists_the_accommodations_advertised_at_hire(): void
    {
        $application = $this->hired();
        Sanctum::actingAs($this->profile->user);

        $this->getJson("/api/applications/{$application->id}/feedback-form")
            ->assertOk()
            ->assertExactJson([
                'opens_on' => '2026-08-31',
                'is_open' => true,
                'submitted' => false,
                'items' => [
                    ['accommodation_id' => $this->remote->id, 'name' => 'Remote work'],
                    ['accommodation_id' => $this->interpreter->id, 'name' => 'Sign language interpreter'],
                ],
            ]);
    }

    public function test_hiring_records_the_accommodations_so_later_posting_edits_do_not_change_the_form(): void
    {
        $application = Application::factory()->for($this->posting)->for($this->profile)->status(ApplicationStatus::Reviewed)->create();
        Sanctum::actingAs($this->posting->employer->user);
        $this->patchJson("/api/applications/{$application->id}/status", ['status' => 'hired'])->assertOk();

        // The employer drops the interpreter after the hire.
        $this->posting->accommodations()->sync([$this->remote->id, Accommodation::factory()->create()->id]);

        Sanctum::actingAs($this->profile->user);
        $this->getJson("/api/applications/{$application->id}/feedback-form")
            ->assertOk()
            ->assertJsonPath('is_open', false)
            ->assertJsonPath('items.*.accommodation_id', [$this->remote->id, $this->interpreter->id]);
    }

    public function test_feedback_opens_on_calendar_day_30_after_the_hire_in_manila(): void
    {
        // Hired late on 1 Oct (Manila) → opens 31 Oct 00:00 Manila.
        $application = $this->hired('2026-10-01 23:30:00');

        Carbon::setTestNow(Carbon::parse('2026-10-30 23:59:59', 'Asia/Manila'));
        $this->submit($application)->assertUnprocessable()
            ->assertJsonPath('error.code', 'FEEDBACK_NOT_OPEN')
            ->assertJsonPath('error.message', 'Feedback opens on 2026-10-31, 30 days after the hire date.');
        $this->getJson("/api/applications/{$application->id}/feedback-form")
            ->assertOk()->assertJsonPath('is_open', false)->assertJsonPath('opens_on', '2026-10-31');

        Carbon::setTestNow(Carbon::parse('2026-10-31 00:00:00', 'Asia/Manila'));
        $this->submit($application)->assertCreated();
    }

    public function test_the_hired_candidate_submits_once(): void
    {
        $application = $this->hired();

        $response = $this->submit($application)->assertCreated();
        $feedback = Feedback::sole();
        $response->assertExactJson(['id' => $feedback->id, 'application_id' => $application->id, 'items_rated' => 2]);
        $this->assertSame('The interpreter came only to team meetings.', $feedback->comments);
        $this->assertEqualsCanonicalizing(
            [[$this->interpreter->id, 'partial'], [$this->remote->id, 'delivered']],
            $feedback->items->map(fn ($item) => [$item->accommodation_id, $item->rating->value])->all(),
        );

        $this->submit($application)->assertStatus(409)->assertJsonPath('error.code', 'FEEDBACK_EXISTS');
        $this->assertSame(1, Feedback::count());
        $this->getJson("/api/applications/{$application->id}/feedback-form")->assertJsonPath('submitted', true);
    }

    public function test_applications_that_were_not_hired_cannot_be_rated(): void
    {
        $application = Application::factory()->for($this->posting)->for($this->profile)->status(ApplicationStatus::Rejected)->create();

        $this->submit($application)->assertUnprocessable()->assertJsonPath('error.code', 'FEEDBACK_NOT_OPEN');
        $this->getJson("/api/applications/{$application->id}/feedback-form")
            ->assertUnprocessable()->assertJsonPath('error.code', 'FEEDBACK_NOT_OPEN');
    }

    public function test_only_the_hired_candidate_may_rate(): void
    {
        $application = $this->hired();

        $this->submit($application, as: CandidateProfile::factory()->create()->user)->assertForbidden();
        $this->submit($application, as: $this->posting->employer->user)->assertForbidden();
        $this->submit($application, as: User::factory()->admin()->create())->assertForbidden();

        Sanctum::actingAs($this->posting->employer->user);
        $this->getJson("/api/applications/{$application->id}/feedback-form")->assertForbidden();
        $this->assertSame(0, Feedback::count());
    }

    public function test_guests_must_log_in(): void
    {
        $application = $this->hired();

        $this->postJson("/api/applications/{$application->id}/feedback", ['items' => []])->assertUnauthorized();
        $this->getJson("/api/applications/{$application->id}/feedback-form")->assertUnauthorized();
    }

    public function test_every_advertised_accommodation_needs_one_valid_rating(): void
    {
        $application = $this->hired();
        $other = Accommodation::factory()->create();

        $this->submit($application, [$this->remote->id => 'delivered'])
            ->assertUnprocessable()->assertJsonValidationErrors(['items' => 'Rate every accommodation listed in the form.']);
        $this->submit($application, [$this->remote->id => 'delivered', $this->interpreter->id => 'sometimes'])
            ->assertJsonValidationErrors(['items.1.rating']);
        $this->submit($application, [$this->remote->id => 'delivered', $this->interpreter->id => 'partial', $other->id => 'delivered'])
            ->assertJsonValidationErrors(['items.2.accommodation_id' => 'This accommodation was not part of the job posting when you were hired.']);

        Sanctum::actingAs($this->profile->user);
        $this->postJson("/api/applications/{$application->id}/feedback", ['items' => [
            ['accommodation_id' => $this->remote->id, 'rating' => 'delivered'],
            ['accommodation_id' => $this->remote->id, 'rating' => 'partial'],
        ]])->assertJsonValidationErrors(['items.0.accommodation_id']);
        $this->postJson("/api/applications/{$application->id}/feedback", ['items' => []])->assertJsonValidationErrors(['items']);

        $this->assertSame(0, Feedback::count());
    }

    public function test_only_the_candidate_learns_whether_they_rated(): void
    {
        $application = $this->hired();
        $this->submit($application)->assertCreated();

        $this->getJson("/api/applications/{$application->id}")->assertJsonPath('feedback_submitted', true);
        $this->getJson('/api/applications')->assertJsonPath('data.0.feedback_submitted', true);

        Sanctum::actingAs($this->posting->employer->user);
        $this->getJson("/api/applications/{$application->id}")->assertOk()->assertJsonMissingPath('feedback_submitted');
    }
}
