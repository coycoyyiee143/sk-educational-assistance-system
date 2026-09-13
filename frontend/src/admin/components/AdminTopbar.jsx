import { useState, useEffect } from "react";
import api from "../../services/api";
function formatDocType(type) {
  return type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
function DistributionBar({ label, count, percentage, max }) {
  const pct = max > 0 ? Math.round((count / max) * 100) : 0;
  return (
    <div className="mb-2">
      <div className="d-flex justify-content-between small mb-1">
        <span>{label}</span>
        <span className="text-muted">{count} · {percentage ?? 0}%</span>
      </div>
      <div className="progress" style={{ height: "8px" }}>
        <div className="progress-bar bg-danger" role="progressbar" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
function VerificationHeaderIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" aria-hidden="true">
      <path d="M12 3l7 3v5c0 4.6-2.7 8.2-7 10-4.3-1.8-7-5.4-7-10V6l7-3z" strokeLinejoin="round" />
      <path d="M9 12l2 2 4-4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function PdfExportIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" aria-hidden="true">
      <path d="M12 4v10" strokeLinecap="round" />
      <path d="M8.5 10.5L12 14l3.5-3.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M5 15v3.5A1.5 1.5 0 006.5 20h11a1.5 1.5 0 001.5-1.5V15" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function InfoNoticeIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 10.5v6" strokeLinecap="round" />
      <circle cx="12" cy="7.5" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}
function VerificationOutcomesSection({ selectedConfigId, section }) {
  const [documentFailures, setDocumentFailures] = useState(null);
  const [claimingOutcomes, setClaimingOutcomes] = useState(null);
  // eslint-disable-next-line no-unused-vars -- fetched for the future weekly trend chart, not yet rendered
  const [trends, setTrends] = useState(null);
  const [sectionLoading, setSectionLoading] = useState(true);
  useEffect(() => {
    setSectionLoading(true);
    const params = selectedConfigId ? { config_id: selectedConfigId } : {};
    Promise.all([
      api.get("/admin/reports/document-failures", { params }).then((res) => setDocumentFailures(res.data)).catch(() => {}),
      api.get("/admin/reports/claiming-outcomes", { params }).then((res) => setClaimingOutcomes(res.data)).catch(() => {}),
      api.get("/admin/reports/submission-trends", { params }).then((res) => setTrends(res.data)).catch(() => {})
    ]).finally(() => setSectionLoading(false));
  }, [selectedConfigId]);
  async function handlePdfExport(endpoint, filenamePrefix) {
    try {
      const params = selectedConfigId ? { config_id: selectedConfigId } : {};
      const res = await api.get(endpoint, { params, responseType: "blob" });
      const url = window.URL.createObjectURL(new Blob([res.data], { type: "application/pdf" }));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `${filenamePrefix}-${new Date().toISOString().slice(0, 10)}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch {}
  }
  const claimCounts = claimingOutcomes?.counts ?? {};
  const claimRates = claimingOutcomes?.rates ?? {};
  const notClearedReasons = claimingOutcomes?.not_cleared_reasons ?? {};
  const reuploadFlagCounts = documentFailures?.reupload_flag_counts_by_document ?? {};
  const reuploadFlagPercentages = documentFailures?.reupload_flag_percentages_by_document ?? {};
  const reuploadReasonsByDoc = documentFailures?.reupload_reasons_by_document ?? {};
  const automatedFailuresByDoc = documentFailures?.automated_check_failures_by_document ?? {};
  const maxReuploadFlags = Math.max(1, ...Object.values(reuploadFlagCounts));
  const notClearedTotal = Object.values(notClearedReasons).reduce((sum, v) => sum + v, 0);
  const maxNotClearedReasons = Math.max(1, ...Object.values(notClearedReasons));
  if (sectionLoading) {
    return (
      <div className={section === "issues" ? "applicant-profile-card applicant-profile-card-loading" : "page-card"}>
        <div className="d-flex justify-content-center align-items-center py-5 h-100">
          <div className="spinner-border text-danger" role="status" />
        </div>
      </div>
    );
  }
  if (section === "issues") {
    return (
      <div className="applicant-profile-card verification-issues-card">
        <div className="applicant-profile-card-header">
          <div className="applicant-profile-heading">
            <span className="applicant-profile-header-icon"><VerificationHeaderIcon /></span>
            <div>
              <h4 className="applicant-profile-card-title">Document Verification Issues</h4>
              {documentFailures?.config && <span className="applicant-profile-cycle">Cycle {documentFailures.config.school_year}</span>}
            </div>
          </div>
          <button type="button" className="applicant-profile-export-btn" title="Export PDF" aria-label="Export Document Verification Issues PDF" onClick={() => handlePdfExport("/admin/reports/document-failures/pdf", "document-failure-breakdown")}><PdfExportIcon /></button>
        </div>
        <div className="applicant-profile-card-body verification-issues-body">
          <div className="verification-notice">
            <span className="verification-notice-icon"><InfoNoticeIcon /></span>
            <p>Which document most often causes a re-upload request, and which automated checks fail most often per document type.</p>
          </div>
          {Object.keys(reuploadFlagCounts).length === 0 && Object.keys(automatedFailuresByDoc).length === 0 ? (
            <div className="alert alert-info mb-0">No document flags recorded for the selected period.</div>
          ) : (
            <>
              {Object.keys(reuploadFlagCounts).length > 0 && (
                <div className="verification-issues-section">
                  <h6 className="text-muted text-uppercase small fw-bold mb-2">Re-upload Requests by Document</h6>
                  {Object.entries(reuploadFlagCounts).map(([docType, count]) => (
                    <DistributionBar key={docType} label={formatDocType(docType)} count={count} percentage={reuploadFlagPercentages[docType]} max={maxReuploadFlags} />
                  ))}
                </div>
              )}
              {Object.entries(reuploadReasonsByDoc).map(([docType, reasons]) => (
                <div className="verification-issues-section" key={docType}>
                  <h6 className="text-muted small fw-bold mb-2">{formatDocType(docType)} — Reasons</h6>
                  <div className="table-responsive">
                    <table className="table table-sm table-bordered mb-0 verification-issues-table">
                      <colgroup>
                        <col style={{ width: "80%" }} />
                        <col style={{ width: "20%" }} />
                      </colgroup>
                      <thead>
                        <tr>
                          <th>Reason</th>
                          <th>Count</th>
                        </tr>
                      </thead>
                      <tbody>
                        {Object.entries(reasons).sort((a, b) => b[1] - a[1]).map(([reason, count]) => (
                          <tr key={reason}>
                            <td>{reason}</td>
                            <td>{count}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
              {Object.keys(automatedFailuresByDoc).length > 0 && (
                <div className="verification-issues-section">
                  <h6 className="text-muted text-uppercase small fw-bold mb-2">Automated OCR Check Failures</h6>
                  <div className="table-responsive">
                    <table className="table table-sm table-bordered mb-0 verification-issues-table">
                      <colgroup>
                        <col style={{ width: "35%" }} />
                        <col style={{ width: "45%" }} />
                        <col style={{ width: "20%" }} />
                      </colgroup>
                      <thead>
                        <tr>
                          <th>Document</th>
                          <th>Check</th>
                          <th>Failures</th>
                        </tr>
                      </thead>
                      <tbody>
                        {Object.entries(automatedFailuresByDoc).flatMap(([docType, checks]) =>
                          Object.entries(checks).map(([checkName, count]) => (
                            <tr key={`${docType}-${checkName}`}>
                              <td>{formatDocType(docType)}</td>
                              <td><code className="small">{checkName}</code></td>
                              <td>{count}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    );
  }
  if (section === "claiming") {
    return (
      <div className="page-card">
        <div className="d-flex justify-content-between align-items-start flex-wrap gap-2">
          <h4 className="sub-title">
            Claiming Day Outcomes
            {claimingOutcomes?.config && <span className="text-muted fw-normal" style={{ fontSize: "14px" }}>{" "}— {claimingOutcomes.config.school_year}</span>}
          </h4>
          <button type="button" className="btn btn-sm btn-outline-custom" onClick={() => handlePdfExport("/admin/reports/claiming-outcomes/pdf", "claiming-outcome-summary")}>Export PDF</button>
        </div>
        {!claimingOutcomes?.config || claimCounts.total === 0 ? (
          <div className="alert alert-info mb-0">No claiming data available for the selected period.</div>
        ) : (
          <>
            <div className="row g-4 mb-3">
              <div className="col-md-3">
                <div className="summary-card">
                  <h2>{claimCounts.claimed}</h2>
                  <p>Claimed ({claimRates.claimed_rate}%)</p>
                </div>
              </div>
              <div className="col-md-3">
                <div className="summary-card">
                  <h2>{claimCounts.not_cleared}</h2>
                  <p>Not Cleared ({claimRates.not_cleared_rate}%)</p>
                </div>
              </div>
              <div className="col-md-3">
                <div className="summary-card">
                  <h2>{claimCounts.unclaimed}</h2>
                  <p>Unclaimed ({claimRates.unclaimed_rate}%)</p>
                </div>
              </div>
              <div className="col-md-3">
                <div className="summary-card">
                  <h2>{claimCounts.pending}</h2>
                  <p>Awaiting Claiming</p>
                </div>
              </div>
            </div>
            {Object.keys(notClearedReasons).length > 0 && (
              <>
                <h6 className="text-muted text-uppercase small fw-bold mb-2">Not Cleared — Common Reasons</h6>
                {Object.entries(notClearedReasons).map(([reason, count]) => (
                  <DistributionBar key={reason} label={reason} count={count} percentage={notClearedTotal > 0 ? Math.round((count / notClearedTotal) * 1000) / 10 : 0} max={maxNotClearedReasons} />
                ))}
              </>
            )}
          </>
        )}
      </div>
    );
  }
  return null;
}
export default VerificationOutcomesSection;