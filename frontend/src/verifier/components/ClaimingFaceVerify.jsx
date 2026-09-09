import { useEffect, useState } from "react";
import FaceCapture from "../../applicant/components/FaceCapture";
import api from "../../services/api";
function ClaimingFaceVerify({ applicationId, required = false, registrationPhotoUrl = null, registrationPhotoStatus = "idle" }) {
  const [result, setResult] = useState(null);
  const [showCapture, setShowCapture] = useState(false);
  useEffect(() => {
    if (!applicationId) return;
    let objectUrl = null;
    let cancelled = false;
    setResult(null);
    api.get(`/verifier/claiming/${applicationId}/face-verification`)
      .then(async (res) => {
        if (cancelled || res.data.status !== "verified" || !res.data.photo_url) return;
        const photoRes = await api.get(res.data.photo_url, { responseType: "blob" });
        if (cancelled) return;
        objectUrl = URL.createObjectURL(photoRes.data);
        setResult({
          match: res.data.match,
          score: res.data.score,
          photoUrl: objectUrl,
        });
      })
      .catch(() => {
        if (!cancelled) setResult(null);
      });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [applicationId]);
  function closeCaptureModal() {
    setShowCapture(false);
  }
  return (
    <div className="verifier-claiming-face-verify">
      <div className="verifier-claiming-photo-compare">
        <div className="verifier-claiming-compare-card">
          <div className="verifier-claiming-compare-image-wrap">
            {registrationPhotoStatus === "ready" && registrationPhotoUrl ? (
              <img src={registrationPhotoUrl} alt="Registered reference" className="verifier-claiming-compare-image" />
            ) : registrationPhotoStatus === "loading" ? (
              <div className="verifier-claiming-compare-placeholder"><div className="spinner-border spinner-border-sm text-secondary" role="status" /></div>
            ) : (
              <div className="verifier-claiming-compare-placeholder"><span>No data</span></div>
            )}
            <span className="verifier-claiming-photo-overlay">Registered Reference</span>
          </div>
          <span className="verifier-claiming-photo-caption">Online Portal Upload</span>
        </div>
        <div className={`verifier-claiming-compare-card ${result?.match ? "verifier-claiming-compare-card-match" : result && !result.match ? "verifier-claiming-compare-card-mismatch" : ""}`}>
          <div className="verifier-claiming-compare-image-wrap">
            {result?.photoUrl ? (
              <img src={result.photoUrl} alt="Claiming-day live capture" className="verifier-claiming-compare-image" />
            ) : (
              <div className="verifier-claiming-compare-placeholder"><span>Waiting for capture</span></div>
            )}
            <span className="verifier-claiming-photo-overlay verifier-claiming-photo-overlay-live">Live Capture</span>
          </div>
          <button type="button" className="verifier-claiming-photo-caption verifier-claiming-photo-caption-retake" onClick={() => setShowCapture(true)}>Retake Photo</button>
        </div>
      </div>
      {result && (
        <div className="verifier-claiming-face-result verifier-claiming-face-result-match">
          <i className="bi bi-check-circle-fill"></i>
          <span><strong>Photo Captured</strong> — Please verify the applicant.</span>
        </div>
      )}
      {!result && (
        <div className="verifier-claiming-face-start">
          <button type="button" className="btn-save-green verifier-claiming-face-verify-btn" onClick={() => setShowCapture(true)}>Verify Applicant&apos;s Face</button>
          {required && <div className="form-text text-danger mt-1">Required before this applicant can be marked Claimed during grace period.</div>}
        </div>
      )}
      {showCapture && (
        <div className="verifier-face-modal-backdrop" onClick={closeCaptureModal}>
          <div className="verifier-face-modal" onClick={(e) => e.stopPropagation()}>
            <div className="verifier-face-modal-header">
              <div className="verifier-face-modal-heading">
                <span className="verifier-face-modal-icon"><i className="bi bi-camera"></i></span>
                <div>
                  <h5>Face Verification</h5>
                  <span>Capture Applicant&apos;s Face</span>
                </div>
              </div>
              <button type="button" className="verifier-face-modal-close" onClick={closeCaptureModal} aria-label="Close face verification">×</button>
            </div>
            <div className="verifier-face-modal-body">
              <div className="verifier-face-modal-capture">
                <FaceCapture mode="claiming" applicationId={applicationId} includeLocalPreview={true} onSuccess={(data) => {
                  setResult({ match: data.match, score: data.score, photoUrl: data.local_photo_url || data.photo_url });
                  setShowCapture(false);
                }} />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
export default ClaimingFaceVerify