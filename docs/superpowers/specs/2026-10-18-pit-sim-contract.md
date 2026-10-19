# Pit sim, backyard rung: module contract

**Date:** 2026-10-18. v1 contract written in the morning; v2 interface delta (the section right below) rewritten the same evening for four parallel builders. Read the delta first. **v2.1 (2026-10-18, late):** the section "v2.1 tutorial, burn warning, charcoal" right below this header is law for the v2.1 round (guided tutorial, gentler burn with a warning, new charcoal art; rules in `docs/superpowers/specs/2026-10-18-pit-sim-v2-1-tutorial.md`). Read it first, then the v2 delta.
**Design spec:** `docs/superpowers/specs/2026-10-18-pit-sim-design.md` (the rules). Its top section "v2 (2026-10-18): dense yard, seating, feedback" is cited here as [V2.n]; older sections are cited as [spec n]. Where this document and the design spec disagree on a name or a signature, this document wins; where they disagree on a rule of play, the design spec wins and the builder notes it under Deviations in their own file header.
**Files:** `games/pit-sim/index.html` (shared shell), `games/pit-sim/sprites.js`, `games/pit-sim/sim.js`, `games/pit-sim/game.js`, `games/pit-sim/dev/smoke.mjs` (harness, never shipped), `games/pit-sim/dev/sheet.html` (sprite sheet viewer, never shipped), optionally `games/pit-sim/dev/econ.mjs` (economy rerun, never shipped).
**Load order:** `sprites.js`, `sim.js`, `game.js`, each with `defer`, in that order, from `index.html`. Deferred scripts run in document order after parsing, so `game.js` may assume both other modules are present on `window.PitSim` when it runs.
**Law:** implement every name below with the exact signature and semantics. Add nothing to the shared surface without listing it under a `// Deviations` comment at the top of your file. Never read another module's internals (anything not named here). Never edit a file you do not own.

Every rule of play (numbers, step order, order rule, pull order, strings) lives in the design spec and is not repeated here unless the interface needs it.

---

## v2.1 tutorial, burn warning, charcoal

**Date:** 2026-10-18, late. **Rules:** `docs/superpowers/specs/2026-10-18-pit-sim-v2-1-tutorial.md`, cited here as [T n]. This section is law for the v2.1 builders exactly as the v2 delta was for v2: where it and anything below disagree, this section wins. Everything below it stands unless a K section names it. Builder deviations are listed in each file header as before.

### K0. Who owns what (v2.1)

Replaces the v2 table below for this round.

| Builder | Owns (may edit) | Writes against | Must not touch |
|---|---|---|---|
| **Art** | `sprites.js`, `dev/sheet.html` | K9, [T 4] | everything else |
| **Sim** | `sim.js`, `dev/econ.mjs` | K1 to K8, [T 2], [T 3], [T 5] | everything else |
| **Game** | `game.js`; in `index.html` exactly the v2 `#wrap` rule and the two `.tut-pulse` rules of K8 | K7 sentences, K8, K9 (calls only), K10, [T 2.6], [T 3.4] | everything else, and every other line of `index.html` |
| **Harness** | `dev/smoke.mjs` | K11, every public name in this document | everything else |
| Overseer | the four spec docs | | the builders' files |

The harness reads only public names (the `PitSim.*` surface, `sim.state`, DOM ids, the `PitSim.game` hooks of K10). Its Node steps may write a headless sim's state as a test fixture (K11 step 10 holds a fire hot); the browser steps never write sim state. Every builder runs `node --check` on each script they edited and scans each edited file for U+2014 and U+2013.

### K1. Names

| Name | Meaning |
|---|---|
| `state.tutorial` | `{ step: TutorialStepId \| null, done: boolean }`, exactly these two keys |
| `TutorialStepId` | `'open' \| 'charcoal' \| 'light' \| 'meat' \| 'puton' \| 'cook' \| 'slice' \| 'plate' \| 'customer' \| 'seated' \| 'end'`, always in this order (`STRINGS.tutorialOrder`) |
| target | a `StationId` (canvas arrow), the DOM id `'open'` (pulse), or `null`; from `sim.tutorialStep()`, never stored in state |
| `Piece.warn` | the warning flag of [T 3.3] |
| `burn_warning.station` | a `CookerId`; the field is named `station` as the v2.1 brief named it, although `piece_done` and `piece_burnt` call the same value `cooker` |
| save version | `C.SAVE_VERSION` 3; the game version is v2.1 and `PitSim.game.version` is `'0.4.0'` |

No new top level name on `PitSim`. `burnMult` and the tutorial's `endAt` are internal to `sim.js`.

### K2. `PitSim.C` and `PitSim.MEATS`

New keys, read by name, never hard coded: `WARN_FRAC: 0.4`, `HOT_BURN_MULT: 1.0`, `TUTORIAL_FIRE_FLOOR: 30`, `TUTORIAL_END_S: 6`; in `C.FX`: `ARROW_BOB_S: 0.3`, `WARN_BLINK_S: 0.25`. Changed: `SAVE_VERSION: 3`. `MEATS[m].window`: sausage 14, chicken 16, ribs 18, butt 22, brisket 26 (was 6, 8, 10, 14, 18). Every other key and every other `MEATS` field keeps its v2 value, including `HOT_MULT: 1.2`.

### K3. State

```ts
state.tutorial: { step: TutorialStepId | null, done: boolean };   // [T 2.1]; step is null exactly when done
Piece: v2 Piece & { warn: boolean };                              // false when put on; set once by [T 3.3]
```

`game.js` reads both and never writes them.

### K4. Methods

New, own properties of the sim object (destructuring works), fresh results each call:

| Method | Returns | Semantics |
|---|---|---|
| `skipTutorial()` | `boolean` | [T 2.5]. Running: ends it, emits `tutorial_done { skipped: true }`, plus `save_wanted { reason: 'tutorial' }` in the morning; in service resumes the held clock and sets `spawnAt` to `C.GATE_OPENS` when `clock < C.GATE_OPENS`, else `clock`; returns `true`. Not running: `false`, no change, no event. Legal in any phase, paused or not. |
| `tutorialStep()` | `null \| { id: TutorialStepId, text: string, target: string \| null }` | `null` when `state.tutorial.done`; else the current step, `text === STRINGS.tutorial[id]`, target per [T 2.2] for the current state |

Changed:
- `verbAt()` and `interact()`: at a cooker, when the pull order picks a `done` piece with `warn === true`, the label is `STRINGS.pullNow` instead of `'Pull ' + MEATS[m].label`; the action is unchanged.
- `openGate()`: `spawnAt = Infinity` while the tutorial runs ([T 2.4] C).
- `reset()`: the new game starts the tutorial at `open`; event order `save_clear`, then the morning's events, then `tutorial_step { id: 'open', ... }`.
- `createSim(saved, seed)`: `state.tutorial` from the save ([T 2.1]); when running, emits `tutorial_step` for `open` after the morning's events.

### K5. Rules the interface depends on

- **Where the step is checked** ([T 2.3]): at the end of `tick()`, `interact()`, `openGate()`, `skipTutorial()`, `reset()`, and when `createSim` returns. `tutorial_step` is emitted whenever the (id, target) pair differs from the last one emitted, so one step can emit more than once (on the happy path only `cook`, with target `null` then `'kettle1'`).
- **Order of events on the happy path:** `yard_open`, `tutorial_step charcoal`; at the pile `tutorial_step light`; at the light `tutorial_step meat`; at the cooler `tutorial_step puton`; at the put on `tutorial_step cook` (target null); `piece_done`, `tutorial_step cook` (target kettle1); at the pull `tutorial_step slice`; `slice_done`, `tutorial_step plate`; `set_down`, `tutorial_step customer`, `gate_open`, `customer_arrived`; `served`, `seat_taken`, `tutorial_step seated`; `seat_done`, `tutorial_step end`; then `tutorial_done { skipped: false }` `C.TUTORIAL_END_S` later. `gate_soon` is never emitted on a tutorial day.
- **Clock** ([T 2.4] A, B): `state.clock` stays 0 in service until the step becomes `customer`, then is exactly `C.GATE_OPENS` and counts on; stored clocks (`putOn`, plate `times`) shift with it.
- **Tick stages while running:** stage 3 (fire) applies the floor of [T 2.4] G; stage 4 (pieces) holds done pieces ([T 2.4] E); stage 5 skips patience, `wait` and mood for waiting customers ([T 2.4] D); stage 6 spawns nothing while `spawnAt` is `Infinity` ([T 2.4] C). The scripted spawn of [T 2.4] F draws no `rng()`.
- **Done rate and warning** ([T 3.2], [T 3.3]): in stage 4, a `done` piece advances by `burnMult(fire) * TICK_SECONDS` (`HOT_BURN_MULT` in the hot band, `fireMult` otherwise); per piece and tick the order is the done check, then the warning check (`burn_warning` once), then the burnt check.
- **Day end** ([T 2.4] H): a till that runs while the tutorial runs first emits `tutorial_done { skipped: false }`.

### K6. Save and `validateSave`

`SAVE_KEY` unchanged. The version 3 shape is [T 2.8]: the v2 keys plus `tutorial: { done: boolean }`. `validateSave(obj)`:

- `v === 3`: every v2 rule; `tutorial.done` is `false` only when `obj.tutorial` is a plain object with `done === false` and the validated `day === 1`, else `true`; unknown keys in `tutorial` dropped.
- `v === 2`: the v2 rules, returned as `v: 3` with `tutorial: { done: true }`.
- `v === 1`: the v1 rules and the v2 defaults, returned as `v: 3` with `tutorial: { done: true }`.
- Anything else: `null`. Never throws.

`serialize()` always writes `v: 3` and `tutorial: { done }`. `game.js` keeps the v1 notice on `parsed.v === 1` only (D9); a v2 save migrates silently.

### K7. Events (rows added to the D10 table)

| type | payload | when | sentence (`#live`) | status |
|---|---|---|---|---|
| `tutorial_step` | `id, text, target` | K5 | `text`, only when `id` differs from the last spoken step id | **new** |
| `tutorial_done` | `skipped: boolean` | the tutorial ended: `end` ran out, `skipTutorial()`, or the till of [T 2.4] H | none | **new** |
| `burn_warning` | `station, slot, meat` | a done piece entered the warning stage, once per piece | `STRINGS.burnWarn[meat]` | **new** |
| `save_wanted` | `reason` gains `'tutorial'` | `skipTutorial()` in the morning | none | `'tutorial'` **new** |
| `yard_open` | | unchanged | no sentence while the tutorial runs; v2 sentence otherwise | changed |

Every other D10 row is unchanged.

### K8. `PitSim.STRINGS` additions and the shell rule

```js
tutorial: Object.freeze({
  open: 'This is your morning. The cart is already filled. Tap Open the yard.',
  charcoal: 'Grab charcoal from the pile.',
  light: 'Tap the kettle to light it.',
  meat: 'Grab meat from the cooler.',
  puton: 'Put it on the kettle.',
  cook: 'Watch the box fill. Pull it when it turns green.',
  slice: 'Slice it at the board.',
  plate: 'Set the plate on the counter.',
  customer: 'Here comes your first customer.',
  seated: 'Served. They will sit and eat, then tip a little more.',
  end: 'You have the hang of it. Keep the fire fed and keep them happy.'
}),
tutorialOrder: Object.freeze(['open', 'charcoal', 'light', 'meat', 'puton', 'cook', 'slice', 'plate', 'customer', 'seated', 'end']),
pullNow: 'Pull it now',
burnWarn: Object.freeze({
  sausage: 'The sausage is about to burn.',
  chicken: 'The chicken is about to burn.',
  ribs: 'The ribs are about to burn.',
  butt: 'The pork butt is about to burn.',
  brisket: 'The brisket is about to burn.'
})
```

Strings owned by `game.js` (section 4.9 gains): `Controls` (the renamed `#howto-btn` and the new `#pause-controls`) and `Skip tutorial` (`#tut-skip`, `#pause-skip`). "How to play" is retired.

`index.html` gains exactly these two rules, added by the Game builder inside the existing `<style>` right before the `@media (prefers-reduced-motion: reduce)` block (that block already stops the animation, which leaves a static gold ring):

```css
.tut-pulse { box-shadow: 0 0 0 3px var(--y); animation: tut-pulse 1.2s ease-in-out infinite; }
@keyframes tut-pulse { 50% { box-shadow: 0 0 0 3px var(--c); } }
```

### K9. `PitSim.art` (amends D11)

`PALETTE` (32), `COLOR` (31 keys) and the legend are unchanged. `art.text` maps `.` to `font` frame 38 and `,` to frame 39; `art.textWidth` counts both as glyphs; every other mapping is unchanged. Replaced in place (same name, size, frame count and frame meanings): `pile` 16x16 4 and `hand_charcoal` 8x8 1. Changed frame counts: `piece_*` 5 (frame 4 added), `font` 40. New: `arrow` 8x12 4, `bubble_warn` 8x10 2. The look and the grid rules are [T 4]; the harness checks the rules of K11 step 14. No `icon_charcoal`. **REQUIRED SPRITES v2.1**, 115 names, 281 frames; the harness copies this literal verbatim and it replaces the D11 literal:

```js
const REQUIRED_SPRITES = [   // [name, w, h, frames]
  ['player_down', 16, 24, 3], ['player_up', 16, 24, 3], ['player_side', 16, 24, 3], ['player_slice', 16, 24, 2],
  ['buddy_down', 16, 24, 3], ['buddy_up', 16, 24, 3], ['buddy_side', 16, 24, 3], ['tender_down', 16, 24, 3],
  ['tender_up', 16, 24, 3], ['tender_side', 16, 24, 3], ['cust0_down', 16, 24, 5], ['cust0_up', 16, 24, 3],
  ['cust0_side', 16, 24, 4], ['cust0_sit', 16, 24, 3], ['cust1_down', 16, 24, 5], ['cust1_up', 16, 24, 3],
  ['cust1_side', 16, 24, 4], ['cust1_sit', 16, 24, 3], ['cust2_down', 16, 24, 5], ['cust2_up', 16, 24, 3],
  ['cust2_side', 16, 24, 4], ['cust2_sit', 16, 24, 3], ['cust3_down', 16, 24, 5], ['cust3_up', 16, 24, 3],
  ['cust3_side', 16, 24, 4], ['cust3_sit', 16, 24, 3], ['shadow', 12, 4, 1], ['dog', 16, 16, 4],
  ['hand_charcoal', 8, 8, 1], ['hand_raw_sausage', 8, 8, 1], ['hand_raw_chicken', 8, 8, 1], ['hand_raw_ribs', 8, 8, 1],
  ['hand_raw_butt', 8, 8, 1], ['hand_raw_brisket', 8, 8, 1], ['hand_cooked_sausage', 8, 8, 1], ['hand_cooked_chicken', 8, 8, 1],
  ['hand_cooked_ribs', 8, 8, 1], ['hand_cooked_butt', 8, 8, 1], ['hand_cooked_brisket', 8, 8, 1], ['hand_burnt', 8, 8, 1],
  ['hand_plate_sausage', 8, 8, 1], ['hand_plate_chicken', 8, 8, 1], ['hand_plate_ribs', 8, 8, 1], ['hand_plate_butt', 8, 8, 1],
  ['hand_plate_brisket', 8, 8, 1], ['hand_tray_sausage', 8, 8, 1], ['hand_tray_chicken', 8, 8, 1], ['hand_tray_ribs', 8, 8, 1],
  ['hand_tray_butt', 8, 8, 1], ['hand_tray_brisket', 8, 8, 1], ['hand_tray', 8, 8, 1], ['hand_togo', 8, 8, 1],
  ['icon_sausage', 8, 8, 1], ['icon_chicken', 8, 8, 1], ['icon_ribs', 8, 8, 1], ['icon_butt', 8, 8, 1],
  ['icon_brisket', 8, 8, 1], ['plate_sausage', 8, 6, 1], ['plate_chicken', 8, 6, 1], ['plate_ribs', 8, 6, 1],
  ['plate_butt', 8, 6, 1], ['plate_brisket', 8, 6, 1], ['piece_sausage', 10, 10, 5], ['piece_chicken', 10, 10, 5],
  ['piece_ribs', 10, 10, 5], ['piece_butt', 10, 10, 5], ['piece_brisket', 10, 10, 5], ['mark_x', 8, 8, 1],
  ['kettle', 16, 24, 4], ['drum', 16, 32, 4], ['cooler', 16, 16, 3], ['board', 16, 16, 2],
  ['counter', 32, 24, 2], ['counter_ext', 16, 24, 1], ['pile', 16, 16, 4], ['trash', 16, 16, 1],
  ['paver', 16, 16, 2], ['lawn_a', 16, 16, 2], ['lawn_b', 16, 16, 2], ['fence_h', 16, 24, 1],
  ['fence_v', 16, 24, 1], ['fence_corner', 16, 24, 1], ['fence_back', 16, 16, 2], ['gate', 16, 24, 2], ['hedge', 16, 24, 2],
  ['bed', 16, 20, 4], ['shed', 48, 32, 1], ['sign', 44, 12, 1], ['tree', 32, 48, 1],
  ['woodpile', 16, 16, 1], ['hose', 16, 16, 1], ['tools', 16, 24, 1], ['pot', 16, 16, 1],
  ['planter', 16, 24, 1], ['shelf', 16, 24, 1], ['mailbox', 16, 24, 1], ['picnic', 32, 24, 1], ['picnic_bench', 32, 8, 1],
  ['chair', 16, 24, 1], ['lights_post', 16, 32, 1], ['lights_string', 66, 10, 2], ['birdbath', 16, 24, 2],
  ['canopy', 40, 32, 1], ['bubble', 16, 12, 1], ['heart', 8, 8, 2], ['sparkle', 7, 7, 3],
  ['smoke', 8, 8, 3], ['smoke_dark', 8, 8, 3], ['fire', 8, 8, 3], ['coin', 8, 8, 2],
  ['sweat', 4, 6, 2], ['zzz', 8, 8, 3], ['font', 4, 6, 40],
  ['arrow', 8, 12, 4], ['bubble_warn', 8, 10, 2]
];
```

Frame indexes added to the D11 list: `piece_*` 4 about to burn; `arrow` 0 down, 1 down bobbed 2 px lower, 2 up (frame 0 mirrored top to bottom), 3 up bobbed 2 px higher (frame 1 mirrored); `bubble_warn` 0 red card with a white mark, 1 yellow card with a dark mark (review round 2, was red and orange marks on cream); `font` 38 `.`, 39 `,`; `pile` 0 full (5 or more), 1 half (3 or 4), 2 low (1 or 2), 3 empty (review round 2, was full over 6 and half 3 to 6, so day 1's 5 bags show the full heap).

### K10. `game.js` (amends D12 and D14)

**Render order** (D12 additions): pass 2 draws `piece_*` frame 4 for a `done` piece with `warn`, and the cooking arc red `o` in the warning stage; **round 1:** pass 2 also draws a cooker's `fire` right after its gauge and before its pieces (it no longer draws in pass 4), and draws the pieces on one cooker in two runs, every piece that is not a `done` piece with `warn` first, then the warning pieces with their red rings, so the overlapping kettle slots never hide a warning; pass 4 draws a warning cooker's chimney puffs with `smoke_dark`; pass 5 draws `bubble_warn` at (draw.x - 2, draw.y - 11) per cooker with a warning piece (round 1: left of the vent, was draw.x + 4), frames by `C.FX.WARN_BLINK_S`; pass 6 draws the `arrow` last ([T 2.6] placement: x = draw.x + floor(w / 2) - 4, above at draw.y - 12 with frames 0 and 1 when draw.y - 12 >= 22, else below at draw.y + h with frames 2 and 3, and, review round 2, not at all while the center of its 8x12 box falls on the player's drawn 16x24 body, above or below alike, since it would sit on the player and the `#act` pulse carries the step (this replaces round 1's rule, not drawn when below and `sim.reach()` is the target station); a tap on the drawn arrow is a tap on its station (round 2, [T 2.6]); frames swap every `C.FX.ARROW_BOB_S` of the effect clock); pass 8 draws the tutorial banner in service ([T 2.6] box, wrap and placement, the placement as amended at integration in K13 item 1) and then skips the clock box and the GATE OPENS IN text. Positions on this map: pile (68, 48), kettle 1 (84, 48), cooler (100, 32) below; board (84, 52), table (108, 76) above.

**DOM** (section 4.4 gains):

| id | where | what |
|---|---|---|
| `howto-btn` | `#clip-foot` row | label `Controls` (was How to play); opens `#howto` |
| `tut-clip` | `#clip-top`, right after the header line | `p.card`, `STRINGS.tutorial.open`; present only while the step is `open` |
| `tut-skip` | `#clip-top`, right after `#tut-clip` | `button.alt` `Skip tutorial`; calls `sim.skipTutorial()`, pumps, rebuilds the clipboard; present only while the tutorial runs |
| `pause-controls` | `#pause-body`, after `#resume` | `button.alt` `Controls`; opens `#howto` in place of the pause panel, Back and Escape return to it |
| `pause-skip` | `#pause-body`, after `#pause-controls` | `button.alt` `Skip tutorial`; present only while the tutorial runs; skips and stays on the pause panel |
| class `tut-pulse` | the DOM target (`#open`), and `#act` when the target station is in reach and `verbAt().enabled` | K8 CSS |

`#howto` shows only after `#howto-btn` or `#pause-controls`, or in the desktop side column during service with no panel open; it no longer shows beside the pause panel. The day 1 muted hint of v2 shows only when `state.tutorial.done`. While the tutorial runs the status line never shows `Gate opens in {n}`.

**`PitSim.game` v2.1** (every D14 member kept):

```ts
version: '0.4.0',
banner: null | { lines: string[], target: string | null }   // live, read only outside game.js: the banner lines as drawn (uppercase), null when none is drawn
FxEntry.kind gains 'warn'                                   // logged at the bubble position when a cooker's bubble starts
```

`captureFrame()` records the `arrow` and `bubble_warn` draws like any sprite; the banner box is procedural and its glyphs are `font` records.

**aria-live:** K7. **Reduced motion** (D14 gains): the arrow shows frame 0 (above) or 2 (below) only; `bubble_warn` frame 0 only; `.tut-pulse` is static (CSS); no warning puffs (no puffs at all, as v2).

### K11. Harness v2.1 (amends D15)

`GAME_VERSION '0.4.0'`; `C_EXPECT.SAVE_VERSION 3`; the K9 literal; `Object.keys(SPRITES).length === 115`; `SURFACE_COUNTS` unchanged; screenshots add `tutorial.png` and `warning.png`. 45 steps, the 38 v2 steps in order with seven inserted (**new**) and the amended ones marked:

