import { useState, useEffect } from "react";
import ApplicantNavigation from "../components/ApplicantNavigation";
import api from "../../services/api";

const SCHOOLS = [
  "Pamantasan ng Cabuyao",
  "Mapúa Malayan Colleges Laguna",
  "St. Vincent College of Cabuyao",
  "Our Lady of Assumption College",
  "Colegio de Sto. Niño de Cabuyao",
  "Calamba Doctor's College",
  "STI College Calamba",
  "University of Perpetual Help System DALTA Calamba",
  "Colegio de San Juan de Letran Calamba",
  "De La Salle University Canlubang",
  "AMA Computer College Calamba",
  "University of the Philippines Los Baños",
  "Lyceum of the Philippines University Laguna",
  "Laguna College of Business and Arts",
  "Dominican College of Santa Rosa",
  "Polytechnic University of the Philippines Santa Rosa",
];

const YEAR_LEVELS = ["1st Year", "2nd Year", "3rd Year", "4th Year"];

const DOC_FIELDS = [
  {
    key: "enrollment",
    type: "registration_form",
    label: "Certificate of Enrollment / Registration Form",
    hint: "Must show your name, school, and school year.",
  },
  {
    key: "schoolId",
    type: "school_id",
    label: "School ID",
    hint: "Must show your name and school name.",
  },
  {
    key: "voters",
    type: "voters_certificate",
    label: "Voter's Certificate",
    hint: "Must show your name and Barangay Mamatid as your registered barangay.",
  },
];

const emptyForm = {
  schoolName: "",
  schoolAddr: "",
  course: "",
  yearLevel: "",
  studentId: "",
};

