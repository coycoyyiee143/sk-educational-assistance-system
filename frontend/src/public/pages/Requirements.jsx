import React, { useEffect, useState } from "react";
import "bootstrap/dist/js/bootstrap.bundle.min.js";
import api from "../../services/api";
import Footer from "../../components/Footer";

const Requirements = () => {
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get("/application-config/active")
      .then((res) => {
        setConfig(res.data);
      })
      .catch(() => {
        setConfig(null);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  const formatDate = (dateStr) => {
    if (!dateStr) return "—";

    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  };

  const availableSlots =
    config && !config.is_unlimited
      ? Math.max(
          0,
          Number(config.slot_limit || 0) -
            Number(config.slots_filled || 0)
        )
      : null;

  return (
    <div className="requirements-page">
      {/* ========================================
          NAVBAR
      ======================================== */}

      <nav className="navbar navbar-expand-lg sticky-top navbar-custom">
        <div className="container">
          <a
            className="navbar-brand navbar-brand-custom"
            href="/"
          >
            <img
              src="/icons/sk-logo.jpg"
              alt="SK Logo"
            />

            <div className="brand-text">
              <h5>SK Barangay Mamatid</h5>

              <span>
                Educational Assistance System
              </span>
            </div>
          </a>

          <button
            className="navbar-toggler"
            type="button"
            data-bs-toggle="collapse"
            data-bs-target="#mainNavbar"
            aria-controls="mainNavbar"
            aria-expanded="false"
            aria-label="Toggle navigation"
          >
            <span className="navbar-toggler-icon" />
          </button>

          <div
            className="collapse navbar-collapse justify-content-end"
            id="mainNavbar"
          >
            <ul className="navbar-nav">
              <li className="nav-item">
                <a
                  className="nav-link"
                  href="/"
                >
                  Home
                </a>
              </li>

              <li className="nav-item">
                <a
                  className="nav-link active"
                  href="/requirements"
                >
                  Requirements
                </a>
              </li>

              <li className="nav-item">
                <a
                  className="nav-link"
                  href="/announcements"
                >
                  Announcements
                </a>
              </li>

              <li className="nav-item">
                <a
                  className="nav-link"
                  href="/events"
                >
                  Events
                </a>
              </li>

              <li className="nav-item">
                <a
                  className="nav-link"
                  href="/login"
                >
                  Login
                </a>
              </li>

              <li className="nav-item">
                <a
                  className="nav-link"
                  href="/register"
                >
                  Register
                </a>
              </li>
            </ul>
          </div>
        </div>
      </nav>

      {/* ========================================
          HERO
      ======================================== */}

      <section
        className="hero text-white text-center py-5"
        style={{
          background:
            "linear-gradient(rgba(183,28,28,0.85), rgba(211,47,47,0.85))",
        }}
      >
        <div className="container">
          <h1>Educational Assistance Requirements</h1>

          <p>
            Review the eligibility requirements,
            required documents, and application
            process before submitting your
            application.
          </p>
        </div>
      </section>

      {/* ========================================
          IMPORTANT REMINDERS
      ======================================== */}

      <section className="py-4">
        <div className="container">
          <div className="featured-announcement-card featured-split-layout">
            <div className="featured-main-col">
              <div className="featured-badge-row">
                <span className="featured-badge">
                  Important
                </span>

                <span className="featured-badge-divider" />

                <span className="featured-bulletin-label">
                  Application Reminder
                </span>
              </div>

              <h5 className="featured-title">
                Important Reminders
              </h5>

              <ul className="requirements-reminder-list mb-0">
                <li>
                  Ensure that all application
                  information is complete and
                  accurate.
                </li>

                <li>
                  Upload clear and readable copies
                  of the required documents.
                </li>

                <li>
                  Documents must match the
                  information entered in your
                  application.
                </li>

                <li>
                  Submit your application before
                  the announced deadline.
                </li>
              </ul>
            </div>

            <div className="featured-side-col">
              <span className="featured-department-label">
                Department
              </span>

              <p className="featured-department-name">
                Office of the SK Chairman
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ========================================
          APPLICATION STATUS
      ======================================== */}

      <section className="requirements-status-section">
        <div className="container">
          {loading ? (
            <div className="text-center py-5">
              <div
                className="spinner-border text-danger"
                role="status"
              />
            </div>
          ) : config ? (
            <div className="status-window-card">
              {/* LEFT */}

              <div className="status-window-left">
                <span className="status-window-label">
                  APPLICATION STATUS
                </span>

                <h2 className="status-window-title">
                  Application is{" "}
                  <span
                    className={
                      config.is_active
                        ? "status-window-open"
                        : "status-window-closed"
                    }
                  >
                    {config.is_active
                      ? "Open"
                      : "Closed"}
                  </span>
                </h2>

                <div className="status-window-meta-row">
                  <span
                    className={`status-window-pill ${
                      config.is_active
                        ? "status-window-pill-open"
                        : "status-window-pill-closed"
                    }`}
                  >
                    {config.is_active
                      ? "Accepting Submissions"
                      : "Not Accepting Submissions"}
                  </span>

                  <span className="status-window-schoolyear">
                    School Year{" "}
                    {config.school_year || "—"}
                  </span>
                </div>
              </div>

              {/* RIGHT */}

              <div className="status-window-right">
                <div className="status-window-dates-box">
                  {/* START */}

                  <div className="status-window-date-item">
                    <div className="status-window-date-icon">
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <rect
                          x="3"
                          y="5"
                          width="18"
                          height="16"
                          rx="2"
                        />

                        <path d="M16 3v4M8 3v4M3 10h18" />
                      </svg>
                    </div>

                    <div className="status-window-date-content">
                      <span className="status-window-date-label">
                        START DATE
                      </span>

                      <strong className="status-window-date-value">
                        {formatDate(
                          config.open_date
                        )}
                      </strong>
                    </div>
                  </div>

                  {/* DEADLINE */}

                  <div className="status-window-date-item">
                    <div className="status-window-date-icon">
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <circle
                          cx="12"
                          cy="12"
                          r="9"
                        />

                        <path d="M12 7v5l3 2" />
                      </svg>
                    </div>

                    <div className="status-window-date-content">
                      <span className="status-window-date-label">
                        DEADLINE
                      </span>

                      <strong className="status-window-date-value">
                        {formatDate(
                          config.close_date
                        )}
                      </strong>
                    </div>
                  </div>
                </div>

                {/* SLOTS / APPLY */}

                <div className="status-window-slots-row">
                  <div className="status-window-slots">
                    <span className="status-window-slots-label">
                      AVAILABLE SLOTS
                    </span>

                    <div className="status-window-slots-value">
                      {config.is_unlimited ? (
                        <strong>Unlimited</strong>
                      ) : (
                        <>
                          <strong>
                            {availableSlots}
                          </strong>

                          <span>
                            /{" "}
                            {config.slot_limit ||
                              0}
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  {config.is_active && (
                    <a
                      href="/register"
                      className="status-window-apply-btn"
                    >
                      <span>Apply Now</span>

                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M5 12h14" />
                        <path d="M13 6l6 6-6 6" />
                      </svg>
                    </a>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="alert alert-light border">
              Application period information is
              currently unavailable.
            </div>
          )}
        </div>
      </section>

      {/* ========================================
          REQUIRED DOCUMENTS
      ======================================== */}

      <section className="requirements-documents-section">
        <div className="container">
          <h2 className="section-title requirements-section-title">
            Required Documents
          </h2>

          <div className="row g-4">
            {/* RESIDENCY */}

            <div className="col-lg-4 col-md-6">
              <div className="req-doc-card">
                <div className="req-doc-icon">
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M20 10c0 5-8 11-8 11s-8-6-8-11a8 8 0 1116 0z" />
                    <circle
                      cx="12"
                      cy="10"
                      r="2.5"
                    />
                  </svg>
                </div>

                <h3 className="req-doc-title">
                  Residency
                </h3>

                <div className="req-doc-item">
                  <span className="req-doc-check">
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M20 6L9 17l-5-5" />
                    </svg>
                  </span>

                  <span>
                    Voter&apos;s Certificate
                  </span>
                </div>
              </div>
            </div>

            {/* ACADEMIC */}

            <div className="col-lg-4 col-md-6">
              <div className="req-doc-card">
                <div className="req-doc-icon">
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M3 10l9-5 9 5-9 5-9-5z" />
                    <path d="M7 12v5c3 2 7 2 10 0v-5" />
                  </svg>
                </div>

                <h3 className="req-doc-title">
                  Academic
                </h3>

                <div className="req-doc-item">
                  <span className="req-doc-check">
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M20 6L9 17l-5-5" />
                    </svg>
                  </span>

                  <span>
                    Registration Form
                  </span>
                </div>

                <div className="req-doc-item">
                  <span className="req-doc-check">
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M20 6L9 17l-5-5" />
                    </svg>
                  </span>

                  <span>
                    Valid School ID
                  </span>
                </div>
              </div>
            </div>

            {/* REMINDER */}

            <div className="col-lg-4 col-md-12">
              <div className="req-doc-reminder-card">
                <div className="req-doc-reminder-icon">
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <circle
                      cx="12"
                      cy="12"
                      r="9"
                    />

                    <path d="M12 8v5" />
                    <path d="M12 17h.01" />
                  </svg>
                </div>

                <h3 className="req-doc-title">
                  Reminder
                </h3>

                <p className="req-doc-reminder-text">
                  Documents must be clear and match
                  application details.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ========================================
          APPLICATION PROCESS
      ======================================== */}

      <section className="requirements-process-section">
        <div className="container">
          <h2 className="section-title requirements-section-title">
            Application Process
          </h2>

          <div className="process-steps-card">
            <div className="process-steps-row">
              <div className="process-step process-step-active">
                <div className="process-step-circle">
                  1
                </div>

                <p className="process-step-text">
                  Create an account and log in
                </p>
              </div>

              <div className="process-step">
                <div className="process-step-circle">
                  2
                </div>

                <p className="process-step-text">
                  Complete the application form
                </p>
              </div>

              <div className="process-step">
                <div className="process-step-circle">
                  3
                </div>

                <p className="process-step-text">
                  Upload the required documents and
                  submit the application
                </p>
              </div>

              <div className="process-step">
                <div className="process-step-circle">
                  4
                </div>

                <p className="process-step-text">
                  Wait for verification
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default Requirements;