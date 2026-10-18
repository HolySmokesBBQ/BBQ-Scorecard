#!/usr/bin/env node
// games/pit-sim/dev/smoke.mjs
// Headless smoke test for the pit sim backyard prototype. Never shipped, never linked.
//
// Run from the repo root:  node games/pit-sim/dev/smoke.mjs [--out <dir>] [--desktop] [--seed <n>]
//
// What it does, in order:
//   1. Node checks with no browser: node --check on the three scripts, sim.js loaded under vm,
//      the shared surface and validateSave spot checks from the contract (section 5.1, items 1 to 3).
//   2. Launches Chrome headless with a fresh profile, connects over CDP with the global WebSocket,
//      collects every console message, exception, log entry and network request, emulates a phone
//      (375 by 812, dpr 2, mobile, touch) unless --desktop is passed, opens index.html?seed=<n>.
//   3. Plays one full day through the contract's DOM ids and window.PitSim.game.sim, asserting
//      each step of the harness list, measuring the boredom metric (seconds of service with
//      nothing cooking, no customer present and fire above the low threshold) and taps per plate.
//   4. Writes <out>/report.json and three screenshots (clipboard, mid service, till), prints one
//      summary line, exits 1 on any failed step, and always kills Chrome and removes the profile.
//
// Every selector, sim field path, tile, key and number the script depends on lives in the
// constants block below, so a contract change is one edit here.

import fs from 'node:fs';
import os from 'node:os';
import net from 'node:net';
import path from 'node:path';
import vm from 'node:vm';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

// ---------------------------------------------------------------------------------------------
// CONSTANTS: the only place that knows the contract's names
// ---------------------------------------------------------------------------------------------

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const HERE = path.dirname(fileURLToPath(import.meta.url));
// --dir <folder> points the harness at another copy of the four files (stub runs); default is the game folder.
const DIR_ARG = (() => { const i = process.argv.indexOf('--dir'); return i >= 0 && process.argv[i + 1] ? path.resolve(process.argv[i + 1]) : null; })();
const GAME_DIR = DIR_ARG || path.resolve(HERE, '..');
const FILES = {
  index: path.join(GAME_DIR, 'index.html'),
  sprites: path.join(GAME_DIR, 'sprites.js'),
  sim: path.join(GAME_DIR, 'sim.js'),
  game: path.join(GAME_DIR, 'game.js')
};
const EXPECTED_REQUEST_FILES = ['index.html', 'sprites.js', 'sim.js', 'game.js'];

const DEFAULT_SEED = 1;
const SAVE_KEY = 'hs.pitsim.save';
const GLOBAL_NAME = 'PitSim';
const SIM_SURFACE = ['C', 'MEATS', 'MEAT_IDS', 'MAP', 'CATALOG', 'STRINGS', 'createSim', 'validateSave', 'fireBand', 'fireMult', 'tileOwned', 'SAVE_KEY'];
const SURFACE_COUNTS = { tiles: 195, stations: 8, catalog: 15 };

// DOM ids (contract 4.4). Functions build the per item ids.
const ID = {
  root: 'root', cv: 'cv', act: 'act', status: 'status', live: 'live',
  clipboard: 'clipboard', open: 'open', openWhy: 'open-why', cart: 'cart', clipNew: 'clip-new',
  till: 'till', tillH: 'till-h', next: 'next',
  pause: 'pause', resume: 'resume', howto: 'howto', newgame: 'newgame', broke: 'broke',
  hireBuddy: 'hire-buddy',
  qty: (id) => 'qty-' + id,
  inc: (id) => 'inc-' + id,
  dec: (id) => 'dec-' + id,
  chip: (id) => 'chip-' + id,
  // The contract has no dedicated how to button; the Controls panel (#howto) shows with #pause.
  // If game.js adds a button under one of these ids the harness clicks it; otherwise it verifies
  // #howto through the pause panel.
  howtoButtons: ['howto-btn', 'help', 'how-to', 'btn-howto', 'controls']
};
const PHASE = { morning: 'morning', service: 'service', evening: 'evening' };
const TEXT = {
  needCharcoal: 'Buy at least one bag of charcoal.',
  gateOpensIn: 'Gate opens in',
  walk: 'Walk',
  tillHeading: (day) => 'Day ' + day + ' till',
  cartLine: (total, after) => 'Total ' + total + '. Cash after ' + after + '.'
};

// Sim field paths (contract 2.5.1), written as JS expressions over S() which returns sim.state.
const F = {
  phase: 'S().phase', day: 'S().day', cash: 'S().cash', rep: 'S().rep', paused: 'S().paused', clock: 'S().clock',
  carrying: 'S().player.carrying', busy: 'S().player.busy', walking: 'S().player.walking',
  nextTile: 'S().player.next', pathLen: 'S().player.path.length', target: 'S().player.target',
  playerX: 'S().player.x', playerY: 'S().player.y',
  cooker: (id) => 'S().stations.' + id,
  fire: (id) => 'S().stations.' + id + '.fire',
  pieces: (id) => 'S().stations.' + id + '.pieces',
  boardStacks: 'S().stations.board.stacks',
  tableSpots: 'S().stations.table.spots',
  customers: 'S().customers',
  today: 'S().today',
  till: 'S().till',
  stock: (m) => 'S().stock.' + m,
  charcoal: 'S().charcoal',
  gear: 'S().gear'
};
const COOKERS = ['kettle1', 'kettle2', 'drum'];
const PIECE_STATE = { cooking: 'cooking', done: 'done', burnt: 'burnt' };
const CARRY_KIND = { charcoal: 'charcoal', raw: 'raw', cooked: 'cooked', burnt: 'burnt', plates: 'plates' };
const CUSTOMER_PRESENT_MODES = ['arriving', 'waiting'];
const EVENT = {
  yardOpen: 'yard_open', gateOpen: 'gate_open', pieceDone: 'piece_done', sliceDone: 'slice_done',
  setDown: 'set_down', served: 'served', walkOut: 'walk_out', dayOver: 'day_over', saveWanted: 'save_wanted'
};
const C_NAMES = { gateOpens: 'GATE_OPENS', daySeconds: 'DAY_SECONDS', fireLight: 'FIRE_LIGHT', fireGood: 'FIRE_GOOD', fireLowWarn: 'FIRE_LOW_WARN', tick: 'TICK_SECONDS', repQuick: 'REP_QUICK', repOk: 'REP_OK', startCash: 'START_CASH' };
const SIM_METHODS = { walkTo: 'walkTo', interact: 'interact', drainEvents: 'drainEvents', serialize: 'serialize' };
const GAME_FIELDS = { version: 'version', advance: 'advance', reduced: 'reduced', sim: 'sim' };
const ART_FIELDS = { built: 'built' };