// Component 
function ApplicantSubmission() {
  const [form, setForm] = useState(emptyForm);
  const [files, setFiles] = useState({ enrollment: null, schoolId: null, voters: null });
  const [reuploadFiles, setReuploadFiles] = useState({ enrollment: null, schoolId: null, voters: null });

  const [applicationId, setApplicationId] = useState(null);
  const [existingApp, setExistingApp] = useState(null);
  const [existingDocs, setExistingDocs] = useState([]);

  const [step, setStep] = useState("form"); // "form" | "documents" | "reupload" | "done"
  const [checkingApp, setCheckingApp] = useState(true);
  const [loading, setLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const setFile = (k) => (e) => setFiles((f) => ({ ...f, [k]: e.target.files[0] ?? null }));
  const setReupload = (k) => (e) => setReuploadFiles((f) => ({ ...f, [k]: e.target.files[0] ?? null }));
  const [activeConfig, setActiveConfig] = useState(null);

  useEffect(() => {
    api.get("/application-config/active")
      .then((res) => setActiveConfig(res.data))
      .catch(() => { });
  }, []);

  // Resume in-progress application on load
  useEffect(() => {
    api
      .get("/applications")
      .then(async (res) => {
        if (res.data.length > 0) {
          const app = res.data[0];
          setExistingApp(app);
          setApplicationId(app.id);

          // pre-fill form so Back button shows what they entered
          setForm({
            schoolName: app.school_name ?? "",
            schoolAddr: app.school_address ?? "",
            course: app.course ?? "",
            yearLevel: app.year_level ?? "",
            studentId: app.student_id_number ?? "",
          });

          if (app.status === "reupload_requested") {
            const docsRes = await api.get(`/applications/${app.id}/documents`);
            setExistingDocs(docsRes.data);
            setStep("reupload");
          } else {
            const docsRes = await api.get(`/applications/${app.id}/documents`);
            if (docsRes.data.length < 3) {
              // application row exists but documents were never finished
              setStep("documents");
            } else {
              setStep("done");
            }
          }
        }
      })
      .catch(() => { })
      .finally(() => setCheckingApp(false));
  }, []);

  // Reupload validation 
  const reuploadDetails = existingApp?.latest_verifier_action?.reupload_details ?? [];
  const missingReuploadFields = DOC_FIELDS.filter((field) => {
    const isRequested = reuploadDetails.some((r) => r.document_type === field.type);
    const hasNewFile = !!reuploadFiles[field.key];
    return isRequested && !hasNewFile;
  });
  const isReuploadDisabled = missingReuploadFields.length > 0;

  // Step 1: create or edit application info
  async function handleSubmitForm(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const payload = {
        school_name: form.schoolName,
        school_address: form.schoolAddr,
        course: form.course,
        year_level: form.yearLevel,
        student_id_number: form.studentId,
      };

      if (applicationId) {
        // already created earlier — user came back via Back button, just update
        await api.put(`/applications/${applicationId}`, payload);
      } else {
        const res = await api.post("/applications", payload);
        setApplicationId(res.data.application.id);
      }

      setStep("documents");
    } catch (err) {
      const errors = err.response?.data?.errors;
      setError(
        errors
          ? Object.values(errors).flat().join(" ")
          : err.response?.data?.message || "Failed to submit application."
      );
    } finally {
      setLoading(false);
    }
  }

  function handleClear() {
    setForm(emptyForm);
  }

  // Step 2: upload documents
  async function handleUploadDocuments(e) {
    e.preventDefault();
    setError("");
    if (!files.enrollment || !files.schoolId || !files.voters) {
      setError("Please upload all three required documents.");
      return;
    }
    setLoading(true);

    const uploadDoc = async (file, documentType, label) => {
      setUploadProgress(`Uploading ${label}...`);
      const formData = new FormData();
      formData.append("file", file);
      formData.append("document_type", documentType);
      await api.post(`/applications/${applicationId}/documents`, formData);
    };

    try {
      await uploadDoc(files.enrollment, "registration_form", "Registration Form");
      await uploadDoc(files.schoolId, "school_id", "School ID");
      await uploadDoc(files.voters, "voters_certificate", "Voter's Certificate");
      setUploadProgress("");
      setSuccess("Application and documents submitted successfully! Your documents are being processed.");
      setStep("done");
    } catch (err) {
      setUploadProgress("");
      const errors = err.response?.data?.errors;
      setError(
        errors
          ? "Upload failed: " + Object.values(errors).flat().join(" ")
          : `Upload failed: ${err.response?.data?.message || "Please check your files and try again."}`
      );
    } finally {
      setLoading(false);
    }
  }

  // ── Reupload flow ────────────────────────────────────────────────────────────
  async function handleReupload(e) {
    e.preventDefault();
    setError("");

    if (isReuploadDisabled) {
      const missingLabels = missingReuploadFields.map((f) => f.label).join(", ");
      setError(`You must upload all documents flagged for corrections. Missing: ${missingLabels}`);
      return;
    }

    setLoading(true);
    const reuploadDoc = async (file, docType, label) => {
      if (!file) return;
      const existingDoc = existingDocs.find((d) => d.document_type === docType);
      if (!existingDoc) return;
      setUploadProgress(`Re-uploading ${label}...`);
      const formData = new FormData();
      formData.append("file", file);
      await api.post(`/applications/${applicationId}/documents/${existingDoc.id}/reupload`, formData);
    };

    try {
      await reuploadDoc(reuploadFiles.enrollment, "registration_form", "Registration Form");
      await reuploadDoc(reuploadFiles.schoolId, "school_id", "School ID");
      await reuploadDoc(reuploadFiles.voters, "voters_certificate", "Voter's Certificate");
      setUploadProgress("");
      setSuccess("Documents re-uploaded successfully! Your application is being re-processed.");
      setStep("done");
    } catch (err) {
      setUploadProgress("");
      setError(`Re-upload failed: ${err.response?.data?.message || "Please try again."}`);
    } finally {
      setLoading(false);
    }
  }

  if (checkingApp) {
    return (
      <div>
        <ApplicantNavigation />
        <div className="d-flex justify-content-center align-items-center" style={{ height: "60vh" }}>
          <div className="spinner-border text-danger" role="status" />
        </div>
      </div>
    );
  }

  return (
    <div>
      <ApplicantNavigation />
      <section className="page-section">
        <div className="container">
          <div className="page-card">
            <h3 className="section-title">Application Submission</h3>
            <p className="text-muted mb-4">
              Complete the educational information and upload the required supporting documents for verification.
            </p>

            {error && <div className="alert alert-danger">{error}</div>}
            {success && <div className="alert alert-success">{success}</div>}

            {/* Already applied - done state */}
            {step === "done" && !success && (
              <div className="alert alert-info">
                You have already submitted an application for this period.
                {existingApp && (
                  <p className="mb-0 mt-2">
                    <strong>Status:</strong> {existingApp.status}
                  </p>
                )}
              </div>
            )}

            {/* Re-upload form */}
            {step === "reupload" && (
              <form onSubmit={handleReupload}>
                <div className="alert alert-warning mb-3">
                  <strong>Re-upload Required:</strong> The SK Verifier has requested you to re-upload your documents.
                </div>

                {existingApp?.latest_verifier_action?.notes && (
                  <div className="alert alert-info mb-3">
                    <strong>Verifier Note:</strong> {existingApp.latest_verifier_action.notes}
                  </div>
                )}

                <div className="sub-card mb-4">
                  <h5>Current Documents</h5>
                  <div className="table-responsive mb-4">
                    <table className="table table-bordered table-sm">
                      <thead>
                        <tr>
                          <th>Document</th>
                          <th>File</th>
                          <th>Status</th>
                          <th>Verifier Reason</th>
                        </tr>
                      </thead>
                      <tbody>
                        {DOC_FIELDS.map((field) => {
                          const doc = existingDocs.find((d) => d.document_type === field.type);
                          const docReason = reuploadDetails.find((r) => r.document_type === field.type);
                          return (
                            <tr key={field.key} className={docReason ? "table-warning" : ""}>
                              <td>{field.label}</td>
                              <td>{doc?.file_name ?? "—"}</td>
                              <td>
                                {doc &&
                                  (docReason ? (
                                    <span className="badge bg-danger">Re-upload Required</span>
                                  ) : doc.status === "processed" ? (
                                    <span className="badge bg-success">Passed</span>
                                  ) : doc.status === "failed" ? (
                                    <span className="badge bg-danger">Failed</span>
                                  ) : (
                                    <span className="badge bg-secondary">{doc.status}</span>
                                  ))}
                              </td>
                              <td>
                                {docReason ? (
                                  <span className="text-danger fw-semibold">{docReason.reason}</span>
                                ) : (
                                  <span className="text-muted">—</span>
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
                      <strong>A.Y. {activeConfig.school_year}</strong> — the most
                      recent enrollment period. Registration forms from a different school year will
                      not be accepted.
                    </div>
                  )}

                  <p className="text-muted small mb-3">
                    Upload replacements for the documents flagged by the verifier. Leave blank to keep existing.
                  </p>
                  <div className="row g-3">
                    {DOC_FIELDS.map((field) => {
                      const isRequested = reuploadDetails.some((r) => r.document_type === field.type);
                      return (
                        <div className="col-md-4" key={field.key}>
                          <div className="upload-box">
                            <label className={`form-label fw-semibold ${isRequested ? "text-danger" : ""}`}>
                              {field.label}
                              {isRequested && <span className="badge bg-danger ms-1">Re-upload Required</span>}
                            </label>
                            <input
                              type="file"
                              className={`form-control ${isRequested ? "border-danger" : ""}`}
                              accept=".jpg,.jpeg,.png,.pdf"
                              onChange={setReupload(field.key)}
                            />
                            <div className="form-text">{field.hint}</div>
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
            )}

            {/* Step 1: Application Form */}
            {step === "form" && (
              <form onSubmit={handleSubmitForm}>
                <div className="row g-4">
                  <div className="col-12">
                    <div className="sub-card">
                      <h5>Educational Information</h5>
                      <div className="alert alert-warning py-2 mb-3">
                        <strong>Important:</strong> Make sure the details you input match exactly how they
                        appear on your Registration Form. This is used to verify your document.
                      </div>
                      <div className="row">
                        <div className="col-md-6 mb-3">
                          <label className="form-label">
                            School Name <span className="text-danger">*</span>
                          </label>
                          <select className="form-select" value={form.schoolName} onChange={set("schoolName")} required>
                            <option value="" disabled>
                              Select your school
                            </option>
                            {SCHOOLS.map((s) => (
                              <option key={s} value={s}>
                                {s}
                              </option>
                            ))}
                          </select>
                          <div className="form-text">Select the school as it appears on your Registration Form.</div>
                        </div>
                        <div className="col-md-6 mb-3">
                          <label className="form-label">School Address</label>
                          <input
                            className="form-control"
                            placeholder="Enter school address"
                            value={form.schoolAddr}
                            onChange={set("schoolAddr")}
                          />
                        </div>
                        <div className="col-md-6 mb-3">
                          <label className="form-label">
                            Course / Program <span className="text-danger">*</span>
                          </label>
                          <input
                            className="form-control"
                            placeholder="Enter your course or program"
                            value={form.course}
                            onChange={set("course")}
                            required
                          />
                        </div>
                        <div className="col-md-6 mb-3">
                          <label className="form-label">
                            Year Level <span className="text-danger">*</span>
                          </label>
                          <select className="form-select" value={form.yearLevel} onChange={set("yearLevel")} required>
                            <option value="" disabled>
                              Select year level
                            </option>
                            {YEAR_LEVELS.map((y) => (
                              <option key={y}>{y}</option>
                            ))}
                          </select>
                        </div>
                        <div className="col-md-6 mb-3">
                          <label className="form-label">Student ID Number</label>
                          <input
                            className="form-control"
                            placeholder="Enter student ID number"
                            value={form.studentId}
                            onChange={set("studentId")}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="d-flex justify-content-end gap-2 mt-4">
                  <button type="button" className="btn btn-secondary-custom" onClick={handleClear}>
                    Clear Form
                  </button>
                  <button type="submit" className="btn btn-submit" disabled={loading}>
                    {loading ? "Submitting..." : "Next: Upload Documents"}
                  </button>
                </div>
              </form>
            )}

            {/* Step 2: Document Upload */}
            {step === "documents" && (
              <form onSubmit={handleUploadDocuments}>
                <div className="sub-card">
                  <h5>Required Document Upload</h5>

                  {activeConfig && (
                    <div className="alert alert-secondary py-2 mb-3">
                      <strong>Note:</strong> Your Registration Form must be for{" "}
                      <strong>A.Y. {activeConfig.school_year}</strong> — the most
                      recent enrollment period. Registration forms from a different school year will
                      not be accepted.
                    </div>
                  )}

                  <p className="text-muted mb-3">
                    Application info saved. Now upload your three required documents. These will be
                    automatically verified by the system.
                  </p>
                  <div className="alert alert-warning py-2 mb-3">
                    <strong>Reminder:</strong> Upload clear, readable photos or scans. Blurry or low-quality
                    images may cause your application to be requested for a reupload. Supported formats: JPG,
                    PNG, PDF. Max size: 5MB per file.
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
                          {files[field.key] && <small className="text-success">✓ {files[field.key].name}</small>}
                        </div>
                      </div>
                    ))}
                  </div>
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
                    onClick={() => setStep("form")}
                    disabled={loading}
                  >
                    ← Back to Application Info
                  </button>
                  <button type="submit" className="btn btn-submit" disabled={loading}>
                    {loading ? "Uploading..." : "Submit Documents"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      </section>

      <footer>
        <div className="container">
          <p className="mb-0">
            © 2026 Sangguniang Kabataan of Barangay Mamatid | Educational Assistance Application System
          </p>
        </div>
      </footer>
    </div>
  );
}

export default ApplicantSubmission;