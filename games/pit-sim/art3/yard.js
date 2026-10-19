// games/pit-sim/art3/yard.js
// Your Pit v3 art library: ground and set dressing (the yard category).
// Spec: docs/superpowers/specs/2026-10-18-pit-sim-art3-bible.md (sections 1 to 6).
// Target look: docs/superpowers/mocks/pit-sim-v3/b-iso-pixel.png (mock B), redrawn in the iso view
// hybrid on the 32 px orthogonal grid (art3/proj.js).
//
// Registers PitSim.art3.yard (the v2 PitSim.art shape: build, has, frames, draw, drawScaled,
// canvasFor, plus drawAt, drawTile, placeTile, anchor, size, pick), and the two shared entry points
// PitSim.art3.ground(ctx, map, opts) and PitSim.art3.signText(ctx, text, x, y).
// Depends on palette.js only (PitSim.art3.PAL). Uses PitSim.art3.proj when present, else the same
// box math inline. Deterministic: every seeded choice comes from mulberry32 seeded by sprite name.
// Not loaded by the game until v3.4.
(function () {
'use strict';
const G = typeof globalThis !== 'undefined' ? globalThis : window;
const PitSim = G.PitSim = G.PitSim || {};
const art3 = PitSim.art3 = PitSim.art3 || {};
const PAL = art3.PAL;
if (!PAL) throw new Error('art3 yard: palette.js must load before yard.js');

const R = PAL.RAMP, AL = PAL.ALPHA, OL = PAL.OL, ANCHOR = PAL.ANCHOR, UI = PAL.UI;
const TILE = 32;
const SIDE = 8, RISE = 4;

/* ================================================================ projection (proj.js, shared with kit) */
const PROJ = art3.proj;
if (!PROJ || typeof PROJ.isoFaces !== 'function') throw new Error('art3 yard: load proj.js before yard.js');
function rowKey(row) { return row * TILE + 30; }

/* ================================================================ seeded random */
function strSeed(s) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
  return h;
}
function mulberry(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function hash2(x, y, s) {
  let h = Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(s | 0, 2147483647);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/* ================================================================ raster core */
// Pixels are ABGR uint32 (canvas ImageData byte order on little endian). 0 = empty.
const CC = Object.create(null);
function col(c) {
  let v = CC[c];
  if (v !== undefined) return v;
  const n = parseInt(c.slice(1), 16);
  v = (0xff000000 | ((n & 255) << 16) | (n & 0xff00) | ((n >> 16) & 255)) >>> 0;
  CC[c] = v;
  return v;
}
function acol(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return ((Math.round(a * 255) << 24) | ((n & 255) << 16) | (n & 0xff00) | ((n >> 16) & 255)) >>> 0;
}
function solid(v) { return (v >>> 24) === 255; }

let SW = 0, SH = 0, MAIN = null, T = null, OX = 0, OY = 0;
let CLIP = [0, 0, 0, 0];
function surface(w, h) { SW = w; SH = h; MAIN = new Uint32Array(w * h); T = MAIN; OX = 0; OY = 0; CLIP = [0, 0, w, h]; }
function clipLocal(x, y, w, h) { CLIP = [Math.max(0, x + OX), Math.max(0, y + OY), Math.min(SW, x + OX + w), Math.min(SH, y + OY + h)]; }
function unclip() { CLIP = [0, 0, SW, SH]; }
function pxv(x, y, v) {
  x = Math.floor(x) + OX; y = Math.floor(y) + OY;
  if (x < CLIP[0] || y < CLIP[1] || x >= CLIP[2] || y >= CLIP[3]) return;
  T[y * SW + x] = v;
}
function px(x, y, c) { pxv(x, y, col(c)); }
function erase(x, y) { pxv(x, y, 0); }
function rect(x, y, w, h, c) { const v = col(c); for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) pxv(x + i, y + j, v); }
function hline(x, y, w, c) { rect(x, y, w, 1, c); }
function vline(x, y, h, c) { rect(x, y, 1, h, c); }
function poly(pts, c) {
  const v = col(c);
  let minY = Infinity, maxY = -Infinity;
  for (const p of pts) { if (p[1] < minY) minY = p[1]; if (p[1] > maxY) maxY = p[1]; }
  for (let y = Math.floor(minY); y < Math.ceil(maxY); y++) {
    const yc = y + 0.5, xs = [];
    for (let k = 0; k < pts.length; k++) {
      const a = pts[k], b = pts[(k + 1) % pts.length];
      if ((a[1] <= yc && b[1] > yc) || (b[1] <= yc && a[1] > yc)) xs.push(a[0] + (yc - a[1]) * (b[0] - a[0]) / (b[1] - a[1]));
    }
    xs.sort(function (p, q) { return p - q; });
    for (let k = 0; k + 1 < xs.length; k += 2) {
      const xa = Math.ceil(xs[k] - 0.5), xb = Math.ceil(xs[k + 1] - 0.5);
      for (let x = xa; x < xb; x++) pxv(x, y, v);
    }
  }
}
function ellipse(cx, cy, rx, ry, c) {
  const v = col(c);
  for (let y = Math.floor(cy - ry - 1); y <= Math.ceil(cy + ry + 1); y++) {
    for (let x = Math.floor(cx - rx - 1); x <= Math.ceil(cx + rx + 1); x++) {
      const dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry;
      if (dx * dx + dy * dy <= 1) pxv(x, y, v);
    }
  }
}
function line(x0, y0, x1, y1, c) {
  const v = col(c);
  x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
  const dx = Math.abs(x1 - x0), sx = x0 < x1 ? 1 : -1, dy = -Math.abs(y1 - y0), sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  for (;;) {
    pxv(x0, y0, v);
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x0 += sx; }
    if (e2 <= dx) { err += dx; y0 += sy; }
  }
}
// Shadow pixels: the K anchor at an ALPHA level, only where the current layer is still empty.
function shadowEll(cx, cy, rx, ry, al) {
  const v = acol(al.rgb, al.a);
  for (let y = Math.floor(cy - ry - 1); y <= Math.ceil(cy + ry + 1); y++) {
    for (let x = Math.floor(cx - rx - 1); x <= Math.ceil(cx + rx + 1); x++) {
      const dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry;
      if (dx * dx + dy * dy > 1) continue;
      const X = x + OX, Y = y + OY;
      if (X < CLIP[0] || Y < CLIP[1] || X >= CLIP[2] || Y >= CLIP[3]) continue;
      if (T[Y * SW + X] === 0) T[Y * SW + X] = v;
    }
  }
}
function shadowRect(x, y, w, h, al) {
  const v = acol(al.rgb, al.a);
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const X = x + i + OX, Y = y + j + OY;
    if (X < CLIP[0] || Y < CLIP[1] || X >= CLIP[2] || Y >= CLIP[3]) continue;
    if (T[Y * SW + X] === 0) T[Y * SW + X] = v;
  }
}
// One solid object: draw into a fresh layer, then outline (4 neighbour, outside only) and merge.
function beginObj() { T = new Uint32Array(SW * SH); }
function endObj(ol) {
  const L = T; T = MAIN;
  if (ol) {
    const o = col(ol);
    for (let y = 0; y < SH; y++) for (let x = 0; x < SW; x++) {
      const k = y * SW + x;
      if (solid(L[k])) continue;
      if ((x > 0 && solid(L[k - 1])) || (x < SW - 1 && solid(L[k + 1])) ||
          (y > 0 && solid(L[k - SW])) || (y < SH - 1 && solid(L[k + SW]))) MAIN[k] = o;
    }
  }
  for (let k = 0; k < L.length; k++) {
    const v = L[k];
    if (v === 0) continue;
    if (solid(v) || MAIN[k] === 0) MAIN[k] = v;
  }
}
// Read the current layer (tile local coordinates).
function at(x, y) {
  const X = Math.floor(x) + OX, Y = Math.floor(y) + OY;
  if (X < 0 || Y < 0 || X >= SW || Y >= SH) return 0;
  return T[Y * SW + X];
}
function toCanvas() {
  const c = document.createElement('canvas');
  c.width = SW; c.height = SH;
  const g = c.getContext('2d');
  const img = g.createImageData(SW, SH);
  img.data.set(new Uint8ClampedArray(MAIN.buffer));
  g.putImageData(img, 0, 0);
  return c;
}

/* ================================================================ the iso box painter (round 1) */
// The same geometry as kit.js (proj.js isoFaces): rhombus top with 2:1 edges, lit left face, shaded
// right face, the rim 1 px inside the top's two front edges.
function isoBox(P, u0, v0, u1, v1, z0, h, r, o) {
  o = o || {};
  const f = PROJ.isoFaces(P, u0, v0, u1, v1, z0, h);
  if (h > 0) { poly(f.left, o.left || r.base); poly(f.right, o.right || r.shade); }
  poly(f.top, o.top || r.hi);
  if (o.rim !== false && u1 - u0 >= 4 && v1 - v0 >= 4) {
    const rc = o.rimC || r.rim || r.hi, lt = f.leftTop, ft = f.frontTop, rt = f.rightTop;
    for (let x = lt[0] + 1; x < ft[0]; x++) px(x, Math.floor(lt[1] + (x - lt[0]) / 2) - 1, rc);
    for (let x = ft[0]; x < rt[0] - 1; x++) px(x, Math.floor(ft[1] - (x - ft[0]) / 2) - 1, rc);
  }
  return f;
}
// A 2:1 stair (mock B isoLine): n steps from (x0, y0), dir +1 right and down, -1 left and down.
function isoLine(x0, y0, n, dir, c) {
  for (let k = 0; k < n; k++) { px(x0 + dir * 2 * k, y0 + k, c); px(x0 + dir * (2 * k + 1), y0 + k, c); }
}
// Small props placed by an old style span: x0..x0 + w + 8 wide, front vertex on yb, height h. noSide
// pieces (tiled hedge runs, chair arms) stay flat: a front face and a top strip, no side face.
function obox(x0, yb, w, h, d, r, o) {
  o = o || {};
  if (o.noSide) {
    if (h > 0) rect(x0, yb - h, w, h, o.front || r.base);
    if (d > 0) { rect(x0, yb - h - d, w, d, o.top || r.hi); if (o.rim !== false) hline(x0, yb - h - 1, w, o.rimC || r.rim || r.hi); }
    if (o.band) { vline(x0 + w - 1, yb - h, h, r.shade); hline(x0, yb - 1, w, r.shade); }
    return null;
  }
  const W = w + 8, U = Math.max(2, Math.round(W / 4) * 2), V = U;
  const fx = x0 + Math.round(W / 2);
  const P = PROJ.isoP(fx - (U - V), yb - (U + V) / 2);
  return isoBox(P, 0, 0, U, V, 0, h, r, { left: o.front, right: o.side, top: o.top, rim: o.rim, rimC: o.rimC });
}

/* ================================================================ sprite registry */
// def: name, canvas w and h, (ox, oy) canvas position of the tile local origin, (gx, gy) the anchor
// in tile local coordinates (bottom centre of the footprint), frame count, painter(f, rnd).
const DEFS = [];
const SPR = Object.create(null);
function def(name, w, h, ox, oy, gx, gy, n, paint) {
  DEFS.push({ name: name, w: w, h: h, ox: ox, oy: oy, ax: ox + gx, ay: oy + gy, n: n, paint: paint });
}

/* ================================================================ ground: pavers, lawn, stones */
// Pavers: mock B's diamonds on the square grid. Half width PHW, half height PHW / 2.
// Lattice centres (2 PHW i + PHW k, PHW j + PHW/2 k), k in {0, 1}; the pattern repeats every tile.
const PHW = 16, PHH = 8;
const PAVER_FILL = [R.paver.base, R.paver.shade, R.paver.alt, R.paver.base, R.paver.alt];
// Draws the pavers of one tile whose top left is (x, y) in local coordinates, clipped to that tile.
// pick(cx, cy) returns the fill for the diamond centred at tile local (cx, cy).
function paverTile(x, y, pick) {
  clipLocal(x, y, TILE, TILE);
  const P = R.paver;
  for (let k = 0; k < 2; k++) {
    for (let j = 0; j * PHH * 2 + k * PHH <= TILE; j++) {
      for (let i = 0; i * PHW * 2 + k * PHW <= TILE; i++) {
        const cx = i * PHW * 2 + k * PHW, cy = j * PHH * 2 + k * PHH;
        const X = x + cx, Y = y + cy;
        poly([[X, Y - PHH], [X + PHW, Y], [X, Y + PHH], [X - PHW, Y]], P.dark);
        poly([[X, Y - PHH + 1], [X + PHW - 2, Y], [X, Y + PHH - 1], [X - PHW + 2, Y]], pick(cx, cy));
        // lit upper left edge, shaded lower right edge, one inside the grout (light from the top left)
        for (let t = 0; t < 5; t++) { px(X - 11 + 2 * t, Y - 1 - t, P.hi); px(X - 10 + 2 * t, Y - 1 - t, P.hi); }
        for (let t = 0; t < 4; t++) { px(X + 3 + 2 * t, Y + 5 - t, P.shade); px(X + 4 + 2 * t, Y + 5 - t, P.shade); }
      }
    }
  }
  unclip();
}
function paverPickFor(seed, edgeSeed) {
  return function (cx, cy) {
    const edge = cx === 0 || cx === TILE || cy === 0 || cy === TILE;
    const u = hash2(cx % TILE, cy % TILE, edge ? edgeSeed : seed);
    return PAVER_FILL[Math.floor(u * PAVER_FILL.length)];
  };
}

