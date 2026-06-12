import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import VerifierNavigation from "../components/VerifierNavigation";
import api from "../../services/api";

function OcrBadge({ passed }) {
  return passed
    ? <span className="badge bg-success">Passed</span>
    : <span className="badge bg-danger">Failed</span>;
}

function VerifierApplicationReview() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [app, setApp] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    api.get(`/verifier/applications/${id}`)
      .then((res) => setApp(res.data))
      .catch(() => setError("Failed to load application."))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div><VerifierNavigation /><div className="d-flex justify-content-center mt-5"><div className="spinner-border text-danger" /></div></div>;
  if (error || !app) return <div><VerifierNavigation /><div className="container mt-4"><div className="alert alert-danger">{error || "Application not found."}</div></div></div>;

  const user = app.user;
  const profile = user?.profile;

  return (
    <div>
      <VerifierNavigation />
      <section className="page-section">
        <div className="container">

          <div className="page-card">
            <div className="d-flex justify-content-between align-items-center">
              <div>
                <h3 className="section-title mb-2">Application Review</h3>
                <p className="text-muted mb-0">Review the submitted application and uploaded documents.</p>
              </div>
              <span className="status-badge">{app.status}</span>
            </div>
          </div>

          {/* Applicant Info */}
          <div className="page-card">
            <h4 className="section-title">Applicant Information</h4>
            <table className="table table-bordered info-table">
              <tbody>
                {[
                  ["Application ID", `APP-${app.id}`],
                  ["Applicant Name", `${user?.first_name} ${user?.last_name}`],
                  ["Email", user?.email],
                  ["Mobile", user?.mobile_number],
                  ["Submission Date", app.submitted_at?.split("T")[0]],
                  ["Address", profile ? `${profile.barangay ?? ""}, ${profile.city ?? ""}, ${profile.province ?? ""}` : "—"],
                ].map(([label, value]) => (
                  <tr key={label}><th>{label}</th><td>{value}</td></tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Educational Info */}
          <div className="page-card">
            <h4 className="section-title">Educational Information</h4>
            <table className="table table-bordered info-table">
              <tbody>
                {[
                  ["School Name", app.school_name],
                  ["Course", app.course],
                  ["Year Level", app.year_level],
                  ["Student ID", app.student_id_number],
                  ["School Year", app.configuration?.school_year],
                  ["Semester", app.configuration?.semester],
                ].map(([label, value]) => (
                  <tr key={label}><th>{label}</th><td>{value ?? "—"}</td></tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* OCR Results */}
          <div className="page-card">
            <h4 className="section-title">System OCR Verification Results</h4>
            {app.verification_checks?.length > 0 ? (
              <div className="table-responsive">
                <table className="table table-bordered align-middle">
                  <thead>
                    <tr><th>Check</th><th>Extracted</th><th>Expected</th><th>Status</th><th>Reason</th></tr>
                  </thead>
                  <tbody>
                    {app.verification_checks.map((check) => (
                      <tr key={check.id}>
                        <td>{check.check_name}</td>
                        <td>{check.extracted_value ?? "—"}</td>
                        <td>{check.expected_value ?? "—"}</td>
                        <td><OcrBadge passed={check.passed} /></td>
                        <td>{check.flag_reason ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-muted">No OCR results yet — documents may still be processing.</p>
            )}
          </div>

          {/* Documents */}
          <div className="page-card">
            <h4 className="section-title">Uploaded Documents</h4>
            <div className="row g-3">
              {app.documents?.map((doc) => (
                <div className="col-md-4" key={doc.id}>
                  <div className="doc-card">
                    <h6>{doc.document_type.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())}</h6>
                    <p className="text-muted">{doc.file_name}</p>
                    <span className={`badge ${doc.status === "processed" ? "bg-success" : doc.status === "failed" ? "bg-danger" : "bg-secondary"}`}>
                      {doc.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
            {["for_review", "pending_prescreening", "reupload_requested"].includes(app.status) && (
              <div className="mt-4 text-end">
                <Link to={`/VerifierVerificationAction/${app.id}`} className="btn btn-custom">
                  Proceed to Verification Action
                </Link>
              </div>
            )}
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

export default VerifierApplicationReview;