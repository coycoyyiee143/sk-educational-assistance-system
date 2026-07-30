<?php

namespace Database\Seeders;

use App\Models\Application;
use App\Models\ApplicationConfiguration;
use App\Models\ApplicationDocument;
use App\Models\StudentProfile;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class ActivePeriodSeeder extends Seeder
{
    public function run(): void
    {
        $admin = User::create([
            'first_name'        => 'SK Admin',
            'middle_name'       => 'Mamatid',
            'last_name'         => 'Official',
            'email'             => 'admin@skmamatid.com',
            'mobile_number'     => '09123456789',
            'password'          => Hash::make('admin123'),
            'role'              => 'sk_admin',
            'is_active'         => true,
            'email_verified_at' => now(),
        ]);

        User::create([
            'first_name'        => 'SK Verifier',
            'middle_name'       => 'Mamatid',
            'last_name'         => 'Official',
            'email'             => 'verifier@skmamatid.com',
            'mobile_number'     => '09876543210',
            'password'          => Hash::make('verifier123'),
            'role'              => 'sk_verifier',
            'is_active'         => true,
            'email_verified_at' => now(),
        ]);

        $config = ApplicationConfiguration::create([
            'school_year'  => '2025-2026',
            'open_date'    => now()->subDays(1)->startOfDay(),
            'close_date'   => now()->addDays(13)->endOfDay(),
            'slot_limit'   => 2000,
            'slots_filled' => 2,
            'is_unlimited' => false,
            'is_active'    => true,
            'created_by'   => $admin->id,
        ]);

        // Applicant #1 — approved, has a control number, ready for claiming schedule testing
        $approvedApplicant = User::create([
            'first_name'        => 'Juan',
            'middle_name'       => 'Santos',
            'last_name'         => 'Dela Cruz',
            'email'             => 'applicant1@test.com',
            'mobile_number'     => '09111111111',
            'password'          => Hash::make('applicant123'),
            'role'              => 'applicant',
            'is_active'         => true,
            'email_verified_at' => now(),
        ]);

        StudentProfile::create([
            'user_id'              => $approvedApplicant->id,
            'birthdate'            => now()->subYears(20)->subDays(45),
            'barangay'             => 'Mamatid',
            'is_profile_complete'  => true,
        ]);

        $approvedApp = Application::create([
            'user_id'            => $approvedApplicant->id,
            'config_id'          => $config->id,
            'school_name'        => 'Laguna State Polytechnic University',
            'course'             => 'BS Information Technology',
            'year_level'         => '3rd Year',
            'student_id_number'  => '2023-00123',
            'status'             => 'approved',
            'control_number'     => Application::generateControlNumber($config->id),
            'submitted_at'       => now()->subDays(2),
        ]);

        // Placeholder documents so this applicant appears in the verifier's
        // application list (which now correctly filters to only show
        // applications with at least one document — see whereHas('documents')
        // fix). These file_path values do NOT correspond to real files on
        // disk. This applicant exists to test the claiming schedule flow
        // (lane assignment, control number, claim status updates), not
        // document review. Clicking "View File" on these will 404 — that's
        // expected. Use a real end-to-end upload for testing document
        // viewing/OCR specifically.
        foreach (['registration_form', 'school_id', 'voters_certificate'] as $docType) {
            ApplicationDocument::create([
                'application_id' => $approvedApp->id,
                'document_type'  => $docType,
                'file_path'      => "documents/{$approvedApp->id}/seeded_placeholder_{$docType}.jpg",
                'file_name'      => "seeded_placeholder_{$docType}.jpg",
                'mime_type'      => 'image/jpeg',
                'version'        => 1,
                'status'         => 'processed',
            ]);
        }

        // Applicant #2 — registered account only, no application submitted yet
        User::create([
            'first_name'        => 'Regina Grace',
            'middle_name'       => 'Antido',
            'last_name'         => 'Ayes',
            'email'             => 'reginaga88@gmail.com',
            'mobile_number'     => '09222222222',
            'password'          => Hash::make('12345678'),
            'role'              => 'applicant',
            'is_active'         => true,
            'email_verified_at' => now(),
        ]);

        // Applicant #3 — MINOR applicant, complete profile including
        // guardian info, application already submitted and approved with
        // placeholder documents (same pattern as Applicant #1). Exists
        // specifically to test the Guardian row on VerifierApplicationReview
        // without needing to manually submit an application first — just
        // open this application as a verifier and the Guardian
        // (Minor Applicant) row should render "Elena Marie Santos (Mother)".
        // As with Applicant #1's documents, these file_path values are
        // placeholders that will 404 on "View File" — use a real end-to-end
        // upload if you need to test the actual OCR guardian-name check.
        $minorApplicant = User::create([
            'first_name'        => 'Miguel',
            'middle_name'       => 'Ramos',
            'last_name'         => 'Santos',
            'email'             => 'minor@test.com',
            'mobile_number'     => '09333333333',
            'password'          => Hash::make('applicant123'),
            'role'              => 'applicant',
            'is_active'         => true,
            'email_verified_at' => now(),
        ]);

        StudentProfile::create([
            'user_id'               => $minorApplicant->id,
            'birthdate'             => now()->subYears(16)->subDays(120),
            'barangay'              => 'Mamatid',
            'guardian_first_name'   => 'Elena',
            'guardian_middle_name'  => 'Marie',
            'guardian_last_name'    => 'Santos',
            'guardian_relationship' => 'Mother',
            'guardian_contact'      => '09444444444',
            'is_profile_complete'   => true,
        ]);

        $minorApp = Application::create([
            'user_id'            => $minorApplicant->id,
            'config_id'          => $config->id,
            'school_name'        => 'Pamantasan ng Cabuyao',
            'course'             => 'BS Information Technology',
            'year_level'         => '1st Year',
            'student_id_number'  => '2025-00456',
            'status'             => 'approved',
            'control_number'     => Application::generateControlNumber($config->id),
            'submitted_at'       => now()->subDays(1),
        ]);

        foreach (['registration_form', 'school_id', 'voters_certificate'] as $docType) {
            ApplicationDocument::create([
                'application_id' => $minorApp->id,
                'document_type'  => $docType,
                'file_path'      => "documents/{$minorApp->id}/seeded_placeholder_{$docType}.jpg",
                'file_name'      => "seeded_placeholder_{$docType}.jpg",
                'mime_type'      => 'image/jpeg',
                'version'        => 1,
                'status'         => 'processed',
            ]);
        }
    }
}