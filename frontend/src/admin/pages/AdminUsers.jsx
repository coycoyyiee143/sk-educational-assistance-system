import { useState, useEffect } from "react";
import AdminNavigation from "../components/AdminNavigation";
import api from "../../services/api";

function StatusBadge({ active }) {
  return <span className={active ? "status-badge status-active" : "status-badge status-inactive"}>{active ? "Active" : "Inactive"}</span>;
}

function RoleBadge({ role }) {
  const map = { applicant: "role-applicant", sk_verifier: "role-verifier", sk_admin: "role-admin" };
  const labels = { applicant: "Applicant", sk_verifier: "Verifier", sk_admin: "Admin" };
  return <span className={map[role] ?? "role-applicant"}>{labels[role] ?? role}</span>;
}

function ViewApplicantModal({ applicant, onClose }) {
  if (!applicant) return null;
  return (
    <div className="modal fade show d-block" tabIndex="-1" style={{ background: "rgba(0,0,0,0.5)" }}>
      <div className="modal-dialog modal-lg modal-dialog-centered">
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title">Applicant Details</h5>
            <button type="button" className="btn-close" onClick={onClose} />
          </div>
          <div className="modal-body">
            <div className="row g-3">
              {[
                ["User ID", applicant.id],
                ["First Name", applicant.first_name],
                ["Last Name", applicant.last_name],
                ["Email", applicant.email],
                ["Role", "Applicant"],
                ["Status", applicant.is_active ? "Active" : "Inactive"],
                ["Registered", applicant.created_at?.split("T")[0]],
              ].map(([label, value]) => (
                <div className="col-md-6" key={label}>
                  <label className="form-label">{label}</label>
                  <input className="form-control" value={value ?? ""} readOnly />
                </div>
              ))}
            </div>
          </div>
          <div className="modal-footer">
            <button className="btn btn-secondary" onClick={onClose}>Close</button>
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

  async function toggleStatus(id) {
    try {
      await api.patch(`/admin/users/${id}/toggle-status`);
      loadUsers();
    } catch { setError("Failed to update status."); }
  }

  async function deleteUser(id) {
    if (!window.confirm("Are you sure you want to delete this user?")) return;
    try {
      await api.delete(`/admin/users/${id}`);
      loadUsers();
    } catch { setError("Failed to delete user."); }
  }

  async function savePersonnel(form) {
    await api.post("/admin/users/personnel", form);
    loadUsers();
  }

  const filteredApplicants = applicants.filter((a) =>
    `${a.first_name} ${a.last_name} ${a.email}`.toLowerCase().includes(applicantSearch.toLowerCase())
  );
  const filteredPersonnel = personnel.filter((p) =>
    `${p.first_name} ${p.last_name} ${p.email}`.toLowerCase().includes(personnelSearch.toLowerCase())
  );

  return (
    <div>
      <AdminNavigation />
      <section className="page-section">
        <div className="container">
          <div className="page-card">
            <h3 className="section-title">User Management</h3>
            <p className="text-muted mb-0">View registered applicants and manage authorized system personnel.</p>
          </div>
          {error && <div className="alert alert-danger">{error}</div>}

          {/* Applicants */}
          <div className="page-card">
            <h4 className="sub-title">Registered Applicant Accounts</h4>
            <div className="row mb-3">
              <div className="col-md-4">
                <input className="form-control" placeholder="Search name or email" value={applicantSearch} onChange={(e) => setApplicantSearch(e.target.value)} />
              </div>
            </div>
            {loading ? <div className="spinner-border text-danger" /> : (
              <div className="table-responsive table-scroll">
                <table className="table table-bordered table-striped align-middle">
                  <thead>
                    <tr><th>ID</th><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th>Actions</th></tr>
                  </thead>
                  <tbody>
                    {filteredApplicants.map((a) => (
                      <tr key={a.id}>
                        <td>{a.id}</td>
                        <td>{a.first_name} {a.last_name}</td>
                        <td>{a.email}</td>
                        <td><RoleBadge role={a.role} /></td>
                        <td><StatusBadge active={a.is_active} /></td>
                        <td>
                          <button className="btn btn-outline-custom btn-sm me-1" onClick={() => setViewApplicant(a)}>View</button>
                          <button className="btn btn-outline-custom btn-sm" onClick={() => toggleStatus(a.id)}>
                            {a.is_active ? "Deactivate" : "Activate"}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Personnel */}
          <div className="page-card">
            <div className="d-flex justify-content-between align-items-center mb-3">
              <h4 className="sub-title mb-0">Authorized Personnel</h4>
              <button className="btn btn-custom" onClick={() => setShowAdd(true)}>Add Personnel</button>
            </div>
            <div className="row mb-3">
              <div className="col-md-4">
                <input className="form-control" placeholder="Search name or email" value={personnelSearch} onChange={(e) => setPersonnelSearch(e.target.value)} />
              </div>
            </div>
            {loading ? <div className="spinner-border text-danger" /> : (
              <div className="table-responsive table-scroll">
                <table className="table table-bordered table-striped align-middle">
                  <thead>
                    <tr><th>ID</th><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th>Actions</th></tr>
                  </thead>
                  <tbody>
                    {filteredPersonnel.map((p) => (
                      <tr key={p.id}>
                        <td>{p.id}</td>
                        <td>{p.first_name} {p.last_name}</td>
                        <td>{p.email}</td>
                        <td><RoleBadge role={p.role} /></td>
                        <td><StatusBadge active={p.is_active} /></td>
                        <td>
                          <button className="btn btn-outline-custom btn-sm me-1" onClick={() => toggleStatus(p.id)}>
                            {p.is_active ? "Deactivate" : "Activate"}
                          </button>
                          <button className="btn btn-delete btn-sm" onClick={() => deleteUser(p.id)}>Delete</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </section>
      <footer>
        <div className="container">
          <p className="mb-0">© 2026 Sangguniang Kabataan of Barangay Mamatid | Admin Panel</p>
        </div>
      </footer>
      {viewApplicant && <ViewApplicantModal applicant={viewApplicant} onClose={() => setViewApplicant(null)} />}
      {showAdd && <AddPersonnelModal onClose={() => setShowAdd(false)} onSave={savePersonnel} />}
    </div>
  );
}

export default AdminUsers;