<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Application;
use App\Models\ApplicationConfiguration;
use App\Models\ClaimingAssignment;
use App\Models\VerificationCheck;
use App\Models\VerifierAction;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Barryvdh\DomPDF\Facade\Pdf;

class AdminReportController extends Controller
{
    const ASSISTANCE_AMOUNT = 2000;

    // "Approved" means currently eligible to claim, or already claimed —
    // approved (pre-claiming-day) + claimed (successfully received) +
    // unclaimed (slot still reserved for them per business rule).
    // not_cleared is deliberately excluded: once claiming day resolves
    // someone to not_cleared, they gave their slot back and are no
    // longer "approved" in any meaningful sense — counting them here
    // would double-count them against rejected/not_cleared buckets
    // elsewhere and misstate funded/utilization figures.
    private function slotHoldingStatuses(): array
    {
        return ['approved', 'claimed', 'unclaimed'];
    }

    private function pendingStatuses(): array
    {
        return ['pending_prescreening', 'for_review', 'reupload_requested'];
    }

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

    public function filterOptions()
    {
        return response()->json([
            'schools' => Application::whereNotNull('school_name')->distinct()->orderBy('school_name')->pluck('school_name'),
            'courses' => Application::whereNotNull('course')->distinct()->orderBy('course')->pluck('course'),
        ]);
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
        $approved = $query->clone()->whereIn('status', $this->slotHoldingStatuses())->count();
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

    private function applyFilters($query, Request $request)
    {
        $type = $request->query('type');
        $map = [
            'Approved Students'     => $this->slotHoldingStatuses(),
            'Rejected Applications' => ['rejected'],
            'Pending Applications'  => $this->pendingStatuses(),
        ];
        if ($type && isset($map[$type])) {
            $query->whereIn('status', $map[$type]);
        }
        // Scope to a specific application period — without this, "names for
        // this period" (e.g. the Facebook announcement list) would silently
        // pull applicants from every period ever run.
        if ($request->filled('config_id')) {
            $query->where('config_id', $request->query('config_id'));
        }
        if ($request->filled('from')) {
            $query->whereDate('submitted_at', '>=', $request->query('from'));
        }
        if ($request->filled('to')) {
            $query->whereDate('submitted_at', '<=', $request->query('to'));
        }
        if ($request->filled('school_name')) {
            $query->where('school_name', $request->query('school_name'));
        }
        if ($request->filled('course')) {
            $query->where('course', $request->query('course'));
        }
        if ($request->filled('year_level')) {
            $query->where('year_level', $request->query('year_level'));
        }
    }

    private function filterByApplicantType($applications, Request $request)
    {
        if (!$request->filled('applicant_type')) {
            return $applications;
        }
        $wantMinor = $request->query('applicant_type') === 'minor';
        return $applications->filter(
            fn($app) => ($app->user?->profile?->is_minor ?? false) === $wantMinor
        )->values();
    }

    public function applications(Request $request)
    {
        $query = Application::with('user.profile')
            ->orderByRaw('control_number IS NULL')
            ->orderBy('control_number')
            ->orderBy('submitted_at');
        $this->applyFilters($query, $request);
        $applications = $this->filterByApplicantType($query->get(), $request);
        $mapped = $applications->map(function ($app) {
            return [
                'id'             => $app->id,
                'control_number' => $app->control_number,
                'name'           => trim($app->user->first_name . ' ' . $app->user->last_name),
                'submitted_at'   => $app->submitted_at,
                'status'         => $app->status,
                'school_name'    => $app->school_name,
                'course'         => $app->course,
                'year_level'     => $app->year_level,
            ];
        });
        return response()->json($mapped->values());
    }

    public function export(Request $request)
    {
        $query = Application::with('user.profile')
            ->orderByRaw('control_number IS NULL')
            ->orderBy('control_number')
            ->orderBy('submitted_at');
        $this->applyFilters($query, $request);
        $applications = $this->filterByApplicantType($query->get(), $request);
        $filename = 'applicant-records-' . now()->format('Y-m-d') . '.csv';
        $headers = [
            'Content-Type'        => 'text/csv',
            'Content-Disposition' => "attachment; filename=\"{$filename}\"",
        ];
        $callback = function () use ($applications) {
            $handle = fopen('php://output', 'w');
            fputcsv($handle, [
                'Application ID', 'Control Number', 'Applicant Name', 'Email',
                'School', 'Course', 'Year Level', 'Applicant Type', 'Status', 'Submitted At',
            ]);
            foreach ($applications as $app) {
                $applicantType = $app->user?->profile?->is_minor === true
                    ? 'Minor'
                    : ($app->user?->profile?->is_minor === false ? 'Adult' : 'Unknown');
                fputcsv($handle, [
                    'APP-' . $app->id,
                    $app->control_number,
                    trim($app->user->first_name . ' ' . $app->user->last_name),
                    $app->user->email,
                    $app->school_name,
                    $app->course,
                    $app->year_level,
                    $applicantType,
                    $app->status,
                    $app->submitted_at,
                ]);
            }
            fclose($handle);
        };
        return response()->stream($callback, 200, $headers);
    }

    public function gracePeriodClaimingList(Request $request)
    {
        $config = $this->resolveConfig($request);
        if (!$config) {
            return response()->json(['message' => 'No active application period.'], 404);
        }
        $list = $this->buildGracePeriodClaimingList($config);
        $entries = $list['retrying']->map(fn($a) => [
            'control_number' => $a->application->control_number,
            'name'           => trim($a->application->user->first_name . ' ' . $a->application->user->last_name),
            'type'           => 'Retrying',
        ])->concat(
            $list['promoted']->map(fn($a) => [
                'control_number' => $a->application->control_number,
                'name'           => trim($a->application->user->first_name . ' ' . $a->application->user->last_name),
                'type'           => 'Promoted',
            ])
        )->values();
        return response()->json([
            'config'         => $config,
            'entries'        => $entries,
            'retrying_count' => $list['retrying']->count(),
            'promoted_count' => $list['promoted']->count(),
        ]);
    }

    private function buildApprovedApplicantsList(ApplicationConfiguration $config)
    {
        return Application::with('user')
            ->where('config_id', $config->id)
            ->whereNotNull('control_number')
            ->where('status', 'approved')
            ->orderBy('control_number')
            ->get()
            ->map(function ($app) {
                return [
                    'control_number' => $app->control_number,
                    'name' => trim(
                        $app->user->first_name . ' ' .
                        ($app->user->middle_name ? $app->user->middle_name . ' ' : '') .
                        $app->user->last_name
                    ),
                ];
            });
    }

    public function approvedApplicantsPdf(Request $request)
    {
        $config = $this->resolveConfig($request);
        if (!$config) {
            return response()->json(['message' => 'No active application period.'], 404);
        }

        $applicants = $this->buildApprovedApplicantsList($config);
        $perPage = (int) $request->query('per_page', 100);

        $pdf = Pdf::loadView('reports.approved-applicants', [
            'schoolYear' => $config->school_year,
            'applicants' => $applicants,
            'perPage'    => $perPage,
        ]);

        return $pdf->download('educational-assistance-' . $config->school_year . '-approved-list.pdf');
    }

    public function approvedApplicantsHtml(Request $request)
    {
        $config = $this->resolveConfig($request);
        if (!$config) {
            return response()->json(['message' => 'No active application period.'], 404);
        }

        $applicants = $this->buildApprovedApplicantsList($config);
        $perPage = (int) $request->query('per_page', 100);

        return view('reports.approved-applicants-content', [
            'schoolYear' => $config->school_year,
            'applicants' => $applicants,
            'forPdf'     => false,
            'perPage'    => $perPage,
        ])->render();
    }

    private function buildGracePeriodClaimingList(ApplicationConfiguration $config)
    {
        $assignments = ClaimingAssignment::with(['application.user', 'lane'])
            ->whereHas('application', fn($q) => $q->where('config_id', $config->id))
            ->where(function ($q) {
                $q->where(function ($q2) {
                    $q2->where('source', 'original')->where('claim_status', 'unclaimed');
                })->orWhere('source', 'waitlist_promotion');
            })
            ->get();
        return [
            'retrying' => $assignments->where('source', 'original')->values(),
            'promoted' => $assignments->where('source', 'waitlist_promotion')->values(),
        ];
    }

    public function gracePeriodClaimingListPdf(Request $request)
    {
        $config = $this->resolveConfig($request);
        if (!$config) {
            return response()->json(['message' => 'No active application period.'], 404);
        }
        $list = $this->buildGracePeriodClaimingList($config);
        $pdf = Pdf::loadView('reports.grace-period-claiming-list', [
            'title'    => 'Grace Period Claiming List',
            'config'   => $config,
            'retrying' => $list['retrying'],
            'promoted' => $list['promoted'],
        ]);
        return $pdf->download('grace-period-claiming-list-' . now()->format('Y-m-d') . '.pdf');
    }

    /**
     * DISBURSEMENT REPORT — the final list of who actually received the
     * money (claim_status = 'claimed'), alongside who disbursed it and
     * when. Sibling to the approved-applicants list, but scoped to
     * completed disbursements rather than approvals, and surfacing the
     * verifier accountability data that ClaimingAssignment already
     * records on every claim but was not previously shown anywhere.
     */
    public function disbursementReport(Request $request)
    {
        $config = $this->resolveConfig($request);
        if (!$config) {
            return response()->json(['message' => 'No active application period.'], 404);
        }

        $assignments = ClaimingAssignment::with(['application.user', 'verifier', 'lane'])
            ->whereHas('application', fn($q) => $q->where('config_id', $config->id))
            ->where('claim_status', 'claimed')
            ->orderBy('verified_at')
            ->get();

        $entries = $assignments->map(function ($a) {
            return [
                'control_number' => $a->application->control_number,
                'applicant_name' => trim($a->application->user->first_name . ' ' . $a->application->user->last_name),
                'school_name'    => $a->application->school_name,
                'lane_name'      => $a->lane->lane_name ?? null,
                'claiming_date'  => $a->lane->claiming_date ?? null,
                'verifier_name'  => $a->verifier ? trim($a->verifier->first_name . ' ' . $a->verifier->last_name) : null,
                'verified_at'    => $a->verified_at,
                'amount'         => self::ASSISTANCE_AMOUNT,
            ];
        });

        return response()->json([
            'config'          => $config,
            'entries'         => $entries,
            'total_disbursed' => $entries->count(),
            'total_amount'    => $entries->count() * self::ASSISTANCE_AMOUNT,
        ]);
    }

    public function disbursementReportPdf(Request $request)
    {
        $config = $this->resolveConfig($request);
        if (!$config) {
            return response()->json(['message' => 'No active application period.'], 404);
        }

        $data = $this->disbursementReport($request)->getData(true);

        $pdf = Pdf::loadView('reports.disbursement-report', [
            'title'          => 'Disbursement Report',
            'config'         => (object) $data['config'],
            'entries'        => collect($data['entries'])->map(fn($e) => (object) $e),
            'totalDisbursed' => $data['total_disbursed'],
            'totalAmount'    => $data['total_amount'],
        ]);

        return $pdf->download('disbursement-report-' . now()->format('Y-m-d') . '.pdf');
    public function unmetDemand(Request $request)
    {
        $configs = ApplicationConfiguration::orderBy('open_date')->get();

        $trend = $configs->map(function ($config) {
            $approved = Application::where('config_id', $config->id)
                ->whereIn('status', $this->slotHoldingStatuses())
                ->count();

            $waitlisted = Application::where('config_id', $config->id)
                ->where('status', 'waitlisted')
                ->count();

            $ratio = $approved > 0 ? round(($waitlisted / $approved) * 100, 1) : null;

            return [
                'config_id'   => $config->id,
                'school_year' => $config->school_year,
                'is_active'   => $config->is_active,
                'approved'    => $approved,
                'waitlisted'  => $waitlisted,
                'ratio'       => $ratio,
            ];
        });

        return response()->json(['trend' => $trend->values()]);
    }

    // ── OTHER REPORTS (JSON) ─────────────────────────────────────────

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
        $totalFlags = array_sum($documentFlagCounts);
        $documentFlagPercentages = [];
        foreach ($documentFlagCounts as $docType => $count) {
            $documentFlagPercentages[$docType] = $totalFlags > 0 ? round(($count / $totalFlags) * 100, 1) : 0;
        }
        $checkQuery = VerificationCheck::where('passed', false)->with('document');
        if ($config) {
            $checkQuery->whereHas('application', fn($q) => $q->where('config_id', $config->id));
        }
        $automatedFailuresByDocType = $checkQuery->get()
            ->groupBy(fn($check) => $check->document->document_type ?? 'unknown')
            ->map(fn($group) => $group->countBy('check_name'));
        return response()->json([
            'config' => $config,
            'reupload_flag_counts_by_document'      => $documentFlagCounts,
            'reupload_flag_percentages_by_document'  => $documentFlagPercentages,
            'reupload_reasons_by_document'           => $perDocumentReasons,
            'automated_check_failures_by_document'   => $automatedFailuresByDocType,
        ]);
    }

    public function applicantDistribution(Request $request)
    {
        $config = $this->resolveConfig($request);
        $query = Application::query();
        if ($config) {
            $query->where('config_id', $config->id);
        }
        $totalApplications = $query->clone()->count();
        $addPercentage = function ($rows) use ($totalApplications) {
            return $rows->map(function ($row) use ($totalApplications) {
                $row->percentage = $totalApplications > 0
                    ? round(($row->total / $totalApplications) * 100, 1)
                    : 0;
                return $row;
            });
        };
        $bySchool = $addPercentage(
            $query->clone()->selectRaw('school_name, COUNT(*) as total')
                ->groupBy('school_name')->orderByDesc('total')->get()
        );
        $byCourse = $addPercentage(
            $query->clone()->selectRaw('course, COUNT(*) as total')
                ->groupBy('course')->orderByDesc('total')->get()
        );
        $byYearLevel = $addPercentage(
            $query->clone()->selectRaw('year_level, COUNT(*) as total')
                ->groupBy('year_level')->orderBy('year_level')->get()
        );
        return response()->json([
            'config'        => $config,
            'total_applications' => $totalApplications,
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
        $totalForPeriod = $trend->sum('total');
        $trend = $trend->map(function ($week) use ($totalForPeriod) {
            $week->percentage = $totalForPeriod > 0 ? round(($week->total / $totalForPeriod) * 100, 1) : 0;
            return $week;
        });
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
            $total = Application::where('config_id', $config->id)->count();
            $approved = Application::where('config_id', $config->id)
                ->whereIn('status', $this->slotHoldingStatuses())
                ->count();
            $rejected = Application::where('config_id', $config->id)
                ->whereIn('status', ['rejected', 'not_cleared'])
                ->count();
            $pending = Application::where('config_id', $config->id)
                ->whereIn('status', $this->pendingStatuses())
                ->count();
            return [
                'config_id'       => $config->id,
                'school_year'     => $config->school_year,
                'is_active'       => $config->is_active,
                'total_submitted' => $total,
                'approved'        => $approved,
                'rejected'        => $rejected,
                'pending'         => $pending,
                'approval_rate'   => $total > 0 ? round(($approved / $total) * 100, 1) : 0,
                'rejection_rate'  => $total > 0 ? round(($rejected / $total) * 100, 1) : 0,
                'pending_rate'    => $total > 0 ? round(($pending / $total) * 100, 1) : 0,
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
            'title'             => 'Claiming Outcome Summary',
            'config'            => $data['config'] ? (object) $data['config'] : null,
            'counts'            => $data['counts'],
            'rates'             => $data['rates'],
            'notClearedReasons' => $data['not_cleared_reasons'],
        ]);
        return $pdf->download('claiming-outcome-summary-' . now()->format('Y-m-d') . '.pdf');
    }

    public function documentFailuresPdf(Request $request)
    {
        $data = $this->documentFailureBreakdown($request)->getData(true);
        $pdf = Pdf::loadView('reports.document-failures', [
            'title'                  => 'Document Failure Breakdown',
            'config'                 => $data['config'] ? (object) $data['config'] : null,
            'reuploadFlagCounts'     => $data['reupload_flag_counts_by_document'],
            'reuploadFlagPercentages'=> $data['reupload_flag_percentages_by_document'],
            'reuploadReasonsByDoc'   => $data['reupload_reasons_by_document'],
            'automatedFailuresByDoc' => $data['automated_check_failures_by_document'],
        ]);
        return $pdf->download('document-failure-breakdown-' . now()->format('Y-m-d') . '.pdf');
    }

    public function applicantDistributionPdf(Request $request)
    {
        $data = $this->applicantDistribution($request)->getData(true);
        $pdf = Pdf::loadView('reports.applicant-distribution', [
            'title'       => 'Applicant Distribution',
            'config'      => $data['config'] ? (object) $data['config'] : null,
            'bySchool'    => collect($data['by_school'])->map(fn($r) => (object) $r),
            'byCourse'    => collect($data['by_course'])->map(fn($r) => (object) $r),
            'byYearLevel' => collect($data['by_year_level'])->map(fn($r) => (object) $r),
        ]);
        return $pdf->download('applicant-distribution-' . now()->format('Y-m-d') . '.pdf');
    }

    public function schoolProgramPdf(Request $request)
    {
        $data = $this->applicantDistribution($request)->getData(true);
        $pdf = Pdf::loadView('reports.school-program', [
            'title'    => 'Applicant Profile — School & Program',
            'config'   => $data['config'] ? (object) $data['config'] : null,
            'bySchool' => collect($data['by_school'])->map(fn($r) => (object) $r),
            'byCourse' => collect($data['by_course'])->map(fn($r) => (object) $r),
        ]);
        return $pdf->download('applicant-school-program-' . now()->format('Y-m-d') . '.pdf');
    }

    public function yearLevelAgePdf(Request $request)
    {
        $distData = $this->applicantDistribution($request)->getData(true);
        $ageData  = $this->ageDistribution($request)->getData(true);
        $pdf = Pdf::loadView('reports.year-level-age', [
            'title'       => 'Applicant Profile — Year Level & Age',
            'config'      => $distData['config'] ? (object) $distData['config'] : null,
            'byYearLevel' => collect($distData['by_year_level'])->map(fn($r) => (object) $r),
            'counts'      => $ageData['counts'],
            'rates'       => $ageData['rates'],
        ]);
        return $pdf->download('applicant-year-level-age-' . now()->format('Y-m-d') . '.pdf');
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

    /**
     * BUDGET FORECAST — isolates the approval-rate side only. Uses a
     * plain average for projected volume (same as Budget Estimation),
     * but replaces the plain average pass rate with a Wilson confidence
     * interval, pooled across completed periods. This is the one
     * quantity here that's statistically valid to forecast, since it's
     * unaffected by unmet demand outside the applied pool.
     */
    public function budgetForecast()
    {
        $configs = ApplicationConfiguration::orderBy('open_date')->get();
        $completed = $configs->where('is_active', false);
        $pooledTotal = 0;
        $pooledApproved = 0;
        $volumes = [];
        foreach ($completed as $config) {
            $total = Application::where('config_id', $config->id)->count();
            $approved = Application::where('config_id', $config->id)
                ->whereIn('status', $this->slotHoldingStatuses())
                ->count();
            $pooledTotal += $total;
            $pooledApproved += $approved;
            if ($total > 0) {
                $volumes[] = $total;
            }
        }
        if ($pooledTotal === 0) {
            return response()->json([
                'available' => false,
                'message' => 'Not enough completed period data to compute a forecast.',
            ]);
        }
        $z = 1.959964;
        $n = $pooledTotal;
        $pHat = $pooledApproved / $n;
        $denominator = 1 + ($z ** 2) / $n;
        $center = ($pHat + ($z ** 2) / (2 * $n)) / $denominator;
        $margin = ($z * sqrt(($pHat * (1 - $pHat) / $n) + ($z ** 2) / (4 * $n ** 2))) / $denominator;
        $lowerRate = max(0, $center - $margin);
        $upperRate = min(1, $center + $margin);
        $projectedVolume = count($volumes) > 0 ? array_sum($volumes) / count($volumes) : 0;
        return response()->json([
            'available' => true,
            'pooled_total_submitted' => $pooledTotal,
            'pooled_approved'        => $pooledApproved,
            'point_estimate_rate'    => round($pHat, 4),
            'confidence_interval'    => [
                'lower' => round($lowerRate, 4),
                'upper' => round($upperRate, 4),
                'level' => 0.95,
            ],
            'projected_volume' => round($projectedVolume),
            'projected_approved_range' => [
                'lower' => round($projectedVolume * $lowerRate),
                'upper' => round($projectedVolume * $upperRate),
            ],
            'projected_budget_range' => [
                'lower' => round($projectedVolume * $lowerRate) * self::ASSISTANCE_AMOUNT,
                'upper' => round($projectedVolume * $upperRate) * self::ASSISTANCE_AMOUNT,
            ],
            'assistance_per_applicant' => self::ASSISTANCE_AMOUNT,
            'periods_used' => $completed->count(),
        ]);
    }

    /**
     * BUDGET ESTIMATION — plain historical average, no statistical claim.
     */
    public function budgetEstimation()
    {
        $configs = ApplicationConfiguration::orderBy('open_date')->get();
        $historical = $configs->map(function ($config) {
            $total = Application::where('config_id', $config->id)->count();
            $approved = Application::where('config_id', $config->id)
                ->whereIn('status', $this->slotHoldingStatuses())
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
            'estimate' => [
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

    /**
     * BUDGET ALLOCATION PLANNING — a decision-support calculator, not a
     * forecast.
     */
    public function lastCycleActuals()
    {
        $mostRecent = ApplicationConfiguration::where('is_active', false)
            ->orderByDesc('open_date')
            ->first();
        if (!$mostRecent) {
            return response()->json(['available' => false]);
        }
        return response()->json([
            'available'          => true,
            'school_year'        => $mostRecent->school_year,
            'slot_limit'         => $mostRecent->slot_limit,
            'is_unlimited'       => $mostRecent->is_unlimited,
            'amount_per_student' => self::ASSISTANCE_AMOUNT,
            'total_budget_used'  => $mostRecent->is_unlimited ? null : $mostRecent->slot_limit * self::ASSISTANCE_AMOUNT,
        ]);
    }

    /**
     * OCR QUEUE HEALTH
     */
    public function ocrQueueHealth()
    {
        $failedCount = DB::table('failed_jobs')->where('queue', 'ocr')->count();
        $recentFailures = DB::table('failed_jobs')
            ->where('queue', 'ocr')
            ->orderByDesc('failed_at')
            ->limit(20)
            ->get(['id', 'uuid', 'exception', 'failed_at'])
            ->map(function ($job) {
                $firstLine = strtok($job->exception, "\n");
                return [
                    'id'                 => $job->id,
                    'uuid'               => $job->uuid,
                    'failed_at'          => $job->failed_at,
                    'exception_summary'  => mb_strimwidth($firstLine, 0, 200, '...'),
                ];
            });
        return response()->json([
            'failed_count'    => $failedCount,
            'recent_failures' => $recentFailures,
        ]);
    }
}