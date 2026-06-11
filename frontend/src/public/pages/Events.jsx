import React from "react";
import "bootstrap/dist/css/bootstrap.min.css";
import "bootstrap/dist/js/bootstrap.bundle.min.js";

const Events = () => {
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
              <li className="nav-item"><a className="nav-link" href="/announcements">Announcements</a></li>
              <li className="nav-item"><a className="nav-link active" href="/events">Events</a></li>
              <li className="nav-item"><a className="nav-link" href="/login">Login</a></li>
              <li className="nav-item"><a className="nav-link" href="/register">Register</a></li>

            </ul>
          </div>

        </div>
      </nav>

      {/* HERO */}
      <section
        className="hero text-white text-center py-5"
        style={{
          background:
            "linear-gradient(rgba(183,28,28,0.85), rgba(211,47,47,0.85))",
        }}
      >
        <div className="container">
          <h1>SK Youth Programs and Activities</h1>
          <p>
            The Sangguniang Kabataan organizes youth programs, sports,
            and community activities in Barangay Mamatid.
          </p>
        </div>
      </section>

      {/* EVENTS */}
      <section className="py-5">
        <div className="container">

          <h2 className="text-center section-title">Upcoming SK Activities</h2>

          <div className="row g-4">

            {/* EVENT 1 */}
            <div className="col-md-4">
              <div className="card card-custom h-100">
                <img src="/event1.jpg" className="card-img-top" alt="Event 1" />
                <div className="card-body">
                  <h5>Basketball League</h5>
                  <p className="text-muted small">
                    <strong>Date:</strong> May 5, 2026 <br />
                    <strong>Venue:</strong> Covered Court
                  </p>
                  <p>
                    Sports league promoting teamwork and fitness.
                  </p>
                </div>
              </div>
            </div>

            {/* EVENT 2 */}
            <div className="col-md-4">
              <div className="card card-custom h-100">
                <img src="/event2.jpg" className="card-img-top" alt="Event 2" />
                <div className="card-body">
                  <h5>Clean-Up Drive</h5>
                  <p className="text-muted small">
                    <strong>Date:</strong> May 10, 2026 <br />
                    <strong>Venue:</strong> Barangay Area
                  </p>
                  <p>
                    Community clean-up activity for youth volunteers.
                  </p>
                </div>
              </div>
            </div>

            {/* EVENT 3 */}
            <div className="col-md-4">
              <div className="card card-custom h-100">
                <img src="/event3.jpg" className="card-img-top" alt="Event 3" />
                <div className="card-body">
                  <h5>Leadership Workshop</h5>
                  <p className="text-muted small">
                    <strong>Date:</strong> May 15, 2026 <br />
                    <strong>Venue:</strong> Session Hall
                  </p>
                  <p>
                    Training for leadership and communication skills.
                  </p>
                </div>
              </div>
            </div>

            {/* EVENT 4 */}
            <div className="col-md-4">
              <div className="card card-custom h-100">
                <img src="/event4.jpg" className="card-img-top" alt="Event 4" />
                <div className="card-body">
                  <h5>Study Skills Seminar</h5>
                  <p className="text-muted small">
                    <strong>Date:</strong> May 20, 2026 <br />
                    <strong>Venue:</strong> Multipurpose Hall
                  </p>
                  <p>
                    Seminar for improving study habits and academic performance.
                  </p>
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* REMINDERS */}
      <section className="py-5" style={{ background: "#fff3f3" }}>
        <div className="container">

          <h2 className="text-center section-title">Event Reminders</h2>

          <div className="card card-custom p-4">
            <ul className="mb-0">
              <li>Participate in SK programs and activities.</li>
              <li>Some events may require registration.</li>
              <li>Arrive on time.</li>
              <li>Follow SK and barangay guidelines.</li>
            </ul>
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

export default Events;