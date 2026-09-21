import { useEffect, useState, useMemo } from "react";
import AdminNavigation from "../components/AdminNavigation";
import AdminTopbarUser from "../components/AdminTopbarUser";
import api from "../../services/api";
import { useAuth } from "../../context/AuthContext";
import PanelFooter from "../../components/PanelFooter";

// Every action string actually passed to AuditLog::record() (or logged
// via the equivalent plain-array pattern in AuthController/
// PasswordResetController) across the backend — kept in sync with that
// so a new action never silently falls back to ActionBadge's raw
// snake_case + gray-badge default.
const ACTION_CONFIG = {
  login: { label: "Logged In", badge: "bg-primary" },
  logout: { label: "Logged Out", badge: "bg-secondary" },
  login_failed: { label: "Failed Login", badge: "bg-danger" },
  page_visited: { label: "Page Visit", badge: "bg-secondary" },
  password_changed: { label: "Password Changed", badge: "bg-warning text-dark" },
  password_reset: { label: "Password Reset", badge: "bg-warning text-dark" },
  account_updated: { label: "Account Updated", badge: "bg-primary" },
  profile_completed: { label: "Profile Completed", badge: "bg-success" },
  profile_updated: { label: "Profile Updated", badge: "bg-primary" },
  consent: { label: "Consent Recorded", badge: "bg-secondary" },
  application_submitted: { label: "Application Submitted", badge: "bg-success" },
  application_updated: { label: "Application Updated", badge: "bg-primary" },
  application_approved: { label: "Application Approved", badge: "bg-success" },
  application_rejected: { label: "Application Rejected", badge: "bg-danger" },
  application_reupload_requested: { label: "Re-upload Requested", badge: "bg-warning text-dark" },
  application_not_selected: { label: "Not Selected (Waitlist)", badge: "bg-secondary" },
  application_appeal_requested: { label: "Appeal Requested", badge: "bg-warning text-dark" },
  application_appeal_approved: { label: "Appeal Approved", badge: "bg-success" },
  application_appeal_denied: { label: "Appeal Denied", badge: "bg-danger" },
  auto_reupload_flagged: { label: "Auto Re-upload Flagged", badge: "bg-warning text-dark" },
  document_reuploaded: { label: "Document Re-uploaded", badge: "bg-primary" },
  face_verification_registered: { label: "Face Verification (Registered)", badge: "bg-success" },
  face_verification_claiming: { label: "Face Verification (Claiming)", badge: "bg-primary" },
  face_verification_reverified: { label: "Face Re-verified", badge: "bg-primary" },
  claim_status_updated: { label: "Claim Status Updated", badge: "bg-primary" },
  claiming_missed_slot: { label: "Missed Claiming Slot", badge: "bg-danger" },
  claiming_unclaimed_final: { label: "Marked Unclaimed", badge: "bg-danger" },
  application_period_created: { label: "Application Period Created", badge: "bg-success" },
  application_period_updated: { label: "Application Period Updated", badge: "bg-primary" },
  application_period_extended: { label: "Application Period Extended", badge: "bg-primary" },
  schedule_saved: { label: "Scheduled Claiming Saved", badge: "bg-primary" },
  schedule_activated: { label: "Schedule Activated", badge: "bg-success" },
  late_claiming_updated: { label: "Late Claiming Updated", badge: "bg-primary" },
  lane_verifier_assigned: { label: "Lane Verifier Assigned", badge: "bg-primary" },
  lane_request_dismissed: { label: "Lane Request Dismissed", badge: "bg-secondary" },
  personnel_created: { label: "Personnel Created", badge: "bg-success" },
  personnel_updated: { label: "Personnel Updated", badge: "bg-primary" },
  personnel_status_changed: { label: "Status Changed", badge: "bg-warning text-dark" },
  personnel_deleted: { label: "Personnel Deleted", badge: "bg-danger" },
  personnel_password_reset: { label: "Personnel Password Reset", badge: "bg-warning text-dark" },
  personnel_account_activated: { label: "Account Activated", badge: "bg-success" },
  backup_run: { label: "Backup Run", badge: "bg-secondary" },
  backup_run_failed: { label: "Backup Failed", badge: "bg-danger" },
};