// Tiles the player walks to (contract 2.3.2 footprints; tapping a station tile walks to its use tile).
const TILE = {
  pile: { x: 8, y: 13 },
  kettle1: { x: 8, y: 9 },
  cooler: { x: 3, y: 11 },
  board: { x: 4, y: 9 },
  table: { x: 6, y: 6 }
};
const MAP_SIZE = { w: 13, h: 15 };

// The shopping list for day 1 and day 2. Two sausage units give four plates, so later customers
// walk out and the walk out step has something to assert.
const BUY_DAY1 = { charcoal: 4, meat: 'sausage', units: 2 };
const BUY_DAY2 = { charcoal: 1, meat: 'sausage', units: 1 };
const MEAT = 'sausage';
const PLATE_CYCLES_MAX = 2;      // pieces to pull, slice and carry during the day

const KEYS = {
  escape: { key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 },
  p: { key: 'p', code: 'KeyP', windowsVirtualKeyCode: 80 }
};
const PHONE = { width: 375, height: 812, deviceScaleFactor: 2, mobile: true };
const DESKTOP = { width: 1024, height: 820, deviceScaleFactor: 1, mobile: false };
const TIMEOUT_MS = { launch: 20000, load: 20000, cdp: 90000 };
// Simulated seconds the harness will advance while waiting for a condition.
const WAIT_S = { walk: 10, settle: 0.15, fire: 45, cook: 70, slice: 15, serve: 75, serveRetry: 25, day: 170, afterOpen: 0.2 };
const SCREENSHOTS = { clipboard: 'clipboard.png', midService: 'mid-service.png', till: 'till.png' };

// ---------------------------------------------------------------------------------------------
// Arguments and report
// ---------------------------------------------------------------------------------------------

const argv = process.argv.slice(2);
function argValue(flag, fallback) {
  const i = argv.indexOf(flag);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : fallback;
}
const DESKTOP_MODE = argv.includes('--desktop');
const SEED = Number.parseInt(argValue('--seed', String(DEFAULT_SEED)), 10) || DEFAULT_SEED;
const OUT_DIR = path.resolve(argValue('--out', path.join(os.tmpdir(), 'pit-sim-smoke')));
fs.mkdirSync(OUT_DIR, { recursive: true });

const report = {
  startedAt: new Date().toISOString(),
  mode: DESKTOP_MODE ? 'desktop' : 'phone',
  seed: SEED,
  outDir: OUT_DIR,
  steps: [],
  console: [],
  exceptions: [],
  logEntries: [],
  requests: [],
  metrics: {},
  screenshots: [],
  summary: ''
};
let failed = 0;
let fatal = false;

function record(name, ok, note) {
  report.steps.push({ name, ok, note: note || '' });
  if (!ok) failed += 1;
  console.log((ok ? 'ok   ' : 'FAIL ') + name + (note ? '  (' + note + ')' : ''));
}
function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}
async function step(name, fn, opts = {}) {
  if (fatal) { record(name, false, 'skipped after a fatal failure'); return; }
  try {
    const note = await fn();
    record(name, true, typeof note === 'string' ? note : '');
  } catch (e) {
    record(name, false, (e && e.message) || String(e));
    if (opts.fatal) fatal = true;
  }
}
function describe(v) {
  try { return JSON.stringify(v); } catch (_e) { return String(v); }
}

// ---------------------------------------------------------------------------------------------
// 1. Node checks (no browser)
// ---------------------------------------------------------------------------------------------

async function nodeChecks() {
  await step('files present', () => {
    const missing = Object.entries(FILES).filter(([, p]) => !fs.existsSync(p)).map(([k]) => k);
    assert(missing.length === 0, 'missing ' + missing.join(', '));
    return 'index, sprites, sim, game';
  }, { fatal: true });

  for (const key of ['sprites', 'sim', 'game']) {
    await step('node --check ' + key + '.js', () => {
      const r = spawnSync(process.execPath, ['--check', FILES[key]], { encoding: 'utf8' });
      assert(r.status === 0, (r.stderr || r.stdout || '').trim().split('\n')[0] || 'exit ' + r.status);
    });
  }

  await step('sim.js loads headless with the full surface', () => {
    const src = fs.readFileSync(FILES.sim, 'utf8');
    vm.runInThisContext(src, { filename: FILES.sim });
    const P = globalThis[GLOBAL_NAME];
    assert(P && typeof P === 'object', 'globalThis.' + GLOBAL_NAME + ' missing');
    const missing = SIM_SURFACE.filter((n) => !(n in P));
    assert(missing.length === 0, 'missing ' + missing.join(', '));
    assert(P.SAVE_KEY === SAVE_KEY, 'SAVE_KEY is ' + describe(P.SAVE_KEY));
    assert(P.MAP.tiles.length === SURFACE_COUNTS.tiles, 'MAP.tiles.length ' + P.MAP.tiles.length);
    assert(P.MAP.stations.length === SURFACE_COUNTS.stations, 'MAP.stations.length ' + P.MAP.stations.length);
    assert(P.CATALOG.length === SURFACE_COUNTS.catalog, 'CATALOG.length ' + P.CATALOG.length);
    return SIM_SURFACE.length + ' names';
  });

  await step('validateSave rejects and clamps as the contract says', () => {
    const P = globalThis[GLOBAL_NAME];
    assert(P && typeof P.validateSave === 'function', 'validateSave missing');
    for (const bad of [null, 'x', [], {}, { v: 2 }, undefined, 42]) {
      assert(P.validateSave(bad) === null, 'expected null for ' + describe(bad));
    }
    const dirty = { v: 1, day: 'abc', cash: -50, rep: 400, stock: { sausage: 200, bogus: 1 }, gear: { drum: true, kettle2: false }, hires: { tender: true }, extra: 1 };
    const v = P.validateSave(dirty);
    assert(v && v.day === 1, 'day ' + describe(v && v.day));
    assert(v.cash === 0, 'cash ' + v.cash);
    assert(v.rep === 100, 'rep ' + v.rep);
    assert(v.stock.sausage === 99, 'stock.sausage ' + v.stock.sausage);
    assert(!('bogus' in v.stock), 'bogus kept');
    assert(v.gear.drum === false, 'gear.drum not forced false');
    assert(v.hires.tender === false, 'hires.tender not forced false');
    assert(!('extra' in v), 'extra kept');
    const cyclic = { v: 1 }; cyclic.self = cyclic;
    assert(P.validateSave(cyclic) !== undefined, 'cyclic threw');
  });
}

