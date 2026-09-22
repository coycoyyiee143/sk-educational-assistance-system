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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [backup, setBackup] = useState(null);
  const [backupLoading, setBackupLoading] = useState(true);
  const [backupError, setBackupError] = useState("");
  const [runningBackup, setRunningBackup] = useState(false);
  const [runBackupMessage, setRunBackupMessage] = useState("");
  const [runBackupSuccess, setRunBackupSuccess] = useState(true);

  const loadBackupStatus = () => {
    setBackupLoading(true);
    api.get("/admin/backup-status")
      .then((res) => setBackup(res.data))
      .catch(() => setBackupError("Failed to load backup status."))
      .finally(() => setBackupLoading(false));
  };

  useEffect(() => {
    api.get("/admin/system-status")
      .then((res) => setStatus(res.data))
      .catch(() => setError("Failed to load system status."))
      .finally(() => setLoading(false));

    loadBackupStatus();
  }, []);

  const handleRunBackup = () => {
    setRunningBackup(true);
    setRunBackupMessage("");
    api.post("/admin/backup-run")
      .then((res) => {
        setRunBackupSuccess(true);
        setRunBackupMessage(res.data?.message || "Backup completed.");
        loadBackupStatus();
      })
      .catch((err) => {
        setRunBackupSuccess(false);
        setRunBackupMessage(err.response?.data?.message || "Backup failed.");
      })
      .finally(() => setRunningBackup(false));
  };

  const latestBackup = backup?.backups?.[0];

  // Backups run daily (see BACKUP.md) — anything older than ~26 hours
  // means the last one or more scheduled runs didn't happen.
  const backupIsStale = latestBackup
    ? Date.now() - new Date(latestBackup.created_at).getTime() > 26 * 60 * 60 * 1000
    : false;
  const backupBadgeLabel = !backup?.configured
    ? "Not Configured"
    : !latestBackup
    ? "No Backups"
    : !latestBackup.complete
    ? "Incomplete"
    : backupIsStale
    ? "Stale"
    : "Up to Date";
  const backupBadgeOk = backup?.configured && latestBackup?.complete && !backupIsStale;

  const storagePercentUsed = status?.storage?.total_bytes
    ? Math.round((status.storage.used_bytes / status.storage.total_bytes) * 100)
    : 0;

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
              <h3 className="section-title mb-2">System Maintenance</h3>
              <p className="text-muted mb-0">
                System health at a glance — database connectivity, failed background jobs, storage usage, and data backups.
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
                  <div className="col-md-3">
                    <div className="page-card mb-0 h-100">
                      <h4 className="sub-title sub-title-dark">Database</h4>
                      <span className={`status-badge ${status.database.connected ? "status-active" : "status-inactive"}`}>
                        {status.database.connected ? "Connected" : "Disconnected"}
                      </span>
                    </div>
                  </div>
                  <div className="col-md-3">
                    <div className="page-card mb-0 h-100">
                      <h4 className="sub-title sub-title-dark">Failed Jobs</h4>
                      <p className="mb-0" style={{ fontSize: "24px", fontWeight: 600 }}>
                        {status.failed_jobs.failed_count}
                      </p>
                      <span className="text-muted" style={{ fontSize: "13px" }}>across all queues</span>
                    </div>
                  </div>
                  <div className="col-md-3">
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
                  <div className="col-md-3">
                    <div className="page-card mb-0 h-100">
                      <h4 className="sub-title sub-title-dark">Backups</h4>
                      {backupLoading ? (
                        <span className="text-muted" style={{ fontSize: "13px" }}>Loading…</span>
                      ) : (
                        <>
                          <span className={`status-badge ${backupBadgeOk ? "status-active" : "status-inactive"}`}>
                            {backupBadgeLabel}
                          </span>
                          {latestBackup && (
                            <div className="text-muted mt-1" style={{ fontSize: "13px" }}>
                              Last: {formatTimestamp(latestBackup.created_at)}
                            </div>
                          )}
                        </>
                      )}
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

                <div className="page-card">
                  <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-1">
                    <div>
                      <h4 className="sub-title sub-title-dark mb-0">Backup History</h4>
                      <p className="text-muted mb-0" style={{ fontSize: "13px" }}>
                        Full database + uploaded-files snapshots. Runs automatically on a schedule — this button is for an extra one, on demand.
                      </p>
                    </div>
                    <button
                      type="button"
                      className="btn btn-danger btn-sm text-nowrap"
                      onClick={handleRunBackup}
                      disabled={runningBackup}
                    >
                      {runningBackup ? "Running…" : "Run Backup Now"}
                    </button>
                  </div>

                  {runBackupMessage && (
                    <div className={`alert ${runBackupSuccess ? "alert-success" : "alert-danger"} py-2 px-3 my-3`} style={{ fontSize: "13px" }}>
                      {runBackupMessage}
                    </div>
                  )}

                  {backupError && <div className="alert alert-danger mt-3">{backupError}</div>}

                  {backupLoading ? (
                    <div className="d-flex justify-content-center align-items-center" style={{ height: "10vh" }}>
                      <div className="spinner-border text-danger" role="status" />
                    </div>
                  ) : backup && !backup.configured ? (
                    <p className="text-muted mb-0 mt-3">
                      Backups are not configured on this server yet. See <code>BACKUP.md</code>.
                    </p>
                  ) : (
                    <>
                      <div className="table-responsive mt-3">
                        <table className="table table-bordered table-striped align-middle announcement-table">
                          <thead>
                            <tr><th>Backup</th><th>Date</th><th>Size</th><th>Status</th></tr>
                          </thead>
                          <tbody>
                            {!backup.backups || backup.backups.length === 0 ? (
                              <tr><td colSpan={4} className="text-center text-muted py-4">No backups recorded.</td></tr>
                            ) : (
                              backup.backups.map((b) => (
                                <tr key={b.name}>
                                  <td><code className="small">{b.name}</code></td>
                                  <td>{formatTimestamp(b.created_at)}</td>
                                  <td>{formatBytes(b.size_bytes)}</td>
                                  <td>
                                    <span className={`status-badge ${b.complete ? "status-active" : "status-inactive"}`}>
                                      {b.complete ? "Complete" : "Incomplete"}
                                    </span>
                                  </td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
                      <p className="text-muted mb-0" style={{ fontSize: "13px" }}>
                        Restoring a backup is a server-side operation — see <code>BACKUP.md</code> for the steps. It is not available from this page.
                      </p>
                    </>
                  )}
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
