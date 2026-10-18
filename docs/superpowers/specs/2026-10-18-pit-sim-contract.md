# Pit sim, backyard rung: module contract

**Date:** 2026-10-18
**Design spec:** `docs/superpowers/specs/2026-10-18-pit-sim-design.md` (the rules). This document is the interface between three files written at the same time by three builders who do not talk. Where this document and the design spec disagree on a name or a signature, this document wins; where they disagree on a rule of play, the design spec wins and the builder notes it under Deviations in their own file header.
**Files:** `games/pit-sim/index.html` (written with this contract, shared shell), `games/pit-sim/sprites.js` (builder A), `games/pit-sim/sim.js` (builder B), `games/pit-sim/game.js` (builder C), `games/pit-sim/dev/smoke.mjs` (harness, never shipped), optionally `games/pit-sim/dev/sheet.html` (sprite sheet viewer, never shipped).
**Load order:** `sprites.js`, `sim.js`, `game.js`, each with `defer`, in that order, from `index.html`. Deferred scripts run in document order after parsing, so `game.js` may assume both other modules are present on `window.PitSim` when it runs.
**Law:** implement every name below with the exact signature and semantics. Add nothing to the shared surface without listing it under a `// Deviations` comment at the top of your file. Never read another module's internals (anything not named here). Never edit a file you do not own.

Every rule of play (numbers, step order, order rule, pull order, strings) lives in the design spec and is not repeated here unless the interface needs it. Section references in brackets, for example [spec 5.2], point there.

---

## 0. Conventions used in this document

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

Every script begins, after `'use strict';`, with this line and nothing else that touches the global:

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

`state.clock` advances only in `step()` while `phase === 'service'` and `paused === false`. Prep is `clock < C.GATE_OPENS`; the gate is open from `GATE_OPENS` to `LAST_CALL`; the day ends when `clock >= C.DAY_SECONDS`, or when `clock >= C.LAST_CALL` and no customer remains in the yard in mode `arriving` or `waiting` [spec 3]. Day end runs the till (section 2.7.5) and sets `phase = 'evening'`.

#### 2.5.3 Fixed step

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

Customers walk at `C.NPC_TILES_PER_S` along fixed routes, no BFS, no collision:

- Arriving: from `MAP.custSpawn` straight down column 6 to `(6, 5)`, then along row 5 to the reserved spot's x. `queueIndex` is the spot reserved at spawn; `wait` starts the first time the customer reaches their reserved spot, and a spot passed through on the way does not count.
- Shift forward: along row 5 to the new spot.
- Leaving (`served`, `walkout`, `close`): pause `LEAVE_TURN_SECONDS` facing up, then straight up their own column to row 1, along row 1 to x = 6, up through the gate to `custSpawn`, then removed from `customers`. A served customer gets `hop = 0.3` at the moment of serving and `mood = 'happy'`; a walkout leaves with `mood = 'unhappy'`; close leaves with `mood = 'neutral'`.
- Passing: down column 6 to `MAP.passStop`, pause `C.WALK_PAST_PAUSE`, then back up and out, removed at `custSpawn`. `queueIndex` is `-1` throughout.

The buddy loops idle at `MAP.buddyIdle` facing left, BFS to `(6, 7)` facing up, back [spec 5.8]. The tender idles at `MAP.tenderIdle` facing right, grabs from the pile (adjacent, no walk), BFS to the nearest active use tile of the cooker needing fire, adds, returns [spec 5.9]. Their pixel positions follow the same `Mover` fields as the player.

### 2.6 Sim methods

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

Spawn, order, patience, tip, rep: [spec 6]. The order roll, patience roll, body variant and jitter all draw from `sim.rng()` in this order per spawn: interval jitter, patience, order branch, order weight. Walk past is decided at spawn against `queueSpots = gear.bigtable ? QUEUE_SPOTS_BIG : QUEUE_SPOTS` minus customers with `queueIndex >= 0`.

#### 2.7.5 Day end

