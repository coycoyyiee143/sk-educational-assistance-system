import React, { useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import api from "../../services/api";
import AdminChangePasswordModal from "../pages/AdminChangePasswordModal";
import AdminActivityLogModal from "../pages/AdminActivityLogModal";

function AdminNavigation() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [usersMenuOpen, setUsersMenuOpen] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [showActivityLog, setShowActivityLog] = useState(false);

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
          <NavLink className="navbar-brand-custom" to="/AdminDashboard">
            <img src="/logo.png" alt="logo" />
            <div className="brand-text">
              <h5>SK Barangay Mamatid</h5>
              <span>Admin Panel</span>
            </div>
          </NavLink>

          <button className="navbar-toggler bg-light" type="button" data-bs-toggle="collapse" data-bs-target="#adminNavbar">
            <span className="navbar-toggler-icon"></span>
          </button>

          <div className="collapse navbar-collapse justify-content-end" id="adminNavbar">
            <ul className="navbar-nav">
              <li className="nav-item">
                <NavLink to="/AdminDashboard" className={({ isActive }) => isActive ? "nav-link active" : "nav-link"}>
                  Dashboard
                </NavLink>
              </li>

              <li className="nav-item dropdown">
                <button
                  className="nav-link dropdown-toggle btn btn-link"
                  onClick={() => setUsersMenuOpen(!usersMenuOpen)}
                >
                  Users
                </button>
                {usersMenuOpen && (
                  <ul className="dropdown-menu dropdown-menu-end show">
                    <li>
                      <NavLink
                        to="/AdminUsers"
                        className="dropdown-item"
                        onClick={() => setUsersMenuOpen(false)}
                      >
                        Manage Users
                      </NavLink>
                    </li>
                    <li>
                      <NavLink
                        to="/AdminMasterActivityLog"
                        className="dropdown-item"
                        onClick={() => setUsersMenuOpen(false)}
                      >
                        System Activity Log
                      </NavLink>
                    </li>
                    <li>
                      <button
                        className="dropdown-item"
                        onClick={() => {
                          setShowActivityLog(true);
                          setUsersMenuOpen(false);
                        }}
                      >
                        Your Activity Log
                      </button>
                    </li>
                    <li>
                      <button
                        className="dropdown-item"
                        onClick={() => {
                          setShowChangePassword(true);
                          setUsersMenuOpen(false);
                        }}
                      >
                        Change Password
                      </button>
                    </li>
                  </ul>
                )}
              </li>

              <li className="nav-item">
                <NavLink className="nav-link" to="/AdminSettings">Application Settings</NavLink>
              </li>
              <li className="nav-item">
                <NavLink className="nav-link" to="/AdminSchedule">Schedules</NavLink>
              </li>
              <li className="nav-item">
                <NavLink className="nav-link" to="/AdminAnnouncements">Announcements</NavLink>
              </li>
              <li className="nav-item">
                <NavLink className="nav-link" to="/AdminEvents">Events</NavLink>
              </li>
              <li className="nav-item">
                <NavLink className="nav-link" to="/AdminReports">Reports</NavLink>
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

      <AdminChangePasswordModal show={showChangePassword} onClose={() => setShowChangePassword(false)} />
      <AdminActivityLogModal show={showActivityLog} onClose={() => setShowActivityLog(false)} />
    </>
  );
}

export default AdminNavigation;