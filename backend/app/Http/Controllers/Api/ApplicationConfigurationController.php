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
            'school_year'  => 'required|string',
            'open_date'    => 'required|date',
            'close_date'   => 'required|date|after:open_date',
            'is_unlimited' => 'boolean',
            'slot_limit'   => 'required_if:is_unlimited,false|nullable|integer|min:1',
        ]);

        ApplicationConfiguration::where('is_active', true)->update(['is_active' => false]);

        $isUnlimited = $request->boolean('is_unlimited');

        $config = ApplicationConfiguration::create([
            'school_year'  => $request->school_year,
            'open_date'    => $request->open_date,
            'close_date'   => $request->close_date,
            'is_unlimited' => $isUnlimited,
            'slot_limit'   => $isUnlimited ? null : $request->slot_limit,
            'slots_filled' => 0,
            'is_active'    => true,
            'created_by'   => $request->user()->id,
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
            'school_year'  => 'required|string',
            'open_date'    => 'required|date',
            'close_date'   => 'required|date|after:open_date',
            'is_unlimited' => 'boolean',
            'slot_limit'   => 'required_if:is_unlimited,false|nullable|integer|min:1',
            'is_active'    => 'boolean',
        ]);
    
        $data['is_unlimited'] = $request->boolean('is_unlimited');
    
        if ($data['is_unlimited']) {
            $data['slot_limit'] = null;
        }
    
        // Once the application period has started (opening date has passed),
        // parameters that affect applicant eligibility or slot counting can no
        // longer be changed — this protects data integrity for anyone who has
        // already applied under the original terms. close_date and is_active
        // remain editable at any time (extending a deadline or closing the
        // period early are both legitimate admin actions mid-period).
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
    
            if (!empty($lockedFields)) {
                return response()->json([
                    'message' => 'This application period has already started. School year, opening date, slot limit, and slot type (unlimited/limited) can no longer be changed once the period is open.',
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
}