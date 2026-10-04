<?php

namespace App\Http\Controllers;

use App\Enums\AccommodationGroup;
use App\Http\Resources\AccommodationResource;
use App\Models\Accommodation;
use Illuminate\Http\JsonResponse;

class AccommodationController extends Controller
{
    /** Public filter options: active accommodations grouped in RA 7277 group order. */
    public function index(): JsonResponse
    {
        $byGroup = Accommodation::active()->orderBy('id')->get()
            ->groupBy(fn (Accommodation $accommodation) => $accommodation->group->value);

        $groups = collect(AccommodationGroup::cases())
            ->filter(fn (AccommodationGroup $group) => $byGroup->has($group->value))
            ->map(fn (AccommodationGroup $group) => [
                'group' => $group->value,
                'label' => $group->label(),
                'items' => AccommodationResource::collection($byGroup[$group->value]),
            ])
            ->values();

        return response()->json(['data' => $groups]);
    }
}
