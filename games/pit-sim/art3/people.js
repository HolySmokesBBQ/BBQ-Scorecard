// games/pit-sim/art3/people.js
// Your Pit v3 art library: people. One parts compositor for the player, the crew and the
// guests (art bible section 4). Every frame is a 32 x 48 cell, anchor (16, 48) at the feet;
// seated frames are 32 x 38, anchor (16, 38) on the bench seat line; busts are 32 x 32.
// Depends on art3/palette.js only (PitSim.art3.PAL). Not loaded by the game until v3.4.
//
// API (on window.PitSim.art3):
//   person(look, pose, frame, flip)        cached canvas for one frame
//   drawPerson(ctx, look, pose, frame, x, y, flip)   draws with the anchor at (x, y)
//   drawPersonShadow(ctx, x, y)            the ground ellipse, drawn before the person
//   portrait(look)                         32 x 32 bust canvas (crew cards, the creator)
//   randomLook(seed, kind, role)           a deterministic look; kind 'guest' | 'crew' | 'player'
//   look(id, parts) / lookOf(id)           register a look under a name ('player', 'crew0' ...)
//   personHands(look, pose, frame)         hand centres relative to the anchor, for held plates
//   people                                 tables, normalizer, clip timing, build helpers, self test
//
// Poses and frames:
//   down, side       0 to 1 idle, 2 to 5 walk, 6 blink, 7 unhappy      (side faces left; flip for right)
//   up               0 to 1 idle, 2 to 5 walk
//   carryDown, carryUp, carrySide   0 to 1 idle, 2 to 5 walk, hands up and out to hold plates
//   sit              0 idle, 1 blink, 2 fork down, 3 fork up (eating), 4 content, 5 unhappy
//   sitUp            0 to 1 idle (seated, seen from behind)
(function () {
'use strict';
const root = typeof window !== 'undefined' ? window : globalThis;
const PitSim = root.PitSim = root.PitSim || {};
const art3 = PitSim.art3 = PitSim.art3 || {};
const PAL = art3.PAL;
if (!PAL) throw new Error('art3/people.js: load art3/palette.js first');

/* ------------------------------------------------------------------ geometry */
const CW = 32, CH = 48, SIT_H = 38, BUST = 32, AX = 16;
const HX = 4;            // cell column of head and body column 0 (both 24 wide: columns 4 to 27)
const SPLIT = 41;        // first cell row where the legs part
const SHOE_ROWS = 2;

// Body templates. shirt and pants are row counts; feet always end on cell row 46.
const BODY = Object.freeze({
  A:   Object.freeze({ shirt: 10, pants: 8, wide: 0, old: false }),
  B:   Object.freeze({ shirt: 10, pants: 8, wide: 1, old: false }),   // broad: 1 px wider each side
  old: Object.freeze({ shirt: 10, pants: 6, wide: 0, old: true })     // 2 px shorter, cardigan, eye bags
});

// Head: 24 wide, rows 0 to 21, neck row 22. Left inset per row (mirrored on the right).
const IN_FRONT = [7, 4, 3, 2, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 2, 4];
const SIDE_LOW = { 19: [1, 21], 20: [2, 18], 21: [4, 15] };   // three quarter jaw, chin toward the left
const NECK = { down: [7, 16], up: [7, 16], side: [8, 15] };
function headSpan(view, r) {
  if (r < 0 || r > 21) return null;
  if (view === 'side' && SIDE_LOW[r]) return SIDE_LOW[r];
  const i = IN_FRONT[r];
  return [i, 23 - i];
}

/* ------------------------------------------------------------------ hand grids (validated at load) */
// Eyes, 3 x 4. e eye, w catch-light, . skin.
const EYES = {
  open:  ['wee', 'eee', 'eee', 'eee'],
  blink: ['...', '...', 'eee', '...'],
  happy: ['...', '.e.', 'e.e', '...']
};
// Mouths, 4 x 2 at head columns 10 to 13 (front) or 4 to 7 (side), rows 17 to 18.
// m lip, t teeth, i inside.
const MOUTHS = {
  n:     ['.mm.', '....'],
  smile: ['mttm', '.mm.'],
  open:  ['.ii.', '.mm.'],
  frown: ['.mm.', 'm..m']
};
// Bun, 8 x 5, h hi, b base, s shade, d deepest.
const BUN = ['..hhbb..', '.hhbbbs.', 'hbbbbbss', 'dbbbbbsd', '.dddddd.'];
// Bandana knots, b base, s shade.
const KNOT_SIDE = ['.bb..', 'bbbs.', 'sbbbb', '.s.bs', '...sb', '....s'];
const KNOT_BACK = ['.bbbb.', 'bsbbsb', '.bbbb.', '.b..b.', '.s..s.'];
// Tongs: drawn by drawTongs from two point lists (round 2), not a grid.
// Fork standing in a fist on the table.
const FORK = ['h.h', 'hhh', '.s.', '.s.', '.s.'];

const GRIDS = [
  ['EYES.open', EYES.open, '.ew', 3, 4], ['EYES.blink', EYES.blink, '.ew', 3, 4], ['EYES.happy', EYES.happy, '.ew', 3, 4],
  ['MOUTHS.n', MOUTHS.n, '.mti', 4, 2], ['MOUTHS.smile', MOUTHS.smile, '.mti', 4, 2],
  ['MOUTHS.open', MOUTHS.open, '.mti', 4, 2], ['MOUTHS.frown', MOUTHS.frown, '.mti', 4, 2],
  ['BUN', BUN, '.hbsd', 8, 5], ['KNOT_SIDE', KNOT_SIDE, '.bs', 5, 6], ['KNOT_BACK', KNOT_BACK, '.bs', 6, 5],
  ['FORK', FORK, '.hs', 3, 5]
];

/* ------------------------------------------------------------------ option tables */
const HAIRS = Object.freeze(['short', 'curly', 'long', 'buzz', 'bun', 'bald']);
const FACES = Object.freeze(['none', 'mustache', 'beard', 'glasses']);
const HATS = Object.freeze(['none', 'cap', 'cowboy', 'bandana']);
const BODIES = Object.freeze(['A', 'B', 'old']);
const GUEST_SHIRTS = Object.freeze(['white', 'purple', 'red', 'teal', 'yellow', 'green', 'sky', 'pink', 'orange', 'blue', 'magenta']);
const POSES = Object.freeze({ down: 8, up: 6, side: 8, carryDown: 6, carryUp: 6, carrySide: 6, sit: 6, sitUp: 2 });
const HAT_COVER = { cap: 8, cowboy: 6, bandana: 7 };   // hair rows above this are hidden by the hat

/* ------------------------------------------------------------------ load-time validation */
function validate() {
  GRIDS.forEach(function (g) {
    const name = g[0], rows = g[1], legend = g[2], w = g[3], h = g[4];
    if (!Array.isArray(rows) || rows.length !== h) throw new Error('art3 people: grid ' + name + ' needs ' + h + ' rows');
    rows.forEach(function (s, i) {
      if (typeof s !== 'string' || s.length !== w) throw new Error('art3 people: grid ' + name + ' row ' + i + ' is not ' + w + ' wide');
      for (let k = 0; k < s.length; k++) {
        if (legend.indexOf(s.charAt(k)) < 0) throw new Error('art3 people: grid ' + name + ' row ' + i + ' has "' + s.charAt(k) + '"');
      }
    });
  });
  if (IN_FRONT.length !== 22) throw new Error('art3 people: head needs 22 rows');
  IN_FRONT.forEach(function (v, r) { if (v < 0 || v > 11) throw new Error('art3 people: head inset row ' + r); });
  Object.keys(SIDE_LOW).forEach(function (r) {
    const s = SIDE_LOW[r];
    if (s[0] < 0 || s[1] > 23 || s[0] > s[1]) throw new Error('art3 people: side jaw row ' + r);
  });
  Object.keys(BODY).forEach(function (k) {
    const t = BODY[k], top = 47 - SHOE_ROWS - t.pants - t.shirt - 23;
    if (top < 4) throw new Error('art3 people: body ' + k + ' leaves no headroom');
    if (47 - SHOE_ROWS - t.pants > SPLIT) throw new Error('art3 people: body ' + k + ' pants shorter than the leg split');
  });
  if (PAL.SKIN.length !== 6 || PAL.HAIR.length !== 6 || PAL.APRON.length !== 6 || PAL.PANTS.length < 3) {
    throw new Error('art3 people: palette swap sets changed size');
  }
  GUEST_SHIRTS.concat(Object.keys(PAL.ROLE_SHIRT).map(function (k) { return PAL.ROLE_SHIRT[k]; })).forEach(function (s) {
    if (!PAL.SHIRT[s]) throw new Error('art3 people: shirt "' + s + '" missing from PAL.SHIRT');
  });
  ['cap', 'cowboy', 'bandana'].forEach(function (h) { if (!PAL.HAT[h]) throw new Error('art3 people: PAL.HAT.' + h + ' missing'); });
}
validate();

/* ------------------------------------------------------------------ pixel layer */
const INT = Object.create(null);
function ci(hex) {
  let v = INT[hex];
  if (v === undefined) INT[hex] = v = parseInt(String(hex).slice(1), 16);
  return v;
}
function Layer(w, h) { this.w = w; this.h = h; this.a = new Int32Array(w * h).fill(-1); }
Layer.prototype.px = function (x, y, c) {
  if (c === undefined || c === null || c < 0 || x < 0 || y < 0 || x >= this.w || y >= this.h) return;
  this.a[y * this.w + x] = c;
};
Layer.prototype.at = function (x, y) {
  if (x < 0 || y < 0 || x >= this.w || y >= this.h) return -1;
  return this.a[y * this.w + x];
};
Layer.prototype.span = function (y, x0, x1, c) { for (let x = x0; x <= x1; x++) this.px(x, y, c); };
Layer.prototype.del = function (x, y) { if (x >= 0 && y >= 0 && x < this.w && y < this.h) this.a[y * this.w + x] = -1; };
Layer.prototype.over = function (o) { for (let i = 0; i < this.a.length; i++) if (o.a[i] !== -1) this.a[i] = o.a[i]; };

// Stamp a validated grid; map is char -> color int.
function stamp(L, rows, map, x, y, flip) {
  for (let r = 0; r < rows.length; r++) {
    const s = rows[r], n = s.length;
    for (let k = 0; k < n; k++) {
      const c = map[s.charAt(flip ? n - 1 - k : k)];
      if (c !== undefined) L.px(x + k, y + r, c);
    }
  }
}

// 1 px outline, 4-neighbour, outside the silhouette only (bible section 3).
function outline(L, col) {
  const w = L.w, h = L.h, a = L.a, o = new Int32Array(a);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x;
    if (a[i] !== -1) continue;
    if ((x > 0 && a[i - 1] !== -1) || (x < w - 1 && a[i + 1] !== -1) ||
        (y > 0 && a[i - w] !== -1) || (y < h - 1 && a[i + w] !== -1)) o[i] = col;
  }
  L.a = o;
}

function mirror(L) {
  const M = new Layer(L.w, L.h);
  for (let y = 0; y < L.h; y++) for (let x = 0; x < L.w; x++) M.a[y * L.w + x] = L.a[y * L.w + (L.w - 1 - x)];
  return M;
}

function makeCanvas(w, h) {
  if (typeof document !== 'undefined' && document.createElement) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    return c;
  }
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(w, h);
  return null;
}
function toCanvas(L) {
  const cv = makeCanvas(L.w, L.h);
  if (!cv) return null;
  const g = cv.getContext('2d');
  const img = g.createImageData(L.w, L.h), d = img.data, a = L.a;
  for (let i = 0; i < a.length; i++) {
    const v = a[i];
    if (v < 0) continue;
    const j = i * 4;
    d[j] = (v >> 16) & 255; d[j + 1] = (v >> 8) & 255; d[j + 2] = v & 255; d[j + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  return cv;
}

/* ------------------------------------------------------------------ looks */
function idx(v, list, dflt) {
  if (typeof v === 'number' && v >= 0 && v < list.length) return v | 0;
  return dflt;
}
function named(v, list, dflt, alias) {
  if (typeof v === 'number' && list[v]) return list[v];
  if (typeof v === 'string') {
    const k = v.toLowerCase().replace(/\s+hat$/, '').replace(/\s+/g, '');
    if (alias && alias[k]) return alias[k];
    if (list.indexOf(k) >= 0) return k;
  }
  return dflt;
}
// Normalize any partial look to the full shape. Unknown values fall back, never throw.
function normLook(l) {
  l = l || {};
  const shirt = typeof l.shirt === 'string' && PAL.SHIRT[l.shirt] ? l.shirt
    : (l.role && PAL.ROLE_SHIRT[l.role] ? PAL.ROLE_SHIRT[l.role] : 'white');
  const apron = typeof l.apron === 'number' && l.apron >= 0 && l.apron < PAL.APRON.length ? l.apron | 0 : -1;
  return {
    body: named(l.body, BODIES, 'A', { older: 'old', a: 'A', b: 'B' }),
    skin: idx(l.skin, PAL.SKIN, 1),
    hair: named(l.hair, HAIRS, 'short'),
    hairColor: idx(l.hairColor, PAL.HAIR, 1),
    face: named(l.face, FACES, 'none'),
    hat: named(l.hat, HATS, 'none', { cowboyhat: 'cowboy' }),
    shirt: shirt,
    pants: idx(l.pants, PAL.PANTS, 0),
    apron: apron,
    tongs: !!l.tongs
  };
}
function lookKey(n) {
  return [n.body, n.skin, n.hair, n.hairColor, n.face, n.hat, n.shirt, n.pants, n.apron, n.tongs ? 1 : 0].join('.');
}

const REG = Object.create(null);
function resolveLook(look) {
  if (typeof look === 'string') {
    if (!REG[look]) throw new Error('art3 people: no look registered as "' + look + '"');
    return REG[look];
  }
  if (look && look._key) return look;
  const n = normLook(look);
  n._key = lookKey(n);
  return n;
}

const COLORS = Object.create(null);
function colorsFor(n) {
  let C = COLORS[n._key];
  if (C) return C;
  const sk = PAL.SKIN[n.skin], hr = PAL.HAIR[n.hairColor], sh = PAL.SHIRT[n.shirt], pn = PAL.PANTS[n.pants];
  const st = PAL.RAMP.steel, F = PAL.FACE;
  C = {
    skin: ci(sk.base), skinHi: ci(sk.hi), skinSh: ci(sk.shade), skinDk: ci(sk.dark), cheek: ci(sk.cheek),
    hair: [ci(hr[0]), ci(hr[1]), ci(hr[2]), ci(hr[3])],
    shirt: [ci(sh[0]), ci(sh[1]), ci(sh[2])],
    pants: [ci(pn[0]), ci(pn[1]), ci(pn[2])],
    shoe: ci(PAL.SHOE),
    apron: n.apron >= 0 ? PAL.APRON[n.apron].map(ci) : null,
    eye: ci(F.eye), catchL: ci(F.catch), mouth: ci(F.mouth), mouthIn: ci(F.mouthIn), teeth: ci(F.teeth), glint: ci(F.glint),
    ol: ci(PAL.OL),
    steel: [ci(st.hi), ci(st.base), ci(st.shade), ci(st.dark)],
    hat: null
  };
  if (n.hat !== 'none') {
    const h = PAL.HAT[n.hat];
    C.hat = { r: [ci(h.hi), ci(h.base), ci(h.shade), ci(h.dark)], band: h.band ? ci(h.band) : -1, dot: h.dot ? ci(h.dot) : -1 };
  }
  COLORS[n._key] = C;
  return C;
}

/* ------------------------------------------------------------------ pose state */
function zeroLegs() { return [{ dx: 0, lift: 0 }, { dx: 0, lift: 0 }]; }
function zeroHands() { return [{ dx: 0, dy: 0 }, { dx: 0, dy: 0 }]; }
// Walk cycle: 0 left contact (right foot up 2), 1 pass (body up 1), 2 right contact, 3 pass.
const WALK_FB = [
  { dy: 0, legs: [[0, 0], [0, 2]], hands: [[0, -1], [0, 1]] },
  { dy: -1, legs: [[0, 0], [0, 0]], hands: [[0, 0], [0, 0]] },
  { dy: 0, legs: [[0, 2], [0, 0]], hands: [[0, 1], [0, -1]] },
  { dy: -1, legs: [[0, 0], [0, 0]], hands: [[0, 0], [0, 0]] }
];
// Side (facing left): 3 px stride, back foot lifted 1, hands swing opposite the legs.
const WALK_SIDE = [
  { dy: 0, legs: [[-2, 0], [1, 1]], hands: [[1, 0], [-1, 0]] },
  { dy: -1, legs: [[0, 0], [0, 0]], hands: [[0, 0], [0, 0]] },
  { dy: 0, legs: [[1, 1], [-2, 0]], hands: [[-1, 0], [1, 0]] },
  { dy: -1, legs: [[0, 0], [0, 0]], hands: [[0, 0], [0, 0]] }
];

function stateFor(pose, frame) {
  if (!Object.prototype.hasOwnProperty.call(POSES, pose)) throw new Error('art3 people: unknown pose "' + pose + '"');
  const n = POSES[pose];
  const f = ((frame | 0) % n + n) % n;
  const carry = pose.indexOf('carry') === 0;
  const sit = pose === 'sit' || pose === 'sitUp';
  const view = (pose === 'up' || pose === 'carryUp' || pose === 'sitUp') ? 'up'
    : (pose === 'side' || pose === 'carrySide') ? 'side' : 'down';
  const st = {
    view: view, carry: carry, sit: sit, dy: 0, legs: zeroLegs(), hands: zeroHands(),
    eyes: 'open', mouth: 'n', brows: false, fork: null, tongs: !carry && !sit
  };
  if (sit) {
    if (pose === 'sitUp') { if (f === 1) st.dy = 1; return st; }
    if (f === 1) st.eyes = 'blink';
    else if (f === 2) st.fork = 'down';
    else if (f === 3) { st.fork = 'up'; st.mouth = 'open'; st.hands[0] = { dx: 5, dy: -9 }; }
    else if (f === 4) { st.eyes = 'happy'; st.mouth = 'smile'; }
    else if (f === 5) { st.mouth = 'frown'; st.brows = true; }
    return st;
  }
  if (f === 1) st.dy = 1;
  else if (f >= 2 && f <= 5) {
    const w = (view === 'side' ? WALK_SIDE : WALK_FB)[f - 2];
    st.dy = w.dy;
    st.legs = w.legs.map(function (l) { return { dx: l[0], lift: l[1] }; });
    st.hands = w.hands.map(function (h) { return { dx: h[0], dy: h[1] }; });
  } else if (f === 6) st.eyes = 'blink';
  else if (f === 7) { st.mouth = 'frown'; st.brows = true; }
  if (carry) {
    const base = view === 'side' ? [[0, -3], [-8, -3]] : [[-1, -3], [1, -3]];
    st.hands = st.hands.map(function (h, i) { return { dx: h.dx + base[i][0], dy: (view === 'side' ? 0 : h.dy) + base[i][1] }; });
  }
  return st;
}

/* ------------------------------------------------------------------ body */
function layout(tpl, st) {
  const bodyTop = st.sit ? 36 - tpl.shirt : 47 - SHOE_ROWS - tpl.pants - tpl.shirt;
  const torso = bodyTop + st.dy;
  return { torso: torso, headTop: torso - 23 };
}

function handRect(tpl, st, i, torso) {
  const w = tpl.wide, top = torso + tpl.shirt - (st.sit ? 2 : 1);
  const h = st.hands[i];
  return { x: HX + (i === 0 ? -w : 21 + w) + h.dx, y: top + h.dy };
}

function drawLegs(L, C, tpl, torso, st) {
  const w = tpl.wide, top = torso + tpl.shirt, P = C.pants;
  for (let y = top; y < SPLIT; y++) {
    const narrow = y < top + 2;
    const x0 = HX + (narrow ? 4 - w : 3 - w), x1 = HX + (narrow ? 19 + w : 20 + w);
    L.span(y, x0, x1, P[1]);
    L.px(x1, y, P[2]);
  }
  L.span(SPLIT - 1, HX + 11, HX + 12, P[2]);                 // crotch crease
  for (let i = 0; i < 2; i++) {
    const lg = st.legs[i];
    const lx0 = HX + (i ? 13 : 3 - w) + lg.dx, lx1 = HX + (i ? 20 + w : 10) + lg.dx;
    for (let y = SPLIT; y <= 44 - lg.lift; y++) { L.span(y, lx0, lx1, P[1]); L.px(lx1, y, P[2]); }
    if (i === 0) for (let y = SPLIT; y <= 44 - lg.lift; y++) L.px(lx0, y, P[0]);
    L.span(45 - lg.lift, lx0, lx1, C.shoe);
    L.span(46 - lg.lift, lx0, lx1, C.shoe);
  }
}

function drawShirt(L, C, tpl, torso, st) {
  const w = tpl.wide, n = tpl.shirt, S = C.shirt;
  for (let b = 0; b < n; b++) {
    const y = torso + b;
    let x0, x1;
    if (b === 0) { x0 = 4 - w; x1 = 19 + w; }
    else if (b === 1) { x0 = 2 - w; x1 = 21 + w; }
    else if (b === n - 1) { x0 = 3 - w; x1 = 20 + w; }
    else { x0 = -w; x1 = 23 + w; }
    L.span(y, HX + x0, HX + x1, b === n - 1 ? S[2] : S[1]);
    if (b >= 3 && b < n - 1) { L.px(HX + 3 - w, y, S[2]); L.px(HX + 20 + w, y, S[2]); }   // sleeve seams
    if (b >= 2 && b < n - 1) L.px(HX + x1, y, S[2]);                                      // shaded right edge
  }
  // top-left light on the shoulder
  L.span(torso, HX + 4 - w, HX + 8 - w, S[0]);
  L.span(torso + 1, HX + 2 - w, HX + 4 - w, S[0]);
  if (tpl.old && st.view !== 'up') {
    const s = st.view === 'side' ? -2 : 0;
    for (let b = 1; b < n - 1; b++) L.px(HX + 11 + s, torso + b, S[2]);                  // cardigan placket
    L.px(HX + 12 + s, torso + 3, S[0]); L.px(HX + 12 + s, torso + 6, S[0]);              // buttons
    L.span(torso, HX + 8 + s, HX + 10 + s, S[0]); L.span(torso, HX + 13 + s, HX + 15 + s, S[0]); // collar points
  }
}

function drawApron(L, C, tpl, torso, st) {
  const A = C.apron, n = Math.min(tpl.shirt + tpl.pants - 4, st.sit ? tpl.shirt : 99);
  if (st.view === 'up') {
    for (let b = 0; b <= 8; b++) { L.px(HX + 6, torso + b, A[2]); L.px(HX + 17, torso + b, A[2]); }
    L.span(torso + 9, HX + 8, HX + 15, A[1]);
    [[10, 8], [13, 8], [11, 9], [12, 9], [10, 10], [13, 10], [9, 11], [14, 11]].forEach(function (p) { L.px(HX + p[0], torso + p[1], A[1]); });
    for (let b = 9; b < n; b++) {
      L.span(torso + b, HX + 3 - tpl.wide, HX + 4 - tpl.wide, A[1]);
      L.span(torso + b, HX + 19 + tpl.wide, HX + 20 + tpl.wide, A[2]);
    }
    return;
  }
  const s = st.view === 'side' ? -2 : 0;
  for (let b = 0; b < n; b++) {
    const y = torso + b;
    if (b < 4) L.span(y, HX + 7 + s, HX + 16 + s, b === 0 ? A[0] : A[1]);
    else {
      L.span(y, HX + 5 + s, HX + 18 + s, b === n - 1 ? A[2] : A[1]);
      L.px(HX + 18 + s, y, A[2]);
      if (b >= 5 && b < n - 1) L.px(HX + 7 + s, y, A[2]);                                 // fold
    }
  }
  if (n > 9) L.span(torso + 8, HX + 10 + s, HX + 15 + s, A[2]);                           // pocket
  if (st.view === 'down') { L.px(HX + 7, torso - 1, A[3]); L.px(HX + 16, torso - 1, A[3]); } // neck strap
}

function drawHands(L, C, tpl, torso, st) {
  for (let i = 0; i < 2; i++) {
    const h = handRect(tpl, st, i, torso);
    for (let r = 0; r < 3; r++) L.span(h.y + r, h.x, h.x + 2, C.skin);
    L.px(h.x + 2, h.y + 2, C.skinSh);
  }
}

/* ------------------------------------------------------------------ head */
function drawFace(L, C, n, st, P) {
  const side = st.view === 'side';
  const ex = side ? [2, 10] : [5, 16];
  const eyeMap = { e: C.eye, w: C.catchL };
  ex.forEach(function (x) { stamp(L, EYES[st.eyes], eyeMap, P.x + x, P.y + 11); });
  // blush
  if (side) { L.span(P.y + 16, P.x + 0, P.x + 1, C.cheek); L.span(P.y + 16, P.x + 10, P.x + 12, C.cheek); }
  else { L.span(P.y + 16, P.x + 2, P.x + 4, C.cheek); L.span(P.y + 16, P.x + 19, P.x + 21, C.cheek); }
  // older: soft bags under the eyes
  if (BODY[n.body].old && st.eyes !== 'happy') ex.forEach(function (x) { L.span(P.y + 15, P.x + x, P.x + x + 2, C.skinSh); });
  // brows (unhappy): sloping up toward the middle
  if (st.brows) {
    const bc = n.hair === 'bald' ? C.skinDk : C.hair[2];
    ex.forEach(function (x, k) {
      const inner = side ? (k === 0 ? 1 : 0) : k;
      if (inner === 0) { L.px(P.x + x, P.y + 9, bc); L.px(P.x + x + 1, P.y + 9, bc); L.px(P.x + x + 2, P.y + 8, bc); }
      else { L.px(P.x + x, P.y + 8, bc); L.px(P.x + x + 1, P.y + 9, bc); L.px(P.x + x + 2, P.y + 9, bc); }
    });
  }
}

function drawMouth(L, C, st, P, mouth) {
  const map = { m: C.mouth, t: C.teeth, i: C.mouthIn };
  stamp(L, MOUTHS[mouth], map, P.x + (st.view === 'side' ? 4 : 10), P.y + 17);
}

function drawFacialHair(L, C, n, st, P) {
  const T = C.hair, side = st.view === 'side';
  const sp = function (r, a, b, c) { L.span(P.y + r, P.x + a, P.x + b, c); };
  if (n.face === 'mustache') {
    if (side) { sp(15, 2, 9, T[1]); sp(16, 1, 3, T[1]); sp(16, 8, 10, T[1]); L.px(P.x + 1, P.y + 16, T[2]); }
    else { sp(15, 8, 15, T[1]); sp(16, 6, 9, T[1]); sp(16, 14, 17, T[1]); L.px(P.x + 6, P.y + 16, T[2]); L.px(P.x + 17, P.y + 16, T[2]); }
    return;
  }
  if (n.face !== 'beard') return;
  const fill = function (r) { const s = headSpan(st.view, r); sp(r, s[0], s[1], T[1]); };
  if (side) {
    for (let r = 10; r <= 14; r++) sp(r, 14, 16, T[1]);
    sp(15, 13, 16, T[1]);
    sp(16, 0, 1, T[1]); sp(16, 3, 9, T[2]); sp(16, 12, 16, T[1]);
    sp(17, 0, 2, T[1]); sp(17, 9, 16, T[1]);
    for (let r = 18; r <= 21; r++) fill(r);
    sp(22, 3, 15, T[1]); sp(23, 5, 12, T[1]); sp(24, 7, 10, T[2]);
  } else {
    for (let r = 10; r <= 14; r++) { sp(r, 0, 1, T[1]); sp(r, 22, 23, T[1]); }
    sp(15, 0, 2, T[1]); sp(15, 21, 23, T[1]);
    sp(16, 0, 3, T[1]); sp(16, 8, 15, T[2]); sp(16, 20, 23, T[1]);
    sp(17, 0, 9, T[1]); sp(17, 14, 23, T[1]);
    for (let r = 18; r <= 21; r++) fill(r);
    sp(22, 5, 18, T[1]); sp(23, 7, 16, T[1]); sp(24, 9, 14, T[2]);
  }
}

// Hair into its own layer (head-local coordinates), so a hat can mask it.
function paintHair(H, B, n, view, C, P) {
  const T = C.hair;
  const p = function (c, r, t) { H.px(P.x + c, P.y + r, T[t]); };
  const sp = function (r, a, b, t) { for (let c = a; c <= b; c++) p(c, r, t); };
  const fill = function (r0, r1, t) { for (let r = r0; r <= r1; r++) { const s = headSpan(view, r); if (s) sp(r, s[0], s[1], t); } };
  const has = function (c, r) { return H.at(P.x + c, P.y + r) !== -1; };
  const acc = function (c, r, t) { if (has(c, r)) p(c, r, t); };
  const ears = function () { for (let r = 11; r <= 13; r++) { H.del(P.x, P.y + r); H.del(P.x + 23, P.y + r); } };
  const style = n.hair;
  if (style === 'short') {
    if (view === 'down') {
      fill(0, 5, 1); sp(6, 0, 8, 1); sp(6, 18, 23, 1); p(17, 6, 2);
      sp(7, 0, 3, 1); sp(7, 20, 23, 1);
      for (let r = 8; r <= 10; r++) { sp(r, 0, 1, 1); sp(r, 22, 23, 1); }
      for (let r = 11; r <= 13; r++) { p(0, r, 1); p(23, r, 1); }
    } else if (view === 'side') {
      fill(0, 5, 1); p(0, 6, 1); p(10, 6, 2); sp(6, 11, 23, 1); sp(7, 15, 23, 1); sp(8, 16, 23, 1);
      for (let r = 9; r <= 15; r++) sp(r, 17, 23, 1);
      sp(16, 18, 22, 1); sp(17, 18, 20, 1);
    } else {
      fill(0, 21, 1); ears();
      [[7, 7], [14, 9], [9, 14], [18, 16]].forEach(function (q) { acc(q[0], q[1], 2); });
    }
  } else if (style === 'buzz') {
    if (view === 'down') {
      fill(0, 4, 1); sp(5, 0, 3, 1); sp(5, 20, 23, 1);
      for (let r = 6; r <= 9; r++) { p(0, r, 1); p(23, r, 1); }
    } else if (view === 'side') {
      fill(0, 4, 1); sp(5, 12, 23, 1);
      for (let r = 6; r <= 12; r++) sp(r, 17, 23, 1);
    } else { fill(0, 18, 1); ears(); }
    for (let r = -1; r <= 21; r++) for (let c = -1; c <= 24; c++) {
      if (!has(c, r)) continue;
      if ((c * 3 + r * 5) % 7 === 0) p(c, r, 2);
      else if ((c * 5 + r * 3) % 11 === 0) p(c, r, 0);
    }
  } else if (style === 'curly') {
    const puff = function (r0, r1) { for (let r = r0; r <= r1; r++) { const s = headSpan(view, r); if (s) { p(s[0] - 1, r, 1); p(s[1] + 1, r, 1); } } };
    sp(-1, 8, 10, 1); sp(-1, 13, 15, 1);
    if (view === 'down') {
      fill(0, 6, 1); puff(1, 5);
      sp(7, 0, 3, 1); sp(7, 6, 7, 1); sp(7, 11, 12, 1); sp(7, 16, 17, 1); sp(7, 20, 23, 1);
      for (let r = 8; r <= 15; r++) { sp(r, 0, 2, 1); sp(r, 21, 23, 1); }
      for (let r = 6; r <= 15; r++) if (r % 3 !== 2) { p(-1, r, 1); p(24, r, 1); }
      sp(16, 0, 1, 1); sp(16, 22, 23, 1);
    } else if (view === 'side') {
      fill(0, 6, 1); puff(1, 5);
      sp(7, 0, 1, 1); sp(7, 14, 23, 1);
      for (let r = 8; r <= 17; r++) { sp(r, 16, 23, 1); if (r % 3 !== 2) p(24, r, 1); }
      sp(18, 17, 21, 1);
    } else {
      fill(0, 21, 1); ears(); puff(1, 5);
      for (let r = 6; r <= 20; r++) if (r % 3 !== 2) { p(-1, r, 1); p(24, r, 1); }
      [2, 3, 6, 7, 16, 17, 20, 21].forEach(function (c) { p(c, 22, 1); });
    }
    for (let r = -1; r <= 22; r++) for (let c = -1; c <= 24; c++) {
      if (!has(c, r)) continue;
      if (c % 4 === 1 && r % 3 === 0) p(c, r, 0);
      else if (c % 4 === 3 && r % 3 === 1) p(c, r, 2);
    }
  } else if (style === 'long') {
    if (view === 'down') {
      fill(0, 5, 1); sp(6, 0, 10, 1); sp(6, 17, 23, 1); sp(7, 0, 4, 1); sp(7, 19, 23, 1);
      for (let r = 8; r <= 28; r++) { sp(r, -1, 2, 1); sp(r, 21, 24, 1); p(2, r, 2); p(21, r, 2); }
      sp(29, 0, 1, 1); sp(29, 22, 23, 1);
    } else if (view === 'side') {
      fill(0, 5, 1); p(0, 6, 1); sp(6, 9, 23, 1); sp(7, 14, 23, 1);
      for (let r = 8; r <= 18; r++) sp(r, 16, 23, 1);
      for (let r = 9; r <= 20; r++) p(24, r, 1);
      for (let r = 19; r <= 28; r++) sp(r, 15, 23, 1);
      sp(29, 16, 22, 1);
      for (let r = 8; r <= 28; r++) p(16, r, 2);
    } else {
      fill(0, 21, 1);
      for (let r = 22; r <= 28; r++) sp(r, 0, 23, 1);
      sp(29, 1, 22, 1); sp(30, 3, 20, 1);
      for (let r = 10; r <= 29; r++) { p(7, r, 2); p(16, r, 2); }
    }
  } else if (style === 'bun') {
    if (view === 'down') {
      fill(0, 5, 1); sp(6, 0, 2, 1); sp(6, 21, 23, 1);
      for (let r = 7; r <= 12; r++) { p(0, r, 1); p(23, r, 1); }
    } else if (view === 'side') {
      fill(0, 5, 1); sp(6, 9, 23, 1); sp(7, 15, 23, 1);
      for (let r = 8; r <= 14; r++) sp(r, 17, 23, 1);
    } else { fill(0, 21, 1); ears(); }
    const bx = view === 'side' ? 13 : 8, by = view === 'up' ? -1 : -2;
    stamp(B, BUN, { h: T[0], b: T[1], s: T[2], d: T[3] }, P.x + bx, P.y + by);
  } else if (style === 'bald') {
    if (view === 'down') for (let r = 9; r <= 15; r++) { sp(r, 0, 1, 1); sp(r, 22, 23, 1); }
    else if (view === 'side') for (let r = 9; r <= 16; r++) sp(r, 18, 23, 1);
    else { for (let r = 12; r <= 17; r++) { const s = headSpan(view, r); sp(r, s[0], s[1], 1); } ears(); }
  }
  // depth: the right edge of every hair run and the fringe line over the forehead take shade
  if (style !== 'bald') {
    const snap = new Int32Array(H.a);
    const at = function (c, r) { const x = P.x + c, y = P.y + r; return (x < 0 || y < 0 || x >= H.w || y >= H.h) ? -1 : snap[y * H.w + x]; };
    for (let r = -2; r <= 30; r++) for (let c = -2; c <= 25; c++) {
      const v = at(c, r);
      if (v === -1 || v === T[0]) continue;
      const fringe = view !== 'up' && r >= 4 && r <= 21 && at(c, r + 1) === -1 && headSpan(view, r + 1) && c >= headSpan(view, r + 1)[0] && c <= headSpan(view, r + 1)[1];
      if (at(c + 1, r) === -1 || fringe) p(c, r, 2);
    }
  }
  // light from the top left
  if (style !== 'bald') { acc(5, 2, 0); acc(6, 2, 0); acc(7, 2, 0); acc(8, 2, 0); acc(4, 3, 0); acc(5, 3, 0); acc(3, 4, 0); }
}

function drawHat(L, C, n, st, P) {
  const R = C.hat.r, v = st.view;
  const sp = function (r, a, b, c) { L.span(P.y + r, P.x + a, P.x + b, c); };
  const px = function (c, r, col) { L.px(P.x + c, P.y + r, col); };
  const shadowRow = function (r, a, b) {
    for (let c = a; c <= b; c++) { if (L.at(P.x + c, P.y + r) === C.skin) px(c, r, C.skinSh); }
  };
  if (n.hat === 'cap') {
    // Round 1: a crown that domes above the head, a centre seam and a button, a lit streak on the
    // upper left, a band, and the bill out on the light side with a dark underside.
    const rows = v === 'up' ? 7 : 5;
    sp(-2, 9, 14, R[1]); sp(-1, 5, 18, R[1]); px(11, -3, R[2]); px(12, -3, R[2]);
    for (let r = 0; r <= rows; r++) {
      const s = headSpan(v, r);
      sp(r, s[0], s[1], R[1]);
      sp(r, s[1] - 3, s[1], R[2]);
    }
    sp(-1, 15, 18, R[2]);
    // seam and the lit streak
    for (let r = -2; r <= rows - 1; r++) px(v === 'side' ? 9 : 12, r, R[3]);
    sp(-1, 6, 9, R[0]); sp(0, 4, 8, R[0]); sp(1, 3, 6, R[0]); px(2, 2, R[0]); px(10, -2, R[0]);
    if (v === 'down') {
      sp(rows, 0, 23, R[2]);                                  // band
      sp(6, -4, 15, R[0]); sp(7, -4, 16, R[1]); sp(8, -3, 13, R[3]);
      px(-4, 7, R[2]); sp(7, 14, 16, R[2]);
      shadowRow(8, 14, 23); shadowRow(9, 0, 12);
    } else if (v === 'side') {
      sp(rows, 0, 23, R[2]);
      sp(6, -6, 9, R[0]); sp(7, -6, 9, R[1]); sp(8, -5, 6, R[3]); sp(6, 10, 23, R[1]); sp(7, 10, 23, R[2]);
      shadowRow(8, 7, 9); shadowRow(9, 0, 6);
    } else {
      sp(5, 9, 14, R[3]); sp(6, 10, 13, n.hair === 'bald' ? C.skin : C.hair[1]); sp(7, 10, 13, n.hair === 'bald' ? C.skin : C.hair[2]);
    }
  } else if (n.hat === 'cowboy') {
    sp(-2, 5, 9, R[1]); sp(-2, 14, 18, R[1]);
    sp(-1, 5, 18, R[1]); sp(-1, 10, 13, R[2]);
    sp(0, 5, 18, R[1]);
    for (let r = -2; r <= 0; r++) { px(5, r, R[0]); px(6, r, R[0]); px(18, r, R[2]); px(17, r, R[2]); }
    sp(1, 5, 18, C.hat.band); sp(2, 5, 18, C.hat.band);
    sp(2, -4, -3, R[0]); sp(2, 26, 27, R[1]);
    sp(3, -4, 27, R[0]);
    sp(4, -3, 26, R[1]);
    sp(5, -1, 24, R[2]);
    shadowRow(6, 0, 23);
  } else if (n.hat === 'bandana') {
    for (let r = 0; r <= 6; r++) {
      const s = headSpan(v, r);
      sp(r, s[0], s[1], r === 6 ? R[2] : R[1]);
      if (r === 1 || r === 3 || r === 5) {
        for (let c = s[0]; c <= s[1]; c++) if ((c + (r === 3 ? 2 : 0)) % 4 === 1) px(c, r, C.hat.dot);
      }
    }
    sp(0, 7, 9, R[0]);
    const map = { b: R[1], s: R[2] };
    if (v === 'up') stamp(L, KNOT_BACK, map, P.x + 9, P.y + 5);
    else stamp(L, KNOT_SIDE, map, P.x + 21, P.y + 3);
  }
}

function drawGlasses(L, C, st, P) {
  const o = C.ol;
  const rim = function (x0, x1, y0, y1) {
    L.span(y0, x0, x1, o); L.span(y1, x0, x1, o);
    for (let y = y0; y <= y1; y++) { L.px(x0, y, o); L.px(x1, y, o); }
  };
  if (st.view === 'down') {
    rim(P.x + 3, P.x + 9, P.y + 9, P.y + 16); rim(P.x + 14, P.x + 20, P.y + 9, P.y + 16);
    L.span(P.y + 11, P.x + 10, P.x + 13, o);
    L.span(P.y + 11, P.x + 0, P.x + 2, o); L.span(P.y + 11, P.x + 21, P.x + 23, o);
    L.px(P.x + 8, P.y + 10, C.glint); L.px(P.x + 19, P.y + 10, C.glint);
  } else if (st.view === 'side') {
    rim(P.x + 0, P.x + 6, P.y + 9, P.y + 16); rim(P.x + 8, P.x + 14, P.y + 9, P.y + 16);
    L.px(P.x + 7, P.y + 11, o);
    L.span(P.y + 11, P.x + 15, P.x + 18, o);
    L.px(P.x + 5, P.y + 10, C.glint); L.px(P.x + 13, P.y + 10, C.glint);
  }
}

function drawHead(L, C, n, st, top, mouth) {
  const v = st.view, P = { x: HX, y: top };
  for (let r = 0; r <= 21; r++) { const s = headSpan(v, r); L.span(P.y + r, P.x + s[0], P.x + s[1], C.skin); }
  L.span(P.y + 22, P.x + NECK[v][0], P.x + NECK[v][1], C.skinSh);
  if (v === 'side') for (let r = 8; r <= 18; r++) { L.px(P.x + 15, P.y + r, C.skinSh); L.px(P.x + 16, P.y + r, C.skinSh); }
  if (n.hair === 'bald') {
    const bx = v === 'side' ? 4 : v === 'up' ? 7 : 6;
    L.span(P.y + 2, P.x + bx, P.x + bx + 2, C.skinHi); L.span(P.y + 3, P.x + bx - 1, P.x + bx, C.skinHi);
  }
  if (v !== 'up') {
    drawFace(L, C, n, st, P);
    drawFacialHair(L, C, n, st, P);
    drawMouth(L, C, st, P, mouth || st.mouth);
  }
  const H = new Layer(L.w, L.h), B = new Layer(L.w, L.h);
  paintHair(H, B, n, v, C, P);
  if (n.hat !== 'none') {
    const cut = P.y + HAT_COVER[n.hat];
    for (let y = 0; y < Math.min(cut, H.h); y++) for (let x = 0; x < H.w; x++) H.del(x, y);
  }
  L.over(H);
  if (n.hat === 'none' || n.hat === 'bandana') L.over(B);
  if (n.hat !== 'none') drawHat(L, C, n, st, P);
  if (n.face === 'glasses') drawGlasses(L, C, st, P);
}

/* ------------------------------------------------------------------ held tools */
// Round 2 (art director): at preset and portrait scale the old 2 px arms over the white shirt
// read as a fork blob. Now: two thin 1 px steel arms in a V, held out up and away from the body
// at mock B's angle, hinged in the fist (the hand draws over the hinge). Each arm carries its own
// dark outline, so the tongs stay separate from the shirt behind them, and the lit arm has one
// highlight pixel. Points are relative to the tips' corner; the hinge is at (10, 5), so the arms
// reach 10 px out and 5 px up from the fist, clear of the sleeve.
const TONG_A = [[0, 0], [1, 0], [2, 1], [3, 1], [4, 2], [5, 2], [6, 3], [7, 3], [8, 4], [9, 4], [10, 5]];   // upper, lit arm
const TONG_B = [[0, 3], [1, 3], [2, 3], [3, 3], [4, 3], [5, 4], [6, 4], [7, 4], [8, 5], [9, 5], [10, 5]];   // lower arm
const TONG_HI = [1, 0];
function drawTongs(L, C, tpl, st, torso) {
  const up = st.view === 'up', W = 11;
  const h = handRect(tpl, st, up ? 1 : 0, torso);
  const ox = up ? Math.min(CW - W, h.x + 1) : Math.max(0, h.x - 9), oy = Math.max(0, h.y - 4);
  const X = function (x) { return ox + (up ? W - 1 - x : x); };
  const on = {};
  TONG_A.concat(TONG_B).forEach(function (q) { on[q[0] + ',' + q[1]] = true; });
  // outline first: every 4-neighbour of an arm pixel that is not itself an arm pixel
  TONG_A.concat(TONG_B).forEach(function (q) {
    [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(function (d) {
      const x = q[0] + d[0], y = q[1] + d[1];
      if (!on[x + ',' + y] && x >= 0 && x < W) L.px(X(x), oy + y, C.ol);
    });
  });
  TONG_B.forEach(function (q) { L.px(X(q[0]), oy + q[1], C.steel[2]); });
  TONG_A.forEach(function (q) { L.px(X(q[0]), oy + q[1], C.steel[1]); });
  L.px(X(TONG_HI[0]), oy + TONG_HI[1], C.steel[0]);
}
function drawFork(L, C, tpl, st, torso) {
  const h = handRect(tpl, st, 0, torso), hi = C.steel[0], sh = C.steel[2];
  if (st.fork === 'down') { stamp(L, FORK, { h: hi, s: sh }, h.x, h.y - 5); return; }
  // raised to the mouth
  L.px(h.x + 3, h.y, sh); L.px(h.x + 3, h.y - 1, sh); L.px(h.x + 4, h.y - 2, sh);
  L.px(h.x + 4, h.y - 3, hi); L.px(h.x + 5, h.y - 3, hi); L.px(h.x + 5, h.y - 4, hi);
}

/* ------------------------------------------------------------------ compose */
function renderLayer(n, st) {
  const tpl = BODY[n.body], C = colorsFor(n);
  const L = new Layer(CW, st.sit ? SIT_H : CH);
  const g = layout(tpl, st);
  if (!st.sit) drawLegs(L, C, tpl, g.torso, st);
  drawShirt(L, C, tpl, g.torso, st);
  if (C.apron) drawApron(L, C, tpl, g.torso, st);
  if (n.tongs && st.tongs) drawTongs(L, C, tpl, st, g.torso);
  if (!(st.sit && st.view === 'up')) drawHands(L, C, tpl, g.torso, st);
  drawHead(L, C, n, st, g.headTop);
  if (st.fork) drawFork(L, C, tpl, st, g.torso);
  outline(L, C.ol);
  return L;
}

function renderBust(n) {
  const C = colorsFor(n), L = new Layer(BUST, BUST), S = C.shirt;
  const st = { view: 'down', eyes: 'open', mouth: 'smile', brows: false };
  L.span(26, 6, 25, S[1]); L.span(27, 3, 28, S[1]);
  for (let y = 28; y < 32; y++) L.span(y, 1, 30, S[1]);
  L.span(26, 6, 12, S[0]); L.span(27, 3, 6, S[0]); L.span(28, 1, 3, S[0]);
  L.px(28, 27, S[2]); for (let y = 28; y < 32; y++) { L.px(30, y, S[2]); L.px(29, y, S[2]); }
  for (let y = 29; y < 32; y++) { L.px(7, y, S[2]); L.px(24, y, S[2]); }
  L.span(26, 13, 18, C.skin); L.span(27, 14, 17, C.skin); L.span(28, 15, 16, C.skinSh);
  if (BODY[n.body].old) { L.span(26, 10, 12, S[0]); L.span(26, 19, 21, S[0]); for (let y = 29; y < 32; y++) L.px(16, y, S[2]); }
  if (C.apron) {
    const A = C.apron;
    for (let y = 26; y < 32; y++) { L.px(11, y, A[1]); L.px(20, y, A[1]); }
    L.span(29, 11, 20, A[0]); L.span(30, 11, 20, A[1]); L.span(31, 11, 20, A[1]);
    L.px(11, 25, A[3]); L.px(20, 25, A[3]);
  }
  drawHead(L, C, n, st, 3, 'smile');
  outline(L, C.ol);
  return L;
}

/* ------------------------------------------------------------------ atlas, caches and API */
// One atlas canvas per look holds every frame plus the cached flips (side, carrySide, sit), so a
// look costs one putImageData. drawPerson blits from the atlas; person() cuts a frame canvas from
// it on first request for callers that want a canvas of their own.
const ATLAS_COLS = 16;
const ATLAS_ORDER = [];
Object.keys(POSES).forEach(function (pose) { for (let f = 0; f < POSES[pose]; f++) ATLAS_ORDER.push([pose, f, false]); });
['side', 'carrySide', 'sit'].forEach(function (pose) { for (let f = 0; f < POSES[pose]; f++) ATLAS_ORDER.push([pose, f, true]); });
const ATLAS_ROWS = Math.ceil(ATLAS_ORDER.length / ATLAS_COLS);

const ATLAS = new Map(), CACHE = new Map();
let built = 0, buildMs = 0, atlases = 0;
const now = function () { return (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now(); };
function frameKey(pose, f, flip) { return pose + '|' + f + (flip ? '|f' : ''); }
function frameOf(pose, frame) {
  if (!Object.prototype.hasOwnProperty.call(POSES, pose)) throw new Error('art3 people: unknown pose "' + pose + '"');
  const n = POSES[pose];
  return ((frame | 0) % n + n) % n;
}

function atlasFor(n) {
  let at = ATLAS.get(n._key);
  if (at) return at;
  const t0 = now();
  const W = ATLAS_COLS * CW, H = ATLAS_ROWS * CH;
  const cv = makeCanvas(W, H);
  const rect = Object.create(null);
  let g = null, img = null, d = null;
  if (cv) { g = cv.getContext('2d'); img = g.createImageData(W, H); d = img.data; }
  ATLAS_ORDER.forEach(function (e, i) {
    let L = renderLayer(n, stateFor(e[0], e[1]));
    if (e[2]) L = mirror(L);
    const ox = (i % ATLAS_COLS) * CW, oy = Math.floor(i / ATLAS_COLS) * CH;
    rect[frameKey(e[0], e[1], e[2])] = { x: ox, y: oy, w: L.w, h: L.h };
    if (!d) return;
    const a = L.a;
    for (let y = 0; y < L.h; y++) for (let x = 0; x < L.w; x++) {
      const v = a[y * L.w + x];
      if (v < 0) continue;
      const j = ((oy + y) * W + ox + x) * 4;
      d[j] = (v >> 16) & 255; d[j + 1] = (v >> 8) & 255; d[j + 2] = v & 255; d[j + 3] = 255;
    }
  });
  if (g) g.putImageData(img, 0, 0);
  at = { canvas: cv, rect: rect };
  ATLAS.set(n._key, at);
  atlases++; built += ATLAS_ORDER.length; buildMs += now() - t0;
  return at;
}

function person(look, pose, frame, flip) {
  const n = resolveLook(look), f = frameOf(pose, frame);
  const key = n._key + '|' + frameKey(pose, f, flip);
  let cv = CACHE.get(key);
  if (cv) return cv;
  const at = atlasFor(n), r = at.rect[frameKey(pose, f, flip)];
  if (r && at.canvas) {
    cv = makeCanvas(r.w, r.h);
    cv.getContext('2d').drawImage(at.canvas, r.x, r.y, r.w, r.h, 0, 0, r.w, r.h);
  } else {
    let L = renderLayer(n, stateFor(pose, f));
    if (flip) L = mirror(L);
    cv = toCanvas(L);
  }
  CACHE.set(key, cv);
  return cv;
}

function drawPerson(ctx, look, pose, frame, x, y, flip) {
  const n = resolveLook(look), f = frameOf(pose, frame);
  const at = atlasFor(n), r = at.rect[frameKey(pose, f, flip)];
  if (r && at.canvas) {
    ctx.drawImage(at.canvas, r.x, r.y, r.w, r.h, Math.round(x) - AX, Math.round(y) - r.h, r.w, r.h);
    return;
  }
  const cv = person(n, pose, f, flip);
  if (cv) ctx.drawImage(cv, Math.round(x) - AX, Math.round(y) - cv.height);
}

function portrait(look) {
  const n = resolveLook(look);
  const key = n._key + '|bust';
  let cv = CACHE.get(key);
  if (cv) return cv;
  const t0 = now();
  cv = toCanvas(renderBust(n));
  CACHE.set(key, cv);
  built++; buildMs += now() - t0;
  return cv;
}

// Hand centres relative to the anchor (negative y is up), after any flip.
function personHands(look, pose, frame, flip) {
  const n = resolveLook(look), st = stateFor(pose, frameOf(pose, frame)), tpl = BODY[n.body], g = layout(tpl, st);
  const H = st.sit ? SIT_H : CH;
  return [0, 1].map(function (i) {
    const h = handRect(tpl, st, i, g.torso);
    let x = h.x + 1.5 - AX;
    if (flip) x = -x;
    return { x: x, y: h.y + 1.5 - H };
  });
}

// Ground shadow: rx 14, ry 5, K at ALPHA.shadowPerson, centre (x, y - 1).
let SHADOW = null;
const SH_RX = 14, SH_RY = 5;
function shadowCanvas() {
  if (SHADOW) return SHADOW;
  const w = SH_RX * 2, h = SH_RY * 2, cv = makeCanvas(w, h);
  if (!cv) return null;
  const g = cv.getContext('2d'), img = g.createImageData(w, h), d = img.data;
  const a = PAL.ALPHA.shadowPerson, rgb = PAL.hexToRgb(a.rgb), al = Math.round(a.a * 255);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const dx = (x + 0.5 - SH_RX) / SH_RX, dy = (y + 0.5 - SH_RY) / SH_RY;
    if (dx * dx + dy * dy > 1) continue;
    const j = (y * w + x) * 4;
    d[j] = rgb[0]; d[j + 1] = rgb[1]; d[j + 2] = rgb[2]; d[j + 3] = al;
  }
  g.putImageData(img, 0, 0);
  return (SHADOW = cv);
}
function drawPersonShadow(ctx, x, y) {
  const cv = shadowCanvas();
  if (cv) ctx.drawImage(cv, Math.round(x) - SH_RX, Math.round(y) - 1 - SH_RY);
}

/* ------------------------------------------------------------------ seeded looks */
function mulberry32(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
function pickW(rnd, table) {
  let sum = 0;
  for (let i = 0; i < table.length; i++) sum += table[i][1];
  let x = rnd() * sum;
  for (let i = 0; i < table.length; i++) { x -= table[i][1]; if (x < 0) return table[i][0]; }
  return table[table.length - 1][0];
}
function seedOf(s) {
  if (typeof s === 'number') return s | 0;
  const str = String(s);
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h | 0;
}
// kind: 'guest' (default), 'crew' (role shirt, apron), 'player' (apron, tongs).
function randomLook(seed, kind, role) {
  const rnd = mulberry32(seedOf(seed) ^ 0x5eed);
  kind = kind || 'guest';
  const body = pickW(rnd, [['A', 50], ['B', 30], ['old', 20]]);
  const old = body === 'old';
  const skin = Math.floor(rnd() * 6);
  const hairColor = old ? pickW(rnd, [[5, 70], [0, 10], [1, 10], [3, 10]]) : pickW(rnd, [[0, 24], [1, 26], [2, 14], [3, 16], [4, 14], [5, 6]]);
  const hair = old ? pickW(rnd, [['bald', 28], ['short', 30], ['buzz', 14], ['curly', 10], ['bun', 12], ['long', 6]])
    : pickW(rnd, [['short', 26], ['curly', 18], ['long', 18], ['buzz', 14], ['bun', 14], ['bald', 10]]);
  const face = pickW(rnd, [['none', 52], ['glasses', old ? 30 : 14], ['mustache', 14], ['beard', 18]]);
  const hat = pickW(rnd, [['none', 72], ['cap', 14], ['cowboy', 8], ['bandana', 6]]);
  const pants = pickW(rnd, [[0, 55], [1, 25], [2, 20]]);
  let shirt = GUEST_SHIRTS[Math.floor(rnd() * GUEST_SHIRTS.length)];
  let apron = -1;
  if (kind === 'crew' || kind === 'player') {
    apron = Math.floor(rnd() * 6);
    if (kind === 'crew') shirt = PAL.ROLE_SHIRT[role] || PAL.ROLE_SHIRT[['FIRE', 'PREP', 'RUN', 'DRIVE', 'TILL'][Math.floor(rnd() * 5)]];
    else shirt = 'white';
  }
  return normLook({ body: body, skin: skin, hair: hair, hairColor: hairColor, face: face, hat: hat, shirt: shirt, pants: pants, apron: apron, tongs: kind === 'player', role: role });
}

function look(id, parts) {
  const n = normLook(parts);
  n._key = lookKey(n);
  REG[id] = n;
  return n;
}
function lookOf(id) { return REG[id] || null; }

/* ------------------------------------------------------------------ clip timing */
// Frame for a clip at time t (ms). Blinks every 2.5 to 4.5 s for 120 ms, seeded per person.
function clipFrame(pose, clip, t, seed) {
  t = Math.max(0, t || 0);
  if (clip === 'walk') return 2 + Math.floor(t / 125) % 4;
  if (pose === 'sit') {
    if (clip === 'eat') return 2 + Math.floor(t / 400) % 2;
    return blinking(t, seed) ? 1 : 0;
  }
  if (pose === 'sitUp') return Math.floor(t / 500) % 2;
  if ((pose === 'down' || pose === 'side') && blinking(t, seed)) return 6;
  return Math.floor(t / 500) % 2;
}
function blinking(t, seed) {
  const r = mulberry32(seedOf(seed || 0));
  const period = 2500 + Math.floor(r() * 2000), phase = Math.floor(r() * period);
  return ((t + phase) % period) < 120;
}

/* ------------------------------------------------------------------ build helpers and self test */
// Build a look's atlas (every frame and flip) and its bust now instead of on first draw.
function buildLook(lookIn) {
  const t0 = now(), n = resolveLook(lookIn);
  atlasFor(n);
  portrait(n);
  return { frames: ATLAS_ORDER.length + 1, ms: now() - t0 };
}

// Pure (no canvas): renders every part combination in every pose and checks the cell rules.
// Returns { combos, frames, ms, errors[] }.
function selfTest() {
  const t0 = now(), errors = [];
  let frames = 0, combos = 0;
  BODIES.forEach(function (body) {
    HAIRS.forEach(function (hair) {
      HATS.forEach(function (hat) {
        FACES.forEach(function (face) {
          combos++;
          const n = normLook({ body: body, hair: hair, hat: hat, face: face, skin: combos % 6, hairColor: (combos * 5) % 6, apron: combos % 7 - 1, tongs: combos % 3 === 0, shirt: GUEST_SHIRTS[combos % GUEST_SHIRTS.length] });
          n._key = lookKey(n);
          Object.keys(POSES).forEach(function (pose) {
            for (let f = 0; f < POSES[pose]; f++) {
              const st = stateFor(pose, f), L = renderLayer(n, st);
              frames++;
              const tag = lookKey(n) + ' ' + pose + ' ' + f;
              let edge = false;
              for (let y = 0; y < L.h; y++) if (L.at(0, y) !== -1 || L.at(31, y) !== -1) edge = true;
              const brim = hat === 'cowboy' || (hat === 'cap' && st.view === 'side');
              if (edge && !brim && !(n.tongs && st.tongs)) errors.push(tag + ': columns 0 or 31 used');
              const ol = colorsFor(n).ol;
              let clipped = false;
              for (let x = 0; x < L.w; x++) { const v = L.at(x, 0); if (v !== -1 && v !== ol) clipped = true; }
              if (clipped) errors.push(tag + ': art on row 0 loses its outline');
              if (!st.sit) {
                let feet = false, below = false;
                for (let x = 0; x < CW; x++) { if (L.at(x, 46) !== -1 && L.at(x, 46) !== colorsFor(n).ol) feet = true; }
                for (let x = 0; x < CW; x++) { const v = L.at(x, 47); if (v !== -1 && v !== colorsFor(n).ol) below = true; }
                if (!feet) errors.push(tag + ': no foot on row 46');
                if (below) errors.push(tag + ': art below the feet line');
              }
            }
          });
        });
      });
    });
  });
  return { combos: combos, frames: frames, ms: Math.round(now() - t0), errors: errors.slice(0, 40), errorCount: errors.length };
}

function clearCache() { CACHE.clear(); ATLAS.clear(); built = 0; buildMs = 0; atlases = 0; }
function stats() { return { atlases: atlases, frameCanvases: CACHE.size, built: built, buildMs: Math.round(buildMs * 10) / 10 }; }

art3.person = person;
art3.drawPerson = drawPerson;
art3.drawPersonShadow = drawPersonShadow;
art3.portrait = portrait;
art3.randomLook = randomLook;
art3.look = look;
art3.lookOf = lookOf;
art3.personHands = personHands;
art3.people = Object.freeze({
  CELL: Object.freeze({ w: CW, h: CH, ax: AX, ay: CH, sitH: SIT_H, bust: BUST }),
  ATLAS: Object.freeze({ cols: ATLAS_COLS, rows: ATLAS_ROWS, frames: ATLAS_ORDER.length }),
  atlas: function (lookIn) { return atlasFor(resolveLook(lookIn)); },
  POSES: POSES, HAIRS: HAIRS, FACES: FACES, HATS: HATS, BODIES: BODIES, GUEST_SHIRTS: GUEST_SHIRTS,
  normLook: normLook, lookKey: lookKey, stateFor: stateFor,
  clipFrame: clipFrame, buildLook: buildLook, selfTest: selfTest,
  renderLayer: function (lookIn, pose, frame) { return renderLayer(resolveLook(lookIn), stateFor(pose, frame)); },
  clearCache: clearCache, stats: stats
});
})();
