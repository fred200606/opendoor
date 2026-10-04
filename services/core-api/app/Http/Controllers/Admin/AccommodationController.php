<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\AccommodationRequest;
use App\Http\Resources\AccommodationResource;
use App\Models\Accommodation;
use App\Support\ForeignKeys;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Response;

class AccommodationController extends Controller
{
    /** All accommodation types including retired ones, so admins can restore them. */
    public function index(): JsonResponse
    {
        $accommodations = Accommodation::orderBy('id')->get();

        return response()->json(['data' => AccommodationResource::collection($accommodations)]);
    }

    public function store(AccommodationRequest $request): JsonResponse
    {
        $accommodation = Accommodation::create($request->validated());

        return (new AccommodationResource($accommodation))->response()->setStatusCode(201);
    }

    public function update(AccommodationRequest $request, Accommodation $accommodation): AccommodationResource
    {
        $accommodation->update($request->validated());

        return new AccommodationResource($accommodation);
    }

    /** Deletes an unused type; one still linked to postings, needs or feedback is retired instead. */
    public function destroy(Accommodation $accommodation): Response|AccommodationResource
    {
        if (ForeignKeys::deleteUnlessReferenced(fn () => $accommodation->delete())) {
            return response()->noContent();
        }

        $accommodation->update(['is_retired' => true]);

        return new AccommodationResource($accommodation);
    }
}
