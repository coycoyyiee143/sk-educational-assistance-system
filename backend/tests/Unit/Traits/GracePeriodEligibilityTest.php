<?php

namespace Tests\Unit\Traits;

use App\Models\Application;
use App\Models\ApplicationConfiguration;
use App\Models\ClaimingAssignment;
use App\Models\ClaimingLane;
use App\Models\ClaimingSchedule;
use App\Traits\GracePeriodEligibility;
use Illuminate\Foundation\Testing\RefreshDatabase;
use ReflectionMethod;
use Tests\TestCase;

/**
 * Unit-level coverage for App\Traits\GracePeriodEligibility — the shared
 * "is this claiming_assignments row grace-period-eligible" decision logic
 * used identically by VerifierController::updateClaimStatus()/
 * searchClaiming() and AdminReportController. Exercised here through a
 * tiny anonymous harness class that `use`s the trait directly, with the
 * private methods invoked via reflection — no HTTP/routing/middleware
 * layer involved, only the query-building/branching logic itself.
 */
class GracePeriodEligibilityTest extends TestCase
{
    use RefreshDatabase;

    protected function harness(): object
    {
        return new class {
            use GracePeriodEligibility;
        };
    }

    /** Calls the private applyGracePeriodEligibleCondition() and returns matching assignment ids. */
    protected function eligibleIds(string $today): array
    {
        $harness = $this->harness();
        $method = new ReflectionMethod($harness, 'applyGracePeriodEligibleCondition');
        $method->setAccessible(true);

        $query = ClaimingAssignment::query();
        $method->invoke($harness, $query, $today);

        return $query->pluck('id')->all();
    }

    protected function gracePeriodType(string $source): string
    {
        $harness = $this->harness();
        $method = new ReflectionMethod($harness, 'gracePeriodType');
        $method->setAccessible(true);

        return $method->invoke($harness, $source);
    }

    protected function makeSchedule(?string $graceStart, ?string $graceEnd): ClaimingSchedule
    {
        $config = ApplicationConfiguration::factory()->create();

        return ClaimingSchedule::forceCreate([
            'config_id'             => $config->id,
            'location'              => 'Barangay Hall',
            'is_active'             => true,
            'grace_period_date'     => $graceStart,
            'grace_period_end_date' => $graceEnd,
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

    public function test_grace_period_retry_source_is_always_eligible()
    {
        $today = '2026-10-05';
        $schedule = $this->makeSchedule(null, null);
        $lane = $this->makeLane($schedule, '2026-10-01');
        $assignment = $this->makeAssignment($schedule, $lane, [
            'source'       => 'grace_period_retry',
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

    public function test_original_source_pending_with_lane_day_passed_during_open_grace_period_is_eligible()
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

    public function test_original_source_pending_with_lane_day_passed_but_grace_period_not_yet_open_is_not_eligible()
    {
        $today = '2026-10-05';
        $schedule = $this->makeSchedule('2026-10-08', '2026-10-15'); // grace period hasn't started
        $lane = $this->makeLane($schedule, '2026-10-01');
        $assignment = $this->makeAssignment($schedule, $lane, [
            'source'       => 'original',
            'claim_status' => 'pending_claiming',
        ]);

        $this->assertNotContains($assignment->id, $this->eligibleIds($today));
    }

    public function test_original_source_pending_with_lane_day_passed_but_grace_period_already_ended_is_not_eligible()
    {
        $today = '2026-10-20';
        $schedule = $this->makeSchedule('2026-10-03', '2026-10-10'); // grace period already closed
        $lane = $this->makeLane($schedule, '2026-10-01');
        $assignment = $this->makeAssignment($schedule, $lane, [
            'source'       => 'original',
            'claim_status' => 'pending_claiming',
        ]);

        $this->assertNotContains($assignment->id, $this->eligibleIds($today));
    }

    // ── Group 3: source=original, resolved during grace period ────

    public function test_original_source_resolved_claimed_during_grace_period_window_is_eligible()
    {
        $today = '2026-10-05';
        $schedule = $this->makeSchedule('2026-10-03', '2026-10-10');
        $lane = $this->makeLane($schedule, '2026-10-01');
        $assignment = $this->makeAssignment($schedule, $lane, [
            'source'       => 'original',
            'claim_status' => 'claimed',
            'verified_at'  => '2026-10-04 09:00:00', // on/after grace_period_date
        ]);

        $this->assertContains($assignment->id, $this->eligibleIds($today));
    }

    public function test_original_source_resolved_not_cleared_before_grace_period_started_is_not_eligible()
    {
        $today = '2026-10-05';
        $schedule = $this->makeSchedule('2026-10-03', '2026-10-10');
        $lane = $this->makeLane($schedule, '2026-10-01');
        $assignment = $this->makeAssignment($schedule, $lane, [
            'source'       => 'original',
            'claim_status' => 'not_cleared',
            'verified_at'  => '2026-10-01 09:00:00', // resolved on their normal lane day, before grace period
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

    // ── gracePeriodType() ──────────────────────────────────────────

    public function test_grace_period_type_labels_waitlist_promotion_as_promoted()
    {
        $this->assertEquals('promoted', $this->gracePeriodType('waitlist_promotion'));
    }

    public function test_grace_period_type_labels_grace_period_retry_as_retrying()
    {
        $this->assertEquals('retrying', $this->gracePeriodType('grace_period_retry'));
    }

    public function test_grace_period_type_labels_original_as_retrying()
    {
        $this->assertEquals('retrying', $this->gracePeriodType('original'));
    }
}
