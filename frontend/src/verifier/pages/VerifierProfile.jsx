import { useState, useEffect, useRef } from "react";
import VerifierNavigation from "../components/VerifierNavigation";
import VerifierTopbar from "../components/VerifierTopbar";
import { useAuth } from "../../context/AuthContext";
import { useAvatarPhoto } from "../../hooks/useAvatarPhoto";
import api from "../../services/api";
import PanelFooter from "../../components/PanelFooter";

function VerifierProfile() {
  const { user, login, token } = useAuth();
  const avatarUrl = useAvatarPhoto(user?.avatar_url);
  const fileInputRef = useRef(null);

  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    mobile_number: "",
  });

  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");
  const [countdown, setCountdown] = useState(10);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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

  const setF = (k) => (e) =>
    setForm((f) => ({
      ...f,
      [k]: e.target.value,
    }));

  async function handleAvatarChange(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setError("");
    setSuccess("");
    setUploadingAvatar(true);

    try {
      const formData = new FormData();
      formData.append("avatar", file);

      const res = await api.post("/user/avatar", formData);

      login(res.data.user, token);
      setSuccess("Profile photo updated successfully.");
    } catch (err) {
      setError(
        err.response?.data?.message || "Failed to update profile photo."
      );
    } finally {
      setUploadingAvatar(false);
    }
  }

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
      setError(
        err.response?.data?.message ||
          "Failed to update profile."
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="verifier-layout">
      <VerifierNavigation
        mobileOpen={mobileMenuOpen}
        onMobileClose={() => setMobileMenuOpen(false)}
      />

      <div className="verifier-main">
        <VerifierTopbar
          onMenuOpen={() => setMobileMenuOpen(true)}
        />

        <section className="page-section">
          <div className="container-fluid">
            <div className="verifier-dashboard-header">
              <h3 className="verifier-dashboard-title">
                Verifier Profile
              </h3>

              <p className="verifier-dashboard-desc">
                View and update your verifier profile information.
              </p>
            </div>

            <div className="content-card verifier-profile-card">
              <h4 className="verifier-profile-title">
                Profile Information
              </h4>

              <div className="verifier-profile-avatar-row">
                <div className="verifier-profile-avatar-preview">
                  {avatarUrl ? (
                    <img src={avatarUrl} alt="" />
                  ) : (
                    <span className="verifier-profile-avatar-fallback">
                      {(user?.first_name?.[0] || "") +
                        (user?.last_name?.[0] || "")}
                    </span>
                  )}
                </div>

                <div>
                  <input
                    type="file"
                    accept="image/png,image/jpeg"
                    ref={fileInputRef}
                    onChange={handleAvatarChange}
                    hidden
                  />

                  <button
                    type="button"
                    className="btn btn-outline-secondary btn-sm"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadingAvatar}
                  >
                    {uploadingAvatar ? "Uploading..." : "Change Photo"}
                  </button>

                  <p className="verifier-profile-avatar-hint">
                    JPG or PNG, up to 5MB.
                  </p>
                </div>
              </div>

              <form onSubmit={handleSubmit}>
                <div className="row g-3">
                  <div className="col-md-6">
                    <label className="form-label">
                      First Name
                    </label>

                    <input
                      className="form-control"
                      value={form.first_name}
                      onChange={setF("first_name")}
                      required
                    />
                  </div>

                  <div className="col-md-6">
                    <label className="form-label">
                      Last Name
                    </label>

                    <input
                      className="form-control"
                      value={form.last_name}
                      onChange={setF("last_name")}
                      required
                    />
                  </div>

                  <div className="col-md-6">
                    <label className="form-label">
                      Mobile Number
                    </label>

                    <input
                      className="form-control"
                      value={form.mobile_number}
                      onChange={setF("mobile_number")}
                    />
                  </div>

                  <div className="col-md-6">
                    <label className="form-label">
                      Email
                    </label>

                    <input
                      className="form-control"
                      value={user?.email ?? ""}
                      disabled
                    />
                  </div>

                  <div className="col-md-6">
                    <label className="form-label">
                      Role
                    </label>

                    <input
                      className="form-control"
                      value="SK Verifier"
                      disabled
                    />
                  </div>
                </div>

                <div className="mt-4 d-flex gap-2">
                  <button
                    type="submit"
                    className="btn btn-save-green"
                    disabled={saving}
                  >
                    {saving
                      ? "Saving..."
                      : "Save Changes"}
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
          <div
            className={`verifier-password-feedback ${
              error
                ? "verifier-password-feedback-error"
                : "verifier-password-feedback-success"
            }`}
          >
            <div className="verifier-password-feedback-icon-wrap">
              <span className="verifier-password-feedback-icon">
                {error ? "!" : "✓"}
              </span>
            </div>

            <h4 className="verifier-password-feedback-title">
              {error
                ? "Something Went Wrong"
                : "Profile Updated"}
            </h4>

            <p className="verifier-password-feedback-message">
              {error || success}
            </p>

            <button
              type="button"
              className="verifier-password-feedback-dismiss"
              onClick={() => {
                setSuccess("");
                setError("");
              }}
            >
              <span>Dismiss</span>

              <span className="verifier-password-feedback-arrow">
                →
              </span>

              <span className="verifier-password-feedback-timer">
                {countdown}s
              </span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default VerifierProfile;