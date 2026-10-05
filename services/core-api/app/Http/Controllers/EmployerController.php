<?php

namespace App\Http\Controllers;

use App\Exceptions\ApiException;
use App\Http\Resources\EmployerPublicResource;
use App\Http\Resources\JobPostingResource;
use App\Models\Employer;
use App\Services\TrustScoreService;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\StreamedResponse;

/** M3: public employer page and logo (served through the gateway); M7 trust score. */
class EmployerController extends Controller
{
    public function show(Employer $employer): JsonResponse
    {
        return response()->json([
            ...(new EmployerPublicResource($employer))->resolve(),
            'open_postings' => JobPostingResource::collection(
                $employer->jobPostings()->visible()->with(JobPostingController::RELATIONS)->orderBy('closes_at')->get(),
            )->resolve(),
        ]);
    }

    /** Published only from 3 responses (score and breakdown stay hidden below that). */
    public function trustScore(Employer $employer, TrustScoreService $trustScores): JsonResponse
    {
        return response()->json([
            ...$employer->trustScoreSummary(),
            'breakdown' => $trustScores->breakdown($employer),
        ]);
    }

    public function logo(Employer $employer): StreamedResponse
    {
        if (! $employer->logo_path || ! Storage::exists($employer->logo_path)) {
            throw new ApiException('NOT_FOUND', 'The requested resource was not found.', 404);
        }

        return Storage::response($employer->logo_path, null, [
            'Cache-Control' => 'public, max-age=86400',
            'X-Content-Type-Options' => 'nosniff',
        ]);
    }
}
