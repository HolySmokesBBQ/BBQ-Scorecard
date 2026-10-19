'use strict';
/*
 * games/pit-sim/art3/fx.js  (v3 art library, effects and in-canvas UI)
 * Spec: docs/superpowers/specs/2026-10-18-pit-sim-art3-bible.md (sections 2, 3 and 5).
 * Target picture: docs/superpowers/mocks/pit-sim-v3/b-iso-pixel.png (mock B): its food bubbles,
 * heart, coin, "+8" and "+2 TIP", smoke columns. Font: the 5 x 7 glyph table of
 * docs/superpowers/mocks/pit-sim-v3/screen-1-season.html, plus "-" and "%".
 *
 * Load order: palette.js, then this file (any order among the four category files), then
 * index.js. Reads only PitSim.art3.PAL. Adds only to PitSim.art3:
 *   art3.fx              the effect set: build, has, frames, frame, draw, drawAt, and helpers
 *   art3.sets.fx         the same object, for index.js to merge with the other sets
 *   art3.text, art3.textTinted, art3.textWidth, art3.floatNum, art3.GLYPHS
 * Not loaded by the game yet; v3.4 swaps it in.
 *
 * Every size here is in render px (32 px tiles, 2 x sim px). Mock B's art px is 1.75 render px,
 * so a mock B sprite of n px is drawn here at about 1.75 n. Text is the one exception: in-yard
 * numbers draw the 5 x 7 font at scale 2, which lands within 15 percent of mock B on screen.
 *
 * Every frame is a cached canvas with {w, h, ax, ay}; the anchor is the bottom centre (bible 5).
 * Effects are opaque sprites; a caller that wants smoke at ALPHA.smokeNear sets globalAlpha.
 * Drawing is deterministic: the only randomness is one mulberry32 seeded per sprite name.
 */
