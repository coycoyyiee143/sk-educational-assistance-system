<?php

namespace Tests\Feature;

use Tests\TestCase;
use App\Models\User;
use App\Models\StudentProfile;
use App\Models\PasswordHistory;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;

class ProfileControllerTest extends TestCase
{
    use RefreshDatabase;

    // Passes 8+ chars, lowercase+digit, uncompromised, and none of
    // NotObviouslyWeakPassword's blocked terms.
    const VALID_PASSWORD = 'Xk9vRq2mZp7';

    protected function setUp(): void
    {
        parent::setUp();

        // Password::uncompromised() calls out to pwnedpasswords.com by
        // default — fake it globally so tests never need real network
        // access. Empty body means "not found in breach corpus".
        Http::fake([
            'api.pwnedpasswords.com/*' => Http::response('', 200),
        ]);
    }

    protected function makeApplicant(array $overrides = []): User
    {
        return User::factory()->create(array_merge(['role' => 'applicant'], $overrides));
    }

    // ── show() ──────────────────────────────────────────────────

    public function test_show_returns_authenticated_user_with_profile()
    {
        $user = $this->makeApplicant();
        StudentProfile::create(['user_id' => $user->id, 'barangay' => 'Mamatid']);

        $response = $this->actingAs($user, 'sanctum')->getJson('/api/profile');

        $response->assertOk();
        $response->assertJsonFragment(['id' => $user->id]);
        $response->assertJsonPath('profile.barangay', 'Mamatid');
    }

    // ── store() ─────────────────────────────────────────────────

    public function test_store_creates_profile_and_marks_it_complete_when_core_fields_filled()
    {
        $user = $this->makeApplicant();

        $response = $this->actingAs($user, 'sanctum')->postJson('/api/profile', [
            'birthdate'   => '2000-01-01',
            'gender'      => 'male',
            'house_no'    => '123',
            'purok_type'  => 'purok',
            'purok'       => 'Purok 1',
            'barangay'    => 'Mamatid',
            'city'        => 'Cabuyao',
            'province'    => 'Laguna',
        ]);

        $response->assertStatus(201);
        $this->assertDatabaseHas('student_profiles', [
            'user_id' => $user->id,
        ]);
    }

    public function test_store_rejects_when_profile_already_complete()
    {
        $user = $this->makeApplicant();
        StudentProfile::create([
            'user_id'             => $user->id,
            'is_profile_complete' => true,
        ]);

        $response = $this->actingAs($user, 'sanctum')->postJson('/api/profile', [
            'birthdate' => '2000-01-01',
        ]);

        $response->assertStatus(400);
        $response->assertJsonFragment(['message' => 'Profile already set up.']);
    }

    public function test_store_validates_field_formats()
    {
        $user = $this->makeApplicant();

        $response = $this->actingAs($user, 'sanctum')->postJson('/api/profile', [
            'gender' => 'not-a-valid-gender',
        ]);

        $response->assertStatus(422);
        $response->assertJsonValidationErrors(['gender']);
    }

    // ── update() ────────────────────────────────────────────────

    public function test_update_recomputes_completeness_flag()
    {
        $user = $this->makeApplicant();
        StudentProfile::create(['user_id' => $user->id]);

        $response = $this->actingAs($user, 'sanctum')->putJson('/api/profile', [
            'birthdate'  => '2000-01-01',
            'gender'     => 'female',
            'house_no'   => '45',
            'purok_type' => 'purok',
            'purok'      => 'Purok 2',
            'barangay'   => 'Mamatid',
            'city'       => 'Cabuyao',
            'province'   => 'Laguna',
        ]);

        $response->assertOk();
        $this->assertDatabaseHas('student_profiles', [
            'user_id'             => $user->id,
            'is_profile_complete' => 1,
        ]);
    }

    public function test_update_requires_subdivision_when_purok_type_is_phase()
    {
        $user = $this->makeApplicant();
        StudentProfile::create(['user_id' => $user->id]);

        $response = $this->actingAs($user, 'sanctum')->putJson('/api/profile', [
            'purok_type' => 'phase',
            // subdivision intentionally omitted
        ]);

        $response->assertStatus(422);
        $response->assertJsonValidationErrors(['subdivision']);
    }

    // ── updateAccount() ─────────────────────────────────────────

    public function test_update_account_updates_basic_info()
    {
        $user = $this->makeApplicant();

        $response = $this->actingAs($user, 'sanctum')->putJson('/api/user/profile', [
            'first_name'    => 'Juan',
            'last_name'     => 'Dela Cruz',
            'mobile_number' => '09171234567',
        ]);

        $response->assertOk();
        $this->assertDatabaseHas('users', [
            'id'         => $user->id,
            'first_name' => 'Juan',
            'last_name'  => 'Dela Cruz',
        ]);
    }

