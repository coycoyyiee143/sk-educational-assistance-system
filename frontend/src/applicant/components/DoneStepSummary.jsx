import { STATUS_CONFIG } from "../../components/StatusConstants";

function isImageFile(doc) {
    if (doc?.mime_type) return doc.mime_type.startsWith("image/");
    return /\.(jpg|jpeg|png)$/i.test(doc?.file_name || "");
}

function fileTypeLabel(doc) {
    const ext = (doc?.file_name || "").split(".").pop()?.toUpperCase();
    return ext || "FILE";
}

function formatFileSize(bytes) {
    if (!bytes && bytes !== 0) return null;
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function DoneStepSummary({
    success,
    existingApp,
    form,
    DOC_FIELDS,
    existingDocs,
    docUrls,
    setPreviewFile,
}) {
    const uploadedCount = DOC_FIELDS.filter((field) =>
        existingDocs.some((d) => d.document_type === field.type)
    ).length;

    const statusInfo = existingApp
        ? STATUS_CONFIG[existingApp.status]
        : null;

    return (
        <>
            {!success && (
                <div className="submitted-notice">
                    <div className="submitted-notice-icon">
                        ✓
                    </div>

                    <div className="submitted-notice-content">
                        <strong className="submitted-notice-title">
                            You have already submitted an application for this period.
                        </strong>

                        {existingApp && (
                            <p className="submitted-notice-meta">
                                Ref ID: <strong>APP-{existingApp.id}</strong>

                                {existingApp.submitted_at && (
                                    <>
                                        {" "}• Submitted on{" "}
                                        {new Date(
                                            existingApp.submitted_at
                                        ).toLocaleDateString("en-US", {
                                            month: "long",
                                            day: "numeric",
                                            year: "numeric",
                                        })}
                                    </>
                                )}
                            </p>
                        )}
                    </div>

                    {statusInfo && (
                        <span
                            className={`status-badge submitted-notice-status ${
                                statusInfo.badgeClass ??
                                "status-pending"
                            }`}
                        >
                            {statusInfo.applicantLabel ??
                                existingApp.status}
                        </span>
                    )}
                </div>
            )}

            <div className="submitted-section-card">
                <div className="submitted-section-header">
                    <div className="submitted-section-heading-wrap">
                        <div className="submitted-section-icon">
                            <svg
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            >
                                <path d="M22 10v6M2 10l10-5 10 5-10 5-10-5z" />
                                <path d="M6 12v5c0 1.5 2.7 3 6 3s6-1.5 6-3v-5" />
                            </svg>
                        </div>

                        <h4 className="submitted-section-title">
                            Educational Information
                        </h4>
                    </div>
                </div>

                <div className="submitted-info-grid">
                    <div className="submitted-info-item">
                        <span className="submitted-info-label">
                            School Name
                        </span>

                        <strong className="submitted-info-value">
                            {form.schoolName || "—"}
                        </strong>
                    </div>

                    <div className="submitted-info-item">
                        <span className="submitted-info-label">
                            Course / Program
                        </span>

                        <strong className="submitted-info-value">
                            {form.course || "—"}
                        </strong>
                    </div>

                    <div className="submitted-info-item">
                        <span className="submitted-info-label">
                            Year Level
                        </span>

                        <strong className="submitted-info-value">
                            {form.yearLevel || "—"}
                        </strong>
                    </div>
                </div>
            </div>

            <div className="submitted-section-card">
                <div className="submitted-section-header submitted-documents-header">
                    <div>
                        <div className="submitted-section-heading-wrap">
                            <div className="submitted-section-icon">
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
                                    <path d="M9 15l2 2 4-4" />
                                </svg>
                            </div>

                            <div>
                                <h4 className="submitted-section-title">
                                    Uploaded Documents
                                </h4>

                                <p className="submitted-section-desc">
                                    Here are the documents you submitted for this application.
                                </p>
                            </div>
                        </div>
                    </div>

                    <span className="submitted-files-count">
                        {uploadedCount} of {DOC_FIELDS.length} Files Provided
                    </span>
                </div>

                <div className="row g-3">
                    {DOC_FIELDS.map((field) => {
                        const doc = existingDocs.find(
                            (d) =>
                                d.document_type ===
                                field.type
                        );

                        if (!doc) return null;

                        const docUrlEntry =
                            docUrls[doc.id];

                        const fileUrl =
                            docUrlEntry?.url;

                        if (!fileUrl) {
                            return (
                                <div
                                    className="col-md-4"
                                    key={field.key}
                                >
                                    <div className="submitted-document-card submitted-document-loading">
                                        <div
                                            className="spinner-border spinner-border-sm text-danger"
                                            role="status"
                                        />
                                    </div>
                                </div>
                            );
                        }

                        const imageDoc =
                            isImageFile(doc);

                        const sizeLabel =
                            formatFileSize(
                                docUrlEntry?.size
                            );

                        return (
                            <div
                                className="col-md-4"
                                key={field.key}
                            >
                                <div className="submitted-document-card">
                                    <div className="submitted-document-top">
                                        <h6 className="submitted-document-title">
                                            {field.label}
                                        </h6>

                                        <span className="submitted-file-type">
                                            {fileTypeLabel(doc)}
                                        </span>
                                    </div>

                                    <div
                                        className="submitted-document-preview"
                                        onClick={() =>
                                            setPreviewFile({
                                                url: fileUrl,
                                                isImage:
                                                    imageDoc,
                                                name:
                                                    doc.file_name,
                                            })
                                        }
                                    >
                                        {imageDoc ? (
                                            <img
                                                src={fileUrl}
                                                alt={
                                                    field.label
                                                }
                                            />
                                        ) : (
                                            <iframe
                                                src={`${fileUrl}#toolbar=0&navpanes=0&scrollbar=0`}
                                                title={
                                                    doc.file_name
                                                }
                                            />
                                        )}
                                    </div>

                                    <div className="submitted-document-info">
                                        <div
                                            className="submitted-document-filename"
                                            title={
                                                doc.file_name
                                            }
                                        >
                                            {doc.file_name}
                                        </div>

                                        {sizeLabel && (
                                            <div className="submitted-document-meta">
                                                {fileTypeLabel(
                                                    doc
                                                )}{" "}
                                                • {sizeLabel}
                                            </div>
                                        )}

                                        <button
                                            type="button"
                                            className="submitted-view-button"
                                            onClick={() =>
                                                setPreviewFile({
                                                    url: fileUrl,
                                                    isImage:
                                                        imageDoc,
                                                    name:
                                                        doc.file_name,
                                                })
                                            }
                                        >
                                            <svg
                                                viewBox="0 0 24 24"
                                                fill="none"
                                                stroke="currentColor"
                                                strokeWidth="2"
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                            >
                                                <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z" />
                                                <circle
                                                    cx="12"
                                                    cy="12"
                                                    r="3"
                                                />
                                            </svg>

                                            View Document
                                        </button>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </>
    );
}

export default DoneStepSummary;