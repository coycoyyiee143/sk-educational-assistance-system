import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import VerifierNavigation from "../components/VerifierNavigation";
import api from "../../services/api";
import { getVerifierStatusLabel, getVerifierBadgeClass } from "../../components/StatusConstants";

function StatusBadge({ app }) {
  return <span className={`status-badge ${getVerifierBadgeClass(app)}`}>{getVerifierStatusLabel(app)}</span>;
}

function VerifierApplicationList() {
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

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