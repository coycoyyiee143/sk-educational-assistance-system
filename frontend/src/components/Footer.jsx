import React from "react";
const Footer = () => {
  return (
    <footer className="site-footer">
      <div className="container">
        <div className="footer-top row gy-4">
          <div className="col-lg-3 col-md-6">
            <img src="/logo.png" alt="SK Logo" className="footer-logo" />
            <p className="footer-desc">
              Sangguniang Kabataan of Barangay Mamatid leads the charge in
              supporting the education of our local youth through the SK
              Educational Assistance Program, streamlining applications,
              verification, and claiming for every deserving student.
            </p>
          </div>
          <div className="col-lg-9 d-flex flex-wrap justify-content-end footer-links-group">
            <div className="footer-links-col">
              <h6 className="footer-heading">Site Links</h6>
              <ul className="footer-links">
                <li><a href="/">Home</a></li>
                <li><a href="/requirements">Requirements</a></li>
                <li><a href="/announcements">Announcements</a></li>
                <li><a href="/events">Events</a></li>
              </ul>
            </div>
            <div className="footer-links-col">
              <h6 className="footer-heading">Account</h6>
              <ul className="footer-links">
                <li><a href="/login">Login</a></li>
                <li><a href="/register">Register</a></li>
              </ul>
            </div>
            <div className="footer-links-col">
              <h6 className="footer-heading">Connect With Us</h6>
              <div className="footer-socials mb-4">
                <a href="#" aria-label="Facebook" className="footer-social-icon footer-social-fb">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M22 12.06C22 6.5 17.52 2 12 2S2 6.5 2 12.06c0 5 3.66 9.15 8.44 9.94v-7.03H7.9v-2.91h2.54V9.85c0-2.51 1.49-3.9 3.77-3.9 1.09 0 2.24.2 2.24.2v2.46h-1.26c-1.24 0-1.63.77-1.63 1.56v1.89h2.78l-.44 2.91h-2.34V22c4.78-.79 8.44-4.94 8.44-9.94z"/>
                  </svg>
                </a>
                <a href="#" aria-label="Instagram" className="footer-social-icon footer-social-ig">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect>
                    <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path>
                    <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line>
                  </svg>
                </a>
              </div>
              <p className="footer-address mb-2 footer-contact-line">
                <span className="footer-contact-icon-wrap">
                  <svg className="footer-contact-icon" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5A2.5 2.5 0 1112 6.5a2.5 2.5 0 010 5z"/>
                  </svg>
                </span>
                <span>Barangay Mamatid Hall,<br />Cabuyao City, Laguna</span>
              </p>
              <p className="footer-address mb-2 footer-contact-line">
                <span className="footer-contact-icon-wrap">
                  <svg className="footer-contact-icon" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/>
                  </svg>
                </span>
                <span>contact@skbgy-mamatid.gov.ph</span>
              </p>
              <p className="footer-address mb-0 footer-contact-line">
                <span className="footer-contact-icon-wrap">
                  <svg className="footer-contact-icon" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z"/>
                  </svg>
                </span>
                <span>Tel: (049) 123-4567</span>
              </p>
            </div>
          </div>
        </div>
        <hr className="footer-divider" />
        <div className="footer-bottom">
          <div className="footer-bottom-row">
            <p className="footer-copyright mb-0">
              &copy; 2026 Sangguniang Kabataan of Barangay Mamatid. All Rights Reserved.
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
};
export default Footer;