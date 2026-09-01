import { useState } from "react";
import FaceCapture from "../../applicant/components/FaceCapture";

/**
 * Drop this into VerifierClaiming.jsx once an applicant has been searched
 * and `selected` (the application) is set, alongside the existing document
 * checks.
 *
 * In regular claiming this is optional — the verifier's own call. 
 * In grace period claiming, backend now REQUIRES a passing match before `claimed`
 * can be confirmed, since a grace-period walk-in has no scheduled lane or
 * control-number structure backing up the identity check the way regular
 * claiming does.
 *
 * Usage:
 *   <ClaimingFaceVerify applicationId={selected.id} required={gracePeriodMode} />
 */
function ClaimingFaceVerify({ applicationId, required = false }) {
  const [result, setResult] = useState(null); // { match, score, photoUrl }
  const [showCapture, setShowCapture] = useState(false);

  if (result) {
    return (
      <div className={`alert ${result.match ? "alert-success" : "alert-danger"}`}>
        <div className="d-flex justify-content-between align-items-start gap-3">
          <div className="d-flex align-items-center gap-3">
            {result.photoUrl && (
              <img
                src={result.photoUrl}
                alt="Claiming-day capture"
                style={{ width: 64, height: 64, objectFit: "cover", borderRadius: "6px", border: "1px solid rgba(0,0,0,0.15)" }}
              />
            )}
            <div>
              <strong>{result.match ? "Face Matched" : "Face Did Not Match"}</strong>
              {" — "}similarity score: {result.score}%
            </div>
          </div>
          <button
            type="button"
            className="btn btn-sm btn-outline-secondary"
            onClick={() => {
              setResult(null);
              setShowCapture(true);
            }}
          >
            Re-check
          </button>
        </div>
      </div>
    );
  }

  if (!showCapture) {
    return (
      <div className="mb-3">
        <button
          type="button"
          className="btn btn-outline-danger"
          onClick={() => setShowCapture(true)}
        >
          Verify Applicant's Face
        </button>
        {required && (
          <div className="form-text text-danger mt-1">
            Required before this applicant can be marked Claimed during grace period.
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="content-card">
      <h5>Face Verification</h5>
      <FaceCapture
        mode="claiming"
        applicationId={applicationId}
        onSuccess={(data) => {
          setResult({ match: data.match, score: data.score, photoUrl: data.photo_url });
          setShowCapture(false);
        }}
      />
    </div>
  );
}

export default ClaimingFaceVerify;