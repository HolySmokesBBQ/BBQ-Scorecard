// games/pit-sim/sim.js
// Pit sim, backyard rung: the whole game as pure state and rules. No DOM, no canvas, no timers,
// no browser storage. Randomness only through the seeded generator on the sim object. Runs in
// Node under vm.runInThisContext and in the browser as a classic deferred script.
//
// Contract: docs/superpowers/specs/2026-10-18-pit-sim-contract.md (section 2).
// Rules:    docs/superpowers/specs/2026-10-18-pit-sim-design.md.
//
// Deviations
// 1. The file body is wrapped in a function expression so that `const PitSim` is not a global
//    lexical binding. Three classic scripts that each declare a top level `const PitSim` would
//    throw a redeclaration SyntaxError in the browser; the wrapper keeps the contract's line as
//    the first statement after 'use strict' and still attaches every name to globalThis.PitSim.
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
// 8. Round 1 review: the day also ends the moment the yard is sold out (clock at or past
//    GATE_OPENS, no stock, no raw or done piece on any grate, nothing on the board or table, no
//    slice running, nothing but charcoal or a burnt piece in anyone's hands). Burnt pieces do
//    not hold the day open: they are not sellable and the till lists them under Left on the
//    grate. Anyone in line is counted Left at close.
// 9. Round 1 review: order rule 4 no longer invents a meat. A hands rule between rules 3 and 4
//    orders from what the player or the buddy is carrying (raw, cooked or plates) and a running
//    slice counts as a board stack; when nothing is anywhere rollOrder returns null and the
//    customer walks to the pass stop and leaves at no cost, with walk_past { id, reason: 'soldout' }.
//    The full line case carries reason: 'full'. The reason field is new on walk_past.
// 10. Round 1 review: a slice that finishes hands the player the first plate (or two with the
//    tray) from the stack chooseBoardStack() picks, so the next tap is not always Take.
// 11. Round 1 review: walkTo() during a slice stores the tap in state.player.queued (a new
//    player field, { tx, ty }), returns true and emits tap_queued (a new event with no payload);
//    the walk starts the tick the slice completes.
// 12. Round 1 review: on a day 1 morning with an empty cooler and no charcoal the cart starts at
//    3 sausage, 2 chicken and 5 bags instead of empty, so the first screen has a sensible default.
// 13. Round 1 review: sim.expectedCrowd() is new on the sim surface. It returns
//    round((LAST_CALL - GATE_OPENS) / spawnInterval()) for today's rep and weather.
// 14. Round 1 review: C gains PATIENCE_MID_FRAC (0.5, the bar turns gold under it) and
//    GEAR_RESERVE (30, the clipboard warns when a gear buy leaves less than this).
// 15. Round 1 review: KETTLE_SLOT_PX is [(-5,1),(5,1)] and DRUM_SLOT_PX is
//    [(-5,5),(5,5),(-5,17),(5,17)] instead of the contract's -1 and 7, so two 10 px pieces on
//    one cooker share no column and raw reads apart from done.

