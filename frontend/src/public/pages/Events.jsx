import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import "bootstrap/dist/js/bootstrap.bundle.min.js";
import api, { STORAGE_URL } from "../../services/api";
import Footer from "../../components/Footer";

const Events = () => {
  const PAGE_SIZE = 3;
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [isFiltering, setIsFiltering] = useState(false);
  const [selected, setSelected] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    api.get("/events")
      .then((res) => setEvents(res.data))
      .catch(() => { })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    setIsFiltering(true);
    setCurrentPage(1);
    const timer = setTimeout(() => setIsFiltering(false), 400);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  function formatDate(dateStr) {
    if (!dateStr) return "";
    return new Date(dateStr).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  }

  // The API serializes date-cast fields as full UTC timestamps (e.g.
  // "2026-09-19T16:00:00.000000Z" for a 2026-09-20 local date, since the
  // server runs Asia/Manila), NOT a plain "YYYY-MM-DD" — so slicing the
  // first 10 characters grabs the UTC date, which is a day off from the
  // intended local calendar date. Parse as a Date (which correctly
  // converts to local time) and read local components instead.
  function toLocalDateStr(dateStr) {
    if (!dateStr) return "";
    const d = new Date(dateStr);
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${d.getFullYear()}-${m}-${day}`;
  }

  // "September 20, 2026" for a single day, "September 20–22, 2026" for a
  // multi-day event.
  function formatDateRange(startStr, endStr) {
    if (!endStr || endStr === startStr) return formatDate(startStr);
    const start = new Date(startStr);
    const end = new Date(endStr);
    const sameMonth = start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear();
    const startLabel = start.toLocaleDateString("en-US", { month: "long", day: "numeric", year: sameMonth ? undefined : "numeric" });
    const endLabel = end.toLocaleDateString("en-US", { month: sameMonth ? undefined : "long", day: "numeric", year: "numeric" });
    return `${startLabel}–${endLabel}`;
  }

  function formatTime(timeStr) {
    if (!timeStr) return "";
    const [h, m] = timeStr.split(":").map(Number);
    const period = h >= 12 ? "PM" : "AM";
    const hour = h % 12 || 12;
    return `${hour}:${String(m).padStart(2, "0")} ${period}`;
  }

  // Mirrors AdminEvents' getEventStatus — a real start–end window rather
  // than just "is event_date today", so a multi-day event stays Ongoing
  // for its whole span, and Ongoing events can be surfaced first below.
  function getEventStatus(event) {
    if (!event?.event_date) return "Upcoming";
    const start = new Date(`${toLocalDateStr(event.event_date)}T${event.event_time ? event.event_time.slice(0, 5) : "00:00"}:00`);
    const endDateStr = event.end_date ? toLocalDateStr(event.end_date) : toLocalDateStr(event.event_date);
    const end = new Date(`${endDateStr}T${event.end_time ? event.end_time.slice(0, 5) : "23:59"}:59`);
    const now = new Date();
    if (now < start) return "Upcoming";
    if (now > end) return "Finished";
    return "Ongoing";
  }

  const STATUS_PRIORITY = { Ongoing: 0, Upcoming: 1, Finished: 2 };

  const filteredEvents = events
    .filter((ev) => {
      const term = searchTerm.trim().toLowerCase();
      if (term === "") return true;
      return (
        ev.title?.toLowerCase().includes(term) ||
        ev.description?.toLowerCase().includes(term) ||
        ev.venue?.toLowerCase().includes(term)
      );
    })
    // Ongoing events are the most relevant to someone visiting right now,
    // so they lead the list, then Upcoming, then Finished — each group
    // still ordered by date as the API returned it.
    .slice()
    .sort((a, b) => STATUS_PRIORITY[getEventStatus(a)] - STATUS_PRIORITY[getEventStatus(b)]);

  const totalPages = Math.max(1, Math.ceil(filteredEvents.length / PAGE_SIZE));
  const paginatedEvents = filteredEvents.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  );

  const goToPage = (page) => {
    if (page < 1 || page > totalPages) return;
    setIsFiltering(true);
    setCurrentPage(page);
    setTimeout(() => setIsFiltering(false), 350);
  };

  const hasNoEventsAtAll = events.length === 0;

  return (
    <>
      <nav className="navbar navbar-expand-lg sticky-top navbar-custom">
        <div className="container">
          <Link className="navbar-brand navbar-brand-custom" to="/">
            <img src="/icons/sk-logo.jpg" alt="SK Logo" />
            <div className="brand-text">
              <h5>SK Barangay Mamatid</h5>
              <span>Educational Assistance System</span>
            </div>
          </Link>
          <button className="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#mainNavbar">
            <span className="navbar-toggler-icon"></span>
          </button>
          <div className="collapse navbar-collapse justify-content-end" id="mainNavbar">
            <ul className="navbar-nav">
              <li className="nav-item"><Link className="nav-link" to="/">Home</Link></li>
              <li className="nav-item"><Link className="nav-link" to="/requirements">Requirements</Link></li>
              <li className="nav-item"><Link className="nav-link" to="/announcements">Announcements</Link></li>
              <li className="nav-item"><Link className="nav-link active" to="/events">Events</Link></li>
              <li className="nav-item"><Link className="nav-link" to="/login">Login</Link></li>
              <li className="nav-item"><Link className="nav-link" to="/register">Register</Link></li>
            </ul>
          </div>
        </div>
      </nav>

      <section className="hero text-white text-center py-5"
        style={{ background: "linear-gradient(rgba(183,28,28,0.85), rgba(211,47,47,0.85))" }}>
        <div className="container">
          <h1>SK Youth Programs and Activities</h1>
          <p>The Sangguniang Kabataan organizes youth programs, sports, and community activities in Barangay Mamatid.</p>
        </div>
      </section>

      <section className="py-4">
        <div className="container">
          <div className="featured-announcement-card featured-split-layout">
            <div className="featured-main-col">
              <div className="featured-badge-row">
                <span className="featured-badge">Notice</span>
                <span className="featured-badge-divider"></span>
                <span className="featured-bulletin-label">Event Guidelines</span>
              </div>
              <h5 className="featured-title">Events Reminder</h5>
              <ul className="events-reminder-list mb-0">
                <li>Participate in SK programs and activities.</li>
                <li>Some events may require registration.</li>
                <li>Arrive on time.</li>
                <li>Follow SK and barangay guidelines.</li>
              </ul>
            </div>
            <div className="featured-side-col">
              <span className="featured-department-label">Department</span>
              <p className="featured-department-name">Office of the SK Chairman</p>
            </div>
          </div>
        </div>
      </section>

      {/* Search bar */}
      <section className="py-4 announcements-toolbar-section">
        <div className="container">
          <div className="announcements-toolbar">
            <div className="announcements-search-wrap">
              <svg className="announcements-search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="7" />
                <path d="M21 21l-4.35-4.35" strokeLinecap="round" />
              </svg>
              <input
                type="text"
                className="announcements-search-input"
                placeholder="Search events..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
        </div>
      </section>

      <section className="py-5">
        <div className="container container-events-wide">
          <h2 className="text-center section-title mb-5">Upcoming SK Activities</h2>

          <div className="events-content-wrapper">
            {loading || isFiltering ? (
              <div className="text-center py-5">
                <div className="spinner-border text-danger" role="status" />
              </div>
            ) : filteredEvents.length === 0 ? (
              hasNoEventsAtAll ? (
                <div className="empty-state-split">
                  <div className="empty-state-main empty-state-main-left">
                    <div className="stay-informed-badge-row">
                      <span className="stay-informed-icon-wrap">
                        <img src="/icons/public-notice.png" alt="Public Notice" className="stay-informed-icon" />
                      </span>
                      <span className="stay-informed-label">Public Notice</span>
                    </div>
                    <h3 className="stay-informed-title">Stay Informed</h3>
                    <p className="stay-informed-text">
                      There are no upcoming events at the moment. Please check back later for updates
                      from the department. New youth programs and community activities will appear here.
                    </p>
                  </div>
                  <div className="empty-state-side">
                    <span className="empty-state-dept-label">Department</span>
                    <p className="empty-state-dept-name">Office of the SK Chairman</p>
                    <div className="empty-state-contact-line">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="empty-state-contact-icon">
                        <path d="M21 10c0 6-9 12-9 12s-9-6-9-12a9 9 0 0118 0z" strokeLinecap="round" strokeLinejoin="round" />
                        <circle cx="12" cy="10" r="3" />
                      </svg>
                      <span>Barangay Hall, 2nd Floor, Mamatid</span>
                    </div>
                    <div className="empty-state-contact-line">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="empty-state-contact-icon">
                        <path d="M4 4h16v16H4V4z" strokeLinecap="round" strokeLinejoin="round" />
                        <path d="M4 6l8 7 8-7" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      <span>sk.mamatid@cabuyao.gov.ph</span>
                    </div>
                    <div className="empty-state-verified">Verified Official Content</div>
                  </div>
                </div>
              ) : (
                <div className="empty-state-split">
                  <div className="empty-state-main">
                    <div className="empty-state-icon-wrap">
                      <img src="/icons/no-match.png" alt="No match" className="empty-state-icon" />
                    </div>
                    <p className="empty-state-message">No events match your search.</p>
                  </div>
                  <div className="empty-state-side">
                    <span className="empty-state-dept-label">Department</span>
                    <p className="empty-state-dept-name">Office of the SK Chairman</p>
                    <div className="empty-state-contact-line">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="empty-state-contact-icon">
                        <path d="M21 10c0 6-9 12-9 12s-9-6-9-12a9 9 0 0118 0z" strokeLinecap="round" strokeLinejoin="round" />
                        <circle cx="12" cy="10" r="3" />
                      </svg>
                      <span>Barangay Hall, 2nd Floor, Mamatid</span>
                    </div>
                    <div className="empty-state-contact-line">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="empty-state-contact-icon">
                        <path d="M4 4h16v16H4V4z" strokeLinecap="round" strokeLinejoin="round" />
                        <path d="M4 6l8 7 8-7" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      <span>sk.mamatid@cabuyao.gov.ph</span>
                    </div>
                    <div className="empty-state-verified">Verified Official Content</div>
                  </div>
                </div>
              )
            ) : (
              <>
                <div className="event-landscape-list">
                  {paginatedEvents.map((ev, index) => (
                    <div
                      className="event-landscape-card event-card-fade-in"
                      key={ev.id}
                      style={{ animationDelay: `${index * 0.08}s` }}
                    >
                      <div className="event-landscape-image-wrap">
                        {ev.image_path ? (
                          <img
                            src={`${STORAGE_URL}${ev.image_path}`}
                            className="event-landscape-image"
                            alt={ev.title}
                          />
                        ) : (
                          <div className="event-landscape-image-fallback" />
                        )}
                      </div>
                      <div className="event-landscape-content">
                        <h5 className="event-card-title">
                          {ev.title}
                          {getEventStatus(ev) === "Ongoing" && (
                            <span className="event-status-badge event-status-ongoing">Ongoing</span>
                          )}
                        </h5>
                        <div className="event-card-meta">
                          <span className="event-card-meta-item">
                            <img src="/icons/event-calendar.png" alt="Date" />
                            {formatDateRange(ev.event_date, ev.end_date)}
                          </span>
                          {ev.event_time && (
                            <span className="event-card-meta-item">
                              <img src="/icons/event-clock.png" alt="Time" />
                              {formatTime(ev.event_time)}
                            </span>
                          )}
                          {ev.venue && (
                            <span className="event-card-meta-item">
                              <img src="/icons/event-location.png" alt="Venue" />
                              {ev.venue}
                            </span>
                          )}
                        </div>
                        {ev.description && (
                          <p className="event-card-desc">{ev.description}</p>
                        )}
                        <span
                          className="read-more-btn event-view-more-btn"
                          onClick={() => setSelected(ev)}
                        >
                          View More
                          <svg className="read-more-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <path d="M5 12h14M13 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Pagination controls */}
                <div className="announcements-pagination">
                  <button
                    type="button"
                    className="pagination-arrow-btn"
                    onClick={() => goToPage(currentPage - 1)}
                    disabled={currentPage === 1}
                    aria-label="Previous page"
                  >
                    &#8249;
                  </button>
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                    <button
                      key={page}
                      type="button"
                      className={`pagination-page-btn ${currentPage === page ? "pagination-page-active" : ""}`}
                      onClick={() => goToPage(page)}
                    >
                      {String(page).padStart(2, "0")}
                    </button>
                  ))}
                  <button
                    type="button"
                    className="pagination-arrow-btn"
                    onClick={() => goToPage(currentPage + 1)}
                    disabled={currentPage === totalPages}
                    aria-label="Next page"
                  >
                    &#8250;
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </section>

      {/* Event details modal */}
      {selected && (
        <div className="modal fade show announcement-modal-backdrop" style={{ display: "block" }} tabIndex="-1">
          <div className="modal-dialog modal-dialog-centered modal-lg">
            <div className="modal-content announcement-modal-content">
              <div className="announcement-modal-titlebar">
                <button
                  type="button"
                  className="announcement-modal-close"
                  onClick={() => setSelected(null)}
                  aria-label="Close"
                >
                  &times;
                </button>
              </div>
              <div className="modal-body announcement-modal-body">
                <h4 className="announcement-modal-title-new">
                  {selected.title}
                  {getEventStatus(selected) === "Ongoing" && (
                    <span className="event-status-badge event-status-ongoing">Ongoing</span>
                  )}
                </h4>
                <div className="announcement-modal-date event-modal-date-line">
                  {formatDateRange(selected.event_date, selected.end_date)}
                  {selected.event_time && ` • ${formatTime(selected.event_time)}`}
                  {selected.venue && ` • ${selected.venue}`}
                </div>
                {selected.image_path && (
                  <img
                    src={`${STORAGE_URL}${selected.image_path}`}
                    alt={selected.title}
                    className="event-modal-image"
                  />
                )}
                <p className="announcement-modal-text mb-0" style={{ whiteSpace: "pre-wrap" }}>
                  {selected.description}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
      {selected && <div className="modal-backdrop fade show" onClick={() => setSelected(null)}></div>}

      <Footer />
    </>
  );
};

export default Events;