// ---------------------------------------------------------------------------------------------
// 2. Chrome and CDP
// ---------------------------------------------------------------------------------------------

function freePort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.unref();
    srv.on('error', reject);
    srv.listen(0, '127.0.0.1', () => {
      const port = srv.address().port;
      srv.close(() => resolve(port));
    });
  });
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

class CDP {
  constructor(ws) {
    this.ws = ws;
    this.nextId = 0;
    this.pending = new Map();
    this.handlers = new Map();
    ws.addEventListener('message', (ev) => {
      let m;
      try { m = JSON.parse(typeof ev.data === 'string' ? ev.data : String(ev.data)); } catch (_e) { return; }
      if (m.id) {
        const p = this.pending.get(m.id);
        if (!p) return;
        this.pending.delete(m.id);
        if (m.error) p.reject(new Error(m.error.message + ' (' + p.method + ')'));
        else p.resolve(m.result);
      } else if (m.method) {
        const hs = this.handlers.get(m.method);
        if (hs) for (const h of hs) h(m.params);
      }
    });
  }
  send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = ++this.nextId;
      this.pending.set(id, { resolve, reject, method });
      this.ws.send(JSON.stringify({ id, method, params }));
      const t = setTimeout(() => {
        if (this.pending.has(id)) { this.pending.delete(id); reject(new Error('CDP timeout: ' + method)); }
      }, TIMEOUT_MS.cdp);
      if (t.unref) t.unref();
    });
  }
  on(method, fn) {
    if (!this.handlers.has(method)) this.handlers.set(method, []);
    this.handlers.get(method).push(fn);
  }
  once(method, timeoutMs = TIMEOUT_MS.load) {
    return new Promise((resolve, reject) => {
      const t = setTimeout(() => reject(new Error('timeout waiting for ' + method)), timeoutMs);
      this.on(method, function handler(p) { clearTimeout(t); resolve(p); });
    });
  }
}

let chrome = null;
let profileDir = null;
let cdp = null;

function killChrome() {
  if (!chrome) return;
  try {
    if (process.platform === 'win32') spawnSync('taskkill', ['/PID', String(chrome.pid), '/T', '/F'], { stdio: 'ignore' });
    else chrome.kill('SIGKILL');
  } catch (_e) { /* already gone */ }
  chrome = null;
}
async function removeProfile() {
  if (!profileDir) return;
  for (let i = 0; i < 6; i++) {
    try { fs.rmSync(profileDir, { recursive: true, force: true }); return; } catch (_e) { await sleep(300); }
  }
}
process.on('exit', killChrome);
process.on('SIGINT', () => { killChrome(); process.exit(130); });
process.on('SIGTERM', () => { killChrome(); process.exit(143); });

async function launch() {
  const port = await freePort();
  profileDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pit-sim-smoke-'));
  chrome = spawn(CHROME, [
    '--headless=new',
    '--remote-debugging-port=' + port,
    '--user-data-dir=' + profileDir,
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-extensions',
    '--allow-file-access-from-files',
    '--hide-scrollbars',
    'about:blank'
  ], { stdio: ['ignore', 'ignore', 'pipe'] });
  let stderr = '';
  chrome.stderr.on('data', (d) => { stderr += d; });
  const deadline = Date.now() + TIMEOUT_MS.launch;
  let targets = null;
  while (Date.now() < deadline) {
    try {
      const r = await fetch('http://127.0.0.1:' + port + '/json/list');
      if (r.ok) { targets = await r.json(); if (targets.some((t) => t.type === 'page')) break; }
    } catch (_e) { /* not up yet */ }
    if (chrome.exitCode !== null) throw new Error('Chrome exited early: ' + stderr.trim().split('\n').pop());
    await sleep(150);
  }
  assert(targets, 'Chrome did not answer on port ' + port + ' within ' + TIMEOUT_MS.launch + ' ms');
  const page = targets.find((t) => t.type === 'page');
  assert(page && page.webSocketDebuggerUrl, 'no page target in /json/list');
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    ws.addEventListener('open', resolve, { once: true });
    ws.addEventListener('error', (e) => reject(new Error('WebSocket error: ' + (e.message || 'connect'))), { once: true });
  });
  cdp = new CDP(ws);
  cdp.on('Runtime.consoleAPICalled', (p) => {
    report.console.push({ type: p.type, text: (p.args || []).map((a) => a.value !== undefined ? String(a.value) : (a.description || a.type)).join(' ') });
  });
  cdp.on('Runtime.exceptionThrown', (p) => {
    const d = p.exceptionDetails || {};
    report.exceptions.push({ text: d.text, description: d.exception && d.exception.description, line: d.lineNumber, url: d.url });
  });
  cdp.on('Log.entryAdded', (p) => {
    const e = p.entry || {};
    report.logEntries.push({ level: e.level, source: e.source, text: e.text, url: e.url });
  });
  cdp.on('Network.requestWillBeSent', (p) => { report.requests.push(p.request.url); });
  await cdp.send('Runtime.enable');
  await cdp.send('Page.enable');
  await cdp.send('Log.enable');
  await cdp.send('Network.enable');
  const metrics = DESKTOP_MODE ? DESKTOP : PHONE;
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: metrics.width, height: metrics.height, deviceScaleFactor: metrics.deviceScaleFactor, mobile: metrics.mobile });
  await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: !DESKTOP_MODE, maxTouchPoints: 5 });
  return port;
}

function errorCount() {
  const consoleErrors = report.console.filter((c) => c.type === 'error').length;
  const logErrors = report.logEntries.filter((l) => l.level === 'error').length;
  return { consoleErrors, exceptions: report.exceptions.length, logErrors, total: consoleErrors + report.exceptions.length + logErrors };
}

// ---------------------------------------------------------------------------------------------
// Page helpers
// ---------------------------------------------------------------------------------------------

