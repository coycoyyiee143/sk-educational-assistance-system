<?php

namespace Database\Seeders;

use App\Models\Application;
use App\Models\ApplicationConfiguration;
use App\Models\ApplicationDocument;
use App\Models\ClaimingAssignment;
use App\Models\ClaimingLane;
use App\Models\ClaimingSchedule;
use App\Models\StudentProfile;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class ClaimingFaceTestSeeder extends Seeder
{
    public function run(): void
    {
        $admin = User::firstOrCreate(
            ['email' => 'admin@skmamatid.com'],
            [
                'first_name'        => 'SK Admin',
                'middle_name'       => 'Mamatid',
                'last_name'         => 'Official',
                'mobile_number'     => '09123456789',
                'password'          => Hash::make('admin123'),
                'role'              => 'sk_admin',
                'is_active'         => true,
                'email_verified_at' => now(),
            ]
        );

        User::firstOrCreate(
            ['email' => 'verifier@skmamatid.com'],
            [
                'first_name'        => 'SK Verifier',
                'middle_name'       => 'Mamatid',
                'last_name'         => 'Official',
                'mobile_number'     => '09876543210',
                'password'          => Hash::make('verifier123'),
                'role'              => 'sk_verifier',
                'is_active'         => true,
                'email_verified_at' => now(),
            ]
        );

        $config = ApplicationConfiguration::firstOrCreate(
            ['school_year' => '2025-2026'],
            [
                'open_date'          => now()->subDays(1)->startOfDay(),
                'close_date'         => now()->addDays(13)->endOfDay(),
                'slot_limit'         => 2000,
                'slots_filled'       => 1,
                'assistance_amount'  => 5000, // required by ApplicationConfigurationController validation
                'is_unlimited'       => false,
                'is_active'          => true,
                'created_by'         => $admin->id,
            ]
        );

        // Matches WaitlistScenarioSeeder's pattern — only the fields it
        // actually sets. morning_start/end etc. exist on the model but
        // aren't required to create a working schedule for testing.
        $schedule = ClaimingSchedule::firstOrCreate(
            ['config_id' => $config->id],
            [
                'location'              => 'Barangay Mamatid Covered Court',
                'is_published'          => true,
                'published_at'          => now()->subDays(2),
                'grace_period_date'     => now()->addWeek()->startOfWeek()->addDay()->toDateString(),
                'grace_period_end_date' => now()->addWeek()->startOfWeek()->addDays(5)->toDateString(),
            ]
        );

        $lane = ClaimingLane::firstOrCreate(
            [
                'claiming_schedule_id' => $schedule->id,
                'lane_name'            => 'Lane A',
            ],
            [
                'capacity'      => 50,
                'batch'         => 'morning', // lowercase — confirmed from WaitlistScenarioSeeder
                'claiming_date' => now()->subDays(2)->toDateString(),
            ]
        );

        // Applicant approved and ready to claim. Register THIS account's
        // face yourself through the UI first (registration face scan) —
        // that populates FaceVerification's registration_match_score/status
        // columns. Then log in as this user and go through claiming-day
        // verification, which populates the separate
        // claiming_photo_path/claiming_match_score/claiming_status columns
        // on the same FaceVerification row.
        $claimant = User::firstOrCreate(
            ['email' => 'claimtest@test.com'],
            [
                'first_name'        => 'Claim',
                'middle_name'       => 'Test',
                'last_name'         => 'Applicant',
                'mobile_number'     => '09555555555',
                'password'          => Hash::make('applicant123'),
                'role'              => 'applicant',
                'is_active'         => true,
                'email_verified_at' => now(),
            ]
        );

        StudentProfile::firstOrCreate(
            ['user_id' => $claimant->id],
            [
                'birthdate'           => now()->subYears(20)->subDays(45),
                'barangay'            => 'Mamatid',
                'is_profile_complete' => true,
            ]
        );

        // Real format confirmed from Application::tryApprove() and
        // WaitlistScenarioSeeder — 'SK-' . year . '-' . 4-digit padded
        // sequence. Was previously wrong (had guessed 'SKEAS-...').
        $controlNumber = 'SK-' . now()->format('Y') . '-' . str_pad((string) $claimant->id, 4, '0', STR_PAD_LEFT);

        $app = Application::firstOrCreate(
            ['user_id' => $claimant->id, 'config_id' => $config->id],
            [
                'school_name'       => 'Laguna State Polytechnic University',
                'course'            => 'BS Information Technology',
                'year_level'        => '3rd Year',
                'student_id_number' => '2023-00999',
                'status'            => 'approved',
                'control_number'    => $controlNumber,
                'submitted_at'      => now()->subDays(2),
            ]
        );

        foreach (['registration_form', 'school_id', 'voters_certificate'] as $docType) {
            ApplicationDocument::firstOrCreate(
                ['application_id' => $app->id, 'document_type' => $docType],
                [
                    'file_path' => "documents/{$app->id}/seeded_placeholder_{$docType}.jpg",
                    'file_name' => "seeded_placeholder_{$docType}.jpg",
                    'mime_type' => 'image/jpeg',
                    'version'   => 1,
                    'status'    => 'processed',
                ]
            );
        }

        // Required for this application to appear in VerifierClaiming
        // search — the controller filters with ->whereHas('claimingAssignment').
        // claim_status: 'pending' and source: 'original' confirmed exactly
        // from WaitlistScenarioSeeder / FullDemoSeeder's real usage.
        ClaimingAssignment::firstOrCreate(
            ['application_id' => $app->id],
            [
                'claiming_schedule_id' => $schedule->id,
                'claiming_lane_id'     => $lane->id,
                'claim_status'         => 'pending',
                'source'               => 'original',
            ]
        );
    }
}