/**
 * @jfrader/pwa-updater — zero-dependency PWA version-reload for small apps.
 *
 * Browser-only. Everything is tree-shakeable and pulls zero runtime
 * dependencies from this package itself; React is an optional peer loaded only
 * when you import `useVersionReload`.
 */

export {
  checkServerVersion,
  DEFAULT_POLL_INTERVAL_MS,
  DEFAULT_RELOAD_DELAY_MS,
  DEFAULT_SERVER_VERSION_PATH,
  DEFAULT_STORAGE_KEY,
  isDynamicImportError,
  readReloadedFor,
  sessionStorageLike,
  writeReloadedFor,
  type VersionMarkerStorage,
  type VersionReloadOptions,
  type VersionReloadState,
} from "./core.js";

export { useVersionReload } from "./react.js";
