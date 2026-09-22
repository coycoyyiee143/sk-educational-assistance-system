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

  const [showAppealForm, setShowAppealForm] = useState(false);
  const [appealReason, setAppealReason] = useState("");
  const [appealFile, setAppealFile] = useState(null);
  const [appealSubmitting, setAppealSubmitting] = useState(false);
  const [appealError, setAppealError] = useState("");

  const loadApplication = () => {
    return Promise.all([
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
      .catch(() => setError("Failed to load application status."));
  };

  useEffect(() => {
    loadApplication().finally(() => setLoading(false));
  }, []);

  const handleAppealSubmit = (e) => {
    e.preventDefault();
    if (!appealReason.trim()) {
      setAppealError("Please explain why you're appealing this decision.");
      return;
    }
    setAppealSubmitting(true);
    setAppealError("");

    const formData = new FormData();
    formData.append("reason", appealReason);
    if (appealFile) {
      formData.append("document", appealFile);
    }

    api
      .post(`/applications/${application.id}/appeal`, formData)
      .then(() => {
        setShowAppealForm(false);
        setAppealReason("");
        setAppealFile(null);
        return loadApplication();
      })
      .catch((err) => {
        setAppealError(
          err.response?.data?.message || "Failed to submit appeal. Please try again."
        );
      })
      .finally(() => setAppealSubmitting(false));
  };

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
                    {status === "rejected" && application.appealed_at && (
                      <div className="info-box mt-3 mb-0">
                        <strong>Appeal Decision:</strong>{" "}
                        {application.appeal_decision_notes ||
                          "Your appeal is still being reviewed."}
                      </div>
                    )}
                    {status === "rejected" &&
                      config.showAppeal &&
                      !application.appealed_at && (
                        <div className="mt-4">
                          {!showAppealForm ? (
                            <button
                              type="button"
                              className="btn btn-save-green"
                              onClick={() => setShowAppealForm(true)}
                            >
                              Request Appeal
                            </button>
                          ) : (
                            <form
                              className="mt-2"
                              onSubmit={handleAppealSubmit}
                            >
                              <div className="mb-3">
                                <label className="form-label">
                                  Why are you appealing this decision?
                                </label>
                                <textarea
                                  className="form-control"
                                  rows={4}
                                  value={appealReason}
                                  onChange={(e) => setAppealReason(e.target.value)}
                                  placeholder="Explain why you believe this decision should be reconsidered..."
                                />
                              </div>
                              <div className="mb-3">
                                <label className="form-label">
                                  Supporting document (optional)
                                </label>
                                <input
                                  type="file"
                                  className="form-control"
                                  accept=".jpg,.jpeg,.png,.pdf"
                                  onChange={(e) =>
                                    setAppealFile(e.target.files?.[0] ?? null)
                                  }
                                />
                              </div>
                              {appealError && (
                                <div className="error-box mb-3">{appealError}</div>
                              )}
                              <div className="d-flex gap-2">
                                <button
                                  type="submit"
                                  className="btn btn-save-green"
                                  disabled={appealSubmitting}
                                >
                                  {appealSubmitting ? "Submitting..." : "Submit Appeal"}
                                </button>
                                <button
                                  type="button"
                                  className="btn btn-outline-secondary"
                                  onClick={() => {
                                    setShowAppealForm(false);
                                    setAppealError("");
                                  }}
                                  disabled={appealSubmitting}
                                >
                                  Cancel
                                </button>
                              </div>
                            </form>
                          )}
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