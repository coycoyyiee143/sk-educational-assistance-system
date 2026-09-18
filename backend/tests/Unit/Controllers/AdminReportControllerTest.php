<?php

namespace Tests\Unit\Controllers;

use App\Http\Controllers\Api\AdminReportController;
use App\Models\Application;
use App\Models\ApplicationConfiguration;
use App\Models\ClaimingAssignment;
use App\Models\ClaimingLane;
use App\Models\ClaimingSchedule;
use App\Models\StudentProfile;
use App\Models\User;
use App\Models\VerifierAction;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Request;
use ReflectionMethod;
use Tests\TestCase;

/**
 * Unit-level coverage for the pure calculation/decision logic inside
 * AdminReportController — budget projections, ratios, bracket counting,
 * and the "who's responsible for this outcome" resolution — exercised by
 * instantiating the controller directly and calling its methods (or, for
 * protected/private helpers, invoking them via Reflection). No route is
 * resolved, no middleware (auth/Sanctum) runs, and no HTTP request/
 * validation pipeline is involved anywhere in these tests.
 *
 * This complements (does not duplicate) tests/Feature/AdminReportControllerTest.php,
 * which already covers the full HTTP request -> controller -> DB ->
 * response cycle for these same endpoints, including auth/authorization
 * and JSON response shape. Here we isolate just the arithmetic/decision
 * logic underneath each calculation.
 */
class AdminReportControllerTest extends TestCase
{
    use RefreshDatabase;

    protected function controller(): AdminReportController
    {
        return new AdminReportController();
    }

    protected function makeConfig(array $overrides = []): ApplicationConfiguration
    {
        return ApplicationConfiguration::factory()->create($overrides);
    }

    protected function makeApplication(ApplicationConfiguration $config, array $overrides = []): Application
    {
        return Application::factory()->create(array_merge(['config_id' => $config->id], $overrides));
    }

    // ── budgetEstimation() ──────────────────────────────────────────

    public function test_budget_estimation_computes_estimated_disbursement_as_approved_count_times_assistance_amount()
    {
        $completed = $this->makeConfig(['is_active' => false, 'assistance_amount' => 2000]);
        $this->makeApplication($completed, ['status' => 'approved']);
        $this->makeApplication($completed, ['status' => 'approved']);
        $this->makeApplication($completed, ['status' => 'rejected']);
        $this->makeConfig(['is_active' => true, 'assistance_amount' => 2500, 'is_unlimited' => false, 'slot_limit' => 100]);

        $data = $this->controller()->budgetEstimation()->getData(true);

        $historicalRow = collect($data['historical'])->firstWhere('config_id', $completed->id);
        $this->assertEquals(2, $historicalRow['approved_count']);
        $this->assertEquals(4000, $historicalRow['estimated_disbursement']);
        $this->assertEqualsWithDelta(2 / 3, $historicalRow['pass_rate'], 0.0001);
    }

    public function test_budget_estimation_projects_budget_using_active_configs_own_amount_not_historical()
    {
        $completed = $this->makeConfig(['is_active' => false, 'assistance_amount' => 1000]);
        $this->makeApplication($completed, ['status' => 'approved']);
        $this->makeApplication($completed, ['status' => 'approved']);
        $active = $this->makeConfig(['is_active' => true, 'assistance_amount' => 2500, 'is_unlimited' => false, 'slot_limit' => 100]);

        $data = $this->controller()->budgetEstimation()->getData(true);

        // average_approved_count = 2 (only one completed period), so
        // projected_approved = min(slot_limit, round(2)) = 2, and the
        // projected budget must use the ACTIVE config's amount (2500),
        // not the completed period's amount (1000).
        $this->assertEquals(2, $data['estimate']['projected_approved']);
        $this->assertEquals(2500, $data['estimate']['assistance_per_applicant']);
        $this->assertEquals(5000, $data['estimate']['projected_budget']);
    }

    public function test_budget_estimation_caps_projected_approved_at_the_active_periods_slot_limit()
    {
        $completed = $this->makeConfig(['is_active' => false, 'assistance_amount' => 2000]);
        for ($i = 0; $i < 5; $i++) {
            $this->makeApplication($completed, ['status' => 'approved']);
        }
        $this->makeConfig(['is_active' => true, 'assistance_amount' => 2000, 'is_unlimited' => false, 'slot_limit' => 2]);

        $data = $this->controller()->budgetEstimation()->getData(true);

        // average_approved_count is 5, but the active period only has
        // room for 2 — the projection must not exceed that capacity.
        $this->assertEquals(2, $data['estimate']['projected_approved']);
    }

