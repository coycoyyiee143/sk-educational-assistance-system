<?php

namespace Tests\Feature;

use Tests\TestCase;
use App\Models\User;
use App\Models\Application;
use App\Models\ApplicationConfiguration;
use App\Models\ClaimingSchedule;
use App\Models\ClaimingLane;
use App\Models\ClaimingAssignment;
use Illuminate\Foundation\Testing\RefreshDatabase;

class VerifierReasonCategoriesTest extends TestCase
{
    use RefreshDatabase;

    protected function makeVerifier()
    {
        return User::factory()->create(['role' => 'sk_verifier']);
    }

    protected function makeApplication(array $overrides = [])
    {
        return Application::factory()->create(array_merge([
            'status' => 'for_review',
        ], $overrides));
    }

    // ── reject() ────────────────────────────────────────────────

    public function test_reject_requires_reason_categories()
    {
        $verifier = $this->makeVerifier();
        $app = $this->makeApplication();

        $response = $this->actingAs($verifier, 'sanctum')
            ->postJson("/api/verifier/applications/{$app->id}/reject", [
                'reason' => 'Some reason text',
            ]);

        $response->assertStatus(422);
        $response->assertJsonValidationErrors(['reason_categories']);
    }

    public function test_reject_requires_at_least_one_category_not_empty_array()
    {
        $verifier = $this->makeVerifier();
        $app = $this->makeApplication();

        $response = $this->actingAs($verifier, 'sanctum')
            ->postJson("/api/verifier/applications/{$app->id}/reject", [
                'reason' => 'Some reason text',
                'reason_categories' => [],
            ]);

        $response->assertStatus(422);
    }

    public function test_reject_stores_multiple_reason_categories_and_updates_status()
    {
        $verifier = $this->makeVerifier();
        $app = $this->makeApplication();

        $response = $this->actingAs($verifier, 'sanctum')
            ->postJson("/api/verifier/applications/{$app->id}/reject", [
                'reason' => 'Name mismatch. Not a registered voter.',
                'reason_categories' => [
                    'Name does not match other submitted documents.',
                    'Not a registered voter in Barangay Mamatid.',
                ],
            ]);

        $response->assertOk();
        $this->assertDatabaseHas('applications', [
            'id' => $app->id,
            'status' => 'rejected',
        ]);

        $action = $app->fresh()->verifierActions()->latest()->first();
        $this->assertEquals('rejected', $action->action);
        $this->assertCount(2, $action->reason_categories);
        $this->assertContains('Not a registered voter in Barangay Mamatid.', $action->reason_categories);
    }

    // ── requestReupload() ───────────────────────────────────────

    public function test_reupload_requires_at_least_one_document()
    {
        $verifier = $this->makeVerifier();
        $app = $this->makeApplication();

        $response = $this->actingAs($verifier, 'sanctum')
            ->postJson("/api/verifier/applications/{$app->id}/reupload", [
                'notes' => 'Please fix your documents.',
                'reupload_details' => [],
            ]);

        $response->assertStatus(422);
    }

    public function test_reupload_requires_reason_categories_per_document()
    {
        $verifier = $this->makeVerifier();
        $app = $this->makeApplication();

        $response = $this->actingAs($verifier, 'sanctum')
            ->postJson("/api/verifier/applications/{$app->id}/reupload", [
                'notes' => 'Please fix your documents.',
                'reupload_details' => [
                    [
                        'document_type' => 'school_id',
                        'reason' => 'Missing back side.',
                        // reason_categories intentionally omitted
                    ],
                ],
            ]);

        $response->assertStatus(422);
    }

    public function test_reupload_stores_per_document_reason_categories_and_updates_status()
    {
        $verifier = $this->makeVerifier();
        $app = $this->makeApplication();

        $response = $this->actingAs($verifier, 'sanctum')
            ->postJson("/api/verifier/applications/{$app->id}/reupload", [
                'notes' => 'Please re-upload the following document(s): School ID.',
                'reupload_details' => [
                    [
                        'document_type' => 'school_id',
                        'label' => 'School ID',
                        'reason_categories' => ['Missing front or back of School ID.'],
                        'reason' => 'Missing front or back of School ID.',
                    ],
                ],
            ]);

        $response->assertOk();
        $this->assertDatabaseHas('applications', [
            'id' => $app->id,
            'status' => 'reupload_requested',
        ]);

        $action = $app->fresh()->verifierActions()->latest()->first();
        $this->assertEquals('reupload_requested', $action->action);
        $this->assertEquals('school_id', $action->reupload_details[0]['document_type']);
        $this->assertContains('Missing front or back of School ID.', $action->reupload_details[0]['reason_categories']);
    }

