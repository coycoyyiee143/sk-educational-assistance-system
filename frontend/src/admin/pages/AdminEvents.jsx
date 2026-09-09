import { useState, useEffect, useRef } from "react";
import AdminNavigation from "../components/AdminNavigation";
import api from "../../services/api";
import PanelFooter from "../../components/PanelFooter";

const STORAGE_URL = `${process.env.REACT_APP_API_URL?.replace('/api', '') || 'http://localhost:8000'}/storage/`;

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
  const [previewUrl, setPreviewUrl] = useState(null);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef(null);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  function applyFile(file) {
    if (!file) return;
    setForm((f) => ({ ...f, image: file }));
    setPreviewUrl(URL.createObjectURL(file));
  }

  function handleFileInputChange(e) {
    applyFile(e.target.files[0] ?? null);
  }

  function handleDrop(e) {
    e.preventDefault();
    setDragActive(false);
    const file = e.dataTransfer.files?.[0];
    if (file) applyFile(file);
  }

  function handleDragOver(e) {
    e.preventDefault();
    setDragActive(true);
  }

  function handleDragLeave(e) {
    e.preventDefault();
    setDragActive(false);
  }

  function removeImage(e) {
    e.stopPropagation();
    setForm((f) => ({ ...f, image: null }));
    setPreviewUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function handleSubmit(e) {
    e.preventDefault();
    onSave(form);
  }

  return (
    <div className="modal fade show d-block" tabIndex="-1" style={{ background: "rgba(0,0,0,0.5)" }}>
      <div className="modal-dialog modal-lg modal-dialog-centered">
        <div className="modal-content edit-announcement-modal event-modal-content">
          <div className="modal-header">
            <h5 className="modal-title">Add Event</h5>
            <button type="button" className="btn-close" onClick={onClose} aria-label="Close" />
          </div>
          <form onSubmit={handleSubmit}>
            <div className="event-modal-split">
              <div className="event-modal-image-col">
                <label className="event-modal-image-label">Event Image Cover</label>
                <div
                  className={`event-image-dropzone ${dragActive ? "drag-active" : ""}`}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                >
                  {previewUrl ? (
                    <div className="event-image-preview-wrap">
                      <img src={previewUrl} alt="Preview" />
                      <button type="button" className="event-image-remove-btn" onClick={removeImage} aria-label="Remove image">×</button>
                    </div>
                  ) : (
                    <>
                      <div className="event-image-dropzone-icon">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M12 16V4M12 4l-4 4M12 4l4 4" />
                          <path d="M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
                        </svg>
                      </div>
                      <p className="event-image-dropzone-text">Drag and drop image</p>
                      <p className="event-image-dropzone-hint">JPG, PNG, WEBP (Max 5MB)</p>
                      <span className="event-image-dropzone-browse">Browse</span>
                    </>
                  )}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFileInputChange}
                    style={{ display: "none" }}
                  />
                </div>
              </div>
              <div className="event-modal-fields-col">
                <div className="row g-3">
                  <div className="col-12">
                    <label className="form-label">Event Title<span className="event-modal-required">*</span></label>
                    <input className="form-control" placeholder="Enter event title" value={form.title} onChange={set("title")} required />
                  </div>
                  <div className="col-12">
                    <label className="form-label">Venue</label>
                    <input className="form-control" placeholder="Enter venue" value={form.venue} onChange={set("venue")} />
                  </div>
                  <div className="col-md-6">
                    <label className="form-label">Date<span className="event-modal-required">*</span></label>
                    <input type="date" className="form-control" value={form.event_date} onChange={set("event_date")} required />
                  </div>
                  <div className="col-md-6">
                    <label className="form-label">Time</label>
                    <input type="time" className="form-control" value={form.event_time} onChange={set("event_time")} />
                  </div>
                  <div className="col-12 mt-4">
                    <label className="form-label">Description</label>
                    <textarea className="form-control announcement-textarea" placeholder="Enter event description" value={form.description} onChange={set("description")} />
                  </div>
                </div>
              </div>
            </div>
            <div className="event-modal-footer">
              <button type="button" className="btn btn-clear-dark" onClick={onClose} disabled={saving}>Cancel</button>
              <button type="submit" className="btn btn-save-green" disabled={saving}>
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
  const [previewUrl, setPreviewUrl] = useState(event.image_path ? `${STORAGE_URL}${event.image_path}` : null);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef(null);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  function applyFile(file) {
    if (!file) return;
    setForm((f) => ({ ...f, image: file }));
    setPreviewUrl(URL.createObjectURL(file));
  }

  function handleFileInputChange(e) {
    applyFile(e.target.files[0] ?? null);
  }

  function handleDrop(e) {
    e.preventDefault();
    setDragActive(false);
    const file = e.dataTransfer.files?.[0];
    if (file) applyFile(file);
  }

  function handleDragOver(e) {
    e.preventDefault();
    setDragActive(true);
  }

  function handleDragLeave(e) {
    e.preventDefault();
    setDragActive(false);
  }

  function removeImage(e) {
    e.stopPropagation();
    setForm((f) => ({ ...f, image: null }));
    setPreviewUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function handleSubmit(e) {
    e.preventDefault();
    onSave(event.id, form);
  }

  return (
    <div className="modal fade show d-block" tabIndex="-1" style={{ background: "rgba(0,0,0,0.5)" }}>
      <div className="modal-dialog modal-lg modal-dialog-centered">
        <div className="modal-content edit-announcement-modal event-modal-content">
          <div className="event-modal-header-amber">
            <h5 className="modal-title">Edit Event</h5>
            <button type="button" className="btn-close" onClick={onClose} aria-label="Close" />
          </div>
          <form onSubmit={handleSubmit}>
            <div className="event-modal-split">
              <div className="event-modal-image-col">
                <label className="event-modal-image-label">Event Image Cover</label>
                <div
                  className={`event-image-dropzone ${dragActive ? "drag-active" : ""}`}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                >
                  {previewUrl ? (
                    <div className="event-image-preview-wrap">
                      <img src={previewUrl} alt="Preview" />
                      <button type="button" className="event-image-remove-btn" onClick={removeImage} aria-label="Remove image">×</button>
                    </div>
                  ) : (
                    <>
                      <div className="event-image-dropzone-icon">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M12 16V4M12 4l-4 4M12 4l4 4" />
                          <path d="M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
                        </svg>
                      </div>
                      <p className="event-image-dropzone-text">Drag and drop image</p>
                      <p className="event-image-dropzone-hint">JPG, PNG, WEBP (Max 5MB)</p>
                      <span className="event-image-dropzone-browse">Browse</span>
                    </>
                  )}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFileInputChange}
                    style={{ display: "none" }}
                  />
                </div>
              </div>
              <div className="event-modal-fields-col">
                <div className="row g-3">
                  <div className="col-12">
                    <label className="form-label">Event Title</label>
                    <input className="form-control" value={form.title} onChange={set("title")} required />
                  </div>
                  <div className="col-12">
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
                  <div className="col-12 mt-4">
                    <label className="form-label">Description</label>
                    <textarea className="form-control announcement-textarea" value={form.description} onChange={set("description")} />
                  </div>
                </div>
              </div>
            </div>
            <div className="event-modal-footer">
              <button type="button" className="btn btn-clear-dark" onClick={onClose} disabled={saving}>Cancel</button>
              <button type="submit" className="btn btn-save-green" disabled={saving}>
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
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [countdown, setCountdown] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const perPage = 10;
  const [showDeleteAllConfirm, setShowDeleteAllConfirm] = useState(false);

  useEffect(() => { loadEvents(); }, []);

  useEffect(() => {
    if (!error && !success) return;
    setCountdown(10);
    const tick = setInterval(() => {
      setCountdown((c) => (c <= 1 ? 0 : c - 1));
    }, 1000);
    const dismiss = setTimeout(() => {
      setError("");
      setSuccess("");
    }, 10000);
    return () => {
      clearInterval(tick);
      clearTimeout(dismiss);
    };
  }, [error, success]);

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
      setCurrentPage(1);
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
    setDeleteTarget(null);
    setError("");
    setSuccess("");
    try {
      await api.delete(`/admin/events/${id}`);
      setEvents((prev) => prev.filter((e) => e.id !== id));
    } catch (err) {
      setError(err.response?.data?.message || "Failed to delete event.");
    }
  }

  async function deleteAllEvents() {
    setShowDeleteAllConfirm(false);
    setError("");
    setSuccess("");
    try {
      await Promise.all(events.map((e) => api.delete(`/admin/events/${e.id}`)));
      setEvents([]);
      setCurrentPage(1);
      setSuccess("All events have been permanently deleted from the system.");
    } catch (err) {
      setError(err.response?.data?.message || "Failed to delete all events.");
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

  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
  const pageStart = (currentPage - 1) * perPage;
  const pagedEvents = filtered.slice(pageStart, pageStart + perPage);

  function goToPage(page) {
    if (page < 1 || page > totalPages) return;
    setCurrentPage(page);
  }

  function getPageNumbers() {
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
              <h3 className="section-title mb-2">Event Management</h3>
              <p className="text-muted mb-0">
                Manage SK youth programs, community activities, and public events that will be shown on the public events page.
              </p>
            </div>

            <div className="page-card">
              <div className="table-header-row">
                <h4 className="sub-title sub-title-dark mb-0">SK Events List</h4>
                <div className="table-header-actions">
                  <button className="btn btn-save-green" onClick={() => setShowAdd(true)}>Add Event</button>
                </div>
              </div>

              <div className="visibility-notice">
                <div className="visibility-notice-icon">!</div>
                <div className="visibility-notice-body">
                  <strong className="visibility-notice-title">Visibility Notice</strong>
                  <p className="visibility-notice-text">
                    The administrator may add, edit, or remove events and activities organized by the Sangguniang Kabataan.
                    Published events appear on the public events page. Status is calculated automatically based on the event date.
                  </p>
                </div>
              </div>

              <div className="row g-3 mb-3">
                <div className="col-md-4">
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Search event title or venue"
                    value={search}
                    onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
                  />
                </div>
                <div className="col-md-3">
                  <select className="form-select" value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(1); }}>
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
                    onChange={(e) => { setDateFilter(e.target.value); setCurrentPage(1); }}
                  />
                </div>
                <div className="col-md-2 d-flex align-items-center justify-content-end">
                  <button
                    type="button"
                    className="table-toolbar-btn table-toolbar-btn-red"
                    onClick={() => setShowDeleteAllConfirm(true)}
                  >
                    Delete All
                  </button>
                </div>
              </div>

              {loading ? (
                <div className="text-center py-4"><div className="spinner-border text-danger" role="status" /></div>
              ) : (
                <div className="table-responsive">
                  <table className="table table-bordered table-striped align-middle announcement-table">
                    <colgroup>
                      <col style={{ width: "10%" }} />
                      <col style={{ width: "20%" }} />
                      <col style={{ width: "14%" }} />
                      <col style={{ width: "10%" }} />
                      <col style={{ width: "20%" }} />
                      <col style={{ width: "15%" }} />
                      <col style={{ width: "11%" }} />
                    </colgroup>
                    <thead>
                      <tr>
                        <th>Image</th>
                        <th>Event Title</th>
                        <th>Date</th>
                        <th>Time</th>
                        <th>Venue</th>
                        <th>Status</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pagedEvents.map((ev) => (
                        <tr key={ev.id}>
                          <td>
                            <img
                              src={ev.image_path ? `${STORAGE_URL}${ev.image_path}` : "https://placehold.co/70x70?text=Event"}
                              alt="Event"
                              style={{ width: 60, height: 60, objectFit: "cover", borderRadius: 10 }}
                            />
                          </td>
                          <td>{ev.title}</td>
                          <td>{formatDate(ev.event_date)}</td>
                          <td>{formatTime(ev.event_time)}</td>
                          <td>{ev.venue}</td>
                          <td><StatusBadge status={getEventStatus(ev.event_date)} /></td>
                          <td>
                            <button className="icon-btn icon-btn-edit" onClick={() => setEditTarget(ev)} title="Edit" aria-label="Edit">
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                              </svg>
                            </button>
                            <button className="icon-btn icon-btn-delete" onClick={() => setDeleteTarget(ev)} title="Delete" aria-label="Delete">
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M3 6h18" />
                                <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                                <line x1="10" y1="11" x2="10" y2="17" />
                                <line x1="14" y1="11" x2="14" y2="17" />
                              </svg>
                            </button>
                          </td>
                        </tr>
                      ))}
                      {pagedEvents.length === 0 && (
                        <tr><td colSpan="7" className="text-center text-muted">No events found.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              {!loading && filtered.length > 0 && (
                <div className="table-pagination-bar">
                  <span className="table-pagination-info">
                    Showing {pageStart + 1}–{Math.min(pageStart + perPage, filtered.length)} of {filtered.length} events
                  </span>
                  <div className="table-pagination-controls">
                    <button
                      className="table-pagination-arrow"
                      onClick={() => goToPage(currentPage - 1)}
                      disabled={currentPage === 1}
                      aria-label="Previous page"
                    >
                      ‹
                    </button>
                    {getPageNumbers().map((page, idx) =>
                      page === "..." ? (
                        <span key={`ellipsis-${idx}`} className="table-pagination-ellipsis">…</span>
                      ) : (
                        <button
                          key={page}
                          className={`table-pagination-page ${page === currentPage ? "table-pagination-page-active" : ""}`}
                          onClick={() => goToPage(page)}
                        >
                          {page}
                        </button>
                      )
                    )}
                    <button
                      className="table-pagination-arrow"
                      onClick={() => goToPage(currentPage + 1)}
                      disabled={currentPage === totalPages}
                      aria-label="Next page"
                    >
                      ›
                    </button>
                  </div>
                </div>
              )}
            </div>

          </div>
        </section>
        <PanelFooter />
      </div>

      {showAdd && (
        <AddEventModal onClose={() => setShowAdd(false)} onSave={saveNew} saving={saving} />
      )}
      {editTarget && (
        <EditEventModal event={editTarget} onClose={() => setEditTarget(null)} onSave={saveEdit} saving={saving} />
      )}

      {deleteTarget && (
        <div className="feedback-popup-backdrop">
          <div className="feedback-popup feedback-popup-error">
            <p className="feedback-popup-message feedback-popup-message-simple">
              Delete this event?
            </p>
            <div className="feedback-popup-confirm-actions">
              <button
                type="button"
                className="feedback-popup-cancel"
                onClick={() => setDeleteTarget(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="feedback-popup-proceed"
                onClick={() => deleteEvent(deleteTarget.id)}
              >
                Yes
              </button>
            </div>
          </div>
        </div>
      )}

      {showDeleteAllConfirm && (
        <div className="feedback-popup-backdrop">
          <div className="feedback-popup feedback-popup-error">
            <div className="feedback-popup-icon-wrap">
              <span className="feedback-popup-icon">!</span>
            </div>
            <h4 className="feedback-popup-title">Delete All Events?</h4>
            <p className="feedback-popup-message">
              This will permanently remove all events from the system. This action cannot be undone.
            </p>
            <div className="feedback-popup-confirm-actions">
              <button
                type="button"
                className="feedback-popup-cancel"
                onClick={() => setShowDeleteAllConfirm(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="feedback-popup-proceed"
                onClick={deleteAllEvents}
              >
                Proceed
              </button>
            </div>
          </div>
        </div>
      )}

      {(error || success) && (
        <div className="feedback-popup-backdrop">
          <div className={`feedback-popup ${error ? "feedback-popup-error" : "feedback-popup-success"}`}>
            <div className="feedback-popup-icon-wrap">
              <span className="feedback-popup-icon">{error ? "!" : "✓"}</span>
            </div>
            <h4 className="feedback-popup-title">{error ? "Something Went Wrong" : "Event Saved"}</h4>
            <p className="feedback-popup-message">{error || success}</p>
            <button
              type="button"
              className="feedback-popup-dismiss"
              onClick={() => { setError(""); setSuccess(""); }}
            >
              <span>Dismiss</span>
              <span className="feedback-popup-arrow">→</span>
              <span className="feedback-popup-timer">{countdown}s</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminEvents;