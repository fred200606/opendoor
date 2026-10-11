<?php

namespace App\Console\Commands;

use App\Enums\JobPostingStatus;
use App\Enums\UserRole;
use App\Models\Accommodation;
use App\Models\Application;
use App\Models\CandidateProfile;
use App\Models\Category;
use App\Models\Employer;
use App\Models\JobPosting;
use App\Models\User;
use Illuminate\Console\Attributes\Description;
use Illuminate\Console\Attributes\Signature;
use Illuminate\Console\Command;
use Illuminate\Console\ConfirmableTrait;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Random\Engine\Mt19937;
use Random\Randomizer;

/**
 * JMeter load-test data (SIA doc 7.3, Appendix D): 500 open postings from 10 verified load-test
 * companies and 50 load-test candidates with accommodation needs, plus one API token per candidate
 * written to a CSV for JMeter's CSV Data Set. Everything is recognisable by its e-mail domain
 * (`loadtest-…@opendoor.test`) and removed again with --remove. Same data on every run (seeded
 * random numbers); new tokens on every run. No Faker, so it also runs in the production image.
 */
#[Signature('load-test:data
    {--postings=500 : Number of open postings}
    {--candidates=50 : Number of candidates (one token each)}
    {--tokens=storage/app/private/load-test-tokens.csv : CSV file for the tokens (relative to the Core folder)}
    {--remove : Delete all load-test data and tokens instead}
    {--force : Run in production}')]
#[Description('Create (or --remove) the JMeter load-test postings, candidates and token CSV')]
class LoadTestData extends Command
{
    use ConfirmableTrait;

    private const EMPLOYERS = 10;

    private const EMAIL = 'loadtest-%s-%02d@opendoor.test';

    private const TOKEN_NAME = 'load-test';

    /** Official PSGC codes and picker labels of the demo cities. */
    private const LOCATIONS = [
        ['1381300000', 'Quezon City, National Capital Region (NCR)', 'Quezon Ave.'],
        ['1380300000', 'City of Makati, National Capital Region (NCR)', 'Ayala Ave.'],
        ['1381200000', 'City of Pasig, National Capital Region (NCR)', 'Ortigas Ave.'],
    ];

    public function handle(): int
    {
        if (! $this->confirmToProceed()) {
            return self::FAILURE;
        }

        return $this->option('remove') ? $this->remove() : $this->create();
    }

