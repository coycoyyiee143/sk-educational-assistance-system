import { useRef, useState, useCallback, useEffect } from "react";
import Webcam from "react-webcam";
import * as faceapi from "face-api.js";
import api from "../../services/api";

const MODEL_URL = "/models";

const STABLE_FRAMES_REQUIRED = 10;
const DETECTION_INTERVAL_MS = 200;
const MAX_ID_SIZE_MB = 5;

// Blink liveness, calibrated per-user rather than a fixed absolute EAR —
// baseline (open-eye) EAR varies a lot by eye shape, camera angle, and
// lighting, so a fixed number is too strict for some faces and too loose
// for others. We sample the first few open-eye frames for a baseline, then
// watch for a relative drop-and-recover. Uses the FULL (non-tiny) landmark
// model — tiny trades away exactly the precision blink detection needs.
const EAR_BASELINE_SAMPLES = 4;
const EAR_CLOSED_RATIO = 0.78; // dips below 78% of baseline = closed
const EAR_OPEN_RATIO = 0.88; // back above 88% of baseline = reopened

let modelsLoadPromise = null;
async function loadModels() {
  if (!modelsLoadPromise) {
    modelsLoadPromise = (async () => {
      try {
        await faceapi.tf.setBackend("webgl");
        await faceapi.tf.ready();
      } catch {
        await faceapi.tf.setBackend("cpu");
        await faceapi.tf.ready();
      }
      await faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL);
      await faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL);
    })();
  }
  return modelsLoadPromise;
}

// EAR = (|p2-p6| + |p3-p5|) / (2*|p1-p4|), the standard 6-point eye-aspect-ratio.
function eyeAspectRatio(eye) {
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const vertical = dist(eye[1], eye[5]) + dist(eye[2], eye[4]);
  const horizontal = dist(eye[0], eye[3]);
  if (horizontal === 0) return 1;
  return vertical / (2 * horizontal);
}

