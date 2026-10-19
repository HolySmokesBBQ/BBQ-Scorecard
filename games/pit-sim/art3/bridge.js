// games/pit-sim/art3/bridge.js
// Your Pit v3.4: the adapter between game.js and the art3 library. game.js still lays the yard out
// in sim px with v2 sprite names (its capture records and the harness read those); every draw goes
// through bridge.draw(ctx, name, x, y, w, h, frame, flip), which finds the art3 sprite for that v2
// name and draws it in render px (2 x sim px) so its anchor sits on the v2 sprite's bottom centre.
// People go through art3.drawPerson with a look id: 'player' (the creator look), 'crew_run',
// 'crew_fire', 'crew_prep' (each card's look) and 'g<id>' for guests (art3.randomLook seeded by the
// customer id). Names art3 has no art for return false, and game.js draws the v2 sprite at 2x.
// v3.6 (the angle redo): boot turns the size rule art on (art3.sizes('rule')); game.js draws the
// world in rp and places stations, props and decor by their anchors itself; this file keeps people,
// hand items and effects (draw), text, and the world helpers: stage (sky, ground, barn, back fence,
// sign), plus (the for-sale mark) and preview (the creator patch).
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
let signAt = null;     // where the wall sign drew (its anchor, world rp)

let ready = false;
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
    // v3.6: the size rule art (art3/rule.js) answers every name it redraws.
    if (art3.rule && typeof art3.sizes === 'function') art3.sizes('rule');
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
  const f = ((frame | 0) % n + n) % n;
  // v3.4 playtest: guests carry the dark ring so they read on the ground.
  if (typeof look === 'string' && look.charAt(0) === 'g' && art3.outlined && art3.person) {
    const cv = art3.person(look, p3, f, flip === true);
    if (cv && cv.width > 0) { ctx.drawImage(art3.outlined(cv), Math.round(fx) - PERSON_AX - 1, Math.round(fy) - cv.height - 1); return; }
  }
  art3.drawPerson(ctx, look, p3, f, fx, fy, flip);
}
const PERSON_AX = 16;   // art3/people.js AX: a person frame's foot centre from its left edge

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
    const ring = /^(plate|platter)_/.test(n3) && art3.drawAtOutlined;   // v3.4: plates carry the dark ring
    a = function () { (ring ? art3.drawAtOutlined : art3.drawAt)(ctx, n3, fx, fy + dy, wrap(n3, f3), flip === true); };
  }
  const mt = toRender(ctx);
  try { a(); } finally { ctx.setTransform(mt); }
  who = null; carrying = false;
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
  // v3.4 playtest: a caller's extra scale over the 2x (game.js draws food and warn bubbles bigger) is kept.
  const k = m.a > S + 1e-6 && Math.abs(m.a - m.d) < 1e-6 ? m.a / S : 1;
  ctx.setTransform(k, 0, 0, k, Math.round(m.e), Math.round(m.f));
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

/* ================================================================ v3.6: the world at the size rule */
// The angle redo (spec 2026-10-19, C): the world is 656 by 434 rp (the barn end wall and both fence corners inside), tile (tx, ty) a 48 by 24 diamond
// whose top vertex sits at (OX + 24 (tx - ty), OY + 12 (tx + ty)). Rule sprites (art3/rule.js) anchor
// on the ground centre of their footprint; wall pieces on the barn wall's foot, u rp along row 0.
const W3 = Object.freeze({ W: 656, H: 434, OX: 300, OY: 150 });
const SKY = '#9fd8f2';
const VERGE = ['#5a9c3c', '#56983a', '#5c9f3e'];
function vtx(tx, ty) { return [W3.OX + (tx - ty) * 24, W3.OY + (tx + ty) * 12]; }
function ctr(tx, ty) { return [W3.OX + (tx - ty) * 24, W3.OY + (tx + ty + 1) * 12]; }
function wallAt(u) { return [W3.OX + u, W3.OY + u / 2]; }
function onIdentity(ctx, f) {
  const m = ctx.getTransform();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  try { f(); } finally { ctx.setTransform(m); }
}
function put(g, name, frame, x, y, flip) { art3.drawAt(g, name, Math.round(x), Math.round(y), frame | 0, flip === true); }
function fillDiamond(g, cx, cy, hw, h, col) {
  g.fillStyle = col;
  for (let r = 0; r < h; r++) {
    const w = r < h / 2 ? (r + 1) * 2 * hw / h : (h - r) * 2 * hw / h;
    g.fillRect(Math.round(cx - w), cy + r, Math.round(w * 2), 1);
  }
}

