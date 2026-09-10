import React, { useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import api from "../../services/api";
import VerifierActivityLogModal from "../pages/VerifierActivityModal";
import VerifierChangePasswordModal from "../pages/VerifierChangePasswordModal";

function VerifierNavigation({
  mobileOpen = false,
  onMobileClose = () => {},
}) {
  const navigate = useNavigate();
  const { logout } = useAuth();

  const [showActivityLog, setShowActivityLog] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  const handleLogout = async () => {
    try {
      await api.post("/logout");
    } catch (err) {
      // Proceed with logout even if API call fails
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
          className="verifier-mobile-backdrop"
          onClick={closeMobileMenu}
        />
      )}

      <aside
        className={[
          "verifier-sidebar",
          collapsed ? "verifier-sidebar-collapsed" : "",
          mobileOpen ? "verifier-sidebar-mobile-open" : "",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        <button
          type="button"
          className="verifier-sidebar-toggle"
          onClick={() => setCollapsed(!collapsed)}
          aria-label="Toggle sidebar"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            {collapsed ? (
              <polyline points="9 18 15 12 9 6" />
            ) : (
              <polyline points="15 18 9 12 15 6" />
            )}
          </svg>
        </button>

        <button
          type="button"
          className="verifier-sidebar-mobile-close"
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
          className="verifier-sidebar-brand"
          to="/VerifierDashboard"
          onClick={closeMobileMenu}
        >
          <img src="/icons/sk-logo.jpg" alt="SK Logo" />

          <div className="verifier-sidebar-brand-text">
            <h5>SK Mamatid</h5>
            <span>Verifier Panel</span>
          </div>
        </NavLink>

        <nav className="verifier-sidebar-nav">
          <NavLink
            to="/VerifierDashboard"
            onClick={closeMobileMenu}
            className={({ isActive }) =>
              `verifier-sidebar-link ${isActive ? "active" : ""}`
            }
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
            >
              <rect x="3" y="3" width="7" height="7" rx="1" />
              <rect x="14" y="3" width="7" height="7" rx="1" />
              <rect x="3" y="14" width="7" height="7" rx="1" />
              <rect x="14" y="14" width="7" height="7" rx="1" />
            </svg>

            <span className="verifier-sidebar-label">Dashboard</span>
          </NavLink>

          <NavLink
            to="/VerifierApplicationList"
            onClick={closeMobileMenu}
            className={({ isActive }) =>
              `verifier-sidebar-link ${isActive ? "active" : ""}`
            }
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
            >
              <rect x="4" y="3" width="16" height="18" rx="2" />
              <path d="M8 8h8" />
              <path d="M8 12h8" />
              <path d="M8 16h5" />
            </svg>

            <span className="verifier-sidebar-label">
              Application List
            </span>
          </NavLink>

          <NavLink
            to="/VerifierClaiming"
            onClick={closeMobileMenu}
            className={({ isActive }) =>
              `verifier-sidebar-link ${isActive ? "active" : ""}`
            }
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
            >
              <rect x="3" y="6" width="18" height="13" rx="2" />
              <path d="M8 6V4h8v2" />
              <path d="M8 12h8" />
            </svg>

            <span className="verifier-sidebar-label">Claiming</span>
          </NavLink>

          <NavLink
            to="/VerifierWaitlist"
            onClick={closeMobileMenu}
            className={({ isActive }) =>
              `verifier-sidebar-link ${isActive ? "active" : ""}`
            }
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
            >
              <circle cx="12" cy="12" r="9" />
              <path d="M12 7v5l3 2" />
            </svg>

            <span className="verifier-sidebar-label">Waitlist</span>
          </NavLink>

          <div className="verifier-sidebar-divider"></div>

          <NavLink
            to="/VerifierProfile"
            onClick={closeMobileMenu}
            className={({ isActive }) =>
              `verifier-sidebar-link ${isActive ? "active" : ""}`
            }
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
            >
              <circle cx="12" cy="8" r="4" />
              <path d="M4 21c0-4 3.5-7 8-7s8 3 8 7" />
            </svg>

            <span className="verifier-sidebar-label">My Profile</span>
          </NavLink>

          <button
            type="button"
            className="verifier-sidebar-link"
            onClick={() => {
              closeMobileMenu();
              setShowActivityLog(true);
            }}
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
            >
              <circle cx="12" cy="12" r="9" />
              <path d="M12 7v5l3 2" />
            </svg>

            <span className="verifier-sidebar-label">
              Activity Log
            </span>
          </button>

          <button
            type="button"
            className="verifier-sidebar-link"
            onClick={() => {
              closeMobileMenu();
              setShowChangePassword(true);
            }}
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
            >
              <rect x="5" y="10" width="14" height="11" rx="2" />
              <path d="M8 10V7a4 4 0 0 1 8 0v3" />
            </svg>

            <span className="verifier-sidebar-label">
              Change Password
            </span>
          </button>
        </nav>

        <button
          type="button"
          className="verifier-sidebar-logout"
          onClick={handleLogout}
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
          >
            <path d="M10 17l5-5-5-5" />
            <path d="M15 12H3" />
            <path d="M14 3h5a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-5" />
          </svg>

          <span className="verifier-sidebar-label">Logout</span>
        </button>
      </aside>

      <VerifierActivityLogModal
        show={showActivityLog}
        onClose={() => setShowActivityLog(false)}
      />

      <VerifierChangePasswordModal
        show={showChangePassword}
        onClose={() => setShowChangePassword(false)}
      />
    </>
  );
}

export default VerifierNavigation;