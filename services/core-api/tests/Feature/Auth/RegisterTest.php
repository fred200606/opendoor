<?php

namespace Tests\Feature\Auth;

use App\Enums\UserRole;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class RegisterTest extends TestCase
{
    use RefreshDatabase;

    /**
     * @param  array<string, mixed>  $overrides
     * @return array<string, mixed>
     */
    private function payload(array $overrides = []): array
    {
        return [
            'name' => 'Maria Santos',
            'email' => 'Maria@Example.com',
            'password' => 'correct-horse-1',
            'password_confirmation' => 'correct-horse-1',
            'role' => 'candidate',
            'consent' => true,
            ...$overrides,
        ];
    }

    public function test_candidate_can_register_and_receives_a_token(): void
    {
        $response = $this->postJson('/api/register', $this->payload());

        $response->assertCreated()
            ->assertJsonStructure(['token', 'user' => ['id', 'name', 'email', 'role', 'is_active']])
            ->assertJsonPath('user.email', 'maria@example.com')
            ->assertJsonPath('user.role', 'candidate')
            ->assertJsonPath('user.is_active', true)
            ->assertJsonMissingPath('user.password');

        $user = User::firstWhere('email', 'maria@example.com');
        $this->assertNotNull($user->consented_at);
        $this->assertSame(1, $user->tokens()->count());

        $this->getJson('/api/me', ['Authorization' => 'Bearer '.$response->json('token')])
            ->assertOk()
            ->assertJsonPath('id', $user->id);
    }

    public function test_employer_can_register(): void
    {
        $this->postJson('/api/register', $this->payload(['role' => 'employer']))
            ->assertCreated()
            ->assertJsonPath('user.role', 'employer');
    }

    public function test_nobody_can_register_as_admin(): void
    {
        $this->postJson('/api/register', $this->payload(['role' => 'admin']))
            ->assertUnprocessable()
            ->assertJsonPath('error.code', 'VALIDATION_FAILED')
            ->assertJsonValidationErrors('role');

        $this->assertSame(0, User::where('role', UserRole::Admin)->count());
    }

    public function test_consent_is_required(): void
    {
        foreach ([false, null] as $consent) {
            $this->postJson('/api/register', $this->payload(['consent' => $consent]))
                ->assertUnprocessable()
                ->assertJsonValidationErrors('consent');
        }

        $this->assertSame(0, User::count());
    }

    public function test_email_must_be_unique_case_insensitively(): void
    {
        User::factory()->create(['email' => 'maria@example.com']);

        $this->postJson('/api/register', $this->payload(['email' => 'MARIA@example.com']))
            ->assertUnprocessable()
            ->assertJsonValidationErrors('email');
    }

    public function test_password_must_be_confirmed_and_at_least_8_characters(): void
    {
        $this->postJson('/api/register', $this->payload(['password' => 'short', 'password_confirmation' => 'short']))
            ->assertUnprocessable()
            ->assertJsonValidationErrors('password');

        $this->postJson('/api/register', $this->payload(['password_confirmation' => 'something-else']))
            ->assertUnprocessable()
            ->assertJsonValidationErrors('password');
    }

    public function test_extra_fields_cannot_set_account_status(): void
    {
        $this->postJson('/api/register', $this->payload(['is_active' => false, 'consented_at' => '2000-01-01']))
            ->assertCreated()
            ->assertJsonPath('user.is_active', true);

        $this->assertTrue(User::firstWhere('email', 'maria@example.com')->consented_at->isToday());
    }
}
