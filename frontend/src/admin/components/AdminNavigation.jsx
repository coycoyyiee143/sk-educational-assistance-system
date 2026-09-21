import React, { useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import api from "../../services/api";
import AdminChangePasswordModal from "../pages/AdminChangePasswordModal";

function AdminNavigation({
  mobileOpen = false,
  onMobileClose = () => {},
}) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [collapsed, setCollapsed] = useState(
    () => localStorage.getItem("admin-sidebar-collapsed") === "1"
  );

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem("admin-sidebar-collapsed", next ? "1" : "0");
      return next;
    });
  };

  const isItSupport = user?.role === "it_support";
  const isSuperadmin = user?.role === "superadmin";

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

  const closeMobileMenu = () => {
    onMobileClose();
  };

  return (
    <>
      {mobileOpen && (
        <div
          className="admin-mobile-backdrop"
          onClick={closeMobileMenu}
        />
      )}
      <aside
        className={[
          "admin-sidebar",
          collapsed ? "admin-sidebar-collapsed" : "",
          mobileOpen ? "admin-sidebar-mobile-open" : "",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        <button
          type="button"
          className="admin-sidebar-toggle"
          onClick={toggleCollapsed}
          aria-label="Toggle sidebar"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <polyline
              points={
                collapsed
                  ? "9 18 15 12 9 6"
                  : "15 18 9 12 15 6"
              }
            />
          </svg>
        </button>
        <button
          type="button"
          className="admin-sidebar-mobile-close"
          onClick={closeMobileMenu}
          aria-label="Close navigation menu"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          >
            <path d="M18 6 6 18" />
            <path d="m6 6 12 12" />
          </svg>
        </button>
        <NavLink
          className="admin-sidebar-brand"
          to={isItSupport ? "/AdminUsers" : "/AdminDashboard"}
          onClick={closeMobileMenu}
        >
          <img src="/icons/sk-logo.jpg" alt="logo" />
          <div className="admin-sidebar-brand-text">
            <h5>SK Mamatid</h5>
            <span>ADMIN PANEL</span>
          </div>
        </NavLink>
        <nav className="admin-sidebar-nav">
          <div className="admin-sidebar-section-title">
            <span className="admin-sidebar-label">MAIN NAVIGATION</span>
          </div>
          {!isItSupport && (
            <NavLink
              to="/AdminDashboard"
              onClick={closeMobileMenu}
              className={({ isActive }) =>
                isActive
                  ? "admin-sidebar-link active"
                  : "admin-sidebar-link"
              }
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <rect x="3" y="3" width="7" height="9" rx="1" />
                <rect x="14" y="3" width="7" height="5" rx="1" />
                <rect x="14" y="12" width="7" height="9" rx="1" />
                <rect x="3" y="16" width="7" height="5" rx="1" />
              </svg>
              <span className="admin-sidebar-label">Dashboard</span>
            </NavLink>
          )}
          {(isSuperadmin || isItSupport) && (
            <NavLink
              to="/AdminUsers"
              onClick={closeMobileMenu}
              className={({ isActive }) =>
                isActive
                  ? "admin-sidebar-link active"
                  : "admin-sidebar-link"
              }
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 00-3-3.87" />
                <path d="M16 3.13a4 4 0 010 7.75" />
              </svg>
              <span className="admin-sidebar-label">Users</span>
            </NavLink>
          )}
          {!isItSupport && (
            <NavLink
              to="/AdminSchedule"
              onClick={closeMobileMenu}
              className={({ isActive }) =>
                isActive
                  ? "admin-sidebar-link active"
                  : "admin-sidebar-link"
              }
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <rect x="3" y="4" width="18" height="18" rx="2" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
              </svg>
              <span className="admin-sidebar-label">Schedules</span>
            </NavLink>
          )}
          {!isItSupport && (
            <NavLink
              to="/AdminAnnouncements"
              onClick={closeMobileMenu}
              className={({ isActive }) =>
                isActive
                  ? "admin-sidebar-link active"
                  : "admin-sidebar-link"
              }
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M3 11v2a2 2 0 0 0 2 2h2l4 4V5L7 9H5a2 2 0 0 0-2 2Z" />
                <path d="M15 9a4 4 0 0 1 0 6" />
                <path d="M18 6a8 8 0 0 1 0 12" />
              </svg>
              <span className="admin-sidebar-label">Announcements</span>
            </NavLink>
          )}
          {!isItSupport && (
            <NavLink
              to="/AdminEvents"
              onClick={closeMobileMenu}
              className={({ isActive }) =>
                isActive
                  ? "admin-sidebar-link active"
                  : "admin-sidebar-link"
              }
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="3" y="5" width="18" height="16" rx="2" />
                <path d="M16 3v4" />
                <path d="M8 3v4" />
                <path d="M3 10h18" />
                <path d="m9 15 2 2 4-4" />
              </svg>
              <span className="admin-sidebar-label">Events</span>
            </NavLink>
          )}
          {!isItSupport && (
            <NavLink
              to="/AdminReports"
              onClick={closeMobileMenu}
              className={({ isActive }) =>
                isActive
                  ? "admin-sidebar-link active"
                  : "admin-sidebar-link"
              }
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M6 2h9l5 5v15H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2Z" />
                <path d="M14 2v6h6" />
                <path d="M8 17v-3" />
                <path d="M12 17v-6" />
                <path d="M16 17v-4" />
              </svg>
              <span className="admin-sidebar-label">Reports</span>
            </NavLink>
          )}
          {!isItSupport && (
            <NavLink
              to="/AdminSettings"
              onClick={closeMobileMenu}
              className={({ isActive }) =>
                isActive
                  ? "admin-sidebar-link active"
                  : "admin-sidebar-link"
              }
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 11-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06A1.65 1.65 0 004.6 15a1.65 1.65 0 00-1.51-1H3a2 2 0 110-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06A1.65 1.65 0 009 4.6a1.65 1.65 0 001-1.51V3a2 2 0 114 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 110 4h-.09a1.65 1.65 0 00-1.51 1z" />
              </svg>
              <span className="admin-sidebar-label">Application Settings</span>
            </NavLink>
          )}
          {isSuperadmin && (
            <NavLink
              to="/AdminMasterActivityLog"
              onClick={closeMobileMenu}
              className={({ isActive }) =>
                isActive
                  ? "admin-sidebar-link active"
                  : "admin-sidebar-link"
              }
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <circle cx="12" cy="12" r="10" />
                <path d="M12 6v6l4 2" />
              </svg>
              <span className="admin-sidebar-label">System Activity Log</span>
            </NavLink>
          )}
          {(isSuperadmin || isItSupport) && (
            <NavLink
              to="/AdminSystemMaintenance"
              onClick={closeMobileMenu}
              className={({ isActive }) =>
                isActive
                  ? "admin-sidebar-link active"
                  : "admin-sidebar-link"
              }
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z" />
              </svg>
              <span className="admin-sidebar-label">System Maintenance</span>
            </NavLink>
          )}
          <div className="admin-sidebar-section-divider" />
          <div className="admin-sidebar-section-title">
            <span className="admin-sidebar-label">SYSTEM SETTINGS</span>
          </div>
          <button
            type="button"
            className="admin-sidebar-link admin-sidebar-btn"
            onClick={() => {
              closeMobileMenu();
              setShowChangePassword(true);
            }}
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <rect x="3" y="11" width="18" height="11" rx="2" />
              <path d="M7 11V7a5 5 0 0110 0v4" />
            </svg>
            <span className="admin-sidebar-label">Change Password</span>
          </button>
        </nav>
        <div className="admin-sidebar-logout-area">
          <button
            type="button"
            className="admin-sidebar-logout"
            onClick={handleLogout}
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            <span className="admin-sidebar-label">Logout</span>
          </button>
        </div>
      </aside>
      <AdminChangePasswordModal
        show={showChangePassword}
        onClose={() => setShowChangePassword(false)}
      />
    </>
  );
}

export default AdminNavigation;