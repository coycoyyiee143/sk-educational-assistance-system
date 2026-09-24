<?php

namespace Tests\Feature;

use Tests\TestCase;
use App\Models\User;
use App\Models\Application;
use App\Models\FaceVerification;
use App\Models\ClaimingAssignment;
use App\Models\ClaimingSchedule;
use App\Models\ClaimingLane;
use App\Models\ApplicationConfiguration;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;

class FaceVerificationControllerTest extends TestCase
{
    use RefreshDatabase;

    protected function makeApplicant(): User
    {
        return User::factory()->create(['role' => 'applicant']);
    }

    protected function makeClaimingAssignment(User $applicant): array
    {
        $config = ApplicationConfiguration::factory()->create();
        $app = Application::factory()->create([
            'user_id'        => $applicant->id,
            'config_id'      => $config->id,
            'status'         => 'approved',
            'control_number' => 'SK-2026-0001',
        ]);

        $schedule = ClaimingSchedule::forceCreate([
            'config_id'    => $config->id,
            'location'     => 'Barangay Mamatid Covered Court',
            'is_active'    => true,
            'activated_at' => now(),
        ]);

        $lane = ClaimingLane::forceCreate([
            'claiming_schedule_id' => $schedule->id,
            'lane_name'            => 'Lane A',
            'capacity'             => 50,
            'batch'                => 'morning',
            'claiming_date'        => now()->addDays(1)->toDateString(),
        ]);

        $assignment = ClaimingAssignment::create([
            'application_id'       => $app->id,
            'claiming_schedule_id' => $schedule->id,
            'claiming_lane_id'     => $lane->id,
            'claim_status'         => 'pending_claiming',
        ]);

        return [$app, $assignment];
    }

    // ── store() (registration) ─────────────────────────────────

    public function test_store_creates_verified_record_on_match()
    {
        Storage::fake('local');
        Http::fake([
            '*/verify-face' => Http::response([
                'match'     => true,
                'score'     => 0.95,
                'embedding' => [0.1, 0.2, 0.3],
            ], 200),
        ]);

        $applicant = $this->makeApplicant();

        $response = $this->actingAs($applicant, 'sanctum')
            ->postJson('/api/face-verification', [
                'id_image'   => UploadedFile::fake()->image('id.jpg'),
                'live_photo' => UploadedFile::fake()->image('live.jpg'),
            ]);

        $response->assertStatus(201);
        $this->assertDatabaseHas('face_verifications', [
            'user_id' => $applicant->id,
            'status'  => 'verified',
        ]);
    }

    public function test_store_returns_422_when_faces_do_not_match()
    {
        Storage::fake('local');
        Http::fake([
            '*/verify-face' => Http::response([
                'match'     => false,
                'score'     => 0.10,
                'embedding' => null,
            ], 200),
        ]);

        $applicant = $this->makeApplicant();

        $response = $this->actingAs($applicant, 'sanctum')
            ->postJson('/api/face-verification', [
                'id_image'   => UploadedFile::fake()->image('id.jpg'),
                'live_photo' => UploadedFile::fake()->image('live.jpg'),
            ]);

        $response->assertStatus(422);
        $this->assertDatabaseHas('face_verifications', [
            'user_id' => $applicant->id,
            'status'  => 'failed',
        ]);
    }

    public function test_store_rejects_when_already_verified()
    {
        Storage::fake('local');
        $applicant = $this->makeApplicant();
        FaceVerification::create([
            'user_id'          => $applicant->id,
            'status'           => 'verified',
            'id_image_path'    => 'face-verifications/placeholder/id.jpg',
            'live_photo_path'  => 'face-verifications/placeholder/live.jpg',
        ]);

        $response = $this->actingAs($applicant, 'sanctum')
            ->postJson('/api/face-verification', [
                'id_image'   => UploadedFile::fake()->image('id.jpg'),
                'live_photo' => UploadedFile::fake()->image('live.jpg'),
            ]);

        $response->assertStatus(400);
        $response->assertJsonFragment(['message' => 'Face already verified for this account.']);
    }

    public function test_store_validates_required_files()
    {
        $applicant = $this->makeApplicant();

        $response = $this->actingAs($applicant, 'sanctum')->postJson('/api/face-verification', []);

        $response->assertStatus(422);
        $response->assertJsonValidationErrors(['id_image', 'live_photo']);
    }

