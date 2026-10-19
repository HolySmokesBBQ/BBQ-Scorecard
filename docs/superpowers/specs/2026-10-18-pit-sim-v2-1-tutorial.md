# Pit sim v2.1: guided tutorial, gentler burn, charcoal that reads as charcoal

**Date:** 2026-10-18 (late). **Builds on:** v2 at commit b48e1be (`games/pit-sim/`, 38 step harness green).
**Governs:** this file holds the v2.1 rules in full. The interface it needs (exact names, payloads, sprite list, DOM ids, harness steps) is folded into `docs/superpowers/specs/2026-10-18-pit-sim-contract.md` as the section "v2.1 tutorial, burn warning, charcoal" (cited here as [K21]), and `docs/superpowers/specs/2026-10-18-pit-sim-design.md` carries a short "v2.1" section that points here and supersedes the meat window numbers and the how to card. Precedence is the v2 rule: on a name or a signature the contract wins; on a rule of play this file wins, and a builder who finds them apart builds this file and lists it under Deviations.
**Copy rules (unchanged):** no em or en dashes anywhere, no "offset", no brands, game numbers only, plain words. Every new string is written below exactly as it ships.
**Accessibility (unchanged baseline):** 44 px DOM controls, keyboard play, aria-live, reduced motion.

---

## 0. Who owns what (v2.1)

Four builders work at the same time and do not talk. Each owns only the files in their row and writes against [K21] by name.

| Builder | Owns (may edit) | Builds | Must not touch |
|---|---|---|---|
| **Art** | `games/pit-sim/sprites.js`, `games/pit-sim/dev/sheet.html` | section 4 here: the new `pile`, `hand_charcoal`, piece frame 4, `arrow`, `bubble_warn`, two font glyphs; `art.text` maps `.` and `,` | everything else |
| **Sim** | `games/pit-sim/sim.js`, `games/pit-sim/dev/econ.mjs` | sections 2 and 3 here: `state.tutorial`, the step function and its rules, `skipTutorial`, `tutorialStep`, the burn warning, the new windows and `HOT_BURN_MULT`, save version 3; econ rerun | everything else |
| **Game** | `games/pit-sim/game.js`; in `games/pit-sim/index.html` exactly the v2 `#wrap` rule plus the `.tut-pulse` rules of [K21] K8 | sections 2.6 and 3.4 here: banner, arrow, pulse, skip and Controls buttons, warning visuals, aria-live | everything else, and every other line of `index.html` |
| **Harness** | `games/pit-sim/dev/smoke.mjs` | [K21] K11: 45 steps | everything else |
| Overseer | the four spec docs | integration, econ record, Joel's next play | the builders' files |

Every builder runs `node --check` on each script they edited and scans each edited file for U+2014 and U+2013. No git, no deploys, no installs.

## 1. Why

Joel played v2 on his Android phone on 2026-10-18 and wrote: "Game is pretty cute. I think a tutorial might do better than a 'how to play'. I also think the game itself can be challenging with the sausage burning pretty easily. The charcoal doesn't look like charcoal." He likes the play of an arcade sports game he named and the modern 8-bit look of the cafe reference from v2.

The Overseer's three calls, built here and nothing else:

1. A guided tutorial replaces the how to card on a new game. Day 1 is the tutorial day.
2. A gentler burn: wider done windows, a hot fire that no longer burns faster, and a warning stage before burnt.
3. Charcoal that looks like charcoal: black pillow briquettes and a paper sack, in the pile and in the hand.

Everything else in v2 stays exactly as it is: map, stations, seats, decor, charm, economy numbers other than the windows, feedback, scaling, the y-sort.

---

## 2. Guided tutorial

### 2.1 State

```ts
state.tutorial = { step: TutorialStepId | null, done: boolean }
TutorialStepId = 'open' | 'charcoal' | 'light' | 'meat' | 'puton' | 'cook' | 'slice' | 'plate' | 'customer' | 'seated' | 'end'
```

"The tutorial is running" means `state.tutorial.done === false`. While it runs `step` is one of the ids; once done, `step` is `null` and `done` is `true` for the life of that game. A new game (`createSim(null)` or `reset()`) starts it at `{ step: 'open', done: false }`. A loaded save starts it at `{ step: 'open', done: false }` only when the save says `tutorial.done === false` (section 2.8); otherwise `{ step: null, done: true }`.

The arrow target is not stored in state. `sim.tutorialStep()` returns `null` when the tutorial is done, else a fresh `{ id, text, target }`, where `text` is `STRINGS.tutorial[id]` and `target` is the value from the table below for the current state. A target is a `StationId` (draw the canvas arrow at that station), a DOM id (pulse that element), or `null` (no pointer). `MAP.stations` ids and the one DOM id used (`open`) never collide.

