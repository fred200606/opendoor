<?php

namespace App\Http\Controllers;

use App\Http\Resources\CategoryResource;
use App\Models\Category;
use Illuminate\Http\JsonResponse;

class CategoryController extends Controller
{
    /** Public filter options. */
    public function index(): JsonResponse
    {
        return response()->json([
            'data' => CategoryResource::collection(Category::orderBy('name')->get()),
        ]);
    }
}
