# Change request — Scorecard: kill the precaching service worker in native builds

**For:** Scorecard coder
**From:** Overseer (teardown audit 2026-09-29 — `AUDIT-2026-09-29-TEARDOWN.md`, finding F-6)
**Date:** 2026-09-29
**Priority:** High — this is a known, production-proven failure mode carried by the app that ships most often

## What we want

One line. `vite.config.native.js`, VitePWA block (~line 41): add `selfDestroying: true`, exactly as `vite.config.native.board.js:73` already has.

## Why

Board 2.4.0 shipped and displayed 2.3.9's UI because the precaching auto-update service worker inside the Capacitor WebView kept serving the previous bundle. That incident is why `selfDestroying: true` went into Board's config in 2.4.1. The flag was never propagated: Scorecard native (4.2.0, live on both stores) still registers the same precaching `registerType: 'autoUpdate'` worker with no self-destruct. Every Scorecard Android update is one cache mood away from "I updated and nothing changed" — on Board that class of failure coincided with a 37.5% uninstall rate.

(Longer term the audit recommends dropping VitePWA from native configs entirely — a Capacitor app gains nothing from a web service worker — but the one-line flag is the safe, already-proven fix and doesn't disturb the manifest/icon generation the plugin also does.)

## Coordination

- Vite config change = full AAB queue rebuild from fresh source per standing discipline. Ping siblings before starting the gradle queue loop.
- iOS ships from the same web bundle via Codemagic — the flag applies there on the next build too.

## Acceptance

- `vite.config.native.js` VitePWA block contains `selfDestroying: true`
- Fresh `npm run build:native` output contains the self-destroying `sw.js` (it unregisters itself; no precache manifest)
- AAB queue rebuilt from the changed source
