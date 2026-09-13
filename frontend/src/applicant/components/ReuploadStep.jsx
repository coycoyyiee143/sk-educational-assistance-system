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
            <div className="reupload-main-notice">
                <div className="reupload-main-notice-icon">!</div>
                <div className="reupload-main-notice-body">
                    <strong className="reupload-main-notice-title">
                        {isAutoReupload ? "Re-upload Needed" : "Re-upload Required"}
                    </strong>
                    <p className="reupload-main-notice-text">
                        {isAutoReupload
                            ? existingApp.auto_reupload_reason ||
                              "Our system detected an issue with one of your uploaded documents."
                            : "The SK Verifier has requested you to replace one or more uploaded documents."}
                    </p>
                    <div className="mt-2">
                        <HelpContactLink
                            applicationId={applicationId}
                            context={
                                isAutoReupload
                                    ? "System flagged a document for auto re-upload"
                                    : "Verifier requested a document re-upload"
                            }
                        />
                    </div>
                </div>
            </div>
            <div className="d-flex justify-content-end mt-3 mb-3">
                <button
                    type="button"
                    className="btn btn-secondary-custom btn-sm"
                    onClick={() => setStep("form")}
                >
                    ← Edit Application Info
                </button>
            </div>
            {existingApp?.latest_verifier_action?.notes && (
                <div className="reupload-verifier-note mb-3">
                    <strong>Verifier Note</strong>
                    <p className="mb-0 mt-1">
                        {existingApp.latest_verifier_action.notes}
                    </p>
                </div>
            )}
            <div className="sub-card mb-4">
                <div className="reupload-section-heading">
                    <h5 className="mb-1">Current Documents</h5>
                    <p className="text-muted mb-0">
                        Review the documents currently on file. Documents requiring replacement are highlighted below.
                    </p>
                </div>
                <div className="row g-3 mt-1">
                    {DOC_FIELDS.map((field) => {
                        const doc = existingDocs.find(
                            (d) => d.document_type === field.type
                        );
                        const docReason = flaggedReasonFor(field);
                        const flagged = !!docReason;
                        return (
                            <div className="col-md-4" key={field.key}>
                                <div
                                    className={`reupload-current-card ${
                                        flagged ? "reupload-current-card-flagged" : ""
                                    }`}
                                >
                                    <div className="reupload-current-card-top">
                                        <div>
                                            <h6 className="reupload-current-card-title">
                                                {field.label}
                                            </h6>
                                            <span
                                                className={`reupload-current-status ${
                                                    flagged
                                                        ? "reupload-current-status-flagged"
                                                        : "reupload-current-status-ok"
                                                }`}
                                            >
                                                {flagged
                                                    ? "Needs Replacement"
                                                    : "Current File"}
                                            </span>
                                        </div>
                                        <div
                                            className={`reupload-current-icon ${
                                                flagged ? "is-flagged" : ""
                                            }`}
                                        >
                                            <svg
                                                viewBox="0 0 24 24"
                                                fill="none"
                                                stroke="currentColor"
                                                strokeWidth="2"
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                            >
                                                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                                                <polyline points="14 2 14 8 20 8" />
                                            </svg>
                                        </div>
                                    </div>
                                    <div
                                        className="reupload-current-filename"
                                        title={doc?.file_name || "No file"}
                                    >
                                        {doc?.file_name || "No file available"}
                                    </div>
                                    {flagged && (
                                        <div className="reupload-current-reason">
                                            <strong>
                                                {isAutoReupload
                                                    ? "System Reason"
                                                    : "Verifier Reason"}
                                            </strong>
                                            <p className="mb-0 mt-1">
                                                {docReason.reason}
                                            </p>
                                        </div>
                                    )}
                                    <div className="reupload-current-actions">
                                        {doc && (
                                            <button
                                                type="button"
                                                className="btn btn-outline-secondary btn-sm"
                                                onClick={() =>
                                                    handleViewFile(doc.id)
                                                }
                                            >
                                                View Document
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
            <div className="sub-card">
                <div className="reupload-section-heading">
                    <h5 className="mb-1">Upload Replacement Documents</h5>
                    <p className="text-muted mb-0">
                        {isAutoReupload
                            ? "Upload a replacement for each flagged document. Leave unflagged documents unchanged."
                            : "Upload replacements for all documents requested by the verifier."}
                    </p>
                </div>
                {activeConfig && (
                    <div className="reupload-requirement-notice mt-3 mb-4">
                        <div className="reupload-requirement-icon">!</div>
                        <div>
                            <strong>Document Requirement</strong>
                            <p className="mb-0 mt-1">
                                Your Registration Form must be for{" "}
                                <strong>
                                    A.Y. {activeConfig.school_year}
                                </strong>{" "}
                                — the most recent enrollment period.
                                Registration forms from a different school year
                                will not be accepted.
                                {isMinor && (
                                    <>
                                        {" "}
                                        As a minor applicant, upload your{" "}
                                        <strong>
                                            parent/guardian's
                                        </strong>{" "}
                                        Voter's Certificate — not your own.
                                    </>
                                )}
                                {" "}Only JPG or PNG photos are accepted — PDF files will not be accepted.
                            </p>
                        </div>
                    </div>
                )}
                <div className="row g-3">
                    {DOC_FIELDS.map((field) => {
                        const isRequested = isFieldFlagged(field);
                        const selectedFile = reuploadFiles[field.key];
                        const hasError = !!reuploadFileErrors[field.key];
                        return (
                            <div className="col-md-4" key={field.key}>
                                <div
                                    className={`reupload-upload-card ${
                                        isRequested
                                            ? "reupload-upload-card-required"
                                            : ""
                                    } ${
                                        selectedFile
                                            ? "reupload-upload-card-selected"
                                            : ""
                                    } ${
                                        hasError
                                            ? "reupload-upload-card-error"
                                            : ""
                                    }`}
                                >
                                    <div className="reupload-upload-header">
                                        <div>
                                            <h6 className="reupload-upload-title">
                                                {field.label}
                                            </h6>
                                            <span
                                                className={`reupload-request-badge ${
                                                    isRequested
                                                        ? "required"
                                                        : "optional"
                                                }`}
                                            >
                                                {isRequested
                                                    ? "Replacement Required"
                                                    : "Keep Existing"}
                                            </span>
                                        </div>
                                        <div className="reupload-upload-icon">
                                            <svg
                                                viewBox="0 0 24 24"
                                                fill="none"
                                                stroke="currentColor"
                                                strokeWidth="2"
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                            >
                                                <path d="M12 3v12" />
                                                <path d="M7 8l5-5 5 5" />
                                                <path d="M5 21h14" />
                                            </svg>
                                        </div>
                                    </div>
                                    <p className="reupload-upload-hint">
                                        {field.hint}
                                    </p>
                                    <label
                                        className="reupload-file-picker"
                                        style={!isRequested ? { opacity: 0.5, cursor: "not-allowed" } : undefined}
                                    >
                                        <input
                                            type="file"
                                            accept=".jpg,.jpeg,.png"
                                            onChange={setReupload(field.key)}
                                            disabled={!isRequested}
                                            hidden
                                        />
                                        <span className="reupload-file-button">
                                            Choose File
                                        </span>
                                        <span
                                            className={`reupload-file-name ${
                                                selectedFile ? "has-file" : ""
                                            }`}
                                            title={
                                                selectedFile?.name ||
                                                "No file selected"
                                            }
                                        >
                                            {selectedFile?.name ||
                                                "No file selected"}
                                        </span>
                                    </label>
                                    {hasError && (
                                        <div className="reupload-file-error">
                                            <span>!</span>
                                            <p>
                                                {
                                                    reuploadFileErrors[
                                                        field.key
                                                    ]
                                                }
                                            </p>
                                        </div>
                                    )}
                                    {selectedFile && !hasError && (
                                        <div className="reupload-file-success">
                                            <span className="reupload-file-success-icon">
                                                ✓
                                            </span>
                                            <div className="reupload-file-success-text">
                                                <strong>
                                                    Replacement selected
                                                </strong>
                                                <span
                                                    title={selectedFile.name}
                                                >
                                                    {selectedFile.name}
                                                </span>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
            {uploadProgress && (
                <div className="alert alert-info mt-3 mb-0">
                    <div
                        className="spinner-border spinner-border-sm me-2"
                        role="status"
                    />
                    {uploadProgress}
                </div>
            )}
            {isReuploadDisabled && (
                <div className="reupload-submit-warning mt-3">
                    <div className="reupload-submit-warning-icon">!</div>
                    <div>
                        <strong>Cannot Submit Yet</strong>
                        <p className="mb-0 mt-1">
                            Attach replacement files for:{" "}
                            <strong>
                                {missingReuploadFields
                                    .map((f) => f.label)
                                    .join(", ")}
                            </strong>
                            .
                        </p>
                    </div>
                </div>
            )}
            <div className="d-flex justify-content-end gap-2 mt-4">
                <button
                    type="submit"
                    className="btn btn-submit"
                    disabled={loading || isReuploadDisabled}
                >
                    {loading
                        ? "Re-uploading..."
                        : "Submit Replacement Documents"}
                </button>
            </div>
        </form>
    );
}

export default ReuploadStep;