### 2.2 The steps

In order. "Comes after" is the sim event or action that proves the step before it was done, on the path a first time player takes.

| # | id | banner text, exactly (`STRINGS.tutorial[id]`) | target | comes after |
|---|---|---|---|---|
| a | `open` | This is your morning. The cart is already filled. Tap Open the yard. | `'open'` (the `#open` button) | a new game's first morning |
| b | `charcoal` | Grab charcoal from the pile. | `'pile'` | `yard_open` |
| c | `light` | Tap the kettle to light it. | `'kettle1'` | the pile action ran for the player (hands now hold charcoal) |
| d | `meat` | Grab meat from the cooler. | `'cooler'` | the charcoal action at kettle 1 ran (fire now at or above `COLD_UNDER`) |
| e | `puton` | Put it on the kettle. | `'kettle1'` | the cooler action ran (hands now hold a raw piece) |
| f | `cook` | Watch the box fill. Pull it when it turns green. | `null` until a piece on kettle 1 is done and the hands are empty, then `'kettle1'` | the put on action ran (a piece is on kettle 1) |
| g | `slice` | Slice it at the board. | `'board'` | the pull action took a cooked piece |
| h | `plate` | Set the plate on the counter. | `'table'` while the hands hold plates, `'board'` while they are empty and plates wait on the board | `slice_done` (deviation 10 puts the first plate in the hands) |
| i | `customer` | Here comes your first customer. | `null` | `set_down`: a plate is on the counter |
| j | `seated` | Served. They will sit and eat, then tip a little more. | `null` | `served` for the first customer |
| k | `end` | You have the hang of it. Keep the fire fed and keep them happy. | `null` | `seat_done` for the first customer (or `to_go`, if no seat was free) |
| | done | | | `C.TUTORIAL_END_S` (6) seconds of sim clock after `end` began: `tutorial_done { skipped: false }` |

`STRINGS.tutorialOrder` is the id column as a frozen array, in this order.

Step j waits for the seat tip, not for the seat pick: `seat_taken` comes in the same tick as `served`, so a step that waited for it would flash past. Waiting for `seat_done` lets the player watch the customer sit, eat, and tip under the banner that says so, and it matches how `today.seated` counts.

### 2.3 The step function (exact)

Steps a to h are not a fixed script. A first time player will tap things out of order (the cooler before the pile is the likely one), so the step is worked out from the state every time it is checked. Steps i to k are latched: once the plate lands, the tutorial only moves forward.

The sim checks the step at the end of every `tick()`, at the end of `interact()`, `openGate()`, `skipTutorial()` and `reset()`, and once when `createSim` returns. With `K = state.stations.kettle1`, `h = state.player.carrying`, `B = state.stations.board`, `T = state.stations.table`, and the current step not yet `customer`, `seated` or `end`, the first matching row wins:

| # | condition | step |
|---|---|---|
| 1 | `state.phase === 'morning'` | `open` |
| 2 | some `T.spots[i] !== null` | `customer` (latch; section 2.4 rule B runs) |
| 3 | `K.fire < C.COLD_UNDER` and `h` is charcoal | `light` |
| 4 | `K.fire < C.COLD_UNDER` and `h` is a raw piece | `puton` (a cold grate takes meat and holds it; then the pile, then the light) |
| 5 | `K.fire < C.COLD_UNDER` | `charcoal` |
| 6 | `h` is plates, or (`B.stacks.length > 0` and `B.slicing === null` and `h === null`) | `plate` |
| 7 | `h` is a cooked piece, or `B.slicing !== null` | `slice` |
| 8 | `K.pieces.length > 0` | `cook` |
| 9 | `h` is a raw piece | `puton` |
| 10 | `h` is charcoal | `light` (kettle already lit: the arrow sends the spare bag to the kettle) |
| 11 | otherwise | `meat` |

Latched steps: `customer` becomes `seated` when `today.served >= 1`; `seated` becomes `end` when `today.seated + today.togo >= 1`; `end` ends the tutorial when `state.clock >= endAt`, where `endAt` is the clock at which `end` began plus `C.TUTORIAL_END_S` (kept inside the sim, never saved). Only the scripted customer exists before `end`, so these counters can only mean them.

Whenever the step id or the target differs from the last pair the sim emitted, it emits `tutorial_step { id, text, target }`. The step `cook` therefore emits twice on the happy path: with `target: null` when the piece goes on, and with `target: 'kettle1'` when it is done. A trashed cooked piece (a button only action) sends the step back to `meat` by row 11, which is the right next instruction.

### 2.4 Rules while the tutorial runs

