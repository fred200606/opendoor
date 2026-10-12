<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\ForgotPasswordRequest;
use App\Http\Requests\Auth\ResetPasswordRequest;
use App\Models\User;
use Illuminate\Auth\Events\PasswordReset;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Password;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

use function Illuminate\Support\defer;

/**
 * Forgot password (user decision 2026-10-13, beyond the SIA M1 list): an emailed link (valid
 * auth.passwords.users.expire minutes) leads to the React reset page, which sets a new password.
 */
class PasswordResetController extends Controller
{
    public const LINK_SENT = 'If an account exists for this email, we sent a link to reset the password.';

    /**
     * Answers the same for every email, and only after the response looks the account up and sends
     * the link, so neither the answer nor its timing reveals which emails have an account.
     * Suspended accounts cannot log in, so they get no link. A second request within
     * auth.passwords.users.throttle seconds sends nothing new.
     */
    public function sendLink(ForgotPasswordRequest $request): JsonResponse
    {
        $email = $request->validated('email');

        defer(function () use ($email) {
            if (User::where('email', $email)->where('is_active', true)->exists()) {
                Password::broker()->sendResetLink(['email' => $email]);
            }
        });

        return response()->json(['message' => self::LINK_SENT]);
    }

    /** Sets the new password and signs the user out on every device; the link works once. */
    public function reset(ResetPasswordRequest $request): JsonResponse
    {
        $status = Password::broker()->reset(
            $request->only('email', 'password', 'password_confirmation', 'token'),
            function (User $user, string $password) {
                $user->forceFill(['password' => $password, 'remember_token' => Str::random(60)])->save();
                $user->tokens()->delete();
                event(new PasswordReset($user));
            },
        );

        // Unknown email, wrong or expired token: one message, so the form reveals no accounts either.
        if ($status !== Password::PASSWORD_RESET) {
            throw ValidationException::withMessages(['token' => 'This reset link is invalid or has expired. Ask for a new one.']);
        }

        return response()->json(['message' => 'Your password is changed. Log in with your new password.']);
    }
}
