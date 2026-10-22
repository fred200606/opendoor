<?php

namespace Tests\Unit;

use App\Enums\ApplicationStatus;
use App\Enums\UserRole;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

class ApplicationStatusTest extends TestCase
{
    /**
     * The whole workflow (business-rules.md, Decision 2026-10-22b); every other from → to → actor
     * is refused. Nobody moves an application to hired here: that takes a confirmed hiring report.
     */
    private const ALLOWED = [
        'pending→reviewed' => ['employer'],
        'pending→shortlisted' => ['employer'],
        'pending→contacted' => ['employer'],
        'reviewed→shortlisted' => ['employer'],
        'reviewed→contacted' => ['employer'],
        'shortlisted→contacted' => ['employer'],
        'reviewed→rejected' => ['employer'],
        'shortlisted→rejected' => ['employer'],
        'contacted→rejected' => ['employer'],
        'pending→withdrawn' => ['candidate'],
        'reviewed→withdrawn' => ['candidate'],
        'shortlisted→withdrawn' => ['candidate'],
        'contacted→withdrawn' => ['candidate'],
    ];

    /** @return iterable<string, array{ApplicationStatus, ApplicationStatus, UserRole, bool}> */
    public static function everyTransition(): iterable
    {
        foreach (ApplicationStatus::cases() as $from) {
            foreach (ApplicationStatus::cases() as $to) {
                foreach (UserRole::cases() as $actor) {
                    $key = "{$from->value}→{$to->value}";
                    yield "{$key} by {$actor->value}" => [$from, $to, $actor, in_array($actor->value, self::ALLOWED[$key] ?? [], true)];
                }
            }
        }
    }

    #[DataProvider('everyTransition')]
    public function test_transition_rules(ApplicationStatus $from, ApplicationStatus $to, UserRole $actor, bool $allowed): void
    {
        $this->assertSame($allowed, $from->canTransitionTo($to, $actor));
    }

    public function test_hired_rejected_and_withdrawn_are_final(): void
    {
        $final = array_filter(ApplicationStatus::cases(), fn (ApplicationStatus $status) => $status->isFinal());

        $this->assertEqualsCanonicalizing([ApplicationStatus::Hired, ApplicationStatus::Rejected, ApplicationStatus::Withdrawn], array_values($final));
    }

    public function test_in_progress_stages_are_the_ones_a_hire_can_be_reported_for(): void
    {
        $this->assertSame(
            [ApplicationStatus::Pending, ApplicationStatus::Reviewed, ApplicationStatus::Shortlisted, ApplicationStatus::Contacted],
            ApplicationStatus::inProgress(),
        );
    }
}