    public function test_budget_estimation_leaves_projected_slots_unbounded_when_active_period_is_unlimited()
    {
        $completed = $this->makeConfig(['is_active' => false, 'assistance_amount' => 2000]);
        $this->makeApplication($completed, ['status' => 'approved']);
        $this->makeConfig(['is_active' => true, 'assistance_amount' => 2000, 'is_unlimited' => true, 'slot_limit' => null]);

        $data = $this->controller()->budgetEstimation()->getData(true);

        $this->assertNull($data['estimate']['projected_slots']);
        $this->assertTrue($data['estimate']['is_unlimited']);
    }

    public function test_budget_estimation_falls_back_to_the_active_periods_own_figures_when_no_period_has_completed_yet()
    {
        // Only an active (still-open) period exists — no is_active=false
        // period to average over — so the estimate must fall back to the
        // active period's own in-progress numbers instead of dividing by
        // zero completed periods.
        $active = $this->makeConfig(['is_active' => true, 'assistance_amount' => 2000, 'is_unlimited' => false, 'slot_limit' => 100]);
        $this->makeApplication($active, ['status' => 'approved']);
        $this->makeApplication($active, ['status' => 'pending_prescreening']);

        $data = $this->controller()->budgetEstimation()->getData(true);

        $this->assertEquals(1, $data['estimate']['average_approved_count']);
        $this->assertEqualsWithDelta(0.5, $data['estimate']['average_pass_rate'], 0.0001);
    }

    // ── budgetForecast() ────────────────────────────────────────────

    public function test_budget_forecast_is_unavailable_when_no_completed_period_has_any_submissions()
    {
        $this->makeConfig(['is_active' => true]);

        $data = $this->controller()->budgetForecast()->getData(true);

        $this->assertFalse($data['available']);
    }

    public function test_budget_forecast_pools_submissions_and_approvals_across_all_completed_periods()
    {
        $completedA = $this->makeConfig(['is_active' => false]);
        $this->makeApplication($completedA, ['status' => 'approved']);
        $this->makeApplication($completedA, ['status' => 'rejected']);
        $completedB = $this->makeConfig(['is_active' => false]);
        $this->makeApplication($completedB, ['status' => 'approved']);
        $this->makeConfig(['is_active' => true, 'assistance_amount' => 2000]);

        $data = $this->controller()->budgetForecast()->getData(true);

        $this->assertTrue($data['available']);
        $this->assertEquals(3, $data['pooled_total_submitted']);
        $this->assertEquals(2, $data['pooled_approved']);
        $this->assertEquals(2, $data['periods_used']);
        $this->assertEqualsWithDelta(2 / 3, $data['point_estimate_rate'], 0.0001);
    }

    public function test_budget_forecast_confidence_interval_brackets_the_point_estimate_and_stays_within_zero_and_one()
    {
        $completed = $this->makeConfig(['is_active' => false]);
        for ($i = 0; $i < 8; $i++) {
            $this->makeApplication($completed, ['status' => 'approved']);
        }
        for ($i = 0; $i < 2; $i++) {
            $this->makeApplication($completed, ['status' => 'rejected']);
        }
        $this->makeConfig(['is_active' => true]);

        $data = $this->controller()->budgetForecast()->getData(true);

        $lower = $data['confidence_interval']['lower'];
        $upper = $data['confidence_interval']['upper'];
        $this->assertEquals(0.95, $data['confidence_interval']['level']);
        $this->assertGreaterThanOrEqual(0, $lower);
        $this->assertLessThanOrEqual(1, $upper);
        $this->assertLessThanOrEqual($data['point_estimate_rate'], $lower);
        $this->assertGreaterThanOrEqual($data['point_estimate_rate'], $upper);
    }

