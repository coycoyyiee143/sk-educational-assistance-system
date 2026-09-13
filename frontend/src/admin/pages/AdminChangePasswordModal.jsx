import { useState, useEffect } from "react";
import api from "../../services/api";
function AdminChangePasswordModal({ show, onClose }) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [errorList, setErrorList] = useState([]);
  const [success, setSuccess] = useState("");
  const [countdown, setCountdown] = useState(10);
  useEffect(() => {
    if (!error && errorList.length === 0 && !success) return;
    setCountdown(10);
    const tick = setInterval(() => {
      setCountdown((c) => (c <= 1 ? 0 : c - 1));
    }, 1000);
    const dismiss = setTimeout(() => {
      setError("");
      setErrorList([]);
      setSuccess("");
    }, 10000);
    return () => {
      clearInterval(tick);
      clearTimeout(dismiss);
    };
  }, [error, errorList, success]);
  function resetForm() {
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setError("");
    setErrorList([]);
    setSuccess("");
  }
  function handleClose() {
    resetForm();
    onClose();
  }
  function clearFeedback() {
    setError("");
    setErrorList([]);
    setSuccess("");
  }
  async function handleSubmit(e) {
    e.preventDefault();
    clearFeedback();
    const passwordRule = /^(?=.*[a-z])(?=.*\d).{8,}$/;
    if (!passwordRule.test(newPassword)) {
      setError("New password must be at least 8 characters, with a lowercase letter and a number.");
      return;
    }
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
      onClose();
    } catch (err) {
      const message = err.response?.data?.message;
      const errors = err.response?.data?.errors;
      if (errors) {
        const messages = Object.values(errors).flat();
        if (messages.length > 1) {
          setErrorList(messages);
        } else {
          setError(messages[0]);
        }
      } else {
        setError(message || "Failed to update password.");
      }
    } finally {
      setSaving(false);
    }
  }
  if (!show && !error && errorList.length === 0 && !success) return null;
  const hasLength = newPassword.length >= 8;
  const hasLowercase = /[a-z]/.test(newPassword);
  const hasNumber = /\d/.test(newPassword);
  const showFeedback = error || errorList.length > 0 || success;
  return (
    <>
      {show && (
        <>
          <div className="modal-backdrop show" onClick={handleClose}></div>
          <div className="modal show d-block" tabIndex="-1" role="dialog">
            <div className="modal-dialog modal-dialog-centered" role="document">
              <div className="modal-content admin-password-modal admin-password-modal-new">
                <div className="admin-password-modal-header-new">
                  <div className="admin-password-modal-heading-new">
                    <div className="admin-password-lock-icon">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <rect x="5" y="11" width="14" height="10" rx="2"></rect>
                        <path d="M8 11V7a4 4 0 0 1 8 0v4"></path>
                      </svg>
                    </div>
                    <h5>Change Password</h5>
                  </div>
                  <button type="button" className="admin-password-close-new" onClick={handleClose}>×</button>
                </div>
                <form onSubmit={handleSubmit}>
                  <div className="admin-password-modal-body-new">
                    <div className="admin-password-field">
                      <label>CURRENT PASSWORD</label>
                      <div className="admin-password-input-wrap">
                        <input
                          type={showCurrent ? "text" : "password"}
                          placeholder="Enter current password"
                          value={currentPassword}
                          onChange={(e) => setCurrentPassword(e.target.value)}
                          required
                        />
                        <button
                          type="button"
                          onClick={() => setShowCurrent(!showCurrent)}
                          tabIndex={-1}
                        >
                          {showCurrent ? "Hide" : "Show"}
                        </button>
                      </div>
                    </div>
                    <div className="admin-password-field">
                      <label>NEW PASSWORD</label>
                      <div className="admin-password-input-wrap">
                        <input
                          type={showNew ? "text" : "password"}
                          placeholder="Enter new password"
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          minLength={8}
                          required
                        />
                        <button
                          type="button"
                          onClick={() => setShowNew(!showNew)}
                          tabIndex={-1}
                        >
                          {showNew ? "Hide" : "Show"}
                        </button>
                      </div>
                    </div>
                    <div className="admin-password-field">
                      <label>CONFIRM NEW PASSWORD</label>
                      <div className="admin-password-input-wrap">
                        <input
                          type={showConfirm ? "text" : "password"}
                          placeholder="Confirm new password"
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          minLength={8}
                          required
                        />
                        <button
                          type="button"
                          onClick={() => setShowConfirm(!showConfirm)}
                          tabIndex={-1}
                        >
                          {showConfirm ? "Hide" : "Show"}
                        </button>
                      </div>
                      {confirmPassword && (
                        newPassword === confirmPassword ? (
                          <span className="admin-password-match">✓ Passwords match</span>
                        ) : (
                          <span className="admin-password-match" style={{ color: "#dc3545" }}>✕ Passwords do not match</span>
                        )
                      )}
                    </div>
                    <div className="admin-password-requirements">
                      <span className="admin-password-requirements-title">PASSWORD REQUIREMENTS</span>
                      <div className="admin-password-requirement-item">
                        <span>{hasLength ? "✓" : "○"}</span>
                        <p>At least 8 characters</p>
                      </div>
                      <div className="admin-password-requirement-item">
                        <span>{hasLowercase ? "✓" : "○"}</span>
                        <p>A lowercase letter</p>
                      </div>
                      <div className="admin-password-requirement-item">
                        <span>{hasNumber ? "✓" : "○"}</span>
                        <p>At least one number</p>
                      </div>
                    </div>
                  </div>
                  <div className="admin-password-modal-footer-new">
                    <button type="button" className="btn btn-secondary-custom" onClick={handleClose}>
                      Cancel
                    </button>
                    <button type="submit" className="admin-password-update-new" disabled={saving}>
                      {saving ? "Saving..." : "Update Password"}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </>
      )}
      {showFeedback && (
        <div className="feedback-popup-backdrop">
          <div className={`feedback-popup ${error || errorList.length > 0 ? "feedback-popup-error" : "feedback-popup-success"}`}>
            <div className="feedback-popup-icon-wrap">
              <span className="feedback-popup-icon">{error || errorList.length > 0 ? "!" : "✓"}</span>
            </div>
            <h4 className="feedback-popup-title">
              {errorList.length > 0
                ? "Your password needs a few changes"
                : error
                  ? "Something Went Wrong"
                  : "Password Updated"}
            </h4>

            {errorList.length > 0 ? (
              <ul
                style={{
                  listStyle: "none",
                  margin: "0 0 4px",
                  padding: 0,
                  textAlign: "left",
                  width: "100%",
                }}
              >
                {errorList.map((msg, i) => (
                  <li
                    key={i}
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: "8px",
                      padding: "6px 0",
                      borderBottom:
                        i < errorList.length - 1
                          ? "1px solid rgba(0,0,0,0.06)"
                          : "none",
                    }}
                  >
                    <span style={{ color: "#dc3545", fontWeight: 700, flexShrink: 0 }}>
                      ✕
                    </span>
                    <span className="feedback-popup-message" style={{ margin: 0 }}>
                      {msg}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="feedback-popup-message">{error || success}</p>
            )}

            <button
              type="button"
              className="feedback-popup-dismiss"
              onClick={clearFeedback}
            >
              <span>Dismiss</span>
              <span className="feedback-popup-arrow">→</span>
              <span className="feedback-popup-timer">{countdown}s</span>
            </button>
          </div>
        </div>
      )}
    </>
  );
}
export default AdminChangePasswordModal;