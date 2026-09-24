import { useState, useEffect } from "react";
import api from "../../services/api";

function formatCurrency(amount) {
    return "₱" + Number(amount ?? 0).toLocaleString("en-PH");
}

/* =========================
   SMALL UI ICONS
========================= */

function CalculatorIcon() {
    return (
        <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <rect x="4" y="2" width="16" height="20" rx="2" />
            <line x1="8" y1="6" x2="16" y2="6" />
            <line x1="8" y1="10" x2="8" y2="10" />
            <line x1="12" y1="10" x2="12" y2="10" />
            <line x1="16" y1="10" x2="16" y2="10" />
            <line x1="8" y1="14" x2="8" y2="14" />
            <line x1="12" y1="14" x2="12" y2="14" />
            <line x1="16" y1="14" x2="16" y2="14" />
            <line x1="8" y1="18" x2="16" y2="18" />
        </svg>
    );
}

function ChartIcon() {
    return (
        <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <line x1="4" y1="19" x2="20" y2="19" />
            <rect x="6" y="11" width="3" height="6" rx="1" />
            <rect x="11" y="7" width="3" height="10" rx="1" />
            <rect x="16" y="4" width="3" height="13" rx="1" />
        </svg>
    );
}

function UsersIcon() {
    return (
        <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
    );
}

function TrendIcon() {
    return (
        <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <polyline points="3 17 9 11 13 15 21 7" />
            <polyline points="15 7 21 7 21 13" />
        </svg>
    );
}

/* =========================
   COMPARISON BAR
========================= */

function CompareBar({ label, planned, reference, formatValue }) {
    const max = Math.max(planned, reference, 1);
    const plannedPct = Math.min(100, (planned / max) * 100);
    const referencePct = Math.min(100, (reference / max) * 100);

    const delta = planned - reference;

    const deltaLabel =
        delta === 0
            ? "same as last cycle"
            : `${delta > 0 ? "+" : ""}${formatValue(delta)} vs last cycle`;

    return (
        <div className="mb-4">
            <div className="d-flex justify-content-between small mb-2">
                <span style={{ color: "#333", fontWeight: 500 }}>{label}</span>

                <span
                    className={
                        delta > 0
                            ? "text-success"
                            : delta < 0
                                ? "text-danger"
                                : "text-muted"
                    }
                >
                    {deltaLabel}
                </span>
            </div>

            {/* Previous cycle */}
            <div
                style={{
                    height: 7,
                    background: "#edf0f3",
                    borderRadius: 10,
                    overflow: "hidden",
                    marginBottom: 5,
                }}
            >
                <div
                    style={{
                        width: `${referencePct}%`,
                        height: "100%",
                        background: "#aeb7c4",
                        borderRadius: 10,
                    }}
                />
            </div>

            {/* Current plan */}
            <div
                style={{
                    height: 7,
                    background: "#edf0f3",
                    borderRadius: 10,
                    overflow: "hidden",
                }}
            >
                <div
                    style={{
                        width: `${plannedPct}%`,
                        height: "100%",
                        background: "#b71c1c",
                        borderRadius: 10,
                    }}
                />
            </div>

            <div className="d-flex justify-content-between small text-muted mt-2">
                <span>Last cycle: {formatValue(reference)}</span>
                <span>This plan: {formatValue(planned)}</span>
            </div>
        </div>
    );
}

/* =========================
   UTILIZATION BAR
========================= */

function UtilizationBar({ percent }) {
    if (percent === null) return "—";

    return (
        <div style={{ minWidth: 100 }}>
            <div className="small mb-1">
                {percent.toFixed(1)}%
            </div>

            <div
                style={{
                    height: 6,
                    background: "#edf0f3",
                    borderRadius: 10,
                    overflow: "hidden",
                }}
            >
                <div
                    style={{
                        width: `${Math.min(100, percent)}%`,
                        height: "100%",
                        background: "#b71c1c",
                        borderRadius: 10,
                    }}
                />
            </div>
        </div>
    );
}

