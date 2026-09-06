import { useState, useEffect, useRef } from "react";
import AdminNavigation from "../components/AdminNavigation";
import api from "../../services/api";
import PanelFooter from "../../components/PanelFooter";

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
        <div className="modal-content edit-announcement-modal">
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
                  <div className="visibility-notice">
                    <div className="visibility-notice-icon">!</div>
                    <div className="visibility-notice-body">
                      <strong className="visibility-notice-title">Posted on {formatDate(announcement.published_at)}</strong>
                      <p className="visibility-notice-text">
                        The posting date cannot be changed when editing this announcement.
                      </p>
                    </div>
                  </div>
                </div>
                <div className="col-12">
                  <label className="form-label">Announcement Content</label>
                  <textarea className="form-control announcement-textarea" value={form.content} onChange={set("content")} placeholder="Enter announcement details" required />
                </div>
              </div>
              <div className="mt-4 d-flex justify-content-end gap-2">
                <button type="button" className="btn btn-clear-dark" onClick={onClose} disabled={saving}>Cancel</button>
                <button type="submit" className="btn btn-save-green" disabled={saving}>
                  {saving ? "Saving..." : "Save"}
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

function AdminAnnouncements() {
  const [announcements, setAnnouncements] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editTarget, setEditTarget] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [countdown, setCountdown] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const perPage = 10;
  const [categoryFilter, setCategoryFilter] = useState("");
  const [showCategoryMenu, setShowCategoryMenu] = useState(false);
  const categoryMenuRef = useRef(null);
  const [showDeleteAllConfirm, setShowDeleteAllConfirm] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);

  useEffect(() => { loadAnnouncements(); }, []);

  useEffect(() => {
    function handleClickOutside(e) {
      if (categoryMenuRef.current && !categoryMenuRef.current.contains(e.target)) {
        setShowCategoryMenu(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

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

  function loadAnnouncements() {
    setLoading(true);
    api.get("/admin/announcements")
      .then((res) => {
        const sorted = [...res.data].sort(
          (a, b) => new Date(b.published_at) - new Date(a.published_at)
        );
        setAnnouncements(sorted);
      })
      .catch(() => setError("Failed to load announcements."))
      .finally(() => setLoading(false));
  }

  const filteredAnnouncements = categoryFilter
    ? announcements.filter((a) => a.category === categoryFilter)
    : announcements;

  const totalPages = Math.max(1, Math.ceil(filteredAnnouncements.length / perPage));
  const pageStart = (currentPage - 1) * perPage;
  const pagedAnnouncements = filteredAnnouncements.slice(pageStart, pageStart + perPage);

  async function deleteAllAnnouncements() {
    setShowDeleteAllConfirm(false);
    setError("");
    setSuccess("");
    try {
      await Promise.all(announcements.map((a) => api.delete(`/admin/announcements/${a.id}`)));
      setAnnouncements([]);
      setCurrentPage(1);
      setSuccess("All announcements have been permanently deleted from the system.");
    } catch (err) {
      setError(err.response?.data?.message || "Failed to delete all announcements.");
    }
  }

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

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSuccess("");
    setSaving(true);
    try {
      await api.post("/admin/announcements", form);
      setForm(emptyForm);
      setSuccess("Your announcement has been successfully published and is now visible to the academic community.");
      setCurrentPage(1);
      loadAnnouncements();
    } catch (err) {
      const errors = err.response?.data?.errors;
      setError(errors ? Object.values(errors).flat().join(" ") : err.response?.data?.message || "Failed to save announcement.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteAnnouncement(id) {
    setDeleteTarget(null);
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

            <div className="page-card page-card-accent-gold">
              <h3 className="section-title mb-2">Announcements Management</h3>
              <p className="text-muted mb-0">
                Create, update, and manage announcements related to the educational assistance program and other SK activities.
              </p>
            </div>

            <div className="page-card">
              <h4 className="sub-title sub-title-dark">Create Announcement</h4>
              <div className="visibility-notice">
                <div className="visibility-notice-icon">!</div>
                <div className="visibility-notice-body">
                  <strong className="visibility-notice-title">Visibility Notice</strong>
                  <p className="visibility-notice-text">
                    Announcements posted here will appear in the public section of the system to inform applicants about application opening dates, reminders, updates, and other important notices. Once published, they are immediately visible to all active student portals — ensure all details are verified before publishing.
                  </p>
                </div>
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
                    <textarea className="form-control announcement-textarea" placeholder="Enter announcement details" value={form.content} onChange={set("content")} required />
                  </div>
                </div>
                <div className="mt-4 d-flex justify-content-end gap-2">
                  <button type="button" className="btn btn-clear-dark" onClick={() => setForm(emptyForm)} disabled={saving}>Clear</button>
                  <button type="submit" className="btn btn-save-green" disabled={saving}>
                    {saving ? "Saving..." : "Save Announcement"}
                  </button>
                </div>
              </form>
            </div>

            <div className="page-card">
              <div className="table-header-row">
                <h4 className="sub-title sub-title-dark mb-0">Announcement Management</h4>
                <div className="table-header-actions">
                  <div className="table-toolbar-filter-wrap" ref={categoryMenuRef}>
                    <button
                      type="button"
                      className="table-toolbar-btn table-toolbar-btn-blue"
                      onClick={() => setShowCategoryMenu((s) => !s)}
                    >
                      Category
                    </button>
                    {showCategoryMenu && (
                      <div className="table-toolbar-menu">
                        <button
                          type="button"
                          className="table-toolbar-menu-item"
                          onClick={() => { setCategoryFilter(""); setCurrentPage(1); setShowCategoryMenu(false); }}
                        >
                          All Categories
                        </button>
                        {categories.map((c) => (
                          <button
                            key={c}
                            type="button"
                            className="table-toolbar-menu-item"
                            onClick={() => { setCategoryFilter(c); setCurrentPage(1); setShowCategoryMenu(false); }}
                          >
                            {c}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <button
                    type="button"
                    className="table-toolbar-btn table-toolbar-btn-red"
                    onClick={() => setShowDeleteAllConfirm(true)}
                  >
                    Delete All
                  </button>
                </div>
              </div>

              <div className="table-responsive">
                <table className="table table-bordered table-striped align-middle announcement-table">
                  <colgroup>
                    <col style={{ width: "20%" }} />
                    <col style={{ width: "25%" }} />
                    <col style={{ width: "22%" }} />
                    <col style={{ width: "20%" }} />
                    <col style={{ width: "11%" }} />
                  </colgroup>
                  <thead>
                    <tr>
                      <th>Announcement ID</th>
                      <th>Title</th>
                      <th>Category</th>
                      <th>Posting Date</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr>
                        <td colSpan="5" className="text-center py-4">
                          <div className="spinner-border text-danger" role="status" />
                        </td>
                      </tr>
                    ) : (
                      <>
                        {pagedAnnouncements.map((a) => (
                          <tr key={a.id}>
                            <td>ANN-{String(a.id).padStart(3, "0")}</td>
                            <td>{a.title}</td>
                            <td>{a.category}</td>
                            <td>{formatDate(a.published_at)}</td>
                            <td>
                              <button className="icon-btn icon-btn-edit" onClick={() => setEditTarget(a)} title="Edit" aria-label="Edit">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                                </svg>
                              </button>
                              <button className="icon-btn icon-btn-delete" onClick={() => setDeleteTarget(a)} title="Delete" aria-label="Delete">
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
                        {pagedAnnouncements.length === 0 && (
                          <tr><td colSpan="5" className="text-center text-muted">No announcements found.</td></tr>
                        )}
                      </>
                    )}
                  </tbody>
                </table>
              </div>

              {!loading && filteredAnnouncements.length > 0 && (
                <div className="table-pagination-bar">
                  <span className="table-pagination-info">
                    Showing {pageStart + 1}–{Math.min(pageStart + perPage, filteredAnnouncements.length)} of {filteredAnnouncements.length} announcements
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

      {editTarget && (
        <EditAnnouncementModal
          announcement={editTarget}
          onClose={() => setEditTarget(null)}
          onSave={saveEdit}
          saving={saving}
        />
      )}

      {deleteTarget && (
        <div className="feedback-popup-backdrop">
          <div className="feedback-popup feedback-popup-error">
            <p className="feedback-popup-message feedback-popup-message-simple">
              Delete this announcement?
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
                onClick={() => deleteAnnouncement(deleteTarget.id)}
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
            <h4 className="feedback-popup-title">Delete All Announcements?</h4>
            <p className="feedback-popup-message">
              This will permanently remove all announcements from the system. This action cannot be undone.
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
                onClick={deleteAllAnnouncements}
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
            <h4 className="feedback-popup-title">{error ? "Something Went Wrong" : "Announcement Posted"}</h4>
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

export default AdminAnnouncements;