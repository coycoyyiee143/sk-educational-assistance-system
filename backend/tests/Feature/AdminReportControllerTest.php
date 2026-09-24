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
use App\Models\VerifierAction;
use Illuminate\Foundation\Testing\RefreshDatabase;

class AdminReportControllerTest extends TestCase
{
    use RefreshDatabase;

    protected function makeAdmin()
    {
        return User::factory()->create(['role' => 'sk_admin']);
    }

    protected function makeApplicant()
    {
        return User::factory()->create(['role' => 'applicant']);
    }

    protected function makeConfig(array $overrides = [])
    {
        return ApplicationConfiguration::factory()->create(array_merge([
            'is_active' => true,
        ], $overrides));
    }

    protected function makeApplication(ApplicationConfiguration $config, array $overrides = [])
    {
        return Application::factory()->create(array_merge([
            'config_id' => $config->id,
        ], $overrides));
    }

    protected function attachProfile(Application $app, ?string $birthdate)
    {
        StudentProfile::create([
            'user_id'   => $app->user_id,
            'birthdate' => $birthdate,
        ]);
    }

    protected function makeClaimingAssignment(ApplicationConfiguration $config, array $appOverrides = [], array $assignmentOverrides = [])
    {
        $app = $this->makeApplication($config, array_merge(['status' => 'approved'], $appOverrides));

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

        return ClaimingAssignment::create(array_merge([
            'application_id'       => $app->id,
            'claiming_schedule_id' => $schedule->id,
            'claiming_lane_id'     => $lane->id,
            'claim_status'         => 'pending_claiming',
        ], $assignmentOverrides));
    }

    // ── Access control ──────────────────────────────────────────────

    public function test_non_admin_cannot_access_admin_report_routes()
    {
        $applicant = $this->makeApplicant();

        $response = $this->actingAs($applicant, 'sanctum')->getJson('/api/admin/reports/summary');

        $response->assertStatus(403);
    }

    public function test_report_routes_require_authentication()
    {
        $response = $this->getJson('/api/admin/reports/summary');

        $response->assertStatus(401);
    }

    // ── summary() ──────────────────────────────────────────────────

    public function test_dashboard_summary_totals_match_seeded_application_counts()
    {
        $admin = $this->makeAdmin();
        $config = $this->makeConfig();
        $this->makeApplication($config, ['status' => 'approved']);
        $this->makeApplication($config, ['status' => 'approved']);
        $this->makeApplication($config, ['status' => 'for_review']);
        $this->makeApplication($config, ['status' => 'rejected']);

        $response = $this->actingAs($admin, 'sanctum')->getJson("/api/admin/reports/summary?config_id={$config->id}");

        $response->assertOk();
        $response->assertJson([
            'summary' => [
                'total_applicants'      => 4,
                'pending_applications'  => 1,
                'approved_applications' => 2,
                'rejected_applications' => 1,
            ],
        ]);
    }

    // ── applications() ────────────────────────────────────────────

    public function test_applications_list_filters_by_status_type()
    {
        $admin = $this->makeAdmin();
        $config = $this->makeConfig();
        $this->makeApplication($config, ['status' => 'approved', 'control_number' => 'SK-2026-0001']);
        $this->makeApplication($config, ['status' => 'rejected', 'control_number' => 'SK-2026-0002']);

        $response = $this->actingAs($admin, 'sanctum')
            ->getJson("/api/admin/reports/applications?config_id={$config->id}&type=Approved");

        $response->assertOk();
        $response->assertJsonCount(1);
        $response->assertJsonFragment(['status' => 'approved']);
    }

    public function test_applications_list_filters_by_config_period()
    {
        $admin = $this->makeAdmin();
        $configA = $this->makeConfig(['school_year' => '2024-2025']);
        $configB = $this->makeConfig(['school_year' => '2025-2026']);
        $this->makeApplication($configA);
        $this->makeApplication($configB);
        $this->makeApplication($configB);

        $response = $this->actingAs($admin, 'sanctum')
            ->getJson("/api/admin/reports/applications?config_id={$configB->id}");

        $response->assertOk();
        $response->assertJsonCount(2);
    }