// Lawn: a 2:1 diamond checker (mock B's grass) on the square grid, with the mowed stripe by column.
// stripe 'a' is the lit pass, 'b' the darker return pass. Tufts and clover seeded per tile.
const LAWN_TONE = {
  a: { base: R.lawnB.base, diamond: R.lawnA.base },
  b: { base: R.lawnB.shade, diamond: R.lawnA.shade }
};
function lawnTile(x, y, stripe, seedX, seedY, kind) {
  clipLocal(x, y, TILE, TILE);
  const t = LAWN_TONE[stripe] || LAWN_TONE.a;
  rect(x, y, TILE, TILE, t.base);
  poly([[x + 16, y], [x + 32, y + 8], [x + 16, y + 16], [x, y + 8]], t.diamond);
  poly([[x + 16, y + 16], [x + 32, y + 24], [x + 16, y + 32], [x, y + 24]], t.diamond);
  const rnd = mulberry(strSeed('lawn:' + seedX + ',' + seedY + ':' + kind));
  const tufts = 3 + (kind === 2 ? 1 : 0);
  for (let k = 0; k < tufts; k++) {
    const tx = x + 3 + Math.floor(rnd() * 25), ty = y + 4 + Math.floor(rnd() * 25);
    if (rnd() < 0.5) { px(tx, ty, R.lawnA.hi); px(tx + 1, ty - 1, R.lawnA.hi); px(tx + 2, ty, R.lawnA.hi); }
    else { px(tx, ty, R.lawnA.dark); px(tx + 1, ty, R.lawnA.dark); }
  }
  if (kind === 1) {                 // clover: three white heads with a leaf
    for (let k = 0; k < 3; k++) {
      const cx = x + 4 + Math.floor(rnd() * 24), cy = y + 5 + Math.floor(rnd() * 22);
      px(cx, cy + 1, R.stem.base); px(cx - 1, cy + 1, R.stem.hi);
      px(cx, cy, R.flowers[2]); px(cx + 1, cy, R.flowers[2]); px(cx, cy - 1, R.flowers[2]);
    }
  }
  unclip();
}
// Stepping stones (no outline, per the bible), with their own small shadows.
function stones(x, y, variant) {
  const S = R.stone;
  const list = variant === 1 ? [[16, 17, 8, 4.5]] : [[12, 9, 7, 4], [20, 24, 7, 4]];
  for (const s of list) {
    shadowEll(x + s[0] + 1, y + s[1] + 1, s[2], s[3], AL.shadowWide);
    ellipse(x + s[0], y + s[1], s[2], s[3], S.shade);
    ellipse(x + s[0], y + s[1] - 0.5, s[2] - 0.5, s[3] - 0.8, S.base);
    ellipse(x + s[0] - 1.5, y + s[1] - 1.5, s[2] * 0.55, s[3] * 0.4, S.hi);
  }
}
// Foliage behind the fences: the neighbour's hedge line, never outlined.
function foliage(x, y, w, h, seed) {
  const H = R.hedge;
  clipLocal(x, y, w, h);
  rect(x, y, w, h, H.shade);
  const rnd = mulberry(seed);
  const n = Math.ceil(w * h / 90);
  for (let k = 0; k < n; k++) {
    const cx = x + rnd() * w, cy = y + rnd() * h, r = 4 + rnd() * 4;
    ellipse(cx, cy, r, r * 0.85, H.base);
    ellipse(cx - 1.5, cy - 1.5, r * 0.45, r * 0.35, H.hi);
  }
  for (let k = 0; k < n * 2; k++) px(x + Math.floor(rnd() * w), y + Math.floor(rnd() * h), H.dark);
  unclip();
}

def('paver', 32, 32, 0, 0, 16, 32, 4, function (f) {
  paverTile(0, 0, paverPickFor(11 + f * 7, 5));
});
def('lawn_a', 32, 32, 0, 0, 16, 32, 3, function (f) { lawnTile(0, 0, 'a', 3, 5 + f, f); });
def('lawn_b', 32, 32, 0, 0, 16, 32, 3, function (f) { lawnTile(0, 0, 'b', 4, 7 + f, f); });
def('stone_step', 32, 32, 0, 0, 16, 32, 2, function (f) { stones(0, 0, f); });

// Sky, hills and tree line (round 1): drawn as a full band from world y -64 to 112, but only the
// top left wedge shows: the back fence and the barn cover the rest, as in mock B. The tree line
// follows the back left fence's 2:1 line (BACK_CORNER, falling to the left).
const BACK_CORNER = { x: 144, y: -40 };          // world px of the yard's back corner (the barn's left end)
def('backdrop', 352, 176, 0, 64, 176, 0, 1, function (f, rnd) {
  const S = R.sky, H = R.hedge;
  rect(0, -64, 352, 176, S.shade);
  for (let y = -64; y < -46; y += 2) for (let x = ((y / 2) & 1); x < 352; x += 2) px(x, y, S.base);
  [[10, -50], [76, -56], [196, -60]].forEach(function (c) {
    ellipse(c[0], c[1], 12, 7, S.hi); ellipse(c[0] + 12, c[1] - 3, 10, 8, S.hi); ellipse(c[0] + 24, c[1], 12, 7, S.hi);
    rect(c[0] - 7, c[1] + 1, 42, 5, S.hi);
  });
  // distant hills: two soft rolls, lighter than the tree line
  const hillA = R.lawnA, hillB = R.hedge;
  for (let x = -10; x < 362; x += 2) {
    const y1 = -26 + Math.round(8 * Math.sin(x / 38) + 5 * Math.sin(x / 17 + 1));
    rect(x, y1, 2, 200, hillA.shade);
    if ((x >> 1) % 3 === 0) px(x, y1, hillA.base);
  }
  for (let x = -10; x < 362; x += 2) {
    const y2 = -12 + Math.round(6 * Math.sin(x / 29 + 2));
    rect(x, y2, 2, 200, hillB.base);
  }
  // tree line just behind the back fences: dark crowns, then mid crowns with a lit cap
  const fenceTop = function (x) { return BACK_CORNER.y - 27 + Math.abs(BACK_CORNER.x - x) / 2; };
  for (let x = -8; x < 360; x += 10 + Math.floor(rnd() * 5)) ellipse(x, fenceTop(x) - 14 + rnd() * 4, 15, 13, H.dark);
  for (let x = -6; x < 360; x += 12 + Math.floor(rnd() * 5)) {
    const y = fenceTop(x) - 5 + rnd() * 4;
    ellipse(x, y, 12, 10, H.base); ellipse(x - 3, y - 4, 5, 3, H.hi);
  }
  for (let x = 0; x < 352; x++) rect(x, Math.round(fenceTop(x)) + 2, 1, 176, H.shade);
  for (let k = 0; k < 260; k++) {
    const x = Math.floor(rnd() * 352), y = Math.floor(fenceTop(x) - 22 + rnd() * 26);
    px(x, y, H.dark);
  }
});

/* ================================================================ the back walls (round 1) */
// Both share one registration: placeTile(name, 4, 0) puts the back corner at BACK_CORNER.
// wall_barn: mock B's backdrop anchor. A long red lap-sided wall receding on the 2:1 diagonal from
// the corner (along u), a gable end wall going back, a slate roof with a ridge, a big four-pane
// window with a flower box, a hayloft door, corner trims, a stone footing, dark outline.
const BARN = { L: 176, H: 72, D: 40, RIDGE: 22, cx: 13, cy: 106 };
def('wall_barn', 240, 202, -3, 146, 16, -40, 1, function (f, rnd) {
  const B = R.barn, RF = R.roof, GL = R.glass, ST = R.stone, trim = B.trim, FN = R.fence;
  const L = BARN.L, H = BARN.H, D = BARN.D, RG = BARN.RIDGE;
  OX = 0; OY = 0;                                   // canvas coordinates
  const P = PROJ.isoP(BARN.cx, BARN.cy);
  // ground shadow along the wall foot
  for (let u = 0; u < L; u += 2) { const q = P(u, 0, 0); shadowRect(q[0], q[1], 2, 4, AL.shadowWide); }
  beginObj();
  // gable end wall (faces +u, shaded), with its siding
  poly([P(L, 0, 0), P(L, -D, 0), P(L, -D, H), P(L, -D / 2, H + RG), P(L, 0, H)], B.shade);
  for (let z = 5; z < H + RG; z += 5) {
    for (let v = 0; v > -D; v -= 2) {
      const q = P(L, v, z), top = H + RG - Math.abs(v + D / 2) * RG / (D / 2);
      if (z < top) { px(q[0], q[1], B.dark); px(q[0] + 1, q[1] - 1, B.dark); }
    }
  }
  // front wall (faces +v, lit) with lap siding: a shade line every 5 px and a lit lip above it
  poly([P(0, 0, 0), P(L, 0, 0), P(L, 0, H), P(0, 0, H)], B.base);
  for (let z = 5; z < H; z += 5) {
    const a = P(0, 0, z); isoLine(a[0], a[1], L / 2, 1, B.shade);
    const b = P(0, 0, z + 1); for (let k = 0; k < L / 2; k += 3) { px(b[0] + 2 * k, b[1] + k, B.hi); }
  }
  for (let k = 0; k < 16; k++) { const q = P(4 + Math.floor(rnd() * (L - 8)), 0, 7 + 5 * Math.floor(rnd() * 12)); px(q[0], q[1], B.dark); }
  // stone footing
  poly([P(0, 0, 0), P(L, 0, 0), P(L, 0, 5), P(0, 0, 5)], ST.shade);
  { const a = P(0, 0, 5); isoLine(a[0], a[1], L / 2, 1, ST.base); }
  for (let u = 6; u < L; u += 10) { const q = P(u, 0, 4); vline(q[0], q[1], 4, ST.dark); }
  poly([P(L, 0, 0), P(L, -D, 0), P(L, -D, 5), P(L, 0, 5)], ST.dark);
  // corner trims
  poly([P(0, 0, 5), P(4, 0, 5), P(4, 0, H), P(0, 0, H)], trim);
  poly([P(L - 4, 0, 5), P(L, 0, 5), P(L, 0, H), P(L - 4, 0, H)], trim);
  { const a = P(3, 0, 5), b = P(L - 1, 0, 5); vline(a[0], a[1] - H + 6, H - 5, FN.shade); vline(b[0], b[1] - H + 6, H - 5, FN.shade); }
  // the big four-pane window: trim frame, glass, muntins, glints, sill
  const w0 = 30, w1 = 82, z0 = 28, z1 = 62;
  poly([P(w0 - 3, 0, z0 - 3), P(w1 + 3, 0, z0 - 3), P(w1 + 3, 0, z1 + 3), P(w0 - 3, 0, z1 + 3)], trim);
  poly([P(w0, 0, z0), P(w1, 0, z0), P(w1, 0, z1), P(w0, 0, z1)], GL.base);
  poly([P(w0, 0, z0), P(w1, 0, z0), P(w1, 0, z0 + 7), P(w0, 0, z0 + 7)], GL.shade);
  const wm = (w0 + w1) / 2, zm = (z0 + z1) / 2;
  poly([P(wm - 1, 0, z0), P(wm + 1, 0, z0), P(wm + 1, 0, z1), P(wm - 1, 0, z1)], trim);
  poly([P(w0, 0, zm - 1), P(w1, 0, zm - 1), P(w1, 0, zm + 1), P(w0, 0, zm + 1)], trim);
  [[w0 + 4, z1 - 3], [w0 + 6, z1 - 3], [wm + 4, z1 - 3]].forEach(function (g, i) {
    const q = P(g[0], 0, g[1]);
    for (let k = 0; k < (i === 2 ? 4 : 8); k++) px(q[0] + Math.floor(k / 2), q[1] + k, GL.hi);
  });
  { const a = P(w0 - 3, 0, z0 - 3); isoLine(a[0], a[1] + 1, (w1 - w0 + 6) / 2, 1, FN.shade); }
  // flower box under the window, standing out from the wall
  isoBox(P, w0 - 4, 0, w1 + 4, 8, z0 - 12, 7, R.woodM, { rimC: R.woodM.rim });
  for (let k = 0; k < 18; k++) {
    const q = P(w0 - 2 + k * 3, 4, z0 - 5);
    px(q[0], q[1] - 1, R.stem.base); px(q[0] + 1, q[1] - 1, R.stem.hi); px(q[0], q[1] - 2, R.stem.base);
    const c = R.flowers[[0, 1, 4, 2, 3][k % 5]], y = q[1] - 3 - (k & 1);
    px(q[0], y, c); px(q[0] + 1, y, c); px(q[0] - 1, y + 1, c); px(q[0], y + 1, R.bloom.base); px(q[0] + 1, y + 1, c);
  }
  // hayloft door with an X brace, further down the wall
  const d0 = 112, d1 = 150, dz = 50;
  poly([P(d0 - 3, 0, 5), P(d1 + 3, 0, 5), P(d1 + 3, 0, dz + 3), P(d0 - 3, 0, dz + 3)], trim);
  poly([P(d0, 0, 5), P(d1, 0, 5), P(d1, 0, dz), P(d0, 0, dz)], B.shade);
  for (let u = d0 + 4; u < d1; u += 4) { const q = P(u, 0, 5); vline(q[0], q[1] - dz + 5, dz - 5, B.dark); }
  { const a = P(d0, 0, 5), b = P(d1, 0, dz), c = P(d0, 0, dz), e = P(d1, 0, 5);
    line(a[0], a[1], b[0], b[1], trim); line(a[0] + 1, a[1], b[0] + 1, b[1], trim);
    line(c[0], c[1], e[0], e[1], trim); line(c[0] + 1, c[1], e[0] + 1, e[1], trim); }
  { const q = P(d1 - 5, 0, 26); rect(q[0], q[1], 2, 3, R.steel.base); px(q[0], q[1], R.steel.hi); }
  // slate roof: the near slope from the eave (overhanging the wall) up to the ridge
  const ev = 7, ez = H - 2, rv = -D / 2, rz = H + RG;
  poly([P(-4, ev, ez), P(L + 4, ev, ez), P(L + 4, rv, rz), P(-4, rv, rz)], RF.base);
  for (let k = 1; k < 7; k++) {
    const t = k / 7, vv = ev + (rv - ev) * t, zz = ez + (rz - ez) * t;
    const a = P(-4, vv, zz); isoLine(a[0], Math.round(a[1]), (L + 8) / 2, 1, RF.shade);
    for (let uu = (k & 1) * 4; uu < L + 8; uu += 8) { const q = P(-4 + uu, vv, zz); px(q[0], Math.round(q[1]) + 1, RF.shade); px(q[0], Math.round(q[1]) + 2, RF.shade); }
  }
  for (let k = 0; k < 30; k++) { const t = rnd(), q = P(-4 + rnd() * (L + 8), ev + (rv - ev) * t, ez + (rz - ez) * t); px(q[0], q[1], RF.hi); }
  // ridge cap
  { const a = P(-4, rv, rz); isoLine(a[0], a[1] - 1, (L + 8) / 2, 1, RF.hi); isoLine(a[0], a[1] - 2, (L + 8) / 2, 1, RF.dark); isoLine(a[0], a[1], (L + 8) / 2, 1, RF.hi); }
  // fascia along the eave, and the verge board up the gable end
  { const a = P(-4, ev, ez); isoLine(a[0], a[1], (L + 8) / 2, 1, trim); isoLine(a[0], a[1] + 1, (L + 8) / 2, 1, trim); isoLine(a[0], a[1] + 2, (L + 8) / 2, 1, FN.shade); }
  { const a = P(L + 4, ev, ez), b = P(L + 4, rv, rz); line(a[0], a[1], b[0], b[1], trim); line(a[0], a[1] + 1, b[0], b[1] + 1, FN.shade); }
  { const b = P(L + 4, rv, rz), c = P(L + 4, -D - 4, ez); line(b[0], b[1], c[0], c[1], RF.dark); line(b[0], b[1] + 1, c[0], c[1] + 1, trim); }
  endObj(OL);
});
// fence_diag: the picket run along the back left edge, from the corner down the 2:1 diagonal to the
// left (along v). Pickets show their down-right face (the shaded side), as mock B's left fence.
const FENCE_DIAG = { len: 170, h: 27, cx: 166, cy: 32 };
def('fence_diag', 172, 116, 150, 72, 16, -40, 1, function () {
  const FN = R.fence, Ln = FENCE_DIAG.len, FH = FENCE_DIAG.h;
  OX = 0; OY = 0;
  const P = PROJ.isoP(FENCE_DIAG.cx, FENCE_DIAG.cy);
  for (let v = 0; v < Ln; v += 2) { const q = P(0, v, 0); shadowRect(q[0] - 1, q[1], 3, 3, AL.shadowWide); }
  beginObj();
  [7, 18].forEach(function (z) { poly([P(0, 2, z), P(0, Ln, z), P(0, Ln, z + 3), P(0, 2, z + 3)], FN.dark); });
  for (let v = 2; v < Ln; v += 7) {
    const q = P(1, v, 0), x = q[0], y = Math.round(q[1]);
    rect(x, y - FH, 4, FH, FN.shade); vline(x, y - FH, FH, FN.base); vline(x + 3, y - FH, FH, FN.dark);
    px(x + 1, y - FH - 1, FN.shade); px(x + 2, y - FH - 1, FN.shade); px(x + 1, y - FH - 2, FN.base);
  }
  endObj(OL);
});