In this order, once, when the end condition of section 2.5.2 holds: close out customers still in line (`reason: 'close'`, `today.close`), compute `grateLeft` and `grateCost` from pieces still on cookers (unit cost each, burnt pieces included here and not in waste), compute waste from board and table plates (`unit / plates` per plate, rounded to the nearest integer per plate, summed) plus burnt pieces already trashed during the day (unit cost each; `wasteBurnt` counts those), compute wages from `buddy`/`tender` presence, apply rep with the clamp, then cash: `cash = max(C.CASH_FLOOR, cash - wages - C.DAILY_COSTS)` (revenue and tips were added at each serve). Then spoilage: without `gear.cooler`, every raw unit is lost at unit cost into `spoilCost` and `spoiled`, stock zeroed; with the cooler, stock carries. Then `day += 1`, `stats.days += 1`, `yesterday = { served, walkouts, past }`, `till` is built from `today`, `phase = 'evening'`, emit `day_over` and `save_wanted { reason: 'till' }`. Pieces on the grate are not trashed events; they are simply gone when the next day opens.

### 2.8 Save format and `PitSim.validateSave(obj)`

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

`SPRITES[name] = { w, h, frames }` where `frames` is an array and each frame is an array of `h` strings of length `w`. Example of a 4 by 3, two frame sprite:

```js
coin: { w: 4, h: 3, frames: [
  ['0550', '5335', '0550'],
  ['0500', '0530', '0500']
] }
```

### 3.4 Required sprite list

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
| `pile` | 16 by 16 | 4 | full (bags over 6), half (3 to 6), low (1 to 2), bare (0) |
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

- Every 16 by 16 person sprite stands on its bottom row; feet at `py + 15`.
- Station sprites fill their tile; the drum fills two tiles tall.
- Plate stacks on the table draw at `(tile px + 4, tile py + 3)`, each further plate 1 px higher, up to 6. On the board, stacks draw at `(px + 1, py + 3)`, `(px + 8, py + 3)`, `(px + 1, py + 9)`, `(px + 8, py + 9)` for stack index 0 to 3, each up to 8 plates.
- Grate pieces draw at `station px + slotPx[i].x, station py + slotPx[i].y` (section 2.3.2).

---

## 4. `game.js` responsibilities

### 4.1 Boot

`game.js` runs on `DOMContentLoaded` (it is deferred, so it may also run at once when `document.readyState !== 'loading'`). In order:

1. `PitSim.art.build()`. If it throws, write the message to `#status`, log it, and stop.
2. Read the save: `localStorage.getItem(PitSim.SAVE_KEY)` in try/catch; `JSON.parse` in try/catch; `PitSim.validateSave(parsed)`; any failure yields `null`. A `localStorage` access that throws sets `saveOff = true` and queues the status line `Saving is off in this browser.` once for 4 s.
3. `sim = PitSim.createSim(validated, seed)` where `seed` is the integer in the `?seed=` query parameter when present and finite, else undefined. (The harness passes a seed for repeatable runs.)
4. Build the DOM inside the shell's containers (section 4.4), set up the canvas (section 4.2), attach input (section 4.5), show the clipboard or the Broke card, pump the events once, start the `requestAnimationFrame` loop.
5. Expose `PitSim.game` (section 4.10).

Frame loop: `dt = Math.min(PitSim.C.MAX_FRAME_DT, (now - last) / 1000)`; `sim.step(dt)`; pump events (`drainEvents` to aria-live, saves, panels, pops); render; schedule the next frame. On `visibilitychange` to hidden during service: `sim.setPaused(true)` and open the pause panel; the clock is reset on the next visible frame so no big `dt` arrives.

### 4.2 Canvas

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

- Pointer: `pointerdown` on `#cv` (and `touchstart` with `preventDefault` to stop double tap zoom) maps client coordinates to the tile: `tx = floor((clientX - rect.left) / rect.width * 13)`, `ty = floor((clientY - rect.top) / rect.height * 15)`, then `sim.walkTo(tx, ty)`. Ignored while a panel is open.
- `#act` click: `sim.interact()`.
- Chips click: `sim.selectMeat(id)`.
- Keyboard, `keydown` on `document`: while no panel is open, Arrow keys and WASD call `sim.move(dir)` on each keydown and are added to a held set; each frame, every held direction key calls `sim.move` again (the sim ignores it mid step, so repeat runs at the walk speed); `keyup` removes it. Space and E call `sim.interact()`. Digits 1 to 5 call `selectMeat` by `MEATS[m].key`. Q and Shift+Q call `cycleMeat(1)` and `cycleMeat(-1)`. Escape and P toggle pause during service. `preventDefault` only for these keys and only when handled. While a panel is open: Escape on `#pause` resumes, Escape on `#newgame` acts as Keep playing, Escape elsewhere does nothing; every other key is left to the browser.
- Arriving at a station by tap runs the auto action inside the sim (section 2.5.5); `game.js` does nothing extra on arrival.

