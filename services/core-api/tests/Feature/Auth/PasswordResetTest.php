<?php

namespace Tests\Feature\Auth;

use App\Http\Controllers\Auth\PasswordResetController;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Password;
use Symfony\Component\Mime\Email;
use Tests\TestCase;

/** Forgot password: an emailed link to the React reset page, then a new password (decision 2026-10-13). */
class PasswordResetTest extends TestCase
{
    use RefreshDatabase;

    private const SENT = ['message' => PasswordResetController::LINK_SENT];

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

    /** token and email from the link in the reset email */
    private function linkFrom(Email $email): array
    {
        preg_match('#https://app\.opendoor\.test/reset-password\?(\S+?)(?=[\s)\]]|$)#', $email->getTextBody(), $match);
        parse_str(html_entity_decode($match[1]), $query);

        return $query;
    }

    public function test_the_link_is_emailed_and_sets_a_new_password_that_signs_out_everywhere(): void
    {
        $user = User::factory()->candidate()->create(['name' => 'Maria Santos', 'email' => 'maria@example.com', 'email_notifications' => false]);
        $user->createToken('phone');

        $this->postJson('/api/forgot-password', ['email' => '  Maria@Example.com '])->assertOk()->assertExactJson(self::SENT);

        // A security email: sent although Maria turned the notification emails off.
        $email = $this->sentEmails()->sole();
        $this->assertSame('Reset your OpenDoor password', $email->getSubject());
        $this->assertSame('maria@example.com', $email->getTo()[0]->getAddress());
        $this->assertStringContainsString('This link works for 60 minutes and only once.', $email->getTextBody());
        $link = $this->linkFrom($email);
        $this->assertSame('maria@example.com', $link['email']);
        $this->assertSame(0, $user->notifications()->count(), 'no in-app notice');

        $this->postJson('/api/reset-password', [
            'token' => $link['token'],
            'email' => $link['email'],
            'password' => 'a-new-password',
            'password_confirmation' => 'a-new-password',
        ])->assertOk()->assertJsonPath('message', 'Your password is changed. Log in with your new password.');

        $this->assertTrue(Hash::check('a-new-password', $user->fresh()->password));
        $this->assertSame(0, $user->tokens()->count(), 'signed out on every device');
        $this->postJson('/api/login', ['email' => 'maria@example.com', 'password' => 'a-new-password'])->assertOk();

        // The link works once.
        $this->postJson('/api/reset-password', ['token' => $link['token'], 'email' => $link['email'], 'password' => 'third-password', 'password_confirmation' => 'third-password'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['token' => 'This reset link is invalid or has expired. Ask for a new one.']);
    }

    public function test_the_answer_is_the_same_for_unknown_and_suspended_accounts_and_no_link_is_sent(): void
    {
        User::factory()->employer()->suspended()->create(['email' => 'suspended@example.com']);

        $this->postJson('/api/forgot-password', ['email' => 'nobody@example.com'])->assertOk()->assertExactJson(self::SENT);
        $this->postJson('/api/forgot-password', ['email' => 'suspended@example.com'])->assertOk()->assertExactJson(self::SENT);

        $this->assertCount(0, $this->sentEmails());
        $this->assertDatabaseCount('password_reset_tokens', 0);
    }

    public function test_a_second_request_within_a_minute_sends_no_new_link(): void
    {
        User::factory()->candidate()->create(['email' => 'maria@example.com']);

        $this->postJson('/api/forgot-password', ['email' => 'maria@example.com'])->assertOk();
        $this->postJson('/api/forgot-password', ['email' => 'maria@example.com'])->assertOk()->assertExactJson(self::SENT);
        $this->assertCount(1, $this->sentEmails());

        $this->travel(61)->seconds();
        $this->postJson('/api/forgot-password', ['email' => 'maria@example.com'])->assertOk();
        $this->assertCount(2, $this->sentEmails());
    }

    public function test_wrong_expired_or_foreign_links_and_weak_passwords_are_refused(): void
    {
        $user = User::factory()->candidate()->create(['email' => 'maria@example.com']);
        $other = User::factory()->candidate()->create(['email' => 'other@example.com']);
        $token = Password::broker()->createToken($user);
        $reset = fn (array $changes) => $this->postJson('/api/reset-password', [
            'token' => $token, 'email' => 'maria@example.com', 'password' => 'a-new-password', 'password_confirmation' => 'a-new-password', ...$changes,
        ]);

        foreach ([['token' => 'not-the-token'], ['email' => $other->email], ['email' => 'nobody@example.com']] as $changes) {
            $reset($changes)->assertUnprocessable()->assertJsonPath('error.code', 'VALIDATION_FAILED')->assertJsonValidationErrors(['token']);
        }
        $reset(['password' => 'short', 'password_confirmation' => 'short'])->assertJsonValidationErrors(['password']);
        $reset(['password_confirmation' => 'something-else'])->assertJsonValidationErrors(['password']);
        $this->postJson('/api/reset-password', [])->assertJsonValidationErrors(['token', 'email', 'password']);

        $this->travel(61)->minutes();
        $reset([])->assertUnprocessable()->assertJsonValidationErrors(['token']);
        $this->assertTrue(Hash::check('password', $user->fresh()->password), 'the old password still works');
    }

    public function test_requests_are_rate_limited_like_logins(): void
    {
        foreach (range(1, 5) as $attempt) {
            $this->postJson('/api/forgot-password', ['email' => 'maria@example.com'])->assertOk();
        }

        $this->postJson('/api/forgot-password', ['email' => 'maria@example.com'])
            ->assertTooManyRequests()
            ->assertJsonPath('error.code', 'RATE_LIMITED');
        $this->postJson('/api/forgot-password', ['email' => 'not-an-email'])->assertUnprocessable()->assertJsonValidationErrors(['email']);
    }
}
