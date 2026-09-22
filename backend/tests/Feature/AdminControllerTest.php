<?php

namespace Tests\Feature;

use App\Mail\PersonnelAccountMail;
use App\Models\Application;
use App\Models\ApplicationConfiguration;
use App\Models\ApplicationDocument;
use App\Models\AuditLog;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Mail;
use Tests\TestCase;

class AdminControllerTest extends TestCase
{
    use RefreshDatabase;

    protected function makeAdmin(): User
    {
        return User::factory()->create(['role' => 'sk_admin']);
    }

    // ── Access control ──────────────────────────────────────────

    public function test_non_admin_cannot_access_admin_stats()
    {
        $applicant = User::factory()->create(['role' => 'applicant']);

        $response = $this->actingAs($applicant, 'sanctum')->getJson('/api/admin/stats');

        $response->assertStatus(403);
    }

    public function test_guest_cannot_access_admin_stats()
    {
        $response = $this->getJson('/api/admin/stats');

        $response->assertStatus(401);
    }

    // ── stats() ─────────────────────────────────────────────────

    public function test_stats_returns_zeroed_counts_when_no_active_period()
    {
        $admin = $this->makeAdmin();

        $response = $this->actingAs($admin, 'sanctum')->getJson('/api/admin/stats');

        $response->assertOk();
        $response->assertJson([
            'total' => 0,
            'no_active_period' => true,
        ]);
    }

    public function test_stats_counts_applications_by_status_for_active_period()
    {
        $admin = $this->makeAdmin();
        $config = ApplicationConfiguration::factory()->create(['is_active' => true]);

        $withDocs = Application::factory()->create([
            'config_id' => $config->id,
            'status'    => 'for_review',
        ]);
        ApplicationDocument::factory()->create(['application_id' => $withDocs->id]);

        Application::factory()->create([
            'config_id' => $config->id,
            'status'    => 'approved',
        ]);
        Application::factory()->create([
            'config_id' => $config->id,
            'status'    => 'rejected',
        ]);

        $response = $this->actingAs($admin, 'sanctum')->getJson('/api/admin/stats');

        $response->assertOk();
        $response->assertJson([
            'no_active_period' => false,
            'approved' => 1,
            'rejected' => 1,
        ]);
    }

    // ── users() ─────────────────────────────────────────────────

    public function test_users_returns_applicants_and_personnel_separately()
    {
        $admin = $this->makeAdmin();
        User::factory()->create(['role' => 'applicant']);
        User::factory()->create(['role' => 'sk_verifier']);

        $response = $this->actingAs($admin, 'sanctum')->getJson('/api/admin/users');

        $response->assertOk();
        $response->assertJsonStructure(['applicants', 'personnel']);
        $this->assertCount(1, $response->json('applicants'));
        // personnel includes the admin performing the request plus the verifier
        $this->assertCount(2, $response->json('personnel'));
    }

    // ── createPersonnel() ───────────────────────────────────────

    public function test_admin_can_create_personnel_account_and_setup_email_is_sent()
    {
        Mail::fake();
        $admin = $this->makeAdmin();

        $response = $this->actingAs($admin, 'sanctum')->postJson('/api/admin/users/personnel', [
            'first_name' => 'Juan',
            'last_name'  => 'Dela Cruz',
            'email'      => 'juan@example.com',
            'role'       => 'sk_verifier',
        ]);

        $response->assertStatus(201);
        $this->assertDatabaseHas('users', [
            'email' => 'juan@example.com',
            'role'  => 'sk_verifier',
        ]);
        Mail::assertSent(PersonnelAccountMail::class);
    }

    public function test_create_personnel_fails_validation_with_duplicate_email()
    {
        Mail::fake();
        $admin = $this->makeAdmin();
        User::factory()->create(['email' => 'taken@example.com']);

        $response = $this->actingAs($admin, 'sanctum')->postJson('/api/admin/users/personnel', [
            'first_name' => 'Juan',
            'last_name'  => 'Dela Cruz',
            'email'      => 'taken@example.com',
            'role'       => 'sk_verifier',
        ]);

        $response->assertStatus(422);
        $response->assertJsonValidationErrors(['email']);
        Mail::assertNothingSent();
    }

