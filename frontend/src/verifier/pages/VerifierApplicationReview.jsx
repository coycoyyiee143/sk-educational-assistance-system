import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import VerifierNavigation from "../components/VerifierNavigation";
import api from "../../services/api";
import { STATUS_CONFIG } from "../../components/StatusConstants";

function OcrBadge({ passed }) {
  return passed
    ? <span className="badge bg-success">Passed</span>
    : <span className="badge bg-danger">Failed</span>;
}

function VerifierApplicationReview() {
  const { id } = useParams();
  const [app, setApp] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeRawDocId, setActiveRawDocId] = useState(null);

  useEffect(() => {
    api.get(`/verifier/applications/${id}`)
      .then((res) => setApp(res.data))
      .catch(() => setError("Failed to load application."))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div><VerifierNavigation /><div className="d-flex justify-content-center mt-5"><div className="spinner-border text-danger" /></div></div>;
  if (error || !app) return <div><VerifierNavigation /><div className="container mt-4"><div className="alert alert-danger">{error || "Application not found."}</div></div></div>;

  // Extracted user information
  const user = app.user;
  const profile = user?.profile;

  // Time formatting helper
  const formatTimestamp = (dateString) => {
    if (!dateString) return "—";
    try {
      const date = new Date(dateString);
      return date.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      });
    } catch {
      return dateString;
    }
  };

  // Integrity checks evaluator
  const getOverallDocStatus = (docId) => {
    const checks = app.verification_checks?.filter(c => c.document_id === docId) || [];

    if (checks.length === 0) {
      const isProcessing = ["processing", "pending", "pending_prescreening"].includes(app.status);
      return isProcessing
        ? { text: "Processing Checks...", class: "bg-warning text-dark" }
        : { text: "No Verification Data", class: "bg-secondary" };
    }

    const failed = checks.some(c => !c.passed);
    return failed
      ? { text: "Failed Verification", class: "bg-danger" }
      : { text: "Processed", class: "bg-success" };
  };

  // Map out the absolute latest document ID per type to organize the UI cleanly
  const latestDocsMap = {};
  if (app.documents) {
    app.documents.forEach((doc) => {
      if (!latestDocsMap[doc.document_type] || doc.id > latestDocsMap[doc.document_type].id) {
        latestDocsMap[doc.document_type] = doc;
      }
    });
  }

  const sortedDocuments = app.documents ? [...app.documents].sort((a, b) => b.id - a.id) : [];
  const statusInfo = STATUS_CONFIG[app.status] || { label: app.status, class: "secondary" };

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
                <p className="text-muted mb-0">Review the submitted application details along with automated system evaluations.</p>
              </div>
              <span className={`status-badge ${statusInfo.class || "bg-secondary text-white"}`}>{statusInfo.label}</span>
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
                ].map(([label, value]) => (
                  <tr key={label}><th>{label}</th><td>{value ?? "—"}</td></tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Contextualized Document Blocks Stack */}
          <div className="page-card">
            <h4 className="section-title">System Document & OCR Integrity Verification</h4>

            {sortedDocuments.map((doc) => {
              const docLabel = doc.document_type.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
              const fileUrl = doc.file_path ? `${process.env.REACT_APP_API_URL || 'http://127.0.0.1:8000'}/storage/${doc.file_path}` : "#";
              const overallStatus = getOverallDocStatus(doc.id);
              const relatedChecks = app.verification_checks?.filter(c => c.document_id === doc.id) || [];

              // Verify if this specific loop document is the most recent one
              const isLatestVersion = latestDocsMap[doc.document_type]?.id === doc.id;

              // Left boundary style manager
              let leftBorderColor = "#6c757d"; // Gray default for old archived files
              if (isLatestVersion) {
                leftBorderColor = relatedChecks.some(c => !c.passed) ? "#dc3545" : "#198754";
              }

              return (
                <div
                  className="border rounded p-3 mb-4"
                  key={doc.id}
                  style={{
                    borderLeft: `4px solid ${leftBorderColor}`,
                    opacity: isLatestVersion ? 1 : 0.75,
                    backgroundColor: isLatestVersion ? '#ffffff' : '#f8f9fa'
                  }}
                >

                  {/* Document Card Header Row */}
                  <div className="d-flex justify-content-between align-items-start flex-wrap gap-2 mb-3">
                    <div>
                      <div className="d-flex align-items-center gap-2 flex-wrap mb-1">
                        <h6 className="mb-0 fw-bold text-dark">{docLabel}</h6>
                        {isLatestVersion ? (
                          <span className="badge bg-primary" style={{ fontSize: "0.65rem" }}>Current Version</span>
                        ) : (
                          <span className="badge bg-secondary" style={{ fontSize: "0.65rem" }}>Archived (v{doc.version})</span>
                        )}
                      </div>

                      <p className="text-muted text-truncate mb-0 small" title={doc.file_name} style={{ maxWidth: "400px" }}>{doc.file_name}</p>

                      <small className="text-muted d-block mt-1">
                        Uploaded & Processed: <span className="text-dark fw-medium">{formatTimestamp(doc.created_at || doc.updated_at)}</span>
                      </small>

                      {doc.ocr_result && (
                        <small className="text-muted d-block mt-1">
                          Confidence: <strong>
                            {doc.ocr_result.confidence_score
                              ? `${(doc.ocr_result.confidence_score * 100).toFixed(1)}%`
                              : "—"}
                          </strong>
                          {doc.ocr_result.is_low_confidence && (
                            <span className="badge bg-warning text-dark ms-1" style={{ fontSize: "0.65rem" }}>Low Conf</span>
                          )}
                        </small>
                      )}
                    </div>

                    <div className="d-flex align-items-center gap-2">
                      <span className={`badge ${overallStatus.class}`}>
                        {overallStatus.text}
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

                  {/* Integrated Verification Rules Table for this single document */}
                  {relatedChecks.length > 0 ? (
                    <div className="table-responsive">
                      <table className="table table-bordered align-middle mb-0">
                        <thead>
                          <tr>
                            <th>Check Rule</th>
                            <th>Extracted Value</th>
                            <th>Expected Value</th>
                            <th>Status</th>
                            <th>Flag Reason</th>
                          </tr>
                        </thead>
                        <tbody>
                          {relatedChecks.map((check) => (
                            <tr key={check.id} className={check.passed ? "" : "table-danger"}>
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
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="p-3 bg-light rounded text-muted mb-0 small fst-italic border">
                      {["processing", "pending", "pending_prescreening"].includes(app.status) ? (
                        <span className="d-flex align-items-center gap-2">
                          <span className="spinner-border spinner-border-sm text-warning" role="status" />
                          System is extracting text via OCR and verifying rules. Try refreshing shortly.
                        </span>
                      ) : (
                        "No execution parameters run against this file configuration."
                      )}
                    </div>
                  )}

                  {/* Integrated Drawer Toggle & Panel Style */}
                  {doc.ocr_result?.raw_text && (
                    <div className="mt-3 text-end">
                      <button
                        type="button"
                        className="btn btn-outline-secondary btn-sm"
                        onClick={() => setActiveRawDocId(activeRawDocId === doc.id ? null : doc.id)}
                      >
                        {activeRawDocId === doc.id ? "Hide Raw Text" : "View Raw Text"}
                      </button>

                      {activeRawDocId === doc.id && (
                        <div className="bg-light border rounded p-3 mt-2 text-start">
                          <h6 className="small fw-bold mb-2 text-dark">PaddleOCR Text Output Stream:</h6>
                          <pre className="mb-0" style={{ fontSize: "0.75rem", maxHeight: "200px", overflowY: "auto", whiteSpace: "pre-wrap" }}>
                            {(() => {
                              try {
                                const lines = JSON.parse(doc.ocr_result.raw_text);
                                return lines.map((l, i) => `[Line ${i + 1} | Conf: ${((l.confidence ?? 0) * 100).toFixed(0)}%] ${l.text ?? ""}`).join("\n");
                              } catch {
                                return doc.ocr_result.raw_text;
                              }
                            })()}
                          </pre>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Original Action Button Footer Restored */}
          {["for_review", "pending_prescreening", "reupload_requested"].includes(app.status) && (
            <div className="mt-4 text-end">
              <Link to={`/VerifierVerificationAction/${app.id}`} className="btn btn-custom">
                Proceed to Verification Action
              </Link>
            </div>
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

export default VerifierApplicationReview;