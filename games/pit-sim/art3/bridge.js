// games/pit-sim/art3/bridge.js
// Your Pit v3.4: the adapter between game.js and the art3 library. game.js still lays the yard out
// in sim px with v2 sprite names (its capture records and the harness read those); every draw goes
// through bridge.draw(ctx, name, x, y, w, h, frame, flip), which finds the art3 sprite for that v2
// name and draws it in render px (2 x sim px) so its anchor sits on the v2 sprite's bottom centre.
// People go through art3.drawPerson with a look id: 'player' (the creator look), 'crew_run',
// 'crew_fire', 'crew_prep' (each card's look) and 'g<id>' for guests (art3.randomLook seeded by the
// customer id). Names art3 has no art for return false, and game.js draws the v2 sprite at 2x.
// Loaded after art3/index.js and before game.js.
(function () {
'use strict';
const PitSim = window.PitSim = window.PitSim || {};
const art3 = PitSim.art3;
if (!art3 || typeof art3.build !== 'function') return;
const S = 2;   // render px per sim px
const BUBBLE_DROP = 10;

const HAIRS = ['short', 'curly', 'long', 'buzz', 'bun', 'bald'];
const FACES = ['none', 'mustache', 'beard', 'glasses'];
const HATS = ['none', 'cap', 'cowboy', 'bandana'];
const ROLE3 = { run: 'RUN', fire: 'FIRE', prep: 'PREP' };
const KIND_LOOK = { player: 'player', buddy: 'crew_run', tender: 'crew_fire', prep: 'crew_prep' };
const POSE = { down: 'down', up: 'up', side: 'side', slice: 'down', sit: 'sit' };
const CARRY = { down: 'carry_down', up: 'carry_up', side: 'carry_side' };
const POSE3 = { down: 'down', up: 'up', side: 'side', carry_down: 'carryDown', carry_up: 'carryUp', carry_side: 'carrySide', sit: 'sit' };
// v2 names that are the same thing under another art3 name.
const ALIAS = { fence_h: 'fence_front', fence_v: 'fence_side', hand_burnt: ['piece_brisket', 3], planter: ['pot', 0],
  picnic: ['picnic_small', 0], picnic_bench: ['bench_small', 0],
  hand_tray: 'platter_empty', hand_charcoal: 'carry_charcoal', hand_togo: 'carry_togo' };
let ext = null;        // the counter extension's v2 rect, drawn with the counter as counter_long
let signAt = null;
let lastCounter = null; // the plain counter's v2 rect, for the extension's ghost     // where the last art3 sign drew (its anchor, render px), for signText

let ready = false;
let isoView = false;   // v3.5: the iso yard, where the serving table runs down to the right (drawn mirrored)
let who = null;        // the guest id for the next cust_* draw
let carrying = false;  // the next person draw holds something
const keys = Object.create(null);
const guests = Object.create(null);
const misses = Object.create(null);   // v2 names drawn as v2 art (no art3 sprite yet)

function intIn(v, n, d) { return (typeof v === 'number' && Number.isInteger(v) && v >= 0 && v < n) ? v : d; }

// The v2 look (skin, hair, hairColor, face, hat, apron as indexes) as art3 look parts.
function toParts(l, kind, role) {
  l = l || {};
  const p = {
    body: 'A',
    skin: intIn(l.skin, 6, 1),
    hair: HAIRS[intIn(l.hair, 6, 0)],
    hairColor: intIn(l.hairColor, 6, 1),
    face: FACES[intIn(l.face, 4, 0)],
    hat: HATS[intIn(l.hat, 4, kind === 'player' ? 1 : 0)],
    pants: 0,
    apron: intIn(l.apron, 6, 0),
    tongs: kind === 'player'
  };
  if (kind === 'crew') { p.role = ROLE3[role] || 'RUN'; p.body = role === 'fire' ? 'B' : 'A'; p.pants = role === 'prep' ? 2 : 1; }
  else p.shirt = 'white';
  return p;
}

function boot() {
  if (ready) return true;
  try {
    art3.build();
    if (!art3.lookOf || !art3.lookOf('player')) art3.look('player', toParts(null, 'player'));
    ['run', 'fire', 'prep'].forEach(function (r) { if (!art3.lookOf || !art3.lookOf('crew_' + r)) art3.look('crew_' + r, art3.randomLook('crew_' + r, 'crew', ROLE3[r])); });
    ready = true;
  } catch (e) { console.error(e); ready = false; }
  return ready;
}

function setLook(id, parts) {
  const k = JSON.stringify(parts);
  if (keys[id] === k) return;
  keys[id] = k;
  try { art3.look(id, parts); } catch (e) { console.error(e); }
}
function setPlayer(l) { setLook('player', toParts(l, 'player')); }
function setCrew(role, l) { setLook('crew_' + role, toParts(l, 'crew', role)); }
function guestId(id) {
  const k = 'g' + id;
  if (!guests[k]) { guests[k] = 1; art3.look(k, art3.randomLook('guest' + id, 'guest')); }
  return k;
}
// Set before a person draw: the guest id (customers) and whether hands are full.
function person(id, holding) { who = id === null || id === undefined ? null : id; carrying = !!holding; }

function wrap(name, f) { const n = art3.frames(name) || 1; return ((f | 0) % n + n) % n; }

function drawPerson(ctx, look, pose, frame, fx, fy, flip) {
  const p3 = POSE3[pose] || 'down';
  const n = art3.people && art3.people.POSES ? (art3.people.POSES[p3] || 1) : 1;
  art3.drawPerson(ctx, look, p3, ((frame | 0) % n + n) % n, fx, fy, flip);
}

// Draws the art3 version of v2 sprite `name` drawn at (x, y) sim px with v2 size w by h.
// ctx is the 2x transformed off canvas; returns false when art3 has nothing for the name.
const PERSON = /^(player|buddy|tender|prep|cust\d)_(down|up|side|sit|slice)$/;
function draw(ctx, name, x, y, w, h, frame, flip) {
  if (!ready) return false;
  const fx = Math.round(x * S + w), fy = Math.round((y + h) * S);
  const m = PERSON.exec(name);
  let a = null;
  if (m) {
    let look;
    if (m[1].indexOf('cust') === 0) look = guestId(who === null ? m[1] : who);
    else look = KIND_LOOK[m[1]];
    let pose = POSE[m[2]];
    if (carrying && CARRY[pose]) pose = CARRY[pose];
    a = function () { drawPerson(ctx, look, pose, frame, fx, fy, flip); };
  } else if (name === 'counter_ext' && ctx.globalAlpha >= 1) {
    ext = { x: x, y: y, w: w, h: h };
    return true;
  } else if (name === 'counter' && frame !== 1) {
    lastCounter = { x: x, y: y, w: w, h: h };
    a = function () { art3.drawAt(ctx, 'counter', fx, fy, 0, isoView); };
  } else if (name === 'counter' && frame === 1 && ext && art3.has('counter_long')) {
    const e = ext, x0 = Math.min(e.x, x), x1 = Math.max(e.x + e.w, x + w), yb = Math.max(e.y + e.h, y + h);
    ext = null;
    a = function () { art3.drawAt(ctx, 'counter_long', Math.round(x0 + x1), Math.round(yb * S), 0, isoView); };
  } else if (name === 'shadow') {
    a = function () { if (art3.drawPersonShadow) art3.drawPersonShadow(ctx, fx, fy + 4); };
  } else {
    let n3 = name, f3 = frame;
    const al = ALIAS[name];
    if (Array.isArray(al)) { n3 = al[0]; f3 = al[1]; } else if (al) n3 = al;
    let hm = /^hand_(plate|tray|cooked|raw)_(\w+)$/.exec(name);
    if (hm) {
      if (hm[1] === 'plate') n3 = 'plate_' + hm[2];
      else if (hm[1] === 'tray') n3 = 'platter_' + hm[2];
      else { n3 = 'piece_' + hm[2]; f3 = hm[1] === 'raw' ? 0 : 2; }
    }
    if (!art3.has(n3)) { misses[name] = (misses[name] || 0) + 1; return false; }
    // The v2 bubble frames the plate drawn inside it; the art3 bubble is taller, so it drops to
    // keep that plate on its body above the tail.
    const dy = /^bubble/.test(n3) && n3 !== 'bubble_warn' ? BUBBLE_DROP : 0;
    if (n3 === 'sign') signAt = { x: fx, y: fy };
    a = function () { art3.drawAt(ctx, n3, fx, fy + dy, wrap(n3, f3), flip === true); };
  }
  const mt = toRender(ctx);
  try { a(); } finally { ctx.setTransform(mt); }
  who = null; carrying = false;
  return true;
}

// The unbought counter extension (v2 rect e) as a ghost: the long counter clipped to the
// extension's side of the plain counter (v2 rect c, else where it drew last).
function extGhost(ctx, e, cRect) {
  const c = cRect || lastCounter;
  if (!ready || !c || !art3.has('counter_long') || !art3.has('counter')) return false;
  const x0 = Math.min(e.x, c.x), x1 = Math.max(e.x + e.w, c.x + c.w), yb = Math.max(e.y + e.h, c.y + c.h);
  const ca = art3.anchor('counter');
  const cl = Math.round(c.x * S + c.w) - ca.ax, cr = cl + ca.w;
  const left = e.x < c.x;
  inRender(ctx, function () {
    ctx.save();
    ctx.beginPath();
    if (left) ctx.rect(0, 0, cl + 2, ctx.canvas.height); else ctx.rect(cr - 2, 0, ctx.canvas.width, ctx.canvas.height);
    ctx.clip();
    art3.drawAt(ctx, 'counter_long', Math.round(x0 + x1), Math.round(yb * S), 0, isoView);
    ctx.restore();
  });
  return true;
}

// The box (sim px) the art3 sprite for v2 sprite `name` at (x, y), v2 size w by h, covers on
// screen, for tap rects. Null when art3 has no sprite for the name (the caller keeps the v2 box).
function bounds(name, x, y, w, h, frame) {
  if (!ready) return null;
  let n3 = name;
  const al = ALIAS[name];
  if (Array.isArray(al)) n3 = al[0]; else if (al) n3 = al;
  if (!art3.has(n3)) return null;
  const a = art3.anchor(n3, frame | 0);
  const fx = Math.round(x * S + w), fy = Math.round((y + h) * S);
  const x0 = Math.floor((fx - a.ax) / S), y0 = Math.floor((fy - a.ay) / S);
  return { x: x0, y: y0, w: Math.ceil((fx - a.ax + a.w) / S) - x0, h: Math.ceil((fy - a.ay + a.h) / S) - y0 };
}

// Runs f with ctx in render px (the identity transform), then puts the 2x transform back.
function inRender(ctx, f) {
  const m = toRender(ctx);
  try { f(); } finally { ctx.setTransform(m); }
}
// v3.5: render px with the caller's translation kept (the iso yard translates each object to its
// projected tile), rounded to whole px. Returns the matrix to put back.
function toRender(ctx) {
  const m = ctx.getTransform();
  ctx.setTransform(1, 0, 0, 1, Math.round(m.e), Math.round(m.f));
  return m;
}
// The art3 font at (x, y) sim px, top left of the caps, upper cased with a v2 colour key.
// opts as art3.text (scale, bold, shadow, outline). Returns false before boot.
function text(ctx, str, x, y, colorKey, opts) {
  if (!ready) return false;
  inRender(ctx, function () { art3.textTinted(ctx, str, Math.round(x * S), Math.round(y * S), colorKey || 'C', opts); });
  return true;
}
// Its width in sim px (may be a half px).
function textWidth(str, opts) {
  if (!ready) return 0;
  return art3.textWidth(String(str).toUpperCase(), opts) / S;
}
// A floating number (art3.floatNum) with its top left at (x, y) sim px. kind: cash, tip, fan.
// clampW keeps it inside the yard's width in sim px.
function floatNum(ctx, str, x, y, kind, clampW) {
  if (!ready) return false;
  inRender(ctx, function () {
    const cl = Array.isArray(clampW) ? [clampW[0] * S, clampW[1] * S] : (clampW ? [0, clampW * S] : null);
    art3.floatNum(ctx, String(str).toUpperCase(), Math.round(x * S), Math.round(y * S), kind, cl ? { clamp: cl } : null);
  });
  return true;
}
// A floating number's box in sim px: text width, height with its outline, and the icon's width
// left of the text (cash has the coin, fan the heart).
function floatBox(str, kind) {
  if (!ready || typeof art3.textWidth !== 'function') return null;
  const w = art3.textWidth(String(str).toUpperCase(), { bold: true, scale: 2 }) / S;
  return { w: w + 1, h: 8, iw: kind === 'cash' || kind === 'fan' ? 8 : 0 };
}
// The pit name on the art3 sign's panel, where the sign drew last. False when no art3 sign drew.
function signText(ctx, str) {
  if (!ready || !signAt || typeof art3.signText !== 'function') return false;
  const a = art3.anchor('sign');
  const at = signAt;
  inRender(ctx, function () { art3.signText(ctx, String(str), at.x - a.ax, at.y - a.ay); });
  return true;
}

// The cached ground for the sim MAP: pavers, lawn, the customer path, clover on unbought decor.
function ground(ctx, map, path, clover) {
  if (!ready) return false;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  try { art3.ground(ctx, map, { path: path, clover: clover }); } finally { ctx.setTransform(S, 0, 0, S, 0, 0); }
  return true;
}

// A bust canvas for a v2 look (crew card, creator preview).
function portrait(l, kind, role) {
  if (!boot()) return null;
  const id = kind === 'player' ? 'bust_player' : 'bust_' + (role || 'crew');
  setLook(id, toParts(l, kind === 'player' ? 'player' : 'crew', role));
  return art3.portrait(id);
}
// A full figure canvas (the creator preview).
function figure(l) {
  if (!boot()) return null;
  setLook('fig_player', toParts(l, 'player'));
  return art3.person('fig_player', 'down', 0, false);
}

/* ================================================================ v3.5: the iso yard */
// The whole yard turned 45 degrees on a 2:1 diamond grid. geo = { W, H, OX, OY } in render px: the
// canvas size and the screen px of sim point (0, 0), the back corner. Sim point (sx, sy) sits at
// X = OX + sx - sy, Y = OY + (sx + sy) / 2, so a 16 px sim tile is a 32 by 16 diamond.
const RP = art3.PAL ? art3.PAL.RAMP : null;
const PAL_OL = art3.PAL ? art3.PAL.OL : '#1e1510';
function isoPt(geo, sx, sy) { return [geo.OX + sx - sy, geo.OY + (sx + sy) / 2]; }
function onIdentity(ctx, f) {
  const m = ctx.getTransform();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  try { f(); } finally { ctx.setTransform(m); }
}

// The backdrop (sky, hills, tree line), the ground diamond resampled from the square ground, and
// the barn along the back right edge, cached per geometry and ground. Drawn at render (0, 0).
const stageCache = Object.create(null);
function stage(ctx, geo, map, path, clover) {
  if (!ready || !art3.yard || !RP) return false;
  const T_ = map.T;
  // Fence tiles take the ground of the tile inside them (no foliage on the square ground).
  const flat = {
    W: map.W, H: map.H, T: T_, stripe: map.stripe, gate: map.gate,
    at: function (x, y) {
      const t = map.at(x, y);
      if (t !== T_.FENCE) return t;
      const ix = Math.min(map.W - 2, Math.max(1, x)), iy = Math.min(map.H - 2, Math.max(1, y));
      const u = map.at(ix, iy);
      return u === T_.FENCE || u === T_.HEDGE || u === T_.BED ? (iy >= 6 ? T_.LAWN : T_.PAVER) : u;
    }
  };
  const key = [geo.W, geo.H, geo.OX, geo.OY].join(',') + ':' + JSON.stringify(path) + ':' + JSON.stringify(clover);
  let c = stageCache[key];
  if (!c) {
    const sq = art3.ground(null, flat, { path: path, clover: clover });
    const sw = sq.width, sh = sq.height;
    const src = sq.getContext('2d').getImageData(0, 0, sw, sh).data;
    c = document.createElement('canvas');
    c.width = geo.W; c.height = geo.H;
    const g = c.getContext('2d');
    g.imageSmoothingEnabled = false;
    const yd = art3.yard, dx = geo.OX - yd.BACK_CORNER.x, dy = geo.OY - yd.BACK_CORNER.y;
    g.fillStyle = RP.sky.shade; g.fillRect(0, 0, geo.W, geo.H);
    yd.draw(g, 'backdrop', dx - 96, dy - 64 + 48, 0);
    yd.draw(g, 'backdrop', dx, dy - 64, 0);
    const lay = document.createElement('canvas');
    lay.width = geo.W; lay.height = geo.H;
    const lg = lay.getContext('2d');
    const img = lg.createImageData(geo.W, geo.H), out = img.data;
    const MW = map.W * 16, MH = map.H * 16;
    for (let Y = 0; Y < geo.H; Y++) {
      for (let X = 0; X < geo.W; X++) {
        const a = X + 0.5 - geo.OX, b = 2 * (Y + 0.5 - geo.OY);
        const sx = (a + b) / 2, sy = (b - a) / 2;
        if (sx < 0 || sy < 0) continue;                         // behind the back edges: backdrop
        let ox, oy;
        if (sx >= MW || sy >= MH) {
          // past the front edges the lawn runs on: lawn tiles of row 7, stripes kept
          const lx = 2 + (Math.floor(sx / 16) & 1);
          ox = lx * 32 + (Math.floor(sx * 2) & 31); oy = 7 * 32 + (Math.floor(sy * 2) & 31);
        } else {
          ox = Math.min(sw - 1, Math.floor(sx * 2)); oy = Math.min(sh - 1, Math.floor(sy * 2));
        }
        const i = (oy * sw + ox) * 4, o = (Y * geo.W + X) * 4;
        out[o] = src[i]; out[o + 1] = src[i + 1]; out[o + 2] = src[i + 2]; out[o + 3] = 255;
      }
    }
    lg.putImageData(img, 0, 0);
    g.drawImage(lay, 0, 0);
    const bp = yd.placeTile('wall_barn', 4, 0);
    yd.draw(g, 'wall_barn', bp.x + dx, bp.y + dy, 0);
    stageCache[key] = c;
  }
  onIdentity(ctx, function () { ctx.drawImage(c, 0, 0); });
  return true;
}

// One fence run on the ground from sim point (ax, ay) to (bx, by), pickets h px tall, every 5 px.
function fenceRun(ctx, geo, ax, ay, bx, by, h) {
  const FN = RP.fence;
  const A = isoPt(geo, ax, ay), B = isoPt(geo, bx, by);
  const left = A[0] <= B[0] ? A : B, right = A[0] <= B[0] ? B : A;
  const x0 = Math.round(left[0]), x1 = Math.round(right[0]);
  const slope = right[0] === left[0] ? 0 : (right[1] - left[1]) / (right[0] - left[0]);
  const gy = function (x) { return Math.round(left[1] + (x - left[0]) * slope); };
  onIdentity(ctx, function () {
    ctx.fillStyle = 'rgba(30, 21, 16, 0.18)';
    for (let x = x0; x < x1; x++) ctx.fillRect(x, gy(x), 1, 2);
    const rails = h > 14 ? [5, h - 8] : [3, h - 6];
    for (let r = 0; r < rails.length; r++) {
      for (let x = x0; x < x1; x++) {
        ctx.fillStyle = FN.dark; ctx.fillRect(x, gy(x) - rails[r] - 2, 1, 3);
        ctx.fillStyle = FN.shade; ctx.fillRect(x, gy(x) - rails[r] - 2, 1, 1);
      }
    }
    for (let x = x0 + 1; x + 3 <= x1; x += 5) {
      const y = gy(x + 1);
      ctx.fillStyle = PAL_OL; ctx.fillRect(x - 1, y - h, 5, h);
      ctx.fillStyle = FN.base; ctx.fillRect(x, y - h + 1, 3, h - 1);
      ctx.fillStyle = FN.hi; ctx.fillRect(x, y - h + 1, 1, h - 1);
      ctx.fillStyle = FN.dark; ctx.fillRect(x + 2, y - h + 1, 1, h - 1);
      ctx.clearRect(x - 1, y - h, 1, 1); ctx.clearRect(x + 3, y - h, 1, 1);
    }
  });
}

// A low rail on the ground from sim point (ax, ay) to (bx, by): a 2 px rail 3 px up on 4 px posts
// every 16 px. The front edges carry this instead of pickets, so nothing in the front row hides.
function lowRun(ctx, geo, ax, ay, bx, by) {
  const FN = RP.fence;
  const A = isoPt(geo, ax, ay), B = isoPt(geo, bx, by);
  const left = A[0] <= B[0] ? A : B, right = A[0] <= B[0] ? B : A;
  const x0 = Math.round(left[0]), x1 = Math.round(right[0]);
  const slope = right[0] === left[0] ? 0 : (right[1] - left[1]) / (right[0] - left[0]);
  const gy = function (x) { return Math.round(left[1] + (x - left[0]) * slope); };
  onIdentity(ctx, function () {
    for (let x = x0; x < x1; x++) {
      ctx.fillStyle = 'rgba(30, 21, 16, 0.18)'; ctx.fillRect(x, gy(x), 1, 1);
      ctx.fillStyle = PAL_OL; ctx.fillRect(x, gy(x) - 4, 1, 3);
      ctx.fillStyle = FN.base; ctx.fillRect(x, gy(x) - 3, 1, 1);
    }
    for (let x = x0 + 2; x + 2 <= x1; x += 16) {
      const y = gy(x + 1);
      ctx.fillStyle = PAL_OL; ctx.fillRect(x - 1, y - 5, 4, 5);
      ctx.fillStyle = FN.base; ctx.fillRect(x, y - 4, 2, 4);
      ctx.fillStyle = FN.hi; ctx.fillRect(x, y - 4, 1, 4);
    }
  });
}
// A fence tile's runs: the back left fence down x = 8 in pickets; the two front edges (the right
// side x = W*16 - 8 and the front y = H*16 - 8) as low rails. Row 0 is the barn wall, no pickets.
function fenceTile(ctx, geo, map, x, y) {
  if (!ready || !RP) return false;
  const MW = map.W * 16, MH = map.H * 16, x0 = x * 16, y0 = y * 16;
  if (x === 0) fenceRun(ctx, geo, 8, y0, 8, Math.min(y0 + 16, MH - 8), 26);
  if (x === map.W - 1) lowRun(ctx, geo, MW - 8, y0, MW - 8, Math.min(y0 + 16, MH - 8));
  if (y === map.H - 1) lowRun(ctx, geo, Math.max(x0, 8), MH - 8, Math.min(x0 + 16, MW - 8), MH - 8);
  return true;
}
// v3.5 the angled picnic table (mock B's, sized to the game's 2 tile tables): the top runs down to
// the right along sim x, a bench on each long side, A-frame legs. Sim px x0..x1 along the table,
// table row `row` (the seats sit on the far bench in the row before it). part 'far' is the ground
// shadow and the far bench (drawn before the sitters), 'table' the legs, top and near bench.
const PICNIC_Z = Object.freeze({ bench: 10, top: 20, farV: -6, plateV: 5 });
const picCache = Object.create(null);
function fillPoly(g, pts, color) {
  let y0 = Infinity, y1 = -Infinity;
  pts.forEach(function (q) { y0 = Math.min(y0, q[1]); y1 = Math.max(y1, q[1]); });
  g.fillStyle = color;
  for (let y = Math.floor(y0); y < Math.ceil(y1); y++) {
    const yc = y + 0.5;
    let a = Infinity, b = -Infinity;
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i], q = pts[(i + 1) % pts.length];
      if ((p[1] <= yc && q[1] > yc) || (q[1] <= yc && p[1] > yc)) {
        const x = p[0] + (yc - p[1]) / (q[1] - p[1]) * (q[0] - p[0]);
        a = Math.min(a, x); b = Math.max(b, x);
      }
    }
    const xa = Math.round(a), xb = Math.round(b);
    if (xb > xa) g.fillRect(xa, y, xb - xa, 1);
  }
}
function picnicCanvas(geo, x0, x1, row, part) {
  const key = [geo.W, geo.H, geo.OX, geo.OY, x0, x1, row, part].join(',');
  if (picCache[key]) return picCache[key];
  const c = document.createElement('canvas');
  c.width = geo.W; c.height = geo.H;
  const g = c.getContext('2d');
  const P = function (u, v, z) { return [geo.OX + u - v, geo.OY + (u + v) / 2 - (z || 0)]; };
  const L = RP.woodL, M = RP.woodM, D = RP.woodD, R = row * 16;
  const u0 = x0 + 1, u1 = x1 - 1;
  // One iso box u0..u1 by v0..v1 from z0 up h: outline, lit left face, shaded end, top.
  function box(a0, b0, a1, b1, z0, h, ramp, outline) {
    const z1 = z0 + h;
    const left = [P(a0, b1, z0), P(a1, b1, z0), P(a1, b1, z1), P(a0, b1, z1)];
    const right = [P(a1, b0, z0), P(a1, b1, z0), P(a1, b1, z1), P(a1, b0, z1)];
    const top = [P(a0, b0, z1), P(a1, b0, z1), P(a1, b1, z1), P(a0, b1, z1)];
    if (outline !== false) [[-1, 0], [1, 0], [0, -1], [0, 1]].forEach(function (o) {
      [left, right, top].forEach(function (f) { fillPoly(g, f.map(function (q) { return [q[0] + o[0], q[1] + o[1]]; }), PAL_OL); });
    });
    fillPoly(g, left, ramp.shade); fillPoly(g, right, ramp.dark); fillPoly(g, top, ramp.base);
    // the lit near rim of the top
    const r0 = P(a0, b1, z1), r1 = P(a1, b1, z1);
    fillPoly(g, [r0, r1, [r1[0], r1[1] + 1], [r0[0], r0[1] + 1]], ramp.hi);
  }
  function bench(b0, b1) {
    [u0 + 3, u1 - 5].forEach(function (u) { box(u, b0 + 1, u + 2, b1 - 1, 0, PICNIC_Z.bench - 2, D); });
    box(u0, b0, u1, b1, PICNIC_Z.bench - 2, 2, L);
  }
  if (part === 'far') {
    fillPoly(g, [P(x0, R - 9, 0), P(x1, R - 9, 0), P(x1, R + 20, 0), P(x0, R + 20, 0)].map(function (q) { return [q[0] + 2, q[1] + 1]; }), 'rgba(30, 21, 16, 0.22)');
    bench(R - 8, R - 4);
  } else {
    // A-frame legs at each end, splayed out to the bench feet, under the top
    [u0 + 3, u1 - 5].forEach(function (u) {
      box(u, R + 1, u + 2, R + 3, 0, PICNIC_Z.top - 3, D);
      box(u, R + 11, u + 2, R + 13, 0, PICNIC_Z.top - 3, D);
    });
    box(u0, R + 1, u1, R + 13, PICNIC_Z.top - 3, 3, L);
    // plank seams along the top
    [R + 5, R + 9].forEach(function (v) {
      for (let u = u0 + 1; u < u1 - 1; u++) { const q = P(u, v, PICNIC_Z.top); g.fillStyle = M.base; g.fillRect(Math.round(q[0]), Math.round(q[1]), 1, 1); }
    });
    bench(R + 15, R + 19);
  }
  picCache[key] = c;
  return c;
}
function picnic(ctx, geo, x0, x1, row, part) {
  if (!ready || !RP) return false;
  const c = picnicCanvas(geo, x0, x1, row, part);
  onIdentity(ctx, function () { ctx.drawImage(c, 0, 0); });
  return true;
}
// The gate on the front rail: two short posts, and the low panel shut across the gap or swung inward.
function gateTile(ctx, geo, map, x, y, open) {
  if (!ready || !RP) return false;
  const MH = map.H * 16, x0 = x * 16;
  if (!open) lowRun(ctx, geo, x0 + 2, MH - 8, x0 + 14, MH - 8);
  else lowRun(ctx, geo, x0 + 2, MH - 21, x0 + 2, MH - 9);
  const W = RP.woodM;
  onIdentity(ctx, function () {
    [isoPt(geo, x0 + 1, MH - 8), isoPt(geo, x0 + 15, MH - 8)].forEach(function (p) {
      const px = Math.round(p[0]) - 2, py = Math.round(p[1]);
      ctx.fillStyle = PAL_OL; ctx.fillRect(px - 1, py - 8, 6, 9);
      ctx.fillStyle = W.base; ctx.fillRect(px, py - 7, 4, 7);
      ctx.fillStyle = W.hi; ctx.fillRect(px, py - 7, 1, 7);
      ctx.fillStyle = W.shade; ctx.fillRect(px + 3, py - 7, 1, 7);
    });
  });
  return true;
}