    public function test_create_personnel_rejects_invalid_role()
    {
        Mail::fake();
        $admin = $this->makeAdmin();

        $response = $this->actingAs($admin, 'sanctum')->postJson('/api/admin/users/personnel', [
            'first_name' => 'Juan',
            'last_name'  => 'Dela Cruz',
            'email'      => 'juan2@example.com',
            'role'       => 'applicant',
        ]);

        $response->assertStatus(422);
        $response->assertJsonValidationErrors(['role']);
    }

    // ── updateUser() ────────────────────────────────────────────

    public function test_admin_can_update_a_personnel_account()
    {
        $admin = $this->makeAdmin();
        $verifier = User::factory()->create(['role' => 'sk_verifier', 'first_name' => 'Old']);

        $response = $this->actingAs($admin, 'sanctum')->putJson("/api/admin/users/{$verifier->id}", [
            'first_name' => 'New',
        ]);

        $response->assertOk();
        $this->assertEquals('New', $verifier->fresh()->first_name);
        $this->assertDatabaseHas('audit_logs', [
            'action' => 'personnel_updated',
        ]);
    }

    public function test_update_user_fails_validation_with_duplicate_email()
    {
        $admin = $this->makeAdmin();
        $verifier = User::factory()->create(['role' => 'sk_verifier']);
        User::factory()->create(['email' => 'existing@example.com']);

        $response = $this->actingAs($admin, 'sanctum')->putJson("/api/admin/users/{$verifier->id}", [
            'email' => 'existing@example.com',
        ]);

        $response->assertStatus(422);
        $response->assertJsonValidationErrors(['email']);
    }

    // ── toggleStatus() ──────────────────────────────────────────

    public function test_admin_can_deactivate_a_personnel_account()
    {
        $admin = $this->makeAdmin();
        $verifier = User::factory()->create(['role' => 'sk_verifier', 'is_active' => true]);

        $response = $this->actingAs($admin, 'sanctum')->patchJson("/api/admin/users/{$verifier->id}/toggle-status");

        $response->assertOk();
        $response->assertJson(['is_active' => false]);
        $this->assertFalse($verifier->fresh()->is_active);
    }

    public function test_admin_can_reactivate_a_deactivated_personnel_account()
    {
        $admin = $this->makeAdmin();
        $verifier = User::factory()->create(['role' => 'sk_verifier', 'is_active' => false]);

        $response = $this->actingAs($admin, 'sanctum')->patchJson("/api/admin/users/{$verifier->id}/toggle-status");

        $response->assertOk();
        $response->assertJson(['is_active' => true]);
    }

    // ── deleteUser() ────────────────────────────────────────────

    public function test_admin_can_delete_a_personnel_account_with_no_activity_history()
    {
        $admin = $this->makeAdmin();
        $verifier = User::factory()->create(['role' => 'sk_verifier']);

        $response = $this->actingAs($admin, 'sanctum')->deleteJson("/api/admin/users/{$verifier->id}");

        $response->assertOk();
        $this->assertDatabaseMissing('users', ['id' => $verifier->id]);
    }

    public function test_admin_cannot_delete_a_personnel_account_with_activity_history()
    {
        $admin = $this->makeAdmin();
        $verifier = User::factory()->create(['role' => 'sk_verifier']);
        $application = Application::factory()->create();

        // verifier_actions.verifier_id is a plain (restrict-on-delete)
        // foreign key to users, unlike audit_logs.user_id which nulls
        // out on delete — so this is real activity history that should
        // block hard deletion.
        \App\Models\VerifierAction::create([
            'application_id' => $application->id,
            'verifier_id'    => $verifier->id,
            'action'         => 'approved',
        ]);

        $response = $this->actingAs($admin, 'sanctum')->deleteJson("/api/admin/users/{$verifier->id}");

        $response->assertStatus(409);
        $this->assertDatabaseHas('users', ['id' => $verifier->id]);
    }

    // ── resetPassword() ─────────────────────────────────────────

