<?php

namespace App\Http\Controllers\Admin;

use App\Enums\UserRole;
use App\Http\Controllers\Controller;
use App\Http\Resources\UserResource;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

/** M10: user accounts – list, suspend and reactivate. */
class UserController extends Controller
{
    /** Sorted by name; `role` and `q` (name or email) filter. */
    public function index(Request $request): AnonymousResourceCollection
    {
        $filters = $request->validate([
            'role' => ['nullable', Rule::enum(UserRole::class)],
            'q' => ['nullable', 'string', 'max:100'],
            'page' => ['nullable', 'integer', 'min:1'],
        ]);

        $query = User::query();
        if (! empty($filters['role'])) {
            $query->where('role', $filters['role']);
        }

        $keyword = trim($filters['q'] ?? '');
        if ($keyword !== '') {
            // '!' as LIKE escape character: works the same on MySQL and SQLite (tests).
            $like = '%'.str_replace(['!', '%', '_'], ['!!', '!%', '!_'], $keyword).'%';
            $query->where(fn (Builder $match) => $match
                ->whereRaw("name like ? escape '!'", [$like])
                ->orWhereRaw("email like ? escape '!'", [$like]));
        }

        return UserResource::collection($query->orderBy('name')->orderBy('id')->paginate(12)->withQueryString());
    }

    /**
     * Suspending signs the user out everywhere (all tokens revoked); login is refused until the
     * account is reactivated. Admins cannot suspend themselves.
     */
    public function suspend(Request $request, User $user): UserResource
    {
        $data = $request->validate(['suspended' => ['required', 'boolean']]);

        if ($user->is($request->user())) {
            throw ValidationException::withMessages(['suspended' => 'You cannot suspend your own account.']);
        }

        DB::transaction(function () use ($user, $data) {
            $user->forceFill(['is_active' => ! $data['suspended']])->save();
            if ($data['suspended']) {
                $user->tokens()->delete();
            }
        });

        return new UserResource($user);
    }
}
