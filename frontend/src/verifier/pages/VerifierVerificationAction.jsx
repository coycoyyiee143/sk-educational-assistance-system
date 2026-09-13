import { useState, useEffect } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import VerifierNavigation from "../components/VerifierNavigation";
import PanelFooter from "../../components/PanelFooter";
import api from "../../services/api";
import { getVerifierStatusLabel, getVerifierBadgeClass } from "../../components/StatusConstants";
import {
  DOC_TYPES,
  getReasonsByDocType,
  GENERAL_REJECTION_REASONS,
  OTHER,
} from "../constants/verificationReasons";
function buildCategories(selected, otherText) {
  const withoutOther = selected.filter((r) => r !== OTHER);
  if (selected.includes(OTHER) && otherText.trim()) {
    return [...withoutOther, otherText.trim()];
  }
  return withoutOther;
}
function VerifierVerificationAction() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const incomingFlags = location.state?.flaggedDocs || {};
  const [app, setApp] = useState(null);
  const [loadingApp, setLoadingApp] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [selectedAction, setSelectedAction] = useState(null);
  const [successFeedback, setSuccessFeedback] = useState(null);
  const [feedbackSeconds, setFeedbackSeconds] = useState(10);
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
  const initialRejectReasons = Object.values(incomingFlags)
    .flatMap((f) => f.reasons.filter((r) => r !== OTHER));
  const [rejectReasons, setRejectReasons] = useState(initialRejectReasons);
  const [rejectOtherChecked, setRejectOtherChecked] = useState(false);
  const [rejectOtherText, setRejectOtherText] = useState("");
  const [rejectNotes, setRejectNotes] = useState("");
  const [reuploadDocs, setReuploadDocs] = useState(() => {
    const base = {};
    DOC_TYPES.forEach((d) => {
      const flagged = incomingFlags[d.key];
      base[d.key] = {
        checked: !!(flagged && flagged.reasons.length > 0),
        reasons: flagged ? flagged.reasons.filter((r) => r !== OTHER) : [],
        otherChecked: !!(flagged && flagged.reasons.includes(OTHER)),
        otherText: flagged?.otherText || "",
      };
    });
    return base;
  });
  const [reuploadNotes, setReuploadNotes] = useState("");
  function openAction(action) {
    setError("");
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
  function toggleReject(reason) {
    setRejectReasons((prev) =>
      prev.includes(reason) ? prev.filter((r) => r !== reason) : [...prev, reason]
    );
  }
  function toggleReuploadDoc(key) {
    setReuploadDocs((prev) => ({
      ...prev,
      [key]: { ...prev[key], checked: !prev[key].checked },
    }));
  }
  function toggleReuploadReason(key, reason) {
    setReuploadDocs((prev) => {
      const current = prev[key].reasons;
      const updated = current.includes(reason)
        ? current.filter((r) => r !== reason)
        : [...current, reason];
      return { ...prev, [key]: { ...prev[key], reasons: updated } };
    });
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
    const categories = buildCategories(
      rejectOtherChecked ? [...rejectReasons, OTHER] : rejectReasons,
      rejectOtherText
    );
    if (categories.length === 0) {
      setError("Please select at least one reason, or specify one under Other.");
      return;
    }
    const reason = categories.join(" ") + (rejectNotes.trim() ? ` Additional note: ${rejectNotes.trim()}` : "");
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
      const selected = docState.otherChecked ? [...docState.reasons, OTHER] : docState.reasons;
      const categories = buildCategories(selected, docState.otherText);
      if (categories.length === 0) {
        setError(`Please select at least one reason for: ${d.label}`);
        return;
      }
      details.push({
        document_type: d.key,
        label: d.label,
        reason_categories: categories,
        reason: categories.join(" "),
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
  return (
    <div className="verifier-layout">
      <VerifierNavigation />
      <div className="verifier-main">
        <div className="verifier-topbar">
          <div className="verifier-topbar-user">
            <div className="verifier-topbar-user-text">
              <span className="verifier-topbar-user-name">Verifier User</span>
              <span className="verifier-topbar-user-role">Sangguniang Kabataan</span>
            </div>
            <div className="verifier-topbar-avatar"></div>
          </div>
        </div>
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
                      <div className="verifier-review-profile-avatar">
                        {app.user?.first_name?.charAt(0)}
                        {app.user?.last_name?.charAt(0)}
                      </div>
                      <div className="verifier-review-profile-content">
                        <h5 className="verifier-review-profile-name">
                          {app.user?.first_name} {app.user?.last_name}
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
                disabled={submitting}
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
              <p className="verifier-action-section-label">SELECT DOCUMENTS REQUIRING RE-UPLOAD</p>
              <div className="verifier-reupload-document-list">
                {DOC_TYPES.map((doc) => {
                  const state = reuploadDocs[doc.key];
                  const options = reasonsByDocType[doc.key].filter((r) => r !== OTHER);
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
                          {options.map((reason) => (
                            <div className="form-check" key={reason}>
                              <input
                                className="form-check-input"
                                type="checkbox"
                                id={`reup-${doc.key}-${reason}`}
                                checked={state.reasons.includes(reason)}
                                onChange={() => toggleReuploadReason(doc.key, reason)}
                              />
                              <label className="form-check-label" htmlFor={`reup-${doc.key}-${reason}`}>
                                {reason}
                              </label>
                            </div>
                          ))}
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
              {Object.entries(incomingFlags).some(([, f]) => f.reasons.length > 0) && (
                <div className="verifier-reject-flagged">
                  {Object.entries(incomingFlags).map(([docType, f]) => {
                    if (f.reasons.length === 0) return null;
                    const options = (reasonsByDocType[docType] || []).filter((r) => r !== OTHER);
                    const label = DOC_TYPES.find((d) => d.key === docType)?.label || docType;
                    return (
                      <div key={docType} className="verifier-reject-group">
                        <p className="verifier-action-section-label">{label}</p>
                        {options.map((reason) => (
                          <div className="verifier-reject-option" key={reason}>
                            <input
                              className="form-check-input"
                              type="checkbox"
                              id={`reject-${docType}-${reason}`}
                              checked={rejectReasons.includes(reason)}
                              onChange={() => toggleReject(reason)}
                            />
                            <label htmlFor={`reject-${docType}-${reason}`}>{reason}</label>
                          </div>
                        ))}
                      </div>
                    );
                  })}
                </div>
              )}
              <div className="verifier-reject-group">
                <p className="verifier-action-section-label">GENERAL</p>
                {GENERAL_REJECTION_REASONS.map((reason) => (
                  <div className="verifier-reject-option" key={reason}>
                    <input
                      className="form-check-input"
                      type="checkbox"
                      id={`reject-general-${reason}`}
                      checked={rejectReasons.includes(reason)}
                      onChange={() => toggleReject(reason)}
                    />
                    <label htmlFor={`reject-general-${reason}`}>{reason}</label>
                  </div>
                ))}
                <div className="verifier-reject-option">
                  <input
                    className="form-check-input"
                    type="checkbox"
                    id="reject-other"
                    checked={rejectOtherChecked}
                    onChange={() => setRejectOtherChecked((v) => !v)}
                  />
                  <label htmlFor="reject-other">{OTHER}</label>
                </div>
                {rejectOtherChecked && (
                  <input
                    className="form-control form-control-sm verifier-action-other-input"
                    placeholder="Specify the reason..."
                    value={rejectOtherText}
                    onChange={(e) => setRejectOtherText(e.target.value)}
                  />
                )}
              </div>
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