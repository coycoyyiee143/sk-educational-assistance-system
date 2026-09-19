import React, { useEffect, useRef, useState } from "react";
import "bootstrap/dist/css/bootstrap.min.css";
import "bootstrap/dist/js/bootstrap.bundle.min.js";
import { useNavigate, Navigate, Link } from "react-router-dom";
import { QRCodeSVG } from "qrcode.react";
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

  // "credentials" -> "2fa_setup" (first login ever) -> or "2fa_verify" (returning login)
  const [step, setStep] = useState("credentials");
  const [pendingToken, setPendingToken] = useState(null);
  const [qrCodeUrl, setQrCodeUrl] = useState(null);
  const [secret, setSecret] = useState(null);
  const [setupEmail, setSetupEmail] = useState(null);
  const [code, setCode] = useState("");
  const [rememberDevice, setRememberDevice] = useState(false);
  const [helpRequested, setHelpRequested] = useState(false);
  const [helpMessage, setHelpMessage] = useState("");
  const [helpLoading, setHelpLoading] = useState(false);
  const codeInputRef = useRef(null);

  // Native autoFocus makes the browser auto-scroll the input into view,
  // which on the 2fa_setup step shoves the QR code above it up behind the
  // sticky navbar. Focusing manually with preventScroll avoids that scroll
  // entirely while still landing the cursor in the field.
  useEffect(() => {
    if (step === "2fa_setup" || step === "2fa_verify") {
      codeInputRef.current?.focus({ preventScroll: true });
    }
  }, [step]);

  function goToRoleHome(user) {
    if (user.role === "sk_admin" || user.role === "superadmin") navigate("/AdminDashboard");
    else if (user.role === "it_support") navigate("/AdminUsers");
    else if (user.role === "sk_verifier") navigate("/VerifierDashboard");
    else navigate("/ApplicantDashboard");
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (!email.trim() || !password.trim()) {
      setError("Please fill in both fields.");
      return;
    }
    setLoading(true);
    try {
      const deviceToken = localStorage.getItem("device_token");
      const response = await api.post("/login", { email, password, device_token: deviceToken });
      const data = response.data;

      if (data.requires_2fa_setup) {
        setPendingToken(data.pending_token);
        setQrCodeUrl(data.qr_code_url);
        setSecret(data.secret);
        setSetupEmail(data.email);
        setStep("2fa_setup");
        return;
      }

      if (data.requires_2fa) {
        setPendingToken(data.pending_token);
        setStep("2fa_verify");
        return;
      }

      // Shouldn't normally happen anymore (login() always requires 2FA now),
      // but kept as a safe fallback in case the backend response shape changes.
      if (data.token && data.user) {
        login(data.user, data.token);
        goToRoleHome(data.user);
      }
    } catch (err) {
      setError(err.response?.data?.message || "Invalid credentials.");
    } finally {
      setLoading(false);
    }
  };

  const handleTwoFactorSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!code.trim() || code.trim().length !== 6) {
      setError("Enter the 6-digit code.");
      return;
    }

    setLoading(true);
    try {
      const endpoint = step === "2fa_setup" ? "/2fa/setup/confirm" : "/2fa/verify";
      const response = await api.post(endpoint, {
        pending_token: pendingToken,
        code: code.trim(),
        remember_device: rememberDevice,
      });

      const { token, user, device_token } = response.data;
      if (device_token) {
        localStorage.setItem("device_token", device_token);
      }
      login(user, token);
      goToRoleHome(user);
    } catch (err) {
      setError(err.response?.data?.message || "Invalid code. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  function backToCredentials() {
    setStep("credentials");
    setCode("");
    setError("");
    setPendingToken(null);
    setQrCodeUrl(null);
    setSecret(null);
    setSetupEmail(null);
    setRememberDevice(false);
    setHelpRequested(false);
    setHelpMessage("");
  }

  const handleRequestTwoFactorHelp = async () => {
    setHelpLoading(true);
    setHelpMessage("");
    try {
      const response = await api.post("/2fa/request-help", { pending_token: pendingToken });
      setHelpMessage(response.data.message);
      setHelpRequested(true);
    } catch (err) {
      setHelpMessage(err.response?.data?.message || "Couldn't send the request. Please try again.");
    } finally {
      setHelpLoading(false);
    }
  };

  if (user) {
    if (user.role === "sk_admin" || user.role === "superadmin") return <Navigate to="/AdminDashboard" replace />;
    if (user.role === "it_support") return <Navigate to="/AdminUsers" replace />;
    if (user.role === "sk_verifier") return <Navigate to="/VerifierDashboard" replace />;
    return <Navigate to="/ApplicantDashboard" replace />;
  }

  return (
    <>
      <nav className="navbar navbar-expand-lg sticky-top navbar-custom">
        <div className="container">
          <Link className="navbar-brand navbar-brand-custom" to="/">
            <img src="/icons/logo-in.png" alt="SK Logo" />
            <div className="brand-text">
              <h5>SK Barangay Mamatid</h5>
              <span>Educational Assistance System</span>
            </div>
          </Link>
          <button className="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#mainNavbar">
            <span className="navbar-toggler-icon"></span>
          </button>
          <div className="collapse navbar-collapse justify-content-end" id="mainNavbar">
            <ul className="navbar-nav">
              <li className="nav-item"><Link className="nav-link" to="/">Home</Link></li>
              <li className="nav-item"><Link className="nav-link" to="/requirements">Requirements</Link></li>
              <li className="nav-item"><Link className="nav-link" to="/announcements">Announcements</Link></li>
              <li className="nav-item"><Link className="nav-link" to="/events">Events</Link></li>
              <li className="nav-item"><Link className="nav-link active" to="/login">Login</Link></li>
              <li className="nav-item"><Link className="nav-link" to="/register">Register</Link></li>
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

                {step === "credentials" && (
                  <>
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
                        <Link to="/forgot-password" className="login-link-lg">Forgot Password?</Link>
                      </div>
                      <button type="submit" className="btn btn-danger w-100 login-btn-lg" disabled={loading}>
                        {loading ? "Logging in..." : "Login"}
                      </button>
                      <p className="text-center mt-3 login-register-lg">
                        Don't have an account? <Link to="/register">Register here</Link>
                      </p>
                    </form>
                  </>
                )}

                {step === "2fa_setup" && (
                  <>
                    <h3 className="text-danger text-start login-title-bold">Set Up Authenticator</h3>
                    <p className="text-muted text-start login-subtext-lg mb-1">
                      Scan this QR code with Google Authenticator, Authy, or a similar app.
                    </p>
                    <p className="text-muted text-start mb-3" style={{ fontSize: "13px" }}>
                      This will appear in your app as <strong>Mamatid SK-EAS ({setupEmail})</strong> —
                      a one-time setup, you'll only see this screen once.
                    </p>

                    {error && (
                      <div className="alert alert-danger login-error-alert">
                        <img src="/icons/warning.png" alt="Error" className="login-error-icon" />
                        <span>{error}</span>
                      </div>
                    )}

                    <div className="text-center mb-3">
                      {qrCodeUrl && (
                        // Generated entirely in the browser — the TOTP secret
                        // never leaves your app or gets sent to a third party.
                        <QRCodeSVG value={qrCodeUrl} size={200} />
                      )}
                      {secret && (
                        <p className="text-muted small mt-2">
                          Can't scan? Enter this code manually:<br />
                          <code>{secret}</code>
                        </p>
                      )}
                    </div>

                    <form onSubmit={handleTwoFactorSubmit} className="text-start">
                      <div className="floating-field mb-3">
                        <input
                          ref={codeInputRef}
                          type="text"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          maxLength={6}
                          id="twoFaCode"
                          className="floating-input"
                          placeholder="123456"
                          value={code}
                          onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                        />
                        <label htmlFor="twoFaCode" className="floating-label">6-digit code</label>
                      </div>
                      <div className="form-check mb-3">
                        <input
                          type="checkbox"
                          className="form-check-input"
                          id="rememberDeviceSetup"
                          checked={rememberDevice}
                          onChange={(e) => setRememberDevice(e.target.checked)}
                        />
                        <label className="form-check-label" htmlFor="rememberDeviceSetup">
                          Remember this device for 10 days
                        </label>
                      </div>
                      <button type="submit" className="btn btn-danger w-100 login-btn-lg" disabled={loading}>
                        {loading ? "Confirming..." : "Confirm & Continue"}
                      </button>
                      <button
                        type="button"
                        className="btn btn-link w-100 mt-2"
                        onClick={backToCredentials}
                        disabled={loading}
                      >
                        ← Back
                      </button>
                    </form>
                  </>
                )}

                {step === "2fa_verify" && (
                  <>
                    <h3 className="text-danger text-start login-title-bold">Enter Your Code</h3>
                    <p className="text-muted text-start login-subtext-lg mb-4">
                      Enter the 6-digit code from your authenticator app.
                    </p>

                    {error && (
                      <div className="alert alert-danger login-error-alert">
                        <img src="/icons/warning.png" alt="Error" className="login-error-icon" />
                        <span>{error}</span>
                      </div>
                    )}

                    <form onSubmit={handleTwoFactorSubmit} className="text-start">
                      <div className="floating-field mb-3">
                        <input
                          ref={codeInputRef}
                          type="text"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          maxLength={6}
                          id="twoFaCode"
                          className="floating-input"
                          placeholder="123456"
                          value={code}
                          onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                        />
                        <label htmlFor="twoFaCode" className="floating-label">6-digit code</label>
                      </div>
                      <div className="form-check mb-3">
                        <input
                          type="checkbox"
                          className="form-check-input"
                          id="rememberDeviceVerify"
                          checked={rememberDevice}
                          onChange={(e) => setRememberDevice(e.target.checked)}
                        />
                        <label className="form-check-label" htmlFor="rememberDeviceVerify">
                          Remember this device for 10 days
                        </label>
                      </div>
                      <button type="submit" className="btn btn-danger w-100 login-btn-lg" disabled={loading}>
                        {loading ? "Verifying..." : "Verify"}
                      </button>
                      <button
                        type="button"
                        className="btn btn-link w-100 mt-2 login-2fa-back-btn"
                        onClick={backToCredentials}
                        disabled={loading}
                      >
                        ← Back
                      </button>
                    </form>

                    {helpMessage && (
                      <div className={`alert ${helpRequested ? "alert-success" : "alert-danger"} mt-3`}>
                        {helpMessage}
                      </div>
                    )}

                    {!helpRequested && (
                      <p className="text-center mt-3 login-register-lg">
                        Lost your authenticator?{" "}
                        <button
                          type="button"
                          className="btn btn-link p-0 login-link-lg"
                          onClick={handleRequestTwoFactorHelp}
                          disabled={helpLoading}
                        >
                          {helpLoading ? "Sending..." : "Request help"}
                        </button>
                      </p>
                    )}
                  </>
                )}

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