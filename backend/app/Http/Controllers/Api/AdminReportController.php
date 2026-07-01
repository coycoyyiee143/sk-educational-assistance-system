<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Application;
use App\Models\ApplicationConfiguration;
use Illuminate\Http\Request;

class AdminReportController extends Controller
{
    const ASSISTANCE_AMOUNT = 2000;

    private function approvedStatuses(): array
    {
        return ['approved', 'physically_verified', 'claimed', 'not_cleared', 'unclaimed'];
    }

    private function pendingStatuses(): array
    {
        return ['pending_prescreening', 'for_review', 'reupload_requested'];
    }

    public function summary(Request $request)
    {
        $config = ApplicationConfiguration::where('is_active', true)->first();

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
                'semester'               => $config->semester,
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

        // If active period is unlimited, there's no hard cap to project against —
        // fall back to average approved count as the projection ceiling instead.
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
}