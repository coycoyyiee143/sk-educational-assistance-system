import { useEffect, useState } from "react";
import api from "../services/api";

/**
 * Fetches a user's avatar (given the full avatar_url the backend already
 * returns on the user object, e.g. user.avatar_url) as a blob URL, since
 * the route requires the Bearer auth header a plain <img src> can't send.
 * Depending on avatarUrl (which is cache-busted with ?v=<updated_at>)
 * makes it refetch automatically right after a new upload.
 */
export function useAvatarPhoto(avatarUrl) {
    const [url, setUrl] = useState(null);

    useEffect(() => {
        if (!avatarUrl) {
            setUrl(null);
            return;
        }

        let cancelled = false;
        let objectUrl = null;

        api
            .get(avatarUrl, { responseType: "blob" })
            .then((res) => {
                if (cancelled) return;
                objectUrl = URL.createObjectURL(res.data);
                setUrl(objectUrl);
            })
            .catch(() => {
                if (!cancelled) setUrl(null);
            });

        return () => {
            cancelled = true;
            if (objectUrl) URL.revokeObjectURL(objectUrl);
        };
    }, [avatarUrl]);

    return url;
}
