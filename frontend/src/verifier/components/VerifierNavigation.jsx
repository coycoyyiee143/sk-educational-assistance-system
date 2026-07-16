import React from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import api from "../../services/api";
import VerifierActivityLogModal from "../pages/VerifierActivityModal";

function VerifierNavigation() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [showActivityLog, setShowActivityLog] = React.useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = React.useState(false);

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
    <nav className="navbar navbar-expand-lg sticky-top navbar-custom">
      <div className="container">
        <NavLink className="navbar-brand-custom" to="/VerifierDashboard"> 
          <img src="/logo.png" alt="logo" />
          <div className="brand-text">
            <h5>SK Barangay Mamatid</h5>
            <span>Verifier Panel</span>
          </div>
        </NavLink>

        <button className="navbar-toggler bg-light" type="button" data-bs-toggle="collapse" data-bs-target="#verifierNavbar">
          <span className="navbar-toggler-icon"></span>
        </button>

        <div className="collapse navbar-collapse justify-content-end" id="verifierNavbar">
          <ul className="navbar-nav">
            <li className="nav-item">
              <NavLink to="/VerifierDashboard" className={({ isActive }) => isActive ? "nav-link active" : "nav-link"}>
                Dashboard
              </NavLink>
            </li>
            <li className="nav-item">
              <NavLink to="/VerifierApplicationList" className={({ isActive }) => isActive ? "nav-link active" : "nav-link"}>
                Application List
              </NavLink>
            </li>
            <li className="nav-item">
              <NavLink to="/VerifierClaiming" className={({ isActive }) => isActive ? "nav-link active" : "nav-link"}>
                Claiming
              </NavLink>
            </li>
           <li className="nav-item dropdown">
                <button
                  className="nav-link dropdown-toggle btn btn-link"
                  onClick={() => setProfileMenuOpen(!profileMenuOpen)}
                >
                  Profile
                </button>
                {profileMenuOpen && (
                  <ul className="dropdown-menu dropdown-menu-end show">
                    <li>
                      <NavLink
                        to="/VerifierProfile"
                        className="dropdown-item"
                        onClick={() => setProfileMenuOpen(false)}
                      >
                        My Profile
                      </NavLink>
                    </li>
                    <li>
                      <button
                        className="dropdown-item"
                        onClick={() => {
                          setShowActivityLog(true);
                          setProfileMenuOpen(false);
                        }}
                      >
                        Activity Log
                      </button>
                    </li>
                  </ul>
                )}
              </li>
            <li className="nav-item">
              <button className="nav-link btn btn-link" onClick={handleLogout}>
                Logout
              </button>
            </li>
          </ul>
        </div>
      </div>
    </nav>
    <VerifierActivityLogModal show={showActivityLog} onClose={() => setShowActivityLog(false)} />
    </>
  );
}


export default VerifierNavigation;