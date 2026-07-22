import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import VerifierNavigation from "../components/VerifierNavigation";
import { useAuth } from "../../context/AuthContext";
import api from "../../services/api";

function VerifierProfile() {
  const { user, login, token } = useAuth();
  const [form, setForm] = useState({ first_name: "", last_name: "", mobile_number: "" });
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (user) {
      setForm({
        first_name: user.first_name ?? "",
        last_name: user.last_name ?? "",
        mobile_number: user.mobile_number ?? "",
      });
    }
  }, [user]);

  const setF = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSuccess("");
    setSaving(true);
    try {
      const res = await api.put("/user/profile", form);
      login(res.data.user, token);
      setSuccess("Profile updated.");
    } catch (err) {
      setError(err.response?.data?.message || "Failed to update profile.");
    } finally {
      setSaving(false);
    }
  }



  return (
    <div>
      <VerifierNavigation />
      <section className="page-section">
        <div className="container">
          <h3 className="section-title">Verifier Profile</h3>

          {success && <div className="alert alert-success">{success}</div>}
          {error && <div className="alert alert-danger">{error}</div>}

          <div className="content-card">
            <h4>Profile Information</h4>
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
                <button type="submit" className="btn btn-custom" disabled={saving}>{saving ? "Saving..." : "Save Changes"}</button>
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