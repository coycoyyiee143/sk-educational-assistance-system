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
              <div className="footer-socials mb-3">
                <a href="#" aria-label="Facebook" className="footer-social-icon">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M22 12.06C22 6.5 17.52 2 12 2S2 6.5 2 12.06c0 5 3.66 9.15 8.44 9.94v-7.03H7.9v-2.91h2.54V9.85c0-2.51 1.49-3.9 3.77-3.9 1.09 0 2.24.2 2.24.2v2.46h-1.26c-1.24 0-1.63.77-1.63 1.56v1.89h2.78l-.44 2.91h-2.34V22c4.78-.79 8.44-4.94 8.44-9.94z"/>
                  </svg>
                </a>
                <a href="#" aria-label="Instagram" className="footer-social-icon">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect>
                    <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path>
                    <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line>
                  </svg>
                </a>
              </div>
              <p className="footer-address mb-0">
                Barangay Mamatid Hall,<br />
                Cabuyao City, Laguna
              </p>
            </div>
          </div>
        </div>

        <hr className="footer-divider" />

        <div className="footer-bottom">
          <p className="footer-attribution">
            A project of the Sangguniang Kabataan of Barangay Mamatid, Cabuyao
            City, Laguna &mdash; developed to modernize and simplify the
            Educational Assistance Program for the benefit of local youth.
          </p>
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