/* ================================================================ fences and gate */
// All fence pieces share one canvas: 32 x 60, the tile at canvas rows 28 to 59.
const FENCE_OY = 28;
const FN = R.fence;
function picket(x, yb, h) {
  rect(x, yb - h, 5, h, FN.base);
  vline(x, yb - h, h, FN.hi);
  vline(x + 4, yb - h, h, FN.shade);
  hline(x + 1, yb - h - 1, 3, FN.base); px(x + 1, yb - h - 1, FN.hi); px(x + 2, yb - h - 2, FN.hi);
}
function rail(x, yb, z, w) { rect(x, yb - z - 3, w, 3, FN.dark); hline(x, yb - z - 3, w, FN.shade); }
// A picket seen down a side run: front face plus a 3 px shaded side.
function sidePicket(x, yb, h, first) {
  rect(x + 5, yb - h + 1, 3, h - 1, FN.shade); vline(x + 7, yb - h + 2, h - 2, FN.dark);
  picket(x, yb, h);
  if (!first) {                                   // separate it from the picket behind by tone
    px(x, yb - h - 1, FN.dark); px(x + 1, yb - h - 2, FN.dark); px(x + 2, yb - h - 3, FN.dark);
    px(x + 3, yb - h - 2, FN.dark); px(x + 4, yb - h - 1, FN.dark); px(x + 5, yb - h, FN.dark);
    px(x + 2, yb - h - 2, FN.hi);
  }
  rect(x + 5, yb - 10, 3, 2, FN.dark);            // rail stub on the side face
}
function fencePost(x, yb, h) {
  obox(x, yb, 5, h, 4, FN, { rimC: FN.hi });
  obox(x - 1, yb - h, 7, 2, 4, FN, { front: FN.shade, rimC: FN.hi });
}
// Back run (row 0): ground line at tile y 30, pickets 24 tall, rails at 6 and 17.
function backRun(x0, x1, post) {
  shadowRect(x0, 30, x1 - x0, 2, AL.shadowWide);
  beginObj();
  rail(x0, 30, 6, x1 - x0); rail(x0, 30, 17, x1 - x0);
  for (let x = 1; x < 32; x += 8) if (x >= x0 - 1 && x + 5 <= x1 + 1 && !(post && x === 25)) picket(x, 30, 24);
  if (post) fencePost(25, 30, 27);
  endObj(OL);
}
// Front run (row 11): ground line at tile y 10, pickets 16 tall, rails at 3 and 10.
function frontRun(x0, x1) {
  shadowRect(x0, 10, x1 - x0, 2, AL.shadowWide);
  beginObj();
  rail(x0, 10, 3, x1 - x0); rail(x0, 10, 10, x1 - x0);
  for (let x = 1; x < 32; x += 8) if (x >= x0 - 1 && x + 5 <= x1 + 1) picket(x, 10, 16);
  endObj(OL);
}
// Side run (columns 0 and W - 1): four pickets stacked down the tile at 8 px.
function sideRun(x, y0, y1) {
  shadowRect(x + 1, y0 - 2, 8, y1 - y0 + 2, AL.shadowWide);
  beginObj();
  for (let yb = y0 + 6; yb <= y1; yb += 8) sidePicket(x, yb, 24, false);
  endObj(OL);
}
def('fence_back', 32, 60, 0, FENCE_OY, 16, 30, 2, function (f) { backRun(0, 32, f === 1); });
def('fence_front', 32, 60, 0, FENCE_OY, 16, 10, 1, function () { frontRun(0, 32); });
def('fence_side', 32, 60, 0, FENCE_OY, 16, 32, 2, function (f) { sideRun(f === 0 ? 22 : 2, 0, 32); });
// Corners: 0 top left, 1 top right, 2 bottom left, 3 bottom right.
def('fence_corner', 32, 60, 0, FENCE_OY, 16, 30, 4, function (f) {
  const left = f === 0 || f === 2, top = f < 2;
  const px0 = left ? 22 : 2;
  if (top) {
    shadowRect(0, 30, 32, 2, AL.shadowWide);
    beginObj();
    if (left) { rail(26, 30, 6, 6); rail(26, 30, 17, 6); } else { rail(0, 30, 6, 3); rail(0, 30, 17, 3); }
    fencePost(px0, 30, 28);
    endObj(OL);
  } else {
    shadowRect(px0, -2, 9, 14, AL.shadowWide);
    beginObj();
    sidePicket(px0, -2, 24);
    if (left) { rail(26, 10, 3, 6); rail(26, 10, 10, 6); } else { rail(0, 10, 3, 3); rail(0, 10, 10, 3); }
    fencePost(px0, 10, 20);
    endObj(OL);
  }
});
// Gate on the front run: 0 shut, 1 open (swung in, seen edge on up the path).
def('gate', 32, 60, 0, FENCE_OY, 16, 10, 2, function (f) {
  shadowRect(0, 10, 32, 2, AL.shadowWide);
  beginObj();
  if (f === 0) {
    rect(5, -6, 21, 14, FN.base);
    for (let x = 5; x < 26; x += 4) { vline(x, -6, 14, FN.hi); vline(x + 3, -6, 14, FN.shade); }
    hline(5, -6, 21, FN.hi);
    rect(5, -3, 21, 2, FN.dark); rect(5, 4, 21, 2, FN.dark);
    line(6, 3, 24, -2, FN.dark); line(6, 4, 24, -1, FN.dark);
    rect(22, 0, 2, 2, R.steel.shade); px(22, 0, R.steel.hi);
  } else {
    for (let yb = -12; yb <= 8; yb += 5) sidePicket(5, yb, 14);
  }
  fencePost(0, 10, 20);
  fencePost(26, 10, 20);
  endObj(OL);
});

/* ================================================================ hedge */
// Frame = mask + 4 * variant. mask bit 1: hedge to the west, bit 2: hedge to the east. variant 1 blossoms.
// Ground line at tile y 28; front face 16 tall, top 10 deep; the east end shows the 8 px side face.
def('hedge', 32, 40, 0, 8, 16, 28, 8, function (f, rnd) {
  const H = R.hedge, mask = f & 3, bloom = f >= 4;
  const W = (mask & 1) !== 0, E = (mask & 2) !== 0;
  const x0 = W ? 0 : 2, xr = E ? 32 : 24;
  shadowRect(x0, 28, (E ? 32 : 31) - x0, 2, AL.shadowWide);
  beginObj();
  obox(x0, 28, xr - x0, 16, 10, H, { noSide: true, rim: false, front: H.base, top: H.hi, side: H.shade });
  // bumpy crown
  for (let x = x0 + 3; x < (E ? 34 : 30); x += 6) ellipse(x, 3 + (x % 12 === 3 ? 0 : 1), 4, 3, H.hi);
  // lip shadow under the crown, scalloped
  for (let x = x0; x < xr; x++) { px(x, 12, H.shade); if (((x - x0) % 6) < 3) px(x, 13, H.shade); }
  for (let x = x0 + 1; x < xr; x += 6) px(x, 14, H.dark);
  // leaf clusters on the front and the top
  for (let k = 0; k < 14; k++) {
    const x = x0 + Math.floor(rnd() * (xr - x0 - 2)), y = 15 + Math.floor(rnd() * 9);
    px(x, y, H.hi); px(x + 1, y, H.hi); px(x, y + 1, H.shade);
  }
  for (let k = 0; k < 10; k++) {
    const x = x0 + Math.floor(rnd() * (xr - x0 - 1)), y = 3 + Math.floor(rnd() * 8);
    px(x, y, R.leaf.hi);
    if (rnd() < 0.4) px(x + 1, y + 1, H.base);
  }
  for (let k = 0; k < 8; k++) px(x0 + Math.floor(rnd() * (xr - x0)), 18 + Math.floor(rnd() * 9), H.dark);
  rect(x0, 26, xr - x0, 2, H.shade); hline(x0, 27, xr - x0, H.dark);
  if (!E) for (let k = 0; k < 5; k++) px(xr + 1 + Math.floor(rnd() * 6), 12 + Math.floor(rnd() * 12), H.dark);
  if (!W) { erase(x0, 2); erase(x0, 3); erase(x0 + 1, 2); erase(x0, 27); }
  if (!E) { erase(xr + 7, 4); erase(xr + 7, 5); }
  if (bloom) {
    for (let k = 0; k < 7; k++) {
      const x = x0 + 2 + Math.floor(rnd() * (xr - x0 - 4)), y = 3 + Math.floor(rnd() * 20);
      const c = R.flowers[k % 2 === 0 ? 0 : 2];
      px(x, y, c); px(x + 1, y, c); px(x, y + 1, c); px(x + 1, y + 1, R.bloom.base);
    }
  }
  endObj(OL);
});

