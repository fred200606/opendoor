<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Decision 2026-10-21 (requirements v2): postings name the skills and qualifications they need;
 * candidates give their education, experience and work preferences for matching.
 * Education levels are App\Enums\EducationLevel values (validated in the form requests).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('candidate_profiles', function (Blueprint $table) {
            $table->string('education_level', 20)->nullable()->after('experience');
            $table->unsignedTinyInteger('experience_years')->nullable()->after('education_level');
            $table->json('preferred_work_setups')->nullable()->after('experience_years');
            $table->json('preferred_employment_types')->nullable()->after('preferred_work_setups');
        });

        Schema::table('job_postings', function (Blueprint $table) {
            $table->json('skills')->nullable()->after('description');
            $table->string('education_level', 20)->nullable()->after('skills');
            $table->unsignedTinyInteger('experience_years')->nullable()->after('education_level');
            $table->text('qualifications')->nullable()->after('experience_years');
        });
    }

    public function down(): void
    {
        Schema::table('candidate_profiles', function (Blueprint $table) {
            $table->dropColumn(['education_level', 'experience_years', 'preferred_work_setups', 'preferred_employment_types']);
        });

        Schema::table('job_postings', function (Blueprint $table) {
            $table->dropColumn(['skills', 'education_level', 'experience_years', 'qualifications']);
        });
    }
};
