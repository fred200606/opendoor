<?php

namespace App\Http\Controllers\Auth;

use App\Exceptions\ApiException;
use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\LoginRequest;
use App\Http\Requests\Auth\RegisterRequest;
use App\Http\Resources\UserResource;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    public const TOKEN_NAME = 'api';

    public function register(RegisterRequest $request): JsonResponse
    {
        $data = $request->validated();

        $user = new User([
            'name' => $data['name'],
            'email' => $data['email'],
            'password' => $data['password'],
        ]);
        $user->forceFill([
            'role' => $data['role'],
            'is_active' => true,
            'consented_at' => now(),
        ])->save();

        return $this->tokenResponse($user, 201);
    }

    public function login(LoginRequest $request): JsonResponse
    {
        $data = $request->validated();
        $user = User::where('email', $data['email'])->first();

        if (! $user || ! Hash::check($data['password'], $user->password)) {
            throw ValidationException::withMessages(['email' => __('auth.failed')]);
        }

        // Checked only after the password, so the response never reveals which emails exist.
        if (! $user->is_active) {
            throw new ApiException('ACCOUNT_SUSPENDED', 'Your account has been suspended. Please contact the OpenDoor administrator.', 403);
        }

        return $this->tokenResponse($user, 200);
    }

    public function logout(Request $request): Response
    {
        $request->user()->currentAccessToken()->delete();

        return response()->noContent();
    }

    private function tokenResponse(User $user, int $status): JsonResponse
    {
        return response()->json([
            'token' => $user->createToken(self::TOKEN_NAME)->plainTextToken,
            'user' => new UserResource($user),
        ], $status);
    }
}
