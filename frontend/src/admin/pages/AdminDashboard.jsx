import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import AdminNavigation from "../components/AdminNavigation";
import api from "../../services/api";

function AdminDashboard() {
  const [stats, setStats] = useState({ total: 0, pending: 0, approved: 0, rejected: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get("/admin/stats")
      .then((res) => setStats(res.data))
      .catch(() => { })
      .finally(() => setLoading(false));
  }, []);

  const cards = [
    { label: "Total Applications", value: stats.total },
    { label: "Pending Review", value: stats.pending },
    { label: "Approved Applications", value: stats.approved },
    { label: "Rejected Applications", value: stats.rejected },
  ];

  return (
    <div>
      <AdminNavigation />
      <section className="page-section">
        <div className="container">
          <h3 className="section-title">Admin Dashboard</h3>

          <div className="row g-4">
            {cards.map(({ label, value }) => (
              <div className="col-md-3" key={label}>
                <div className="dashboard-card">
                  <h2>{loading ? "..." : value}</h2>
                  <p>{label}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-5">
            <h4 className="section-title">System Management</h4>
            <div className="row g-3">
              {[
                { label: "User Management", to: "/AdminUsers" },
                { label: "Application Settings", to: "/AdminSettings" },
                { label: "Schedule Management", to: "/AdminSchedule" },
                { label: "Announcements Management", to: "/AdminAnnouncements" },
                { label: "Events Management", to: "/AdminEvents" },
                { label: "Generate Reports", to: "/AdminReports" },
              ].map(({ label, to }) => (
                <div className="col-md-4" key={label}>
                  <Link className="admin-link" to={to}>{label}</Link>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
      <footer>
        <div className="container">
          <p className="mb-0">© 2026 Sangguniang Kabataan of Barangay Mamatid | Admin Panel</p>
        </div>
      </footer>
    </div>
  );
}

export default AdminDashboard;