const PRELUDE = `
  const g = globalThis.${GLOBAL_NAME} && globalThis.${GLOBAL_NAME}.game;
  const sim = g && g.${GAME_FIELDS.sim};
  const S = () => sim.state;
  const C = globalThis.${GLOBAL_NAME}.C;
  const $ = (id) => document.getElementById(id);
  const txt = (id) => { const e = $(id); if (!e) throw new Error('#' + id + ' missing'); return (e.textContent || '').trim(); };
  const vis = (id) => { const e = $(id); return !!e && !e.hidden && !e.closest('[hidden]') && e.getClientRects().length > 0; };
  const click = (id) => { const e = $(id); if (!e) throw new Error('#' + id + ' missing'); if (e.disabled) throw new Error('#' + id + ' is disabled'); e.click(); return true; };
`;

async function ev(expr) {
  const r = await cdp.send('Runtime.evaluate', { expression: '(() => {' + PRELUDE + ' return (' + expr + '); })()', returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) {
    const d = r.exceptionDetails;
    throw new Error('page: ' + ((d.exception && d.exception.description) || d.text).split('\n')[0]);
  }
  return r.result.value;
}
async function run(body) {
  const r = await cdp.send('Runtime.evaluate', { expression: '(() => {' + PRELUDE + body + '\n})()', returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) {
    const d = r.exceptionDetails;
    throw new Error('page: ' + ((d.exception && d.exception.description) || d.text).split('\n')[0]);
  }
  return r.result.value;
}
const click = (id) => ev('click(' + JSON.stringify(id) + ')');
const text = (id) => ev('txt(' + JSON.stringify(id) + ')');
const visible = (id) => ev('vis(' + JSON.stringify(id) + ')');

// The probe wraps sim.drainEvents so the harness sees every event game.js pumps, and samples the
// clock between advances for the boredom metric. Reinstalled after a reload; totals are carried.
const PROBE = `
  if (globalThis.__smoke) return 'present';
  const P = { events: [], bored: 0, boredPrep: 0, service: 0, lastClock: S().clock, lastDay: S().day };
  const orig = sim.${SIM_METHODS.drainEvents};
  sim.${SIM_METHODS.drainEvents} = function () {
    const out = orig.apply(sim, arguments);
    for (const e of out) P.events.push(Object.assign({ at: Math.round(S().clock * 100) / 100, day: S().day }, e));
    return out;
  };
  P.sample = function () {
    const s = S();
    let d = s.clock - P.lastClock;
    if (s.day !== P.lastDay || d < 0) d = 0;
    P.lastClock = s.clock; P.lastDay = s.day;
    if (s.phase !== '${PHASE.service}' || d <= 0) return;
    const cooking = ${describe(COOKERS)}.some((id) => s.stations[id].pieces.length > 0);
    const present = s.customers.some((c) => ${describe(CUSTOMER_PRESENT_MODES)}.includes(c.mode));
    const fireUp = ${describe(COOKERS)}.some((id) => s.stations[id].fire > C.${C_NAMES.fireLowWarn});
    const idle = !cooking && !present && fireUp;
    if (s.clock >= C.${C_NAMES.gateOpens}) { P.service += d; if (idle) P.bored += d; }
    else if (idle) P.boredPrep += d;
  };
  P.until = function (pred, maxSec) {
    const dt = C.${C_NAMES.tick};
    let t = 0;
    P.sample();
    while (t < maxSec) {
      if (pred()) return { ok: true, t: Math.round(t * 100) / 100 };
      g.${GAME_FIELDS.advance}(dt);
      t += dt;
      P.sample();
    }
    return { ok: !!pred(), t: Math.round(t * 100) / 100 };
  };
  globalThis.__smoke = P;
  return 'installed';
`;
const installProbe = () => run(PROBE);

// Advance the sim until pred (a JS expression over S(), C, sim) holds, at most maxSec simulated seconds.
async function until(pred, maxSec) {
  return run('return globalThis.__smoke.until(() => (' + pred + '), ' + maxSec + ');');
}
async function eventsOfType(type) {
  return run('return globalThis.__smoke.events.filter((e) => e.type === ' + JSON.stringify(type) + ');');
}
async function probeMetrics() {
  return run('const P = globalThis.__smoke; return { bored: P.bored, boredPrep: P.boredPrep, service: P.service, events: P.events.length };');
}

let taps = 0;        // canvas taps, action button clicks and walkTo fallbacks during service
let tapNotes = [];

async function canvasTap(tx, ty) {
  const r = await ev('(() => { const b = $(' + JSON.stringify(ID.cv) + ').getBoundingClientRect(); return { l: b.left, t: b.top, w: b.width, h: b.height }; })()');
  const x = r.l + (tx + 0.5) * r.w / MAP_SIZE.w;
  const y = r.t + (ty + 0.5) * r.h / MAP_SIZE.h;
  if (DESKTOP_MODE) {
    await cdp.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y });
    await cdp.send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 });
    await cdp.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 });
  } else {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, radiusX: 4, radiusY: 4, force: 1 }] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  }
  taps += 1;
}
async function settle(maxSec = WAIT_S.walk) {
  const r = await until('!' + F.walking + ' && ' + F.nextTile + ' === null && ' + F.pathLen + ' === 0', maxSec);
  await until('false', WAIT_S.settle);   // let the arrival auto action tick
  return r;
}
// Walk to a station with a real tap, settle, check the expected effect; fall back to sim.walkTo,
// then to the action button, noting which path worked.
async function goto(name, expectExpr) {
  const t = TILE[name];
  let how = 'tap';
  await canvasTap(t.x, t.y);
  await settle();
  let ok = await ev(expectExpr);
  if (!ok) {
    how = 'walkTo';
    await ev('sim.' + SIM_METHODS.walkTo + '(' + t.x + ', ' + t.y + ')');
    taps += 1;
    await settle();
    ok = await ev(expectExpr);
  }
  if (!ok) {
    how += '+act';
    await click(ID.act).catch(() => {});
    taps += 1;
    await until('false', WAIT_S.settle);
    ok = await ev(expectExpr);
  }
  if (how !== 'tap') tapNotes.push(name + ' via ' + how);
  return { ok, how };
}
const hasKind = (kind) => F.carrying + ' !== null && ' + F.carrying + '.kind === ' + JSON.stringify(kind);
const anyPiece = (state) => F.pieces('kettle1') + '.some((p) => p.state === ' + JSON.stringify(state) + ')';
const boardHasPlates = F.boardStacks + '.some((st) => st.times.length > 0)';
const tableHas = (meat) => F.tableSpots + '.some((sp) => sp && sp.meat === ' + JSON.stringify(meat) + ' && sp.times.length > 0)';