Each rule holds while `state.tutorial.done === false` and stops the tick after `done` becomes true.

- **A. Clock held.** In service, while the step is not yet `customer`, `tick()` runs every stage (player, NPCs, fire, pieces, customers, spawns) but does not advance `state.clock`. The clock reads 0 from Open the yard until the plate lands, so no `gate_soon`, `gate_open` or `last_call` can fire and the gate stays shut. Movement, fire decay, cooking and slicing run on `dt` as always.
- **B. Gate on the plate.** When the step becomes `customer` (rule 2), in this order: emit `tutorial_step` for `customer`; set `state.clock` to exactly `C.GATE_OPENS` and count on from there; shift every stored clock value by the same jump (each piece's `putOn`, every plate time in the hands, on the board and on the counter), so plate ages and pull order do not change; mark `gate_soon` fired without emitting it (it never fires that day); emit `gate_open` once (the normal gate open check must not emit it again); spawn the scripted customer (rule F), which emits `customer_arrived`. All of it happens inside the call that found the plate (the end of that `tick()` or that `interact()`).
- **C. No other spawns.** `openGate()` sets `spawnAt = Infinity` when the tutorial is running. The scripted customer is the only spawn before `end`. When the step becomes `end`, `spawnAt = state.clock`, so normal arrivals start on the next stage 6 and run on the normal formula from then on.
- **D. Patience frozen.** Waiting customers do not lose `patience`, do not gain `wait`, and do not change mood. Nobody walks out. The freeze covers customers who arrive during `end` until the tutorial ends; the scripted customer is served on arrival, so their wait is 0 and the serve is quick.
- **E. First piece cannot burn.** A piece in state `done` does not advance `prog`, so it can neither reach the warning stage nor burn; it holds at done until pulled. This covers any piece the player adds while the tutorial runs. When the tutorial ends, held pieces resume from where they are under section 3.
- **F. The scripted first customer.** Spawned by rule B with no `rng()` draw: `want` is the meat of the first non null `T.spots[i]` in index order; `patienceMax = patience = C.PATIENCE_BASE` (45); `body = arrivals % 4` (0); `arrivals += 1`; `today.customers += 1`; queue index 0; routed by BFS from `MAP.custSpawn` exactly like any customer. `spawnAt` stays `Infinity`. The seeded rng sequence of the day therefore starts with the first normal spawn after `end`.
- **G. Fire floor.** On a cooker whose fire is at or above `C.TUTORIAL_FIRE_FLOOR` (30), decay never takes it below 30. A cold cooker (under 30, in practice 0 before the light) is unchanged by this rule. 30 is `FIRE_LOW_WARN`, so the kettle stays in the low band or better, never goes out, and neither `fire_low` nor `fire_out` fires during the tutorial (both fire on crossing below, and holding at 30 crosses nothing). At 30 the kettle still cooks at 0.6.
- **H. Day end.** If the till would run while the tutorial is still running (it cannot on the normal path: the clock is held until the plate lands, and the latched steps take about 20 s), the sim first ends the tutorial with `tutorial_done { skipped: false }`, then runs the till as usual.

The tutorial changes nothing else: prices, the cart, the shop, the till and the save rules all work as in v2. Day 1 loses about 13 s of arrivals (the gate opens at clock 30 as always, normal arrivals start when `end` begins at about clock 43), roughly one customer at word of mouth 20.

### 2.5 Skip and new game

- `sim.skipTutorial(): boolean`. When the tutorial is running: sets `state.tutorial = { step: null, done: true }`, emits `tutorial_done { skipped: true }`, and returns `true`. Otherwise returns `false` and changes nothing. Legal in any phase.
  - In the morning it also emits `save_wanted { reason: 'tutorial' }`, so a reload keeps the choice.
  - In service it emits no save (the v2 rule: never save during service; the till save carries `done: true`). If the step was before `customer`, the held clock resumes from its value (usually 0) and `spawnAt = C.GATE_OPENS` when `state.clock < C.GATE_OPENS`, else `state.clock`, so the gate opens on the normal 30 s timer with `gate_soon` and `gate_open` at their usual times. If the step was `customer` or later, `spawnAt = state.clock`. Held pieces resume; patience starts draining on the next tick.
  - A reload after a service skip reloads the save written at Open the yard, which says `done: false`, and the tutorial starts again at `open`. Accepted: that save is the morning anyway.
- **Controls.** "Skip tutorial" appears in the clipboard (`#tut-skip`) and in the pause panel (`#pause-skip`) while the tutorial runs, and nowhere else.
- **New game** (Start over on any panel): `reset()` starts the tutorial again at `open` and emits its `tutorial_step`.

### 2.6 What the player sees and hears (`game.js`)

- **Banner (service only).** While `sim.tutorialStep()` is not null and the phase is service, an in canvas box (placement below), drawn in render pass 8 in place of the clock and the GATE OPENS IN text (neither is drawn while the banner shows). The text is `text.toUpperCase()` in the pixel font, cream `3`, wrapped greedily on spaces so each line's `art.textWidth` is at most 164 (33 glyphs), never more than 2 lines. Box: near black `K` fill, a 1 px cream `C` border, top left (2, 2), width 172, height 11 for one line or 21 for two (round 2: 2 px inside the border above and below the text, was 19); line `i` text at the box top left plus (3, 3 + 8 * i), so (5, 5 + 8 * i) at the top. Placement (amended at integration, contract K13 item 1): while the target is a station whose drawn box starts in the top third of the canvas (draw y under 64: the pile, the kettles, the cooler) the box sits on the bottom edge at (2, 190 - h) instead, so it never covers that station or its chimney puffs; a step with no target keeps the last placement. On the happy path the banner is at the bottom from charcoal to cook and at the top from slice to end. It is procedural (not a draw record); its glyphs are `font` records. The pinned texts wrap as:
  - cook: `WATCH THE BOX FILL. PULL IT WHEN` / `IT TURNS GREEN.`
  - seated: `SERVED. THEY WILL SIT AND EAT,` / `THEN TIP A LITTLE MORE.`
  - end: `YOU HAVE THE HANG OF IT. KEEP THE` / `FIRE FED AND KEEP THEM HAPPY.`
  - every other service step: one line.
  Round 2 corrected the cook and seated wraps to the shipped K8 text (the table in 2.2). Deviation from the Overseer's brief, kept: step f says "Watch the box fill. Pull it when it turns green." in place of "Watch the ring fill. Pull it when the check mark shows." because the art draws a box shaped ring that turns green on done and shows no check mark then, and step j says "then tip a little more." in place of "then tip." because a seated customer adds to the counter tip.
  The step `open` has no canvas banner: its text lives in the clipboard (`#tut-clip`), which covers the canvas on a phone and sits beside it on a desktop.
- **Arrow.** When the target is a station: the `arrow` sprite in render pass 6 (after tap rings), centered on that station's drawn box (the `counter` rect for the table): `x = draw.x + floor(w / 2) - 4`. Above the box (`y = draw.y - 12`, frames 0 and 1, pointing down) when `draw.y - 12 >= 22`, so it clears a two line banner; otherwise below it (`y = draw.y + h`, frames 2 and 3, pointing up). Bob: the two frames of the chosen pair swap every `C.FX.ARROW_BOB_S` (0.3 s) of the effect clock; reduced motion shows frame 0 or frame 2 only. Positions on this map: pile (68, 48) up, kettle 1 (84, 48) up, cooler (100, 32) up, board (84, 52) down, table (108, 76) down. Round 2: a tap on the drawn arrow (its 8x12 box widened 2 px each side) counts as a tap on its station, so `onPointer` sends `sim.walkTo` to the station's first tile and the arrival auto action runs; before, the tap fell on a plain tile (the use tile under a below arrow, or the tile above the station) and the walk ended with nothing in reach. Round 2: the arrow is not drawn while the center of its box falls on the player's drawn 16x24 body (it would sit on him; the pulse on `#act` carries the step then), above or below the station alike. This replaces round 1's rule (a below arrow hid whenever `sim.reach()` was the target station), which left the board arrow drawn over a player at (5,3) and hid kettle 1's arrow at (6,2) where it covered nothing.
- **Pulse.** When the target is a DOM id, that element gets the class `tut-pulse`. When the target is a station, `sim.reach() === target` and `sim.verbAt().enabled`, `#act` gets `tut-pulse` too (keyboard players act with Space or E). The class is removed the moment the condition stops. It pulses gold to cream; under reduced motion the shell's existing rule stops the animation and it stays a static gold ring.
- **Clipboard.** While the step is `open`: a `p#tut-clip` (class `card`) right after the header line with `STRINGS.tutorial.open`, then `button#tut-skip` "Skip tutorial" (class `alt`). The v2 day 1 hint ("Tap the charcoal pile, then tap the kettle...") shows only on day 1 with the tutorial done, so a player who skipped still has it.
- **Pause panel.** In order: Keep playing (`#resume`), Controls (`#pause-controls`), Skip tutorial (`#pause-skip`, only while the tutorial runs), New game (`#pause-new`).
- **Controls card.** The v2 "How to play" button is renamed **Controls** and keeps its id `#howto-btn`. The card (`#howto`) opens only from `#howto-btn` or `#pause-controls`; it no longer appears by itself beside the pause panel. Back (`#howto-close`) and Escape return to the panel it was opened from. The desktop side column still shows it during service with no panel open, as in v2 (that is layout, not a card opening).
- **aria-live.** Each `tutorial_step` whose id differs from the last spoken id queues its `text` (so `cook` is spoken once). While the tutorial runs, `yard_open` speaks nothing (the `charcoal` step follows at once). `tutorial_done` speaks nothing. The live queue rules are unchanged (one a second, identical within 5 s dropped).
- **Status line.** While the tutorial runs, "Gate opens in {n}" is not shown (it would read 30 for the whole held clock); the line falls through to `sim.holding()`.

### 2.7 Pacing of the happy path

Open the yard; pile (4,2) and the light, about 1.5 s; cooler and put on, about 1 s; the sausage cooks 14 s at good fire (the light at 60 decays to about 46 by done, so a little longer); pull, slice 3 s, plate to the counter, about 1.5 s; the customer walks in from (9,12) to (7,7) in about 2 s, is served on arrival, walks to `pt1b` (6,8) and eats 8 to 12 s; the heart and +1 TIP; then 6 s of the last banner. About 45 s of play from Open the yard to the end of the tutorial, with the yard clock reading about 49.

### 2.8 Save version 3

`C.SAVE_VERSION` is 3. The v2 shape plus one key:

```json
{ "v": 3, "day": 1, "cash": 66, "rep": 20,
  "stock": { "sausage": 3, "chicken": 2, "ribs": 0, "butt": 0, "brisket": 0 },
  "charcoal": 5,
  "gear": { "kettle2": false, "cooler": false, "bigtable": false, "tray": false, "canopy": false, "drum": false },
  "decor": { "chair1": false, "chair2": false, "flowers": false, "birdbath": false, "lights": false, "picnic2": false },
  "hires": { "buddy": false, "tender": false },
  "stats": { "days": 0, "served": 0, "walkouts": 0, "past": 0, "burnt": 0, "seated": 0 },
  "drivewayShown": false,
  "tutorial": { "done": false } }
```

`validateSave(obj)` accepts `v` 1, 2 and 3 and always returns a version 3 object:

- `v === 3`: every v2 rule, plus `tutorial.done`, which is `false` only when `obj.tutorial` is a plain object whose `done === false` and the validated `day` is 1; in every other case (missing, not boolean, any day after 1) it is `true`. Unknown keys inside `tutorial` are dropped.
- `v === 2` (the v2 to v2.1 migration): the v2 rules, returned as `v: 3` with `tutorial: { done: true }`. A v2 player has played; they never see the tutorial, even on day 1.
- `v === 1`: the v1 rules and the v2 migration, returned as `v: 3` with `tutorial: { done: true }`.
- Anything else (`v` missing, 0, 4, a string): `null`. Never throws.

`serialize()` always writes `v: 3` and `tutorial: { done: state.tutorial.done }`. The step is never saved. `game.js` keeps the v1 notice (Your save was updated for the new yard.) on `parsed.v === 1` only; a v2 save migrates silently and is written as version 3 at the next save.

---

## 3. Gentler burn with a warning

### 3.1 Wider windows

`MEATS[m].window`, in prog units as before (one prog unit is one second at good fire):

| Meat | v2 window | v2.1 window | warning starts after done (prog) | warning lasts (prog) |
|---|---|---|---|---|
| Sausage | 6 | 14 | 8.4 | 5.6 |
| Chicken thighs | 8 | 16 | 9.6 | 6.4 |
| Pork ribs | 10 | 18 | 10.8 | 7.2 |
| Pork butt | 14 | 22 | 13.2 | 8.8 |
| Brisket | 18 | 26 | 15.6 | 10.4 |

Cook times, prices, plates, slots and slice times do not change. The pull order key `(prog - cook) / window` is unchanged and simply reads the new windows.

### 3.2 A hot fire no longer burns faster

Cooking is unchanged: a `cooking` piece advances `prog += fireMult(fire) * dt` (out 0, low `fire / 50`, good 1.0, hot `HOT_MULT` 1.2), so the hot band still cooks 20 percent faster. A `done` piece advances `prog += burnMult(fire) * dt`, where `burnMult(fire)` is `C.HOT_BURN_MULT` (1.0) in the hot band and `fireMult(fire)` in every other band (out 0, low `fire / 50`, good 1.0). The tick on which a piece crosses `cook` uses `fireMult` for that whole tick, as today; the done rate applies from the next tick. So the window lasts exactly its number of real seconds at good or hot fire, and longer on a low fire. `burnMult` is internal to `sim.js` (no new top level name).

This replaces the v2 trade off ("Hot cooks faster and burns faster"): hot is now a pure speed gain, paid for in charcoal.

### 3.3 The warning stage

The warning is the last `C.WARN_FRAC` (0.4) of the window.

- `Piece` gains `warn: boolean`, false when the piece goes on.
- On the tick a `done` piece reaches `prog >= cook + window * (1 - C.WARN_FRAC)` with `warn === false`, the sim sets `warn = true` and emits `burn_warning { station, slot, meat }`: `station` is the `CookerId` it is on, `slot` the piece's first slot, `meat` its `MeatId`. Once per piece. The check runs after the done check and before the burnt check in `tickPieces`.
- Burnt is unchanged: at `prog >= cook + window` the piece burns, `piece_burnt` fires, and a burnt piece still costs its unit at the till exactly as in v2. `warn` stays true on a burnt piece; the burnt frame wins in drawing.
- **Action button.** When the player's pull at a cooker would take a `done` piece with `warn === true` (the pull order picks it), `verbAt().label` is `STRINGS.pullNow`, "Pull it now", in place of "Pull {meat}". Same action, same auto rule.
- Under the tutorial, rule E means no piece reaches the warning.

### 3.4 What the player sees and hears

- **Piece frame 4**, "about to burn": the done piece with darker, charred edges (section 4). `game.js` draws frame 3 when burnt, else frame 4 when `done` and `warn`, else frame 2 when done, else frame 0 or 1 as in v2.
- **Cooking arc** (game deviation 1): red `o` while the piece is in the warning stage, instead of green; it keeps shrinking to burnt.
- **"!" bubble** over the cooker while any `done` piece on it has `warn`: `bubble_warn` at (draw.x - 2, draw.y - 11) in render pass 5 with the other bubbles: kettle 1 (78, 13), kettle 2 (110, 13), the drum (110, 37). Round 1 moved it left of the chimney vent (it was draw.x + 4) so the dark puffs rise clear of it. A warning piece draws after the other pieces on its cooker, and the cooker's flame draws under the pieces, so the charred frame and red ring are never covered. Frames 0 and 1 swap every `C.FX.WARN_BLINK_S` (0.25 s); reduced motion shows frame 0 only. One bubble per cooker however many pieces warn. `fxLog` gains a `warn` entry at that position when a cooker's bubble starts.
- **Darker smoke.** While a cooker has a warning piece, its chimney puffs (V2.9: same vent, same rate by band) use `smoke_dark` instead of `smoke`. No new sprite. Reduced motion still shows no puffs.
- **aria-live:** `burn_warning` queues `STRINGS.burnWarn[meat]`:

| meat | sentence |
|---|---|
| sausage | The sausage is about to burn. |
| chicken | The chicken is about to burn. |
| ribs | The ribs are about to burn. |
| butt | The pork butt is about to burn. |
| brisket | The brisket is about to burn. |

### 3.5 Shop lines and the economy

No shop effect line names a done window (V2.7 and section 8.1 of the design spec), so no line changes; the chicken line still reads Chicken thighs: 2 plates, 22 seconds on good fire, sells for 8. The window column of design spec sections 8.1 and 19 and the Hot paragraph of section 5.5 are superseded by 3.1 and 3.2 here.

**Economy rerun.** The Sim builder makes `dev/econ.mjs` call `sim.skipTutorial()` right after `createSim` (when the method exists), so day 1 is the economy day the bot always played, then runs `node games/pit-sim/dev/econ.mjs` and `node games/pit-sim/dev/econ.mjs --decor` on the built `sim.js` and reports the seed 1 table and the seeds 1 to 8 summary. The Overseer records the result in the design spec's v2.1 section. If the drum lands earlier than day 9 on any seed, that is noted, not retuned.

Pre build estimate (Overseer, 2026-10-18): the v2 `econ.mjs` run against a scratch copy of v2 `sim.js` with only the windows of 3.1 and the hot burn rate of 3.2 patched in (no warning, no tutorial; the real files untouched):

| | v2 as built | v2.1 estimate |
|---|---|---|
| seed 1, burnt per day, days 4 to 10 | 1 | 0 |
| seed 1, first buys | kettle2 3, cooler 5, buddy 7, bigtable 9 | the same days |
| seed 1, cash after day 10 | 233 | 215 |
| seeds 1 to 8, second kettle | day 3 (seed 5: 4) | day 3 (seed 5: 4) |
| seeds 1 to 8, drum | days 13 to 15 | days 14 to 17 |
| driveway within 25 days, broke | never, never | never, never |

The bot never burns now, as intended. The drum lands 0 to 2 days later on seven seeds, not earlier: day 9 is not in reach. The bot pulls on done either way, so the difference is in the order of events after day 4 (tips run a little lower), within one or two days. Not retuned; recorded for the Overseer.

---

## 4. Charcoal that reads as charcoal (`sprites.js`)

The v2 pile reads as grey eggs or rocks and the hand bag reads as a brown box. Both are replaced at their current sizes and frame meanings, so `game.js` indexes them blind as before. No palette entry is added: the 32 colors already hold what charcoal needs (`1` #1b1714 near black rings, `2` #2a2015 warm near black bodies, `v` #6e6863 grey glints, `u` #ddd8cf ash specks, `4` and `k` embers, `8` `7` `6` brown paper, `5` outline, `a` paver shade; round 2 dropped the cream label `3` from the sack and the hand). Round 1 dropped `t` from every charcoal grid: it is the kettle's slate steel, and faces in it made the heap read as grey stones next to the kettle.

**The look.** Pillow shaped briquettes: each a warm near black body (`2`) ringed in near black (`1`) with one grey glint (`v`) on its top left corner, packed into a mound with a single peak in every frame, so the heap reads as one black mass with grey highlights. Round 2: the glints are single pixels staggered course to course (round 1's paired two pixel glints on a regular grid read as eyes and sunglasses), and the `u` speck is gone. At 2x on a phone next to the black kettle they must read as charcoal, never as mid grey blobs: no `s` anywhere in the pile, at most 3 `u` pixels a frame, and at least four times as many `1` and `t` pixels as `v`, `s` and `u` together. One ember on the full and half heaps, low on the right off the center axis, as two stacked `4` pixels with a `k` yellow core (round 2; a centered ember read as a nose). Behind the heap on the right a kraft brown paper sack (`8`, `7`, `6`), wider than tall, with a crimped rolled top and a black flame with one `4` core printed straight on the brown, `5` outline; round 2 dropped the cream label, which made the sack read as a battery or a can. The sack's `4` counts toward the 1 to 3 ember pixels of a frame; the low frame shows the sack's `4` only. A shadow row along the bottom on the pavers: solid `5` with `a` ends, a cast shadow and not the dashed look of an empty buy slot.

**`pile`, 16x16, 4 frames** (meanings unchanged; `game.js` picks them by bags): 0 full (5 bags or more), 1 half (3 or 4), 2 low (1 or 2), 3 empty (0: no briquettes, the sack folded flat). Round 2 moved the full threshold from over 6 to 5 or more (half was 3 to 6), so day 1's cart of 5 bags shows the full heap first; the cart is unchanged. The Overseer's call said three fill states; v2 already models four, so all four stay and the half heap sits between full and low. Reference grids (the Art builder may refine within the rules above; the harness checks the rules, not these exact pixels):

```
frame 0 (full)       frame 1 (half)       frame 2 (low)        frame 3 (empty)
................     ................     ................     ................
................     ................     ................     ................
................     ................     ................     ................
................     ................     ................     ................
........5.5.5.5.     ........5.5.5.5.     ................     ................
........5878785.     ........5878785.     ................     ................
........5666665.     ........5666665.     ................     ................
.....11588888775     .......588888775     ........5.5.5.5.     ................
....1v2188818775     .......588818775     ........5878785.     ................
..11122118111775     ...11.1118111775     ........5666665.     ................
.1v211v211141775     ..1v21v221141775     ..111..588818775     ..5.5.5.5555....
.122212221111775     .112211222111775     .1v2211581141775     .5876888888885..
1v2114v21v211765     1v2114v21v211765     1v211v2181111765     58766881118775..
122214k222217665     122214k222217665     1222122211177665     .5776811118875.1
111111111111555.     111111111111555.     1111111151v1555.     ..555555555555.1
.a555555555555a.     .a555555555555a.     .a555555555555a.     .a55555555555a..
```

**`hand_charcoal`, 8x8, 1 frame** (replaced; round 2 made it a steel scoop): a heap of black briquettes with single pixel `v` glints and one `4` ember, in a steel scoop (`s` rim, `t` bowl, `5` outline), no cream, so it reads as coals on the chest and over the head alike (round 1's mini bag read as an apron bib, and overhead its cream label read as a face). The steel is only the scoop; the briquettes never use `t`. Same anchor as every hand overlay, except that facing up `game.js` draws it after the body at (x + 4, feet - body height - 9), which is y - 17 for the 24 px body and 1 px clear of the hair (round 2, was y - 10, which covered the head), instead of behind the back. Reference:

```
..1111..
.1v2111.
1211v211
12214221
5ssssss5
.5tttt5.
..5555..
........
```

Rule: at least 6 `1` pixels, and at least twice as many `1` and `t` pixels as `v`, `s` and `u` together.

**Charcoal icon.** None exists (the charcoal shop row has no icon and the chips are meat only), so none is added.

**The other new art:**

- **`piece_sausage`, `piece_chicken`, `piece_ribs`, `piece_butt`, `piece_brisket`: 10x10, 5 frames** (frame 4 added; 0 raw, 1 cooking, 2 done, 3 burnt keep their indexes). Frame 4, about to burn: the done shape charred at the rim, the outline `1`, the meat cells next to the outline `2` umber, the lit edge `2` and the shade side `1`, so a black and umber band rings a red `r` center; no check mark (so done and about to burn read apart at a glance), two `v` wisp pixels above the meat. Round 2 deepened the char (round 1 only swapped the outline to a mix of `1` and `5`); a thin piece whose band would leave under 4 `r` cells (the sausage) chars only the cells beside the outline on its row, so it never reads as the burnt frame. It has at least 4 more `1` pixels than frame 2. Sausage reference:

```
....v..v..
.11111111.
12rrrrrr21
12rrrrrr11
.11111111.
.11111111.
12rrrrrr21
12rrrrrr11
.11111111.
..........
```

- **`arrow`: 8x12, 4 frames.** A chunky gold arrow (`k` fill, one `h` glint, `5` outline), 8 wide and 9 tall: frames 0 and 1 point down, frame 1 is frame 0 moved 2 px down (the bob toward the target); frames 2 and 3 point up and are frames 0 and 1 mirrored top to bottom. Reference frame 0 (rows 9 to 11 empty):

```
..5555..
..5hk5..
..5kk5..
..5kk5..
555kk555
5kkkkkk5
.5kkkk5.
..5kk5..
...55...
```

- **`bubble_warn`: 8x10, 2 frames.** Round 2: a red card (`o`, `5` outline, one cream `3` glint on the lit top left corner, a short tail at the bottom center) with a white `h` "!" in frame 0, and a yellow `k` card with a dark `5` "!" in frame 1. Round 1's cream card with an orange blink matched the cream and orange YOUR PIT sign above kettle 1 and read as part of it. Reference frame 0:

```
.555555.
53ooooo5
5oohhoo5
5oohhoo5
5oohhoo5
5oooooo5
5oohhoo5
5oooooo5
.555o55.
....5...
```

- **`font`: 4x6, 40 frames.** Frame 38 is `.` (one cream pixel at row 5, column 1) and frame 39 is `,` (row 4 column 1 and row 5 column 0). `art.text` maps `.` to 38 and `,` to 39; `art.textWidth` counts them as glyphs. Every other mapping is unchanged. The banner needs them; the tinted font strips (Art deviation) gain the two frames too.

Totals: 115 names (113 plus `arrow` and `bubble_warn`), 281 frames (268 plus 4, 2, 5 piece frames and 2 font frames). Palette 32, legend unchanged.

---

## 5. New constants

```js
// PitSim.C, added
WARN_FRAC: 0.4,               // the warning stage is the last 40 percent of a done window
HOT_BURN_MULT: 1.0,           // done pieces advance at this rate in the hot band (cooking keeps HOT_MULT 1.2)
TUTORIAL_FIRE_FLOOR: 30,      // decay stops here during the tutorial (FIRE_LOW_WARN, so no fire_low or fire_out)
TUTORIAL_END_S: 6,            // sim seconds the last banner shows before the tutorial ends
SAVE_VERSION: 3,              // was 2
// PitSim.C.FX, added
ARROW_BOB_S: 0.3,             // arrow frames swap every 0.3 s of the effect clock
WARN_BLINK_S: 0.25            // bubble_warn frames swap every 0.25 s
```

`MEATS` windows are section 3.1. Nothing else in `C` moves.

## 6. Acceptance for Joel's next play

- A new game opens on the clipboard with the tutorial line, a pulsing Open the yard and a Skip tutorial button; one tap opens the yard.
- From there the banner and the bouncing arrow lead through charcoal, light, meat, put on, pull, slice and plate without a word of other help; tapping in the wrong order still ends at the right instruction.
- The gate opens the moment the first plate lands, one customer walks in, sits, eats, tips, and the banner says you have the hang of it; then the day runs as v2, about 80 s of it left.
- Nothing burns during the tutorial and nobody walks out.
- After the tutorial a sausage left on the kettle shows the charred frame, the "!" bubble, darker smoke and Pull it now, and only burns 5.6 s after that.
- The pile reads as a heap of black briquettes beside a paper sack, the hand holds a black scoop, both at 2x next to the black kettle.
- A v2 save loads straight into its morning with no tutorial.
- Controls is a button on the clipboard and the pause panel and never opens by itself.
