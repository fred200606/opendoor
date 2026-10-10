<?php

namespace Tests\Feature\Moderation;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/** M10: admin user list, suspend (revokes every token) and reactivate. */
class UserModerationTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;

    protected function setUp(): void
    {
        parent::setUp();

        $this->admin = User::factory()->admin()->create(['name' => 'Ada Admin', 'email' => 'ada@opendoor.test']);
    }

    public function test_lists_users_by_name_with_role_and_keyword_filters(): void
    {
        User::factory()->candidate()->create(['name' => 'Carla Cruz', 'email' => 'carla@example.com']);
        User::factory()->candidate()->create(['name' => 'Ben Bautista', 'email' => 'ben@example.com']);
        User::factory()->employer()->create(['name' => 'Eli Employer', 'email' => 'hr_100%@example.com']);
        Sanctum::actingAs($this->admin);

        $this->getJson('/api/admin/users')
            ->assertOk()
            ->assertJsonPath('meta.total', 4)
            ->assertJsonPath('data.0.name', 'Ada Admin')
            ->assertJsonPath('data.1.name', 'Ben Bautista')
            ->assertJsonStructure(['data' => [['id', 'name', 'email', 'role', 'is_active']], 'meta' => ['per_page']])
            ->assertJsonMissingPath('data.0.password');

        $this->getJson('/api/admin/users?role=candidate')->assertJsonPath('meta.total', 2);
        $this->getJson('/api/admin/users?q=CARLA')->assertJsonPath('meta.total', 1)->assertJsonPath('data.0.email', 'carla@example.com');
        $this->getJson('/api/admin/users?q=example.com&role=employer')->assertJsonPath('meta.total', 1);
        // % and _ are searched literally
        $this->getJson('/api/admin/users?q='.urlencode('_100%'))->assertJsonPath('meta.total', 1)->assertJsonPath('data.0.name', 'Eli Employer');
        $this->getJson('/api/admin/users?q='.urlencode('%'))->assertJsonPath('meta.total', 1);
        $this->getJson('/api/admin/users?role=owner')->assertUnprocessable()->assertJsonValidationErrors('role');
    }

    public function test_suspending_signs_the_user_out_everywhere_and_blocks_login(): void
    {
        $user = User::factory()->employer()->create();
        $phone = $user->createToken('phone')->plainTextToken;
        $user->createToken('laptop');
        Sanctum::actingAs($this->admin);

        $this->patchJson("/api/admin/users/{$user->id}/suspend", ['suspended' => true])
            ->assertOk()
            ->assertJsonPath('id', $user->id)
            ->assertJsonPath('is_active', false);

        $this->assertFalse($user->fresh()->is_active);
        $this->assertSame(0, $user->tokens()->count());

        $this->app['auth']->forgetGuards();
        $this->getJson('/api/me', ['Authorization' => 'Bearer '.$phone])->assertUnauthorized();
        $this->postJson('/api/login', ['email' => $user->email, 'password' => 'password'])
            ->assertForbidden()
            ->assertJsonPath('error.code', 'ACCOUNT_SUSPENDED');
    }

    public function test_reactivating_lets_the_user_log_in_again(): void
    {
        $user = User::factory()->candidate()->suspended()->create();
        Sanctum::actingAs($this->admin);

        $this->patchJson("/api/admin/users/{$user->id}/suspend", ['suspended' => false])
            ->assertOk()
            ->assertJsonPath('is_active', true);

        $this->app['auth']->forgetGuards();
        $this->postJson('/api/login', ['email' => $user->email, 'password' => 'password'])->assertOk();
    }

    public function test_admins_cannot_suspend_themselves(): void
    {
        Sanctum::actingAs($this->admin);

        $this->patchJson("/api/admin/users/{$this->admin->id}/suspend", ['suspended' => true])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['suspended' => 'You cannot suspend your own account.']);

        $this->assertTrue($this->admin->fresh()->is_active);
    }

    public function test_suspend_needs_a_boolean_and_an_existing_user(): void
    {
        $user = User::factory()->create();
        Sanctum::actingAs($this->admin);

        $this->patchJson("/api/admin/users/{$user->id}/suspend", [])->assertUnprocessable()->assertJsonValidationErrors('suspended');
        $this->patchJson("/api/admin/users/{$user->id}/suspend", ['suspended' => 'maybe'])->assertUnprocessable();
        $this->patchJson('/api/admin/users/999999/suspend', ['suspended' => true])->assertNotFound()->assertJsonPath('error.code', 'NOT_FOUND');
        $this->assertTrue($user->fresh()->is_active);
    }

    public function test_only_admins_manage_users(): void
    {
        $user = User::factory()->candidate()->create();

        foreach ([User::factory()->employer()->create(), User::factory()->candidate()->create()] as $other) {
            Sanctum::actingAs($other);
            $this->getJson('/api/admin/users')->assertForbidden()->assertJsonPath('error.code', 'FORBIDDEN');
            $this->patchJson("/api/admin/users/{$user->id}/suspend", ['suspended' => true])->assertForbidden();
        }

        $this->assertTrue($user->fresh()->is_active);
    }
}
