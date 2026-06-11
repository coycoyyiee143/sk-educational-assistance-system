import { useState } from "react";
import { Link, useLocation } from "react-router-dom";

const navLinks = [
  { label: "Dashboard",            to: "/ApplicantDashboard" },
  { label: "Profile",              to: "/ApplicantProfile" },
  { label: "Application Submission", to: "/ApplicantSubmission" },
  { label: "Application Status",   to: "/ApplicantStatus" },
  { label: "Claiming Schedule",    to: "/ApplicantClaimingSchedule" },
];

function ApplicantNavigation() {
  const [navOpen, setNavOpen] = useState(false);
  const location = useLocation();

  return (
    <nav className="navbar navbar-expand-lg sticky-top navbar-custom">
      <div className="container">

        <Link className="navbar-brand-custom" to="/ApplicantDashboard">
          <img src="/logo.png" alt="SK Logo" />
          <div className="brand-text">
            <h5>SK Barangay Mamatid</h5>
            <span>Applicant Panel</span>
          </div>
        </Link>

        <button
          className="navbar-toggler bg-light"
          type="button"
          onClick={() => setNavOpen(!navOpen)}
          aria-label="Toggle navigation"
        >
          <span className="navbar-toggler-icon"></span>
        </button>

        <div className={`collapse navbar-collapse justify-content-end${navOpen ? " show" : ""}`}>
          <ul className="navbar-nav">
            {navLinks.map((link) => (
              <li className="nav-item" key={link.label}>
                <Link
                  className={`nav-link${location.pathname === link.to ? " active" : ""}`}
                  to={link.to}
                  onClick={() => setNavOpen(false)}
                >
                  {link.label}
                </Link>
              </li>
            ))}
            <li className="nav-item">
              <Link className="nav-link" to="/login" onClick={() => setNavOpen(false)}>
                Logout
              </Link>
            </li>
          </ul>
        </div>

      </div>
    </nav>
  );
}

export default ApplicantNavigation;