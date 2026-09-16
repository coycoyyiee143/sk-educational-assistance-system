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
                'school_year'       => '2026-2027',
                'open_date'         => now()->addDays(5)->format('Y-m-d'),
                'close_date'        => $config->close_date->format('Y-m-d H:i:s'),
                'slot_limit'        => 500,
                'is_unlimited'      => false,
                'is_active'         => true,
                'assistance_amount' => $config->assistance_amount,
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
                'school_year'       => '2026-2027', // attempting to change a locked field
                'open_date'         => $config->open_date->format('Y-m-d'),
                'close_date'        => $config->close_date->format('Y-m-d H:i:s'),
                'slot_limit'        => $config->slot_limit,
                'is_unlimited'      => false,
                'is_active'         => true,
                'assistance_amount' => $config->assistance_amount,
            ]);

        $response->assertStatus(400);
        $this->assertEquals('2025-2026', $config->fresh()->school_year); // unchanged
    }

    // NOTE: close_date is NOT editable through this general-purpose update()
    // endpoint at all, regardless of whether the period has started — see
    // ApplicationConfigurationController::update()'s docblock. Extending the
    // deadline is a separate, deliberate action (extend()), covered by
    // ApplicationConfigurationControllerTest::test_admin_can_extend_the_closing_date().
    // This test instead verifies that is_active CAN still be toggled after
    // the period has started, since that field isn't in the locked set.
    public function test_can_still_edit_active_flag_after_period_starts()
    {
        $admin = User::factory()->create(['role' => 'sk_admin']);
        $config = ApplicationConfiguration::factory()->alreadyStarted()->create();

        $response = $this->actingAs($admin, 'sanctum')
            ->putJson("/api/admin/application-configs/{$config->id}", [
                'school_year'       => $config->school_year,
                'open_date'         => $config->open_date->format('Y-m-d'),
                'close_date'        => $config->close_date->format('Y-m-d H:i:s'),
                'slot_limit'        => $config->slot_limit,
                'is_unlimited'      => false,
                'is_active'         => false,
                'assistance_amount' => $config->assistance_amount,
            ]);

        $response->assertOk();
        $this->assertFalse((bool) $config->fresh()->is_active);
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

    // Approving at capacity no longer hard-rejects — VerifierController::approve()
    // now auto-waitlists the applicant instead (200, not 400). See
    // VerifierWaitlistTest.php for the waitlist-promotion flow this feeds into.
    public function test_approve_waitlists_applicant_when_at_capacity()
    {
        $verifier = User::factory()->create(['role' => 'sk_verifier']);
        $config = ApplicationConfiguration::factory()->atCapacity()->create(); // 10/10
        $application = Application::factory()->create([
            'config_id' => $config->id,
            'status'    => 'for_review',
        ]);

        $response = $this->actingAs($verifier, 'sanctum')
            ->postJson("/api/verifier/applications/{$application->id}/approve");

        $response->assertOk();
        $this->assertEquals('waitlisted', $application->fresh()->status);
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