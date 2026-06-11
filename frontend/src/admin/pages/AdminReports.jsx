import { useState } from "react";
import AdminNavigation from "../components/AdminNavigation";

// ── Data ──────────────────────────────────────────────────────────────────────

const summaryStats = [
  { value: 125, label: "Total Applicants" },
  { value: 34,  label: "Pending Applications" },
  { value: 70,  label: "Approved Applications" },
  { value: 21,  label: "Rejected Applications" },
];

const additionalStats = [
  { value: "56%", label: "Approval Rate" },
  { value: "17%", label: "Rejection Rate" },
  { value: "27%", label: "Applications Under Review" },
];

const reportTypes = [
  "All Applications",
  "Approved Students",
  "Rejected Applications",
  "Pending Applications",
];

const allReports = [
  { id: "SK-EA-2026-00125", name: "Juan Dela Cruz",  date: "April 10, 2026", status: "Approved",     school: "Pamantasan ng Cabuyao",                  course: "BS Information Technology" },
  { id: "SK-EA-2026-00131", name: "Maria Santos",    date: "April 11, 2026", status: "Under Review", school: "University of the Philippines",           course: "BS Education" },
  { id: "SK-EA-2026-00138", name: "Carlo Reyes",     date: "April 12, 2026", status: "Rejected",     school: "Laguna State Polytechnic University",     course: "BS Criminology" },
  { id: "SK-EA-2026-00144", name: "Ana Cruz",        date: "April 13, 2026", status: "Approved",     school: "Polytechnic University of the Philippines", course: "Accountancy" },
  { id: "SK-EA-2026-00150", name: "Mark Lopez",      date: "April 14, 2026", status: "Approved",     school: "STI College",                             course: "Information Technology" },
];

const emptyFilter = { type: "", from: "", to: "" };

// ── Helpers ───────────────────────────────────────────────────────────────────

function StatusBadge({ status }) {
  const map = {
    "Approved":     "badge-approved",
    "Rejected":     "badge-rejected",
    "Under Review": "badge-review",
  };
  return <span className={map[status] ?? ""}>{status}</span>;
}

// ── Component ─────────────────────────────────────────────────────────────────

function AdminReports() {
  const [filter, setFilter] = useState(emptyFilter);
  const [preview, setPreview] = useState(allReports);

  const set = (k) => (e) => setFilter((f) => ({ ...f, [k]: e.target.value }));

  function handlePreview(e) {
    e.preventDefault();
    let results = [...allReports];

    if (filter.type && filter.type !== "All Applications") {
      const map = {
        "Approved Students":     "Approved",
        "Rejected Applications": "Rejected",
        "Pending Applications":  "Under Review",
      };
      results = results.filter((r) => r.status === map[filter.type]);
    }

    setPreview(results);
  }

  function handleExport() {
    // TODO: connect to backend export
    console.log("Exporting:", filter);
  }

  return (
    <div>
      <AdminNavigation />

      <section className="page-section">
        <div className="container">

          {/* Header */}
          <div className="page-card">
            <h3 className="section-title mb-2">Reports</h3>
            <p className="text-muted mb-0">
              View summary reports and analytics related to the educational assistance program, including applicant statistics and approved student records.
            </p>
          </div>

          {/* Application Summary */}
          <div className="page-card">
            <h4 className="sub-title">Application Summary</h4>
            <div className="row g-4">
              {summaryStats.map(({ value, label }) => (
                <div className="col-md-3" key={label}>
                  <div className="summary-card">
                    <h2>{value}</h2>
                    <p>{label}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Generate Report */}
          <div className="page-card">
            <h4 className="sub-title">Generate Report</h4>

            <div className="info-box">
              The administrator may filter report data and export records of verified or approved students for documentation and record-keeping purposes.
            </div>

            <form onSubmit={handlePreview}>
              <div className="row g-3">
                <div className="col-md-4">
                  <label className="form-label">Report Type</label>
                  <select className="form-select" value={filter.type} onChange={set("type")}>
                    <option value="" disabled>Select report type</option>
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
                <button type="submit" className="btn btn-secondary">Preview</button>
                <button type="button" className="btn btn-custom" onClick={handleExport}>Export Report</button>
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
                      <td>{r.id}</td>
                      <td>{r.name}</td>
                      <td>{r.date}</td>
                      <td><StatusBadge status={r.status} /></td>
                      <td>{r.school}</td>
                      <td>{r.course}</td>
                    </tr>
                  ))}
                  {preview.length === 0 && (
                    <tr>
                      <td colSpan="6" className="text-center text-muted">No records found.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Additional Statistics */}
          <div className="page-card">
            <h4 className="sub-title">Additional Statistics</h4>
            <div className="row g-4">
              {additionalStats.map(({ value, label }) => (
                <div className="col-md-4" key={label}>
                  <div className="summary-card">
                    <h2>{value}</h2>
                    <p>{label}</p>
                  </div>
                </div>
              ))}
            </div>
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