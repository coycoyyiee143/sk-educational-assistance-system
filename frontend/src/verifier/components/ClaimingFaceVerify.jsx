import { useState } from "react";
import FaceCapture from "../../applicant/components/FaceCapture";

/**
 * Drop this into VerifierClaiming.jsx once an applicant has been searched
 * and `selected` (the application) is set, alongside the existing document
 * checks. It does NOT by itself mark the application as claimed — it just
 * gives the verifier a match/no-match signal, same role as the physical
 * document checks already on that page.
 *
 * Usage:
 *   <ClaimingFaceVerify applicationId={selected.id} />
 */
function ClaimingFaceVerify({ applicationId }) {
  const [result, setResult] = useState(null); // { match, score }
  const [showCapture, setShowCapture] = useState(false);

  if (result) {
    return (
      <div className={`alert ${result.match ? "alert-success" : "alert-danger"} d-flex justify-content-between align-items-center`}>
        <div>
          <strong>{result.match ? "Face Matched" : "Face Did Not Match"}</strong>
          {" — "}similarity score: {result.score}%
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
    );
  }

  if (!showCapture) {
    return (
      <button
        type="button"
        className="btn btn-outline-danger mb-3"
        onClick={() => setShowCapture(true)}
      >
        Verify Applicant's Face
      </button>
    );
  }

  return (
    <div className="content-card">
      <h5>Face Verification</h5>
      <FaceCapture
        mode="claiming"
        applicationId={applicationId}
        onSuccess={(data) => {
          setResult({ match: data.match, score: data.score });
          setShowCapture(false);
        }}
      />
    </div>
  );
}

export default ClaimingFaceVerify;