    public function test_admin_can_reset_a_verifiers_password_and_setup_email_is_sent()
    {
        Mail::fake();
        $admin = $this->makeAdmin();
        $verifier = User::factory()->create(['role' => 'sk_verifier']);

        $response = $this->actingAs($admin, 'sanctum')->postJson("/api/admin/users/{$verifier->id}/reset-password");

        $response->assertOk();
        Mail::assertSent(PersonnelAccountMail::class);
        $this->assertNotNull($verifier->fresh()->verification_token);
    }

    public function test_admin_cannot_reset_their_own_password_this_way()
    {
        Mail::fake();
        $admin = $this->makeAdmin();

        $response = $this->actingAs($admin, 'sanctum')->postJson("/api/admin/users/{$admin->id}/reset-password");

        $response->assertStatus(422);
        Mail::assertNothingSent();
    }

    public function test_reset_password_rejects_applicant_accounts()
    {
        Mail::fake();
        $admin = $this->makeAdmin();
        $applicant = User::factory()->create(['role' => 'applicant']);

        $response = $this->actingAs($admin, 'sanctum')->postJson("/api/admin/users/{$applicant->id}/reset-password");

        $response->assertStatus(422);
    }

    // ── resetTwoFactor() ────────────────────────────────────────

    public function test_admin_can_reset_a_users_two_factor_auth()
    {
        $admin = $this->makeAdmin();
        $verifier = User::factory()->create(['role' => 'sk_verifier']);
        // google2fa_secret / google2fa_enabled_at aren't in User::$fillable
        // (deliberately — see User model), so they must be set via
        // forceFill rather than the factory's mass-assignment, otherwise
        // they'd silently never get set and this test would prove nothing.
        $verifier->forceFill([
            'google2fa_secret'     => 'SOMESECRET',
            'google2fa_enabled_at' => now(),
        ])->save();

        $response = $this->actingAs($admin, 'sanctum')->postJson("/api/admin/users/{$verifier->id}/reset-2fa");

        $response->assertOk();
        $this->assertNull($verifier->fresh()->google2fa_secret);
        $this->assertNull($verifier->fresh()->google2fa_enabled_at);
    }

    public function test_admin_cannot_reset_their_own_two_factor_auth_this_way()
    {
        $admin = $this->makeAdmin();

        $response = $this->actingAs($admin, 'sanctum')->postJson("/api/admin/users/{$admin->id}/reset-2fa");

        $response->assertStatus(422);
    }

    // ── activityLog() / masterActivityLog() ─────────────────────

    public function test_activity_log_returns_only_the_logged_in_admins_own_entries()
    {
        $admin = $this->makeAdmin();
        $otherAdmin = $this->makeAdmin();

        AuditLog::record('action_one', null, 'by me', $admin);
        AuditLog::record('action_two', null, 'by other', $otherAdmin);

        $response = $this->actingAs($admin, 'sanctum')->getJson('/api/admin/activity-log');

        $response->assertOk();
        $data = $response->json('data');
        $this->assertCount(1, $data);
        $this->assertEquals('action_one', $data[0]['action']);
    }

    public function test_master_activity_log_excludes_applicant_logs()
    {
        $admin = $this->makeAdmin();
        $verifier = User::factory()->create(['role' => 'sk_verifier']);
        $applicant = User::factory()->create(['role' => 'applicant']);

        AuditLog::record('verifier_action', null, 'verifier did something', $verifier);
        AuditLog::record('applicant_action', null, 'applicant did something', $applicant);

        $response = $this->actingAs($admin, 'sanctum')->getJson('/api/admin/master-activity-log');

        $response->assertOk();
        $data = $response->json('data');
        $this->assertCount(1, $data);
        $this->assertEquals('verifier_action', $data[0]['action']);
    }

    public function test_master_activity_log_can_filter_by_role()
    {
        $admin = $this->makeAdmin();
        $verifier = User::factory()->create(['role' => 'sk_verifier']);

        AuditLog::record('verifier_action', null, 'verifier did something', $verifier);
        AuditLog::record('admin_action', null, 'admin did something', $admin);

        $response = $this->actingAs($admin, 'sanctum')->getJson('/api/admin/master-activity-log?role=sk_verifier');

        $response->assertOk();
        $data = $response->json('data');
        $this->assertCount(1, $data);
        $this->assertEquals('verifier_action', $data[0]['action']);
    }
}
