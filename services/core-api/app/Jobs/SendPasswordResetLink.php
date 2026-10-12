<?php

namespace App\Jobs;

use App\Models\User;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Support\Facades\Password;

/**
 * Forgot password: queued for every request, whatever the email (decision 2026-10-13), so the
 * request itself does the same small work for everyone. Here the account is looked up and only an
 * active one gets a link (ResetPasswordLink); a second link within auth.passwords.users.throttle
 * seconds is not sent.
 */
class SendPasswordResetLink implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable;

    public int $tries = 3;

    public function __construct(public readonly string $email)
    {
        $this->onConnection(config('opendoor.password_reset_queue'));
    }

    public function handle(): void
    {
        if (User::where('email', $this->email)->where('is_active', true)->exists()) {
            Password::broker()->sendResetLink(['email' => $this->email]);
        }
    }
}
