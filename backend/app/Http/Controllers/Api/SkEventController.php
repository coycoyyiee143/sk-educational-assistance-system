<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\SkEvent;

class SkEventController extends Controller
{
    public function index()
    {
        $events = SkEvent::where('is_published', true)
            ->orderBy('event_date')
            ->get();

        return response()->json($events);
    }

    public function show($id)
    {
        $event = SkEvent::where('id', $id)
            ->where('is_published', true)
            ->firstOrFail();

        return response()->json($event);
    }
}