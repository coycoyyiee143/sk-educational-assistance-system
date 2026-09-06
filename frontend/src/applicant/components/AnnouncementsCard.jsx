import { useEffect, useState } from "react";
import api from "../../services/api";

const categoryBadgeClass = {
    "Educational Assistance": "bg-danger",
    "Reminder": "bg-warning text-dark",
    "Schedule Update": "bg-info text-dark",
    "SK Activity": "bg-success",
};

const LAST_SEEN_KEY = "announcements_last_seen_at";

function formatDate(dateStr) {
    if (!dateStr) return "";
    return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function AnnouncementsCard() {
    const [announcements, setAnnouncements] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [lastSeenAt, setLastSeenAt] = useState(() => localStorage.getItem(LAST_SEEN_KEY));

    useEffect(() => {
        api.get("/announcements")
            .then((res) => setAnnouncements(res.data))
            .catch(() => setError("Failed to load announcements."))
            .finally(() => setLoading(false));
    }, []);

    useEffect(() => {
        // Mark everything currently loaded as "seen" a moment after the card
        // renders, so the "New" badges are visible on this visit but won't
        // reappear the next time the applicant opens the dashboard.
        if (announcements.length === 0) return;
        const timer = setTimeout(() => {
            localStorage.setItem(LAST_SEEN_KEY, new Date().toISOString());
        }, 3000);
        return () => clearTimeout(timer);
    }, [announcements]);

    const isNew = (a) => lastSeenAt && new Date(a.published_at) > new Date(lastSeenAt);
    const newCount = lastSeenAt ? announcements.filter(isNew).length : 0;

    return (
        <div className="dashboard-card">
            <div className="d-flex justify-content-between align-items-center mb-2">
                <h5 className="mb-0">Announcements</h5>
                {newCount > 0 && <span className="badge bg-danger">{newCount} new</span>}
            </div>

            {error && <p className="text-muted mb-0">{error}</p>}

            {loading ? (
                <div className="spinner-border spinner-border-sm text-danger" />
            ) : announcements.length === 0 ? (
                <p className="text-muted mb-0">No announcements posted yet.</p>
            ) : (
                <div style={{ maxHeight: 320, overflowY: "auto" }} className="pe-1">
                    {announcements.map((a) => (
                        <div key={a.id} className="border-bottom pb-2 mb-2">
                            <div className="d-flex justify-content-between align-items-start gap-2">
                                <strong>{a.title}</strong>
                                <div className="d-flex align-items-center gap-1 flex-shrink-0">
                                    {isNew(a) && <span className="badge bg-danger">New</span>}
                                    {a.category && (
                                        <span className={`badge ${categoryBadgeClass[a.category] ?? "bg-secondary"}`}>
                                            {a.category}
                                        </span>
                                    )}
                                </div>
                            </div>
                            <p className="text-muted mb-1"><small>{formatDate(a.published_at)}</small></p>
                            <p className="mb-0 small" style={{ whiteSpace: "pre-wrap" }}>{a.content}</p>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

export default AnnouncementsCard;