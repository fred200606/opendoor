<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Every SOAP registry check an admin runs (audit trail). The number and registry type that
     * were checked are kept, so a check of an old number is not shown once the employer changes it.
     */
    public function up(): void
    {
        Schema::create('registry_checks', function (Blueprint $table) {
            $table->id();
            $table->foreignId('employer_id')->constrained()->cascadeOnDelete();
            $table->string('business_reg_no', 50);
            $table->enum('registry_type', ['DTI', 'SEC']);
            $table->enum('status', ['ACTIVE', 'EXPIRED', 'CANCELLED', 'NOT_FOUND', 'ERROR']);
            $table->string('registered_name')->nullable();
            $table->decimal('name_match_score', 3, 2)->nullable();
            $table->text('raw_response')->nullable();
            $table->foreignId('checked_by')->constrained('users')->restrictOnDelete();
            $table->timestamp('checked_at');

            $table->index(['employer_id', 'checked_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('registry_checks');
    }
};
