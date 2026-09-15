import { useAuth } from "../../context/AuthContext";
import { useAvatarPhoto } from "../../hooks/useAvatarPhoto";

function VerifierTopbar({ onMenuOpen }) {
  const { user } = useAuth();
  const avatarUrl = useAvatarPhoto(user?.avatar_url);

  const fullName = [user?.first_name, user?.last_name]
    .filter(Boolean)
    .join(" ");

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
            {fullName || "Verifier User"}
          </span>

          <span className="verifier-topbar-user-role">
            Sangguniang Kabataan
          </span>
        </div>

        <div className="verifier-topbar-avatar">
          {avatarUrl && (
            <img
              src={avatarUrl}
              alt=""
              className="verifier-topbar-avatar-img"
            />
          )}
        </div>
      </div>
    </div>
  );
}

export default VerifierTopbar;