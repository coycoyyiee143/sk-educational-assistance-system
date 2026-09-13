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
  const issuesPerPage = 5;
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
  const automatedFailureRows = Object.entries(automatedFailuresByDoc).flatMap(([docType, checks]) =>
    Object.entries(checks).map(([checkName, count]) => ({ docType, checkName, count }))
  );
  const visibleAutomatedFailures = automatedFailureRows.slice(0, 1);
  const issuesTotalPages = Math.max(1, Math.ceil(automatedFailureRows.length / issuesPerPage));
  const issuesStart = (issuesPage - 1) * issuesPerPage;
  const issuesEnd = issuesStart + issuesPerPage;
  const modalAutomatedFailures = automatedFailureRows.slice(issuesStart, issuesEnd);
  function openIssuesModal() {
    setIssuesPage(1);
    setIssuesModalOpen(true);
  }
  function closeIssuesModal() {
    setIssuesModalOpen(false);
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
            <div className="verification-notice">
              <span className="verification-notice-icon"><InfoNoticeIcon /></span>
              <p>Which document most often causes a re-upload request, and which automated checks fail most often per document type.</p>
            </div>
            {Object.keys(reuploadFlagCounts).length === 0 && automatedFailureRows.length === 0 ? (
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
                {automatedFailureRows.length > 0 && (
                  <div className="verification-issues-section">
                    <h6 className="text-muted text-uppercase small fw-bold mb-2">Automated OCR Check Failures</h6>
                    <div className="table-responsive verification-history-table-wrap">
                      <table className="verification-history-table">
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
                          {visibleAutomatedFailures.map((row) => (
                            <tr key={`${row.docType}-${row.checkName}`}>
                              <td>{formatDocType(row.docType)}</td>
                              <td><code className="small">{row.checkName}</code></td>
                              <td>{row.count}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
          {automatedFailureRows.length > 0 && (
            <div className="applicant-profile-card-footer verification-issues-footer">
              <span className="applicant-profile-footer-info">Showing {visibleAutomatedFailures.length} of {automatedFailureRows.length} automated check failures</span>
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
                    <p>Automated OCR check failures for the selected application cycle.</p>
                  </div>
                </div>
                <div className="d-flex align-items-center gap-3">
                  <button type="button" className="report-records-export-btn" onClick={() => handlePdfExport("/admin/reports/document-failures/pdf", "document-failure-breakdown")}>Export PDF</button>
                  <button type="button" className="report-history-modal-close" aria-label="Close" onClick={closeIssuesModal}>×</button>
                </div>
              </div>
              <div className="report-history-modal-body">
                <div className="table-responsive verification-history-table-wrap">
                  <table className="verification-history-table">
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
                      {modalAutomatedFailures.map((row) => (
                        <tr key={`${row.docType}-${row.checkName}`}>
                          <td>{formatDocType(row.docType)}</td>
                          <td><code className="small">{row.checkName}</code></td>
                          <td>{row.count}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              <div className="report-modal-footer">
                <div className="report-modal-footer-top">
                  <span className="report-history-pagination-info">Showing {issuesStart + 1}–{Math.min(issuesEnd, automatedFailureRows.length)} of {automatedFailureRows.length} records</span>
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
      <div className="page-card claiming-outcomes-card">
        <div className="claiming-outcomes-header">
          <div className="claiming-outcomes-header-left">
            <div className="claiming-outcomes-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="9" />
                <path d="m9 12 2 2 4-4" />
              </svg>
            </div>
            <div>
              <h3 className="claiming-outcomes-title">Claiming Day Outcomes</h3>
              <div className="claiming-outcomes-cycle">{claimingOutcomes?.school_year ? `Cycle ${claimingOutcomes.school_year}` : ""}</div>
            </div>
          </div>
          <button type="button" className="claiming-outcomes-download" onClick={() => handlePdfExport("/admin/reports/claiming-outcomes/pdf", "claiming-outcomes")} aria-label="Download Claiming Day Outcomes PDF">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 3v12" />
              <path d="m7 10 5 5 5-5" />
              <path d="M5 21h14" />
            </svg>
          </button>
        </div>
        <div className="claiming-outcomes-body">
          <div className="claiming-outcomes-label">CLAIMING STATUS</div>
          <div className="claiming-status-grid">
            <div className="claiming-status-card">
              <div className="claiming-status-icon claimed-icon">
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12 4 4L19 6" /></svg>
              </div>
              <div className="claiming-status-info">
                <div className="claiming-status-name">Claimed</div>
                <div className="claiming-status-number">{claimCounts.claimed}</div>
                <div className="claiming-status-rate">{claimRates.claimed_rate}% of applicants</div>
              </div>
            </div>
            <div className="claiming-status-card">
              <div className="claiming-status-icon not-cleared-icon">
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 6l12 12" /><path d="M18 6 6 18" /></svg>
              </div>
              <div className="claiming-status-info">
                <div className="claiming-status-name">Not Cleared</div>
                <div className="claiming-status-number">{claimCounts.not_cleared}</div>
                <div className="claiming-status-rate">{claimRates.not_cleared_rate}% of applicants</div>
              </div>
            </div>
            <div className="claiming-status-card">
              <div className="claiming-status-icon unclaimed-icon">
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14" /></svg>
              </div>
              <div className="claiming-status-info">
                <div className="claiming-status-name">Unclaimed</div>
                <div className="claiming-status-number">{claimCounts.unclaimed}</div>
                <div className="claiming-status-rate">{claimRates.unclaimed_rate}% of applicants</div>
              </div>
            </div>
            <div className="claiming-status-card">
              <div className="claiming-status-icon awaiting-icon">
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="8" /><path d="M12 8v4l2.5 2" /></svg>
              </div>
              <div className="claiming-status-info">
                <div className="claiming-status-name">Awaiting Claiming</div>
                <div className="claiming-status-number">{claimCounts.pending}</div>
                <div className="claiming-status-rate">Pending applicants</div>
              </div>
            </div>
          </div>
          {Object.keys(notClearedReasons).length > 0 && (
            <div className="claiming-reasons-list">
              {Object.entries(notClearedReasons).map(([reason, count]) => {
                const percentage = claimCounts.not_cleared > 0 ? ((count / claimCounts.not_cleared) * 100).toFixed(1) : 0;
                return (
                  <div className="claiming-reason-row" key={reason}>
                    <div className="claiming-reason-content">
                      <div className="claiming-reason-top">
                        <span>{reason}</span>
                        <div className="claiming-reason-values"><strong>{count}</strong><span>{percentage}%</span></div>
                      </div>
                      <div className="claiming-reason-line"><div className="claiming-reason-line-fill" style={{ width: `${percentage}%` }} /></div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  }
  return null;
}
export default VerificationOutcomesSection;