// The pit name on the wall sign's board (meta('sign').text): bold caps on one line when they fit,
// else two lines split at the space that best balances them, else plain caps, else cut. The same
// order the hub sign (fitSign) uses, so the yard sign reads like every other sign of the pit.
function signLines(str) {
  const s = String(str || '').toUpperCase().trim();
  const box = art3.rule && art3.rule.meta ? art3.rule.meta('sign').text : { w: 54, h: 16 };
  const wOf = function (t, bold) { return art3.textWidth(t, { bold: bold }); };
  for (let pass = 0; pass < 2; pass++) {
    const bold = pass === 0;
    if (wOf(s, bold) <= box.w) return { lines: [s], bold: bold };
    let best = null;
    for (let i = 1; i < s.length - 1; i++) {
      if (s[i] !== ' ') continue;
      const a = s.slice(0, i).trim(), b = s.slice(i + 1).trim();
      const w = Math.max(wOf(a, bold), wOf(b, bold));
      if (w <= box.w && (!best || w < best.w)) best = { w: w, lines: [a, b] };
    }
    if (best) return { lines: best.lines, bold: bold };
  }
  let t = s;
  while (t.length > 1 && wOf(t, false) > box.w) t = t.slice(0, -1);
  return { lines: [t], bold: false, cut: true };
}
function signText(g, x, y, name) {
  const a = art3.anchor('sign'), tb = art3.rule.meta('sign').text;
  const L = signLines(name), cx = x - a.ax + tb.x + tb.w / 2, top = y - a.ay + tb.y;
  const o = { bold: L.bold, align: 'center', shadow: '#5a3412' };
  if (L.lines.length === 1) art3.textTinted(g, L.lines[0], cx, top + 4, '#fff3d6', o);
  else { art3.textTinted(g, L.lines[0], cx, top, '#fff3d6', o); art3.textTinted(g, L.lines[1], cx, top + 8, '#fff3d6', o); }
  return L;
}

// The world behind every object, cached: sky, hills, the lawn verge past the front edges, the ground
// tiles (pavers, lawn, stones on opts.walk and the gate), the back fence on column 0's outer edge,
// and the barn along row 0 with its windows, window boxes, door (opts.door: its tile x) and the
// sign (opts.sign: [x0, x1] tiles, opts.name the pit name). Drawn at world (0, 0).
const stageCache = Object.create(null);
let stageN = 0;
function stage(ctx, map, opts) {
  if (!ready || !art3.rule) return false;
  const o = opts || {};
  const key = JSON.stringify([map.W, map.H, o.walk || [], o.door, o.sign, o.name || '', o.windows || []]);
  let c = stageCache[key];
  if (!c) {
    if (stageN > 24) { Object.keys(stageCache).forEach(function (k) { delete stageCache[k]; }); stageN = 0; }
    c = document.createElement('canvas');
    c.width = W3.W; c.height = W3.H;
    const g = c.getContext('2d');
    g.imageSmoothingEnabled = false;
    const MW = map.W, MH = map.H;
    g.fillStyle = SKY; g.fillRect(0, 0, W3.W, W3.H);
    [[40, 18], [150, 6], [236, 26], [470, 14]].forEach(function (q) { g.fillStyle = '#ffffff'; g.fillRect(q[0], q[1], 26, 5); g.fillRect(q[0] + 5, q[1] - 4, 14, 4); });
    for (let x = 0; x < W3.OX + 30; x += 2) {
      const h = 16 + Math.round(6 * Math.sin(x / 9) + 4 * Math.sin(x / 4.3));
      const by = W3.OY + (W3.OX - x) / 2 - 30;
      g.fillStyle = (x / 2) % 7 < 3 ? '#3f8a3a' : '#357a33';
      g.fillRect(x, by - h, 2, h + 34);
    }
    // the verge outside the two front edges, to the world's edge
    const L0 = vtx(0, MH), B0 = vtx(MW, MH), R0 = vtx(MW, 0);
    g.fillStyle = VERGE[0];
    g.beginPath();
    g.moveTo(-10, L0[1]); g.lineTo(L0[0], L0[1]); g.lineTo(B0[0], B0[1]); g.lineTo(R0[0], R0[1]); g.lineTo(W3.W + 10, R0[1]);
    g.lineTo(W3.W + 10, W3.H + 60); g.lineTo(-10, W3.H + 60); g.closePath(); g.fill();
    for (let ty = 0; ty < MH + 4; ty++) for (let tx = 0; tx < MW + 4; tx++) {
      if (tx < MW && ty < MH) continue;
      const t = vtx(tx, ty);
      if (t[1] > W3.H) continue;
      fillDiamond(g, t[0], t[1], 24, 24, VERGE[1 + ((tx + ty) & 1)]);
    }
    const walk = Object.create(null);
    (o.walk || []).forEach(function (t) { walk[t.x + ',' + t.y] = true; });
    const T_ = map.T;
    for (let ty = 0; ty < MH; ty++) for (let tx = 0; tx < MW; tx++) {
      const t = map.at(tx, ty), c0 = ctr(tx, ty);
      if (t === T_.PAVER) put(g, 'paver', (tx * 3 + ty) % 4, c0[0], c0[1]);
      else {
        put(g, (tx + ty) & 1 ? 'lawn_a' : 'lawn_b', (tx + 2 * ty) % 3, c0[0], c0[1]);
        if (walk[tx + ',' + ty] || t === T_.GATE) put(g, 'stone_step', (tx + ty) & 1, c0[0], c0[1]);
      }
    }
    // v3.4 playtest: a calmer, slightly darker ground under everything, so stations and guests pop.
    const G0 = vtx(0, 0), G1 = vtx(MW, 0), G2 = vtx(MW, MH), G3 = vtx(0, MH);
    g.fillStyle = 'rgba(22, 30, 14, 0.26)';
    g.beginPath(); g.moveTo(G0[0], G0[1]); g.lineTo(G1[0], G1[1]); g.lineTo(G2[0], G2[1]); g.lineTo(G3[0], G3[1]); g.closePath(); g.fill();
    const T0 = vtx(0, 0);
    put(g, 'fence_diag', 0, T0[0], T0[1]);
    put(g, 'wall_barn', 0, T0[0], T0[1]);
    (o.windows || [48, 168]).forEach(function (u) { const w = wallAt(u); put(g, 'barn_window', 0, w[0], w[1]); put(g, 'window_box', 0, w[0], w[1]); });
    if (typeof o.door === 'number') { const d = wallAt(24 * o.door + 12); put(g, 'shed', 0, d[0], d[1]); }
    if (o.sign) {
      const sg = wallAt(12 * (o.sign[0] + o.sign[1] + 1));
      put(g, 'sign', 0, sg[0], sg[1]);
      c.sign = signText(g, sg[0], sg[1], o.name || '');
      c.signAt = { x: sg[0], y: sg[1] };
    }
    stageCache[key] = c; stageN++;
  }
  if (c.signAt) signAt = c.signAt;
  onIdentity(ctx, function () { ctx.drawImage(c, 0, 0); });
  return c;
}

