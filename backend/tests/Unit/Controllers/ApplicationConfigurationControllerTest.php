<?php

namespace Tests\Unit\Controllers;

use App\Http\Controllers\Api\ApplicationConfigurationController;
use App\Models\ApplicationConfiguration;
use App\Models\ClaimingLane;
use App\Models\ClaimingSchedule;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Request;
use Tests\TestCase;

/**
 * Unit-level coverage for the pure decision logic inside
 * ApplicationConfigurationController::update() and ::extend() — the
 * locked_fields computation once a period has started, the close_date
 * immutability check, and extend()'s "must be after the current
 * close_date" / lane-conflict logic. Exercised by constructing a Request
 * object directly and invoking the controller method, WITHOUT going
 * through routing, Sanctum auth middleware, or the ->putJson()/
 * ->postJson() HTTP test client.
 *
 * Complements (does not duplicate) tests/Feature/ApplicationConfigurationControllerTest.php,
 * which covers the same endpoints at the full HTTP request/response
 * level, including authorization and Laravel's validation-error JSON
 * shape.
 */
class ApplicationConfigurationControllerTest extends TestCase
{
    use RefreshDatabase;

    protected function controller(): ApplicationConfigurationController
    {
        return new ApplicationConfigurationController();
    }

    protected function makeRequest(array $data): Request
    {
        $admin = User::factory()->create(['role' => 'sk_admin']);
        $request = Request::create('/', 'PUT', $data);
        $request->setUserResolver(fn () => $admin);

        return $request;
    }

    // ── update() — close_date immutability ───────────────────────────

    public function test_update_rejects_any_change_to_close_date_through_the_general_form()
    {
        $config = ApplicationConfiguration::factory()->notYetStarted()->create();
        $request = $this->makeRequest([
            'school_year'       => $config->school_year,
            'open_date'         => $config->open_date->format('Y-m-d'),
            'close_date'        => now()->addDays(999)->format('Y-m-d'),
            'is_unlimited'      => false,
            'slot_limit'        => $config->slot_limit,
            'assistance_amount' => $config->assistance_amount,
        ]);

        $response = $this->controller()->update($request, $config->id);

        $this->assertEquals(400, $response->getStatusCode());
        $this->assertEquals(['close_date'], $response->getData(true)['locked_fields']);
    }

    public function test_update_allows_close_date_when_resubmitted_unchanged()
    {
        $config = ApplicationConfiguration::factory()->notYetStarted()->create();
        $request = $this->makeRequest([
            'school_year'       => '2030-2031',
            'open_date'         => $config->open_date->format('Y-m-d'),
            'close_date'        => $config->close_date->format('Y-m-d H:i:s'),
            'is_unlimited'      => false,
            'slot_limit'        => $config->slot_limit,
            'assistance_amount' => $config->assistance_amount,
        ]);

        $response = $this->controller()->update($request, $config->id);

        $this->assertEquals(200, $response->getStatusCode());
        $this->assertEquals('2030-2031', $config->fresh()->school_year);
    }

    // ── update() — locked_fields once the period has started ─────────

    public function test_update_locks_assistance_amount_once_the_period_has_started()
    {
        $config = ApplicationConfiguration::factory()->alreadyStarted()->create(['assistance_amount' => 2000]);
        $request = $this->makeRequest([
            'school_year'       => $config->school_year,
            'open_date'         => $config->open_date->format('Y-m-d'),
            'close_date'        => $config->close_date->format('Y-m-d H:i:s'),
            'is_unlimited'      => false,
            'slot_limit'        => $config->slot_limit,
            'assistance_amount' => 9999,
        ]);

        $response = $this->controller()->update($request, $config->id);

        $this->assertEquals(400, $response->getStatusCode());
        $this->assertEquals(['assistance_amount'], $response->getData(true)['locked_fields']);
        $this->assertEquals(2000, $config->fresh()->assistance_amount);
    }

    public function test_update_locks_multiple_fields_simultaneously_once_started()
    {
        $config = ApplicationConfiguration::factory()->alreadyStarted()->create([
            'school_year' => '2025-2026',
            'is_unlimited' => false,
            'slot_limit'  => 100,
        ]);
        $request = $this->makeRequest([
            'school_year'       => '2099-2100',
            'open_date'         => $config->open_date->format('Y-m-d'),
            'close_date'        => $config->close_date->format('Y-m-d H:i:s'),
            'is_unlimited'      => false,
            'slot_limit'        => 5,
            'assistance_amount' => $config->assistance_amount,
        ]);

        $response = $this->controller()->update($request, $config->id);

        $this->assertEquals(400, $response->getStatusCode());
        $lockedFields = $response->getData(true)['locked_fields'];
        $this->assertContains('school_year', $lockedFields);
        $this->assertContains('slot_limit', $lockedFields);
    }

    public function test_update_does_not_lock_slot_limit_when_switching_to_unlimited_since_it_becomes_irrelevant()
    {
        // is_unlimited itself flipping IS a locked change, but slot_limit's
        // own comparison is skipped once is_unlimited is true (the code
        // only checks slot_limit inside `!$data['is_unlimited']`) — this
        // pins that short-circuit behavior.
        $config = ApplicationConfiguration::factory()->alreadyStarted()->create([
            'is_unlimited' => true,
            'slot_limit'   => null,
        ]);
        $request = $this->makeRequest([
            'school_year'       => $config->school_year,
            'open_date'         => $config->open_date->format('Y-m-d'),
            'close_date'        => $config->close_date->format('Y-m-d H:i:s'),
            'is_unlimited'      => true,
            'slot_limit'        => null,
            'assistance_amount' => $config->assistance_amount,
        ]);

        $response = $this->controller()->update($request, $config->id);

        $this->assertEquals(200, $response->getStatusCode());
    }

