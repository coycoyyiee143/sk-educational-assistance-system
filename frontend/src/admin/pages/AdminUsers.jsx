import { useState, useEffect, useRef } from "react";
import AdminNavigation from "../components/AdminNavigation";
import api from "../../services/api";
import PanelFooter from "../../components/PanelFooter";
function StatusBadge({ active }) {
  return <span className={active ? "status-badge status-active" : "status-badge status-inactive"}>{active ? "Active" : "Inactive"}</span>;
}
function RoleBadge({ role }) {
  const map = { applicant: "role-applicant", sk_verifier: "role-verifier", sk_admin: "role-admin" };
  const labels = { applicant: "Applicant", sk_verifier: "Verifier", sk_admin: "Admin" };
  return <span className={map[role] ?? "role-applicant"}>{labels[role] ?? role}</span>;
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
function ViewApplicantModal({ applicant, onClose }) {
  if (!applicant) return null;
  return (
    <div className="modal fade show d-block" tabIndex="-1" style={{ background: "rgba(0,0,0,0.5)" }}>
      <div className="modal-dialog modal-lg modal-dialog-centered">
        <div className="modal-content applicant-details-modal">
          <div className="modal-header">
            <h5 className="modal-title">Applicant Details</h5>
            <button type="button" className="btn-close" onClick={onClose} />
          </div>
          <div className="modal-body">
            <div className="row g-3">
              <div className="col-md-6">
                <div className="applicant-detail-box">
                  <span className="applicant-detail-label">USER ID</span>
                  <span className="applicant-detail-value">{applicant.id}</span>
                </div>
              </div>
              <div className="col-md-6">
                <div className="applicant-detail-box">
                  <span className="applicant-detail-label">STATUS</span>
                  <span className={`applicant-detail-status ${applicant.is_active ? "applicant-detail-status-active" : "applicant-detail-status-inactive"}`}>{applicant.is_active ? "Active" : "Inactive"}</span>
                </div>
              </div>
              <div className="col-md-6">
                <div className="applicant-detail-box">
                  <span className="applicant-detail-label">FIRST NAME</span>
                  <span className="applicant-detail-value">{applicant.first_name}</span>
                </div>
              </div>
              <div className="col-md-6">
                <div className="applicant-detail-box">
                  <span className="applicant-detail-label">LAST NAME</span>
                  <span className="applicant-detail-value">{applicant.last_name}</span>
                </div>
              </div>
              <div className="col-12">
                <div className="applicant-detail-box">
                  <span className="applicant-detail-label">EMAIL ADDRESS</span>
                  <span className="applicant-detail-value">{applicant.email}</span>
                </div>
              </div>
              <div className="col-md-6">
                <div className="applicant-detail-box">
                  <span className="applicant-detail-label">ROLE</span>
                  <span className="applicant-detail-value">Applicant</span>
                </div>
              </div>
              <div className="col-md-6">
                <div className="applicant-detail-box">
                  <span className="applicant-detail-label">REGISTERED DATE</span>
                  <span className="applicant-detail-value">{applicant.created_at?.split("T")[0]}</span>
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
function AddPersonnelModal({ onClose, onSave }) {
  const [form, setForm] = useState({ first_name: "", last_name: "", email: "", role: "", password: "", password_confirmation: "", is_active: true });
  const [error, setError] = useState("");
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    const passwordRule = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;
    if (!passwordRule.test(form.password)) {
      setError("Password must be at least 8 characters, with uppercase, lowercase, and a number.");
      return;
    }
    try {
      await onSave(form);
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || Object.values(err.response?.data?.errors ?? {}).flat().join(" ") || "Failed.");
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
                    <option value="sk_verifier">Verifier</option>
                    <option value="sk_admin">Admin</option>
                  </select>
                </div>
                <div className="col-md-6">
                  <label className="form-label">Password</label>
                  <input type="password" className="form-control" value={form.password} onChange={set("password")} required />
                </div>
                <div className="col-md-6">
                  <label className="form-label">Confirm Password</label>
                  <input type="password" className="form-control" value={form.password_confirmation} onChange={set("password_confirmation")} required />
                  {form.password_confirmation && (
                    form.password === form.password_confirmation ? (
                      <span className="admin-password-match">✓ Passwords match</span>
                    ) : (
                      <span className="admin-password-match" style={{ color: "#dc3545" }}>✕ Passwords do not match</span>
                    )
                  )}
                </div>
                <div className="col-12">
                  <div className="admin-password-requirements">
                    <span className="admin-password-requirements-title">PASSWORD REQUIREMENTS</span>
                    <div className="admin-password-requirement-item">
                      <span>{form.password.length >= 8 ? "✓" : "○"}</span>
                      <p>At least 8 characters</p>
                    </div>
                    <div className="admin-password-requirement-item">
                      <span>{/[A-Z]/.test(form.password) && /[a-z]/.test(form.password) ? "✓" : "○"}</span>
                      <p>Uppercase and lowercase letters</p>
                    </div>
                    <div className="admin-password-requirement-item">
                      <span>{/\d/.test(form.password) ? "✓" : "○"}</span>
                      <p>At least one number</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
              <button type="submit" className="btn btn-custom">Save Personnel</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
function AdminUsers() {
  const [applicants, setApplicants] = useState([]);
  const [personnel, setPersonnel] = useState([]);
  const [loading, setLoading] = useState(true);
  const [applicantSearch, setApplicantSearch] = useState("");
  const [personnelSearch, setPersonnelSearch] = useState("");
  const [viewApplicant, setViewApplicant] = useState(null);
  const [showAdd, setShowAdd] = useState(false);
  const [error, setError] = useState("");
  const [applicantPage, setApplicantPage] = useState(1);
  const [personnelPage, setPersonnelPage] = useState(1);
  const [roleFilter, setRoleFilter] = useState("");
  const [showRoleMenu, setShowRoleMenu] = useState(false);
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
    function handleClickOutside(e) {
      if (roleMenuRef.current && !roleMenuRef.current.contains(e.target)) setShowRoleMenu(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);
  async function toggleStatus(id) {
    try {
      await api.patch(`/admin/users/${id}/toggle-status`);
      loadUsers();
    } catch {
      setError("Failed to update status.");
    }
  }
  async function deleteUser(id) {
    if (!window.confirm("Are you sure you want to delete this user?")) return;
    try {
      await api.delete(`/admin/users/${id}`);
      loadUsers();
    } catch {
      setError("Failed to delete user.");
    }
  }
  async function savePersonnel(form) {
    await api.post("/admin/users/personnel", form);
    loadUsers();
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
      <AdminNavigation />
      <div className="admin-main">
        <div className="admin-topbar">
          <div className="admin-topbar-user">
            <div className="admin-topbar-user-text">
              <span className="admin-topbar-user-name">Admin User</span>
              <span className="admin-topbar-user-role">Sangguniang Kabataan</span>
            </div>
            <div className="admin-topbar-avatar"></div>
          </div>
        </div>
        <section className="page-section">
          <div className="container-fluid">
            <div className="page-card">
              <h3 className="section-title">User Management</h3>
              <p className="text-muted mb-0">View registered applicants and manage authorized system personnel.</p>
            </div>
            {error && <div className="alert alert-danger">{error}</div>}
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
                    <col style={{ width: "8%" }} />
                    <col style={{ width: "20%" }} />
                    <col style={{ width: "28%" }} />
                    <col style={{ width: "12%" }} />
                    <col style={{ width: "12%" }} />
                    <col style={{ width: "20%" }} />
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
                      pagedPersonnel.map((p) => (
                        <tr key={p.id}>
                          <td>{p.id}</td>
                          <td>{p.first_name} {p.last_name}</td>
                          <td>{p.email}</td>
                          <td><RoleBadge role={p.role} /></td>
                          <td><StatusBadge active={p.is_active} /></td>
                          <td>
                            <button className={`user-action-btn me-1 ${p.is_active ? "user-action-deactivate" : "user-action-activate"}`} onClick={() => toggleStatus(p.id)}>{p.is_active ? "Deactivate" : "Activate"}</button>
                            <button className="user-action-btn user-action-delete" onClick={() => deleteUser(p.id)}>Delete</button>
                          </td>
                        </tr>
                      ))
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
                    <col style={{ width: "8%" }} />
                    <col style={{ width: "20%" }} />
                    <col style={{ width: "28%" }} />
                    <col style={{ width: "12%" }} />
                    <col style={{ width: "12%" }} />
                    <col style={{ width: "20%" }} />
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
                            <button className="user-action-btn user-action-view me-1" onClick={() => setViewApplicant(a)}>View</button>
                            <button className={`user-action-btn ${a.is_active ? "user-action-deactivate" : "user-action-activate"}`} onClick={() => toggleStatus(a.id)}>{a.is_active ? "Deactivate" : "Activate"}</button>
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
      {showAdd && <AddPersonnelModal onClose={() => setShowAdd(false)} onSave={savePersonnel} />}
    </div>
  );
}
export default AdminUsers;