<?php

namespace Tests\Unit\Controllers;

use App\Http\Controllers\Api\AdminScheduleController;
use App\Models\Application;
use App\Models\ApplicationConfiguration;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Request;
use Tests\TestCase;

/**
 * Unit-level coverage for the pure decision logic inside
 * AdminScheduleController — store()'s lane-date-vs-close-date and
 * grace-period-ordering validation, and closePeriod()'s waitlist ->
 * not_selected settlement — exercised by calling the controller methods
 * directly (with a manually built Request where needed), WITHOUT going
 * through routing, Sanctum auth middleware, or ->postJson()/->actingAs().
 *
 * Complements (does not duplicate) tests/Feature/AdminScheduleControllerTest.php,
 * which covers the same endpoints at the full HTTP level, including
 * authorization and JSON response shape.
 */
class AdminScheduleControllerTest extends TestCase
{
    use RefreshDatabase;

    protected function controller(): AdminScheduleController
    {
        return new AdminScheduleController();
    }

    protected function storeRequest(array $overrides = []): Request
    {
        $admin = User::factory()->create(['role' => 'sk_admin']);
        $request = Request::create('/', 'POST', array_merge([
            'location' => 'Barangay Mamatid Covered Court',
            'lanes'    => [
                [
                    'lane_name'     => 'Lane A',
                    'capacity'      => 50,
                    'batch'         => 'morning',
                    'claiming_date' => now()->addDays(10)->format('Y-m-d'),
                ],
            ],
        ], $overrides));
        $request->setUserResolver(fn () => $admin);

        return $request;
    }

    // ── store() — lane claiming date vs. close date ──────────────────

    public function test_store_rejects_a_lane_claiming_date_on_or_before_the_close_date()
    {
        $config = ApplicationConfiguration::factory()->create(['is_active' => true]);
        $request = $this->storeRequest([
            'lanes' => [[
                'lane_name'     => 'Lane A',
                'capacity'      => 50,
                'batch'         => 'morning',
                'claiming_date' => \Carbon\Carbon::parse($config->close_date)->format('Y-m-d'),
            ]],
        ]);

        $response = $this->controller()->store($request);

        $this->assertEquals(400, $response->getStatusCode());
        $this->assertStringContainsString('Lane A', $response->getData(true)['message']);
    }

    public function test_store_allows_a_lane_claiming_date_strictly_after_the_close_date()
    {
        $config = ApplicationConfiguration::factory()->create(['is_active' => true]);
        $request = $this->storeRequest([
            'lanes' => [[
                'lane_name'     => 'Lane A',
                'capacity'      => 50,
                'batch'         => 'morning',
                'claiming_date' => \Carbon\Carbon::parse($config->close_date)->addDay()->format('Y-m-d'),
            ]],
        ]);

        $response = $this->controller()->store($request);

        $this->assertEquals(200, $response->getStatusCode());
    }

    public function test_store_returns_404_when_there_is_no_active_application_period()
    {
        ApplicationConfiguration::factory()->create(['is_active' => false]);
        $request = $this->storeRequest();

        $response = $this->controller()->store($request);

        $this->assertEquals(404, $response->getStatusCode());
    }

    // ── store() — duplicate verifier across lanes ────────────────────

    public function test_store_rejects_the_same_verifier_assigned_to_two_lanes()
    {
        $config = ApplicationConfiguration::factory()->create(['is_active' => true]);
        $verifier = User::factory()->create(['role' => 'sk_verifier']);
        $closeDate = \Carbon\Carbon::parse($config->close_date);
        $request = $this->storeRequest([
            'lanes' => [
                [
                    'lane_name'     => 'Lane A',
                    'capacity'      => 50,
                    'batch'         => 'morning',
                    'claiming_date' => $closeDate->copy()->addDays(5)->format('Y-m-d'),
                    'verifier_id'   => $verifier->id,
                ],
                [
                    'lane_name'     => 'Lane B',
                    'capacity'      => 50,
                    'batch'         => 'afternoon',
                    'claiming_date' => $closeDate->copy()->addDays(5)->format('Y-m-d'),
                    'verifier_id'   => $verifier->id,
                ],
            ],
        ]);

        $response = $this->controller()->store($request);

        $this->assertEquals(400, $response->getStatusCode());
    }

    // ── store() — grace period must start after every claiming date ──

    public function test_store_rejects_grace_period_starting_on_or_before_the_latest_claiming_date()
    {
        $config = ApplicationConfiguration::factory()->create(['is_active' => true]);
        $closeDate = \Carbon\Carbon::parse($config->close_date);
        $latestClaimingDate = $closeDate->copy()->addDays(10);
        $request = $this->storeRequest([
            'lanes' => [[
                'lane_name'     => 'Lane A',
                'capacity'      => 50,
                'batch'         => 'morning',
                'claiming_date' => $latestClaimingDate->format('Y-m-d'),
            ]],
            'grace_period_date' => $latestClaimingDate->format('Y-m-d'), // same day: not after
        ]);

        $response = $this->controller()->store($request);

        $this->assertEquals(400, $response->getStatusCode());
        $this->assertStringContainsString('Grace Period', $response->getData(true)['message']);
    }

