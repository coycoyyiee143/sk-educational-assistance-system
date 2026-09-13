function VerifierTopbar({ onMenuOpen }) {
  return (
    <div className="verifier-topbar">
      <button
        type="button"
        className="verifier-mobile-menu-btn"
        onClick={onMenuOpen}
        aria-label="Open navigation menu"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        >
          <path d="M4 6h16" />
          <path d="M4 12h16" />
          <path d="M4 18h16" />
        </svg>
      </button>

      <div className="verifier-topbar-user">
        <div className="verifier-topbar-user-text">
          <span className="verifier-topbar-user-name">
            Verifier User
          </span>

          <span className="verifier-topbar-user-role">
            Sangguniang Kabataan
          </span>
        </div>

        <div className="verifier-topbar-avatar"></div>
      </div>
    </div>
  );
}

export default VerifierTopbar;