import React, { useState, useRef, useEffect } from "react";
import "bootstrap/dist/js/bootstrap.bundle.min.js";
import { useNavigate, Navigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import api from "../../services/api";
import Footer from "../../components/Footer";
import FaceCapture from "../../applicant/components/FaceCapture";

// Small reusable block: renders one red line per message for a given
// backend field key, or nothing if there's no error for that field.
function FieldError({ errors, field }) {
  if (!errors || !errors[field] || errors[field].length === 0) return null;
  return (
    <div className="mt-1">
      {errors[field].map((msg, i) => (
        <div key={i} className="text-danger small" style={{ lineHeight: 1.4 }}>
          {msg}
        </div>
      ))}
    </div>
  );
}

const Register = () => {
  const [form, setForm] = useState({
    firstName: "",
    middleName: "",
    lastName: "",
    mobile: "",
    email: "",
    birthdate: "",
    barangay: "Mamatid",
    password: "",
    confirmPassword: "",
  });

  const [showPass, setShowPass] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  // General, not-tied-to-one-field errors (e.g. the name+birthdate
  // duplicate check, network failures) still show as a top banner.
  const [generalError, setGeneralError] = useState("");
  // Per-field errors from Laravel's {errors: {field: [messages]}}
  // shape, rendered directly under the matching input.
  const [fieldErrors, setFieldErrors] = useState({});

  const [loading, setLoading] = useState(false);

  const [idImage, setIdImage] = useState(null);
  const [idPreview, setIdPreview] = useState(null);
  const idFileInputRef = useRef(null);

  const [step, setStep] = useState("form");

  // Shows the success popup before redirecting to email verification
  const [faceVerified, setFaceVerified] = useState(false);

  // Data Privacy consent
  const [agreePrivacy, setAgreePrivacy] = useState(false);
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);

  const { user } = useAuth();
  const navigate = useNavigate();

  // synchronous lock, hindi state — para hindi maabutan ng
  // rapid double-click bago mag-re-render ang loading state
  const submittingRef = useRef(false);

  // One ref per field, so a field-level error can scroll straight to
  // the input it belongs to — useful since the form is long enough
  // that an error near the bottom (like password) could otherwise be
  // scrolled out of view when the person is still looking at the top.
  const fieldRefs = useRef({});
  const setFieldRef = (key) => (el) => {
    fieldRefs.current[key] = el;
  };

  /* ========================================
     FORM
  ======================================== */

  const handleChange = (e) => {
    setForm({
      ...form,
      [e.target.name]: e.target.value,
    });

    setGeneralError("");
    // Clear that specific field's errors as soon as the person edits
    // it, rather than leaving stale errors up until the next submit.
    setFieldErrors((prev) => {
      const backendKey = {
        firstName: "first_name",
        middleName: "middle_name",
        lastName: "last_name",
        mobile: "mobile_number",
        email: "email",
        birthdate: "birthdate",
        password: "password",
        confirmPassword: "password",
      }[e.target.name];

      if (!backendKey || !prev[backendKey]) return prev;
      const next = { ...prev };
      delete next[backendKey];
      return next;
    });
  };

  function handleIdChange(e) {
    const file = e.target.files[0];

    if (!file) return;

    setIdImage(file);
    setIdPreview(URL.createObjectURL(file));
    setGeneralError("");
  }

  // The native file input resets itself when the browser restores this
  // page from back/forward cache (bfcache) — but our React state for
  // the preview doesn't know that happened, so the old preview would
  // otherwise keep showing next to an input that says "No file chosen."
  // Clear our state to match whenever that restore happens.
  useEffect(() => {
    function handlePageShow(e) {
      if (e.persisted) {
        setIdImage(null);
        setIdPreview(null);
        if (idFileInputRef.current) idFileInputRef.current.value = "";
      }
    }

    window.addEventListener("pageshow", handlePageShow);
    return () => window.removeEventListener("pageshow", handlePageShow);
  }, []);

  // The native file input resets itself when the browser restores this
  // page from back/forward cache (bfcache) — but our React state for
  // the preview doesn't know that happened, so the old preview would
  // otherwise keep showing next to an input that says "No file chosen."
  // Clear our state to match whenever that restore happens.
  useEffect(() => {
    function handlePageShow(e) {
      if (e.persisted) {
        setIdImage(null);
        setIdPreview(null);
        if (idFileInputRef.current) idFileInputRef.current.value = "";
      }
    }

    window.addEventListener("pageshow", handlePageShow);
    return () => window.removeEventListener("pageshow", handlePageShow);
  }, []);

  const handleNext = async (e) => {
    e.preventDefault();

    if (submittingRef.current) return; // block double click/double submit

    setGeneralError("");
    setFieldErrors({});

    const passwordRule = /^(?=.*[a-z])(?=.*\d).{8,}$/;
    if (!passwordRule.test(form.password)) {
      setFieldErrors({ password: ["Password must be at least 8 characters, with a lowercase letter and a number."] });
      return;
    }

    if (form.password !== form.confirmPassword) {
      setFieldErrors({ password: ["Passwords do not match."] });
      return;
    }

    if (!idImage) {
      setGeneralError("Please upload a valid ID.");
      return;
    }

    if (!agreePrivacy) {
      setGeneralError("Please read and agree to the Data Privacy Notice before proceeding.");
      return;
    }

    submittingRef.current = true;
    setLoading(true);

    try {
      await api.post("/register/check", {
        first_name: form.firstName,
        middle_name: form.middleName,
        last_name: form.lastName,
        birthdate: form.birthdate,
        email: form.email,
        mobile_number: form.mobile,
        password: form.password,
        password_confirmation: form.confirmPassword,
      });

      setStep("face");
    } catch (err) {
      const errors = err.response?.data?.errors;

      if (errors) {
        setFieldErrors(errors);

        // Scroll to the first field that actually has an error. A
        // small delay lets React finish rendering the error text first
        // — scrollIntoView needs the element (and its new height, now
        // that the error message pushed things down) to already exist.
        const firstErrorField = Object.keys(errors)[0];
        setTimeout(() => {
          fieldRefs.current[firstErrorField]?.scrollIntoView({
            behavior: "smooth",
            block: "center",
          });
        }, 50);
      } else {
        setGeneralError(
          err.response?.data?.message ||
          "An account matching your name and date of birth already exists under a different account. Please contact the SK office if you believe this is an error."
        );
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    } finally {
      submittingRef.current = false;
      setLoading(false);
    }
  };

  /* ========================================
     REGISTER + FACE VERIFICATION
  ======================================== */

  async function handleRegisterWithFace({
    idImage: capturedIdImage,
    liveBlob,
  }) {
    setGeneralError("");
    setLoading(true);

    try {
      const formData = new FormData();

      formData.append("first_name", form.firstName);
      formData.append("middle_name", form.middleName);
      formData.append("last_name", form.lastName);
      formData.append("mobile_number", form.mobile);
      formData.append("email", form.email);
      formData.append("birthdate", form.birthdate);
      formData.append("barangay", form.barangay);
      formData.append("password", form.password);
      formData.append(
        "password_confirmation",
        form.confirmPassword
      );

      formData.append("id_image", capturedIdImage);
      formData.append("live_photo", liveBlob, "live.jpg");
      formData.append("privacy_consent", agreePrivacy ? "1" : "0");

      await api.post("/register", formData);

      setFaceVerified(true);

      setTimeout(() => {
        navigate("/verify-email-notice", {
          state: {
            email: form.email,
          },
        });
      }, 3000);
    } catch (err) {
      const errors = err.response?.data?.errors;

      if (errors) {
        setGeneralError(
          Object.values(errors)
            .flat()
            .join(" ")
        );
      } else {
        setGeneralError(
          err.response?.data?.message ||
          "Registration failed."
        );
      }
    } finally {
      setLoading(false);
    }
  }

  /* ========================================
     ALREADY LOGGED IN
  ======================================== */

  if (user) {
    if (user.role === "sk_admin") {
      return (
        <Navigate
          to="/AdminDashboard"
          replace
        />
      );
    }

    if (user.role === "sk_verifier") {
      return (
        <Navigate
          to="/VerifierDashboard"
          replace
        />
      );
    }

    return (
      <Navigate
        to="/ApplicantDashboard"
        replace
      />
    );
  }

  /* ========================================
     FACE VERIFICATION PAGE
  ======================================== */

  if (step === "face") {
    return (
      <>
        <nav className="navbar navbar-expand-lg sticky-top navbar-custom">
          <div className="container">
            <a
              className="navbar-brand navbar-brand-custom"
              href="/"
            >
              <img
                src="/icons/sk-logo.jpg"
                alt="SK Logo"
              />

              <div className="brand-text">
                <h5>SK Barangay Mamatid</h5>
                <span>
                  Educational Assistance System
                </span>
              </div>
            </a>
          </div>
        </nav>

        <section className="identity-page">
          <div className="identity-shell">

            <div className="identity-notice">
              <div className="identity-notice-icon">
                i
              </div>

              <div>
                <strong>
                  Identity Verification
                </strong>

                <p>
                  Before creating your account, we need
                  to confirm that the person registering
                  matches the ID you uploaded. Your
                  captured photo will also be used as
                  your profile photo in the system and
                  may be used by SK staff as a reference
                  during claiming.
                </p>
              </div>
            </div>

            <div className="identity-landscape">

              <div className="identity-reference">
                <div className="identity-section-title">
                  <div className="identity-number">
                    1
                  </div>

                  <div>
                    <h3>Reference ID</h3>

                    <p>
                      Your uploaded identification
                    </p>
                  </div>
                </div>

                <div className="identity-id-preview">
                  {idPreview ? (
                    <img
                      src={idPreview}
                      alt="Uploaded ID"
                    />
                  ) : (
                    <span>
                      No ID preview available
                    </span>
                  )}
                </div>

                <div className="identity-id-ready">
                  <div className="identity-ready-check">
                    ✓
                  </div>

                  <div>
                    <strong>
                      ID ready for comparison
                    </strong>

                    <span>
                      This image will be matched
                      against your live photo.
                    </span>
                  </div>
                </div>
              </div>

              <div className="identity-scan-card">
                <div className="identity-scan-top">
                  <div>
                    <span className="identity-live-label">
                      STEP 2 OF 2
                    </span>

                    <h2>
                      Live Face Verification
                    </h2>

                    <p>
                      Position your face inside the
                      guide and hold still.
                    </p>
                  </div>

                  <span className="identity-scan-secure">
                    ✓ Secure verification
                  </span>
                </div>

                {generalError && (
                  <div className="alert alert-danger">
                    {generalError}
                  </div>
                )}

                <div className="identity-capture-center">
                  <FaceCapture
                    mode="registration"
                    externalIdImage={idImage}
                    submitLabel={
                      loading
                        ? "Creating account..."
                        : "Verify & Create Account"
                    }
                    disabled={
                      loading || faceVerified
                    }
                    onSubmitCapture={
                      handleRegisterWithFace
                    }
                  />
                </div>

                <div className="identity-guides">
                  <div className="identity-guide">
                    <div className="identity-guide-icon">
                      ☀
                    </div>

                    <div>
                      <strong>
                        Good lighting
                      </strong>

                      <p>
                        Make sure your face is clearly
                        visible.
                      </p>
                    </div>
                  </div>

                  <div className="identity-guide">
                    <div className="identity-guide-icon">
                      ◉
                    </div>

                    <div>
                      <strong>
                        Nothing covering your face
                      </strong>

                      <p>
                        Remove masks and sunglasses.
                      </p>
                    </div>
                  </div>

                  <div className="identity-guide">
                    <div className="identity-guide-icon">
                      ◎
                    </div>

                    <div>
                      <strong>
                        Stay steady
                      </strong>

                      <p>
                        Keep your face centered during
                        capture.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="identity-footer">
                  <button
                    type="button"
                    className="identity-back-btn"
                    onClick={() =>
                      setStep("form")
                    }
                    disabled={
                      loading || faceVerified
                    }
                  >
                    <span>←</span>
                    Back to account details
                  </button>

                  <div className="identity-footer-note">
                    <span>
                      Your photo is used only for
                      identity verification and your
                      applicant profile.
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {faceVerified && (
          <div
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 9999,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "20px",
              background: "rgba(17, 24, 39, 0.48)",
              backdropFilter: "blur(3px)",
              WebkitBackdropFilter: "blur(3px)",
            }}
          >
            <div
              className="text-center"
              style={{
                width: "100%",
                maxWidth: "420px",
                padding: "34px 30px",
                borderRadius: "18px",
                background: "#fff",
                border: "1px solid #e5e7eb",
                boxShadow:
                  "0 24px 60px rgba(0, 0, 0, 0.22)",
                fontFamily:
                  "'Inter', sans-serif",
              }}
            >
              <div
                className="d-flex align-items-center justify-content-center mx-auto mb-3"
                style={{
                  width: "64px",
                  height: "64px",
                  borderRadius: "50%",
                  background: "#eaf7ee",
                  color: "#218c46",
                }}
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{
                    width: "30px",
                    height: "30px",
                  }}
                >
                  <path d="M20 6L9 17l-5-5" />
                </svg>
              </div>

              <h3
                className="mb-2"
                style={{
                  fontFamily:
                    "'Poppins', 'Inter', sans-serif",
                  fontSize: "23px",
                  fontWeight: 700,
                  color: "#222",
                }}
              >
                Face Verified!
              </h3>

              <p
                className="mb-2"
                style={{
                  color: "#6b7280",
                  fontSize: "13px",
                  lineHeight: 1.6,
                }}
              >
                Your identity has been successfully
                verified and your account has been
                created.
              </p>

              <p
                className="mb-4"
                style={{
                  color: "#6b7280",
                  fontSize: "13px",
                  lineHeight: 1.6,
                }}
              >
                One more step — verify your email
                address to activate your account.
              </p>

              <div
                className="d-inline-flex align-items-center gap-2"
                style={{
                  padding: "8px 13px",
                  borderRadius: "9px",
                  background: "#fff4f4",
                  color: "#b71c1c",
                  fontSize: "12px",
                  fontWeight: 600,
                }}
              >
                <span
                  className="spinner-border spinner-border-sm"
                  role="status"
                  aria-hidden="true"
                  style={{
                    width: "13px",
                    height: "13px",
                  }}
                />

                Redirecting to email verification...
              </div>
            </div>
          </div>
        )}

        <Footer />
      </>
    );
  }

  /* ========================================
     REGISTRATION FORM
  ======================================== */

  return (
    <>
      <nav className="navbar navbar-expand-lg sticky-top navbar-custom">
        <div className="container">
          <a
            className="navbar-brand navbar-brand-custom"
            href="/"
          >
            <img
              src="/icons/sk-logo.jpg"
              alt="SK Logo"
            />

            <div className="brand-text">
              <h5>SK Barangay Mamatid</h5>

              <span>
                Educational Assistance System
              </span>
            </div>
          </a>

          <button
            className="navbar-toggler"
            type="button"
            data-bs-toggle="collapse"
            data-bs-target="#mainNavbar"
          >
            <span className="navbar-toggler-icon" />
          </button>

          <div
            className="collapse navbar-collapse justify-content-end"
            id="mainNavbar"
          >
            <ul className="navbar-nav">
              <li className="nav-item">
                <a
                  className="nav-link"
                  href="/"
                >
                  Home
                </a>
              </li>

              <li className="nav-item">
                <a
                  className="nav-link"
                  href="/requirements"
                >
                  Requirements
                </a>
              </li>

              <li className="nav-item">
                <a
                  className="nav-link"
                  href="/announcements"
                >
                  Announcements
                </a>
              </li>

              <li className="nav-item">
                <a
                  className="nav-link"
                  href="/events"
                >
                  Events
                </a>
              </li>

              <li className="nav-item">
                <a
                  className="nav-link"
                  href="/login"
                >
                  Login
                </a>
              </li>

              <li className="nav-item">
                <a
                  className="nav-link active"
                  href="/register"
                >
                  Register
                </a>
              </li>
            </ul>
          </div>
        </div>
      </nav>

      <section className="register-split-section">
        <div className="register-split-wrap">

          <div className="register-split-image">
            <img
              src="/icons/register-bg.png"
              alt="SK Educational Assistance"
            />
          </div>

          <div className="register-split-form">
            <div className="login-card-wrap">

              <img
                src="/icons/sk-logo.jpg"
                alt="SK Logo"
                className="login-card-logo"
              />

              <h5 className="login-card-brand">
                Educational Assistance System
              </h5>

              <p className="login-card-subtext">
                SK Barangay Mamatid
              </p>

              <div className="card card-custom p-4">
                <h3 className="text-start text-danger login-title-bold">
                  Create Applicant Account
                </h3>

                <p className="text-start text-muted login-subtext-lg mb-4">
                  Register to apply for educational
                  assistance.
                </p>

                {generalError && (
                  <div className="alert alert-danger">
                    {generalError}
                  </div>
                )}

                <form
                  onSubmit={handleNext}
                  className="register-form-spaced"
                >

                  <div className="row">
                    <div className="col-md-4 mb-3" ref={setFieldRef("first_name")}>
                      <label className="form-label">
                        First Name{" "}
                        <span className="text-danger">
                          *
                        </span>
                      </label>

                      <input
                        name="firstName"
                        className="form-control"
                        placeholder="First Name"
                        value={form.firstName}
                        onChange={handleChange}
                        required
                      />
                      <FieldError errors={fieldErrors} field="first_name" />
                    </div>

                    <div className="col-md-4 mb-3" ref={setFieldRef("middle_name")}>
                      <label className="form-label">
                        Middle Name
                      </label>

                      <input
                        name="middleName"
                        className="form-control"
                        placeholder="Middle Name"
                        value={form.middleName}
                        onChange={handleChange}
                      />
                      <FieldError errors={fieldErrors} field="middle_name" />
                    </div>

                    <div className="col-md-4 mb-3" ref={setFieldRef("last_name")}>
                      <label className="form-label">
                        Last Name{" "}
                        <span className="text-danger">
                          *
                        </span>
                      </label>

                      <input
                        name="lastName"
                        className="form-control"
                        placeholder="Last Name"
                        value={form.lastName}
                        onChange={handleChange}
                        required
                      />
                      <FieldError errors={fieldErrors} field="last_name" />
                    </div>
                  </div>

                  <div className="row">
                    <div className="col-md-6 mb-3" ref={setFieldRef("mobile_number")}>
                      <label className="form-label">
                        Mobile Number
                      </label>

                      <input
                        name="mobile"
                        className="form-control"
                        placeholder="Mobile Number"
                        value={form.mobile}
                        onChange={handleChange}
                      />
                      <FieldError errors={fieldErrors} field="mobile_number" />
                    </div>

                    <div className="col-md-6 mb-3" ref={setFieldRef("email")}>
                      <label className="form-label">
                        Email{" "}
                        <span className="text-danger">
                          *
                        </span>
                      </label>

                      <div
                        style={{
                          position: "relative",
                        }}
                      >
                        <input
                          type="email"
                          name="email"
                          className="form-control"
                          placeholder="Email"
                          value={form.email}
                          onChange={handleChange}
                          required
                          style={{
                            paddingRight: "32px",
                          }}
                        />

                        <span
                          title="Please use an active email address. We'll send verification and important notifications to this email."
                          style={{
                            position: "absolute",
                            right: "10px",
                            top: "50%",
                            transform:
                              "translateY(-50%)",
                            cursor: "help",
                            color: "#5100ff",
                            fontSize: "18px",
                          }}
                        >
                          i
                        </span>
                      </div>
                      <FieldError errors={fieldErrors} field="email" />
                    </div>
                  </div>

                  <div className="row">
                    <div className="col-md-6 mb-3" ref={setFieldRef("birthdate")}>
                      <label className="form-label">
                        Date of Birth{" "}
                        <span className="text-danger">
                          *
                        </span>
                      </label>

                      <input
                        type="date"
                        name="birthdate"
                        className="form-control"
                        value={form.birthdate}
                        onChange={handleChange}
                        required
                      />
                      <FieldError errors={fieldErrors} field="birthdate" />
                    </div>

                    <div className="col-md-6 mb-3">
                      <label className="form-label">
                        Barangay
                      </label>

                      <input
                        className="form-control"
                        value="Mamatid"
                        disabled
                      />

                      <div className="form-text">
                        This Educational Assistance
                        Program is only exclusive for
                        residents of Barangay Mamatid.
                      </div>
                    </div>
                  </div>

                  <div className="mb-3">
                    <label className="form-label">
                      Valid ID{" "}
                      <span className="text-danger">
                        *
                      </span>
                    </label>

                    <p className="text-muted small mb-2">
                      Upload a clear photo of a
                      government-issued or school ID
                      showing your face. We'll ask you
                      to take a live photo next to
                      confirm it's really you.
                    </p>

                    <input
                      type="file"
                      ref={idFileInputRef}
                      accept="image/jpeg,image/png,image/jpg"
                      onChange={handleIdChange}
                      required
                      style={{ display: "none" }}
                    />

                    <div
                      className="document-upload-picker"
                      onClick={() => idFileInputRef.current?.click()}
                    >
                      <span className="document-upload-button">
                        Choose File
                      </span>

                      <span
                        className={`document-upload-filename ${
                          idImage ? "has-file" : ""
                        }`}
                      >
                        {idImage ? idImage.name : "No file chosen"}
                      </span>
                    </div>

                    {idPreview && (
                      <img
                        src={idPreview}
                        alt="ID preview"
                        className="mt-2 rounded border"
                        style={{
                          maxWidth: "260px",
                          maxHeight: "180px",
                          objectFit: "contain",
                        }}
                      />
                    )}
                  </div>

                  <div className="mb-3" ref={setFieldRef("password")}>
                    <label className="form-label">
                      Password{" "}
                      <span className="text-danger">*</span>
                    </label>

                    <div className="register-input-wrap">
                      <input
                        type={showPass ? "text" : "password"}
                        name="password"
                        className="form-control register-input-eye"
                        placeholder="Min 8 characters, with a lowercase letter and a number"
                        value={form.password}
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
                            <path
                              d="M17.94 17.94A10.94 10.94 0 0112 20c-7 0-11-8-11-8a18.5 18.5 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                            <line x1="1" y1="1" x2="23" y2="23" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        ) : (
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path
                              d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                            <circle cx="12" cy="12" r="3" />
                          </svg>
                        )}
                      </button>
                    </div>

                    <FieldError errors={fieldErrors} field="password" />

                    <div className="register-password-requirements">
                      <span className="register-password-requirements-title">PASSWORD REQUIREMENTS</span>
                      <div className="register-password-requirement-item">
                        <span>{form.password.length >= 8 ? "✓" : "○"}</span>
                        <p>At least 8 characters</p>
                      </div>
                      <div className="register-password-requirement-item">
                        <span>
                          {/[a-z]/.test(form.password) ? "✓" : "○"}
                        </span>
                        <p>A lowercase letter</p>
                      </div>
                      <div className="register-password-requirement-item">
                        <span>{/\d/.test(form.password) ? "✓" : "○"}</span>
                        <p>At least one number</p>
                      </div>
                    </div>
                  </div>

                  <div className="mb-3">
                    <label className="form-label">
                      Confirm Password{" "}
                      <span className="text-danger">*</span>
                    </label>

                    <div className="register-input-wrap">
                      <input
                        type={showConfirm ? "text" : "password"}
                        name="confirmPassword"
                        className="form-control register-input-eye"
                        placeholder="Confirm Password"
                        value={form.confirmPassword}
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
                            <path
                              d="M17.94 17.94A10.94 10.94 0 0112 20c-7 0-11-8-11-8a18.5 18.5 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                            <line x1="1" y1="1" x2="23" y2="23" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        ) : (
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path
                              d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                            <circle cx="12" cy="12" r="3" />
                          </svg>
                        )}
                      </button>
                    </div>

                    {form.confirmPassword &&
                      (form.password === form.confirmPassword ? (
                        <span className="register-password-match">✓ Passwords match</span>
                      ) : (
                        <span className="register-password-match" style={{ color: "#dc3545" }}>
                          ✕ Passwords do not match
                        </span>
                      ))}
                  </div>

                  <div className="mb-3 form-check">
                    <input
                      type="checkbox"
                      className="form-check-input"
                      id="agreePrivacy"
                      checked={agreePrivacy}
                      onChange={(e) => {
                        setAgreePrivacy(e.target.checked);
                        setGeneralError("");
                      }}
                      required
                    />
                    <label className="form-check-label" htmlFor="agreePrivacy">
                      I have read and agree to the{" "}
                      <button
                        type="button"
                        className="register-privacy-link"
                        onClick={() => setShowPrivacyModal(true)}
                      >
                        Data Privacy Notice
                      </button>
                      .{" "}
                      <span className="text-danger">*</span>
                    </label>
                  </div>

                  <button
                    className="btn btn-danger w-100"
                    type="submit"
                    disabled={loading || !agreePrivacy}
                    title={
                      !agreePrivacy
                        ? "Please agree to the Data Privacy Notice first"
                        : undefined
                    }
                  >
                    {loading ? "Checking..." : "Next: Verify Identity"}
                  </button>

                  <p className="text-center mt-3">
                    Already have an account?{" "}
                    <a href="/login">
                      Login
                    </a>
                  </p>
                </form>
              </div>
            </div>
          </div>
        </div>
      </section>

      {showPrivacyModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "20px",
            background: "rgba(17, 24, 39, 0.48)",
            backdropFilter: "blur(3px)",
            WebkitBackdropFilter: "blur(3px)",
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: "560px",
              maxHeight: "80vh",
              overflowY: "auto",
              padding: "28px 26px",
              borderRadius: "16px",
              background: "#fff",
              border: "1px solid #e5e7eb",
              boxShadow: "0 24px 60px rgba(0, 0, 0, 0.22)",
              fontFamily: "'Inter', sans-serif",
            }}
          >
            <h4 className="text-danger mb-3" style={{ fontWeight: 700 }}>
              Data Privacy Notice
            </h4>

            <p style={{ fontSize: "13px", color: "#374151", lineHeight: 1.7 }}>
              In accordance with the Data Privacy Act of 2012 (RA 10173),
              SK Barangay Mamatid collects your personal information
              (name, birthdate, contact details, valid ID, and photo)
              solely for the purpose of processing your application for
              the Educational Assistance Program. Your uploaded ID and
              live photo will be used strictly for identity verification
              and may be referenced by SK staff during claiming.
            </p>

            <p style={{ fontSize: "13px", color: "#374151", lineHeight: 1.7 }}>
              Your data will not be shared with third parties without
              your consent, except when required by law. You may
              request access, correction, or deletion of your data by
              contacting the SK office.
            </p>

            <div className="d-flex justify-content-end gap-2 mt-3">
              <button
                type="button"
                className="btn btn-outline-secondary"
                onClick={() => setShowPrivacyModal(false)}
              >
                Close
              </button>

              <button
                type="button"
                className="btn btn-danger"
                onClick={() => {
                  setAgreePrivacy(true);
                  setShowPrivacyModal(false);
                }}
              >
                I Agree
              </button>
            </div>
          </div>
        </div>
      )}

      <Footer />
    </>
  );
};

export default Register;