import { useState, useEffect, useRef } from "react";
import VerifierNavigation from "../components/VerifierNavigation";
import ClaimingFaceVerify from "../components/ClaimingFaceVerify";
import PanelFooter from "../../components/PanelFooter";
import api from "../../services/api";
import { DOC_TYPES, NOT_CLEARED_REASONS, OTHER } from "../constants/verificationReasons";
import { STATUS_CONFIG } from "../../components/StatusConstants";
const CLAIMED_QUICK_NOTES = [
  "Claiming completed.",
  "Documents verified.",
  "Requirements completed.",
];
const NOT_CLEARED_QUICK_NOTES = [
  "Document issue found.",
  "Documents did not match.",
  "Requirements incomplete.",
];
function ClaimStatusBadge({ status }) {
  const config = STATUS_CONFIG[status];
  if (!config) return <span className="status-badge status-pending">Pending</span>;
  return <span className={`status-badge ${config.badgeClass}`}>{config.verifierLabel}</span>;
}
function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function daysBetween(a, b) {
  return Math.round((new Date(b) - new Date(a)) / 86400000);
}
function formatDateDisplay(dateStr) {
  if (!dateStr) return "";
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
function VerifierClaiming() {
  const [controlNo, setControlNo] = useState("");
  const [applicantName, setApplicantName] = useState("");
  const [results, setResults] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [selected, setSelected] = useState(null);
  const [docStatus, setDocStatusState] = useState(DOC_TYPES.reduce((acc, d) => ({ ...acc, [d.key]: "unreviewed" }), {}));
  const [notes, setNotes] = useState("");
  const [selectedAction, setSelectedAction] = useState(null);
  const [notClearedReasons, setNotClearedReasons] = useState([]);
  const [notClearedOtherText, setNotClearedOtherText] = useState("");
  const [searching, setSearching] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [claimError, setClaimError] = useState("");
  const [claimSuccess, setClaimSuccess] = useState("");
  const [claimingFeedback, setClaimingFeedback] = useState(null);
  const [feedbackCountdown, setFeedbackCountdown] = useState(5);
  const [filePreview, setFilePreview] = useState(null);
  const claimingActionRef = useRef(null);
  const [registrationPhotoUrl, setRegistrationPhotoUrl] = useState(null);
  const [registrationPhotoStatus, setRegistrationPhotoStatus] = useState("idle");
  const [assignedLane, setAssignedLane] = useState(null);
  const [allLanes, setAllLanes] = useState([]);
  const [gracePeriodDates, setGracePeriodDates] = useState({ start: null, end: null });
  const [selectedLaneId, setSelectedLaneId] = useState("");
  const [gracePeriodMode, setGracePeriodMode] = useState(false);
  const [assigningLane, setAssigningLane] = useState(false);
  const [lanesLoaded, setLanesLoaded] = useState(false);
  const modeManuallySetRef = useRef(false);
  const perPage = 10;
  const todaysLanes = allLanes.filter((lane) => lane.claiming_date === todayStr());
  function fetchLanes() {
    api.get("/verifier/claiming/lanes").then((res) => {
      setAssignedLane(res.data.assigned_lane ?? null);
      setAllLanes(res.data.all_lanes ?? []);
      if (res.data.assigned_lane) {
        setSelectedLaneId(String(res.data.assigned_lane.id));
      }
      setGracePeriodDates({
        start: res.data.grace_period_date ?? null,
        end: res.data.grace_period_end_date ?? null,
      });
      if (!modeManuallySetRef.current) {
        const today = todayStr();
        const gpStart = res.data.grace_period_date;
        const gpEnd = res.data.grace_period_end_date;
        const isGracePeriodNow = gpStart && gpEnd && today >= gpStart && today <= gpEnd;
        setGracePeriodMode(isGracePeriodNow);
      }
      setLanesLoaded(true);
    }).catch(() => setLanesLoaded(true));
  }
  useEffect(() => {
    fetchLanes();
  }, []);
  useEffect(() => {
    if (!lanesLoaded) return;
    if (gracePeriodMode) {
      handleSearch({ preventDefault: () => { } });
    } else if (assignedLane) {
      handleSearch({ preventDefault: () => { } });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lanesLoaded, gracePeriodMode, assignedLane]);

  // Silent background refresh — applicants get assigned to lanes in
  // real time as verifiers elsewhere approve applications (see
  // ClaimingAssignmentService), so the list here can go stale within
  // seconds of the page being opened. This re-runs the same search
  // every 10s WITHOUT going through handleSearch(), which would reset
  // selected/searchError/claimError/claimSuccess and flash the
  // Search/Refresh button text — none of which should happen from a
  // background tick the verifier didn't ask for.
  //
  // Deliberately skipped entirely whenever an applicant is selected or
  // a claim action is mid-submit: silently swapping `results` out from
  // under an open detail view, or racing a real submission, would be
  // far worse than a few seconds of staleness.
  useEffect(() => {
    if (!lanesLoaded) return;

    function silentRefreshResults() {
      if (selected || submitting) return;

      const params = {};
      if (gracePeriodMode) {
        params.grace_period = 1;
      } else {
        if (!selectedLaneId && !controlNo.trim() && !applicantName.trim()) return;
        if (selectedLaneId) params.lane_id = selectedLaneId;
        if (controlNo.trim()) params.control_number = controlNo.trim();
        if (applicantName.trim()) params.name = applicantName.trim();
      }

      api.get("/verifier/claiming/search", { params })
        .then((res) => {
          // Guard again after the request resolves — the verifier may
          // have selected someone or started submitting while this was
          // in flight.
          if (!selected && !submitting) setResults(res.data);
        })
        .catch(() => {
          // Silent poll — a dropped tick isn't worth surfacing an error
          // over. If the list is genuinely empty now (e.g. everyone on
          // it just got claimed), a 404 here would otherwise wipe
          // `results` via the same path handleSearch() uses; skip that
          // for silent ticks and just let the next tick (or a manual
          // Refresh) sort it out.
        });
    }

    const interval = setInterval(silentRefreshResults, 10000);
    return () => clearInterval(interval);
  }, [lanesLoaded, selected, submitting, gracePeriodMode, selectedLaneId, controlNo, applicantName]);

  // Revoke any lingering photo blob URL if the verifier navigates away
  // from this page entirely, so it doesn't leak.
  useEffect(() => {
    return () => {
      if (registrationPhotoUrl) URL.revokeObjectURL(registrationPhotoUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (!claimingFeedback) return;
    setFeedbackCountdown(5);
    const countdown = setInterval(() => {
      setFeedbackCountdown((prev) => Math.max(prev - 1, 0));
    }, 1000);
    const autoClose = setTimeout(() => {
      setClaimingFeedback(null);
    }, 5000);
    return () => {
      clearInterval(countdown);
      clearTimeout(autoClose);
    };
  }, [claimingFeedback]);
  function setDocStatus(key, status) {
    setDocStatusState((prev) => ({ ...prev, [key]: status }));
  }
  function toggleNotClearedReason(reason) {
    setNotClearedReasons((prev) =>
      prev.includes(reason)
        ? prev.filter((r) => r !== reason)
        : [...prev, reason]
    );
  }
  function switchToRegularMode() {
    modeManuallySetRef.current = true;
    setGracePeriodMode(false);
    setResults([]);
    setCurrentPage(1);
    setSelected(null);
    setSearchError("");
    setClaimError("");
    setClaimSuccess("");
    if (assignedLane) {
      setSelectedLaneId(String(assignedLane.id));
    }
  }
  function switchToGracePeriodMode() {
    modeManuallySetRef.current = true;
    setGracePeriodMode(true);
    setResults([]);
    setCurrentPage(1);
    setSelected(null);
    setSelectedLaneId("");
    setSearchError("");
    setClaimError("");
    setClaimSuccess("");
  }
  async function handleSelfAssign(laneId) {
    setAssigningLane(true);
    setSearchError("");
    try {
      await api.post(`/verifier/claiming/lanes/${laneId}/self-assign`);
      fetchLanes();
      setSelectedLaneId(String(laneId));
    } catch (err) {
      setSearchError(err.response?.data?.message || "Failed to self-assign lane.");
    } finally {
      setAssigningLane(false);
    }
  }
  async function handleSearch(e) {
    e.preventDefault();
    setSearchError("");
    setClaimError("");
    setClaimSuccess("");
    setSelected(null);
    if (!gracePeriodMode && !controlNo.trim() && !applicantName.trim() && !selectedLaneId) {
      setSearchError("Please enter a control number, applicant name, or select a lane.");
      return;
    }
    setSearching(true);
    try {
      const params = {};
      if (gracePeriodMode) {
        params.grace_period = 1;
      } else {
        if (selectedLaneId) params.lane_id = selectedLaneId;
        if (controlNo.trim()) params.control_number = controlNo.trim();
        if (applicantName.trim()) params.name = applicantName.trim();
      }
      const res = await api.get("/verifier/claiming/search", { params });
      setResults(res.data);
      setCurrentPage(1);
    } catch (err) {
      setResults([]);
      setCurrentPage(1);
      setSearchError(err.response?.data?.message || "No matching approved applicant found.");
    } finally {
      setSearching(false);
    }
  }
  function selectApplicant(app) {
    setSelected(app);
    setDocStatusState(DOC_TYPES.reduce((acc, d) => ({ ...acc, [d.key]: "unreviewed" }), {}));
    setNotes("");
    setSelectedAction(null);
    setNotClearedReasons([]);
    setNotClearedOtherText("");
    setClaimError("");
    setClaimSuccess("");
    setRegistrationPhotoUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    setRegistrationPhotoStatus("loading");
    api.get(`/claiming/applications/${app.id}/registration-photo`, { responseType: "blob" })
      .then((res) => {
        setRegistrationPhotoUrl(URL.createObjectURL(res.data));
        setRegistrationPhotoStatus("ready");
      })
      .catch(() => setRegistrationPhotoStatus("none"));
  }
  function chooseAction(action) {
    setSelectedAction(action);
    setClaimError("");
    if (action === "not_cleared" && issueDocs.length > 0) {
      setNotClearedReasons(["Physical documents did not match submitted application."]);
    } else if (action !== "not_cleared") {
      setNotClearedReasons([]);
      setNotClearedOtherText("");
    }
  }
  function closeClaimingActionModal() {
    if (submitting) return;
    setSelectedAction(null);
    setClaimError("");
  }
  async function handleConfirm() {
    if (!selected || !selectedAction) return;
    setClaimError("");
    setClaimSuccess("");
    if (selectedAction === "claimed" && (unreviewedCount > 0 || issueDocs.length > 0)) {
      setClaimError("All documents must be marked as Matched before this applicant can be marked Claimed. Resolve or re-check any flagged documents first.");
      return;
    }
    let reasonCategories;
    if (selectedAction === "not_cleared") {
      const withoutOther = notClearedReasons.filter((r) => r !== OTHER);
      reasonCategories = notClearedReasons.includes(OTHER) && notClearedOtherText.trim()
        ? [...withoutOther, notClearedOtherText.trim()]
        : withoutOther;
      if (reasonCategories.length === 0) {
        setClaimError("Please select at least one reason for marking this applicant as Not Cleared.");
        return;
      }
    }
    setSubmitting(true);
    try {
      const res = await api.post(`/verifier/claiming/${selected.id}/status`, {
        claim_status: selectedAction,
        reason_categories: selectedAction === "not_cleared" ? reasonCategories : undefined,
        verified_documents: matchedDocs,
        notes: notes || (selectedAction === "not_cleared" ? reasonCategories.join(" ") : undefined),
      });
      const completedAction = selectedAction;
      setClaimSuccess(res.data.message);
      setSelectedAction(null);
      setClaimingFeedback({
        type: completedAction,
        title: completedAction === "claimed" ? "Applicant Marked as Claimed" : "Applicant Marked as Not Cleared",
        message: res.data.message || (completedAction === "claimed" ? "The applicant has been successfully marked as Claimed." : "The applicant has been successfully marked as Not Cleared."),
      });
      setSelected(null);
      setControlNo("");
      setApplicantName("");
      handleSearch({ preventDefault: () => { } });
    } catch (err) {
      setClaimError(err.response?.data?.message || "Failed to update claiming status.");
      setTimeout(() => {
        claimingActionRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
      }, 0);
    } finally {
      setSubmitting(false);
    }
  }
  async function handleViewFile(docId, fileName) {
    try {
      const res = await api.get(`/applications/${selected.id}/documents/${docId}/file`, { responseType: "blob" });
      const url = URL.createObjectURL(res.data);
      setFilePreview({
        url,
        type: res.data.type || "",
        label: fileName || "Document Preview",
      });
    } catch {
      alert("Failed to load document.");
    }
  }
  function closeFilePreview() {
    setFilePreview((prev) => {
      if (prev?.url) URL.revokeObjectURL(prev.url);
      return null;
    });
  }
  function goToPage(page) {
    if (page < 1 || page > totalPages) return;
    setCurrentPage(page);
  }
  function getPageNumbers() {
    const pages = [];
    const maxVisible = 5;
    if (totalPages <= maxVisible) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
      return pages;
    }
    pages.push(1);
    if (currentPage > 3) pages.push("...");
    const start = Math.max(2, currentPage - 1);
    const end = Math.min(totalPages - 1, currentPage + 1);
    for (let i = start; i <= end; i++) pages.push(i);
    if (currentPage < totalPages - 2) pages.push("...");
    pages.push(totalPages);
    return pages;
  }
  const filteredDocs = selected?.documents?.filter((d) => d.status === "processed" || d.status === "failed") || [];
  const matchedDocs = DOC_TYPES.filter((d) => docStatus[d.key] === "matched").map((d) => d.key);
  const issueDocs = DOC_TYPES.filter((d) => docStatus[d.key] === "issue");
  const unreviewedCount = DOC_TYPES.filter((d) => docStatus[d.key] === "unreviewed").length;
  const claimedBlocked = unreviewedCount > 0 || issueDocs.length > 0;
  const isResolved = ["claimed", "not_cleared", "unclaimed"].includes(selected?.claiming_assignment?.claim_status);
  const sortedResults = [...results].sort((a, b) => {
    const aPending = a.claiming_assignment?.claim_status === "pending_claiming" ? 0 : 1;
    const bPending = b.claiming_assignment?.claim_status === "pending_claiming" ? 0 : 1;
    return aPending - bPending;
  });
  const totalPages = Math.max(1, Math.ceil(sortedResults.length / perPage));
  const pageStart = (currentPage - 1) * perPage;
  const pagedResults = sortedResults.slice(pageStart, pageStart + perPage);
  const showResultsCard = gracePeriodMode || searching || results.length > 0 || searchError;
  return (
    <div className="verifier-layout">
      <VerifierNavigation />
      <div className="verifier-main">
        <div className="verifier-topbar">
          <div className="verifier-topbar-user">
            <div className="verifier-topbar-user-text">
              <span className="verifier-topbar-user-name">Verifier User</span>
              <span className="verifier-topbar-user-role">Sangguniang Kabataan</span>
            </div>
            <div className="verifier-topbar-avatar"></div>
          </div>
        </div>
        <section className="page-section">
          <div className="container-fluid">
            <div className="verifier-dashboard-header">
              <div className="verifier-claiming-header-row">
                <div className="verifier-claiming-header-text">
                  <h3 className="verifier-dashboard-title">Claiming Approved Application</h3>
                  <p className="verifier-dashboard-desc">Search approved applicants, verify their physical documents, and update their final claiming status.</p>
                </div>
                {selected && (
                  <button type="button" className="verifier-claiming-header-back-btn" onClick={() => setSelected(null)}>Back to Claiming List</button>
                )}
              </div>
            </div>
            {selected ? (
              <>
                <div className="page-card verifier-review-info-card">
                  <div className="verifier-review-info-header">
                    <div className="verifier-review-info-header-top">
                      <h4 className="verifier-review-info-title">Applicant Details</h4>
                    </div>
                  </div>
                  <div className="verifier-review-profile-area">
                    <div className="verifier-review-profile-main">
                      {registrationPhotoStatus === "ready" ? (
                        <img src={registrationPhotoUrl} alt="Applicant registered profile" className="verifier-claiming-profile-photo" />
                      ) : registrationPhotoStatus === "loading" ? (
                        <div className="verifier-review-profile-avatar">
                          <div className="spinner-border spinner-border-sm" role="status"></div>
                        </div>
                      ) : (
                        <div className="verifier-review-profile-avatar">
                          {selected.user?.first_name?.charAt(0)}
                          {selected.user?.last_name?.charAt(0)}
                        </div>
                      )}
                      <div className="verifier-review-profile-content">
                        <h5 className="verifier-review-profile-name">{selected.user?.first_name} {selected.user?.last_name}</h5>
                      </div>
                    </div>
                  </div>
                  <div className="verifier-review-information-body">
                    <div className="verifier-review-information-column">
                      <p className="verifier-review-info-label">APPLICATION DETAILS</p>
                      <div className="verifier-review-details-grid verifier-review-details-grid-single">
                        <div className="verifier-review-detail-item">
                          <span className="verifier-review-detail-label">Application ID</span>
                          <span className="verifier-review-detail-value">APP-{selected.id}</span>
                        </div>
                        <div className="verifier-review-detail-item">
                          <span className="verifier-review-detail-label">Control Number</span>
                          <span className="verifier-review-detail-value">{selected.control_number}</span>
                        </div>
                        <div className="verifier-review-detail-item">
                          <span className="verifier-review-detail-label">Applicant Name</span>
                          <span className="verifier-review-detail-value">{selected.user?.first_name} {selected.user?.last_name}</span>
                        </div>
                        <div className="verifier-review-detail-item">
                          <span className="verifier-review-detail-label">School Name</span>
                          <span className="verifier-review-detail-value">{selected.school_name ?? "—"}</span>
                        </div>
                        <div className="verifier-review-detail-item">
                          <span className="verifier-review-detail-label">Course / Strand</span>
                          <span className="verifier-review-detail-value">{selected.course ?? "—"}</span>
                        </div>
                        <div className="verifier-review-detail-item">
                          <span className="verifier-review-detail-label">Year Level</span>
                          <span className="verifier-review-detail-value">{selected.year_level ?? "—"}</span>
                        </div>
                        <div className="verifier-review-detail-item">
                          <span className="verifier-review-detail-label">Student ID Number</span>
                          <span className="verifier-review-detail-value">{selected.student_id_number ?? "—"}</span>
                        </div>
                      </div>
                    </div>
                    <div className="verifier-review-information-divider"></div>
                    <div className="verifier-review-information-column">
                      <p className="verifier-review-info-label">CLAIMING DETAILS</p>
                      <div className="verifier-review-details-grid verifier-review-details-grid-single">
                        <div className="verifier-review-detail-item">
                          <span className="verifier-review-detail-label">Claiming Date</span>
                          <span className="verifier-review-detail-value">{selected.claiming_assignment?.lane?.claiming_date ? formatDateDisplay(selected.claiming_assignment.lane.claiming_date) : "—"}</span>
                        </div>
                        <div className="verifier-review-detail-item">
                          <span className="verifier-review-detail-label">Batch</span>
                          <span className="verifier-review-detail-value">{selected.claiming_assignment?.lane?.batch ? selected.claiming_assignment.lane.batch === "morning" ? "Morning" : "Afternoon" : "—"}</span>
                        </div>
                        <div className="verifier-review-detail-item">
                          <span className="verifier-review-detail-label">Assigned Lane</span>
                          <span className="verifier-review-detail-value">{selected.claiming_assignment?.lane?.lane_name ? <span className="lane-badge">{selected.claiming_assignment.lane.lane_name}</span> : "—"}</span>
                        </div>
                        <div className="verifier-review-detail-item">
                          <span className="verifier-review-detail-label">Current Claim Status</span>
                          <span className="verifier-review-detail-value"><ClaimStatusBadge status={selected.claiming_assignment?.claim_status} /></span>
                        </div>
                        {gracePeriodMode && (
                          <div className="verifier-review-detail-item">
                            <span className="verifier-review-detail-label">Assignment Type</span>
                            <span className="verifier-review-detail-value">
                              {selected.claiming_assignment?.source === "waitlist_promotion" ? (
                                <span className="verifier-claiming-type-badge verifier-claiming-type-promoted">Promoted</span>
                              ) : (
                                <span className="verifier-claiming-type-badge verifier-claiming-type-retrying">Retrying</span>
                              )}
                            </span>
                          </div>
                        )}
                        {selected.claiming_assignment?.verifier && (
                          <div className="verifier-review-detail-item">
                            <span className="verifier-review-detail-label">Disbursed By</span>
                            <span className="verifier-review-detail-value">{selected.claiming_assignment.verifier.first_name} {selected.claiming_assignment.verifier.last_name}</span>
                          </div>
                        )}
                        {selected.claiming_assignment?.verified_at && (
                          <div className="verifier-review-detail-item">
                            <span className="verifier-review-detail-label">Disbursed At</span>
                            <span className="verifier-review-detail-value">
                              {new Date(selected.claiming_assignment.verified_at).toLocaleString("en-US", {
                                month: "short",
                                day: "numeric",
                                year: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
                <div className="page-card verifier-claiming-combined-card">
                  <h4 className="verifier-application-list-title">Verification Process</h4>
                  <div className="verifier-claiming-split-card">
                    <div className="verifier-claiming-split-col verifier-claiming-verification-col">
                      <div className="verifier-claiming-step-heading">
                        <h4 className="verifier-claiming-search-title">Document Verification</h4>
                        <span className="verifier-claiming-step-badge">Step 1</span>
                      </div>
                      <div className="verifier-waitlist-notice">
                        <span className="verifier-waitlist-notice-icon">!</span>
                        <div className="verifier-waitlist-notice-body">
                          <p className="verifier-waitlist-notice-text">Confirm the physical documents match the approved record before identity verification.</p>
                        </div>
                      </div>
                      <div className="verifier-claiming-doc-list">
                        {DOC_TYPES.map((doc) => {
                          const uploadedDoc = filteredDocs.find((d) => d.document_type === doc.key);
                          const status = docStatus[doc.key];
                          return (
                            <div className="verifier-claiming-doc-card" key={doc.key}>
                              <div className="verifier-claiming-doc-top">
                                <div className="verifier-claiming-doc-heading">
                                  <span className="verifier-claiming-doc-icon"><i className={doc.key === "registration_form" ? "bi bi-file-earmark-text" : doc.key === "school_id" ? "bi bi-mortarboard" : "bi bi-patch-check"}></i></span>
                                  <div className="verifier-claiming-doc-copy">
                                    <h6>{doc.label}</h6>
                                    {uploadedDoc ? <button type="button" className="verifier-claiming-doc-file" onClick={() => handleViewFile(uploadedDoc.id, uploadedDoc.file_name)}>{uploadedDoc.file_name}</button> : <p>No uploaded copy available.</p>}
                                  </div>
                                </div>
                                <span className={`verifier-claiming-doc-status ${status === "matched" ? "verifier-claiming-doc-status-matched" : status === "issue" ? "verifier-claiming-doc-status-issue" : "verifier-claiming-doc-status-unreviewed"}`}>{status === "matched" ? "Matched" : status === "issue" ? "Issue Found" : "Not Reviewed"}</span>
                              </div>
                              <div className="verifier-claiming-doc-actions">
                                <button type="button" className={`verifier-claiming-doc-action verifier-claiming-doc-action-match ${status === "matched" ? "verifier-claiming-doc-action-active-match" : ""}`} onClick={() => setDocStatus(doc.key, "matched")}><i className="bi bi-check-lg"></i><span>Matched</span></button>
                                <button type="button" className={`verifier-claiming-doc-action verifier-claiming-doc-action-issue ${status === "issue" ? "verifier-claiming-doc-action-active-issue" : ""}`} onClick={() => setDocStatus(doc.key, "issue")}><i className="bi bi-exclamation-circle"></i><span>Issue Found</span></button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      <p className="verifier-claiming-step-note">Physical copies required for auditing</p>
                    </div>
                    <div className="verifier-claiming-split-col verifier-claiming-split-col-border verifier-claiming-verification-col">
                      <div className="verifier-claiming-step-heading">
                        <h4 className="verifier-claiming-mode-title">Face Verification</h4>
                        <span className="verifier-claiming-step-badge">Step 2</span>
                      </div>
                      <div className="verifier-waitlist-notice">
                        <span className="verifier-waitlist-notice-icon">!</span>
                        <div className="verifier-waitlist-notice-body">
                          <p className="verifier-waitlist-notice-text">Verify the applicant’s identity using the registered photo before updating the final claiming status.</p>
                        </div>
                      </div>
                      <div className="verifier-claiming-face-panel">
                        <ClaimingFaceVerify applicationId={selected.id} required={gracePeriodMode} registrationPhotoUrl={registrationPhotoUrl} registrationPhotoStatus={registrationPhotoStatus} />
                      </div>
                      <p className="verifier-claiming-step-note">Final identity confirmation before claiming</p>
                    </div>
                  </div>
                  <div ref={claimingActionRef}>
                    {isResolved ? (
                      <div className="alert alert-secondary mb-0">
                        This application has already been marked as{" "}
                        <ClaimStatusBadge status={selected.claiming_assignment?.claim_status} />. No further action is available here.
                      </div>
                    ) : (
                      <>
                        <div className="d-flex flex-wrap justify-content-end gap-2 mt-3 mb-3">
                          <button type="button" className="btn btn-success verifier-claiming-status-action-btn" onClick={() => chooseAction("claimed")}>Mark as Claimed</button>
                          <button type="button" className="btn btn-danger verifier-claiming-status-action-btn" onClick={() => chooseAction("not_cleared")}>Mark as Not Cleared</button>
                        </div>
                        {selectedAction === "claimed" && claimedBlocked && (
                          <div className="verifier-waitlist-notice verifier-claiming-validation-notice">
                            <span className="verifier-waitlist-notice-icon">!</span>
                            <div className="verifier-waitlist-notice-body">
                              <p className="verifier-waitlist-notice-text">
                                <strong>Cannot mark as Claimed yet.</strong>{" "}
                                {unreviewedCount > 0 && `${unreviewedCount} document(s) have not been reviewed. `}
                                {issueDocs.length > 0 &&
                                  `${issueDocs.map((d) => d.label).join(", ")} ${issueDocs.length === 1 ? "was" : "were"} flagged with an issue. `}
                                Please complete document verification first.
                              </p>
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="page-card verifier-claiming-combined-card">
                  <h4 className="verifier-application-list-title">Claiming Application</h4>
                  <div className="verifier-claiming-split-card">
                    <div className="verifier-claiming-split-col">
                      <h4 className="verifier-claiming-mode-title">Claiming Mode</h4>
                      <div className="verifier-claiming-phase">
                        <span className="verifier-claiming-phase-label">Claiming Phase Selection</span>
                        <div className="verifier-claiming-mode-tabs">
                          <button type="button" className={`verifier-claiming-mode-btn ${!gracePeriodMode ? "verifier-claiming-mode-btn-active" : ""}`} onClick={switchToRegularMode}>Regular Claiming</button>
                          <button type="button" className={`verifier-claiming-mode-btn ${gracePeriodMode ? "verifier-claiming-mode-btn-active" : ""}`} onClick={switchToGracePeriodMode}>Grace Period List</button>
                        </div>
                      </div>
                      {gracePeriodMode ? (
                        gracePeriodDates.start && gracePeriodDates.end ? (
                          <div className="verifier-claiming-context verifier-claiming-context-warning">
                            <span className="verifier-claiming-context-icon"><i className="bi bi-calendar3"></i></span>
                            <div className="verifier-claiming-context-content">
                              <strong>Grace Period</strong>
                              <span>— Day {Math.max(1, daysBetween(gracePeriodDates.start, todayStr()) + 1)}/{daysBetween(gracePeriodDates.start, gracePeriodDates.end) + 1}{" "}({formatDateDisplay(gracePeriodDates.start)} – {formatDateDisplay(gracePeriodDates.end)})</span>
                            </div>
                          </div>
                        ) : (
                          <div className="verifier-claiming-context verifier-claiming-context-neutral">
                            <span className="verifier-claiming-notice-icon"><i className="bi bi-exclamation-lg"></i></span>
                            <div className="verifier-claiming-context-content">
                              <span>No grace period configured for the active schedule.</span>
                            </div>
                          </div>
                        )
                      ) : (
                        <>
                          <div className="verifier-claiming-context verifier-claiming-context-info">
                            <span className="verifier-claiming-context-icon"><i className="bi bi-calendar3"></i></span>
                            <div className="verifier-claiming-context-content">
                              <strong>Today — {formatDateDisplay(todayStr())}</strong>
                              {todaysLanes.length > 0 ? (
                                <span>— Lanes claiming today:{" "}{todaysLanes.map((lane) => `${lane.lane_name} (${lane.batch === "morning" ? "Morning" : "Afternoon"})`).join(", ")}</span>
                              ) : (
                                <span>— No lanes scheduled to claim today.</span>
                              )}
                              {assignedLane && (
                                <span className="verifier-claiming-current-lane">
                                  Currently viewing: <strong>{assignedLane.lane_name}</strong>{" "}({formatDateDisplay(assignedLane.claiming_date)})
                                  {assignedLane.claiming_date < todayStr() && <span className="text-danger ms-1">— this lane&apos;s date has already passed</span>}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="verifier-claiming-lane-section">
                            <label className="verifier-claiming-label">Lane / Schedule</label>
                            {assignedLane && (
                              <div className="verifier-claiming-assigned-lane">
                                You&apos;re currently assigned to <strong>{assignedLane.lane_name}</strong>{" "}({assignedLane.batch === "morning" ? "Morning" : "Afternoon"}, {assignedLane.claiming_date}).
                              </div>
                            )}
                            <select className="form-select verifier-claiming-select" value={selectedLaneId} onChange={(e) => setSelectedLaneId(e.target.value)}>
                              <option value="">All lanes</option>
                              {allLanes.map((lane) => (
                                <option key={lane.id} value={lane.id}>
                                  {lane.claiming_date} — {lane.batch === "morning" ? "Morning" : "Afternoon"} — {lane.lane_name}
                                  {lane.verifier_id && lane.id !== assignedLane?.id ? " (assigned to another verifier)" : ""}
                                </option>
                              ))}
                            </select>
                            {selectedLaneId && (!assignedLane || String(assignedLane.id) !== selectedLaneId) && (
                              <button type="button" className="verifier-waitlist-action-btn mt-2" onClick={() => handleSelfAssign(selectedLaneId)} disabled={assigningLane}>
                                {assigningLane ? "Assigning..." : "Make this my lane"}
                              </button>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                    <div className="verifier-claiming-split-col verifier-claiming-split-col-border">
                      <h4 className="verifier-claiming-search-title">Search Applicant</h4>
                      <div className={`verifier-claiming-search-box ${gracePeriodMode ? "verifier-claiming-search-disabled" : ""}`}>
                        <form onSubmit={handleSearch}>
                          <fieldset disabled={gracePeriodMode} className="verifier-claiming-search-fieldset">
                            <div className="mb-3">
                              <label className="verifier-claiming-label">Control Number</label>
                              <input type="text" className="form-control verifier-claiming-input" placeholder="e.g. SK-2026-0001" value={controlNo} onChange={(e) => setControlNo(e.target.value)} />
                            </div>
                            <div className="mb-3">
                              <label className="verifier-claiming-label">Applicant Name</label>
                              <input type="text" className="form-control verifier-claiming-input" placeholder="Enter first or last name" value={applicantName} onChange={(e) => setApplicantName(e.target.value)} />
                            </div>
                            <button type="submit" className="verifier-claiming-search-btn" disabled={searching || gracePeriodMode}>
                              {searching && !gracePeriodMode ? "Searching..." : "Search"}
                            </button>
                          </fieldset>
                        </form>
                        {gracePeriodMode ? (
                          <p className="verifier-claiming-search-disabled-text">Search is unavailable while viewing the Grace Period List.</p>
                        ) : results.length === 0 && !searching && !searchError ? (
                          <p className="text-muted small mt-3 mb-0">No results yet — search above.</p>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </div>
                {showResultsCard && (
                  <div className="page-card verifier-attention-card verifier-claiming-results-card">
                    <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3">
                      <h4 className="verifier-claiming-results-title mb-0">{gracePeriodMode ? "Grace Period Applicants" : "Search Results"}</h4>
                      {gracePeriodMode && (
                        <button type="button" className="verifier-ocr-refresh-btn" onClick={() => handleSearch({ preventDefault: () => { } })} disabled={searching} title="Refresh list" aria-label="Refresh list">
                          <svg className={`verifier-ocr-refresh-icon ${searching ? "verifier-ocr-refresh-icon-spinning" : ""}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="23 4 23 10 17 10" />
                            <polyline points="1 20 1 14 7 14" />
                            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10" />
                            <path d="M20.49 15a9 9 0 0 1-14.85 3.36L1 14" />
                          </svg>
                        </button>
                      )}
                    </div>
                    {searchError && (
                      <div className="verifier-claiming-error-notice mt-3">
                        <span className="verifier-claiming-notice-icon"><i className="bi bi-exclamation-lg"></i></span>
                        <span>{searchError}</span>
                      </div>
                    )}
                    {(searching || results.length > 0) && (
                      <>
                        <div className="table-responsive mt-3 verifier-claiming-table-wrap">
                          <table className="table table-bordered table-striped align-middle verifier-attention-table verifier-claiming-results-table">
                            {gracePeriodMode ? (
                              <colgroup>
                                <col style={{ width: "15%" }} />
                                <col style={{ width: "15%" }} />
                                <col style={{ width: "25%" }} />
                                <col style={{ width: "15%" }} />
                                <col style={{ width: "10%" }} />
                                <col style={{ width: "10%" }} />
                              </colgroup>
                            ) : (
                              <colgroup>
                                <col style={{ width: "15%" }} />
                                <col style={{ width: "15%" }} />
                                <col style={{ width: "25%" }} />
                                <col style={{ width: "15%" }} />
                                <col style={{ width: "10%" }} />
                              </colgroup>
                            )}
                            <thead>
                              <tr>
                                <th>Control Number</th>
                                <th>Applicant Name</th>
                                <th>School</th>
                                <th>Status</th>
                                {gracePeriodMode && <th>Type</th>}
                                <th>Action</th>
                              </tr>
                            </thead>
                            <tbody>
                              {searching ? (
                                <tr>
                                  <td colSpan={gracePeriodMode ? 6 : 5} className="text-center py-4">
                                    <div className="spinner-border text-danger" role="status">
                                      <span className="visually-hidden">Loading...</span>
                                    </div>
                                  </td>
                                </tr>
                              ) : (
                                pagedResults.map((app) => (
                                  <tr key={app.id}>
                                    <td>{app.control_number}</td>
                                    <td>{app.user?.first_name} {app.user?.last_name}</td>
                                    <td>{app.school_name}</td>
                                    <td className="verifier-claiming-status-cell">
                                      <ClaimStatusBadge status={app.claiming_assignment?.claim_status} />
                                    </td>
                                    {gracePeriodMode && (
                                      <td className="verifier-claiming-type-cell">
                                        {app.claiming_assignment?.source === "waitlist_promotion" && (
                                          <span className="verifier-claiming-type-badge verifier-claiming-type-promoted">Promoted</span>
                                        )}
                                        {(app.claiming_assignment?.source === "grace_period_retry" || app.claiming_assignment?.source === "original") && (
                                          <span className="verifier-claiming-type-badge verifier-claiming-type-retrying">Retrying</span>
                                        )}
                                      </td>
                                    )}
                                    <td className="verifier-attention-action">
                                      <button type="button" className="btn-save-green" onClick={() => selectApplicant(app)}>Select</button>
                                    </td>
                                  </tr>
                                ))
                              )}
                            </tbody>
                          </table>
                        </div>
                        {!searching && (
                          <div className="verifier-table-pagination-bar">
                            <span className="verifier-table-pagination-info">
                              Showing {pageStart + 1}–{Math.min(pageStart + perPage, sortedResults.length)} of{" "}{sortedResults.length} applicants
                            </span>
                            <div className="verifier-table-pagination-controls">
                              <button type="button" className="verifier-table-pagination-arrow" onClick={() => goToPage(currentPage - 1)} disabled={currentPage === 1} aria-label="Previous page">‹</button>
                              {getPageNumbers().map((page, idx) =>
                                page === "..." ? (
                                  <span key={`ellipsis-${idx}`} className="verifier-table-pagination-ellipsis">…</span>
                                ) : (
                                  <button type="button" key={page} className={`verifier-table-pagination-page ${page === currentPage ? "verifier-table-pagination-page-active" : ""}`} onClick={() => goToPage(page)}>{page}</button>
                                )
                              )}
                              <button type="button" className="verifier-table-pagination-arrow" onClick={() => goToPage(currentPage + 1)} disabled={currentPage === totalPages} aria-label="Next page">›</button>
                            </div>
                          </div>
                        )}
                      </>
                    )}
                    {results.length === 0 && !searching && !searchError && (
                      <p className="text-muted small mt-3 mb-0">
                        {gracePeriodMode ? "No applicants currently in the grace period list." : "No matching applicants found."}
                      </p>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </section>
        {selectedAction === "claimed" && !claimedBlocked && selected && (
          <div className="verifier-claiming-action-modal-backdrop" onClick={closeClaimingActionModal}>
            <div className="verifier-claiming-action-modal verifier-claiming-action-modal-small" onClick={(e) => e.stopPropagation()}>
              <div className="verifier-claiming-action-modal-header">
                <div className="verifier-claiming-action-modal-heading">
                  <span className="verifier-claiming-action-modal-icon verifier-claiming-action-modal-icon-claimed">✓</span>
                  <div>
                    <h5>Mark as Claimed</h5>
                    <span>Confirm final claiming status</span>
                  </div>
                </div>
                <button type="button" className="verifier-claiming-action-modal-close" onClick={closeClaimingActionModal} disabled={submitting} aria-label="Close claiming confirmation">×</button>
              </div>
              <div className="verifier-claiming-action-modal-body">
                {claimError && <div className="verifier-claiming-action-modal-error">{claimError}</div>}
                <div className="verifier-claiming-quick-notes">
                  <span className="verifier-claiming-quick-notes-label">Quick Notes</span>
                  <div className="verifier-claiming-quick-notes-list">
                    {CLAIMED_QUICK_NOTES.map((note) => (
                      <button type="button" key={note} className="verifier-claiming-quick-note-btn" onClick={() => setNotes(note)}>{note}</button>
                    ))}
                  </div>
                </div>
                <div className="verifier-claiming-action-field">
                  <label>Additional Notes (optional)</label>
                  <textarea className="form-control" rows="4" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Add any notes about this claiming transaction..." />
                </div>
              </div>
              <div className="verifier-claiming-action-modal-footer">
                <button type="button" className="verifier-claiming-action-modal-cancel" onClick={closeClaimingActionModal} disabled={submitting}>Cancel</button>
                <button type="button" className="verifier-claiming-action-modal-confirm verifier-claiming-action-modal-confirm-claimed" onClick={handleConfirm} disabled={submitting}>
                  {submitting ? "Submitting..." : "Confirm — Mark as Claimed"}
                </button>
              </div>
            </div>
          </div>
        )}
        {selectedAction === "not_cleared" && selected && (
          <div className="verifier-claiming-action-modal-backdrop" onClick={closeClaimingActionModal}>
            <div className="verifier-claiming-action-modal verifier-claiming-action-modal-medium" onClick={(e) => e.stopPropagation()}>
              <div className="verifier-claiming-action-modal-header">
                <div className="verifier-claiming-action-modal-heading">
                  <span className="verifier-claiming-action-modal-icon verifier-claiming-action-modal-icon-not-cleared">!</span>
                  <div>
                    <h5>Mark as Not Cleared</h5>
                    <span>Select the reason before confirming</span>
                  </div>
                </div>
                <button type="button" className="verifier-claiming-action-modal-close" onClick={closeClaimingActionModal} disabled={submitting} aria-label="Close not cleared confirmation">×</button>
              </div>
              <div className="verifier-claiming-action-modal-body">
                {claimError && <div className="verifier-claiming-action-modal-error">{claimError}</div>}
                <div className="verifier-claiming-action-reasons">
                  <label className="verifier-claiming-action-reasons-title">Not Cleared Reason(s) *</label>
                  {NOT_CLEARED_REASONS.map((reason) => (
                    <div className="verifier-claiming-action-reason-option" key={reason}>
                      <input className="form-check-input" type="checkbox" id={`nc-${reason}`} checked={notClearedReasons.includes(reason)} onChange={() => toggleNotClearedReason(reason)} />
                      <label className="form-check-label" htmlFor={`nc-${reason}`}>{reason}</label>
                    </div>
                  ))}
                  {notClearedReasons.includes(OTHER) && (
                    <input className="form-control form-control-sm verifier-claiming-action-other-input" placeholder="Specify the reason..." value={notClearedOtherText} onChange={(e) => setNotClearedOtherText(e.target.value)} />
                  )}
                </div>
                <div className="verifier-claiming-quick-notes">
                  <span className="verifier-claiming-quick-notes-label">Quick Notes</span>
                  <div className="verifier-claiming-quick-notes-list">
                    {NOT_CLEARED_QUICK_NOTES.map((note) => (
                      <button type="button" key={note} className="verifier-claiming-quick-note-btn" onClick={() => setNotes(note)}>{note}</button>
                    ))}
                  </div>
                </div>
                <div className="verifier-claiming-action-field">
                  <label>Additional Notes (optional)</label>
                  <textarea className="form-control" rows="4" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Add any notes about this claiming transaction..." />
                </div>
              </div>
              <div className="verifier-claiming-action-modal-footer">
                <button type="button" className="verifier-claiming-action-modal-cancel" onClick={closeClaimingActionModal} disabled={submitting}>Cancel</button>
                <button type="button" className="verifier-claiming-action-modal-confirm verifier-claiming-action-modal-confirm-not-cleared" onClick={handleConfirm} disabled={submitting}>
                  {submitting ? "Submitting..." : "Confirm — Mark as Not Cleared"}
                </button>
              </div>
            </div>
          </div>
        )}
        {claimingFeedback && (
          <div className="verifier-claiming-feedback-backdrop" onClick={() => setClaimingFeedback(null)}>
            <div className="verifier-claiming-feedback-popup" onClick={(e) => e.stopPropagation()}>
              <div className={`verifier-claiming-feedback-icon ${claimingFeedback.type === "claimed" ? "verifier-claiming-feedback-icon-claimed" : "verifier-claiming-feedback-icon-not-cleared"}`}>
                {claimingFeedback.type === "claimed" ? "✓" : "!"}
              </div>
              <h4 className="verifier-claiming-feedback-title">{claimingFeedback.title}</h4>
              <p className="verifier-claiming-feedback-message">{claimingFeedback.message}</p>
              <button type="button" className={`verifier-claiming-feedback-dismiss ${claimingFeedback.type === "claimed" ? "verifier-claiming-feedback-dismiss-claimed" : "verifier-claiming-feedback-dismiss-not-cleared"}`} onClick={() => setClaimingFeedback(null)}>
                <span>Done</span>
                <span className="verifier-claiming-feedback-button-right">
                  <span className="verifier-claiming-feedback-arrow">→</span>
                  <span className="verifier-claiming-feedback-timer">{feedbackCountdown}s</span>
                </span>
              </button>
            </div>
          </div>
        )}
        {filePreview && (
          <div className="verifier-preview-modal" onClick={closeFilePreview}>
            <div className="verifier-preview-modal-content" onClick={(e) => e.stopPropagation()}>
              <button type="button" className="verifier-preview-modal-close" onClick={closeFilePreview} aria-label="Close preview">×</button>
              {filePreview.type.startsWith("image/") ? (
                <img src={filePreview.url} alt={`${filePreview.label} enlarged preview`} className="verifier-preview-modal-image" />
              ) : (
                <iframe src={filePreview.url} title={`${filePreview.label} enlarged preview`} className="verifier-preview-modal-pdf" />
              )}
            </div>
          </div>
        )}
        <PanelFooter />
      </div>
    </div>
  );
}
export default VerifierClaiming;