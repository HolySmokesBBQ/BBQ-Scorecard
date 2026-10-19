// game.js: input, canvas rendering, DOM panels, aria-live, save hooks, pause, feedback, the dog.
// Contract: docs/superpowers/specs/2026-10-18-pit-sim-contract.md, v2 delta D11 (calls only), D12, D13, D14.
// Design:   docs/superpowers/specs/2026-10-18-pit-sim-design.md, v2 section [V2.9], [V2.12], [V2.13], [V2.16].
//
// Deviations (nothing added to the shared surface; PitSim.game is exactly D14):
//  1. Cooking arcs are a 12 by 12 one pixel ring around each grate piece, filled clockwise
//     from the top (v1 deviation 3, kept). Orange while cooking, green for the done window,
//     near black when burnt.
//  2. The fire gauge (V2.3, x = first tile px + 18, 3 px wide, sprite top + 4 to its bottom) is
//     an outline colored track with the band color filling its full width from the bottom and a
//     cream pixel at each edge for the 50 and 85 ticks. Since review round 2 it is drawn with its
//     cooker in the y-sorted pass, so a player on a use tile in front of the cooker covers it.
//  3. Cosmetic randomness comes from a local mulberry32 seeded from sim.seed (now the rule, D8).
//  4. The v1 two pixel bounce on a change of hands is gone; the v2 squash on an accepted tap
//     replaces it. The action button still scales down for 0.1 s on a successful press (DOM
//     only, off under reduced motion).
//  5. Ids #howto-btn, #howto-close and #crowd (v1 deviation 6) stay. #seats (D14) is created
//     here inside #clip-top, right under #goal, before #crowd.
//  6. walk_past with reason 'soldout' reads "Someone looked in. Nothing left to sell." and the
//     till's People line adds "Looked in, sold out {n}." when that count is not zero (v1 deviation 7).
//  7. Tap ring (v1 deviation 8): a one pixel 16 by 16 ring, yellow when walkTo took the tap,
//     orange when refused, dropping to its four corners after 0.6 of C.FX.TAP_RING_S; reduced
//     motion keeps the full ring. It is drawn on the tile handed to walkTo, which is the
//     station's first tile when a station's drawn box was hit (D13).
//  8. Patience bar (v1 deviation 9) at the V2.9 position: three colors, and under the warn
//     fraction the order icon blinks at 2 Hz unless reduced motion is on.
//  9. A gear or decor row whose buy would leave less than C.GEAR_RESERVE says so in its effect
//     line before the tap (v1 deviation 10, extended to decor per V2.7).
// 10. Till order (v1 deviation 11) and P resuming from the pause panel (v1 deviation 12) stay.
// 11. YOUR PIT is drawn right after the sign sprite inside the y-sorted pass instead of in
//     pass 8, so a pitmaster standing on row 1 in front of the sign covers the text rather
//     than the text printing over the head. Position MAP.signText, art.text, cream.
// 12. fxLog entries for the continuous emitters are one per stream, not one per sprite: a
//     'puff' when a cooker's chimney stream starts, a 'column' when a burnt piece's smoke
//     column starts, a 'sweat' when a waiting customer starts sweating, a 'zzz' when the
//     buddy's zzz starts, a 'bird' per visit. Sparkles log one entry each (three per serve).
//     This keeps the 500 entry log from filling with puffs between the entries a harness reads.
// 13. A draw whose box crosses a canvas edge is skipped unless it is a person, shadow or hand
//     overlay (the D15 step 33 exception); a draw wholly outside is never issued (D14). The back
//     fence row (y = 0) draws the 16 px fence_back sprite at y = 0, so no fence piece crosses an edge.
// 14. Transient effects (numbers, sparkles, hearts, puffs, rings, marks, sweat, zzz, bird) are
//     cleared when the yard opens, when the next morning starts and on a new game, so the
//     frozen evening yard does not carry into the next morning.
// 15. "Station px, station py" in V2.9 (chimney vents) is read as the top left pixel of the
//     station's first tile, the same origin as slotPx; "sprite top" is the station's draw y.
// 16. index.html: the one rule is @media (max-width: 899px) { #wrap { margin: 0 -8px; width: auto; } }.
//     width: auto is added inside it because the shell's #wrap { width: 100% } would keep the box
//     at the column width and the negative margins would only move it 8 px left, putting the
//     canvas off center; with width auto the stage's flex column stretches it to the column plus 16 px.
// 17. Review round 1 (2026-10-18, now contract D12 and D14):
//     a. Floating numbers are drawn by popText: a 1 px outline box and an umber box behind the
//        glyphs. Cash is yellow, the counter tip white, the seat tip pink.
//     b. The heart sits on the seat's column at (seat x, seat y - 24) and is drawn at 2x (16 by 16);
//        the seat tip number sits left of the seat at (seat x - 30, seat y - 22).
//     c. Unowned gear and decor footprints draw a ghost of what will stand there at GHOST_ALPHA
//        under their dashed outline (layer 1, the footprint's sort key); captureFrame marks those
//        records ghost: true. The dashed outline is drawn in the outline color on pavers and cream
//        on the lawn and hedge.
//     d. PATH_TILES, the customer route from the gate to the line, is drawn with the paver sprite.
//        Render only: MAP.tiles and every walk rule are unchanged.
//     e. Chimney puffs are centered on the vent (the 8 px smoke sprite is drawn at vent x - 4) and
//        drift away from the cooler's column only, so kettle 1's stream stays off the cooler.
// 18. Review round 2 (2026-10-18, now contract D12, D13 and D14; replaces 17a to 17c where they differ):
//     a. D13 picks the scale in device pixels: k = floor(target * dpr) backing pixels per virtual
//        pixel (at least 1), CSS scale k / dpr, so every game pixel is exactly k device pixels
//        (412 px at dpr 2.625 gives k 5 and a 335 CSS px canvas). The canvas is nudged with
//        position relative so its top left lands on a whole device pixel. 3x on desktop needs
//        room for #status, #act and #chips too (CONTROLS_H) or it falls back to the 2x rule.
//     b. Floating numbers are outlined text with no box: the string four times in the outline
//        color at 1 px offsets, then in its color. The cash number sits over the served customer
//        (the coin at the customer's px, the text after it, at py - 26; left aligned so a
//        pitmaster on (6,5) stays clear) and the tip number at the customer's px,
//        C.FX.TIP_GAP_PX (-11) above it; the seat tip sits over the heart at (seat x - 4,
//        seat y - 34). Every number is clamped inside the canvas. A number whose box overlaps one
//        that started under 0.5 s ago (within 8 px in y) starts 0.3 s later per such number,
//        at most 3; a heart within 12 px of one that started under 0.5 s ago starts 0.3 s later.
//     c. Ghosts of unowned gear and decor draw only in the morning and evening, at GHOST_ALPHA
//        0.5. The dashed outlines draw in every phase.
//     d. The unbought Flower bed draws bed frame 3 (tilled soil) on its footprint. Lawn tiles use
//        clover frame 1 inside unowned decor footprints and where (x * 5 + y * 3) % 3 === 0.
//        Hedge tiles alternate frames by x % 2 (frame 1 has blossoms).
//     e. Sparkles are drawn at 2x (14 by 14, centered on the old 7 by 7 spot). Order bubbles,
//        their icon and the walk out mark sit 2 px higher (bubble at px + 14, py - 22) and the
//        patience bar at py - 26, so a bubble no longer touches the next customer's head.
//     f. The dog skips a roam tile whose south neighbor is a taken seat.
//     g. The till's bold row is "Take today" (sales and tips after wages and daily costs); the
//        number is still till.net.
(function () {
'use strict';
const PitSim = globalThis.PitSim || (globalThis.PitSim = {});

const VERSION = '0.3.0';

const FALLBACK_COLOR = {
  K: '#1b1714', U: '#2a2015', C: '#E6D8B8', O: '#D06129', outline: '#3b2417', woodD: '#7a4a26', woodM: '#a8693a',
  woodL: '#d79a5b', paver: '#e8c890', paverD: '#c9a46b', lawnA: '#6cc24a', lawnB: '#4fa83d', leafD: '#2f7a32',
  leafL: '#a6e05a', cloth: '#5bb8f0', clothD: '#3a86c8', white: '#fbf7ef', pink: '#f27aa8', magenta: '#d94a8c',
  yellow: '#ffd84a', skinL: '#f6c49a', skinM: '#d9935f', skinD: '#8f5634', red: '#d8402f', raw: '#f29a9a',
  cooking: '#d0663e', done: '#8e3b1f', steelL: '#9aa4ae', steelD: '#4d5560', smokeL: '#ddd8cf', smokeD: '#6e6863'
};

const SHELL_IDS = [
  'root', 'hdr', 'title', 'hud-day', 'hud-cash', 'hud-rep', 'stage', 'wrap', 'cv', 'status',
  'act', 'chips', 'panels', 'clipboard', 'clipboard-h', 'clip-top', 'shop', 'hire', 'clip-foot',
  'till', 'till-h', 'till-body', 'pause', 'pause-h', 'pause-body', 'howto', 'howto-h', 'howto-body',
  'newgame', 'newgame-h', 'newgame-body', 'broke', 'broke-h', 'broke-body', 'foot', 'live'
];
const PANEL_IDS = ['clipboard', 'till', 'pause', 'newgame', 'broke'];
const BAND_FRAME = { out: 0, low: 1, good: 2, hot: 3 };
const DIRS = {
  ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
  w: 'up', a: 'left', s: 'down', d: 'right'
};
const KEY_HELP = [
  ['Arrow keys, W A S D', 'Move one tile a press. Hold a key to keep walking. Walking into a station turns you to face it.'],
  ['Space, E', 'Do what the action button says.'],
  ['1 to 5', 'Pick sausage, chicken, ribs, pork butt or brisket.'],
  ['Q, Shift+Q', 'Next or previous meat.'],
  ['Escape, P', 'Pause and resume.'],
  ['Tap the yard', 'Walk there. Tap a station to walk over and use it.']
];
const BOARD_OFFS = [[1, 3], [8, 3], [1, 9], [8, 9]];      // board stacks, from the board's draw px
const SPARKLE_OFFS = [[-3, -4], [6, -7], [2, 2]];          // from the served plate spot
const BURST_OFFS = [[-3, 0], [0, -2], [3, 0]];             // from the burnt piece
const FX_LOG_MAX = 500;
const LAWN_FROM_ROW = 6;                                   // fence, hedge and bed tiles sit on lawn from this row down
const OVERFLOW_OK = /^(shadow|hand_|player_|buddy_|tender_|cust[0-9]_)/;
const GHOST_ALPHA = 0.5;                                   // unowned gear and decor, morning and evening only
const CONTROLS_H = 24 + 48 + 52 + 8;                       // #status, #act, #chips with its margin, slack (D13 3x test)
const CASH_ABOVE_PX = 26;                                  // the cash number sits at the served customer's py - 26
const STAGGER_S = 0.3;                                     // a number or heart that would overlap a fresh one waits this long
const STAGGER_WINDOW_S = 0.5;
const STAGGER_MAX = 3;
const PATH_TILES = new Set(['9,10', '9,9', '9,8', '9,7', '8,7', '7,7']);   // customer route, drawn as pavers
const SMOKE_HALF_W = 4;                                    // chimney puffs are centered on the vent

// Perimeter of a 12 by 12 ring, clockwise from the top center (44 pixels).
const RING = (function () {
  const n = 12, pts = [];
  for (let x = 6; x < n; x++) pts.push([x, 0]);
  for (let y = 1; y < n; y++) pts.push([n - 1, y]);
  for (let x = n - 2; x >= 0; x--) pts.push([x, n - 1]);
  for (let y = n - 2; y >= 1; y--) pts.push([0, y]);
  for (let x = 0; x < 6; x++) pts.push([x, 0]);
  return pts;
})();

// Page state.
const el = {};
let sim = null;
let C = null, FX = null, MAP = null, MEATS = null, MEAT_IDS = null, CATALOG = null, STRINGS = null, art = null, COLOR = null;
let VW = 176, VH = 192, TILE = 16;
let off = null, octx = null, vctx = null, kpx = 1;
let mqReduced = null, mqDesktop = null;
let reduced = false, saveOff = false, saveOffNoted = false, migrated = false;
let last = null, rafId = 0, tAnim = 0, nowMs = 0, stopped = false;
let currentPanel = null, returnPanel = null;
let howtoOpen = false, howtoFrom = null, howtoClose = null;
const held = new Set();
let crng = null; // cosmetic rng
const SEAT_BY_ID = Object.create(null);
let extTile = null; // the table tile that comes with the Bigger table

// Effects. Every start time is on the effect clock tAnim, which stops while the game is
// paused and while a panel is open (the frozen yard of V2.9).
const nums = [];       // { kind, str, x, y, color, coin, at }   x, y is the text position at rest
const sparkles = [];   // { x, y, at }
const hearts = [];     // { x, y, at }
const puffs = [];      // { x0, y0, vx, rise, life, at, dark, sway }
const rings = [];      // { x, y, at, ok }
const markX = new Map();   // customer id -> tAnim when the mark ends
const sweatAt = new Map(); // customer id -> tAnim when the sweat started
const puffT = {}, puffOn = {};
const columnT = new Map(); // cooker:piece -> seconds to the next column puff
let rainDrops = null;
let squashAt = -1;
let zzzSince = null, zzzAt = -1;
let birdNext = 0, birdUntil = -1;
let shakeUntil = 0, blockedUntil = 0, lastCallUntil = 0, saveOffUntil = 0, noticeUntil = 0;
// Walk pasts with reason 'soldout' this day, counted from events (today.past holds both
// reasons). Reset when the yard opens; a reload during the evening shows them as line full.
let pastSoldOut = 0;
const fxLog = [];

// The dog: the live object of D14 holds only its six fields; the walk state lives beside it.
const dog = { x: 4, y: 7, px: 64, py: 112, frame: 2, flip: false };
const dogAI = { path: [], next: null, wait: 0, anim: 0 };

// Draw records for captureFrame (D14).
let capturing = false;
let recs = [];
const SIZE = Object.create(null);

// Live region.
const liveQueue = [];
const liveRecent = new Map();
let liveLastAt = -Infinity;

// DOM caches.
const chipEls = {};
const chipSig = {};
const lastHud = { day: '', cash: '', rep: '' };
let lastAct = null, lastActDis = null, lastStatus = null, lastPhase = '', lastPaused = null, lastHow = null;
let clip = null;

// ---------------------------------------------------------------- helpers

function mk(tag, opts, children) {
  const e = document.createElement(tag);
  if (opts) {
    if (opts.id) e.id = opts.id;
    if (opts.cls) e.className = opts.cls;
    if (opts.text !== undefined && opts.text !== null) e.textContent = String(opts.text);
    if (opts.type) e.type = opts.type;
    if (opts.attrs) for (const k in opts.attrs) e.setAttribute(k, opts.attrs[k]);
    if (opts.on) e.addEventListener('click', opts.on);
  }
  if (children) {
    for (let i = 0; i < children.length; i++) {
      const c = children[i];
      if (c === null || c === undefined || c === false) continue;
      e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    }
  }
  return e;
}
function btn(id, text, cls, on) { return mk('button', { id: id, text: text, cls: cls, type: 'button', on: on }); }
function clear(e) { while (e.firstChild) e.removeChild(e.firstChild); }
function h3(text) { return mk('h3', { text: text }); }
function stars(rep) {
  const n = Math.max(0, Math.min(5, Math.round((rep || 0) / 20)));
  return '★'.repeat(n) + '☆'.repeat(5 - n);
}
function signed(n) { return n >= 0 ? '+' + n : String(n); }
function plural(n, one, many) { return n + ' ' + (n === 1 ? one : many); }
function meatList(counts) {
  const parts = [];
  for (let i = 0; i < MEAT_IDS.length; i++) {
    const id = MEAT_IDS[i];
    const n = counts && counts[id] ? counts[id] : 0;
    if (n > 0) parts.push(n + ' ' + MEATS[id].label);
  }
  return parts.join(', ');
}
function iconCanvas(name) {
  if (!art.has(name)) return null;
  const c = art.canvasFor(name, 0, 2);
  c.setAttribute('aria-hidden', 'true');
  c.style.display = 'inline-block';
  c.style.verticalAlign = 'middle';
  c.style.marginRight = '6px';
  c.style.imageRendering = 'pixelated';
  return c;
}
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function owned(entry) { return PitSim.tileOwned(entry, sim.state.gear, sim.state.decor); }
function custById(id) {
  const list = sim.state.customers;
  for (let i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
  return null;
}
function byId(a, b) { return a.id - b.id; }
function isChairSeat(seat) { return seat.decor === 'chair1' || seat.decor === 'chair2'; }
function easeOut(t) { const u = 1 - Math.max(0, Math.min(1, t)); return 1 - u * u; }

// ---------------------------------------------------------------- boot

function boot() {
  for (let i = 0; i < SHELL_IDS.length; i++) {
    const e = document.getElementById(SHELL_IDS[i]);
    if (e) el[SHELL_IDS[i]] = e;
  }
  const missing = SHELL_IDS.filter(function (id) { return !el[id]; });
  if (missing.length) {
    console.error('pit-sim: the shell is missing #' + missing.join(', #'));
    if (el.status) el.status.textContent = 'The page shell is missing ' + missing[0] + '.';
    return;
  }
  nowMs = (typeof performance !== 'undefined' && performance.now) ? performance.now() : 0;
  if (!PitSim.art || typeof PitSim.art.build !== 'function' || typeof PitSim.createSim !== 'function') {
    el.status.textContent = 'Game files did not load.';
    console.error('pit-sim: sprites.js or sim.js did not attach to PitSim');
    return;
  }
  art = PitSim.art;
  try {
    art.build();
  } catch (e) {
    el.status.textContent = String((e && e.message) || e);
    console.error(e);
    return;
  }
  C = PitSim.C; FX = C.FX; MAP = PitSim.MAP; MEATS = PitSim.MEATS; MEAT_IDS = PitSim.MEAT_IDS;
  CATALOG = PitSim.CATALOG; STRINGS = PitSim.STRINGS;
  COLOR = Object.assign({}, FALLBACK_COLOR, art.COLOR || {});
  TILE = MAP.TILE || 16;
  VW = MAP.W * TILE; VH = MAP.H * TILE;
  for (let i = 0; i < MAP.seats.length; i++) SEAT_BY_ID[MAP.seats[i].id] = MAP.seats[i];
  const table = MAP.station('table');
  extTile = null;
  for (let i = 0; i < table.tiles.length; i++) if (table.tiles[i].gear === 'bigtable') extTile = table.tiles[i];

  const saved = readSave();
  const seed = readSeed();
  sim = PitSim.createSim(saved, seed);
  crng = mulberry32((sim.seed >>> 0) ^ 0x9E3779B9);
  birdNext = birdGap();
  dogReset(2);

  setupMedia();
  buildStatic();
  setupCanvas();
  setupInput();
  showMorning();
  pump();
  if (saveOff) noteSaveOff();
  if (migrated) {
    noticeUntil = nowMs + FX.NOTICE_S * 1000;
    announce('Your save was updated for the new yard.');
    writeSave();
  }
  exposeGame();
  observe();
  rafId = requestAnimationFrame(frame);
}

function readSave() {
  migrated = false;
  let raw = null;
  try { raw = localStorage.getItem(PitSim.SAVE_KEY); } catch (e) { saveOff = true; return null; }
  if (!raw) return null;
  let parsed = null;
  try { parsed = JSON.parse(raw); } catch (e) { return null; }
  const wasV1 = !!(parsed && typeof parsed === 'object' && !Array.isArray(parsed) && parsed.v === 1);
  let valid = null;
  try { valid = PitSim.validateSave(parsed); } catch (e) { valid = null; }
  migrated = wasV1 && valid !== null;
  return valid;
}

function readSeed() {
  try {
    const q = new URLSearchParams(location.search).get('seed');
    if (q === null || q === '') return undefined;
    const n = Number(q);
    return Number.isFinite(n) ? Math.trunc(n) : undefined;
  } catch (e) { return undefined; }
}

function exposeGame() {
  PitSim.game = {
    version: VERSION,
    sim: sim,
    el: el,
    advance: advance,
    get reduced() { return reduced; },
    get saveOff() { return saveOff; },
    dog: dog,
    fxLog: fxLog,
    captureFrame: captureFrame
  };
}

// Steps the sim, pumps events once, then refreshes the DOM and draws one frame (D14).
function advance(seconds) {
  const n = Math.max(0, Math.round((Number(seconds) || 0) / C.TICK_SECONDS));
  for (let i = 0; i < n; i++) sim.tick();
  pump();
  observe();
  updateDom();
  try { render(); } catch (e) { fail(e); }
}

// Renders the current state once without moving any timer and returns what it drew.
function captureFrame() {
  recs = [];
  capturing = true;
  try { render(); } finally { capturing = false; }
  return recs;
}

function setupMedia() {
  mqReduced = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
  mqDesktop = window.matchMedia ? window.matchMedia('(min-width: 900px)') : null;
  reduced = !!(mqReduced && mqReduced.matches);
  const onR = function () {
    reduced = !!(mqReduced && mqReduced.matches);
    if (reduced) {
      puffs.length = 0; sparkles.length = 0; squashAt = -1; shakeUntil = 0; birdUntil = -1;
      dogReset(2);
    }
  };
  const onD = function () { resize(); syncPanels(); };
  listenMq(mqReduced, onR);
  listenMq(mqDesktop, onD);
}
function listenMq(mq, fn) {
  if (!mq) return;
  if (mq.addEventListener) mq.addEventListener('change', fn);
  else if (mq.addListener) mq.addListener(fn);
}

// ---------------------------------------------------------------- canvas

function setupCanvas() {
  off = document.createElement('canvas');
  off.width = VW; off.height = VH;
  octx = off.getContext('2d');
  vctx = el.cv.getContext('2d');
  resize();
  window.addEventListener('resize', resize);
  window.addEventListener('orientationchange', resize);
}

// D13 (review round 2): the target CSS scale is 3 on desktop when the canvas and the controls
// under it fit, 2 on phones (8 px canvas gutters), the fit width below 368 px; the backing store
// takes floor(target * dpr) device pixels per game pixel and the CSS size follows from that, so
// every game pixel is a whole number of device pixels.
function resize() {
  const vw = document.documentElement.clientWidth || window.innerWidth || 375;
  const vh = window.innerHeight || 0;
  const dpr = window.devicePixelRatio || 1;
  let target;
  if (vw >= 900 && vh - 44 - 16 - CONTROLS_H >= VH * 3) target = 3;
  else if (vw - 16 >= VW * 2) target = 2;
  else target = Math.max(0.25, (vw - 16) / VW);
  kpx = Math.max(1, Math.floor(target * dpr + 1e-6));
  const css = kpx / dpr;
  el.cv.width = VW * kpx;
  el.cv.height = VH * kpx;
  el.cv.style.width = (VW * css) + 'px';
  el.cv.style.height = (VH * css) + 'px';
  snapCanvas(dpr);
  vctx.imageSmoothingEnabled = false;
  octx.imageSmoothingEnabled = false;
  if (sim) { try { render(); } catch (e) { fail(e); } }
}

// Nudge the canvas so its top left corner lands on a whole device pixel.
function snapCanvas(dpr) {
  const st = el.cv.style;
  st.position = 'relative';
  st.left = '0px';
  st.top = '0px';
  const r = el.cv.getBoundingClientRect();
  const fix = function (v) {
    const d = Math.round((Math.round(v * dpr) / dpr - v) * 10000) / 10000;
    return Math.abs(d) < 0.0001 ? 0 : d;
  };
  st.left = fix(r.left) + 'px';
  st.top = fix(r.top) + 'px';
}

// ---------------------------------------------------------------- frame loop

function frame(now) {
  if (stopped) return;
  rafId = requestAnimationFrame(frame);
  if (last === null) last = now;
  let dt = (now - last) / 1000;
  last = now;
  nowMs = now;
  if (!(dt >= 0)) dt = 0;
  if (dt > C.MAX_FRAME_DT) dt = C.MAX_FRAME_DT;

  let s = sim.state;
  if (held.size && !currentPanel && !s.paused && s.phase === 'service') {
    held.forEach(function (d) { sim.move(d); });
  }
  sim.step(dt);
  pump();
  observe();
  s = sim.state;
  const frozen = s.paused || currentPanel !== null || s.phase !== 'service';
  if (!frozen) {
    tAnim += dt;
    updateFx(dt);
  }
  try {
    render();
  } catch (e) {
    fail(e);
    return;
  }
  updateDom();
}

function fail(e) {
  stopped = true;
  cancelAnimationFrame(rafId);
  console.error(e);
  el.status.textContent = 'Drawing failed: ' + String((e && e.message) || e);
}

// ---------------------------------------------------------------- events

function pump() {
  const evs = sim.drainEvents();
  for (let i = 0; i < evs.length; i++) onEvent(evs[i]);
}

function onEvent(ev) {
  const L = ev.meat && MEATS[ev.meat] ? MEATS[ev.meat].label : '';
  const K = ev.cooker && STRINGS.cooker[ev.cooker] ? STRINGS.cooker[ev.cooker] : '';
  switch (ev.type) {
    case 'yard_open':
      announce('Yard open. Gate opens in ' + C.GATE_OPENS + ' seconds.');
      pastSoldOut = 0;
      clearFx();
      dogReset(3);
      closePanel();
      break;
    case 'gate_soon': announce('Gate opens in 10.'); break;
    case 'gate_open': announce('Gate open.'); break;
    case 'customer_arrived': announce('New customer wants ' + L + '.'); break;
    case 'piece_done': announce(L + ' is done on ' + K + '.'); break;
    case 'piece_burnt':
      announce(L + ' burnt on ' + K + '.');
      if (!reduced) {
        shakeUntil = nowMs + FX.SHAKE_MS;
        burntBurst(ev.cooker);
      }
      break;
    case 'served': onServed(ev, L); break;
    case 'seat_taken': break;
    case 'to_go': announce('No free seat. They took it to go.'); break;
    case 'seat_done': onSeatDone(ev); break;
    case 'walk_out': {
      announce('A customer walked out.');
      markX.set(ev.id, tAnim + FX.WALKOUT_MARK_S);
      const c = custById(ev.id);
      if (c) log('mark', Math.round(c.px) + 18, Math.round(c.py) - 20);
      break;
    }
    case 'walk_past':
      if (ev.reason === 'soldout') pastSoldOut += 1;
      announce(ev.reason === 'soldout' ? 'Someone looked in. Nothing left to sell.' : 'Someone walked past. The line is full.');
      break;
    case 'fire_low': announce('Fire low on ' + K + '.'); break;
    case 'fire_out': announce('Fire out on ' + K + '.'); break;
    case 'last_call':
      announce('Last call. No more customers today.');
      lastCallUntil = nowMs + 3000;
      break;
    case 'day_over':
      announce('Day over. Opening the till.');
      openTill();
      break;
    case 'purchase':
      announce('Bought ' + ev.label + '.');
      if (currentPanel === 'clipboard') rebuildClipboardKeepFocus();
      break;
    case 'hire':
      announce(ev.hired ? 'Hired ' + ev.label + '.' : 'Let ' + ev.label + ' go.');
      refreshClipboard();
      break;
    case 'sell':
      announce('Sold ' + ev.label + ' for ' + ev.price + '.');
      if (currentPanel === 'broke') buildBroke();
      break;
    case 'coming_next':
      announce('You can afford the driveway pop-up. It is the next rung and is not built yet.');
      break;
    case 'broke':
      announce('Broke. Sell gear or start over.');
      openBroke();
      break;
    case 'save_wanted': writeSave(); break;
    case 'save_clear': clearSave(); break;
    case 'blocked': blockedUntil = nowMs + 1500; break;
    default: break;
  }
}

function onServed(ev, L) {
  announce(ev.tip > 0
    ? 'Served ' + L + ', ' + ev.price + ' plus ' + ev.tip + ' tip.'
    : 'Served ' + L + ', ' + ev.price + ', no tip.');
  const x = Math.round(Number(ev.x) || 0), y = Math.round(Number(ev.y) || 0);
  // Over the served customer (round 2), falling back to the plate spot.
  const cu = custById(ev.id);
  const cashStr = '+' + ev.price;
  let nx = x, ny = y - 6;
  if (cu) {
    nx = Math.round(cu.px) + 9;     // the coin on the customer's left edge, the text after it
    ny = Math.round(cu.py) - CASH_ABOVE_PX;
  }
  addNum('cash', cashStr, numX(nx, cashStr, true), Math.max(1, ny), 'yellow', true);
  if (ev.tip > 0) {
    const tipStr = '+' + ev.tip + ' TIP';
    const tx = cu ? Math.round(cu.px) : nx;
    addNum('tip', tipStr, numX(tx, tipStr, false), Math.max(1, ny + FX.TIP_GAP_PX), 'white', false);
  }
  if (!reduced) {
    for (let i = 0; i < SPARKLE_OFFS.length; i++) {
      const sx = x + SPARKLE_OFFS[i][0], sy = y + SPARKLE_OFFS[i][1];
      sparkles.push({ x: sx, y: sy, at: tAnim + i * FX.SPARKLE_STAGGER_S });
      log('sparkle', sx, sy);
    }
    if (sparkles.length > 24) sparkles.splice(0, sparkles.length - 24);
    const c = custById(ev.id);
    if (c) log('hop', Math.round(c.px), Math.round(c.py) - 10);
  }
}

function onSeatDone(ev) {
  if (ev.atClose) return;
  announce('A seated customer tipped ' + ev.bonus + ' more.');
  const x = Math.round(Number(ev.x) || 0), y = Math.round(Number(ev.y) || 0);
  let k = 0;
  for (let i = 0; i < hearts.length; i++) {
    const h = hearts[i];
    if (tAnim - h.at < STAGGER_WINDOW_S && Math.abs(h.x - x) <= 12 && Math.abs(h.y - (y - 24)) <= 8) k++;
  }
  hearts.push({ x: x, y: y - 24, at: tAnim + Math.min(STAGGER_MAX, k) * STAGGER_S });
  if (hearts.length > 8) hearts.shift();
  log('heart', x, y - 24);
  const str = '+' + ev.bonus + ' TIP';
  addNum('seatTip', str, numX(x - 4, str, false), Math.max(1, y - 34), 'pink', false);
}

// Clamp a number's text x so the text (and its coin) stays inside the canvas with its outline.
function numX(x, str, coin) {
  const w = art.textWidth(str);
  return Math.max(coin ? 10 : 1, Math.min(VW - w - 1, x));
}

// Numbers that would overlap one still fresh start STAGGER_S later per such number (round 2).
function addNum(kind, str, x, y, color, coin) {
  const x0 = coin ? x - 9 : x, x1 = x + art.textWidth(str);
  let k = 0;
  for (let i = 0; i < nums.length; i++) {
    const n = nums[i];
    if (tAnim - n.at >= STAGGER_WINDOW_S || Math.abs(n.y - y) >= 8) continue;
    const n0 = n.coin ? n.x - 9 : n.x, n1 = n.x + art.textWidth(n.str);
    if (n0 < x1 && x0 < n1) k++;
  }
  nums.push({ kind: kind, str: str, x: x, y: y, color: color, coin: coin, at: tAnim + Math.min(STAGGER_MAX, k) * STAGGER_S });
  if (nums.length > 16) nums.shift();
  log(kind, x, y);
}

function log(kind, x, y) {
  const s = sim.state;
  fxLog.push({ kind: kind, x: Math.round(x), y: Math.round(y), day: s.day, at: s.clock });
  if (fxLog.length > FX_LOG_MAX) fxLog.splice(0, fxLog.length - FX_LOG_MAX);
}

function announce(msg) {
  const prev = liveRecent.get(msg);
  if (prev !== undefined && nowMs - prev < 5000) return;
  if (liveQueue.indexOf(msg) !== -1) return;
  liveQueue.push(msg);
  liveRecent.set(msg, nowMs);
  if (liveQueue.length > 8) liveQueue.shift();
}

function flushLive() {
  if (!liveQueue.length) return;
  if (nowMs - liveLastAt < 1000) return;
  const msg = liveQueue.shift();
  liveLastAt = nowMs;
  liveRecent.set(msg, nowMs);
  el.live.textContent = msg;
  if (liveRecent.size > 64) {
    liveRecent.forEach(function (t, k) { if (nowMs - t > 5000) liveRecent.delete(k); });
  }
}

function writeSave() {
  try {
    localStorage.setItem(PitSim.SAVE_KEY, JSON.stringify(sim.serialize()));
  } catch (e) {
    noteSaveOff();
  }
}
function clearSave() {
  try { localStorage.removeItem(PitSim.SAVE_KEY); } catch (e) { noteSaveOff(); }
}
function noteSaveOff() {
  saveOff = true;
  if (saveOffNoted) return;
  saveOffNoted = true;
  saveOffUntil = nowMs + 4000;
  announce('Saving is off in this browser.');
}

// ---------------------------------------------------------------- panels

function openPanel(name, focusId) {
  howtoOpen = false; howtoFrom = null;
  for (let i = 0; i < PANEL_IDS.length; i++) el[PANEL_IDS[i]].hidden = PANEL_IDS[i] !== name;
  currentPanel = name;
  syncPanels();
  setInert(true);
  const f = focusId ? document.getElementById(focusId) : el[name + '-h'];
  if (f && typeof f.focus === 'function') f.focus();
}

function closePanel() {
  howtoOpen = false; howtoFrom = null;
  for (let i = 0; i < PANEL_IDS.length; i++) el[PANEL_IDS[i]].hidden = true;
  const was = currentPanel;
  currentPanel = null;
  syncPanels();
  setInert(false);
  if (was) focusBack();
}

function focusBack() {
  if (!el.act.disabled) el.act.focus();
  else el.cv.focus();
}

function setInert(on) {
  if (!('inert' in HTMLElement.prototype)) return;
  el.stage.inert = on;
  el.hdr.inert = on;
  el.foot.inert = on;
}

function wantHowto() {
  const desktop = !!(mqDesktop && mqDesktop.matches);
  return howtoOpen || currentPanel === 'pause' || (!currentPanel && desktop && sim.state.phase === 'service');
}

function syncPanels() {
  const showHow = wantHowto();
  if (el.howto.hidden !== !showHow) el.howto.hidden = !showHow;
  if (howtoClose && howtoClose.hidden !== !howtoOpen) howtoClose.hidden = !howtoOpen;
  const hidePanels = !currentPanel && !showHow;
  if (el.panels.hidden !== hidePanels) el.panels.hidden = hidePanels;
  lastHow = showHow;
}

// The Controls card in place of the open panel (phones never see the desktop side column).
function openHowto() {
  if (howtoOpen) return;
  howtoOpen = true;
  howtoFrom = currentPanel;
  if (howtoFrom) el[howtoFrom].hidden = true;
  syncPanels();
  el['howto-h'].focus();
}

function closeHowto() {
  if (!howtoOpen) return;
  howtoOpen = false;
  const back = howtoFrom;
  howtoFrom = null;
  const restore = back && currentPanel === back;
  if (restore) el[back].hidden = false;
  syncPanels();
  if (restore) {
    const b = document.getElementById('howto-btn');
    if (b && !b.disabled) b.focus(); else el[back + '-h'].focus();
  }
}

function showMorning() {
  if (sim.state.broke) openBroke();
  else openClipboard();
}

function togglePause() {
  const s = sim.state;
  if (s.phase !== 'service') return;
  if (s.paused) {
    sim.setPaused(false);
    closePanel();
  } else {
    sim.setPaused(true);
    openPanel('pause');
  }
  updateDom();
}

function resumeFromPause() {
  if (sim.state.paused) sim.setPaused(false);
  closePanel();
  updateDom();
}

function openConfirm(from) {
  returnPanel = from;
  openPanel('newgame', 'confirm-no');
}
function confirmNo() {
  const back = returnPanel;
  returnPanel = null;
  if (back && back !== 'newgame') openPanel(back);
  else closePanel();
}
function confirmYes() {
  held.clear();
  clearFx();
  fxLog.length = 0;
  returnPanel = null;
  sim.reset();
  sim.setPaused(false);
  dogReset(2);
  pump();
  showMorning();
  pump();
}

// ---------------------------------------------------------------- static DOM

function buildStatic() {
  clear(el.chips);
  for (let i = 0; i < MEAT_IDS.length; i++) {
    const id = MEAT_IDS[i];
    const b = mk('button', { id: 'chip-' + id, cls: 'chip', type: 'button' });
    const ic = iconCanvas('icon_' + id);
    if (ic) { ic.style.marginRight = '0'; b.appendChild(ic); }
    const cnt = mk('span', { text: '0' });
    b.appendChild(cnt);
    b.setAttribute('aria-pressed', 'false');
    b.setAttribute('aria-label', MEATS[id].label + ', 0 in stock');
    b.addEventListener('click', function () { sim.selectMeat(id); pump(); });
    el.chips.appendChild(b);
    chipEls[id] = { b: b, cnt: cnt };
    chipSig[id] = '';
  }

  el['pause-h'].textContent = 'Paused';
  clear(el['pause-body']);
  el['pause-body'].appendChild(btn('resume', 'Keep playing', 'primary', resumeFromPause));
  el['pause-body'].appendChild(btn('pause-new', 'New game', 'alt', function () { openConfirm('pause'); }));

  el['howto-h'].textContent = 'Controls';
  el['howto-h'].setAttribute('tabindex', '-1');
  clear(el['howto-body']);
  const dl = mk('dl', { cls: 'dl' });
  for (let i = 0; i < KEY_HELP.length; i++) {
    dl.appendChild(mk('dt', { text: KEY_HELP[i][0] }));
    dl.appendChild(mk('dd', { text: KEY_HELP[i][1] }));
  }
  el['howto-body'].appendChild(dl);
  howtoClose = btn('howto-close', 'Back', 'alt', closeHowto);
  howtoClose.hidden = true;
  el['howto-body'].appendChild(howtoClose);

  el['newgame-h'].textContent = 'Start over? This wipes the save.';
  clear(el['newgame-body']);
  el['newgame-body'].appendChild(btn('confirm-no', 'Keep playing', 'primary', confirmNo));
  el['newgame-body'].appendChild(btn('confirm-yes', 'Start over', 'alt', confirmYes));
}

// ---------------------------------------------------------------- clipboard

function openClipboard() {
  buildClipboard();
  if (currentPanel !== 'clipboard') openPanel('clipboard');
}

function rebuildClipboardKeepFocus() {
  const a = document.activeElement;
  const id = a && a.id ? a.id : null;
  buildClipboard();
  let f = id ? document.getElementById(id) : null;
  if (!f || f.disabled || f.tagName !== 'BUTTON') f = (!el.clipboard.hidden && clip && !clip.open.disabled) ? clip.open : el['clipboard-h'];
  if (f && typeof f.focus === 'function') f.focus();
}

function seatsLine() {
  return 'Seats ' + sim.seatCount() + '. Charm ' + sim.charm() + '. Each seated customer tips ' + sim.seatBonus() + ' more.';
}

function buildClipboard() {
  const s = sim.state;
  el['clipboard-h'].textContent = 'Morning';
  clear(el['clip-top']); clear(el.shop); clear(el.hire); clear(el['clip-foot']);
  clip = { rows: [], headText: null, seats: null, cart: null, open: null, why: null };

  // Header lines.
  clip.headText = document.createTextNode(headLine(s));
  const head = mk('p', null, [clip.headText, ' ', mk('span', { cls: 'stars', text: stars(s.rep), attrs: { 'aria-hidden': 'true' } })]);
  el['clip-top'].appendChild(head);
  if (s.day === 1) {
    el['clip-top'].appendChild(mk('p', { cls: 'muted', text: 'Tap the charcoal pile, then tap the kettle to light it. A second bag keeps the fire good through the first cook. Tap the cooler for meat and tap the kettle to put it on. When the check mark shows, pull it and slice it at the board. Plates go on the table.' }));
  }
  if (s.day >= C.RAIN_FROM_DAY) {
    const w = s.rain
      ? (s.gear.canopy ? 'Rain today. The canopy is up.' : 'Rain today. Fewer people come out unless the canopy is up.')
      : 'Clear today.';
    el['clip-top'].appendChild(mk('p', { text: w }));
  }
  if (s.comingNext) {
    const card = mk('div', { id: 'goal', cls: 'card' }, [
      mk('p', { text: 'Coming next: the driveway pop-up' }),
      mk('p', { text: 'Price ' + C.DRIVEWAY_PRICE + '. The backyard stays open as long as you like.' }),
      btn('goal-keep', 'Keep running the backyard', 'alt', function () {
        sim.dismissComingNext();
        pump();
        buildClipboard();
        el['clipboard-h'].focus();
      })
    ]);
    el['clip-top'].appendChild(card);
  } else {
    const g = sim.goal();
    el['clip-top'].appendChild(mk('p', { id: 'goal', text: g ? 'Next goal: ' + g.label + ', ' + g.price + '.' : '' }));
  }
  clip.seats = mk('p', { id: 'seats', text: seatsLine() });
  el['clip-top'].appendChild(clip.seats);
  if (typeof sim.expectedCrowd === 'function') {
    el['clip-top'].appendChild(mk('p', { id: 'crowd', text: 'Expect about ' + sim.expectedCrowd() + ' people today. One plate each.' }));
  }
  if (s.day >= 2 && s.yesterday) {
    const y = s.yesterday;
    el['clip-top'].appendChild(mk('p', { text: 'Yesterday: ' + y.served + ' served, ' + y.walkouts + ' walked out, ' + y.past + ' walked past.' }));
  }
  const inStock = meatList(s.stock);
  if (inStock) el['clip-top'].appendChild(mk('p', { text: 'In the cooler: ' + inStock + '.' }));

  // Shop.
  el.shop.appendChild(h3('Meat'));
  for (let i = 0; i < CATALOG.length; i++) if (CATALOG[i].kind === 'meat') el.shop.appendChild(cartRow(CATALOG[i]));
  el.shop.appendChild(mk('p', { cls: 'muted', text: 'Game numbers. Not real prices and not a cooking guide.' }));
  el.shop.appendChild(h3('Charcoal'));
  for (let i = 0; i < CATALOG.length; i++) if (CATALOG[i].kind === 'fuel') el.shop.appendChild(cartRow(CATALOG[i]));
  el.shop.appendChild(h3('Gear'));
  for (let i = 0; i < CATALOG.length; i++) if (CATALOG[i].kind === 'gear') el.shop.appendChild(ownRow(CATALOG[i]));
  for (let i = 0; i < CATALOG.length; i++) if (CATALOG[i].kind === 'goal') el.shop.appendChild(goalRow(CATALOG[i]));
  el.shop.appendChild(h3('Decor'));
  el.shop.appendChild(mk('p', { cls: 'muted', text: 'Charm adds to the tip each seated customer leaves, up to 3 more, and lets word of mouth climb a little faster.' }));
  for (let i = 0; i < CATALOG.length; i++) if (CATALOG[i].kind === 'decor') el.shop.appendChild(ownRow(CATALOG[i]));

  // Hires.
  el.hire.appendChild(h3('Hires'));
  for (let i = 0; i < CATALOG.length; i++) if (CATALOG[i].kind === 'hire') el.hire.appendChild(hireRow(CATALOG[i]));
  el.hire.appendChild(mk('div', { cls: 'row' }, [
    mk('span', { cls: 'name', text: 'Daily costs: ice and trash bags, ' + C.DAILY_COSTS + '.' })
  ]));

  // Foot.
  clip.cart = mk('p', { id: 'cart' });
  clip.open = btn('open', 'Open the yard', 'primary', onOpen);
  clip.why = mk('p', { id: 'open-why', cls: 'muted' });
  el['clip-foot'].appendChild(clip.cart);
  el['clip-foot'].appendChild(clip.open);
  el['clip-foot'].appendChild(clip.why);
  const how = btn('howto-btn', 'How to play', 'alt', openHowto);
  const fresh = btn('clip-new', 'New game', 'alt', function () { openConfirm('clipboard'); });
  how.style.flex = '1 1 0';
  fresh.style.flex = '1 1 0';
  el['clip-foot'].appendChild(mk('div', { cls: 'row' }, [how, fresh]));
  refreshClipboard();
}

function headLine(s) {
  return 'Day ' + s.day + '. Cash ' + s.cash + '. Word of mouth ' + s.rep + '.';
}

function refreshClipboard() {
  if (!clip) return;
  const s = sim.state;
  clip.headText.nodeValue = headLine(s);
  const seats = seatsLine();
  if (clip.seats.textContent !== seats) clip.seats.textContent = seats;
  for (let i = 0; i < clip.rows.length; i++) clip.rows[i]();
  const total = sim.cartTotal();
  clip.cart.textContent = 'Total ' + total + '. Cash after ' + (s.cash - total) + '.';
  const co = sim.canOpen();
  clip.open.disabled = !co.ok;
  clip.why.textContent = co.ok ? '' : co.reason;
}

function nameCell(item, withIcon) {
  const icon = withIcon ? iconCanvas('icon_' + item.id) : null;
  return mk('span', { cls: 'name' }, [icon, item.label, mk('span', { cls: 'effect', text: item.effect })]);
}

function lockedBy(item, s) {
  const n = item.needs;
  if (!n) return false;
  if (n.gear) return s.gear[n.gear] !== true;
  if (n.decor) return s.decor[n.decor] !== true;
  if (n.day) return s.day < n.day;
  return false;
}

function cartRow(item) {
  const isMeat = item.kind === 'meat';
  const price = mk('span', { cls: 'price' });
  const dec = btn('dec-' + item.id, '-', 'alt', function () { sim.buy(item.id, -1); pump(); refreshClipboard(); });
  dec.setAttribute('aria-label', 'Fewer ' + item.label);
  const qty = mk('span', { id: 'qty-' + item.id, text: '0' });
  const inc = btn('inc-' + item.id, '+', 'alt', function () { sim.buy(item.id, 1); pump(); refreshClipboard(); });
  inc.setAttribute('aria-label', 'More ' + item.label);
  const step = mk('span', { cls: 'step' }, [dec, qty, inc]);
  const row = mk('div', { cls: 'row' }, [nameCell(item, isMeat), price, step]);
  clip.rows.push(function () {
    const s = sim.state;
    const q = isMeat ? (s.cart.meat[item.id] | 0) : (s.cart.charcoal | 0);
    const locked = lockedBy(item, s);
    const remaining = s.cash - sim.cartTotal();
    price.textContent = locked ? item.needsText : String(item.price);
    price.classList.toggle('muted', locked || remaining < item.price);
    price.style.whiteSpace = locked ? 'normal' : '';
    qty.textContent = String(q);
    dec.disabled = locked || q <= 0;
    inc.disabled = locked || q >= C.STEPPER_MAX || remaining < item.price;
    step.hidden = locked;
  });
  return row;
}

// A gear or decor row: bought at once, one of each, Owned once bought.
function ownRow(item) {
  const isDecor = item.kind === 'decor';
  const price = mk('span', { cls: 'price' });
  const name = nameCell(item, false);
  const eff = name.querySelector('.effect');
  const row = mk('div', { cls: 'row' }, [name, price]);
  let ctl = null, ctlOwned = null;
  clip.rows.push(function () {
    const s = sim.state;
    const isOwned = (isDecor ? s.decor : s.gear)[item.id] === true;
    const locked = lockedBy(item, s);
    const canPay = s.cash - sim.cartTotal() >= item.price;
    const after = s.cash - sim.cartTotal() - item.price;
    const reserve = typeof C.GEAR_RESERVE === 'number' ? C.GEAR_RESERVE : 0;
    const effText = (!isOwned && !locked && canPay && after < reserve)
      ? item.effect + ' Leaves ' + after + '. A day of meat and charcoal is about ' + reserve + '.'
      : item.effect;
    if (eff && eff.textContent !== effText) eff.textContent = effText;
    price.textContent = (locked && !isOwned) ? item.needsText : String(item.price);
    price.classList.toggle('muted', isOwned || locked || !canPay);
    price.style.whiteSpace = (locked && !isOwned) ? 'normal' : '';
    if (ctl === null || ctlOwned !== isOwned) {
      if (ctl) row.removeChild(ctl);
      if (isOwned) {
        ctl = mk('span', { id: 'buy-' + item.id, cls: 'muted', text: 'Owned' });
      } else {
        ctl = btn('buy-' + item.id, 'Buy', 'primary', function () { sim.buy(item.id, 1); pump(); refreshClipboard(); });
        ctl.setAttribute('aria-label', 'Buy ' + item.label);
      }
      ctlOwned = isOwned;
      row.appendChild(ctl);
    }
    if (!isOwned) ctl.disabled = locked || !canPay;
  });
  return row;
}

function goalRow(item) {
  const price = mk('span', { cls: 'price muted', text: String(item.price) });
  const name = nameCell(item, false);
  const row = mk('div', { cls: 'row' }, [name, price]);
  clip.rows.push(function () {
    const s = sim.state;
    const locked = lockedBy(item, s);
    const eff = name.querySelector('.effect');
    if (eff) eff.textContent = item.effect + (locked && item.needsText ? ' ' + item.needsText : '');
  });
  return row;
}

function hireRow(item) {
  const price = mk('span', { cls: 'price' });
  const b = btn('hire-' + item.id, 'Hire', 'primary', function () { sim.hire(item.id); pump(); refreshClipboard(); });
  const row = mk('div', { cls: 'row' }, [nameCell(item, false), price, b]);
  clip.rows.push(function () {
    const s = sim.state;
    const locked = lockedBy(item, s);
    const on = s.hires[item.id] === true;
    price.textContent = locked ? item.needsText : item.price + ' a day';
    price.classList.toggle('muted', locked);
    price.style.whiteSpace = locked ? 'normal' : '';
    b.textContent = on ? 'Let go' : 'Hire';
    b.className = on ? 'alt' : 'primary';
    b.setAttribute('aria-pressed', on ? 'true' : 'false');
    b.setAttribute('aria-label', on ? 'Let ' + item.label + ' go' : 'Hire ' + item.label);
    b.disabled = locked;
  });
  return row;
}

function onOpen() {
  const r = sim.openGate();
  pump();
  if (!r.ok && clip) clip.why.textContent = r.message || sim.canOpen().reason;
}

// ---------------------------------------------------------------- till

function openTill() {
  buildTill();
  if (currentPanel !== 'till') openPanel('till');
}

// Signed money for the till. Zero prints as 0 with no sign (round 2 finding).
function plus(n) { return n > 0 ? '+' + n : '0'; }
function minus(n) { return n > 0 ? '-' + n : '0'; }

function tillRow(label, detail, amount, cls) {
  const name = mk('span', { cls: 'name' }, [label, detail ? mk('span', { cls: 'effect', text: detail }) : null]);
  const price = mk('span', { cls: 'price', text: amount });
  return mk('div', { cls: 'row' + (cls ? ' ' + cls : '') }, [name, price]);
}

function buildTill() {
  const s = sim.state;
  const t = s.till;
  const body = el['till-body'];
  clear(body);
  if (!t) {
    el['till-h'].textContent = 'Till';
    body.appendChild(btn('next', 'Next day', 'primary', onNextDay));
    body.appendChild(btn('till-new', 'New game', 'alt', function () { openConfirm('till'); }));
    return;
  }
  el['till-h'].textContent = 'Day ' + t.day + ' till';
  const wages = t.wageNames && t.wageNames.length ? t.wageNames.join(', ') : 'none';
  const spoiled = meatList(t.spoiled) || 'nothing';
  const grate = meatList(t.grateLeft) || 'nothing';
  const soldOut = Math.max(0, Math.min(t.past, pastSoldOut));
  const seated = t.seated | 0;
  body.appendChild(tillRow('Served', plural(t.served, 'plate', 'plates'), plus(t.revenue)));
  body.appendChild(tillRow('Tips', '', plus(t.tips)));
  body.appendChild(tillRow('Seat tips', seated + ' sat down', plus(t.seatTips | 0)));
  body.appendChild(tillRow('Food cost (what you cooked)', '', minus(t.foodCost)));
  body.appendChild(tillRow('Charcoal used', plural(t.bags, 'bag', 'bags'), minus(t.bags * C.CHARCOAL_PRICE)));
  body.appendChild(tillRow('Wages', wages, minus(t.wages)));
  body.appendChild(tillRow('Daily costs', 'ice and trash bags', minus(C.DAILY_COSTS)));
  body.appendChild(tillRow('Spoiled overnight', spoiled, minus(t.spoilCost)));
  body.appendChild(tillRow('Thrown out', plural(t.wastePlates, 'plate', 'plates') + ', ' + t.wasteBurnt + ' burnt', minus(t.wasteCost)));
  body.appendChild(tillRow('Left on the grate', grate, minus(t.grateCost)));
  body.appendChild(tillRow('Burnt today', plural(t.burnt || 0, 'piece', 'pieces') + ', costed in the two rows above', ''));
  body.appendChild(tillRow('Take today', 'sales and tips after wages and daily costs', signed(t.net), 'net'));
  body.appendChild(tillRow('Cash', '', String(t.cashAfter)));
  body.appendChild(mk('p', { cls: 'muted', text: 'Food, charcoal and spoilage were paid at the shop. They are listed so you can see where the money went.' }));
  body.appendChild(btn('next', 'Next day', 'primary', onNextDay));
  body.appendChild(h3('People'));
  body.appendChild(mk('p', {
    text: 'Came to the gate ' + t.customers + '. Served ' + t.served + '. Sat down ' + seated +
      '. Took it to go ' + (t.togo | 0) + '. Walked out ' + t.walkouts +
      '. Walked past (line full) ' + (t.past - soldOut) + '.' + (soldOut > 0 ? ' Looked in, sold out ' + soldOut + '.' : '') +
      ' Left at close ' + t.close + '.'
  }));
  body.appendChild(h3('Word of mouth'));
  body.appendChild(mk('p', { text: 'Word of mouth ' + t.repStart + ' to ' + t.repEnd }));
  const happy = t.happy | 0, togoQuick = t.togoQuick | 0, ok = t.ok | 0, walkouts = t.walkouts | 0;
  const capped = t.repCapped ? ', capped at ' + signed(t.repMax) + ' / ' + C.REP_DAY_MIN + ' for the day' : '';
  body.appendChild(mk('p', {
    text: '+' + (happy * C.REP_QUICK) + ' from ' + plural(happy, 'quick serve', 'quick serves') + ' at a seat, +' +
      (togoQuick * C.REP_TOGO_QUICK) + ' from ' + plural(togoQuick, 'quick serve', 'quick serves') + ' to go, +' +
      (ok * C.REP_OK) + ' from ' + plural(ok, 'other serve', 'other serves') + ', -' +
      (walkouts * Math.abs(C.REP_WALKOUT)) + ' from ' + plural(walkouts, 'walk-out', 'walk-outs') + capped
  }));
  body.appendChild(btn('till-new', 'New game', 'alt', function () { openConfirm('till'); }));
}

function onNextDay() {
  if (sim.state.phase !== 'evening') return;
  sim.continueFromTill();
  clearFx();
  dogReset(2);
  pump();
  showMorning();
  pump();
}

// ---------------------------------------------------------------- broke card

function openBroke() {
  buildBroke();
  if (currentPanel !== 'broke') openPanel('broke');
}

// The Broke test of [spec 11], on state fields only, used as a fallback for
// showing Keep going in case the sim leaves state.broke for continueFromBroke.
function brokeTest(s) {
  let units = 0;
  for (let i = 0; i < MEAT_IDS.length; i++) units += s.stock[MEAT_IDS[i]] | 0;
  const bag = C.CHARCOAL_PRICE;
  const unit = MEATS.sausage ? MEATS.sausage.unit : 4;
  return (s.charcoal === 0 && s.cash < bag) || (units === 0 && s.cash < unit + (s.charcoal === 0 ? bag : 0));
}

function buildBroke() {
  const s = sim.state;
  const body = el['broke-body'];
  el['broke-h'].textContent = 'Broke';
  clear(body);
  body.appendChild(mk('p', { text: "You can't buy meat and charcoal for today." }));
  body.appendChild(mk('p', { text: 'Sell gear back at half price, or start over.' }));
  body.appendChild(mk('p', { cls: 'muted', text: 'Cash ' + s.cash + '.' }));
  let any = false;
  const kinds = ['gear', 'decor'];
  for (let k = 0; k < kinds.length; k++) {
    const kind = kinds[k];
    const ownedSet = kind === 'gear' ? s.gear : s.decor;
    for (let i = 0; i < CATALOG.length; i++) {
      const item = CATALOG[i];
      if (item.kind !== kind || ownedSet[item.id] !== true) continue;
      any = true;
      const price = Math.floor(item.price * C.SELL_BACK);
      body.appendChild(mk('div', { cls: 'row' }, [
        mk('span', { cls: 'name', text: item.label }),
        btn('sell-' + item.id, 'Sell for ' + price, 'alt', (function (id) {
          return function () {
            sim.sell(id);
            pump();
            buildBroke();
            const kp = document.getElementById('broke-keep');
            if (kp) kp.focus(); else el['broke-h'].focus();
          };
        })(item.id))
      ]));
    }
  }
  if (!any) body.appendChild(mk('p', { cls: 'muted', text: 'Nothing left to sell.' }));
  if (!s.broke || !brokeTest(s)) {
    body.appendChild(btn('broke-keep', 'Keep going', 'primary', function () {
      sim.continueFromBroke();
      pump();
      if (!sim.state.broke) openClipboard();
    }));
  }
  body.appendChild(btn('broke-over', 'Start over', 'alt', function () { openConfirm('broke'); }));
}

// ---------------------------------------------------------------- input

function setupInput() {
  el.cv.addEventListener('pointerdown', onPointer);
  el.cv.addEventListener('touchstart', function (e) { e.preventDefault(); }, { passive: false });
  el.act.addEventListener('click', onAct);
  document.addEventListener('keydown', onKeyDown);
  document.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', function () { held.clear(); });
  document.addEventListener('visibilitychange', onVisibility);
}

// The drawn boxes of a station: its sprite, plus the counter extension when owned (D13).
function stationRects(st) {
  const sz = size(st.sprite);
  const out = [{ x: st.draw.x, y: st.draw.y, w: sz[0], h: sz[1] }];
  if (st.type === 'table' && extTile && owned(extTile)) out.push(extRect());
  return out;
}
function extRect() {
  const sz = size('counter_ext');
  return { x: extTile.x * TILE, y: (extTile.y + 1) * TILE - sz[1], w: sz[0], h: sz[1] };
}

// Active stations in y-sort draw order (key, draw x, list order); stations share one layer.
function stationsInDrawOrder() {
  const list = [];
  for (let i = 0; i < MAP.stations.length; i++) {
    const st = MAP.stations[i];
    if (!owned(st)) continue;
    list.push({ st: st, k: st.sortRow * TILE + 15, x: st.draw.x, o: i });
  }
  list.sort(function (a, b) { return (a.k - b.k) || (a.x - b.x) || (a.o - b.o); });
  return list;
}

function stationAt(vx, vy) {
  const list = stationsInDrawOrder();
  for (let i = list.length - 1; i >= 0; i--) {
    const rects = stationRects(list[i].st);
    for (let j = 0; j < rects.length; j++) {
      const r = rects[j];
      if (vx >= r.x && vx < r.x + r.w && vy >= r.y && vy < r.y + r.h) return list[i].st;
    }
  }
  return null;
}

function onPointer(e) {
  if (e.button !== undefined && e.button !== 0) return;
  if (currentPanel) return;
  const s = sim.state;
  if (s.paused || s.phase !== 'service') return;
  const r = el.cv.getBoundingClientRect();
  if (!(r.width > 0 && r.height > 0)) return;
  const vx = (e.clientX - r.left) / r.width * VW;
  const vy = (e.clientY - r.top) / r.height * VH;
  const hit = stationAt(vx, vy);
  let tx, ty;
  if (hit) { tx = hit.tiles[0].x; ty = hit.tiles[0].y; }
  else { tx = Math.floor(vx / TILE); ty = Math.floor(vy / TILE); }
  const ok = sim.walkTo(tx, ty) === true;
  pump();
  if (tx >= 0 && tx < MAP.W && ty >= 0 && ty < MAP.H) {
    rings.push({ x: tx * TILE, y: ty * TILE, at: tAnim, ok: ok });
    if (rings.length > 6) rings.shift();
    log('ring', tx * TILE, ty * TILE);
  }
  if (ok && !reduced) {
    squashAt = tAnim;
    const p = sim.state.player;
    log('squash', Math.round(p.px) - 1, Math.round(p.py) + TILE - 22);
  }
}

function onAct() {
  if (currentPanel) return;
  const r = sim.interact();
  pump();
  if (r && r.ok) feedback();
}

function feedback() {
  if (reduced) return;
  el.act.style.transform = 'scale(0.96)';
  setTimeout(function () { el.act.style.transform = ''; }, 100);
}

function onKeyDown(e) {
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  const key = e.key || '';
  const lower = key.length === 1 ? key.toLowerCase() : key;
  if (howtoOpen) {
    if (key === 'Escape') { e.preventDefault(); closeHowto(); }
    return;
  }
  if (currentPanel) {
    if (currentPanel === 'pause' && (key === 'Escape' || lower === 'p')) {
      e.preventDefault();
      if (!e.repeat) resumeFromPause();
    } else if (currentPanel === 'newgame' && key === 'Escape') {
      e.preventDefault();
      confirmNo();
    }
    return;
  }
  const t = e.target;
  const tag = t && t.tagName ? t.tagName : '';
  const onControl = tag === 'BUTTON' || tag === 'A' || tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
  const dir = DIRS[key] || DIRS[lower];
  if (dir) {
    e.preventDefault();
    if (!e.repeat) { held.add(dir); sim.move(dir); pump(); }
    return;
  }
  if (key === ' ' || lower === 'e') {
    if (key === ' ' && onControl) return;
    e.preventDefault();
    if (!e.repeat) onAct();
    return;
  }
  if (key.length === 1 && key >= '1' && key <= '5') {
    e.preventDefault();
    if (!e.repeat) {
      for (let i = 0; i < MEAT_IDS.length; i++) {
        if (MEATS[MEAT_IDS[i]].key === key) { sim.selectMeat(MEAT_IDS[i]); pump(); break; }
      }
    }
    return;
  }
  if (lower === 'q') {
    e.preventDefault();
    if (!e.repeat) { sim.cycleMeat(e.shiftKey ? -1 : 1); pump(); }
    return;
  }
  if (key === 'Escape' || lower === 'p') {
    if (sim.state.phase === 'service') {
      e.preventDefault();
      if (!e.repeat) togglePause();
    }
  }
}

function onKeyUp(e) {
  const key = e.key || '';
  const lower = key.length === 1 ? key.toLowerCase() : key;
  const dir = DIRS[key] || DIRS[lower];
  if (dir) held.delete(dir);
}

function onVisibility() {
  if (document.hidden) {
    held.clear();
    const s = sim.state;
    if (s.phase === 'service' && !s.paused && !currentPanel) {
      sim.setPaused(true);
      openPanel('pause');
      updateDom();
    }
  } else {
    last = null;
  }
}

// ---------------------------------------------------------------- effects

function clearFx() {
  nums.length = 0; sparkles.length = 0; hearts.length = 0; puffs.length = 0; rings.length = 0;
  markX.clear(); sweatAt.clear(); columnT.clear();
  for (const k in puffT) delete puffT[k];
  for (const k in puffOn) delete puffOn[k];
  rainDrops = null;
  squashAt = -1;
  zzzSince = null; zzzAt = -1;
  birdUntil = -1; birdNext = tAnim + birdGap();
  shakeUntil = 0;
}

function birdGap() { return FX.BIRD_GAP_MIN + (FX.BIRD_GAP_MAX - FX.BIRD_GAP_MIN) * crng(); }

function piecePos(st, p) {
  const o = st.slotPx && st.slotPx[p.slot] ? st.slotPx[p.slot] : { x: 3, y: 3 };
  return { x: st.tiles[0].x * TILE + o.x, y: st.tiles[0].y * TILE + o.y };
}

function burntBurst(cooker) {
  const st = MAP.station(cooker);
  const ck = sim.state.stations[cooker];
  if (!st || !ck) return;
  let best = null;
  for (let i = 0; i < ck.pieces.length; i++) {
    const p = ck.pieces[i];
    if (p.state !== 'burnt') continue;
    if (best === null || (p.burntAt || 0) >= (best.burntAt || 0)) best = p;
  }
  if (!best) return;
  const pos = piecePos(st, best);
  for (let i = 0; i < BURST_OFFS.length; i++) {
    spawnPuff(pos.x + BURST_OFFS[i][0], pos.y + BURST_OFFS[i][1], 0, FX.BURNT_RISE_PX_S, FX.BURNT_BURST_S, true, false);
  }
  log('burnt', pos.x + BURST_OFFS[0][0], pos.y + BURST_OFFS[0][1]);
}

// A chimney stream drifts away from the cooler's column so the smoke never sits over it.
function puffDrift(st) {
  const r = crng();
  const cooler = MAP.station('cooler');
  const away = cooler ? Math.sign(st.tiles[0].x - cooler.tiles[0].x) : 0;
  return away === 0 ? r * 2 - 1 : away * r;
}

function spawnPuff(x, y, vx, rise, life, dark, sway) {
  if (puffs.length >= 60) puffs.shift();
  puffs.push({ x0: x, y0: y, vx: vx, rise: rise, life: life, at: tAnim, dark: dark, sway: sway });
}

// Watches the sim for the cues that have no event: the buddy's zzz, sweat drops, and the dog
// going home at the panels. Starts no timer and moves nothing on the effect clock.
function observe() {
  const s = sim.state;
  const service = s.phase === 'service';
  if (!service || reduced) {
    const h = MAP.dogHome;
    if (dog.x !== h.x || dog.y !== h.y || dog.px !== h.x * TILE || dog.py !== h.y * TILE || dog.frame !== 2 || dogAI.next) dogReset(2);
  }
  const b = s.buddy;
  if (service && b && b.task === 'idle') {
    if (zzzSince === null) zzzSince = s.clock;
    if (s.clock - zzzSince >= C.ZZZ_AFTER) {
      if (zzzAt < 0) {
        zzzAt = tAnim;
        log('zzz', Math.round(b.px) + 10, Math.round(b.py) - 14);
      }
    } else {
      zzzAt = -1;
    }
  } else {
    zzzSince = null; zzzAt = -1;
  }
  if (service || sweatAt.size) {
    const seen = new Set();
    for (let i = 0; i < s.customers.length; i++) {
      const c = s.customers[i];
      if (!sweating(c)) continue;
      seen.add(c.id);
      if (!sweatAt.has(c.id)) {
        sweatAt.set(c.id, tAnim);
        log('sweat', Math.round(c.px) + 12, Math.round(c.py) - 6);
      }
    }
    sweatAt.forEach(function (t, id) { if (!seen.has(id)) sweatAt.delete(id); });
  }
}

function sweating(c) {
  return c.mode === 'waiting' && c.patienceMax > 0 && c.patience <= c.patienceMax * C.SWEAT_FRAC;
}

function updateFx(dt) {
  const s = sim.state;

  // Chimney puffs on lit cookers and the smoke column over burnt pieces.
  if (!reduced) {
    const live = new Set();
    for (let i = 0; i < MAP.stations.length; i++) {
      const st = MAP.stations[i];
      if (st.type !== 'cooker') continue;
      const ck = s.stations[st.id];
      if (!ck || !owned(st)) { puffOn[st.id] = false; continue; }
      const tx = st.tiles[0].x * TILE, ty = st.tiles[0].y * TILE;
      const band = PitSim.fireBand(ck.fire);
      if (band === 'out') {
        puffOn[st.id] = false;
        puffT[st.id] = 0;
      } else {
        const every = band === 'low' ? FX.PUFF_EVERY_LOW : band === 'good' ? FX.PUFF_EVERY_GOOD : FX.PUFF_EVERY_HOT;
        puffT[st.id] = (puffT[st.id] || 0) - dt;
        if (puffT[st.id] <= 0) {
          puffT[st.id] = every;
          const vent = st.sprite === 'drum' ? { x: tx + 7, y: ty - 4 } : { x: tx + 11, y: ty - 10 };
          const life = FX.PUFF_LIFE_MIN + (FX.PUFF_LIFE_MAX - FX.PUFF_LIFE_MIN) * crng();
          spawnPuff(vent.x - SMOKE_HALF_W, vent.y, puffDrift(st) * FX.PUFF_DRIFT_PX_S, FX.PUFF_RISE_PX_S, life, false, false);
          if (!puffOn[st.id]) { puffOn[st.id] = true; log('puff', vent.x, vent.y); }
        }
      }
      for (let j = 0; j < ck.pieces.length; j++) {
        const p = ck.pieces[j];
        if (p.state !== 'burnt') continue;
        const key = st.id + ':' + p.id;
        live.add(key);
        const pos = piecePos(st, p);
        let left = columnT.get(key);
        if (left === undefined) { left = 0; log('column', pos.x + 1, pos.y - 3); }
        left -= dt;
        if (left <= 0) {
          left = FX.BURNT_COLUMN_EVERY;
          spawnPuff(pos.x + 1, pos.y - 3, 0, FX.BURNT_COLUMN_RISE_PX_S, FX.BURNT_COLUMN_LIFE, true, true);
        }
        columnT.set(key, left);
      }
    }
    columnT.forEach(function (v, k) { if (!live.has(k)) columnT.delete(k); });
  }

  // Expire.
  for (let i = puffs.length - 1; i >= 0; i--) if (tAnim - puffs[i].at >= puffs[i].life) puffs.splice(i, 1);
  for (let i = nums.length - 1; i >= 0; i--) if (tAnim - nums[i].at >= FX.NUMBER_S) nums.splice(i, 1);
  for (let i = sparkles.length - 1; i >= 0; i--) if (tAnim - sparkles[i].at >= FX.SPARKLE_S) sparkles.splice(i, 1);
  for (let i = hearts.length - 1; i >= 0; i--) if (tAnim - hearts[i].at >= FX.HEART_S) hearts.splice(i, 1);
  for (let i = rings.length - 1; i >= 0; i--) if (tAnim - rings[i].at >= FX.TAP_RING_S) rings.splice(i, 1);
  if (markX.size) markX.forEach(function (until, id) { if (until <= tAnim) markX.delete(id); });
  if (squashAt >= 0 && tAnim - squashAt >= FX.SQUASH_S) squashAt = -1;

  // The bird at the bath.
  if (s.decor && s.decor.birdbath === true && !reduced) {
    if (birdUntil >= 0 && tAnim >= birdUntil) { birdUntil = -1; birdNext = tAnim + birdGap(); }
    if (birdUntil < 0 && tAnim >= birdNext) {
      birdUntil = tAnim + FX.BIRD_SHOW_S;
      const bath = decorDraw('birdbath', 'birdbath');
      if (bath) log('bird', bath.x, bath.y);
    }
  } else {
    birdUntil = -1;
  }

  // The dog.
  if (!reduced) updateDog(dt);

  // Rain.
  if (s.rain && !reduced) {
    if (!rainDrops) {
      rainDrops = [];
      for (let i = 0; i < 40; i++) rainDrops.push({ x: Math.floor(crng() * VW), y: crng() * VH, v: 70 + crng() * 40 });
    }
    for (let i = 0; i < rainDrops.length; i++) {
      const d = rainDrops[i];
      d.y += d.v * dt;
      if (d.y > VH) { d.y = -3; d.x = Math.floor(crng() * VW); }
    }
  }
}

function decorDraw(spotId, sprite) {
  for (let i = 0; i < MAP.decor.length; i++) {
    const spot = MAP.decor[i];
    if (spot.id !== spotId) continue;
    for (let j = 0; j < spot.draws.length; j++) if (spot.draws[j].sprite === sprite) return spot.draws[j];
  }
  return null;
}

// ---------------------------------------------------------------- the dog

function dogReset(frame) {
  const h = MAP.dogHome;
  dog.x = h.x; dog.y = h.y; dog.px = h.x * TILE; dog.py = h.y * TILE;
  dog.frame = frame; dog.flip = false;
  dogAI.path = []; dogAI.next = null; dogAI.anim = 0;
  dogAI.wait = FX.DOG_WAIT_MIN + FX.DOG_WAIT_SPREAD * crng();
}

function dogOpen(x, y) {
  return x >= 0 && y >= 0 && x < MAP.W && y < MAP.H && y <= MAP.H - 2 && sim.custWalkable(x, y, -1, -1) === true;
}

// 4 direction BFS, neighbors up, down, left, right; returns the tiles after the start, or null.
function dogPath(sx, sy, gx, gy) {
  if (!dogOpen(gx, gy)) return null;
  const W = MAP.W, n = W * MAP.H;
  const prev = new Int16Array(n).fill(-1);
  const start = sy * W + sx, goal = gy * W + gx;
  prev[start] = start;
  const q = [start];
  const NB = [[0, -1], [0, 1], [-1, 0], [1, 0]];
  for (let qi = 0; qi < q.length; qi++) {
    const cur = q[qi];
    if (cur === goal) break;
    const cx = cur % W, cy = (cur - cx) / W;
    for (let d = 0; d < 4; d++) {
      const nx = cx + NB[d][0], ny = cy + NB[d][1];
      if (nx < 0 || ny < 0 || nx >= W || ny >= MAP.H) continue;
      const ni = ny * W + nx;
      if (prev[ni] !== -1 || !dogOpen(nx, ny)) continue;
      prev[ni] = cur;
      q.push(ni);
    }
  }
  if (prev[goal] === -1) return null;
  const path = [];
  for (let c = goal; c !== start; c = prev[c]) path.push({ x: c % W, y: Math.floor(c / W) });
  path.reverse();
  return path;
}

function dogFaceNext() {
  const nx = dogAI.next;
  if (nx.x < dog.x) dog.flip = false;
  else if (nx.x > dog.x) dog.flip = true;
}

function dogArrive() {
  const h = MAP.dogHome;
  dog.frame = (dog.x === h.x && dog.y === h.y) ? 3 : 2;
  dogAI.wait = FX.DOG_WAIT_MIN + FX.DOG_WAIT_SPREAD * crng();
  dogAI.anim = 0;
}

function dogPick() {
  const cands = [];
  for (let i = 0; i < MAP.dogRoam.length; i++) {
    const t = MAP.dogRoam[i];
    if ((t.x !== dog.x || t.y !== dog.y) && !seatTakenBelow(t.x, t.y)) cands.push(t);
  }
  const goal = cands.length ? cands[Math.min(cands.length - 1, Math.floor(crng() * cands.length))] : null;
  const path = goal ? dogPath(dog.x, dog.y, goal.x, goal.y) : null;
  if (!path || !path.length) { dogAI.wait = FX.DOG_WAIT_MIN + FX.DOG_WAIT_SPREAD * crng(); return; }
  dogAI.path = path;
  dogAI.next = dogAI.path.shift();
  dogAI.anim = 0;
  dogFaceNext();
}

// True when the tile south of (x, y) is a seat someone has taken (round 2): the dog does not
// stand behind a seated customer's head.
function seatTakenBelow(x, y) {
  const seats = sim.state.seats || {};
  for (let i = 0; i < MAP.seats.length; i++) {
    const st = MAP.seats[i];
    if (st.x === x && st.y === y + 1 && seats[st.id] !== null && seats[st.id] !== undefined) return true;
  }
  return false;
}

function updateDog(dt) {
  if (sim.state.phase !== 'service') return;
  if (!dogAI.next) {
    dogAI.wait -= dt;
    if (dogAI.wait <= 0) dogPick();
    if (!dogAI.next) return;
  }
  dogAI.anim += dt;
  let budget = FX.DOG_TILES_PER_S * TILE * dt;
  while (dogAI.next && budget > 0) {
    const tx = dogAI.next.x * TILE, ty = dogAI.next.y * TILE;
    const dx = tx - dog.px, dy = ty - dog.py;
    const dist = Math.abs(dx) + Math.abs(dy);
    if (dist <= budget) {
      budget -= dist;
      dog.px = tx; dog.py = ty; dog.x = dogAI.next.x; dog.y = dogAI.next.y;
      dogAI.next = dogAI.path.length ? dogAI.path.shift() : null;
      if (dogAI.next) dogFaceNext();
      else { dogArrive(); return; }
    } else {
      if (dx !== 0) dog.px += Math.sign(dx) * Math.min(Math.abs(dx), budget);
      else dog.py += Math.sign(dy) * Math.min(Math.abs(dy), budget);
      budget = 0;
    }
  }
  if (dogAI.next) dog.frame = Math.floor(dogAI.anim * 6) % 2;
}

// ---------------------------------------------------------------- drawing primitives

function size(name) {
  let s = SIZE[name];
  if (!s) {
    const sp = art.SPRITES ? art.SPRITES[name] : null;
    s = SIZE[name] = sp ? [sp.w, sp.h, Math.max(1, art.frames(name))] : [16, 16, Math.max(1, art.frames(name))];
  }
  return s;
}

// Wholly outside: never drawn. Crossing an edge: drawn only for the D15 step 33 exceptions.
function inView(name, x, y, w, h) {
  if (x >= VW || y >= VH || x + w <= 0 || y + h <= 0) return false;
  if (x >= 0 && y >= 0 && x + w <= VW && y + h <= VH) return true;
  return OVERFLOW_OK.test(name);
}

function normFrame(frame, n) {
  const f = Math.trunc(Number(frame) || 0);
  return ((f % n) + n) % n;
}

function D(name, x, y, frame, flip) {
  const sz = size(name);
  if (!inView(name, x, y, sz[0], sz[1])) return;
  const f = normFrame(frame, sz[2]);
  art.draw(octx, name, x, y, f, flip === true);
  if (capturing) recs.push({ name: name, frame: f, x: x, y: y, w: sz[0], h: sz[1] });
}

function DS(name, x, y, w, h, frame, flip) {
  if (!inView(name, x, y, w, h)) return;
  const f = normFrame(frame, size(name)[2]);
  art.drawScaled(octx, name, x, y, w, h, f, flip === true);
  if (capturing) recs.push({ name: name, frame: f, x: x, y: y, w: w, h: h });
}

function glyphFrame(ch) {
  const c = ch.charCodeAt(0);
  if (c >= 48 && c <= 57) return c - 48;
  if (c >= 65 && c <= 90) return 10 + (c - 65);
  if (ch === '+') return 36;
  if (ch === ':') return 37;
  return -1;
}

// Canvas text: cream through art.text, any other color through art.textTinted.
function T(str, x, y, colorKey) {
  if (!colorKey || colorKey === 'C') art.text(octx, str, x, y);
  else art.textTinted(octx, str, x, y, colorKey);
  if (!capturing) return;
  const fs = size('font');
  const s = String(str).toUpperCase();
  let cx = x;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch === ' ') { cx += fs[0] + 1; continue; }
    const g = glyphFrame(ch);
    if (g < 0) continue;
    recs.push({ name: 'font', frame: g, x: cx, y: y, w: fs[0], h: fs[1] });
    cx += fs[0] + 1;
  }
}

// Floating number: the string in the outline color at four 1 px offsets, then in its color on
// top (round 2; no box). Only the colored pass is recorded by captureFrame.
function popText(str, x, y, colorKey) {
  art.textTinted(octx, str, x - 1, y, 'outline');
  art.textTinted(octx, str, x + 1, y, 'outline');
  art.textTinted(octx, str, x, y - 1, 'outline');
  art.textTinted(octx, str, x, y + 1, 'outline');
  T(str, x, y, colorKey);
}

// Canvas text in an umber box: the box 1 px up and left of the text, width + 3 by 8.
function boxText(str, x, y, colorKey) {
  octx.fillStyle = COLOR.U;
  octx.fillRect(x - 1, y - 1, art.textWidth(str) + 3, 8);
  T(str, x + 1, y + 1, 'K');
  T(str, x, y, colorKey);
}

// Dashed footprint outline: 1 px, 2 on and 2 off, clockwise from the top left pixel. Outline
// colored on pavers (cream would vanish on the paver tan), cream on the lawn and hedge.
function dashedBox(x, y, w, h) {
  octx.fillStyle = paverAt(Math.floor(x / TILE), Math.floor(y / TILE)) ? COLOR.outline : COLOR.C;
  let i = 0;
  for (let xx = x; xx < x + w; xx++, i++) if ((i & 3) < 2) octx.fillRect(xx, y, 1, 1);
  for (let yy = y + 1; yy < y + h; yy++, i++) if ((i & 3) < 2) octx.fillRect(x + w - 1, yy, 1, 1);
  for (let xx = x + w - 2; xx >= x; xx--, i++) if ((i & 3) < 2) octx.fillRect(xx, y + h - 1, 1, 1);
  for (let yy = y + h - 2; yy > y; yy--, i++) if ((i & 3) < 2) octx.fillRect(x, yy, 1, 1);
  if (capturing) recs.push({ name: '#outline', frame: 0, x: x, y: y, w: w, h: h });
}

function drawRing(x, y, frac, color) {
  const n = Math.max(0, Math.min(RING.length, Math.round(frac * RING.length)));
  if (n === 0) return;
  octx.fillStyle = color;
  for (let i = 0; i < n; i++) octx.fillRect(x + RING[i][0], y + RING[i][1], 1, 1);
}

// ---------------------------------------------------------------- render: ground

function lawnTile(x, y, clover) {
  const alt = (clover && clover.has(x + ',' + y)) || (x * 5 + y * 3) % 3 === 0;
  D(MAP.stripe(x) === 'a' ? 'lawn_a' : 'lawn_b', x * TILE, y * TILE, alt ? 1 : 0);
}
function paverTile(x, y) {
  D('paver', x * TILE, y * TILE, (x * 7 + y * 3) % 2);
}

// Paver drawn on this tile: PAVER ground, or a lawn tile on the customer route.
function paverAt(x, y) {
  return MAP.at(x, y) === MAP.T.PAVER || PATH_TILES.has(x + ',' + y);
}

function drawGround(s) {
  const T_ = MAP.T;
  const clover = new Set();      // unowned decor footprints take the clover frame (round 2)
  for (let i = 0; i < MAP.decor.length; i++) {
    const spot = MAP.decor[i];
    if (s.decor[spot.id] === true) continue;
    for (let j = 0; j < spot.tiles.length; j++) clover.add(spot.tiles[j].x + ',' + spot.tiles[j].y);
  }
  for (let y = 0; y < MAP.H; y++) {
    for (let x = 0; x < MAP.W; x++) {
      const t = MAP.at(x, y);
      if (t === T_.PAVER || PATH_TILES.has(x + ',' + y)) paverTile(x, y);
      else if (t === T_.LAWN || t === T_.GATE) lawnTile(x, y, clover);
      else if (y >= LAWN_FROM_ROW) lawnTile(x, y, clover);
      else paverTile(x, y);
    }
  }
}

// ---------------------------------------------------------------- render: the y-sorted pass

function fenceName(x, y) {
  const edgeX = x === 0 || x === MAP.W - 1, edgeY = y === 0 || y === MAP.H - 1;
  if (edgeX && edgeY) return 'fence_corner';
  if (edgeY) return 'fence_h';
  return 'fence_v';
}

function gateOpen(s) {
  if (s.phase !== 'service') return false;
  return (s.clock >= C.GATE_OPENS && s.clock < C.LAST_CALL) || s.customers.length > 0;
}

function pieceFrame(p) {
  if (p.state === 'burnt') return 3;
  if (p.state === 'done') return 2;
  const cook = MEATS[p.meat] ? MEATS[p.meat].cook : 1;
  return p.prog < cook / 2 ? 0 : 1;
}

function drawStack(meat, count, x, y, max) {
  const n = Math.min(count, max);
  const name = 'plate_' + meat;
  for (let k = 0; k < n; k++) D(name, x, y - k);
}

function drawStation(st, s) {
  const tx = st.tiles[0].x * TILE, ty = st.tiles[0].y * TILE;
  if (st.type === 'cooker') {
    const ck = s.stations[st.id];
    const band = PitSim.fireBand(ck ? ck.fire : 0);
    D(st.sprite, st.draw.x, st.draw.y, BAND_FRAME[band] || 0);
    if (!ck) return;
    drawGauge(st, ck);
    for (let i = 0; i < ck.pieces.length; i++) {
      const p = ck.pieces[i];
      const pos = piecePos(st, p);
      D('piece_' + p.meat, pos.x, pos.y, pieceFrame(p));
      const m = MEATS[p.meat];
      if (!m) continue;
      if (p.state === 'cooking') drawRing(pos.x - 1, pos.y - 1, Math.min(1, p.prog / m.cook), COLOR.O);
      else if (p.state === 'done') drawRing(pos.x - 1, pos.y - 1, Math.max(0, 1 - (p.prog - m.cook) / m.window), COLOR.lawnA);
      else drawRing(pos.x - 1, pos.y - 1, 1, COLOR.K);
    }
  } else if (st.type === 'board') {
    const b = s.stations.board;
    D('board', st.draw.x, st.draw.y, b && b.slicing ? 1 : 0);
    if (b && b.stacks) {
      for (let j = 0; j < b.stacks.length && j < BOARD_OFFS.length; j++) {
        const stack = b.stacks[j];
        if (stack && stack.times && stack.times.length) {
          drawStack(stack.meat, stack.times.length, st.draw.x + BOARD_OFFS[j][0], st.draw.y + BOARD_OFFS[j][1], C.BOARD_STACK);
        }
      }
    }
  } else if (st.type === 'cooler') {
    D('cooler', st.draw.x, st.draw.y, s.gear.cooler ? (sim.reach() === 'cooler' ? 2 : 1) : 0);
  } else if (st.type === 'table') {
    const big = !!(extTile && owned(extTile));
    if (big) { const r = extRect(); D('counter_ext', r.x, r.y); }
    D('counter', st.draw.x, st.draw.y, big ? 1 : 0);
    const spots = s.stations.table ? s.stations.table.spots : [];
    const px = st.spotPx || [];
    for (let i = 0; i < spots.length && i < px.length; i++) {
      const stack = spots[i];
      if (!stack || !stack.times || !stack.times.length || !owned(px[i])) continue;
      drawStack(stack.meat, stack.times.length, px[i].x, px[i].y, C.TABLE_STACK);
    }
  } else if (st.type === 'pile') {
    const n = s.charcoal | 0;
    D('pile', st.draw.x, st.draw.y, n > 6 ? 0 : n >= 3 ? 1 : n >= 1 ? 2 : 3);
  } else if (st.type === 'trash') {
    D('trash', st.draw.x, st.draw.y);
  } else {
    D(st.sprite, tx, ty);
  }
}

// 4 connected runs of footprint tiles, one box each, top left first.
function runsOf(tiles) {
  const left = tiles.map(function (t) { return { x: t.x, y: t.y }; });
  const runs = [];
  while (left.length) {
    const comp = [left.shift()];
    for (let i = 0; i < comp.length; i++) {
      for (let j = left.length - 1; j >= 0; j--) {
        if (Math.abs(comp[i].x - left[j].x) + Math.abs(comp[i].y - left[j].y) === 1) comp.push(left.splice(j, 1)[0]);
      }
    }
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (let i = 0; i < comp.length; i++) {
      x0 = Math.min(x0, comp[i].x); y0 = Math.min(y0, comp[i].y);
      x1 = Math.max(x1, comp[i].x); y1 = Math.max(y1, comp[i].y);
    }
    runs.push({ tx: x0, ty: y0, x: x0 * TILE, y: y0 * TILE, w: (x1 - x0 + 1) * TILE, h: (y1 - y0 + 1) * TILE, row: y1 });
  }
  runs.sort(function (a, b) { return (a.ty - b.ty) || (a.tx - b.tx); });
  return runs;
}

function staffBody(kind, m, s) {
  const wf = m.walking ? 1 + (Math.floor((m.anim || 0) * 8) % 2) : 0;
  if (kind === 'player' && s.player.busy) return ['player_slice', Math.floor((s.player.busy.t || 0) * 6) % 2, false];
  if (m.face === 'up') return [kind + '_up', wf, false];
  if (m.face === 'left' || m.face === 'right') return [kind + '_side', wf, m.face === 'right'];
  return [kind + '_down', wf, false];
}

function custBody(c) {
  const n = 'cust' + (((c.body | 0) % 4 + 4) % 4);
  const wf = 1 + (Math.floor((c.anim || 0) * 8) % 2);
  const unhappy = c.mood === 'unhappy';
  if (c.face === 'up') return [n + '_up', c.walking ? wf : 0, false];
  if (c.face === 'left' || c.face === 'right') return [n + '_side', c.walking ? wf : (unhappy ? 3 : 0), c.face === 'right'];
  return [n + '_down', c.walking ? (unhappy ? wf + 2 : wf) : 0, false];
}

function staffHand(kind, m, s) {
  const c = m.carrying;
  if (!c) return (kind === 'player' && s.gear.tray && !s.player.busy) ? 'hand_tray' : null;
  if (c.kind === 'charcoal') return 'hand_charcoal';
  if (c.kind === 'raw') return 'hand_raw_' + c.meat;
  if (c.kind === 'cooked') return 'hand_cooked_' + c.meat;
  if (c.kind === 'burnt') return 'hand_burnt';
  if (c.kind === 'plates') return (c.times && c.times.length >= 2 ? 'hand_tray_' : 'hand_plate_') + c.meat;
  return null;
}

function custHand(c) {
  if (c.mode === 'toSeat') return 'hand_plate_' + c.want;
  if (c.mode === 'leaving' && c.reason === 'togo') return 'hand_togo';
  return null;
}

function hopOffset(c) { return (c.hop > 0 && !reduced) ? -2 : 0; }

function drawMover(kind, m, s) {
  const bx = Math.round(m.px), by = Math.round(m.py);
  const isCust = kind === 'cust';
  const yo = isCust ? hopOffset(m) : 0;
  const body = isCust ? custBody(m) : staffBody(kind, m, s);
  const hand = isCust ? custHand(m) : staffHand(kind, m, s);
  const bh = size(body[0])[1];
  const feet = by + TILE;
  D('shadow', bx + 2, by + 13);
  if (hand && m.face === 'up') D(hand, bx + 4, by - 1 + yo);
  const sq = (kind === 'player' && squashAt >= 0 && !reduced) ? tAnim - squashAt : -1;
  if (sq >= 0 && sq < FX.SQUASH_S) {
    if (sq < FX.SQUASH_S / 2) DS(body[0], bx - 1, feet - 22, 18, 22, body[1], body[2]);
    else DS(body[0], bx + 1, feet - 26, 14, 26, body[1], body[2]);
  } else {
    D(body[0], bx, feet - bh + yo, body[1], body[2]);
  }
  if (hand && m.face !== 'up') D(hand, bx + 4, by + 4 + yo);
}

function drawSeated(c, seat) {
  const sx = seat.x * TILE, sy = seat.y * TILE;
  const f = c.eat > 0 ? (reduced ? 0 : Math.floor(tAnim / FX.EAT_FRAME_S) % 2) : 2;
  D('cust' + (((c.body | 0) % 4 + 4) % 4) + '_sit', sx, sy - 6, f);
}

function seatOf(c) { return c.seat ? SEAT_BY_ID[c.seat] || null : null; }

// A see-through preview of an unowned piece; its capture record carries ghost: true.
function ghost(name, x, y, frame) {
  const n = recs.length;
  octx.globalAlpha = GHOST_ALPHA;
  D(name, x, y, frame);
  octx.globalAlpha = 1;
  if (capturing) for (let i = n; i < recs.length; i++) recs[i].ghost = true;
}

function drawSorted(s) {
  const items = [];
  let order = 0;
  function push(k, layer, dx, fn) { items.push({ k: k, l: layer, x: dx, o: order++, f: fn }); }
  const T_ = MAP.T;
  const open = gateOpen(s);

  // Fence, gate, hedge and bed tiles, row major (layer 0).
  for (let y = 0; y < MAP.H; y++) {
    for (let x = 0; x < MAP.W; x++) {
      const t = MAP.at(x, y);
      const px = x * TILE, key = y * TILE + 15;
      if (t === T_.FENCE && y === 0) {
        const corner = x === 0 || x === MAP.W - 1;
        push(key, 0, px, function () { D('fence_back', px, 0, corner ? 1 : 0); });
      } else if (t === T_.FENCE) {
        const name = fenceName(x, y);
        push(key, 0, px, function () { D(name, px, (y + 1) * TILE - size(name)[1]); });
      } else if (t === T_.GATE) {
        push(key, 0, px, function () { D('gate', px, (y + 1) * TILE - size('gate')[1], open ? 1 : 0); });
      } else if (t === T_.HEDGE) {
        push(key, 0, px, function () { D('hedge', px, (y + 1) * TILE - size('hedge')[1], x % 2); });
      } else if (t === T_.BED) {
        push(key, 0, px, function () { D('bed', px, (y + 1) * TILE - size('bed')[1], (x + y) % 3); });
      }
    }
  }

  // Fixed props (layer 1).
  for (let i = 0; i < MAP.props.length; i++) {
    const p = MAP.props[i];
    push(p.sortRow * TILE + 15, 1, p.draw.x, function () {
      D(p.sprite, p.draw.x, p.draw.y, p.frame);
      if (p.id === 'sign' && MAP.signText) T('YOUR PIT', MAP.signText.x, MAP.signText.y);
    });
  }

  // Active stations with their extras (layer 1).
  for (let i = 0; i < MAP.stations.length; i++) {
    const st = MAP.stations[i];
    if (!owned(st)) continue;
    push(st.sortRow * TILE + 15, 1, st.draw.x, function () { drawStation(st, s); });
  }

  // Owned decor, not the overhead draws (layer 1).
  const birdOn = birdUntil >= 0 && birdUntil > tAnim && !reduced;
  for (let i = 0; i < MAP.decor.length; i++) {
    const spot = MAP.decor[i];
    if (s.decor[spot.id] !== true) {
      // The unbought Flower bed shows its box of tilled soil (bed frame 3, round 2).
      if (spot.id === 'flowers') {
        for (let j = 0; j < spot.draws.length; j++) {
          const d = spot.draws[j];
          if (d.sprite === 'bed') push(d.sortRow * TILE + 15, 1, d.x, function () { D('bed', d.x, d.y, 3); });
        }
      }
      continue;
    }
    for (let j = 0; j < spot.draws.length; j++) {
      const d = spot.draws[j];
      if (d.overhead) continue;
      const frame = (spot.id === 'birdbath' && d.sprite === 'birdbath' && birdOn) ? 1 : d.frame;
      push(d.sortRow * TILE + 15, 1, d.x, function () { D(d.sprite, d.x, d.y, frame); });
    }
  }

  // Ghosts of unowned gear and decor (layer 1, the footprint's sort key), under their outlines.
  // Morning and evening only (round 2): during service the yard shows what is really there.
  if (s.phase !== 'service') {
    for (let i = 0; i < MAP.stations.length; i++) {
      const st = MAP.stations[i];
      if (!owned(st)) {
        push(st.sortRow * TILE + 15, 1, st.draw.x, function () { ghost(st.sprite, st.draw.x, st.draw.y, 0); });
      } else if (st.type === 'table' && extTile && !owned(extTile)) {
        const r = extRect();
        push(st.sortRow * TILE + 15, 1, r.x, function () { ghost('counter_ext', r.x, r.y, 0); });
      }
    }
    for (let i = 0; i < MAP.decor.length; i++) {
      const spot = MAP.decor[i];
      if (s.decor[spot.id] === true) continue;
      for (let j = 0; j < spot.draws.length; j++) {
        const d = spot.draws[j];
        if (d.overhead) continue;
        push(d.sortRow * TILE + 15, 1, d.x, function () { ghost(d.sprite, d.x, d.y, d.frame); });
      }
    }
  }

  // Dashed outlines of unowned footprints: stations, then decor (layer 2).
  for (let i = 0; i < MAP.stations.length; i++) {
    const st = MAP.stations[i];
    const stOwned = owned(st);
    const tiles = [];
    for (let j = 0; j < st.tiles.length; j++) if (!stOwned || !owned(st.tiles[j])) tiles.push(st.tiles[j]);
    if (!tiles.length) continue;
    const runs = runsOf(tiles);
    for (let j = 0; j < runs.length; j++) {
      const r = runs[j];
      push(r.row * TILE + 15, 2, r.x, function () { dashedBox(r.x, r.y, r.w, r.h); });
    }
  }
  for (let i = 0; i < MAP.decor.length; i++) {
    const spot = MAP.decor[i];
    if (s.decor[spot.id] === true) continue;
    const runs = runsOf(spot.tiles);
    for (let j = 0; j < runs.length; j++) {
      const r = runs[j];
      push(r.row * TILE + 15, 2, r.x, function () { dashedBox(r.x, r.y, r.w, r.h); });
    }
  }

  // People (layer 3): the player, the buddy, the tender, then customers by id.
  const staff = [['player', s.player], ['buddy', s.buddy], ['tender', s.tender]];
  for (let i = 0; i < staff.length; i++) {
    const kind = staff[i][0], m = staff[i][1];
    if (!m) continue;
    push(Math.round(m.py) + 15, 3, Math.round(m.px), function () { drawMover(kind, m, s); });
  }
  const custs = s.customers.slice().sort(byId);
  for (let i = 0; i < custs.length; i++) {
    const c = custs[i];
    const seat = c.mode === 'eating' ? seatOf(c) : null;
    if (seat) push(seat.y * TILE + 15, 3, seat.x * TILE, function () { drawSeated(c, seat); });
    else push(Math.round(c.py) + 15, 3, Math.round(c.px), function () { drawMover('cust', c, s); });
  }

  // Eaters' plates (layer 5), by customer id.
  for (let i = 0; i < custs.length; i++) {
    const c = custs[i];
    if (c.mode !== 'eating') continue;
    const seat = seatOf(c);
    if (!seat) continue;
    const sx = seat.x * TILE, sy = seat.y * TILE;
    const chair = isChairSeat(seat);
    const px = sx + 4, py = chair ? sy + 9 : sy + 17;
    const key = chair ? seat.y * TILE + 15 : (seat.y + 1) * TILE + 15;
    push(key, 5, px, function () { D('plate_' + c.want, px, py); });
  }

  // The dog (layer 4).
  const dx = Math.round(dog.px), dy = Math.round(dog.py);
  push(dy + 15, 4, dx, function () { D('dog', dx, dy, dog.frame, dog.flip); });

  items.sort(function (a, b) { return (a.k - b.k) || (a.l - b.l) || (a.x - b.x) || (a.o - b.o); });
  for (let i = 0; i < items.length; i++) items[i].f();
  return custs;
}

// ---------------------------------------------------------------- render: the passes after the sort

function drawOverhead(s) {
  if (s.decor.lights === true && MAP.overhead && MAP.overhead.lights) {
    D('lights_string', MAP.overhead.lights.x, MAP.overhead.lights.y, reduced ? 0 : Math.floor(tAnim / FX.TWINKLE_S) % 2);
  }
  if (s.gear.canopy === true && MAP.overhead && MAP.overhead.canopy) {
    D('canopy', MAP.overhead.canopy.x, MAP.overhead.canopy.y);
  }
}

function drawSmokeAndFire(s) {
  for (let i = 0; i < puffs.length; i++) {
    const p = puffs[i];
    const age = tAnim - p.at;
    if (age < 0 || age >= p.life) continue;
    let x = p.x0 + p.vx * age;
    if (p.sway) x += Math.sin(age * 2 * Math.PI / p.life) * FX.BURNT_COLUMN_SWAY_PX;
    const y = p.y0 - p.rise * age;
    D(p.dark ? 'smoke_dark' : 'smoke', Math.round(x), Math.round(y), Math.min(2, Math.floor(3 * age / p.life)));
  }
  for (let i = 0; i < MAP.stations.length; i++) {
    const st = MAP.stations[i];
    if (st.type !== 'cooker' || !owned(st)) continue;
    const ck = s.stations[st.id];
    if (!ck) continue;
    const band = PitSim.fireBand(ck.fire);
    if (band === 'good' || band === 'hot') {
      D('fire', st.draw.x + 4, st.draw.y - 4, reduced ? 0 : Math.floor(tAnim * FX.FIRE_FPS) % 3);
    }
  }
}

function bandColor(band) {
  if (band === 'hot') return COLOR.O;
  if (band === 'good') return COLOR.lawnA;
  if (band === 'low') return COLOR.woodL;
  return COLOR.smokeD;
}

function drawGauge(st, ck) {
  const gx = st.tiles[0].x * TILE + 18;
  const top = st.draw.y + 4, bottom = st.draw.y + size(st.sprite)[1];
  const h = bottom - top;
  if (h < 4) return;
  octx.fillStyle = COLOR.outline;
  octx.fillRect(gx, top, 3, h);
  const inner = h - 2;
  const f = Math.max(0, Math.min(1, ck.fire / C.FIRE_MAX));
  const fh = Math.round(f * inner);
  if (fh > 0) {
    octx.fillStyle = bandColor(PitSim.fireBand(ck.fire));
    octx.fillRect(gx, top + 1 + (inner - fh), 3, fh);
  }
  octx.fillStyle = COLOR.C;
  const t1 = top + 1 + inner - Math.round(C.FIRE_GOOD / C.FIRE_MAX * inner);
  const t2 = top + 1 + inner - Math.round(C.FIRE_HOT / C.FIRE_MAX * inner);
  octx.fillRect(gx, t1, 1, 1); octx.fillRect(gx + 2, t1, 1, 1);
  octx.fillRect(gx, t2, 1, 1); octx.fillRect(gx + 2, t2, 1, 1);
}

function drawCues(s, custs) {
  // Bubbles: order icon or walk out mark, then food bubbles.
  for (let i = 0; i < custs.length; i++) {
    const c = custs[i];
    const inLine = c.mode === 'arriving' || c.mode === 'waiting';
    const until = markX.get(c.id);
    const showMark = until !== undefined && until > tAnim;
    const px = Math.round(c.px), py = Math.round(c.py) + hopOffset(c);
    if (inLine || showMark) {
      D('bubble', px + 14, py - 22);
      if (showMark) {
        D('mark_x', px + 18, py - 20);
      } else {
        const frac = c.patienceMax > 0 ? Math.max(0, Math.min(1, c.patience / c.patienceMax)) : 1;
        const blink = frac <= C.PATIENCE_WARN_FRAC && !reduced && Math.floor(tAnim * 4) % 2 === 1;
        if (!blink) D('icon_' + c.want, px + 18, py - 20);
      }
    } else if (c.mode === 'eating' && c.eat > 0) {
      const seat = seatOf(c);
      const sx = seat ? seat.x * TILE : px, sy = seat ? seat.y * TILE : Math.round(c.py);
      D('bubble', sx, sy - 21);
      D('plate_' + c.want, sx + 4, sy - 18);
    }
  }
  // Patience bars.
  const mid = typeof C.PATIENCE_MID_FRAC === 'number' ? C.PATIENCE_MID_FRAC : 0.5;
  for (let i = 0; i < custs.length; i++) {
    const c = custs[i];
    if (c.mode !== 'arriving' && c.mode !== 'waiting') continue;
    const px = Math.round(c.px), py = Math.round(c.py) + hopOffset(c);
    const frac = c.patienceMax > 0 ? Math.max(0, Math.min(1, c.patience / c.patienceMax)) : 1;
    const bx = px + 15, by = py - 26;
    if (bx >= VW || by < 0) continue;
    octx.fillStyle = COLOR.K;
    octx.fillRect(bx, by, 14, 3);
    octx.fillStyle = frac <= C.PATIENCE_WARN_FRAC ? COLOR.red : (frac <= mid ? COLOR.yellow : COLOR.lawnA);
    const w = Math.max(frac > 0 ? 1 : 0, Math.round(14 * frac));
    if (w > 0) octx.fillRect(bx, by, w, 3);
  }
  // Sweat drops. (Fire gauges draw with their cooker in the y-sorted pass, round 2.)
  for (let i = 0; i < custs.length; i++) {
    const c = custs[i];
    if (!sweating(c)) continue;
    const px = Math.round(c.px) + 12, py = Math.round(c.py) - 6 + hopOffset(c);
    if (reduced) { D('sweat', px, py, 0); continue; }
    const t0 = sweatAt.has(c.id) ? sweatAt.get(c.id) : tAnim;
    const t = Math.max(0, tAnim - t0) % FX.SWEAT_EVERY;
    if (t < FX.SWEAT_SLIDE_S) D('sweat', px, py + Math.round(FX.SWEAT_SLIDE_PX * t / FX.SWEAT_SLIDE_S), 0);
    else if (t < FX.SWEAT_SLIDE_S + FX.SWEAT_SPLASH_S) D('sweat', px, py + FX.SWEAT_SLIDE_PX, 1);
  }
  // zzz over an idle buddy.
  const b = s.buddy;
  if (b && zzzAt >= 0) {
    const zx = Math.round(b.px) + 10, zy = Math.round(b.py) - 14;
    if (reduced) {
      D('zzz', zx, zy, 2);
    } else {
      const cycle = FX.ZZZ_FRAME_S * 3;
      const t = Math.max(0, tAnim - zzzAt);
      D('zzz', zx, zy - Math.round(FX.ZZZ_DRIFT_PX * (t % cycle) / cycle), Math.floor(t / FX.ZZZ_FRAME_S) % 3);
    }
  }
  // Hearts.
  for (let i = 0; i < hearts.length; i++) {
    const h = hearts[i];
    const age = tAnim - h.at;
    if (age < 0 || age >= FX.HEART_S) continue;
    if (reduced) { DS('heart', h.x, h.y, 16, 16, 0); continue; }
    const rise = Math.round(FX.HEART_RISE_PX * easeOut(age / FX.HEART_S));
    const fadeFrom = FX.HEART_S - FX.HEART_FADE_S;
    octx.globalAlpha = age > fadeFrom ? Math.max(0, (FX.HEART_S - age) / FX.HEART_FADE_S) : 1;
    DS('heart', h.x, h.y - rise, 16, 16, age < FX.HEART_FRAME_S ? 0 : 1);
    octx.globalAlpha = 1;
  }
}

function numAlpha(age) {
  if (age < FX.NUMBER_FADE_AT) return 1;
  return Math.max(0, 1 - (age - FX.NUMBER_FADE_AT) / (FX.NUMBER_S - FX.NUMBER_FADE_AT));
}
function numRise(age) {
  return reduced ? 0 : Math.round(FX.NUMBER_RISE_PX * easeOut(age / FX.NUMBER_S));
}

function drawTop(s) {
  // Slice bar over the board.
  const b = s.stations.board;
  if (b && b.slicing && b.slicing.total > 0) {
    const st = MAP.station('board');
    const bx = st.draw.x, by = st.draw.y;
    octx.fillStyle = COLOR.K;
    octx.fillRect(bx, by - 5, 16, 3);
    octx.fillStyle = COLOR.C;
    const w = Math.round(14 * Math.max(0, Math.min(1, b.slicing.t / b.slicing.total)));
    if (w > 0) octx.fillRect(bx + 1, by - 4, w, 1);
  }
  // Floating numbers, then their coins.
  for (let i = 0; i < nums.length; i++) {
    const n = nums[i];
    const age = tAnim - n.at;
    if (age < 0 || age >= FX.NUMBER_S) continue;
    octx.globalAlpha = numAlpha(age);
    popText(n.str, n.x, n.y - numRise(age), n.color);
    octx.globalAlpha = 1;
  }
  for (let i = 0; i < nums.length; i++) {
    const n = nums[i];
    if (!n.coin) continue;
    const age = tAnim - n.at;
    if (age < 0 || age >= FX.NUMBER_S) continue;
    octx.globalAlpha = numAlpha(age);
    D('coin', n.x - 9, n.y - numRise(age), reduced ? 0 : Math.floor(tAnim * 8) % 2);
    octx.globalAlpha = 1;
  }
  // Sparkles.
  for (let i = 0; i < sparkles.length; i++) {
    const sp = sparkles[i];
    const age = tAnim - sp.at;
    if (age < 0 || age >= FX.SPARKLE_S) continue;
    DS('sparkle', sp.x - 3, sp.y - 3, 14, 14, Math.min(2, Math.floor(age / FX.SPARKLE_FRAME_S)));
  }
  // Tap rings: the full ring, then its four corners. Reduced motion keeps the ring.
  if (s.phase === 'service') {
    for (let i = 0; i < rings.length; i++) {
      const m = rings[i];
      const age = tAnim - m.at;
      if (age < 0 || age >= FX.TAP_RING_S) continue;
      octx.fillStyle = m.ok ? COLOR.yellow : COLOR.O;
      if (reduced || age < FX.TAP_RING_S * 0.6) {
        octx.fillRect(m.x, m.y, 16, 1);
        octx.fillRect(m.x, m.y + 15, 16, 1);
        octx.fillRect(m.x, m.y, 1, 16);
        octx.fillRect(m.x + 15, m.y, 1, 16);
      } else {
        octx.fillRect(m.x, m.y, 1, 1);
        octx.fillRect(m.x + 15, m.y, 1, 1);
        octx.fillRect(m.x, m.y + 15, 1, 1);
        octx.fillRect(m.x + 15, m.y + 15, 1, 1);
      }
    }
  }
}

function drawRain() {
  octx.fillStyle = 'rgba(110, 104, 99, 0.55)';
  octx.fillRect(0, 0, VW, 10);
  octx.fillStyle = 'rgba(91, 184, 240, 0.10)';
  octx.fillRect(0, 0, VW, VH);
  if (reduced || !rainDrops) return;
  octx.fillStyle = COLOR.smokeL;
  for (let i = 0; i < rainDrops.length; i++) {
    const y = Math.floor(rainDrops[i].y);
    if (y < 0 || y > VH - 3) continue;
    octx.fillRect(rainDrops[i].x, y, 1, 3);
  }
}

function render() {
  const s = sim.state;
  const inService = s.phase === 'service';
  octx.globalAlpha = 1;
  octx.fillStyle = COLOR.K;
  octx.fillRect(0, 0, VW, VH);

  drawGround(s);                      // 1. ground
  const custs = drawSorted(s);        // 2. the y-sorted pass
  drawOverhead(s);                    // 3. string lights, canopy
  drawSmokeAndFire(s);                // 4. smoke, puffs, flames
  drawCues(s, custs);                 // 5. bubbles, bars, sweat, zzz, hearts
  drawTop(s);                         // 6. slice bar, numbers, coins, sparkles, tap rings
  if (inService && s.rain) drawRain(); // 7. rain

  // 8. Canvas text in umber boxes.
  if (inService) {
    const rem = Math.max(0, Math.ceil(C.DAY_SECONDS - s.clock));
    boxText(String(rem), 2, 2, null);
    if (s.clock < C.GATE_OPENS) boxText('GATE OPENS IN ' + Math.ceil(C.GATE_OPENS - s.clock), 2, 183, 'yellow');
    else if (lastCallUntil > nowMs) boxText('LAST CALL', 2, 183, 'yellow');
  }

  // 9. Blit at the D13 scale, with the burnt shake.
  vctx.imageSmoothingEnabled = false;
  vctx.fillStyle = COLOR.K;
  vctx.fillRect(0, 0, el.cv.width, el.cv.height);
  let ox = 0;
  if (!reduced && shakeUntil > nowMs) ox = (Math.floor(nowMs / 16) % 2 === 0 ? 1 : -1) * kpx;
  vctx.drawImage(off, 0, 0, VW, VH, ox, 0, VW * kpx, VH * kpx);
}

// ---------------------------------------------------------------- DOM per frame

function statusText(s) {
  if (saveOffUntil > nowMs) return 'Saving is off in this browser.';
  if (noticeUntil > nowMs) return 'Your save was updated for the new yard.';
  if (blockedUntil > nowMs) return STRINGS.cantGetThere;
  if (s.phase === 'service' && s.clock < C.GATE_OPENS) return STRINGS.gateOpensIn + Math.ceil(C.GATE_OPENS - s.clock);
  if (lastCallUntil > nowMs) return STRINGS.lastCall;
  return sim.holding();
}

function updateDom() {
  const s = sim.state;
  if (s.phase !== lastPhase) {
    lastPhase = s.phase;
    el.root.setAttribute('data-phase', s.phase);
    syncPanels();
  }
  const paused = s.paused === true;
  if (paused !== lastPaused) {
    lastPaused = paused;
    if (paused) el.root.setAttribute('data-paused', '1');
    else el.root.removeAttribute('data-paused');
  }
  if (wantHowto() !== lastHow) syncPanels();

  const dayT = 'Day ' + s.day;
  if (dayT !== lastHud.day) { lastHud.day = dayT; el['hud-day'].textContent = dayT; }
  const cashT = 'Cash ' + s.cash;
  if (cashT !== lastHud.cash) { lastHud.cash = cashT; el['hud-cash'].textContent = cashT; }
  const repT = stars(s.rep) + ' ' + s.rep;
  if (repT !== lastHud.rep) {
    lastHud.rep = repT;
    el['hud-rep'].textContent = repT;
    el['hud-rep'].setAttribute('aria-label', 'Word of mouth ' + s.rep);
  }

  const st = statusText(s);
  if (st !== lastStatus) { lastStatus = st; el.status.textContent = st; }

  const v = sim.verbAt();
  if (v.label !== lastAct) { lastAct = v.label; el.act.textContent = v.label; }
  const dis = !v.enabled;
  if (dis !== lastActDis) { lastActDis = dis; el.act.disabled = dis; }

  for (let i = 0; i < MEAT_IDS.length; i++) {
    const id = MEAT_IDS[i];
    const n = s.stock[id] | 0;
    const sel = s.selected === id;
    const sig = n + (sel ? 's' : '');
    if (sig === chipSig[id]) continue;
    chipSig[id] = sig;
    const ch = chipEls[id];
    ch.cnt.textContent = String(n);
    ch.b.setAttribute('aria-pressed', sel ? 'true' : 'false');
    ch.b.setAttribute('aria-label', MEATS[id].label + ', ' + n + ' in stock');
    ch.b.disabled = n <= 0;
  }

  flushLive();
}

// ---------------------------------------------------------------- start

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
else boot();
})();
