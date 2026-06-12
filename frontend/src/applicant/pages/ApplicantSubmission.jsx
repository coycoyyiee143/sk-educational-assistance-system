import { useState, useEffect } from "react";
import ApplicantNavigation from "../components/ApplicantNavigation";
import api from "../../services/api";

const SCHOOLS = [
  // Cabuyao
  "Pamantasan ng Cabuyao",
  "Mapúa Malayan Colleges Laguna",
  "St. Vincent College of Cabuyao",
  "Our Lady of Assumption College",
  "Colegio de Sto. Niño de Cabuyao",
  // Calamba
  "Calamba Doctor's College",
  "STI College Calamba",
  "University of Perpetual Help System DALTA Calamba",
  "Colegio de San Juan de Letran Calamba",
  "De La Salle University Canlubang",
  "AMA Computer College Calamba",
  // Los Baños
  "University of the Philippines Los Baños",
  // Other Laguna
  "Lyceum of the Philippines University Laguna",
  "Laguna College of Business and Arts",
  "Dominican College of Santa Rosa",
  "Polytechnic University of the Philippines Santa Rosa",
];

const YEAR_LEVELS = ["1st Year", "2nd Year", "3rd Year", "4th Year", "5th Year"];

const emptyForm = {
  schoolName: "",
  schoolAddr: "",
  course: "",
  yearLevel: "",
  studentId: "",
};

