<?php

namespace App\Http\Resources;

use App\Enums\UserRole;
use Illuminate\Http\Request;

/**
 * The signed-in user's own account (login, register, GET /me): the public user fields plus the
 * M13 display settings and email switch and the onboarding state, which nobody else (admin user
 * lists included) needs to see.
 */
class AccountResource extends UserResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $prefs = $this->display_prefs;

        return [
            ...parent::toArray($request),
            // {text_size, contrast, motion}, or null until the user saves them once. Built key by
            // key: MySQL's JSON column returns the keys in its own order.
            'display_prefs' => $prefs === null ? null : [
                'text_size' => $prefs['text_size'],
                'contrast' => $prefs['contrast'],
                'motion' => $prefs['motion'],
            ],
            'email_notifications' => (bool) $this->email_notifications,
            // Welcome tour and "Get started" list for job seekers and employers; admins have none.
            'onboarding' => $this->role === UserRole::Admin ? null : [
                'tour_done' => (bool) $this->onboarding_tour_done,
                'checklist_hidden' => (bool) $this->onboarding_checklist_hidden,
            ],
        ];
    }
}
