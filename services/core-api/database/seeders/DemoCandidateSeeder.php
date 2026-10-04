<?php

namespace Database\Seeders;

use App\Models\Accommodation;
use App\Models\CandidateProfile;
use App\Models\User;
use Illuminate\Database\Seeder;

/** Profiles and accommodation needs for the demo candidates (run after DemoUserSeeder). */
class DemoCandidateSeeder extends Seeder
{
    /** @var array<string, array<string, mixed>> keyed by the candidate's email */
    public const PROFILES = [
        'candidate@opendoor.test' => [
            'headline' => 'Data encoder with 3 years of BPO experience',
            'skills' => ['Excel', 'Typing (60 wpm)', 'Data validation'],
            'experience' => "Data encoder, 2022–2025.\nCustomer records and quality checks.",
            'location_label' => 'Quezon City, Metro Manila',
            'needs' => ['Wheelchair-accessible entrance', 'Accessible restroom', 'Written or captioned meetings'],
        ],
        'candidate2@opendoor.test' => [
            'headline' => 'Chat support agent and FSL user',
            'skills' => ['Filipino Sign Language', 'Chat support', 'Email support'],
            'experience' => 'Chat support for an e-commerce shop, 2023–2025.',
            'location_label' => 'Pasig City, Metro Manila',
            'needs' => ['Sign language interpreter', 'Written or captioned meetings', 'Flexible hours', 'Remote work'],
        ],
    ];

    public function run(): void
    {
        $accommodations = Accommodation::pluck('id', 'name');

        foreach (self::PROFILES as $email => $data) {
            $user = User::where('email', $email)->first();
            if (! $user) {
                continue;
            }

            $profile = CandidateProfile::firstOrNew(['user_id' => $user->id]);
            $profile->user_id = $user->id;
            $profile->fill(collect($data)->except('needs')->all())->save();
            $profile->accommodations()->sync(collect($data['needs'])->map(fn ($name) => $accommodations[$name])->all());
        }
    }
}
