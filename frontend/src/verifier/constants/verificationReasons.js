export const OTHER = "Other (please specify)";

export const DOC_TYPES = [
    { key: "registration_form", label: "Registration Form" },
    { key: "school_id", label: "School ID" },
    { key: "voters_certificate", label: "Voter's Certificate" },
];

// Now a function so the Registration Form reason can reference the
// application's actual required school year instead of a vague phrase.
export function getReasonsByDocType(schoolYear) {
    const syLabel = schoolYear ? `A.Y. ${schoolYear}` : "the current school year";
    return {
        registration_form: [
            "Image blurry or unreadable.",
            "File uploaded is not the correct document type.",
            `Wrong school year (must be ${syLabel}).`,
            "Name does not match other submitted documents.",
            OTHER,
        ],
        school_id: [
            "Image blurry or unreadable.",
            "File uploaded is not the correct document type.",
            "Missing front or back of School ID.",
            "Name does not match other submitted documents.",
            OTHER,
        ],
        voters_certificate: [
            "Image blurry or unreadable.",
            "File uploaded is not the correct document type.",
            "Not issued within the current year.",
            "Not a registered voter in Barangay Mamatid.",
            "Parent's/guardian's Voter's Certificate could not be validated.",
            "Applicant is not a minor; parent's/guardian's Voter's Certificate not allowed.",
            "Name does not match other submitted documents.",
            OTHER,
        ],
    };
}

export const GENERAL_REJECTION_REASONS = [
    "Applicant does not meet program eligibility requirements.",
    "Duplicate application.",
];

export const NOT_CLEARED_REASONS = [
    "Physical documents did not match submitted application.",
    "Document appeared altered or invalid.",
    "Registration Form not a certified true copy or missing dry seal.",
    "Unable to present valid ID during claiming.",
    OTHER,
];