    // ── show() ──────────────────────────────────────────────────

    public function test_show_returns_not_started_when_no_record()
    {
        $applicant = $this->makeApplicant();

        $response = $this->actingAs($applicant, 'sanctum')->getJson('/api/face-verification');

        $response->assertOk();
        $response->assertJson(['status' => 'not_started']);
    }

    public function test_show_returns_status_for_existing_record()
    {
        $applicant = $this->makeApplicant();
        FaceVerification::create([
            'user_id'         => $applicant->id,
            'status'          => 'verified',
            'id_image_path'   => 'face-verifications/1/id_123.jpg',
            'live_photo_path' => 'face-verifications/1/live_123.jpg',
            'verified_at'     => now(),
        ]);

        $response = $this->actingAs($applicant, 'sanctum')->getJson('/api/face-verification');

        $response->assertOk();
        $response->assertJsonFragment(['status' => 'verified']);
    }

    // ── myPhoto() ───────────────────────────────────────────────

    public function test_my_photo_streams_own_registration_photo()
    {
        Storage::fake('local');
        $applicant = $this->makeApplicant();

        $file = UploadedFile::fake()->image('live.jpg');
        $path = $file->storeAs("face-verifications/{$applicant->id}", 'live_1.jpg', 'local');

        FaceVerification::create([
            'user_id'         => $applicant->id,
            'status'          => 'verified',
            'id_image_path'   => "face-verifications/{$applicant->id}/id_1.jpg",
            'live_photo_path' => $path,
        ]);

        $response = $this->actingAs($applicant, 'sanctum')->getJson('/api/face-verification/photo');

        $response->assertOk();
    }

    public function test_my_photo_404_when_no_record()
    {
        $applicant = $this->makeApplicant();

        $response = $this->actingAs($applicant, 'sanctum')->getJson('/api/face-verification/photo');

        $response->assertStatus(404);
    }

    // ── latestClaimingVerification() ───────────────────────────

    public function test_latest_claiming_verification_returns_not_verified_when_no_attempt()
    {
        $applicant = $this->makeApplicant();
        [$app, $assignment] = $this->makeClaimingAssignment($applicant);
        $verifier = User::factory()->create(['role' => 'sk_verifier']);

        $response = $this->actingAs($verifier, 'sanctum')
            ->getJson("/api/verifier/claiming/{$app->id}/face-verification");

        $response->assertOk();
        $response->assertJson(['status' => 'not_verified']);
    }

    // ── verifyClaiming() ────────────────────────────────────────

    public function test_verify_claiming_records_match_result()
    {
        Storage::fake('local');
        Http::fake([
            '*/verify-against-embedding' => Http::response(['match' => true, 'score' => 0.9], 200),
        ]);

        $applicant = $this->makeApplicant();
        [$app, $assignment] = $this->makeClaimingAssignment($applicant);
        FaceVerification::create([
            'user_id'         => $applicant->id,
            'status'          => 'verified',
            'id_image_path'   => "face-verifications/{$applicant->id}/id_1.jpg",
            'live_photo_path' => "face-verifications/{$applicant->id}/live_1.jpg",
            'face_embedding'  => [0.1, 0.2, 0.3],
        ]);

        $verifier = User::factory()->create(['role' => 'sk_verifier']);

        $response = $this->actingAs($verifier, 'sanctum')
            ->postJson("/api/verifier/claiming/{$app->id}/verify-face", [
                'live_photo' => UploadedFile::fake()->image('claim_live.jpg'),
            ]);

        $response->assertOk();
        $response->assertJsonFragment(['match' => true]);
        $this->assertDatabaseHas('claiming_face_verifications', [
            'claiming_assignment_id' => $assignment->id,
            'matched'                => 1,
        ]);
    }

    public function test_verify_claiming_returns_404_when_no_face_verification_on_file()
    {
        Storage::fake('local');
        $applicant = $this->makeApplicant();
        [$app, $assignment] = $this->makeClaimingAssignment($applicant);
        // No FaceVerification record created for this applicant.

        $verifier = User::factory()->create(['role' => 'sk_verifier']);

        $response = $this->actingAs($verifier, 'sanctum')
            ->postJson("/api/verifier/claiming/{$app->id}/verify-face", [
                'live_photo' => UploadedFile::fake()->image('claim_live.jpg'),
            ]);

        $response->assertStatus(404);
    }

