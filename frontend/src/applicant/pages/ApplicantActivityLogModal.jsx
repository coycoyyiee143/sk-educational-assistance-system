import { useEffect, useState, useMemo } from "react";
import api from "../../services/api";

const ACTION_CONFIG = {
  login: { label: "Logged In", badge: "bg-primary" },
  logout: { label: "Logged Out", badge: "bg-secondary" },
  login_failed: { label: "Failed Login", badge: "bg-danger" },
  page_visited: { label: "Page Visit", badge: "bg-secondary" },

  application_submitted: {
    label: "Application Submitted",
    badge: "bg-success",
  },

  application_updated: {
    label: "Application Updated",
    badge: "bg-primary",
  },

  document_uploaded: {
    label: "Document Uploaded",
    badge: "bg-success",
  },

  document_reuploaded: {
    label: "Document Re-uploaded",
    badge: "bg-warning text-dark",
  },

  profile_completed: {
    label: "Profile Completed",
    badge: "bg-success",
  },

  profile_updated: {
    label: "Profile Updated",
    badge: "bg-primary",
  },

  account_updated: {
    label: "Account Updated",
    badge: "bg-primary",
  },

  password_changed: {
    label: "Password Changed",
    badge: "bg-warning text-dark",
  },
};

function ActionBadge({ action }) {
  const config = ACTION_CONFIG[action] || {
    label: action,
    badge: "bg-secondary",
  };

  return (
    <span
      className={`badge verifier-activity-badge ${config.badge}`}
    >
      {config.label}
    </span>
  );
}

function formatDescription(description) {
  if (!description) return description;

  const match = description.match(
    /^([A-Za-zÀ-ÖØ-öø-ÿ.'-]+(?:\s[A-Za-zÀ-ÖØ-öø-ÿ.'-]+){0,3})\s(logged|submitted|updated|completed|approved|rejected|requested|marked|uploaded|re-uploaded|changed|created|reset)\b/i
  );

  if (match) {
    return "You " + description.slice(match[1].length + 1);
  }

  return description;
}

function formatTimestamp(dateString) {
  if (!dateString) return "—";

  try {
    const date = new Date(dateString);

    return date.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  } catch {
    return dateString;
  }
}

