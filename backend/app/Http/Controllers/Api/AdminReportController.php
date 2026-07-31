<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Application;
use App\Models\ApplicationConfiguration;
use App\Models\ClaimingAssignment;
use App\Models\VerificationCheck;
use App\Models\VerifierAction;
use Illuminate\Http\Request;
use Barryvdh\DomPDF\Facade\Pdf;

class AdminReportController extends Controller
{
    const ASSISTANCE_AMOUNT = 2000;

    private function approvedStatuses(): array
    {
        // physically_verified removed — confirmed dead status, never set
        // anywhere in the codebase.
        return ['approved', 'claimed', 'not_cleared', 'unclaimed'];
    }

    private function pendingStatuses(): array
    {
        return ['pending_prescreening', 'for_review', 'reupload_requested'];
    }

    /**
     * Resolves which ApplicationConfiguration a report should run
     * against — either the one explicitly requested via ?config_id=,
     * or the active period as a default. Lets SK look back at any past
     * period's reports, not just the currently open one.
     */
    private function resolveConfig(Request $request): ?ApplicationConfiguration
    {
        if ($request->filled('config_id')) {
            return ApplicationConfiguration::find($request->query('config_id'));
        }
        return ApplicationConfiguration::where('is_active', true)->first();
    }

    public function listPeriods()
    {
        return response()->json(
            ApplicationConfiguration::orderByDesc('open_date')
                ->get(['id', 'school_year', 'is_active'])
        );
    }

    public function summary(Request $request)
    {
        $config = $this->resolveConfig($request);

        $query = Application::query();
        if ($config) {
            $query->where('config_id', $config->id);
        }

        $total    = $query->clone()->count();
        $pending  = $query->clone()->whereIn('status', $this->pendingStatuses())->count();
        $approved = $query->clone()->whereIn('status', $this->approvedStatuses())->count();
        $rejected = $query->clone()->where('status', 'rejected')->count();

        return response()->json([
            'config' => $config,
            'summary' => [
                'total_applicants'      => $total,
                'pending_applications'  => $pending,
                'approved_applications' => $approved,
                'rejected_applications' => $rejected,
            ],
            'rates' => [
                'approval_rate'     => $total > 0 ? round(($approved / $total) * 100, 1) : 0,
                'rejection_rate'    => $total > 0 ? round(($rejected / $total) * 100, 1) : 0,
                'under_review_rate' => $total > 0 ? round(($pending / $total) * 100, 1) : 0,
            ],
        ]);
    }

    public function applications(Request $request)
    {
        $query = Application::with('user')->latest('submitted_at');
        $this->applyFilters($query, $request);

        $applications = $query->get()->map(function ($app) {
            return [
                'id'             => $app->id,
                'control_number' => $app->control_number,
                'name'           => trim($app->user->first_name . ' ' . $app->user->last_name),
                'submitted_at'   => $app->submitted_at,
                'status'         => $app->status,
                'school_name'    => $app->school_name,
                'course'         => $app->course,
            ];
        });

        return response()->json($applications);
    }

    public function export(Request $request)
    {
        $query = Application::with('user')->latest('submitted_at');
        $this->applyFilters($query, $request);
        $applications = $query->get();

        $filename = 'applicant-records-' . now()->format('Y-m-d') . '.csv';

        $headers = [
            'Content-Type'        => 'text/csv',
            'Content-Disposition' => "attachment; filename=\"{$filename}\"",
        ];

        $callback = function () use ($applications) {
            $handle = fopen('php://output', 'w');

            fputcsv($handle, [
                'Application ID', 'Control Number', 'Applicant Name', 'Email',
                'School', 'Course', 'Year Level', 'Status', 'Submitted At',
            ]);

            foreach ($applications as $app) {
                fputcsv($handle, [
                    'APP-' . $app->id,
                    $app->control_number,
                    trim($app->user->first_name . ' ' . $app->user->last_name),
                    $app->user->email,
                    $app->school_name,
                    $app->course,
                    $app->year_level,
                    $app->status,
                    $app->submitted_at,
                ]);
            }

            fclose($handle);
        };

        return response()->stream($callback, 200, $headers);
    }

