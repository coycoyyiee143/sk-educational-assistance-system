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
  const [activeRawDocId, setActiveRawDocId] = useState(null); // Tracks which document's raw OCR text is showing

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

  // Map document objects by ID for easy data cross-referencing inside the OCR table
  const docMap = {};
  app.documents?.forEach((doc) => { docMap[doc.id] = doc; });

  return (
    <div>
      <VerifierNavigation />
      <section className="page-section">
        <div className="container">

          {/* Header */}
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
                  ["Mobile", user?.mobile_number ?? "—"],
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

          {/* Uploaded Documents (Matching VerifierClaiming View Layout) */}
          <div className="page-card">
            <h4 className="section-title">Uploaded Documents</h4>
            <div className="row g-3">
              {app.documents?.map((doc) => {
                const docLabel = doc.document_type.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
                const fileUrl = doc.file_path ? `${process.env.REACT_APP_API_URL || 'http://127.0.0.1:8000'}/storage/${doc.file_path}` : "#";

                return (
                  <div className="col-md-4" key={doc.id}>
                    <div className="doc-check">
                      <h6>{docLabel}</h6>
                      <p className="text-muted text-truncate" title={doc.file_name}>{doc.file_name}</p>

                      <div className="d-flex justify-content-between align-items-center mt-2">
                        <span className={`badge ${doc.status === "processed" ? "bg-success" : doc.status === "failed" ? "bg-danger" : "bg-secondary"}`}>
                          {doc.status}
                        </span>
                        <a
                          href={fileUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn btn-outline-custom btn-sm"
                        >
                          View File
                        </a>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* System OCR Verification Results */}
          <div className="page-card">
            <h4 className="section-title">System OCR Verification Results</h4>
            {app.verification_checks?.length > 0 ? (
              <div className="table-responsive">
                <table className="table table-bordered align-middle">
                  <thead>
                    <tr>
                      <th>Document Targeted</th>
                      <th>Check Rule</th>
                      <th>Extracted Value</th>
                      <th>Expected Value</th>
                      <th>Status</th>
                      <th>Flag Reason</th>
                    </tr>
                  </thead>
                  <tbody>
                    {app.verification_checks.map((check) => {
                      const associatedDoc = docMap[check.document_id];
                      const docLabel = associatedDoc
                        ? associatedDoc.document_type.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())
                        : `Doc #${check.document_id}`;

                      return (
                        <tr key={check.id} className={check.passed ? "" : "table-danger"}>
                          <td>
                            <span className="fw-semibold d-block">{docLabel}</span>
                            {associatedDoc?.ocr_result && (
                              <small className="text-muted d-block mt-1">
                                Confidence: <strong>
                                  {associatedDoc.ocr_result.confidence_score
                                    ? `${(associatedDoc.ocr_result.confidence_score * 100).toFixed(1)}%`
                                    : "—"}
                                </strong>
                                {associatedDoc.ocr_result.is_low_confidence && (
                                  <span className="badge bg-warning text-dark ms-1" style={{ fontSize: "0.65rem" }}>Low Conf</span>
                                )}
                              </small>
                            )}
                          </td>
                          <td><code className="small">{check.check_name}</code></td>
                          <td>
                            {check.extracted_value
                              ? <span className="text-success fw-semibold">{check.extracted_value}</span>
                              : <span className="text-muted fst-italic">not extracted</span>}
                          </td>
                          <td>{check.expected_value ?? <span className="text-muted">—</span>}</td>
                          <td><OcrBadge passed={check.passed} /></td>
                          <td>{check.flag_reason ?? <span className="text-muted">—</span>}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-muted">No OCR results yet — documents may still be processing.</p>
            )}

            {/* Raw Extracted Text Inspection Drawer */}
            {app.documents?.some(d => d.ocr_result?.raw_text) && (
              <div className="mt-4 border-top pt-3">
                <h5 className="h6 text-muted mb-3">Raw OCR Data Inspection Logs</h5>
                <div className="d-flex gap-2 flex-wrap mb-3">
                  {app.documents.filter(d => d.ocr_result?.raw_text).map((doc) => {
                    const docLabel = doc.document_type.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
                    return (
                      <button
                        key={doc.id}
                        type="button"
                        className={`btn btn-sm ${activeRawDocId === doc.id ? "btn-secondary" : "btn-outline-secondary"}`}
                        onClick={() => setActiveRawDocId(activeRawDocId === doc.id ? null : doc.id)}
                      >
                        {activeRawDocId === doc.id ? "Hide" : "View Raw Text"} ({docLabel})
                      </button>
                    );
                  })}
                </div>

                {app.documents.map((doc) => {
                  if (activeRawDocId !== doc.id || !doc.ocr_result?.raw_text) return null;

                  let rawLines = [];
                  try {
                    rawLines = JSON.parse(doc.ocr_result.raw_text);
                  } catch {
                    rawLines = [];
                  }

                  return (
                    <div key={doc.id} className="bg-light border rounded p-3 mb-2">
                      <h6 className="small fw-bold mb-2 text-dark">PaddleOCR Text Output Stream:</h6>
                      <pre className="mb-0" style={{ fontSize: "0.75rem", maxHeight: "200px", overflowY: "auto", whiteSpace: "pre-wrap" }}>
                        {rawLines.length > 0
                          ? rawLines.map((l, i) => `[Line ${i + 1} | Conf: ${((l.confidence ?? 0) * 100).toFixed(0)}%] ${l.text ?? ""}`).join("\n")
                          : doc.ocr_result.raw_text}
                      </pre>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {["for_review", "pending_prescreening", "reupload_requested"].includes(app.status) && (
            <div className="mt-4 text-end">
              <Link to={`/VerifierVerificationAction/${app.id}`} className="btn btn-custom">
                Proceed to Verification Action
              </Link>
            </div>
          )}
        </div>
      </section >
      <footer>
        <div className="container">
          <p className="mb-0">© 2026 Sangguniang Kabataan of Barangay Mamatid | Verifier Panel</p>
        </div>
      </footer>
    </div >
  );
}

export default VerifierApplicationReview;