'use strict';
/*
 * games/pit-sim/art3/kit.js  (v3 art library, the cook kit)
 * Registers PitSim.art3.kit: every cooker and kit item in the iso view drawn on the orthogonal grid (art
 * bible (docs/superpowers/specs/2026-10-18-pit-sim-art3-bible.md, sections 1 and 3), drawn in
 * the look of docs/superpowers/mocks/pit-sim-v3/b-iso-pixel.png (mock B). Depends on palette.js
 * and proj.js (PitSim.art3.PAL, PitSim.art3.proj isoP and isoFaces: one box geometry with yard.js).
 * Not loaded by the game yet; v3.4 swaps it in. No dependencies, no external resources.
 *
 * Adds to PitSim.art3 and replaces nothing:
 *   art3.kit            this file's sprite set and API (below)
 *   art3.parts.kit      the same object, for index.js to merge every category file
 *   art3.box            the shared iso prop helper box(ctx, fx, fy, U, V, H, ramp, opts), if unset
 *   art3.draw           a dispatcher over art3.parts, only if no other file set it first
 *
 * Sprites, frames (anchor = bottom centre of the footprint, in cell px):
 *   kettle        32x52  0 cold, 1 lit low, 2 lit good, 3 lit hot, 4 lid open (fire good)
 *   drum          32x72  0 cold, 1 low, 2 good, 3 hot           footprint 1 x 2 tiles
 *   cabinet       32x76  0 cold, 1 low, 2 good, 3 hot           footprint 1 x 2 tiles
 *   stick_burner  64x56  0 cold, 1 low, 2 good, 3 hot           drawn 2 tiles wide (side profile)
 *   trailer_rig   80x64  0 cold, 1 low, 2 good, 3 hot           drawn 2.5 tiles wide (side profile)
 *   pile          32x32  0 full, 1 half, 2 low, 3 empty          (v2 frame meaning)
 *   woodpile      32x40  0 full, 1 low, 2 empty
 *   cooler        32x48  0 to 2 level 1 to 3 shut, 3 to 5 level 1 to 3 open
 *   board         32x52  cutting station: 0 empty (knife), 1 with brisket (v2 frame meaning)
 *   counter       66x58  serving table on the diagonal, footprint 2 x 2; slots('counter') = 3 plate spots
 *   counter_long  98x74  serving table on the diagonal, footprint 3 x 2; slots = 5 plate spots
 *   platter_<meat> 26x16 a server's carried plate with a lit rim (round 1)
 *   trash         32x40  0 lid on, 1 full with the lid ajar
 *   prep_table    32x48  0 level 1 wood, 1 level 2 steel top, 2 level 3 steel with a shelf
 *   warmer        32x44  0 off, 1 holding (lit, 4 cuts), 2 door open
 *   piece_<meat>  20x20  0 raw, 1 cooking, 2 done, 3 burnt, 4 about to burn   (v2.1 meaning)
 *   plate_<meat>  20x13  one frame; anchor is the plate centre, so drawAt on a slot works
 *   plate_empty   20x13
 *   dish_<meat>   48x30  card size plated meat for the dish dock; anchor is the plate centre (round 2)
 *   gauge         8x40   frames 0 to 16 = fire 0 to 100 percent; band colour by sim.fireBand
 *   meat ids: sausage, chicken, ribs, butt, brisket
 *
 * API (PitSim.art shape): build(), built, has(name), frames(name), draw(ctx, name, x, y, frame,
 * flip) top left, drawAt(ctx, name, ax, ay, frame, flip) by anchor, drawScaled, canvasFor,
 * frameRect(name, frame), anchor(name), slots(name), shadow(name), drawShadow(ctx, name, ax, ay),
 * gaugeFrame(fire01), dishCard(ctx, x, y, w, h, meat, { selected, label }), box(ctx, x, y, w, h, depth, ramp, opts), names(), pixels(name, frame), stats.
 * Every sprite is painted once into a Uint32Array at build() and cached in one offscreen atlas canvas
 * (512 px wide, shelf packed); pixels() returns the raw frame for tests.
 * Deterministic: every seeded choice comes from mulberry32 seeded by the sprite name and frame.
 */
