<?php
namespace Tests\Feature;

use App\Models\Application;
use App\Models\ApplicationConfiguration;
use App\Models\ApplicationDocument;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ApplicationPeriodRulesTest extends TestCase
{
    use RefreshDatabase;

    // Config Locking

    public function test_can_edit_config_fields_before_period_starts()
    {
        $admin = User::factory()->create(['role' => 'sk_admin']);
        $config = ApplicationConfiguration::factory()->notYetStarted()->create();

        $response = $this->actingAs($admin, 'sanctum')
            ->putJson("/api/admin/application-configs/{$config->id}", [
                'school_year'  => '2026-2027',
                'open_date'    => now()->addDays(5)->format('Y-m-d'),
                'close_date'   => $config->close_date->format('Y-m-d'),
                'slot_limit'   => 500,
                'is_unlimited' => false,
                'is_active'    => true,
            ]);

        $response->assertOk();
        $this->assertEquals('2026-2027', $config->fresh()->school_year);
    }

    public function test_cannot_edit_locked_fields_after_period_starts()
    {
        $admin = User::factory()->create(['role' => 'sk_admin']);
        $config = ApplicationConfiguration::factory()->alreadyStarted()->create([
            'school_year' => '2025-2026',
        ]);

        $response = $this->actingAs($admin, 'sanctum')
            ->putJson("/api/admin/application-configs/{$config->id}", [
                'school_year'  => '2026-2027', // attempting to change a locked field
                'open_date'    => $config->open_date->format('Y-m-d'),
                'close_date'   => $config->close_date->format('Y-m-d'),
                'slot_limit'   => $config->slot_limit,
                'is_unlimited' => false,
                'is_active'    => true,
            ]);

        $response->assertStatus(400);
        $this->assertEquals('2025-2026', $config->fresh()->school_year); // unchanged
    }

    public function test_can_still_edit_close_date_and_active_after_period_starts()
    {
        $admin = User::factory()->create(['role' => 'sk_admin']);
        $config = ApplicationConfiguration::factory()->alreadyStarted()->create();

        $response = $this->actingAs($admin, 'sanctum')
            ->putJson("/api/admin/application-configs/{$config->id}", [
                'school_year'  => $config->school_year,
                'open_date'    => $config->open_date->format('Y-m-d'),
                'close_date'   => now()->addDays(30)->format('Y-m-d'), // extending deadline
                'slot_limit'   => $config->slot_limit,
                'is_unlimited' => false,
                'is_active'    => false,
            ]);

        $response->assertOk();
    }

    // Close Date on Uploads

    public function test_upload_succeeds_before_close_date()
    {
        $config = ApplicationConfiguration::factory()->alreadyStarted()->create();
        $application = Application::factory()->create(['config_id' => $config->id]);
        $applicant = $application->user;

        $response = $this->actingAs($applicant, 'sanctum')
            ->postJson("/api/applications/{$application->id}/documents", [
                'document_type' => 'school_id',
                'file' => \Illuminate\Http\UploadedFile::fake()->image('id.jpg'),
            ]);

        $response->assertStatus(201);
    }

    public function test_upload_rejected_after_close_date()
    {
        $config = ApplicationConfiguration::factory()->closed()->create();
        $application = Application::factory()->create(['config_id' => $config->id]);
        $applicant = $application->user;

        $response = $this->actingAs($applicant, 'sanctum')
            ->postJson("/api/applications/{$application->id}/documents", [
                'document_type' => 'school_id',
                'file' => \Illuminate\Http\UploadedFile::fake()->image('id.jpg'),
            ]);

        $response->assertStatus(400);
        $this->assertDatabaseCount('application_documents', 0);
    }

    // Slot Limit on Approval

    public function test_approve_succeeds_when_slots_available()
    {
        $verifier = User::factory()->create(['role' => 'sk_verifier']);
        $config = ApplicationConfiguration::factory()->almostFull()->create(); // 9/10
        $application = Application::factory()->create([
            'config_id' => $config->id,
            'status'    => 'for_review',
        ]);
        ApplicationDocument::factory()->count(3)->create(['application_id' => $application->id]);

        $response = $this->actingAs($verifier, 'sanctum')
            ->postJson("/api/verifier/applications/{$application->id}/approve");

        $response->assertOk();
        $this->assertEquals(10, $config->fresh()->slots_filled);
    }

    public function test_approve_rejected_when_at_capacity()
    {
        $verifier = User::factory()->create(['role' => 'sk_verifier']);
        $config = ApplicationConfiguration::factory()->atCapacity()->create(); // 10/10
        $application = Application::factory()->create([
            'config_id' => $config->id,
            'status'    => 'for_review',
        ]);

        $response = $this->actingAs($verifier, 'sanctum')
            ->postJson("/api/verifier/applications/{$application->id}/approve");

        $response->assertStatus(400);
        $this->assertEquals(10, $config->fresh()->slots_filled); // unchanged
    }

    public function test_unlimited_config_never_blocks_approval()
    {
        $verifier = User::factory()->create(['role' => 'sk_verifier']);
        $config = ApplicationConfiguration::factory()->create([
            'is_unlimited' => true,
            'slots_filled' => 99999,
        ]);
        $application = Application::factory()->create([
            'config_id' => $config->id,
            'status'    => 'for_review',
        ]);

        $response = $this->actingAs($verifier, 'sanctum')
            ->postJson("/api/verifier/applications/{$application->id}/approve");

        $response->assertOk();
    }
}