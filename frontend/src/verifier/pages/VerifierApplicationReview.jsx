import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import VerifierNavigation from "../components/VerifierNavigation";
import VerifierTopbar from "../components/VerifierTopbar";
import PanelFooter from "../../components/PanelFooter";
import api from "../../services/api";
import { getReasonsByDocType, OTHER } from "../constants/verificationReasons";
import {
  getVerifierStatusLabel,
  getVerifierBadgeClass,
} from "../../components/StatusConstants";

function OcrBadge({ passed }) {
  return passed ? (
    <span className="badge bg-success verifier-ocr-badge">Passed</span>
  ) : (
    <span className="badge bg-danger verifier-ocr-badge">Failed</span>
  );
}

const CHECK_NAME_LABELS = {
  image_integrity: "Edited/Tampered Image Detection",
  document_origin: "Suspicious File Origin (Design Software)",
  ai_generation_provenance: "AI-Generated or AI-Edited Image",
};

function prefillFromLatestAction(latestAction, reasonsByDocType, appStatus) {
  const base = {
    registration_form: { reasons: [], otherText: "" },
    school_id: { reasons: [], otherText: "" },
    voters_certificate: { reasons: [], otherText: "" },
  };

  if (
    !latestAction ||
    latestAction.action !== "reupload_requested" ||
    !latestAction.reupload_details ||
    appStatus !== "reupload_requested"
  ) {
    return base;
  }

  latestAction.reupload_details.forEach((d) => {
    const options = reasonsByDocType[d.document_type] || [];
    const stored = d.reason_categories || [];
    const known = stored.filter((c) => options.includes(c));
    const custom = stored.filter((c) => !options.includes(c));

    base[d.document_type] = {
      reasons: custom.length > 0 ? [...known, OTHER] : known,
      otherText: custom.join(" "),
    };
  });

  return base;
}

