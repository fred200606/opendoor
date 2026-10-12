<?php

namespace App\Notifications\Channels;

use Illuminate\Mail\SentMessage;
use Illuminate\Notifications\Channels\MailChannel;
use Illuminate\Notifications\Notification;
use Illuminate\Support\Facades\Log;
use Throwable;

/**
 * The mail channel for M13 emails. A mail server problem is logged, never thrown: the in-app
 * notice already exists and the action that caused it has succeeded. The log line names the
 * user id, not the address.
 */
class SafeMailChannel extends MailChannel
{
    /**
     * @param  mixed  $notifiable
     */
    public function send($notifiable, Notification $notification): ?SentMessage
    {
        try {
            return parent::send($notifiable, $notification);
        } catch (Throwable $e) {
            Log::warning('Email notification not sent', [
                'notification' => $notification::class,
                'user_id' => $notifiable->getKey(),
                'error' => $e->getMessage(),
            ]);

            return null;
        }
    }
}