// ---- Small inline icons (no extra dependency) -----------------------------
const IconCheck = (props) => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="3" {...props}>
    <path d="M4 12l5 5L20 6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const IconAlert = (props) => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" {...props}>
    <path d="M12 9v4M12 17h.01M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const IconCamera = (props) => (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" {...props}>
    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2Z" strokeLinecap="round" strokeLinejoin="round" />
    <circle cx="12" cy="13" r="4" />
  </svg>
);
const IconUpload = (props) => (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" {...props}>
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const IconRefresh = (props) => (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" {...props}>
    <path d="M21 12a9 9 0 1 1-3-6.7M21 4v5h-5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const IconEye = (props) => (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" {...props}>
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" strokeLinecap="round" strokeLinejoin="round" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

/**
 * Reusable face-verification capture step, with real-time face detection:
 * a guide oval with an animated progress ring, live status feedback, and
 * auto-capture once a face is centered and held steady — instead of just
 * a plain "Capture Photo" button.
 *
 * Registration mode additionally requires a real blink (calibrated,
 * relative-EAR liveness, full landmark model) before the stable-hold
 * counter starts, closing the "hold up a photo" spoof at account creation.
 * Claiming mode is unaffected.
 *
 * Falls back gracefully to a manual capture button whenever detection
 * can't run (models failed to load, browser incompatibility, etc.).
 *
 * Props: mode, applicationId, externalIdImage, onSuccess, onError,
 *        onSubmitCapture, submitLabel, disabled
 */
function FaceCapture({
  mode = "registration",
  applicationId = null,
  externalIdImage = null,
  onSuccess,
  onError,
  onSubmitCapture,
  submitLabel,
  disabled = false,
}) {
  const webcamRef = useRef(null);
  const detectionTimerRef = useRef(null);
  const stableCountRef = useRef(0);
  const blinkDoneRef = useRef(false);
  const sawClosedRef = useRef(false);
  const earBaselineRef = useRef(null);
  const earSamplesRef = useRef([]);

  const requireLiveness = mode === "registration";

  const [idImage, setIdImage] = useState(null);
  const [idPreview, setIdPreview] = useState(null);
  const [idError, setIdError] = useState("");

  const [livePreview, setLivePreview] = useState(null);
  const [liveBlob, setLiveBlob] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [errorKind, setErrorKind] = useState(null);

  const [cameraReady, setCameraReady] = useState(false);
  const [modelsReady, setModelsReady] = useState(false);
  const [modelsFailed, setModelsFailed] = useState(false);
  const [scanStatus, setScanStatus] = useState("loading");
  // loading | searching | positioning | tooClose | tooFar | blink | holding | captured | manual
  const [progress, setProgress] = useState(0);

  const showIdUpload = mode === "registration" && !externalIdImage;
  const effectiveIdImage = externalIdImage || idImage;

  function handleIdChange(e) {
    const file = e.target.files[0];
    if (!file) return;
    setIdError("");
    const validTypes = ["image/jpeg", "image/jpg", "image/png"];
    if (!validTypes.includes(file.type)) {
      setIdError("Please upload a JPG or PNG image.");
      e.target.value = "";
      return;
    }
    if (file.size > MAX_ID_SIZE_MB * 1024 * 1024) {
      setIdError(`File is too large. Please upload an image under ${MAX_ID_SIZE_MB}MB.`);
      e.target.value = "";
      return;
    }
    setIdImage(file);
    setIdPreview(URL.createObjectURL(file));
  }

  function attemptLoadModels() {
    setModelsFailed(false);
    setScanStatus("loading");
    loadModels()
      .then(() => {
        setModelsReady(true);
        setScanStatus("searching");
      })
      .catch(() => {
        modelsLoadPromise = null;
        setModelsFailed(true);
        setScanStatus("manual");
        setError("Couldn't load the face scanner. You can still capture manually below.");
        setErrorKind("models");
      });
  }

  useEffect(() => {
    attemptLoadModels();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const doCapture = useCallback(() => {
    if (!webcamRef.current) return;
    const screenshot = webcamRef.current.getScreenshot();
    if (!screenshot) {
      setError("Couldn't capture a photo. Please try again.");
      setErrorKind("camera");
      return;
    }
    setLivePreview(screenshot);
    setScanStatus("captured");
    setProgress(1);
    fetch(screenshot)
      .then((res) => res.blob())
      .then((blob) => setLiveBlob(blob));
  }, []);

  useEffect(() => {
    if (!modelsReady || !cameraReady || livePreview) return;

    detectionTimerRef.current = setInterval(async () => {
      const video = webcamRef.current?.video;
      if (!video || video.readyState !== 4) return;

      const needsLandmarks = requireLiveness && !blinkDoneRef.current;

      let detection;
      try {
        const base = faceapi.detectSingleFace(
          video,
          new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.5 })
        );
        detection = needsLandmarks ? await base.withFaceLandmarks() : await base;
      } catch (detectErr) {
        if (String(detectErr).includes("context")) {
          try {
            await faceapi.tf.setBackend("cpu");
            await faceapi.tf.ready();
          } catch {
            // ignore
          }
        }
        return;
      }

      if (!detection) {
        stableCountRef.current = 0;
        setProgress(0);
        setScanStatus("searching");
        return;
      }

      const box = detection.detection ? detection.detection.box : detection.box;
      const videoW = video.videoWidth;
      const videoH = video.videoHeight;

      const faceCenterX = box.x + box.width / 2;
      const faceCenterY = box.y + box.height / 2;
      const xOffset = Math.abs(faceCenterX - videoW / 2) / videoW;
      const yOffset = Math.abs(faceCenterY - videoH / 2) / videoH;
      const isCentered = xOffset < 0.15 && yOffset < 0.18;

      const faceWidthRatio = box.width / videoW;
      const isGoodSize = faceWidthRatio > 0.22 && faceWidthRatio < 0.62;

      if (!(isCentered && isGoodSize)) {
        stableCountRef.current = 0;
        setProgress(0);
        setScanStatus(faceWidthRatio >= 0.62 ? "tooClose" : faceWidthRatio <= 0.22 ? "tooFar" : "positioning");
        return;
      }

      // Framed correctly. Registration + no blink yet: hold on the blink
      // prompt instead of counting toward auto-capture.
      if (needsLandmarks) {
        const landmarks = detection.landmarks;
        if (!landmarks) {
          setScanStatus("blink");
          return;
        }
        const leftEAR = eyeAspectRatio(landmarks.getLeftEye());
        const rightEAR = eyeAspectRatio(landmarks.getRightEye());
        const avgEAR = (leftEAR + rightEAR) / 2;

        if (earBaselineRef.current === null) {
          earSamplesRef.current.push(avgEAR);
          if (earSamplesRef.current.length >= EAR_BASELINE_SAMPLES) {
            const sorted = [...earSamplesRef.current].sort((a, b) => a - b);
            earBaselineRef.current = sorted[Math.floor(sorted.length / 2)];
          }
          setScanStatus("blink");
          return;
        }

        const ratio = avgEAR / earBaselineRef.current;
        if (ratio < EAR_CLOSED_RATIO) {
          sawClosedRef.current = true;
        } else if (ratio > EAR_OPEN_RATIO && sawClosedRef.current) {
          blinkDoneRef.current = true;
        }
        setScanStatus("blink");
        return;
      }

      stableCountRef.current += 1;
      setProgress(Math.min(stableCountRef.current / STABLE_FRAMES_REQUIRED, 1));
      setScanStatus("holding");
      if (stableCountRef.current >= STABLE_FRAMES_REQUIRED) {
        clearInterval(detectionTimerRef.current);
        doCapture();
      }
    }, DETECTION_INTERVAL_MS);

    return () => clearInterval(detectionTimerRef.current);
  }, [modelsReady, cameraReady, livePreview, doCapture, requireLiveness]);

  function retake() {
    setLivePreview(null);
    setLiveBlob(null);
    stableCountRef.current = 0;
    blinkDoneRef.current = false;
    sawClosedRef.current = false;
    earBaselineRef.current = null;
    earSamplesRef.current = [];
    setProgress(0);
    setError("");
    setScanStatus(modelsFailed ? "manual" : "searching");
  }

  function handleCameraError(err) {
    let message = "Could not access your camera. Please check browser permissions.";
    if (err?.name === "NotAllowedError" || err?.name === "PermissionDeniedError") {
      message = "Camera access was denied. Please allow camera permission in your browser settings and reload the page.";
    } else if (err?.name === "NotFoundError" || err?.name === "DevicesNotFoundError") {
      message = "No camera was found on this device. Please connect a camera and try again.";
    } else if (err?.name === "NotReadableError") {
      message = "Your camera is being used by another app. Please close it and try again.";
    }
    setError(message);
    setErrorKind("camera");
  }

  async function handleSubmit() {
    setError("");
    if (mode === "registration" && !effectiveIdImage) {
      setError("A valid ID is required.");
      setErrorKind("submit");
      return;
    }
    if (!liveBlob) {
      setError("Please capture a live photo first.");
      setErrorKind("submit");
      return;
    }
    if (onSubmitCapture) {
      onSubmitCapture({ idImage: effectiveIdImage, liveBlob });
      return;
    }
    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append("live_photo", liveBlob, "live.jpg");
      let res;
      if (mode === "registration") {
        formData.append("id_image", effectiveIdImage);
        res = await api.post("/face-verification", formData);
      } else {
        res = await api.post(`/verifier/claiming/${applicationId}/verify-face`, formData);
      }
      onSuccess?.(res.data);
    } catch (err) {
      const message =
        err.response?.data?.message ||
        (err.request && !err.response
          ? "Couldn't reach the server. Please check your connection and try again."
          : "Face verification failed. Please make sure your face is clearly visible and try again.");
      setError(message);
      setErrorKind("submit");
      onError?.(message);
    } finally {
      setSubmitting(false);
    }
  }

  const isBusy = submitting || disabled;

  const STATUS_MAP = {
    loading: { text: "Loading face scanner...", color: "#94a3b8", dashed: true },
    searching: { text: "Position your face within the frame", color: "#dc3545", dashed: true },
    positioning: { text: "Center your face in the frame", color: "#f59e0b", dashed: true },
    tooClose: { text: "Move back a little", color: "#f59e0b", dashed: true },
    tooFar: { text: "Move a little closer", color: "#f59e0b", dashed: true },
    blink: { text: "Close your eyes for about 1 second, then open", color: "#3b82f6", dashed: false },
    holding: { text: "Hold still...", color: "#3b82f6", dashed: false },
    captured: { text: "Captured!", color: "#22c55e", dashed: false },
    manual: { text: "Position your face, then tap Capture", color: "#94a3b8", dashed: true },
  };
  const status = STATUS_MAP[scanStatus] || STATUS_MAP.searching;

  const R = 92;
  const CIRC = 2 * Math.PI * R;
  const dashOffset = CIRC * (1 - progress);

  return (
    <div className="face-capture">
      {error && (
        <div className="alert alert-danger d-flex align-items-start gap-2" role="alert">
          <IconAlert className="flex-shrink-0 mt-1" />
          <div className="flex-grow-1">
            <div>{error}</div>
            {errorKind === "models" && (
              <button
                type="button"
                className="btn btn-sm btn-outline-danger mt-2 d-inline-flex align-items-center gap-1"
                onClick={attemptLoadModels}
              >
                <IconRefresh /> Retry scanner
              </button>
            )}
          </div>
        </div>
      )}

      {showIdUpload && (
        <div className="mb-4">
          <label className="form-label fw-semibold d-flex align-items-center gap-2">
            <IconUpload /> Valid ID <span className="text-danger">*</span>
          </label>
          <p className="text-muted small mb-2">
            Upload a clear photo of a government-issued or school ID showing your face.
          </p>
          <input
            type="file"
            accept="image/jpeg,image/png,image/jpg"
            className={`form-control ${idError ? "is-invalid" : ""}`}
            onChange={handleIdChange}
            disabled={isBusy}
          />
          {idError && <div className="invalid-feedback d-block">{idError}</div>}
          {idPreview && (
            <div className="mt-2 d-inline-flex align-items-center gap-2 border rounded p-2 bg-light">
              <img
                src={idPreview}
                alt="ID preview"
                className="rounded"
                style={{ maxWidth: "140px", maxHeight: "90px", objectFit: "contain" }}
              />
              <span className="text-success small d-flex align-items-center gap-1">
                <IconCheck /> ID selected
              </span>
            </div>
          )}
        </div>
      )}

      <div className="mb-3">
        <label className="form-label fw-semibold d-flex align-items-center gap-2">
          <IconCamera />
          {mode === "registration" ? "Live Photo" : "Capture Applicant's Face"}{" "}
          <span className="text-danger">*</span>
        </label>

        {!livePreview ? (
          <div className="d-flex flex-column align-items-center align-items-sm-start">
            <div
              className="rounded-4 border overflow-hidden mb-2 position-relative mx-auto mx-sm-0"
              style={{ width: "100%", maxWidth: "360px", aspectRatio: "4 / 3", background: "#111" }}
            >
              <Webcam
                ref={webcamRef}
                audio={false}
                screenshotFormat="image/jpeg"
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
                onUserMedia={() => setCameraReady(true)}
                onUserMediaError={handleCameraError}
              />

              <svg
                viewBox="0 0 320 240"
                style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }}
              >
                <defs>
                  <mask id="ovalMask">
                    <rect width="320" height="240" fill="white" />
                    <ellipse cx="160" cy="118" rx="78" ry="98" fill="black" />
                  </mask>
                </defs>
                <rect width="320" height="240" fill="rgba(0,0,0,0.35)" mask="url(#ovalMask)" />

                <ellipse
                  cx="160"
                  cy="118"
                  rx="78"
                  ry="98"
                  fill="none"
                  stroke={status.color}
                  strokeWidth="3"
                  strokeDasharray={status.dashed ? "8 6" : "0"}
                  style={{ transition: "stroke 0.25s" }}
                />

                {scanStatus === "blink" && (
                  <ellipse
                    cx="160"
                    cy="118"
                    rx="78"
                    ry="98"
                    fill="none"
                    stroke="#3b82f6"
                    strokeWidth="3"
                    opacity="0.6"
                  >
                    <animate attributeName="rx" values="78;88;78" dur="1.2s" repeatCount="indefinite" />
                    <animate attributeName="ry" values="98;110;98" dur="1.2s" repeatCount="indefinite" />
                    <animate attributeName="opacity" values="0.6;0;0.6" dur="1.2s" repeatCount="indefinite" />
                  </ellipse>
                )}

                {progress > 0 && (
                  <ellipse
                    cx="160"
                    cy="118"
                    rx="78"
                    ry="98"
                    fill="none"
                    stroke="#22c55e"
                    strokeWidth="5"
                    strokeLinecap="round"
                    transform="rotate(-90 160 118)"
                    style={{
                      strokeDasharray: CIRC,
                      strokeDashoffset: dashOffset,
                      transition: "stroke-dashoffset 0.25s linear",
                    }}
                  />
                )}
              </svg>

              {scanStatus === "loading" && (
                <div className="d-flex align-items-center justify-content-center" style={{ position: "absolute", inset: 0 }}>
                  <div className="spinner-border text-light" role="status" style={{ width: "2rem", height: "2rem" }}>
                    <span className="visually-hidden">Loading...</span>
                  </div>
                </div>
              )}

              {scanStatus === "captured" && (
                <div
                  className="d-flex align-items-center justify-content-center"
                  style={{ position: "absolute", inset: 0, background: "rgba(34,197,94,0.25)" }}
                >
                  <div
                    className="rounded-circle bg-success d-flex align-items-center justify-content-center text-white"
                    style={{ width: "48px", height: "48px" }}
                  >
                    <IconCheck width={26} height={26} />
                  </div>
                </div>
              )}

              <div
                className="text-center text-white small py-2 fw-medium d-flex align-items-center justify-content-center gap-1"
                style={{ position: "absolute", bottom: 0, left: 0, right: 0, background: "rgba(0,0,0,0.55)" }}
              >
                {scanStatus === "blink" && <IconEye />}
                {status.text}
              </div>
            </div>

            {(scanStatus === "manual" || modelsFailed) && (
              <button
                type="button"
                className="btn btn-outline-danger d-inline-flex align-items-center gap-2"
                onClick={doCapture}
                disabled={!cameraReady || isBusy}
              >
                <IconCamera /> Capture Photo
              </button>
            )}

            {!modelsFailed && scanStatus !== "loading" && scanStatus !== "captured" && (
              <ul className="text-muted small mt-2 mb-0 ps-3">
                <li>Make sure you're in a well-lit area</li>
                <li>Remove sunglasses, masks, or anything covering your face</li>
                <li>Hold your device steady within the oval</li>
                {requireLiveness && (
                  <li>
                    You'll be asked to blink — close your eyes for about <strong>1 second</strong>, then open them
                  </li>
                )}
              </ul>
            )}
          </div>
        ) : (
          <div className="d-flex flex-column align-items-center align-items-sm-start">
            <div className="position-relative mb-2 mx-auto mx-sm-0" style={{ width: "100%", maxWidth: "360px" }}>
              <img
                src={livePreview}
                alt="Captured face"
                className="rounded-4 border w-100"
                style={{ aspectRatio: "4 / 3", objectFit: "cover" }}
              />
              <span className="position-absolute top-0 end-0 m-2 badge bg-success d-flex align-items-center gap-1">
                <IconCheck width={12} height={12} /> Captured
              </span>
            </div>
            <button
              type="button"
              className="btn btn-outline-secondary d-inline-flex align-items-center gap-2"
              onClick={retake}
              disabled={isBusy}
            >
              <IconRefresh /> Retake
            </button>
          </div>
        )}
      </div>

      <button
        type="button"
        className="btn btn-submit d-inline-flex align-items-center gap-2"
        onClick={handleSubmit}
        disabled={isBusy || !liveBlob || (mode === "registration" && !effectiveIdImage)}
      >
        {submitting && <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>}
        {submitLabel || (submitting ? "Verifying..." : "Verify Face")}
      </button>
    </div>
  );
}

export default FaceCapture;