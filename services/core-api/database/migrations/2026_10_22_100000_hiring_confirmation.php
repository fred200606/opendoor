<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Decision 2026-10-22b: stages Submitted → Under review → Shortlisted → Contacted → Hired, and
 * Hired only after both parties confirm a hiring report. Reports and every response are kept
 * (hiring_reports, hiring_report_events). Each existing hire becomes a confirmed report, so its
 * history and its rating date stay the same (start date = the day it was hired).
 */
return new class extends Migration
{
    private const BEFORE = ['pending', 'reviewed', 'hired', 'rejected', 'withdrawn'];

    private const AFTER = ['pending', 'reviewed', 'shortlisted', 'contacted', 'hired', 'rejected', 'withdrawn'];

    public function up(): void
    {
        Schema::table('applications', function (Blueprint $table) {
            $table->enum('status', self::AFTER)->default('pending')->change();
        });
        Schema::table('applications', function (Blueprint $table) {
            $table->timestamp('shortlisted_at')->nullable()->after('reviewed_at');
            $table->timestamp('contacted_at')->nullable()->after('shortlisted_at');
            $table->date('hire_start_date')->nullable()->after('hired_at');
        });

        Schema::create('hiring_reports', function (Blueprint $table) {
            $table->id();
            $table->foreignId('application_id')->constrained()->restrictOnDelete();
            $table->enum('reported_by', ['employer', 'candidate']);
            $table->foreignId('reporter_id')->constrained('users')->restrictOnDelete();
            $table->date('start_date');
            $table->enum('status', ['pending', 'confirmed', 'disputed', 'cancelled'])->default('pending');
            $table->timestamp('responded_at')->nullable();
            $table->timestamps();

            $table->index(['application_id', 'status']);
        });

        Schema::create('hiring_report_events', function (Blueprint $table) {
            $table->id();
            $table->foreignId('hiring_report_id')->constrained()->cascadeOnDelete();
            $table->enum('actor_role', ['employer', 'candidate']);
            $table->foreignId('actor_id')->nullable()->constrained('users')->nullOnDelete();
            $table->enum('action', ['reported', 'confirmed', 'not_yet', 'disputed', 'cancelled']);
            $table->date('start_date')->nullable();
            $table->timestamp('created_at')->nullable();
        });

        $this->recordExistingHires();

        Schema::table('applications', function (Blueprint $table) {
            $table->dropColumn('hire_confirmed_by');
        });
    }

    /**
     * Before this decision one party's word was enough. Each hire becomes a report by that party,
     * confirmed at the same moment (the confirming event has no actor: nobody answered it).
     */
    private function recordExistingHires(): void
    {
        $hires = DB::table('applications')
            ->join('job_postings', 'job_postings.id', '=', 'applications.job_posting_id')
            ->join('employers', 'employers.id', '=', 'job_postings.employer_id')
            ->join('candidate_profiles', 'candidate_profiles.id', '=', 'applications.candidate_profile_id')
            ->where('applications.status', 'hired')
            ->whereNotNull('applications.hired_at')
            ->select('applications.id', 'applications.hired_at', 'applications.hire_confirmed_by', 'employers.user_id as employer_user_id', 'candidate_profiles.user_id as candidate_user_id')
            ->orderBy('applications.id')
            ->get();

        foreach ($hires as $hire) {
            $by = $hire->hire_confirmed_by ?? 'employer';
            $at = $hire->hired_at;
            // The rating opened 30 days after hired_at, so the start date is that calendar day
            // (timestamps are stored in APP_TIMEZONE, Asia/Manila).
            $startDate = Carbon::parse($at)->toDateString();

            DB::table('applications')->where('id', $hire->id)->update(['hire_start_date' => $startDate]);
            $reportId = DB::table('hiring_reports')->insertGetId([
                'application_id' => $hire->id,
                'reported_by' => $by,
                'reporter_id' => $by === 'candidate' ? $hire->candidate_user_id : $hire->employer_user_id,
                'start_date' => $startDate,
                'status' => 'confirmed',
                'responded_at' => $at,
                'created_at' => $at,
                'updated_at' => $at,
            ]);
            DB::table('hiring_report_events')->insert([
                ['hiring_report_id' => $reportId, 'actor_role' => $by, 'actor_id' => $by === 'candidate' ? $hire->candidate_user_id : $hire->employer_user_id, 'action' => 'reported', 'start_date' => $startDate, 'created_at' => $at],
                ['hiring_report_id' => $reportId, 'actor_role' => $by === 'candidate' ? 'employer' : 'candidate', 'actor_id' => null, 'action' => 'confirmed', 'start_date' => null, 'created_at' => $at],
            ]);
        }
    }

    public function down(): void
    {
        Schema::table('applications', function (Blueprint $table) {
            $table->enum('hire_confirmed_by', ['employer', 'candidate'])->nullable()->after('feedback_reminded_at');
        });
        foreach (DB::table('hiring_reports')->where('status', 'confirmed')->get(['application_id', 'reported_by']) as $report) {
            DB::table('applications')->where('id', $report->application_id)->update(['hire_confirmed_by' => $report->reported_by]);
        }

        Schema::dropIfExists('hiring_report_events');
        Schema::dropIfExists('hiring_reports');

        // Shortlisted and contacted have no older equivalent: they go back to reviewed.
        DB::table('applications')->whereIn('status', ['shortlisted', 'contacted'])->update(['status' => 'reviewed']);
        Schema::table('applications', function (Blueprint $table) {
            $table->dropColumn(['shortlisted_at', 'contacted_at', 'hire_start_date']);
        });
        Schema::table('applications', function (Blueprint $table) {
            $table->enum('status', self::BEFORE)->default('pending')->change();
        });
    }
};