// The "+" for-sale mark (spec D) with its anchor on world rp (x, y).
function plus(ctx, x, y) {
  if (!ready || !art3.has('plus')) return false;
  onIdentity(ctx, function () { put(ctx, 'plus', 0, x, y); });
  return true;
}

// The creator preview (spec E): the in-yard pitmaster ('player', facing down) on a three by three
// paver patch with a kettle at rule size beside him, drawn 1:1 into a w by h rp canvas.
const PREVIEW = Object.freeze({ w: 160, h: 92, top: 14 });
function preview(g, look) {
  if (!boot()) return false;
  if (look) setPlayer(look);
  const W = PREVIEW.w, H = PREVIEW.h, cx = W / 2, cy = PREVIEW.top;
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.imageSmoothingEnabled = false;
  g.fillStyle = SKY; g.fillRect(0, 0, W, H);
  g.fillStyle = '#6fb842'; g.fillRect(0, cy + 12, W, H);
  for (let j = 0; j < 3; j++) for (let i = 0; i < 3; i++) put(g, 'paver', (i + 2 * j) % 4, cx + 24 * (i - j), cy + 12 * (i + j) + 12);
  put(g, 'kettle', 2, cx + 48, cy + 36);
  const fy = cy + 40;
  if (art3.drawPersonShadow) art3.drawPersonShadow(g, cx, fy);
  art3.drawPerson(g, 'player', 'down', 0, cx, fy, true);
  previewLook = 'player';
  return true;
}
let previewLook = null;

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
  S: S, VW: art3.VW, VH: art3.VH, W3: W3,
  boot: boot, get ready() { return ready; },
  toParts: toParts, setPlayer: setPlayer, setCrew: setCrew, person: person,
  draw: draw, ground: ground, portrait: portrait, figure: figure,
  text: text, textWidth: textWidth, floatNum: floatNum, floatBox: floatBox, signText: function () { return !!signAt; }, signLines: signLines, bounds: bounds,
  stage: stage, plus: plus, preview: preview, PREVIEW: PREVIEW, get previewLook() { return previewLook; }, anchorOf: anchorOf,
  misses: function () { return Object.assign({}, misses); }
};
})();
