<?php
namespace App\Http\Controllers\Api;
use App\Http\Controllers\Controller;
use App\Models\Application;
use App\Models\ApplicationConfiguration;
use App\Models\ClaimingSchedule;
use App\Models\ClaimingLane;
use App\Models\ClaimingAssignment;
use App\Notifications\ClaimingScheduleNotification;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Http\Request;

class AdminScheduleController extends Controller
{
    public function show(Request $request)
    {
        $config = ApplicationConfiguration::where('is_active', true)->first();
        if (!$config) {
            return response()->json(['message' => 'No active application period.'], 404);
        }
        $approvedCount = Application::where('config_id', $config->id)
            ->where('status', 'approved')
            ->whereNotNull('control_number')
            ->count();
        $schedule = ClaimingSchedule::with(['lanes' => function ($q) {
                $q->withCount('assignments')->orderBy('claiming_date')->orderBy('lane_name');
            }])
            ->where('config_id', $config->id)
            ->latest()
            ->first();
        return response()->json([
            'config'         => $config,
            'approved_count' => $approvedCount,
            'schedule'       => $schedule,
        ]);
    }

    public function store(Request $request)
    {
        $request->validate([
            'location'              => 'required|string',
            'morning_start'         => 'nullable',
            'morning_end'           => 'nullable',
            'afternoon_start'       => 'nullable',
            'afternoon_end'         => 'nullable',
            'grace_period_date'     => 'nullable|date',
            'grace_period_end_date' => 'nullable|date|after_or_equal:grace_period_date',
            'lanes'                 => 'required|array|min:1',
            'lanes.*.lane_name'     => 'required|string',
            'lanes.*.capacity'      => 'nullable|integer|min:1',
            'lanes.*.batch'         => 'required|in:morning,afternoon',
            'lanes.*.claiming_date' => 'required|date',
        ]);
    
        $config = ApplicationConfiguration::where('is_active', true)->first();
        if (!$config) {
            return response()->json(['message' => 'No active application period.'], 404);
        }
    
        $schedule = ClaimingSchedule::where('config_id', $config->id)->latest()->first();
        if ($schedule && $schedule->is_published) {
            return response()->json(['message' => 'Schedule already published and cannot be edited.'], 400);
        }
    
        if (!$schedule) {
            $schedule = new ClaimingSchedule(['config_id' => $config->id]);
        }
    
        $schedule->fill($request->only([
            'location', 'morning_start', 'morning_end',
            'afternoon_start', 'afternoon_end',
            'grace_period_date', 'grace_period_end_date',
        ]));
        $schedule->save();
    
        $schedule->lanes()->delete();
        foreach ($request->lanes as $lane) {
            $schedule->lanes()->create($lane);
        }
    
        return response()->json([
            'message'  => 'Schedule saved.',
            'schedule' => $schedule->load(['lanes' => function ($q) {
                $q->withCount('assignments');
            }]),
        ]);
    }

    /**
     * Computes how approved applicants would be split across lanes,
     * without persisting anything. Shared by preview() and publish()
     * so the numbers an admin previews are guaranteed to match what
     * actually gets assigned.
     */
    private function partitionApplicants($lanes, $applications)
    {
        $remaining   = $applications->values();
        $assignments = [];

        $fixedLanes    = $lanes->whereNotNull('capacity')->values();
        $flexibleLanes = $lanes->whereNull('capacity')->values();

        foreach ($fixedLanes as $lane) {
            $assignments[$lane->id] = $remaining->splice(0, $lane->capacity);
        }

        if ($flexibleLanes->count() > 0 && $remaining->count() > 0) {
            $chunkSize = (int) ceil($remaining->count() / $flexibleLanes->count());
            foreach ($flexibleLanes as $lane) {
                $assignments[$lane->id] = $remaining->splice(0, $chunkSize);
            }
        } elseif ($remaining->count() > 0) {
            // Every lane had a fixed capacity but applicants still remain
            // (total capacity was set too low). Overflow goes to the last
            // lane so nobody is silently dropped from the schedule.
            $lastLane = $lanes->last();
            $assignments[$lastLane->id] = ($assignments[$lastLane->id] ?? collect())->merge($remaining);
        }

        return $assignments;
    }

