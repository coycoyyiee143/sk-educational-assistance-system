<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Application;
use App\Models\ApplicationDocument;
use App\Jobs\ProcessOcrDocument;
use Illuminate\Http\Request;

class DocumentController extends Controller
{
    public function index(Request $request, $id)
    {
        $application = Application::where('id', $id)
            ->where('user_id', $request->user()->id)
            ->firstOrFail();

        return response()->json($application->documents);
    }

    public function upload(Request $request, $id)
    {
        $request->validate([
            'document_type' => 'required|in:voters_certificate,registration_form,school_id',
            'file'          => 'required|file|mimes:jpg,jpeg,png,pdf|max:5120',
        ]);

        $application = Application::where('id', $id)
            ->where('user_id', $request->user()->id)
            ->with(['user.profile', 'configuration'])
            ->firstOrFail();

        $file     = $request->file('file');
        $fileName = time() . '_' . $file->getClientOriginalName();
        $path     = $file->storeAs(
            "documents/{$application->id}",
            $fileName,
            'public'
        );

        $document = ApplicationDocument::create([
            'application_id' => $application->id,
            'document_type'  => $request->document_type,
            'file_path'      => $path,
            'file_name'      => $fileName,
            'mime_type'      => $file->getMimeType(),
            'version'        => 1,
            'status'         => 'processing',
        ]);

        // Dispatch async OCR job with stored file path
        ProcessOcrDocument::dispatch($application, $document, $path);

        return response()->json([
            'message'  => 'Document uploaded and queued for processing.',
            'document' => $document->fresh(),
        ], 201);
    }

    public function reupload(Request $request, $id, $docId)
    {
        $request->validate([
            'file' => 'required|file|mimes:jpg,jpeg,png,pdf|max:5120',
        ]);

        $application = Application::where('id', $id)
            ->where('user_id', $request->user()->id)
            ->with(['user.profile', 'configuration'])
            ->firstOrFail();

        $oldDocument = ApplicationDocument::where('id', $docId)
            ->where('application_id', $application->id)
            ->firstOrFail();

        $file     = $request->file('file');
        $fileName = time() . '_' . $file->getClientOriginalName();
        $path     = $file->storeAs(
            "documents/{$application->id}",
            $fileName,
            'public'
        );

        $newDocument = ApplicationDocument::create([
            'application_id' => $application->id,
            'document_type'  => $oldDocument->document_type,
            'file_path'      => $path,
            'file_name'      => $fileName,
            'mime_type'      => $file->getMimeType(),
            'version'        => $oldDocument->version + 1,
            'status'         => 'processing',
        ]);

        // Dispatch async OCR job with stored file path
        ProcessOcrDocument::dispatch($application, $newDocument, $path);

        return response()->json([
            'message'  => 'Document re-uploaded and queued for processing.',
            'document' => $newDocument->fresh(),
        ], 201);
    }
}
