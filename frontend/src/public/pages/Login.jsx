import React, { useState } from "react";
import "bootstrap/dist/css/bootstrap.min.css";
import "bootstrap/dist/js/bootstrap.bundle.min.js";

const Login = () => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const handleSubmit = (e) => {
    e.preventDefault();

    if (username.trim() === "" || password.trim() === "") {
      alert("Please fill in both fields to proceed.");
      return;
    }

    if (username === "admin" && password === "1234") {
      alert("Admin login successful!");
      window.location.href = "/AdminDashboard";
    } else if (username === "applicant" && password === "1234") {
      alert("Applicant login successful!");
      window.location.href = "/ApplicantDashboard";
    } else if (username === "verifier" && password === "1234") {
      alert("Verifier login successful!");
      window.location.href = "/VerifierDashboard";
    } else {
      alert("Invalid login credentials.");
    }
  };

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

          <button className="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#mainNavbar">
            <span className="navbar-toggler-icon"></span>
          </button>

          <div className="collapse navbar-collapse justify-content-end" id="mainNavbar">
            <ul className="navbar-nav">

              <li className="nav-item"><a className="nav-link" href="/">Home</a></li>
              <li className="nav-item"><a className="nav-link" href="/requirements">Application</a></li>
              <li className="nav-item"><a className="nav-link" href="/announcements">Announcements</a></li>
              <li className="nav-item"><a className="nav-link" href="/events">Events</a></li>
              <li className="nav-item"><a className="nav-link active" href="/login">Login</a></li>
              <li className="nav-item"><a className="nav-link" href="/register">Register</a></li>

            </ul>
          </div>

        </div>
      </nav>

      {/* LOGIN FORM */}
      <section className="py-5">
        <div className="container">

          <div className="row justify-content-center">
            <div className="col-md-5">

              <div className="card card-custom p-4 text-center">

                <img src="/logo.png" alt="logo" style={{ width: "80px", marginBottom: "10px" }} />

                <h3 className="text-danger">Applicant Login</h3>
                <p className="text-muted small">
                  Login using your email or mobile number.
                </p>

                <form onSubmit={handleSubmit} className="text-start">

                  <div className="mb-3">
                    <label className="form-label">Email or Mobile</label>
                    <input
                      type="text"
                      className="form-control"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="Enter email or mobile"
                    />
                  </div>

                  <div className="mb-3">
                    <label className="form-label">Password</label>
                    <input
                      type="password"
                      className="form-control"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter password"
                    />
                  </div>

                  <div className="text-end mb-3">
                    <a href="/forgot-password" className="small">
                      Forgot Password?
                    </a>
                  </div>

                  <button type="submit" className="btn btn-danger w-100">
                    Login
                  </button>

                  <p className="text-center mt-3 small">
                    Don't have an account? <a href="/register">Register here</a>
                  </p>

                </form>

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

export default Login;