/* ================================================================ flower bed */
// Frame = mask (bit 1 N, 2 E, 4 S, 8 W: a bed tile on that side) + 16 for the tilled soil (unbought).
// Raised 8 px; the top is drawn 1:1 like the ground so runs join; the front face shows on the south edge.
function bedTile(mask, soil, rnd) {
  const N = (mask & 1) !== 0, E = (mask & 2) !== 0, S = (mask & 4) !== 0, W = (mask & 8) !== 0;
  const wd = R.woodM, sl = R.soil;
  const x0 = W ? 0 : 2, x1 = E ? 32 : 30, y0 = N ? -8 : -6, y1 = S ? 32 : 22;
  if (!S) shadowRect(x0 + 1, 30, x1 - x0, 2, AL.shadowWide);
  if (!E) shadowRect(30, y0 + 9, 2, y1 - y0 - 1, AL.shadowWide);
  beginObj();
  rect(x0, y0, x1 - x0, y1 - y0, sl.base);
  // soil texture
  for (let k = 0; k < 18; k++) {
    const x = x0 + Math.floor(rnd() * (x1 - x0)), y = y0 + Math.floor(rnd() * (y1 - y0));
    px(x, y, rnd() < 0.5 ? sl.shade : sl.hi);
  }
  if (soil) {
    for (let y = y0 + 3; y < y1 - 1; y += 4) {
      hline(x0, y, x1 - x0, sl.shade);
      for (let x = x0 + (y & 4 ? 1 : 3); x < x1; x += 5) px(x, y - 1, sl.hi);
    }
  }
  // wooden rim on the exposed edges
  if (!N) { rect(x0, y0, x1 - x0, 2, wd.hi); hline(x0, y0 + 2, x1 - x0, sl.dark); }
  if (!W) { rect(x0, y0, 2, y1 - y0, wd.hi); vline(x0 + 2, y0 + (N ? 0 : 2), y1 - y0 - (N ? 0 : 2), sl.dark); }
  if (!E) { rect(x1 - 2, y0, 2, y1 - y0, wd.base); vline(x1 - 1, y0, y1 - y0, wd.shade); }
  if (!S) {
    rect(x0, y1 - 2, x1 - x0, 2, wd.rim);
    rect(x0, y1, x1 - x0, 8, wd.base);
    hline(x0, y1 + 4, x1 - x0, wd.shade);
    hline(x0, y1 + 7, x1 - x0, wd.shade);
    for (let x = x0 + 15; x < x1 - 2; x += 16) vline(x, y1, 8, wd.dark);
    if (!E) vline(x1 - 1, y1, 8, wd.shade);
  }
  if (!soil) {
    const n = 4;
    for (let k = 0; k < n; k++) {
      const x = x0 + 5 + Math.floor((k + rnd() * 0.8) * (x1 - x0 - 10) / n), yb = y0 + 8 + Math.floor(rnd() * (y1 - y0 - 10));
      const hgt = 3 + Math.floor(rnd() * 3);
      vline(x, yb - hgt, hgt, R.stem.base);
      px(x - 1, yb - 1, R.stem.hi); px(x + 1, yb - 2, R.stem.hi); px(x - 1, yb - 2, R.stem.shade);
      const c = R.flowers[Math.floor(rnd() * R.flowers.length)];
      const fy = yb - hgt - 1;
      px(x, fy - 1, c); px(x - 1, fy, c); px(x + 1, fy, c); px(x, fy + 1, c); px(x, fy, R.bloom.base);
    }
  } else {
    for (let k = 0; k < 3; k++) { const x = x0 + 4 + Math.floor(rnd() * (x1 - x0 - 8)), y = y0 + 5 + Math.floor(rnd() * (y1 - y0 - 8)); px(x, y, R.stem.hi); px(x + 1, y - 1, R.stem.base); }
  }
  endObj(OL);
}
def('bed', 32, 40, 0, 8, 16, 30, 32, function (f, rnd) { bedTile(f & 15, f >= 16, rnd); });

/* ================================================================ tree */
// Trunk on its tile, canopy overhanging the tiles around it. tree = both, tree_trunk and tree_canopy
// share its canvas and anchor so the canopy can draw in an overhead pass.
const TREE = { w: 88, h: 128, ox: 26, oy: 96 };
function treeTrunk() {
  const B = R.bark;
  shadowEll(18, 30, 34, 10, AL.shadowProp);
  beginObj();
  rect(11, -26, 11, 56, B.base);
  vline(11, -26, 56, B.hi); vline(12, -26, 56, B.hi);
  rect(19, -26, 3, 56, B.shade);
  line(16, -14, 24, -24, B.base); line(17, -14, 25, -24, B.shade);
  rect(8, 27, 17, 3, B.base); hline(8, 27, 3, B.hi); rect(22, 27, 3, 3, B.shade);
  for (let y = -2; y < 26; y += 7) { px(14 + (y & 3), y, B.dark); px(15 + (y & 3), y + 1, B.dark); px(17, y + 3, B.shade); }
  endObj(OL);
}
function treeCanopy(rnd) {
  const L = R.leaf;
  const blobs = [[0, -56, 28], [-21, -42, 19], [21, -40, 21], [-10, -74, 19], [14, -74, 19], [0, -33, 17]];
  beginObj();
  for (const b of blobs) ellipse(16 + b[0], b[1], b[2], b[2] * 0.9, L.shade);
  for (const b of blobs) ellipse(16 + b[0] - 3, b[1] - 3, b[2] - 4, b[2] * 0.9 - 4, L.base);
  for (const b of blobs) ellipse(16 + b[0] - 7, b[1] - 7, b[2] * 0.45, b[2] * 0.35, L.hi);
  for (let k = 0; k < 110; k++) {
    const a = rnd() * 6.283, d = rnd() * 40;
    const x = 16 + Math.cos(a) * d, y = -56 + Math.sin(a) * d * 0.9;
    if (solid(at(x, y))) px(x, y, L.dark);
  }
  for (let k = 0; k < 26; k++) {
    const a = 3.6 + rnd() * 1.6, d = 10 + rnd() * 28;
    const x = 16 + Math.cos(a) * d, y = -58 + Math.sin(a) * d * 0.9;
    if (solid(at(x, y)) && solid(at(x + 1, y))) { px(x, y, L.hi); px(x + 1, y, L.hi); }
  }
  endObj(OL);
}
def('tree', TREE.w, TREE.h, TREE.ox, TREE.oy, 16, 30, 1, function (f, rnd) { treeTrunk(); treeCanopy(rnd); });
def('tree_trunk', TREE.w, TREE.h, TREE.ox, TREE.oy, 16, 30, 1, function () { treeTrunk(); });
def('tree_canopy', TREE.w, TREE.h, TREE.ox, TREE.oy, 16, 30, 1, function (f, rnd) { treeCanopy(mulberry(strSeed('tree:0'))); });

/* ================================================================ potted plants */
// Clay pot on the clay ramp. 0 round shrub, 1 flowers, 2 grass.
def('pot', 32, 44, 0, 12, 16, 28, 3, function (f, rnd) {
  const C = R.clay, L = R.leaf, ST = R.stem;
  shadowEll(17, 28, 9, 3, AL.shadowProp);
  beginObj();
  for (let y = 16; y < 28; y++) {
    const hw = 7 - Math.floor((y - 16) / 4);
    rect(16 - hw, y, hw * 2, 1, C.base);
    px(16 - hw, y, C.hi); px(16 - hw + 1, y, C.hi);
    rect(16 + hw - 3, y, 3, 1, C.shade);
  }
  rect(8, 12, 16, 4, C.base); hline(8, 12, 16, C.hi); rect(21, 12, 3, 4, C.shade); hline(8, 15, 16, C.dark);
  hline(10, 12, 12, R.soil.dark);
  if (f === 0) {
    ellipse(16, 4, 10, 8.5, L.shade); ellipse(15, 3, 8.5, 7, L.base); ellipse(12, 0, 4, 3, L.hi);
    for (let k = 0; k < 14; k++) { const x = 8 + rnd() * 16, y = -3 + rnd() * 13; if (solid(at(x, y))) px(x, y, L.dark); }
  } else if (f === 1) {
    for (let k = 0; k < 5; k++) {
      const x = 10 + k * 3, top = 1 + Math.floor(rnd() * 5);
      vline(x, top, 12 - top, ST.base); px(x + 1, top + 4, ST.hi); px(x - 1, top + 6, ST.hi);
      const c = R.flowers[(k * 2) % 5];
      px(x, top - 2, c); px(x - 1, top - 1, c); px(x + 1, top - 1, c); px(x, top, c); px(x, top - 1, R.bloom.base);
    }
  } else {
    [[6, -4], [9, -9], [14, -12], [19, -11], [24, -7], [27, -2], [12, -6], [21, -5]].forEach(function (p, k) {
      line(16, 11, p[0], p[1], k & 1 ? ST.base : ST.shade);
      line(16, 11, p[0] + (p[0] < 16 ? 1 : -1), p[1] + 1, k & 1 ? ST.hi : ST.base);
    });
  }
  endObj(OL);
});

/* ================================================================ string lights */
// lights_post: a tall 5 px post on an iso foot block; the wire hook sits at tile local (16, -74),
// high enough that a slack string clears every walker's head (round 1).
def('lights_post', 32, 136, 0, 104, 16, 30, 1, function () {
  const W = R.woodM;
  shadowEll(18, 30, 6, 3, AL.shadowPerson);
  beginObj();
  isoBox(PROJ.isoP(16, 24), 0, 0, 6, 6, 0, 4, R.woodD, { rim: false });
  rect(14, -76, 5, 104, W.base);
  vline(14, -76, 104, W.hi); rect(17, -76, 2, 104, W.shade);
  rect(13, -78, 7, 2, R.woodD.base); hline(13, -78, 7, R.woodD.hi);
  px(19, -74, UI.wire); px(20, -74, UI.wire);
  endObj(OL);
});
const LIGHT_HOOK = { x: 16, y: -74 };
// Wire plus bulbs between two hook points (canvas local). frame 1 shifts the colours one bulb on.
function paintString(ax, ay, bx, by, sag, frame) {
  const n = Math.max(1, Math.abs(bx - ax));
  let prev = null, k = 0;
  for (let s = 0; s <= n; s++) {
    const t = s / n;
    const x = Math.round(ax + (bx - ax) * t);
    const y = Math.round(ay + (by - ay) * t + sag * 4 * t * (1 - t));
    if (prev) line(prev[0], prev[1], x, y, UI.wire); else px(x, y, UI.wire);
    prev = [x, y];
    if (s % 12 === 6 && s < n - 3) {
      const c = R.bulbs[(k++ + frame) % R.bulbs.length];
      px(x, y + 1, UI.wire);
      rect(x - 1, y + 2, 3, 4, c);
      px(x - 1, y + 2, UI.white);
      px(x, y + 6, c);
    }
  }
}
// Default span: two posts 300 px apart with a 22 px sag (the proof's back string).
def('lights_string', 312, 40, -10, 82, 150, -50, 2, function (f) {
  paintString(LIGHT_HOOK.x + 4, LIGHT_HOOK.y, LIGHT_HOOK.x + 300 - 3, LIGHT_HOOK.y, 22, f);
});

/* ================================================================ pit sign (round 1) */
// Mock B's hanging post sign: a post on an iso foot block, an arm out to the left, two chains, a
// wood framed dark board, and chunky two line pixel lettering at 2x with a dark outline (gold over
// orange, the font of screen-1-season.html). The board and its panel sit at the same place in
// every frame:
//   0 board alone (for a fence or a wall)
//   1 hanging from the arm of its own post (the post stands at the patio corner; its hook also
//     takes the light string, SIGN.hook)
//   2 standing board on two legs
const SIGN = { w: 84, h: 148, board: { x: 6, y: 32, w: 66, h: 46 }, panel: { x: 10, y: 36, w: 58, h: 38 }, hook: { x: 76, y: 15 } };
def('sign', SIGN.w, SIGN.h, 60, 116, 16, 30, 3, function (f) {
  const W = R.woodM, D = R.woodD, b = SIGN.board, p = SIGN.panel;
  OX = 0; OY = 0;                                 // this painter works in canvas coordinates
  if (f === 1) {
    shadowEll(77, 146, 6, 3, AL.shadowPerson);
    beginObj();
    isoBox(PROJ.isoP(76, 140), 0, 0, 6, 6, 0, 4, D, { rim: false });
    rect(74, 14, 5, 130, W.base); vline(74, 14, 130, W.hi); rect(77, 14, 2, 130, W.shade);
    rect(73, 12, 7, 2, D.base); hline(73, 12, 7, D.hi);
    rect(4, 21, 74, 4, D.base); hline(4, 21, 74, D.hi); hline(4, 24, 74, D.dark);
    rect(3, 20, 3, 6, D.base);
    line(73, 46, 58, 25, D.base); line(73, 47, 58, 26, D.shade); line(74, 46, 59, 25, D.hi);
    px(80, 15, UI.wire); px(81, 15, UI.wire);
    endObj(OL);
    for (let y = 25; y < 32; y++) { px(14 + (y & 1), y, UI.wire); px(62 + (y & 1), y, UI.wire); }
  }
  if (f === 2) {
    shadowEll(17, 146, 6, 3, AL.shadowPerson); shadowEll(62, 146, 6, 3, AL.shadowPerson);
    beginObj();
    rect(14, b.y + b.h, 5, 146 - b.y - b.h, D.base); vline(14, b.y + b.h, 146 - b.y - b.h, D.hi); vline(18, b.y + b.h, 146 - b.y - b.h, D.shade);
    rect(59, b.y + b.h, 5, 146 - b.y - b.h, D.base); vline(59, b.y + b.h, 146 - b.y - b.h, D.hi); vline(63, b.y + b.h, 146 - b.y - b.h, D.shade);
    endObj(OL);
  }
  beginObj();
  rect(b.x, b.y, b.w, b.h, W.shade);
  rect(b.x + 1, b.y + 1, b.w - 2, b.h - 2, W.base);
  hline(b.x + 1, b.y + 1, b.w - 2, W.rim); vline(b.x + 1, b.y + 1, b.h - 2, W.hi);
  hline(b.x + 1, b.y + b.h - 2, b.w - 2, W.dark); vline(b.x + b.w - 2, b.y + 2, b.h - 3, W.dark);
  rect(p.x, p.y, p.w, p.h, ANCHOR.K);
  hline(p.x, p.y + p.h - 1, p.w, ANCHOR.U);
  [[b.x + 2, b.y + 2], [b.x + b.w - 3, b.y + 2], [b.x + 2, b.y + b.h - 3], [b.x + b.w - 3, b.y + b.h - 3]].forEach(function (q) { px(q[0], q[1], R.steel.base); });
  endObj(OL);
});

