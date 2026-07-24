import React, { useEffect, useState } from "react";
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

      {/* Live application status */}
      <section className="py-5">
        <div className="container">
          <h2 className="section-title">Application Status</h2>
          {loading ? (
            <div className="py-3"><div className="spinner-border text-danger" role="status" /></div>
          ) : config ? (
            <div className="status-box">
              <h4>
                {config.is_active
                  ? <span className="text-success">Application is Open</span>
                  : <span className="text-danger">Application is Closed</span>}
              </h4>
              <p className="mt-3 mb-1"><strong>School Year:</strong> {config.school_year}</p>
              <p className="mb-1"><strong>Opening Date:</strong> {formatDate(config.open_date)}</p>
              <p className="mb-3"><strong>Closing Date:</strong> {formatDate(config.close_date)}</p>
              <p className="mb-3">
                <strong>Available Slots:</strong>{" "}
                {config.is_unlimited
                  ? "Unlimited"
                  : `${config.slot_limit - config.slots_filled} of ${config.slot_limit}`}
              </p>
              {config.is_active && (
                <a href="/register" className="btn btn-custom">Apply Now</a>
              )}
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
          <div className="row g-4 justify-content-center">
            <div className="col-md-4">
              <div className="card card-custom p-4">
                <h4>Residency Document</h4>
                <ul className="mt-3 mb-0">
                  <li>Voter's Certificate or Voter's ID</li>
                </ul>
              </div>
            </div>
            <div className="col-md-4">
              <div className="card card-custom p-4">
                <h4>School Documents</h4>
                <ul className="mt-3 mb-0">
                  <li>Certificate of Enrollment / Registration Form</li>
                  <li>Valid School ID</li>
                </ul>
              </div>
            </div>
            <div className="col-md-4">
              <div className="card card-custom p-4">
                <h4>Reminder</h4>
                <p className="mt-3 mb-0">Documents must be clear and match application details.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="py-5">
        <div className="container">
          <h2 className="section-title">Application Process</h2>
          <div className="info-box">
            <ol className="mb-0">
              <li>Create an account</li>
              <li>Log in to the system</li>
              <li>Fill out application form</li>
              <li>Upload required documents</li>
              <li>Submit application</li>
              <li>Wait for verification</li>
            </ol>
          </div>
        </div>
      </section>

      <section className="py-5">
        <div className="container">
          <h2 className="section-title">Important Reminders</h2>
          <div className="info-box">
            <ul className="mb-0">
              <li>Ensure documents are clear and readable.</li>
              <li>Incomplete applications may be rejected.</li>
              <li>Check your account regularly for updates.</li>
              <li>False information leads to disqualification.</li>
              <li>Follow official schedule announcements.</li>
            </ul>
          </div>
        </div>
      </section>

      <Footer />
    </>
  );
};

export default Requirements;