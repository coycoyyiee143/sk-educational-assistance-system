import { useState, useEffect } from "react";
import VerifierNavigation from "../components/VerifierNavigation";
import api from "../../services/api";

function formatWaitTime(waitlistedAt) {
    if (!waitlistedAt) return "—";
    const diffMs = new Date() - new Date(waitlistedAt);
    const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    if (days >= 1) return `${days} day${days === 1 ? "" : "s"} ago`;
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    if (hours >= 1) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
    const mins = Math.floor(diffMs / (1000 * 60));
    return `${mins} minute${mins === 1 ? "" : "s"} ago`;
}

function VerifierWaitlist() {
    const [waitlist, setWaitlist] = useState([]);
    const [notClearedCount, setNotClearedCount] = useState(0);
    const [freeSlots, setFreeSlots] = useState(0);
    const [configId, setConfigId] = useState(null);
    const [loading, setLoading] = useState(true);
    const [promoting, setPromoting] = useState(false);
    const [promotingAll, setPromotingAll] = useState(false);
    const [message, setMessage] = useState("");
    const [error, setError] = useState("");

    const fetchData = () => {
        api.get("/verifier/waitlist")
            .then((res) => {
                setWaitlist(res.data.waitlist ?? []);
                setConfigId(res.data.config_id ?? null);
                setNotClearedCount(res.data.not_cleared_count ?? 0);
                setFreeSlots(res.data.free_slots ?? 0);
            })
            .catch(() => setError("Failed to load waitlist."))
            .finally(() => setLoading(false));
    };

    useEffect(() => {
        fetchData();
        const interval = setInterval(fetchData, 15000);
        return () => clearInterval(interval);
    }, []);

    async function handlePromote() {
        if (!configId) return;
        setPromoting(true);
        setError("");
        setMessage("");
        try {
            const res = await api.post(`/verifier/applications/config/${configId}/promote-waitlist`);
            setMessage(res.data.message);
            fetchData();
        } catch (err) {
            setError(err.response?.data?.message || "Failed to promote next applicant.");
        } finally {
            setPromoting(false);
        }
    }

    async function handlePromoteAll() {
        if (!configId) return;
        setPromotingAll(true);
        setError("");
        setMessage("");
        try {
            const res = await api.post(`/verifier/applications/config/${configId}/promote-all-waitlist`);
            setMessage(res.data.message);
            fetchData();
        } catch (err) {
            setError(err.response?.data?.message || "Failed to promote applicants.");
        } finally {
            setPromotingAll(false);
        }
    }

    const nextApplicant = waitlist.find((a) => a.position === 1);

    return (
        <div>
            <VerifierNavigation />
            <section className="page-section">
                <div className="container">
                    <div className="content-card mb-4">
                        <h3 className="section-title mb-2">Waitlist</h3>
                        <p className="text-muted mb-0">
                            Applicants who met all requirements but arrived after slots were filled. Promotion is
                            strictly first-in-line — the applicant waiting longest is always promoted next, when a
                            slot frees up (e.g. a claiming-day rejection).
                        </p>
                    </div>

                    {error && <div className="alert alert-danger">{error}</div>}
                    {message && <div className="alert alert-success">{message}</div>}

                    <div className="row g-4">
                        <div className="col-md-4">
                            <div className="summary-card">
                                <h5>Applicants Waiting</h5>
                                <div className="summary-number">
                                    {loading ? <span className="small text-muted">...</span> : waitlist.length}
                                </div>
                                <p className="text-muted mb-0">On the waitlist right now</p>
                            </div>
                        </div>
                        <div className="col-md-4">
                            <div className="summary-card">
                                <h5>Free Slots</h5>
                                <div className="summary-number">
                                    {loading ? <span className="small text-muted">...</span> : `${freeSlots} / ${notClearedCount}`}
                                </div>
                                <p className="text-muted mb-0">Available to backfill right now</p>
                            </div>
                        </div>
                        <div className="col-md-4">
                            <div className="summary-card">
                                <h5>Next in Line</h5>
                                <div className="summary-number" style={{ fontSize: nextApplicant ? "1.5rem" : undefined }}>
                                    {loading ? <span className="small text-muted">...</span> : (nextApplicant?.name ?? "—")}
                                </div>
                                <p className="text-muted mb-0">First to be promoted</p>
                            </div>
                        </div>
                    </div>

                    <div className="content-card mt-4">
                        <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3">
                            <h4 className="mb-0">Waitlisted Applicants</h4>
                            <div className="d-flex gap-2">
                                <button
                                    className="btn btn-outline-custom btn-sm"
                                    onClick={handlePromote}
                                    disabled={promoting || promotingAll || waitlist.length === 0}
                                >
                                    {promoting ? "Promoting..." : "Promote Next Applicant"}
                                </button>
                                <button
                                    className="btn btn-custom btn-sm"
                                    onClick={handlePromoteAll}
                                    disabled={promoting || promotingAll || waitlist.length === 0}
                                >
                                    {promotingAll ? "Promoting..." : "Promote All Available"}
                                </button>
                            </div>
                        </div>
                        {loading ? (
                            <div className="d-flex justify-content-center py-4">
                                <div className="spinner-border text-danger" />
                            </div>
                        ) : (
                            <div className="table-responsive">
                                <table className="table table-bordered table-striped align-middle">
                                    <thead>
                                        <tr>
                                            <th>#</th>
                                            <th>Applicant Name</th>
                                            <th>School</th>
                                            <th>Waitlisted</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {waitlist.length === 0 ? (
                                            <tr>
                                                <td colSpan="4" className="text-center text-muted py-3">
                                                    No applicants currently on the waitlist.
                                                </td>
                                            </tr>
                                        ) : (
                                            waitlist.map((app) => (
                                                <tr key={app.id} className={app.position === 1 ? "table-warning" : undefined}>
                                                    <td>
                                                        {app.position}
                                                        {app.position === 1 && <span className="badge bg-warning text-dark ms-2">Next</span>}
                                                    </td>
                                                    <td>{app.name}</td>
                                                    <td>{app.school_name}</td>
                                                    <td>{formatWaitTime(app.waitlisted_at)}</td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>
            </section>
            <footer>
                <div className="container">
                    <p className="mb-0">© 2026 Sangguniang Kabataan of Barangay Mamatid | Verifier Panel</p>
                </div>
            </footer>
        </div>
    );
}

export default VerifierWaitlist;