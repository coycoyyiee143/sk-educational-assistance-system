import { useState, useEffect } from "react";
import AdminNavigation from "../components/AdminNavigation";
import AdminTopbarUser from "../components/AdminTopbarUser";
import api from "../../services/api";
import PanelFooter from "../../components/PanelFooter";

function formatTimestamp(value) {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return value;
  }
}

function formatBytes(bytes) {
  if (!bytes || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}

function AdminSystemMaintenance() {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    api.get("/admin/system-status")
      .then((res) => setStatus(res.data))
      .catch(() => setError("Failed to load system status."))
      .finally(() => setLoading(false));
  }, []);

  const storagePercentUsed = status?.storage?.total_bytes
    ? Math.round((status.storage.used_bytes / status.storage.total_bytes) * 100)
    : 0;

  return (
    <div className="admin-layout">
      <AdminNavigation />
      <div className="admin-main">
        <div className="admin-topbar">
          <AdminTopbarUser />
        </div>

        <section className="page-section">
          <div className="container-fluid">
            <div className="page-card">
              <h3 className="section-title mb-2">System Maintenance</h3>
              <p className="text-muted mb-0">
                View-only system health snapshot — failed background jobs, database connectivity, and storage usage.
              </p>
            </div>

            {error && <div className="alert alert-danger">{error}</div>}

            {loading ? (
              <div className="d-flex justify-content-center align-items-center" style={{ height: "40vh" }}>
                <div className="spinner-border text-danger" role="status" />
              </div>
            ) : status && (
              <>
                <div className="row g-3 mb-3">
                  <div className="col-md-4">
                    <div className="page-card mb-0 h-100">
                      <h4 className="sub-title sub-title-dark">Database</h4>
                      <span className={`status-badge ${status.database.connected ? "status-active" : "status-inactive"}`}>
                        {status.database.connected ? "Connected" : "Disconnected"}
                      </span>
                    </div>
                  </div>
                  <div className="col-md-4">
                    <div className="page-card mb-0 h-100">
                      <h4 className="sub-title sub-title-dark">Failed Jobs</h4>
                      <p className="mb-0" style={{ fontSize: "24px", fontWeight: 600 }}>
                        {status.failed_jobs.failed_count}
                      </p>
                      <span className="text-muted" style={{ fontSize: "13px" }}>across all queues</span>
                    </div>
                  </div>
                  <div className="col-md-4">
                    <div className="page-card mb-0 h-100">
                      <h4 className="sub-title sub-title-dark">Storage ({status.storage.disk})</h4>
                      <p className="mb-1">
                        {formatBytes(status.storage.used_bytes)} used of {formatBytes(status.storage.total_bytes)} ({storagePercentUsed}%)
                      </p>
                      <div className="progress" style={{ height: "8px" }}>
                        <div
                          className="progress-bar bg-danger"
                          role="progressbar"
                          style={{ width: `${storagePercentUsed}%` }}
                          aria-valuenow={storagePercentUsed}
                          aria-valuemin={0}
                          aria-valuemax={100}
                        />
                      </div>
                      <span className="text-muted" style={{ fontSize: "13px" }}>{formatBytes(status.storage.free_bytes)} free</span>
                    </div>
                  </div>
                </div>

                <div className="page-card">
                  <h4 className="sub-title sub-title-dark">Recent Failed Jobs</h4>
                  <div className="table-responsive">
                    <table className="table table-bordered table-striped align-middle announcement-table">
                      <thead>
                        <tr><th>Queue</th><th>Failed At</th><th>Error</th></tr>
                      </thead>
                      <tbody>
                        {status.failed_jobs.recent_failures.length === 0 ? (
                          <tr><td colSpan={3} className="text-center text-muted py-4">No failed jobs recorded.</td></tr>
                        ) : (
                          status.failed_jobs.recent_failures.map((job) => (
                            <tr key={job.id}>
                              <td>{job.queue}</td>
                              <td>{formatTimestamp(job.failed_at)}</td>
                              <td><code className="small">{job.exception_summary}</code></td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}
          </div>
        </section>
        <PanelFooter />
      </div>
    </div>
  );
}

export default AdminSystemMaintenance;
