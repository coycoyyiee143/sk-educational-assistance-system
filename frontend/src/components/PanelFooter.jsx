import { Link } from "react-router-dom";

function PanelFooter() {
  return (
    <footer className="panel-footer">
      <Link to="/AdminDashboard" className="panel-footer-brand">
        <img src="/logo.png" alt="logo" className="panel-footer-logo" />
        <span className="panel-footer-text">SK Portal</span>
      </Link>
      <p className="panel-footer-copyright">
        © 2026 Sangguniang Kabataan of Barangay Mamatid. All Rights Reserved.
      </p>
    </footer>
  );
}

export default PanelFooter;