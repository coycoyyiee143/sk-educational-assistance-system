import React from "react";
import "bootstrap/dist/css/bootstrap.min.css";
import "bootstrap/dist/js/bootstrap.bundle.min.js";

const Announcements = () => {
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
              <li className="nav-item"><a className="nav-link" href="/requirements">Application</a></li>
              <li className="nav-item"><a className="nav-link active" href="/announcements">Announcements</a></li>
              <li className="nav-item"><a className="nav-link" href="/events">Events</a></li>
              <li className="nav-item"><a className="nav-link" href="/login">Login</a></li>
              <li className="nav-item"><a className="nav-link" href="/register">Register</a></li>

            </ul>
          </div>

        </div>
      </nav>

      {/* HERO */}
      <section className="hero text-center text-white py-5"
        style={{
          background: "linear-gradient(rgba(183,28,28,0.85), rgba(211,47,47,0.85))"
        }}
      >
        <div className="container">
          <h1>Announcements</h1>
          <p>
            Stay updated with the latest announcements and important updates
            regarding the SK Educational Assistance Program.
          </p>
        </div>
      </section>

      {/* ANNOUNCEMENTS */}
      <section className="py-5">
        <div className="container">

          <h2 className="section-title text-center">Latest Updates</h2>

          <div className="row g-4">

            {/* ITEM 1 */}
            <div className="col-md-4">
              <div className="card card-custom p-4">
                <div className="text-muted small mb-2">April 1, 2026</div>
                <h5>Application Now Open</h5>
                <p className="mb-0">
                  The SK Educational Assistance Program is now open for applications.
                </p>
              </div>
            </div>

            {/* ITEM 2 */}
            <div className="col-md-4">
              <div className="card card-custom p-4">
                <div className="text-muted small mb-2">April 5, 2026</div>
                <h5>Reminder for Incomplete Applications</h5>
                <p className="mb-0">
                  Ensure all required documents are uploaded properly.
                </p>
              </div>
            </div>

            {/* ITEM 3 */}
            <div className="col-md-4">
              <div className="card card-custom p-4">
                <div className="text-muted small mb-2">April 10, 2026</div>
                <h5>Verification Schedule Notice</h5>
                <p className="mb-0">
                  Verification will begin after the application period ends.
                </p>
              </div>
            </div>

            {/* ITEM 4 */}
            <div className="col-md-4">
              <div className="card card-custom p-4">
                <div className="text-muted small mb-2">April 15, 2026</div>
                <h5>Deadline Reminder</h5>
                <p className="mb-0">
                  Submit before April 15, 2026.
                </p>
              </div>
            </div>

            {/* ITEM 5 */}
            <div className="col-md-4">
              <div className="card card-custom p-4">
                <div className="text-muted small mb-2">April 20, 2026</div>
                <h5>Manual Verification</h5>
                <p className="mb-0">
                  Some applicants may need to present original documents.
                </p>
              </div>
            </div>

            {/* ITEM 6 */}
            <div className="col-md-4">
              <div className="card card-custom p-4">
                <div className="text-muted small mb-2">April 25, 2026</div>
                <h5>Approved List Release</h5>
                <p className="mb-0">
                  Check your account for the list of approved applicants.
                </p>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer>
        <div className="container text-center">
          <p className="mb-0">
            © 2026 Sangguniang Kabataan of Barangay Mamatid | Educational Assistance System
          </p>
        </div>
      </footer>
    </>
  );
};

export default Announcements;