(function () {
'use strict';
const PitSim = globalThis.PitSim || (globalThis.PitSim = {});

// ---------------------------------------------------------------------------------------------
// 2.1 Constants
// ---------------------------------------------------------------------------------------------

const C = Object.freeze({
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
  SAVE_VERSION: 1, MAX_DAY: 999, MAX_CASH: 999999, MAX_STAT: 9999999
});

const SAVE_KEY = 'hs.pitsim.save';
const SERVED_HOP = 0.3;

// ---------------------------------------------------------------------------------------------
// 2.2 Meats
// ---------------------------------------------------------------------------------------------

const MEAT_IDS = Object.freeze(['sausage', 'chicken', 'ribs', 'butt', 'brisket']);

const MEATS = Object.freeze({
  sausage: Object.freeze({ id: 'sausage', label: 'Sausage', plateLabel: 'Sausage', unit: 4, plates: 2, cook: 10, window: 6, price: 5, slots: 1, slice: 3, drumOnly: false, key: '1' }),
  chicken: Object.freeze({ id: 'chicken', label: 'Chicken thighs', plateLabel: 'Chicken thighs', unit: 6, plates: 2, cook: 16, window: 8, price: 8, slots: 1, slice: 4, drumOnly: false, key: '2' }),
  ribs: Object.freeze({ id: 'ribs', label: 'Pork ribs', plateLabel: 'Pork ribs', unit: 12, plates: 3, cook: 32, window: 10, price: 11, slots: 1, slice: 5, drumOnly: false, key: '3' }),
  butt: Object.freeze({ id: 'butt', label: 'Pork butt', plateLabel: 'Pulled pork', unit: 20, plates: 5, cook: 40, window: 14, price: 14, slots: 2, slice: 6, drumOnly: false, key: '4' }),
  brisket: Object.freeze({ id: 'brisket', label: 'Brisket', plateLabel: 'Brisket', unit: 38, plates: 7, cook: 50, window: 18, price: 18, slots: 2, slice: 7, drumOnly: true, key: '5' })
});

const GEAR_IDS = Object.freeze(['kettle2', 'cooler', 'bigtable', 'tray', 'canopy', 'drum']);
const HIRE_IDS = Object.freeze(['buddy', 'tender']);
const COOKER_IDS = Object.freeze(['kettle1', 'kettle2', 'drum']);
const STAT_IDS = Object.freeze(['days', 'served', 'walkouts', 'past', 'burnt']);
const GOAL_ORDER = Object.freeze(['kettle2', 'buddy', 'bigtable', 'drum', 'driveway']);
const DIRS = Object.freeze({
  up: Object.freeze({ dx: 0, dy: -1 }),
  down: Object.freeze({ dx: 0, dy: 1 }),
  left: Object.freeze({ dx: -1, dy: 0 }),
  right: Object.freeze({ dx: 1, dy: 0 })
});
const DIR_ORDER = Object.freeze(['up', 'down', 'left', 'right']);

// ---------------------------------------------------------------------------------------------
// 2.3 Map
// ---------------------------------------------------------------------------------------------

const MAP_W = 13;
const MAP_H = 15;
const TILE = 16;
const T = Object.freeze({ GRASS: 0, FENCE: 1, GATE: 2, PATH: 3, LAWN: 4, HEDGE: 5, QUEUE: 6 });

function buildTiles() {
  const tiles = new Array(MAP_W * MAP_H).fill(T.GRASS);
  for (let y = 0; y < MAP_H; y++) {
    for (let x = 0; x < MAP_W; x++) {
      let v;
      if (y === 0) v = x === 6 ? T.GATE : T.FENCE;
      else if (y === MAP_H - 1) v = T.FENCE;
      else if (x === 0 || x === MAP_W - 1) v = T.FENCE;
      else if (y >= 1 && y <= 4) v = x === 6 ? T.PATH : T.LAWN;
      else if (y === 5) v = (x >= 4 && x <= 8) ? T.QUEUE : T.HEDGE;
      else v = T.GRASS;
      tiles[y * MAP_W + x] = v;
    }
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

const KETTLE_SLOT_PX = Object.freeze([px(-5, 1), px(5, 1)]);
const DRUM_SLOT_PX = Object.freeze([px(-5, 5), px(5, 5), px(-5, 17), px(5, 17)]);

const STATIONS = Object.freeze([
  Object.freeze({ id: 'kettle1', type: 'cooker', label: 'Kettle 1', spoken: 'kettle 1', gear: null,
    tiles: Object.freeze([xy(8, 9)]),
    use: Object.freeze([use(7, 9, 'right'), use(8, 8, 'down'), use(9, 9, 'left'), use(8, 10, 'up')]),
    slots: C.KETTLE_SLOTS, decay: C.KETTLE_DECAY, slotPx: KETTLE_SLOT_PX }),
  Object.freeze({ id: 'kettle2', type: 'cooker', label: 'Kettle 2', spoken: 'kettle 2', gear: 'kettle2',
    tiles: Object.freeze([xy(8, 11)]),
    use: Object.freeze([use(7, 11, 'right'), use(8, 12, 'up'), use(9, 11, 'left')]),
    slots: C.KETTLE_SLOTS, decay: C.KETTLE_DECAY, slotPx: KETTLE_SLOT_PX }),
  Object.freeze({ id: 'drum', type: 'cooker', label: 'Drum smoker', spoken: 'the drum', gear: 'drum',
    tiles: Object.freeze([xy(10, 10), xy(10, 11)]),
    use: Object.freeze([use(9, 10, 'right'), use(9, 11, 'right'), use(10, 12, 'up'), use(11, 10, 'left'), use(11, 11, 'left')]),
    slots: C.DRUM_SLOTS, decay: C.DRUM_DECAY, slotPx: DRUM_SLOT_PX }),
  Object.freeze({ id: 'board', type: 'board', label: 'Cutting board', spoken: '', gear: null,
    tiles: Object.freeze([xy(4, 9)]),
    use: Object.freeze([use(5, 9, 'left'), use(4, 8, 'down'), use(4, 10, 'up'), use(3, 9, 'right')]) }),
  Object.freeze({ id: 'cooler', type: 'cooler', label: 'Cooler', spoken: '', gear: null,
    tiles: Object.freeze([xy(3, 11)]),
    use: Object.freeze([use(4, 11, 'left'), use(3, 10, 'down'), use(3, 12, 'up'), use(2, 11, 'right')]) }),
  Object.freeze({ id: 'table', type: 'table', label: 'Serving table', spoken: '', gear: null,
    tiles: Object.freeze([xy(5, 6), xy(6, 6), xy(7, 6), xy(4, 6, { gear: 'bigtable' }), xy(8, 6, { gear: 'bigtable' })]),
    use: Object.freeze([use(5, 7, 'up'), use(6, 7, 'up'), use(7, 7, 'up'), use(4, 7, 'up', 'bigtable'), use(8, 7, 'up', 'bigtable')]) }),
  Object.freeze({ id: 'pile', type: 'pile', label: 'Charcoal pile', spoken: '', gear: null,
    tiles: Object.freeze([xy(8, 13)]),
    use: Object.freeze([use(8, 12, 'down'), use(7, 13, 'right'), use(9, 13, 'left')]) }),
  Object.freeze({ id: 'trash', type: 'trash', label: 'Trash', spoken: '', gear: null,
    tiles: Object.freeze([xy(2, 13)]),
    use: Object.freeze([use(3, 13, 'left'), use(2, 12, 'down'), use(1, 13, 'right')]) })
]);

const STATION_BY_ID = Object.freeze(STATIONS.reduce((acc, s) => { acc[s.id] = s; return acc; }, {}));
const TILES = buildTiles();

const MAP = Object.freeze({
  W: MAP_W, H: MAP_H, TILE,
  T,
  tiles: TILES,
  at(x, y) {
    if (!(x >= 0 && x < MAP_W && y >= 0 && y < MAP_H)) return T.FENCE;
    return TILES[y * MAP_W + x];
  },
  stations: STATIONS,
  station(id) { return STATION_BY_ID[id]; },
  spawn: Object.freeze({ x: 6, y: 9, face: 'up' }),
  gate: px(6, 0),
  custSpawn: px(6, -1),
  passStop: px(6, 4),
  queue: Object.freeze([
    Object.freeze({ x: 6, y: 5, gear: null }), Object.freeze({ x: 5, y: 5, gear: null }), Object.freeze({ x: 7, y: 5, gear: null }),
    Object.freeze({ x: 4, y: 5, gear: 'bigtable' }), Object.freeze({ x: 8, y: 5, gear: 'bigtable' })
  ]),
  buddyIdle: px(5, 9),
  tenderIdle: px(7, 13),
  canopy: Object.freeze({ x: 4, y: 5, w: 5, h: 3 })
});

function tileOwned(entry, gear) {
  return !entry.gear || gear[entry.gear] === true;
}

// ---------------------------------------------------------------------------------------------
// 2.4 Catalog
// ---------------------------------------------------------------------------------------------

function row(id, kind, label, price, effect, needs, needsText, sets) {
  return Object.freeze({ id, kind, label, price, effect, needs: needs ? Object.freeze(needs) : null, needsText, sets });
}

const CATALOG = Object.freeze([
  row('sausage', 'meat', 'Sausage', 4, 'Sausage: 2 plates a unit, quickest cook, sells for 5.', null, '', 'cart.meat.sausage, then stock.sausage on open'),
  row('chicken', 'meat', 'Chicken thighs', 6, 'Chicken thighs: 2 plates, 16 seconds on good fire, sells for 8.', null, '', 'cart.meat.chicken'),
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
  row('buddy', 'hire', 'Buddy', 20, 'Runs plates from the board to the table so you can stay on the fire. Paid each evening.', { day: 2 }, 'From day 2.', 'hires.buddy'),
  row('tender', 'hire', 'Fire tender', 30, "Keeps every cooker above 55 as long as there are bags in the pile. Buy about seven bags a cooker when he's on.", { gear: 'drum' }, 'Needs the drum smoker.', 'hires.tender'),
  row('driveway', 'goal', 'Driveway pop-up', 1000, 'The next rung. Not built in this prototype.', { gear: 'drum' }, 'Needs the drum smoker.', 'nothing; goal line and Coming next card only')
]);

const CATALOG_BY_ID = Object.freeze(CATALOG.reduce((acc, r) => { acc[r.id] = r; return acc; }, {}));

// ---------------------------------------------------------------------------------------------
// 2.10 Strings
// ---------------------------------------------------------------------------------------------

const STRINGS = Object.freeze({
  cooker: Object.freeze({ kettle1: 'kettle 1', kettle2: 'kettle 2', drum: 'the drum' }),
  cookerLabel: Object.freeze({ kettle1: 'Kettle 1', kettle2: 'Kettle 2', drum: 'Drum smoker' }),
  hire: Object.freeze({ buddy: 'the buddy', tender: 'the fire tender' }),
  hireLabel: Object.freeze({ buddy: 'Buddy', tender: 'Fire tender' }),
  gearLabel: Object.freeze({ kettle2: 'Second kettle', cooler: 'Cooler', bigtable: 'Bigger table', tray: 'Serving tray', canopy: 'Canopy', drum: 'Drum smoker', driveway: 'Driveway pop-up' }),
  walk: 'Walk', handsFull: 'Hands full', nothing: 'Nothing to do here', slicing: 'Slicing',
  cantGetThere: "Can't get there", handsEmpty: 'Hands empty',
  gateOpensIn: 'Gate opens in ', lastCall: 'Last call'
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

// ---------------------------------------------------------------------------------------------
// 2.8 Save validation
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
    if (readKey(obj, 'v') !== C.SAVE_VERSION) return null;
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
    const hiresIn = readKey(obj, 'hires');
    out.hires = {};
    for (const h of HIRE_IDS) out.hires[h] = toBool(readKey(hiresIn, h));
    if (!out.gear.drum) out.hires.tender = false;
    if (!out.gear.drum) out.stock.brisket = 0;
    const statsIn = readKey(obj, 'stats');
    out.stats = {};
    for (const s of STAT_IDS) out.stats[s] = toInt(readKey(statsIn, s), 0, 0, C.MAX_STAT);
    out.drivewayShown = toBool(readKey(obj, 'drivewayShown'));
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
function tilePx(t) { return { x: t.x * TILE, y: t.y * TILE }; }

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
  let buddyPick = null;     // meat reserved by the buddy during his pickup pause
  const decayAcc = { kettle1: 0, kettle2: 0, drum: 0 };   // seconds since each cooker's last whole second of decay
  const blocked = new Uint8Array(MAP_W * MAP_H);   // 1 where an active station tile sits

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
    state.hires = {};
    for (const h of HIRE_IDS) state.hires[h] = s ? s.hires[h] === true : false;
    state.stats = {};
    for (const k of STAT_IDS) state.stats[k] = s ? s.stats[k] : 0;
    state.drivewayShown = s ? s.drivewayShown === true : false;
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
    state.player = Object.assign(newMover(MAP.spawn.x, MAP.spawn.y, MAP.spawn.face), { carrying: null, busy: null, target: null, queued: null });
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
    rebuildBlocked();
  }

  // ---- grid ---------------------------------------------------------------------------------

  function stationActive(st) {
    return tileOwned(st, state.gear);
  }

  function rebuildBlocked() {
    blocked.fill(0);
    for (const st of STATIONS) {
      if (!stationActive(st)) continue;
      for (const t of st.tiles) {
        if (!tileOwned(t, state.gear)) continue;
        blocked[t.y * MAP_W + t.x] = 1;
      }
    }
  }

  function inMap(x, y) {
    return x >= 0 && x < MAP_W && y >= 0 && y < MAP_H;
  }

  function walkable(x, y) {
    if (!inMap(x, y)) return false;
    if (TILES[y * MAP_W + x] !== T.GRASS) return false;
    return blocked[y * MAP_W + x] === 0;
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

  // Breadth first search over walkable tiles. `goal(x, y)` says whether a tile ends the search.
  // Returns the path after the start tile (array of {x, y}), [] when the start is a goal, or null.
  function bfs(sx, sy, goal) {
    if (goal(sx, sy)) return [];
    const prev = new Int16Array(MAP_W * MAP_H).fill(-1);
    const seen = new Uint8Array(MAP_W * MAP_H);
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
        if (!walkable(nx, ny)) continue;
        const nIdx = ny * MAP_W + nx;
        if (seen[nIdx]) continue;
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

  // ---- movers -------------------------------------------------------------------------------

  // Advance a mover along its path at `speed` tiles per second for `dt` seconds.
  // Returns true when a tile step completed this call.
  function advanceMover(m, speed, dt) {
    let arrived = false;
    if (m.next === null && m.path.length > 0) {
      m.next = m.path.shift();
      m.face = faceToward(m.x, m.y, m.next.x, m.next.y);
      m.walking = true;
    }
    if (m.next === null) {
      m.walking = false;
      m.anim = 0;
      return false;
    }
    const stepPx = speed * TILE * dt;
    const tx = m.next.x * TILE;
    const ty = m.next.y * TILE;
    const dx = tx - m.px;
    const dy = ty - m.py;
    const dist = Math.abs(dx) + Math.abs(dy);
    m.anim += dt;
    if (dist <= stepPx + 1e-6) {
      m.px = tx;
      m.py = ty;
      m.x = m.next.x;
      m.y = m.next.y;
      m.next = null;
      arrived = true;
      if (m.path.length === 0) {
        m.walking = false;
        m.anim = 0;
      }
    } else {
      if (dx !== 0) m.px += Math.sign(dx) * stepPx;
      else m.py += Math.sign(dy) * stepPx;
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
      const path = bfs(anchor.x, anchor.y, (x, y) => uses.some((u) => u.x === x && u.y === y));
      if (path === null) { emit('blocked'); return false; }
      p.path = path;
      p.target = { station: st.id, auto: true };
      return true;
    }
    if (walkable(tx, ty)) {
      const path = bfs(anchor.x, anchor.y, (x, y) => x === tx && y === ty);
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
    if (quick) state.today.happy += 1; else state.today.ok += 1;
    const tile = STATION_BY_ID.table.tiles[idx];
    leaveLine(c, 'served');
    c.mood = 'happy';
    c.hop = SERVED_HOP;
    emit('served', { id: c.id, meat: c.want, price: m.price, tip, quick, x: tile.x * TILE, y: tile.y * TILE });
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
          cooker.pieces.push({ id: pieceSeq, meat: m.id, slot, size: m.slots, prog: 0, state: 'cooking', putOn: state.clock, burntAt: null });
          state.today.foodCost += m.unit;
          p.carrying = null;
        });
      }
      if (c === null) {
        const pick = pullCandidate(cooker);
        if (pick) {
          return act('Pull ' + MEATS[pick.meat].label, true, stationId, () => {
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
    if (state.phase !== 'service' || state.paused) return { ok: false, verb: STRINGS.walk, message: STRINGS.walk };
    if (state.player.busy !== null) return { ok: false, verb: STRINGS.slicing, message: STRINGS.slicing };
    return performAction(false);
  }

  // ---- 2.5.6 customers ----------------------------------------------------------------------

  function queueSpot(index) { return MAP.queue[index]; }

  // Route from the customer's anchor tile to queue spot `index`: down column 6 to row 5, then
  // along row 5 to the spot. The anchor itself is not in the path.
  function routeToSpot(c, index) {
    const spot = queueSpot(index);
    const a = moverAnchor(c);
    const path = [];
    let x = a.x;
    let y = a.y;
    if (y < 5) {
      while (y < 5) { y += 1; path.push({ x, y }); }
    }
    while (x !== spot.x) { x += x < spot.x ? 1 : -1; path.push({ x, y }); }
    c.path = path;
  }

  // Route out: up the customer's own column to row 1, along row 1 to x 6, out through the gate.
  function routeOut(c) {
    const a = moverAnchor(c);
    const path = [];
    let x = a.x;
    let y = a.y;
    while (y > 1) { y -= 1; path.push({ x, y }); }
    while (x !== 6) { x += x < 6 ? 1 : -1; path.push({ x, y }); }
    while (y > -1) { y -= 1; path.push({ x, y }); }
    c.path = path;
  }

  function routeToPassStop(c) {
    const a = moverAnchor(c);
    const path = [];
    let y = a.y;
    while (y < MAP.passStop.y) { y += 1; path.push({ x: 6, y }); }
    c.path = path;
  }

  // Remove a customer from the line and shift everyone behind forward one spot.
  function leaveLine(c, reason) {
    const idx = c.queueIndex;
    c.queueIndex = -1;
    c.mode = 'leaving';
    c.reason = reason;
    c.pause = C.LEAVE_TURN_SECONDS;
    c.face = 'up';
    c.path = [];
    if (idx >= 0) {
      for (const o of state.customers) {
        if (o.queueIndex > idx) {
          o.queueIndex -= 1;
          if (o.mode === 'arriving' || o.mode === 'waiting') routeToSpot(o, o.queueIndex);
        }
      }
    }
  }

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

  function spawnCustomer() {
    const rJitter = rng();
    const rPatience = rng();
    const rBranch = rng();
    const rWeight = rng();
    const jitter = C.SPAWN_JITTER_LO + (C.SPAWN_JITTER_HI - C.SPAWN_JITTER_LO) * rJitter;
    state.spawnAt = state.clock + spawnInterval() * jitter;

    custSeq += 1;
    const body = state.arrivals % 3;
    state.arrivals += 1;
    state.today.customers += 1;
    const order = rollOrder(rBranch, rWeight);
    const want = order || 'sausage';
    const patienceMax = C.PATIENCE_BASE + (rPatience * 2 - 1) * C.PATIENCE_SPREAD;
    const c = Object.assign(newMover(MAP.custSpawn.x, MAP.custSpawn.y, 'down'), {
      id: custSeq, body, want, patienceMax, patience: patienceMax, wait: 0,
      queueIndex: -1, mode: 'arriving', mood: 'neutral', reason: null, pause: 0, hop: 0
    });
    const inLine = state.customers.filter((o) => o.queueIndex >= 0).length;
    if (order === null || inLine >= queueSpotCount()) {
      // Nothing left to sell, or no room in line: look in from the path and leave at no cost.
      c.mode = 'passing';
      routeToPassStop(c);
      state.customers.push(c);
      state.today.past += 1;
      state.stats.past += 1;
      emit('walk_past', { id: c.id, reason: order === null ? 'soldout' : 'full' });
      return;
    }
    c.queueIndex = inLine;
    routeToSpot(c, c.queueIndex);
    state.customers.push(c);
    emit('customer_arrived', { id: c.id, meat: c.want });
  }

  // Stage 2 customer walking. Returns nothing; customers reaching a spot switch to waiting.
  function moveCustomers(dt) {
    const keep = [];
    for (const c of state.customers) {
      if (c.hop > 0) c.hop = Math.max(0, c.hop - dt);
      if (c.pause > 0) {
        c.pause = Math.max(0, c.pause - dt);
        c.walking = false;
        if (c.pause === 0) {
          if (c.mode === 'passing') { routeOut(c); }
          else if (c.mode === 'leaving') { routeOut(c); }
        }
        keep.push(c);
        continue;
      }
      advanceMover(c, C.NPC_TILES_PER_S, dt);
      if (c.next === null && c.path.length === 0) {
        if (c.mode === 'arriving') {
          c.mode = 'waiting';
        } else if (c.mode === 'passing') {
          if (c.y === MAP.passStop.y) {
            c.pause = C.WALK_PAST_PAUSE;
            c.face = 'down';
          } else if (c.y <= MAP.custSpawn.y) {
            continue;   // out of the yard
          }
        } else if (c.mode === 'leaving') {
          if (c.y <= MAP.custSpawn.y) continue;
        }
      }
      keep.push(c);
    }
    state.customers = keep;
  }

  // Stage 5 patience drain, walk outs, close time.
  function customersStage(dt) {
    serveLine();
    for (const c of waitingCustomers()) {
      c.wait += dt;
      c.patience -= dt;
      if (c.patience <= 0) {
        c.patience = 0;
        state.today.walkouts += 1;
        state.stats.walkouts += 1;
        leaveLine(c, 'walkout');
        c.mood = 'unhappy';
        emit('walk_out', { id: c.id });
      } else if (c.patience <= c.patienceMax * C.PATIENCE_WARN_FRAC && c.mood === 'neutral') {
        c.mood = 'unhappy';
      }
    }
  }

  function closeOutLine() {
    for (const c of lineCustomers()) {
      state.today.close += 1;
      leaveLine(c, 'close');
      c.mood = 'neutral';
      emit('left_at_close', { id: c.id });
    }
  }

  // ---- 5.8 the buddy ------------------------------------------------------------------------

  function tickBuddy(dt) {
    const b = state.buddy;
    if (!b) return;
    if (b.task === 'idle') {
      const stack = chooseBoardStack();
      if (stack && tableFits(stack.meat)) {
        buddyPick = stack.meat;
        b.task = 'pickup';
        b.t = C.BUDDY_HANDLE;
      }
      return;
    }
    if (b.task === 'pickup') {
      b.t -= dt;
      if (b.t > 0) return;
      const stack = buddyPick ? boardStackOf(buddyPick) : null;
      if (!stack || stack.times.length === 0) {
        buddyPick = null;
        b.task = 'idle';
        b.t = 0;
        return;
      }
      const times = takeFromBoardStack(stack, 1);
      b.carrying = { kind: 'plates', meat: stack.meat, times };
      buddyPick = null;
      const useTile = STATION_BY_ID.table.use[1];
      const path = bfs(b.x, b.y, (x, y) => x === useTile.x && y === useTile.y);
      if (path === null) {
        // Cannot reach the table: put the plate back and idle.
        addToBoard(b.carrying.meat, b.carrying.times);
        b.carrying = null;
        b.task = 'idle';
        return;
      }
      b.path = path;
      b.task = 'carry';
      return;
    }
    if (b.task === 'carry') {
      advanceMover(b, C.NPC_TILES_PER_S, dt);
      if (b.next === null && b.path.length === 0) {
        b.face = 'up';
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
      if (b.t > 0) return;
      const home = MAP.buddyIdle;
      const path = bfs(b.x, b.y, (x, y) => x === home.x && y === home.y);
      b.path = path || [];
      b.task = 'return';
      return;
    }
    if (b.task === 'return') {
      advanceMover(b, C.NPC_TILES_PER_S, dt);
      if (b.next === null && b.path.length === 0) {
        b.face = 'left';
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
      const path = bfs(t.x, t.y, (x, y) => uses.some((u) => u.x === x && u.y === y));
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
      t.path = bfs(t.x, t.y, (x, y) => x === home.x && y === home.y) || [];
      t.task = 'return';
      return;
    }
    if (t.task === 'return') {
      advanceMover(t, C.NPC_TILES_PER_S, dt);
      if (t.next === null && t.path.length === 0) {
        t.face = 'right';
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
        ck.fire = Math.max(0, ck.fire - STATION_BY_ID[id].decay);
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
      for (const pc of ck.pieces) {
        if (pc.state === 'burnt') continue;
        const m = MEATS[pc.meat];
        pc.prog += mult * dt;
        if (pc.state === 'cooking' && pc.prog >= m.cook) {
          pc.state = 'done';
          emit('piece_done', { cooker: id, meat: pc.meat });
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
  let gateOpenFired = false;

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

  function dayShouldEnd() {
    if (state.clock + 1e-9 >= C.DAY_SECONDS) return true;
    if (state.clock + 1e-9 >= C.GATE_OPENS && soldOut()) return true;
    if (state.clock + 1e-9 >= C.LAST_CALL) {
      return !state.customers.some((c) => c.mode === 'arriving' || c.mode === 'waiting');
    }
    return false;
  }

  function tick() {
    if (state.phase !== 'service' || state.paused) return;
    const dt = C.TICK_SECONDS;
    tickCount += 1;
    state.clock = tickCount * C.TICK_SECONDS;
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
      endDay();
      return;
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
    const rawDelta = t.happy * C.REP_QUICK + t.ok * C.REP_OK + t.walkouts * C.REP_WALKOUT + t.close * C.CLOSE_PENALTY;
    const repDelta = clamp(rawDelta, C.REP_DAY_MIN, C.REP_DAY_MAX);
    const repCapped = repDelta !== rawDelta;
    const repEnd = clamp(state.rep + repDelta, 0, 100);
    state.rep = repEnd;
    const net = t.revenue + t.tips - t.wages - C.DAILY_COSTS;
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
    till.net = net;
    till.cashAfter = state.cash;
    state.till = till;
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
      emit('purchase', { id, label: rowDef.label, price: rowDef.price });
      emit('save_wanted', { reason: 'gear' });
      updateComingNext(false);
      return { ok: true, message: 'Bought ' + rowDef.label + '.' };
    }
    if (rowDef.kind === 'goal') return { ok: false, message: 'Not built in this prototype.' };
    return { ok: false, message: '' };
  }

  function reconfigureYard() {
    rebuildBlocked();
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
    state.gear[id] = false;
    emit('sell', { id, label: rowDef.label, price });
    return { label: rowDef.label, price };
  }

  function sell(id) {
    if (!(state.phase === 'morning' && state.broke)) return { ok: false, message: '', price: 0 };
    if (!GEAR_IDS.includes(id) || state.gear[id] !== true) return { ok: false, message: '', price: 0 };
    const sales = [];
    if (id === 'kettle2' && state.gear.drum) {
      sales.push(sellOne('kettle2'));
      sales.push(sellDrum());
    } else if (id === 'drum') {
      sales.push(sellDrum());
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
    state.spawnAt = C.GATE_OPENS;
    state.arrivals = 0;
    state.lastCallFired = false;
    state.gateSoonFired = false;
    state.customers = [];
    for (const id of COOKER_IDS) { state.stations[id] = newCooker(id); decayAcc[id] = 0; }
    state.stations.board = { stacks: [], slicing: null };
    state.stations.table = { spots: new Array(tableSpotCount()).fill(null) };
    state.player = Object.assign(newMover(MAP.spawn.x, MAP.spawn.y, MAP.spawn.face), { carrying: null, busy: null, target: null, queued: null });
    state.today = newToday();
    state.today.repStart = state.rep;
    state.today.wageNames = [];
    if (state.hires.buddy) {
      state.buddy = Object.assign(newMover(MAP.buddyIdle.x, MAP.buddyIdle.y, 'left'), { carrying: null, task: 'idle', t: 0 });
      state.today.wageNames.push(STRINGS.hireLabel.buddy);
    } else state.buddy = null;
    if (state.hires.tender && state.gear.drum) {
      state.tender = Object.assign(newMover(MAP.tenderIdle.x, MAP.tenderIdle.y, 'right'), { carrying: null, task: 'idle', t: 0, cooker: null, cooldown: 0 });
      state.today.wageNames.push(STRINGS.hireLabel.tender);
    } else state.tender = null;
    if (!(state.stock[state.selected] > 0)) autoSelect();
    rebuildBlocked();
    emit('save_wanted', { reason: 'open' });
    emit('yard_open');
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
  }

  function drainEvents() {
    const out = events.slice();
    events.length = 0;
    return out;
  }

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
    out.hires = {};
    for (const h of HIRE_IDS) out.hires[h] = state.hires[h] === true;
    if (!out.gear.drum) out.hires.tender = false;
    if (!out.gear.drum) out.stock.brisket = 0;
    out.stats = {};
    for (const k of STAT_IDS) out.stats[k] = clamp(Math.trunc(state.stats[k]), 0, C.MAX_STAT);
    out.drivewayShown = state.drivewayShown === true;
    return out;
  }

  // ---- assemble -----------------------------------------------------------------------------

  fillState(saved && typeof saved === 'object' ? saved : null);
  beginMorning();

  const sim = {
    state,
    seed: seedUsed,
    step, tick, walkTo, move, interact, verbAt, holding, walkable, reach,
    selectMeat, cycleMeat, buy, hire, sell, cartTotal, canOpen, openGate,
    continueFromTill, continueFromBroke, dismissComingNext, goal, setPaused, reset,
    drainEvents, serialize, rng, expectedCrowd
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