function ApplicantActivityLogModal({ show, onClose }) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [actionFilter, setActionFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);

  const perPage = 10;

  useEffect(() => {
    if (!show) return;

    setLoading(true);
    setError("");
    setCurrentPage(1);

    api
      .get("/applications/activity-log")
      .then((res) => {
        setLogs(res.data.data || res.data);
      })
      .catch(() => {
        setError("Failed to load activity log.");
      })
      .finally(() => {
        setLoading(false);
      });
  }, [show]);

  const actionTypes = useMemo(() => {
    return [...new Set(logs.map((log) => log.action))];
  }, [logs]);

  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      const matchesQuery =
        query.trim() === "" ||
        log.description
          ?.toLowerCase()
          .includes(query.toLowerCase()) ||
        log.ip_address?.includes(query);

      const matchesAction =
        actionFilter === "all" ||
        log.action === actionFilter;

      return matchesQuery && matchesAction;
    });
  }, [logs, query, actionFilter]);

  const totalPages = Math.max(
    1,
    Math.ceil(filteredLogs.length / perPage)
  );

  const pageStart = (currentPage - 1) * perPage;

  const pagedLogs = filteredLogs.slice(
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
    const end = Math.min(
      totalPages - 1,
      currentPage + 1
    );

    for (let i = start; i <= end; i++) {
      pages.push(i);
    }

    if (currentPage < totalPages - 2) {
      pages.push("...");
    }

    pages.push(totalPages);

    return pages;
  }

  if (!show) return null;

  return (
    <>
      <div
        className="modal-backdrop show"
        onClick={onClose}
      />

      <div
        className="modal show d-block"
        tabIndex="-1"
        role="dialog"
      >
        <div
          className="modal-dialog modal-lg modal-dialog-scrollable verifier-activity-modal-dialog"
          role="document"
        >
          <div className="modal-content verifier-activity-modal">

            {/* HEADER */}
            <div className="verifier-activity-modal-header-new">
              <div className="verifier-activity-modal-heading-new">

                <div className="verifier-activity-modal-icon-new">
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <circle cx="12" cy="12" r="8" />
                    <path d="M12 8v4l3 2" />
                  </svg>
                </div>

                <div className="verifier-activity-modal-title-row">
                  <h5>My Activity Log</h5>

                  <span className="verifier-activity-modal-badge">
                    Audit Trail
                  </span>
                </div>
              </div>

              <button
                type="button"
                className="verifier-activity-modal-close-new"
                onClick={onClose}
                aria-label="Close"
              >
                ×
              </button>
            </div>

            {/* BODY */}
            <div className="modal-body verifier-activity-modal-body">

              {error && (
                <div className="error-box">
                  {error}
                </div>
              )}

              {/* SEARCH / FILTER */}
              <div className="search-box verifier-activity-search-box mb-3">
                <div className="row g-3">

                  <div className="col-md-8">
                    <label className="form-label">
                      Search
                    </label>

                    <input
                      type="text"
                      className="form-control"
                      placeholder="Search description or IP address"
                      value={query}
                      onChange={(e) => {
                        setQuery(e.target.value);
                        setCurrentPage(1);
                      }}
                    />
                  </div>

                  <div className="col-md-4">
                    <label className="form-label">
                      Action Type
                    </label>

                    <select
                      className="form-select"
                      value={actionFilter}
                      onChange={(e) => {
                        setActionFilter(e.target.value);
                        setCurrentPage(1);
                      }}
                    >
                      <option value="all">
                        All Actions
                      </option>

                      {actionTypes.map((action) => (
                        <option
                          key={action}
                          value={action}
                        >
                          {
                            (
                              ACTION_CONFIG[action] || {
                                label: action,
                              }
                            ).label
                          }
                        </option>
                      ))}
                    </select>
                  </div>

                </div>
              </div>

              {/* ACTIVITY TABLE */}
              <div className="verifier-activity-table-scroll">
                <table className="table table-bordered table-striped align-middle verifier-attention-table verifier-activity-table">

                  <colgroup>
                    <col className="verifier-activity-col-date" />
                    <col className="verifier-activity-col-action" />
                    <col className="verifier-activity-col-description" />
                    <col className="verifier-activity-col-ip" />
                  </colgroup>

                  <thead>
                    <tr>
                      <th>Date &amp; Time</th>
                      <th>Action</th>
                      <th>Description</th>
                      <th>IP Address</th>
                    </tr>
                  </thead>

                  <tbody>
                    {loading ? (
                      <tr>
                        <td
                          colSpan="4"
                          className="text-center py-4"
                        >
                          <div
                            className="spinner-border text-danger"
                            role="status"
                          />
                        </td>
                      </tr>
                    ) : pagedLogs.length === 0 ? (
                      <tr>
                        <td
                          colSpan="4"
                          className="text-center text-muted py-4"
                        >
                          No activity found.
                        </td>
                      </tr>
                    ) : (
                      pagedLogs.map((log) => (
                        <tr key={log.id}>
                          <td>
                            {formatTimestamp(
                              log.created_at
                            )}
                          </td>

                          <td>
                            <ActionBadge
                              action={log.action}
                            />
                          </td>

                          <td>
                            {formatDescription(
                              log.description
                            )}
                          </td>

                          <td>
                            <code className="small">
                              {log.ip_address || "—"}
                            </code>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>

                </table>
              </div>

              {/* PAGINATION */}
              {!loading &&
                filteredLogs.length > 0 && (
                  <div className="verifier-table-pagination-bar">

                    <span className="verifier-table-pagination-info">
                      Showing {pageStart + 1}–
                      {Math.min(
                        pageStart + perPage,
                        filteredLogs.length
                      )}{" "}
                      of {filteredLogs.length} activities
                    </span>

                    <div className="verifier-table-pagination-controls">

                      <button
                        type="button"
                        className="verifier-table-pagination-arrow"
                        onClick={() =>
                          goToPage(currentPage - 1)
                        }
                        disabled={currentPage === 1}
                        aria-label="Previous page"
                      >
                        ‹
                      </button>

                      {getPageNumbers().map(
                        (page, index) =>
                          page === "..." ? (
                            <span
                              key={`ellipsis-${index}`}
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
                              onClick={() =>
                                goToPage(page)
                              }
                            >
                              {page}
                            </button>
                          )
                      )}

                      <button
                        type="button"
                        className="verifier-table-pagination-arrow"
                        onClick={() =>
                          goToPage(currentPage + 1)
                        }
                        disabled={
                          currentPage === totalPages
                        }
                        aria-label="Next page"
                      >
                        ›
                      </button>

                    </div>
                  </div>
                )}
            </div>

            {/* FOOTER */}
            <div className="verifier-activity-modal-footer-new">
              <button
                type="button"
                className="btn btn-secondary-custom"
                onClick={onClose}
              >
                Close
              </button>
            </div>

          </div>
        </div>
      </div>
    </>
  );
}

export default ApplicantActivityLogModal;