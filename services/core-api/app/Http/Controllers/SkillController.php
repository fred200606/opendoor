<?php

namespace App\Http\Controllers;

use App\Models\Skill;
use Illuminate\Http\JsonResponse;

class SkillController extends Controller
{
    /** Public: the shared skills list with other spellings, for the skill pickers (Decision 2026-10-21). */
    public function index(): JsonResponse
    {
        return response()->json([
            // Sorted here, ignoring case: SQLite (tests) and MySQL order "CSS" and "Canva" differently.
            'data' => Skill::query()->get()->sortBy('name', SORT_NATURAL | SORT_FLAG_CASE)->values()
                ->map(fn (Skill $skill) => ['id' => $skill->id, 'name' => $skill->name, 'aliases' => $skill->aliases ?? []]),
        ]);
    }
}