    public function test_budget_forecast_projected_budget_range_uses_the_active_configs_current_assistance_amount()
    {
        $completed = $this->makeConfig(['is_active' => false, 'assistance_amount' => 999]);
        $this->makeApplication($completed, ['status' => 'approved']);
        $this->makeConfig(['is_active' => true, 'assistance_amount' => 3000]);

        $data = $this->controller()->budgetForecast()->getData(true);

        $this->assertEquals(3000, $data['assistance_per_applicant']);
        $this->assertEquals(
            $data['projected_approved_range']['lower'] * 3000,
            $data['projected_budget_range']['lower']
        );
        $this->assertEquals(
            $data['projected_approved_range']['upper'] * 3000,
            $data['projected_budget_range']['upper']
        );
    }

    // ── unmetDemand() ───────────────────────────────────────────────

    public function test_unmet_demand_computes_waitlist_to_approved_ratio_as_a_percentage()
    {
        $config = $this->makeConfig();
        $this->makeApplication($config, ['status' => 'approved']);
        $this->makeApplication($config, ['status' => 'waitlisted']);

        $data = $this->controller()->unmetDemand(new Request())->getData(true);

        $row = collect($data['trend'])->firstWhere('config_id', $config->id);
        $this->assertEquals(1, $row['approved']);
        $this->assertEquals(1, $row['waitlisted']);
        $this->assertEquals(100.0, $row['ratio']);
    }

    public function test_unmet_demand_ratio_is_null_rather_than_a_division_by_zero_when_nobody_is_approved_yet()
    {
        $config = $this->makeConfig();
        $this->makeApplication($config, ['status' => 'pending_prescreening']);

        $data = $this->controller()->unmetDemand(new Request())->getData(true);

        $row = collect($data['trend'])->firstWhere('config_id', $config->id);
        $this->assertEquals(0, $row['approved']);
        $this->assertNull($row['ratio']);
    }

    // ── submissionVsApprovalTrend() ─────────────────────────────────

    public function test_submission_vs_approval_trend_computes_approval_rejection_and_pending_rates_per_period()
    {
        $config = $this->makeConfig();
        $this->makeApplication($config, ['status' => 'approved']);
        $this->makeApplication($config, ['status' => 'claimed']);
        $this->makeApplication($config, ['status' => 'rejected']);
        $this->makeApplication($config, ['status' => 'for_review']);

        $data = $this->controller()->submissionVsApprovalTrend(new Request())->getData(true);

        $row = collect($data['trend'])->firstWhere('config_id', $config->id);
        $this->assertEquals(4, $row['total_submitted']);
        $this->assertEquals(2, $row['approved']);
        $this->assertEquals(1, $row['rejected']);
        $this->assertEquals(1, $row['pending']);
        $this->assertEquals(50.0, $row['approval_rate']);
        $this->assertEquals(25.0, $row['rejection_rate']);
        $this->assertEquals(25.0, $row['pending_rate']);
    }

    public function test_submission_vs_approval_trend_rates_are_zero_for_a_period_with_no_submissions()
    {
        $this->makeConfig();

        $data = $this->controller()->submissionVsApprovalTrend(new Request())->getData(true);

        $row = $data['trend'][0];
        $this->assertEquals(0, $row['total_submitted']);
        $this->assertEquals(0, $row['approval_rate']);
        $this->assertEquals(0, $row['rejection_rate']);
        $this->assertEquals(0, $row['pending_rate']);
    }

    // ── ageDistribution() ───────────────────────────────────────────

    public function test_age_distribution_buckets_applicants_into_minor_adult_and_unknown_with_correct_rates()
    {
        $config = $this->makeConfig(['is_active' => true]);
        $minor = $this->makeApplication($config);
        StudentProfile::create(['user_id' => $minor->user_id, 'birthdate' => now()->subYears(16)->toDateString()]);
        $adult = $this->makeApplication($config);
        StudentProfile::create(['user_id' => $adult->user_id, 'birthdate' => now()->subYears(22)->toDateString()]);
        // No StudentProfile at all for this one — falls into "unknown".
        $this->makeApplication($config);

        $data = $this->controller()->ageDistribution(new Request())->getData(true);

        $this->assertEquals(['minor' => 1, 'adult' => 1, 'unknown' => 1, 'total' => 3], $data['counts']);
        $this->assertEqualsWithDelta(33.3, $data['rates']['minor_rate'], 0.05);
        $this->assertEqualsWithDelta(33.3, $data['rates']['adult_rate'], 0.05);
        $this->assertEqualsWithDelta(33.3, $data['rates']['unknown_rate'], 0.05);
    }

