import { useEffect, useState, useMemo } from "react";
import AdminNavigation from "../components/AdminNavigation";
import api from "../../services/api";
import { useAuth } from "../../context/AuthContext";
import PanelFooter from "../../components/PanelFooter";

const ACTION_CONFIG = {
  login: { label: "Logged In", badge: "bg-primary" },
  logout: { label: "Logged Out", badge: "bg-secondary" },
  login_failed: { label: "Failed Login", badge: "bg-danger" },
  page_visited: { label: "Page Visit", badge: "bg-secondary" },
  password_changed: { label: "Password Changed", badge: "bg-warning text-dark" },
  application_approved: { label: "Application Approved", badge: "bg-success" },
  application_rejected: { label: "Application Rejected", badge: "bg-danger" },
  application_reupload_requested: { label: "Re-upload Requested", badge: "bg-warning text-dark" },
  claim_status_updated: { label: "Claim Status Updated", badge: "bg-primary" },
  personnel_created: { label: "Personnel Created", badge: "bg-success" },
  personnel_updated: { label: "Personnel Updated", badge: "bg-primary" },
  personnel_status_changed: { label: "Status Changed", badge: "bg-warning text-dark" },
  personnel_deleted: { label: "Personnel Deleted", badge: "bg-danger" },
};

const ROLE_LABELS = {
  sk_admin: "Admin",
  sk_verifier: "Verifier",
};

function ActionBadge({ action }) {
  const config = ACTION_CONFIG[action] || { label: action, badge: "bg-secondary" };
  return <span className={`badge ${config.badge}`}>{config.label}</span>;
}

function RoleBadge({ role }) {
  const className = role === "sk_admin" ? "role-admin" : "role-verifier";
  return <span className={className}>{ROLE_LABELS[role] || role}</span>;
}

function formatTimestamp(dateString) {
  if (!dateString) return "—";
  try {
    const date = new Date(dateString);
    return date.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  } catch {
    return dateString;
  }
}

// Replaces the user's full name at the start of the description with "You"
// when the log entry belongs to the currently logged-in admin.
function formatDescription(log, currentUser) {
  if (!log.description || !log.user || !currentUser) return log.description;
  if (log.user.id !== currentUser.id) return log.description;

  const fullName = `${log.user.first_name} ${log.user.last_name}`;
  if (log.description.startsWith(fullName)) {
    return "You" + log.description.slice(fullName.length);
  }

  return log.description;
}

