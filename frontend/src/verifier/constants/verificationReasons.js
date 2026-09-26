export const OTHER = "Other (please specify)";

export const DOC_TYPES = [
    { key: "registration_form", label: "Registration Form" },
    { key: "school_id", label: "School ID" },
    { key: "voters_certificate", label: "Voter's Certificate" },
];

// Each reason has three jobs that used to share one string: the label a
// verifier picks from, the category recorded for admin reporting, and the
// literal sentence emailed to the applicant. Rejecting and requesting a
// re-upload call for different tones for the same underlying problem (a
// reject states the fact plainly, a re-upload gives the applicant a
// concrete, benefit-of-the-doubt way to fix it), so reject/reupload text
// is split per reason instead of reusing one shared string for both.
function buildReasons(docLabel, extra = {}) {
    const primary = [
        {
            id: "blurry",
            verifierLabel: "Image blurry or unreadable",
            rejectText: `The ${docLabel} image was too blurry or unreadable to verify.`,
            reuploadText: `Your ${docLabel} photo was too blurry to read clearly. Please re-upload a clearer photo — try a scanning app like CamScanner and good lighting so all text is visible.`,
        },
        {
            id: "wrong_doc_type",
            verifierLabel: "Not the correct document type",
            rejectText: `The file submitted for ${docLabel} was not the correct document.`,
            reuploadText: `The file you uploaded for ${docLabel} doesn't match what we're expecting. Please check that you selected the right file and upload your actual ${docLabel}.`,
        },
        {
            id: "name_mismatch",
            verifierLabel: "Name does not match other documents",
            rejectText: `The name on ${docLabel} does not match your other submitted documents.`,
            reuploadText: `The name on your ${docLabel} doesn't match the name on your other documents. This is often just a mismatch between a nickname, middle name, or suffix — please re-upload a copy that clearly shows your full legal name.`,
        },
    ];
    return { primary, additional: extra.additional || [] };
}

// Now a function so the Registration Form reason can reference the
// application's actual required school year instead of a vague phrase.
export function getReasonsByDocType(schoolYear) {
    const syLabel = schoolYear ? `A.Y. ${schoolYear}` : "the current school year";

    return {
        registration_form: buildReasons("Registration Form", {
            additional: [
                {
                    id: "wrong_school_year",
                    verifierLabel: "Wrong school year",
                    rejectText: `The Registration Form is not for the required school year (must be ${syLabel}).`,
                    reuploadText: `Your Registration Form appears to be for a different school year. Please upload the Registration Form for ${syLabel}.`,
                },
            ],
        }),
        school_id: buildReasons("School ID"),
        voters_certificate: buildReasons("Voter's Certificate", {
            additional: [
                {
                    id: "not_current_year",
                    verifierLabel: "Not issued within the current year",
                    rejectText: "Voter's Certificate was not issued within the required year.",
                    reuploadText: "Your Voter's Certificate appears to be from a previous year. Please upload your most current Voter's Certificate if you have a newer one.",
                },
                {
                    id: "not_mamatid_voter",
                    verifierLabel: "Not a registered Mamatid voter",
                    rejectText: "Voter's Certificate shows registration in a barangay other than Mamatid — does not meet the residency requirement for this program.",
                    reuploadText: "Your Voter's Certificate shows a barangay other than Mamatid. If you've since registered as a voter in Barangay Mamatid, please upload your current Voter's Certificate reflecting that. If not, this application may not qualify for this program.",
                },
                {
                    id: "guardian_cert_invalid",
                    verifierLabel: "Parent's/guardian's cert could not be validated",
                    rejectText: "Your parent's/guardian's Voter's Certificate could not be validated against your profile information.",
                    reuploadText: "We couldn't match your parent's/guardian's name on the Voter's Certificate to your profile. Please make sure your guardian information is correct and re-upload a clear copy of their Voter's Certificate.",
                },
                {
                    id: "guardian_not_allowed",
                    verifierLabel: "Guardian cert not applicable (not a minor)",
                    rejectText: "Applicant is not a minor, so a parent's/guardian's Voter's Certificate cannot be used.",
                    reuploadText: "Since you are not listed as a minor, please upload your own Voter's Certificate instead of your parent's/guardian's.",
                },
            ],
        }),
    };
}

// Flattens a doc type's reason groups into one array (primary + additional),
// the shape most call sites want when they don't care about grouping.
export function getFlatReasons(reasonsForDocType) {
    return [...reasonsForDocType.primary, ...reasonsForDocType.additional];
}

export function findReasonById(reasonsForDocType, id) {
    return getFlatReasons(reasonsForDocType).find((r) => r.id === id) || null;
}

export const GENERAL_REJECTION_REASONS = [
    "Applicant does not meet program eligibility requirements.",
    "Duplicate application.",
];

export const NOT_CLEARED_REASONS = [
    "Physical documents did not match submitted application.",
    "Document appeared altered or invalid.",
    "Registration Form not a certified true copy or missing dry seal.",
    "Applicant did not bring all required physical documents.",
    OTHER,
];

