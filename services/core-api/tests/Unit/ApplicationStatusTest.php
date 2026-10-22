<?php

namespace Tests\Unit;

use App\Enums\ApplicationStatus;
use App\Enums\UserRole;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

class ApplicationStatusTest extends TestCase
{
    /** The whole workflow (business-rules.md); every other from → to → actor is refused. */
    private const ALLOWED = [
        'pending→reviewed' => ['employer'],
        'pending→withdrawn' => ['candidate'],
        'reviewed→withdrawn' => ['candidate'],
        'reviewed→rejected' => ['employer'],
        'reviewed→shortlisted' => ['employer'],
        'reviewed→contacted' => ['employer', 'candidate'],
        'shortlisted→withdrawn' => ['candidate'],
        'shortlisted→rejected' => ['employer'],
        'shortlisted→contacted' => ['employer', 'candidate'],
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

    public function test_contacted_rejected_and_withdrawn_are_final(): void
    {
        $final = array_filter(ApplicationStatus::cases(), fn (ApplicationStatus $status) => $status->isFinal());

        $this->assertEqualsCanonicalizing([ApplicationStatus::Contacted, ApplicationStatus::Rejected, ApplicationStatus::Withdrawn], array_values($final));
    }
}
