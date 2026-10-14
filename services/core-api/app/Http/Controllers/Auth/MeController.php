<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\UpdateDisplayPrefsRequest;
use App\Http\Requests\Auth\UpdateEmailNotificationsRequest;
use App\Http\Requests\Auth\UpdateOnboardingRequest;
use App\Http\Requests\Auth\UpdatePasswordRequest;
use App\Http\Resources\AccountResource;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;

class MeController extends Controller
{
    public function show(Request $request): AccountResource
    {
        return new AccountResource($request->user());
    }

    public function updatePassword(UpdatePasswordRequest $request): Response
    {
        $user = $request->user();
        $user->update(['password' => $request->validated('password')]);

        // Sign out every other device; the token used for this request stays valid.
        $user->tokens()->whereKeyNot($user->currentAccessToken()->getKey())->delete();

        return response()->noContent();
    }

    /** M13: text size, colours and motion are saved with the account so they follow the user to other devices. */
    public function updateDisplayPrefs(UpdateDisplayPrefsRequest $request): JsonResponse
    {
        $prefs = $request->prefs();
        $request->user()->update(['display_prefs' => $prefs]);

        return response()->json($prefs);
    }

    /** M13: emails for the in-app notices (on by default). Admins receive no notices (route: 403). */
    public function updateEmailNotifications(UpdateEmailNotificationsRequest $request): JsonResponse
    {
        $enabled = $request->boolean('enabled');
        $request->user()->update(['email_notifications' => $enabled]);

        return response()->json(['enabled' => $enabled]);
    }

    /** Onboarding: welcome tour finished or skipped, "Get started" list hidden or shown again. Admins have none (route: 403). */
    public function updateOnboarding(UpdateOnboardingRequest $request): JsonResponse
    {
        $user = $request->user();
        $user->update($request->changes());

        return response()->json([
            'tour_done' => $user->onboarding_tour_done,
            'checklist_hidden' => $user->onboarding_checklist_hidden,
        ]);
    }
}
