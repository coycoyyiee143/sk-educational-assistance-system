<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Announcement;
use Illuminate\Http\Request;

class AnnouncementController extends Controller
{
    // Public

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

    // Admin

    public function adminIndex()
    {
        return response()->json(Announcement::latest('published_at')->get());
    }

    public function store(Request $request)
    {
        $request->validate([
            'title'    => 'required|string|max:255',
            'content'  => 'required|string',
            'category' => 'nullable|string',
        ]);

        // Posting date is now auto-timestamped at the moment of submission,
        // matching the real-world workflow where SK admins post announcements
        // immediately rather than scheduling them for a future date.
        $announcement = Announcement::create([
            'title'        => $request->title,
            'content'      => $request->content,
            'category'     => $request->category,
            'is_published' => true,
            'posted_by'    => $request->user()->id,
            'published_at' => now(),
        ]);

        return response()->json([
            'message'      => 'Announcement posted.',
            'announcement' => $announcement,
        ], 201);
    }

    public function update(Request $request, $id)
    {
        $announcement = Announcement::findOrFail($id);

        $request->validate([
            'title'    => 'required|string|max:255',
            'content'  => 'required|string',
            'category' => 'nullable|string',
        ]);

        // published_at is intentionally NOT updated here — editing an
        // announcement's content should not change its original posting date.
        $announcement->update([
            'title'    => $request->title,
            'content'  => $request->content,
            'category' => $request->category,
        ]);

        return response()->json([
            'message'      => 'Announcement updated.',
            'announcement' => $announcement,
        ]);
}

    public function destroy($id)
    {
        Announcement::findOrFail($id)->delete();

        return response()->json(['message' => 'Announcement deleted.']);
    }
}