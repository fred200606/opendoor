<?php

namespace App\Providers;

use App\Services\Registry\BusinessRegistryClient;
use App\Support\PublicUrl;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Pagination\Paginator;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        // Legacy SOAP registry (Phase 6); tests swap it with $this->app->instance(...).
        $this->app->bind(BusinessRegistryClient::class, fn () => new BusinessRegistryClient(config('services.registry')));
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        // Single resources are returned bare (e.g. GET /me → User); paginated lists keep { data, meta }.
        JsonResource::withoutWrapping();

        // Page links (meta.path, links.next…) point at the gateway, never at Core's internal host.
        Paginator::currentPathResolver(fn () => PublicUrl::path($this->app['request']->path()));

        // 5 login attempts per minute per email + IP → 429 RATE_LIMITED with Retry-After.
        RateLimiter::for('login', fn (Request $request) => Limit::perMinute(5)->by(
            mb_strtolower((string) $request->input('email')).'|'.$request->ip(),
        ));

        // Forgot / reset password: the same limit, counted separately from logins.
        RateLimiter::for('password-reset', fn (Request $request) => Limit::perMinute(5)->by(
            'reset|'.mb_strtolower((string) $request->input('email')).'|'.$request->ip(),
        ));
    }
}
