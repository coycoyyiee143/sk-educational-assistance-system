import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import VerifierNavigation from "../components/VerifierNavigation";
import VerifierTopbar from "../components/VerifierTopbar";
import api from "../../services/api";
import { usePolling } from "../../hooks/usePolling";

import {
  getVerifierStatusLabel,
  getVerifierBadgeClass,
} from "../../components/StatusConstants";
import PanelFooter from "../../components/PanelFooter";
import RelativeTime from "../../components/RelativeTime";

function StatusBadge({ app }) {
  return (
    <span className={`status-badge ${getVerifierBadgeClass(app)}`}>
      {getVerifierStatusLabel(app)}
    </span>
  );
}

// Grouped by what the verifier actually needs to do, not just a flat list
// of raw statuses: "action" tabs are things sitting in the verifier's own
// queue right now, "resolved" tabs are past decisions kept around for
// reference. A visual divider separates the two groups in the toolbar.
const STATUS_TABS = [
  { key: "all", label: "All", group: "action" },
  { key: "for_review", label: "For Review", group: "action" },
  // reupload_requested (verifier flagged it) and auto_reupload_requested
  // (system flagged it) both mean the exact same thing operationally —
  // nothing for the verifier to do until the applicant re-uploads — so
  // they're one combined tab instead of two the verifier has to check
  // separately.
  { key: "awaiting_applicant", label: "Awaiting Applicant", group: "action" },
  { key: "pending_prescreening", label: "Pending", group: "action" },
  { key: "ocr_failed", label: "OCR Failed", group: "action" },
  { key: "appeal_requested", label: "Appeal Requested", group: "action" },
  { key: "approved", label: "Approved", group: "resolved" },
  { key: "rejected", label: "Rejected", group: "resolved" },
];

const AWAITING_APPLICANT_STATUSES = ["reupload_requested", "auto_reupload_requested"];

function VerifierApplicationList() {
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusTab, setStatusTab] = useState("for_review");
  const [currentPage, setCurrentPage] = useState(1);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const perPage = 10;

  // async + awaited so usePolling's overlap guard below knows when this
  // actually finishes, not just when it starts.
  const fetchData = useCallback(async () => {
    try {
      const res = await api.get("/verifier/applications");
      setApplications(res.data);
    } catch {
      // Silent on poll ticks — a failed refresh just retries next
      // interval.
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Was a raw setInterval(fetchData, 10000) with no guards. This list
  // is another all-day-open tab for verifiers, so pausing while the
  // tab is backgrounded and never overlapping requests matters here.
  usePolling(fetchData, { intervalMs: 10000 });

  const counts = {
    all: applications.length,
    for_review: applications.filter((a) => a.status === "for_review").length,
    awaiting_applicant: applications.filter((a) =>
      AWAITING_APPLICANT_STATUSES.includes(a.status)
    ).length,
    pending_prescreening: applications.filter(
      (a) => a.status === "pending_prescreening"
    ).length,
    approved: applications.filter((a) => a.status === "approved").length,
    rejected: applications.filter((a) => a.status === "rejected").length,
    appeal_requested: applications.filter(
      (a) => a.status === "appeal_requested"
    ).length,
    ocr_failed: applications.filter(
      (a) => a.failed_documents_count > 0
    ).length,
  };

  const filtered = applications
    .filter((app) => {
      if (statusTab === "all") return true;
      if (statusTab === "ocr_failed") return app.failed_documents_count > 0;
      if (statusTab === "awaiting_applicant")
        return AWAITING_APPLICANT_STATUSES.includes(app.status);
      return app.status === statusTab;
    })
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
                  {STATUS_TABS.map((tab, idx) => {
                    // A divider renders once, right where the tabs switch
                    // from "needs action" to "already decided" — makes the
                    // two clusters read as distinct groups instead of one
                    // undifferentiated row of buttons.
                    const isFirstResolvedTab =
                      tab.group === "resolved" &&
                      STATUS_TABS[idx - 1]?.group !== "resolved";

                    return (
                      <div key={tab.key} className="verifier-application-filter-tab-wrap">
                        {isFirstResolvedTab && (
                          <span className="verifier-application-filter-divider" aria-hidden="true" />
                        )}
                        <button
                          type="button"
                          className={`verifier-application-filter-btn ${statusTab === tab.key
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
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="table-responsive verifier-attention-table-wrap">
                <table className="table table-bordered table-striped align-middle verifier-attention-table">
                  <colgroup>
                    <col style={{ width: "6%" }} />
                    <col style={{ width: "17%" }} />
                    <col style={{ width: "24%" }} />
                    <col style={{ width: "21%" }} />
                    <col style={{ width: "19%" }} />
                    <col style={{ width: "13%" }} />
                  </colgroup>

                  <thead>
                    <tr>
                      <th title="Order by submission time within this filtered list">
                        #
                      </th>
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
                        <td colSpan="6" className="text-center py-4">
                          <div
                            className="spinner-border text-danger"
                            role="status"
                          />
                        </td>
                      </tr>
                    ) : pagedApplications.length > 0 ? (
                      pagedApplications.map((app, idx) => (
                        <tr key={app.id}>
                          <td>{pageStart + idx + 1}</td>

                          <td>
                            {`APP-${app.id}`}
                          </td>

                          <td>{app.name}</td>

                          <td>
                            <RelativeTime value={app.submitted_at} />
                          </td>

                          <td>
                            <StatusBadge app={app} />
                            {app.failed_documents_count > 0 && (
                              <span
                                className="status-badge verifier-ocr-failed-badge"
                                title={`${app.failed_documents_count} document${app.failed_documents_count === 1 ? "" : "s"} failed OCR processing`}
                              >
                                OCR Failed
                              </span>
                            )}
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
                          colSpan="6"
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
                          className={`verifier-table-pagination-page ${page === currentPage
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