import { useState, useEffect } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import api from "../../services/api";
import ApplicantActivityLogModal from "../pages/ApplicantActivityLogModal";
import ApplicantChangePasswordModal from "../pages/ApplicantChangePasswordModal";

function ApplicantNavigation() {
  const { logout } = useAuth();
  const navigate = useNavigate();

  const [showActivityLog, setShowActivityLog] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  // Mobile only
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleLogout = async () => {
    try {
      await api.post("/logout");
    } catch (err) {
      // Proceed with logout even if API call fails.
    } finally {
      logout();
      navigate("/login");
    }
  };

  const closeMobileNavigation = () => {
    setMobileOpen(false);
  };

  const handleActivityLog = () => {
    setMobileOpen(false);
    setShowActivityLog(true);
  };

  const handleChangePassword = () => {
    setMobileOpen(false);
    setShowChangePassword(true);
  };

  useEffect(() => {
    window.scrollTo(0, 0);

    const sidebar = document.querySelector(".applicant-sidebar");
    if (sidebar) sidebar.scrollTop = 0;

    const main = document.querySelector(".applicant-main");
    if (main) main.scrollTop = 0;
  }, []);

  // Close mobile drawer if screen goes back to desktop.
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth > 767) {
        setMobileOpen(false);
      }
    };

    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  // Close mobile drawer when Escape is pressed.
  useEffect(() => {
    const handleEscape = (event) => {
      if (event.key === "Escape") {
        setMobileOpen(false);
      }
    };

    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  return (
    <>
      {/* MOBILE ONLY: HAMBURGER */}
      <button
        type="button"
        className="applicant-mobile-menu-button"
        onClick={() => setMobileOpen(true)}
        aria-label="Open applicant navigation"
        aria-expanded={mobileOpen}
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        >
          <line x1="4" y1="7" x2="20" y2="7" />
          <line x1="4" y1="12" x2="20" y2="12" />
          <line x1="4" y1="17" x2="20" y2="17" />
        </svg>
      </button>

      {/* MOBILE ONLY: BACKDROP */}
      <div
        className={
          mobileOpen
            ? "applicant-mobile-sidebar-backdrop show"
            : "applicant-mobile-sidebar-backdrop"
        }
        onClick={closeMobileNavigation}
        aria-hidden="true"
      />

      <aside
        className={[
          "applicant-sidebar",
          collapsed ? "applicant-sidebar-collapsed" : "",
          mobileOpen ? "applicant-sidebar-mobile-open" : "",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        {/* DESKTOP COLLAPSE BUTTON - EXISTING */}
        <button
          type="button"
          className="applicant-sidebar-toggle"
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

        {/* MOBILE ONLY: CLOSE BUTTON */}
        <button
          type="button"
          className="applicant-mobile-sidebar-close"
          onClick={closeMobileNavigation}
          aria-label="Close applicant navigation"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          >
            <line x1="6" y1="6" x2="18" y2="18" />
            <line x1="18" y1="6" x2="6" y2="18" />
          </svg>
        </button>

        {/* BRAND */}
        <NavLink
          className="applicant-sidebar-brand"
          to="/ApplicantDashboard"
          onClick={closeMobileNavigation}
        >
          <img src="/icons/sk-logo.jpg" alt="logo" />

          <div className="applicant-sidebar-brand-text">
            <h5>SK Mamatid</h5>
            <span>Applicant Panel</span>
          </div>
        </NavLink>

        {/* NAVIGATION */}
        <nav className="applicant-sidebar-nav">
          <NavLink
            to="/ApplicantDashboard"
            onClick={closeMobileNavigation}
            className={({ isActive }) =>
              isActive
                ? "applicant-sidebar-link active"
                : "applicant-sidebar-link"
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

            <span className="applicant-sidebar-label">
              Dashboard
            </span>
          </NavLink>

          <NavLink
            to="/ApplicantSubmission"
            onClick={closeMobileNavigation}
            className={({ isActive }) =>
              isActive
                ? "applicant-sidebar-link active"
                : "applicant-sidebar-link"
            }
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M12 16V4M12 4l-4 4M12 4l4 4" />
              <path d="M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
            </svg>

            <span className="applicant-sidebar-label">
              Application Submission
            </span>
          </NavLink>

          <NavLink
            to="/ApplicantStatus"
            onClick={closeMobileNavigation}
            className={({ isActive }) =>
              isActive
                ? "applicant-sidebar-link active"
                : "applicant-sidebar-link"
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

            <span className="applicant-sidebar-label">
              Application Status
            </span>
          </NavLink>

          <NavLink
            to="/ApplicantClaimingSchedule"
            onClick={closeMobileNavigation}
            className={({ isActive }) =>
              isActive
                ? "applicant-sidebar-link active"
                : "applicant-sidebar-link"
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

            <span className="applicant-sidebar-label">
              Claiming Schedule
            </span>
          </NavLink>

          <div className="applicant-sidebar-divider" />

          <NavLink
            to="/ApplicantProfile"
            onClick={closeMobileNavigation}
            className={({ isActive }) =>
              isActive
                ? "applicant-sidebar-link active"
                : "applicant-sidebar-link"
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

            <span className="applicant-sidebar-label">
              My Profile
            </span>
          </NavLink>

          <button
            type="button"
            className="applicant-sidebar-link applicant-sidebar-btn"
            onClick={handleActivityLog}
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

            <span className="applicant-sidebar-label">
              Activity Log
            </span>
          </button>

          <button
            type="button"
            className="applicant-sidebar-link applicant-sidebar-btn"
            onClick={handleChangePassword}
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

            <span className="applicant-sidebar-label">
              Change Password
            </span>
          </button>
        </nav>

        {/* LOGOUT */}
        <button
          type="button"
          className="applicant-sidebar-logout"
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

          <span className="applicant-sidebar-label">
            Logout
          </span>
        </button>
      </aside>

      <ApplicantActivityLogModal
        show={showActivityLog}
        onClose={() => setShowActivityLog(false)}
      />

      <ApplicantChangePasswordModal
        show={showChangePassword}
        onClose={() => setShowChangePassword(false)}
      />
    </>
  );
}

export default ApplicantNavigation;