    private function applyFilters($query, Request $request)
    {
        $type = $request->query('type');

        $map = [
            'Approved Students'     => $this->approvedStatuses(),
            'Rejected Applications' => ['rejected'],
            'Pending Applications'  => $this->pendingStatuses(),
        ];

        if ($type && isset($map[$type])) {
            $query->whereIn('status', $map[$type]);
        }

        if ($request->filled('from')) {
            $query->whereDate('submitted_at', '>=', $request->query('from'));
        }

        if ($request->filled('to')) {
            $query->whereDate('submitted_at', '<=', $request->query('to'));
        }
    }

    public function budgetForecast()
    {
        $configs = ApplicationConfiguration::orderBy('open_date')->get();
        $historical = $configs->map(function ($config) {
            $total    = Application::where('config_id', $config->id)->count();
            $approved = Application::where('config_id', $config->id)
                ->whereIn('status', $this->approvedStatuses())
                ->count();
            return [
                'config_id'              => $config->id,
                'school_year'            => $config->school_year,
                'is_active'              => $config->is_active,
                'total_applications'     => $total,
                'approved_count'         => $approved,
                'pass_rate'              => $total > 0 ? round($approved / $total, 4) : 0,
                'is_unlimited'           => $config->is_unlimited,
                'slot_limit'             => $config->slot_limit,
                'estimated_disbursement' => $approved * self::ASSISTANCE_AMOUNT,
            ];
        });

        $completed = $historical->where('is_active', false)->where('total_applications', '>', 0);
        if ($completed->count() > 0) {
            $avgApproved = $completed->avg('approved_count');
            $avgPassRate = $completed->avg('pass_rate');
        } else {
            $current     = $historical->firstWhere('is_active', true);
            $avgApproved = $current['approved_count'] ?? 0;
            $avgPassRate = $current['pass_rate'] ?? 0;
        }

        $activeConfig = $configs->firstWhere('is_active', true);

        $projectedSlots = $activeConfig && !$activeConfig->is_unlimited
            ? $activeConfig->slot_limit
            : null;

        $projectedApproved = $projectedSlots
            ? min($projectedSlots, round($avgApproved))
            : round($avgApproved);

        return response()->json([
            'historical' => $historical->values(),
            'forecast' => [
                'average_pass_rate'        => round($avgPassRate, 4),
                'average_approved_count'   => round($avgApproved),
                'is_unlimited'             => $activeConfig->is_unlimited ?? false,
                'projected_slots'          => $projectedSlots,
                'projected_approved'       => $projectedApproved,
                'projected_budget'         => round($projectedApproved) * self::ASSISTANCE_AMOUNT,
                'assistance_per_applicant' => self::ASSISTANCE_AMOUNT,
            ],
        ]);
    }

    // ── NEW REPORTS (JSON) ───────────────────────────────────────────

    public function claimingOutcomeSummary(Request $request)
    {
        $config = $this->resolveConfig($request);

        $query = ClaimingAssignment::query();
        if ($config) {
            $query->whereHas('application', fn($q) => $q->where('config_id', $config->id));
        }

        $claimed    = $query->clone()->where('claim_status', 'claimed')->count();
        $notCleared = $query->clone()->where('claim_status', 'not_cleared')->count();
        $unclaimed  = $query->clone()->where('claim_status', 'unclaimed')->count();
        $pending    = $query->clone()->where('claim_status', 'pending')->count();

        $total = $claimed + $notCleared + $unclaimed + $pending;

        $notClearedReasons = $query->clone()
            ->where('claim_status', 'not_cleared')
            ->whereNotNull('reason_categories')
            ->pluck('reason_categories')
            ->flatten()
            ->countBy()
            ->sortDesc();

        return response()->json([
            'config' => $config,
            'counts' => [
                'claimed'     => $claimed,
                'not_cleared' => $notCleared,
                'unclaimed'   => $unclaimed,
                'pending'     => $pending,
                'total'       => $total,
            ],
            'rates' => [
                'claimed_rate'     => $total > 0 ? round(($claimed / $total) * 100, 1) : 0,
                'not_cleared_rate' => $total > 0 ? round(($notCleared / $total) * 100, 1) : 0,
                'unclaimed_rate'   => $total > 0 ? round(($unclaimed / $total) * 100, 1) : 0,
            ],
            'not_cleared_reasons' => $notClearedReasons,
        ]);
    }

