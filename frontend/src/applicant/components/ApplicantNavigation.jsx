import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import api from "../../services/api";

const navLinks = [
  { label: "Dashboard", to: "/ApplicantDashboard" },
  { label: "Profile", to: "/ApplicantProfile" },
  { label: "Application Submission", to: "/ApplicantSubmission" },
  { label: "Application Status", to: "/ApplicantStatus" },
  { label: "Claiming Schedule", to: "/ApplicantClaimingSchedule" },
];

function ApplicantNavigation() {
  const [navOpen, setNavOpen] = useState(false);
  const location = useLocation();
  const { logout } = useAuth();
  const navigate = useNavigate();

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
              <button className="nav-link btn btn-link" onClick={handleLogout}>
                Logout
              </button>
            </li>
          </ul>
        </div>
      </div>
    </nav>
  );
}

export default ApplicantNavigation;