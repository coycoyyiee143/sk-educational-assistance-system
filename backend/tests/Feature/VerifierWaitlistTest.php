<?php

namespace Tests\Feature;

use Tests\TestCase;
use App\Models\User;
use App\Models\Application;
use App\Models\ApplicationConfiguration;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Notification;

/**
 * Covers VerifierController::waitlist, promoteFromWaitlist and
 * promoteAllFromWaitlist.
 */
class VerifierWaitlistTest extends TestCase
{
    use RefreshDatabase;

    protected function makeVerifier()
    {
        return User::factory()->create(['role' => 'sk_verifier']);
    }

    protected function makeApplicant()
    {
        return User::factory()->create(['role' => 'applicant']);
    }

    // ── waitlist() ──────────────────────────────────────────────

    public function test_waitlist_returns_waitlisted_applicants_in_fifo_order()
    {
        $verifier = $this->makeVerifier();
        $config = ApplicationConfiguration::factory()->create(['is_active' => true, 'slot_limit' => 10, 'slots_filled' => 10]);

        $second = Application::factory()->create([
            'config_id'     => $config->id,
            'status'        => 'waitlisted',
            'waitlisted_at' => now(),
        ]);
        $first = Application::factory()->create([
            'config_id'     => $config->id,
            'status'        => 'waitlisted',
            'waitlisted_at' => now()->subMinutes(5),
        ]);

        $response = $this->actingAs($verifier, 'sanctum')
            ->getJson('/api/verifier/waitlist');

        $response->assertOk();
        $response->assertJsonPath('waitlist.0.id', $first->id);
        $response->assertJsonPath('waitlist.1.id', $second->id);
        $response->assertJsonPath('waitlist.0.position', 1);
        $response->assertJsonPath('slots_full', true);
    }

    public function test_waitlist_reports_empty_state_when_no_active_period()
    {
        $verifier = $this->makeVerifier();

        $response = $this->actingAs($verifier, 'sanctum')
            ->getJson('/api/verifier/waitlist');

        $response->assertOk();
        $response->assertJson(['config_id' => null, 'waitlist' => [], 'period_open' => false]);
    }

    public function test_non_verifier_cannot_view_waitlist()
    {
        $applicant = $this->makeApplicant();

        $response = $this->actingAs($applicant, 'sanctum')
            ->getJson('/api/verifier/waitlist');

        $response->assertStatus(403);
    }

    // ── promoteFromWaitlist() ───────────────────────────────────

    public function test_verifier_can_promote_a_single_waitlisted_applicant()
    {
        Notification::fake();
        $verifier = $this->makeVerifier();
        $config = ApplicationConfiguration::factory()->closed()->create(['slot_limit' => 10, 'slots_filled' => 9]);
        $applicant = Application::factory()->create([
            'config_id'     => $config->id,
            'status'        => 'waitlisted',
            'waitlisted_at' => now()->subMinutes(10),
        ]);

        $response = $this->actingAs($verifier, 'sanctum')
            ->postJson("/api/verifier/applications/config/{$config->id}/promote-waitlist");

        $response->assertOk();
        $this->assertDatabaseHas('applications', ['id' => $applicant->id, 'status' => 'approved']);
        $this->assertEquals(10, $config->fresh()->slots_filled);
    }

    public function test_promotion_fails_while_application_period_is_still_open()
    {
        $verifier = $this->makeVerifier();
        $config = ApplicationConfiguration::factory()->alreadyStarted()->create(['slot_limit' => 10, 'slots_filled' => 9]);
        Application::factory()->create([
            'config_id'     => $config->id,
            'status'        => 'waitlisted',
            'waitlisted_at' => now(),
        ]);

        $response = $this->actingAs($verifier, 'sanctum')
            ->postJson("/api/verifier/applications/config/{$config->id}/promote-waitlist");

        $response->assertStatus(400);
        $this->assertEquals(9, $config->fresh()->slots_filled);
    }

    public function test_promotion_fails_when_waitlist_is_empty()
    {
        $verifier = $this->makeVerifier();
        $config = ApplicationConfiguration::factory()->closed()->create();

        $response = $this->actingAs($verifier, 'sanctum')
            ->postJson("/api/verifier/applications/config/{$config->id}/promote-waitlist");

        $response->assertStatus(400);
        $response->assertJsonFragment(['message' => 'No waitlisted applicants available to promote.']);
    }

    public function test_non_verifier_cannot_promote_from_waitlist()
    {
        $applicant = $this->makeApplicant();
        $config = ApplicationConfiguration::factory()->closed()->create();

        $response = $this->actingAs($applicant, 'sanctum')
            ->postJson("/api/verifier/applications/config/{$config->id}/promote-waitlist");

        $response->assertStatus(403);
    }

    // ── promoteAllFromWaitlist() ────────────────────────────────

    public function test_verifier_can_promote_all_waitlisted_applicants_up_to_capacity()
    {
        Notification::fake();
        $verifier = $this->makeVerifier();
        $config = ApplicationConfiguration::factory()->closed()->create(['slot_limit' => 10, 'slots_filled' => 8]);

        $first = Application::factory()->create([
            'config_id' => $config->id, 'status' => 'waitlisted', 'waitlisted_at' => now()->subMinutes(10),
        ]);
        $second = Application::factory()->create([
            'config_id' => $config->id, 'status' => 'waitlisted', 'waitlisted_at' => now()->subMinutes(5),
        ]);
        $third = Application::factory()->create([
            'config_id' => $config->id, 'status' => 'waitlisted', 'waitlisted_at' => now(),
        ]);

        $response = $this->actingAs($verifier, 'sanctum')
            ->postJson("/api/verifier/applications/config/{$config->id}/promote-all-waitlist");

        $response->assertOk();
        $this->assertDatabaseHas('applications', ['id' => $first->id, 'status' => 'approved']);
        $this->assertDatabaseHas('applications', ['id' => $second->id, 'status' => 'approved']);
        $this->assertDatabaseHas('applications', ['id' => $third->id, 'status' => 'waitlisted']); // no room left
        $this->assertEquals(10, $config->fresh()->slots_filled);
    }

    public function test_promote_all_fails_while_application_period_is_still_open()
    {
        $verifier = $this->makeVerifier();
        $config = ApplicationConfiguration::factory()->alreadyStarted()->create(['slot_limit' => 10, 'slots_filled' => 5]);
        Application::factory()->create([
            'config_id' => $config->id, 'status' => 'waitlisted', 'waitlisted_at' => now(),
        ]);

        $response = $this->actingAs($verifier, 'sanctum')
            ->postJson("/api/verifier/applications/config/{$config->id}/promote-all-waitlist");

        $response->assertStatus(400);
    }

    public function test_promote_all_fails_when_waitlist_is_empty()
    {
        $verifier = $this->makeVerifier();
        $config = ApplicationConfiguration::factory()->closed()->create();

        $response = $this->actingAs($verifier, 'sanctum')
            ->postJson("/api/verifier/applications/config/{$config->id}/promote-all-waitlist");

        $response->assertStatus(400);
        $response->assertJsonFragment(['message' => 'No waitlisted applicants available to promote.']);
    }

    public function test_non_verifier_cannot_promote_all_from_waitlist()
    {
        $applicant = $this->makeApplicant();
        $config = ApplicationConfiguration::factory()->closed()->create();

        $response = $this->actingAs($applicant, 'sanctum')
            ->postJson("/api/verifier/applications/config/{$config->id}/promote-all-waitlist");

        $response->assertStatus(403);
    }
}
