<?php
namespace App\Http\Controllers\Api;
use App\Http\Controllers\Controller;
use App\Models\Application;
use App\Models\ApplicationConfiguration;
use App\Models\ClaimingSchedule;
use App\Models\ClaimingLane;
use App\Services\ClaimingAssignmentService;
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

        // Approved but not yet on any lane — either no schedule is active
        // yet, or every lane was full at the moment they were approved.
        // Surfaced so an admin can see at a glance whether anyone's
        // waiting on room to open up.
        $unassignedApprovedCount = Application::where('config_id', $config->id)
            ->where('status', 'approved')
            ->whereNotNull('control_number')
            ->whereDoesntHave('claimingAssignment')
            ->count();

        $schedule = ClaimingSchedule::with(['lanes' => function ($q) {
                $q->withCount('assignments')
                    ->with('verifier:id,first_name,last_name')
                    ->with('requestedVerifier:id,first_name,last_name')
                    ->with('assignments.application:id,control_number')
                    ->orderBy('claiming_date')->orderBy('lane_name');
            }])
            ->where('config_id', $config->id)
            ->latest()
            ->first();

        $schedule?->lanes->each->append('control_number_range');

        // Active verifiers, for the "Assigned Verifier" picker on each lane
        // row — fetched here so the schedule page can offer it inline
        // instead of needing a separate lane-assignments page/endpoint.
        $verifiers = \App\Models\User::where('role', 'sk_verifier')
            ->where('is_active', true)
            ->orderBy('first_name')
            ->get(['id', 'first_name', 'last_name']);

        return response()->json([
            'config'                     => $config,
            'approved_count'             => $approvedCount,
            'unassigned_approved_count'  => $unassignedApprovedCount,
            'schedule'                   => $schedule,
            'verifiers'                  => $verifiers,
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
            'late_claiming_date'     => 'nullable|date',
            'late_claiming_end_date' => 'nullable|date|after_or_equal:late_claiming_date',
            'lanes'                 => 'required|array|min:1',
            'lanes.*.lane_name'     => 'required|string',
            // Capacity is REQUIRED here — unlimited-capacity regular lanes
            // aren't a real scenario for this org, and allowing them just
            // added an edge case (an unlimited lane silently swallowing
            // every applicant that reaches it in fill order, never letting
            // later lanes get used). The one legitimate uncapped lane in
            // this system — "Late Claiming" — is created directly
            // by VerifierController's waitlist-promotion flow, not through
            // this admin-configured lane list, so it's unaffected by this.
            'lanes.*.capacity'      => 'required|integer|min:1',
            'lanes.*.batch'         => 'required|in:morning,afternoon',
            'lanes.*.claiming_date' => 'required|date',
            'lanes.*.verifier_id'   => 'nullable|exists:users,id',
        ]);

        // A verifier can only staff one lane per session at a time — same
        // one-lane-per-session rule assignVerifier() enforces when editing
        // an existing lane, applied here too since lanes can now be given
        // a verifier right at schedule-creation time. Scoped to the same
        // claiming_date + batch (morning/afternoon), since the same
        // verifier can legitimately run one lane in the morning and
        // another in the afternoon, or a lane on a different day.
        $duplicateVerifierId = collect($request->lanes)
            ->filter(fn ($lane) => !empty($lane['verifier_id']))
            ->groupBy(fn ($lane) => $lane['claiming_date'] . '|' . $lane['batch'])
            ->flatMap(fn ($group) => collect($group)->pluck('verifier_id')->duplicates())
            ->first();
        if ($duplicateVerifierId) {
            return response()->json([
                'message' => 'Each verifier can only be assigned to one lane. Please fix the duplicate verifier assignment before saving.',
            ], 400);
        }

        $config = ApplicationConfiguration::where('is_active', true)->first();
        if (!$config) {
            return response()->json(['message' => 'No active application period.'], 404);
        }

        // Claiming can never happen while applications are still being
        // accepted, or exactly on the day submissions close (verifiers
        // still need time to review whatever came in right at the
        // deadline before anyone can be scheduled to claim) — so every
        // lane's claiming_date must fall strictly AFTER the application
        // period's close_date. This also rules out a claiming date
        // landing "in the middle" of the application period, since
        // anything on or before close_date is inside (or before) the
        // period by definition.
        $closeDate = \Carbon\Carbon::parse($config->close_date)->startOfDay();
        $invalidLane = collect($request->lanes)->first(function ($lane) use ($closeDate) {
            return \Carbon\Carbon::parse($lane['claiming_date'])->startOfDay()->lte($closeDate);
        });
        if ($invalidLane) {
            return response()->json([
                'message' => "Claiming dates must be after the application period's closing date ({$closeDate->toDateString()}). \"{$invalidLane['lane_name']}\" is scheduled on {$invalidLane['claiming_date']}, which is on or before that.",
            ], 400);
        }

        // Late Claiming is for people who missed THEIR claiming day and
        // are being given one more chance — it only makes sense once
        // every scheduled claiming day has actually happened. If it were
        // allowed to start before or during the claiming days, someone
        // could show up during "Late Claiming" for a lane that hasn't
        // even had its real claiming day yet, which breaks the eligibility
        // logic in LateClaimingEligibility (it assumes every original
        // lane's date is already in the past by the time Late Claiming
        // opens — see CLAIMING_RULES.md).
        $latestClaimingDate = collect($request->lanes)
            ->map(fn ($lane) => \Carbon\Carbon::parse($lane['claiming_date'])->startOfDay())
            ->max();

        if ($request->late_claiming_date) {
            $lateClaimingStart = \Carbon\Carbon::parse($request->late_claiming_date)->startOfDay();
            if ($lateClaimingStart->lte($latestClaimingDate)) {
                return response()->json([
                    'message' => "Late Claiming must start after every claiming date. The latest claiming date entered is {$latestClaimingDate->toDateString()}, but Late Claiming is set to start {$lateClaimingStart->toDateString()}.",
                ], 400);
            }
        }

        $schedule = ClaimingSchedule::where('config_id', $config->id)->latest()->first();
        if ($schedule && $schedule->is_active) {
            return response()->json(['message' => 'Schedule already active and cannot be edited. Applicants are being assigned to it in real time.'], 400);
        }

        if (!$schedule) {
            $schedule = new ClaimingSchedule(['config_id' => $config->id]);
        }

        $schedule->fill($request->only([
            'location', 'morning_start', 'morning_end',
            'afternoon_start', 'afternoon_end',
            'late_claiming_date', 'late_claiming_end_date',
        ]));
        $schedule->save();

        $schedule->lanes()->delete();
        foreach ($request->lanes as $lane) {
            $schedule->lanes()->create($lane);
        }

        $schedule->load(['lanes' => function ($q) {
            $q->withCount('assignments')
                ->with('verifier:id,first_name,last_name')
                ->with('requestedVerifier:id,first_name,last_name')
                ->with('assignments.application:id,control_number');
        }]);
        $schedule->lanes->each->append('control_number_range');

        return response()->json([
            'message'  => 'Schedule saved.',
            'schedule' => $schedule,
        ]);
    }

    /**
     * Activates a schedule: from this point on, VerifierController::approve()
     * assigns each newly-approved applicant straight onto the first lane
     * that still has room, notifying them immediately — no more waiting
     * for a bulk "publish everyone at once" step. Once active, lane
     * setup is locked (store() blocks edits) since applicants are being
     * actively assigned against it.
     *
     * Also runs a one-time catch-up pass for anyone already approved
     * before this schedule existed or went active — otherwise those
     * applicants would have no assignment and no path to get one.
     */
    public function activate(Request $request, $id)
    {
        $schedule = ClaimingSchedule::with('lanes')->findOrFail($id);

        if ($schedule->is_active) {
            return response()->json(['message' => 'Schedule already active.'], 400);
        }

        $lanes = $schedule->lanes()->orderBy('claiming_date')->orderBy('id')->get();
        if ($lanes->isEmpty()) {
            return response()->json(['message' => 'Please add at least one lane before activating.'], 400);
        }

        $schedule->update([
            'is_active'    => true,
            'activated_at' => now(),
        ]);

        $assignedCount = ClaimingAssignmentService::assignPendingApprovals($schedule);

        $message = $assignedCount > 0
            ? "Schedule activated. {$assignedCount} already-approved applicant(s) assigned and notified. New approvals will now be assigned automatically."
            : "Schedule activated. New approvals will now be assigned automatically.";

        $schedule->load(['lanes' => function ($q) {
            $q->withCount('assignments')
                ->with('verifier:id,first_name,last_name')
                ->with('requestedVerifier:id,first_name,last_name')
                ->with('assignments.application:id,control_number');
        }]);
        $schedule->lanes->each->append('control_number_range');

        return response()->json([
            'message'  => $message,
            'schedule' => $schedule,
        ]);
    }

    /**
     * Lets an admin adjust the Late Claiming window on an ALREADY-ACTIVE
     * schedule, which store() otherwise blocks entirely (it fully
     * replaces the lane list, which is unsafe once real assignments
     * exist). Late Claiming itself has no such conflict — nothing reads
     * or depends on its dates until Late Claiming actually opens — so
     * it's safe to keep editable right up to that point, then locked:
     * once it's started, LateClaimingEligibility and the
     * claiming:sweep-unclaimed command both assume its start date is
     * stable, since retries/promotions may already be sitting on it.
     */
    public function updateLateClaiming(Request $request, $id)
    {
        $request->validate([
            'late_claiming_date'     => 'nullable|date',
            'late_claiming_end_date' => 'nullable|date|after_or_equal:late_claiming_date',
        ]);

        $schedule = ClaimingSchedule::with('lanes')->findOrFail($id);

        if ($schedule->late_claiming_date
            && \Carbon\Carbon::parse($schedule->late_claiming_date)->startOfDay()->lte(now()->startOfDay())) {
            return response()->json([
                'message' => 'Late Claiming has already started and its window can no longer be changed.',
            ], 400);
        }

        // Same rule store() enforces at creation time — Late Claiming
        // must start after every scheduled claiming day, since
        // LateClaimingEligibility assumes every original lane's date is
        // already in the past by the time it opens.
        if ($request->late_claiming_date && $schedule->lanes->isNotEmpty()) {
            $latestClaimingDate = $schedule->lanes
                ->map(fn ($lane) => \Carbon\Carbon::parse($lane->claiming_date)->startOfDay())
                ->max();
            $lateClaimingStart = \Carbon\Carbon::parse($request->late_claiming_date)->startOfDay();

            if ($lateClaimingStart->lte($latestClaimingDate)) {
                return response()->json([
                    'message' => "Late Claiming must start after every claiming date. The latest claiming date is {$latestClaimingDate->toDateString()}, but Late Claiming is set to start {$lateClaimingStart->toDateString()}.",
                ], 400);
            }
        }

        $schedule->update($request->only(['late_claiming_date', 'late_claiming_end_date']));

        $schedule->load(['lanes' => function ($q) {
            $q->withCount('assignments')
                ->with('verifier:id,first_name,last_name')
                ->with('requestedVerifier:id,first_name,last_name')
                ->with('assignments.application:id,control_number');
        }]);
        $schedule->lanes->each->append('control_number_range');

        return response()->json([
            'message'  => 'Late Claiming window updated.',
            'schedule' => $schedule,
        ]);
    }

    public function printableLane($laneId)
    {
        $lane = ClaimingLane::with(['assignments.application.user', 'verifier:id,first_name,last_name'])->findOrFail($laneId);
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
            'verifier_name' => $lane->verifier ? trim($lane->verifier->first_name . ' ' . $lane->verifier->last_name) : 'Unassigned',
            'applicants'    => $list,
        ]);
    }

    /**
     * Admin sets (or clears, if verifier_id is null) which verifier is
     * assigned to a specific lane. Editable at any time — not gated by
     * is_active, since staffing can change on the day itself.
     */
    public function assignVerifier(Request $request, $laneId)
    {
        $request->validate([
            'verifier_id' => 'nullable|exists:users,id',
        ]);

        $lane = ClaimingLane::findOrFail($laneId);

        // Enforce one lane per verifier per session — same constraint
        // selfAssignLane() already applies on the verifier side. Without
        // this, an admin could put the same person on two lanes at once,
        // which doesn't make sense physically (they can't be in two
        // places at the same claiming session). Scoped to the same
        // claiming_date + batch, since the same verifier can legitimately
        // run a morning lane and an afternoon lane, or lanes on different
        // days.
        if ($request->verifier_id) {
            ClaimingLane::where('claiming_schedule_id', $lane->claiming_schedule_id)
                ->where('claiming_date', $lane->claiming_date)
                ->where('batch', $lane->batch)
                ->where('verifier_id', $request->verifier_id)
                ->where('id', '!=', $lane->id)
                ->update(['verifier_id' => null]);
        }

        // Setting it manually here always supersedes any pending
        // self-assign request on this lane, whether this happens to match
        // what was requested (i.e. approving it) or not.
        $lane->update(['verifier_id' => $request->verifier_id, 'requested_verifier_id' => null]);

        return response()->json([
            'message' => $request->verifier_id
                ? 'Verifier assigned to lane.'
                : 'Verifier unassigned from lane.',
            'lane' => $lane->load('verifier:id,first_name,last_name'),
        ]);
    }

    /**
     * Admin dismisses a verifier's pending request to take over a lane
     * (see VerifierController::selfAssignLane()) without assigning
     * anyone — the lane's current verifier, if any, is left untouched.
     */
    public function dismissLaneRequest($laneId)
    {
        $lane = ClaimingLane::findOrFail($laneId);
        $lane->update(['requested_verifier_id' => null]);

        return response()->json([
            'message' => 'Request dismissed.',
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
        $lane = ClaimingLane::with(['assignments.application.user', 'verifier:id,first_name,last_name'])->findOrFail($laneId);
        $list = $lane->assignments
            ->map(function ($a) {
                return [
                    'control_number' => $a->application->control_number,
                    'name'           => trim($a->application->user->first_name . ' ' . $a->application->user->last_name),
                ];
            })
            ->sortBy('control_number')
            ->values();

            // SK prints these physically for the verifier running that lane
            // to use on claiming day — the verifier's name needs to be ON
            // the sheet itself so it's identifiable once printed, not just
            // visible in the admin UI beforehand.
            $pdf = Pdf::loadView('claiming.lane-claiming-list', [
                'title'        => $lane->lane_name . ' — Claiming List',
                'batch'        => $lane->batch,
                'claimingDate' => $lane->claiming_date,
                'verifierName' => $lane->verifier ? trim($lane->verifier->first_name . ' ' . $lane->verifier->last_name) : 'Unassigned',
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
     *    the time Late Claiming ended. Not a rejection.
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
            ->where('is_active', true)
            ->latest()
            ->first();

        if ($schedule && $schedule->late_claiming_end_date && now()->lt($schedule->late_claiming_end_date)) {
            return response()->json([
                'message' => 'Cannot close this period until Late Claiming has ended (' . $schedule->late_claiming_end_date . ').',
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