<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

// Onboarding for first-time users (decision 2026-10-14): the welcome tour and the dashboard's
// "Get started" list. Accounts that exist already are not first-time users: they start as done.
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->boolean('onboarding_tour_done')->default(false)->after('email_notifications');
            $table->boolean('onboarding_checklist_hidden')->default(false)->after('onboarding_tour_done');
        });

        DB::table('users')->update(['onboarding_tour_done' => true, 'onboarding_checklist_hidden' => true]);
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn(['onboarding_tour_done', 'onboarding_checklist_hidden']);
        });
    }
};
