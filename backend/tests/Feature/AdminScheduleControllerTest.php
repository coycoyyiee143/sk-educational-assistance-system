<?php

namespace Tests\Feature;

use App\Models\Application;
use App\Models\ApplicationConfiguration;
use App\Models\ClaimingAssignment;
use App\Models\ClaimingLane;
use App\Models\ClaimingSchedule;
use App\Models\User;
use App\Notifications\ClaimingScheduleNotification;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Notification;
use Tests\TestCase;

class AdminScheduleControllerTest extends TestCase
{
    use RefreshDatabase;

    protected function makeAdmin(): User
    {
        return User::factory()->create(['role' => 'sk_admin']);
    }

    protected function validLanesPayload(ApplicationConfiguration $config): array
    {
        return [
            'location' => 'Barangay Mamatid Covered Court',
            'lanes'    => [
                [
                    'lane_name'     => 'Lane A',
                    'capacity'      => 50,
                    'batch'         => 'morning',
                    'claiming_date' => \Carbon\Carbon::parse($config->close_date)->addDays(5)->format('Y-m-d'),
                ],
            ],
        ];
    }

    // ── Access control ──────────────────────────────────────────

    public function test_non_admin_cannot_access_claiming_schedule()
    {
        $verifier = User::factory()->create(['role' => 'sk_verifier']);
        ApplicationConfiguration::factory()->create(['is_active' => true]);

        $response = $this->actingAs($verifier, 'sanctum')->getJson('/api/admin/claiming-schedule');

        $response->assertStatus(403);
    }

    // ── show() ──────────────────────────────────────────────────

    public function test_show_returns_404_when_no_active_period()
    {
        $admin = $this->makeAdmin();

        $response = $this->actingAs($admin, 'sanctum')->getJson('/api/admin/claiming-schedule');

        $response->assertStatus(404);
    }

    public function test_show_returns_config_and_schedule_with_counts()
    {
        $admin = $this->makeAdmin();
        $config = ApplicationConfiguration::factory()->create(['is_active' => true]);
        Application::factory()->create([
            'config_id'      => $config->id,
            'status'         => 'approved',
            'control_number' => 'SK-0001',
        ]);

        $response = $this->actingAs($admin, 'sanctum')->getJson('/api/admin/claiming-schedule');

        $response->assertOk();
        $response->assertJson([
            'approved_count'            => 1,
            'unassigned_approved_count' => 1,
        ]);
        $response->assertJsonStructure(['config', 'approved_count', 'unassigned_approved_count', 'schedule', 'verifiers']);
    }

    // ── store() ─────────────────────────────────────────────────

    public function test_admin_can_create_a_claiming_schedule_with_lanes()
    {
        $admin = $this->makeAdmin();
        $config = ApplicationConfiguration::factory()->create(['is_active' => true]);

        $response = $this->actingAs($admin, 'sanctum')->postJson('/api/admin/claiming-schedule', $this->validLanesPayload($config));

        $response->assertOk();
        $this->assertDatabaseHas('claiming_schedules', ['config_id' => $config->id]);
        $this->assertDatabaseHas('claiming_lanes', ['lane_name' => 'Lane A', 'capacity' => 50]);
    }

    public function test_store_rejects_claiming_date_on_or_before_close_date()
    {
        $admin = $this->makeAdmin();
        $config = ApplicationConfiguration::factory()->create(['is_active' => true]);

        $payload = $this->validLanesPayload($config);
        $payload['lanes'][0]['claiming_date'] = \Carbon\Carbon::parse($config->close_date)->format('Y-m-d');

        $response = $this->actingAs($admin, 'sanctum')->postJson('/api/admin/claiming-schedule', $payload);

        $response->assertStatus(400);
    }

    public function test_store_rejects_duplicate_verifier_across_lanes()
    {
        $admin = $this->makeAdmin();
        $config = ApplicationConfiguration::factory()->create(['is_active' => true]);
        $verifier = User::factory()->create(['role' => 'sk_verifier']);

        $payload = [
            'location' => 'Barangay Mamatid Covered Court',
            'lanes'    => [
                [
                    'lane_name'     => 'Lane A',
                    'capacity'      => 50,
                    'batch'         => 'morning',
                    'claiming_date' => \Carbon\Carbon::parse($config->close_date)->addDays(5)->format('Y-m-d'),
                    'verifier_id'   => $verifier->id,
                ],
                [
                    'lane_name'     => 'Lane B',
                    'capacity'      => 50,
                    'batch'         => 'afternoon',
                    'claiming_date' => \Carbon\Carbon::parse($config->close_date)->addDays(5)->format('Y-m-d'),
                    'verifier_id'   => $verifier->id,
                ],
            ],
        ];

        $response = $this->actingAs($admin, 'sanctum')->postJson('/api/admin/claiming-schedule', $payload);

        $response->assertStatus(400);
    }

