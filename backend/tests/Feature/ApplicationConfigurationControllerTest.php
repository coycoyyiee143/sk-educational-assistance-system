<?php

namespace Tests\Feature;

use App\Models\ApplicationConfiguration;
use App\Models\ClaimingLane;
use App\Models\ClaimingSchedule;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ApplicationConfigurationControllerTest extends TestCase
{
    use RefreshDatabase;

    protected function makeAdmin(): User
    {
        return User::factory()->create(['role' => 'sk_admin']);
    }

    // ── active() — public ───────────────────────────────────────

    public function test_active_returns_the_currently_active_configuration()
    {
        ApplicationConfiguration::factory()->create(['is_active' => false]);
        $active = ApplicationConfiguration::factory()->create(['is_active' => true]);

        $response = $this->getJson('/api/application-config/active');

        $response->assertOk();
        $response->assertJson(['id' => $active->id]);
    }

    public function test_active_returns_404_when_no_active_period()
    {
        ApplicationConfiguration::factory()->create(['is_active' => false]);

        $response = $this->getJson('/api/application-config/active');

        $response->assertStatus(404);
    }

    // ── Access control ──────────────────────────────────────────

    public function test_non_admin_cannot_create_application_period()
    {
        $verifier = User::factory()->create(['role' => 'sk_verifier']);

        $response = $this->actingAs($verifier, 'sanctum')->postJson('/api/application-config', [
            'school_year'       => '2026-2027',
            'open_date'         => now()->format('Y-m-d'),
            'close_date'        => now()->addDays(10)->format('Y-m-d'),
            'is_unlimited'      => false,
            'slot_limit'        => 50,
            'assistance_amount' => 2000,
        ]);

        $response->assertStatus(403);
    }

    // ── store() ─────────────────────────────────────────────────

    public function test_admin_can_create_a_new_application_period()
    {
        $admin = $this->makeAdmin();

        $response = $this->actingAs($admin, 'sanctum')->postJson('/api/application-config', [
            'school_year'       => '2026-2027',
            'open_date'         => now()->format('Y-m-d'),
            'close_date'        => now()->addDays(10)->format('Y-m-d'),
            'is_unlimited'      => false,
            'slot_limit'        => 50,
            'assistance_amount' => 3000,
        ]);

        $response->assertStatus(201);
        $this->assertDatabaseHas('application_configurations', [
            'school_year'       => '2026-2027',
            'is_active'         => 1,
            'assistance_amount' => 3000,
        ]);
    }

    public function test_creating_a_new_period_deactivates_the_previous_active_period()
    {
        $admin = $this->makeAdmin();
        $old = ApplicationConfiguration::factory()->create(['is_active' => true]);

        $response = $this->actingAs($admin, 'sanctum')->postJson('/api/application-config', [
            'school_year'       => '2027-2028',
            'open_date'         => now()->format('Y-m-d'),
            'close_date'        => now()->addDays(10)->format('Y-m-d'),
            'is_unlimited'      => false,
            'slot_limit'        => 50,
            'assistance_amount' => 3000,
        ]);

        $response->assertStatus(201);
        $this->assertFalse($old->fresh()->is_active);
    }

    public function test_store_requires_slot_limit_when_not_unlimited()
    {
        $admin = $this->makeAdmin();

        $response = $this->actingAs($admin, 'sanctum')->postJson('/api/application-config', [
            'school_year'       => '2026-2027',
            'open_date'         => now()->format('Y-m-d'),
            'close_date'        => now()->addDays(10)->format('Y-m-d'),
            'is_unlimited'      => false,
            'assistance_amount' => 2000,
        ]);

        $response->assertStatus(422);
        $response->assertJsonValidationErrors(['slot_limit']);
    }

    public function test_store_requires_close_date_after_open_date()
    {
        $admin = $this->makeAdmin();

        $response = $this->actingAs($admin, 'sanctum')->postJson('/api/application-config', [
            'school_year'       => '2026-2027',
            'open_date'         => now()->addDays(10)->format('Y-m-d'),
            'close_date'        => now()->format('Y-m-d'),
            'is_unlimited'      => false,
            'slot_limit'        => 50,
            'assistance_amount' => 2000,
        ]);

        $response->assertStatus(422);
        $response->assertJsonValidationErrors(['close_date']);
    }

    public function test_store_requires_assistance_amount()
    {
        $admin = $this->makeAdmin();

        $response = $this->actingAs($admin, 'sanctum')->postJson('/api/application-config', [
            'school_year'  => '2026-2027',
            'open_date'    => now()->format('Y-m-d'),
            'close_date'   => now()->addDays(10)->format('Y-m-d'),
            'is_unlimited' => true,
        ]);

        $response->assertStatus(422);
        $response->assertJsonValidationErrors(['assistance_amount']);
    }

    // ── index() ─────────────────────────────────────────────────

    public function test_admin_can_list_all_application_periods()
    {
        $admin = $this->makeAdmin();
        ApplicationConfiguration::factory()->count(3)->create();

        $response = $this->actingAs($admin, 'sanctum')->getJson('/api/admin/application-configs');

        $response->assertOk();
        $this->assertCount(3, $response->json());
    }

    // ── update() ────────────────────────────────────────────────

    public function test_admin_can_update_a_period_before_it_starts()
    {
        $admin = $this->makeAdmin();
        $config = ApplicationConfiguration::factory()->notYetStarted()->create();

        $response = $this->actingAs($admin, 'sanctum')->putJson("/api/admin/application-configs/{$config->id}", [
            'school_year'       => '2028-2029',
            'open_date'         => $config->open_date->format('Y-m-d'),
            'close_date'        => $config->close_date->format('Y-m-d H:i:s'),
            'is_unlimited'      => false,
            'slot_limit'        => 200,
            'assistance_amount' => 2500,
        ]);

        $response->assertOk();
        $this->assertEquals('2028-2029', $config->fresh()->school_year);
        $this->assertEquals(2500, $config->fresh()->assistance_amount);
    }

    public function test_update_rejects_close_date_changes_through_this_endpoint()
    {
        $admin = $this->makeAdmin();
        $config = ApplicationConfiguration::factory()->notYetStarted()->create();

        $response = $this->actingAs($admin, 'sanctum')->putJson("/api/admin/application-configs/{$config->id}", [
            'school_year'       => $config->school_year,
            'open_date'         => $config->open_date->format('Y-m-d'),
            'close_date'        => now()->addDays(999)->format('Y-m-d'), // attempted change
            'is_unlimited'      => false,
            'slot_limit'        => $config->slot_limit,
            'assistance_amount' => $config->assistance_amount,
        ]);

        $response->assertStatus(400);
        $response->assertJson(['locked_fields' => ['close_date']]);
    }

    public function test_update_locks_assistance_amount_after_period_has_started()
    {
        $admin = $this->makeAdmin();
        $config = ApplicationConfiguration::factory()->alreadyStarted()->create([
            'assistance_amount' => 2000,
        ]);

        $response = $this->actingAs($admin, 'sanctum')->putJson("/api/admin/application-configs/{$config->id}", [
            'school_year'       => $config->school_year,
            'open_date'         => $config->open_date->format('Y-m-d'),
            'close_date'        => $config->close_date->format('Y-m-d H:i:s'),
            'is_unlimited'      => false,
            'slot_limit'        => $config->slot_limit,
            'assistance_amount' => 9999, // attempting to change a locked field
        ]);

        $response->assertStatus(400);
        $response->assertJson(['locked_fields' => ['assistance_amount']]);
        $this->assertEquals(2000, $config->fresh()->assistance_amount);
    }

    // ── extend() ────────────────────────────────────────────────

    public function test_admin_can_extend_the_closing_date()
    {
        $admin = $this->makeAdmin();
        $config = ApplicationConfiguration::factory()->alreadyStarted()->create();
        $newDate = \Carbon\Carbon::parse($config->close_date)->addDays(10)->format('Y-m-d');

        $response = $this->actingAs($admin, 'sanctum')->postJson("/api/admin/application-configs/{$config->id}/extend", [
            'close_date' => $newDate,
        ]);

        $response->assertOk();
        $this->assertDatabaseHas('audit_logs', ['action' => 'application_period_extended']);
    }

    public function test_extend_rejects_a_date_not_after_the_current_close_date()
    {
        $admin = $this->makeAdmin();
        $config = ApplicationConfiguration::factory()->alreadyStarted()->create();

        $response = $this->actingAs($admin, 'sanctum')->postJson("/api/admin/application-configs/{$config->id}/extend", [
            'close_date' => \Carbon\Carbon::parse($config->close_date)->subDays(1)->format('Y-m-d'),
        ]);

        $response->assertStatus(422);
        $response->assertJsonValidationErrors(['close_date']);
    }

    public function test_extend_rejects_an_already_closed_period()
    {
        $admin = $this->makeAdmin();
        $config = ApplicationConfiguration::factory()->closed()->create(['closed_at' => now()]);

        $response = $this->actingAs($admin, 'sanctum')->postJson("/api/admin/application-configs/{$config->id}/extend", [
            'close_date' => now()->addDays(30)->format('Y-m-d'),
        ]);

        $response->assertStatus(400);
    }

    public function test_extend_rejects_when_it_would_conflict_with_an_already_scheduled_lane()
    {
        $admin = $this->makeAdmin();
        $config = ApplicationConfiguration::factory()->alreadyStarted()->create([
            'close_date' => now()->addDays(5)->endOfDay(),
        ]);
        $schedule = ClaimingSchedule::create([
            'config_id' => $config->id,
            'location'  => 'Barangay Hall',
        ]);
        $laneDate = now()->addDays(20);
        ClaimingLane::create([
            'claiming_schedule_id' => $schedule->id,
            'lane_name'            => 'Lane A',
            'capacity'             => 10,
            'batch'                => 'morning',
            'claiming_date'        => $laneDate->format('Y-m-d'),
        ]);

        // Extending close_date past the lane's claiming date should be blocked.
        $response = $this->actingAs($admin, 'sanctum')->postJson("/api/admin/application-configs/{$config->id}/extend", [
            'close_date' => $laneDate->copy()->addDay()->format('Y-m-d'),
        ]);

        $response->assertStatus(400);
        $this->assertStringContainsString('Lane A', $response->json('message'));
    }
}
