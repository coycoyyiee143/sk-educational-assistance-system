import { useState } from "react";
import VerifierNavigation from "../components/VerifierNavigation";
import api from "../../services/api";

const DOC_FIELDS = [
  { key: "registration_form", label: "Certificate of Enrollment / Registration Form" },
  { key: "school_id", label: "School ID" },
  { key: "voters_certificate", label: "Voter's Certificate" },
];

function VerifierClaiming() {
  const [controlNo, setControlNo] = useState("");
  const [applicantName, setApplicantName] = useState("");
  const [results, setResults] = useState([]);
  const [selected, setSelected] = useState(null);
  const [checkedDocs, setCheckedDocs] = useState([]);
  const [notes, setNotes] = useState("");
  const [searching, setSearching] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  function toggleDoc(key) {
    setCheckedDocs((prev) =>
      prev.includes(key) ? prev.filter((d) => d !== key) : [...prev, key]
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
    setCheckedDocs(DOC_FIELDS.map(d => d.key));
    setNotes("");
    setError("");
    setSuccess("");
  }

  async function handleClaimAction(claimStatus) {
    if (!selected) return;
    setError("");
    setSuccess("");
    setSubmitting(true);
    try {
      const res = await api.post(`/verifier/claiming/${selected.id}/status`, {
        claim_status: claimStatus,
        verified_documents: checkedDocs,
        notes,
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

  // Helper filter for processed or failed uploaded files
  const filteredDocs = selected?.documents?.filter(
    d => d.status === "processed" || d.status === "failed"
  ) || [];

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
                          <span className="badge bg-secondary">
                            {app.claiming_assignment?.claim_status ?? "pending"}
                          </span>
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
                      <tr><th>Current Claim Status</th><td>{selected.claiming_assignment?.claim_status ?? "pending"}</td></tr>
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="content-card">
                <h4>Uploaded Documents</h4>
                <div className="row g-3">
                  {filteredDocs.length > 0 ? (
                    filteredDocs.map((doc) => (
                      <div className="col-md-4" key={doc.id}>
                        <div className="doc-check">
                          <h6>{doc.document_type.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())}</h6>
                          <p className="text-muted">{doc.file_name}</p>
                          <a
                            href={`http://localhost:8000/storage/${doc.file_path}`}
                            target="_blank"
                            rel="noreferrer"
                            className="btn btn-outline-custom btn-sm"
                          >
                            View File
                          </a>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="col-12">
                      <p className="text-muted mb-0">No processed cloud documents available for this application.</p>
                    </div>
                  )}
                </div>
              </div>

              <div className="content-card">
                <h4>Physical Document Check</h4>
                <div className="row g-3">
                  {DOC_FIELDS.map((doc) => (
                    <div className="col-md-4" key={doc.key}>
                      <div className="doc-check">
                        <h6>{doc.label}</h6>
                        <div className="form-check">
                          <input
                            className="form-check-input"
                            type="checkbox"
                            id={doc.key}
                            checked={checkedDocs.includes(doc.key)}
                            onChange={() => toggleDoc(doc.key)}
                          />
                          <label className="form-check-label" htmlFor={doc.key}>
                            Presented and matched
                          </label>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="note-box mt-4">
                  The verifier only checks if the physical documents match the approved application record before updating the final claiming status.
                </div>
              </div>

              <div className="content-card">
                <h4>Claiming Action</h4>
                <div className="mb-3">
                  <label className="form-label">Notes (optional)</label>
                  <textarea
                    className="form-control"
                    rows="2"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Add any notes about this claiming transaction..."
                  />
                </div>
                <div className="alert alert-light border">
                  After checking the physical documents, select the appropriate action for the applicant.
                </div>
                <div className="d-flex gap-2 justify-content-end flex-wrap">
                  <button className="btn btn-success" onClick={() => handleClaimAction("claimed")} disabled={submitting}>
                    Mark as Claimed
                  </button>
                  <button className="btn btn-danger" onClick={() => handleClaimAction("not_cleared")} disabled={submitting}>
                    Mark as Not Cleared
                  </button>
                  <button className="btn btn-warning text-dark" onClick={() => handleClaimAction("unclaimed")} disabled={submitting}>
                    Mark as Unclaimed
                  </button>
                </div>
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