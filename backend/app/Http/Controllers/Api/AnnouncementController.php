<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Announcement;

class AnnouncementController extends Controller
{
    public function index()
    {
        $announcements = Announcement::where('is_published', true)
            ->latest('published_at')
            ->get();

        return response()->json($announcements);
    }

    public function show($id)
    {
        $announcement = Announcement::where('id', $id)
            ->where('is_published', true)
            ->firstOrFail();

        return response()->json($announcement);
    }
}