    // ── lastCycleActuals() ──────────────────────────────────────────

    public function test_last_cycle_actuals_is_unavailable_when_no_period_has_ever_completed()
    {
        $this->makeConfig(['is_active' => true]);

        $data = $this->controller()->lastCycleActuals()->getData(true);

        $this->assertFalse($data['available']);
    }

    public function test_last_cycle_actuals_picks_the_most_recently_opened_completed_period()
    {
        $this->makeConfig(['is_active' => false, 'open_date' => now()->subYears(2), 'assistance_amount' => 1500, 'slot_limit' => 50, 'is_unlimited' => false]);
        $mostRecent = $this->makeConfig(['is_active' => false, 'open_date' => now()->subYear(), 'assistance_amount' => 2000, 'slot_limit' => 80, 'is_unlimited' => false]);

        $data = $this->controller()->lastCycleActuals()->getData(true);

        $this->assertTrue($data['available']);
        $this->assertEquals($mostRecent->school_year, $data['school_year']);
        $this->assertEquals(2000, $data['amount_per_student']);
        $this->assertEquals(160000, $data['total_budget_used']);
    }

    public function test_last_cycle_actuals_total_budget_used_is_null_for_an_unlimited_period()
    {
        $this->makeConfig(['is_active' => false, 'is_unlimited' => true, 'slot_limit' => null, 'assistance_amount' => 2000]);

        $data = $this->controller()->lastCycleActuals()->getData(true);

        $this->assertTrue($data['available']);
        $this->assertNull($data['total_budget_used']);
    }

    // ── disbursementReport() ────────────────────────────────────────

    protected function makeClaimingAssignment(ApplicationConfiguration $config, array $assignmentOverrides = []): ClaimingAssignment
    {
        $app = $this->makeApplication($config, ['status' => 'approved']);
        $schedule = ClaimingSchedule::forceCreate([
            'config_id'    => $config->id,
            'location'     => 'Barangay Hall',
            'is_active'    => true,
            'activated_at' => now(),
        ]);
        $lane = ClaimingLane::forceCreate([
            'claiming_schedule_id' => $schedule->id,
            'lane_name'            => 'Lane A',
            'capacity'             => 50,
            'batch'                => 'morning',
            'claiming_date'        => now()->addDay()->toDateString(),
        ]);

        return ClaimingAssignment::create(array_merge([
            'application_id'       => $app->id,
            'claiming_schedule_id' => $schedule->id,
            'claiming_lane_id'     => $lane->id,
            'claim_status'         => 'claimed',
            'verified_at'          => now(),
        ], $assignmentOverrides));
    }

    public function test_disbursement_report_total_amount_sums_the_snapshotted_amount_per_claim()
    {
        $config = $this->makeConfig(['is_active' => true, 'assistance_amount' => 2000]);
        $this->makeClaimingAssignment($config, ['amount' => 2000]);
        $this->makeClaimingAssignment($config, ['amount' => 2000]);
        $this->makeClaimingAssignment($config, ['claim_status' => 'pending_claiming', 'amount' => null]);

        $data = $this->controller()->disbursementReport(new Request())->getData(true);

        $this->assertEquals(2, $data['total_disbursed']);
        $this->assertEquals(4000, $data['total_amount']);
    }

    public function test_disbursement_report_falls_back_to_the_configs_amount_when_no_snapshot_was_taken()
    {
        $config = $this->makeConfig(['is_active' => true, 'assistance_amount' => 2500]);
        // No 'amount' snapshot recorded on this claim (predates the
        // snapshot column) — must fall back to the config's amount.
        $this->makeClaimingAssignment($config, ['amount' => null]);

        $data = $this->controller()->disbursementReport(new Request())->getData(true);

        $this->assertEquals(2500, $data['total_amount']);
        $this->assertEquals(2500, $data['entries'][0]['amount']);
    }

    // ── documentFailureBreakdown() ──────────────────────────────────

