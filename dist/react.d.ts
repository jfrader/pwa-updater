import { type VersionReloadOptions, type VersionReloadState } from "./core.js";
export type { VersionReloadOptions, VersionReloadState } from "./core.js";
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
export declare function useVersionReload(options: VersionReloadOptions): VersionReloadState;
