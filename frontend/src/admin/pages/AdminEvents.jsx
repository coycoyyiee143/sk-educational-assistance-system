import { useState, useEffect } from "react";
import AdminNavigation from "../components/AdminNavigation";
import api from "../../services/api";

const STORAGE_URL = "http://localhost:8000/storage/";

const emptyForm = { title: "", venue: "", event_date: "", event_time: "", description: "", image: null };

// ── Helpers ───────────────────────────────────────────────────────────────────
function getEventStatus(dateStr) {
  if (!dateStr) return "Upcoming";
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const eventDate = new Date(dateStr); eventDate.setHours(0, 0, 0, 0);
  if (eventDate.getTime() === today.getTime()) return "Ongoing";
  return eventDate > today ? "Upcoming" : "Finished";
}

function StatusBadge({ status }) {
  const map = { Upcoming: "status-upcoming", Ongoing: "status-ongoing", Finished: "status-finished" };
  return <span className={`status-badge ${map[status] ?? ""}`}>{status}</span>;
}

function formatDate(dateStr) {
  if (!dateStr) return "";
  return new Date(dateStr).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

function formatTime(timeStr) {
  if (!timeStr) return "";
  const [h, m] = timeStr.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const hour = h % 12 || 12;
  return `${hour}:${String(m).padStart(2, "0")} ${period}`;
}

function toInputTime(timeStr) {
  if (!timeStr) return "";
  return timeStr.slice(0, 5);
}

// ── Add Modal ─────────────────────────────────────────────────────────────────
function AddEventModal({ onClose, onSave, saving }) {
  const [form, setForm] = useState(emptyForm);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const setImage = (e) => setForm((f) => ({ ...f, image: e.target.files[0] ?? null }));

  function handleSubmit(e) {
    e.preventDefault();
    onSave(form);
  }

  return (
    <div className="modal fade show d-block" tabIndex="-1" style={{ background: "rgba(0,0,0,0.5)" }}>
      <div className="modal-dialog modal-lg modal-dialog-centered">
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title">Add New Event</h5>
            <button type="button" className="btn-close" onClick={onClose} aria-label="Close" />
          </div>
          <form onSubmit={handleSubmit}>
            <div className="modal-body">
              <div className="row g-3">
                <div className="col-md-6">
                  <label className="form-label">Event Title</label>
                  <input className="form-control" placeholder="Enter event title" value={form.title} onChange={set("title")} required />
                </div>
                <div className="col-md-6">
                  <label className="form-label">Venue</label>
                  <input className="form-control" placeholder="Enter venue" value={form.venue} onChange={set("venue")} />
                </div>
                <div className="col-md-6">
                  <label className="form-label">Date</label>
                  <input type="date" className="form-control" value={form.event_date} onChange={set("event_date")} required />
                </div>
                <div className="col-md-6">
                  <label className="form-label">Time</label>
                  <input type="time" className="form-control" value={form.event_time} onChange={set("event_time")} />
                </div>
                <div className="col-12">
                  <label className="form-label">Description</label>
                  <textarea className="form-control" rows="4" placeholder="Enter event description" value={form.description} onChange={set("description")} />
                </div>
                <div className="col-12">
                  <label className="form-label">Event Image</label>
                  <input type="file" className="form-control" accept="image/*" onChange={setImage} />
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={onClose} disabled={saving}>Cancel</button>
              <button type="submit" className="btn btn-custom" disabled={saving}>
                {saving ? "Saving..." : "Save Event"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

// ── Edit Modal ────────────────────────────────────────────────────────────────
function EditEventModal({ event, onClose, onSave, saving }) {
  const [form, setForm] = useState({
    title: event.title,
    venue: event.venue ?? "",
    event_date: event.event_date,
    event_time: toInputTime(event.event_time),
    description: event.description ?? "",
    image: null,
  });
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const setImage = (e) => setForm((f) => ({ ...f, image: e.target.files[0] ?? null }));

  function handleSubmit(e) {
    e.preventDefault();
    onSave(event.id, form);
  }

  return (
    <div className="modal fade show d-block" tabIndex="-1" style={{ background: "rgba(0,0,0,0.5)" }}>
      <div className="modal-dialog modal-lg modal-dialog-centered">
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title">Edit Event</h5>
            <button type="button" className="btn-close" onClick={onClose} aria-label="Close" />
          </div>
          <form onSubmit={handleSubmit}>
            <div className="modal-body">
              <div className="row g-3">
                <div className="col-md-6">
                  <label className="form-label">Event Title</label>
                  <input className="form-control" value={form.title} onChange={set("title")} required />
                </div>
                <div className="col-md-6">
                  <label className="form-label">Venue</label>
                  <input className="form-control" value={form.venue} onChange={set("venue")} />
                </div>
                <div className="col-md-6">
                  <label className="form-label">Date</label>
                  <input type="date" className="form-control" value={form.event_date} onChange={set("event_date")} required />
                </div>
                <div className="col-md-6">
                  <label className="form-label">Time</label>
                  <input type="time" className="form-control" value={form.event_time} onChange={set("event_time")} />
                </div>
                <div className="col-12">
                  <label className="form-label">Description</label>
                  <textarea className="form-control" rows="4" value={form.description} onChange={set("description")} />
                </div>
                <div className="col-12">
                  {event.image_path && (
                    <div className="mb-2">
                      <img src={`${STORAGE_URL}${event.image_path}`} alt="Current" style={{ width: 100, height: 100, objectFit: "cover", borderRadius: 10 }} />
                    </div>
                  )}
                  <label className="form-label">Replace Event Image</label>
                  <input type="file" className="form-control" accept="image/*" onChange={setImage} />
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={onClose} disabled={saving}>Cancel</button>
              <button type="submit" className="btn btn-custom" disabled={saving}>
                {saving ? "Updating..." : "Update Event"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
function AdminEvents() {
  const [events, setEvents] = useState([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All Status");
  const [dateFilter, setDateFilter] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => { loadEvents(); }, []);

  function loadEvents() {
    setLoading(true);
    api.get("/admin/events")
      .then((res) => setEvents(res.data))
      .catch(() => setError("Failed to load events."))
      .finally(() => setLoading(false));
  }

  function buildFormData(form) {
    const fd = new FormData();
    fd.append("title", form.title);
    fd.append("venue", form.venue ?? "");
    fd.append("event_date", form.event_date);
    fd.append("event_time", form.event_time ?? "");
    fd.append("description", form.description ?? "");
    if (form.image) fd.append("image", form.image);
    return fd;
  }

  async function saveNew(form) {
    setError("");
    setSuccess("");
    setSaving(true);
    try {
      await api.post("/admin/events", buildFormData(form));
      setShowAdd(false);
      setSuccess("Event created successfully.");
      loadEvents();
    } catch (err) {
      const errors = err.response?.data?.errors;
      setError(errors ? Object.values(errors).flat().join(" ") : err.response?.data?.message || "Failed to create event.");
    } finally {
      setSaving(false);
    }
  }

  async function saveEdit(id, form) {
    setError("");
    setSuccess("");
    setSaving(true);
    try {
      const fd = buildFormData(form);
      fd.append("_method", "PUT");
      await api.post(`/admin/events/${id}`, fd);
      setEditTarget(null);
      setSuccess("Event updated successfully.");
      loadEvents();
    } catch (err) {
      const errors = err.response?.data?.errors;
      setError(errors ? Object.values(errors).flat().join(" ") : err.response?.data?.message || "Failed to update event.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteEvent(id) {
    if (!window.confirm("Delete this event?")) return;
    setError("");
    setSuccess("");
    try {
      await api.delete(`/admin/events/${id}`);
      setEvents((prev) => prev.filter((e) => e.id !== id));
    } catch (err) {
      setError(err.response?.data?.message || "Failed to delete event.");
    }
  }

  const filtered = events.filter((e) => {
    const status = getEventStatus(e.event_date);
    const matchSearch = e.title.toLowerCase().includes(search.toLowerCase()) ||
      (e.venue ?? "").toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "All Status" || status === statusFilter;
    const matchDate = !dateFilter || e.event_date === dateFilter;
    return matchSearch && matchStatus && matchDate;
  });

  return (
    <div>
      <AdminNavigation />
      <section className="page-section">
        <div className="container">

          <div className="page-card">
            <h3 className="section-title mb-2">Event Management</h3>
            <p className="text-muted mb-0">
              Manage SK youth programs, community activities, and public events that will be shown on the public events page.
            </p>
          </div>

          {error && <div className="alert alert-danger">{error}</div>}
          {success && <div className="alert alert-success">{success}</div>}

          <div className="page-card">
            <div className="d-flex justify-content-between align-items-center flex-wrap gap-2">
              <h4 className="sub-title mb-0">SK Events List</h4>
              <button className="btn btn-custom" onClick={() => setShowAdd(true)}>Add New Event</button>
            </div>
            <div className="info-box mt-3">
              The administrator may add, edit, or remove events and activities organized by the Sangguniang Kabataan.
              Published events appear on the public events page. Status is calculated automatically based on the event date.
            </div>

            <div className="row g-3 mb-3">
              <div className="col-md-4">
                <input
                  type="text"
                  className="form-control"
                  placeholder="Search event title or venue"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <div className="col-md-3">
                <select className="form-select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                  <option>All Status</option>
                  <option>Upcoming</option>
                  <option>Ongoing</option>
                  <option>Finished</option>
                </select>
              </div>
              <div className="col-md-3">
                <input
                  type="date"
                  className="form-control"
                  value={dateFilter}
                  onChange={(e) => setDateFilter(e.target.value)}
                />
              </div>
            </div>

            {loading ? (
              <div className="text-center py-4"><div className="spinner-border text-danger" role="status" /></div>
            ) : (
              <div className="table-responsive">
                <table className="table table-bordered table-striped align-middle">
                  <thead>
                    <tr>
                      <th>Image</th>
                      <th>Event Title</th>
                      <th>Date</th>
                      <th>Time</th>
                      <th>Venue</th>
                      <th>Status</th>
                      <th style={{ width: 160 }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((ev) => (
                      <tr key={ev.id}>
                        <td>
                          <img
                            src={ev.image_path ? `${STORAGE_URL}${ev.image_path}` : "https://placehold.co/70x70?text=Event"}
                            alt="Event"
                            style={{ width: 70, height: 70, objectFit: "cover", borderRadius: 10 }}
                          />
                        </td>
                        <td>{ev.title}</td>
                        <td>{formatDate(ev.event_date)}</td>
                        <td>{formatTime(ev.event_time)}</td>
                        <td>{ev.venue}</td>
                        <td><StatusBadge status={getEventStatus(ev.event_date)} /></td>
                        <td>
                          <div className="action-buttons">
                            <button className="btn btn-outline-custom btn-sm" onClick={() => setEditTarget(ev)}>Edit</button>
                            <button className="btn btn-delete btn-sm" onClick={() => deleteEvent(ev.id)}>Delete</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {filtered.length === 0 && (
                      <tr><td colSpan="7" className="text-center text-muted">No events found.</td></tr>
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

      {showAdd && (
        <AddEventModal onClose={() => setShowAdd(false)} onSave={saveNew} saving={saving} />
      )}
      {editTarget && (
        <EditEventModal event={editTarget} onClose={() => setEditTarget(null)} onSave={saveEdit} saving={saving} />
      )}
    </div>
  );
}

export default AdminEvents;