// Combined activity log for Admin and Verifier accounts only.
// Applicant activity is intentionally excluded from this view.
function AdminMasterActivityLog() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [actionFilter, setActionFilter] = useState("all");
  const [roleFilter, setRoleFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const perPage = 10;
  const { user: currentUser } = useAuth();

  useEffect(() => {
    setLoading(true);
    api.get("/admin/master-activity-log")
      .then((res) => setLogs(res.data.data || res.data))
      .catch(() => setError("Failed to load system activity log."))
      .finally(() => setLoading(false));
  }, []);

  const actionTypes = useMemo(() => [...new Set(logs.map((l) => l.action))], [logs]);

  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      const matchesQuery =
        query.trim() === "" ||
        log.description?.toLowerCase().includes(query.toLowerCase()) ||
        log.ip_address?.includes(query) ||
        `${log.user?.first_name} ${log.user?.last_name}`.toLowerCase().includes(query.toLowerCase());
      const matchesAction = actionFilter === "all" || log.action === actionFilter;
      const matchesRole =
        roleFilter === "all" ||
        (roleFilter === "me" && log.user?.id === currentUser?.id) ||
        (roleFilter === "sk_admin" && log.user?.role === "sk_admin" && log.user?.id !== currentUser?.id) ||
        (roleFilter === "sk_verifier" && log.user?.role === "sk_verifier");
      return matchesQuery && matchesAction && matchesRole;
    });
  }, [logs, query, actionFilter, roleFilter, currentUser]);

  const totalPages = Math.max(1, Math.ceil(filteredLogs.length / perPage));
  const pageStart = (currentPage - 1) * perPage;
  const pagedLogs = filteredLogs.slice(pageStart, pageStart + perPage);

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
    <div className="admin-layout">
      <AdminNavigation />
      <div className="admin-main">
        <div className="admin-topbar">
          <div className="admin-topbar-user">
            <div className="admin-topbar-user-text">
              <span className="admin-topbar-user-name">Admin User</span>
              <span className="admin-topbar-user-role">Sangguniang Kabataan</span>
            </div>
            <div className="admin-topbar-avatar"></div>
          </div>
        </div>

        <section className="page-section">
          <div className="container-fluid">

            <div className="page-card">
              <h3 className="section-title mb-2">System Activity Log</h3>
              <p className="text-muted mb-0">
                Combined activity from Admin and Verifier accounts. Applicant activity is tracked separately.
              </p>
            </div>

            {error && <div className="error-box">{error}</div>}

            <div className="search-box mb-4">
              <div className="row g-3">
                <div className="col-md-6">
                  <label className="form-label">Search</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Search by username, description, or IP address"
                    value={query}
                    onChange={(e) => {
                      setQuery(e.target.value);
                      setCurrentPage(1);
                    }}
                  />
                </div>
                <div className="col-md-3">
                  <label className="form-label">Action Type</label>
                  <select
                    className="form-select"
                    value={actionFilter}
                    onChange={(e) => {
                      setActionFilter(e.target.value);
                      setCurrentPage(1);
                    }}
                  >
                    <option value="all">All Actions</option>
                    {actionTypes.map((a) => (
                      <option key={a} value={a}>
                        {(ACTION_CONFIG[a] || { label: a }).label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="col-md-3">
                  <label className="form-label">Role</label>
                  <select
                    className="form-select"
                    value={roleFilter}
                    onChange={(e) => {
                      setRoleFilter(e.target.value);
                      setCurrentPage(1);
                    }}
                  >
                    <option value="all">All Roles</option>
                    <option value="me">Me (Admin)</option>
                    <option value="sk_admin">Admin</option>
                    <option value="sk_verifier">Verifier</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="page-card">
              <h4 className="sub-title sub-title-dark">Recent Activity Log</h4>

              <div className="table-responsive">
                <table className="table table-bordered table-striped align-middle announcement-table">
                  <colgroup>
                    <col style={{ width: "16%" }} />
                    <col style={{ width: "15%" }} />
                    <col style={{ width: "10%" }} />
                    <col style={{ width: "16%" }} />
                    <col style={{ width: "31%" }} />
                    <col style={{ width: "12%" }} />
                  </colgroup>
                  <thead>
                    <tr>
                      <th>Date &amp; Time</th>
                      <th>Username</th>
                      <th>Role</th>
                      <th>Action</th>
                      <th>Description</th>
                      <th>IP Address</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr>
                        <td colSpan={6} className="text-center py-4">
                          <div className="spinner-border text-danger" role="status" />
                        </td>
                      </tr>
                    ) : filteredLogs.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="text-center text-muted py-4">
                          No activity found.
                        </td>
                      </tr>
                    ) : (
                      pagedLogs.map((log) => (
                        <tr key={log.id}>
                          <td>{formatTimestamp(log.created_at)}</td>
                          <td>
                            {log.user
                              ? (log.user.id === currentUser?.id
                                  ? "You"
                                  : `${log.user.first_name} ${log.user.last_name}`)
                              : <span className="text-muted fst-italic">Deleted user</span>}
                          </td>
                          <td>{log.user && <RoleBadge role={log.user.role} />}</td>
                          <td><ActionBadge action={log.action} /></td>
                          <td>{formatDescription(log, currentUser)}</td>
                          <td><code className="small">{log.ip_address}</code></td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {!loading && filteredLogs.length > 0 && (
                <div className="table-pagination-bar">
                  <span className="table-pagination-info">
                    Showing {pageStart + 1}–{Math.min(pageStart + perPage, filteredLogs.length)} of {filteredLogs.length} activities
                  </span>
                  <div className="table-pagination-controls">
                    <button
                      className="table-pagination-arrow"
                      onClick={() => goToPage(currentPage - 1)}
                      disabled={currentPage === 1}
                      aria-label="Previous page"
                    >
                      ‹
                    </button>
                    {getPageNumbers().map((page, idx) =>
                      page === "..." ? (
                        <span key={`ellipsis-${idx}`} className="table-pagination-ellipsis">…</span>
                      ) : (
                        <button
                          key={page}
                          className={`table-pagination-page ${page === currentPage ? "table-pagination-page-active" : ""}`}
                          onClick={() => goToPage(page)}
                        >
                          {page}
                        </button>
                      )
                    )}
                    <button
                      className="table-pagination-arrow"
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

export default AdminMasterActivityLog;