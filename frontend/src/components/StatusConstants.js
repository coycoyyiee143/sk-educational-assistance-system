export const STATUS_CONFIG = {
    // --- SUBMISSION PHASE ---
    pending: {
        label: "Pending",
        boxClass: "status-box-pending",
        badgeClass: "status-pending",
        message: "Your application has been submitted and is currently being processed by the system. Please wait for further updates.",
        showClaiming: false,
        showReupload: false,
    },

    // --- AUTO-SCREENING PHASE ---
    auto_approved: {
        label: "Approved",
        boxClass: "status-box-approved",
        badgeClass: "status-approved",
        message: "Congratulations! Your application has been approved and a control number has been assigned.",
        showClaiming: true,
        showReupload: false,
    },
    flagged_image_quality: {
        label: "Pending", // Student sees "Pending (no update yet)" while verifier reviews
        boxClass: "status-box-pending",
        badgeClass: "status-pending",
        message: "Your application has been submitted and is currently being processed by the system. Please wait for further updates.",
        showClaiming: false,
        showReupload: false,
    },
    flagged_eligibility_issues: {
        label: "Pending", // Student sees "Pending (no update yet)" while verifier reviews
        boxClass: "status-box-pending",
        badgeClass: "status-pending",
        message: "Your application has been submitted and is currently being processed by the system. Please wait for further updates.",
        showClaiming: false,
        showReupload: false,
    },

    // --- MANUAL REVIEW PHASE ---
    reupload_requested: {
        label: "Re-upload Required",
        boxClass: "status-box-review",
        badgeClass: "status-review",
        message: "The SK Verifier has requested you to re-upload one or more of your documents. Please go to the Application Submission page to re-upload your documents.",
        showClaiming: false,
        showReupload: true,
    },
    approved: {
        label: "Approved",
        boxClass: "status-box-approved",
        badgeClass: "status-approved",
        message: "Congratulations! Your educational assistance application has been approved by the Sangguniang Kabataan of Barangay Mamatid. You may now proceed to view your assigned claiming schedule.",
        showClaiming: true,
        showReupload: false,
    },
    rejected: {
        label: "Rejected",
        boxClass: "status-box-rejected",
        badgeClass: "status-rejected",
        message: "We regret to inform you that your application did not meet the eligibility requirements. Please contact the SK office for further assistance.",
        showClaiming: false,
        showReupload: false,
    },

    // --- CLOSED PHASE ---
    closed_incomplete: {
        label: "Closed — Incomplete",
        boxClass: "status-box-rejected",
        badgeClass: "status-rejected",
        message: "The application period ended before your document re-upload was completed.",
        showClaiming: false,
        showReupload: false,
    },

    // --- CLAIMING DAY PHASE ---
    physically_verified: {
        label: "Documents Verified",
        boxClass: "status-box-approved",
        badgeClass: "status-approved",
        message: "Your physical documents have been confirmed and verified on claiming day.",
        showClaiming: true,
        showReupload: false,
    },
    not_cleared: {
        label: "Not Cleared",
        boxClass: "status-box-rejected",
        badgeClass: "status-rejected",
        message: "Physical document verification failed on claiming day.",
        showClaiming: false,
        showReupload: false,
    },

    // --- POST-CLAIMING PHASE ---
    claimed: {
        label: "Claimed",
        boxClass: "status-box-approved",
        badgeClass: "status-approved",
        message: "You have successfully received your educational assistance. Thank you!",
        showClaiming: false,
        showReupload: false,
    },
    unclaimed: {
        label: "Unclaimed",
        boxClass: "status-box-rejected",
        badgeClass: "status-rejected",
        message: "The claiming period has passed and the assistance remains unclaimed.",
        showClaiming: false,
        showReupload: false,
    },
};