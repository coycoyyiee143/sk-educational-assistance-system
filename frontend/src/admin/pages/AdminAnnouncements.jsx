import { useState, useEffect } from "react";
import AdminNavigation from "../components/AdminNavigation";
import api from "../../services/api";

const categories = [
  "Educational Assistance",
  "Reminder",
  "Schedule Update",
  "SK Activity",
];

const emptyForm = { title: "", category: "", content: "" };

function formatDate(dateStr) {
  if (!dateStr) return "";
  return new Date(dateStr).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

// ── Edit Modal ────────────────────────────────────────────────────────────────
function EditAnnouncementModal({ announcement, onClose, onSave, saving }) {
  const [form, setForm] = useState({
    title: announcement.title,
    category: announcement.category ?? "",
    content: announcement.content,
  });
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  function handleSubmit(e) {
    e.preventDefault();
    onSave(announcement.id, form);
  }

  return (
    <div className="modal fade show d-block" tabIndex="-1" style={{ background: "rgba(0,0,0,0.5)" }}>
      <div className="modal-dialog modal-lg modal-dialog-centered">
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title">Edit Announcement</h5>
            <button type="button" className="btn-close" onClick={onClose} aria-label="Close" />
          </div>
          <form onSubmit={handleSubmit}>
            <div className="modal-body">
              <div className="row g-3">
                <div className="col-md-8">
                  <label className="form-label">Announcement Title</label>
                  <input type="text" className="form-control" placeholder="Enter announcement title" value={form.title} onChange={set("title")} required />
                </div>
                <div className="col-md-4">
                  <label className="form-label">Category</label>
                  <select className="form-select" value={form.category} onChange={set("category")} required>
                    <option value="" disabled>Select category</option>
                    {categories.map((c) => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div className="col-12">
                  <small className="text-muted">
                    Posted on: <strong>{formatDate(announcement.published_at)}</strong> (posting date cannot be changed when editing)
                  </small>
                </div>
                <div className="col-12">
                  <label className="form-label">Announcement Content</label>
                  <textarea className="form-control" rows="6" value={form.content} onChange={set("content")} placeholder="Enter announcement details" required />
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={onClose} disabled={saving}>Cancel</button>
              <button type="submit" className="btn btn-custom" disabled={saving}>
                {saving ? "Updating..." : "Update Announcement"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
function AdminAnnouncements() {
  const [announcements, setAnnouncements] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editTarget, setEditTarget] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => { loadAnnouncements(); }, []);

  function loadAnnouncements() {
    setLoading(true);
    api.get("/admin/announcements")
      .then((res) => setAnnouncements(res.data))
      .catch(() => setError("Failed to load announcements."))
      .finally(() => setLoading(false));
  }

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSuccess("");
    setSaving(true);
    try {
      await api.post("/admin/announcements", form);
      setForm(emptyForm);
      setSuccess("Announcement posted successfully.");
      loadAnnouncements();
    } catch (err) {
      const errors = err.response?.data?.errors;
      setError(errors ? Object.values(errors).flat().join(" ") : err.response?.data?.message || "Failed to save announcement.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteAnnouncement(id) {
    if (!window.confirm("Delete this announcement?")) return;
    setError("");
    setSuccess("");
    try {
      await api.delete(`/admin/announcements/${id}`);
      setAnnouncements((prev) => prev.filter((a) => a.id !== id));
    } catch (err) {
      setError(err.response?.data?.message || "Failed to delete announcement.");
    }
  }

  async function saveEdit(id, data) {
    setError("");
    setSuccess("");
    setSaving(true);
    try {
      await api.put(`/admin/announcements/${id}`, data);
      setEditTarget(null);
      setSuccess("Announcement updated successfully.");
      loadAnnouncements();
    } catch (err) {
      const errors = err.response?.data?.errors;
      setError(errors ? Object.values(errors).flat().join(" ") : err.response?.data?.message || "Failed to update announcement.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <AdminNavigation />
      <section className="page-section">
        <div className="container">

          <div className="page-card">
            <h3 className="section-title mb-2">Announcements Management</h3>
            <p className="text-muted mb-0">
              Create, update, and manage announcements related to the educational assistance program and other SK activities.
            </p>
          </div>

          {error && <div className="alert alert-danger">{error}</div>}
          {success && <div className="alert alert-success">{success}</div>}

          <div className="page-card">
            <h4 className="sub-title">Create Announcement</h4>
            <div className="info-box">
              Announcements posted here will appear in the public section of the system to inform applicants about application opening dates, reminders, updates, and other important notices.
            </div>
            <form onSubmit={handleSubmit}>
              <div className="row g-3">
                <div className="col-md-8">
                  <label className="form-label">Announcement Title</label>
                  <input type="text" className="form-control" placeholder="Enter announcement title" value={form.title} onChange={set("title")} required />
                </div>
                <div className="col-md-4">
                  <label className="form-label">Category</label>
                  <select className="form-select" value={form.category} onChange={set("category")} required>
                    <option value="" disabled>Select category</option>
                    {categories.map((c) => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div className="col-12">
                  <label className="form-label">Announcement Content</label>
                  <textarea className="form-control" rows="6" placeholder="Enter announcement details" value={form.content} onChange={set("content")} required />
                </div>
              </div>
              <div className="mt-4 d-flex justify-content-end gap-2">
                <button type="button" className="btn btn-secondary" onClick={() => setForm(emptyForm)} disabled={saving}>Clear</button>
                <button type="submit" className="btn btn-custom" disabled={saving}>
                  {saving ? "Saving..." : "Save Announcement"}
                </button>
              </div>
            </form>
          </div>

          <div className="page-card">
            <h4 className="sub-title">Existing Announcements</h4>
            {loading ? (
              <div className="text-center py-4"><div className="spinner-border text-danger" role="status" /></div>
            ) : (
              <div className="table-responsive table-scroll">
                <table className="table table-bordered table-striped align-middle">
                  <thead>
                    <tr>
                      <th>Announcement ID</th>
                      <th>Title</th>
                      <th>Category</th>
                      <th>Posting Date</th>
                      <th style={{ width: 180 }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {announcements.map((a) => (
                      <tr key={a.id}>
                        <td>ANN-{String(a.id).padStart(3, "0")}</td>
                        <td>{a.title}</td>
                        <td>{a.category}</td>
                        <td>{formatDate(a.published_at)}</td>
                        <td>
                          <button className="btn btn-outline-secondary btn-sm me-1" onClick={() => setEditTarget(a)}>Edit</button>
                          <button className="btn btn-outline-danger btn-sm" onClick={() => deleteAnnouncement(a.id)}>Delete</button>
                        </td>
                      </tr>
                    ))}
                    {announcements.length === 0 && (
                      <tr><td colSpan="5" className="text-center text-muted">No announcements posted yet.</td></tr>
                    )}
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

      {editTarget && (
        <EditAnnouncementModal
          announcement={editTarget}
          onClose={() => setEditTarget(null)}
          onSave={saveEdit}
          saving={saving}
        />
      )}
    </div>
  );
}

export default AdminAnnouncements;