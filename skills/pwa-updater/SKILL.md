---
name: pwa-updater-integration
description: Add or change PWA version-reload behavior in a web app with @jfrader/pwa-updater — new-deploy detection against version.json, once-per-version prompt state, reload orchestration, stale-chunk recovery, and loop-safety verification. Use when adding update prompts, version reload dialogs, service-worker update handling, or when migrating apps off @jfrader/observability/browser's useVersionReload. Do not use for Sentry/PostHog concerns (that is observability-integration).
license: MIT
---

# PWA version-reload integration

Use `@jfrader/pwa-updater` as the shared layer for detecting new deploys and
reloading into them. The package owns detection, prompt state, and reload
safety; the app owns the modal UI, the service worker, and install promotion.

## Workflow

1. Inspect the application before editing:
   - existing service-worker registration, cache names, and precache lists;
   - whether `/version.json` (or an equivalent) is served and with what cache
     headers;
   - how the bundle version is injected at build time;
   - existing update prompts, reload dialogs, and stale-chunk error handling;
   - previous use of `useVersionReload` from `@jfrader/observability/browser`
     (migrating apps should switch imports to `@jfrader/pwa-updater`).
2. Wire the version pair before using the hook:
   - inject the bundle version at build time (Vite `define` or similar);
   - serve `{ "version": "<same value>" }` from `/version.json` with
     `no-store`, and never cache it in the service worker's runtime cache.
3. Mount `useVersionReload` once, at the app root or a stable layout.
4. Render the update modal from `promptOpen` with the app's own design tokens
   and copy; wire `reload` (user-initiated update) and `dismiss`.
5. For heavy reload paths (service-worker claim handshake, legacy migration),
   pass `onReload` instead of letting the hook call `window.location.reload`.
6. Verify per the checklist below, including a real deploy-detection smoke
   test when possible.

## Bundle version injection

```ts
// vite.config.ts — the same value must reach version.json at deploy time.
define: { __APP_VERSION__: JSON.stringify(process.env.APP_VERSION) },
```

```ts
// app
const { promptOpen, reload, dismiss, refetch } = useVersionReload({
  currentVersion: __APP_VERSION__,
});
```

The check is inert when `currentVersion` is missing or `"dev"`, so local
development never prompts.

## Loop-safety invariants (do not break)

- A prompt fires at most once per server version per mount.
- Reloading records the server version in sessionStorage; the prompt never
  re-fires for that same version. This survives the reload itself, so a CDN
  that still serves the old HTML next to the new version.json cannot loop.
- The marker is cleared once bundle and server versions match again.
- The poller stops and listeners detach on unmount.
- The check is inert when the bundled version is missing or `"dev"`.

Never pre-clear the sessionStorage marker, and never render the modal from
`updateAvailable` alone — use `promptOpen`.

## Stale-chunk recovery

After a deploy, old bundles fail with dynamic-import errors. In the app's
error boundary, detect them with `isDynamicImportError` and offer a reload
(or call `refetch` to re-check the version first):

```ts
import { isDynamicImportError } from "@jfrader/pwa-updater";

if (isDynamicImportError(error)) {
  // stale bundle: prompt to reload into the new deploy
}
```

## What stays per-app

- Service-worker registration, cache names, precache lists, and legacy
  migration endpoints.
- Install-promotion rules (`beforeinstallprompt` banners).
- Modal UI, copy, and design tokens.

## Verification

Before merge:

- version pair wired: bundle injection and `version.json` agree;
- one prompt per version per mount; dismiss persists for the version;
- reload fires once, `onReload` honored, no reload loops (marker survives);
- marker cleared when versions match again;
- inert in dev (`"dev"`/missing version) and when `disabled` (embeds);
- typecheck, tests, build, and lint green.

After deployment:

1. Confirm the deployed commit and that `/version.json` serves the expected
   value with `no-store`.
2. Deploy a second version and confirm: prompt appears once, reload lands on
   the new version, and no loop or repeated prompt follows.
3. Confirm the sessionStorage key `pwa-updater-reloaded-for` (or the
   configured `storageKey`) behaves as documented.

## Avoid

- Copying the detection/prompt logic into the app instead of importing the
  package.
- Prompting from `updateAvailable` without the once-per-version state.
- Serving `version.json` from a cache that can serve stale content.
- Coupling the package to the app's service worker or vite config — that
  stays in the app.
- Mixing version-reload and observability imports: errors/analytics come from
  `@jfrader/observability`, version-reload from `@jfrader/pwa-updater`.

Use the package README for the current API. Application deployment rules and
privacy constraints override generic examples in this skill.