    public function test_store_rejects_editing_an_already_active_schedule()
    {
        $admin = $this->makeAdmin();
        $config = ApplicationConfiguration::factory()->create(['is_active' => true]);
        ClaimingSchedule::create([
            'config_id' => $config->id,
            'location'  => 'Old Location',
            'is_active' => true,
        ]);

        $response = $this->actingAs($admin, 'sanctum')->postJson('/api/admin/claiming-schedule', $this->validLanesPayload($config));

        $response->assertStatus(400);
    }

    public function test_store_requires_no_active_application_period()
    {
        $admin = $this->makeAdmin();
        // No active config at all.
        $config = ApplicationConfiguration::factory()->create(['is_active' => false]);

        $response = $this->actingAs($admin, 'sanctum')->postJson('/api/admin/claiming-schedule', $this->validLanesPayload($config));

        $response->assertStatus(404);
    }

    // ── activate() ──────────────────────────────────────────────

    public function test_admin_can_activate_a_schedule_and_assigns_pending_approvals()
    {
        Notification::fake();
        $admin = $this->makeAdmin();
        $config = ApplicationConfiguration::factory()->create(['is_active' => true]);
        $schedule = ClaimingSchedule::create(['config_id' => $config->id, 'location' => 'Loc']);
        ClaimingLane::create([
            'claiming_schedule_id' => $schedule->id,
            'lane_name'            => 'Lane A',
            'capacity'             => 5,
            'batch'                => 'morning',
            'claiming_date'        => now()->addDays(5)->format('Y-m-d'),
        ]);
        $approved = Application::factory()->create([
            'config_id'      => $config->id,
            'status'         => 'approved',
            'control_number' => 'SK-0001',
        ]);

        $response = $this->actingAs($admin, 'sanctum')->postJson("/api/admin/claiming-schedule/{$schedule->id}/activate");

        $response->assertOk();
        $this->assertTrue($schedule->fresh()->is_active);
        $this->assertDatabaseHas('claiming_assignments', ['application_id' => $approved->id]);
        Notification::assertSentTo($approved->user, ClaimingScheduleNotification::class);
    }

    public function test_activate_rejects_a_schedule_with_no_lanes()
    {
        $admin = $this->makeAdmin();
        $config = ApplicationConfiguration::factory()->create(['is_active' => true]);
        $schedule = ClaimingSchedule::create(['config_id' => $config->id, 'location' => 'Loc']);

        $response = $this->actingAs($admin, 'sanctum')->postJson("/api/admin/claiming-schedule/{$schedule->id}/activate");

        $response->assertStatus(400);
    }

    public function test_activate_rejects_an_already_active_schedule()
    {
        $admin = $this->makeAdmin();
        $config = ApplicationConfiguration::factory()->create(['is_active' => true]);
        $schedule = ClaimingSchedule::create(['config_id' => $config->id, 'location' => 'Loc', 'is_active' => true]);
        ClaimingLane::create([
            'claiming_schedule_id' => $schedule->id,
            'lane_name'            => 'Lane A',
            'capacity'             => 5,
            'batch'                => 'morning',
            'claiming_date'        => now()->addDays(5)->format('Y-m-d'),
        ]);

        $response = $this->actingAs($admin, 'sanctum')->postJson("/api/admin/claiming-schedule/{$schedule->id}/activate");

        $response->assertStatus(400);
    }

    // ── closePeriod() ───────────────────────────────────────────

    public function test_admin_can_close_a_period_and_waitlisted_applicants_become_not_selected()
    {
        $admin = $this->makeAdmin();
        $config = ApplicationConfiguration::factory()->create(['is_active' => true]);
        $waitlisted = Application::factory()->create([
            'config_id' => $config->id,
            'status'    => 'waitlisted',
        ]);

        $response = $this->actingAs($admin, 'sanctum')->postJson("/api/admin/application-configs/{$config->id}/close");

        $response->assertOk();
        $this->assertNotNull($config->fresh()->closed_at);
        $this->assertDatabaseHas('applications', ['id' => $waitlisted->id, 'status' => 'not_selected']);
    }

    public function test_close_period_rejects_an_already_closed_period()
    {
        $admin = $this->makeAdmin();
        $config = ApplicationConfiguration::factory()->create(['is_active' => true, 'closed_at' => now()]);

        $response = $this->actingAs($admin, 'sanctum')->postJson("/api/admin/application-configs/{$config->id}/close");

        $response->assertStatus(400);
    }

    public function test_close_period_blocked_while_late_claiming_still_active()
    {
        $admin = $this->makeAdmin();
        $config = ApplicationConfiguration::factory()->create(['is_active' => true]);
        ClaimingSchedule::create([
            'config_id'             => $config->id,
            'location'              => 'Loc',
            'is_active'             => true,
            'late_claiming_end_date' => now()->addDays(3)->format('Y-m-d'),
        ]);

        $response = $this->actingAs($admin, 'sanctum')->postJson("/api/admin/application-configs/{$config->id}/close");

        $response->assertStatus(400);
    }

    // ── assignVerifier() ────────────────────────────────────────

