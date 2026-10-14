<?php

namespace App\Models;

// use Illuminate\Contracts\Auth\MustVerifyEmail;
use App\Enums\UserRole;
use App\Notifications\ResetPasswordLink;
use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

/**
 * role, is_active and consented_at are deliberately not fillable: set them
 * explicitly (forceFill) so a request can never promote itself to admin.
 */
#[Fillable(['name', 'email', 'password', 'display_prefs', 'email_notifications', 'onboarding_tour_done', 'onboarding_checklist_hidden'])]
#[Hidden(['password', 'remember_token'])]
class User extends Authenticatable
{
    /** @use HasFactory<UserFactory> */
    use HasApiTokens, HasFactory, Notifiable;

    /** @var array<string, mixed> */
    protected $attributes = [
        'is_active' => true,
        // M13: on unless the user turns them off (same default as the column).
        'email_notifications' => true,
        // A new account gets the welcome tour and the "Get started" list (same defaults as the columns).
        'onboarding_tour_done' => false,
        'onboarding_checklist_hidden' => false,
    ];

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
            'role' => UserRole::class,
            'is_active' => 'boolean',
            'consented_at' => 'datetime',
            'display_prefs' => 'array',
            'email_notifications' => 'boolean',
            'onboarding_tour_done' => 'boolean',
            'onboarding_checklist_hidden' => 'boolean',
        ];
    }

    /** @return HasOne<CandidateProfile, $this> */
    public function candidateProfile(): HasOne
    {
        return $this->hasOne(CandidateProfile::class);
    }

    /** @return HasOne<Employer, $this> */
    public function employer(): HasOne
    {
        return $this->hasOne(Employer::class);
    }

    public function hasRole(UserRole ...$roles): bool
    {
        return in_array($this->role, $roles, true);
    }

    public function isAdmin(): bool
    {
        return $this->role === UserRole::Admin;
    }

    /** Forgot password: our own email, linking to the React reset page instead of a Laravel route. */
    public function sendPasswordResetNotification(#[\SensitiveParameter] $token): void
    {
        $this->notify(new ResetPasswordLink($token));
    }
}
