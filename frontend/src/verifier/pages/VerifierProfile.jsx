import { useState } from "react";
import { Link } from "react-router-dom";
import VerifierNavigation from "../components/VerifierNavigation";

// ── Component ─────────────────────────────────────────────────────────────────

function VerifierProfile() {
  const [profile, setProfile] = useState({
    name:    "Juan Dela Cruz",
    email:   "verifier@email.com",
    contact: "09123456789",
  });

  const [passwords, setPasswords] = useState({
    current: "",
    newPass: "",
    confirm: "",
  });

  const setProfile_ = (k) => (e) => setProfile((f) => ({ ...f, [k]: e.target.value }));
  const setPass     = (k) => (e) => setPasswords((f) => ({ ...f, [k]: e.target.value }));

  function handleSubmit(e) {
    e.preventDefault();
    // TODO: connect to backend
    console.log("Saved:", { profile, passwords });
  }

  return (
    <div>
      <VerifierNavigation />

      <section className="page-section">
        <div className="container">

          <h3 className="section-title">Verifier Profile</h3>

          <div className="content-card">
            <h4>Profile Information</h4>

            <div className="info-box">
              Update your verifier account information and change your password if needed.
            </div>

            <form onSubmit={handleSubmit}>
              <div className="row g-3">
                <div className="col-md-6">
                  <label className="form-label">Full Name</label>
                  <input
                    type="text"
                    className="form-control"
                    value={profile.name}
                    onChange={setProfile_("name")}
                  />
                </div>

                <div className="col-md-6">
                  <label className="form-label">Email Address</label>
                  <input
                    type="email"
                    className="form-control"
                    value={profile.email}
                    onChange={setProfile_("email")}
                  />
                </div>

                <div className="col-md-6">
                  <label className="form-label">Contact Number</label>
                  <input
                    type="text"
                    className="form-control"
                    value={profile.contact}
                    onChange={setProfile_("contact")}
                  />
                </div>

                <div className="col-md-6">
                  <label className="form-label">Role</label>
                  <input type="text" className="form-control" value="SK Verifier" disabled />
                </div>
              </div>

              <hr className="my-4" />

              <h4 className="mb-3">Change Password</h4>

              <div className="row g-3">
                <div className="col-md-4">
                  <label className="form-label">Current Password</label>
                  <input
                    type="password"
                    className="form-control"
                    placeholder="Enter current password"
                    value={passwords.current}
                    onChange={setPass("current")}
                  />
                </div>

                <div className="col-md-4">
                  <label className="form-label">New Password</label>
                  <input
                    type="password"
                    className="form-control"
                    placeholder="Enter new password"
                    value={passwords.newPass}
                    onChange={setPass("newPass")}
                  />
                </div>

                <div className="col-md-4">
                  <label className="form-label">Confirm New Password</label>
                  <input
                    type="password"
                    className="form-control"
                    placeholder="Confirm new password"
                    value={passwords.confirm}
                    onChange={setPass("confirm")}
                  />
                </div>
              </div>

              <div className="mt-4 d-flex gap-2">
                <button type="submit" className="btn btn-custom">Save Changes</button>
                <Link to="/VerifierDashboard" className="btn btn-secondary">Cancel</Link>
              </div>
            </form>
          </div>

        </div>
      </section>

      <footer>
        <div className="container">
          <p className="mb-0">© 2026 Sangguniang Kabataan of Barangay Mamatid | Verifier Panel</p>
        </div>
      </footer>
    </div>
  );
}

export default VerifierProfile;