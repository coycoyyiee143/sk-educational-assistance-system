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
                <h5>Required Document Upload</h5>
                {activeConfig && (
                    <div className="alert alert-secondary py-2 mb-3">
                        <strong>Note:</strong> Your Registration Form must be for{" "}
                        <strong>A.Y. {activeConfig.school_year}</strong> — the most recent enrollment period.
                        Registration forms from a different school year will not be accepted.
                        {isMinor && (
                            <>
                                {" "}As a minor applicant, upload your <strong>parent/guardian's</strong> Voter's
                                Certificate for the Voter's Certificate requirement below — not your own.
                            </>
                        )}
                    </div>
                )}
                <p className="text-muted mb-3">
                    Application info saved. Now upload your three required documents. These will be automatically
                    verified by the system.
                </p>
                <div className="alert alert-warning py-2 mb-3">
                    <strong>Image Quality Guidelines:</strong> Upload clear, readable photos or scans. Ensure good
                    lighting, avoid blur, and keep the full document in frame. Images below {MIN_SHORT_SIDE_PX}px on
                    the shortest side will be rejected automatically. Supported formats: JPG, PNG, PDF. Max size:
                    5MB per file.
                </div>
                <div className="row g-3">
                    {DOC_FIELDS.map((field) => (
                        <div className="col-md-4" key={field.key}>
                            <div className="upload-box">
                                <label className="form-label fw-semibold">
                                    {field.label} <span className="text-danger">*</span>
                                </label>
                                <input
                                    type="file"
                                    className="form-control"
                                    accept=".jpg,.jpeg,.png,.pdf"
                                    onChange={setFile(field.key)}
                                />
                                <div className="form-text">{field.hint}</div>
                                {fileErrors[field.key] && (
                                    <small className="text-danger d-block mt-1">{fileErrors[field.key]}</small>
                                )}
                                {files[field.key] && <small className="text-success">✓ {files[field.key].name}</small>}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
            <div className="form-check mt-4 mb-3">
                <input
                    className="form-check-input"
                    type="checkbox"
                    id="attestationCheck"
                    checked={attestationChecked}
                    onChange={(e) => setAttestationChecked(e.target.checked)}
                />
                <label className="form-check-label" htmlFor="attestationCheck">
                    I certify that all documents submitted are true, accurate, and unaltered. I understand that any
                    falsification of documents, if discovered, will result in immediate termination from the
                    program and forfeiture of any assistance received.
                </label>
            </div>
            {uploadProgress && (
                <div className="alert alert-info mt-3 mb-0">
                    <div className="spinner-border spinner-border-sm me-2" role="status" />
                    {uploadProgress}
                </div>
            )}
            <div className="d-flex justify-content-between gap-2 mt-4">
                <button
                    type="button"
                    className="btn btn-secondary-custom"
                    onClick={onBack}
                    disabled={loading}
                >
                    ← Back to Application Info
                </button>
                <button type="submit" className="btn btn-submit" disabled={loading || !attestationChecked}>
                    {loading ? "Uploading..." : "Submit Documents"}
                </button>
            </div>
        </form>
    );
}

export default DocumentUploadStep;