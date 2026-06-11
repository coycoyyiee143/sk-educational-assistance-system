import { useState } from "react";
import AdminNavigation from "../components/AdminNavigation";

// ── Data ──────────────────────────────────────────────────────────────────────

const initialApplicants = [
  { id: "USR-001", name: "Juan Dela Cruz", email: "juan@email.com", status: "Active" },
  { id: "USR-004", name: "Ana Cruz",       email: "ana@email.com",  status: "Inactive" },
  { id: "USR-006", name: "Carlo Reyes",    email: "carlo@email.com", status: "Active" },
];

const initialPersonnel = [
  { id: "USR-002", name: "Maria Santos", email: "maria@email.com", role: "Verifier", status: "Active" },
  { id: "USR-003", name: "Pedro Reyes",  email: "pedro@email.com", role: "Admin",    status: "Active" },
  { id: "USR-005", name: "Mark Lopez",   email: "mark@email.com",  role: "Verifier", status: "Inactive" },
];

// ── Badges ────────────────────────────────────────────────────────────────────

function StatusBadge({ status }) {
  const cls = status === "Active" ? "status-badge status-active" : "status-badge status-inactive";
  return <span className={cls}>{status}</span>;
}

function RoleBadge({ role }) {
  const map = { Applicant: "role-applicant", Verifier: "role-verifier", Admin: "role-admin" };
  return <span className={map[role] ?? "role-applicant"}>{role}</span>;
}

// ── Modals ────────────────────────────────────────────────────────────────────

