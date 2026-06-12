import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import VerifierNavigation from "../components/VerifierNavigation";
import api from "../../services/api";

function VerifierVerificationAction() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [app, setApp] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    api.get(`/verifier/applications/${id}`)
      .then((res) => setApp(res.data))
      .catch(() => setError("Failed to load application."))
      .finally(() => setLoading(false));
  }, [id]);

  async function handleAction(type) {
    if (type === "reject" && !notes.trim()) {
      setError("Please provide a reason for rejection.");
      return;
    }
    if (type === "reupload" && !notes.trim()) {
      setError("Please specify what needs to be re-uploaded.");
      return;
    }

    setSubmitting(true);
    setError("");
    try {
      if (type === "approve") {
        await api.post(`/verifier/applications/${id}/approve`, { notes });
      } else if (type === "reject") {
        await api.post(`/verifier/applications/${id}/reject`, { reason: notes });
      } else if (type === "reupload") {
        await api.post(`/verifier/applications/${id}/reupload`, { notes });
      }
      navigate("/VerifierApplicationList");
    } catch (err) {
      setError(err.response?.data?.message || "Action failed.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <div><VerifierNavigation /><div className="d-flex justify-content-center mt-5"><div className="spinner-border text-danger" /></div></div>;

  return (
    <div>
      <VerifierNavigation />
      <section className="page-section">
        <div className="container">

          <div className="page-card">
            <div className="d-flex justify-content-between align-items-center flex-wrap gap-2">
              <div>
                <h3 className="section-title mb-2">Verification Action</h3>
                <p className="text-muted mb-0">Approve, reject, or request re-upload for this application.</p>
              </div>
              <span className="status-badge">{app?.status}</span>
            </div>
          </div>

          {app && (
            <div className="page-card">
              <h4 className="section-title">Application Summary</h4>
              <table className="table table-bordered summary-table align-middle">
                <tbody>
                  {[
                    ["Application ID", `APP-${app.id}`],
                    ["Applicant Name", `${app.user?.first_name} ${app.user?.last_name}`],
                    ["School", app.school_name],
                    ["Current Status", app.status],
                  ].map(([label, value]) => (
                    <tr key={label}><th>{label}</th><td>{value}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="page-card">
            <h4 className="section-title">Verifier Decision</h4>

            {error && <div className="alert alert-danger">{error}</div>}

            <div className="mb-3">
              <label className="form-label">Notes / Reason</label>
              <textarea
                className="form-control"
                rows="5"
                placeholder="Enter notes, reason for rejection, or documents to re-upload..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>

            <div className="info-box mb-4">
              If rejecting, a reason is required. If requesting re-upload, specify which documents need correction.
            </div>

            <div className="d-flex flex-wrap gap-2 justify-content-end">
              <button className="btn btn-secondary" onClick={() => navigate(-1)} disabled={submitting}>Cancel</button>
              <button className="btn btn-approve" onClick={() => handleAction("approve")} disabled={submitting}>Approve</button>
              <button className="btn btn-reupload" onClick={() => handleAction("reupload")} disabled={submitting}>Request Re-upload</button>
              <button className="btn btn-reject" onClick={() => handleAction("reject")} disabled={submitting}>Reject</button>
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