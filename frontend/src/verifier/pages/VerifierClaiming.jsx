import { useState, useEffect, useRef } from "react";
import VerifierNavigation from "../components/VerifierNavigation";
import ClaimingFaceVerify from "../components/ClaimingFaceVerify";
import api from "../../services/api";
import { DOC_TYPES, NOT_CLEARED_REASONS, OTHER } from "../constants/verificationReasons";
import { STATUS_CONFIG } from "../../components/StatusConstants";

// Replaces the old local CLAIM_STATUS_BADGES map — now reads directly
// from the single source of truth. Falls back to a plain "Pending" badge
// if `status` is null/undefined (no assignment yet) or an unrecognized
// value slips through.
function ClaimStatusBadge({ status }) {
  const config = STATUS_CONFIG[status];
  if (!config) {
    return <span className="status-badge status-pending">Pending</span>;
  }
  return <span className={`status-badge ${config.badgeClass}`}>{config.verifierLabel}</span>;
}

// today's date as YYYY-MM-DD, matching how claiming_date/grace_period_date
// are already stored, so the comparison is a plain string compare — no
// timezone-sensitive Date math needed.
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
  const [selected, setSelected] = useState(null);
  const [docStatus, setDocStatusState] = useState(
    DOC_TYPES.reduce((acc, d) => ({ ...acc, [d.key]: "unreviewed" }), {})
  );
  const [notes, setNotes] = useState("");
  // 'unclaimed' removed from the possible values — no-shows are no longer
  // a verifier-clicked action. There's no judgment call to make; the
  // absence of a claiming action already tells the story. This will
  // eventually be handled by an automatic scheduled sweep instead.
  const [selectedAction, setSelectedAction] = useState(null); // null | 'claimed' | 'not_cleared'
  const [notClearedReasons, setNotClearedReasons] = useState([]);
  const [notClearedOtherText, setNotClearedOtherText] = useState("");
  const [searching, setSearching] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Search-stage feedback (shown right next to the search box/results —
  // not at the top of the page) and claim-action-stage feedback (shown
  // right next to the Claiming Action buttons) are kept SEPARATE, so
  // whichever step actually produced the message is where it appears.
  const [searchError, setSearchError] = useState("");
  const [claimError, setClaimError] = useState("");
  const [claimSuccess, setClaimSuccess] = useState("");

  const detailsRef = useRef(null);
  const claimingActionRef = useRef(null);

  // Registration reference photo — the live photo captured at
  // registration, displayed automatically the moment an applicant is
  // selected, at zero cost. Separate from ClaimingFaceVerify's active
  // capture-and-compare below, which actually records a new attempt.
  const [registrationPhotoUrl, setRegistrationPhotoUrl] = useState(null);
  const [registrationPhotoStatus, setRegistrationPhotoStatus] = useState("idle"); // idle | loading | ready | none

  // Lane selection + grace period mode — determines what searchClaiming()
  // is scoped to. Regular mode: a specific lane's applicants only (or all
  // lanes if none picked). Grace period mode: original no-shows still
  // within grace period + everyone promoted from the waitlist — ignores
  // lane selection entirely, since grace period isn't tied to one lane
  // and doesn't use lane-verifier assignment at all. Who actually
  // disbursed money during grace period is still fully tracked, just at
  // the individual claiming_assignments.verified_by level (shown in
  // Applicant Details below), not via a lane assignment.
  const [assignedLane, setAssignedLane] = useState(null);
  const [allLanes, setAllLanes] = useState([]);
  const [gracePeriodDates, setGracePeriodDates] = useState({ start: null, end: null });
  const todaysLanes = allLanes.filter((l) => l.claiming_date === todayStr());
  const [selectedLaneId, setSelectedLaneId] = useState("");
  const [gracePeriodMode, setGracePeriodMode] = useState(false);
  const [assigningLane, setAssigningLane] = useState(false);
  const [lanesLoaded, setLanesLoaded] = useState(false);
  // Tracks whether the person has deliberately clicked a mode tab — once
  // they have, auto-defaulting stops overriding their choice.
  const modeManuallySetRef = useRef(false);

  function fetchLanes() {
    api.get("/verifier/claiming/lanes")
      .then((res) => {
        setAssignedLane(res.data.assigned_lane ?? null);
        setAllLanes(res.data.all_lanes ?? []);
        if (res.data.assigned_lane) {
          setSelectedLaneId(String(res.data.assigned_lane.id));
        }

        setGracePeriodDates({ start: res.data.grace_period_date ?? null, end: res.data.grace_period_end_date ?? null });

        // Auto-default the tab to whichever mode actually matches today,
        // unless the person has already deliberately picked one.
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

  // Measures the actual rendered navbar height so the sticky summary bar
  // can sit just below it, instead of guessing a fixed pixel offset that
  // breaks whenever the navbar's own content/height changes. Re-measures
  // on resize since the navbar may wrap or resize at smaller widths.
  useEffect(() => {
    function measureNav() {
      const nav = document.querySelector("nav");
      setNavHeight(nav ? nav.getBoundingClientRect().height : 0);
    }
    measureNav();
    window.addEventListener("resize", measureNav);
    return () => window.removeEventListener("resize", measureNav);
  }, []);

  // Auto-loads results the moment the correct mode is known — no button
  // click needed to see who's up. Regular mode loads the assigned lane's
  // list; grace period mode loads the grace period list outright, since
  // it has no filters to fill in first anyway.
  useEffect(() => {
    if (!lanesLoaded) return;
    if (gracePeriodMode) {
      handleSearch({ preventDefault: () => { } });
    } else if (assignedLane) {
      handleSearch({ preventDefault: () => { } });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lanesLoaded, gracePeriodMode, assignedLane]);

  // Revoke any lingering photo blob URL if the verifier navigates away
  // from this page entirely, so it doesn't leak.
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
    setNotClearedReasons((prev) =>
      prev.includes(reason) ? prev.filter((r) => r !== reason) : [...prev, reason]
    );
  }

  function switchToRegularMode() {
    modeManuallySetRef.current = true;
    setGracePeriodMode(false);
    setResults([]);
    setSelected(null);
    setSearchError("");
    setClaimError("");
    setClaimSuccess("");
    // Re-select the verifier's assigned lane in the dropdown — switching
    // to Grace Period mode clears selectedLaneId, so without this a
    // verifier bouncing between tabs would silently lose their assigned
    // lane selection and land on "All lanes" instead.
    if (assignedLane) {
      setSelectedLaneId(String(assignedLane.id));
    }
  }

  function switchToGracePeriodMode() {
    modeManuallySetRef.current = true;
    setGracePeriodMode(true);
    setResults([]);
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
      const res = await api.post(`/verifier/claiming/lanes/${laneId}/self-assign`);
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
    // Grace period mode has no required inputs — it always loads the
    // full grace period list. Regular mode still needs at least one
    // filter, unless a lane is already selected/assigned.
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
      if (res.data.length === 1) selectApplicant(res.data[0]);
    } catch (err) {
      setResults([]);
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

    // Clean up the previous applicant's photo blob URL before loading the
    // next one, so object URLs don't pile up in memory across selections.
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
      handleSearch({ preventDefault: () => { } }); // refresh the current list instead of clearing it
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
      const res = await api.get(`/applications/${selected.id}/documents/${docId}/file`, {
        responseType: "blob",
      });
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

  const filteredDocs = selected?.documents?.filter(
    d => d.status === "processed" || d.status === "failed"
  ) || [];
  const matchedDocs = DOC_TYPES.filter((d) => docStatus[d.key] === "matched").map((d) => d.key);
  const issueDocs = DOC_TYPES.filter((d) => docStatus[d.key] === "issue");
  const unreviewedCount = DOC_TYPES.filter((d) => docStatus[d.key] === "unreviewed").length;
  const claimedBlocked = unreviewedCount > 0 || issueDocs.length > 0;
  // claimed/not_cleared/unclaimed are all TERMINAL — none of them can be
  // re-clicked through this UI. Only the sweep or a future admin-override
  // path should ever change a resolved row.
  const isResolved = ["claimed", "not_cleared", "unclaimed"].includes(selected?.claiming_assignment?.claim_status);

  return (
    <div>
      <VerifierNavigation />
      <section className="page-section">
        <div className="container">
          <div className="content-card">
            <h3 className="section-title mb-2">Claiming Approved Application</h3>
            <p className="text-muted mb-0">
              Search the approved applicant, check the physical documents, and update the final claiming status.
            </p>
          </div>

          <div className="content-card">
            <h4>Claiming Mode</h4>
            <div className="d-flex flex-wrap gap-2 mb-3">
              <button
                type="button"
                className={`btn btn-sm ${!gracePeriodMode ? "btn-custom" : "btn-outline-custom"}`}
                onClick={switchToRegularMode}
              >
                Regular Claiming
              </button>
              <button
                type="button"
                className={`btn btn-sm ${gracePeriodMode ? "btn-custom" : "btn-outline-custom"}`}
                onClick={switchToGracePeriodMode}
              >
                Grace Period List
              </button>
            </div>

            {/* Period context banner — always visible, tells the verifier
                exactly what "today" means in the claiming timeline, so
                nobody has to infer it from dates scattered across lanes. */}
            {gracePeriodMode ? (
              gracePeriodDates.start && gracePeriodDates.end ? (
                <div className="alert alert-warning py-2 mb-3 small">
                  <strong>Grace Period</strong> — Day {Math.max(1, daysBetween(gracePeriodDates.start, todayStr()) + 1)}/
                  {daysBetween(gracePeriodDates.start, gracePeriodDates.end) + 1}
                  {" "}({formatDateDisplay(gracePeriodDates.start)} – {formatDateDisplay(gracePeriodDates.end)})
                </div>
              ) : (
                <div className="alert alert-secondary py-2 mb-3 small">
                  No grace period configured for the active schedule.
                </div>
              )
            ) : (
              <div className="alert alert-info py-2 mb-3 small">
                <strong>Today — {formatDateDisplay(todayStr())}</strong>
                {todaysLanes.length > 0 ? (
                  <> — Lanes claiming today: {todaysLanes.map((l) => `${l.lane_name} (${l.batch === "morning" ? "Morning" : "Afternoon"})`).join(", ")}</>
                ) : (
                  <> — No lanes scheduled to claim today.</>
                )}
                {assignedLane && (
                  <div className="mt-1">
                    Currently viewing: <strong>{assignedLane.lane_name}</strong> ({formatDateDisplay(assignedLane.claiming_date)})
                    {assignedLane.claiming_date < todayStr() && (
                      <span className="text-danger ms-1">— this lane's date has already passed</span>
                    )}
                  </div>
                )}
              </div>
            )}

            {!gracePeriodMode && (
              <div className="row g-3">
                <div className="col-md-8">
                  <label className="form-label">Lane / Schedule</label>
                  {assignedLane && (
                    <div className="alert alert-success py-2 mb-2 small">
                      You're currently assigned to <strong>{assignedLane.lane_name}</strong> ({assignedLane.batch === "morning" ? "Morning" : "Afternoon"}, {assignedLane.claiming_date}).
                    </div>
                  )}
                  <select
                    className="form-select"
                    value={selectedLaneId}
                    onChange={(e) => setSelectedLaneId(e.target.value)}
                  >
                    <option value="">All lanes</option>
                    {allLanes.map((lane) => (
                      <option key={lane.id} value={lane.id}>
                        {lane.claiming_date} — {lane.batch === "morning" ? "Morning" : "Afternoon"} — {lane.lane_name}
                        {lane.verifier_id && lane.id !== assignedLane?.id ? " (assigned to another verifier)" : ""}
                      </option>
                    ))}
                  </select>
                  {selectedLaneId && (!assignedLane || String(assignedLane.id) !== selectedLaneId) && (
                    <button
                      type="button"
                      className="btn btn-outline-custom btn-sm mt-2"
                      onClick={() => handleSelfAssign(selectedLaneId)}
                      disabled={assigningLane}
                    >
                      {assigningLane ? "Assigning..." : "Make this my lane"}
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="content-card">
            <div className="d-flex justify-content-between align-items-center flex-wrap gap-2">
              <h4 className="mb-0">{gracePeriodMode ? "Grace Period Applicants" : "Search Applicant"}</h4>
              {gracePeriodMode && (
                <button
                  type="button"
                  className="btn btn-outline-custom btn-sm"
                  onClick={() => handleSearch({ preventDefault: () => { } })}
                  disabled={searching}
                >
                  {searching ? "Refreshing..." : "Refresh List"}
                </button>
              )}
            </div>
            {!gracePeriodMode && (
              <div className="search-box mt-2">
                <form onSubmit={handleSearch}>
                  <div className="row g-3 align-items-end">
                    <div className="col-md-5">
                      <label className="form-label">Control Number</label>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="e.g. SK-2026-0001"
                        value={controlNo}
                        onChange={(e) => setControlNo(e.target.value)}
                      />
                    </div>
                    <div className="col-md-5">
                      <label className="form-label">Applicant Name</label>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="Enter first or last name"
                        value={applicantName}
                        onChange={(e) => setApplicantName(e.target.value)}
                      />
                    </div>
                    <div className="col-md-2 d-grid">
                      <button className="btn btn-custom" type="submit" disabled={searching}>
                        {searching ? "Searching..." : "Search"}
                      </button>
                    </div>
                  </div>
                </form>
              </div>
            )}
            {gracePeriodMode && searching && (
              <p className="text-muted small mt-2 mb-0">Loading grace period list...</p>
            )}

            {searchError && <div className="alert alert-danger mt-3 mb-0">{searchError}</div>}

            {results.length > 0 && (
              <div className="table-responsive mt-3">
                <table className="table table-bordered table-hover align-middle mb-0">
                  <thead>
                    <tr>
                      <th>Control Number</th>
                      <th>Applicant Name</th>
                      <th>School</th>
                      <th>Status</th>
                      {gracePeriodMode && <th>Type</th>}
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...results]
                      .sort((a, b) => {
                        const aPending = a.claiming_assignment?.claim_status === "pending_claiming" ? 0 : 1;
                        const bPending = b.claiming_assignment?.claim_status === "pending_claiming" ? 0 : 1;
                        return aPending - bPending;
                      })
                      .map((app) => (
                        <tr
                          key={app.id}
                          className={selected?.id === app.id ? "table-active" : ""}
                          style={{ cursor: "pointer" }}
                          onClick={() => selectApplicant(app)}
                        >
                          <td>{app.control_number}</td>
                          <td>{app.user?.first_name} {app.user?.last_name}</td>
                          <td>{app.school_name}</td>
                          <td>
                            <ClaimStatusBadge status={app.claiming_assignment?.claim_status} />
                          </td>
                          {gracePeriodMode && (
                            <td>
                              {app.claiming_assignment?.source === "waitlist_promotion" && (
                                <span className="badge bg-warning text-dark">Promoted</span>
                              )}
                              {(app.claiming_assignment?.source === "grace_period_retry" ||
                                app.claiming_assignment?.source === "original") && (
                                  <span className="badge bg-info text-dark">Retrying</span>
                                )}
                            </td>
                          )}
                          <td>
                            <button
                              className="btn btn-outline-custom btn-sm"
                              onClick={(e) => { e.stopPropagation(); selectApplicant(app); }}
                            >
                              {selected?.id === app.id ? "Selected" : "Select"}
                            </button>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            )}

            {results.length === 0 && !searching && !searchError && (
              <p className="text-muted small mt-3 mb-0">
                {gracePeriodMode ? "No applicants currently in the grace period list." : "No results yet — search above."}
              </p>
            )}
          </div>

          {selected && (
            <>
              {/* Sticky summary bar — always visible once an applicant is
                  selected, so who you're working on and their status stays
                  in view even as you scroll through verification/document
                  checks below. Also doubles as quick-jump navigation
                  between the sections instead of hunting via scroll. */}
              <div
                className="content-card"
                style={{ position: "sticky", top: `${navHeight + 8}px`, zIndex: 10, border: "2px solid #b71c1c" }}
              >
                <div className="d-flex justify-content-between align-items-center flex-wrap gap-2">
                  <div className="d-flex align-items-center gap-2">
                    {registrationPhotoStatus === "ready" && (
                      <img
                        src={registrationPhotoUrl}
                        alt="Registered photo on file"
                        style={{ width: "36px", height: "36px", objectFit: "cover", borderRadius: "50%", border: "1px solid #b71c1c", flexShrink: 0 }}
                      />
                    )}
                    {registrationPhotoStatus === "loading" && (
                      <div
                        className="d-flex align-items-center justify-content-center bg-light rounded-circle"
                        style={{ width: "36px", height: "36px", flexShrink: 0 }}
                      >
                        <div className="spinner-border spinner-border-sm text-secondary" role="status" style={{ width: "16px", height: "16px" }} />
                      </div>
                    )}
                    {registrationPhotoStatus === "none" && (
                      <div
                        className="d-flex align-items-center justify-content-center bg-light rounded-circle text-muted"
                        style={{ width: "36px", height: "36px", flexShrink: 0, fontSize: "10px", border: "1px dashed #ccc" }}
                        title="No photo on file"
                      >
                        N/A
                      </div>
                    )}
                    <div>
                      <strong>{selected.user?.first_name} {selected.user?.last_name}</strong>
                      <span className="text-muted mx-2">·</span>
                      <span className="text-muted">{selected.control_number}</span>
                      <span className="ms-2">
                        <ClaimStatusBadge status={selected.claiming_assignment?.claim_status} />
                      </span>
                      {gracePeriodMode && (
                        <span className="badge bg-warning text-dark ms-2">Grace Period</span>
                      )}
                    </div>
                  </div>
                  <div className="d-flex flex-wrap gap-2">
                    <button type="button" className="btn btn-outline-custom btn-sm" onClick={() => jumpTo(detailsRef)}>
                      Details
                    </button>
                    <button type="button" className="btn btn-outline-custom btn-sm" onClick={() => jumpTo(claimingActionRef)}>
                      Claiming Action
                    </button>
                    <button
                      type="button"
                      className="btn btn-outline-secondary btn-sm"
                      onClick={() => setSelected(null)}
                    >
                      Close
                    </button>
                  </div>
                </div>
              </div>

              <div className="content-card" ref={detailsRef}>
                <h4>Applicant Details</h4>
                <div className="table-responsive">
                  <table className="table table-bordered info-table align-middle">
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
                          <tr>
                            <th>Batch</th>
                            <td>{selected.claiming_assignment.lane.batch === "morning" ? "Morning" : "Afternoon"}</td>
                          </tr>
                          <tr>
                            <th>Lane</th>
                            <td><span className="lane-badge">{selected.claiming_assignment.lane.lane_name}</span></td>
                          </tr>
                        </>
                      )}
                      <tr><th>Current Claim Status</th><td><ClaimStatusBadge status={selected.claiming_assignment?.claim_status} /></td></tr>
                      {gracePeriodMode && (
                        <tr>
                          <th>Assignment Type</th>
                          <td>
                            {selected.claiming_assignment?.source === "waitlist_promotion" ? (
                              <span className="badge bg-warning text-dark">Promoted from Waitlist</span>
                            ) : (
                              <span className="badge bg-info text-dark">Retrying (Grace Period)</span>
                            )}
                          </td>
                        </tr>
                      )}
                      {selected.claiming_assignment?.verifier && (
                        <tr><th>Disbursed By</th><td>{selected.claiming_assignment.verifier.first_name} {selected.claiming_assignment.verifier.last_name}</td></tr>
                      )}
                      {selected.claiming_assignment?.verified_at && (
                        <tr><th>Disbursed At</th><td>{new Date(selected.claiming_assignment.verified_at).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" })}</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="content-card">
                <h4>Face Verification</h4>
                <p className="text-muted small mb-3">
                  Confirm this is really the applicant before proceeding to document checks.
                </p>

                {/* Passive reference photo — the registration-time live
                    photo, shown automatically for every applicant in
                    every mode, at zero cost. No capture, no button, no
                    wait — just a visual reference for the verifier to
                    glance at alongside the person presenting for
                    claiming, right where the actual comparison happens.
                    Separate from ClaimingFaceVerify's active capture
                    below, which actually records a new match attempt. */}
                <div className="mb-3 d-flex align-items-center gap-3">
                  {registrationPhotoStatus === "ready" && (
                    <img
                      src={registrationPhotoUrl}
                      alt="Registered photo on file"
                      style={{ width: "100px", height: "100px", objectFit: "cover", borderRadius: "8px", border: "2px solid #b71c1c" }}
                    />
                  )}
                  {registrationPhotoStatus === "loading" && (
                    <div
                      className="d-flex align-items-center justify-content-center bg-light rounded"
                      style={{ width: "100px", height: "100px" }}
                    >
                      <div className="spinner-border spinner-border-sm text-secondary" role="status" />
                    </div>
                  )}
                  {registrationPhotoStatus === "none" && (
                    <div
                      className="d-flex align-items-center justify-content-center bg-light rounded text-muted small text-center p-2"
                      style={{ width: "100px", height: "100px" }}
                    >
                      No photo on file
                    </div>
                  )}
                  <div className="text-muted small">
                    Registered reference photo.<br />Compare against the person presenting for claiming.
                  </div>
                </div>

                <ClaimingFaceVerify applicationId={selected.id} required={gracePeriodMode} />
              </div>

              <div className="content-card">
                <h4>Document Verification</h4>
                <p className="text-muted small mb-3">
                  View each uploaded document, then confirm whether it matches what the applicant physically presented.
                </p>
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
                              <button
                                type="button"
                                className="btn btn-outline-custom btn-sm mb-2"
                                onClick={() => handleViewFile(uploadedDoc.id)}
                              >
                                View File
                              </button>
                            </>
                          ) : (
                            <p className="text-muted small mb-2 fst-italic">No uploaded copy available.</p>
                          )}
                          <div className="btn-group btn-group-sm w-100 mt-2" role="group">
                            <button
                              type="button"
                              className={`btn ${status === "matched" ? "btn-success" : "btn-outline-success"}`}
                              onClick={() => setDocStatus(doc.key, "matched")}
                            >
                              Matched
                            </button>
                            <button
                              type="button"
                              className={`btn ${status === "issue" ? "btn-danger" : "btn-outline-danger"}`}
                              onClick={() => setDocStatus(doc.key, "issue")}
                            >
                              Issue Found
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="note-box mt-4">
                  The verifier only checks if the physical documents match the approved application record before updating the final claiming status.
                </div>
              </div>

              <div className="content-card" ref={claimingActionRef}>
                <h4>Claiming Action</h4>

                {claimError && <div className="alert alert-danger">{claimError}</div>}
                {claimSuccess && <div className="alert alert-success">{claimSuccess}</div>}

                {isResolved ? (
                  <div className="alert alert-secondary mb-0">
                    This application has already been marked as{" "}
                    <ClaimStatusBadge status={selected.claiming_assignment?.claim_status} />. No further action is available here.
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
                    {/* Unclaimed removed from this button group — no-shows are
                        no longer a verifier decision. If someone never showed
                        up, there's nothing to confirm here; that transition
                        will happen automatically once the scheduled sweep is
                        built. */}
                    <div className="d-flex flex-wrap gap-2 mb-3">
                      <button
                        type="button"
                        className={`btn ${selectedAction === "claimed" ? "btn-success" : "btn-outline-success"}`}
                        onClick={() => chooseAction("claimed")}
                      >
                        Mark as Claimed
                      </button>
                      <button
                        type="button"
                        className={`btn ${selectedAction === "not_cleared" ? "btn-danger" : "btn-outline-danger"}`}
                        onClick={() => chooseAction("not_cleared")}
                      >
                        Mark as Not Cleared
                      </button>
                    </div>
                    {selectedAction === "not_cleared" && (
                      <div className="mb-3 border rounded p-3 bg-light">
                        <label className="form-label fw-semibold">Not Cleared Reason(s) *</label>
                        {NOT_CLEARED_REASONS.map((r) => (
                          <div className="form-check" key={r}>
                            <input
                              className="form-check-input"
                              type="checkbox"
                              id={`nc-${r}`}
                              checked={notClearedReasons.includes(r)}
                              onChange={() => toggleNotClearedReason(r)}
                            />
                            <label className="form-check-label small" htmlFor={`nc-${r}`}>{r}</label>
                          </div>
                        ))}
                        {notClearedReasons.includes(OTHER) && (
                          <input
                            className="form-control form-control-sm mt-2"
                            placeholder="Specify the reason..."
                            value={notClearedOtherText}
                            onChange={(e) => setNotClearedOtherText(e.target.value)}
                          />
                        )}
                      </div>
                    )}
                    {selectedAction && (
                      <>
                        <div className="mb-3">
                          <label className="form-label">Additional Notes (optional)</label>
                          <textarea
                            className="form-control"
                            rows="2"
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            placeholder="Add any notes about this claiming transaction..."
                          />
                        </div>
                        <div className="text-end">
                          <button
                            className={`btn ${selectedAction === "claimed" ? "btn-success" : "btn-danger"}`}
                            onClick={handleConfirm}
                            disabled={submitting || (selectedAction === "claimed" && claimedBlocked)}
                          >
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
      <footer>
        <div className="container">
          <p className="mb-0">© 2026 Sangguniang Kabataan of Barangay Mamatid | Verifier Panel</p>
        </div>
      </footer>
    </div>
  );
}

export default VerifierClaiming;