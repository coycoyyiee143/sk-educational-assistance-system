import { useAuth } from "../../context/AuthContext";
import { useUserPhoto } from "../../hooks/useUserPhoto";

function ApplicantTopbarUser() {
  const { user } = useAuth();

  // The applicant's own uploaded 2x2 reference photo, not the live
  // camera capture from face verification.
  const { url: facePhotoUrl, status: photoStatus } = useUserPhoto(user?.id);
  const photoLoading = photoStatus === "loading";

  const fullName = [
    user?.first_name,
    user?.middle_name,
    user?.last_name,
  ]
    .filter(Boolean)
    .join(" ")
    .toUpperCase();

  return (
    <div className="applicant-topbar-user-card">
      <div className="applicant-topbar-photo-wrap">
        {photoLoading ? (
          <div className="applicant-topbar-photo applicant-topbar-photo-loading">
            <div
              className="spinner-border spinner-border-sm text-danger"
              role="status"
            />
          </div>
        ) : (
          <img
            src={facePhotoUrl || "/logo.png"}
            alt="Applicant"
            className={`applicant-topbar-photo ${
              facePhotoUrl ? "" : "applicant-topbar-photo-fallback"
            }`}
          />
        )}
      </div>

      <div className="applicant-topbar-user-info">
        <span className="applicant-topbar-user-name">
          {fullName || "Applicant"}
        </span>

        <span className="applicant-topbar-user-role">
          Applicant
        </span>
      </div>
    </div>
  );
}

export default ApplicantTopbarUser;