import React from "react";
import "bootstrap/dist/css/bootstrap.min.css";
import "bootstrap/dist/js/bootstrap.bundle.min.js";

const Requirements = () => {
  return (
    <>
      {/* NAVBAR */}
      <nav className="navbar navbar-expand-lg sticky-top navbar-custom">
        <div className="container">

          <a className="navbar-brand navbar-brand-custom" href="/">
            <img src="/logo.png" alt="SK Logo" />
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
            <span className="navbar-toggler-icon"></span>
          </button>

          <div className="collapse navbar-collapse justify-content-end" id="mainNavbar">
            <ul className="navbar-nav">
              <li className="nav-item"><a className="nav-link" href="/">Home</a></li>
              <li className="nav-item"><a className="nav-link active" href="/requirements">Application</a></li>
              <li className="nav-item"><a className="nav-link" href="/announcements">Announcements</a></li>
              <li className="nav-item"><a className="nav-link" href="/events">Events</a></li>
              <li className="nav-item"><a className="nav-link" href="/login">Login</a></li>
              <li className="nav-item"><a className="nav-link" href="/register">Register</a></li>
            </ul>
          </div>

        </div>
      </nav>

      {/* HERO */}
      <section className="hero text-white text-center py-5"
        style={{
          background: "linear-gradient(rgba(183,28,28,0.85), rgba(211,47,47,0.85))"
        }}
      >
        <div className="container">
          <h1>Application Requirements</h1>
          <p>
            Applicants must prepare the required documents before submitting their
            Educational Assistance application. Ensure all documents are clear and complete.
          </p>
        </div>
      </section>

      {/* STATUS */}
      <section className="py-5">
        <div className="container">
          <h2 className="section-title">Application Status</h2>

          <div className="status-box">
            <h4>Application is Open</h4>
            <p className="mt-3 mb-3">
              The application period is currently open.
            </p>

            <p><strong>Opening Date:</strong> April 1, 2026</p>
            <p><strong>Closing Date:</strong> April 15, 2026</p>

            <a href="/register" className="btn btn-custom">
              Apply Now
            </a>
          </div>
        </div>
      </section>

      {/* REQUIREMENTS */}
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
                <p className="mt-3 mb-0">
                  Documents must be clear and match application details.
                </p>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* PROCESS */}
      <section className="py-5">
        <div className="container">
          <h2 className="section-title">Application Process</h2>

          <div className="process-box">
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

      {/* REMINDERS */}
      <section className="py-5">
        <div className="container">
          <h2 className="section-title">Important Reminders</h2>

          <div className="reminder-box">
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

      {/* FOOTER */}
      <footer>
        <div className="container">
          <p className="mb-0">
            © 2026 Sangguniang Kabataan of Barangay Mamatid | Educational Assistance System
          </p>
        </div>
      </footer>
    </>
  );
};

export default Requirements;