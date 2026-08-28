import { useState, useEffect } from "react";
import api from "../../services/api";

const reportTypes = [
    "All Applications",
    "Pending Prescreening",
    "For Review",
    "Reupload Requested",
    "Approved",
    "Waitlisted",
    "Claimed",
    "Not Cleared",
    "Unclaimed",
    "Not Selected",
    "Rejected",
];
const applicantTypes = ["All Applicants", "Minor", "Adult"];
const yearLevelOptions = ["All Year Levels", "1st Year", "2nd Year", "3rd Year", "4th Year"];
const emptyFilter = {
    type: "All Applications", from: "", to: "",
    school_name: "All Schools", course: "All Courses",
    year_level: "All Year Levels", applicant_type: "All Applicants",
};

// Three-tier semantic grouping for badge color — not the same as the
// filter dropdown above, which lists every status individually for
// precision. This grouping is purely visual: "did this outcome succeed,
// is it still in progress, or did it not succeed."
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
    const [filterOptions, setFilterOptions] = useState({ schools: [], courses: [] });
    const [filter, setFilter] = useState(emptyFilter);
    const [preview, setPreview] = useState([]);
    const [previewing, setPreviewing] = useState(false);
    const [exporting, setExporting] = useState(false);
    const [error, setError] = useState("");
    const [submissionVsApproval, setSubmissionVsApproval] = useState(null);
    const [sectionLoading, setSectionLoading] = useState(true);

    useEffect(() => {
        api.get("/admin/reports/filter-options").then((res) => setFilterOptions(res.data)).catch(() => { });
    }, []);

    useEffect(() => {
        setSectionLoading(true);
        const params = selectedConfigId ? { config_id: selectedConfigId } : {};
        Promise.all([
            api.get("/admin/reports/summary", { params }).then((res) => setSummary(res.data)).catch(() => { }),
            api.get("/admin/reports/applications", { params }).then((res) => setPreview(res.data)).catch(() => { }),
            // Not scoped to selectedConfigId — this card is deliberately
            // multi-period (all completed + active periods), since its whole
            // purpose is showing the trend across cycles, not one period.
            api.get("/admin/reports/submission-vs-approval").then((res) => setSubmissionVsApproval(res.data)).catch(() => { }),
        ]).finally(() => setSectionLoading(false));
    }, [selectedConfigId]);

    const set = (k) => (e) => setFilter((f) => ({ ...f, [k]: e.target.value }));

    function buildParams() {
        const params = {};
        if (filter.type !== "All Applications") params.type = filter.type;
        if (filter.from) params.from = filter.from;
        if (filter.to) params.to = filter.to;
        if (filter.school_name !== "All Schools") params.school_name = filter.school_name;
        if (filter.course !== "All Courses") params.course = filter.course;
        if (filter.year_level !== "All Year Levels") params.year_level = filter.year_level;
        if (filter.applicant_type !== "All Applicants") params.applicant_type = filter.applicant_type.toLowerCase();
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
                    .toolbar button {
                      padding: 10px 24px; background: #b71c1c; color: #fff; border: none;
                      border-radius: 6px; font-size: 14px; font-weight: 600; cursor: pointer; margin: 0 4px;
                    }
                    .page-chunk {
                      background: #fff;
                      margin: 0 auto 24px;
                      box-shadow: 0 2px 10px rgba(0,0,0,0.25);
                    }
                    .page-controls { text-align: center; margin: 0 auto 8px; max-width: 1080px; }
                    .page-controls button {
                      padding: 8px 20px; background: #6c757d; color: #fff; border: none;
                      border-radius: 6px; font-size: 13px; cursor: pointer; margin: 0 4px 12px;
                    }
                  </style>
                </head>
                <body>
                  <div class="toolbar">
                    <button id="download-all-btn">Download All Pages</button>
                  </div>
                  <div id="capture-root">${res.data}</div>
                  <script>
                    const chunks = Array.from(document.querySelectorAll('.page-chunk'));

                    function downloadPage(chunk, idx) {
                      return html2canvas(chunk, { scale: 2, backgroundColor: '#ffffff' }).then(function (canvas) {
                        const link = document.createElement('a');
                        link.download = 'educational-assistance-approved-list-page-' + (idx + 1) + '.png';
                        link.href = canvas.toDataURL('image/png');
                        link.click();
                      });
                    }

                    chunks.forEach(function (chunk, idx) {
                      const controls = document.createElement('div');
                      controls.className = 'page-controls';
                      const btn = document.createElement('button');
                      btn.textContent = 'Download Page ' + (idx + 1);
                      btn.addEventListener('click', function () { downloadPage(chunk, idx); });
                      controls.appendChild(btn);
                      chunk.parentNode.insertBefore(controls, chunk);
                    });

                    document.getElementById('download-all-btn').addEventListener('click', function () {
                      // Staggered so the browser doesn't treat simultaneous
                      // downloads as a popup-spam pattern and block them.
                      chunks.reduce(function (chain, chunk, idx) {
                        return chain.then(function () {
                          return downloadPage(chunk, idx).then(function () {
                            return new Promise(function (resolve) { setTimeout(resolve, 400); });
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

    const stats = summary?.summary ?? {};
    const rates = summary?.rates ?? {};

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

            {/* Application Overview — By Status */}
            <div className="page-card">
                <h4 className="sub-title">
                    Application Overview — By Status
                    {summary?.config && <span className="text-muted fw-normal" style={{ fontSize: "14px" }}>{" "}— {summary.config.school_year}</span>}
                </h4>
                {!summary?.config ? (
                    <div className="alert alert-info mb-0">No data for the selected period.</div>
                ) : (
                    <div className="row g-4">
                        <div className="col-md-3"><div className="summary-card"><h2>{stats.total_applicants}</h2><p>Total Applicants</p></div></div>
                        <div className="col-md-3"><div className="summary-card"><h2>{stats.approved_applications}</h2><p>Approved</p></div></div>
                        <div className="col-md-3"><div className="summary-card"><h2>{stats.rejected_applications}</h2><p>Rejected</p></div></div>
                        <div className="col-md-3"><div className="summary-card"><h2>{stats.pending_applications}</h2><p>Pending</p></div></div>
                    </div>
                )}
            </div>

            {/* Application Overview — By Rate */}
            <div className="page-card">
                <h4 className="sub-title">
                    Application Overview — By Rate
                    {summary?.config && <span className="text-muted fw-normal" style={{ fontSize: "14px" }}>{" "}— {summary.config.school_year}</span>}
                </h4>
                {!summary?.config ? (
                    <div className="alert alert-info mb-0">No data for the selected period.</div>
                ) : (
                    <div className="row g-4">
                        <div className="col-md-4"><div className="summary-card"><h2>{rates.approval_rate ?? 0}%</h2><p>Approval Rate</p></div></div>
                        <div className="col-md-4"><div className="summary-card"><h2>{rates.rejection_rate ?? 0}%</h2><p>Rejection Rate</p></div></div>
                        <div className="col-md-4"><div className="summary-card"><h2>{rates.under_review_rate ?? 0}%</h2><p>Pending Rate</p></div></div>
                    </div>
                )}
            </div>

            {/* Submission & Approval History — multi-period trend, deliberately not scoped to selectedConfigId */}
            <div className="page-card">
                <div className="d-flex justify-content-between align-items-start flex-wrap gap-2">
                    <h4 className="sub-title">Submission &amp; Approval History</h4>
                    <button type="button" className="btn btn-sm btn-outline-custom"
                        onClick={() => handlePdfExport("/admin/reports/submission-vs-approval/pdf", "submission-vs-approval-trend")}>
                        Export PDF
                    </button>
                </div>
                <div className="info-box">
                    Approved vs. rejected vs. pending outcomes per period, shown against total submitted — across all cycles, not just the one selected above.
                </div>
                {!submissionVsApproval?.trend?.length ? (
                    <div className="alert alert-info mb-0">No application period data available yet.</div>
                ) : (
                    submissionVsApproval.trend.map((row) => (
                        <div key={row.config_id} className="mb-3">
                            <div className="d-flex justify-content-between align-items-center small mb-1">
                                <span className="fw-semibold">
                                    {row.school_year}
                                    {row.is_active && <span className="badge bg-success ms-2">Active</span>}
                                </span>
                                <div className="d-flex gap-2">
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

            {/* Applicant Records — filter/export tool */}
            <div className="page-card">
                <h4 className="sub-title">Applicant Records</h4>
                <div className="info-box">
                    Filter and preview individual applicant records, or export them as a CSV file for documentation and record-keeping purposes.
                </div>
                <form onSubmit={handlePreview}>
                    <div className="row g-3">
                        <div className="col-md-3">
                            <label className="form-label">Status</label>
                            <select className="form-select" value={filter.type} onChange={set("type")}>
                                {reportTypes.map((t) => <option key={t}>{t}</option>)}
                            </select>
                        </div>
                        <div className="col-md-3">
                            <label className="form-label">School</label>
                            <select className="form-select" value={filter.school_name} onChange={set("school_name")}>
                                <option>All Schools</option>
                                {filterOptions.schools.map((s) => <option key={s}>{s}</option>)}
                            </select>
                        </div>
                        <div className="col-md-3">
                            <label className="form-label">Course / Program</label>
                            <select className="form-select" value={filter.course} onChange={set("course")}>
                                <option>All Courses</option>
                                {filterOptions.courses.map((c) => <option key={c}>{c}</option>)}
                            </select>
                        </div>
                        <div className="col-md-3">
                            <label className="form-label">Year Level</label>
                            <select className="form-select" value={filter.year_level} onChange={set("year_level")}>
                                {yearLevelOptions.map((y) => <option key={y}>{y}</option>)}
                            </select>
                        </div>
                        <div className="col-md-3">
                            <label className="form-label">Applicant Type</label>
                            <select className="form-select" value={filter.applicant_type} onChange={set("applicant_type")}>
                                {applicantTypes.map((t) => <option key={t}>{t}</option>)}
                            </select>
                        </div>
                        <div className="col-md-3">
                            <label className="form-label">From Date</label>
                            <input type="date" className="form-control" value={filter.from} onChange={set("from")} />
                        </div>
                        <div className="col-md-3">
                            <label className="form-label">To Date</label>
                            <input type="date" className="form-control" value={filter.to} onChange={set("to")} />
                        </div>
                    </div>
                    <div className="mt-4 d-flex justify-content-end gap-2">
                        <button type="submit" className="btn btn-secondary" disabled={previewing}>{previewing ? "Loading..." : "Preview"}</button>
                        <button type="button" className="btn btn-custom" onClick={handleExport} disabled={exporting}>{exporting ? "Exporting..." : "Export CSV"}</button>
                    </div>
                </form>
            </div>

            <div className="page-card">
                <h4 className="sub-title">Record Preview</h4>
                <div className="table-responsive table-scroll">
                    <table className="table table-bordered table-striped align-middle mb-0">
                        <thead>
                            <tr>
                                <th>Application ID</th><th>Control Number</th><th>Applicant Name</th>
                                <th>Submission Date</th><th>Status</th><th>School</th><th>Course / Strand</th><th>Year Level</th>
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
                                    <td>{r.year_level}</td>
                                </tr>
                            ))}
                            {preview.length === 0 && (
                                <tr><td colSpan="8" className="text-center text-muted">No records found.</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            <div className="page-card">
                <h4 className="sub-title">Approved Applicants List</h4>
                <div className="info-box">
                    Generates the official list of approved applicants for {selectedConfigId ? "the selected period" : "the active period"} — a printable PDF for the office copy and physical bulletin board, and images sized for posting straight to the SK's Facebook page.
                </div>
                <button type="button" className="btn btn-custom btn-sm" onClick={handleApprovedListExport}>
                    Download PDF
                </button>
                <button type="button" className="btn btn-outline-custom btn-sm ms-2" onClick={handleApprovedListImageExport}>
                    Generate Facebook Images
                </button>
            </div>
        </>
    );
}

export default ApplicantRecordsSection;