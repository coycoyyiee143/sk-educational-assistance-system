import React, { useEffect, useState } from "react";
import "bootstrap/dist/css/bootstrap.min.css";
import "bootstrap/dist/js/bootstrap.bundle.min.js";
import api from "../../services/api";
import Footer from "../../components/Footer";

const Announcements = () => {
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null); // announcement currently open sa modal

  useEffect(() => {
    api.get("/announcements")
      .then((res) => setAnnouncements(res.data))
      .catch(() => { })
      .finally(() => setLoading(false));
  }, []);

  const formatDate = (date) =>
    date
      ? new Date(date).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
      : "";

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
              <li className="nav-item"><a className="nav-link active" href="/announcements">Announcements</a></li>
              <li className="nav-item"><a className="nav-link" href="/events">Events</a></li>
              <li className="nav-item"><a className="nav-link" href="/login">Login</a></li>
              <li className="nav-item"><a className="nav-link" href="/register">Register</a></li>
            </ul>
          </div>
        </div>
      </nav>

      <section className="hero text-center text-white py-5"
        style={{ background: "linear-gradient(rgba(183,28,28,0.85), rgba(211,47,47,0.85))" }}>
        <div className="container">
          <h1>Announcements</h1>
          <p>Stay updated with the latest announcements and important updates regarding the SK Educational Assistance Program.</p>
        </div>
      </section>

      <section className="py-5">
        <div className="container">
          <h2 className="section-title text-center">Latest Updates</h2>
          {loading ? (
            <div className="text-center py-5">
              <div className="spinner-border text-danger" role="status" />
            </div>
          ) : announcements.length === 0 ? (
            <div className="alert alert-info text-center">No announcements at this time. Check back later.</div>
          ) : (
            <div className="row g-4">
              {announcements.map((a) => (
                <div className="col-md-4" key={a.id}>
                  <div className="card card-custom announcement-card p-3">
                    {a.category && (
                      <span className="badge bg-danger mb-2" style={{ width: "fit-content" }}>{a.category}</span>
                    )}
                    <div className="text-muted small mb-2">
                      {formatDate(a.published_at)}
                    </div>
                    <h5>{a.title}</h5>
                    <p className="announcement-preview mb-0">
                      {a.content && a.content.length > 90
                        ? a.content.slice(0, 90).trim() + "... "
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
        </div>
      </section>

      {/* Read more modal */}
      {selected && (
        <div className="modal fade show announcement-modal-backdrop" style={{ display: "block" }} tabIndex="-1">
          <div className="modal-dialog modal-dialog-centered modal-lg">
            <div className="modal-content announcement-modal-content">
              <div className="announcement-modal-titlebar">
                <h4 className="announcement-modal-title">{selected.title}</h4>
                <button
                  type="button"
                  className="announcement-modal-close"
                  onClick={() => setSelected(null)}
                  aria-label="Close"
                >
                  &times;
                </button>
              </div>
              <div className="modal-body announcement-modal-body">
                <p className="mb-0" style={{ whiteSpace: "pre-wrap" }}>{selected.content}</p>
              </div>
            </div>
          </div>
        </div>
      )}
      {selected && <div className="modal-backdrop fade show" onClick={() => setSelected(null)}></div>}

      <Footer />
    </>
  );
};

export default Announcements;