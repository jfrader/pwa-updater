# AGENTS.md — @jfrader/pwa-updater

Guidelines for agents working in this repo or integrating this package into
jfrader apps.

## Project

- `@jfrader/pwa-updater`: a zero-dependency PWA version-reload package.
- Stack: TypeScript, Node >= 20, zero runtime deps (React is an optional
  peer); tests via vitest; build via `tsc`; dist is committed (git-installable).
- Run `npm run check` (typecheck + tests + build + package-files check)
  before finishing a change.

## When integrating into an app

- Serve `{ "version": "<bundle version>" }` at `/version.json` with `no-store`
  (or an equivalent path), and inject the same value into the bundle at build
  time (e.g. a Vite `define`). The client compares the two.
- Use `useVersionReload` from `@jfrader/pwa-updater` (React) or the core
  helpers from `@jfrader/pwa-updater` directly. Render your own update modal
  from `promptOpen`; wire `reload` / `dismiss` / `refetch`.
- Keep the loop-safety invariants intact: never clear the sessionStorage
  marker pre-emptively, never prompt more than once per version per mount.
- Per-app surface stays per-app: service-worker registration, cache names,
  legacy migration endpoints, install-promotion rules, modal UI and copy.
- Heavy reload orchestration (SW claim handshake, legacy tombstone migration)
  belongs behind the `onReload` option, not in app components.

## When editing this repo

- Keep `src/core.ts` framework-free (no React imports); `src/react.tsx` is
  the only React surface and the only file importing React.
- Keep the storage helpers injectable and SSR-safe (no bare `window` access).
- New behavior ships with a test in `test/` covering the loop-safety
  invariants.
- Run `npm run check` before committing.
- Release: bump `version` in `package.json` + `package-lock.json`, commit,
  tag `v<version>` (annotated). The workflow publishes the exact artifact to
  npmjs + GitHub Packages. npmjs needs the trusted publisher configured once
  per package. Never add `publishConfig.registry`.

## Changelog

This repo does not dogfood the changelog system yet; user-visible package
changes are recorded via GitHub releases from the annotated tags. When the
changelog system is adopted, append entries under `changelog/` per its
runbook.

## Linear workflow

- Track project work in Linear, project **pwa-updater**:
  https://linear.app/gurisitosgames/project/pwa-updater-d90f82cd381d
- New ideas are added as Linear issues. Agents pick up issues, log the work
  being done on each issue (status, notes, dates), and move completed issues
  to Done.
- Read the `linear-workflow` skill (global:
  `~/.config/opencode/skills/linear-workflow/SKILL.md`) before creating or
  updating any issue.
