<?php

namespace Tests\Feature;

use Tests\TestCase;
use App\Models\User;
use App\Models\Application;
use App\Models\ApplicationConfiguration;
use App\Models\ClaimingSchedule;
use App\Models\ClaimingLane;
use App\Models\ClaimingAssignment;
use App\Models\AuditLog;
use Illuminate\Foundation\Testing\RefreshDatabase;

/**
 * Covers VerifierController::searchClaiming, claimingLanes, selfAssignLane
 * and activityLog — the claiming-day operations side of the controller.
 * updateClaimStatus's not_cleared/claimed/unclaimed reason handling is
 * already covered in VerifierReasonCategoriesTest.php and is not
 * duplicated here.
 */
class VerifierClaimingOpsTest extends TestCase
{
    use RefreshDatabase;

    protected function makeVerifier()
    {
        return User::factory()->create(['role' => 'sk_verifier']);
    }

    protected function makeApplicant()
    {
        return User::factory()->create(['role' => 'applicant']);
    }

    protected function makeSchedule(ApplicationConfiguration $config): ClaimingSchedule
    {
        return ClaimingSchedule::create([
            'config_id' => $config->id,
            'location'  => 'Barangay Hall',
            'is_active' => true,
        ]);
    }

    protected function makeLane(ClaimingSchedule $schedule, string $name = 'Lane A', ?string $date = null, ?int $verifierId = null): ClaimingLane
    {
        return ClaimingLane::create([
            'claiming_schedule_id' => $schedule->id,
            'lane_name'            => $name,
            'capacity'             => 50,
            'batch'                => 'morning',
            'claiming_date'        => $date ?? now()->toDateString(),
            'verifier_id'          => $verifierId,
        ]);
    }

    // ── searchClaiming() ────────────────────────────────────────

    public function test_verifier_can_search_claiming_by_control_number()
    {
        $verifier = $this->makeVerifier();
        $config = ApplicationConfiguration::factory()->create(['is_active' => true]);
        $schedule = $this->makeSchedule($config);
        $lane = $this->makeLane($schedule);

        $app = Application::factory()->create([
            'config_id'      => $config->id,
            'status'         => 'approved',
            'control_number' => 'SK-2026-0007',
        ]);
        ClaimingAssignment::create([
            'application_id'       => $app->id,
            'claiming_schedule_id' => $schedule->id,
            'claiming_lane_id'     => $lane->id,
            'claim_status'         => 'pending_claiming',
            'source'               => 'original',
        ]);

        $response = $this->actingAs($verifier, 'sanctum')
            ->getJson('/api/verifier/claiming/search?control_number=SK-2026-0007');

        $response->assertOk();
        $response->assertJsonFragment(['id' => $app->id]);
    }

    public function test_search_claiming_returns_404_when_nothing_matches()
    {
        $verifier = $this->makeVerifier();
        ApplicationConfiguration::factory()->create(['is_active' => true]);

        $response = $this->actingAs($verifier, 'sanctum')
            ->getJson('/api/verifier/claiming/search?control_number=NOPE');

        $response->assertStatus(404);
    }

    public function test_search_claiming_returns_404_when_no_active_period()
    {
        $verifier = $this->makeVerifier();

        $response = $this->actingAs($verifier, 'sanctum')
            ->getJson('/api/verifier/claiming/search?control_number=SK-2026-0001');

        $response->assertStatus(404);
    }

    public function test_non_verifier_cannot_search_claiming()
    {
        $applicant = $this->makeApplicant();

        $response = $this->actingAs($applicant, 'sanctum')
            ->getJson('/api/verifier/claiming/search?control_number=SK-2026-0001');

        $response->assertStatus(403);
    }

    // ── claimingLanes() ─────────────────────────────────────────

    public function test_claiming_lanes_lists_lanes_and_the_verifiers_own_assignment()
    {
        $verifier = $this->makeVerifier();
        $config = ApplicationConfiguration::factory()->create(['is_active' => true]);
        $schedule = $this->makeSchedule($config);
        $myLane = $this->makeLane($schedule, 'Lane A', now()->toDateString(), $verifier->id);
        $otherLane = $this->makeLane($schedule, 'Lane B', now()->toDateString());

        $response = $this->actingAs($verifier, 'sanctum')
            ->getJson('/api/verifier/claiming/lanes');

        $response->assertOk();
        $response->assertJsonPath('assigned_lane.id', $myLane->id);
        $response->assertJsonCount(2, 'all_lanes');
    }

    public function test_claiming_lanes_excludes_the_grace_period_lane()
    {
        $verifier = $this->makeVerifier();
        $config = ApplicationConfiguration::factory()->create(['is_active' => true]);
        $schedule = $this->makeSchedule($config);
        $this->makeLane($schedule, 'Lane A');
        $this->makeLane($schedule, 'Grace Period Claiming');

        $response = $this->actingAs($verifier, 'sanctum')
            ->getJson('/api/verifier/claiming/lanes');

        $response->assertOk();
        $response->assertJsonCount(1, 'all_lanes');
    }

    public function test_claiming_lanes_returns_empty_when_no_active_schedule()
    {
        $verifier = $this->makeVerifier();
        ApplicationConfiguration::factory()->create(['is_active' => true]);

        $response = $this->actingAs($verifier, 'sanctum')
            ->getJson('/api/verifier/claiming/lanes');

        $response->assertOk();
        $response->assertJson(['assigned_lane' => null, 'all_lanes' => []]);
    }

