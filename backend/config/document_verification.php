<?php

// Centralized rules for OCR auto-reupload routing, on the Laravel side
// specifically. Category names here must match whatever
// ocr-service/app/verification/shared.py emits as auto_reupload_category
// -- this is a manual-sync contract between two independently deployed
// services, not a shared runtime file, by design (see
// AUTO_REUPLOAD_VERIFICATION_RULES.md for why: a shared config file
// would introduce a cross-service runtime dependency neither side
// actually needs, just to solve what is really a "remember to update
// both places" documentation problem). If you rename a category here,
// also update the matching name in shared.py, and vice versa.

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