<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;

/**
 * The signed-in user's own account (login, register, GET /me): the public user fields plus the
 * M13 display settings, which nobody else (admin user lists included) needs to see.
 */
class AccountResource extends UserResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            ...parent::toArray($request),
            // {text_size, contrast, motion}, or null until the user saves them once.
            'display_prefs' => $this->display_prefs,
        ];
    }
}
