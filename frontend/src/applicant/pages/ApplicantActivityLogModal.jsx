import { useEffect, useState, useMemo } from "react";
import api from "../../services/api";
import { useAuth } from "../../context/AuthContext";

const ACTION_CONFIG = {
  login: { label: "Logged In", badge: "bg-primary" },
  logout: { label: "Logged Out", badge: "bg-secondary" },
  login_failed: { label: "Failed Login", badge: "bg-danger" },
  page_visited: { label: "Page Visit", badge: "bg-secondary" },
  application_submitted: { label: "Application Submitted", badge: "bg-success" },
  application_updated: { label: "Application Updated", badge: "bg-primary" },
  document_uploaded: { label: "Document Uploaded", badge: "bg-success" },
  document_reuploaded: { label: "Document Re-uploaded", badge: "bg-warning text-dark" },
  profile_completed: { label: "Profile Completed", badge: "bg-success" },
  profile_updated: { label: "Profile Updated", badge: "bg-primary" },
  account_updated: { label: "Account Updated", badge: "bg-primary" },
  password_changed: { label: "Password Changed", badge: "bg-warning text-dark" },
};

function ActionBadge({ action }) {
  const config = ACTION_CONFIG[action] || { label: action, badge: "bg-secondary" };
  return <span className={`badge ${config.badge}`}>{config.label}</span>;
}

// Since this modal only ever shows the current user's own logs, we can
// safely replace ANY leading name-like text with "You" — this stays correct
// even if the user's name changes after old log entries were recorded.
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

// Modal version of the Activity Log. Only fetches data when opened (show === true).
function ApplicantActivityLogModal({ show, onClose }) {
  const { user: currentUser } = useAuth();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [actionFilter, setActionFilter] = useState("all");

  useEffect(() => {
    if (!show) return;

    setLoading(true);
    setError("");
    api.get("/applications/activity-log")
      .then((res) => setLogs(res.data.data || res.data))
      .catch(() => setError("Failed to load activity log."))
      .finally(() => setLoading(false));
  }, [show]);

  const actionTypes = useMemo(() => [...new Set(logs.map((l) => l.action))], [logs]);

  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      const matchesQuery =
        query.trim() === "" ||
        log.description?.toLowerCase().includes(query.toLowerCase()) ||
        log.ip_address?.includes(query);
      const matchesAction = actionFilter === "all" || log.action === actionFilter;
      return matchesQuery && matchesAction;
    });
  }, [logs, query, actionFilter]);

  if (!show) return null;

  return (
    <>
      <div className="modal-backdrop show" onClick={onClose}></div>

      <div className="modal show d-block" tabIndex="-1" role="dialog">
        <div className="modal-dialog modal-lg modal-dialog-scrollable" role="document">
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title">My Activity Log</h5>
              <button type="button" className="btn-close" onClick={onClose}></button>
            </div>

            <div className="modal-body">
              {error && <div className="error-box">{error}</div>}

              <div className="search-box mb-3">
                <div className="row g-3">
                  <div className="col-md-8">
                    <label className="form-label">Search</label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="Search description or IP address"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                    />
                  </div>
                  <div className="col-md-4">
                    <label className="form-label">Action Type</label>
                    <select
                      className="form-select"
                      value={actionFilter}
                      onChange={(e) => setActionFilter(e.target.value)}
                    >
                      <option value="all">All Actions</option>
                      {actionTypes.map((a) => (
                        <option key={a} value={a}>
                          {(ACTION_CONFIG[a] || { label: a }).label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {loading ? (
                <div className="d-flex justify-content-center py-4">
                  <div className="spinner-border text-danger" />
                </div>
              ) : (
                <div className="table-responsive">
                  <table className="table table-bordered align-middle mb-0">
                    <thead>
                      <tr>
                        <th>Date &amp; Time</th>
                        <th>Action</th>
                        <th>Description</th>
                        <th>IP Address</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredLogs.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="text-center text-muted py-4">
                            No activity found.
                          </td>
                        </tr>
                      ) : (
                        filteredLogs.map((log) => (
                          <tr key={log.id}>
                            <td>{formatTimestamp(log.created_at)}</td>
                            <td><ActionBadge action={log.action} /></td>
                            <td>{formatDescription(log.description)}</td>
                            <td><code className="small">{log.ip_address}</code></td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="modal-footer">
              <button type="button" className="btn btn-secondary-custom" onClick={onClose}>
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