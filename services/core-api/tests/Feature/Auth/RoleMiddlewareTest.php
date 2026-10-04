<?php

namespace Tests\Feature\Auth;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Route;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class RoleMiddlewareTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        Route::middleware(['api', 'auth:sanctum', 'active'])->prefix('api/_test')->group(function () {
            Route::get('employer-only', fn () => ['ok' => true])->middleware('role:employer');
            Route::get('staff', fn () => ['ok' => true])->middleware('role:employer,admin');
        });
    }

    public function test_allowed_role_passes(): void
    {
        Sanctum::actingAs(User::factory()->employer()->create());

        $this->getJson('/api/_test/employer-only')->assertOk();
    }

    public function test_other_role_is_forbidden(): void
    {
        Sanctum::actingAs(User::factory()->candidate()->create());

        $this->getJson('/api/_test/employer-only')
            ->assertForbidden()
            ->assertJsonPath('error.code', 'FORBIDDEN');
    }

    public function test_any_listed_role_passes(): void
    {
        Sanctum::actingAs(User::factory()->admin()->create());

        $this->getJson('/api/_test/staff')->assertOk();
        $this->getJson('/api/_test/employer-only')->assertForbidden();
    }

    public function test_guest_gets_401_not_403(): void
    {
        $this->getJson('/api/_test/employer-only')
            ->assertUnauthorized()
            ->assertJsonPath('error.code', 'UNAUTHENTICATED');
    }
}
