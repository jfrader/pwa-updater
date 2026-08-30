/**
 * New-deploy detection for browser apps, framework-free.
 *
 * Polls a small `version.json` served next to the app and compares it against
 * the version baked into the running bundle. This module owns the detection
 * loop helpers and the reload-loop guards; the app owns the UI (it renders its
 * own styled update modal from the hook's `promptOpen`).
 *
 * Loop-safety invariants (all covered by tests):
 * - A prompt fires at most once per server version per mount.
 * - Reloading records the server version in sessionStorage; the prompt never
 *   re-fires for that same version. This survives the reload itself, so a CDN
 *   that still serves the old HTML next to the new version.json cannot loop.
 * - The marker is cleared once bundle and server versions match again.
 * - The check is inert when the bundled version is missing or `"dev"`.
 */

export interface VersionReloadOptions {
  /** Version baked into this bundle at build time (e.g. a Vite define). */
  currentVersion: string;
  /** Path serving `{ "version": "..." }` relative to the app origin. */
  serverVersionPath?: string;
  /** How often to re-check for a new deploy. Defaults to 5 minutes. */
  pollIntervalMs?: number;
  /** Pause before reloading so the modal can close and repaint. */
  reloadDelayMs?: number;
  /** Disable all polling (e.g. embed/iframe builds). */
  disabled?: boolean;
  /** Custom reload action. Defaults to `window.location.reload()`. */
  onReload?: () => void;
  /** sessionStorage key for the per-version reload marker. */
  storageKey?: string;
}

export interface VersionReloadState {
  /** Version served by `/version.json`, when a successful check happened. */
  serverVersion: string | null;
  /** True when the served version differs from the bundled one. */
  updateAvailable: boolean;
  /** True while a new version is detected and awaiting user action. */
  promptOpen: boolean;
  /**
   * Record the current server version as reloaded-for and perform the reload.
   * Idempotent: calling it again for the same version is a no-op.
   */
  reload: () => void;
  /** Close the prompt; it will not re-open for the same server version. */
  dismiss: () => void;
  /** Run an immediate version check (e.g. from an error boundary). */
  refetch: () => void;
}

export const DEFAULT_POLL_INTERVAL_MS = 5 * 60 * 1000;
export const DEFAULT_RELOAD_DELAY_MS = 250;
export const DEFAULT_SERVER_VERSION_PATH = "/version.json";
export const DEFAULT_STORAGE_KEY = "pwa-updater-reloaded-for";

interface VersionDocument {
  version?: unknown;
}

/** Minimal storage surface used for the reload marker. */
export interface VersionMarkerStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/** The browser's sessionStorage, or null where unavailable (SSR/private mode). */
export function sessionStorageLike(): VersionMarkerStorage | null {
  try {
    return typeof window !== "undefined" && window.sessionStorage
      ? window.sessionStorage
      : null;
  } catch {
    return null;
  }
}

export function readReloadedFor(
  storage: VersionMarkerStorage | null,
  storageKey: string,
): string | null {
  try {
    return storage?.getItem(storageKey) ?? null;
  } catch {
    return null;
  }
}

export function writeReloadedFor(
  storage: VersionMarkerStorage | null,
  storageKey: string,
  version: string | null,
): void {
  try {
    if (!storage) return;
    if (version === null) storage.removeItem(storageKey);
    else storage.setItem(storageKey, version);
  } catch {
    // No sessionStorage (old private mode): the prompt may simply repeat.
  }
}

/**
 * Fetch `{ "version": "..." }` from the server with no-store semantics.
 * Returns the trimmed version string, or null when offline, missing, or
 * unparseable — callers keep the current version in those cases.
 */
export async function checkServerVersion(
  serverVersionPath: string,
  fetchImpl: typeof fetch = globalThis.fetch,
): Promise<string | null> {
  try {
    const response = await fetchImpl(serverVersionPath, { cache: "no-store" });
    if (!response.ok) return null;
    const document = (await response.json()) as VersionDocument;
    return typeof document.version === "string" ? document.version.trim() : null;
  } catch {
    return null;
  }
}

const DYNAMIC_IMPORT_ERROR_PATTERNS = [
  /failed to fetch dynamically imported module/i,
  /error loading dynamically imported module/i,
  /importing a module script failed/i,
  /chunkloaderror/i,
];

function errorMessage(error: unknown): string | null {
  if (typeof error === "string") return error;
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object" && "message" in error) {
    const message = (error as { message: unknown }).message;
    return typeof message === "string" ? message : null;
  }
  return null;
}

/**
 * True when an error is a stale-chunk failure: the classic symptom of a deploy
 * landing while the user still runs an old bundle. Reloading fixes it.
 */
export function isDynamicImportError(error: unknown): boolean {
  const message = errorMessage(error);
  if (!message) return false;
  return DYNAMIC_IMPORT_ERROR_PATTERNS.some((pattern) => pattern.test(message));
}
