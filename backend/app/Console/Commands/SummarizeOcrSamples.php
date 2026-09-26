<?php

namespace App\Console\Commands;

use App\Models\ApplicationDocument;
use Illuminate\Console\Command;

/**
 * Quick pass/fail readout for the applications OcrTestSeeder
 * created (email ocrtest*@sample.test), without opening each one
 * in the Verifier Review UI. A document "PASSED" here means every
 * VerificationCheck row on it has passed=true — matches the workbook's
 * "System Result = Eligible if the relevant checks passed" rule.
 */
class SummarizeOcrSamples extends Command
{
    protected $signature = 'ocr:sample-summary {type=registration_form : registration_form, school_id, voters_certificate, or all}';

    protected $description = 'Print pass/fail status for OCR test documents seeded by OcrTestSeeder';

    public function handle(): int
    {
        $type = $this->argument('type');
        $validTypes = ['registration_form', 'school_id', 'voters_certificate', 'all'];
        if (!in_array($type, $validTypes, true)) {
            $this->error("Invalid type '{$type}' — must be one of: ".implode(', ', $validTypes));
            return self::FAILURE;
        }

        $query = ApplicationDocument::query()
            ->whereHas('application.user', fn ($q) => $q->where('email', 'like', 'ocrtest%@sample.test'))
            ->with(['application.user', 'verificationChecks'])
            ->orderBy('application_id');

        if ($type !== 'all') {
            $query->where('document_type', $type);
        }

        $documents = $query->get();

        if ($documents->isEmpty()) {
            $this->info("No {$type} documents found among OCR test applicants — nothing seeded yet, or already reset.");
            return self::SUCCESS;
        }

        $rows = [];
        $passed = 0;
        $flagged = 0;
        $notReady = 0;

        foreach ($documents as $doc) {
            $applicant = $doc->application?->user;
            $name = $applicant ? "{$applicant->first_name} {$applicant->last_name}" : '(unknown)';

            if ($doc->status !== 'processed') {
                $verdict = strtoupper($doc->status);
                $notReady++;
                $detail = '-';
            } else {
                $failedChecks = $doc->verificationChecks->where('passed', false);
                if ($failedChecks->isEmpty()) {
                    $verdict = 'PASSED';
                    $passed++;
                    $detail = '-';
                } else {
                    $verdict = 'FLAGGED';
                    $flagged++;
                    $detail = $failedChecks->pluck('check_name')->implode(', ');
                }
            }

            $rows[] = [
                'App #' . $doc->application_id,
                $name,
                $doc->document_type,
                $verdict,
                $detail,
            ];
        }

        $this->table(['Application', 'Applicant', 'Document Type', 'Result', 'Failed Checks'], $rows);
        $this->newLine();
        $this->info("Totals ({$type}): {$passed} passed, {$flagged} flagged, {$notReady} not yet processed (of {$documents->count()} total).");

        return self::SUCCESS;
    }
}
