<?php

namespace Database\Seeders;

use App\Models\Employer;
use App\Models\User;
use Illuminate\Database\Seeder;

/**
 * Company profiles for the demo employer accounts (run after DemoUserSeeder).
 * Registration numbers match the simulated Business Registry seed (Phase 6).
 * location_psgc stays null until the codes are confirmed against the PSGC API (Phase 7).
 */
class DemoEmployerSeeder extends Seeder
{
    /** @var array<string, array<string, mixed>> keyed by the owner's email */
    public const COMPANIES = [
        'employer@opendoor.test' => [
            'company_name' => 'Bayanihan Tech Solutions',
            'registry_type' => 'DTI',
            'business_reg_no' => '3456789',
            'industry' => 'Information Technology',
            'address' => '25 Scout Tobias St., South Triangle',
            'location_label' => 'Quezon City, Metro Manila',
            'description' => 'Software and data services company. Our office is on the ground floor with a ramp, and our team uses captioned video calls.',
            'verified' => true,
        ],
        'employer2@opendoor.test' => [
            'company_name' => 'Kalinga Foods Inc.',
            'registry_type' => 'SEC',
            'business_reg_no' => 'CS201912345',
            'industry' => 'Food Manufacturing',
            'address' => '1200 Pasong Tamo Ext.',
            'location_label' => 'Makati City, Metro Manila',
            'description' => 'Food production and packaging. We offer flexible hours and a job coach for new staff.',
            'verified' => false,
        ],
    ];

    public function run(): void
    {
        foreach (self::COMPANIES as $email => $company) {
            $user = User::where('email', $email)->first();
            if (! $user) {
                continue;
            }

            $employer = Employer::firstOrNew(['user_id' => $user->id]);
            $employer->fill(collect($company)->except('verified')->all());
            $employer->verified_at = $company['verified'] ? ($employer->verified_at ?? now()) : null;
            $employer->save();
        }
    }
}
