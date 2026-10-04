<?php

namespace App\Http\Controllers;

use App\Exceptions\ApiException;
use App\Http\Resources\EmployerPublicResource;
use App\Models\Employer;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\StreamedResponse;

/** M3: public employer page and logo (served through the gateway). */
class EmployerController extends Controller
{
    public function show(Employer $employer): JsonResponse
    {
        return response()->json([
            ...(new EmployerPublicResource($employer))->resolve(),
            // Filled in with M4 job postings (open + approved only).
            'open_postings' => [],
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