    public function test_non_verifier_cannot_view_claiming_lanes()
    {
        $applicant = $this->makeApplicant();

        $response = $this->actingAs($applicant, 'sanctum')
            ->getJson('/api/verifier/claiming/lanes');

        $response->assertStatus(403);
    }

    // ── selfAssignLane() ────────────────────────────────────────

    public function test_verifier_can_self_assign_an_unstaffed_lane()
    {
        $verifier = $this->makeVerifier();
        $config = ApplicationConfiguration::factory()->create(['is_active' => true]);
        $schedule = $this->makeSchedule($config);
        $lane = $this->makeLane($schedule, 'Lane A');

        $response = $this->actingAs($verifier, 'sanctum')
            ->postJson("/api/verifier/claiming/lanes/{$lane->id}/self-assign");

        $response->assertOk();
        $this->assertDatabaseHas('claiming_lanes', ['id' => $lane->id, 'verifier_id' => $verifier->id]);
    }

    public function test_self_assigning_a_new_lane_clears_the_verifiers_previous_lane()
    {
        $verifier = $this->makeVerifier();
        $config = ApplicationConfiguration::factory()->create(['is_active' => true]);
        $schedule = $this->makeSchedule($config);
        $oldLane = $this->makeLane($schedule, 'Lane A', now()->toDateString(), $verifier->id);
        $newLane = $this->makeLane($schedule, 'Lane B');

        $response = $this->actingAs($verifier, 'sanctum')
            ->postJson("/api/verifier/claiming/lanes/{$newLane->id}/self-assign");

        $response->assertOk();
        $this->assertDatabaseHas('claiming_lanes', ['id' => $newLane->id, 'verifier_id' => $verifier->id]);
        $this->assertDatabaseHas('claiming_lanes', ['id' => $oldLane->id, 'verifier_id' => null]);
    }

    public function test_self_assign_fails_when_already_assigned_to_that_lane()
    {
        $verifier = $this->makeVerifier();
        $config = ApplicationConfiguration::factory()->create(['is_active' => true]);
        $schedule = $this->makeSchedule($config);
        $lane = $this->makeLane($schedule, 'Lane A', now()->toDateString(), $verifier->id);

        $response = $this->actingAs($verifier, 'sanctum')
            ->postJson("/api/verifier/claiming/lanes/{$lane->id}/self-assign");

        $response->assertStatus(400);
    }

    public function test_self_assign_on_a_lane_staffed_by_someone_else_only_records_a_request()
    {
        $verifier = $this->makeVerifier();
        $otherVerifier = $this->makeVerifier();
        $config = ApplicationConfiguration::factory()->create(['is_active' => true]);
        $schedule = $this->makeSchedule($config);
        $lane = $this->makeLane($schedule, 'Lane A', now()->toDateString(), $otherVerifier->id);

        $response = $this->actingAs($verifier, 'sanctum')
            ->postJson("/api/verifier/claiming/lanes/{$lane->id}/self-assign");

        $response->assertOk();
        // Lane stays with the original verifier — only a request is recorded.
        $this->assertDatabaseHas('claiming_lanes', [
            'id'                     => $lane->id,
            'verifier_id'            => $otherVerifier->id,
            'requested_verifier_id'  => $verifier->id,
        ]);
    }

    public function test_non_verifier_cannot_self_assign_a_lane()
    {
        $applicant = $this->makeApplicant();
        $config = ApplicationConfiguration::factory()->create(['is_active' => true]);
        $schedule = $this->makeSchedule($config);
        $lane = $this->makeLane($schedule, 'Lane A');

        $response = $this->actingAs($applicant, 'sanctum')
            ->postJson("/api/verifier/claiming/lanes/{$lane->id}/self-assign");

        $response->assertStatus(403);
    }

    // ── activityLog() ───────────────────────────────────────────

    public function test_activity_log_returns_only_the_logged_in_verifiers_own_entries()
    {
        $verifier = $this->makeVerifier();
        $otherVerifier = $this->makeVerifier();

        AuditLog::create([
            'user_id'     => $verifier->id,
            'action'      => 'application_approved',
            'description' => 'Approved application #1',
        ]);
        AuditLog::create([
            'user_id'     => $otherVerifier->id,
            'action'      => 'application_rejected',
            'description' => 'Rejected application #2',
        ]);

        $response = $this->actingAs($verifier, 'sanctum')
            ->getJson('/api/verifier/activity-log');

        $response->assertOk();
        $response->assertJsonCount(1, 'data');
        $response->assertJsonFragment(['description' => 'Approved application #1']);
    }

    public function test_activity_log_is_paginated()
    {
        $verifier = $this->makeVerifier();
        for ($i = 0; $i < 3; $i++) {
            AuditLog::create([
                'user_id'     => $verifier->id,
                'action'      => 'application_approved',
                'description' => "Approved application #{$i}",
            ]);
        }

        $response = $this->actingAs($verifier, 'sanctum')
            ->getJson('/api/verifier/activity-log');

        $response->assertOk();
        $response->assertJsonStructure(['data', 'current_page', 'per_page', 'total']);
    }

    public function test_non_verifier_cannot_view_activity_log()
    {
        $applicant = $this->makeApplicant();

        $response = $this->actingAs($applicant, 'sanctum')
            ->getJson('/api/verifier/activity-log');

        $response->assertStatus(403);
    }
}
