import React, { useEffect, useState } from "react";
import "bootstrap/dist/css/bootstrap.min.css";
import "bootstrap/dist/js/bootstrap.bundle.min.js";
import api from "../../services/api";
import Footer from "../../components/Footer";


const Requirements = () => {
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get("/application-config/active")
      .then((res) => setConfig(res.data))
      .catch(() => { })
      .finally(() => setLoading(false));
  }, []);

  function formatDate(dateStr) {
    if (!dateStr) return "—";
    return new Date(dateStr).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  }

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
              <li className="nav-item"><a className="nav-link active" href="/requirements">Requirements</a></li>
              <li className="nav-item"><a className="nav-link" href="/announcements">Announcements</a></li>
              <li className="nav-item"><a className="nav-link" href="/events">Events</a></li>
              <li className="nav-item"><a className="nav-link" href="/login">Login</a></li>
              <li className="nav-item"><a className="nav-link" href="/register">Register</a></li>
            </ul>
          </div>
        </div>
      </nav>

      <section className="hero text-white text-center py-5"
        style={{ background: "linear-gradient(rgba(183,28,28,0.85), rgba(211,47,47,0.85))" }}>
        <div className="container">
          <h1>Application Requirements</h1>
          <p>Applicants must prepare the required documents before submitting their Educational Assistance application. Ensure all documents are clear and complete.</p>
        </div>
      </section>

      <section className="py-4">
        <div className="container">
          <div className="featured-announcement-card featured-split-layout">
            <div className="featured-main-col">
              <div className="featured-badge-row">
                <span className="featured-badge">Notice</span>
                <span className="featured-badge-divider"></span>
                <span className="featured-bulletin-label">Application Guidelines</span>
              </div>
              <h5 className="featured-title">Important Reminders</h5>
              <ul className="events-reminder-list mb-0">
                <li>Ensure documents are clear and readable.</li>
                <li>Incomplete applications may be rejected.</li>
                <li>Check your account regularly for updates.</li>
                <li>False information leads to disqualification.</li>
                <li>Follow official schedule announcements.</li>
              </ul>
            </div>
            <div className="featured-side-col">
              <span className="featured-department-label">Department</span>
              <p className="featured-department-name">Office of the SK Chairman</p>
            </div>
          </div>
        </div>
      </section>

      {/* Live application status */}
      <section className="py-5">
        <div className="container">
          {loading ? (
            <div className="py-3"><div className="spinner-border text-danger" role="status" /></div>
          ) : config ? (
            <div className="status-window-card">
              <div className="status-window-left">
                <span className="status-window-label">Application Status</span>
                <h4 className="status-window-title">
                  Application is{" "}
                  {config.is_active
                    ? <span className="status-window-open">Open</span>
                    : <span className="status-window-closed">Closed</span>}
                </h4>
                <div className="status-window-meta-row">
                  <span className={`status-window-pill ${config.is_active ? "status-window-pill-open" : "status-window-pill-closed"}`}>
                    {config.is_active ? "Accepting Submissions" : "Not Accepting Submissions"}
                  </span>
                  <span className="status-window-schoolyear">School Year {config.school_year}</span>
                </div>
              </div>
              <div className="status-window-right">
                <div className="status-window-dates-box">
                  <div className="status-window-date-item">
                    <span className="status-window-date-icon">
                      <img src="/icons/req-calendar.png" alt="Start Date" />
                    </span>
                    <div>
                      <span className="status-window-date-label">Start Date</span>
                      <p className="status-window-date-value">{formatDate(config.open_date)}</p>
                    </div>
                  </div>
                  <div className="status-window-date-divider"></div>
                  <div className="status-window-date-item">
                    <span className="status-window-date-icon">
                      <img src="/icons/req-clock.png" alt="Deadline" />
                    </span>
                    <div>
                      <span className="status-window-date-label">Deadline</span>
                      <p className="status-window-date-value">{formatDate(config.close_date)}</p>
                    </div>
                  </div>
                </div>
                <div className="status-window-slots-row">
                  <div className="status-window-slots-info">
                    <span className="status-window-slots-label">Available Slots</span>
                    <p className="status-window-slots-value">
                      {config.is_unlimited
                        ? "Unlimited"
                        : <>{config.slot_limit - config.slots_filled} <span className="status-window-slots-total">/ {config.slot_limit}</span></>}
                    </p>
                  </div>
                  {config.is_active && (
                    <a href="/register" className="status-window-apply-btn">Apply Now</a>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="status-box">
              <h4 className="text-muted">No Active Application Period</h4>
              <p className="mt-3 mb-0">There is no active application period at this time. Please check back later or follow our announcements for updates.</p>
            </div>
          )}
        </div>
      </section>

      <section className="py-5">
        <div className="container">
          <h2 className="section-title">Required Documents</h2>
          <div className="row g-4">
            <div className="col-md-4">
              <div className="req-doc-card">
                <div className="req-doc-icon-wrap">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 10c0 6-9 12-9 12s-9-6-9-12a9 9 0 0118 0z" strokeLinecap="round" strokeLinejoin="round" />
                    <circle cx="12" cy="10" r="3" />
                  </svg>
                </div>
                <h5 className="req-doc-card-title">Residency</h5>
                <ul className="req-doc-list">
                  <li>
                    <span className="req-doc-check">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                        <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </span>
                    Voter's Certificate or Voter's ID
                  </li>
                </ul>
              </div>
            </div>
            <div className="col-md-4">
              <div className="req-doc-card">
                <div className="req-doc-icon-wrap">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M22 10L12 5 2 10l10 5 10-5z" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M6 12v5c0 1.5 3 3 6 3s6-1.5 6-3v-5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                <h5 className="req-doc-card-title">Academic</h5>
                <ul className="req-doc-list">
                  <li>
                    <span className="req-doc-check">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                        <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </span>
                    Certificate of Enrollment / Registration Form
                  </li>
                  <li>
                    <span className="req-doc-check">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                        <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </span>
                    Valid School ID
                  </li>
                </ul>
              </div>
            </div>
            <div className="col-md-4">
              <div className="req-doc-reminder-card">
                <div className="req-doc-reminder-icon-wrap">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="9" />
                    <path d="M12 8v5M12 16h.01" strokeLinecap="round" />
                  </svg>
                </div>
                <h5 className="req-doc-reminder-title">Reminder</h5>
                <p className="req-doc-reminder-text">
                  Documents must be clear and match application details.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="py-5">
        <div className="container">
          <h2 className="section-title">Application Process</h2>
          <div className="process-steps-card">
            <div className="process-steps-row">
              <div className="process-step process-step-active">
                <div className="process-step-circle">1</div>
                <p className="process-step-text">Create an account and log in</p>
              </div>
              <div className="process-step">
                <div className="process-step-circle">2</div>
                <p className="process-step-text">Complete the application form</p>
              </div>
              <div className="process-step">
                <div className="process-step-circle">3</div>
                <p className="process-step-text">Upload the required documents and submit the application</p>
              </div>
              <div className="process-step">
                <div className="process-step-circle">4</div>
                <p className="process-step-text">Wait for verification</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </>
  );
};

export default Requirements;