/* ================================================================ picnic table and benches (round 1) */
// Mock B's diagonal picnic table: the table runs along u (down and to the right on screen), a
// bench on each long side, splayed A-frame legs, a plank top with seams and a lit rim. All four
// pieces share one canvas and one anchor (the footprint's bottom centre, 4 tiles by 3), so the
// renderer draws them in this order round the guests:
//   picnic 1 (cast shadow, ground pass), picnic_bench 0 (far bench), far guests, picnic 0 (table),
//   plates on the top, picnic_bench 1 (near bench), near guests.
// Far guests face the camera across the table; near guests sit with their backs to the camera.
const PIC = { L: 56, TV: 14, ZT: 24, BV0: 22, BV1: 32, ZB: 13, cx: 34, cy: 46, w: 126, h: 94 };
function picP() { return PROJ.isoP(PIC.cx, PIC.cy); }
function picLegs(P, side) {
  // one A-frame at each end: two splayed legs from under the top down to the bench feet
  const D = R.woodD;
  [6, PIC.L - 8].forEach(function (u) {
    const s = side < 0 ? -1 : 1;
    const top = P(u, s * 8, PIC.ZT), foot = P(u, s * 20, 0);
    for (let k = 0; k < 3; k++) line(top[0] + k, top[1], foot[0] + k, foot[1], k === 0 ? D.hi : k === 2 ? D.shade : D.base);
  });
}
function picBench(P, v0, v1) {
  const W = R.woodL, D = R.woodD;
  [6, PIC.L - 8].forEach(function (u) { isoBox(P, u, v0 + 3, u + 2, v0 + 5, 0, PIC.ZB, D, { rim: false }); });
  isoBox(P, 0, v0, PIC.L, v1, PIC.ZB, 3, W, { rimC: W.rim });
  const a = P(0, (v0 + v1) / 2, PIC.ZB + 3); isoLine(a[0], Math.round(a[1]), PIC.L / 2, 1, W.base);
}
def('picnic', PIC.w, PIC.h, -2, -4, 64, 94, 2, function (f) {
  OX = 0; OY = 0;
  const P = picP(), W = R.woodL, D = R.woodD, L = PIC.L, TV = PIC.TV, ZT = PIC.ZT;
  if (f === 1) {
    // the cast shadow: the whole footprint rhombus nudged down and right (light from the top left)
    const sh = acol(AL.shadowWide.rgb, AL.shadowWide.a);
    const pts = [P(0, -PIC.BV1, 0), P(L, -PIC.BV1, 0), P(L, PIC.BV1, 0), P(0, PIC.BV1, 0)].map(function (q) { return [q[0] + 3, q[1] + 2]; });
    const v = sh;
    let minY = Infinity, maxY = -Infinity;
    pts.forEach(function (q) { minY = Math.min(minY, q[1]); maxY = Math.max(maxY, q[1]); });
    poly(pts, '#000000');
    for (let k = 0; k < MAIN.length; k++) if (MAIN[k] === col('#000000')) MAIN[k] = v;
    const deep = acol(AL.shadowWide.rgb, 0.3);
    const tp = [P(2, -TV + 2, 0), P(L - 2, -TV + 2, 0), P(L - 2, TV - 2, 0), P(2, TV - 2, 0)].map(function (q) { return [q[0] + 6, q[1] + 3]; });
    poly(tp, '#000001');
    for (let k = 0; k < MAIN.length; k++) if (MAIN[k] === col('#000001')) MAIN[k] = deep;
    return;
  }
  beginObj();
  picLegs(P, -1); picLegs(P, 1);
  [6, L - 8].forEach(function (u) { const a = P(u, -18, 9), b = P(u, 18, 9); line(a[0], a[1], b[0], b[1], D.shade); line(a[0], a[1] + 1, b[0], b[1] + 1, D.dark); });
  isoBox(P, 0, -TV, L, TV, ZT, 4, W, { rimC: W.rim });
  // plank seams along the table, end grain on the right face, a crease under the top
  [-7, 0, 7].forEach(function (v) { const a = P(0, v, ZT + 4); isoLine(a[0], Math.round(a[1]), L / 2, 1, W.base); });
  [-7, 0, 7].forEach(function (v) { const a = P(L, v, ZT + 4); vline(a[0], a[1], 4, W.dark); });
  { const a = P(0, TV, ZT); isoLine(a[0], a[1], L / 2, 1, D.base); }
  for (let k = 0; k < 6; k++) { const q = P(4 + k * 9, -10 + (k * 7) % 20, ZT + 4); px(q[0], q[1], W.base); px(q[0] + 1, q[1], W.base); }
  endObj(OL);
});
def('picnic_bench', PIC.w, PIC.h, -2, -4, 64, 94, 2, function (f) {
  OX = 0; OY = 0;
  const P = picP();
  beginObj();
  if (f === 0) picBench(P, -PIC.BV1, -PIC.BV0); else picBench(P, PIC.BV0, PIC.BV1);
  endObj(OL);
});
// Seat and plate spots, relative to the shared anchor: sit sprites stand with their anchor on the
// seat line (bible 4); plates are plate sprite centres on the top face.
const PICNIC = (function () {
  const P = picP(), ax = 62, ay = 90;
  const rel = function (q) { return { dx: Math.round(q[0] - ax), dy: Math.round(q[1] - ay) }; };
  const seatV = (PIC.BV0 + PIC.BV1) / 2, us = [14, 42];
  return Object.freeze({
    far: Object.freeze(us.map(function (u) { return rel(P(u, -seatV, PIC.ZB + 3)); })),
    near: Object.freeze(us.map(function (u) { return rel(P(u, seatV, PIC.ZB + 3)); })),
    platesFar: Object.freeze(us.map(function (u) { return rel(P(u, -6, PIC.ZT + 4)); })),
    platesNear: Object.freeze(us.map(function (u) { return rel(P(u, 7, PIC.ZT + 4)); })),
    footprint: [4, 3]
  });
})();
const SEATS = Object.freeze({
  picnic_bench: Object.freeze([PICNIC.far, PICNIC.near]),
  chair: Object.freeze([Object.freeze([{ dx: 16, dy: 20 }]), Object.freeze([{ dx: 16, dy: 20 }])])
});

/* ================================================================ flower box (round 1) */
// Mock B's long raised flower bed on the lawn: an iso box along u, soil top, a row of blooms.
const FBOX = { U: 56, V: 12, H: 9, cx: 14, cy: 26 };
def('flower_box', 72, 64, 4, 30, 32, 30, 1, function (f, rnd) {
  OX = 0; OY = 0;
  const P = PROJ.isoP(FBOX.cx, FBOX.cy), U = FBOX.U, V = FBOX.V, H = FBOX.H;
  const sh = function () {
    const pts = [P(0, 0, 0), P(U, 0, 0), P(U, V, 0), P(0, V, 0)].map(function (q) { return [q[0] + 3, q[1] + 2]; });
    poly(pts, '#000002');
    const v = acol(AL.shadowWide.rgb, AL.shadowWide.a);
    for (let k = 0; k < MAIN.length; k++) if (MAIN[k] === col('#000002')) MAIN[k] = v;
  };
  sh();
  beginObj();
  isoBox(P, 0, 0, U, V, 0, H, R.woodM, { top: R.soil.base, rimC: R.woodM.rim });
  poly([P(2, 2, H), P(U - 2, 2, H), P(U - 2, V - 2, H), P(2, V - 2, H)], R.soil.shade);
  for (let k = 0; k < 18; k++) { const q = P(3 + rnd() * (U - 6), 3 + rnd() * (V - 6), H); px(q[0], q[1], R.soil.dark); }
  for (let a = 8; a < U; a += 12) { const q = P(a, V, 0); vline(q[0], q[1] - H, H, R.woodM.shade); }
  const n = 16;
  for (let k = 0; k < n; k++) {
    const q = P(3 + (U - 6) * (k + 0.5) / n, 3 + rnd() * (V - 6), H), x = Math.round(q[0]), y = Math.round(q[1]);
    const hgt = 3 + Math.floor(rnd() * 4);
    vline(x, y - hgt, hgt, R.stem.base); px(x - 1, y - 1, R.stem.hi); px(x + 1, y - 2, R.stem.hi);
    const c = R.flowers[Math.floor(rnd() * R.flowers.length)];
    px(x, y - hgt - 2, c); px(x - 1, y - hgt - 1, c); px(x + 1, y - hgt - 1, c); px(x, y - hgt, c); px(x, y - hgt - 1, R.bloom.base);
  }
  endObj(OL);
});

/* ================================================================ chair */
// Slatted lawn chair. 0 faces down (the guest faces the camera), 1 faces up (its back to the camera).
def('chair', 32, 48, 0, 16, 16, 28, 2, function (f) {
  const L = R.woodL, M = R.woodM;
  shadowEll(17, 28, 12, 3, AL.shadowProp);
  beginObj();
  if (f === 0) {
    for (let k = 0; k < 4; k++) {
      const x = 9 + k * 4, top = k === 1 || k === 2 ? -2 : 0;
      rect(x, top, 3, 18 - top, L.base); vline(x, top, 18 - top, L.hi); erase(x + 2, top);
    }
    rect(8, 7, 17, 2, M.shade);
    rect(9, 26, 2, 2, M.shade); rect(22, 26, 2, 2, M.shade);
    obox(8, 24, 16, 3, 7, L, { rimC: L.rim });
    obox(3, 22, 5, 2, 9, M, { noSide: true, rimC: M.rim }); rect(4, 22, 3, 6, M.shade);
    obox(24, 22, 5, 2, 9, M, { noSide: true, rimC: M.rim }); rect(25, 22, 3, 6, M.shade);
  } else {
    obox(8, 22, 16, 3, 6, L, { rimC: L.rim });
    obox(3, 20, 5, 2, 8, M, { noSide: true, rimC: M.rim }); rect(4, 20, 3, 8, M.shade);
    obox(24, 20, 5, 2, 8, M, { noSide: true, rimC: M.rim }); rect(25, 20, 3, 8, M.shade);
    for (let k = 0; k < 4; k++) {
      const x = 9 + k * 4, top = k === 1 || k === 2 ? 0 : 2;
      rect(x, top, 3, 27 - top, L.base); vline(x, top, 27 - top, L.hi); vline(x + 2, top, 27 - top, L.shade); erase(x + 2, top);
    }
    rect(8, 14, 17, 2, M.base); hline(8, 14, 17, M.hi);
  }
  endObj(OL);
});

/* ================================================================ canopy umbrella */
// Striped patio umbrella. 0 whole, 1 canopy only (overhead pass), 2 pole, stand and shadow only.
def('canopy', 88, 104, 28, 74, 16, 28, 3, function (f) {
  const ST = R.steel, red = R.drum, crm = R.fence;
  if (f !== 1) {
    shadowEll(18, 27, 32, 9, AL.shadowWide);
    beginObj();
    rect(15, -40, 3, 66, ST.base); vline(15, -40, 66, ST.hi); vline(17, -40, 66, ST.shade);
    obox(9, 28, 13, 3, 5, R.kettle, { rimC: R.kettle.spec });
    endObj(OL);
  }
  if (f === 2) return;
  beginObj();
  const cx = 16, cy = -48, rx = 40, ry = 14;
  for (let y = Math.floor(cy - ry); y <= cy + ry + 6; y++) {
    for (let x = cx - rx; x <= cx + rx; x++) {
      const dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry;
      const inTop = dx * dx + dy * dy <= 1;
      const skirtY = cy + ry * Math.sqrt(Math.max(0, 1 - dx * dx));
      const scallop = 4 + (Math.abs(((x - cx + 400) % 10) - 5) < 3 ? 1 : 0);
      const inSkirt = !inTop && dy > 0 && y < skirtY + scallop && Math.abs(dx) < 0.995;
      if (!inTop && !inSkirt) continue;
      const ang = Math.atan2((y + 0.5 - cy) / ry, (x + 0.5 - cx) / rx);
      const stripe = Math.floor((ang + Math.PI) / (Math.PI / 6)) & 1;
      const ramp = stripe ? red : crm;
      let c;
      if (inSkirt) c = ramp.shade;
      else c = (dx + dy < -0.35) ? ramp.hi : ramp.base;
      px(x, y, c);
    }
  }
  for (let x = cx - rx + 2; x < cx + rx - 1; x++) {
    const dx = (x + 0.5 - cx) / rx, yy = Math.floor(cy + ry * Math.sqrt(Math.max(0, 1 - dx * dx)));
    if (solid(at(x, yy))) px(x, yy, ((Math.floor((Math.atan2(1, dx) + Math.PI) / (Math.PI / 6)) & 1) ? red.dark : crm.dark));
  }
  rect(15, cy - 3, 3, 3, ST.base); px(15, cy - 3, ST.hi);
  endObj(OL);
});

