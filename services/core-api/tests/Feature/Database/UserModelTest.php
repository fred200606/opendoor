<?php

namespace Tests\Feature\Database;

use App\Enums\UserRole;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class UserModelTest extends TestCase
{
    use RefreshDatabase;

    public function test_role_and_status_fields_are_not_mass_assignable(): void
    {
        $user = new User([
            'name' => 'Mallory',
            'email' => 'mallory@example.com',
            'password' => 'secret-password',
            'role' => 'admin',
            'is_active' => false,
            'consented_at' => now(),
        ]);

        $this->assertNull($user->role);
        $this->assertTrue($user->is_active); // model default, not the requested false
        $this->assertNull($user->consented_at);
    }

    public function test_attributes_are_cast(): void
    {
        $user = User::factory()->employer()->create(['display_prefs' => ['font_scale' => 1.25]]);
        $user->refresh();

        $this->assertSame(UserRole::Employer, $user->role);
        $this->assertTrue($user->is_active);
        $this->assertSame(['font_scale' => 1.25], $user->display_prefs);
        $this->assertTrue($user->hasRole(UserRole::Employer, UserRole::Admin));
        $this->assertFalse($user->hasRole(UserRole::Candidate));
    }

    public function test_password_is_hidden_from_json(): void
    {
        $json = User::factory()->create()->toArray();

        $this->assertArrayNotHasKey('password', $json);
        $this->assertArrayNotHasKey('remember_token', $json);
    }
}