(function () {
const PitSim = globalThis.PitSim || (globalThis.PitSim = {});
const art3 = PitSim.art3 || (PitSim.art3 = {});
const PAL = art3.PAL;
if (!PAL || !PAL.RAMP) throw new Error('art3 kit: load palette.js before kit.js');

const RP = PAL.RAMP;
const OL = PAL.OL;
const ALPHA = PAL.ALPHA;
const PROJ = art3.proj;
if (!PROJ || typeof PROJ.isoFaces !== 'function') throw new Error('art3 kit: load proj.js before kit.js');

/* ---------------------------------------------------------------- colour packing (ABGR) */
const colCache = new Map();
function pack(hex, a) {
  const c = PAL.hexToRgb(hex);
  return ((a << 24) | (c[2] << 16) | (c[1] << 8) | c[0]) >>> 0;
}
function C(c) {
  if (typeof c === 'number') return c;
  let v = colCache.get(c);
  if (v === undefined) {
    if (!/^#[0-9a-fA-F]{6}$/.test(c)) throw new Error('art3 kit: bad colour "' + c + '"');
    v = pack(c, 255); colCache.set(c, v);
  }
  return v;
}
function CA(entry) { return pack(entry.rgb, Math.round(entry.a * 255)); } // a PAL.ALPHA entry
function blend(d, s) {
  const sa = s >>> 24;
  if (sa === 255 || d === 0) return s;
  if (sa === 0) return d;
  const da = d >>> 24, a = sa / 255, ia = 1 - a;
  const oa = sa + da * ia;
  const f = function (sh) {
    const sc = (s >>> sh) & 255, dc = (d >>> sh) & 255;
    return Math.round((sc * sa + dc * da * ia) / oa) & 255;
  };
  return ((Math.round(oa) << 24) | (f(16) << 16) | (f(8) << 8) | f(0)) >>> 0;
}

/* ---------------------------------------------------------------- seeded random */
function hashStr(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
function mulberry32(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

/* ---------------------------------------------------------------- polygon spans (shared) */
// Scanline fill with pixel centres, exactly as mock B's poly(): calls cb(y, xa, xb) for xa <= x < xb.
function spans(pts, cb) {
  let minY = Infinity, maxY = -Infinity;
  for (let i = 0; i < pts.length; i++) { minY = Math.min(minY, pts[i][1]); maxY = Math.max(maxY, pts[i][1]); }
  for (let y = Math.floor(minY); y < Math.ceil(maxY); y++) {
    const yc = y + 0.5, xs = [];
    for (let k = 0; k < pts.length; k++) {
      const p = pts[k], q = pts[(k + 1) % pts.length];
      if ((p[1] <= yc && q[1] > yc) || (q[1] <= yc && p[1] > yc)) xs.push(p[0] + (yc - p[1]) * (q[0] - p[0]) / (q[1] - p[1]));
    }
    xs.sort(function (a, b) { return a - b; });
    for (let k = 0; k + 1 < xs.length; k += 2) {
      const xa = Math.ceil(xs[k] - 0.5), xb = Math.ceil(xs[k + 1] - 0.5);
      if (xb > xa) cb(y, xa, xb);
    }
  }
}

/* ---------------------------------------------------------------- the raster */
function Ras(w, h, rnd) {
  this.w = w; this.h = h; this.main = new Uint32Array(w * h); this.t = this.main; this.rnd = rnd;
}
Ras.prototype.px = function (x, y, c) {
  x = Math.floor(x); y = Math.floor(y);
  if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
  const k = y * this.w + x, v = C(c);
  this.t[k] = (v >>> 24) === 255 || v === 0 ? v : blend(this.t[k], v);   // 0 erases
};
Ras.prototype.get = function (x, y) {
  if (x < 0 || y < 0 || x >= this.w || y >= this.h) return 0;
  return this.t[y * this.w + x];
};
Ras.prototype.rect = function (x, y, w, h, c) {
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.px(x + i, y + j, c);
};
Ras.prototype.poly = function (pts, c) {
  const self = this;
  spans(pts, function (y, xa, xb) { for (let x = xa; x < xb; x++) self.px(x, y, c); });
};
Ras.prototype.ell = function (cx, cy, rx, ry, c, y0, y1) {
  const lo = y0 === undefined ? -1e9 : y0, hi = y1 === undefined ? 1e9 : y1;
  for (let y = Math.floor(cy - ry - 1); y <= Math.ceil(cy + ry + 1); y++) {
    if (y < lo || y >= hi) continue;
    for (let x = Math.floor(cx - rx - 1); x <= Math.ceil(cx + rx + 1); x++) {
      const dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry;
      if (dx * dx + dy * dy <= 1) this.px(x, y, c);
    }
  }
};
Ras.prototype.inEll = function (x, y, cx, cy, rx, ry) {
  const dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry;
  return dx * dx + dy * dy <= 1;
};
Ras.prototype.line = function (x0, y0, x1, y1, c) {
  x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
  const dx = Math.abs(x1 - x0), sx = x0 < x1 ? 1 : -1, dy = -Math.abs(y1 - y0), sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  for (;;) {
    this.px(x0, y0, c);
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x0 += sx; }
    if (e2 <= dx) { err += dx; y0 += sy; }
  }
};
// A hand grid: rows of characters, '.' or ' ' transparent, others looked up in map.
Ras.prototype.grid = function (rows, map, x, y) {
  for (let j = 0; j < rows.length; j++) for (let i = 0; i < rows[j].length; i++) {
    const ch = rows[j][i];
    if (ch === '.' || ch === ' ') continue;
    this.px(x + i, y + j, map[ch]);
  }
};
// Draw fn into a fresh layer, then a 1 px 4-neighbour outline outside its opaque silhouette onto
// the target (over whatever is there, so objects separate), then the layer over the target.
// ol null = no outline (alpha only pixels never count as silhouette).
Ras.prototype.obj = function (fn, ol) {
  const prev = this.t, w = this.w, h = this.h;
  const L = new Uint32Array(w * h);
  this.t = L;
  fn(this);
  this.t = prev;
  if (ol !== null) {
    const o = C(ol === undefined ? OL : ol);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const k = y * w + x;
      if ((L[k] >>> 24) === 255) continue;
      if ((x > 0 && (L[k - 1] >>> 24) === 255) || (x < w - 1 && (L[k + 1] >>> 24) === 255) ||
          (y > 0 && (L[k - w] >>> 24) === 255) || (y < h - 1 && (L[k + w] >>> 24) === 255)) prev[k] = o;
    }
  }
  for (let k = 0; k < w * h; k++) if (L[k] !== 0) prev[k] = blend(prev[k], L[k]);
};
// Recolour every opaque pixel of the current layer that passes test(x, y, v) (used for char edges).
Ras.prototype.edgeMap = function (fn) {
  const w = this.w, h = this.h, T = this.t, out = [];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const k = y * w + x;
    if ((T[k] >>> 24) !== 255) continue;
    const edge = x === 0 || y === 0 || x === w - 1 || y === h - 1 ||
      (T[k - 1] >>> 24) !== 255 || (T[k + 1] >>> 24) !== 255 || (T[k - w] >>> 24) !== 255 || (T[k + w] >>> 24) !== 255;
    if (edge) out.push([x, y]);
  }
  for (let i = 0; i < out.length; i++) fn(out[i][0], out[i][1]);
};

/* ---------------------------------------------------------------- the iso box (round 1) */
// Every boxy prop is mock B's iso box drawn inside its orthogonal footprint (proj.js isoP and
// isoFaces): a rhombus top with 2:1 edges, a lit left face, a shaded right face, light from the
// top left. One geometry for kit and yard.
function rampOf(r) { return typeof r === 'string' ? PAL.ramp(r) : r; }
// A 2:1 stair of n steps from (x0, y0): dir +1 right and down, -1 left and down (mock B isoLine).
function isoLine(r, x0, y0, n, dir, c) {
  for (let k = 0; k < n; k++) { r.px(x0 + dir * 2 * k, y0 + k, c); r.px(x0 + dir * (2 * k + 1), y0 + k, c); }
}
// Paint the iso box u0..u1, v0..v1, z0..z0 + h in the frame P through fill(y, xa, xb, colour).
// Pass order: faces (left base, right shade, top hi), then the lit rim 1 px inside the two front
// edges of the top, then a 1 px dark crease under the top on both faces when crease is set.
// opts: { top, left, right } colour overrides, rim false, rimColor, crease true.
function paintIso(fill, P, u0, v0, u1, v1, z0, h, ramp, opts) {
  const o = opts || {}, rr = rampOf(ramp);
  const f = PROJ.isoFaces(P, u0, v0, u1, v1, z0, h);
  if (h > 0) {
    spans(f.left, function (y, xa, xb) { fill(y, xa, xb, o.left || rr.base); });
    spans(f.right, function (y, xa, xb) { fill(y, xa, xb, o.right || rr.shade); });
  }
  spans(f.top, function (y, xa, xb) { fill(y, xa, xb, o.top || rr.hi); });
  const one = function (x, y, c) { fill(y, x, x + 1, c); };
  if (o.rim !== false && u1 - u0 >= 4 && v1 - v0 >= 4) {
    const rc = o.rimColor || PAL.rim(rr);
    const lt = f.leftTop, ft = f.frontTop, rt = f.rightTop;
    for (let x = lt[0] + 1; x < ft[0]; x++) one(x, Math.floor(lt[1] + (x - lt[0]) / 2) - 1, rc);
    for (let x = ft[0]; x < rt[0] - 1; x++) one(x, Math.floor(ft[1] - (x - ft[0]) / 2) - 1, rc);
  }
  if (o.crease && h >= 4) {
    const lt = f.leftTop, ft = f.frontTop, rt = f.rightTop;
    for (let x = lt[0] + 1; x < ft[0]; x++) one(x, Math.floor(lt[1] + (x - lt[0]) / 2) + 1, rr.dark);
    for (let x = ft[0]; x < rt[0]; x++) one(x, Math.floor(ft[1] - (x - ft[0]) / 2) + 1, rr.dark);
  }
  return f;
}
function rasFill(r) { return function (yy, xa, xb, c) { for (let xx = xa; xx < xb; xx++) r.px(xx, yy, c); }; }
function iso(r, P, u0, v0, u1, v1, z0, h, ramp, opts) { return paintIso(rasFill(r), P, u0, v0, u1, v1, z0, h, ramp, opts); }
// The public helper: art3.box(ctx, fx, fy, U, V, H, ramp, opts). (fx, fy) is the front bottom
// vertex (the corner nearest the camera, on the ground line); U runs right and down, V left and
// down. ctx is a CanvasRenderingContext2D (integer fillRect spans) or a kit raster.
function box(ctx, fx, fy, U, V, H, ramp, opts) {
  const P = PROJ.isoP(fx - (U - V), fy - (U + V) / 2);
  const fill = ctx instanceof Ras ? rasFill(ctx) : function (yy, xa, xb, c) { ctx.fillStyle = c; ctx.fillRect(xa, yy, xb - xa, 1); };
  return paintIso(fill, P, 0, 0, U, V, 0, H, ramp, opts);
}
// The frame for a 1 x 1 prop: rhombus of U by V centred on x = cx, front vertex on y = fy.
function frameAt(cx, fy, U, V) { return PROJ.isoP(cx - (U - V) / 2, fy - (U + V) / 2); }
// A quad on a vertical face: left face (v = v1) between u a..b and z c..d, or right face (u = u1).
function quadL(P, v1, a, b, c, d) { return [P(a, v1, c), P(b, v1, c), P(b, v1, d), P(a, v1, d)]; }
function quadR(P, u1, a, b, c, d) { return [P(u1, a, c), P(u1, b, c), P(u1, b, d), P(u1, a, d)]; }

/* ---------------------------------------------------------------- hand grids (validated at load) */
const GRIDS = {
  flame: ['...#..', '..##..', '..###.', '.####.', '######', '.####.', '..##..'],
  flameSmall: ['.#.', '##.', '###', '.#.'],
  check: ['....#', '...##', '#.##.', '###..', '.#...'],
  coil: ['#.#.#', '.#.#.'],
  wisp: ['.##.', '#...', '.#..', '..#.', '.#..']
};
(function validateGrids() {
  Object.keys(GRIDS).forEach(function (k) {
    const g = GRIDS[k];
    if (!Array.isArray(g) || g.length === 0) throw new Error('art3 kit: grid ' + k + ' is empty');
    const w = g[0].length;
    g.forEach(function (row, j) {
      if (typeof row !== 'string' || row.length !== w) throw new Error('art3 kit: grid ' + k + ' row ' + j + ' width ' + (row && row.length) + ', expected ' + w);
      if (!/^[.#]+$/.test(row)) throw new Error('art3 kit: grid ' + k + ' row ' + j + ' has a character outside ".#"');
    });
  });
})();

/* ---------------------------------------------------------------- shared tones */
const K = RP.kettle, ST = RP.steel, EM = RP.ember, CH = RP.charcoal;
const WL = RP.woodL, WM = RP.woodM, WD = RP.woodD, LE = RP.logEnd, BK = RP.bark, BD = RP.board;
const DR = RP.drum, CR = RP.coolerRed, CW = RP.coolerWhite, CL = RP.cloth, PL = RP.plate;
const GL = RP.glass, SM = RP.smoke, BN = RP.bone, BR = RP.brisket;
const WHITE = PL.hi, TRIM = RP.fence.hi, CREAM = PAL.ANCHOR.C;
const GLOW = CA(ALPHA.emberGlow), SPEC = CA(ALPHA.spec);
const MEAT_IDS = ['sausage', 'chicken', 'ribs', 'butt', 'brisket'];

// Fire light by band (0 out, 1 low, 2 good, 3 hot) at a slit: an array of [x, y] pixels.
function glowSlit(r, pts, band, halo) {
  if (band <= 0) return;
  for (let i = 0; i < pts.length; i++) {
    const x = pts[i][0], y = pts[i][1];
    let c;
    if (band === 1) c = i % 3 === 1 ? EM.shade : (i % 3 === 0 ? EM.dark : null);
    else if (band === 2) c = i % 2 ? EM.hi : EM.base;
    else c = i % 3 === 1 ? EM.base : EM.hi;
    if (c) r.px(x, y, c);
  }
  if (band === 3 && halo !== false) {
    for (let i = 0; i < pts.length; i++) { r.px(pts[i][0], pts[i][1] - 1, GLOW); r.px(pts[i][0], pts[i][1] + 1, GLOW); }
  }
}
function row(x0, x1, y) { const out = []; for (let x = x0; x <= x1; x++) out.push([x, y]); return out; }
function dial(r, x, y) { // 5 x 5 thermometer dial, needle up and right
  r.ell(x + 0.5, y + 0.5, 2.6, 2.6, ST.dark);
  r.ell(x + 0.3, y + 0.3, 1.7, 1.7, WHITE);
  r.px(x, y, DR.dark); r.px(x + 1, y - 1, DR.base);
}
function wheel(r, cx, cy, rad) {
  r.ell(cx, cy, rad, rad, K.dark);
  r.ell(cx - 0.4, cy - 0.4, rad - 1, rad - 1, K.shade);
  r.ell(cx, cy, rad * 0.58, rad * 0.58, ST.shade);
  r.ell(cx - 0.3, cy - 0.3, rad * 0.42, rad * 0.42, ST.base);
  r.ell(cx, cy, 1.1, 1.1, ST.dark);
  r.px(cx - rad * 0.4, cy - rad * 0.4, ST.hi);
  r.px(cx - rad * 0.75, cy - rad * 0.45, K.hi); r.px(cx - rad * 0.55, cy - rad * 0.75, K.hi);
}
// A horizontal cylinder lying left to right (stick burner and trailer tanks): rows lit from the top.
function tank(r, x0, x1, y0, y1) {
  const hgt = y1 - y0 + 1;
  for (let y = y0; y <= y1; y++) {
    const t = (y - y0) / (hgt - 1);
    const k = y - y0, kb = y1 - y, ins = [3, 2, 1, 1];
    const inset = k < 4 ? ins[k] : kb < 4 ? ins[kb] : 0;
    const c = t < 0.12 ? K.hi : t < 0.5 ? K.base : t < 0.86 ? K.shade : K.dark;
    for (let x = x0 + inset; x <= x1 - inset; x++) r.px(x, y, c);
  }
  r.rect(x0, y0 + 4, 1, hgt - 8, K.hi);                     // lit end rim on the left
  r.rect(x0 + 4, y0 + 1, 1, hgt - 2, K.dark);              // weld seam near the end
  r.rect(x0 + 5, y0 + 1, 1, hgt - 2, K.hi);
}
function stack(r, x, y0, y1, wide) { // chimney: cap, pipe lit on the left, damper band
  const w = wide || 5;
  r.rect(x - 1, y0, w + 2, 2, K.base); r.rect(x - 1, y0, w + 2, 1, K.hi);
  for (let y = y0 + 2; y <= y1; y++) {
    r.px(x, y, K.hi);
    for (let i = 1; i < w - 2; i++) r.px(x + i, y, K.base);
    r.px(x + w - 2, y, K.shade); r.px(x + w - 1, y, K.shade);
  }
  r.rect(x, Math.round((y0 + y1) / 2), w, 1, K.dark);
}

/* ---------------------------------------------------------------- cookers */
function kettle(r, f) {
  const gx = 16, gy = 51, cy = 28;
  const open = f === 4, band = open ? 2 : f;
  // legs, the wheel and the ash pan sit behind the bowl
  r.obj(function () {
    r.line(gx - 9, cy + 6, gx - 12, gy - 2, K.hi); r.line(gx - 8, cy + 6, gx - 11, gy - 2, K.base);
    r.line(gx + 9, cy + 6, gx + 12, gy - 1, K.base); r.line(gx + 10, cy + 6, gx + 13, gy - 1, K.shade);
    r.line(gx, cy + 9, gx, gy - 3, K.base); r.line(gx + 1, cy + 9, gx + 1, gy - 3, K.dark);
    r.ell(gx + 0.5, gy - 11, 7.5, 2.2, K.shade); r.ell(gx, gy - 11.5, 6, 1.4, K.hi);
  });
  r.obj(function () { wheel(r, gx - 11.5, gy - 3.5, 3); r.px(gx + 13, gy - 1, K.dark); r.px(gx + 14, gy - 1, K.dark); });
  if (open) {
    // the lid stands open behind the bowl: we see its dark inside and its rim
    r.obj(function () {
      r.ell(gx, cy - 14, 14, 10, K.base);
      r.ell(gx + 1.5, cy - 14, 12.5, 9.5, K.shade, cy - 14);
      r.ell(gx, cy - 13.5, 11.5, 8, K.dark);
      r.ell(gx - 1, cy - 15, 8, 5, K.shade);
      r.px(gx - 9, cy - 20, K.spec); r.px(gx - 8, cy - 21, K.spec); r.px(gx - 10, cy - 19, K.hi);
      r.rect(gx - 2, cy - 5, 5, 2, K.base);                  // hinge
    });
  }
  r.obj(function () {
    // bowl: darkest at the lower right, a soft streak on the lit left
    r.ell(gx, cy, 14, 10, K.dark, cy);
    r.ell(gx - 1.5, cy - 0.5, 12.5, 9, K.shade, cy);
    r.line(gx - 11, cy + 2, gx - 8, cy + 6, K.base); r.line(gx - 10, cy + 2, gx - 7, cy + 5, K.base);
    r.px(gx - 11, cy + 1, K.hi);
    r.rect(gx + 14, cy + 1, 1, 2, WM.shade); r.px(gx + 14, cy + 1, WM.base);            // side handle
    r.rect(gx - 3, cy + 7, 2, 1, K.base); r.rect(gx + 1, cy + 7, 2, 1, K.base);           // bottom vents
    if (!open) {
      r.ell(gx, cy, 14, 12, K.shade, -1e9, cy);
      r.ell(gx - 1.5, cy - 0.5, 12.5, 11, K.base, -1e9, cy);
      r.ell(gx - 5, cy - 6, 5.5, 3.5, K.hi);
      r.px(gx - 8, cy - 7, K.spec); r.px(gx - 7, cy - 8, K.spec); r.px(gx - 6, cy - 8, K.spec); r.px(gx - 5, cy - 9, WHITE);
      r.px(gx - 4, cy - 9, SPEC); r.px(gx - 3, cy - 9, SPEC); r.px(gx - 9, cy - 5, SPEC);
      r.rect(gx - 14, cy, 29, 1, K.dark);                   // seam
      r.rect(gx - 13, cy - 1, 4, 1, K.hi);                  // lit lip on the left
      r.rect(gx + 6, cy - 8, 4, 2, K.hi); r.px(gx + 9, cy - 7, K.dark);              // lid damper
      r.px(gx - 3, cy - 12, K.dark); r.px(gx + 3, cy - 12, K.dark);                 // handle posts
      r.rect(gx - 4, cy - 14, 9, 2, WM.shade); r.rect(gx - 3, cy - 14, 7, 1, WM.hi);
      if (band === 1) glowSlit(r, [[gx + 3, cy], [gx + 4, cy], [gx + 6, cy]], 1);
      if (band === 2) { glowSlit(r, row(gx + 2, gx + 8, cy), 2); r.px(gx + 8, cy - 7, EM.shade); }
      if (band === 3) {
        glowSlit(r, row(gx - 6, gx + 11, cy), 3);
        r.px(gx + 7, cy - 7, EM.base); r.px(gx + 8, cy - 7, EM.hi);
        r.px(gx - 2, cy + 7, EM.base); r.px(gx + 2, cy + 7, EM.base);
      }
    } else {
      // open: the rim, the coal bed under the grate
      r.ell(gx, cy, 14, 5, K.hi);
      r.ell(gx + 0.5, cy + 0.3, 12.5, 4, CH.dark);
      for (let y = cy - 4; y <= cy + 4; y++) for (let x = gx - 13; x <= gx + 13; x++) {
        if (!r.inEll(x, y, gx + 0.5, cy + 0.3, 11.5, 3.2)) continue;
        const q = r.rnd();
        r.px(x, y, q < 0.3 ? CH.base : q < 0.48 ? EM.base : q < 0.58 ? EM.hi : q < 0.66 ? EM.shade : q < 0.72 ? CH.ash : CH.dark);
      }
      for (let y = cy - 2; y <= cy + 2; y += 2) for (let x = gx - 13; x <= gx + 13; x++) {
        if (r.inEll(x, y, gx + 0.5, cy + 0.3, 12.3, 3.9)) r.px(x, y, (x + y) % 5 === 0 ? ST.hi : ST.shade);
      }
      r.rect(gx - 13, cy - 1, 3, 1, ST.hi);
      for (let x = gx - 9; x <= gx + 10; x++) { r.px(x, cy - 5, GLOW); if (x % 2) r.px(x, cy - 6, GLOW); }
      r.px(gx - 10, cy - 3, K.spec); r.px(gx - 9, cy - 4, K.spec);
    }
  });
}

function drum(r, f) {
  // A vertical cylinder seen on the iso angle: every ring is a 2:1 ellipse (rx 12, ry 6).
  const gx = 16, gy = 71, top = 20, bot = 58, RY = 6;
  r.obj(function () {
    r.rect(gx - 9, bot + 2, 2, gy - bot - 2, K.base); r.rect(gx - 9, bot + 2, 1, gy - bot - 2, K.hi);
    r.rect(gx + 8, bot + 2, 2, gy - bot - 2, K.shade);
    r.rect(gx - 1, bot + 4, 2, gy - bot - 6, K.dark);
    r.rect(gx - 10, gy - 1, 4, 1, K.dark); r.rect(gx + 7, gy - 1, 4, 1, K.dark);
  });
  r.obj(function () {
    for (let x = -11; x <= 12; x++) {
      const u = (x - 0.5) / 12;
      const curve = RY * Math.sqrt(Math.max(0, 1 - u * u));
      const col = x <= -8 ? DR.hi : x >= 10 ? DR.dark : x >= 5 ? DR.shade : DR.base;
      const yb = Math.round(bot + curve);
      for (let y = top; y < yb; y++) r.px(gx + x, y, col);
      [14, 27].forEach(function (off) {
        const yy = Math.round(top + off + curve);
        r.px(gx + x, yy, x >= 5 ? DR.dark : DR.shade); r.px(gx + x, yy + 1, x >= 5 ? DR.dark : DR.shade);
        if (x <= -8) r.px(gx + x, yy - 1, PAL.rim(DR));
      });
      r.px(gx + x, yb - 1, x >= 5 ? DR.dark : DR.shade);
      r.px(gx + x, Math.round(top + 2 + curve), K.dark);                // lid seam follows the ring
    }
    for (let y = top + 8; y < bot - 2; y++) { const p = r.get(gx - 9, y); if (p === C(DR.hi)) r.px(gx - 9, y, PAL.rim(DR)); }
    // lid: a 2:1 dome, black, lit from the top left
    r.ell(gx + 0.5, top, 12.5, RY + 0.4, K.shade);
    r.ell(gx, top - 0.6, 11.4, RY - 0.6, K.base);
    r.ell(gx - 3.5, top - 2, 6, 2.6, K.hi);
    r.px(gx - 7, top - 3, K.spec); r.px(gx - 6, top - 3, K.spec); r.px(gx - 8, top - 2, SPEC);
    r.px(gx - 2, top - 5, K.dark); r.px(gx + 2, top - 5, K.dark);
    r.rect(gx - 3, top - 7, 7, 2, K.shade); r.rect(gx - 2, top - 7, 5, 1, K.hi);       // handle
    r.rect(gx + 6, top - 5, 3, 3, K.base); r.rect(gx + 6, top - 6, 3, 1, K.hi);       // exhaust
    dial(r, gx - 5, top + 11);
    r.rect(gx + 12, top + 18, 2, 5, ST.shade); r.px(gx + 12, top + 18, ST.hi);     // side handle
    [gx - 7, gx + 1].forEach(function (vx) {
      r.rect(vx, bot - 7, 4, 3, K.shade); r.rect(vx + 1, bot - 6, 2, 1, K.dark);
    });
    if (f >= 1) glowSlit(r, [[gx - 6, bot - 6], [gx - 5, bot - 6], [gx + 2, bot - 6], [gx + 3, bot - 6]], f);
    if (f === 3) glowSlit(r, row(gx - 2, gx + 6, top + 5), 2, false);
  });
}

function cabinet(r, f) {
  // Iso box 14 x 14 on short legs, door on the lit left face, chimney at the back of the top.
  const U = 14, V = 14, H = 46, Z = 5;
  const P = frameAt(16, 75, U, V);
  r.obj(function () {
    [[1, 1], [12, 1], [1, 12], [12, 12]].forEach(function (q) { iso(r, P, q[0], q[1], q[0] + 2, q[1] + 2, 0, Z + 1, K, { rim: false }); });
  });
  r.obj(function () {
    const fc = iso(r, P, 0, 0, U, V, Z, H, ST, { crease: true });
    // raised door on the left face: lit top and left edges, shaded bottom and right
    const d = quadL(P, V, 2, U - 2, Z + 4, Z + H - 4);
    r.poly(d, ST.hi);
    r.poly(quadL(P, V, 3, U - 2, Z + 4, Z + H - 5), ST.base);
    r.poly(quadL(P, V, 3, U - 3, Z + 5, Z + H - 5), ST.base);
    const lp = function (a, z) { return P(a, V, z); };
    for (let a = 3; a < U - 2; a++) { const q = lp(a, Z + 4); r.px(q[0], q[1] - 1, ST.shade); }
    for (let z = Z + 5; z < Z + H - 4; z++) { const q = lp(U - 2, z); r.px(q[0], q[1], ST.dark); }
    // hinges at the left edge, latch at the right, louvres low on the door
    [Z + 10, Z + H - 12].forEach(function (z) { const q = lp(0.5, z); r.rect(q[0], q[1] - 1, 2, 2, K.base); });
    { const q = lp(U - 4, Z + 22); r.rect(q[0], q[1] - 6, 1, 8, ST.dark); r.px(q[0], q[1] - 6, ST.hi); }
    { const q = lp(6, Z + 34); dial(r, q[0], q[1]); }
    for (let k = 0; k < 3; k++) {
      const z = Z + 9 + k * 3;
      for (let a = 4; a < U - 4; a++) { const q = lp(a, z); r.px(q[0], q[1], ST.dark); r.px(q[0], q[1] + 1, ST.hi); }
    }
    // rivets and a probe port on the right face
    [[3, Z + 38], [10, Z + 14]].forEach(function (rv) { const q = P(U, rv[0], rv[1]); r.px(q[0], q[1], ST.dark); });
    r.poly(quadR(P, U, 5, 9, Z + 26, Z + 28), ST.dark);
    // chimney at the back of the top
    const ch = P(3, 3, Z + H);
    stack(r, ch[0] - 2, 2, ch[1] - 1, 5);
    r.px(fc.leftTop[0] + 3, fc.leftTop[1] - 1, SPEC); r.px(fc.leftTop[0] + 4, fc.leftTop[1] - 2, SPEC);
    // fire light at the door gap and the louvres
    if (f >= 1) { const pts = []; for (let a = 3; a < U - 2; a++) { const q = lp(a, Z + 4); pts.push([q[0], q[1]]); } glowSlit(r, pts, f); }
    if (f === 3) for (let k = 0; k < 3; k++) { const pts = []; for (let a = 5; a < U - 5; a++) { const q = lp(a, Z + 9 + k * 3); pts.push([q[0], q[1]]); } glowSlit(r, pts, 1, false); }
  });
}

// The stick burner and trailer rig are drawn in side profile (long tanks read best that way); their
// fireboxes and deck are flat slabs: a front face and a lit top strip, no side face.
function slab(r, x0, yb, w, h, d, rr) {
  r.rect(x0, yb - h, w, h, rr.base);
  r.rect(x0, yb - h - d, w, d, rr.hi);
  r.rect(x0, yb - h - 1, w, 1, PAL.rim(rr));
  r.rect(x0 + w - 1, yb - h, 1, h, rr.shade);
}
function stickBurner(r, f) {
  r.obj(function () {                                         // chassis and the wood rack
    r.rect(4, 42, 54, 2, ST.shade); r.rect(4, 42, 54, 1, ST.base);
    r.rect(9, 36, 2, 6, ST.dark); r.rect(33, 36, 2, 6, ST.dark);
    r.rect(20, 44, 1, 8, ST.dark); r.rect(42, 44, 1, 8, ST.dark);
    r.rect(20, 51, 23, 1, ST.dark);
  });
  r.obj(function () {                                         // splits on the rack
    [[21, 47, 10], [32, 47, 10], [26, 44, 9]].forEach(function (s) {
      r.rect(s[0], s[1], s[2], 4, WD.base); r.rect(s[0], s[1], s[2], 1, WD.hi); r.rect(s[0], s[1] + 3, s[2], 1, WD.shade);
      r.rect(s[0] + s[2] - 2, s[1], 2, 4, LE.base); r.px(s[0] + s[2] - 2, s[1], LE.hi); r.px(s[0] + s[2] - 1, s[1] + 3, LE.shade);
    });
  });
  r.obj(function () {                                         // tank and chimney
    stack(r, 5, 2, 17, 5);
    tank(r, 3, 41, 16, 36);
    r.rect(6, 27, 33, 1, K.dark);                            // lid seam
    r.rect(5, 28, 35, 1, K.base);
    r.px(14, 22, K.dark); r.px(28, 22, K.dark);
    r.rect(12, 20, 19, 2, WM.shade); r.rect(13, 20, 17, 1, WM.hi);   // lid handle
    dial(r, 35, 21);
    for (let x = 8; x <= 15; x++) r.px(x, 17, SPEC);
    r.px(7, 18, K.spec); r.px(8, 18, K.spec);
  });
  r.obj(function () {                                         // firebox
    slab(r, 40, 42, 14, 18, 6, K);
    const dx0 = 42, dx1 = 51, dy0 = 27, dy1 = 38;
    r.rect(dx0, dy0, dx1 - dx0 + 1, dy1 - dy0 + 1, K.base);
    r.rect(dx0, dy0, dx1 - dx0 + 1, 1, K.hi); r.rect(dx0, dy0, 1, dy1 - dy0 + 1, K.hi);
    r.rect(dx0, dy1, dx1 - dx0 + 1, 1, K.dark); r.rect(dx1, dy0, 1, dy1 - dy0 + 1, K.dark);
    r.grid(GRIDS.coil, { '#': ST.hi }, 45, 31); r.rect(45, 33, 5, 1, ST.shade);
    r.ell(57.5, 31, 2, 2.5, K.dark); r.px(57, 30, ST.base);                         // side damper
    if (f >= 1) glowSlit(r, row(dx0 + 1, dx1 - 1, dy1 + 1), f);
    if (f >= 2) { r.px(57, 31, EM.base); r.px(58, 32, f === 3 ? EM.hi : EM.shade); }
    if (f === 3) r.px(56, 31, GLOW);
  });
  r.obj(function () { wheel(r, 13, 48, 6.5); wheel(r, 49, 48, 6.5); });
}

function trailerRig(r, f) {
  r.obj(function () {                                         // tongue, coupler, jack
    r.rect(4, 49, 12, 2, ST.shade); r.rect(4, 49, 12, 1, ST.base);
    r.rect(1, 48, 4, 3, K.base); r.px(1, 48, K.hi); r.px(2, 48, K.hi);
    r.rect(9, 51, 2, 9, ST.base); r.rect(10, 51, 1, 9, ST.shade);
    r.rect(8, 60, 4, 2, K.dark); r.px(11, 52, ST.hi); r.px(12, 52, ST.dark);
  });
  r.obj(function () {                                         // deck: planks on a steel frame
    slab(r, 14, 54, 57, 4, 8, WM);
    for (let y = 44; y <= 48; y += 2) for (let x = 15; x < 71; x++) r.px(x, y, (x * 7 + y) % 13 === 0 ? WM.dark : WM.base);
    for (let x = 14; x < 71; x++) { r.px(x, 50, ST.hi); r.px(x, 51, ST.base); r.px(x, 52, ST.base); r.px(x, 53, ST.shade); }
    r.rect(67, 51, 3, 2, DR.base); r.px(67, 51, DR.hi); r.rect(15, 51, 2, 2, EM.base);   // lights
  });
  r.obj(function () {                                         // saddles, tank, chimney
    r.rect(24, 41, 3, 4, ST.shade); r.rect(50, 41, 3, 4, ST.shade);
    stack(r, 20, 1, 18, 6);
    tank(r, 17, 59, 17, 41);
    r.rect(20, 30, 37, 1, K.dark); r.rect(19, 31, 39, 1, K.base);
    [[22, 20, 13], [40, 20, 13]].forEach(function (hd) {
      r.px(hd[0] + 1, hd[1] + 2, K.dark); r.px(hd[0] + hd[2] - 2, hd[1] + 2, K.dark);
      r.rect(hd[0], hd[1], hd[2], 2, WM.shade); r.rect(hd[0] + 1, hd[1], hd[2] - 2, 1, WM.hi);
    });
    dial(r, 54, 23);
    for (let x = 22; x <= 31; x++) r.px(x, 18, SPEC);
    r.px(21, 19, K.spec); r.px(22, 19, K.spec);
    r.rect(10, 33, 8, 2, ST.base); r.rect(10, 33, 8, 1, ST.hi); r.line(11, 35, 16, 40, ST.dark);  // side shelf
  });
  r.obj(function () {                                         // firebox
    slab(r, 58, 46, 12, 20, 6, K);
    const dx0 = 60, dx1 = 67, dy0 = 29, dy1 = 42;
    r.rect(dx0, dy0, dx1 - dx0 + 1, dy1 - dy0 + 1, K.base);
    r.rect(dx0, dy0, dx1 - dx0 + 1, 1, K.hi); r.rect(dx0, dy0, 1, dy1 - dy0 + 1, K.hi);
    r.rect(dx0, dy1, dx1 - dx0 + 1, 1, K.dark); r.rect(dx1, dy0, 1, dy1 - dy0 + 1, K.dark);
    r.grid(GRIDS.coil, { '#': ST.hi }, 62, 34); r.rect(62, 36, 5, 1, ST.shade);
    r.ell(74, 34, 2, 2.5, K.dark); r.px(73, 33, ST.base);
    if (f >= 1) glowSlit(r, row(dx0 + 1, dx1 - 1, dy1 + 1), f);
    if (f >= 2) { r.px(74, 34, EM.base); r.px(74, 35, f === 3 ? EM.hi : EM.shade); }
  });
  r.obj(function () { wheel(r, 36, 56, 6.5); wheel(r, 53, 56, 6.5); });
  r.obj(function () {                                         // red fender over both wheels
    r.rect(28, 47, 34, 3, DR.base); r.rect(29, 47, 32, 1, DR.hi); r.rect(28, 49, 34, 1, DR.shade);
    r.rect(27, 48, 1, 2, DR.shade); r.rect(62, 48, 1, 2, DR.dark);
    r.px(31, 47, WHITE);
  });
}

/* ---------------------------------------------------------------- fuel */
// One pillow briquette, 6 x 4: a grey top face, black body, shade underneath. kind 0 to 2 picks
// where the ash catches; 'ember' is the one glowing coal in the heap.
function briquette(r, x, y, kind) {
  if (kind === 'ember') {
    r.rect(x + 1, y, 4, 1, EM.hi); r.rect(x, y + 1, 6, 2, EM.base); r.rect(x + 1, y + 3, 4, 1, EM.shade);
    r.px(x + 1, y, WHITE); r.px(x + 4, y + 2, EM.shade);
    return;
  }
  r.rect(x + 1, y, 4, 1, CH.hi); r.rect(x, y + 1, 6, 2, CH.base); r.rect(x + 1, y + 3, 4, 1, CH.shade);
  r.px(x + 5, y + 2, CH.shade);
  if (kind === 0) { r.px(x + 1, y, CH.ashD); r.px(x + 2, y, CH.ashD); r.px(x, y + 1, CH.hi); }
  else if (kind === 1) { r.px(x + 2, y, CH.ash); r.px(x + 3, y, CH.ashD); r.px(x + 1, y + 1, CH.hi); }
  else { r.px(x + 3, y, CH.ashD); r.px(x + 4, y, CH.ashD); }
}
// Round 2 (art director): the charcoal pile is one readable bag. The round 1 briquette pyramid
// beside a sack read as a black tent at play size. Now: a kraft paper bag as an iso box, slumped
// (rounded top corners, a sagging front lip), with a lit folded top face, a lit left column (light
// from the top left), an orange band with a cream flame mark, and a few briquettes spilled at its
// foot. 4-tone board ramp for the paper, the charcoal ramp for the briquettes.
const BAG = { U: 12, V: 9, cx: 20, fy: 29, H: [18, 13, 8], taper: 1.6 };
function bagUp(r, H) {
  const U = BAG.U, V = BAG.V, P = frameAt(BAG.cx, BAG.fy, U, V);
  // a tapered box: the paper sags in toward the top, so the bag reads soft, not as a crate
  const S = function (a, b, z) {
    const i = BAG.taper * z / H;
    return P(i + a * (U - 2 * i), i + b * (V - 2 * i), z);
  };
  const L = function (z0, z1, a0, a1) { return [S(a0, 1, z0), S(a1, 1, z0), S(a1, 1, z1), S(a0, 1, z1)]; };
  const Rf = function (z0, z1) { return [S(1, 0, z0), S(1, 1, z0), S(1, 1, z1), S(1, 0, z1)]; };
  r.poly(L(0, H, 0, 1), BD.base);
  r.poly(Rf(0, H), BD.shade);
  r.poly([S(0, 0, H), S(1, 0, H), S(1, 1, H), S(0, 1, H)], BD.hi);
  // the rolled lip: lit band round the top of both faces, a dark crease under it
  const lip = H >= 12 ? 3 : 2;
  r.poly(L(H - lip, H, 0, 1), BD.hi);
  r.poly(Rf(H - lip, H), BD.base);
  { const a0 = S(0, 1, H - lip), a1 = S(1, 1, H - lip), a2 = S(1, 0, H - lip); r.line(a0[0], a0[1], a1[0], a1[1], BD.dark); r.line(a1[0], a1[1], a2[0], a2[1], BD.dark); }
  // the fold across the top face and a lit near edge on it
  { const c0 = S(0.12, 0.5, H), c1 = S(0.9, 0.5, H); r.line(c0[0], c0[1], c1[0], c1[1], BD.shade); }
  { const e0 = S(0.1, 1, H), e1 = S(0.85, 1, H); r.line(e0[0] + 1, e0[1] - 1, e1[0], e1[1] - 1, PAL.rim(BD)); }
  // top left light: a lit column down the left edge of the lit face
  r.poly(L(1, H - lip, 0, 0.12), BD.hi);
  // the band and the flame mark (when the bag is tall enough to carry them)
  if (H >= 12) {
    const z0 = Math.round(H * 0.3), bh = H >= 16 ? 5 : 4;
    r.poly(L(z0, z0 + bh, 0.12, 1), RP.orange.base);
    r.poly(L(z0 + bh - 1, z0 + bh, 0.12, 1), RP.orange.hi);
    r.poly(Rf(z0, z0 + bh), RP.orange.shade);
    const m = S(0.5, 1, z0 + bh - 1);
    r.grid(GRIDS.flameSmall, { '#': CREAM }, m[0] - 1, m[1]);
  }
  // paper wrinkles: short creases low on the lit face, one on the shaded face
  [0.35, 0.78].forEach(function (a) { for (let z = 1; z < Math.min(4, H - lip - 1); z++) { const q = S(a, 1, z); r.px(q[0], q[1], BD.shade); } });
  { const q = S(1, 0.5, Math.max(2, H - lip - 3)); r.rect(q[0], q[1], 1, 3, BD.dark); }
  // slump: round the top corners and sag the front of the lip
  const lt = S(0, 1, H), rt = S(1, 0, H), bk = S(0, 0, H), ft = S(1, 1, H);
  const cut = function (x, y) { r.px(Math.round(x), Math.round(y), 0); };
  cut(lt[0], lt[1] - 1); cut(lt[0], lt[1]); cut(lt[0] + 1, lt[1] - 1);
  cut(rt[0] - 1, rt[1] - 1); cut(rt[0] - 1, rt[1]); cut(rt[0] - 2, rt[1] - 1);
  cut(bk[0], bk[1]); cut(bk[0] - 1, bk[1]); cut(bk[0], bk[1] + 1);
  cut(ft[0] - 1, ft[1] - 1); cut(ft[0], ft[1] - 1);
}
function pile(r, f) {
  if (f === 3) {                                              // empty: the bag lies flat, folded over
    r.obj(function () {
      const P = frameAt(16, 30, 18, 10);
      iso(r, P, 0, 0, 18, 10, 0, 3, BD, { rim: false });
      r.poly([P(0, 0, 3), P(6, 0, 3), P(6, 10, 3), P(0, 10, 3)], BD.dark);
      const q = P(9, 5, 3); r.grid(GRIDS.flameSmall, { '#': RP.orange.base }, q[0] - 1, q[1] - 2);
    });
    r.obj(function () { briquette(r, 23, 27, 1); });
    r.px(1, 30, CH.ashD); r.px(29, 30, CH.ash); r.px(14, 30, CH.ashD);
    return;
  }
  r.obj(function () { bagUp(r, BAG.H[f]); });
  // spilled at the foot of the lit face, fewer as the bag empties
  const spill = f === 0 ? [[1, 25, 0], [7, 28, 1], [14, 28, 2]] : f === 1 ? [[2, 26, 1], [9, 28, 0]] : [[4, 27, 2]];
  spill.forEach(function (b) { r.obj(function () { briquette(r, b[0], b[1], b[2]); }); });
  r.px(1, 30, CH.ashD); r.px(23, 31, CH.ashD);
}

// One split log lying along v, its cut end facing the yard on the lit side (mock B woodPile).
function isoLog(r, P, u, z, len, rad, part) {
  if (part === 'body') {
    for (let v = 0; v < len; v++) {
      const q = P(u, v, z + rad);
      r.ell(q[0], q[1], rad + 0.4, rad + 0.4, WD.base);
      r.px(Math.round(q[0]), Math.round(q[1] - rad), WD.hi);
      r.px(Math.round(q[0] + rad - 0.5), Math.round(q[1] + 1), WD.shade);
    }
    return;
  }
  const q = P(u, len, z + rad), x = q[0], y = q[1];
  r.ell(x, y, rad + 0.9, rad + 0.9, BK.dark);
  r.ell(x, y, rad, rad, LE.base);
  r.ell(x + 0.3, y + 0.3, rad * 0.62, rad * 0.62, LE.shade);
  r.ell(x + 0.3, y + 0.3, rad * 0.4, rad * 0.4, LE.base);
  r.px(x - 0.2, y - 0.2, LE.dark);
  r.px(x - rad * 0.6, y - rad * 0.6, LE.hi); r.px(x - rad * 0.6 + 1, y - rad * 0.6 - 1, LE.hi);
}
function woodpile(r, f) {
  const U = 20, V = 14, P = frameAt(16, 39, U, V);
  r.obj(function () {                                         // the pallet it all sits on
    iso(r, P, 0, 0, U, V, 0, 3, WD, { rimColor: WD.hi });
    for (let a = 3; a < U; a += 6) { const q = P(a, V, 0); r.rect(q[0], q[1] - 3, 1, 3, WD.dark); }
  });
  const logs = f === 0
    ? [[3, 3], [10, 3], [17, 3], [6.5, 9.5], [13.5, 9.5], [10, 16]]
    : f === 1 ? [[4, 3], [11, 3], [7.5, 9.5]] : [];
  if (logs.length) {
    r.obj(function () {
      logs.forEach(function (p) { isoLog(r, P, p[0], p[1], V, 3.6, 'body'); });
      logs.forEach(function (p) { isoLog(r, P, p[0], p[1], V, 3.6, 'end'); });
    });
  } else {
    r.obj(function () {
      const q = P(8, 6, 3); r.rect(q[0] - 5, q[1] - 2, 11, 2, BK.base); r.rect(q[0] - 5, q[1] - 2, 11, 1, BK.hi); r.rect(q[0] + 4, q[1] - 2, 2, 2, LE.base);
    });
  }
}

/* ---------------------------------------------------------------- service kit */
function cooler(r, f) {
  const lvl = f % 3, open = f >= 3;
  const S = [
    { U: 16, V: 12, H: 11, body: CR, lid: CW, lidH: 3, wheels: false },
    { U: 18, V: 14, H: 12, body: CW, lid: CR, lidH: 4, wheels: false },
    { U: 20, V: 14, H: 14, body: CW, lid: CW, lidH: 4, wheels: true }
  ][lvl];
  const P = frameAt(16, 46, S.U, S.V), U = S.U, V = S.V, H = S.H;
  if (S.wheels) r.obj(function () { const a = P(3, V, 0), b = P(U, 3, 0); wheel(r, a[0], a[1] - 1, 2.4); wheel(r, b[0] + 1, b[1] - 1, 2.2); });
  if (open) {
    // the lid tipped back on its hinge: its inside face stands up along the back edge
    r.obj(function () {
      r.poly([P(-1, -1, H), P(U + 1, -1, H), P(U + 1, -1, H + V + 2), P(-1, -1, H + V + 2)], S.lid.shade);
      r.poly([P(1, -1, H + 2), P(U - 1, -1, H + 2), P(U - 1, -1, H + V), P(1, -1, H + V)], S.lid.dark);
    });
  }
  r.obj(function () {
    const fc = iso(r, P, 0, 0, U, V, 0, H, S.body, { rim: false });
    if (lvl === 2) {                                          // red band round the body, corner guards
      r.poly(quadL(P, V, 0, U, 5, 7), CR.base); r.poly(quadR(P, U, 0, V, 5, 7), CR.shade);
      r.poly(quadL(P, V, 0, 2, 1, H - 1), ST.base); r.poly(quadL(P, V, U - 2, U, 1, H - 1), ST.shade);
    }
    if (lvl === 1) { r.poly(quadL(P, V, 1, 3, H - 4, H - 1), ST.base); r.poly(quadL(P, V, U - 3, U - 1, H - 4, H - 1), ST.base); }
    r.poly(quadR(P, U, 4, 9, Math.round(H / 2) - 1, Math.round(H / 2) + 1), S.body === CR ? CW.handle : CR.shade);   // side handle
    if (!open) {
      iso(r, P, -1, -1, U + 1, V + 1, H, S.lidH, S.lid, { rimColor: S.lid.rim || PAL.rim(S.lid) });
      for (let a = 0; a <= U; a++) { const q = P(a, V + 1, H); r.px(q[0], q[1], S.body.dark); }   // crease under the lid
      for (let b = 0; b <= V; b++) { const q = P(U + 1, b, H); r.px(q[0], q[1], S.body.dark); }
      r.poly(quadL(P, V + 1, Math.round(U / 2) - 3, Math.round(U / 2) + 3, H + 1, H + 2), S.lid === CW ? CR.base : CR.dark);   // latch
      const t = P(2, 2, H + S.lidH); r.px(t[0], t[1], SPEC); r.px(t[0] + 1, t[1], SPEC);
    } else {
      // inside: shaded walls, ice and a wrapped pack of raw meat
      r.poly(fc.top, S.body.shade);
      r.poly([P(1, 1, H), P(U - 1, 1, H), P(U - 1, V - 1, H), P(1, V - 1, H)], CW.dark);
      for (let i = 0; i < 7; i++) {
        const q = P(2 + Math.floor(r.rnd() * (U - 4)), 2 + Math.floor(r.rnd() * (V - 4)), H);
        r.rect(q[0], q[1], 2, 2, GL.hi); r.px(q[0] + 1, q[1] + 1, GL.base);
      }
      const raw = PAL.MEAT.ribs.raw, q = P(U / 2, V / 2, H);
      r.rect(q[0] - 3, q[1] - 1, 7, 3, raw.base); r.rect(q[0] - 3, q[1] - 1, 7, 1, raw.hi); r.px(q[0] - 1, q[1], BN.base);
      for (let a = 0; a < U; a++) { const z = P(a, V, H); r.px(z[0], z[1] - 1, PAL.rim(S.body)); }
    }
  });
}

// The cutting station (mock B cuttingStation): four legs, a wood top, a board, a brisket and slices.
function board(r, f) {
  const U = 14, V = 14, Z = 22, P = frameAt(16, 51, U, V);
  r.obj(function () {
    [[1, 1], [11, 1], [1, 11], [11, 11]].forEach(function (q, i) {
      iso(r, P, q[0], q[1], q[0] + 2, q[1] + 2, 0, Z, WD, { rim: false, left: i === 2 ? WD.hi : WD.base });
    });
    r.poly(quadL(P, 12, 2, 12, 7, 8), WD.shade);               // stretcher
  });
  r.obj(function () {
    iso(r, P, 0, 0, U, V, Z, 4, WM, { rimColor: WM.rim, crease: true });
    iso(r, P, 2, 2, 12, 12, Z + 4, 2, BD, { rim: false });
    [[5, 4], [9, 8], [4, 9]].forEach(function (k) { const q = P(k[0], k[1], Z + 6); r.px(q[0], q[1], BD.shade); });   // knife marks
    if (f === 0) {
      const a = P(4, 9, Z + 6), b = P(11, 4, Z + 6);
      r.line(a[0], a[1], b[0], b[1], ST.hi); r.line(a[0], a[1] + 1, b[0], b[1] + 1, ST.base);
      r.rect(b[0] + 1, b[1] - 1, 4, 2, WD.base); r.px(b[0] + 1, b[1] - 1, WD.hi);
    }
  });
  if (f === 1) {
    r.obj(function () {                                       // whole brisket, cut end to the right
      iso(r, P, 3, 3, 9, 8, Z + 6, 5, BR, { top: BR.barkL, left: BR.bark, right: BR.base, rim: false });
      for (let b = 3; b < 8; b++) {
        const q = P(9, b, Z + 6);
        r.px(q[0], q[1] - 5, BR.bark); r.px(q[0], q[1] - 4, BR.ring); r.px(q[0], q[1] - 3, BR.ring); r.px(q[0], q[1] - 1, BR.fat);
      }
      for (let i = 0; i < 8; i++) { const q = P(3.5 + r.rnd() * 5, 3.5 + r.rnd() * 4, Z + 11); r.px(q[0], q[1], i % 3 ? PAL.MEAT.brisket.burnt.dark : BR.hi); }
    });
    r.obj(function () {                                       // three thick slices, cut face to us
      [4, 7, 10].forEach(function (a) {
        const q = P(a, 11, Z + 6), x = Math.round(q[0]) - 2, y = Math.round(q[1]) - 6;
        r.rect(x, y, 4, 1, BR.bark); r.rect(x, y + 1, 4, 1, BR.ring); r.rect(x, y + 2, 4, 3, BR.base); r.rect(x, y + 5, 4, 1, BR.fat);
        r.px(x + 1, y + 3, BR.hi); r.px(x + 3, y + 2, BR.shade);
      });
      const k = P(13, 12, Z + 6); r.line(k[0] - 6, k[1] - 1, k[0], k[1] - 4, ST.hi); r.px(k[0] + 1, k[1] - 4, WD.base); r.px(k[0] + 2, k[1] - 5, WD.base);
    });
  }
}

// The serving table: mock B's blue cloth table running down the diagonal (along v). U deep, V long.
const COUNTER_GEO = { U: 16, V: 48, H: 24, n: 3 };
const COUNTER_LONG_GEO = { U: 20, V: 76, H: 24, n: 5 };
function counterP(g) { return PROJ.isoP(1 + g.V, 1 + g.H); }
function counterTop(r, g) {
  const P = counterP(g), U = g.U, V = g.V, H = g.H;
  r.obj(function () {
    iso(r, P, 0, 0, U, V, 0, H, CL, { rimColor: CL.rim });
    // checks on the top cloth: 4 by 4 px cells on the iso grid
    for (let a = 0; a < U; a += 4) for (let b = 0; b < V; b += 4) {
      if (((a + b) / 4) % 2) continue;
      r.poly([P(a, b, H), P(a + 4, b, H), P(a + 4, b + 4, H), P(a, b + 4, H)], CL.check);
    }
    // drape folds, the white hem stripe round both faces, dark scallops at the hem
    for (let b = 6; b < V - 2; b += 10) { const q = P(U, b, 3); r.rect(q[0], q[1] - H + 7, 1, H - 9, CL.dark); }
    for (let a = 5; a < U - 2; a += 9) { const q = P(a, V, 3); r.rect(q[0], q[1] - H + 7, 1, H - 9, CL.shade); }
    for (let b = 0; b < V; b += 2) { const q = P(U, b + 1, 4); r.px(q[0], q[1], TRIM); r.px(q[0] - 1, q[1], TRIM); }
    for (let a = 0; a < U; a += 2) { const q = P(a + 1, V, 4); r.px(q[0], q[1], TRIM); r.px(q[0] + 1, q[1], TRIM); }
    for (let b = 2; b < V; b += 4) { const q = P(U, b, 0); r.px(q[0], q[1] - 1, CL.dark); r.px(q[0] - 1, q[1] - 1, CL.dark); }
    for (let a = 2; a < U; a += 4) { const q = P(a, V, 0); r.px(q[0], q[1] - 1, CL.dark); r.px(q[0] + 1, q[1] - 1, CL.dark); }
  });
}
function counterSlots(g) {
  const P = counterP(g), out = [];
  for (let k = 0; k < g.n; k++) { const q = P(g.U / 2, g.V * (k + 0.5) / g.n, g.H); out.push([Math.round(q[0]), Math.round(q[1])]); }
  return out;
}
// Cell: rhombus U + V wide plus a 1 px outline each side; front vertex on the last row but one.
function counterCell(g) { return { w: g.U + g.V + 2, h: (g.U + g.V) / 2 + g.H + 2, fx: 1 + g.U, fy: 1 + g.H + (g.U + g.V) / 2 }; }
const COUNTER_SLOTS = counterSlots(COUNTER_GEO);
const COUNTER_LONG_SLOTS = counterSlots(COUNTER_LONG_GEO);
function counter(r) { counterTop(r, COUNTER_GEO); }
function counterLong(r) { counterTop(r, COUNTER_LONG_GEO); }

function trash(r, f) {
  const cx = 16, top = 14, bot = 34;
  r.obj(function () {
    for (let x = -9; x <= 9; x++) {
      const u = x / 9.5, curve = 4.5 * Math.sqrt(Math.max(0, 1 - u * u));
      const col = x <= -6 ? ST.hi : x >= 7 ? ST.dark : x >= 3 ? ST.shade : ST.base;
      const yb = Math.round(bot + curve);
      for (let y = top; y < yb; y++) {
        const taper = (y - top) / (bot - top);
        if (Math.abs(x) === 9 && taper > 0.6) continue;
        r.px(cx + x, y, col);
      }
      [21, 28].forEach(function (yy) {
        const y = Math.round(yy + curve);
        r.px(cx + x, y, x >= 3 ? ST.dark : ST.shade); r.px(cx + x, y - 1, x <= -6 ? WHITE : ST.hi);
      });
      r.px(cx + x, yb - 1, ST.shade);
    }
    r.rect(cx - 11, 21, 2, 3, ST.shade); r.rect(cx + 10, 21, 2, 3, ST.dark);        // side grips
    if (f === 0) {
      r.ell(cx, top, 10.5, 5.2, ST.shade);
      r.ell(cx - 0.5, top - 0.6, 9.2, 4.2, ST.base);
      r.ell(cx - 2.5, top - 1.6, 5, 1.8, ST.hi);
      r.px(cx - 6, top - 2, WHITE);
      r.rect(cx - 3, top - 5, 7, 2, ST.shade); r.rect(cx - 2, top - 5, 5, 1, ST.hi);
      r.px(cx - 3, top - 3, ST.dark); r.px(cx + 3, top - 3, ST.dark);
    } else {
      r.ell(cx, top, 10, 5, ST.dark);
      r.ell(cx - 0.5, top - 1.5, 9, 5.5, CH.base, -1e9, top + 2);   // black bag bulging out
      r.ell(cx - 3, top - 3, 3.5, 1.6, CH.hi);
      r.px(cx - 5, top - 3, CH.ash);
      r.rect(cx - 1, top - 8, 3, 3, CH.base); r.px(cx - 2, top - 8, CH.hi); r.px(cx + 2, top - 9, CH.base);   // tie
      r.px(cx + 4, top - 3, BN.base); r.px(cx + 5, top - 4, BN.hi);
    }
  });
  if (f === 1) {
    r.obj(function () {                                       // lid leaning on the right side
      r.ell(cx + 10, top + 7, 3, 9, ST.shade);
      r.ell(cx + 9.5, top + 6.5, 2, 7.6, ST.base);
      r.rect(cx + 9, top + 4, 1, 4, ST.hi);
    });
  }
}

function prepTable(r, f) {
  const topR = f === 0 ? WL : ST, legR = f === 2 ? ST : WD;
  const U = 14, V = 14, Z = 18, P = frameAt(16, 47, U, V);
  r.obj(function () {
    [[1, 1], [11, 1], [1, 11], [11, 11]].forEach(function (q) { iso(r, P, q[0], q[1], q[0] + 2, q[1] + 2, 0, Z, legR, { rim: false }); });
    if (f === 2) iso(r, P, 1, 1, 13, 13, 6, 2, ST, { rim: false });
  });
  r.obj(function () {
    iso(r, P, 0, 0, U, V, Z, 3, topR, { crease: true });
    if (f === 0) for (let a = 4; a < U; a += 5) { const q = P(a, 0, Z + 3), e = P(a, V, Z + 3); r.line(q[0], q[1], e[0], e[1], WL.base); }   // plank joints
    if (f === 2) {
      const s = P(4, 9, 8); r.rect(s[0] - 3, s[1] - 3, 6, 3, BD.base); r.rect(s[0] - 3, s[1] - 3, 6, 1, BD.hi);   // box of rub on the shelf
      const t = P(10, 6, 8); r.rect(t[0] - 2, t[1] - 4, 5, 4, ST.hi); r.rect(t[0] - 2, t[1] - 1, 5, 1, ST.shade);
      r.poly(quadL(P, V, 1, 4, Z - 4, Z + 2), CL.base);            // towel over the edge
    }
  });
  r.obj(function () {
    if (f === 0) {                                            // a bowl of rub and a shaker
      const b = P(5, 7, Z + 3);
      r.ell(b[0], b[1], 5, 2.5, WD.base); r.ell(b[0], b[1] - 0.6, 4, 1.6, RP.soil.hi);
      r.px(b[0] - 1, b[1] - 1, EM.shade); r.px(b[0] + 1, b[1] - 1, EM.dark); r.px(b[0] + 2, b[1] - 1, RP.coin.base);
      const s = P(10, 4, Z + 3); r.rect(s[0], s[1] - 6, 3, 6, WHITE); r.rect(s[0], s[1] - 6, 3, 1, ST.base); r.px(s[0] + 2, s[1] - 4, ST.base);
    } else {                                                  // a steel tray with a raw rack and a knife
      iso(r, P, 2, 3, 11, 11, Z + 3, 1, ST, { rim: false });
      const raw = PAL.MEAT.ribs.raw, q = P(6.5, 7, Z + 4);
      r.rect(q[0] - 5, q[1] - 3, 10, 3, raw.base); r.rect(q[0] - 5, q[1] - 3, 10, 1, raw.hi);
      for (let x = -3; x < 5; x += 3) r.px(q[0] + x, q[1] - 2, BN.base);
      const k = P(12, 3, Z + 3); r.line(k[0] - 5, k[1] + 2, k[0], k[1] - 1, ST.hi); r.px(k[0] + 1, k[1] - 1, WD.base); r.px(k[0] + 2, k[1] - 2, WD.base);
      if (f === 2) { const j = P(3, 3, Z + 3); r.rect(j[0], j[1] - 5, 2, 5, DR.base); r.px(j[0], j[1] - 5, DR.hi); r.rect(j[0] + 3, j[1] - 4, 2, 4, RP.coin.shade); }
    }
  });
}

function warmer(r, f) {
  const U = 12, V = 12, Z = 4, H = 24, P = frameAt(16, 43, U, V);
  r.obj(function () { const a = P(2, V, 0), b = P(U, 2, 0), c = P(U, V, 0); wheel(r, a[0], a[1] - 2, 2.2); wheel(r, c[0], c[1] - 2, 2.2); wheel(r, b[0], b[1] - 2, 2); });
  r.obj(function () {
    iso(r, P, 0, 0, U, V, Z, H, ST, { crease: true });
    for (let k = 0; k < 4; k++) { const q = P(3 + k * 2, 4, Z + H); r.rect(q[0], q[1], 2, 1, ST.dark); }   // vents on top
    r.poly(quadR(P, U, 4, 8, Z + 13, Z + 15), ST.dark);                                       // side handle
    const win = quadL(P, V, 2, U - 2, Z + 6, Z + H - 4);
    if (f !== 2) {
      r.poly(quadL(P, V, 1, U - 1, Z + 5, Z + H - 3), ST.shade);
      r.poly(win, f === 1 ? EM.dark : K.dark);
      if (f === 1) {
        [[3, Z + 14, 'brisket'], [7, Z + 14, 'ribs'], [3, Z + 8, 'butt'], [7, Z + 8, 'chicken']].forEach(function (p) {
          const m = RP[p[2]];
          r.poly(quadL(P, V, p[0], p[0] + 3, p[1], p[1] + 3), m.base);
          r.poly(quadL(P, V, p[0], p[0] + 3, p[1] + 2, p[1] + 3), m.hi);
        });
      }
      const g = P(2.5, V, Z + H - 5); r.px(g[0], g[1], GL.hi); r.px(g[0] + 1, g[1], GL.hi); r.px(g[0], g[1] + 1, GL.hi);
      const on = P(1.5, V, Z + 3); r.px(on[0], on[1], f === 1 ? EM.hi : ST.shade);
    } else {
      r.poly(win, EM.dark);
      [Z + 8, Z + 13].forEach(function (z, i) {
        r.poly(quadL(P, V, 2, U - 2, z, z + 1), ST.base);
        const m = RP[['brisket', 'ribs'][i]];
        r.poly(quadL(P, V, 3, U - 4, z + 1, z + 3), m.base);
      });
    }
  });
  if (f === 2) {
    r.obj(function () {                                       // the door, swung open toward us on the left
      const a = P(0, V, Z + 5), b = P(0, V, Z + H - 3);
      r.poly([[a[0] - 7, a[1] + 1], [a[0], a[1]], [b[0], b[1]], [b[0] - 7, b[1] + 1]], ST.base);
      r.rect(a[0] - 6, b[1] + 4, 1, 8, ST.hi);
    });
  }
}

// Carried plate (a server's platter): bigger than a table plate, with a lit rim highlight.
function platter(r, m) {
  r.obj(function () {
    r.ell(13, 9, 12, 5.4, PL.dark);
    r.ell(13, 8.4, 11.2, 4.8, PL.base);
    r.ell(13.5, 9, 7.6, 2.8, PL.shade);
    r.ell(13.5, 8.6, 7, 2.3, PL.base);
    for (let x = 4; x < 12; x++) r.px(x, x < 7 ? 6 : 5, WHITE);                  // rim highlight top left
    r.px(3, 7, WHITE); r.px(2, 8, PL.hi);
    if (m) plateFoodAt(r, m, 3, 1);
  });
}

// Carried in the hands (v3.4 polish): a small charcoal bag (the pile's kraft paper, orange band and
// cream flame) and a to go box (a white clamshell, lid lit from the top left, a red sticker).
function carryBag(r) {
  r.obj(function () {
    r.rect(3, 5, 10, 11, BD.base);                     // lit front face
    r.rect(13, 6, 3, 10, BD.shade);                    // shaded side
    r.rect(3, 2, 10, 3, BD.hi);                        // rolled lip, lit
    r.rect(13, 3, 3, 3, BD.base);
    r.rect(3, 5, 10, 1, BD.dark);                      // crease under the lip
    r.rect(13, 6, 3, 1, BD.dark);
    r.rect(4, 6, 1, 9, BD.hi);                         // top left light down the front
    r.rect(3, 9, 10, 4, RP.orange.base);               // the band
    r.rect(3, 9, 10, 1, RP.orange.hi);
    r.rect(13, 9, 3, 4, RP.orange.shade);
    r.grid(GRIDS.flameSmall, { '#': CREAM }, 7, 9);
    r.px(3, 2, 0); r.px(15, 3, 0);                     // slumped corners
  });
  r.obj(function () { r.rect(5, 1, 3, 1, CH.base); r.px(9, 1, CH.base); });   // briquettes at the mouth
}
function carryTogo(r) {
  r.obj(function () {
    r.rect(2, 6, 13, 6, CW.base);                      // front face
    r.rect(15, 5, 2, 7, CW.shade);                     // side
    r.rect(3, 2, 13, 4, WHITE);                        // lid top, lit
    r.rect(2, 5, 13, 1, CW.shade);                     // lid seam
    r.rect(2, 11, 13, 1, CW.shade);
    r.rect(3, 3, 4, 1, CW.base);                       // lid crease
    r.rect(7, 7, 3, 3, RP.drum.base);                  // sticker
    r.px(7, 7, RP.drum.hi);
  });
}

/* ---------------------------------------------------------------- meat on the grate */
// Paint one meat shape with ramp mr ({hi, base, shade, dark}) plus extras; state drives detail.
function meatShape(r, m, st) {
  const done = st === 'done' || st === 'warn';
  const mr = st === 'raw' ? PAL.MEAT[m].raw : st === 'cooking' ? PAL.MEAT[m].cooking : st === 'burnt' ? PAL.MEAT[m].burnt : PAL.MEAT[m].done;
  const marks = st !== 'raw';
  const pale = st === 'raw' ? mr.hi : st === 'burnt' ? CH.ashD : BN.base;
  function grill(x0, y0, x1, y1, step) {
    if (!marks) return;
    for (let x = x0; x <= x1; x += step) for (let k = 0; k < 3; k++) {
      const px = x + k, py = y1 - k;
      if (py >= y0 && (r.get(px, py) >>> 24) === 255) r.px(px, py, mr.dark);
    }
  }
  if (m === 'sausage') {
    [4, 11].forEach(function (y) {
      r.rect(3, y, 14, 5, mr.base);
      r.rect(2, y + 1, 1, 3, mr.base); r.rect(17, y + 1, 1, 3, mr.shade);
      r.rect(3, y, 14, 1, mr.hi); r.rect(3, y + 3, 14, 2, mr.shade); r.rect(4, y + 4, 12, 1, mr.dark);
      r.px(2, y + 1, mr.hi);
      grill(5, y, 15, y + 3, 4);
      if (st === 'raw') { r.px(6, y + 2, pale); r.px(11, y + 1, pale); r.px(14, y + 2, pale); }
    });
  } else if (m === 'chicken') {
    r.ell(9, 9, 7, 6, mr.shade);
    r.ell(8.4, 8.4, 6.2, 5.2, mr.base);
    r.ell(6.5, 6.5, 3, 2, mr.hi);
    r.ell(13.5, 13.5, 3.5, 2.8, mr.shade); r.ell(13, 13, 2.6, 2, mr.base);
    r.rect(15, 15, 3, 2, BN.base); r.px(18, 15, BN.hi); r.px(18, 17, BN.shade); r.px(15, 16, BN.shade);
    grill(4, 5, 13, 13, 4);
    if (st === 'done' || st === 'warn') { r.px(5, 9, mr.hi); r.px(10, 6, mr.hi); r.px(8, 12, mr.hi); }
    if (st === 'raw') { r.px(6, 10, BN.base); r.px(11, 8, BN.base); }
  } else if (m === 'ribs') {
    r.rect(2, 6, 16, 9, mr.base);
    r.rect(1, 7, 1, 7, mr.base); r.rect(18, 7, 1, 6, mr.shade);
    r.rect(2, 6, 16, 2, mr.hi);
    r.rect(2, 12, 16, 2, mr.shade); r.rect(2, 14, 16, 1, mr.dark);
    for (let x = 4; x < 18; x += 4) {
      r.rect(x, 7, 1, 7, st === 'raw' ? BN.shade : mr.dark);
      r.rect(x, 4, 2, 2, pale); r.px(x + 1, 5, st === 'burnt' ? CH.base : BN.shade);
    }
    if (done) { r.px(6, 8, WHITE); r.px(7, 8, SPEC); r.px(14, 9, SPEC); }
  } else if (m === 'butt') {
    r.ell(10, 10.5, 8, 7, mr.shade);
    r.ell(9.4, 9.8, 7.2, 6.2, mr.base);
    r.ell(7, 7.5, 3.5, 2.4, mr.hi);
    for (let i = 0; i < 14; i++) {
      const x = 3 + Math.floor(r.rnd() * 14), y = 4 + Math.floor(r.rnd() * 13);
      if ((r.get(x, y) >>> 24) !== 255) continue;
      if (st === 'raw') { if (i % 3 === 0) r.px(x, y, mr.hi); }
      else r.px(x, y, st === 'burnt' ? CH.ash : (i % 2 ? RP.butt.bark : mr.dark));
    }
    if (st === 'raw') { r.line(6, 11, 12, 9, mr.hi); r.line(8, 14, 13, 12, mr.hi); }
  } else if (m === 'brisket') {
    r.rect(2, 6, 16, 10, mr.base);
    r.rect(1, 7, 1, 8, mr.base); r.rect(18, 7, 1, 8, mr.shade);
    r.rect(2, 6, 16, 1, mr.hi);
    r.rect(2, 14, 16, 2, mr.shade);
    const cap = st === 'raw' ? BR.fat : st === 'cooking' ? PAL.mix(BR.fat, mr.base, 0.45) : st === 'burnt' ? mr.base : BR.barkL;
    r.rect(2, 7, 16, 2, cap); r.rect(1, 8, 1, 1, cap);
    if (st !== 'raw') for (let i = 0; i < 12; i++) {
      const x = 2 + Math.floor(r.rnd() * 16), y = 7 + Math.floor(r.rnd() * 8);
      r.px(x, y, st === 'burnt' ? CH.ash : (i % 3 ? BR.bark : mr.dark));
    }
    if (st === 'raw') { r.line(5, 12, 9, 11, mr.hi); r.line(11, 13, 15, 11, mr.hi); }
    grill(4, 9, 16, 13, 5);
  }
}
function piece(r, f, m) {
  const st = ['raw', 'cooking', 'done', 'burnt', 'warn'][f];
  r.obj(function () {
    meatShape(r, m, st);
    if (st === 'warn') {
      const burnt = PAL.MEAT[m].burnt;
      r.edgeMap(function (x, y) { r.px(x, y, (x + y) % 3 === 0 ? burnt.base : burnt.dark); });
    }
    if (st === 'burnt') r.edgeMap(function (x, y) { if ((x * 3 + y) % 7 === 0) r.px(x, y, CH.ash); });
  });
  if (st === 'done') r.obj(function () { r.grid(GRIDS.check, { '#': RP.lawnA.hi }, 14, 1); });
  if (st === 'warn') r.obj(function () { r.grid(GRIDS.wisp, { '#': SM.shade }, 13, 1); }, SM.ol);
}

/* ---------------------------------------------------------------- plates */
function plateBase(r) {
  r.ell(10, 7.5, 9, 4.2, PL.shade);
  r.ell(10, 7, 8.2, 3.5, PL.base);
  r.ell(10.4, 7.4, 5.4, 1.9, PL.hi);
  r.px(4, 6, WHITE); r.px(5, 5, WHITE);
}
function plateFood(r, m) {
  const d = RP[m];
  if (m === 'sausage') {
    r.rect(5, 4, 10, 3, d.base); r.rect(6, 4, 8, 1, d.hi); r.px(4, 5, d.base); r.px(15, 5, d.shade);
    r.rect(5, 6, 10, 1, d.shade); r.px(8, 5, d.dark); r.px(12, 5, d.dark);
  } else if (m === 'chicken') {
    r.ell(9, 5, 4.2, 2.6, d.shade); r.ell(8.6, 4.6, 3.6, 2, d.base); r.ell(7.6, 4, 1.8, 1, d.hi);
    r.rect(13, 5, 3, 1, BN.base); r.px(16, 4, BN.base); r.px(16, 6, BN.shade);
  } else if (m === 'ribs') {
    r.rect(4, 3, 12, 4, d.base); r.rect(4, 3, 12, 1, d.hi); r.rect(4, 6, 12, 1, d.shade);
    for (let x = 7; x < 16; x += 3) r.px(x, 4, d.dark), r.px(x, 5, d.dark);
    r.px(3, 5, BN.base); r.px(16, 3, BN.base);
  } else if (m === 'butt') {
    r.ell(10, 5, 5, 2.6, d.shade); r.ell(9.6, 4.6, 4.2, 2, d.base);
    [[7, 4, d.hi], [9, 3, d.hi], [12, 4, d.dark], [8, 6, d.dark], [11, 5, RP.butt.bark], [10, 4, d.hi], [13, 5, d.hi]].forEach(function (p) { r.px(p[0], p[1], p[2]); });
  } else if (m === 'brisket') {
    [4, 8, 12].forEach(function (x) {
      r.rect(x, 3, 3, 1, d.bark); r.rect(x, 4, 3, 1, d.ring); r.rect(x, 5, 3, 1, d.base); r.rect(x, 6, 3, 1, d.fat);
      r.px(x + 2, 5, d.shade);
    });
  }
}
function plateFoodAt(r, m, dx, dy) {
  plateFood({
    rect: function (x, y, w, h, c) { r.rect(x + dx, y + dy, w, h, c); },
    px: function (x, y, c) { r.px(x + dx, y + dy, c); },
    ell: function (x, y, rx, ry, c) { r.ell(x + dx, y + dy, rx, ry, c); }
  }, m);
}
function plate(r, f, m) { r.obj(function () { plateBase(r); if (m) plateFood(r, m); }); }

/* ---------------------------------------------------------------- dish cards (round 2) */
// Card size plated meat for the dish dock (mock B's bottom tray): a wide plate with a lit rim and
// the grate's done piece on it. 48 x 30, anchor = the plate centre, one frame.
function shifted(r, dx, dy) {
  return {
    rnd: r.rnd,
    px: function (x, y, c) { r.px(x + dx, y + dy, c); },
    rect: function (x, y, w, h, c) { r.rect(x + dx, y + dy, w, h, c); },
    ell: function (x, y, rx, ry, c) { r.ell(x + dx, y + dy, rx, ry, c); },
    line: function (x0, y0, x1, y1, c) { r.line(x0 + dx, y0 + dy, x1 + dx, y1 + dy, c); },
    get: function (x, y) { return r.get(x + dx, y + dy); }
  };
}
function dish(r, m) {
  r.obj(function () {
    r.ell(24, 18.5, 22, 10, PL.dark);
    r.ell(24, 17.5, 21, 9, PL.base);
    r.ell(24.5, 18.5, 14, 5.6, PL.shade);
    r.ell(24.5, 18, 13.2, 5, PL.base);
    for (let x = 7; x < 20; x++) r.px(x, x < 11 ? 12 - ((x - 7) >> 1) : 10, WHITE);   // rim light, top left
    r.px(5, 14, WHITE); r.px(4, 15, PL.hi); r.px(6, 13, PL.hi);
  });
  r.obj(function () {
    const d = RP[m];
    if (m === 'sausage') {                                    // one fat link, grill marks, lit top
      r.rect(16, 11, 16, 6, d.base); r.rect(15, 12, 1, 4, d.base); r.rect(32, 12, 1, 4, d.shade);
      r.rect(16, 11, 16, 1, d.hi); r.px(15, 12, d.hi); r.rect(17, 12, 6, 1, PAL.rim(d));
      r.rect(16, 15, 16, 2, d.shade); r.rect(17, 16, 14, 1, d.dark);
      [19, 24, 29].forEach(function (x) { r.px(x, 14, d.dark); r.px(x + 1, 13, d.dark); r.px(x + 2, 12, d.dark); });
    } else if (m === 'brisket') {                             // three slices standing, cut face out
      [15, 21, 27].forEach(function (x, k) {
        const y = 9 + (k === 1 ? -1 : 0);
        r.rect(x, y, 6, 2, d.bark); r.px(x + 1, y, d.barkL); r.px(x + 2, y, d.barkL);
        r.rect(x, y + 2, 6, 1, d.ring);
        r.rect(x, y + 3, 6, 4, d.base); r.rect(x + 5, y + 3, 1, 4, d.shade); r.px(x + 1, y + 4, d.hi);
        r.rect(x, y + 7, 6, 1, d.fat);
        r.rect(x + 5, y, 1, 8, d.dark);
      });
    } else meatShape(shifted(r, 14, 2), m, 'done');
  });
}
// One card of the dish dock, drawn straight to a 2D context at (x, y), w by h render px.
// opts: { selected (raised 3 px, gold band, orange ring), label (default the meat id in capitals) }.
function dishCard(ctx, x, y, w, h, m, opts) {
  const o = opts || {}, sel = !!o.selected;
  const yy = sel ? y - 3 : y;
  const fill = function (c, X, Y, W, H) { ctx.fillStyle = c; ctx.fillRect(X, Y, W, H); };
  fill(OL, x + 2, y + 3, w, h);                                      // drop shadow on the tray
  if (sel) { fill(OL, x - 4, yy - 4, w + 8, h + 8); fill(PAL.ANCHOR.O, x - 3, yy - 3, w + 6, h + 6); fill(RP.orange.hi, x - 3, yy - 3, w + 6, 1); }
  fill(OL, x - 1, yy - 1, w + 2, h + 2);
  fill(sel ? PAL.UI.gold : WM.shade, x, yy, w, h);
  fill(sel ? PAL.UI.goldL : WM.base, x, yy, w, 1); fill(sel ? PAL.UI.goldL : WM.base, x, yy, 1, h);
  fill(PAL.ANCHOR.O, x + 3, yy + 3, w - 6, h - 6);
  fill(CREAM, x + 5, yy + 5, w - 10, h - 10);
  fill(RP.fence.base, x + 5, yy + 5, w - 10, 3);
  fill(RP.fence.shade, x + 5, yy + h - 7, w - 10, 2);
  drawAt(ctx, 'dish_' + m, x + Math.round(w / 2), yy + Math.round(h * 0.42), 0);
  const label = o.label === undefined ? String(m).toUpperCase() : String(o.label);
  if (label && typeof art3.text === 'function') {
    const tw = typeof art3.textWidth === 'function' ? art3.textWidth(label, { bold: true }) : label.length * 6;
    art3.text(ctx, label, x + Math.round((w - tw) / 2), yy + h - 18, WD.dark, { bold: true });
  }
}

/* ---------------------------------------------------------------- fire gauge */
const GAUGE_STEPS = 16;
function gaugeBand(f01) { // sim.js fireBand thresholds: out under 10, low under 50, good under 85
  const p = f01 * 100;
  return p < 10 ? 0 : p < 50 ? 1 : p < 85 ? 2 : 3;
}
const GAUGE_FILL = [
  { hi: SM.shade, base: SM.dark },            // out
  { hi: WL.hi, base: WL.base },               // low (v2 woodL)
  { hi: RP.lawnA.hi, base: RP.lawnA.base },   // good (v2 lawnA)
  { hi: EM.hi, base: PAL.ANCHOR.O }           // hot (v2 orange anchor)
];
function gauge(r, f) {
  const f01 = f / GAUGE_STEPS, band = gaugeBand(f01), fill = GAUGE_FILL[band];
  r.obj(function () {
    r.rect(2, 1, 4, 32, ST.base); r.rect(2, 1, 1, 32, ST.hi); r.rect(5, 1, 1, 32, ST.shade);
    r.px(2, 1, 0); r.px(5, 1, 0);
    r.ell(4, 35.5, 3, 3, ST.base); r.ell(3.8, 35.3, 2.3, 2.3, ST.shade);
    r.rect(3, 2, 2, 31, K.dark);
    r.ell(4, 35.5, 1.8, 1.8, fill.base); r.px(3, 34, fill.hi);
    const inner = 30, fh = Math.round(f01 * inner);
    for (let k = 0; k < fh; k++) { const y = 32 - k; r.px(3, y, fill.hi); r.px(4, y, fill.base); }
    r.rect(3, 33, 2, 1, fill.base);
    [0.5, 0.85].forEach(function (t) { const y = 32 - Math.round(t * inner) + 1; r.px(6, y, CREAM); r.px(1, y, CREAM); });
  });
}

/* ---------------------------------------------------------------- the set */
const DEFS = {};
const ORDER = [];
function def(name, w, h, ax, ay, n, paint, meta) {
  if (DEFS[name]) throw new Error('art3 kit: duplicate sprite "' + name + '"');
  DEFS[name] = { name: name, w: w, h: h, ax: ax, ay: ay, n: n, paint: paint, meta: meta || {} };
  ORDER.push(name);
}
// shadow: { rx, ry, a } with a the PAL.ALPHA key (bible 3: centre anchor x + 1, anchor y - 1)
def('kettle', 32, 52, 16, 52, 5, kettle, { shadow: { rx: 13, ry: 5, a: 'shadowPerson' }, footprint: [1, 1] });
def('drum', 32, 72, 16, 72, 4, drum, { shadow: { rx: 13, ry: 6, a: 'shadowPerson' }, footprint: [1, 2] });
def('cabinet', 32, 76, 16, 76, 4, cabinet, { shadow: { rx: 15, ry: 5, a: 'shadowProp' }, footprint: [1, 2], isoShadow: [0, -15, 14, 14] });
def('stick_burner', 64, 56, 32, 56, 4, stickBurner, { shadow: { rx: 30, ry: 6, a: 'shadowProp' }, footprint: [2, 1] });
def('trailer_rig', 80, 64, 40, 64, 4, trailerRig, { shadow: { rx: 36, ry: 7, a: 'shadowWide' }, footprint: [2, 1] });
def('pile', 32, 32, 16, 32, 4, pile, { shadow: { rx: 14, ry: 5, a: 'shadowProp' }, footprint: [1, 1] });
def('woodpile', 32, 40, 16, 40, 3, woodpile, { shadow: { rx: 14, ry: 5, a: 'shadowProp' }, footprint: [1, 1], isoShadow: [-3, -18, 20, 14] });
def('cooler', 32, 48, 16, 48, 6, cooler, { shadow: { rx: 13, ry: 5, a: 'shadowProp' }, footprint: [1, 1], isoShadow: [-2, -17, 18, 14] });
def('board', 32, 52, 16, 52, 2, board, { shadow: { rx: 15, ry: 5, a: 'shadowProp' }, footprint: [1, 1], isoShadow: [0, -15, 14, 14] });
(function () {
  const c1 = counterCell(COUNTER_GEO), c2 = counterCell(COUNTER_LONG_GEO);
  def('counter', c1.w, c1.h, c1.w >> 1, c1.fy, 1, counter, { shadow: { rx: 30, ry: 12, a: 'shadowWide' }, footprint: [2, 2], slots: COUNTER_SLOTS, iso: COUNTER_GEO, front: [c1.fx, c1.fy], isoShadow: [1 + COUNTER_GEO.V - (c1.w >> 1), 1 + COUNTER_GEO.H - c1.fy, COUNTER_GEO.U, COUNTER_GEO.V] });
  def('counter_long', c2.w, c2.h, c2.w >> 1, c2.fy, 1, counterLong, { shadow: { rx: 44, ry: 18, a: 'shadowWide' }, footprint: [3, 2], slots: COUNTER_LONG_SLOTS, iso: COUNTER_LONG_GEO, front: [c2.fx, c2.fy], isoShadow: [1 + COUNTER_LONG_GEO.V - (c2.w >> 1), 1 + COUNTER_LONG_GEO.H - c2.fy, COUNTER_LONG_GEO.U, COUNTER_LONG_GEO.V] });
})();
def('trash', 32, 40, 16, 40, 2, trash, { shadow: { rx: 10, ry: 4, a: 'shadowProp' }, footprint: [1, 1] });
def('prep_table', 32, 48, 16, 48, 3, prepTable, { shadow: { rx: 15, ry: 5, a: 'shadowWide' }, footprint: [1, 1], isoShadow: [0, -15, 14, 14] });
def('warmer', 32, 44, 16, 44, 3, warmer, { shadow: { rx: 13, ry: 5, a: 'shadowProp' }, footprint: [1, 1], isoShadow: [0, -13, 12, 12] });
MEAT_IDS.forEach(function (m) { def('piece_' + m, 20, 20, 10, 20, 5, function (r, f) { piece(r, f, m); }); });
MEAT_IDS.forEach(function (m) { def('plate_' + m, 20, 13, 10, 7, 1, function (r, f) { plate(r, f, m); }); });
def('plate_empty', 20, 13, 10, 7, 1, function (r, f) { plate(r, f, null); });
// Carried platters (round 1): a server's plate, larger than a table plate, with a lit rim.
MEAT_IDS.forEach(function (m) { def('platter_' + m, 26, 16, 13, 9, 1, function (r) { platter(r, m); }); });
def('platter_empty', 26, 16, 13, 9, 1, function (r) { platter(r, null); });
def('carry_charcoal', 18, 18, 9, 15, 1, carryBag);
def('carry_togo', 18, 14, 9, 11, 1, carryTogo);
// Dish dock plates (round 2): card size, for dishCard().
MEAT_IDS.forEach(function (m) { def('dish_' + m, 48, 30, 24, 15, 1, function (r) { dish(r, m); }); });
def('gauge', 8, 40, 4, 40, GAUGE_STEPS + 1, gauge);

(function validateDefs() {
  ORDER.forEach(function (name) {
    const d = DEFS[name];
    if (!(d.w > 0 && d.h > 0 && d.w % 1 === 0 && d.h % 1 === 0)) throw new Error('art3 kit: ' + name + ' has a bad size');
    if (!(d.n >= 1)) throw new Error('art3 kit: ' + name + ' has no frames');
    if (d.ax < 0 || d.ax > d.w || d.ay < 0 || d.ay > d.h) throw new Error('art3 kit: ' + name + ' anchor outside its cell');
    if (d.meta.shadow && !ALPHA[d.meta.shadow.a]) throw new Error('art3 kit: ' + name + ' shadow alpha "' + d.meta.shadow.a + '" not in PAL.ALPHA');
    (d.meta.slots || []).forEach(function (s) {
      if (s[0] < 0 || s[0] >= d.w || s[1] < 0 || s[1] >= d.h) throw new Error('art3 kit: ' + name + ' slot outside its cell');
    });
  });
})();

/* ---------------------------------------------------------------- build and draw */
let built = false;
const PIX = {};       // name -> [Uint32Array per frame]
const stats = { names: ORDER.length, frames: 0, paintMs: 0, canvasMs: 0, bytes: 0, atlas: null };
function now() { return (globalThis.performance && performance.now) ? performance.now() : Date.now(); }

function paintAll() {
  const t0 = now();
  let frames = 0;
  ORDER.forEach(function (name) {
    const d = DEFS[name];
    PIX[name] = [];
    for (let f = 0; f < d.n; f++) {
      const r = new Ras(d.w, d.h, mulberry32(hashStr(name + '#' + f)));
      d.paint(r, f);
      PIX[name].push(r.main);
      frames++;
    }
  });
  stats.frames = frames;
  stats.paintMs = now() - t0;
}
// Every frame goes into one atlas canvas (shelf packed, 1 px gutters): one canvas, one put.
const ATLAS_W = 512;
let atlas = null;
const RECT = {};      // name -> [{ sx, sy } per frame]
function build() {
  if (built) return;
  paintAll();
  let x = 0, y = 0, rowH = 0;
  ORDER.forEach(function (name) {
    const d = DEFS[name];
    RECT[name] = [];
    for (let f = 0; f < d.n; f++) {
      if (x + d.w > ATLAS_W) { x = 0; y += rowH + 1; rowH = 0; }
      RECT[name].push({ sx: x, sy: y });
      x += d.w + 1; rowH = Math.max(rowH, d.h);
    }
  });
  const H = y + rowH;
  stats.atlas = [ATLAS_W, H];
  stats.bytes = ATLAS_W * H * 4;
  if (typeof document !== 'undefined' && document.createElement) {
    const t0 = now();
    const buf = new Uint32Array(ATLAS_W * H);
    ORDER.forEach(function (name) {
      const d = DEFS[name];
      PIX[name].forEach(function (src, f) {
        const o = RECT[name][f];
        for (let j = 0; j < d.h; j++) buf.set(src.subarray(j * d.w, j * d.w + d.w), (o.sy + j) * ATLAS_W + o.sx);
      });
    });
    atlas = document.createElement('canvas');
    atlas.width = ATLAS_W; atlas.height = H;
    const g = atlas.getContext('2d');
    const img = g.createImageData(ATLAS_W, H);
    new Uint32Array(img.data.buffer).set(buf);
    g.putImageData(img, 0, 0);
    stats.canvasMs = now() - t0;
  }
  built = true;
}
function has(name) { return Object.prototype.hasOwnProperty.call(DEFS, name); }
function frames(name) { return has(name) ? DEFS[name].n : 0; }
function wrap(name, frame) {
  const n = DEFS[name].n;
  let f = Math.trunc(Number(frame) || 0);
  return ((f % n) + n) % n;
}
function need(name) {
  if (!has(name)) throw new Error('art3 kit: unknown sprite "' + name + '"');
  if (!built) build();
}
// Where a frame lives: { img (the atlas canvas), sx, sy, w, h }.
function frameRect(name, frame) {
  need(name);
  if (!atlas) throw new Error('art3 kit: no canvas outside a browser');
  const d = DEFS[name], o = RECT[name][wrap(name, frame)];
  return { img: atlas, sx: o.sx, sy: o.sy, w: d.w, h: d.h };
}
function pixels(name, frame) { need(name); return PIX[name][wrap(name, frame)]; }
function blit(ctx, r, x, y, w, h, flip) {
  if (flip === true) {
    ctx.save(); ctx.translate(x + w, y); ctx.scale(-1, 1); ctx.drawImage(r.img, r.sx, r.sy, r.w, r.h, 0, 0, w, h); ctx.restore();
  } else ctx.drawImage(r.img, r.sx, r.sy, r.w, r.h, x, y, w, h);
}
// Top left, as PitSim.art.draw. flip mirrors about the cell's vertical centre with no new canvas.
function draw(ctx, name, x, y, frame, flip) {
  const r = frameRect(name, frame);
  blit(ctx, r, x, y, r.w, r.h, flip);
}
// By anchor: (ax, ay) is the footprint's bottom centre in world px (plates: the plate centre).
function drawAt(ctx, name, ax, ay, frame, flip) {
  need(name);
  const d = DEFS[name];
  const x = flip === true ? ax - (d.w - d.ax) : ax - d.ax;
  draw(ctx, name, Math.round(x), Math.round(ay - d.ay), frame, flip);
}
function drawScaled(ctx, name, x, y, w, h, frame, flip) {
  const r = frameRect(name, frame);
  if (!(w >= 1) || !(h >= 1)) return;
  const prev = ctx.imageSmoothingEnabled;
  ctx.imageSmoothingEnabled = false;
  blit(ctx, r, x, y, w, h, flip);
  ctx.imageSmoothingEnabled = prev;
}
function canvasFor(name, frame, scale) {
  const r = frameRect(name, frame);
  const k = Math.max(1, Math.trunc(Number(scale) || 1));
  const c = document.createElement('canvas');
  c.width = r.w * k; c.height = r.h * k;
  const g = c.getContext('2d');
  g.imageSmoothingEnabled = false;
  g.drawImage(r.img, r.sx, r.sy, r.w, r.h, 0, 0, c.width, c.height);
  return c;
}
function anchor(name) {
  if (!has(name)) throw new Error('art3 kit: unknown sprite "' + name + '"');
  const d = DEFS[name];
  return { w: d.w, h: d.h, ax: d.ax, ay: d.ay, footprint: d.meta.footprint ? d.meta.footprint.slice() : null, spill: d.meta.spill || 0 };
}
function slots(name) { return has(name) && DEFS[name].meta.slots ? DEFS[name].meta.slots.map(function (s) { return s.slice(); }) : []; }
function shadow(name) { const s = has(name) && DEFS[name].meta.shadow; return s ? { rx: s.rx, ry: s.ry, a: s.a, css: ALPHA[s.a].css } : null; }
// The ground-layer ellipse under a sprite placed by anchor, pixel exact (no antialiasing).
function drawShadow(ctx, name, ax, ay) {
  const s = shadow(name);
  if (!s) return;
  const iz = DEFS[name].meta.isoShadow;
  if (iz) {
    // Round 1: iso props cast their footprint rhombus, nudged 3 right and 2 down (light top left).
    const ox = Math.round(ax) + iz[0] + 3, oy = Math.round(ay) + iz[1] + 2, U = iz[2], V = iz[3];
    ctx.fillStyle = s.css;
    spans([[ox, oy], [ox + U, oy + U / 2], [ox + U - V, oy + (U + V) / 2], [ox - V, oy + V / 2]], function (y, xa, xb) { ctx.fillRect(xa, y, xb - xa, 1); });
    return;
  }
  const cx = Math.round(ax) + 1, cy = Math.round(ay) - 1;
  ctx.fillStyle = s.css;
  for (let y = -s.ry; y < s.ry; y++) {
    const dy = (y + 0.5) / s.ry, half = s.rx * Math.sqrt(Math.max(0, 1 - dy * dy));
    const xa = Math.round(cx - half), xb = Math.round(cx + half);
    if (xb > xa) ctx.fillRect(xa, cy + y, xb - xa, 1);
  }
}
function gaugeFrame(fire01) { return Math.max(0, Math.min(GAUGE_STEPS, Math.round(Number(fire01) * GAUGE_STEPS) || 0)); }

const kit = {
  TILE: 32,
  MEATS: MEAT_IDS.slice(),
  GAUGE_STEPS: GAUGE_STEPS,
  build: build,
  has: has,
  frames: frames,
  names: function () { return ORDER.slice(); },
  draw: draw,
  drawAt: drawAt,
  drawScaled: drawScaled,
  canvasFor: canvasFor,
  frameRect: frameRect,
  pixels: pixels,
  anchor: anchor,
  slots: slots,
  shadow: shadow,
  drawShadow: drawShadow,
  gaugeFrame: gaugeFrame,
  dishCard: dishCard,
  box: box,
  stats: stats
};
Object.defineProperty(kit, 'built', { enumerable: true, get: function () { return built; } });

art3.kit = kit;
art3.parts = art3.parts || {};
art3.parts.kit = kit;
if (typeof art3.box !== 'function') art3.box = box;
if (typeof art3.draw !== 'function') {
  // Until index.js replaces it: find the category file that owns the name and draw from it.
  art3.draw = function (ctx, name, x, y, frame, flip) {
    const parts = art3.parts || {};
    const keys = Object.keys(parts);
    for (let i = 0; i < keys.length; i++) {
      const p = parts[keys[i]];
      if (p && typeof p.has === 'function' && p.has(name)) return p.draw(ctx, name, x, y, frame, flip);
    }
    throw new Error('art3: unknown sprite "' + name + '"');
  };
}
})();
