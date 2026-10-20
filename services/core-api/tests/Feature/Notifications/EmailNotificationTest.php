<?php

namespace Tests\Feature\Notifications;

use App\Models\Accommodation;
use App\Models\Application;
use App\Models\CandidateProfile;
use App\Models\Employer;
use App\Models\JobPosting;
use App\Models\User;
use App\Notifications\VerificationDecision;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Laravel\Sanctum\Sanctum;
use Mockery;
use Symfony\Component\Mailer\Envelope;
use Symfony\Component\Mailer\Exception\TransportException;
use Symfony\Component\Mailer\SentMessage;
use Symfony\Component\Mailer\Transport\TransportInterface;
use Symfony\Component\Mime\Email;
use Symfony\Component\Mime\RawMessage;
use Tests\TestCase;

/** M13: the in-app notices are also emailed (after the response) unless the user turned emails off. */
class EmailNotificationTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        config(['opendoor.public_app_url' => 'https://app.opendoor.test']);
    }

    /** @return Collection<int, Email> emails caught by the `array` mailer (phpunit.xml) */
    private function sentEmails(): Collection
    {
        return Mail::mailer('array')->getSymfonyTransport()->messages()->map(fn ($sent) => $sent->getOriginalMessage());
    }

    private function emailTo(User $user): Email
    {
        return $this->sentEmails()->sole(fn (Email $email) => $email->getTo()[0]->getAddress() === $user->email);
    }

    public function test_job_seekers_and_employers_turn_emails_off_and_on(): void
    {
        foreach (['candidate', 'employer'] as $role) {
            $user = User::factory()->{$role}()->create();
            Sanctum::actingAs($user);

            $this->getJson('/api/me')->assertOk()->assertJsonPath('email_notifications', true);
            $this->putJson('/api/me/email-notifications', ['enabled' => false])->assertOk()->assertExactJson(['enabled' => false]);
            $this->getJson('/api/me')->assertJsonPath('email_notifications', false);
            $this->assertFalse($user->fresh()->email_notifications);
            $this->putJson('/api/me/email-notifications', ['enabled' => true])->assertOk()->assertExactJson(['enabled' => true]);
        }

        $user->update(['email_notifications' => false]);
        $this->app['auth']->forgetGuards();
        $this->postJson('/api/login', ['email' => $user->email, 'password' => 'password'])
            ->assertOk()
            ->assertJsonPath('user.email_notifications', false);
    }

    public function test_new_accounts_get_emails(): void
    {
        $this->postJson('/api/register', [
            'name' => 'Grace Ramos',
            'email' => 'grace@example.com',
            'password' => 'a-long-password',
            'password_confirmation' => 'a-long-password',
            'role' => 'candidate',
            'consent' => true,
        ])->assertCreated()->assertJsonPath('user.email_notifications', true);

        $this->assertTrue(User::where('email', 'grace@example.com')->sole()->email_notifications);
    }

    public function test_the_switch_is_validated_and_not_for_admins_or_guests(): void
    {
        $this->putJson('/api/me/email-notifications', ['enabled' => false])->assertUnauthorized();

        Sanctum::actingAs(User::factory()->admin()->create());
        $this->putJson('/api/me/email-notifications', ['enabled' => false])->assertForbidden();

        Sanctum::actingAs($candidate = User::factory()->candidate()->create());
        foreach ([[], ['enabled' => 'sometimes'], ['enabled' => null]] as $body) {
            $this->putJson('/api/me/email-notifications', $body)
                ->assertUnprocessable()
                ->assertJsonPath('error.code', 'VALIDATION_FAILED')
                ->assertJsonValidationErrors(['enabled']);
        }
        $this->assertTrue($candidate->fresh()->email_notifications);
    }

    public function test_a_new_application_is_emailed_to_the_employer_without_the_candidates_needs(): void
    {
        $employer = Employer::factory()->verified()->create(['company_name' => 'Bright Path BPO']);
        $posting = JobPosting::factory()->open()->for($employer)->create(['title' => 'Data Encoder']);
        $profile = CandidateProfile::factory()->create(['disability_type' => 'Low vision', 'show_disability' => true]);
        $profile->user->update(['name' => 'Maria Santos']);
        $profile->accommodations()->attach(Accommodation::factory()->create(['name' => 'Screen magnifier software']));
        Sanctum::actingAs($profile->user);

        $this->postJson("/api/job-postings/{$posting->id}/applications", ['interview_request' => 'Large-print questions, please.'])->assertCreated();

        $email = $this->emailTo($employer->user);
        $application = Application::sole();
        $this->assertSame('New application for Data Encoder', $email->getSubject());
        $text = $email->getTextBody();
        $this->assertStringContainsString('Maria Santos applied for Data Encoder.', $text);
        $this->assertStringContainsString("https://app.opendoor.test/employer/applications/{$application->id}", $text);
        $this->assertStringContainsString('https://app.opendoor.test/account', $text);
        foreach (['Low vision', 'Screen magnifier software', 'Large-print questions'] as $private) {
            $this->assertStringNotContainsString($private, $text.$email->getHtmlBody());
        }
        $this->assertCount(1, $this->sentEmails(), 'the candidate who acted gets no email');
        $this->assertSame(1, $employer->user->notifications()->count());
    }

    public function test_admin_decisions_are_emailed_with_the_reason(): void
    {
        $employer = Employer::factory()->create(['company_name' => 'Kalinga Foods Inc.']);
        $posting = JobPosting::factory()->open()->for($employer)->create(['title' => 'Packing Line Staff']);
        Sanctum::actingAs(User::factory()->admin()->create());

        $this->deleteJson("/api/admin/job-postings/{$posting->id}", ['reason' => 'Add the working hours.'])->assertNoContent();
        $this->patchJson("/api/admin/employers/{$employer->id}/verify", ['action' => 'approve'])->assertOk();

        [$review, $verification] = $this->sentEmails()->all();
        $this->assertSame('Your job posting Packing Line Staff was removed', $review->getSubject());
        $this->assertStringContainsString('was removed by an administrator: Add the working hours.', $review->getTextBody());
        $this->assertStringContainsString('https://app.opendoor.test/employer/jobs', $review->getTextBody());
        $this->assertSame('Kalinga Foods Inc. is now verified on OpenDoor', $verification->getSubject());
        $this->assertSame([$employer->user->email], array_map(fn ($address) => $address->getAddress(), $verification->getTo()));
    }

    public function test_no_email_when_turned_off_or_suspended_but_the_notice_is_kept(): void
    {
        $off = Employer::factory()->create();
        $off->user->update(['email_notifications' => false]);
        $suspended = Employer::factory()->for(User::factory()->employer()->suspended())->create();
        $this->withoutDefer();

        $off->user->notify(new VerificationDecision($off));
        $suspended->user->notify(new VerificationDecision($suspended));

        $this->assertCount(0, $this->sentEmails());
        $this->assertSame(1, $off->user->notifications()->count());
        $this->assertSame(1, $suspended->user->notifications()->count());
    }

    public function test_a_mail_server_failure_is_logged_and_the_decision_still_succeeds(): void
    {
        Mail::extend('failing', fn () => new class implements TransportInterface
        {
            public function send(RawMessage $message, ?Envelope $envelope = null): ?SentMessage
            {
                throw new TransportException('Connection refused by smtp.example.com');
            }

            public function __toString(): string
            {
                return 'failing';
            }
        });
        config(['mail.mailers.failing' => ['transport' => 'failing'], 'mail.default' => 'failing']);
        Log::spy();
        $employer = Employer::factory()->create();
        Sanctum::actingAs(User::factory()->admin()->create());

        $this->patchJson("/api/admin/employers/{$employer->id}/verify", ['action' => 'approve'])->assertOk();

        $this->assertNotNull($employer->fresh()->verified_at);
        $this->assertSame(1, $employer->user->notifications()->count());
        Log::shouldHaveReceived('warning')->once()->with('Email notification not sent', Mockery::on(fn (array $context) => $context['user_id'] === $employer->user->id
            && $context['notification'] === VerificationDecision::class
            && ! str_contains(json_encode($context), $employer->user->email)));
    }
}
