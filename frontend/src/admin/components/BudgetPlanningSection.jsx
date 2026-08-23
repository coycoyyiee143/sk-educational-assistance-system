import { useState, useEffect } from "react";
import api from "../../services/api";
function formatCurrency(amount) {
    return "₱" + Number(amount ?? 0).toLocaleString("en-PH");
}
function MethodologyNote({ children }) {
    return <div className="info-box">{children}</div>;
}
function CompareBar({ label, planned, reference, formatValue }) {
    const max = Math.max(planned, reference, 1);
    const plannedPct = Math.min(100, (planned / max) * 100);
    const referencePct = Math.min(100, (reference / max) * 100);
    const delta = planned - reference;
    const deltaLabel =
        delta === 0 ? "same as last cycle" : `${delta > 0 ? "+" : ""}${formatValue(delta)} vs last cycle`;
    return (
        <div className="mb-3">
            <div className="d-flex justify-content-between small text-muted mb-1">
                <span>{label}</span>
                <span className={delta > 0 ? "text-success" : delta < 0 ? "text-danger" : ""}>{deltaLabel}</span>
            </div>
            <div className="mb-1" style={{ height: 8, background: "#f1e3e3", borderRadius: 4, overflow: "hidden" }}>
                <div style={{ width: `${referencePct}%`, height: "100%", background: "#c9a3a3" }} />
            </div>
            <div style={{ height: 8, background: "#f1e3e3", borderRadius: 4, overflow: "hidden" }}>
                <div style={{ width: `${plannedPct}%`, height: "100%", background: "#a33636" }} />
            </div>
            <div className="d-flex justify-content-between small text-muted mt-1">
                <span>Last cycle: {formatValue(reference)}</span>
                <span>This plan: {formatValue(planned)}</span>
            </div>
        </div>
    );
}
function UtilizationBar({ percent }) {
    if (percent === null) return "—";
    const color = percent >= 80 ? "#2e7d32" : percent >= 50 ? "#c9a227" : "#a33636";
    return (
        <div style={{ minWidth: 90 }}>
            <div className="small mb-1">{percent.toFixed(1)}%</div>
            <div style={{ height: 6, background: "#f1e3e3", borderRadius: 3, overflow: "hidden" }}>
                <div style={{ width: `${Math.min(100, percent)}%`, height: "100%", background: color }} />
            </div>
        </div>
    );
}
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
    const [showInfo, setShowInfo] = useState(false);
    const [showForecastCard, setShowForecastCard] = useState(false);
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
                if (lcRes.data.available && !lcRes.data.is_unlimited) {
                    setPlannedBudget(String(lcRes.data.total_budget_used));
                    setPlannedSlots(String(lcRes.data.slot_limit));
                    setPlannedAmount(String(lcRes.data.amount_per_student));
                }
            })
            .catch(() => setLoadError(true))
            .finally(() => setLoading(false));
    }, []);
    function handleBudgetChange(value) {
        setPlannedBudget(value);
        const budget = Number(value);
        const amount = Number(plannedAmount);
        if (budget > 0 && amount > 0) setPlannedSlots(String(Math.floor(budget / amount)));
    }
    function handleSlotsChange(value) {
        setPlannedSlots(value);
        const budget = Number(plannedBudget);
        const slots = Number(value);
        if (budget > 0 && slots > 0) setPlannedAmount(String(Math.round(budget / slots)));
    }
    function handleAmountChange(value) {
        setPlannedAmount(value);
        const budget = Number(plannedBudget);
        const amount = Number(value);
        if (budget > 0 && amount > 0) setPlannedSlots(String(Math.floor(budget / amount)));
    }
    function loadLastCycleValues() {
        if (!lastCycle?.available || lastCycle.is_unlimited) return;
        setPlannedBudget(String(lastCycle.total_budget_used));
        setPlannedSlots(String(lastCycle.slot_limit));
        setPlannedAmount(String(lastCycle.amount_per_student));
    }
    function clearPlanningFields() {
        setPlannedBudget("");
        setPlannedSlots("");
        setPlannedAmount("");
    }
    const est = estimation?.estimate ?? {};
    if (loading) {
        return (
            <div className="page-card">
                <h4 className="sub-title">Budget Planning</h4>
                <div className="spinner-border spinner-border-sm text-danger" role="status" />
            </div>
        );
    }
    if (loadError) {
        return (
            <div className="page-card">
                <h4 className="sub-title">Budget Planning</h4>
                <div className="alert alert-danger mb-0">
                    Couldn't load budget planning data. Please refresh, or check the connection to the reports service.
                </div>
            </div>
        );
    }
    return (
        <>
            {/* Budget Allocation Planning */}
            <div className="page-card">
                <div className="d-flex justify-content-between align-items-start flex-wrap gap-2 mb-2">
                    <h4 className="sub-title mb-0">Budget Allocation Planning</h4>
                    <div className="d-flex gap-2">
                        {lastCycle?.available && !lastCycle.is_unlimited && (
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
                {showInfo && (
                    <MethodologyNote>
                        A decision-support calculator, not a forecast — works entirely off a budget figure SK
                        provides directly. No historical applicant data needed.
                        <br /><br />
                        <strong>Needs SK/real data?</strong> No.{" "}
                        <strong>Statistical claim?</strong> None, and it doesn't make one.{" "}
                        <strong>Status:</strong> Usable today, regardless of system history.
                    </MethodologyNote>
                )}
                {lastCycle?.available && (
                    <div className="alert alert-primary py-2 mb-3">
                        <strong>Last completed cycle ({lastCycle.school_year}):</strong>{" "}
                        {lastCycle.is_unlimited
                            ? "unlimited slots"
                            : `${lastCycle.slot_limit} slots at ${formatCurrency(lastCycle.amount_per_student)} each — total ${formatCurrency(lastCycle.total_budget_used)}`}
                    </div>
                )}
                <div className="row g-3 align-items-end mb-3">
                    <div className="col-md-4">
                        <label className="form-label">Total Allocated Budget</label>
                        <div className="input-group input-group-lg">
                            <span className="input-group-text">₱</span>
                            <input
                                type="number"
                                min="0"
                                className="form-control"
                                value={plannedBudget}
                                onChange={(e) => handleBudgetChange(e.target.value)}
                                placeholder="0"
                            />
                        </div>
                    </div>
                    <div className="col-md-4">
                        <label className="form-label">Number of Slots</label>
                        <input
                            type="number"
                            min="0"
                            className="form-control form-control-lg"
                            value={plannedSlots}
                            onChange={(e) => handleSlotsChange(e.target.value)}
                            placeholder="0"
                        />
                    </div>
                    <div className="col-md-4">
                        <label className="form-label">Amount per Student</label>
                        <div className="input-group input-group-lg">
                            <span className="input-group-text">₱</span>
                            <input
                                type="number"
                                min="0"
                                className="form-control"
                                value={plannedAmount}
                                onChange={(e) => handleAmountChange(e.target.value)}
                                placeholder="0"
                            />
                        </div>
                    </div>
                </div>
                {plannedBudget && plannedSlots && plannedAmount && (
                    <>
                        <div
                            className="p-3 mb-3"
                            style={{ background: "#fdf2f2", borderRadius: 8, borderLeft: "4px solid #a33636" }}
                        >
                            <div className="text-muted small mb-1">This plan</div>
                            <div style={{ fontSize: "1.4rem", fontWeight: 600 }}>
                                {Number(plannedSlots).toLocaleString()} slots at {formatCurrency(plannedAmount)} each
                            </div>
                            <div className="text-muted">
                                Total: <strong>{formatCurrency(plannedBudget)}</strong>
                            </div>
                        </div>
                        {lastCycle?.available && !lastCycle.is_unlimited && (
                            <div className="row g-4">
                                <div className="col-md-6">
                                    <CompareBar
                                        label="Slots"
                                        planned={Number(plannedSlots)}
                                        reference={lastCycle.slot_limit}
                                        formatValue={(v) => Number(v).toLocaleString()}
                                    />
                                </div>
                                <div className="col-md-6">
                                    <CompareBar
                                        label="Total Budget"
                                        planned={Number(plannedBudget)}
                                        reference={lastCycle.total_budget_used}
                                        formatValue={formatCurrency}
                                    />
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* Budget Analysis — purely descriptive */}
            <div className="page-card">
                <h4 className="sub-title">Budget Analysis</h4>
                {showInfo && (
                    <MethodologyNote>
                        A historical funds ledger and plain average — shows what was allocated and actually
                        spent in past periods. Nothing here projects forward; every figure describes a
                        period that already happened.
                        <br /><br />
                        <strong>Why no pass rate?</strong> A pass/approval rate needs total submissions
                        (approved + rejected) as a denominator, which SK doesn't track yet. Slot Utilization
                        below is different — it's funded applicants ÷ slots SK itself allocated, so it only
                        needs numbers SK has always had.
                        <br /><br />
                        <strong>Needs SK/real data?</strong> Yes — becomes more reliable as more completed
                        cycles run on this system.<br />
                        <strong>Statistical claim?</strong> None — plain arithmetic.<br />
                        <strong>Status:</strong> Mechanism ready today; output grows more meaningful as real cycles accumulate.
                    </MethodologyNote>
                )}
                {!estimation?.historical?.length ? (
                    <div className="alert alert-info mb-0">No application period data available yet.</div>
                ) : (
                    <>
                        {(() => {
                            const completed = estimation.historical.filter((h) => !h.is_active);
                            if (completed.length < 2) return null;
                            const latest = completed[completed.length - 1];
                            const previous = completed[completed.length - 2];
                            const delta = latest.approved_count - previous.approved_count;
                            const deltaText =
                                delta === 0
                                    ? "same as"
                                    : `${delta > 0 ? "+" : ""}${delta} vs`;
                            return (
                                <div className="small text-muted mb-3">
                                    Latest completed cycle ({latest.school_year}): {latest.approved_count} funded —{" "}
                                    <span className={delta > 0 ? "text-success" : delta < 0 ? "text-danger" : ""}>
                                        {deltaText} {previous.school_year} ({previous.approved_count})
                                    </span>
                                </div>
                            );
                        })()}
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
                                    {estimation.historical.map((h) => {
                                        const allocated = h.is_unlimited ? null : h.slot_limit;
                                        const funded = h.approved_count ?? 0;
                                        const amountPerStudent = est.assistance_per_applicant ?? 2000;
                                        const utilization = allocated ? (funded / allocated) * 100 : null;
                                        const totalBudgetAllocated = allocated ? allocated * amountPerStudent : null;
                                        return (
                                            <tr
                                                key={h.config_id}
                                                className={h.is_active ? "table-active" : undefined}
                                            >
                                                <td>{h.school_year}</td>
                                                <td>{allocated ?? "Unlimited"}</td>
                                                <td>{formatCurrency(amountPerStudent)}</td>
                                                <td>{funded}</td>
                                                <td><UtilizationBar percent={utilization} /></td>
                                                <td>{totalBudgetAllocated !== null ? formatCurrency(totalBudgetAllocated) : "Unlimited"}</td>
                                                <td>{formatCurrency(h.estimated_disbursement)}</td>
                                                <td>
                                                    {h.is_active
                                                        ? <span className="badge bg-success">Active</span>
                                                        : <span className="badge bg-secondary">Completed</span>}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                        <div className="row g-4">
                            <div className="col-md-6">
                                <div className="summary-card">
                                    <h2>{est.average_approved_count ?? 0}</h2>
                                    <p>Avg. Applicants Funded per Period (Historical)</p>
                                </div>
                            </div>
                            <div className="col-md-6">
                                <div className="summary-card">
                                    <h2>
                                        {formatCurrency(
                                            (est.average_approved_count ?? 0) * (est.assistance_per_applicant ?? 2000)
                                        )}
                                    </h2>
                                    <p>Average Disbursement per Period (Historical)</p>
                                </div>
                            </div>
                        </div>
                    </>
                )}
            </div>

            {/* Unmet Demand Tracker — descriptive, made possible by the waitlist feature */}
            <div className="page-card">
                <h4 className="sub-title">Unmet Demand Tracker</h4>
                {showInfo && (
                    <MethodologyNote>
                        Counts applicants who passed every eligibility check but couldn't be given a slot —
                        made visible for the first time by the waitlist feature. This is a{" "}
                        <strong>lower bound</strong>, not the true demand: some qualified applicants likely
                        never apply at all once slots are known to be full, so they never appear anywhere in
                        this data.
                        <br /><br />
                        The Waitlisted ÷ Funded ratio is the same idea used elsewhere as a "waitlist-to-admit
                        ratio" or oversubscription rate — it normalizes for program size, so a small waitlist
                        in a large program and the same waitlist in a small program don't look identical when
                        they represent very different pressure.
                        <br /><br />
                        <strong>Periods before this feature existed will show 0 waitlisted</strong> — not
                        because unmet demand didn't happen then, but because the system had no way to
                        observe it at the time.
                        <br /><br />
                        <strong>Needs SK/real data?</strong> No — generated automatically as applicants use
                        the system.{" "}
                        <strong>Statistical claim?</strong> None — a direct observed count, not an
                        estimate.{" "}
                        <strong>Status:</strong> Usable from this cycle onward; historical periods are
                        blank by definition, not by omission.
                    </MethodologyNote>
                )}
                {!unmetDemand?.trend?.length ? (
                    <div className="alert alert-info mb-0">No application period data available yet.</div>
                ) : (
                    <div className="table-responsive">
                        <table className="table table-bordered table-striped align-middle mb-0">
                            <thead>
                                <tr>
                                    <th>School Year</th>
                                    <th>Applicants Funded</th>
                                    <th>Waitlisted (Unmet Demand)</th>
                                    <th>Waitlisted ÷ Funded</th>
                                    <th>Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {unmetDemand.trend.map((row) => (
                                    <tr key={row.config_id} className={row.is_active ? "table-active" : undefined}>
                                        <td>{row.school_year}</td>
                                        <td>{row.approved}</td>
                                        <td>{row.waitlisted}</td>
                                        <td>{row.ratio !== null ? `${row.ratio}%` : "—"}</td>
                                        <td>
                                            {row.is_active
                                                ? <span className="badge bg-success">Active</span>
                                                : <span className="badge bg-secondary">Completed</span>}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {showForecastCard && (
                <div className="page-card">
                    <h4 className="sub-title">Budget Forecast</h4>
                    {showInfo && (
                        <MethodologyNote>
                            A genuine statistical forecast of the <strong>approval rate</strong> — the one number
                            here unaffected by unmet demand, so it's valid to project with a confidence interval.
                            Applicant volume below is still a plain average, not a forecast — the budget range
                            shown reflects rate uncertainty only.
                            <br /><br />
                            <strong>What the range means:</strong> based on {forecast?.pooled_total_submitted ?? "—"}{" "}
                            historical applicants, we're 95% confident the <em>true</em> approval rate falls
                            somewhere between the lower and upper bound shown below — not that it's exactly one number.
                            <br /><br />
                            <strong>Needs SK/real data?</strong> Yes.{" "}
                            <strong>Statistical claim?</strong> Yes — the only genuinely statistical projection of the three.{" "}
                            <strong>Status:</strong> Mechanism correct today; range narrows as real data accumulates.
                        </MethodologyNote>
                    )}
                    {!forecast?.available ? (
                        <div className="alert alert-info mb-0">{forecast?.message ?? "Loading..."}</div>
                    ) : (
                        <>
                            <div className="alert alert-secondary mb-3">
                                This tool isn't ready to guide a real budget decision yet. With only{" "}
                                {forecast.periods_used} completed period(s) on record, any statistically valid
                                range is too wide to be useful — it would tell you almost nothing more specific
                                than "somewhere between very few and very many."
                            </div>
                            <div className="alert alert-primary py-3 mb-3">
                                <strong>Projected Approved Applicants Next Cycle:</strong>{" "}
                                <span style={{ fontSize: "1.3rem", fontWeight: 600 }}>
                                    {forecast.projected_approved_range.lower} – {forecast.projected_approved_range.upper}
                                </span>
                                <div className="text-muted small mt-1">
                                    {formatCurrency(forecast.projected_budget_range.lower)} –{" "}
                                    {formatCurrency(forecast.projected_budget_range.upper)}, assuming a fixed volume
                                    assumption of ~{forecast.projected_volume} applicants (plain average, not a range)
                                    at {formatCurrency(forecast.assistance_per_applicant)} each.
                                </div>
                            </div>
                            <div className="row g-3">
                                <div className="col-md-6">
                                    <div className="summary-card">
                                        <h2>{(forecast.point_estimate_rate * 100).toFixed(1)}%</h2>
                                        <p>Historical Approval Rate</p>
                                    </div>
                                </div>
                                <div className="col-md-6">
                                    <div className="summary-card">
                                        <h2>
                                            {(forecast.confidence_interval.lower * 100).toFixed(1)}%
                                            {" – "}
                                            {(forecast.confidence_interval.upper * 100).toFixed(1)}%
                                        </h2>
                                        <p>Likely Range (95% Confidence)</p>
                                    </div>
                                </div>
                            </div>
                            <div className="text-muted small mt-3 mb-3">
                                Based on {forecast.pooled_approved} approved out of {forecast.pooled_total_submitted} total
                                submissions, pooled across {forecast.periods_used} completed period(s). Range width:{" "}
                                {((forecast.confidence_interval.upper - forecast.confidence_interval.lower) * 100).toFixed(1)}{" "}
                                percentage points — this narrows as more completed cycles run on this system.
                            </div>
                            <div
                                className="p-3"
                                style={{ background: "#fff8e6", borderRadius: 8, borderLeft: "4px solid #c9a227" }}
                            >
                                For a number you can actually act on today, use{" "}
                                <strong>Budget Analysis</strong> or <strong>Budget Allocation Planning</strong>{" "}
                                instead — this range is shown for reference and future use, not as a current
                                budgeting input.
                            </div>
                        </>
                    )}
                </div>
            )}

            <div className="page-card">
                <div className="d-flex justify-content-start flex-wrap gap-3">
                    <a href="/AdminReports" className="btn btn-custom">← Back to Reports</a>
                </div>
            </div>
            <div className="d-flex justify-content-end mb-2">
                <button
                    type="button"
                    className="btn btn-sm btn-link text-muted text-decoration-none p-0"
                    onClick={() => setShowInfo((v) => !v)}
                    style={{ fontSize: "2px", whiteSpace: "nowrap" }}
                >
                    {showInfo ? "Hide" : "Show"}
                </button>
                <button
                    type="button"
                    className="btn btn-sm btn-link text-muted text-decoration-none p-0"
                    onClick={() => setShowForecastCard((v) => !v)}
                    style={{ fontSize: "2px", whiteSpace: "nowrap" }}
                >
                    {showForecastCard ? "hbf" : "sbf"}
                </button>
            </div>
        </>
    );
}
export default BudgetPlanningSection;