    public function test_verify_claiming_returns_404_when_no_assignment()
    {
        Storage::fake('local');
        $applicant = $this->makeApplicant();
        $app = Application::factory()->create(['user_id' => $applicant->id, 'status' => 'approved']);
        FaceVerification::create([
            'user_id'         => $applicant->id,
            'status'          => 'verified',
            'id_image_path'   => "face-verifications/{$applicant->id}/id_1.jpg",
            'live_photo_path' => "face-verifications/{$applicant->id}/live_1.jpg",
            'face_embedding'  => [0.1, 0.2, 0.3],
        ]);

        $verifier = User::factory()->create(['role' => 'sk_verifier']);

        $response = $this->actingAs($verifier, 'sanctum')
            ->postJson("/api/verifier/claiming/{$app->id}/verify-face", [
                'live_photo' => UploadedFile::fake()->image('claim_live.jpg'),
            ]);

        $response->assertStatus(404);
    }

    // ── registrationPhoto() ─────────────────────────────────────

    public function test_registration_photo_forbidden_for_unrelated_applicant()
    {
        Storage::fake('local');
        $owner = $this->makeApplicant();
        $stranger = $this->makeApplicant();
        $app = Application::factory()->create(['user_id' => $owner->id]);

        $file = UploadedFile::fake()->image('live.jpg');
        $path = $file->storeAs("face-verifications/{$owner->id}", 'live_1.jpg', 'local');
        FaceVerification::create([
            'user_id'         => $owner->id,
            'status'          => 'verified',
            'id_image_path'   => "face-verifications/{$owner->id}/id_1.jpg",
            'live_photo_path' => $path,
        ]);

        $response = $this->actingAs($stranger, 'sanctum')
            ->getJson("/api/claiming/applications/{$app->id}/registration-photo");

        $response->assertStatus(403);
    }

    public function test_registration_photo_visible_to_owner()
    {
        Storage::fake('local');
        $owner = $this->makeApplicant();
        $app = Application::factory()->create(['user_id' => $owner->id]);

        $file = UploadedFile::fake()->image('live.jpg');
        $path = $file->storeAs("face-verifications/{$owner->id}", 'live_1.jpg', 'local');
        FaceVerification::create([
            'user_id'         => $owner->id,
            'status'          => 'verified',
            'id_image_path'   => "face-verifications/{$owner->id}/id_1.jpg",
            'live_photo_path' => $path,
        ]);

        $response = $this->actingAs($owner, 'sanctum')
            ->getJson("/api/claiming/applications/{$app->id}/registration-photo");

        $response->assertOk();
    }

    // ── profilePhoto() ──────────────────────────────────────────

    public function test_profile_photo_forbidden_for_unrelated_applicant()
    {
        Storage::fake('local');
        $owner = $this->makeApplicant();
        $stranger = $this->makeApplicant();

        $file = UploadedFile::fake()->image('id.jpg');
        $path = $file->storeAs("face-verifications/{$owner->id}", 'id_1.jpg', 'local');
        FaceVerification::create([
            'user_id'         => $owner->id,
            'status'          => 'verified',
            'id_image_path'   => $path,
            'live_photo_path' => "face-verifications/{$owner->id}/live_1.jpg",
        ]);

        $response = $this->actingAs($stranger, 'sanctum')
            ->getJson("/api/users/{$owner->id}/profile-photo");

        $response->assertStatus(403);
    }

    public function test_profile_photo_visible_to_verifier()
    {
        Storage::fake('local');
        $owner = $this->makeApplicant();
        $verifier = User::factory()->create(['role' => 'sk_verifier']);

        $file = UploadedFile::fake()->image('id.jpg');
        $path = $file->storeAs("face-verifications/{$owner->id}", 'id_1.jpg', 'local');
        FaceVerification::create([
            'user_id'         => $owner->id,
            'status'          => 'verified',
            'id_image_path'   => $path,
            'live_photo_path' => "face-verifications/{$owner->id}/live_1.jpg",
        ]);

        $response = $this->actingAs($verifier, 'sanctum')
            ->getJson("/api/users/{$owner->id}/profile-photo");

        $response->assertOk();
    }
}
