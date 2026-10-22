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
                'skills' => ['Data entry', 'Typing', 'Microsoft Excel', 'Attention to detail'],
                'education_level' => 'senior_high',
                'experience_years' => 1,
                'qualifications' => 'At least 1 year of encoding work. Training is provided for our CRM.',
                'category' => 'Administrative',
                'description' => 'Keep our customer records accurate: encode new records in our CRM and check existing ones. Training is provided.',
                'responsibilities' => "Encode customer records from forms and emails into the CRM\nCheck records for errors and duplicates\nPrepare a short weekly report in Excel",
                'salary' => [18000, 22000, 'month'],
                'benefits' => "SSS, PhilHealth and Pag-IBIG\nHMO from the first month\n13th-month pay",
                'schedule' => 'Monday to Friday, 9:00 AM to 5:00 PM',
                'application_requirements' => null,
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
                'skills' => ['Chat support', 'Email support', 'English communication', 'CRM software'],
                'education_level' => 'senior_high',
                'experience_years' => null,
                'qualifications' => 'Good written English. Fresh graduates are welcome.',
                'category' => 'Customer Service',
                'description' => 'Answer customer questions by chat and email for an online shop. No phone calls.',
                'responsibilities' => "Answer chats and emails within our response times\nLog each case in the CRM\nPass technical questions to the product team",
                'salary' => [20000, 26000, 'month'],
                'benefits' => "SSS, PhilHealth and Pag-IBIG\nHMO with one free dependent\nInternet allowance on home days",
                'schedule' => 'Rotating day shifts between 7:00 AM and 7:00 PM, 5 days a week',
                'application_requirements' => 'A short writing sample: a reply to a customer who received the wrong item (we send the details after you apply).',
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
                'skills' => ['HTML', 'CSS', 'JavaScript', 'React', 'Git'],
                'education_level' => 'college',
                'experience_years' => null,
                'qualifications' => 'A portfolio or GitHub profile with at least one web project.',
                'category' => 'Information Technology',
                'description' => 'Build and test accessible web pages with our product team, fully remote.',
                'responsibilities' => "Build pages and components in React from the team's designs\nTest pages with a keyboard and a screen reader\nReview code with a senior developer",
                'salary' => [28000, 38000, 'month'],
                'benefits' => "SSS, PhilHealth and Pag-IBIG\nHMO from the first month\nLaptop and assistive software provided",
                'schedule' => 'Monday to Friday, flexible hours around core hours 10:00 AM to 3:00 PM',
                'application_requirements' => 'A link to your portfolio or GitHub profile in your cover note.',
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
                'skills' => ['Packing and labeling', 'Attention to detail', 'Teamwork'],
                'education_level' => 'elementary',
                'experience_years' => null,
                'qualifications' => null,
                'category' => 'Manufacturing and Production',
                'description' => 'Pack and label food products on our packing line. A seated workstation is available.',
                'responsibilities' => "Pack products into boxes by order\nPrint and stick labels\nKeep the packing area clean",
                'salary' => [645, null, 'day'],
                'benefits' => 'Free lunch on work days',
                'schedule' => 'Monday, Wednesday and Friday, 8:00 AM to 12:00 PM',
                'application_requirements' => null,
                'address' => '1200 Pasong Tamo Ext.',
                'location_psgc' => '1380300000',
                'location_label' => 'City of Makati, National Capital Region (NCR)',
                'employment_type' => 'part_time',
                'work_setup' => 'onsite',
                'interview_format' => 'onsite',
                // Kalinga Foods is not verified yet, so it can only keep drafts (Decision 2026-10-21).
                'status' => 'draft',
                'accommodations' => [
                    'Adjustable workstation' => 'Seated or standing packing table.',
                    'Part-time schedule' => null,
                    'Transportation assistance' => 'Shuttle from Magallanes MRT station.',
                ],
            ],
            [
                // Filled and closed: the hires for DemoFeedbackSeeder (2 responses + one open for Postman T10).
                'title' => 'Quality Control Assistant',
                'skills' => ['Quality control', 'Attention to detail', 'Food safety'],
                'education_level' => 'high_school',
                'experience_years' => 1,
                'qualifications' => null,
                'category' => 'Manufacturing and Production',
                'description' => 'Check packed products against our quality checklist before they leave the plant.',
                'responsibilities' => "Check packed products against the quality checklist\nRecord the results\nSet aside products that fail the check",
                'salary' => null,
                'benefits' => null,
                'schedule' => 'Day shift, Monday to Friday',
                'application_requirements' => null,
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
                    'responsibilities' => $data['responsibilities'],
                    'salary_min' => $data['salary'][0] ?? null,
                    'salary_max' => $data['salary'][1] ?? null,
                    'salary_period' => $data['salary'][2] ?? null,
                    'benefits' => $data['benefits'],
                    'schedule' => $data['schedule'],
                    'application_requirements' => $data['application_requirements'],
                    'skills' => $data['skills'],
                    'education_level' => $data['education_level'],
                    'experience_years' => $data['experience_years'],
                    'qualifications' => $data['qualifications'],
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
                DemoPlaces::apply($posting);
                $posting->save();

                $posting->accommodations()->sync(
                    collect($data['accommodations'])->mapWithKeys(fn ($note, $name) => [$accommodations[$name] => ['note' => $note]])->all(),
                );
            }
        }
    }
}
