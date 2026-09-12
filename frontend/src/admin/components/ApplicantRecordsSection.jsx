import { useState, useEffect } from "react";
import api from "../../services/api";

const reportTypes = ["All Applications", "Pending Prescreening", "For Review", "Reupload Requested", "Approved", "Waitlisted", "Claimed", "Not Cleared", "Unclaimed", "Not Selected", "Rejected"];
const applicantTypes = ["All Applicants", "Minor", "Adult"];
const yearLevelOptions = ["All Year Levels", "1st Year", "2nd Year", "3rd Year", "4th Year"];
const emptyFilter = {
  type: "All Applications",
  from: "",
  to: "",
  school_name: "All Schools",
  course: "All Courses",
  year_level: "All Year Levels",
  applicant_type: "All Applicants",
  reviewed_by: "",
};

const SUCCESS_SET = ["approved", "claimed"];
const ATTENTION_SET = ["pending_prescreening", "for_review", "reupload_requested", "waitlisted", "unclaimed"];
const UNSUCCESSFUL_SET = ["rejected", "not_cleared", "not_selected"];

function StatusBadge({ status }) {
  let cls = "badge-review";
  if (UNSUCCESSFUL_SET.includes(status)) cls = "badge-rejected";
  else if (SUCCESS_SET.includes(status)) cls = "badge-approved";
  else if (ATTENTION_SET.includes(status)) cls = "badge-review";
  return <span className={cls}>{status.replace(/_/g, " ")}</span>;
}

