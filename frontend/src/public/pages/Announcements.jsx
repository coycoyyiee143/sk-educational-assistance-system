import React, { useEffect, useState } from "react";
import "bootstrap/dist/css/bootstrap.min.css";
import "bootstrap/dist/js/bootstrap.bundle.min.js";
import api from "../../services/api";
import Footer from "../../components/Footer";

const CATEGORY_FILTERS = ["All", "Reminder", "SK Activity", "Educational Assistance", "Schedule Update"];
const PAGE_SIZE = 6;

const Announcements = () => {
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeFilter, setActiveFilter] = useState("All");
  const [currentPage, setCurrentPage] = useState(1);
  const [isFiltering, setIsFiltering] = useState(false);

  useEffect(() => {
    api.get("/announcements")
      .then((res) => setAnnouncements(res.data))
      .catch(() => { })
      .finally(() => setLoading(false));
  }, []);

  const formatDate = (date) =>
    date
      ? new Date(date).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
      : "";

  const filteredAnnouncements = announcements.filter((a) => {
    const matchesFilter = activeFilter === "All" || a.category === activeFilter;
    const matchesSearch =
      searchTerm.trim() === "" ||
      a.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      a.content?.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const totalPages = Math.max(1, Math.ceil(filteredAnnouncements.length / PAGE_SIZE));
  const paginatedAnnouncements = filteredAnnouncements.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  );

  useEffect(() => {
    setIsFiltering(true);
    setCurrentPage(1);
    const timer = setTimeout(() => setIsFiltering(false), 400);
    return () => clearTimeout(timer);
  }, [activeFilter, searchTerm]);

  const goToPage = (page) => {
    if (page < 1 || page > totalPages) return;
    setIsFiltering(true);
    setCurrentPage(page);
    setTimeout(() => setIsFiltering(false), 350);
  };

  const hasNoAnnouncementsAtAll = announcements.length === 0;

  return (
    <>
      <nav className="navbar navbar-expand-lg sticky-top navbar-custom">
        <div className="container">
          <a className="navbar-brand navbar-brand-custom" href="/">
            <img src="/logo.png" alt="SK Logo" />
            <div className="brand-text">
              <h5>SK Barangay Mamatid</h5>
              <span>Educational Assistance System</span>
            </div>
          </a>
          <button className="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#mainNavbar">
            <span className="navbar-toggler-icon"></span>
          </button>
          <div className="collapse navbar-collapse justify-content-end" id="mainNavbar">
            <ul className="navbar-nav">
              <li className="nav-item"><a className="nav-link" href="/">Home</a></li>
              <li className="nav-item"><a className="nav-link" href="/requirements">Requirements</a></li>
              <li className="nav-item"><a className="nav-link active" href="/announcements">Announcements</a></li>
              <li className="nav-item"><a className="nav-link" href="/events">Events</a></li>
              <li className="nav-item"><a className="nav-link" href="/login">Login</a></li>
              <li className="nav-item"><a className="nav-link" href="/register">Register</a></li>
            </ul>
          </div>
        </div>
      </nav>
      <section className="hero text-center text-white py-5"
        style={{ background: "linear-gradient(rgba(183,28,28,0.85), rgba(211,47,47,0.85))" }}>
        <div className="container">
          <h1>Announcements</h1>
          <p>Stay updated with the latest announcements and important updates regarding the SK Educational Assistance Program.</p>
        </div>
      </section>

      <section className="py-4">
        <div className="container">
          <div className="featured-announcement-card featured-split-layout">
            <div className="featured-main-col">
              <div className="featured-badge-row">
                <span className="featured-badge">Featured</span>
                <span className="featured-badge-divider"></span>
                <span className="featured-bulletin-label">Official Bulletin</span>
              </div>
              <h5 className="featured-title">Stay in the Loop</h5>
              <p className="featured-text">
                Visit this page regularly to stay updated on application status, schedule changes, and
                requirement updates. Use the search bar or category tabs below to quickly find what you need.
              </p>
              <div className="featured-category-legend">
                <span className="legend-item">
                  <span className="legend-dot legend-dot-reminder"></span>
                  <span className="legend-text">
                    <strong>Reminder</strong>
                    <small>Important notices</small>
                  </span>
                </span>
                <span className="legend-item">
                  <span className="legend-dot legend-dot-sk-activity"></span>
                  <span className="legend-text">
                    <strong>SK Activity</strong>
                    <small>Events &amp; programs</small>
                  </span>
                </span>
                <span className="legend-item">
                  <span className="legend-dot legend-dot-educational-assistance"></span>
                  <span className="legend-text">
                    <strong>Educational Assistance</strong>
                    <small>Program updates</small>
                  </span>
                </span>
                <span className="legend-item">
                  <span className="legend-dot legend-dot-schedule-update"></span>
                  <span className="legend-text">
                    <strong>Schedule Update</strong>
                    <small>Date &amp; deadline changes</small>
                  </span>
                </span>
              </div>
            </div>
            <div className="featured-side-col featured-stats-col">
              <span className="featured-department-label">Category Overview</span>
              <div className="featured-stats-list">
                {CATEGORY_FILTERS.filter((cat) => cat !== "All").map((cat) => {
                  const count = announcements.filter((a) => a.category === cat).length;
                  const slug = cat.toLowerCase().replace(/\s+/g, '-');
                  return (
                    <div key={cat} className="featured-stat-item">
                      <span className={`legend-dot legend-dot-${slug}`}></span>
                      <span className="featured-stat-label">{cat}</span>
                      <span className="featured-stat-count">{count}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </section>

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
                placeholder="Search announcements..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="announcements-filter-tabs">
              {CATEGORY_FILTERS.map((filter) => (
                <button
                  key={filter}
                  type="button"
                  className={`filter-tab-btn ${activeFilter === filter ? "filter-tab-active" : ""}`}
                  onClick={() => setActiveFilter(filter)}
                >
                  {filter}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="py-5">
        <div className="container">
          <h2 className="section-title text-center">Latest Updates</h2>
          <div className="announcements-content-wrapper">
          {loading || isFiltering ? (
            <div className="text-center py-5 loading-fade-in">
              <div className="spinner-border text-danger" role="status" />
            </div>
          ) : filteredAnnouncements.length === 0 ? (
            hasNoAnnouncementsAtAll ? (
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
                    There are no announcements at the moment. Please check back later for updates
                    from the department. Important community alerts and executive orders will
                    appear here.
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
                  <p className="empty-state-message">No announcements match your search.</p>
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
              <div className="row g-4">
                {paginatedAnnouncements.map((a, index) => (
                  <div className="col-md-4" key={`${currentPage}-${a.id}`}>
                    <div
                      className="card card-custom announcement-hover-card p-4 h-100 announcement-card-fade-in"
                      style={{ animationDelay: `${index * 0.08}s` }}
                    >
                      {a.category && (
                        <span className={`badge category-badge category-${a.category.toLowerCase().replace(/\s+/g, '-')}`} style={{ width: "fit-content" }}>{a.category}</span>
                      )}
                      <h5 className="announcement-title">{a.title}</h5>
                      <div className="announcement-date">
                        Published {formatDate(a.published_at)}
                      </div>
                      <p className="announcement-preview">
                        {a.content && a.content.length > 150
                          ? a.content.slice(0, 150).trim() + "..."
                          : a.content}
                      </p>
                      {a.content && a.content.length > 150 && (
                        <span
                          className="read-more-btn"
                          onClick={() => setSelected(a)}
                        > 
                            Read More 
                           <svg className="read-more-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <path d="M5 12h14M13 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>

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
                {selected.category && (
                  <span
                    className={`badge category-badge category-${selected.category.toLowerCase().replace(/\s+/g, '-')}`}
                    style={{ width: "fit-content" }}
                  >
                    {selected.category}
                  </span>
                )}
                <h4 className="announcement-modal-title-new">{selected.title}</h4>
                <div className="announcement-modal-date">
                  Published {formatDate(selected.published_at)}
                </div>
                <p className="announcement-modal-text mb-0" style={{ whiteSpace: "pre-wrap" }}>{selected.content}</p>
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
export default Announcements;