/* =========================
   CONFIDENCE RANGE BAR
========================= */

function ConfidenceRangeBar({ lower, upper, point }) {
    const margin = Math.max(upper - lower, 0.001);
    const domainLow = Math.max(0, lower - margin * 1.5);
    const domainHigh = Math.min(1, upper + margin * 1.5);
    const domainWidth = Math.max(domainHigh - domainLow, 0.001);

    const toPct = (v) =>
        Math.min(
            100,
            Math.max(0, ((v - domainLow) / domainWidth) * 100)
        );

    const bandLeft = toPct(lower);
    const bandWidth = toPct(upper) - bandLeft;
    const pointLeft = toPct(point);

    const fmtPct = (v) => `${(v * 100).toFixed(1)}%`;

    return (
        <div>
            <div
                style={{
                    position: "relative",
                    height: 10,
                    background: "#edf0f3",
                    borderRadius: 10,
                    overflow: "hidden",
                }}
            >
                <div
                    style={{
                        position: "absolute",
                        left: `${bandLeft}%`,
                        width: `${bandWidth}%`,
                        height: "100%",
                        background: "#f3b6b6",
                    }}
                />

                <div
                    style={{
                        position: "absolute",
                        left: `${pointLeft}%`,
                        top: -3,
                        width: 3,
                        height: 16,
                        marginLeft: -1.5,
                        background: "#b71c1c",
                        borderRadius: 2,
                    }}
                />
            </div>

            <div className="d-flex justify-content-between small text-muted mt-1">
                <span>{fmtPct(domainLow)}</span>
                <span style={{ color: "#b71c1c", fontWeight: 600 }}>
                    {fmtPct(point)} likely
                </span>
                <span>{fmtPct(domainHigh)}</span>
            </div>
        </div>
    );
}

/* =========================
   SUMMARY CARD
========================= */

function SummaryCard({ icon, value, label }) {
    return (
        <div
            style={{
                border: "1px solid #e1e5e9",
                borderRadius: "10px",
                padding: "20px",
                background: "#fff",
                height: "100%",
            }}
        >
            <div
                style={{
                    width: 38,
                    height: 38,
                    borderRadius: "8px",
                    background: "#fff1f2",
                    color: "#b71c1c",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    marginBottom: "12px",
                }}
            >
                {icon}
            </div>

            <div
                style={{
                    fontSize: "1.7rem",
                    fontWeight: 700,
                    color: "#111827",
                    lineHeight: 1.2,
                    marginBottom: "6px",
                }}
            >
                {value}
            </div>

            <div
                style={{
                    color: "#666",
                    fontSize: "13px",
                    lineHeight: 1.4,
                }}
            >
                {label}
            </div>
        </div>
    );
}

/* =========================
   MAIN COMPONENT
========================= */

