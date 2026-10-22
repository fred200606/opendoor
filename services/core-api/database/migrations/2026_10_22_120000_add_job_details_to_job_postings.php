<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Decision 2026-10-22e: what candidates need to judge a job – responsibilities, salary range,
 * benefits, schedule and what the employer asks for when applying. All optional; the salary is in
 * whole Philippine pesos per App\Enums\SalaryPeriod (validated in JobPostingRequest).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('job_postings', function (Blueprint $table) {
            $table->text('responsibilities')->nullable()->after('description');
            $table->unsignedInteger('salary_min')->nullable()->after('qualifications');
            $table->unsignedInteger('salary_max')->nullable()->after('salary_min');
            $table->string('salary_period', 10)->nullable()->after('salary_max');
            $table->text('benefits')->nullable()->after('salary_period');
            $table->string('schedule')->nullable()->after('benefits');
            $table->text('application_requirements')->nullable()->after('interview_format');
        });
    }

    public function down(): void
    {
        Schema::table('job_postings', function (Blueprint $table) {
            $table->dropColumn(['responsibilities', 'salary_min', 'salary_max', 'salary_period', 'benefits', 'schedule', 'application_requirements']);
        });
    }
};
