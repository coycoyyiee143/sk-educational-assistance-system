<?php

namespace Tests\Feature;

use Tests\TestCase;
use App\Models\User;
use App\Models\Application;
use App\Models\ApplicationConfiguration;
use App\Models\StudentProfile;
use App\Models\ClaimingSchedule;
use App\Models\ClaimingLane;
use App\Models\ClaimingAssignment;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;

class ApplicationControllerTest extends TestCase
{
    use RefreshDatabase;

    protected function makeApplicant(): User
    {
        return User::factory()->create(['role' => 'applicant']);
    }

    protected function completeAdultProfile(User $user): StudentProfile
    {
        return StudentProfile::create([
            'user_id'   => $user->id,
            'birthdate' => now()->subYears(20),
        ]);
    }

    protected function submitPayload(): array
    {
        return [
            'school_name'       => 'Pamantasan ng Cabuyao',
            'course'            => 'BS Information Technology',
            'year_level'        => '1st Year',
            'student_id_number' => '2026-00001',
        ];
    }

    // ── index() ─────────────────────────────────────────────────

    public function test_index_returns_only_the_authenticated_applicants_own_applications()
    {
        $applicant = $this->makeApplicant();
        $other = $this->makeApplicant();

        $mine = Application::factory()->create(['user_id' => $applicant->id]);
        Application::factory()->create(['user_id' => $other->id]);

        $response = $this->actingAs($applicant, 'sanctum')->getJson('/api/applications');

        $response->assertOk();
        $response->assertJsonCount(1);
        $response->assertJsonFragment(['id' => $mine->id]);
    }

    // ── store() ─────────────────────────────────────────────────

    public function test_store_creates_application_when_period_open_and_profile_complete()
    {
        $applicant = $this->makeApplicant();
        $this->completeAdultProfile($applicant);
        ApplicationConfiguration::factory()->alreadyStarted()->create();

        $response = $this->actingAs($applicant, 'sanctum')
            ->postJson('/api/applications', $this->submitPayload());

        $response->assertStatus(201);
        $this->assertDatabaseHas('applications', [
            'user_id' => $applicant->id,
            'status'  => 'draft_incomplete',
        ]);
    }

    public function test_store_rejects_when_no_active_application_period()
    {
        $applicant = $this->makeApplicant();
        $this->completeAdultProfile($applicant);
        // No ApplicationConfiguration created at all.

        $response = $this->actingAs($applicant, 'sanctum')
            ->postJson('/api/applications', $this->submitPayload());

        $response->assertStatus(400);
        $response->assertJsonFragment(['message' => 'No active application period.']);
    }

    public function test_store_rejects_when_period_closed()
    {
        $applicant = $this->makeApplicant();
        $this->completeAdultProfile($applicant);
        ApplicationConfiguration::factory()->closed()->create();

        $response = $this->actingAs($applicant, 'sanctum')
            ->postJson('/api/applications', $this->submitPayload());

        $response->assertStatus(400);
        $response->assertJsonFragment(['message' => 'This application period has closed.']);
    }

    public function test_store_rejects_when_slot_limit_reached()
    {
        $applicant = $this->makeApplicant();
        $this->completeAdultProfile($applicant);
        ApplicationConfiguration::factory()->atCapacity()->create();

        $response = $this->actingAs($applicant, 'sanctum')
            ->postJson('/api/applications', $this->submitPayload());

        $response->assertStatus(400);
        $response->assertJsonFragment(['message' => 'No more slots available.']);
    }

    public function test_store_rejects_duplicate_application_for_same_period()
    {
        $applicant = $this->makeApplicant();
        $this->completeAdultProfile($applicant);
        $config = ApplicationConfiguration::factory()->alreadyStarted()->create();
        Application::factory()->create(['user_id' => $applicant->id, 'config_id' => $config->id]);

        $response = $this->actingAs($applicant, 'sanctum')
            ->postJson('/api/applications', $this->submitPayload());

        $response->assertStatus(400);
        $response->assertJsonFragment(['message' => 'You already have an application for this period.']);
    }

