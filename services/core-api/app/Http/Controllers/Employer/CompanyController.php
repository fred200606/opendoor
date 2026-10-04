<?php

namespace App\Http\Controllers\Employer;

use App\Exceptions\ApiException;
use App\Http\Controllers\Controller;
use App\Http\Requests\Employer\CompanyRequest;
use App\Http\Resources\CompanyResource;
use App\Models\Employer;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

/** M3: the logged-in employer's own company profile. */
class CompanyController extends Controller
{
    public function show(Request $request): CompanyResource
    {
        $employer = $request->user()->employer
            ?? throw new ApiException('NOT_FOUND', 'You have not created your company profile yet.', 404);

        return new CompanyResource($employer);
    }

    /** Create or update (always 200, as in the contract – JsonResource would answer 201 on create). */
    public function update(CompanyRequest $request): JsonResponse
    {
        $user = $request->user();
        $employer = $user->employer ?? new Employer(['user_id' => $user->id]);
        $employer->user_id = $user->id;
        $employer->fill($request->safe()->except('logo'));

        if ($employer->exists) {
            // A new registration number has to be checked again; any edit after a rejection
            // puts the company back in the verification queue.
            if ($employer->isDirty(['business_reg_no', 'registry_type'])) {
                $employer->verified_at = null;
            }
            if (! $employer->isVerified()) {
                $employer->verification_rejected_reason = null;
            }
        }

        $oldLogo = null;
        if ($request->hasFile('logo')) {
            $oldLogo = $employer->logo_path;
            $employer->logo_path = $request->file('logo')->store('logos');
        }

        DB::transaction(fn () => $employer->save());
        $user->setRelation('employer', $employer = $employer->fresh());

        if ($oldLogo) {
            Storage::delete($oldLogo);
        }

        return (new CompanyResource($employer))->response()->setStatusCode(200);
    }
}