    // ── approve() ───────────────────────────────────────────────

    public function test_approve_does_not_require_reason_categories()
    {
        $verifier = $this->makeVerifier();
        $config = ApplicationConfiguration::factory()->almostFull()->create(); // 9/10
        $app = $this->makeApplication(['config_id' => $config->id]);

        $response = $this->actingAs($verifier, 'sanctum')
            ->postJson("/api/verifier/applications/{$app->id}/approve", [
                'notes' => 'Looks good.',
            ]);

        $response->assertOk();
        $this->assertDatabaseHas('applications', [
            'id' => $app->id,
            'status' => 'approved',
        ]);
    }

    // ── updateClaimStatus() ─────────────────────────────────────

    protected function makeApprovedAssignment()
    {
        $config = ApplicationConfiguration::factory()->create();
        $app = Application::factory()->create([
            'config_id' => $config->id,
            'status' => 'approved',
            'control_number' => 'SK-2026-0001',
        ]);

        $schedule = ClaimingSchedule::forceCreate([
            'config_id'   => $config->id,
            'location'    => 'Barangay Mamatid Covered Court',
            'is_published' => true,
            'published_at' => now(),
        ]);

        $lane = ClaimingLane::forceCreate([
            'claiming_schedule_id' => $schedule->id,
            'lane_name'            => 'Lane A',
            'capacity'             => 50,
            'batch'                => 'morning',
            'claiming_date'        => now()->addDays(1)->toDateString(),
        ]);

        $assignment = ClaimingAssignment::create([
            'application_id'        => $app->id,
            'claiming_schedule_id'  => $schedule->id,
            'claiming_lane_id'      => $lane->id,
            'claim_status'          => 'pending',
        ]);

        return [$app, $assignment];
    }

    public function test_claimed_does_not_require_reason_categories()
    {
        $verifier = $this->makeVerifier();
        [$app, $assignment] = $this->makeApprovedAssignment();

        $response = $this->actingAs($verifier, 'sanctum')
            ->postJson("/api/verifier/claiming/{$app->id}/status", [
                'claim_status' => 'claimed',
            ]);

        $response->assertOk();
        $this->assertDatabaseHas('applications', ['id' => $app->id, 'status' => 'claimed']);
    }

    public function test_unclaimed_does_not_require_reason_categories()
    {
        $verifier = $this->makeVerifier();
        [$app, $assignment] = $this->makeApprovedAssignment();

        $response = $this->actingAs($verifier, 'sanctum')
            ->postJson("/api/verifier/claiming/{$app->id}/status", [
                'claim_status' => 'unclaimed',
            ]);

        $response->assertOk();
        $this->assertDatabaseHas('applications', ['id' => $app->id, 'status' => 'unclaimed']);
    }

    public function test_not_cleared_requires_reason_categories()
    {
        $verifier = $this->makeVerifier();
        [$app, $assignment] = $this->makeApprovedAssignment();

        $response = $this->actingAs($verifier, 'sanctum')
            ->postJson("/api/verifier/claiming/{$app->id}/status", [
                'claim_status' => 'not_cleared',
            ]);

        $response->assertStatus(422);
    }

    public function test_not_cleared_stores_multiple_reason_categories()
    {
        $verifier = $this->makeVerifier();
        [$app, $assignment] = $this->makeApprovedAssignment();

        $response = $this->actingAs($verifier, 'sanctum')
            ->postJson("/api/verifier/claiming/{$app->id}/status", [
                'claim_status' => 'not_cleared',
                'reason_categories' => [
                    'Physical documents did not match submitted application.',
                    'Unable to present valid ID during claiming.',
                ],
                'notes' => 'Details here.',
            ]);

        $response->assertOk();
        $this->assertDatabaseHas('applications', ['id' => $app->id, 'status' => 'not_cleared']);

        $assignment->refresh();
        $this->assertCount(2, $assignment->reason_categories);
        $this->assertContains('Unable to present valid ID during claiming.', $assignment->reason_categories);
    }

    public function test_reason_categories_cleared_when_marking_claimed_after_previous_not_cleared()
    {
        $verifier = $this->makeVerifier();
        [$app, $assignment] = $this->makeApprovedAssignment();
        $assignment->update([
            'claim_status' => 'not_cleared',
            'reason_categories' => ['Document appeared altered or invalid.'],
        ]);

        $response = $this->actingAs($verifier, 'sanctum')
            ->postJson("/api/verifier/claiming/{$app->id}/status", [
                'claim_status' => 'claimed',
            ]);

        $response->assertOk();
        $assignment->refresh();
        $this->assertNull($assignment->reason_categories);
    }
}