<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Never hard-deleted: hired applications carry the feedback and the trust score (Phase 5).
        Schema::create('applications', function (Blueprint $table) {
            $table->id();
            $table->foreignId('job_posting_id')->constrained()->restrictOnDelete();
            $table->foreignId('candidate_profile_id')->constrained()->restrictOnDelete();
            $table->enum('status', ['pending', 'reviewed', 'hired', 'rejected', 'withdrawn'])->default('pending');
            $table->text('cover_note')->nullable();
            $table->text('interview_request')->nullable();
            $table->timestamp('hired_at')->nullable();
            $table->enum('hire_confirmed_by', ['employer', 'candidate'])->nullable();
            $table->timestamps();

            $table->unique(['job_posting_id', 'candidate_profile_id']);
            $table->index(['candidate_profile_id', 'status']);
            $table->index(['job_posting_id', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('applications');
    }
};
