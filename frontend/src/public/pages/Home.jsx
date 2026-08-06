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
  const slotsPercent = config && !config.is_unlimited
    ? Math.round((slotsRemaining / config.slot_limit) * 100)
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
      <section className="hero-section" style={{ backgroundImage: "url(/icons/hero-bg.png)" }}>
        <div className="container">
          <h1>SK Educational Assistance Application System</h1>
          <p>Apply online for the Educational Assistance Program of the Sangguniang Kabataan of Barangay Mamatid. View requirements, announcements, schedules, and important updates through this system.</p>
          <div className="mt-4">
            <a href="/register" className="btn btn-custom-light me-2 mb-2">Apply Now</a>
            <a href="/requirements" className="btn btn-custom-outline mb-2">View Requirements</a>
          </div>
        </div>
      </section>
      <section className="py-5 about-slots-section">
        <div className="container">
          <div className="about-slots-split">
            <div className="about-slots-left">
              <p className="about-label">The Vision</p>
              <h2 className="section-title about-title">About the Program</h2>
              <p className="mb-0 about-quote-left">
                "The Educational Assistance Program of Sangguniang Kabataan of Barangay Mamatid aims to provide financial support to qualified youth residents who are currently studying. Through this initiative, the Sangguniang Kabataan promotes educational development and youth empowerment in the community."
              </p>
            </div>
            <div className="about-slots-right">
              <div className="slot-box slot-box-split">
                {loading ? (
                  <div className="spinner-border text-danger" role="status" />
                ) : config ? (
                  <>
                    {config.is_unlimited ? (
                      <>
                        <div className="slot-ring-wrap animate-float">
                          <svg viewBox="0 0 160 160" className="slot-ring-svg">
                            <circle cx="80" cy="80" r="70" fill="none" stroke="#e5e5e5" strokeWidth="6" />
                            <circle
                              cx="80" cy="80" r="70" fill="none"
                              stroke={config.is_active ? "#2e8b47" : "#9e9e9e"}
                              strokeWidth="6" strokeLinecap="round"
                              strokeDasharray={2 * Math.PI * 70}
                              strokeDashoffset={0}
                              transform="rotate(-90 80 80)"
                              style={{ transition: "stroke 0.4s ease" }}
                            />
                          </svg>
                          <div className="slot-ring-center">
                            <span className="slot-ring-number" style={{ color: config.is_active ? "#1a1a1a" : "#777" }}>∞</span>
                            <span className="slot-ring-label">Unlimited</span>
                          </div>
                        </div>
                        <p className="slot-ring-subtext-title">
                          {config.is_active ? "No Slot Cap" : "Registration Window Closed"}
                        </p>
                        <p className="slot-ring-subtext">
                          Unlimited applications are {config.is_active ? "being accepted" : "not being accepted"} for
                          the <strong>{config.school_year}</strong> academic year.
                        </p>
                      </>
                    ) : (
                      <>
                        {(() => {
                          const ratio = slotsRemaining / config.slot_limit;
                          const radius = 70;
                          const circumference = 2 * Math.PI * radius;
                          const offset = circumference * (1 - Math.max(0, Math.min(1, ratio)));
                          const ringColor = ratio > 0.5 ? "#2e7d32" : ratio > 0.2 ? "#f9a825" : "#b71c1c";
                          const numberColor = ratio > 0.2 ? "#1a1a1a" : "#b71c1c";
                          return (
                            <div className="slot-ring-wrap animate-float">
                              <svg viewBox="0 0 160 160" className="slot-ring-svg">
                                <circle cx="80" cy="80" r={radius} fill="none" stroke="#e5e5e5" strokeWidth="6" />
                                <circle
                                  cx="80" cy="80" r={radius} fill="none"
                                  stroke={ringColor} strokeWidth="6" strokeLinecap="round"
                                  strokeDasharray={circumference}
                                  strokeDashoffset={offset}
                                  transform="rotate(-90 80 80)"
                                  style={{ transition: "stroke-dashoffset 0.6s ease, stroke 0.4s ease" }}
                                />
                              </svg>
                              <div className="slot-ring-center">
                                <span className="slot-ring-number" style={{ color: numberColor }}>
                                  {slotsRemaining}
                                </span>
                                <span className="slot-ring-label">Slots Remaining</span>
                              </div>
                            </div>
                          );
                        })()}
                        <p className="slot-ring-subtext-title">
                          {config.is_active ? "Registration Window Open" : "Registration Window Closed"}
                        </p>
                        <p className="slot-ring-subtext">
                          Applications for the <strong>{config.school_year} Academic Year</strong> are currently{" "}
                          {config.is_active ? "being accepted" : "not being accepted"}. Out of {config.slot_limit} total slots.
                        </p>
                      </>
                    )}
                    {config.is_active ? (
                      <a href="/login" className="slot-apply-btn">
                        Apply Now
                        <svg className="slot-apply-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <path d="M5 12h14M13 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </a>
                    ) : (
                      <span className="slot-status-pill slot-status-pill-closed">Application Closed</span>
                    )}
                  </>
                ) : (
                  <>
                    <div className="slot-ring-wrap animate-float">
                      <svg viewBox="0 0 160 160" className="slot-ring-svg">
                        <circle cx="80" cy="80" r="70" fill="none" stroke="#e5e5e5" strokeWidth="6" />
                      </svg>
                      <div className="slot-ring-center">
                        <span className="slot-ring-number" style={{ color: "#1a1a1a" }}>—</span>
                      </div>
                    </div>
                    <p className="slot-ring-subtext">No active application period at this time.</p>
                  </>
                )}
              </div>
            </div>
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
                <div className="card card-custom schedule-card schedule-card-centered p-4">
                  <img src="/icons/graduation-cap.png" alt="School Year" className="schedule-center-icon" />
                  <p className="schedule-label text-center">School Year</p>
                  <p className="schedule-big-value text-center">{config.school_year}</p>
                </div>
              </div>
              <div className="col-md-4 d-flex">
                <div className="card card-custom schedule-card schedule-card-centered p-4">
                  <img src="/icons/calendar.png" alt="Application Period" className="schedule-center-icon" />
                  <p className="schedule-label text-center">Application Period</p>
                  <div className="schedule-lines-group schedule-lines-centered">
                    <p className="mb-0 schedule-line-mini">
                      <strong>Opens:</strong> {new Date(config.open_date).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
                    </p>
                    <p className="mb-0 schedule-line-mini">
                      <strong>Closes:</strong> {new Date(config.close_date).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
                    </p>
                  </div>
                </div>
              </div>
              <div className="col-md-4 d-flex">
                <div className="card card-custom schedule-card p-4">
                  <div className="d-flex justify-content-between align-items-start">
                    <p className="schedule-label mb-0">Available Slots</p>
                    {config.is_active && <span className="slot-open-badge">OPEN</span>}
                  </div>
                  {config.is_unlimited ? (
                    <p className="schedule-slots-value">Unlimited</p>
                  ) : (
                    <>
                      <p className="schedule-slots-value">
                        {slotsRemaining.toLocaleString()} <br />
                        <span className="schedule-remaining-word">Remaining</span>
                      </p>
                      <div className="slot-progress-track">
                        <div
                          className="slot-progress-fill"
                          style={{
                            width: `${Math.max(0, Math.min(100, slotsPercent))}%`,
                            backgroundColor:
                              (slotsRemaining / config.slot_limit) > 0.5
                                ? "#2e7d32"
                                : (slotsRemaining / config.slot_limit) > 0.2
                                ? "#f9a825"
                                : "#b71c1c"
                          }}
                        />
                      </div>
                      <div className="slot-meta-row">
                        <span>Total: {config.slot_limit} Slots</span>
                        <span>{slotsPercent}% Available</span>
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
      <section className="py-5 highlight-section req-section">
        <div className="container">
          <h2 className="req-title text-center">Requirements Preview</h2>
          <div className="row g-4 align-items-stretch req-preview-row">
            <div className="col-md-7 req-preview-left">
              <div className="card card-custom req-reminder-v2 mb-4">
                <div className="req-reminder-v2-icon">
                  <img src="/icons/exclamation.png" alt="Reminder" />
                </div>
                <div className="req-reminder-v2-content">
                  <h4 className="req-reminder-v2-title">Applicant Reminder</h4>
                  <p className="req-reminder-v2-text">Applicants must ensure that all submitted documents are complete, readable, and authentic.
                     Falsification of civic records will results in immediate disqualification from the scholarship program and potential administrative sanctions</p>
                </div>
              </div>
              <div className="card card-custom req-basic-v2">
                <div className="req-basic-v2-header">
                  <h4 className="req-basic-v2-title mb-0">Basic Requirements</h4>
                  <a href="/requirements" className="req-basic-v2-btn">View Details</a>
                </div>
                <ul className="req-basic-v2-list">
                  <li className="req-basic-v2-item">
                    <span className="req-basic-v2-left">
                      <span className="req-basic-v2-icon">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                          <path d="M4 12l5 5L20 6" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </span>
                      <span>Voter's Certificate</span>
                    </span>
                    <img src="/icons/voters-cert.png" alt="Voter's Certificate" className="req-basic-v2-img" />
                  </li>
                  <li className="req-basic-v2-item">
                    <span className="req-basic-v2-left">
                      <span className="req-basic-v2-icon">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                          <path d="M4 12l5 5L20 6" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </span>
                      <span>School ID</span>
                    </span>
                    <img src="/icons/school-id.png" alt="School ID" className="req-basic-v2-img" />
                  </li>
                  <li className="req-basic-v2-item">
                    <span className="req-basic-v2-left">
                      <span className="req-basic-v2-icon">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                          <path d="M4 12l5 5L20 6" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </span>
                      <span>Registration Form</span>
                    </span>
                    <img src="/icons/registration-form.png" alt="Registration Form" className="req-basic-v2-img" />
                  </li>
                </ul>
              </div>
            </div>
            <div className="col-md-5 req-preview-right">
              <div className="card card-custom req-process-v2 h-100">
                <h4 className="req-process-v2-title">Application Process</h4>
                <ol className="req-process-v2-list">
                  <li className="req-process-v2-item">
                    <span className="req-process-v2-marker req-process-v2-marker-active">1</span>
                    <div className="req-process-v2-content">
                      <span className="req-process-v2-step">Step 01</span>
                      <p className="req-process-v2-step-title">Create an account and log in</p>
                      <p className="req-process-v2-step-desc">Sign up and access the portal.</p>
                    </div>
                  </li>
                  <li className="req-process-v2-item">
                    <span className="req-process-v2-marker">2</span>
                    <div className="req-process-v2-content">
                      <span className="req-process-v2-step">Step 02</span>
                      <p className="req-process-v2-step-title">Complete the application form</p>
                      <p className="req-process-v2-step-desc">Fill in your information accurately.</p>
                    </div>
                  </li>
                  <li className="req-process-v2-item">
                    <span className="req-process-v2-marker">3</span>
                    <div className="req-process-v2-content">
                      <span className="req-process-v2-step">Step 03</span>
                      <p className="req-process-v2-step-title">Upload the required documents and submit the application</p>
                      <p className="req-process-v2-step-desc">Attach clear copies before submitting.</p>
                    </div>
                  </li>
                  <li className="req-process-v2-item">
                    <span className="req-process-v2-marker">4</span>
                    <div className="req-process-v2-content">
                      <span className="req-process-v2-step">Step 04</span>
                      <p className="req-process-v2-step-title">Wait for verification</p>
                      <p className="req-process-v2-step-desc">The SK team will review and notify you.</p>
                    </div>
                  </li>
                </ol>
              </div>
            </div>
          </div>
        </div>
      </section>
      {/* Live announcements */}
      <section className="py-5">
        <div className="container">
          <div className="d-flex justify-content-between align-items-end mb-4 announcements-header">
            <div>
              <p className="announcements-label mb-1">Stay Updated</p>
              <h2 className="section-title announcements-title mb-0">Latest Announcements</h2>
            </div>
            <a href="/announcements" className="view-all-link">
              View All
              <svg className="view-all-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M5 12h14M13 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </a>
          </div>
          {loading ? (
            <div className="text-center py-4"><div className="spinner-border text-danger" role="status" /></div>
          ) : announcements.length === 0 ? (
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
              <div className="empty-state-side home-empty-state-side">
                <span className="empty-state-dept-label home-dept-label">Department</span>
                <p className="empty-state-dept-name home-dept-name">Office of the SK Chairman</p>
              </div>
            </div>
          ) : (
            <div className="row g-4">
              {announcements.map((a) => (
                <div className="col-md-4" key={a.id}>
                  <div className="card card-custom announcement-hover-card p-4 h-100">
                    {a.category && (
                      <span
                        className={`badge category-badge category-${a.category.toLowerCase().replace(/\s+/g, '-')}`}
                        style={{ width: "fit-content" }}
                      >
                        {a.category}
                      </span>
                    )}
                    <h5 className="announcement-title">
                      {a.title}
                    </h5>
                    <small className="announcement-date d-block">
                      Published {new Date(a.created_at).toLocaleDateString("en-US", {
                        month: "long",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </small>
                    <p className="announcement-preview">
                      {a.content && a.content.length > 150
                        ? a.content.slice(0,150).trim() + "..."
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
          )}
        </div>
      </section>
      <section className="py-5 officials-section">
        <div className="container text-center">
          <h2 className="section-title officials-title-red">Sangguniang Kabataan Officials</h2>
          <p className="text-muted mb-5">Official organizational chart of the Sangguniang Kabataan of Barangay Mamatid.</p>
          <div className="org-chart">
            {/* Row 1 - Chairman */}
            <div className="org-row org-row-1">
              <div className="org-card">
                <img src="/officials/chairman.jpg" alt="SK Chairman" className="org-photo" />
                <div className="org-info">
                  <p className="org-name">Hon. Kent Zeus Himpisao</p>
                  <p className="org-title">SK Chairman</p>
                </div>
              </div>
            </div>
            {/* Row 2 - 4 Members */}
            <div className="org-row org-row-4">
              <div className="org-card">
                <img src="/officials/member1.jpg" alt="SK Member" className="org-photo" />
                <div className="org-info">
                  <p className="org-name">Hon. Alexa Mae Cristobal</p>
                  <p className="org-title">SK Member</p>
                </div>
              </div>
              <div className="org-card">
                <img src="/officials/member2.jpg" alt="SK Member" className="org-photo" />
                <div className="org-info">
                  <p className="org-name">Hon. Zyra Mae Tolentino</p>
                  <p className="org-title">SK Member</p>
                </div>
              </div>
              <div className="org-card">
                <img src="/officials/member3.jpg" alt="SK Member" className="org-photo" />
                <div className="org-info">
                  <p className="org-name">Hon. Kristine Javier</p>
                  <p className="org-title">SK Member</p>
                </div>
              </div>
              <div className="org-card">
                <img src="/officials/member4.jpg" alt="SK Member" className="org-photo" />
                <div className="org-info">
                  <p className="org-name">Hon. Camile Galupe</p>
                  <p className="org-title">SK Member</p>
                </div>
              </div>
            </div>
            {/* Row 3 - 3 Members */}
            <div className="org-row org-row-3">
              <div className="org-card">
                <img src="/officials/member5.jpg" alt="SK Member" className="org-photo" />
                <div className="org-info">
                  <p className="org-name">Hon. Joshua Villa</p>
                  <p className="org-title">SK Member</p>
                </div>
              </div>
              <div className="org-card">
                <img src="/officials/member6.jpg" alt="SK Member" className="org-photo" />
                <div className="org-info">
                  <p className="org-name">Hon. Kristine Claire Delos Santos</p>
                  <p className="org-title">SK Member</p>
                </div>
              </div>
              <div className="org-card">
                <img src="/officials/member7.jpg" alt="SK Member" className="org-photo" />
                <div className="org-info">
                  <p className="org-name">Hon. John Robin Hinagpis</p>
                  <p className="org-title">SK Member</p>
                </div>
              </div>
            </div>
            {/* Row 4 - Secretary & Treasurer */}
            <div className="org-row org-row-2">
              <div className="org-card">
                <img src="/officials/secretary.jpg" alt="SK Secretary" className="org-photo" />
                <div className="org-info">
                  <p className="org-name">Angela Denice Geronimo</p>
                  <p className="org-title">SK Secretary</p>
                </div>
              </div>
              <div className="org-card">
                <img src="/officials/treasurer.jpg" alt="SK Treasurer" className="org-photo" />
                <div className="org-info">
                  <p className="org-name">EdCarlo Indicio</p>
                  <p className="org-title">SK Treasurer</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
      
      {selected && (
        <>
        <div className="modal fade show announcement-modal-backdrop" style={{display:"block"}} tabIndex="-1">
          <div className="modal-dialog modal-dialog-centered modal-lg">
            <div className="modal-content announcement-modal-content">
              <div className="announcement-modal-titlebar">
                <button className="announcement-modal-close" onClick={()=>setSelected(null)}>&times;</button>
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
                  Published {new Date(selected.created_at).toLocaleDateString("en-US", {
                    month: "long",
                    day: "numeric",
                    year: "numeric",
                  })}
                </div>
                <p className="announcement-modal-text" style={{whiteSpace:"pre-wrap"}}>{selected.content}</p>
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