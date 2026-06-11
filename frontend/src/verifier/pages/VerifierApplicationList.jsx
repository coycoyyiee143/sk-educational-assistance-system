import { useState } from "react";
import { Link } from "react-router-dom";
import VerifierNavigation from "../components/VerifierNavigation";

// ── Data ──────────────────────────────────────────────────────────────────────

const initialApplications = [
  { id: "SK-EA-2026-00125", name: "Juan Dela Cruz", date: "April 10, 2026", status: "Flagged" },
  { id: "SK-EA-2026-00131", name: "Maria Santos",   date: "April 11, 2026", status: "Pending" },
  { id: "SK-EA-2026-00138", name: "Carlo Reyes",    date: "April 12, 2026", status: "Under Review" },
  { id: "SK-EA-2026-00144", name: "Ana Cruz",       date: "April 13, 2026", status: "Approved" },
  { id: "SK-EA-2026-00150", name: "Mark Lopez",     date: "April 13, 2026", status: "Rejected" },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function StatusBadge({ status }) {
  const map = {
    "Pending":      "pending",
    "Under Review": "review",
    "Flagged":      "flagged",
    "Approved":     "approved",
    "Rejected":     "rejected",
  };
  return <span className={`status-badge ${map[status] ?? ""}`}>{status}</span>;
}

// ── Component ─────────────────────────────────────────────────────────────────

function VerifierApplicationList() {
  const [search, setSearch] = useState("");

  const filtered = initialApplications.filter((app) =>
    app.name.toLowerCase().includes(search.toLowerCase()) ||
    app.id.toLowerCase().includes(search.toLowerCase())
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
                      <td>{app.id}</td>
                      <td>{app.name}</td>
                      <td>{app.date}</td>
                      <td><StatusBadge status={app.status} /></td>
                      <td>
                        <Link to="/VerifierApplicationReview" className="btn btn-custom btn-sm">
                          {app.status === "Approved" || app.status === "Rejected" ? "View" : "Review"}
                        </Link>
                      </td>
                    </tr>
                  ))}
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan="5" className="text-center text-muted">No applications found.</td>
                    </tr>
                  )}
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

export default VerifierApplicationList;