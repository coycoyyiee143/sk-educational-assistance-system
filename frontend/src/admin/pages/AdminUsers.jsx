import { useState, useEffect, useRef } from "react";
import AdminNavigation from "../components/AdminNavigation";
import AdminTopbarUser from "../components/AdminTopbarUser";
import api from "../../services/api";
import PanelFooter from "../../components/PanelFooter";
import { useAuth } from "../../context/AuthContext";
function StatusBadge({ active }) {
  return <span className={active ? "status-badge status-active" : "status-badge status-inactive"}>{active ? "Active" : "Inactive"}</span>;
}
function RoleBadge({ role }) {
  const map = { applicant: "role-applicant", sk_verifier: "role-verifier", sk_admin: "role-admin", superadmin: "role-admin", it_support: "role-admin" };
  const labels = { applicant: "Applicant", sk_verifier: "Verifier", sk_admin: "Admin", superadmin: "Superadmin", it_support: "IT Support" };
  return <span className={map[role] ?? "role-applicant"}>{labels[role] ?? role}</span>;
}
// Shown alongside StatusBadge for personnel — distinguishes "active
// but never finished setting up their password" from a normal active
// account, since those look identical otherwise (is_active defaults
// to true at creation even though the account is unusable until the
// setup link is clicked).
function SetupPendingBadge({ emailVerifiedAt }) {
  if (emailVerifiedAt) return null;
  return (
    <span
      className="status-badge"
      style={{ background: "#fff3cd", color: "#856404", marginLeft: "4px" }}
      title="This account hasn't clicked their setup link yet and can't log in."
    >
      Setup Pending
    </span>
  );
}
function EyeIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}
function CheckCircleIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20Z" />
      <path d="m8 12 3 3 5-6" />
    </svg>
  );
}
function BanIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <line x1="4.9" y1="4.9" x2="19.1" y2="19.1" />
    </svg>
  );
}
function KeyIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
    </svg>
  );
}
function ShieldIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  );
}
function TrashIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 6h18" />
      <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <line x1="10" y1="11" x2="10" y2="17" />
      <line x1="14" y1="11" x2="14" y2="17" />
    </svg>
  );
}
function getPageNumbers(currentPage, totalPages) {
  const pages = [];
  const maxVisible = 5;
  if (totalPages <= maxVisible) {
    for (let i = 1; i <= totalPages; i++) pages.push(i);
    return pages;
  }
  pages.push(1);
  if (currentPage > 3) pages.push("...");
  const start = Math.max(2, currentPage - 1);
  const end = Math.min(totalPages - 1, currentPage + 1);
  for (let i = start; i <= end; i++) pages.push(i);
  if (currentPage < totalPages - 2) pages.push("...");
  pages.push(totalPages);
  return pages;
}
function formatDateTime(dateString) {
  if (!dateString) return "—";
  try {
    return new Date(dateString).toLocaleString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return dateString;
  }
}
function ConsentBadge({ consentedAt }) {
  if (!consentedAt) {
    return (
      <span className="applicant-detail-status applicant-detail-status-inactive">
        <span className="applicant-detail-status-dot"></span>
        Not on record
      </span>
    );
  }
  return (
    <span className="applicant-detail-status applicant-detail-status-active">
      <span className="applicant-detail-status-dot"></span>
      Agreed — {formatDateTime(consentedAt)}
    </span>
  );
}
function FaceVerificationBadge({ faceVerification }) {
  if (!faceVerification) {
    return (
      <span className="applicant-detail-status applicant-detail-status-inactive">
        <span className="applicant-detail-status-dot"></span>
        No verification on record
      </span>
    );
  }
  const isVerified = faceVerification.status === "verified";
  const score = faceVerification.registration_match_score;
  return (
    <span className={`applicant-detail-status ${isVerified ? "applicant-detail-status-active" : "applicant-detail-status-inactive"}`}>
      <span className="applicant-detail-status-dot"></span>
      {isVerified ? "Verified" : (faceVerification.status ?? "Unverified")}
      {typeof score === "number" ? ` — ${Math.round(score * 100)}% match` : ""}
      {faceVerification.verified_at ? ` — ${formatDateTime(faceVerification.verified_at)}` : ""}
    </span>
  );
}
function ViewApplicantModal({ applicant, onClose }) {
  if (!applicant) return null;
  const initials = `${applicant.first_name?.charAt(0) ?? ""}${applicant.last_name?.charAt(0) ?? ""}`.toUpperCase();
  const registeredDate = applicant.created_at
    ? new Date(applicant.created_at).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })
    : "—";
  const applicantPhoto =
    applicant.profile_photo_url ||
    applicant.photo_url ||
    applicant.image_url ||
    applicant.avatar_url ||
    applicant.profile?.photo_url ||
    null;
  return (
    <div className="modal fade show d-block" tabIndex="-1" style={{ background: "rgba(0,0,0,0.5)" }}>
      <div className="modal-dialog modal-dialog-centered" style={{ maxWidth: "700px", width: "calc(100% - 32px)" }}>
        <div className="modal-content applicant-details-modal">
          <div className="applicant-details-header">
            <div className="applicant-details-heading">
              <div className="applicant-details-heading-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <circle cx="12" cy="8" r="3.25" />
                  <path d="M5.5 19c.7-4 3-6 6.5-6s5.8 2 6.5 6" strokeLinecap="round" />
                </svg>
              </div>
              <div>
                <h5>Applicant Details</h5>
                <p>Account Information &amp; Registration Details</p>
              </div>
            </div>
            <button type="button" className="applicant-details-header-close" onClick={onClose} aria-label="Close">×</button>
          </div>
          <div className="modal-body">
            <div className="applicant-details-summary">
              <div className="applicant-details-avatar">
                {applicantPhoto ? <img src={applicantPhoto} alt={`${applicant.first_name} ${applicant.last_name}`} style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "50%" }} /> : initials || "A"}
              </div>
              <div className="applicant-details-summary-text">
                <strong>{applicant.first_name} {applicant.last_name}</strong>
                <span>Registered Applicant</span>
              </div>
              <span className={`applicant-detail-status ${applicant.is_active ? "applicant-detail-status-active" : "applicant-detail-status-inactive"}`}>
                <span className="applicant-detail-status-dot"></span>
                {applicant.is_active ? "Active" : "Inactive"}
              </span>
            </div>
            <div className="applicant-details-section">
              <div className="applicant-details-section-title">PROFILE &amp; ACCOUNT DETAILS</div>
              <div className="applicant-details-grid">
                <div className="applicant-details-field">
                  <span>First Name</span>
                  <strong>{applicant.first_name}</strong>
                </div>
                <div className="applicant-details-field">
                  <span>Last Name</span>
                  <strong>{applicant.last_name}</strong>
                </div>
                <div className="applicant-details-field">
                  <span>User ID</span>
                  <strong>{applicant.id}</strong>
                </div>
                <div className="applicant-details-field">
                  <span>Role &amp; Permissions</span>
                  <strong className="applicant-details-role">Applicant</strong>
                </div>
              </div>
            </div>
            <div className="applicant-details-section applicant-details-section-contact">
              <div className="applicant-details-section-title">CONTACT &amp; REGISTRATION</div>
              <div className="applicant-details-grid">
                <div className="applicant-details-field">
                  <span>Email Address</span>
                  <strong className="applicant-details-email">{applicant.email}</strong>
                </div>
                <div className="applicant-details-field">
                  <span>Registered Date</span>
                  <strong>{registeredDate}</strong>
                </div>
              </div>
            </div>
            <div className="applicant-details-section applicant-details-section-verification">
              <div className="applicant-details-section-title">VERIFICATION &amp; CONSENT</div>
              <div className="applicant-details-grid">
                <div className="applicant-details-field">
                  <span>Data Privacy Notice</span>
                  <ConsentBadge consentedAt={applicant.privacy_consent_at} />
                </div>
                <div className="applicant-details-field">
                  <span>Face ID Verification</span>
                  <FaceVerificationBadge faceVerification={applicant.face_verification} />
                </div>
              </div>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="applicant-details-close-btn" onClick={onClose}>Close</button>
          </div>
        </div>
      </div>
    </div>
  );
}
// No password field anymore — the new account gets an unguessable
// placeholder password and a one-time setup link emailed to them
// instead. Neither this form nor the admin submitting it ever sees or
// chooses the account's real password.
function AddPersonnelModal({ onClose, onSave, actingRole }) {
  const [form, setForm] = useState({ first_name: "", last_name: "", email: "", role: "", is_active: true });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const roleOptions = actingRole === "it_support"
    ? [["sk_verifier", "Verifier"], ["sk_admin", "Admin"], ["it_support", "IT Support"]]
    : [["sk_verifier", "Verifier"], ["sk_admin", "Admin"], ["superadmin", "Superadmin"], ["it_support", "IT Support"]];

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      await onSave(form);
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || Object.values(err.response?.data?.errors ?? {}).flat().join(" ") || "Failed.");
    } finally {
      setSaving(false);
    }
  }
  return (
    <div className="modal fade show d-block" tabIndex="-1" style={{ background: "rgba(0,0,0,0.5)" }}>
      <div className="modal-dialog modal-lg modal-dialog-centered">
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title">Add New Personnel</h5>
            <button type="button" className="btn-close" onClick={onClose} />
          </div>
          <form onSubmit={handleSubmit}>
            <div className="modal-body">
              {error && <div className="alert alert-danger">{error}</div>}
              <div className="alert alert-info" style={{ fontSize: "13.5px" }}>
                A setup link will be emailed to this person — they'll choose
                their own password when they click it. You won't set or see
                their password here.
              </div>
              <div className="row g-3">
                <div className="col-md-6">
                  <label className="form-label">First Name</label>
                  <input className="form-control" value={form.first_name} onChange={set("first_name")} required />
                </div>
                <div className="col-md-6">
                  <label className="form-label">Last Name</label>
                  <input className="form-control" value={form.last_name} onChange={set("last_name")} required />
                </div>
                <div className="col-md-6">
                  <label className="form-label">Email</label>
                  <input type="email" className="form-control" value={form.email} onChange={set("email")} required />
                </div>
                <div className="col-md-6">
                  <label className="form-label">Role</label>
                  <select className="form-select" value={form.role} onChange={set("role")} required>
                    <option value="" disabled>Select role</option>
                    {roleOptions.map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={onClose} disabled={saving}>Cancel</button>
              <button type="submit" className="btn btn-custom" disabled={saving}>
                {saving ? "Sending..." : "Create & Send Setup Link"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
function AdminUsers() {
  const { user: currentUser } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [applicants, setApplicants] = useState([]);
  const [personnel, setPersonnel] = useState([]);
  const [loading, setLoading] = useState(true);
  const [applicantSearch, setApplicantSearch] = useState("");
  const [personnelSearch, setPersonnelSearch] = useState("");
  const [viewApplicant, setViewApplicant] = useState(null);
  const [showAdd, setShowAdd] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [applicantPage, setApplicantPage] = useState(1);
  const [personnelPage, setPersonnelPage] = useState(1);
  const [roleFilter, setRoleFilter] = useState("");
  const [showRoleMenu, setShowRoleMenu] = useState(false);
  const [resetTarget, setResetTarget] = useState(null); // confirm-dialog target (password reset)
  const [resetting, setResetting] = useState(false);
  const [twoFATarget, setTwoFATarget] = useState(null); // confirm-dialog target (2FA reset)
  const [resettingTwoFA, setResettingTwoFA] = useState(false);
  const [deactivateTarget, setDeactivateTarget] = useState(null); // confirm-dialog target (deactivate only — activating is non-destructive)
  const [deactivating, setDeactivating] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null); // confirm-dialog target (delete)
  const [deleting, setDeleting] = useState(false);
  const [togglingId, setTogglingId] = useState(null); // id currently being (re)activated — guards double-click
  const roleMenuRef = useRef(null);
  const perPage = 10;
  function loadUsers() {
    api.get("/admin/users")
      .then((res) => {
        setApplicants(res.data.applicants);
        setPersonnel(res.data.personnel);
      })
      .catch(() => { })
      .finally(() => setLoading(false));
  }
  useEffect(() => { loadUsers(); }, []);
  useEffect(() => {
    if (!error && !success) return;
    const t = setTimeout(() => {
      setError("");
      setSuccess("");
    }, 6000);
    return () => clearTimeout(t);
  }, [error, success]);
  useEffect(() => {
    function handleClickOutside(e) {
      if (roleMenuRef.current && !roleMenuRef.current.contains(e.target)) setShowRoleMenu(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);
  async function toggleStatus(id) {
    setTogglingId(id);
    try {
      await api.patch(`/admin/users/${id}/toggle-status`);
      loadUsers();
    } catch {
      setError("Failed to update status.");
    } finally {
      setTogglingId(null);
    }
  }
  // Deactivating locks the account out immediately, so it goes through a
  // confirm modal like the other account-impacting actions below.
  // Re-activating isn't destructive, so that path calls toggleStatus directly.
  function handleToggleClick(p) {
    if (p.is_active) setDeactivateTarget(p);
    else toggleStatus(p.id);
  }
  async function confirmDeactivate() {
    if (!deactivateTarget) return;
    setDeactivating(true);
    setError("");
    try {
      await api.patch(`/admin/users/${deactivateTarget.id}/toggle-status`);
      setDeactivateTarget(null);
      loadUsers();
    } catch {
      setError("Failed to update status.");
    } finally {
      setDeactivating(false);
    }
  }
  async function confirmDeleteUser() {
    if (!deleteTarget) return;
    setDeleting(true);
    setError("");
    try {
      await api.delete(`/admin/users/${deleteTarget.id}`);
      setDeleteTarget(null);
      loadUsers();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to delete user.");
    } finally {
      setDeleting(false);
    }
  }
  async function savePersonnel(form) {
    await api.post("/admin/users/personnel", form);
    loadUsers();
  }
  // Admin-initiated reset: kills the current password immediately and
  // emails a fresh setup link. Confirmed via resetTarget before firing,
  // since this revokes the account's active sessions right away.
  async function confirmResetPassword() {
    if (!resetTarget) return;
    setResetting(true);
    setError("");
    setSuccess("");
    try {
      const res = await api.post(`/admin/users/${resetTarget.id}/reset-password`);
      setSuccess(res.data?.message || "Password reset. A setup link has been emailed.");
      setResetTarget(null);
      loadUsers();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to reset password.");
    } finally {
      setResetting(false);
    }
  }
  // Admin-initiated 2FA reset: clears the account's TOTP secret so
  // they're walked through QR setup again on next login. Works for
  // personnel AND applicant accounts — no self-service path exists on
  // purpose (see AdminController::resetTwoFactor docblock), so this
  // confirm dialog is the only way to recover a lost authenticator.
  async function confirmResetTwoFA() {
    if (!twoFATarget) return;
    setResettingTwoFA(true);
    setError("");
    setSuccess("");
    try {
      const res = await api.post(`/admin/users/${twoFATarget.id}/reset-2fa`);
      setSuccess(res.data?.message || "2FA has been reset.");
      setTwoFATarget(null);
      loadUsers();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to reset 2FA.");
    } finally {
      setResettingTwoFA(false);
    }
  }
  const filteredApplicants = applicants.filter((a) =>
    `${a.first_name} ${a.last_name} ${a.email}`.toLowerCase().includes(applicantSearch.toLowerCase())
  );
  const filteredPersonnel = personnel.filter((p) =>
    `${p.first_name} ${p.last_name} ${p.email}`.toLowerCase().includes(personnelSearch.toLowerCase()) &&
    (!roleFilter || p.role === roleFilter)
  );
  const applicantTotalPages = Math.max(1, Math.ceil(filteredApplicants.length / perPage));
  const applicantStart = (applicantPage - 1) * perPage;
  const pagedApplicants = filteredApplicants.slice(applicantStart, applicantStart + perPage);
  const personnelTotalPages = Math.max(1, Math.ceil(filteredPersonnel.length / perPage));
  const personnelStart = (personnelPage - 1) * perPage;
  const pagedPersonnel = filteredPersonnel.slice(personnelStart, personnelStart + perPage);
  return (
    <div className="admin-layout">
      <AdminNavigation
        mobileOpen={mobileMenuOpen}
        onMobileClose={() => setMobileMenuOpen(false)}
      />
      <div className="admin-main">
        <div className="admin-topbar">
          <AdminTopbarUser onMenuOpen={() => setMobileMenuOpen(true)} />
        </div>
        <section className="page-section">
          <div className="container-fluid">
            <div className="page-card">
              <h3 className="section-title">User Management</h3>
              <p className="text-muted mb-0">View registered applicants and manage authorized system personnel.</p>
            </div>
            {error && <div className="alert alert-danger">{error}</div>}
            {success && <div className="alert alert-success">{success}</div>}
            {/* Personnel */}
            <div className="page-card">
              <div className="d-flex justify-content-between align-items-center mb-3">
                <h4 className="sub-title sub-title-dark mb-0">Authorized Personnel</h4>
                <div className="table-header-actions">
                  <button className="btn btn-save-green" onClick={() => setShowAdd(true)}>Add Personnel</button>
                  <div className="table-toolbar-filter-wrap" ref={roleMenuRef}>
                    <button type="button" className="table-toolbar-btn table-toolbar-btn-blue" onClick={() => setShowRoleMenu((s) => !s)}>Category</button>
                    {showRoleMenu && (
                      <div className="table-toolbar-menu">
                        <button type="button" className="table-toolbar-menu-item" onClick={() => { setRoleFilter(""); setPersonnelPage(1); setShowRoleMenu(false); }}>All Roles</button>
                        <button type="button" className="table-toolbar-menu-item" onClick={() => { setRoleFilter("sk_admin"); setPersonnelPage(1); setShowRoleMenu(false); }}>Admin</button>
                        <button type="button" className="table-toolbar-menu-item" onClick={() => { setRoleFilter("sk_verifier"); setPersonnelPage(1); setShowRoleMenu(false); }}>Verifier</button>
                        <button type="button" className="table-toolbar-menu-item" onClick={() => { setRoleFilter("superadmin"); setPersonnelPage(1); setShowRoleMenu(false); }}>Superadmin</button>
                        <button type="button" className="table-toolbar-menu-item" onClick={() => { setRoleFilter("it_support"); setPersonnelPage(1); setShowRoleMenu(false); }}>IT Support</button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <div className="row mb-3">
                <div className="col-md-4">
                  <input className="form-control" placeholder="Search name or email" value={personnelSearch} onChange={(e) => { setPersonnelSearch(e.target.value); setPersonnelPage(1); }} />
                </div>
              </div>
              <div className="table-responsive">
                <table className="table table-bordered table-striped align-middle announcement-table">
                  <colgroup>
                    <col style={{ width: "5%" }} />
                    <col style={{ width: "20%" }} />
                    <col style={{ width: "24%" }} />
                    <col style={{ width: "15%" }} />
                    <col style={{ width: "10%" }} />
                    <col style={{ width: "26%" }} />
                  </colgroup>
                  <thead>
                    <tr><th>ID</th><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th>Actions</th></tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr><td colSpan={6} className="text-center py-4"><div className="spinner-border text-danger" role="status" /></td></tr>
                    ) : pagedPersonnel.length === 0 ? (
                      <tr><td colSpan={6} className="text-center text-muted py-4">No personnel accounts found.</td></tr>
                    ) : (
                      pagedPersonnel.map((p) => {
                        const isLocked = currentUser?.role === "it_support" && p.role === "superadmin";
                        return (
                        <tr key={p.id}>
                          <td>{p.id}</td>
                          <td>{p.first_name} {p.last_name}</td>
                          <td>{p.email}</td>
                          <td><RoleBadge role={p.role} /></td>
                          <td>
                            <StatusBadge active={p.is_active} />
                            <SetupPendingBadge emailVerifiedAt={p.email_verified_at} />
                          </td>
                          <td>
                            {isLocked ? (
                              <span className="text-muted" style={{ fontSize: "13px" }}>View only</span>
                            ) : (
                            <div className="user-action-group">
                              <button
                                className={`user-icon-btn ${p.is_active ? "user-icon-btn-deactivate" : "user-icon-btn-activate"}`}
                                onClick={() => handleToggleClick(p)}
                                disabled={togglingId === p.id}
                                title={p.is_active ? "Deactivate" : "Activate"}
                                aria-label={p.is_active ? "Deactivate" : "Activate"}
                              >
                                {p.is_active ? <BanIcon /> : <CheckCircleIcon />}
                              </button>
                              <button
                                className="user-icon-btn user-icon-btn-reset-password"
                                onClick={() => setResetTarget(p)}
                                disabled={p.id === currentUser?.id}
                                title={p.id === currentUser?.id ? "Use Change Password in your own account settings instead" : "Reset Password"}
                                aria-label="Reset Password"
                              >
                                <KeyIcon />
                              </button>
                              <button
                                className="user-icon-btn user-icon-btn-reset-2fa"
                                onClick={() => setTwoFATarget(p)}
                                disabled={p.id === currentUser?.id}
                                title={p.id === currentUser?.id ? "You can't reset your own 2FA this way" : "Reset 2FA — clears their authenticator setup, use if they lost their device or QR code"}
                                aria-label="Reset 2FA"
                              >
                                <ShieldIcon />
                              </button>
                              <button
                                className="user-icon-btn user-icon-btn-delete"
                                onClick={() => setDeleteTarget(p)}
                                title="Delete"
                                aria-label="Delete"
                              >
                                <TrashIcon />
                              </button>
                            </div>
                            )}
                          </td>
                        </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
              {!loading && filteredPersonnel.length > 0 && (
                <div className="table-pagination-bar">
                  <span className="table-pagination-info">Showing {personnelStart + 1}–{Math.min(personnelStart + perPage, filteredPersonnel.length)} of {filteredPersonnel.length} personnel</span>
                  <div className="table-pagination-controls">
                    <button className="table-pagination-arrow" onClick={() => setPersonnelPage((p) => Math.max(1, p - 1))} disabled={personnelPage === 1}>‹</button>
                    {getPageNumbers(personnelPage, personnelTotalPages).map((page, index) => page === "..." ? (
                      <span key={`personnel-ellipsis-${index}`} className="table-pagination-ellipsis">…</span>
                    ) : (
                      <button key={page} className={`table-pagination-page ${page === personnelPage ? "table-pagination-page-active" : ""}`} onClick={() => setPersonnelPage(page)}>{page}</button>
                    ))}
                    <button className="table-pagination-arrow" onClick={() => setPersonnelPage((p) => Math.min(personnelTotalPages, p + 1))} disabled={personnelPage === personnelTotalPages}>›</button>
                  </div>
                </div>
              )}
            </div>
            {/* Applicants */}
            <div className="page-card">
              <h4 className="sub-title sub-title-dark">Registered Applicant Accounts</h4>
              <div className="row mb-3">
                <div className="col-md-4">
                  <input className="form-control" placeholder="Search name or email" value={applicantSearch} onChange={(e) => { setApplicantSearch(e.target.value); setApplicantPage(1); }} />
                </div>
              </div>
              <div className="table-responsive">
                <table className="table table-bordered table-striped align-middle announcement-table">
                  <colgroup>
                    <col style={{ width: "5%" }} />
                    <col style={{ width: "22%" }} />
                    <col style={{ width: "26%" }} />
                    <col style={{ width: "15%" }} />
                    <col style={{ width: "10%" }} />
                    <col style={{ width: "22%" }} />
                  </colgroup>
                  <thead>
                    <tr><th>ID</th><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th>Actions</th></tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr><td colSpan={6} className="text-center py-4"><div className="spinner-border text-danger" role="status" /></td></tr>
                    ) : pagedApplicants.length === 0 ? (
                      <tr><td colSpan={6} className="text-center text-muted py-4">No applicant accounts found.</td></tr>
                    ) : (
                      pagedApplicants.map((a) => (
                        <tr key={a.id}>
                          <td>{a.id}</td>
                          <td>{a.first_name} {a.last_name}</td>
                          <td>{a.email}</td>
                          <td><RoleBadge role={a.role} /></td>
                          <td><StatusBadge active={a.is_active} /></td>
                          <td>
                            <div className="user-action-group">
                              <button className="user-icon-btn user-icon-btn-view" onClick={() => setViewApplicant(a)} title="View" aria-label="View">
                                <EyeIcon />
                              </button>
                              <button
                                className={`user-icon-btn ${a.is_active ? "user-icon-btn-deactivate" : "user-icon-btn-activate"}`}
                                onClick={() => handleToggleClick(a)}
                                disabled={togglingId === a.id}
                                title={a.is_active ? "Deactivate" : "Activate"}
                                aria-label={a.is_active ? "Deactivate" : "Activate"}
                              >
                                {a.is_active ? <BanIcon /> : <CheckCircleIcon />}
                              </button>
                              <button
                                className="user-icon-btn user-icon-btn-reset-2fa"
                                onClick={() => setTwoFATarget(a)}
                                title="Reset 2FA — clears their authenticator setup, use if they lost their device or QR code"
                                aria-label="Reset 2FA"
                              >
                                <ShieldIcon />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
              {!loading && filteredApplicants.length > 0 && (
                <div className="table-pagination-bar">
                  <span className="table-pagination-info">Showing {applicantStart + 1}–{Math.min(applicantStart + perPage, filteredApplicants.length)} of {filteredApplicants.length} applicants</span>
                  <div className="table-pagination-controls">
                    <button className="table-pagination-arrow" onClick={() => setApplicantPage((p) => Math.max(1, p - 1))} disabled={applicantPage === 1}>‹</button>
                    {getPageNumbers(applicantPage, applicantTotalPages).map((page, index) => page === "..." ? (
                      <span key={`applicant-ellipsis-${index}`} className="table-pagination-ellipsis">…</span>
                    ) : (
                      <button key={page} className={`table-pagination-page ${page === applicantPage ? "table-pagination-page-active" : ""}`} onClick={() => setApplicantPage(page)}>{page}</button>
                    ))}
                    <button className="table-pagination-arrow" onClick={() => setApplicantPage((p) => Math.min(applicantTotalPages, p + 1))} disabled={applicantPage === applicantTotalPages}>›</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>
        <PanelFooter />
      </div>
      {viewApplicant && <ViewApplicantModal applicant={viewApplicant} onClose={() => setViewApplicant(null)} />}
      {showAdd && <AddPersonnelModal onClose={() => setShowAdd(false)} onSave={savePersonnel} actingRole={currentUser?.role} />}

      {resetTarget && (
        <div className="modal fade show d-block" tabIndex="-1" style={{ background: "rgba(0,0,0,0.5)" }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Reset Password?</h5>
                <button type="button" className="btn-close" onClick={() => setResetTarget(null)} disabled={resetting} />
              </div>
              <div className="modal-body">
                <p className="mb-0">
                  This will immediately invalidate {resetTarget.first_name} {resetTarget.last_name}'s
                  current password and log them out of all active sessions. A
                  link to set a new password will be emailed to <strong>{resetTarget.email}</strong>.
                </p>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setResetTarget(null)} disabled={resetting}>
                  Cancel
                </button>
                <button type="button" className="btn btn-custom" onClick={confirmResetPassword} disabled={resetting}>
                  {resetting ? "Resetting..." : "Yes, Reset Password"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {twoFATarget && (
        <div className="modal fade show d-block" tabIndex="-1" style={{ background: "rgba(0,0,0,0.5)" }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Reset 2FA?</h5>
                <button type="button" className="btn-close" onClick={() => setTwoFATarget(null)} disabled={resettingTwoFA} />
              </div>
              <div className="modal-body">
                <p className="mb-0">
                  This will clear the authenticator setup for {twoFATarget.first_name} {twoFATarget.last_name}
                  ({twoFATarget.email}). They will be walked through scanning a new
                  QR code the next time they log in. Only do this after confirming
                  their identity — this is the only way to recover a lost
                  authenticator device or QR code.
                </p>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setTwoFATarget(null)} disabled={resettingTwoFA}>
                  Cancel
                </button>
                <button type="button" className="btn btn-custom" onClick={confirmResetTwoFA} disabled={resettingTwoFA}>
                  {resettingTwoFA ? "Resetting..." : "Yes, Reset 2FA"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {deactivateTarget && (
        <div className="modal fade show d-block" tabIndex="-1" style={{ background: "rgba(0,0,0,0.5)" }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Deactivate Account?</h5>
                <button type="button" className="btn-close" onClick={() => setDeactivateTarget(null)} disabled={deactivating} />
              </div>
              <div className="modal-body">
                <p className="mb-0">
                  This will immediately lock {deactivateTarget.first_name} {deactivateTarget.last_name} ({deactivateTarget.email})
                  out of their account. They won't be able to log in until an admin reactivates it.
                </p>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setDeactivateTarget(null)} disabled={deactivating}>
                  Cancel
                </button>
                <button type="button" className="btn btn-danger" onClick={confirmDeactivate} disabled={deactivating}>
                  {deactivating ? "Deactivating..." : "Yes, Deactivate"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div className="modal fade show d-block" tabIndex="-1" style={{ background: "rgba(0,0,0,0.5)" }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Delete User?</h5>
                <button type="button" className="btn-close" onClick={() => setDeleteTarget(null)} disabled={deleting} />
              </div>
              <div className="modal-body">
                <p className="mb-0">
                  This will permanently delete {deleteTarget.first_name} {deleteTarget.last_name}'s ({deleteTarget.email}) account.
                  This action cannot be undone.
                </p>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setDeleteTarget(null)} disabled={deleting}>
                  Cancel
                </button>
                <button type="button" className="btn btn-danger" onClick={confirmDeleteUser} disabled={deleting}>
                  {deleting ? "Deleting..." : "Yes, Delete"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
export default AdminUsers;