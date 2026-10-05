<?php

namespace App\Http\Controllers\Candidate;

use App\Http\Controllers\Controller;
use App\Http\Requests\Candidate\ProfileRequest;
use App\Http\Resources\AccommodationResource;
use App\Http\Resources\CandidateProfileResource;
use App\Models\CandidateProfile;
use App\Rules\UsableAccommodation;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

/** M2: the logged-in candidate's own profile, needs and résumé. */
class ProfileController extends Controller
{
    /** A new candidate gets an empty profile (created on first access), never a 404. */
    public function show(Request $request): CandidateProfileResource
    {
        return new CandidateProfileResource($this->profile($request)->load('accommodations'));
    }

    public function update(ProfileRequest $request): CandidateProfileResource
    {
        $profile = $this->profile($request);
        $profile->fill($request->validated());
        // Showing the disability type only makes sense when one is given.
        if ($profile->disability_type === null) {
            $profile->show_disability = false;
        }
        $profile->save();

        return new CandidateProfileResource($profile->load('accommodations'));
    }

    /** Replaces all needs. */
    public function updateNeeds(Request $request): JsonResponse
    {
        $profile = $this->profile($request);
        $attached = $profile->accommodations()->pluck('accommodations.id')->all();

        $ids = $request->validate([
            'accommodation_ids' => ['present', 'array', 'max:30'],
            'accommodation_ids.*' => ['integer', 'distinct', new UsableAccommodation($attached)],
        ], [
            'accommodation_ids.*.distinct' => 'Each accommodation can be chosen only once.',
        ])['accommodation_ids'];

        $profile->accommodations()->sync($ids);

        return response()->json(['data' => AccommodationResource::collection($profile->accommodations()->orderBy('id')->get())]);
    }

    public function uploadResume(Request $request): JsonResponse
    {
        $request->validate(
            ['resume' => ['required', 'file', 'mimes:pdf', 'mimetypes:application/pdf', 'max:'.config('opendoor.resume_max_kb')]],
            ['resume.max' => 'The résumé must not be larger than 5 MB.', 'resume.mimes' => 'Upload your résumé as a PDF file.', 'resume.mimetypes' => 'Upload your résumé as a PDF file.'],
        );

        $profile = $this->profile($request);
        $oldPath = $profile->resume_path;
        $profile->resume_path = $request->file('resume')->store('resumes');
        $profile->save();

        if ($oldPath) {
            Storage::delete($oldPath);
        }

        return response()->json(['resume_url' => $profile->resumeUrl()]);
    }

    private function profile(Request $request): CandidateProfile
    {
        return CandidateProfile::for($request->user());
    }
}
