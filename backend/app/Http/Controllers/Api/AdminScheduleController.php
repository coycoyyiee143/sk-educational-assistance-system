<?php
namespace App\Http\Controllers\Api;
use App\Http\Controllers\Controller;
use App\Models\Application;
use App\Models\ApplicationConfiguration;
use App\Models\ClaimingSchedule;
use App\Models\ClaimingLane;
use App\Models\ClaimingAssignment;
use App\Notifications\ClaimingScheduleNotification;
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
                        'claim_status'         => 'pending',
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
}