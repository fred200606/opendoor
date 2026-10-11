<?php

namespace Tests\Feature\Auth;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/** M13 display settings saved with the account. */
class DisplayPrefsTest extends TestCase
{
    use RefreshDatabase;

    private const PREFS = ['text_size' => '150', 'contrast' => 'high', 'motion' => 'reduce'];

    public function test_any_role_saves_its_settings_and_gets_them_back_on_me_and_login(): void
    {
        foreach (['candidate', 'employer', 'admin'] as $role) {
            $user = User::factory()->{$role}()->create();
            Sanctum::actingAs($user);

            $this->putJson('/api/me/display-prefs', self::PREFS)->assertOk()->assertExactJson(self::PREFS);
            $this->getJson('/api/me')->assertOk()->assertJsonPath('display_prefs', self::PREFS);
        }

        $this->app['auth']->forgetGuards();
        $this->postJson('/api/login', ['email' => $user->email, 'password' => 'password'])
            ->assertOk()
            ->assertJsonPath('user.display_prefs', self::PREFS);
    }

    public function test_settings_are_null_until_saved_and_only_the_own_account_changes(): void
    {
        $user = User::factory()->candidate()->create();
        $other = User::factory()->candidate()->create(['display_prefs' => ['text_size' => '125', 'contrast' => 'normal', 'motion' => 'normal']]);
        Sanctum::actingAs($user);

        $this->getJson('/api/me')->assertJsonPath('display_prefs', null);
        $this->putJson('/api/me/display-prefs', self::PREFS)->assertOk();

        $this->assertSame('125', $other->fresh()->display_prefs['text_size']);
    }

    public function test_admin_user_lists_do_not_show_display_settings(): void
    {
        User::factory()->candidate()->create(['display_prefs' => self::PREFS]);
        Sanctum::actingAs(User::factory()->admin()->create());

        $this->getJson('/api/admin/users')->assertOk()->assertJsonMissingPath('data.0.display_prefs');
    }

    public function test_unknown_or_missing_values_are_refused(): void
    {
        Sanctum::actingAs($user = User::factory()->employer()->create());

        $this->putJson('/api/me/display-prefs', ['text_size' => '200', 'contrast' => 'dark'])
            ->assertUnprocessable()
            ->assertJsonPath('error.code', 'VALIDATION_FAILED')
            ->assertJsonValidationErrors(['text_size', 'contrast', 'motion']);
        $this->assertNull($user->fresh()->display_prefs);
    }

    public function test_guests_cannot_save_settings(): void
    {
        $this->putJson('/api/me/display-prefs', self::PREFS)->assertUnauthorized();
    }
}
