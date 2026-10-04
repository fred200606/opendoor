<?php

namespace Tests\Feature\Auth;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class LoginTest extends TestCase
{
    use RefreshDatabase;

    public function test_user_can_log_in_with_valid_credentials(): void
    {
        $user = User::factory()->employer()->create(['email' => 'ana@example.com']);

        $this->postJson('/api/login', ['email' => 'Ana@Example.com', 'password' => 'password'])
            ->assertOk()
            ->assertJsonStructure(['token', 'user' => ['id', 'name', 'email', 'role']])
            ->assertJsonPath('user.id', $user->id)
            ->assertJsonPath('user.role', 'employer');
    }

    public function test_wrong_password_and_unknown_email_get_the_same_answer(): void
    {
        User::factory()->create(['email' => 'ana@example.com']);

        $wrongPassword = $this->postJson('/api/login', ['email' => 'ana@example.com', 'password' => 'nope']);
        $unknownEmail = $this->postJson('/api/login', ['email' => 'nobody@example.com', 'password' => 'nope']);

        foreach ([$wrongPassword, $unknownEmail] as $response) {
            $response->assertUnprocessable()
                ->assertJsonPath('error.code', 'VALIDATION_FAILED')
                ->assertJsonPath('errors.email.0', 'These credentials do not match our records.')
                ->assertJsonMissingPath('token');
        }
    }

    public function test_suspended_user_cannot_log_in(): void
    {
        $user = User::factory()->suspended()->create();

        $this->postJson('/api/login', ['email' => $user->email, 'password' => 'password'])
            ->assertForbidden()
            ->assertJsonPath('error.code', 'ACCOUNT_SUSPENDED');

        $this->assertSame(0, $user->tokens()->count());
    }

    public function test_suspension_is_not_revealed_without_the_right_password(): void
    {
        $user = User::factory()->suspended()->create();

        $this->postJson('/api/login', ['email' => $user->email, 'password' => 'wrong-password'])
            ->assertUnprocessable()
            ->assertJsonPath('error.code', 'VALIDATION_FAILED');
    }

    public function test_login_is_limited_to_5_attempts_per_minute(): void
    {
        User::factory()->create(['email' => 'ana@example.com']);

        for ($attempt = 1; $attempt <= 5; $attempt++) {
            $this->postJson('/api/login', ['email' => 'ana@example.com', 'password' => 'nope'])->assertUnprocessable();
        }

        $this->postJson('/api/login', ['email' => 'ana@example.com', 'password' => 'password'])
            ->assertStatus(429)
            ->assertJsonPath('error.code', 'RATE_LIMITED')
            ->assertHeader('Retry-After');

        $this->travel(61)->seconds();

        $this->postJson('/api/login', ['email' => 'ana@example.com', 'password' => 'password'])->assertOk();
    }
}
