import ApplicantNavigation from "../components/ApplicantNavigation";

// ── Data ──────────────────────────────────────────────────────────────────────

const notifications = [
  "Your application form was successfully submitted.",
  "Please upload your Certificate of Enrollment.",
  "Check the announcements page for updates regarding verification.",
];

const importantDates = [
  { activity: "Application Period",      date: "April 1 – April 15, 2026",  description: "Submission of application forms and requirements." },
  { activity: "Document Verification",   date: "April 16 – April 22, 2026", description: "Review and checking of submitted documents." },
  { activity: "Release of Results",      date: "April 25, 2026",            description: "Posting of approved and disapproved applications." },
  { activity: "Claiming of Assistance",  date: "April 27 – April 30, 2026", description: "Distribution of educational assistance to approved applicants." },
];

// ── Component ─────────────────────────────────────────────────────────────────

function ApplicantDashboard() {
  return (
    <div>
      <ApplicantNavigation />

      <section className="dashboard-section">
        <div className="container">

          {/* Welcome */}
          <div className="welcome-box">
            <h3 className="section-title mb-2">Applicant Dashboard</h3>
            <p className="mb-0">Monitor your application status and recent updates.</p>
          </div>

          {/* Cards */}
          <div className="row g-4">

            <div className="col-md-4">
              <div className="dashboard-card">
                <h5>Current Application Status</h5>
                <p><span className="status-badge">Pending Review</span></p>
                <p className="mb-0 text-muted">
                  Your application has been submitted and is currently waiting for verification by the SK personnel.
                </p>
              </div>
            </div>

            <div className="col-md-4">
              <div className="dashboard-card">
                <h5>Recent Notifications</h5>
                {notifications.map((note, i) => (
                  <div className="notification-item" key={i}>{note}</div>
                ))}
              </div>
            </div>

          </div>

          {/* Important Dates */}
          <div className="highlight-section">
            <div className="container">
              <h4 className="section-title text-center">Important Dates</h4>

              <div className="table-responsive">
                <table className="table table-bordered table-striped align-middle bg-white">
                  <thead>
                    <tr>
                      <th>Activity</th>
                      <th>Date</th>
                      <th>Description</th>
                    </tr>
                  </thead>
                  <tbody>
                    {importantDates.map((row) => (
                      <tr key={row.activity}>
                        <td>{row.activity}</td>
                        <td>{row.date}</td>
                        <td>{row.description}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
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

export default ApplicantDashboard;