import { useEffect, useState } from "react";
import { getApplicationPeriodStatus } from "../../utils/applicationPeriod";
import ApplicantNavigation from "../components/ApplicantNavigation";
import AnnouncementsCard from "../components/AnnouncementsCard";
import PanelFooter from "../../components/PanelFooter";
import { useAuth } from "../../context/AuthContext";
import api from "../../services/api";
import { STATUS_CONFIG } from "../../components/StatusConstants";
import ApplicantTopbarUser from "../components/ApplicantTopbarUser";
import ApplicationHistoryList from "../components/ApplicationHistoryList";

function ApplicantDashboard() {
  const { user } = useAuth();

  const [application, setApplication] = useState(null);
  const [applicationHistory, setApplicationHistory] = useState([]);
  const [config, setConfig] = useState(null);
  const [loadingApp, setLoadingApp] = useState(true);
  const [loadingConfig, setLoadingConfig] = useState(true);

  const periodStatus = getApplicationPeriodStatus(config);

  useEffect(() => {
    Promise.all([
      api.get("/applications"),
      api.get("/application-config/active"),
    ])
      .then(([applicationsRes, configRes]) => {
        const applications = applicationsRes.data;
        const currentConfig = configRes.data;

        setApplication(
          applications.find(
            (app) => app.config_id === currentConfig.id
          ) ?? null
        );
        setApplicationHistory(
          applications.filter(
            (app) => app.config_id !== currentConfig.id
          )
        );
      })
      .catch(() => {})
      .finally(() => setLoadingApp(false));

    api
      .get("/application-config/active")
      .then((res) => setConfig(res.data))
      .catch(() => {})
      .finally(() => setLoadingConfig(false));
  }, []);

  async function handleViewHistoricalFile(appId, docId) {
    try {
      const res = await api.get(
        `/applications/${appId}/documents/${docId}/file`,
        { responseType: "blob" }
      );
      const url = URL.createObjectURL(res.data);
      window.open(url, "_blank");
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch {
      alert("Failed to load document.");
    }
  }

  const currentStatusConfig = application
    ? STATUS_CONFIG[application.status]
    : null;

  return (
    <div className="applicant-layout">
      <ApplicantNavigation />

      <div className="applicant-main">
        <div className="applicant-topbar">
          <ApplicantTopbarUser />
        </div>

        <section className="page-section">
          <div className="container-fluid">

            <div className="applicant-dashboard-header">
              <h3 className="applicant-dashboard-title">
                Applicant Dashboard
              </h3>

              <p className="applicant-dashboard-desc">
                Welcome back, {user?.first_name}! Monitor your application
                status and recent updates.
              </p>
            </div>

            <div className="row g-4">

              <div className="col-md-6">
                <div className="page-card h-100">
                  <div className="d-flex justify-content-between align-items-start mb-3">
                    <h4 className="sub-title sub-title-dark mb-0">
                      Current Application Status
                    </h4>

                    <div className="admin-mgmt-icon admin-mgmt-icon-red">
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M9 11l3 3L22 4" />
                        <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />
                      </svg>
                    </div>
                  </div>

                  {loadingApp ? (
                    <div className="spinner-border spinner-border-sm text-danger" />
                  ) : application ? (
                    <>
                      <span
                        className={`badge ${
                          currentStatusConfig?.badgeClass ?? "status-pending"
                        } mb-2`}
                      >
                        {currentStatusConfig?.applicantLabel ??
                          application.status}
                      </span>

                      <p className="mb-0 text-muted">
                        {currentStatusConfig?.applicantMessage ??
                          "Your application is currently being processed."}
                      </p>
                    </>
                  ) : (
                    <p className="text-muted mb-0">
                      You have not submitted an application yet.
                    </p>
                  )}
                </div>
              </div>

              <div className="col-md-6">
                <div className="page-card h-100">
                  <div className="d-flex justify-content-between align-items-start mb-3">
                    <h4 className="sub-title sub-title-dark mb-0">
                      Application Period
                    </h4>

                    <div className="admin-mgmt-icon admin-mgmt-icon-blue">
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <rect
                          x="3"
                          y="4"
                          width="18"
                          height="18"
                          rx="2"
                        />
                        <line x1="16" y1="2" x2="16" y2="6" />
                        <line x1="8" y1="2" x2="8" y2="6" />
                        <line x1="3" y1="10" x2="21" y2="10" />
                      </svg>
                    </div>
                  </div>

                  {periodStatus === "open" && (
                    <span className="badge bg-success mb-2">
                      Open Now
                    </span>
                  )}

                  {periodStatus === "scheduled" && (
                    <span className="badge bg-warning text-dark mb-2">
                      Not Yet Open
                    </span>
                  )}

                  {periodStatus === "closed" && (
                    <span className="badge bg-secondary mb-2">
                      Closed
                    </span>
                  )}

                  {loadingConfig ? (
                    <div className="spinner-border spinner-border-sm text-danger" />
                  ) : config ? (
                    <>
                      <p className="mb-1">
                        <strong>School Year:</strong>{" "}
                        {config.school_year}
                      </p>

                      <p className="mb-1">
                        <strong>Application Period:</strong>{" "}
                        {new Date(config.open_date).toLocaleDateString(
                          "en-PH",
                          {
                            month: "long",
                            day: "numeric",
                            year: "numeric",
                          }
                        )}
                        {" – "}
                        {new Date(config.close_date).toLocaleDateString(
                          "en-PH",
                          {
                            month: "long",
                            day: "numeric",
                            year: "numeric",
                          }
                        )}
                      </p>

                      <p className="mb-0">
                        {config.is_unlimited ? (
                          <span>
                            <strong>Slots:</strong> Unlimited — apply anytime
                            within the period.
                          </span>
                        ) : (
                          <span>
                            <strong>Slots Available:</strong>{" "}
                            {config.slot_limit - config.slots_filled} /{" "}
                            {config.slot_limit}
                          </span>
                        )}
                      </p>
                    </>
                  ) : (
                    <p className="text-muted mb-0">
                      No active application period at this time.
                    </p>
                  )}
                </div>
              </div>

              <div className="col-md-6">
                <AnnouncementsCard />
              </div>

            </div>

            <ApplicationHistoryList
              applicationHistory={applicationHistory}
              onViewFile={handleViewHistoricalFile}
            />
          </div>
        </section>

        <PanelFooter />
      </div>
    </div>
  );
}

export default ApplicantDashboard;