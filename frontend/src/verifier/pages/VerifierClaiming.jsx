import { useState } from "react";
import VerifierNavigation from "../components/VerifierNavigation";
import ClaimingFaceVerify from "../components/ClaimingFaceVerify";
import api from "../../services/api";
import { DOC_TYPES, NOT_CLEARED_REASONS, OTHER } from "../constants/verificationReasons";

const CLAIM_STATUS_BADGES = {
  claimed: { label: "Claimed", className: "bg-success" },
  not_cleared: { label: "Not Cleared", className: "bg-danger" },
  unclaimed: { label: "Unclaimed", className: "bg-warning text-dark" },
};

function ClaimStatusBadge({ status }) {
  const config = CLAIM_STATUS_BADGES[status] || { label: "Pending", className: "bg-secondary" };
  return <span className={`badge ${config.className}`}>{config.label}</span>;
}

function VerifierClaiming() {
  const [controlNo, setControlNo] = useState("");
  const [applicantName, setApplicantName] = useState("");
  const [results, setResults] = useState([]);
  const [selected, setSelected] = useState(null);
  const [docStatus, setDocStatusState] = useState(
    DOC_TYPES.reduce((acc, d) => ({ ...acc, [d.key]: "unreviewed" }), {})
  );
  const [notes, setNotes] = useState("");
  const [selectedAction, setSelectedAction] = useState(null); // null | 'claimed' | 'not_cleared' | 'unclaimed'
  const [notClearedReasons, setNotClearedReasons] = useState([]);
  const [notClearedOtherText, setNotClearedOtherText] = useState("");
  const [searching, setSearching] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  function setDocStatus(key, status) {
    setDocStatusState((prev) => ({ ...prev, [key]: status }));
  }

  function toggleNotClearedReason(reason) {
    setNotClearedReasons((prev) =>
      prev.includes(reason) ? prev.filter((r) => r !== reason) : [...prev, reason]
    );
  }

  async function handleSearch(e) {
    e.preventDefault();
    setError("");
    setSuccess("");
    setSelected(null);
    if (!controlNo.trim() && !applicantName.trim()) {
      setError("Please enter a control number or applicant name.");
      return;
    }
    setSearching(true);
    try {
      const params = {};
      if (controlNo.trim()) params.control_number = controlNo.trim();
      if (applicantName.trim()) params.name = applicantName.trim();
      const res = await api.get("/verifier/claiming/search", { params });
      setResults(res.data);
      if (res.data.length === 1) selectApplicant(res.data[0]);
    } catch (err) {
      setResults([]);
      setError(err.response?.data?.message || "No matching approved applicant found.");
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
    setError("");
    setSuccess("");
  }

  function chooseAction(action) {
    setSelectedAction(action);
    setError("");
    if (action === "not_cleared" && issueDocs.length > 0) {
      setNotClearedReasons(["Physical documents did not match submitted application."]);
    } else if (action !== "not_cleared") {
      setNotClearedReasons([]);
      setNotClearedOtherText("");
    }
  }

  async function handleConfirm() {
    if (!selected || !selectedAction) return;
    setError("");
    setSuccess("");
    if (selectedAction === "claimed" && (unreviewedCount > 0 || issueDocs.length > 0)) {
      setError("All documents must be marked as Matched before this applicant can be marked Claimed. Resolve or re-check any flagged documents first.");
      return;
    }
    let reasonCategories;
    if (selectedAction === "not_cleared") {
      const withoutOther = notClearedReasons.filter((r) => r !== OTHER);
      reasonCategories = notClearedReasons.includes(OTHER) && notClearedOtherText.trim()
        ? [...withoutOther, notClearedOtherText.trim()]
        : withoutOther;
      if (reasonCategories.length === 0) {
        setError("Please select at least one reason for marking this applicant as Not Cleared.");
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
      setSuccess(res.data.message);
      setSelected(null);
      setResults([]);
      setControlNo("");
      setApplicantName("");
    } catch (err) {
      setError(err.response?.data?.message || "Failed to update claiming status.");
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

  const filteredDocs = selected?.documents?.filter(
    d => d.status === "processed" || d.status === "failed"
  ) || [];
  const matchedDocs = DOC_TYPES.filter((d) => docStatus[d.key] === "matched").map((d) => d.key);
  const issueDocs = DOC_TYPES.filter((d) => docStatus[d.key] === "issue");
  const unreviewedCount = DOC_TYPES.filter((d) => docStatus[d.key] === "unreviewed").length;
  const claimedBlocked = unreviewedCount > 0 || issueDocs.length > 0;

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
          {error && <div className="alert alert-danger">{error}</div>}
          {success && <div className="alert alert-success">{success}</div>}
          <div className="content-card">
            <h4>Search Applicant</h4>
            <div className="search-box">
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
            {results.length > 1 && (
              <div className="table-responsive mt-3">
                <table className="table table-bordered table-hover align-middle">
                  <thead>
                    <tr>
                      <th>Control Number</th>
                      <th>Applicant Name</th>
                      <th>School</th>
                      <th>Status</th>
                      <th>Type</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.map((app) => (
                      <tr key={app.id}>
                        <td>{app.control_number}</td>
                        <td>{app.user?.first_name} {app.user?.last_name}</td>
                        <td>{app.school_name}</td>
                        <td>
                          <ClaimStatusBadge status={app.claiming_assignment?.claim_status} />
                        </td>
                        <td>
                          {app.claiming_assignment?.source === "waitlist_promotion" && (
                            <span className="badge bg-warning text-dark">Grace Period</span>
                          )}
                        </td>
                        <td>
                          <button className="btn btn-outline-custom btn-sm" onClick={() => selectApplicant(app)}>
                            Select
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          {selected && (
            <>
              <div className="content-card">
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
                      {selected.claiming_assignment?.source === "waitlist_promotion" && (
                        <tr><th>Assignment Type</th><td><span className="badge bg-warning text-dark">Grace Period — Waitlist Promotion</span></td></tr>
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
                <ClaimingFaceVerify applicationId={selected.id} />
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
              <div className="content-card">
                <h4>Claiming Action</h4>
                {selectedAction === "claimed" && claimedBlocked && (
                  <div className="alert alert-danger small">
                    <strong>Cannot mark as Claimed yet.</strong>{" "}
                    {unreviewedCount > 0 && `${unreviewedCount} document(s) have not been reviewed. `}
                    {issueDocs.length > 0 && `${issueDocs.map((d) => d.label).join(", ")} ${issueDocs.length === 1 ? "was" : "were"} flagged with an issue.`}
                    {" "}All documents must be marked Matched, or this applicant should be marked Not Cleared instead.
                  </div>
                )}
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
                  <button
                    type="button"
                    className={`btn ${selectedAction === "unclaimed" ? "btn-warning text-dark" : "btn-outline-warning"}`}
                    onClick={() => chooseAction("unclaimed")}
                  >
                    Mark as Unclaimed
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
                        className={`btn ${selectedAction === "claimed" ? "btn-success" : selectedAction === "not_cleared" ? "btn-danger" : "btn-warning text-dark"}`}
                        onClick={handleConfirm}
                        disabled={submitting || (selectedAction === "claimed" && claimedBlocked)}
                      >
                        {submitting ? "Submitting..." : `Confirm — Mark as ${selectedAction === "claimed" ? "Claimed" : selectedAction === "not_cleared" ? "Not Cleared" : "Unclaimed"}`}
                      </button>
                    </div>
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