function BudgetPlanningSection() {
    const [estimation, setEstimation] = useState(null);
    const [forecast, setForecast] = useState(null);
    const [lastCycle, setLastCycle] = useState(null);
    const [unmetDemand, setUnmetDemand] = useState(null);

    const [plannedBudget, setPlannedBudget] = useState("");
    const [plannedSlots, setPlannedSlots] = useState("");
    const [plannedAmount, setPlannedAmount] = useState("");

    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState(false);

    useEffect(() => {
        setLoading(true);
        setLoadError(false);

        Promise.all([
            api.get("/admin/reports/budget-estimation"),
            api.get("/admin/reports/budget-forecast"),
            api.get("/admin/reports/last-cycle-actuals"),
            api.get("/admin/reports/unmet-demand"),
        ])
            .then(([estRes, fcRes, lcRes, udRes]) => {
                setEstimation(estRes.data);
                setForecast(fcRes.data);
                setLastCycle(lcRes.data);
                setUnmetDemand(udRes.data);

                if (
                    lcRes.data.available &&
                    !lcRes.data.is_unlimited
                ) {
                    setPlannedBudget(
                        String(lcRes.data.total_budget_used)
                    );

                    setPlannedSlots(
                        String(lcRes.data.slot_limit)
                    );

                    setPlannedAmount(
                        String(lcRes.data.amount_per_student)
                    );
                }
            })
            .catch(() => setLoadError(true))
            .finally(() => setLoading(false));
    }, []);

    // Three fields, one constraint: Budget = Slots x Amount. Whichever
    // field the user just edited, we solve for the third field using
    // whichever of the OTHER two already has a value — so it works in
    // every direction (Budget+Amount -> Slots, Budget+Slots -> Amount,
    // Slots+Amount -> Budget), not just the one the field order happens
    // to favor.
    function handleBudgetChange(value) {
        setPlannedBudget(value);

        const budget = Number(value);
        const amount = Number(plannedAmount);
        const slots = Number(plannedSlots);

        if (budget > 0 && amount > 0) {
            setPlannedSlots(
                String(Math.floor(budget / amount))
            );
        } else if (budget > 0 && slots > 0) {
            setPlannedAmount(
                String(Math.round(budget / slots))
            );
        }
    }

    function handleSlotsChange(value) {
        setPlannedSlots(value);

        const slots = Number(value);
        const amount = Number(plannedAmount);
        const budget = Number(plannedBudget);

        if (slots > 0 && amount > 0) {
            setPlannedBudget(
                String(slots * amount)
            );
        } else if (slots > 0 && budget > 0) {
            setPlannedAmount(
                String(Math.round(budget / slots))
            );
        }
    }

    function handleAmountChange(value) {
        setPlannedAmount(value);

        const amount = Number(value);
        const slots = Number(plannedSlots);
        const budget = Number(plannedBudget);

        if (amount > 0 && slots > 0) {
            setPlannedBudget(
                String(slots * amount)
            );
        } else if (amount > 0 && budget > 0) {
            setPlannedSlots(
                String(Math.floor(budget / amount))
            );
        }
    }

    function loadLastCycleValues() {
        if (
            !lastCycle?.available ||
            lastCycle.is_unlimited
        ) {
            return;
        }

        setPlannedBudget(
            String(lastCycle.total_budget_used)
        );

        setPlannedSlots(
            String(lastCycle.slot_limit)
        );

        setPlannedAmount(
            String(lastCycle.amount_per_student)
        );
    }

    function clearPlanningFields() {
        setPlannedBudget("");
        setPlannedSlots("");
        setPlannedAmount("");
    }

    const est = estimation?.estimate ?? {};

    /* =========================
       LOADING
    ========================= */

    if (loading) {
        return (
            <div className="page-card">
                <div className="d-flex justify-content-center align-items-center py-5">
                    <div
                        className="spinner-border text-danger"
                        role="status"
                    />
                </div>
            </div>
        );
    }

    /* =========================
       ERROR
    ========================= */

    if (loadError) {
        return (
            <div className="page-card">
                <div className="alert alert-danger mb-0">
                    Couldn't load budget planning data.
                    Please refresh, or check the connection
                    to the reports service.
                </div>
            </div>
        );
    }

    return (
        <>
            {/* =====================================================
                BUDGET ALLOCATION PLANNING
            ===================================================== */}

            <div className="page-card">
                <div
                    className="d-flex justify-content-between align-items-start flex-wrap gap-3"
                    style={{
                        paddingBottom: "16px",
                        marginBottom: "18px",
                        borderBottom: "1px solid #e5e7eb",
                    }}
                >
                    <div className="d-flex align-items-center gap-3">
                        <div
                            style={{
                                width: 42,
                                height: 42,
                                borderRadius: "9px",
                                background: "#fff1f2",
                                color: "#b71c1c",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                flexShrink: 0,
                            }}
                        >
                            <CalculatorIcon />
                        </div>

                        <div>
                            <h4 className="sub-title mb-1">
                                Budget Allocation Planning
                            </h4>

                            <p className="text-muted small mb-0">
                                Set the budget, number of slots,
                                and assistance amount for the plan.
                            </p>
                        </div>
                    </div>

                    <div className="d-flex gap-2 flex-wrap">
                        {lastCycle?.available &&
                            !lastCycle.is_unlimited && (
                                <button
                                    type="button"
                                    className="btn btn-sm btn-outline-danger"
                                    onClick={loadLastCycleValues}
                                >
                                    Use Last Cycle's Numbers
                                </button>
                            )}

                        <button
                            type="button"
                            className="btn btn-sm btn-outline-secondary"
                            onClick={clearPlanningFields}
                        >
                            Clear
                        </button>
                    </div>
                </div>

                {lastCycle?.available && (
                    <div className="alert alert-primary py-2 mb-4">
                        <strong>
                            Last completed cycle (
                            {lastCycle.school_year}):
                        </strong>{" "}
                        {lastCycle.is_unlimited
                            ? "unlimited slots"
                            : `${lastCycle.slot_limit} slots at ${formatCurrency(
                                lastCycle.amount_per_student
                            )} each — total ${formatCurrency(
                                lastCycle.total_budget_used
                            )}`}
                    </div>
                )}

                {/* INPUTS */}

                <div className="row g-3 align-items-end">
                    <div className="col-md-4">
                        <label className="form-label fw-medium">
                            Total Allocated Budget
                        </label>

                        <div className="input-group input-group-lg">
                            <span
                                className="input-group-text"
                                style={{
                                    background: "#f8f9fa",
                                    borderColor: "#dfe3e8",
                                }}
                            >
                                ₱
                            </span>

                            <input
                                type="number"
                                min="0"
                                className="form-control"
                                value={plannedBudget}
                                onChange={(e) =>
                                    handleBudgetChange(
                                        e.target.value
                                    )
                                }
                                placeholder="0"
                            />
                        </div>
                    </div>

                    <div className="col-md-4">
                        <label className="form-label fw-medium">
                            Number of Slots
                        </label>

                        <input
                            type="number"
                            min="0"
                            className="form-control form-control-lg"
                            value={plannedSlots}
                            onChange={(e) =>
                                handleSlotsChange(
                                    e.target.value
                                )
                            }
                            placeholder="0"
                        />
                    </div>

                    <div className="col-md-4">
                        <label className="form-label fw-medium">
                            Amount per Student
                        </label>

                        <div className="input-group input-group-lg">
                            <span
                                className="input-group-text"
                                style={{
                                    background: "#f8f9fa",
                                    borderColor: "#dfe3e8",
                                }}
                            >
                                ₱
                            </span>

                            <input
                                type="number"
                                min="0"
                                className="form-control"
                                value={plannedAmount}
                                onChange={(e) =>
                                    handleAmountChange(
                                        e.target.value
                                    )
                                }
                                placeholder="0"
                            />
                        </div>
                    </div>
                </div>

                {/* PLAN SUMMARY */}

                {plannedBudget &&
                    plannedSlots &&
                    plannedAmount &&
                    lastCycle?.available &&
                    !lastCycle.is_unlimited && (
                        <div className="row g-4 mt-1">
                            <div className="col-md-6">
                                <CompareBar
                                    label="Slots"
                                    planned={Number(
                                        plannedSlots
                                    )}
                                    reference={
                                        lastCycle.slot_limit
                                    }
                                    formatValue={(v) =>
                                        Number(
                                            v
                                        ).toLocaleString()
                                    }
                                />
                            </div>

                            <div className="col-md-6">
                                <CompareBar
                                    label="Total Budget"
                                    planned={Number(
                                        plannedBudget
                                    )}
                                    reference={
                                        lastCycle.total_budget_used
                                    }
                                    formatValue={
                                        formatCurrency
                                    }
                                />
                            </div>
                        </div>
                    )}
            </div>

            {/* =====================================================
                BUDGET ANALYSIS
            ===================================================== */}

            <div className="page-card">
                <div
                    className="d-flex align-items-center gap-3"
                    style={{
                        paddingBottom: "16px",
                        marginBottom: "18px",
                        borderBottom: "1px solid #e5e7eb",
                    }}
                >
                    <div
                        style={{
                            width: 42,
                            height: 42,
                            borderRadius: "9px",
                            background: "#fff1f2",
                            color: "#b71c1c",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                        }}
                    >
                        <ChartIcon />
                    </div>

                    <div>
                        <h4 className="sub-title mb-1">
                            Budget Analysis
                        </h4>

                        <p className="text-muted small mb-0">
                            Historical allocation and disbursement
                            performance across application periods.
                        </p>
                    </div>
                </div>

                {!estimation?.historical?.length ? (
                    <div className="alert alert-info mb-0">
                        No application period data available yet.
                    </div>
                ) : (
                    <>
                        {(() => {
                            const completed =
                                estimation.historical.filter(
                                    (h) => !h.is_active
                                );

                            if (completed.length < 2)
                                return null;

                            const latest =
                                completed[
                                    completed.length - 1
                                ];

                            const previous =
                                completed[
                                    completed.length - 2
                                ];

                            const delta =
                                latest.approved_count -
                                previous.approved_count;

                            const deltaText =
                                delta === 0
                                    ? "same as"
                                    : `${delta > 0 ? "+" : ""}${delta} vs`;

                            return (
                                <div className="small text-muted mb-3">
                                    Latest completed cycle (
                                    {latest.school_year}):{" "}
                                    {latest.approved_count} funded —{" "}
                                    <span
                                        className={
                                            delta > 0
                                                ? "text-success"
                                                : delta < 0
                                                    ? "text-danger"
                                                    : ""
                                        }
                                    >
                                        {deltaText}{" "}
                                        {previous.school_year} (
                                        {previous.approved_count})
                                    </span>
                                </div>
                            );
                        })()}

                        {/* TABLE */}

                        <div className="table-responsive mb-4">
                            <table className="table table-bordered table-striped align-middle">
                                <thead>
                                    <tr>
                                        <th>School Year</th>
                                        <th>Slots Allocated</th>
                                        <th>Amount per Student</th>
                                        <th>Applicants Funded</th>
                                        <th>Slot Utilization</th>
                                        <th>Total Budget Allocated</th>
                                        <th>Total Disbursed</th>
                                        <th>Status</th>
                                    </tr>
                                </thead>

                                <tbody>
                                    {estimation.historical.map(
                                        (h) => {
                                            const allocated =
                                                h.is_unlimited
                                                    ? null
                                                    : h.slot_limit;

                                            const funded =
                                                h.approved_count ??
                                                0;

                                            const amountPerStudent =
                                                est.assistance_per_applicant ??
                                                2000;

                                            const utilization =
                                                allocated
                                                    ? (funded /
                                                        allocated) *
                                                    100
                                                    : null;

                                            const totalBudgetAllocated =
                                                allocated
                                                    ? allocated *
                                                    amountPerStudent
                                                    : null;

                                            return (
                                                <tr
                                                    key={
                                                        h.config_id
                                                    }
                                                    className={
                                                        h.is_active
                                                            ? "table-active"
                                                            : undefined
                                                    }
                                                >
                                                    <td>
                                                        {
                                                            h.school_year
                                                        }
                                                    </td>

                                                    <td>
                                                        {allocated ??
                                                            "Unlimited"}
                                                    </td>

                                                    <td>
                                                        {formatCurrency(
                                                            amountPerStudent
                                                        )}
                                                    </td>

                                                    <td>
                                                        {funded}
                                                    </td>

                                                    <td>
                                                        <UtilizationBar
                                                            percent={
                                                                utilization
                                                            }
                                                        />
                                                    </td>

                                                    <td>
                                                        {totalBudgetAllocated !==
                                                            null
                                                            ? formatCurrency(
                                                                totalBudgetAllocated
                                                            )
                                                            : "Unlimited"}
                                                    </td>

                                                    <td>
                                                        {formatCurrency(
                                                            h.estimated_disbursement
                                                        )}
                                                    </td>

                                                    <td>
                                                        {h.is_active ? (
                                                            <span className="badge bg-success">
                                                                Active
                                                            </span>
                                                        ) : (
                                                            <span className="badge bg-secondary">
                                                                Completed
                                                            </span>
                                                        )}
                                                    </td>
                                                </tr>
                                            );
                                        }
                                    )}
                                </tbody>
                            </table>
                        </div>

                        {/* SUMMARY CARDS */}

                        <div className="row g-3">
                            <div className="col-md-6">
                                <SummaryCard
                                    icon={<UsersIcon />}
                                    value={
                                        est.average_approved_count ??
                                        0
                                    }
                                    label="Avg. Applicants Funded per Period (Historical)"
                                />
                            </div>

                            <div className="col-md-6">
                                <SummaryCard
                                    icon={<TrendIcon />}
                                    value={formatCurrency(
                                        (est.average_approved_count ??
                                            0) *
                                        (est.assistance_per_applicant ??
                                            2000)
                                    )}
                                    label="Average Disbursement per Period (Historical)"
                                />
                            </div>
                        </div>
                    </>
                )}
            </div>

            {/* =====================================================
                UNMET DEMAND TRACKER
            ===================================================== */}

            <div className="page-card">
                <div
                    className="d-flex align-items-center gap-3"
                    style={{
                        paddingBottom: "16px",
                        marginBottom: "18px",
                        borderBottom: "1px solid #e5e7eb",
                    }}
                >
                    <div
                        style={{
                            width: 42,
                            height: 42,
                            borderRadius: "9px",
                            background: "#fff1f2",
                            color: "#b71c1c",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                        }}
                    >
                        <UsersIcon />
                    </div>

                    <div>
                        <h4 className="sub-title mb-1">
                            Unmet Demand Tracker
                        </h4>

                        <p className="text-muted small mb-0">
                            Applicants who qualified but could not
                            be given a slot.
                        </p>
                    </div>
                </div>

                {!unmetDemand?.trend?.length ? (
                    <div className="alert alert-info mb-0">
                        No application period data available yet.
                    </div>
                ) : (
                    <div className="table-responsive">
                        <table className="table table-bordered table-striped align-middle mb-0">
                            <thead>
                                <tr>
                                    <th>School Year</th>
                                    <th>Applicants Funded</th>
                                    <th>Unmet Demand</th>
                                    <th>Unmet Demand ÷ Funded</th>
                                    <th>Status</th>
                                </tr>
                            </thead>

                            <tbody>
                                {unmetDemand.trend.map(
                                    (row) => (
                                        <tr
                                            key={
                                                row.config_id
                                            }
                                            className={
                                                row.is_active
                                                    ? "table-active"
                                                    : undefined
                                            }
                                        >
                                            <td>
                                                {row.school_year}
                                            </td>

                                            <td>
                                                {row.approved}
                                            </td>

                                            <td>
                                                {row.unmet_demand}
                                            </td>

                                            <td>
                                                {row.ratio !== null
                                                    ? `${row.ratio}%`
                                                    : "—"}
                                            </td>

                                            <td>
                                                {row.is_active ? (
                                                    <span className="badge bg-success">
                                                        Active
                                                    </span>
                                                ) : (
                                                    <span className="badge bg-secondary">
                                                        Completed
                                                    </span>
                                                )}
                                            </td>
                                        </tr>
                                    )
                                )}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* =====================================================
                BUDGET FORECAST
            ===================================================== */}

            <div className="page-card">
                <div
                    className="d-flex align-items-center gap-3"
                    style={{
                        paddingBottom: "16px",
                        marginBottom: "18px",
                        borderBottom:
                            "1px solid #e5e7eb",
                    }}
                >
                    <div
                        style={{
                            width: 42,
                            height: 42,
                            borderRadius: "9px",
                            background: "#fff1f2",
                            color: "#b71c1c",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                        }}
                    >
                        <TrendIcon />
                    </div>

                    <div>
                        <h4 className="sub-title mb-1">
                            Budget Forecast
                        </h4>

                        <p className="text-muted small mb-0">
                            Statistical reference for future
                            budget planning.
                        </p>
                    </div>
                </div>

                {!forecast?.available ? (
                    <div className="alert alert-info mb-0">
                        {forecast?.message ??
                            "Loading..."}
                    </div>
                ) : (
                    <>
                        {forecast.periods_used < 3 && (
                            <div className="text-muted small mb-3">
                                With only{" "}
                                {forecast.periods_used} completed
                                period(s) on record, this range
                                will narrow as more periods
                                complete.
                            </div>
                        )}

                        {/* HERO PROJECTION PANEL */}
                        <div
                            style={{
                                border: "1px solid #e1e5e9",
                                borderLeft: "4px solid #b71c1c",
                                borderRadius: "9px",
                                padding: "20px 22px",
                                background: "#fff",
                                marginBottom: "18px",
                            }}
                        >
                            <div
                                className="text-muted small text-uppercase mb-2"
                                style={{ letterSpacing: "0.04em" }}
                            >
                                Projected Approved Applicants — Next Cycle
                            </div>

                            <div className="d-flex align-items-baseline gap-3 flex-wrap mb-1">
                                <span
                                    style={{
                                        fontSize: "2rem",
                                        fontWeight: 700,
                                        color: "#111827",
                                        lineHeight: 1,
                                    }}
                                >
                                    {
                                        forecast
                                            .projected_approved_range
                                            .lower
                                    }
                                    {" – "}
                                    {
                                        forecast
                                            .projected_approved_range
                                            .upper
                                    }
                                </span>

                                <span className="text-muted">
                                    applicants out of ~
                                    {forecast.projected_volume}{" "}
                                    expected submissions
                                </span>
                            </div>

                            <div
                                className="mb-4"
                                style={{
                                    fontSize: "1.05rem",
                                    fontWeight: 600,
                                    color: "#b71c1c",
                                }}
                            >
                                {formatCurrency(
                                    forecast
                                        .projected_budget_range
                                        .lower
                                )}{" "}
                                –{" "}
                                {formatCurrency(
                                    forecast
                                        .projected_budget_range
                                        .upper
                                )}
                            </div>

                            <div
                                className="text-muted small mb-2"
                                style={{ fontWeight: 500 }}
                            >
                                Historical approval rate (95%
                                confidence range)
                            </div>

                            <ConfidenceRangeBar
                                lower={
                                    forecast.confidence_interval
                                        .lower
                                }
                                upper={
                                    forecast.confidence_interval
                                        .upper
                                }
                                point={forecast.point_estimate_rate}
                            />
                        </div>

                        {/* SUPPORTING STATS */}
                        <div className="row g-3">
                            <div className="col-md-4">
                                <SummaryCard
                                    icon={<ChartIcon />}
                                    value={`${(
                                        forecast.point_estimate_rate *
                                        100
                                    ).toFixed(1)}%`}
                                    label="Historical Approval Rate"
                                />
                            </div>

                            <div className="col-md-4">
                                <SummaryCard
                                    icon={<UsersIcon />}
                                    value={forecast.pooled_total_submitted.toLocaleString()}
                                    label="Total Applications Analyzed"
                                />
                            </div>

                            <div className="col-md-4">
                                <SummaryCard
                                    icon={<TrendIcon />}
                                    value={forecast.periods_used}
                                    label="Completed Periods Pooled"
                                />
                            </div>
                        </div>
                    </>
                )}
            </div>

            {/* =====================================================
                BACK TO REPORTS
            ===================================================== */}

            <div className="page-card">
                <a
                    href="/AdminReports"
                    className="btn btn-custom"
                >
                    ← Back to Reports
                </a>
            </div>

        </>
    );
}

export default BudgetPlanningSection;