    public function test_store_validates_required_fields()
    {
        $applicant = $this->makeApplicant();
        $this->completeAdultProfile($applicant);
        ApplicationConfiguration::factory()->alreadyStarted()->create();

        $response = $this->actingAs($applicant, 'sanctum')
            ->postJson('/api/applications', [
                'school_name' => '',
                'course'      => '',
                'year_level'  => '',
            ]);

        $response->assertStatus(422);
        $response->assertJsonValidationErrors(['school_name', 'course', 'year_level']);
    }

    // ── show() ──────────────────────────────────────────────────

    public function test_show_returns_own_application()
    {
        $applicant = $this->makeApplicant();
        $app = Application::factory()->create(['user_id' => $applicant->id]);

        $response = $this->actingAs($applicant, 'sanctum')->getJson("/api/applications/{$app->id}");

        $response->assertOk();
        $response->assertJsonFragment(['id' => $app->id]);
    }

    public function test_applicant_cannot_view_another_applicants_application()
    {
        $applicant = $this->makeApplicant();
        $owner = $this->makeApplicant();
        $app = Application::factory()->create(['user_id' => $owner->id]);

        $response = $this->actingAs($applicant, 'sanctum')->getJson("/api/applications/{$app->id}");

        $response->assertStatus(404);
    }

    // ── update() ────────────────────────────────────────────────

    public function test_update_succeeds_while_status_editable()
    {
        $applicant = $this->makeApplicant();
        $app = Application::factory()->create([
            'user_id' => $applicant->id,
            'status'  => 'draft_incomplete',
        ]);

        $response = $this->actingAs($applicant, 'sanctum')
            ->putJson("/api/applications/{$app->id}", [
                'school_name' => 'Updated School',
                'course'      => 'BSIT',
                'year_level'  => '2nd Year',
            ]);

        $response->assertOk();
        $this->assertDatabaseHas('applications', [
            'id'          => $app->id,
            'school_name' => 'Updated School',
        ]);
    }

    public function test_update_rejected_once_application_is_in_verification()
    {
        $applicant = $this->makeApplicant();
        $app = Application::factory()->create([
            'user_id' => $applicant->id,
            'status'  => 'for_review',
        ]);

        $response = $this->actingAs($applicant, 'sanctum')
            ->putJson("/api/applications/{$app->id}", [
                'school_name' => 'Updated School',
                'course'      => 'BSIT',
                'year_level'  => '2nd Year',
            ]);

        $response->assertStatus(400);
        $response->assertJsonFragment([
            'message' => 'This application can no longer be edited because it has already entered document verification.',
        ]);
    }

    // ── appeal() ────────────────────────────────────────────────

    public function test_appeal_succeeds_for_rejected_application()
    {
        $applicant = $this->makeApplicant();
        $app = Application::factory()->create([
            'user_id' => $applicant->id,
            'status'  => 'rejected',
        ]);

        $response = $this->actingAs($applicant, 'sanctum')
            ->postJson("/api/applications/{$app->id}/appeal", [
                'reason' => 'I believe this was a mistake.',
            ]);

        $response->assertOk();
        $this->assertDatabaseHas('applications', [
            'id'     => $app->id,
            'status' => 'appeal_requested',
        ]);
    }

    public function test_appeal_rejected_when_application_not_rejected_status()
    {
        $applicant = $this->makeApplicant();
        $app = Application::factory()->create([
            'user_id' => $applicant->id,
            'status'  => 'pending_prescreening',
        ]);

        $response = $this->actingAs($applicant, 'sanctum')
            ->postJson("/api/applications/{$app->id}/appeal", [
                'reason' => 'I believe this was a mistake.',
            ]);

        $response->assertStatus(400);
        $response->assertJsonFragment(['message' => 'Only a rejected application can be appealed.']);
    }

