import { useState, useEffect, useRef } from "react";
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

const COURSES = [
  "AB Communication",
  "AB English Language Studies",
  "AB History",
  "AB Journalism",
  "AB Political Science",
  "AB Psychology",
  "AB Sociology",
  "BS Accountancy",
  "BS Accounting Information System",
  "BS Agribusiness",
  "BS Agriculture",
  "BS Architecture",
  "BS Biology",
  "BS Business Administration",
  "BS Chemical Engineering",
  "BS Chemistry",
  "BS Civil Engineering",
  "BS Computer Engineering",
  "BS Computer Science",
  "BS Criminology",
  "BS Customs Administration",
  "BS Economics",
  "BS Education",
  "BS Electrical Engineering",
  "BS Electronics Engineering",
  "BS Elementary Education",
  "BS Entrepreneurship",
  "BS Environmental Science",
  "BS Fisheries",
  "BS Food Technology",
  "BS Forestry",
  "BS Hospitality Management",
  "BS Hotel and Restaurant Management",
  "BS Industrial Engineering",
  "BS Information Systems",
  "BS Information Technology",
  "BS Interior Design",
  "BS Legal Management",
  "BS Marine Biology",
  "BS Marine Transportation",
  "BS Marketing Management",
  "BS Mathematics",
  "BS Mechanical Engineering",
  "BS Medical Technology",
  "BS Midwifery",
  "BS Nursing",
  "BS Nutrition and Dietetics",
  "BS Occupational Therapy",
  "BS Pharmacy",
  "BS Physical Therapy",
  "BS Public Administration",
  "BS Radiologic Technology",
  "BS Real Estate Management",
  "BS Secondary Education",
  "BS Social Work",
  "BS Statistics",
  "BS Tourism Management",
  "Other",
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

const STATUS_LABELS = {
  pending_prescreening: "Pending Prescreening",
  for_review: "For Review",
  approved: "Approved",
  rejected: "Rejected",
  reupload_requested: "Re-upload Requested",
  claimed: "Claimed",
  not_cleared: "Not Cleared",
  unclaimed: "Unclaimed",
};

function formatStatus(status) {
  return STATUS_LABELS[status] || status;
}

const emptyForm = {
  schoolName: "",
  course: "",
  yearLevel: "",
};

// Component
function ApplicantSubmission() {
  const [form, setForm] = useState(emptyForm);
  const [files, setFiles] = useState({
    enrollment: null,
    schoolId: null,
    voters: null,
  });
  const [reuploadFiles, setReuploadFiles] = useState({
    enrollment: null,
    schoolId: null,
    voters: null,
  });

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
  const [otherCourse, setOtherCourse] = useState("");
  const [courseSearch, setCourseSearch] = useState("");
  const [courseDropdownOpen, setCourseDropdownOpen] = useState(false);
  const [showOtherCourseInput, setShowOtherCourseInput] = useState(false);
  const otherCourseInputRef = useRef(null);
  const [schoolSearch, setSchoolSearch] = useState("");
  const [schoolDropdownOpen, setSchoolDropdownOpen] = useState(false);
  const filteredSchools = SCHOOLS.filter((s) =>
    s.toLowerCase().includes(schoolSearch.toLowerCase())
  );
  const [yearLevelDropdownOpen, setYearLevelDropdownOpen] = useState(false);

  useEffect(() => {
    if (showOtherCourseInput && otherCourseInputRef.current) {
      otherCourseInputRef.current.focus();
    }
  }, [showOtherCourseInput]);
  const filteredCourses = COURSES.filter(
    (c) => c !== "Other" && c.toLowerCase().includes(courseSearch.toLowerCase())
  );
  const setFile = (k) => (e) =>
    setFiles((f) => ({ ...f, [k]: e.target.files[0] ?? null }));
  const setReupload = (k) => (e) =>
    setReuploadFiles((f) => ({ ...f, [k]: e.target.files[0] ?? null }));
  const [activeConfig, setActiveConfig] = useState(null);

  const [docUrls, setDocUrls] = useState({});

  useEffect(() => {
    let createdUrls = [];
    async function loadDocUrls() {
      const urls = {};
      for (const doc of existingDocs) {
        try {
          const res = await api.get(
            `/applications/${applicationId}/documents/${doc.id}/file`,
            { responseType: "blob" }
          );
          const url = URL.createObjectURL(res.data);
          urls[doc.id] = url;
          createdUrls.push(url);
        } catch {
          // skip on failure, recap will show a fallback
        }
      }
      setDocUrls(urls);
    }
    if (applicationId && existingDocs.length > 0) loadDocUrls();
    return () => createdUrls.forEach((u) => URL.revokeObjectURL(u));
  }, [existingDocs, applicationId]);

  // Preview modal state
  const [previewFile, setPreviewFile] = useState(null);
  function isImageFile(doc) {
    if (doc?.mime_type) return doc.mime_type.startsWith("image/");
    return /\.(jpg|jpeg|png)$/i.test(doc?.file_name || "");
  }

  useEffect(() => {
    api
      .get("/application-config/active")
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
            course: app.course ?? "",
            yearLevel: app.year_level ?? "",
          });

          // fetch existing documents for reupload flow
          const docsRes = await api.get(`/applications/${app.id}/documents`);
          setExistingDocs(docsRes.data);

          if (app.status === "reupload_requested") {
            setStep("reupload");
          } else if (docsRes.data.length < 3) {
            setStep("documents");
          } else {
            setStep("done");
          }
        }
      })
      .catch(() => { })
      .finally(() => setCheckingApp(false));
  }, []);

  // Reupload validation
  const reuploadDetails =
    existingApp?.latest_verifier_action?.reupload_details ?? [];
  const missingReuploadFields = DOC_FIELDS.filter((field) => {
    const isRequested = reuploadDetails.some(
      (r) => r.document_type === field.type,
    );
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
        course: form.course,
        year_level: form.yearLevel,
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
          : err.response?.data?.message || "Failed to submit application.",
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
      await uploadDoc(
        files.enrollment,
        "registration_form",
        "Registration Form",
      );
      await uploadDoc(files.schoolId, "school_id", "School ID");
      await uploadDoc(
        files.voters,
        "voters_certificate",
        "Voter's Certificate",
      );

      // Re-fetch documents so the recap view shows the newly uploaded files immediately
      const docsRes = await api.get(`/applications/${applicationId}/documents`);
      setExistingDocs(docsRes.data);

      setUploadProgress("");
      setSuccess(
        "Application and documents submitted successfully! Your documents are being processed.",
      );
      setStep("done");
    } catch (err) {
      setUploadProgress("");
      const errors = err.response?.data?.errors;
      setError(
        errors
          ? "Upload failed: " + Object.values(errors).flat().join(" ")
          : `Upload failed: ${err.response?.data?.message || "Please check your files and try again."}`,
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
      const missingLabels = missingReuploadFields
        .map((f) => f.label)
        .join(", ");
      setError(
        `You must upload all documents flagged for corrections. Missing: ${missingLabels}`,
      );
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
      await api.post(
        `/applications/${applicationId}/documents/${existingDoc.id}/reupload`,
        formData,
      );
    };

    try {
      await reuploadDoc(
        reuploadFiles.enrollment,
        "registration_form",
        "Registration Form",
      );
      await reuploadDoc(reuploadFiles.schoolId, "school_id", "School ID");
      await reuploadDoc(
        reuploadFiles.voters,
        "voters_certificate",
        "Voter's Certificate",
      );

      // Re-fetch documents so the recap view shows the newly uploaded files immediately
      const docsRes = await api.get(`/applications/${applicationId}/documents`);
      setExistingDocs(docsRes.data);

      setUploadProgress("");
      setSuccess(
        "Documents re-uploaded successfully! Your application is being re-processed.",
      );
      setStep("done");
    } catch (err) {
      setUploadProgress("");
      setError(
        `Re-upload failed: ${err.response?.data?.message || "Please try again."}`,
      );
    } finally {
      setLoading(false);
    }
  }

  if (checkingApp) {
    return (
      <div>
        <ApplicantNavigation />
        <div
          className="d-flex justify-content-center align-items-center"
          style={{ height: "60vh" }}
        >
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
              Complete the educational information and upload the required
              supporting documents for verification.
            </p>

            {error && <div className="alert alert-danger">{error}</div>}
            {success && <div className="alert alert-success">{success}</div>}

            {/* Already applied - done state */}
            {step === "done" && (
              <>
                {!success && (
                  <div className="alert alert-info">
                    You have already submitted an application for this period.
                    {existingApp && (
                      <p className="mb-0 mt-2">
                        <strong>Status:</strong> {formatStatus(existingApp.status)}
                      </p>
                    )}
                  </div>
                )}
                {/* Educational Info Recap */}
                <div className="sub-card mb-4">
                  <h5>Educational Information</h5>
                  <div className="row">
                    <div className="col-md-6 mb-3">
                      <label className="form-label text-muted">
                        School Name
                      </label>
                      <div className="fw-semibold">
                        {form.schoolName || "—"}
                      </div>
                    </div>
                    <div className="col-md-6 mb-3">
                      <label className="form-label text-muted">
                        Course / Program
                      </label>
                      <div className="fw-semibold">{form.course || "—"}</div>
                    </div>
                    <div className="col-md-6 mb-3">
                      <label className="form-label text-muted">
                        Year Level
                      </label>
                      <div className="fw-semibold">{form.yearLevel || "—"}</div>
                    </div>
                  </div>
                </div>

                {/* Fixed UI uneven size and not rendering properly */}
                {/* Uploaded Documents Recap */}
                <div className="sub-card">
                  <h5>Uploaded Documents</h5>
                  <div className="row g-3">
                    {DOC_FIELDS.map((field) => {
                      const doc = existingDocs.find((d) => d.document_type === field.type);
                      if (!doc) return null;

                      const fileUrl = docUrls[doc.id];
                      if (!fileUrl) return (
                        <div className="col-md-4" key={field.key}>
                          <div className="upload-box d-flex align-items-center justify-content-center" style={{ height: "280px" }}>
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
                                <img
                                  src={fileUrl}
                                  alt={field.label}
                                  className="w-100 h-100"
                                  style={{ objectFit: "cover" }}
                                />
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
                              <div
                                className="text-truncate"
                                style={{ maxWidth: "100%" }}
                                title={doc.file_name}
                              >
                                {doc.file_name}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>              </>
            )}
            {/* Re-upload form */}
            {step === "reupload" && (
              <form onSubmit={handleReupload}>
                <div className="alert alert-warning mb-3">
                  <strong>Re-upload Required:</strong> The SK Verifier has
                  requested you to re-upload your documents.
                </div>

                {existingApp?.latest_verifier_action?.notes && (
                  <div className="alert alert-info mb-3">
                    <strong>Verifier Note:</strong>{" "}
                    {existingApp.latest_verifier_action.notes}
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
                          const doc = existingDocs.find(
                            (d) => d.document_type === field.type,
                          );
                          const docReason = reuploadDetails.find(
                            (r) => r.document_type === field.type,
                          );
                          return (
                            <tr
                              key={field.key}
                              className={docReason ? "table-warning" : ""}
                            >
                              <td>{field.label}</td>
                              <td>{doc?.file_name ?? "—"}</td>
                              <td>{doc && doc.status}</td>
                              <td>
                                {docReason ? (
                                  <span className="text-danger fw-semibold">
                                    {docReason.reason}
                                  </span>
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
                      <strong>A.Y. {activeConfig.school_year}</strong> — the
                      most recent enrollment period. Registration forms from a
                      different school year will not be accepted.
                    </div>
                  )}

                  <p className="text-muted small mb-3">
                    Upload replacements for the documents flagged by the
                    verifier. Leave blank to keep existing.
                  </p>
                  <div className="row g-3">
                    {DOC_FIELDS.map((field) => {
                      const isRequested = reuploadDetails.some(
                        (r) => r.document_type === field.type,
                      );
                      return (
                        <div className="col-md-4" key={field.key}>
                          <div className="upload-box">
                            <label
                              className={`form-label fw-semibold ${isRequested ? "text-danger" : ""}`}
                            >
                              {field.label}
                            </label>
                            <input
                              type="file"
                              className={`form-control ${isRequested ? "border-danger" : ""}`}
                              accept=".jpg,.jpeg,.png,.pdf"
                              onChange={setReupload(field.key)}
                            />
                            <div className="form-text">{field.hint}</div>
                            {reuploadFiles[field.key] && (
                              <small className="text-success">
                                ✓ {reuploadFiles[field.key].name}
                              </small>
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
                  <div className="alert alert-danger py-2 mt-3 mb-0">
                    <strong>Cannot Submit:</strong> You must attach replacement
                    files for all requested items:{" "}
                    <span className="fw-semibold">
                      {missingReuploadFields.map((f) => f.label).join(", ")}
                    </span>
                    .
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
                      : "Submit Re-uploaded Documents"}
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
                        <strong>Important:</strong> Make sure the details you
                        input match exactly how they appear on your Registration
                        Form. This is used to verify your document.
                      </div>
                      <div className="row">
                        <div className="col-md-6 mb-3">
                          <label className="form-label">
                            School Name <span className="text-danger">*</span>
                          </label>

                          <div style={{ position: "relative" }}>
                            <input
                              type="text"
                              className="form-control"
                              placeholder="Search or select your school"
                              value={schoolDropdownOpen ? schoolSearch : form.schoolName}
                              onFocus={() => {
                                setSchoolDropdownOpen(true);
                                setSchoolSearch("");
                              }}
                              onChange={(e) => {
                                setSchoolSearch(e.target.value);
                                setSchoolDropdownOpen(true);
                              }}
                              onBlur={() => {
                                setTimeout(() => setSchoolDropdownOpen(false), 150);
                              }}
                              required={!form.schoolName}
                              autoComplete="off"
                            />

                            {schoolDropdownOpen && (
                              <div
                                className="border rounded bg-white shadow-sm"
                                style={{
                                  position: "absolute",
                                  top: "100%",
                                  left: 0,
                                  right: 0,
                                  zIndex: 20,
                                  maxHeight: "220px",
                                  overflowY: "auto",
                                  marginTop: "2px",
                                }}
                              >
                                {filteredSchools.length === 0 ? (
                                  <div className="px-3 py-2 text-muted small">
                                    No matching school found.
                                  </div>
                                ) : (
                                  filteredSchools.map((s) => (
                                    <div
                                      key={s}
                                      className="px-3 py-2"
                                      style={{ cursor: "pointer" }}
                                      onMouseDown={() => {
                                        setForm((f) => ({ ...f, schoolName: s }));
                                        setSchoolDropdownOpen(false);
                                        setSchoolSearch("");
                                      }}
                                      onMouseEnter={(e) => (e.currentTarget.style.background = "#fff3f3")}
                                      onMouseLeave={(e) => (e.currentTarget.style.background = "white")}
                                    >
                                      {s}
                                    </div>
                                  ))
                                )}
                              </div>
                            )}
                          </div>

                          <div className="form-text">
                            Select the school as it appears on your Registration
                            Form.
                          </div>
                        </div>
                          <div className="col-md-6 mb-3">
                          <label className="form-label">
                            Year Level <span className="text-danger">*</span>
                          </label>

                          <div style={{ position: "relative" }}>
                            <input
                              type="text"
                              className="form-control"
                              placeholder="Select year level"
                              value={form.yearLevel}
                              readOnly
                              onFocus={() => setYearLevelDropdownOpen(true)}
                              onBlur={() => {
                                setTimeout(() => setYearLevelDropdownOpen(false), 150);
                              }}
                              required={!form.yearLevel}
                              style={{ cursor: "pointer", backgroundColor: "#fff" }}
                            />

                            {yearLevelDropdownOpen && (
                              <div
                                className="border rounded bg-white shadow-sm"
                                style={{
                                  position: "absolute",
                                  top: "100%",
                                  left: 0,
                                  right: 0,
                                  zIndex: 20,
                                  marginTop: "2px",
                                }}
                              >
                                {YEAR_LEVELS.map((y) => (
                                  <div
                                    key={y}
                                    className="px-3 py-2"
                                    style={{ cursor: "pointer" }}
                                    onMouseDown={() => {
                                      setForm((f) => ({ ...f, yearLevel: y }));
                                      setYearLevelDropdownOpen(false);
                                    }}
                                    onMouseEnter={(e) => (e.currentTarget.style.background = "#fff3f3")}
                                    onMouseLeave={(e) => (e.currentTarget.style.background = "white")}
                                  >
                                    {y}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="col-md-6 mb-3">
                          <label className="form-label">
                            Course / Program{" "}
                            <span className="text-danger">*</span>
                          </label>

                          <div style={{ position: "relative" }}>
                            <input
                              type="text"
                              className="form-control"
                              placeholder="Search or select your course"
                              value={courseDropdownOpen ? courseSearch : (showOtherCourseInput ? "Other" : form.course)}
                              onFocus={() => {
                                setCourseDropdownOpen(true);
                                setCourseSearch("");
                              }}
                              onChange={(e) => {
                                setCourseSearch(e.target.value);
                                setCourseDropdownOpen(true);
                              }}
                              onBlur={() => {
                                // Delay closing so onClick on list items can register first
                                setTimeout(() => setCourseDropdownOpen(false), 150);
                              }}
                              required={!form.course}
                              autoComplete="off"
                            />

                            {courseDropdownOpen && (
                              <div
                                className="border rounded bg-white shadow-sm"
                                style={{
                                  position: "absolute",
                                  top: "100%",
                                  left: 0,
                                  right: 0,
                                  zIndex: 20,
                                  maxHeight: "220px",
                                  overflowY: "auto",
                                  marginTop: "2px",
                                }}
                              >
                                {filteredCourses.length === 0 && courseSearch !== "" ? (
                                  <div className="px-3 py-2 text-muted small">
                                    No matching course found.
                                  </div>
                                ) : (
                                  filteredCourses.map((c) => (
                                    <div
                                      key={c}
                                      className="px-3 py-2"
                                      style={{ cursor: "pointer" }}
                                      onMouseDown={() => {
                                        setShowOtherCourseInput(false);
                                        setForm((f) => ({ ...f, course: c }));
                                        setCourseDropdownOpen(false);
                                        setCourseSearch("");
                                      }}
                                      onMouseEnter={(e) => (e.currentTarget.style.background = "#fff3f3")}
                                      onMouseLeave={(e) => (e.currentTarget.style.background = "white")}
                                    >
                                      {c}
                                    </div>
                                  ))
                                )}
                                <div
                                  className="px-3 py-2 border-top fw-semibold"
                                  style={{ cursor: "pointer" }}
                                  onMouseDown={() => {
                                    setShowOtherCourseInput(true);
                                    setForm((f) => ({ ...f, course: otherCourse }));
                                    setCourseDropdownOpen(false);
                                    setCourseSearch("");
                                  }}
                                  onMouseEnter={(e) => (e.currentTarget.style.background = "#fff3f3")}
                                  onMouseLeave={(e) => (e.currentTarget.style.background = "white")}
                                >
                                  Other
                                </div>
                              </div>
                            )}
                          </div>

                          {showOtherCourseInput && (
                            <div className="mt-2">
                              <input
                                ref={otherCourseInputRef}
                                className="form-control"
                                placeholder="e.g. BS Information Technology"
                                value={otherCourse}
                                onChange={(e) => {
                                  setOtherCourse(e.target.value);
                                  setForm((f) => ({ ...f, course: e.target.value }));
                                }}
                                required
                              />
                        </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="d-flex justify-content-end gap-2 mt-4">
                  <button
                    type="button"
                    className="btn btn-secondary-custom"
                    onClick={handleClear}
                  >
                    Clear Form
                  </button>
                  <button
                    type="submit"
                    className="btn btn-submit"
                    disabled={loading}
                  >
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
                      <strong>A.Y. {activeConfig.school_year}</strong> — the
                      most recent enrollment period. Registration forms from a
                      different school year will not be accepted.
                    </div>
                  )}

                  <p className="text-muted mb-3">
                    Application info saved. Now upload your three required
                    documents. These will be automatically verified by the
                    system.
                  </p>
                  <div className="alert alert-warning py-2 mb-3">
                    <strong>Reminder:</strong> Upload clear, readable photos or
                    scans. Blurry or low-quality images may cause your
                    application to be requested for a reupload. Supported
                    formats: JPG, PNG, PDF. Max size: 5MB per file.
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
                          {files[field.key] && (
                            <small className="text-success">
                              ✓ {files[field.key].name}
                            </small>
                          )}
                        </div>
                      </div>
                    ))}
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

                <div className="d-flex justify-content-between gap-2 mt-4">
                  <button
                    type="button"
                    className="btn btn-secondary-custom"
                    onClick={() => setStep("form")}
                    disabled={loading}
                  >
                    ← Back to Application Info
                  </button>
                  <button
                    type="submit"
                    className="btn btn-submit"
                    disabled={loading}
                  >
                    {loading ? "Uploading..." : "Submit Documents"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      </section>

      {/* File preview modal */}
      {previewFile && (
        <div
          className="position-fixed top-0 start-0 w-100 h-100 d-flex justify-content-center align-items-center"
          style={{ background: "rgba(0,0,0,0.8)", zIndex: 1050 }}
          onClick={() => setPreviewFile(null)}
        >
          <div
            className="bg-white rounded p-3 d-flex flex-column"
            style={{ width: "90vw", height: "90vh" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="d-flex justify-content-between align-items-center mb-2 flex-shrink-0">
              <strong className="text-truncate me-3">{previewFile.name}</strong>
              <button type="button" className="btn-close" onClick={() => setPreviewFile(null)} />
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
                <iframe
                  src={previewFile.url}
                  title={previewFile.name}
                  className="w-100 h-100 border-0"
                />
              )}
            </div>
          </div>
        </div>
      )}

      <footer>
        <div className="container">
          <p className="mb-0">
            © 2026 Sangguniang Kabataan of Barangay Mamatid | Educational
            Assistance Application System
          </p>
        </div>
      </footer>
    </div>
  );
}

export default ApplicantSubmission;
