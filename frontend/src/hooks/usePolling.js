import { useEffect, useRef } from "react";

/**
 * Polls `callback` every `intervalMs`, while `enabled` is true.
 *
 * Performance guards, so this never turns into unbounded background
 * load across open tabs:
 * - Skips the tick entirely while the browser tab is not visible
 *   (Page Visibility API) — a backgrounded tab generates zero requests,
 *   and picks back up immediately once it's focused again.
 * - Never overlaps requests: if a tick is still waiting on a response
 *   when the next interval fires, that tick is skipped rather than
 *   stacking a second request on top of a slow one.
 * - Callers control WHEN polling runs at all via `enabled` — pages
 *   using this should only enable polling while there's something
 *   actually worth watching (e.g. a status still mid-processing), and
 *   turn it off once that resolves, rather than polling forever.
 *
 * `callback` should be wrapped in useCallback by the caller if it
 * closes over changing state/props, so the interval doesn't need to be
 * torn down and recreated on every render.
 */
export function usePolling(callback, { intervalMs = 10000, enabled = true } = {}) {
    const callbackRef = useRef(callback);
    const inFlightRef = useRef(false);

    useEffect(() => {
        callbackRef.current = callback;
    }, [callback]);

    useEffect(() => {
        if (!enabled) return;

        let cancelled = false;

        async function tick() {
            if (inFlightRef.current || document.hidden) return;
            inFlightRef.current = true;
            try {
                await callbackRef.current();
            } finally {
                inFlightRef.current = false;
            }
        }

        const id = setInterval(() => {
            if (!cancelled) tick();
        }, intervalMs);

        return () => {
            cancelled = true;
            clearInterval(id);
        };
    }, [enabled, intervalMs]);
}