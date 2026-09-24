<?php

namespace Tests\Feature;

use Tests\TestCase;
use App\Models\User;
use App\Models\Application;
use App\Models\ApplicationConfiguration;
use App\Models\ApplicationDocument;
use App\Jobs\ProcessOcrDocument;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Facades\Notification;

/**
 * Covers VerifierController::index, show, approve, appealDecision, retryOcr
 * and stats — the review-queue side of the controller. reject() and
 * requestReupload()'s reason-category handling is already covered in
 * VerifierReasonCategoriesTest.php and is not duplicated here.
 */
class VerifierReviewTest extends TestCase
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

    protected function makeApplication(array $overrides = [])
    {
        return Application::factory()->create(array_merge([
            'status' => 'for_review',
        ], $overrides));
    }

    // ── index() ─────────────────────────────────────────────────

    public function test_verifier_can_list_applications_for_active_config()
    {
        $verifier = $this->makeVerifier();
        $config = ApplicationConfiguration::factory()->create(['is_active' => true]);
        $app = $this->makeApplication(['config_id' => $config->id]);

        $response = $this->actingAs($verifier, 'sanctum')
            ->getJson('/api/verifier/applications');

        $response->assertOk();
        $response->assertJsonFragment(['id' => $app->id]);
    }

    public function test_index_excludes_pending_prescreening_applications_without_documents()
    {
        $verifier = $this->makeVerifier();
        $config = ApplicationConfiguration::factory()->create(['is_active' => true]);
        $hidden = $this->makeApplication([
            'config_id' => $config->id,
            'status'    => 'pending_prescreening',
        ]);

        $response = $this->actingAs($verifier, 'sanctum')
            ->getJson('/api/verifier/applications');

        $response->assertOk();
        $response->assertJsonMissing(['id' => $hidden->id]);
    }

    public function test_non_verifier_cannot_list_applications()
    {
        $applicant = $this->makeApplicant();

        $response = $this->actingAs($applicant, 'sanctum')
            ->getJson('/api/verifier/applications');

        $response->assertStatus(403);
    }

    // ── show() ──────────────────────────────────────────────────

    public function test_verifier_can_view_a_single_application_with_relations()
    {
        $verifier = $this->makeVerifier();
        $app = $this->makeApplication();
        ApplicationDocument::factory()->create(['application_id' => $app->id]);

        $response = $this->actingAs($verifier, 'sanctum')
            ->getJson("/api/verifier/applications/{$app->id}");

        $response->assertOk();
        $response->assertJsonFragment(['id' => $app->id]);
        $response->assertJsonStructure(['documents']);
    }

    public function test_show_returns_404_for_unknown_application()
    {
        $verifier = $this->makeVerifier();

        $response = $this->actingAs($verifier, 'sanctum')
            ->getJson('/api/verifier/applications/999999');

        $response->assertStatus(404);
    }

    public function test_non_verifier_cannot_view_application()
    {
        $applicant = $this->makeApplicant();
        $app = $this->makeApplication();

        $response = $this->actingAs($applicant, 'sanctum')
            ->getJson("/api/verifier/applications/{$app->id}");

        $response->assertStatus(403);
    }

    // ── approve() ───────────────────────────────────────────────

    public function test_verifier_can_approve_an_application_with_open_slots()
    {
        Notification::fake();
        $verifier = $this->makeVerifier();
        $config = ApplicationConfiguration::factory()->create(['slot_limit' => 10, 'slots_filled' => 0]);
        $app = $this->makeApplication(['config_id' => $config->id]);

        $response = $this->actingAs($verifier, 'sanctum')
            ->postJson("/api/verifier/applications/{$app->id}/approve");

        $response->assertOk();
        $this->assertDatabaseHas('applications', ['id' => $app->id, 'status' => 'approved']);
        $this->assertEquals(1, $config->fresh()->slots_filled);
        $this->assertDatabaseHas('verifier_actions', [
            'application_id' => $app->id,
            'verifier_id'    => $verifier->id,
            'action'         => 'approved',
        ]);
    }

    public function test_approving_at_full_capacity_waitlists_the_applicant_instead_of_failing()
    {
        Notification::fake();
        $verifier = $this->makeVerifier();
        $config = ApplicationConfiguration::factory()->atCapacity()->create(); // 10/10
        $app = $this->makeApplication(['config_id' => $config->id]);

        $response = $this->actingAs($verifier, 'sanctum')
            ->postJson("/api/verifier/applications/{$app->id}/approve");

        $response->assertOk();
        $response->assertJsonFragment(['message' => 'No slots available — applicant added to waitlist instead.']);
        $this->assertDatabaseHas('applications', ['id' => $app->id, 'status' => 'waitlisted']);
        $this->assertEquals(10, $config->fresh()->slots_filled); // unchanged, no slot consumed
    }

    public function test_cannot_approve_an_already_approved_application()
    {
        $verifier = $this->makeVerifier();
        $app = $this->makeApplication(['status' => 'approved']);

        $response = $this->actingAs($verifier, 'sanctum')
            ->postJson("/api/verifier/applications/{$app->id}/approve");

        $response->assertStatus(400);
    }

    public function test_non_verifier_cannot_approve_an_application()
    {
        $applicant = $this->makeApplicant();
        $app = $this->makeApplication();

        $response = $this->actingAs($applicant, 'sanctum')
            ->postJson("/api/verifier/applications/{$app->id}/approve");

        $response->assertStatus(403);
    }

    // ── appealDecision() ────────────────────────────────────────

    public function test_verifier_can_approve_an_appeal_sending_it_back_to_review()
    {
        $verifier = $this->makeVerifier();
        $app = $this->makeApplication(['status' => 'appeal_requested']);

        $response = $this->actingAs($verifier, 'sanctum')
            ->postJson("/api/verifier/applications/{$app->id}/appeal-decision", [
                'decision' => 'approved',
                'notes'    => 'Documents look fine after review.',
            ]);

        $response->assertOk();
        $this->assertDatabaseHas('applications', ['id' => $app->id, 'status' => 'for_review']);
        $this->assertDatabaseHas('verifier_actions', [
            'application_id' => $app->id,
            'action'         => 'appeal_approved',
        ]);
    }

    public function test_verifier_can_deny_an_appeal_restoring_rejected_status()
    {
        $verifier = $this->makeVerifier();
        $app = $this->makeApplication(['status' => 'appeal_requested']);

        $response = $this->actingAs($verifier, 'sanctum')
            ->postJson("/api/verifier/applications/{$app->id}/appeal-decision", [
                'decision' => 'denied',
                'notes'    => 'Original decision stands.',
            ]);

        $response->assertOk();
        $this->assertDatabaseHas('applications', ['id' => $app->id, 'status' => 'rejected']);
        $this->assertDatabaseHas('verifier_actions', [
            'application_id' => $app->id,
            'action'         => 'appeal_denied',
        ]);
    }

    public function test_appeal_decision_fails_when_no_appeal_is_pending()
    {
        $verifier = $this->makeVerifier();
        $app = $this->makeApplication(['status' => 'for_review']);

        $response = $this->actingAs($verifier, 'sanctum')
            ->postJson("/api/verifier/applications/{$app->id}/appeal-decision", [
                'decision' => 'approved',
                'notes'    => 'N/A',
            ]);

        $response->assertStatus(400);
    }

    public function test_appeal_decision_requires_decision_and_notes()
    {
        $verifier = $this->makeVerifier();
        $app = $this->makeApplication(['status' => 'appeal_requested']);

        $response = $this->actingAs($verifier, 'sanctum')
            ->postJson("/api/verifier/applications/{$app->id}/appeal-decision", []);

        $response->assertStatus(422);
        $response->assertJsonValidationErrors(['decision', 'notes']);
    }

    // ── retryOcr() ──────────────────────────────────────────────

    public function test_verifier_can_retry_ocr_for_a_document()
    {
        Queue::fake();
        $verifier = $this->makeVerifier();
        $app = $this->makeApplication();
        $document = ApplicationDocument::factory()->create([
            'application_id' => $app->id,
            'status'         => 'failed',
        ]);

        $response = $this->actingAs($verifier, 'sanctum')
            ->postJson("/api/verifier/documents/{$document->id}/retry-ocr");

        $response->assertOk();
        $this->assertDatabaseHas('application_documents', [
            'id'     => $document->id,
            'status' => 'pending',
        ]);
        Queue::assertPushedOn('ocr', ProcessOcrDocument::class);
    }

    public function test_non_verifier_cannot_retry_ocr()
    {
        Queue::fake();
        $applicant = $this->makeApplicant();
        $app = $this->makeApplication();
        $document = ApplicationDocument::factory()->create(['application_id' => $app->id]);

        $response = $this->actingAs($applicant, 'sanctum')
            ->postJson("/api/verifier/documents/{$document->id}/retry-ocr");

        $response->assertStatus(403);
    }

    // ── retryAllFailedOcr() ─────────────────────────────────────

    public function test_verifier_can_retry_all_failed_ocr_documents_in_active_config()
    {
        Queue::fake();
        $verifier = $this->makeVerifier();
        $config = ApplicationConfiguration::factory()->create(['is_active' => true]);
        $app = $this->makeApplication(['config_id' => $config->id]);
        $failedA = ApplicationDocument::factory()->create(['application_id' => $app->id, 'status' => 'failed']);
        $failedB = ApplicationDocument::factory()->create(['application_id' => $app->id, 'status' => 'failed']);
        $verified = ApplicationDocument::factory()->create(['application_id' => $app->id, 'status' => 'processed']);

        $otherConfig = ApplicationConfiguration::factory()->create(['is_active' => false]);
        $otherApp = $this->makeApplication(['config_id' => $otherConfig->id]);
        $otherFailed = ApplicationDocument::factory()->create(['application_id' => $otherApp->id, 'status' => 'failed']);

        $response = $this->actingAs($verifier, 'sanctum')
            ->postJson('/api/verifier/documents/retry-failed-ocr');

        $response->assertOk();
        $response->assertJsonFragment(['queued' => 2]);
        $this->assertDatabaseHas('application_documents', ['id' => $failedA->id, 'status' => 'pending']);
        $this->assertDatabaseHas('application_documents', ['id' => $failedB->id, 'status' => 'pending']);
        $this->assertDatabaseHas('application_documents', ['id' => $verified->id, 'status' => 'processed']);
        $this->assertDatabaseHas('application_documents', ['id' => $otherFailed->id, 'status' => 'failed']);
        Queue::assertPushedOn('ocr', ProcessOcrDocument::class);
        Queue::assertPushed(ProcessOcrDocument::class, 2);
    }

    public function test_non_verifier_cannot_retry_all_failed_ocr()
    {
        Queue::fake();
        $applicant = $this->makeApplicant();

        $response = $this->actingAs($applicant, 'sanctum')
            ->postJson('/api/verifier/documents/retry-failed-ocr');

        $response->assertStatus(403);
    }

    // ── stats() ─────────────────────────────────────────────────

    public function test_stats_counts_applications_by_status_for_active_config()
    {
        $verifier = $this->makeVerifier();
        $config = ApplicationConfiguration::factory()->create(['is_active' => true]);
        $reviewApp = $this->makeApplication(['config_id' => $config->id, 'status' => 'for_review']);
        $approvedApp = $this->makeApplication(['config_id' => $config->id, 'status' => 'approved']);
        $rejectedApp = $this->makeApplication(['config_id' => $config->id, 'status' => 'rejected']);

        $response = $this->actingAs($verifier, 'sanctum')
            ->getJson('/api/verifier/stats');

        $response->assertOk();
        $response->assertJson([
            'review'           => 1,
            'approved'         => 1,
            'rejected'         => 1,
            'no_active_period' => false,
        ]);
    }

    public function test_stats_reports_no_active_period_when_none_exists()
    {
        $verifier = $this->makeVerifier();
        ApplicationConfiguration::factory()->create(['is_active' => false]);

        $response = $this->actingAs($verifier, 'sanctum')
            ->getJson('/api/verifier/stats');

        $response->assertOk();
        $response->assertJson(['no_active_period' => true]);
    }
}
