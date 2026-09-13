import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import AdminNavigation from "../components/AdminNavigation";
import api from "../../services/api";
import PanelFooter from "../../components/PanelFooter";

function AdminDashboard() {
  const [stats, setStats] = useState({ total: 0, incomplete: 0, pending: 0, approved: 0, rejected: 0, no_active_period: false });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get("/admin/stats")
      .then((res) => setStats(res.data))
      .catch(() => { })
      .finally(() => setLoading(false));
  }, []);

  const cards = [
    {
      label: "Total Applications",
      value: stats.total,
      accent: "orange",
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" />
        </svg>
      ),
    },
    {
      label: "Pending Review",
      value: stats.pending,
      accent: "red",
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10" />
          <path d="M12 8v4M12 16h.01" />
        </svg>
      ),
    },
    {
      label: "Approved Applications",
      value: stats.approved,
      accent: "green",
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10" />
          <path d="M8 12l3 3 5-6" />
        </svg>
      ),
    },
    {
      label: "Rejected Applications",
      value: stats.rejected,
      accent: "gray",
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10" />
          <path d="M15 9l-6 6M9 9l6 6" />
        </svg>
      ),
    },
  ];

  const managementItems = [
    {
      label: "User Management",
      to: "/AdminUsers",
      desc: "Manage access levels",
      accent: "blue",
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
          <circle cx="12" cy="7" r="4" />
        </svg>
      ),
    },
    {
      label: "Application Settings",
      to: "/AdminSettings",
      desc: "Configure system options",
      accent: "gray",
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 11-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06A1.65 1.65 0 004.6 15a1.65 1.65 0 00-1.51-1H3a2 2 0 110-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06A1.65 1.65 0 009 4.6a1.65 1.65 0 001-1.51V3a2 2 0 114 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 110 4h-.09a1.65 1.65 0 00-1.51 1z" />
        </svg>
      ),
    },
    {
      label: "Schedule Management",
      to: "/AdminSchedule",
      desc: "Configure schedules",
      accent: "orange",
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="4" width="18" height="18" rx="2" />
          <line x1="16" y1="2" x2="16" y2="6" />
          <line x1="8" y1="2" x2="8" y2="6" />
          <line x1="3" y1="10" x2="21" y2="10" />
        </svg>
      ),
    },
    {
      label: "Announcements Management",
      to: "/AdminAnnouncements",
      desc: "Post updates & notices",
      accent: "red",
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M3 11l18-5v12L3 14v-3z" />
          <path d="M11.6 16.8a3 3 0 11-5.8-1.6" />
        </svg>
      ),
    },
    {
      label: "Events Management",
      to: "/AdminEvents",
      desc: "Manage SK events",
      accent: "green",
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="4" width="18" height="18" rx="2" />
          <line x1="16" y1="2" x2="16" y2="6" />
          <line x1="8" y1="2" x2="8" y2="6" />
          <line x1="3" y1="10" x2="21" y2="10" />
        </svg>
      ),
    },
    {
      label: "Generate Reports",
      to: "/AdminReports",
      desc: "View & export reports",
      accent: "purple",
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M3 3v18h18" />
          <rect x="7" y="12" width="3" height="6" />
          <rect x="12" y="8" width="3" height="10" />
          <rect x="17" y="5" width="3" height="13" />
        </svg>
      ),
    },
  ];

  return (
    <div className="admin-layout">
      <AdminNavigation />
      <div className="admin-main">
        <div className="admin-topbar">
          <div className="admin-topbar-user">
            <div className="admin-topbar-user-text">
              <span className="admin-topbar-user-name">Admin User</span>
              <span className="admin-topbar-user-role">Sangguniang Kabataan</span>
            </div>
            <div className="admin-topbar-avatar"></div>
          </div>
        </div>
        <section className="page-section">
          <div className="container-fluid">

            <div className="page-card">
              <h3 className="section-title mb-2">Admin Dashboard</h3>
              <p className="text-muted mb-0">
                Overview of application statistics and quick access to system management tools.
              </p>
            </div>

            {!loading && stats.no_active_period && (
              <div className="alert alert-warning">
                No active application period is currently configured. Statistics will show once a period is activated.
              </div>
            )}

            <div className="row g-4">
              {cards.map(({ label, value, accent, icon }) => (
                <div className="col-md-3" key={label}>
                  <div className={`admin-stat-card admin-stat-${accent}`}>
                    <div className="admin-stat-top">
                      <h2>{loading ? "..." : value}</h2>
                      <span className={`admin-stat-icon admin-stat-icon-${accent}`}>{icon}</span>
                    </div>
                    <p className={`admin-stat-label admin-stat-label-${accent}`}>{label}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-5">
              <h4 className="section-title">Quick Actions</h4>
              <div className="row g-3">
                {managementItems.map(({ label, to, desc, accent, icon }) => (
                  <div className="col-md-4" key={label}>
                    <Link className="admin-mgmt-link" to={to}>
                      <span className={`admin-mgmt-icon admin-mgmt-icon-${accent}`}>{icon}</span>
                      <span className="admin-mgmt-title">{label}</span>
                      <span className="admin-mgmt-desc">{desc}</span>
                    </Link>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
        <PanelFooter />
      </div>
    </div>
  );
}

export default AdminDashboard;