    public function preview($id)
    {
        $schedule = ClaimingSchedule::with('lanes')->findOrFail($id);

        $applications = Application::where('config_id', $schedule->config_id)
            ->where('status', 'approved')
            ->whereNotNull('control_number')
            ->orderBy('control_number')
            ->get(['id', 'control_number']);

        $lanes = $schedule->lanes()->orderBy('claiming_date')->orderBy('id')->get();

        $assignments = $this->partitionApplicants($lanes, $applications);

        $result = $lanes->map(function ($lane) use ($assignments) {
            $apps = $assignments[$lane->id] ?? collect();
            return [
                'id'                    => $lane->id,
                'lane_name'             => $lane->lane_name,
                'batch'                 => $lane->batch,
                'claiming_date'         => $lane->claiming_date,
                'capacity'              => $lane->capacity,
                'assigned_count'        => $apps->count(),
                'control_number_range'  => $apps->count() > 0
                    ? $apps->first()->control_number . ' – ' . $apps->last()->control_number
                    : null,
            ];
        });

        return response()->json([
            'total_approved' => $applications->count(),
            'total_lanes'    => $lanes->count(),
            'lanes'          => $result,
        ]);
    }

    public function publish(Request $request, $id)
    {
        $schedule = ClaimingSchedule::with('lanes')->findOrFail($id);

        if ($schedule->is_published) {
            return response()->json(['message' => 'Schedule already published.'], 400);
        }

        $applications = Application::with('user')
            ->where('config_id', $schedule->config_id)
            ->where('status', 'approved')
            ->whereNotNull('control_number')
            ->orderBy('control_number')
            ->get();

        if ($applications->isEmpty()) {
            return response()->json(['message' => 'No approved applicants to assign yet.'], 400);
        }

        $lanes = $schedule->lanes()->orderBy('claiming_date')->orderBy('id')->get();
        if ($lanes->isEmpty()) {
            return response()->json(['message' => 'Please add at least one lane before publishing.'], 400);
        }

        $assignments = $this->partitionApplicants($lanes, $applications);

        $assignedCount = 0;
        foreach ($assignments as $laneId => $apps) {
            $lane = $lanes->firstWhere('id', $laneId);
            foreach ($apps as $app) {
                ClaimingAssignment::updateOrCreate(
                    ['application_id' => $app->id],
                    [
                        'claiming_schedule_id' => $schedule->id,
                        'claiming_lane_id'     => $laneId,
                        'claim_status'         => 'pending_claiming',
                    ]
                );
                $assignedCount++;
                $app->user->notify(new ClaimingScheduleNotification($app, $lane, $schedule));
            }
        }

        $schedule->update([
            'is_published' => true,
            'published_at' => now(),
        ]);

        return response()->json([
            'message'  => "Schedule published. {$assignedCount} applicant(s) assigned and notified.",
            'schedule' => $schedule->load(['lanes' => function ($q) {
                $q->withCount('assignments');
            }]),
        ]);
    }

    public function printableLane($laneId)
    {
        $lane = ClaimingLane::with(['assignments.application.user'])->findOrFail($laneId);
        $list = $lane->assignments
            ->map(function ($a) {
                return [
                    'control_number' => $a->application->control_number,
                    'name'           => trim($a->application->user->first_name . ' ' . $a->application->user->last_name),
                ];
            })
            ->sortBy('control_number')
            ->values();
        return response()->json([
            'lane_name'     => $lane->lane_name,
            'batch'         => $lane->batch,
            'claiming_date' => $lane->claiming_date,
            'applicants'    => $list,
        ]);
    }

    /**
     * Lists every lane for the active period's published schedule, plus
     * every available verifier — so an admin can assign or reassign who's
     * working which lane, ANYTIME (before or after publish, before or
     * during claiming day). This is deliberately separate from
     * store()/publish() — lane-verifier staffing is day-of operational
     * reality for a small SK team, not something that should be locked
     * once the schedule itself is finalized.
     */
    public function laneAssignments()
    {
        $config = ApplicationConfiguration::where('is_active', true)->first();
        if (!$config) {
            return response()->json(['lanes' => [], 'verifiers' => []]);
        }

        $schedule = ClaimingSchedule::where('config_id', $config->id)
            ->where('is_published', true)
            ->latest()
            ->first();

        if (!$schedule) {
            return response()->json(['lanes' => [], 'verifiers' => []]);
        }

        $lanes = $schedule->lanes()
            ->with('verifier:id,first_name,last_name')
            ->where('lane_name', '!=', 'Grace Period Claiming')
            ->orderBy('claiming_date')
            ->orderBy('lane_name')
            ->get(['id', 'lane_name', 'batch', 'claiming_date', 'verifier_id']);

        $verifiers = \App\Models\User::where('role', 'sk_verifier')
            ->where('is_active', true)
            ->orderBy('first_name')
            ->get(['id', 'first_name', 'last_name']);

        return response()->json(['lanes' => $lanes, 'verifiers' => $verifiers]);
    }

