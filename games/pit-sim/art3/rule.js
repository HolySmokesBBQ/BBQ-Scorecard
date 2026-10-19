// games/pit-sim/art3/rule.js
// Your Pit v3 art library: the size rule redraw (spec docs/superpowers/specs/
// 2026-10-19-pit-sim-angle-redo.md, section B). Every station, cooker, table, prop, decor item,
// barn and fence piece, ground tile and the "+" for-sale mark, redrawn for the 48 by 24 tile with
// the person (47 rp, hat 51) as the yardstick. 1 rp = 1 art px.
//
// Same sprite names as kit.js and yard.js, so the engine wires them by name. index.js keeps the v3
// art as the default and swaps these in with art3.sizes('rule'); the names only rule.js has
// (plus, barn_window, window_box) are always on. Load after fx.js and before index.js. Optional:
// without this file art3 is exactly what it was.
//
// Anchor: every rule sprite anchors on the ground centre of its footprint (the tile centre for one
// tile; the centroid for long ones), except wall pieces (wall_barn: the back corner; shed, sign,
// barn_window, window_box: the wall foot under their centre) and fence runs (their ground midpoint;
// fence_diag: the back corner). Footprints in the iso frame: one tile = 24 by 24 units of u (screen
// right and down) and v (screen left and down); P(u, v, z) from proj.isoP.
//
// API (PitSim.art3.rule): build(), built, has, names, frames, anchor(name) { w, h, ax, ay,
// footprint }, pixels(name, frame), frameCanvas(name, frame, flip), canvasFor(name, frame, scale),
// draw, drawAt, drawScaled, slots(name), seats(name), meta(name), drawShadow(ctx, name, ax, ay),
// SIZE, measure(name, frame), verifySizes(opts).
(function () {
'use strict';
const G = typeof globalThis !== 'undefined' ? globalThis : window;
const PitSim = G.PitSim = G.PitSim || {};
const art3 = PitSim.art3 = PitSim.art3 || {};
const PAL = art3.PAL, PROJ = art3.proj;
if (!PAL || !PROJ) throw new Error('art3 rule: load palette.js and proj.js before rule.js');
const RP = PAL.RAMP, OL = PAL.OL, AN = PAL.ANCHOR;
const K = RP.kettle, ST = RP.steel, EM = RP.ember, CH = RP.charcoal, DR = RP.drum, CR = RP.coolerRed, CW = RP.coolerWhite;
const CL = RP.cloth, PL = RP.plate, BD = RP.board, WL = RP.woodL, WM = RP.woodM, WD = RP.woodD, LE = RP.logEnd, BK = RP.bark;
const GL = RP.glass, FN = RP.fence, BA = RP.barn, RF = RP.roof, LF = RP.leaf, CY = RP.clay, SN = RP.stone, PV = RP.paver;
const LA = RP.lawnA, LB = RP.lawnB, SO = RP.soil, STM = RP.stem, OR = RP.orange, IR = RP.ironRed, BN = RP.bone;
const FLW = RP.flowers, BUL = RP.bulbs;

/* ================================================================ colour and raster */
const CC = Object.create(null);
function C(c) { // '#rrggbb', ['#rrggbb', alpha 0..1], or a packed ABGR number
  if (typeof c === 'number') return c;
  const key = typeof c === 'string' ? c : c[0] + '/' + c[1];
  let v = CC[key];
  if (v !== undefined) return v;
  const hex = typeof c === 'string' ? c : c[0], a = typeof c === 'string' ? 255 : Math.round(c[1] * 255);
  const n = parseInt(hex.slice(1), 16);
  v = ((a << 24) | ((n & 255) << 16) | (n & 0xff00) | ((n >> 16) & 255)) >>> 0;
  CC[key] = v;
  return v;
}
function blend(d, s) {
  const sa = (s >>> 24) / 255;
  if (sa >= 1) return s;
  const da = (d >>> 24) / 255, oa = sa + da * (1 - sa);
  if (oa <= 0) return 0;
  function ch(sh) { return Math.round((((s >>> sh) & 255) * sa + ((d >>> sh) & 255) * da * (1 - sa)) / oa) & 255; }
  return ((Math.round(oa * 255) << 24) | (ch(16) << 16) | (ch(8) << 8) | ch(0)) >>> 0;
}
function mulberry(a) {
  return function () {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function seedOf(s) { let h = 2166136261 >>> 0; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return h; }
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
function Ras(w, h, ax, ay, rnd) { this.w = w; this.h = h; this.ax = ax; this.ay = ay; this.t = new Uint32Array(w * h); this.rnd = rnd; }
const RS = Ras.prototype;
RS.px = function (x, y, c) {
  x = Math.floor(x); y = Math.floor(y);
  if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
  const k = y * this.w + x, v = C(c);
  this.t[k] = (v >>> 24) === 255 ? v : blend(this.t[k], v);
};
RS.rect = function (x, y, w, h, c) { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.px(x + i, y + j, c); };
RS.poly = function (pts, c) { const s = this; spans(pts, function (y, xa, xb) { for (let x = xa; x < xb; x++) s.px(x, y, c); }); };
RS.ell = function (cx, cy, rx, ry, c, y0, y1) {
  const lo = y0 === undefined ? -1e9 : y0, hi = y1 === undefined ? 1e9 : y1;
  for (let y = Math.floor(cy - ry - 1); y <= Math.ceil(cy + ry + 1); y++) {
    if (y < lo || y >= hi) continue;
    for (let x = Math.floor(cx - rx - 1); x <= Math.ceil(cx + rx + 1); x++) {
      const dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry;
      if (dx * dx + dy * dy <= 1) this.px(x, y, c);
    }
  }
};
RS.line = function (x0, y0, x1, y1, c) {
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
// Paint fn into a fresh layer, outline its opaque silhouette (4 neighbours) onto the target, then lay
// the layer over. ol null = no outline.
RS.obj = function (fn, ol) {
  const prev = this.t, w = this.w, h = this.h, L = new Uint32Array(w * h);
  this.t = L; fn(this); this.t = prev;
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
// The iso frame of a footprint nx (along u) by ny (along v) tiles whose ground centre is the anchor.
RS.F = function (nx, ny) { nx = nx || 1; ny = ny || 1; return PROJ.isoP(this.ax - 12 * nx + 12 * ny, this.ay - 6 * nx - 6 * ny); };
// The wall frame: P(u, 0, z) runs along the barn wall through the anchor.
RS.W = function () { return PROJ.isoP(this.ax, this.ay); };
RS.q = function (P, pts, c) { this.poly(pts.map(function (p) { return P(p[0], p[1], p[2]); }), c); };
RS.seg = function (P, a, b, c) { const p = P(a[0], a[1], a[2]), q = P(b[0], b[1], b[2]); this.line(p[0], p[1], q[0], q[1], c); };
// Iso box u0..u1, v0..v1, z0..z0 + h: left face (+v) base, right face (+u) shade, top hi, a lit rim
// along the top's two front edges. o: { top, left, right, rim false, crease }.
RS.box = function (P, u0, v0, u1, v1, z0, h, rr, o) {
  o = o || {};
  const f = PROJ.isoFaces(P, u0, v0, u1, v1, z0, h);
  if (h > 0) { this.poly(f.left, o.left || rr.base); this.poly(f.right, o.right || rr.shade); }
  this.poly(f.top, o.top || rr.hi);
  if (o.rim !== false && u1 - u0 >= 4 && v1 - v0 >= 4) {
    const rc = o.rimColor || PAL.rim(rr), z = z0 + h;
    for (let u = u0 + 1; u < u1; u++) { const p = P(u, v1 - 1, z); this.px(p[0], p[1], rc); }
    for (let v = v0 + 1; v < v1 - 1; v++) { const p = P(u1 - 1, v, z); this.px(p[0], p[1], rc); }
  }
  if (o.crease && h >= 4) {
    const z = z0 + h - 1;
    for (let u = u0; u < u1; u++) { const p = P(u + 0.5, v1, z); this.px(p[0], p[1] + 1, rr.dark); }
    for (let v = v0; v < v1; v++) { const p = P(u1, v + 0.5, z); this.px(p[0], p[1] + 1, rr.dark); }
  }
  return f;
};
// A standing cylinder on the ground point (cx, cy): screen radius rx (ry = rx / 2), z0..z1, columns
// lit on the left. top: the colour of the top ellipse (null = none).
RS.cyl = function (cx, cy, rx, z0, z1, rr, top) {
  for (let X = Math.floor(cx - rx); X < Math.ceil(cx + rx); X++) {
    const t = (X + 0.5 - cx) / rx;
    if (Math.abs(t) > 1) continue;
    const cur = rx / 2 * Math.sqrt(1 - t * t);
    const c = t < -0.62 ? rr.hi : t < 0.2 ? rr.base : t < 0.68 ? rr.shade : rr.dark;
    for (let Y = Math.round(cy - z1); Y < Math.round(cy - z0 + cur); Y++) this.px(X, Y, c);
  }
  if (top) this.ell(cx, cy - z1, rx, rx / 2, top);
};
// A ring band on a standing cylinder at height z.
RS.band = function (cx, cy, rx, z, rr) {
  for (let X = Math.floor(cx - rx); X < Math.ceil(cx + rx); X++) {
    const t = (X + 0.5 - cx) / rx;
    if (Math.abs(t) > 1) continue;
    const y = Math.round(cy - z + rx / 2 * Math.sqrt(1 - t * t));
    this.px(X, y, t > 0.3 ? rr.dark : rr.shade);
    if (t < -0.5) this.px(X, y - 1, rr.hi);
  }
};
// A cylinder lying along u from u0 to u1, axis at (v = vc, z = zc), radius rad. Sampled back to
// front; the +u end cap is visible and painted in cap (a ramp), with growth rings when rings is set.
const THETA = (function () {
  const out = [];
  for (let k = 0; k < 120; k++) { const a = k / 120 * Math.PI * 2; out.push([Math.cos(a), Math.sin(a)]); }
  return out.sort(function (a, b) { return a[0] - b[0]; });
})();
RS.log = function (P, u0, u1, vc, zc, rad, rr, cap, rings) {
  for (let u = u0; u <= u1; u += 0.5) {
    for (let i = 0; i < THETA.length; i++) {
      const cs = THETA[i][0], sn = THETA[i][1];
      const L = 0.8 * sn + 0.5 * cs;
      const c = L > 0.62 ? rr.hi : L > 0.05 ? rr.base : L > -0.5 ? rr.shade : rr.dark;
      for (let d = rad - 0.6; d <= rad; d += 0.6) { const p = P(u, vc + d * cs, zc + d * sn); this.px(p[0], p[1], c); }
    }
  }
  if (cap) {
    const ring = function (r0) { const pts = []; for (let k = 0; k < 24; k++) { const a = k / 24 * Math.PI * 2; pts.push(P(u1, vc + r0 * Math.cos(a), zc + r0 * Math.sin(a))); } return pts; };
    this.poly(ring(rad), cap.base);
    if (rings) { this.poly(ring(rad * 0.62), cap.hi); this.poly(ring(rad * 0.28), cap.shade); }
    else this.poly(ring(rad * 0.7), cap.shade);
  }
};
function glow(r, pts, band) {
  if (band <= 0) return;
  pts.forEach(function (p, i) {
    const c = band === 1 ? (i % 3 === 1 ? EM.shade : (i % 3 === 0 ? EM.dark : null)) : band === 2 ? (i % 2 ? EM.hi : EM.base) : (i % 3 === 1 ? EM.base : EM.hi);
    if (c) r.px(p[0], p[1], c);
  });
}
function rowPts(x0, x1, y) { const o = []; for (let x = x0; x <= x1; x++) o.push([x, y]); return o; }
function stackPipe(r, x, yTop, yBot, rr) { // a 4 px chimney with a cap, lit on the left
  for (let y = yTop + 2; y <= yBot; y++) { r.px(x, y, rr.hi); r.px(x + 1, y, rr.base); r.px(x + 2, y, rr.shade); r.px(x + 3, y, rr.dark); }
  r.rect(x - 1, yTop, 6, 2, rr.base); r.rect(x - 1, yTop, 6, 1, rr.hi);
}

/* ================================================================ cookers */
function kettle(r, f) {
  const cx = r.ax, g = r.ay, cy = g - 15, open = f === 4, band = open ? 2 : f;
  r.obj(function () {
    r.line(cx - 7, cy + 6, cx - 10, g - 1, K.base); r.line(cx - 6, cy + 6, cx - 9, g - 1, K.hi);
    r.line(cx + 7, cy + 6, cx + 10, g - 1, K.shade); r.line(cx + 8, cy + 6, cx + 11, g - 1, K.dark);
    r.line(cx + 1, cy + 7, cx + 1, g - 3, K.dark);
    r.ell(cx + 0.5, g - 6, 6, 1.6, K.shade); r.ell(cx, g - 6.4, 4.6, 1, K.hi);
  });
  r.obj(function () { r.ell(cx - 10, g - 1.5, 2.2, 2.2, K.dark); r.px(cx - 11, g - 3, K.hi); });
  r.obj(function () {
    r.ell(cx, cy, 11, 8, K.dark, cy);
    r.ell(cx - 1.5, cy - 0.5, 9.5, 7, K.shade, cy);
    r.line(cx - 8, cy + 2, cx - 5, cy + 5, K.base);
    r.rect(cx + 11, cy + 1, 1, 2, WM.shade);
    r.rect(cx - 2, cy + 6, 2, 1, K.base); r.rect(cx + 2, cy + 6, 2, 1, K.base);
    if (!open) {
      r.ell(cx, cy, 11, 8, K.shade, -1e9, cy);
      r.ell(cx - 1, cy - 0.5, 9.8, 7.2, K.base, -1e9, cy);
      r.ell(cx - 4, cy - 4.5, 4, 2.4, K.hi);
      r.px(cx - 6, cy - 5, K.spec); r.px(cx - 5, cy - 6, K.spec); r.px(cx - 4, cy - 6, K.spec);
      r.rect(cx - 11, cy, 22, 1, K.dark); r.rect(cx - 10, cy - 1, 3, 1, K.hi);
      r.rect(cx + 4, cy - 6, 3, 1, K.hi); r.px(cx + 6, cy - 5, K.dark);
      r.px(cx - 2, cy - 8, K.dark); r.px(cx + 2, cy - 8, K.dark);
      r.rect(cx - 3, cy - 10, 7, 2, WM.shade); r.rect(cx - 2, cy - 10, 5, 1, WM.hi);
      if (band === 1) glow(r, [[cx + 3, cy], [cx + 4, cy], [cx + 6, cy]], 1);
      if (band === 2) glow(r, rowPts(cx + 1, cx + 7, cy), 2);
      if (band === 3) { glow(r, rowPts(cx - 6, cx + 9, cy), 3); r.px(cx + 5, cy - 6, EM.hi); r.px(cx, cy + 6, EM.base); }
    } else {
      r.ell(cx, cy, 11, 4.5, K.hi);
      r.ell(cx + 0.5, cy + 0.3, 9.5, 3.5, CH.dark);
      for (let y = cy - 3; y <= cy + 3; y++) for (let x = cx - 9; x <= cx + 10; x++) {
        const dx = (x + 0.5 - cx - 0.5) / 8.5, dy = (y + 0.5 - cy - 0.3) / 2.8;
        if (dx * dx + dy * dy > 1) continue;
        const q = r.rnd();
        r.px(x, y, q < 0.3 ? CH.base : q < 0.5 ? EM.base : q < 0.6 ? EM.hi : q < 0.7 ? EM.shade : CH.dark);
      }
      for (let x = cx - 9; x <= cx + 9; x++) { if (x % 2) { r.px(x, cy - 1, ST.shade); r.px(x, cy + 1, ST.shade); } }
      r.rect(cx - 9, cy - 1, 2, 1, ST.hi);
    }
  });
  if (open) r.obj(function () { r.ell(cx + 13, cy + 1, 2.5, 7, K.base); r.ell(cx + 13.5, cy + 1.5, 1.5, 5.5, K.shade); r.px(cx + 12, cy - 4, K.hi); });
}

function drum(r, f) {
  const cx = r.ax, g = r.ay;
  r.obj(function () { // four short legs
    [[-8, K.hi], [-3, K.base], [3, K.shade], [8, K.dark]].forEach(function (l) { r.rect(cx + l[0], g - 6, 2, 6, l[1]); });
  });
  r.obj(function () {
    r.cyl(cx, g, 10, 5, 22, DR, null);
    r.band(cx, g, 10, 11, DR); r.band(cx, g, 10, 17, DR);
    r.ell(cx, g - 22, 10.4, 5.2, K.shade);
    r.ell(cx - 0.4, g - 23, 9.2, 4.4, K.base);
    r.ell(cx - 3, g - 24.5, 4.5, 2, K.hi);
    r.px(cx - 6, g - 24, K.spec); r.px(cx - 5, g - 25, K.spec);
    r.rect(cx - 2, g - 27, 5, 2, WM.shade); r.rect(cx - 1, g - 27, 3, 1, WM.hi);       // lid handle (z 26)
    r.ell(cx - 5, g - 14, 2.2, 2.2, ST.dark); r.ell(cx - 5.2, g - 14.2, 1.4, 1.4, PL.hi); r.px(cx - 5, g - 14, DR.dark);   // dial
    r.rect(cx - 6, g - 8, 3, 2, K.shade); r.rect(cx + 2, g - 8, 3, 2, K.shade);        // intake vents
    if (f >= 1) glow(r, [[cx - 6, g - 7], [cx - 5, g - 7], [cx + 2, g - 7], [cx + 3, g - 7]], f);
    if (f === 3) glow(r, rowPts(cx - 3, cx + 4, g - 21), 2);
  });
  r.obj(function () { stackPipe(r, cx + 3, g - 40, g - 25, K); r.rect(cx + 3, g - 31, 4, 1, K.dark); });
}

function cabinet(r, f) {
  const P = r.F(1, 1);
  r.obj(function () {
    r.box(P, 5, 17, 7, 19, 0, 4, K, { rim: false }); r.box(P, 17, 5, 19, 7, 0, 4, K, { rim: false }); r.box(P, 17, 17, 19, 19, 0, 4, K, { rim: false });
    r.box(P, 5, 5, 19, 19, 4, 36, K, { crease: true });
    r.q(P, [[7, 19, 9], [17, 19, 9], [17, 19, 36], [7, 19, 36]], K.shade);         // door on the lit face
    r.q(P, [[8, 19, 10], [16, 19, 10], [16, 19, 35], [8, 19, 35]], K.base);
    const hd = P(15, 19, 22); r.rect(hd[0], hd[1] - 2, 1, 4, WM.hi);
    const dl = P(10, 19, 31); r.ell(dl[0], dl[1], 2, 2, ST.dark); r.ell(dl[0] - 0.2, dl[1] - 0.2, 1.3, 1.3, PL.hi);
    if (f >= 1) { const pts = []; for (let u = 9; u < 16; u++) { const p = P(u, 19, 6); pts.push([p[0], p[1]]); } glow(r, pts, f); }
  });
  r.obj(function () { const s = P(9, 9, 40); stackPipe(r, s[0] - 2, s[1] - 12, s[1] + 1, K); });
}

function stickBurner(r, f) {
  const P = r.F(2, 1);
  r.obj(function () { // legs
    [12, 34].forEach(function (u) { r.seg(P, [u, 5, 0], [u, 12, 7], K.base); r.seg(P, [u, 19, 0], [u, 12, 7], K.shade); });
  });
  r.obj(function () {
    r.log(P, 8, 38, 12, 14, 9.5, K, K, false);
    r.seg(P, [10, 21.5, 15], [36, 21.5, 15], K.dark);                              // lid seam on the lit side
    [16, 30].forEach(function (u) { const p = P(u, 22, 19); r.rect(p[0], p[1], 3, 1, WM.hi); });
    const d = P(24, 21, 9); r.ell(d[0], d[1], 2, 2, ST.dark); r.ell(d[0] - 0.2, d[1] - 0.2, 1.3, 1.3, PL.hi);
  });
  r.obj(function () {
    r.box(P, 37, 4, 47, 20, 3, 15, K, { crease: true });
    r.q(P, [[47, 7, 6], [47, 17, 6], [47, 17, 15], [47, 7, 15]], K.dark);
    const h = P(47, 12, 11); r.rect(h[0] - 1, h[1], 3, 1, WM.hi);
    if (f >= 1) { const pts = []; for (let v = 8; v < 17; v++) { const p = P(47, v, 7); pts.push([p[0], p[1]]); } glow(r, pts, f); }
  });
  r.obj(function () { const s = P(10, 12, 22); const t = P(10, 12, 48); stackPipe(r, s[0] - 2, t[1], s[1], K); });
}

function trailerRig(r, f) {
  const P = r.F(2, 1);
  r.obj(function () {
    r.seg(P, [2, 12, 7], [-8, 12, 4], WD.base); r.seg(P, [2, 13, 7], [-8, 13, 4], WD.dark);
    r.box(P, 2, 3, 46, 21, 6, 3, IR, { rim: false });
  });
  r.obj(function () {
    [18, 31].forEach(function (u) { const w = P(u, 22, 5); r.ell(w[0], w[1], 4.5, 5, K.dark); r.ell(w[0] - 0.5, w[1] - 0.5, 3, 3.4, K.shade); r.ell(w[0], w[1], 1.5, 1.6, ST.base); });
  });
  r.obj(function () {
    r.log(P, 6, 36, 12, 18, 8, IR, IR, false);
    r.seg(P, [8, 20.2, 19], [34, 20.2, 19], IR.dark);
    const d = P(22, 20, 13); r.ell(d[0], d[1], 2, 2, ST.dark); r.ell(d[0] - 0.2, d[1] - 0.2, 1.3, 1.3, PL.hi);
  });
  r.obj(function () {
    r.box(P, 35, 5, 46, 19, 9, 14, IR, { crease: true });
    r.q(P, [[46, 8, 12], [46, 16, 12], [46, 16, 20], [46, 8, 20]], IR.dark);
    if (f >= 1) { const pts = []; for (let v = 9; v < 16; v++) { const p = P(46, v, 13); pts.push([p[0], p[1]]); } glow(r, pts, f); }
  });
  r.obj(function () { const s = P(9, 12, 25); const t = P(9, 12, 52); stackPipe(r, s[0] - 2, t[1], s[1], K); });
}

/* ================================================================ fuel, cooler, board, counter */
function pile(r, f) {
  const P = r.F(1, 1), H = [12, 9, 6, 2][f];
  r.obj(function () {
    if (f === 3) { r.box(P, 5, 8, 19, 18, 0, 2, BD, { rim: false }); return; }
    r.box(P, 7, 7, 18, 18, 0, H, BD, { crease: false });
    r.q(P, [[7, 18, 1], [18, 18, 1], [18, 18, Math.min(H - 1, 5)], [7, 18, Math.min(H - 1, 5)]], CH.base);   // black band
    const l = P(11, 18, Math.max(2, H - 4)); r.rect(l[0], l[1], 3, 2, OR.base); r.px(l[0] + 1, l[1] - 1, EM.hi);
    r.box(P, 7, 7, 18, 18, H, 1, BD, { top: BD.shade, rim: false });                                           // rolled top
  });
  r.obj(function () {
    const spill = f === 0 ? [[20, 14], [21, 19], [16, 21]] : f === 1 ? [[20, 16], [17, 21]] : f === 2 ? [[19, 19]] : [];
    spill.forEach(function (s) { const p = P(s[0], s[1], 0); r.rect(p[0], p[1] - 2, 2, 2, CH.base); r.px(p[0], p[1] - 2, CH.hi); });
  });
}

function woodpile(r, f) {
  const P = r.F(1, 1), R0 = 2.6;
  const logs = f === 0 ? [[6, R0], [11.5, R0], [17, R0], [8.75, 7.2], [14.25, 7.2], [11.5, 11.7]] : f === 1 ? [[6, R0], [11.5, R0], [17, R0]] : [];
  r.obj(function () {
    if (f === 2) { r.box(P, 4, 7, 20, 8, 0, 1, WD, { rim: false }); r.box(P, 4, 16, 20, 17, 0, 1, WD, { rim: false }); }
    logs.forEach(function (l) { r.log(P, 4, 20, l[0], l[1], R0, BK, LE, true); });
  });
}

function cooler(r, f) {
  const P = r.F(1, 1), open = f >= 3, lvl = f % 3;
  r.obj(function () {
    r.box(P, 6, 6, 18, 18, 0, 8, CR, { crease: true });
    const hd = P(12, 18, 5); r.rect(hd[0] - 2, hd[1], 5, 1, CW.handle);
    if (!open) {
      r.box(P, 6, 6, 18, 18, 8, 2, CW);
      r.seg(P, [9, 12, 12], [15, 12, 12], CW.handle); r.seg(P, [9, 12, 10], [9, 12, 12], CW.shade); r.seg(P, [15, 12, 10], [15, 12, 12], CW.shade);
    } else {
      r.q(P, [[7, 7, 8], [17, 7, 8], [17, 17, 8], [7, 17, 8]], CW.shade);
      r.q(P, [[8, 8, 8], [16, 8, 8], [16, 16, 8], [8, 16, 8]], CW.base);
      const packs = [[10, 10], [14, 11], [11, 14], [15, 15]].slice(0, 4 - lvl - (lvl === 2 ? 1 : 0));
      packs.forEach(function (p) { const q = P(p[0], p[1], 8); r.rect(q[0] - 2, q[1] - 1, 4, 2, PAL.MEAT.brisket.raw.base); r.rect(q[0] - 2, q[1] - 1, 4, 1, PAL.MEAT.brisket.raw.hi); });
      [[9, 15], [13, 9], [16, 13]].forEach(function (p) { const q = P(p[0], p[1], 8); r.px(q[0], q[1], PL.hi); });
    }
  });
}

function board(r, f) {
  const P = r.F(1, 1);
  r.obj(function () {
    r.box(P, 4, 18, 6, 20, 0, 8, WD, { rim: false }); r.box(P, 18, 4, 20, 6, 0, 8, WD, { rim: false }); r.box(P, 18, 18, 20, 20, 0, 8, WD, { rim: false });
    r.box(P, 4, 4, 20, 20, 8, 5, WM, { crease: true });
    r.box(P, 7, 7, 17, 17, 13, 2, BD);
    if (f === 0) {
      r.seg(P, [9, 14, 15], [14, 14, 15], ST.hi); r.seg(P, [9, 14.6, 15], [14, 14.6, 15], ST.shade);
      r.seg(P, [14, 14, 15], [16, 14, 15], WD.base);
    } else {
      r.box(P, 9, 9, 15, 15, 15, 2, RP.brisket, { top: RP.brisket.bark });
      r.seg(P, [9, 14.6, 16], [15, 14.6, 16], RP.brisket.ring);
    }
  });
}

const COUNTER_N = { counter: 3, counter_long: 4 };
function counterGeo(n) { return { w: 24 * n + 22, h: 12 * n + 27, ax: 12 * n + 11, ay: 6 * n + 20 }; }
function counterSlots(n, ax, ay) {
  const P = PROJ.isoP(ax - 12 + 12 * n, ay - 6 - 6 * n), out = [];
  for (let k = 0; k < 3; k++) out.push(P(12, 24 * k + 12, 13));
  if (n === 4) { out.push(P(12, 78, 13)); out.push(P(12, 90, 13)); }
  return out.map(function (p) { return [Math.round(p[0]), Math.round(p[1])]; });
}
function counter(r, n) {
  const P = r.F(1, n), V = 24 * n;
  r.obj(function () {
    [[3, V - 5], [19, V - 5], [19, 3]].forEach(function (l) { r.box(P, l[0], l[1], l[0] + 2, l[1] + 2, 0, 9, WD, { rim: false }); });
    r.box(P, 2, 2, 22, V - 2, 9, 4, CL, { crease: false });
    for (let u = 6; u < 22; u += 6) for (let v = 3; v < V - 2; v++) { const p = P(u, v, 13); r.px(p[0], p[1], CL.check); }
    for (let v = 6; v < V - 2; v += 6) for (let u = 3; u < 22; u++) { const p = P(u, v, 13); r.px(p[0], p[1], CL.check); }
    for (let u = 3; u < 22; u += 3) { const p = P(u, V - 2, 9); r.px(p[0], p[1], CL.dark); }
    for (let v = 3; v < V - 2; v += 3) { const p = P(22, v, 9); r.px(p[0], p[1], CL.dark); }
  });
}

function trash(r, f) {
  const cx = r.ax, g = r.ay;
  r.obj(function () {
    r.cyl(cx, g, 7, 0, 16, ST, null);
    r.band(cx, g, 7, 5, ST); r.band(cx, g, 7, 11, ST);
    r.rect(cx - 8, g - 13, 1, 2, ST.shade); r.rect(cx + 7, g - 13, 1, 2, ST.dark);
    if (f === 0) {
      r.ell(cx, g - 16, 7.5, 3.8, ST.shade);
      r.ell(cx - 0.4, g - 16.6, 6.6, 3.1, ST.base);
      r.ell(cx - 2.5, g - 17.2, 3, 1.2, ST.hi);
      r.rect(cx - 2, g - 19, 5, 1, ST.shade); r.px(cx - 2, g - 18, ST.dark); r.px(cx + 2, g - 18, ST.dark);
    } else {
      r.ell(cx, g - 16, 7, 3.5, ST.dark);
      r.ell(cx - 0.4, g - 17.2, 6.2, 3.6, CH.base, -1e9, g - 15);
      r.ell(cx - 2.5, g - 18.5, 2.6, 1.2, CH.hi);
      r.rect(cx - 1, g - 21, 2, 2, CH.base); r.px(cx + 1, g - 21, CH.hi);
    }
  });
  if (f === 1) r.obj(function () { r.ell(cx + 9, g - 9, 2, 6.5, ST.shade); r.ell(cx + 8.6, g - 9.4, 1.2, 5.2, ST.base); });
}

function prepTable(r, f) {
  const P = r.F(1, 1), top = f === 0 ? WL : ST;
  r.obj(function () {
    [[3, 19], [19, 3], [19, 19]].forEach(function (l) { r.box(P, l[0], l[1], l[0] + 2, l[1] + 2, 0, 11, f === 0 ? WD : ST, { rim: false }); });
    if (f === 2) r.box(P, 4, 4, 20, 20, 3, 1, ST, { rim: false });
    r.box(P, 3, 3, 21, 21, 11, 2, top);
    if (f === 0) {
      for (let u = 6; u < 21; u += 5) r.seg(P, [u, 4, 13], [u, 20, 13], WL.base);
      const b = P(9, 13, 13); r.ell(b[0], b[1] - 1, 3.5, 2, PL.shade); r.ell(b[0], b[1] - 1.6, 2.6, 1.2, RP.sausage.base);
      const s = P(15, 9, 13); r.rect(s[0], s[1] - 4, 2, 4, PL.base); r.px(s[0], s[1] - 4, ST.shade);
    } else if (f === 1) {
      r.seg(P, [7, 14, 13], [15, 14, 13], ST.hi); r.seg(P, [15, 14, 13], [18, 14, 13], WD.base);
      const t = P(10, 8, 13); r.rect(t[0] - 2, t[1] - 1, 5, 2, PAL.UI.white); r.rect(t[0] - 2, t[1], 5, 1, CL.base);
    } else {
      [[9, 11, DR], [14, 9, OR]].forEach(function (j) { const p = P(j[0], j[1], 13); r.rect(p[0] - 1, p[1] - 4, 3, 4, j[2].base); r.rect(p[0] - 1, p[1] - 5, 3, 1, ST.base); r.px(p[0] - 1, p[1] - 3, j[2].hi); });
    }
  });
}

function warmer(r, f) {
  const P = r.F(1, 1);
  r.obj(function () {
    [[5, 17], [17, 5], [17, 17]].forEach(function (l) { r.box(P, l[0], l[1], l[0] + 2, l[1] + 2, 0, 4, ST, { rim: false }); });
    r.box(P, 5, 5, 19, 19, 4, 18, ST, { crease: true });
    r.q(P, [[7, 19, 8], [17, 19, 8], [17, 19, 19], [7, 19, 19]], f === 0 ? K.base : EM.dark);
    if (f >= 1) { r.q(P, [[8, 19, 9], [16, 19, 9], [16, 19, 12], [8, 19, 12]], EM.shade); }
    if (f === 2) { [[9, 13], [12, 14], [15, 13]].forEach(function (p) { const q = P(p[0], 19, p[1]); r.rect(q[0] - 1, q[1] - 1, 3, 2, RP.ribs.base); r.px(q[0] - 1, q[1] - 1, RP.ribs.hi); }); }
    const k = P(18, 19, 15); r.px(k[0], k[1], f === 0 ? ST.dark : EM.hi);
    r.seg(P, [8, 19, 20], [16, 19, 20], ST.hi);
  });
}

/* ================================================================ plates and platters */
const MEATS = ['sausage', 'chicken', 'ribs', 'butt', 'brisket'];
function food(r, m, cx, cy, s) { // a dish on a plate, its top about 3 rp above the rim, s = 1 or 1.3
  const w = Math.round(7 * s);
  if (m === 'sausage') {
    const R = RP.sausage;
    r.rect(cx - (w >> 1), cy - 2, w, 2, R.base); r.rect(cx - (w >> 1) + 1, cy - 3, w - 2, 1, R.hi); r.rect(cx - (w >> 1), cy, w, 1, R.shade);
  } else if (m === 'chicken') {
    const R = RP.chicken;
    r.ell(cx - 1, cy - 1.2, 3.2 * s, 2.2, R.base); r.ell(cx - 1.8, cy - 2, 1.6 * s, 1, R.hi);
    r.rect(cx + Math.round(2 * s), cy - 2, 2, 1, BN.base); r.px(cx + Math.round(2 * s) + 2, cy - 2, BN.hi);
  } else if (m === 'ribs') {
    const R = RP.ribs;
    r.rect(cx - (w >> 1), cy - 3, w, 3, R.base); r.rect(cx - (w >> 1), cy - 3, w, 1, R.hi);
    for (let x = cx - (w >> 1) + 1; x < cx + (w >> 1); x += 2) r.px(x, cy - 1, R.dark);
    r.px(cx - (w >> 1) - 1, cy - 2, BN.base); r.px(cx + (w >> 1) + 1, cy - 2, BN.base);
  } else if (m === 'butt') {
    const R = RP.butt;
    r.ell(cx, cy - 1.2, 3.6 * s, 2.2, R.base);
    for (let i = 0; i < 6; i++) r.px(cx - 3 + ((i * 5) % 7), cy - 2 + (i % 3), i % 2 ? R.hi : R.shade);
  } else if (m === 'brisket') {
    const R = RP.brisket;
    [-2, 1].forEach(function (dx) { r.rect(cx + dx - 1, cy - 3, 3, 3, R.base); r.rect(cx + dx - 1, cy - 3, 3, 1, R.bark); r.px(cx + dx, cy - 2, R.ring); });
    if (s > 1) { r.rect(cx + 3, cy - 3, 3, 3, R.base); r.rect(cx + 3, cy - 3, 3, 1, R.bark); }
  }
}
function plate(r, m, big) {
  const cx = r.ax, cy = r.ay;
  r.obj(function () {
    r.ell(cx, cy, big ? 8 : 6, big ? 3 : 2.2, big ? PL.shade : PL.base);
    r.ell(cx - 0.4, cy - 0.3, big ? 6.4 : 4.4, big ? 2.1 : 1.5, PL.hi);
    if (big) r.rect(cx - 6, cy - 2, 3, 1, PAL.UI.white);
  });
  if (m) r.obj(function () { food(r, m, cx, cy - (big ? 3 : 2), big ? 1.3 : 1); });
}

/* ================================================================ ground tiles (48 by 24) */
function diamondRows(r, cb) {
  for (let j = 0; j < 24; j++) {
    const half = j < 12 ? 2 * j + 1 : 2 * (23 - j) + 1;
    for (let x = 24 - half; x < 24 + half; x++) {
      const dx = (x + 0.5 - 24) / 2, uu = j + 0.5 + dx, vv = j + 0.5 - dx;
      cb(x, j, uu, vv);
    }
  }
}
function paver(r, f) {
  const rnd = r.rnd, tone = [];
  for (let i = 0; i < 4; i++) { const q = rnd(); tone.push(q < 0.4 ? PV.base : q < 0.75 ? PV.alt : PV.shade); }
  diamondRows(r, function (x, y, u, v) {
    const iu = u < 12 ? 0 : 1, iv = v < 12 ? 0 : 1, a = u % 12, b = v % 12;
    let c = tone[iu * 2 + iv];
    if (a < 1 || b < 1) c = PV.grout; else if (a < 2 || b < 2) c = PV.hi; else if (a > 11 || b > 11) c = PV.shade;
    if (c !== PV.grout && rnd() < 0.04) c = PV.alt;
    r.px(x, y, c);
  });
}
function lawn(r, f, R) {
  const rnd = r.rnd;
  diamondRows(r, function (x, y) { r.px(x, y, R.base); });
  for (let i = 0; i < 9; i++) {
    const x = 8 + Math.floor(rnd() * 32), y = 4 + Math.floor(rnd() * 16);
    if (Math.abs(x + 0.5 - 24) / 2 + Math.abs(y + 0.5 - 12) > 11) continue;
    r.px(x, y, i % 3 ? R.shade : R.hi); r.px(x, y - 1, i % 3 ? R.shade : R.hi);
  }
}
function stoneStep(r, f) {
  const sp = f === 0 ? [[17, 11, 7], [31, 14, 6]] : [[24, 12, 8]];
  sp.forEach(function (s) {
    r.obj(function () { r.ell(s[0], s[1] + 0.6, s[2], s[2] / 2, SN.shade); r.ell(s[0] - 0.6, s[1], s[2] - 1, s[2] / 2 - 0.8, SN.base); r.ell(s[0] - 2, s[1] - 0.8, s[2] / 2.5, 1, SN.hi); }, SN.dark);
  });
}

/* ================================================================ barn, door, window, sign */
const BARN = { L: 264, EAVE: 80, ROOF: 40, DEPTH: 40, END: 80 };
function wallBarn(r) {
  const P = r.W(), L = BARN.L, E = BARN.EAVE, Z = E + BARN.ROOF, D = BARN.DEPTH, ED = BARN.END;
  r.obj(function () {
    r.q(P, [[L, 0, 0], [L, -ED, 0], [L, -ED, E], [L, -D, Z], [L, 0, E]], BA.dark);            // the end wall
    for (let v = -ED + 6; v < 0; v += 6) r.seg(P, [L, v, 0], [L, v, v > -D ? E + (-v) : E + (ED + v)], BA.shade);
    r.q(P, [[0, 0, 0], [L, 0, 0], [L, 0, E], [0, 0, E]], BA.base);                            // the long wall
    for (let u = 0; u < L; u++) {
      const k = u % 8, p = P(u, 0, 0);
      if (k === 0) r.rect(p[0], p[1] - E, 1, E, BA.dark); else if (k > 4) r.rect(p[0], p[1] - E, 1, E, BA.shade);
      r.rect(p[0], p[1] - 4, 1, 4, BA.dark);
    }
    r.q(P, [[L - 3, 0, 0], [L, 0, 0], [L, 0, E], [L - 3, 0, E]], BA.trim);                   // corner trim
    r.q(P, [[0, 0, E - 3], [L, 0, E - 3], [L, 0, E], [0, 0, E]], BA.trim);                   // eave trim
  });
  r.obj(function () {
    r.q(P, [[-2, 4, E - 2], [L + 4, 4, E - 2], [L + 4, -D, Z + 1], [-2, -D, Z + 1]], RF.base); // roof slope
    for (let s = 0; s <= 1; s += 1 / 8) {
      const v = 4 - (D + 4) * s, z = E - 2 + (BARN.ROOF + 3) * s;
      r.seg(P, [-2, v, z], [L + 4, v, z], RF.shade);
    }
    r.seg(P, [-2, 4, E - 2], [L + 4, 4, E - 2], RF.dark); r.seg(P, [-2, 3, E - 1], [L + 4, 3, E - 1], RF.dark);
    r.seg(P, [-2, -D, Z + 1], [L + 4, -D, Z + 1], RF.hi);
    r.q(P, [[L + 2, 4, E - 2], [L + 4, 4, E - 2], [L + 4, -D, Z + 1], [L + 2, -D, Z + 1]], RF.dark);   // barge board
    r.q(P, [[L + 2, -D, Z + 1], [L + 4, -D, Z + 1], [L + 4, -ED - 4, E - 2], [L + 2, -ED - 4, E - 2]], RF.shade);
  });
}
function wallDoor(r) {
  const P = r.W();
  r.obj(function () {
    r.q(P, [[-14, 0, 0], [14, 0, 0], [14, 0, 52], [-14, 0, 52]], BA.trim);
    r.q(P, [[-12, 0, 2], [12, 0, 2], [12, 0, 50], [-12, 0, 50]], WM.dark);
    for (let u = -11; u < 12; u += 4) r.seg(P, [u, 0, 3], [u, 0, 49], WD.shade);
    r.seg(P, [-12, 0, 26], [12, 0, 26], BA.trim); r.seg(P, [-12, 0, 27], [12, 0, 27], BA.trim);
    r.seg(P, [-12, 0, 49], [12, 0, 28], BA.trim); r.seg(P, [-12, 0, 3], [12, 0, 25], BA.trim);
    r.seg(P, [-12, 0, 28], [12, 0, 49], BA.trim); r.seg(P, [-12, 0, 25], [12, 0, 3], BA.trim);
    const h = P(9, 0, 24); r.rect(h[0], h[1], 2, 3, K.base);
  });
}
function wallWindow(r) {
  const P = r.W();
  r.obj(function () {
    r.q(P, [[-17, 0, 32], [17, 0, 32], [17, 0, 58], [-17, 0, 58]], BA.trim);
    r.q(P, [[-15, 0, 34], [15, 0, 34], [15, 0, 56], [-15, 0, 56]], GL.base);
    r.q(P, [[-15, 0, 46], [-6, 0, 56], [-2, 0, 56], [-15, 0, 42]], GL.hi);
    r.q(P, [[2, 0, 34], [12, 0, 44], [12, 0, 47], [2, 0, 37]], GL.hi);
    r.q(P, [[-15, 0, 34], [15, 0, 34], [15, 0, 36], [-15, 0, 36]], GL.shade);
    r.seg(P, [0, 0, 34], [0, 0, 56], BA.trim); r.seg(P, [-15, 0, 45], [15, 0, 45], BA.trim);
  });
}
function windowBox(r) {
  const P = r.W();
  r.obj(function () {
    r.box(P, -20, 0, 20, 5, 25, 7, WM, { crease: true });
    r.q(P, [[-19, 1, 32], [19, 1, 32], [19, 4, 32], [-19, 4, 32]], SO.base);
    for (let u = -18; u < 19; u += 3) { const p = P(u, 2.5, 32); r.rect(p[0], p[1] - 2, 1, 2, STM.base); }
    for (let u = -17, i = 0; u < 19; u += 5, i++) { const p = P(u, 2.5, 34); r.rect(p[0] - 1, p[1] - 2, 3, 2, FLW[i % FLW.length]); r.px(p[0], p[1] - 1, RP.bloom.base); }
  });
}
const SIGN = { bw: 60, bh: 22, z0: 38 };
function wallSign(r, f) {
  const W = SIGN.bw, x0 = r.ax - W / 2, yb = r.ay - SIGN.z0, yt = yb - SIGN.bh;
  r.obj(function () {
    r.rect(r.ax - 23, yt - 6, 2, 6, K.shade); r.rect(r.ax + 21, yt - 6, 2, 6, K.shade);
    r.rect(r.ax - 25, yt - 7, 6, 2, K.base); r.rect(r.ax + 19, yt - 7, 6, 2, K.base);
  });
  r.obj(function () {
    r.rect(x0, yt, W, 22, WM.base); r.rect(x0, yt, W, 1, WM.hi); r.rect(x0, yb - 1, W, 1, WM.dark); r.rect(x0 + W - 1, yt, 1, 22, WM.shade);
    r.rect(x0 + 2, yt + 2, W - 4, 18, f === 1 ? WL.hi : AN.U);
    if (f === 2) for (let x = x0 + 3; x < x0 + W - 2; x += 5) { r.px(x, yt + 1, BUL[(x >> 2) % BUL.length]); r.px(x + 2, yb - 2, BUL[((x >> 2) + 2) % BUL.length]); }
  });
}

/* ================================================================ fences and gate */
function fenceRun(r, along, v0, v1, H, post, picket) { // along 'v' (back fence, column 10) or 'u' (front rows)
  const P = r.W();
  const at = function (s, z) { return along === 'v' ? P(0, s, z) : P(s, 0, z); };
  r.obj(function () {
    for (let s = v0; s < v1; s++) {
      const k = ((s % 4) + 4) % 4, p = at(s, 0), tip = picket && k === 1 ? 1 : 0;
      const c = k === 3 ? FN.shade : (along === 'v' && !picket ? (k === 0 ? FN.base : FN.hi) : FN.hi);
      r.rect(p[0], p[1] - H - tip, 1, H + tip, c);
      if (picket && k === 3) r.rect(p[0], p[1] - H + 1, 1, H - 1, FN.dark);
      r.rect(p[0], p[1] - Math.round(H * 0.3), 1, 1, FN.dark); r.rect(p[0], p[1] - Math.round(H * 0.72), 1, 1, FN.dark);
    }
    (post || []).forEach(function (s) { const p = at(s, 0); r.rect(p[0] - 1, p[1] - H - 1, 3, H + 1, FN.shade); r.rect(p[0] - 1, p[1] - H - 1, 3, 1, FN.hi); });
  });
}
function gate(r, f) {
  const P = r.W();
  r.obj(function () {
    if (f === 0) fenceLeaf(r, P, 'u', -10, 10);
    else fenceLeaf(r, P, 'v', -20, 0, -10);
  }, null);
  r.obj(function () {
    [-12, 11].forEach(function (u) { r.box(P, u, -1, u + 2, 1, 0, 21, WM, { rim: false }); r.box(P, u - 0.5, -1.5, u + 2.5, 1.5, 21, 1, WM, { rim: false }); });
  });
}
function fenceLeaf(r, P, along, s0, s1, fix) {
  r.obj(function () {
    for (let s = s0; s < s1; s++) {
      const p = along === 'u' ? P(s, 0, 0) : P(fix, s, 0), k = ((s % 4) + 4) % 4;
      r.rect(p[0], p[1] - 13 - (k === 1 ? 1 : 0), 1, 13 + (k === 1 ? 1 : 0), k === 3 ? FN.shade : FN.hi);
      r.px(p[0], p[1] - 4, FN.dark); r.px(p[0], p[1] - 10, FN.dark);
    }
  });
}

/* ================================================================ plants and set dressing */
function tree(r, part) {
  const cx = r.ax, g = r.ay, rnd = mulberry(seedOf('rule:tree'));
  if (part !== 'canopy') r.obj(function () {
    r.rect(cx - 4, g - 60, 8, 60, BK.base); r.rect(cx - 4, g - 60, 2, 60, BK.hi); r.rect(cx + 2, g - 60, 2, 60, BK.shade);
    r.rect(cx - 6, g - 3, 12, 3, BK.base); r.rect(cx - 6, g - 3, 3, 1, BK.hi);
    r.line(cx - 1, g - 20, cx - 1, g - 26, BK.dark); r.line(cx + 1, g - 40, cx + 1, g - 46, BK.dark);
  });
  if (part === 'trunk') return;
  const B = [[0, -84, 30, 24], [-21, -66, 20, 18], [22, -68, 19, 18], [-4, -105, 21, 22], [-13, -48, 15, 11], [13, -49, 14, 11], [18, -96, 14, 13]];
  r.obj(function () {
    B.forEach(function (b) { r.ell(cx + b[0], g + b[1], b[2], b[3], LF.dark); });
    B.forEach(function (b) { r.ell(cx + b[0] - 1.5, g + b[1] - 2, b[2] - 2.5, b[3] - 2.5, LF.shade); });
    B.forEach(function (b) { r.ell(cx + b[0] - 4, g + b[1] - 5, b[2] * 0.62, b[3] * 0.58, LF.base); });
    B.forEach(function (b) { r.ell(cx + b[0] - 7, g + b[1] - 8, b[2] * 0.28, b[3] * 0.25, LF.hi); });
    for (let i = 0; i < 70; i++) {
      const b = B[i % B.length], a = rnd() * Math.PI * 2, d = rnd() * 0.85;
      const x = cx + b[0] + Math.cos(a) * b[2] * d, y = g + b[1] + Math.sin(a) * b[3] * d;
      r.px(x, y, i % 3 ? LF.hi : LF.dark);
    }
  });
}
function pot(r, f) {
  const cx = r.ax, g = r.ay;
  r.obj(function () {
    for (let z = 0; z < 9; z++) {
      const rx = 4 + z * 0.17;
      for (let X = Math.floor(cx - rx); X < Math.ceil(cx + rx); X++) { const t = (X + 0.5 - cx) / rx; r.px(X, g - z - 1 + Math.round(rx / 2 * Math.sqrt(Math.max(0, 1 - t * t))), t < -0.55 ? CY.hi : t < 0.25 ? CY.base : t < 0.65 ? CY.shade : CY.dark); }
    }
    r.ell(cx, g - 9, 5.8, 2.9, CY.hi); r.ell(cx, g - 9.3, 4.6, 2.1, SO.base);
    if (f === 0) { r.ell(cx, g - 13, 6, 3.6, LF.shade); r.ell(cx - 1, g - 14, 4.4, 2.6, LF.base); r.ell(cx - 2, g - 15, 2, 1, LF.hi); }
    else if (f === 1) { [-3, 0, 3].forEach(function (d, i) { r.line(cx + d, g - 10, cx + d, g - 13, STM.base); r.rect(cx + d - 1, g - 16, 3, 2, FLW[i]); r.px(cx + d, g - 15, RP.bloom.base); }); }
    else { [-3, -1, 1, 3].forEach(function (d, i) { r.line(cx + d, g - 10, cx + d + (d < 0 ? -1 : 1), g - 15 + (i % 2), i % 2 ? STM.hi : STM.base); }); }
  });
}
function lightsPost(r) {
  const P = r.F(1, 1);
  r.obj(function () {
    r.box(P, 10, 10, 13, 13, 0, 70, WM, { rim: false });
    r.box(P, 9, 9, 14, 14, 0, 4, WD, { rim: false });
    const t = P(12, 12, 70); r.rect(t[0] - 2, t[1] - 2, 6, 2, WD.base);
    r.rect(t[0] + 3, t[1], 1, 3, K.base); r.rect(t[0] + 2, t[1] + 3, 3, 3, BUL[0]); r.px(t[0] + 2, t[1] + 3, PAL.UI.white);
  });
}
const PIC = { top: 13, bench: 7 };
function picnicTable(r, f) { // the table top, the near bench and the legs, drawn after the sitters
  const P = r.F(2, 1);
  r.obj(function () {
    [8, 40].forEach(function (u) {
      r.seg(P, [u, 12, 11], [u, 3, 0], WD.base); r.seg(P, [u + 1, 12, 11], [u + 1, 3, 0], WD.dark);
      r.seg(P, [u, 12, 11], [u, 22, 0], WD.base); r.seg(P, [u + 1, 12, 11], [u + 1, 22, 0], WD.dark);
      r.seg(P, [u, 2, 6], [u, 22, 6], WD.shade);
    });
    r.box(P, 3, 19, 45, 23, 5, 2, WL, { crease: false });
    r.box(P, 3, 7, 45, 17, 11, 2, f === 1 ? CL : WL, { crease: false });
    if (f === 0) for (let v = 9; v < 17; v += 3) r.seg(P, [4, v, 13], [44, v, 13], WL.base);
    else for (let u = 6; u < 45; u += 6) r.seg(P, [u, 8, 13], [u, 16, 13], CL.check);
  });
}
function picnicBench(r) { // the far bench the sitters sit on, drawn before them
  const P = r.F(2, 1);
  r.obj(function () {
    [8, 40].forEach(function (u) { r.seg(P, [u, 3, 0], [u, 3, 5], WD.base); });
    r.box(P, 3, 1, 45, 5, 5, 2, WL, { crease: false });
  });
}
function flowerBox(r) {
  const P = r.F(2, 1), rnd = r.rnd;
  r.obj(function () {
    r.box(P, 4, 9, 44, 15, 0, 6, WM, { crease: true });
    r.q(P, [[5, 10, 6], [43, 10, 6], [43, 14, 6], [5, 14, 6]], SO.base);
    for (let u = 6; u < 43; u += 2) { const p = P(u, 12, 6); r.rect(p[0], p[1] - 2, 1, 2, STM.base); }
    for (let u = 6, i = 0; u < 43; u += 4, i++) { const p = P(u + rnd() * 2, 11 + rnd() * 2, 8); r.rect(p[0] - 1, p[1] - 2, 3, 2, FLW[i % FLW.length]); r.px(p[0], p[1] - 1, RP.bloom.base); }
  });
}
function chair(r, f) {
  const P = r.F(1, 1), R = f === 0 ? WM : FN;
  r.obj(function () {
    [[7, 16], [16, 7], [16, 16]].forEach(function (l) { r.box(P, l[0], l[1], l[0] + 1, l[1] + 1, 0, 6, R, { rim: false }); });
    r.box(P, 7, 7, 17, 17, 6, 1, R, { rim: false });
    r.box(P, 7, 7, 17, 8, 7, 13, R, { rim: false });
    for (let u = 9; u < 17; u += 3) r.seg(P, [u, 8, 9], [u, 8, 18], R.shade);
  });
}
function canopy(r, f) {
  const P = r.F(4, 2), ST2 = [[OR, CW], [CL, CW], [RP.stem, CW]][f];
  r.obj(function () {
    [[3, 3], [93, 3], [3, 45], [93, 45]].forEach(function (p) { r.box(P, p[0], p[1], p[0] + 1, p[1] + 1, 0, 58, ST, { rim: false }); });
  });
  r.obj(function () {
    r.q(P, [[1, 1, 64], [95, 1, 64], [95, 47, 64], [1, 47, 64]], ST2[0].base);
    for (let v = 1; v < 47; v += 8) r.q(P, [[1, v, 64], [95, v, 64], [95, v + 4, 64], [1, v + 4, 64]], ST2[1].hi);
    for (let u = 1; u < 95; u++) { const k = Math.floor((u - 1) / 6) % 2, p = P(u, 47, 64); r.rect(p[0], p[1], 1, 5 + ((u % 6) === 3 ? 1 : 0), k ? ST2[1].base : ST2[0].base); }
    for (let v = 1; v < 47; v++) { const k = Math.floor((v - 1) / 6) % 2, p = P(95, v, 64); r.rect(p[0], p[1], 1, 5 + ((v % 6) === 3 ? 1 : 0), k ? ST2[1].shade : ST2[0].shade); }
  });
}
function birdbath(r, f) {
  const cx = r.ax, g = r.ay;
  r.obj(function () {
    r.ell(cx, g - 1, 5, 2.4, SN.shade); r.ell(cx - 0.4, g - 1.6, 4, 1.8, SN.base);
    r.rect(cx - 2, g - 14, 4, 13, SN.base); r.rect(cx - 2, g - 14, 1, 13, SN.hi); r.rect(cx + 1, g - 14, 1, 13, SN.shade);
    r.ell(cx, g - 15, 9, 4, SN.shade, g - 16); r.ell(cx, g - 17, 9, 4.2, SN.base);
    r.ell(cx - 0.3, g - 17.4, 7, 3, GL.base); r.ell(cx - 2.5, g - 18, 2.6, 1, GL.hi);
    if (f === 1) { r.px(cx + 2, g - 17, GL.hi); r.px(cx + 4, g - 17, GL.hi); r.px(cx + 3, g - 16, GL.shade); }
  });
}
function mailbox(r, f) {
  const P = r.F(1, 1);
  r.obj(function () {
    r.box(P, 11, 11, 13, 13, 0, 17, WD, { rim: false });
    r.log(P, 5, 19, 12, 21.4, 4.4, ST, ST, false);
  });
  r.obj(function () {
    const a = P(12, 17, 21);
    if (f === 0) r.rect(a[0] + 1, a[1], 6, 2, DR.base); else { r.rect(a[0] + 1, a[1] - 4, 2, 6, DR.base); r.rect(a[0] + 1, a[1] - 4, 4, 2, DR.base); }
  });
}
function tools(r) {
  const cx = r.ax, g = r.ay;
  r.obj(function () {
    r.rect(cx - 12, g - 20, 24, 3, WM.base); r.rect(cx - 12, g - 20, 24, 1, WM.hi);
    r.rect(cx - 11, g - 17, 2, 17, WD.base); r.rect(cx + 9, g - 17, 2, 17, WD.shade);
  });
  r.obj(function () {
    r.rect(cx - 6, g - 23, 1, 22, WD.base); r.rect(cx - 8, g - 27, 5, 5, ST.base); r.rect(cx - 8, g - 27, 1, 5, ST.hi);   // shovel
    r.rect(cx, g - 22, 1, 21, WD.base); r.rect(cx - 3, g - 25, 7, 1, ST.shade); for (let x = cx - 3; x <= cx + 3; x += 2) r.px(x, g - 24, ST.shade);  // rake
    r.rect(cx + 6, g - 21, 1, 20, WD.base); r.rect(cx + 4, g - 27, 5, 6, WL.shade); r.rect(cx + 4, g - 27, 5, 1, WL.hi);    // broom
  });
}
function shelf(r) {
  const P = r.F(1, 1);
  r.obj(function () {
    r.box(P, 6, 6, 18, 18, 0, 30, WM, { crease: true });
    r.q(P, [[7, 18, 1], [17, 18, 1], [17, 18, 28], [7, 18, 28]], WD.dark);
    [1, 10, 19].forEach(function (z) { r.q(P, [[7, 18, z], [17, 18, z], [17, 18, z + 1], [7, 18, z + 1]], WM.base); });
    [[9, 3, CR], [13, 3, BD], [9, 12, GL], [14, 12, OR], [10, 21, CL], [14, 21, BD]].forEach(function (it) {
      const p = P(it[0], 18, it[1]); r.rect(p[0] - 1, p[1] - 5, 3, 5, it[2].base); r.px(p[0] - 1, p[1] - 5, it[2].hi);
    });
  });
}
function hose(r) {
  const P = r.F(1, 1);
  r.obj(function () {
    r.seg(P, [8, 8, 0], [8, 8, 12], WD.base); r.seg(P, [16, 16, 0], [16, 16, 12], WD.shade);
    const c = P(12, 12, 7); r.ell(c[0], c[1], 7, 5.5, STM.dark); r.ell(c[0] - 0.5, c[1] - 0.5, 6, 4.5, STM.base);
    r.ell(c[0], c[1], 3.5, 2.5, STM.shade); r.ell(c[0], c[1], 1.5, 1.2, WD.base);
    for (let k = -4; k <= 4; k += 2) r.px(c[0] + k, c[1] - 3 + Math.abs(k) / 2, STM.hi);
    r.rect(c[0] + 6, c[1] + 4, 4, 1, STM.base); r.rect(c[0] + 10, c[1] + 4, 2, 2, ST.base);
  });
}
function plusMark(r) {
  const cx = r.ax, cy = r.ay;
  for (let j = 0; j < 14; j++) { const half = j < 7 ? 2 * j + 2 : 2 * (13 - j) + 2; r.rect(cx - half, cy - 7 + j, half * 2, 1, [AN.U, 0.30]); }
  r.rect(cx - 2, cy - 7, 5, 15, AN.U); r.rect(cx - 7, cy - 2, 15, 5, AN.U);
  r.rect(cx - 1, cy - 6, 3, 13, AN.C); r.rect(cx - 6, cy - 1, 13, 3, AN.C);
}

/* ================================================================ the set */
const DEFS = Object.create(null), ORDER = [];
function def(name, w, h, ax, ay, n, paint, meta) {
  if (DEFS[name]) throw new Error('art3 rule: duplicate sprite "' + name + '"');
  DEFS[name] = { name: name, w: w, h: h, ax: ax, ay: ay, n: n, paint: paint, meta: meta || {} };
  ORDER.push(name);
}
// kit
def('kettle', 36, 40, 18, 33, 5, kettle, { footprint: [1, 1], shadow: [12, 5] });
def('drum', 32, 50, 16, 46, 4, drum, { footprint: [1, 2], shadow: [12, 5] });
def('cabinet', 36, 76, 18, 60, 4, cabinet, { footprint: [1, 1], shadow: [15, 6] });
def('stick_burner', 84, 72, 40, 58, 4, stickBurner, { footprint: [2, 1], shadow: [30, 9] });
def('trailer_rig', 96, 84, 46, 66, 4, trailerRig, { footprint: [2, 1], shadow: [34, 10] });
def('pile', 32, 38, 16, 24, 4, pile, { footprint: [1, 1], shadow: [12, 5] });
def('woodpile', 44, 38, 22, 24, 3, woodpile, { footprint: [1, 1], shadow: [17, 7] });
def('cooler', 32, 38, 16, 24, 6, cooler, { footprint: [1, 1], shadow: [13, 6] });
def('board', 40, 36, 20, 26, 2, board, { footprint: [1, 1], shadow: [16, 7] });
Object.keys(COUNTER_N).forEach(function (name) {
  const n = COUNTER_N[name], gm = counterGeo(n);
  def(name, gm.w, gm.h, gm.ax, gm.ay, 1, function (r) { counter(r, n); }, { footprint: [1, n], slots: counterSlots(n, gm.ax, gm.ay), shadow: [12 * n + 4, 6 * n + 4] });
});
def('trash', 28, 32, 13, 26, 2, trash, { footprint: [1, 1], shadow: [8, 4] });
def('prep_table', 44, 40, 22, 26, 3, prepTable, { footprint: [1, 1], shadow: [18, 8] });
def('warmer', 36, 44, 18, 34, 3, warmer, { footprint: [1, 1], shadow: [14, 6] });
MEATS.forEach(function (m) { def('plate_' + m, 18, 13, 9, 9, 1, function (r) { plate(r, m, false); }); });
def('plate_empty', 18, 13, 9, 9, 1, function (r) { plate(r, null, false); });
MEATS.forEach(function (m) { def('platter_' + m, 22, 16, 11, 11, 1, function (r) { plate(r, m, true); }); });
def('platter_empty', 22, 16, 11, 11, 1, function (r) { plate(r, null, true); });
// yard: ground
def('paver', 48, 24, 24, 12, 4, paver, { ground: true });
def('lawn_a', 48, 24, 24, 12, 3, function (r, f) { lawn(r, f, LA); }, { ground: true });
def('lawn_b', 48, 24, 24, 12, 3, function (r, f) { lawn(r, f, LB); }, { ground: true });
def('stone_step', 48, 24, 24, 12, 2, stoneStep, { ground: true });
// yard: the barn wall along row 0 (anchor: the back corner) and what hangs on it (anchor: the wall foot under its centre)
def('wall_barn', 356, 284, 8, 146, 1, wallBarn, { wall: { length: BARN.L } });
def('shed', 36, 76, 18, 66, 1, wallDoor, { wall: true });
def('barn_window', 44, 82, 22, 76, 1, wallWindow, { wall: true });
def('window_box', 56, 56, 27, 50, 1, windowBox, { wall: true });
def('sign', 68, 80, 34, 76, 3, wallSign, { wall: true, text: { x: 34 - 27, y: 76 - SIGN.z0 - SIGN.bh + 3, w: 54, h: 16 } });
// yard: fences. fence_diag: the whole back fence on column 0's outer edge (anchor: the back corner).
def('fence_diag', 294, 186, 290, 38, 1, function (r) { fenceRun(r, 'v', 0, 288, 32, [0, 72, 144, 216, 287], false); }, { run: { along: 'v', tiles: 12 } });
def('fence_back', 30, 52, 14, 44, 2, function (r, f) { fenceRun(r, 'v', -12, 12, 32, f ? [-12] : [], false); });
def('fence_front', 30, 34, 14, 26, 1, function (r) { fenceRun(r, 'u', -12, 12, 14, [], true); });
def('fence_side', 30, 34, 14, 26, 2, function (r, f) { fenceRun(r, 'v', -12, 12, 14, f ? [-12] : [], true); });
def('fence_corner', 12, 24, 6, 20, 4, function (r) { r.obj(function () { r.rect(r.ax - 1, r.ay - 16, 3, 16, FN.shade); r.rect(r.ax - 1, r.ay - 16, 1, 16, FN.hi); r.rect(r.ax - 2, r.ay - 17, 5, 1, FN.base); }); });
def('gate', 40, 44, 18, 34, 2, gate);
// yard: plants, props, decor
def('tree', 92, 140, 46, 134, 1, function (r) { tree(r, 'all'); }, { footprint: [1, 1], shadow: [26, 9] });
def('tree_trunk', 92, 140, 46, 134, 1, function (r) { tree(r, 'trunk'); });
def('tree_canopy', 92, 140, 46, 134, 1, function (r) { tree(r, 'canopy'); });
def('pot', 20, 24, 10, 20, 3, pot, { footprint: [1, 1], shadow: [6, 3] });
def('lights_post', 24, 84, 12, 78, 1, lightsPost, { footprint: [1, 1] });
def('picnic', 76, 56, 38, 36, 2, picnicTable, { footprint: [2, 1], shadow: [30, 10] });
def('picnic_bench', 76, 56, 38, 36, 2, picnicBench, { footprint: [2, 1], seats: [[-3, -17], [21, -5]] });
def('flower_box', 52, 38, 26, 24, 1, flowerBox, { footprint: [2, 1] });
def('chair', 32, 42, 16, 28, 2, chair, { footprint: [1, 1], seats: [[0, -7]] });
def('canopy', 152, 144, 76, 106, 3, canopy, { footprint: [4, 2] });
def('birdbath', 24, 30, 12, 26, 2, birdbath, { footprint: [1, 1], shadow: [7, 3] });
def('mailbox', 28, 38, 14, 32, 2, mailbox, { footprint: [1, 1] });
def('tools', 32, 34, 16, 30, 1, tools, { footprint: [1, 1] });
def('shelf', 32, 54, 16, 40, 1, shelf, { footprint: [1, 1], shadow: [12, 5] });
def('hose', 36, 30, 16, 22, 1, hose, { footprint: [1, 1] });
// new
def('plus', 32, 18, 16, 9, 1, plusMark, { ground: true, tap: 'tiles' });

/* ================================================================ the size rule (spec B) */
// h: the rule height (rp above the ground at the sprite's foot); extra: what the 2:1 view adds on
// screen above the anchor (the top face's back half, or how far the tall part's own foot sits behind
// the anchor), so the opaque rise above the anchor is h + extra. w: opaque width (null = not ruled).
// total: plates, platters, ground and the plus are measured by their whole opaque height instead.
// Every frame stays at or under h + extra + 2; frame 0 must land within 2 rp of it (max: only the
// ceiling, for smoke, which may be shorter).
const SIZE = Object.freeze({
  kettle: { h: 26, extra: 0, w: 24, rule: 'lid top 26, rim 16; to the waist' },
  drum: { h: 38, extra: 3, w: 22, rule: 'top 26, stack 38; to the shoulder' },
  cabinet: { h: 52, extra: 4, w: 30, rule: 'top 40, stack 52; to the chin' },
  stick_burner: { h: 48, extra: 7, w: null, rule: 'chamber 24, stack 48' },
  trailer_rig: { h: 52, extra: 9, w: null, rule: 'chamber 26, stack 52 (added to B)' },
  pile: { h: 12, extra: 5, w: 24, rule: 'charcoal pile 12' },
  woodpile: { h: 14, extra: 5, w: null, rule: 'to the hip, never bigger than the counter' },
  cooler: { h: 10, extra: 6, w: 26, rule: 'lid 10, handle 12; to the knee' },
  board: { h: 15, extra: 6, w: null, rule: 'hip plus the board' },
  counter: { h: 13, extra: 22, w: null, rule: 'top 13, 1 tile deep, 3 tiles long' },
  counter_long: { h: 13, extra: 28, w: null, rule: 'top 13, 1 tile deep, 4 tiles long' },
  trash: { h: 18, extra: 3, w: 16, rule: 'trash can 18' },
  prep_table: { h: 13, extra: 9, w: null, rule: 'table top 13 (added to B)' },
  warmer: { h: 22, extra: 7, w: null, rule: 'box top 22 (added to B)' },
  plate_brisket: { h: 10, total: true, w: 14, rule: 'plate 14 by 7, food 3 above the rim' },
  plate_empty: { h: 7, total: true, w: 14, rule: 'plate 14 by 7' },
  platter_brisket: { h: 12, total: true, w: 18, rule: 'platter 18 by 9, food 3 above' },
  paver: { h: 24, total: true, w: 46, rule: 'ground tile 48 by 24 (46 opaque, tiles edge to edge)' },
  lawn_a: { h: 24, total: true, w: 46, rule: 'ground tile' },
  lawn_b: { h: 24, total: true, w: 46, rule: 'ground tile' },
  wall_barn: { h: 120, extra: 22, w: null, rule: 'eave 80, roof plus 40' },
  shed: { h: 52, extra: 7, w: 30, rule: 'barn door 52 by 28' },
  barn_window: { h: 58, extra: 9, w: 36, rule: '26 high, sill at 32, 34 wide' },
  window_box: { h: 36, extra: 10, w: null, rule: '7 high under the sill, flowers 4 above, 40 long' },
  sign: { h: 66, extra: 0, w: 60, rule: 'board 60 by 22, bottom at 38, on wall hooks to 66 (added to B)' },
  fence_diag: { h: 32, extra: 0, w: null, rule: 'back fence 32' },
  fence_back: { h: 32, extra: 6, w: null, rule: 'back fence 32' },
  fence_front: { h: 14, extra: 6, w: null, rule: 'front picket 14' },
  fence_side: { h: 14, extra: 6, w: null, rule: 'front picket 14' },
  gate: { h: 22, extra: 6, w: null, rule: 'gate posts 22' },
  tree: { h: 128, extra: 0, w: 84, rule: 'trunk 36, canopy top 128, canopy 84 wide' },
  pot: { h: 16, extra: 0, w: null, rule: 'pot, planter 16' },
  lights_post: { h: 72, extra: 1, w: null, rule: 'lights post 72' },
  picnic: { h: 13, extra: 13, w: null, rule: 'top 13, 2 tiles long' },
  picnic_bench: { h: 7, extra: 17, w: null, rule: 'bench 7' },
  flower_box: { h: 10, extra: 11, w: null, rule: 'flower box 10' },
  chair: { h: 20, extra: 5, w: null, rule: 'seat 7, back 20' },
  canopy: { h: 64, extra: 35, w: null, rule: 'canopy posts 64' },
  birdbath: { h: 20, extra: 3, w: null, rule: 'bird bath 20' },
  mailbox: { h: 26, extra: 4, w: null, rule: 'mailbox 26' },
  tools: { h: 28, extra: 0, w: 26, rule: 'tools rack 28 by 26' },
  shelf: { h: 30, extra: 6, w: 26, rule: 'shelf 30 by 26' },
  hose: { h: 14, extra: 3, w: null, rule: 'hose reel 14 (added to B)' },
  plus: { h: 15, total: true, w: 15, rule: '15 by 15 cream plus on a 28 by 14 diamond' },
  smoke_column: { h: 98, extra: 0, w: null, fx: true, max: true, rule: 'drum smoke 98 above the vent' },
  smoke_column_short: { h: 82, extra: 0, w: null, fx: true, max: true, rule: 'kettle smoke 82 above the vent' }
});

/* ================================================================ build, draw, measure */
let built = false;
const PIX = Object.create(null), CANV = Object.create(null);
function build() {
  if (built) return;
  ORDER.forEach(function (name) {
    const d = DEFS[name], frames = [];
    for (let f = 0; f < d.n; f++) {
      const r = new Ras(d.w, d.h, d.ax, d.ay, mulberry(seedOf('rule:' + name + ':' + f)));
      d.paint(r, f);
      frames.push(r.t);
    }
    PIX[name] = frames;
  });
  built = true;
}
function has(name) { return !!DEFS[name]; }
function need(name) { if (!DEFS[name]) throw new Error('art3 rule: unknown sprite "' + name + '"'); build(); return DEFS[name]; }
function frames(name) { return DEFS[name] ? DEFS[name].n : 0; }
function wrap(name, f) { const n = frames(name); f = Math.trunc(Number(f) || 0); return ((f % n) + n) % n; }
function pixels(name, f) { need(name); return PIX[name][wrap(name, f)]; }
function frameCanvas(name, f, flip) {
  const d = need(name), fr = wrap(name, f), key = name + ':' + fr + (flip ? 'f' : '');
  if (CANV[key]) return CANV[key];
  const c = document.createElement('canvas');
  c.width = d.w; c.height = d.h;
  const g = c.getContext('2d'), img = g.createImageData(d.w, d.h), src = PIX[name][fr];
  const buf = new Uint8ClampedArray(src.buffer.slice(0));
  if (flip) {
    const out = new Uint32Array(buf.buffer);
    for (let y = 0; y < d.h; y++) for (let x = 0; x < d.w; x++) out[y * d.w + x] = src[y * d.w + d.w - 1 - x];
  }
  img.data.set(buf);
  g.putImageData(img, 0, 0);
  CANV[key] = c;
  return c;
}
function anchor(name) { const d = need(name); return { w: d.w, h: d.h, ax: d.ax, ay: d.ay, footprint: d.meta.footprint ? d.meta.footprint.slice() : null }; }
function draw(ctx, name, x, y, f, flip) { ctx.drawImage(frameCanvas(name, f, flip === true), Math.round(x), Math.round(y)); }
function drawAt(ctx, name, ax, ay, f, flip) { const d = need(name); draw(ctx, name, flip === true ? ax - (d.w - d.ax) : ax - d.ax, ay - d.ay, f, flip); }
function drawScaled(ctx, name, x, y, w, h, f, flip) {
  if (!(w >= 1) || !(h >= 1)) return;
  const prev = ctx.imageSmoothingEnabled;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(frameCanvas(name, f, flip === true), x, y, w, h);
  ctx.imageSmoothingEnabled = prev;
}
function canvasFor(name, f, scale) {
  const src = frameCanvas(name, f, false), k = Math.max(1, Math.trunc(Number(scale) || 1));
  const c = document.createElement('canvas');
  c.width = src.width * k; c.height = src.height * k;
  const g = c.getContext('2d');
  g.imageSmoothingEnabled = false;
  g.drawImage(src, 0, 0, c.width, c.height);
  return c;
}
function meta(name) { return need(name).meta; }
// Slots in sprite px; seats as [dx, dy] from the anchor to the seat top (where a sitter's anchor goes).
function slots(name) { return has(name) && DEFS[name].meta.slots ? DEFS[name].meta.slots.map(function (s) { return s.slice(); }) : []; }
function seats(name) { return has(name) && DEFS[name].meta.seats ? DEFS[name].meta.seats.map(function (s) { return s.slice(); }) : []; }
function drawShadow(ctx, name, ax, ay) {
  const s = has(name) && DEFS[name].meta.shadow;
  if (!s) return;
  ctx.fillStyle = PAL.ALPHA.shadowProp.css;
  for (let y = -s[1]; y < s[1]; y++) {
    const dy = (y + 0.5) / s[1], half = s[0] * Math.sqrt(Math.max(0, 1 - dy * dy));
    const xa = Math.round(ax + 1 - half), xb = Math.round(ax + 1 + half);
    if (xb > xa) ctx.fillRect(xa, Math.round(ay) + y, xb - xa, 1);
  }
}
// Opaque bounds of one frame (alpha 200 and up): { w, h, rise } with rise = anchor y minus top row.
function boundsOf(px, w, h, ay) {
  let x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if ((px[y * w + x] >>> 24) >= 200) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  }
  return x1 < 0 ? null : { w: x1 - x0 + 1, h: y1 - y0 + 1, rise: ay - y0 };
}
function measure(name, f) {
  if (has(name)) { const d = need(name); return boundsOf(pixels(name, f), d.w, d.h, d.ay); }
  const fx = art3.fx;
  if (!fx || !fx.has || !fx.has(name) || typeof document === 'undefined') return null;
  const c = fx.canvasOf(name, f || 0, false), a = fx.anchor(name, f || 0);
  const g = c.getContext('2d');
  if (!g || typeof g.getImageData !== 'function') return null;
  const data = g.getImageData(0, 0, c.width, c.height).data;
  const u = new Uint32Array(data.buffer.slice(0));
  return boundsOf(u, c.width, c.height, a.ay);
}
// Checks every SIZE row; throws on a miss beyond 2 rp unless opts.soft. Returns the rows measured.
function verifySizes(opts) {
  const o = opts || {}, out = [], miss = [];
  Object.keys(SIZE).forEach(function (name) {
    const s = SIZE[name], n = has(name) ? frames(name) : (art3.fx && art3.fx.has && art3.fx.has(name) ? art3.fx.frames(name) : 0);
    if (!n) { if (!s.fx) miss.push(name + ': no sprite'); return; }
    const want = s.total ? s.h : s.h + (s.extra || 0);
    for (let f = 0; f < n; f++) {
      const b = measure(name, f);
      if (!b) { if (!s.fx) miss.push(name + ' frame ' + f + ': empty'); continue; }
      const got = s.total ? b.h : b.rise;
      if (f === 0) {
        out.push({ name: name, want: want, got: got, wantW: s.w, gotW: b.w });
        if (s.max ? got > want + 2 : Math.abs(got - want) > 2) miss.push(name + ': ' + (s.total ? 'height ' : 'rise ') + got + ', rule ' + want);
        if (s.w && Math.abs(b.w - s.w) > 2) miss.push(name + ': width ' + b.w + ', rule ' + s.w);
      } else if (got > want + 2) miss.push(name + ' frame ' + f + ': ' + got + ' over the rule ' + want);
    }
  });
  if (miss.length && !o.soft) throw new Error('art3 rule: size rule misses: ' + miss.join('; '));
  return { rows: out, misses: miss };
}

art3.rule = {
  build: build, has: has, names: function () { return ORDER.slice(); }, frames: frames,
  anchor: anchor, pixels: pixels, frameCanvas: frameCanvas, canvasFor: canvasFor,
  draw: draw, drawAt: drawAt, drawScaled: drawScaled, slots: slots, seats: seats, meta: meta, drawShadow: drawShadow,
  SIZE: SIZE, BARN: Object.freeze({ length: BARN.L, eave: BARN.EAVE, roof: BARN.ROOF }), measure: measure, verifySizes: verifySizes
};
Object.defineProperty(art3.rule, 'built', { enumerable: true, get: function () { return built; } });
})();