/* ================================================================ bird bath */
// 0 empty, 1 with a bird on the rim.
def('birdbath', 32, 48, 0, 16, 16, 28, 2, function (f) {
  const S = R.stone, GL = R.glass;
  shadowEll(17, 28, 10, 3, AL.shadowProp);
  beginObj();
  obox(9, 28, 12, 3, 4, S, { rimC: S.hi });
  rect(13, 9, 6, 16, S.base); vline(13, 9, 16, S.hi); rect(17, 9, 2, 16, S.shade);
  rect(11, 21, 10, 2, S.base); hline(11, 21, 10, S.hi);
  ellipse(16, 9, 12, 4.5, S.shade);
  ellipse(16, 7, 13, 4.5, S.base);
  ellipse(15.5, 6.5, 10, 2.8, GL.base);
  hline(10, 6, 6, GL.hi); px(18, 7, GL.hi);
  hline(6, 4, 3, S.hi);
  if (f === 1) {
    const C = R.cloth;
    ellipse(25, 1, 3.5, 2.2, C.base); rect(23, 0, 3, 1, C.hi);
    ellipse(28, -1.5, 2, 2, C.base); px(28, -2, C.hi);
    px(29, -2, OL); px(30, -1, R.coin.shade); px(31, -1, R.coin.shade);
    px(21, 0, C.shade); px(25, 3, R.coin.dark);
  }
  endObj(OL);
});

/* ================================================================ mailbox */
// 0 flag down, 1 flag up. Ground line at tile y 26 (in front of the front fence run).
def('mailbox', 32, 56, 0, 24, 16, 26, 2, function (f) {
  const S = R.steel, D = R.woodD;
  shadowEll(17, 26, 6, 2, AL.shadowPerson);
  beginObj();
  rect(14, 2, 4, 24, D.base); vline(14, 2, 24, D.hi); vline(17, 2, 24, D.shade);
  obox(10, 3, 11, 8, 9, S, { rimC: S.hi });
  erase(10, -14); erase(10, -13); erase(11, -14); erase(20, -14);
  rect(12, -4, 7, 6, S.shade); rect(13, -3, 5, 4, S.base); px(15, -1, S.dark);
  if (f === 0) { rect(22, -4, 6, 2, R.drum.base); px(22, -4, R.drum.hi); }
  else { vline(23, -14, 10, R.drum.dark); rect(24, -14, 5, 4, R.drum.base); hline(24, -14, 5, R.drum.hi); }
  endObj(OL);
});

/* ================================================================ dog */
// Side view facing left (flip for right). 0 to 3 walk, 4 sit, 5 sleep, 6 sleep breathing in.
def('dog', 32, 24, 0, 0, 16, 22, 7, function (f) {
  const B = R.fur, D = R.woodD, M = R.logEnd;
  shadowEll(16, 22, 11, 2, AL.shadowPerson);
  beginObj();
  if (f <= 3) {
    const bob = f & 1 ? -1 : 0;
    const lift = [[0, 2, 0, 2], [0, 0, 0, 0], [2, 0, 2, 0], [0, 0, 0, 0]][f];
    [10, 13, 20, 23].forEach(function (x, i) {
      const c = i === 1 || i === 3 ? B.shade : B.base;
      rect(x, 16 + bob, 2, 6 - lift[i] - (bob ? 0 : 0), c);
      px(x, 21 - lift[i], D.base); px(x + 1, 21 - lift[i], D.base);
    });
    line(25, 11 + bob, 28, 7 + bob, B.base); line(26, 11 + bob, 29, 7 + bob, B.hi);
    ellipse(17, 13 + bob, 8.5, 4.5, B.base);
    hline(11, 9 + bob, 12, B.hi);
    rect(12, 16 + bob, 11, 1, B.shade);
    ellipse(19, 10 + bob, 5, 2, D.base);
    ellipse(8, 9 + bob, 4.5, 4, B.base);
    rect(2, 9 + bob, 5, 3, M.hi); px(2, 11 + bob, M.base);
    px(1, 9 + bob, OL); px(2, 9 + bob, OL);
    px(7, 8 + bob, OL); px(6, 8 + bob, UI.white);
    rect(9, 5 + bob, 3, 6, D.base); px(9, 10 + bob, D.shade);
    vline(11, 10 + bob, 4, R.drum.base); px(11, 14 + bob, R.coin.base);
  } else if (f === 4) {
    line(24, 21, 29, 20, B.base); line(24, 20, 28, 19, B.hi);
    ellipse(20, 17, 6.5, 4.5, B.base);
    ellipse(17, 13, 5.5, 6.5, B.base);
    rect(13, 15, 2, 7, B.base); rect(16, 15, 2, 7, B.shade);
    px(13, 21, D.base); px(14, 21, D.base); px(16, 21, D.base); px(17, 21, D.base);
    ellipse(19, 10, 3, 4, D.base);
    ellipse(12, 6, 4.5, 4, B.base);
    rect(6, 6, 5, 3, M.hi); px(6, 8, M.base);
    px(5, 6, OL); px(6, 6, OL);
    px(11, 5, OL); px(10, 5, UI.white);
    rect(13, 2, 3, 6, D.base);
    vline(15, 8, 3, R.drum.base); px(15, 11, R.coin.base);
  } else {
    const br = f === 6 ? 1 : 0;
    ellipse(17, 17 - br * 0.5, 11, 5 + br * 0.5, B.base);
    hline(9, 12 - br, 14, B.hi);
    ellipse(19, 14 - br, 6, 2, D.base);
    line(20, 21, 27, 20, B.hi); line(21, 21, 28, 20, B.base);
    rect(5, 20, 4, 2, M.hi); rect(10, 20, 3, 2, M.hi);       // tucked front paws
    ellipse(7, 16.5, 4.5, 3.5, B.base);
    vline(11, 14, 6, B.shade);                                 // where the head rests on the body
    hline(5, 14, 4, B.hi);
    rect(2, 17, 4, 3, M.hi);
    px(1, 17, OL); px(2, 17, OL);
    hline(6, 16, 2, OL);
    rect(8, 13, 3, 6, D.base); px(8, 18, D.shade);
    ellipse(26, 19, 2, 1.5, B.hi);                             // tail tip curled round
  }
  endObj(OL);
});

