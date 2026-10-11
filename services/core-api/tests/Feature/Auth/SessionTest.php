<?php

namespace Tests\Feature\Auth;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Testing\TestResponse;
use Tests\TestCase;

/** Logout, /me and password change with real Sanctum tokens. */
class SessionTest extends TestCase
{
    use RefreshDatabase;

    private function loginToken(User $user, string $password = 'password'): string
    {
        return $this->postJson('/api/login', ['email' => $user->email, 'password' => $password])->json('token');
    }

    /**
     * Sends a request as a fresh client: the guard does not keep the previous request's user.
     *
     * @param  array<string, mixed>  $data
     */
    private function asToken(string $token, string $method, string $uri, array $data = []): TestResponse
    {
        $this->app['auth']->forgetGuards();

        return $this->json($method, $uri, $data, ['Authorization' => 'Bearer '.$token]);
    }

    public function test_me_returns_the_current_user(): void
    {
        $user = User::factory()->employer()->create();

        $this->asToken($this->loginToken($user), 'GET', '/api/me')
            ->assertOk()
            ->assertExactJson([
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'role' => 'employer',
                'is_active' => true,
                'display_prefs' => null,
            ]);
    }

    public function test_logout_revokes_only_the_current_token(): void
    {
        $user = User::factory()->create();
        $phone = $this->loginToken($user);
        $laptop = $this->loginToken($user);

        $this->asToken($phone, 'POST', '/api/logout')->assertNoContent();

        $this->assertSame(1, $user->tokens()->count());
        $this->asToken($phone, 'GET', '/api/me')->assertUnauthorized();
        $this->asToken($laptop, 'GET', '/api/me')->assertOk();
    }

    public function test_suspended_user_with_a_leftover_token_is_blocked(): void
    {
        $user = User::factory()->create();
        $token = $this->loginToken($user);
        $user->forceFill(['is_active' => false])->save();

        $this->asToken($token, 'GET', '/api/me')
            ->assertForbidden()
            ->assertJsonPath('error.code', 'ACCOUNT_SUSPENDED');
    }

    public function test_password_change_requires_the_current_password(): void
    {
        $user = User::factory()->create();

        $this->asToken($this->loginToken($user), 'PUT', '/api/me/password', [
            'current_password' => 'wrong-password',
            'password' => 'new-password-1',
            'password_confirmation' => 'new-password-1',
        ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('current_password');

        $this->assertTrue(Hash::check('password', $user->fresh()->password));
    }

    public function test_new_password_must_differ_from_the_current_one(): void
    {
        $user = User::factory()->create();

        $this->asToken($this->loginToken($user), 'PUT', '/api/me/password', [
            'current_password' => 'password',
            'password' => 'password',
            'password_confirmation' => 'password',
        ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('password');
    }

    public function test_password_change_signs_out_other_devices(): void
    {
        $user = User::factory()->create();
        $other = $this->loginToken($user);
        $current = $this->loginToken($user);

        $this->asToken($current, 'PUT', '/api/me/password', [
            'current_password' => 'password',
            'password' => 'new-password-1',
            'password_confirmation' => 'new-password-1',
        ])->assertNoContent();

        $this->assertTrue(Hash::check('new-password-1', $user->fresh()->password));
        $this->asToken($current, 'GET', '/api/me')->assertOk();
        $this->asToken($other, 'GET', '/api/me')->assertUnauthorized();
    }

    public function test_protected_routes_need_a_token(): void
    {
        $this->postJson('/api/logout')->assertUnauthorized()->assertJsonPath('error.code', 'UNAUTHENTICATED');
        $this->putJson('/api/me/password', [])->assertUnauthorized();
    }
}
