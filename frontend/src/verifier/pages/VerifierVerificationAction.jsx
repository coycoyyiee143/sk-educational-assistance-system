import { useState, useEffect } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import VerifierNavigation from "../components/VerifierNavigation";
import api from "../../services/api";
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

  useEffect(() => {
    api.get(`/verifier/applications/${id}`)
      .then((res) => setApp(res.data))
      .catch(() => setError("Failed to load application."))
      .finally(() => setLoadingApp(false));
  }, [id]);

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
      navigate("/VerifierApplicationList");
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
      navigate("/VerifierApplicationList");
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
      navigate("/VerifierApplicationList");
    } catch (err) {
      setError(err.response?.data?.message || "Action failed.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loadingApp) return (
    <div>
      <VerifierNavigation />
      <div className="d-flex justify-content-center mt-5">
        <div className="spinner-border text-danger" />
      </div>
    </div>
  );

  return (
    <div>
      <VerifierNavigation />
      <section className="page-section">
        <div className="container">

          <div className="page-card mb-4">
            <h3 className="section-title mb-2">Verification Action</h3>
            <p className="text-muted mb-0">Choose an action for this application.</p>
          </div>

          {error && <div className="alert alert-danger">{error}</div>}

          {app && (
            <div className="page-card mb-4">
              <h4 className="section-title mb-3">Application Summary</h4>
              <table className="table table-bordered summary-table align-middle">
                <tbody>
                  {[
                    ["Application ID", `APP-${app.id}`],
                    ["Applicant Name", `${app.user?.first_name} ${app.user?.last_name}`],
                    ["School", app.school_name],
                    ["School Year", app.configuration?.school_year ?? "—"],
                    ["Current Status", app.status?.replace(/_/g, " ")],
                  ].map(([label, value]) => (
                    <tr key={label}>
                      <th className="bg-light w-25">{label}</th>
                      <td>{value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="page-card mb-4">
            <div className="d-flex flex-wrap gap-2">
              <button
                type="button"
                className={`btn ${selectedAction === "approve" ? "btn-success" : "btn-outline-success"}`}
                onClick={() => setSelectedAction("approve")}
              >
                Approve
              </button>
              <button
                type="button"
                className={`btn ${selectedAction === "reupload" ? "btn-warning" : "btn-outline-warning"}`}
                onClick={() => setSelectedAction("reupload")}
              >
                Request Re-upload
              </button>
              <button
                type="button"
                className={`btn ${selectedAction === "reject" ? "btn-danger" : "btn-outline-danger"}`}
                onClick={() => setSelectedAction("reject")}
              >
                Reject
              </button>
            </div>
          </div>

          {selectedAction === "approve" && (
            <div className="page-card">
              <h4 className="section-title mb-3">Approve Application</h4>
              <div className="mb-3">
                <label className="form-label">Notes (optional)</label>
                <textarea className="form-control" rows="2" value={approveNotes} onChange={(e) => setApproveNotes(e.target.value)} />
              </div>
              <div className="text-end">
                <button className="btn btn-success" onClick={handleApprove} disabled={submitting}>
                  {submitting ? "Approving..." : "Confirm Approval"}
                </button>
              </div>
            </div>
          )}

          {selectedAction === "reject" && (
            <div className="page-card">
              <h4 className="section-title mb-3">Reject Application</h4>

              {Object.entries(incomingFlags).some(([, f]) => f.reasons.length > 0) && (
                <>
                  <p className="text-muted small mb-2">Flagged from document review:</p>
                  {Object.entries(incomingFlags).map(([docType, f]) => {
                    if (f.reasons.length === 0) return null;
                    const options = (reasonsByDocType[docType] || []).filter((r) => r !== OTHER);
                    const label = DOC_TYPES.find((d) => d.key === docType)?.label || docType;
                    return (
                      <div key={docType} className="mb-3">
                        <div className="fw-semibold small mb-1">{label}</div>
                        {options.map((reason) => (
                          <div className="form-check" key={reason}>
                            <input
                              className="form-check-input"
                              type="checkbox"
                              id={`reject-${docType}-${reason}`}
                              checked={rejectReasons.includes(reason)}
                              onChange={() => toggleReject(reason)}
                            />
                            <label className="form-check-label small" htmlFor={`reject-${docType}-${reason}`}>
                              {reason}
                            </label>
                          </div>
                        ))}
                      </div>
                    );
                  })}
                </>
              )}

              <div className="mb-3">
                <div className="fw-semibold small mb-1">General</div>
                {GENERAL_REJECTION_REASONS.map((reason) => (
                  <div className="form-check" key={reason}>
                    <input
                      className="form-check-input"
                      type="checkbox"
                      id={`reject-general-${reason}`}
                      checked={rejectReasons.includes(reason)}
                      onChange={() => toggleReject(reason)}
                    />
                    <label className="form-check-label small" htmlFor={`reject-general-${reason}`}>
                      {reason}
                    </label>
                  </div>
                ))}
                <div className="form-check">
                  <input
                    className="form-check-input"
                    type="checkbox"
                    id="reject-other"
                    checked={rejectOtherChecked}
                    onChange={() => setRejectOtherChecked((v) => !v)}
                  />
                  <label className="form-check-label small" htmlFor="reject-other">{OTHER}</label>
                </div>
                {rejectOtherChecked && (
                  <input
                    className="form-control form-control-sm mt-2"
                    placeholder="Specify the reason..."
                    value={rejectOtherText}
                    onChange={(e) => setRejectOtherText(e.target.value)}
                  />
                )}
              </div>

              <div className="mb-3">
                <label className="form-label">Additional Notes (optional)</label>
                <textarea className="form-control" rows="2" value={rejectNotes} onChange={(e) => setRejectNotes(e.target.value)} />
              </div>

              <div className="text-end">
                <button className="btn btn-danger" onClick={handleReject} disabled={submitting}>
                  {submitting ? "Rejecting..." : "Confirm Rejection"}
                </button>
              </div>
            </div>
          )}

          {selectedAction === "reupload" && (
            <div className="page-card">
              <h4 className="section-title mb-3">Request Re-upload</h4>
              {DOC_TYPES.map((doc) => {
                const state = reuploadDocs[doc.key];
                const options = reasonsByDocType[doc.key].filter((r) => r !== OTHER);
                return (
                  <div key={doc.key} className={`border rounded p-3 mb-2 ${state.checked ? "border-warning bg-warning bg-opacity-10" : "border-light bg-light"}`}>
                    <div className="form-check">
                      <input
                        className="form-check-input"
                        type="checkbox"
                        id={`reup-doc-${doc.key}`}
                        checked={state.checked}
                        onChange={() => toggleReuploadDoc(doc.key)}
                      />
                      <label className="form-check-label fw-semibold" htmlFor={`reup-doc-${doc.key}`}>
                        {doc.label}
                      </label>
                    </div>
                    {state.checked && (
                      <div className="mt-2 ms-4">
                        {options.map((reason) => (
                          <div className="form-check" key={reason}>
                            <input
                              className="form-check-input"
                              type="checkbox"
                              id={`reup-${doc.key}-${reason}`}
                              checked={state.reasons.includes(reason)}
                              onChange={() => toggleReuploadReason(doc.key, reason)}
                            />
                            <label className="form-check-label small" htmlFor={`reup-${doc.key}-${reason}`}>
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
                          <label className="form-check-label small" htmlFor={`reup-other-${doc.key}`}>{OTHER}</label>
                        </div>
                        {state.otherChecked && (
                          <input
                            className="form-control form-control-sm mt-2"
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

              <div className="mb-3 mt-3">
                <label className="form-label">Additional Notes (optional)</label>
                <textarea className="form-control" rows="2" value={reuploadNotes} onChange={(e) => setReuploadNotes(e.target.value)} />
              </div>

              <div className="text-end">
                <button className="btn btn-warning text-dark" onClick={handleReupload} disabled={submitting}>
                  {submitting ? "Submitting..." : "Confirm Re-upload Request"}
                </button>
              </div>
            </div>
          )}
        </div>
      </section>
      <footer className="mt-5 py-3 border-top text-center bg-light">
        <div className="container">
          <p className="mb-0 text-muted small">© 2026 Sangguniang Kabataan of Barangay Mamatid | Verifier Panel</p>
        </div>
      </footer>
    </div>
  );
}

export default VerifierVerificationAction;