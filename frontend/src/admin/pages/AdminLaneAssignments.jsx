import { useState, useEffect } from "react";
import AdminNavigation from "../components/AdminNavigation";
import api from "../../services/api";

function AdminLaneAssignments() {
    const [lanes, setLanes] = useState([]);
    const [verifiers, setVerifiers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [savingLaneId, setSavingLaneId] = useState(null);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");

    function fetchData() {
        setLoading(true);
        api.get("/admin/claiming-schedule/lane-assignments")
            .then((res) => {
                setLanes(res.data.lanes ?? []);
                setVerifiers(res.data.verifiers ?? []);
            })
            .catch(() => setError("Failed to load lane assignments."))
            .finally(() => setLoading(false));
    }

    useEffect(() => { fetchData(); }, []);

    async function handleAssign(laneId, verifierId) {
        setSavingLaneId(laneId);
        setError("");
        setSuccess("");
        try {
            const res = await api.post(`/admin/claiming-schedule/lanes/${laneId}/assign-verifier`, {
                verifier_id: verifierId || null,
            });
            setSuccess(res.data.message);
            fetchData();
        } catch (err) {
            setError(err.response?.data?.message || "Failed to update lane assignment.");
        } finally {
            setSavingLaneId(null);
        }
    }

    return (
        <div>
            <AdminNavigation />
            <section className="page-section">
                <div className="container">
                    <div className="page-card">
                        <h3 className="section-title mb-2">Verifier Lane Assignments</h3>
                        <p className="text-muted mb-0">
                            Assign which verifier is working each lane. Editable anytime, including during claiming day —
                            a verifier can also self-assign from their own Claiming page, and whichever change happens
                            most recently takes effect.
                        </p>
                    </div>

                    {error && <div className="alert alert-danger">{error}</div>}
                    {success && <div className="alert alert-success">{success}</div>}

                    <div className="page-card">
                        {loading ? (
                            <div className="d-flex justify-content-center py-4">
                                <div className="spinner-border text-danger" role="status" />
                            </div>
                        ) : lanes.length === 0 ? (
                            <div className="alert alert-info mb-0">No published claiming schedule found for the active period.</div>
                        ) : (
                            <div className="table-responsive">
                                <table className="table table-bordered table-striped align-middle">
                                    <thead>
                                        <tr>
                                            <th>Lane</th>
                                            <th>Batch</th>
                                            <th>Date</th>
                                            <th style={{ width: "280px" }}>Assigned Verifier</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {lanes.map((lane) => (
                                            <tr key={lane.id}>
                                                <td>{lane.lane_name}</td>
                                                <td>{lane.batch === "morning" ? "Morning" : "Afternoon"}</td>
                                                <td>{lane.claiming_date}</td>
                                                <td>
                                                    <select
                                                        className="form-select form-select-sm"
                                                        value={lane.verifier_id ?? ""}
                                                        onChange={(e) => handleAssign(lane.id, e.target.value)}
                                                        disabled={savingLaneId === lane.id}
                                                    >
                                                        <option value="">Unassigned</option>
                                                        {verifiers.map((v) => (
                                                            <option key={v.id} value={v.id}>
                                                                {v.first_name} {v.last_name}
                                                            </option>
                                                        ))}
                                                    </select>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>
            </section>
            <footer>
                <div className="container">
                    <p className="mb-0">© 2026 Sangguniang Kabataan of Barangay Mamatid | Admin Panel</p>
                </div>
            </footer>
        </div>
    );
}

export default AdminLaneAssignments;