import React, { useEffect, useState } from "react";
import "bootstrap/dist/css/bootstrap.min.css";
import "bootstrap/dist/js/bootstrap.bundle.min.js";
import api from "../../services/api";

const Home = () => {
  const [config, setConfig] = useState(null);
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get("/application-config/active").catch(() => ({ data: null })),
      api.get("/announcements").catch(() => ({ data: [] })),
    ]).then(([configRes, announcementsRes]) => {
      setConfig(configRes.data);
      setAnnouncements((announcementsRes.data ?? []).slice(0, 3));
    }).finally(() => setLoading(false));
  }, []);

  const slotsRemaining = config ? config.total_slots - config.used_slots : null;

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
                <h3>{slotsRemaining} Slots Remaining</h3>
                <p>Out of {config.total_slots} total slots for {config.school_year} — {config.semester}</p>
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
          <div className="row g-4">
            <div className="col-md-4">
              <div className="card card-custom p-4">
                <h4>Basic Requirements</h4>
                <ul className="mt-3 mb-0">
                  <li>Voter's Certificate</li>
                  <li>School ID</li>
                  <li>Registration Form</li>
                </ul>
              </div>
            </div>
            <div className="col-md-4">
              <div className="card card-custom p-4">
                <h4>Applicant Reminder</h4>
                <p className="mt-3 mb-0">Applicants must ensure that all submitted documents are complete and readable.</p>
              </div>
            </div>
            <div className="col-md-4">
              <div className="card card-custom p-4">
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
                    {a.category && <span className="badge bg-danger mb-2" style={{ width: "fit-content" }}>{a.category}</span>}
                    <h5>{a.title}</h5>
                    <p className="mb-0">{a.content}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
          <div className="text-center mt-4">
            <a href="/announcements" className="btn btn-custom">View All Announcements</a>
          </div>
        </div>
      </section>

      {/* Live schedule from config */}
      <section className="py-5 highlight-section">
        <div className="container">
          <h2 className="section-title text-center">Application Schedule</h2>
          {loading ? (
            <div className="text-center py-4"><div className="spinner-border text-danger" role="status" /></div>
          ) : config ? (
            <div className="row g-4 justify-content-center">
              <div className="col-md-4">
                <div className="card card-custom p-4">
                  <h5>School Year</h5>
                  <p className="mb-0">{config.school_year} — {config.semester}</p>
                </div>
              </div>
              <div className="col-md-4">
                <div className="card card-custom p-4">
                  <h5>Application Period</h5>
                  <p className="mb-1"><strong>Opens:</strong> {new Date(config.open_date).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</p>
                  <p className="mb-0"><strong>Closes:</strong> {new Date(config.close_date).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</p>
                </div>
              </div>
              <div className="col-md-4">
                <div className="card card-custom p-4">
                  <h5>Slots</h5>
                  <p className="mb-1"><strong>Total:</strong> {config.total_slots}</p>
                  <p className="mb-0"><strong>Remaining:</strong> {slotsRemaining}</p>
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

      <footer>
        <div className="container text-center">
          <p className="mb-0">© 2026 Sangguniang Kabataan of Barangay Mamatid | Educational Assistance System</p>
        </div>
      </footer>
    </>
  );
};

export default Home;