// Plain-language labels for automated check names — shown to verifiers
// (SK staff, not IT) in place of the internal check_name identifiers.
const CHECK_NAME_LABELS = {
    image_integrity: "Edited/Tampered Image Detection",
    ai_generation_provenance: "AI-Generated or AI-Edited Image",
    // Bare "Year Issued" reads ambiguous next to school_year_match's
    // auto-labeled "School Year Match" — both are "year" checks on
    // different fields, so this needs to say which one.
    cert_year_match: "Certificate Year Issued",
    identity_match: "Identity & Legal Name",
    // "residency_geofence" is the stored check_name (unchanged, already
    // in seeded/production data) — overridden here because the check
    // itself is a plain OCR text match of the printed barangay against
    // "Mamatid", not a GPS/coordinate-based geofence of any kind. The old
    // label overstated what the check actually does.
    residency_geofence: "Residency Check",
    repeated_auto_reupload_escalation: "Repeated Re-upload Issue",
    // "institution_match" is the stored check_name (unchanged, already in
    // seeded/production data) — overridden here only so the displayed
    // label uses "School" like every other check/label in this app
    // (School ID, School Year Match, school_name), instead of the
    // auto-titlecased "Institution Match".
    institution_match: "School Match",
    // Only ever present on a School ID that was seeded via
    // OcrTestSeeder with its document-type/face-presence gate
    // bypassed, or a panel/demo "debug" OCR run — never on a real
    // applicant's document, since in production a failing document type
    // check auto-reuploads before this check row is ever created.
    document_type_check: "Document Type / Photo Check",
};

export function getCheckDisplayLabel(checkName) {
    return (
        CHECK_NAME_LABELS[checkName] ||
        checkName.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
    );
}

// Strips technical parentheticals like "(max: 106)" / "(mean: 12.34)" from
// raw check output — the substance of the message survives (which is what
// a verifier actually needs, e.g. which AI-tool signature or filename
// pattern was matched), just not the raw numbers/thresholds no non-IT
// reader can act on.
export function stripTechnicalDetail(rawReason) {
    if (!rawReason) return "";
    return rawReason.replace(/\s*\((?:max|mean|score|threshold)[^)]*\)/gi, "").trim();
}

// Translates raw automated-check output into a plain sentence a
// non-technical verifier or an applicant can actually act on, for use as
// a reason category — this is deliberately generic (it drops the raw
// evidence, e.g. which AI tool's C2PA signature matched) since a reason
// offered to reject/re-upload on needs to stand on its own. To show the
// underlying evidence itself, use `stripTechnicalDetail` instead.
//
// `extractedValue` (the check's own "extracted"/assessment field, e.g.
// describe_ela_score()'s tier label or describe_image_metadata_score()'s
// confidence label) is optional, only used by image_integrity/
// ai_generation_provenance to pick which of several tiered messages to
// show — every other check ignores it.
export function translateFlagReason(checkName, rawReason, extractedValue) {
    if (checkName === "image_integrity") {
        // ELA is a heuristic pre-screening signal (see compute_ela's own
        // docstring in ocr-service) -- it flags for manual review, it
        // does not confirm forgery. Legitimate screenshots, re-saves, and
        // some phone camera JPEG pipelines can trip the lower tiers with
        // zero actual tampering involved, so the message has to say what
        // to actually DO (compare visually against the applicant's other
        // documents) rather than just naming the finding.
        if (extractedValue === "Minor Compression Irregularities Detected") {
            return "Minor compression differences were detected — common on legitimate screenshots, re-saved images, or certain phone camera formats, not necessarily tampering. Compare it against the applicant's other documents, and only treat it as a real concern if something looks visibly altered.";
        }
        if (extractedValue === "Moderate Edit Artifacts Detected") {
            return "A moderate compression difference was detected, which can indicate an edited region (e.g. a pasted photo, altered text, or replaced seal) but can also happen from simply re-saving a genuine file. Inspect the document closely and compare it against the applicant's other submissions before deciding.";
        }
        return "A significant compression difference was detected, consistent with a spliced or edited region (e.g. a pasted photo, altered text, or replaced seal). Treat this as a strong signal to inspect closely — but it is still a pre-screening heuristic, not proof of tampering, so confirm visually before rejecting.";
    }
    if (checkName === "ai_generation_provenance") {
        // Two signals of very different strength (see check_image_metadata's
        // docstring in ocr-service) -- a C2PA hit is the AI tool's own
        // signed assertion, a filename-only hit is trivially defeated by
        // renaming the file. Conflating them into one sentence would
        // overstate the weak case and undersell the strong one.
        if (extractedValue === "AI-Generation Confirmed (Signed Content Credentials Found)") {
            return "This image carries embedded content-credential metadata identifying it as AI-generated or AI-edited — a signed assertion from the tool itself, not a guess. Treat this as strong evidence, though still confirm manually before acting on it.";
        }
        return "Weak signal only: the uploaded filename matches a common AI-tool default naming pattern, which is trivially avoided by renaming the file before upload. This alone is not reliable evidence of AI generation — inspect the image itself for other signs before acting on it.";
    }
    if (checkName === "repeated_auto_reupload_escalation") {
        return "This document has been flagged for the same issue multiple times and needs manual review.";
    }
    if (!rawReason) return `${getCheckDisplayLabel(checkName)} check failed.`;

    const cleaned = stripTechnicalDetail(rawReason);
    return cleaned || `${getCheckDisplayLabel(checkName)} check failed.`;
}
