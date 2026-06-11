import React from "react";
import AdminNavigation from "../components/AdminNavigation";

function AdminDashboard() {
  return (
    <div>

      {/* NAVIGATION */}
      <AdminNavigation />

      {/* MAIN CONTENT */}
      <section className="page-section">
        <div className="container">

          {/* PAGE TITLE */}
          <h3 className="section-title">Admin Dashboard</h3>

          {/* STATS */}
          <div className="row g-4">

            <div className="col-md-3">
              <div className="dashboard-card">
                <h2>125</h2>
                <p>Total Applications</p>
              </div>
            </div>

            <div className="col-md-3">
              <div className="dashboard-card">
                <h2>34</h2>
                <p>Pending Review</p>
              </div>
            </div>

            <div className="col-md-3">
              <div className="dashboard-card">
                <h2>70</h2>
                <p>Approved Applications</p>
              </div>
            </div>

            <div className="col-md-3">
              <div className="dashboard-card">
                <h2>21</h2>
                <p>Rejected Applications</p>
              </div>
            </div>

          </div>

          {/* SYSTEM MANAGEMENT */}
          <div className="mt-5">

            <h4 className="section-title">System Management</h4>

            <div className="row g-3">

              <div className="col-md-4">
                <a className="admin-link" href="/AdminUsers">
                  User Management
                </a>
              </div>

              <div className="col-md-4">
                <a className="admin-link" href="/AdminSettings">
                  Application Settings
                </a>
              </div>

              <div className="col-md-4">
                <a className="admin-link" href="/AdminSchedules">
                  Schedule Management
                </a>
              </div>

              <div className="col-md-4">
                <a className="admin-link" href="/AdminAnnouncements">
                  Announcements Management
                </a>
              </div>

              <div className="col-md-4">
                <a className="admin-link" href="/AdminReports">
                  Generate Reports
                </a>
              </div>

            </div>

          </div>

        </div>
      </section>

      {/* FOOTER */}
      <footer>
        <div className="container">
          <p className="mb-0">
            © 2026 Sangguniang Kabataan of Barangay Mamatid | Admin Panel
          </p>
        </div>
      </footer>

    </div>
  );
}

export default AdminDashboard;