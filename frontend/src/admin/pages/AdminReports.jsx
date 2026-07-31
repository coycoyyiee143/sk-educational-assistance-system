import { useState, useEffect } from "react";
import AdminNavigation from "../components/AdminNavigation";
import api from "../../services/api";

const reportTypes = [
  "All Applications",
  "Approved Students",
  "Rejected Applications",
  "Pending Applications",
];

const emptyFilter = { type: "All Applications", from: "", to: "" };

const APPROVED_SET = ["approved", "claimed", "not_cleared", "unclaimed"];
const PENDING_SET = ["pending_prescreening", "for_review", "reupload_requested"];

function StatusBadge({ status }) {
  let cls = "badge-review";
  if (status === "rejected") cls = "badge-rejected";
  else if (APPROVED_SET.includes(status)) cls = "badge-approved";
  else if (PENDING_SET.includes(status)) cls = "badge-review";

  return <span className={cls}>{status.replace(/_/g, " ")}</span>;
}

function formatDate(dateStr) {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

function formatCurrency(amount) {
  return "₱" + Number(amount ?? 0).toLocaleString("en-PH");
}

function formatDocType(type) {
  return type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

// Simple horizontal bar built from existing utility classes — no chart
// library dependency needed for this.
function DistributionBar({ label, count, max }) {
  const pct = max > 0 ? Math.round((count / max) * 100) : 0;
  return (
    <div className="mb-2">
      <div className="d-flex justify-content-between small mb-1">
        <span>{label}</span>
        <span className="text-muted">{count}</span>
      </div>
      <div className="progress" style={{ height: "8px" }}>
        <div
          className="progress-bar bg-danger"
          role="progressbar"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function AdminReports() {
  const [summary, setSummary] = useState(null);
  const [forecast, setForecast] = useState(null);
  const [claimingOutcomes, setClaimingOutcomes] = useState(null);
  const [documentFailures, setDocumentFailures] = useState(null);
  const [distribution, setDistribution] = useState(null);
  const [submissionVsApproval, setSubmissionVsApproval] = useState(null);
  const [trends, setTrends] = useState(null);
  const [filter, setFilter] = useState(emptyFilter);
  const [preview, setPreview] = useState([]);
  const [loading, setLoading] = useState(true);
  const [previewing, setPreviewing] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [pdfExportingKey, setPdfExportingKey] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([
      api.get("/admin/reports/summary"),
      api.get("/admin/reports/budget-forecast"),
      api.get("/admin/reports/applications"),
      api.get("/admin/reports/claiming-outcomes"),
      api.get("/admin/reports/document-failures"),
      api.get("/admin/reports/applicant-distribution"),
      api.get("/admin/reports/submission-trends"),
      api.get("/admin/reports/submission-vs-approval"),
    ]).then(([summaryRes, forecastRes, appsRes, claimingRes, docFailRes, distRes, trendsRes, submissionVsApprovalRes]) => {
      setSummary(summaryRes.data);
      setForecast(forecastRes.data);
      setPreview(appsRes.data);
      setClaimingOutcomes(claimingRes.data);
      setDocumentFailures(docFailRes.data);
      setDistribution(distRes.data);
      setTrends(trendsRes.data);
      setSubmissionVsApproval(submissionVsApprovalRes.data);
    }).catch(() => setError("Failed to load report data."))
      .finally(() => setLoading(false));
  }, []);

  const set = (k) => (e) => setFilter((f) => ({ ...f, [k]: e.target.value }));

  function buildParams() {
    const params = {};
    if (filter.type !== "All Applications") params.type = filter.type;
    if (filter.from) params.from = filter.from;
    if (filter.to) params.to = filter.to;
    return params;
  }

  async function handlePreview(e) {
    e.preventDefault();
    setError("");
    setPreviewing(true);
    try {
      const res = await api.get("/admin/reports/applications", { params: buildParams() });
      setPreview(res.data);
    } catch {
      setError("Failed to generate preview.");
    } finally {
      setPreviewing(false);
    }
  }

  async function handleExport() {
    setError("");
    setExporting(true);
    try {
      const res = await api.get("/admin/reports/export", { params: buildParams(), responseType: "blob" });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `applicant-records-${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      setError("Failed to export report.");
    } finally {
      setExporting(false);
    }
  }

  async function handlePdfExport(endpoint, filenamePrefix, key) {
    setError("");
    setPdfExportingKey(key);
    try {
      const res = await api.get(endpoint, { responseType: "blob" });
      const url = window.URL.createObjectURL(new Blob([res.data], { type: "application/pdf" }));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `${filenamePrefix}-${new Date().toISOString().slice(0, 10)}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      setError("Failed to export PDF report.");
    } finally {
      setPdfExportingKey(null);
    }
  }

  if (loading) {
    return (
      <div>
        <AdminNavigation />
        <div className="d-flex justify-content-center align-items-center" style={{ height: "60vh" }}>
          <div className="spinner-border text-danger" role="status" />
        </div>
      </div>
    );
  }

  const stats = summary?.summary ?? {};
  const rates = summary?.rates ?? {};
  const fc = forecast?.forecast ?? {};

  const claimCounts = claimingOutcomes?.counts ?? {};
  const claimRates = claimingOutcomes?.rates ?? {};
  const notClearedReasons = claimingOutcomes?.not_cleared_reasons ?? {};

  const reuploadFlagCounts = documentFailures?.reupload_flag_counts_by_document ?? {};
  const reuploadReasonsByDoc = documentFailures?.reupload_reasons_by_document ?? {};
  const automatedFailuresByDoc = documentFailures?.automated_check_failures_by_document ?? {};
  const maxReuploadFlags = Math.max(1, ...Object.values(reuploadFlagCounts));

  const bySchool = distribution?.by_school ?? [];
  const byCourse = distribution?.by_course ?? [];
  const byYearLevel = distribution?.by_year_level ?? [];
  const maxSchoolCount = Math.max(1, ...bySchool.map((r) => r.total));
  const maxCourseCount = Math.max(1, ...byCourse.map((r) => r.total));
  const maxYearLevelCount = Math.max(1, ...byYearLevel.map((r) => r.total));

  const weeklyTrend = trends?.weekly ?? [];
  const maxWeeklyCount = Math.max(1, ...weeklyTrend.map((w) => w.total));

  return (
    <div>
      <AdminNavigation />
      <section className="page-section">
        <div className="container">

          <div className="page-card">
            <h3 className="section-title mb-2">Reports</h3>
            <p className="text-muted mb-0">
              View summary reports and analytics related to the educational assistance program, including applicant statistics, approved student records, and budget forecasting.
            </p>
          </div>

          {error && <div className="alert alert-danger">{error}</div>}

          {/* Application Summary */}
          <div className="page-card">
            <h4 className="sub-title">
              Application Summary
              {summary?.config && (
                <span className="text-muted fw-normal" style={{ fontSize: "14px" }}>
                  {" "}— {summary.config.school_year}
                </span>
              )}
            </h4>
            {!summary?.config ? (
              <div className="alert alert-info mb-0">No active application period.</div>
            ) : (
              <div className="row g-4">
                <div className="col-md-3">
                  <div className="summary-card">
                    <h2>{stats.total_applicants}</h2>
                    <p>Total Applicants</p>
                  </div>
                </div>
                <div className="col-md-3">
                  <div className="summary-card">
                    <h2>{stats.pending_applications}</h2>
                    <p>Pending Applications</p>
                  </div>
                </div>
                <div className="col-md-3">
                  <div className="summary-card">
                    <h2>{stats.approved_applications}</h2>
                    <p>Approved Applications</p>
                  </div>
                </div>
                <div className="col-md-3">
                  <div className="summary-card">
                    <h2>{stats.rejected_applications}</h2>
                    <p>Rejected Applications</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Generate Report */}
          <div className="page-card">
            <h4 className="sub-title">Generate Report</h4>
            <div className="info-box">
              Filter and preview applicant records, or export them as a CSV file for documentation and record-keeping purposes.
            </div>
            <form onSubmit={handlePreview}>
              <div className="row g-3">
                <div className="col-md-4">
                  <label className="form-label">Report Type</label>
                  <select className="form-select" value={filter.type} onChange={set("type")}>
                    {reportTypes.map((t) => <option key={t}>{t}</option>)}
                  </select>
                </div>
                <div className="col-md-4">
                  <label className="form-label">From Date</label>
                  <input type="date" className="form-control" value={filter.from} onChange={set("from")} />
                </div>
                <div className="col-md-4">
                  <label className="form-label">To Date</label>
                  <input type="date" className="form-control" value={filter.to} onChange={set("to")} />
                </div>
              </div>
              <div className="mt-4 d-flex justify-content-end gap-2">
                <button type="submit" className="btn btn-secondary" disabled={previewing}>
                  {previewing ? "Loading..." : "Preview"}
                </button>
                <button type="button" className="btn btn-custom" onClick={handleExport} disabled={exporting}>
                  {exporting ? "Exporting..." : "Export Report"}
                </button>
              </div>
            </form>
          </div>

          {/* Report Preview */}
          <div className="page-card">
            <h4 className="sub-title">Report Preview</h4>
            <div className="table-responsive">
              <table className="table table-bordered table-striped align-middle">
                <thead>
                  <tr>
                    <th>Application ID</th>
                    <th>Control Number</th>
                    <th>Applicant Name</th>
                    <th>Submission Date</th>
                    <th>Status</th>
                    <th>School</th>
                    <th>Course / Strand</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.map((r) => (
                    <tr key={r.id}>
                      <td>APP-{r.id}</td>
                      <td>{r.control_number ?? "—"}</td>
                      <td>{r.name}</td>
                      <td>{formatDate(r.submitted_at)}</td>
                      <td><StatusBadge status={r.status} /></td>
                      <td>{r.school_name}</td>
                      <td>{r.course}</td>
                    </tr>
                  ))}
                  {preview.length === 0 && (
                    <tr><td colSpan="7" className="text-center text-muted">No records found.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Additional Statistics */}
          <div className="page-card">
            <h4 className="sub-title">Additional Statistics</h4>
            <div className="row g-4">
              <div className="col-md-4">
                <div className="summary-card">
                  <h2>{rates.approval_rate ?? 0}%</h2>
                  <p>Approval Rate</p>
                </div>
              </div>
              <div className="col-md-4">
                <div className="summary-card">
                  <h2>{rates.rejection_rate ?? 0}%</h2>
                  <p>Rejection Rate</p>
                </div>
              </div>
              <div className="col-md-4">
                <div className="summary-card">
                  <h2>{rates.under_review_rate ?? 0}%</h2>
                  <p>Applications Under Review</p>
                </div>
              </div>
            </div>
          </div>

          {/* Claiming Outcome Summary — SK specifically requested this one */}
          <div className="page-card">
            <div className="d-flex justify-content-between align-items-start flex-wrap gap-2">
              <h4 className="sub-title">
                Claiming Outcome Summary
                {claimingOutcomes?.config && (
                  <span className="text-muted fw-normal" style={{ fontSize: "14px" }}>
                    {" "}— {claimingOutcomes.config.school_year}
                  </span>
                )}
              </h4>
              <button
                type="button"
                className="btn btn-sm btn-outline-custom"
                disabled={pdfExportingKey === "claiming"}
                onClick={() => handlePdfExport("/admin/reports/claiming-outcomes/pdf", "claiming-outcome-summary", "claiming")}
              >
                {pdfExportingKey === "claiming" ? "Exporting..." : "Export PDF"}
              </button>
            </div>
            {!claimingOutcomes?.config || claimCounts.total === 0 ? (
              <div className="alert alert-info mb-0">No claiming data available yet for this period.</div>
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
                      <DistributionBar
                        key={reason}
                        label={reason}
                        count={count}
                        max={Math.max(...Object.values(notClearedReasons))}
                      />
                    ))}
                  </>
                )}
              </>
            )}
          </div>

          {/* Document Failure Breakdown */}
          <div className="page-card">
            <div className="d-flex justify-content-between align-items-start flex-wrap gap-2">
              <h4 className="sub-title">
                Document Failure Breakdown
                {documentFailures?.config && (
                  <span className="text-muted fw-normal" style={{ fontSize: "14px" }}>
                    {" "}— {documentFailures.config.school_year}
                  </span>
                )}
              </h4>
              <button
                type="button"
                className="btn btn-sm btn-outline-custom"
                disabled={pdfExportingKey === "documentFailures"}
                onClick={() => handlePdfExport("/admin/reports/document-failures/pdf", "document-failure-breakdown", "documentFailures")}
              >
                {pdfExportingKey === "documentFailures" ? "Exporting..." : "Export PDF"}
              </button>
            </div>
            <div className="info-box">
              Shows which document most often causes a re-upload request, and which
              automated checks fail most often per document type.
            </div>
            {Object.keys(reuploadFlagCounts).length === 0 && Object.keys(automatedFailuresByDoc).length === 0 ? (
              <div className="alert alert-info mb-0">No document flags recorded yet for this period.</div>
            ) : (
              <>
                {Object.keys(reuploadFlagCounts).length > 0 && (
                  <>
                    <h6 className="text-muted text-uppercase small fw-bold mb-2">Re-upload Requests by Document</h6>
                    {Object.entries(reuploadFlagCounts).map(([docType, count]) => (
                      <DistributionBar
                        key={docType}
                        label={formatDocType(docType)}
                        count={count}
                        max={maxReuploadFlags}
                      />
                    ))}
                  </>
                )}

                {Object.entries(reuploadReasonsByDoc).map(([docType, reasons]) => (
                  <div className="mt-3" key={docType}>
                    <h6 className="text-muted small fw-bold mb-2">{formatDocType(docType)} — Reasons</h6>
                    <div className="table-responsive">
                      <table className="table table-sm table-bordered mb-0">
                        <thead>
                          <tr><th>Reason</th><th style={{ width: "80px" }}>Count</th></tr>
                        </thead>
                        <tbody>
                          {Object.entries(reasons)
                            .sort((a, b) => b[1] - a[1])
                            .map(([reason, count]) => (
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
                  <div className="mt-4">
                    <h6 className="text-muted text-uppercase small fw-bold mb-2">Automated OCR Check Failures by Document</h6>
                    <div className="table-responsive">
                      <table className="table table-sm table-bordered mb-0">
                        <thead>
                          <tr><th>Document</th><th>Check</th><th style={{ width: "80px" }}>Failures</th></tr>
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

          {/* Applicant Distribution */}
          <div className="page-card">
            <div className="d-flex justify-content-between align-items-start flex-wrap gap-2">
              <h4 className="sub-title">
                Applicant Distribution
                {distribution?.config && (
                  <span className="text-muted fw-normal" style={{ fontSize: "14px" }}>
                    {" "}— {distribution.config.school_year}
                  </span>
                )}
              </h4>
              <button
                type="button"
                className="btn btn-sm btn-outline-custom"
                disabled={pdfExportingKey === "distribution"}
                onClick={() => handlePdfExport("/admin/reports/applicant-distribution/pdf", "applicant-distribution", "distribution")}
              >
                {pdfExportingKey === "distribution" ? "Exporting..." : "Export PDF"}
              </button>
            </div>
            {!distribution?.config || bySchool.length === 0 ? (
              <div className="alert alert-info mb-0">No applicant data available yet for this period.</div>
            ) : (
              <div className="row g-4">
                <div className="col-md-4">
                  <h6 className="text-muted text-uppercase small fw-bold mb-2">By School</h6>
                  {bySchool.map((r) => (
                    <DistributionBar key={r.school_name} label={r.school_name} count={r.total} max={maxSchoolCount} />
                  ))}
                </div>
                <div className="col-md-4">
                  <h6 className="text-muted text-uppercase small fw-bold mb-2">By Course</h6>
                  {byCourse.map((r) => (
                    <DistributionBar key={r.course} label={r.course} count={r.total} max={maxCourseCount} />
                  ))}
                </div>
                <div className="col-md-4">
                  <h6 className="text-muted text-uppercase small fw-bold mb-2">By Year Level</h6>
                  {byYearLevel.map((r) => (
                    <DistributionBar key={r.year_level} label={r.year_level} count={r.total} max={maxYearLevelCount} />
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Submission Trends */}
          <div className="page-card">
            <div className="d-flex justify-content-between align-items-start flex-wrap gap-2">
              <h4 className="sub-title">
                Submission Trends
                {trends?.config && (
                  <span className="text-muted fw-normal" style={{ fontSize: "14px" }}>
                    {" "}— {trends.config.school_year}
                  </span>
                )}
              </h4>
              <button
                type="button"
                className="btn btn-sm btn-outline-custom"
                disabled={pdfExportingKey === "trends"}
                onClick={() => handlePdfExport("/admin/reports/submission-trends/pdf", "submission-trends", "trends")}
              >
                {pdfExportingKey === "trends" ? "Exporting..." : "Export PDF"}
              </button>
            </div>
            <div className="info-box">
              Number of applications submitted per week within the active application period.
            </div>
            {weeklyTrend.length === 0 ? (
              <div className="alert alert-info mb-0">No submissions recorded yet for this period.</div>
            ) : (
              weeklyTrend.map((w) => (
                <DistributionBar
                  key={w.year_week}
                  label={`Week of ${formatDate(w.week_start)}`}
                  count={w.total}
                  max={maxWeeklyCount}
                />
              ))
            )}
          </div>

          {/* Submission vs. Approval Trend — foundation for future forecasting */}
          <div className="page-card">
            <div className="d-flex justify-content-between align-items-start flex-wrap gap-2">
              <h4 className="sub-title">Submission vs. Approval Trend</h4>
              <button
                type="button"
                className="btn btn-sm btn-outline-custom"
                disabled={pdfExportingKey === "submissionVsApproval"}
                onClick={() => handlePdfExport("/admin/reports/submission-vs-approval/pdf", "submission-vs-approval-trend", "submissionVsApproval")}
              >
                {pdfExportingKey === "submissionVsApproval" ? "Exporting..." : "Export PDF"}
              </button>
            </div>
            <div className="info-box">
              Tracks total submissions per period, not just approved counts — the
              basis for genuine demand forecasting once enough real application
              cycles have run on this system.
            </div>
            {!submissionVsApproval?.trend?.length ? (
              <div className="alert alert-info mb-0">No application period data available yet.</div>
            ) : (
              <div className="table-responsive">
                <table className="table table-bordered table-striped align-middle">
                  <thead>
                    <tr>
                      <th>School Year</th>
                      <th>Total Submitted</th>
                      <th>Approved</th>
                      <th>Rejected</th>
                      <th>Not Cleared</th>
                      <th>Pending</th>
                      <th>Approval Rate</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {submissionVsApproval.trend.map((row) => (
                      <tr key={row.config_id}>
                        <td>{row.school_year}</td>
                        <td>{row.total_submitted}</td>
                        <td>{row.approved}</td>
                        <td>{row.rejected}</td>
                        <td>{row.not_cleared}</td>
                        <td>{row.pending}</td>
                        <td>{row.approval_rate}%</td>
                        <td>
                          {row.is_active
                            ? <span className="badge bg-success">Active</span>
                            : <span className="badge bg-secondary">Completed</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Budget Forecast */}
          <div className="page-card">
            <h4 className="sub-title">Budget Forecast</h4>
            <div className="info-box">
              Forecast is based on the average number of approved applicants across past completed application periods,
              multiplied by {formatCurrency(fc.assistance_per_applicant ?? 2000)} per beneficiary.
            </div>

            {!forecast?.historical?.length ? (
              <div className="alert alert-info mb-0">No application period data available yet.</div>
            ) : (
              <>
                <div className="table-responsive mb-4">
                  <table className="table table-bordered table-striped align-middle">
                    <thead>
                      <tr>
                        <th>School Year</th>
                        <th>Total Applications</th>
                        <th>Approved</th>
                        <th>Pass Rate</th>
                        <th>Estimated Disbursement</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {forecast.historical.map((h) => (
                        <tr key={h.config_id}>
                          <td>{h.school_year}</td>
                          <td>{h.total_applications}</td>
                          <td>{h.approved_count}</td>
                          <td>{(h.pass_rate * 100).toFixed(1)}%</td>
                          <td>{formatCurrency(h.estimated_disbursement)}</td>
                          <td>
                            {h.is_active
                              ? <span className="badge bg-success">Active</span>
                              : <span className="badge bg-secondary">Completed</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="row g-4">
                  <div className="col-md-3">
                    <div className="summary-card">
                      <h2>{((fc.average_pass_rate ?? 0) * 100).toFixed(1)}%</h2>
                      <p>Average Pass Rate</p>
                    </div>
                  </div>
                  <div className="col-md-3">
                    <div className="summary-card">
                      <h2>{fc.average_approved_count ?? 0}</h2>
                      <p>Avg. Approved per Period</p>
                    </div>
                  </div>
                  <div className="col-md-3">
                    <div className="summary-card">
                      <h2>{fc.projected_approved ?? 0}</h2>
                      <p>Projected Approved (Next Period)</p>
                    </div>
                  </div>
                  <div className="col-md-3">
                    <div className="summary-card">
                      <h2>{formatCurrency(fc.projected_budget)}</h2>
                      <p>Projected Budget Needed</p>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>

        </div>
      </section>
      <footer>
        <div className="container">
          <p className="mb-0">© 2026 Sangguniang Kabataan of Barangay Mamatid | Admin Panel</p>
        </div>
      </footer>
    </div>
  );
}

export default AdminReports;