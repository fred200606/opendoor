<?php

namespace Database\Seeders;

use App\Models\Skill;
use Illuminate\Database\Seeder;

/**
 * The shared skills list (Decision 2026-10-21), grouped like the job categories. Candidates and
 * employers pick from it or type their own; aliases are other spellings of the same skill.
 * Idempotent by name.
 */
class SkillSeeder extends Seeder
{
    /** @var array<string, list<string>> name => aliases */
    public const SKILLS = [
        // Administrative
        'Data entry' => ['Data encoding', 'Encoding'],
        'Typing' => ['Touch typing', 'Fast typing', 'Keyboarding'],
        'Microsoft Excel' => ['Excel', 'MS Excel', 'Spreadsheets'],
        'Microsoft Word' => ['Word', 'MS Word', 'Word processing'],
        'Microsoft PowerPoint' => ['PowerPoint', 'MS PowerPoint', 'Presentations'],
        'Google Workspace' => ['Google Docs', 'Google Sheets', 'G Suite'],
        'Data validation' => ['Data checking', 'Data quality'],
        'Filing and records management' => ['Filing', 'Records management', 'Document control'],
        'Scheduling' => ['Calendar management', 'Appointment setting'],
        'Office administration' => ['Clerical work', 'Office work'],
        'Transcription' => ['Audio transcription'],
        'Inventory management' => ['Inventory', 'Stock control'],
        // Customer service and BPO
        'Customer service' => ['Customer support', 'Client service'],
        'Chat support' => ['Live chat support', 'Chat agent'],
        'Email support' => ['Email handling'],
        'Phone support' => ['Call handling', 'Voice support', 'Inbound calls'],
        'Technical support' => ['Tech support', 'IT helpdesk', 'Help desk'],
        'Complaint handling' => ['Escalation handling'],
        'Order processing' => ['Order management'],
        'Content moderation' => ['Moderation'],
        'CRM software' => ['CRM', 'Salesforce', 'Zendesk', 'HubSpot'],
        // Information technology
        'HTML' => ['HTML5'],
        'CSS' => ['CSS3'],
        'JavaScript' => ['JS'],
        'React' => ['React.js', 'ReactJS'],
        'PHP' => [],
        'Laravel' => [],
        'Python' => [],
        'Java' => [],
        'SQL' => ['MySQL', 'Databases'],
        'Web development' => ['Website development'],
        'Software testing' => ['QA testing', 'Manual testing'],
        'Accessibility testing' => ['WCAG', 'Web accessibility'],
        'Computer hardware repair' => ['Computer repair', 'Hardware troubleshooting'],
        'Network administration' => ['Networking'],
        'Git' => ['GitHub', 'Version control'],
        'Data analysis' => ['Data analytics'],
        // Accounting and finance
        'Bookkeeping' => [],
        'Accounting' => ['Accountancy'],
        'Payroll processing' => ['Payroll'],
        'Accounts payable' => ['AP'],
        'Accounts receivable' => ['AR', 'Collections'],
        'QuickBooks' => [],
        'Cash handling' => ['Cashiering', 'Cashier'],
        'Billing' => ['Invoicing'],
        // Sales and marketing
        'Sales' => ['Selling'],
        'Social media management' => ['Social media'],
        'Digital marketing' => ['Online marketing'],
        'Content writing' => ['Writing', 'Copywriting'],
        'Search engine optimization' => ['SEO'],
        'Market research' => ['Research'],
        'Telemarketing' => ['Outbound calls', 'Cold calling'],
        'Product knowledge' => [],
        // Creative and design
        'Graphic design' => ['Design'],
        'Adobe Photoshop' => ['Photoshop'],
        'Adobe Illustrator' => ['Illustrator'],
        'Canva' => [],
        'Figma' => ['UI design'],
        'Video editing' => ['Video production'],
        'Photography' => [],
        'Illustration' => ['Drawing'],
        // Education and training
        'Tutoring' => ['Teaching'],
        'Training delivery' => ['Training', 'Facilitation'],
        'Lesson planning' => ['Curriculum planning'],
        'Braille' => [],
        // Healthcare
        'First aid' => ['Basic life support', 'BLS'],
        'Patient care' => ['Caregiving'],
        'Medical records' => ['Medical coding', 'Health records'],
        'Massage therapy' => ['Massage'],
        // Hospitality and food service
        'Food preparation' => ['Cooking', 'Kitchen work'],
        'Food safety' => ['Food handling', 'Sanitation'],
        'Baking' => ['Pastry'],
        'Barista' => ['Coffee making'],
        'Housekeeping' => ['Cleaning'],
        'Front desk' => ['Reception', 'Receptionist'],
        // Manufacturing and production
        'Packing and labeling' => ['Packing', 'Packaging', 'Labeling'],
        'Quality control' => ['QC', 'Quality inspection'],
        'Machine operation' => ['Machine operator'],
        'Assembly' => ['Product assembly'],
        'Sewing' => ['Tailoring', 'Dressmaking'],
        'Handicraft' => ['Crafts', 'Handmade products'],
        'Warehouse work' => ['Warehousing'],
        // Languages and communication
        'English communication' => ['English', 'Written English', 'Spoken English'],
        'Filipino communication' => ['Filipino', 'Tagalog'],
        'Filipino Sign Language' => ['FSL'],
        'American Sign Language' => ['ASL'],
        'Business writing' => ['Report writing'],
        'Public speaking' => [],
        // Work skills
        'Attention to detail' => ['Detail oriented'],
        'Time management' => [],
        'Teamwork' => ['Team player'],
        'Problem solving' => [],
        'Organization' => ['Organizational skills'],
        'Multitasking' => [],
        'Adaptability' => [],
        'Leadership' => ['Supervision'],
        'Screen reader use' => ['NVDA', 'JAWS', 'VoiceOver'],
        'Driving' => ["Driver's license"],
    ];

    public function run(): void
    {
        foreach (self::SKILLS as $name => $aliases) {
            Skill::updateOrCreate(['name' => $name], ['aliases' => $aliases === [] ? null : $aliases]);
        }
    }
}
