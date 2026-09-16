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
    cert_year_match: "Certificate Year",
    identity_match: "Identity & Legal Name",
    residency_geofence: "Residency Geofence",
    repeated_auto_reupload_escalation: "Repeated Re-upload Issue",
};

export function getCheckDisplayLabel(checkName) {
    return (
        CHECK_NAME_LABELS[checkName] ||
        checkName.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
    );
}

// Translates raw automated-check output (which can include technical
// specifics like "(max: 106)" from image-forensics scoring) into a plain
// sentence a non-technical verifier or an applicant can actually act on.
// Falls back to stripping the technical parts of unrecognized messages
// rather than ever showing raw numbers/thresholds.
export function translateFlagReason(checkName, rawReason) {
    if (checkName === "image_integrity") {
        return "This image shows signs of digital editing and could not be verified as an unaltered original.";
    }
    if (checkName === "ai_generation_provenance") {
        return "This image appears to be AI-generated or AI-edited.";
    }
    if (checkName === "repeated_auto_reupload_escalation") {
        return "This document has been flagged for the same issue multiple times and needs manual review.";
    }
    if (!rawReason) return `${getCheckDisplayLabel(checkName)} check failed.`;

    // Strip technical parentheticals like "(max: 106)" / "(mean: 12.34)"
    // that no non-IT reader (verifier or applicant) can act on.
    const cleaned = rawReason.replace(/\s*\((?:max|mean|score|threshold)[^)]*\)/gi, "").trim();
    return cleaned || `${getCheckDisplayLabel(checkName)} check failed.`;
}
