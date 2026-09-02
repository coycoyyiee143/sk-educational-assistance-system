function FilePreviewModal({ previewFile, onClose }) {
    if (!previewFile) return null;

    return (
        <div
            className="position-fixed top-0 start-0 w-100 h-100 d-flex justify-content-center align-items-center"
            style={{ background: "rgba(0,0,0,0.8)", zIndex: 1050 }}
            onClick={onClose}
        >
            <div
                className="bg-white rounded p-3 d-flex flex-column"
                style={{ width: "90vw", height: "90vh" }}
                onClick={(e) => e.stopPropagation()}
            >
                <div className="d-flex justify-content-between align-items-center mb-2 flex-shrink-0">
                    <strong className="text-truncate me-3">{previewFile.name}</strong>
                    <button type="button" className="btn-close" onClick={onClose} />
                </div>
                <div className="flex-grow-1" style={{ overflow: "hidden" }}>
                    {previewFile.isImage ? (
                        <div className="w-100 h-100 d-flex justify-content-center align-items-center">
                            <img
                                src={previewFile.url}
                                alt={previewFile.name}
                                style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }}
                            />
                        </div>
                    ) : (
                        <iframe src={previewFile.url} title={previewFile.name} className="w-100 h-100 border-0" />
                    )}
                </div>
            </div>
        </div>
    );
}

export default FilePreviewModal;