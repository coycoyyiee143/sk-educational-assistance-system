import React, { useEffect, useState } from "react";
import "bootstrap/dist/js/bootstrap.bundle.min.js";
import api from "../../services/api";
import Footer from "../../components/Footer";

const Home = () => {
  const [config, setConfig] = useState(null);
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    Promise.all([
      api.get("/application-config/active").catch(() => ({ data: null })),
      api.get("/announcements").catch(() => ({ data: [] })),
    ])
      .then(([configRes, announcementsRes]) => {
        setConfig(configRes.data);
        setAnnouncements((announcementsRes.data ?? []).slice(0, 3));
      })
      .finally(() => setLoading(false));
  }, []);

  const slotsRemaining =
    config && !config.is_unlimited
      ? Math.max(0, config.slot_limit - config.slots_filled)
      : null;

  const slotsPercent =
    config && !config.is_unlimited && config.slot_limit > 0
      ? Math.round((slotsRemaining / config.slot_limit) * 100)
      : null;

  const formatDate = (date) =>
    new Date(date).toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    });

  const getSlotColor = () => {
    if (!config || config.is_unlimited) return "#2e8b47";

    const ratio = slotsRemaining / config.slot_limit;

    if (ratio > 0.5) return "#2e8b47";
    if (ratio > 0.2) return "#d69e00";

    return "#b71c1c";
  };

  return (
    <>
      {/* NAVBAR */}

      <nav className="navbar navbar-expand-lg navbar-custom sticky-top">
        <div className="container">
          <a className="navbar-brand navbar-brand-custom" href="/">
            <img src="/icons/sk-logo.jpg" alt="SK Logo" />

            <div className="brand-text">
              <h5>SK Barangay Mamatid</h5>
              <span>Educational Assistance System</span>
            </div>
          </a>

          <button
            className="navbar-toggler"
            type="button"
            data-bs-toggle="collapse"
            data-bs-target="#mainNavbar"
          >
            <span className="navbar-toggler-icon" />
          </button>

          <div
            className="collapse navbar-collapse justify-content-end"
            id="mainNavbar"
          >
            <ul className="navbar-nav">
              <li className="nav-item">
                <a className="nav-link active" href="/">
                  Home
                </a>
              </li>

              <li className="nav-item">
                <a className="nav-link" href="/requirements">
                  Requirements
                </a>
              </li>

              <li className="nav-item">
                <a className="nav-link" href="/announcements">
                  Announcements
                </a>
              </li>

              <li className="nav-item">
                <a className="nav-link" href="/events">
                  Events
                </a>
              </li>

              <li className="nav-item">
                <a className="nav-link" href="/login">
                  Login
                </a>
              </li>

              <li className="nav-item">
                <a className="nav-link" href="/register">
                  Register
                </a>
              </li>
            </ul>
          </div>
        </div>
      </nav>

      {/* HERO */}

      <section
        className="hero-section"
        style={{
          backgroundImage: "url(/icons/hero-bg.png)",
        }}
      >
        <div className="container">
          <h1>SK Educational Assistance Application System</h1>

          <p>
            Apply online for the Educational Assistance Program of the
            Sangguniang Kabataan of Barangay Mamatid. View requirements,
            announcements, schedules, and important updates through this
            system.
          </p>

          <div className="mt-4">
            <a
              href="/register"
              className="btn btn-custom-light me-2 mb-2"
            >
              Apply Now
            </a>

            <a
              href="/requirements"
              className="btn btn-custom-outline mb-2"
            >
              View Requirements
            </a>
          </div>
        </div>
      </section>

      {/* ABOUT + APPLICATION STATUS */}

      <section className="home-about-section">
        <div className="container">
          <div className="home-about-grid">
            <div className="home-about-content">
              <span className="home-eyebrow">The Program</span>

              <h2>Educational assistance for the youth of Barangay Mamatid.</h2>

              <p>
                The Educational Assistance Program of Sangguniang Kabataan of
                Barangay Mamatid provides financial support to qualified youth
                residents who are currently studying.
              </p>

              <p>
                Through this initiative, the Sangguniang Kabataan promotes
                educational development, accessibility, and youth empowerment
                within the community.
              </p>

              <a href="/requirements" className="home-about-link">
                View Program Requirements

                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.3"
                >
                  <path
                    d="M5 12h14M13 5l7 7-7 7"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </a>
            </div>

            <div className="home-status-card">
              {loading ? (
                <div className="home-status-loading">
                  <div
                    className="spinner-border text-danger"
                    role="status"
                  />
                </div>
              ) : config ? (
                <>
                  <div className="home-status-header">
                    <div>
                      <span className="home-status-eyebrow">
                        Application Status
                      </span>

                      <h3>
                        {config.is_active
                          ? "Applications are open"
                          : "Applications are closed"}
                      </h3>
                    </div>

                    <span
                      className={`home-status-badge ${
                        config.is_active
                          ? "home-status-badge-open"
                          : "home-status-badge-closed"
                      }`}
                    >
                      <span className="home-status-dot" />

                      {config.is_active ? "Open" : "Closed"}
                    </span>
                  </div>

                  <div className="home-status-divider" />

                  {config.is_unlimited ? (
                    <div className="home-slot-main">
                      <span className="home-slot-number">∞</span>
                      <span className="home-slot-label">
                        Unlimited applications
                      </span>
                    </div>
                  ) : (
                    <>
                      <div className="home-slot-main">
                        <span className="home-slot-number">
                          {slotsRemaining.toLocaleString()}
                        </span>

                        <span className="home-slot-label">
                          slots remaining
                        </span>
                      </div>

                      <div className="home-slot-progress">
                        <div
                          className="home-slot-progress-fill"
                          style={{
                            width: `${Math.max(
                              0,
                              Math.min(100, slotsPercent)
                            )}%`,
                            background: getSlotColor(),
                          }}
                        />
                      </div>

                      <div className="home-slot-meta">
                        <span>
                          {slotsPercent}% available
                        </span>

                        <span>
                          {config.slot_limit.toLocaleString()} total slots
                        </span>
                      </div>
                    </>
                  )}

                  <div className="home-status-info">
                    <div>
                      <span>School Year</span>
                      <strong>{config.school_year}</strong>
                    </div>

                    <div>
                      <span>Application Period</span>

                      <strong>
                        {formatDate(config.open_date)}
                        <br />
                        to {formatDate(config.close_date)}
                      </strong>
                    </div>
                  </div>

                  {config.is_active ? (
                    <a href="/register" className="home-status-btn">
                      Apply for Assistance

                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.3"
                      >
                        <path
                          d="M5 12h14M13 5l7 7-7 7"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </a>
                  ) : (
                    <span className="home-status-btn home-status-btn-disabled">
                      Application Period Closed
                    </span>
                  )}
                </>
              ) : (
                <div className="home-no-period">
                  <span className="home-status-eyebrow">
                    Application Status
                  </span>

                  <h3>No active application period</h3>

                  <p>
                    Please check the announcements page for upcoming
                    application schedules.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* APPLICATION SCHEDULE */}

      <section className="schedule-section">
        <div className="container">
          <div className="home-section-heading text-center">
            <span className="home-eyebrow">Application Timeline</span>

            <h2>Application Schedule</h2>

            <p>
              Review the active academic year, application dates, and
              available assistance slots.
            </p>
          </div>

          {loading ? (
            <div className="text-center py-4">
              <div
                className="spinner-border text-danger"
                role="status"
              />
            </div>
          ) : config ? (
            <div className="row g-4">
              {/* SCHOOL YEAR */}

              <div className="col-lg-4 col-md-6">
                <div className="schedule-card">
                  <div className="schedule-card-top">
                    <div className="schedule-icon-wrap">
                      <img
                        src="/icons/graduation-cap.png"
                        alt="School Year"
                      />
                    </div>

                    <span className="schedule-card-index">01</span>
                  </div>

                  <span className="schedule-card-label">
                    Academic Year
                  </span>

                  <h3 className="schedule-year-value">
                    {config.school_year}
                  </h3>

                  <p className="schedule-card-description">
                    Current school year covered by the active Educational
                    Assistance Program.
                  </p>
                </div>
              </div>

              {/* APPLICATION PERIOD */}

              <div className="col-lg-4 col-md-6">
                <div className="schedule-card">
                  <div className="schedule-card-top">
                    <div className="schedule-icon-wrap">
                      <img
                        src="/icons/calendar.png"
                        alt="Application Period"
                      />
                    </div>

                    <span className="schedule-card-index">02</span>
                  </div>

                  <span className="schedule-card-label">
                    Application Period
                  </span>

                  <div className="schedule-date-list">
                    <div className="schedule-date-row">
                      <span>Opens</span>
                      <strong>{formatDate(config.open_date)}</strong>
                    </div>

                    <div className="schedule-date-row">
                      <span>Closes</span>
                      <strong>{formatDate(config.close_date)}</strong>
                    </div>
                  </div>
                </div>
              </div>

              {/* AVAILABLE SLOTS */}

              <div className="col-lg-4 col-md-12">
                <div className="schedule-card schedule-slot-card">
                  <div className="schedule-card-top">
                    <div>
                      <span className="schedule-card-label">
                        Available Slots
                      </span>
                    </div>

                    <span
                      className={`schedule-status-badge ${
                        config.is_active
                          ? "schedule-status-open"
                          : "schedule-status-closed"
                      }`}
                    >
                      {config.is_active ? "Open" : "Closed"}
                    </span>
                  </div>

                  {config.is_unlimited ? (
                    <div className="schedule-slot-number">
                      Unlimited
                    </div>
                  ) : (
                    <>
                      <div className="schedule-slot-number">
                        {slotsRemaining.toLocaleString()}

                        <span>remaining</span>
                      </div>

                      <div className="schedule-progress">
                        <div
                          className="schedule-progress-fill"
                          style={{
                            width: `${Math.max(
                              0,
                              Math.min(100, slotsPercent)
                            )}%`,
                            backgroundColor: getSlotColor(),
                          }}
                        />
                      </div>

                      <div className="schedule-progress-meta">
                        <span>
                          {config.slot_limit.toLocaleString()} total
                        </span>

                        <span>{slotsPercent}% available</span>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="home-empty-card">
              No active application period at this time.
            </div>
          )}
        </div>
      </section>

      {/* REQUIREMENTS PREVIEW */}

      <section className="req-section">
        <div className="container">
          <div className="home-section-heading text-center">
            <span className="home-eyebrow">Before You Apply</span>

            <h2>Requirements Preview</h2>

            <p>
              Prepare the basic documents needed before starting your online
              application.
            </p>
          </div>

          <div className="row g-4 align-items-stretch">
            {/* LEFT */}

            <div className="col-lg-7">
              <div className="req-left-column">
                <div className="req-reminder">
                  <div className="req-reminder-icon">
                    !
                  </div>

                  <div>
                    <span className="req-reminder-label">
                      Important Reminder
                    </span>

                    <h3>Submit complete and authentic documents.</h3>

                    <p>
                      Applicants must ensure that all submitted documents are
                      complete, readable, and authentic. Falsification of
                      records may result in immediate disqualification from
                      the Educational Assistance Program.
                    </p>
                  </div>
                </div>

                <div className="req-documents-card">
                  <div className="req-card-header">
                    <div>
                      <span className="req-mini-label">
                        Document Checklist
                      </span>

                      <h3>Basic Requirements</h3>
                    </div>

                    <a href="/requirements" className="req-details-btn">
                      View Details

                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.3"
                      >
                        <path
                          d="M5 12h14M13 5l7 7-7 7"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </a>
                  </div>

                  <div className="req-document-list">
                    <div className="req-document-row">
                      <div className="req-document-name">
                        <span className="req-check-icon">
                          <svg
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="3"
                          >
                            <path
                              d="M5 12l4 4L19 6"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                        </span>

                        <span>Voter's Certificate</span>
                      </div>

                      <img
                        src="/icons/voters-cert.png"
                        alt="Voter's Certificate"
                      />
                    </div>

                    <div className="req-document-row">
                      <div className="req-document-name">
                        <span className="req-check-icon">
                          <svg
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="3"
                          >
                            <path
                              d="M5 12l4 4L19 6"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                        </span>

                        <span>School ID</span>
                      </div>

                      <img
                        src="/icons/school-id.png"
                        alt="School ID"
                      />
                    </div>

                    <div className="req-document-row">
                      <div className="req-document-name">
                        <span className="req-check-icon">
                          <svg
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="3"
                          >
                            <path
                              d="M5 12l4 4L19 6"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                        </span>

                        <span>Registration Form</span>
                      </div>

                      <img
                        src="/icons/registration-form.png"
                        alt="Registration Form"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* RIGHT */}

            <div className="col-lg-5">
              <div className="req-process-card">
                <span className="req-mini-label">
                  How It Works
                </span>

                <h3>Application Process</h3>

                <div className="req-process-list">
                  <div className="req-process-item">
                    <div className="req-process-marker">1</div>

                    <div>
                      <span className="req-process-step">
                        Step 01
                      </span>

                      <h4>Create your account</h4>

                      <p>
                        Register and complete the required identity
                        verification.
                      </p>
                    </div>
                  </div>

                  <div className="req-process-item">
                    <div className="req-process-marker">2</div>

                    <div>
                      <span className="req-process-step">
                        Step 02
                      </span>

                      <h4>Complete your application</h4>

                      <p>
                        Provide your personal, academic, and household
                        information accurately.
                      </p>
                    </div>
                  </div>

                  <div className="req-process-item">
                    <div className="req-process-marker">3</div>

                    <div>
                      <span className="req-process-step">
                        Step 03
                      </span>

                      <h4>Upload your documents</h4>

                      <p>
                        Attach clear and readable copies of all required
                        supporting documents.
                      </p>
                    </div>
                  </div>

                  <div className="req-process-item">
                    <div className="req-process-marker">4</div>

                    <div>
                      <span className="req-process-step">
                        Step 04
                      </span>

                      <h4>Wait for verification</h4>

                      <p>
                        Track your application status while the SK team
                        reviews your submission.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ANNOUNCEMENTS */}

      <section className="py-5">
        <div className="container">
          <div className="d-flex justify-content-between align-items-end mb-4 announcements-header">
            <div>
              <p className="announcements-label mb-1">
                Stay Updated
              </p>

              <h2 className="section-title announcements-title mb-0">
                Latest Announcements
              </h2>
            </div>

            <a href="/announcements" className="view-all-link">
              View All

              <svg
                className="view-all-icon"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
              >
                <path
                  d="M5 12h14M13 5l7 7-7 7"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </a>
          </div>

          {loading ? (
            <div className="text-center py-4">
              <div
                className="spinner-border text-danger"
                role="status"
              />
            </div>
          ) : announcements.length === 0 ? (
            <div className="empty-state-split">
              <div className="empty-state-main empty-state-main-left">
                <div className="stay-informed-badge-row">
                  <span className="stay-informed-icon-wrap">
                    <img
                      src="/icons/public-notice.png"
                      alt="Public Notice"
                      className="stay-informed-icon"
                    />
                  </span>

                  <span className="stay-informed-label">
                    Public Notice
                  </span>
                </div>

                <h3 className="stay-informed-title">
                  Stay Informed
                </h3>

                <p className="stay-informed-text">
                  There are no announcements at the moment. Please check
                  back later for updates from the department. Important
                  community alerts and executive orders will appear here.
                </p>
              </div>

              <div className="empty-state-side home-empty-state-side">
                <span className="empty-state-dept-label home-dept-label">
                  Department
                </span>

                <p className="empty-state-dept-name home-dept-name">
                  Office of the SK Chairman
                </p>
              </div>
            </div>
          ) : (
            <div className="row g-4">
              {announcements.map((a) => (
                <div className="col-md-4" key={a.id}>
                  <div className="card card-custom announcement-hover-card p-4 h-100">
                    {a.category && (
                      <span
                        className={`badge category-badge category-${a.category
                          .toLowerCase()
                          .replace(/\s+/g, "-")}`}
                        style={{
                          width: "fit-content",
                        }}
                      >
                        {a.category}
                      </span>
                    )}

                    <h5 className="announcement-title">
                      {a.title}
                    </h5>

                    <small className="announcement-date d-block">
                      Published{" "}
                      {new Date(a.created_at).toLocaleDateString(
                        "en-US",
                        {
                          month: "long",
                          day: "numeric",
                          year: "numeric",
                        }
                      )}
                    </small>

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

                        <svg
                          className="read-more-icon"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.5"
                        >
                          <path
                            d="M5 12h14M13 5l7 7-7 7"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* OFFICIALS */}

      <section className="py-5 officials-section">
        <div className="container text-center">
          <h2 className="section-title officials-title-red">
            Sangguniang Kabataan Officials
          </h2>

          <p className="text-muted mb-5">
            Official organizational chart of the Sangguniang Kabataan of
            Barangay Mamatid.
          </p>

          <div className="org-chart">
            <div className="org-row org-row-1">
              <div className="org-card">
                <img
                  src="/officials/chairman.jpg"
                  alt="SK Chairman"
                  className="org-photo"
                />

                <div className="org-info">
                  <p className="org-name">
                    Hon. Kent Zeus Himpisao
                  </p>

                  <p className="org-title">
                    SK Chairman
                  </p>
                </div>
              </div>
            </div>

            <div className="org-row org-row-4">
              <div className="org-card">
                <img
                  src="/officials/member1.jpg"
                  alt="SK Member"
                  className="org-photo"
                />

                <div className="org-info">
                  <p className="org-name">
                    Hon. Alexa Mae Cristobal
                  </p>

                  <p className="org-title">
                    SK Member
                  </p>
                </div>
              </div>

              <div className="org-card">
                <img
                  src="/officials/member2.jpg"
                  alt="SK Member"
                  className="org-photo"
                />

                <div className="org-info">
                  <p className="org-name">
                    Hon. Zyra Mae Tolentino
                  </p>

                  <p className="org-title">
                    SK Member
                  </p>
                </div>
              </div>

              <div className="org-card">
                <img
                  src="/officials/member3.jpg"
                  alt="SK Member"
                  className="org-photo"
                />

                <div className="org-info">
                  <p className="org-name">
                    Hon. Kristine Javier
                  </p>

                  <p className="org-title">
                    SK Member
                  </p>
                </div>
              </div>

              <div className="org-card">
                <img
                  src="/officials/member4.jpg"
                  alt="SK Member"
                  className="org-photo"
                />

                <div className="org-info">
                  <p className="org-name">
                    Hon. Camile Galupe
                  </p>

                  <p className="org-title">
                    SK Member
                  </p>
                </div>
              </div>
            </div>

            <div className="org-row org-row-3">
              <div className="org-card">
                <img
                  src="/officials/member5.jpg"
                  alt="SK Member"
                  className="org-photo"
                />

                <div className="org-info">
                  <p className="org-name">
                    Hon. Joshua Villa
                  </p>

                  <p className="org-title">
                    SK Member
                  </p>
                </div>
              </div>

              <div className="org-card">
                <img
                  src="/officials/member6.jpg"
                  alt="SK Member"
                  className="org-photo"
                />

                <div className="org-info">
                  <p className="org-name">
                    Hon. Kristine Claire Delos Santos
                  </p>

                  <p className="org-title">
                    SK Member
                  </p>
                </div>
              </div>

              <div className="org-card">
                <img
                  src="/officials/member7.jpg"
                  alt="SK Member"
                  className="org-photo"
                />

                <div className="org-info">
                  <p className="org-name">
                    Hon. John Robin Hinagpis
                  </p>

                  <p className="org-title">
                    SK Member
                  </p>
                </div>
              </div>
            </div>

            <div className="org-row org-row-2">
              <div className="org-card">
                <img
                  src="/officials/secretary.jpg"
                  alt="SK Secretary"
                  className="org-photo"
                />

                <div className="org-info">
                  <p className="org-name">
                    Angela Denice Geronimo
                  </p>

                  <p className="org-title">
                    SK Secretary
                  </p>
                </div>
              </div>

              <div className="org-card">
                <img
                  src="/officials/treasurer.jpg"
                  alt="SK Treasurer"
                  className="org-photo"
                />

                <div className="org-info">
                  <p className="org-name">
                    EdCarlo Indicio
                  </p>

                  <p className="org-title">
                    SK Treasurer
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ANNOUNCEMENT MODAL */}

      {selected && (
        <>
          <div
            className="modal fade show announcement-modal-backdrop"
            style={{
              display: "block",
            }}
            tabIndex="-1"
          >
            <div className="modal-dialog modal-dialog-centered modal-lg">
              <div className="modal-content announcement-modal-content">
                <div className="announcement-modal-titlebar">
                  <button
                    className="announcement-modal-close"
                    onClick={() => setSelected(null)}
                  >
                    &times;
                  </button>
                </div>

                <div className="modal-body announcement-modal-body">
                  {selected.category && (
                    <span
                      className={`badge category-badge category-${selected.category
                        .toLowerCase()
                        .replace(/\s+/g, "-")}`}
                      style={{
                        width: "fit-content",
                      }}
                    >
                      {selected.category}
                    </span>
                  )}

                  <h4 className="announcement-modal-title-new">
                    {selected.title}
                  </h4>

                  <div className="announcement-modal-date">
                    Published{" "}
                    {new Date(
                      selected.created_at
                    ).toLocaleDateString("en-US", {
                      month: "long",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </div>

                  <p
                    className="announcement-modal-text"
                    style={{
                      whiteSpace: "pre-wrap",
                    }}
                  >
                    {selected.content}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div
            className="modal-backdrop fade show"
            onClick={() => setSelected(null)}
          />
        </>
      )}

      <Footer />
    </>
  );
};

export default Home;