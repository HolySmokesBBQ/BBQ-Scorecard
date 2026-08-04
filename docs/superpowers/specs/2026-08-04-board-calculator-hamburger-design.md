# BBQ Board — Calculator + Hamburger Menu

**Date:** 2026-08-04
**Owner:** Board session (Joel Muiller)
**Ship order:** Android first (Play Store internal testing → tester feedback → UI iteration → iOS via Codemagic rebuild once stable)

## Why

Board's users are standing in the meat aisle trying to decide how many pounds of brisket to buy. Right now they're guessing, or they close Board and open the standalone BBQ Calculator app (`src/App.calculator.jsx`) which lives on the website but nowhere useful when they're phone-in-hand at Costco. Pulling a lightweight version of that calculator directly into Board removes the friction at the exact buy-decision moment.

Existing Board UI has no hamburger menu — just a slim header (Back / About / Sign in) — so introducing the calculator forces a bigger nav conversation: we need a menu structure that scales beyond Calculator (Settings screen, future tools) and matches the pattern Scorecard and Notebook already established.

## Scope

**In scope:**
- Hamburger menu on Board (right-side drawer, ☰ button top-right, safe-area aware) matching Scorecard/Notebook visual language.
- Calculator screen inside Board with two panels: "How much to buy for X guests" and "Post-smoke yield."
- Per-meat shrinkage slider (baseline from `MEAT_GUIDE`, user overrides persist in `localStorage`).
- Minimal Settings screen (default region, distance units, sign-in/out, Privacy + Delete Account links, version + changelog).
- AboutScreen relocated: entry point moves from header button to hamburger footer. The existing modal component stays as-is.

**Out of scope for this design (deferred):**
- Migrating the List/Map toggle into the hamburger. Those are view modes on the same screen, not nav destinations. Moving them slows the primary interaction.
- Cook time / schedule / smoker capacity math from the full standalone Calculator. Board's job is buy-decision support; anyone planning a full cook uses the standalone Calculator app.
- Wood pairing, batch scheduling, cross-app deep links to Notebook. Later.

## Menu structure

Drawer content (matches Scorecard/Notebook conventions — titled groups in Oswald with `letterSpacing: 2`, text-only item buttons with a bottom border between them, About pinned in the footer):

```
BBQ BOARD
  Home                (shop directory — default landing)

TOOLS
  Calculator          (new)

ACCOUNT
  Settings            (new)

─────────────────────
ABOUT HOLY SMOKES BBQ  (footer, opens existing AboutScreen modal)
```

Board's About button in the current Header (`src/App.board.jsx:572`) moves to this footer. Sign-in / Sign-out stays in the header — it's an authentication toggle, not a nav destination, and matches the pattern used across Scorecard/Notebook.

## Calculator screen

