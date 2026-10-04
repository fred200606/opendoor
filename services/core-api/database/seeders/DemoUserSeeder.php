<?php

namespace Database\Seeders;

use App\Enums\UserRole;
use App\Models\User;
use Illuminate\Database\Seeder;
use RuntimeException;

/**
 * Admin and demo accounts. The password comes from DEMO_PASSWORD and is never hard-coded.
 * Profiles, company data, postings and applications are added by later seeders.
 */
class DemoUserSeeder extends Seeder
{
    /** @var list<array{name: string, email: string, role: UserRole}> */
    public const ACCOUNTS = [
        ['name' => 'OpenDoor Admin', 'email' => 'admin@opendoor.test', 'role' => UserRole::Admin],
        ['name' => 'Maria Santos', 'email' => 'candidate@opendoor.test', 'role' => UserRole::Candidate],
        ['name' => 'Juan Dela Cruz', 'email' => 'candidate2@opendoor.test', 'role' => UserRole::Candidate],
        ['name' => 'Ana Reyes', 'email' => 'employer@opendoor.test', 'role' => UserRole::Employer],
        ['name' => 'Ramon Villanueva', 'email' => 'employer2@opendoor.test', 'role' => UserRole::Employer],
    ];

    public function run(): void
    {
        $password = config('opendoor.demo_password');

        if (! is_string($password) || strlen($password) < 8) {
            throw new RuntimeException('Set DEMO_PASSWORD (at least 8 characters) in .env before seeding demo accounts.');
        }

        foreach (self::ACCOUNTS as $account) {
            $user = User::firstOrNew(['email' => $account['email']]);
            $user->forceFill([
                'name' => $account['name'],
                'password' => $password,
                'role' => $account['role'],
                'is_active' => true,
                'consented_at' => $user->consented_at ?? now(),
                'email_verified_at' => $user->email_verified_at ?? now(),
            ])->save();
        }
    }
}