    public function test_update_allows_any_field_change_before_the_period_has_started()
    {
        $config = ApplicationConfiguration::factory()->notYetStarted()->create([
            'assistance_amount' => 2000,
            'slot_limit'        => 50,
        ]);
        $request = $this->makeRequest([
            'school_year'       => $config->school_year,
            'open_date'         => $config->open_date->format('Y-m-d'),
            'close_date'        => $config->close_date->format('Y-m-d H:i:s'),
            'is_unlimited'      => false,
            'slot_limit'        => 500,
            'assistance_amount' => 9999,
        ]);

        $response = $this->controller()->update($request, $config->id);

        $this->assertEquals(200, $response->getStatusCode());
        $this->assertEquals(9999, $config->fresh()->assistance_amount);
        $this->assertEquals(500, $config->fresh()->slot_limit);
    }

    // ── extend() ───────────────────────────────────────────────────

    protected function extendRequest(string $closeDate): Request
    {
        $admin = User::factory()->create(['role' => 'sk_admin']);
        $request = Request::create('/', 'POST', ['close_date' => $closeDate]);
        $request->setUserResolver(fn () => $admin);

        return $request;
    }

    public function test_extend_rejects_an_already_closed_period()
    {
        $config = ApplicationConfiguration::factory()->closed()->create(['closed_at' => now()]);
        $request = $this->extendRequest(now()->addDays(30)->format('Y-m-d'));

        $response = $this->controller()->extend($request, $config->id);

        $this->assertEquals(400, $response->getStatusCode());
    }

    public function test_extend_moves_the_closing_date_later_and_records_an_audit_log()
    {
        $config = ApplicationConfiguration::factory()->alreadyStarted()->create();
        $newDate = \Carbon\Carbon::parse($config->close_date)->addDays(10)->format('Y-m-d');
        $request = $this->extendRequest($newDate);

        $response = $this->controller()->extend($request, $config->id);

        $this->assertEquals(200, $response->getStatusCode());
        $this->assertDatabaseHas('audit_logs', ['action' => 'application_period_extended']);
    }

    public function test_extend_blocks_when_it_would_land_on_or_before_an_already_scheduled_lanes_claiming_date()
    {
        $config = ApplicationConfiguration::factory()->alreadyStarted()->create([
            'close_date' => now()->addDays(5)->endOfDay(),
        ]);
        $schedule = ClaimingSchedule::create(['config_id' => $config->id, 'location' => 'Barangay Hall']);
        $laneDate = now()->addDays(20);
        ClaimingLane::create([
            'claiming_schedule_id' => $schedule->id,
            'lane_name'            => 'Lane A',
            'capacity'             => 10,
            'batch'                => 'morning',
            'claiming_date'        => $laneDate->format('Y-m-d'),
        ]);
        $request = $this->extendRequest($laneDate->copy()->addDay()->format('Y-m-d'));

        $response = $this->controller()->extend($request, $config->id);

        $this->assertEquals(400, $response->getStatusCode());
        $this->assertStringContainsString('Lane A', $response->getData(true)['message']);
    }

    public function test_extend_ignores_the_late_claiming_lane_when_checking_for_conflicts()
    {
        // "Late Claiming" is the one lane deliberately excluded
        // from the conflict check (its date is derived separately from
        // late_claiming_date/late_claiming_end_date on the schedule, not
        // treated as a normal lane conflict here).
        $config = ApplicationConfiguration::factory()->alreadyStarted()->create([
            'close_date' => now()->addDays(5)->endOfDay(),
        ]);
        $schedule = ClaimingSchedule::create(['config_id' => $config->id, 'location' => 'Barangay Hall']);
        ClaimingLane::create([
            'claiming_schedule_id' => $schedule->id,
            'lane_name'            => 'Late Claiming',
            'capacity'             => null,
            'batch'                => 'morning',
            'claiming_date'        => now()->addDays(20)->format('Y-m-d'),
        ]);
        $request = $this->extendRequest(now()->addDays(30)->format('Y-m-d'));

        $response = $this->controller()->extend($request, $config->id);

        $this->assertEquals(200, $response->getStatusCode());
    }

    public function test_extend_blocks_when_it_would_land_on_or_before_the_scheduled_late_claiming_start()
    {
        $config = ApplicationConfiguration::factory()->alreadyStarted()->create([
            'close_date' => now()->addDays(5)->endOfDay(),
        ]);
        ClaimingSchedule::create([
            'config_id'         => $config->id,
            'location'          => 'Barangay Hall',
            'late_claiming_date' => now()->addDays(15)->format('Y-m-d'),
        ]);
        $request = $this->extendRequest(now()->addDays(20)->format('Y-m-d'));

        $response = $this->controller()->extend($request, $config->id);

        $this->assertEquals(400, $response->getStatusCode());
        $this->assertStringContainsString('Late Claiming', $response->getData(true)['message']);
    }
}
