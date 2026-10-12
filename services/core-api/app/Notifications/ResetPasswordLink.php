<?php

namespace App\Notifications;

use App\Notifications\Channels\SafeMailChannel;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/**
 * Forgot password email with a link to the React reset page. Email only (no in-app notice) and
 * sent regardless of the M13 email switch, as it is a security email. Sent at once from the
 * queued SendPasswordResetLink job. A mail failure is logged (SafeMailChannel).
 */
class ResetPasswordLink extends Notification
{
    public function __construct(#[\SensitiveParameter] private readonly string $token) {}

    /** @return list<string> */
    public function via(object $notifiable): array
    {
        return [SafeMailChannel::class];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $url = config('opendoor.public_app_url').'/reset-password?'.http_build_query(['token' => $this->token, 'email' => $notifiable->email]);
        $minutes = config('auth.passwords.users.expire');

        return (new MailMessage)
            ->subject('Reset your OpenDoor password')
            ->greeting("Hello {$notifiable->name},")
            ->line('We received a request to reset the password for your OpenDoor account.')
            ->action('Choose a new password', $url)
            ->line("This link works for {$minutes} minutes and only once.")
            ->line('If you did not ask for this, you can ignore this email. Your password stays the same.')
            ->salutation('– OpenDoor');
    }
}
