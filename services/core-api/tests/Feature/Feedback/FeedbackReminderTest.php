<?php

namespace Tests\Feature\Feedback;

use App\Enums\ApplicationStatus;
use App\Models\Accommodation;
use App\Models\Application;
use App\Models\Employer;
use App\Models\Feedback;
use App\Models\JobPosting;
use Illuminate\Console\Scheduling\Event;
use Illuminate\Console\Scheduling\Schedule;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Mail;
use Tests\TestCase;

/** M13: feedback:remind tells each hired candidate once, on the day the accommodation rating opens. */
class FeedbackReminderTest extends TestCase
{
    use RefreshDatabase;

    private JobPosting $posting;

    protected function setUp(): void
    {
        parent::setUp();

        Carbon::setTestNow('2026-10-12 08:00:00'); // Asia/Manila
        config(['opendoor.public_app_url' => 'https://app.opendoor.test']);
        // A real `artisan` run sends the deferred emails when the command finishes; artisan() in
        // tests never fires that event, so send them at once here.
        $this->withoutDefer();
        $employer = Employer::factory()->verified()->create(['company_name' => 'Bright Path BPO']);
        $this->posting = JobPosting::factory()->open()->withAccommodations(Accommodation::factory()->create())
            ->create(['employer_id' => $employer->id, 'title' => 'Data Encoder']);
    }

    protected function tearDown(): void
    {
        Carbon::setTestNow();
        parent::tearDown();
    }

    private function hire(string $at): Application
    {
        return Application::factory()->for($this->posting)->hired($at)->create();
    }

    public function test_reminds_each_hired_candidate_once_on_the_day_the_rating_opens(): void
    {
        $opensToday = $this->hire('2026-09-12 23:30:00');
        $opensTomorrow = $this->hire('2026-09-13 00:10:00');

        $this->artisan('feedback:remind')->expectsOutput('Sent 1 rating reminder(s).')->assertSuccessful();

        $notice = $opensToday->candidateProfile->user->notifications()->sole();
        $this->assertSame('feedback_reminder', $notice->type);
        $this->assertSame('You can now rate the accommodations Bright Path BPO promised for Data Encoder. Your answers are anonymous.', $notice->data['message']);
        $this->assertSame("/candidate/applications/{$opensToday->id}/feedback", $notice->data['url']);
        $this->assertNotNull($opensToday->fresh()->feedback_reminded_at);
        $this->assertSame(0, $opensTomorrow->candidateProfile->user->notifications()->count());

        $email = Mail::mailer('array')->getSymfonyTransport()->messages()->sole()->getOriginalMessage();
        $this->assertSame('Rate the accommodations for Data Encoder', $email->getSubject());
        $this->assertSame($opensToday->candidateProfile->user->email, $email->getTo()[0]->getAddress());
        $this->assertStringContainsString("https://app.opendoor.test/candidate/applications/{$opensToday->id}/feedback", $email->getTextBody());

        $this->artisan('feedback:remind')->expectsOutput('Sent 0 rating reminder(s).')->assertSuccessful();
        $this->assertSame(1, $opensToday->candidateProfile->user->notifications()->count());

        Carbon::setTestNow('2026-10-13 08:00:00');
        $this->artisan('feedback:remind')->expectsOutput('Sent 1 rating reminder(s).')->assertSuccessful();
        $this->assertSame(1, $opensTomorrow->candidateProfile->user->notifications()->count());
    }

    public function test_rated_unhired_and_suspended_candidates_are_not_reminded(): void
    {
        $rated = $this->hire('2026-08-01 10:00:00');
        Feedback::submit($rated, [$this->posting->accommodations->first()->id => 'delivered']);
        $reviewed = Application::factory()->for($this->posting)->status(ApplicationStatus::Reviewed)->create(['created_at' => '2026-08-01 10:00:00']);
        $suspended = $this->hire('2026-08-01 10:00:00');
        $suspended->candidateProfile->user->forceFill(['is_active' => false])->save();

        $this->artisan('feedback:remind')->expectsOutput('Sent 0 rating reminder(s).')->assertSuccessful();
        foreach ([$rated, $reviewed, $suspended] as $application) {
            $this->assertSame(0, $application->candidateProfile->user->notifications()->count());
        }
        $this->assertNull($suspended->fresh()->feedback_reminded_at);

        // After reactivation the missed reminder still comes.
        $suspended->candidateProfile->user->forceFill(['is_active' => true])->save();
        $this->artisan('feedback:remind')->expectsOutput('Sent 1 rating reminder(s).')->assertSuccessful();
    }

    public function test_the_reminder_runs_every_morning(): void
    {
        $event = collect(app(Schedule::class)->events())->sole(fn (Event $event) => str_contains($event->command, 'feedback:remind'));

        $this->assertSame('0 8 * * *', $event->expression);
    }
}
