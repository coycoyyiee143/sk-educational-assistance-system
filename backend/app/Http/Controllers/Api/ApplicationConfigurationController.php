<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ApplicationConfiguration;

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
}