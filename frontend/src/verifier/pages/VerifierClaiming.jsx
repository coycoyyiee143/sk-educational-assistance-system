import { useState, useEffect, useRef, useCallback, Fragment } from "react";
import VerifierNavigation from "../components/VerifierNavigation";
import VerifierTopbar from "../components/VerifierTopbar";
import ClaimingFaceVerify from "../components/ClaimingFaceVerify";
import PanelFooter from "../../components/PanelFooter";
import api from "../../services/api";
import { usePolling } from "../../hooks/usePolling";
import {
  DOC_TYPES,
  NOT_CLEARED_REASONS,
  OTHER,
} from "../constants/verificationReasons";
import { STATUS_CONFIG } from "../../components/StatusConstants";

const CLAIMED_QUICK_NOTES = [
  "Claiming completed.",
  "Documents verified.",
  "Requirements completed.",
];

const NOT_CLEARED_QUICK_NOTES = [
  "Document issue found.",
  "Documents did not match.",
  "Requirements incomplete.",
];

// Claiming is finalized for these — nothing left for a verifier to do but
// look back at what happened, so they get a visual break from the
// actionable queue above them and a "View" instead of "Select".
const RESOLVED_CLAIM_STATUSES = ["claimed", "not_cleared", "unclaimed"];

function ClaimStatusBadge({ status }) {
  const config = STATUS_CONFIG[status];

  if (!config) {
    return (
      <span className="status-badge status-pending">
        Pending
      </span>
    );
  }

  return (
    <span className={`status-badge ${config.badgeClass}`}>
      {config.verifierLabel}
    </span>
  );
}

