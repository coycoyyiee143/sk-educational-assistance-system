import React, { useEffect, useState } from "react";
import "bootstrap/dist/css/bootstrap.min.css";
import "bootstrap/dist/js/bootstrap.bundle.min.js";
import api from "../../services/api";

const Events = () => {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get("/events")
      .then((res) => setEvents(res.data))
      .catch(() => { })
      .finally(() => setLoading(false));
  }, []);

  function formatDate(dateStr) {
    if (!dateStr) return "";
    return new Date(dateStr).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  }

  function formatTime(timeStr) {
    if (!timeStr) return "";
    const [h, m] = timeStr.split(":").map(Number);
    const period = h >= 12 ? "PM" : "AM";
    const hour = h % 12 || 12;
    return `${hour}:${String(m).padStart(2, "0")} ${period}`;
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
              <li className="nav-item"><a className="nav-link" href="/requirements">Requirements</a></li>
              <li className="nav-item"><a className="nav-link" href="/announcements">Announcements</a></li>
              <li className="nav-item"><a className="nav-link active" href="/events">Events</a></li>
              <li className="nav-item"><a className="nav-link" href="/login">Login</a></li>
              <li className="nav-item"><a className="nav-link" href="/register">Register</a></li>
            </ul>
          </div>
        </div>
      </nav>

      <section className="hero text-white text-center py-5"
        style={{ background: "linear-gradient(rgba(183,28,28,0.85), rgba(211,47,47,0.85))" }}>
        <div className="container">
          <h1>SK Youth Programs and Activities</h1>
          <p>The Sangguniang Kabataan organizes youth programs, sports, and community activities in Barangay Mamatid.</p>
        </div>
      </section>

      <section className="py-5">
        <div className="container">
          <h2 className="text-center section-title">Upcoming SK Activities</h2>

          {loading ? (
            <div className="text-center py-5">
              <div className="spinner-border text-danger" role="status" />
            </div>
          ) : events.length === 0 ? (
            <div className="alert alert-info text-center">No events at this time. Check back later.</div>
          ) : (
            <div className="row g-4">
              {events.map((ev) => (
                <div className="col-md-4" key={ev.id}>
                  <div className="card card-custom h-100">
                    {ev.image_path ? (
                      <img
                        src={`http://localhost:8000/storage/${ev.image_path}`}
                        className="card-img-top"
                        alt={ev.title}
                        style={{ height: "200px", objectFit: "cover" }}
                      />
                    ) : (
                      <div className="bg-danger" style={{ height: "200px" }} />
                    )}
                    <div className="card-body">
                      <h5>{ev.title}</h5>
                      <p className="text-muted small">
                        <strong>Date:</strong> {formatDate(ev.event_date)}<br />
                        {ev.event_time && <><strong>Time:</strong> {formatTime(ev.event_time)}<br /></>}
                        {ev.venue && <><strong>Venue:</strong> {ev.venue}</>}
                      </p>
                      {ev.description && <p className="mb-0">{ev.description}</p>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

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

      <footer>
        <div className="container text-center">
          <p className="mb-0">© 2026 Sangguniang Kabataan of Barangay Mamatid | Educational Assistance System</p>
        </div>
      </footer>
    </>
  );
};

export default Events;