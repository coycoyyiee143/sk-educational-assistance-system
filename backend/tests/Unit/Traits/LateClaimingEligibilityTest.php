<?php

namespace Tests\Unit\Traits;

use App\Models\Application;
use App\Models\ApplicationConfiguration;
use App\Models\ClaimingAssignment;
use App\Models\ClaimingLane;
use App\Models\ClaimingSchedule;
use App\Traits\LateClaimingEligibility;
use Illuminate\Foundation\Testing\RefreshDatabase;
use ReflectionMethod;
use Tests\TestCase;

/**
 * Unit-level coverage for App\Traits\LateClaimingEligibility — the shared
 * "is this claiming_assignments row Late-Claiming-eligible" decision logic
 * used identically by VerifierController::updateClaimStatus()/
 * searchClaiming() and AdminReportController. Exercised here through a
 * tiny anonymous harness class that `use`s the trait directly, with the
 * private methods invoked via reflection — no HTTP/routing/middleware
 * layer involved, only the query-building/branching logic itself.
 */
class LateClaimingEligibilityTest extends TestCase
{
    use RefreshDatabase;

    protected function harness(): object
    {
        return new class {
            use LateClaimingEligibility;
        };
    }

    /** Calls the private applyLateClaimingEligibleCondition() and returns matching assignment ids. */
    protected function eligibleIds(string $today): array
    {
        $harness = $this->harness();
        $method = new ReflectionMethod($harness, 'applyLateClaimingEligibleCondition');
        $method->setAccessible(true);

        $query = ClaimingAssignment::query();
        $method->invoke($harness, $query, $today);

        return $query->pluck('id')->all();
    }

    protected function lateClaimingType(string $source): string
    {
        $harness = $this->harness();
        $method = new ReflectionMethod($harness, 'lateClaimingType');
        $method->setAccessible(true);

        return $method->invoke($harness, $source);
    }

    protected function makeSchedule(?string $lateClaimingStart, ?string $lateClaimingEnd): ClaimingSchedule
    {
        $config = ApplicationConfiguration::factory()->create();

        return ClaimingSchedule::forceCreate([
            'config_id'              => $config->id,
            'location'               => 'Barangay Hall',
            'is_active'              => true,
            'late_claiming_date'     => $lateClaimingStart,
            'late_claiming_end_date' => $lateClaimingEnd,
        ]);
    }

    protected function makeLane(ClaimingSchedule $schedule, string $claimingDate): ClaimingLane
    {
        return ClaimingLane::create([
            'claiming_schedule_id' => $schedule->id,
            'lane_name'            => 'Lane A',
            'capacity'             => 10,
            'batch'                => 'morning',
            'claiming_date'        => $claimingDate,
        ]);
    }

    protected function makeAssignment(ClaimingSchedule $schedule, ClaimingLane $lane, array $overrides = []): ClaimingAssignment
    {
        $app = Application::factory()->create(['config_id' => $schedule->config_id, 'status' => 'approved']);

        return ClaimingAssignment::create(array_merge([
            'application_id'       => $app->id,
            'claiming_schedule_id' => $schedule->id,
            'claiming_lane_id'     => $lane->id,
            'claim_status'         => 'pending_claiming',
            'source'               => 'original',
        ], $overrides));
    }

    // ── Group 1: promotion/retry sources — always eligible ────────

    public function test_waitlist_promotion_source_is_always_eligible_regardless_of_claim_status()
    {
        $today = '2026-10-05';
        $schedule = $this->makeSchedule(null, null);
        $lane = $this->makeLane($schedule, '2026-10-01');
        $assignment = $this->makeAssignment($schedule, $lane, [
            'source'       => 'waitlist_promotion',
            'claim_status' => 'pending_claiming',
        ]);

        $this->assertContains($assignment->id, $this->eligibleIds($today));
    }

    public function test_late_claiming_retry_source_is_always_eligible()
    {
        $today = '2026-10-05';
        $schedule = $this->makeSchedule(null, null);
        $lane = $this->makeLane($schedule, '2026-10-01');
        $assignment = $this->makeAssignment($schedule, $lane, [
            'source'       => 'late_claiming_retry',
            'claim_status' => 'claimed',
        ]);

        $this->assertContains($assignment->id, $this->eligibleIds($today));
    }

    // ── Group 2: source=original, unresolved ──────────────────────

    public function test_original_source_finalized_unclaimed_is_eligible()
    {
        $today = '2026-10-05';
        $schedule = $this->makeSchedule(null, null);
        $lane = $this->makeLane($schedule, '2026-10-01');
        $assignment = $this->makeAssignment($schedule, $lane, [
            'source'       => 'original',
            'claim_status' => 'unclaimed',
        ]);

        $this->assertContains($assignment->id, $this->eligibleIds($today));
    }

