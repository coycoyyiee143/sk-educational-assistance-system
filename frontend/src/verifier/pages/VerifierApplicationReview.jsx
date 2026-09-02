import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import VerifierNavigation from "../components/VerifierNavigation";
import api from "../../services/api";
import { getReasonsByDocType, OTHER } from "../constants/verificationReasons";
import { getVerifierStatusLabel, getVerifierBadgeClass } from "../../components/StatusConstants";

function OcrBadge({ passed }) {
  return passed
    ? <span className="badge bg-success">Passed</span>
    : <span className="badge bg-danger">Failed</span>;
}

const CHECK_NAME_LABELS = {
  image_integrity: "Edited/Tampered Image Detection",
  document_origin: "Suspicious File Origin (Design Software)",
  ai_generation_provenance: "AI-Generated or AI-Edited Image",
};

function prefillFromLatestAction(latestAction, reasonsByDocType, appStatus) {
  const base = {
    registration_form: { reasons: [], otherText: "" },
    school_id: { reasons: [], otherText: "" },
    voters_certificate: { reasons: [], otherText: "" },
  };
  if (
    !latestAction ||
    latestAction.action !== "reupload_requested" ||
    !latestAction.reupload_details ||
    appStatus !== "reupload_requested"
  ) {
    return base;
  }
  latestAction.reupload_details.forEach((d) => {
    const options = reasonsByDocType[d.document_type] || [];
    const stored = d.reason_categories || [];
    const known = stored.filter((c) => options.includes(c));
    const custom = stored.filter((c) => !options.includes(c));
    base[d.document_type] = {
      reasons: custom.length > 0 ? [...known, OTHER] : known,
      otherText: custom.join(" "),
    };
  });
  return base;
}

