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
            'total_slots'  => 'required|integer|min:1',
        ]);

        // Deactivate any existing active config
        ApplicationConfiguration::where('is_active', true)->update(['is_active' => false]);

        $config = ApplicationConfiguration::create([
            'school_year'  => $request->school_year,
            'semester'     => $request->semester,
            'open_date'    => $request->open_date,
            'close_date'   => $request->close_date,
            'total_slots'  => $request->total_slots,
            'used_slots'   => 0,
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
            'school_year' => 'required|string',
            'semester'    => 'required|string',
            'open_date'   => 'required|date',
            'close_date'  => 'required|date',
            'total_slots' => 'required|integer|min:1',
            'is_active'   => 'boolean',
        ]);

        // If setting active, deactivate others
        if (!empty($data['is_active']) && $data['is_active']) {
            ApplicationConfiguration::where('id', '!=', $id)->update(['is_active' => false]);
        }

        $config->update($data);

        return response()->json(['message' => 'Configuration updated.', 'config' => $config]);
    }
}