async function feedFireIfLow() {
  const low = await ev(F.fire('kettle1') + ' < C.' + C_NAMES.fireGood + ' && ' + F.carrying + ' === null && ' + F.charcoal + ' > 0');
  if (!low) return false;
  const before = await ev(F.fire('kettle1'));
  const a = await goto('pile', hasKind(CARRY_KIND.charcoal));
  if (!a.ok) return false;
  const b = await goto('kettle1', F.fire('kettle1') + ' > ' + before);
  return b.ok;
}
async function waitForDone() {
  const deadline = WAIT_S.cook;
  let spent = 0;
  for (let i = 0; i < 8 && spent < deadline; i++) {
    const r = await until(anyPiece(PIECE_STATE.done) + ' || ' + F.fire('kettle1') + ' < C.' + C_NAMES.fireGood + ' || ' + F.phase + ' !== ' + JSON.stringify(PHASE.service), deadline - spent);
    spent += r.t;
    if (await ev(anyPiece(PIECE_STATE.done))) return true;
    if (await ev(F.phase + ' !== ' + JSON.stringify(PHASE.service))) return false;
    await feedFireIfLow();
  }
  return ev(anyPiece(PIECE_STATE.done));
}
async function keyPress(k) {
  await cdp.send('Input.dispatchKeyEvent', { type: 'keyDown', key: k.key, code: k.code, windowsVirtualKeyCode: k.windowsVirtualKeyCode });
  await cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', key: k.key, code: k.code, windowsVirtualKeyCode: k.windowsVirtualKeyCode });
}
async function screenshot(name) {
  const r = await cdp.send('Page.captureScreenshot', { format: 'png' });
  const file = path.join(OUT_DIR, name);
  fs.writeFileSync(file, Buffer.from(r.data, 'base64'));
  report.screenshots.push(file);
  return file;
}
async function waitForGame() {
  const deadline = Date.now() + TIMEOUT_MS.load;
  while (Date.now() < deadline) {
    const ready = await cdp.send('Runtime.evaluate', { expression: 'typeof ' + GLOBAL_NAME + ' !== "undefined" && !!' + GLOBAL_NAME + '.game && !!' + GLOBAL_NAME + '.game.' + GAME_FIELDS.sim, returnByValue: true });
    if (ready.result && ready.result.value === true) return true;
    await sleep(100);
  }
  return false;
}
async function shop(list) {
  for (let i = 0; i < list.charcoal; i++) await click(ID.inc('charcoal'));
  for (let i = 0; i < list.units; i++) await click(ID.inc(list.meat));
}
// Day 1 opens with a prefilled cart (sim.js deviation 12). Click every line down to zero through
// the DOM so the buy steps below start from the contract's empty cart.
async function emptyCart() {
  const cart = await ev('JSON.parse(JSON.stringify(S().cart))');
  let clicks = 0;
  for (let i = 0; i < (cart.charcoal | 0); i++) { await click(ID.dec('charcoal')); clicks += 1; }
  for (const m of Object.keys(cart.meat || {})) {
    for (let i = 0; i < (cart.meat[m] | 0); i++) { await click(ID.dec(m)); clicks += 1; }
  }
  return clicks;
}

// ---------------------------------------------------------------------------------------------
// 3. The day
// ---------------------------------------------------------------------------------------------

