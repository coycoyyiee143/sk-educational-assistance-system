import ApplicantNavigation from "../components/ApplicantNavigation";

// ── Data ──────────────────────────────────────────────────────────────────────

const schedule = {
  date:  "April 28, 2026",
  time:  "9:00 AM - 11:00 AM",
  venue: "Barangay Mamatid Covered Court",
};

const claimingDetails = [
  ["Applicant Name",    "Juan Dela Cruz"],
  ["Application ID",    "SK-EA-2026-00125"],
  ["Control Number",    "0108"],
  ["Application Status","Approved"],
  ["Claiming Venue",    "Barangay Mamatid Covered Court"],
];

const reminders = [
  "Please arrive on time based on your assigned claiming schedule.",
  "Bring a valid ID and other documents required by the SK office.",
  "Only approved applicants may claim the educational assistance.",
  "If the applicant cannot personally claim, an authorized representative may be required to present proper authorization.",
  "Follow the instructions of SK personnel during the claiming process.",
];

// ── Component ─────────────────────────────────────────────────────────────────

function ApplicantClaimingSchedule() {
  return (
    <div>
      <ApplicantNavigation />

      <section className="page-section">
        <div className="container">

          {/* Schedule Box */}
          <div className="page-card">
            <h3 className="section-title">Claiming Schedule</h3>

            <div className="schedule-box">
              <h5 className="mb-3">Assigned Claiming Schedule</h5>
              <span className="schedule-badge">Approved</span>
              <p className="mt-3 mb-1"><strong>Date:</strong> {schedule.date}</p>
              <p className="mb-1"><strong>Time:</strong> {schedule.time}</p>
              <p className="mb-0"><strong>Venue:</strong> {schedule.venue}</p>
            </div>
          </div>

          {/* Claiming Details */}
          <div className="page-card">
            <h4 className="section-title">Claiming Details</h4>

            <div className="table-responsive">
              <table className="table table-bordered table-striped align-middle">
                <thead>
                  <tr>
                    <th>Item</th>
                    <th>Details</th>
                  </tr>
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

          {/* Reminders */}
          <div className="page-card">
            <h4 className="section-title">Important Reminders</h4>

            <div className="note-box">
              <ul className="mb-0">
                {reminders.map((r, i) => <li key={i}>{r}</li>)}
              </ul>
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