<?php

namespace Database\Seeders;

use App\Enums\AccommodationGroup;
use App\Models\Accommodation;
use Illuminate\Database\Seeder;

class AccommodationSeeder extends Seeder
{
    /**
     * Accommodation types grouped per RA 7277 (name => description).
     *
     * @var array<string, array<string, string>>
     */
    public const ACCOMMODATIONS = [
        'physical_access' => [
            'Wheelchair-accessible entrance' => 'Step-free entrance with a ramp or level access.',
            'Accessible restroom' => 'Restroom with grab bars, enough turning space and an accessible door.',
            'Elevator or ground-floor workspace' => 'The workspace can be reached without stairs.',
            'Accessible parking' => 'Reserved parking slot close to the entrance.',
        ],
        'communication' => [
            'Sign language interpreter' => 'Filipino Sign Language interpreter for interviews, meetings and training.',
            'Written or captioned meetings' => 'Meetings have captions, transcripts or written summaries.',
            'Screen-reader-compatible work tools' => 'Internal systems and documents work with screen readers.',
        ],
        'work_arrangement' => [
            'Remote work' => 'The role can be done fully from home.',
            'Hybrid work' => 'Part of the week can be worked from home.',
            'Flexible hours' => 'Start and end times can be adjusted.',
            'Part-time schedule' => 'Reduced weekly hours are available.',
            'Modified duties' => 'Tasks can be adjusted to the employee\'s abilities.',
        ],
        'assistive_technology' => [
            'Screen reader software provided' => 'The employer provides a licensed screen reader.',
            'Adjustable workstation' => 'Height-adjustable desk, ergonomic chair or alternative input devices.',
            'Assistive listening devices' => 'Hearing loops or personal amplifiers are available.',
        ],
        'support' => [
            'Job coach or onboarding buddy' => 'A named person helps during onboarding and the first months.',
            'Service animal allowed' => 'Service animals are welcome at the workplace.',
            'Transportation assistance' => 'Shuttle service or a transport allowance is provided.',
        ],
    ];

    public function run(): void
    {
        foreach (self::ACCOMMODATIONS as $group => $items) {
            foreach ($items as $name => $description) {
                Accommodation::updateOrCreate(
                    ['name' => $name],
                    ['group' => AccommodationGroup::from($group), 'description' => $description],
                );
            }
        }
    }
}