function ApplicantSubmission() {
  const [form, setForm] = useState(emptyForm);
  const [files, setFiles] = useState({ enrollment: null, schoolId: null, voters: null });
  const [applicationId, setApplicationId] = useState(null);
  const [step, setStep] = useState("form");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [existingApp, setExistingApp] = useState(null);
  const [checkingApp, setCheckingApp] = useState(true);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const setFile = (k) => (e) => setFiles((f) => ({ ...f, [k]: e.target.files[0] ?? null }));

  useEffect(() => {
    api.get("/applications")
      .then((res) => {
        if (res.data.length > 0) {
          setExistingApp(res.data[0]);
          setStep("done");
        }
      })
      .catch(() => { })
      .finally(() => setCheckingApp(false));
  }, []);

  async function handleSubmitForm(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await api.post("/applications", {
        school_name: form.schoolName,
        school_address: form.schoolAddr,
        course: form.course,
        year_level: form.yearLevel,
        student_id_number: form.studentId,
      });
      setApplicationId(res.data.application.id);
      setStep("documents");
    } catch (err) {
      const errors = err.response?.data?.errors;
      if (errors) {
        setError(Object.values(errors).flat().join(" "));
      } else {
        setError(err.response?.data?.message || "Failed to submit application.");
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleUploadDocuments(e) {
    e.preventDefault();
    setError("");

    if (!files.enrollment || !files.schoolId || !files.voters) {
      setError("Please upload all three required documents.");
      return;
    }

    setLoading(true);
    try {
      const uploadDoc = async (file, documentType) => {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("document_type", documentType);
        await api.post(`/applications/${applicationId}/documents`, formData, {
          headers: { "Content-Type": "multipart/form-data" },
        });
      };

      await uploadDoc(files.enrollment, "registration_form");
      await uploadDoc(files.schoolId, "school_id");
      await uploadDoc(files.voters, "voters_certificate");

      setSuccess("Application and documents submitted successfully! Your documents are being processed.");
      setStep("done");
    } catch (err) {
      setError("Failed to upload documents. Please try again.");
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
              Complete the form below and upload your required documents for verification.
            </p>

            {error && <div className="alert alert-danger">{error}</div>}
            {success && <div className="alert alert-success">{success}</div>}

            {/* Already applied */}
            {step === "done" && !success && (
              <div className="alert alert-info">
                You have already submitted an application for this period.
                {existingApp && (
                  <p className="mb-0 mt-2">
                    <strong>Status:</strong> {existingApp.status} &nbsp;|&nbsp;
                    <strong>School:</strong> {existingApp.school_name}
                  </p>
                )}
              </div>
            )}

            {/* Step 1: Application Form */}
            {step === "form" && (
              <form onSubmit={handleSubmitForm}>
                <div className="sub-card mb-4">
                  <h5>Educational Information</h5>

                  {/* School name warning */}
                  <div className="alert alert-warning py-2 mb-3">
                    <i className="bi bi-exclamation-triangle-fill me-2"></i>
                    <strong>Important:</strong> Make sure the details you input matches exactly
                    how it appears on your Registration Form. This is used to verify your document.
                  </div>

                  <div className="row">
                    <div className="col-md-6 mb-3">
                      <label className="form-label">School Name <span className="text-danger">*</span></label>
                      <select className="form-select" value={form.schoolName} onChange={set("schoolName")} required>
                        <option value="" disabled>Select your school</option>
                        {SCHOOLS.map((s) => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                      <div className="form-text">
                        Select the school as it appears on your Registration Form.
                      </div>
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
                      <label className="form-label">Course <span className="text-danger">*</span></label>
                      <input
                        className="form-control"
                        placeholder="e.g. Bachelor of Science in Information Technology"
                        value={form.course}
                        onChange={set("course")}
                        required
                      />
                    </div>

                    <div className="col-md-6 mb-3">
                      <label className="form-label">Year Level <span className="text-danger">*</span></label>
                      <select className="form-select" value={form.yearLevel} onChange={set("yearLevel")} required>
                        <option value="" disabled>Select year level</option>
                        {YEAR_LEVELS.map((y) => <option key={y}>{y}</option>)}
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

                <div className="d-flex justify-content-end gap-2">
                  <button type="button" className="btn btn-secondary-custom" onClick={() => setForm(emptyForm)}>
                    Clear
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
                  <p className="text-muted mb-3">
                    Application saved. Now upload your three required documents.
                    These will be automatically verified by the system.
                  </p>

                  {/* Document upload warning */}
                  <div className="alert alert-warning py-2 mb-3">
                    <i className="bi bi-exclamation-triangle-fill me-2"></i>
                    <strong>Reminder:</strong> Upload clear, readable photos or scans.
                    Blurry or low-quality images may cause your application to be flagged for manual review.
                    Supported formats: JPG, PNG, PDF. Max size: 5MB per file.
                  </div>

                  <div className="row g-3">
                    <div className="col-md-4">
                      <label className="form-label fw-semibold">
                        Certificate of Enrollment / Registration Form
                        <span className="text-danger"> *</span>
                      </label>
                      <input
                        type="file"
                        className="form-control"
                        accept=".jpg,.jpeg,.png,.pdf"
                        onChange={setFile("enrollment")}
                        required
                      />
                      <div className="form-text">
                        Must show your name, school, school year, and semester.
                      </div>
                    </div>

                    <div className="col-md-4">
                      <label className="form-label fw-semibold">
                        School ID
                        <span className="text-danger"> *</span>
                      </label>
                      <input
                        type="file"
                        className="form-control"
                        accept=".jpg,.jpeg,.png,.pdf"
                        onChange={setFile("schoolId")}
                        required
                      />
                      <div className="form-text">
                        Must show your name and school name.
                      </div>
                    </div>

                    <div className="col-md-4">
                      <label className="form-label fw-semibold">
                        Voter's Certificate
                        <span className="text-danger"> *</span>
                      </label>
                      <input
                        type="file"
                        className="form-control"
                        accept=".jpg,.jpeg,.png,.pdf"
                        onChange={setFile("voters")}
                        required
                      />
                      <div className="form-text">
                        Must show your name and Barangay Mamatid as your registered barangay.
                      </div>
                    </div>
                  </div>
                </div>

                <div className="d-flex justify-content-end gap-2 mt-4">
                  <button type="submit" className="btn btn-submit" disabled={loading}>
                    {loading ? "Uploading and processing documents..." : "Submit Documents"}
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