    public function documentFailureBreakdown(Request $request)
    {
        $config = $this->resolveConfig($request);

        $actionQuery = VerifierAction::where('action', 'reupload_requested');
        if ($config) {
            $actionQuery->whereHas('application', fn($q) => $q->where('config_id', $config->id));
        }

        $perDocumentReasons = [];
        $documentFlagCounts = [];

        foreach ($actionQuery->get() as $action) {
            foreach (($action->reupload_details ?? []) as $detail) {
                $docType = $detail['document_type'] ?? 'unknown';
                $documentFlagCounts[$docType] = ($documentFlagCounts[$docType] ?? 0) + 1;

                foreach (($detail['reason_categories'] ?? []) as $reason) {
                    $perDocumentReasons[$docType][$reason] = ($perDocumentReasons[$docType][$reason] ?? 0) + 1;
                }
            }
        }

        $checkQuery = VerificationCheck::where('passed', false)
            ->with('document');
        if ($config) {
            $checkQuery->whereHas('application', fn($q) => $q->where('config_id', $config->id));
        }

        $automatedFailuresByDocType = $checkQuery->get()
            ->groupBy(fn($check) => $check->document->document_type ?? 'unknown')
            ->map(fn($group) => $group->countBy('check_name'));

        return response()->json([
            'config' => $config,
            'reupload_flag_counts_by_document' => $documentFlagCounts,
            'reupload_reasons_by_document'     => $perDocumentReasons,
            'automated_check_failures_by_document' => $automatedFailuresByDocType,
        ]);
    }

    public function applicantDistribution(Request $request)
    {
        $config = $this->resolveConfig($request);

        $query = Application::query();
        if ($config) {
            $query->where('config_id', $config->id);
        }

        $bySchool = $query->clone()
            ->selectRaw('school_name, COUNT(*) as total')
            ->groupBy('school_name')
            ->orderByDesc('total')
            ->get();

        $byCourse = $query->clone()
            ->selectRaw('course, COUNT(*) as total')
            ->groupBy('course')
            ->orderByDesc('total')
            ->get();

        $byYearLevel = $query->clone()
            ->selectRaw('year_level, COUNT(*) as total')
            ->groupBy('year_level')
            ->orderBy('year_level')
            ->get();

        return response()->json([
            'config'        => $config,
            'by_school'     => $bySchool,
            'by_course'     => $byCourse,
            'by_year_level' => $byYearLevel,
        ]);
    }

    public function submissionTrends(Request $request)
    {
        $config = $this->resolveConfig($request);

        $query = Application::query();
        if ($config) {
            $query->where('config_id', $config->id);
        }

        $trend = $query->clone()
            ->selectRaw("YEARWEEK(submitted_at, 1) as year_week, MIN(DATE(submitted_at)) as week_start, COUNT(*) as total")
            ->whereNotNull('submitted_at')
            ->groupBy('year_week')
            ->orderBy('year_week')
            ->get();

        return response()->json([
            'config' => $config,
            'weekly' => $trend,
        ]);
    }

    public function ageDistribution(Request $request)
    {
        $config = $this->resolveConfig($request);

        $query = Application::query()->with('user.profile');
        if ($config) {
            $query->where('config_id', $config->id);
        }

        $applications = $query->get();

        $minorCount = 0;
        $adultCount = 0;
        $unknownCount = 0;

        foreach ($applications as $app) {
            $isMinor = $app->user?->profile?->is_minor;
            if ($isMinor === true) {
                $minorCount++;
            } elseif ($isMinor === false) {
                $adultCount++;
            } else {
                $unknownCount++;
            }
        }

        $total = $minorCount + $adultCount + $unknownCount;

        return response()->json([
            'config' => $config,
            'counts' => [
                'minor'   => $minorCount,
                'adult'   => $adultCount,
                'unknown' => $unknownCount,
                'total'   => $total,
            ],
            'rates' => [
                'minor_rate'   => $total > 0 ? round(($minorCount / $total) * 100, 1) : 0,
                'adult_rate'   => $total > 0 ? round(($adultCount / $total) * 100, 1) : 0,
                'unknown_rate' => $total > 0 ? round(($unknownCount / $total) * 100, 1) : 0,
            ],
        ]);
    }