    // ── export() ──────────────────────────────────────────────────

    public function test_export_returns_csv_with_applicant_rows()
    {
        $admin = $this->makeAdmin();
        $config = $this->makeConfig();
        $this->makeApplication($config, ['control_number' => 'SK-2026-0001']);

        $response = $this->actingAs($admin, 'sanctum')
            ->get("/api/admin/reports/export?config_id={$config->id}");

        $response->assertOk();
        $response->assertHeader('Content-Type', 'text/csv; charset=UTF-8');
        $this->assertStringContainsString('SK-2026-0001', $response->streamedContent());
    }

    // ── claimingOutcomeSummary() ─────────────────────────────────

    public function test_claiming_outcome_summary_counts_match_seeded_assignments()
    {
        $admin = $this->makeAdmin();
        $config = $this->makeConfig();
        $this->makeClaimingAssignment($config, [], ['claim_status' => 'claimed']);
        $this->makeClaimingAssignment($config, [], ['claim_status' => 'claimed']);
        $this->makeClaimingAssignment($config, [], [
            'claim_status'      => 'not_cleared',
            'reason_categories' => ['Unable to present valid ID during claiming.'],
        ]);

        $response = $this->actingAs($admin, 'sanctum')
            ->getJson("/api/admin/reports/claiming-outcomes?config_id={$config->id}");

        $response->assertOk();
        $response->assertJson([
            'counts' => [
                'claimed'     => 2,
                'not_cleared' => 1,
                'unclaimed'   => 0,
                'pending'     => 0,
                'total'       => 3,
            ],
        ]);
        $response->assertJsonFragment(['Unable to present valid ID during claiming.' => 1]);
    }

    // ── documentFailureBreakdown() ────────────────────────────────

    public function test_document_failure_breakdown_counts_reupload_flags_by_document_type()
    {
        $admin = $this->makeAdmin();
        $config = $this->makeConfig();
        $app = $this->makeApplication($config);
        $verifier = User::factory()->create(['role' => 'sk_verifier']);

        VerifierAction::create([
            'application_id' => $app->id,
            'verifier_id'    => $verifier->id,
            'action'         => 'reupload_requested',
            'notes'          => 'Please fix.',
            'reupload_details' => [
                [
                    'document_type'      => 'school_id',
                    'reason_categories'  => ['Image blurry or unreadable.'],
                ],
            ],
        ]);

        $response = $this->actingAs($admin, 'sanctum')
            ->getJson("/api/admin/reports/document-failures?config_id={$config->id}");

        $response->assertOk();
        $response->assertJsonFragment(['school_id' => 1]);
    }

    // ── applicantDistribution() ──────────────────────────────────

    public function test_applicant_distribution_totals_reconcile_with_seeded_applications()
    {
        $admin = $this->makeAdmin();
        $config = $this->makeConfig();
        $this->makeApplication($config, ['school_name' => 'School A']);
        $this->makeApplication($config, ['school_name' => 'School A']);
        $this->makeApplication($config, ['school_name' => 'School B']);

        $response = $this->actingAs($admin, 'sanctum')
            ->getJson("/api/admin/reports/applicant-distribution?config_id={$config->id}");

        $response->assertOk();
        $response->assertJson(['total_applications' => 3]);
        $data = $response->json();
        // 'total' comes from a raw selectRaw COUNT(*) — cast defensively since
        // PDO may return it as a numeric string rather than an int.
        $schoolARow = collect($data['by_school'])->firstWhere('school_name', 'School A');
        $this->assertNotNull($schoolARow);
        $this->assertEquals(2, (int) $schoolARow['total']);
    }

    // ── ageDistribution() ─────────────────────────────────────────

