<?php

namespace Tests\Feature;

use App\Exceptions\ApiException;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Exceptions\ThrottleRequestsException;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Str;
use RuntimeException;
use Tests\TestCase;

class ErrorEnvelopeTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        Route::prefix('api/_test')->group(function () {
            Route::get('ok', fn () => ['ok' => true]);
            Route::post('validate', fn (Request $request) => $request->validate(['email' => 'required|email']));
            Route::get('business', fn () => throw new ApiException('ALREADY_APPLIED', 'You have already applied to this posting.', 409));
            Route::get('forbidden', fn () => abort(403));
            Route::get('model', fn () => User::findOrFail(999));
            Route::get('throttled', fn () => throw new ThrottleRequestsException('Too Many Attempts.', null, ['Retry-After' => 60]));
            Route::get('crash', fn () => throw new RuntimeException('secret internal detail'));
        });
    }

    private function assertEnvelope($response, int $status, string $code): void
    {
        $response->assertStatus($status)
            ->assertJsonStructure(['error' => ['code', 'message', 'request_id']])
            ->assertJsonPath('error.code', $code);

        $requestId = $response->json('error.request_id');
        $this->assertTrue(Str::isUuid($requestId));
        $response->assertHeader('X-Request-ID', $requestId);
    }

    public function test_success_response_carries_a_request_id(): void
    {
        $response = $this->getJson('/api/_test/ok')->assertOk();

        $this->assertTrue(Str::isUuid($response->headers->get('X-Request-ID')));
    }

    public function test_incoming_request_id_from_gateway_is_reused(): void
    {
        $id = (string) Str::uuid();

        $this->getJson('/api/_test/forbidden', ['X-Request-ID' => $id])
            ->assertHeader('X-Request-ID', $id)
            ->assertJsonPath('error.request_id', $id);
    }

    public function test_invalid_incoming_request_id_is_replaced(): void
    {
        $response = $this->getJson('/api/_test/ok', ['X-Request-ID' => 'not-a-uuid']);

        $this->assertNotSame('not-a-uuid', $response->headers->get('X-Request-ID'));
        $this->assertTrue(Str::isUuid($response->headers->get('X-Request-ID')));
    }

    public function test_unknown_route_returns_not_found_envelope(): void
    {
        $response = $this->get('/api/does-not-exist');

        $this->assertEnvelope($response, 404, 'NOT_FOUND');
        $response->assertJsonPath('error.message', 'The requested resource was not found.');
    }

    public function test_missing_model_does_not_leak_model_name(): void
    {
        $response = $this->getJson('/api/_test/model');

        $this->assertEnvelope($response, 404, 'NOT_FOUND');
        $this->assertStringNotContainsString('User', $response->getContent());
    }

    public function test_unauthenticated_request_returns_401_envelope(): void
    {
        $this->assertEnvelope($this->getJson('/api/user'), 401, 'UNAUTHENTICATED');
    }

    public function test_forbidden_returns_403_envelope(): void
    {
        $this->assertEnvelope($this->getJson('/api/_test/forbidden'), 403, 'FORBIDDEN');
    }

    public function test_business_error_uses_its_own_code_and_status(): void
    {
        $response = $this->getJson('/api/_test/business');

        $this->assertEnvelope($response, 409, 'ALREADY_APPLIED');
        $response->assertJsonPath('error.message', 'You have already applied to this posting.');
    }

    public function test_validation_error_keeps_laravel_format_plus_envelope(): void
    {
        $response = $this->postJson('/api/_test/validate', ['email' => 'nope']);

        $response->assertStatus(422)
            ->assertJsonPath('message', 'The given data was invalid.')
            ->assertJsonPath('error.code', 'VALIDATION_FAILED')
            ->assertJsonStructure(['error' => ['request_id'], 'errors' => ['email']]);
        $response->assertHeader('X-Request-ID', $response->json('error.request_id'));
    }

    public function test_rate_limit_returns_429_with_retry_after(): void
    {
        $response = $this->getJson('/api/_test/throttled');

        $this->assertEnvelope($response, 429, 'RATE_LIMITED');
        $response->assertHeader('Retry-After', '60');
    }

    public function test_unexpected_error_hides_details_even_in_debug_mode(): void
    {
        config(['app.debug' => true]);

        $response = $this->getJson('/api/_test/crash');

        $this->assertEnvelope($response, 500, 'SERVER_ERROR');
        $response->assertJsonMissingPath('trace')->assertJsonMissingPath('exception');
        $this->assertStringNotContainsString('secret internal detail', $response->getContent());
    }
}
