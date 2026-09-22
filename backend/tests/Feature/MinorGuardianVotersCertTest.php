<?php

namespace Tests\Feature;

use Tests\TestCase;
use App\Models\User;
use App\Models\StudentProfile;
use App\Models\ApplicationConfiguration;
use App\Models\FaceVerification;
use Illuminate\Foundation\Testing\RefreshDatabase;

class MinorGuardianVotersCertTest extends TestCase
{
    use RefreshDatabase;

    protected function makeApplicant()
    {
        return User::factory()->create(['role' => 'applicant']);
    }

    /**
     * ApplicationController::store() requires a FaceVerification whose
     * verified_config_id matches the period being applied to (added
     * after this test file — see the "re-verify your face" check).
     * Not what these tests are about, so just satisfy the gate.
     */
    protected function verifyFaceFor(User $applicant, ApplicationConfiguration $config): void
    {
        FaceVerification::create([
            'user_id'          => $applicant->id,
            'id_image_path'    => 'test/id.jpg',
            'live_photo_path'  => 'test/live.jpg',
            'status'           => 'verified',
            'verified_at'      => now(),
            'verified_config_id' => $config->id,
        ]);
    }

    protected function submitPayload()
    {
        return [
            'school_name'       => 'Pamantasan ng Cabuyao',
            'course'            => 'BS Information Technology',
            'year_level'        => '1st Year',
            'student_id_number' => '2026-00001',
        ];
    }

    public function test_application_blocked_when_no_profile_birthdate()
    {
        $applicant = $this->makeApplicant();
        StudentProfile::create(['user_id' => $applicant->id]); // no birthdate
        $config = ApplicationConfiguration::factory()->alreadyStarted()->create();
        $this->verifyFaceFor($applicant, $config);

        $response = $this->actingAs($applicant, 'sanctum')
            ->postJson('/api/applications', $this->submitPayload());

        $response->assertStatus(400);
        $response->assertJsonFragment(['message' => 'Please complete your profile (date of birth) before applying.']);
    }

    public function test_application_blocked_when_minor_without_guardian_info()
    {
        $applicant = $this->makeApplicant();
        StudentProfile::create([
            'user_id'   => $applicant->id,
            'birthdate' => now()->subYears(16), // minor
        ]);
        $config = ApplicationConfiguration::factory()->alreadyStarted()->create();
        $this->verifyFaceFor($applicant, $config);

        $response = $this->actingAs($applicant, 'sanctum')
            ->postJson('/api/applications', $this->submitPayload());

        $response->assertStatus(400);
        $response->assertJsonFragment(['message' => 'As a minor applicant, please complete your guardian information (name and relationship) in your profile before applying.']);
    }

    public function test_application_succeeds_when_minor_with_complete_guardian_info()
    {
        $applicant = $this->makeApplicant();
        StudentProfile::create([
            'user_id'               => $applicant->id,
            'birthdate'             => now()->subYears(16),
            'guardian_first_name'   => 'Elena',
            'guardian_last_name'    => 'Santos',
            'guardian_relationship' => 'Mother',
        ]);
        $config = ApplicationConfiguration::factory()->alreadyStarted()->create();
        $this->verifyFaceFor($applicant, $config);

        $response = $this->actingAs($applicant, 'sanctum')
            ->postJson('/api/applications', $this->submitPayload());

        $response->assertStatus(201);
    }

    public function test_application_succeeds_when_adult_without_guardian_info()
    {
        $applicant = $this->makeApplicant();
        StudentProfile::create([
            'user_id'   => $applicant->id,
            'birthdate' => now()->subYears(20), // adult
        ]);
        $config = ApplicationConfiguration::factory()->alreadyStarted()->create();
        $this->verifyFaceFor($applicant, $config);

        $response = $this->actingAs($applicant, 'sanctum')
            ->postJson('/api/applications', $this->submitPayload());

        $response->assertStatus(201);
    }

    public function test_is_minor_boundary_at_exactly_18()
    {
        $profile = StudentProfile::create([
            'user_id'   => $this->makeApplicant()->id,
            'birthdate' => now()->subYears(18), // exactly 18 today
        ]);

        $this->assertFalse($profile->is_minor);
    }

    public function test_is_minor_true_one_day_before_18th_birthday()
    {
        $profile = StudentProfile::create([
            'user_id'   => $this->makeApplicant()->id,
            'birthdate' => now()->subYears(18)->addDay(), // turns 18 tomorrow
        ]);

        $this->assertTrue($profile->is_minor);
    }

    public function test_has_complete_guardian_info_requires_all_three_fields()
    {
        $profile = StudentProfile::create([
            'user_id'             => $this->makeApplicant()->id,
            'guardian_first_name' => 'Elena',
            'guardian_last_name'  => 'Santos',
            // relationship missing
        ]);

        $this->assertFalse($profile->hasCompleteGuardianInfo());
    }

    public function test_is_barangay_resident_computed_from_barangay_field()
    {
        $mamatidProfile = StudentProfile::create([
            'user_id'  => $this->makeApplicant()->id,
            'barangay' => 'Mamatid',
        ]);
        $otherProfile = StudentProfile::create([
            'user_id'  => $this->makeApplicant()->id,
            'barangay' => 'Banlic',
        ]);

        $this->assertTrue($mamatidProfile->is_barangay_resident);
        $this->assertFalse($otherProfile->is_barangay_resident);
    }
}