/* ================================================================ sign text (5 x 7 pixel font) */
// The glyph set from screen-1-season.html (A to Z, a to z, digits, punctuation). Rows 7 and 8 are
// descenders. Bold lights each pixel and the one to its right.
const FONT = {
  A: ['.###.', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'], B: ['####.', '#...#', '#...#', '####.', '#...#', '#...#', '####.'],
  C: ['.###.', '#...#', '#....', '#....', '#....', '#...#', '.###.'], D: ['####.', '#...#', '#...#', '#...#', '#...#', '#...#', '####.'],
  E: ['#####', '#....', '#....', '####.', '#....', '#....', '#####'], F: ['#####', '#....', '#....', '####.', '#....', '#....', '#....'],
  G: ['.###.', '#...#', '#....', '#.###', '#...#', '#...#', '.####'], H: ['#...#', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  I: ['###', '.#.', '.#.', '.#.', '.#.', '.#.', '###'], J: ['..###', '...#.', '...#.', '...#.', '...#.', '#..#.', '.##..'],
  K: ['#...#', '#..#.', '#.#..', '##...', '#.#..', '#..#.', '#...#'], L: ['#....', '#....', '#....', '#....', '#....', '#....', '#####'],
  M: ['#...#', '##.##', '#.#.#', '#.#.#', '#...#', '#...#', '#...#'], N: ['#...#', '#...#', '##..#', '#.#.#', '#..##', '#...#', '#...#'],
  O: ['.###.', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'], P: ['####.', '#...#', '#...#', '####.', '#....', '#....', '#....'],
  Q: ['.###.', '#...#', '#...#', '#...#', '#.#.#', '#..#.', '.##.#'], R: ['####.', '#...#', '#...#', '####.', '#.#..', '#..#.', '#...#'],
  S: ['.####', '#....', '#....', '.###.', '....#', '....#', '####.'], T: ['#####', '..#..', '..#..', '..#..', '..#..', '..#..', '..#..'],
  U: ['#...#', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'], V: ['#...#', '#...#', '#...#', '#...#', '#...#', '.#.#.', '..#..'],
  W: ['#...#', '#...#', '#...#', '#.#.#', '#.#.#', '#.#.#', '.#.#.'], X: ['#...#', '#...#', '.#.#.', '..#..', '.#.#.', '#...#', '#...#'],
  Y: ['#...#', '#...#', '.#.#.', '..#..', '..#..', '..#..', '..#..'], Z: ['#####', '....#', '...#.', '..#..', '.#...', '#....', '#####'],
  a: ['.....', '.....', '.###.', '....#', '.####', '#...#', '.####'], b: ['#....', '#....', '####.', '#...#', '#...#', '#...#', '####.'],
  c: ['.....', '.....', '.###.', '#....', '#....', '#....', '.###.'], d: ['....#', '....#', '.####', '#...#', '#...#', '#...#', '.####'],
  e: ['.....', '.....', '.###.', '#...#', '#####', '#....', '.###.'], f: ['..##', '.#..', '####', '.#..', '.#..', '.#..', '.#..'],
  g: ['.....', '.....', '.####', '#...#', '#...#', '#...#', '.####', '....#', '.###.'], h: ['#....', '#....', '####.', '#...#', '#...#', '#...#', '#...#'],
  i: ['.#.', '...', '##.', '.#.', '.#.', '.#.', '###'], j: ['...#', '....', '..##', '...#', '...#', '...#', '...#', '#..#', '.##.'],
  k: ['#...', '#...', '#..#', '#.#.', '##..', '#.#.', '#..#'], l: ['##.', '.#.', '.#.', '.#.', '.#.', '.#.', '###'],
  m: ['.....', '.....', '##.#.', '#.#.#', '#.#.#', '#.#.#', '#.#.#'], n: ['.....', '.....', '####.', '#...#', '#...#', '#...#', '#...#'],
  o: ['.....', '.....', '.###.', '#...#', '#...#', '#...#', '.###.'], p: ['.....', '.....', '####.', '#...#', '#...#', '#...#', '####.', '#....', '#....'],
  q: ['.....', '.....', '.####', '#...#', '#...#', '#...#', '.####', '....#', '....#'], r: ['.....', '.....', '#.##.', '##..#', '#....', '#....', '#....'],
  s: ['.....', '.....', '.####', '#....', '.###.', '....#', '####.'], t: ['.#..', '.#..', '####', '.#..', '.#..', '.#.#', '..#.'],
  u: ['.....', '.....', '#...#', '#...#', '#...#', '#..##', '.##.#'], v: ['.....', '.....', '#...#', '#...#', '#...#', '.#.#.', '..#..'],
  w: ['.....', '.....', '#...#', '#...#', '#.#.#', '#.#.#', '.#.#.'], x: ['.....', '.....', '#...#', '.#.#.', '..#..', '.#.#.', '#...#'],
  y: ['.....', '.....', '#...#', '#...#', '#...#', '#...#', '.####', '....#', '.###.'], z: ['.....', '.....', '#####', '...#.', '..#..', '.#...', '#####'],
  '0': ['.###.', '#...#', '#..##', '#.#.#', '##..#', '#...#', '.###.'], '1': ['.#.', '##.', '.#.', '.#.', '.#.', '.#.', '###'],
  '2': ['.###.', '#...#', '....#', '...#.', '..#..', '.#...', '#####'], '3': ['####.', '....#', '....#', '.###.', '....#', '....#', '####.'],
  '4': ['...#.', '..##.', '.#.#.', '#..#.', '#####', '...#.', '...#.'], '5': ['#####', '#....', '####.', '....#', '....#', '#...#', '.###.'],
  '6': ['.###.', '#....', '#....', '####.', '#...#', '#...#', '.###.'], '7': ['#####', '....#', '...#.', '..#..', '.#...', '.#...', '.#...'],
  '8': ['.###.', '#...#', '#...#', '.###.', '#...#', '#...#', '.###.'], '9': ['.###.', '#...#', '#...#', '.####', '....#', '....#', '.###.'],
  '.': ['.', '.', '.', '.', '.', '.', '#'], ',': ['..', '..', '..', '..', '..', '.#', '.#', '#.'],
  ':': ['.', '.', '#', '.', '.', '#', '.'], '/': ['....#', '....#', '...#.', '..#..', '.#...', '#....', '#....'],
  '!': ['#', '#', '#', '#', '#', '.', '#'], '?': ['.###.', '#...#', '....#', '..##.', '..#..', '.....', '..#..'],
  '+': ['.....', '..#..', '..#..', '#####', '..#..', '..#..', '.....'], "'": ['#', '#', '.', '.', '.', '.', '.'],
  '&': ['.##..', '#..#.', '#.#..', '.#...', '#.#.#', '#..#.', '.##.#'], '-': ['....', '....', '....', '####', '....', '....', '....'],
  ' ': ['..', '..', '..', '..', '..', '..', '..']
};
function validateFont() {
  Object.keys(FONT).forEach(function (ch) {
    const g = FONT[ch];
    if (!Array.isArray(g) || (g.length !== 7 && g.length !== 8 && g.length !== 9)) throw new Error('art3 yard: glyph "' + ch + '" has ' + (g && g.length) + ' rows, expected 7 to 9');
    const w = g[0].length;
    g.forEach(function (row, r) {
      if (row.length !== w) throw new Error('art3 yard: glyph "' + ch + '" row ' + r + ' is ' + row.length + ' wide, expected ' + w);
      if (!/^[.#]+$/.test(row)) throw new Error('art3 yard: glyph "' + ch + '" row ' + r + ' has a character outside ".#"');
    });
  });
}
function glyph(ch) { return FONT[ch] || null; }
function lineWidth(s, bold) {
  let w = 0, n = 0;
  for (const ch of s) { const g = glyph(ch); if (!g) continue; w += g[0].length + (bold ? 2 : 1); n++; }
  return n ? w - 1 : 0;
}
function hasDesc(s) { for (const ch of s) { const g = glyph(ch); if (g && g.length > 7) return true; } return false; }
// Best two line split at a space: the one with the narrowest wider line.
function split2(s, bold) {
  let best = null;
  for (let i = 1; i < s.length - 1; i++) {
    if (s[i] !== ' ') continue;
    const a = s.slice(0, i).trim(), b = s.slice(i + 1).trim();
    if (!a || !b) continue;
    const w = Math.max(lineWidth(a, bold), lineWidth(b, bold));
    if (!best || w < best.w) best = { lines: [a, b], w: w };
  }
  return best;
}
// Fit a pit name to the panel: bold one line, bold two lines, regular one line, regular two lines,
// then regular one line cut to fit. Any 14 character name fits at regular weight on one line.
const DASHES = new RegExp('[' + String.fromCharCode(0x2013, 0x2014) + ']', 'g'); // long dashes become hyphens
function layoutSign(text, maxW) {
  // A newline asks for two lines (gold over orange, as mock B's YOUR / PIT) when both fit.
  const forced = String(text == null ? '' : text).replace(DASHES, '-').split('\n')
    .map(function (t) { return t.replace(/\s+/g, ' ').trim(); }).filter(function (t) { return t.length > 0; });
  if (forced.length === 2) {
    if (Math.max(lineWidth(forced[0], true), lineWidth(forced[1], true)) <= maxW) return { lines: forced, bold: true };
    if (Math.max(lineWidth(forced[0], false), lineWidth(forced[1], false)) <= maxW) return { lines: forced, bold: false };
  }
  const s = String(text == null ? '' : text).replace(DASHES, '-').replace(/\s+/g, ' ').trim();
  if (lineWidth(s, true) <= maxW) return { lines: [s], bold: true };
  let sp = split2(s, true);
  if (sp && sp.w <= maxW) return { lines: sp.lines, bold: true };
  if (lineWidth(s, false) <= maxW) return { lines: [s], bold: false };
  sp = split2(s, false);
  if (sp && sp.w <= maxW) return { lines: sp.lines, bold: false };
  let t = s;
  while (t.length > 1 && lineWidth(t, false) > maxW) t = t.slice(0, -1);
  return { lines: [t.trim()], bold: false, cut: true };
}
function paintText(s, x, y, c, bold) {
  let cx = x;
  for (const ch of s) {
    const g = glyph(ch);
    if (!g) continue;
    for (let r = 0; r < g.length; r++) for (let k = 0; k < g[r].length; k++) {
      if (g[r][k] !== '#') continue;
      px(cx + k, y + r, c);
      // bold lights the pixel to the right unless that would close a 1 px gap (m, w, M, W, G stay legible)
      if (bold && (g[r][k + 1] === '#' || g[r][k + 2] !== '#')) px(cx + k + 1, y + r, c);
    }
    cx += g[0].length + (bold ? 2 : 1);
  }
}
const signCache = Object.create(null);
let signCacheN = 0;
function paintText2(s, x, y, c, bold) {
  let cx = x;
  for (const ch of s) {
    const g = glyph(ch);
    if (!g) continue;
    for (let r = 0; r < g.length; r++) for (let k = 0; k < g[r].length; k++) {
      if (g[r][k] !== '#') continue;
      rect(cx + 2 * k, y + 2 * r, 2, 2, c);
      if (bold && (g[r][k + 1] === '#' || g[r][k + 2] !== '#')) rect(cx + 2 * k + 2, y + 2 * r, 2, 2, c);
    }
    cx += 2 * (g[0].length + (bold ? 2 : 1));
  }
}
function signCanvas(text) {
  const key = String(text);
  if (signCache[key]) return signCache[key];
  const p = SIGN.panel;
  const tones = [[R.coin.base, R.coin.dark], [ANCHOR.O, R.drum.shade]];
  // Round 1: chunky 2x lettering when the name fits at 2x bold; else the 1x layouts below.
  const lay2 = layoutSign(key, Math.floor((p.w - 4) / 2));
  const fits2 = lay2.bold && !lay2.cut && lay2.lines.length * 16 + (lay2.lines.length - 1) * 3 + 2 <= p.h &&
    !lay2.lines.some(hasDesc);
  surface(p.w, p.h);
  let lay;
  if (fits2) {
    lay = { lines: lay2.lines, bold: true, scale: 2 };
    const n = lay.lines.length, blockH = n * 16 + (n - 1) * 3;
    let y = Math.max(1, Math.floor((p.h - blockH) / 2));
    beginObj();
    lay.lines.forEach(function (ln, i) {
      const w = lineWidth(ln, true) * 2;
      const x = Math.floor((p.w - w) / 2);
      const tone = tones[n === 1 ? 0 : i];
      paintText2(ln, x, y + 2, tone[1], true);
      paintText2(ln, x, y, tone[0], true);
      y += 16 + 3;
    });
    endObj('#000000');
  } else {
    const lay1 = layoutSign(key, p.w - 4);
    lay = lay1; lay.scale = 1;
    const n = lay.lines.length;
    const descLast = hasDesc(lay.lines[n - 1]);
    const blockH = n === 1 ? 8 + (descLast ? 2 : 0) : 8 + 3 + 8 + (descLast ? 2 : 0) + (hasDesc(lay.lines[0]) ? 2 : 0);
    let y = Math.max(1, Math.floor((p.h - blockH) / 2));
    lay.lines.forEach(function (ln, i) {
      const w = lineWidth(ln, lay.bold);
      const x = Math.floor((p.w - w) / 2);
      const tone = tones[n === 1 ? 0 : i];
      paintText(ln, x, y + 1, tone[1], lay.bold);
      paintText(ln, x, y, tone[0], lay.bold);
      y += 8 + 3 + (hasDesc(ln) ? 2 : 0);
    });
  }
  const c = toCanvas();
  c.layout = lay;
  if (signCacheN > 64) { Object.keys(signCache).forEach(function (k) { delete signCache[k]; }); signCacheN = 0; }
  signCache[key] = c; signCacheN++;
  return c;
}
// Draws a pit name on the sign's panel. (x, y) is the sign sprite's top left, as for draw(ctx, 'sign', x, y).
// Returns the layout: { lines, bold, cut }.
function signText(ctx, text, x, y) {
  const c = signCanvas(text);
  ctx.drawImage(c, Math.round(x) + SIGN.panel.x, Math.round(y) + SIGN.panel.y);
  return c.layout;
}

/* ================================================================ build and draw */
let built = false, buildMs = 0;
function build() {
  if (built) return;
  const t0 = (G.performance && G.performance.now) ? G.performance.now() : Date.now();
  validateFont();
  DEFS.forEach(function (d) {
    if (!(d.w > 0 && d.h > 0 && d.n > 0)) throw new Error('art3 yard: sprite "' + d.name + '" has a bad size or frame count');
    const frames = [];
    for (let f = 0; f < d.n; f++) {
      surface(d.w, d.h);
      OX = d.ox; OY = d.oy;
      d.paint(f, mulberry(strSeed(d.name + ':' + f)));
      OX = 0; OY = 0;
      frames.push(toCanvas());
    }
    SPR[d.name] = { w: d.w, h: d.h, ax: d.ax, ay: d.ay, ox: d.ox, oy: d.oy, frames: frames, flips: [] };
  });
  built = true;
  buildMs = ((G.performance && G.performance.now) ? G.performance.now() : Date.now()) - t0;
}
function has(name) { return DEFS.some(function (d) { return d.name === name; }); }
function names() { return DEFS.map(function (d) { return d.name; }); }
function frames(name) { const d = DEFS.find(function (q) { return q.name === name; }); return d ? d.n : 0; }
function spr(name) {
  if (!built) build();
  const s = SPR[name];
  if (!s) throw new Error('art3 yard: unknown sprite "' + name + '"');
  return s;
}
function frameCanvas(name, frame, flip) {
  const s = spr(name), n = s.frames.length;
  let f = Math.trunc(Number(frame) || 0);
  f = ((f % n) + n) % n;
  if (!flip) return s.frames[f];
  if (!s.flips[f]) {
    const c = document.createElement('canvas');
    c.width = s.w; c.height = s.h;
    const g = c.getContext('2d');
    g.translate(s.w, 0); g.scale(-1, 1); g.drawImage(s.frames[f], 0, 0);
    s.flips[f] = c;
  }
  return s.flips[f];
}
function size(name) { const s = spr(name); return [s.w, s.h]; }
function anchor(name) { const s = spr(name); return { ax: s.ax, ay: s.ay }; }
// Top left in world render px for a sprite placed on tile (tx, ty) (its footprint's top left tile).
function placeTile(name, tx, ty) { const s = spr(name); return { x: tx * TILE - s.ox, y: ty * TILE - s.oy }; }
function draw(ctx, name, x, y, frame, flip) { ctx.drawImage(frameCanvas(name, frame, flip === true), Math.round(x), Math.round(y)); }
// By anchor: a flip mirrors about ax.
function drawAt(ctx, name, ax, ay, frame, flip) {
  const s = spr(name);
  const x = flip === true ? ax - (s.w - s.ax) : ax - s.ax;
  draw(ctx, name, x, ay - s.ay, frame, flip);
}
function drawTile(ctx, name, tx, ty, frame, flip) { const p = placeTile(name, tx, ty); draw(ctx, name, p.x, p.y, frame, flip); }
function drawScaled(ctx, name, x, y, w, h, frame, flip) {
  const src = frameCanvas(name, frame, flip === true);
  if (!(w >= 1) || !(h >= 1)) return;
  const prev = ctx.imageSmoothingEnabled;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(src, x, y, w, h);
  ctx.imageSmoothingEnabled = prev;
}
function canvasFor(name, frame, scale) {
  const src = frameCanvas(name, frame, false);
  const k = Math.max(1, Math.trunc(Number(scale) || 1));
  const c = document.createElement('canvas');
  c.width = src.width * k; c.height = src.height * k;
  const g = c.getContext('2d');
  g.imageSmoothingEnabled = false;
  g.drawImage(src, 0, 0, c.width, c.height);
  return c;
}

/* ================================================================ string lights between any two hooks */
const stringCache = Object.create(null);
// Draws a wire with bulbs from (x0, y0) to (x1, y1) in world px, sagging `sag` px. Cached per shape.
function lightsString(ctx, x0, y0, x1, y1, sag, frame) {
  const s = sag == null ? 14 : sag, f = (frame | 0) & 1;
  const dx = Math.round(x1 - x0), dy = Math.round(y1 - y0);
  const key = dx + ',' + dy + ',' + s + ',' + f;
  let c = stringCache[key];
  if (!c) {
    const minY = Math.min(0, dy) - 2, maxY = Math.max(0, dy) + s + 10;
    const minX = Math.min(0, dx) - 2, maxX = Math.max(0, dx) + 3;
    surface(maxX - minX, maxY - minY);
    OX = -minX; OY = -minY;
    paintString(0, 0, dx, dy, s, f);
    OX = 0; OY = 0;
    c = toCanvas(); c.ox = minX; c.oy = minY;
    stringCache[key] = c;
  }
  ctx.drawImage(c, Math.round(x0) + c.ox, Math.round(y0) + c.oy);
}
function lightHook(tx, ty) { return { x: tx * TILE + LIGHT_HOOK.x, y: ty * TILE + LIGHT_HOOK.y }; }

/* ================================================================ map helpers */
function mapAt(map, x, y) {
  if (!(x >= 0 && x < map.W && y >= 0 && y < map.H)) return map.T.FENCE;
  if (typeof map.at === 'function') return map.at(x, y);
  return map.tiles[y * map.W + x];
}
// Which yard sprite stands on tile (x, y): fence pieces, gate, hedge, bed. null for open ground.
// opts.gateOpen, opts.bedSoil (unbought flower bed), opts.bloom (hedge blossom on).
function pick(map, x, y, opts) {
  const o = opts || {}, T_ = map.T, t = mapAt(map, x, y), W = map.W, H = map.H;
  let name = null, frame = 0;
  if (t === T_.FENCE) {
    const L = x === 0, Rt = x === W - 1, Tp = y === 0, B = y === H - 1;
    if ((L || Rt) && (Tp || B)) { name = 'fence_corner'; frame = (Tp ? 0 : 2) + (Rt ? 1 : 0); }
    else if (Tp) { name = 'fence_back'; frame = x % 4 === 3 ? 1 : 0; }
    else if (B) name = 'fence_front';
    else if (L || Rt) { name = 'fence_side'; frame = L ? 0 : 1; }
    else name = 'fence_back';
  } else if (t === T_.GATE) { name = 'gate'; frame = o.gateOpen ? 1 : 0; }
  else if (t === T_.HEDGE) {
    const m = (mapAt(map, x - 1, y) === T_.HEDGE ? 1 : 0) | (mapAt(map, x + 1, y) === T_.HEDGE ? 2 : 0);
    name = 'hedge'; frame = m + (o.bloom && (x * 7 + y * 3) % 3 === 0 ? 4 : 0);
  } else if (t === T_.BED) {
    const b = function (dx, dy) { return mapAt(map, x + dx, y + dy) === T_.BED; };
    name = 'bed'; frame = (b(0, -1) ? 1 : 0) | (b(1, 0) ? 2 : 0) | (b(0, 1) ? 4 : 0) | (b(-1, 0) ? 8 : 0);
    if (o.bedSoil) frame += 16;
  }
  if (!name) return null;
  const p = placeTile(name, x, y);
  return { name: name, frame: frame, x: p.x, y: p.y, k: rowKey(y) };
}

/* ================================================================ ground(ctx, map, opts) */
// Static ground for a map into a cached canvas (map.W * 32 by map.H * 32): pavers, lawn with mowed
// stripes, stepping stones on the path, the curb where paver meets lawn, and foliage behind the
// fences. No standing object is baked in. opts.path: [{x, y}] tiles for stepping stones (default:
// the gate column up to the first non lawn tile); opts.clover: [{x, y}] tiles for the clover frame.
// Draws the cache at (0, 0) when ctx is given; returns the canvas.
const groundCache = Object.create(null);
function ground(ctx, map, opts) {
  const o = opts || {};
  const W = map.W, H = map.H, T_ = map.T;
  const tiles = [];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) tiles.push(mapAt(map, x, y));
  let path = o.path;
  if (!path) {
    path = [];
    const g = map.gate || null;                    // tile coordinates, as sim.js MAP.gate
    if (g) for (let y = g.y - 1; y >= 0 && mapAt(map, g.x, y) === T_.LAWN; y--) path.push({ x: g.x, y: y });
  }
  const clover = o.clover || [];
  if (o.iso) {
    const ik = 'iso:' + W + 'x' + H + ':' + JSON.stringify(o.iso);
    let ic = groundCache[ik];
    if (!ic) { ic = paintGroundIso(W, H, o.iso); groundCache[ik] = ic; }
    if (ctx) ctx.drawImage(ic, 0, 0);
    return ic;
  }
  const key = W + 'x' + H + ':' + tiles.join('') + ':' + path.map(function (p) { return p.x + ',' + p.y; }).join(';') + ':' + clover.map(function (p) { return p.x + ',' + p.y; }).join(';');
  let c = groundCache[key];
  if (!c) {
    c = paintGround(map, W, H, T_, path, clover);
    groundCache[key] = c;
  }
  if (ctx) ctx.drawImage(c, 0, 0);
  return c;
}
function paintGround(map, W, H, T_, path, clover) {
  surface(W * TILE, H * TILE);
  const isPath = Object.create(null), isClover = Object.create(null);
  path.forEach(function (p) { isPath[p.x + ',' + p.y] = true; });
  clover.forEach(function (p) { isClover[p.x + ',' + p.y] = true; });
  let lawnFrom = H;
  for (let y = 0; y < H && lawnFrom === H; y++) for (let x = 0; x < W; x++) if (mapAt(map, x, y) === T_.LAWN) { lawnFrom = y; break; }
  const stripe = typeof map.stripe === 'function' ? function (x) { return map.stripe(x); } : function (x) { return (x & 1) === 0 ? 'a' : 'b'; };
  // ground kind per tile: 'p' paver, 'l' lawn
  function kind(x, y) {
    const t = mapAt(map, x, y);
    if (t === T_.PAVER) return 'p';
    if (t === T_.LAWN || t === T_.GATE || t === T_.BED) return 'l';
    if (t === T_.HEDGE) return y >= lawnFrom - 1 ? 'l' : 'p';
    if (t === T_.FENCE) {
      const ix = Math.min(W - 2, Math.max(1, x)), iy = Math.min(H - 2, Math.max(1, y));
      if (ix === x && iy === y) return 'p';
      return kind(ix, iy);
    }
    return y >= lawnFrom ? 'l' : 'p';
  }
  const K = [];
  for (let y = 0; y < H; y++) { K.push([]); for (let x = 0; x < W; x++) K[y].push(kind(x, y)); }
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const X = x * TILE, Y = y * TILE;
    if (K[y][x] === 'p') {
      paverTile(X, Y, function (cx, cy) {
        const u = hash2(X + cx, Y + cy, 77);
        return PAVER_FILL[Math.floor(u * PAVER_FILL.length)];
      });
    } else {
      const v = isClover[x + ',' + y] ? 1 : ((x * 5 + y * 3) % 3 === 0 ? 2 : 0);
      lawnTile(X, Y, stripe(x), x, y, v);
    }
  }
  // curb where paver meets lawn, with a 1 px step shadow on the lawn side
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (K[y][x] !== 'p') continue;
    const X = x * TILE, Y = y * TILE;
    if (y + 1 < H && K[y + 1][x] === 'l') { hline(X, Y + 31, TILE, R.paver.dark); hline(X, Y + 32, TILE, R.lawnB.dark); }
    if (y > 0 && K[y - 1][x] === 'l') hline(X, Y, TILE, R.paver.dark);
    if (x + 1 < W && K[y][x + 1] === 'l') vline(X + 31, Y, TILE, R.paver.dark);
    if (x > 0 && K[y][x - 1] === 'l') vline(X, Y, TILE, R.paver.dark);
  }
  // stepping stones on the path tiles and under the gate
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const t = mapAt(map, x, y);
    if (isPath[x + ',' + y] || t === T_.GATE) stones(x * TILE, y * TILE, (x + y) & 1);
  }
  // foliage behind the fences (outside the picket lines)
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (mapAt(map, x, y) !== T_.FENCE) continue;
    const X = x * TILE, Y = y * TILE, seed = strSeed('fol:' + x + ',' + y);
    if (y === H - 1) continue;
    if (x === 0) foliage(X, Y, 22, TILE, seed);
    if (x === W - 1) foliage(X + 10, Y, 22, TILE, seed + 1);
    if (y === 0) foliage(X, Y, TILE, 30, seed + 2);
  }
  if (H > 1) {
    if (mapAt(map, 0, H - 1) === T_.FENCE) foliage(0, (H - 1) * TILE, 22, 10, strSeed('fol:bl'));
    if (mapAt(map, W - 1, H - 1) === T_.FENCE) foliage((W - 1) * TILE + 10, (H - 1) * TILE, 22, 10, strSeed('fol:br'));
  }
  return toCanvas();
}

/* ================================================================ the iso ground (round 1) */
// Mock B's ground on the square canvas: warm cobbles on the patio, the upper diagonal half, and a
// soft lawn diamond checker below, split by a V of two 2:1 edges meeting at iso.vertex (the edge
// falls from the left down to the vertex, then rises to the right). Above the back lines through
// iso.corner (the back fence and the barn foot) the ground stays clear so the backdrop shows.
// iso.stones: [[x, y]] stepping stone centres (2:1 ellipses, own shadow, no outline).
// Pavers stay on the 32 x 16 lattice, so with the vertex on a lattice point the edge runs along grout.
function paintGroundIso(W, H, iso) {
  const w = W * TILE, h = H * TILE;
  const cx = iso.corner[0], cy = iso.corner[1], vx = iso.vertex[0], vy = iso.vertex[1];
  const back = function (x) { return cy + Math.abs(x - cx) / 2; };
  const front = function (x) { return vy - Math.abs(x - vx) / 2; };
  // pavers everywhere, 2 px grout, warm fills with stronger value steps
  surface(w, h);
  const P = R.paver;
  const FILL = [P.base, P.shade, P.alt, P.base, P.alt, P.shade];
  for (let k = 0; k < 2; k++) for (let j = -1; j * 16 + k * 8 <= h + 16; j++) for (let i = -1; i * 32 + k * 16 <= w + 32; i++) {
    const X = i * 32 + k * 16, Y = j * 16 + k * 8;
    poly([[X, Y - 8], [X + 16, Y], [X, Y + 8], [X - 16, Y]], P.grout || P.dark);
    const fc = FILL[Math.floor(hash2(X, Y, 91) * FILL.length)];
    poly([[X, Y - 6], [X + 12, Y], [X, Y + 6], [X - 12, Y]], fc);
    for (let t = 0; t < 4; t++) { px(X - 9 + 2 * t, Y - 1 - t, P.hi); px(X - 8 + 2 * t, Y - 1 - t, P.hi); }
    for (let t = 0; t < 3; t++) { px(X + 3 + 2 * t, Y + 4 - t, P.dark); px(X + 4 + 2 * t, Y + 4 - t, P.dark); }
    if (hash2(X, Y, 17) < 0.3) { px(X - 2, Y + 1, P.shade); px(X + 1, Y - 2, P.shade); }
  }
  const pav = MAIN;
  // lawn: diamond checker of the two lawn bases, tufts and a little clover
  surface(w, h);
  for (let j = -1; j * 8 <= h + 16; j++) for (let i = -1; i * 32 <= w + 32; i++) {
    const X = i * 32 + ((j & 1) ? 16 : 0), Y = j * 8;
    const a = (j & 1) === 0;                        // neighbours along both iso axes are the next rows
    poly([[X, Y - 8], [X + 16, Y], [X, Y + 8], [X - 16, Y]], a ? R.lawnA.base : R.lawnB.base);
  }
  const rnd = mulberry(strSeed('lawn:iso'));
  for (let k = 0; k < Math.round(w * h / 300); k++) {
    const x = Math.floor(rnd() * w), y = Math.floor(rnd() * h);
    if (rnd() < 0.5) { px(x, y, R.lawnA.hi); px(x + 1, y - 1, R.lawnA.hi); px(x + 2, y, R.lawnA.hi); }
    else { px(x, y, R.lawnA.dark); px(x + 1, y, R.lawnA.dark); }
  }
  for (let k = 0; k < 10; k++) {
    const x = 6 + Math.floor(rnd() * (w - 12)), y = 6 + Math.floor(rnd() * (h - 12));
    px(x, y + 1, R.stem.base); px(x, y, R.flowers[2]); px(x + 1, y, R.flowers[2]); px(x, y - 1, R.flowers[2]);
  }
  const lawn = MAIN;
  surface(w, h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const k = y * w + x;
    if (y < back(x + 0.5)) continue;
    MAIN[k] = y + 0.5 < front(x + 0.5) ? pav[k] : lawn[k];
  }
  // curb along the V: a grout line on the patio side, a dark step on the lawn side
  for (let x = 0; x < w; x++) {
    const y = Math.floor(front(x + 0.5) - 0.5);
    if (y < back(x) || y >= h) continue;
    px(x, y, P.grout || P.dark); px(x, y - 1, P.dark);
    if (y + 1 < h) px(x, y + 1, R.lawnB.dark);
  }
  // stepping stones
  (iso.stones || []).forEach(function (s) {
    ellipse(s[0] + 1, s[1] + 2, 9, 4.5, R.lawnB.dark);
    ellipse(s[0], s[1], 9, 4.5, R.stone.shade);
    ellipse(s[0] - 0.5, s[1] - 0.8, 8, 3.6, R.stone.base);
    ellipse(s[0] - 2, s[1] - 2, 4, 1.6, R.stone.hi);
  });
  return toCanvas();
}

/* ================================================================ register */
const yard = {
  TILE: TILE,
  SIGN: SIGN,
  SEATS: SEATS,
  LIGHT_HOOK: LIGHT_HOOK,
  build: build,
  has: has,
  names: names,
  frames: frames,
  size: size,
  anchor: anchor,
  placeTile: placeTile,
  draw: draw,
  drawAt: drawAt,
  drawTile: drawTile,
  drawScaled: drawScaled,
  canvasFor: canvasFor,
  pick: pick,
  lightsString: lightsString,
  lightHook: lightHook,
  signHook: function (x, y) { return { x: Math.round(x) + SIGN.hook.x, y: Math.round(y) + SIGN.hook.y }; },
  PICNIC: PICNIC,
  BACK_CORNER: BACK_CORNER,
  BARN: BARN,
  ground: ground,
  signText: signText,
  layoutSign: function (text) { return layoutSign(text, SIGN.panel.w - 4); }
};
Object.defineProperty(yard, 'built', { enumerable: true, get: function () { return built; } });
Object.defineProperty(yard, 'buildMs', { enumerable: true, get: function () { return buildMs; } });

validateFont();
art3.yard = yard;
art3.sheets = art3.sheets || {};
art3.sheets.yard = yard;
art3.ground = ground;
art3.signText = signText;
})();
