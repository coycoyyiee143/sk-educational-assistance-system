import { useState } from "react";
import api from "../../services/api";

function VerifierChangePasswordModal({ show, onClose }) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  function resetForm() {
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setError("");
    setSuccess("");
  }

  function handleClose() {
    resetForm();
    onClose();
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (newPassword !== confirmPassword) {
      setError("New password and confirmation do not match.");
      return;
    }

    setSaving(true);
    try {
      await api.put("/user/password", {
        current_password: currentPassword,
        password: newPassword,
        password_confirmation: confirmPassword,
      });
      setSuccess("Password updated successfully.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      const message = err.response?.data?.message;
      const errors = err.response?.data?.errors;
      if (errors) {
        setError(Object.values(errors).flat().join(" "));
      } else {
        setError(message || "Failed to update password.");
      }
    } finally {
      setSaving(false);
    }
  }

  if (!show) return null;

  return (
    <>
      <div className="modal-backdrop show" onClick={handleClose}></div>

      <div className="modal show d-block" tabIndex="-1" role="dialog">
        <div className="modal-dialog modal-dialog-centered" role="document">
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title">Change Password</h5>
              <button type="button" className="btn-close" onClick={handleClose}></button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                {error && <div className="error-box">{error}</div>}
                {success && <div className="success-box">{success}</div>}

                <div className="mb-3">
                  <label className="form-label">Current Password</label>
                  <div className="input-group">
                    <input
                      type={showCurrent ? "text" : "password"}
                      className="form-control"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      required
                    />
                    <button
                      type="button"
                      className="btn btn-outline-secondary"
                      onClick={() => setShowCurrent(!showCurrent)}
                      tabIndex={-1}
                    >
                      {showCurrent ? "Hide" : "Show"}
                    </button>
                  </div>
                </div>

                <div className="mb-3">
                  <label className="form-label">New Password</label>
                  <div className="input-group">
                    <input
                      type={showNew ? "text" : "password"}
                      className="form-control"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      minLength={8}
                      required
                    />
                    <button
                      type="button"
                      className="btn btn-outline-secondary"
                      onClick={() => setShowNew(!showNew)}
                      tabIndex={-1}
                    >
                      {showNew ? "Hide" : "Show"}
                    </button>
                  </div>
                </div>

                <div className="mb-3">
                  <label className="form-label">Confirm New Password</label>
                  <div className="input-group">
                    <input
                      type={showConfirm ? "text" : "password"}
                      className="form-control"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      minLength={8}
                      required
                    />
                    <button
                      type="button"
                      className="btn btn-outline-secondary"
                      onClick={() => setShowConfirm(!showConfirm)}
                      tabIndex={-1}
                    >
                      {showConfirm ? "Hide" : "Show"}
                    </button>
                  </div>
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary-custom" onClick={handleClose}>
                  Close
                </button>
                <button type="submit" className="btn btn-save" disabled={saving}>
                  {saving ? "Saving..." : "Update Password"}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </>
  );
}

export default VerifierChangePasswordModal;