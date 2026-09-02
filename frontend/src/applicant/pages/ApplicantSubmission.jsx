import { useState, useEffect } from "react";
import { getApplicationPeriodStatus } from "../../utils/applicationPeriod";
import ApplicantNavigation from "../components/ApplicantNavigation";
import ReuploadStep from "../components/ReuploadStep";
import FormStep from "../components/FormStep";
import DocumentUploadStep from "../components/DocumentUploadStep";
import DoneStepSummary from "../components/DoneStepSummary";
import ApplicationHistoryList from "../components/ApplicationHistoryList";
import FilePreviewModal from "../components/FilePreviewModal";
import api from "../../services/api";
import { STATUS_CONFIG } from "../../components/StatusConstants";
import { getDocFields } from "../constants/schoolsAndCourses";
import { checkImageResolution, checkImageSharpness } from "../utils/imageChecks";

const emptyForm = { schoolName: "", course: "", yearLevel: "" };
const DRAFT_STORAGE_KEY = "applicant_submission_draft";

function ApplicantSubmission() {
  const [form, setForm] = useState(emptyForm);
  const [files, setFiles] = useState({ enrollment: null, schoolId: null, voters: null });
  const [fileErrors, setFileErrors] = useState({ enrollment: "", schoolId: "", voters: "" });
  const [reuploadFiles, setReuploadFiles] = useState({ enrollment: null, schoolId: null, voters: null });
  const [reuploadFileErrors, setReuploadFileErrors] = useState({ enrollment: "", schoolId: "", voters: "" });
  const [applicationId, setApplicationId] = useState(null);
  const [existingApp, setExistingApp] = useState(null);
  const [applicationHistory, setApplicationHistory] = useState([]);
  const [existingDocs, setExistingDocs] = useState([]);
  const [step, setStep] = useState("form");
  const [checkingApp, setCheckingApp] = useState(true);
  const [loading, setLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [draftSaved, setDraftSaved] = useState(false);
  const [attestationChecked, setAttestationChecked] = useState(false);
  const [activeConfig, setActiveConfig] = useState(null);
  const [docUrls, setDocUrls] = useState({});
  const [previewFile, setPreviewFile] = useState(null);
  const [profile, setProfile] = useState(null);

  const periodStatus = getApplicationPeriodStatus(activeConfig);

  const setFile = (k) => async (e) => {
    const file = e.target.files[0] ?? null;
    if (!file) {
      setFiles((f) => ({ ...f, [k]: null }));
      setFileErrors((fe) => ({ ...fe, [k]: "" }));
      return;
    }
    const result = await checkImageResolution(file);
    if (!result.valid) {
      setFileErrors((fe) => ({
        ...fe,
        [k]: result.unreadable
          ? "Could not read this file. Please try a different image."
          : `Image resolution too low (${result.width}×${result.height}px). Please retake or rescan at a higher quality.`,
      }));
      setFiles((f) => ({ ...f, [k]: null }));
      e.target.value = "";
      return;
    }
    const sharpResult = await checkImageSharpness(file);
    if (!sharpResult.valid) {
      setFileErrors((fe) => ({ ...fe, [k]: "Image appears blurry or unclear. Please retake or rescan with better focus and lighting." }));
      setFiles((f) => ({ ...f, [k]: null }));
      e.target.value = "";
      return;
    }
    setFileErrors((fe) => ({ ...fe, [k]: "" }));
    setFiles((f) => ({ ...f, [k]: file }));
  };

  const setReupload = (k) => async (e) => {
    const file = e.target.files[0] ?? null;
    if (!file) {
      setReuploadFiles((f) => ({ ...f, [k]: null }));
      setReuploadFileErrors((fe) => ({ ...fe, [k]: "" }));
      return;
    }
    const result = await checkImageResolution(file);
    if (!result.valid) {
      setReuploadFileErrors((fe) => ({
        ...fe,
        [k]: result.unreadable
          ? "Could not read this file. Please try a different image."
          : `Image resolution too low (${result.width}×${result.height}px). Please retake or rescan at a higher quality.`,
      }));
      setReuploadFiles((f) => ({ ...f, [k]: null }));
      e.target.value = "";
      return;
    }
    const sharpResult = await checkImageSharpness(file);
    if (!sharpResult.valid) {
      setReuploadFileErrors((fe) => ({ ...fe, [k]: "Image appears blurry or unclear. Please retake or rescan with better focus and lighting." }));
      setReuploadFiles((f) => ({ ...f, [k]: null }));
      e.target.value = "";
      return;
    }
    setReuploadFileErrors((fe) => ({ ...fe, [k]: "" }));
    setReuploadFiles((f) => ({ ...f, [k]: file }));
  };

  useEffect(() => {
    let createdUrls = [];
    async function loadDocUrls() {
      const urls = {};
      for (const doc of existingDocs) {
        try {
          const res = await api.get(`/applications/${applicationId}/documents/${doc.id}/file`, { responseType: "blob" });
          const url = URL.createObjectURL(res.data);
          urls[doc.id] = url;
          createdUrls.push(url);
        } catch { }
      }
      setDocUrls(urls);
    }
    if (applicationId && existingDocs.length > 0) loadDocUrls();
    return () => createdUrls.forEach((u) => URL.revokeObjectURL(u));
  }, [existingDocs, applicationId]);

  async function handleViewHistoricalFile(appId, docId) {
    try {
      const res = await api.get(`/applications/${appId}/documents/${docId}/file`, { responseType: "blob" });
      const url = URL.createObjectURL(res.data);
      window.open(url, "_blank");
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch {
      alert("Failed to load document.");
    }
  }

  async function handleViewFile(docId) {
    return handleViewHistoricalFile(applicationId, docId);
  }

  useEffect(() => {
    api.get("/application-config/active").then((res) => setActiveConfig(res.data)).catch(() => { });
  }, []);

  useEffect(() => {
    Promise.all([api.get("/applications"), api.get("/application-config/active")])
      .then(async ([applicationsRes, configRes]) => {
        const applications = applicationsRes.data;
        const activeConfig = configRes.data;
        setActiveConfig(activeConfig);

        const currentApp = applications.find((app) => app.config_id === activeConfig.id);
        setApplicationHistory(applications.filter((app) => app.config_id !== activeConfig.id));

        if (currentApp) {
          const app = currentApp;
          setExistingApp(app);
          setApplicationId(app.id);
          setForm({
            schoolName: app.school_name ?? "",
            course: app.course ?? "",
            yearLevel: app.year_level ?? "",
          });
          const docsRes = await api.get(`/applications/${app.id}/documents`);
          setExistingDocs(docsRes.data);
          if (STATUS_CONFIG[app.status]?.showReupload) {
            setStep("reupload");
          } else if (docsRes.data.length < 3) {
            setStep("documents");
          } else {
            setStep("done");
          }
        } else {
          const draft = localStorage.getItem(DRAFT_STORAGE_KEY);
          if (draft) {
            try { setForm(JSON.parse(draft)); } catch { }
          }
        }
      })
      .catch(() => { })
      .finally(() => setCheckingApp(false));
  }, []);

  useEffect(() => {
    api.get("/profile").then((res) => setProfile(res.data.profile)).catch(() => { });
  }, []);

  const isMinor = profile?.is_minor ?? false;
  const DOC_FIELDS = getDocFields(isMinor);
  const isProfileComplete = profile?.is_profile_complete ?? false;
  const isAutoReupload = existingApp?.status === "auto_reupload_requested";
  const reuploadDetails = existingApp?.latest_verifier_action?.reupload_details ?? [];

  function isFieldFlagged(field) {
    const doc = existingDocs.find((d) => d.document_type === field.type);
    if (isAutoReupload) return !!doc?.needs_auto_reupload;
    return reuploadDetails.some((r) => r.document_type === field.type);
  }
  function flaggedReasonFor(field) {
    const doc = existingDocs.find((d) => d.document_type === field.type);
    if (isAutoReupload) {
      return doc?.needs_auto_reupload ? { reason: doc.auto_reupload_reason } : null;
    }
    return reuploadDetails.find((r) => r.document_type === field.type);
  }

  const missingReuploadFields = DOC_FIELDS.filter((field) => {
    const hasNewFile = !!reuploadFiles[field.key];
    return isFieldFlagged(field) && !hasNewFile;
  });
  const isReuploadDisabled = missingReuploadFields.length > 0;

  function handleSaveDraft() {
    localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(form));
    setDraftSaved(true);
    setTimeout(() => setDraftSaved(false), 2500);
  }

  async function handleSubmitForm(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const payload = { school_name: form.schoolName, course: form.course, year_level: form.yearLevel };
      if (applicationId) {
        await api.put(`/applications/${applicationId}`, payload);
      } else {
        const res = await api.post("/applications", payload);
        setApplicationId(res.data.application.id);
      }
      setStep(STATUS_CONFIG[existingApp?.status]?.showReupload ? "reupload" : "documents");
      localStorage.removeItem(DRAFT_STORAGE_KEY);
    } catch (err) {
      const errors = err.response?.data?.errors;
      setError(errors ? Object.values(errors).flat().join(" ") : err.response?.data?.message || "Failed to submit application.");
    } finally {
      setLoading(false);
    }
  }

  async function handleUploadDocuments(e) {
    e.preventDefault();
    setError("");
    if (!attestationChecked) {
      setError("You must certify that your documents are true, accurate, and unaltered before submitting.");
      return;
    }
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
      await api.put(`/applications/${applicationId}`, {
        school_name: form.schoolName,
        course: form.course,
        year_level: form.yearLevel,
        attestation_accepted: true,
      });
      const docsRes = await api.get(`/applications/${applicationId}/documents`);
      setExistingDocs(docsRes.data);
      setUploadProgress("");
      setSuccess("Application and documents submitted successfully! Your documents are being processed.");
      setStep("done");
    } catch (err) {
      setUploadProgress("");
      const errors = err.response?.data?.errors;
      setError(errors ? "Upload failed: " + Object.values(errors).flat().join(" ") : `Upload failed: ${err.response?.data?.message || "Please check your files and try again."}`);
    } finally {
      setLoading(false);
    }
  }

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
      const docsRes = await api.get(`/applications/${applicationId}/documents`);
      setExistingDocs(docsRes.data);
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

            {step === "done" && (
              <DoneStepSummary
                success={success}
                existingApp={existingApp}
                form={form}
                DOC_FIELDS={DOC_FIELDS}
                existingDocs={existingDocs}
                docUrls={docUrls}
                setPreviewFile={setPreviewFile}
              />
            )}

            {step === "reupload" && (
              <ReuploadStep
                existingApp={existingApp}
                existingDocs={existingDocs}
                DOC_FIELDS={DOC_FIELDS}
                isAutoReupload={isAutoReupload}
                reuploadFiles={reuploadFiles}
                reuploadFileErrors={reuploadFileErrors}
                setReupload={setReupload}
                isFieldFlagged={isFieldFlagged}
                flaggedReasonFor={flaggedReasonFor}
                isReuploadDisabled={isReuploadDisabled}
                missingReuploadFields={missingReuploadFields}
                handleReupload={handleReupload}
                handleViewFile={handleViewFile}
                loading={loading}
                uploadProgress={uploadProgress}
                activeConfig={activeConfig}
                isMinor={isMinor}
                applicationId={applicationId}
                setStep={setStep}
              />
            )}

            {periodStatus === "scheduled" && activeConfig && (
              <div className="alert alert-warning">
                <strong>Applications are not open yet.</strong> This application period opens on{" "}
                {new Date(activeConfig.open_date).toLocaleString("en-PH", {
                  month: "long", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit",
                })}
                . You can fill in your information now and use <strong>Save Draft</strong> to keep it on this
                device — submissions will not be accepted until the period opens.
              </div>
            )}
            {periodStatus === "closed" && activeConfig && (
              <div className="alert alert-warning">
                <strong>This application period has closed.</strong> New submissions are no longer being accepted.
              </div>
            )}

            {step === "form" && (
              <FormStep
                form={form}
                setForm={setForm}
                onSubmit={handleSubmitForm}
                loading={loading}
                draftSaved={draftSaved}
                onSaveDraft={handleSaveDraft}
                applicationId={applicationId}
                periodStatus={periodStatus}
                onCancel={STATUS_CONFIG[existingApp?.status]?.showReupload ? () => setStep("reupload") : undefined}
              />
            )}

            {step === "documents" && (
              <DocumentUploadStep
                isProfileComplete={isProfileComplete}
                activeConfig={activeConfig}
                isMinor={isMinor}
                DOC_FIELDS={DOC_FIELDS}
                files={files}
                fileErrors={fileErrors}
                setFile={setFile}
                attestationChecked={attestationChecked}
                setAttestationChecked={setAttestationChecked}
                uploadProgress={uploadProgress}
                loading={loading}
                onBack={() => setStep("form")}
                onSubmit={handleUploadDocuments}
              />
            )}

            <ApplicationHistoryList
              applicationHistory={applicationHistory}
              onViewFile={handleViewHistoricalFile}
            />
          </div>
        </div>
      </section>

      <FilePreviewModal previewFile={previewFile} onClose={() => setPreviewFile(null)} />

      <footer>
        <div className="container">
          <p className="mb-0">© 2026 Sangguniang Kabataan of Barangay Mamatid | Educational Assistance Application System</p>
        </div>
      </footer>
    </div>
  );
}

export default ApplicantSubmission;