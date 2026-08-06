export const STATUS_CONFIG = {
    pending_prescreening: {
        applicantLabel: "Pending",
        verifierLabel: "Pending",
        boxClass: "status-box-pending",
        badgeClass: "status-pending",
        applicantMessage: "Your application has been submitted and is currently being processed. Please wait for further updates.",
        showClaiming: false,
        showReupload: false,
    },
    for_review: {
        applicantLabel: "Pending",
        verifierLabel: "For Review",
        boxClass: "status-box-pending",
        badgeClass: "status-review",
        applicantMessage: "Your application has been submitted and is currently being processed. Please wait for further updates.",
        showClaiming: false,
        showReupload: false,
    },
    reupload_requested: {
        applicantLabel: "Re-upload Requested",
        verifierLabel: "Re-upload Requested",
        boxClass: "status-box-review",
        badgeClass: "status-review",
        applicantMessage: "The SK Verifier has requested you to re-upload one or more of your documents. Please go to the Application Submission page to re-upload your documents.",
        showClaiming: false,
        showReupload: true,
    },
    approved: {
        applicantLabel: "Approved",
        verifierLabel: "Approved", // overridden to "System Approved" when no VerifierAction exists — see getVerifierStatusLabel()
        boxClass: "status-box-approved",
        badgeClass: "status-approved",
        applicantMessage: "Congratulations! Your educational assistance application has been approved by the Sangguniang Kabataan of Barangay Mamatid. You may now proceed to view your assigned claiming schedule.",
        showClaiming: true,
        showReupload: false,
    },
    rejected: {
        applicantLabel: "Rejected",
        verifierLabel: "Rejected",
        boxClass: "status-box-rejected",
        badgeClass: "status-rejected",
        applicantMessage: "We regret to inform you that your application did not meet the eligibility requirements. Please contact the SK office for further assistance.",
        showClaiming: false,
        showReupload: false,
    },
    claimed: {
        applicantLabel: "Claimed",
        verifierLabel: "Claimed",
        boxClass: "status-box-approved",
        badgeClass: "status-approved",
        applicantMessage: "You have successfully received your educational assistance. Thank you!",
        showClaiming: false,
        showReupload: false,
    },
    not_cleared: {
        applicantLabel: "Rejected",
        verifierLabel: "Not Cleared — Claiming Day",
        boxClass: "status-box-rejected",
        badgeClass: "status-rejected",
        applicantMessage: "Your physical documents did not match your application record on claiming day. Please contact the SK office for further assistance.",
        showClaiming: false,
        showReupload: false,
    },
    unclaimed: {
        applicantLabel: "Unclaimed",
        verifierLabel: "Unclaimed",
        boxClass: "status-box-rejected",
        badgeClass: "status-rejected",
        applicantMessage: "The claiming period has passed and your assistance was not claimed within the grace period. Please coordinate with the SK office.",
        showClaiming: false,
        showReupload: false,
    },

    // Reserved — not yet reachable in code, ties to the "stranded application
    // visibility" backlog item. Do not rely on this being set anywhere yet.
    closed_incomplete: {
        applicantLabel: "Closed — Incomplete",
        verifierLabel: "Closed — Incomplete",
        boxClass: "status-box-rejected",
        badgeClass: "status-rejected",
        applicantMessage: "The application period ended before your document re-upload was completed.",
        showClaiming: false,
        showReupload: false,
    },
};

// Verifier-facing label with the "System Approved" / "Re-uploaded" derivations.
// `app` must include `verifier_actions` (array, any order — we scan it).
export function getVerifierStatusLabel(app) {
    const config = STATUS_CONFIG[app.status];
    if (!config) return app.status;

    if (app.status === "approved") {
        const wasManuallyApproved = (app.verifier_actions || []).some(a => a.action === "approved");
        return wasManuallyApproved ? "Approved" : "System Approved";
    }

    if (app.status === "pending_prescreening") {
        const wasReuploaded = (app.verifier_actions || []).some(a => a.action === "reupload_requested");
        return wasReuploaded ? "Re-uploaded" : "Pending";
    }

    return config.verifierLabel;
}

export function getVerifierBadgeClass(app) {
    return STATUS_CONFIG[app.status]?.badgeClass ?? "status-pending";
}