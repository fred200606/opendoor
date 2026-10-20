<?php

namespace App\Services;

use App\Enums\UserRole;
use App\Enums\WorkSetup;
use App\Models\Accommodation;
use App\Models\CandidateProfile;
use App\Models\JobPosting;
use App\Models\User;
use Illuminate\Database\Eloquent\Collection;

/**
 * Job matching (Decision 2026-10-21, replaces M5's needs-only "Matches my needs"): one score from
 * 0 to 100 for how well a posting fits a candidate, from five parts with these weights:
 *
 *   skills 40          the posting's skills the candidate has
 *   location 20        remote or same city 1, same province 0.6, same region 0.3, else 0
 *   qualifications 15  minimum education and years of experience met
 *   preferences 10     work setup and employment type the candidate prefers
 *   needs 15           the candidate's accommodation needs the posting offers (only with needs)
 *
 * A part without data on either side (no skills listed, no place, nothing required, no needs) is
 * left out and the others are re-weighted. Accommodation needs are used, never the disability
 * type (RA 10173).
 */
final class MatchingService
{
    public const WEIGHTS = ['skills' => 40, 'location' => 20, 'qualifications' => 15, 'preferences' => 10, 'needs' => 15];

    /** Lowest score for each label, best first. */
    public const LABELS = ['strong' => 80, 'good' => 60, 'fair' => 40, 'low' => 0];

    public const LOCATION_TIERS = ['same_city' => 1.0, 'same_province' => 0.6, 'same_region' => 0.3, 'farther' => 0.0];

    /** Kilometres per degree of latitude. */
    private const KM_PER_DEGREE = 111.32;

    /** @var array<string, true> comparison keys of the candidate's skills */
    private array $skillKeys;

    /**
     * @param  Collection<int, Accommodation>  $needs
     */
    private function __construct(
        private readonly CandidateProfile $profile,
        private readonly Collection $needs,
        private readonly SkillCatalog $catalog,
    ) {
        $this->skillKeys = array_fill_keys($catalog->keys($profile->skills), true);
    }

    /** The viewer's matcher, or null when the viewer is not a candidate with a profile. */
    public static function for(?User $viewer): ?self
    {
        if ($viewer?->role !== UserRole::Candidate || ! $viewer->candidateProfile) {
            return null;
        }

        $profile = $viewer->candidateProfile;
        $needs = $profile->accommodations()->orderBy('accommodations.id')->get(['accommodations.id', 'accommodations.name']);

        return new self($profile, $needs, app(SkillCatalog::class));
    }

    public function profile(): CandidateProfile
    {
        return $this->profile;
    }

    /** @return list<int> */
    public function needIds(): array
    {
        return $this->needs->modelKeys();
    }

    /** Sets `match` on a posting (read by JobPostingResource); its accommodations must be loaded. */
    public function annotate(JobPosting $posting): void
    {
        $posting->setAttribute('match', $this->evaluate($posting, $posting->accommodations->modelKeys()));
    }

    /**
     * @param  list<int>  $offeredIds  the posting's accommodation ids
     * @return array<string, mixed> the Match object in docs/openapi.yaml
     */
    public function evaluate(JobPosting $posting, array $offeredIds): array
    {
        $parts = [];

        // Skills: the posting's skills the candidate has.
        $required = $this->catalog->normalize($posting->skills ?? []);
        $matched = array_values(array_filter($required, fn (string $skill) => isset($this->skillKeys[SkillCatalog::key($skill)])));
        if ($required !== []) {
            $parts['skills'] = count($matched) / count($required);
        }

        // Location.
        [$tier, $distance] = $this->location($posting);
        if ($tier === 'remote') {
            $parts['location'] = 1.0;
        } elseif ($tier !== 'unknown') {
            $parts['location'] = self::LOCATION_TIERS[$tier];
        }

        // Qualifications: minimum education and years of experience, when the posting asks.
        $educationMet = $posting->education_level === null ? null
            : ($this->profile->education_level?->meets($posting->education_level) ?? false);
        $experienceMet = ! $posting->experience_years ? null
            : ($this->profile->experience_years ?? -1) >= $posting->experience_years;
        $asked = array_filter([$educationMet, $experienceMet], fn ($met) => $met !== null);
        if ($asked !== []) {
            $parts['qualifications'] = count(array_filter($asked)) / count($asked);
        }

        // Work preferences.
        $setups = $this->profile->preferred_work_setups ?? [];
        $types = $this->profile->preferred_employment_types ?? [];
        $setupMet = $setups === [] ? null : in_array($posting->work_setup->value, $setups, true);
        $typeMet = $types === [] ? null : in_array($posting->employment_type->value, $types, true);
        $preferences = array_filter([$setupMet, $typeMet], fn ($met) => $met !== null);
        if ($preferences !== []) {
            $parts['preferences'] = count(array_filter($preferences)) / count($preferences);
        }

        // Accommodation needs the posting offers.
        $missing = $this->needs->reject(fn (Accommodation $need) => in_array($need->id, $offeredIds, true));
        if ($this->needs->isNotEmpty()) {
            $parts['needs'] = ($this->needs->count() - $missing->count()) / $this->needs->count();
        }

        $score = $this->score($parts);

        return [
            'score' => $score,
            'label' => $score === null ? null : self::label($score),
            // Accommodation needs (the M5 fields, unchanged).
            'met' => $this->needs->count() - $missing->count(),
            'total' => $this->needs->count(),
            'missing' => $missing->map(fn (Accommodation $need) => ['id' => $need->id, 'name' => $need->name])->values()->all(),
            'skills' => [
                'matched' => $matched,
                'missing' => array_values(array_diff($required, $matched)),
            ],
            'location' => ['tier' => $tier, 'distance_km' => $distance],
            'education' => ['required' => $posting->education_level?->value, 'met' => $educationMet],
            'experience' => ['required_years' => $posting->experience_years ?: null, 'met' => $experienceMet],
            'preferences' => ['work_setup' => $setupMet, 'employment_type' => $typeMet],
        ];
    }

