<?php

namespace Tests\Feature\Auth;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/** Onboarding for first-time users: welcome tour and "Get started" list, remembered on the account. */
class OnboardingTest extends TestCase
{
    use RefreshDatabase;

    private const FRESH = ['tour_done' => false, 'checklist_hidden' => false];

    public function test_a_new_job_seeker_or_employer_starts_with_the_tour_and_the_list(): void
    {
        foreach (['candidate', 'employer'] as $role) {
            $response = $this->postJson('/api/register', [
                'name' => 'New '.$role,
                'email' => "new-{$role}@example.test",
                'password' => 'secret-pass-1',
                'password_confirmation' => 'secret-pass-1',
                'role' => $role,
                'consent' => true,
            ])->assertCreated()->assertJsonPath('user.onboarding', self::FRESH);

            $this->withToken($response->json('token'))->getJson('/api/me')->assertOk()->assertJsonPath('onboarding', self::FRESH);
            $this->app['auth']->forgetGuards();
        }
    }

    public function test_the_tour_and_the_list_are_saved_separately_and_follow_the_account(): void
    {
        $user = User::factory()->employer()->create();
        Sanctum::actingAs($user);

        $this->patchJson('/api/me/onboarding', ['tour_done' => true])
            ->assertOk()
            ->assertExactJson(['tour_done' => true, 'checklist_hidden' => false]);
        $this->patchJson('/api/me/onboarding', ['checklist_hidden' => true])
            ->assertOk()
            ->assertExactJson(['tour_done' => true, 'checklist_hidden' => true]);
        $this->getJson('/api/me')->assertJsonPath('onboarding', ['tour_done' => true, 'checklist_hidden' => true]);

        // "Show the list again" in Account settings.
        $this->patchJson('/api/me/onboarding', ['checklist_hidden' => false])
            ->assertOk()
            ->assertExactJson(['tour_done' => true, 'checklist_hidden' => false]);

        $this->app['auth']->forgetGuards();
        $this->postJson('/api/login', ['email' => $user->email, 'password' => 'password'])
            ->assertOk()
            ->assertJsonPath('user.onboarding', ['tour_done' => true, 'checklist_hidden' => false]);
    }

    public function test_only_the_own_account_changes(): void
    {
        $other = User::factory()->candidate()->create();
        Sanctum::actingAs(User::factory()->candidate()->create());

        $this->patchJson('/api/me/onboarding', ['tour_done' => true, 'checklist_hidden' => true])->assertOk();

        $this->assertFalse($other->fresh()->onboarding_tour_done);
        $this->assertFalse($other->fresh()->onboarding_checklist_hidden);
    }

    public function test_admins_have_no_onboarding_and_user_lists_do_not_show_it(): void
    {
        User::factory()->candidate()->create();
        Sanctum::actingAs(User::factory()->admin()->create());

        $this->getJson('/api/me')->assertOk()->assertJsonPath('onboarding', null);
        $this->patchJson('/api/me/onboarding', ['tour_done' => true])
            ->assertForbidden()
            ->assertJsonPath('error.code', 'FORBIDDEN');
        $this->getJson('/api/admin/users')->assertOk()->assertJsonMissingPath('data.0.onboarding');
    }

    public function test_at_least_one_true_or_false_is_required(): void
    {
        $this->patchJson('/api/me/onboarding', ['tour_done' => true])->assertUnauthorized();

        Sanctum::actingAs($user = User::factory()->candidate()->create());

        $this->patchJson('/api/me/onboarding', [])
            ->assertUnprocessable()
            ->assertJsonPath('error.code', 'VALIDATION_FAILED')
            ->assertJsonValidationErrors(['tour_done', 'checklist_hidden']);
        $this->patchJson('/api/me/onboarding', ['tour_done' => 'later', 'checklist_hidden' => null])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['tour_done', 'checklist_hidden']);

        $this->assertFalse($user->fresh()->onboarding_tour_done);
    }
}
