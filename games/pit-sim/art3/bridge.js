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
  picnic: ['picnic_small', 0], picnic_bench: ['bench_small', 0] };
let ext = null;        // the counter extension's v2 rect, drawn with the counter as counter_long

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
  } else if (name === 'counter' && frame === 1 && ext && art3.has('counter_long')) {
    const e = ext, x0 = Math.min(e.x, x), x1 = Math.max(e.x + e.w, x + w), yb = Math.max(e.y + e.h, y + h);
    ext = null;
    a = function () { art3.drawAt(ctx, 'counter_long', Math.round(x0 + x1), Math.round(yb * S), 0, false); };
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
    a = function () { art3.drawAt(ctx, n3, fx, fy + dy, wrap(n3, f3), flip === true); };
  }
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  try { a(); } finally { ctx.setTransform(S, 0, 0, S, 0, 0); }
  who = null; carrying = false;
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

PitSim.bridge3 = {
  S: S, VW: art3.VW, VH: art3.VH,
  boot: boot, get ready() { return ready; },
  toParts: toParts, setPlayer: setPlayer, setCrew: setCrew, person: person,
  draw: draw, ground: ground, portrait: portrait, figure: figure,
  misses: function () { return Object.assign({}, misses); }
};
})();
