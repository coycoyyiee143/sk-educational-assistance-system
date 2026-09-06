import { MIN_SHORT_SIDE_PX } from "../utils/imageChecks";

function DocumentUploadStep({
    isProfileComplete,
    activeConfig,
    isMinor,
    DOC_FIELDS,
    files,
    fileErrors,
    setFile,
    attestationChecked,
    setAttestationChecked,
    uploadProgress,
    loading,
    onBack,
    onSubmit,
}) {
    if (!isProfileComplete) {
        return (
            <div className="sub-card">
                <div className="alert alert-warning mb-3">
                    <strong>Complete Your Profile First</strong>

                    <p className="mb-2 mt-2">
                        Before uploading documents, please complete your profile
                        (address, gender, civil status, and other required information).
                        This information is needed to properly process your application.
                    </p>

                    <a href="/ApplicantProfile" className="btn btn-submit btn-sm">
                        Go to Profile
                    </a>
                </div>
            </div>
        );
    }

    return (
        <form onSubmit={onSubmit}>
            <div className="sub-card">
                <div className="document-upload-heading">
                    <h5 className="mb-1">Required Document Upload</h5>
                    <p className="text-muted mb-0">
                        Upload all required documents before submitting your application.
                    </p>
                </div>

                {activeConfig && (
                    <div className="document-upload-notice mb-3">
                        <div className="document-upload-notice-icon">!</div>

                        <div>
                            <strong>Registration Form Requirement</strong>

                            <p className="mb-0 mt-1">
                                Your Registration Form must be for{" "}
                                <strong>A.Y. {activeConfig.school_year}</strong> — the most recent enrollment period.
                                Registration forms from a different school year will not be accepted.

                                {isMinor && (
                                    <>
                                        {" "}As a minor applicant, upload your{" "}
                                        <strong>parent/guardian's</strong> Voter's Certificate
                                        for the requirement below — not your own.
                                    </>
                                )}
                            </p>
                        </div>
                    </div>
                )}

                <div className="document-quality-notice mb-4">
                    <div className="document-quality-notice-icon">i</div>

                    <div>
                        <strong>Image Quality Guidelines</strong>

                        <p className="mb-0 mt-1">
                            Upload clear, readable photos or scans. Ensure good lighting,
                            avoid blur, and keep the full document in frame. Images below{" "}
                            <strong>{MIN_SHORT_SIDE_PX}px</strong> on the shortest side will
                            be rejected automatically. Supported formats: JPG, PNG, PDF.
                            Maximum file size: 5MB.
                        </p>
                    </div>
                </div>

                <div className="row g-3">
                    {DOC_FIELDS.map((field) => {
                        const selectedFile = files[field.key];
                        const hasError = !!fileErrors[field.key];

                        return (
                            <div className="col-md-4" key={field.key}>
                                <div
                                    className={`document-upload-card ${
                                        selectedFile ? "document-upload-card-selected" : ""
                                    } ${hasError ? "document-upload-card-error" : ""}`}
                                >
                                    <div className="document-upload-card-header">
                                        <div>
                                            <h6 className="document-upload-card-title">
                                                {field.label}
                                                <span className="text-danger ms-1">*</span>
                                            </h6>

                                            <p className="document-upload-card-hint">
                                                {field.hint}
                                            </p>
                                        </div>

                                        <div className="document-upload-card-icon">
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
                                                <path d="M12 18v-6" />
                                                <path d="M9 15l3-3 3 3" />
                                            </svg>
                                        </div>
                                    </div>

                                    <label className="document-upload-picker">
                                        <input
                                            type="file"
                                            accept=".jpg,.jpeg,.png,.pdf"
                                            onChange={setFile(field.key)}
                                            hidden
                                        />

                                        <span className="document-upload-button">
                                            Choose File
                                        </span>

                                        <span
                                            className={`document-upload-filename ${
                                                selectedFile ? "has-file" : ""
                                            }`}
                                            title={selectedFile?.name || "No file selected"}
                                        >
                                            {selectedFile?.name || "No file selected"}
                                        </span>
                                    </label>

                                    {hasError && (
                                        <div className="document-upload-error">
                                            <span>!</span>
                                            <p>{fileErrors[field.key]}</p>
                                        </div>
                                    )}

                                    {selectedFile && !hasError && (
                                        <div className="document-upload-success">
                                            <span className="document-upload-success-icon">
                                                ✓
                                            </span>

                                            <div className="document-upload-success-text">
                                                <strong>File selected</strong>
                                                <span title={selectedFile.name}>
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

            <div className="document-attestation mt-4">
                <div className="form-check mb-0">
                    <input
                        className="form-check-input"
                        type="checkbox"
                        id="attestationCheck"
                        checked={attestationChecked}
                        onChange={(e) =>
                            setAttestationChecked(e.target.checked)
                        }
                    />

                    <label
                        className="form-check-label"
                        htmlFor="attestationCheck"
                    >
                        I certify that all documents submitted are true,
                        accurate, and unaltered. I understand that any
                        falsification of documents, if discovered, will result
                        in immediate termination from the program and
                        forfeiture of any assistance received.
                    </label>
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

            <div className="d-flex justify-content-between gap-2 mt-4 flex-wrap">
                <button
                    type="button"
                    className="btn btn-secondary-custom"
                    onClick={onBack}
                    disabled={loading}
                >
                    ← Back to Application Info
                </button>

                <button
                    type="submit"
                    className="btn btn-submit"
                    disabled={loading || !attestationChecked}
                >
                    {loading ? "Uploading..." : "Submit Documents"}
                </button>
            </div>
        </form>
    );
}

export default DocumentUploadStep;