function ViewApplicantModal({ applicant, onClose }) {
  if (!applicant) return null;
  const fields = [
    ["User ID", applicant.id],
    ["Full Name", applicant.name],
    ["Email Address", applicant.email],
    ["Role", "Applicant"],
    ["Account Status", applicant.status],
    ["Registered Date", "April 2, 2026"],
  ];
  return (
    <div className="modal fade show d-block" tabIndex="-1" style={{ background: "rgba(0,0,0,0.5)" }}>
      <div className="modal-dialog modal-lg modal-dialog-centered">
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title">Applicant Details</h5>
            <button type="button" className="btn-close" onClick={onClose} aria-label="Close" />
          </div>
          <div className="modal-body">
            <div className="row g-3">
              {fields.map(([label, value]) => (
                <div className="col-md-6" key={label}>
                  <label className="form-label">{label}</label>
                  <input type="text" className="form-control" value={value} readOnly />
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
  const empty = { name: "", email: "", role: "", status: "", password: "", confirm: "" };
  const [form, setForm] = useState(empty);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  function handleSubmit(e) {
    e.preventDefault();
    onSave(form);
    onClose();
  }

  return (
    <div className="modal fade show d-block" tabIndex="-1" style={{ background: "rgba(0,0,0,0.5)" }}>
      <div className="modal-dialog modal-lg modal-dialog-centered">
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title">Add New Personnel</h5>
            <button type="button" className="btn-close" onClick={onClose} aria-label="Close" />
          </div>
          <form onSubmit={handleSubmit}>
            <div className="modal-body">
              <div className="row g-3">
                <div className="col-md-6">
                  <label className="form-label">Full Name</label>
                  <input className="form-control" placeholder="Enter full name" value={form.name} onChange={set("name")} required />
                </div>
                <div className="col-md-6">
                  <label className="form-label">Email Address</label>
                  <input type="email" className="form-control" placeholder="Enter email address" value={form.email} onChange={set("email")} required />
                </div>
                <div className="col-md-6">
                  <label className="form-label">Role</label>
                  <select className="form-select" value={form.role} onChange={set("role")} required>
                    <option value="" disabled>Select role</option>
                    <option>Verifier</option>
                    <option>Admin</option>
                  </select>
                </div>
                <div className="col-md-6">
                  <label className="form-label">Account Status</label>
                  <select className="form-select" value={form.status} onChange={set("status")} required>
                    <option value="" disabled>Select status</option>
                    <option>Active</option>
                    <option>Inactive</option>
                  </select>
                </div>
                <div className="col-md-6">
                  <label className="form-label">Password</label>
                  <input type="password" className="form-control" placeholder="Enter password" value={form.password} onChange={set("password")} required />
                </div>
                <div className="col-md-6">
                  <label className="form-label">Confirm Password</label>
                  <input type="password" className="form-control" placeholder="Confirm password" value={form.confirm} onChange={set("confirm")} required />
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={() => setForm(empty)}>Clear</button>
              <button type="submit" className="btn btn-custom">Save Personnel</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

function EditPersonnelModal({ personnel, onClose, onSave }) {
  const [form, setForm] = useState({
    name: personnel.name,
    email: personnel.email,
    role: personnel.role,
    status: personnel.status,
    password: "",
    confirm: "",
  });
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  function handleSubmit(e) {
    e.preventDefault();
    onSave({ ...personnel, ...form });
    onClose();
  }

  return (
    <div className="modal fade show d-block" tabIndex="-1" style={{ background: "rgba(0,0,0,0.5)" }}>
      <div className="modal-dialog modal-lg modal-dialog-centered">
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title">Edit Personnel Account</h5>
            <button type="button" className="btn-close" onClick={onClose} aria-label="Close" />
          </div>
          <form onSubmit={handleSubmit}>
            <div className="modal-body">
              <div className="row g-3">
                <div className="col-md-6">
                  <label className="form-label">Full Name</label>
                  <input className="form-control" value={form.name} onChange={set("name")} required />
                </div>
                <div className="col-md-6">
                  <label className="form-label">Email Address</label>
                  <input type="email" className="form-control" value={form.email} onChange={set("email")} required />
                </div>
                <div className="col-md-6">
                  <label className="form-label">Role</label>
                  <select className="form-select" value={form.role} onChange={set("role")} required>
                    <option>Verifier</option>
                    <option>Admin</option>
                  </select>
                </div>
                <div className="col-md-6">
                  <label className="form-label">Account Status</label>
                  <select className="form-select" value={form.status} onChange={set("status")} required>
                    <option>Active</option>
                    <option>Inactive</option>
                  </select>
                </div>
                <div className="col-md-6">
                  <label className="form-label">New Password</label>
                  <input type="password" className="form-control" placeholder="Enter new password if needed" value={form.password} onChange={set("password")} />
                </div>
                <div className="col-md-6">
                  <label className="form-label">Confirm New Password</label>
                  <input type="password" className="form-control" placeholder="Confirm new password" value={form.confirm} onChange={set("confirm")} />
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
              <button type="submit" className="btn btn-custom">Update Personnel</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

function AdminUsers() {
  // Applicants
  const [applicants, setApplicants] = useState(initialApplicants);
  const [applicantSearch, setApplicantSearch] = useState("");
  const [applicantStatusFilter, setApplicantStatusFilter] = useState("All Status");

  // Personnel
  const [personnel, setPersonnel] = useState(initialPersonnel);
  const [personnelSearch, setPersonnelSearch] = useState("");
  const [personnelRoleFilter, setPersonnelRoleFilter] = useState("All Roles");
  const [personnelStatusFilter, setPersonnelStatusFilter] = useState("All Status");

  // Modals
  const [viewApplicant, setViewApplicant] = useState(null);
  const [showAddPersonnel, setShowAddPersonnel] = useState(false);
  const [editPersonnel, setEditPersonnel] = useState(null);

  // Applicant actions
  function toggleApplicantStatus(id) {
    setApplicants((prev) =>
      prev.map((a) => a.id === id ? { ...a, status: a.status === "Active" ? "Inactive" : "Active" } : a)
    );
  }

  const filteredApplicants = applicants.filter((a) => {
    const matchSearch = a.name.toLowerCase().includes(applicantSearch.toLowerCase()) ||
      a.email.toLowerCase().includes(applicantSearch.toLowerCase());
    const matchStatus = applicantStatusFilter === "All Status" || a.status === applicantStatusFilter;
    return matchSearch && matchStatus;
  });

  // Personnel actions
  function togglePersonnelStatus(id) {
    setPersonnel((prev) =>
      prev.map((p) => p.id === id ? { ...p, status: p.status === "Active" ? "Inactive" : "Active" } : p)
    );
  }

  function deletePersonnel(id) {
    setPersonnel((prev) => prev.filter((p) => p.id !== id));
  }

  function saveNewPersonnel(form) {
    const newId = `USR-${String(personnel.length + applicants.length + 1).padStart(3, "0")}`;
    setPersonnel((prev) => [...prev, { id: newId, name: form.name, email: form.email, role: form.role, status: form.status }]);
  }

  function saveEditPersonnel(updated) {
    setPersonnel((prev) => prev.map((p) => p.id === updated.id ? updated : p));
  }

  const filteredPersonnel = personnel.filter((p) => {
    const matchSearch = p.name.toLowerCase().includes(personnelSearch.toLowerCase()) ||
      p.email.toLowerCase().includes(personnelSearch.toLowerCase());
    const matchRole = personnelRoleFilter === "All Roles" || p.role === personnelRoleFilter;
    const matchStatus = personnelStatusFilter === "All Status" || p.status === personnelStatusFilter;
    return matchSearch && matchRole && matchStatus;
  });

  return (
    <div>
      <AdminNavigation />

      <section className="page-section">
        <div className="container">

          <div className="page-card">
            <h3 className="section-title">User Management</h3>
            <p className="text-muted mb-0">
              View registered applicants and manage authorized system personnel such as verifiers and administrators.
            </p>
          </div>

          {/* APPLICANTS */}
          <div className="page-card">
            <h4 className="sub-title">Registered Applicant Accounts</h4>

            <div className="info-box">
              Applicant accounts are created through the public registration page. The administrator may only view applicant details and activate or deactivate their access when necessary.
            </div>

            <div className="row g-3 mb-3">
              <div className="col-md-4">
                <input
                  className="form-control"
                  placeholder="Search applicant name or email"
                  value={applicantSearch}
                  onChange={(e) => setApplicantSearch(e.target.value)}
                />
              </div>
              <div className="col-md-3">
                <select
                  className="form-select"
                  value={applicantStatusFilter}
                  onChange={(e) => setApplicantStatusFilter(e.target.value)}
                >
                  <option>All Status</option>
                  <option>Active</option>
                  <option>Inactive</option>
                </select>
              </div>
            </div>

            <div className="table-responsive">
              <table className="table table-bordered table-striped align-middle">
                <thead>
                  <tr>
                    <th>User ID</th>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Role</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredApplicants.map((a) => (
                    <tr key={a.id}>
                      <td>{a.id}</td>
                      <td>{a.name}</td>
                      <td>{a.email}</td>
                      <td><RoleBadge role="Applicant" /></td>
                      <td><StatusBadge status={a.status} /></td>
                      <td>
                        <button className="btn btn-outline-custom btn-sm me-1" onClick={() => setViewApplicant(a)}>View</button>
                        <button className="btn btn-outline-custom btn-sm" onClick={() => toggleApplicantStatus(a.id)}>
                          {a.status === "Active" ? "Deactivate" : "Activate"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* PERSONNEL */}
          <div className="page-card">
            <div className="d-flex justify-content-between align-items-center flex-wrap gap-2">
              <h4 className="sub-title mb-0">Authorized Personnel</h4>
              <button className="btn btn-custom" onClick={() => setShowAddPersonnel(true)}>Add Personnel</button>
            </div>

            <div className="info-box mt-3">
              Only verifier and administrator accounts may be added manually by the system administrator.
            </div>

            <div className="row g-3 mb-3 mt-1">
              <div className="col-md-4">
                <input
                  className="form-control"
                  placeholder="Search personnel name or email"
                  value={personnelSearch}
                  onChange={(e) => setPersonnelSearch(e.target.value)}
                />
              </div>
              <div className="col-md-3">
                <select className="form-select" value={personnelRoleFilter} onChange={(e) => setPersonnelRoleFilter(e.target.value)}>
                  <option>All Roles</option>
                  <option>Verifier</option>
                  <option>Admin</option>
                </select>
              </div>
              <div className="col-md-3">
                <select className="form-select" value={personnelStatusFilter} onChange={(e) => setPersonnelStatusFilter(e.target.value)}>
                  <option>All Status</option>
                  <option>Active</option>
                  <option>Inactive</option>
                </select>
              </div>
            </div>

            <div className="table-responsive">
              <table className="table table-bordered table-striped align-middle">
                <thead>
                  <tr>
                    <th>User ID</th>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Role</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPersonnel.map((p) => (
                    <tr key={p.id}>
                      <td>{p.id}</td>
                      <td>{p.name}</td>
                      <td>{p.email}</td>
                      <td><RoleBadge role={p.role} /></td>
                      <td><StatusBadge status={p.status} /></td>
                      <td>
                        <button className="btn btn-outline-custom btn-sm me-1" onClick={() => setEditPersonnel(p)}>Edit</button>
                        <button className="btn btn-delete btn-sm me-1" onClick={() => deletePersonnel(p.id)}>Delete</button>
                        <button className="btn btn-outline-custom btn-sm" onClick={() => togglePersonnelStatus(p.id)}>
                          {p.status === "Active" ? "Deactivate" : "Activate"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      </section>

      <footer>
        <div className="container">
          <p className="mb-0">© 2026 Sangguniang Kabataan of Barangay Mamatid | Admin Panel</p>
        </div>
      </footer>

      {/* Modals */}
      {viewApplicant && (
        <ViewApplicantModal applicant={viewApplicant} onClose={() => setViewApplicant(null)} />
      )}
      {showAddPersonnel && (
        <AddPersonnelModal onClose={() => setShowAddPersonnel(false)} onSave={saveNewPersonnel} />
      )}
      {editPersonnel && (
        <EditPersonnelModal personnel={editPersonnel} onClose={() => setEditPersonnel(null)} onSave={saveEditPersonnel} />
      )}
    </div>
  );
}

export default AdminUsers;