import { useEffect, useState } from "react";
import { getApplicationPeriodStatus } from "../../utils/applicationPeriod";
import ApplicantNavigation from "../components/ApplicantNavigation";
import AnnouncementsCard from "../components/AnnouncementsCard";
import { useAuth } from "../../context/AuthContext";
import api from "../../services/api";
import { STATUS_CONFIG } from "../../components/StatusConstants";

function ApplicantDashboard() {
  const { user } = useAuth();
  const [application, setApplication] = useState(null);
  const [config, setConfig] = useState(null);
  const [loadingApp, setLoadingApp] = useState(true);
  const [loadingConfig, setLoadingConfig] = useState(true);
  const periodStatus = getApplicationPeriodStatus(config);

  useEffect(() => {
    Promise.all([api.get("/applications"), api.get("/application-config/active")])
      .then(([applicationsRes, configRes]) => {
        const currentConfig = configRes.data;
        setApplication(
          applicationsRes.data.find((app) => app.config_id === currentConfig.id) ?? null,
        );
      })
      .catch(() => { })
      .finally(() => setLoadingApp(false));

    api.get("/application-config/active")
      .then((res) => setConfig(res.data))
      .catch(() => { })
      .finally(() => setLoadingConfig(false));
  }, []);

  const currentStatusConfig = application ? STATUS_CONFIG[application.status] : null;

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
                    <span className={`badge ${currentStatusConfig?.badgeClass ?? "status-pending"} mb-2`}>
                      {currentStatusConfig?.applicantLabel ?? application.status}
                    </span>
                    <p className="mb-0 text-muted">
                      {currentStatusConfig?.applicantMessage ?? "Your application is currently being processed."}
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
                {periodStatus === "open" && <span className="badge bg-success mb-2">Open Now</span>}
                {periodStatus === "scheduled" && <span className="badge bg-warning text-dark mb-2">Not Yet Open</span>}
                {periodStatus === "closed" && <span className="badge bg-secondary mb-2">Closed</span>}
                {loadingConfig ? (
                  <div className="spinner-border spinner-border-sm text-danger" />
                ) : config ? (
                  <>
                    <p className="mb-1"><strong>School Year:</strong> {config.school_year}</p>
                    <p className="mb-1">
                      <strong>Application Period:</strong>{" "}
                      {new Date(config.open_date).toLocaleDateString("en-PH", { month: "long", day: "numeric", year: "numeric" })}
                      {" – "}
                      {new Date(config.close_date).toLocaleDateString("en-PH", { month: "long", day: "numeric", year: "numeric" })}
                    </p>
                    <p className="mb-0">
                      {config.is_unlimited ? (
                        <span><strong>Slots:</strong> Unlimited — apply anytime within the period.</span>
                      ) : (
                        <span><strong>Slots Available:</strong> {config.slot_limit - config.slots_filled} / {config.slot_limit}</span>
                      )}
                    </p>
                  </>
                ) : (
                  <p className="text-muted mb-0">No active application period at this time.</p>
                )}
              </div>
            </div>

            {/* Announcements */}
            <div className="col-md-6">
              <AnnouncementsCard />
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