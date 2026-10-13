<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

// "Where it stands" timeline (decision 2026-10-13): when the employer first reviewed the application.
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('applications', function (Blueprint $table) {
            $table->timestamp('reviewed_at')->nullable()->after('status');
        });

        // Applications still at "reviewed" last changed when they were reviewed. For later
        // statuses the review time was not kept, so it stays empty.
        DB::table('applications')->where('status', 'reviewed')->update(['reviewed_at' => DB::raw('updated_at')]);
    }

    public function down(): void
    {
        Schema::table('applications', function (Blueprint $table) {
            $table->dropColumn('reviewed_at');
        });
    }
};