function VerifierApplicationReview() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [app, setApp] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeRawDocId, setActiveRawDocId] = useState(null);
  const [flaggedDocs, setFlaggedDocs] = useState({
    registration_form: { reasons: [], otherText: "" },
    school_id: { reasons: [], otherText: "" },
    voters_certificate: { reasons: [], otherText: "" },
  });

  useEffect(() => {
    api.get(`/verifier/applications/${id}`)
      .then((res) => {
        setApp(res.data);
        const reasonsByDocType = getReasonsByDocType(res.data.configuration?.school_year);
        const latestAction = res.data.verifier_actions?.[0];
        setFlaggedDocs(prefillFromLatestAction(latestAction, reasonsByDocType, res.data.status));
      })
      .catch(() => setError("Failed to load application."))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div><VerifierNavigation /><div className="d-flex justify-content-center mt-5"><div className="spinner-border text-danger" /></div></div>;
  if (error || !app) return <div><VerifierNavigation /><div className="container mt-4"><div className="alert alert-danger">{error || "Application not found."}</div></div></div>;

  const user = app.user;
  const profile = user?.profile;
  const reasonsByDocType = getReasonsByDocType(app.configuration?.school_year);
  const latestAction = app.verifier_actions?.[0];

  const formatTimestamp = (dateString) => {
    if (!dateString) return "—";
    try {
      const date = new Date(dateString);
      return date.toLocaleString('en-US', {
        month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true
      });
    } catch {
      return dateString;
    }
  };

  const latestDocsMap = {};
  if (app.documents) {
    app.documents.forEach((doc) => {
      if (!latestDocsMap[doc.document_type] || doc.id > latestDocsMap[doc.document_type].id) {
        latestDocsMap[doc.document_type] = doc;
      }
    });
  }

  // isLatestVersion is required here, not just app.status — an ARCHIVED
  // (superseded) document version is frozen history and will NEVER be
  // reprocessed again, no matter what the application's current overall
  // status is. Without this check, every old version showed a permanent
  // "Processing Checks..." spinner, since it only looked at app.status.
  const getOverallDocStatus = (docId, isLatestVersion) => {
    const checks = app.verification_checks?.filter(c => c.document_id === docId) || [];
    const doc = app.documents?.find(d => d.id === docId);

    if (checks.length === 0) {
      const isProcessing = isLatestVersion && ["processing", "pending", "pending_prescreening"].includes(app.status);
      if (isProcessing) {
        return { text: "Processing Checks...", class: "bg-warning text-dark" };
      }
      // No checks exist, and we're not mid-processing — this document
      // either short-circuited at the upload-check stage (wrong type,
      // low quality, cert-year mismatch) or is an old archived version
      // that was superseded before it accumulated checks.
      if (doc?.needs_auto_reupload) {
        return { text: "Flagged — Auto Re-upload", class: "bg-secondary" };
      }
      return { text: "No Verification Data", class: "bg-secondary" };
    }

    const failed = checks.some(c => !c.passed);
    return failed
      ? { text: "Failed Verification", class: "bg-danger" }
      : { text: "Processed", class: "bg-success" };
  };

  const sortedDocuments = app.documents ? [...app.documents].sort((a, b) => b.id - a.id) : [];
  const latestDocIds = Object.values(latestDocsMap).map((d) => d.id);
  const hasLowConfidence = Object.values(latestDocsMap).some((d) => d.ocr_result?.is_low_confidence);
  const hasFailedCheck = (app.verification_checks || []).some(
    (c) => latestDocIds.includes(c.document_id) && !c.passed
  );
  const hasAiProvenanceFlag = (app.verification_checks || []).some(
    (c) => latestDocIds.includes(c.document_id) && c.check_name === "ai_generation_provenance" && !c.passed
  );
  const hasSuggestedDisapproval = (app.verification_checks || []).some(
    (c) => latestDocIds.includes(c.document_id) && c.metadata?.flag === "SUGGESTED_DISAPPROVAL"
  );
  const showFlagSummary = hasLowConfidence || hasFailedCheck;

  function toggleReason(docType, reasonText) {
    setFlaggedDocs((prev) => {
      const current = prev[docType].reasons;
      const updated = current.includes(reasonText)
        ? current.filter((r) => r !== reasonText)
        : [...current, reasonText];
      return { ...prev, [docType]: { ...prev[docType], reasons: updated } };
    });
  }

  function setOtherText(docType, text) {
    setFlaggedDocs((prev) => ({
      ...prev,
      [docType]: { ...prev[docType], otherText: text },
    }));
  }

  function handleProceed() {
    navigate(`/VerifierVerificationAction/${app.id}`, { state: { flaggedDocs } });
  }

  return (
    <div>
      <VerifierNavigation />
      <section className="page-section">
        <div className="container">

          <div className="page-card">
            <div className="d-flex justify-content-between align-items-center">
              <div>
                <h3 className="section-title mb-2">Application Review</h3>
                <p className="text-muted mb-0">Review the submitted application details along with automated system evaluations.</p>
              </div>
              <span className={`status-badge ${getVerifierBadgeClass(app)}`}>{getVerifierStatusLabel(app)}</span>
            </div>
            {hasSuggestedDisapproval && (
              <div className="alert alert-dark small mt-3 mb-0">
                <strong>⚠ Suggested: Reject — Non-Resident.</strong> The document(s) below indicate a residency
                outside Barangay Mamatid. This program is exclusive to Mamatid residents. This is a suggestion
                only — please confirm before making a decision, since a data-entry or upload mistake is still
                possible.
              </div>
            )}
            {showFlagSummary && (
              <div className="mt-3 d-flex flex-wrap gap-2">
                <span className="text-muted small fw-semibold">Flagged for:</span>
                {hasLowConfidence && (
                  <span className="badge bg-warning text-dark">Low Image Confidence</span>
                )}
                {hasAiProvenanceFlag && (
                  <span className="badge bg-dark">⚠ AI-Generated/Edited Image Signals Detected</span>
                )}
                {hasFailedCheck && (
                  <span className="badge bg-danger">Failed Eligibility Check(s)</span>
                )}
              </div>
            )}
            {app.status === "rejected" && latestAction?.action === "rejected" && (
              <div className="alert alert-secondary small mt-3 mb-0">
                <strong>Previously rejected.</strong> Reasons on record: {(latestAction.reason_categories || []).join(" ")}
              </div>
            )}
          </div>

          <div className="page-card">
            <h4 className="section-title">Applicant Information</h4>
            <table className="table table-bordered info-table">
              <tbody>
                {[
                  ["Application ID", `APP-${app.id}`],
                  ["Applicant Name", `${user?.first_name} ${user?.last_name}`],
                  ["Email", user?.email],
                  ["Mobile", user?.mobile_number ?? "—"],
                  ["Date of Birth", profile?.birthdate ?? "—"],
                  ["Submission Date", app.submitted_at?.split("T")[0]],
                  ["Address", profile ? `${profile.barangay ?? ""}, ${profile.city ?? ""}, ${profile.province ?? ""}` : "—"],
                ].map(([label, value]) => (
                  <tr key={label}><th>{label}</th><td>{value}</td></tr>
                ))}
                {profile?.is_minor && (
                  <tr>
                    <th>Guardian (Minor Applicant)</th>
                    <td>
                      {profile.guardian_first_name || profile.guardian_last_name
                        ? `${profile.guardian_first_name ?? ""} ${profile.guardian_middle_name ?? ""} ${profile.guardian_last_name ?? ""}`.replace(/\s+/g, " ").trim()
                        : <span className="text-danger">No guardian on file</span>}
                      {profile.guardian_relationship && ` (${profile.guardian_relationship})`}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

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

          <div className="page-card">
            <h4 className="section-title">System Document & OCR Integrity Verification</h4>

            {sortedDocuments.map((doc) => {
              const docLabel = doc.document_type.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
              async function handleViewFile(docId) {
                try {
                  const res = await api.get(`/applications/${app.id}/documents/${docId}/file`, { responseType: "blob" });
                  const url = URL.createObjectURL(res.data);
                  window.open(url, "_blank");
                  setTimeout(() => URL.revokeObjectURL(url), 60000);
                } catch {
                  alert("Failed to load document.");
                }
              }

              const isLatestVersion = latestDocsMap[doc.document_type]?.id === doc.id;
              const overallStatus = getOverallDocStatus(doc.id, isLatestVersion);
              const relatedChecks = app.verification_checks?.filter(c => c.document_id === doc.id) || [];

              const isFailedLike = overallStatus.text === "Failed Verification" || overallStatus.text === "No Verification Data";
              let leftBorderColor = "#6c757d";
              if (isLatestVersion) {
                leftBorderColor = relatedChecks.some(c => !c.passed) ? "#dc3545" : "#198754";
              }
              const flagState = flaggedDocs[doc.document_type];
              const reasonOptions = reasonsByDocType[doc.document_type] || [];
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
                      <span className={`badge ${overallStatus.class}`}>{overallStatus.text}</span>
                      <button type="button" className="btn btn-outline-custom btn-sm" onClick={() => handleViewFile(doc.id)}>
                        View File
                      </button>
                    </div>
                  </div>

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
                              <td>
                                <code className="small">{CHECK_NAME_LABELS[check.check_name] ?? check.check_name}</code>
                                {check.metadata?.flag === "SUGGESTED_DISAPPROVAL" && (
                                  <span className="badge bg-dark ms-2" style={{ fontSize: "0.6rem" }}>
                                    Suggested: Reject
                                  </span>
                                )}
                              </td>
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
                      {isLatestVersion && ["processing", "pending", "pending_prescreening"].includes(app.status) ? (
                        <span className="d-flex align-items-center gap-2">
                          <span className="spinner-border spinner-border-sm text-warning" role="status" />
                          System is extracting text via OCR and verifying rules. Try refreshing shortly.
                        </span>
                      ) : (
                        "No execution parameters run against this file configuration."
                      )}
                    </div>
                  )}

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
                  {isLatestVersion && (
                    <details className="mt-3" open={isFailedLike || flagState.reasons.length > 0}>
                      <summary className="text-danger fw-semibold" style={{ cursor: "pointer" }}>
                        Flag an issue with this document
                      </summary>
                      <div className="mt-2 ps-2">
                        {reasonOptions.map((reason) => (
                          <div className="form-check" key={reason}>
                            <input
                              className="form-check-input"
                              type="checkbox"
                              id={`flag-${doc.document_type}-${reason}`}
                              checked={flagState.reasons.includes(reason)}
                              onChange={() => toggleReason(doc.document_type, reason)}
                            />
                            <label className="form-check-label small" htmlFor={`flag-${doc.document_type}-${reason}`}>
                              {reason}
                            </label>
                          </div>
                        ))}
                        {flagState.reasons.includes(OTHER) && (
                          <input
                            className="form-control form-control-sm mt-2"
                            placeholder="Specify the issue..."
                            value={flagState.otherText}
                            onChange={(e) => setOtherText(doc.document_type, e.target.value)}
                          />
                        )}
                      </div>
                    </details>
                  )}
                </div>
              );
            })}
          </div>

          {["for_review", "pending_prescreening", "reupload_requested"].includes(app.status) && (
            <div className="mt-4 text-end">
              <button type="button" className="btn btn-custom" onClick={handleProceed}>
                Proceed to Verification Action
              </button>
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