import { Link } from "react-router-dom";
import ApplicantNavigation from "../components/ApplicantNavigation";

// ── Config ────────────────────────────────────────────────────────────────────

const statusConfig = {
  Approved: {
    boxClass:   "status-box-approved",
    badgeClass: "status-approved",
    message:    "Congratulations! Your educational assistance application has been approved by the Sangguniang Kabataan of Barangay Mamatid. You may now proceed to view your assigned claiming schedule.",
    showClaiming: true,
  },
  Pending: {
    boxClass:   "status-box-pending",
    badgeClass: "status-pending",
    message:    "Your application has been submitted and is currently awaiting verification by SK personnel. Please wait for further updates.",
    showClaiming: false,
  },
  Rejected: {
    boxClass:   "status-box-rejected",
    badgeClass: "status-rejected",
    message:    "We regret to inform you that your application did not meet the eligibility requirements. Please contact the SK office for further assistance.",
    showClaiming: false,
  },
  "Under Review": {
    boxClass:   "status-box-review",
    badgeClass: "status-review",
    message:    "Your application is currently being reviewed by our verifiers. Please check back for updates.",
    showClaiming: false,
  },
};

// ── Component ─────────────────────────────────────────────────────────────────

function ApplicantStatus() {
  const currentStatus = "Approved"; // TODO: replace with actual status from backend
  const config = statusConfig[currentStatus] ?? statusConfig["Pending"];

  return (
    <div>
      <ApplicantNavigation />

      <section className="page-section">
        <div className="container">

          <div className="page-card">
            <h3 className="section-title">Application Status</h3>

            <div className={`status-box ${config.boxClass}`}>
              <h5 className="mb-3">Current Status</h5>
              <span className={`status-badge ${config.badgeClass}`}>{currentStatus}</span>
              <p className="mt-3 mb-0 text-muted">{config.message}</p>

              {config.showClaiming && (
                <div className="mt-4">
                  <Link to="/ApplicantClaimingSchedule" className="btn btn-custom">
                    View Claiming Schedule
                  </Link>
                </div>
              )}
            </div>
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