    public function test_admin_can_assign_a_verifier_to_a_lane()
    {
        $admin = $this->makeAdmin();
        $verifier = User::factory()->create(['role' => 'sk_verifier']);
        $config = ApplicationConfiguration::factory()->create();
        $schedule = ClaimingSchedule::create(['config_id' => $config->id, 'location' => 'Loc']);
        $lane = ClaimingLane::create([
            'claiming_schedule_id' => $schedule->id,
            'lane_name'            => 'Lane A',
            'capacity'             => 5,
            'batch'                => 'morning',
            'claiming_date'        => now()->addDays(5)->format('Y-m-d'),
        ]);

        $response = $this->actingAs($admin, 'sanctum')->postJson("/api/admin/claiming-schedule/lanes/{$lane->id}/assign-verifier", [
            'verifier_id' => $verifier->id,
        ]);

        $response->assertOk();
        $this->assertEquals($verifier->id, $lane->fresh()->verifier_id);
    }

    public function test_assigning_a_verifier_to_a_new_lane_unassigns_them_from_their_previous_lane()
    {
        $admin = $this->makeAdmin();
        $verifier = User::factory()->create(['role' => 'sk_verifier']);
        $config = ApplicationConfiguration::factory()->create();
        $schedule = ClaimingSchedule::create(['config_id' => $config->id, 'location' => 'Loc']);
        $laneA = ClaimingLane::create([
            'claiming_schedule_id' => $schedule->id,
            'lane_name'            => 'Lane A',
            'capacity'             => 5,
            'batch'                => 'morning',
            'claiming_date'        => now()->addDays(5)->format('Y-m-d'),
            'verifier_id'          => $verifier->id,
        ]);
        $laneB = ClaimingLane::create([
            'claiming_schedule_id' => $schedule->id,
            'lane_name'            => 'Lane B',
            'capacity'             => 5,
            'batch'                => 'afternoon',
            'claiming_date'        => now()->addDays(5)->format('Y-m-d'),
        ]);

        $response = $this->actingAs($admin, 'sanctum')->postJson("/api/admin/claiming-schedule/lanes/{$laneB->id}/assign-verifier", [
            'verifier_id' => $verifier->id,
        ]);

        $response->assertOk();
        $this->assertNull($laneA->fresh()->verifier_id);
        $this->assertEquals($verifier->id, $laneB->fresh()->verifier_id);
    }

    // ── dismissLaneRequest() ────────────────────────────────────

    public function test_admin_can_dismiss_a_lane_self_assign_request()
    {
        $admin = $this->makeAdmin();
        $verifier = User::factory()->create(['role' => 'sk_verifier']);
        $config = ApplicationConfiguration::factory()->create();
        $schedule = ClaimingSchedule::create(['config_id' => $config->id, 'location' => 'Loc']);
        $lane = ClaimingLane::create([
            'claiming_schedule_id'   => $schedule->id,
            'lane_name'              => 'Lane A',
            'capacity'               => 5,
            'batch'                  => 'morning',
            'claiming_date'          => now()->addDays(5)->format('Y-m-d'),
            'requested_verifier_id'  => $verifier->id,
        ]);

        $response = $this->actingAs($admin, 'sanctum')->postJson("/api/admin/claiming-schedule/lanes/{$lane->id}/dismiss-request");

        $response->assertOk();
        $this->assertNull($lane->fresh()->requested_verifier_id);
    }

    // ── printableLane() / printableLanePdf() ────────────────────

    protected function makeLaneWithAssignment(): ClaimingLane
    {
        $config = ApplicationConfiguration::factory()->create();
        $schedule = ClaimingSchedule::create(['config_id' => $config->id, 'location' => 'Loc']);
        $lane = ClaimingLane::create([
            'claiming_schedule_id' => $schedule->id,
            'lane_name'            => 'Lane A',
            'capacity'             => 5,
            'batch'                => 'morning',
            'claiming_date'        => now()->addDays(5)->format('Y-m-d'),
        ]);
        $application = Application::factory()->create([
            'config_id'      => $config->id,
            'status'         => 'approved',
            'control_number' => 'SK-0001',
        ]);
        ClaimingAssignment::create([
            'application_id'       => $application->id,
            'claiming_schedule_id' => $schedule->id,
            'claiming_lane_id'     => $lane->id,
            'claim_status'         => 'pending_claiming',
        ]);

        return $lane;
    }

    public function test_admin_can_view_the_printable_lane_list()
    {
        $admin = $this->makeAdmin();
        $lane = $this->makeLaneWithAssignment();

        $response = $this->actingAs($admin, 'sanctum')->getJson("/api/admin/claiming-schedule/lanes/{$lane->id}/printable");

        $response->assertOk();
        $response->assertJson([
            'lane_name' => 'Lane A',
        ]);
        $this->assertCount(1, $response->json('applicants'));
    }

    public function test_admin_can_download_the_printable_lane_pdf()
    {
        $admin = $this->makeAdmin();
        $lane = $this->makeLaneWithAssignment();

        $response = $this->actingAs($admin, 'sanctum')->getJson("/api/admin/claiming-schedule/lanes/{$lane->id}/printable/pdf");

        $response->assertOk();
        $response->assertHeader('content-type', 'application/pdf');
    }
}
