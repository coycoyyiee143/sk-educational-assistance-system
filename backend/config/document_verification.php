<?php

// Centralized rules for OCR auto-reupload routing. See
// AUTO_REUPLOAD_VERIFICATION_RULES.md for the full reasoning behind
// these values. Read by App\Services\DocumentReuploadRoutingService,
// not by ProcessOcrDocument.php directly -- the Job calls the service,
// the service reads this config.

return [

    // Categories that count toward the retry cap below. A category
    // NOT listed here (e.g. 'low_quality') is uncapped on purpose --
    // a repeatedly-blurry upload isn't necessarily something the
    // applicant can fix faster by trying again, so it never escalates
    // to the verifier just for recurring.
    'capped_categories' => [
        'wrong_document_type',
        'wrong_cert_year',
        'name_mismatch',
        'institution_mismatch',
    ],

    // Max auto-reupload attempts allowed (across all capped categories
    // combined) for the SAME document type, before escalating to a
    // human verifier with the full attempt history attached.
    'max_attempts' => 3,
];