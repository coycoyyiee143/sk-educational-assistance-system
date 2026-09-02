// frontend/src/applicant/components/ReuploadStep.jsx
import HelpContactLink from "../../components/HelpContactLink";

function ReuploadStep({
    existingApp,
    existingDocs,
    DOC_FIELDS,
    isAutoReupload,
    reuploadFiles,
    reuploadFileErrors,
    setReupload,
    isFieldFlagged,
    flaggedReasonFor,
    isReuploadDisabled,
    missingReuploadFields,
    handleReupload,
    handleViewFile,
    loading,
    uploadProgress,
    activeConfig,
    isMinor,
    applicationId,
    setStep,
}) {
    return (
        <form onSubmit={handleReupload}>
            {isAutoReupload ? (
                <div className="alert alert-warning mb-3">
                    <strong>Re-upload Needed:</strong>{" "}
                    {existingApp.auto_reupload_reason || "Our system detected an issue with one of your uploaded documents."}
                    <div>
                        <HelpContactLink applicationId={applicationId} context="System flagged a document for auto re-upload" />
                    </div>
                </div>
            ) : (
                <div className="alert alert-warning mb-3">
                    <strong>Re-upload Required:</strong> The SK Verifier has requested you to re-upload your documents.
                    <div>
                        <HelpContactLink applicationId={applicationId} context="Verifier requested a document re-upload" />
                    </div>
                </div>
            )}

            <div className="d-flex justify-content-end mb-3">
                <button
                    type="button"
                    className="btn btn-secondary-custom btn-sm"
                    onClick={() => setStep("form")}
                >
                    ← Edit Application Info (School, Course, Year Level)
                </button>
            </div>
            {existingApp?.latest_verifier_action?.notes && (
                <div className="alert alert-info mb-3">
                    <strong>Verifier Note:</strong> {existingApp.latest_verifier_action.notes}
                </div>
            )}
            <div className="sub-card mb-4">
                <h5>Current Documents</h5>
                <p className="text-muted small mb-2">
                    These are the documents currently on file for this application. Use "View" to double-check
                    what was actually uploaded before deciding what to replace.
                </p>
                <div className="table-responsive mb-4">
                    <table className="table table-bordered table-sm">
                        <thead>
                            <tr>
                                <th>Document</th>
                                <th>File</th>
                                <th>Status</th>
                                <th>{isAutoReupload ? "System Reason" : "Verifier Reason"}</th>
                                <th></th>
                            </tr>
                        </thead>
                        <tbody>
                            {DOC_FIELDS.map((field) => {
                                const doc = existingDocs.find((d) => d.document_type === field.type);
                                const docReason = flaggedReasonFor(field);
                                return (
                                    <tr key={field.key} className={docReason ? "table-warning" : ""}>
                                        <td>{field.label}</td>
                                        <td>{doc?.file_name ?? "—"}</td>
                                        <td>{doc && doc.status}</td>
                                        <td>
                                            {docReason ? (
                                                <span className="text-danger fw-semibold">{docReason.reason}</span>
                                            ) : (
                                                <span className="text-muted">—</span>
                                            )}
                                        </td>
                                        <td>
                                            {doc && (
                                                <button
                                                    type="button"
                                                    className="btn btn-outline-secondary btn-sm"
                                                    onClick={() => handleViewFile(doc.id)}
                                                >
                                                    View
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
                <h5>Upload New Documents</h5>
                {activeConfig && (
                    <div className="alert alert-secondary py-2 mb-3">
                        <strong>Note:</strong> Your Registration Form must be for{" "}
                        <strong>A.Y. {activeConfig.school_year}</strong> — the most recent enrollment period.
                        Registration forms from a different school year will not be accepted.
                        {isMinor && (
                            <>
                                {" "}As a minor applicant, upload your <strong>parent/guardian's</strong> Voter's
                                Certificate for the Voter's Certificate requirement — not your own.
                            </>
                        )}
                    </div>
                )}
                <p className="text-muted small mb-3">
                    {isAutoReupload
                        ? "Upload a replacement for the flagged document above. Leave the others blank to keep them as-is."
                        : "Upload replacements for the documents flagged by the verifier. Leave blank to keep existing."}
                </p>
                <div className="row g-3">
                    {DOC_FIELDS.map((field) => {
                        const isRequested = isFieldFlagged(field);
                        return (
                            <div className="col-md-4" key={field.key}>
                                <div className="upload-box">
                                    <label className={`form-label fw-semibold ${isRequested ? "text-danger" : ""}`}>
                                        {field.label}
                                    </label>
                                    <input
                                        type="file"
                                        className={`form-control ${isRequested ? "border-danger" : ""}`}
                                        accept=".jpg,.jpeg,.png,.pdf"
                                        onChange={setReupload(field.key)}
                                    />
                                    <div className="form-text">{field.hint}</div>
                                    {reuploadFileErrors[field.key] && (
                                        <small className="text-danger d-block mt-1">{reuploadFileErrors[field.key]}</small>
                                    )}
                                    {reuploadFiles[field.key] && (
                                        <small className="text-success">✓ {reuploadFiles[field.key].name}</small>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
            {uploadProgress && (
                <div className="alert alert-info mt-3 mb-0">
                    <div className="spinner-border spinner-border-sm me-2" role="status" />
                    {uploadProgress}
                </div>
            )}
            {isReuploadDisabled && (
                <div className="alert alert-danger py-2 mt-3 mb-0">
                    <strong>Cannot Submit:</strong> You must attach replacement files for all requested items:{" "}
                    <span className="fw-semibold">{missingReuploadFields.map((f) => f.label).join(", ")}</span>.
                </div>
            )}
            <div className="d-flex justify-content-end gap-2 mt-4">
                <button type="submit" className="btn btn-submit" disabled={loading || isReuploadDisabled}>
                    {loading ? "Re-uploading..." : "Submit Re-uploaded Documents"}
                </button>
            </div>
        </form>
    );
}

export default ReuploadStep;