Two panels stacked (buy first because it's the more common Board use case, yield second for pitmaster sanity-check):

### Panel A: "How much to buy for X guests"

**Inputs:**
- Guest count (number, default 8)
- Portion size chip picker: Light / Normal / Hearty (default Normal — reads `MEAT_GUIDE[meat].serving.defaults[level]`)
- Meat multi-select — each checked meat displays its shrinkage slider inline

**Output card per meat:**
- Total cooked pounds needed (guests × servings/person × `cookedLbEach`)
- **Raw pounds to buy** = cooked ÷ (1 − shrinkage) — this is the number that matters at the counter
- Suggested cut count based on `typicalCutLb` (e.g. "2 whole packers @ ~12 lb each")

### Panel B: "Post-smoke yield"

**Inputs:**
- Meat picker (single)
- Raw pounds going on the smoker (number)
- Shrinkage slider (same slider that appears in Panel A for this meat; changes here sync to Panel A)

**Output:**
- Cooked pounds coming off = raw × (1 − shrinkage)
- Number of servings at Normal portion size, for reality-checking against your guest list

### Shrinkage slider (the key ask)

For each meat, the slider ranges from `baseline − 15pp` to `baseline + 15pp`, with the baseline value marked with a visible tick and label. Examples:

| Meat            | Baseline shrinkage | Slider range |
|-----------------|--------------------|--------------|
| Brisket         | 50%                | 35–65%       |
| Pulled Pork     | 35%                | 20–50%       |
| St. Louis Ribs  | 30%                | 15–45%       |
| Baby Back Ribs  | 30%                | 15–45%       |
| Chicken (whole) | 25%                | 10–40%       |
| Turkey (whole)  | 25%                | 10–40%       |
| Tri-tip         | 30%                | 15–45%       |
| Sausage         | 15%                | 5–30%        |

The ±15pp window covers realistic pitmaster variance (offset vs pellet, hot-and-fast vs low-and-slow) without letting users dial in absurd values that would nuke the buy math. Each user's overrides persist in `localStorage` under the key `board-calc-shrinkage-overrides` (JSON object keyed by meat name). Resetting to baseline is one tap ("Reset to baseline" link under each slider).

Baseline values come from `MEAT_GUIDE` in `src/constants.js`. That's already sourced from the pit references (Franklin, Meathead, KCBS, National Pork Board, Raichlen) per that file's comment.

## Settings screen

Minimal — Board is a simpler surface than Scorecard/Notebook:

- Default region (dropdown, uses `STATES` + `STATE_LABELS` from `src/board/schema.js`)
- Default search radius (chips: 10 / 25 / 50 / 100 mi)
- Distance units (mi / km)
- Sign in with Google / Sign out (mirrors header state)
- Privacy Policy → external link to `holysmokesbbqco.com/privacy-board.html`
- Delete Account → external link to `holysmokesbbqco.com/delete-account-board.html`
- App version + changelog link (external to `holysmokesbbqco.com/board/changelog`)

Deliberately omitted (present in Scorecard/Notebook settings, not relevant to Board):
- Theme toggle — Board is dark-mode only.
- Cloud sync toggle — Board writes go straight to Firestore automatically; there's nothing local to sync.
- Data export — user's submitted prices are public on the leaderboard; no private user data to export.

## Files

**New:**
- `src/components/BoardHamburger.jsx` (~150 lines) — mirrors `src/components/NotebookHamburger.jsx`, adapted for Board's palette (`PAL` object from `App.board.jsx`) and menu items.
- `src/board/Calculator.jsx` (~450 lines) — the two-panel screen. Uses `MEAT_GUIDE` from `src/constants.js`. Owns its own shrinkage-override state + localStorage persistence.
- `src/board/Settings.jsx` (~180 lines) — the minimal settings surface described above.

**Edited:**
- `src/App.board.jsx` — mount `<BoardHamburger>` globally next to `<AboutScreen>`, add `view` state ('home' / 'calculator' / 'settings'), route to `<Calculator />` and `<Settings />` when their nav keys fire, remove the About button from `<Header>` (it moves to the drawer footer).

**Not touched:**
- `src/board/schema.js` — no data-model changes.
- `src/App.board.jsx` shop directory, map, submit flows — unchanged.
- `src/constants.js` `MEAT_GUIDE` — the calculator READS this, doesn't modify.
- Native projects (`android-board/`, `ios-board/`) — Capacitor picks up the new web code on the next `npm run build:board-native` + sync.

## Rollout

1. Build all three new files + the App.board.jsx edits.
2. `npm run build:board-native` + `npm run sync:board`.
3. Bump `versionCode` / `versionName` in `android-board/app/build.gradle` — v2.3.6 is next.
4. **Rebuild the pre-built queue** (v2.3.6 → v2.4.3, 8 AABs) per [[feedback-rebuild-queue-on-code-change]]. The currently-buffered AABs were built before Calculator existed and are now stale source.
5. Sign new v2.3.6 AAB, upload to Play Store **Internal Testing** first.
6. Iterate on UI feedback from internal testers before promoting to Closed/Production.
7. Once UI is stable, one Codemagic run on Board's yaml delivers the same code to iOS TestFlight automatically (`submit_to_testflight: true` is already in place post-2026-08-03 fix).

## Non-goals / anti-scope

- **Cross-promo to standalone BBQ Calculator app.** We're not linking users out. The whole point is keeping them in Board at the buy moment.
- **Sync of shrinkage overrides across devices.** LocalStorage per-device is fine; pitmasters using multiple devices are a rounding error, and Firestore write cost isn't worth it for a personal preference.
- **Cook time or schedule.** Those live in the standalone Calculator; scope creep pulls this into a full port when a lightweight surface is what serves Board's audience.

## Risks

- **Users expect the full standalone Calculator experience.** Board's calculator intentionally stops at buy/yield math because that's the Board moment; anyone wanting cook time, schedule, or smoker capacity is a Notebook/standalone-Calculator user. Mitigation: name the screen simply "Calculator" and let its short surface set the expectation; only add a cross-link out if internal testers actually ask for it. Aggressive cross-promo contradicts the non-goal above.
- **Shrinkage slider becomes a source of price submissions that don't match reality.** People might dial in absurd overrides then compare their raw-lbs-to-buy against Board's price data and get confused. Mitigation: cap the slider range at ±15pp, make baseline the visible default, one-tap reset.
- **Adding a fourth top-level screen (Home / Calculator / Settings + shop detail modal) may slow Board's cold-start.** Mitigation: lazy-load Calculator and Settings, same pattern Scorecard uses (`lazy(() => import('./components/Settings.jsx'))`).
