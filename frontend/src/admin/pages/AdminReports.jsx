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

const APPROVED_SET = ["approved", "physically_verified", "claimed", "not_cleared", "unclaimed"];
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

function AdminReports() {
  const [summary, setSummary] = useState(null);
  const [forecast, setForecast] = useState(null);
  const [filter, setFilter] = useState(emptyFilter);
  const [preview, setPreview] = useState([]);
  const [loading, setLoading] = useState(true);
  const [previewing, setPreviewing] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([
      api.get("/admin/reports/summary"),
      api.get("/admin/reports/budget-forecast"),
      api.get("/admin/reports/applications"),
    ]).then(([summaryRes, forecastRes, appsRes]) => {
      setSummary(summaryRes.data);
      setForecast(forecastRes.data);
      setPreview(appsRes.data);
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
                  {" "}— {summary.config.school_year}, {summary.config.semester}
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
                        <th>Semester</th>
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
                          <td>{h.semester}</td>
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