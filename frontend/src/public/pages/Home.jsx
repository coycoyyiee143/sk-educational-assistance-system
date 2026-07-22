import React, { useEffect, useState } from "react";
import "bootstrap/dist/css/bootstrap.min.css";
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
    ]).then(([configRes, announcementsRes]) => {
      setConfig(configRes.data);
      setAnnouncements((announcementsRes.data ?? []).slice(0, 3));
    }).finally(() => setLoading(false));
  }, []);

  const slotsRemaining = config && !config.is_unlimited
    ? config.slot_limit - config.slots_filled
    : null;

  return (
    <>
      <nav className="navbar navbar-expand-lg navbar-custom sticky-top">
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
              <li className="nav-item"><a className="nav-link active" href="/">Home</a></li>
              <li className="nav-item"><a className="nav-link" href="/requirements">Requirements</a></li>
              <li className="nav-item"><a className="nav-link" href="/announcements">Announcements</a></li>
              <li className="nav-item"><a className="nav-link" href="/events">Events</a></li>
              <li className="nav-item"><a className="nav-link" href="/login">Login</a></li>
              <li className="nav-item"><a className="nav-link" href="/register">Register</a></li>
            </ul>
          </div>
        </div>
      </nav>

      <section className="hero-section">
        <div className="container">
          <h1>SK Educational Assistance Application System</h1>
          <p>Apply online for the Educational Assistance Program of the Sangguniang Kabataan of Barangay Mamatid. View requirements, announcements, schedules, and important updates through this system.</p>
          <div className="mt-4">
            <a href="/register" className="btn btn-custom-light me-2 mb-2">Apply Now</a>
            <a href="/requirements" className="btn btn-custom-outline mb-2">View Requirements</a>
          </div>
        </div>
      </section>

      <section className="py-5">
        <div className="container">
          <h2 className="section-title text-center">About the Program</h2>
          <div className="about-box">
            <p className="mb-3">The Educational Assistance Program of the Sangguniang Kabataan of Barangay Mamatid aims to provide financial support to qualified youth residents who are currently studying.</p>
            <p className="mb-0">Through this initiative, the Sangguniang Kabataan promotes educational development and youth empowerment in the community.</p>
          </div>
        </div>
      </section>

      {/* Live slot counter */}
      <section className="py-5 highlight-section">
        <div className="container">
          <h2 className="section-title text-center">Available Slots</h2>
          <div className="slot-box">
            {loading ? (
              <div className="spinner-border text-danger" role="status" />
            ) : config ? (
              <>
                {config.is_unlimited ? (
                  <>
                    <h3>Unlimited Slots</h3>
                    <p>No slot cap for {config.school_year}</p>
                  </>
                ) : (
                  <>
                    <h3>{slotsRemaining} Slots Remaining</h3>
                    <p>Out of {config.slot_limit} total slots for {config.school_year}</p>
                  </>
                )}
                {config.is_active ? (
                  <span className="badge bg-success">Application Open</span>
                ) : (
                  <span className="badge bg-secondary">Application Closed</span>
                )}
              </>
            ) : (
              <>
                <h3>—</h3>
                <p>No active application period at this time.</p>
              </>
            )}
          </div>
        </div>
      </section>

      <section className="py-5 highlight-section">
        <div className="container">
          <h2 className="section-title text-center">Requirements Preview</h2>
          <div className="row g-4 align-items-stretch">
            <div className="col-md-4 d-flex">
              <div className="card card-custom req-card req-basic p-4">
                <h4>Basic Requirements</h4>
                <ul className="mt-3 mb-0">
                  <li>
                    <svg className="req-icon" viewBox="0 0 20 20" fill="currentColor">
                      <path d="M10 0 C10.5 6, 14 9.5, 20 10 C14 10.5, 10.5 14, 10 20 C9.5 14, 6 10.5, 0 10 C6 9.5, 9.5 6, 10 0 Z" />
                    </svg>
                    Voter's Certificate
                  </li>
                  <li>
                    <svg className="req-icon" viewBox="0 0 20 20" fill="currentColor">
                      <path d="M10 0 C10.5 6, 14 9.5, 20 10 C14 10.5, 10.5 14, 10 20 C9.5 14, 6 10.5, 0 10 C6 9.5, 9.5 6, 10 0 Z" />
                    </svg>
                    School ID
                  </li>
                  <li>
                    <svg className="req-icon" viewBox="0 0 20 20" fill="currentColor">
                      <path d="M10 0 C10.5 6, 14 9.5, 20 10 C14 10.5, 10.5 14, 10 20 C9.5 14, 6 10.5, 0 10 C6 9.5, 9.5 6, 10 0 Z" />
                    </svg>
                    Registration Form
                  </li>
                </ul>
              </div>
            </div>
            <div className="col-md-4 d-flex">
              <div className="card card-custom req-card req-reminder p-4">
                <h4>Applicant Reminder</h4>
                <p className="mt-3 mb-0">Applicants must ensure that all submitted documents are complete and readable.</p>
              </div>
            </div>
            <div className="col-md-4 d-flex">
              <div className="card card-custom req-card req-process p-4">
                <h4>Application Process</h4>
                <ol className="mt-3 mb-0">
                  <li>Create an account</li>
                  <li>Log in to the system</li>
                  <li>Fill out the form</li>
                  <li>Upload documents</li>
                  <li>Wait for updates</li>
                </ol>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Live announcements */}
      <section className="py-5">
  <div className="container">
    <h2 className="section-title text-center">Latest Announcements</h2>
    {loading ? (
      <div className="text-center py-4"><div className="spinner-border text-danger" role="status" /></div>
    ) : announcements.length === 0 ? (
      <div className="alert alert-info text-center">No announcements at this time.</div>
    ) : (
      <div className="row g-4">
        {announcements.map((a) => (
          <div className="col-md-4" key={a.id}>
            <div className="card card-custom p-4 h-100">
              {a.category && (
                <span
                  className="badge bg-danger mb-2"
                  style={{ width: "fit-content" }}
                >
                  {a.category}
                </span>
              )}

                    <small className="text-muted d-block mb-2">
                      {new Date(a.created_at).toLocaleDateString("en-US", {
                        month: "long",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </small>

                    <h5 className="announcement-title">
                      {a.title}
                    </h5>

                    <p className="announcement-preview mb-0">
                      {a.content && a.content.length > 90
                        ? a.content.slice(0,90).trim() + "... "
                        : a.content}
                      {a.content && a.content.length > 90 && (
                        <span
                          className="read-more-link"
                          onClick={() => setSelected(a)}
                        >
                          Read more
                        </span>
                      )}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
          <div className="text-center mt-4">
            <a href="/announcements" className="btn btn-success px-4 py-2">
              View All Announcements
            </a>
          </div>
        </div>
      </section>

      {/* Live schedule from config */}
      <section className="py-5 schedule-section">
        <div className="container">
          <h2 className="section-title text-center">Application Schedule</h2>
          {loading ? (
            <div className="text-center py-4"><div className="spinner-border text-danger" role="status" /></div>
          ) : config ? (
            <div className="row g-4 justify-content-center align-items-stretch">
              <div className="col-md-4 d-flex">
                <div className="card card-custom schedule-card schedule-center p-4">
                  <div className="d-flex justify-content-between align-items-start">
                    <h5>School Year</h5>
                  </div>
                  <div className="schedule-year-row">
                    <svg className="schedule-year-icon" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 3L1 9l11 6 9-4.91V17h2V9L12 3zm0 13.5L4.5 12.5V9.09L12 13l7.5-3.91v3.41L12 16.5z" />
                      <path d="M5 13.18v4.72L12 21l7-3.1v-4.72l-7 3.82-7-3.82z" />
                    </svg>
                    <span className="schedule-year">{config.school_year}</span>
                  </div>
                  <a href="/requirements" className="btn schedule-btn mt-auto">View Detailed Information</a>
                </div>
              </div>

              <div className="col-md-4 d-flex">
                <div className="card card-custom schedule-card p-4">
                  <div className="d-flex justify-content-between align-items-start">
                    <h5>Application Period</h5>
                  </div>
                  <p className="mb-2 schedule-line">
                    <svg className="schedule-icon" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M19 4h-1V2h-2v2H8V2H6v2H5c-1.11 0-1.99.9-1.99 2L3 20c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V9h14v11zM7 11h5v5H7z" />
                    </svg>
                    <strong>Opens:</strong> {new Date(config.open_date).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
                  </p>
                  <p className="mb-0 schedule-line">
                    <svg className="schedule-icon" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z" />
                      <path d="M12.5 7H11v6l5.25 3.15.75-1.23-4.5-2.67z" />
                    </svg>
                    <strong>Closes:</strong> {new Date(config.close_date).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
                  </p>
                  <a href="/requirements" className="btn schedule-btn mt-auto">View Detailed Information</a>
                </div>
              </div>

              <div className="col-md-4 d-flex">
                <div className="card card-custom schedule-card p-4">
                  <div className="d-flex justify-content-between align-items-start">
                    <h5>Slots</h5>
                    {config.is_active && <span className="live-badge">● LIVE</span>}
                  </div>
                  {config.is_unlimited ? (
                    <p className="mb-0 schedule-line">
                      <svg className="schedule-icon" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M18.6 6.62c-1.44 0-2.8.56-3.77 1.53L12 10.66 10.16 8.15C9.2 7.18 7.84 6.62 6.4 6.62 3.53 6.62 1.2 8.95 1.2 11.82s2.33 5.2 5.2 5.2c1.44 0 2.8-.56 3.77-1.53L12 13.98l1.83 2.51c.97.97 2.33 1.53 3.77 1.53 2.87 0 5.2-2.33 5.2-5.2s-2.33-5.2-5.2-5.2z" />
                      </svg>
                      Unlimited slots for this period.
                    </p>
                  ) : (
                    <>
                      <p className="mb-2 schedule-line">
                        <svg className="schedule-icon" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z" />
                        </svg>
                        <strong>Total:</strong> {config.slot_limit}
                      </p>
                      <p className="mb-2 schedule-line">
                        <svg className="schedule-icon" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M9 11.24V7.5C9 6.12 10.12 5 11.5 5S14 6.12 14 7.5v3.74c1.21-.81 2-2.18 2-3.74C16 5.01 13.99 3 11.5 3S7 5.01 7 7.5c0 1.56.79 2.93 2 3.74zm9.84 4.75l-4.55-2.28c-.42-.19-.88-.28-1.34-.28H12v-6c0-.83-.67-1.5-1.5-1.5S9 6.83 9 7.66v9.29l-3.02-.63a1.06 1.06 0 0 0-.98.3l-.7.7 4.4 4.4c.32.32.75.5 1.2.5h6.75c.71 0 1.31-.5 1.45-1.19l.96-4.79c.16-.86-.28-1.72-1.06-2.1z" />
                        </svg>
                        <strong>Remaining:</strong> <span className="remaining-count">{slotsRemaining}</span>
                      </p>
                      <div className="slot-progress-track">
                        <div
                          className="slot-progress-fill"
                          style={{
                            width: `${Math.max(0, Math.min(100, (slotsRemaining / config.slot_limit) * 100))}%`,
                            backgroundColor:
                              (slotsRemaining / config.slot_limit) > 0.5
                                ? "#2e7d32"
                                : (slotsRemaining / config.slot_limit) > 0.2
                                ? "#f9a825"
                                : "#b71c1c"
                          }}
                        />
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="alert alert-info text-center">No active application period at this time.</div>
          )}
        </div>
      </section>

      <section className="py-5">
        <div className="container text-center">
          <h2 className="section-title">Sangguniang Kabataan Officials</h2>
          <div className="mt-4">
            <img src="/officials.png" className="img-fluid officials-img" alt="SK Organizational Chart" />
          </div>
          <p className="text-muted mt-3 mb-0">Official organizational chart of the Sangguniang Kabataan of Barangay Mamatid.</p>
        </div>
      </section>

      

      {selected && (
        <>
        <div className="modal fade show announcement-modal-backdrop" style={{display:"block"}} tabIndex="-1">
          <div className="modal-dialog modal-dialog-centered modal-lg">
            <div className="modal-content announcement-modal-content">
              <div className="announcement-modal-titlebar">
                <h4 className="announcement-modal-title">{selected.title}</h4>
                <button className="announcement-modal-close" onClick={()=>setSelected(null)}>&times;</button>
              </div>
              <div className="modal-body announcement-modal-body">
                <p style={{whiteSpace:"pre-wrap"}}>{selected.content}</p>
              </div>
            </div>
          </div>
        </div>
        <div className="modal-backdrop fade show" onClick={()=>setSelected(null)}></div>
        </>
      )}

       <Footer />
    </>
  );
};

export default Home;