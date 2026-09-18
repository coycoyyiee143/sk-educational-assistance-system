import { useAuth } from "../../context/AuthContext";

const ROLE_LABELS = {
  sk_admin: "Admin",
  sk_verifier: "Verifier",
  superadmin: "Superadmin",
  it_support: "IT Support",
};

// Shared topbar identity block — shows the actual logged-in user's name
// and role instead of a static placeholder, so it stays correct across
// all four personnel roles (sk_admin, sk_verifier, superadmin, it_support).
//
// Also renders the mobile hamburger button (position: fixed, styled by
// .admin-mobile-menu-btn) — this is the only place it's rendered, so
// every admin page gets it just by using this component. Pass
// onMenuOpen to wire it to the page's AdminNavigation mobileOpen state,
// same pattern as VerifierTopbar/VerifierNavigation.
function AdminTopbarUser({ onMenuOpen }) {
  const { user } = useAuth();
  const name = user ? `${user.first_name} ${user.last_name}` : "Admin User";
  const roleLabel = ROLE_LABELS[user?.role] ?? "Sangguniang Kabataan";

  return (
    <div className="admin-topbar-user">
      {onMenuOpen && (
        <button
          type="button"
          className="admin-mobile-menu-btn"
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
      )}
      <div className="admin-topbar-user-text">
        <span className="admin-topbar-user-name">{name}</span>
        <span className="admin-topbar-user-role">{roleLabel}</span>
      </div>
      <div className="admin-topbar-avatar"></div>
    </div>
  );
}

export default AdminTopbarUser;
