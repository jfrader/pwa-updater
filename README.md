# @jfrader/pwa-updater

[![npm version](https://img.shields.io/npm/v/@jfrader/pwa-updater?style=flat)](https://www.npmjs.com/package/@jfrader/pwa-updater)
[![npm downloads](https://img.shields.io/npm/dm/@jfrader/pwa-updater?style=flat)](https://www.npmjs.com/package/@jfrader/pwa-updater)
[![ci](https://img.shields.io/github/actions/workflow/status/jfrader/pwa-updater/ci.yml?branch=main&style=flat&label=ci)](https://github.com/jfrader/pwa-updater/actions)
[![license](https://img.shields.io/github/license/jfrader/pwa-updater?style=flat)](./LICENSE)
[![node](https://img.shields.io/node/v/@jfrader/pwa-updater?style=flat)](https://www.npmjs.com/package/@jfrader/pwa-updater)

Zero-dependency PWA version-reload for small apps. Detects new deploys by
comparing the version baked into the running bundle against a served
`version.json`, owns the once-per-version prompt state, and performs the
reload — without shipping a service-worker framework.

## Scope

One tested copy of the version check, once-per-version prompt, and loop-safe
reload. Each app keeps its own service-worker registration, cache names, legacy
migration endpoints, install banners, and update modal.

Apps with a service-worker claim handshake run it from `onReload` (or the modal
action) and call `writeReloadedFor` only after the handoff succeeds, so failed
updates stay retryable.

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

Push an annotated `v<package-version>` tag from `main`. `publish.yml` builds,
tests, and packs one tarball, then publishes that exact artifact to npmjs
(trusted publisher) and GitHub Packages. Re-runs accept a matching artifact and
fail on a different one. Never add `publishConfig.registry`; `.npmrc` pins the
`@jfrader` scope to npmjs.

## Agent skill

The package ships `skills/pwa-updater/SKILL.md`, an agent-facing integration
workflow covering bundle-version injection, `version.json` serving, hook
usage, loop-safety verification, and what stays per-app. Clients that
discover dependency skills can load it from the installed package.
