<?php

namespace App\Console\Commands;

use App\Models\User;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Storage;

/**
 * Undoes OcrTestSeeder — deletes every OCR test applicant
 * (email ocrtest*@sample.test), which cascades away their
 * student_profiles, applications, and application_documents rows
 * (see the users/student_profiles/applications/application_documents
 * migrations' onDelete('cascade')). Also removes each application's
 * uploaded-file folder under storage/app/documents/{id}, since that's
 * plain disk storage and isn't touched by the DB cascade.
 *
 * Run this before re-seeding a batch you want to redo, or to fully
 * clear out OCR test data without touching anything else in the DB.
 */
class ResetOcrSamples extends Command
{
    protected $signature = 'ocr:reset-samples';

    protected $description = 'Delete all OcrTestSeeder test applicants, applications, and their uploaded document files';

    public function handle(): int
    {
        $users = User::where('email', 'like', 'ocrtest%@sample.test')
            ->with('applications')
            ->get();

        if ($users->isEmpty()) {
            $this->info('No OCR test applicants found — nothing to reset.');
            return self::SUCCESS;
        }

        foreach ($users as $user) {
            foreach ($user->applications as $application) {
                Storage::disk('local')->deleteDirectory("documents/{$application->id}");
            }
        }

        $count = $users->count();
        User::whereIn('id', $users->pluck('id'))->delete();

        $this->info("Deleted {$count} OCR test applicant(s), their applications, documents, and uploaded files.");

        return self::SUCCESS;
    }
}
