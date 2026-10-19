// games/pit-sim/art3/index.js
// Your Pit v3 art library: the assembler. Merges the category files into one PitSim.art3 API in
// the shape of v2's PitSim.art (sprites.js: build, has, frames, draw, drawScaled, canvasFor, text,
// textTinted, textWidth), adds anchor placement, the y-sort and tile helpers of the iso
// projection (proj.js), and a manifest of every sprite. Spec: docs/superpowers/specs/
// 2026-10-18-pit-sim-art3-bible.md. Not loaded by the game until v3.4.
//
// Load order (each file adds to PitSim.art3, none replaces another):
//   palette.js, proj.js, people.js, kit.js, yard.js, fx.js, index.js
//
// API added here (window.PitSim.art3):
//   build(opts)                     builds kit, yard and fx, then the looks named in opts.looks
//                                   (default: every look registered as player or crew*); returns
//                                   { ms, parts: { kit, yard, fx, people }, looks, frames }
//   built, buildMs, report          state of the last build()
//   has(name), frames(name), setOf(name)         'kit' | 'yard' | 'fx' | 'people' | null
//   anchor(name, frame)             { w, h, ax, ay } (ax, ay = bottom centre of the footprint)
//   draw(ctx, name, x, y, frame, flip)           top left, as v2
//   drawAt(ctx, name, ax, ay, frame, flip)       by anchor; a flip mirrors about ax
//   drawTile(ctx, name, tx, ty, frame, flip)     placed on its footprint's top left tile
//   placeTile(name, tx, ty)         top left in world render px for drawTile
//   drawScaled(ctx, name, x, y, w, h, frame, flip), canvasFor(name, frame, scale), frameCanvas
//   text, textTinted (v2 colour keys accepted), textWidth, floatNum   (the fx font)
//   TILE, VW, VH, HEADROOM, rowKey, moverKey, compare, ysort(items)
//   tileToScreen(tx, ty), tileAnchor(tx, ty, cols, rows), moverFoot(simPx, simPy),
//   screenToTile(clientX, clientY, rect, headroom), scaleFor(vw, dpr)
//   names(), manifest(), verify()
//
// People are named sprites too, for any look registered with art3.look(who, parts):
//   <who>_down, <who>_up, <who>_side, <who>_carry_down, <who>_carry_up, <who>_carry_side,
//   <who>_sit, <who>_sit_up, bust_<who>       (frames as people.js POSES; bust is one frame)
(function () {
'use strict';
const root = typeof window !== 'undefined' ? window : globalThis;
const PitSim = root.PitSim = root.PitSim || {};
const art3 = PitSim.art3 = PitSim.art3 || {};

const REQUIRE = [['PAL', 'palette.js'], ['proj', 'proj.js'], ['people', 'people.js'], ['kit', 'kit.js'], ['yard', 'yard.js'], ['fx', 'fx.js']];
const missing = REQUIRE.filter(function (r) { return !art3[r[0]]; }).map(function (r) { return r[1]; });
if (missing.length) {
  throw new Error('art3 index: load ' + missing.join(', ') + ' before index.js (order: palette, proj, people, kit, yard, fx, index)');
}

const PAL = art3.PAL, proj = art3.proj, people = art3.people;
const SETS = { kit: art3.kit, yard: art3.yard, fx: art3.fx };
const SET_ORDER = ['kit', 'yard', 'fx'];
const TILE = proj.TILE, VW = proj.VW, VH = proj.VH;
// Render px above row 0: the sky band (yard 'backdrop' is exactly this tall), which also holds the
// art that rises past row 0 (barn roof 22, tree canopy about 30, back fence pickets 28). The
// game's canvas is VW by VH + HEADROOM with the world drawn HEADROOM px down.
const HEADROOM = 64;
const FOOT = 30;          // a mover's feet sit 2 px above its tile's front line (rowKey = 32 row + 30)

function now() { return (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now(); }
function r1(v) { return Math.round(v * 10) / 10; }

/* ================================================================ manifest */
// Every world sprite: [name, set, w, h, frames, ax, ay, vary]. vary 1 = frame sizes differ (the
// numbers are frame 0's). build() checks this table against the category files and throws on any
// drift, so the game can lay out against it. People are listed by pattern in PEOPLE_MANIFEST.
const MANIFEST = Object.freeze([
  // kit
['kettle', 'kit', 32, 52, 5, 16, 52, 0],
  ['drum', 'kit', 32, 72, 4, 16, 72, 0],
  ['cabinet', 'kit', 32, 76, 4, 16, 76, 0],
  ['stick_burner', 'kit', 64, 56, 4, 32, 56, 0],
  ['trailer_rig', 'kit', 80, 64, 4, 40, 64, 0],
  ['pile', 'kit', 32, 32, 4, 16, 32, 0],
  ['woodpile', 'kit', 32, 40, 3, 16, 40, 0],
  ['cooler', 'kit', 32, 48, 6, 16, 48, 0],
  ['board', 'kit', 32, 52, 2, 16, 52, 0],
  ['counter', 'kit', 66, 58, 1, 33, 57, 0],
  ['counter_long', 'kit', 98, 74, 1, 49, 73, 0],
  ['trash', 'kit', 32, 40, 2, 16, 40, 0],
  ['prep_table', 'kit', 32, 48, 3, 16, 48, 0],
  ['warmer', 'kit', 32, 44, 3, 16, 44, 0],
  ['piece_sausage', 'kit', 20, 20, 5, 10, 20, 0],
  ['piece_chicken', 'kit', 20, 20, 5, 10, 20, 0],
  ['piece_ribs', 'kit', 20, 20, 5, 10, 20, 0],
  ['piece_butt', 'kit', 20, 20, 5, 10, 20, 0],
  ['piece_brisket', 'kit', 20, 20, 5, 10, 20, 0],
  ['plate_sausage', 'kit', 20, 13, 1, 10, 7, 0],
  ['plate_chicken', 'kit', 20, 13, 1, 10, 7, 0],
  ['plate_ribs', 'kit', 20, 13, 1, 10, 7, 0],
  ['plate_butt', 'kit', 20, 13, 1, 10, 7, 0],
  ['plate_brisket', 'kit', 20, 13, 1, 10, 7, 0],
  ['plate_empty', 'kit', 20, 13, 1, 10, 7, 0],
  ['platter_sausage', 'kit', 26, 16, 1, 13, 9, 0],
  ['platter_chicken', 'kit', 26, 16, 1, 13, 9, 0],
  ['platter_ribs', 'kit', 26, 16, 1, 13, 9, 0],
  ['platter_butt', 'kit', 26, 16, 1, 13, 9, 0],
  ['platter_brisket', 'kit', 26, 16, 1, 13, 9, 0],
  ['dish_sausage', 'kit', 48, 30, 1, 24, 15, 0],
  ['dish_chicken', 'kit', 48, 30, 1, 24, 15, 0],
  ['dish_ribs', 'kit', 48, 30, 1, 24, 15, 0],
  ['dish_butt', 'kit', 48, 30, 1, 24, 15, 0],
  ['dish_brisket', 'kit', 48, 30, 1, 24, 15, 0],
  ['gauge', 'kit', 8, 40, 17, 4, 40, 0],
  // yard
  ['paver', 'yard', 32, 32, 4, 16, 32, 0],
  ['lawn_a', 'yard', 32, 32, 3, 16, 32, 0],
  ['lawn_b', 'yard', 32, 32, 3, 16, 32, 0],
  ['stone_step', 'yard', 32, 32, 2, 16, 32, 0],
  ['backdrop', 'yard', 352, 176, 1, 176, 64, 0],
  ['wall_barn', 'yard', 240, 202, 1, 13, 106, 0],
  ['fence_diag', 'yard', 172, 116, 1, 166, 32, 0],
  ['fence_back', 'yard', 32, 60, 2, 16, 58, 0],
  ['fence_front', 'yard', 32, 60, 1, 16, 38, 0],
  ['fence_side', 'yard', 32, 60, 2, 16, 60, 0],
  ['fence_corner', 'yard', 32, 60, 4, 16, 58, 0],
  ['gate', 'yard', 32, 60, 2, 16, 38, 0],
  ['hedge', 'yard', 32, 40, 8, 16, 36, 0],
  ['bed', 'yard', 32, 40, 32, 16, 38, 0],
  ['tree', 'yard', 88, 128, 1, 42, 126, 0],
  ['tree_trunk', 'yard', 88, 128, 1, 42, 126, 0],
  ['tree_canopy', 'yard', 88, 128, 1, 42, 126, 0],
  ['pot', 'yard', 32, 44, 3, 16, 40, 0],
  ['lights_post', 'yard', 32, 136, 1, 16, 134, 0],
  ['lights_string', 'yard', 312, 40, 2, 140, 32, 0],
  ['sign', 'yard', 84, 148, 3, 76, 146, 0],
  ['picnic', 'yard', 126, 94, 2, 62, 90, 0],
  ['picnic_bench', 'yard', 126, 94, 2, 62, 90, 0],
  ['flower_box', 'yard', 72, 64, 1, 36, 60, 0],
  ['chair', 'yard', 32, 48, 2, 16, 44, 0],
  ['canopy', 'yard', 88, 104, 3, 44, 102, 0],
  ['birdbath', 'yard', 32, 48, 2, 16, 44, 0],
  ['mailbox', 'yard', 32, 56, 2, 16, 50, 0],
  ['dog', 'yard', 32, 24, 7, 16, 22, 0],
  // fx
  ['bubble', 'fx', 34, 33, 1, 17, 33, 0],
  ['bubble_body', 'fx', 34, 33, 1, 17, 33, 0],
  ['bubble_warn', 'fx', 18, 23, 2, 8, 23, 0],
  ['icon_sausage', 'fx', 24, 16, 4, 12, 16, 0],
  ['icon_chicken', 'fx', 24, 16, 4, 12, 16, 0],
  ['icon_ribs', 'fx', 24, 16, 4, 12, 16, 0],
  ['icon_butt', 'fx', 24, 16, 4, 12, 16, 0],
  ['icon_brisket', 'fx', 24, 16, 4, 12, 16, 0],
  ['mark_x', 'fx', 12, 12, 1, 6, 12, 0],
  ['coin', 'fx', 14, 14, 3, 7, 14, 0],
  ['heart', 'fx', 13, 12, 2, 6, 12, 0],
  ['sparkle', 'fx', 11, 11, 3, 5, 11, 0],
  ['smoke_s', 'fx', 13, 12, 3, 6, 12, 0],
  ['smoke_dark_s', 'fx', 13, 12, 3, 6, 12, 0],
  ['smoke_m', 'fx', 19, 17, 3, 9, 17, 0],
  ['smoke_dark_m', 'fx', 19, 17, 3, 9, 17, 0],
  ['smoke_l', 'fx', 26, 23, 3, 13, 23, 0],
  ['smoke_dark_l', 'fx', 26, 23, 3, 13, 23, 0],
  ['smoke', 'fx', 13, 12, 3, 6, 12, 1],
  ['smoke_dark', 'fx', 13, 12, 3, 6, 12, 1],
  ['smoke_column', 'fx', 38, 98, 3, 9, 96, 0],
  ['smoke_column_dark', 'fx', 38, 98, 3, 9, 96, 0],
  ['smoke_column_short', 'fx', 32, 82, 3, 12, 80, 0],
  ['smoke_column_short_dark', 'fx', 32, 82, 3, 12, 80, 0],
  ['fire', 'fx', 15, 19, 3, 7, 19, 0],
  ['sweat', 'fx', 7, 9, 2, 3, 9, 0],
  ['zzz', 'fx', 23, 21, 3, 11, 21, 0],
  ['arrow', 'fx', 14, 19, 4, 7, 19, 0],
  ['tap_ring', 'fx', 32, 32, 4, 16, 32, 0],
  ['rain', 'fx', 32, 36, 3, 16, 36, 0],
  ['rain_splash', 'fx', 9, 5, 3, 4, 5, 0]
].map(function (r) { return Object.freeze(r); }));

const CELL = people.CELL;
const POSE_NAMES = Object.freeze({
  down: 'down', up: 'up', side: 'side',
  carry_down: 'carryDown', carry_up: 'carryUp', carry_side: 'carrySide',
  sit: 'sit', sit_up: 'sitUp'
});
const PEOPLE_MANIFEST = Object.freeze(Object.keys(POSE_NAMES).map(function (suffix) {
  const pose = POSE_NAMES[suffix], sit = pose === 'sit' || pose === 'sitUp';
  return Object.freeze(['<who>_' + suffix, 'people', CELL.w, sit ? CELL.sitH : CELL.h, people.POSES[pose], CELL.ax, sit ? CELL.sitH : CELL.h, 0]);
}).concat([Object.freeze(['bust_<who>', 'people', CELL.bust, CELL.bust, 1, CELL.bust / 2, CELL.bust, 0])]));

// Which set owns each world name. Two category files claiming one name is a load error.
const OWNER = Object.create(null);
SET_ORDER.forEach(function (key) {
  SETS[key].names().forEach(function (name) {
    if (OWNER[name]) throw new Error('art3 index: sprite "' + name + '" is defined by both ' + OWNER[name] + ' and ' + key);
    OWNER[name] = key;
  });
});
const MAN_BY_NAME = Object.create(null);
MANIFEST.forEach(function (r) { MAN_BY_NAME[r[0]] = r; });

/* ================================================================ people names */
const LOOK_IDS = [];
const peopleLook = art3.look;
// Same as people.js look(id, parts), and remembers the id so build() can prebuild player and crew.
function look(id, parts) {
  const n = peopleLook(id, parts);
  if (LOOK_IDS.indexOf(id) < 0) LOOK_IDS.push(id);
  return n;
}
const PERSON_RE = /^(.+?)_(carry_down|carry_up|carry_side|sit_up|down|up|side|sit)$/;
const personCache = Object.create(null);
// { who, pose } for a person sprite name whose look is registered, else null. pose 'bust' for busts.
function parsePerson(name) {
  if (typeof name !== 'string') return null;
  const hit = personCache[name];
  if (hit && art3.lookOf(hit.who)) return hit;
  let out = null;
  if (name.indexOf('bust_') === 0) {
    const who = name.slice(5);
    if (who && art3.lookOf(who)) out = { who: who, pose: 'bust' };
  } else {
    const m = PERSON_RE.exec(name);
    if (m && art3.lookOf(m[1])) out = { who: m[1], pose: POSE_NAMES[m[2]] };
  }
  if (out) personCache[name] = out;
  return out;
}

/* ================================================================ lookups */
function setOf(name) {
  if (OWNER[name]) return OWNER[name];
  return parsePerson(name) ? 'people' : null;
}
function has(name) { return setOf(name) !== null; }
function need(name) {
  const s = setOf(name);
  if (!s) throw new Error('art3: unknown sprite "' + name + '"');
  return s;
}
function frames(name) {
  const s = setOf(name);
  if (!s) return 0;
  if (s !== 'people') return SETS[s].frames(name);
  const p = parsePerson(name);
  return p.pose === 'bust' ? 1 : people.POSES[p.pose];
}
function wrapFrame(name, frame) {
  const n = frames(name);
  const f = Math.trunc(Number(frame) || 0);
  return ((f % n) + n) % n;
}
// { w, h, ax, ay } of one frame, in render px; (ax, ay) is the footprint's bottom centre.
function anchor(name, frame) {
  const s = need(name);
  if (s === 'kit') { const a = SETS.kit.anchor(name); return { w: a.w, h: a.h, ax: a.ax, ay: a.ay }; }
  if (s === 'yard') { const z = SETS.yard.size(name), a = SETS.yard.anchor(name); return { w: z[0], h: z[1], ax: a.ax, ay: a.ay }; }
  if (s === 'fx') { const a = SETS.fx.anchor(name, frame); return { w: a.w, h: a.h, ax: a.ax, ay: a.ay }; }
  const p = parsePerson(name);
  if (p.pose === 'bust') return { w: CELL.bust, h: CELL.bust, ax: CELL.bust / 2, ay: CELL.bust };
  const h = p.pose === 'sit' || p.pose === 'sitUp' ? CELL.sitH : CELL.h;
  return { w: CELL.w, h: h, ax: CELL.ax, ay: h };
}

/* ================================================================ frame canvases */
// One canvas per frame (and per flip), cached here for the sets that keep an atlas instead.
const frameCache = Object.create(null);
function mirrorOf(src) {
  const c = document.createElement('canvas');
  c.width = src.width; c.height = src.height;
  const g = c.getContext('2d');
  g.translate(src.width, 0); g.scale(-1, 1);
  g.drawImage(src, 0, 0);
  return c;
}
function frameCanvas(name, frame, flip) {
  const s = need(name), f = wrapFrame(name, frame), fl = flip === true;
  if (s === 'fx') return SETS.fx.canvasOf(name, f, fl);
  if (s === 'people') {
    const p = parsePerson(name);
    if (p.pose !== 'bust') return art3.person(p.who, p.pose, f, fl);
    const bust = art3.portrait(p.who);
    if (!fl) return bust;
    const kb = name + '|' + people.lookKey(art3.lookOf(p.who)) + '|f';
    return frameCache[kb] || (frameCache[kb] = mirrorOf(bust));
  }
  const key = s + ':' + name + ':' + f;
  let c = frameCache[key];
  if (!c) { c = SETS[s].canvasFor(name, f, 1); frameCache[key] = c; }
  if (!fl) return c;
  return frameCache[key + 'f'] || (frameCache[key + 'f'] = mirrorOf(c));
}

/* ================================================================ draw shims (v2 shape) */
// Top left, as PitSim.art.draw.
function draw(ctx, name, x, y, frame, flip) {
  const s = need(name);
  if (s !== 'people') { SETS[s].draw(ctx, name, x, y, frame, flip === true); return; }
  const p = parsePerson(name);
  if (p.pose === 'bust') { ctx.drawImage(frameCanvas(name, 0, flip === true), Math.round(x), Math.round(y)); return; }
  const a = anchor(name, frame);
  art3.drawPerson(ctx, p.who, p.pose, wrapFrame(name, frame), Math.round(x) + a.ax, Math.round(y) + a.ay, flip === true);
}
// By anchor: (ax, ay) is where the footprint's bottom centre goes in world render px.
function drawAt(ctx, name, ax, ay, frame, flip) {
  const s = need(name);
  if (s !== 'people') { SETS[s].drawAt(ctx, name, ax, ay, frame, flip === true); return; }
  const p = parsePerson(name);
  if (p.pose === 'bust') { ctx.drawImage(frameCanvas(name, 0, flip === true), Math.round(ax) - CELL.bust / 2, Math.round(ay) - CELL.bust); return; }
  art3.drawPerson(ctx, p.who, p.pose, wrapFrame(name, frame), ax, ay, flip === true);
}
// Top left in world render px for a sprite standing on tile (tx, ty), the top left tile of its
// footprint. Yard pieces use their own registration; kit pieces sit on their footprint; anything
// else (people, effects) stands with its anchor on the tile's foot line.
function placeTile(name, tx, ty) {
  const s = need(name);
  if (s === 'yard') return SETS.yard.placeTile(name, tx, ty);
  const a = anchor(name, 0);
  let fx = tx * TILE + TILE / 2, fy = ty * TILE + FOOT;
  if (s === 'kit') {
    const fp = SETS.kit.anchor(name).footprint || [1, 1];
    fx = tx * TILE + fp[0] * TILE / 2; fy = (ty + fp[1]) * TILE;
  }
  return { x: Math.round(fx - a.ax), y: Math.round(fy - a.ay) };
}
function drawTile(ctx, name, tx, ty, frame, flip) {
  const p = placeTile(name, tx, ty);
  draw(ctx, name, p.x, p.y, frame, flip);
}
// One frame stretched into a w by h box with smoothing off.
function drawScaled(ctx, name, x, y, w, h, frame, flip) {
  if (!(w >= 1) || !(h >= 1)) return;
  const s = need(name);
  if (s === 'kit' || s === 'yard') { SETS[s].drawScaled(ctx, name, x, y, w, h, frame, flip === true); return; }
  const src = frameCanvas(name, frame, flip === true);
  const prev = ctx.imageSmoothingEnabled;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(src, x, y, w, h);
  ctx.imageSmoothingEnabled = prev;
}
// A new canvas holding one frame scaled up by an integer.
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

/* ================================================================ text */
// v2 colour keys (sprites.js COLOR) mapped onto the v3 palette, so game.js T() and popText()
// keep working when v3.4 swaps the library in. Anything else goes to fx (hex, K U C O, UI keys).
const R = PAL.RAMP, A = PAL.ANCHOR;
const V2_COLOR = Object.freeze({
  K: A.K, U: A.U, C: A.C, O: A.O, outline: PAL.OL,
  woodD: R.woodD.base, woodM: R.woodM.base, woodL: R.woodL.base, paver: R.paver.base, paverD: R.paver.dark,
  lawnA: R.lawnA.base, lawnB: R.lawnB.base, leafD: R.leaf.dark, leafL: R.leaf.hi, cloth: R.cloth.hi, clothD: R.cloth.base,
  white: PAL.UI.white, pink: R.flowers[0], magenta: PAL.SHIRT.magenta[1], yellow: R.bulbs[0],
  skinL: PAL.SKIN[0].base, skinM: PAL.SKIN[2].base, skinD: PAL.SKIN[4].base, red: R.drum.base,
  raw: PAL.MEAT.ribs.raw.base, cooking: PAL.MEAT.sausage.cooking.base, done: R.ribs.base,
  steelL: R.steel.base, steelD: R.steel.dark, smokeL: R.smoke.shade, smokeD: R.smokeDark.base
});
const fxText = SETS.fx.text, fxTinted = SETS.fx.textTinted;
function textTinted(ctx, str, x, y, colorKey, opts) {
  const c = Object.prototype.hasOwnProperty.call(V2_COLOR, colorKey) ? V2_COLOR[colorKey] : colorKey;
  return fxTinted(ctx, str, x, y, c, opts);
}

/* ================================================================ projection helpers */
function tileToScreen(tx, ty) { return { x: tx * TILE, y: ty * TILE }; }
// Bottom centre of a footprint whose top left tile is (tx, ty): where kit anchors go.
function tileAnchor(tx, ty, cols, rows) {
  return { x: tx * TILE + (cols || 1) * TILE / 2, y: (ty + (rows || 1)) * TILE };
}
// A mover's feet in render px from its sim px (the tile's top left in the 16 px grid).
function moverFoot(simPx, simPy) { return { x: simPx * proj.S + TILE / 2, y: Math.round(simPy) * proj.S + FOOT }; }
// Tap to tile on a canvas showing the yard HEADROOM (or `headroom`) px down from its top edge.
// Scale is uniform, so the canvas width alone gives render px per CSS px. null outside the yard.
function screenToTile(clientX, clientY, rect, headroom) {
  const hr = headroom === undefined ? HEADROOM : headroom;
  const k = VW / rect.width;
  return proj.renderToTile((clientX - rect.left) * k, (clientY - rect.top) * k - hr);
}
// Sorts draw items { k, l, x, o } in place, back to front (proj.compare), and returns the array.
function ysort(items) { return items.sort(proj.compare); }

/* ================================================================ manifest and build */
function names() { return MANIFEST.map(function (r) { return r[0]; }); }
function entry(r) { return { name: r[0], set: r[1], w: r[2], h: r[3], frames: r[4], ax: r[5], ay: r[6], vary: r[7] === 1 }; }
function manifest() {
  const list = MANIFEST.concat(PEOPLE_MANIFEST).map(entry);
  const totals = { names: MANIFEST.length, frames: 0, bySet: {} };
  MANIFEST.forEach(function (r) {
    totals.frames += r[4];
    const b = totals.bySet[r[1]] || (totals.bySet[r[1]] = { names: 0, frames: 0 });
    b.names++; b.frames += r[4];
  });
  return { sprites: list, totals: totals, lookFrames: people.ATLAS.frames + 1 };
}
// Compares MANIFEST with the category files. Returns a list of problems (empty when they agree).
function verify() {
  const out = [];
  MANIFEST.forEach(function (r) {
    const name = r[0];
    if (OWNER[name] !== r[1]) { out.push(name + ': listed under ' + r[1] + ', owned by ' + (OWNER[name] || 'nobody')); return; }
    if (frames(name) !== r[4]) out.push(name + ': ' + frames(name) + ' frames, manifest says ' + r[4]);
    const a = anchor(name, 0);
    if (a.w !== r[2] || a.h !== r[3] || a.ax !== r[5] || a.ay !== r[6]) {
      out.push(name + ': ' + a.w + 'x' + a.h + ' anchor ' + a.ax + ',' + a.ay + ', manifest says ' + r[2] + 'x' + r[3] + ' anchor ' + r[5] + ',' + r[6]);
    }
  });
  Object.keys(OWNER).forEach(function (name) { if (!MAN_BY_NAME[name]) out.push(name + ': not in the manifest'); });
  return out;
}

let built = false, buildMs = 0, report = null;
// Builds every world set, then prebuilds the looks the first frame needs (guests stay lazy).
// opts.looks: ids to prebuild (default: registered ids 'player' and 'crew*'). A second call
// returns the first report unless it names looks or passes force.
function build(opts) {
  const o = opts || {};
  if (built && !o.force && !o.looks) return report;
  const t0 = now(), parts = {};
  SET_ORDER.forEach(function (key) {
    const t = now();
    SETS[key].build();
    parts[key] = r1(now() - t);
  });
  const ids = o.looks || LOOK_IDS.filter(function (id) { return id === 'player' || /^crew/.test(id); });
  const tp = now();
  ids.forEach(function (id) { people.buildLook(id); });
  parts.people = r1(now() - tp);
  const problems = verify();
  if (problems.length) throw new Error('art3 index: manifest drift, update MANIFEST in index.js: ' + problems.slice(0, 6).join('; '));
  built = true;
  buildMs = r1(now() - t0);
  const m = manifest().totals;
  report = Object.freeze({ ms: buildMs, parts: Object.freeze(parts), looks: ids.length, frames: m.frames + ids.length * (people.ATLAS.frames + 1), names: m.names });
  return report;
}

/* ================================================================ register */
// The category entry points stay as they are (person, drawPerson, portrait, randomLook, lookOf,
// personHands, people, kit, yard, fx, box, ground, signText, GLYPHS, floatNum); these merge them.
const api = {
  TILE: TILE, VW: VW, VH: VH, HEADROOM: HEADROOM, FOOT: FOOT,
  SETS: SETS, MANIFEST: MANIFEST, PEOPLE_MANIFEST: PEOPLE_MANIFEST, V2_COLOR: V2_COLOR,
  build: build, has: has, frames: frames, setOf: setOf, anchor: anchor,
  draw: draw, drawAt: drawAt, drawTile: drawTile, placeTile: placeTile,
  drawScaled: drawScaled, canvasFor: canvasFor, frameCanvas: frameCanvas,
  text: fxText, textTinted: textTinted, textWidth: SETS.fx.textWidth,
  look: look,
  rowKey: proj.rowKey, moverKey: proj.moverKey, compare: proj.compare, ysort: ysort,
  tileToScreen: tileToScreen, tileAnchor: tileAnchor, moverFoot: moverFoot,
  screenToTile: screenToTile, scaleFor: proj.scaleFor,
  names: names, manifest: manifest, verify: verify
};
Object.keys(api).forEach(function (k) { art3[k] = api[k]; });
Object.defineProperty(art3, 'built', { enumerable: true, configurable: true, get: function () { return built; } });
Object.defineProperty(art3, 'buildMs', { enumerable: true, configurable: true, get: function () { return buildMs; } });
Object.defineProperty(art3, 'report', { enumerable: true, configurable: true, get: function () { return report; } });
})();
