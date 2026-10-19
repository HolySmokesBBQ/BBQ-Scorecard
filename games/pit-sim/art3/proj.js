// games/pit-sim/art3/proj.js
// Your Pit v3 art library: the projection. Iso drawn into the art on the orthogonal grid (art
// bible, section 1, round 1). Pure math, no DOM, no canvas. Loaded before the other art3 files; they
// read it as PitSim.art3.proj. Not loaded by the game until v3.4.
//
// Spaces:
//   sim px     the 16 px grid of sim.js (MAP.TILE 16). Never changes.
//   render px  the 32 px art grid, render px = 2 * sim px. Tile (tx, ty) covers
//              x in [32 tx, 32 tx + 32), y in [32 ty, 32 ty + 32). The yard is 352 by 384.
//   CSS px     render px * k / dpr, k = the integer device pixels per render px (game.js D13).
(function () {
'use strict';
const PitSim = window.PitSim = window.PitSim || {};
const art3 = PitSim.art3 = PitSim.art3 || {};

const TILE = 32;          // render px per tile
const SIM_TILE = 16;      // sim px per tile
const S = TILE / SIM_TILE; // 2
const MAP_W = 11, MAP_H = 12;
const VW = MAP_W * TILE, VH = MAP_H * TILE; // 352 by 384
const GUTTER = 4;         // CSS px each side on phones (design 12.3)

// The iso view drawn into the art (round 1). The grid, footprints and taps stay orthogonal; every
// boxy prop is drawn as mock B's iso box inside its footprint: a rhombus top with 2:1 edges (two
// px across per px down, the isoLine stair of b-iso-pixel.html), a lit left face and a shaded
// right face, light from the top left.
//   u axis: runs right and down on screen (x + 1, y + 1/2 per px of u)
//   v axis: runs left and down on screen (x - 1, y + 1/2 per px of v)
//   z:      straight up
// Keep u and v lengths even so every vertex lands on a whole pixel.
const ISO = Object.freeze({ STEP_X: 2, STEP_Y: 1 });

function tileOrigin(tx, ty) { return { x: tx * TILE, y: ty * TILE }; }
function tileFoot(ty) { return (ty + 1) * TILE; }
function simToRender(px, py) { return { x: px * S, y: py * S }; }

// A point function for one iso frame: (ox, oy) is the screen px of the ground point u = v = 0.
function isoP(ox, oy) {
  return function (u, v, z) { return [ox + u - v, oy + (u + v) / 2 - (z || 0)]; };
}
// The three visible faces of the iso box u0..u1 by v0..v1, from height z0 up h, as integer polygons
// in the frame of P (an isoP function). left faces +v (lit), right faces +u (shaded), top is the
// rhombus. Draw left, right, then top.
function isoFaces(P, u0, v0, u1, v1, z0, h) {
  const z1 = z0 + h;
  return {
    left: [P(u0, v1, z0), P(u1, v1, z0), P(u1, v1, z1), P(u0, v1, z1)],
    right: [P(u1, v0, z0), P(u1, v1, z0), P(u1, v1, z1), P(u1, v0, z1)],
    top: [P(u0, v0, z1), P(u1, v0, z1), P(u1, v1, z1), P(u0, v1, z1)],
    front: P(u1, v1, z0), frontTop: P(u1, v1, z1), leftTop: P(u0, v1, z1), rightTop: P(u1, v0, z1), back: P(u0, v0, z1)
  };
}
// Box by its front bottom vertex: the corner nearest the camera, on the ground line at (fx, fy).
// U = length along u, V = length along v, H = height. Same faces as isoFaces.
function boxFaces(fx, fy, U, V, H) {
  const P = isoP(fx - (U - V), fy - (U + V) / 2);
  const f = isoFaces(P, 0, 0, U, V, 0, H);
  f.P = P;
  f.bounds = { x: fx - U, y: fy - (U + V) / 2 - H, w: U + V, h: (U + V) / 2 + H };
  return f;
}
// The iso box that fits an orthogonal footprint (tiles tx0..tx1, ty0..ty1 inclusive) inset by
// `inset` px: its rhombus spans the footprint width, front vertex on the footprint's front line.
// ratio = U / (U + V) (0.5 = square rhombus). Returns { fx, fy, U, V, H, P }.
function footprintBox(tx0, ty0, tx1, ty1, h, inset, ratio) {
  const i = inset || 0;
  const w = (tx1 + 1 - tx0) * TILE - 2 * i;
  let U = Math.round(w * (ratio === undefined ? 0.5 : ratio) / 2) * 2;
  let V = Math.floor((w - U) / 2) * 2;
  const left = tx0 * TILE + i;
  const fx = left + U, fy = (ty1 + 1) * TILE - i;
  return { fx: fx, fy: fy, U: U, V: V, H: h, P: isoP(left + V, fy - (U + V) / 2) };
}
// The screen y of a 2:1 line through (x0, y0): dir +1 falls to the right, -1 falls to the left.
function isoLineY(x0, y0, dir, x) { return y0 + dir * (x - x0) / 2; }

// Y-sort: the v2 key doubled, so v3 draws in exactly the v2 order. Sort ascending by
// (key, layer, x, order). Tile-anchored things use the row of their front footprint row.
function rowKey(row) { return row * TILE + 30; }
function moverKey(simPy) { return Math.round(simPy) * S + 30; }
function compare(a, b) { return (a.k - b.k) || (a.l - b.l) || (a.x - b.x) || (a.o - b.o); }

// Tap to tile. rect is the canvas getBoundingClientRect(). Returns render px and the tile, or
// null outside the yard.
function cssToRender(clientX, clientY, rect) {
  return { x: (clientX - rect.left) / rect.width * VW, y: (clientY - rect.top) / rect.height * VH };
}
function renderToTile(vx, vy) {
  const tx = Math.floor(vx / TILE), ty = Math.floor(vy / TILE);
  if (!(tx >= 0 && tx < MAP_W && ty >= 0 && ty < MAP_H)) return null;
  return { x: tx, y: ty };
}

// game.js D13 on the 352 wide yard: integer k device px per render px.
function scaleFor(vw, dpr) {
  const target = Math.max(0.25, (vw - 2 * GUTTER) / VW);
  const k = Math.max(1, Math.floor(target * dpr + 1e-6));
  const css = k / dpr;
  return { k: k, css: css, tileCss: TILE * css, canvasCss: VW * css };
}

art3.proj = Object.freeze({
  TILE: TILE, SIM_TILE: SIM_TILE, S: S, ISO: ISO,
  VW: VW, VH: VH, GUTTER: GUTTER,
  tileOrigin: tileOrigin, tileFoot: tileFoot, simToRender: simToRender,
  isoP: isoP, isoFaces: isoFaces, boxFaces: boxFaces, footprintBox: footprintBox, isoLineY: isoLineY,
  rowKey: rowKey, moverKey: moverKey, compare: compare,
  cssToRender: cssToRender, renderToTile: renderToTile, scaleFor: scaleFor
});
})();