    public static function label(int $score): string
    {
        foreach (self::LABELS as $label => $minimum) {
            if ($score >= $minimum) {
                return $label;
            }
        }

        return 'low';
    }

    /**
     * @param  array<string, float>  $parts  fraction met per part that has data
     */
    private function score(array $parts): ?int
    {
        $weight = array_sum(array_intersect_key(self::WEIGHTS, $parts));
        if ($weight === 0) {
            return null;
        }

        $earned = 0.0;
        foreach ($parts as $part => $fraction) {
            $earned += self::WEIGHTS[$part] * $fraction;
        }

        return (int) round($earned / $weight * 100);
    }

    /**
     * Tier and distance between the candidate's city and the posting's. Provinces come from the
     * Insights lookup; without it the PSGC code prefixes are used (highly urbanized cities have
     * their own prefix, so they may then count as another province).
     *
     * @return array{0: string, 1: float|null}
     */
    private function location(JobPosting $posting): array
    {
        $distance = $this->distanceKm($posting);
        if ($posting->work_setup === WorkSetup::Remote) {
            return ['remote', $distance];
        }

        $mine = $this->profile->location_psgc;
        $theirs = $posting->location_psgc;
        if (! $mine || ! $theirs) {
            return ['unknown', $distance];
        }

        if ($mine === $theirs) {
            return ['same_city', $distance];
        }

        $myProvince = $this->profile->location_province_psgc ?? self::provinceOf($mine);
        if ($myProvince !== null && $myProvince === ($posting->location_province_psgc ?? self::provinceOf($theirs))) {
            return ['same_province', $distance];
        }

        return [substr($mine, 0, 2) === substr($theirs, 0, 2) ? 'same_region' : 'farther', $distance];
    }

    /** Straight-line distance between the two city centres, or null without both points. */
    public function distanceKm(JobPosting $posting): ?float
    {
        if (! $this->profile->hasLocationPoint() || ! $posting->hasLocationPoint()) {
            return null;
        }

        $km = self::kilometres($this->profile->location_lat, $this->profile->location_lon, $posting->location_lat, $posting->location_lon);

        return $km < 10 ? round($km, 1) : round($km);
    }

    /** Haversine distance in kilometres. */
    public static function kilometres(float $lat1, float $lon1, float $lat2, float $lon2): float
    {
        $dLat = deg2rad($lat2 - $lat1);
        $dLon = deg2rad($lon2 - $lon1);
        $a = sin($dLat / 2) ** 2 + cos(deg2rad($lat1)) * cos(deg2rad($lat2)) * sin($dLon / 2) ** 2;

        return 6371.0 * 2 * atan2(sqrt($a), sqrt(1 - $a));
    }

    /**
     * SQL condition "within $km of the candidate" for job_postings (no trigonometry in SQL, so it
     * runs on MySQL and SQLite alike): an equirectangular approximation with the cosine of the
     * candidate's latitude worked out here. Accurate to well under 1% at these distances. The
     * numbers are written into the SQL (all computed here from stored decimals and a validated
     * integer): PDO binds floats as text, and SQLite then compares numbers with text.
     *
     * @return string|null null when the candidate has no point
     */
    public function withinSql(int $km): ?string
    {
        if (! $this->profile->hasLocationPoint()) {
            return null;
        }

        $number = fn (float $value) => sprintf('%.8F', $value);
        $lat = $number($this->profile->location_lat);
        $lon = $number($this->profile->location_lon);
        $latScale = $number(self::KM_PER_DEGREE);
        $lonScale = $number(self::KM_PER_DEGREE * cos(deg2rad($this->profile->location_lat)));
        $dy = "((job_postings.location_lat - {$lat}) * {$latScale})";
        $dx = "((job_postings.location_lon - {$lon}) * {$lonScale})";

        return "(job_postings.location_lat is not null and {$dy} * {$dy} + {$dx} * {$dx} <= ".$number($km * $km).')';
    }

    /** The province code from a city's own code; NCR cities have no province. */
    private static function provinceOf(string $city): ?string
    {
        return str_starts_with($city, '13') ? null : substr($city, 0, 5).'00000';
    }
}