    public function test_age_distribution_counts_minors_and_adults_from_seeded_profiles()
    {
        $admin = $this->makeAdmin();
        $config = $this->makeConfig();
        $minorApp = $this->makeApplication($config);
        $this->attachProfile($minorApp, now()->subYears(16)->toDateString());
        $adultApp = $this->makeApplication($config);
        $this->attachProfile($adultApp, now()->subYears(22)->toDateString());

        $response = $this->actingAs($admin, 'sanctum')
            ->getJson("/api/admin/reports/age-distribution?config_id={$config->id}");

        $response->assertOk();
        $response->assertJson([
            'counts' => [
                'minor'   => 1,
                'adult'   => 1,
                'unknown' => 0,
                'total'   => 2,
            ],
        ]);
    }

    // ── listPeriods() / filterOptions() ────────────────────────────

    public function test_list_periods_returns_all_application_periods()
    {
        $admin = $this->makeAdmin();
        $this->makeConfig(['school_year' => '2024-2025', 'is_active' => false]);
        $this->makeConfig(['school_year' => '2025-2026', 'is_active' => true]);

        $response = $this->actingAs($admin, 'sanctum')->getJson('/api/admin/reports/periods');

        $response->assertOk();
        $response->assertJsonCount(2);
    }

    public function test_filter_options_lists_distinct_schools_and_verifiers()
    {
        $admin = $this->makeAdmin();
        $config = $this->makeConfig();
        $this->makeApplication($config, ['school_name' => 'Pamantasan ng Cabuyao']);
        User::factory()->create(['role' => 'sk_verifier', 'first_name' => 'Jane', 'last_name' => 'Dela Cruz']);

        $response = $this->actingAs($admin, 'sanctum')->getJson('/api/admin/reports/filter-options');

        $response->assertOk();
        $response->assertJsonFragment(['schools' => ['Pamantasan ng Cabuyao']]);
        $data = $response->json();
        $this->assertContains('Jane Dela Cruz', $data['verifiers']);
    }

    // ── submissionTrends() ────────────────────────────────────────

    public function test_submission_trends_groups_applications_by_week()
    {
        $admin = $this->makeAdmin();
        $config = $this->makeConfig();
        $this->makeApplication($config, ['submitted_at' => now()]);
        $this->makeApplication($config, ['submitted_at' => now()]);

        $response = $this->actingAs($admin, 'sanctum')
            ->getJson("/api/admin/reports/submission-trends?config_id={$config->id}");

        $response->assertOk();
        $data = $response->json();
        $this->assertEquals(2, collect($data['weekly'])->sum('total'));
    }

    // ── submissionVsApprovalTrend() ─────────────────────────────────

    public function test_submission_vs_approval_trend_reports_per_period_rates()
    {
        $admin = $this->makeAdmin();
        $config = $this->makeConfig();
        $this->makeApplication($config, ['status' => 'approved']);
        $this->makeApplication($config, ['status' => 'rejected']);

        $response = $this->actingAs($admin, 'sanctum')->getJson('/api/admin/reports/submission-vs-approval');

        $response->assertOk();
        $data = $response->json();
        $row = collect($data['trend'])->firstWhere('config_id', $config->id);
        $this->assertEquals(2, $row['total_submitted']);
        $this->assertEquals(1, $row['approved']);
        $this->assertEquals(1, $row['rejected']);
    }

    // ── lateClaimingList() ────────────────────────────────

    public function test_late_claiming_list_returns_404_without_active_period()
    {
        $admin = $this->makeAdmin();
        ApplicationConfiguration::query()->update(['is_active' => false]);

        $response = $this->actingAs($admin, 'sanctum')->getJson('/api/admin/reports/late-claiming-list');

        $response->assertStatus(404);
    }

    public function test_late_claiming_list_returns_entries_for_active_period()
    {
        $admin = $this->makeAdmin();
        $config = $this->makeConfig();

        $response = $this->actingAs($admin, 'sanctum')->getJson("/api/admin/reports/late-claiming-list?config_id={$config->id}");

        $response->assertOk();
        $response->assertJsonStructure(['config', 'entries', 'retrying_count', 'promoted_count']);
    }

