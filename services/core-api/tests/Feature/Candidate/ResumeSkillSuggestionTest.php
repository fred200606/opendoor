<?php

namespace Tests\Feature\Candidate;

use App\Models\CandidateProfile;
use App\Models\Skill;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/** Decision 2026-10-21: skills suggested from the résumé, confirmed by the candidate. */
class ResumeSkillSuggestionTest extends TestCase
{
    use RefreshDatabase;

    private const URL = '/api/candidate/resume/skill-suggestions';

    private CandidateProfile $profile;

    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake();

        Skill::factory()->create(['name' => 'Microsoft Excel', 'aliases' => ['Excel', 'MS Excel']]);
        Skill::factory()->create(['name' => 'Microsoft Word', 'aliases' => ['Word']]);
        Skill::factory()->create(['name' => 'Data entry', 'aliases' => ['Data encoding']]);
        Skill::factory()->create(['name' => 'Filipino Sign Language', 'aliases' => ['FSL']]);
        Skill::factory()->create(['name' => 'Java', 'aliases' => null]);
        Skill::factory()->create(['name' => 'Customer service', 'aliases' => ['Customer support']]);

        $this->profile = CandidateProfile::factory()->for(User::factory()->candidate())->create(['skills' => ['Customer service']]);
        Sanctum::actingAs($this->profile->user);
    }

    /** A one-page PDF with the given lines of text (Helvetica), as a PDF writer would make it. */
    private static function pdf(array $lines): string
    {
        $text = 'BT /F1 12 Tf 14 TL 72 720 Td '.implode(' T* ', array_map(fn ($line) => '('.addcslashes($line, '()\\').') Tj', $lines)).' ET';
        $objects = [
            '<< /Type /Catalog /Pages 2 0 R >>',
            '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
            '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
            '<< /Length '.strlen($text)." >>\nstream\n{$text}\nendstream",
            '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
        ];

        $pdf = "%PDF-1.4\n";
        $offsets = [];
        foreach ($objects as $index => $object) {
            $offsets[] = strlen($pdf);
            $pdf .= ($index + 1)." 0 obj\n{$object}\nendobj\n";
        }
        $xref = strlen($pdf);
        $pdf .= 'xref
0 '.(count($objects) + 1)."\n0000000000 65535 f \n";
        foreach ($offsets as $offset) {
            $pdf .= sprintf("%010d 00000 n \n", $offset);
        }

        return $pdf.'trailer << /Size '.(count($objects) + 1)." /Root 1 0 R >>\nstartxref\n{$xref}\n%%EOF\n";
    }

    private function storeResume(string $contents): void
    {
        Storage::put('resumes/cv.pdf', $contents);
        $this->profile->forceFill(['resume_path' => 'resumes/cv.pdf'])->save();
    }

    public function test_suggests_list_skills_found_in_the_resume_that_the_profile_lacks(): void
    {
        $this->storeResume(self::pdf([
            'Maria Santos - Data encoder',
            'Skills: MS Excel, data encoding, FSL, JavaScript basics.',
            'Gave customer support for 2 years. I like to word things clearly.',
        ]));

        $this->getJson(self::URL)
            ->assertOk()
            // Customer service is already on the profile; "word" in a sentence and "Java" inside
            // "JavaScript" are not skills; short aliases ("FSL") are skipped.
            ->assertExactJson(['data' => ['readable' => true, 'skills' => ['Microsoft Excel', 'Data entry']]]);
    }

    public function test_a_file_without_readable_text_gives_no_suggestions(): void
    {
        $this->storeResume('not a pdf at all');

        $this->getJson(self::URL)->assertOk()->assertExactJson(['data' => ['readable' => false, 'skills' => []]]);
    }

    public function test_without_a_resume_the_candidate_is_asked_to_upload_one(): void
    {
        $this->getJson(self::URL)->assertNotFound()->assertJsonPath('error.message', 'Upload your résumé first.');
    }

    public function test_only_candidates_get_suggestions(): void
    {
        Sanctum::actingAs(User::factory()->employer()->create());

        $this->getJson(self::URL)->assertForbidden();
    }
}
