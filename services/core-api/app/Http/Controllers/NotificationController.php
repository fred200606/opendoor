<?php

namespace App\Http\Controllers;

use App\Http\Resources\NotificationResource;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Http\Response;

/** M9: the user's own in-app notifications (Laravel database notifications). */
class NotificationController extends Controller
{
    /** Newest first, 12 per page; `meta.unread_count` counts every unread one, not just this page. */
    public function index(Request $request): AnonymousResourceCollection
    {
        $request->validate(['page' => ['nullable', 'integer', 'min:1']]);
        $user = $request->user();

        // notifications() is newest first by created_at, which has whole seconds only. Our notices
        // get time-ordered UUIDv7 ids (set in their constructors; each instance is sent to one
        // user), so the id puts notices from the same second in order too.
        return NotificationResource::collection($user->notifications()->orderByDesc('id')->paginate(12)->withQueryString())
            ->additional(['meta' => ['unread_count' => $user->unreadNotifications()->count()]]);
    }

    /** Someone else's (or an unknown) id is 404; marking a read one again keeps its first read time. */
    public function read(Request $request, string $id): Response
    {
        $notification = $request->user()->notifications()->whereKey($id)->firstOrFail();
        $notification->markAsRead();

        return response()->noContent();
    }

    public function readAll(Request $request): Response
    {
        $request->user()->unreadNotifications()->update(['read_at' => now()]);

        return response()->noContent();
    }
}
