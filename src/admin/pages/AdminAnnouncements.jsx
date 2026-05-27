import { useState } from "react";
import AdminNavigation from "../components/AdminNavigation";

// ── Data ──────────────────────────────────────────────────────────────────────

const initialAnnouncements = [
  { id: "ANN-001", title: "Opening of Educational Assistance Application", category: "Educational Assistance", date: "April 1, 2026" },
  { id: "ANN-002", title: "Reminder for Complete Submission of Documents",  category: "Reminder",              date: "April 5, 2026" },
  { id: "ANN-003", title: "Upcoming SK Youth Development Activity",         category: "SK Activity",           date: "April 8, 2026" },
  { id: "ANN-004", title: "Claiming Schedule Update for Approved Applicants", category: "Schedule Update",    date: "April 10, 2026" },
];

const categories = [
  "Educational Assistance",
  "Reminder",
  "Schedule Update",
  "SK Activity",
];

const emptyForm = { title: "", date: "", category: "", content: "" };

// ── Edit Modal ────────────────────────────────────────────────────────────────

function EditAnnouncementModal({ announcement, onClose, onSave }) {
  const [form, setForm] = useState({
    title:    announcement.title,
    date:     announcement.date,
    category: announcement.category,
    content:  "",
  });
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  function handleSubmit(e) {
    e.preventDefault();
    onSave({ ...announcement, ...form });
    onClose();
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
                  <input className="form-control" value={form.title} onChange={set("title")} required />
                </div>
                <div className="col-md-6">
                  <label className="form-label">Posting Date</label>
                  <input type="date" className="form-control" value={form.date} onChange={set("date")} required />
                </div>
                <div className="col-md-6">
                  <label className="form-label">Category</label>
                  <select className="form-select" value={form.category} onChange={set("category")} required>
                    <option value="" disabled>Select category</option>
                    {categories.map((c) => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div className="col-12">
                  <label className="form-label">Announcement Content</label>
                  <textarea className="form-control" rows="6" value={form.content} onChange={set("content")} placeholder="Enter announcement details" />
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
              <button type="submit" className="btn btn-custom">Update Announcement</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

function AdminAnnouncements() {
  const [announcements, setAnnouncements] = useState(initialAnnouncements);
  const [form, setForm] = useState(emptyForm);
  const [editTarget, setEditTarget] = useState(null);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  function handleSubmit(e) {
    e.preventDefault();
    const newId = `ANN-${String(announcements.length + 1).padStart(3, "0")}`;
    const formatted = new Date(form.date).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
    setAnnouncements((prev) => [...prev, { id: newId, title: form.title, category: form.category, date: formatted }]);
    setForm(emptyForm);
  }

  function deleteAnnouncement(id) {
    setAnnouncements((prev) => prev.filter((a) => a.id !== id));
  }

  function saveEdit(updated) {
    setAnnouncements((prev) => prev.map((a) => a.id === updated.id ? updated : a));
  }

  return (
    <div>
      <AdminNavigation />

      <section className="page-section">
        <div className="container">

          {/* Header */}
          <div className="page-card">
            <h3 className="section-title mb-2">Announcements Management</h3>
            <p className="text-muted mb-0">
              Create, update, and manage announcements related to the educational assistance program and other SK activities.
            </p>
          </div>

          {/* Create Announcement */}
          <div className="page-card">
            <h4 className="sub-title">Create Announcement</h4>

            <div className="info-box">
              Announcements posted here may appear in the public section of the system to inform applicants about application opening dates, reminders, updates, and other important notices.
            </div>

            <form onSubmit={handleSubmit}>
              <div className="row g-3">
                <div className="col-md-8">
                  <label className="form-label">Announcement Title</label>
                  <input type="text" className="form-control" placeholder="Enter announcement title" value={form.title} onChange={set("title")} required />
                </div>

                <div className="col-md-6">
                  <label className="form-label">Posting Date</label>
                  <input type="date" className="form-control" value={form.date} onChange={set("date")} required />
                </div>

                <div className="col-md-6">
                  <label className="form-label">Category</label>
                  <select className="form-select" value={form.category} onChange={set("category")} required>
                    <option value="" disabled>Select category</option>
                    {categories.map((c) => <option key={c}>{c}</option>)}
                  </select>
                </div>

                <div className="col-12">
                  <label className="form-label">Announcement Content</label>
                  <textarea className="form-control" rows="6" placeholder="Enter announcement details" value={form.content} onChange={set("content")} />
                </div>
              </div>

              <div className="mt-4 d-flex justify-content-end gap-2">
                <button type="button" className="btn btn-secondary" onClick={() => setForm(emptyForm)}>Clear</button>
                <button type="submit" className="btn btn-custom">Save Announcement</button>
              </div>
            </form>
          </div>

          {/* Existing Announcements */}
          <div className="page-card">
            <h4 className="sub-title">Existing Announcements</h4>

            <div className="table-responsive">
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
                      <td>{a.id}</td>
                      <td>{a.title}</td>
                      <td>{a.category}</td>
                      <td>{a.date}</td>
                      <td>
                        <button className="btn btn-outline-secondary btn-sm me-1" onClick={() => setEditTarget(a)}>Edit</button>
                        <button className="btn btn-outline-danger btn-sm" onClick={() => deleteAnnouncement(a.id)}>Delete</button>
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

      {editTarget && (
        <EditAnnouncementModal
          announcement={editTarget}
          onClose={() => setEditTarget(null)}
          onSave={saveEdit}
        />
      )}
    </div>
  );
}

export default AdminAnnouncements;