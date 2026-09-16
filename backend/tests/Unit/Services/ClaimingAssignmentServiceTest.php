<?php

namespace Tests\Unit\Services;

use App\Models\Application;
use App\Models\ApplicationConfiguration;
use App\Models\ClaimingAssignment;
use App\Models\ClaimingLane;
use App\Models\ClaimingSchedule;
use App\Notifications\ClaimingScheduleNotification;
use App\Services\ClaimingAssignmentService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Notification;
use Tests\TestCase;

class ClaimingAssignmentServiceTest extends TestCase
{
    use RefreshDatabase;

    protected function makeSchedule(bool $active = true): ClaimingSchedule
    {
        $config = ApplicationConfiguration::factory()->create();

        return ClaimingSchedule::create([
            'config_id' => $config->id,
            'location'  => 'Barangay Hall',
            'is_active' => $active,
        ]);
    }

    protected function makeLane(ClaimingSchedule $schedule, string $name, ?int $capacity, string $date = '2026-10-01'): ClaimingLane
    {
        return ClaimingLane::create([
            'claiming_schedule_id' => $schedule->id,
            'lane_name'            => $name,
            'capacity'             => $capacity,
            'batch'                => 'morning',
            'claiming_date'        => $date,
        ]);
    }

    protected function makeApplication(ClaimingSchedule $schedule): Application
    {
        return Application::factory()->create([
            'config_id' => $schedule->config_id,
            'status'    => 'approved',
        ]);
    }

    public function test_returns_null_when_no_active_schedule_exists()
    {
        Notification::fake();
        $schedule = $this->makeSchedule(active: false);
        $this->makeLane($schedule, 'Lane 1', 5);
        $application = $this->makeApplication($schedule);

        $result = ClaimingAssignmentService::assignToLane($application);

        $this->assertNull($result);
        $this->assertDatabaseCount('claiming_assignments', 0);
    }

    public function test_assigns_to_first_lane_with_room()
    {
        Notification::fake();
        $schedule = $this->makeSchedule();
        $lane1 = $this->makeLane($schedule, 'Lane 1', 1, '2026-10-01');
        $lane2 = $this->makeLane($schedule, 'Lane 2', 1, '2026-10-02');
        $application = $this->makeApplication($schedule);

        $assignment = ClaimingAssignmentService::assignToLane($application);

        $this->assertNotNull($assignment);
        $this->assertEquals($lane1->id, $assignment->claiming_lane_id);
        $this->assertEquals('pending_claiming', $assignment->claim_status);
        Notification::assertSentTo($application->user, ClaimingScheduleNotification::class);
    }

    public function test_fills_lanes_strictly_in_order_before_moving_to_the_next()
    {
        Notification::fake();
        $schedule = $this->makeSchedule();
        $lane1 = $this->makeLane($schedule, 'Lane 1', 1, '2026-10-01');
        $lane2 = $this->makeLane($schedule, 'Lane 2', 1, '2026-10-02');

        $first = ClaimingAssignmentService::assignToLane($this->makeApplication($schedule));
        $second = ClaimingAssignmentService::assignToLane($this->makeApplication($schedule));

        $this->assertEquals($lane1->id, $first->claiming_lane_id);
        $this->assertEquals($lane2->id, $second->claiming_lane_id);
    }

    public function test_returns_null_when_every_lane_is_full()
    {
        Notification::fake();
        $schedule = $this->makeSchedule();
        $this->makeLane($schedule, 'Lane 1', 1);
        ClaimingAssignmentService::assignToLane($this->makeApplication($schedule));

        $overflowApplication = $this->makeApplication($schedule);
        $result = ClaimingAssignmentService::assignToLane($overflowApplication);

        $this->assertNull($result);
    }

    public function test_never_assigns_into_the_grace_period_claiming_lane()
    {
        Notification::fake();
        $schedule = $this->makeSchedule();
        $this->makeLane($schedule, 'Grace Period Claiming', null);
        $application = $this->makeApplication($schedule);

        $result = ClaimingAssignmentService::assignToLane($application);

        $this->assertNull($result);
    }

    public function test_is_idempotent_for_the_same_application()
    {
        Notification::fake();
        $schedule = $this->makeSchedule();
        $this->makeLane($schedule, 'Lane 1', 5);
        $application = $this->makeApplication($schedule);

        $first = ClaimingAssignmentService::assignToLane($application);
        $second = ClaimingAssignmentService::assignToLane($application);

        $this->assertEquals($first->id, $second->id);
        $this->assertDatabaseCount('claiming_assignments', 1);
    }

    public function test_assign_pending_approvals_processes_backlog_in_control_number_order()
    {
        Notification::fake();
        $schedule = $this->makeSchedule();
        $this->makeLane($schedule, 'Lane 1', 5);

        $later = Application::factory()->create([
            'config_id'      => $schedule->config_id,
            'status'         => 'approved',
            'control_number' => 'CN-002',
        ]);
        $earlier = Application::factory()->create([
            'config_id'      => $schedule->config_id,
            'status'         => 'approved',
            'control_number' => 'CN-001',
        ]);

        $count = ClaimingAssignmentService::assignPendingApprovals($schedule);

        $this->assertEquals(2, $count);
        $this->assertDatabaseHas('claiming_assignments', ['application_id' => $earlier->id]);
        $this->assertDatabaseHas('claiming_assignments', ['application_id' => $later->id]);
    }

    public function test_assign_pending_approvals_skips_applications_without_a_control_number()
    {
        Notification::fake();
        $schedule = $this->makeSchedule();
        $this->makeLane($schedule, 'Lane 1', 5);

        Application::factory()->create([
            'config_id'      => $schedule->config_id,
            'status'         => 'approved',
            'control_number' => null,
        ]);

        $count = ClaimingAssignmentService::assignPendingApprovals($schedule);

        $this->assertEquals(0, $count);
        $this->assertDatabaseCount('claiming_assignments', 0);
    }
}
