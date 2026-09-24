import { useState, useEffect } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import VerifierNavigation from "../components/VerifierNavigation";
import VerifierTopbar from "../components/VerifierTopbar";
import PanelFooter from "../../components/PanelFooter";
import api from "../../services/api";
import { useUserPhoto } from "../../hooks/useUserPhoto";
import { getVerifierStatusLabel, getVerifierBadgeClass } from "../../components/StatusConstants";
import {
  DOC_TYPES,
  getReasonsByDocType,
  getFlatReasons,
  GENERAL_REJECTION_REASONS,
  OTHER,
  getCheckDisplayLabel,
  translateFlagReason,
} from "../constants/verificationReasons";

// Builds the payload sent to the backend from one document's selections:
// `categories` (short, stable labels — used for admin reporting and to
// restore checkbox state later) and `messages` (the actual sentence the
// applicant receives, which differs between a reject and a re-upload for
// the same underlying reason — see `textKey`).
function buildDocReasonPayload(flatReasons, selectedIds, dynamicReasons, otherChecked, otherText, textKey) {
  const categories = [];
  const messages = [];
  flatReasons.forEach((r) => {
    if (selectedIds.includes(r.id)) {
      categories.push(r.verifierLabel);
      messages.push(r[textKey]);
    }
  });
  (dynamicReasons || []).forEach((d) => {
    if (d.checked) {
      categories.push(d.text);
      messages.push(d.text);
    }
  });
  if (otherChecked && otherText.trim()) {
    categories.push(otherText.trim());
    messages.push(otherText.trim());
  }
  return { categories, messages };
}

function emptyDocState() {
  return { checked: false, reasonIds: [], dynamicReasons: [], otherChecked: false, otherText: "" };
}

// Maps a failed automated check to one of the fixed reason ids a verifier
// would otherwise pick by hand, so a re-upload/reject request can be
// pre-filled with the same reason the system already flagged.
function mapCheckToReasonId(checkName, docType) {
  if (checkName === "identity_match") return "name_mismatch";
  if (checkName === "residency_geofence" && docType === "voters_certificate") return "not_mamatid_voter";
  if (checkName === "cert_year_match" && docType === "voters_certificate") return "not_current_year";
  if (checkName === "school_year_match" && docType === "registration_form") return "wrong_school_year";
  return null;
}

// Some automated checks flag a document not because something is
// confirmed wrong with it, but because the OCR read was too weak to
// trust either way ("...please verify manually", "...manual review") —
// these are instructions for the verifier to look closer, not a
// description of a document problem. They must never be offered as a
// selectable reason, since selecting one would send that verifier note
// straight to the applicant, who has no way to act on it.
function isVerifierOnlyNote(rawReason) {
  return !!rawReason && /verify manually|manual review/i.test(rawReason);
}

function getLatestDocsMap(app) {
  const latestDocsMap = {};
  (app?.documents || []).forEach((doc) => {
    if (
      !latestDocsMap[doc.document_type] ||
      doc.id > latestDocsMap[doc.document_type].id
    ) {
      latestDocsMap[doc.document_type] = doc;
    }
  });
  return latestDocsMap;
}

// For each document type, collects the failed checks / low-confidence
// flags on its latest upload so re-upload and reject requests can be
// pre-checked with the reasons the system already found, instead of the
// verifier having to re-derive them from the OCR panel. Checks that match
// a fixed reason come back as `matchedIds`; anything else that describes
// an actual document problem comes back as a `dynamicReasons` entry
// (translated to plain language, individually selectable); checks that
// are only asking the verifier to look closer (see isVerifierOnlyNote)
// come back as `verifierNotes` — informational only, never selectable,
// never sent to the applicant.
function getAutoDetectedFailures(app, reasonsByDocType) {
  const latestDocsMap = getLatestDocsMap(app);
  const result = {};

  DOC_TYPES.forEach(({ key: docType }) => {
    const doc = latestDocsMap[docType];
    const matchedIds = [];
    const dynamicReasons = [];
    const verifierNotes = [];

    if (!doc) {
      result[docType] = { matchedIds, dynamicReasons, verifierNotes };
      return;
    }

    if (doc.ocr_result?.is_low_confidence) {
      matchedIds.push("blurry");
    }

    (app.verification_checks || [])
      .filter((c) => c.document_id === doc.id && !c.passed)
      .forEach((c) => {
        if (isVerifierOnlyNote(c.flag_reason)) {
          verifierNotes.push({ checkLabel: getCheckDisplayLabel(c.check_name), message: c.flag_reason });
          return;
        }

        const matchedId = mapCheckToReasonId(c.check_name, docType);
        if (matchedId) {
          matchedIds.push(matchedId);
        } else {
          dynamicReasons.push({
            key: `check-${c.id}`,
            checkName: c.check_name,
            text: translateFlagReason(c.check_name, c.flag_reason),
            checked: true,
          });
        }
      });

    result[docType] = { matchedIds: [...new Set(matchedIds)], dynamicReasons, verifierNotes };
  });

  return result;
}

