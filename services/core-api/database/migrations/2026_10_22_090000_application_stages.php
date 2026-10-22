<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Decision 2026-10-22a: the stages the candidate sees are Submitted → Under review → Shortlisted →
 * Contacted, and Contacted replaces Hired (it opens the accommodation rating 30 days later).
 * Existing hired applications become contacted, keeping their date and who confirmed it.
 */
return new class extends Migration
{
    private const BEFORE = ['pending', 'reviewed', 'hired', 'rejected', 'withdrawn'];

    private const BOTH = ['pending', 'reviewed', 'shortlisted', 'contacted', 'hired', 'rejected', 'withdrawn'];

    private const AFTER = ['pending', 'reviewed', 'shortlisted', 'contacted', 'rejected', 'withdrawn'];

    public function up(): void
    {
        Schema::table('applications', function (Blueprint $table) {
            $table->enum('status', self::BOTH)->default('pending')->change();
        });
        DB::table('applications')->where('status', 'hired')->update(['status' => 'contacted']);

        Schema::table('applications', function (Blueprint $table) {
            $table->enum('status', self::AFTER)->default('pending')->change();
            $table->renameColumn('hired_at', 'contacted_at');
            $table->renameColumn('hire_confirmed_by', 'contact_confirmed_by');
        });
        Schema::table('applications', function (Blueprint $table) {
            $table->timestamp('shortlisted_at')->nullable()->after('reviewed_at');
        });
    }

    public function down(): void
    {
        Schema::table('applications', function (Blueprint $table) {
            $table->dropColumn('shortlisted_at');
            $table->renameColumn('contacted_at', 'hired_at');
            $table->renameColumn('contact_confirmed_by', 'hire_confirmed_by');
            $table->enum('status', self::BOTH)->default('pending')->change();
        });
        // Shortlisted has no older equivalent: it goes back to reviewed.
        DB::table('applications')->where('status', 'contacted')->update(['status' => 'hired']);
        DB::table('applications')->where('status', 'shortlisted')->update(['status' => 'reviewed']);

        Schema::table('applications', function (Blueprint $table) {
            $table->enum('status', self::BEFORE)->default('pending')->change();
        });
    }
};
