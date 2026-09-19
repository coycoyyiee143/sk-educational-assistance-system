<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

// Data-only migration: the special claiming lane the system auto-creates
// for the "Grace Period" window is being renamed to "Late Claiming" in the
// UI and in the code that creates/queries it (see AdminScheduleController,
// VerifierController, ClaimingAssignmentService, ApplicationConfigurationController,
// SweepUnclaimedAssignments). Existing lanes already stored with the old
// lane_name need updating too, or they'd keep showing the old label.
return new class extends Migration
{
    public function up(): void
    {
        DB::table('claiming_lanes')
            ->where('lane_name', 'Grace Period Claiming')
            ->update(['lane_name' => 'Late Claiming']);
    }

    public function down(): void
    {
        DB::table('claiming_lanes')
            ->where('lane_name', 'Late Claiming')
            ->update(['lane_name' => 'Grace Period Claiming']);
    }
};