(function () {
const PitSim = globalThis.PitSim || (globalThis.PitSim = {});
const art3 = PitSim.art3 || (PitSim.art3 = {});
const PAL = art3.PAL;
if (!PAL) throw new Error('art3 fx: palette.js must load first (PitSim.art3.PAL missing)');

const R = PAL.RAMP, OL = PAL.OL, UI = PAL.UI, A = PAL.ANCHOR;
const WHITE = UI.white;
const MEAT_IDS = ['sausage', 'chicken', 'ribs', 'butt', 'brisket'];
const DONENESS = ['done', 'raw', 'cooking', 'burnt'];   // icon frame order: frame 0 keeps v2's meaning

/* ================================================================ raster (pixel layer) */
// A layer is an Int32Array of packed RGB, -1 = transparent. Same algorithms as mock B's raster
// lib (ellipse, outline), so shapes match it pixel for pixel at equal radii.
const packCache = {};
function pack(c) {
  if (typeof c === 'number') return c;
  const v = packCache[c];
  if (v !== undefined) return v;
  if (!/^#[0-9a-fA-F]{6}$/.test(c)) throw new Error('art3 fx: bad colour "' + c + '"');
  return (packCache[c] = parseInt(c.slice(1), 16));
}
function Layer(w, h) {
  this.w = w; this.h = h;
  this.d = new Int32Array(w * h).fill(-1);
}
Layer.prototype.px = function (x, y, c) {
  x = Math.floor(x); y = Math.floor(y);
  if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
  this.d[y * this.w + x] = c === null ? -1 : pack(c);
};
Layer.prototype.get = function (x, y) {
  if (x < 0 || y < 0 || x >= this.w || y >= this.h) return -1;
  return this.d[y * this.w + x];
};
Layer.prototype.rect = function (x, y, w, h, c) {
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.px(x + i, y + j, c);
};
Layer.prototype.ellipse = function (cx, cy, rx, ry, c) {
  if (rx <= 0 || ry <= 0) return;
  for (let y = Math.floor(cy - ry - 1); y <= Math.ceil(cy + ry + 1); y++) {
    for (let x = Math.floor(cx - rx - 1); x <= Math.ceil(cx + rx + 1); x++) {
      const dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry;
      if (dx * dx + dy * dy <= 1) this.px(x, y, c);
    }
  }
};
// A grid of characters through a map { char: colour }. '.' and ' ' are transparent.
Layer.prototype.grid = function (rows, map, x, y) {
  for (let r = 0; r < rows.length; r++) {
    for (let k = 0; k < rows[r].length; k++) {
      const ch = rows[r][k];
      if (ch === '.' || ch === ' ') continue;
      this.px(x + k, y + r, map[ch]);
    }
  }
};
// 1 px outline, 4-neighbour, outside the silhouette only (bible 3).
Layer.prototype.outline = function (c) {
  const w = this.w, h = this.h, d = this.d, o = pack(c);
  const add = [];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const k = y * w + x;
      if (d[k] !== -1) continue;
      if ((x > 0 && d[k - 1] !== -1) || (x < w - 1 && d[k + 1] !== -1) ||
          (y > 0 && d[k - w] !== -1) || (y < h - 1 && d[k + w] !== -1)) add.push(k);
    }
  }
  for (let i = 0; i < add.length; i++) d[add[i]] = o;
  return this;
};
// Priority write: only overwrite a pixel whose rank is lower (fire tongues).
function rankPx(L, rank, x, y, c, r) {
  x = Math.floor(x); y = Math.floor(y);
  if (x < 0 || y < 0 || x >= L.w || y >= L.h) return;
  const k = y * L.w + x;
  if (rank[k] >= r) return;
  rank[k] = r; L.d[k] = pack(c);
}

function hashStr(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
function mulberry32(seed) {
  let a = seed | 0;
  return function () {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makeCanvas(w, h) {
  if (typeof document !== 'undefined' && document.createElement) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    return c;
  }
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(w, h);
  throw new Error('art3 fx: no canvas available (build() needs a DOM or OffscreenCanvas)');
}
// Paint a layer with one fillRect per horizontal run of a colour (v2's render path). Avoids
// putImageData, whose first call costs hundreds of ms on some software canvases and which can
// pin a canvas to the CPU on phones.
const hexCache = {};
function hexOf(v) {
  let s = hexCache[v];
  if (s === undefined) { s = '#' + (v | 0x1000000).toString(16).slice(1); hexCache[v] = s; }
  return s;
}
function toCanvas(L) {
  const c = makeCanvas(L.w, L.h);
  const g = c.getContext('2d');
  const d = L.d, w = L.w;
  for (let y = 0; y < L.h; y++) {
    let x = 0;
    while (x < w) {
      const v = d[y * w + x];
      if (v === -1) { x++; continue; }
      let x2 = x + 1;
      while (x2 < w && d[y * w + x2] === v) x2++;
      g.fillStyle = hexOf(v);
      g.fillRect(x, y, x2 - x, 1);
      x = x2;
    }
  }
  return c;
}
function flipCanvas(src) {
  const c = makeCanvas(src.width, src.height);
  const g = c.getContext('2d');
  g.translate(src.width, 0);
  g.scale(-1, 1);
  g.drawImage(src, 0, 0);
  return c;
}

/* ================================================================ font (screen-1 table) */
// 5 x 7 caps height; g j p q y and the comma drop 2 rows (9 rows). Ported verbatim from
// screen-1-season.html; "-" and "%" are new, drawn on the same grid.
const GLYPHS = {
  A: ['.###.', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  B: ['####.', '#...#', '#...#', '####.', '#...#', '#...#', '####.'],
  C: ['.###.', '#...#', '#....', '#....', '#....', '#...#', '.###.'],
  D: ['####.', '#...#', '#...#', '#...#', '#...#', '#...#', '####.'],
  E: ['#####', '#....', '#....', '####.', '#....', '#....', '#####'],
  F: ['#####', '#....', '#....', '####.', '#....', '#....', '#....'],
  G: ['.###.', '#...#', '#....', '#.###', '#...#', '#...#', '.####'],
  H: ['#...#', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  I: ['###', '.#.', '.#.', '.#.', '.#.', '.#.', '###'],
  J: ['..###', '...#.', '...#.', '...#.', '...#.', '#..#.', '.##..'],
  K: ['#...#', '#..#.', '#.#..', '##...', '#.#..', '#..#.', '#...#'],
  L: ['#....', '#....', '#....', '#....', '#....', '#....', '#####'],
  M: ['#...#', '##.##', '#.#.#', '#.#.#', '#...#', '#...#', '#...#'],
  N: ['#...#', '#...#', '##..#', '#.#.#', '#..##', '#...#', '#...#'],
  O: ['.###.', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  P: ['####.', '#...#', '#...#', '####.', '#....', '#....', '#....'],
  Q: ['.###.', '#...#', '#...#', '#...#', '#.#.#', '#..#.', '.##.#'],
  R: ['####.', '#...#', '#...#', '####.', '#.#..', '#..#.', '#...#'],
  S: ['.####', '#....', '#....', '.###.', '....#', '....#', '####.'],
  T: ['#####', '..#..', '..#..', '..#..', '..#..', '..#..', '..#..'],
  U: ['#...#', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  V: ['#...#', '#...#', '#...#', '#...#', '#...#', '.#.#.', '..#..'],
  W: ['#...#', '#...#', '#...#', '#.#.#', '#.#.#', '#.#.#', '.#.#.'],
  X: ['#...#', '#...#', '.#.#.', '..#..', '.#.#.', '#...#', '#...#'],
  Y: ['#...#', '#...#', '.#.#.', '..#..', '..#..', '..#..', '..#..'],
  Z: ['#####', '....#', '...#.', '..#..', '.#...', '#....', '#####'],
  a: ['.....', '.....', '.###.', '....#', '.####', '#...#', '.####'],
  b: ['#....', '#....', '####.', '#...#', '#...#', '#...#', '####.'],
  c: ['.....', '.....', '.###.', '#....', '#....', '#....', '.###.'],
  d: ['....#', '....#', '.####', '#...#', '#...#', '#...#', '.####'],
  e: ['.....', '.....', '.###.', '#...#', '#####', '#....', '.###.'],
  f: ['..##', '.#..', '####', '.#..', '.#..', '.#..', '.#..'],
  g: ['.....', '.....', '.####', '#...#', '#...#', '#...#', '.####', '....#', '.###.'],
  h: ['#....', '#....', '####.', '#...#', '#...#', '#...#', '#...#'],
  i: ['.#.', '...', '##.', '.#.', '.#.', '.#.', '###'],
  j: ['...#', '....', '..##', '...#', '...#', '...#', '...#', '#..#', '.##.'],
  k: ['#...', '#...', '#..#', '#.#.', '##..', '#.#.', '#..#'],
  l: ['##.', '.#.', '.#.', '.#.', '.#.', '.#.', '###'],
  m: ['.....', '.....', '##.#.', '#.#.#', '#.#.#', '#.#.#', '#.#.#'],
  n: ['.....', '.....', '####.', '#...#', '#...#', '#...#', '#...#'],
  o: ['.....', '.....', '.###.', '#...#', '#...#', '#...#', '.###.'],
  p: ['.....', '.....', '####.', '#...#', '#...#', '#...#', '####.', '#....', '#....'],
  q: ['.....', '.....', '.####', '#...#', '#...#', '#...#', '.####', '....#', '....#'],
  r: ['.....', '.....', '#.##.', '##..#', '#....', '#....', '#....'],
  s: ['.....', '.....', '.####', '#....', '.###.', '....#', '####.'],
  t: ['.#..', '.#..', '####', '.#..', '.#..', '.#.#', '..#.'],
  u: ['.....', '.....', '#...#', '#...#', '#...#', '#..##', '.##.#'],
  v: ['.....', '.....', '#...#', '#...#', '#...#', '.#.#.', '..#..'],
  w: ['.....', '.....', '#...#', '#...#', '#.#.#', '#.#.#', '.#.#.'],
  x: ['.....', '.....', '#...#', '.#.#.', '..#..', '.#.#.', '#...#'],
  y: ['.....', '.....', '#...#', '#...#', '#...#', '#...#', '.####', '....#', '.###.'],
  z: ['.....', '.....', '#####', '...#.', '..#..', '.#...', '#####'],
  '0': ['.###.', '#...#', '#..##', '#.#.#', '##..#', '#...#', '.###.'],
  '1': ['.#.', '##.', '.#.', '.#.', '.#.', '.#.', '###'],
  '2': ['.###.', '#...#', '....#', '...#.', '..#..', '.#...', '#####'],
  '3': ['####.', '....#', '....#', '.###.', '....#', '....#', '####.'],
  '4': ['...#.', '..##.', '.#.#.', '#..#.', '#####', '...#.', '...#.'],
  '5': ['#####', '#....', '####.', '....#', '....#', '#...#', '.###.'],
  '6': ['.###.', '#....', '#....', '####.', '#...#', '#...#', '.###.'],
  '7': ['#####', '....#', '...#.', '..#..', '.#...', '.#...', '.#...'],
  '8': ['.###.', '#...#', '#...#', '.###.', '#...#', '#...#', '.###.'],
  '9': ['.###.', '#...#', '#...#', '.####', '....#', '....#', '.###.'],
  '.': ['.', '.', '.', '.', '.', '.', '#'],
  ',': ['..', '..', '..', '..', '..', '.#', '.#', '#.'],
  ':': ['.', '.', '#', '.', '.', '#', '.'],
  '/': ['....#', '....#', '...#.', '..#..', '.#...', '#....', '#....'],
  '!': ['#', '#', '#', '#', '#', '.', '#'],
  '?': ['.###.', '#...#', '....#', '..##.', '..#..', '.....', '..#..'],
  '+': ['.....', '..#..', '..#..', '#####', '..#..', '..#..', '.....'],
  "'": ['#', '#', '.', '.', '.', '.', '.'],
  '-': ['....', '....', '....', '####', '....', '....', '....'],
  '%': ['##..#', '##..#', '...#.', '..#..', '.#...', '#..##', '#..##'],
  ' ': ['..', '..', '..', '..', '..', '..', '..']
};
const GLYPH_ROWS = 9;     // tallest glyph (descenders); caps are rows 0 to 6
const CAP_H = 7;

function glyphFor(ch) {
  if (Object.prototype.hasOwnProperty.call(GLYPHS, ch)) return GLYPHS[ch];
  const up = ch.toUpperCase();
  if (Object.prototype.hasOwnProperty.call(GLYPHS, up)) return GLYPHS[up];
  return null;   // unknown characters are skipped, as v2 does
}

/* ================================================================ grids (validated at load) */
// Characters per grid map to palette tones. Each grid is checked at load: equal row widths,
// every character in its map.
const COIN_MAP = { o: OL, h: R.coin.hi, b: R.coin.base, s: R.coin.shade, d: R.coin.dark };
const HEART_MAP = { o: OL, h: R.heart.hi, b: R.heart.base, s: R.heart.shade, w: WHITE };
const SPARK_MAP = { y: R.bulbs[0], w: UI.goldL, s: R.coin.shade };
const SWEAT_MAP = { o: R.glass.dark, s: R.glass.shade, b: R.glass.base, h: R.glass.hi, w: WHITE };
const ARROW_MAP = { o: OL, w: WHITE, h: R.coin.hi, b: R.coin.base, s: R.coin.shade, d: R.coin.dark };
const MARKX_MAP = { o: OL, h: R.coolerRed.hi, b: R.coolerRed.base, s: R.coolerRed.shade };

const GRIDS = {
  coin_face: { map: COIN_MAP, rows: [
    '....oooooo....',
    '..oossssssoo..',
    '.ossbbbbbbsso.',
    '.osbhhbbbbbso.',
    'osbhbbbddbbbso',
    'osbhbbbddbbbso',
    'osbbbbbddbbbso',
    'osbbbbbddbbbso',
    'osbbbbbddbbbso',
    'osbbbbbbbbbsdo',
    '.osbbbbbbbsdo.',
    '.ossbbbbbsddo.',
    '..oosdddddoo..',
    '....oooooo....'
  ] },
  coin_edge: { map: COIN_MAP, rows: [
    '.....oooo.....',
    '....ohbbso....',
    '....ohbbdo....',
    '....ohbbdo....',
    '....ohbbdo....',
    '....ohbbdo....',
    '....ohbbdo....',
    '....ohbbdo....',
    '....ohbbdo....',
    '....ohbbdo....',
    '....ohbbdo....',
    '....osbbdo....',
    '....osdddo....',
    '.....oooo.....'
  ] },
  coin_turn: { map: COIN_MAP, rows: [
    '.....oooo.....',
    '....osssso....',
    '...osbbbbso...',
    '...ohbbbbso...',
    '..ohbbddbbso..',
    '..ohbbddbbso..',
    '..ohbbddbbso..',
    '..ohbbddbbso..',
    '..ohbbddbbso..',
    '..osbbbbbbdo..',
    '...osbbbbdo...',
    '...ossbbddo...',
    '....osddo.....',
    '.....oooo.....'
  ] },
  heart_big: { map: HEART_MAP, rows: [
    '..ooo...ooo..',
    '.ohhbo.obbbo.',
    'ohwhbbobbbbso',
    'ohhbbbbbbbbso',
    'obhbbbbbbbbso',
    'obbbbbbbbbsso',
    '.obbbbbbbbso.',
    '..obbbbbbso..',
    '...obbbbso...',
    '....obbso....',
    '.....oso.....',
    '......o......'
  ] },
  heart_small: { map: HEART_MAP, rows: [
    '.............',
    '.............',
    '...ooo.ooo...',
    '..ohhbobbbo..',
    '..ohwbbbbso..',
    '..obbbbbbso..',
    '...obbbbso...',
    '....obbso....',
    '.....oso.....',
    '......o......',
    '.............',
    '.............'
  ] },
  spark_0: { map: SPARK_MAP, rows: [
    '...........',
    '...........',
    '...........',
    '...........',
    '.....y.....',
    '....ywy....',
    '.....y.....',
    '...........',
    '...........',
    '...........',
    '...........'
  ] },
  spark_1: { map: SPARK_MAP, rows: [
    '.....s.....',
    '.....y.....',
    '.....y.....',
    '....ywy....',
    '...yywyy...',
    'syyywwwyyys',
    '...yywyy...',
    '....ywy....',
    '.....y.....',
    '.....y.....',
    '.....s.....'
  ] },
  spark_2: { map: SPARK_MAP, rows: [
    '...........',
    '.y.......y.',
    'ywy.....ywy',
    '.y.......y.',
    '...........',
    '.....w.....',
    '...........',
    '.y.......y.',
    'ywy.....ywy',
    '.y.......y.',
    '...........'
  ] },
  sweat_drop: { map: SWEAT_MAP, rows: [
    '...o...',
    '..obo..',
    '.ohbbo.',
    '.ohbbo.',
    'ohwbbbo',
    'ohbbbso',
    'obbbbso',
    '.obsso.',
    '..ooo..'
  ] },
  sweat_splash: { map: SWEAT_MAP, rows: [
    '.......',
    '.......',
    '.......',
    '.o...o.',
    'oho.obo',
    '.o...o.',
    '.......',
    '.ohbbo.',
    '..ooo..'
  ] },
  arrow_down: { map: ARROW_MAP, rows: [
    '....oooooo....',
    '....owbbso....',
    '....ohbbso....',
    '....ohbbso....',
    '....ohbbso....',
    '....ohbbso....',
    '....ohbbso....',
    '....ohbbso....',
    'ooooohbbsooooo',
    'ohhhbbbbbbbsso',
    '.ohhbbbbbbbso.',
    '..ohbbbbbbso..',
    '...obbbbbdo...',
    '....obbbdo....',
    '.....obdo.....',
    '......oo......'
  ] },
  mark_x: { map: MARKX_MAP, rows: [
    '.oo......oo.',
    'ohbo....obso',
    'obbbo..obbso',
    '.obbboobbso.',
    '..obbbbbso..',
    '...obbbso...',
    '...obbbso...',
    '..obbbbbso..',
    '.obbsoobbso.',
    'obbso..obbso',
    'obso....obso',
    '.oo......oo.'
  ] }
};

function validateGrids() {
  Object.keys(GRIDS).forEach(function (name) {
    const g = GRIDS[name];
    if (!Array.isArray(g.rows) || g.rows.length === 0) throw new Error('art3 fx: grid ' + name + ' has no rows');
    const w = g.rows[0].length;
    g.rows.forEach(function (row, r) {
      if (row.length !== w) throw new Error('art3 fx: grid ' + name + ' row ' + r + ' is ' + row.length + ' wide, expected ' + w);
      for (let k = 0; k < row.length; k++) {
        const ch = row[k];
        if (ch === '.') continue;
        if (!Object.prototype.hasOwnProperty.call(g.map, ch)) throw new Error('art3 fx: grid ' + name + ' row ' + r + ' column ' + k + ': "' + ch + '" is not in its map');
        pack(g.map[ch]);
      }
    });
  });
  Object.keys(GLYPHS).forEach(function (ch) {
    const g = GLYPHS[ch];
    if (g.length < CAP_H || g.length > GLYPH_ROWS) throw new Error('art3 fx: glyph "' + ch + '" has ' + g.length + ' rows');
    const w = g[0].length;
    g.forEach(function (row, r) {
      if (row.length !== w) throw new Error('art3 fx: glyph "' + ch + '" row ' + r + ' is ' + row.length + ' wide, expected ' + w);
      if (!/^[.#]+$/.test(row)) throw new Error('art3 fx: glyph "' + ch + '" row ' + r + ' has a character other than . and #');
    });
  });
  ['-', '+', 'x', 'X', ':', '/', "'", '.'].forEach(function (ch) {
    if (!glyphFor(ch)) throw new Error('art3 fx: glyph "' + ch + '" missing');
  });
}
validateGrids();

function gridLayer(name, padX, padY, padB) {
  const g = GRIDS[name];
  const L = new Layer(g.rows[0].length + 2 * (padX || 0), g.rows.length + (padY || 0) + (padB || 0));
  L.grid(g.rows, g.map, padX || 0, padY || 0);
  return L;
}
function vflipRows(rows) { return rows.slice().reverse(); }

/* ================================================================ sprite makers */
// Each maker returns { L, ax, ay } for frame i. Anchor = bottom centre unless noted.
function framed(L, ax, ay) { return { L: L, ax: ax === undefined ? Math.floor(L.w / 2) : ax, ay: ay === undefined ? L.h : ay }; }

// White food bubble: mock B's 18 x 15 body at 1.75x (32 x 26), a 5 row tail leaning left of its
// tip, a 1 px bubbleEdge line one row above the bottom (as mock B), OL outline. Anchor = the
// pixel under the tail tip. The icon slot centre is (17, 14).
const BUBBLE = { w: 34, h: 33, tipX: 17, slotX: 17, slotY: 14 };
function bodyStair(L, x0, y0, w, h, c) {
  L.rect(x0 + 2, y0, w - 4, 1, c);
  L.rect(x0 + 1, y0 + 1, w - 2, 1, c);
  L.rect(x0, y0 + 2, w, h - 4, c);
  L.rect(x0 + 1, y0 + h - 2, w - 2, 1, c);
  L.rect(x0 + 2, y0 + h - 1, w - 4, 1, c);
}
function makeBubble() {
  const L = new Layer(BUBBLE.w, BUBBLE.h);
  bodyStair(L, 1, 1, 32, 26, WHITE);
  L.rect(2, 25, 30, 1, UI.bubbleEdge);
  const t = BUBBLE.tipX;
  L.rect(t - 3, 27, 4, 1, WHITE);
  L.rect(t - 3, 28, 4, 1, WHITE);
  L.rect(t - 2, 29, 3, 1, WHITE);
  L.rect(t - 1, 30, 2, 1, WHITE);
  L.px(t, 31, WHITE);
  L.outline(OL);
  return framed(L, t, BUBBLE.h);
}

// The same body without its tail (round 1): bubbleAt() draws the tail toward the owner so the
// body can slide sideways off a neighbour's head while the tail still points home.
function makeBubbleBody() {
  const L = new Layer(BUBBLE.w, BUBBLE.h);
  bodyStair(L, 1, 1, 32, 26, WHITE);
  L.rect(2, 25, 30, 1, UI.bubbleEdge);
  L.outline(OL);
  return framed(L, BUBBLE.tipX, BUBBLE.h);
}

// "!" warn bubble over a cooker about to burn: a small white bubble with a red bang (frame 0)
// and an orange one (frame 1), the v2 blink pair.
function makeWarn(i) {
  const L = new Layer(18, 23);
  bodyStair(L, 1, 1, 16, 17, WHITE);
  L.rect(2, 16, 14, 1, UI.bubbleEdge);
  L.rect(6, 18, 3, 1, WHITE); L.rect(6, 19, 3, 1, WHITE);
  L.rect(7, 20, 2, 1, WHITE); L.px(8, 21, WHITE);
  const hi = i === 0 ? R.coolerRed.hi : R.ember.hi;
  const base = i === 0 ? R.coolerRed.base : A.O;
  const shade = i === 0 ? R.coolerRed.shade : R.ember.dark;
  L.rect(7, 3, 4, 7, base); L.rect(8, 10, 2, 2, base);
  L.rect(7, 3, 1, 5, hi); L.rect(10, 4, 1, 6, shade); L.px(9, 11, shade);
  L.rect(7, 13, 4, 3, base); L.px(7, 13, hi); L.rect(10, 13, 1, 3, shade);
  L.outline(OL);
  return framed(L, 8, 23);
}

// Meat icons for bubbles and chips. 24 x 16 layer, centre (12, 8), OL outline. Frames:
// 0 done (v2 meaning), 1 raw, 2 cooking, 3 burnt.
function meatRamp(m, state) {
  const r = PAL.MEAT[m][state];
  const done = R[m];
  const burnt = state === 'burnt';
  return {
    hi: r.hi, base: r.base, shade: r.shade, dark: r.dark,
    bark: burnt ? R.charcoal.dark : (done.bark || r.dark),
    barkL: burnt ? r.base : (done.barkL || r.shade),
    ring: burnt ? r.hi : (state === 'raw' ? r.hi : (done.ring || r.hi)),
    fat: burnt ? r.hi : (done.fat || R.bone.base),
    bone: R.bone.base, boneHi: R.bone.hi, boneS: R.bone.shade
  };
}
const ICON = { w: 24, h: 16, cx: 12, cy: 8 };
function drawMeat(L, m, c, cx, cy, rnd) {
  if (m === 'sausage') {
    L.rect(cx - 9, cy - 3, 18, 6, c.base);
    L.rect(cx - 10, cy - 2, 20, 4, c.base);
    L.rect(cx - 8, cy - 2, 15, 1, c.hi);
    L.px(cx - 9, cy - 1, c.hi);
    L.rect(cx - 9, cy + 2, 18, 1, c.shade);
    L.px(cx + 9, cy + 1, c.shade);
    [-5, 0, 5].forEach(function (dx) { L.px(cx + dx, cy - 1, c.dark); L.px(cx + dx - 1, cy, c.dark); L.px(cx + dx - 2, cy + 1, c.dark); });
  } else if (m === 'chicken') {
    L.rect(cx + 3, cy + 1, 6, 2, c.bone);
    L.rect(cx + 8, cy - 1, 2, 2, c.bone); L.rect(cx + 8, cy + 3, 2, 2, c.bone);
    L.px(cx + 8, cy - 1, c.boneHi); L.rect(cx + 3, cy + 2, 5, 1, c.boneS);
    L.ellipse(cx - 2, cy, 7, 5.4, c.shade);
    L.ellipse(cx - 2.6, cy - 0.6, 6.2, 4.6, c.base);
    L.ellipse(cx - 4, cy - 2, 3.4, 2.1, c.hi);
    L.px(cx - 5, cy - 3, R.bone.hi);
    L.px(cx, cy + 2, c.dark); L.px(cx + 2, cy, c.dark);
  } else if (m === 'ribs') {
    L.rect(cx - 10, cy - 4, 20, 8, c.base);
    L.rect(cx - 10, cy - 4, 20, 2, c.hi);
    L.rect(cx - 10, cy + 3, 20, 1, c.shade);
    for (let k = 0; k < 5; k++) {
      const x = cx - 8 + k * 4;
      L.rect(x, cy - 4, 1, 8, c.dark);
      L.px(x, cy - 5, c.bone); L.px(x, cy + 4, c.bone);
    }
    L.px(cx - 10, cy - 4, null); L.px(cx + 9, cy - 4, null);
    L.px(cx - 10, cy + 3, null); L.px(cx + 9, cy + 3, null);
  } else if (m === 'brisket') {
    for (let k = 0; k < 3; k++) {
      const sx = cx - 9 + k * 6;
      L.rect(sx, cy - 4, 5, 9, c.base);
      L.rect(sx, cy - 4, 5, 2, c.bark);
      L.rect(sx, cy - 4, 2, 1, c.barkL);
      L.rect(sx, cy - 2, 5, 1, c.ring);
      L.rect(sx, cy + 4, 5, 1, c.fat);
      L.rect(sx + 4, cy - 1, 1, 5, c.shade);
      L.px(sx + 1, cy + 1, c.hi);
    }
  } else if (m === 'butt') {
    // pulled pork: a lumpy mound of shreds, bark bits and lit strands
    const blobs = [[cx - 5, cy + 1.5, 4.6, 3.4], [cx + 0.5, cy - 1, 5.2, 4.0], [cx + 5.5, cy + 1.5, 4.2, 3.2], [cx, cy + 2.5, 8.5, 2.6]];
    blobs.forEach(function (b) { L.ellipse(b[0], b[1], b[2], b[3], c.shade); });
    blobs.forEach(function (b) { L.ellipse(b[0] - 0.6, b[1] - 0.7, b[2] - 0.9, b[3] - 0.8, c.base); });
    for (let k = 0; k < 14; k++) {
      const x = cx - 8 + Math.floor(rnd() * 16), y = cy - 4 + Math.floor(rnd() * 8);
      const col = k % 3 === 0 ? c.bark : (k % 3 === 1 ? c.hi : c.dark);
      if (L.get(x, y) === -1 || L.get(x + 1, y - 1) === -1) continue;
      L.px(x, y, col); L.px(x + 1, y - 1, col);
      if (col === c.hi && L.get(x + 2, y - 2) !== -1) L.px(x + 2, y - 2, col);
    }
  }
}
function makeIcon(m, i) {
  const L = new Layer(ICON.w, ICON.h);
  drawMeat(L, m, meatRamp(m, DONENESS[i]), ICON.cx, ICON.cy, mulberry32(hashStr('icon_' + m)));
  L.outline(OL);
  return framed(L);
}

// Coin: 14 x 14 face (mock B's 8 x 8 at 1.75x), 0 face, 1 edge, 2 half turn (v2 frames 0, 1 kept).
function makeCoin(i) { return framed(gridLayer(['coin_face', 'coin_edge', 'coin_turn'][i])); }
// Heart: 0 full, 1 small (the v2 pulse pair).
function makeHeart(i) { return framed(gridLayer(i === 0 ? 'heart_big' : 'heart_small')); }
// Sparkle: 0 seed, 1 burst, 2 scatter. Flat (no outline), as mock B's sparkles.
function makeSparkle(i) { return framed(gridLayer('spark_' + i)); }
function makeSweat(i) { return framed(gridLayer(i === 0 ? 'sweat_drop' : 'sweat_splash')); }
function makeMarkX() { return framed(gridLayer('mark_x')); }

// Tutorial arrow: 0 down, 1 down bobbed 3 px, 2 up, 3 up bobbed (v2 order). 14 x 16 in 14 x 19.
function makeArrow(i) {
  const rows = GRIDS.arrow_down.rows;
  const g = i < 2 ? rows : vflipRows(rows);
  const L = new Layer(14, 19);
  const down = i < 2;
  const bob = i % 2 === 1 ? 3 : 0;
  L.grid(g, ARROW_MAP, 0, down ? bob : 3 - bob);
  return framed(L);
}

// ZZZ: OL-outlined white Zs drifting up and right. 0 one, 1 two, 2 three (v2 meaning).
function zShape(L, x, y, n) {
  L.rect(x, y, n, 1, WHITE);
  for (let k = 1; k < n - 1; k++) L.px(x + n - 1 - k, y + k, WHITE);
  L.rect(x, y + n - 1, n, 1, WHITE);
}
function makeZzz(i) {
  const L = new Layer(23, 21);
  zShape(L, 1, 14, 5);
  if (i >= 1) zShape(L, 7, 8, 6);
  if (i >= 2) zShape(L, 14, 1, 7);
  L.outline(OL);
  return framed(L);
}

// Smoke puffs, mock B's two-ellipse shading (shade body, lit body nudged up and left), a white
// highlight, outlined in the ramp's own ol. Sizes s, m, l; 3 wobble frames each.
const PUFF = {
  s: { w: 13, h: 12, blobs: [[6.5, 6.5, 4.6]] },
  m: { w: 19, h: 17, blobs: [[8, 10, 5.6], [12, 7, 4.2]] },
  l: { w: 26, h: 23, blobs: [[10, 14, 7.0], [17, 12, 5.6], [13, 7.5, 5.4]] }
};
function puffs(L, list, ramp) {
  list.forEach(function (b) { L.ellipse(b[0], b[1], b[2], b[2] * 0.9, ramp.shade); });
  list.forEach(function (b) { L.ellipse(b[0] - 0.7, b[1] - 0.7, b[2] - 1, b[2] * 0.9 - 1, ramp.base); });
  list.forEach(function (b) { if (b[2] >= 4) L.ellipse(b[0] - b[2] * 0.38, b[1] - b[2] * 0.42, b[2] * 0.32, b[2] * 0.22, ramp.hi); });
}
function makePuff(size, dark, i) {
  const P = PUFF[size];
  const ramp = dark ? R.smokeDark : R.smoke;
  const L = new Layer(P.w, P.h);
  const list = P.blobs.map(function (b, k) {
    const ph = i * 2.1 + k * 1.7;
    return [b[0] + Math.round(Math.sin(ph) * 0.8), b[1] + Math.round(Math.cos(ph) * 0.6), b[2] + (i === 1 ? 0.4 : (i === 2 ? -0.3 : 0))];
  });
  puffs(L, list, ramp);
  L.outline(PAL.outline(ramp));
  return framed(L);
}

// Smoke column over a vent: mock B's 7 puff column at 1.75x. 3 frames loop by sliding every
// puff a third of the way to the next slot. Anchor = the vent (the base puff's centre bottom).
const COLUMN = [[0, 0, 4.4], [3.5, -10.5, 6.1], [1.75, -22.75, 7.9], [8.75, -36.75, 9.6], [5.25, -52.5, 10.5], [14, -66.5, 8.75], [10.5, -78.75, 7]];
const COL_BOX = { w: 38, h: 98, vx: 9, vy: 91 };
// Round 2: the kettle's shorter column. Mock B gives the kettle the same puffy white stack as the
// drum; this one is about two thirds as tall with almost no sideways drift, so it rises straight
// out of the lid vent instead of trailing off as loose puffs.
const COLUMN_SHORT = [[0, 0, 4.0], [1, -8.5, 5.4], [0, -18, 6.8], [2, -29, 8.0], [1, -41, 8.6], [3, -53, 7.4], [2, -63, 5.6]];
const COL_SHORT_BOX = { w: 32, h: 82, vx: 12, vy: 75 };
function columnPuffs(f, spec) {
  const P = (spec || COLUMN).slice();
  const last = P[P.length - 1], prev = P[P.length - 2];
  P.push([last[0] * 2 - prev[0], last[1] * 2 - prev[1], last[2] * 0.45]);
  P.unshift([-0.5, 5, 1.8]);
  const u = f / 3, out = [];
  for (let k = 0; k < P.length - 1; k++) {
    const a = P[k], b = P[k + 1];
    out.push([a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, a[2] + (b[2] - a[2]) * u]);
  }
  return out;
}
function makeColumn(dark, f, short) {
  const ramp = dark ? R.smokeDark : R.smoke;
  const B = short ? COL_SHORT_BOX : COL_BOX;
  const L = new Layer(B.w, B.h);
  const list = columnPuffs(f, short ? COLUMN_SHORT : COLUMN).filter(function (p) { return p[2] >= 1.2; }).map(function (p) {
    return [B.vx + p[0], B.vy + p[1], p[2]];
  });
  puffs(L, list, ramp);
  L.outline(PAL.outline(ramp));
  return framed(L, B.vx, B.vy + 5);
}

// Fire: three flame tongues in the ember ramp, ranked so a hotter tone is never covered by a
// cooler one, outlined in ember dark. 3 flicker frames.
function makeFire(f) {
  const W = 15, H = 19, base = 17;
  const L = new Layer(W, H);
  const rank = new Int8Array(W * H);
  const tongues = [
    { x: 7.5, h: [15, 13, 16][f], w: 5.2, ph: 0.0 },
    { x: 4.2, h: [8, 10, 7][f], w: 2.8, ph: 1.3 },
    { x: 10.8, h: [10, 7, 9][f], w: 2.8, ph: 2.6 }
  ];
  tongues.slice(1).concat([tongues[0]]).forEach(function (tg) {
    for (let y = 0; y <= tg.h; y++) {
      const t = y / tg.h;
      const hw = tg.w * (t < 0.3 ? 0.78 + 0.22 * (t / 0.3) : Math.pow((1 - t) / 0.7, 0.85));
      const cxr = tg.x + Math.sin(tg.ph + f * 2.1 + t * 3.2) * 1.3 * t;
      for (let x = 0; x < W; x++) {
        const dx = Math.abs(x + 0.5 - cxr);
        if (dx > hw) continue;
        const rel = dx / Math.max(0.5, hw);
        if (rel < 0.45 && t < 0.62) rankPx(L, rank, x, base - y, R.ember.hi, 3);
        else if (rel < 0.8) rankPx(L, rank, x, base - y, R.ember.base, 2);
        else rankPx(L, rank, x, base - y, R.ember.shade, 1);
      }
    }
  });
  L.px(7, base - 1, UI.goldL); L.px(8, base - 2, UI.goldL);
  L.outline(R.ember.dark);
  return framed(L);
}

// Tap ring on a 32 x 32 tile: a 2 px rounded square, lit top left, outlined. 0 ok full,
// 1 ok corners, 2 miss full, 3 miss corners (v2 drew full then corners).
function makeRing(i) {
  const ramp = i < 2 ? R.coin : R.drum;
  const L = new Layer(32, 32);
  bodyStair(L, 1, 1, 30, 30, ramp.base);
  for (let y = 3; y < 29; y++) for (let x = 3; x < 29; x++) L.px(x, y, null);
  L.px(3, 3, ramp.base); L.px(28, 3, ramp.base); L.px(3, 28, ramp.base); L.px(28, 28, ramp.base);
  L.rect(3, 1, 26, 1, ramp.hi); L.rect(1, 3, 1, 26, ramp.hi);
  L.rect(3, 30, 26, 1, ramp.shade); L.rect(30, 3, 1, 26, ramp.shade);
  if (i % 2 === 1) {
    for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) {
      const nearX = x < 9 || x > 22, nearY = y < 9 || y > 22;
      if (!(nearX && nearY)) L.px(x, y, null);
    }
  }
  L.outline(OL);
  return framed(L);
}

// Rain: a 32 x 36 tile of falling streaks (3 frames, 12 px a frame, seamless over 36), and a
// 9 x 5 ground splash (3 frames). Flat, no outline; draw at about 0.8 alpha.
function makeRain(f) {
  const L = new Layer(32, 36);
  const rnd = mulberry32(hashStr('rain'));
  for (let k = 0; k < 7; k++) {
    const x = Math.floor(rnd() * 32), y0 = Math.floor(rnd() * 36), len = 4 + Math.floor(rnd() * 3);
    for (let j = 0; j < len; j++) {
      const y = (y0 + f * 12 + j) % 36;
      L.px(x, y, j === len - 1 ? R.glass.hi : (j < 2 ? R.glass.shade : R.glass.base));
    }
  }
  return framed(L, 16, 36);
}
function makeSplash(f) {
  const L = new Layer(9, 5);
  const c = WHITE, b = R.glass.hi;
  if (f === 0) { L.px(4, 3, c); L.px(3, 4, b); L.px(5, 4, b); }
  else if (f === 1) { L.px(2, 1, c); L.px(6, 1, c); L.px(1, 3, b); L.px(7, 3, b); L.rect(3, 4, 3, 1, b); }
  else { L.px(0, 0, b); L.px(8, 0, b); L.px(1, 4, b); L.px(7, 4, b); }
  return framed(L);
}

/* ================================================================ the set */
const DEF = {};
function def(name, n, make) { DEF[name] = { n: n, make: make }; }

def('bubble', 1, makeBubble);
def('bubble_body', 1, makeBubbleBody);
def('bubble_warn', 2, makeWarn);
MEAT_IDS.forEach(function (m) { def('icon_' + m, 4, function (i) { return makeIcon(m, i); }); });
def('mark_x', 1, makeMarkX);
def('coin', 3, makeCoin);
def('heart', 2, makeHeart);
def('sparkle', 3, makeSparkle);
['s', 'm', 'l'].forEach(function (s) {
  def('smoke_' + s, 3, function (i) { return makePuff(s, false, i); });
  def('smoke_dark_' + s, 3, function (i) { return makePuff(s, true, i); });
});
def('smoke', 3, function (i) { return makePuff(['s', 'm', 'l'][i], false, 0); });       // v2: grows with age
def('smoke_dark', 3, function (i) { return makePuff(['s', 'm', 'l'][i], true, 0); });
def('smoke_column', 3, function (i) { return makeColumn(false, i); });
def('smoke_column_dark', 3, function (i) { return makeColumn(true, i); });
def('smoke_column_short', 3, function (i) { return makeColumn(false, i, true); });
def('smoke_column_short_dark', 3, function (i) { return makeColumn(true, i, true); });
def('fire', 3, makeFire);
def('sweat', 2, makeSweat);
def('zzz', 3, makeZzz);
def('arrow', 4, makeArrow);
def('tap_ring', 4, makeRing);
def('rain', 3, makeRain);
def('rain_splash', 3, makeSplash);

let built = false;
let buildMs = 0;
const SPR = {};       // name -> [{w, h, ax, ay, canvas}]
const FLIP = {};      // name -> [canvas], filled on first flipped draw

function build() {
  if (built) return;
  const t0 = (typeof performance !== 'undefined' ? performance.now() : Date.now());
  Object.keys(DEF).forEach(function (name) {
    const d = DEF[name], list = [];
    for (let i = 0; i < d.n; i++) {
      const r = d.make(i);
      list.push(Object.freeze({ w: r.L.w, h: r.L.h, ax: r.ax, ay: r.ay, canvas: toCanvas(r.L) }));
    }
    SPR[name] = list;
  });
  built = true;
  buildMs = (typeof performance !== 'undefined' ? performance.now() : Date.now()) - t0;
}
function has(name) { return Object.prototype.hasOwnProperty.call(DEF, name); }
function frames(name) { return has(name) ? DEF[name].n : 0; }
function names() { return Object.keys(DEF); }
function frameIndex(name, frame) {
  const n = DEF[name].n;
  const f = Math.trunc(Number(frame) || 0);
  return ((f % n) + n) % n;
}
function frame(name, f) {
  if (!has(name)) throw new Error('art3 fx: unknown sprite "' + name + '"');
  if (!built) build();
  return SPR[name][frameIndex(name, f)];
}
function canvasOf(name, f, flip) {
  const fr = frame(name, f);
  if (!flip) return fr.canvas;
  const i = frameIndex(name, f);
  const list = FLIP[name] || (FLIP[name] = []);
  return list[i] || (list[i] = flipCanvas(fr.canvas));
}
// Top left placement, as v2's art.draw.
function draw(ctx, name, x, y, f, flip) {
  ctx.drawImage(canvasOf(name, f, flip === true), Math.round(x), Math.round(y));
}
// Anchor placement (bible 5): the frame's anchor lands on (ax, ay); a flip mirrors about ax.
function drawAt(ctx, name, ax, ay, f, flip) {
  const fr = frame(name, f);
  const x = flip === true ? ax - (fr.w - fr.ax) : ax - fr.ax;
  ctx.drawImage(canvasOf(name, f, flip === true), Math.round(x), Math.round(ay - fr.ay));
}
function anchor(name, f) { const fr = frame(name, f); return { ax: fr.ax, ay: fr.ay, w: fr.w, h: fr.h }; }

/* ================================================================ composite helpers */
const STATE_FRAME = { done: 0, raw: 1, cooking: 2, burnt: 3 };
// Food bubble with a meat icon, tail tip at (ax, ay). meat may be a meat id, 'x' (walk-out
// mark) or null (empty bubble). state picks the doneness frame (default done).
function bubble(ctx, ax, ay, meat, state) {
  drawAt(ctx, 'bubble', ax, ay, 0);
  if (!meat) return;
  const left = ax - BUBBLE.tipX, top = ay - BUBBLE.h;
  const name = meat === 'x' ? 'mark_x' : 'icon_' + meat;
  const fr = frame(name, meat === 'x' ? 0 : (STATE_FRAME[state] || 0));
  ctx.drawImage(fr.canvas, left + BUBBLE.slotX - Math.floor(fr.w / 2), top + BUBBLE.slotY - Math.floor(fr.h / 2));
}

// Round 1: a bubble whose body sits bodyDx px to the side of its tail. The tail tip is at
// (tipX, tipY), at least 2 px above the owner's head; the 5 row tail leans from the body to the tip.
const TAIL_W = [4, 4, 3, 2, 1];
function bubbleAt(ctx, tipX, tipY, bodyDx, meat, state) {
  const dx = Math.round(bodyDx || 0);
  const left = Math.round(tipX + dx - BUBBLE.tipX), top = Math.round(tipY) + 2 - BUBBLE.h;
  draw(ctx, 'bubble_body', left, top, 0);
  const baseX = Math.max(left + 7, Math.min(left + 27, tipX + Math.round(dx * 0.35)));
  const rows = [];
  for (let k = 0; k < 5; k++) {
    const cx = Math.round(baseX + (tipX - baseX) * k / 4), w = TAIL_W[k];
    rows.push([cx - (w >> 1) - (w === 4 ? 1 : 0), top + 27 + k, w]);
  }
  ctx.fillStyle = OL;
  rows.forEach(function (r, k) { ctx.fillRect(r[0] - 1, r[1], r[2] + 2, 1); if (k === 4) ctx.fillRect(r[0], r[1] + 1, r[2], 1); });
  ctx.fillStyle = WHITE;
  rows.forEach(function (r) { ctx.fillRect(r[0], r[1], r[2], 1); });
  if (!meat) return { x: left, y: top, w: BUBBLE.w, h: BUBBLE.h };
  const name = meat === 'x' ? 'mark_x' : 'icon_' + meat;
  const fr = frame(name, meat === 'x' ? 0 : (STATE_FRAME[state] || 0));
  ctx.drawImage(fr.canvas, left + BUBBLE.slotX - Math.floor(fr.w / 2), top + BUBBLE.slotY - Math.floor(fr.h / 2));
  return { x: left, y: top, w: BUBBLE.w, h: BUBBLE.h };
}
// Lays out bubbles so none covers another head or bubble. list: [{ x, headTop, meat, state }]
// (owner's centre x and the top row of the owner's head); heads: [{ x, y, w, h }] rects to keep
// clear (every visible head, the owners' included); bounds: { x0, x1 } canvas columns to stay in.
// Returns [{ tipX, tipY, dx, rect }]: tip 2 px over the head, body slid by dx (0 if it fits).
function placeBubbles(list, heads, bounds) {
  const b = bounds || { x0: 0, x1: 1e9 };
  const placed = [];
  const hit = function (r, q) { return r.x < q.x + q.w && q.x < r.x + r.w && r.y < q.y + q.h && q.y < r.y + r.h; };
  return list.map(function (it, i) {
    const tipX = Math.round(it.x), tipY = Math.round(it.headTop) - 3;
    const tries = [0, -8, 8, -14, 14, -20, 20, -26, 26];
    let best = null;
    for (let t = 0; t < tries.length; t++) {
      let dx = tries[t];
      const lo = b.x0 + 1 - (tipX - BUBBLE.tipX), hi = b.x1 - 1 - (tipX - BUBBLE.tipX + BUBBLE.w);
      dx = Math.max(lo, Math.min(hi, dx));
      const r = { x: tipX + dx - BUBBLE.tipX, y: tipY + 2 - BUBBLE.h, w: BUBBLE.w, h: BUBBLE.h - 6 };
      const clash = heads.some(function (h) { return !(Math.abs(h.x + h.w / 2 - it.x) < 2 && Math.abs(h.y - it.headTop) < 2) && hit(r, h); }) ||
        placed.some(function (p) { return hit(r, p); });
      if (!clash) { best = { tipX: tipX, tipY: tipY, dx: dx, rect: r }; break; }
      if (!best) best = { tipX: tipX, tipY: tipY, dx: dx, rect: r, clash: true };
    }
    placed.push(best.rect);
    return best;
  });
}

// Patience bar: OL frame, near black tray, fill green above half, gold above a quarter, red
// below, a 1 px lit line on the fill. (x, y) top left; default 24 x 6. Five fillRects at most.
function patienceBar(ctx, x, y, frac, w, h) {
  const W = w || 24, H = h || 6;
  const f = Math.max(0, Math.min(1, Number(frac) || 0));
  const ramp = f > 0.5 ? R.lawnA : (f > 0.25 ? R.coin : R.drum);
  ctx.fillStyle = OL; ctx.fillRect(x, y, W, H);
  ctx.fillStyle = A.K; ctx.fillRect(x + 1, y + 1, W - 2, H - 2);
  const fw = Math.round((W - 2) * f);
  if (fw > 0) {
    ctx.fillStyle = ramp.base; ctx.fillRect(x + 1, y + 1, fw, H - 2);
    ctx.fillStyle = ramp.hi; ctx.fillRect(x + 1, y + 1, fw, 1);
    if (H > 4) { ctx.fillStyle = ramp.shade; ctx.fillRect(x + 1, y + H - 2, fw, 1); }
  }
}

// Tap ring over tile top left (x, y). age01 in 0..1: full ring for the first 60 percent, then
// corners (v2 timing). reduced keeps the full ring.
function tapRing(ctx, x, y, ok, age01, reduced) {
  const corners = !reduced && age01 >= 0.6;
  draw(ctx, 'tap_ring', x, y, (ok ? 0 : 2) + (corners ? 1 : 0));
}

// Rain over a rect: tiles the rain sprite; frame from the caller's clock (6 fps suits it).
function rain(ctx, x, y, w, h, f) {
  const c = canvasOf('rain', f, false);
  for (let yy = y - (36 - (h % 36 || 36)); yy < y + h; yy += 36) {
    for (let xx = x; xx < x + w; xx += 32) ctx.drawImage(c, xx, yy);
  }
}

/* ================================================================ text */
// A string is rendered once per (text, colour, options) into a cached canvas: layer pixels,
// optional 1 px drop shadow, optional 1 px 4-neighbour outline (mock B's floatText), then drawn
// with one drawImage, scaled by an integer with smoothing off. Cache capped at 256 strings.
const TEXT_CACHE = new Map();
const TEXT_CACHE_MAX = 256;
function resolveColour(c, fallback) {
  if (c === undefined || c === null) return fallback;
  if (typeof c === 'string' && c.charAt(0) === '#') return c;
  if (c === 'outline' || c === 'OL') return OL;
  if (Object.prototype.hasOwnProperty.call(A, c)) return A[c];
  if (Object.prototype.hasOwnProperty.call(UI, c)) return UI[c];
  throw new Error('art3 fx: unknown colour "' + c + '"');
}
function glyphAdvance(g, bold) { return g[0].length + 1 + (bold ? 1 : 0); }
function textWidth(str, opts) {
  const o = opts || {};
  const s = String(str), bold = !!o.bold, sc = Math.max(1, Math.trunc(o.scale || 1));
  let w = 0, any = false;
  for (const ch of s) { const g = glyphFor(ch); if (g) { w += glyphAdvance(g, bold); any = true; } }
  return any ? (w - 1) * sc : 0;
}
function renderText(str, colour, o) {
  const bold = !!o.bold;
  const shadow = o.shadow ? resolveColour(o.shadow) : null;
  const outl = o.outline ? resolveColour(o.outline) : null;
  const key = str + '\u0001' + colour + '\u0001' + (bold ? 1 : 0) + '\u0001' + (shadow || '') + '\u0001' + (outl || '');
  let hit = TEXT_CACHE.get(key);
  if (hit) { TEXT_CACHE.delete(key); TEXT_CACHE.set(key, hit); return hit; }
  const pad = (outl || shadow) ? 1 : 0;
  const w = textWidth(str, { bold: bold }) + (bold ? 1 : 0);
  const L = new Layer(Math.max(1, w + 2 * pad), GLYPH_ROWS + 2 * pad);
  function pass(dy, c) {
    let cx = pad;
    for (const ch of str) {
      const g = glyphFor(ch);
      if (!g) continue;
      for (let r = 0; r < g.length; r++) for (let k = 0; k < g[r].length; k++) {
        if (g[r][k] !== '#') continue;
        L.px(cx + k, pad + r + dy, c);
        if (bold) L.px(cx + k + 1, pad + r + dy, c);
      }
      cx += glyphAdvance(g, bold);
    }
  }
  if (shadow) pass(1, shadow);
  pass(0, colour);
  if (outl) L.outline(outl);
  hit = { canvas: toCanvas(L), pad: pad, w: w };
  TEXT_CACHE.set(key, hit);
  if (TEXT_CACHE.size > TEXT_CACHE_MAX) TEXT_CACHE.delete(TEXT_CACHE.keys().next().value);
  return hit;
}
// art3.text(ctx, str, x, y, color, opts): (x, y) is the top left of the caps. color is a hex,
// an ANCHOR key (K U C O), a UI key (gold, tip, white ...) or 'outline'; default cream.
// opts: { scale (integer, default 1), bold, shadow (colour), outline (colour), align
// ('left' | 'center' | 'right') }. Case is kept (the table has lower case); a character with
// no glyph falls back to its upper case, then is skipped. Returns the advance width.
function text(ctx, str, x, y, color, opts) {
  const o = opts || {};
  const s = String(str);
  const sc = Math.max(1, Math.trunc(o.scale || 1));
  const tw = textWidth(s, { bold: o.bold, scale: sc });
  if (o.align === 'center') x = Math.round(x - tw / 2);
  else if (o.align === 'right') x = Math.round(x - tw);
  if (tw === 0) return 0;
  const t = renderText(s, resolveColour(color, A.C), o);
  const prev = ctx.imageSmoothingEnabled;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(t.canvas, Math.round(x - t.pad * sc), Math.round(y - t.pad * sc), t.canvas.width * sc, t.canvas.height * sc);
  ctx.imageSmoothingEnabled = prev;
  return tw;
}
// v2 shape: textTinted(ctx, str, x, y, colorKey). Upper-cases like v2's text did.
function textTinted(ctx, str, x, y, colorKey, opts) {
  return text(ctx, String(str).toUpperCase(), x, y, resolveColour(colorKey), opts);
}

// Floating numbers, mock B's "+8" and "+2 TIP": bold 5 x 7 at scale 2, 1 px OL outline per
// glyph pixel (2 render px on screen). (x, y) is the top left of the text, as v2's popText.
// kind: 'cash' (gold, coin to the left, as mock B's coin + 8), 'tip' (green), 'fan' (pink,
// heart to the left), 'xp' (pale blue), 'bad' (red, for a loss or a burn), 'plain' (cream).
// opts.box draws the text on an umber chip with an OL edge (the farm sim's boxed number).
// Returns the text width. Two drawImage calls, three with an icon.
const FLOAT = {
  cash: { c: UI.gold, icon: 'coin' },
  tip: { c: UI.tip },
  fan: { c: R.heart.hi, icon: 'heart' },
  xp: { c: R.glass.hi },
  bad: { c: R.drum.hi },
  plain: { c: A.C }
};
function floatNum(ctx, str, x, y, kind, opts) {
  const k = FLOAT[kind] || FLOAT.cash;
  const o = opts || {};
  const s = String(str);
  const tw = textWidth(s, { bold: true, scale: 2 });
  // opts.clamp [x0, x1]: keep the text (and its icon) at least 4 px inside those columns (round 1)
  if (o.clamp) {
    const iw = k.icon ? frame(k.icon, 0).w + 3 : 0;
    x = Math.max(o.clamp[0] + 4 + iw, Math.min(o.clamp[1] - 4 - tw - 2, x));
  }
  if (o.box) {
    const iw = k.icon ? frame(k.icon, 0).w + 3 : 0;
    ctx.fillStyle = OL; ctx.fillRect(x - 5 - iw, y - 5, tw + 12 + iw, CAP_H * 2 + 10);
    ctx.fillStyle = A.U; ctx.fillRect(x - 4 - iw, y - 4, tw + 10 + iw, CAP_H * 2 + 8);
    ctx.fillStyle = UI.umber2; ctx.fillRect(x - 4 - iw, y - 4, tw + 10 + iw, 1);
  }
  if (k.icon) {
    const fr = frame(k.icon, 0);
    ctx.drawImage(fr.canvas, Math.round(x - fr.w - 3), Math.round(y + CAP_H - Math.ceil(fr.h / 2)));
  }
  text(ctx, s, x, y, k.c, { scale: 2, bold: true, outline: o.box ? null : OL });
  return tw;
}

/* ================================================================ register */
const fx = {
  TILE: 32,
  MEAT_IDS: MEAT_IDS.slice(),
  BUBBLE: Object.freeze({ w: BUBBLE.w, h: BUBBLE.h, tipX: BUBBLE.tipX, slotX: BUBBLE.slotX, slotY: BUBBLE.slotY }),
  build: build,
  has: has,
  frames: frames,
  names: names,
  frame: frame,
  canvasOf: canvasOf,
  draw: draw,
  drawAt: drawAt,
  anchor: anchor,
  bubble: bubble,
  bubbleAt: bubbleAt,
  placeBubbles: placeBubbles,
  patienceBar: patienceBar,
  tapRing: tapRing,
  rain: rain,
  text: text,
  textTinted: textTinted,
  textWidth: textWidth,
  floatNum: floatNum,
  validate: validateGrids
};
Object.defineProperty(fx, 'built', { enumerable: true, get: function () { return built; } });
Object.defineProperty(fx, 'buildMs', { enumerable: true, get: function () { return buildMs; } });

art3.fx = fx;
art3.sets = art3.sets || {};
art3.sets.fx = fx;
art3.GLYPHS = GLYPHS;
art3.text = text;
art3.textTinted = textTinted;
art3.textWidth = textWidth;
art3.floatNum = floatNum;
})();