    public function submissionVsApprovalTrend(Request $request)
    {
        $configs = ApplicationConfiguration::orderBy('open_date')->get();

        $trend = $configs->map(function ($config) {
            $total      = Application::where('config_id', $config->id)->count();
            $approved   = Application::where('config_id', $config->id)
                ->whereIn('status', $this->approvedStatuses())
                ->count();
            $rejected   = Application::where('config_id', $config->id)
                ->where('status', 'rejected')
                ->count();
            $notCleared = Application::where('config_id', $config->id)
                ->where('status', 'not_cleared')
                ->count();
            $pending    = Application::where('config_id', $config->id)
                ->whereIn('status', $this->pendingStatuses())
                ->count();

            return [
                'config_id'      => $config->id,
                'school_year'    => $config->school_year,
                'is_active'      => $config->is_active,
                'total_submitted'=> $total,
                'approved'       => $approved,
                'rejected'       => $rejected,
                'not_cleared'    => $notCleared,
                'pending'        => $pending,
                'approval_rate'  => $total > 0 ? round(($approved / $total) * 100, 1) : 0,
            ];
        });

        return response()->json([
            'trend' => $trend->values(),
        ]);
    }

    // ── PDF EXPORTS ──────────────────────────────────────────────────

    public function claimingOutcomesPdf(Request $request)
    {
        $data = $this->claimingOutcomeSummary($request)->getData(true);
        $pdf = Pdf::loadView('reports.claiming-outcomes', [
            'title'              => 'Claiming Outcome Summary',
            'config'             => $data['config'] ? (object) $data['config'] : null,
            'counts'             => $data['counts'],
            'rates'              => $data['rates'],
            'notClearedReasons'  => $data['not_cleared_reasons'],
        ]);
        return $pdf->download('claiming-outcome-summary-' . now()->format('Y-m-d') . '.pdf');
    }

    public function documentFailuresPdf(Request $request)
    {
        $data = $this->documentFailureBreakdown($request)->getData(true);
        $pdf = Pdf::loadView('reports.document-failures', [
            'title'                   => 'Document Failure Breakdown',
            'config'                  => $data['config'] ? (object) $data['config'] : null,
            'reuploadFlagCounts'      => $data['reupload_flag_counts_by_document'],
            'reuploadReasonsByDoc'    => $data['reupload_reasons_by_document'],
            'automatedFailuresByDoc'  => $data['automated_check_failures_by_document'],
        ]);
        return $pdf->download('document-failure-breakdown-' . now()->format('Y-m-d') . '.pdf');
    }

    public function applicantDistributionPdf(Request $request)
    {
        $data = $this->applicantDistribution($request)->getData(true);
        $pdf = Pdf::loadView('reports.applicant-distribution', [
            'title'        => 'Applicant Distribution',
            'config'       => $data['config'] ? (object) $data['config'] : null,
            'bySchool'     => collect($data['by_school'])->map(fn($r) => (object) $r),
            'byCourse'     => collect($data['by_course'])->map(fn($r) => (object) $r),
            'byYearLevel'  => collect($data['by_year_level'])->map(fn($r) => (object) $r),
        ]);
        return $pdf->download('applicant-distribution-' . now()->format('Y-m-d') . '.pdf');
    }

    public function submissionTrendsPdf(Request $request)
    {
        $data = $this->submissionTrends($request)->getData(true);
        $pdf = Pdf::loadView('reports.submission-trends', [
            'title'  => 'Submission Trends',
            'config' => $data['config'] ? (object) $data['config'] : null,
            'weekly' => collect($data['weekly'])->map(fn($r) => (object) $r),
        ]);
        return $pdf->download('submission-trends-' . now()->format('Y-m-d') . '.pdf');
    }

    public function ageDistributionPdf(Request $request)
    {
        $data = $this->ageDistribution($request)->getData(true);
        $pdf = Pdf::loadView('reports.age-distribution', [
            'title'  => 'Applicant Age Distribution — Minor vs. Adult',
            'config' => $data['config'] ? (object) $data['config'] : null,
            'counts' => $data['counts'],
            'rates'  => $data['rates'],
        ]);
        return $pdf->download('age-distribution-' . now()->format('Y-m-d') . '.pdf');
    }

    public function submissionVsApprovalPdf(Request $request)
    {
        $data = $this->submissionVsApprovalTrend($request)->getData(true);
        $pdf = Pdf::loadView('reports.submission-vs-approval', [
            'title'  => 'Submission vs. Approval Trend',
            'config' => null,
            'trend'  => $data['trend'],
        ]);
        return $pdf->download('submission-vs-approval-trend-' . now()->format('Y-m-d') . '.pdf');
    }
}