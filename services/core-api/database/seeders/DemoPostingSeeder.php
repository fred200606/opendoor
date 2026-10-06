<?php

namespace Database\Seeders;

use App\Enums\JobPostingStatus;
use App\Models\Accommodation;
use App\Models\Category;
use App\Models\JobPosting;
use App\Models\User;
use Illuminate\Database\Seeder;

/** Demo postings for the demo companies (run after DemoEmployerSeeder). Idempotent by employer + title. */
class DemoPostingSeeder extends Seeder
{
    /** @var array<string, list<array<string, mixed>>> keyed by the employer's email */
    public const POSTINGS = [
        'employer@opendoor.test' => [
            [
                'title' => 'Data Encoder',
                'category' => 'Administrative',
                'description' => "Encode and check customer records in our CRM.\nMonday to Friday, 9:00 to 17:00. Training is provided.",
                'address' => '25 Scout Tobias St., South Triangle',
                'location_psgc' => '1381300000',
                'location_label' => 'Quezon City, National Capital Region (NCR)',
                'employment_type' => 'full_time',
                'work_setup' => 'onsite',
                'interview_format' => 'online',
                'status' => 'open',
                'accommodations' => [
                    'Wheelchair-accessible entrance' => 'Ramp at the main entrance on Scout Tobias St.',
                    'Accessible restroom' => 'On the ground floor, next to the pantry.',
                    'Written or captioned meetings' => null,
                    'Screen-reader-compatible work tools' => 'Our CRM is tested with NVDA.',
                ],
            ],
            [
                'title' => 'Customer Support Associate (Chat)',
                'category' => 'Customer Service',
                'description' => "Answer customer questions by chat and email.\nNo phone calls. Rotating day shifts.",
                'address' => '25 Scout Tobias St., South Triangle',
                'location_psgc' => '1381300000',
                'location_label' => 'Quezon City, National Capital Region (NCR)',
                'employment_type' => 'full_time',
                'work_setup' => 'hybrid',
                'interview_format' => 'online',
                'status' => 'open',
                'accommodations' => [
                    'Hybrid work' => 'Three days from home each week.',
                    'Sign language interpreter' => 'FSL interpreter for team meetings and training.',
                    'Written or captioned meetings' => null,
                    'Flexible hours' => null,
                ],
            ],
            [
                'title' => 'Junior Web Developer',
                'category' => 'Information Technology',
                'description' => "Build and test accessible web pages with our product team.\nKnowledge of HTML and JavaScript required.",
                'address' => 'Remote (team based in Quezon City)',
                'location_psgc' => '1381300000',
                'location_label' => 'Quezon City, National Capital Region (NCR)',
                'employment_type' => 'full_time',
                'work_setup' => 'remote',
                'interview_format' => 'online',
                'status' => 'open',
                'accommodations' => [
                    'Remote work' => null,
                    'Flexible hours' => 'Core hours 10:00 to 15:00.',
                    'Screen reader software provided' => 'JAWS or NVDA licence on request.',
                    'Job coach or onboarding buddy' => null,
                ],
            ],
        ],
        'employer2@opendoor.test' => [
            [
                'title' => 'Packing Line Staff',
                'category' => 'Manufacturing and Production',
                'description' => "Pack and label food products.\nSeated workstation available.",
                'address' => '1200 Pasong Tamo Ext.',
                'location_psgc' => '1380300000',
                'location_label' => 'City of Makati, National Capital Region (NCR)',
                'employment_type' => 'part_time',
                'work_setup' => 'onsite',
                'interview_format' => 'onsite',
                'status' => 'pending_approval',
                'accommodations' => [
                    'Adjustable workstation' => 'Seated or standing packing table.',
                    'Part-time schedule' => null,
                    'Transportation assistance' => 'Shuttle from Magallanes MRT station.',
                ],
            ],
            [
                // Filled and closed: the hires for DemoFeedbackSeeder (2 responses + one open for Postman T10).
                'title' => 'Quality Control Assistant',
                'category' => 'Manufacturing and Production',
                'description' => "Check packed products against the quality checklist.\nDay shift, Monday to Friday.",
                'address' => '1200 Pasong Tamo Ext.',
                'location_psgc' => '1380300000',
                'location_label' => 'City of Makati, National Capital Region (NCR)',
                'employment_type' => 'full_time',
                'work_setup' => 'onsite',
                'interview_format' => 'onsite',
                'status' => 'closed',
                'closes_in_days' => -150,
                'accommodations' => [
                    'Elevator or ground-floor workspace' => 'QC room on the ground floor.',
                    'Adjustable workstation' => null,
                    'Written or captioned meetings' => 'Shift briefings are also posted in writing.',
                ],
            ],
        ],
    ];

    public function run(): void
    {
        $accommodations = Accommodation::pluck('id', 'name');
        $categories = Category::pluck('id', 'name');

        foreach (self::POSTINGS as $email => $postings) {
            $employer = User::where('email', $email)->first()?->employer;
            if (! $employer) {
                continue;
            }

            foreach ($postings as $data) {
                $posting = JobPosting::firstOrNew(['employer_id' => $employer->id, 'title' => $data['title']]);
                $posting->fill([
                    'category_id' => $categories[$data['category']],
                    'description' => $data['description'],
                    'address' => $data['address'],
                    'location_psgc' => $data['location_psgc'],
                    'location_label' => $data['location_label'],
                    'employment_type' => $data['employment_type'],
                    'work_setup' => $data['work_setup'],
                    'interview_format' => $data['interview_format'],
                    'closes_at' => now()->addDays($data['closes_in_days'] ?? 45)->toDateString(),
                ]);
                $posting->status = JobPostingStatus::from($data['status']);
                $posting->is_approved = in_array($data['status'], ['open', 'closed'], true);
                $posting->save();

                $posting->accommodations()->sync(
                    collect($data['accommodations'])->mapWithKeys(fn ($note, $name) => [$accommodations[$name] => ['note' => $note]])->all(),
                );
            }
        }
    }
}
