// games/pit-sim/sim.js
// Pit sim, backyard rung: the whole game as pure state and rules. No DOM, no canvas, no timers,
// no browser storage. Randomness only through the seeded generator on the sim object. Runs in
// Node under vm.runInThisContext and in the browser as a classic deferred script.
//
// Contract: docs/superpowers/specs/2026-10-18-pit-sim-contract.md (the v2.1 section K0 to K12
//           first, then the v2 delta D0 to D10, then section 2 read with v2 coordinates).
// Rules:    docs/superpowers/specs/2026-10-18-pit-sim-v2-1-tutorial.md (sections 2, 3 and 5),
//           then docs/superpowers/specs/2026-10-18-pit-sim-design.md, top section "v2" first.
//
// Version: v2.1 (2026-10-18, late). Guided tutorial on day 1, wider done windows with a warning
//          stage, a hot fire that no longer burns faster, save version 3. v2 underneath: 11 by 12
//          yard, seats, decor and charm.
//
// Deviations
// 1. (Now the contract rule, section 1 as corrected; kept so the numbers below stay stable.) The
//    file body is wrapped in a function expression so `const PitSim` is not a global lexical
//    binding shared with the other two scripts.
// 2. The buddy's handling pause (C.BUDDY_HANDLE) is also used as the fire tender's grab and add
//    pause, since the spec gives the tender no handling number of its own.
// 3. The Coming next test (drum owned and cash at or above the driveway price) is re-evaluated
//    after a gear purchase as well as at the start of a morning, so buying the drum with 1000 or
//    more left shows the card that same morning.
// 4. buy() on a meat or charcoal line also caps the line so that stock plus cart stays at or
//    under C.STEPPER_MAX, so serialize() always round trips through validateSave unchanged.
// 5. continueFromBroke() returns true whenever it is morning and the Broke test is false now,
//    whether or not state.broke is still set, because sell() updates state.broke itself after
//    each sale (as the contract says) and would otherwise leave nothing for Keep going to do.
// 6. Fire decay lands once per whole second of each cooker's own timer, reset by a bag, instead
//    of a fraction every tick: same rate, and a fresh light reads exactly FIRE_LIGHT for one
//    second, which the harness's settle and check needs.
// 7. interact() on a row the table marks as no-op returns { ok: false, verb, message } with
//    message equal to the row label, as the contract says; outside service, paused or while
//    slicing it returns ok false with verb and message equal to the verbAt() label in effect.
// 8. Sold out (clock at or past GATE_OPENS, no stock, no raw or done piece on any grate, nothing
//    on the board or table, no slice running, nothing but charcoal or a burnt piece in anyone's
//    hands) closes out the line and stops arrivals on every such tick (v2: V2.5 step 9); the day
//    ends on the first such tick with no customer in toSeat or eating.
// 9. Order rule 4 never invents a meat. A hands rule orders from what the player or the buddy is
//    carrying; when nothing is anywhere rollOrder returns null and the customer walks to the pass
//    stop and leaves at no cost, with walk_past { id, reason: 'soldout' } ('full' otherwise).
// 10. A slice that finishes hands the player the first plate (or two with the tray) from the
//    stack chooseBoardStack() picks, so the next tap is not always Take.
// 11. walkTo() during a slice stores the tap in state.player.queued ({ tx, ty }), returns true
//    and emits tap_queued (no payload); the walk starts the tick the slice completes.
// 12. On a day 1 morning with an empty cooler and no charcoal the cart starts at 3 sausage,
//    2 chicken and 5 bags instead of empty, so the first screen has a sensible default.
// 13. sim.expectedCrowd() returns round((LAST_CALL - GATE_OPENS) / spawnInterval()) for today's
//    rep and weather.
// 14. (Now contract D2.) C carries PATIENCE_MID_FRAC 0.5 and GEAR_RESERVE 30.
// 15. Retired in v2: grate slot pixels are contract D4's slotPx again.
// 16. v2: a mover carries the distance left over after reaching a tile into the next tile of its
//    path within the same tick. At 6 tiles a second a step is 4.8 px and a tile is 16 px, so
//    snapping to the tile and dropping the rest (the v1 mover) would walk at 5 tiles a second.
//    NPCs at 4 tiles a second (3.2 px, 5 ticks a tile) move exactly as before.
// 17. v2: at the hard end, after the seat bonuses are paid with atClose true, every customer still
//    in toSeat or eating is set to leaving (reason 'seated', mood happy, seat freed, route to the
//    spawn), so no customer is left in toSeat or eating once the till is up. The yard is frozen
//    in the evening, so they do not walk; the next open clears the yard.
// 18. v2: a passing customer keeps reason null, as v1 shipped it ('past' stays unused).
// 19. v2: player and customer walkability are computed from state on every call (no cached grid),
//    so they always follow state.gear and state.decor.
// 20. v2: the dog is not in the sim (contract D0 and D14: it lives in game.js as PitSim.game.dog).
//    The sim gives it MAP.dogHome, MAP.dogRoam and sim.custWalkable(x, y, -1, -1).
// 21. Integration, 2026-10-18 (now contract D4): (5,1) is dropped from the use tiles of kettle1
//    and the cooler. It sits in a closed pocket with (4,1), boxed in by the shed, the pile,
//    kettle 1, the cooler and the back fence, so no BFS could ever reach it. Play is unchanged.
// 22. Review round 1, 2026-10-18 (now contract D4 and D2): four props fill dead pavers. woodpile2
//    (4,1) and woodpile3 (5,1) close the pocket of deviation 21 so it no longer reads as empty
//    floor; planter2 (1,4) and shelf (2,3) fill a dead end and a spare tile in the cook area. With
//    every gear and decor state, every station use tile, buddyIdle and tenderIdle stay reachable
//    from the spawn. C.FX: NUMBER_S 1.4, NUMBER_FADE_AT 1.0, NUMBER_RISE_PX 14, TIP_GAP_PX 11
//    (the cash and tip pills no longer overlap), HEART_S 1.4, HEART_RISE_PX 12. Cosmetic only.
// 23. Review round 2, 2026-10-18 (now contract D4 and D2): three more props fill dead tiles. pot3
//    (4,8) sits in the lawn nook between the two picnic tables, pot4 (2,2) under the shed window
//    and woodpile4 (9,4) by the right fence; none is a seat, footprint, queue, spawn, idle or use
//    tile, and every seat still reaches the customer spawn with every gear and decor state. (4,8)
//    leaves MAP.dogRoam. C.FX.TIP_GAP_PX is -11, so the tip number stacks above the cash number.
//    KETTLE_SLOT_PX is (0,-7) (6,-7): the two grate pieces stay inside the kettle's 16 px and
//    overlap 4 px in the middle. Cosmetic only; no rule or economy number changed.
// 24. v2.1: skipTutorial() in service on a latched step (customer, seated or end) sets
//    spawnAt = min(spawnAt, clock) instead of plain clock. On customer and seated spawnAt is
//    Infinity, so it is the contract's clock; on end it keeps the normal arrival already timed
//    instead of spawning a second customer on the next tick.
// 25. v2.1: createSim(saved) runs the tutorial from a save only when saved.tutorial.done is false
//    and saved.day is 1, the same test validateSave applies, so an unvalidated object passed in
//    by hand cannot start the tutorial on a later day.
// 26. v2.1: the latched steps are checked in a loop, so if two latch conditions are met in the
//    same check (a to go serve sets served and togo together) the sim emits tutorial_step for
//    seated and then for end in that one call, never skipping an id.
// 27. v2.1: no shop line names a done window ([T 3.5]), so CATALOG text is unchanged.

