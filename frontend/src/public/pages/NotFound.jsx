import React from "react";
import { useNavigate } from "react-router-dom";
import Footer from "../../components/Footer";

export default function NotFound() {
  const navigate = useNavigate();

  return (
    <>
      <nav className="navbar navbar-expand-lg sticky-top navbar-custom">
        <div className="container">
          <a className="navbar-brand navbar-brand-custom" href="/">
            <img src="/icons/sk-logo.jpg" alt="SK Logo" />

            <div className="brand-text">
              <h5>SK Barangay Mamatid</h5>
              <span>Educational Assistance System</span>
            </div>
          </a>
        </div>
      </nav>

      <main
        className="py-5"
        style={{
          minHeight: "calc(100vh - 80px)",
          background: "#f5f6f8",
        }}
      >
        <div className="container">
          <div className="row justify-content-center">
            <div className="col-xl-5 col-lg-6 col-md-8">
              <div
                className="card card-custom border-0"
                style={{
                  borderRadius: "18px",
                  boxShadow: "0 10px 35px rgba(0, 0, 0, 0.08)",
                  overflow: "hidden",
                }}
              >
                <div className="p-4 p-md-5">
                  <div className="text-center mb-4">
                    <img
                      src="/icons/sk-logo.jpg"
                      alt="SK Barangay Mamatid"
                      style={{
                        width: "68px",
                        height: "68px",
                        objectFit: "contain",
                      }}
                    />
                  </div>

                  <div className="text-center mb-4">
                    <h3
                      className="mb-2"
                      style={{
                        fontFamily: "'Hanken Grotesk', sans-serif",
                        fontWeight: 700,
                        color: "#222",
                      }}
                    >
                      Page Not Found
                    </h3>

                    <p
                      className="text-muted mb-0"
                      style={{
                        fontSize: "14px",
                        lineHeight: 1.6,
                      }}
                    >
                      The page you're looking for doesn't exist or may have
                      been moved.
                    </p>
                  </div>

                  <div className="visibility-notice">
                    <div className="visibility-notice-icon">!</div>

                    <div className="visibility-notice-body">
                      <strong className="visibility-notice-title">
                        Broken or Invalid Link
                      </strong>

                      <p className="visibility-notice-text">
                        Please check the web address, or use the button below
                        to return to a page that exists.
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    className="btn w-100 d-flex align-items-center justify-content-center gap-2 mt-4"
                    onClick={() => navigate("/")}
                    style={{
                      minHeight: "48px",
                      border: "none",
                      borderRadius: "10px",
                      background: "#b71c1c",
                      color: "#fff",
                      fontSize: "14px",
                      fontWeight: 600,
                      boxShadow: "0 4px 12px rgba(183, 28, 28, 0.18)",
                    }}
                  >
                    Back to Home
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </>
  );
}
