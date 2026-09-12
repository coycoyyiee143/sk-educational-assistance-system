<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ApplicationConfiguration;
use Illuminate\Http\Request;

class ApplicationConfigurationController extends Controller
{
    public function active()
    {
        $config = ApplicationConfiguration::where('is_active', true)->first();

        if (!$config) {
            return response()->json(['message' => 'No active application period.'], 404);
        }

        return response()->json($config);
    }

    public function store(Request $request)
    {
        $request->validate([
            'school_year'        => ['required', 'string', 'regex:/^\d{4}-\d{4}$/'],
            'open_date'          => 'required|date',
            'close_date'         => 'required|date|after:open_date',
            'is_unlimited'       => 'boolean',
            'slot_limit'         => 'required_if:is_unlimited,false|nullable|integer|min:1',
            'assistance_amount'  => 'required|integer|min:0',
        ]);

        ApplicationConfiguration::where('is_active', true)->update(['is_active' => false]);

        $isUnlimited = $request->boolean('is_unlimited');

        $config = ApplicationConfiguration::create([
            'school_year'        => $request->school_year,
            'open_date'          => $request->open_date,
            'close_date'         => $request->close_date,
            'is_unlimited'       => $isUnlimited,
            'slot_limit'         => $isUnlimited ? null : $request->slot_limit,
            'slots_filled'       => 0,
            'assistance_amount'  => $request->assistance_amount,
            'is_active'          => true,
            'created_by'         => $request->user()->id,
        ]);

        return response()->json([
            'message' => 'Application period activated.',
            'config'  => $config,
        ], 201);
    }

    public function index()
    {
        return response()->json(ApplicationConfiguration::orderBy('created_at', 'desc')->get());
    }

    public function update(Request $request, $id)
    {
        $config = ApplicationConfiguration::findOrFail($id);

        $data = $request->validate([
            // Same format guarantee as store() above — see that comment
            // for why this matters beyond just input tidiness.
            'school_year'        => ['required', 'string', 'regex:/^\d{4}-\d{4}$/'],
            'open_date'          => 'required|date',
            'close_date'         => 'required|date|after:open_date',
            'is_unlimited'       => 'boolean',
            'slot_limit'         => 'required_if:is_unlimited,false|nullable|integer|min:1',
            'assistance_amount'  => 'required|integer|min:0',
            'is_active'          => 'boolean',
        ]);

        // close_date is NOT editable through this general-purpose form,
        // ever — regardless of whether the period has started. Extending
        // a deadline is a deliberate, distinct admin action with its own
        // audit trail (see extend() below), not something that should be
        // silently bundled in with an unrelated edit to, say, the
        // assistance amount. If the submitted value doesn't match what's
        // already on record, reject the whole request rather than
        // quietly ignoring just that one field — better to surface the
        // mismatch than let the admin think their intended change didn't
        // take effect for an unexplained reason.
        if (!\Carbon\Carbon::parse($data['close_date'])->eq(\Carbon\Carbon::parse($config->close_date))) {
            return response()->json([
                'message' => 'Closing Date can only be changed using the "Extend Application Period" action, not through this form.',
                'locked_fields' => ['close_date'],
            ], 400);
        }

        $data['is_unlimited'] = $request->boolean('is_unlimited');

        if ($data['is_unlimited']) {
            $data['slot_limit'] = null;
        }

        // Once the application period has started (opening date has passed),
        // parameters that affect applicant eligibility, slot counting, or
        // the stated assistance amount can no longer be changed — this
        // protects data integrity for anyone who has already applied under
        // the original terms.
        $hasStarted = now()->gte($config->open_date);

        if ($hasStarted) {
            $lockedFields = [];

            if ($data['school_year'] !== $config->school_year) {
                $lockedFields[] = 'school_year';
            }
            if (!\Carbon\Carbon::parse($data['open_date'])->eq(\Carbon\Carbon::parse($config->open_date))) {
                $lockedFields[] = 'open_date';
            }
            if ($data['is_unlimited'] !== (bool) $config->is_unlimited) {
                $lockedFields[] = 'is_unlimited';
            }
            if (!$data['is_unlimited'] && (int) $data['slot_limit'] !== (int) $config->slot_limit) {
                $lockedFields[] = 'slot_limit';
            }
            if ((int) $data['assistance_amount'] !== (int) $config->assistance_amount) {
                $lockedFields[] = 'assistance_amount';
            }

            if (!empty($lockedFields)) {
                return response()->json([
                    'message' => 'This application period has already started. School year, opening date, slot limit, slot type (unlimited/limited), and assistance amount can no longer be changed once the period is open.',
                    'locked_fields' => $lockedFields,
                ], 400);
            }
        }

        if (!empty($data['is_active']) && $data['is_active']) {
            ApplicationConfiguration::where('id', '!=', $id)->update(['is_active' => false]);
        }

        $config->update($data);

        return response()->json(['message' => 'Configuration updated.', 'config' => $config]);
    }

