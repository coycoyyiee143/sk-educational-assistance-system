<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Application;
use App\Models\ApplicationConfiguration;
use App\Models\ClaimingSchedule;
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
            'location'                     => 'required|string',
            'morning_start'                => 'nullable',
            'morning_end'                  => 'nullable',
            'afternoon_start'               => 'nullable',
            'afternoon_end'                 => 'nullable',
            'grace_period_date'             => 'nullable|date',
            'lanes'                          => 'required|array|min:1',
            'lanes.*.lane_name'              => 'required|string',
            'lanes.*.control_number_from'    => 'required|string',
            'lanes.*.control_number_to'      => 'required|string',
            'lanes.*.batch'                   => 'required|in:morning,afternoon',
            'lanes.*.claiming_date'           => 'required|date',
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
            'afternoon_start', 'afternoon_end', 'grace_period_date',
        ]));
        $schedule->save();

        // Replace lanes wholesale (draft schedule only)
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
            ->get();

        $assignedCount = 0;

        foreach ($applications as $app) {
            // SK-2026-0042 -> 0042 -> 42
            $parts       = explode('-', $app->control_number);
            $numericPart = (int) end($parts);

            $lane = $schedule->lanes->first(function ($l) use ($numericPart) {
                return $numericPart >= (int) $l->control_number_from
                    && $numericPart <= (int) $l->control_number_to;
            });

            if (!$lane) continue;

            ClaimingAssignment::updateOrCreate(
                ['application_id' => $app->id],
                [
                    'claiming_schedule_id' => $schedule->id,
                    'claiming_lane_id'     => $lane->id,
                    'claim_status'         => 'pending',
                ]
            );

            $assignedCount++;

            $app->user->notify(new ClaimingScheduleNotification($app, $lane, $schedule));
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
}