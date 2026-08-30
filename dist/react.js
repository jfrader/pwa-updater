import { useCallback, useEffect, useRef, useState } from "react";
import { checkServerVersion, DEFAULT_POLL_INTERVAL_MS, DEFAULT_RELOAD_DELAY_MS, DEFAULT_SERVER_VERSION_PATH, DEFAULT_STORAGE_KEY, readReloadedFor, sessionStorageLike, writeReloadedFor, } from "./core.js";
/**
 * New-deploy detection for React apps. Polls `version.json` and compares it
 * against the version baked into the running bundle. The hook owns the
 * detection loop and the reload-loop guards; the app renders its own styled
 * update modal from `promptOpen`.
 *
 * Loop-safety invariants (all covered by tests):
 * - A prompt fires at most once per server version per mount.
 * - Reloading records the server version in sessionStorage; the prompt never
 *   re-fires for that same version. This survives the reload itself, so a CDN
 *   that still serves the old HTML next to the new version.json cannot loop.
 * - The marker is cleared once bundle and server versions match again.
 * - The poller stops and its listeners detach on unmount; no state updates
 *   after unmount.
 * - The check is inert when `currentVersion` is missing or `"dev"`.
 */
export function useVersionReload(options) {
    const { currentVersion, serverVersionPath = DEFAULT_SERVER_VERSION_PATH, pollIntervalMs = DEFAULT_POLL_INTERVAL_MS, reloadDelayMs = DEFAULT_RELOAD_DELAY_MS, disabled = false, onReload, storageKey = DEFAULT_STORAGE_KEY, } = options;
    const [serverVersion, setServerVersion] = useState(null);
    const [promptedVersion, setPromptedVersion] = useState(null);
    const [open, setOpen] = useState(false);
    const [tick, setTick] = useState(0);
    const onReloadRef = useRef(onReload);
    onReloadRef.current = onReload;
    const pollIntervalRef = useRef(pollIntervalMs);
    pollIntervalRef.current = pollIntervalMs;
    const active = !disabled && typeof currentVersion === "string" && currentVersion !== "" && currentVersion !== "dev";
    useEffect(() => {
        if (!active)
            return;
        let cancelled = false;
        const check = async () => {
            const version = await checkServerVersion(serverVersionPath);
            if (version !== null && !cancelled) {
                setServerVersion(version);
            }
        };
        void check();
        const id = window.setInterval(check, pollIntervalRef.current);
        window.addEventListener("focus", check);
        return () => {
            cancelled = true;
            window.clearInterval(id);
            window.removeEventListener("focus", check);
        };
    }, [active, serverVersionPath, tick]);
    const updateAvailable = Boolean(active && serverVersion && serverVersion !== currentVersion);
    useEffect(() => {
        if (!updateAvailable || open || promptedVersion === serverVersion)
            return;
        // Already reloaded for this exact version: CDN edge lag after a deploy, not
        // a new deploy. Do not insist; the next poll will find a consistent pair.
        if (serverVersion && readReloadedFor(sessionStorageLike(), storageKey) === serverVersion)
            return;
        setPromptedVersion(serverVersion);
        setOpen(true);
    }, [updateAvailable, open, promptedVersion, serverVersion, storageKey]);
    // Bundle and server agree: the reload (if any) did its job. Clear the marker
    // so the NEXT deploy prompts normally.
    useEffect(() => {
        if (active && serverVersion && serverVersion === currentVersion) {
            writeReloadedFor(sessionStorageLike(), storageKey, null);
        }
    }, [active, serverVersion, currentVersion, storageKey]);
    const reload = useCallback(() => {
        const version = serverVersion;
        setOpen(false);
        const storage = sessionStorageLike();
        if (!version || readReloadedFor(storage, storageKey) === version)
            return;
        writeReloadedFor(storage, storageKey, version);
        window.setTimeout(() => {
            const reloadFn = onReloadRef.current;
            if (reloadFn)
                reloadFn();
            else
                window.location.reload();
        }, reloadDelayMs);
    }, [serverVersion, storageKey, reloadDelayMs]);
    const dismiss = useCallback(() => {
        setOpen(false);
    }, []);
    const refetch = useCallback(() => {
        setTick((current) => current + 1);
    }, []);
    return { serverVersion, updateAvailable, promptOpen: open, reload, dismiss, refetch };
}
//# sourceMappingURL=react.js.map