import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import VerifierNavigation from "../components/VerifierNavigation";
import api from "../../services/api";
import { getVerifierStatusLabel, getVerifierBadgeClass } from "../../components/StatusConstants";

function StatusBadge({ app }) {
  return <span className={`status-badge ${getVerifierBadgeClass(app)}`}>{getVerifierStatusLabel(app)}</span>;
}

const STATUS_TABS = [
  { key: "all", label: "All" },
  { key: "for_review", label: "For Review" },
  { key: "pending_prescreening", label: "Pending" },
  { key: "approved", label: "Approved" },
  { key: "rejected", label: "Rejected" },
];

function VerifierApplicationList() {
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusTab, setStatusTab] = useState("for_review");

  const fetchData = () => {
    api.get("/verifier/applications")
      .then((res) => setApplications(res.data))
      .catch(() => { })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, []);

  const counts = {
    for_review: applications.filter((a) => a.status === "for_review").length,
    pending_prescreening: applications.filter((a) => a.status === "pending_prescreening").length,
    approved: applications.filter((a) => a.status === "approved").length,
    rejected: applications.filter((a) => a.status === "rejected").length,
  };

  const filtered = applications
    .filter((app) => statusTab === "all" || app.status === statusTab)
    .filter((app) =>
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

          <div className="row g-4">
            <div className="col-md-3">
              <div className="summary-card">
                <h5>For Review</h5>
                <div className="summary-number">{loading ? "..." : counts.for_review}</div>
                <p className="text-muted mb-0">Needs verifier action</p>
              </div>
            </div>
            <div className="col-md-3">
              <div className="summary-card">
                <h5>Pending</h5>
                <div className="summary-number">{loading ? "..." : counts.pending_prescreening}</div>
                <p className="text-muted mb-0">Still processing</p>
              </div>
            </div>
            <div className="col-md-3">
              <div className="summary-card">
                <h5>Approved</h5>
                <div className="summary-number">{loading ? "..." : counts.approved}</div>
                <p className="text-muted mb-0">Eligible applications</p>
              </div>
            </div>
            <div className="col-md-3">
              <div className="summary-card">
                <h5>Rejected</h5>
                <div className="summary-number">{loading ? "..." : counts.rejected}</div>
                <p className="text-muted mb-0">Did not meet requirements</p>
              </div>
            </div>
          </div>

          <div className="page-card mt-4">
            <div className="d-flex flex-wrap gap-2 mb-3">
              {STATUS_TABS.map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  className={`btn btn-sm ${statusTab === tab.key ? "btn-custom" : "btn-outline-custom"}`}
                  onClick={() => setStatusTab(tab.key)}
                >
                  {tab.label}
                  {tab.key === "for_review" && counts.for_review > 0 && (
                    <span className="badge bg-danger ms-2">{counts.for_review}</span>
                  )}
                </button>
              ))}
            </div>

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

            {loading ? (
              <div className="text-center py-5">
                <div className="spinner-border text-danger" />
              </div>
            ) : (
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
                    {filtered.length > 0 ? (
                      filtered.map((app) => (
                        <tr key={app.id}>
                          <td>{app.control_number ?? `APP-${app.id}`}</td>
                          <td>{app.name}</td>
                          <td>{app.submitted_at?.split("T")[0]}</td>
                          <td><StatusBadge app={app} /></td>
                          <td>
                            <Link to={`/VerifierApplicationReview/${app.id}`} className="btn btn-custom btn-sm">
                              {["approved", "rejected"].includes(app.status) ? "View" : "Review"}
                            </Link>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr><td colSpan="5" className="text-center text-muted">No applications found.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

export default VerifierApplicationList;