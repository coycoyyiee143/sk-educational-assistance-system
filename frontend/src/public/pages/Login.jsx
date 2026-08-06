import React, { useState } from "react";
import "bootstrap/dist/css/bootstrap.min.css";
import "bootstrap/dist/js/bootstrap.bundle.min.js";
import { useNavigate, Navigate } from "react-router-dom";
import api from "../../services/api";
import { useAuth } from "../../context/AuthContext";
import Footer from "../../components/Footer";

const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { login, user } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (!email.trim() || !password.trim()) {
      setError("Please fill in both fields.");
      return;
    }
    setLoading(true);
    try {
      const response = await api.post("/login", { email, password });
      const { token, user } = response.data;
      login(user, token);
      if (user.role === "sk_admin") navigate("/AdminDashboard");
      else if (user.role === "sk_verifier") navigate("/VerifierDashboard");
      else navigate("/ApplicantDashboard");
    } catch (err) {
      setError(err.response?.data?.message || "Invalid credentials.");
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
              <li className="nav-item"><a className="nav-link active" href="/login">Login</a></li>
              <li className="nav-item"><a className="nav-link" href="/register">Register</a></li>
            </ul>
          </div>
        </div>
      </nav>

      <section className="login-split-section">
        <div className="login-split-wrap">
          <div className="login-split-image">
            <img src="/icons/log-in.png" alt="SK Educational Assistance" />
          </div>
          <div className="login-split-form">
            <div className="login-card-wrap">
              <img src="/icons/logo-in.png" alt="logo" className="login-card-logo" />
              <h5 className="login-card-brand">Educational Assistance System</h5>
              <p className="login-card-subtext">SK Barangay Mamatid</p>
              <div className="card card-custom p-4 login-card-box">
                <h3 className="text-danger text-start login-title-bold">Login</h3>
                <p className="text-muted text-start login-subtext-lg mb-4">Login using your email address.</p>

                {error && (
                  <div className="alert alert-danger login-error-alert">
                    <img src="/icons/warning.png" alt="Error" className="login-error-icon" />
                    <span>{error}</span>
                  </div>
                )}

                <form onSubmit={handleSubmit} className="text-start">
                  <div className="floating-field mb-3">
                    <input
                      type="email"
                      id="loginEmail"
                      className="floating-input"
                      placeholder="you@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                    <label htmlFor="loginEmail" className="floating-label">Email</label>
                  </div>
                  <div className="floating-field mb-3">
                    <input
                      type={showPass ? "text" : "password"}
                      id="loginPassword"
                      className="floating-input floating-input-icon"
                      placeholder="Enter your password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                    <label htmlFor="loginPassword" className="floating-label">Password</label>
                    <button
                      type="button"
                      className="floating-eye-btn"
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
                  <div className="text-end mb-3">
                    <a href="/forgot-password" className="login-link-lg">Forgot Password?</a>
                  </div>
                  <button type="submit" className="btn btn-danger w-100 login-btn-lg" disabled={loading}>
                    {loading ? "Logging in..." : "Login"}
                  </button>
                  <p className="text-center mt-3 login-register-lg">
                    Don't have an account? <a href="/register">Register here</a>
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

export default Login;