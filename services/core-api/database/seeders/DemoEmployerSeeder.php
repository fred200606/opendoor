<?php

namespace Database\Seeders;

use App\Models\Employer;
use App\Models\User;
use Illuminate\Database\Seeder;

/**
 * Company profiles for the demo employer accounts (run after DemoUserSeeder).
 * Registration numbers match the simulated Business Registry seed (Phase 6).
 * Locations use the official 10-digit PSGC codes and the label the location picker builds.
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
            'location_psgc' => '1381300000',
            'location_label' => 'Quezon City, National Capital Region (NCR)',
            'description' => 'Software and data services company. Our office is on the ground floor with a ramp, and our team uses captioned video calls.',
            'verified' => true,
        ],
        'employer2@opendoor.test' => [
            'company_name' => 'Kalinga Foods Inc.',
            'registry_type' => 'SEC',
            'business_reg_no' => 'CS201912345',
            'industry' => 'Food Manufacturing',
            'address' => '1200 Pasong Tamo Ext.',
            'location_psgc' => '1380300000',
            'location_label' => 'City of Makati, National Capital Region (NCR)',
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