(function () {
'use strict';
const PitSim = globalThis.PitSim || (globalThis.PitSim = {});

// ---------------------------------------------------------------------------------------------
// 2.1 Constants (contract 2.1 with the v2 delta D2)
// ---------------------------------------------------------------------------------------------

const C = Object.freeze({
  // day and world
  DAY_SECONDS: 125, GATE_OPENS: 30, LAST_CALL: 110,
  START_CASH: 80, START_REP: 20,
  WALK_TILES_PER_S: 6, NPC_TILES_PER_S: 4,
  TICK_SECONDS: 0.05, MAX_FRAME_DT: 0.05,
  // fire
  FIRE_LIGHT: 60, COLD_UNDER: 10, FIRE_ADD: 30, FIRE_MAX: 100,
  KETTLE_DECAY: 1.0, DRUM_DECAY: 0.6, KETTLE_SLOTS: 2, DRUM_SLOTS: 4,
  FIRE_GOOD: 50, FIRE_HOT: 85, HOT_MULT: 1.2,
  FIRE_LOW_WARN: 30, TENDER_THRESHOLD: 55, TENDER_CYCLE: 4,
  CHARCOAL_PRICE: 2,
  // v2.1 burn warning and tutorial ([T 5], contract K2)
  WARN_FRAC: 0.4,                     // the warning stage is the last 40 percent of a done window
  HOT_BURN_MULT: 1.0,                 // done pieces advance at this rate in the hot band (cooking keeps HOT_MULT)
  TUTORIAL_FIRE_FLOOR: 30,            // decay stops here during the tutorial (FIRE_LOW_WARN)
  TUTORIAL_END_S: 6,                  // sim seconds the last banner shows before the tutorial ends
  // customers
  SPAWN_MAX: 13, SPAWN_MIN: 5, SPAWN_JITTER_LO: 0.85, SPAWN_JITTER_HI: 1.15,
  PATIENCE_BASE: 45, PATIENCE_SPREAD: 10, PATIENCE_WARN_FRAC: 0.2, PATIENCE_MID_FRAC: 0.5,
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
  DRIVEWAY_PRICE: 1000, GEAR_RESERVE: 30,
  // weather
  RAIN_FROM_DAY: 4, RAIN_CHANCE: 0.15, RAIN_ARRIVALS: 0.6,
  // save clamps
  SAVE_VERSION: 3, MAX_DAY: 999, MAX_CASH: 999999, MAX_STAT: 9999999,
  // seating and charm [V2.5], [V2.6]
  EAT_MIN: 8, EAT_MAX: 12,            // seconds a seated customer eats: EAT_MIN + (EAT_MAX - EAT_MIN) * rng()
  HEART_SECONDS: 0.6,                 // seated pause after the bonus is paid, before standing up
  SEAT_BONUS_BASE: 1, SEAT_BONUS_MAX: 3,
  CHARM_STEP: 10, CHARM_MAX: 30,      // seatBonus = min(MAX, BASE + floor(charm / STEP)); repMax = REP_DAY_MAX + floor(charm / STEP)
  REP_TOGO_QUICK: 1,                  // word of mouth for a quick serve taken to go
  // cues the sim does not act on but game.js reads [V2.9]
  SWEAT_FRAC: 0.25,                   // sweat drop at or under this fraction of patience, mode 'waiting' only
  ZZZ_AFTER: 3,                       // sim clock seconds the buddy spends in task 'idle' before zzz
  FX: Object.freeze({
    NUMBER_S: 1.4, NUMBER_RISE_PX: 14, NUMBER_FADE_AT: 1.0, TIP_GAP_PX: -11,
    SPARKLE_S: 0.45, SPARKLE_FRAME_S: 0.15, SPARKLE_STAGGER_S: 0.05,
    HEART_S: 1.4, HEART_FRAME_S: 0.4, HEART_RISE_PX: 12, HEART_FADE_S: 0.3,
    EAT_FRAME_S: 0.35,
    PUFF_EVERY_LOW: 0.9, PUFF_EVERY_GOOD: 0.45, PUFF_EVERY_HOT: 0.3,
    PUFF_LIFE_MIN: 1.1, PUFF_LIFE_MAX: 1.4, PUFF_RISE_PX_S: 8, PUFF_DRIFT_PX_S: 3,
    BURNT_BURST_S: 0.5, BURNT_RISE_PX_S: 12, SHAKE_MS: 120,
    BURNT_COLUMN_EVERY: 0.35, BURNT_COLUMN_LIFE: 1.2, BURNT_COLUMN_RISE_PX_S: 10, BURNT_COLUMN_SWAY_PX: 2,
    SWEAT_EVERY: 1.2, SWEAT_SLIDE_S: 0.6, SWEAT_SLIDE_PX: 3, SWEAT_SPLASH_S: 0.15,
    ZZZ_FRAME_S: 0.5, ZZZ_DRIFT_PX: 4,
    SQUASH_S: 0.12,
    WALKOUT_MARK_S: 0.6, TAP_RING_S: 0.35, FIRE_FPS: 6, TWINKLE_S: 0.5,
    BIRD_SHOW_S: 2, BIRD_GAP_MIN: 8, BIRD_GAP_MAX: 14,
    DOG_TILES_PER_S: 2, DOG_WAIT_MIN: 2, DOG_WAIT_SPREAD: 3,
    NOTICE_S: 4,
    ARROW_BOB_S: 0.3, WARN_BLINK_S: 0.25
  })
});

const SAVE_KEY = 'hs.pitsim.save';
const SERVED_HOP = 0.3;

// ---------------------------------------------------------------------------------------------
// 2.2 Meats (sausage 14 and chicken 22, contract D2 and [V2.19] item 1; v2.1 windows [T 3.1])
// ---------------------------------------------------------------------------------------------

const MEAT_IDS = Object.freeze(['sausage', 'chicken', 'ribs', 'butt', 'brisket']);

const MEATS = Object.freeze({
  sausage: Object.freeze({ id: 'sausage', label: 'Sausage', plateLabel: 'Sausage', unit: 4, plates: 2, cook: 14, window: 14, price: 5, slots: 1, slice: 3, drumOnly: false, key: '1' }),
  chicken: Object.freeze({ id: 'chicken', label: 'Chicken thighs', plateLabel: 'Chicken thighs', unit: 6, plates: 2, cook: 22, window: 16, price: 8, slots: 1, slice: 4, drumOnly: false, key: '2' }),
  ribs: Object.freeze({ id: 'ribs', label: 'Pork ribs', plateLabel: 'Pork ribs', unit: 12, plates: 3, cook: 32, window: 18, price: 11, slots: 1, slice: 5, drumOnly: false, key: '3' }),
  butt: Object.freeze({ id: 'butt', label: 'Pork butt', plateLabel: 'Pulled pork', unit: 20, plates: 5, cook: 40, window: 22, price: 14, slots: 2, slice: 6, drumOnly: false, key: '4' }),
  brisket: Object.freeze({ id: 'brisket', label: 'Brisket', plateLabel: 'Brisket', unit: 38, plates: 7, cook: 50, window: 26, price: 18, slots: 2, slice: 7, drumOnly: true, key: '5' })
});

const GEAR_IDS = Object.freeze(['kettle2', 'cooler', 'bigtable', 'tray', 'canopy', 'drum']);
const DECOR_IDS = Object.freeze(['chair1', 'chair2', 'flowers', 'birdbath', 'lights', 'picnic2']);
const SEAT_IDS = Object.freeze(['pt1b', 'pt1a', 'chair1', 'chair2', 'pt2b', 'pt2a']);
const HIRE_IDS = Object.freeze(['buddy', 'tender']);
const COOKER_IDS = Object.freeze(['kettle1', 'kettle2', 'drum']);
const STAT_IDS_V1 = Object.freeze(['days', 'served', 'walkouts', 'past', 'burnt']);
const STAT_IDS = Object.freeze(['days', 'served', 'walkouts', 'past', 'burnt', 'seated']);
const GOAL_ORDER = Object.freeze(['kettle2', 'buddy', 'bigtable', 'drum', 'driveway']);
const DIRS = Object.freeze({
  up: Object.freeze({ dx: 0, dy: -1 }),
  down: Object.freeze({ dx: 0, dy: 1 }),
  left: Object.freeze({ dx: -1, dy: 0 }),
  right: Object.freeze({ dx: 1, dy: 0 })
});
const DIR_ORDER = Object.freeze(['up', 'down', 'left', 'right']);

// ---------------------------------------------------------------------------------------------
// D4 Map (replaces contract 2.3)
// ---------------------------------------------------------------------------------------------

const MAP_W = 11;
const MAP_H = 12;
const GRID_H = MAP_H + 1;   // BFS rows: the map plus row 12, where only the customer spawn (9,12) lives
const TILE = 16;
const T = Object.freeze({ PAVER: 0, FENCE: 1, GATE: 2, LAWN: 3, HEDGE: 4, BED: 5 });

// Ground only, row by row, [V2.2] and contract D4. P paver, F fence, G gate, L lawn, H hedge, B bed.
const GROUND_ROWS = Object.freeze([
  'FPPPFFFFFFF',   // y0: (1..3, 0) are pavers under the shed, which blocks them
  'FPPPPPPPPPF',   // y1
  'FPPPPPPPPPF',   // y2
  'FPPPPPPPPPF',   // y3
  'FPPPPPPPPPF',   // y4
  'FPPPPPPPPPF',   // y5
  'FHHHHPPPHHF',   // y6: (4,6) (8,6) hedge under the light posts; (5,6) (6,6) (7,6) pavers under the counter
  'FBLLLLLLLLF',   // y7
  'FBLLLLLLLLF',   // y8
  'FBLLLLLLLLF',   // y9
  'FBBBBBBLLLF',   // y10: (7,10) (8,10) lawn under the decor flower bed footprint
  'FFFFFFFFFGF'    // y11: (8,11) fence with the mailbox prop over it
]);
const GROUND_CHAR = Object.freeze({ P: T.PAVER, F: T.FENCE, G: T.GATE, L: T.LAWN, H: T.HEDGE, B: T.BED });

function buildTiles() {
  const tiles = new Array(MAP_W * MAP_H);
  for (let y = 0; y < MAP_H; y++) {
    for (let x = 0; x < MAP_W; x++) tiles[y * MAP_W + x] = GROUND_CHAR[GROUND_ROWS[y][x]];
  }
  return Object.freeze(tiles);
}

function xy(x, y, extra) {
  const o = { x, y };
  if (extra) Object.assign(o, extra);
  return Object.freeze(o);
}
function use(x, y, face, gear) {
  const o = { x, y, face };
  if (gear) o.gear = gear;
  return Object.freeze(o);
}
function px(x, y) { return Object.freeze({ x, y }); }
function list(a) { return Object.freeze(a); }

const KETTLE_SLOT_PX = list([px(0, -7), px(6, -7)]);
const DRUM_SLOT_PX = list([px(-2, -4), px(8, -4), px(-2, 7), px(8, 7)]);

// Stations, in the v1 order with v1 ids and types and the v2 data of [V2.3] and contract D4.
const STATIONS = list([
  Object.freeze({ id: 'kettle1', type: 'cooker', label: 'Kettle 1', spoken: 'kettle 1', gear: null,
    tiles: list([xy(5, 2)]),
    use: list([use(6, 2, 'left'), use(5, 3, 'up')]),
    slots: C.KETTLE_SLOTS, decay: C.KETTLE_DECAY,
    sprite: 'kettle', draw: px(80, 24), sortRow: 2, slotPx: KETTLE_SLOT_PX }),
  Object.freeze({ id: 'kettle2', type: 'cooker', label: 'Kettle 2', spoken: 'kettle 2', gear: 'kettle2',
    tiles: list([xy(7, 2)]),
    use: list([use(6, 2, 'right'), use(8, 2, 'left'), use(7, 1, 'down')]),
    slots: C.KETTLE_SLOTS, decay: C.KETTLE_DECAY,
    sprite: 'kettle', draw: px(112, 24), sortRow: 2, slotPx: KETTLE_SLOT_PX }),
  Object.freeze({ id: 'drum', type: 'cooker', label: 'Drum smoker', spoken: 'the drum', gear: 'drum',
    tiles: list([xy(7, 3), xy(7, 4)]),
    use: list([use(6, 3, 'right'), use(6, 4, 'right'), use(8, 3, 'left'), use(8, 4, 'left'), use(7, 5, 'up')]),
    slots: C.DRUM_SLOTS, decay: C.DRUM_DECAY,
    sprite: 'drum', draw: px(112, 48), sortRow: 4, slotPx: DRUM_SLOT_PX }),
  Object.freeze({ id: 'board', type: 'board', label: 'Cutting board', spoken: '', gear: null,
    tiles: list([xy(5, 4)]),
    use: list([use(6, 4, 'left'), use(5, 3, 'down'), use(5, 5, 'up'), use(4, 4, 'right')]),
    sprite: 'board', draw: px(80, 64), sortRow: 4 }),
  Object.freeze({ id: 'cooler', type: 'cooler', label: 'Cooler', spoken: '', gear: null,
    tiles: list([xy(6, 1)]),
    use: list([use(6, 2, 'up'), use(7, 1, 'left')]),
    sprite: 'cooler', draw: px(96, 16), sortRow: 1 }),
  Object.freeze({ id: 'table', type: 'table', label: 'Serving table', spoken: '', gear: null,
    tiles: list([xy(6, 6), xy(7, 6), xy(5, 6, { gear: 'bigtable' })]),
    use: list([use(6, 5, 'down'), use(7, 5, 'down'), use(5, 5, 'down', 'bigtable')]),
    sprite: 'counter', draw: px(96, 88), sortRow: 6,
    spotPx: list([px(98, 92), px(108, 92), px(118, 92), xy(88, 92, { gear: 'bigtable' }), xy(80, 92, { gear: 'bigtable' })]) }),
  Object.freeze({ id: 'pile', type: 'pile', label: 'Charcoal pile', spoken: '', gear: null,
    tiles: list([xy(4, 2)]),
    use: list([use(4, 3, 'up')]),
    sprite: 'pile', draw: px(64, 32), sortRow: 2 }),
  Object.freeze({ id: 'trash', type: 'trash', label: 'Trash', spoken: '', gear: null,
    tiles: list([xy(3, 4)]),
    use: list([use(4, 4, 'left'), use(3, 3, 'down'), use(3, 5, 'up'), use(2, 4, 'right')]),
    sprite: 'trash', draw: px(48, 64), sortRow: 4 })
]);

function prop(id, sprite, frame, tx, ty, dx, dy, blocks, sortRow) {
  return Object.freeze({ kind: 'prop', id, sprite, frame, tile: px(tx, ty), draw: px(dx, dy),
    blocks: list(blocks.map((b) => px(b[0], b[1]))), sortRow });
}

// Fixed props, [V2.2.2] and contract D4, in this order.
const PROPS = list([
  prop('shed', 'shed', 0, 1, 1, 16, 0, [[1, 0], [2, 0], [3, 0], [1, 1], [2, 1], [3, 1]], 1),
  prop('sign', 'sign', 0, 4, 0, 68, 2, [], 0),
  prop('tree', 'tree', 0, 9, 2, 128, 0, [[9, 2]], 2),
  prop('woodpile', 'woodpile', 0, 9, 1, 144, 16, [[9, 1]], 1),
  prop('tools', 'tools', 0, 1, 2, 16, 24, [[1, 2]], 2),
  prop('pot1', 'pot', 0, 1, 3, 16, 48, [[1, 3]], 3),
  prop('pot2', 'pot', 0, 9, 3, 144, 48, [[9, 3]], 3),
  prop('hose', 'hose', 0, 1, 5, 16, 80, [[1, 5]], 5),
  prop('planter', 'planter', 0, 9, 5, 144, 72, [[9, 5]], 5),
  prop('mailbox', 'mailbox', 0, 8, 11, 128, 168, [], 11),
  prop('picnic1', 'picnic', 0, 5, 9, 80, 136, [[5, 9], [6, 9]], 9),
  prop('bench1', 'picnic_bench', 0, 5, 8, 80, 136, [], 8),
  prop('woodpile2', 'woodpile', 0, 4, 1, 64, 16, [[4, 1]], 1),
  prop('woodpile3', 'woodpile', 0, 5, 1, 80, 16, [[5, 1]], 1),
  prop('planter2', 'planter', 0, 1, 4, 16, 56, [[1, 4]], 4),
  prop('shelf', 'shelf', 0, 2, 3, 32, 40, [[2, 3]], 3),
  prop('pot3', 'pot', 0, 4, 8, 64, 128, [[4, 8]], 8),
  prop('pot4', 'pot', 0, 2, 2, 32, 32, [[2, 2]], 2),
  prop('woodpile4', 'woodpile', 0, 9, 4, 144, 64, [[9, 4]], 4)
]);

function decorDraw(sprite, frame, x, y, sortRow, overhead) {
  const o = { sprite, frame, x, y, sortRow };
  if (overhead) o.overhead = true;
  return Object.freeze(o);
}
function decorSpot(id, tiles, blocks, seats, draws) {
  return Object.freeze({ kind: 'decor', id,
    tiles: list(tiles.map((t) => px(t[0], t[1]))),
    blocks: list(blocks.map((t) => px(t[0], t[1]))),
    seats: list(seats.slice()), draws: list(draws) });
}

// Decor spots, [V2.7] and contract D4, in DecorId order.
const DECOR = list([
  decorSpot('chair1', [[7, 9]], [], ['chair1'], [decorDraw('chair', 0, 112, 136, 9)]),
  decorSpot('chair2', [[8, 9]], [], ['chair2'], [decorDraw('chair', 0, 128, 136, 9)]),
  decorSpot('flowers', [[7, 10], [8, 10]], [[7, 10], [8, 10]], [],
    [decorDraw('bed', 0, 112, 156, 10), decorDraw('bed', 1, 128, 156, 10)]),
  decorSpot('birdbath', [[4, 9]], [[4, 9]], [], [decorDraw('birdbath', 0, 64, 136, 9)]),
  decorSpot('lights', [[4, 6], [8, 6]], [], [],
    [decorDraw('lights_post', 0, 64, 80, 6), decorDraw('lights_post', 0, 128, 80, 6), decorDraw('lights_string', 0, 71, 80, 6, true)]),
  decorSpot('picnic2', [[2, 9], [3, 9]], [[2, 9], [3, 9]], ['pt2b', 'pt2a'],
    [decorDraw('picnic_bench', 0, 32, 136, 8), decorDraw('picnic', 0, 32, 136, 9)])
]);

function seat(id, x, y, decor) {
  return Object.freeze({ kind: 'seat', id, x, y, face: 'down', decor });
}

// Seats, [V2.2.4] and contract D4, in SeatId order. Every seat faces down.
const SEATS = list([
  seat('pt1b', 6, 8, null),
  seat('pt1a', 5, 8, null),
  seat('chair1', 7, 9, 'chair1'),
  seat('chair2', 8, 9, 'chair2'),
  seat('pt2b', 3, 8, 'picnic2'),
  seat('pt2a', 2, 8, 'picnic2')
]);

const STATION_BY_ID = Object.freeze(STATIONS.reduce((acc, s) => { acc[s.id] = s; return acc; }, {}));
const SEAT_BY_ID = Object.freeze(SEATS.reduce((acc, s) => { acc[s.id] = s; return acc; }, {}));
const TILES = buildTiles();

// Tiles a fixed prop blocks, for everyone. Static.
const PROP_BLOCKED = (function () {
  const a = new Uint8Array(MAP_W * MAP_H);
  for (const p of PROPS) for (const b of p.blocks) a[b.y * MAP_W + b.x] = 1;
  return a;
})();

const MAP = Object.freeze({
  W: MAP_W, H: MAP_H, TILE,
  T,
  tiles: TILES,
  at(x, y) {
    if (!(x >= 0 && x < MAP_W && y >= 0 && y < MAP_H)) return T.FENCE;
    return TILES[y * MAP_W + x];
  },
  stripe(x) { return (x & 1) === 0 ? 'a' : 'b'; },
  stations: STATIONS,
  station(id) { return STATION_BY_ID[id]; },
  props: PROPS,
  decor: DECOR,
  seats: SEATS,
  SEAT_ORDER: SEAT_IDS,
  spawn: Object.freeze({ x: 6, y: 3, face: 'up' }),
  gate: px(9, 11),
  custSpawn: px(9, 12),
  passStop: px(9, 10),
  queue: list([
    Object.freeze({ x: 7, y: 7, face: 'up', gear: null }),
    Object.freeze({ x: 8, y: 7, face: 'left', gear: null }),
    Object.freeze({ x: 9, y: 7, face: 'left', gear: null }),
    Object.freeze({ x: 9, y: 8, face: 'up', gear: 'bigtable' }),
    Object.freeze({ x: 9, y: 9, face: 'up', gear: 'bigtable' })
  ]),
  buddyIdle: Object.freeze({ x: 4, y: 5, face: 'up' }),
  tenderIdle: Object.freeze({ x: 3, y: 2, face: 'right' }),
  dogHome: px(4, 7),
  dogRoam: list([px(2, 7), px(3, 7), px(4, 7), px(5, 7), px(6, 7), px(7, 8), px(8, 8)]),
  overhead: Object.freeze({ lights: px(71, 80), canopy: px(76, 106) }),
  signText: px(70, 5)
});

// Contract D4: works on stations, footprint tiles, use tiles, queue entries and seats. The v1
// two argument call still works for every entry without a decor field.
function tileOwned(entry, gear, decor) {
  return (!entry.gear || gear[entry.gear] === true)
    && (!entry.decor || (decor !== undefined && decor !== null && decor[entry.decor] === true));
}

// ---------------------------------------------------------------------------------------------
// 2.4 Catalog (contract 2.4 with D5)
// ---------------------------------------------------------------------------------------------

function row(id, kind, label, price, effect, needs, needsText, sets) {
  return Object.freeze({ id, kind, label, price, effect, needs: needs ? Object.freeze(needs) : null, needsText, sets });
}
function decorRow(id, label, price, seats, charm, effect, needs, needsText, sets) {
  return Object.freeze({ id, kind: 'decor', label, price, effect, needs: needs ? Object.freeze(needs) : null, needsText, sets, seats, charm });
}

const CATALOG = Object.freeze([
  row('sausage', 'meat', 'Sausage', 4, 'Sausage: 2 plates a unit, quickest cook, sells for 5.', null, '', 'cart.meat.sausage, then stock.sausage on open'),
  row('chicken', 'meat', 'Chicken thighs', 6, 'Chicken thighs: 2 plates, 22 seconds on good fire, sells for 8.', null, '', 'cart.meat.chicken'),
  row('ribs', 'meat', 'Pork ribs', 12, 'Pork ribs: 3 plates, 32 seconds, sells for 11.', null, '', 'cart.meat.ribs'),
  row('butt', 'meat', 'Pork butt', 20, 'Pork butt: 5 plates of pulled pork, 40 seconds, both grate slots, sells for 14.', null, '', 'cart.meat.butt'),
  row('brisket', 'meat', 'Brisket', 38, 'Brisket: 7 plates, 50 seconds on the drum, sells for 18.', { gear: 'drum' }, 'Needs the drum smoker.', 'cart.meat.brisket'),
  row('charcoal', 'fuel', 'Charcoal', 2, 'One bag lights a cold cooker to 60 or adds 30 to a lit one. A kettle burns through about five bags a day. Bags left over keep.', null, '', 'cart.charcoal, then charcoal on open'),
  row('kettle2', 'gear', 'Second kettle', 90, 'Two more grate slots. Twice the meat on the fire.', null, '', 'gear.kettle2, stations.kettle2 becomes active'),
  row('cooler', 'gear', 'Cooler', 60, 'Raw meat keeps overnight instead of spoiling.', null, '', 'gear.cooler'),
  row('bigtable', 'gear', 'Bigger table', 70, 'Five people can wait instead of three, and five plate spots instead of three.', null, '', 'gear.bigtable, table.spots grows to 5, queue spots 4 and 5 activate'),
  row('tray', 'gear', 'Serving tray', 50, 'Carry two plates at a time.', null, '', 'gear.tray'),
  row('canopy', 'gear', 'Canopy', 80, 'Rain days run at full crowd.', null, '', 'gear.canopy'),
  row('drum', 'gear', 'Drum smoker', 280, 'Four grate slots, holds heat longer, and the only cooker that takes brisket.', { gear: 'kettle2' }, 'Needs the second kettle.', 'gear.drum, stations.drum active, brisket and tender rows unlock'),
  decorRow('chair1', 'Lawn chair', 25, 1, 3, 'One more seat by the line. Charm 3.', null, '', 'decor.chair1, seat chair1'),
  decorRow('chair2', 'Second lawn chair', 25, 1, 3, 'One more seat by the line. Charm 3.', { decor: 'chair1' }, 'Needs the first lawn chair.', 'decor.chair2, seat chair2'),
  decorRow('flowers', 'Flower bed', 30, 0, 4, 'Flowers along the fence by the gate. Charm 4.', null, '', 'decor.flowers'),
  decorRow('birdbath', 'Bird bath', 40, 0, 4, 'Birds stop by between the tables. Charm 4.', null, '', 'decor.birdbath'),
  decorRow('lights', 'String lights', 60, 0, 10, 'Lights strung over the serving table. Charm 10.', null, '', 'decor.lights'),
  decorRow('picnic2', 'Second picnic table', 80, 2, 6, 'Two more seats on the lawn. Charm 6.', null, '', 'decor.picnic2, seats pt2b and pt2a'),
  row('buddy', 'hire', 'Buddy', 20, 'Runs plates from the board to the table so you can stay on the fire. Paid each evening.', { day: 2 }, 'From day 2.', 'hires.buddy'),
  row('tender', 'hire', 'Fire tender', 30, "Keeps every cooker above 55 as long as there are bags in the pile. Buy about seven bags a cooker when he's on.", { gear: 'drum' }, 'Needs the drum smoker.', 'hires.tender'),
  row('driveway', 'goal', 'Driveway pop-up', 1000, 'The next rung. Not built in this prototype.', { gear: 'drum' }, 'Needs the drum smoker.', 'nothing; goal line and Coming next card only')
]);

const CATALOG_BY_ID = Object.freeze(CATALOG.reduce((acc, r) => { acc[r.id] = r; return acc; }, {}));

// ---------------------------------------------------------------------------------------------
// 2.10 Strings (with decorLabel, D5)
// ---------------------------------------------------------------------------------------------

const STRINGS = Object.freeze({
  cooker: Object.freeze({ kettle1: 'kettle 1', kettle2: 'kettle 2', drum: 'the drum' }),
  cookerLabel: Object.freeze({ kettle1: 'Kettle 1', kettle2: 'Kettle 2', drum: 'Drum smoker' }),
  hire: Object.freeze({ buddy: 'the buddy', tender: 'the fire tender' }),
  hireLabel: Object.freeze({ buddy: 'Buddy', tender: 'Fire tender' }),
  gearLabel: Object.freeze({ kettle2: 'Second kettle', cooler: 'Cooler', bigtable: 'Bigger table', tray: 'Serving tray', canopy: 'Canopy', drum: 'Drum smoker', driveway: 'Driveway pop-up' }),
  decorLabel: Object.freeze({ chair1: 'Lawn chair', chair2: 'Second lawn chair', flowers: 'Flower bed', birdbath: 'Bird bath', lights: 'String lights', picnic2: 'Second picnic table' }),
  walk: 'Walk', handsFull: 'Hands full', nothing: 'Nothing to do here', slicing: 'Slicing',
  cantGetThere: "Can't get there", handsEmpty: 'Hands empty',
  gateOpensIn: 'Gate opens in ', lastCall: 'Last call',
  // v2.1 ([T 2.2], [T 3.3], contract K8)
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
});

// Hands full while carrying plates: name where they go instead (round 2 finding).
const PLATES_GO = 'Plates go on the table';
function fullLabel(c) { return c !== null && c.kind === 'plates' ? PLATES_GO : STRINGS.handsFull; }

// ---------------------------------------------------------------------------------------------
// 2.7.3 Fire helpers (pure)
// ---------------------------------------------------------------------------------------------

function fireBand(fire) {
  if (fire < C.COLD_UNDER) return 'out';
  if (fire < C.FIRE_GOOD) return 'low';
  if (fire < C.FIRE_HOT) return 'good';
  return 'hot';
}

function fireMult(fire) {
  const band = fireBand(fire);
  if (band === 'out') return 0;
  if (band === 'low') return fire / C.FIRE_GOOD;
  if (band === 'good') return 1.0;
  return C.HOT_MULT;
}

// [T 3.2]: the rate a done piece advances toward burnt. Hot no longer burns faster.
function burnMult(fire) {
  return fireBand(fire) === 'hot' ? C.HOT_BURN_MULT : fireMult(fire);
}

// ---------------------------------------------------------------------------------------------
// D9 and K6 Save validation: accepts v 1, 2 and 3, always returns v 3
// ---------------------------------------------------------------------------------------------

function isPlainObject(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

function readKey(obj, key) {
  try { return isPlainObject(obj) ? obj[key] : undefined; } catch (e) { return undefined; }
}

function toInt(v, def, lo, hi) {
  let n;
  try { n = Number(v); } catch (e) { n = NaN; }
  if (typeof n !== 'number' || !Number.isFinite(n)) n = def;
  n = Math.trunc(n);
  if (n < lo) n = lo;
  if (n > hi) n = hi;
  return n;
}

function toBool(v) {
  return v === true;
}

function validateSave(obj) {
  try {
    if (!isPlainObject(obj)) return null;
    const v = readKey(obj, 'v');
    if (v !== 1 && v !== 2 && v !== 3) return null;
    const out = { v: C.SAVE_VERSION };
    out.day = toInt(readKey(obj, 'day'), 1, 1, C.MAX_DAY);
    out.cash = toInt(readKey(obj, 'cash'), C.START_CASH, 0, C.MAX_CASH);
    out.rep = toInt(readKey(obj, 'rep'), C.START_REP, 0, 100);
    const stockIn = readKey(obj, 'stock');
    out.stock = {};
    for (const m of MEAT_IDS) out.stock[m] = toInt(readKey(stockIn, m), 0, 0, C.STEPPER_MAX);
    out.charcoal = toInt(readKey(obj, 'charcoal'), 0, 0, C.STEPPER_MAX);
    const gearIn = readKey(obj, 'gear');
    out.gear = {};
    for (const g of GEAR_IDS) out.gear[g] = toBool(readKey(gearIn, g));
    if (!out.gear.kettle2) out.gear.drum = false;
    // A v1 save had no decor, so it migrates with none.
    const decorIn = v >= 2 ? readKey(obj, 'decor') : undefined;
    out.decor = {};
    for (const d of DECOR_IDS) out.decor[d] = toBool(readKey(decorIn, d));
    if (!out.decor.chair1) out.decor.chair2 = false;
    const hiresIn = readKey(obj, 'hires');
    out.hires = {};
    for (const h of HIRE_IDS) out.hires[h] = toBool(readKey(hiresIn, h));
    if (!out.gear.drum) out.hires.tender = false;
    if (!out.gear.drum) out.stock.brisket = 0;
    const statsIn = readKey(obj, 'stats');
    out.stats = {};
    for (const s of STAT_IDS_V1) out.stats[s] = toInt(readKey(statsIn, s), 0, 0, C.MAX_STAT);
    out.stats.seated = v >= 2 ? toInt(readKey(statsIn, 'seated'), 0, 0, C.MAX_STAT) : 0;
    out.drivewayShown = toBool(readKey(obj, 'drivewayShown'));
    // [T 2.8]: only a version 3 day 1 save can still owe the tutorial. v1 and v2 players have played.
    const tutIn = v === 3 ? readKey(obj, 'tutorial') : undefined;
    const owed = isPlainObject(tutIn) && readKey(tutIn, 'done') === false && out.day === 1;
    out.tutorial = { done: !owed };
    return out;
  } catch (e) {
    return null;
  }
}

// ---------------------------------------------------------------------------------------------
// Small pure helpers used by the sim
// ---------------------------------------------------------------------------------------------

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function clamp(n, lo, hi) { return n < lo ? lo : (n > hi ? hi : n); }
function zeroByMeat() { const o = {}; for (const m of MEAT_IDS) o[m] = 0; return o; }
function emptySeats() { const o = {}; for (const s of SEAT_IDS) o[s] = null; return o; }
function sumValues(o) { let s = 0; for (const k in o) s += o[k]; return s; }
function cheapestUnit() {
  let best = Infinity;
  for (const m of MEAT_IDS) if (!MEATS[m].drumOnly && MEATS[m].unit < best) best = MEATS[m].unit;
  return best;
}
function quickestInStock(stock) {
  let best = null;
  for (const m of MEAT_IDS) {
    if (stock[m] > 0 && (best === null || MEATS[m].cook < MEATS[best].cook)) best = m;
  }
  return best;
}
function plateWaste(meat) { return Math.round(MEATS[meat].unit / MEATS[meat].plates); }

// ---------------------------------------------------------------------------------------------
// 2.5 createSim
// ---------------------------------------------------------------------------------------------

function createSim(saved, seed) {
  const seedUsed = (seed === undefined || seed === null || !Number.isFinite(Number(seed)))
    ? (Date.now() >>> 0)
    : (Math.trunc(Number(seed)) >>> 0);
  const rng = mulberry32(seedUsed);

  const state = {};
  const events = [];
  let acc = 0;              // step accumulator in seconds
  let tickCount = 0;        // ticks since openGate, drives state.clock
  let pieceSeq = 0;         // piece ids within the day
  let custSeq = 0;          // customer ids within the day
  let buddyPick = null;     // meat reserved by the buddy during his pickup
  let gateOpenFired = false;
  const decayAcc = { kettle1: 0, kettle2: 0, drum: 0 };   // seconds since each cooker's last whole second of decay
  let tutEndAt = null;      // clock at which the end step runs out (K1: internal, never saved)
  let tutLastId = null;     // last (id, target) pair emitted as tutorial_step
  let tutLastTarget = null;

  function emit(type, payload) {
    const e = { type };
    if (payload) Object.assign(e, payload);
    events.push(e);
  }

  // ---- state construction -------------------------------------------------------------------

  function newMover(x, y, face) {
    return { x, y, px: x * TILE, py: y * TILE, face, next: null, path: [], walking: false, anim: 0 };
  }

  function newCooker(id) {
    const st = STATION_BY_ID[id];
    return { id, fire: 0, slots: st.slots, pieces: [], lowWarned: true, outFired: true };
  }

  function newToday() {
    return {
      revenue: 0, tips: 0, foodCost: 0, bags: 0, wages: 0, spoilCost: 0, wasteCost: 0, wastePlates: 0, wasteBurnt: 0, grateCost: 0,
      customers: 0, served: 0, walkouts: 0, past: 0, close: 0, happy: 0, ok: 0, burnt: 0,
      seated: 0, togo: 0, togoQuick: 0, seatTips: 0,
      spoiled: zeroByMeat(), grateLeft: zeroByMeat(),
      repStart: state.rep || C.START_REP,
      wageNames: []
    };
  }

  function tableSpotCount() {
    return state.gear.bigtable ? C.TABLE_SPOTS_BIG : C.TABLE_SPOTS;
  }

  function queueSpotCount() {
    return state.gear.bigtable ? C.QUEUE_SPOTS_BIG : C.QUEUE_SPOTS;
  }

  function newPlayer() {
    return Object.assign(newMover(MAP.spawn.x, MAP.spawn.y, MAP.spawn.face), { carrying: null, busy: null, target: null, queued: null });
  }

  function fillState(save) {
    for (const k of Object.keys(state)) delete state[k];
    const s = save || null;
    state.day = s ? s.day : 1;
    state.phase = 'morning';
    state.paused = false;
    state.broke = false;
    state.clock = 0;
    state.cash = s ? s.cash : C.START_CASH;
    state.rep = s ? s.rep : C.START_REP;
    state.stock = zeroByMeat();
    if (s) for (const m of MEAT_IDS) state.stock[m] = s.stock[m];
    state.charcoal = s ? s.charcoal : 0;
    state.gear = {};
    for (const g of GEAR_IDS) state.gear[g] = s ? s.gear[g] === true : false;
    state.decor = {};
    for (const d of DECOR_IDS) state.decor[d] = s && s.decor ? s.decor[d] === true : false;
    if (!state.decor.chair1) state.decor.chair2 = false;
    state.seats = emptySeats();
    state.hires = {};
    for (const h of HIRE_IDS) state.hires[h] = s ? s.hires[h] === true : false;
    state.stats = {};
    for (const k of STAT_IDS) {
      const v = s && s.stats ? Number(s.stats[k]) : 0;
      state.stats[k] = Number.isFinite(v) ? v : 0;
    }
    state.drivewayShown = s ? s.drivewayShown === true : false;
    // [T 2.1]: a new game runs the tutorial; a save runs it only when it still owes it (deviation 25).
    const owed = !s || (isPlainObject(s.tutorial) && s.tutorial.done === false && s.day === 1);
    state.tutorial = owed ? { step: 'open', done: false } : { step: null, done: true };
    state.rain = false;
    state.comingNext = false;
    state.yesterday = null;
    state.cart = { meat: zeroByMeat(), charcoal: 0 };
    state.selected = 'sausage';
    state.spawnAt = Infinity;
    state.arrivals = 0;
    state.lastCallFired = false;
    state.gateSoonFired = false;
    state.stations = {
      kettle1: newCooker('kettle1'),
      kettle2: newCooker('kettle2'),
      drum: newCooker('drum'),
      board: { stacks: [], slicing: null },
      table: { spots: new Array(tableSpotCount()).fill(null) }
    };
    state.player = newPlayer();
    state.buddy = null;
    state.tender = null;
    state.customers = [];
    state.today = newToday();
    state.till = null;
    acc = 0;
    tickCount = 0;
    pieceSeq = 0;
    custSeq = 0;
    buddyPick = null;
    gateOpenFired = false;
    tutEndAt = null;
    tutLastId = null;
    tutLastTarget = null;
  }

  // ---- grid and walkability ([V2.2.1]) ------------------------------------------------------

  function inMap(x, y) {
    return x >= 0 && x < MAP_W && y >= 0 && y < MAP_H;
  }

  function stationActive(st) {
    return tileOwned(st, state.gear);
  }

  // The active station whose active footprint holds (x, y), or null.
  function stationAt(x, y) {
    for (const st of STATIONS) {
      if (!stationActive(st)) continue;
      for (const t of st.tiles) {
        if (t.x === x && t.y === y && tileOwned(t, state.gear)) return st;
      }
    }
    return null;
  }

  function activeUseTiles(st) {
    return st.use.filter((u) => tileOwned(u, state.gear));
  }

  // Player, buddy and tender: ground PAVER, no fixed prop, no active station tile.
  function walkable(x, y) {
    x = Math.trunc(Number(x));
    y = Math.trunc(Number(y));
    if (!inMap(x, y)) return false;
    if (TILES[y * MAP_W + x] !== T.PAVER) return false;
    if (PROP_BLOCKED[y * MAP_W + x] === 1) return false;
    return stationAt(x, y) === null;
  }

  function decorOwned(id) {
    return state.decor[id] === true;
  }

  // A blocking tile of an owned decor footprint.
  function decorBlocks(x, y) {
    for (const d of DECOR) {
      if (!decorOwned(d.id)) continue;
      for (const b of d.blocks) if (b.x === x && b.y === y) return true;
    }
    return false;
  }

  function ownedSeatAt(x, y) {
    for (const s of SEATS) {
      if (s.x === x && s.y === y && tileOwned(s, state.gear, state.decor)) return s;
    }
    return null;
  }

  // Customers: the spawn, or ground LAWN or GATE; no fixed prop; no blocking tile of owned decor;
  // no owned seat tile unless it is the BFS goal (gx, gy). The dog calls it with (-1, -1).
  function custWalkable(x, y, gx, gy) {
    x = Math.trunc(Number(x));
    y = Math.trunc(Number(y));
    if (!Number.isFinite(x) || !Number.isFinite(y)) return false;
    if (x === MAP.custSpawn.x && y === MAP.custSpawn.y) return true;
    if (!inMap(x, y)) return false;
    const g = TILES[y * MAP_W + x];
    if (g !== T.LAWN && g !== T.GATE) return false;
    if (PROP_BLOCKED[y * MAP_W + x] === 1) return false;
    if (decorBlocks(x, y)) return false;
    if (ownedSeatAt(x, y) !== null && !(x === gx && y === gy)) return false;
    return true;
  }

  // Breadth first search, 4 directions, neighbor order up, down, left, right. `goal(x, y)` ends
  // the search; `passable(x, y)` says whether a tile may be entered. The grid has one row below
  // the map so the customer spawn (9,12) can be reached. Returns the path after the start tile
  // (array of {x, y}), [] when the start is a goal, or null.
  function bfs(sx, sy, goal, passable) {
    if (goal(sx, sy)) return [];
    if (!(sx >= 0 && sx < MAP_W && sy >= 0 && sy < GRID_H)) return null;
    const n = MAP_W * GRID_H;
    const prev = new Int16Array(n).fill(-1);
    const seen = new Uint8Array(n);
    const queue = [];
    const startIdx = sy * MAP_W + sx;
    seen[startIdx] = 1;
    queue.push(startIdx);
    let head = 0;
    while (head < queue.length) {
      const idx = queue[head++];
      const cx = idx % MAP_W;
      const cy = (idx - cx) / MAP_W;
      for (const d of DIR_ORDER) {
        const nx = cx + DIRS[d].dx;
        const ny = cy + DIRS[d].dy;
        if (!(nx >= 0 && nx < MAP_W && ny >= 0 && ny < GRID_H)) continue;
        const nIdx = ny * MAP_W + nx;
        if (seen[nIdx]) continue;
        if (!passable(nx, ny)) continue;
        seen[nIdx] = 1;
        prev[nIdx] = idx;
        if (goal(nx, ny)) {
          const path = [];
          let cur = nIdx;
          while (cur !== startIdx) {
            const px2 = cur % MAP_W;
            path.push({ x: px2, y: (cur - px2) / MAP_W });
            cur = prev[cur];
          }
          path.reverse();
          return path;
        }
        queue.push(nIdx);
      }
    }
    return null;
  }

  function playerBfs(sx, sy, goal) {
    return bfs(sx, sy, goal, walkable);
  }

  function nearestWalkableTo(x, y) {
    let best = null;
    let bestD = Infinity;
    for (let ty = 0; ty < MAP_H; ty++) {
      for (let tx = 0; tx < MAP_W; tx++) {
        if (!walkable(tx, ty)) continue;
        const d = Math.abs(tx - x) + Math.abs(ty - y);
        if (d < bestD) { bestD = d; best = { x: tx, y: ty }; }
      }
    }
    return best;
  }

  function faceToward(fromX, fromY, toX, toY) {
    if (toX > fromX) return 'right';
    if (toX < fromX) return 'left';
    if (toY > fromY) return 'down';
    return 'up';
  }

  // ---- charm ([V2.6], D7) -------------------------------------------------------------------

  function charm() {
    let sum = 0;
    for (const d of DECOR_IDS) if (decorOwned(d)) sum += CATALOG_BY_ID[d].charm;
    return Math.min(C.CHARM_MAX, sum);
  }

  function seatBonus() {
    return Math.min(C.SEAT_BONUS_MAX, C.SEAT_BONUS_BASE + Math.floor(charm() / C.CHARM_STEP));
  }

  function seatCount() {
    let n = 2;
    for (const d of DECOR_IDS) if (decorOwned(d)) n += CATALOG_BY_ID[d].seats;
    return n;
  }

  function repMax() {
    return C.REP_DAY_MAX + Math.floor(charm() / C.CHARM_STEP);
  }

  // ---- movers -------------------------------------------------------------------------------

  // Advance a mover along its path at `speed` tiles per second for `dt` seconds. Distance left
  // over after reaching a tile carries into the next tile of the path (deviation 16).
  // Returns true when at least one tile step completed this call.
  function advanceMover(m, speed, dt) {
    if (m.next === null && m.path.length === 0) {
      m.walking = false;
      m.anim = 0;
      return false;
    }
    let budget = speed * TILE * dt;
    let arrived = false;
    m.anim += dt;
    while (budget > 1e-9) {
      if (m.next === null) {
        if (m.path.length === 0) break;
        m.next = m.path.shift();
        m.face = faceToward(m.x, m.y, m.next.x, m.next.y);
      }
      const tx = m.next.x * TILE;
      const ty = m.next.y * TILE;
      const dx = tx - m.px;
      const dy = ty - m.py;
      const dist = Math.abs(dx) + Math.abs(dy);
      if (dist <= budget + 1e-6) {
        m.px = tx;
        m.py = ty;
        m.x = m.next.x;
        m.y = m.next.y;
        m.next = null;
        arrived = true;
        budget -= dist;
      } else {
        if (dx !== 0) m.px += Math.sign(dx) * budget;
        else m.py += Math.sign(dy) * budget;
        budget = 0;
      }
    }
    if (m.next === null && m.path.length === 0) {
      m.walking = false;
      m.anim = 0;
    } else {
      m.walking = true;
    }
    return arrived;
  }

  function moverAnchor(m) {
    return m.next ? m.next : { x: m.x, y: m.y };
  }

  function playerIdle() {
    return state.phase === 'service' && !state.paused && state.player.busy === null;
  }

  // ---- 2.5.5 tap to walk and keyboard --------------------------------------------------------

  function walkTo(tx, ty) {
    tx = Math.trunc(Number(tx));
    ty = Math.trunc(Number(ty));
    if (state.phase === 'service' && !state.paused && state.player.busy !== null) {
      // Mid slice: keep the last tap and start it the tick the slice completes.
      if (!inMap(tx, ty)) { emit('blocked'); return false; }
      state.player.queued = { tx, ty };
      emit('tap_queued');
      return true;
    }
    if (!playerIdle()) return false;
    const p = state.player;
    if (!inMap(tx, ty)) { emit('blocked'); return false; }
    const st = stationAt(tx, ty);
    const anchor = moverAnchor(p);
    if (st) {
      const uses = activeUseTiles(st);
      const onUse = p.next === null ? uses.find((u) => u.x === p.x && u.y === p.y) : null;
      if (onUse) {
        p.path = [];
        p.face = onUse.face;
        p.target = { station: st.id, auto: true };
        return true;
      }
      const path = playerBfs(anchor.x, anchor.y, (x, y) => uses.some((u) => u.x === x && u.y === y));
      if (path === null) { emit('blocked'); return false; }
      p.path = path;
      p.target = { station: st.id, auto: true };
      return true;
    }
    if (walkable(tx, ty)) {
      const path = playerBfs(anchor.x, anchor.y, (x, y) => x === tx && y === ty);
      if (path === null) { emit('blocked'); return false; }
      p.path = path;
      p.target = null;
      return true;
    }
    emit('blocked');
    return false;
  }

  function move(dir) {
    if (!playerIdle()) return false;
    if (!DIRS[dir]) return false;
    const p = state.player;
    p.path = [];
    p.target = null;
    p.face = dir;
    if (p.next !== null) return false;
    const nx = p.x + DIRS[dir].dx;
    const ny = p.y + DIRS[dir].dy;
    if (!walkable(nx, ny)) return false;
    p.next = { x: nx, y: ny };
    p.walking = true;
    return true;
  }

  // ---- 2.5.4 reach --------------------------------------------------------------------------

  function reach() {
    const p = state.player;
    const d = DIRS[p.face] || DIRS.up;
    const st = stationAt(p.x + d.dx, p.y + d.dy);
    return st ? st.id : null;
  }

  // When the player arrives on a use tile of the target station, face it.
  function faceTarget(st) {
    const p = state.player;
    const u = activeUseTiles(st).find((t) => t.x === p.x && t.y === p.y);
    if (u) { p.face = u.face; return; }
    // Not on a listed use tile: face the nearest footprint tile that is 4-adjacent, if any.
    for (const d of DIR_ORDER) {
      const s2 = stationAt(p.x + DIRS[d].dx, p.y + DIRS[d].dy);
      if (s2 && s2.id === st.id) { p.face = d; return; }
    }
  }

  // ---- hands, stacks, table -----------------------------------------------------------------

  function totalStock() { return sumValues(state.stock); }

  function freeSlotFor(cooker, size) {
    const taken = new Array(cooker.slots).fill(false);
    for (const p of cooker.pieces) {
      for (let i = 0; i < p.size; i++) taken[p.slot + i] = true;
    }
    for (let i = 0; i + size <= cooker.slots; i++) {
      let ok = true;
      for (let j = 0; j < size; j++) if (taken[i + j]) { ok = false; break; }
      if (ok) return i;
    }
    return -1;
  }

  // 5.2 pull order: burnt first by burn time, then overshoot fraction, then earliest put on.
  function pullCandidate(cooker) {
    let best = null;
    let bestKey = -Infinity;
    for (const p of cooker.pieces) {
      if (p.state === 'cooking') continue;
      const m = MEATS[p.meat];
      const key = p.state === 'burnt' ? 1 + (state.clock - p.burntAt) : (p.prog - m.cook) / m.window;
      if (best === null || key > bestKey || (key === bestKey && p.putOn < best.putOn)) {
        best = p;
        bestKey = key;
      }
    }
    return best;
  }

  function tableStackOf(meat) {
    for (const sp of state.stations.table.spots) {
      if (sp && sp.meat === meat && sp.times.length > 0) return sp;
    }
    return null;
  }

  function tableSpotIndexFor(meat) {
    const spots = state.stations.table.spots;
    for (let i = 0; i < spots.length; i++) {
      const sp = spots[i];
      if (sp && sp.meat === meat && sp.times.length < C.TABLE_STACK) return i;
    }
    for (let i = 0; i < spots.length; i++) if (spots[i] === null) return i;
    return -1;
  }

  function tableFits(meat) { return tableSpotIndexFor(meat) >= 0; }

  function boardStackOf(meat) {
    return state.stations.board.stacks.find((s) => s.meat === meat) || null;
  }

  function boardFits(meat, plates) {
    const existing = boardStackOf(meat);
    if (existing) return existing.times.length + plates <= C.BOARD_STACK;
    return state.stations.board.stacks.length < C.BOARD_STACKS && plates <= C.BOARD_STACK;
  }

  function lineCustomers() {
    return state.customers
      .filter((c) => c.queueIndex >= 0 && (c.mode === 'waiting' || c.mode === 'arriving'))
      .sort((a, b) => a.queueIndex - b.queueIndex);
  }

  function waitingCustomers() {
    return state.customers
      .filter((c) => c.queueIndex >= 0 && c.mode === 'waiting')
      .sort((a, b) => a.queueIndex - b.queueIndex);
  }

  // 5.2 and 5.3 stack rule: the stack a waiting customer ordered that is not on the table,
  // front of line first, else the oldest stack.
  function chooseBoardStack() {
    const stacks = state.stations.board.stacks;
    if (stacks.length === 0) return null;
    for (const c of waitingCustomers()) {
      const st = boardStackOf(c.want);
      if (st && !tableStackOf(c.want)) return st;
    }
    return stacks[0];
  }

  function takeFromBoardStack(stack, n) {
    const times = stack.times.splice(0, n);
    if (stack.times.length === 0) {
      const i = state.stations.board.stacks.indexOf(stack);
      if (i >= 0) state.stations.board.stacks.splice(i, 1);
    }
    return times;
  }

  function addToBoard(meat, times) {
    const existing = boardStackOf(meat);
    if (existing) existing.times.push(...times);
    else state.stations.board.stacks.push({ meat, times: times.slice() });
  }

  // ---- customers: routes ([V2.5] steps 1 and 11) ---------------------------------------------

  // Customer grid BFS from the customer's anchor tile to (gx, gy).
  function custRoute(c, gx, gy) {
    const a = moverAnchor(c);
    return bfs(a.x, a.y, (x, y) => x === gx && y === gy, (x, y) => custWalkable(x, y, gx, gy));
  }

  // Give a customer a new route and face its first step; mid step they keep facing the step in
  // progress, and with an empty route they keep their facing.
  function setRoute(c, path) {
    c.path = path;
    if (c.next === null && path.length > 0) c.face = faceToward(c.x, c.y, path[0].x, path[0].y);
  }

  function routeToSpot(c) {
    const spot = MAP.queue[c.queueIndex];
    setRoute(c, custRoute(c, spot.x, spot.y) || []);
  }

  // Leaving the yard: route to the spawn, optionally holding LEAVE_TURN_SECONDS first. An empty
  // route (no way out) removes the customer as soon as nothing holds them (moveCustomers).
  function sendOut(c, reason, mood, turnPause) {
    c.mode = 'leaving';
    c.reason = reason;
    c.mood = mood;
    c.eat = 0;
    c.pause = turnPause ? C.LEAVE_TURN_SECONDS : 0;
    setRoute(c, custRoute(c, MAP.custSpawn.x, MAP.custSpawn.y) || []);
  }

  // Remove a customer from the line and shift everyone behind forward one spot.
  function leaveLine(c) {
    const idx = c.queueIndex;
    c.queueIndex = -1;
    if (idx >= 0) {
      for (const o of state.customers) {
        if (o.queueIndex > idx) {
          o.queueIndex -= 1;
          if (o.mode === 'arriving' || o.mode === 'waiting') routeToSpot(o);
        }
      }
    }
  }

  // [V2.5] step 3: the first seat in SEAT_ORDER that is owned, free and reachable from the
  // customer's anchor tile by customer BFS. Returns { seat, path } or null.
  function pickSeat(c) {
    for (const id of SEAT_IDS) {
      const s = SEAT_BY_ID[id];
      if (!tileOwned(s, state.gear, state.decor)) continue;
      if (state.seats[id] !== null) continue;
      const path = custRoute(c, s.x, s.y);
      if (path !== null) return { seat: s, path };
    }
    return null;
  }

  // ---- serving ([V2.5] steps 3 to 7, D8) -----------------------------------------------------

  // Serve one customer from the table stack of their meat. Returns true when served.
  function serveFromTable(c) {
    const spots = state.stations.table.spots;
    let idx = -1;
    for (let i = 0; i < spots.length; i++) {
      if (spots[i] && spots[i].meat === c.want && spots[i].times.length > 0) { idx = i; break; }
    }
    if (idx < 0) return false;
    const sp = spots[idx];
    const sliced = sp.times.shift();
    if (sp.times.length === 0) spots[idx] = null;
    const m = MEATS[c.want];
    const frac = Math.min(1, c.wait / c.patienceMax);
    const plateAge = state.clock - sliced;
    const tip = Math.round(m.price * C.TIP_RATE * (1 - frac)) + (plateAge < C.HOT_PLATE_SECONDS ? C.HOT_PLATE_TIP : 0);
    const quick = c.wait < C.REP_QUICK_FRAC * c.patienceMax;
    state.cash += m.price + tip;
    state.today.revenue += m.price;
    state.today.tips += tip;
    state.today.served += 1;
    state.stats.served += 1;
    const spot = STATION_BY_ID.table.spotPx[idx];
    const pick = pickSeat(c);
    leaveLine(c);
    c.mood = 'happy';
    c.hop = SERVED_HOP;
    emit('served', { id: c.id, meat: c.want, price: m.price, tip, quick, x: spot.x, y: spot.y });
    if (pick !== null) {
      const id = pick.seat.id;
      state.seats[id] = c.id;
      c.seat = id;
      c.eatMax = C.EAT_MIN + (C.EAT_MAX - C.EAT_MIN) * rng();
      c.eat = 0;
      c.mode = 'toSeat';
      c.reason = null;
      c.pause = C.LEAVE_TURN_SECONDS;
      setRoute(c, pick.path);
      if (quick) state.today.happy += 1; else state.today.ok += 1;
      emit('seat_taken', { id: c.id, seat: id });
    } else {
      state.today.togo += 1;
      if (quick) state.today.togoQuick += 1; else state.today.ok += 1;
      sendOut(c, 'togo', 'happy', true);
      emit('to_go', { id: c.id });
    }
    return true;
  }

  function serveLine() {
    for (const c of waitingCustomers()) serveFromTable(c);
  }

  // Set down the plates in `hands` (a Carry of kind plates). Places what fits, serves anyone
  // waiting for that meat, repeats while plates remain and room opens. Returns plates placed.
  function setDown(hands) {
    let placed = 0;
    const spots = state.stations.table.spots;
    while (hands.times.length > 0) {
      const idx = tableSpotIndexFor(hands.meat);
      if (idx < 0) break;
      if (spots[idx] === null) spots[idx] = { meat: hands.meat, times: [] };
      const sp = spots[idx];
      while (hands.times.length > 0 && sp.times.length < C.TABLE_STACK) {
        sp.times.push(hands.times.shift());
        placed += 1;
      }
      serveLine();
    }
    return placed;
  }

  // 5.3 default selection: the meat a waiting customer ordered that is not cooking or plated,
  // else the quickest meat in stock. Only meats with stock count.
  function autoSelect() {
    const stock = state.stock;
    for (const c of waitingCustomers()) {
      const m = c.want;
      if (stock[m] <= 0) continue;
      let busy = tableStackOf(m) !== null || boardStackOf(m) !== null;
      if (!busy) {
        for (const id of COOKER_IDS) {
          if (state.stations[id].pieces.some((p) => p.meat === m && p.state !== 'burnt')) { busy = true; break; }
        }
      }
      if (!busy) { state.selected = m; return; }
    }
    const q = quickestInStock(stock);
    if (q !== null) state.selected = q;
  }

  function selectMeat(id) {
    if (!MEATS[id]) return false;
    if (!(state.stock[id] > 0)) return false;
    state.selected = id;
    return true;
  }

  function cycleMeat(delta) {
    const n = MEAT_IDS.length;
    const start = Math.max(0, MEAT_IDS.indexOf(state.selected));
    const d = delta < 0 ? -1 : 1;
    for (let i = 1; i <= n; i++) {
      const m = MEAT_IDS[(start + d * i + n * n) % n];
      if (state.stock[m] > 0) { state.selected = m; break; }
    }
    return state.selected;
  }

  function holding() {
    const c = state.player.carrying;
    if (c === null) return STRINGS.handsEmpty;
    if (c.kind === 'charcoal') return 'Holding: charcoal';
    const label = MEATS[c.meat].label;
    if (c.kind === 'plates') {
      const n = c.times.length;
      return 'Holding: ' + n + (n === 1 ? ' plate of ' : ' plates of ') + label;
    }
    return 'Holding: ' + c.kind + ' ' + label;
  }

  // ---- 5.2 the action table -----------------------------------------------------------------

  function noop(label, station) {
    return { label, enabled: false, auto: false, station, run: null };
  }
  function act(label, auto, station, run) {
    return { label, enabled: true, auto, station, run };
  }

  function trashCarry(carry) {
    const m = MEATS[carry.meat];
    if (carry.kind === 'plates') {
      state.today.wastePlates += carry.times.length;
      state.today.wasteCost += plateWaste(carry.meat) * carry.times.length;
    } else if (carry.kind === 'burnt') {
      state.today.wasteBurnt += 1;
      state.today.wasteCost += m.unit;
    } else if (carry.kind === 'cooked') {
      state.today.wastePlates += m.plates;
      state.today.wasteCost += m.unit;
    } else {
      state.today.wasteCost += m.unit;
    }
    emit('trash', { meat: carry.meat, kind: carry.kind });
  }

  function resolveAction() {
    const p = state.player;
    const id = reach();
    if (id === null) return noop(STRINGS.walk, null);
    const st = STATION_BY_ID[id];
    const c = p.carrying;
    const stationId = st.id;

    if (st.type === 'cooler') {
      if (c === null) {
        if (totalStock() === 0) return noop('Cooler is empty', stationId);
        if (!(state.stock[state.selected] > 0)) autoSelect();
        const m = state.selected;
        return act('Take ' + MEATS[m].label + ' (' + state.stock[m] + ' left)', true, stationId, () => {
          state.stock[m] -= 1;
          p.carrying = { kind: 'raw', meat: m };
          if (state.stock[m] === 0) autoSelect();
        });
      }
      if (c.kind === 'raw') {
        return act('Put ' + MEATS[c.meat].label + ' back', false, stationId, () => {
          state.stock[c.meat] += 1;
          p.carrying = null;
        });
      }
      return noop(fullLabel(c), stationId);
    }

    if (st.type === 'pile') {
      if (c === null) {
        if (state.charcoal <= 0) return noop('Out of charcoal', stationId);
        return act('Grab charcoal (' + state.charcoal + (state.charcoal === 1 ? ' bag)' : ' bags)'), true, stationId, () => {
          state.charcoal -= 1;
          state.today.bags += 1;
          p.carrying = { kind: 'charcoal' };
        });
      }
      return noop(fullLabel(c), stationId);
    }

    if (st.type === 'cooker') {
      const cooker = state.stations[st.id];
      if (c !== null && c.kind === 'charcoal') {
        const cold = cooker.fire < C.COLD_UNDER;
        return act(cold ? 'Light the fire' : 'Add charcoal', true, stationId, () => {
          addCharcoal(cooker);
          p.carrying = null;
        });
      }
      if (c !== null && c.kind === 'raw') {
        const m = MEATS[c.meat];
        if (m.drumOnly && st.id !== 'drum') return noop('Brisket needs the drum', stationId);
        const slot = freeSlotFor(cooker, m.slots);
        if (slot < 0) return noop('Grate is full', stationId);
        return act('Put ' + m.label + ' on', true, stationId, () => {
          pieceSeq += 1;
          cooker.pieces.push({ id: pieceSeq, meat: m.id, slot, size: m.slots, prog: 0, state: 'cooking', putOn: state.clock, burntAt: null, warn: false });
          state.today.foodCost += m.unit;
          p.carrying = null;
        });
      }
      if (c === null) {
        const pick = pullCandidate(cooker);
        if (pick) {
          const pullLabel = pick.state === 'done' && pick.warn === true ? STRINGS.pullNow : 'Pull ' + MEATS[pick.meat].label;
          return act(pullLabel, true, stationId, () => {
            const i = cooker.pieces.indexOf(pick);
            if (i >= 0) cooker.pieces.splice(i, 1);
            p.carrying = { kind: pick.state === 'burnt' ? 'burnt' : 'cooked', meat: pick.meat };
          });
        }
        if (cooker.pieces.length > 0) {
          let left = Infinity;
          for (const pc of cooker.pieces) left = Math.min(left, MEATS[pc.meat].cook - pc.prog);
          return noop('Not done yet (' + Math.max(1, Math.ceil(left)) + 's)', stationId);
        }
        return noop('Grate is empty', stationId);
      }
      return noop(fullLabel(c), stationId);
    }

    if (st.type === 'board') {
      const board = state.stations.board;
      if (c !== null && c.kind === 'cooked') {
        const m = MEATS[c.meat];
        if (!boardFits(c.meat, m.plates)) return noop('Board is full', stationId);
        return act('Slice ' + m.label, true, stationId, () => {
          p.busy = { what: 'slice', meat: m.id, t: 0, total: m.slice };
          board.slicing = { meat: m.id, t: 0, total: m.slice };
          p.carrying = null;
        });
      }
      if (c === null) {
        const stack = chooseBoardStack();
        if (!stack) return noop('Board is empty', stationId);
        const cap = state.gear.tray ? C.TRAY_PLATES : 1;
        const n = Math.min(cap, stack.times.length);
        const label = 'Take ' + MEATS[stack.meat].label + (n === 1 ? ' plate' : ' plates');
        return act(label, true, stationId, () => {
          const times = takeFromBoardStack(stack, n);
          p.carrying = { kind: 'plates', meat: stack.meat, times };
        });
      }
      if (c.kind === 'plates' && state.gear.tray && c.times.length === 1) {
        const stack = boardStackOf(c.meat);
        if (stack) {
          return act('Take 1 more ' + MEATS[c.meat].label + ' plate', true, stationId, () => {
            const times = takeFromBoardStack(stack, 1);
            c.times.push(...times);
          });
        }
        return noop(fullLabel(c), stationId);
      }
      if (c.kind === 'burnt') return noop("That's burnt. Trash it", stationId);
      return noop(fullLabel(c), stationId);
    }

    if (st.type === 'table') {
      if (c === null) return noop(STRINGS.nothing, stationId);
      if (c.kind === 'plates') {
        if (!tableFits(c.meat)) return noop('No room on the table', stationId);
        return act('Set down ' + MEATS[c.meat].label, true, stationId, () => {
          const meat = c.meat;
          const n = setDown(c);
          if (c.times.length === 0) p.carrying = null;
          emit('set_down', { meat, n });
        });
      }
      return noop(STRINGS.handsFull, stationId);
    }

    if (st.type === 'trash') {
      if (c === null || c.kind === 'charcoal') return noop(STRINGS.nothing, stationId);
      if (c.kind === 'burnt') {
        return act('Trash the burnt ' + MEATS[c.meat].label, true, stationId, () => {
          trashCarry(c);
          p.carrying = null;
        });
      }
      return act('Throw away ' + MEATS[c.meat].label, false, stationId, () => {
        trashCarry(c);
        p.carrying = null;
      });
    }

    return noop(c === null ? STRINGS.nothing : fullLabel(c), stationId);
  }

  function addCharcoal(cooker) {
    if (cooker.fire < C.COLD_UNDER) cooker.fire = C.FIRE_LIGHT;
    else cooker.fire = Math.min(C.FIRE_MAX, cooker.fire + C.FIRE_ADD);
    decayAcc[cooker.id] = 0;
    refreshFireFlags(cooker);
  }

  function refreshFireFlags(cooker) {
    if (cooker.fire >= C.FIRE_LOW_WARN) cooker.lowWarned = false;
    if (cooker.fire > 0) cooker.outFired = false;
  }

  function verbAt() {
    if (state.phase !== 'service' || state.paused) {
      return { label: STRINGS.walk, enabled: false, auto: false, station: null };
    }
    if (state.player.busy !== null) {
      return { label: STRINGS.slicing, enabled: false, auto: false, station: reach() };
    }
    const a = resolveAction();
    return { label: a.label, enabled: a.enabled, auto: a.auto, station: a.station };
  }

  // Runs the action in reach. `autoOnly` true (tap arrival) skips button only rows.
  function performAction(autoOnly) {
    const a = resolveAction();
    if (!a.enabled) return { ok: false, verb: a.label, message: a.label };
    if (autoOnly && !a.auto) return { ok: false, verb: a.label, message: '' };
    a.run();
    return { ok: true, verb: a.label, message: '' };
  }

  function interact() {
    let r;
    if (state.phase !== 'service' || state.paused) r = { ok: false, verb: STRINGS.walk, message: STRINGS.walk };
    else if (state.player.busy !== null) r = { ok: false, verb: STRINGS.slicing, message: STRINGS.slicing };
    else r = performAction(false);
    checkTutorial();
    return r;
  }

  // ---- customers: arrival, movement, patience, seats ----------------------------------------

  function spawnInterval() {
    let interval = C.SPAWN_MAX - (C.SPAWN_MAX - C.SPAWN_MIN) * state.rep / 100;
    if (state.rain && !state.gear.canopy) interval = interval / C.RAIN_ARRIVALS;
    return interval;
  }

  function weightedPick(weights, r) {
    let total = 0;
    for (const m of MEAT_IDS) total += weights[m];
    if (total <= 0) return null;
    let acc2 = 0;
    const target = r * total;
    for (const m of MEAT_IDS) {
      acc2 += weights[m];
      if (weights[m] > 0 && target < acc2) return m;
    }
    for (let i = MEAT_IDS.length - 1; i >= 0; i--) if (weights[MEAT_IDS[i]] > 0) return MEAT_IDS[i];
    return null;
  }

  // 6.2 order roll. `rBranch` and `rWeight` are the two rng draws for this spawn.
  function rollOrder(rBranch, rWeight) {
    const tableW = zeroByMeat();
    let tableAny = false;
    for (const sp of state.stations.table.spots) {
      if (sp && sp.times.length > 0) { tableW[sp.meat] += sp.times.length; tableAny = true; }
    }
    const cookW = zeroByMeat();
    let cookAny = false;
    for (const id of COOKER_IDS) {
      for (const p of state.stations[id].pieces) {
        if (p.state === 'burnt') continue;
        cookW[p.meat] += 1;
        cookAny = true;
      }
    }
    for (const st of state.stations.board.stacks) {
      if (st.times.length > 0) { cookW[st.meat] += 1; cookAny = true; }
    }
    if (state.stations.board.slicing) { cookW[state.stations.board.slicing.meat] += 1; cookAny = true; }
    if (tableAny) {
      if (rBranch < C.ORDER_FROM_TABLE || !cookAny) return weightedPick(tableW, rWeight);
      return weightedPick(cookW, rWeight);
    }
    if (cookAny) return weightedPick(cookW, rWeight);
    const stockW = zeroByMeat();
    let stockAny = false;
    for (const m of MEAT_IDS) {
      if (state.stock[m] > 0) { stockW[m] = state.stock[m] * MEATS[m].plates; stockAny = true; }
    }
    if (stockAny) return weightedPick(stockW, rWeight);
    // Hands: the last piece may be on its way to the board or the table.
    const handsW = zeroByMeat();
    let handsAny = false;
    for (const who of [state.player, state.buddy]) {
      const c = who ? who.carrying : null;
      if (c && (c.kind === 'raw' || c.kind === 'cooked' || c.kind === 'plates')) { handsW[c.meat] += 1; handsAny = true; }
    }
    if (handsAny) return weightedPick(handsW, rWeight);
    return null;
  }

  // A customer record at the spawn. Counts the arrival (custSeq, body, arrivals, today.customers).
  function newCustomer(want, patienceMax) {
    custSeq += 1;
    const body = state.arrivals % 4;
    state.arrivals += 1;
    state.today.customers += 1;
    return Object.assign(newMover(MAP.custSpawn.x, MAP.custSpawn.y, 'up'), {
      id: custSeq, body, want, patienceMax, patience: patienceMax, wait: 0,
      queueIndex: -1, mode: 'arriving', mood: 'neutral', reason: null, pause: 0, hop: 0,
      seat: null, eat: 0, eatMax: 0, bonusPaid: false
    });
  }

  function spawnCustomer() {
    const rJitter = rng();
    const rPatience = rng();
    const rBranch = rng();
    const rWeight = rng();
    const jitter = C.SPAWN_JITTER_LO + (C.SPAWN_JITTER_HI - C.SPAWN_JITTER_LO) * rJitter;
    state.spawnAt = state.clock + spawnInterval() * jitter;

    const order = rollOrder(rBranch, rWeight);
    const want = order || 'sausage';
    const patienceMax = C.PATIENCE_BASE + (rPatience * 2 - 1) * C.PATIENCE_SPREAD;
    const c = newCustomer(want, patienceMax);
    const inLine = state.customers.filter((o) => o.queueIndex >= 0).length;
    if (order === null || inLine >= queueSpotCount()) {
      // Nothing left to sell, or no room in line: look in from the gate and leave at no cost.
      c.mode = 'passing';
      setRoute(c, custRoute(c, MAP.passStop.x, MAP.passStop.y) || []);
      state.customers.push(c);
      state.today.past += 1;
      state.stats.past += 1;
      emit('walk_past', { id: c.id, reason: order === null ? 'soldout' : 'full' });
      return;
    }
    c.queueIndex = inLine;
    routeToSpot(c);
    state.customers.push(c);
    emit('customer_arrived', { id: c.id, meat: c.want });
  }

  // Stage 2: customers walk. Eaters only count down their hop; everything else about them runs
  // in stage 5 (D8). Customers who reach the spawn on their way out are removed.
  function moveCustomers(dt) {
    const keep = [];
    for (const c of state.customers) {
      if (c.hop > 0) c.hop = Math.max(0, c.hop - dt);
      if (c.mode === 'eating') { keep.push(c); continue; }
      if (c.pause > 0) {
        c.pause = Math.max(0, c.pause - dt);
        c.walking = false;
        if (c.pause === 0 && c.mode === 'passing' && c.next === null && c.path.length === 0) {
          // Done looking in: back out through the gate.
          const out = custRoute(c, MAP.custSpawn.x, MAP.custSpawn.y);
          if (out === null || out.length === 0) continue;
          setRoute(c, out);
        }
        keep.push(c);
        continue;
      }
      const stepped = advanceMover(c, C.NPC_TILES_PER_S, dt);
      if (c.next === null && c.path.length === 0) {
        if (c.mode === 'arriving' || c.mode === 'waiting') {
          const spot = c.queueIndex >= 0 ? MAP.queue[c.queueIndex] : null;
          if (spot && c.x === spot.x && c.y === spot.y) {
            if (c.mode === 'arriving' || stepped) c.face = spot.face;
            c.mode = 'waiting';
          }
        } else if (c.mode === 'toSeat') {
          const s = SEAT_BY_ID[c.seat];
          if (s && c.x === s.x && c.y === s.y) {
            c.mode = 'eating';
            c.face = s.face;
            c.eat = c.eatMax;
            c.pause = 0;
          }
        } else if (c.mode === 'passing') {
          if (c.x === MAP.passStop.x && c.y === MAP.passStop.y) {
            c.pause = C.WALK_PAST_PAUSE;
            c.face = 'up';
          } else {
            continue;   // back at the spawn, out of the yard
          }
        } else if (c.mode === 'leaving') {
          continue;     // at the spawn (or no way out): out of the yard
        }
      }
      keep.push(c);
    }
    state.customers = keep;
  }

  // [V2.5] step 5: the seat tip, paid when eating ends or at the hard end.
  function payBonus(c, atClose) {
    const bonus = seatBonus();
    state.cash += bonus;
    state.today.seatTips += bonus;
    state.today.seated += 1;
    state.stats.seated += 1;
    c.bonusPaid = true;
    const s = SEAT_BY_ID[c.seat];
    emit('seat_done', { id: c.id, seat: c.seat, bonus, x: s.x * TILE, y: s.y * TILE, atClose: atClose === true });
  }

  function freeSeat(c) {
    if (c.seat && state.seats[c.seat] === c.id) state.seats[c.seat] = null;
  }

  // Stage 5: serve checks, patience, walk-outs, then eating, the heart pause and standing up.
  function customersStage(dt) {
    serveLine();
    // [T 2.4] D: patience, wait and mood hold while the tutorial runs.
    const waiters = tutRunning() ? [] : waitingCustomers();
    for (const c of waiters) {
      c.wait += dt;
      c.patience -= dt;
      if (c.patience <= 0) {
        c.patience = 0;
        state.today.walkouts += 1;
        state.stats.walkouts += 1;
        leaveLine(c);
        sendOut(c, 'walkout', 'unhappy', true);
        emit('walk_out', { id: c.id });
      } else if (c.patience <= c.patienceMax * C.PATIENCE_WARN_FRAC && c.mood === 'neutral') {
        c.mood = 'unhappy';
      }
    }
    let gone = null;
    for (const c of state.customers) {
      if (c.mode !== 'eating') continue;
      if (c.eat > 0) {
        c.eat -= dt;
        if (c.eat <= 1e-9) {
          c.eat = 0;
          payBonus(c, false);
          c.pause = C.HEART_SECONDS;
        }
        continue;
      }
      c.pause -= dt;
      if (c.pause <= 1e-9) {
        c.pause = 0;
        freeSeat(c);
        sendOut(c, 'seated', 'happy', false);
        if (c.next === null && c.path.length === 0) {
          if (gone === null) gone = new Set();
          gone.add(c);   // no way out from the seat: removed on the spot
        }
      }
    }
    if (gone !== null) state.customers = state.customers.filter((c) => !gone.has(c));
  }

  function closeOutLine() {
    for (const c of lineCustomers()) {
      state.today.close += 1;
      leaveLine(c);
      sendOut(c, 'close', 'neutral', true);
      emit('left_at_close', { id: c.id });
    }
  }

  // Hard end, after the line closes out: pay every unpaid seat tip (atClose), then stand everyone
  // up so nobody is left in toSeat or eating (deviation 17).
  function closeOutSeats() {
    for (const c of state.customers) {
      if (c.mode !== 'toSeat' && c.mode !== 'eating') continue;
      if (!c.bonusPaid) payBonus(c, true);
      freeSeat(c);
      sendOut(c, 'seated', 'happy', false);
    }
  }

  function seatsBusy() {
    return state.customers.some((c) => c.mode === 'toSeat' || c.mode === 'eating');
  }

  // ---- 5.8 the buddy ([V2.4]) -----------------------------------------------------------------

  function buddyRouteTo(b, x, y) {
    return playerBfs(b.x, b.y, (tx, ty) => tx === x && ty === y);
  }

  function tickBuddy(dt) {
    const b = state.buddy;
    if (!b) return;
    const boardUse = STATION_BY_ID.board.use[2];    // (5,5), facing up
    const tableUse = STATION_BY_ID.table.use[0];    // (6,5), facing down
    if (b.task === 'idle') {
      const stack = chooseBoardStack();
      if (stack && tableFits(stack.meat)) {
        const path = buddyRouteTo(b, boardUse.x, boardUse.y);
        if (path === null) return;   // cannot reach the board: stay idle
        buddyPick = stack.meat;
        b.task = 'pickup';
        b.path = path;
        b.t = C.BUDDY_HANDLE;
        if (path.length === 0) b.face = boardUse.face;
      }
      return;
    }
    if (b.task === 'pickup') {
      if (b.next !== null || b.path.length > 0) {
        advanceMover(b, C.NPC_TILES_PER_S, dt);
        if (b.next === null && b.path.length === 0) {
          b.face = boardUse.face;
          b.t = C.BUDDY_HANDLE;   // the handle runs only after he arrives
        }
        return;
      }
      b.t -= dt;
      if (b.t > 1e-9) return;
      b.t = 0;
      const stack = buddyPick ? boardStackOf(buddyPick) : null;
      buddyPick = null;
      if (!stack || stack.times.length === 0) {
        b.path = buddyRouteTo(b, MAP.buddyIdle.x, MAP.buddyIdle.y) || [];
        b.task = 'return';
        return;
      }
      const times = takeFromBoardStack(stack, 1);
      b.carrying = { kind: 'plates', meat: stack.meat, times };
      const path = buddyRouteTo(b, tableUse.x, tableUse.y);
      if (path === null) {
        // Cannot reach the counter: put the plate back and go home.
        addToBoard(b.carrying.meat, b.carrying.times);
        b.carrying = null;
        b.path = buddyRouteTo(b, MAP.buddyIdle.x, MAP.buddyIdle.y) || [];
        b.task = 'return';
        return;
      }
      b.path = path;
      b.task = 'carry';
      if (path.length === 0) { b.face = tableUse.face; b.task = 'wait'; b.t = 0; }
      return;
    }
    if (b.task === 'carry') {
      advanceMover(b, C.NPC_TILES_PER_S, dt);
      if (b.next === null && b.path.length === 0) {
        b.face = tableUse.face;
        b.task = 'wait';
        b.t = 0;
      }
      return;
    }
    if (b.task === 'wait') {
      if (b.carrying) {
        if (!tableFits(b.carrying.meat)) return;
        const meat = b.carrying.meat;
        const n = setDown(b.carrying);
        if (n > 0) emit('set_down', { meat, n });
        if (b.carrying.times.length === 0) b.carrying = null;
        b.t = C.BUDDY_HANDLE;
        return;
      }
      b.t -= dt;
      if (b.t > 1e-9) return;
      b.path = buddyRouteTo(b, MAP.buddyIdle.x, MAP.buddyIdle.y) || [];
      b.task = 'return';
      return;
    }
    if (b.task === 'return') {
      advanceMover(b, C.NPC_TILES_PER_S, dt);
      if (b.next === null && b.path.length === 0) {
        b.face = MAP.buddyIdle.face;
        b.task = 'idle';
        b.t = 0;
      }
    }
  }

  // ---- 5.9 the fire tender ------------------------------------------------------------------

  function cookerNeedingFire() {
    let best = null;
    for (const id of COOKER_IDS) {
      const st = STATION_BY_ID[id];
      if (!stationActive(st)) continue;
      const ck = state.stations[id];
      if (ck.fire < C.TENDER_THRESHOLD && (best === null || ck.fire < best.fire)) best = ck;
    }
    return best;
  }

  function tickTender(dt) {
    const t = state.tender;
    if (!t) return;
    if (t.cooldown > 0) t.cooldown = Math.max(0, t.cooldown - dt);
    if (t.task === 'idle') {
      if (t.cooldown > 0 || state.charcoal <= 0) return;
      const ck = cookerNeedingFire();
      if (!ck) return;
      state.charcoal -= 1;
      state.today.bags += 1;
      t.carrying = { kind: 'charcoal' };
      t.cooker = ck.id;
      t.cooldown = C.TENDER_CYCLE;
      t.task = 'grab';
      t.t = C.BUDDY_HANDLE;
      return;
    }
    if (t.task === 'grab') {
      t.t -= dt;
      if (t.t > 0) return;
      const st = STATION_BY_ID[t.cooker];
      const uses = activeUseTiles(st);
      const path = playerBfs(t.x, t.y, (x, y) => uses.some((u) => u.x === x && u.y === y));
      if (path === null) {
        addCharcoal(state.stations[t.cooker]);
        t.carrying = null;
        t.cooker = null;
        t.task = 'idle';
        return;
      }
      t.path = path;
      t.task = 'walk';
      return;
    }
    if (t.task === 'walk') {
      advanceMover(t, C.NPC_TILES_PER_S, dt);
      if (t.next === null && t.path.length === 0) {
        const st = STATION_BY_ID[t.cooker];
        const u = activeUseTiles(st).find((e) => e.x === t.x && e.y === t.y);
        if (u) t.face = u.face;
        t.task = 'add';
        t.t = C.BUDDY_HANDLE;
      }
      return;
    }
    if (t.task === 'add') {
      t.t -= dt;
      if (t.t > 0) return;
      if (t.cooker) addCharcoal(state.stations[t.cooker]);
      t.carrying = null;
      t.cooker = null;
      const home = MAP.tenderIdle;
      t.path = playerBfs(t.x, t.y, (x, y) => x === home.x && y === home.y) || [];
      t.task = 'return';
      return;
    }
    if (t.task === 'return') {
      advanceMover(t, C.NPC_TILES_PER_S, dt);
      if (t.next === null && t.path.length === 0) {
        t.face = MAP.tenderIdle.face;
        t.task = 'idle';
        t.t = 0;
      }
    }
  }

  // ---- 2.5.3 fixed step and the six stages --------------------------------------------------

  function tickPlayer(dt) {
    const p = state.player;
    if (p.busy !== null) {
      p.busy.t += dt;
      if (state.stations.board.slicing) state.stations.board.slicing.t = p.busy.t;
      if (p.busy.t >= p.busy.total - 1e-9) {
        const m = MEATS[p.busy.meat];
        const times = [];
        for (let i = 0; i < m.plates; i++) times.push(state.clock);
        addToBoard(m.id, times);
        emit('slice_done', { meat: m.id, plates: m.plates });
        p.busy = null;
        state.stations.board.slicing = null;
        // The first plate comes off the board into the free hands; the rest stay stacked.
        if (p.carrying === null) {
          const stack = chooseBoardStack();
          if (stack) {
            const cap = state.gear.tray ? C.TRAY_PLATES : 1;
            const n = Math.min(cap, stack.times.length);
            p.carrying = { kind: 'plates', meat: stack.meat, times: takeFromBoardStack(stack, n) };
          }
        }
        if (p.queued) {
          const q = p.queued;
          p.queued = null;
          walkTo(q.tx, q.ty);
        }
      }
      return;
    }
    const hadStep = p.next !== null || p.path.length > 0;
    if (hadStep) advanceMover(p, C.WALK_TILES_PER_S, dt);
    if (p.next === null && p.path.length === 0 && p.target !== null) {
      const st = STATION_BY_ID[p.target.station];
      const autoOnly = p.target.auto;
      p.target = null;
      if (st && stationActive(st)) {
        faceTarget(st);
        performAction(autoOnly);
      }
    }
  }

  function tickFire(dt) {
    for (const id of COOKER_IDS) {
      const ck = state.stations[id];
      if (!stationActive(STATION_BY_ID[id])) { ck.fire = 0; continue; }
      refreshFireFlags(ck);
      if (ck.fire <= 0) { decayAcc[id] = 0; continue; }
      // Decay lands once per whole second of the cooker's own timer, which a bag resets, so a
      // fresh light reads exactly FIRE_LIGHT for a full second. Same average rate as continuous.
      decayAcc[id] += dt;
      while (decayAcc[id] + 1e-9 >= 1) {
        decayAcc[id] -= 1;
        const before = ck.fire;
        ck.fire = Math.max(0, ck.fire - STATION_BY_ID[id].decay);
        // [T 2.4] G: a lit cooker never decays below the floor while the tutorial runs.
        if (tutRunning() && before >= C.TUTORIAL_FIRE_FLOOR && ck.fire < C.TUTORIAL_FIRE_FLOOR) ck.fire = C.TUTORIAL_FIRE_FLOOR;
      }
      if (!ck.lowWarned && ck.fire < C.FIRE_LOW_WARN) {
        ck.lowWarned = true;
        emit('fire_low', { cooker: id });
      }
      if (!ck.outFired && ck.fire <= 0) {
        ck.outFired = true;
        emit('fire_out', { cooker: id });
      }
    }
  }

  function tickPieces(dt) {
    for (const id of COOKER_IDS) {
      const ck = state.stations[id];
      if (ck.pieces.length === 0) continue;
      const mult = fireMult(ck.fire);
      if (mult <= 0) continue;
      const doneRate = burnMult(ck.fire);
      const hold = tutRunning();
      for (const pc of ck.pieces) {
        if (pc.state === 'burnt') continue;
        const m = MEATS[pc.meat];
        if (pc.state === 'done') {
          if (hold) continue;   // [T 2.4] E: a done piece holds at done while the tutorial runs
          pc.prog += doneRate * dt;
        } else {
          pc.prog += mult * dt;   // the tick that crosses cook runs at fireMult for the whole tick
        }
        if (pc.state === 'cooking' && pc.prog >= m.cook) {
          pc.state = 'done';
          emit('piece_done', { cooker: id, meat: pc.meat });
        }
        // [T 3.3]: the warning stage is the last WARN_FRAC of the window, announced once a piece.
        if (pc.state === 'done' && pc.warn !== true && pc.prog >= m.cook + m.window * (1 - C.WARN_FRAC)) {
          pc.warn = true;
          emit('burn_warning', { station: id, slot: pc.slot, meat: pc.meat });
        }
        if (pc.state === 'done' && pc.prog >= m.cook + m.window) {
          pc.state = 'burnt';
          pc.burntAt = state.clock;
          state.today.burnt += 1;
          state.stats.burnt += 1;
          emit('piece_burnt', { cooker: id, meat: pc.meat });
        }
      }
    }
  }

  function tickClockEvents() {
    const clock = state.clock;
    if (!state.gateSoonFired && clock >= C.GATE_OPENS - 10) {
      state.gateSoonFired = true;
      emit('gate_soon');
    }
    if (!gateOpenFired && clock >= C.GATE_OPENS) {
      gateOpenFired = true;
      emit('gate_open');
    }
    if (!state.lastCallFired && clock >= C.LAST_CALL) {
      state.lastCallFired = true;
      state.spawnAt = Infinity;
      emit('last_call');
    }
  }

  function tickSpawns() {
    if (state.clock >= C.LAST_CALL) { state.spawnAt = Infinity; return; }
    if (state.clock + 1e-9 >= state.spawnAt) spawnCustomer();
  }

  // Nothing left to sell anywhere: cooler, grates, board, table and hands. Charcoal and burnt
  // pieces are not sellable, so they do not hold the day open.
  function soldOut() {
    if (totalStock() > 0) return false;
    for (const id of COOKER_IDS) {
      if (!stationActive(STATION_BY_ID[id])) continue;
      if (state.stations[id].pieces.some((pc) => pc.state !== 'burnt')) return false;
    }
    const board = state.stations.board;
    if (board.stacks.length > 0 || board.slicing !== null) return false;
    for (const sp of state.stations.table.spots) if (sp !== null) return false;
    const pc = state.player.carrying;
    if (pc !== null && pc.kind !== 'charcoal' && pc.kind !== 'burnt') return false;
    if (state.buddy && state.buddy.carrying) return false;
    return true;
  }

  // The early end ([V2.5] step 9): sold out, or after last call with nobody in line, and in both
  // cases nobody walking to a seat or eating.
  function dayShouldEnd() {
    if (state.clock + 1e-9 >= C.DAY_SECONDS) return true;
    if (state.clock + 1e-9 >= C.GATE_OPENS && soldOut()) return !seatsBusy();
    if (state.clock + 1e-9 >= C.LAST_CALL) {
      return !state.customers.some((c) => c.mode === 'arriving' || c.mode === 'waiting') && !seatsBusy();
    }
    return false;
  }

  function tick() {
    if (state.phase !== 'service' || state.paused) return;
    tickStages();
    checkTutorial();
  }

  function tickStages() {
    const dt = C.TICK_SECONDS;
    // [T 2.4] A: the yard clock holds at its value until the first plate lands.
    if (!tutClockHeld()) {
      tickCount += 1;
      state.clock = tickCount * C.TICK_SECONDS;
    }
    tickClockEvents();
    tickPlayer(dt);
    tickBuddy(dt);
    tickTender(dt);
    moveCustomers(dt);
    tickFire(dt);
    tickPieces(dt);
    customersStage(dt);
    if (state.clock + 1e-9 >= C.DAY_SECONDS) {
      closeOutLine();
      closeOutSeats();
      endDay();
      return;
    }
    if (state.clock + 1e-9 >= C.GATE_OPENS && soldOut()) {
      // Sold out stays sold out: close the line and stop arrivals while the eaters finish.
      closeOutLine();
      state.spawnAt = Infinity;
    }
    tickSpawns();
    if (dayShouldEnd()) {
      closeOutLine();
      endDay();
    }
  }

  function step(dt) {
    if (state.phase !== 'service' || state.paused) return;
    let d = Number(dt);
    if (!Number.isFinite(d) || d < 0) d = 0;
    if (d > C.MAX_FRAME_DT) d = C.MAX_FRAME_DT;
    acc += d;
    while (acc + 1e-9 >= C.TICK_SECONDS) {
      acc -= C.TICK_SECONDS;
      tick();
      if (state.phase !== 'service' || state.paused) { acc = 0; break; }
    }
  }

  // ---- 2.7.5 day end ------------------------------------------------------------------------

  function endDay() {
    // [T 2.4] H: the till never runs with the tutorial still running.
    if (tutRunning()) finishTutorial(false);
    const t = state.today;
    const played = state.day;
    for (const id of COOKER_IDS) {
      for (const pc of state.stations[id].pieces) {
        t.grateLeft[pc.meat] += 1;
        t.grateCost += MEATS[pc.meat].unit;
      }
    }
    for (const st of state.stations.board.stacks) {
      t.wastePlates += st.times.length;
      t.wasteCost += plateWaste(st.meat) * st.times.length;
    }
    for (const sp of state.stations.table.spots) {
      if (!sp) continue;
      t.wastePlates += sp.times.length;
      t.wasteCost += plateWaste(sp.meat) * sp.times.length;
    }
    t.wages = (state.buddy ? C.BUDDY_WAGE : 0) + (state.tender ? C.TENDER_WAGE : 0);
    const maxToday = repMax();
    const rawDelta = t.happy * C.REP_QUICK + t.togoQuick * C.REP_TOGO_QUICK + t.ok * C.REP_OK
      + t.walkouts * C.REP_WALKOUT + t.close * C.CLOSE_PENALTY;
    const repDelta = clamp(rawDelta, C.REP_DAY_MIN, maxToday);
    const repCapped = repDelta !== rawDelta;
    const repEnd = clamp(state.rep + repDelta, 0, 100);
    state.rep = repEnd;
    const net = t.revenue + t.tips + t.seatTips - t.wages - C.DAILY_COSTS;
    state.cash = Math.max(C.CASH_FLOOR, state.cash - t.wages - C.DAILY_COSTS);
    if (!state.gear.cooler) {
      for (const m of MEAT_IDS) {
        if (state.stock[m] > 0) {
          t.spoiled[m] = state.stock[m];
          t.spoilCost += state.stock[m] * MEATS[m].unit;
          state.stock[m] = 0;
        }
      }
    }
    state.day += 1;
    state.stats.days += 1;
    state.yesterday = { served: t.served, walkouts: t.walkouts, past: t.past };
    const till = {};
    for (const k of Object.keys(t)) {
      const v = t[k];
      till[k] = (v && typeof v === 'object') ? (Array.isArray(v) ? v.slice() : Object.assign({}, v)) : v;
    }
    till.day = played;
    till.repEnd = repEnd;
    till.repDelta = repDelta;
    till.repCapped = repCapped;
    till.repMax = maxToday;
    till.net = net;
    till.cashAfter = state.cash;
    state.till = till;
    state.seats = emptySeats();
    state.phase = 'evening';
    state.player.busy = null;
    state.stations.board.slicing = null;
    emit('day_over');
    emit('save_wanted', { reason: 'till' });
  }

  // ---- morning ------------------------------------------------------------------------------

  function brokeTest() {
    const units = totalStock();
    const cheapest = cheapestUnit();
    return (state.charcoal === 0 && state.cash < C.CHARCOAL_PRICE)
      || (units === 0 && state.cash < cheapest + (state.charcoal === 0 ? C.CHARCOAL_PRICE : 0));
  }

  function updateComingNext(fromMorning) {
    const show = state.gear.drum === true && state.cash >= C.DRIVEWAY_PRICE;
    if (fromMorning) state.comingNext = show;
    else if (show) state.comingNext = true;
    if (show && !state.drivewayShown) {
      state.drivewayShown = true;
      emit('coming_next');
    }
  }

  function beginMorning() {
    state.phase = 'morning';
    state.paused = false;
    state.buddy = null;
    state.tender = null;
    state.customers = [];
    state.seats = emptySeats();
    state.player.busy = null;
    state.player.target = null;
    state.player.queued = null;
    state.player.path = [];
    state.player.next = null;
    state.player.walking = false;
    state.stations.board.slicing = null;
    const roll = rng();
    const raining = state.day >= C.RAIN_FROM_DAY && roll < C.RAIN_CHANCE;
    state.rain = raining;
    if (state.day >= C.RAIN_FROM_DAY) emit('rain', { raining });
    state.broke = brokeTest();
    if (state.broke) emit('broke');
    state.cart = { meat: zeroByMeat(), charcoal: 0 };
    if (state.day === 1 && totalStock() === 0 && state.charcoal === 0) {
      // A first morning starts with a sensible cart (34 of the 80) instead of a row of zeros.
      state.cart = { meat: Object.assign(zeroByMeat(), { sausage: 3, chicken: 2 }), charcoal: 5 };
    }
    state.selected = quickestInStock(state.stock) || 'sausage';
    updateComingNext(true);
  }

  // About how many people today's rep and weather bring between the gate and last call.
  function expectedCrowd() {
    return Math.round((C.LAST_CALL - C.GATE_OPENS) / spawnInterval());
  }

  // ---- shop ---------------------------------------------------------------------------------

  function cartTotal() {
    let total = state.cart.charcoal * CATALOG_BY_ID.charcoal.price;
    for (const m of MEAT_IDS) total += state.cart.meat[m] * CATALOG_BY_ID[m].price;
    return total;
  }

  function morningOpen() {
    return state.phase === 'morning' && state.broke === false;
  }

  function buy(id, qty) {
    const rowDef = CATALOG_BY_ID[id];
    if (!rowDef) return { ok: false, message: '' };
    if (!morningOpen()) return { ok: false, message: '' };
    if (rowDef.kind === 'meat' || rowDef.kind === 'fuel') {
      if (rowDef.kind === 'meat' && MEATS[id].drumOnly && !state.gear.drum) return { ok: false, message: rowDef.needsText };
      const q = Math.trunc(Number(qty));
      if (!Number.isFinite(q) || q === 0) return { ok: false, message: '' };
      const cur = rowDef.kind === 'meat' ? state.cart.meat[id] : state.cart.charcoal;
      const have = rowDef.kind === 'meat' ? state.stock[id] : state.charcoal;
      let next = clamp(cur + q, 0, C.STEPPER_MAX);
      next = Math.min(next, Math.max(0, C.STEPPER_MAX - have));
      const others = cartTotal() - cur * rowDef.price;
      const affordable = Math.floor((state.cash - others) / rowDef.price);
      if (next > cur) next = Math.min(next, Math.max(cur, affordable));
      if (next === cur) return { ok: false, message: q > 0 && cur + q > affordable ? 'Not enough cash' : '' };
      if (rowDef.kind === 'meat') state.cart.meat[id] = next; else state.cart.charcoal = next;
      return { ok: true, message: '' };
    }
    if (rowDef.kind === 'gear') {
      if (state.gear[id] === true) return { ok: false, message: 'Owned' };
      if (rowDef.needs && rowDef.needs.gear && state.gear[rowDef.needs.gear] !== true) return { ok: false, message: rowDef.needsText };
      if (state.cash - cartTotal() < rowDef.price) return { ok: false, message: 'Not enough cash' };
      state.cash -= rowDef.price;
      state.gear[id] = true;
      reconfigureYard();
      emit('purchase', { id, label: rowDef.label, price: rowDef.price, kind: 'gear' });
      emit('save_wanted', { reason: 'gear' });
      updateComingNext(false);
      return { ok: true, message: 'Bought ' + rowDef.label + '.' };
    }
    if (rowDef.kind === 'decor') {
      if (state.decor[id] === true) return { ok: false, message: 'Owned' };
      if (rowDef.needs && rowDef.needs.decor && state.decor[rowDef.needs.decor] !== true) return { ok: false, message: rowDef.needsText };
      if (state.cash - cartTotal() < rowDef.price) return { ok: false, message: 'Not enough cash' };
      state.cash -= rowDef.price;
      state.decor[id] = true;
      emit('purchase', { id, label: rowDef.label, price: rowDef.price, kind: 'decor' });
      emit('save_wanted', { reason: 'decor' });
      return { ok: true, message: 'Bought ' + rowDef.label + '.' };
    }
    if (rowDef.kind === 'goal') return { ok: false, message: 'Not built in this prototype.' };
    return { ok: false, message: '' };
  }

  function reconfigureYard() {
    const spots = state.stations.table.spots;
    const want = tableSpotCount();
    while (spots.length < want) spots.push(null);
    while (spots.length > want) spots.pop();
    const p = state.player;
    if (!walkable(p.x, p.y)) {
      const t = nearestWalkableTo(p.x, p.y);
      if (t) {
        p.x = t.x; p.y = t.y; p.px = t.x * TILE; p.py = t.y * TILE;
        p.next = null; p.path = []; p.walking = false; p.target = null;
      }
    }
    for (const id of COOKER_IDS) {
      if (!stationActive(STATION_BY_ID[id])) {
        state.stations[id].fire = 0;
        state.stations[id].pieces = [];
      }
    }
  }

  function hire(id) {
    if (!HIRE_IDS.includes(id)) return { ok: false, hired: false, message: '' };
    if (state.phase !== 'morning') return { ok: false, hired: state.hires[id], message: '' };
    const rowDef = CATALOG_BY_ID[id];
    if (id === 'buddy' && state.day < rowDef.needs.day) return { ok: false, hired: false, message: rowDef.needsText };
    if (id === 'tender' && state.gear.drum !== true) return { ok: false, hired: false, message: rowDef.needsText };
    state.hires[id] = !state.hires[id];
    const hired = state.hires[id];
    emit('hire', { id, label: STRINGS.hire[id], hired });
    emit('save_wanted', { reason: 'hire' });
    const message = hired ? 'Hired ' + STRINGS.hire[id] + '.' : 'Let ' + STRINGS.hire[id] + ' go.';
    return { ok: true, hired, message };
  }

  function sellOne(id) {
    const rowDef = CATALOG_BY_ID[id];
    const price = Math.floor(rowDef.price * C.SELL_BACK);
    state.cash += price;
    if (rowDef.kind === 'decor') state.decor[id] = false;
    else state.gear[id] = false;
    emit('sell', { id, label: rowDef.label, price });
    return { label: rowDef.label, price };
  }

  function sell(id) {
    if (!(state.phase === 'morning' && state.broke)) return { ok: false, message: '', price: 0 };
    const isGear = GEAR_IDS.includes(id);
    const isDecor = DECOR_IDS.includes(id);
    if (!isGear && !isDecor) return { ok: false, message: '', price: 0 };
    if ((isGear ? state.gear[id] : state.decor[id]) !== true) return { ok: false, message: '', price: 0 };
    const sales = [];
    if (id === 'kettle2' && state.gear.drum) {
      sales.push(sellOne('kettle2'));
      sales.push(sellDrum());
    } else if (id === 'drum') {
      sales.push(sellDrum());
    } else if (id === 'chair1' && state.decor.chair2) {
      sales.push(sellOne('chair1'));
      sales.push(sellOne('chair2'));
    } else {
      sales.push(sellOne(id));
    }
    reconfigureYard();
    emit('save_wanted', { reason: 'sell' });
    state.broke = brokeTest();
    let total = 0;
    const parts = sales.map((s) => { total += s.price; return s.label + ' for ' + s.price; });
    return { ok: true, message: 'Sold ' + parts.join(' and ') + '.', price: total };
  }

  function sellDrum() {
    const s = sellOne('drum');
    const brisket = state.stock.brisket;
    if (brisket > 0) {
      const each = Math.floor(MEATS.brisket.unit / 2);
      state.cash += each * brisket;
      s.price += each * brisket;
      state.stock.brisket = 0;
    }
    state.hires.tender = false;
    state.cart.meat.brisket = 0;
    return s;
  }

  function canOpen() {
    if (!morningOpen()) return { ok: false, reason: '' };
    if (state.charcoal + state.cart.charcoal === 0) return { ok: false, reason: 'Buy at least one bag of charcoal.' };
    if (totalStock() + sumValues(state.cart.meat) === 0) return { ok: false, reason: 'Buy at least one unit of meat.' };
    return { ok: true, reason: '' };
  }

  function openGate() {
    const can = canOpen();
    if (!can.ok) return { ok: false, message: can.reason };
    state.cash -= cartTotal();
    for (const m of MEAT_IDS) { state.stock[m] += state.cart.meat[m]; state.cart.meat[m] = 0; }
    state.charcoal += state.cart.charcoal;
    state.cart.charcoal = 0;
    tickCount = 0;
    acc = 0;
    pieceSeq = 0;
    custSeq = 0;
    buddyPick = null;
    gateOpenFired = false;
    state.clock = 0;
    state.phase = 'service';
    state.paused = false;
    state.comingNext = false;
    state.spawnAt = tutRunning() ? Infinity : C.GATE_OPENS;   // [T 2.4] C
    state.arrivals = 0;
    state.lastCallFired = false;
    state.gateSoonFired = false;
    state.customers = [];
    state.seats = emptySeats();
    for (const id of COOKER_IDS) { state.stations[id] = newCooker(id); decayAcc[id] = 0; }
    state.stations.board = { stacks: [], slicing: null };
    state.stations.table = { spots: new Array(tableSpotCount()).fill(null) };
    state.player = newPlayer();
    state.today = newToday();
    state.today.repStart = state.rep;
    state.today.wageNames = [];
    if (state.hires.buddy) {
      state.buddy = Object.assign(newMover(MAP.buddyIdle.x, MAP.buddyIdle.y, MAP.buddyIdle.face), { carrying: null, task: 'idle', t: 0 });
      state.today.wageNames.push(STRINGS.hireLabel.buddy);
    } else state.buddy = null;
    if (state.hires.tender && state.gear.drum) {
      state.tender = Object.assign(newMover(MAP.tenderIdle.x, MAP.tenderIdle.y, MAP.tenderIdle.face), { carrying: null, task: 'idle', t: 0, cooker: null, cooldown: 0 });
      state.today.wageNames.push(STRINGS.hireLabel.tender);
    } else state.tender = null;
    if (!(state.stock[state.selected] > 0)) autoSelect();
    emit('save_wanted', { reason: 'open' });
    emit('yard_open');
    checkTutorial();
    return { ok: true, message: '' };
  }

  function continueFromTill() {
    if (state.phase !== 'evening') return;
    beginMorning();
  }

  // Returns true once a Broke morning can go on: the test is false now. sell() already updates
  // state.broke after each sale, so this accepts either flag value and only checks the test.
  function continueFromBroke() {
    if (state.phase !== 'morning') return false;
    if (brokeTest()) return false;
    state.broke = false;
    return true;
  }

  function dismissComingNext() {
    state.comingNext = false;
  }

  function goal() {
    for (const id of GOAL_ORDER) {
      const owned = id === 'buddy' ? state.hires.buddy === true : (id === 'driveway' ? false : state.gear[id] === true);
      if (!owned) {
        const rowDef = CATALOG_BY_ID[id];
        return { id, label: rowDef.label, price: rowDef.price };
      }
    }
    return null;
  }

  function setPaused(on) {
    state.paused = on === true;
  }

  function reset() {
    fillState(null);
    emit('save_clear');
    beginMorning();
    checkTutorial();
  }

  // ---- v2.1 guided tutorial ([T 2], contract K3 to K5) ---------------------------------------

  const TUT_LATCHED = Object.freeze({ customer: true, seated: true, end: true });

  function tutRunning() {
    return state.tutorial.done === false;
  }

  // [T 2.4] A: held in service while the step is not yet latched.
  function tutClockHeld() {
    return tutRunning() && state.phase === 'service' && TUT_LATCHED[state.tutorial.step] !== true;
  }

  // [T 2.3] rows 1 to 11, for a step not yet latched. The first matching row wins.
  function tutorialRow() {
    if (state.phase === 'morning') return 'open';
    if (state.stations.table.spots.some((sp) => sp !== null)) return 'customer';
    const ck = state.stations.kettle1;
    const h = state.player.carrying;
    const kind = h === null ? null : h.kind;
    const board = state.stations.board;
    if (ck.fire < C.COLD_UNDER) {
      if (kind === 'charcoal') return 'light';
      if (kind === 'raw') return 'puton';
      return 'charcoal';
    }
    if (kind === 'plates' || (board.stacks.length > 0 && board.slicing === null && h === null)) return 'plate';
    if (kind === 'cooked' || board.slicing !== null) return 'slice';
    if (ck.pieces.length > 0) return 'cook';
    if (kind === 'raw') return 'puton';
    if (kind === 'charcoal') return 'light';
    return 'meat';
  }

  // [T 2.2] target column, for the current state.
  function tutorialTarget(id) {
    const h = state.player.carrying;
    switch (id) {
      case 'open': return 'open';
      case 'charcoal': return 'pile';
      case 'light': return 'kettle1';
      case 'meat': return 'cooler';
      case 'puton': return 'kettle1';
      case 'cook':
        return h === null && state.stations.kettle1.pieces.some((pc) => pc.state === 'done') ? 'kettle1' : null;
      case 'slice': return 'board';
      case 'plate': return h !== null && h.kind === 'plates' ? 'table' : 'board';
      default: return null;
    }
  }

  function emitTutorialStep() {
    const id = state.tutorial.step;
    const target = tutorialTarget(id);
    if (id === tutLastId && target === tutLastTarget) return;
    tutLastId = id;
    tutLastTarget = target;
    emit('tutorial_step', { id, text: STRINGS.tutorial[id], target });
  }

  function finishTutorial(skipped) {
    state.tutorial = { step: null, done: true };
    tutEndAt = null;
    emit('tutorial_done', { skipped: skipped === true });
  }

  // Move every stored clock value by the same jump, so plate ages and pull order keep.
  function shiftClocks(jump) {
    const bump = (times) => { for (let i = 0; i < times.length; i++) times[i] += jump; };
    for (const id of COOKER_IDS) {
      for (const pc of state.stations[id].pieces) {
        pc.putOn += jump;
        if (pc.burntAt !== null) pc.burntAt += jump;
      }
    }
    for (const who of [state.player, state.buddy, state.tender]) {
      if (who && who.carrying && who.carrying.kind === 'plates') bump(who.carrying.times);
    }
    for (const st of state.stations.board.stacks) bump(st.times);
    for (const sp of state.stations.table.spots) if (sp) bump(sp.times);
  }

  // [T 2.4] F: the scripted first customer, no rng draw, served on arrival.
  function spawnScriptedCustomer() {
    let want = 'sausage';
    for (const sp of state.stations.table.spots) { if (sp !== null) { want = sp.meat; break; } }
    const c = newCustomer(want, C.PATIENCE_BASE);
    c.queueIndex = 0;
    routeToSpot(c);
    state.customers.push(c);
    emit('customer_arrived', { id: c.id, meat: c.want });
  }

  // [T 2.4] B, run right after tutorial_step customer was emitted.
  function gateOnPlate() {
    const jump = C.GATE_OPENS - state.clock;
    state.clock = C.GATE_OPENS;
    tickCount = Math.round(C.GATE_OPENS / C.TICK_SECONDS);
    if (jump !== 0) shiftClocks(jump);
    state.gateSoonFired = true;
    if (!gateOpenFired) {
      gateOpenFired = true;
      emit('gate_open');
    }
    spawnScriptedCustomer();
  }

  // [T 2.3]: checked at the end of tick, interact, openGate, skipTutorial, reset and createSim.
  function checkTutorial() {
    if (!tutRunning()) return;
    for (let guard = 0; guard < 4; guard++) {
      const cur = state.tutorial.step;
      if (cur === 'end') {
        if (tutEndAt !== null && state.clock + 1e-9 >= tutEndAt) finishTutorial(false);
        return;
      }
      let next;
      if (cur === 'customer') next = state.today.served >= 1 ? 'seated' : cur;
      else if (cur === 'seated') next = state.today.seated + state.today.togo >= 1 ? 'end' : cur;
      else next = tutorialRow();
      if (next === cur) { emitTutorialStep(); return; }
      state.tutorial.step = next;
      emitTutorialStep();
      if (next === 'customer') gateOnPlate();
      else if (next === 'end') {
        tutEndAt = state.clock + C.TUTORIAL_END_S;
        state.spawnAt = state.clock;   // [T 2.4] C: normal arrivals start on the next stage 6
      }
      if (TUT_LATCHED[next] !== true) return;   // rows 1 to 11 settle in one pass
    }
  }

  // [T 2.5] and contract K4.
  function skipTutorial() {
    if (!tutRunning()) return false;
    const latched = TUT_LATCHED[state.tutorial.step] === true;
    finishTutorial(true);
    if (state.phase === 'morning') {
      emit('save_wanted', { reason: 'tutorial' });
    } else if (state.phase === 'service') {
      if (!latched) state.spawnAt = state.clock < C.GATE_OPENS ? C.GATE_OPENS : state.clock;
      else state.spawnAt = Math.min(state.spawnAt, state.clock);   // deviation 24
    }
    checkTutorial();
    return true;
  }

  // Contract K4: null when done, else a fresh { id, text, target }.
  function tutorialStep() {
    if (!tutRunning()) return null;
    const id = state.tutorial.step;
    return { id, text: STRINGS.tutorial[id], target: tutorialTarget(id) };
  }

  function drainEvents() {
    const out = events.slice();
    events.length = 0;
    return out;
  }

  // D9 and K6: always version 3. Service state, state.seats, charm and the tutorial step are never saved.
  function serialize() {
    const out = { v: C.SAVE_VERSION };
    out.day = clamp(Math.trunc(state.day), 1, C.MAX_DAY);
    out.cash = clamp(Math.trunc(state.cash), 0, C.MAX_CASH);
    out.rep = clamp(Math.trunc(state.rep), 0, 100);
    out.stock = {};
    for (const m of MEAT_IDS) out.stock[m] = clamp(Math.trunc(state.stock[m]), 0, C.STEPPER_MAX);
    out.charcoal = clamp(Math.trunc(state.charcoal), 0, C.STEPPER_MAX);
    out.gear = {};
    for (const g of GEAR_IDS) out.gear[g] = state.gear[g] === true;
    if (!out.gear.kettle2) out.gear.drum = false;
    out.decor = {};
    for (const d of DECOR_IDS) out.decor[d] = state.decor[d] === true;
    if (!out.decor.chair1) out.decor.chair2 = false;
    out.hires = {};
    for (const h of HIRE_IDS) out.hires[h] = state.hires[h] === true;
    if (!out.gear.drum) out.hires.tender = false;
    if (!out.gear.drum) out.stock.brisket = 0;
    out.stats = {};
    for (const k of STAT_IDS) out.stats[k] = clamp(Math.trunc(state.stats[k]), 0, C.MAX_STAT);
    out.drivewayShown = state.drivewayShown === true;
    out.tutorial = { done: state.tutorial.done === true };
    return out;
  }

  // ---- assemble -----------------------------------------------------------------------------

  fillState(saved && typeof saved === 'object' ? saved : null);
  beginMorning();
  checkTutorial();

  const sim = {
    state,
    seed: seedUsed,
    step, tick, walkTo, move, interact, verbAt, holding, walkable, reach,
    selectMeat, cycleMeat, buy, hire, sell, cartTotal, canOpen, openGate,
    continueFromTill, continueFromBroke, dismissComingNext, goal, setPaused, reset,
    drainEvents, serialize, rng, expectedCrowd,
    charm, seatBonus, seatCount, repMax, custWalkable,
    skipTutorial, tutorialStep
  };
  return sim;
}

// ---------------------------------------------------------------------------------------------
// Attach the shared surface (a double load overwrites)
// ---------------------------------------------------------------------------------------------

PitSim.C = C;
PitSim.MEATS = MEATS;
PitSim.MEAT_IDS = MEAT_IDS;
PitSim.MAP = MAP;
PitSim.CATALOG = CATALOG;
PitSim.STRINGS = STRINGS;
PitSim.createSim = createSim;
PitSim.validateSave = validateSave;
PitSim.fireBand = fireBand;
PitSim.fireMult = fireMult;
PitSim.tileOwned = tileOwned;
PitSim.SAVE_KEY = SAVE_KEY;

})();