    public function test_appeal_rejected_when_already_appealed()
    {
        $applicant = $this->makeApplicant();
        $app = Application::factory()->create([
            'user_id'     => $applicant->id,
            'status'      => 'rejected',
            'appealed_at' => now(),
        ]);

        $response = $this->actingAs($applicant, 'sanctum')
            ->postJson("/api/applications/{$app->id}/appeal", [
                'reason' => 'Second attempt.',
            ]);

        $response->assertStatus(400);
        $response->assertJsonFragment(['message' => 'You have already submitted an appeal for this application.']);
    }

    // ── appealDocument() ────────────────────────────────────────

    public function test_appeal_document_streams_for_owner()
    {
        Storage::fake('local');
        $applicant = $this->makeApplicant();
        $file = UploadedFile::fake()->create('appeal.pdf', 100, 'application/pdf');
        $path = $file->storeAs("documents/1", 'appeal.pdf', 'local');

        $app = Application::factory()->create([
            'user_id'               => $applicant->id,
            'status'                => 'rejected',
            'appeal_document_path'  => $path,
        ]);

        $response = $this->actingAs($applicant, 'sanctum')
            ->getJson("/api/applications/{$app->id}/appeal-document");

        $response->assertOk();
    }

    public function test_appeal_document_forbidden_for_unrelated_applicant()
    {
        Storage::fake('local');
        $owner = $this->makeApplicant();
        $stranger = $this->makeApplicant();
        $file = UploadedFile::fake()->create('appeal.pdf', 100, 'application/pdf');
        $path = $file->storeAs("documents/1", 'appeal.pdf', 'local');

        $app = Application::factory()->create([
            'user_id'              => $owner->id,
            'status'               => 'rejected',
            'appeal_document_path' => $path,
        ]);

        $response = $this->actingAs($stranger, 'sanctum')
            ->getJson("/api/applications/{$app->id}/appeal-document");

        $response->assertStatus(403);
    }

    // ── claimingSchedule() ──────────────────────────────────────

    public function test_claiming_schedule_returns_404_when_no_assignment()
    {
        $applicant = $this->makeApplicant();
        Application::factory()->create(['user_id' => $applicant->id]);

        $response = $this->actingAs($applicant, 'sanctum')->getJson('/api/applications/claiming-schedule');

        $response->assertStatus(404);
    }

    public function test_claiming_schedule_returns_assignment_when_present()
    {
        $applicant = $this->makeApplicant();
        $config = ApplicationConfiguration::factory()->create();
        $app = Application::factory()->create([
            'user_id'        => $applicant->id,
            'config_id'      => $config->id,
            'status'         => 'approved',
            'control_number' => 'SK-2026-0001',
        ]);

        $schedule = ClaimingSchedule::forceCreate([
            'config_id'     => $config->id,
            'location'      => 'Barangay Mamatid Covered Court',
            'is_active'     => true,
            'activated_at'  => now(),
        ]);

        $lane = ClaimingLane::forceCreate([
            'claiming_schedule_id' => $schedule->id,
            'lane_name'            => 'Lane A',
            'capacity'             => 50,
            'batch'                => 'morning',
            'claiming_date'        => now()->addDays(1)->toDateString(),
        ]);

        ClaimingAssignment::create([
            'application_id'       => $app->id,
            'claiming_schedule_id' => $schedule->id,
            'claiming_lane_id'     => $lane->id,
            'claim_status'         => 'pending_claiming',
        ]);

        $response = $this->actingAs($applicant, 'sanctum')->getJson('/api/applications/claiming-schedule');

        $response->assertOk();
        $response->assertJsonPath('application.id', $app->id);
    }

    // ── activityLog() ───────────────────────────────────────────

    public function test_activity_log_returns_only_the_authenticated_users_logs()
    {
        $applicant = $this->makeApplicant();
        $this->completeAdultProfile($applicant);
        ApplicationConfiguration::factory()->alreadyStarted()->create();

        // Triggers an AuditLog::record() call for this applicant via store().
        $this->actingAs($applicant, 'sanctum')->postJson('/api/applications', $this->submitPayload());

        $response = $this->actingAs($applicant, 'sanctum')->getJson('/api/applications/activity-log');

        $response->assertOk();
        $response->assertJsonPath('data.0.user_id', $applicant->id);
    }
}
