import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import AdminNavigation from "../components/AdminNavigation";
import AdminTopbarUser from "../components/AdminTopbarUser";
import api from "../../services/api";
import PanelFooter from "../../components/PanelFooter";
import { usePolling } from "../../hooks/usePolling";

const emptyForm = {
  location: "Barangay Mamatid Covered Court",
  morning_start: "08:00",
  morning_end: "12:00",
  afternoon_start: "13:00",
  afternoon_end: "17:00",
  late_claiming_date: "",
  late_claiming_end_date: "",
};

const emptySessionLane = () => ({ lane_name: "", capacity: "", verifier_id: "" });
const emptyDay = (dateStr = "") => ({
  date: dateStr,
  morning: { enabled: true, lanes: [emptySessionLane()] },
  afternoon: { enabled: true, lanes: [emptySessionLane()] },
});

// NOT toISOString().slice(0, 10) — that formats in UTC, which rolls
// local midnight back to the previous calendar day in any timezone
// ahead of UTC (e.g. UTC+8), silently breaking every "day after X"
// calculation below.
function toLocalDateStr(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function todayStr() {
  return toLocalDateStr(new Date());
}

// Matches ApplicantClaimingSchedule.jsx's own formatTime() — the native
// <input type="time"> picker's displayed format follows the browser/OS
// locale and can't be forced from here, but this label text is fully
// under our control.
function formatTime(timeStr) {
  if (!timeStr) return "";
  const [h, m] = timeStr.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const hour = h % 12 || 12;
  return `${hour}:${String(m).padStart(2, "0")} ${period}`;
}

function groupLanesIntoDays(lanesArr) {
  if (!lanesArr || lanesArr.length === 0) return [emptyDay()];
  const map = {};
  lanesArr
    .filter((l) => l.lane_name !== "Late Claiming")
    .forEach((l) => {
      if (!map[l.claiming_date]) {
        map[l.claiming_date] = {
          date: l.claiming_date,
          morning: { enabled: false, lanes: [] },
          afternoon: { enabled: false, lanes: [] },
        };
      }
      map[l.claiming_date][l.batch].enabled = true;
      map[l.claiming_date][l.batch].lanes.push({
        lane_name: l.lane_name,
        capacity: l.capacity ?? "",
        verifier_id: l.verifier_id ?? "",
      });
    });
  const days = Object.values(map).sort((a, b) => a.date.localeCompare(b.date));
  return days.length > 0 ? days : [emptyDay()];
}

function serializeLanes(days) {
  const lanes = [];
  days.forEach((day, dayIdx) => {
    ["morning", "afternoon"].forEach((session) => {
      if (!day[session].enabled) return;
      day[session].lanes.forEach((lane, laneIdx) => {
        lanes.push({
          lane_name: lane.lane_name.trim() || `Day ${dayIdx + 1} ${session === "morning" ? "Morning" : "Afternoon"} Lane ${laneIdx + 1}`,
          // Capacity is required now — no more "blank = auto-split",
          // since there's no fixed applicant pool to split at save time
          // under real-time assignment. Default to 1 if left blank so
          // the request doesn't fail validation outright; the admin
          // should set a real number.
          capacity: lane.capacity ? Number(lane.capacity) : 1,
          batch: session,
          claiming_date: day.date,
          verifier_id: lane.verifier_id || null,
        });
      });
    });
  });
  return lanes;
}

function nextDayStr(dateStr) {
  const d = new Date(`${dateStr}T00:00:00`);
  d.setDate(d.getDate() + 1);
  return toLocalDateStr(d);
}

// A claiming day must fall strictly after the application period's
// close_date, so the earliest valid default is whichever is later:
// today, or the day right after close_date.
function firstValidDayDate(closeDate) {
  if (!closeDate) return todayStr();
  const dayAfterClose = nextDayStr(closeDate.slice(0, 10));
  return dayAfterClose > todayStr() ? dayAfterClose : todayStr();
}

function formatDateRange(dates) {
  const unique = [...new Set(dates.filter(Boolean))].sort();
  if (unique.length === 0) return "—";
  if (unique.length === 1) return unique[0];
  return `${unique[0]} to ${unique[unique.length - 1]}`;
}

function AdminSchedule() {
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [config, setConfig] = useState(null);
  const [approvedCount, setApprovedCount] = useState(0);
  const [unassignedApprovedCount, setUnassignedApprovedCount] = useState(0);
  const [schedule, setSchedule] = useState(null);
  const [verifiers, setVerifiers] = useState([]);
  const [assigningLaneId, setAssigningLaneId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [days, setDays] = useState([emptyDay()]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingLateClaiming, setSavingLateClaiming] = useState(false);
  const [activating, setActivating] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [lanePage, setLanePage] = useState(1);
  const lanePerPage = 10;
  const [lateClaimingList, setLateClaimingList] = useState(null);
  const [loadingLateClaimingList, setLoadingLateClaimingList] = useState(false);
  const [removeDayTarget, setRemoveDayTarget] = useState(null); // day index pending confirmation, or null
  const [removeLaneTarget, setRemoveLaneTarget] = useState(null); // { dayIndex, session, laneIndex } pending confirmation, or null
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [showActivateConfirm, setShowActivateConfirm] = useState(false);
  // { laneId, laneName, verifierId, verifierName } pending confirmation,
  // or null — verifierId/verifierName are null when the change unassigns
  // the lane rather than assigning someone.
  const [assignVerifierTarget, setAssignVerifierTarget] = useState(null);
  // { type: 'approve' | 'dismiss', laneId, laneName, verifierId, verifierName }
  // pending confirmation, or null.
  const [laneRequestActionTarget, setLaneRequestActionTarget] = useState(null);
  // Only offered after a Late Claiming date change — that's the one save
  // path with no other way for applicants to find out the window moved
  // (see updateLateClaiming() on the backend: it just updates the dates,
  // nothing reads/notifies from it). The main schedule save doesn't need
  // this: applicants aren't told to expect specific claiming dates ahead
  // of being assigned a lane, so there's nothing there for them to have
  // been counting on that just changed.
  const [announceNudge, setAnnounceNudge] = useState(null);

  const loadLateClaimingList = useCallback(() => {
    setLoadingLateClaimingList(true);
    api.get("/admin/reports/late-claiming-list")
      .then((res) => setLateClaimingList(res.data))
      .catch(() => setLateClaimingList(null))
      .finally(() => setLoadingLateClaimingList(false));
  }, []);

  const loadSchedule = useCallback((silent = false) => {
    if (silent) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    return api.get("/admin/claiming-schedule")
      .then((res) => {
        setConfig(res.data.config);
        setApprovedCount(res.data.approved_count);
        setUnassignedApprovedCount(res.data.unassigned_approved_count ?? 0);
        setVerifiers(res.data.verifiers ?? []);
        const sched = res.data.schedule;
        setSchedule(sched);
        if (sched) {
          setForm({
            location: sched.location,
            morning_start: sched.morning_start?.slice(0, 5) ?? "07:00",
            morning_end: sched.morning_end?.slice(0, 5) ?? "12:00",
            afternoon_start: sched.afternoon_start?.slice(0, 5) ?? "13:00",
            afternoon_end: sched.afternoon_end?.slice(0, 5) ?? "17:00",
            late_claiming_date: sched.late_claiming_date ?? "",
            late_claiming_end_date: sched.late_claiming_end_date ?? "",
          });
          setDays(groupLanesIntoDays(sched.lanes));
          if (sched.late_claiming_date) {
            loadLateClaimingList();
          }
        }
      })
      .catch((err) => {
        if (err.response?.status !== 404) {
          setError("Failed to load schedule data.");
        } else {
          setConfig(null);
        }
      })
      .finally(() => {
        setLoading(false);
        setRefreshing(false);
      });
  }, [loadLateClaimingList]);

  useEffect(() => {
    loadSchedule();
  }, [loadSchedule]);

  // Only defaults the very first, still-blank claiming day of a brand
  // new schedule — never a saved one — and only once close_date is
  // known, so the suggested date is never one the "must be after
  // close_date" rule would immediately reject.
  useEffect(() => {
    if (schedule || !config?.close_date) return;
    setDays((prev) =>
      prev.length === 1 && !prev[0].date
        ? [emptyDay(firstValidDayDate(config.close_date))]
        : prev
    );
  }, [schedule, config]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  function setDayDate(dayIndex, value) {
    setDays((prev) => prev.map((d, i) => i === dayIndex ? { ...d, date: value } : d));
  }

  function toggleSession(dayIndex, session) {
    setDays((prev) => prev.map((d, i) => {
      if (i !== dayIndex) return d;
      return { ...d, [session]: { ...d[session], enabled: !d[session].enabled } };
    }));
  }

  function addDay() {
    setDays((prev) => {
      const lastDate = [...prev].reverse().find((d) => d.date)?.date;
      return [...prev, emptyDay(lastDate ? nextDayStr(lastDate) : firstValidDayDate(config?.close_date))];
    });
  }

  function removeDay(dayIndex) {
    const day = days[dayIndex];
    const hasContent = day && (day.date || day.morning.lanes.length > 0 || day.afternoon.lanes.length > 0);
    if (hasContent) {
      setRemoveDayTarget(dayIndex);
      return;
    }
    setDays((prev) => prev.filter((_, i) => i !== dayIndex));
  }

  function confirmRemoveDay() {
    setDays((prev) => prev.filter((_, i) => i !== removeDayTarget));
    setRemoveDayTarget(null);
  }

  function addLane(dayIndex, session) {
    setDays((prev) => prev.map((d, i) => {
      if (i !== dayIndex) return d;
      return { ...d, [session]: { ...d[session], lanes: [...d[session].lanes, emptySessionLane()] } };
    }));
  }

  function removeLane(dayIndex, session, laneIndex) {
    const lane = days[dayIndex]?.[session]?.lanes?.[laneIndex];
    const hasContent = lane && (lane.lane_name.trim() || lane.capacity || lane.verifier_id);
    if (hasContent) {
      setRemoveLaneTarget({ dayIndex, session, laneIndex });
      return;
    }
    setDays((prev) => prev.map((d, i) => {
      if (i !== dayIndex) return d;
      return { ...d, [session]: { ...d[session], lanes: d[session].lanes.filter((_, li) => li !== laneIndex) } };
    }));
  }

  function confirmRemoveLane() {
    const { dayIndex, session, laneIndex } = removeLaneTarget;
    setDays((prev) => prev.map((d, i) => {
      if (i !== dayIndex) return d;
      return { ...d, [session]: { ...d[session], lanes: d[session].lanes.filter((_, li) => li !== laneIndex) } };
    }));
    setRemoveLaneTarget(null);
  }

  function setLaneField(dayIndex, session, laneIndex, key, value) {
    setDays((prev) => prev.map((d, i) => {
      if (i !== dayIndex) return d;
      return {
        ...d,
        [session]: {
          ...d[session],
          lanes: d[session].lanes.map((l, li) => li === laneIndex ? { ...l, [key]: value } : l),
        },
      };
    }));
  }

  function handleReset() {
    const hasContent = days.some((d) => d.date || d.morning.lanes.length > 0 || d.afternoon.lanes.length > 0);
    if (hasContent) {
      setShowResetConfirm(true);
      return;
    }
    setForm(emptyForm);
    setDays([emptyDay(firstValidDayDate(config?.close_date))]);
  }

  function confirmReset() {
    setForm(emptyForm);
    setDays([emptyDay(firstValidDayDate(config?.close_date))]);
    setShowResetConfirm(false);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSuccess("");
    if (days.length === 0) {
      setError("Please add at least one claiming day.");
      return;
    }
    for (const day of days) {
      if (!day.date) {
        setError("Please set a date for every claiming day.");
        return;
      }
      if (!day.morning.enabled && !day.afternoon.enabled) {
        setError(`${day.date} needs at least one active session (morning or afternoon).`);
        return;
      }
      for (const session of ["morning", "afternoon"]) {
        if (day[session].enabled && day[session].lanes.length === 0) {
          setError(`Add at least one lane to the ${session} session on ${day.date}.`);
          return;
        }
        if (day[session].enabled && day[session].lanes.some((l) => !l.capacity || Number(l.capacity) < 1)) {
          setError(`Every lane needs a capacity of at least 1 — check the ${session} session on ${day.date}.`);
          return;
        }
      }
    }
    const lanes = serializeLanes(days);
    setSaving(true);
    try {
      // Late Claiming is a genuinely separate save action (its own button
      // below) — deliberately not sent here, even if the admin already
      // typed dates into those fields, so this button only ever touches
      // claiming days/lanes. Whatever's in the Late Claiming fields stays
      // in the form afterward, ready for that other button to save.
      const { late_claiming_date, late_claiming_end_date, ...claimingDaysForm } = form;
      const res = await api.post("/admin/claiming-schedule", { ...claimingDaysForm, lanes });
      setSchedule(res.data.schedule);
      setSuccess("Scheduled Claiming saved. Save Late Claiming below if you want to set that window too, then activate when ready.");
    } catch (err) {
      setError(err.response?.data?.message || "Failed to save schedule.");
    } finally {
      setSaving(false);
    }
  }

  // Only reachable while the schedule is active — before that, Late
  // Claiming's dates just save as part of the normal full-form submit
  // above.
  async function handleSaveLateClaiming() {
    setError("");
    setSuccess("");
    setSavingLateClaiming(true);
    try {
      const res = await api.patch(`/admin/claiming-schedule/${schedule.id}/late-claiming`, {
        late_claiming_date: form.late_claiming_date || null,
        late_claiming_end_date: form.late_claiming_end_date || null,
      });
      setSchedule(res.data.schedule);
      setSuccess(res.data.message);
      if (res.data.schedule?.late_claiming_date) {
        loadLateClaimingList();
        const start = res.data.schedule.late_claiming_date;
        const end = res.data.schedule.late_claiming_end_date;
        const range = end && end !== start ? `${start} to ${end}` : start;
        setAnnounceNudge({
          title: "Late Claiming Window Updated",
          message: "Applicants aren't notified of this change automatically. Want to post an announcement about the new Late Claiming dates?",
          prefill: {
            title: "Late Claiming Schedule Update",
            category: "Schedule Update",
            content: `The Late Claiming period has been updated to ${range}. Please take note of this change and plan your claiming accordingly.`,
          },
        });
      }
    } catch (err) {
      setError(err.response?.data?.message || "Failed to update Late Claiming.");
    } finally {
      setSavingLateClaiming(false);
    }
  }

  function goAnnounce() {
    const prefill = announceNudge?.prefill;
    setAnnounceNudge(null);
    navigate("/AdminAnnouncements", { state: { prefill } });
  }

  function handleActivate() {
    if (!schedule) return;
    setShowActivateConfirm(true);
  }

  async function confirmActivate() {
    setShowActivateConfirm(false);
    setActivating(true);
    setError("");
    setSuccess("");
    try {
      const res = await api.post(`/admin/claiming-schedule/${schedule.id}/activate`);
      setSuccess(res.data.message);
      setSchedule(res.data.schedule);
      loadSchedule(true);

      // Individual applicants already get a per-lane notification when
      // assigned (see ClaimingAssignmentService::assignToLane()), but
      // nothing tells the wider public the schedule is live at all —
      // same "nothing else announces this" gap as the Late Claiming nudge.
      setAnnounceNudge({
        title: "Schedule Activated",
        message: "Applicants are being assigned to lanes automatically now, but there's no general public notice. Want to post an announcement about the claiming schedule?",
        prefill: {
          title: "Claiming Schedule Now Available",
          category: "Schedule Update",
          content: `The claiming schedule for ${formatDateRange(claimingDates)} at ${form.location} is now live. Approved applicants will be assigned a lane and notified automatically — check your dashboard for your assigned date, time, and lane.`,
        },
      });
    } catch (err) {
      setError(err.response?.data?.message || "Failed to activate schedule.");
    } finally {
      setActivating(false);
    }
  }

  async function handleAssignVerifier(laneId, verifierId) {
    setAssigningLaneId(laneId);
    setError("");
    try {
      const res = await api.post(`/admin/claiming-schedule/lanes/${laneId}/assign-verifier`, {
        verifier_id: verifierId || null,
      });
      setSchedule((prev) => ({
        ...prev,
        lanes: prev.lanes.map((l) => (l.id === laneId ? { ...l, verifier_id: res.data.lane.verifier_id, verifier: res.data.lane.verifier, requested_verifier_id: null, requested_verifier: null } : l)),
      }));
    } catch (err) {
      setError(err.response?.data?.message || "Failed to update lane assignment.");
    } finally {
      setAssigningLaneId(null);
    }
  }

  async function handleDismissRequest(laneId) {
    setAssigningLaneId(laneId);
    setError("");
    try {
      const res = await api.post(`/admin/claiming-schedule/lanes/${laneId}/dismiss-request`);
      setSchedule((prev) => ({
        ...prev,
        lanes: prev.lanes.map((l) => (l.id === laneId ? { ...l, requested_verifier_id: res.data.lane.requested_verifier_id, requested_verifier: null } : l)),
      }));
    } catch (err) {
      setError(err.response?.data?.message || "Failed to dismiss request.");
    } finally {
      setAssigningLaneId(null);
    }
  }

  // Reassigning a verifier also silently bumps them off any other lane
  // they hold in the same claiming_date + batch session (see
  // assignVerifier() on the backend) — worth a confirmation rather than
  // acting the instant the dropdown changes.
  function requestAssignVerifier(lane, verifierId) {
    const verifier = verifierId
      ? verifiers.find((v) => String(v.id) === String(verifierId))
      : null;
    setAssignVerifierTarget({
      laneId: lane.id,
      laneName: lane.lane_name,
      verifierId: verifierId || null,
      verifierName: verifier ? `${verifier.first_name} ${verifier.last_name}` : null,
    });
  }

  function confirmAssignVerifier() {
    const { laneId, verifierId } = assignVerifierTarget;
    setAssignVerifierTarget(null);
    handleAssignVerifier(laneId, verifierId);
  }

  function confirmLaneRequestAction() {
    const { type, laneId, verifierId } = laneRequestActionTarget;
    setLaneRequestActionTarget(null);
    if (type === "approve") {
      handleAssignVerifier(laneId, verifierId);
    } else {
      handleDismissRequest(laneId);
    }
  }

  async function handlePrint(laneId) {
    // Opened synchronously (before the await) so popup blockers don't
    // treat this as an unsolicited new-tab open — the fetch fills it in.
    const printWindow = window.open("", "_blank");
    try {
      const res = await api.get(`/admin/claiming-schedule/lanes/${laneId}/printable/pdf`, {
        responseType: "blob",
      });
      const url = window.URL.createObjectURL(new Blob([res.data], { type: "application/pdf" }));
      if (printWindow) {
        printWindow.location.href = url;
      }
      // Not revoking the object URL here — the new tab's PDF viewer needs
      // it to stay valid while the user is looking at / printing from it.
    } catch (err) {
      if (printWindow) printWindow.close();
      setError("Failed to generate printable list.");
    }
  }

  async function handleLateClaimingListExport() {
    try {
      const res = await api.get("/admin/reports/late-claiming-list/pdf", { responseType: "blob" });
      const url = window.URL.createObjectURL(new Blob([res.data], { type: "application/pdf" }));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `late-claiming-list-${new Date().toISOString().slice(0, 10)}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      setError("Failed to generate Late Claiming list.");
    }
  }

  const isActive = schedule?.is_active;

  // Silent background refresh — once a schedule is active, lane
  // assignments and verifier lane requests can change from other users
  // (verifiers self-assigning/requesting a lane, applicants getting
  // auto-assigned) while an admin is sitting on this page, and without
  // this they'd only see it after a manual Refresh. Only enabled once
  // active: the lane/day editing form above is disabled at that point
  // (see `disabled={isActive}` on the fieldset), so there's no
  // in-progress draft this could ever overwrite. Before activation, the
  // admin is actively composing the schedule, so this stays off to
  // avoid silently wiping unsaved edits mid-edit.
  usePolling(() => loadSchedule(true), {
    intervalMs: 20000,
    enabled: Boolean(isActive) && !loading,
  });
  // Late Claiming's own window stays editable even once the schedule is
  // active (store() blocks the rest of the form since it fully replaces
  // the lane list, which is unsafe once real assignments exist — but
  // nothing depends on Late Claiming's dates until it actually opens).
  // Locked only once today has reached the currently-saved start date.
  const lateClaimingHasStarted = Boolean(
    schedule?.late_claiming_date && schedule.late_claiming_date <= todayStr()
  );
  const hasApproved = approvedCount > 0;
  const totalLanesCount = days.reduce((sum, d) =>
    sum + (d.morning.enabled ? d.morning.lanes.length : 0) + (d.afternoon.enabled ? d.afternoon.lanes.length : 0), 0);
  const claimingDates = days.map(d => d.date).filter(Boolean);
  const latestClaimingDateStr = claimingDates.length > 0
    ? claimingDates.slice().sort().slice(-1)[0]
    : null;

  // Late claiming can't overlap the regular claiming days, so once at
  // least one is dated, default it to the very next day instead of
  // leaving the admin to work out the earliest valid date themselves —
  // only for a schedule being set up fresh, never overriding a saved
  // schedule that intentionally left it blank.
  useEffect(() => {
    if (schedule || !latestClaimingDateStr) return;
    setForm((f) => {
      if (f.late_claiming_date) return f;
      const start = nextDayStr(latestClaimingDateStr);
      return { ...f, late_claiming_date: start, late_claiming_end_date: f.late_claiming_end_date || start };
    });
  }, [latestClaimingDateStr, schedule]);
  const summaryItems = schedule ? [
    { label: "Total Approved Applicants", value: approvedCount },
    { label: "Awaiting a Lane", value: unassignedApprovedCount },
    { label: "Total Lanes", value: totalLanesCount },
    { label: "Claiming Dates", value: formatDateRange(claimingDates) },
    {
      label: "Late Claiming",
      value: form.late_claiming_date
        ? (form.late_claiming_end_date
          ? `${form.late_claiming_date} to ${form.late_claiming_end_date}`
          : form.late_claiming_date)
        : "Not set",
    },
  ] : [];

  // Under real-time assignment, "the lanes" is just schedule.lanes with
  // its live assignments_count — there's no separate preview snapshot to
  // reconcile against, since applicants land on a lane the moment
  // they're approved, not at some future publish step.
  // Lanes come back in whatever order the DB returns them, not grouped
  // by claiming day — sort chronologically (day, then morning before
  // afternoon, then lane name) so Day 1's lanes list together before
  // Day 2's instead of interleaving.
  const BATCH_ORDER = { morning: 0, afternoon: 1 };
  const displayedLanes = (schedule?.lanes ?? [])
    .filter((l) => l.lane_name !== "Late Claiming")
    .slice()
    .sort((a, b) =>
      a.claiming_date.localeCompare(b.claiming_date) ||
      (BATCH_ORDER[a.batch] ?? 0) - (BATCH_ORDER[b.batch] ?? 0) ||
      a.lane_name.localeCompare(b.lane_name)
    );
  const laneTotalPages = Math.max(1, Math.ceil(displayedLanes.length / lanePerPage));
  const lanePageStart = (lanePage - 1) * lanePerPage;
  const pagedLanes = displayedLanes.slice(lanePageStart, lanePageStart + lanePerPage);

  function goToLanePage(page) {
    if (page < 1 || page > laneTotalPages) return;
    setLanePage(page);
  }

  function getLanePageNumbers() {
    const pages = [];
    const maxVisible = 5;
    if (laneTotalPages <= maxVisible) {
      for (let i = 1; i <= laneTotalPages; i++) pages.push(i);
      return pages;
    }
    pages.push(1);
    if (lanePage > 3) pages.push("...");
    const start = Math.max(2, lanePage - 1);
    const end = Math.min(laneTotalPages - 1, lanePage + 1);
    for (let i = start; i <= end; i++) pages.push(i);
    if (lanePage < laneTotalPages - 2) pages.push("...");
    pages.push(laneTotalPages);
    return pages;
  }

  return (
    <div className="admin-layout">
      <AdminNavigation
        mobileOpen={mobileMenuOpen}
        onMobileClose={() => setMobileMenuOpen(false)}
      />
      <div className="admin-main">
        <div className="admin-topbar">
          <AdminTopbarUser onMenuOpen={() => setMobileMenuOpen(true)} />
        </div>

        <section className="page-section">
          <div className="container-fluid">

            <div className="page-card">
              <h3 className="section-title mb-2">Claiming Schedule Management</h3>
              <p className="text-muted mb-0">
                Set the claiming dates, batches, lane capacities, and Late Claiming. Once activated, approved
                applicants are assigned to a lane and notified automatically, in real time, as they're approved —
                no separate publish step.
              </p>
            </div>

            {error && <div className="alert alert-danger">{error}</div>}
            {success && <div className="alert alert-success">{success}</div>}

            <div className="page-card">
              <h4 className="sub-title sub-title-dark">Schedule Summary</h4>
              {loading ? (
                <div className="text-center py-4"><div className="spinner-border text-danger" role="status" /></div>
              ) : !config ? (
                <div className="notice-box">No active application period found. Set up an application configuration first.</div>
              ) : (
                <>
                  {hasApproved ? (
                    <div className="schedule-notice schedule-notice-green">
                      <div className="schedule-notice-icon">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M20 6L9 17l-5-5" />
                        </svg>
                      </div>
                      <div>
                        {approvedCount} approved applicant(s) with assigned control numbers for {config.school_year}.
                        {isActive && unassignedApprovedCount > 0 && (
                          <> {unassignedApprovedCount} of them are still waiting on a lane (every lane was full when they were approved) — they'll be picked up automatically once room opens or you add more lanes.</>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="notice-box">
                      No approved applicants with assigned control numbers were found yet. You may still prepare the schedule, but activation won't assign anyone until applicants get approved.
                    </div>
                  )}
                  {isActive && (
                    <div className="schedule-notice schedule-notice-yellow mt-3">
                      <div className="schedule-notice-icon">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="3" y="11" width="18" height="11" rx="2" />
                          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                        </svg>
                      </div>
                      <div>
                        <strong>This schedule was activated on {new Date(schedule.activated_at).toLocaleString()}.</strong> Lane setup can no longer be edited — applicants are being assigned to it in real time.
                      </div>
                    </div>
                  )}
                  {schedule && (
                    // row-cols instead of a fixed col-md-3: Bootstrap divides
                    // the row evenly by however many columns are set at each
                    // breakpoint, so 5 cards wrap 3+2 (or however many fit)
                    // instead of 4 filling a row and stranding the 5th alone.
                    <div className="row g-3 mt-3 row-cols-2 row-cols-md-3 row-cols-lg-5">
                      {summaryItems.map(({ label, value }) => (
                        <div className="col" key={label}>
                          <div className="schedule-summary-card">
                            <h6 className="schedule-summary-label">{label}</h6>
                            <p className="schedule-summary-value">{value}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>

            {(loading || config) && (
              <div className="page-card">
                <h4 className="sub-title sub-title-dark">Create Claiming Schedule</h4>
                <div className="visibility-notice">
                  <div className="visibility-notice-icon">!</div>
                  <div className="visibility-notice-body">
                    <strong className="visibility-notice-title">Schedule Setup Notice</strong>
                    <p className="visibility-notice-text">
                      Add a card for each claiming day, toggle which sessions run that day (turn one off if you're
                      only doing mornings or afternoons), and add a lane for each verifier or station handling that
                      session. Every lane needs a real capacity — lanes fill in order (this lane's date, then the
                      next), and once one lane is full, newly-approved applicants move to the next.
                    </p>
                  </div>
                </div>

                {loading ? (
                  <div className="text-center py-4"><div className="spinner-border text-danger" role="status" /></div>
                ) : (
                  <form onSubmit={handleSubmit}>
                    <fieldset disabled={isActive}>
                      <div className="row g-3 mb-4">
                        <div className="col-md-6">
                          <label className="form-label">Claiming Location</label>
                          <input type="text" className="form-control" value={form.location} onChange={set("location")} required />
                        </div>
                        <div className="col-md-6">
                          <div className="mb-3">
                            <label className="form-label">Default Morning Session Time</label>
                            <div className="row g-2">
                              <div className="col-6">
                                <input type="time" className="form-control" value={form.morning_start} onChange={set("morning_start")} />
                              </div>
                              <div className="col-6">
                                <input type="time" className="form-control" value={form.morning_end} onChange={set("morning_end")} />
                              </div>
                            </div>
                          </div>
                          <div>
                            <label className="form-label">Default Afternoon Session Time</label>
                            <div className="row g-2">
                              <div className="col-6">
                                <input type="time" className="form-control" value={form.afternoon_start} onChange={set("afternoon_start")} />
                              </div>
                              <div className="col-6">
                                <input type="time" className="form-control" value={form.afternoon_end} onChange={set("afternoon_end")} />
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      <hr className="my-4" />
                      <h5 className="sub-title sub-title-dark mb-3" style={{ fontSize: "18px" }}>Scheduled Claiming</h5>

                      {days.map((day, dayIdx) => (
                        <div className="sub-card schedule-day-card mb-3" key={dayIdx}>
                          <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
                            <h6 className="sub-title-dark mb-0">Claiming Day {dayIdx + 1}</h6>
                            {!isActive && days.length > 1 && (
                              <button type="button" className="btn btn-outline-danger btn-sm" onClick={() => removeDay(dayIdx)}>
                                Remove Day
                              </button>
                            )}
                          </div>

                          <div className="row g-3 mb-3">
                            <div className="col-md-4">
                              <label className="form-label">Date</label>
                              <input
                                type="date"
                                className="form-control"
                                value={day.date}
                                onChange={(e) => setDayDate(dayIdx, e.target.value)}
                                min={config?.close_date ? nextDayStr(config.close_date.slice(0, 10)) : undefined}
                                required
                              />
                              {config?.close_date && (
                                <div className="form-text">
                                  Must be after the application period's closing date ({config.close_date.slice(0, 10)})
                                </div>
                              )}
                            </div>
                          </div>

                          {["morning", "afternoon"].map((session) => (
                            <div className="mb-3" key={session}>
                              <div className="form-check form-switch mb-2">
                                <input
                                  className="form-check-input"
                                  type="checkbox"
                                  id={`day-${dayIdx}-${session}`}
                                  checked={day[session].enabled}
                                  onChange={() => toggleSession(dayIdx, session)}
                                />
                                <label className="form-check-label fw-semibold" htmlFor={`day-${dayIdx}-${session}`}>
                                  {session === "morning"
                                    ? `Morning Session (${formatTime(form.morning_start)} – ${formatTime(form.morning_end)})`
                                    : `Afternoon Session (${formatTime(form.afternoon_start)} – ${formatTime(form.afternoon_end)})`}
                                </label>
                              </div>

                              {day[session].enabled && (
                                <div className="table-responsive">
                                  <table className="table table-sm table-bordered align-middle mb-2 announcement-table">
                                    <thead>
                                      <tr>
                                        <th>Lane / Station Name (optional)</th>
                                        <th style={{ width: "220px" }}>Capacity *</th>
                                        <th style={{ width: "220px" }}>Assigned Verifier</th>
                                        {!isActive && <th style={{ width: "90px" }}></th>}
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {day[session].lanes.map((lane, laneIdx) => (
                                        <tr key={laneIdx}>
                                          <td>
                                            <input
                                              type="text"
                                              className="form-control form-control-sm"
                                              placeholder={`Day ${dayIdx + 1} ${session === "morning" ? "Morning" : "Afternoon"} Lane ${laneIdx + 1}`}
                                              value={lane.lane_name}
                                              onChange={(e) => setLaneField(dayIdx, session, laneIdx, "lane_name", e.target.value)}
                                            />
                                          </td>
                                          <td>
                                            <input
                                              type="number"
                                              min="1"
                                              className="form-control form-control-sm"
                                              placeholder="Required"
                                              value={lane.capacity}
                                              onChange={(e) => setLaneField(dayIdx, session, laneIdx, "capacity", e.target.value)}
                                              required
                                            />
                                          </td>
                                          <td>
                                            <select
                                              className="form-select form-select-sm"
                                              value={lane.verifier_id}
                                              onChange={(e) => setLaneField(dayIdx, session, laneIdx, "verifier_id", e.target.value)}
                                            >
                                              <option value="">Unassigned</option>
                                              {verifiers.map((v) => (
                                                <option key={v.id} value={v.id}>
                                                  {v.first_name} {v.last_name}
                                                </option>
                                              ))}
                                            </select>
                                          </td>
                                          {!isActive && (
                                            <td>
                                              <button
                                                type="button"
                                                className="btn btn-outline-danger btn-sm"
                                                onClick={() => removeLane(dayIdx, session, laneIdx)}
                                                disabled={day[session].lanes.length === 1}
                                              >
                                                Remove
                                              </button>
                                            </td>
                                          )}
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>

                                  {!isActive && (
                                    <button
                                      type="button"
                                      className="btn btn-outline-custom btn-sm"
                                      onClick={() => addLane(dayIdx, session)}
                                    >
                                      + Add Lane
                                    </button>
                                  )}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      ))}

                      {!isActive && (
                        <button type="button" className="btn btn-outline-custom btn-sm mb-3" onClick={addDay}>
                          + Add Claiming Day
                        </button>
                      )}
                    </fieldset>

                    {!isActive && (
                      <div className="mt-4 d-flex justify-content-end gap-2 flex-wrap">
                        <button type="button" className="btn btn-secondary" onClick={handleReset}>
                          Clear
                        </button>
                        <button type="submit" className="btn btn-custom" disabled={saving}>
                          {saving ? "Saving..." : "Save Scheduled Claiming"}
                        </button>
                      </div>
                    )}

                    <hr className="my-4" />
                    <h5 className="sub-title sub-title-dark mb-3" style={{ fontSize: "18px" }}>Late Claiming</h5>

                    <div className="visibility-notice visibility-notice-compact mb-3">
                      <div className="visibility-notice-icon">!</div>
                      <div className="visibility-notice-body">
                        <p className="visibility-notice-text mb-0">
                          A second chance for applicants who missed their claiming day, and for anyone
                          promoted from the waitlist after this schedule was set up. Leave both dates blank
                          if this period won't have one.
                          {isActive && (
                            lateClaimingHasStarted
                              ? " Late Claiming has already started, so its start date is now locked — but you can still push the end date later to extend it."
                              : " Unlike the rest of this schedule, this can still be changed while the schedule is active — right up until Late Claiming actually starts."
                          )}
                        </p>
                      </div>
                    </div>

                    <div className="row g-3 mb-3">
                      <div className="col-md-6">
                        <fieldset disabled={lateClaimingHasStarted}>
                          <label className="form-label">Start Date</label>
                          <input
                            type="date"
                            className="form-control"
                            value={form.late_claiming_date}
                            onChange={set("late_claiming_date")}
                            min={latestClaimingDateStr ? nextDayStr(latestClaimingDateStr) : undefined}
                          />
                          {latestClaimingDateStr ? (
                            <div className="form-text">
                              Must be after {latestClaimingDateStr} — the latest claiming date entered above.
                            </div>
                          ) : (
                            <div className="form-text">
                              Enter at least one claiming day above first.
                            </div>
                          )}
                        </fieldset>
                      </div>
                      <div className="col-md-6">
                        <label className="form-label">End Date</label>
                        <input
                          type="date"
                          className="form-control"
                          value={form.late_claiming_end_date}
                          onChange={set("late_claiming_end_date")}
                          min={
                            lateClaimingHasStarted
                              ? (schedule?.late_claiming_end_date || form.late_claiming_date || undefined)
                              : (form.late_claiming_date || undefined)
                          }
                        />
                        {lateClaimingHasStarted && (
                          <div className="form-text">
                            Can only be moved later, not earlier, since Late Claiming has already started.
                          </div>
                        )}
                      </div>
                    </div>

                    {schedule && (
                      <div className="mt-4 d-flex justify-content-end gap-2 flex-wrap">
                        <button
                          type="button"
                          className="btn btn-custom"
                          disabled={savingLateClaiming}
                          onClick={handleSaveLateClaiming}
                        >
                          {savingLateClaiming ? "Saving..." : "Save Late Claiming"}
                        </button>
                      </div>
                    )}
                  </form>
                )}
              </div>
            )}

            {!loading && schedule && (
              <div className="page-card">
                <div className="d-flex justify-content-between align-items-center flex-wrap gap-2">
                  <h4 className="sub-title sub-title-dark mb-0">
                    {isActive ? "Lane Lists (live)" : "Planned Lanes"}
                  </h4>
                  <button className="btn btn-outline-custom btn-sm" onClick={() => loadSchedule(true)} disabled={refreshing}>
                    {refreshing ? "Refreshing..." : "Refresh"}
                  </button>
                </div>

                {!isActive && (
                  <div className="info-box mt-2">
                    Nobody is assigned yet — activate the schedule below to start assigning approved applicants to
                    these lanes automatically, in the order lanes are listed here.
                  </div>
                )}

                <div className="table-responsive mt-3">
                  <table className="table table-bordered table-striped align-middle announcement-table" style={{ tableLayout: "fixed" }}>
                    <colgroup>
                      <col style={{ width: "14%" }} />
                      <col style={{ width: "10%" }} />
                      <col style={{ width: "12%" }} />
                      <col style={{ width: "8%" }} />
                      <col style={{ width: "12%" }} />
                      <col style={{ width: "10%" }} />
                      <col style={{ width: "26%" }} />
                      {isActive && <col style={{ width: "8%" }} />}
                    </colgroup>

                    <thead>
                      <tr>
                        <th>Lane</th>
                        <th>Batch</th>
                        <th>Date</th>
                        <th>Capacity</th>
                        <th>Control Number Range</th>
                        <th>Assigned Applicants</th>
                        <th>Assigned Verifier</th>
                        {isActive && <th>Print</th>}
                      </tr>
                    </thead>

                    <tbody>
                      {pagedLanes.map((lane) => (
                        <tr key={lane.id}>
                          <td>{lane.lane_name}</td>
                          <td>{lane.batch === "morning" ? "Morning" : "Afternoon"}</td>
                          <td>{lane.claiming_date}</td>
                          <td>{lane.capacity ?? "—"}</td>
                          <td>{lane.control_number_range ?? "—"}</td>
                          <td>
                            {lane.assignments_count ?? 0}
                            {lane.capacity ? ` / ${lane.capacity}` : ""}
                          </td>
                          <td>
                            <select
                              className="form-select form-select-sm"
                              value={lane.verifier_id ?? ""}
                              onChange={(e) => requestAssignVerifier(lane, e.target.value)}
                              disabled={assigningLaneId === lane.id}
                            >
                              <option value="">Unassigned</option>
                              {verifiers.map((v) => (
                                <option key={v.id} value={v.id}>
                                  {v.first_name} {v.last_name}
                                </option>
                              ))}
                            </select>
                            {lane.requested_verifier_id && (
                              <div className="lane-request-notice">
                                <div className="lane-request-notice-icon">
                                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <circle cx="12" cy="12" r="9" />
                                    <polyline points="12 7 12 12 15 14" />
                                  </svg>
                                </div>
                                <div className="lane-request-notice-body">
                                  <span className="lane-request-notice-label">Lane Request</span>
                                  <p className="lane-request-notice-name">
                                    {lane.requested_verifier ? `${lane.requested_verifier.first_name} ${lane.requested_verifier.last_name}` : "A verifier"} wants this lane
                                  </p>
                                  <div className="lane-request-notice-actions">
                                    <button
                                      type="button"
                                      className="lane-request-action-btn lane-request-action-approve"
                                      disabled={assigningLaneId === lane.id}
                                      onClick={() => setLaneRequestActionTarget({
                                        type: "approve",
                                        laneId: lane.id,
                                        laneName: lane.lane_name,
                                        verifierId: lane.requested_verifier_id,
                                        verifierName: lane.requested_verifier ? `${lane.requested_verifier.first_name} ${lane.requested_verifier.last_name}` : "This verifier",
                                      })}
                                    >
                                      Approve
                                    </button>
                                    <button
                                      type="button"
                                      className="lane-request-action-btn lane-request-action-dismiss"
                                      disabled={assigningLaneId === lane.id}
                                      onClick={() => setLaneRequestActionTarget({
                                        type: "dismiss",
                                        laneId: lane.id,
                                        laneName: lane.lane_name,
                                        verifierName: lane.requested_verifier ? `${lane.requested_verifier.first_name} ${lane.requested_verifier.last_name}` : "This verifier",
                                      })}
                                    >
                                      Dismiss
                                    </button>
                                  </div>
                                </div>
                              </div>
                            )}
                          </td>
                          {isActive && (
                            <td>
                              <button
                                className="icon-btn icon-btn-green"
                                onClick={() => handlePrint(lane.id)}
                                title="Print Lane List"
                                aria-label="Print Lane List"
                              >
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <polyline points="6 9 6 2 18 2 18 9" />
                                  <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
                                  <rect x="6" y="14" width="12" height="8" />
                                </svg>
                              </button>
                            </td>
                          )}
                        </tr>
                      ))}
                      {pagedLanes.length === 0 && (
                        <tr>
                          <td colSpan={isActive ? 8 : 7} className="text-muted">
                            No lanes configured yet.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {displayedLanes.length > 0 && (
                  <div className="table-pagination-bar">
                    <span className="table-pagination-info">
                      Showing {lanePageStart + 1}–{Math.min(lanePageStart + lanePerPage, displayedLanes.length)} of {displayedLanes.length} lanes
                    </span>
                    <div className="table-pagination-controls">
                      <button
                        className="table-pagination-arrow"
                        onClick={() => goToLanePage(lanePage - 1)}
                        disabled={lanePage === 1}
                        aria-label="Previous page"
                      >
                        ‹
                      </button>

                      {getLanePageNumbers().map((page, idx) =>
                        page === "..." ? (
                          <span key={`ellipsis-${idx}`} className="table-pagination-ellipsis">…</span>
                        ) : (
                          <button
                            key={page}
                            className={`table-pagination-page ${page === lanePage ? "table-pagination-page-active" : ""}`}
                            onClick={() => goToLanePage(page)}
                          >
                            {page}
                          </button>
                        )
                      )}

                      <button
                        className="table-pagination-arrow"
                        onClick={() => goToLanePage(lanePage + 1)}
                        disabled={lanePage === laneTotalPages}
                        aria-label="Next page"
                      >
                        ›
                      </button>
                    </div>
                  </div>
                )}

                {!isActive && (
                  <>
                    <div className="mt-4 d-flex justify-content-end gap-2 flex-wrap">
                      <button className="btn btn-custom" onClick={handleActivate} disabled={activating}>
                        {activating ? "Activating..." : "Activate Schedule"}
                      </button>
                    </div>
                    <p className="text-muted small mt-2 mb-0 text-end">
                      Activating assigns any already-approved applicants immediately, then keeps assigning new
                      approvals automatically as verifiers process them.
                    </p>
                  </>
                )}
              </div>
            )}

            {schedule?.late_claiming_date && (
              <div className="page-card">
                <div className="d-flex justify-content-between align-items-center flex-wrap gap-2">
                  <h4 className="sub-title sub-title-dark mb-0">Late Claiming List</h4>
                  <div className="d-flex gap-2">
                    <button
                      className="btn btn-outline-custom btn-sm"
                      onClick={loadLateClaimingList}
                      disabled={loadingLateClaimingList}
                    >
                      {loadingLateClaimingList ? "Loading..." : "Refresh"}
                    </button>
                    <button type="button" className="btn btn-custom btn-sm" onClick={handleLateClaimingListExport}>
                      Print List
                    </button>
                  </div>
                </div>
                <p className="text-muted small mb-1">
                  Everyone expected during Late Claiming — original no-shows still eligible to retry, plus any applicants newly promoted from the waitlist. Updates live as claim statuses and promotions change.
                </p>
                <p className="text-muted small mb-3">
                  <strong>Scheduled Claiming:</strong> {formatDateRange(claimingDates)}
                  {" · "}
                  <strong>Late Claiming:</strong>{" "}
                  {schedule.late_claiming_end_date && schedule.late_claiming_end_date !== schedule.late_claiming_date
                    ? `${schedule.late_claiming_date} to ${schedule.late_claiming_end_date}`
                    : schedule.late_claiming_date}
                </p>
                <div className="table-responsive">
                  <table className="table table-bordered table-striped align-middle announcement-table">
                    <thead>
                      <tr>
                        <th style={{ width: "40px" }}>#</th>
                        <th>Control Number</th>
                        <th>Applicant Name</th>
                        <th style={{ width: "140px" }}>Type</th>
                      </tr>
                    </thead>
                    <tbody>
                      {lateClaimingList?.entries?.length > 0 ? (
                        lateClaimingList.entries.map((entry, i) => (
                          <tr key={`${entry.control_number}-${i}`}>
                            <td>{i + 1}</td>
                            <td>{entry.control_number}</td>
                            <td>{entry.name}</td>
                            <td>{entry.type}</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={4} className="text-muted">
                            {loadingLateClaimingList
                              ? "Loading..."
                              : latestClaimingDateStr && latestClaimingDateStr >= todayStr()
                                ? `Claiming days for this period run through ${latestClaimingDateStr} — Late Claiming eligibility (no-shows and waitlist promotions) can't be determined until they conclude.`
                                : "No applicants expected during Late Claiming for this period so far — this list updates live."}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

          </div>
        </section>

        <PanelFooter />
      </div>

      {removeDayTarget !== null && (
        <div className="modal fade show d-block" tabIndex="-1" style={{ background: "rgba(0,0,0,0.5)" }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Remove This Day?</h5>
                <button type="button" className="btn-close" onClick={() => setRemoveDayTarget(null)} />
              </div>
              <div className="modal-body">
                <p className="mb-0">Its date and lane setup for both sessions will be lost.</p>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setRemoveDayTarget(null)}>
                  Cancel
                </button>
                <button type="button" className="btn btn-danger" onClick={confirmRemoveDay}>
                  Yes, Remove
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {removeLaneTarget !== null && (
        <div className="modal fade show d-block" tabIndex="-1" style={{ background: "rgba(0,0,0,0.5)" }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Remove This Lane?</h5>
                <button type="button" className="btn-close" onClick={() => setRemoveLaneTarget(null)} />
              </div>
              <div className="modal-body">
                <p className="mb-0">Its name, capacity, and verifier assignment will be lost.</p>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setRemoveLaneTarget(null)}>
                  Cancel
                </button>
                <button type="button" className="btn btn-danger" onClick={confirmRemoveLane}>
                  Yes, Remove
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {assignVerifierTarget && (
        <div className="modal fade show d-block" tabIndex="-1" style={{ background: "rgba(0,0,0,0.5)" }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">
                  {assignVerifierTarget.verifierId ? "Assign This Verifier?" : "Unassign This Lane's Verifier?"}
                </h5>
                <button type="button" className="btn-close" onClick={() => setAssignVerifierTarget(null)} />
              </div>
              <div className="modal-body">
                <p className="mb-0">
                  {assignVerifierTarget.verifierId ? (
                    <>
                      {assignVerifierTarget.verifierName} will be assigned to {assignVerifierTarget.laneName}.
                      If they're already on another lane in this same session, they'll be removed from it.
                    </>
                  ) : (
                    <>{assignVerifierTarget.laneName} will be left without an assigned verifier.</>
                  )}
                </p>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setAssignVerifierTarget(null)}>
                  Cancel
                </button>
                <button type="button" className="btn btn-custom" onClick={confirmAssignVerifier}>
                  Confirm
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {laneRequestActionTarget && (
        <div className="modal fade show d-block" tabIndex="-1" style={{ background: "rgba(0,0,0,0.5)" }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">
                  {laneRequestActionTarget.type === "approve" ? "Approve This Lane Request?" : "Dismiss This Lane Request?"}
                </h5>
                <button type="button" className="btn-close" onClick={() => setLaneRequestActionTarget(null)} />
              </div>
              <div className="modal-body">
                <p className="mb-0">
                  {laneRequestActionTarget.type === "approve" ? (
                    <>
                      {laneRequestActionTarget.verifierName} will be assigned to {laneRequestActionTarget.laneName}.
                      If they're already on another lane in this same session, they'll be removed from it.
                    </>
                  ) : (
                    <>
                      {laneRequestActionTarget.verifierName}'s request for {laneRequestActionTarget.laneName} will be
                      dismissed. The lane's current verifier, if any, is left unchanged.
                    </>
                  )}
                </p>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setLaneRequestActionTarget(null)}>
                  Cancel
                </button>
                <button
                  type="button"
                  className={laneRequestActionTarget.type === "approve" ? "btn btn-custom" : "btn btn-danger"}
                  onClick={confirmLaneRequestAction}
                >
                  {laneRequestActionTarget.type === "approve" ? "Yes, Approve" : "Yes, Dismiss"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showResetConfirm && (
        <div className="modal fade show d-block" tabIndex="-1" style={{ background: "rgba(0,0,0,0.5)" }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Reset The Schedule Form?</h5>
                <button type="button" className="btn-close" onClick={() => setShowResetConfirm(false)} />
              </div>
              <div className="modal-body">
                <p className="mb-0">All days and lanes you've configured so far will be discarded.</p>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowResetConfirm(false)}>
                  Cancel
                </button>
                <button type="button" className="btn btn-danger" onClick={confirmReset}>
                  Yes, Reset
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showActivateConfirm && (
        <div className="modal fade show d-block" tabIndex="-1" style={{ background: "rgba(0,0,0,0.5)" }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Activate This Claiming Schedule?</h5>
                <button type="button" className="btn-close" onClick={() => setShowActivateConfirm(false)} disabled={activating} />
              </div>
              <div className="modal-body">
                <p className="mb-0">
                  From this point on, every newly-approved applicant is assigned to a lane and
                  notified automatically, and lane setup can no longer be edited.
                </p>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowActivateConfirm(false)} disabled={activating}>
                  Cancel
                </button>
                <button type="button" className="btn btn-custom" onClick={confirmActivate} disabled={activating}>
                  {activating ? "Activating..." : "Yes, Activate"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {announceNudge && (
        <div className="feedback-popup-backdrop">
          <div className="feedback-popup feedback-popup-success">
            <div className="feedback-popup-icon-wrap">
              <span className="feedback-popup-icon">✓</span>
            </div>
            <h4 className="feedback-popup-title">{announceNudge.title}</h4>
            <p className="feedback-popup-message">
              {announceNudge.message}
            </p>
            <div className="feedback-popup-confirm-actions">
              <button
                type="button"
                className="feedback-popup-cancel"
                onClick={() => setAnnounceNudge(null)}
              >
                Not Now
              </button>
              <button
                type="button"
                className="feedback-popup-proceed"
                onClick={goAnnounce}
              >
                Create Announcement
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminSchedule;