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
        <span className="verification-distribution-stats"><strong>{count}</strong><span> · {percentage ?? 0}%</span></span>
      </div>
      <div className="profile-category-progress">
        <div className="profile-category-progress-bar" style={{ width: `${pct}%` }} />
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
function MessageIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
      <path d="M20 11.5a7.8 7.8 0 0 1-8 7.5 8.7 8.7 0 0 1-3.7-.8L4 20l1.4-3.7A7.2 7.2 0 0 1 4 12a7.8 7.8 0 0 1 8-7.5 7.8 7.8 0 0 1 8 7Z" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="8.5" cy="11.7" r="1" fill="currentColor" stroke="none" />
      <circle cx="12" cy="11.7" r="1" fill="currentColor" stroke="none" />
      <circle cx="15.5" cy="11.7" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}
function ViewAllButton({ onClick }) {
  return (
    <button type="button" className="report-history-view-link" onClick={onClick}>
      <span>View All Records</span>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
        <path d="M5 12h14M14 7l5 5-5 5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  );
}
function VerificationOutcomesSection({ selectedConfigId, section }) {
  const [documentFailures, setDocumentFailures] = useState(null);
  const [claimingOutcomes, setClaimingOutcomes] = useState(null);
  // eslint-disable-next-line no-unused-vars -- fetched for the future weekly trend chart, not yet rendered
  const [trends, setTrends] = useState(null);
  const [sectionLoading, setSectionLoading] = useState(true);
  const [issuesModalOpen, setIssuesModalOpen] = useState(false);
  const [issuesPage, setIssuesPage] = useState(1);
  const [claimingReasonsModalOpen, setClaimingReasonsModalOpen] = useState(false);
  const [claimingReasonsPage, setClaimingReasonsPage] = useState(1);
  const issuesPerPage = 5;
  const claimingReasonsPerPage = 5;
  useEffect(() => {
    setSectionLoading(true);
    const params = selectedConfigId ? { config_id: selectedConfigId } : {};
    Promise.all([
      api.get("/admin/reports/document-failures", { params }).then((res) => setDocumentFailures(res.data)).catch(() => {}),
      api.get("/admin/reports/claiming-outcomes", { params }).then((res) => setClaimingOutcomes(res.data)).catch(() => {}),
      api.get("/admin/reports/submission-trends", { params }).then((res) => setTrends(res.data)).catch(() => {})
    ]).finally(() => setSectionLoading(false));
  }, [selectedConfigId]);
  useEffect(() => {
    setIssuesPage(1);
    setIssuesModalOpen(false);
    setClaimingReasonsPage(1);
    setClaimingReasonsModalOpen(false);
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
  const claimingReasonRows = Object.entries(notClearedReasons).map(([reason, count]) => ({
    reason,
    count,
    percentage: claimCounts.not_cleared > 0 ? ((count / claimCounts.not_cleared) * 100).toFixed(1) : "0.0"
  })).sort((a, b) => b.count - a.count);
  const claimingReasonsTotalPages = Math.max(1, Math.ceil(claimingReasonRows.length / claimingReasonsPerPage));
  const claimingReasonsStart = (claimingReasonsPage - 1) * claimingReasonsPerPage;
  const claimingReasonsEnd = claimingReasonsStart + claimingReasonsPerPage;
  const modalClaimingReasons = claimingReasonRows.slice(claimingReasonsStart, claimingReasonsEnd);
  const reuploadFlagCounts = documentFailures?.reupload_flag_counts_by_document ?? {};
  const reuploadFlagPercentages = documentFailures?.reupload_flag_percentages_by_document ?? {};
  const reuploadReasonsByDoc = documentFailures?.reupload_reasons_by_document ?? {};
  const automatedFailuresByDoc = documentFailures?.automated_check_failures_by_document ?? {};
  const maxReuploadFlags = Math.max(1, ...Object.values(reuploadFlagCounts));
  const reuploadEntries = Object.entries(reuploadFlagCounts);
  const visibleReuploadEntries = reuploadEntries.slice(0, 3);
  const issueReasonRows = Object.entries(reuploadReasonsByDoc).flatMap(([docType, reasons]) =>
    Object.entries(reasons).sort((a, b) => b[1] - a[1]).map(([reason, count]) => ({ type: "reason", docType, reason, count }))
  );
  const automatedFailureRows = Object.entries(automatedFailuresByDoc).flatMap(([docType, checks]) =>
    Object.entries(checks).map(([checkName, count]) => ({ type: "automated", docType, checkName, count }))
  );
  const issueDetailRows = [...issueReasonRows, ...automatedFailureRows];
  const issuesTotalPages = Math.max(1, Math.ceil(issueDetailRows.length / issuesPerPage));
  const issuesStart = (issuesPage - 1) * issuesPerPage;
  const issuesEnd = issuesStart + issuesPerPage;
  const modalIssueDetailRows = issueDetailRows.slice(issuesStart, issuesEnd);
  function openIssuesModal() {
    setIssuesPage(1);
    setIssuesModalOpen(true);
  }
  function closeIssuesModal() {
    setIssuesModalOpen(false);
  }
  function openClaimingReasonsModal() {
    setClaimingReasonsPage(1);
    setClaimingReasonsModalOpen(true);
  }
  function closeClaimingReasonsModal() {
    setClaimingReasonsModalOpen(false);
  }
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
      <>
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
            {reuploadEntries.length === 0 && issueDetailRows.length === 0 ? (
              <div className="alert alert-info mb-0">No document flags recorded for the selected period.</div>
            ) : (
              reuploadEntries.length > 0 && (
                <div className="verification-issues-section">
                  <h6 className="text-muted text-uppercase small fw-bold mb-2 verification-reupload-title">Re-upload Requests by Document</h6>
                  {visibleReuploadEntries.map(([docType, count]) => (
                    <DistributionBar key={docType} label={formatDocType(docType)} count={count} percentage={reuploadFlagPercentages[docType]} max={maxReuploadFlags} />
                  ))}
                  <div className="verification-notice verification-notice-bottom">
                    <span className="verification-notice-icon"><MessageIcon /></span>
                    <p>Which document most often causes a re-upload request, and which automated checks fail most often per document type.</p>
                  </div>
                </div>
              )
            )}
          </div>
          {(reuploadEntries.length > 0 || issueDetailRows.length > 0) && (
            <div className="applicant-profile-card-footer verification-issues-footer">
              <span className="applicant-profile-footer-info">Showing {Math.min(3, reuploadEntries.length)} of {reuploadEntries.length} re-upload request records</span>
              <ViewAllButton onClick={openIssuesModal} />
            </div>
          )}
        </div>
        {issuesModalOpen && (
          <div className="report-history-modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && closeIssuesModal()}>
            <div className="report-history-modal" role="dialog" aria-modal="true" aria-labelledby="verification-issues-modal-title">
              <div className="report-history-modal-header">
                <div className="report-history-modal-title-group">
                  <span className="report-history-modal-icon"><VerificationHeaderIcon /></span>
                  <div>
                    <h4 id="verification-issues-modal-title">Document Verification Issues</h4>
                    <p>Re-upload requests, document reasons, and automated OCR check failures for the selected application cycle.</p>
                  </div>
                </div>
                <div className="d-flex align-items-center gap-3">
                  <button type="button" className="report-records-export-btn" onClick={() => handlePdfExport("/admin/reports/document-failures/pdf", "document-failure-breakdown")}>Export PDF</button>
                  <button type="button" className="report-history-modal-close" aria-label="Close" onClick={closeIssuesModal}>×</button>
                </div>
              </div>
              <div className="report-history-modal-body verification-issues-modal-body">
                {reuploadEntries.length > 0 && (
                  <div className="verification-issues-modal-summary">
                    <h6 className="text-muted text-uppercase small fw-bold mb-3 verification-reupload-title">Re-upload Requests by Document</h6>
                    {reuploadEntries.map(([docType, count]) => (
                      <DistributionBar key={docType} label={formatDocType(docType)} count={count} percentage={reuploadFlagPercentages[docType]} max={maxReuploadFlags} />
                    ))}
                  </div>
                )}
                <div className="verification-issues-modal-details">
                  <h6 className="text-muted text-uppercase small fw-bold mb-3">Verification Issue Details</h6>
                  <div className="table-responsive verification-history-table-wrap">
                    <table className="verification-history-table">
                      <colgroup>
                        <col style={{ width: "24%" }} />
                        <col style={{ width: "56%" }} />
                        <col style={{ width: "20%" }} />
                      </colgroup>
                      <thead>
                        <tr>
                          <th>Document</th>
                          <th>Reason / Automated Check</th>
                          <th>Count</th>
                        </tr>
                      </thead>
                      <tbody>
                        {modalIssueDetailRows.length === 0 ? (
                          <tr><td colSpan="3">No verification issue details available.</td></tr>
                        ) : modalIssueDetailRows.map((row, index) => (
                          <tr key={`${row.type}-${row.docType}-${row.reason ?? row.checkName}-${index}`}>
                            <td>{formatDocType(row.docType)}</td>
                            <td>{row.type === "automated" ? <code className="small">{row.checkName}</code> : row.reason}</td>
                            <td>{row.count}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
              <div className="report-modal-footer">
                <div className="report-modal-footer-top">
                  <span className="report-history-pagination-info">Showing {issueDetailRows.length === 0 ? 0 : issuesStart + 1}–{Math.min(issuesEnd, issueDetailRows.length)} of {issueDetailRows.length} detail records</span>
                  <div className="report-history-pagination-controls">
                    <button type="button" className="report-history-pagination-arrow" disabled={issuesPage === 1} onClick={() => setIssuesPage((page) => Math.max(1, page - 1))}>‹</button>
                    {Array.from({ length: issuesTotalPages }, (_, index) => index + 1).map((page) => (
                      <button key={page} type="button" className={`report-history-pagination-page ${page === issuesPage ? "report-history-pagination-page-active" : ""}`} onClick={() => setIssuesPage(page)}>{page}</button>
                    ))}
                    <button type="button" className="report-history-pagination-arrow" disabled={issuesPage === issuesTotalPages} onClick={() => setIssuesPage((page) => Math.min(issuesTotalPages, page + 1))}>›</button>
                  </div>
                </div>
                <div className="report-modal-footer-bottom">
                  <button type="button" className="year-age-modal-done-btn" onClick={closeIssuesModal}>Close</button>
                </div>
              </div>
            </div>
          </div>
        )}
      </>
    );
  }
  if (section === "claiming") {
    return (
      <>
        <div className="page-card claiming-outcomes-card">
          <div className="claiming-outcomes-header">
            <div className="claiming-outcomes-header-left">
              <div>
                <h3 className="claiming-outcomes-title">Claiming Day Outcomes</h3>
                <p className="claiming-outcomes-description">Final claiming results for approved applicants, showing claimed, not cleared, unclaimed, and pending claiming outcomes for the selected application cycle.</p>
              </div>
            </div>
            <button type="button" className="claiming-outcomes-download" onClick={() => handlePdfExport("/admin/reports/claiming-outcomes/pdf", "claiming-outcomes")} aria-label="Download Claiming Day Outcomes PDF">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v12" /><path d="m7 10 5 5 5-5" /><path d="M5 21h14" /></svg>
            </button>
          </div>
          <div className="claiming-outcomes-body">
            <div className="claiming-outcomes-label">CLAIMING STATUS</div>
            <div className="claiming-status-grid">
              <div className="claiming-status-card">
                <div className="claiming-status-icon claimed-icon"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12 4 4L19 6" /></svg></div>
                <div className="claiming-status-info"><div className="claiming-status-name">Claimed</div><div className="claiming-status-number">{claimCounts.claimed}</div><div className="claiming-status-rate">{claimRates.claimed_rate}% of applicants</div></div>
              </div>
              <div className="claiming-status-card claiming-status-card-not-cleared">
                <div className="claiming-status-icon not-cleared-icon"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 6l12 12" /><path d="M18 6 6 18" /></svg></div>
                <div className="claiming-status-info">
                  <div className="claiming-status-name-row">
                    <div className="claiming-status-name">Not Cleared</div>
                    <button type="button" className="claiming-status-view-more" onClick={openClaimingReasonsModal}>
                      View More
                    </button>
                  </div>
                  <div className="claiming-status-number">{claimCounts.not_cleared}</div>
                  <div className="claiming-status-rate">{claimRates.not_cleared_rate}% of applicants</div>
                </div>
              </div>
              <div className="claiming-status-card">
                <div className="claiming-status-icon unclaimed-icon"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14" /></svg></div>
                <div className="claiming-status-info"><div className="claiming-status-name">Unclaimed</div><div className="claiming-status-number">{claimCounts.unclaimed}</div><div className="claiming-status-rate">{claimRates.unclaimed_rate}% of applicants</div></div>
              </div>
              <div className="claiming-status-card">
                <div className="claiming-status-icon awaiting-icon"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="8" /><path d="M12 8v4l2.5 2" /></svg></div>
                <div className="claiming-status-info"><div className="claiming-status-name">Awaiting Claiming</div><div className="claiming-status-number">{claimCounts.pending}</div><div className="claiming-status-rate">Pending applicants</div></div>
              </div>
            </div>
          </div>
        </div>
        {claimingReasonsModalOpen && (
          <div className="report-history-modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && closeClaimingReasonsModal()}>
            <div className="report-history-modal" role="dialog" aria-modal="true" aria-labelledby="claiming-reasons-modal-title">
              <div className="report-history-modal-header">
                <div className="report-history-modal-title-group">
                  <span className="report-history-modal-icon claiming-reasons-modal-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 6l12 12" /><path d="M18 6 6 18" /></svg></span>
                  <div><h4 id="claiming-reasons-modal-title">Not Cleared Reasons</h4><p>Reasons why applicants were marked as not cleared during claiming.</p></div>
                </div>
                <button type="button" className="report-history-modal-close" aria-label="Close" onClick={closeClaimingReasonsModal}>×</button>
              </div>
              <div className="report-history-modal-body claiming-reasons-modal-body">
                <div className="table-responsive verification-history-table-wrap">
                  <table className="verification-history-table claiming-reasons-modal-table">
                    <colgroup><col style={{ width: "40%" }} /><col style={{ width: "15%" }} /><col style={{ width: "15%" }} /><col style={{ width: "30%" }} /></colgroup>
                    <thead><tr><th>Reason</th><th>Count</th><th>Percentage</th><th>Distribution</th></tr></thead>
                    <tbody>
                      {modalClaimingReasons.length === 0 ? <tr><td colSpan="4" className="claiming-reasons-empty">No reasons available.</td></tr> : modalClaimingReasons.map((row) => (
                        <tr key={row.reason}><td>{row.reason}</td><td>{row.count}</td><td>{row.percentage}%</td><td><div className="claiming-reason-line claiming-reason-modal-line"><div className="claiming-reason-line-fill" style={{ width: `${row.percentage}%` }} /></div></td></tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              <div className="report-modal-footer">
                <div className="report-modal-footer-top">
                  <span className="report-history-pagination-info">Showing {claimingReasonRows.length === 0 ? 0 : claimingReasonsStart + 1}–{Math.min(claimingReasonsEnd, claimingReasonRows.length)} of {claimingReasonRows.length} reasons</span>
                  <div className="report-history-pagination-controls">
                    <button type="button" className="report-history-pagination-arrow" disabled={claimingReasonsPage === 1} onClick={() => setClaimingReasonsPage((page) => Math.max(1, page - 1))}>‹</button>
                    {Array.from({ length: claimingReasonsTotalPages }, (_, index) => index + 1).map((page) => <button key={page} type="button" className={`report-history-pagination-page ${page === claimingReasonsPage ? "report-history-pagination-page-active" : ""}`} onClick={() => setClaimingReasonsPage(page)}>{page}</button>)}
                    <button type="button" className="report-history-pagination-arrow" disabled={claimingReasonsPage === claimingReasonsTotalPages} onClick={() => setClaimingReasonsPage((page) => Math.min(claimingReasonsTotalPages, page + 1))}>›</button>
                  </div>
                </div>
                <div className="report-modal-footer-bottom"><button type="button" className="year-age-modal-done-btn" onClick={closeClaimingReasonsModal}>Close</button></div>
              </div>
            </div>
          </div>
        )}
      </>
    );
  }
  return null;
}
export default VerificationOutcomesSection;
