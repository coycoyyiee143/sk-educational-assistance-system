import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import ApplicantNavigation from "../components/ApplicantNavigation";
import PanelFooter from "../../components/PanelFooter";
import api from "../../services/api";
import { STATUS_CONFIG } from "../../components/StatusConstants";
import ApplicantTopbarUser from "../components/ApplicantTopbarUser";

function ApplicantStatus() {
  const [application, setApplication] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([
      api.get("/applications"),
      api.get("/application-config/active"),
    ])
      .then(([appsRes, configRes]) => {
        const currentConfig = configRes.data;
        const current = appsRes.data.find(
          (app) => app.config_id === currentConfig.id
        );
        setApplication(current ?? null);
      })
      .catch(() => setError("Failed to load application status."))
      .finally(() => setLoading(false));
  }, []);


  const status = application?.status ?? null;
  const config = STATUS_CONFIG[status] ?? STATUS_CONFIG["pending_prescreening"];

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
              <h3 className="applicant-dashboard-title">Application Status</h3>
              <p className="applicant-dashboard-desc">Track the current status of your submitted application.</p>
            </div>

            <div className="page-card">
              {error && <div className="error-box">{error}</div>}

              {loading ? (
                <div className="d-flex justify-content-center align-items-center py-5">
                  <div className="spinner-border text-danger" role="status" />
                </div>
              ) : !application ? (
                <div className="info-box mb-0">
                  You have not submitted an application yet.
                </div>
              ) : (
                <>
                  <div className={`status-box ${config.boxClass} mb-4`}>
                    <h5 className="mb-3">Current Status</h5>
                    <span className={`status-badge ${config.badgeClass}`}>{config.applicantLabel}</span>
                    <p className="mt-3 mb-0 text-muted">{config.applicantMessage}</p>
                    {status !== "approved" && status !== "rejected" && application?.latest_verifier_action?.notes && (
                      <div className="info-box mt-3 mb-0">
                        <strong>Verifier Note:</strong> {application.latest_verifier_action.notes}
                      </div>
                    )}
                    {status === "reupload_requested" &&
                      application?.latest_verifier_action?.reupload_details?.length > 0 && (
                        <div className="mt-3">
                          <strong>Documents to Re-upload:</strong>
                          <ul className="mb-0 mt-2">
                            {application.latest_verifier_action.reupload_details.map((d, i) => (
                              <li key={i}>
                                <strong>{d.label}:</strong> {d.reason}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    {application.rejection_reason && status === "rejected" && (
                      <div className="error-box mt-3 mb-0">
                        <strong>Reason:</strong> {application.rejection_reason}
                      </div>
                    )}
                    {config.showClaiming && (
                      <div className="mt-4">
                        <Link to="/ApplicantClaimingSchedule" className="btn btn-save-green">
                          View Claiming Schedule
                        </Link>
                      </div>
                    )}
                    {config.showReupload && (
                      <div className="mt-4">
                        <Link to="/ApplicantSubmission" className="btn btn-save-green">
                          Go to Re-upload Documents
                        </Link>
                      </div>
                    )}
                  </div>

                  <div className="table-responsive">
                    <table className="table table-bordered table-striped align-middle announcement-table">
                      <tbody>
                        {[
                          ["Application ID", `APP-${application.id}`],
                          ["Control Number", application.control_number ?? "Not yet assigned"],
                          ["School", application.school_name],
                          ["Course", application.course],
                          ["Year Level", application.year_level],
                          ["Submitted", application.submitted_at?.split("T")[0]],
                        ].map(([label, value]) => (
                          <tr key={label}>
                            <th style={{ width: "35%" }}>{label}</th>
                            <td>{value}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>

          </div>
        </section>
        <PanelFooter />
      </div>
    </div>
  );
}

export default ApplicantStatus;