    /**
     * The ONLY way to change close_date. Deliberately separate from
     * update() so extending a deadline is its own explicit, auditable
     * action — not a side effect of an unrelated settings edit. Can only
     * move the date LATER (never earlier — shortening a deadline that
     * applicants are already relying on is a different, more disruptive
     * action this endpoint doesn't attempt to handle) and only while the
     * period isn't closed yet (closePeriod() is the deliberate opposite
     * action — a closed period stays closed).
     */
    public function extend(Request $request, $id)
    {
        $config = ApplicationConfiguration::findOrFail($id);

        if ($config->closed_at) {
            return response()->json([
                'message' => 'This period is already closed and cannot be extended. Start a new application period instead.',
            ], 400);
        }

        $data = $request->validate([
            'close_date' => 'required|date|after:' . $config->close_date,
        ]);

        // The whole point of AdminScheduleController::store()'s validation
        // is that no claiming date (or grace period date) is ever allowed
        // to fall on/before the application period's close_date. Extending
        // close_date forward could silently violate that invariant for a
        // schedule that was already set up under the OLD close_date — so
        // check for that here and block the extension rather than let a
        // previously-valid schedule become invalid without anyone
        // noticing. This applies whether the schedule is still a draft
        // or already active (applicants possibly already assigned) —
        // either way, the admin needs to consciously resolve the
        // conflict (reschedule the lanes/grace period, or pick a less
        // aggressive extension) rather than have it happen as a side
        // effect of extending the deadline.
        $newCloseDate = \Carbon\Carbon::parse($data['close_date'])->startOfDay();
        $schedule = \App\Models\ClaimingSchedule::with('lanes')
            ->where('config_id', $config->id)
            ->latest()
            ->first();

        if ($schedule) {
            $conflictingLane = $schedule->lanes
                ->where('lane_name', '!=', 'Grace Period Claiming')
                ->first(fn ($lane) => \Carbon\Carbon::parse($lane->claiming_date)->startOfDay()->lte($newCloseDate));

            if ($conflictingLane) {
                return response()->json([
                    'message' => "Can't extend to {$newCloseDate->toDateString()} — lane \"{$conflictingLane->lane_name}\" is already scheduled to claim on {$conflictingLane->claiming_date}, which would then fall on or before the new closing date. Reschedule or remove that lane first, or choose a shorter extension.",
                ], 400);
            }

            if ($schedule->grace_period_date && \Carbon\Carbon::parse($schedule->grace_period_date)->startOfDay()->lte($newCloseDate)) {
                return response()->json([
                    'message' => "Can't extend to {$newCloseDate->toDateString()} — Grace Period is already scheduled to start on {$schedule->grace_period_date}, which would then fall on or before the new closing date. Adjust the grace period dates first, or choose a shorter extension.",
                ], 400);
            }
        }

        $previousCloseDate = $config->close_date;
        $config->update(['close_date' => $data['close_date']]);

        \App\Models\AuditLog::record(
            'application_period_extended',
            $config,
            "Extended application period #{$config->id} closing date from {$previousCloseDate} to {$data['close_date']}"
        );

        return response()->json([
            'message' => 'Application period extended.',
            'config'  => $config,
        ]);
    }
}