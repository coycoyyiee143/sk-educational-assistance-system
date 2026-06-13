import React, { useState } from "react";
import "bootstrap/dist/css/bootstrap.min.css";
import "bootstrap/dist/js/bootstrap.bundle.min.js";
import { useNavigate, Navigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import api from "../../services/api";

const Register = () => {
  const [form, setForm] = useState({
    firstName: "",
    middleName: "",
    lastName: "",
    mobile: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [showPass, setShowPass] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();
  const navigate = useNavigate();

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (form.password !== form.confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    setLoading(true);
    try {
      await api.post("/register", {
        first_name: form.firstName,
        middle_name: form.middleName,
        last_name: form.lastName,
        mobile_number: form.mobile,
        email: form.email,
        password: form.password,
        password_confirmation: form.confirmPassword,
      });
      navigate("/login", {
        state: { message: "Registration successful! Please log in." }
      });
    } catch (err) {
      const errors = err.response?.data?.errors;
      if (errors) {
        setError(Object.values(errors).flat().join(" "));
      } else {
        setError(err.response?.data?.message || "Registration failed.");
      }
    } finally {
      setLoading(false);
    }
  };

  if (user) {
    if (user.role === "sk_admin") return <Navigate to="/AdminDashboard" replace />;
    if (user.role === "sk_verifier") return <Navigate to="/VerifierDashboard" replace />;
    return <Navigate to="/ApplicantDashboard" replace />;
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
              <li className="nav-item"><a className="nav-link" href="/requirements">Application</a></li>
              <li className="nav-item"><a className="nav-link" href="/announcements">Announcements</a></li>
              <li className="nav-item"><a className="nav-link" href="/events">Events</a></li>
              <li className="nav-item"><a className="nav-link" href="/login">Login</a></li>
              <li className="nav-item"><a className="nav-link active" href="/register">Register</a></li>
            </ul>
          </div>
        </div>
      </nav>

      <section className="py-5">
        <div className="container">
          <div className="row justify-content-center">
            <div className="col-lg-8">
              <div className="card card-custom p-4">
                <h3 className="text-center text-danger">Create Applicant Account</h3>
                <p className="text-center text-muted">Register to apply for educational assistance.</p>

                {error && <div className="alert alert-danger">{error}</div>}

                <form onSubmit={handleSubmit}>
                  <div className="row">
                    <div className="col-md-4 mb-3">
                      <label className="form-label">First Name <span className="text-danger">*</span></label>
                      <input name="firstName" className="form-control" placeholder="First Name" onChange={handleChange} required />
                    </div>
                    <div className="col-md-4 mb-3">
                      <label className="form-label">Middle Name</label>
                      <input name="middleName" className="form-control" placeholder="Middle Name" onChange={handleChange} />
                    </div>
                    <div className="col-md-4 mb-3">
                      <label className="form-label">Last Name <span className="text-danger">*</span></label>
                      <input name="lastName" className="form-control" placeholder="Last Name" onChange={handleChange} required />
                    </div>
                  </div>

                  <div className="row">
                    <div className="col-md-6 mb-3">
                      <label className="form-label">Mobile Number</label>
                      <input name="mobile" className="form-control" placeholder="e.g. 09XXXXXXXXX" onChange={handleChange} />
                    </div>
                    <div className="col-md-6 mb-3">
                      <label className="form-label">Email <span className="text-danger">*</span></label>
                      <input type="email" name="email" className="form-control" placeholder="Email" onChange={handleChange} required />
                    </div>
                  </div>

                  <div className="mb-3">
                    <label className="form-label">Password <span className="text-danger">*</span></label>
                    <div className="input-group">
                      <input
                        type={showPass ? "text" : "password"}
                        name="password"
                        className="form-control"
                        placeholder="Password (min. 8 characters)"
                        onChange={handleChange}
                        required
                      />
                      <button
                        type="button"
                        className="btn btn-outline-secondary"
                        onClick={() => setShowPass(!showPass)}
                        tabIndex={-1}
                      >
                        {showPass ? "Hide" : "Show"}
                      </button>
                    </div>
                  </div>

                  <div className="mb-3">
                    <label className="form-label">Confirm Password <span className="text-danger">*</span></label>
                    <div className="input-group">
                      <input
                        type={showConfirm ? "text" : "password"}
                        name="confirmPassword"
                        className="form-control"
                        placeholder="Confirm Password"
                        onChange={handleChange}
                        required
                      />
                      <button
                        type="button"
                        className="btn btn-outline-secondary"
                        onClick={() => setShowConfirm(!showConfirm)}
                        tabIndex={-1}
                      >
                        {showConfirm ? "Hide" : "Show"}
                      </button>
                    </div>
                  </div>

                  <button className="btn btn-danger w-100" type="submit" disabled={loading}>
                    {loading ? "Registering..." : "Register"}
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

      <footer>
        <div className="container text-center">
          <p className="mb-0">© 2026 Sangguniang Kabataan of Barangay Mamatid | Educational Assistance System</p>
        </div>
      </footer>
    </>
  );
};

export default Register;