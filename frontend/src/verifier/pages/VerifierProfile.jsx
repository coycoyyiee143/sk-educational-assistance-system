import { useState, useEffect } from "react";
import VerifierNavigation from "../components/VerifierNavigation";
import { useAuth } from "../../context/AuthContext";
import api from "../../services/api";
import PanelFooter from "../../components/PanelFooter";
function VerifierProfile() {
  const { user, login, token } = useAuth();
  const [form, setForm] = useState({ first_name: "", last_name: "", mobile_number: "" });
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");
  const [countdown, setCountdown] = useState(10);
  useEffect(() => {
    if (user) {
      setForm({
        first_name: user.first_name ?? "",
        last_name: user.last_name ?? "",
        mobile_number: user.mobile_number ?? "",
      });
    }
  }, [user]);
  useEffect(() => {
    if (!success && !error) return;
    setCountdown(10);
    const tick = setInterval(() => {
      setCountdown((c) => (c <= 1 ? 0 : c - 1));
    }, 1000);
    const dismiss = setTimeout(() => {
      setSuccess("");
      setError("");
    }, 10000);
    return () => {
      clearInterval(tick);
      clearTimeout(dismiss);
    };
  }, [success, error]);
  const setF = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSuccess("");
    setSaving(true);
    try {
      const res = await api.put("/user/profile", form);
      login(res.data.user, token);
      setSuccess("Profile updated successfully.");
    } catch (err) {
      setError(err.response?.data?.message || "Failed to update profile.");
    } finally {
      setSaving(false);
    }
  }
  return (
    <div className="verifier-layout">
      <VerifierNavigation />
      <div className="verifier-main">
        <div className="verifier-topbar">
          <div className="verifier-topbar-user">
            <div className="verifier-topbar-user-text">
              <span className="verifier-topbar-user-name">Verifier User</span>
              <span className="verifier-topbar-user-role">Sangguniang Kabataan</span>
            </div>
            <div className="verifier-topbar-avatar"></div>
          </div>
        </div>
        <section className="page-section">
          <div className="container-fluid">
            <div className="verifier-dashboard-header">
              <h3 className="verifier-dashboard-title">Verifier Profile</h3>
              <p className="verifier-dashboard-desc">View and update your verifier profile information.</p>
            </div>
            <div className="content-card verifier-profile-card">
              <h4 className="verifier-profile-title">Profile Information</h4>
              <form onSubmit={handleSubmit}>
                <div className="row g-3">
                  <div className="col-md-6">
                    <label className="form-label">First Name</label>
                    <input className="form-control" value={form.first_name} onChange={setF("first_name")} required />
                  </div>
                  <div className="col-md-6">
                    <label className="form-label">Last Name</label>
                    <input className="form-control" value={form.last_name} onChange={setF("last_name")} required />
                  </div>
                  <div className="col-md-6">
                    <label className="form-label">Mobile Number</label>
                    <input className="form-control" value={form.mobile_number} onChange={setF("mobile_number")} />
                  </div>
                  <div className="col-md-6">
                    <label className="form-label">Email</label>
                    <input className="form-control" value={user?.email ?? ""} disabled />
                  </div>
                  <div className="col-md-6">
                    <label className="form-label">Role</label>
                    <input className="form-control" value="SK Verifier" disabled />
                  </div>
                </div>
                <div className="mt-4 d-flex gap-2">
                  <button type="submit" className="btn btn-save-green" disabled={saving}>
                    {saving ? "Saving..." : "Save Changes"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </section>
        <PanelFooter />
      </div>
      {(success || error) && (
        <div className="verifier-password-feedback-backdrop">
          <div className={`verifier-password-feedback ${error ? "verifier-password-feedback-error" : "verifier-password-feedback-success"}`}>
            <div className="verifier-password-feedback-icon-wrap">
              <span className="verifier-password-feedback-icon">{error ? "!" : "✓"}</span>
            </div>
            <h4 className="verifier-password-feedback-title">{error ? "Something Went Wrong" : "Profile Updated"}</h4>
            <p className="verifier-password-feedback-message">{error || success}</p>
            <button
              type="button"
              className="verifier-password-feedback-dismiss"
              onClick={() => {
                setSuccess("");
                setError("");
              }}
            >
              <span>Dismiss</span>
              <span className="verifier-password-feedback-arrow">→</span>
              <span className="verifier-password-feedback-timer">{countdown}s</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
export default VerifierProfile;