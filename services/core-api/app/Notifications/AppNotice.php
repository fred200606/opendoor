<?php

namespace App\Notifications;

use App\Notifications\Channels\SafeMailChannel;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;
use Illuminate\Support\Str;

/**
 * M9 in-app notice, also sent as an email (M13) unless the user turned emails off.
 *
 * The in-app notice is stored at once (`sync`); the email is sent after the HTTP response
 * (`deferred`) through SafeMailChannel, so a slow or failing mail server never delays or breaks
 * the action. The email repeats `data.message` with a link to `data.url` – no disability or
 * needs details.
 */
abstract class AppNotice extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct()
    {
        $this->id = (string) Str::uuid7(); // time-ordered: see NotificationController::index
    }

    abstract protected function subject(object $notifiable): string;

    /** @return list<string> */
    public function via(object $notifiable): array
    {
        return $notifiable->email_notifications && $notifiable->is_active ? ['database', SafeMailChannel::class] : ['database'];
    }

    /** @return array<string, string> */
    public function viaConnections(): array
    {
        return ['database' => 'sync', SafeMailChannel::class => 'deferred'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $data = $this->toArray($notifiable);
        $app = config('opendoor.public_app_url');

        return (new MailMessage)
            ->subject($this->subject($notifiable))
            ->greeting("Hello {$notifiable->name},")
            ->line($data['message'])
            ->action('Open in OpenDoor', $app.$data['url'])
            ->line("You get these emails because email notifications are on for your OpenDoor account. You can turn them off in [Account settings]({$app}/account).")
            ->salutation('– OpenDoor');
    }

    /**
     * @return array<string, mixed>
     */
    abstract public function toArray(object $notifiable): array;
}
