<?php

namespace App\Console\Commands;

use App\Jobs\ProcessOcrDocument;
use App\Models\ApplicationDocument;
use Illuminate\Console\Command;

/**
 * Scheduled safety net for OCR failures that are almost always transient —
 * the OCR service being briefly down/restarting, or momentarily congested
 * under concurrent load (see DEPLOYMENT.md's single-gunicorn-worker note) —
 * rather than a genuinely broken document. Previously a verifier had to
 * notice the failure themselves and click "Retry OCR" by hand.
 *
 * Deliberately conservative:
 *  - Only picks up documents that have been sitting 'failed' for at least
 *    5 minutes, so it never races a verifier's own manual retry or a job
 *    that's still mid-flight.
 *  - Caps attempts at MAX_AUTO_RETRIES per document (via ocr_retry_count)
 *    so a document that's failing because it's genuinely corrupt/unreadable
 *    doesn't get re-queued forever — after that, it's left failed for a
 *    human to look at and manually retry or ask for a re-upload.
 */
class RetryFailedOcrDocuments extends Command
{
    private const MAX_AUTO_RETRIES = 3;

    protected $signature = 'ocr:retry-failed';

    protected $description = 'Automatically re-queues OCR-failed documents that have not exceeded the auto-retry limit.';

    public function handle(): int
    {
        $candidates = ApplicationDocument::with('application')
            ->where('status', 'failed')
            ->where('ocr_retry_count', '<', self::MAX_AUTO_RETRIES)
            ->where('updated_at', '<=', now()->subMinutes(5))
            ->get();

        if ($candidates->isEmpty()) {
            $this->info('No failed OCR documents eligible for auto-retry.');
            return self::SUCCESS;
        }

        foreach ($candidates as $document) {
            // application can be missing only if the applicant's account/
            // application was deleted after the document failed — nothing
            // to retry against in that case.
            if (!$document->application) {
                continue;
            }

            $document->increment('ocr_retry_count');
            $document->update(['status' => 'pending']);

            ProcessOcrDocument::dispatch(
                $document->application,
                $document,
                $document->file_path
            );
        }

        $this->info("Auto-retried {$candidates->count()} failed OCR document(s).");

        return self::SUCCESS;
    }
}
