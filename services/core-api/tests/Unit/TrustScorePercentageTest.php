<?php

namespace Tests\Unit;

use App\Services\TrustScoreService;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

/** Whole-% trust score: delivered = 1, partial = 0.5, not delivered = 0; half away from zero. */
class TrustScorePercentageTest extends TestCase
{
    /** @return iterable<string, array{int, int, int|null}> [half points, rated items, expected %] */
    public static function cases(): iterable
    {
        yield 'nothing rated' => [0, 0, null];
        yield 'all delivered' => [10, 5, 100];
        yield 'none delivered' => [0, 5, 0];
        yield 'one partial' => [1, 1, 50];
        yield '2.5 of 4 = 62.5 rounds up' => [5, 4, 63];
        yield '1.5 of 3 = 50' => [3, 3, 50];
        yield '4 of 6 = 66.67' => [8, 6, 67];
        yield '1 of 3 = 33.33' => [2, 3, 33];
        yield '5.5 of 8 = 68.75' => [11, 8, 69];
        yield '0.5 of 8 = 6.25' => [1, 8, 6];
        yield '0.5 of 200 = 0.25' => [1, 200, 0];
        yield '0.5 of 100 = 0.5 rounds up' => [1, 100, 1];
    }

    #[DataProvider('cases')]
    public function test_percentage(int $halfPoints, int $rated, ?int $expected): void
    {
        $this->assertSame($expected, TrustScoreService::percentage($halfPoints, $rated));
        if ($rated > 0) {
            $this->assertSame((int) round($halfPoints / 2 / $rated * 100), $expected, 'Matches PHP round()');
        }
    }
}
