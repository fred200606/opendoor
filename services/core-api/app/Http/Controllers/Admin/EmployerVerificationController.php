<?php

namespace App\Http\Controllers\Admin;

use App\Enums\RegistryStatus;
use App\Http\Controllers\Controller;
use App\Http\Resources\AdminEmployerResource;
use App\Http\Resources\RegistryCheckResource;
use App\Models\Employer;
use App\Models\RegistryCheck;
use App\Services\Registry\BusinessRegistryClient;
use App\Services\Registry\RegistryException;
use App\Services\Registry\RegistryResult;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Validation\Rule;

/**
 * M3 admin: employer verification queue. `check` asks the legacy SOAP registry and stores the
 * answer; only the admin's `approve` / `reject` changes the Verified badge (never automatic).
 */
class EmployerVerificationController extends Controller
{
    private const RELATIONS = ['user', 'latestRegistryCheck'];

    /** pending = neither verified nor rejected (oldest first, so nobody waits forever). */
    public function index(Request $request): AnonymousResourceCollection
    {
        $filters = $request->validate([
            'status' => ['nullable', Rule::in(['pending', 'verified', 'rejected'])],
            'q' => ['nullable', 'string', 'max:100'],
            'page' => ['nullable', 'integer', 'min:1'],
        ]);
        $status = $filters['status'] ?? 'pending';

        $query = Employer::query()->with(self::RELATIONS);
        match ($status) {
            'pending' => $query->whereNull('verified_at')->whereNull('verification_rejected_reason')->oldest('updated_at'),
            'verified' => $query->whereNotNull('verified_at')->latest('verified_at'),
            'rejected' => $query->whereNull('verified_at')->whereNotNull('verification_rejected_reason')->latest('updated_at'),
        };

        $keyword = trim($filters['q'] ?? '');
        if ($keyword !== '') {
            // '!' as LIKE escape character: works the same on MySQL and SQLite (tests).
            $like = '%'.str_replace(['!', '%', '_'], ['!!', '!%', '!_'], $keyword).'%';
            $query->where(fn (Builder $match) => $match
                ->whereRaw("company_name like ? escape '!'", [$like])
                ->orWhereRaw("business_reg_no like ? escape '!'", [$like]));
        }

        return AdminEmployerResource::collection($query->orderByDesc('id')->paginate(12)->withQueryString());
    }

    public function show(Employer $employer): AdminEmployerResource
    {
        return new AdminEmployerResource($employer->load(self::RELATIONS));
    }

    public function verify(Request $request, Employer $employer, BusinessRegistryClient $registry): JsonResponse
    {
        $data = $request->validate([
            'action' => ['required', Rule::in(['check', 'approve', 'reject'])],
            'reason' => ['required_if:action,reject', 'nullable', 'string', 'max:1000'],
        ], [
            'reason.required_if' => 'Tell the employer why the company was not approved.',
        ]);

        $check = match ($data['action']) {
            'check' => $this->check($employer, $registry, $request->user()->id),
            'approve' => $this->decide($employer, verified: true),
            'reject' => $this->decide($employer, verified: false, reason: trim($data['reason'])),
        };
        // M9: notify the employer of the decision (Phase 8).

        return response()->json([
            'registry' => $check ? (new RegistryCheckResource($check))->resolve($request) : null,
            'verified_at' => $employer->verified_at?->toIso8601String(),
        ]);
    }

    /** Stores every answer; a registry that cannot answer is stored as ERROR, then reported (502). */
    private function check(Employer $employer, BusinessRegistryClient $registry, int $adminId): RegistryCheck
    {
        try {
            $result = $registry->verify($employer->business_reg_no, $employer->registry_type, $employer->company_name);
        } catch (RegistryException $error) {
            if ($error->isUnavailable()) {
                $this->store($employer, $adminId, new RegistryResult(RegistryStatus::Error, null, null, now()->toImmutable(), $error->rawResponse));
            }
            throw $error;
        }

        return $this->store($employer, $adminId, $result);
    }

    private function store(Employer $employer, int $adminId, RegistryResult $result): RegistryCheck
    {
        $check = new RegistryCheck;
        $check->forceFill([
            'employer_id' => $employer->id,
            'business_reg_no' => $employer->business_reg_no,
            'registry_type' => $employer->registry_type,
            'status' => $result->status,
            'registered_name' => $result->registeredName,
            'name_match_score' => $result->nameMatch,
            'raw_response' => $result->rawResponse,
            'checked_by' => $adminId,
            'checked_at' => now(),
        ])->save();

        return $check;
    }

    /** reject also removes an earlier approval ("Remove verification"); the reason is shown to the employer. */
    private function decide(Employer $employer, bool $verified, ?string $reason = null): ?RegistryCheck
    {
        $employer->forceFill([
            'verified_at' => $verified ? now() : null,
            'verification_rejected_reason' => $verified ? null : $reason,
        ])->save();

        return $employer->load('latestRegistryCheck')->currentRegistryCheck();
    }
}
