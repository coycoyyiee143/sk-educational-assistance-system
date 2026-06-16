import { useEffect, useState } from "react";
import ApplicantNavigation from "../components/ApplicantNavigation";
import api from "../../services/api";

const reminders = [
  "Please arrive on time based on your assigned claiming schedule.",
  "Bring a valid ID and the original copies of your submitted documents.",
  "Only approved applicants may claim the educational assistance.",
  "If the applicant cannot personally claim, an authorized representative may be required to present proper authorization.",
  "Follow the instructions of SK personnel during the claiming process.",
];

function formatDate(dateStr) {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

function formatTime(timeStr) {
  if (!timeStr) return "";
  const [h, m] = timeStr.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const hour = h % 12 || 12;
  return `${hour}:${String(m).padStart(2, "0")} ${period}`;
}

function ApplicantClaimingSchedule() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    api.get("/applications/claiming-schedule")
      .then((res) => setData(res.data))
      .catch((err) => {
        if (err.response?.status !== 404) {
          setError("Failed to load claiming schedule.");
        }
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div>
        <ApplicantNavigation />
        <div className="d-flex justify-content-center align-items-center" style={{ height: "60vh" }}>
          <div className="spinner-border text-danger" role="status" />
        </div>
      </div>
    );
  }

  const assignment = data?.assignment;
  const application = data?.application;
  const lane = assignment?.lane;
  const schedule = assignment?.schedule;

  const batchTime = lane?.batch === "morning"
    ? `${formatTime(schedule?.morning_start)} - ${formatTime(schedule?.morning_end)}`
    : `${formatTime(schedule?.afternoon_start)} - ${formatTime(schedule?.afternoon_end)}`;

  const claimingDetails = application ? [
    ["Applicant Name", `${application.user?.first_name ?? ""} ${application.user?.last_name ?? ""}`],
    ["Application ID", `APP-${application.id}`],
    ["Control Number", application.control_number],
    ["Application Status", application.status],
    ["Claiming Venue", schedule?.location],
  ] : [];

  return (
    <div>
      <ApplicantNavigation />
      <section className="page-section">
        <div className="container">

          <div className="page-card">
            <h3 className="section-title">Claiming Schedule</h3>

            {error && <div className="alert alert-danger">{error}</div>}

            {!assignment ? (
              <div className="alert alert-info mb-0">
                Your claiming schedule has not been released yet. Please check back once the SK Admin publishes the schedule.
              </div>
            ) : (
              <div className="schedule-box">
                <h5 className="mb-3">Assigned Claiming Schedule</h5>
                <span className="schedule-badge">{lane?.lane_name}</span>
                <p className="mt-3 mb-1"><strong>Date:</strong> {formatDate(lane?.claiming_date)}</p>
                <p className="mb-1"><strong>Time:</strong> {batchTime}</p>
                <p className="mb-0"><strong>Venue:</strong> {schedule?.location}</p>
              </div>
            )}
          </div>

          {assignment && (
            <div className="page-card">
              <h4 className="section-title">Claiming Details</h4>
              <div className="table-responsive">
                <table className="table table-bordered table-striped align-middle">
                  <thead>
                    <tr><th>Item</th><th>Details</th></tr>
                  </thead>
                  <tbody>
                    {claimingDetails.map(([item, detail]) => (
                      <tr key={item}>
                        <td>{item}</td>
                        <td>{detail}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="page-card">
            <h4 className="section-title">Important Reminders</h4>
            <div className="note-box">
              <ul className="mb-0">
                {reminders.map((r, i) => <li key={i}>{r}</li>)}
              </ul>
              {assignment && schedule?.grace_period_date && (
                <p className="mt-3 mb-0">
                  <strong>Grace Period:</strong> If you are unable to claim on your assigned date, you may still claim until {formatDate(schedule.grace_period_date)} subject to SK office approval.
                </p>
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

export default ApplicantClaimingSchedule;