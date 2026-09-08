import React from "react";

const Footer = () => {
  return (
    <footer className="site-footer">
      <div className="container">
        <div className="footer-top row gy-4">

          {/* BRAND / DESCRIPTION */}
          <div className="col-lg-3 col-md-6">
            <img
              src="/icons/sk-logo.jpg"
              alt="SK Logo"
              className="footer-logo"
            />

            <p className="footer-desc">
              Sangguniang Kabataan of Barangay Mamatid leads the charge in
              supporting the education of our local youth through the SK
              Educational Assistance Program, streamlining applications,
              verification, and claiming for every deserving student.
            </p>
          </div>

          {/* FOOTER LINKS */}
          <div className="col-lg-9 d-flex flex-wrap justify-content-end footer-links-group">

            {/* SITE LINKS */}
            <div className="footer-links-col">
              <h6 className="footer-heading">Site Links</h6>

              <ul className="footer-links">
                <li>
                  <a href="/">Home</a>
                </li>

                <li>
                  <a href="/requirements">Requirements</a>
                </li>

                <li>
                  <a href="/announcements">Announcements</a>
                </li>

                <li>
                  <a href="/events">Events</a>
                </li>
              </ul>
            </div>

            {/* ACCOUNT */}
            <div className="footer-links-col">
              <h6 className="footer-heading">Account</h6>

              <ul className="footer-links">
                <li>
                  <a href="/login">Login</a>
                </li>

                <li>
                  <a href="/register">Register</a>
                </li>
              </ul>
            </div>

            {/* CONNECT WITH US */}
            <div className="footer-links-col">
              <h6 className="footer-heading">Connect With Us</h6>

              {/* SOCIAL MEDIA */}
              <div className="footer-socials">

                {/* FACEBOOK */}
                <a
                  href="https://web.facebook.com/sk.mamatid"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Facebook"
                  className="footer-social-icon"
                >
                  <svg
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    aria-hidden="true"
                  >
                    <path d="M13.5 22v-8h2.8l.4-3.2h-3.2V8.7c0-.9.3-1.6 1.7-1.6h1.7V4.2c-.3 0-1.4-.2-2.6-.2-2.6 0-4.4 1.6-4.4 4.5v2.3H7v3.2h2.9v8h3.6z" />
                  </svg>
                </a>

                {/* INSTAGRAM */}
                <a
                  href="https://www.instagram.com/sk.mamatid"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Instagram"
                  className="footer-social-icon"
                >
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <rect
                      x="3"
                      y="3"
                      width="18"
                      height="18"
                      rx="5"
                    />

                    <circle cx="12" cy="12" r="4" />

                    <circle
                      cx="17.5"
                      cy="6.5"
                      r="1"
                      fill="currentColor"
                      stroke="none"
                    />
                  </svg>
                </a>
              </div>

              {/* LOCATION */}
              <a
                href="https://maps.app.goo.gl/VBDyvAqWqpxTicpy8?g_st=ac"
                target="_blank"
                rel="noopener noreferrer"
                className="footer-contact-line"
              >
                <span className="footer-contact-icon-wrap">
                  <svg
                    className="footer-contact-icon"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z" />
                    <circle cx="12" cy="10" r="2.5" />
                  </svg>
                </span>

                <span>
                  Barangay Mamatid Hall,
                  <br />
                  Cabuyao City, Laguna
                </span>
              </a>

              {/* EMAIL */}
              <a
                href="mailto:contact@skbgy-mamatid.gov.ph"
                className="footer-contact-line"
              >
                <span className="footer-contact-icon-wrap">
                  <svg
                    className="footer-contact-icon"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <rect
                      x="3"
                      y="5"
                      width="18"
                      height="14"
                      rx="3"
                    />

                    <path d="m5 8 7 5 7-5" />
                  </svg>
                </span>

                <span>contact@skbgy-mamatid.gov.ph</span>
              </a>

              {/* TELEPHONE */}
              <a
                href="tel:+63491234567"
                className="footer-contact-line"
              >
                <span className="footer-contact-icon-wrap">
                  <svg
                    className="footer-contact-icon"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M7.5 4H5.2A1.2 1.2 0 0 0 4 5.2C4 13.4 10.6 20 18.8 20a1.2 1.2 0 0 0 1.2-1.2v-2.3l-4-1-1.2 2a14.7 14.7 0 0 1-8.3-8.3l2-1.2-1-4Z" />
                  </svg>
                </span>

                <span>Tel: (049) 123-4567</span>
              </a>
            </div>
          </div>
        </div>

        {/* DIVIDER */}
        <hr className="footer-divider" />

        {/* COPYRIGHT */}
        <div className="footer-bottom">
          <div className="footer-bottom-row">
            <p className="footer-copyright mb-0">
              &copy; 2026 Sangguniang Kabataan of Barangay Mamatid. All Rights
              Reserved.
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;