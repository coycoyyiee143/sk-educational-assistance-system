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
function AdminTopbarUser() {
  const { user } = useAuth();
  const name = user ? `${user.first_name} ${user.last_name}` : "Admin User";
  const roleLabel = ROLE_LABELS[user?.role] ?? "Sangguniang Kabataan";

  return (
    <div className="admin-topbar-user">
      <div className="admin-topbar-user-text">
        <span className="admin-topbar-user-name">{name}</span>
        <span className="admin-topbar-user-role">{roleLabel}</span>
      </div>
      <div className="admin-topbar-avatar"></div>
    </div>
  );
}

export default AdminTopbarUser;