function todayStr() {
  const d = new Date();

  return `${d.getFullYear()}-${String(
    d.getMonth() + 1
  ).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function daysBetween(a, b) {
  return Math.round(
    (new Date(b) - new Date(a)) / 86400000
  );
}

function formatDateDisplay(dateStr) {
  if (!dateStr) return "";

  return new Date(`${dateStr}T00:00:00`).toLocaleDateString(
    "en-US",
    {
      month: "short",
      day: "numeric",
      year: "numeric",
    }
  );
}

function VerifierClaiming() {
  const [controlNo, setControlNo] = useState("");
  const [applicantName, setApplicantName] = useState("");
  const [results, setResults] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [selected, setSelected] = useState(null);

  const [docStatus, setDocStatusState] = useState(
    DOC_TYPES.reduce(
      (acc, d) => ({
        ...acc,
        [d.key]: "unreviewed",
      }),
      {}
    )
  );

  const [notes, setNotes] = useState("");
  const [selectedAction, setSelectedAction] = useState(null);
  const [notClearedReasons, setNotClearedReasons] = useState([]);
  const [notClearedOtherText, setNotClearedOtherText] = useState("");
  const [searching, setSearching] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [claimError, setClaimError] = useState("");
  const [claimSuccess, setClaimSuccess] = useState("");
  const [claimingFeedback, setClaimingFeedback] = useState(null);
  const [feedbackCountdown, setFeedbackCountdown] = useState(5);
  const [filePreview, setFilePreview] = useState(null);
  const [fileError, setFileError] = useState("");

  const claimingActionRef = useRef(null);

  const [registrationPhotoUrl, setRegistrationPhotoUrl] =
    useState(null);

  const [
    registrationPhotoStatus,
    setRegistrationPhotoStatus,
  ] = useState("idle");

  const [assignedLane, setAssignedLane] = useState(null);
  // Full set of lanes this verifier holds — kept separately from
  // `assignedLane` (which is just the first of these) because a verifier
  // can legitimately be assigned to more than one lane at once (a
  // morning lane AND a separate afternoon lane on the same day). Used to
  // correctly tell "a lane I already have" apart from "someone else's
  // lane" instead of only ever recognizing the single `assignedLane`.
  const [assignedLanes, setAssignedLanes] = useState([]);
  const [allLanes, setAllLanes] = useState([]);

  const [lateClaimingDates, setLateClaimingDates] = useState({
    start: null,
    end: null,
  });

  const [selectedLaneId, setSelectedLaneId] = useState("");
  // Purely a client-side narrowing filter for the lane dropdown below
  // ("date|batch", or "" for every session) — never sent to the backend
  // itself, since the actual search filter is still selectedLaneId.
  const [sessionFilter, setSessionFilter] = useState("");
  const [lateClaimingMode, setLateClaimingMode] = useState(false);
  const [assigningLane, setAssigningLane] = useState(false);
  const [laneRequestMessage, setLaneRequestMessage] = useState("");
  const [pendingRequestLaneId, setPendingRequestLaneId] = useState(null);
  // Surfaces the outcome of a request once an admin acts on it — approval
  // is inferred from the lane showing up in assigned_lanes, rejection from
  // requested_verifier_id going back to null WITHOUT that happening. Without
  // this, the "waiting for an admin" message under pendingRequestLaneId had
  // no way to ever clear itself once dismissed, since nothing polling the
  // lane list was reconciling that piece of state against the fresh data.
  const [laneRequestOutcome, setLaneRequestOutcome] = useState(null);
  const [lanesLoaded, setLanesLoaded] = useState(false);
  const [lanesError, setLanesError] = useState(false);
  // Set to { laneId, targetLane, conflictLane } while the "switch lane" /
  // "add lane" confirmation modal is open. `conflictLane` is the lane
  // this would vacate (same claiming_date + batch as targetLane), or
  // null if this is a genuinely separate/additional lane.
  const [laneConfirm, setLaneConfirm] = useState(null);

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const modeManuallySetRef = useRef(false);

  const perPage = 10;

  const todaysLanes = allLanes.filter(
    (lane) => lane.claiming_date === todayStr()
  );

  // Every distinct claiming_date + batch session across the schedule
  // (e.g. "Sep 21 — Morning", "Sep 21 — Afternoon", "Sep 22 — Morning"...).
  // With schedules running multiple days at 10+ lanes per session, listing
  // every lane flat would mean 40+ options to scan through — picking a
  // session first narrows the lane dropdown down to just that session's
  // handful of lanes.
  const BATCH_ORDER = { morning: 0, afternoon: 1 };
  const sessionOptions = [
    ...new Map(
      allLanes.map((lane) => [
        `${lane.claiming_date}|${lane.batch}`,
        { key: `${lane.claiming_date}|${lane.batch}`, date: lane.claiming_date, batch: lane.batch },
      ])
    ).values(),
  ].sort((a, b) =>
    a.date === b.date
      ? BATCH_ORDER[a.batch] - BATCH_ORDER[b.batch]
      : a.date.localeCompare(b.date)
  );

  const laneDropdownOptions = sessionFilter
    ? allLanes.filter((lane) => `${lane.claiming_date}|${lane.batch}` === sessionFilter)
    : allLanes;

  // Lookup of every lane this verifier already holds — used instead of
  // comparing against the single `assignedLane` so a second lane held in
  // a different session (e.g. an afternoon lane alongside a morning one)
  // is correctly recognized as "mine" rather than "another verifier's".
  const myLaneIds = new Set(assignedLanes.map((lane) => String(lane.id)));

  // The lane search results actually reflect — driven by the dropdown
  // (selectedLaneId), NOT by assignedLane. Those two can differ (a
  // verifier can browse a lane that isn't theirs), and conflating them
  // used to show a "Currently viewing: <assigned lane>" line that had
  // nothing to do with what was actually in the results table below —
  // exactly the mix-up that caused a verifier to act on the wrong
  // lane's applicant without noticing.
  const viewingLane = selectedLaneId
    ? allLanes.find((lane) => String(lane.id) === selectedLaneId)
    : null;

  // Read via ref rather than the pendingRequestLaneId state directly —
  // reconcileLaneRequest is called from silentRefreshLanes, which is a
  // useCallback memoized on [selected, submitting] and so does NOT get
  // recreated when a request is sent; reading the state variable through
  // that stale closure would keep seeing pendingRequestLaneId as it was
  // when silentRefreshLanes was last recreated, not the current value.
  const pendingRequestLaneIdRef = useRef(null);
  useEffect(() => {
    pendingRequestLaneIdRef.current = pendingRequestLaneId;
  }, [pendingRequestLaneId]);

  // Timestamp of the last request sent, so reconcileLaneRequest can ignore
  // a background poll response for a few seconds after — the 15s poll can
  // have a GET already in flight when a request is submitted, and if that
  // stale response (fetched before the request existed) lands afterward,
  // it looks identical to "an admin already dismissed it": no
  // requested_verifier_id, lane not in assigned_lanes. Without this guard
  // that race cleared pendingRequestLaneId and fired a false "declined"
  // message within moments of every request.
  const pendingRequestSentAtRef = useRef(0);

  // Compares fresh lane data against whatever request this verifier is
  // still waiting on and, if an admin has since acted on it, clears the
  // pending state and surfaces what happened — approved (now in
  // assigned_lanes) or rejected (requested_verifier_id was cleared without
  // that happening). Called from both the initial load and the silent
  // background poll so the outcome shows up without a manual refresh.
  function reconcileLaneRequest(fetchedAllLanes, fetchedAssignedLanes) {
    const currentPendingId = pendingRequestLaneIdRef.current;
    if (!currentPendingId) return;
    if (Date.now() - pendingRequestSentAtRef.current < 5000) return;

    const lane = (fetchedAllLanes ?? []).find(
      (l) => String(l.id) === String(currentPendingId)
    );
    if (!lane || lane.requested_verifier_id) return;

    const approved = (fetchedAssignedLanes ?? []).some(
      (l) => String(l.id) === String(currentPendingId)
    );
    setPendingRequestLaneId(null);
    setLaneRequestOutcome({
      status: approved ? "approved" : "rejected",
      laneName: lane.lane_name,
    });
  }

  function fetchLanes() {
    setLanesError(false);

    api
      .get("/verifier/claiming/lanes")
      .then((res) => {
        setAssignedLane(res.data.assigned_lane ?? null);
        setAssignedLanes(res.data.assigned_lanes ?? []);
        setAllLanes(res.data.all_lanes ?? []);
        reconcileLaneRequest(res.data.all_lanes, res.data.assigned_lanes);

        if (res.data.assigned_lane) {
          setSelectedLaneId(
            String(res.data.assigned_lane.id)
          );
        }

        setLateClaimingDates({
          start: res.data.late_claiming_date ?? null,
          end: res.data.late_claiming_end_date ?? null,
        });

        if (!modeManuallySetRef.current) {
          const today = todayStr();
          const lateClaimingStart = res.data.late_claiming_date;
          const lateClaimingEnd = res.data.late_claiming_end_date;

          const isLateClaimingNow =
            lateClaimingStart &&
            lateClaimingEnd &&
            today >= lateClaimingStart &&
            today <= lateClaimingEnd;

          setLateClaimingMode(isLateClaimingNow);
        }

        setLanesLoaded(true);
      })
      .catch(() => {
        setLanesError(true);
        setLanesLoaded(true);
      });
  }

  useEffect(() => {
    fetchLanes();
  }, []);

  useEffect(() => {
    if (!lanesLoaded) return;

    if (lateClaimingMode) {
      handleSearch({
        preventDefault: () => { },
      });
    } else if (assignedLane) {
      handleSearch({
        preventDefault: () => { },
      });
    }

    // Keyed on the lane's id rather than the `assignedLane` object itself —
    // the background lane refresh below fetches a fresh object on every
    // tick even when nothing actually changed, and re-running a "loud"
    // handleSearch() (which resets selected/errors and flashes the
    // Search button) on every one of those ticks would be exactly the
    // disruption the silent poll below is trying to avoid.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lanesLoaded, lateClaimingMode, assignedLane?.id]);

  useEffect(() => {
    if (!fileError) return;
    const t = setTimeout(() => setFileError(""), 6000);
    return () => clearTimeout(t);
  }, [fileError]);

  useEffect(() => {
    if (!laneRequestOutcome) return;
    const t = setTimeout(() => setLaneRequestOutcome(null), 8000);
    return () => clearTimeout(t);
  }, [laneRequestOutcome]);

  // Silent background refresh — applicants get assigned to lanes in
  // real time as verifiers elsewhere approve applications (see
  // ClaimingAssignmentService), so the list here can go stale within
  // seconds of the page being opened. This re-runs the same search
  // every 10s WITHOUT going through handleSearch(), which would reset
  // selected/searchError/claimError/claimSuccess and flash the
  // Search/Refresh button text — none of which should happen from a
  // background tick the verifier didn't ask for.
  //
  // Deliberately skipped entirely whenever an applicant is selected or
  // a claim action is mid-submit: silently swapping `results` out from
  // under an open detail view, or racing a real submission, would be
  // far worse than a few seconds of staleness.
  const silentRefreshResults = useCallback(async () => {
    if (selected || submitting) return;

    const params = {};
    if (lateClaimingMode) {
      params.late_claiming = 1;
      if (controlNo.trim()) params.control_number = controlNo.trim();
      if (applicantName.trim()) params.name = applicantName.trim();
    } else {
      if (!selectedLaneId && !controlNo.trim() && !applicantName.trim()) return;
      if (selectedLaneId) params.lane_id = selectedLaneId;
      if (controlNo.trim()) params.control_number = controlNo.trim();
      if (applicantName.trim()) params.name = applicantName.trim();
    }

    try {
      const res = await api.get("/verifier/claiming/search", { params });
      // Guard again after the request resolves — the verifier may have
      // selected someone or started submitting while this was in flight.
      if (!selected && !submitting) setResults(res.data);
    } catch {
      // Silent poll — a dropped tick isn't worth surfacing an error
      // over. If the list is genuinely empty now (e.g. everyone on it
      // just got claimed), a 404 here would otherwise wipe `results`
      // via the same path handleSearch() uses; skip that for silent
      // ticks and just let the next tick (or a manual Refresh) sort it
      // out.
    }
  }, [selected, submitting, lateClaimingMode, selectedLaneId, controlNo, applicantName]);

  // Was a raw setInterval with no visibility pause or overlap guard —
  // usePolling adds both. All the existing skip logic (selected/
  // submitting mid-action, awaiting lanesLoaded) is preserved as-is
  // inside silentRefreshResults above; only the timer mechanics moved.
  usePolling(silentRefreshResults, {
    intervalMs: 10000,
    enabled: lanesLoaded,
  });

  // Silent background refresh for the lane/schedule data itself — an
  // admin can change lane times/dates or approve a lane-change request
  // while a verifier is already on this page, and until now none of
  // that reflected here without a manual page reload. Mirrors
  // silentRefreshResults above: skipped whenever an applicant is
  // selected or a claim is mid-submit, and deliberately leaves
  // selectedLaneId/lateClaimingMode/lanesError alone so it never
  // clobbers a lane the verifier is actively browsing or a mode they
  // manually switched to.
  const silentRefreshLanes = useCallback(async () => {
    if (selected || submitting) return;

    try {
      const res = await api.get("/verifier/claiming/lanes");
      setAssignedLane(res.data.assigned_lane ?? null);
      setAssignedLanes(res.data.assigned_lanes ?? []);
      setAllLanes(res.data.all_lanes ?? []);
      reconcileLaneRequest(res.data.all_lanes, res.data.assigned_lanes);
      setLateClaimingDates({
        start: res.data.late_claiming_date ?? null,
        end: res.data.late_claiming_end_date ?? null,
      });
    } catch {
      // Silent poll — a dropped tick isn't worth surfacing an error over.
    }
  }, [selected, submitting]);

  usePolling(silentRefreshLanes, {
    intervalMs: 15000,
    enabled: lanesLoaded,
  });

  // Revoke any lingering photo blob URL if the verifier navigates away
  // from this page entirely, so it doesn't leak.
  useEffect(() => {
    return () => {
      if (registrationPhotoUrl) {
        URL.revokeObjectURL(registrationPhotoUrl);
      }
    };

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!claimingFeedback) return;

    setFeedbackCountdown(5);

    const countdown = setInterval(() => {
      setFeedbackCountdown((prev) =>
        Math.max(prev - 1, 0)
      );
    }, 1000);

    const autoClose = setTimeout(() => {
      setClaimingFeedback(null);
    }, 5000);

    return () => {
      clearInterval(countdown);
      clearTimeout(autoClose);
    };
  }, [claimingFeedback]);

  function setDocStatus(key, status) {
    setDocStatusState((prev) => ({
      ...prev,
      [key]: status,
    }));
  }

  function toggleNotClearedReason(reason) {
    setNotClearedReasons((prev) =>
      prev.includes(reason)
        ? prev.filter((r) => r !== reason)
        : [...prev, reason]
    );
  }

  function switchToScheduledMode() {
    modeManuallySetRef.current = true;

    setLateClaimingMode(false);
    setResults([]);
    setCurrentPage(1);
    setSelected(null);
    setSearchError("");
    setClaimError("");
    setClaimSuccess("");

    if (assignedLane) {
      setSelectedLaneId(
        String(assignedLane.id)
      );
    }
  }

  function switchToLateClaimingMode() {
    modeManuallySetRef.current = true;

    setLateClaimingMode(true);
    setResults([]);
    setCurrentPage(1);
    setSelected(null);
    setSelectedLaneId("");
    setSearchError("");
    setClaimError("");
    setClaimSuccess("");
  }

  async function handleRequestLane(laneId) {
    setAssigningLane(true);
    setSearchError("");
    setLaneRequestMessage("");

    try {
      const res = await api.post(
        `/verifier/claiming/lanes/${laneId}/self-assign`
      );
      const updatedLane = res.data.lane;

      // Merge the updated lane in locally instead of calling fetchLanes()
      // — that was a real bug: a pending REQUEST (lane already staffed)
      // doesn't change assigned_lane at all, so fetchLanes()'s own
      // "sync selectedLaneId to assigned_lane" effect immediately reset
      // selectedLaneId back to the verifier's actual current lane,
      // hiding the "request sent" message moments after it appeared —
      // it only renders while selectedLaneId differs from assignedLane.
      setAllLanes((prev) =>
        prev.map((l) => {
          if (String(l.id) === String(laneId)) return { ...l, ...updatedLane };

          // Backend vacates any other lane this verifier held in the same
          // claiming_date + batch session before assigning them here (see
          // selfAssignLane()) — mirror that locally so the dropdown and
          // assignedLanes stay accurate without a full refetch.
          if (
            !updatedLane?.requested_verifier_id &&
            l.verifier_id === updatedLane?.verifier_id &&
            l.claiming_date === updatedLane?.claiming_date &&
            l.batch === updatedLane?.batch
          ) {
            return { ...l, verifier_id: null };
          }

          return l;
        })
      );
      if (!updatedLane?.requested_verifier_id) {
        // Lane was empty, so this was an immediate assignment, not just
        // a request — assignedLane genuinely changed.
        setAssignedLane(updatedLane);
        setAssignedLanes((prev) => {
          const sameSessionVacated = prev.filter(
            (l) =>
              String(l.id) === String(laneId) ||
              l.claiming_date !== updatedLane.claiming_date ||
              l.batch !== updatedLane.batch
          );
          return [
            ...sameSessionVacated.filter((l) => String(l.id) !== String(laneId)),
            updatedLane,
          ];
        });
      }

      setSelectedLaneId(String(laneId));
      setLaneRequestMessage(res.data.message);
      // The lane was empty, so the backend assigned it immediately instead
      // of just recording a request — nothing left pending on it.
      if (updatedLane?.requested_verifier_id) {
        pendingRequestSentAtRef.current = Date.now();
        setPendingRequestLaneId(String(laneId));
      } else {
        setPendingRequestLaneId(null);
      }
    } catch (err) {
      setSearchError(
        err.response?.data?.message ||
        "Failed to request lane."
      );
    } finally {
      setAssigningLane(false);
    }
  }

  // Narrowing the session dropdown can leave selectedLaneId pointing at a
  // lane that's no longer one of the options the lane dropdown is
  // showing — clear it in that case rather than leaving a mismatched
  // value the <select> can't actually display.
  function handleSessionFilterChange(newSession) {
    setSessionFilter(newSession);

    if (!selectedLaneId || !newSession) return;

    const currentLane = allLanes.find((l) => String(l.id) === selectedLaneId);
    const currentSessionKey = currentLane ? `${currentLane.claiming_date}|${currentLane.batch}` : null;

    if (currentSessionKey !== newSession) {
      setSelectedLaneId("");
    }
  }

  // Runs the search immediately with the newly picked lane instead of
  // waiting for a separate "Search" click — picking a lane from a filter
  // control reads as applying that filter right away, and previously it
  // silently did nothing until the verifier either hit Search or
  // reloaded the page.
  function handleLaneSelectChange(newLaneId) {
    setSelectedLaneId(newLaneId);
    handleSearch({ preventDefault: () => {} }, { laneId: newLaneId });
  }

  // Clears just the text filters (control number / name) and re-runs the
  // search immediately against whatever lane is still selected — mirrors
  // the lane picker's "apply right away" behavior rather than leaving
  // stale results up until the verifier hits Search again. Skips
  // re-running it when there's nothing left to search by (no lane, not
  // in Late Claiming), so clearing doesn't immediately throw the "select
  // a lane or enter something" validation error back in the verifier's
  // face.
  function handleClearSearch() {
    setControlNo("");
    setApplicantName("");

    if (lateClaimingMode || selectedLaneId) {
      handleSearch({ preventDefault: () => {} }, { controlNo: "", applicantName: "" });
    } else {
      setSearchError("");
      setResults([]);
    }
  }

  // Opens the switch/add confirmation modal instead of requesting the
  // lane immediately — self-assigning a lane in a session (claiming_date
  // + batch) the verifier already holds a lane in SWITCHES them onto the
  // new one (see selfAssignLane() vacating the old one), which used to
  // happen with no warning at all. A lane in a different session is a
  // harmless addition instead, so that gets a lighter confirmation.
  function openLaneConfirm(laneId) {
    const targetLane = allLanes.find((l) => String(l.id) === String(laneId));
    if (!targetLane) return;

    const conflictLane = assignedLanes.find(
      (l) =>
        String(l.id) !== String(laneId) &&
        l.claiming_date === targetLane.claiming_date &&
        l.batch === targetLane.batch
    );

    setLaneConfirm({ laneId, targetLane, conflictLane: conflictLane ?? null });
  }

  function confirmLaneRequest() {
    if (!laneConfirm) return;
    const { laneId } = laneConfirm;
    setLaneConfirm(null);
    handleRequestLane(laneId);
  }

  // `overrides` lets a filter control (lane picker, Clear button) run the
  // search immediately with a value that hasn't landed in state yet —
  // setSelectedLaneId/setControlNo/etc. are async, so reading straight
  // from closure state on the very next line would still see the old
  // value.
  async function handleSearch(e, overrides = {}) {
    e.preventDefault();

    const effectiveLaneId = overrides.laneId ?? selectedLaneId;
    const effectiveControlNo = overrides.controlNo ?? controlNo;
    const effectiveApplicantName = overrides.applicantName ?? applicantName;

    setSearchError("");
    setClaimError("");
    setClaimSuccess("");
    setSelected(null);

    // No longer blocks a fully-empty search: "All Lanes" (effectiveLaneId
    // === "") is now a deliberate, selectable option meaning "show every
    // applicant across every lane", not an accidental blank submit — this
    // guard used to reject exactly that case with a "select a lane"
    // error, so choosing All Lanes with no text filled in silently never
    // reached the backend at all. Late Claiming has always allowed this
    // same fully-open query; Scheduled Claiming now matches it.
    setSearching(true);

    try {
      const params = {};

      if (lateClaimingMode) {
        params.late_claiming = 1;

        if (effectiveControlNo.trim()) {
          params.control_number = effectiveControlNo.trim();
        }

        if (effectiveApplicantName.trim()) {
          params.name = effectiveApplicantName.trim();
        }
      } else {
        if (effectiveLaneId) {
          params.lane_id = effectiveLaneId;
        }

        if (effectiveControlNo.trim()) {
          params.control_number = effectiveControlNo.trim();
        }

        if (effectiveApplicantName.trim()) {
          params.name = effectiveApplicantName.trim();
        }
      }

      const res = await api.get(
        "/verifier/claiming/search",
        {
          params,
        }
      );

      setResults(res.data);
      setCurrentPage(1);
    } catch (err) {
      setResults([]);
      setCurrentPage(1);

      setSearchError(
        err.response?.data?.message ||
        "No matching approved applicant found."
      );
    } finally {
      setSearching(false);
    }
  }

  function selectApplicant(app) {
    setSelected(app);

    // For an already-resolved assignment, reflect what was actually
    // recorded at claim time instead of always showing "Not Reviewed" —
    // verified_documents only ever lists the docs that were matched (see
    // VerifierController::updateClaimStatus), so anything not in that
    // list is left as unreviewed rather than guessed at as "issue".
    const verifiedDocuments =
      app?.claiming_assignment?.verified_documents || [];

    setDocStatusState(
      DOC_TYPES.reduce(
        (acc, d) => ({
          ...acc,
          [d.key]: verifiedDocuments.includes(d.key)
            ? "matched"
            : "unreviewed",
        }),
        {}
      )
    );

    setNotes("");
    setSelectedAction(null);
    setNotClearedReasons([]);
    setNotClearedOtherText("");
    setClaimError("");
    setClaimSuccess("");

    setRegistrationPhotoUrl((prev) => {
      if (prev) {
        URL.revokeObjectURL(prev);
      }

      return null;
    });

    setRegistrationPhotoStatus("loading");

    api
      .get(
        `/claiming/applications/${app.id}/registration-photo`,
        {
          responseType: "blob",
        }
      )
      .then((res) => {
        setRegistrationPhotoUrl(
          URL.createObjectURL(res.data)
        );

        setRegistrationPhotoStatus("ready");
      })
      .catch(() =>
        setRegistrationPhotoStatus("none")
      );
  }

  function chooseAction(action) {
    setSelectedAction(action);
    setClaimError("");

    if (
      action === "not_cleared" &&
      issueDocs.length > 0
    ) {
      setNotClearedReasons([
        "Physical documents did not match submitted application.",
      ]);
    } else if (action !== "not_cleared") {
      setNotClearedReasons([]);
      setNotClearedOtherText("");
    }
  }

  function closeClaimingActionModal() {
    if (submitting) return;

    setSelectedAction(null);
    setClaimError("");
  }

  async function handleConfirm() {
    if (!selected || !selectedAction) return;

    setClaimError("");
    setClaimSuccess("");

    if (
      selectedAction === "claimed" &&
      (unreviewedCount > 0 || issueDocs.length > 0)
    ) {
      setClaimError(
        "All documents must be marked as Matched before this applicant can be marked Claimed. Resolve or re-check any flagged documents first."
      );

      return;
    }

    let reasonCategories;

    if (selectedAction === "not_cleared") {
      const withoutOther =
        notClearedReasons.filter(
          (r) => r !== OTHER
        );

      reasonCategories =
        notClearedReasons.includes(OTHER) &&
          notClearedOtherText.trim()
          ? [
            ...withoutOther,
            notClearedOtherText.trim(),
          ]
          : withoutOther;

      if (reasonCategories.length === 0) {
        setClaimError(
          "Please select at least one reason for marking this applicant as Not Cleared."
        );

        return;
      }
    }

    setSubmitting(true);

    try {
      const res = await api.post(
        `/verifier/claiming/${selected.id}/status`,
        {
          claim_status: selectedAction,

          reason_categories:
            selectedAction === "not_cleared"
              ? reasonCategories
              : undefined,

          verified_documents: matchedDocs,

          notes:
            notes ||
            (selectedAction === "not_cleared"
              ? reasonCategories.join(" ")
              : undefined),
        }
      );

      const completedAction = selectedAction;

      setClaimSuccess(res.data.message);
      setSelectedAction(null);

      setClaimingFeedback({
        type: completedAction,

        title:
          completedAction === "claimed"
            ? "Applicant Marked as Claimed"
            : "Applicant Marked as Not Cleared",

        message:
          res.data.message ||
          (completedAction === "claimed"
            ? "The applicant has been successfully marked as Claimed."
            : "The applicant has been successfully marked as Not Cleared."),
      });

      setSelected(null);
      setControlNo("");
      setApplicantName("");

      handleSearch({
        preventDefault: () => { },
      });
    } catch (err) {
      setClaimError(
        err.response?.data?.message ||
        "Failed to update claiming status."
      );

      setTimeout(() => {
        // "nearest" instead of "center" — centering can overscroll far
        // enough to push the face-verification panel above this ref up
        // behind the sticky navbar; nearest only scrolls the minimum
        // needed to bring the error into view.
        claimingActionRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "nearest",
        });
      }, 0);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleViewFile(docId, fileName) {
    try {
      const res = await api.get(
        `/applications/${selected.id}/documents/${docId}/file`,
        {
          responseType: "blob",
        }
      );

      const url = URL.createObjectURL(res.data);

      setFilePreview({
        url,
        type: res.data.type || "",
        label:
          fileName ||
          "Document Preview",
      });
    } catch {
      setFileError("Failed to load document.");
    }
  }

  function closeFilePreview() {
    setFilePreview((prev) => {
      if (prev?.url) {
        URL.revokeObjectURL(prev.url);
      }

      return null;
    });
  }

  function goToPage(page) {
    if (
      page < 1 ||
      page > totalPages
    ) {
      return;
    }

    setCurrentPage(page);
  }

  function getPageNumbers() {
    const pages = [];
    const maxVisible = 5;

    if (
      totalPages <= maxVisible
    ) {
      for (
        let i = 1;
        i <= totalPages;
        i++
      ) {
        pages.push(i);
      }

      return pages;
    }

    pages.push(1);

    if (currentPage > 3) {
      pages.push("...");
    }

    const start = Math.max(
      2,
      currentPage - 1
    );

    const end = Math.min(
      totalPages - 1,
      currentPage + 1
    );

    for (
      let i = start;
      i <= end;
      i++
    ) {
      pages.push(i);
    }

    if (
      currentPage <
      totalPages - 2
    ) {
      pages.push("...");
    }

    pages.push(totalPages);

    return pages;
  }

  const filteredDocs =
    selected?.documents?.filter(
      (d) =>
        d.status === "processed" ||
        d.status === "failed"
    ) || [];

  const matchedDocs = DOC_TYPES.filter(
    (d) =>
      docStatus[d.key] === "matched"
  ).map((d) => d.key);

  const issueDocs = DOC_TYPES.filter(
    (d) =>
      docStatus[d.key] === "issue"
  );

  const unreviewedCount = DOC_TYPES.filter(
    (d) =>
      docStatus[d.key] === "unreviewed"
  ).length;

  // A document flagged Issue Found means it does NOT match the physical
  // copy — that's disqualifying on its own, same as an undecided one.
  const claimedBlocked =
    unreviewedCount > 0 ||
    issueDocs.length > 0;

  const isResolved = RESOLVED_CLAIM_STATUSES.includes(
    selected?.claiming_assignment?.claim_status
  );

  const sortedResults = [...results].sort(
    (a, b) => {
      const aPending =
        a.claiming_assignment?.claim_status ===
          "pending_claiming"
          ? 0
          : 1;

      const bPending =
        b.claiming_assignment?.claim_status ===
          "pending_claiming"
          ? 0
          : 1;

      return aPending - bPending;
    }
  );

  // Where the "already actioned" group starts in the full sorted list —
  // used to drop a one-time divider row right before it, wherever that
  // falls once paginated. -1 (nobody resolved) or 0 (everybody resolved)
  // both correctly render no divider.
  const firstResolvedIndex = sortedResults.findIndex((r) =>
    RESOLVED_CLAIM_STATUSES.includes(r.claiming_assignment?.claim_status)
  );

  const totalPages = Math.max(
    1,
    Math.ceil(
      sortedResults.length / perPage
    )
  );

  const pageStart =
    (currentPage - 1) * perPage;

  const pagedResults =
    sortedResults.slice(
      pageStart,
      pageStart + perPage
    );

  const showResultsCard =
    lateClaimingMode ||
    searching ||
    results.length > 0 ||
    searchError;

  // Late Claiming walk-ins have no lane/schedule structure backing up who
  // they are, so identity comes first: Face Verification renders as Step
  // 1 and Document Verification as Step 2 there. Scheduled claiming has no
  // Face Verification step at all (see the docblock further down), so
  // Document Verification renders alone with no step badge and takes the
  // full width instead.
  const documentVerificationPanel = (
    <div
      className={`verifier-claiming-split-col verifier-claiming-verification-col ${lateClaimingMode
        ? "verifier-claiming-split-col-border"
        : ""
        }`}
    >
      <div className="verifier-claiming-step-heading">
        <h4 className="verifier-claiming-search-title">
          Document Verification
        </h4>

        {lateClaimingMode && (
          <span className="verifier-claiming-step-badge">
            Step 2
          </span>
        )}
      </div>

      {fileError && <div className="alert alert-danger">{fileError}</div>}

      {laneRequestOutcome && (
        <div
          className={`alert ${laneRequestOutcome.status === "approved" ? "alert-success" : "alert-danger"
            }`}
        >
          {laneRequestOutcome.status === "approved"
            ? `Your request for ${laneRequestOutcome.laneName} was approved — it's now your lane.`
            : `Your request for ${laneRequestOutcome.laneName} was declined by the admin.`}
        </div>
      )}

      <div className="verifier-waitlist-notice">
        <span className="verifier-waitlist-notice-icon">
          !
        </span>

        <div className="verifier-waitlist-notice-body">
          <p className="verifier-waitlist-notice-text">
            {lateClaimingMode
              ? "Confirm the physical documents match the approved record after identity has been verified."
              : "Confirm the physical documents match the approved record."}
          </p>
        </div>
      </div>

      <div className="verifier-claiming-doc-list">
        {DOC_TYPES.map(
          (doc) => {
            const uploadedDoc =
              filteredDocs.find(
                (d) =>
                  d.document_type ===
                  doc.key
              );

            const status =
              docStatus[
              doc.key
              ];

            return (
              <div
                className="verifier-claiming-doc-card"
                key={
                  doc.key
                }
              >
                <div className="verifier-claiming-doc-top">
                  <div className="verifier-claiming-doc-heading">
                    <span className="verifier-claiming-doc-icon">
                      <i
                        className={
                          doc.key ===
                            "registration_form"
                            ? "bi bi-file-earmark-text"
                            : doc.key ===
                              "school_id"
                              ? "bi bi-mortarboard"
                              : "bi bi-patch-check"
                        }
                      ></i>
                    </span>

                    <div className="verifier-claiming-doc-copy">
                      <h6>
                        {
                          doc.label
                        }
                      </h6>

                      {uploadedDoc ? (
                        <button
                          type="button"
                          className="verifier-claiming-doc-file"
                          onClick={() =>
                            handleViewFile(
                              uploadedDoc.id,
                              uploadedDoc.file_name
                            )
                          }
                        >
                          {
                            uploadedDoc.file_name
                          }
                        </button>
                      ) : (
                        <p>
                          No uploaded copy available.
                        </p>
                      )}
                    </div>
                  </div>

                  <span
                    className={`verifier-claiming-doc-status ${status ===
                      "matched"
                      ? "verifier-claiming-doc-status-matched"
                      : status ===
                        "issue"
                        ? "verifier-claiming-doc-status-issue"
                        : "verifier-claiming-doc-status-unreviewed"
                      }`}
                  >
                    {status ===
                      "matched"
                      ? "Matched"
                      : status ===
                        "issue"
                        ? "Issue Found"
                        : "Not Reviewed"}
                  </span>
                </div>

                <div className="verifier-claiming-doc-actions">
                  <button
                    type="button"
                    className={`verifier-claiming-doc-action verifier-claiming-doc-action-match ${status ===
                      "matched"
                      ? "verifier-claiming-doc-action-active-match"
                      : ""
                      }`}
                    onClick={() =>
                      setDocStatus(
                        doc.key,
                        "matched"
                      )
                    }
                  >
                    <i className="bi bi-check-lg"></i>
                    <span>
                      Matched
                    </span>
                  </button>

                  <button
                    type="button"
                    className={`verifier-claiming-doc-action verifier-claiming-doc-action-issue ${status ===
                      "issue"
                      ? "verifier-claiming-doc-action-active-issue"
                      : ""
                      }`}
                    onClick={() =>
                      setDocStatus(
                        doc.key,
                        "issue"
                      )
                    }
                  >
                    <i className="bi bi-exclamation-circle"></i>
                    <span>
                      Issue Found
                    </span>
                  </button>
                </div>
              </div>
            );
          }
        )}
      </div>

      <p className="verifier-claiming-step-note">
        Physical copies required for auditing
      </p>
    </div>
  );

  const faceVerificationPanel = lateClaimingMode && selected && (
    <div className="verifier-claiming-split-col verifier-claiming-verification-col">
      <div className="verifier-claiming-step-heading">
        <h4 className="verifier-claiming-mode-title">
          Face Verification
        </h4>

        <span className="verifier-claiming-step-badge">
          Step 1
        </span>
      </div>

      <div className="verifier-waitlist-notice">
        <span className="verifier-waitlist-notice-icon">
          !
        </span>

        <div className="verifier-waitlist-notice-body">
          <p className="verifier-waitlist-notice-text">
            Verify the applicant’s identity using the registered photo first.
          </p>
        </div>
      </div>

      <div className="verifier-claiming-face-panel">
        <ClaimingFaceVerify
          applicationId={
            selected?.id
          }
          required={
            lateClaimingMode
          }
          registrationPhotoUrl={
            registrationPhotoUrl
          }
          registrationPhotoStatus={
            registrationPhotoStatus
          }
        />
      </div>

      <p className="verifier-claiming-step-note">
        Confirm identity before reviewing documents
      </p>
    </div>
  );

  return (
    <div className="verifier-layout">
      <VerifierNavigation
        mobileOpen={mobileMenuOpen}
        onMobileClose={() =>
          setMobileMenuOpen(false)
        }
      />

      <div className="verifier-main">
        <VerifierTopbar
          onMenuOpen={() =>
            setMobileMenuOpen(true)
          }
        />

        <section className="page-section">
          <div className="container-fluid">
            <div className="verifier-dashboard-header">
              <div className="verifier-claiming-header-row">
                <div className="verifier-claiming-header-text">
                  <h3 className="verifier-dashboard-title">
                    Claiming Approved Application
                  </h3>

                  <p className="verifier-dashboard-desc">
                    Search approved applicants, verify their physical documents, and update their final claiming status.
                  </p>
                </div>

                {selected && (
                  <button
                    type="button"
                    className="verifier-claiming-header-back-btn"
                    onClick={() =>
                      setSelected(null)
                    }
                  >
                    Back to Claiming List
                  </button>
                )}
              </div>
            </div>

            {selected ? (
              <>
                <div className="page-card verifier-review-info-card">
                  <div className="verifier-review-info-header">
                    <div className="verifier-review-info-header-top">
                      <h4 className="verifier-review-info-title">
                        Applicant Details
                      </h4>
                    </div>
                  </div>

                  <div className="verifier-review-profile-area">
                    <div className="verifier-review-profile-main">
                      {registrationPhotoStatus ===
                        "ready" ? (
                        <img
                          src={
                            registrationPhotoUrl
                          }
                          alt="Applicant registered profile"
                          className="verifier-claiming-profile-photo"
                        />
                      ) : registrationPhotoStatus ===
                        "loading" ? (
                        <div className="verifier-review-profile-avatar">
                          <div
                            className="spinner-border spinner-border-sm"
                            role="status"
                          ></div>
                        </div>
                      ) : (
                        <div className="verifier-review-profile-avatar">
                          {selected.user?.first_name?.charAt(
                            0
                          )}
                          {selected.user?.last_name?.charAt(
                            0
                          )}
                        </div>
                      )}

                      <div className="verifier-review-profile-content">
                        <h5 className="verifier-review-profile-name">
                          {
                            selected.user
                              ?.first_name
                          }{" "}
                          {
                            selected.user
                              ?.last_name
                          }
                        </h5>
                      </div>
                    </div>
                  </div>

                  <div className="verifier-review-information-body">
                    <div className="verifier-review-information-column">
                      <p className="verifier-review-info-label">
                        APPLICATION DETAILS
                      </p>

                      <div className="verifier-review-details-grid verifier-review-details-grid-single">
                        <div className="verifier-review-detail-item">
                          <span className="verifier-review-detail-label">
                            Application ID
                          </span>

                          <span className="verifier-review-detail-value">
                            APP-{selected.id}
                          </span>
                        </div>

                        <div className="verifier-review-detail-item">
                          <span className="verifier-review-detail-label">
                            Control Number
                          </span>

                          <span className="verifier-review-detail-value">
                            {
                              selected.control_number
                            }
                          </span>
                        </div>

                        <div className="verifier-review-detail-item">
                          <span className="verifier-review-detail-label">
                            Applicant Name
                          </span>

                          <span className="verifier-review-detail-value">
                            {
                              selected.user
                                ?.first_name
                            }{" "}
                            {
                              selected.user
                                ?.last_name
                            }
                          </span>
                        </div>

                        <div className="verifier-review-detail-item">
                          <span className="verifier-review-detail-label">
                            School Name
                          </span>

                          <span className="verifier-review-detail-value">
                            {selected.school_name ??
                              "—"}
                          </span>
                        </div>

                        <div className="verifier-review-detail-item">
                          <span className="verifier-review-detail-label">
                            Course / Strand
                          </span>

                          <span className="verifier-review-detail-value">
                            {selected.course ??
                              "—"}
                          </span>
                        </div>

                        <div className="verifier-review-detail-item">
                          <span className="verifier-review-detail-label">
                            Year Level
                          </span>

                          <span className="verifier-review-detail-value">
                            {selected.year_level ??
                              "—"}
                          </span>
                        </div>

                        <div className="verifier-review-detail-item">
                          <span className="verifier-review-detail-label">
                            Student ID Number
                          </span>

                          <span className="verifier-review-detail-value">
                            {selected.student_id_number ??
                              "—"}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="verifier-review-information-divider"></div>

                    <div className="verifier-review-information-column">
                      <p className="verifier-review-info-label">
                        CLAIMING DETAILS
                      </p>

                      <div className="verifier-review-details-grid verifier-review-details-grid-single">
                        <div className="verifier-review-detail-item">
                          <span className="verifier-review-detail-label">
                            Claiming Date
                          </span>

                          <span className="verifier-review-detail-value">
                            {selected
                              .claiming_assignment
                              ?.lane
                              ?.claiming_date
                              ? formatDateDisplay(
                                selected
                                  .claiming_assignment
                                  .lane
                                  .claiming_date
                              )
                              : "—"}
                          </span>
                        </div>

                        <div className="verifier-review-detail-item">
                          <span className="verifier-review-detail-label">
                            Batch
                          </span>

                          <span className="verifier-review-detail-value">
                            {selected
                              .claiming_assignment
                              ?.lane?.batch
                              ? selected
                                .claiming_assignment
                                .lane.batch ===
                                "morning"
                                ? "Morning"
                                : "Afternoon"
                              : "—"}
                          </span>
                        </div>

                        <div className="verifier-review-detail-item">
                          <span className="verifier-review-detail-label">
                            Assigned Lane
                          </span>

                          <span className="verifier-review-detail-value">
                            {selected
                              .claiming_assignment
                              ?.lane
                              ?.lane_name ? (
                              <span className="lane-badge">
                                {
                                  selected
                                    .claiming_assignment
                                    .lane
                                    .lane_name
                                }
                              </span>
                            ) : (
                              "—"
                            )}
                          </span>
                        </div>

                        <div className="verifier-review-detail-item">
                          <span className="verifier-review-detail-label">
                            Current Claim Status
                          </span>

                          <span className="verifier-review-detail-value">
                            <ClaimStatusBadge
                              status={
                                selected
                                  .claiming_assignment
                                  ?.claim_status
                              }
                            />
                          </span>
                        </div>

                        {lateClaimingMode && (
                          <div className="verifier-review-detail-item">
                            <span className="verifier-review-detail-label">
                              Assignment Type
                            </span>

                            <span className="verifier-review-detail-value">
                              {selected
                                .claiming_assignment
                                ?.source ===
                                "waitlist_promotion" ? (
                                <span className="verifier-claiming-type-badge verifier-claiming-type-promoted">
                                  Promoted
                                </span>
                              ) : (
                                <span className="verifier-claiming-type-badge verifier-claiming-type-retrying">
                                  Retrying
                                </span>
                              )}
                            </span>
                          </div>
                        )}

                        {selected
                          .claiming_assignment
                          ?.verifier && (
                            <div className="verifier-review-detail-item">
                              <span className="verifier-review-detail-label">
                                Disbursed By
                              </span>

                              <span className="verifier-review-detail-value">
                                {
                                  selected
                                    .claiming_assignment
                                    .verifier
                                    .first_name
                                }{" "}
                                {
                                  selected
                                    .claiming_assignment
                                    .verifier
                                    .last_name
                                }
                              </span>
                            </div>
                          )}

                        {selected
                          .claiming_assignment
                          ?.verified_at && (
                            <div className="verifier-review-detail-item">
                              <span className="verifier-review-detail-label">
                                Disbursed At
                              </span>

                              <span className="verifier-review-detail-value">
                                {new Date(
                                  selected.claiming_assignment.verified_at
                                ).toLocaleString(
                                  "en-US",
                                  {
                                    month:
                                      "short",
                                    day: "numeric",
                                    year: "numeric",
                                    hour: "2-digit",
                                    minute:
                                      "2-digit",
                                  }
                                )}
                              </span>
                            </div>
                          )}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="page-card verifier-claiming-combined-card">
                  <h4 className="verifier-application-list-title">
                    Verification Process
                  </h4>

                  {/* Late Claiming walk-ins have no lane/schedule
                     structure backing up who they are, so identity comes
                     first — Face Verification renders as Step 1 and
                     Document Verification as Step 2. Scheduled claiming has
                     that structure already (a scheduled lane, a control
                     number, a verifier who selected them off that lane's
                     own list), so Face Verification is skipped entirely
                     there rather than shown as merely optional — matches
                     the backend, which already only enforces a passed
                     face verification for Late Claiming 'claimed' actions
                     (see VerifierController::updateClaimStatus). */}
                  <div
                    className={`verifier-claiming-split-card ${!lateClaimingMode
                      ? "verifier-claiming-split-card-single"
                      : ""
                      }`}
                  >
                    {lateClaimingMode ? (
                      <>
                        {faceVerificationPanel}
                        {documentVerificationPanel}
                      </>
                    ) : (
                      documentVerificationPanel
                    )}
                  </div>

                  <div
                    ref={
                      claimingActionRef
                    }
                  >
                    {isResolved ? (
                      <div className="alert alert-secondary mb-0">
                        This applicant's claiming status is already finalized as{" "}
                        <ClaimStatusBadge
                          status={
                            selected
                              .claiming_assignment
                              ?.claim_status
                          }
                        />
                        {" "}— there's nothing further to do here.
                      </div>
                    ) : (
                      <>
                        <div className="d-flex flex-wrap justify-content-end gap-2 mt-3 mb-3">
                          <button
                            type="button"
                            className="btn btn-success verifier-claiming-status-action-btn"
                            onClick={() =>
                              chooseAction(
                                "claimed"
                              )
                            }
                          >
                            Mark as Claimed
                          </button>

                          <button
                            type="button"
                            className="btn btn-danger verifier-claiming-status-action-btn"
                            onClick={() =>
                              chooseAction(
                                "not_cleared"
                              )
                            }
                          >
                            Mark as Not Cleared
                          </button>
                        </div>

                        {selectedAction ===
                          "claimed" &&
                          claimedBlocked && (
                            <div className="verifier-waitlist-notice verifier-claiming-validation-notice">
                              <span className="verifier-waitlist-notice-icon">
                                !
                              </span>

                              <div className="verifier-waitlist-notice-body">
                                <p className="verifier-waitlist-notice-text">
                                  <strong>
                                    Cannot mark as Claimed.
                                  </strong>{" "}
                                  {unreviewedCount > 0 &&
                                    `${unreviewedCount} document${unreviewedCount === 1 ? "" : "s"} still ${unreviewedCount === 1 ? "needs" : "need"} to be reviewed. `}
                                  {issueDocs.length > 0 &&
                                    `${issueDocs.map((d) => d.label).join(", ")} ${issueDocs.length === 1 ? "was" : "were"} flagged with an issue — this applicant cannot be marked Claimed until it's resolved. `}
                                </p>
                              </div>
                            </div>
                          )}
                      </>
                    )}
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="page-card verifier-claiming-combined-card">
                  <h4 className="verifier-application-list-title">
                    Claiming Application
                  </h4>

                  <div className="verifier-claiming-toolbar-row">
                    <div className="verifier-claiming-mode-tabs">
                      <button
                        type="button"
                        className={`verifier-claiming-mode-btn ${!lateClaimingMode ? "verifier-claiming-mode-btn-active" : ""}`}
                        onClick={switchToScheduledMode}
                      >
                        Scheduled Claiming
                      </button>

                      <button
                        type="button"
                        className={`verifier-claiming-mode-btn ${lateClaimingMode ? "verifier-claiming-mode-btn-active" : ""}`}
                        onClick={switchToLateClaimingMode}
                      >
                        Late Claiming
                      </button>
                    </div>

                    {lateClaimingMode ? (
                      lateClaimingDates.start && lateClaimingDates.end ? (
                        <div className="verifier-claiming-context verifier-claiming-context-warning verifier-claiming-context-compact">
                          <i className="bi bi-calendar3"></i>
                          <strong>Late Claiming</strong>
                          <span className="verifier-claiming-day-badge">
                            Day{" "}
                            {Math.max(1, daysBetween(lateClaimingDates.start, todayStr()) + 1)}/
                            {daysBetween(lateClaimingDates.start, lateClaimingDates.end) + 1}
                          </span>
                          <span className="verifier-claiming-context-muted">
                            {formatDateDisplay(lateClaimingDates.start)} – {formatDateDisplay(lateClaimingDates.end)}
                          </span>
                        </div>
                      ) : lanesError ? (
                        <div className="verifier-claiming-context verifier-claiming-context-neutral verifier-claiming-context-compact">
                          <i className="bi bi-exclamation-triangle"></i>
                          <span>
                            Couldn't load the claiming schedule.{" "}
                            <button
                              type="button"
                              className="verifier-claiming-retry-link"
                              onClick={fetchLanes}
                            >
                              Retry
                            </button>
                          </span>
                        </div>
                      ) : (
                        <div className="verifier-claiming-context verifier-claiming-context-neutral verifier-claiming-context-compact">
                          <i className="bi bi-exclamation-lg"></i>
                          <span>No Late Claiming configured for the active schedule.</span>
                        </div>
                      )
                    ) : (
                      <div className="verifier-claiming-context verifier-claiming-context-info verifier-claiming-context-compact">
                        <i className="bi bi-calendar3"></i>
                        <strong>Today — {formatDateDisplay(todayStr())}</strong>
                        <span className="verifier-claiming-context-muted">
                          {todaysLanes.length > 0
                            ? `${todaysLanes.length} lane${todaysLanes.length === 1 ? "" : "s"} claiming today`
                            : "No lanes scheduled to claim today"}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className={`verifier-claiming-split-card ${lateClaimingMode ? "verifier-claiming-split-card-single" : ""}`}>
                    {!lateClaimingMode && (
                      <div className="verifier-claiming-split-col">
                          <label className="verifier-claiming-section-label">
                            Choose a Lane to View
                          </label>

                          {assignedLanes.length > 0 && (
                            <p className="verifier-claiming-assigned-lane">
                              You hold{" "}
                              {assignedLanes.map((lane, index) => (
                                <span key={lane.id}>
                                  {index > 0 && (index === assignedLanes.length - 1 ? " and " : ", ")}
                                  <strong>{lane.lane_name}</strong> ({lane.batch === "morning" ? "AM" : "PM"}, {formatDateDisplay(lane.claiming_date)})
                                </span>
                              ))}
                              .
                            </p>
                          )}

                          <div className="verifier-claiming-lane-filter-row">
                            <div className="verifier-claiming-lane-filter-field">
                              <label className="verifier-claiming-sublabel">Day / Session</label>

                              <select
                                className="form-select verifier-claiming-select"
                                value={sessionFilter}
                                onChange={(e) => handleSessionFilterChange(e.target.value)}
                              >
                                <option value="">All Sessions</option>

                                {sessionOptions.map((session) => (
                                  <option key={session.key} value={session.key}>
                                    {formatDateDisplay(session.date)} — {session.batch === "morning" ? "Morning" : "Afternoon"}
                                    {session.date === todayStr() ? " (Today)" : ""}
                                  </option>
                                ))}
                              </select>
                            </div>

                            <div className="verifier-claiming-lane-filter-field">
                              <label className="verifier-claiming-sublabel">Lane</label>

                              <select
                                className="form-select verifier-claiming-select"
                                value={selectedLaneId}
                                onChange={(e) => handleLaneSelectChange(e.target.value)}
                              >
                                <option value="">
                                  {sessionFilter ? "All Lanes (Any Session)" : "All Lanes"}
                                </option>

                                {laneDropdownOptions.map((lane) => {
                                  const isMine = myLaneIds.has(String(lane.id));
                                  const tag = isMine
                                    ? " — Yours"
                                    : lane.requested_verifier_id
                                      ? " — Pending"
                                      : lane.verifier_id
                                        ? " — Taken"
                                        : "";

                                  return (
                                    <option key={lane.id} value={lane.id}>
                                      {sessionFilter
                                        ? `${lane.lane_name}${tag}`
                                        : `${formatDateDisplay(lane.claiming_date)} — ${lane.batch === "morning" ? "AM" : "PM"} — ${lane.lane_name}${tag}`}
                                    </option>
                                  );
                                })}
                              </select>
                            </div>
                          </div>

                          {selectedLaneId &&
                            !myLaneIds.has(selectedLaneId) && (
                              pendingRequestLaneId === selectedLaneId ? (
                                <p className="text-muted small mt-2 mb-0">
                                  {laneRequestMessage || "Request sent — waiting for an admin to approve it."}
                                </p>
                              ) : (
                                <button
                                  type="button"
                                  className="verifier-waitlist-action-btn mt-2"
                                  onClick={() => openLaneConfirm(selectedLaneId)}
                                  disabled={assigningLane}
                                >
                                  {assigningLane
                                    ? "Requesting..."
                                    : `Request ${viewingLane?.lane_name ?? "This Lane"}`}
                                </button>
                              )
                            )}
                      </div>
                    )}

                    <div className={`verifier-claiming-split-col ${!lateClaimingMode ? "verifier-claiming-split-col-border" : ""}`}>
                      <h4 className="verifier-claiming-section-label">
                        {lateClaimingMode
                          ? "Filter Late Claiming List"
                          : "Search Applicant"}
                      </h4>

                      <div className="verifier-claiming-search-box">
                        <form
                          onSubmit={
                            handleSearch
                          }
                        >
                          <fieldset className="verifier-claiming-search-fieldset verifier-claiming-search-row">
                            <div className="verifier-claiming-search-inputs-row">
                              <div className="verifier-claiming-search-field">
                                <label className="verifier-claiming-label">
                                  Control Number
                                </label>

                                <input
                                  type="text"
                                  className="form-control verifier-claiming-input"
                                  placeholder="e.g. SK-2026-0001"
                                  value={controlNo}
                                  onChange={(e) => setControlNo(e.target.value)}
                                />
                              </div>

                              <div className="verifier-claiming-search-field">
                                <label className="verifier-claiming-label">
                                  Applicant Name
                                </label>

                                <input
                                  type="text"
                                  className="form-control verifier-claiming-input"
                                  placeholder="Enter first or last name"
                                  value={applicantName}
                                  onChange={(e) => setApplicantName(e.target.value)}
                                />
                              </div>

                              {/* Late Claiming keeps the buttons inline with the
                                 inputs — there's no lane picker beside it to match
                                 the height of, so an extra row would only add
                                 height for no benefit. Scheduled Claiming puts them
                                 on their own row below instead (see the block after
                                 this row) — that row's height is already absorbed
                                 by the taller lane picker column beside it. */}
                              {lateClaimingMode && (
                                <>
                                  <button
                                    type="submit"
                                    className="verifier-claiming-search-btn verifier-claiming-search-row-btn"
                                    disabled={searching}
                                  >
                                    {searching ? "Searching..." : "Filter"}
                                  </button>

                                  {(controlNo || applicantName) && (
                                    <button
                                      type="button"
                                      className="verifier-claiming-clear-btn verifier-claiming-search-row-btn"
                                      onClick={handleClearSearch}
                                      disabled={searching}
                                    >
                                      Clear
                                    </button>
                                  )}
                                </>
                              )}
                            </div>

                            {!lateClaimingMode && (
                              <div className="verifier-claiming-search-actions-row">
                                <button
                                  type="submit"
                                  className="verifier-claiming-search-btn verifier-claiming-search-row-btn"
                                  disabled={searching}
                                >
                                  {searching ? "Searching..." : "Search"}
                                </button>

                                {(controlNo || applicantName) && (
                                  <button
                                    type="button"
                                    className="verifier-claiming-clear-btn verifier-claiming-search-row-btn"
                                    onClick={handleClearSearch}
                                    disabled={searching}
                                  >
                                    Clear
                                  </button>
                                )}
                              </div>
                            )}
                          </fieldset>
                        </form>

                        {lateClaimingMode ? (
                          <p className="text-muted small mt-2 mb-0">
                            Showing everyone currently in the Late Claiming pool. Leave both fields blank to see everyone.
                          </p>
                        ) : results.length ===
                          0 &&
                          !searching &&
                          !searchError ? (
                          <p className="text-muted small mt-2 mb-0">
                            No results yet — search above.
                          </p>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </div>

                {showResultsCard && (
                  <div className="page-card verifier-attention-card verifier-claiming-results-card">
                    <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3">
                      <h4 className="verifier-claiming-results-title mb-0">
                        {lateClaimingMode
                          ? "Late Claiming Applicants"
                          : "Search Results"}
                      </h4>

                      {lateClaimingMode && (
                        <button
                          type="button"
                          className="verifier-ocr-refresh-btn"
                          onClick={() =>
                            handleSearch({
                              preventDefault:
                                () => { },
                            })
                          }
                          disabled={
                            searching
                          }
                          title="Refresh list"
                          aria-label="Refresh list"
                        >
                          <svg
                            className={`verifier-ocr-refresh-icon ${searching
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
                      )}
                    </div>

                    {!lateClaimingMode && (
                      <div className="verifier-claiming-viewing-bar">
                        Viewing:{" "}
                        {viewingLane ? (
                          <>
                            <strong>{viewingLane.lane_name}</strong>{" "}
                            (
                            {viewingLane.batch === "morning" ? "Morning" : "Afternoon"},{" "}
                            {viewingLane.claiming_date}
                            )
                            {!myLaneIds.has(String(viewingLane.id)) && (
                              <span className="verifier-claiming-not-mine-badge ms-2">
                                Not your lane
                              </span>
                            )}
                          </>
                        ) : (
                          <strong>All lanes</strong>
                        )}
                      </div>
                    )}

                    {searchError && (
                      <div className="verifier-claiming-error-notice mt-3">
                        <span className="verifier-claiming-notice-icon">
                          <i className="bi bi-exclamation-lg"></i>
                        </span>

                        <span>
                          {searchError}
                        </span>
                      </div>
                    )}

                    {(searching ||
                      results.length >
                      0) && (
                        <>
                          <div className="table-responsive mt-3 verifier-claiming-table-wrap">
                            <table className="table table-bordered table-striped align-middle verifier-attention-table verifier-claiming-results-table">
                              {lateClaimingMode ? (
                                <colgroup>
                                  <col
                                    style={{
                                      width:
                                        "15%",
                                    }}
                                  />
                                  <col
                                    style={{
                                      width:
                                        "15%",
                                    }}
                                  />
                                  <col
                                    style={{
                                      width:
                                        "25%",
                                    }}
                                  />
                                  <col
                                    style={{
                                      width:
                                        "15%",
                                    }}
                                  />
                                  <col
                                    style={{
                                      width:
                                        "10%",
                                    }}
                                  />
                                  <col
                                    style={{
                                      width:
                                        "10%",
                                    }}
                                  />
                                </colgroup>
                              ) : (
                                <colgroup>
                                  <col
                                    style={{
                                      width:
                                        "15%",
                                    }}
                                  />
                                  <col
                                    style={{
                                      width:
                                        "15%",
                                    }}
                                  />
                                  <col
                                    style={{
                                      width:
                                        "25%",
                                    }}
                                  />
                                  <col
                                    style={{
                                      width:
                                        "15%",
                                    }}
                                  />
                                  <col
                                    style={{
                                      width:
                                        "10%",
                                    }}
                                  />
                                </colgroup>
                              )}

                              <thead>
                                <tr>
                                  <th>
                                    Control Number
                                  </th>
                                  <th>
                                    Applicant Name
                                  </th>
                                  <th>
                                    School
                                  </th>
                                  <th>
                                    Status
                                  </th>

                                  {lateClaimingMode && (
                                    <th>
                                      Type
                                    </th>
                                  )}

                                  <th>
                                    Action
                                  </th>
                                </tr>
                              </thead>

                              <tbody>
                                {searching ? (
                                  <tr>
                                    <td
                                      colSpan={
                                        lateClaimingMode
                                          ? 6
                                          : 5
                                      }
                                      className="text-center py-4"
                                    >
                                      <div
                                        className="spinner-border text-danger"
                                        role="status"
                                      >
                                        <span className="visually-hidden">
                                          Loading...
                                        </span>
                                      </div>
                                    </td>
                                  </tr>
                                ) : (
                                  pagedResults.map(
                                    (
                                      app,
                                      idx
                                    ) => {
                                      const isRowResolved =
                                        RESOLVED_CLAIM_STATUSES.includes(
                                          app.claiming_assignment
                                            ?.claim_status
                                        );

                                      const showDivider =
                                        firstResolvedIndex > 0 &&
                                        pageStart + idx ===
                                        firstResolvedIndex;

                                      return (
                                        <Fragment
                                          key={
                                            app.id
                                          }
                                        >
                                          {showDivider && (
                                            <tr className="verifier-claiming-results-divider">
                                              <td
                                                colSpan={
                                                  lateClaimingMode
                                                    ? 6
                                                    : 5
                                                }
                                              >
                                                Action Taken
                                              </td>
                                            </tr>
                                          )}

                                          <tr
                                            className={
                                              isRowResolved
                                                ? "verifier-claiming-row-resolved"
                                                : undefined
                                            }
                                          >
                                            <td>
                                              {
                                                app.control_number
                                              }
                                            </td>

                                            <td>
                                              {
                                                app.user
                                                  ?.first_name
                                              }{" "}
                                              {
                                                app.user
                                                  ?.last_name
                                              }
                                            </td>

                                            <td>
                                              {
                                                app.school_name
                                              }
                                            </td>

                                            <td className="verifier-claiming-status-cell">
                                              <ClaimStatusBadge
                                                status={
                                                  app.claiming_assignment
                                                    ?.claim_status
                                                }
                                              />
                                            </td>

                                            {lateClaimingMode && (
                                              <td className="verifier-claiming-type-cell">
                                                {app
                                                  .claiming_assignment
                                                  ?.source ===
                                                  "waitlist_promotion" && (
                                                    <span className="verifier-claiming-type-badge verifier-claiming-type-promoted">
                                                      Promoted
                                                    </span>
                                                  )}

                                                {(app
                                                  .claiming_assignment
                                                  ?.source ===
                                                  "late_claiming_retry" ||
                                                  app
                                                    .claiming_assignment
                                                    ?.source ===
                                                  "original") && (
                                                    <span className="verifier-claiming-type-badge verifier-claiming-type-retrying">
                                                      Retrying
                                                    </span>
                                                  )}
                                              </td>
                                            )}

                                            <td className="verifier-attention-action">
                                              <button
                                                type="button"
                                                className={
                                                  isRowResolved
                                                    ? "btn-view-muted"
                                                    : "btn-save-green"
                                                }
                                                onClick={() =>
                                                  selectApplicant(
                                                    app
                                                  )
                                                }
                                              >
                                                {isRowResolved
                                                  ? "View"
                                                  : "Select"}
                                              </button>
                                            </td>
                                          </tr>
                                        </Fragment>
                                      );
                                    }
                                  )
                                )}
                              </tbody>
                            </table>
                          </div>

                          {!searching && (
                            <div className="verifier-table-pagination-bar">
                              <span className="verifier-table-pagination-info">
                                Showing{" "}
                                {pageStart +
                                  1}
                                –
                                {Math.min(
                                  pageStart +
                                  perPage,
                                  sortedResults.length
                                )}{" "}
                                of{" "}
                                {
                                  sortedResults.length
                                }{" "}
                                applicants
                              </span>

                              <div className="verifier-table-pagination-controls">
                                <button
                                  type="button"
                                  className="verifier-table-pagination-arrow"
                                  onClick={() =>
                                    goToPage(
                                      currentPage -
                                      1
                                    )
                                  }
                                  disabled={
                                    currentPage ===
                                    1
                                  }
                                  aria-label="Previous page"
                                >
                                  ‹
                                </button>

                                {getPageNumbers().map(
                                  (
                                    page,
                                    idx
                                  ) =>
                                    page ===
                                      "..." ? (
                                      <span
                                        key={`ellipsis-${idx}`}
                                        className="verifier-table-pagination-ellipsis"
                                      >
                                        …
                                      </span>
                                    ) : (
                                      <button
                                        type="button"
                                        key={
                                          page
                                        }
                                        className={`verifier-table-pagination-page ${page ===
                                          currentPage
                                          ? "verifier-table-pagination-page-active"
                                          : ""
                                          }`}
                                        onClick={() =>
                                          goToPage(
                                            page
                                          )
                                        }
                                      >
                                        {
                                          page
                                        }
                                      </button>
                                    )
                                )}

                                <button
                                  type="button"
                                  className="verifier-table-pagination-arrow"
                                  onClick={() =>
                                    goToPage(
                                      currentPage +
                                      1
                                    )
                                  }
                                  disabled={
                                    currentPage ===
                                    totalPages
                                  }
                                  aria-label="Next page"
                                >
                                  ›
                                </button>
                              </div>
                            </div>
                          )}
                        </>
                      )}

                    {results.length ===
                      0 &&
                      !searching &&
                      !searchError && (
                        <p className="text-muted small mt-3 mb-0">
                          {lateClaimingMode
                            ? "No applicants currently in the Late Claiming list."
                            : "No matching applicants found."}
                        </p>
                      )}
                  </div>
                )}
              </>
            )}
          </div>
        </section>

        {selectedAction ===
          "claimed" &&
          !claimedBlocked &&
          selected && (
            <div
              className="verifier-claiming-action-modal-backdrop"
              onClick={
                closeClaimingActionModal
              }
            >
              <div
                className="verifier-claiming-action-modal verifier-claiming-action-modal-small"
                onClick={(e) =>
                  e.stopPropagation()
                }
              >
                <div className="verifier-claiming-action-modal-header">
                  <div className="verifier-claiming-action-modal-heading">
                    <span className="verifier-claiming-action-modal-icon verifier-claiming-action-modal-icon-claimed">
                      ✓
                    </span>

                    <div>
                      <h5>
                        Mark as Claimed
                      </h5>

                      <span>
                        Confirm final claiming status
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    className="verifier-claiming-action-modal-close"
                    onClick={
                      closeClaimingActionModal
                    }
                    disabled={
                      submitting
                    }
                    aria-label="Close claiming confirmation"
                  >
                    ×
                  </button>
                </div>

                <div className="verifier-claiming-action-modal-body">
                  {claimError && (
                    <div className="verifier-claiming-action-modal-error">
                      {claimError}
                    </div>
                  )}

                  <div className="verifier-claiming-quick-notes">
                    <span className="verifier-claiming-quick-notes-label">
                      Quick Notes
                    </span>

                    <div className="verifier-claiming-quick-notes-list">
                      {CLAIMED_QUICK_NOTES.map(
                        (
                          note
                        ) => (
                          <button
                            type="button"
                            key={
                              note
                            }
                            className="verifier-claiming-quick-note-btn"
                            onClick={() =>
                              setNotes(
                                note
                              )
                            }
                          >
                            {note}
                          </button>
                        )
                      )}
                    </div>
                  </div>

                  <div className="verifier-claiming-action-field">
                    <label>
                      Additional Notes (optional)
                    </label>

                    <textarea
                      className="form-control"
                      rows="4"
                      value={notes}
                      onChange={(e) =>
                        setNotes(
                          e.target
                            .value
                        )
                      }
                      placeholder="Add any notes about this claiming transaction..."
                    />
                  </div>
                </div>

                <div className="verifier-claiming-action-modal-footer">
                  <button
                    type="button"
                    className="verifier-claiming-action-modal-cancel"
                    onClick={
                      closeClaimingActionModal
                    }
                    disabled={
                      submitting
                    }
                  >
                    Cancel
                  </button>

                  <button
                    type="button"
                    className="verifier-claiming-action-modal-confirm verifier-claiming-action-modal-confirm-claimed"
                    onClick={
                      handleConfirm
                    }
                    disabled={
                      submitting
                    }
                  >
                    {submitting
                      ? "Submitting..."
                      : "Confirm — Mark as Claimed"}
                  </button>
                </div>
              </div>
            </div>
          )}

        {selectedAction ===
          "not_cleared" &&
          selected && (
            <div
              className="verifier-claiming-action-modal-backdrop"
              onClick={
                closeClaimingActionModal
              }
            >
              <div
                className="verifier-claiming-action-modal verifier-claiming-action-modal-medium"
                onClick={(e) =>
                  e.stopPropagation()
                }
              >
                <div className="verifier-claiming-action-modal-header">
                  <div className="verifier-claiming-action-modal-heading">
                    <span className="verifier-claiming-action-modal-icon verifier-claiming-action-modal-icon-not-cleared">
                      !
                    </span>

                    <div>
                      <h5>
                        Mark as Not Cleared
                      </h5>

                      <span>
                        Select the reason before confirming
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    className="verifier-claiming-action-modal-close"
                    onClick={
                      closeClaimingActionModal
                    }
                    disabled={
                      submitting
                    }
                    aria-label="Close not cleared confirmation"
                  >
                    ×
                  </button>
                </div>

                <div className="verifier-claiming-action-modal-body">
                  {claimError && (
                    <div className="verifier-claiming-action-modal-error">
                      {claimError}
                    </div>
                  )}

                  <div className="verifier-claiming-action-reasons">
                    <label className="verifier-claiming-action-reasons-title">
                      Not Cleared Reason(s) *
                    </label>

                    {NOT_CLEARED_REASONS.map(
                      (
                        reason
                      ) => (
                        <div
                          className="verifier-claiming-action-reason-option"
                          key={
                            reason
                          }
                        >
                          <input
                            className="form-check-input"
                            type="checkbox"
                            id={`nc-${reason}`}
                            checked={notClearedReasons.includes(
                              reason
                            )}
                            onChange={() =>
                              toggleNotClearedReason(
                                reason
                              )
                            }
                          />

                          <label
                            className="form-check-label"
                            htmlFor={`nc-${reason}`}
                          >
                            {
                              reason
                            }
                          </label>
                        </div>
                      )
                    )}

                    {notClearedReasons.includes(
                      OTHER
                    ) && (
                        <input
                          className="form-control form-control-sm verifier-claiming-action-other-input"
                          placeholder="Specify the reason..."
                          value={
                            notClearedOtherText
                          }
                          onChange={(e) =>
                            setNotClearedOtherText(
                              e.target
                                .value
                            )
                          }
                        />
                      )}
                  </div>

                  <div className="verifier-claiming-quick-notes">
                    <span className="verifier-claiming-quick-notes-label">
                      Quick Notes
                    </span>

                    <div className="verifier-claiming-quick-notes-list">
                      {NOT_CLEARED_QUICK_NOTES.map(
                        (
                          note
                        ) => (
                          <button
                            type="button"
                            key={
                              note
                            }
                            className="verifier-claiming-quick-note-btn"
                            onClick={() =>
                              setNotes(
                                note
                              )
                            }
                          >
                            {note}
                          </button>
                        )
                      )}
                    </div>
                  </div>

                  <div className="verifier-claiming-action-field">
                    <label>
                      Additional Notes (optional)
                    </label>

                    <textarea
                      className="form-control"
                      rows="4"
                      value={notes}
                      onChange={(e) =>
                        setNotes(
                          e.target
                            .value
                        )
                      }
                      placeholder="Add any notes about this claiming transaction..."
                    />
                  </div>
                </div>

                <div className="verifier-claiming-action-modal-footer">
                  <button
                    type="button"
                    className="verifier-claiming-action-modal-cancel"
                    onClick={
                      closeClaimingActionModal
                    }
                    disabled={
                      submitting
                    }
                  >
                    Cancel
                  </button>

                  <button
                    type="button"
                    className="verifier-claiming-action-modal-confirm verifier-claiming-action-modal-confirm-not-cleared"
                    onClick={
                      handleConfirm
                    }
                    disabled={
                      submitting
                    }
                  >
                    {submitting
                      ? "Submitting..."
                      : "Confirm — Mark as Not Cleared"}
                  </button>
                </div>
              </div>
            </div>
          )}

        {claimingFeedback && (
          <div
            className="verifier-claiming-feedback-backdrop"
            onClick={() =>
              setClaimingFeedback(
                null
              )
            }
          >
            <div
              className="verifier-claiming-feedback-popup"
              onClick={(e) =>
                e.stopPropagation()
              }
            >
              <div
                className={`verifier-claiming-feedback-icon ${claimingFeedback.type ===
                  "claimed"
                  ? "verifier-claiming-feedback-icon-claimed"
                  : "verifier-claiming-feedback-icon-not-cleared"
                  }`}
              >
                {claimingFeedback.type ===
                  "claimed"
                  ? "✓"
                  : "!"}
              </div>

              <h4 className="verifier-claiming-feedback-title">
                {
                  claimingFeedback.title
                }
              </h4>

              <p className="verifier-claiming-feedback-message">
                {
                  claimingFeedback.message
                }
              </p>

              <button
                type="button"
                className={`verifier-claiming-feedback-dismiss ${claimingFeedback.type ===
                  "claimed"
                  ? "verifier-claiming-feedback-dismiss-claimed"
                  : "verifier-claiming-feedback-dismiss-not-cleared"
                  }`}
                onClick={() =>
                  setClaimingFeedback(
                    null
                  )
                }
              >
                <span>
                  Done
                </span>

                <span className="verifier-claiming-feedback-button-right">
                  <span className="verifier-claiming-feedback-arrow">
                    →
                  </span>

                  <span className="verifier-claiming-feedback-timer">
                    {
                      feedbackCountdown
                    }
                    s
                  </span>
                </span>
              </button>
            </div>
          </div>
        )}

        {filePreview && (
          <div
            className="verifier-preview-modal"
            onClick={
              closeFilePreview
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
                onClick={
                  closeFilePreview
                }
                aria-label="Close preview"
              >
                ×
              </button>

              {filePreview.type.startsWith(
                "image/"
              ) ? (
                <img
                  src={
                    filePreview.url
                  }
                  alt={`${filePreview.label} enlarged preview`}
                  className="verifier-preview-modal-image"
                />
              ) : (
                <iframe
                  src={
                    filePreview.url
                  }
                  title={`${filePreview.label} enlarged preview`}
                  className="verifier-preview-modal-pdf"
                />
              )}
            </div>
          </div>
        )}

        {laneConfirm && (
          <div className="modal fade show d-block" tabIndex="-1" style={{ background: "rgba(0,0,0,0.5)" }}>
            <div className="modal-dialog modal-dialog-centered">
              <div className="modal-content">
                <div className="modal-header">
                  <h5 className="modal-title">
                    {laneConfirm.conflictLane ? "Switch Lanes?" : "Add Lane?"}
                  </h5>
                  <button
                    type="button"
                    className="btn-close"
                    onClick={() => setLaneConfirm(null)}
                    disabled={assigningLane}
                  />
                </div>
                <div className="modal-body">
                  {laneConfirm.conflictLane ? (
                    <p className="mb-0">
                      You&apos;re currently assigned to{" "}
                      <strong>{laneConfirm.conflictLane.lane_name}</strong> for this same session (
                      {laneConfirm.conflictLane.batch === "morning" ? "Morning" : "Afternoon"},{" "}
                      {laneConfirm.conflictLane.claiming_date}). Requesting{" "}
                      <strong>{laneConfirm.targetLane.lane_name}</strong> will{" "}
                      <strong>switch</strong> you onto it — you will no longer be assigned to{" "}
                      {laneConfirm.conflictLane.lane_name}. Continue?
                    </p>
                  ) : (
                    <p className="mb-0">
                      This will assign you to{" "}
                      <strong>{laneConfirm.targetLane.lane_name}</strong> (
                      {laneConfirm.targetLane.batch === "morning" ? "Morning" : "Afternoon"},{" "}
                      {laneConfirm.targetLane.claiming_date})
                      {assignedLanes.length > 0
                        ? " in addition to your current lane — you'll hold both."
                        : "."}{" "}
                      Continue?
                    </p>
                  )}
                </div>
                <div className="modal-footer">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setLaneConfirm(null)}
                    disabled={assigningLane}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="btn btn-custom"
                    onClick={confirmLaneRequest}
                    disabled={assigningLane}
                  >
                    {assigningLane
                      ? "Requesting..."
                      : laneConfirm.conflictLane
                        ? "Yes, Switch"
                        : "Yes, Add Lane"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        <PanelFooter />
      </div>
    </div>
  );
}

export default VerifierClaiming;