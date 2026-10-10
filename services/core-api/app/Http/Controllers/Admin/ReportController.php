<?php

namespace App\Http\Controllers\Admin;

use App\Enums\ReportStatus;
use App\Http\Controllers\Controller;
use App\Http\Resources\ReportResource;
use App\Models\Report;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

/**
 * M10: review reported postings. Resolving records the decision and an optional note; closing a
 * posting or suspending an employer are separate actions.
 */
class ReportController extends Controller
{
    private const RELATIONS = ['jobPosting.employer'];

    /** Open reports oldest first (a queue); all others newest first. */
    public function index(Request $request): AnonymousResourceCollection
    {
        $filters = $request->validate([
            'status' => ['nullable', Rule::enum(ReportStatus::class)],
            'page' => ['nullable', 'integer', 'min:1'],
        ]);
        $status = $filters['status'] ?? null;

        $query = Report::query()->with(self::RELATIONS);
        if ($status) {
            $query->where('status', $status);
        }
        $status === ReportStatus::Open->value
            ? $query->oldest()->orderBy('id')
            : $query->latest()->orderByDesc('id');

        return ReportResource::collection($query->paginate(12)->withQueryString());
    }

    public function show(Report $report): ReportResource
    {
        return new ReportResource($report->load(self::RELATIONS));
    }

    /** open → dismissed | actioned, once (row lock against two admins resolving at the same time). */
    public function update(Request $request, Report $report): ReportResource
    {
        $data = $request->validate([
            'status' => ['required', Rule::in([ReportStatus::Dismissed->value, ReportStatus::Actioned->value])],
            'note' => ['nullable', 'string', 'max:1000'],
        ]);

        $report = DB::transaction(function () use ($request, $report, $data) {
            $locked = Report::query()->lockForUpdate()->findOrFail($report->id);
            if ($locked->status !== ReportStatus::Open) {
                throw ValidationException::withMessages(['status' => 'This report has already been resolved.']);
            }

            $locked->forceFill([
                'status' => $data['status'],
                'note' => $data['note'] ?? null,
                'resolved_by' => $request->user()->id,
                'resolved_at' => now(),
            ])->save();

            return $locked;
        });

        return new ReportResource($report->load(self::RELATIONS));
    }
}
