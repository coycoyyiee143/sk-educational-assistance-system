import { useState } from "react";
import VerifierNavigation from "../components/VerifierNavigation";

// ── Data ──────────────────────────────────────────────────────────────────────

const summaryRows = [
  ["Application ID",        "SK-EA-2026-00125"],
  ["Applicant Name",        "Juan Dela Cruz"],
  ["Current Status",        "Flagged"],
  ["Flagged Document",      "Certificate of Enrollment"],
  ["System Recommendation", "Request Re-upload"],
];

const reuploadDocs = [
  { id: "doc1", label: "Certificate of Enrollment" },
  { id: "doc2", label: "Barangay Certificate" },
  { id: "doc3", label: "School ID" },
];

const actions = ["Approve Application", "Request Re-upload", "Reject Application"];

// ── Component ─────────────────────────────────────────────────────────────────

function VerifierVerificationAction() {
  const [action, setAction] = useState("");
  const [notes, setNotes] = useState("");
  const [checkedDocs, setCheckedDocs] = useState([]);

  function toggleDoc(id) {
    setCheckedDocs((prev) =>
      prev.includes(id) ? prev.filter((d) => d !== id) : [...prev, id]
    );
  }

  function handleAction(type) {
    // TODO: connect to backend
    console.log("Action:", type, { action, notes, checkedDocs });
  }

  return (
    <div>
      <VerifierNavigation />

      <section className="page-section">
        <div className="container">

          {/* Header */}
          <div className="page-card">
            <div className="d-flex justify-content-between align-items-center flex-wrap gap-2">
              <div>
                <h3 className="section-title mb-2">Verification Action</h3>
                <p className="text-muted mb-0">
                  Finalize the evaluation of the selected application by approving, rejecting, or requesting re-upload of flagged documents.
                </p>
              </div>
              <span className="status-badge">Flagged for Review</span>
            </div>
          </div>

          {/* Application Summary */}
          <div className="page-card">
            <h4 className="section-title">Application Summary</h4>

            <div className="table-responsive">
              <table className="table table-bordered summary-table align-middle">
                <tbody>
                  {summaryRows.map(([label, value]) => (
                    <tr key={label}>
                      <th>{label}</th>
                      <td>{value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Verifier Decision */}
          <div className="page-card">
            <h4 className="section-title">Verifier Decision</h4>

            <div className="mb-3">
              <label className="form-label">Select Action</label>
              <select
                className="form-select"
                value={action}
                onChange={(e) => setAction(e.target.value)}
              >
                <option value="" disabled>Choose action</option>
                {actions.map((a) => <option key={a}>{a}</option>)}
              </select>
            </div>

            <div className="mb-3">
              <label className="form-label">Verifier Notes / Reason</label>
              <textarea
                className="form-control"
                rows="5"
                placeholder="Enter notes, explanation, or reason for your decision..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>

            <div className="mb-3">
              <label className="form-label">Documents to be Re-uploaded (if applicable)</label>
              {reuploadDocs.map((doc) => (
                <div className="form-check" key={doc.id}>
                  <input
                    className="form-check-input"
                    type="checkbox"
                    id={doc.id}
                    checked={checkedDocs.includes(doc.id)}
                    onChange={() => toggleDoc(doc.id)}
                  />
                  <label className="form-check-label" htmlFor={doc.id}>
                    {doc.label}
                  </label>
                </div>
              ))}
            </div>

            <div className="info-box mb-4">
              The verifier may confirm or override the system recommendation. If rejecting the application, a written reason must be provided. If requesting re-upload, specify which documents need correction before resubmission.
            </div>

            <div className="d-flex flex-wrap gap-2 justify-content-end">
              <button type="button" className="btn btn-secondary-custom" onClick={() => { setAction(""); setNotes(""); setCheckedDocs([]); }}>Cancel</button>
              <button type="button" className="btn btn-approve"   onClick={() => handleAction("Approve")}>Approve</button>
              <button type="button" className="btn btn-reupload"  onClick={() => handleAction("Reupload")}>Request Re-upload</button>
              <button type="button" className="btn btn-reject"    onClick={() => handleAction("Reject")}>Reject</button>
            </div>
          </div>

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

export default VerifierVerificationAction;