    public function test_original_source_pending_with_lane_day_passed_during_open_late_claiming_is_eligible()
    {
        $today = '2026-10-05';
        $schedule = $this->makeSchedule('2026-10-03', '2026-10-10');
        $lane = $this->makeLane($schedule, '2026-10-01'); // lane day already passed
        $assignment = $this->makeAssignment($schedule, $lane, [
            'source'       => 'original',
            'claim_status' => 'pending_claiming',
        ]);

        $this->assertContains($assignment->id, $this->eligibleIds($today));
    }

    public function test_original_source_pending_with_lane_day_not_yet_passed_is_not_eligible()
    {
        $today = '2026-10-05';
        $schedule = $this->makeSchedule('2026-10-03', '2026-10-10');
        $lane = $this->makeLane($schedule, '2026-10-06'); // still upcoming
        $assignment = $this->makeAssignment($schedule, $lane, [
            'source'       => 'original',
            'claim_status' => 'pending_claiming',
        ]);

        $this->assertNotContains($assignment->id, $this->eligibleIds($today));
    }

    public function test_original_source_pending_with_lane_day_passed_but_late_claiming_not_yet_open_is_not_eligible()
    {
        $today = '2026-10-05';
        $schedule = $this->makeSchedule('2026-10-08', '2026-10-15'); // Late Claiming hasn't started
        $lane = $this->makeLane($schedule, '2026-10-01');
        $assignment = $this->makeAssignment($schedule, $lane, [
            'source'       => 'original',
            'claim_status' => 'pending_claiming',
        ]);

        $this->assertNotContains($assignment->id, $this->eligibleIds($today));
    }

    public function test_original_source_pending_with_lane_day_passed_but_late_claiming_already_ended_is_not_eligible()
    {
        $today = '2026-10-20';
        $schedule = $this->makeSchedule('2026-10-03', '2026-10-10'); // Late Claiming already closed
        $lane = $this->makeLane($schedule, '2026-10-01');
        $assignment = $this->makeAssignment($schedule, $lane, [
            'source'       => 'original',
            'claim_status' => 'pending_claiming',
        ]);

        $this->assertNotContains($assignment->id, $this->eligibleIds($today));
    }

    // ── Group 3: source=original, resolved during Late Claiming ────

    public function test_original_source_resolved_claimed_during_late_claiming_window_is_eligible()
    {
        $today = '2026-10-05';
        $schedule = $this->makeSchedule('2026-10-03', '2026-10-10');
        $lane = $this->makeLane($schedule, '2026-10-01');
        $assignment = $this->makeAssignment($schedule, $lane, [
            'source'       => 'original',
            'claim_status' => 'claimed',
            'verified_at'  => '2026-10-04 09:00:00', // on/after late_claiming_date
        ]);

        $this->assertContains($assignment->id, $this->eligibleIds($today));
    }

    public function test_original_source_resolved_not_cleared_before_late_claiming_started_is_not_eligible()
    {
        $today = '2026-10-05';
        $schedule = $this->makeSchedule('2026-10-03', '2026-10-10');
        $lane = $this->makeLane($schedule, '2026-10-01');
        $assignment = $this->makeAssignment($schedule, $lane, [
            'source'       => 'original',
            'claim_status' => 'not_cleared',
            'verified_at'  => '2026-10-01 09:00:00', // resolved on their normal lane day, before Late Claiming
        ]);

        $this->assertNotContains($assignment->id, $this->eligibleIds($today));
    }

    public function test_original_source_resolved_without_verified_at_is_not_eligible()
    {
        $today = '2026-10-05';
        $schedule = $this->makeSchedule('2026-10-03', '2026-10-10');
        $lane = $this->makeLane($schedule, '2026-10-01');
        $assignment = $this->makeAssignment($schedule, $lane, [
            'source'       => 'original',
            'claim_status' => 'claimed',
            'verified_at'  => null,
        ]);

        $this->assertNotContains($assignment->id, $this->eligibleIds($today));
    }

    // ── lateClaimingType() ──────────────────────────────────────────

    public function test_late_claiming_type_labels_waitlist_promotion_as_promoted()
    {
        $this->assertEquals('promoted', $this->lateClaimingType('waitlist_promotion'));
    }

    public function test_late_claiming_type_labels_late_claiming_retry_as_retrying()
    {
        $this->assertEquals('retrying', $this->lateClaimingType('late_claiming_retry'));
    }

    public function test_late_claiming_type_labels_original_as_retrying()
    {
        $this->assertEquals('retrying', $this->lateClaimingType('original'));
    }
}
