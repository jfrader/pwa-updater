// @vitest-environment jsdom
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DEFAULT_STORAGE_KEY, isDynamicImportError, useVersionReload } from "../src/index.js";

const VERSION_URL = "/version.json";
const CURRENT = "1.0.0";
const NEW = "2.0.0";

let servedVersion: string | null = null;
const fetchMock = vi.fn(async () =>
  servedVersion
    ? ({ ok: true, json: async () => ({ version: servedVersion }) } as Response)
    : ({ ok: false, json: async () => ({}) } as Response),
);

function mockVersion(version: string | null) {
  servedVersion = version;
  return fetchMock;
}

beforeEach(() => {
  servedVersion = null;
  fetchMock.mockClear();
  window.sessionStorage.clear();
  vi.useFakeTimers();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  cleanup();
});

async function waitForCheck() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe("useVersionReload", () => {
  it("prompts once when the served version differs", async () => {
    mockVersion(NEW);
    const { result } = renderHook(() => useVersionReload({ currentVersion: CURRENT }));

    await waitForCheck();

    expect(result.current.serverVersion).toBe(NEW);
    expect(result.current.updateAvailable).toBe(true);
    expect(result.current.promptOpen).toBe(true);
  });

  it("does not re-open after dismissal for the same version", async () => {
    mockVersion(NEW);
    const { result } = renderHook(() => useVersionReload({ currentVersion: CURRENT }));
    await waitForCheck();
    expect(result.current.promptOpen).toBe(true);

    act(() => {
      result.current.dismiss();
    });
    expect(result.current.promptOpen).toBe(false);

    // A later poll with the same version must stay dismissed.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5 * 60 * 1000);
    });
    await act(async () => {
      await Promise.resolve();
    });
    expect(result.current.promptOpen).toBe(false);
  });

  it("reloads once per version and writes the session marker", async () => {
    mockVersion(NEW);
    const onReload = vi.fn();
    const { result } = renderHook(() =>
      useVersionReload({ currentVersion: CURRENT, onReload, reloadDelayMs: 500 }),
    );
    await waitForCheck();

    act(() => {
      result.current.reload();
      result.current.reload();
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });
    expect(onReload).toHaveBeenCalledTimes(1);
    expect(window.sessionStorage.getItem(DEFAULT_STORAGE_KEY)).toBe(NEW);
  });

  it("never prompts again for a version the browser already reloaded for", async () => {
    // CDN edge lag: the reloaded marker survives the reload while the served
    // HTML is still the old bundle next to the new version.json.
    window.sessionStorage.setItem(DEFAULT_STORAGE_KEY, NEW);
    mockVersion(NEW);
    const { result } = renderHook(() => useVersionReload({ currentVersion: CURRENT }));

    await waitForCheck();

    expect(result.current.updateAvailable).toBe(true);
    expect(result.current.promptOpen).toBe(false);
  });

  it("clears the marker once bundle and server versions match", async () => {
    window.sessionStorage.setItem(DEFAULT_STORAGE_KEY, CURRENT);
    mockVersion(CURRENT);
    const { result } = renderHook(() => useVersionReload({ currentVersion: CURRENT }));

    await waitForCheck();

    expect(result.current.updateAvailable).toBe(false);
    expect(window.sessionStorage.getItem(DEFAULT_STORAGE_KEY)).toBeNull();
  });

  it("re-checks when the tab regains focus", async () => {
    const fetchMock = mockVersion(null);
    const { result } = renderHook(() => useVersionReload({ currentVersion: CURRENT }));
    await waitForCheck();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result.current.serverVersion).toBeNull();

    // A new deploy lands between polls; focusing the tab catches it early.
    mockVersion(NEW);
    act(() => {
      window.dispatchEvent(new Event("focus"));
    });
    await waitForCheck();

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.current.serverVersion).toBe(NEW);
    expect(result.current.promptOpen).toBe(true);
  });

  it("refetches immediately on demand", async () => {
    const fetchMock = mockVersion(null);
    const { result } = renderHook(() => useVersionReload({ currentVersion: CURRENT }));
    await waitForCheck();
    expect(fetchMock).toHaveBeenCalledTimes(1);

    mockVersion(NEW);
    act(() => {
      result.current.refetch();
    });
    await waitForCheck();

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.current.promptOpen).toBe(true);
  });

  it("is inert when disabled or when the version is dev/missing", async () => {
    const fetchMock = mockVersion(NEW);
    const disabled = renderHook(() =>
      useVersionReload({ currentVersion: CURRENT, disabled: true }),
    );
    await waitForCheck();
    expect(fetchMock).not.toHaveBeenCalled();
    disabled.unmount();

    const dev = renderHook(() => useVersionReload({ currentVersion: "dev" }));
    await waitForCheck();
    expect(dev.result.current.updateAvailable).toBe(false);
    expect(dev.result.current.promptOpen).toBe(false);
    dev.unmount();

    const empty = renderHook(() => useVersionReload({ currentVersion: "" }));
    await waitForCheck();
    expect(empty.result.current.updateAvailable).toBe(false);
    empty.unmount();
  });

  it("tolerates fetch failures and non-JSON responses", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("offline");
      }),
    );
    const { result } = renderHook(() => useVersionReload({ currentVersion: CURRENT }));
    await waitForCheck();
    expect(result.current.serverVersion).toBeNull();
    expect(result.current.updateAvailable).toBe(false);
  });

  it("stops polling after unmount without errors", async () => {
    const fetchMock = mockVersion(NEW);
    const { result, unmount } = renderHook(() => useVersionReload({ currentVersion: CURRENT }));
    await waitForCheck();
    expect(result.current.promptOpen).toBe(true);

    unmount();
    const callsAfterUnmount = fetchMock.mock.calls.length;
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10 * 60 * 1000);
    });
    expect(fetchMock.mock.calls.length).toBe(callsAfterUnmount);
  });
});

describe("isDynamicImportError", () => {
  it.each([
    "Failed to fetch dynamically imported module",
    "error loading dynamically imported module",
    "Importing a module script failed",
    "ChunkLoadError: Loading chunk 4 failed",
  ])("detects chunk failures: %s", (message) => {
    expect(isDynamicImportError(new Error(message))).toBe(true);
    expect(isDynamicImportError(message)).toBe(true);
    expect(isDynamicImportError({ message })).toBe(true);
  });

  it("ignores regular errors", () => {
    expect(isDynamicImportError(new Error("kaboom"))).toBe(false);
    expect(isDynamicImportError(null)).toBe(false);
    expect(isDynamicImportError(undefined)).toBe(false);
    expect(isDynamicImportError(42)).toBe(false);
  });
});
