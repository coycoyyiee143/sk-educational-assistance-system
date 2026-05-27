import React from "react";
import "bootstrap/dist/css/bootstrap.min.css";
import "bootstrap/dist/js/bootstrap.bundle.min.js";

const Home = () => {
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

          <button
            className="navbar-toggler"
            type="button"
            data-bs-toggle="collapse"
            data-bs-target="#mainNavbar"
          >
            <span className="navbar-toggler-icon"></span>
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
                  Application
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

      <section className="hero-section">
        <div className="container">
          <h1>SK Educational Assistance Application System</h1>

          <p>
            Apply online for the Educational Assistance Program of the
            Sangguniang Kabataan of Barangay Mamatid. View requirements,
            announcements, schedules, and important updates through this system.
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

      <section className="py-5">
        <div className="container">
          <h2 className="section-title text-center">
            About the Program
          </h2>

          <div className="about-box">
            <p className="mb-3">
              The Educational Assistance Program of the Sangguniang Kabataan of
              Barangay Mamatid aims to provide financial support to qualified
              youth residents who are currently studying.
            </p>

            <p className="mb-0">
              Through this initiative, the Sangguniang Kabataan promotes
              educational development and youth empowerment in the community.
            </p>
          </div>
        </div>
      </section>

      <section className="py-5 highlight-section">
        <div className="container">
          <h2 className="section-title text-center">
            Available Slots
          </h2>

          <div className="slot-box">
            <h3>120 Slots Remaining</h3>

            <p>
              Updated based on the current approved applications.
            </p>
          </div>
        </div>
      </section>

      <section className="py-5 highlight-section">
        <div className="container">
          <h2 className="section-title text-center">
            Requirements Preview
          </h2>

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

                <p className="mt-3 mb-0">
                  Applicants must ensure that all submitted documents are
                  complete and readable.
                </p>
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

      <section className="py-5">
        <div className="container">
          <h2 className="section-title text-center">
            Latest Announcements
          </h2>

          <div className="row g-4">
            <div className="col-md-4">
              <div className="card card-custom p-4">
                <h5>Application Period Open</h5>

                <p className="mb-0">
                  The application period is now open for all qualified students.
                </p>
              </div>
            </div>

            <div className="col-md-4">
              <div className="card card-custom p-4">
                <h5>Verification Advisory</h5>

                <p className="mb-0">
                  Check your account regularly for verification updates.
                </p>
              </div>
            </div>

            <div className="col-md-4">
              <div className="card card-custom p-4">
                <h5>Claiming Notice</h5>

                <p className="mb-0">
                  Approved applicants must follow the official claiming
                  schedule.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="py-5 highlight-section">
        <div className="container">
          <h2 className="section-title text-center">
            Schedule Preview
          </h2>

          <div className="row g-4">
            <div className="col-md-4">
              <div className="card card-custom p-4">
                <h5>Application Schedule</h5>

                <p className="mb-1">
                  Start: April 1, 2026
                </p>

                <p className="mb-0">
                  End: April 15, 2026
                </p>
              </div>
            </div>

            <div className="col-md-4">
              <div className="card card-custom p-4">
                <h5>Verification Schedule</h5>

                <p className="mb-1">
                  Initial Screening: April 16–18
                </p>

                <p className="mb-0">
                  Manual Verification: April 19–22
                </p>
              </div>
            </div>

            <div className="col-md-4">
              <div className="card card-custom p-4">
                <h5>Claiming Schedule</h5>

                <p className="mb-1">
                  Approved List: April 25
                </p>

                <p className="mb-0">
                  Claiming: April 27–30
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="py-5">
        <div className="container text-center">
          <h2 className="section-title">
            Sangguniang Kabataan Officials
          </h2>

          <div className="mt-4">
            <img
              src="/officials.png"
              className="img-fluid officials-img"
              alt="SK Organizational Chart"
            />
          </div>

          <p className="text-muted mt-3 mb-0">
            Official organizational chart of the Sangguniang Kabataan of
            Barangay Mamatid.
          </p>
        </div>
      </section>

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

export default Home;