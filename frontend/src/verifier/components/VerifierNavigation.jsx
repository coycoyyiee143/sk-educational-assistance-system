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
  const { logout } = useAuth();
  const navigate = useNavigate();

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
        {/* DESKTOP COLLAPSE BUTTON */}
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

        {/* MOBILE CLOSE BUTTON */}
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
            <path d="M18 6L6 18" />
            <path d="M6 6l12 12" />
          </svg>
        </button>

        {/* BRAND */}
        <NavLink
          className="verifier-sidebar-brand"
          to="/VerifierDashboard"
          onClick={closeMobileMenu}
        >
          <img
            src="/icons/sk-logo.jpg"
            alt="SK Logo"
          />

          <div className="verifier-sidebar-brand-text">
            <h5>SK Mamatid</h5>
            <span>Verifier Panel</span>
          </div>
        </NavLink>

        {/* NAVIGATION */}
        <nav className="verifier-sidebar-nav">
          <NavLink
            to="/VerifierDashboard"
            onClick={closeMobileMenu}
            className={({ isActive }) =>
              isActive
                ? "verifier-sidebar-link active"
                : "verifier-sidebar-link"
            }
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <rect
                x="3"
                y="3"
                width="7"
                height="9"
                rx="1"
              />
              <rect
                x="14"
                y="3"
                width="7"
                height="5"
                rx="1"
              />
              <rect
                x="14"
                y="12"
                width="7"
                height="9"
                rx="1"
              />
              <rect
                x="3"
                y="16"
                width="7"
                height="5"
                rx="1"
              />
            </svg>

            <span className="verifier-sidebar-label">
              Dashboard
            </span>
          </NavLink>

          <NavLink
            to="/VerifierApplicationList"
            onClick={closeMobileMenu}
            className={({ isActive }) =>
              isActive
                ? "verifier-sidebar-link active"
                : "verifier-sidebar-link"
            }
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M9 11l3 3L22 4" />
              <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />
            </svg>

            <span className="verifier-sidebar-label">
              Application List
            </span>
          </NavLink>

          <NavLink
            to="/VerifierClaiming"
            onClick={closeMobileMenu}
            className={({ isActive }) =>
              isActive
                ? "verifier-sidebar-link active"
                : "verifier-sidebar-link"
            }
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <rect
                x="3"
                y="5"
                width="18"
                height="14"
                rx="2"
              />
              <path d="M3 10h18" />
              <path d="M7 15h4" />
            </svg>

            <span className="verifier-sidebar-label">
              Claiming
            </span>
          </NavLink>

          <NavLink
            to="/VerifierWaitlist"
            onClick={closeMobileMenu}
            className={({ isActive }) =>
              isActive
                ? "verifier-sidebar-link active"
                : "verifier-sidebar-link"
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

            <span className="verifier-sidebar-label">
              Waitlist
            </span>
          </NavLink>

          <div className="verifier-sidebar-divider" />

          <NavLink
            to="/VerifierProfile"
            onClick={closeMobileMenu}
            className={({ isActive }) =>
              isActive
                ? "verifier-sidebar-link active"
                : "verifier-sidebar-link"
            }
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>

            <span className="verifier-sidebar-label">
              My Profile
            </span>
          </NavLink>

          <button
            type="button"
            className="verifier-sidebar-link verifier-sidebar-btn"
            onClick={() => {
              closeMobileMenu();
              setShowActivityLog(true);
            }}
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

            <span className="verifier-sidebar-label">
              Activity Log
            </span>
          </button>

          <button
            type="button"
            className="verifier-sidebar-link verifier-sidebar-btn"
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
              <rect
                x="3"
                y="11"
                width="18"
                height="11"
                rx="2"
              />
              <path d="M7 11V7a5 5 0 0110 0v4" />
            </svg>

            <span className="verifier-sidebar-label">
              Change Password
            </span>
          </button>
        </nav>

        {/* LOGOUT */}
        <button
          type="button"
          className="verifier-sidebar-logout"
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
            <line
              x1="21"
              y1="12"
              x2="9"
              y2="12"
            />
          </svg>

          <span className="verifier-sidebar-label">
            Logout
          </span>
        </button>
      </aside>

      <VerifierActivityLogModal
        show={showActivityLog}
        onClose={() =>
          setShowActivityLog(false)
        }
      />

      <VerifierChangePasswordModal
        show={showChangePassword}
        onClose={() =>
          setShowChangePassword(false)
        }
      />
    </>
  );
}

export default VerifierNavigation;