function VerifierApplicationReview() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [app, setApp] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshingOcr, setRefreshingOcr] = useState(false);
  const [error, setError] = useState("");
  const [activeRawDocId, setActiveRawDocId] = useState(null);
  const [activeDocumentType, setActiveDocumentType] =
    useState("voters_certificate");
  const [checkpointFilter, setCheckpointFilter] = useState("all");
  const [documentDirection, setDocumentDirection] = useState("forward");
  const [previewFiles, setPreviewFiles] = useState({});
  const [zoomPreview, setZoomPreview] = useState(null);
  const [openFlagDocId, setOpenFlagDocId] = useState(null);

  const [flaggedDocs, setFlaggedDocs] = useState({
    registration_form: { reasons: [], otherText: "" },
    school_id: { reasons: [], otherText: "" },
    voters_certificate: { reasons: [], otherText: "" },
  });

  useEffect(() => {
    api
      .get(`/verifier/applications/${id}`)
      .then((res) => {
        setApp(res.data);

        const reasonsByDocType = getReasonsByDocType(
          res.data.configuration?.school_year
        );

        const latestAction = res.data.verifier_actions?.[0];

        setFlaggedDocs(
          prefillFromLatestAction(
            latestAction,
            reasonsByDocType,
            res.data.status
          )
        );
      })
      .catch(() => setError("Failed to load application."))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    if (!app?.documents) return;

    let cancelled = false;

    const docs = app.documents.filter(
      (doc) => doc.document_type === activeDocumentType
    );

    const createdUrls = [];

    Promise.all(
      docs.map(async (doc) => {
        try {
          const res = await api.get(
            `/applications/${app.id}/documents/${doc.id}/file`,
            { responseType: "blob" }
          );

          const url = URL.createObjectURL(res.data);
          createdUrls.push(url);

          return [doc.id, { url, type: res.data.type || "" }];
        } catch {
          return [doc.id, null];
        }
      })
    ).then((entries) => {
      if (!cancelled) {
        setPreviewFiles(Object.fromEntries(entries));
      }
    });

    return () => {
      cancelled = true;
      createdUrls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [app, activeDocumentType]);

  if (loading) {
    return (
      <div className="verifier-layout">
        <VerifierNavigation />

        <div className="verifier-main">
          <div className="verifier-topbar">
            <div className="verifier-topbar-user">
              <div className="verifier-topbar-user-text">
                <span className="verifier-topbar-user-name">
                  Verifier User
                </span>
                <span className="verifier-topbar-user-role">
                  Sangguniang Kabataan
                </span>
              </div>

              <div className="verifier-topbar-avatar"></div>
            </div>
          </div>

          <section className="page-section">
            <div className="container-fluid">
              <div className="verifier-page-loading">
                <div
                  className="spinner-border text-danger"
                  role="status"
                ></div>
                <span>Loading application review...</span>
              </div>
            </div>
          </section>

          <PanelFooter />
        </div>
      </div>
    );
  }

  if (error || !app) {
    return (
      <div className="verifier-layout">
        <VerifierNavigation />

        <div className="verifier-main">
          <div className="verifier-topbar"></div>

          <section className="page-section">
            <div className="container-fluid">
              <div className="alert alert-danger">
                {error || "Application not found."}
              </div>
            </div>
          </section>

          <PanelFooter />
        </div>
      </div>
    );
  }

  const user = app.user;
  const profile = user?.profile;

  const reasonsByDocType = getReasonsByDocType(
    app.configuration?.school_year
  );

  const latestAction = app.verifier_actions?.[0];

  const formatTimestamp = (dateString) => {
    if (!dateString) return "—";

    try {
      const date = new Date(dateString);

      return date.toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      });
    } catch {
      return dateString;
    }
  };

  const getOverallDocStatus = (docId, isLatestVersion) => {
    const checks =
      app.verification_checks?.filter(
        (c) => c.document_id === docId
      ) || [];

    const doc = app.documents?.find((d) => d.id === docId);

    if (checks.length === 0) {
      const isProcessing =
        isLatestVersion &&
        (doc?.status === "processing" ||
          doc?.status === "pending" ||
          (!doc?.status &&
            ["processing", "pending", "pending_prescreening"].includes(
              app.status
            )));

      if (isProcessing) {
        return {
          text: "Processing Checks...",
          class: "bg-warning text-dark",
        };
      }

      if (doc?.needs_auto_reupload) {
        return {
          text: "Flagged — Auto Re-upload",
          class: "bg-secondary",
        };
      }

      return {
        text: "No Verification Data",
        class: "bg-secondary",
      };
    }

    const failed = checks.some((c) => !c.passed);

    return failed
      ? { text: "Failed Verification", class: "bg-danger" }
      : { text: "Processed", class: "bg-success" };
  };

  const getCheckRuleLabel = (checkName) => {
    if (CHECK_NAME_LABELS[checkName]) {
      return CHECK_NAME_LABELS[checkName];
    }

    const labels = {
      cert_year_match: "Certificate Year",
      identity_match: "Identity & Legal Name",
      residency_geofence: "Residency Geofence",
    };

    return (
      labels[checkName] ||
      checkName
        .replace(/_/g, " ")
        .replace(/\b\w/g, (c) => c.toUpperCase())
    );
  };

  const getPassedCheckMessage = (checkName) => {
    const messages = {
      cert_year_match: "Exact integer equality",
      identity_match: "Exact identity match",
      residency_geofence: "Exact boundary geofence match",
    };

    return messages[checkName] || "Verification rule matched";
  };

  const getFlagReasonLabel = (reason) => {
    const labels = {
      "Image blurry or unreadable.":
        "Blurry or unreadable document",
      "File uploaded is not the correct document type.":
        "Incorrect document type",
      "Not issued within the current year.":
        "Not issued this year",
      "Not a registered voter in Barangay Mamatid.":
        "Not a registered Mamatid voter",
      "Parent's/guardian's Voter's Certificate could not be validated.":
        "Parent/guardian voter record invalid",
      "Applicant is not a minor; parent's/guardian's Voter's Certificate not allowed.":
        "Parent/guardian document not applicable",
      "Name does not match other submitted documents.":
        "Name mismatch",
      "Other (please specify)": "Other (please specify)",
    };

    return labels[reason] || reason;
  };

  const latestDocsMap = {};

  if (app.documents) {
    app.documents.forEach((doc) => {
      if (
        !latestDocsMap[doc.document_type] ||
        doc.id > latestDocsMap[doc.document_type].id
      ) {
        latestDocsMap[doc.document_type] = doc;
      }
    });
  }

  const sortedDocuments = app.documents
    ? [...app.documents].sort((a, b) => b.id - a.id)
    : [];

  const documentTabs = [
    {
      number: 1,
      type: "voters_certificate",
      label: "Voter Certificate",
    },
    {
      number: 2,
      type: "school_id",
      label: "School ID",
    },
    {
      number: 3,
      type: "registration_form",
      label: "Registration Form",
    },
  ];

  const getDocumentTabStatus = (documentType) => {
    const latestDoc = latestDocsMap[documentType];

    if (!latestDoc) {
      return { text: "Processing", state: "processing" };
    }

    const checks = (app.verification_checks || []).filter(
      (check) => check.document_id === latestDoc.id
    );

    if (checks.length === 0) {
      return { text: "Processing", state: "processing" };
    }

    const hasFailed = checks.some((c) => !c.passed);

    return hasFailed
      ? { text: "For Review", state: "review" }
      : { text: "Passed", state: "passed" };
  };

  const filteredDocuments = sortedDocuments.filter(
    (doc) => doc.document_type === activeDocumentType
  );

  const activeLatestDoc = latestDocsMap[activeDocumentType];

  const activeOverallStatus = activeLatestDoc
    ? getOverallDocStatus(activeLatestDoc.id, true)
    : null;

  const activeChecks = activeLatestDoc
    ? (app.verification_checks || []).filter(
        (check) => check.document_id === activeLatestDoc.id
      )
    : [];

  const checkpointTotal = activeChecks.length;

  const checkpointReview = activeChecks.filter(
    (check) => !check.passed
  ).length;

  const checkpointPassed = activeChecks.filter(
    (check) => check.passed
  ).length;

  const filteredChecks = activeChecks.filter((check) => {
    if (checkpointFilter === "review") return !check.passed;
    if (checkpointFilter === "passed") return check.passed;
    return true;
  });

  const activeDocumentIndex = documentTabs.findIndex(
    (tab) => tab.type === activeDocumentType
  );

  const nextDocument =
    activeDocumentIndex < documentTabs.length - 1
      ? documentTabs[activeDocumentIndex + 1]
      : null;

  const previousDocument =
    activeDocumentIndex > 0
      ? documentTabs[activeDocumentIndex - 1]
      : null;

  const latestDocIds = Object.values(latestDocsMap).map(
    (d) => d.id
  );

  const hasLowConfidence = Object.values(latestDocsMap).some(
    (d) => d.ocr_result?.is_low_confidence
  );

  const hasFailedCheck = (app.verification_checks || []).some(
    (c) =>
      latestDocIds.includes(c.document_id) &&
      !c.passed
  );

  const hasAiProvenanceFlag = (
    app.verification_checks || []
  ).some(
    (c) =>
      latestDocIds.includes(c.document_id) &&
      c.check_name === "ai_generation_provenance" &&
      !c.passed
  );

  const hasSuggestedDisapproval = (
    app.verification_checks || []
  ).some(
    (c) =>
      latestDocIds.includes(c.document_id) &&
      c.metadata?.flag === "SUGGESTED_DISAPPROVAL"
  );

  const showFlagSummary =
    hasLowConfidence || hasFailedCheck;

  function toggleReason(docType, reasonText) {
    setFlaggedDocs((prev) => {
      const current = prev[docType].reasons;

      const updated = current.includes(reasonText)
        ? current.filter((r) => r !== reasonText)
        : [...current, reasonText];

      return {
        ...prev,
        [docType]: {
          ...prev[docType],
          reasons: updated,
        },
      };
    });
  }

  function setOtherText(docType, text) {
    setFlaggedDocs((prev) => ({
      ...prev,
      [docType]: {
        ...prev[docType],
        otherText: text,
      },
    }));
  }

  function changeDocument(document, direction) {
    if (!document) return;

    setDocumentDirection(direction);
    setActiveDocumentType(document.type);
    setActiveRawDocId(null);
    setCheckpointFilter("all");
    setOpenFlagDocId(null);
  }

  function handleTabClick(tab) {
    const targetIndex = documentTabs.findIndex(
      (item) => item.type === tab.type
    );

    const direction =
      targetIndex < activeDocumentIndex
        ? "backward"
        : "forward";

    changeDocument(tab, direction);
  }

  async function handleRefreshOcr() {
    if (refreshingOcr) return;

    setRefreshingOcr(true);

    try {
      const res = await api.get(
        `/verifier/applications/${id}`
      );

      setApp(res.data);
      setActiveRawDocId(null);
      setCheckpointFilter("all");
      setOpenFlagDocId(null);
    } catch {
      alert("Failed to refresh OCR verification results.");
    } finally {
      setRefreshingOcr(false);
    }
  }

  async function handleRetryOcr(docId) {
    setRefreshingOcr(true);

    try {
      await api.post(
        `/verifier/documents/${docId}/retry-ocr`
      );

      await new Promise((resolve) =>
        setTimeout(resolve, 4000)
      );

      const res = await api.get(
        `/verifier/applications/${id}`
      );

      setApp(res.data);
    } catch {
      alert("Failed to queue OCR retry.");
    } finally {
      setRefreshingOcr(false);
    }
  }

  async function handleRetryAllFailed() {
    const failedDocs = (app.documents || []).filter(
      (d) => d.status === "failed"
    );

    if (failedDocs.length === 0) return;

    setRefreshingOcr(true);

    try {
      await Promise.all(
        failedDocs.map((d) =>
          api.post(
            `/verifier/documents/${d.id}/retry-ocr`
          )
        )
      );

      await new Promise((resolve) =>
        setTimeout(resolve, 5000)
      );

      const res = await api.get(
        `/verifier/applications/${id}`
      );

      setApp(res.data);
    } catch {
      alert(
        "Failed to queue retries for one or more documents."
      );
    } finally {
      setRefreshingOcr(false);
    }
  }

  function handleProceed() {
    navigate(
      `/VerifierVerificationAction/${app.id}`,
      {
        state: { flaggedDocs },
      }
    );
  }

  async function handleViewFile(docId) {
    try {
      const res = await api.get(
        `/applications/${app.id}/documents/${docId}/file`,
        { responseType: "blob" }
      );

      const url = URL.createObjectURL(res.data);

      window.open(url, "_blank");

      setTimeout(() => {
        URL.revokeObjectURL(url);
      }, 60000);
    } catch {
      alert("Failed to load document.");
    }
  }

  return (
    <div className="verifier-layout">
      <VerifierNavigation />

      <div className="verifier-main">
        <div className="verifier-topbar">
          <div className="verifier-topbar-user">
            <div className="verifier-topbar-user-text">
              <span className="verifier-topbar-user-name">
                Verifier User
              </span>

              <span className="verifier-topbar-user-role">
                Sangguniang Kabataan
              </span>
            </div>

            <div className="verifier-topbar-avatar"></div>
          </div>
        </div>

        <section className="page-section">
          <div className="container-fluid">

            <div className="verifier-dashboard-header">

              {/* BACK BUTTON ADDED HERE */}
              <button
                type="button"
                className="verifier-review-back-btn"
                onClick={() =>
                  navigate("/VerifierApplicationList")
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
                  <path d="M19 12H5" />
                  <path d="M12 19l-7-7 7-7" />
                </svg>

                Back to Application List
              </button>

              <div>
                <h3 className="verifier-dashboard-title">
                  Application Review
                </h3>

                <p className="verifier-dashboard-desc">
                  Review the submitted application details
                  along with automated system evaluations.
                </p>
              </div>

              {hasSuggestedDisapproval && (
                <div className="alert alert-dark small mt-3 mb-0">
                  <strong>
                    ⚠ Suggested: Reject — Non-Resident.
                  </strong>{" "}
                  The document(s) below indicate a residency
                  outside Barangay Mamatid. This program is
                  exclusive to Mamatid residents. This is a
                  suggestion only — please confirm before making
                  a decision, since a data-entry or upload mistake
                  is still possible.
                </div>
              )}

              {app.status === "rejected" &&
                latestAction?.action === "rejected" && (
                  <div className="alert alert-secondary small mt-3 mb-0">
                    <strong>Previously rejected.</strong>{" "}
                    Reasons on record:{" "}
                    {(latestAction.reason_categories || []).join(
                      " "
                    )}
                  </div>
                )}
            </div>

            <div className="page-card verifier-review-info-card">
              <div className="verifier-review-info-header">
                <div className="verifier-review-info-header-top">
                  <h4 className="verifier-review-info-title">
                    Applicant Information
                  </h4>

                  <span
                    className={`status-badge ${getVerifierBadgeClass(
                      app
                    )}`}
                  >
                    {getVerifierStatusLabel(app)}
                  </span>
                </div>

                {showFlagSummary && (
                  <div className="verifier-review-flag-summary">
                    <span className="verifier-review-flag-label">
                      Flagged for:
                    </span>

                    {hasLowConfidence && (
                      <span className="badge bg-warning text-dark verifier-review-flag-badge">
                        Low Image Confidence
                      </span>
                    )}

                    {hasAiProvenanceFlag && (
                      <span className="badge bg-dark verifier-review-flag-badge">
                        ⚠ AI-Generated/Edited Image Signals
                        Detected
                      </span>
                    )}

                    {hasFailedCheck && (
                      <span className="badge bg-danger verifier-review-flag-badge">
                        Failed Eligibility Check(s)
                      </span>
                    )}
                  </div>
                )}
              </div>

              <div className="verifier-review-profile-area">
                <div className="verifier-review-profile-main">
                  <div className="verifier-review-profile-avatar">
                    {user?.first_name?.charAt(0)}
                    {user?.last_name?.charAt(0)}
                  </div>

                  <div className="verifier-review-profile-content">
                    <h5 className="verifier-review-profile-name">
                      {user?.first_name} {user?.last_name}
                    </h5>
                  </div>
                </div>
              </div>

              <div className="verifier-review-information-body">
                <div className="verifier-review-information-column">
                  <p className="verifier-review-info-label">
                    PERSONAL DETAILS
                  </p>

                  <div className="verifier-review-details-grid verifier-review-details-grid-single">
                    {[
                      [
                        "Applicant Full Name",
                        `${user?.first_name} ${user?.last_name}`,
                      ],
                      [
                        "Date of Birth",
                        profile?.birthdate ?? "—",
                      ],
                      ["Email Address", user?.email],
                      [
                        "Mobile Number",
                        user?.mobile_number ?? "—",
                      ],
                      [
                        "Residential Address",
                        profile
                          ? [
                              profile.barangay,
                              profile.city,
                              profile.province,
                            ]
                              .filter(Boolean)
                              .join(", ") || "—"
                          : "—",
                      ],
                    ].map(([label, value]) => (
                      <div
                        className="verifier-review-detail-item"
                        key={label}
                      >
                        <span className="verifier-review-detail-label">
                          {label}
                        </span>

                        <span className="verifier-review-detail-value">
                          {value}
                        </span>
                      </div>
                    ))}

                    {profile?.is_minor && (
                      <div className="verifier-review-detail-item">
                        <span className="verifier-review-detail-label">
                          Guardian (Minor Applicant)
                        </span>

                        <span className="verifier-review-detail-value">
                          {profile.guardian_first_name ||
                          profile.guardian_last_name
                            ? `${profile.guardian_first_name ?? ""} ${
                                profile.guardian_middle_name ?? ""
                              } ${
                                profile.guardian_last_name ?? ""
                              }`
                                .replace(/\s+/g, " ")
                                .trim()
                            : "No guardian on file"}

                          {profile.guardian_relationship &&
                            ` (${profile.guardian_relationship})`}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="verifier-review-information-divider"></div>

                <div className="verifier-review-information-column">
                  <p className="verifier-review-info-label">
                    ACADEMIC BACKGROUND
                  </p>

                  <div className="verifier-review-details-grid verifier-review-details-grid-single">
                    {[
                      [
                        "Institution / School Name",
                        app.school_name,
                      ],
                      ["Program / Degree", app.course],
                      ["Year Level", app.year_level],
                      ["Student ID", app.student_id_number],
                      [
                        "Current Academic Year",
                        app.configuration?.school_year,
                      ],
                    ].map(([label, value]) => (
                      <div
                        className="verifier-review-detail-item"
                        key={label}
                      >
                        <span className="verifier-review-detail-label">
                          {label}
                        </span>

                        <span className="verifier-review-detail-value">
                          {value ?? "—"}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div
              className="page-card verifier-ocr-section"
              aria-busy={refreshingOcr}
            >
              <div className="verifier-ocr-section-heading">
                <h4 className="section-title verifier-ocr-section-title">
                  System Document & OCR Integrity Verification
                </h4>

                <button
                  type="button"
                  className="verifier-ocr-refresh-btn"
                  onClick={handleRefreshOcr}
                  disabled={refreshingOcr}
                  title="Refresh OCR verification results"
                  aria-label="Refresh OCR verification results"
                >
                  <svg
                    className={`verifier-ocr-refresh-icon ${
                      refreshingOcr
                        ? "verifier-ocr-refresh-icon-spinning"
                        : ""
                    }`}
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polyline points="23 4 23 10 17 10" />
                    <polyline points="1 20 1 14 7 14" />
                    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10" />
                    <path d="M20.49 15a9 9 0 0 1-14.85 3.36L1 14" />
                  </svg>
                </button>
              </div>

              {(app.documents || []).some(
                (d) => d.status === "failed"
              ) && (
                <div className="alert alert-warning d-flex justify-content-between align-items-center">
                  <span>
                    Some documents failed OCR processing.
                  </span>

                  <button
                    type="button"
                    className="btn btn-sm btn-warning"
                    onClick={handleRetryAllFailed}
                    disabled={refreshingOcr}
                  >
                    Retry All Failed
                  </button>
                </div>
              )}

              <div className="verifier-ocr-document-tabs">
                {documentTabs.map((tab) => {
                  const tabStatus =
                    getDocumentTabStatus(tab.type);

                  return (
                    <button
                      type="button"
                      key={tab.type}
                      className={`verifier-ocr-document-tab ${
                        activeDocumentType === tab.type
                          ? "verifier-ocr-document-tab-active"
                          : ""
                      }`}
                      onClick={() => handleTabClick(tab)}
                      disabled={refreshingOcr}
                    >
                      <span className="verifier-ocr-document-tab-number">
                        {tab.number}
                      </span>

                      <span className="verifier-ocr-document-tab-label">
                        {tab.label}
                      </span>

                      <span
                        className={`verifier-document-tab-status verifier-document-tab-status-${tabStatus.state}`}
                      >
                        <span className="verifier-document-tab-status-dot"></span>
                        <span>{tabStatus.text}</span>
                      </span>
                    </button>
                  );
                })}
              </div>

              <div className="verifier-ocr-refresh-content">
                <div className="verifier-ocr-document-content">
                  {filteredDocuments.map((doc) => {
                    const docLabel =
                      doc.document_type
                        .replace(/_/g, " ")
                        .replace(/\b\w/g, (c) =>
                          c.toUpperCase()
                        );

                    const relatedChecks =
                      app.verification_checks?.filter(
                        (c) => c.document_id === doc.id
                      ) || [];

                    const isLatestVersion =
                      latestDocsMap[doc.document_type]?.id ===
                      doc.id;

                    const flagState =
                      flaggedDocs[doc.document_type];

                    const reasonOptions =
                      reasonsByDocType[doc.document_type] || [];

                    const previewFile =
                      previewFiles[doc.id];

                    const confidence =
                      doc.ocr_result?.confidence_score
                        ? `${(
                            doc.ocr_result.confidence_score * 100
                          ).toFixed(1)}%`
                        : "—";

                    const displayedChecks =
                      isLatestVersion
                        ? filteredChecks
                        : relatedChecks;

                    return (
                      <div
                        className="verifier-ocr-review-card mb-4"
                        key={doc.id}
                        style={{
                          opacity: isLatestVersion
                            ? 1
                            : 0.75,
                        }}
                      >
                        <div className="verifier-ocr-review-header">
                          <div className="verifier-ocr-review-header-left">
                            <div className="verifier-ocr-review-doc-icon">
                              <svg
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="1.8"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              >
                                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                                <polyline points="14 2 14 8 20 8" />
                                <line
                                  x1="8"
                                  y1="13"
                                  x2="16"
                                  y2="13"
                                />
                                <line
                                  x1="8"
                                  y1="17"
                                  x2="14"
                                  y2="17"
                                />
                              </svg>
                            </div>

                            <div>
                              <div className="d-flex align-items-center gap-2 flex-wrap">
                                <h6 className="verifier-ocr-review-title">
                                  {docLabel}
                                </h6>

                                {isLatestVersion ? (
                                  <span className="badge bg-primary verifier-ocr-badge">
                                    Current Version
                                  </span>
                                ) : (
                                  <span className="badge bg-secondary verifier-ocr-badge">
                                    Archived (v{doc.version})
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="verifier-ocr-review-actions">
                            <button
                              type="button"
                              className="verifier-ocr-file-btn"
                              onClick={() =>
                                handleViewFile(doc.id)
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

                              View File
                            </button>

                            {doc.ocr_result?.raw_text && (
                              <button
                                type="button"
                                className="verifier-ocr-file-btn"
                                onClick={() =>
                                  setActiveRawDocId(
                                    activeRawDocId ===
                                      doc.id
                                      ? null
                                      : doc.id
                                  )
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
                                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                                  <polyline points="14 2 14 8 20 8" />
                                </svg>

                                {activeRawDocId === doc.id
                                  ? "Hide Raw OCR"
                                  : "Raw OCR"}
                              </button>
                            )}
                          </div>
                        </div>

                        <div className="verifier-ocr-review-layout">
                          <div className="verifier-ocr-preview-column">
                            <div className="verifier-ocr-preview-heading">
                              Document Preview
                            </div>

                            <div className="verifier-ocr-preview-frame">
                              {!previewFile ? (
                                <div className="verifier-ocr-preview-loading">
                                  <span
                                    className="spinner-border spinner-border-sm"
                                    role="status"
                                  />

                                  <span>
                                    Loading preview...
                                  </span>
                                </div>
                              ) : previewFile.type.startsWith(
                                  "image/"
                                ) ? (
                                <div
                                  className="verifier-ocr-preview-image-wrap"
                                  onClick={() =>
                                    setZoomPreview({
                                      url: previewFile.url,
                                      label: docLabel,
                                    })
                                  }
                                >
                                  <img
                                    src={previewFile.url}
                                    alt={`${docLabel} preview`}
                                    className="verifier-ocr-preview-image"
                                  />

                                  <div className="verifier-ocr-preview-zoom-overlay">
                                    <div className="verifier-ocr-preview-zoom-icon">
                                      <svg
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth="2"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                      >
                                        <circle
                                          cx="11"
                                          cy="11"
                                          r="7"
                                        />
                                        <line
                                          x1="16.5"
                                          y1="16.5"
                                          x2="21"
                                          y2="21"
                                        />
                                        <line
                                          x1="11"
                                          y1="8"
                                          x2="11"
                                          y2="14"
                                        />
                                        <line
                                          x1="8"
                                          y1="11"
                                          x2="14"
                                          y2="11"
                                        />
                                      </svg>
                                    </div>
                                  </div>
                                </div>
                              ) : (
                                <iframe
                                  src={previewFile.url}
                                  title={`${docLabel} preview`}
                                  className="verifier-ocr-preview-iframe"
                                />
                              )}
                            </div>

                            <div className="verifier-ocr-preview-meta">
                              <div className="verifier-ocr-preview-meta-row">
                                <span>File Name:</span>
                                <strong title={doc.file_name}>
                                  {doc.file_name}
                                </strong>
                              </div>

                              <div className="verifier-ocr-preview-meta-row">
                                <span>
                                  Uploaded & Processed:
                                </span>
                                <strong>
                                  {formatTimestamp(
                                    doc.created_at ||
                                      doc.updated_at
                                  )}
                                </strong>
                              </div>

                              <div className="verifier-ocr-preview-meta-row">
                                <span>Confidence:</span>
                                <strong>{confidence}</strong>
                              </div>
                            </div>
                          </div>

                          <div className="verifier-ocr-results-column">
                            <div className="verifier-checkpoints-bar">
                              <div className="verifier-checkpoints-info">
                                <div className="verifier-checkpoints-title-row">
                                  <span className="verifier-checkpoints-title">
                                    Checkpoints
                                  </span>

                                  {activeOverallStatus && (
                                    <span
                                      className={`badge verifier-ocr-badge ${activeOverallStatus.class}`}
                                    >
                                      {
                                        activeOverallStatus.text
                                      }
                                    </span>
                                  )}
                                </div>
                              </div>

                              <div className="verifier-checkpoints-controls">
                                <div className="verifier-checkpoints-segments">
                                  <button
                                    type="button"
                                    className={`verifier-checkpoint-segment ${
                                      checkpointFilter ===
                                      "all"
                                        ? "verifier-checkpoint-segment-active"
                                        : ""
                                    }`}
                                    onClick={() =>
                                      setCheckpointFilter(
                                        "all"
                                      )
                                    }
                                  >
                                    All ({checkpointTotal})
                                  </button>

                                  <button
                                    type="button"
                                    className={`verifier-checkpoint-segment ${
                                      checkpointFilter ===
                                      "review"
                                        ? "verifier-checkpoint-segment-active"
                                        : ""
                                    }`}
                                    onClick={() =>
                                      setCheckpointFilter(
                                        "review"
                                      )
                                    }
                                  >
                                    Review (
                                    {checkpointReview})
                                  </button>

                                  <button
                                    type="button"
                                    className={`verifier-checkpoint-segment ${
                                      checkpointFilter ===
                                      "passed"
                                        ? "verifier-checkpoint-segment-active"
                                        : ""
                                    }`}
                                    onClick={() =>
                                      setCheckpointFilter(
                                        "passed"
                                      )
                                    }
                                  >
                                    Passed (
                                    {checkpointPassed})
                                  </button>
                                </div>
                              </div>
                            </div>

                            {displayedChecks.length > 0 ? (
                              <div className="verifier-ocr-check-list">
                                {displayedChecks.map(
                                  (check) => (
                                    <div
                                      className={`verifier-ocr-check-card ${
                                        check.passed
                                          ? "verifier-ocr-check-card-passed"
                                          : "verifier-ocr-check-card-failed"
                                      }`}
                                      key={check.id}
                                    >
                                      <div className="verifier-ocr-check-header">
                                        <div className="verifier-ocr-check-header-left">
                                          <span className="verifier-ocr-check-name">
                                            {getCheckRuleLabel(
                                              check.check_name
                                            )}
                                          </span>

                                          <code
                                            className={`verifier-ocr-check-code ${
                                              check.passed
                                                ? "verifier-ocr-check-code-passed"
                                                : "verifier-ocr-check-code-failed"
                                            }`}
                                          >
                                            {
                                              check.check_name
                                            }
                                          </code>

                                          {check.metadata
                                            ?.flag ===
                                            "SUGGESTED_DISAPPROVAL" && (
                                            <span className="badge bg-dark verifier-ocr-badge">
                                              Suggested:
                                              Reject
                                            </span>
                                          )}
                                        </div>

                                        <OcrBadge
                                          passed={
                                            check.passed
                                          }
                                        />
                                      </div>

                                      <div className="verifier-ocr-check-values">
                                        <div className="verifier-ocr-check-value-group">
                                          <span className="verifier-ocr-check-value-label">
                                            EXTRACTED VALUE
                                          </span>

                                          <span className="verifier-ocr-check-value">
                                            {check.extracted_value ||
                                              "not extracted"}
                                          </span>
                                        </div>

                                        <div className="verifier-ocr-check-value-group">
                                          <span className="verifier-ocr-check-value-label">
                                            EXPECTED VALUE
                                          </span>

                                          <span className="verifier-ocr-check-value">
                                            {check.expected_value ??
                                              "—"}
                                          </span>
                                        </div>
                                      </div>

                                      {check.passed ? (
                                        <div className="verifier-ocr-check-pass-reason">
                                          <span className="verifier-ocr-check-pass-label">
                                            Flag Reason:
                                          </span>

                                          <span className="verifier-ocr-check-pass-none">
                                            None
                                          </span>

                                          <span className="verifier-ocr-check-pass-message">
                                            •{" "}
                                            {getPassedCheckMessage(
                                              check.check_name
                                            )}
                                          </span>
                                        </div>
                                      ) : (
                                        <div className="verifier-ocr-check-flag">
                                          <span className="verifier-ocr-check-flag-icon">
                                            !
                                          </span>

                                          <span className="verifier-ocr-check-flag-label">
                                            Flag Reason:
                                          </span>

                                          <span className="verifier-ocr-check-flag-text">
                                            {check.flag_reason ??
                                              "—"}
                                          </span>
                                        </div>
                                      )}
                                    </div>
                                  )
                                )}
                              </div>
                            ) : (
                              <div className="verifier-ocr-empty">
                                {activeChecks.length ===
                                0 ? (
                                  doc.status ===
                                  "failed" ? (
                                    <div className="verifier-ocr-empty-content">
                                      <span className="text-danger">
                                        OCR processing
                                        failed for this
                                        document. Try
                                        refreshing, or ask
                                        the applicant to
                                        re-upload.
                                      </span>

                                      <button
                                        type="button"
                                        className="verifier-ocr-file-btn mt-2"
                                        onClick={() =>
                                          handleRetryOcr(
                                            doc.id
                                          )
                                        }
                                        disabled={
                                          refreshingOcr
                                        }
                                      >
                                        {refreshingOcr
                                          ? "Retrying..."
                                          : "Retry OCR Check"}
                                      </button>
                                    </div>
                                  ) : [
                                      "processing",
                                      "pending",
                                      "pending_prescreening",
                                    ].includes(
                                      app.status
                                    ) ? (
                                    <div className="verifier-ocr-empty-content">
                                      <span
                                        className="spinner-border spinner-border-sm verifier-ocr-empty-spinner"
                                        role="status"
                                      />

                                      <span>
                                        System is
                                        extracting text
                                        via OCR and
                                        verifying rules.
                                        Try refreshing
                                        shortly.
                                      </span>
                                    </div>
                                  ) : (
                                    <div className="verifier-ocr-empty-content">
                                      <span>
                                        No execution
                                        parameters run
                                        against this file
                                        configuration.
                                      </span>
                                    </div>
                                  )
                                ) : checkpointFilter ===
                                  "review" ? (
                                  <div className="verifier-ocr-empty-content">
                                    <span>
                                      No review
                                      checkpoints for
                                      this document.
                                    </span>
                                  </div>
                                ) : checkpointFilter ===
                                  "passed" ? (
                                  <div className="verifier-ocr-empty-content">
                                    <span>
                                      No passed
                                      checkpoints for
                                      this document.
                                    </span>
                                  </div>
                                ) : (
                                  <div className="verifier-ocr-empty-content">
                                    <span>
                                      No checkpoints
                                      available for this
                                      document.
                                    </span>
                                  </div>
                                )}
                              </div>
                            )}

                            {activeRawDocId ===
                              doc.id &&
                              doc.ocr_result
                                ?.raw_text && (
                                <div className="bg-light border rounded p-3 mt-3 text-start verifier-ocr-raw">
                                  <h6 className="small fw-bold mb-2 text-dark verifier-ocr-raw-title">
                                    PaddleOCR Text
                                    Output Stream:
                                  </h6>

                                  <pre
                                    className="mb-0 verifier-ocr-raw-text"
                                    style={{
                                      fontSize:
                                        "0.75rem",
                                      maxHeight:
                                        "200px",
                                      overflowY:
                                        "auto",
                                      whiteSpace:
                                        "pre-wrap",
                                    }}
                                  >
                                    {(() => {
                                      try {
                                        const lines =
                                          JSON.parse(
                                            doc
                                              .ocr_result
                                              .raw_text
                                          );

                                        return lines
                                          .map(
                                            (
                                              l,
                                              i
                                            ) =>
                                              `[Line ${
                                                i +
                                                1
                                              } | Conf: ${(
                                                (l.confidence ??
                                                  0) *
                                                100
                                              ).toFixed(
                                                0
                                              )}%] ${
                                                l.text ??
                                                ""
                                              }`
                                          )
                                          .join(
                                            "\n"
                                          );
                                      } catch {
                                        return doc
                                          .ocr_result
                                          .raw_text;
                                      }
                                    })()}
                                  </pre>
                                </div>
                              )}
                          </div>
                        </div>

                        {isLatestVersion && (
                          <details
                            className="verifier-ocr-flag-section verifier-ocr-review-flags"
                            open={
                              openFlagDocId === doc.id
                            }
                            onToggle={(e) => {
                              if (
                                e.currentTarget.open
                              ) {
                                setOpenFlagDocId(
                                  doc.id
                                );
                              } else if (
                                openFlagDocId ===
                                doc.id
                              ) {
                                setOpenFlagDocId(
                                  null
                                );
                              }
                            }}
                          >
                            <summary
                              className="text-danger fw-semibold verifier-ocr-flag-title"
                              style={{
                                cursor: "pointer",
                              }}
                            >
                              Flag an issue with this
                              document
                            </summary>

                            <div className="verifier-ocr-flag-options">
                              {reasonOptions.map(
                                (reason) => (
                                  <div
                                    className="form-check verifier-ocr-flag-option"
                                    key={reason}
                                  >
                                    <input
                                      className="form-check-input"
                                      type="checkbox"
                                      id={`flag-${doc.document_type}-${reason}`}
                                      checked={flagState.reasons.includes(
                                        reason
                                      )}
                                      onChange={() =>
                                        toggleReason(
                                          doc.document_type,
                                          reason
                                        )
                                      }
                                    />

                                    <label
                                      className="form-check-label small verifier-ocr-check-label"
                                      htmlFor={`flag-${doc.document_type}-${reason}`}
                                    >
                                      {getFlagReasonLabel(
                                        reason
                                      )}
                                    </label>

                                    {reason === OTHER &&
                                      flagState.reasons.includes(
                                        OTHER
                                      ) && (
                                        <input
                                          className="form-control form-control-sm verifier-ocr-other-input verifier-ocr-other-inline"
                                          placeholder="Specify the issue..."
                                          value={
                                            flagState.otherText
                                          }
                                          onChange={(
                                            e
                                          ) =>
                                            setOtherText(
                                              doc.document_type,
                                              e
                                                .target
                                                .value
                                            )
                                          }
                                        />
                                      )}
                                  </div>
                                )
                              )}
                            </div>
                          </details>
                        )}
                      </div>
                    );
                  })}
                </div>

                <div className="verifier-review-bottom-actions">
                  <div>
                    {documentDirection ===
                      "backward" &&
                    previousDocument ? (
                      <button
                        type="button"
                        className="verifier-ocr-file-btn verifier-document-nav-btn"
                        onClick={() =>
                          changeDocument(
                            previousDocument,
                            "backward"
                          )
                        }
                      >
                        <svg
                          className="verifier-document-nav-icon"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <polyline points="15 18 9 12 15 6" />
                        </svg>

                        <span>
                          Previous:{" "}
                          {previousDocument.label}
                        </span>
                      </button>
                    ) : nextDocument ? (
                      <button
                        type="button"
                        className="verifier-ocr-file-btn verifier-document-nav-btn"
                        onClick={() =>
                          changeDocument(
                            nextDocument,
                            "forward"
                          )
                        }
                      >
                        <span>
                          Next: {nextDocument.label}
                        </span>

                        <svg
                          className="verifier-document-nav-icon"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <polyline points="9 18 15 12 9 6" />
                        </svg>
                      </button>
                    ) : previousDocument ? (
                      <button
                        type="button"
                        className="verifier-ocr-file-btn verifier-document-nav-btn"
                        onClick={() =>
                          changeDocument(
                            previousDocument,
                            "backward"
                          )
                        }
                      >
                        <svg
                          className="verifier-document-nav-icon"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <polyline points="15 18 9 12 15 6" />
                        </svg>

                        <span>
                          Previous:{" "}
                          {previousDocument.label}
                        </span>
                      </button>
                    ) : null}
                  </div>

                  {[
                    "for_review",
                    "pending_prescreening",
                    "reupload_requested",
                  ].includes(app.status) && (
                    <button
                      type="button"
                      className="verifier-proceed-action-btn"
                      onClick={handleProceed}
                    >
                      Proceed to Verification Action
                    </button>
                  )}
                </div>

                {refreshingOcr && (
                  <div className="verifier-ocr-refresh-overlay">
                    <div className="verifier-ocr-refresh-loading">
                      <div
                        className="spinner-border"
                        role="status"
                      ></div>

                      <span>
                        Refreshing OCR results...
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>

        {zoomPreview && (
          <div
            className="verifier-preview-modal"
            onClick={() =>
              setZoomPreview(null)
            }
          >
            <div
              className="verifier-preview-modal-content"
              onClick={(e) =>
                e.stopPropagation()
              }
            >
              <button
                type="button"
                className="verifier-preview-modal-close"
                onClick={() =>
                  setZoomPreview(null)
                }
                aria-label="Close preview"
              >
                ×
              </button>

              <img
                src={zoomPreview.url}
                alt={`${zoomPreview.label} enlarged preview`}
                className="verifier-preview-modal-image"
              />
            </div>
          </div>
        )}

        <PanelFooter />
      </div>
    </div>
  );
}

export default VerifierApplicationReview;