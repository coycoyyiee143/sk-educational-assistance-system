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
            'semester'     => 'required|string',
            'open_date'    => 'required|date',
            'close_date'   => 'required|date',
            'is_unlimited' => 'boolean',
            'slot_limit'   => 'required_if:is_unlimited,false|nullable|integer|min:1',
        ]);

        // Deactivate any existing active config
        ApplicationConfiguration::where('is_active', true)->update(['is_active' => false]);

        $isUnlimited = $request->boolean('is_unlimited');

        $config = ApplicationConfiguration::create([
            'school_year'  => $request->school_year,
            'semester'     => $request->semester,
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
            'semester'     => 'required|string',
            'open_date'    => 'required|date',
            'close_date'   => 'required|date',
            'is_unlimited' => 'boolean',
            'slot_limit'   => 'required_if:is_unlimited,false|nullable|integer|min:1',
            'is_active'    => 'boolean',
        ]);

        $data['is_unlimited'] = $request->boolean('is_unlimited');

        if ($data['is_unlimited']) {
            $data['slot_limit'] = null;
        }

        // If setting active, deactivate others
        if (!empty($data['is_active']) && $data['is_active']) {
            ApplicationConfiguration::where('id', '!=', $id)->update(['is_active' => false]);
        }

        $config->update($data);

        return response()->json(['message' => 'Configuration updated.', 'config' => $config]);
    }
}