import { useEffect, useState } from "react";
import ApplicantNavigation from "../components/ApplicantNavigation";
import { useAuth } from "../../context/AuthContext";
import api from "../../services/api";
import { STATUS_CONFIG } from "../../components/StatusConstants";

function ApplicantDashboard() {
  const { user } = useAuth();
  const [application, setApplication] = useState(null);
  const [config, setConfig] = useState(null);
  const [loadingApp, setLoadingApp] = useState(true);
  const [loadingConfig, setLoadingConfig] = useState(true);

  useEffect(() => {
    api.get("/applications")
      .then((res) => setApplication(res.data[0] ?? null))
      .catch(() => { })
      .finally(() => setLoadingApp(false));

    api.get("/application-config/active")
      .then((res) => setConfig(res.data))
      .catch(() => { })
      .finally(() => setLoadingConfig(false));
  }, []);

  const statusBadge = {
    pending_prescreening: "secondary",
    for_review: "warning",
    approved: "success",
    rejected: "danger",
    reupload_requested: "info",
  };

  return (
    <div>
      <ApplicantNavigation />

      <section className="dashboard-section">
        <div className="container">

          <div className="welcome-box">
            <h3 className="section-title mb-2">Applicant Dashboard</h3>
            <p className="mb-0">Welcome back, {user?.first_name}! Monitor your application status and recent updates.</p>
          </div>

          <div className="row g-4">

            {/* Application Status */}
            <div className="col-md-6">
              <div className="dashboard-card">
                <h5>Current Application Status</h5>
                {loadingApp ? (
                  <div className="spinner-border spinner-border-sm text-danger" />
                ) : application ? (
                  <>
                    <span className={`badge bg-${statusBadge[application.status] ?? "secondary"} mb-2`}>
                      {STATUS_CONFIG[application.status]?.label ?? application.status}
                    </span>
                    <p className="mb-0 text-muted">
                      {application.status === "approved"
                        ? "Congratulations! Your application has been approved."
                        : application.status === "rejected"
                          ? "Your application was not approved. Please contact the SK office."
                          : application.status === "reupload_requested"
                            ? "Please re-upload your documents as requested."
                            : "Your application is currently being processed."}
                    </p>
                  </>
                ) : (
                  <p className="text-muted mb-0">You have not submitted an application yet.</p>
                )}
              </div>
            </div>

            {/* Active Application Period */}
            <div className="col-md-6">
              <div className="dashboard-card">
                <h5>Application Period</h5>
                {loadingConfig ? (
                  <div className="spinner-border spinner-border-sm text-danger" />
                ) : config ? (
                  <>
                    <p className="mb-1"><strong>School Year:</strong> {config.school_year}</p>
                    <p className="mb-1"><strong>Semester:</strong> {config.semester}</p>
                    <p className="mb-1"><strong>Open:</strong> {config.open_date}</p>
                    <p className="mb-1"><strong>Close:</strong> {config.close_date}</p>
                    <p className="mb-0"><strong>Slots Available:</strong> {config.total_slots - config.used_slots} / {config.total_slots}</p>
                  </>
                ) : (
                  <p className="text-muted mb-0">No active application period at this time.</p>
                )}
              </div>
            </div>

          </div>

        </div>
      </section>

      <footer>
        <div className="container">
          <p className="mb-0">© 2026 Sangguniang Kabataan of Barangay Mamatid | Educational Assistance Application System</p>
        </div>
      </footer>
    </div>
  );
}

export default ApplicantDashboard;