async function browserChecks() {
  const url = pathToFileURL(FILES.index).href + '?seed=' + SEED;
  const errorsAtLoad = { total: 0 };

  await step('page loaded with zero errors', async () => {
    const loaded = cdp.once('Page.loadEventFired');
    await cdp.send('Page.navigate', { url });
    await loaded;
    assert(await waitForGame(), GLOBAL_NAME + '.game did not appear within ' + TIMEOUT_MS.load + ' ms');
    await sleep(250);
    const e = errorCount();
    Object.assign(errorsAtLoad, e);
    assert(e.total === 0, describe(e) + ' first: ' + describe(report.console.find((c) => c.type === 'error') || report.exceptions[0] || report.logEntries.find((l) => l.level === 'error')));
    const art = await ev(GLOBAL_NAME + '.art && ' + GLOBAL_NAME + '.art.' + ART_FIELDS.built + ' === true');
    assert(art, 'art.built is not true');
    const ver = await ev('typeof g.' + GAME_FIELDS.version);
    assert(ver === 'string', 'game.version is ' + ver);
    await installProbe();
    return 'version ' + (await ev('g.' + GAME_FIELDS.version));
  }, { fatal: true });

  await step('only the four file:// requests', () => {
    const bad = report.requests.filter((u) => !(u.startsWith('file:') && EXPECTED_REQUEST_FILES.some((f) => u.includes('/' + f))));
    assert(bad.length === 0, 'unexpected: ' + bad.slice(0, 3).join(', '));
    return report.requests.length + ' requests';
  });

  await step('clipboard: morning, day 1, start cash', async () => {
    const s = await ev('({ phase: ' + F.phase + ', day: ' + F.day + ', cash: ' + F.cash + ', start: C.' + C_NAMES.startCash + ' })');
    assert(s.phase === PHASE.morning, 'phase ' + s.phase);
    assert(s.day === 1, 'day ' + s.day);
    assert(s.cash === s.start, 'cash ' + s.cash);
    assert(await visible(ID.clipboard), '#clipboard hidden');
    await screenshot(SCREENSHOTS.clipboard);
    const prefilled = await ev('JSON.parse(JSON.stringify(S().cart))');
    const prefillTotal = await ev('sim.cartTotal()');
    if (prefillTotal > 0) {
      assert(await ev('$(' + JSON.stringify(ID.open) + ').disabled === false'), '#open disabled with a prefilled cart');
      const openBox = await ev('(() => { const b = $(' + JSON.stringify(ID.open) + ').getBoundingClientRect(); return { top: b.top, bottom: b.bottom, h: window.innerHeight }; })()');
      assert(openBox.top >= 0 && openBox.bottom <= openBox.h, '#open is not inside the viewport before scrolling: ' + describe(openBox));
    }
    const emptied = await emptyCart();
    assert(await ev('$(' + JSON.stringify(ID.open) + ').disabled === true'), '#open should be disabled with an empty cart');
    const why = await text(ID.openWhy);
    assert(why === TEXT.needCharcoal, '#open-why is ' + describe(why));
    return prefillTotal > 0 ? 'prefilled ' + describe(prefilled) + ' (total ' + prefillTotal + '), emptied in ' + emptied + ' clicks' : 'cart started empty';
  }, { fatal: true });

  await step('how to', async () => {
    const found = await ev('(' + describe(ID.howtoButtons) + ').find((id) => $(id) && !$(id).hidden) || null');
    if (!found) return 'no how to button in the contract; #howto is checked with the pause panel';
    await click(found);
    assert(await visible(ID.howto), '#howto not visible after clicking #' + found);
    await keyPress(KEYS.escape);
    await sleep(50);
    assert(await visible(ID.clipboard), '#clipboard did not come back after Escape on #howto');
    return 'clicked #' + found + ', Escape returned to the clipboard';
  });

  let cartTotal = 0;
  await step('bought', async () => {
    const prices = await ev('({ charcoal: ' + GLOBAL_NAME + '.CATALOG.find((r) => r.id === "charcoal").price, meat: ' + GLOBAL_NAME + '.CATALOG.find((r) => r.id === ' + JSON.stringify(BUY_DAY1.meat) + ').price, cash: ' + F.cash + ' })');
    await shop(BUY_DAY1);
    cartTotal = BUY_DAY1.charcoal * prices.charcoal + BUY_DAY1.units * prices.meat;
    const qty = await text(ID.qty('charcoal'));
    assert(qty === String(BUY_DAY1.charcoal), '#qty-charcoal is ' + describe(qty));
    const cart = await text(ID.cart);
    const want = TEXT.cartLine(cartTotal, prices.cash - cartTotal);
    assert(cart === want, '#cart is ' + describe(cart) + ', wanted ' + describe(want));
    assert(await ev('$(' + JSON.stringify(ID.open) + ').disabled === false'), '#open still disabled');
    return cart;
  }, { fatal: true });

  let cashAtOpen = 0;
  await step('gate open', async () => {
    const before = await ev(F.cash);
    await click(ID.open);
    await until('false', WAIT_S.afterOpen);
    const s = await ev('({ phase: ' + F.phase + ', cash: ' + F.cash + ' })');
    assert(s.phase === PHASE.service, 'phase ' + s.phase);
    assert(s.cash === before - cartTotal, 'cash ' + s.cash + ', wanted ' + (before - cartTotal));
    cashAtOpen = s.cash;
    assert(!(await visible(ID.clipboard)), '#clipboard still visible');
    const status = await text(ID.status);
    assert(status.startsWith(TEXT.gateOpensIn), '#status is ' + describe(status));
    const act = await text(ID.act);
    assert(act === TEXT.walk, '#act is ' + describe(act));
    const opened = await eventsOfType(EVENT.yardOpen);
    assert(opened.length === 1, EVENT.yardOpen + ' events: ' + opened.length);
    return 'cash ' + s.cash;
  }, { fatal: true });

  await step('fire raised', async () => {
    const a = await goto('pile', hasKind(CARRY_KIND.charcoal));
    assert(a.ok, 'not carrying charcoal after the pile; carrying ' + describe(await ev(F.carrying)));
    const b = await goto('kettle1', F.fire('kettle1') + ' >= C.' + C_NAMES.fireLight);
    const fire = await ev(F.fire('kettle1'));
    assert(b.ok, 'kettle 1 fire is ' + fire);
    return 'fire ' + fire + ' (' + a.how + ', ' + b.how + ')';
  }, { fatal: true });

  await step('meat on', async () => {
    const a = await goto('cooler', hasKind(CARRY_KIND.raw) + ' && ' + F.carrying + '.meat === ' + JSON.stringify(MEAT));
    assert(a.ok, 'not carrying raw ' + MEAT + '; carrying ' + describe(await ev(F.carrying)));
    const b = await goto('kettle1', F.pieces('kettle1') + '.length >= 1');
    assert(b.ok, 'kettle 1 has no piece');
    // Second unit on the other grate slot, when stock allows.
    if (await ev(F.stock(MEAT) + ' > 0')) {
      const c = await goto('cooler', hasKind(CARRY_KIND.raw));
      if (c.ok) await goto('kettle1', F.pieces('kettle1') + '.length >= 2');
    }
    return (await ev(F.pieces('kettle1') + '.length')) + ' piece(s) on kettle 1';
  }, { fatal: true });

  await step('piece done', async () => {
    const ok = await waitForDone();
    const states = await ev(F.pieces('kettle1') + '.map((p) => p.state + "@" + Math.round(p.prog))');
    assert(ok, 'no piece reached done; pieces ' + describe(states) + ', fire ' + (await ev(F.fire('kettle1'))));
    const done = await eventsOfType(EVENT.pieceDone);
    assert(done.length >= 1, 'no ' + EVENT.pieceDone + ' event');
    return 'at clock ' + Math.round(await ev(F.clock)) + 's, fire ' + Math.round(await ev(F.fire('kettle1')));
  }, { fatal: true });

  await step('sliced', async () => {
    const a = await goto('kettle1', hasKind(CARRY_KIND.cooked));
    assert(a.ok, 'did not pull the done piece; carrying ' + describe(await ev(F.carrying)));
    const b = await goto('board', F.busy + ' !== null || ' + boardHasPlates);
    assert(b.ok, 'slice did not start at the board');
    const r = await until(boardHasPlates + ' && ' + F.busy + ' === null', WAIT_S.slice);
    assert(r.ok, 'slice did not finish within ' + WAIT_S.slice + 's');
    const sliced = await eventsOfType(EVENT.sliceDone);
    assert(sliced.length >= 1, 'no ' + EVENT.sliceDone + ' event');
    return (await ev(F.boardStacks + '[0].times.length')) + ' plates on the board';
  }, { fatal: true });

  await step('carried', async () => {
    const a = await goto('board', hasKind(CARRY_KIND.plates));
    assert(a.ok, 'did not pick up plates; carrying ' + describe(await ev(F.carrying)));
    return (await ev(F.carrying + '.times.length')) + ' plate(s) in hand';
  }, { fatal: true });

  await step('served with cash up and a served event', async () => {
    const a = await goto('table', tableHas(MEAT));
    assert(a.ok, 'plate did not land on the table');
    const setDown = await eventsOfType(EVENT.setDown);
    assert(setDown.length >= 1, 'no ' + EVENT.setDown + ' event');
    // Carry any plate still on the board while the first one waits for a customer.
    for (let i = 0; i < 3 && (await ev(boardHasPlates)); i++) {
      const p = await goto('board', hasKind(CARRY_KIND.plates));
      if (!p.ok) break;
      await goto('table', F.carrying + ' === null');
    }
    const cashBefore = await ev(F.cash);
    let r = await until(F.today + '.served >= 1 || ' + F.phase + ' !== ' + JSON.stringify(PHASE.service), WAIT_S.serve);
    if (!(await ev(F.today + '.served >= 1'))) {
      // Serving may need the player at the table; try once more from there.
      await goto('table', 'true');
      r = await until(F.today + '.served >= 1 || ' + F.phase + ' !== ' + JSON.stringify(PHASE.service), WAIT_S.serveRetry);
    }
    const served = await eventsOfType(EVENT.served);
    const cash = await ev(F.cash);
    assert(served.length >= 1, 'no ' + EVENT.served + ' event after ' + r.t + 's; customers ' + describe(await ev(F.customers + '.map((c) => c.want + ":" + c.mode)')));
    assert(cash > cashBefore, 'cash ' + cash + ' not above ' + cashBefore);
    await screenshot(SCREENSHOTS.midService);
    return 'cash ' + cashBefore + ' to ' + cash + ', tip ' + served[0].tip;
  }, { fatal: true });

  await step('rest of the day cooked and carried', async () => {
    let cycles = 0;
    for (let i = 0; i < PLATE_CYCLES_MAX + 2; i++) {
      if (await ev(F.phase + ' !== ' + JSON.stringify(PHASE.service))) break;
      const hasDone = await ev(anyPiece(PIECE_STATE.done));
      const hasCooking = await ev(anyPiece(PIECE_STATE.cooking));
      if (hasDone && (await ev(F.carrying + ' === null'))) {
        const a = await goto('kettle1', hasKind(CARRY_KIND.cooked));
        if (!a.ok) break;
        await goto('board', F.busy + ' !== null || ' + boardHasPlates);
        await until(boardHasPlates + ' && ' + F.busy + ' === null', WAIT_S.slice);
        for (let j = 0; j < 3 && (await ev(boardHasPlates)); j++) {
          const p = await goto('board', hasKind(CARRY_KIND.plates));
          if (!p.ok) break;
          await goto('table', F.carrying + ' === null');
        }
        cycles += 1;
      } else if (hasCooking) {
        await waitForDone();
      } else break;
    }
    return cycles + ' extra plate cycle(s)';
  });

  await step('day over', async () => {
    const r = await until(F.phase + ' === ' + JSON.stringify(PHASE.evening), WAIT_S.day);
    assert(r.ok, 'phase still ' + (await ev(F.phase)) + ' after ' + r.t + 's');
    const over = await eventsOfType(EVENT.dayOver);
    assert(over.length === 1, EVENT.dayOver + ' events: ' + over.length);
    assert(await ev(F.till + ' !== null'), 'till is null');
    return 'day ' + (await ev(F.day));
  }, { fatal: true });

  await step('a walk-out with rep down, or the day sold out early', async () => {
    const t = await ev(F.till);
    const outs = await eventsOfType(EVENT.walkOut);
    const positive = t.happy * (await ev('C.' + C_NAMES.repQuick)) + t.ok * (await ev('C.' + C_NAMES.repOk));
    if (outs.length === 0) {
      // Sold out ends the day (sim.js deviation 8): nothing left anywhere, so nobody could walk out.
      const over = (await eventsOfType(EVENT.dayOver))[0];
      const daySeconds = await ev('C.' + C_NAMES.daySeconds);
      const stockLeft = await ev('Object.values(' + F.stock('').slice(0, -1) + ').reduce((a, b) => a + b, 0)');
      assert(over && over.at < daySeconds, 'no walk-out and the day ran the full ' + daySeconds + 's; till customers ' + t.customers + ', served ' + t.served + ', past ' + t.past + ', close ' + t.close);
      assert(t.walkouts === 0, 'till.walkouts is ' + t.walkouts + ' with no walk_out event');
      assert(stockLeft === 0, 'stock left ' + stockLeft + ' after an early day end');
      assert(t.repDelta === positive, 'repDelta ' + t.repDelta + ' differs from the serve credit ' + positive + ' with no walk-out');
      return 'sold out at ' + over.at + 's, ' + t.served + ' served, repDelta ' + t.repDelta;
    }
    assert(t.walkouts >= 1, 'till.walkouts is ' + t.walkouts);
    assert(t.repDelta < positive, 'repDelta ' + t.repDelta + ' is not below the serve credit ' + positive);
    return outs.length + ' walk-out(s), repDelta ' + t.repDelta + ' (serve credit ' + positive + ')';
  });

  await step('till shown', async () => {
    assert(await visible(ID.till), '#till hidden');
    const h = await text(ID.tillH);
    assert(h === TEXT.tillHeading(1), '#till-h is ' + describe(h));
    await screenshot(SCREENSHOTS.till);
    const t = await ev(F.till);
    return 'served ' + t.served + ', revenue ' + t.revenue + ', tips ' + t.tips + ', net ' + t.net + ', cash ' + t.cashAfter;
  });

  let savedCash = null;
  await step('save key present and valid', async () => {
    const r = await run('const raw = localStorage.getItem(' + JSON.stringify(SAVE_KEY) + '); let parsed = null; try { parsed = JSON.parse(raw); } catch (e) { return { raw, error: String(e) }; } return { raw: !!raw, v: ' + GLOBAL_NAME + '.validateSave(parsed), cash: ' + F.cash + ', day: ' + F.day + ' };');
    assert(r.raw, SAVE_KEY + ' missing');
    assert(!r.error, 'save is not JSON: ' + r.error);
    assert(r.v, 'validateSave returned null');
    assert(r.v.day === 2 && r.day === 2, 'save day ' + r.v.day + ', state day ' + r.day);
    assert(r.v.cash === r.cash, 'save cash ' + r.v.cash + ', state cash ' + r.cash);
    savedCash = r.cash;
    return 'day ' + r.v.day + ', cash ' + r.v.cash;
  });

  const before = await probeMetrics().catch(() => ({ bored: 0, boredPrep: 0, service: 0, events: 0 }));
  const eventsDay1 = await run('return globalThis.__smoke.events;').catch(() => []);

  await step('reload persists', async () => {
    const loaded = cdp.once('Page.loadEventFired');
    await cdp.send('Page.reload', { ignoreCache: true });
    await loaded;
    assert(await waitForGame(), GLOBAL_NAME + '.game did not come back after reload');
    await sleep(250);
    await installProbe();
    const s = await ev('({ phase: ' + F.phase + ', day: ' + F.day + ', cash: ' + F.cash + ' })');
    assert(s.phase === PHASE.morning, 'phase ' + s.phase);
    assert(s.day === 2, 'day ' + s.day);
    assert(savedCash === null || s.cash === savedCash, 'cash ' + s.cash + ', saved ' + savedCash);
    assert(await visible(ID.clipboard), '#clipboard hidden on day 2');
    assert(await ev('!!$(' + JSON.stringify(ID.hireBuddy) + ') && !$(' + JSON.stringify(ID.hireBuddy) + ').disabled'), '#hire-buddy missing or disabled on day 2');
    return 'day 2, cash ' + s.cash;
  }, { fatal: true });

  await step('pause and resume', async () => {
    await shop(BUY_DAY2);
    await click(ID.open);
    await until('false', WAIT_S.afterOpen);
    assert((await ev(F.phase)) === PHASE.service, 'day 2 did not open');
    await keyPress(KEYS.escape);
    await sleep(100);
    assert(await visible(ID.pause), '#pause not visible after Escape');
    assert(await ev(F.paused + ' === true'), 'state.paused is not true');
    assert(await ev('$(' + JSON.stringify(ID.root) + ').dataset.paused === "1"'), '#root data-paused is not 1');
    const howto = await visible(ID.howto);
    await keyPress(KEYS.escape);
    await sleep(100);
    assert(!(await visible(ID.pause)), '#pause still visible after the second Escape');
    assert(await ev(F.paused + ' === false'), 'state.paused still true');
    await keyPress(KEYS.p);
    await sleep(100);
    assert(await visible(ID.pause), '#pause not visible after P');
    assert(await ev(F.paused + ' === true'), 'state.paused is not true after P');
    await keyPress(KEYS.p);
    await sleep(100);
    assert(!(await visible(ID.pause)), '#pause still visible after the second P');
    assert(await ev(F.paused + ' === false'), 'state.paused still true after the second P');
    return (howto ? 'Controls panel shown with pause' : 'resumed (#howto was not visible with #pause)') + '; P pauses and resumes';
  });

  await step('zero console errors across the run', () => {
    const e = errorCount();
    assert(e.total === 0, describe(e));
    return 'console ' + report.console.length + ' messages';
  });

  // Metrics
  const after = await probeMetrics().catch(() => ({ bored: 0, boredPrep: 0, service: 0, events: 0 }));
  const served = eventsDay1.filter((e) => e.type === EVENT.served).length;
  const daySecondsOfService = before.service;   // day 1 only; day 2 is a short pause check
  report.metrics = {
    platesServed: served,
    taps,
    tapsPerPlate: served ? Math.round((taps / served) * 100) / 100 : null,
    tapFallbacks: tapNotes,
    boredomSeconds: Math.round(before.bored * 100) / 100,
    boredomPrepSeconds: Math.round(before.boredPrep * 100) / 100,
    serviceSeconds: Math.round(daySecondsOfService * 100) / 100,
    boredomFraction: daySecondsOfService ? Math.round((before.bored / daySecondsOfService) * 1000) / 1000 : null,
    day1Events: eventsDay1.length,
    day2Events: after.events,
    walkOuts: eventsDay1.filter((e) => e.type === EVENT.walkOut).length,
    customersArrived: eventsDay1.filter((e) => e.type === 'customer_arrived').length,
    errors: errorCount()
  };
  report.events = eventsDay1;
}

