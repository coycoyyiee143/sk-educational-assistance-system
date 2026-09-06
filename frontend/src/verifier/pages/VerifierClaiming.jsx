import { useState, useEffect, useRef } from "react";
import VerifierNavigation from "../components/VerifierNavigation";
import ClaimingFaceVerify from "../components/ClaimingFaceVerify";
import PanelFooter from "../../components/PanelFooter";
import api from "../../services/api";
import { DOC_TYPES, NOT_CLEARED_REASONS, OTHER } from "../constants/verificationReasons";
import { STATUS_CONFIG } from "../../components/StatusConstants";
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
  return new Date(dateStr + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
function VerifierClaiming() {
  const [navHeight, setNavHeight] = useState(0);
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
  const detailsRef = useRef(null);
  const claimingActionRef = useRef(null);
  const [registrationPhotoUrl, setRegistrationPhotoUrl] = useState(null);
  const [registrationPhotoStatus, setRegistrationPhotoStatus] = useState("idle");
  const [assignedLane, setAssignedLane] = useState(null);
  const [allLanes, setAllLanes] = useState([]);
  const [gracePeriodDates, setGracePeriodDates] = useState({ start: null, end: null });
  const todaysLanes = allLanes.filter((l) => l.claiming_date === todayStr());
  const [selectedLaneId, setSelectedLaneId] = useState("");
  const [gracePeriodMode, setGracePeriodMode] = useState(false);
  const [assigningLane, setAssigningLane] = useState(false);
  const [lanesLoaded, setLanesLoaded] = useState(false);
  const modeManuallySetRef = useRef(false);
  const perPage = 10;
  function fetchLanes() {
    api.get("/verifier/claiming/lanes")
      .then((res) => {
        setAssignedLane(res.data.assigned_lane ?? null);
        setAllLanes(res.data.all_lanes ?? []);
        if (res.data.assigned_lane) setSelectedLaneId(String(res.data.assigned_lane.id));
        setGracePeriodDates({ start: res.data.grace_period_date ?? null, end: res.data.grace_period_end_date ?? null });
        if (!modeManuallySetRef.current) {
          const today = todayStr();
          const gpStart = res.data.grace_period_date;
          const gpEnd = res.data.grace_period_end_date;
          const isGracePeriodNow = gpStart && gpEnd && today >= gpStart && today <= gpEnd;
          setGracePeriodMode(isGracePeriodNow);
        }
        setLanesLoaded(true);
      })
      .catch(() => setLanesLoaded(true));
  }
  useEffect(() => {
    fetchLanes();
  }, []);
  useEffect(() => {
    function measureNav() {
      const nav = document.querySelector("nav");
      setNavHeight(nav ? nav.getBoundingClientRect().height : 0);
    }
    measureNav();
    window.addEventListener("resize", measureNav);
    return () => window.removeEventListener("resize", measureNav);
  }, []);
  useEffect(() => {
    if (!lanesLoaded) return;
    if (gracePeriodMode) handleSearch({ preventDefault: () => {} });
    else if (assignedLane) handleSearch({ preventDefault: () => {} });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lanesLoaded, gracePeriodMode, assignedLane]);
  useEffect(() => {
    return () => {
      if (registrationPhotoUrl) URL.revokeObjectURL(registrationPhotoUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  function setDocStatus(key, status) {
    setDocStatusState((prev) => ({ ...prev, [key]: status }));
  }
  function toggleNotClearedReason(reason) {
    setNotClearedReasons((prev) => prev.includes(reason) ? prev.filter((r) => r !== reason) : [...prev, reason]);
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
    if (assignedLane) setSelectedLaneId(String(assignedLane.id));
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
      if (gracePeriodMode) params.grace_period = 1;
      else {
        if (selectedLaneId) params.lane_id = selectedLaneId;
        if (controlNo.trim()) params.control_number = controlNo.trim();
        if (applicantName.trim()) params.name = applicantName.trim();
      }
      const res = await api.get("/verifier/claiming/search", { params });
      setResults(res.data);
      setCurrentPage(1);
      if (res.data.length === 1) selectApplicant(res.data[0]);
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
    setTimeout(() => {
      detailsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 0);
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
      setClaimSuccess(res.data.message);
      setSelected(null);
      setControlNo("");
      setApplicantName("");
      handleSearch({ preventDefault: () => {} });
    } catch (err) {
      setClaimError(err.response?.data?.message || "Failed to update claiming status.");
      setTimeout(() => {
        claimingActionRef.current?.scrollIntoView({ behavior: "smooth", center: "center" });
      }, 0);
    } finally {
      setSubmitting(false);
    }
  }
  async function handleViewFile(docId) {
    try {
      const res = await api.get(`/applications/${selected.id}/documents/${docId}/file`, { responseType: "blob" });
      const url = URL.createObjectURL(res.data);
      window.open(url, "_blank");
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch {
      alert("Failed to load document.");
    }
  }
  function jumpTo(ref) {
    ref.current?.scrollIntoView({ behavior: "smooth", block: "start" });
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
              <h3 className="verifier-dashboard-title">Claiming Approved Application</h3>
              <p className="verifier-dashboard-desc">Search approved applicants, verify their physical documents, and update their final claiming status.</p>
            </div>
            <div className="page-card verifier-claiming-mode-card">
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
                      <span>— Day {Math.max(1, daysBetween(gracePeriodDates.start, todayStr()) + 1)}/{daysBetween(gracePeriodDates.start, gracePeriodDates.end) + 1} ({formatDateDisplay(gracePeriodDates.start)} – {formatDateDisplay(gracePeriodDates.end)})</span>
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
                <div className="verifier-claiming-context verifier-claiming-context-info">
                  <span className="verifier-claiming-context-icon"><i className="bi bi-calendar3"></i></span>
                  <div className="verifier-claiming-context-content">
                    <strong>Today — {formatDateDisplay(todayStr())}</strong>
                    {todaysLanes.length > 0 ? (
                      <span>— Lanes claiming today: {todaysLanes.map((l) => `${l.lane_name} (${l.batch === "morning" ? "Morning" : "Afternoon"})`).join(", ")}</span>
                    ) : (
                      <span>— No lanes scheduled to claim today.</span>
                    )}
                    {assignedLane && (
                      <span className="verifier-claiming-current-lane">
                        Currently viewing: <strong>{assignedLane.lane_name}</strong> ({formatDateDisplay(assignedLane.claiming_date)})
                        {assignedLane.claiming_date < todayStr() && <span className="text-danger ms-1">— this lane's date has already passed</span>}
                      </span>
                    )}
                  </div>
                </div>
              )}
              {!gracePeriodMode && (
                <div className="verifier-claiming-lane-section">
                  <label className="verifier-claiming-label">Lane / Schedule</label>
                  {assignedLane && (
                    <div className="verifier-claiming-assigned-lane">
                      You're currently assigned to <strong>{assignedLane.lane_name}</strong> ({assignedLane.batch === "morning" ? "Morning" : "Afternoon"}, {assignedLane.claiming_date}).
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
              )}
            </div>
            <div className="page-card verifier-attention-card">
              <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3">
                <h4 className="verifier-application-list-title mb-0">{gracePeriodMode ? "Grace Period Applicants" : "Search Applicant"}</h4>
                {gracePeriodMode && (
                  <button
                    type="button"
                    className="verifier-ocr-refresh-btn"
                    onClick={() => handleSearch({ preventDefault: () => {} })}
                    disabled={searching}
                    title="Refresh list"
                    aria-label="Refresh list"
                  >
                    <svg
                      className={`verifier-ocr-refresh-icon ${searching ? "verifier-ocr-refresh-icon-spinning" : ""}`}
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <polyline points="23 4 23 10 17 10" />
                      <polyline points="1 20 1 14 7 14" />
                      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10" />
                      <path d="M20.49 15a9 9 0 0 1-14.85 3.36L1 14" />
                    </svg>
                  </button>
                )}
              </div>
              {!gracePeriodMode && (
                <div className="verifier-claiming-search-box">
                  <form onSubmit={handleSearch}>
                    <div className="row g-3 align-items-end">
                      <div className="col-md-5">
                        <label className="verifier-claiming-label">Control Number</label>
                        <input type="text" className="form-control verifier-claiming-input" placeholder="e.g. SK-2026-0001" value={controlNo} onChange={(e) => setControlNo(e.target.value)} />
                      </div>
                      <div className="col-md-5">
                        <label className="verifier-claiming-label">Applicant Name</label>
                        <input type="text" className="form-control verifier-claiming-input" placeholder="Enter first or last name" value={applicantName} onChange={(e) => setApplicantName(e.target.value)} />
                      </div>
                      <div className="col-md-2 d-grid">
                        <button className="verifier-claiming-search-btn" type="submit" disabled={searching}>
                          {searching ? "Searching..." : "Search"}
                        </button>
                      </div>
                    </div>
                  </form>
                </div>
              )}
              {gracePeriodMode && searching && <p className="text-muted small mt-2 mb-0">Loading grace period list...</p>}
              {searchError && (
                <div className="verifier-claiming-error-notice mt-3">
                  <span className="verifier-claiming-notice-icon"><i className="bi bi-exclamation-lg"></i></span>
                  <span>{searchError}</span>
                </div>
              )}
              {results.length > 0 && (
                <>
                  <div className="table-responsive mt-3">
                    <table className="table table-bordered table-striped align-middle verifier-attention-table">
                      <colgroup>
                        <col style={{ width: gracePeriodMode ? "18%" : "21%" }} />
                        <col style={{ width: gracePeriodMode ? "24%" : "27%" }} />
                        <col style={{ width: gracePeriodMode ? "22%" : "25%" }} />
                        <col style={{ width: "16%" }} />
                        {gracePeriodMode && <col style={{ width: "12%" }} />}
                        <col style={{ width: gracePeriodMode ? "8%" : "11%" }} />
                      </colgroup>
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
                        {pagedResults.map((app) => (
                          <tr key={app.id} className={selected?.id === app.id ? "table-active" : ""} style={{ cursor: "pointer" }} onClick={() => selectApplicant(app)}>
                            <td>{app.control_number}</td>
                            <td>{app.user?.first_name} {app.user?.last_name}</td>
                            <td>{app.school_name}</td>
                            <td><ClaimStatusBadge status={app.claiming_assignment?.claim_status} /></td>
                            {gracePeriodMode && (
                              <td>
                                {app.claiming_assignment?.source === "waitlist_promotion" && <span className="badge bg-warning text-dark">Promoted</span>}
                                {(app.claiming_assignment?.source === "grace_period_retry" || app.claiming_assignment?.source === "original") && <span className="badge bg-info text-dark">Retrying</span>}
                              </td>
                            )}
                            <td className="verifier-attention-action">
                              <button className="verifier-review-btn" onClick={(e) => { e.stopPropagation(); selectApplicant(app); }}>
                                {selected?.id === app.id ? "Selected" : "Select"}
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="verifier-table-pagination-bar">
                    <span className="verifier-table-pagination-info">
                      Showing {pageStart + 1}–{Math.min(pageStart + perPage, sortedResults.length)} of {sortedResults.length} applicants
                    </span>
                    <div className="verifier-table-pagination-controls">
                      <button
                        className="verifier-table-pagination-arrow"
                        onClick={() => goToPage(currentPage - 1)}
                        disabled={currentPage === 1}
                        aria-label="Previous page"
                      >
                        ‹
                      </button>
                      {getPageNumbers().map((page, idx) =>
                        page === "..." ? (
                          <span key={`ellipsis-${idx}`} className="verifier-table-pagination-ellipsis">…</span>
                        ) : (
                          <button
                            key={page}
                            className={`verifier-table-pagination-page ${page === currentPage ? "verifier-table-pagination-page-active" : ""}`}
                            onClick={() => goToPage(page)}
                          >
                            {page}
                          </button>
                        )
                      )}
                      <button
                        className="verifier-table-pagination-arrow"
                        onClick={() => goToPage(currentPage + 1)}
                        disabled={currentPage === totalPages}
                        aria-label="Next page"
                      >
                        ›
                      </button>
                    </div>
                  </div>
                </>
              )}
              {results.length === 0 && !searching && !searchError && (
                <p className="text-muted small mt-3 mb-0">
                  {gracePeriodMode ? "No applicants currently in the grace period list." : "No results yet — search above."}
                </p>
              )}
            </div>
            {selected && (
              <>
                <div className="page-card verifier-claiming-selected-bar" style={{ position: "sticky", top: `${navHeight + 8}px`, zIndex: 9 }}>
                  <div className="d-flex justify-content-between align-items-center flex-wrap gap-2">
                    <div className="d-flex align-items-center gap-2">
                      {registrationPhotoStatus === "ready" && <img src={registrationPhotoUrl} alt="Registered photo on file" className="verifier-claiming-summary-photo" />}
                      {registrationPhotoStatus === "loading" && (
                        <div className="verifier-claiming-summary-photo verifier-claiming-summary-photo-placeholder">
                          <div className="spinner-border spinner-border-sm text-secondary" role="status" />
                        </div>
                      )}
                      {registrationPhotoStatus === "none" && <div className="verifier-claiming-summary-photo verifier-claiming-summary-photo-placeholder">N/A</div>}
                      <div>
                        <strong>{selected.user?.first_name} {selected.user?.last_name}</strong>
                        <span className="text-muted mx-2">·</span>
                        <span className="text-muted">{selected.control_number}</span>
                        <span className="ms-2"><ClaimStatusBadge status={selected.claiming_assignment?.claim_status} /></span>
                        {gracePeriodMode && <span className="badge bg-warning text-dark ms-2">Grace Period</span>}
                      </div>
                    </div>
                    <div className="d-flex flex-wrap gap-2">
                      <button type="button" className="verifier-waitlist-action-btn" onClick={() => jumpTo(detailsRef)}>Details</button>
                      <button type="button" className="verifier-waitlist-action-btn" onClick={() => jumpTo(claimingActionRef)}>Claiming Action</button>
                      <button type="button" className="verifier-waitlist-action-btn" onClick={() => setSelected(null)}>Close</button>
                    </div>
                  </div>
                </div>
                <div className="page-card verifier-attention-card" ref={detailsRef}>
                  <h4 className="verifier-application-list-title">Applicant Details</h4>
                  <div className="table-responsive">
                    <table className="table table-bordered align-middle verifier-claiming-details-table">
                      <tbody>
                        <tr><th>Application ID</th><td>APP-{selected.id}</td></tr>
                        <tr><th>Control Number</th><td>{selected.control_number}</td></tr>
                        <tr><th>Applicant Name</th><td>{selected.user?.first_name} {selected.user?.last_name}</td></tr>
                        <tr><th>School Name</th><td>{selected.school_name}</td></tr>
                        <tr><th>Course / Strand</th><td>{selected.course}</td></tr>
                        <tr><th>Year Level</th><td>{selected.year_level}</td></tr>
                        <tr><th>Student ID Number</th><td>{selected.student_id_number}</td></tr>
                        {selected.claiming_assignment?.lane && (
                          <>
                            <tr><th>Claiming Date</th><td>{selected.claiming_assignment.lane.claiming_date}</td></tr>
                            <tr><th>Batch</th><td>{selected.claiming_assignment.lane.batch === "morning" ? "Morning" : "Afternoon"}</td></tr>
                            <tr><th>Lane</th><td><span className="lane-badge">{selected.claiming_assignment.lane.lane_name}</span></td></tr>
                          </>
                        )}
                        <tr><th>Current Claim Status</th><td><ClaimStatusBadge status={selected.claiming_assignment?.claim_status} /></td></tr>
                        {gracePeriodMode && (
                          <tr>
                            <th>Assignment Type</th>
                            <td>
                              {selected.claiming_assignment?.source === "waitlist_promotion"
                                ? <span className="badge bg-warning text-dark">Promoted from Waitlist</span>
                                : <span className="badge bg-info text-dark">Retrying (Grace Period)</span>}
                            </td>
                          </tr>
                        )}
                        {selected.claiming_assignment?.verifier && (
                          <tr><th>Disbursed By</th><td>{selected.claiming_assignment.verifier.first_name} {selected.claiming_assignment.verifier.last_name}</td></tr>
                        )}
                        {selected.claiming_assignment?.verified_at && (
                          <tr>
                            <th>Disbursed At</th>
                            <td>{new Date(selected.claiming_assignment.verified_at).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" })}</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
                <div className="page-card verifier-attention-card">
                  <h4 className="verifier-application-list-title">Face Verification</h4>
                  <p className="text-muted small mb-3">Confirm this is really the applicant before proceeding to document checks.</p>
                  <div className="mb-3 d-flex align-items-center gap-3">
                    {registrationPhotoStatus === "ready" && <img src={registrationPhotoUrl} alt="Registered photo on file" className="verifier-claiming-reference-photo" />}
                    {registrationPhotoStatus === "loading" && (
                      <div className="verifier-claiming-reference-photo verifier-claiming-reference-placeholder">
                        <div className="spinner-border spinner-border-sm text-secondary" role="status" />
                      </div>
                    )}
                    {registrationPhotoStatus === "none" && <div className="verifier-claiming-reference-photo verifier-claiming-reference-placeholder">No photo on file</div>}
                    <div className="text-muted small">Registered reference photo.<br />Compare against the person presenting for claiming.</div>
                  </div>
                  <ClaimingFaceVerify applicationId={selected.id} required={gracePeriodMode} />
                </div>
                <div className="page-card verifier-attention-card">
                  <h4 className="verifier-application-list-title">Document Verification</h4>
                  <p className="text-muted small mb-3">View each uploaded document, then confirm whether it matches what the applicant physically presented.</p>
                  <div className="row g-3">
                    {DOC_TYPES.map((doc) => {
                      const uploadedDoc = filteredDocs.find((d) => d.document_type === doc.key);
                      const status = docStatus[doc.key];
                      const borderClass = status === "matched" ? "border-success" : status === "issue" ? "border-danger" : "";
                      return (
                        <div className="col-md-4" key={doc.key}>
                          <div className={`doc-check h-100 ${borderClass}`}>
                            <div className="d-flex justify-content-between align-items-start mb-1">
                              <h6 className="mb-0">{doc.label}</h6>
                              {status === "matched" && <span className="badge bg-success">Matched</span>}
                              {status === "issue" && <span className="badge bg-danger">Issue Found</span>}
                              {status === "unreviewed" && <span className="badge bg-secondary">Not Reviewed</span>}
                            </div>
                            {uploadedDoc ? (
                              <>
                                <p className="text-muted small mb-2">{uploadedDoc.file_name}</p>
                                <button type="button" className="verifier-waitlist-action-btn mb-2" onClick={() => handleViewFile(uploadedDoc.id)}>View File</button>
                              </>
                            ) : (
                              <p className="text-muted small mb-2 fst-italic">No uploaded copy available.</p>
                            )}
                            <div className="btn-group btn-group-sm w-100 mt-2" role="group">
                              <button type="button" className={`btn ${status === "matched" ? "btn-success" : "btn-outline-success"}`} onClick={() => setDocStatus(doc.key, "matched")}>Matched</button>
                              <button type="button" className={`btn ${status === "issue" ? "btn-danger" : "btn-outline-danger"}`} onClick={() => setDocStatus(doc.key, "issue")}>Issue Found</button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div className="note-box mt-4">The verifier only checks if the physical documents match the approved application record before updating the final claiming status.</div>
                </div>
                <div className="page-card verifier-attention-card" ref={claimingActionRef}>
                  <h4 className="verifier-application-list-title">Claiming Action</h4>
                  {claimError && <div className="alert alert-danger">{claimError}</div>}
                  {claimSuccess && <div className="alert alert-success">{claimSuccess}</div>}
                  {isResolved ? (
                    <div className="alert alert-secondary mb-0">
                      This application has already been marked as <ClaimStatusBadge status={selected.claiming_assignment?.claim_status} />. No further action is available here.
                    </div>
                  ) : (
                    <>
                      {selectedAction === "claimed" && claimedBlocked && (
                        <div className="alert alert-danger small">
                          <strong>Cannot mark as Claimed yet.</strong>{" "}
                          {unreviewedCount > 0 && `${unreviewedCount} document(s) have not been reviewed. `}
                          {issueDocs.length > 0 && `${issueDocs.map((d) => d.label).join(", ")} ${issueDocs.length === 1 ? "was" : "were"} flagged with an issue.`}
                          {" "}All documents must be marked Matched, or this applicant should be marked Not Cleared instead.
                        </div>
                      )}
                      <div className="d-flex flex-wrap gap-2 mb-3">
                        <button type="button" className={`btn ${selectedAction === "claimed" ? "btn-success" : "btn-outline-success"}`} onClick={() => chooseAction("claimed")}>Mark as Claimed</button>
                        <button type="button" className={`btn ${selectedAction === "not_cleared" ? "btn-danger" : "btn-outline-danger"}`} onClick={() => chooseAction("not_cleared")}>Mark as Not Cleared</button>
                      </div>
                      {selectedAction === "not_cleared" && (
                        <div className="mb-3 border rounded p-3 bg-light">
                          <label className="form-label fw-semibold">Not Cleared Reason(s) *</label>
                          {NOT_CLEARED_REASONS.map((r) => (
                            <div className="form-check" key={r}>
                              <input className="form-check-input" type="checkbox" id={`nc-${r}`} checked={notClearedReasons.includes(r)} onChange={() => toggleNotClearedReason(r)} />
                              <label className="form-check-label small" htmlFor={`nc-${r}`}>{r}</label>
                            </div>
                          ))}
                          {notClearedReasons.includes(OTHER) && (
                            <input className="form-control form-control-sm mt-2" placeholder="Specify the reason..." value={notClearedOtherText} onChange={(e) => setNotClearedOtherText(e.target.value)} />
                          )}
                        </div>
                      )}
                      {selectedAction && (
                        <>
                          <div className="mb-3">
                            <label className="form-label">Additional Notes (optional)</label>
                            <textarea className="form-control" rows="2" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Add any notes about this claiming transaction..." />
                          </div>
                          <div className="text-end">
                            <button className={`btn ${selectedAction === "claimed" ? "btn-success" : "btn-danger"}`} onClick={handleConfirm} disabled={submitting || (selectedAction === "claimed" && claimedBlocked)}>
                              {submitting ? "Submitting..." : `Confirm — Mark as ${selectedAction === "claimed" ? "Claimed" : "Not Cleared"}`}
                            </button>
                          </div>
                        </>
                      )}
                    </>
                  )}
                </div>
              </>
            )}
          </div>
        </section>
        <PanelFooter />
      </div>
    </div>
  );
}
export default VerifierClaiming;