    /**
     * Admin sets (or clears, if verifier_id is null) which verifier is
     * assigned to a specific lane. Editable at any time — not gated by
     * is_published, since staffing can change on the day itself.
     */
    public function assignVerifier(Request $request, $laneId)
    {
        $request->validate([
            'verifier_id' => 'nullable|exists:users,id',
        ]);

        $lane = ClaimingLane::findOrFail($laneId);

        // Enforce one lane per verifier — same constraint selfAssignLane()
        // already applies on the verifier side. Without this, an admin
        // could put the same person on two lanes at once, which doesn't
        // make sense physically (they can't be in two places at the same
        // claiming session).
        if ($request->verifier_id) {
            ClaimingLane::where('claiming_schedule_id', $lane->claiming_schedule_id)
                ->where('verifier_id', $request->verifier_id)
                ->where('id', '!=', $lane->id)
                ->update(['verifier_id' => null]);
        }

        $lane->update(['verifier_id' => $request->verifier_id]);

        return response()->json([
            'message' => $request->verifier_id
                ? 'Verifier assigned to lane.'
                : 'Verifier unassigned from lane.',
            'lane' => $lane->load('verifier:id,first_name,last_name'),
        ]);
    }

    /**
     * PDF version of printableLane() — same data, rendered through
     * Blade + dompdf instead of raw JSON. Streamed inline (not
     * downloaded) so it opens in the browser's PDF viewer, where the
     * verifier can print directly using the viewer's own print button.
     */
    public function printableLanePdf($laneId)
    {
        $lane = ClaimingLane::with(['assignments.application.user'])->findOrFail($laneId);
        $list = $lane->assignments
            ->map(function ($a) {
                return [
                    'control_number' => $a->application->control_number,
                    'name'           => trim($a->application->user->first_name . ' ' . $a->application->user->last_name),
                ];
            })
            ->sortBy('control_number')
            ->values();

            $pdf = Pdf::loadView('claiming.lane-claiming-list', [
                'title'        => $lane->lane_name . ' — Claiming List',
                'batch'        => $lane->batch,
                'claimingDate' => $lane->claiming_date,
                'applicants'   => $list,
            ]);

        // ->stream() not ->download() — every other export in this codebase
        // downloads immediately (attachment), but this one needs to open in
        // a tab first so the verifier can preview before printing.
        return $pdf->stream('lane-claiming-list-' . $lane->id . '.pdf');
    }

    /**
     * Closes an application period — the deliberate, manual action that
     * marks a period as fully settled, not just no-longer-accepting-new-
     * applications. Two things happen atomically:
     * 1. Every still-waitlisted applicant for this config becomes
     *    not_selected — they passed every check but ran out of room by
     *    the time grace period ended. Not a rejection.
     * 2. closed_at is stamped, so this period now has a real "settled"
     *    timestamp distinct from its planned close_date.
     */
    public function closePeriod($id)
    {
        $config = ApplicationConfiguration::findOrFail($id);
    
        if ($config->closed_at) {
            return response()->json(['message' => 'This period is already closed.'], 400);
        }
    
        $schedule = ClaimingSchedule::where('config_id', $config->id)
            ->where('is_published', true)
            ->latest()
            ->first();
    
        if ($schedule && $schedule->grace_period_end_date && now()->lt($schedule->grace_period_end_date)) {
            return response()->json([
                'message' => 'Cannot close this period until the grace period has ended (' . $schedule->grace_period_end_date . ').',
            ], 400);
        }
    
        $waitlisted = Application::where('config_id', $config->id)
            ->where('status', 'waitlisted')
            ->get();
    
        foreach ($waitlisted as $app) {
            $app->update(['status' => 'not_selected']);
    
            \App\Models\AuditLog::record(
                'application_not_selected',
                $app,
                "Application #{$app->id} marked not_selected — period closed with no remaining slots ({$app->user->first_name} {$app->user->last_name})"
            );
        }
    
        $config->update(['closed_at' => now()]);
    
        return response()->json([
            'message' => "Period closed. {$waitlisted->count()} waitlisted applicant(s) marked not_selected.",
            'config'  => $config,
        ]);
    }
}