<?php

namespace Tests\Feature\Registry;

use App\Enums\RegistryStatus;
use App\Models\Employer;
use App\Models\RegistryCheck;
use App\Models\User;
use App\Services\Registry\BusinessRegistryClient;
use App\Services\Registry\RegistryException;
use App\Services\Registry\RegistryResult;
use Carbon\CarbonImmutable;
use Closure;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Testing\TestResponse;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/** M3 admin verification: the queue, SOAP registry checks (faked) and the admin's decision. */
class EmployerVerificationTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;

    /** @var list<array{string, string, string}> calls the fake registry received */
    private array $calls = [];

    protected function setUp(): void
    {
        parent::setUp();

        $this->admin = User::factory()->admin()->create();
        Sanctum::actingAs($this->admin);
    }

    /** @param  Closure(): RegistryResult  $answer  returns a result or throws a RegistryException */
    private function fakeRegistry(Closure $answer): void
    {
        $calls = &$this->calls;
        $this->app->instance(BusinessRegistryClient::class, new class($answer, $calls) extends BusinessRegistryClient
        {
            public function __construct(private Closure $answer, private array &$calls)
            {
                parent::__construct(['wsdl' => '', 'user' => 'u', 'password' => 'p', 'timeout' => 5]);
            }

            public function verify(string $registrationNumber, string $registryType, string $businessName): RegistryResult
            {
                $this->calls[] = [$registrationNumber, $registryType, $businessName];

                return ($this->answer)();
            }
        });
    }

    private static function active(?float $match = 0.96): Closure
    {
        return fn () => new RegistryResult(RegistryStatus::Active, 'KALINGA FOODS, INC.', $match, CarbonImmutable::parse('2026-10-02T10:02:11+08:00'), '<xml>answer</xml>');
    }

    private function verify(Employer $employer, array $body): TestResponse
    {
        return $this->patchJson("/api/admin/employers/{$employer->id}/verify", $body);
    }

    public function test_the_queue_lists_pending_employers_oldest_first(): void
    {
        $newer = Employer::factory()->create(['company_name' => 'Newer Co', 'updated_at' => now()->subDay()]);
        $older = Employer::factory()->create(['company_name' => 'Older Co', 'updated_at' => now()->subWeek()]);
        $verified = Employer::factory()->verified()->create(['company_name' => 'Verified Co']);
        $rejected = Employer::factory()->rejected('Not in the registry.')->create(['company_name' => 'Rejected Co']);

        $this->getJson('/api/admin/employers')->assertOk()->assertJsonPath('data.*.id', [$older->id, $newer->id]);
        $this->getJson('/api/admin/employers?status=verified')->assertJsonPath('data.*.id', [$verified->id]);
        $this->getJson('/api/admin/employers?status=rejected')
            ->assertJsonPath('data.*.id', [$rejected->id])
            ->assertJsonPath('data.0.verification_rejected_reason', 'Not in the registry.');
        $this->getJson('/api/admin/employers?status=everything')->assertUnprocessable()->assertJsonValidationErrors(['status']);
    }

    public function test_the_queue_searches_name_and_registration_number(): void
    {
        $kalinga = Employer::factory()->create(['company_name' => 'Kalinga Foods Inc.', 'registry_type' => 'SEC', 'business_reg_no' => 'CS201912345']);
        Employer::factory()->create(['company_name' => 'Bayanihan Tech', 'registry_type' => 'DTI', 'business_reg_no' => '3456789']);
        Employer::factory()->create(['company_name' => '100% Accessible', 'registry_type' => 'DTI', 'business_reg_no' => '1112223']);

        $this->getJson('/api/admin/employers?q=kalinga')->assertJsonPath('data.*.id', [$kalinga->id]);
        $this->getJson('/api/admin/employers?q=2019')->assertJsonPath('data.*.id', [$kalinga->id]);
        $this->getJson('/api/admin/employers?q=%25')->assertJsonCount(1, 'data')->assertJsonPath('data.0.company_name', '100% Accessible');
    }

    public function test_one_employer_has_the_owner_and_the_latest_check_for_the_number_on_file(): void
    {
        $employer = Employer::factory()->create(['registry_type' => 'SEC', 'business_reg_no' => 'CS201912345']);
        $employer->user->update(['name' => 'Ramon Villanueva', 'email' => 'ramon@example.test']);
        $this->fakeRegistry(self::active());
        $this->verify($employer, ['action' => 'check'])->assertOk();

        $this->getJson("/api/admin/employers/{$employer->id}")
            ->assertOk()
            ->assertJsonPath('owner', ['id' => $employer->user->id, 'name' => 'Ramon Villanueva', 'email' => 'ramon@example.test'])
            ->assertJsonPath('business_reg_no', 'CS201912345')
            ->assertJsonPath('latest_registry_check.status', 'ACTIVE')
            ->assertJsonPath('latest_registry_check.name_match', 0.96);

        // The employer changes the number: the old check no longer applies.
        $employer->update(['business_reg_no' => 'CS202000001']);
        $this->getJson("/api/admin/employers/{$employer->id}")->assertJsonPath('latest_registry_check', null);
        $this->getJson('/api/admin/employers/999999')->assertNotFound()->assertJsonPath('error.code', 'NOT_FOUND');
    }

    public function test_a_check_stores_the_answer_and_never_approves(): void
    {
        $employer = Employer::factory()->create(['company_name' => 'Kalinga Foods Inc.', 'registry_type' => 'SEC', 'business_reg_no' => 'CS201912345']);
        $this->fakeRegistry(self::active(0.72));

        $this->verify($employer, ['action' => 'check'])
            ->assertOk()
            ->assertExactJson([
                'registry' => ['status' => 'ACTIVE', 'registered_name' => 'KALINGA FOODS, INC.', 'name_match' => 0.72, 'checked_at' => RegistryCheck::sole()->checked_at->toIso8601String()],
                'verified_at' => null,
            ]);

        $this->assertSame([['CS201912345', 'SEC', 'Kalinga Foods Inc.']], $this->calls);
        $check = RegistryCheck::sole();
        $this->assertSame([$employer->id, $this->admin->id, 'CS201912345', 'SEC', '<xml>answer</xml>'], [$check->employer_id, $check->checked_by, $check->business_reg_no, $check->registry_type, $check->raw_response]);
        $this->assertNull($employer->fresh()->verified_at);
    }

    public function test_an_unavailable_registry_is_stored_as_error_and_reported(): void
    {
        $employer = Employer::factory()->create();
        $this->fakeRegistry(fn () => throw RegistryException::unavailable('<fault/>'));

        $this->verify($employer, ['action' => 'check'])
            ->assertStatus(502)
            ->assertJsonPath('error.code', 'REGISTRY_UNAVAILABLE');

        $check = RegistryCheck::sole();
        $this->assertSame([RegistryStatus::Error, '<fault/>', null], [$check->status, $check->raw_response, $check->name_match_score]);
        $this->getJson("/api/admin/employers/{$employer->id}")->assertJsonPath('latest_registry_check.status', 'ERROR');
    }

    public function test_credential_and_input_problems_are_reported_without_a_stored_check(): void
    {
        $employer = Employer::factory()->create();

        $this->fakeRegistry(fn () => throw RegistryException::authFailed());
        $this->verify($employer, ['action' => 'check'])->assertStatus(502)->assertJsonPath('error.code', 'REGISTRY_AUTH_FAILED');

        $this->fakeRegistry(fn () => throw RegistryException::invalidRequest('RegistrationNumber is required and must be 5-20 letters or digits'));
        $this->verify($employer, ['action' => 'check'])
            ->assertUnprocessable()
            ->assertJsonPath('error.code', 'REGISTRY_INVALID_REQUEST')
            ->assertJsonPath('error.message', 'The business registry rejected the registration details: RegistrationNumber is required and must be 5-20 letters or digits');

        $this->assertSame(0, RegistryCheck::count());
    }

    public function test_approve_and_reject_are_the_admins_decision(): void
    {
        $employer = Employer::factory()->rejected('Old reason.')->create();
        $this->fakeRegistry(self::active());
        $this->verify($employer, ['action' => 'check']);

        $approved = $this->verify($employer, ['action' => 'approve'])->assertOk()->assertJsonPath('registry.status', 'ACTIVE');
        $employer->refresh();
        $this->assertNotNull($employer->verified_at);
        $this->assertNull($employer->verification_rejected_reason);
        $approved->assertJsonPath('verified_at', $employer->verified_at->toIso8601String());
        $this->getJson("/api/employers/{$employer->id}")->assertJsonPath('verified', true);

        // "Remove verification": reject needs a reason, which the employer sees.
        $this->verify($employer, ['action' => 'reject'])->assertUnprocessable()
            ->assertJsonValidationErrors(['reason' => 'Tell the employer why the company was not approved.']);
        $this->verify($employer, ['action' => 'reject', 'reason' => '  The registration has expired.  '])
            ->assertOk()->assertJsonPath('verified_at', null);
        $employer->refresh();
        $this->assertNull($employer->verified_at);
        $this->assertSame('The registration has expired.', $employer->verification_rejected_reason);

        Sanctum::actingAs($employer->user);
        $this->getJson('/api/employer/company')->assertJsonPath('verification_rejected_reason', 'The registration has expired.');
    }

    public function test_only_admins_may_verify(): void
    {
        $employer = Employer::factory()->create();
        $this->fakeRegistry(self::active());

        Sanctum::actingAs($employer->user);
        $this->verify($employer, ['action' => 'approve'])->assertForbidden();
        $this->getJson('/api/admin/employers')->assertForbidden();
        Sanctum::actingAs(User::factory()->candidate()->create());
        $this->getJson("/api/admin/employers/{$employer->id}")->assertForbidden();

        $this->assertSame([], $this->calls);
        $this->assertNull($employer->fresh()->verified_at);
        $this->verify($employer, ['action' => 'publish'])->assertForbidden();
    }

    public function test_unknown_actions_are_refused(): void
    {
        $this->verify(Employer::factory()->create(), ['action' => 'publish'])->assertUnprocessable()->assertJsonValidationErrors(['action']);
    }
}