// ---------------------------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------------------------

async function main() {
  await nodeChecks();
  if (!fatal) {
    try {
      await step('Chrome launched and CDP connected', async () => {
        const port = await launch();
        return 'port ' + port + ', ' + report.mode;
      }, { fatal: true });
      if (!fatal) await browserChecks();
    } catch (e) {
      record('browser run', false, (e && e.stack) || String(e));
    } finally {
      try { if (cdp) await cdp.send('Browser.close').catch(() => {}); } catch (_e) { /* ignore */ }
      try { if (cdp && cdp.ws) cdp.ws.close(); } catch (_e) { /* ignore */ }
      killChrome();
      await removeProfile();
    }
  }
  const total = report.steps.length;
  const ok = total - failed;
  const m = report.metrics;
  const parts = [
    'smoke: ' + ok + '/' + total + ' steps ok',
    m.boredomSeconds !== undefined ? 'boredom ' + m.boredomSeconds + 's of ' + m.serviceSeconds + 's service' + (m.boredomFraction !== null && m.boredomFraction !== undefined ? ' (' + Math.round(m.boredomFraction * 100) + '%)' : '') : null,
    m.tapsPerPlate !== undefined && m.tapsPerPlate !== null ? m.tapsPerPlate + ' taps/plate (' + m.taps + ' taps, ' + m.platesServed + ' plates)' : null,
    (m.errors ? m.errors.total : errorCount().total) + ' errors',
    'report ' + path.join(OUT_DIR, 'report.json')
  ].filter(Boolean);
  report.summary = parts.join(', ');
  report.finishedAt = new Date().toISOString();
  fs.writeFileSync(path.join(OUT_DIR, 'report.json'), JSON.stringify(report, null, 2) + '\n', 'utf8');
  console.log(report.summary);
  process.exitCode = failed > 0 ? 1 : 0;
}

main().catch((e) => {
  console.error('smoke: crashed: ' + ((e && e.stack) || e));
  killChrome();
  try { fs.writeFileSync(path.join(OUT_DIR, 'report.json'), JSON.stringify(Object.assign(report, { crash: String(e && e.stack || e) }), null, 2) + '\n', 'utf8'); } catch (_e) { /* ignore */ }
  process.exitCode = 1;
});
