<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * M10: candidates report misleading postings; an admin dismisses the report or records the
     * action taken (optional note, who and when).
     */
    public function up(): void
    {
        Schema::create('reports', function (Blueprint $table) {
            $table->id();
            $table->foreignId('reporter_id')->constrained('users')->restrictOnDelete();
            $table->foreignId('job_posting_id')->constrained()->cascadeOnDelete();
            $table->text('reason');
            $table->enum('status', ['open', 'dismissed', 'actioned'])->default('open');
            $table->text('note')->nullable();
            $table->foreignId('resolved_by')->nullable()->constrained('users')->restrictOnDelete();
            $table->timestamp('resolved_at')->nullable();
            $table->timestamps();

            $table->index(['status', 'created_at']);
            $table->index(['job_posting_id', 'reporter_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('reports');
    }
};
