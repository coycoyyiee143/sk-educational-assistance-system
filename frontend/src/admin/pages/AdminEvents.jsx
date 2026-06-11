import { useState } from "react";
import AdminNavigation from "../components/AdminNavigation";

// ── Data ──────────────────────────────────────────────────────────────────────

const initialEvents = [
  { id: 1, image: "event1.jpg", title: "SK Inter-Barangay Basketball League", date: "2026-05-05", time: "08:00", venue: "Barangay Covered Court",       status: "Upcoming",  description: "A sports league organized by SK to promote physical fitness, teamwork, and camaraderie among youth participants." },
  { id: 2, image: "event2.jpg", title: "Community Clean-Up Drive",             date: "2026-05-10", time: "07:00", venue: "Barangay Mamatid Area",        status: "Upcoming",  description: "" },
  { id: 3, image: "event3.jpg", title: "Youth Leadership Workshop",            date: "2026-04-30", time: "13:00", venue: "Barangay Session Hall",        status: "Ongoing",   description: "" },
  { id: 4, image: "event4.jpg", title: "Study Skills and Academic Seminar",    date: "2026-04-15", time: "09:00", venue: "Barangay Multipurpose Hall",   status: "Finished",  description: "" },
];

const statuses = ["Upcoming", "Ongoing", "Finished"];

const emptyForm = { title: "", venue: "", date: "", time: "", status: "", description: "", image: null };

// ── Helpers ───────────────────────────────────────────────────────────────────

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

// ── Add Modal ─────────────────────────────────────────────────────────────────

function AddEventModal({ onClose, onSave }) {
  const [form, setForm] = useState(emptyForm);
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
                  <input className="form-control" placeholder="Enter venue" value={form.venue} onChange={set("venue")} required />
                </div>
                <div className="col-md-4">
                  <label className="form-label">Date</label>
                  <input type="date" className="form-control" value={form.date} onChange={set("date")} required />
                </div>
                <div className="col-md-4">
                  <label className="form-label">Time</label>
                  <input type="time" className="form-control" value={form.time} onChange={set("time")} required />
                </div>
                <div className="col-md-4">
                  <label className="form-label">Status</label>
                  <select className="form-select" value={form.status} onChange={set("status")} required>
                    <option value="" disabled>Select status</option>
                    {statuses.map((s) => <option key={s}>{s}</option>)}
                  </select>
                </div>
                <div className="col-12">
                  <label className="form-label">Description</label>
                  <textarea className="form-control" rows="4" placeholder="Enter event description" value={form.description} onChange={set("description")} />
                </div>
                <div className="col-12">
                  <label className="form-label">Event Image</label>
                  <input type="file" className="form-control" />
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={() => setForm(emptyForm)}>Clear</button>
              <button type="submit" className="btn btn-custom">Save Event</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

// ── Edit Modal ────────────────────────────────────────────────────────────────

function EditEventModal({ event, onClose, onSave }) {
  const [form, setForm] = useState({
    title:       event.title,
    venue:       event.venue,
    date:        event.date,
    time:        event.time,
    status:      event.status,
    description: event.description,
  });
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  function handleSubmit(e) {
    e.preventDefault();
    onSave({ ...event, ...form });
    onClose();
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
                  <input className="form-control" value={form.venue} onChange={set("venue")} required />
                </div>
                <div className="col-md-4">
                  <label className="form-label">Date</label>
                  <input type="date" className="form-control" value={form.date} onChange={set("date")} required />
                </div>
                <div className="col-md-4">
                  <label className="form-label">Time</label>
                  <input type="time" className="form-control" value={form.time} onChange={set("time")} required />
                </div>
                <div className="col-md-4">
                  <label className="form-label">Status</label>
                  <select className="form-select" value={form.status} onChange={set("status")} required>
                    {statuses.map((s) => <option key={s}>{s}</option>)}
                  </select>
                </div>
                <div className="col-12">
                  <label className="form-label">Description</label>
                  <textarea className="form-control" rows="4" value={form.description} onChange={set("description")} />
                </div>
                <div className="col-12">
                  <label className="form-label">Replace Event Image</label>
                  <input type="file" className="form-control" />
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
              <button type="submit" className="btn btn-custom">Update Event</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

function AdminEvents() {
  const [events, setEvents] = useState(initialEvents);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All Status");
  const [dateFilter, setDateFilter] = useState("");

  const [showAdd, setShowAdd] = useState(false);
  const [editTarget, setEditTarget] = useState(null);

  function saveNew(form) {
    const newId = Math.max(...events.map((e) => e.id)) + 1;
    setEvents((prev) => [...prev, { ...form, id: newId, image: "" }]);
  }

  function saveEdit(updated) {
    setEvents((prev) => prev.map((e) => e.id === updated.id ? updated : e));
  }

  function deleteEvent(id) {
    setEvents((prev) => prev.filter((e) => e.id !== id));
  }

  const filtered = events.filter((e) => {
    const matchSearch = e.title.toLowerCase().includes(search.toLowerCase()) ||
      e.venue.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "All Status" || e.status === statusFilter;
    const matchDate = !dateFilter || e.date === dateFilter;
    return matchSearch && matchStatus && matchDate;
  });

  return (
    <div>
      <AdminNavigation />

      <section className="page-section">
        <div className="container">

          {/* Header */}
          <div className="page-card">
            <h3 className="section-title mb-2">Event Management</h3>
            <p className="text-muted mb-0">
              Manage SK youth programs, community activities, and public events that will be shown on the public events page.
            </p>
          </div>

          {/* Events List */}
          <div className="page-card">
            <div className="d-flex justify-content-between align-items-center flex-wrap gap-2">
              <h4 className="sub-title mb-0">SK Events List</h4>
              <button className="btn btn-custom" onClick={() => setShowAdd(true)}>Add New Event</button>
            </div>

            <div className="info-box mt-3">
              The administrator may add, edit, or remove events and activities organized by the Sangguniang Kabataan. These events may also be displayed on the public events page.
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
                  {statuses.map((s) => <option key={s}>{s}</option>)}
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
                          src={ev.image || "https://placehold.co/70x70?text=Event"}
                          alt="Event"
                          style={{ width: 70, height: 70, objectFit: "cover", borderRadius: 10 }}
                        />
                      </td>
                      <td>{ev.title}</td>
                      <td>{formatDate(ev.date)}</td>
                      <td>{formatTime(ev.time)}</td>
                      <td>{ev.venue}</td>
                      <td><StatusBadge status={ev.status} /></td>
                      <td>
                        <div className="action-buttons">
                          <button className="btn btn-outline-custom btn-sm" onClick={() => setEditTarget(ev)}>Edit</button>
                          <button className="btn btn-delete btn-sm" onClick={() => deleteEvent(ev.id)}>Delete</button>
                        </div>
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

      {showAdd && (
        <AddEventModal onClose={() => setShowAdd(false)} onSave={saveNew} />
      )}
      {editTarget && (
        <EditEventModal event={editTarget} onClose={() => setEditTarget(null)} onSave={saveEdit} />
      )}
    </div>
  );
}

export default AdminEvents;