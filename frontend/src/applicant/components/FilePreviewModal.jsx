function FilePreviewModal({ previewFile, onClose }) {
  if (!previewFile) return null;

  return (
    <div
      className="position-fixed top-0 start-0 w-100 h-100 d-flex justify-content-center align-items-center"
      style={{
        background: "rgba(0, 0, 0, 0.72)",
        zIndex: 1050,
        padding: "18px",
      }}
      onClick={onClose}
    >
      <div
        className="position-relative bg-white d-flex flex-column"
        style={{
          width: "auto",
          maxWidth: "92vw",
          maxHeight: "94vh",
          borderRadius: "16px",
          boxShadow: "0 18px 55px rgba(0, 0, 0, 0.35)",
          overflow: "hidden",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close preview"
          style={{
            position: "absolute",
            top: "12px",
            right: "12px",
            width: "42px",
            height: "42px",
            borderRadius: "50%",
            border: "1px solid #e1e1e1",
            background: "#ffffff",
            color: "#555",
            fontSize: "28px",
            fontWeight: 300,
            lineHeight: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            boxShadow: "0 3px 10px rgba(0, 0, 0, 0.15)",
            zIndex: 5,
          }}
        >
          ×
        </button>

        <div
          style={{
            padding: "16px 70px 12px 20px",
            borderBottom: "1px solid #ededed",
            background: "#ffffff",
            flexShrink: 0,
          }}
        >
          <strong
            title={previewFile.name}
            style={{
              display: "block",
              maxWidth: "70vw",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              fontSize: "15px",
              fontWeight: 700,
              color: "#222",
            }}
          >
            {previewFile.name}
          </strong>
        </div>

        <div
          style={{
            background: "#f4f4f4",
            padding: "14px",
            overflow: "auto",
          }}
        >
          {previewFile.isImage ? (
            <div
              className="d-flex justify-content-center align-items-center"
              style={{
                minWidth: "280px",
                minHeight: "300px",
              }}
            >
              <div
                style={{
                  background: "#ffffff",
                  border: "1px solid #dddddd",
                  boxShadow: "0 3px 12px rgba(0, 0, 0, 0.12)",
                  borderRadius: "4px",
                  overflow: "hidden",
                  lineHeight: 0,
                }}
              >
                <img
                  src={previewFile.url}
                  alt={previewFile.name}
                  style={{
                    display: "block",
                    maxWidth: "82vw",
                    maxHeight: "82vh",
                    width: "auto",
                    height: "auto",
                    objectFit: "contain",
                  }}
                />
              </div>
            </div>
          ) : (
            <iframe
              src={previewFile.url}
              title={previewFile.name}
              style={{
                width: "82vw",
                height: "82vh",
                maxWidth: "1100px",
                border: "none",
                background: "#ffffff",
                borderRadius: "6px",
                boxShadow: "0 3px 12px rgba(0, 0, 0, 0.12)",
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
}

export default FilePreviewModal;