    public function test_store_allows_grace_period_starting_after_the_latest_claiming_date()
    {
        $config = ApplicationConfiguration::factory()->create(['is_active' => true]);
        $closeDate = \Carbon\Carbon::parse($config->close_date);
        $latestClaimingDate = $closeDate->copy()->addDays(10);
        $request = $this->storeRequest([
            'lanes' => [[
                'lane_name'     => 'Lane A',
                'capacity'      => 50,
                'batch'         => 'morning',
                'claiming_date' => $latestClaimingDate->format('Y-m-d'),
            ]],
            'grace_period_date' => $latestClaimingDate->copy()->addDay()->format('Y-m-d'),
        ]);

        $response = $this->controller()->store($request);

        $this->assertEquals(200, $response->getStatusCode());
    }

    public function test_store_picks_the_latest_claiming_date_across_multiple_lanes_for_the_grace_period_check()
    {
        $config = ApplicationConfiguration::factory()->create(['is_active' => true]);
        $closeDate = \Carbon\Carbon::parse($config->close_date);
        $earlyLane = $closeDate->copy()->addDays(5);
        $lateLane = $closeDate->copy()->addDays(15);
        $request = $this->storeRequest([
            'lanes' => [
                ['lane_name' => 'Lane A', 'capacity' => 50, 'batch' => 'morning', 'claiming_date' => $earlyLane->format('Y-m-d')],
                ['lane_name' => 'Lane B', 'capacity' => 50, 'batch' => 'afternoon', 'claiming_date' => $lateLane->format('Y-m-d')],
            ],
            // After the EARLY lane but not after the LATE (actual latest) lane —
            // must still be rejected, proving the check uses the max(), not
            // just the first lane in the array.
            'grace_period_date' => $earlyLane->copy()->addDay()->format('Y-m-d'),
        ]);

        $response = $this->controller()->store($request);

        $this->assertEquals(400, $response->getStatusCode());
    }

    // ── closePeriod() — waitlist settlement ──────────────────────────

    public function test_close_period_marks_every_still_waitlisted_application_not_selected_and_stamps_closed_at()
    {
        $config = ApplicationConfiguration::factory()->create(['is_active' => true]);
        $waitlistedA = Application::factory()->create(['config_id' => $config->id, 'status' => 'waitlisted']);
        $waitlistedB = Application::factory()->create(['config_id' => $config->id, 'status' => 'waitlisted']);
        $approved = Application::factory()->create(['config_id' => $config->id, 'status' => 'approved']);

        $response = $this->controller()->closePeriod($config->id);

        $this->assertEquals(200, $response->getStatusCode());
        $this->assertNotNull($config->fresh()->closed_at);
        $this->assertEquals('not_selected', $waitlistedA->fresh()->status);
        $this->assertEquals('not_selected', $waitlistedB->fresh()->status);
        // Approved applications are left completely untouched by this action.
        $this->assertEquals('approved', $approved->fresh()->status);
        $this->assertStringContainsString('2 waitlisted applicant(s)', $response->getData(true)['message']);
    }

    public function test_close_period_rejects_an_already_closed_period()
    {
        $config = ApplicationConfiguration::factory()->create(['is_active' => true, 'closed_at' => now()]);

        $response = $this->controller()->closePeriod($config->id);

        $this->assertEquals(400, $response->getStatusCode());
    }

    public function test_close_period_is_blocked_while_the_grace_period_has_not_yet_ended()
    {
        $config = ApplicationConfiguration::factory()->create(['is_active' => true]);
        \App\Models\ClaimingSchedule::create([
            'config_id'             => $config->id,
            'location'              => 'Barangay Hall',
            'is_active'             => true,
            'grace_period_end_date' => now()->addDays(3)->format('Y-m-d'),
        ]);

        $response = $this->controller()->closePeriod($config->id);

        $this->assertEquals(400, $response->getStatusCode());
        $this->assertNull($config->fresh()->closed_at);
    }

    public function test_close_period_proceeds_once_the_grace_period_has_already_ended()
    {
        $config = ApplicationConfiguration::factory()->create(['is_active' => true]);
        \App\Models\ClaimingSchedule::create([
            'config_id'             => $config->id,
            'location'              => 'Barangay Hall',
            'is_active'             => true,
            'grace_period_end_date' => now()->subDay()->format('Y-m-d'),
        ]);

        $response = $this->controller()->closePeriod($config->id);

        $this->assertEquals(200, $response->getStatusCode());
        $this->assertNotNull($config->fresh()->closed_at);
    }
}
