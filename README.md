# @jfrader/pwa-updater

Zero-dependency PWA version-reload for small apps. Detects new deploys by
comparing the version baked into the running bundle against a served
`version.json`, owns the once-per-version prompt state, and performs the
reload — without shipping a service-worker framework.

It is the shared version-reload layer used by all jfrader apps (MiFulbo,
Trucoshi, Huertoku, Civiku, Levantar). It was extracted from the version
surface of `@jfrader/observability`, which keeps errors and analytics only.

## Why this package exists

Every app was hand-rolling the same correctness-sensitive code — fetch
`version.json` (no-store), compare against the bundle version, prompt at most
once per version, reload without looping when a CDN still serves old HTML —
and the copies had diverged. This package is that logic, tested once.

What stays **per app** (deliberately out of scope):

- service-worker registration, cache names, precache lists;
- legacy SW migration endpoints;
- install-promotion rules (`beforeinstallprompt` banners);
- the update modal's UI, copy, and design tokens.

Apps with hardened PWA handoff requirements (service-worker claim handshakes,
`SKIP_WAITING`/`clientsClaim` messaging, controller-change timeouts, legacy
tombstone endpoints) keep that orchestration in app code: use the hook for
detection and prompt state, run the app-specific reloader from the modal
action, and write the per-version reload marker only after the handoff
succeeds so failed updates stay retryable (`writeReloadedFor` is exported).

## Install

```bash
npm install @jfrader/pwa-updater
# only if you use the React hook:
npm install react
```

## Quick start

1. Bake the bundle version at build time (e.g. a Vite `define`) and serve
   `{ "version": "<same value>" }` from `/version.json` with `no-store`.
2. Call the hook at the app root and render your own update modal:

```tsx
import { useVersionReload } from "@jfrader/pwa-updater";

const { promptOpen, reload, dismiss, refetch } = useVersionReload({
  currentVersion: import.meta.env.VITE_APP_VERSION,
});

if (promptOpen) {
  return <UpdateModal onReload={reload} onDismiss={dismiss} />;
}
```

3. (Optional) reload through your app's own update path instead of a raw
   reload — e.g. a service-worker claim handshake:

```tsx
useVersionReload({ currentVersion, onReload: requestPwaUpdate });
```

## API

| Export | Purpose |
|---|---|
| `useVersionReload(options)` | React hook: detection loop + prompt state + reload (optional `react` peer). |
| `checkServerVersion(path, fetchImpl?)` | Fetch `{version}` with no-store semantics; `string \| null`. |
| `isDynamicImportError(error)` | True for stale-chunk failures (`ChunkLoadError` etc.) — the classic post-deploy reload trigger. |
| `readReloadedFor` / `writeReloadedFor` / `sessionStorageLike` | Reload-marker storage helpers (injectable, SSR-safe). |
| `DEFAULT_*` constants | Poll interval (5 min), reload delay (250 ms), path, storage key. |

Hook options: `currentVersion` (required), `serverVersionPath`,
`pollIntervalMs`, `reloadDelayMs`, `disabled` (embeds/iframes), `onReload`,
`storageKey`.

## Loop-safety invariants (tested)

- A prompt fires at most once per server version per mount.
- Reloading records the server version in sessionStorage; the prompt never
  re-fires for that same version — it survives the reload itself, so a CDN
  that still serves the old HTML next to the new `version.json` cannot loop.
- The marker is cleared once bundle and server versions match again.
- The poller stops and listeners detach on unmount.
- The check is inert when the bundled version is missing or `"dev"`.

The default sessionStorage key is `pwa-updater-reloaded-for`.

## Stale-chunk errors

When a deploy lands mid-session, old bundles fail with dynamic-import errors.
Detect them in your error boundary and offer a reload:

```tsx
if (isDynamicImportError(error)) refetch(); // or prompt immediately
```

## Development

```bash
npm install
npm run check     # typecheck + tests + build + package-files check
npm test          # vitest
npm run build     # tsc -> dist
```

## Publishing

Push an annotated `v<package-version>` tag from `main`. The release workflow
checks the tag and lockfile, builds and tests once, packs one immutable
tarball, then verifies or publishes that exact artifact to npmjs and GitHub
Packages. Retries are safe: an existing matching artifact is accepted, a
different artifact at the same version fails.

- npmjs uses a trusted publisher for `jfrader/pwa-updater` →
  `.github/workflows/publish.yml`.
- GitHub Packages uses the workflow's scoped `GITHUB_TOKEN`; the package is
  created public automatically from this public repo.
- Never add `publishConfig.registry` to the manifest.
- The repo `.npmrc` pins the `@jfrader` scope to npmjs for CLI publishing
  (the user-level `~/.npmrc` maps it to GitHub Packages).

## Agent skill

The package ships `skills/pwa-updater/SKILL.md`, an agent-facing integration
workflow covering bundle-version injection, `version.json` serving, hook
usage, loop-safety verification, and what stays per-app. Clients that
discover dependency skills can load it from the installed package.
