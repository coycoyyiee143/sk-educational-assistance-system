import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import VerifierNavigation from "../components/VerifierNavigation";
import VerifierTopbar from "../components/VerifierTopbar";
import api from "../../services/api";

import {
  getVerifierStatusLabel,
  getVerifierBadgeClass,
} from "../../components/StatusConstants";
import PanelFooter from "../../components/PanelFooter";

function StatusBadge({ app }) {
  return (
    <span className={`status-badge ${getVerifierBadgeClass(app)}`}>
      {getVerifierStatusLabel(app)}
    </span>
  );
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
  const [currentPage, setCurrentPage] = useState(1);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const perPage = 10;

  const fetchData = () => {
    api
      .get("/verifier/applications")
      .then((res) => setApplications(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchData();

    const interval = setInterval(fetchData, 10000);

    return () => clearInterval(interval);
  }, []);

  const counts = {
    all: applications.length,
    for_review: applications.filter((a) => a.status === "for_review").length,
    pending_prescreening: applications.filter(
      (a) => a.status === "pending_prescreening"
    ).length,
    approved: applications.filter((a) => a.status === "approved").length,
    rejected: applications.filter((a) => a.status === "rejected").length,
  };

  const filtered = applications
    .filter((app) => statusTab === "all" || app.status === statusTab)
    .filter(
      (app) =>
        app.name.toLowerCase().includes(search.toLowerCase()) ||
        String(app.id).includes(search) ||
        (app.control_number ?? "")
          .toLowerCase()
          .includes(search.toLowerCase())
    );

  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
  const pageStart = (currentPage - 1) * perPage;
  const pagedApplications = filtered.slice(
    pageStart,
    pageStart + perPage
  );

  function goToPage(page) {
    if (page < 1 || page > totalPages) return;
    setCurrentPage(page);
  }

  function getPageNumbers() {
    const pages = [];
    const maxVisible = 5;

    if (totalPages <= maxVisible) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }

      return pages;
    }

    pages.push(1);

    if (currentPage > 3) {
      pages.push("...");
    }

    const start = Math.max(2, currentPage - 1);
    const end = Math.min(totalPages - 1, currentPage + 1);

    for (let i = start; i <= end; i++) {
      pages.push(i);
    }

    if (currentPage < totalPages - 2) {
      pages.push("...");
    }

    pages.push(totalPages);

    return pages;
  }

  function handleTabChange(key) {
    setStatusTab(key);
    setCurrentPage(1);
  }

  return (
    <div className="verifier-layout">
      <VerifierNavigation
        mobileOpen={mobileMenuOpen}
        onMobileClose={() => setMobileMenuOpen(false)}
      />

      <div className="verifier-main">
        <VerifierTopbar
          onMenuOpen={() => setMobileMenuOpen(true)}
        />

        <section className="page-section">
          <div className="container-fluid">
            <div className="verifier-dashboard-header">
              <h3 className="verifier-dashboard-title">
                Submitted Applications
              </h3>

              <p className="verifier-dashboard-desc">
                View and manage submitted applications requiring verification.
              </p>
            </div>

            <div className="page-card verifier-attention-card">
              <h4 className="verifier-application-list-title">
                Application List
              </h4>

              <div className="verifier-application-toolbar">
                <div className="verifier-application-search">
                  <input
                    type="text"
                    className="form-control verifier-application-search-input"
                    placeholder="Search applicant name or ID"
                    value={search}
                    onChange={(e) => {
                      setSearch(e.target.value);
                      setCurrentPage(1);
                    }}
                  />
                </div>

                <div className="verifier-application-filter-tabs">
                  {STATUS_TABS.map((tab) => (
                    <button
                      key={tab.key}
                      type="button"
                      className={`verifier-application-filter-btn ${
                        statusTab === tab.key
                          ? "verifier-application-filter-btn-active"
                          : ""
                      }`}
                      onClick={() => handleTabChange(tab.key)}
                    >
                      <span>{tab.label}</span>

                      <span
                        className={`verifier-application-filter-count verifier-application-filter-count-${tab.key}`}
                      >
                        {counts[tab.key]}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="table-responsive verifier-attention-table-wrap">
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
                          <div
                            className="spinner-border text-danger"
                            role="status"
                          />
                        </td>
                      </tr>
                    ) : pagedApplications.length > 0 ? (
                      pagedApplications.map((app) => (
                        <tr key={app.id}>
                          <td>
                            {app.control_number ?? `APP-${app.id}`}
                          </td>

                          <td>{app.name}</td>

                          <td>
                            {app.submitted_at?.split("T")[0]}
                          </td>

                          <td>
                            <StatusBadge app={app} />
                          </td>

                          <td className="verifier-attention-action">
                            <Link
                              to={`/VerifierApplicationReview/${app.id}`}
                              className="verifier-review-btn"
                            >
                              {["approved", "rejected"].includes(
                                app.status
                              )
                                ? "View"
                                : "Review"}
                            </Link>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td
                          colSpan="5"
                          className="text-center text-muted"
                        >
                          No applications found.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {!loading && filtered.length > 0 && (
                <div className="verifier-table-pagination-bar">
                  <span className="verifier-table-pagination-info">
                    Showing {pageStart + 1}–
                    {Math.min(
                      pageStart + perPage,
                      filtered.length
                    )}{" "}
                    of {filtered.length} applications
                  </span>

                  <div className="verifier-table-pagination-controls">
                    <button
                      type="button"
                      className="verifier-table-pagination-arrow"
                      onClick={() => goToPage(currentPage - 1)}
                      disabled={currentPage === 1}
                      aria-label="Previous page"
                    >
                      ‹
                    </button>

                    {getPageNumbers().map((page, idx) =>
                      page === "..." ? (
                        <span
                          key={`ellipsis-${idx}`}
                          className="verifier-table-pagination-ellipsis"
                        >
                          …
                        </span>
                      ) : (
                        <button
                          type="button"
                          key={page}
                          className={`verifier-table-pagination-page ${
                            page === currentPage
                              ? "verifier-table-pagination-page-active"
                              : ""
                          }`}
                          onClick={() => goToPage(page)}
                        >
                          {page}
                        </button>
                      )
                    )}

                    <button
                      type="button"
                      className="verifier-table-pagination-arrow"
                      onClick={() => goToPage(currentPage + 1)}
                      disabled={currentPage === totalPages}
                      aria-label="Next page"
                    >
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

export default VerifierApplicationList;