    // ── disbursementReport() ─────────────────────────────────────

    public function test_disbursement_report_totals_match_claimed_assignments()
    {
        $admin = $this->makeAdmin();
        $config = $this->makeConfig(['assistance_amount' => 2000]);
        $this->makeClaimingAssignment($config, [], ['claim_status' => 'claimed', 'amount' => 2000, 'verified_at' => now()]);
        $this->makeClaimingAssignment($config, [], ['claim_status' => 'claimed', 'amount' => 2000, 'verified_at' => now()]);
        $this->makeClaimingAssignment($config, [], ['claim_status' => 'pending_claiming']);

        $response = $this->actingAs($admin, 'sanctum')
            ->getJson("/api/admin/reports/disbursement?config_id={$config->id}");

        $response->assertOk();
        $response->assertJson([
            'total_disbursed' => 2,
            'total_amount'    => 4000,
        ]);
    }

    public function test_disbursement_report_returns_404_without_active_period()
    {
        $admin = $this->makeAdmin();
        ApplicationConfiguration::query()->update(['is_active' => false]);

        $response = $this->actingAs($admin, 'sanctum')->getJson('/api/admin/reports/disbursement');

        $response->assertStatus(404);
    }

    // ── budgetEstimation() ────────────────────────────────────────

    public function test_budget_estimation_reflects_historical_approved_counts_and_amount()
    {
        $admin = $this->makeAdmin();
        $completed = $this->makeConfig(['is_active' => false, 'assistance_amount' => 2000]);
        $this->makeApplication($completed, ['status' => 'approved']);
        $this->makeApplication($completed, ['status' => 'approved']);
        $this->makeApplication($completed, ['status' => 'rejected']);
        $active = $this->makeConfig(['is_active' => true, 'assistance_amount' => 2500]);

        $response = $this->actingAs($admin, 'sanctum')->getJson('/api/admin/reports/budget-estimation');

        $response->assertOk();
        $data = $response->json();
        $historicalRow = collect($data['historical'])->firstWhere('config_id', $completed->id);
        $this->assertEquals(2, $historicalRow['approved_count']);
        $this->assertEquals(4000, $historicalRow['estimated_disbursement']);
        $this->assertEquals(2500, $data['estimate']['assistance_per_applicant']);
    }

    // ── budgetForecast() ──────────────────────────────────────────

    public function test_budget_forecast_unavailable_without_completed_periods()
    {
        $admin = $this->makeAdmin();
        // Only an active period exists — no completed (is_active = false) periods.
        $this->makeConfig(['is_active' => true]);

        $response = $this->actingAs($admin, 'sanctum')->getJson('/api/admin/reports/budget-forecast');

        $response->assertOk();
        $response->assertJson(['available' => false]);
    }

    public function test_budget_forecast_computes_confidence_interval_from_completed_periods()
    {
        $admin = $this->makeAdmin();
        $completed = $this->makeConfig(['is_active' => false]);
        $this->makeApplication($completed, ['status' => 'approved']);
        $this->makeApplication($completed, ['status' => 'rejected']);

        $response = $this->actingAs($admin, 'sanctum')->getJson('/api/admin/reports/budget-forecast');

        $response->assertOk();
        $response->assertJson(['available' => true, 'pooled_total_submitted' => 2, 'pooled_approved' => 1]);
    }

    // ── unmetDemand() ─────────────────────────────────────────────