| # | step | asserts |
|---|---|---|
| 1 | files present | as v2 (fatal) |
| 2 to 4 | node --check sprites.js, sim.js, game.js | exit 0 |
| 5 | sim.js loads headless with the full surface | v2 checks with `C.SAVE_VERSION === 3`; **added:** `C.WARN_FRAC === 0.4`, `C.HOT_BURN_MULT === 1`, `C.TUTORIAL_FIRE_FLOOR === 30`, `C.TUTORIAL_END_S === 6`, `C.FX.ARROW_BOB_S === 0.3`, `C.FX.WARN_BLINK_S === 0.25`; windows 14, 16, 18, 22, 26 in `MEAT_IDS` order and cook times unchanged; `STRINGS.tutorial` has exactly the 11 ids with the K8 text, `STRINGS.tutorialOrder` deep equals the K1 order, `STRINGS.pullNow === 'Pull it now'`, `STRINGS.burnWarn` has the five K8 sentences; `typeof sim.skipTutorial === 'function'` and `typeof sim.tutorialStep === 'function'` on `createSim(null, 1)` |
| 6 | validateSave rejects, clamps and migrates | v2 checks, every result now `v: 3`; **added:** `{ v: 4 }` gives `null`; the section 2.8 v1 sample gives `tutorial.done === true`; a v2 sample (day 1) gives `v: 3`, `tutorial.done === true`; `{ v: 3, day: 1, tutorial: { done: false, bogus: 1 } }` gives `done === false` and no `bogus`; the same with `day: 3` gives `done === true`; `{ v: 3 }` with no `tutorial` gives `done === true`; `createSim(null, 1).serialize()` has `v === 3` and `tutorial.done === false` and round trips through `validateSave` unchanged |
| 7 | seat reachability | as v2 |
| 8 | **new** tutorial rules, headless | `createSim(null, 1)`: `tutorialStep().id === 'open'` and target `'open'`; `openGate()` with the default cart; 800 ticks with no input: `clock === 0`, step `charcoal`, no `gate_soon`, `gate_open` or `customer_arrived`, `kettle1.fire === 0`. Then by `walkTo` and ticks (each wait at most 5 s unless noted): pile (4,2) gives step `light`; kettle 1 (5,2) gives `meat` and fire 60; cooler (6,1) gives `puton`; kettle 1 gives `cook` with target `null`; tick until `piece_done` (at most 20 s) then the next `tutorial_step` is `cook` with target `'kettle1'`; 1200 more ticks: the piece is still `done` with `prog` unchanged, `warn === false`, no `burn_warning` or `piece_burnt`, `kettle1.fire === C.TUTORIAL_FIRE_FLOOR`, no `fire_low`; kettle 1 again gives `slice` and cooked sausage in hand; board (5,4) and `slice_done` give `plate` with target `'table'`; table (6,6) gives, in this order in one drain, `set_down`, `tutorial_step customer`, `gate_open`, `customer_arrived { id: 1, meat: 'sausage' }`, and `clock === C.GATE_OPENS`; no second `customer_arrived` before `tutorial_step end`; `served` then `tutorial_step seated`; `seat_done` (at most 20 s) then `tutorial_step end`; a `customer_arrived` within 2 ticks of `end`, whose customer keeps `patience === patienceMax` until `tutorial_done`; `tutorial_done { skipped: false }` within `C.TUTORIAL_END_S + 0.1` s of `end`; then `state.tutorial` deep equals `{ step: null, done: true }`, `tutorialStep() === null`, and a waiting customer's patience drops on the next tick. The distinct consecutive `tutorial_step` ids over the run equal `STRINGS.tutorialOrder` minus `open` (emitted at creation, before the drain started) or equal it whole; `gate_soon` never fired |
| 9 | **new** skipTutorial, headless | (a) `createSim(null, 2)`: `skipTutorial() === true`, the drain holds `tutorial_done { skipped: true }` and `save_wanted { reason: 'tutorial' }`, `state.tutorial` is `{ step: null, done: true }`, `serialize().tutorial.done === true`, a second `skipTutorial() === false` with no event; `openGate()`: `spawnAt === C.GATE_OPENS`, then ticks: `gate_soon` at clock 20, `gate_open` and the first `customer_arrived` at clock 30. (b) `createSim(null, 3)`: `openGate()`, 100 ticks (clock 0), `skipTutorial() === true` with `tutorial_done` and no `save_wanted`; `spawnAt === C.GATE_OPENS`; the next tick has `clock === C.TICK_SECONDS`; `gate_open` at clock 30. (c) on that sim, `reset()` gives `state.tutorial` `{ step: 'open', done: false }` and a `tutorial_step` with id `open`. (d) `createSim(validateSave({ v: 3, day: 1, tutorial: { done: false } }), 4)` runs the tutorial at `open` |
| 10 | **new** burn warning at hot fire, headless | `createSim(null, 5)`, `skipTutorial()`, `openGate()`; pile, kettle 1, cooler, kettle 1 by `walkTo` and ticks; from the put on, before every tick the fixture sets `state.stations.kettle1.fire = C.FIRE_MAX` (hot band). Record clocks: put on, `piece_done`, `burn_warning`, `piece_burnt` for the slot 0 piece. Assert: done minus put on is `MEATS.sausage.cook / C.HOT_MULT` within 0.1 s (hot still cooks faster); exactly one `burn_warning` deep equal to `{ type: 'burn_warning', station: 'kettle1', slot: 0, meat: 'sausage' }`, at done plus `window * (1 - WARN_FRAC)` (8.4 s) within 0.1 s; `warn === true` from then on; burnt minus done is at least `MEATS.sausage.window - 0.1` (13.9 s) and at most 14.1 s; `burn_warning` came before `piece_burnt`; with the player on a kettle 1 use tile facing it and empty hands, `verbAt().label` is `'Pull Sausage'` one tick before the warning and `STRINGS.pullNow` one tick after. A second run with the fixture at fire 70 (good band) gives burnt minus done within 0.1 s of 14 |
| 11 | Chrome launched and CDP connected | as v2 (fatal) |
| 12 | page loaded with zero errors | as v2 with `game.version === '0.4.0'` and `'banner' in PitSim.game` (fatal) |
| 13 | only the four file:// requests | as v2 |
| 14 | sprite list and palette | the K9 literal; 115 names; palette and `COLOR` as v2. **Added, from `art.SPRITES` grids:** `pile` frames 0 to 2 contain no `s`, at most 3 `u` each, and `count('1') + count('t') >= 4 * (count('v') + count('s') + count('u'))`; frames 0 and 1 contain 1 to 3 `4` pixels; frame 3 contains no `t`, `v`, `u`, `4` or `k`; every frame contains `8` (the sack) and its row 15 contains `a`; `hand_charcoal` has at least 6 `1` and `count('1') + count('t') >= 2 * (count('v') + count('s') + count('u'))`; each `piece_*` frame 4 differs from frame 2 and has at least 4 more `1` pixels; `arrow` frame 1 is frame 0 shifted down 2 rows, frames 2 and 3 are frames 0 and 1 reversed row order, and its pixels are only `0`, `5`, `k`, `h`; `bubble_warn` frame 0 contains `o` and `3`; `art.textWidth('.,') === 9` |
| 15 | canvas scale is an integer | as v2 |
| 16 | canvas is device pixel exact on Android and laptop sizes | as v2 |
| 17 | clipboard: morning, day 1, start cash | v2 checks; **added** before the cart is emptied: `tutorialStep().id === 'open'`; `#tut-clip` text is `STRINGS.tutorial.open`; `#tut-skip` visible with text `Skip tutorial`; `#open` has class `tut-pulse`; `#howto-btn` text `Controls`; `#howto` hidden; the day 1 hint absent; `PitSim.game.banner === null` (fatal) |
| 18 | controls | was "how to": `#howto` hidden; click `#howto-btn`; `#howto` visible; Escape returns to the clipboard |
| 19 | bought | as v2 (fatal) |
| 20 | gate open | was v2's: phase service, cash, clipboard hidden, `#act` `Walk`, one `yard_open`; **changed:** `#status` does not start with `Gate opens in` (it reads `Hands empty`); `tutorialStep()` is `charcoal` with target `'pile'`; `PitSim.game.banner.lines` deep equals `['GRAB CHARCOAL FROM THE PILE.']`; `captureFrame()` holds an `arrow` at (68,48) with frame 2 or 3; `advance(25)` leaves `clock === 0` and no `gate_soon`; screenshot `tutorial.png` (fatal) |
| 21 | fire raised | **added:** before each tap the step's target is the station tapped (`pile`, then `kettle1`); after them the step is `meat` (fatal) |
| 22 | meat on | the target is `cooler`, then `kettle1`; **changed:** one unit only while the tutorial runs (the second goes on in step 29); after it the step is `cook` with target `null` (fatal) |
| 23 | piece done | as v2; **added:** the target turns `'kettle1'`; `advance(20)` leaves the piece `done`, `warn` false, no `burn_warning`, `kettle1.fire >= C.TUTORIAL_FIRE_FLOOR` (fatal) |
| 24 | sliced | the target is `kettle1` for the pull and `board` for the slice; after `slice_done` the step is `plate` with target `'table'` (fatal) |
| 25 | carried | as v2 (the slice already put a plate in hand) (fatal) |
| 26 | served with cash up and a served event | the target is `table`; **added:** right after the set down, step `customer`, `clock === C.GATE_OPENS`, one `gate_open`, customer 1 wants `sausage`; the `served` event is for customer 1 (fatal) |
| 27 | a served customer sits and a heart fires | as v2; **added:** step `seated` after `served`, step `end` after `seat_done` |
| 28 | **new** tutorial walked in order | until `tutorial_done` (at most `C.TUTORIAL_END_S + 1` s): `skipped === false`; the distinct consecutive `tutorial_step` ids seen equal `STRINGS.tutorialOrder` (with or without the leading `open`); the `cook` events carry targets `null` then `'kettle1'`; every `tutorial_step.text` equals `STRINGS.tutorial[id]`; `PitSim.game.banner === null` and no `arrow` record after; no `burn_warning`, `walk_out` or `fire_low` on day 1 before `tutorial_done`; `#live` showed the text of every step from `charcoal` on at least once (from this step on, the probe records each new `#live` text after every advance; steps 39 and later read that record) |
| 29 | rest of the day cooked and carried | as v2 |
| 30 | day over | as v2 |
| 31 | a walk-out with rep down, or the day sold out early | as v2 |
| 32 | till shown | as v2 |
| 33 | save key present and valid | as v2 with raw `v === 3` and `tutorial.done === true` |
| 34 | reload persists | as v2; **added:** day 2 with `tutorial.done`, no `#tut-clip` |
| 35 | decor purchase shows the sprite | as v2 (its v2 save migrates); the stored save validates with `v === 3` |
| 36 | v1 save migrates | as v2 with the stored save at `v === 3` and `tutorial.done === true` |
| 37 | **new** v2 save loads with the tutorial done | reload into a v2 save with `day: 1`, `cash: 80`, `charcoal: 5`, `stock.sausage: 3`, the rest default: `state.tutorial` is `{ step: null, done: true }`; `tutorialStep() === null`; no `#tut-clip`, `#tut-skip` or `tut-pulse`; the day 1 hint present; no Your save was updated notice; open the yard: `#status` starts with `Gate opens in`, `PitSim.game.banner === null`, no `arrow` record; `sim.serialize()` has `v === 3`, `tutorial.done === true` |
| 38 | **new** skip tutorial | step 37 left the yard open, so Escape, click `pause-new`, `confirm-yes`: a day 1 morning, step `open`, `#tut-skip` visible; click `#tut-skip`: one `tutorial_done { skipped: true }`, `#tut-skip` and `#tut-clip` gone, `#open` without `tut-pulse`, the day 1 hint present, `localStorage` save validates with `tutorial.done === true`. Again `clip-new`, `confirm-yes`; open the yard; Escape: `#pause` visible, `#pause-skip` visible, `#howto` hidden; click `#pause-skip`: `tutorial_done { skipped: true }`, `#pause-skip` gone, still paused; click `#resume`; `advance(31)`: `gate_soon` and `gate_open` fired at clock 20 and 30, `PitSim.game.banner === null` |
| 39 | **new** burn warning in the page | on step 38's day, by real taps: pile, kettle 1, cooler, kettle 1 (one sausage); wait for `piece_done` (feeding the fire as step 23 does); until `burn_warning` (at most `0.6 * 14 + 2` s); if `sim.reach() !== 'kettle1'`, `sim.walkTo(5, 3)`, settle, `sim.move('up')`; then, all inside the 5.6 s warning: `#act` text `Pull it now`; `captureFrame()` holds `piece_sausage` frame 4 at (80,25) and `bubble_warn` at (78,13); after `advance(1)` a `smoke_dark` record with 80 <= x <= 100 and y <= 24; `fxLog` has a `warn` at (78,13); screenshot `warning.png`; tap kettle 1: cooked sausage in hand, no `piece_burnt`. Then the probe's `#live` record holds `The sausage is about to burn.` within 6 s of the warning (advancing in 0.5 s steps) |
| 40 | pause and resume | **changed:** Escape shows `#pause` with `#howto` hidden and no `#pause-skip`; click `#pause-controls`: `#howto` visible, `#pause` hidden; Escape: `#pause` back; Escape resumes; P pauses and resumes as v2 |
| 41 | no sprite drawn outside the canvas | as v2, over the morning, mid service, step 20 and step 39 captures (the arrow and `bubble_warn` records included) |
| 42 | dog never on a station use tile | as v2 |
| 43 | layout and keyboard at 375 by 740 | as v2; **added:** the morning check is made with the tutorial running (after the reload, if `tutorialStep()` is null, start a new game with `clip-new` and `confirm-yes`), so `#tut-skip` is measured, and one pause in service measures `#pause-controls` and `#pause-skip` (44 by 44 or larger) |
| 44 | reduced motion | as v2, with the tutorial running (a new game first if `tutorialStep()` is null after the reload): in the morning `getComputedStyle(#open).animationName === 'none'` while it has `tut-pulse`; open the yard: `captureFrame()` arrow at (68,48) frame 2, and frame 2 again after `advance(0.6)` |
| 45 | zero console errors across the run | as v2 |

Fatal steps: 1, 11, 12, 17, 19 to 26, 30 and 34 (the v2 fatal set renumbered). `dev/econ.mjs` is still not a harness step.

### K12. Decisions made in this section

1. The step is worked out from the state (the table of [T 2.3]) up to the plate, then latched. A fixed script would strand a player who taps the cooler first.
2. Step j waits for `seat_done`, not `seat_taken`, which fires in the same tick as `served` ([T 2.2]).
3. The yard clock holds at 0 until the plate lands, then jumps to `GATE_OPENS`; plate ages shift with it so the first serve keeps its hot plate tip.
4. Every done piece holds while the tutorial runs, not only the first, so a second piece cannot surprise a new player.
5. `TUTORIAL_FIRE_FLOOR` is 30 (`FIRE_LOW_WARN`): never out, no fire low message during the tutorial, still cooking at 0.6.
6. The target lives in `sim.tutorialStep()`, so `state.tutorial` stays exactly `{ step, done }`.
7. Four pile frames stay (the brief named three; v2 already models four).
8. Warning puffs reuse `smoke_dark`; no charcoal icon is added because none existed; no palette entry is added.
9. `burn_warning` names its cooker `station`, as the brief did.
10. The how to card is kept as the Controls card, renamed and opened only on request; the id `#howto-btn` is kept so nothing else moves.
11. The save is version 3; v1 and v2 saves load with the tutorial done.
12. `.` and `,` join the pixel font so the banner keeps its sentences.

### K13. Integration record (v2.1, 2026-10-18, late)

The four v2.1 builds were integrated against K0 to K12 the same night. Result: `node games/pit-sim/dev/smoke.mjs` passes 45 of 45 steps in phone mode (seed 1), in `--desktop` mode and in phone mode with `--seed 7`, each with zero console messages, exceptions or log errors and only the four file:// requests (boredom 14 percent of service, 7 taps a plate). A seam diff (sprites.js and sim.js loaded in Node with a canvas stub, against the same files at b48e1be) found the surface exactly as K1 to K9 say: 13 top level names, none added; the 14 `art` members unchanged; 115 sprites, 281 frames, 32 palette entries, 31 `COLOR` keys; `C` adds exactly the four K2 keys and `C.FX` the two; `STRINGS` adds exactly `tutorial`, `tutorialOrder`, `pullNow` and `burnWarn`; of every other `C`, `C.FX`, `MAP`, `MEATS` and `CATALOG` value only the five windows moved (14, 16, 18, 22, 26); the sim object gains exactly `skipTutorial` and `tutorialStep` and the state exactly `tutorial`; `sim.js` emits 33 event types (the 30 D10 types plus `tutorial_step`, `tutorial_done` and `burn_warning`) and `game.js` has a case for every type with a sentence; every `C`, `C.FX`, `STRINGS`, `MAP`, `art` and sim member `game.js` reads exists; `game.js` never writes `state.tutorial` or `Piece.warn`; `index.html` differs from b48e1be by exactly the two K8 rules. `dev/sheet.html` loads headless with its K9 and K11 step 14 checks green. `dev/econ.mjs` is recorded in the design spec (V21.5 Built result). No builder file needed a change at integration.

Amended at integration (the K10 render order and [T 2.6] already carry this):

1. Banner placement, Game deviation 19 accepted. The banner keeps the [T 2.6] box, colors, wrap and text inset, and sits at (2, 2) except while the target is a station drawn in the top third of the canvas (the pile, the kettles, the cooler), when it sits on the bottom edge; a step with no target keeps the last placement. On the happy path that is the bottom from charcoal to cook and the top from slice to end: one move, at a step change. It keeps the chimney puffs in view while the player lights the kettle and watches the ring, keeps the banner well away from the arrow, and the top placement for the customer steps leaves the gate and the seats clear. No harness step reads the position. Reversing it is one assignment in `drawBanner`.

Builder deviations kept as written in each file header: Sim 24 to 27; Game 19 to 24 and its defensive guards (`typeof` checks on the two new methods, `art.has` checks on the two new sprites, fallbacks for the two new `C.FX` keys); Art (the pile shadow row in paver shade and outline brown, the slumped sack in pile frame 2 and the flat sack in frame 3, charred inner cells in piece frame 4, the scoop drawn as three briquettes on a steel scoop, the warning bubble glint and tail, the sheet additions); Harness 5 to 11 (browser clocks within 0.1 s, the fire after the light within 1, the `#live` record from probe install, real time pauses for the live queue, the two extra screenshots `tutorial-cook.png` and `tutorial-customer.png`, the `interact()` fallback that was never needed, the step 39 fire feed) plus its step 23 no feed rule, the step 26 `servedBefore >= 1` read and `INVALID_SAVES` holding `{ v: 4 }` and `{ v: '3' }`.

Checked by eye at integration (the harness screenshots from all three runs, plus headless zooms at 412 by 915 and DPR 2.625): the clipboard shows the tutorial card, Skip tutorial, the gold ring on Open the yard and Controls; the arrow bobs gold with a dark outline under the pile, kettle 1 and the cooler and over the board and the counter; the two line cook banner sits on the bottom edge clear of the kettle and its smoke; the first customer walks in under a top banner; the about to burn piece, the blinking red and orange "!" bubble over kettle 1 and Pull it now show together; the pile reads as a dark heap of pillow briquettes with grey faces, one ash speck and one ember beside a brown sack with a black flame mark, in four clearly different states (full, half, low with a slumped sack, the sack folded flat), and the pitmaster facing down holds a dark scoop of briquettes. The briquette faces are the same dark grey as the kettle body, so the heap reads darker than the kettle mainly through its near black outlines.

Known issues left open, for the Overseer (none is a contract violation):