function formatDate(dateStr) {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

function ApplicantRecordsSection({ selectedConfigId }) {
  const [summary, setSummary] = useState(null);
  const [filterOptions, setFilterOptions] = useState({ schools: [], courses: [], verifiers: [] });
  const [filter, setFilter] = useState(emptyFilter);
  const [preview, setPreview] = useState([]);
  const [recordSearch, setRecordSearch] = useState("");
  const [previewing, setPreviewing] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState("");
  const [submissionVsApproval, setSubmissionVsApproval] = useState(null);
  const [sectionLoading, setSectionLoading] = useState(true);

  useEffect(() => {
    api.get("/admin/reports/filter-options")
      .then((res) => setFilterOptions(res.data))
      .catch(() => { });
  }, []);

  useEffect(() => {
    setSectionLoading(true);
    const params = selectedConfigId ? { config_id: selectedConfigId } : {};
    Promise.all([
      api.get("/admin/reports/summary", { params }).then((res) => setSummary(res.data)).catch(() => { }),
      api.get("/admin/reports/applications", { params }).then((res) => setPreview(res.data)).catch(() => { }),
      api.get("/admin/reports/submission-vs-approval").then((res) => setSubmissionVsApproval(res.data)).catch(() => { }),
    ]).finally(() => setSectionLoading(false));
  }, [selectedConfigId]);

  const set = (key) => (e) => setFilter((prev) => ({ ...prev, [key]: e.target.value }));

  function buildParams() {
    const params = {};
    if (filter.type !== "All Applications") params.type = filter.type;
    if (filter.from) params.from = filter.from;
    if (filter.to) params.to = filter.to;
    if (filter.school_name !== "All Schools") params.school_name = filter.school_name;
    if (filter.course !== "All Courses") params.course = filter.course;
    if (filter.year_level !== "All Year Levels") params.year_level = filter.year_level;
    if (filter.applicant_type !== "All Applicants") params.applicant_type = filter.applicant_type.toLowerCase();
    if (filter.reviewed_by) params.reviewed_by = filter.reviewed_by;
    if (selectedConfigId) params.config_id = selectedConfigId;
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

  async function handlePdfExport(endpoint, filenamePrefix) {
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
    } catch { }
  }

  async function handleApprovedListExport() {
    try {
      const params = selectedConfigId ? { config_id: selectedConfigId } : {};
      const res = await api.get("/admin/reports/approved-applicants/pdf", { params, responseType: "blob" });
      const url = window.URL.createObjectURL(new Blob([res.data], { type: "application/pdf" }));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `educational-assistance-approved-list-${new Date().toISOString().slice(0, 10)}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      setError("Failed to export approved applicants list.");
    }
  }

  async function handleApprovedListImageExport() {
    try {
      const params = selectedConfigId ? { config_id: selectedConfigId } : {};
      const res = await api.get("/admin/reports/approved-applicants/html", { params });
      const html = `
        <html>
          <head>
            <meta charset="utf-8">
            <script src="https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js"></script>
            <style>
              body { margin: 0; padding: 24px; background: #ccc; }
              .toolbar { text-align: center; margin: 0 auto 24px; max-width: 1080px; }
              .toolbar button { padding: 10px 24px; background: #b71c1c; color: #fff; border: none; border-radius: 6px; font-size: 14px; font-weight: 600; cursor: pointer; margin: 0 4px; }
              .page-chunk { background: #fff; margin: 0 auto 24px; box-shadow: 0 2px 10px rgba(0,0,0,0.25); }
              .page-controls { text-align: center; margin: 0 auto 8px; max-width: 1080px; }
              .page-controls button { padding: 8px 20px; background: #6c757d; color: #fff; border: none; border-radius: 6px; font-size: 13px; cursor: pointer; margin: 0 4px 12px; }
            </style>
          </head>
          <body>
            <div class="toolbar"><button id="download-all-btn">Download All Pages</button></div>
            <div id="capture-root">${res.data}</div>
            <script>
              const chunks = Array.from(document.querySelectorAll('.page-chunk'));
              function downloadPage(chunk, idx) {
                return html2canvas(chunk, { scale: 2, backgroundColor: '#ffffff' }).then(function(canvas) {
                  const link = document.createElement('a');
                  link.download = 'educational-assistance-approved-list-page-' + (idx + 1) + '.png';
                  link.href = canvas.toDataURL('image/png');
                  link.click();
                });
              }
              chunks.forEach(function(chunk, idx) {
                const controls = document.createElement('div');
                controls.className = 'page-controls';
                const btn = document.createElement('button');
                btn.textContent = 'Download Page ' + (idx + 1);
                btn.addEventListener('click', function() { downloadPage(chunk, idx); });
                controls.appendChild(btn);
                chunk.parentNode.insertBefore(controls, chunk);
              });
              document.getElementById('download-all-btn').addEventListener('click', function() {
                chunks.reduce(function(chain, chunk, idx) {
                  return chain.then(function() {
                    return downloadPage(chunk, idx).then(function() {
                      return new Promise(function(resolve) { setTimeout(resolve, 400); });
                    });
                  });
                }, Promise.resolve());
              });
            </script>
          </body>
        </html>
      `;
      const win = window.open("", "_blank");
      win.document.write(html);
      win.document.close();
    } catch {
      setError("Failed to generate approved applicants image preview.");
    }
  }

  const filteredPreview = preview.filter((record) => {
    if (!recordSearch.trim()) return true;
    const q = recordSearch.trim().toLowerCase();
    return (
      record.name?.toLowerCase().includes(q) ||
      record.control_number?.toLowerCase().includes(q)
    );
  });

  const stats = summary?.summary ?? {};
  const rates = summary?.rates ?? {};
  const totalApplicants = Number(stats.total_applicants) || 0;
  const approvedApplications = Number(stats.approved_applications) || 0;
  const rejectedApplications = Number(stats.rejected_applications) || 0;
  const pendingApplications = Number(stats.pending_applications) || 0;
  const statusApprovalRate = totalApplicants > 0 ? (approvedApplications / totalApplicants) * 100 : 0;
  const statusRejectionRate = totalApplicants > 0 ? (rejectedApplications / totalApplicants) * 100 : 0;
  const statusPendingRate = totalApplicants > 0 ? (pendingApplications / totalApplicants) * 100 : 0;
  const approvalRate = Math.max(0, Math.min(100, Number(rates.approval_rate) || 0));
  const rejectionRate = Math.max(0, Math.min(100, Number(rates.rejection_rate) || 0));
  const pendingRate = Math.max(0, Math.min(100, Number(rates.under_review_rate) || 0));
  const statusApprovedEnd = statusApprovalRate * 3.6;
  const statusRejectedEnd = statusApprovedEnd + statusRejectionRate * 3.6;
  const statusPendingEnd = statusRejectedEnd + statusPendingRate * 3.6;
  const statusDonutStyle = {
    "--report-approved-end": `${statusApprovedEnd}deg`,
    "--report-rejected-end": `${statusRejectedEnd}deg`,
    "--report-pending-end": `${statusPendingEnd}deg`,
  };

  if (sectionLoading) {
    return (
      <div className="page-card">
        <h4 className="sub-title">Applicant Records</h4>
        <div className="d-flex justify-content-center align-items-center py-5">
          <div className="spinner-border text-danger" role="status" />
        </div>
      </div>
    );
  }

  return (
    <>
      {error && <div className="alert alert-danger">{error}</div>}

      {/* APPLICATION OVERVIEW */}
      <div className="page-card report-overview-combined">
        {summary?.config && (
          <h4 className="report-overview-block-title">
            Application Overview <span>— {summary.config.school_year}</span>
          </h4>
        )}
        {!summary?.config ? (
          <div className="alert alert-info mb-0">No data for the selected period.</div>
        ) : (
          <div className="report-overview-combined-layout">
            <div className="report-overview-status-panel">
              <div className="report-overview-status-card">
                <div className="report-overview-main-heading"><span>Application Status Distribution</span></div>
                <div className="report-overview-main-content">
                  <div className="report-overview-donut-wrap">
                    <div className="report-overview-donut" style={statusDonutStyle}>
                      <div className="report-overview-donut-center">
                        <strong>{totalApplicants}</strong>
                        <span>Total Applicants</span>
                      </div>
                    </div>
                  </div>
                  <div className="report-overview-legend">
                    <div className="report-overview-legend-row">
                      <div className="report-overview-legend-label"><span className="report-overview-dot report-overview-dot-green" /><span>Approved</span></div>
                      <strong>{approvedApplications}<small> ({statusApprovalRate.toFixed(1)}%)</small></strong>
                    </div>
                    <div className="report-overview-legend-row">
                      <div className="report-overview-legend-label"><span className="report-overview-dot report-overview-dot-red" /><span>Rejected</span></div>
                      <strong>{rejectedApplications}<small> ({statusRejectionRate.toFixed(1)}%)</small></strong>
                    </div>
                    <div className="report-overview-legend-row">
                      <div className="report-overview-legend-label"><span className="report-overview-dot report-overview-dot-gray" /><span>Pending</span></div>
                      <strong>{pendingApplications}<small> ({statusPendingRate.toFixed(1)}%)</small></strong>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="report-overview-rate-panel">
              <div className="report-overview-metrics">
                <div className="report-overview-metric-card">
                  <div className="report-overview-metric-text">
                    <span>Approval Rate</span>
                    <strong>{approvalRate}%</strong>
                    <small>{approvedApplications} approved applications</small>
                  </div>
                  <div className="report-overview-mini-ring report-overview-mini-ring-green" style={{ "--report-progress": `${approvalRate * 3.6}deg` }}>
                    <div className="report-overview-mini-ring-inner">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                        <path d="M5 12.5l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </div>
                  </div>
                </div>

                <div className="report-overview-metric-card">
                  <div className="report-overview-metric-text">
                    <span>Rejection Rate</span>
                    <strong>{rejectionRate}%</strong>
                    <small>{rejectedApplications} rejected applications</small>
                  </div>
                  <div className="report-overview-mini-ring report-overview-mini-ring-red" style={{ "--report-progress": `${rejectionRate * 3.6}deg` }}>
                    <div className="report-overview-mini-ring-inner">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                        <path d="M12 8v5" strokeLinecap="round" />
                        <circle cx="12" cy="16.5" r=".8" fill="currentColor" stroke="none" />
                        <path d="M10.2 4.8L3.7 17a2 2 0 001.8 3h13a2 2 0 001.8-3L13.8 4.8a2 2 0 00-3.6 0z" strokeLinejoin="round" />
                      </svg>
                    </div>
                  </div>
                </div>

                <div className="report-overview-metric-card">
                  <div className="report-overview-metric-text">
                    <span>Pending Rate</span>
                    <strong>{pendingRate}%</strong>
                    <small>{pendingApplications} pending applications</small>
                  </div>
                  <div className="report-overview-mini-ring report-overview-mini-ring-gray" style={{ "--report-progress": `${pendingRate * 3.6}deg` }}>
                    <div className="report-overview-mini-ring-inner">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                        <path d="M8 3h8M8 21h8" strokeLinecap="round" />
                        <path d="M9 3c0 4 1.5 5 3 6 1.5-1 3-2 3-6M9 21c0-4 1.5-5 3-6 1.5 1 3 2 3 6" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* APPLICANT RECORDS + APPROVED APPLICANTS */}
      <div className="page-card report-records-combined">
        <div className="report-records-layout">
          <div className="report-records-section">
            <h4 className="sub-title">Applicant Records</h4>
            <div className="info-box">Filter and preview individual applicant records, or export them as a CSV file for documentation and record-keeping purposes.</div>
            <form onSubmit={handlePreview}>
              <div className="row g-3">
                <div className="col-md-6">
                  <label className="form-label">Status</label>
                  <select className="form-select" value={filter.type} onChange={set("type")}>
                    {reportTypes.map((type) => <option key={type}>{type}</option>)}
                  </select>
                </div>
                <div className="col-md-6">
                  <label className="form-label">School</label>
                  <select className="form-select" value={filter.school_name} onChange={set("school_name")}>
                    <option>All Schools</option>
                    {filterOptions.schools.map((school) => <option key={school}>{school}</option>)}
                  </select>
                </div>
                <div className="col-md-6">
                  <label className="form-label">Course / Program</label>
                  <select className="form-select" value={filter.course} onChange={set("course")}>
                    <option>All Courses</option>
                    {filterOptions.courses.map((course) => <option key={course}>{course}</option>)}
                  </select>
                </div>
                <div className="col-md-6">
                  <label className="form-label">Year Level</label>
                  <select className="form-select" value={filter.year_level} onChange={set("year_level")}>
                    {yearLevelOptions.map((year) => <option key={year}>{year}</option>)}
                  </select>
                </div>
                <div className="col-md-6">
                  <label className="form-label">Applicant Type</label>
                  <select className="form-select" value={filter.applicant_type} onChange={set("applicant_type")}>
                    {applicantTypes.map((type) => <option key={type}>{type}</option>)}
                  </select>
                </div>
                <div className="col-md-6">
                  <label className="form-label">Reviewed By</label>
                  <select className="form-select" value={filter.reviewed_by} onChange={set("reviewed_by")}>
                    <option value="">All Verifiers</option>
                    <option value="System (Auto-Approved)">System (Auto-Approved)</option>
                    {filterOptions.verifiers.map((name) => <option key={name}>{name}</option>)}
                  </select>
                </div>
                <div className="col-md-6">
                  <label className="form-label">From Date</label>
                  <input type="date" className="form-control" value={filter.from} onChange={set("from")} />
                </div>
                <div className="col-md-6">
                  <label className="form-label">To Date</label>
                  <input type="date" className="form-control" value={filter.to} onChange={set("to")} />
                </div>
              </div>
              <div className="mt-4 d-flex justify-content-end flex-wrap gap-2">
                <button type="submit" className="btn btn-secondary" disabled={previewing}>{previewing ? "Loading..." : "Preview"}</button>
                <button type="button" className="btn btn-custom" onClick={handleExport} disabled={exporting}>{exporting ? "Exporting..." : "Export CSV"}</button>
              </div>
            </form>
          </div>

          <div className="report-approved-section">
            <h4 className="sub-title">Approved Applicants List</h4>
            <div className="info-box">
              Generates the official list of approved applicants for {selectedConfigId ? "the selected period" : "the active period"} — a printable PDF for the office copy and physical bulletin board, and images sized for posting straight to the SK's Facebook page.
            </div>
            <div className="report-approved-actions">
              <button type="button" className="btn btn-custom btn-sm" onClick={handleApprovedListExport}>Download PDF</button>
              <button type="button" className="btn btn-outline-custom btn-sm" onClick={handleApprovedListImageExport}>Generate Facebook Images</button>
            </div>
          </div>
        </div>
      </div>

      {/* RECORD PREVIEW */}
      <div className="page-card">
        <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3">
          <h4 className="sub-title mb-0">Record Preview</h4>
          <input
            type="text"
            className="form-control"
            style={{ maxWidth: "280px" }}
            placeholder="Search name or control number..."
            value={recordSearch}
            onChange={(e) => setRecordSearch(e.target.value)}
          />
        </div>
        <div className="table-responsive table-scroll">
          <table className="table table-bordered table-striped align-middle mb-0">
            <thead>
              <tr>
                <th>Application ID</th>
                <th>Control Number</th>
                <th>Applicant Name</th>
                <th>Submission Date</th>
                <th>Status</th>
                <th>Reviewed By</th>
                <th>School</th>
                <th>Course / Strand</th>
                <th>Year Level</th>
              </tr>
            </thead>
            <tbody>
              {filteredPreview.map((record) => (
                <tr key={record.id}>
                  <td>APP-{record.id}</td>
                  <td>{record.control_number ?? "—"}</td>
                  <td>{record.name}</td>
                  <td>{formatDate(record.submitted_at)}</td>
                  <td><StatusBadge status={record.status} /></td>
                  <td>{record.reviewed_by ?? "—"}</td>
                  <td>{record.school_name}</td>
                  <td>{record.course}</td>
                  <td>{record.year_level}</td>
                </tr>
              ))}
              {filteredPreview.length === 0 && (
                <tr><td colSpan="9" className="text-center text-muted">No records found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* SUBMISSION & APPROVAL HISTORY */}
      <div className="page-card">
        <div className="d-flex justify-content-between align-items-start flex-wrap gap-2">
          <h4 className="sub-title">Submission &amp; Approval History</h4>
          <button type="button" className="btn btn-sm btn-outline-custom" onClick={() => handlePdfExport("/admin/reports/submission-vs-approval/pdf", "submission-vs-approval-trend")}>Export PDF</button>
        </div>
        <div className="info-box">
          Approved vs. rejected vs. pending outcomes per period, shown against total submitted — across all cycles, not just the one selected above.
        </div>
        {!submissionVsApproval?.trend?.length ? (
          <div className="alert alert-info mb-0">No application period data available yet.</div>
        ) : (
          submissionVsApproval.trend.map((row) => (
            <div key={row.config_id} className="mb-3">
              <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 small mb-1">
                <span className="fw-semibold">
                  {row.school_year}
                  {row.is_active && <span className="badge bg-success ms-2">Active</span>}
                </span>
                <div className="d-flex flex-wrap gap-2">
                  <span className="badge bg-primary">{row.approved} approved · {row.approval_rate ?? 0}%</span>
                  <span className="badge bg-danger">{row.rejected} rejected · {row.rejection_rate ?? 0}%</span>
                  <span className="badge bg-warning text-dark">{row.pending} pending · {row.pending_rate ?? 0}%</span>
                </div>
              </div>
              <div className="progress" style={{ height: "22px", backgroundColor: "#e9ecef" }}>
                <div className="progress-bar bg-primary" style={{ width: `${row.approval_rate ?? 0}%` }} title={`Approved: ${row.approved}`} />
                <div className="progress-bar bg-danger" style={{ width: `${row.rejection_rate ?? 0}%` }} title={`Rejected: ${row.rejected}`} />
                <div className="progress-bar bg-warning" style={{ width: `${row.pending_rate ?? 0}%` }} title={`Pending: ${row.pending}`} />
              </div>
            </div>
          ))
        )}
      </div>
    </>
  );
}

export default ApplicantRecordsSection;