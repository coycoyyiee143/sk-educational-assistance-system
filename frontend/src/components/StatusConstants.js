// ============================================================
// STATUS_CONFIG — single source of truth for every application/
// claiming status label, badge color, and applicant-facing message.
// ============================================================

export const STATUS_CONFIG = {
    // Application row exists (created at submission), but not all required
    // documents have cleared the Stage 1 upload-time completeness check
    // yet. This is the correct status from the moment of creation itself —
    // not something the app transitions into later — since at creation
    // zero documents have been uploaded, which is definitionally
    // incomplete. Distinct from pending_prescreening: "hasn't submitted
    // enough yet" and "fully submitted, waiting in the async queue" are
    // genuinely different situations for a verifier to see.
    draft_incomplete: {
        applicantLabel: "Incomplete",
        verifierLabel: "Incomplete",
        boxClass: "status-box-pending",
        badgeClass: "status-pending",
        applicantMessage: "Your application has been started, but one or more required documents still need to be uploaded and pass our initial quality check. Please go to the Application Submission page to finish uploading your documents.",
        showClaiming: false,
        showReupload: false,
    },

    // All required documents cleared Stage 1 and are sitting in the async
    // OCR/verification queue. The applicant is waiting on automated
    // processing, not a human.
    pending_prescreening: {
        applicantLabel: "Pending",
        verifierLabel: "Pending",
        boxClass: "status-box-pending",
        badgeClass: "status-pending",
        applicantMessage: "Your application has been submitted and is currently being processed. Please wait for further updates.",
        showClaiming: false,
        showReupload: false,
    },

    // Stage 2 flagged something the system can't resolve on its own — now
    // waiting on a human verifier to look. Covers value-mismatch findings,
    // template/layout mismatches, and (in the rare case Stage 1 somehow
    // misses a field-not-found case for a document type it doesn't yet
    // cover) missing-field cases too. There is no separate automated
    // reupload status at this stage — if a mechanical "not found" case
    // does slip past Stage 1, it's routed to a human here rather than
    // building a status designed to be unreachable once Stage 1 is fully
    // built out.
    for_review: {
        applicantLabel: "Pending",
        verifierLabel: "For Review",
        boxClass: "status-box-pending",
        badgeClass: "status-review",
        applicantMessage: "Your application has been submitted and is currently being processed. Please wait for further updates.",
        showClaiming: false,
        showReupload: false,
    },

    // A human verifier looked at the application and specifically
    // requested a document be redone — always a judgment call: either a
    // "field found, but the value is wrong" eligibility finding, or a
    // template/layout mismatch that could mean "wrong file" or "unlisted
    // school." Always human-initiated.
    reupload_requested: {
        applicantLabel: "Re-upload Requested",
        verifierLabel: "Re-upload Requested",
        boxClass: "status-box-review",
        badgeClass: "status-review",
        applicantMessage: "The SK Verifier has requested you to re-upload one or more of your documents. Please go to the Application Submission page to re-upload your documents.",
        showClaiming: false,
        showReupload: true,
    },

    // Passed everything and holds a real, reserved slot. This is the
    // entry point into the claiming pipeline — and stays "approved" for
    // the ENTIRE claiming process. It does not change to reflect claiming
    // outcomes (pending_claiming/claimed/not_cleared/unclaimed); those
    // live entirely in claiming_assignments.claim_status instead, to
    // avoid recreating the status-duplication problem already identified
    // between applications.status and claiming_assignments.claim_status.
    approved: {
        applicantLabel: "Approved",
        verifierLabel: "Approved", // overridden to "System Approved" when no VerifierAction exists — see getVerifierStatusLabel()
        boxClass: "status-box-approved",
        badgeClass: "status-approved",
        applicantMessage: "Congratulations! Your educational assistance application has been approved by the Sangguniang Kabataan of Barangay Mamatid. You may now proceed to view your assigned claiming schedule.",
        showClaiming: true,
        showReupload: false,
    },

    // Passed everything, but no slot was free at approval time. Sits here
    // until either promoted to approved (a slot frees up) or the period
    // closes with them still here, at which point they become not_selected.
    waitlisted: {
        applicantLabel: "Waitlisted",
        verifierLabel: "Waitlisted",
        boxClass: "status-box-pending",
        badgeClass: "status-pending",
        applicantMessage: "Your application met all requirements, but all slots for this period are currently filled. This does not guarantee a slot — you will only be approved if a slot opens up. If a slot opens, we will notify you before the grace period ends.",
        showClaiming: false,
        showReupload: false,
    },

    // Failed eligibility during the online review stage. Never had a slot
    // at any point. For admin-level reporting metrics (Rejection Rate),
    // this is grouped together with not_cleared below into one "did not
    // receive funding" bucket — see AdminReportController::summary().
    // Kept as its own distinct status/label in verifier and applicant
    // views, since "was never eligible" and "was approved but failed
    // later" call for different follow-up actions.
    rejected: {
        applicantLabel: "Rejected",
        verifierLabel: "Rejected",
        boxClass: "status-box-rejected",
        badgeClass: "status-rejected",
        applicantMessage: "We regret to inform you that your application did not meet the eligibility requirements. Please contact the SK office for further assistance.",
        showClaiming: false,
        showReupload: false,
    },

    // [claiming_assignments.claim_status] Renamed from bare "pending" —
    // this specific assignment is the applicant's CURRENT, active
    // claiming opportunity, not yet resolved. Only ONE assignment per
    // applicant should ever hold this value at a time. The rename exists
    // specifically to prevent ambiguity: a superseded/historical
    // assignment (e.g. an original slot that already got replaced by a
    // grace-period reassignment) is never left sitting at a "pending"-
    // sounding value — it gets its own honest terminal status (unclaimed)
    // instead, so no row's status can ever be misread out of context.
    pending_claiming: {
        applicantLabel: "Pending Claiming",
        verifierLabel: "Pending Claiming",
        boxClass: "status-box-pending",
        badgeClass: "status-pending",
        applicantMessage: "You have an upcoming claiming schedule. Please check your assigned date, time, and lane below.",
        showClaiming: true,
        showReupload: false,
    },

    // [claiming_assignments.claim_status] Showed up on claiming day,
    // verified successfully, received the money. Terminal and successful
    // — the best possible outcome.
    claimed: {
        applicantLabel: "Claimed",
        verifierLabel: "Claimed",
        boxClass: "status-box-approved",
        badgeClass: "status-approved",
        applicantMessage: "You have successfully received your educational assistance. Thank you!",
        showClaiming: false,
        showReupload: false,
    },

    // [claiming_assignments.claim_status] Showed up on claiming day, but
    // physical documents didn't match the application on file. Terminal
    // and unsuccessful. Applicant-facing label is "Not Cleared" (not
    // "Rejected") so it reads as distinct from the online-review rejected
    // status above — these are different moments in the process and
    // shouldn't look identical to the applicant, even though they're
    // grouped together for admin summary reporting.
    not_cleared: {
        applicantLabel: "Not Cleared",
        verifierLabel: "Not Cleared",
        boxClass: "status-box-rejected",
        badgeClass: "status-rejected",
        applicantMessage: "Your physical documents did not match your application record on claiming day. Please contact the SK office for further assistance.",
        showClaiming: false,
        showReupload: false,
    },

    // [claiming_assignments.claim_status] This specific assignment's
    // window passed with no claim. Honest PER-ROW meaning: "this one
    // didn't happen" — NOT "the applicant's story is over." An original-
    // slot assignment and a grace-period-retry assignment both use this
    // identically when their own window lapses.
    //
    // An applicant's OVERALL claiming outcome is never read from one row
    // in isolation — it's computed across all of an application's
    // claiming_assignments: do they have a claimed row anywhere? a
    // pending_claiming row anywhere (an active chance still remaining)?
    // If neither, they're finally, terminally unclaimed.
    //
    // Transition into this status on a given row is automatic (a
    // scheduled sweep once that row's lane time passes with claim_status
    // still pending_claiming) — not a verifier-clicked button. There's no
    // judgment call to make; the absence of a claiming action already
    // tells the story. The SAME sweep is what should also create a new
    // grace-period-retry assignment (claim_status: pending_claiming) for
    // the applicant, if grace period hasn't ended yet — this reassignment
    // mechanism does not exist yet for original no-shows (only the
    // waitlist-promotion path — promoteFromWaitlist()/promoteAllFromWaitlist()
    // — currently creates an equivalent new assignment).
    unclaimed: {
        applicantLabel: "Unclaimed",
        verifierLabel: "Unclaimed",
        boxClass: "status-box-rejected",
        badgeClass: "status-rejected",
        applicantMessage: "The claiming period has passed and your assistance was not claimed within the grace period. Please coordinate with the SK office.",
        showClaiming: false,
        showReupload: false,
    },

    // Was waitlisted the entire time — never promoted, never got a real
    // slot or claiming opportunity at all. Distinct from rejected: this
    // person was never found ineligible, they simply ran out of room by
    // the time the period closed. Set only by AdminScheduleController::closePeriod().
    not_selected: {
        applicantLabel: "Not Selected",
        verifierLabel: "Not Selected",
        boxClass: "status-box-rejected",
        badgeClass: "status-rejected",
        applicantMessage: "You met all requirements and were on the waitlist, but no slot became available before the application period closed. This is not a rejection of your eligibility — please watch for the next application period.",
        showClaiming: false,
        showReupload: false,
    },

    // Reserved — not yet reachable in code, ties to the "stranded
    // application visibility" backlog item. Do not rely on this being set
    // anywhere yet.
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

// Verifier-facing label with the "System Approved" / "Re-uploaded"
// derivations. `app` must include `verifier_actions` (array, any order —
// we scan it) for these two derivations.
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