    public function test_document_failure_breakdown_computes_flag_percentages_per_document_type()
    {
        $config = $this->makeConfig(['is_active' => true]);
        $verifier = User::factory()->create(['role' => 'sk_verifier']);
        $appA = $this->makeApplication($config);
        $appB = $this->makeApplication($config);
        $appC = $this->makeApplication($config);

        foreach ([$appA, $appB] as $app) {
            VerifierAction::create([
                'application_id'    => $app->id,
                'verifier_id'       => $verifier->id,
                'action'            => 'reupload_requested',
                'reupload_details'  => [
                    ['document_type' => 'school_id', 'reason_categories' => ['Image blurry or unreadable.']],
                ],
            ]);
        }
        VerifierAction::create([
            'application_id'   => $appC->id,
            'verifier_id'      => $verifier->id,
            'action'           => 'reupload_requested',
            'reupload_details' => [
                ['document_type' => 'cor', 'reason_categories' => ['Wrong document uploaded.']],
            ],
        ]);

        $data = $this->controller()->documentFailureBreakdown(new Request())->getData(true);

        $this->assertEquals(2, $data['reupload_flag_counts_by_document']['school_id']);
        $this->assertEquals(1, $data['reupload_flag_counts_by_document']['cor']);
        $this->assertEqualsWithDelta(66.7, $data['reupload_flag_percentages_by_document']['school_id'], 0.05);
        $this->assertEqualsWithDelta(33.3, $data['reupload_flag_percentages_by_document']['cor'], 0.05);
        $this->assertEquals(2, $data['reupload_reasons_by_document']['school_id']['Image blurry or unreadable.']);
    }

    public function test_document_failure_breakdown_labels_a_missing_document_type_as_unknown()
    {
        $config = $this->makeConfig(['is_active' => true]);
        $verifier = User::factory()->create(['role' => 'sk_verifier']);
        $app = $this->makeApplication($config);

        VerifierAction::create([
            'application_id'   => $app->id,
            'verifier_id'      => $verifier->id,
            'action'           => 'reupload_requested',
            'reupload_details' => [
                ['reason_categories' => ['Image blurry or unreadable.']], // no document_type key
            ],
        ]);

        $data = $this->controller()->documentFailureBreakdown(new Request())->getData(true);

        $this->assertEquals(1, $data['reupload_flag_counts_by_document']['unknown']);
    }

    // ── resolveReviewedBy() — private decision logic, via Reflection ─

    protected function callResolveReviewedBy(Application $application): ?string
    {
        $method = new ReflectionMethod(AdminReportController::class, 'resolveReviewedBy');
        $method->setAccessible(true);

        return $method->invoke($this->controller(), $application);
    }

    public function test_resolve_reviewed_by_credits_the_human_verifier_who_approved_even_if_status_moved_on()
    {
        $verifier = User::factory()->create(['first_name' => 'Jane', 'last_name' => 'Dela Cruz']);
        $application = Application::factory()->make(['status' => 'claimed']);
        $approvalAction = new VerifierAction(['action' => 'approved']);
        $approvalAction->setRelation('verifier', $verifier);
        $application->setRelation('verifierActions', collect([$approvalAction]));

        $result = $this->callResolveReviewedBy($application);

        $this->assertEquals('Jane Dela Cruz', $result);
    }

    public function test_resolve_reviewed_by_labels_system_auto_approved_when_no_human_action_exists_but_status_is_in_the_approved_lineage()
    {
        $application = Application::factory()->make(['status' => 'unclaimed']);
        $application->setRelation('verifierActions', collect());
        $application->setRelation('latestVerifierAction', null);

        $result = $this->callResolveReviewedBy($application);

        $this->assertEquals('System (Auto-Approved)', $result);
    }

    public function test_resolve_reviewed_by_returns_null_when_nothing_ever_reviewed_it()
    {
        $application = Application::factory()->make(['status' => 'pending_prescreening']);
        $application->setRelation('verifierActions', collect());
        $application->setRelation('latestVerifierAction', null);

        $result = $this->callResolveReviewedBy($application);

        $this->assertNull($result);
    }

    public function test_resolve_reviewed_by_falls_back_to_the_latest_verifier_action_for_a_rejected_application()
    {
        $verifier = User::factory()->create(['first_name' => 'Mark', 'last_name' => 'Santos']);
        $application = Application::factory()->make(['status' => 'rejected']);
        $application->setRelation('verifierActions', collect());
        $rejectAction = new VerifierAction(['action' => 'rejected']);
        $rejectAction->setRelation('verifier', $verifier);
        $application->setRelation('latestVerifierAction', $rejectAction);

        $result = $this->callResolveReviewedBy($application);

        $this->assertEquals('Mark Santos', $result);
    }
}