    public function test_unmet_demand_reports_waitlist_ratio_per_period()
    {
        $admin = $this->makeAdmin();
        $config = $this->makeConfig();
        $this->makeApplication($config, ['status' => 'approved']);
        $this->makeApplication($config, ['status' => 'waitlisted']);

        $response = $this->actingAs($admin, 'sanctum')->getJson('/api/admin/reports/unmet-demand');

        $response->assertOk();
        $data = $response->json();
        $row = collect($data['trend'])->firstWhere('config_id', $config->id);
        $this->assertEquals(1, $row['approved']);
        $this->assertEquals(1, $row['waitlisted']);
        $this->assertEquals(100.0, $row['ratio']);
    }

    // ── lastCycleActuals() ────────────────────────────────────────

    public function test_last_cycle_actuals_unavailable_without_a_completed_period()
    {
        $admin = $this->makeAdmin();
        $this->makeConfig(['is_active' => true]);

        $response = $this->actingAs($admin, 'sanctum')->getJson('/api/admin/reports/last-cycle-actuals');

        $response->assertOk();
        $response->assertJson(['available' => false]);
    }

    public function test_last_cycle_actuals_uses_most_recent_completed_period()
    {
        $admin = $this->makeAdmin();
        $this->makeConfig(['is_active' => false, 'open_date' => now()->subYears(2), 'assistance_amount' => 1500, 'slot_limit' => 50, 'is_unlimited' => false]);
        $mostRecent = $this->makeConfig(['is_active' => false, 'open_date' => now()->subYear(), 'assistance_amount' => 2000, 'slot_limit' => 80, 'is_unlimited' => false]);

        $response = $this->actingAs($admin, 'sanctum')->getJson('/api/admin/reports/last-cycle-actuals');

        $response->assertOk();
        $response->assertJson([
            'available'          => true,
            'school_year'        => $mostRecent->school_year,
            'amount_per_student' => 2000,
            'total_budget_used'  => 160000,
        ]);
    }

    // ── ocrQueueHealth() ──────────────────────────────────────────

    public function test_ocr_queue_health_reports_failed_job_count()
    {
        $admin = $this->makeAdmin();
        \DB::table('failed_jobs')->insert([
            'uuid'       => (string) \Illuminate\Support\Str::uuid(),
            'connection' => 'database',
            'queue'      => 'ocr',
            'payload'    => '{}',
            'exception'  => "Some OCR failure\nstack trace line",
            'failed_at'  => now(),
        ]);

        $response = $this->actingAs($admin, 'sanctum')->getJson('/api/admin/reports/ocr-queue-health');

        $response->assertOk();
        $response->assertJson(['failed_count' => 1]);
        $data = $response->json();
        $this->assertCount(1, $data['recent_failures']);
        $this->assertEquals('Some OCR failure', $data['recent_failures'][0]['exception_summary']);
    }

    // ── PDF / HTML export smoke tests ──────────────────────────────

    public function test_approved_applicants_pdf_downloads_successfully_for_active_period()
    {
        $admin = $this->makeAdmin();
        $config = $this->makeConfig();
        $this->makeApplication($config, ['status' => 'approved', 'control_number' => 'SK-2026-0001']);

        $response = $this->actingAs($admin, 'sanctum')->get("/api/admin/reports/approved-applicants/pdf?config_id={$config->id}");

        $response->assertOk();
        $response->assertHeader('Content-Type', 'application/pdf');
    }

    public function test_approved_applicants_html_returns_rendered_page_for_active_period()
    {
        $admin = $this->makeAdmin();
        $config = $this->makeConfig();
        $this->makeApplication($config, ['status' => 'approved', 'control_number' => 'SK-2026-0001']);

        $response = $this->actingAs($admin, 'sanctum')->get("/api/admin/reports/approved-applicants/html?config_id={$config->id}");

        $response->assertOk();
        $this->assertStringContainsString('SK-2026-0001', $response->getContent());
    }

    public function test_late_claiming_list_pdf_downloads_successfully()
    {
        $admin = $this->makeAdmin();
        $config = $this->makeConfig();

        $response = $this->actingAs($admin, 'sanctum')->get("/api/admin/reports/late-claiming-list/pdf?config_id={$config->id}");

        $response->assertOk();
        $response->assertHeader('Content-Type', 'application/pdf');
    }

