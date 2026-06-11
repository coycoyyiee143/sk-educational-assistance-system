import VerifierNavigation from "../components/VerifierNavigation";

// ── Data ──────────────────────────────────────────────────────────────────────

const summaryCards = [
  { label: "Pending Applications", value: 24, sub: "Awaiting initial review" },
  { label: "Under Review",         value: 12, sub: "Currently being evaluated" },
  { label: "Approved",             value: 18, sub: "Eligible applications" },
  { label: "Rejected",             value: 6,  sub: "Did not meet requirements" },
];

const flaggedApplications = [
  { id: "SK-EA-2026-00125", name: "Juan Dela Cruz",  date: "April 10, 2026", status: "Flagged",      issue: "Blurry Certificate of Enrollment" },
  { id: "SK-EA-2026-00131", name: "Maria Santos",    date: "April 11, 2026", status: "Pending",      issue: "Awaiting verification" },
  { id: "SK-EA-2026-00138", name: "Carlo Reyes",     date: "April 12, 2026", status: "Under Review", issue: "Checking submitted records" },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function StatusBadge({ status }) {
  const map = {
    "Pending":      "pending",
    "Under Review": "review",
    "Approved":     "approved",
    "Rejected":     "rejected",
    "Flagged":      "flagged",
  };
  return <span className={`status-badge ${map[status] ?? ""}`}>{status}</span>;
}

// ── Component ─────────────────────────────────────────────────────────────────

function VerifierDashboard() {
  return (
    <div>
      <VerifierNavigation />

      <section className="page-section">
        <div className="container">

          <h3 className="section-title">Verifier Dashboard</h3>

          {/* Summary Cards */}
          <div className="row g-4">
            {summaryCards.map(({ label, value, sub }) => (
              <div className="col-md-3" key={label}>
                <div className="summary-card">
                  <h5>{label}</h5>
                  <div className="summary-number">{value}</div>
                  <p className="text-muted mb-0">{sub}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Applications Requiring Attention */}
          <div className="content-card">
            <h4>Applications Requiring Attention</h4>

            <div className="table-responsive">
              <table className="table table-bordered table-striped align-middle">
                <thead>
                  <tr>
                    <th>Application ID</th>
                    <th>Applicant Name</th>
                    <th>Submission Date</th>
                    <th>Status</th>
                    <th>Issue</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {flaggedApplications.map((app) => (
                    <tr key={app.id}>
                      <td>{app.id}</td>
                      <td>{app.name}</td>
                      <td>{app.date}</td>
                      <td><StatusBadge status={app.status} /></td>
                      <td>{app.issue}</td>
                      <td>
                        <a href="application-review.html" className="btn btn-custom btn-sm">Review</a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

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

export default VerifierDashboard;