<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('job_postings', function (Blueprint $table) {
            $table->id();
            $table->foreignId('employer_id')->constrained()->restrictOnDelete();
            // restrictOnDelete: a category in use cannot be deleted (Admin\CategoryController).
            $table->foreignId('category_id')->constrained()->restrictOnDelete();
            $table->string('title');
            $table->text('description');
            $table->string('address');
            $table->string('location_psgc', 10)->nullable();
            $table->string('location_label')->nullable();
            $table->enum('employment_type', ['full_time', 'part_time', 'contract', 'internship']);
            $table->enum('work_setup', ['onsite', 'hybrid', 'remote']);
            $table->enum('interview_format', ['online', 'onsite']);
            $table->enum('status', ['draft', 'pending_approval', 'open', 'closed'])->default('draft');
            $table->date('closes_at');
            $table->boolean('is_approved')->default(false);
            $table->string('rejection_reason', 1000)->nullable();
            $table->softDeletes();
            $table->timestamps();

            $table->index(['status', 'category_id']);
            $table->index(['employer_id', 'status']);

            // Keyword search (M5). SQLite (tests) has no FULLTEXT; search falls back to LIKE there.
            if (Schema::getConnection()->getDriverName() === 'mysql') {
                $table->fullText(['title', 'description']);
            }
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('job_postings');
    }
};
