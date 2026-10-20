<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Decision 2026-10-21: no admin approval step. Postings waiting for approval are published when
 * their company is verified; an unverified company's go back to draft (it must be verified first).
 * The `pending_approval` value stays in the column's enum for older rows but is no longer used.
 */
return new class extends Migration
{
    public function up(): void
    {
        $verified = DB::table('employers')->whereNotNull('verified_at')->select('id');

        DB::table('job_postings')->where('status', 'pending_approval')->whereIn('employer_id', $verified)
            ->update(['status' => 'open', 'is_approved' => true, 'rejection_reason' => null]);

        DB::table('job_postings')->where('status', 'pending_approval')
            ->update(['status' => 'draft', 'is_approved' => false]);
    }

    public function down(): void
    {
        // Nothing to undo: which open postings were pending before is not recorded.
    }
};
