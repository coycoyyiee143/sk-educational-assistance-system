import React, { useState } from "react";
import "bootstrap/dist/css/bootstrap.min.css";
import "bootstrap/dist/js/bootstrap.bundle.min.js";

const Register = () => {
  const [form, setForm] = useState({
    firstName: "",
    middleName: "",
    lastName: "",
    birthdate: "",
    mobile: "",
    liveInMamatid: "",
    email: "",
    password: "",
    confirmPassword: "",
  });

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    if (form.password !== form.confirmPassword) {
      alert("Passwords do not match!");
      return;
    }

    alert("Registration successful!");
    window.location.href = "/login";
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
              <li className="nav-item"><a className="nav-link" href="/login">Login</a></li>
              <li className="nav-item"><a className="nav-link active" href="/register">Register</a></li>

            </ul>
          </div>

        </div>
      </nav>

      {/* REGISTER FORM */}
      <section className="py-5">
        <div className="container">

          <div className="row justify-content-center">
            <div className="col-lg-8">

              <div className="card card-custom p-4">

                <h3 className="text-center text-danger">Create Applicant Account</h3>
                <p className="text-center text-muted">
                  Register to apply for educational assistance.
                </p>

                <form onSubmit={handleSubmit}>

                  <div className="row">

                    <div className="col-md-4 mb-3">
                      <input
                        name="firstName"
                        className="form-control"
                        placeholder="First Name"
                        onChange={handleChange}
                        required
                      />
                    </div>

                    <div className="col-md-4 mb-3">
                      <input
                        name="middleName"
                        className="form-control"
                        placeholder="Middle Name"
                        onChange={handleChange}
                      />
                    </div>

                    <div className="col-md-4 mb-3">
                      <input
                        name="lastName"
                        className="form-control"
                        placeholder="Last Name"
                        onChange={handleChange}
                        required
                      />
                    </div>

                  </div>

                  <div className="row">

                    <div className="col-md-6 mb-3">
                      <input
                        type="date"
                        name="birthdate"
                        className="form-control"
                        onChange={handleChange}
                        required
                      />
                    </div>

                    <div className="col-md-6 mb-3">
                      <input
                        name="mobile"
                        className="form-control"
                        placeholder="Mobile Number"
                        onChange={handleChange}
                        required
                      />
                    </div>

                  </div>

                  <div className="mb-3">
                    <label className="form-label">Do you live in Mamatid?</label>

                    <div className="border p-2 rounded">

                      <div>
                        <input
                          type="radio"
                          name="liveInMamatid"
                          value="Yes"
                          onChange={handleChange}
                        /> Yes
                      </div>

                      <div>
                        <input
                          type="radio"
                          name="liveInMamatid"
                          value="No"
                          onChange={handleChange}
                        /> No
                      </div>

                    </div>
                  </div>

                  <div className="mb-3">
                    <input
                      name="email"
                      className="form-control"
                      placeholder="Email"
                      onChange={handleChange}
                    />
                  </div>

                  <div className="mb-3">
                    <input
                      type="password"
                      name="password"
                      className="form-control"
                      placeholder="Password"
                      onChange={handleChange}
                      required
                    />
                  </div>

                  <div className="mb-3">
                    <input
                      type="password"
                      name="confirmPassword"
                      className="form-control"
                      placeholder="Confirm Password"
                      onChange={handleChange}
                      required
                    />
                  </div>

                  <button className="btn btn-danger w-100" type="submit">
                    Register
                  </button>

                  <p className="text-center mt-3">
                    Already have an account? <a href="/login">Login</a>
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

export default Register;