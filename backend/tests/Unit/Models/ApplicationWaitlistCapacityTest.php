<?php

namespace Tests\Unit\Models;

use App\Models\Application;
use App\Models\ApplicationConfiguration;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Unit-level coverage for the capacity/control-number/waitlist decision
 * logic that VerifierController::approve(), promoteFromWaitlist() and
 * promoteAllFromWaitlist() all delegate to — Application::tryApprove(),
 * Application::moveToWaitlist(), Application::promoteNextFromWaitlist()
 * and Application::promoteAllFromWaitlist().
 *
 * These are called directly as static model methods, never through
 * ->postJson()/->actingAs(), so the HTTP/routing/middleware layer that
 * tests/Feature/VerifierWaitlistTest.php and VerifierReviewTest.php
 * already exercise is bypassed entirely here — this isolates the actual
 * capacity-stop / FIFO-ordering / control-number-generation calculations
 * underneath those endpoints.
 */
class ApplicationWaitlistCapacityTest extends TestCase
{
    use RefreshDatabase;

    protected function makeConfig(int $slotLimit, int $slotsFilled, bool $unlimited = false): ApplicationConfiguration
    {
        return ApplicationConfiguration::factory()->create([
            'slot_limit'   => $slotLimit,
            'slots_filled' => $slotsFilled,
            'is_unlimited' => $unlimited,
            'open_date'    => now()->subDays(5),
        ]);
    }

    protected function makeApplication(ApplicationConfiguration $config, array $overrides = []): Application
    {
        return Application::factory()->create(array_merge([
            'config_id' => $config->id,
            'status'    => 'for_review',
        ], $overrides));
    }

    // ── tryApprove() ────────────────────────────────────────────

    public function test_try_approve_assigns_sequential_control_number_and_increments_slots_filled()
    {
        $config = $this->makeConfig(10, 0);
        $app = $this->makeApplication($config);

        $outcome = Application::tryApprove($app);

        $this->assertEquals('approved', $outcome['result']);
        $this->assertNotNull($outcome['control_number']);
        $this->assertStringStartsWith('SK-', $outcome['control_number']);
        $this->assertEquals(1, $config->fresh()->slots_filled);
        $this->assertEquals('approved', $app->fresh()->status);
    }

    public function test_try_approve_returns_no_slots_when_capacity_is_full()
    {
        $config = $this->makeConfig(5, 5);
        $app = $this->makeApplication($config);

        $outcome = Application::tryApprove($app);

        $this->assertEquals('no_slots', $outcome['result']);
        $this->assertNull($outcome['control_number']);
        $this->assertEquals(5, $config->fresh()->slots_filled);
        $this->assertEquals('for_review', $app->fresh()->status);
    }

    public function test_try_approve_ignores_capacity_when_config_is_unlimited()
    {
        $config = $this->makeConfig(1, 1, unlimited: true);
        $app = $this->makeApplication($config);

        $outcome = Application::tryApprove($app);

        $this->assertEquals('approved', $outcome['result']);
        $this->assertEquals(2, $config->fresh()->slots_filled);
    }

    public function test_try_approve_returns_already_approved_without_consuming_a_slot()
    {
        $config = $this->makeConfig(10, 3);
        $app = $this->makeApplication($config, ['status' => 'approved']);

        $outcome = Application::tryApprove($app);

        $this->assertEquals('already_approved', $outcome['result']);
        $this->assertEquals(3, $config->fresh()->slots_filled);
    }

    public function test_try_approve_generates_sequential_control_numbers_across_multiple_approvals()
    {
        $config = $this->makeConfig(10, 0);
        $first = $this->makeApplication($config);
        $second = $this->makeApplication($config);

        $firstOutcome = Application::tryApprove($first);
        $secondOutcome = Application::tryApprove($second);

        $this->assertNotEquals($firstOutcome['control_number'], $secondOutcome['control_number']);
        $this->assertEquals(2, $config->fresh()->slots_filled);
    }

    // ── moveToWaitlist() ────────────────────────────────────────

    public function test_move_to_waitlist_sets_status_and_timestamp()
    {
        $config = $this->makeConfig(5, 5);
        $app = $this->makeApplication($config);

        Application::moveToWaitlist($app);

        $fresh = $app->fresh();
        $this->assertEquals('waitlisted', $fresh->status);
        $this->assertNotNull($fresh->waitlisted_at);
    }

    // ── promoteNextFromWaitlist() ───────────────────────────────

    public function test_promote_next_from_waitlist_returns_no_waitlist_when_nobody_is_waiting()
    {
        $config = $this->makeConfig(10, 0);

        $outcome = Application::promoteNextFromWaitlist($config->id);

        $this->assertEquals('no_waitlist', $outcome['result']);
        $this->assertNull($outcome['application']);
    }

    public function test_promote_next_from_waitlist_picks_the_longest_waiting_applicant_first()
    {
        $config = $this->makeConfig(10, 9);
        $recentlyWaitlisted = $this->makeApplication($config, [
            'status'        => 'waitlisted',
            'waitlisted_at' => now()->subMinutes(1),
        ]);
        $longestWaiting = $this->makeApplication($config, [
            'status'        => 'waitlisted',
            'waitlisted_at' => now()->subDays(2),
        ]);

        $outcome = Application::promoteNextFromWaitlist($config->id);

        $this->assertEquals('approved', $outcome['result']);
        $this->assertEquals($longestWaiting->id, $outcome['application']->id);
        $this->assertEquals('waitlisted', $recentlyWaitlisted->fresh()->status);
    }

    public function test_promote_next_from_waitlist_returns_no_slots_when_capacity_already_full()
    {
        $config = $this->makeConfig(5, 5);
        $waiting = $this->makeApplication($config, [
            'status'        => 'waitlisted',
            'waitlisted_at' => now(),
        ]);

        $outcome = Application::promoteNextFromWaitlist($config->id);

        $this->assertEquals('no_slots', $outcome['result']);
        $this->assertNull($outcome['application']);
        $this->assertEquals('waitlisted', $waiting->fresh()->status);
    }

    // ── promoteAllFromWaitlist() ────────────────────────────────

    public function test_promote_all_from_waitlist_stops_once_capacity_is_reached()
    {
        $config = $this->makeConfig(10, 8);
        $first = $this->makeApplication($config, ['status' => 'waitlisted', 'waitlisted_at' => now()->subMinutes(10)]);
        $second = $this->makeApplication($config, ['status' => 'waitlisted', 'waitlisted_at' => now()->subMinutes(5)]);
        $third = $this->makeApplication($config, ['status' => 'waitlisted', 'waitlisted_at' => now()]);

        $promoted = Application::promoteAllFromWaitlist($config->id);

        $this->assertCount(2, $promoted);
        $this->assertEquals($first->id, $promoted[0]->id);
        $this->assertEquals($second->id, $promoted[1]->id);
        $this->assertEquals('waitlisted', $third->fresh()->status);
        $this->assertEquals(10, $config->fresh()->slots_filled);
    }

    public function test_promote_all_from_waitlist_returns_empty_array_when_no_capacity_available()
    {
        $config = $this->makeConfig(5, 5);
        $this->makeApplication($config, ['status' => 'waitlisted', 'waitlisted_at' => now()]);

        $promoted = Application::promoteAllFromWaitlist($config->id);

        $this->assertSame([], $promoted);
    }

    public function test_promote_all_from_waitlist_returns_empty_array_when_waitlist_is_empty()
    {
        $config = $this->makeConfig(10, 0);

        $promoted = Application::promoteAllFromWaitlist($config->id);

        $this->assertSame([], $promoted);
    }
}
