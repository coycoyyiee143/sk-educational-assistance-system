import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import VerifierNavigation from "../components/VerifierNavigation";
import api from "../../services/api";

const DOC_TYPES = [
  { key: "registration_form", label: "Certificate of Enrollment / Registration Form" },
  { key: "school_id", label: "School ID" },
  { key: "voters_certificate", label: "Voter's Certificate" },
];

function VerifierVerificationAction() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [app, setApp] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");

  const [reuploadDocs, setReuploadDocs] = useState(
    DOC_TYPES.reduce((acc, d) => ({ ...acc, [d.key]: { checked: false, reason: "" } }), {})
  );

  useEffect(() => {
    api.get(`/verifier/applications/${id}`)
      .then((res) => setApp(res.data))
      .catch(() => setError("Failed to load application."))
      .finally(() => setLoading(false));
  }, [id]);

  function toggleDoc(key) {
    setReuploadDocs((prev) => ({
      ...prev,
      [key]: { ...prev[key], checked: !prev[key].checked },
    }));
  }

  function setDocReason(key, reason) {
    setReuploadDocs((prev) => ({
      ...prev,
      [key]: { ...prev[key], reason },
    }));
  }

  // Helper logic to evaluate the automated OCR checks
  const getDocStatusBadge = (doc) => {
    if (!doc) return <span className="badge bg-secondary">Missing</span>;
    if (doc.status !== "processed") return <span className="badge bg-warning text-dark">Processing Failed</span>;

    const docChecks = app?.verification_checks?.filter(c => c.document_id === doc.id) || [];
    if (docChecks.length === 0) return <span className="badge bg-secondary">No Checks Run</span>;

    const hasFailedCheck = docChecks.some(c => !c.passed);
    return hasFailedCheck
      ? <span className="badge bg-danger">Failed Verification</span>
      : <span className="badge bg-success">Passed Verification</span>;
  };

  async function handleAction(type) {
    setError("");

    if (type === "reject" && !notes.trim()) {
      setError("Please provide a reason for rejection.");
      return;
    }

    if (type === "reupload") {
      const checkedDocs = DOC_TYPES.filter(d => reuploadDocs[d.key].checked);
      if (checkedDocs.length === 0) {
        setError("Please select at least one document to re-upload.");
        return;
      }
      if (!notes.trim()) {
        setError("Please provide a general note for the applicant.");
        return;
      }
      const missingReason = checkedDocs.find(d => !reuploadDocs[d.key].reason.trim());
      if (missingReason) {
        setError(`Please provide a reason for re-uploading: ${missingReason.label}`);
        return;
      }
    }

    setSubmitting(true);
    try {
      if (type === "approve") {
        await api.post(`/verifier/applications/${id}/approve`, { notes });
      } else if (type === "reject") {
        await api.post(`/verifier/applications/${id}/reject`, { reason: notes });
      } else if (type === "reupload") {
        const reupload_details = DOC_TYPES
          .filter(d => reuploadDocs[d.key].checked)
          .map(d => ({
            document_type: d.key,
            label: d.label,
            reason: reuploadDocs[d.key].reason,
          }));

        await api.post(`/verifier/applications/${id}/reupload`, {
          notes,
          reupload_details,
        });
      }
      navigate("/VerifierApplicationList");
    } catch (err) {
      setError(err.response?.data?.message || "Action failed.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return (
    <div>
      <VerifierNavigation />
      <div className="d-flex justify-content-center mt-5">
        <div className="spinner-border text-danger" />
      </div>
    </div>
  );

  return (
    <div>
      <VerifierNavigation />
      <section className="page-section">
        <div className="container">

          <div className="page-card mb-4">
            <div className="d-flex justify-content-between align-items-center flex-wrap gap-2">
              <div>
                <h3 className="section-title mb-2">Verification Action</h3>
                <p className="text-muted mb-0">Approve, reject, or request re-upload for this application.</p>
              </div>
              <span className="status-badge text-uppercase fw-bold p-2 px-3 border rounded">
                {app?.status?.replace(/_/g, " ")}
              </span>
            </div>
          </div>

          {app && (
            <div className="page-card mb-4">
              <h4 className="section-title mb-3">Application Summary</h4>
              <table className="table table-bordered summary-table align-middle">
                <tbody>
                  {[
                    ["Application ID", `APP-${app.id}`],
                    ["Applicant Name", `${app.user?.first_name} ${app.user?.last_name}`],
                    ["School", app.school_name],
                    ["Current Status", app.status?.replace(/_/g, " ")],
                  ].map(([label, value]) => (
                    <tr key={label}>
                      <th className="bg-light w-25">{label}</th>
                      <td>{value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="page-card">
            <h4 className="section-title mb-3">Verifier Decision</h4>

            {error && <div className="alert alert-danger">{error}</div>}

            <div className="mb-4">
              <label className="form-label fw-semibold">General Notes / Reason <span className="text-danger">*</span></label>
              <textarea
                className="form-control"
                rows="3"
                placeholder="Enter overall notes or reason for your decision. This will be visible to the applicant."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>

            <div className="mb-4">
              <label className="form-label fw-semibold">Documents to Re-upload</label>
              <p className="text-muted small mb-3">
                If requesting re-upload, check the specific documents that need correction and provide a reason for each.
              </p>

              {DOC_TYPES.map((doc) => {
                const docData = reuploadDocs[doc.key];
                const existingDoc = app?.documents?.find(d => d.document_type === doc.key);

                return (
                  <div key={doc.key} className={`border rounded p-3 mb-2 ${docData.checked ? "border-warning bg-warning bg-opacity-10" : "border-light bg-light"}`}>
                    <div className="form-check d-flex align-items-center justify-content-between mb-0">
                      <div>
                        <input
                          className="form-check-input"
                          type="checkbox"
                          id={`doc-${doc.key}`}
                          checked={docData.checked}
                          onChange={() => toggleDoc(doc.key)}
                        />
                        <label className="form-check-label fw-semibold ms-2" htmlFor={`doc-${doc.key}`}>
                          {doc.label}
                        </label>
                      </div>
                      <div>{getDocStatusBadge(existingDoc)}</div>
                    </div>

                    {docData.checked && (
                      <div className="mt-3 ms-4">
                        <label className="form-label small fw-semibold text-danger">
                          Reason for re-upload *
                        </label>
                        <input
                          className="form-control form-control-sm"
                          placeholder="e.g. Text is unreadable, wrong semester displayed, or blurred edges..."
                          value={docData.reason}
                          onChange={(e) => setDocReason(doc.key, e.target.value)}
                          required
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="alert alert-info small mb-4">
              If rejecting, a general reason is required. If requesting re-upload, select the specific documents
              and provide a reason for each. The applicant will see your notes and per-document reasons.
            </div>

            <div className="d-flex flex-wrap gap-2 justify-content-end">
              <button className="btn btn-secondary" onClick={() => navigate(-1)} disabled={submitting}>Cancel</button>
              <button className="btn btn-approve btn-success" onClick={() => handleAction("approve")} disabled={submitting}>Approve</button>
              <button className="btn btn-reupload btn-warning" onClick={() => handleAction("reupload")} disabled={submitting}>Request Re-upload</button>
              <button className="btn btn-reject btn-danger" onClick={() => handleAction("reject")} disabled={submitting}>Reject</button>
            </div>
          </div>

        </div>
      </section>
      <footer className="mt-5 py-3 border-top text-center bg-light">
        <div className="container">
          <p className="mb-0 text-muted small">© 2026 Sangguniang Kabataan of Barangay Mamatid | Verifier Panel</p>
        </div>
      </footer>
    </div>
  );
}

export default VerifierVerificationAction;