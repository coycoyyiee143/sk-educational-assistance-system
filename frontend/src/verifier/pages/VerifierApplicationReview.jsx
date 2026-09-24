import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { usePolling } from "../../hooks/usePolling";
import { useUserPhoto } from "../../hooks/useUserPhoto";
import VerifierNavigation from "../components/VerifierNavigation";
import VerifierTopbar from "../components/VerifierTopbar";
import PanelFooter from "../../components/PanelFooter";
import api from "../../services/api";
import {
  getReasonsByDocType,
  getFlatReasons,
  OTHER,
  getCheckDisplayLabel,
  translateFlagReason,
  stripTechnicalDetail,
} from "../constants/verificationReasons";
import {
  getVerifierStatusLabel,
  getVerifierBadgeClass,
} from "../../components/StatusConstants";

// ELA (image_integrity) reports its softest, most ambiguous tier as
// "Minor Compression Irregularities Detected" — one of two possible
// flags tripped, not both (see ela.py's describe_ela_score). This is
// common on legitimate screenshots/re-saved images and isn't as
// concerning as a genuine "Failed" (moderate/significant) result, so
// it gets its own warning color instead of blending in with red.
function isMinorElaFlag(check) {
  return (
    !check.passed &&
    check.check_name === "image_integrity" &&
    check.extracted_value === "Minor Compression Irregularities Detected"
  );
}

function OcrBadge({ passed, checkName, extractedValue }) {
  if (
    !passed &&
    checkName === "image_integrity" &&
    extractedValue === "Minor Compression Irregularities Detected"
  ) {
    return (
      <span className="badge bg-warning text-dark verifier-ocr-badge">
        Minor
      </span>
    );
  }

  return passed ? (
    <span className="badge bg-success verifier-ocr-badge">Passed</span>
  ) : (
    <span className="badge bg-danger verifier-ocr-badge">Failed</span>
  );
}

const LATE_DISPLAY_CHECK_NAMES = [
  "image_integrity",
  "ai_generation_provenance",
];

const PREVIEW_INTEGRITY_CHECK_NAMES = [
  "image_integrity",
  "ai_generation_provenance",
];

function sortChecksForDisplay(checks) {
  return [...checks].sort((a, b) => {
    const aLate = LATE_DISPLAY_CHECK_NAMES.includes(a.check_name) ? 1 : 0;
    const bLate = LATE_DISPLAY_CHECK_NAMES.includes(b.check_name) ? 1 : 0;
    if (aLate !== bLate) return aLate - bLate;

    // Certificate Year reads naturally as a follow-up to Residency
    // Geofence (both come from the same barangay/cert extraction pass),
    // so it should always display after it regardless of which order
    // the checks happened to arrive from the API in.
    if (a.check_name === "cert_year_match" && b.check_name === "residency_geofence") return 1;
    if (a.check_name === "residency_geofence" && b.check_name === "cert_year_match") return -1;

    return 0;
  });
}

// Some checks don't extract a value FROM the document at all — they
// compute an assessment (a layout/tamper/AI-generation verdict) and
// report that as their "extracted" field. Labeling that "EXTRACTED
// VALUE" implies it came off the document like a name or a date, which
// is misleading, so these get a different column header.
const ASSESSMENT_CHECK_NAMES = [
  "template_consistency",
  "image_integrity",
  "ai_generation_provenance",
];

function getValueColumnLabel(checkName) {
  return ASSESSMENT_CHECK_NAMES.includes(checkName) ? "ASSESSMENT" : "EXTRACTED VALUE";
}

const DOCUMENT_TABS = [
  { number: 1, type: "registration_form", label: "Registration Form" },
  { number: 2, type: "school_id", label: "School ID" },
  { number: 3, type: "voters_certificate", label: "Voter Certificate" },
];

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
    const flat = getFlatReasons(
      reasonsByDocType[d.document_type] || { primary: [], additional: [] }
    );
    const stored = d.reason_categories || [];
    const knownIds = stored
      .map((c) => flat.find((r) => r.verifierLabel === c)?.id)
      .filter(Boolean);
    const custom = stored.filter((c) => !flat.some((r) => r.verifierLabel === c));

    base[d.document_type] = {
      reasons: custom.length > 0 ? [...knownIds, OTHER] : knownIds,
      otherText: custom.join(" "),
    };
  });

  return base;
}

