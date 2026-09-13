<?php

namespace App\Services;

use App\Models\Application;
use App\Models\ApplicationDocument;

/**
 * Centralizes the auto-reupload retry-cap / escalation logic that used
 * to live inline inside ProcessOcrDocument.php. The actual OCR
 * confidence thresholds (what counts as a "confident" mismatch) still
 * live in the Python service's shared.py — this class only owns what
 * happens AFTER a document has already been flagged auto_reupload:
 * how many tries the applicant gets before a human verifier steps in.
 *
 * See AUTO_REUPLOAD_VERIFICATION_RULES.md for the full reasoning
 * behind the category list and the attempt count.
 */
class DocumentReuploadRoutingService
{
    /**
     * Categories that count toward the retry cap. A category NOT
     * listed here (e.g. 'low_quality') is uncapped on purpose — a
     * repeatedly-blurry upload isn't necessarily something the
     * applicant can fix faster by trying again, so it never forces
     * an escalation just for recurring.
     *
     * @return string[]
     */
    public function cappedCategories(): array
    {
        return config('document_verification.capped_categories');
    }

    /**
     * Max attempts allowed across ALL capped categories combined, on
     * the SAME document type, before escalating to a verifier.
     */
    public function maxAttempts(): int
    {
        return config('document_verification.max_attempts');
    }

    public function isCappedCategory(?string $category): bool
    {
        return $category !== null && in_array($category, $this->cappedCategories(), true);
    }

    /**
     * How many ApplicationDocument rows of this document type, on
     * this application, have EVER been flagged with any capped
     * category — walks the full version history (every reupload
     * creates a new row), not just the latest one. This intentionally
     * aggregates across categories, matching the original behavior:
     * a mix of e.g. 2 wrong-document-type + 2 wrong-cert-year attempts
     * on the same document type counts toward the same cap together.
     */
    public function priorFlaggedCount(Application $application, ApplicationDocument $document): int
    {
        return ApplicationDocument::where('application_id', $application->id)
            ->where('document_type', $document->document_type)
            ->whereIn('auto_reupload_category', $this->cappedCategories())
            ->count();
    }

    /**
     * Should this document escalate to a human verifier instead of
     * requesting another auto-reupload from the applicant?
     */
    public function shouldEscalate(Application $application, ApplicationDocument $document): bool
    {
        if (!$this->isCappedCategory($document->auto_reupload_category)) {
            return false;
        }

        // NOTE: strictly ">", not ">=" — priorFlaggedCount already
        // includes the current attempt's own row, so with
        // max_attempts = 3 this fires on the 4th flagged attempt.
        return $this->priorFlaggedCount($application, $document) > $this->maxAttempts();
    }

    /**
     * Every prior auto_reupload_reason for this document type/category
     * combo, in version order, for the verifier to see the full
     * history when a document gets escalated — not just the latest
     * reason.
     *
     * @return string[]
     */
    public function attemptHistory(Application $application, ApplicationDocument $document): array
    {
        return ApplicationDocument::where('application_id', $application->id)
            ->where('document_type', $document->document_type)
            ->whereIn('auto_reupload_category', $this->cappedCategories())
            ->orderBy('version')
            ->pluck('auto_reupload_reason')
            ->filter()
            ->values()
            ->all();
    }
}