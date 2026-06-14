<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\SkEvent;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

class SkEventController extends Controller
{
    // Public

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

    // Admin

    public function adminIndex()
    {
        return response()->json(SkEvent::orderBy('event_date', 'desc')->get());
    }

    public function store(Request $request)
    {
        $request->validate([
            'title'       => 'required|string|max:255',
            'description' => 'nullable|string',
            'event_date'  => 'required|date',
            'event_time'  => 'nullable',
            'venue'       => 'nullable|string',
            'image'       => 'nullable|image|max:5120',
        ]);

        $imagePath = null;
        if ($request->hasFile('image')) {
            $imagePath = $request->file('image')->store('events', 'public');
        }

        $event = SkEvent::create([
            'title'        => $request->title,
            'description'  => $request->description,
            'event_date'   => $request->event_date,
            'event_time'   => $request->event_time ?: null,
            'venue'        => $request->venue,
            'image_path'   => $imagePath,
            'is_published' => true,
            'posted_by'    => $request->user()->id,
        ]);

        return response()->json(['message' => 'Event created.', 'event' => $event], 201);
    }

    public function update(Request $request, $id)
    {
        $event = SkEvent::findOrFail($id);

        $request->validate([
            'title'       => 'required|string|max:255',
            'description' => 'nullable|string',
            'event_date'  => 'required|date',
            'event_time'  => 'nullable',
            'venue'       => 'nullable|string',
            'image'       => 'nullable|image|max:5120',
        ]);

        $data = [
            'title'       => $request->title,
            'description' => $request->description,
            'event_date'  => $request->event_date,
            'event_time'  => $request->event_time ?: null,
            'venue'       => $request->venue,
        ];

        if ($request->hasFile('image')) {
            if ($event->image_path) {
                Storage::disk('public')->delete($event->image_path);
            }
            $data['image_path'] = $request->file('image')->store('events', 'public');
        }

        $event->update($data);

        return response()->json(['message' => 'Event updated.', 'event' => $event]);
    }

    public function destroy($id)
    {
        $event = SkEvent::findOrFail($id);

        if ($event->image_path) {
            Storage::disk('public')->delete($event->image_path);
        }

        $event->delete();

        return response()->json(['message' => 'Event deleted.']);
    }
}