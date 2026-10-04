<?php

namespace App\Http\Controllers;

use App\Exceptions\ApiException;
use App\Models\CandidateProfile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Symfony\Component\HttpFoundation\StreamedResponse;

/** Opens a résumé PDF from a temporary signed link (route middleware `signed:relative`). */
class ResumeController extends Controller
{
    public function show(CandidateProfile $candidateProfile): StreamedResponse
    {
        if (! $candidateProfile->resume_path || ! Storage::exists($candidateProfile->resume_path)) {
            throw new ApiException('NOT_FOUND', 'The requested resource was not found.', 404);
        }

        $name = 'resume-'.Str::slug($candidateProfile->user->name).'.pdf';

        return Storage::response($candidateProfile->resume_path, $name, [
            'Content-Type' => 'application/pdf',
            'Content-Disposition' => 'inline; filename="'.$name.'"',
            'Cache-Control' => 'private, no-store',
            'X-Content-Type-Options' => 'nosniff',
        ]);
    }
}