    private function create(): int
    {
        $postingCount = (int) $this->option('postings');
        $candidateCount = (int) $this->option('candidates');
        $random = new Randomizer(new Mt19937(2026));
        $categories = Category::orderBy('id')->pluck('id')->all();
        $accommodations = Accommodation::active()->orderBy('id')->pluck('id')->all();
        if ($categories === [] || count($accommodations) < 6) {
            $this->error('Seed the categories and accommodations first (php artisan db:seed).');

            return self::FAILURE;
        }
        // One random password for every load-test account: nobody logs in with it, JMeter uses tokens.
        $password = Hash::make(Str::random(40));

        $tokens = DB::transaction(function () use ($postingCount, $candidateCount, $random, $categories, $accommodations, $password) {
            $employers = [];
            for ($e = 1; $e <= self::EMPLOYERS; $e++) {
                $user = $this->user(sprintf(self::EMAIL, 'employer', $e), "Load Test Employer {$e}", UserRole::Employer, $password);
                [$psgc, $label, $street] = self::LOCATIONS[$e % count(self::LOCATIONS)];
                $employer = Employer::firstOrNew(['user_id' => $user->id]);
                $employer->user_id = $user->id; // not mass assignable (db:seed runs unguarded, commands do not)
                $employer->fill([
                    'company_name' => sprintf('Load Test Company %02d', $e),
                    'registry_type' => 'DTI',
                    'business_reg_no' => sprintf('LT%07d', $e),
                    'industry' => 'Load testing',
                    'address' => "{$e} {$street}",
                    'location_psgc' => $psgc,
                    'location_label' => $label,
                    'description' => 'Generated for the JMeter load test; removed afterwards.',
                ]);
                $employer->verified_at ??= now();
                $employer->save();
                $employers[] = $employer;
            }

            for ($p = 1; $p <= $postingCount; $p++) {
                $employer = $employers[($p - 1) % self::EMPLOYERS];
                $posting = JobPosting::firstOrNew(['employer_id' => $employer->id, 'title' => sprintf('Load test posting %03d', $p)]);
                $posting->employer_id = $employer->id;
                $posting->fill([
                    'category_id' => $categories[$random->getInt(0, count($categories) - 1)],
                    'description' => 'Generated for the JMeter load test.',
                    'address' => $employer->address,
                    'location_psgc' => $employer->location_psgc,
                    'location_label' => $employer->location_label,
                    'employment_type' => ['full_time', 'part_time', 'contract', 'internship'][$p % 4],
                    'work_setup' => ['onsite', 'hybrid', 'remote'][$p % 3],
                    'interview_format' => ['online', 'onsite'][$p % 2],
                    'closes_at' => now()->addDays(60)->toDateString(),
                ]);
                $posting->status = JobPostingStatus::Open;
                $posting->is_approved = true;
                $posting->save();
                $posting->accommodations()->sync($this->pick($random, $accommodations, 2, 6));
            }

            $tokens = [];
            for ($c = 1; $c <= $candidateCount; $c++) {
                $user = $this->user(sprintf(self::EMAIL, 'candidate', $c), "Load Test Candidate {$c}", UserRole::Candidate, $password);
                [$psgc, $label] = self::LOCATIONS[$c % count(self::LOCATIONS)];
                $profile = CandidateProfile::firstOrNew(['user_id' => $user->id]);
                $profile->user_id = $user->id;
                $profile->fill(['headline' => 'Load test candidate', 'location_psgc' => $psgc, 'location_label' => $label])->save();
                // Needs make every search a "Matches my needs" search (match_mode true).
                $profile->accommodations()->sync($this->pick($random, $accommodations, 2, 5));

                $user->tokens()->where('name', self::TOKEN_NAME)->delete();
                $tokens[] = $user->createToken(self::TOKEN_NAME)->plainTextToken;
            }

            return $tokens;
        });

        $file = $this->tokenFile();
        if (! is_dir(dirname($file))) {
            mkdir(dirname($file), 0700, true);
        }
        file_put_contents($file, implode("\n", $tokens)."\n");

        $this->info(sprintf('%d open postings from %d companies, %d candidates; %d tokens written to %s.', $postingCount, self::EMPLOYERS, $candidateCount, count($tokens), $file));

        return self::SUCCESS;
    }

    private function remove(): int
    {
        $users = User::where('email', 'like', 'loadtest-%@opendoor.test')->get();
        $postings = JobPosting::withTrashed()->whereIn('employer_id', Employer::whereIn('user_id', $users->pluck('id'))->select('id'));
        $applied = Application::whereIn('job_posting_id', (clone $postings)->select('id'))->count();
        if ($applied > 0) {
            $this->error("{$applied} application(s) were made to load-test postings; remove them by hand first.");

            return self::FAILURE;
        }

        DB::transaction(function () use ($users, $postings) {
            $postings->get()->each->forceDelete(); // accommodations, saved jobs and reports cascade
            Employer::whereIn('user_id', $users->pluck('id'))->delete();
            CandidateProfile::whereIn('user_id', $users->pluck('id'))->delete(); // needs cascade
            $users->each(function (User $user) {
                $user->tokens()->delete();
                $user->notifications()->delete();
                $user->delete();
            });
        });

        if (is_file($this->tokenFile())) {
            unlink($this->tokenFile());
        }
        $this->info("Removed {$users->count()} load-test accounts with their companies, postings and tokens.");

        return self::SUCCESS;
    }

    private function user(string $email, string $name, UserRole $role, string $password): User
    {
        $user = User::firstOrNew(['email' => $email]);
        $user->forceFill([
            'name' => $name,
            'password' => $password,
            'role' => $role,
            'is_active' => true,
            'consented_at' => $user->consented_at ?? now(),
            'email_verified_at' => $user->email_verified_at ?? now(),
        ])->save();

        return $user;
    }

    /**
     * @param  list<int>  $ids
     * @return list<int>
     */
    private function pick(Randomizer $random, array $ids, int $min, int $max): array
    {
        return array_slice($random->shuffleArray($ids), 0, $random->getInt($min, $max));
    }

    private function tokenFile(): string
    {
        $path = (string) $this->option('tokens');

        return str_starts_with($path, '/') || preg_match('/^[A-Za-z]:[\\\\\/]/', $path) ? $path : base_path($path);
    }
}
