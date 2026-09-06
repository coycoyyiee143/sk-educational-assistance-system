import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import VerifierNavigation from "../components/VerifierNavigation";
import api from "../../services/api";
import { getVerifierStatusLabel, getVerifierBadgeClass } from "../../components/StatusConstants";
import PanelFooter from "../../components/PanelFooter";
function StatusBadge({ app }) {
  return <span className={`status-badge ${getVerifierBadgeClass(app)}`}>{getVerifierStatusLabel(app)}</span>;
}
function VerifierDashboard() {
  const [stats, setStats] = useState({ pending: 0, review: 0, approved: 0, rejected: 0 });
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const perPage = 10;
  const fetchData = () => {
    Promise.all([
      api.get("/verifier/stats"),
      api.get("/verifier/applications"),
    ])
      .then(([statsRes, appsRes]) => {
        setStats(statsRes.data);
        const actionable = appsRes.data.filter((a) =>
          ["for_review", "pending_prescreening"].includes(a.status)
        );
        setApplications(actionable);
      })
      .catch(() => { })
      .finally(() => setLoading(false));
  };
  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, []);
  const cards = [
    {
      label: "Pending Applications",
      value: stats.pending,
      accent: "orange",
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" />
        </svg>
      ),
    },
    {
      label: "For Review",
      value: stats.review,
      accent: "red",
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10" />
          <path d="M12 8v4M12 16h.01" />
        </svg>
      ),
    },
    {
      label: "Approved",
      value: stats.approved,
      accent: "green",
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10" />
          <path d="M8 12l3 3 5-6" />
        </svg>
      ),
    },
    {
      label: "Rejected",
      value: stats.rejected,
      accent: "gray",
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10" />
          <path d="M15 9l-6 6M9 9l6 6" />
        </svg>
      ),
    },
  ];
  const totalPages = Math.max(1, Math.ceil(applications.length / perPage));
  const pageStart = (currentPage - 1) * perPage;
  const pagedApplications = applications.slice(pageStart, pageStart + perPage);
  function goToPage(page) {
    if (page < 1 || page > totalPages) return;
    setCurrentPage(page);
  }
  function getPageNumbers() {
    const pages = [];
    const maxVisible = 5;
    if (totalPages <= maxVisible) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
      return pages;
    }
    pages.push(1);
    if (currentPage > 3) pages.push("...");
    const start = Math.max(2, currentPage - 1);
    const end = Math.min(totalPages - 1, currentPage + 1);
    for (let i = start; i <= end; i++) pages.push(i);
    if (currentPage < totalPages - 2) pages.push("...");
    pages.push(totalPages);
    return pages;
  }
  return (
    <div className="verifier-layout">
      <VerifierNavigation />
      <div className="verifier-main">
        <div className="verifier-topbar">
          <div className="verifier-topbar-user">
            <div className="verifier-topbar-user-text">
              <span className="verifier-topbar-user-name">Verifier User</span>
              <span className="verifier-topbar-user-role">Sangguniang Kabataan</span>
            </div>
            <div className="verifier-topbar-avatar"></div>
          </div>
        </div>
        <section className="page-section">
          <div className="container-fluid">
            <div className="verifier-dashboard-header">
              <h3 className="verifier-dashboard-title">Verifier Dashboard</h3>
              <p className="verifier-dashboard-desc">Overview of application statistics and applications requiring verification.</p>
            </div>
            <div className="row g-4">
              {cards.map(({ label, value, accent, icon }) => (
                <div className="col-md-3" key={label}>
                  <div className={`verifier-stat-card verifier-stat-${accent}`}>
                    <div className="verifier-stat-top">
                      <h2>{loading ? "..." : value}</h2>
                      <span className={`verifier-stat-icon verifier-stat-icon-${accent}`}>{icon}</span>
                    </div>
                    <p className={`verifier-stat-label verifier-stat-label-${accent}`}>{label}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="page-card verifier-attention-card mt-4">
              <h4 className="sub-title sub-title-dark">Applications Requiring Attention</h4>
              <div className="table-responsive">
                <table className="table table-bordered table-striped align-middle verifier-attention-table">
                  <colgroup>
                    <col style={{ width: "20%" }} />
                    <col style={{ width: "25%" }} />
                    <col style={{ width: "22%" }} />
                    <col style={{ width: "20%" }} />
                    <col style={{ width: "11%" }} />
                  </colgroup>
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
                    {loading ? (
                      <tr>
                        <td colSpan="5" className="text-center py-4">
                          <div className="spinner-border text-danger" role="status" />
                        </td>
                      </tr>
                    ) : pagedApplications.length === 0 ? (
                      <tr>
                        <td colSpan="5" className="text-center text-muted">No applications requiring attention.</td>
                      </tr>
                    ) : (
                      pagedApplications.map((app) => (
                        <tr key={app.id}>
                          <td>{app.control_number ?? `APP-${app.id}`}</td>
                          <td>{app.name}</td>
                          <td>{app.submitted_at?.split("T")[0]}</td>
                          <td><StatusBadge app={app} /></td>
                          <td className="verifier-attention-action">
                            <Link to={`/VerifierApplicationReview/${app.id}`} className="verifier-review-btn">Review</Link>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
              {!loading && applications.length > 0 && (
                <div className="verifier-table-pagination-bar">
                  <span className="verifier-table-pagination-info">
                    Showing {pageStart + 1}–{Math.min(pageStart + perPage, applications.length)} of {applications.length} applications
                  </span>
                  <div className="verifier-table-pagination-controls">
                    <button className="verifier-table-pagination-arrow" onClick={() => goToPage(currentPage - 1)} disabled={currentPage === 1} aria-label="Previous page">
                      ‹
                    </button>
                    {getPageNumbers().map((page, idx) =>
                      page === "..." ? (
                        <span key={`ellipsis-${idx}`} className="verifier-table-pagination-ellipsis">…</span>
                      ) : (
                        <button key={page} className={`verifier-table-pagination-page ${page === currentPage ? "verifier-table-pagination-page-active" : ""}`} onClick={() => goToPage(page)}>
                          {page}
                        </button>
                      )
                    )}
                    <button className="verifier-table-pagination-arrow" onClick={() => goToPage(currentPage + 1)} disabled={currentPage === totalPages} aria-label="Next page">
                      ›
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>
        <PanelFooter />
      </div>
    </div>
  );
}
export default VerifierDashboard;