### 4.6 Status line

`#status` shows one message by the precedence of [spec 14.3]: `Saving is off in this browser.` (4 s at load, once) > `Can't get there` (1.5 s after `blocked`) > `Gate opens in {n}` (prep, `n = ceil(GATE_OPENS - clock)`) > `Last call` (3 s after `last_call`) > `sim.holding()`.

### 4.7 Events to aria-live and saves

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

`matchMedia('(prefers-reduced-motion: reduce)')`, read at boot and on change. When it matches: no smoke sprites, no shake, coin pops hold still for 600 ms, no served hop (`hop` is ignored), rain is a flat band with no streaks, `fire` shows frame 0, no idle bobbing. Walking frames, cooking arcs, patience bars and gauges still animate [spec 17]. Panels never animate in either mode.

### 4.9 Strings owned by `game.js`

Every string from [spec 18] that is not in `PitSim.STRINGS` or produced by a sim method, spelled exactly as the spec writes it: the header words, the status line forms, the clipboard lines, the shop section headings (`Meat`, `Charcoal`, `Gear`, `Hires`), `Daily costs: ice and trash bags, 10.`, `Game numbers. Not real prices and not a cooking guide.`, the till lines of [spec 9] including `Food, charcoal and spoilage were paid at the shop. They are listed so you can see where the money went.`, the pause, confirm, Broke and Coming next texts of [spec 11 and 12], and the Controls list. Star string: `'★'.repeat(round(rep / 20)) + '☆'.repeat(5 - round(rep / 20))`.

### 4.10 `PitSim.game`

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

Written with this contract at `games/pit-sim/index.html`. It is the shell every builder targets and nobody edits. Contents, in order: `<!doctype html>`, `html lang="en"`, head with `charset`, `viewport width=device-width, initial-scale=1`, `title` `Your Pit`, `description` meta, `color-scheme dark`, `theme-color #1b1714`, one inline `<style>`, three `<script defer>` tags for `./sprites.js`, `./sim.js`, `./game.js`; body with the skeleton of section 4.4, static text only in `#title` and `#foot`, the `noscript` line `This game runs in your browser and needs JavaScript turned on.`, the visually hidden `#live`. Zero inline script, zero inline handlers, no external resource, no dash characters.

The inline style defines: a reset (`box-sizing: border-box`, zero margins), the palette as custom properties on `:root` (`--k`, `--u`, `--c`, `--o`, `--y`, `--m`, `--h`, `--i`), body cream on near black in `ui-monospace, Menlo, Consolas, monospace`, the single column layout with 16 px gutters and the 44 px header, `#wrap` as a centered near black letterbox, `#status` at 24 px, `#act` 48 px tall full width orange with near black text, `#chips` as five equal buttons at least 44 px tall, panel sections as umber boxes with hairline borders over an 85 percent near black scrim, the two column layout at 900 px and up with a 320 px right column holding `#panels` inline, `button` defaults (44 px minimum, orange primary, umber secondary via `.alt`), focus ring 2 px gold with a 2 px offset, `.sr` visually hidden, `[hidden] { display: none !important }`, `.muted`, `.row`, `.card`, `.dl` classes `game.js` may use, and a `@media (prefers-reduced-motion: reduce)` block that disables transitions (there are none anyway).

Class names `game.js` may rely on: `.primary`, `.alt`, `.muted`, `.row` (a shop or till row, flex, space between), `.card` (the Coming next card), `.chip`, `.sr`, `.stars`. Anything else `game.js` needs it styles with inline `style` properties set through the CSSOM (`el.style.x = ...`), which the CSP allows.

---

## 7. Decisions made where the spec was silent

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
