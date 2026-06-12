import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import VerifierNavigation from "../components/VerifierNavigation";
import api from "../../services/api";

function StatusBadge({ status }) {
  const map = {
    pending_prescreening: "pending",
    for_review: "review",
    approved: "approved",
    rejected: "rejected",
    reupload_requested: "flagged",
  };
  const labels = {
    pending_prescreening: "Pending",
    for_review: "For Review",
    approved: "Approved",
    rejected: "Rejected",
    reupload_requested: "Re-upload Requested",
  };
  return <span className={`status-badge ${map[status] ?? ""}`}>{labels[status] ?? status}</span>;
}

function VerifierDashboard() {
  const [stats, setStats] = useState({ pending: 0, review: 0, approved: 0, rejected: 0 });
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get("/verifier/stats"),
      api.get("/verifier/applications"),
    ]).then(([statsRes, appsRes]) => {
      setStats(statsRes.data);
      setApplications(appsRes.data.filter((a) => ["for_review", "pending_prescreening"].includes(a.status)).slice(0, 10));
    }).catch(() => { })
      .finally(() => setLoading(false));
  }, []);

  const cards = [
    { label: "Pending Applications", value: stats.pending, sub: "Awaiting pre-screening" },
    { label: "For Review", value: stats.review, sub: "Flagged for manual review" },
    { label: "Approved", value: stats.approved, sub: "Eligible applications" },
    { label: "Rejected", value: stats.rejected, sub: "Did not meet requirements" },
  ];

  return (
    <div>
      <VerifierNavigation />
      <section className="page-section">
        <div className="container">
          <h3 className="section-title">Verifier Dashboard</h3>

          <div className="row g-4">
            {cards.map(({ label, value, sub }) => (
              <div className="col-md-3" key={label}>
                <div className="summary-card">
                  <h5>{label}</h5>
                  <div className="summary-number">{loading ? "..." : value}</div>
                  <p className="text-muted mb-0">{sub}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="content-card mt-4">
            <h4>Applications Requiring Attention</h4>
            {loading ? <div className="spinner-border text-danger" /> : (
              <div className="table-responsive">
                <table className="table table-bordered table-striped align-middle">
                  <thead>
                    <tr>
                      <th>Application ID</th>
                      <th>Applicant Name</th>
                      <th>Submission Date</th>
                      <th>Status</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {applications.length === 0 ? (
                      <tr><td colSpan="5" className="text-center text-muted">No applications requiring attention.</td></tr>
                    ) : applications.map((app) => (
                      <tr key={app.id}>
                        <td>{app.control_number ?? `APP-${app.id}`}</td>
                        <td>{app.name}</td>
                        <td>{app.submitted_at?.split("T")[0]}</td>
                        <td><StatusBadge status={app.status} /></td>
                        <td>
                          <Link to={`/VerifierApplicationReview/${app.id}`} className="btn btn-custom btn-sm">Review</Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
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