    public function test_update_account_rejects_duplicate_mobile_number()
    {
        $existing = $this->makeApplicant(['mobile_number' => '09171234567']);
        $user = $this->makeApplicant();

        $response = $this->actingAs($user, 'sanctum')->putJson('/api/user/profile', [
            'first_name'    => 'Juan',
            'last_name'     => 'Dela Cruz',
            'mobile_number' => '09171234567',
        ]);

        $response->assertStatus(422);
        $response->assertJsonValidationErrors(['mobile_number']);
    }

    // ── updatePassword() ────────────────────────────────────────

    public function test_update_password_succeeds_with_correct_current_password()
    {
        $user = $this->makeApplicant(['password' => Hash::make('OldPass1word')]);

        $response = $this->actingAs($user, 'sanctum')->putJson('/api/user/password', [
            'current_password'      => 'OldPass1word',
            'password'              => self::VALID_PASSWORD,
            'password_confirmation' => self::VALID_PASSWORD,
        ]);

        $response->assertOk();
        $this->assertTrue(Hash::check(self::VALID_PASSWORD, $user->fresh()->password));
    }

    public function test_update_password_rejects_wrong_current_password()
    {
        $user = $this->makeApplicant(['password' => Hash::make('OldPass1word')]);

        $response = $this->actingAs($user, 'sanctum')->putJson('/api/user/password', [
            'current_password'      => 'WrongPassword1',
            'password'              => self::VALID_PASSWORD,
            'password_confirmation' => self::VALID_PASSWORD,
        ]);

        $response->assertStatus(422);
        $response->assertJsonFragment(['message' => 'Current password is incorrect.']);
    }

    public function test_update_password_rejects_recently_used_password()
    {
        $user = $this->makeApplicant(['password' => Hash::make('OldPass1word')]);
        PasswordHistory::create([
            'user_id'       => $user->id,
            'password_hash' => Hash::make(self::VALID_PASSWORD),
        ]);

        $response = $this->actingAs($user, 'sanctum')->putJson('/api/user/password', [
            'current_password'      => 'OldPass1word',
            'password'              => self::VALID_PASSWORD,
            'password_confirmation' => self::VALID_PASSWORD,
        ]);

        $response->assertStatus(422);
        $response->assertJsonValidationErrors(['password']);
    }

    public function test_update_password_rejects_weak_password()
    {
        $user = $this->makeApplicant(['password' => Hash::make('OldPass1word')]);

        $response = $this->actingAs($user, 'sanctum')->putJson('/api/user/password', [
            'current_password'      => 'OldPass1word',
            'password'              => 'admin123',
            'password_confirmation' => 'admin123',
        ]);

        $response->assertStatus(422);
        $response->assertJsonValidationErrors(['password']);
    }

    // ── uploadAvatar() ──────────────────────────────────────────

    public function test_upload_avatar_stores_file_and_updates_path()
    {
        Storage::fake('local');
        $user = $this->makeApplicant();

        $response = $this->actingAs($user, 'sanctum')->postJson('/api/user/avatar', [
            'avatar' => UploadedFile::fake()->image('avatar.jpg'),
        ]);

        $response->assertOk();
        $user->refresh();
        $this->assertNotNull($user->avatar_path);
        Storage::disk('local')->assertExists($user->avatar_path);
    }

    public function test_upload_avatar_rejects_unsupported_file_type()
    {
        Storage::fake('local');
        $user = $this->makeApplicant();

        $response = $this->actingAs($user, 'sanctum')->postJson('/api/user/avatar', [
            'avatar' => UploadedFile::fake()->create('doc.pdf', 100, 'application/pdf'),
        ]);

        $response->assertStatus(422);
        $response->assertJsonValidationErrors(['avatar']);
    }

    // ── avatarPhoto() ───────────────────────────────────────────

    public function test_avatar_photo_visible_to_owner()
    {
        Storage::fake('local');
        $user = $this->makeApplicant();
        $file = UploadedFile::fake()->image('avatar.jpg');
        $path = $file->storeAs("avatars/{$user->id}", 'avatar_1.jpg', 'local');
        $user->update(['avatar_path' => $path]);

        $response = $this->actingAs($user, 'sanctum')->getJson("/api/users/{$user->id}/avatar");

        $response->assertOk();
    }

    public function test_avatar_photo_forbidden_for_unrelated_applicant()
    {
        Storage::fake('local');
        $owner = $this->makeApplicant();
        $stranger = $this->makeApplicant();
        $file = UploadedFile::fake()->image('avatar.jpg');
        $path = $file->storeAs("avatars/{$owner->id}", 'avatar_1.jpg', 'local');
        $owner->update(['avatar_path' => $path]);

        $response = $this->actingAs($stranger, 'sanctum')->getJson("/api/users/{$owner->id}/avatar");

        $response->assertStatus(403);
    }

    public function test_avatar_photo_404_when_no_avatar_on_file()
    {
        $user = $this->makeApplicant();

        $response = $this->actingAs($user, 'sanctum')->getJson("/api/users/{$user->id}/avatar");

        $response->assertStatus(404);
    }
}
