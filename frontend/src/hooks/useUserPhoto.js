import { useEffect, useState } from "react";
import api from "../services/api";

/**
 * Fetches a user's 2x2 profile photo (GET /users/{userId}/profile-photo) as
 * a blob URL. Status is "idle" (no userId yet), "loading", "ready", or
 * "none" (no photo on file / not authorized / request failed) — callers
 * should fall back to initials or a placeholder for anything but "ready".
 */
export function useUserPhoto(userId) {
    const [url, setUrl] = useState(null);
    const [status, setStatus] = useState("idle");

    useEffect(() => {
        if (!userId) {
            setStatus("idle");
            return;
        }

        let cancelled = false;
        let objectUrl = null;

        setStatus("loading");

        api
            .get(`/users/${userId}/profile-photo`, { responseType: "blob" })
            .then((res) => {
                if (cancelled) return;
                objectUrl = URL.createObjectURL(res.data);
                setUrl(objectUrl);
                setStatus("ready");
            })
            .catch(() => {
                if (!cancelled) setStatus("none");
            });

        return () => {
            cancelled = true;
            if (objectUrl) URL.revokeObjectURL(objectUrl);
        };
    }, [userId]);

    return { url, status };
}
