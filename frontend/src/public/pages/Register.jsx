import React, { useState } from "react";
import "bootstrap/dist/js/bootstrap.bundle.min.js";
import { useNavigate, Navigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import api from "../../services/api";
import Footer from "../../components/Footer";

const CABUYAO_BARANGAYS = [
  "Baclaran", "Banaybanay", "Banlic", "Bigaa", "Butong", "Casile",
  "Diezmo", "Gulod", "Mamatid", "Marinig", "Niugan", "Pittland",
  "Poblacion Uno", "Poblacion Dos", "Poblacion Tres", "Pulo", "Sala", "San Isidro",
];

const Register = () => {
  const [form, setForm] = useState({
    firstName: "",
    middleName: "",
    lastName: "",
    mobile: "",
    email: "",
    birthdate: "",
    barangay: "",
    password: "",
    confirmPassword: "",
  });
  const [showOtherBarangay, setShowOtherBarangay] = useState(false);
  const [otherBarangay, setOtherBarangay] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();
  const navigate = useNavigate();
  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };
  const handleBarangaySelect = (e) => {
    const value = e.target.value;
    if (value === "Other") {
      setShowOtherBarangay(true);
      setForm({ ...form, barangay: otherBarangay });
    } else {
      setShowOtherBarangay(false);
      setForm({ ...form, barangay: value });
    }
  };
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (form.password !== form.confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    if (!form.barangay.trim()) {
      setError("Please select your barangay.");
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
        birthdate: form.birthdate,
        barangay: form.barangay,
        password: form.password,
        password_confirmation: form.confirmPassword,
      });
      navigate("/verify-email-notice", {
        state: { email: form.email }
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
              <li className="nav-item"><a className="nav-link" href="/requirements">Requirements</a></li>
              <li className="nav-item"><a className="nav-link" href="/announcements">Announcements</a></li>
              <li className="nav-item"><a className="nav-link" href="/events">Events</a></li>
              <li className="nav-item"><a className="nav-link" href="/login">Login</a></li>
              <li className="nav-item"><a className="nav-link active" href="/register">Register</a></li>
            </ul>
          </div>
        </div>
      </nav>

      <section className="register-split-section">
        <div className="register-split-wrap">
          <div className="register-split-image">
            <img src="/icons/register-bg.png" alt="SK Educational Assistance" />
          </div>
          <div className="register-split-form">
            <div className="login-card-wrap">
              <img src="/icons/logo-in.png" alt="logo" className="login-card-logo" />
              <h5 className="login-card-brand">Educational Assistance System</h5>
              <p className="login-card-subtext">SK Barangay Mamatid</p>
              <div className="card card-custom p-4">
                <h3 className="text-start text-danger login-title-bold">Create Applicant Account</h3>
                <p className="text-start text-muted login-subtext-lg mb-4">Register to apply for educational assistance.</p>

                {error && <div className="alert alert-danger">{error}</div>}

                <form onSubmit={handleSubmit} className="register-form-spaced">
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
                      <input name="mobile" className="form-control" placeholder="Mobile Number" onChange={handleChange} />
                    </div>
                    <div className="col-md-6 mb-3">
                      <label className="form-label">Email <span className="text-danger">*</span></label>
                      <div style={{ position: "relative" }}>
                        <input
                          type="email"
                          name="email"
                          className="form-control"
                          placeholder="Email"
                          onChange={handleChange}
                          required
                          style={{ paddingRight: "32px" }}
                        />
                        <span
                          title="Please use an active email address. We'll send verification and important notifications to this email."
                          style={{
                            position: "absolute",
                            right: "10px",
                            top: "50%",
                            transform: "translateY(-50%)",
                            cursor: "help",
                            color: "#5100ff",
                            fontSize: "18px",
                          }}
                        >
                          ⓘ
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="row">
                    <div className="col-md-6 mb-3">
                      <label className="form-label">Date of Birth <span className="text-danger">*</span></label>
                      <input
                        type="date"
                        name="birthdate"
                        className="form-control"
                        onChange={handleChange}
                        required
                      />
                    </div>
                    <div className="col-md-6 mb-3">
                      <label className="form-label">Barangay <span className="text-danger">*</span></label>
                      <select
                        className="form-select"
                        value={showOtherBarangay ? "Other" : form.barangay}
                        onChange={handleBarangaySelect}
                        required
                      >
                        <option value="" disabled>Select your barangay</option>
                        {CABUYAO_BARANGAYS.map((b) => (
                          <option key={b} value={b}>{b}</option>
                        ))}
                        <option value="Other">Other (outside Cabuyao)</option>
                      </select>
                      {showOtherBarangay && (
                        <input
                          className="form-control mt-2"
                          placeholder="Enter your barangay"
                          value={otherBarangay}
                          onChange={(e) => {
                            setOtherBarangay(e.target.value);
                            setForm({ ...form, barangay: e.target.value });
                          }}
                          required
                        />
                      )}
                    </div>
                  </div>
                  <div className="mb-3">
                    <label className="form-label">Password <span className="text-danger">*</span></label>
                    <div className="register-input-wrap">
                      <input
                        type={showPass ? "text" : "password"}
                        name="password"
                        className="form-control register-input-eye"
                        placeholder="Password (min. 8 characters)"
                        onChange={handleChange}
                        required
                      />
                      <button
                        type="button"
                        className="register-eye-btn-inline"
                        onClick={() => setShowPass(!showPass)}
                        tabIndex={-1}
                        aria-label={showPass ? "Hide password" : "Show password"}
                      >
                        {showPass ? (
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M17.94 17.94A10.94 10.94 0 0112 20c-7 0-11-8-11-8a18.5 18.5 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24" strokeLinecap="round" strokeLinejoin="round" />
                            <line x1="1" y1="1" x2="23" y2="23" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        ) : (
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" strokeLinecap="round" strokeLinejoin="round" />
                            <circle cx="12" cy="12" r="3" />
                          </svg>
                        )}
                      </button>
                    </div>
                  </div>

                  <div className="mb-3">
                    <label className="form-label">Confirm Password <span className="text-danger">*</span></label>
                    <div className="register-input-wrap">
                      <input
                        type={showConfirm ? "text" : "password"}
                        name="confirmPassword"
                        className="form-control register-input-eye"
                        placeholder="Confirm Password"
                        onChange={handleChange}
                        required
                      />
                      <button
                        type="button"
                        className="register-eye-btn-inline"
                        onClick={() => setShowConfirm(!showConfirm)}
                        tabIndex={-1}
                        aria-label={showConfirm ? "Hide password" : "Show password"}
                      >
                        {showConfirm ? (
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M17.94 17.94A10.94 10.94 0 0112 20c-7 0-11-8-11-8a18.5 18.5 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24" strokeLinecap="round" strokeLinejoin="round" />
                            <line x1="1" y1="1" x2="23" y2="23" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        ) : (
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" strokeLinecap="round" strokeLinejoin="round" />
                            <circle cx="12" cy="12" r="3" />
                          </svg>
                        )}
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

      <Footer />
    </>
  );
};

export default Register;