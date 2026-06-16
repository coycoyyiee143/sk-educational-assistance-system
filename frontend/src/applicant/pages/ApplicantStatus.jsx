import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import ApplicantNavigation from "../components/ApplicantNavigation";
import api from "../../services/api";
import { STATUS_CONFIG } from "../../components/StatusConstants";

function ApplicantStatus() {
  const [application, setApplication] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    api.get("/applications")
      .then((res) => {
        if (res.data.length > 0) setApplication(res.data[0]);
      })
      .catch(() => setError("Failed to load application status."))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div>
      <ApplicantNavigation />
      <div className="d-flex justify-content-center align-items-center" style={{ height: "60vh" }}>
        <div className="spinner-border text-danger" role="status" />
      </div>
    </div>
  );

  const status = application?.status ?? null;
  // Fallback to "pending" if the status key is missing or invalid
  const config = STATUS_CONFIG[status] ?? STATUS_CONFIG["pending"];

  return (
    <div>
      <ApplicantNavigation />

      <section className="page-section">
        <div className="container">
          <div className="page-card">
            <h3 className="section-title">Application Status</h3>

            {error && <div className="alert alert-danger">{error}</div>}

            {!application ? (
              <div className="alert alert-info">
                You have not submitted an application yet.
              </div>
            ) : (
              <>
                <div className={`status-box ${config.boxClass} mb-4`}>
                  <h5 className="mb-3">Current Status</h5>
                  <span className={`status-badge ${config.badgeClass}`}>{config.label}</span>
                  <p className="mt-3 mb-0 text-muted">{config.message}</p>

                  {/* Show verifier notes for active review states */}
                  {status !== "approved" && status !== "auto_approved" && status !== "physically_verified" && status !== "rejected" && application?.latest_verifier_action?.notes && (
                    <div className="alert alert-info mt-3 mb-0">
                      <strong>Verifier Note:</strong> {application.latest_verifier_action.notes}
                    </div>
                  )}

                  {/* Show per-document reupload reasons */}
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
                    <div className="alert alert-danger mt-3 mb-0">
                      <strong>Reason:</strong> {application.rejection_reason}
                    </div>
                  )}

                  {config.showClaiming && (
                    <div className="mt-4">
                      <Link to="/ApplicantClaimingSchedule" className="btn btn-custom">
                        View Claiming Schedule
                      </Link>
                    </div>
                  )}

                  {config.showReupload && (
                    <div className="mt-4">
                      <Link to="/ApplicantSubmission" className="btn btn-custom">
                        Go to Re-upload Documents
                      </Link>
                    </div>
                  )}
                </div>

                <table className="table table-bordered info-table">
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
              </>
            )}
          </div>
        </div>
      </section>

      <footer>
        <div className="container">
          <p className="mb-0">
            © 2026 Sangguniang Kabataan of Barangay Mamatid | Educational Assistance Application System
          </p>
        </div>
      </footer>
    </div>
  );
}

export default ApplicantStatus;