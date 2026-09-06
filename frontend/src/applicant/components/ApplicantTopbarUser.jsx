import { useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import api from "../../services/api";

function ApplicantTopbarUser() {
  const { user } = useAuth();

  const [facePhotoUrl, setFacePhotoUrl] = useState(null);
  const [photoLoading, setPhotoLoading] = useState(true);

  useEffect(() => {
    let objectUrl = null;

    api
      .get("/face-verification")
      .then((res) => {
        if (res.data.photo_url) {
          return api.get(res.data.photo_url, {
            responseType: "blob",
          });
        }

        return null;
      })
      .then((photoRes) => {
        if (photoRes) {
          objectUrl = URL.createObjectURL(photoRes.data);
          setFacePhotoUrl(objectUrl);
        }
      })
      .catch(() => {
        setFacePhotoUrl(null);
      })
      .finally(() => {
        setPhotoLoading(false);
      });

    return () => {
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, []);

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