// Iso blocks on one tile (hedge, raised bed), cached: 32 wide, the diamond top at y 0.
const blockCache = Object.create(null);
function diamondRows(g, x, y, colL, colR) {
  for (let r = 0; r < 16; r++) {
    const hw = 16 - Math.abs(2 * r - 15);
    g.fillStyle = colL; g.fillRect(x + 16 - hw, y + r, hw, 1);
    g.fillStyle = colR; g.fillRect(x + 16, y + r, hw, 1);
  }
}
function blockCanvas(kind, frame) {
  const k = kind + ':' + frame;
  if (blockCache[k]) return blockCache[k];
  const isHedge = kind === 'hedge';
  const h = isHedge ? 12 : 5;
  const c = document.createElement('canvas');
  c.width = 32; c.height = 16 + h + 1;
  const g = c.getContext('2d');
  const HG = RP.hedge, W = RP.woodM, SO = RP.soil;
  diamondRows(g, 0, h + 1, PAL_OL, PAL_OL);
  for (let i = h; i >= 1; i--) diamondRows(g, 0, i, isHedge ? HG.base : W.base, isHedge ? HG.shade : W.shade);
  diamondRows(g, 0, 0, isHedge ? HG.hi : W.hi, isHedge ? HG.hi : W.hi);
  let seed = (frame + 1) * 7919 + (isHedge ? 104729 : 1299709);
  const rnd = function () { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
  if (isHedge) {
    for (let n = 0; n < 30; n++) {
      const r = 1 + Math.floor(rnd() * 14), hw = 16 - Math.abs(2 * r - 15) - 1;
      if (hw < 2) continue;
      const x = 16 - hw + Math.floor(rnd() * hw * 2);
      g.fillStyle = rnd() < 0.5 ? RP.leaf.hi : HG.base; g.fillRect(x, r, 1, 1);
    }
    for (let n = 0; n < 18; n++) {
      const x = 1 + Math.floor(rnd() * 30), y = 10 + Math.floor(rnd() * h);
      g.fillStyle = rnd() < 0.5 ? HG.dark : HG.hi; g.fillRect(x, y, 1, 1);
    }
  } else {
    for (let r = 2; r < 14; r++) {
      const hw = 16 - Math.abs(2 * r - 15) - 4;
      if (hw > 0) { g.fillStyle = r < 4 ? SO.dark : SO.base; g.fillRect(16 - hw, r, hw * 2, 1); }
    }
    if (frame === 3) {
      g.fillStyle = SO.dark;
      for (let r = 5; r < 12; r += 3) { const hw = 16 - Math.abs(2 * r - 15) - 7; if (hw > 0) g.fillRect(16 - hw, r, hw * 2, 1); }
    } else {
      for (let n = 0; n < 8; n++) {
        const r = 5 + Math.floor(rnd() * 7), hw = 16 - Math.abs(2 * r - 15) - 7;
        if (hw < 1) continue;
        const x = 16 - hw + Math.floor(rnd() * hw * 2);
        g.fillStyle = RP.stem.base; g.fillRect(x, r - 2, 1, 3);
        g.fillStyle = RP.flowers[(n + frame) % RP.flowers.length]; g.fillRect(x - 1, r - 3, 2, 2);
      }
    }
  }
  blockCache[k] = c;
  return c;
}
// Draws a block centred on sim tile (tx, ty).
function block(ctx, geo, kind, tx, ty, frame) {
  if (!ready || !RP) return false;
  const p = isoPt(geo, tx * 16 + 8, ty * 16 + 8);
  const c = blockCanvas(kind, frame | 0);
  onIdentity(ctx, function () { ctx.drawImage(c, Math.round(p[0]) - 16, Math.round(p[1]) - 8 - (c.height - 17)); });
  return true;
}
// A dashed outline round the footprint tx0..tx1 by ty0..ty1 on the ground.
// mode: undefined dashed, true solid, 'corners' the four corners only (the tap ring's fade).
function footprint(ctx, geo, tx0, ty0, tx1, ty1, color, mode) {
  const P = [isoPt(geo, tx0 * 16, ty0 * 16), isoPt(geo, (tx1 + 1) * 16, ty0 * 16), isoPt(geo, (tx1 + 1) * 16, (ty1 + 1) * 16), isoPt(geo, tx0 * 16, (ty1 + 1) * 16)];
  onIdentity(ctx, function () {
    ctx.fillStyle = color;
    if (mode === 'corners') {
      P.forEach(function (q, e) { ctx.fillRect(Math.round(q[0]) - (e === 1 ? 2 : 0), Math.round(q[1]) - (e === 2 ? 1 : 0), 2, 1); });
      return;
    }
    let i = 0;
    for (let e = 0; e < 4; e++) {
      const a = P[e], b = P[(e + 1) % 4];
      const n = Math.round(Math.abs(b[0] - a[0])), sx = Math.sign(b[0] - a[0]);
      for (let k = 0; k < n; k++, i++) {
        if (mode !== true && (i & 7) >= 4) continue;
        ctx.fillRect(Math.round(a[0] + sx * k), Math.round(a[1] + (b[1] - a[1]) * k / n), 1, 1);
      }
    }
  });
}
// The string lights between two hooks (render px).
function lights(ctx, x0, y0, x1, y1, frame) {
  if (!ready || !art3.yard || typeof art3.yard.lightsString !== 'function') return false;
  onIdentity(ctx, function () { art3.yard.lightsString(ctx, Math.round(x0), Math.round(y0), Math.round(x1), Math.round(y1), 14, frame | 0); });
  return true;
}
// The plate spots on the serving table's top, in sim px from its anchor (the v2 rect's bottom
// centre), first to last along the table as drawn. Null without art3 slots.
function counterSlots(name) {
  if (!ready || !art3.kit || typeof art3.kit.slots !== 'function' || !art3.has(name)) return null;
  const sl = art3.kit.slots(name), a = art3.anchor(name, 0);
  if (!sl.length) return null;
  return sl.map(function (q) {
    const dx = isoView ? a.ax - 1 - q[0] : q[0] - a.ax;
    return { x: dx / S, y: (q[1] - a.ay) / S };
  }).sort(function (u, v) { return u.x - v.x; });
}
function setIso(v) { isoView = !!v; }
// The art3 anchor and size of the sprite drawn for v2 name `name` (render px), or null.
function anchorOf(name, frame) {
  if (!ready) return null;
  let n3 = name;
  const al = ALIAS[name];
  if (Array.isArray(al)) n3 = al[0]; else if (al) n3 = al;
  if (!art3.has(n3)) return null;
  return art3.anchor(n3, frame | 0);
}

PitSim.bridge3 = {
  S: S, VW: art3.VW, VH: art3.VH,
  boot: boot, get ready() { return ready; },
  toParts: toParts, setPlayer: setPlayer, setCrew: setCrew, person: person,
  draw: draw, ground: ground, portrait: portrait, figure: figure,
  text: text, textWidth: textWidth, floatNum: floatNum, floatBox: floatBox, signText: signText, extGhost: extGhost, bounds: bounds,
  stage: stage, fenceTile: fenceTile, picnic: picnic, PICNIC_Z: PICNIC_Z, gateTile: gateTile, block: block, footprint: footprint, lights: lights, anchorOf: anchorOf, isoPt: isoPt, counterSlots: counterSlots, setIso: setIso,
  misses: function () { return Object.assign({}, misses); }
};
})();
