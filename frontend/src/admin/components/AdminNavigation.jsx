import React, { useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import api from "../../services/api";
import AdminChangePasswordModal from "../pages/AdminChangePasswordModal";

function AdminNavigation() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  const handleLogout = async () => {
    try {
      await api.post("/logout");
    } catch (err) {
      // proceed with logout even if api call fails
    } finally {
      logout();
      navigate("/login");
    }
  };

  return (
    <>
      <aside className={collapsed ? "admin-sidebar admin-sidebar-collapsed" : "admin-sidebar"}>
        <button
          className="admin-sidebar-toggle"
          onClick={() => setCollapsed(!collapsed)}
          aria-label="Toggle sidebar"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points={collapsed ? "9 18 15 12 9 6" : "15 18 9 12 15 6"} />
          </svg>
        </button>

        <NavLink className="admin-sidebar-brand" to="/AdminDashboard">
          <img src="/logo.png" alt="logo" />
          <div className="admin-sidebar-brand-text">
            <h5>SK Mamatid</h5>
            <span>Admin Panel</span>
          </div>
        </NavLink>

        <nav className="admin-sidebar-nav">
          <NavLink
            to="/AdminDashboard"
            className={({ isActive }) => isActive ? "admin-sidebar-link active" : "admin-sidebar-link"}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="7" height="9" rx="1" />
              <rect x="14" y="3" width="7" height="5" rx="1" />
              <rect x="14" y="12" width="7" height="9" rx="1" />
              <rect x="3" y="16" width="7" height="5" rx="1" />
            </svg>
            <span className="admin-sidebar-label">Dashboard</span>
          </NavLink>

          <NavLink
            to="/AdminUsers"
            className={({ isActive }) => isActive ? "admin-sidebar-link active" : "admin-sidebar-link"}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 00-3-3.87" />
              <path d="M16 3.13a4 4 0 010 7.75" />
            </svg>
            <span className="admin-sidebar-label">Users</span>
          </NavLink>

          <NavLink
            to="/AdminSchedule"
            className={({ isActive }) => isActive ? "admin-sidebar-link active" : "admin-sidebar-link"}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="4" width="18" height="18" rx="2" />
              <line x1="16" y1="2" x2="16" y2="6" />
              <line x1="8" y1="2" x2="8" y2="6" />
              <line x1="3" y1="10" x2="21" y2="10" />
            </svg>
            <span className="admin-sidebar-label">Schedules</span>
          </NavLink>

          <NavLink
            to="/AdminAnnouncements"
            className={({ isActive }) => isActive ? "admin-sidebar-link active" : "admin-sidebar-link"}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 11l18-5v12L3 14v-3z" />
              <path d="M11.6 16.8a3 3 0 11-5.8-1.6" />
            </svg>
            <span className="admin-sidebar-label">Announcements</span>
          </NavLink>

          <NavLink
            to="/AdminEvents"
            className={({ isActive }) => isActive ? "admin-sidebar-link active" : "admin-sidebar-link"}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="4" width="18" height="18" rx="2" />
              <line x1="16" y1="2" x2="16" y2="6" />
              <line x1="8" y1="2" x2="8" y2="6" />
              <line x1="3" y1="10" x2="21" y2="10" />
              <path d="M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01" />
            </svg>
            <span className="admin-sidebar-label">Events</span>
          </NavLink>

          <NavLink
            to="/AdminReports"
            className={({ isActive }) => isActive ? "admin-sidebar-link active" : "admin-sidebar-link"}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 3v18h18" />
              <rect x="7" y="12" width="3" height="6" />
              <rect x="12" y="8" width="3" height="10" />
              <rect x="17" y="5" width="3" height="13" />
            </svg>
            <span className="admin-sidebar-label">Reports</span>
          </NavLink>

          <NavLink
            to="/AdminSettings"
            className={({ isActive }) => isActive ? "admin-sidebar-link active" : "admin-sidebar-link"}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 11-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06A1.65 1.65 0 004.6 15a1.65 1.65 0 00-1.51-1H3a2 2 0 110-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06A1.65 1.65 0 009 4.6a1.65 1.65 0 001-1.51V3a2 2 0 114 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 110 4h-.09a1.65 1.65 0 00-1.51 1z" />
            </svg>
            <span className="admin-sidebar-label">Application Settings</span>
          </NavLink>

          <div className="admin-sidebar-divider"></div>

          <NavLink
            to="/AdminUsers"
            className={({ isActive }) => isActive ? "admin-sidebar-link active" : "admin-sidebar-link"}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
            <span className="admin-sidebar-label">Manage Users</span>
          </NavLink>

          <NavLink
            to="/AdminMasterActivityLog"
            className={({ isActive }) => isActive ? "admin-sidebar-link active" : "admin-sidebar-link"}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 6v6l4 2" />
            </svg>
            <span className="admin-sidebar-label">System Activity Log</span>
          </NavLink>

          <button
            className="admin-sidebar-link admin-sidebar-btn"
            onClick={() => setShowChangePassword(true)}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="11" width="18" height="11" rx="2" />
              <path d="M7 11V7a5 5 0 0110 0v4" />
            </svg>
            <span className="admin-sidebar-label">Change Password</span>
          </button>
        </nav>

        <button className="admin-sidebar-logout" onClick={handleLogout}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
          </svg>
          <span className="admin-sidebar-label">Logout</span>
        </button>
      </aside>

      <AdminChangePasswordModal show={showChangePassword} onClose={() => setShowChangePassword(false)} />
    </>
  );
}

export default AdminNavigation;