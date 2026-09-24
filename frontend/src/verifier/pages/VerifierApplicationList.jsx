import { useState, useEffect, useCallback, useRef } from "react";
import { Link, useSearchParams, useLocation } from "react-router-dom";
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
// of raw statuses, and ordered by priority rather than alphabetically or
// by pipeline order:
//   1. "primary" — For Review. This IS the job; it gets first position
//      and its own bigger, always-colored (not just outlined) styling so
//      it visually dominates the row instead of reading as one pill among
//      many equal-weight options.
//   2. "action" — other things the verifier is actively waiting on or
//      needs to notice, but isn't their next click.
//   3. "resolved" — past decisions, kept for reference only.
//   4. "all" — a reset/audit view, not a daily-use queue, so it's last
//      and styled quieter than the rest instead of leading the row.
const STATUS_TABS = [
  { key: "for_review", label: "For Review", group: "primary" },
  // Within "action", ordered by urgency: a stuck OCR failure sits right
  // next to For Review since it blocks that same review from happening
  // at all, ahead of an appeal (also needs a human decision, but isn't
  // blocking anything) and the purely informational waiting statuses
  // below (applicant hasn't re-uploaded yet, or OCR is still
  // auto-processing).
  { key: "ocr_failed", label: "OCR Failed", group: "action" },
  { key: "appeal_requested", label: "Appeal Requested", group: "action" },
  // reupload_requested (verifier flagged it) and auto_reupload_requested
  // (system flagged it) both mean the exact same thing operationally —
  // nothing for the verifier to do until the applicant re-uploads — so
  // they're one combined tab instead of two the verifier has to check
  // separately.
  { key: "awaiting_applicant", label: "Awaiting Applicant", group: "action" },
  { key: "pending_prescreening", label: "Pending", group: "action" },
  { key: "approved", label: "Approved", group: "resolved" },
  { key: "rejected", label: "Rejected", group: "resolved" },
  { key: "all", label: "All", group: "all" },
];

const AWAITING_APPLICANT_STATUSES = ["reupload_requested", "auto_reupload_requested"];

function VerifierApplicationList() {
  const [searchParams] = useSearchParams();
  const location = useLocation();

  // Returning from a reviewed application (via its Back button) carries
  // the tab/page/scroll we left off at in location.state -- restore
  // that in preference to everything else, since it's the one case
  // where NOT defaulting to "For Review" is actually what the verifier
  // wants (they deliberately picked a different tab before clicking in).
  // A fresh arrival (sidebar nav, a dashboard deep-link) has no
  // location.state at all, so it falls through to the existing
  // ?tab= query param, then finally the "for_review" default -- neither
  // of those paths changes for a first-time visit.
  const restoredState = location.state?.verifierListRestore;
  const requestedTab = searchParams.get("tab");
  const initialTab = restoredState?.tab
    ?? (STATUS_TABS.some((t) => t.key === requestedTab) ? requestedTab : "for_review");
  const initialPage = restoredState?.page ?? 1;

  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusTab, setStatusTab] = useState(initialTab);
  const [currentPage, setCurrentPage] = useState(initialPage);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [retryingOcr, setRetryingOcr] = useState(false);
  const [retryMessage, setRetryMessage] = useState("");
  const hasRestoredScroll = useRef(false);

  const perPage = 20;

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

  // Restores scroll position when returning from a reviewed application
  // -- only once per mount (hasRestoredScroll guards against usePolling's
  // periodic refetches re-triggering this after the verifier has already
  // scrolled elsewhere), and only when this navigation actually came from
  // a review page's Back button (restoredState present) with a saved
  // position to go with it. Cleared from sessionStorage immediately after
  // use so it can't leak into some later, unrelated fresh visit.
  useEffect(() => {
    if (loading || hasRestoredScroll.current || !restoredState) return;
    const savedScrollY = sessionStorage.getItem("verifierListScrollY");
    if (savedScrollY === null) return;
    hasRestoredScroll.current = true;
    sessionStorage.removeItem("verifierListScrollY");
    window.scrollTo({ top: Number(savedScrollY), behavior: "auto" });
  }, [loading, restoredState]);

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

  async function handleRetryAllFailedOcr() {
    setRetryingOcr(true);
    setRetryMessage("");

    try {
      const res = await api.post("/verifier/documents/retry-failed-ocr");
      setRetryMessage(res.data.message);
      await fetchData();
    } catch {
      setRetryMessage("Failed to queue OCR retries.");
    } finally {
      setRetryingOcr(false);
    }
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
              <div className="verifier-application-list-header">
                <h4 className="verifier-application-list-title">
                  Application List
                </h4>

                {/* Only worth showing once there's something to retry --
                    kept visible through an in-flight retry and its result
                    message even if the count has already dropped to 0 by
                    then (documents flip to 'pending' as soon as they're
                    queued), so the button doesn't vanish out from under a
                    click the verifier just made. */}
                {(counts.ocr_failed > 0 || retryingOcr || retryMessage) && (
                  <div className="verifier-retry-all-ocr-wrap">
                    <button
                      type="button"
                      className="verifier-retry-all-ocr-btn"
                      onClick={handleRetryAllFailedOcr}
                      disabled={retryingOcr || counts.ocr_failed === 0}
                      title="Re-queue OCR for every failed document"
                    >
                      {retryingOcr ? "Retrying OCR..." : "Retry All Failed OCR"}
                    </button>

                    {retryMessage && (
                      <span className="verifier-retry-all-ocr-msg">
                        {retryMessage}
                      </span>
                    )}
                  </div>
                )}
              </div>

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
                    // A divider renders once at each group boundary —
                    // primary → action → resolved → all — so the row
                    // reads as distinct clusters by priority instead of
                    // one undifferentiated line of equal-weight buttons.
                    const showDivider =
                      idx > 0 && tab.group !== STATUS_TABS[idx - 1].group;

                    return (
                      <div key={tab.key} className="verifier-application-filter-tab-wrap">
                        {showDivider && (
                          <span className="verifier-application-filter-divider" aria-hidden="true" />
                        )}
                        <button
                          type="button"
                          className={`verifier-application-filter-btn verifier-application-filter-btn-${tab.group} ${statusTab === tab.key
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
                    <col style={{ width: "12%" }} />
                    <col style={{ width: "29%" }} />
                    <col style={{ width: "25%" }} />
                    <col style={{ width: "19%" }} />
                    <col style={{ width: "9%" }} />
                  </colgroup>

                  <thead>
                    <tr>
                      <th
                        className="text-center"
                        title="Order by submission time within this filtered list"
                      >
                        #
                      </th>
                      <th className="text-center">Application ID</th>
                      <th>Applicant Name</th>
                      <th>Submission Date &amp; Time</th>
                      <th className="text-center">Status</th>
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
                          <td className="text-center">{pageStart + idx + 1}</td>

                          <td className="text-center">
                            {`APP-${app.id}`}
                          </td>

                          <td>{app.name}</td>

                          <td>
                            <RelativeTime value={app.submitted_at} showSeconds />
                          </td>

                          <td className="text-center">
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
                              state={{
                                verifierListRestore: {
                                  tab: statusTab,
                                  page: currentPage,
                                },
                              }}
                              // scrollY is captured here, at click time, rather
                              // than embedded in the state object above --
                              // this component never re-renders on scroll, so
                              // a value read during JSX render would reflect
                              // whatever position was current at the LAST
                              // re-render, not necessarily where the verifier
                              // actually was when they clicked.
                              onClick={() =>
                                sessionStorage.setItem(
                                  "verifierListScrollY",
                                  String(window.scrollY)
                                )
                              }
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