    public function test_disbursement_report_pdf_downloads_successfully()
    {
        $admin = $this->makeAdmin();
        $config = $this->makeConfig();
        $this->makeClaimingAssignment($config, [], ['claim_status' => 'claimed', 'amount' => 2000, 'verified_at' => now()]);

        $response = $this->actingAs($admin, 'sanctum')->get("/api/admin/reports/disbursement/pdf?config_id={$config->id}");

        $response->assertOk();
        $response->assertHeader('Content-Type', 'application/pdf');
    }

    public function test_claiming_outcomes_pdf_downloads_successfully()
    {
        $admin = $this->makeAdmin();
        $config = $this->makeConfig();

        $response = $this->actingAs($admin, 'sanctum')->get("/api/admin/reports/claiming-outcomes/pdf?config_id={$config->id}");

        $response->assertOk();
        $response->assertHeader('Content-Type', 'application/pdf');
    }

    public function test_document_failures_pdf_downloads_successfully()
    {
        $admin = $this->makeAdmin();
        $config = $this->makeConfig();

        $response = $this->actingAs($admin, 'sanctum')->get("/api/admin/reports/document-failures/pdf?config_id={$config->id}");

        $response->assertOk();
        $response->assertHeader('Content-Type', 'application/pdf');
    }

    public function test_applicant_distribution_pdf_downloads_successfully()
    {
        $admin = $this->makeAdmin();
        $config = $this->makeConfig();
        $this->makeApplication($config);

        $response = $this->actingAs($admin, 'sanctum')->get("/api/admin/reports/applicant-distribution/pdf?config_id={$config->id}");

        $response->assertOk();
        $response->assertHeader('Content-Type', 'application/pdf');
    }

    public function test_school_program_pdf_downloads_successfully()
    {
        $admin = $this->makeAdmin();
        $config = $this->makeConfig();
        $this->makeApplication($config);

        $response = $this->actingAs($admin, 'sanctum')->get("/api/admin/reports/school-program/pdf?config_id={$config->id}");

        $response->assertOk();
        $response->assertHeader('Content-Type', 'application/pdf');
    }

    public function test_year_level_age_pdf_downloads_successfully()
    {
        $admin = $this->makeAdmin();
        $config = $this->makeConfig();
        $app = $this->makeApplication($config);
        $this->attachProfile($app, now()->subYears(20)->toDateString());

        $response = $this->actingAs($admin, 'sanctum')->get("/api/admin/reports/year-level-age/pdf?config_id={$config->id}");

        $response->assertOk();
        $response->assertHeader('Content-Type', 'application/pdf');
    }

    public function test_submission_trends_pdf_downloads_successfully()
    {
        $admin = $this->makeAdmin();
        $config = $this->makeConfig();
        $this->makeApplication($config);

        $response = $this->actingAs($admin, 'sanctum')->get("/api/admin/reports/submission-trends/pdf?config_id={$config->id}");

        $response->assertOk();
        $response->assertHeader('Content-Type', 'application/pdf');
    }

    public function test_age_distribution_pdf_downloads_successfully()
    {
        $admin = $this->makeAdmin();
        $config = $this->makeConfig();
        $app = $this->makeApplication($config);
        $this->attachProfile($app, now()->subYears(16)->toDateString());

        $response = $this->actingAs($admin, 'sanctum')->get("/api/admin/reports/age-distribution/pdf?config_id={$config->id}");

        $response->assertOk();
        $response->assertHeader('Content-Type', 'application/pdf');
    }

    public function test_submission_vs_approval_pdf_downloads_successfully()
    {
        $admin = $this->makeAdmin();
        $this->makeConfig();

        $response = $this->actingAs($admin, 'sanctum')->get('/api/admin/reports/submission-vs-approval/pdf');

        $response->assertOk();
        $response->assertHeader('Content-Type', 'application/pdf');
    }
}
