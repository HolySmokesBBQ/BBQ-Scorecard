# Change request — Notebook: Pit Humidity math + pressure wiring + SW fix

**For:** Notebook coder
**From:** Overseer (teardown audit 2026-09-29 — full detail in `AUDIT-2026-09-29-TEARDOWN.md`, findings F-2/F-3/F-4/F-6)
**Date:** 2026-09-29
**Priority:** High — the humidity numbers shown to users are provably off in the exact RH band the spec calls the smoker operating zone

## Heads-up first: the tests run now

`npm test` exists as of today (vitest wired at repo root). Your `pitHumidity.test.js` executes for the first time in its life and **6 of its cases fail** (3 unique, mirrored in the web copy). These failures are yours to clear. Everything below is what they caught.

## 1. FIRST: stop hardcoding Waukesha's pressure in the cook screens (F-4)

Two of the three humidity call sites throw away the resolved pressure:

- `src/components/CookForm.jsx:349` — passes `DEFAULT_PRESSURE_KPA`
- `src/components/CookDetail.jsx:144` — passes `DEFAULT_PRESSURE_KPA`
- `src/components/NotebookPitHumidity.jsx:122` — correct, passes `pressure.valueKPa`

`DEFAULT_PRESSURE_KPA = 98.3` is documented in `pressureResolver.js` as Waukesha at ~860 ft. So the RH shown while logging or viewing a cook assumes every user lives in Joel's backyard. Route both call sites through `resolvePressure()` — CookForm already fetches/caches weather (the resolver's source #2), so the plumbing mostly exists.

**Order matters:** do this before or together with item 2. Today the two bugs mask each other (pressure barely moves the answer, so hardcoding it is invisible). Fix the math first and the cook form will suddenly disagree with the Pit Humidity screen for anyone not at ~860 ft.

## 2. The pressure response is ~10× too weak (F-3)

Measured at 275°F dry / 160°F wet: sea level → 7,000 ft moves the app's RH **9.44% → 9.75%** (+0.31 points). The spec's own chart expects sea level → 3,400 ft alone to move it 9% → 11% (+2.0 points). Investigate how `src/pitHumidity.js` uses psychrolib — RH derivation from the wet-bulb path is barely pressure-sensitive, which is either a unit/ordering bug in our wrapper or a genuine chart-vs-ASHRAE modeling difference.

## 3. Then re-run the failing fixtures and rule: math or fixtures? (F-2)

The 3 failing cases (both copies of `pitHumidity.test.js`):

| Elevation | Dry/Wet | Chart | App | Error (tol ±1) |
|---|---|---|---|---|
| sea level | 220/140 | 12% | 14.67% | +2.67 |
| 3,400 ft | 275/160 | 11% | 9.61% | −1.39 |
| 3,400 ft | 300/160 | 8% | 6.39% | −1.61 |

The two altitude failures will likely resolve if item 2 is a real bug. The sea-level 220/140 case (+2.67, the worst miss) will not — decide whether that fixture was mis-digitized from the chart or the math is off at high wet-bulb depression, and document the call in the test file.

## 4. One-liner: `selfDestroying: true` (F-6)

`vite.config.native.notebook.js` VitePWA block (~line 40) still registers a precaching `autoUpdate` service worker with **no `selfDestroying: true`** — the exact config that made Board 2.4.0 serve 2.3.9's UI. Board got the flag in 2.4.1; Notebook never did. Copy the one line from `vite.config.native.board.js:73`.

## Coordination

- `src/pitHumidity.js` and `website/src/pitHumidity.js` are currently byte-identical (mod line endings). You own the math; the Website session mirrors your fixed file (their request references this one). Run `npm run check:drift` after — pitHumidity should stay identical across the fork.
- The vite config change + any src change = full AAB queue rebuild per standing discipline. Run `npx cap sync android` before the first Notebook gradle bundle, and ping siblings before starting a queue loop.

## Acceptance

- `npm test` → 0 failures (or failing fixtures amended with a documented digitization correction)
- CookForm and CookDetail humidity matches NotebookPitHumidity for the same inputs at a non-default pressure
- `vite.config.native.notebook.js` has `selfDestroying: true`
- `npm run check:drift` shows `pitHumidity.js` identical in both trees