const ROLE_LABELS = {
  sk_admin: "Admin",
  sk_verifier: "Verifier",
  superadmin: "Superadmin",
  it_support: "IT Support",
};

function ActionBadge({ action }) {
  const config = ACTION_CONFIG[action] || { label: action, badge: "bg-secondary" };
  // Bootstrap's .badge forces white-space: nowrap, which made a long
  // label (e.g. "Application Period Extended") spill past its cell into
  // the Description column instead of wrapping — several labels here are
  // long enough to hit this, not just that one.
  return <span className={`badge ${config.badge}`} style={{ whiteSpace: "normal" }}>{config.label}</span>;
}

function RoleBadge({ role }) {
  const className = role === "sk_verifier" ? "role-verifier" : "role-admin";
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

// Combined activity log for Admin and Verifier accounts only.
// Applicant activity is intentionally excluded from this view.
function AdminMasterActivityLog() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
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
        `${log.user?.first_name} ${log.user?.last_name}`.toLowerCase().includes(query.toLowerCase());
      const matchesAction = actionFilter === "all" || log.action === actionFilter;
      const matchesRole =
        roleFilter === "all" ||
        (roleFilter === "me" && log.user?.id === currentUser?.id) ||
        (roleFilter === "sk_admin" && log.user?.role === "sk_admin" && log.user?.id !== currentUser?.id) ||
        (roleFilter === "sk_verifier" && log.user?.role === "sk_verifier") ||
        (roleFilter === "superadmin" && log.user?.role === "superadmin" && log.user?.id !== currentUser?.id) ||
        (roleFilter === "it_support" && log.user?.role === "it_support");
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
      <AdminNavigation
        mobileOpen={mobileMenuOpen}
        onMobileClose={() => setMobileMenuOpen(false)}
      />
      <div className="admin-main">
        <div className="admin-topbar">
          <AdminTopbarUser onMenuOpen={() => setMobileMenuOpen(true)} />
        </div>

        <section className="page-section">
          <div className="container-fluid">

            <div className="page-card">
              <h3 className="section-title mb-2">System Activity Log</h3>
              <p className="text-muted mb-0">
                Combined activity from Admin, Verifier, Superadmin, and IT Support accounts. Applicant activity is tracked separately.
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
                    placeholder="Search by username or description"
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
                    <option value="me">Me (Superadmin)</option>
                    <option value="sk_admin">Admin</option>
                    <option value="sk_verifier">Verifier</option>
                    <option value="superadmin">Superadmin</option>
                    <option value="it_support">IT Support</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="page-card">
              <h4 className="sub-title sub-title-dark">Recent Activity Log</h4>

              <div className="table-responsive">
                <table className="table table-bordered table-striped align-middle announcement-table">
                  <colgroup>
                    <col style={{ width: "13%" }} />
                    <col style={{ width: "12%" }} />
                    <col style={{ width: "13%" }} />
                    <col style={{ width: "20%" }} />
                    <col style={{ width: "42%" }} />
                  </colgroup>
                  <thead>
                    <tr>
                      <th>Date &amp; Time</th>
                      <th>Username</th>
                      <th>Role</th>
                      <th>Action</th>
                      <th>Description</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr>
                        <td colSpan={5} className="text-center py-4">
                          <div className="spinner-border text-danger" role="status" />
                        </td>
                      </tr>
                    ) : filteredLogs.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="text-center text-muted py-4">
                          No activity found.
                        </td>
                      </tr>
                    ) : (
                      pagedLogs.map((log) => (
                        <tr key={log.id}>
                          <td>{formatTimestamp(log.created_at)}</td>
                          <td>
                            {log.user
                              ? `${log.user.first_name} ${log.user.last_name}`
                              : <span className="text-muted fst-italic">Deleted user</span>}
                          </td>
                          <td>{log.user && <RoleBadge role={log.user.role} />}</td>
                          <td><ActionBadge action={log.action} /></td>
                          <td>{log.description}</td>
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