function getApprovalWarnings(app, incomingFlags) {
  if (!app) return [];

  const warnings = [];

  const latestDocsMap = getLatestDocsMap(app);

  const docLabelByType = Object.fromEntries(
    DOC_TYPES.map((d) => [d.key, d.label])
  );

  Object.entries(latestDocsMap).forEach(([docType, doc]) => {
    const docLabel = docLabelByType[docType] || docType;

    if (doc.ocr_result?.is_low_confidence) {
      warnings.push(`${docLabel}: Low OCR confidence`);
    }

    const checks = (app.verification_checks || []).filter(
      (c) => c.document_id === doc.id
    );
    checks
      .filter((c) => !c.passed)
      .forEach((c) => {
        const reason = translateFlagReason(c.check_name, c.flag_reason);
        warnings.push(`${docLabel} — ${getCheckDisplayLabel(c.check_name)}: ${reason}`);
      });
  });

  Object.entries(incomingFlags || {}).forEach(([docType, f]) => {
    if (!f.reasons || f.reasons.length === 0) return;
    const docLabel = docLabelByType[docType] || docType;
    warnings.push(`${docLabel}: flagged for ${f.reasons.length} issue(s)`);
  });

  return warnings;
}
function VerifierVerificationAction() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const incomingFlags = location.state?.flaggedDocs || {};
  const [app, setApp] = useState(null);
  const { url: profilePhotoUrl, status: profilePhotoStatus } = useUserPhoto(
    app?.user?.id
  );
  const [loadingApp, setLoadingApp] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [selectedAction, setSelectedAction] = useState(null);
  const [successFeedback, setSuccessFeedback] = useState(null);
  const [feedbackSeconds, setFeedbackSeconds] = useState(3);
  useEffect(() => {
    api.get(`/verifier/applications/${id}`)
      .then((res) => setApp(res.data))
      .catch(() => setError("Failed to load application."))
      .finally(() => setLoadingApp(false));
  }, [id]);
  useEffect(() => {
    if (!successFeedback) return;
    if (feedbackSeconds <= 0) {
      navigate("/VerifierApplicationList");
      return;
    }
    const timer = setTimeout(() => {
      setFeedbackSeconds((prev) => prev - 1);
    }, 1000);
    return () => clearTimeout(timer);
  }, [successFeedback, feedbackSeconds, navigate]);
  const reasonsByDocType = getReasonsByDocType(app?.configuration?.school_year);
  const [approveNotes, setApproveNotes] = useState("");
  const [approveAck, setApproveAck] = useState(false);
  const approvalWarnings = getApprovalWarnings(app, incomingFlags);
  const docLabelByType = Object.fromEntries(DOC_TYPES.map((d) => [d.key, d.label]));
  const detectedFailures = getAutoDetectedFailures(app || {}, reasonsByDocType);
  const detectedWarnings = DOC_TYPES.flatMap(({ key }) => {
    const { matchedIds, dynamicReasons } = detectedFailures[key] || {};
    const flat = getFlatReasons(reasonsByDocType[key]);
    const labels = [
      ...(matchedIds || []).map((mid) => flat.find((r) => r.id === mid)?.verifierLabel).filter(Boolean),
      ...(dynamicReasons || []).map((d) => d.text),
    ];
    if (labels.length === 0) return [];
    return [{ docLabel: docLabelByType[key], message: labels.join(" ") }];
  });
  // Informational only — never selectable, never sent to the applicant.
  const verifierNoteWarnings = DOC_TYPES.flatMap(({ key }) => {
    const notes = detectedFailures[key]?.verifierNotes || [];
    return notes.map((n) => ({
      docLabel: docLabelByType[key],
      checkLabel: n.checkLabel,
      message: n.message,
    }));
  });

  const [rejectDocs, setRejectDocs] = useState(() => {
    const base = {};
    DOC_TYPES.forEach((d) => {
      const flagged = incomingFlags[d.key];
      base[d.key] = flagged
        ? {
          reasonIds: flagged.reasons.filter((r) => r !== OTHER),
          dynamicReasons: [],
          otherChecked: !!flagged.reasons.includes(OTHER),
          otherText: flagged.otherText || "",
        }
        : { reasonIds: [], dynamicReasons: [], otherChecked: false, otherText: "" };
    });
    return base;
  });
  const [rejectGeneralReasons, setRejectGeneralReasons] = useState([]);
  const [rejectGeneralOtherChecked, setRejectGeneralOtherChecked] = useState(false);
  const [rejectGeneralOtherText, setRejectGeneralOtherText] = useState("");
  const [rejectNotes, setRejectNotes] = useState("");
  const [autoRejectApplied, setAutoRejectApplied] = useState(false);

  const [reuploadDocs, setReuploadDocs] = useState(() => {
    const base = {};
    DOC_TYPES.forEach((d) => {
      const flagged = incomingFlags[d.key];
      base[d.key] = {
        ...emptyDocState(),
        checked: !!(flagged && flagged.reasons.length > 0),
        reasonIds: flagged ? flagged.reasons.filter((r) => r !== OTHER) : [],
        otherChecked: !!(flagged && flagged.reasons.includes(OTHER)),
        otherText: flagged?.otherText || "",
      };
    });
    return base;
  });
  const [reuploadNotes, setReuploadNotes] = useState("");
  const [autoReuploadApplied, setAutoReuploadApplied] = useState(false);

  // --- Appeal decision state ---
  const [appealDecision, setAppealDecision] = useState("approved");
  const [appealNotes, setAppealNotes] = useState("");

  // Once the application (and its verification checks) has loaded, fold
  // any system-detected failures into the re-upload selections so they
  // arrive pre-checked with the matching reason — the verifier no longer
  // has to manually re-select what the system already flagged as failed.
  useEffect(() => {
    if (!app || autoReuploadApplied) return;

    const failures = getAutoDetectedFailures(app, reasonsByDocType);
    let hasAnyFailure = false;

    setReuploadDocs((prev) => {
      const next = { ...prev };
      DOC_TYPES.forEach((d) => {
        const { matchedIds, dynamicReasons, verifierNotes } = failures[d.key];
        const hasAnythingFlagged =
          matchedIds.length > 0 || dynamicReasons.length > 0 || verifierNotes.length > 0;
        if (!hasAnythingFlagged) return;

        // Clicking "Request Re-upload" already means the verifier believes
        // something is wrong with a document — so a document is checked
        // (and its reasons expanded) whenever the system flagged ANYTHING
        // on it, even a note it wasn't confident enough to name a specific
        // reason for. We just don't guess which checkbox that note maps
        // to — the verifier picks the actual reason themselves.
        hasAnyFailure = true;
        const current = prev[d.key];
        const mergedReasonIds = [...new Set([...current.reasonIds, ...matchedIds])];
        const existingDynamicKeys = new Set(current.dynamicReasons.map((r) => r.key));
        const mergedDynamic = [
          ...current.dynamicReasons,
          ...dynamicReasons.filter((r) => !existingDynamicKeys.has(r.key)),
        ];

        next[d.key] = {
          ...current,
          checked: true,
          reasonIds: mergedReasonIds,
          dynamicReasons: mergedDynamic,
        };
      });
      return next;
    });

    if (hasAnyFailure) setAutoReuploadApplied(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [app]);

  // Same idea for Reject: system-detected failures should be available
  // from either action, not just Re-upload, since they're the same
  // underlying facts about the application.
  useEffect(() => {
    if (!app || autoRejectApplied) return;

    const failures = getAutoDetectedFailures(app, reasonsByDocType);
    let hasAnyFailure = false;

    setRejectDocs((prev) => {
      const next = { ...prev };
      DOC_TYPES.forEach((d) => {
        const { matchedIds, dynamicReasons } = failures[d.key];
        if (matchedIds.length === 0 && dynamicReasons.length === 0) return;

        hasAnyFailure = true;
        const current = prev[d.key];
        const mergedReasonIds = [...new Set([...current.reasonIds, ...matchedIds])];
        const existingDynamicKeys = new Set(current.dynamicReasons.map((r) => r.key));
        const mergedDynamic = [
          ...current.dynamicReasons,
          ...dynamicReasons.filter((r) => !existingDynamicKeys.has(r.key)),
        ];

        next[d.key] = {
          ...current,
          reasonIds: mergedReasonIds,
          dynamicReasons: mergedDynamic,
        };
      });
      return next;
    });

    if (hasAnyFailure) setAutoRejectApplied(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [app]);

  function openAction(action) {
    setError("");
    if (action === "approve") setApproveAck(false);
    setSelectedAction(action);
  }
  function closeAction() {
    if (submitting) return;
    setError("");
    setSelectedAction(null);
  }
  function showSuccess(title, message) {
    setSelectedAction(null);
    setError("");
    setFeedbackSeconds(10);
    setSuccessFeedback({ title, message });
  }
  function dismissSuccess() {
    setSuccessFeedback(null);
    navigate("/VerifierApplicationList");
  }
  function addQuickNote(setter, note) {
    setter((prev) => prev.trim() ? `${prev.trim()} ${note}.` : `${note}.`);
  }

  // --- Reject modal handlers ---
  function toggleRejectReasonId(docType, reasonId) {
    setRejectDocs((prev) => {
      const current = prev[docType].reasonIds;
      const updated = current.includes(reasonId)
        ? current.filter((r) => r !== reasonId)
        : [...current, reasonId];
      return { ...prev, [docType]: { ...prev[docType], reasonIds: updated } };
    });
  }
  function toggleRejectDynamicReason(docType, key) {
    setRejectDocs((prev) => ({
      ...prev,
      [docType]: {
        ...prev[docType],
        dynamicReasons: prev[docType].dynamicReasons.map((r) =>
          r.key === key ? { ...r, checked: !r.checked } : r
        ),
      },
    }));
  }
  function toggleRejectOther(docType) {
    setRejectDocs((prev) => ({
      ...prev,
      [docType]: { ...prev[docType], otherChecked: !prev[docType].otherChecked },
    }));
  }
  function setRejectOtherText(docType, text) {
    setRejectDocs((prev) => ({
      ...prev,
      [docType]: { ...prev[docType], otherText: text },
    }));
  }
  function toggleRejectGeneral(reason) {
    setRejectGeneralReasons((prev) =>
      prev.includes(reason) ? prev.filter((r) => r !== reason) : [...prev, reason]
    );
  }

  // --- Re-upload modal handlers ---
  function toggleReuploadDoc(key) {
    setReuploadDocs((prev) => ({
      ...prev,
      [key]: { ...prev[key], checked: !prev[key].checked },
    }));
  }
  function toggleReuploadReasonId(key, reasonId) {
    setReuploadDocs((prev) => {
      const current = prev[key].reasonIds;
      const updated = current.includes(reasonId)
        ? current.filter((r) => r !== reasonId)
        : [...current, reasonId];
      return { ...prev, [key]: { ...prev[key], reasonIds: updated } };
    });
  }
  function toggleReuploadDynamicReason(key, reasonKey) {
    setReuploadDocs((prev) => ({
      ...prev,
      [key]: {
        ...prev[key],
        dynamicReasons: prev[key].dynamicReasons.map((r) =>
          r.key === reasonKey ? { ...r, checked: !r.checked } : r
        ),
      },
    }));
  }
  function toggleReuploadOther(key) {
    setReuploadDocs((prev) => ({
      ...prev,
      [key]: { ...prev[key], otherChecked: !prev[key].otherChecked },
    }));
  }
  function setReuploadOtherText(key, text) {
    setReuploadDocs((prev) => ({
      ...prev,
      [key]: { ...prev[key], otherText: text },
    }));
  }
  async function handleApprove() {
    if (approvalWarnings.length > 0 && !approveAck) {
      setError("Please acknowledge the warnings above before approving.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      await api.post(`/verifier/applications/${id}/approve`, { notes: approveNotes });
      showSuccess(
        "Application Approved",
        "Application approved successfully."
      );
    } catch (err) {
      setError(err.response?.data?.message || "Action failed.");
    } finally {
      setSubmitting(false);
    }
  }
  async function handleReject() {
    setError("");

    const categories = [];
    const messages = [];

    DOC_TYPES.forEach((d) => {
      const state = rejectDocs[d.key];
      const flat = getFlatReasons(reasonsByDocType[d.key]);
      const { categories: docCategories, messages: docMessages } = buildDocReasonPayload(
        flat,
        state.reasonIds,
        state.dynamicReasons,
        state.otherChecked,
        state.otherText,
        "rejectText"
      );
      categories.push(...docCategories);
      messages.push(...docMessages);
    });

    categories.push(...rejectGeneralReasons);
    messages.push(...rejectGeneralReasons);
    if (rejectGeneralOtherChecked && rejectGeneralOtherText.trim()) {
      categories.push(rejectGeneralOtherText.trim());
      messages.push(rejectGeneralOtherText.trim());
    }

    if (categories.length === 0) {
      setError("Please select at least one reason, or specify one under Other.");
      return;
    }
    const reason = messages.join(" ") + (rejectNotes.trim() ? ` Additional note: ${rejectNotes.trim()}` : "");
    setSubmitting(true);
    try {
      await api.post(`/verifier/applications/${id}/reject`, {
        reason,
        reason_categories: categories,
      });
      showSuccess(
        "Application Rejected",
        "Application rejected successfully."
      );
    } catch (err) {
      setError(err.response?.data?.message || "Action failed.");
    } finally {
      setSubmitting(false);
    }
  }
  async function handleReupload() {
    setError("");
    const checkedDocs = DOC_TYPES.filter((d) => reuploadDocs[d.key].checked);
    if (checkedDocs.length === 0) {
      setError("Please select at least one document that needs re-upload.");
      return;
    }
    const details = [];
    for (const d of checkedDocs) {
      const docState = reuploadDocs[d.key];
      const flat = getFlatReasons(reasonsByDocType[d.key]);
      const { categories, messages } = buildDocReasonPayload(
        flat,
        docState.reasonIds,
        docState.dynamicReasons,
        docState.otherChecked,
        docState.otherText,
        "reuploadText"
      );
      if (categories.length === 0) {
        setError(`Please select at least one reason for: ${d.label}`);
        return;
      }
      details.push({
        document_type: d.key,
        label: d.label,
        reason_categories: categories,
        reason: messages.join(" "),
      });
    }
    const notes = `Please re-upload the following document(s): ${checkedDocs.map((d) => d.label).join(", ")}.`
      + (reuploadNotes.trim() ? ` Additional note: ${reuploadNotes.trim()}` : "");
    setSubmitting(true);
    try {
      await api.post(`/verifier/applications/${id}/reupload`, {
        notes,
        reupload_details: details,
      });
      showSuccess(
        "Re-upload Request Sent",
        "Re-upload request sent successfully."
      );
    } catch (err) {
      setError(err.response?.data?.message || "Action failed.");
    } finally {
      setSubmitting(false);
    }
  }
  async function handleAppealDecision() {
    setError("");
    if (!appealNotes.trim()) {
      setError("Please explain your decision.");
      return;
    }
    setSubmitting(true);
    try {
      await api.post(`/verifier/applications/${id}/appeal-decision`, {
        decision: appealDecision,
        notes: appealNotes,
      });
      showSuccess(
        appealDecision === "approved" ? "Appeal Approved" : "Appeal Denied",
        appealDecision === "approved"
          ? "The application has been sent back for review."
          : "The rejection has been upheld."
      );
    } catch (err) {
      setError(err.response?.data?.message || "Action failed.");
    } finally {
      setSubmitting(false);
    }
  }

  // Whether a document type has anything worth showing a reason group for
  // in the Reject modal (either manually flagged on the Review page, or
  // system-detected on this page). `reasonIds`/`dynamicReasons`/`otherChecked`
  // already reflect both sources (they're seeded from incomingFlags on
  // mount and merged with detected failures) — checking incomingFlags
  // directly here as well was a bug: the Review page always passes a
  // `{reasons: [], otherText: ""}` entry for every document type whether
  // or not it was actually flagged, so that used to make every document
  // group show up regardless of whether it had anything in it.
  function rejectDocHasContent(docType) {
    const state = rejectDocs[docType];
    return (
      state.reasonIds.length > 0 ||
      state.dynamicReasons.length > 0 ||
      (state.otherChecked && state.otherText.trim().length > 0)
    );
  }

  // Shared between the Reject and Re-upload modals: the same detected
  // failures apply to both actions, so both should surface the same two
  // notices — selectable reasons the system pre-checked below, and
  // informational-only notes for the verifier that never become a reason.
  // `theme` tints the first banner to match whichever action button
  // opened this modal (red for reject, amber for re-upload) using
  // Bootstrap's own contextual alert classes.
  function renderDetectedFailureBanners(theme) {
    if (detectedWarnings.length === 0 && verifierNoteWarnings.length === 0) return null;
    return (
      <>
        {detectedWarnings.length > 0 && (
          <div className={`alert ${theme === "reject" ? "alert-danger" : "alert-warning"}`}>
            <p className="mb-2">
              <strong>⚠ System-detected failures (pre-checked below):</strong>
            </p>
            <ul className="mb-0 ps-3">
              {detectedWarnings.map((w, i) => (
                <li key={i}>
                  <strong>{w.docLabel}:</strong> {w.message}
                </li>
              ))}
            </ul>
          </div>
        )}
        {verifierNoteWarnings.length > 0 && (
          <div className="alert alert-secondary">
            <p className="mb-2">
              <strong>⚠ For verifier review:</strong>
            </p>
            <ul className="mb-0 ps-3">
              {verifierNoteWarnings.map((w, i) => (
                <li key={i}>
                  <strong>{w.docLabel} — {w.checkLabel}:</strong>
                  {w.message}
                </li>
              ))}
            </ul>
          </div >
        )
        }
      </>
    );
  }

  return (
    <div className="verifier-layout">
      <VerifierNavigation />
      <div className="verifier-main">
        <VerifierTopbar />
        <section className="page-section">
          <div className="container-fluid">
            <div className="verifier-dashboard-header">
              <button
                type="button"
                className="verifier-review-back-btn"
                onClick={() => navigate(`/VerifierApplicationReview/${id}`)}
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M19 12H5" />
                  <path d="M12 19l-7-7 7-7" />
                </svg>

                Back to Application Review
              </button>

              <h3 className="verifier-dashboard-title">Verification Action</h3>
              <p className="verifier-dashboard-desc">Choose the appropriate verification action for this application.</p>
            </div>
            {!selectedAction && !successFeedback && error && (
              <div className="alert alert-danger">{error}</div>
            )}
            <div className="page-card verifier-review-info-card mb-4">
              <div className="verifier-review-info-header">
                <div className="verifier-review-info-header-top">
                  <h4 className="verifier-review-info-title">Application Summary</h4>
                </div>
              </div>
              {loadingApp ? (
                <div className="text-center py-5">
                  <div className="spinner-border text-danger" role="status" />
                </div>
              ) : app ? (
                <>
                  <div className="verifier-review-profile-area">
                    <div className="verifier-review-profile-main">
                      {profilePhotoStatus === "ready" ? (
                        <img
                          src={profilePhotoUrl}
                          alt="Applicant"
                          className="verifier-review-profile-avatar verifier-review-profile-photo"
                        />
                      ) : (
                        <div className="verifier-review-profile-avatar">
                          {app.user?.first_name?.charAt(0)}
                          {app.user?.last_name?.charAt(0)}
                        </div>
                      )}
                      <div className="verifier-review-profile-content">
                        <h5 className="verifier-review-profile-name">
                          {[app.user?.first_name, app.user?.middle_name, app.user?.last_name]
                            .filter(Boolean)
                            .join(" ")}
                        </h5>
                      </div>
                    </div>
                  </div>
                  <div className="verifier-review-information-body">
                    <div className="verifier-review-information-column">
                      <p className="verifier-review-info-label">APPLICATION DETAILS</p>
                      <div className="verifier-review-details-grid verifier-review-details-grid-single">
                        <div className="verifier-review-detail-item">
                          <span className="verifier-review-detail-label">Application ID</span>
                          <span className="verifier-review-detail-value">APP-{app.id}</span>
                        </div>
                        <div className="verifier-review-detail-item">
                          <span className="verifier-review-detail-label">Current Status</span>
                          <span className={`status-badge ${getVerifierBadgeClass(app)}`}>
                            {getVerifierStatusLabel(app)}
                          </span>
                        </div>
                        <div className="verifier-review-detail-item">
                          <span className="verifier-review-detail-label">Residential Address</span>
                          <span className="verifier-review-detail-value">
                            {app.user?.profile
                              ? [app.user.profile.barangay, app.user.profile.city, app.user.profile.province].filter(Boolean).join(", ") || "—"
                              : "—"}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="verifier-review-information-divider"></div>
                    <div className="verifier-review-information-column">
                      <p className="verifier-review-info-label">ACADEMIC BACKGROUND</p>
                      <div className="verifier-review-details-grid verifier-review-details-grid-single">
                        <div className="verifier-review-detail-item">
                          <span className="verifier-review-detail-label">School</span>
                          <span className="verifier-review-detail-value">{app.school_name ?? "—"}</span>
                        </div>
                        <div className="verifier-review-detail-item">
                          <span className="verifier-review-detail-label">School Year</span>
                          <span className="verifier-review-detail-value">{app.configuration?.school_year ?? "—"}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="verifier-action-footer">
                    {app.status === "appeal_requested" ? (
                      <div className="verifier-action-buttons">
                        <button
                          type="button"
                          className="verifier-action-btn verifier-action-btn-approve"
                          onClick={() => openAction("appeal")}
                        >
                          Resolve Appeal
                        </button>
                      </div>
                    ) : (
                      <div className="verifier-action-buttons">
                        <button
                          type="button"
                          className="verifier-action-btn verifier-action-btn-approve"
                          onClick={() => openAction("approve")}
                        >
                          Approve
                        </button>
                        <button
                          type="button"
                          className="verifier-action-btn verifier-action-btn-reupload"
                          onClick={() => openAction("reupload")}
                        >
                          Request Re-upload
                        </button>
                        <button
                          type="button"
                          className="verifier-action-btn verifier-action-btn-reject"
                          onClick={() => openAction("reject")}
                        >
                          Reject
                        </button>
                      </div>
                    )}
                  </div>
                </>
              ) : null}
            </div>
          </div>
        </section>
        <PanelFooter />
      </div>
      {selectedAction === "approve" && (
        <div className="verifier-action-modal-backdrop" onClick={closeAction}>
          <div className="verifier-action-modal verifier-action-modal-small" onClick={(e) => e.stopPropagation()}>
            <div className="verifier-action-modal-header">
              <div className="verifier-action-modal-heading">
                <div className="verifier-action-modal-icon verifier-action-modal-icon-approve">✓</div>
                <h5>Approve Application</h5>
              </div>
              <button type="button" className="verifier-action-modal-close" onClick={closeAction} disabled={submitting}>×</button>
            </div>
            <div className="verifier-action-modal-body">
              {error && <div className="alert alert-danger">{error}</div>}
              {approvalWarnings.length > 0 && (
                <div className="alert alert-warning">
                  <p className="mb-2"><strong>⚠ This application has unresolved issues:</strong></p>
                  <ul className="mb-2 ps-3">
                    {approvalWarnings.map((w, i) => (
                      <li key={i}>{w}</li>
                    ))}
                  </ul>
                  <div className="form-check">
                    <input
                      className="form-check-input"
                      type="checkbox"
                      id="approve-ack"
                      checked={approveAck}
                      onChange={() => setApproveAck((v) => !v)}
                    />
                    <label className="form-check-label" htmlFor="approve-ack">
                      I have reviewed these issues and still want to approve this application.
                    </label>
                  </div>
                </div>
              )}
              <div className="verifier-action-field">
                <label>Notes <span>(optional)</span></label>
                <textarea
                  className="verifier-action-textarea"
                  value={approveNotes}
                  onChange={(e) => setApproveNotes(e.target.value)}
                  placeholder="Add optional notes..."
                />
                <div className="verifier-quick-notes">
                  <span className="verifier-quick-notes-label">QUICK NOTES</span>
                  <div className="verifier-quick-notes-list">
                    {[
                      "Documents verified",
                      "Requirements met",
                      "Eligible for approval",
                    ].map((note) => (
                      <button
                        key={note}
                        type="button"
                        className="verifier-quick-note-btn"
                        onClick={() => addQuickNote(setApproveNotes, note)}
                      >
                        + {note}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            <div className="verifier-action-modal-footer">
              <button
                type="button"
                className="verifier-action-modal-cancel"
                onClick={closeAction}
                disabled={submitting}
              >
                Cancel
              </button>
              <button
                type="button"
                className="verifier-action-btn verifier-action-btn-approve"
                onClick={handleApprove}
                disabled={submitting || (approvalWarnings.length > 0 && !approveAck)}
              >
                {submitting ? "Approving..." : "Confirm Approval"}
              </button>
            </div>
          </div>
        </div>
      )}
      {selectedAction === "reupload" && (
        <div className="verifier-action-modal-backdrop" onClick={closeAction}>
          <div className="verifier-action-modal verifier-action-modal-large" onClick={(e) => e.stopPropagation()}>
            <div className="verifier-action-modal-header">
              <div className="verifier-action-modal-heading">
                <div className="verifier-action-modal-icon verifier-action-modal-icon-reupload">↻</div>
                <h5>Request Re-upload</h5>
              </div>
              <button type="button" className="verifier-action-modal-close" onClick={closeAction} disabled={submitting}>×</button>
            </div>
            <div className="verifier-action-modal-body">
              {error && <div className="alert alert-danger">{error}</div>}
              {renderDetectedFailureBanners("reupload")}
              <p className="verifier-action-section-label">SELECT DOCUMENTS REQUIRING RE-UPLOAD</p>
              <div className="verifier-reupload-document-list">
                {DOC_TYPES.map((doc) => {
                  const state = reuploadDocs[doc.key];
                  const { primary, additional } = reasonsByDocType[doc.key];
                  const matchedIds = detectedFailures[doc.key]?.matchedIds || [];
                  return (
                    <div
                      key={doc.key}
                      className={`verifier-reupload-document ${state.checked ? "verifier-reupload-document-selected" : ""}`}
                    >
                      <div className="verifier-reupload-document-main">
                        <input
                          className="form-check-input"
                          type="checkbox"
                          id={`reup-doc-${doc.key}`}
                          checked={state.checked}
                          onChange={() => toggleReuploadDoc(doc.key)}
                        />
                        <label htmlFor={`reup-doc-${doc.key}`}>{doc.label}</label>
                      </div>
                      {state.checked && (
                        <div className="verifier-reupload-reasons">
                          {primary.map((reason) => (
                            <div className="form-check" key={reason.id}>
                              <input
                                className="form-check-input"
                                type="checkbox"
                                id={`reup-${doc.key}-${reason.id}`}
                                checked={state.reasonIds.includes(reason.id)}
                                onChange={() => toggleReuploadReasonId(doc.key, reason.id)}
                              />
                              <label className="form-check-label" htmlFor={`reup-${doc.key}-${reason.id}`}>
                                {reason.verifierLabel}
                                {matchedIds.includes(reason.id) && (
                                  <span className="badge bg-primary ms-2">Detected</span>
                                )}
                              </label>
                            </div>
                          ))}

                          {(additional.length > 0 || state.dynamicReasons.length > 0) && (
                            <>
                              <div className="verifier-action-subsection-label">Additional reasons</div>
                              {additional.map((reason) => (
                                <div className="form-check" key={reason.id}>
                                  <input
                                    className="form-check-input"
                                    type="checkbox"
                                    id={`reup-${doc.key}-${reason.id}`}
                                    checked={state.reasonIds.includes(reason.id)}
                                    onChange={() => toggleReuploadReasonId(doc.key, reason.id)}
                                  />
                                  <label className="form-check-label" htmlFor={`reup-${doc.key}-${reason.id}`}>
                                    {reason.verifierLabel}
                                    {matchedIds.includes(reason.id) && (
                                      <span className="badge bg-primary ms-2">Detected</span>
                                    )}
                                  </label>
                                </div>
                              ))}
                              {state.dynamicReasons.map((reason) => (
                                <div className="form-check" key={reason.key}>
                                  <input
                                    className="form-check-input"
                                    type="checkbox"
                                    id={`reup-${doc.key}-${reason.key}`}
                                    checked={reason.checked}
                                    onChange={() => toggleReuploadDynamicReason(doc.key, reason.key)}
                                  />
                                  <label className="form-check-label" htmlFor={`reup-${doc.key}-${reason.key}`}>
                                    {reason.text}
                                    <span className="badge bg-primary ms-2">Detected</span>
                                  </label>
                                </div>
                              ))}
                            </>
                          )}

                          <div className="form-check">
                            <input
                              className="form-check-input"
                              type="checkbox"
                              id={`reup-other-${doc.key}`}
                              checked={state.otherChecked}
                              onChange={() => toggleReuploadOther(doc.key)}
                            />
                            <label className="form-check-label" htmlFor={`reup-other-${doc.key}`}>
                              {OTHER}
                            </label>
                          </div>
                          {state.otherChecked && (
                            <input
                              className="form-control form-control-sm verifier-action-other-input"
                              placeholder="Specify the issue..."
                              value={state.otherText}
                              onChange={(e) => setReuploadOtherText(doc.key, e.target.value)}
                            />
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              <div className="verifier-action-field verifier-action-field-notes">
                <label>Additional Notes <span>(optional)</span></label>
                <textarea
                  className="verifier-action-textarea"
                  value={reuploadNotes}
                  onChange={(e) => setReuploadNotes(e.target.value)}
                  placeholder="Add optional notes..."
                />
                <div className="verifier-quick-notes">
                  <span className="verifier-quick-notes-label">QUICK SUGGESTIONS</span>
                  <div className="verifier-quick-notes-list">
                    {[
                      "Upload a clearer image",
                      "Upload the complete document",
                      "Make sure all details are readable",
                      "Upload the correct document type",
                    ].map((note) => (
                      <button
                        key={note}
                        type="button"
                        className="verifier-quick-note-btn"
                        onClick={() => addQuickNote(setReuploadNotes, note)}
                      >
                        + {note}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            <div className="verifier-action-modal-footer">
              <button
                type="button"
                className="verifier-action-modal-cancel"
                onClick={closeAction}
                disabled={submitting}
              >
                Cancel
              </button>
              <button
                type="button"
                className="verifier-action-btn verifier-action-btn-reupload"
                onClick={handleReupload}
                disabled={submitting}
              >
                {submitting ? "Submitting..." : "Confirm Re-upload Request"}
              </button>
            </div>
          </div>
        </div>
      )}
      {selectedAction === "reject" && (
        <div className="verifier-action-modal-backdrop" onClick={closeAction}>
          <div className="verifier-action-modal verifier-action-modal-medium" onClick={(e) => e.stopPropagation()}>
            <div className="verifier-action-modal-header">
              <div className="verifier-action-modal-heading">
                <div className="verifier-action-modal-icon verifier-action-modal-icon-reject">×</div>
                <h5>Reject Application</h5>
              </div>
              <button type="button" className="verifier-action-modal-close" onClick={closeAction} disabled={submitting}>×</button>
            </div>
            <div className="verifier-action-modal-body">
              {error && <div className="alert alert-danger">{error}</div>}
              {renderDetectedFailureBanners("reject")}
              <div className="verifier-reject-group">
                <p className="verifier-action-section-label">GENERAL</p>
                {GENERAL_REJECTION_REASONS.map((reason) => (
                  <div className="verifier-reject-option" key={reason}>
                    <input
                      className="form-check-input"
                      type="checkbox"
                      id={`reject-general-${reason}`}
                      checked={rejectGeneralReasons.includes(reason)}
                      onChange={() => toggleRejectGeneral(reason)}
                    />
                    <label htmlFor={`reject-general-${reason}`}>{reason}</label>
                  </div>
                ))}
                <div className="verifier-reject-option">
                  <input
                    className="form-check-input"
                    type="checkbox"
                    id="reject-general-other"
                    checked={rejectGeneralOtherChecked}
                    onChange={() => setRejectGeneralOtherChecked((v) => !v)}
                  />
                  <label htmlFor="reject-general-other">{OTHER}</label>
                </div>
                {rejectGeneralOtherChecked && (
                  <input
                    className="form-control form-control-sm verifier-action-other-input"
                    placeholder="Specify the reason..."
                    value={rejectGeneralOtherText}
                    onChange={(e) => setRejectGeneralOtherText(e.target.value)}
                  />
                )}
              </div>
              {DOC_TYPES.filter(
                (d) => rejectDocHasContent(d.key) || (detectedFailures[d.key]?.verifierNotes || []).length > 0
              ).map((d) => {
                const state = rejectDocs[d.key];
                const { primary, additional } = reasonsByDocType[d.key];
                const matchedIds = detectedFailures[d.key]?.matchedIds || [];
                return (
                  <div key={d.key} className="verifier-reject-group">
                    <p className="verifier-action-section-label">{d.label}</p>
                    {primary.map((reason) => (
                      <div className="verifier-reject-option" key={reason.id}>
                        <input
                          className="form-check-input"
                          type="checkbox"
                          id={`reject-${d.key}-${reason.id}`}
                          checked={state.reasonIds.includes(reason.id)}
                          onChange={() => toggleRejectReasonId(d.key, reason.id)}
                        />
                        <label htmlFor={`reject-${d.key}-${reason.id}`}>
                          {reason.verifierLabel}
                          {matchedIds.includes(reason.id) && (
                            <span className="badge bg-primary ms-2">Detected</span>
                          )}
                        </label>
                      </div>
                    ))}
                    {/* Unlike Re-upload, Reject doesn't show the full "Additional
                        reasons" picklist — those are situational/specific reasons
                        (wrong school year, not a Mamatid voter, etc.) that only
                        matter here if the system actually detected them. An
                        undetected one has no reason to be offered under a
                        document the verifier is already rejecting for other
                        grounds, so only detected fixed reasons — plus any
                        dynamic ones, which are always system-detected — show
                        up, directly under the document heading, no subheading. */}
                    {additional
                      .filter((reason) => matchedIds.includes(reason.id))
                      .map((reason) => (
                        <div className="verifier-reject-option" key={reason.id}>
                          <input
                            className="form-check-input"
                            type="checkbox"
                            id={`reject-${d.key}-${reason.id}`}
                            checked={state.reasonIds.includes(reason.id)}
                            onChange={() => toggleRejectReasonId(d.key, reason.id)}
                          />
                          <label htmlFor={`reject-${d.key}-${reason.id}`}>
                            {reason.verifierLabel}
                            <span className="badge bg-primary ms-2">Detected</span>
                          </label>
                        </div>
                      ))}
                    {state.dynamicReasons.map((reason) => (
                      <div className="verifier-reject-option" key={reason.key}>
                        <input
                          className="form-check-input"
                          type="checkbox"
                          id={`reject-${d.key}-${reason.key}`}
                          checked={reason.checked}
                          onChange={() => toggleRejectDynamicReason(d.key, reason.key)}
                        />
                        <label htmlFor={`reject-${d.key}-${reason.key}`}>
                          {reason.text}
                          <span className="badge bg-primary ms-2">Detected</span>
                        </label>
                      </div>
                    ))}
                    <div className="verifier-reject-option">
                      <input
                        className="form-check-input"
                        type="checkbox"
                        id={`reject-other-${d.key}`}
                        checked={state.otherChecked}
                        onChange={() => toggleRejectOther(d.key)}
                      />
                      <label htmlFor={`reject-other-${d.key}`}>{OTHER}</label>
                    </div>
                    {state.otherChecked && (
                      <input
                        className="form-control form-control-sm verifier-action-other-input"
                        placeholder="Specify the issue..."
                        value={state.otherText}
                        onChange={(e) => setRejectOtherText(d.key, e.target.value)}
                      />
                    )}
                  </div>
                );
              })}
              <div className="verifier-action-field verifier-action-field-notes">
                <label>Additional Notes <span>(optional)</span></label>
                <textarea
                  className="verifier-action-textarea"
                  value={rejectNotes}
                  onChange={(e) => setRejectNotes(e.target.value)}
                  placeholder="Add optional notes..."
                />
                <div className="verifier-quick-notes">
                  <span className="verifier-quick-notes-label">QUICK REMARKS</span>
                  <div className="verifier-quick-notes-list">
                    {[
                      "Eligibility requirements not met",
                      "Duplicate application",
                      "Document verification failed",
                      "Application requirements incomplete",
                    ].map((note) => (
                      <button
                        key={note}
                        type="button"
                        className="verifier-quick-note-btn verifier-quick-note-btn-reject"
                        onClick={() => addQuickNote(setRejectNotes, note)}
                      >
                        + {note}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            <div className="verifier-action-modal-footer">
              <button
                type="button"
                className="verifier-action-modal-cancel"
                onClick={closeAction}
                disabled={submitting}
              >
                Cancel
              </button>
              <button
                type="button"
                className="verifier-action-btn verifier-action-btn-reject"
                onClick={handleReject}
                disabled={submitting}
              >
                {submitting ? "Rejecting..." : "Confirm Rejection"}
              </button>
            </div>
          </div>
        </div>
      )}
      {selectedAction === "appeal" && (
        <div className="verifier-action-modal-backdrop" onClick={closeAction}>
          <div className="verifier-action-modal verifier-action-modal-small" onClick={(e) => e.stopPropagation()}>
            <div className="verifier-action-modal-header">
              <div className="verifier-action-modal-heading">
                <div className="verifier-action-modal-icon verifier-action-modal-icon-approve">!</div>
                <h5>Resolve Appeal</h5>
              </div>
              <button type="button" className="verifier-action-modal-close" onClick={closeAction} disabled={submitting}>×</button>
            </div>
            <div className="verifier-action-modal-body">
              {error && <div className="alert alert-danger">{error}</div>}
              {app.appeal_reason && (
                <div className="alert alert-secondary mb-3">
                  <strong>Applicant's appeal reason:</strong> {app.appeal_reason}
                </div>
              )}
              <p className="verifier-action-section-label">DECISION</p>
              <div className="verifier-reject-option">
                <input
                  className="form-check-input"
                  type="radio"
                  id="appeal-decision-approved"
                  name="appeal-decision"
                  checked={appealDecision === "approved"}
                  onChange={() => setAppealDecision("approved")}
                />
                <label htmlFor="appeal-decision-approved">
                  Approve — send back to review
                </label>
              </div>
              <div className="verifier-reject-option">
                <input
                  className="form-check-input"
                  type="radio"
                  id="appeal-decision-denied"
                  name="appeal-decision"
                  checked={appealDecision === "denied"}
                  onChange={() => setAppealDecision("denied")}
                />
                <label htmlFor="appeal-decision-denied">
                  Deny — uphold rejection
                </label>
              </div>
              <textarea
                className="form-control mt-3"
                rows={3}
                placeholder="Explain your decision (this will be shown to the applicant)..."
                value={appealNotes}
                onChange={(e) => setAppealNotes(e.target.value)}
              />
            </div>
            <div className="verifier-action-modal-footer">
              <button
                type="button"
                className="verifier-action-btn verifier-action-btn-cancel"
                onClick={closeAction}
                disabled={submitting}
              >
                Cancel
              </button>
              <button
                type="button"
                className="verifier-action-btn verifier-action-btn-approve"
                onClick={handleAppealDecision}
                disabled={submitting}
              >
                {submitting ? "Submitting..." : "Submit Decision"}
              </button>
            </div>
          </div>
        </div>
      )}
      {successFeedback && (
        <div className="verifier-password-feedback-backdrop">
          <div className="verifier-password-feedback">
            <div className="verifier-password-feedback-icon-wrap">
              <span className="verifier-password-feedback-icon">✓</span>
            </div>
            <h4 className="verifier-password-feedback-title">
              {successFeedback.title}
            </h4>
            <p className="verifier-password-feedback-message">
              {successFeedback.message}
            </p>
            <button
              type="button"
              className="verifier-password-feedback-dismiss"
              onClick={dismissSuccess}
            >
              <span>Dismiss</span>
              <span className="verifier-password-feedback-arrow">→</span>
              <span className="verifier-password-feedback-timer">
                {feedbackSeconds}s
              </span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
export default VerifierVerificationAction;
