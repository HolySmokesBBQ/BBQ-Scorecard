'use strict';
// game.js: input, canvas rendering, DOM panels, aria-live, save hooks, pause.
// Contract: docs/superpowers/specs/2026-10-18-pit-sim-contract.md, section 4.
// Design:   docs/superpowers/specs/2026-10-18-pit-sim-design.md.
//
// Deviations (nothing added to the shared surface; PitSim.game is exactly section 4.10):
//  1. The shared global line sits inside this file's function wrapper rather than
//     at the top level, so three classic scripts that each declare `const PitSim`
//     cannot collide in the page's global lexical scope.
//  2. The fire gauge is drawn in the 4 px column just right of the cooker tile
//     (px + 16 to px + 19), because slotPx puts the second grate piece over the
//     tile's own right edge; drawing it inside would be covered by the piece.
//  3. Cooking arcs are a 12 by 12 one pixel ring around each piece, filled
//     clockwise from the top, so they stay crisp at integer scale.
//  4. Cosmetic randomness (smoke drift, rain streaks) comes from a local
//     mulberry32 seeded from sim.seed, not sim.rng(), so frame timing never
//     changes the sim's own random sequence. The built in random generator is never called.
//  5. A successful action is detected by a change in the player's hands between
//     frames (every action in the spec's table changes the hands), which drives
//     the bounce feedback for tap-to-walk auto actions as well as button presses.
//  6. Round 1 review: the clipboard foot holds a How to play button (#howto-btn) that
//     shows #howto in place of the clipboard, and #howto-body ends with a Back button
//     (#howto-close) that is visible only then. Escape there goes back too. Both ids
//     are new. #crowd (a p under the goal line) is new as well.
//  7. Round 1 review: walk_past with reason 'soldout' (sim.js deviation 9) reads
//     "Someone looked in. Nothing left to sell." The full line sentence is unchanged.
//     tap_queued has no sentence.
//  8. Round 1 review: every canvas tap draws a one pixel 16 by 16 ring on the tapped
//     tile for 0.35 s (gold when the walk was taken or queued, orange when refused),
//     which drops to its four corner pixels after 0.2 s; reduced motion keeps the ring.
//  9. Round 1 review: the patience bar is 3 px tall and three colors (grass above
//     C.PATIENCE_MID_FRAC, gold to C.PATIENCE_WARN_FRAC, orange under it); under warn
//     the bubble icon blinks at 2 Hz unless reduced motion is on. The bubble sits one
//     pixel higher (py - 14) so its tail stays clear of the bar.
// 10. Round 1 review: a gear row whose purchase would leave less than C.GEAR_RESERVE
//     says so in its effect line before the tap. The buy stays allowed.
// 11. Round 1 review: on the till, Next day sits right under the Cash row and the
//     shop note, before People and Word of mouth; New game stays last.
// 12. Round 1 review: P resumes from the pause panel as well as pausing (the Controls
//     card and spec 15 say so); a held P does not toggle.
(function () {
const PitSim = globalThis.PitSim || (globalThis.PitSim = {});

const VERSION = '0.2.0';

const FALLBACK_COLOR = {
  K: '#1b1714', U: '#2a2015', C: '#E6D8B8', O: '#D06129', Y: '#F3CF6D', M: '#bfb39a',
  H: '#3a332c', I: '#33211A', S: '#444947', g: '#4a6741', G: '#5f7f4c', h: '#2f4a2d',
  d: '#6b4a2a', b: '#8a6a3f', p: '#e8a0a0', r: '#b5583a', n: '#7a3f22', f: '#ff9a2e',
  y: '#ffd85c', s: '#8d8a86', t: '#5a5753', w: '#a9c4d9'
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
let C = null, MAP = null, MEATS = null, MEAT_IDS = null, CATALOG = null, STRINGS = null, art = null, COLOR = null;
let VW = 208, VH = 240, TILE = 16;
let off = null, octx = null, vctx = null, scale = 1, dpr = 1;
let mqReduced = null, mqDesktop = null;
let reduced = false, saveOff = false, saveOffNoted = false;
let last = null, rafId = 0, tAnim = 0, nowMs = 0, stopped = false;
let currentPanel = null, returnPanel = null;
let howtoOpen = false, howtoFrom = null, howtoClose = null;
const held = new Set();
let crng = null; // cosmetic rng

// Effects.
const smokes = [];
const pops = [];
const tapMarks = [];
const markX = new Map();
const cookerSmokeT = {};
const burntSmokeT = {};
let rainDrops = null;
let shakeUntil = 0, bounceUntil = 0, blockedUntil = 0, lastCallUntil = 0, saveOffUntil = 0;
let lastCarrySig = '';
// Walk pasts with reason 'soldout' this day, counted from events (today.past holds both
// reasons). Reset when the yard opens; a reload during the evening shows them as line full.
let pastSoldOut = 0;

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
const textCache = new Map();

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
function catalogRow(id) {
  for (let i = 0; i < CATALOG.length; i++) if (CATALOG[i].id === id) return CATALOG[i];
  return null;
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
function owned(entry) { return PitSim.tileOwned(entry, sim.state.gear); }

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
  C = PitSim.C; MAP = PitSim.MAP; MEATS = PitSim.MEATS; MEAT_IDS = PitSim.MEAT_IDS;
  CATALOG = PitSim.CATALOG; STRINGS = PitSim.STRINGS;
  COLOR = Object.assign({}, FALLBACK_COLOR, art.COLOR || {});
  TILE = MAP.TILE || 16;
  VW = MAP.W * TILE; VH = MAP.H * TILE;

  const saved = readSave();
  const seed = readSeed();
  sim = PitSim.createSim(saved, seed);
  crng = mulberry32((sim.seed >>> 0) ^ 0x9E3779B9);

  setupMedia();
  buildStatic();
  setupCanvas();
  setupInput();
  showMorning();
  pump();
  if (saveOff) noteSaveOff();
  exposeGame();
  rafId = requestAnimationFrame(frame);
}

function readSave() {
  let raw = null;
  try { raw = localStorage.getItem(PitSim.SAVE_KEY); } catch (e) { saveOff = true; return null; }
  if (!raw) return null;
  let parsed = null;
  try { parsed = JSON.parse(raw); } catch (e) { return null; }
  try { return PitSim.validateSave(parsed); } catch (e) { return null; }
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
    get saveOff() { return saveOff; }
  };
}

function advance(seconds) {
  const n = Math.max(0, Math.round((Number(seconds) || 0) / C.TICK_SECONDS));
  for (let i = 0; i < n; i++) sim.tick();
  pump();
}

function setupMedia() {
  mqReduced = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
  mqDesktop = window.matchMedia ? window.matchMedia('(min-width: 900px)') : null;
  reduced = !!(mqReduced && mqReduced.matches);
  const onR = function () { reduced = !!(mqReduced && mqReduced.matches); if (reduced) smokes.length = 0; };
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

function resize() {
  dpr = window.devicePixelRatio || 1;
  const availW = Math.min(el.wrap.clientWidth || 375, 480);
  let availH = window.innerHeight - 44 - (24 + 48 + 48) - 16;
  if (mqDesktop && mqDesktop.matches) availH = Math.min(availH, window.innerHeight * 0.7);
  scale = Math.max(1, Math.floor(Math.min(availW * dpr / VW, availH * dpr / VH)));
  el.cv.width = VW * scale;
  el.cv.height = VH * scale;
  el.cv.style.width = (VW * scale / dpr) + 'px';
  el.cv.style.height = (VH * scale / dpr) + 'px';
  vctx.imageSmoothingEnabled = false;
  octx.imageSmoothingEnabled = false;
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
  s = sim.state;
  if (!s.paused) {
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
      closePanel();
      break;
    case 'gate_soon': announce('Gate opens in 10.'); break;
    case 'gate_open': announce('Gate open.'); break;
    case 'customer_arrived': announce('New customer wants ' + L + '.'); break;
    case 'piece_done': announce(L + ' is done on ' + K + '.'); break;
    case 'piece_burnt':
      announce(L + ' burnt on ' + K + '.');
      if (!reduced) shakeUntil = nowMs + 120;
      break;
    case 'served':
      announce(ev.tip > 0
        ? 'Served ' + L + ', ' + ev.price + ' plus ' + ev.tip + ' tip.'
        : 'Served ' + L + ', ' + ev.price + ', no tip.');
      pops.push({ x: Number(ev.x) || 0, y: Number(ev.y) || 0, price: ev.price, tip: ev.tip, age: 0 });
      if (pops.length > 12) pops.shift();
      break;
    case 'walk_out':
      announce('A customer walked out.');
      markX.set(ev.id, tAnim + 0.6);
      break;
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
}

function resumeFromPause() {
  if (sim.state.paused) sim.setPaused(false);
  closePanel();
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
  smokes.length = 0;
  pops.length = 0;
  markX.clear();
  rainDrops = null;
  returnPanel = null;
  sim.reset();
  sim.setPaused(false);
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

function buildClipboard() {
  const s = sim.state;
  el['clipboard-h'].textContent = 'Morning';
  clear(el['clip-top']); clear(el.shop); clear(el.hire); clear(el['clip-foot']);
  clip = { rows: [], headText: null, cart: null, open: null, why: null };

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
  for (let i = 0; i < CATALOG.length; i++) if (CATALOG[i].kind === 'gear') el.shop.appendChild(gearRow(CATALOG[i]));
  for (let i = 0; i < CATALOG.length; i++) if (CATALOG[i].kind === 'goal') el.shop.appendChild(goalRow(CATALOG[i]));

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
  if (!item.needs) return false;
  if (item.needs.gear) return s.gear[item.needs.gear] !== true;
  if (item.needs.day) return s.day < item.needs.day;
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

function gearRow(item) {
  const price = mk('span', { cls: 'price' });
  const name = nameCell(item, false);
  const eff = name.querySelector('.effect');
  const row = mk('div', { cls: 'row' }, [name, price]);
  let ctl = null, ctlOwned = null;
  clip.rows.push(function () {
    const s = sim.state;
    const isOwned = s.gear[item.id] === true;
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
  body.appendChild(tillRow('Served', plural(t.served, 'plate', 'plates'), plus(t.revenue)));
  body.appendChild(tillRow('Tips', '', plus(t.tips)));
  body.appendChild(tillRow('Food cost (what you cooked)', '', minus(t.foodCost)));
  body.appendChild(tillRow('Charcoal used', plural(t.bags, 'bag', 'bags'), minus(t.bags * C.CHARCOAL_PRICE)));
  body.appendChild(tillRow('Wages', wages, minus(t.wages)));
  body.appendChild(tillRow('Daily costs', 'ice and trash bags', minus(C.DAILY_COSTS)));
  body.appendChild(tillRow('Spoiled overnight', spoiled, minus(t.spoilCost)));
  body.appendChild(tillRow('Thrown out', plural(t.wastePlates, 'plate', 'plates') + ', ' + t.wasteBurnt + ' burnt', minus(t.wasteCost)));
  body.appendChild(tillRow('Left on the grate', grate, minus(t.grateCost)));
  body.appendChild(tillRow('Burnt today', plural(t.burnt || 0, 'piece', 'pieces') + ', costed in the two rows above', ''));
  body.appendChild(tillRow('Net', '', signed(t.net), 'net'));
  body.appendChild(tillRow('Cash', '', String(t.cashAfter)));
  body.appendChild(mk('p', { cls: 'muted', text: 'Food, charcoal and spoilage were paid at the shop. They are listed so you can see where the money went.' }));
  body.appendChild(btn('next', 'Next day', 'primary', onNextDay));
  body.appendChild(h3('People'));
  body.appendChild(mk('p', {
    text: 'Came to the gate ' + t.customers + '. Served ' + t.served + '. Walked out ' + t.walkouts +
      '. Walked past (line full) ' + (t.past - soldOut) + '.' + (soldOut > 0 ? ' Looked in, sold out ' + soldOut + '.' : '') +
      ' Left at close ' + t.close + '.'
  }));
  body.appendChild(h3('Word of mouth'));
  body.appendChild(mk('p', { text: 'Word of mouth ' + t.repStart + ' to ' + t.repEnd }));
  const capped = t.repCapped ? ', capped at ' + signed(C.REP_DAY_MAX) + ' / ' + C.REP_DAY_MIN + ' for the day' : '';
  body.appendChild(mk('p', {
    text: '+' + (t.happy * C.REP_QUICK) + ' from ' + plural(t.happy, 'quick serve', 'quick serves') + ', +' + (t.ok * C.REP_OK) + ' from ' +
      plural(t.ok, 'serve', 'serves') + ', -' + (t.walkouts * Math.abs(C.REP_WALKOUT)) + ' from ' + plural(t.walkouts, 'walk-out', 'walk-outs') + capped
  }));
  body.appendChild(btn('till-new', 'New game', 'alt', function () { openConfirm('till'); }));
}

function onNextDay() {
  if (sim.state.phase !== 'evening') return;
  sim.continueFromTill();
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
  for (let i = 0; i < CATALOG.length; i++) {
    const item = CATALOG[i];
    if (item.kind !== 'gear' || s.gear[item.id] !== true) continue;
    any = true;
    const price = Math.floor(item.price * C.SELL_BACK);
    body.appendChild(mk('div', { cls: 'row' }, [
      mk('span', { cls: 'name', text: item.label }),
      btn('sell-' + item.id, 'Sell for ' + price, 'alt', (function (id) {
        return function () {
          sim.sell(id);
          pump();
          buildBroke();
          const k = document.getElementById('broke-keep');
          if (k) k.focus(); else el['broke-h'].focus();
        };
      })(item.id))
    ]));
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

function onPointer(e) {
  if (e.button !== undefined && e.button !== 0) return;
  if (currentPanel) return;
  const s = sim.state;
  if (s.paused || s.phase !== 'service') return;
  const r = el.cv.getBoundingClientRect();
  if (!(r.width > 0 && r.height > 0)) return;
  const tx = Math.floor((e.clientX - r.left) / r.width * MAP.W);
  const ty = Math.floor((e.clientY - r.top) / r.height * MAP.H);
  const ok = sim.walkTo(tx, ty);
  pump();
  if (tx >= 0 && tx < MAP.W && ty >= 0 && ty < MAP.H) {
    tapMarks.push({ x: tx * TILE, y: ty * TILE, at: tAnim, until: tAnim + 0.35, ok: ok === true });
    if (tapMarks.length > 6) tapMarks.shift();
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
  bounceUntil = tAnim + 0.15;
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
    }
  } else {
    last = null;
  }
}

// ---------------------------------------------------------------- effects

function updateFx(dt) {
  const s = sim.state;
  const inService = s.phase === 'service';

  // Action feedback from the hands changing.
  const c = s.player ? s.player.carrying : null;
  const sig = s.phase + '|' + (c ? c.kind + ':' + (c.meat || '') + ':' + (c.times ? c.times.length : '') : 'none');
  if (sig !== lastCarrySig) {
    if (lastCarrySig.indexOf('service|') === 0 && inService && !reduced) bounceUntil = tAnim + 0.15;
    lastCarrySig = sig;
  }

  // Smoke.
  if (!reduced && inService) {
    const stations = MAP.stations;
    for (let i = 0; i < stations.length; i++) {
      const st = stations[i];
      if (st.type !== 'cooker' || !owned(st)) continue;
      const ck = s.stations[st.id];
      if (!ck) continue;
      const px = st.tiles[0].x * TILE, py = st.tiles[0].y * TILE;
      const band = PitSim.fireBand(ck.fire);
      if (band === 'good' || band === 'hot') {
        cookerSmokeT[st.id] = (cookerSmokeT[st.id] || 0) - dt;
        if (cookerSmokeT[st.id] <= 0) {
          cookerSmokeT[st.id] = band === 'hot' ? 0.3 : 0.45;
          spawnSmoke(px + 4 + Math.floor(crng() * 5) - 2, py - 6);
        }
      }
      for (let j = 0; j < ck.pieces.length; j++) {
        const p = ck.pieces[j];
        if (p.state !== 'burnt') continue;
        const key = st.id + ':' + p.id;
        burntSmokeT[key] = (burntSmokeT[key] || 0) - dt;
        if (burntSmokeT[key] <= 0) {
          burntSmokeT[key] = 0.5;
          const o = st.slotPx && st.slotPx[p.slot] ? st.slotPx[p.slot] : { x: 0, y: 0 };
          spawnSmoke(px + o.x + 1, py + o.y - 3);
        }
      }
    }
  }
  for (let i = smokes.length - 1; i >= 0; i--) {
    const sm = smokes[i];
    sm.age += dt;
    sm.y -= 8 * dt;
    sm.x += sm.drift * dt;
    if (sm.age >= sm.life) smokes.splice(i, 1);
  }

  // Coin pops.
  for (let i = pops.length - 1; i >= 0; i--) {
    pops[i].age += dt;
    if (pops[i].age >= (reduced ? 0.6 : 0.8)) pops.splice(i, 1);
  }

  // Walk out marks.
  if (markX.size) {
    markX.forEach(function (until, id) { if (until <= tAnim) markX.delete(id); });
  }

  // Tap marks.
  for (let i = tapMarks.length - 1; i >= 0; i--) {
    if (tapMarks[i].until <= tAnim) tapMarks.splice(i, 1);
  }

  // Rain.
  if (inService && s.rain && !reduced) {
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

function spawnSmoke(x, y) {
  if (smokes.length >= 40) smokes.shift();
  smokes.push({ x: x, y: y, age: 0, life: 1.1 + crng() * 0.3, drift: (crng() - 0.5) * 6 });
}

// ---------------------------------------------------------------- render

function tinted(str, color) {
  const key = color + '|' + str;
  let c = textCache.get(key);
  if (c) return c;
  const w = Math.max(1, art.textWidth(str));
  c = document.createElement('canvas');
  c.width = w; c.height = 6;
  const x = c.getContext('2d');
  art.text(x, str, 0, 0);
  x.globalCompositeOperation = 'source-in';
  x.fillStyle = color;
  x.fillRect(0, 0, w, 6);
  if (textCache.size > 240) textCache.clear();
  textCache.set(key, c);
  return c;
}

function drawText(ctx, str, x, y, color) {
  ctx.drawImage(tinted(str, COLOR.K), x + 1, y + 1);
  ctx.drawImage(tinted(str, color), x, y);
}

// Canvas text on a near black box so it reads over the fence (round 2 finding).
function drawBoxedText(ctx, str, x, y, color) {
  ctx.fillStyle = COLOR.K;
  ctx.fillRect(x - 1, y - 1, art.textWidth(str) + 3, 8);
  drawText(ctx, str, x, y, color);
}

function drawRing(ctx, x, y, frac, color) {
  const n = Math.max(0, Math.min(RING.length, Math.round(frac * RING.length)));
  if (n === 0) return;
  ctx.fillStyle = color;
  for (let i = 0; i < n; i++) ctx.fillRect(x + RING[i][0], y + RING[i][1], 1, 1);
}

function bandColor(band) {
  if (band === 'hot') return COLOR.f;
  if (band === 'good') return COLOR.G;
  if (band === 'low') return COLOR.r;
  return COLOR.M;
}

function drawGauge(ctx, px, py, h, fire) {
  const gx = px + TILE;
  ctx.fillStyle = COLOR.K;
  ctx.fillRect(gx, py, 4, h);
  const inner = h - 2;
  const f = Math.max(0, Math.min(1, fire / C.FIRE_MAX));
  const fh = Math.round(f * inner);
  if (fh > 0) {
    ctx.fillStyle = bandColor(PitSim.fireBand(fire));
    ctx.fillRect(gx + 1, py + 1 + (inner - fh), 2, fh);
  }
  ctx.fillStyle = COLOR.C;
  const t1 = py + 1 + inner - Math.round(C.FIRE_GOOD / C.FIRE_MAX * inner);
  const t2 = py + 1 + inner - Math.round(C.FIRE_HOT / C.FIRE_MAX * inner);
  ctx.fillRect(gx, t1, 1, 1); ctx.fillRect(gx + 3, t1, 1, 1);
  ctx.fillRect(gx, t2, 1, 1); ctx.fillRect(gx + 3, t2, 1, 1);
}

function pieceFrame(p) {
  if (p.state === 'burnt') return 3;
  if (p.state === 'done') return 2;
  const cook = MEATS[p.meat] ? MEATS[p.meat].cook : 1;
  return p.prog < cook / 2 ? 0 : 1;
}

function drawCooker(ctx, st, s) {
  const ck = s.stations[st.id];
  const px = st.tiles[0].x * TILE, py = st.tiles[0].y * TILE;
  const fire = ck ? ck.fire : 0;
  const band = PitSim.fireBand(fire);
  const name = st.id === 'drum' ? 'drum' : 'kettle';
  art.draw(ctx, name, px, py, BAND_FRAME[band] || 0);
  const h = st.tiles.length * TILE;
  if (ck) {
    for (let i = 0; i < ck.pieces.length; i++) {
      const p = ck.pieces[i];
      const o = st.slotPx && st.slotPx[p.slot] ? st.slotPx[p.slot] : { x: 3, y: 3 };
      const sx = px + o.x, sy = py + o.y;
      art.draw(ctx, 'piece_' + p.meat, sx, sy, pieceFrame(p));
      const m = MEATS[p.meat];
      if (m) {
        if (p.state === 'cooking') drawRing(ctx, sx - 1, sy - 1, Math.min(1, p.prog / m.cook), COLOR.O);
        else if (p.state === 'done') drawRing(ctx, sx - 1, sy - 1, Math.max(0, 1 - (p.prog - m.cook) / m.window), COLOR.G);
        else drawRing(ctx, sx - 1, sy - 1, 1, COLOR.K);
      }
    }
  }
  drawGauge(ctx, px, py, h, fire);
}

function drawStack(ctx, meat, count, x, y, max) {
  const n = Math.min(count, max);
  const name = 'plate_' + meat;
  for (let k = 0; k < n; k++) art.draw(ctx, name, x, y - k);
}

function drawStations(ctx, s) {
  const stations = MAP.stations.slice().sort(function (a, b) {
    return (a.tiles[0].y - b.tiles[0].y) || (a.tiles[0].x - b.tiles[0].x);
  });
  const reach = sim.reach();
  for (let i = 0; i < stations.length; i++) {
    const st = stations[i];
    if (!owned(st)) continue;
    const px = st.tiles[0].x * TILE, py = st.tiles[0].y * TILE;
    if (st.type === 'table') {
      const tiles = st.tiles;
      let minX = Infinity, maxX = -Infinity;
      for (let j = 0; j < tiles.length; j++) {
        if (!owned(tiles[j])) continue;
        if (tiles[j].x < minX) minX = tiles[j].x;
        if (tiles[j].x > maxX) maxX = tiles[j].x;
      }
      const spots = s.stations.table ? s.stations.table.spots : [];
      for (let j = 0; j < tiles.length; j++) {
        const t = tiles[j];
        if (!owned(t)) continue;
        const tx = t.x * TILE, ty = t.y * TILE;
        if (t.x === minX) art.draw(ctx, 'table_end', tx, ty, 0, false);
        else if (t.x === maxX) art.draw(ctx, 'table_end', tx, ty, 0, true);
        else art.draw(ctx, 'table_mid', tx, ty);
        const stack = j < spots.length ? spots[j] : null;
        if (stack && stack.times && stack.times.length) drawStack(ctx, stack.meat, stack.times.length, tx + 4, ty + 3, C.TABLE_STACK);
      }
    } else if (st.type === 'board') {
      const b = s.stations.board;
      art.draw(ctx, 'board', px, py, b && b.slicing ? 1 : 0);
      if (b && b.stacks) {
        const offs = [[1, 3], [8, 3], [1, 9], [8, 9]];
        for (let j = 0; j < b.stacks.length && j < offs.length; j++) {
          const stack = b.stacks[j];
          if (stack && stack.times && stack.times.length) drawStack(ctx, stack.meat, stack.times.length, px + offs[j][0], py + offs[j][1], C.BOARD_STACK);
        }
      }
    } else if (st.type === 'cooler') {
      art.draw(ctx, 'cooler', px, py, s.gear.cooler ? (reach === 'cooler' ? 2 : 1) : 0);
    } else if (st.type === 'cooker') {
      drawCooker(ctx, st, s);
    } else if (st.type === 'pile') {
      const n = s.charcoal | 0;
      art.draw(ctx, 'pile', px, py, n > 6 ? 0 : n >= 3 ? 1 : n >= 1 ? 2 : 3);
    } else if (st.type === 'trash') {
      art.draw(ctx, 'trash', px, py);
    }
  }
}

function bodyFor(kind, m, s) {
  const wf = m.walking ? 1 + (Math.floor((m.anim || 0) * 8) % 2) : 0;
  if (kind === 'cust') {
    const n = 'cust' + (m.body | 0);
    if (m.face === 'up') return [n + '_up', Math.floor((m.anim || 0) * 8) % 2, false];
    if (m.face === 'left' || m.face === 'right') return [n + '_side', Math.floor((m.anim || 0) * 8) % 2, m.face === 'right'];
    return [n + '_down', m.walking ? wf : (m.mood === 'unhappy' ? 3 : 0), false];
  }
  if (kind === 'player' && s.player.busy) return ['player_slice', Math.floor((s.player.busy.t || 0) * 6) % 2, false];
  if (m.face === 'up') return [kind + '_up', wf, false];
  if (m.face === 'left' || m.face === 'right') return [kind + '_side', wf, m.face === 'right'];
  return [kind + '_down', wf, false];
}

function handFor(kind, m, s) {
  const c = m.carrying;
  if (!c) return (kind === 'player' && s.gear.tray && !s.player.busy) ? 'hand_tray' : null;
  if (c.kind === 'charcoal') return 'hand_charcoal';
  if (c.kind === 'raw') return 'hand_raw_' + c.meat;
  if (c.kind === 'cooked') return 'hand_cooked_' + c.meat;
  if (c.kind === 'burnt') return 'hand_burnt';
  if (c.kind === 'plates') return (c.times && c.times.length >= 2 ? 'hand_tray_' : 'hand_plate_') + c.meat;
  return null;
}

function drawPeople(ctx, s) {
  const people = [];
  for (let i = 0; i < s.customers.length; i++) people.push({ kind: 'cust', m: s.customers[i] });
  if (s.player) people.push({ kind: 'player', m: s.player });
  if (s.buddy) people.push({ kind: 'buddy', m: s.buddy });
  if (s.tender) people.push({ kind: 'tender', m: s.tender });
  people.sort(function (a, b) { return a.m.py - b.m.py; });
  for (let i = 0; i < people.length; i++) {
    const p = people[i], m = p.m;
    const bx = Math.round(m.px), by = Math.round(m.py);
    let py = by;
    if (!reduced) {
      if (p.kind === 'cust' && m.hop > 0) py -= 2;
      if (p.kind === 'player' && bounceUntil > tAnim) py -= 2;
      if (p.kind !== 'cust' && !m.walking && !(p.kind === 'player' && s.player.busy) && Math.floor(tAnim * 2) % 2 === 1) py -= 1;
    }
    art.draw(ctx, 'shadow', bx + 2, by + 13);
    const hand = handFor(p.kind, m, s);
    if (hand && m.face === 'up') art.draw(ctx, hand, bx + 4, py + 1);
    const b = bodyFor(p.kind, m, s);
    art.draw(ctx, b[0], bx, py, b[1], b[2]);
    if (hand && m.face !== 'up') art.draw(ctx, hand, bx + 4, py + 8);
  }
}

function drawBubbles(ctx, s) {
  for (let i = 0; i < s.customers.length; i++) {
    const c = s.customers[i];
    const inLine = c.mode === 'arriving' || c.mode === 'waiting';
    const mark = markX.get(c.id);
    const showMark = mark !== undefined && mark > tAnim;
    if (!inLine && !showMark) continue;
    const px = Math.round(c.px);
    let py = Math.round(c.py);
    if (!reduced && c.hop > 0) py -= 2;
    const frac = c.patienceMax > 0 ? Math.max(0, Math.min(1, c.patience / c.patienceMax)) : 1;
    const warn = inLine && frac <= C.PATIENCE_WARN_FRAC;
    const blink = warn && !reduced && Math.floor(tAnim * 4) % 2 === 1;
    art.draw(ctx, 'bubble', px, py - 14);
    if (!blink) art.draw(ctx, showMark ? 'mark_x' : 'icon_' + c.want, px + 4, py - 12);
    if (inLine) {
      const mid = typeof C.PATIENCE_MID_FRAC === 'number' ? C.PATIENCE_MID_FRAC : 0.5;
      ctx.fillStyle = COLOR.K;
      ctx.fillRect(px + 1, py - 2, 14, 3);
      ctx.fillStyle = warn ? COLOR.O : (frac <= mid ? COLOR.Y : COLOR.G);
      const w = Math.max(frac > 0 ? 1 : 0, Math.round(14 * frac));
      if (w > 0) ctx.fillRect(px + 1, py - 2, w, 3);
    }
  }
}

// One pixel ring on the tapped tile, then its four corners. Reduced motion keeps the ring.
function drawTapMarks(ctx) {
  for (let i = 0; i < tapMarks.length; i++) {
    const m = tapMarks[i];
    const x = m.x, y = m.y;
    ctx.fillStyle = m.ok ? COLOR.Y : COLOR.O;
    if (reduced || tAnim - m.at < 0.2) {
      ctx.fillRect(x, y, 16, 1);
      ctx.fillRect(x, y + 15, 16, 1);
      ctx.fillRect(x, y, 1, 16);
      ctx.fillRect(x + 15, y, 1, 16);
    } else {
      ctx.fillRect(x, y, 1, 1);
      ctx.fillRect(x + 15, y, 1, 1);
      ctx.fillRect(x, y + 15, 1, 1);
      ctx.fillRect(x + 15, y + 15, 1, 1);
    }
  }
}

function drawFxLayer(ctx, s) {
  // Fire on good or hot cookers, smoke puffs.
  const stations = MAP.stations;
  for (let i = 0; i < stations.length; i++) {
    const st = stations[i];
    if (st.type !== 'cooker' || !owned(st)) continue;
    const ck = s.stations[st.id];
    if (!ck) continue;
    const band = PitSim.fireBand(ck.fire);
    if (band === 'good' || band === 'hot') {
      art.draw(ctx, 'fire', st.tiles[0].x * TILE + 4, st.tiles[0].y * TILE - 4, reduced ? 0 : Math.floor(tAnim * 6) % 3);
    }
  }
  if (!reduced) {
    for (let i = 0; i < smokes.length; i++) {
      const sm = smokes[i];
      art.draw(ctx, 'smoke', Math.round(sm.x), Math.round(sm.y), Math.min(2, Math.floor(sm.age / 0.4)));
    }
  }
}

function drawPops(ctx, s) {
  const b = s.stations.board;
  if (b && b.slicing && b.slicing.total > 0) {
    const t = MAP.station('board').tiles[0];
    const bx = t.x * TILE, by = t.y * TILE;
    ctx.fillStyle = COLOR.K;
    ctx.fillRect(bx, by - 5, 16, 3);
    ctx.fillStyle = COLOR.C;
    const w = Math.round(14 * Math.max(0, Math.min(1, b.slicing.t / b.slicing.total)));
    if (w > 0) ctx.fillRect(bx + 1, by - 4, w, 1);
  }
  for (let i = 0; i < pops.length; i++) {
    const p = pops[i];
    const rise = reduced ? 0 : Math.round(p.age * 14);
    const x = p.x, y = p.y - 6 - rise;
    art.draw(ctx, 'coin', x, y, Math.floor(tAnim * 8) % 2);
    drawText(ctx, '+' + p.price, x + 9, y, COLOR.O);
    if (p.tip > 0) drawText(ctx, '+' + p.tip, x + 9, y + 7, COLOR.Y);
  }
}

function drawRain(ctx) {
  ctx.fillStyle = 'rgba(90, 87, 83, 0.55)';
  ctx.fillRect(0, 0, VW, 10);
  ctx.fillStyle = 'rgba(169, 196, 217, 0.10)';
  ctx.fillRect(0, 0, VW, VH);
  if (reduced || !rainDrops) return;
  ctx.fillStyle = COLOR.w;
  for (let i = 0; i < rainDrops.length; i++) ctx.fillRect(rainDrops[i].x, Math.floor(rainDrops[i].y), 1, 3);
}

function render() {
  const s = sim.state;
  const ctx = octx;
  const T = MAP.T;
  const inService = s.phase === 'service';
  const gateOpen = inService && s.clock >= C.GATE_OPENS && s.clock < C.LAST_CALL;

  ctx.fillStyle = COLOR.K;
  ctx.fillRect(0, 0, VW, VH);

  // 1. Ground.
  for (let y = 0; y < MAP.H; y++) {
    for (let x = 0; x < MAP.W; x++) {
      const t = MAP.at(x, y);
      const px = x * TILE, py = y * TILE;
      if (t === T.FENCE) {
        const edgeRow = y === 0 || y === MAP.H - 1;
        const edgeCol = x === 0 || x === MAP.W - 1;
        art.draw(ctx, edgeRow && !edgeCol ? 'fence_h' : 'fence_v', px, py);
      } else if (t === T.GATE) {
        art.draw(ctx, 'path', px, py);
        art.draw(ctx, 'gate', px, py, gateOpen ? 1 : 0);
      } else if (t === T.PATH) {
        art.draw(ctx, 'path', px, py);
      } else if (t === T.HEDGE) {
        art.draw(ctx, 'hedge', px, py);
      } else {
        art.draw(ctx, 'grass', px, py, (x + y) % 2 === 0 ? 0 : 1);
      }
    }
  }

  // 2. Canopy canvas and back poles.
  if (s.gear.canopy) art.draw(ctx, 'canopy', 64, 74);

  // 3. Dashed outlines on inactive station tiles.
  for (let i = 0; i < MAP.stations.length; i++) {
    const st = MAP.stations[i];
    const stOwned = owned(st);
    for (let j = 0; j < st.tiles.length; j++) {
      const t = st.tiles[j];
      if (stOwned && owned(t)) continue;
      const frame = st.id === 'drum' ? (j === 0 ? 1 : 2) : 0;
      art.draw(ctx, 'outline', t.x * TILE, t.y * TILE, frame);
    }
  }

  // 4. Stations.
  drawStations(ctx, s);

  // 5. People.
  drawPeople(ctx, s);

  // 6. Canopy front poles.
  if (s.gear.canopy) {
    art.draw(ctx, 'canopy_pole', 65, 98);
    art.draw(ctx, 'canopy_pole', 139, 98);
  }

  // 7. Smoke and fire.
  drawFxLayer(ctx, s);

  // 8. Bubbles and patience bars.
  drawBubbles(ctx, s);

  // 9. Slice bar and coin pops, then tap marks.
  drawPops(ctx, s);
  if (inService) drawTapMarks(ctx);

  // 10. Rain.
  if (inService && s.rain) drawRain(ctx);

  // 11. Canvas text.
  if (inService) {
    const rem = Math.max(0, Math.ceil(C.DAY_SECONDS - s.clock));
    drawBoxedText(ctx, String(rem), 2, 2, COLOR.C);
    if (s.clock < C.GATE_OPENS) drawBoxedText(ctx, 'GATE OPENS IN ' + Math.ceil(C.GATE_OPENS - s.clock), 2, 9, COLOR.Y);
    else if (lastCallUntil > nowMs) drawBoxedText(ctx, 'LAST CALL', 2, 9, COLOR.Y);
  }

  // 12. Blit with shake.
  vctx.fillStyle = COLOR.K;
  vctx.fillRect(0, 0, el.cv.width, el.cv.height);
  let ox = 0;
  if (!reduced && shakeUntil > nowMs) ox = (Math.floor(nowMs / 16) % 2 === 0 ? 1 : -1) * scale;
  vctx.drawImage(off, 0, 0, VW, VH, ox, 0, VW * scale, VH * scale);
}

// ---------------------------------------------------------------- DOM per frame

function statusText(s) {
  if (saveOffUntil > nowMs) return 'Saving is off in this browser.';
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