1. Full grate during the tutorial. A player who puts two pieces on kettle 1 and then takes a third from the cooler holds raw meat over a full grate. The step is `cook` (row 8) with target `null`, or `puton` (row 4) pointing at the full kettle if it was never lit, so neither the arrow nor the pulse leads anywhere, and the held clock means the day does not move on. The way out exists (the cooler's button only "Put Sausage back", the trash, or Skip tutorial in the pause panel) but nothing points at it. A headless random tapper (walk to taps only, 400 seeds, random small carts) was stranded this way 50 times; allowed to press the action button too, 399 of 400 finished the tutorial (the last one hit the time cap during `end`), with no clock movement, burn, walk-out, fire low or gate warning before `tutorial_done` in any run. Suggested rule: while the hands hold a raw piece and kettle 1 has no free slot for it, the target is `'cooler'`. Not changed here: it is a rule of play in [T 2.3].
2. Trashing the only meat or the only bag of charcoal during the tutorial (both are button only actions) leaves a step that cannot be done; the same Skip tutorial way out applies.
3. The economy bot buys the drum 0 to 2 days later than v2 and ends day 10 with 18 less cash, as the pre build estimate said; the bot caveat of the v2 integration record still applies.
4. Joel's other two notes from the same play (he likes the play of the arcade sports game he named and the modern 8-bit look of the restaurant reference) are direction for later rungs, not part of v2.1.

### K14. Review round 2 (v2.1, 2026-10-18)

Changed, and carried into [T 2.6], [T 4] and K9 to K10 above: a tap on the drawn tutorial arrow is a tap on its station; the arrow hides when its center falls on the player's body, above or below the station; the facing up charcoal draws at y - 17, clear of the hair; `hand_charcoal` is a steel scoop of black briquettes; the sack is kraft brown with a crimped top and a flame printed on the brown, no cream label; the heap glints are single staggered pixels and the ember sits low on the right; `piece_*` frame 4 chars a 2 px rim; `bubble_warn` is a red card with a white mark that blinks yellow; the pile shows full at 5 bags; a two line banner is 21 tall. No name, size, frame count, palette entry or K11 grid rule changed, and no rule of play moved.

Left for the Overseer: the tutorial hands over kettle 1 at the fire floor (30) with the first normal customer already queued, and `fire_low` lands about a second after `tutorial_done`, before the player has added a bag to a lit kettle. The options named in review (an add a bag line during the idle part of `cook`, topping kettle 1 to `FIRE_LIGHT` when the step becomes `end`, or lifting the floor at `end`; the last one breaks K11 step 28's no `fire_low` before `tutorial_done`) are rules of play in [T 2.4] G and are not changed here.

---

## Who owns what (v2)

> **Superseded for the v2.1 round by K0** (the Game builder also adds the two `.tut-pulse` rules to `index.html`). Kept as the v2 record.

Four builders work at the same time and do not talk. Each owns only the files in their row.

| Builder | Owns (may edit) | Writes against | Must not touch |
|---|---|---|---|
| **Art** | `sprites.js`, `dev/sheet.html` | D11 (palette, legend, the 113 sprites, `drawScaled`, `textTinted`), [V2.10], [V2.11] | everything else |
| **Sim** | `sim.js`, optionally `dev/econ.mjs` | D2 to D10, [V2.2] to [V2.7], [V2.14], [V2.15], [V2.17], [V2.19] | everything else |
| **Game** | `game.js`, and in `index.html` exactly one CSS rule, `@media (max-width: 899px) { #wrap { margin: 0 -8px; width: auto; } }` (`width: auto` added at integration, see the integration record) | D11 (calls only), D12 to D14, [V2.9], [V2.12], [V2.13], [V2.16] | everything else, and every other line of `index.html` |
| **Harness** | `dev/smoke.mjs` | D15, every public name in this document | everything else |
| Overseer | the three spec docs | | the four builders' files |

Nobody else edits `index.html`. The harness reads only public names (the `PitSim.*` surface, `sim.state`, DOM ids and the `PitSim.game` hooks of D14). Every builder runs `node --check` on each script they edited and scans each edited file for U+2014 and U+2013.

---

## v2 interface delta (2026-10-18)

**Rules:** [V2.1] to [V2.19]. This delta is law for the v2 builders exactly as the rest of this contract was for v1. Where this delta and a section below disagree, this delta wins. Sections it replaces are marked superseded below; sections it does not mention stand, read with v2 coordinates and sizes.

### D0. Names kept from the design spec

The v2 brief that started this round used working names for some members. The design spec had already fixed names for the same things and uses them throughout, so this contract keeps the spec's names and adds no aliases. A builder who sees a brief name implements the contract name in the right column.

| Brief name | Contract name | Note |
|---|---|---|
| `MAP.w`, `MAP.h` | `MAP.W` (11), `MAP.H` (12) | v1 spelling kept |
| `MAP.layers` | none | no layer grid; fixed props are `MAP.props`, decor is `MAP.decor`, seats are `MAP.seats` |
| station types `'seat'`, `'decor'`, `'prop'` | `kind: 'seat'` on `MAP.seats` entries, `kind: 'decor'` on `MAP.decor`, `kind: 'prop'` on `MAP.props` | `MAP.stations` keeps the eight v1 stations and v1 types; seats, decor and props are never stations (no reach, no tap target) |
| `C.WALK` 6 | `C.WALK_TILES_PER_S: 6` | |
| `C.SEAT_TIP_BASE` | `C.SEAT_BONUS_BASE: 1` | |
| `C.CHARM_CAP` | `C.CHARM_MAX: 30` | |
| `customer.mode 'togo'` | `mode: 'leaving'` with `reason: 'togo'` | a to go customer is a leaver; `game.js` draws `hand_togo` when `reason === 'togo'` |
| `state.charm` | `sim.charm()` | computed, never stored, never saved |
| `state.dog` | `PitSim.game.dog` (D14) | the dog is cosmetic and lives in `game.js`; the sim has no dog |
| event `seated` | `seat_taken` | |
| event `ate` | `seat_done` | |
| event `togo` | `to_go` | |
| event `heart` | none: `seat_done` with `atClose: false` is the heart trigger | `game.js` starts the heart and logs it in `PitSim.game.fxLog` (D14) |
| event `decor_bought` | `purchase` with `kind: 'decor'` | |
| event `dog_moved` | none | |
| `PitSim.migrateSave(v1)` | none: `validateSave` accepts `v: 1` and returns `v: 2` (D9) | |

### D1. Load order and the shared global

Unchanged load order (`sprites.js`, `sim.js`, `game.js`, all `defer`). Each script body sits inside one function expression, `(function () { ... })();`, and the first statement inside it (after `'use strict';` where the file puts it) is `const PitSim = globalThis.PitSim || (globalThis.PitSim = {});` (section 1 as corrected). In the browser `globalThis` is `window`, so this is `window.PitSim`; the line says `globalThis` because `sim.js` also runs in Node. Top level attachments are unchanged: `sprites.js` attaches `art`; `sim.js` attaches `C`, `MEATS`, `MEAT_IDS`, `MAP`, `CATALOG`, `STRINGS`, `createSim`, `validateSave`, `fireBand`, `fireMult`, `tileOwned`, `SAVE_KEY`; `game.js` attaches `game`. Nothing new at the top level.

### D2. `PitSim.C`

Changed values: `WALK_TILES_PER_S: 6` (4.8 px a tick; `game.js` draws `Math.round(px)`), `SAVE_VERSION: 2`. New keys, all read by name, never hard coded:

```js
// seating and charm [V2.5], [V2.6]
EAT_MIN: 8, EAT_MAX: 12,            // seconds a seated customer eats: EAT_MIN + (EAT_MAX - EAT_MIN) * rng()
HEART_SECONDS: 0.6,                 // sim: seated pause after the bonus is paid, before standing up
SEAT_BONUS_BASE: 1, SEAT_BONUS_MAX: 3,
CHARM_STEP: 10, CHARM_MAX: 30,      // seatBonus = min(MAX, BASE + floor(charm / STEP)); repMax = REP_DAY_MAX + floor(charm / STEP)
REP_TOGO_QUICK: 1,                  // word of mouth for a quick serve taken to go
// cues the sim does not act on but game.js reads [V2.9]
SWEAT_FRAC: 0.25,                   // sweat drop at or under this fraction of patience, mode 'waiting' only
ZZZ_AFTER: 3,                       // sim clock seconds the buddy spends in task 'idle' before zzz
FX: Object.freeze({ /* cosmetic timings, below */ })
```

`C.FX` is a frozen object owned by `sim.js` and read only by `game.js`. Every duration is in real seconds unless the key says px or ms; values are [V2.9]'s:

```js
FX: Object.freeze({
  NUMBER_S: 1.4, NUMBER_RISE_PX: 14, NUMBER_FADE_AT: 1.0, TIP_GAP_PX: -11,    // cash, tip and seat tip numbers (round 1; round 2: the tip stacks above the cash)
  SPARKLE_S: 0.45, SPARKLE_FRAME_S: 0.15, SPARKLE_STAGGER_S: 0.05,
  HEART_S: 1.4, HEART_FRAME_S: 0.4, HEART_RISE_PX: 12, HEART_FADE_S: 0.3,     // review round 1
  EAT_FRAME_S: 0.35,                                                      // cust{n}_sit frames 0 and 1
  PUFF_EVERY_LOW: 0.9, PUFF_EVERY_GOOD: 0.45, PUFF_EVERY_HOT: 0.3,
  PUFF_LIFE_MIN: 1.1, PUFF_LIFE_MAX: 1.4, PUFF_RISE_PX_S: 8, PUFF_DRIFT_PX_S: 3,
  BURNT_BURST_S: 0.5, BURNT_RISE_PX_S: 12, SHAKE_MS: 120,
  BURNT_COLUMN_EVERY: 0.35, BURNT_COLUMN_LIFE: 1.2, BURNT_COLUMN_RISE_PX_S: 10, BURNT_COLUMN_SWAY_PX: 2,
  SWEAT_EVERY: 1.2, SWEAT_SLIDE_S: 0.6, SWEAT_SLIDE_PX: 3, SWEAT_SPLASH_S: 0.15,
  ZZZ_FRAME_S: 0.5, ZZZ_DRIFT_PX: 4,
  SQUASH_S: 0.12,                                                         // 18x22 for the first half, 14x26 for the second, then 16x24
  WALKOUT_MARK_S: 0.6, TAP_RING_S: 0.35, FIRE_FPS: 6, TWINKLE_S: 0.5,
  BIRD_SHOW_S: 2, BIRD_GAP_MIN: 8, BIRD_GAP_MAX: 14,
  DOG_TILES_PER_S: 2, DOG_WAIT_MIN: 2, DOG_WAIT_SPREAD: 3,
  NOTICE_S: 4                                                             // Your save was updated for the new yard.
})
```

Every other key keeps its v1 value, including `PATIENCE_MID_FRAC: 0.5` and `GEAR_RESERVE: 30` (sim deviation 14, now contract), `QUEUE_SPOTS: 3`, `QUEUE_SPOTS_BIG: 5`, `TABLE_SPOTS: 3`, `TABLE_SPOTS_BIG: 5`. `MEATS.sausage.cook` is 14 and `MEATS.chicken.cook` is 22 ([V2.19] item 1; the shipped 10 and 16 were an unlisted deviation and are reverted).

### D3. Types

- `DecorId` is one of `'chair1' | 'chair2' | 'flowers' | 'birdbath' | 'lights' | 'picnic2'`, always in that order.
- `SeatId` is one of `'pt1b' | 'pt1a' | 'chair1' | 'chair2' | 'pt2b' | 'pt2a'`, always in that order (`MAP.SEAT_ORDER`).
- Tile coordinates: x 0 to 10, y 0 to 11. Customers may also stand on (9,12), the spawn below the gate, off canvas. Pixel coordinates are in the 176 by 192 virtual canvas; a tile's top left pixel is `(x * 16, y * 16)`.
- `Dir` unchanged; up is toward y = 0 (the shed), down toward y = 11 (the gate fence). Section 0's ranges (13 by 15, gate at the top) are v1.

### D4. `PitSim.MAP` (replaces section 2.3)

```js
PitSim.MAP = Object.freeze({
  W: 11, H: 12, TILE: 16,
  T: Object.freeze({ PAVER: 0, FENCE: 1, GATE: 2, LAWN: 3, HEDGE: 4, BED: 5 }),
  tiles: number[],               // length 132, row major, ground only, the grid below
  at(x, y): int,                 // tiles[y * 11 + x], or T.FENCE outside the map
  stripe(x): 'a' | 'b',          // 'a' when x is even (lawn_a), 'b' when odd (lawn_b)
  stations: Station[],           // the eight v1 ids, v1 order, v1 types, v2 data from [V2.3]
  station(id): Station,
  props: Prop[],                 // 19 entries, table below (four added in review round 1, three in round 2)
  decor: DecorSpot[],            // 6 entries, DecorId order
  seats: Seat[],                 // 6 entries, SeatId order
  SEAT_ORDER: ['pt1b', 'pt1a', 'chair1', 'chair2', 'pt2b', 'pt2a'],
  spawn:      { x: 6, y: 3, face: 'up' },
  gate:       { x: 9, y: 11 },
  custSpawn:  { x: 9, y: 12 },
  passStop:   { x: 9, y: 10 },
  queue: [ { x: 7, y: 7, face: 'up',   gear: null }, { x: 8, y: 7, face: 'left', gear: null },
           { x: 9, y: 7, face: 'left', gear: null }, { x: 9, y: 8, face: 'up',   gear: 'bigtable' },
           { x: 9, y: 9, face: 'up',   gear: 'bigtable' } ],
  buddyIdle:  { x: 4, y: 5, face: 'up' },
  tenderIdle: { x: 3, y: 2, face: 'right' },
  dogHome:    { x: 4, y: 7 },
  dogRoam:    [ {x:2,y:7}, {x:3,y:7}, {x:4,y:7}, {x:5,y:7}, {x:6,y:7}, {x:7,y:8}, {x:8,y:8} ],   // round 2: (4,8) holds pot3
  overhead:   { lights: { x: 71, y: 80 }, canopy: { x: 76, y: 106 } },
  signText:   { x: 70, y: 5 }
});
```

`dogHome` is (4,7), not (4,8) as the first draft of this delta said ([V2.2.3] governs). `MAP.canopy` (the v1 tile rectangle) is gone; the Canopy gear draws at `overhead.canopy`. The ground grid, row by row (`P` paver, `F` fence, `G` gate, `L` lawn, `H` hedge, `B` bed), from [V2.2]:

```
      x: 0 1 2 3 4 5 6 7 8 9 10
y0       F P P P F F F F F F F     (1..3, 0) are PAVER under the shed prop, which blocks them
y1       F P P P P P P P P P F
y2       F P P P P P P P P P F
y3       F P P P P P P P P P F
y4       F P P P P P P P P P F
y5       F P P P P P P P P P F
y6       F H H H H P P P H H F     (4,6) (8,6) HEDGE under the light post footprints; (5,6) (6,6) (7,6) PAVER under the counter
y7       F B L L L L L L L L F
y8       F B L L L L L L L L F
y9       F B L L L L L L L L F
y10      F B B B B B B L L L F     (7,10) (8,10) LAWN under the decor flower bed footprint
y11      F F F F F F F F F G F     (8,11) FENCE with the mailbox prop drawn over it
```

```ts
Station = {                                   // v1 fields kept: id, type, label, spoken, gear, tiles, use, slots, decay
  id: StationId, type: 'cooker' | 'board' | 'cooler' | 'table' | 'pile' | 'trash',
  label: string, spoken: string, gear: GearId | null,
  tiles: { x, y, gear?: GearId }[],
  use:   { x, y, face: Dir, gear?: GearId }[],
  slots?: int, decay?: float,
  sprite: 'kettle' | 'drum' | 'board' | 'cooler' | 'counter' | 'pile' | 'trash',
  draw: { x, y },                             // top left px of the sprite
  sortRow: int,                               // the station's bottom tile row, for the y-sort (D12)
  slotPx?: { x, y }[],                        // cookers: offsets from the top left px of the first tile
  spotPx?: { x, y, gear?: GearId }[]          // table only: absolute px of the bottom plate of each spot
};
Prop      = { kind: 'prop', id: string, sprite: string, frame: int, tile: { x, y }, draw: { x, y },
              blocks: { x, y }[], sortRow: int };
DecorSpot = { kind: 'decor', id: DecorId, tiles: { x, y }[], blocks: { x, y }[], seats: SeatId[],
              draws: { sprite: string, frame: int, x: int, y: int, sortRow: int, overhead?: true }[] };
Seat      = { kind: 'seat', id: SeatId, x: int, y: int, face: 'down', decor: DecorId | null };
```

Stations, in `MAP.stations` order ([V2.3]; labels, spoken names, slots and decay as section 2.3.2):

| id | tiles | use (x, y, face) | sprite | draw | sortRow | extra |
|---|---|---|---|---|---|---|
| `kettle1` | (5,2) | (6,2,left) (5,3,up) | kettle | (80,24) | 2 | slotPx (0,-7) (6,-7) (round 2) |
| `kettle2` | (7,2) | (6,2,right) (8,2,left) (7,1,down) | kettle | (112,24) | 2 | gear kettle2; slotPx as kettle1 |
| `drum` | (7,3) (7,4) | (6,3,right) (6,4,right) (8,3,left) (8,4,left) (7,5,up) | drum | (112,48) | 4 | gear drum; slotPx (-2,-4) (8,-4) (-2,7) (8,7) |
| `board` | (5,4) | (6,4,left) (5,3,down) (5,5,up) (4,4,right) | board | (80,64) | 4 | stacks at (1,3) (8,3) (1,9) (8,9) from (80,64) |
| `cooler` | (6,1) | (6,2,up) (7,1,left) | cooler | (96,16) | 1 | |
| `table` | (6,6) (7,6) (5,6 gear bigtable) | (6,5,down) (7,5,down) (5,5,down gear bigtable) | counter | (96,88) | 6 | spotPx (98,92) (108,92) (118,92) (88,92 bigtable) (80,92 bigtable); `counter_ext` at (80,88) while owned, and `counter` frame 1 then |
| `pile` | (4,2) | (4,3,up) | pile | (64,32) | 2 | |
| `trash` | (3,4) | (4,4,left) (3,3,down) (3,5,up) (2,4,right) | trash | (48,64) | 4 | |

`table.spots[i]` is drawn at `spotPx[i]`, and the `served` event's `x, y` are that `spotPx`. The table's `tiles` order is index 0 (6,6), 1 (7,6), 2 (5,6).

Props, in this order ([V2.2.2]):

| id | sprite | frame | tile | draw | blocks | sortRow |
|---|---|---|---|---|---|---|
| `shed` | shed | 0 | (1,1) | (16,0) | (1,0) (2,0) (3,0) (1,1) (2,1) (3,1) | 1 |
| `sign` | sign | 0 | (4,0) | (68,2) | none | 0 |
| `tree` | tree | 0 | (9,2) | (128,0) | (9,2) | 2 |
| `woodpile` | woodpile | 0 | (9,1) | (144,16) | (9,1) | 1 |
| `tools` | tools | 0 | (1,2) | (16,24) | (1,2) | 2 |
| `pot1` | pot | 0 | (1,3) | (16,48) | (1,3) | 3 |
| `pot2` | pot | 0 | (9,3) | (144,48) | (9,3) | 3 |
| `hose` | hose | 0 | (1,5) | (16,80) | (1,5) | 5 |
| `planter` | planter | 0 | (9,5) | (144,72) | (9,5) | 5 |
| `mailbox` | mailbox | 0 | (8,11) | (128,168) | none (fence tile) | 11 |
| `picnic1` | picnic | 0 | (5,9) | (80,136) | (5,9) (6,9) | 9 |
| `bench1` | picnic_bench | 0 | (5,8) | (80,136) | none | 8 |
| `woodpile2` | woodpile | 0 | (4,1) | (64,16) | (4,1) | 1 |
| `woodpile3` | woodpile | 0 | (5,1) | (80,16) | (5,1) | 1 |
| `planter2` | planter | 0 | (1,4) | (16,56) | (1,4) | 4 |
| `shelf` | shelf | 0 | (2,3) | (32,40) | (2,3) | 3 |
| `pot3` | pot | 0 | (4,8) | (64,128) | (4,8) | 8 |
| `pot4` | pot | 0 | (2,2) | (32,32) | (2,2) | 2 |
| `woodpile4` | woodpile | 0 | (9,4) | (144,64) | (9,4) | 4 |

Decor spots, in `DecorId` order ([V2.7]):

| id | tiles | blocks | seats | draws (sprite, frame, x, y, sortRow) |
|---|---|---|---|---|
| `chair1` | (7,9) | none (its tile is the seat) | chair1 | chair 0 112 136 9 |
| `chair2` | (8,9) | none | chair2 | chair 0 128 136 9 |
| `flowers` | (7,10) (8,10) | (7,10) (8,10) | | bed 0 112 156 10; bed 1 128 156 10 |
| `birdbath` | (4,9) | (4,9) | | birdbath 0 64 136 9 (`game.js` swaps in frame 1 for the bird) |
| `lights` | (4,6) (8,6) | none (the hedge blocks) | | lights_post 0 64 80 6; lights_post 0 128 80 6; lights_string 0 71 80 6 overhead |
| `picnic2` | (2,9) (3,9) | (2,9) (3,9) | pt2b, pt2a | picnic_bench 0 32 136 8; picnic 0 32 136 9 |

Seats, in `SeatId` order ([V2.2.4]), every face `'down'`: `pt1b` (6,8) decor null; `pt1a` (5,8) null; `chair1` (7,9) `'chair1'`; `chair2` (8,9) `'chair2'`; `pt2b` (3,8) `'picnic2'`; `pt2a` (2,8) `'picnic2'`.

`PitSim.tileOwned(entry, gear, decor)` (extends v1): `(!entry.gear || gear[entry.gear] === true) && (!entry.decor || (decor !== undefined && decor[entry.decor] === true))`. Pure; works on stations, footprint tiles, use tiles, queue entries and seats. A `DecorSpot` is owned when `decor[spot.id] === true` (callers test that directly). The v1 two argument call still works for every entry without a `decor` field.

Walkability is [V2.2.1]. `sim.walkable(x, y)` keeps its meaning (the player rule: ground `PAVER`, no prop block, no active station tile). New: `sim.custWalkable(x, y, gx, gy)`, the customer rule with BFS goal `(gx, gy)`; the dog calls it with `(-1, -1)` and adds `y <= 10`. BFS everywhere is 4 directional, neighbor order up, down, left, right.

### D5. `PitSim.CATALOG`

Rows in display order: the five meats, `charcoal`, the six gear rows, the six decor rows in `DecorId` order, `buddy`, `tender`, `driveway`. Length 21. `kind` gains `'decor'`; `needs` gains `{ decor: DecorId }`. Decor rows:

```ts
CatalogRow (decor) = CatalogRow & { kind: 'decor', seats: int, charm: int, needs: null | { decor: DecorId } }
```

| id | label | price | seats | charm | effect | needs | needsText | sets |
|---|---|---|---|---|---|---|---|---|
| chair1 | Lawn chair | 25 | 1 | 3 | One more seat by the line. Charm 3. | null | | decor.chair1, seat chair1 |
| chair2 | Second lawn chair | 25 | 1 | 3 | One more seat by the line. Charm 3. | { decor: 'chair1' } | Needs the first lawn chair. | decor.chair2, seat chair2 |
| flowers | Flower bed | 30 | 0 | 4 | Flowers along the fence by the gate. Charm 4. | null | | decor.flowers |
| birdbath | Bird bath | 40 | 0 | 4 | Birds stop by between the tables. Charm 4. | null | | decor.birdbath |
| lights | String lights | 60 | 0 | 10 | Lights strung over the serving table. Charm 10. | null | | decor.lights |
| picnic2 | Second picnic table | 80 | 2 | 6 | Two more seats on the lawn. Charm 6. | null | | decor.picnic2, seats pt2b and pt2a |

The chicken row's effect line is `Chicken thighs: 2 plates, 22 seconds on good fire, sells for 8.` ([V2.19] item 1). `STRINGS.decorLabel` is added: `{ chair1: 'Lawn chair', chair2: 'Second lawn chair', flowers: 'Flower bed', birdbath: 'Bird bath', lights: 'String lights', picnic2: 'Second picnic table' }`. The goal order is unchanged; decor is never a goal.

### D6. State additions (section 2.5.1)

```ts
state.decor: { [d in DecorId]: boolean };          // owned flags, saved
state.seats: { [s in SeatId]: null | int };        // customer id holding the seat (reserved or sitting); all null at openGate and after the till
state.stats: v1 stats & { seated: int };
Today: v1 Today & { seated: int, togo: int, togoQuick: int, seatTips: int };
Till:  v1 Till & { repMax: int };                  // the clamp's upper bound used that day
Till.net = revenue + tips + seatTips - wages - DAILY_COSTS;
Customer: v1 Customer with
  body: 0 | 1 | 2 | 3,                             // arrivals % 4
  mode: 'arriving' | 'waiting' | 'toSeat' | 'eating' | 'leaving' | 'passing',
  reason: null | 'seated' | 'togo' | 'walkout' | 'past' | 'close',   // v1 'served' becomes 'seated' or 'togo'
  seat: SeatId | null,                             // set at serve time when a seat was found; kept until removal
  eat: float,                                      // seconds left eating; 0 outside 'eating'
  eatMax: float,                                   // 0 until a seat is found
  bonusPaid: boolean;
```

`queueIndex` is `-1` in modes `toSeat`, `eating`, `leaving` and `passing`. While `mode === 'eating'` and `eat === 0` the customer is in the `HEART_SECONDS` pause, counted down in `pause`. Patience and `wait` advance only in `waiting`. `player.queued` (sim deviation 11) and `sim.expectedCrowd()` (sim deviation 13) stay. Buddy and tender objects keep their v1 shape; their v2 routes are [V2.4]. Charm is not state (`sim.charm()`); the dog is not state (`PitSim.game.dog`).

What `game.js` draws from a customer, by mode: `arriving` and `waiting`, walk or stand frames with the order bubble and patience bar ([V2.9]); `toSeat`, with `hand_plate_{want}`; `eating`, `cust{body}_sit` at (seat px, seat py - 6) with the food bubble while `eat > 0` and frame 2 while `eat === 0`, plus `plate_{want}` per [V2.2.4]; `leaving`, with `hand_togo` when `reason === 'togo'` and the unhappy frames when `reason === 'walkout'`; `passing`, plain.

### D7. Methods (section 2.6)

Changed:
- `buy(id, qty)`: decor ids behave like gear (immediate; refuses with `Owned`, the prerequisite's `needsText`, or `Not enough cash` when `cash - cartTotal() < price`), set `decor[id] = true`, emit `purchase { id, label, price, kind: 'decor' }` then `save_wanted { reason: 'decor' }`, `message = 'Bought ' + label + '.'`. Gear purchases now carry `kind: 'gear'`.
- `sell(id)`: accepts `DecorId`. Selling `chair1` also sells `chair2` if owned: `sell chair1` first, then `sell chair2`, message `Sold Lawn chair for 12 and Second lawn chair for 12`. Price `floor(price * SELL_BACK)`. The Broke card is morning only, so no seat is in use.
- `walkTo`, `move`, `walkable`: unchanged semantics on the v2 grid.

New, own properties of the sim object, fresh results each call:

| Method | Returns | Semantics |
|---|---|---|
| `charm()` | `int` | `min(C.CHARM_MAX, sum of CATALOG charm over owned decor)` |
| `seatBonus()` | `int` | `min(C.SEAT_BONUS_MAX, C.SEAT_BONUS_BASE + floor(charm() / C.CHARM_STEP))` |
| `seatCount()` | `int` | owned seats: 2 plus the `seats` of owned decor rows |
| `repMax()` | `int` | `C.REP_DAY_MAX + floor(charm() / C.CHARM_STEP)` |
| `custWalkable(x, y, gx, gy)` | `boolean` | the customer rule of [V2.2.1] with goal `(gx, gy)` |

### D8. Rules the interface depends on (section 2.7 additions)

- RNG order per spawn unchanged (jitter, patience, branch, weight). One extra draw, `eatMax`, happens at serve time only when a seat is found. No other new draws. Cosmetic randomness in `game.js` never calls `sim.rng()` (game deviation 4 is now the rule; the `rng()` row of section 2.6 no longer invites cosmetic use).
- Serve [V2.5 steps 3 to 7]: `served` is emitted first, then `seat_taken` or `to_go`. Seat pick: the first id in `SEAT_ORDER` that is owned, has `state.seats[id] === null`, and is reachable by customer BFS from the customer's tile. Rep counters: seated and quick to `happy`; to go and quick to `togoQuick`; the rest to `ok`. Day rep: `happy * REP_QUICK + togoQuick * REP_TOGO_QUICK + ok * REP_OK + walkouts * REP_WALKOUT + close * CLOSE_PENALTY`, clamped to `[REP_DAY_MIN, repMax()]`; `till.repCapped` compares against that clamp.
- Seat done [V2.5 step 5]: when `eat` reaches 0, `cash += bonus`, `today.seatTips += bonus`, `today.seated += 1`, `stats.seated += 1`, `bonusPaid = true`, emit `seat_done`; after `HEART_SECONDS` the seat is freed, mode `leaving`, reason `seated`, mood happy, BFS to `custSpawn` with no turn pause.
- Step order [spec 5.10]: stage 2 (NPCs) moves customers in `toSeat` and skips the pause and movement of `eating` ones (still counting `hop`); stage 5 (customers), after the serve checks, runs the `eat` countdown, `seat_done`, the heart pause and standing up. A seat freed in stage 5 is free for a serve on the next tick.
- Facing on routes [V2.5 step 11]: a new BFS route faces its first step; leaving the line holds `LEAVE_TURN_SECONDS` facing that step; arrival at a queue spot faces that spot's `face`, at a seat `'down'`; the walk past pauses facing up.
- Day end [V2.5 step 9]: `dayShouldEnd` adds "no customer in `toSeat` or `eating`" to the after last call and sold out branches; once sold out at or after `GATE_OPENS` the sim runs `closeOutLine()` and sets `spawnAt = Infinity` on each such tick. The hard end at `DAY_SECONDS` closes out the line, then pays every unpaid seat bonus with `atClose: true`, then runs the till. `state.seats` is all `null` after the till.

### D9. Save and `validateSave` (replaces the format in section 2.8)

`SAVE_KEY` unchanged (`'hs.pitsim.save'`), `C.SAVE_VERSION` 2. The v2 shape is exactly [V2.14]: the v1 keys plus `decor` (six booleans in `DecorId` order) and `stats.seated`, with `v: 2`. There is no `migrateSave`; `validateSave(obj)` is extended:

- `obj.v === 2`: every v1 field rule, plus `decor.*` `=== true` per `DecorId`, unknown keys dropped, `decor.chair2` forced false when `decor.chair1` is false, `stats.seated` integer clamped 0 to `MAX_STAT`, default 0.
- `obj.v === 1`: the v1 field rules, then returned as `v: 2` with `decor` all false and `stats.seated` 0, every v1 value kept.
- Anything else (not a plain object, `v` missing, `v: 3`, a string, an array): `null`. Never throws, including on cyclic objects.

`serialize()` always writes `v: 2`; service state, `state.seats` and charm are never saved. `game.js` reads `parsed.v === 1` before validating, shows Your save was updated for the new yard. on the status line for `C.FX.NOTICE_S` and once in the live region, then writes the save once so a reload does not show the notice again.

### D10. Events (replaces the table in section 2.9)

`drainEvents()` returns `Event[]`; every event is `{ type, ...payload }` with exactly these types and fields. Sentences are `game.js`'s (section 4.7 plus [V2.15]); `L = MEATS[meat].label`, `K = STRINGS.cooker[cooker]`.

| type | payload | when | sentence (`#live`) | status |
|---|---|---|---|---|
| `yard_open` | | `openGate` succeeded | Yard open. Gate opens in 30 seconds. | unchanged |
| `gate_soon` | | clock crossed `GATE_OPENS - 10` | Gate opens in 10. | unchanged |
| `gate_open` | | clock crossed `GATE_OPENS` | Gate open. | unchanged |
| `customer_arrived` | `id, meat` | a customer spawned who will join the line | New customer wants {L}. | unchanged |
| `walk_past` | `id, reason: 'full' \| 'soldout'` | a customer spawned into a full line, or with nothing to sell (sim deviation 9) | Someone walked past. The line is full. / Someone looked in. Nothing left to sell. | unchanged |
| `piece_done` | `cooker, meat` | a piece entered `done` | {L} is done on {K}. | unchanged |
| `piece_burnt` | `cooker, meat` | a piece entered `burnt` | {L} burnt on {K}. | unchanged |
| `served` | `id, meat, price, tip, quick, x, y` | a customer was served; `x, y` is the `spotPx` the plate came from | Served {L}, {price} plus {tip} tip. / Served {L}, {price}, no tip. | unchanged |
| `seat_taken` | `id, seat` | right after `served`, a seat was reserved | none | **new** |
| `to_go` | `id` | right after `served`, no free seat | No free seat. They took it to go. | **new** |
| `seat_done` | `id, seat, bonus, x, y, atClose` | the seat tip was paid; `x, y` is the seat tile's top left px; `atClose` true when the hard end paid it | A seated customer tipped {bonus} more. (none when `atClose`) | **new** |
| `walk_out` | `id` | patience reached 0 | A customer walked out. | unchanged |
| `left_at_close` | `id` | still in line at close or sold out | none | unchanged |
| `fire_low` | `cooker` | fire crossed below `FIRE_LOW_WARN` | Fire low on {K}. | unchanged |
| `fire_out` | `cooker` | fire reached 0 | Fire out on {K}. | unchanged |
| `last_call` | | clock crossed `LAST_CALL` | Last call. No more customers today. | unchanged |
| `day_over` | | the till is built | Day over. Opening the till. | unchanged |
| `slice_done` | `meat, plates` | a slice finished | none | unchanged |
| `set_down` | `meat, n` | plates went on the counter | none | unchanged |
| `trash` | `meat, kind` | something went in the trash | none | unchanged |
| `tap_queued` | | `walkTo` during a slice (sim deviation 11) | none | unchanged |
| `purchase` | `id, label, price, kind: 'gear' \| 'decor'` | gear or decor bought | Bought {label}. | `kind` **new** |
| `hire` | `id, label, hired` | hire toggled | Hired {label}. / Let {label} go. | unchanged |
| `sell` | `id, label, price` | Broke card sale, gear or decor | Sold {label} for {price}. | covers decor |
| `save_wanted` | `reason: 'till' \| 'gear' \| 'decor' \| 'hire' \| 'open' \| 'sell'` | `game.js` writes `serialize()` | none | `'decor'` **new** |
| `save_clear` | | `game.js` removes `SAVE_KEY` | none | unchanged |
| `blocked` | | `walkTo` could not reach the tile | none (status line) | unchanged |
| `rain` | `raining` | morning weather roll from `RAIN_FROM_DAY` | none | unchanged |
| `coming_next` | | first Coming next card | You can afford the driveway pop-up. It is the next rung and is not built yet. | unchanged |
| `broke` | | a morning opened on the Broke card | Broke. Sell gear or start over. | unchanged |

No `heart`, `decor_bought`, `dog_moved` or `seated` event exists (D0). `game.js`'s own notice, Your save was updated for the new yard., is not a sim event.

### D11. `PitSim.art` (replaces sections 3.2 and 3.4; amends 3.1 and 3.5)

**Surface.** Section 3.1 stands with these changes: `PALETTE` has 32 entries; `COLOR` has the v2 keys; `SPRITES` holds exactly the list below; two functions are added:

```ts
drawScaled(ctx, name: string, x: int, y: int, w: int, h: int, frame = 0, flip = false): void   // one frame stretched into a w by h box, smoothing off (the squash and stretch only)
textTinted(ctx, str: string, x: int, y: int, colorKey: string): void                         // like text, with the cream glyph pixels drawn in COLOR[colorKey] (floating numbers)
```

`draw(ctx, name, x, y, frame = 0, flip = false)` still takes the sprite's top left pixel, whatever its size; `flip` mirrors inside the sprite's own `w`. `text` and `textWidth` are unchanged (glyph count times 5 minus 1); `text` maps a digit to frame `d`, a letter to `10 + (code - 65)` after `toUpperCase()`, `+` to 36, `:` to 37, a space to a 4 px gap, and skips anything else. `build()` still validates every grid and throws `Error('sprite <name> frame <i> row <j>: <reason>')`.

**PALETTE v2**, in index order ([V2.10]):

```js
PALETTE: ['', '#1b1714', '#2a2015', '#E6D8B8', '#D06129', '#3b2417', '#7a4a26', '#a8693a', '#d79a5b',
          '#e8c890', '#c9a46b', '#6cc24a', '#4fa83d', '#2f7a32', '#a6e05a', '#5bb8f0', '#3a86c8',
          '#fbf7ef', '#f27aa8', '#d94a8c', '#ffd84a', '#f6c49a', '#d9935f', '#8f5634', '#d8402f',
          '#f29a9a', '#d0663e', '#8e3b1f', '#9aa4ae', '#4d5560', '#ddd8cf', '#6e6863']
```

**Legend.** One character per pixel; the character is the index written in base 32 with digits `0123456789abcdefghijklmnopqrstuv`: `0` is index 0 (transparent), `9` is 9, `a` is 10, `v` is 31. Grids use only these 32 characters, lowercase; `build()` rejects anything else, `w` to `z` and uppercase included. 32 colors fit, so no second scheme is in use. If a later round ever needs more than 32, the legend extends with `w x y z` for 32 to 35, and past 36 with uppercase `A` to `Z` for 36 to 61 (case sensitive); that is decided now and is not active in v2.

| char | key | hex | char | key | hex | char | key | hex | char | key | hex |
|---|---|---|---|---|---|---|---|---|---|---|---|
| `0` | | transparent | `8` | `woodL` | #d79a5b | `g` | `clothD` | #3a86c8 | `o` | `red` | #d8402f |
| `1` | `K` | #1b1714 | `9` | `paver` | #e8c890 | `h` | `white` | #fbf7ef | `p` | `raw` | #f29a9a |
| `2` | `U` | #2a2015 | `a` | `paverD` | #c9a46b | `i` | `pink` | #f27aa8 | `q` | `cooking` | #d0663e |
| `3` | `C` | #E6D8B8 | `b` | `lawnA` | #6cc24a | `j` | `magenta` | #d94a8c | `r` | `done` | #8e3b1f |
| `4` | `O` | #D06129 | `c` | `lawnB` | #4fa83d | `k` | `yellow` | #ffd84a | `s` | `steelL` | #9aa4ae |
| `5` | `outline` | #3b2417 | `d` | `leafD` | #2f7a32 | `l` | `skinL` | #f6c49a | `t` | `steelD` | #4d5560 |
| `6` | `woodD` | #7a4a26 | `e` | `leafL` | #a6e05a | `m` | `skinM` | #d9935f | `u` | `smokeL` | #ddd8cf |
| `7` | `woodM` | #a8693a | `f` | `cloth` | #5bb8f0 | `n` | `skinD` | #8f5634 | `v` | `smokeD` | #6e6863 |

`COLOR` maps exactly these 31 keys to those hex strings: `K U C O outline woodD woodM woodL paver paverD lawnA lawnB leafD leafL cloth clothD white pink magenta yellow skinL skinM skinD red raw cooking done steelL steelD smokeL smokeD`. The v1 keys (`Y M H I S g G h d b p r n f y s t w`) are gone; `game.js` uses the v2 keys only. Roles per color, hair, shirt, gauge and patience bar colors are [V2.10]. The DOM keeps the site palette in `index.html`.

**Anchor rule.** A sprite of `w` by `h` anchored at tile `(ax, ay)`, its bottom left tile, is drawn with its top left at `x = ax * 16 + dx`, `y = (ay + 1) * 16 - h + dy`, with `dx = dy = 0` unless a D4 table gives the draw position (those positions already include any shift, for example the tree's canopy overhanging one tile left: anchor (9,2), draw (128,0)). People (16x24) are drawn at `(Math.round(px), Math.round(py) - 8)`, feet on the bottom row of their tile. Ground tiles (16x16) sit on their own tile. Fence, gate and hedge pieces are 16x24 anchored on their tile, except the back fence row (y = 0), which draws the 16x16 `fence_back` at y = 0 (frame 1 at the corners), so no fence piece crosses the canvas edge (review round 1).

**REQUIRED SPRITES v2.** Exactly these 113 names, sizes and frame counts (268 frames; review round 1 added `fence_back` and `shelf`; review round 2 added `hedge` frame 1 and `bed` frame 3), nothing added, nothing missing. The harness copies this literal verbatim; the art builder may paste it into `dev/sheet.html`. Frame meanings are the "shows" column of [V2.11] and are fixed so `game.js` can index them blind; side sprites face left and are flipped for right.

```js
const REQUIRED_SPRITES = [   // [name, w, h, frames]
  ['player_down', 16, 24, 3], ['player_up', 16, 24, 3], ['player_side', 16, 24, 3], ['player_slice', 16, 24, 2],
  ['buddy_down', 16, 24, 3], ['buddy_up', 16, 24, 3], ['buddy_side', 16, 24, 3], ['tender_down', 16, 24, 3],
  ['tender_up', 16, 24, 3], ['tender_side', 16, 24, 3], ['cust0_down', 16, 24, 5], ['cust0_up', 16, 24, 3],
  ['cust0_side', 16, 24, 4], ['cust0_sit', 16, 24, 3], ['cust1_down', 16, 24, 5], ['cust1_up', 16, 24, 3],
  ['cust1_side', 16, 24, 4], ['cust1_sit', 16, 24, 3], ['cust2_down', 16, 24, 5], ['cust2_up', 16, 24, 3],
  ['cust2_side', 16, 24, 4], ['cust2_sit', 16, 24, 3], ['cust3_down', 16, 24, 5], ['cust3_up', 16, 24, 3],
  ['cust3_side', 16, 24, 4], ['cust3_sit', 16, 24, 3], ['shadow', 12, 4, 1], ['dog', 16, 16, 4],
  ['hand_charcoal', 8, 8, 1], ['hand_raw_sausage', 8, 8, 1], ['hand_raw_chicken', 8, 8, 1], ['hand_raw_ribs', 8, 8, 1],
  ['hand_raw_butt', 8, 8, 1], ['hand_raw_brisket', 8, 8, 1], ['hand_cooked_sausage', 8, 8, 1], ['hand_cooked_chicken', 8, 8, 1],
  ['hand_cooked_ribs', 8, 8, 1], ['hand_cooked_butt', 8, 8, 1], ['hand_cooked_brisket', 8, 8, 1], ['hand_burnt', 8, 8, 1],
  ['hand_plate_sausage', 8, 8, 1], ['hand_plate_chicken', 8, 8, 1], ['hand_plate_ribs', 8, 8, 1], ['hand_plate_butt', 8, 8, 1],
  ['hand_plate_brisket', 8, 8, 1], ['hand_tray_sausage', 8, 8, 1], ['hand_tray_chicken', 8, 8, 1], ['hand_tray_ribs', 8, 8, 1],
  ['hand_tray_butt', 8, 8, 1], ['hand_tray_brisket', 8, 8, 1], ['hand_tray', 8, 8, 1], ['hand_togo', 8, 8, 1],
  ['icon_sausage', 8, 8, 1], ['icon_chicken', 8, 8, 1], ['icon_ribs', 8, 8, 1], ['icon_butt', 8, 8, 1],
  ['icon_brisket', 8, 8, 1], ['plate_sausage', 8, 6, 1], ['plate_chicken', 8, 6, 1], ['plate_ribs', 8, 6, 1],
  ['plate_butt', 8, 6, 1], ['plate_brisket', 8, 6, 1], ['piece_sausage', 10, 10, 4], ['piece_chicken', 10, 10, 4],
  ['piece_ribs', 10, 10, 4], ['piece_butt', 10, 10, 4], ['piece_brisket', 10, 10, 4], ['mark_x', 8, 8, 1],
  ['kettle', 16, 24, 4], ['drum', 16, 32, 4], ['cooler', 16, 16, 3], ['board', 16, 16, 2],
  ['counter', 32, 24, 2], ['counter_ext', 16, 24, 1], ['pile', 16, 16, 4], ['trash', 16, 16, 1],
  ['paver', 16, 16, 2], ['lawn_a', 16, 16, 2], ['lawn_b', 16, 16, 2], ['fence_h', 16, 24, 1],
  ['fence_v', 16, 24, 1], ['fence_corner', 16, 24, 1], ['fence_back', 16, 16, 2], ['gate', 16, 24, 2], ['hedge', 16, 24, 2],
  ['bed', 16, 20, 4], ['shed', 48, 32, 1], ['sign', 44, 12, 1], ['tree', 32, 48, 1],
  ['woodpile', 16, 16, 1], ['hose', 16, 16, 1], ['tools', 16, 24, 1], ['pot', 16, 16, 1],
  ['planter', 16, 24, 1], ['shelf', 16, 24, 1], ['mailbox', 16, 24, 1], ['picnic', 32, 24, 1], ['picnic_bench', 32, 8, 1],
  ['chair', 16, 24, 1], ['lights_post', 16, 32, 1], ['lights_string', 66, 10, 2], ['birdbath', 16, 24, 2],
  ['canopy', 40, 32, 1], ['bubble', 16, 12, 1], ['heart', 8, 8, 2], ['sparkle', 7, 7, 3],
  ['smoke', 8, 8, 3], ['smoke_dark', 8, 8, 3], ['fire', 8, 8, 3], ['coin', 8, 8, 2],
  ['sweat', 4, 6, 2], ['zzz', 8, 8, 3], ['font', 4, 6, 38]
];
```

Frame indexes `game.js` relies on: people `_down`, `_up`, `_side` frame 0 stand, 1 and 2 walk; `cust{n}_down` 3 and 4 unhappy walk; `cust{n}_side` 3 stand unhappy; `cust{n}_sit` 0 eat a, 1 eat b, 2 content; `dog` 0 and 1 walk, 2 sit, 3 nap; `piece_*` 0 raw, 1 cooking, 2 done, 3 burnt; `kettle` and `drum` by `fireBand`: out 0, low 1, good 2, hot 3; `cooler` 0 crate (since round 2 painted as a small red cooler), 1 shut, 2 open; `board` 0 empty, 1 slicing; `counter` 0 both caps, 1 right cap only; `pile` 0 full (5 or more since v2.1 review round 2, was over 6), 1 half (3 or 4, was 3 to 6), 2 low (1 to 2), 3 bare; `gate` 0 shut, 1 open; `fence_back` 0 rail, 1 corner; `bed` 0 pink, 1 yellow, 2 mixed, 3 tilled soil (round 2); `hedge` 0 plain, 1 blossoms (round 2); `paver` and `lawn_*` 0 plain, 1 alternate; `birdbath` 0 empty, 1 bird; `lights_string` 0 and 1 twinkle; `heart` 0 big, 1 small; `sparkle` 0 small, 1 large, 2 fading; `smoke`, `smoke_dark` 0 small, 1 medium, 2 large; `coin` 0 face, 1 edge; `sweat` 0 drop, 1 splash; `zzz` 0 z, 1 zz, 2 zzz. The v1 sprites `outline`, `grass`, `path`, `table_mid`, `table_end` and `canopy_pole` are retired. Procedural, drawn by `game.js` with `COLOR`: dashed outlines (the boxes of [V2.11]; outline color on pavers, cream on lawn and hedge), the patience bar, fire gauges, cooking arcs, the slice bar, the tap ring, rain, canvas text boxes.

### D12. Render order and the y-sort (replaces section 4.3)

Into the 176 by 192 offscreen canvas, each frame ([V2.12]):

1. Ground: `PAVER` draws `paver` frame `(x * 7 + y * 3) % 2`, and so do the customer route tiles (9,10) (9,9) (9,8) (9,7) (8,7) (7,7) (review round 1, render only: `MAP.tiles` keeps them `LAWN`); `LAWN` and `GATE` draw `lawn_a` or `lawn_b` by `MAP.stripe(x)`, frame 1 inside an unowned decor footprint and where `(x * 5 + y * 3) % 3 === 0` (round 2); fence, hedge and bed tiles get a lawn tile under them on rows 6 to 11 and a paver above row 6.
2. The y-sorted pass: fence, gate, hedge and bed tiles (hedge frame `x % 2`, round 2); props; active stations with their extras (the fire gauge (round 2), grate pieces, cooking arcs, the counter extension, plate stacks, the slicing piece); owned decor draws not marked `overhead`, and `bed` frame 3 at each `bed` draw of the unowned `flowers` spot (round 2); in the morning and evening only (round 2), ghosts of unowned gear (kettle 2, the drum, the counter extension) and of unowned decor draws not marked `overhead`, at alpha 0.5; dashed outlines of unowned footprints, in every phase; people (shadow, behind hand, body, front hand); eaters' plates; the dog.
3. Overhead: `lights_string` at `overhead.lights` when `decor.lights`; `canopy` at `overhead.canopy` when `gear.canopy`.
4. Smoke, chimney puffs, dark puffs, fire flames.
5. Bubbles (order icon, `mark_x`, food bubble; the order bubble at (px + 14, py - 22), its icon at (px + 18, py - 20), round 2), patience bars (at (px + 15, py - 26)), sweat, zzz, hearts. Fire gauges moved to pass 2 in round 2.
6. The slice bar, floating numbers (outlined text, no box, round 2), coins, sparkles (2x, 14 by 14, round 2), tap rings.
7. Rain.
8. Canvas text in umber boxes: the clock at (2,2); GATE OPENS IN {n} and LAST CALL at (2,183); YOUR PIT on the sign at `MAP.signText`.
9. Blit to `#cv` at the D13 scale, with the burnt shake.

**Sort key** (pass 2): the bottom pixel row of the anchor tile, `sortRow * 16 + 15`; for anyone moving, `Math.round(py) + 15`; a seated customer uses the seat tile's row; a dashed outline uses its run's bottom row; an eater's plate uses the table row `(seat y + 1) * 16 + 15` at a picnic seat and `seat y * 16 + 15` on a lawn chair. Lower keys draw first. **Ties:** (1) key; (2) layer: fence, gate, hedge and beds 0, stations, props, decor and ghosts 1 (a ghost uses its footprint's sort row), outlines 2, people 3, the dog 4, eaters' plates 5; (3) draw x (the top left x the sprite or box is drawn at); (4) list order: ground pieces row major, `MAP.props`, `MAP.stations`, decor in `DecorId` order (within one item its `draws` order), outlines (stations then decor, runs top left first), player, buddy, tender, customers by id, plates by customer id, the dog. The visual checks of [V2.12] are the acceptance for this rule.

### D13. Scaling and taps (replaces sections 4.2 and the tap mapping of 4.5)

```
vw   = document.documentElement.clientWidth
vh   = window.innerHeight
dpr  = window.devicePixelRatio || 1
CONTROLS_H = 24 + 48 + 52 + 8                                        // #status, #act, #chips, slack (round 2)
if (vw >= 900 && vh - 44 - 16 - CONTROLS_H >= 576)  target = 3       // desktop: 528 by 576 CSS px at dpr 1
else if (vw - 16 >= 352)                            target = 2       // phone: 352 by 384 CSS px at dpr 2
else                                                target = (vw - 16) / 176
k = Math.max(1, Math.floor(target * dpr))                            // device pixels per virtual pixel (round 2)
css = k / dpr
cv.width = 176 * k;  cv.height = 192 * k
cv.style.width = (176 * css) + 'px';  cv.style.height = (192 * css) + 'px'
#cv: position relative, left and top nudged so its top left lands on a whole device pixel
```

Review round 2 replaced `k = round(css * dpr)` with the device pixel rule above: every virtual pixel is now exactly `k` device pixels at any DPR (412 at 2.625 gives k 5 and a 335 CSS px canvas). At 375 by 812 dpr 2 and 1024 by 820 dpr 1 the sizes are unchanged.

Recomputed on `resize` and `orientationchange`; smoothing off on both contexts after every resize; `#cv` keeps `image-rendering: pixelated`. The `index.html` rule `@media (max-width: 899px) { #wrap { margin: 0 -8px; width: auto; } }` lets the canvas reach 8 px from each edge (the Game builder adds it, nothing else in the shell changes). `width: auto` was added by the Game builder and kept at integration: the shell's `#wrap { width: 100% }` otherwise holds the box at the column width, so the negative margins only shift it 8 px left and the canvas sits off center. The scale is an integer (2 or 3 CSS px per virtual px) at every viewport 368 CSS px wide or more; only narrower screens take the fit path.

Taps: `vx = (clientX - rect.left) / rect.width * 176`, `vy = (clientY - rect.top) / rect.height * 192`. First the drawn rects of active stations are hit tested in reverse draw order (the table's rect is the `counter` rect (96,88,32,24) plus the `counter_ext` rect (80,88,16,24) when owned); a hit calls `sim.walkTo` with that station's first tile. Otherwise `sim.walkTo(floor(vx / 16), floor(vy / 16))`. People, props, seats and decor never take a tap.

### D14. `game.js` (amends sections 4.1 and 4.4 to 4.10)

- **Clipboard:** a `Decor` heading and block in `#shop` after Gear, the muted note of [V2.16], one row per decor id with a `buy-{decorId}` control (a `Buy` button, or a span `Owned` with the same id), the reserve warning of game deviation 10 applied to decor rows, and a `p#seats` in `#clip-top` right under `#goal` reading `Seats {seatCount()}. Charm {charm()}. Each seated customer tips {seatBonus()} more.`
- **Till:** a `Seat tips` row right after `Tips` (`{seated} sat down`, `+{seatTips}`); the People and Word of mouth lines of [V2.16]; the capped note uses `till.repMax`; net as D6, on a bold row labeled `Take today` with the detail `sales and tips after wages and daily costs` (round 2; it was `Net`).
- **Broke card:** owned decor listed after gear with `sell-{decorId}` buttons, `Sell for {n}`.
- **Status line precedence:** Saving is off in this browser. > Your save was updated for the new yard. (`C.FX.NOTICE_S`, once) > Can't get there > Gate opens in {n} > Last call > `sim.holding()`.
- **aria-live:** the D10 sentences, same queue rules (one a second, identical within 5 s dropped).
- **Feedback and the dog:** [V2.9] exactly, timings from `C.FX`, randomness from `game.js`'s own mulberry32 seeded from `sim.seed`. Frozen yard during panels and pause.
- **Reduced motion** (replaces 4.8): numbers appear and fade in place; no sparkles, squash, chimney puffs, burnt burst or column, shake, twinkle, bird, hop or dog walking (the dog sits at `dogHome` in frame 2); the sweat drop and zzz show still; fire shows frame 0; walking frames, cooking arcs, bars and gauges still animate.

`PitSim.game` v2 (replaces 4.10; every v1 member kept):

```ts
PitSim.game = {
  version: '0.3.0',
  sim: Sim, el: { [id: string]: HTMLElement }, reduced: boolean, saveOff: boolean,
  advance(seconds: float): void,     // steps the sim in TICK_SECONDS ticks, pumps events once, then updates the DOM and renders one frame,
                                     // so a harness read right after it sees fresh #status, #act, panels and draw records
  dog: { x: int, y: int, px: float, py: float, frame: int, flip: boolean },   // live object, read only outside game.js
  fxLog: FxEntry[],                  // append only, newest last, the oldest dropped past 500 entries; emptied by sim reset
  captureFrame(): DrawRecord[]       // renders the current state once, synchronously, without advancing any timer, and returns what it drew
};
FxEntry    = { kind: 'cash' | 'tip' | 'seatTip' | 'sparkle' | 'heart' | 'puff' | 'burnt' | 'column' | 'sweat' | 'zzz'
                     | 'squash' | 'hop' | 'mark' | 'ring' | 'bird',
               x: int, y: int,       // top left virtual px where the effect is first drawn; for cash, tip and seatTip numbers the text position
               day: int, at: float };// state.day and state.clock when it started
DrawRecord = { name: string, frame: int, x: int, y: int, w: int, h: int, ghost?: true };   // virtual px, in draw order; ghost marks an unowned preview (review round 1)
```

An effect that reduced motion turns off is neither started nor logged. `captureFrame()` records every `art.draw` and `art.drawScaled` call (with the drawn `w, h`), one `font` record per glyph of `art.text` and `art.textTinted`, and one `'#outline'` record per dashed box; procedural bars, gauges, arcs, rings and rain are not recorded. `game.js` never issues a draw whose rect lies wholly outside 0 to 176 by 0 to 192, so every record intersects the canvas.

### D15. Harness v2: `games/pit-sim/dev/smoke.mjs` (amends section 5)

Run `node games/pit-sim/dev/smoke.mjs [--out <dir>] [--desktop] [--seed <n>] [--dir <folder>]` from the repo root; exit 0 when every step is ok, 1 otherwise; one `ok` or `FAIL` line per step; `<out>/report.json` plus screenshots `clipboard.png`, `mid-service.png`, `seated.png`, `decor.png`, `till.png`. Phone mode emulates 375 by 812 at dpr 2 (mobile, touch); `--desktop` emulates 1024 by 820 at dpr 1. Constants change to the v2 names: `SURFACE_COUNTS = { tiles: 132, stations: 8, seats: 6, decor: 6, props: 19, catalog: 21 }` (props 16 since review round 1, 19 since round 2); tiles to tap `pile (4,2)`, `kettle1 (5,2)`, `cooler (6,1)`, `board (5,4)`, `table (6,6)`; `MAP_SIZE = { w: 11, h: 12 }`; `REQUIRED_SPRITES` is the D11 literal. DOM reads come right after `PitSim.game.advance` (D14), never on a guessed frame delay. The v1 run of 2026-10-18 failed at `gate open` because `#status` was read before the page painted; `advance` updating the DOM removes that race.

The 27 v1 steps, kept in order and moved to v2 tiles and names, with the new steps inserted (marked **new**):

| # | step | asserts |
|---|---|---|
| 1 | files present | index, sprites, sim, game (fatal) |
| 2 | node --check sprites.js | exit 0 |
| 3 | node --check sim.js | exit 0 |
| 4 | node --check game.js | exit 0 |
| 5 | sim.js loads headless with the full surface | the 12 names; `SURFACE_COUNTS`; `C.WALK_TILES_PER_S === 6`, `C.SAVE_VERSION === 2`, every D2 key present including `C.FX`; `MEATS.sausage.cook === 14`, `MEATS.chicken.cook === 22`; `MAP.dogHome` is (4,7) |
| 6 | validateSave rejects, clamps and migrates | v1 null list minus `{ v: 2 }` (now valid), plus `{ v: 3 }` and `{ v: 0 }` give `null`; the v1 dirty sample of section 5.1 item 3 returns `v: 2` with the same clamps, `decor` all false and `stats.seated === 0`; the section 2.8 v1 sample returns its values unchanged under `v: 2`; `{ v: 2, decor: { chair2: true, bogus: true } }` gives `chair2 false`, no `bogus`; cyclic input does not throw |
| 7 | **new** seat reachability | for all 64 decor sets, each with and without `gear.bigtable`, a BFS on `sim.custWalkable` reaches every owned seat from every active `MAP.queue` spot and reaches `MAP.custSpawn` from every owned seat ([V2.18]) |
| 8 | Chrome launched and CDP connected | port read, phone or desktop emulation set (fatal) |
| 9 | page loaded with zero errors | zero console errors and exceptions; `art.built`; `game.version === '0.3.0'` (fatal) |
| 10 | only the four file:// requests | `index.html`, `sprites.js`, `sim.js`, `game.js` |
| 11 | **new** sprite list and palette | every `REQUIRED_SPRITES` row passes `art.has(name)` and `art.frames(name) === frames`, `SPRITES[name].w` and `.h` match, `Object.keys(SPRITES).length === 113`; `PALETTE.length === 32`, `PALETTE[0] === ''`; `COLOR` has the 31 D11 keys |
| 12 | **new** canvas scale is an integer | phone: `#cv` rect 352 by 384, `cv.width === 176 * k` and `cv.height === 192 * k` with `k === Math.round(2 * devicePixelRatio)`; desktop: rect 528 by 576, `k === Math.round(3 * devicePixelRatio)`; `rect.width / 176` is an integer in both |
| 13 | clipboard: morning, day 1, start cash | phase, day 1, cash 80, prefill emptied, `#open-why` text; **added:** `#seats` text `Seats 2. Charm 0. Each seated customer tips 1 more.`; `captureFrame()` holds `picnic` at (80,136), `bench1`'s `picnic_bench` at (80,136), `'#outline'` boxes for kettle2 (112,32,16,16) and chair1 (112,144,16,16), ghost records (`ghost: true`) of `kettle` at (112,24) and `chair` at (112,136), and `dog` at (64,112) frame 2 |
| 14 | how to | as v1 |
| 15 | bought | as v1 |
| 16 | gate open | phase service, cash, clipboard hidden, `#status` starts with `Gate opens in`, `#act` `Walk`, one `yard_open` |
| 17 | fire raised | tap the pile (4,2) then kettle 1 (5,2); fire at least `FIRE_LIGHT` |
| 18 | meat on | cooler (6,1), kettle 1 |
| 19 | piece done | as v1 |
| 20 | sliced | board (5,4) |
| 21 | carried | as v1 |
| 22 | served with cash up and a served event | table (6,6); `served` with `x, y` equal to a `spotPx`; **added:** `fxLog` gains a `cash` entry over a `MAP.queue` spot, at y = spot py - 26 with x from spot px - 9 to spot px + 16 (round 2: the cash number sits over the served customer) |
| 23 | **new** a served customer sits and a heart fires | after the first `served`: a `seat_taken` with `seat === 'pt1b'` (all seats free on day 1); within 15 s that customer is in mode `eating` on (6,8); then `seat_done` with `bonus === 1`, `atClose === false`, `x === 96`, `y === 128`; `fxLog` gains a `heart` at (96,104) and a `seatTip`; within 3 s more the customer is `leaving` with `reason === 'seated'` and `state.seats.pt1b === null`; screenshot `seated.png` while eating |
| 24 | rest of the day cooked and carried | as v1 |
| 25 | day over | as v1; **added:** every `state.seats` value is `null`; no customer in `toSeat` or `eating` |
| 26 | a walk-out with rep down, or the day sold out early | the serve credit is `happy * REP_QUICK + togoQuick * REP_TOGO_QUICK + ok * REP_OK` |
| 27 | till shown | `#till-h` `Day 1 till`; **added:** a `Seat tips` row; `till.net === revenue + tips + seatTips - wages - DAILY_COSTS` |
| 28 | save key present and valid | as v1; **added:** raw JSON has `v === 2`, `decor`, `stats.seated >= 1` |
| 29 | reload persists | as v1 |
| 30 | **new** decor purchase shows the sprite | write a v2 save (`day 2`, `cash 200`, the rest default) to `SAVE_KEY`, reload; click `buy-chair1`; one `purchase` with `kind === 'decor'`; `state.decor.chair1`; `#seats` text `Seats 3. Charm 3. Each seated customer tips 1 more.`; `advance(0)`; `captureFrame()` holds a non ghost `chair` at (112,136) and no `'#outline'` at (112,144); the stored save validates with `decor.chair1 === true`; screenshot `decor.png` (in phone mode with `#panels` hidden for the shot, since the clipboard covers the canvas) |
| 31 | **new** v1 save migrates | write the section 2.8 v1 sample, reload; morning of day 5, cash 187, rep 80, stock, charcoal, gear and hires as written, `decor` all false; `#status` reads `Your save was updated for the new yard.`; the stored save now has `v === 2` |
| 32 | pause and resume | as v1 (Escape and P, `#root` `data-paused`) |
| 33 | **new** no sprite drawn outside the canvas | resume, `advance(45)` so customers walk in through the gate; then `captureFrame()` here and at the morning (step 13) and mid service (step 22) captures: every record intersects 0 to 176 by 0 to 192; a record may extend past an edge only if it is a person, `shadow` or `hand_*` record whose bottom passes 192 (a customer at the gate or the spawn); since review round 1 no fence piece is exempt |
| 34 | **new** layout and keyboard at 375 by 740 | `scrollWidth <= innerWidth`; every visible `button` at least 44 by 44; `#cv` 352 by 384; reload at that size, buy a bag and a unit, open the yard; the player is at `MAP.spawn` (6,3); ArrowLeft then `advance(0.5)` gives `player.x === 5` |
| 35 | **new** reduced motion | `prefers-reduced-motion: reduce`, reload with the seed: `game.reduced === true`; `captureFrame()` shows `dog` at (64,112) frame 2; open the yard and send a mouse tap (`Input.dispatchMouseEvent`) at the canvas point of the pile tile (4,2); the walk starts and `fxLog` gains a `ring` and no `squash` |
| 36 | zero console errors across the run | as v1 |

Step 36 closes Chrome and removes the profile in a `finally`, as v1. Steps 1, 8, 9, 13, 15 to 22, 25 and 29 stay fatal as in v1. `dev/econ.mjs`, if the Sim builder writes it, is not a harness step ([V2.18]).

### D16. Decisions made in this delta

1. The spec's names win over the brief's working names (D0); no aliases, so nobody implements two spellings.
2. Seats, decor and props are typed by a `kind` field in their own arrays; `MAP.stations` stays the eight v1 stations.
3. Cosmetic timings live in `C.FX` (owned by `sim.js`, read by `game.js`) so `game.js` hard codes no timing, which section 2.1 already required.
4. No `migrateSave`: one validator, two accepted versions, always returns v2.
5. `PitSim.game` gains three read only hooks (`dog`, `fxLog`, `captureFrame`) and `advance` refreshes the DOM and draws one frame, so the harness asserts on what the page drew rather than on screenshots.
6. The legend stays one character per pixel, base 32, `0` to `v`; the extension past 36 colors would be uppercase, decided now, unused.
7. `dogHome` is (4,7), following [V2.2.3]; the first draft of this delta had (4,8).
8. The Game builder owns the one `index.html` CSS rule; nobody else touches the shell.

### Integration record (2026-10-18, evening)

The four v2 builds were integrated against this delta the same evening. Result: `node games/pit-sim/dev/smoke.mjs` passes 37 of 37 steps in phone mode and in `--desktop` mode with zero console errors, exceptions or log errors and only the four file:// requests. A seam diff (sprites.js and sim.js loaded in Node with a canvas stub, game.js scanned) found every name in place: the 13 top level names and nothing extra; the 14 `art` members; the 111 sprites, 263 frames, 32 palette entries and 31 `COLOR` keys; the 30 D10 event types, each emitted by `sim.js` and none outside the table, with a `game.js` case for every event that has a sentence; every `C`, `C.FX`, `MAP`, `STRINGS` and sim member `game.js` reads.

Amended at integration (the tables above already carry these):

1. D4: (5,1) is no longer a use tile of `kettle1` or `cooler`. It is in a closed pocket with (4,1), boxed in by the shed (3,1), the pile (4,2), kettle 1 (5,2), the cooler (6,1) and the back fence, so no BFS could reach it. Play is unchanged. `sim.js` records it as sim deviation 21; [V2.3] and the [V2.12] visual check (now kettle 2 over a player on (7,1)) are amended to match.
2. D13 and the ownership table: the `index.html` rule is `@media (max-width: 899px) { #wrap { margin: 0 -8px; width: auto; } }`. Without `width: auto` the shell's `#wrap { width: 100% }` keeps the box at the column width and the canvas sits 8 px left of center (3.5 px gutter on one side, 19.5 px on the other). With it the canvas is centered with 11.5 px each side at 375 px.
3. D15: the harness runs 37 steps, not 36. It adds "dog never on a station use tile" after step 33, checks the integer scale in both modes inside step 12, checks the 44 px minimum twice in step 34, and in step 26 compares `repDelta` against the serve credit clamped to `[REP_DAY_MIN, till.repMax]` (the clamp is the rule, so the raw credit was the wrong comparison).
4. Builder deviations kept as written in each file header: Art (mirrored frames and one tinted font strip per `COLOR` key pre-rendered in `build()`; `textTinted` throws on an unknown color key; `drawScaled` draws nothing under 1 px and restores smoothing; slashed zero); Sim 16 to 21; Game (YOUR PIT drawn in the y-sorted pass right after the sign; `fxLog` logs continuous emitters once per stream; draws that cross an edge are skipped except the D15 step 33 exceptions; transient effects cleared at `yard_open`, the next morning and a new game; chimney vents read from the first tile's top left; the v1 change-of-hands bounce replaced by the squash).

Checked by eye at integration (phone and desktop screenshots from the harness, plus a full yard with every gear, decor and hire at rep 100, a full line of five, a rain day, the Broke card with decor sell buttons, the Coming next card, a 320 px and a 414 px phone, and real time touch play): the y-sort reads right (counter over the player's shins, sitters chest up over the picnic table, the bottom fence over feet at the gate, the tree over row 1), every sprite sits on its footprint, and there is no horizontal scroll at 320, 375 or 414 px.

Known issues left open, all cosmetic, for the Overseer (none is a contract violation):

1. The buddy's idle tile (4,5) is directly behind the left light post footprint (4,6). With String lights owned, the post draws down the middle of the buddy (the y-sort is right; it reads as a lamp wearing his cap). Fixing it means moving the post or the idle tile, which changes [V2.2] and the [V2.4] route table.
2. Seats pt1a and pt1b are 16 px apart and a `+N TIP` seat tip number is 29 px wide, so two seated customers finishing within 0.9 s print over each other. Cash numbers from back to back serves on neighboring plate spots (10 px apart) overlap the same way.
3. The cream `+N TIP` tip number lands on the counter's white top edge and, with String lights owned, on the light string, where mostly its brown shadow reads ([V2.9] fixes the color as cream).
4. The canopy's striped top (y 106 to 118) shares its band with the pt1a and pt1b food bubbles, hearts and seat tip numbers, so during service it is mostly covered.
5. The woodpile (9,1) is almost entirely under the tree canopy.
6. The economy reruns (`dev/econ.mjs` and the Sim builder's bot) cook only sausage and chicken; second kettle on day 3 or 4 and the drum on day 13 to 15 for seeds 1 to 8 describe that bot, not a player who buys ribs, butt and brisket.

### Review round 1 (2026-10-18, night)

Applied from the first visual review; the tables above already carry these. No economy number changed.

1. D4: four props, `woodpile2` (4,1), `woodpile3` (5,1), `planter2` (1,4) and `shelf` (2,3), appended to `MAP.props` (16 entries). They close the unreachable pocket of integration item 1 and fill two dead cook area pavers. A BFS from the spawn with no gear or decor and with everything owned still reaches every owned station use tile, `buddyIdle` and `tenderIdle`. Sim deviation 22.
2. D2: `C.FX` `NUMBER_S` 1.4, `NUMBER_FADE_AT` 1.0, `NUMBER_RISE_PX` 14, `TIP_GAP_PX` 11, `HEART_S` 1.4, `HEART_RISE_PX` 12.
3. D11: `fence_back` (16x16, 2 frames) and `shelf` (16x24, 1 frame); 113 names, 266 frames. The drum is painted red, the empty board shows a cleaver, the nap frame of the dog is redrawn. Sizes and frame meanings of existing names are unchanged.
4. D12 and D14: back fence row inside the canvas; ghosts of unowned gear and decor under the outlines, recorded with `ghost: true`; outlines in the outline color on pavers; the customer route drawn with pavers; floating numbers in pills (cash yellow, tip white, seat tip pink at (seat x - 30, seat y - 22)); the heart at 2x at (seat x, seat y - 24); chimney puffs centered on the vent and drifting away from the cooler. Game deviation 17.
5. D15: `SURFACE_COUNTS.props` 16, the sprite list and count, step 13 ghosts, step 23 heart (96,104), step 30 ghost aware and the phone `decor.png` with the panels hidden, step 33 without the fence exception.

Known issue 3 above (the cream tip number) is fixed by item 4.

### Review round 2 (2026-10-18, night)

Applied from the second visual review; the tables above already carry these. No economy number changed.

1. D13: the scale is picked in device pixels, `k = max(1, floor(target * dpr))`, CSS scale `k / dpr`, and `#cv` is nudged (position relative) onto a whole device pixel, so no DPR resamples the canvas. Desktop 3x also needs room for `#status`, `#act` and `#chips` (`CONTROLS_H` 132 px) or falls back to the 2x rule. Game deviation 18a.
2. D4: three props appended to `MAP.props` (19 entries): `pot3` (4,8) in the lawn nook between the picnic tables, `pot4` (2,2) under the shed window, `woodpile4` (9,4) by the right fence. None is a seat, footprint, queue, spawn, idle or use tile; with every decor set, with and without the bigger table, every seat still reaches every queue spot and the customer spawn. (4,8) leaves `dogRoam`. Kettle `slotPx` is (0,-7) (6,-7), inside the kettle. Sim deviation 23.
3. D2: `C.FX.TIP_GAP_PX` is -11, so the tip number stacks above the cash number.
4. D11: `hedge` gains frame 1 (blossoms) and `bed` frame 3 (tilled soil, nothing planted); `cooler` frame 0 is repainted as a small red cooler with a white lid and band. 113 names, 268 frames.
5. D12 and D14: ghosts in the morning and evening only, alpha 0.5; outlines in every phase; the unbought flower bed draws `bed` frame 3; lawn clover inside unowned decor footprints and on `(x * 5 + y * 3) % 3 === 0`; hedge frame `x % 2`; fire gauges drawn with their cooker in the y-sorted pass; floating numbers as outlined text with no box, the cash number over the served customer (coin at px, text at px + 9, py - 26), the tip at the customer's px 11 px above it, the seat tip over the heart at (seat x - 4, seat y - 34), all clamped inside the canvas; a number whose box overlaps one that started under 0.5 s ago (within 8 px in y) starts 0.3 s later per such number (at most 3), and so does a heart within 12 px of a fresh one; sparkles at 2x; order bubble, icon and walk out mark 2 px higher, patience bar at py - 26; the dog skips a roam tile whose south neighbor is a taken seat; the till's bold row reads `Take today`. Game deviation 18.
6. D15: 38 steps. A new step 13, "canvas is device pixel exact on Android and laptop sizes", emulates 412 by 915 at 2.625, 360 by 800 at 3, 393 by 873 at 2.75, 1366 by 657 at 1 and 1280 by 720 at 1.5 and asserts a backing store that is a whole multiple of 176 by 192, a rect times dpr equal to it, the top left on a whole device pixel, no horizontal scroll, and on the two laptop sizes the meat chips inside the viewport. `SURFACE_COUNTS.props` 19, the D11 literal, step 22's cash position (item 5). Every later step number moves up by one.

Not applied in round 2, with the reason:

- The charcoal pile leg (table to pile 4 tiles): the pile must stay adjacent to kettle 1 ([V2.2]), and every tile next to the pile that could be a use tile is either the tender's idle tile (3,2), a woodpile in the closed pocket (4,1) or a station; (4,3) is 4 tiles from the counter use tile (6,5) by Manhattan distance, so no pile use tile can be within 3 without moving kettle 1.
- The woodpiles at (5,1) and (9,1): (8,1) is the only route to the use tile (7,1) once kettle 2 is owned and sits under the tree canopy too; (3,2) is the tender's idle tile. A visible woodpile was added at (9,4) instead (item 2).
- The buddy idle tile behind the left light post (integration known issue 1): the only free paver with no tall sprite south of it, (2,5), is two tiles farther from the board, which adds about a second to every buddy run, a nerf to a paid hire for a cosmetic issue. Left for the Overseer.
- The canopy over row 7 heads (integration known issue 4): y 98 still covers 4 px of those heads and moves the cloth onto the front of the counter; x 68 puts the pole through the pt1a seated customer; drawing the cloth and the pole in different passes needs a clipped draw that `PitSim.art` does not have.
- Order bubbles moved above the head or flipped left: either puts the (7,7) bubble over the counter's plate spots or stacks the (8,7) bubble on the (7,7) bubble. The bubbles were raised 2 px instead (item 5).
- The optional 2x cash number: it needs a scratch canvas drawn outside `art.text`, so `captureFrame` would lose its font records.

---

## 0. Conventions used in this document

> **v2:** tile ranges, canvas size and the meaning of up are D3. The rest stands.

- Types are written TypeScript style for reading only; the code is plain ES2020, strict mode, no build step.
- `int` means a JavaScript number that is always an integer. `float` means any finite number. `clock` means a float in simulated seconds since the yard opened that day (0 at Open the yard).
- `MeatId` is one of `'sausage' | 'chicken' | 'ribs' | 'butt' | 'brisket'`, always in that order wherever an ordered list of meats appears.
- `CookerId` is one of `'kettle1' | 'kettle2' | 'drum'`.
- `StationId` is one of `'kettle1' | 'kettle2' | 'drum' | 'board' | 'cooler' | 'table' | 'pile' | 'trash'`.
- `GearId` is one of `'kettle2' | 'cooler' | 'bigtable' | 'tray' | 'canopy' | 'drum'`.
- `HireId` is one of `'buddy' | 'tender'`.
- `Dir` is one of `'up' | 'down' | 'left' | 'right'`. Up is toward y = 0 (the gate), down is toward y = 14.
- Tile coordinates are `(x, y)` with x in 0 to 12 and y in 0 to 14, as in the map in [spec 4]. Pixel coordinates are in the 208 by 240 virtual canvas; a tile's top left pixel is `(x * 16, y * 16)`.
- "Emits" means pushes an event object onto the sim's event queue, read by `drainEvents()` (section 2.9).
- Strings the player reads are written here exactly as they must appear. None contains a dash of any kind.

---

## 1. The shared global

Every script is an IIFE: it wraps its whole body in one function expression, `(function () { ... })();`, and the first statement inside the wrapper is this line (after `'use strict';` where the file puts it there), which in the browser is `PitSim = window.PitSim || (window.PitSim = {})` written with `globalThis` so that `sim.js` also runs in Node; nothing else touches the global, and no script declares anything at the top level. (Corrected 2026-10-18: the first version of this sentence said the line sat at the top level. Three classic scripts that each declare a top level `const PitSim` share one global lexical scope and the second one throws a redeclaration SyntaxError, so all three builders used the wrapper; the wrapper is now the rule, not a deviation.)

```js
const PitSim = globalThis.PitSim || (globalThis.PitSim = {});
```

`globalThis` is `window` in the browser and the Node global in the harness, so `sim.js` runs in Node unchanged. No script uses `window` or `document` at the top level except `game.js`. `sim.js` never references `window`, `document`, `localStorage`, `performance`, `requestAnimationFrame`, `setTimeout`, `Math.random`, `module`, `require`, `import` or `export`. The repo's root `package.json` has `"type": "module"`, so Node treats these `.js` files as ES modules when imported; that is why the harness loads `sim.js` with `vm.runInThisContext` (section 5) rather than `import`, and why `sim.js` must not use top level `this`.

Each module attaches exactly the names listed for it and no others:

| Module | Attaches to `PitSim` |
|---|---|
| `sprites.js` | `art` |
| `sim.js` | `C`, `MEATS`, `MEAT_IDS`, `MAP`, `CATALOG`, `STRINGS`, `createSim`, `validateSave`, `fireBand`, `fireMult`, `tileOwned`, `SAVE_KEY` |
| `game.js` | `game` |

A module that finds its own names already present (a double load) overwrites them.

---

## 2. `sim.js` surface

### 2.1 `PitSim.C`: constants

> **Amended by the v2 delta, D2:** `WALK_TILES_PER_S` 6, `SAVE_VERSION` 2, the seating, charm and cue keys, `C.FX`, and `PATIENCE_MID_FRAC` and `GEAR_RESERVE` now in the contract.

A frozen plain object. Every value from [spec 19], named as below. `game.js` reads timing and layout values from here (for example the gate countdown) and never hard codes them. `sim.js` reads nothing else for these values.

```js
PitSim.C = Object.freeze({
  // day and world
  DAY_SECONDS: 125, GATE_OPENS: 30, LAST_CALL: 110,
  START_CASH: 80, START_REP: 20,
  WALK_TILES_PER_S: 5, NPC_TILES_PER_S: 4,
  TICK_SECONDS: 0.05, MAX_FRAME_DT: 0.05,
  // fire
  FIRE_LIGHT: 60, COLD_UNDER: 10, FIRE_ADD: 30, FIRE_MAX: 100,
  KETTLE_DECAY: 1.0, DRUM_DECAY: 0.6, KETTLE_SLOTS: 2, DRUM_SLOTS: 4,
  FIRE_GOOD: 50, FIRE_HOT: 85, HOT_MULT: 1.2,
  FIRE_LOW_WARN: 30, TENDER_THRESHOLD: 55, TENDER_CYCLE: 4,
  CHARCOAL_PRICE: 2,
  // customers
  SPAWN_MAX: 13, SPAWN_MIN: 5, SPAWN_JITTER_LO: 0.85, SPAWN_JITTER_HI: 1.15,
  PATIENCE_BASE: 45, PATIENCE_SPREAD: 10, PATIENCE_WARN_FRAC: 0.2,
  ORDER_FROM_TABLE: 0.8, HOT_PLATE_SECONDS: 30, TIP_RATE: 0.25, HOT_PLATE_TIP: 1,
  QUEUE_SPOTS: 3, QUEUE_SPOTS_BIG: 5, TABLE_SPOTS: 3, TABLE_SPOTS_BIG: 5,
  TABLE_STACK: 6, BOARD_STACKS: 4, BOARD_STACK: 8, TRAY_PLATES: 2,
  WALK_PAST_PAUSE: 0.8, LEAVE_TURN_SECONDS: 0.2,
  // staff
  BUDDY_HANDLE: 0.4, BUDDY_WAGE: 20, TENDER_WAGE: 30,
  // reputation
  REP_QUICK: 2, REP_OK: 1, REP_WALKOUT: -3, REP_QUICK_FRAC: 0.4,
  REP_DAY_MAX: 12, REP_DAY_MIN: -15, CLOSE_PENALTY: 0,
  // money
  DAILY_COSTS: 10, SELL_BACK: 0.5, STEPPER_MAX: 99, CASH_FLOOR: 0,
  DRIVEWAY_PRICE: 1000,
  // weather
  RAIN_FROM_DAY: 4, RAIN_CHANCE: 0.15, RAIN_ARRIVALS: 0.6,
  // save clamps
  SAVE_VERSION: 1, MAX_DAY: 999, MAX_CASH: 999999, MAX_STAT: 9999999
});
```

Fire bands, from these: out is `fire < COLD_UNDER`, low is `COLD_UNDER <= fire < FIRE_GOOD`, good is `FIRE_GOOD <= fire < FIRE_HOT`, hot is `fire >= FIRE_HOT`. `LEAVE_TURN_SECONDS` is the pause a customer makes at their spot before walking out (the "turns" in [spec 6.3]); the spec did not give a number, this one is decided here.

`PitSim.SAVE_KEY = 'hs.pitsim.save'` (a string on `PitSim`, also used by `game.js` and the harness).

### 2.2 `PitSim.MEATS` and `PitSim.MEAT_IDS`

> **v2.1:** the windows are K2 (14, 16, 18, 22, 26); the block below is the v2 record.
>
> **v2:** unchanged; the shipped sausage 10 and chicken 16 cook times revert to the 14 and 22 below (D2, [V2.19] item 1).

```js
PitSim.MEAT_IDS = Object.freeze(['sausage', 'chicken', 'ribs', 'butt', 'brisket']);

PitSim.MEATS = Object.freeze({
  sausage: { id: 'sausage', label: 'Sausage',        plateLabel: 'Sausage',       unit: 4,  plates: 2, cook: 14, window: 6,  price: 5,  slots: 1, slice: 3, drumOnly: false, key: '1' },
  chicken: { id: 'chicken', label: 'Chicken thighs', plateLabel: 'Chicken thighs', unit: 6,  plates: 2, cook: 22, window: 8,  price: 8,  slots: 1, slice: 4, drumOnly: false, key: '2' },
  ribs:    { id: 'ribs',    label: 'Pork ribs',      plateLabel: 'Pork ribs',     unit: 12, plates: 3, cook: 32, window: 10, price: 11, slots: 1, slice: 5, drumOnly: false, key: '3' },
  butt:    { id: 'butt',    label: 'Pork butt',      plateLabel: 'Pulled pork',   unit: 20, plates: 5, cook: 40, window: 14, price: 14, slots: 2, slice: 6, drumOnly: false, key: '4' },
  brisket: { id: 'brisket', label: 'Brisket',        plateLabel: 'Brisket',       unit: 38, plates: 7, cook: 50, window: 18, price: 18, slots: 2, slice: 7, drumOnly: true,  key: '5' }
});
```

`plateLabel` is used only in the aria-label of a plate [spec 18]. `key` is the keyboard digit that selects the chip.

### 2.3 `PitSim.MAP`

> **Superseded by the v2 delta, D4.** Kept for history.

```js
PitSim.MAP = Object.freeze({
  W: 13, H: 15, TILE: 16,                       // tiles across, tiles down, pixels per tile
  T: Object.freeze({ GRASS: 0, FENCE: 1, GATE: 2, PATH: 3, LAWN: 4, HEDGE: 5, QUEUE: 6 }),
  tiles: Int8Array | number[]                   // length 195, row major: tiles[y * 13 + x]
  at(x, y): int                                 // tiles[y*13+x], or T.FENCE when outside the map
  stations: Station[]                           // section 2.3.2, in the order listed there
  station(id): Station                          // lookup by id
  spawn:   { x: 6, y: 9, face: 'up' },          // pitmaster start
  gate:    { x: 6, y: 0 },
  custSpawn: { x: 6, y: -1 },                   // customers appear here, one tile above the gate
  passStop:  { x: 6, y: 4 },                    // where a walk past stops for WALK_PAST_PAUSE
  queue: [ { x: 6, y: 5, gear: null }, { x: 5, y: 5, gear: null }, { x: 7, y: 5, gear: null },
           { x: 4, y: 5, gear: 'bigtable' }, { x: 8, y: 5, gear: 'bigtable' } ],   // line order, front first
  buddyIdle:  { x: 5, y: 9 },
  tenderIdle: { x: 7, y: 13 },
  canopy: { x: 4, y: 5, w: 5, h: 3 }            // tile rectangle the canopy covers, rows 5 to 7, x 4 to 8
});
```

#### 2.3.1 Ground tiles

`tiles` holds ground only; stations are not in it. Row by row, from [spec 4]:

- y = 0: `FENCE` everywhere except `(6, 0)` which is `GATE`.
- y = 1 to 4: `FENCE` at x = 0 and x = 12, `PATH` at x = 6, `LAWN` everywhere else. Lawn is drawn as grass and is never walkable for the player.
- y = 5: `FENCE` at x = 0 and 12, `HEDGE` at x = 1 to 3 and 9 to 11, `QUEUE` at x = 4 to 8. Queue tiles are drawn as grass and are never walkable for the player. Whether (4,5) and (8,5) are active spots depends on `gear.bigtable`; see `MAP.queue`.
- y = 6 to 13: `FENCE` at x = 0 and 12, `GRASS` everywhere else, including under every station footprint.
- y = 14: `FENCE` everywhere.

Grass variant for drawing: `(x + y) % 2 === 0` draws `grass` frame 0, otherwise frame 1 (section 3.4).

#### 2.3.2 Stations

```ts
Station = {
  id: StationId,
  type: 'cooker' | 'board' | 'cooler' | 'table' | 'pile' | 'trash',
  label: string,                 // 'Kettle 1', 'Kettle 2', 'Drum smoker', 'Cutting board', 'Cooler', 'Serving table', 'Charcoal pile', 'Trash'
  spoken: string,                // aria name: 'kettle 1', 'kettle 2', 'the drum', or '' for the rest
  gear: GearId | null,           // the whole station exists only when this gear is owned
  tiles: { x, y, gear?: GearId }[],          // footprint; an entry with gear exists only when that gear is owned
  use:   { x, y, face: Dir, gear?: GearId }[], // BFS targets for tap to walk; face is the direction from the use tile toward the station
  slots?: int,                   // cookers only: grate slot count
  decay?: float,                 // cookers only: fire decay per second
  slotPx?: { x, y }[]            // cookers only: pixel offset of each grate slot's 10 by 10 piece from the station's top left pixel
};
```

The array, in this order:

| id | type | gear | tiles | use (x, y, face) | extra |
|---|---|---|---|---|---|
| `kettle1` | cooker | null | (8,9) | (7,9,right) (8,8,down) (9,9,left) (8,10,up) | slots 2, decay 1.0, slotPx [(-1,1),(7,1)] |
| `kettle2` | cooker | `kettle2` | (8,11) | (7,11,right) (8,12,up) (9,11,left) | slots 2, decay 1.0, slotPx [(-1,1),(7,1)] |
| `drum` | cooker | `drum` | (10,10) (10,11) | (9,10,right) (9,11,right) (10,12,up) (11,10,left) (11,11,left) | slots 4, decay 0.6, slotPx [(-1,5),(7,5),(-1,17),(7,17)] |
| `board` | board | null | (4,9) | (5,9,left) (4,8,down) (4,10,up) (3,9,right) | |
| `cooler` | cooler | null | (3,11) | (4,11,left) (3,10,down) (3,12,up) (2,11,right) | |
| `table` | table | null | (5,6) (6,6) (7,6) (4,6 gear bigtable) (8,6 gear bigtable) | (5,7,up) (6,7,up) (7,7,up) (4,7,up gear bigtable) (8,7,up gear bigtable) | |
| `pile` | pile | null | (8,13) | (8,12,down) (7,13,right) (9,13,left) | |
| `trash` | trash | null | (2,13) | (3,13,left) (2,12,down) (1,13,right) | |

`PitSim.tileOwned(entry, gear)` is a pure helper: `return !entry.gear || gear[entry.gear] === true;`. It applies to a station (`entry = station`), a footprint tile, a use tile or a queue entry. A station tile is **active** when both `tileOwned(station, gear)` and `tileOwned(tile, gear)` hold. Only active tiles block movement and only active stations are in reach. `game.js` draws the dashed outline on every inactive station tile [spec 4].

#### 2.3.3 Walkability

The player may stand on `(x, y)` when all hold: inside the map; `MAP.at(x, y) === T.GRASS`; no active station tile is at `(x, y)`. Nothing else blocks: customers, the buddy and the tender never block any tile [spec 6.1]. `sim.walkable(x, y)` exposes this rule (section 2.6).

The buddy and the tender walk the same grid under the same rule, with BFS from their idle tile. Customers never pathfind; their routes are fixed (section 2.5.6).

### 2.4 `PitSim.CATALOG`

> **Amended by the v2 delta, D5:** six decor rows after the gear rows, length 21, `kind` `'decor'`, `needs` `{ decor }`.

An array of shop rows in display order. Shape:

```ts
CatalogRow = {
  id: string,                           // MeatId | 'charcoal' | GearId | HireId | 'driveway'
  kind: 'meat' | 'fuel' | 'gear' | 'hire' | 'goal',
  label: string,                        // row name as displayed
  price: int,                           // per unit, per bag, once, or wage per day
  effect: string,                       // the effect line as displayed, exactly from spec 8
  needs: null | { gear: GearId } | { day: int },   // prerequisite
  needsText: string,                    // '' or 'Needs the second kettle.' / 'Needs the drum smoker.' / 'From day 2.'
  sets: string                          // for the reader: which state fields the purchase changes
};
```

Rows, in order:

| id | kind | label | price | effect | needs | needsText | sets |
|---|---|---|---|---|---|---|---|
| sausage | meat | Sausage | 4 | Sausage: 2 plates a unit, quickest cook, sells for 5. | null | | cart.meat.sausage, then stock.sausage on open |
| chicken | meat | Chicken thighs | 6 | Chicken thighs: 2 plates, 22 seconds on good fire, sells for 8. | null | | cart.meat.chicken |
| ribs | meat | Pork ribs | 12 | Pork ribs: 3 plates, 32 seconds, sells for 11. | null | | cart.meat.ribs |
| butt | meat | Pork butt | 20 | Pork butt: 5 plates of pulled pork, 40 seconds, both grate slots, sells for 14. | null | | cart.meat.butt |
| brisket | meat | Brisket | 38 | Brisket: 7 plates, 50 seconds on the drum, sells for 18. | { gear: 'drum' } | Needs the drum smoker. | cart.meat.brisket |
| charcoal | fuel | Charcoal | 2 | One bag lights a cold cooker to 60 or adds 30 to a lit one. A kettle burns through about five bags a day. Bags left over keep. | null | | cart.charcoal, then charcoal on open |
| kettle2 | gear | Second kettle | 90 | Two more grate slots. Twice the meat on the fire. | null | | gear.kettle2, stations.kettle2 becomes active |
| cooler | gear | Cooler | 60 | Raw meat keeps overnight instead of spoiling. | null | | gear.cooler |
| bigtable | gear | Bigger table | 70 | Five people can wait instead of three, and five plate spots instead of three. | null | | gear.bigtable, table.spots grows to 5, queue spots 4 and 5 activate |
| tray | gear | Serving tray | 50 | Carry two plates at a time. | null | | gear.tray |
| canopy | gear | Canopy | 80 | Rain days run at full crowd. | null | | gear.canopy |
| drum | gear | Drum smoker | 280 | Four grate slots, holds heat longer, and the only cooker that takes brisket. | { gear: 'kettle2' } | Needs the second kettle. | gear.drum, stations.drum active, brisket and tender rows unlock |
| buddy | hire | Buddy | 20 | Runs plates from the board to the table so you can stay on the fire. Paid each evening. | { day: 2 } | From day 2. | hires.buddy |
| tender | hire | Fire tender | 30 | Keeps every cooker above 55 as long as there are bags in the pile. Buy about seven bags a cooker when he's on. | { gear: 'drum' } | Needs the drum smoker. | hires.tender |
| driveway | goal | Driveway pop-up | 1000 | The next rung. Not built in this prototype. | { gear: 'drum' } | Needs the drum smoker. | nothing; goal line and Coming next card only |

Goal order for the clipboard goal line [spec 7]: `kettle2`, `buddy`, `bigtable`, `drum`, `driveway`. `sim.goal()` (section 2.6) returns the first of these not yet owned or hired.

### 2.5 `PitSim.createSim(saved, seed)` and the state

```js
const sim = PitSim.createSim(saved /* validated save object or null */, seed /* optional uint32 */);
```

- `saved`: the object returned by `PitSim.validateSave`, or `null` for a new game. `createSim` does not validate; passing a raw parsed save is a caller bug. A `null` start is day 1 with the starting kit [spec 7].
- `seed`: optional integer. When omitted, `Date.now() >>> 0`. The sim's only randomness is `sim.rng()`, a mulberry32 generator over this seed returning a float in [0, 1). Given the same seed and the same sequence of method calls and `step` deltas, two sims produce identical state. `sim.seed` holds the number used.
- A sim created from a save or from null always starts in phase `'morning'` with the clipboard data ready (rain rolled, Broke test run, cart empty, `selected` set). The morning roll consumes rng.

#### 2.5.1 `sim.state`

> **Amended by the v2 delta, D6:** `decor`, `seats`, `stats.seated`, the Today and Till additions, and the v2 Customer (`body` 0 to 3, modes `toSeat` and `eating`, reasons `seated` and `togo`, `seat`, `eat`, `eatMax`, `bonusPaid`). Mover `px, py` stay the top left of the 16 by 16 tile; people draw 8 px higher (D11).

A plain mutable object. `game.js` reads it every frame for rendering and never writes to it. Every field:

```ts
state = {
  day: int,                       // 1 or more
  phase: 'morning' | 'service' | 'evening',
  paused: boolean,                // set by setPaused; step() does nothing while true
  broke: boolean,                 // morning only: the Broke card replaces the clipboard while true
  clock: clock,                   // 0 at openGate; prep is clock < C.GATE_OPENS; service proper is GATE_OPENS to DAY_SECONDS
  cash: int,                      // never negative
  rep: int,                       // 0 to 100
  stock: { [m in MeatId]: int },  // raw units in the cooler or crate
  charcoal: int,                  // bags in the pile
  gear:  { kettle2, cooler, bigtable, tray, canopy, drum: boolean },
  hires: { buddy, tender: boolean },
  stats: { days, served, walkouts, past, burnt: int },   // lifetime, as in the save
  drivewayShown: boolean,
  rain: boolean,                  // today's weather, rolled at the start of each morning
  comingNext: boolean,            // morning only: the Coming next card is open inside the clipboard
  yesterday: null | { served: int, walkouts: int, past: int },   // null after a load or on day 1
  cart: { meat: { [m in MeatId]: int }, charcoal: int },         // pending shop quantities, morning only
  selected: MeatId,               // the meat chip in effect
  spawnAt: clock,                 // next customer arrival time; Infinity after last call
  arrivals: int,                  // customers spawned today, also the body variant counter
  lastCallFired: boolean,
  gateSoonFired: boolean,
  stations: {
    kettle1: Cooker, kettle2: Cooker, drum: Cooker,   // all three always present; inactive cookers have fire 0 and no pieces
    board: Board,
    table: Table
  },
  player: Mover & { carrying: Carry, busy: null | Busy, target: null | { station: StationId, auto: boolean } },
  buddy:  null | (Mover & { carrying: Carry, task: 'idle' | 'pickup' | 'carry' | 'wait' | 'return', t: float }),
  tender: null | (Mover & { carrying: Carry, task: 'idle' | 'grab' | 'walk' | 'add' | 'return', t: float, cooker: CookerId | null, cooldown: float }),
  customers: Customer[],          // every customer currently in the yard, including ones walking out
  today: Today,                   // the day's running totals, reset at openGate
  till: null | Till               // the last till, set at day end, kept through the next morning for display
};
```

`buddy` and `tender` are objects only while that hire is on for the day being played (set at `openGate` from `hires`); otherwise `null`. During the morning they are `null`.

```ts
Mover = {
  x: int, y: int,                 // the tile the mover stands on, or is leaving when `next` is set
  px: float, py: float,           // top left pixel of the 16 by 16 sprite, interpolated between tiles
  face: Dir,
  next: null | { x: int, y: int }, // the tile currently being stepped into; px, py move toward it
  path: { x: int, y: int }[],     // remaining tiles after `next`, in order
  walking: boolean,               // true while next is set; drives the walk animation
  anim: float                     // seconds spent walking, for frame selection (frame = floor(anim * 8) % 2 + 1)
};

Carry =
  | null
  | { kind: 'charcoal' }
  | { kind: 'raw',    meat: MeatId }
  | { kind: 'cooked', meat: MeatId }
  | { kind: 'burnt',  meat: MeatId }
  | { kind: 'plates', meat: MeatId, times: clock[] };   // one entry per plate, the clock each was sliced; length 1 or 2

Busy = { what: 'slice', meat: MeatId, t: float, total: float };   // t counts up from 0 to total

Cooker = {
  id: CookerId,
  fire: float,                    // 0 to 100
  slots: int,                     // 2 or 4
  pieces: Piece[],                // on the grate, any order; free slots = slots minus the sum of piece.size
  lowWarned: boolean,             // fire_low fired since the fire was last at or above FIRE_LOW_WARN
  outFired: boolean               // fire_out fired since the fire was last above 0
};

Piece = {
  id: int,                        // unique within the day
  meat: MeatId,
  slot: int,                      // index of the first grate slot it occupies; a size 2 piece occupies slot and slot + 1
  size: int,                      // 1 or 2 (MEATS[meat].slots)
  prog: float,                    // cook seconds accumulated
  state: 'cooking' | 'done' | 'burnt',
  putOn: clock,
  burntAt: clock | null
};

Board = {
  stacks: Stack[],                // up to C.BOARD_STACKS, oldest first
  slicing: null | { meat: MeatId, t: float, total: float }   // mirrors player.busy for drawing the board
};

Stack = { meat: MeatId, times: clock[] };   // one entry per plate, oldest first; count = times.length

Table = {
  spots: (null | Stack)[]         // length C.TABLE_SPOTS, or TABLE_SPOTS_BIG when gear.bigtable; index i is table tile i in MAP.station('table').tiles order
};

Customer = Mover & {
  id: int,                        // unique within the day, 1 based
  body: 0 | 1 | 2,                // sprite variant, arrivals % 3
  want: MeatId,
  patienceMax: float,
  patience: float,                // remaining seconds; drains only while mode is 'waiting'
  wait: float,                    // seconds since first reaching any queue spot
  queueIndex: int,                // 0 is the front of the line; -1 when not in line
  mode: 'arriving' | 'waiting' | 'leaving' | 'passing',
  mood: 'neutral' | 'unhappy' | 'happy',
  reason: null | 'served' | 'walkout' | 'past' | 'close',   // set when mode becomes 'leaving'
  pause: float,                   // remaining seconds of a stop (walk past stop, turn before leaving)
  hop: float                      // seconds left of the served hop; 0 otherwise. game.js draws py minus 2 while hop > 0 and reduced motion is off
};

Today = {
  revenue, tips, foodCost, bags, wages, spoilCost, wasteCost, wastePlates, wasteBurnt, grateCost: int,
  customers, served, walkouts, past, close, happy, ok, burnt: int,
  spoiled: { [m in MeatId]: int },   // units spoiled overnight, filled at day end
  grateLeft: { [m in MeatId]: int }, // pieces left on cookers at close
  repStart: int,
  wageNames: string[]             // ['Buddy'], ['Fire tender'], both, or []
};

Till = Today & {
  day: int,                       // the day that was played
  repEnd: int,
  repDelta: int,                  // after the daily clamp
  repCapped: boolean,             // true when the clamp changed the number
  net: int,                       // signed: revenue + tips minus wages minus DAILY_COSTS
  cashAfter: int                  // floored cash, equal to state.cash at the moment the till opened
};
```

#### 2.5.2 Timekeeping

> **Amended by the v2 delta, D8:** the early end also waits for no customer in `toSeat` or `eating`; sold out ends the day early; the hard end pays unpaid seat bonuses first.

`state.clock` advances only in `step()` while `phase === 'service'` and `paused === false`. Prep is `clock < C.GATE_OPENS`; the gate is open from `GATE_OPENS` to `LAST_CALL`; the day ends when `clock >= C.DAY_SECONDS`, or when `clock >= C.LAST_CALL` and no customer remains in the yard in mode `arriving` or `waiting` [spec 3]. Day end runs the till (section 2.7.5) and sets `phase = 'evening'`.

#### 2.5.3 Fixed step

> **v2:** at `WALK_TILES_PER_S` 6 a step is 4.8 px a tick; `game.js` draws `Math.round(px)`.

`sim.step(dt)` clamps `dt` to `C.MAX_FRAME_DT`, adds it to an internal accumulator, and runs `sim.tick()` once per whole `C.TICK_SECONDS` in the accumulator. `sim.tick()` advances the world by exactly one `TICK_SECONDS` in the six stage order of [spec 5.10]. `step` returns nothing. Movement is advanced per tick (at 5 tiles per second that is 4 virtual pixels per tick); `game.js` draws `px, py` as they are, with no interpolation of its own.

#### 2.5.4 Reach and facing

The station in reach is the active station whose footprint contains the tile directly in front of the player, `(player.x + dx, player.y + dy)` for `player.face`, and only that one [spec 4]. Reach is computed from `player.x, player.y`, which update when a tile step completes, so a player mid step is in reach of nothing new until arrival.

#### 2.5.5 Tap to walk and arrival

`walkTo(tx, ty)` sets `player.target`:

- Tapped tile is an active station tile: BFS from the player's tile to the nearest of that station's active use tiles; `target = { station, auto: true }`; on arrival the player's `face` is set to the use tile's `face` and `interact()` runs once with the auto rule of [spec 5.2] (button only actions do not run; the label still updates). If the player is already standing on one of the station's use tiles, no walk happens, facing is set and the auto action runs on the next tick.
- Tapped tile is walkable: BFS to it; `target = null`.
- Anything else (fence, lawn, queue, hedge, path, inactive station tile that is not walkable, unreachable tile): return `false`, emit `blocked`, change nothing.

`move(dir)` (keyboard) cancels `path` and `target`, sets `face = dir`, and if the player is not mid step (`next === null`) and the tile in that direction is walkable, starts a single step. Returns `true` when a step started. A bump (not walkable) sets facing only and returns `false`. Both `walkTo` and `move` return `false` and do nothing while `player.busy` is set, while `phase !== 'service'`, or while paused.

#### 2.5.6 NPC routes

> **Superseded for customers by the v2 delta, D4 and D8, and [V2.5]:** every customer walk is a BFS over the customer grid. The buddy and tender paragraphs stand with the v2 idle tiles.

Customers walk at `C.NPC_TILES_PER_S` along fixed routes, no BFS, no collision:

- Arriving: from `MAP.custSpawn` straight down column 6 to `(6, 5)`, then along row 5 to the reserved spot's x. `queueIndex` is the spot reserved at spawn; `wait` starts the first time the customer reaches their reserved spot, and a spot passed through on the way does not count.
- Shift forward: along row 5 to the new spot.
- Leaving (`served`, `walkout`, `close`): pause `LEAVE_TURN_SECONDS` facing up, then straight up their own column to row 1, along row 1 to x = 6, up through the gate to `custSpawn`, then removed from `customers`. A served customer gets `hop = 0.3` at the moment of serving and `mood = 'happy'`; a walkout leaves with `mood = 'unhappy'`; close leaves with `mood = 'neutral'`.
- Passing: down column 6 to `MAP.passStop`, pause `C.WALK_PAST_PAUSE`, then back up and out, removed at `custSpawn`. `queueIndex` is `-1` throughout.

The buddy loops idle at `MAP.buddyIdle` facing left, BFS to `(6, 7)` facing up, back [spec 5.8]. The tender idles at `MAP.tenderIdle` facing right, grabs from the pile (adjacent, no walk), BFS to the nearest active use tile of the cooker needing fire, adds, returns [spec 5.9]. Their pixel positions follow the same `Mover` fields as the player.

### 2.6 Sim methods

> **Amended by the v2 delta, D7:** `buy` and `sell` take decor ids; new `charm`, `seatBonus`, `seatCount`, `repMax`, `custWalkable`. The `rng()` row no longer invites cosmetic use (D8).

All methods are plain functions on the `sim` object (not prototype methods; `const { walkTo } = sim` must work). Results are fresh objects each call.

| Method | Returns | Semantics |
|---|---|---|
| `step(dt: float)` | `undefined` | Section 2.5.3. No effect outside service or while paused, but the call is always legal. |
| `tick()` | `undefined` | One fixed step of `C.TICK_SECONDS`. Same guards as `step`. |
| `walkTo(tx: int, ty: int)` | `boolean` | Section 2.5.5. `true` when a walk or an in place auto action was scheduled. |
| `move(dir: Dir)` | `boolean` | Section 2.5.5. |
| `interact()` | `{ ok: boolean, verb: string, message: string }` | Performs the context action at the station in reach for the current hands [spec 5.2], regardless of auto or button only, except that it does nothing with `ok: false` when `phase !== 'service'`, paused, or `player.busy`. `verb` is the label that was in effect when the call began. `message` is `''` on success, or the label of the no-op row (for example `Hands full`). Slice starts set `player.busy`; the plates land on the board when `busy.t` reaches `total`. |
| `verbAt()` | `{ label: string, enabled: boolean, auto: boolean, station: StationId \| null }` | The action button state for the current position and hands. Never `null`: when nothing is in reach, `{ label: 'Walk', enabled: false, auto: false, station: null }`. `enabled` is false for every no-op row (Hands full, Grate is full, and so on) and while slicing (label `Slicing`, a label decided here since the spec has the board busy). Outside service: `{ label: 'Walk', enabled: false, auto: false, station: null }`. |
| `holding()` | `string` | The status line's base text: `Hands empty`, `Holding: charcoal`, `Holding: raw Sausage`, `Holding: cooked Pork butt`, `Holding: burnt Pork ribs`, `Holding: 1 plate of Sausage`, `Holding: 2 plates of Chicken thighs`. Meat labels from `MEATS[m].label`. |
| `walkable(x: int, y: int)` | `boolean` | Section 2.3.3 for the current gear. |
| `reach()` | `StationId \| null` | The station in reach, section 2.5.4. |
| `selectMeat(id: MeatId)` | `boolean` | Sets `state.selected` when `stock[id] > 0`; otherwise `false` and no change. Legal in any phase. |
| `cycleMeat(delta: 1 \| -1)` | `MeatId` | Moves the selection to the next or previous meat with stock, wrapping; returns the new selection (unchanged when no other meat has stock). |
| `buy(id: string, qty: int)` | `{ ok: boolean, message: string }` | Morning only (`phase === 'morning'`, `broke === false`). Meat or `'charcoal'`: adds `qty` (may be negative) to the cart line, clamped to 0 and to `C.STEPPER_MAX`, and so that `cartTotal() <= cash`; `ok` is true when the line changed. Brisket needs `gear.drum`. Gear: `qty` ignored; refuses with `ok: false` and `message` when already owned (`Owned`), prerequisite unmet (the `needsText`), or `cash - cartTotal() < price` (`Not enough cash`); on success `cash -= price`, `gear[id] = true`, the yard reconfigures (a player standing on a newly active tile is moved to the nearest walkable tile; `table.spots` grows; `drum` forced on `kettle2`), emits `purchase` then `save_wanted { reason: 'gear' }`, `message = 'Bought ' + label + '.'`. `'driveway'` always refuses with `message: 'Not built in this prototype.'`. Hires are not bought here; see `hire`. |
| `hire(id: HireId)` | `{ ok: boolean, hired: boolean, message: string }` | Morning only. Toggles `hires[id]`. Refuses when the prerequisite is unmet (`buddy` needs `day >= 2`, `tender` needs `gear.drum`). No cash moves; wages are charged at the till for staff who worked [spec 8.4]. Emits `hire { id, hired }` and `save_wanted { reason: 'hire' }`. `message` is `Hired the buddy.`, `Let the buddy go.`, `Hired the fire tender.` or `Let the fire tender go.` |
| `sell(id: GearId)` | `{ ok: boolean, message: string, price: int }` | Broke card only (`phase === 'morning' && broke`). `price = floor(CATALOG price * C.SELL_BACK)`; `cash += price`; `gear[id] = false`; selling `kettle2` also sells `drum` if owned (two sales, two events, the message names both); selling `drum` also sells back `stock.brisket` at `floor(unit / 2)` each and sets it to 0, and forces `hires.tender = false`. Emits `sell { id, label, price }` and `save_wanted { reason: 'sell' }`, reruns the Broke test and updates `state.broke`. |
| `cartTotal()` | `int` | Sum of cart lines at catalog prices. |
| `canOpen()` | `{ ok: boolean, reason: string }` | `reason` is `''`, `Buy at least one bag of charcoal.` (charcoal plus cart charcoal is 0), or `Buy at least one unit of meat.` (stock plus cart meat is 0); charcoal first when both [spec 7]. Also false with `reason: ''` outside the morning or while broke. |
| `openGate()` | `{ ok: boolean, message: string }` | Morning only and `canOpen().ok`. Commits the cart (`cash -= cartTotal()`, stock and charcoal increase, cart zeroed), sets `clock = 0`, `phase = 'service'`, resets `today`, creates `buddy` and `tender` per `hires`, spawns no customer yet (`spawnAt = C.GATE_OPENS`), positions the player at `MAP.spawn`, emits `save_wanted { reason: 'open' }` then `yard_open`. |
| `continueFromTill()` | `undefined` | Evening only. Starts the next morning: `phase = 'morning'`, rolls rain (day `>= RAIN_FROM_DAY`, chance `RAIN_CHANCE`, emits `rain { raining }` on every roll from that day on), runs the Broke test and sets `broke` (emits `broke` when true), resets `cart`, sets `selected` to the quickest meat in stock (or `sausage`), sets `comingNext` (and emits `coming_next` the first time, setting `drivewayShown`). The state's `day`, `cash`, `stock`, `charcoal` and `stats` were already advanced at day end, so this method moves no money. |
| `continueFromBroke()` | `boolean` | Morning, broke, and the Broke test now false: sets `broke = false` and returns `true`; otherwise `false`. |
| `dismissComingNext()` | `undefined` | Sets `comingNext = false` for this morning. |
| `goal()` | `null \| { id: string, label: string, price: int }` | First item in the goal order not owned or hired; `null` when everything is owned. |
| `setPaused(on: boolean)` | `undefined` | Sets `state.paused`. Legal in any phase; `step` and `tick` return at once while paused. |
| `reset()` | `undefined` | Replaces the state with a new game (day 1, starting kit) using the same rng, then emits `save_clear`. |
| `drainEvents()` | `Event[]` | Returns the queued events in order and empties the queue. |
| `serialize()` | `Save` | Section 2.8. A fresh plain object every call, always valid for `validateSave`. |
| `rng()` | `float` | The seeded generator. `game.js` may use it for cosmetic randomness (smoke drift) so the whole page stays deterministic per seed; it must not use `Math.random`. |

Properties: `sim.state` (section 2.5.1), `sim.seed` (int).

### 2.7 Rules the interface depends on

Everything here is in the design spec; this list pins the parts that decide which fields change so three builders agree.

#### 2.7.1 Money and stock

- Shop: `buy` on meat and fuel changes only `cart`. `openGate` moves cash. Gear moves cash at once.
- `today.foodCost` adds `MEATS[m].unit` when a piece is put on a grate. `today.bags` increments when a bag is taken from the pile by the player or the tender (and `charcoal` decrements then).
- Serve: `cash += price + tip`, `today.revenue += price`, `today.tips += tip`, `today.served += 1`, `stats.served += 1`, `rep` change is accumulated in `today` (`happy` or `ok`) and applied with the daily clamp at the till [spec 10]; `state.rep` does not move during the day.
- Walk out: `today.walkouts += 1`, `stats.walkouts += 1`. Walk past: `today.past += 1`, `stats.past += 1`. Left at close: `today.close += 1`.
- Burnt: `today.burnt += 1`, `stats.burnt += 1` when the piece enters `burnt`.

#### 2.7.2 Hands and table

Plate counts in hand: 1, or 2 of the same meat with `gear.tray`. Board pickup takes `min(capacity, stack.times.length)` plates following the stack rule [spec 5.2 and 5.3]. Set down follows the partial rule [spec 5.2]. Serving from the table removes the oldest plate of that meat (`times[0]`) and uses its age for the hot plate tip.

#### 2.7.3 Cooking

`prog += fireMult(fire) * TICK_SECONDS` per tick. Transitions emit `piece_done` and `piece_burnt`. `PitSim.fireBand(fire)` returns `'out' | 'low' | 'good' | 'hot'`; `PitSim.fireMult(fire)` returns 0, `fire / 50`, 1.0 or `C.HOT_MULT`. Both are pure and exported for `game.js` to color the gauge.

#### 2.7.4 Customers

> **Amended by the v2 delta, D8:** one extra draw, `eatMax`, at serve time when a seat is found; seat pick, to go and the rep counters per D8.

Spawn, order, patience, tip, rep: [spec 6]. The order roll, patience roll, body variant and jitter all draw from `sim.rng()` in this order per spawn: interval jitter, patience, order branch, order weight. Walk past is decided at spawn against `queueSpots = gear.bigtable ? QUEUE_SPOTS_BIG : QUEUE_SPOTS` minus customers with `queueIndex >= 0`.

#### 2.7.5 Day end

> **Amended by the v2 delta, D8:** seat bonuses paid with `atClose: true` after the close out and before the till; rep clamp upper bound `repMax()`; `state.seats` cleared.

In this order, once, when the end condition of section 2.5.2 holds: close out customers still in line (`reason: 'close'`, `today.close`), compute `grateLeft` and `grateCost` from pieces still on cookers (unit cost each, burnt pieces included here and not in waste), compute waste from board and table plates (`unit / plates` per plate, rounded to the nearest integer per plate, summed) plus burnt pieces already trashed during the day (unit cost each; `wasteBurnt` counts those), compute wages from `buddy`/`tender` presence, apply rep with the clamp, then cash: `cash = max(C.CASH_FLOOR, cash - wages - C.DAILY_COSTS)` (revenue and tips were added at each serve). Then spoilage: without `gear.cooler`, every raw unit is lost at unit cost into `spoilCost` and `spoiled`, stock zeroed; with the cooler, stock carries. Then `day += 1`, `stats.days += 1`, `yesterday = { served, walkouts, past }`, `till` is built from `today`, `phase = 'evening'`, emit `day_over` and `save_wanted { reason: 'till' }`. Pieces on the grate are not trashed events; they are simply gone when the next day opens.

### 2.8 Save format and `PitSim.validateSave(obj)`

> **Superseded for the format by the v2 delta, D9.** The field rules below still apply to every v1 key.

The save is the v1 object of [spec 12], exactly these keys and no others:

```json
{ "v": 1, "day": 5, "cash": 187, "rep": 80,
  "stock": { "sausage": 0, "chicken": 2, "ribs": 0, "butt": 1, "brisket": 0 },
  "charcoal": 3,
  "gear": { "kettle2": true, "cooler": false, "bigtable": false, "tray": false, "canopy": false, "drum": false },
  "hires": { "buddy": false, "tender": false },
  "stats": { "days": 4, "served": 45, "walkouts": 1, "past": 3, "burnt": 0 },
  "drivewayShown": false }
```

`PitSim.validateSave(obj)` returns a complete clean object of that shape, or `null` when `obj` is not a plain object or `obj.v !== 1`. Rules per field are the table in [spec 12]: integers are coerced with `Math.trunc` after `Number()`, non finite becomes the default, then clamped; booleans are `=== true`; unknown keys at any level are dropped; `gear.drum` is forced false when `gear.kettle2` is false; `hires.tender` is forced false when `gear.drum` is false; `stock.brisket` is forced 0 when `gear.drum` is false (decided here: a brisket without a drum can never be cooked and would wedge rule 4 of the order). The function never throws on any input, including `undefined`, strings, arrays and cyclic objects (it reads only the named keys).

`sim.serialize()` returns the same shape from `state`. During service the fields reflect the current morning's committed values plus whatever has changed (cash from sales, stock drawn down); `game.js` never saves during service, so this is only informational.

### 2.9 Events

> **Superseded by the v2 delta, D10**, which carries every v1 type plus the new and changed ones. Kept for history.

`drainEvents()` returns `Event[]`. Every event is `{ type, ...payload }` with exactly these types and payload fields. `game.js` maps them to aria-live sentences in section 4.7.

| type | payload | when |
|---|---|---|
| `yard_open` | | `openGate` succeeded |
| `gate_soon` | | clock crossed `GATE_OPENS - 10` |
| `gate_open` | | clock crossed `GATE_OPENS` |
| `customer_arrived` | `id, meat` | a customer spawned who will join the line (not a walk past) |
| `walk_past` | `id` | a customer spawned into a full line |
| `piece_done` | `cooker: CookerId, meat` | a piece entered `done` |
| `piece_burnt` | `cooker, meat` | a piece entered `burnt` |
| `served` | `id, meat, price, tip, quick: boolean, x, y` | a customer was served; `x, y` is the top left pixel of the table tile the plate came from, for the coin pop |
| `walk_out` | `id` | patience reached 0 |
| `left_at_close` | `id` | still in line at `DAY_SECONDS` |
| `fire_low` | `cooker` | fire crossed below `FIRE_LOW_WARN` |
| `fire_out` | `cooker` | fire reached 0 |
| `last_call` | | clock crossed `LAST_CALL` |
| `day_over` | | the till is built; `state.till` is set, `phase` is `'evening'` |
| `slice_done` | `meat, plates` | a slice finished and the plates joined the board |
| `set_down` | `meat, n` | `n` plates went on the table |
| `trash` | `meat, kind: 'raw' \| 'cooked' \| 'burnt' \| 'plates'` | something went in the trash |
| `purchase` | `id, label, price` | gear bought |
| `hire` | `id, label, hired: boolean` | hire toggled; `label` is `'the buddy'` or `'the fire tender'` |
| `sell` | `id, label, price` | Broke card sale |
| `save_wanted` | `reason: 'till' \| 'gear' \| 'hire' \| 'open' \| 'sell'` | `game.js` writes `serialize()` to `SAVE_KEY` |
| `save_clear` | | `game.js` removes `SAVE_KEY` |
| `blocked` | | `walkTo` could not reach the tile |
| `rain` | `raining: boolean` | the morning weather roll, days `>= RAIN_FROM_DAY` |
| `coming_next` | | the Coming next card is shown for the first time |
| `broke` | | a morning opened on the Broke card |

Events are emitted inside the method or tick that caused them; `drainEvents()` after each `step` (and after each method call from input) sees them in order.

### 2.10 `PitSim.STRINGS`

> **Amended by the v2 delta, D5:** `decorLabel` is added. Nothing else changes.

A frozen object holding the strings the sim produces that `game.js` also needs to display without a sim call, so both files spell them the same way. Only these keys:

```js
PitSim.STRINGS = Object.freeze({
  cooker: { kettle1: 'kettle 1', kettle2: 'kettle 2', drum: 'the drum' },        // spoken names, aria-live
  cookerLabel: { kettle1: 'Kettle 1', kettle2: 'Kettle 2', drum: 'Drum smoker' },
  hire: { buddy: 'the buddy', tender: 'the fire tender' },
  hireLabel: { buddy: 'Buddy', tender: 'Fire tender' },
  gearLabel: { kettle2: 'Second kettle', cooler: 'Cooler', bigtable: 'Bigger table', tray: 'Serving tray', canopy: 'Canopy', drum: 'Drum smoker', driveway: 'Driveway pop-up' },
  walk: 'Walk', handsFull: 'Hands full', nothing: 'Nothing to do here', slicing: 'Slicing',
  cantGetThere: "Can't get there", handsEmpty: 'Hands empty',
  gateOpensIn: 'Gate opens in ', lastCall: 'Last call'
});
```

Every other string a player reads is owned by `game.js` and written in section 4.9.

---

## 3. `sprites.js` surface

### 3.1 `PitSim.art`

> **Amended by the v2 delta, D11:** 32 palette entries, the v2 `COLOR` keys, the 111 sprites, `drawScaled` and `textTinted`.

```ts
PitSim.art = {
  TILE: 16,
  PALETTE: string[],                   // 23 entries; PALETTE[0] is '' and means transparent; the rest are '#rrggbb'
  COLOR: { [key: string]: string },    // the same colors by the spec's letter key, for procedural drawing in game.js
  SPRITES: { [name: string]: { w: int, h: int, frames: string[][] } },
  build(): void,                        // renders every frame once to offscreen canvases; idempotent; throws Error on a bad grid
  built: boolean,
  has(name: string): boolean,
  frames(name: string): int,            // frame count, 0 when unknown
  draw(ctx, name, x, y, frame = 0, flip = false): void,
  canvasFor(name: string, frame = 0, scale = 1): HTMLCanvasElement,   // a fresh canvas holding one frame, scaled, smoothing off; game.js uses it for DOM chips and shop icons
  text(ctx, str: string, x: int, y: int): void,                        // draws str with the `font` sprite, uppercase, 1 px between glyphs
  textWidth(str: string): int                                          // glyph count times 5 minus 1, spaces count as a glyph
};
```

`draw` paints frame `frame` of sprite `name` with its top left at `(x, y)` in the context's current units (the caller has scaled the context or draws at 1x into the offscreen canvas). `frame` is taken modulo the frame count, so an animation counter can be passed as is. `flip = true` mirrors the frame horizontally in its own box (a 16 wide sprite drawn at x still covers x to x + 15). Drawing an unknown name throws an `Error` naming it. `draw` before `build()` calls `build()` first.

`build()` checks every grid: each frame has exactly `h` rows, every row has exactly `w` characters, every character is in the palette index set (section 3.2). On a failure it throws `Error('sprite <name> frame <i> row <j>: <reason>')` and leaves `built` false. The page then fails loudly in the console [spec 13], which is intended.

Nothing in `sprites.js` touches the DOM except `document.createElement('canvas')` inside `build()` and `canvasFor()`. It uses no timers and no `Math.random`.

### 3.2 Palette and index characters

> **Superseded by the v2 delta, D11, and [V2.10].** Kept for history.

`PALETTE` and the character that names each index in a grid string. The first nine colors are the site's canon tones [spec 14.1].

| char | index | key | hex | use |
|---|---|---|---|---|
| `0` | 0 | | transparent | |
| `1` | 1 | K | #1b1714 | near black: outlines, burnt meat, trash |
| `2` | 2 | U | #2a2015 | umber: fence boards, drum body |
| `3` | 3 | C | #E6D8B8 | cream: plates, canopy canvas, skin |
| `4` | 4 | O | #D06129 | orange: hot fire, shirts, coin text |
| `5` | 5 | Y | #F3CF6D | gold: tips, done ring, caps |
| `6` | 6 | M | #bfb39a | muted: dashed outlines, gauge out |
| `7` | 7 | H | #3a332c | hairline: table shadow |
| `8` | 8 | I | #33211A | ink: pitmaster hat, kettle body |
| `9` | 9 | S | #444947 | charcoal grey: kettle lid, trash can |
| `a` | 10 | g | #4a6741 | grass dark |
| `b` | 11 | G | #5f7f4c | grass light |
| `c` | 12 | h | #2f4a2d | hedge |
| `d` | 13 | d | #6b4a2a | dirt path |
| `e` | 14 | b | #8a6a3f | board, table top, crate, skin dark |
| `f` | 15 | p | #e8a0a0 | raw meat pink |
| `g` | 16 | r | #b5583a | cooking meat |
| `h` | 17 | n | #7a3f22 | done meat brown |
| `i` | 18 | f | #ff9a2e | fire bright |
| `j` | 19 | y | #ffd85c | fire yellow |
| `k` | 20 | s | #8d8a86 | smoke light |
| `l` | 21 | t | #5a5753 | smoke dark |
| `m` | 22 | w | #a9c4d9 | sky, rain, cooler lid |

`COLOR` maps the key letters to the hex strings: `COLOR.K`, `COLOR.U`, `COLOR.C`, `COLOR.O`, `COLOR.Y`, `COLOR.M`, `COLOR.H`, `COLOR.I`, `COLOR.S`, `COLOR.g`, `COLOR.G`, `COLOR.h`, `COLOR.d`, `COLOR.b`, `COLOR.p`, `COLOR.r`, `COLOR.n`, `COLOR.f`, `COLOR.y`, `COLOR.s`, `COLOR.t`, `COLOR.w`. Only characters `0` to `9` and `a` to `m` are legal in a grid; anything else fails `build()`.

### 3.3 Grid format

> **v2:** the legend is base 32, `0` to `v` (D11); sprites may be wider and taller than 16.

`SPRITES[name] = { w, h, frames }` where `frames` is an array and each frame is an array of `h` strings of length `w`. Example of a 4 by 3, two frame sprite:

```js
coin: { w: 4, h: 3, frames: [
  ['0550', '5335', '0550'],
  ['0500', '0530', '0500']
] }
```

### 3.4 Required sprite list

> **Superseded by the v2 delta, D11, and [V2.11].** Kept for history.

The art builder implements exactly these names, sizes and frame counts: nothing added, nothing missing. The harness checks every name with `has()` and every frame count with `frames()`. Frame semantics are fixed so `game.js` can index them blind.

People (all 16 by 16). Frame 0 is standing, frames 1 and 2 are the walk cycle. Side sprites face **left**; `game.js` passes `flip = true` for right.

| name | frames | notes |
|---|---|---|
| `player_down` | 3 | stand, walk a, walk b |
| `player_up` | 3 | |
| `player_side` | 3 | faces left |
| `player_slice` | 2 | arm up, arm down; drawn in place of the body while slicing, any facing |
| `buddy_down` | 3 | pitmaster shape, cap `5`, shirt `m` |
| `buddy_up` | 3 | |
| `buddy_side` | 3 | |
| `tender_down` | 3 | pitmaster shape, hat `9`, shirt `b` |
| `tender_up` | 3 | |
| `tender_side` | 3 | |
| `cust0_down` | 4 | stand, walk a, walk b, stand unhappy (frame 3 carries the unhappy face) |
| `cust0_up` | 2 | walk a, walk b (up is only ever walking) |
| `cust0_side` | 2 | walk a, walk b, faces left |
| `cust1_down` | 4 | second body: different shirt and cap colors from the people set in [spec 14.1] |
| `cust1_up` | 2 | |
| `cust1_side` | 2 | |
| `cust2_down` | 4 | third body |
| `cust2_up` | 2 | |
| `cust2_side` | 2 | |
| `shadow` | 1 | 12 by 4 ellipse in `7`; drawn under every person at `(px + 2, py + 13)` before the body |

Hand overlays (all 8 by 8, 1 frame each). `game.js` draws the overlay at `(px + 4, py + 8)` after the body when facing down, left or right, and at `(px + 4, py + 1)` before the body when facing up.

| name | notes |
|---|---|
| `hand_charcoal` | a paper bag, `6` with a `1` fold |
| `hand_raw_sausage` `hand_raw_chicken` `hand_raw_ribs` `hand_raw_butt` `hand_raw_brisket` | raw piece in `f`, outline `1`, a shape hint per meat |
| `hand_cooked_sausage` `hand_cooked_chicken` `hand_cooked_ribs` `hand_cooked_butt` `hand_cooked_brisket` | same shapes in `h` |
| `hand_burnt` | one black lump `1` with a `l` highlight, any meat |
| `hand_plate_sausage` `hand_plate_chicken` `hand_plate_ribs` `hand_plate_butt` `hand_plate_brisket` | one plate `3` with the meat on it |
| `hand_tray_sausage` `hand_tray_chicken` `hand_tray_ribs` `hand_tray_butt` `hand_tray_brisket` | two plates on a tray `e` |
| `hand_tray` | the empty tray; drawn when `gear.tray` is owned and the hands are empty |

Icons and plates.

| name | size | frames | notes |
|---|---|---|---|
| `icon_sausage` `icon_chicken` `icon_ribs` `icon_butt` `icon_brisket` | 8 by 8 | 1 | used in bubbles, chips and shop rows; readable at 1x |
| `plate_sausage` `plate_chicken` `plate_ribs` `plate_butt` `plate_brisket` | 8 by 6 | 1 | a plate with the meat; stacks draw each plate 1 px higher than the one below |
| `piece_sausage` `piece_chicken` `piece_ribs` `piece_butt` `piece_brisket` | 10 by 10 | 4 | frame 0 raw (`f`), 1 cooking (`g`), 2 done (`h` with a 1 px `3` ring and a check), 3 burnt (`1` with a `l` highlight). `game.js` picks frame 0 while `prog < cook / 2`, frame 1 until done, then 2, then 3 |
| `mark_x` | 8 by 8 | 1 | an orange `4` X; drawn in the bubble's icon slot for 0.6 s when a customer walks out |

Stations.

| name | size | frames | notes |
|---|---|---|---|
| `kettle` | 16 by 16 | 4 | cold (lid grey, no glow), low (dim `4` glow), good (`i` glow), hot (`j` and `i` glow). `game.js` indexes by `fireBand`: out 0, low 1, good 2, hot 3 |
| `drum` | 16 by 32 | 4 | same four bands; drawn with its top left at tile (10,10) |
| `outline` | 16 by 16 | 3 | dashed `6` outline: single tile, top half (open bottom edge), bottom half (open top edge). Kettle 2 and the table ends use 0; the drum uses 1 at (10,10) and 2 at (10,11) |
| `cooler` | 16 by 16 | 3 | crate (`e` boards), cooler shut (`m` lid), cooler open. `game.js` draws frame 0 without `gear.cooler`, frame 1 with it, frame 2 with it while the player is in reach of the cooler |
| `board` | 16 by 16 | 2 | empty, with a piece on it (drawn while `board.slicing` is set) |
| `table_mid` | 16 by 16 | 1 | middle table tile |
| `table_end` | 16 by 16 | 1 | left end; `flip` for the right end. With the small table the three tiles are end, mid, end; with the big table, end, mid, mid, mid, end |
| `canopy` | 80 by 24 | 1 | cream canvas with the two back poles; drawn at pixel (64, 74) before any person or station sprite |
| `canopy_pole` | 4 by 20 | 1 | a front pole; drawn at (65, 98) and (139, 98) after every person and station, before bubbles and bars |
| `pile` | 16 by 16 | 4 | full (bags over 6), half (3 to 6), low (1 to 2), bare (0); v2.1 review round 2: full at 5 or more, half 3 or 4 (K9) |
| `trash` | 16 by 16 | 1 | |
| `gate` | 16 by 16 | 2 | shut, open |
| `fence_h` | 16 by 16 | 1 | boards running left to right, rows 0 and 14 |
| `fence_v` | 16 by 16 | 1 | boards running up and down, x 0 and 12, and all four corners |
| `hedge` | 16 by 16 | 1 | |
| `grass` | 16 by 16 | 2 | variant a, variant b |
| `path` | 16 by 16 | 1 | dirt |

Effects and text.

| name | size | frames | notes |
|---|---|---|---|
| `bubble` | 16 by 12 | 1 | cream speech bubble with a tail at the bottom center; icon slot at offset (4, 2). Drawn at `(px, py - 13)` of the customer |
| `smoke` | 8 by 8 | 3 | puff small, medium, large; cycles at 8 fps rising 1 px per frame; not drawn under reduced motion |
| `fire` | 8 by 8 | 3 | flame frames; drawn at `(station px + 4, station py - 4)` on a cooker in the good or hot band, cycling at 6 fps; frame 0 only under reduced motion |
| `coin` | 8 by 8 | 2 | gold coin front, coin edge; the pop alternates at 8 fps |
| `font` | 4 by 6 | 38 | frames 0 to 9 are the digits, 10 to 35 are A to Z, 36 is `+`, 37 is `:`; cream glyphs on transparent |

Total: 81 named sprites, 188 frames (people 20 names 54 frames, hands 23 and 23, icons and pieces 16 and 31, stations 17 and 33, effects and text 5 and 47). `art.text` maps a string to frames: digit `d` to `d`, letter to `10 + (code - 65)` after `toUpperCase()`, `+` to 36, `:` to 37, space to a 4 px gap, any other character skipped.

Procedural elements drawn by `game.js` with `COLOR`, not sprites: patience bar (14 by 2 at `(px + 1, py - 1)`, `COLOR.G` then `COLOR.O` in the last 20 percent), fire gauge (4 px wide on the cooker's right edge, ticks at 50 and 85), cooking arc around each grate slot, slice progress bar above the board, rain band and streaks, dashed outline is a sprite (above).

### 3.5 Anchors the renderer relies on

> **Superseded by [V2.1], [V2.3] and [V2.11]:** people are 16x24 drawn at (px, py - 8); slot, spot and stack anchors are in [V2.3].

- Every 16 by 16 person sprite stands on its bottom row; feet at `py + 15`.
- Station sprites fill their tile; the drum fills two tiles tall.
- Plate stacks on the table draw at `(tile px + 4, tile py + 3)`, each further plate 1 px higher, up to 6. On the board, stacks draw at `(px + 1, py + 3)`, `(px + 8, py + 3)`, `(px + 1, py + 9)`, `(px + 8, py + 9)` for stack index 0 to 3, each up to 8 plates.
- Grate pieces draw at `station px + slotPx[i].x, station py + slotPx[i].y` (section 2.3.2).

---

## 4. `game.js` responsibilities

### 4.1 Boot

> **Amended by the v2 delta, D9 and D14:** step 2 also notes `parsed.v === 1` for the update notice; `PitSim.game` gains `dog`, `fxLog` and `captureFrame`.

`game.js` runs on `DOMContentLoaded` (it is deferred, so it may also run at once when `document.readyState !== 'loading'`). In order:

1. `PitSim.art.build()`. If it throws, write the message to `#status`, log it, and stop.
2. Read the save: `localStorage.getItem(PitSim.SAVE_KEY)` in try/catch; `JSON.parse` in try/catch; `PitSim.validateSave(parsed)`; any failure yields `null`. A `localStorage` access that throws sets `saveOff = true` and queues the status line `Saving is off in this browser.` once for 4 s.
3. `sim = PitSim.createSim(validated, seed)` where `seed` is the integer in the `?seed=` query parameter when present and finite, else undefined. (The harness passes a seed for repeatable runs.)
4. Build the DOM inside the shell's containers (section 4.4), set up the canvas (section 4.2), attach input (section 4.5), show the clipboard or the Broke card, pump the events once, start the `requestAnimationFrame` loop.
5. Expose `PitSim.game` (section 4.10).

Frame loop: `dt = Math.min(PitSim.C.MAX_FRAME_DT, (now - last) / 1000)`; `sim.step(dt)`; pump events (`drainEvents` to aria-live, saves, panels, pops); render; schedule the next frame. On `visibilitychange` to hidden during service: `sim.setPaused(true)` and open the pause panel; the clock is reset on the next visible frame so no big `dt` arrives.

### 4.2 Canvas

> **Superseded by the v2 delta, D13, and [V2.13].** Kept for history.

An offscreen `HTMLCanvasElement` of 208 by 240 (`MAP.W * 16`, `MAP.H * 16`) is drawn every frame at 1x and blitted to `#cv`. Scale, recomputed on `resize` and `orientationchange`:

```
dpr    = window.devicePixelRatio || 1
availW = Math.min(wrap.clientWidth, 480)                 // #wrap is width 100% inside the 16 px gutters, so this is viewport width minus 32 on a phone
availH = window.innerHeight - 44 - (24 + 48 + 48) - 16   // header, status, act, chips, margin
scale  = Math.max(1, Math.floor(Math.min(availW * dpr / 208, availH * dpr / 240)))
cv.width = 208 * scale; cv.height = 240 * scale
cv.style.width = (208 * scale / dpr) + 'px'; cv.style.height = (240 * scale / dpr) + 'px'
```

`imageSmoothingEnabled = false` on both contexts, set again after any resize (resizing a canvas resets its context state).

### 4.3 Render order

> **Superseded by the v2 delta, D12, and [V2.12].** Kept for history.

Each frame, into the offscreen context, in this order:

1. Ground: every tile from `MAP.tiles` (`grass` by variant for GRASS, LAWN and QUEUE; `path`; `hedge`; `fence_h` on rows 0 and 14, `fence_v` on columns 0 and 12 including corners; `gate` shut or open by `clock` between `GATE_OPENS` and `LAST_CALL` during service, shut otherwise).
2. Canopy pass one: `canopy` at (64, 74) when `gear.canopy`.
3. Dashed outlines on inactive station tiles.
4. Stations, top row first: table tiles with their plate stacks, board with its stacks or slicing piece, cooler, kettles, drum, pile, trash. Grate pieces draw over their cooker. Fire gauges and cooking arcs draw with the cooker.
5. People in y order (smaller `py` first), each as shadow, up facing hand overlay, body, other hand overlay: customers, player, buddy, tender together in one sort.
6. Canopy pass two: the two `canopy_pole` sprites.
7. Smoke and fire sprites (smoke over burnt pieces and over good or hot cookers, skipped under reduced motion).
8. Speech bubbles with icons or `mark_x`, patience bars.
9. Slice progress bar above the board, floating coin pops with `font` text.
10. Rain band and streaks whenever `state.rain` during service; the canopy changes the arrival rate, not the picture.
11. Canvas text at the top left: the clock as whole seconds remaining (`DAY_SECONDS - clock`), `GATE OPENS IN {n}` during prep, `LAST CALL` for 3 s after last call, all with `art.text`, uppercase duplicates of the DOM status line [spec 13 and 18].
12. Screen shake: 120 ms of a 1 px offset of the whole blit after `piece_burnt`, skipped under reduced motion.

Then one `drawImage` of the offscreen canvas onto `#cv` at the integer scale.

### 4.4 DOM: ids and ownership

> **Amended by the v2 delta, D14:** new `#seats` in `#clip-top`, a Decor block with `buy-{decorId}` in `#shop`, `sell-{decorId}` on the Broke card, a Seat tips row on the till. Game deviation 6 ids (`#howto-btn`, `#howto-close`, `#crowd`) stay.

The shell (`index.html`, section 6) carries every container below as an empty element. `game.js` fills them with `createElement` and `textContent`; it never uses `innerHTML`. Ids are the contract between the shell, `game.js` and the harness.

Shell containers (exist on load):

| id | element | purpose |
|---|---|---|
| `root` | `main` | the page column; `data-phase` attribute mirrors `state.phase` (`morning`, `service`, `evening`) and `data-paused` is `'1'` while paused |
| `hdr` | `header` | 44 px header |
| `title` | `h1` | `YOUR PIT` (static text in the shell) |
| `hud-day` `hud-cash` `hud-rep` | `span` | `Day {n}`, `Cash {n}`, the star string followed by the number, `aria-label` `Word of mouth {n}` |
| `stage` | `div` | canvas column |
| `wrap` | `div` | canvas wrapper, near black letterbox, centers `#cv` |
| `cv` | `canvas` | the visible canvas, `tabindex="0"`, `aria-label="The yard"`, `role="img"` |
| `status` | `p` | the 24 px status line, `aria-hidden="true"` (the live region carries what matters) |
| `act` | `button` | the context action button; `textContent` is `verbAt().label`, `disabled` mirrors `!enabled` |
| `chips` | `div` | `role="group"` `aria-label="Meat"`; game.js appends five buttons |
| `panels` | `div` | panel host; `hidden` when no panel is open; holds the scrim |
| `clipboard` | `section` | `role="dialog" aria-modal="true" aria-labelledby="clipboard-h"`, hidden until opened |
| `clipboard-h` | `h2` | heading; game.js sets `Morning` |
| `clip-top` | `div` | header lines: day and cash, weather, goal or Coming next card, yesterday, hint, in the cooler |
| `shop` | `div` | meat, charcoal, gear rows |
| `hire` | `div` | hire rows and the Daily costs row |
| `clip-foot` | `div` | cart total line, Open the yard, reason line, New game |
| `till` | `section` | dialog, `aria-labelledby="till-h"` |
| `till-h` | `h2` | `Day {n} till` |
| `till-body` | `div` | the lines and buttons |
| `pause` | `section` | dialog, `aria-labelledby="pause-h"` |
| `pause-h` | `h2` | `Paused` |
| `pause-body` | `div` | Keep playing, New game |
| `howto` | `section` | `aria-labelledby="howto-h"`, not a dialog; the Controls list; shown with the pause panel and in the desktop side column during service |
| `howto-h` | `h2` | `Controls` |
| `howto-body` | `div` | a `dl` of the key map [spec 15] |
| `newgame` | `section` | dialog, `aria-labelledby="newgame-h"`; the Start over confirm |
| `newgame-h` | `h2` | `Start over? This wipes the save.` |
| `newgame-body` | `div` | Start over, Keep playing |
| `broke` | `section` | dialog, `aria-labelledby="broke-h"` |
| `broke-h` | `h2` | `Broke` |
| `broke-body` | `div` | the two lines, sell buttons, Keep going, Start over |
| `foot` | `p` | footer line (static text in the shell) |
| `live` | `div` | `aria-live="polite"`, visually hidden |

Controls `game.js` creates (ids fixed so the harness can click them):

| id | where | label |
|---|---|---|
| `chip-sausage` `chip-chicken` `chip-ribs` `chip-butt` `chip-brisket` | `#chips` | icon canvas plus the stock count; `aria-label` `{label}, {n} in stock`; `aria-pressed`; `disabled` at zero stock |
| `dec-{id}` `inc-{id}` | shop meat and charcoal rows | stepper buttons, `aria-label` `Fewer {label}` and `More {label}`; the count between them has id `qty-{id}` |
| `buy-{id}` | shop gear rows | `Buy`, or text `Owned` in a span with the same id when owned |
| `hire-{id}` | hire rows | `Hire` or `Let go`, `aria-pressed` |
| `cart` | `#clip-foot` | the `Total {n}. Cash after {n}.` line (a `p`) |
| `open` | `#clip-foot` | `Open the yard`, primary |
| `open-why` | `#clip-foot` | the muted reason line (`p`), empty when enabled |
| `clip-new` | `#clip-foot` | `New game` |
| `goal` | `#clip-top` | the goal line `p`, or the Coming next card (`div` with the same id) |
| `goal-keep` | inside the Coming next card | `Keep running the backyard` |
| `next` | `#till-body` | `Next day`, primary |
| `till-new` | `#till-body` | `New game` |
| `resume` | `#pause-body` | `Keep playing`, primary |
| `pause-new` | `#pause-body` | `New game` |
| `confirm-yes` | `#newgame-body` | `Start over` |
| `confirm-no` | `#newgame-body` | `Keep playing`, primary (focused on open) |
| `sell-{gearId}` | `#broke-body` | `Sell for {n}` |
| `broke-keep` | `#broke-body` | `Keep going` (present only when the test is false) |
| `broke-over` | `#broke-body` | `Start over` |

Panels open by removing `hidden` from the section and from `#panels`, moving focus to the panel's heading (`tabindex="-1"` set by `game.js`), and setting `inert` on `#stage` and `#hdr` where supported. Close returns focus to `#act`. Only one dialog is open at a time, except `#howto`, which shows beside `#pause`.

### 4.5 Input

> **Amended by the v2 delta, D13:** the tap mapping uses 176 by 192 virtual px with station rect hit tests first; the `13` and `15` below are v1.

- Pointer: `pointerdown` on `#cv` (and `touchstart` with `preventDefault` to stop double tap zoom) maps client coordinates to the tile: `tx = floor((clientX - rect.left) / rect.width * 13)`, `ty = floor((clientY - rect.top) / rect.height * 15)`, then `sim.walkTo(tx, ty)`. Ignored while a panel is open.
- `#act` click: `sim.interact()`.
- Chips click: `sim.selectMeat(id)`.
- Keyboard, `keydown` on `document`: while no panel is open, Arrow keys and WASD call `sim.move(dir)` on each keydown and are added to a held set; each frame, every held direction key calls `sim.move` again (the sim ignores it mid step, so repeat runs at the walk speed); `keyup` removes it. Space and E call `sim.interact()`. Digits 1 to 5 call `selectMeat` by `MEATS[m].key`. Q and Shift+Q call `cycleMeat(1)` and `cycleMeat(-1)`. Escape and P toggle pause during service. `preventDefault` only for these keys and only when handled. While a panel is open: Escape on `#pause` resumes, Escape on `#newgame` acts as Keep playing, Escape elsewhere does nothing; every other key is left to the browser.
- Arriving at a station by tap runs the auto action inside the sim (section 2.5.5); `game.js` does nothing extra on arrival.

### 4.6 Status line

> **Superseded by the v2 delta, D14** for the precedence (the save notice sits second).

`#status` shows one message by the precedence of [spec 14.3]: `Saving is off in this browser.` (4 s at load, once) > `Can't get there` (1.5 s after `blocked`) > `Gate opens in {n}` (prep, `n = ceil(GATE_OPENS - clock)`) > `Last call` (3 s after `last_call`) > `sim.holding()`.

### 4.7 Events to aria-live and saves

> **Amended by the v2 delta, D10:** the to go and seat tip sentences, and the sold out walk past sentence of game deviation 7.

`#live` receives messages through a queue: one message per second at most, identical messages within 5 s dropped [spec 16]. The mapping, with meat label `L = MEATS[meat].label` and cooker name `K = STRINGS.cooker[cooker]`:

| event | sentence | also |
|---|---|---|
| `yard_open` | Yard open. Gate opens in 30 seconds. | close the clipboard |
| `gate_soon` | Gate opens in 10. | |
| `gate_open` | Gate open. | |
| `customer_arrived` | New customer wants {L}. | |
| `piece_done` | {L} is done on {K}. | |
| `piece_burnt` | {L} burnt on {K}. | shake |
| `served` | Served {L}, {price} plus {tip} tip. or Served {L}, {price}, no tip. | coin pop at `(x, y)` |
| `walk_out` | A customer walked out. | `mark_x` in that customer's bubble for 0.6 s |
| `walk_past` | Someone walked past. The line is full. | |
| `fire_low` | Fire low on {K}. | |
| `fire_out` | Fire out on {K}. | |
| `last_call` | Last call. No more customers today. | status line |
| `day_over` | Day over. Opening the till. | open the till panel |
| `purchase` | Bought {label}. | redraw shop |
| `hire` | Hired {label}. or Let {label} go. | redraw hire rows |
| `sell` | Sold {label} for {price}. | redraw the Broke card (string decided here; the spec has no sale sentence) |
| `coming_next` | You can afford the driveway pop-up. It is the next rung and is not built yet. | |
| `broke` | Broke. Sell gear or start over. | open the Broke card instead of the clipboard |
| `save_wanted` | | `localStorage.setItem(SAVE_KEY, JSON.stringify(sim.serialize()))` in try/catch; on throw, `saveOff` and the status message once |
| `save_clear` | | `localStorage.removeItem(SAVE_KEY)` in try/catch |
| `left_at_close` `slice_done` `set_down` `trash` `blocked` `rain` | | no sentence; `blocked` drives the status line |

Save failure sentence: `Saving is off in this browser.` is also queued to `#live` the first time it happens.

### 4.8 Reduced motion

> **Superseded by the v2 delta, D14.**

`matchMedia('(prefers-reduced-motion: reduce)')`, read at boot and on change. When it matches: no smoke sprites, no shake, coin pops hold still for 600 ms, no served hop (`hop` is ignored), rain is a flat band with no streaks, `fire` shows frame 0, no idle bobbing. Walking frames, cooking arcs, patience bars and gauges still animate [spec 17]. Panels never animate in either mode.

### 4.9 Strings owned by `game.js`

Every string from [spec 18] that is not in `PitSim.STRINGS` or produced by a sim method, spelled exactly as the spec writes it: the header words, the status line forms, the clipboard lines, the shop section headings (`Meat`, `Charcoal`, `Gear`, `Hires`), `Daily costs: ice and trash bags, 10.`, `Game numbers. Not real prices and not a cooking guide.`, the till lines of [spec 9] including `Food, charcoal and spoilage were paid at the shop. They are listed so you can see where the money went.`, the pause, confirm, Broke and Coming next texts of [spec 11 and 12], and the Controls list. Star string: `'★'.repeat(round(rep / 20)) + '☆'.repeat(5 - round(rep / 20))`.

### 4.10 `PitSim.game`

> **Superseded by the v2 delta, D14:** version `'0.3.0'`, `advance` refreshes the DOM and draws, new `dog`, `fxLog`, `captureFrame`.

```ts
PitSim.game = {
  version: string,                 // '0.1.0' for the first build; bump on every change
  sim: Sim,                        // the live sim; reset() mutates it in place, so this reference is stable for the page's life
  el: { [id: string]: HTMLElement },   // every shell container by id (section 4.4 first table), looked up once at boot
  advance(seconds: float): void,   // steps the sim by `seconds` in TICK_SECONDS ticks at once, then pumps events once; for the harness
  reduced: boolean,                // the reduced motion flag in effect
  saveOff: boolean
};
```

---

## 5. Harness: `games/pit-sim/dev/smoke.mjs`

> **Amended by the v2 delta, D15:** the v2 step list (36 steps: the 27 v1 steps plus 9 new) replaces the lists below, which describe the v1 contract and not the shipped v1 harness.

Run with `node games/pit-sim/dev/smoke.mjs` from the repo root. Exit code 0 on success, 1 on any failed assertion, with one line per step (`ok` or `FAIL` plus the step name). It is never served or linked.

### 5.1 Node checks (no browser)

1. `node --check` on `sprites.js`, `sim.js`, `game.js` via `child_process.spawnSync(process.execPath, ['--check', file])`.
2. Load `sim.js` headless: `vm.runInThisContext(fs.readFileSync(simPath, 'utf8'), { filename: simPath })`, then `const PitSim = globalThis.PitSim`. Assert `C`, `MEATS`, `MEAT_IDS`, `MAP`, `CATALOG`, `STRINGS`, `createSim`, `validateSave`, `fireBand`, `fireMult`, `tileOwned`, `SAVE_KEY === 'hs.pitsim.save'` exist; `MAP.tiles.length === 195`; `MAP.stations.length === 8`; `CATALOG.length === 15`.
3. `validateSave`: `null`, `'x'`, `[]`, `{}`, `{ v: 2 }` give `null` or defaults as the table says (`{}` is `null` because `v` is missing); a save with `v: 1`, `day: 'abc'`, `cash: -50`, `rep: 400`, `stock: { sausage: 200, bogus: 1 }`, `gear: { drum: true, kettle2: false }`, `hires: { tender: true }`, `extra: 1` returns `day 1`, `cash 0`, `rep 100`, `stock.sausage 99`, no `bogus`, `gear.drum false`, `hires.tender false`, no `extra`.
4. Deterministic day: `createSim(null, 1)`; `buy('charcoal', 3)`, `buy('sausage', 2)`; `canOpen().ok`; `openGate().ok`; `state.cash === 66`; then a scripted competent loop using `walkTo` and `tick` until `phase === 'evening'`: pile, kettle1 (fire 60), cooler, kettle1, wait for `piece_done`, kettle1, board, wait for `slice_done`, board, table, and so on while stock lasts, feeding charcoal when `fire < 50`. Assert `till.served >= 1`, `state.day === 2`, `state.cash > 66`, and that `serialize()` passes `validateSave` unchanged (deep equal). Run the same script twice with seed 1 and assert the two `serialize()` results are deep equal; run with seed 2 and assert at least one `customer_arrived` event differs in time or meat.
5. Idle day: `createSim(null, 3)`, buy a bag and a sausage, open, `tick` until evening with no actions. Assert `phase === 'evening'`, `till.customers >= 1`, `till.walkouts + till.close + till.past === till.customers`, `state.cash === 0` or more (never negative), a `day_over` event, and `state.broke` after `continueFromTill()` matches the Broke formula on the state.

### 5.2 Browser checks (Chrome via CDP)

Launch `C:\Program Files\Google\Chrome\Application\chrome.exe` with `--headless=new --remote-debugging-port=0 --user-data-dir=<fresh temp dir> --no-first-run --allow-file-access-from-files about:blank`, read the port from stderr (`DevTools listening on ws://...`), fetch `http://127.0.0.1:<port>/json`, open the page target's `webSocketDebuggerUrl` with the global `WebSocket`, and drive it with `Page.enable`, `Runtime.enable`, `Network.enable`, `Log.enable`, `Page.navigate` to `pathToFileURL(indexPath).href + '?seed=1'`. Collect `Runtime.consoleAPICalled` with type `error`, `Runtime.exceptionThrown`, `Log.entryAdded` with level `error`, and every `Network.requestWillBeSent` URL. Evaluate with `Runtime.evaluate` (`returnByValue: true`, `awaitPromise: true`), and click by evaluating `document.getElementById(id).click()`. Keys are sent with `Input.dispatchKeyEvent`.

Steps, each asserted:

1. Page loaded; zero console errors; zero exceptions; the only requests are the four `file://` URLs (`index.html`, `sprites.js`, `sim.js`, `game.js`).
2. `typeof PitSim.game.version === 'string'`; `PitSim.art.built === true`; every name in section 3.4 passes `art.has` with the listed frame count.
3. `sim.state.phase === 'morning'`, `day === 1`, `cash === 80`; `#clipboard` is visible, `#open.disabled === true`, `#open-why` text is `Buy at least one bag of charcoal.`
4. Click `inc-charcoal` three times, `inc-sausage` twice; `#qty-charcoal` text `3`, `#cart` text `Total 14. Cash after 66.`; `#open.disabled === false`.
5. Click `open`; `phase === 'service'`, `cash === 66`, `#clipboard` hidden, `#status` text starts with `Gate opens in`, `#act` text `Walk`.
6. `sim.walkTo(8, 13)` (the pile) returns true; `PitSim.game.advance(2)`; `player.carrying.kind === 'charcoal'`; `walkTo(8, 9)`; `advance(2)`; `stations.kettle1.fire === 60`; `walkTo(3, 11)`; `advance(2)`; carrying raw sausage; `walkTo(8, 9)`; `advance(2)`; `kettle1.pieces.length === 1`; `advance(15)`; piece state `done`; `walkTo(8, 9)`; `advance(1)`; carrying cooked; `walkTo(4, 9)`; `advance(4)`; `board.stacks[0].times.length === 2`; `walkTo(4, 9)`; `advance(1)`; carrying 1 plate; `walkTo(6, 6)`; `advance(2)`; `table.spots` holds a sausage stack.
7. `advance(130)`; `phase === 'evening'`; `#till` visible; `#till-h` text `Day 1 till`; `localStorage.getItem('hs.pitsim.save')` parses and `validateSave` returns `day === 2`.
8. Click `next`; `phase === 'morning'`, `day === 2`; the `hire-buddy` button exists and is enabled.
9. Send Escape; `#clipboard` still visible (Escape does nothing there).
10. Click `clip-new`; `#newgame` visible; send Escape; `#newgame` hidden (Keep playing). Click `clip-new`, click `confirm-yes`; `day === 1`, `cash === 80`, `localStorage.getItem('hs.pitsim.save') === null`.
11. Layout: `document.documentElement.scrollWidth <= window.innerWidth` at a 375 by 740 viewport (`Emulation.setDeviceMetricsOverride`); every `button` in the document has `getBoundingClientRect().height >= 44` and `width >= 44` while visible; `#cv` style width is an integer multiple of 208 divided by `devicePixelRatio`.
12. Keyboard: open the yard again (steps 4 and 5), send ArrowLeft via `Input.dispatchKeyEvent` (`keyDown` then `keyUp`, `key: 'ArrowLeft'`, `code: 'ArrowLeft'`, `windowsVirtualKeyCode: 37`); `advance(0.5)`; `player.x === 5`. Send Escape; `#pause` visible and `sim.state.paused === true`; send Escape; hidden and not paused.
13. Reduced motion: `Emulation.setEmulatedMedia` with `prefers-reduced-motion: reduce`, reload with the seed, assert `PitSim.game.reduced === true`.
14. Close the browser and remove the temp profile.

---

## 6. `index.html`

> **Amended by the v2 delta, D13:** the Game builder adds `@media (max-width: 899px) { #wrap { margin: 0 -8px; width: auto; } }` and nothing else.

Written with this contract at `games/pit-sim/index.html`. It is the shell every builder targets and nobody edits. Contents, in order: `<!doctype html>`, `html lang="en"`, head with `charset`, `viewport width=device-width, initial-scale=1`, `title` `Your Pit`, `description` meta, `color-scheme dark`, `theme-color #1b1714`, one inline `<style>`, three `<script defer>` tags for `./sprites.js`, `./sim.js`, `./game.js`; body with the skeleton of section 4.4, static text only in `#title` and `#foot`, the `noscript` line `This game runs in your browser and needs JavaScript turned on.`, the visually hidden `#live`. Zero inline script, zero inline handlers, no external resource, no dash characters.

The inline style defines: a reset (`box-sizing: border-box`, zero margins), the palette as custom properties on `:root` (`--k`, `--u`, `--c`, `--o`, `--y`, `--m`, `--h`, `--i`), body cream on near black in `ui-monospace, Menlo, Consolas, monospace`, the single column layout with 16 px gutters and the 44 px header, `#wrap` as a centered near black letterbox, `#status` at 24 px, `#act` 48 px tall full width orange with near black text, `#chips` as five equal buttons at least 44 px tall, panel sections as umber boxes with hairline borders over an 85 percent near black scrim, the two column layout at 900 px and up with a 320 px right column holding `#panels` inline, `button` defaults (44 px minimum, orange primary, umber secondary via `.alt`), focus ring 2 px gold with a 2 px offset, `.sr` visually hidden, `[hidden] { display: none !important }`, `.muted`, `.row`, `.card`, `.dl` classes `game.js` may use, and a `@media (prefers-reduced-motion: reduce)` block that disables transitions (there are none anyway).

Class names `game.js` may rely on: `.primary`, `.alt`, `.muted`, `.row` (a shop or till row, flex, space between), `.card` (the Coming next card), `.chip`, `.sr`, `.stars`. Anything else `game.js` needs it styles with inline `style` properties set through the CSSOM (`el.style.x = ...`), which the CSP allows.

---

## 7. Decisions made where the spec was silent

> **v2:** items 6 (fixed routes), 9 (unhappy face frame 3 now covers `_down` frames 3 and 4 and `_side` frame 3), 11 (font unchanged) and 12 (the canopy is one 40 by 32 umbrella sprite) are read with D8 and D11; D16 lists the v2 decisions.

Listed so nobody re-decides them:

1. Pause is `state.paused`, a flag, not a phase; `phase` is `morning | service | evening` and prep is service with `clock < GATE_OPENS`.
2. `verbAt()` never returns `null`; nothing in reach is `{ label: 'Walk', enabled: false }`. While slicing the label is `Slicing`.
3. `buy` on meat and charcoal changes only the cart; `qty` may be negative; `hire` is a toggle; `sell` exists only on the Broke card.
4. Rep is accumulated in `today` and applied at the till with the clamp; `state.rep` is constant during a day.
5. The sim does fixed 20 Hz steps with its own accumulator; `game.js` draws `px, py` without interpolation.
6. Customer routes are fixed, no BFS. `LEAVE_TURN_SECONDS` is 0.2.
7. `stock.brisket` is forced to 0 by the validator when the drum is not owned.
8. Pieces per meat are four frame sprites (raw, cooking, done, burnt); no procedural tinting. Hand overlays are per meat sprites.
9. The unhappy face is frame 3 of each `cust{n}_down`, not an overlay.
10. `mark_x` shows in a walk out's bubble for 0.6 s; wrong plates never reach a customer in this design, so that is the only refusal the yard shows.
11. The `font` sprite has 38 frames including `+` and `:`. The canvas clock shows whole seconds remaining.
12. The canopy is two sprites: `canopy` at (64, 74) and `canopy_pole` twice at (65, 98) and (139, 98).
13. `cooler` frame 2 (open) shows while the player is in reach of it.
14. Every sim method is an own property of the sim object; destructuring works.
15. `PitSim.game.advance(seconds)` exists for the harness and is harmless in play.
16. Shell containers inside panels (`clip-top`, `shop`, `hire`, `clip-foot`, `till-body`, `pause-body`, `howto-body`, `newgame-body`, `broke-body`) exist in the HTML so `game.js` fills rather than builds panel structure; headings are empty in the shell and `game.js` sets their text.
17. Scripts share the global through `globalThis`, never `window`, and `sim.js` has no CommonJS or ESM export; the harness loads it with `vm.runInThisContext`.
18. A `?seed=` query parameter seeds the sim; absent, `createSim` seeds from `Date.now()`.
19. The sale sentence `Sold {label} for {price}.` is added to the aria-live table.
20. `game.js` keys off `data-phase` on `#root` for CSS, so panels can be inline on desktop without JS layout work.