function VerifierApplicationReview() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  const [app, setApp] = useState(null);
  const { url: profilePhotoUrl, status: profilePhotoStatus } = useUserPhoto(
    app?.user?.id
  );
  const [loading, setLoading] = useState(true);
  const [refreshingOcr, setRefreshingOcr] = useState(false);
  // Panel/demo use only -- see VerifierController::previewDebugOcr. Keyed
  // by document id: { loading, error, checks, would_auto_reupload }. Never
  // written into `app` state, since this is a read-only preview that must
  // not be mistaken for the document's real, saved verification result.
  const [debugPreviews, setDebugPreviews] = useState({});
  const [error, setError] = useState("");
  // Separate from `error` above — that one gates the whole "not found" page
  // (see `if (error || !app) return ...` below), so action failures that
  // happen after the page has already loaded get their own dismissible
  // banner instead of blowing away the loaded application view.
  const [actionError, setActionError] = useState("");
  const [activeRawDocId, setActiveRawDocId] = useState(null);
  const [activeDocumentType, setActiveDocumentType] = useState(
    "registration_form"
  );
  const [checkpointFilters, setCheckpointFilters] = useState({
    voters_certificate: "all",
    school_id: "all",
    registration_form: "all",
  });
  const [previewFiles, setPreviewFiles] = useState({});
  const [zoomPreview, setZoomPreview] = useState(null);
  const [openFlagDocId, setOpenFlagDocId] = useState(null);
  const [showScrollTop, setShowScrollTop] = useState(false);

  // Measured heights of the sticky topbar and sticky document tabs bar,
  // so both the tabs' sticky offset and each card's scroll-margin can be
  // computed from the REAL rendered height instead of a guessed pixel
  // value that breaks the moment either element's content/height changes.
  const [topbarHeight, setTopbarHeight] = useState(0);
  const [tabsHeight, setTabsHeight] = useState(0);

  const [flaggedDocs, setFlaggedDocs] = useState({
    registration_form: { reasons: [], otherText: "" },
    school_id: { reasons: [], otherText: "" },
    voters_certificate: { reasons: [], otherText: "" },
  });

  useEffect(() => {
    if (!actionError) return;
    const t = setTimeout(() => setActionError(""), 6000);
    return () => clearTimeout(t);
  }, [actionError]);

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

  // Auto-refresh the application while it's still in a state a verifier
  // needs to watch (waiting on OCR, or waiting on this verifier's own
  // review) — so a document that finishes processing, or gets
  // re-uploaded by the applicant, shows up without a manual refresh.
  // Deliberately only updates `app` itself, NOT `flaggedDocs` — that
  // holds this verifier's in-progress typed review notes, and a poll
  // tick must never overwrite something they're actively filling in.
  // Self-terminating: once `app.status` leaves the watched set (this
  // verifier submits a decision, or someone else does), `enabled`
  // recalculates to false and polling stops on its own.
  const pollForApplicationUpdate = useCallback(async () => {
    try {
      const res = await api.get(`/verifier/applications/${id}`);
      setApp(res.data);
    } catch {
      // Silent — a failed poll tick just tries again on the next one.
    }
  }, [id]);

  usePolling(pollForApplicationUpdate, {
    intervalMs: 10000,
    enabled: !!app && ["pending_prescreening", "for_review"].includes(app.status),
  });

  // Not a lock — just a heads-up so two verifiers don't both spend time
  // reviewing the same application without knowing it. Heartbeats every
  // 10s while this page is open; the backend treats a stale heartbeat
  // (see VerifierController::heartbeat()) as that verifier having left,
  // so there's nothing to explicitly release on navigate-away/close.
  const [otherViewer, setOtherViewer] = useState(null);

  const heartbeat = useCallback(() => {
    return api
      .post(`/verifier/applications/${id}/heartbeat`)
      .then((res) => setOtherViewer(res.data.other_viewer))
      .catch(() => { });
  }, [id]);

  useEffect(() => {
    heartbeat();
  }, [heartbeat]);

  usePolling(heartbeat, { intervalMs: 10000 });

  useEffect(() => {
    if (!app?.documents) return;

    let cancelled = false;

    const latestByType = {};
    app.documents.forEach((doc) => {
      if (
        !latestByType[doc.document_type] ||
        doc.id > latestByType[doc.document_type].id
      ) {
        latestByType[doc.document_type] = doc;
      }
    });
    const docs = Object.values(latestByType);

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
  }, [app]);

  // Measures the actual rendered height of the topbar and the sticky
  // document-tabs bar, so the tabs' sticky "top" offset and each card's
  // scroll-margin can be computed from the real height instead of a
  // guessed pixel value. Re-runs once `app` loads (the tabs bar doesn't
  // exist in the DOM yet during the initial loading state) and on
  // resize, since either element may wrap or resize at smaller widths.
  useEffect(() => {
    function measureHeights() {
      const topbar = document.querySelector(".verifier-topbar");
      const tabs = document.querySelector(".verifier-ocr-document-tabs");
      setTopbarHeight(topbar ? topbar.getBoundingClientRect().height : 0);
      setTabsHeight(tabs ? tabs.getBoundingClientRect().height : 0);
    }
    measureHeights();
    window.addEventListener("resize", measureHeights);
    return () => window.removeEventListener("resize", measureHeights);
  }, [app]);

  // Scroll-spy: while scrolling (not just clicking a tab), keeps the
  // active document tab in sync with whichever document card is
  // currently under the sticky topbar+tabs bar. Walks all three
  // sections and keeps updating `current` to the last one whose top
  // has scrolled past the offset — so the section actually in view
  // (not the next one down) stays highlighted.
  useEffect(() => {
    function handleScrollSpy() {
      const offset = topbarHeight + tabsHeight + 16;

      let current = DOCUMENT_TABS[0].type;

      for (const tab of DOCUMENT_TABS) {
        const el = document.getElementById(`verifier-document-${tab.type}`);
        if (!el) continue;

        const rect = el.getBoundingClientRect();
        if (rect.top <= offset) {
          current = tab.type;
        }
      }

      setActiveDocumentType(current);
    }

    const scrollContainer = document.querySelector(".verifier-main");
    scrollContainer?.addEventListener("scroll", handleScrollSpy, { passive: true });
    window.addEventListener("scroll", handleScrollSpy, { passive: true });
    handleScrollSpy();

    return () => {
      scrollContainer?.removeEventListener("scroll", handleScrollSpy);
      window.removeEventListener("scroll", handleScrollSpy);
    };
  }, [topbarHeight, tabsHeight, app]);

  useEffect(() => {
    const scrollContainer = document.querySelector(".verifier-main");

    const getScrollTop = () =>
      Math.max(
        scrollContainer?.scrollTop || 0,
        window.scrollY || 0,
        document.documentElement.scrollTop || 0
      );

    const handleScroll = () => setShowScrollTop(getScrollTop() > 360);

    scrollContainer?.addEventListener("scroll", handleScroll, {
      passive: true,
    });
    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();

    return () => {
      scrollContainer?.removeEventListener("scroll", handleScroll);
      window.removeEventListener("scroll", handleScroll);
    };
  }, []);

  function scrollToTop() {
    document.querySelector(".verifier-main")?.scrollTo({
      top: 0,
      behavior: "smooth",
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  if (loading) {
    return (
      <div className="verifier-layout">
        <VerifierNavigation />

        <div className="verifier-main">
          <VerifierTopbar />

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

  const getCheckRuleLabel = (checkName) => getCheckDisplayLabel(checkName);

  const getPassedCheckMessage = (checkName) => {
    const messages = {
      cert_year_match: "Exact integer equality",
      identity_match: "Exact identity match",
      residency_geofence: "Exact boundary geofence match",
    };

    return messages[checkName] || "Verification rule matched";
  };

  // Older uploads for a document type are never deleted (see
  // ApplicationDocument.version) — the UI just showed the latest one. This
  // reconstructs, for each superseded version, whether it was replaced
  // because the system auto-flagged it or because a verifier manually
  // requested a re-upload, by matching each version's upload window
  // against `needs_auto_reupload`/`auto_reupload_reason` on the row itself,
  // or against a `reupload_requested` VerifierAction whose timestamp falls
  // inside that version's active window.
  function getPreviousVersions(docType, currentDoc) {
    const olderVersions = (app.documents || [])
      .filter((d) => d.document_type === docType && d.id !== currentDoc.id)
      .sort((a, b) => b.id - a.id);

    if (olderVersions.length === 0) return [];

    const orderedAsc = (app.documents || [])
      .filter((d) => d.document_type === docType)
      .sort((a, b) => a.id - b.id);

    const reuploadActions = (app.verifier_actions || [])
      .filter((a) => a.action === "reupload_requested" && a.reupload_details)
      .flatMap((a) =>
        a.reupload_details
          .filter((d) => d.document_type === docType)
          .map((d) => ({ createdAt: new Date(a.created_at), reason: d.reason }))
      );

    return olderVersions.map((v) => {
      const idx = orderedAsc.findIndex((d) => d.id === v.id);
      const nextDoc = orderedAsc[idx + 1];
      const windowStart = new Date(v.created_at);
      const windowEnd = nextDoc ? new Date(nextDoc.created_at) : new Date();

      let source = null;
      if (v.needs_auto_reupload || v.auto_reupload_reason) {
        source = { type: "auto", reason: v.auto_reupload_reason };
      } else {
        const match = reuploadActions.find(
          (a) => a.createdAt >= windowStart && a.createdAt <= windowEnd
        );
        if (match) source = { type: "verifier", reason: match.reason };
      }

      return { doc: v, source };
    });
  }

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

  const latestDocIds = Object.values(latestDocsMap).map((d) => d.id);

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

  function getDocumentTabStatus(documentType) {
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

    return checks.some((check) => !check.passed)
      ? { text: "For Review", state: "review" }
      : { text: "Passed", state: "passed" };
  }

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

  function setCheckpointFilterFor(docType, value) {
    setCheckpointFilters((prev) => ({ ...prev, [docType]: value }));
  }

  function handleDocumentTabClick(documentType) {
    setActiveDocumentType(documentType);
    document
      .getElementById(`verifier-document-${documentType}`)
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
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
      setOpenFlagDocId(null);
    } catch {
      setActionError("Failed to refresh OCR verification results.");
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
      setActionError("Failed to queue OCR retry.");
    } finally {
      setRefreshingOcr(false);
    }
  }

  async function handlePreviewDebugChecks(docId) {
    setDebugPreviews((prev) => ({
      ...prev,
      [docId]: { ...(prev[docId] || {}), loading: true, error: null },
    }));

    try {
      const res = await api.post(
        `/verifier/documents/${docId}/debug-preview`
      );

      setDebugPreviews((prev) => ({
        ...prev,
        [docId]: {
          loading: false,
          error: null,
          checks: res.data.checks || [],
          wouldAutoReupload: res.data.would_auto_reupload || [],
        },
      }));
    } catch (err) {
      setDebugPreviews((prev) => ({
        ...prev,
        [docId]: {
          ...(prev[docId] || {}),
          loading: false,
          error:
            err?.response?.data?.error ||
            "Failed to load debug preview.",
        },
      }));
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
      setActionError(
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
      setActionError("Failed to load document.");
    }
  }

  return (
    <div className="verifier-layout">
      <VerifierNavigation />

      <div className="verifier-main">
        <VerifierTopbar />

        <section className="page-section">
          <div className="container-fluid">

            {actionError && <div className="alert alert-danger">{actionError}</div>}

            <div className="verifier-dashboard-header">

              <button
                type="button"
                className="verifier-review-back-btn"
                onClick={() =>
                  // Carries back whatever tab/page the list was on when
                  // this review was opened (see the Link's state in
                  // VerifierApplicationList) so the verifier lands back
                  // where they left off instead of always resetting to
                  // For Review page 1. If that state is missing (e.g. a
                  // direct link or a refreshed review page), this is just
                  // a plain navigation with no restore -- same as before.
                  navigate("/VerifierApplicationList", {
                    state: location.state?.verifierListRestore
                      ? { verifierListRestore: location.state.verifierListRestore }
                      : undefined,
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

              {app.appeal_reason && (
                <div className="alert alert-warning small mt-3 mb-0">
                  <strong>Appeal Reason:</strong> {app.appeal_reason}
                  {app.appeal_document_path && (
                    <>
                      {" "}
                      <button
                        type="button"
                        className="btn btn-link p-0 align-baseline"
                        onClick={() => {
                          api
                            .get(
                              `/applications/${app.id}/appeal-document`,
                              { responseType: "blob" }
                            )
                            .then((res) => {
                              const url = URL.createObjectURL(res.data);
                              window.open(url, "_blank");
                            });
                        }}
                      >
                        View supporting document
                      </button>
                    </>
                  )}
                  {app.appeal_decision_notes && (
                    <div className="mt-2">
                      <strong>Decision Notes:</strong>{" "}
                      {app.appeal_decision_notes}
                    </div>
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
                  {profilePhotoStatus === "ready" ? (
                    <img
                      src={profilePhotoUrl}
                      alt="Applicant"
                      className="verifier-review-profile-avatar verifier-review-profile-photo"
                    />
                  ) : (
                    <div className="verifier-review-profile-avatar">
                      {user?.first_name?.charAt(0)}
                      {user?.last_name?.charAt(0)}
                    </div>
                  )}

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
                            ? `${profile.guardian_first_name ?? ""} ${profile.guardian_middle_name ?? ""
                              } ${profile.guardian_last_name ?? ""
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
                    className={`verifier-ocr-refresh-icon ${refreshingOcr
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

              <div
                className="verifier-ocr-document-tabs"
                role="tablist"
                style={{ position: "sticky", top: `${topbarHeight}px`, zIndex: 10, background: "#ffffff" }}
              >
                {DOCUMENT_TABS.map((tab) => {
                  const tabStatus = getDocumentTabStatus(tab.type);

                  return (
                    <button
                      type="button"
                      role="tab"
                      key={tab.type}
                      className={`verifier-ocr-document-tab ${activeDocumentType === tab.type
                        ? "verifier-ocr-document-tab-active"
                        : ""
                        }`}
                      aria-selected={activeDocumentType === tab.type}
                      onClick={() => handleDocumentTabClick(tab.type)}
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
                {DOCUMENT_TABS.map((tab) => {
                  const doc = latestDocsMap[tab.type];

                  if (!doc) {
                    return (
                      <div
                        className="verifier-ocr-review-card mb-4"
                        key={tab.type}
                        id={`verifier-document-${tab.type}`}
                        style={{ scrollMarginTop: `${topbarHeight + tabsHeight + 8}px` }}
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
                              </svg>
                            </div>

                            <h6 className="verifier-ocr-review-title">
                              {tab.label}
                            </h6>
                          </div>
                        </div>

                        <div className="verifier-ocr-empty">
                          <div className="verifier-ocr-empty-content">
                            <span>
                              Not yet uploaded by the applicant.
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  }

                  const docLabel = tab.label;

                  const relatedChecks = sortChecksForDisplay(
                    app.verification_checks?.filter(
                      (c) => c.document_id === doc.id
                    ) || []
                  );

                  const overallStatus = getOverallDocStatus(doc.id, true);

                  const checkpointFilter = checkpointFilters[tab.type];

                  const checkpointTotal = relatedChecks.length;
                  const checkpointReview = relatedChecks.filter(
                    (c) => !c.passed
                  ).length;
                  const checkpointPassed = relatedChecks.filter(
                    (c) => c.passed
                  ).length;

                  const displayedChecks = relatedChecks.filter((check) => {
                    if (checkpointFilter === "review") return !check.passed;
                    if (checkpointFilter === "passed") return check.passed;
                    return true;
                  });

                  const previewIntegrityChecks = displayedChecks.filter(
                    (check) =>
                      PREVIEW_INTEGRITY_CHECK_NAMES.includes(check.check_name)
                  );

                  const extractionChecks = displayedChecks.filter(
                    (check) =>
                      !PREVIEW_INTEGRITY_CHECK_NAMES.includes(check.check_name)
                  );

                  const flagState = flaggedDocs[tab.type];
                  const docReasonGroups = reasonsByDocType[tab.type] || { primary: [], additional: [] };
                  const previewFile = previewFiles[doc.id];

                  const confidence = doc.ocr_result?.confidence_score
                    ? `${(doc.ocr_result.confidence_score * 100).toFixed(1)}%`
                    : "—";

                  return (
                    <div
                      className="verifier-ocr-review-card mb-4"
                      key={doc.id}
                      id={`verifier-document-${tab.type}`}
                      style={{ scrollMarginTop: `${topbarHeight + tabsHeight + 8}px` }}
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
                              <line x1="8" y1="13" x2="16" y2="13" />
                              <line x1="8" y1="17" x2="14" y2="17" />
                            </svg>
                          </div>

                          <div>
                            <div className="d-flex align-items-center gap-2 flex-wrap">
                              <h6 className="verifier-ocr-review-title">
                                {docLabel}
                              </h6>

                              <span className="badge bg-primary verifier-ocr-badge">
                                Current Version
                              </span>
                            </div>
                          </div>

                        </div>

                        <div className="verifier-ocr-review-actions">
                          <button
                            type="button"
                            className="verifier-ocr-file-btn"
                            onClick={() => handleViewFile(doc.id)}
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
                              <circle cx="12" cy="12" r="3" />
                            </svg>

                            View File
                          </button>

                          {doc.ocr_result?.raw_text && (
                            <button
                              type="button"
                              className="verifier-ocr-file-btn"
                              onClick={() =>
                                setActiveRawDocId(
                                  activeRawDocId === doc.id ? null : doc.id
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

                      {(() => {
                        const previousVersions = getPreviousVersions(tab.type, doc);
                        if (previousVersions.length === 0) return null;
                        return (
                          <details className="verifier-doc-version-history">
                            <summary>
                              Previous versions ({previousVersions.length})
                            </summary>
                            <div className="verifier-doc-version-list">
                              {previousVersions.map(({ doc: v, source }) => (
                                <div key={v.id} className="verifier-doc-version-item">
                                  <div className="verifier-doc-version-item-head">
                                    <span>Version {v.version ?? "—"}</span>
                                    <span className="verifier-doc-version-date">
                                      {v.created_at
                                        ? new Date(v.created_at).toLocaleString()
                                        : "—"}
                                    </span>
                                    {source?.type === "auto" && (
                                      <span className="badge bg-secondary verifier-ocr-badge">
                                        System auto-flagged
                                      </span>
                                    )}
                                    {source?.type === "verifier" && (
                                      <span className="badge bg-warning text-dark verifier-ocr-badge">
                                        Verifier requested
                                      </span>
                                    )}
                                  </div>
                                  {source?.reason && (
                                    <div className="verifier-doc-version-reason">
                                      {source.reason}
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          </details>
                        );
                      })()}

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
                                <span>Loading preview...</span>
                              </div>
                            ) : previewFile.type.startsWith("image/") ? (
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
                                      <circle cx="11" cy="11" r="7" />
                                      <line x1="16.5" y1="16.5" x2="21" y2="21" />
                                      <line x1="11" y1="8" x2="11" y2="14" />
                                      <line x1="8" y1="11" x2="14" y2="11" />
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
                              <span>Uploaded & Processed:</span>
                              <strong>
                                {formatTimestamp(
                                  doc.created_at || doc.updated_at
                                )}
                              </strong>
                            </div>

                            <div className="verifier-ocr-preview-meta-row">
                              <span>Confidence:</span>
                              <strong>{confidence}</strong>
                            </div>
                          </div>

                          {previewIntegrityChecks.length > 0 && (
                            <div className="verifier-preview-extraction-checks">
                              <div className="verifier-ocr-preview-heading">
                                AI & Document Integrity
                              </div>

                              {previewIntegrityChecks.map((check) => (
                                <div
                                  className={`verifier-preview-extraction-check ${check.passed
                                    ? "verifier-preview-extraction-check-passed"
                                    : isMinorElaFlag(check)
                                      ? "verifier-preview-extraction-check-minor"
                                      : "verifier-preview-extraction-check-failed"
                                    }`}
                                  key={check.id}
                                >
                                  <strong className="verifier-preview-extraction-label">
                                    {getCheckRuleLabel(check.check_name)}
                                  </strong>
                                  <span className="verifier-preview-extraction-value">
                                    {check.extracted_value || "Not extracted"}
                                  </span>
                                  {!check.passed && check.flag_reason && (
                                    <span className="verifier-preview-extraction-detail">
                                      {stripTechnicalDetail(check.flag_reason)}
                                    </span>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        <div className="verifier-ocr-results-column">
                          <div className="verifier-checkpoints-bar">
                            <div className="verifier-checkpoints-info">
                              <div className="verifier-checkpoints-title-row">
                                <span className="verifier-checkpoints-title">
                                  Checkpoints
                                </span>

                                <span
                                  className={`badge verifier-ocr-badge ${overallStatus.class}`}
                                >
                                  {overallStatus.text}
                                </span>
                              </div>
                            </div>

                            <div className="verifier-checkpoints-controls">
                              <div className="verifier-checkpoints-segments">
                                <button
                                  type="button"
                                  className={`verifier-checkpoint-segment ${checkpointFilter === "all"
                                    ? "verifier-checkpoint-segment-active"
                                    : ""
                                    }`}
                                  onClick={() =>
                                    setCheckpointFilterFor(tab.type, "all")
                                  }
                                >
                                  All ({checkpointTotal})
                                </button>

                                <button
                                  type="button"
                                  className={`verifier-checkpoint-segment ${checkpointFilter === "review"
                                    ? "verifier-checkpoint-segment-active"
                                    : ""
                                    }`}
                                  onClick={() =>
                                    setCheckpointFilterFor(tab.type, "review")
                                  }
                                >
                                  Review ({checkpointReview})
                                </button>

                                <button
                                  type="button"
                                  className={`verifier-checkpoint-segment ${checkpointFilter === "passed"
                                    ? "verifier-checkpoint-segment-active"
                                    : ""
                                    }`}
                                  onClick={() =>
                                    setCheckpointFilterFor(tab.type, "passed")
                                  }
                                >
                                  Passed ({checkpointPassed})
                                </button>
                              </div>
                            </div>
                          </div>

                          {extractionChecks.length > 0 ? (
                            <div
                              className="verifier-ocr-check-list"
                              style={{
                                maxHeight: "700px",
                                overflowY: "auto",
                                paddingRight: "6px",
                              }}
                            >
                              {extractionChecks.map((check) => (
                                <div
                                  className={`verifier-ocr-check-card ${check.passed
                                    ? "verifier-ocr-check-card-passed"
                                    : "verifier-ocr-check-card-failed"
                                    }`}
                                  style={{ padding: "10px 14px", marginBottom: "8px" }}
                                  key={check.id}
                                >
                                  <div className="verifier-ocr-check-header">
                                    <div className="verifier-ocr-check-header-left">
                                      <span className="verifier-ocr-check-name">
                                        {getCheckRuleLabel(check.check_name)}
                                      </span>

                                      <code
                                        className={`verifier-ocr-check-code ${check.passed
                                          ? "verifier-ocr-check-code-passed"
                                          : "verifier-ocr-check-code-failed"
                                          }`}
                                      >
                                        {check.check_name}
                                      </code>

                                      {check.metadata?.flag ===
                                        "SUGGESTED_DISAPPROVAL" && (
                                          <span className="badge bg-dark verifier-ocr-badge">
                                            Suggested: Reject
                                          </span>
                                        )}
                                    </div>

                                    <OcrBadge
                                      passed={check.passed}
                                      checkName={check.check_name}
                                      extractedValue={check.extracted_value}
                                    />
                                  </div>

                                  <div
                                    className={`verifier-ocr-check-value-pair ${check.expected_value == null ? "verifier-ocr-check-value-pair--single" : ""
                                      }`}
                                  >
                                    <div className="verifier-ocr-check-value-col">
                                      <div className="verifier-ocr-check-value-pair-label">
                                        {getValueColumnLabel(check.check_name)}
                                      </div>
                                      <div
                                        className={`verifier-ocr-check-value-pair-value ${!check.passed ? "verifier-ocr-check-value-pair-value-mismatch" : ""
                                          }`}
                                      >
                                        {check.extracted_value || "not extracted"}
                                      </div>
                                    </div>

                                    {check.expected_value != null && (
                                      <div className="verifier-ocr-check-value-col">
                                        <div className="verifier-ocr-check-value-pair-label">
                                          EXPECTED VALUE
                                        </div>
                                        <div className="verifier-ocr-check-value-pair-value">
                                          {check.expected_value}
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                  {check.passed ? (
                                    <div className="verifier-ocr-check-reason-row">
                                      <span className="verifier-ocr-check-reason-value-pass">
                                        {getPassedCheckMessage(check.check_name)}
                                      </span>
                                    </div>
                                  ) : (() => {
                                    const translated = translateFlagReason(check.check_name, check.flag_reason);
                                    const showTechnical =
                                      check.flag_reason && check.flag_reason !== translated;
                                    return (
                                      <div className="verifier-ocr-check-reason-row verifier-ocr-check-reason-row-stacked">
                                        <div>
                                          <span className="verifier-ocr-check-reason-label">
                                            Flag Reason:
                                          </span>
                                          <span className="verifier-ocr-check-reason-value-fail">
                                            <span className="verifier-ocr-check-reason-icon">!</span>
                                            {translated}
                                          </span>
                                        </div>
                                        {showTechnical && (
                                          <div className="verifier-ocr-check-reason-technical">
                                            Technical detail: {check.flag_reason}
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })()}
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="verifier-ocr-empty">
                              {relatedChecks.length === 0 ? (
                                doc.status === "failed" ? (
                                  <div className="verifier-ocr-empty-content">
                                    <span className="text-danger">
                                      OCR processing failed for this
                                      document. Try refreshing, or ask the
                                      applicant to re-upload.
                                    </span>

                                    <button
                                      type="button"
                                      className="verifier-ocr-file-btn mt-2"
                                      onClick={() => handleRetryOcr(doc.id)}
                                      disabled={refreshingOcr}
                                    >
                                      {refreshingOcr
                                        ? "Retrying..."
                                        : "Retry OCR Check"}
                                    </button>
                                  </div>
                                ) : doc.needs_auto_reupload ? (
                                  <div className="verifier-ocr-empty-content">
                                    <span className="verifier-ocr-check-reason-label">
                                      Message sent to applicant:
                                    </span>
                                    <span className="text-danger">
                                      <span className="verifier-ocr-check-reason-icon">!</span>{" "}
                                      {doc.auto_reupload_reason ||
                                        "System flagged this document for re-upload."}
                                    </span>
                                    {doc.auto_reupload_category && (
                                      <code className="verifier-ocr-check-code verifier-ocr-check-code-failed mt-1">
                                        {doc.auto_reupload_category}
                                      </code>
                                    )}

                                    {/* Panel/demo use only -- re-runs the
                                        already-stored file through the OCR
                                        service with debug=true so the full
                                        eligibility checks can be shown even
                                        though this upload gate already
                                        auto-rejected it. Does not touch the
                                        document's real saved status. */}
                                    <button
                                      type="button"
                                      className="verifier-ocr-file-btn mt-2"
                                      onClick={() => handlePreviewDebugChecks(doc.id)}
                                      disabled={debugPreviews[doc.id]?.loading}
                                    >
                                      {debugPreviews[doc.id]?.loading
                                        ? "Loading full checks..."
                                        : "Preview Full Checks (Debug)"}
                                    </button>

                                    {debugPreviews[doc.id]?.error && (
                                      <div className="text-danger mt-1">
                                        {debugPreviews[doc.id].error}
                                      </div>
                                    )}

                                    {debugPreviews[doc.id]?.checks && (
                                      <div className="mt-2" style={{ width: "100%" }}>
                                        {(() => {
                                          // would_auto_reupload includes EVERY gate
                                          // that fired in debug mode, which always
                                          // includes the same one already shown above
                                          // as doc.auto_reupload_category -- only
                                          // surface gates beyond that one, otherwise
                                          // this just restates the primary reason as
                                          // if it were a separate finding.
                                          const extraGates = (
                                            debugPreviews[doc.id].wouldAutoReupload || []
                                          ).filter(
                                            (g) =>
                                              g.auto_reupload_category !==
                                              doc.auto_reupload_category
                                          );
                                          return (
                                            extraGates.length > 0 && (
                                              <div className="verifier-ocr-check-reason-technical mb-2">
                                                Would also trigger auto-reupload for:{" "}
                                                {extraGates
                                                  .map((g) => g.auto_reupload_category)
                                                  .join(", ")}
                                              </div>
                                            )
                                          );
                                        })()}
                                        {debugPreviews[doc.id].checks.length === 0 ? (
                                          <span>No eligibility checks were reached.</span>
                                        ) : (
                                          debugPreviews[doc.id].checks.map((check) => (
                                            <div
                                              className={`verifier-ocr-check-card ${check.passed
                                                ? "verifier-ocr-check-card-passed"
                                                : "verifier-ocr-check-card-failed"
                                                }`}
                                              style={{ padding: "10px 14px", marginBottom: "8px" }}
                                              key={check.check_name}
                                            >
                                              <div className="verifier-ocr-check-header">
                                                <div className="verifier-ocr-check-header-left">
                                                  <span className="verifier-ocr-check-name">
                                                    {getCheckRuleLabel(check.check_name)}
                                                  </span>
                                                  <code
                                                    className={`verifier-ocr-check-code ${check.passed
                                                      ? "verifier-ocr-check-code-passed"
                                                      : "verifier-ocr-check-code-failed"
                                                      }`}
                                                  >
                                                    {check.check_name}
                                                  </code>
                                                </div>
                                                <OcrBadge
                                                  passed={check.passed}
                                                  checkName={check.check_name}
                                                  extractedValue={check.extracted_value}
                                                />
                                              </div>
                                              <div
                                                className={`verifier-ocr-check-value-pair ${check.expected_value == null ? "verifier-ocr-check-value-pair--single" : ""
                                                  }`}
                                              >
                                                <div className="verifier-ocr-check-value-col">
                                                  <div className="verifier-ocr-check-value-pair-label">
                                                    {getValueColumnLabel(check.check_name)}
                                                  </div>
                                                  <div
                                                    className={`verifier-ocr-check-value-pair-value ${!check.passed ? "verifier-ocr-check-value-pair-value-mismatch" : ""
                                                      }`}
                                                  >
                                                    {check.extracted_value || "not extracted"}
                                                  </div>
                                                </div>
                                                {check.expected_value != null && (
                                                  <div className="verifier-ocr-check-value-col">
                                                    <div className="verifier-ocr-check-value-pair-label">
                                                      EXPECTED VALUE
                                                    </div>
                                                    <div className="verifier-ocr-check-value-pair-value">
                                                      {check.expected_value}
                                                    </div>
                                                  </div>
                                                )}
                                              </div>
                                              {check.passed ? (
                                                <div className="verifier-ocr-check-reason-row">
                                                  <span className="verifier-ocr-check-reason-value-pass">
                                                    {getPassedCheckMessage(check.check_name)}
                                                  </span>
                                                </div>
                                              ) : (
                                                <div className="verifier-ocr-check-reason-row">
                                                  <span className="verifier-ocr-check-reason-label">
                                                    Flag Reason:
                                                  </span>
                                                  <span className="verifier-ocr-check-reason-value-fail">
                                                    <span className="verifier-ocr-check-reason-icon">!</span>
                                                    {translateFlagReason(check.check_name, check.flag_reason)}
                                                  </span>
                                                </div>
                                              )}
                                            </div>
                                          ))
                                        )}
                                      </div>
                                    )}
                                  </div>
                                ) : [
                                  "processing",
                                  "pending",
                                  "pending_prescreening",
                                ].includes(app.status) ? (
                                  <div className="verifier-ocr-empty-content">
                                    <span
                                      className="spinner-border spinner-border-sm verifier-ocr-empty-spinner"
                                      role="status"
                                    />
                                    <span>
                                      System is extracting text via OCR and
                                      verifying rules. Try refreshing shortly.
                                    </span>
                                  </div>
                                ) : (
                                  <div className="verifier-ocr-empty-content">
                                    <span>
                                      No execution parameters run against
                                      this file configuration.
                                    </span>
                                  </div>
                                )
                              ) : checkpointFilter === "review" ? (
                                <div className="verifier-ocr-empty-content">
                                  <span>
                                    No review checkpoints for this document.
                                  </span>
                                </div>
                              ) : checkpointFilter === "passed" ? (
                                <div className="verifier-ocr-empty-content">
                                  <span>
                                    No passed checkpoints for this document.
                                  </span>
                                </div>
                              ) : (
                                <div className="verifier-ocr-empty-content">
                                  <span>
                                    No checkpoints available for this
                                    document.
                                  </span>
                                </div>
                              )}
                            </div>
                          )}

                          {activeRawDocId === doc.id &&
                            doc.ocr_result?.raw_text && (
                              <div className="bg-light border rounded p-3 mt-3 text-start verifier-ocr-raw">
                                <h6 className="small fw-bold mb-2 text-dark verifier-ocr-raw-title">
                                  PaddleOCR Text Output Stream:
                                </h6>

                                <pre
                                  className="mb-0 verifier-ocr-raw-text"
                                  style={{
                                    fontSize: "0.75rem",
                                    maxHeight: "200px",
                                    overflowY: "auto",
                                    whiteSpace: "pre-wrap",
                                  }}
                                >
                                  {(() => {
                                    try {
                                      const lines = JSON.parse(
                                        doc.ocr_result.raw_text
                                      );

                                      return lines
                                        .map(
                                          (l, i) =>
                                            `[Line ${i + 1} | Conf: ${(
                                              (l.confidence ?? 0) * 100
                                            ).toFixed(0)}%] ${l.text ?? ""}`
                                        )
                                        .join("\n");
                                    } catch {
                                      return doc.ocr_result.raw_text;
                                    }
                                  })()}
                                </pre>
                              </div>
                            )}
                        </div>
                      </div>

                      <details
                        className="verifier-ocr-flag-section verifier-ocr-review-flags"
                        open={openFlagDocId === doc.id}
                        onToggle={(e) => {
                          if (e.currentTarget.open) {
                            setOpenFlagDocId(doc.id);
                          } else if (openFlagDocId === doc.id) {
                            setOpenFlagDocId(null);
                          }
                        }}
                      >
                        <summary
                          className="text-danger fw-semibold verifier-ocr-flag-title"
                          style={{ cursor: "pointer" }}
                        >
                          Flag an issue with this document
                        </summary>

                        <div className="verifier-ocr-flag-options">
                          {docReasonGroups.primary.map((reason) => (
                            <div
                              className="form-check verifier-ocr-flag-option"
                              key={reason.id}
                            >
                              <input
                                className="form-check-input"
                                type="checkbox"
                                id={`flag-${tab.type}-${reason.id}`}
                                checked={flagState.reasons.includes(reason.id)}
                                onChange={() => toggleReason(tab.type, reason.id)}
                              />

                              <label
                                className="form-check-label small verifier-ocr-check-label"
                                htmlFor={`flag-${tab.type}-${reason.id}`}
                              >
                                {reason.verifierLabel}
                              </label>
                            </div>
                          ))}

                          {docReasonGroups.additional.length > 0 && (
                            <>
                              <div className="verifier-action-subsection-label">Additional reasons</div>
                              {docReasonGroups.additional.map((reason) => (
                                <div
                                  className="form-check verifier-ocr-flag-option"
                                  key={reason.id}
                                >
                                  <input
                                    className="form-check-input"
                                    type="checkbox"
                                    id={`flag-${tab.type}-${reason.id}`}
                                    checked={flagState.reasons.includes(reason.id)}
                                    onChange={() => toggleReason(tab.type, reason.id)}
                                  />

                                  <label
                                    className="form-check-label small verifier-ocr-check-label"
                                    htmlFor={`flag-${tab.type}-${reason.id}`}
                                  >
                                    {reason.verifierLabel}
                                  </label>
                                </div>
                              ))}
                            </>
                          )}

                          <div className="form-check verifier-ocr-flag-option">
                            <input
                              className="form-check-input"
                              type="checkbox"
                              id={`flag-${tab.type}-other`}
                              checked={flagState.reasons.includes(OTHER)}
                              onChange={() => toggleReason(tab.type, OTHER)}
                            />

                            <label
                              className="form-check-label small verifier-ocr-check-label"
                              htmlFor={`flag-${tab.type}-other`}
                            >
                              {OTHER}
                            </label>

                            {flagState.reasons.includes(OTHER) && (
                              <input
                                className="form-control form-control-sm verifier-ocr-other-input verifier-ocr-other-inline"
                                placeholder="Specify the issue..."
                                value={flagState.otherText}
                                onChange={(e) =>
                                  setOtherText(tab.type, e.target.value)
                                }
                              />
                            )}
                          </div>
                        </div>
                      </details>
                    </div>
                  );
                })}

                <div className="verifier-review-bottom-actions">
                  <div></div>

                  {[
                    "for_review",
                    "pending_prescreening",
                    "reupload_requested",
                    "appeal_requested",
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
                      <div className="spinner-border" role="status"></div>
                      <span>Refreshing OCR results...</span>
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
            onClick={() => setZoomPreview(null)}
          >
            <div
              className="verifier-preview-modal-content"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                className="verifier-preview-modal-close"
                onClick={() => setZoomPreview(null)}
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

        {otherViewer && (
          <div className="verifier-other-viewer-toast" role="status">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 8v4M12 16h.01" />
            </svg>
            <span><strong>{otherViewer.name}</strong> is also currently viewing this application.</span>
          </div>
        )}

        {showScrollTop && (
          <button
            type="button"
            className="verifier-scroll-top-btn"
            onClick={scrollToTop}
            aria-label="Back to top"
            title="Back to top"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M12 19V5" />
              <path d="m5 12 7-7 7 7" />
            </svg>
          </button>
        )}

        <PanelFooter />
      </div>
    </div>
  );
}

export default VerifierApplicationReview;