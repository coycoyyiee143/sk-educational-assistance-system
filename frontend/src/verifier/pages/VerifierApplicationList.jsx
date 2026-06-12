import { useState, useEffect } from "react";
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

function VerifierApplicationList() {
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    api.get("/verifier/applications")
      .then((res) => setApplications(res.data))
      .catch(() => { })
      .finally(() => setLoading(false));
  }, []);

  const filtered = applications.filter((app) =>
    app.name.toLowerCase().includes(search.toLowerCase()) ||
    String(app.id).includes(search) ||
    (app.control_number ?? "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <VerifierNavigation />
      <section className="page-section">
        <div className="container">
          <h3 className="section-title">Submitted Applications</h3>
          <div className="page-card">
            <div className="row mb-3">
              <div className="col-md-4">
                <input
                  type="text"
                  className="form-control"
                  placeholder="Search applicant name or ID"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>
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
                    {filtered.map((app) => (
                      <tr key={app.id}>
                        <td>{app.control_number ?? `APP-${app.id}`}</td>
                        <td>{app.name}</td>
                        <td>{app.submitted_at?.split("T")[0]}</td>
                        <td><StatusBadge status={app.status} /></td>
                        <td>
                          <Link to={`/VerifierApplicationReview/${app.id}`} className="btn btn-custom btn-sm">
                            {["approved", "rejected"].includes(app.status) ? "View" : "Review"}
                          </Link>
                        </td>
                      </tr>
                    ))}
                    {filtered.length === 0 && (
                      <tr><td colSpan="5" className="text-center text-muted">No applications found.</td></tr>
                    )}
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

export default VerifierApplicationList;