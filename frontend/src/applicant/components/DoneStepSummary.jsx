import { STATUS_CONFIG } from "../../components/StatusConstants";

function isImageFile(doc) {
    if (doc?.mime_type) return doc.mime_type.startsWith("image/");
    return /\.(jpg|jpeg|png)$/i.test(doc?.file_name || "");
}

function DoneStepSummary({ success, existingApp, form, DOC_FIELDS, existingDocs, docUrls, setPreviewFile }) {
    return (
        <>
            {!success && (
                <div className="alert alert-info">
                    You have already submitted an application for this period.
                    {existingApp && (
                        <p className="mb-0 mt-2">
                            <strong>Status:</strong> {STATUS_CONFIG[existingApp.status]?.applicantLabel ?? existingApp.status}
                        </p>
                    )}
                </div>
            )}
            <div className="sub-card mb-4">
                <h5>Educational Information</h5>
                <div className="row">
                    <div className="col-md-6 mb-3">
                        <label className="form-label text-muted">School Name</label>
                        <div className="fw-semibold">{form.schoolName || "—"}</div>
                    </div>
                    <div className="col-md-6 mb-3">
                        <label className="form-label text-muted">Course / Program</label>
                        <div className="fw-semibold">{form.course || "—"}</div>
                    </div>
                    <div className="col-md-6 mb-3">
                        <label className="form-label text-muted">Year Level</label>
                        <div className="fw-semibold">{form.yearLevel || "—"}</div>
                    </div>
                </div>
            </div>
            <div className="sub-card">
                <h5>Uploaded Documents</h5>
                <div className="row g-3">
                    {DOC_FIELDS.map((field) => {
                        const doc = existingDocs.find((d) => d.document_type === field.type);
                        if (!doc) return null;
                        const fileUrl = docUrls[doc.id];
                        if (!fileUrl)
                            return (
                                <div className="col-md-4" key={field.key}>
                                    <div
                                        className="upload-box d-flex align-items-center justify-content-center"
                                        style={{ height: "280px" }}
                                    >
                                        <div className="spinner-border spinner-border-sm text-danger" role="status" />
                                    </div>
                                </div>
                            );
                        const imageDoc = isImageFile(doc);
                        return (
                            <div className="col-md-4" key={field.key}>
                                <div className="upload-box d-flex flex-column" style={{ height: "280px" }}>
                                    <label className="form-label fw-semibold">{field.label}</label>
                                    <div
                                        className="position-relative border rounded overflow-hidden flex-shrink-0"
                                        style={{ height: "180px", background: "#f8f9fa", cursor: "pointer" }}
                                        onClick={() => setPreviewFile({ url: fileUrl, isImage: imageDoc, name: doc.file_name })}
                                    >
                                        {imageDoc ? (
                                            <img src={fileUrl} alt={field.label} className="w-100 h-100" style={{ objectFit: "cover" }} />
                                        ) : (
                                            <iframe
                                                src={`${fileUrl}#toolbar=0&navpanes=0&scrollbar=0`}
                                                title={doc.file_name}
                                                className="w-100 h-100 border-0"
                                                style={{ pointerEvents: "none" }}
                                            />
                                        )}
                                        <button
                                            type="button"
                                            className="btn btn-sm btn-light position-absolute"
                                            style={{ top: "6px", right: "6px" }}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setPreviewFile({ url: fileUrl, isImage: imageDoc, name: doc.file_name });
                                            }}
                                        >
                                            ⤢
                                        </button>
                                    </div>
                                    <div className="form-text mt-1 flex-grow-1 d-flex flex-column justify-content-between">
                                        <div className="text-truncate" style={{ maxWidth: "100%" }} title={doc.file_name}>
                                            {doc.file_name}
                                        </div>
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