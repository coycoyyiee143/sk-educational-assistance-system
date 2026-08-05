import { useState, useEffect } from "react";
import api from "../../services/api";

function formatCurrency(amount) {
    return "₱" + Number(amount ?? 0).toLocaleString("en-PH");
}

function BudgetPlanningSection() {

    const [estimation, setEstimation] = useState(null);
    const [forecast, setForecast] = useState(null);
    const [lastCycle, setLastCycle] = useState(null);
    const [plannedBudget, setPlannedBudget] = useState("");
    const [plannedSlots, setPlannedSlots] = useState("");
    const [plannedAmount, setPlannedAmount] = useState("");
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        setLoading(true);
        Promise.all([
            api.get("/admin/reports/budget-estimation"),
            api.get("/admin/reports/budget-forecast"),
            api.get("/admin/reports/last-cycle-actuals"),
        ]).then(([estRes, fcRes, lcRes]) => {
            setEstimation(estRes.data);
            setForecast(fcRes.data);
            setLastCycle(lcRes.data);
            if (lcRes.data.available && !lcRes.data.is_unlimited) {
                setPlannedBudget(String(lcRes.data.total_budget_used));
                setPlannedSlots(String(lcRes.data.slot_limit));
                setPlannedAmount(String(lcRes.data.amount_per_student));
            }
        }).catch(() => { })
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

    const est = estimation?.estimate ?? {};

    if (loading) {
        return (
            <div className="page-card">
                <h4 className="sub-title">Budget Planning</h4>
                <div className="spinner-border spinner-border-sm text-danger" role="status" />
            </div>
        );
    }

    return (
        <>
            {/* Budget Forecast — Wilson */}
            <div className="page-card">
                <h4 className="sub-title">Budget Forecast (Statistical)</h4>
                <div className="info-box">
                    A genuine statistical forecast on <strong>approval rate</strong> — the one number here
                    unaffected by unmet demand, so it's valid to forecast with confidence intervals.
                    Volume is still a plain average.
                    <br /><br />
                    <strong>What the range means:</strong> based on {forecast?.pooled_total_submitted ?? "—"} historical
                    applicants, we're 95% confident the <em>true</em> approval rate falls somewhere between
                    the lower and upper bound shown below — not that it's exactly one number.
                    <br /><br />
                    <strong>Needs SK/real data?</strong> Yes.{" "}
                    <strong>Real forecasting?</strong> Yes — the only genuinely statistical one of these.{" "}
                    <strong>Status:</strong> Mechanism correct today; range narrows as real data accumulates.
                </div>
                {!forecast?.available ? (
                    <div className="alert alert-info mb-0">{forecast?.message ?? "Loading..."}</div>
                ) : (
                    <>
                        <div className="alert alert-primary py-3 mb-3">
                            <strong>Projected Approved Applicants Next Cycle:</strong>{" "}
                            <span style={{ fontSize: "1.3rem", fontWeight: 600 }}>
                                {forecast.projected_approved_range.lower} – {forecast.projected_approved_range.upper}
                            </span>
                            <div className="text-muted small mt-1">
                                {formatCurrency(forecast.projected_budget_range.lower)} – {formatCurrency(forecast.projected_budget_range.upper)},
                                {" "}assuming ~{forecast.projected_volume} applicants at {formatCurrency(forecast.assistance_per_applicant)} each.
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
                        <div className="text-muted small mt-3">
                            Based on {forecast.pooled_approved} approved out of {forecast.pooled_total_submitted} total submissions,
                            pooled across {forecast.periods_used} completed period(s).
                        </div>
                    </>
                )}
            </div>

            {/* Budget Estimation */}
            <div className="page-card">
                <h4 className="sub-title">Budget Estimation</h4>
                <div className="info-box">
                    A plain historical average — shows what past periods looked like, not a prediction.
                    No statistical claim.
                    <br /><br />
                    <strong>Needs SK/real data?</strong> Yes — becomes reliable once real completed cycles
                    run on this system.<br />
                    <strong>Real forecasting?</strong> No — plain arithmetic.<br />
                    <strong>Status:</strong> Mechanism ready today; output meaningful once real data exists.
                </div>
                {!estimation?.historical?.length ? (
                    <div className="alert alert-info mb-0">No application period data available yet.</div>
                ) : (
                    <>
                        <div className="table-responsive mb-4">
                            <table className="table table-bordered table-striped align-middle">
                                <thead>
                                    <tr>
                                        <th>School Year</th><th>Total Applications</th><th>Approved</th>
                                        <th>Pass Rate</th><th>Disbursement</th><th>Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {estimation.historical.map((h) => (
                                        <tr key={h.config_id}>
                                            <td>{h.school_year}</td>
                                            <td>{h.total_applications}</td>
                                            <td>{h.approved_count}</td>
                                            <td>{(h.pass_rate * 100).toFixed(1)}%</td>
                                            <td>{formatCurrency(h.estimated_disbursement)}</td>
                                            <td>{h.is_active ? <span className="badge bg-success">Active</span> : <span className="badge bg-secondary">Completed</span>}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <div className="row g-4 mb-3">
                            <div className="col-md-6"><div className="summary-card"><h2>{est.average_approved_count ?? 0}</h2><p>Avg. Approved per Period (Historical)</p></div></div>
                            <div className="col-md-6"><div className="summary-card"><h2>{((est.average_pass_rate ?? 0) * 100).toFixed(1)}%</h2><p>Average Pass Rate (Historical)</p></div></div>
                        </div>
                        <div className="alert alert-primary py-3 mb-0">
                            <strong>Estimated Budget Needed for Next Period:</strong>{" "}
                            <span style={{ fontSize: "1.3rem", fontWeight: 600 }}>{formatCurrency(est.projected_budget)}</span>
                            <div className="text-muted small mt-1">
                                Based on ~{est.average_approved_count ?? 0} applicants at {((est.average_pass_rate ?? 0) * 100).toFixed(1)}% pass rate, {formatCurrency(est.assistance_per_applicant ?? 2000)} each.
                            </div>
                        </div>
                    </>
                )}
            </div>

            {/*Budget Allocation Planning */}
            <div className="page-card">
                <h4 className="sub-title">Budget Allocation Planning</h4>
                <div className="info-box">
                    A decision-support calculator, not a forecast — works entirely off a budget figure SK
                    provides directly, no historical applicant data needed.
                    <br /><br />
                    <strong>Needs SK/real data?</strong> No.{" "}
                    <strong>Real forecasting?</strong> No, and doesn't claim to be.{" "}
                    <strong>Status:</strong> Usable today, regardless of system history.
                </div>
                {lastCycle?.available && (
                    <div className="alert alert-secondary py-2 mb-3">
                        <strong>Last completed cycle ({lastCycle.school_year}):</strong>{" "}
                        {lastCycle.is_unlimited
                            ? "unlimited slots"
                            : `${lastCycle.slot_limit} slots at ${formatCurrency(lastCycle.amount_per_student)} each — total ${formatCurrency(lastCycle.total_budget_used)}`}
                    </div>
                )}
                <div className="row g-3 align-items-end">
                    <div className="col-md-4">
                        <label className="form-label">Total Allocated Budget</label>
                        <div className="input-group">
                            <span className="input-group-text">₱</span>
                            <input type="number" className="form-control" value={plannedBudget}
                                onChange={(e) => handleBudgetChange(e.target.value)} placeholder="" />
                        </div>
                    </div>
                    <div className="col-md-4">
                        <label className="form-label">Number of Slots</label>
                        <input type="number" className="form-control" value={plannedSlots}
                            onChange={(e) => handleSlotsChange(e.target.value)} placeholder="" />
                    </div>
                    <div className="col-md-4">
                        <label className="form-label">Amount per Student</label>
                        <div className="input-group">
                            <span className="input-group-text">₱</span>
                            <input type="number" className="form-control" value={plannedAmount}
                                onChange={(e) => handleAmountChange(e.target.value)} placeholder="" />
                        </div>
                    </div>
                </div>
                {plannedBudget && plannedSlots && plannedAmount && (
                    <div className="alert alert-primary py-2 mt-3 mb-0">
                        With {formatCurrency(plannedBudget)} total, SK could offer{" "}
                        <strong>{Number(plannedSlots).toLocaleString()} slots</strong> at{" "}
                        <strong>{formatCurrency(plannedAmount)}</strong> each.
                    </div>
                )}
            </div>

        </>
    );
}

export default BudgetPlanningSection;