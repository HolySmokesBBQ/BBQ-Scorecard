// games/pit-sim/art3/proof.js
// Dev only: the look proof for the art3 library, loaded by games/pit-sim/dev/look-proof.html after
// the library files. Round 1 recomposes the yard on mock B's layout
// (docs/superpowers/mocks/pit-sim-v3/b-iso-pixel.png): the patio is the upper diagonal half, the
// barn wall recedes along the top right, sky and tree line show in the top left wedge, a light
// string hangs high between two posts across the back, and stepping stones cross an open lawn with
// three diagonal picnic tables, the tree and a flower box. Every prop is drawn in the iso view
// inside its orthogonal footprint (proj.js); the grid and taps stay orthogonal.
// Round 2 (art director): the tip floats beside the pitmaster's head over clear patio (the prep
// cart is gone from the patio), the ground is the softer cream and lawn of mock B's PNG, the tree
// sits fully inside the frame, three staggered tables with a near-bench guest at each and the
// flower box in the bottom left fill the lower third, the kettle smokes a short straight column,
// the charcoal bag reads as one bag, and mock B's dish dock sits under the yard.
// Under the scene: the pitmaster look toggle, two evidence strips (z-order round a picnic table and
// the serving table; the three look presets as full figures), and three crew cards.
// Everything on the canvases comes from PitSim.art3. Deterministic; honours prefers-reduced-motion.
(function () {
'use strict';
const PitSim = window.PitSim;
const art3 = PitSim && PitSim.art3;
if (!art3 || typeof art3.build !== 'function') throw new Error('look proof: load the art3 library and index.js first');
const PAL = art3.PAL, R = PAL.RAMP, A = PAL.ANCHOR, UI = PAL.UI;
const kit = art3.kit, yard = art3.yard, fx = art3.fx;
const VW = art3.VW;

/* ================================================================ looks */
const PLAYER_LOOKS = [
  { label: 'Cap', parts: { body: 'A', skin: 1, hair: 'short', hairColor: 1, face: 'none', hat: 'cap', shirt: 'white', pants: 0, apron: 1, tongs: true } },
  { label: 'Cowboy hat', parts: { body: 'B', skin: 4, hair: 'short', hairColor: 1, face: 'beard', hat: 'cowboy', shirt: 'white', pants: 1, apron: 0, tongs: true } },
  { label: 'Bandana', parts: { body: 'A', skin: 2, hair: 'bun', hairColor: 2, face: 'glasses', hat: 'bandana', shirt: 'white', pants: 2, apron: 2, tongs: true } }
];
const CREW = [
  { who: 'crew0', name: 'OTIS', role: 'PIT', stars: 4.5, wage: 60, rookie: false,
    parts: { body: 'old', skin: 0, hair: 'short', hairColor: 5, face: 'mustache', hat: 'none', role: 'FIRE', pants: 1, apron: 4 } },
  { who: 'crew1', name: 'MIRA', role: 'PREP', stars: 3.5, wage: 40, rookie: true,
    parts: { body: 'A', skin: 2, hair: 'long', hairColor: 1, face: 'none', hat: 'bandana', role: 'PREP', pants: 0, apron: 5 } },
  { who: 'crew2', name: 'DEON', role: 'SERVE', stars: 4, wage: 50, rookie: false,
    parts: { body: 'B', skin: 5, hair: 'buzz', hairColor: 0, face: 'beard', hat: 'none', role: 'RUN', pants: 2, apron: 3 } }
];

/* ================================================================ the set (world render px) */
// The back corner, the patio vertex and the stones: the ground's diagonal split (yard.ground iso).
const CORNER = [yard.BACK_CORNER.x, yard.BACK_CORNER.y];
const VERTEX = [144, 176];
const STONES = [[146, 194], [150, 212], [145, 230], [149, 248]];
const GROUND = { iso: { corner: CORNER, vertex: VERTEX, stones: STONES } };
function front(x) { return VERTEX[1] - Math.abs(x - VERTEX[0]) / 2; }   // patio edge (lawn below)
void front;

// Picnic tables by anchor (the bottom centre of their 4 x 3 tile footprint).
const TABLES = [
  // round 2: staggered down the lawn like mock B, upper left, middle, lower right
  { ax: 64, ay: 252, far: ['cust0', 'cust1'], near: ['cust5'], plates: { far: ['ribs', 'sausage'], near: ['brisket'] }, eat: { cust0: 0, cust1: 1 } },
  { ax: 178, ay: 318, far: ['cust3', 'cust4'], near: ['cust9'], plates: { far: [null, 'chicken'], near: ['ribs'] }, eat: { cust4: 2 }, wait: { cust3: 'brisket' } },
  { ax: 282, ay: 380, far: ['cust6', 'cust7'], near: ['cust10'], plates: { far: [null, 'brisket'], near: ['chicken'] }, eat: { cust7: 3 }, wait: { cust6: 'ribs' } }
];
const GUEST_LOOKS = {
  cust0: { body: 'A', skin: 4, hair: 'curly', hairColor: 0, shirt: 'yellow' },
  cust1: { body: 'old', skin: 0, hair: 'bun', hairColor: 5, face: 'glasses', shirt: 'green' },
  cust3: { body: 'A', skin: 2, hair: 'long', hairColor: 1, shirt: 'pink' },
  cust4: { body: 'A', skin: 0, hair: 'short', hairColor: 3, shirt: 'white' },
  cust5: { body: 'B', skin: 1, hair: 'short', hairColor: 4, shirt: 'sky' },
  cust9: { body: 'B', skin: 5, hair: 'buzz', hairColor: 0, shirt: 'orange', pants: 2 },
  cust6: { body: 'A', skin: 3, hair: 'short', hairColor: 1, face: 'mustache', shirt: 'blue' },
  cust7: { body: 'A', skin: 5, hair: 'bun', hairColor: 0, shirt: 'magenta', pants: 1 },
  cust8: { body: 'A', skin: 3, hair: 'short', hairColor: 1, shirt: 'purple' },
  cust2: { body: 'A', skin: 0, hair: 'long', hairColor: 3, shirt: 'red', pants: 1 },
  cust10: { body: 'B', skin: 3, hair: 'curly', hairColor: 1, shirt: 'teal', pants: 2 }
};
// Kit by world anchor (bottom centre of the footprint).
const KIT = [
  { name: 'drum', ax: 54, ay: 44, frame: 2 },
  { name: 'woodpile', ax: 30, ay: 72, frame: 0 },
  { name: 'kettle', ax: 92, ay: 62, frame: 2 },
  { name: 'pile', ax: 68, ay: 92, frame: 0 },
  { name: 'board', ax: 44, ay: 114, frame: 1 },
  { name: 'cooler', ax: 96, ay: 140, frame: 0 },
  { name: 'counter_long', ax: 0, ay: 0, frame: 0 }
];
// The serving table: its back corner at (250, 56); the front vertex follows from its iso size.
const COUNTER = KIT[KIT.length - 1];
(function placeCounter() {
  const a = kit.anchor('counter_long'), g = { U: 20, V: 76 };
  const B = [250, 56], F = [B[0] + g.U - g.V, B[1] + (g.U + g.V) / 2];
  const fxCell = 1 + g.U;                   // front vertex column in the cell
  COUNTER.ax = F[0] - fxCell + a.ax; COUNTER.ay = F[1];
})();
const COUNTER_PLATES = [[0, 'sausage'], [2, 'ribs'], [4, 'brisket']];
const QUEUE = [
  { who: 'cust8', x: 266, y: 90, pose: 'up', flip: false, want: 'sausage' },
  { who: 'cust2', x: 296, y: 108, pose: 'side', flip: false }
];
const POST_L = { x: 14, y: 106 };
const SIGN_POST = { x: 322, y: 86 };
const TREE = { x: 296, y: 296 };          // canopy spans x - 42 to x + 46: fully inside VW
const FLOWERS = { x: 50, y: 374 };        // bottom left, as in mock B
const SIGN_TEXT = 'YOUR\nPIT';

/* ================================================================ motion */
// Pitmaster: a loop between the kettle, the board and the serving table, pausing at two corners.
const LOOP = [[110, 98, 900], [164, 98, 0], [164, 80, 600], [110, 80, 0]];
const WALK_PX_S = 30;
function pathOf(points) {
  const segs = [];
  let t = 0;
  for (let i = 0; i < points.length; i++) {
    const a = points[i], b = points[(i + 1) % points.length];
    const pa = { x: a[0], y: a[1] }, pb = { x: b[0], y: b[1] };
    if (a[2] > 0) { segs.push({ t0: t, t1: t + a[2], a: pa, b: pa, pause: true }); t += a[2]; }
    const d = Math.abs(pb.x - pa.x) + Math.abs(pb.y - pa.y), dur = d / WALK_PX_S * 1000;
    if (d > 0) { segs.push({ t0: t, t1: t + dur, a: pa, b: pb, pause: false }); t += dur; }
  }
  return { segs: segs, period: t };
}
const PLAYER_PATH = pathOf(LOOP);
// Runner: carries two platters down the stepping stones and back, face on at each end.
const RUN_PATH = pathOf([[148, 212, 2600], [148, 246, 1200]]);
function along(path, t) {
  const tt = ((t % path.period) + path.period) % path.period;
  let s = path.segs[path.segs.length - 1];
  for (let i = 0; i < path.segs.length; i++) if (tt < path.segs[i].t1) { s = path.segs[i]; break; }
  const u = s.t1 > s.t0 ? (tt - s.t0) / (s.t1 - s.t0) : 0;
  const x = s.a.x + (s.b.x - s.a.x) * u, y = s.a.y + (s.b.y - s.a.y) * u;
  let dir = 'down';
  if (!s.pause) {
    if (s.b.x < s.a.x) dir = 'left'; else if (s.b.x > s.a.x) dir = 'right';
    else if (s.b.y < s.a.y) dir = 'up'; else dir = 'down';
  }
  return { x: Math.round(x), y: Math.round(y), dir: dir, moving: !s.pause };
}
function poseFor(dir, carry) {
  const side = dir === 'left' || dir === 'right';
  const base = side ? 'side' : (dir === 'up' ? 'up' : 'down');
  if (!carry) return base;
  return base === 'side' ? 'carrySide' : (base === 'up' ? 'carryUp' : 'carryDown');
}

/* ================================================================ vents (smoke origins) */
function ventOf(name, frame) {
  const a = kit.anchor(name), px = kit.pixels(name, frame);
  for (let y = 0; y < a.h; y++) {
    for (let x = a.ax - 3; x <= a.ax + 3; x++) if (px[y * a.w + x] !== 0) return { dx: x - a.ax, dy: y - a.ay };
  }
  return { dx: 0, dy: -a.h };
}

/* ================================================================ HUD (mock B's strip) */
const HUD_H = 84;
const STAR = ['...#...', '..###..', '#######', '.#####.', '.##.##.', '#.....#'];
function star(ctx, x, y, on) {
  for (let r = 0; r < STAR.length; r++) for (let c = 0; c < 7; c++) {
    if (STAR[r][c] !== '#') continue;
    ctx.fillStyle = on ? (r === 1 && c === 3 ? UI.goldL : UI.gold) : UI.starOff;
    ctx.fillRect(x + c * 2, y + r * 2, 2, 2);
  }
}
function drawHud(ctx, t) {
  ctx.fillStyle = A.K; ctx.fillRect(0, 0, art3.VW, 60);
  ctx.fillStyle = UI.umber2; ctx.fillRect(0, 57, art3.VW, 1);
  ctx.fillStyle = A.O; ctx.fillRect(0, 58, art3.VW, 2);
  const T2 = { scale: 2, bold: true, shadow: 'K' };
  const pw = art3.textWidth('WEEK 3', { bold: true, scale: 2 }) + 12;
  ctx.fillStyle = A.O; ctx.fillRect(6, 5, pw, 24); ctx.fillRect(7, 4, pw - 2, 26);
  art3.text(ctx, 'WEEK 3', 12, 10, A.C, { scale: 2, bold: true, shadow: R.orange.dark });
  art3.text(ctx, 'CHURCH PICNIC', pw + 16, 10, A.C, T2);
  fx.drawAt(ctx, 'coin', 14, 50, Math.floor(t / 400) % 2 === 0 ? 0 : 0);
  art3.text(ctx, '240', 26, 36, UI.gold, T2);
  const sx = art3.VW - 6 - 5 * 16;
  for (let k = 0; k < 5; k++) star(ctx, sx + k * 16, 37, k < 4);
  art3.text(ctx, 'FANS', sx - 6 - art3.textWidth('FANS', { bold: true, scale: 2 }), 36, A.C, T2);
  // served strip
  ctx.fillStyle = A.U; ctx.fillRect(0, 60, art3.VW, 24);
  ctx.fillStyle = A.O; ctx.fillRect(0, 82, art3.VW, 2);
  let x = 8 + art3.text(ctx, 'SERVED', 8, 65, A.C, { scale: 2, shadow: 'K' });
  x += 6 + art3.text(ctx, '6/20', x + 6, 65, UI.gold, { scale: 2, shadow: 'K' });
  const bx = x + 8, bw = art3.VW - 60 - bx;
  ctx.fillStyle = A.K; ctx.fillRect(bx, 65, bw, 13);
  ctx.fillStyle = UI.tray; ctx.fillRect(bx + 2, 67, bw - 4, 9);
  const fw = Math.round((bw - 4) * 6 / 20);
  ctx.fillStyle = A.O; ctx.fillRect(bx + 2, 67, fw, 9);
  ctx.fillStyle = R.orange.hi; ctx.fillRect(bx + 2, 67, fw, 2);
  art3.text(ctx, '1:50', art3.VW - 8, 65, UI.gold, { scale: 2, shadow: 'K', align: 'right' });
}


/* ================================================================ depth against diagonal props */
// Plain y-sorting fails beside a long diagonal prop (a walker in front of the serving table's
// long right face has a smaller foot y than the table's front vertex). Each diagonal prop keeps its
// ground rhombus (back point B, U, V in px) and its two sort keys; a walker's key is pushed past the
// prop when it stands in front of either front edge and held before it when it stands behind.
function isoUV(o, x, y) {
  const dx = x - o.bx, dy = 2 * (y - o.by);
  return { u: (dx + dy) / 2, v: (dy - dx) / 2 };
}
function walkerKey(props, x, y) {
  let k = y;
  props.forEach(function (o) {
    if (x < o.x0 - 14 || x > o.x1 + 14) return;
    const q = isoUV(o, x, y);
    if (q.u < 0 || q.v < 0) k = Math.min(k, o.kBack - 0.5);
    else if (q.u > o.U || q.v > o.V) k = Math.max(k, o.kFront + 0.5);
  });
  return k;
}
// A picnic table's ground rhombus and keys from its anchor (yard.picnic: u 0..56, v -32..32).
function tableProp(ax, ay) {
  return { bx: ax + 4, by: ay - 60, U: 56, V: 64, x0: ax - 60, x1: ax + 60, kBack: ay - 27, kFront: ay };
}
function counterProp(c) {
  const g = { U: 20, V: 76 }, F = [c.ax - kit.anchor(c.name).ax + 1 + g.U, c.ay];
  const B = [F[0] - (g.U - g.V), F[1] - (g.U + g.V) / 2];
  return { bx: B[0], by: B[1], U: g.U, V: g.V, x0: B[0] - g.V, x1: B[0] + g.U, kBack: c.ay, kFront: c.ay };
}

/* ================================================================ drawing helpers */
function headTop(footY, seated) { return seated ? footY - 37 : footY - 47; }
function pushTable(push, g, T, t, over, heads) {
  const P = yard.PICNIC, ax = T.ax, ay = T.ay;
  push(ay - 27, 0, ax, function () { yard.drawAt(g, 'picnic_bench', ax, ay, 0); });
  T.far.forEach(function (who, i) {
    const s = P.far[i], x = ax + s.dx, y = ay + s.dy, seed = who;
    let f;
    if (T.wait && T.wait[who]) f = art3.people.clipFrame('sit', 'idle', t, seed);
    else {
      const e = (T.eat && T.eat[who]) || 0, cyc = (t + e * 900) % 5200;
      f = cyc < 3600 ? art3.people.clipFrame('sit', 'eat', t + e * 170, seed) : (cyc < 4600 ? 4 : art3.people.clipFrame('sit', 'idle', t, seed));
    }
    push(ay - 27, 1, x, function () { art3.drawPerson(g, who, 'sit', f, x, y); });
    heads.push({ x: x - 13, y: headTop(y, true), w: 26, h: 24, owner: who });
    if (T.wait && T.wait[who]) over.bubbles.push({ x: x, headTop: headTop(y, true), meat: T.wait[who] });
  });
  push(ay - 6, 2, ax, function () {
    yard.drawAt(g, 'picnic', ax, ay, 0);
    T.plates.far.forEach(function (m, i) { if (m) { const q = P.platesFar[i]; kit.drawAt(g, 'plate_' + m, ax + q.dx, ay + q.dy, 0); } });
    T.plates.near.forEach(function (m, i) { if (m) { const q = P.platesNear[i]; kit.drawAt(g, 'plate_' + m, ax + q.dx, ay + q.dy, 0); } });
  });
  push(ay, 0, ax, function () { yard.drawAt(g, 'picnic_bench', ax, ay, 1); });
  T.near.forEach(function (who, i) {
    const s = P.near[i], x = ax + s.dx, y = ay + s.dy;
    const f = art3.people.clipFrame('sitUp', 'idle', t + i * 300, who);
    push(ay, 1, x, function () { art3.drawPerson(g, who, 'sitUp', f, x, y); });
    heads.push({ x: x - 13, y: headTop(y, true), w: 26, h: 24, owner: who });
  });
}

/* ================================================================ HUD + scene */
const HEAD = art3.HEADROOM;
const WORLD_Y = HUD_H + HEAD;               // canvas row of world y 0
const DOCK_H = 104;                         // mock B's dish dock under the yard
const DOCK_Y = WORLD_Y + art3.VH;
const DOCK_DISHES = ['sausage', 'chicken', 'ribs', 'brisket'];
const CW = VW, CHT = DOCK_Y + DOCK_H;
const MAP = { W: 11, H: 12, T: { PAVER: 0, FENCE: 1, GATE: 2, LAWN: 3, HEDGE: 4, BED: 5 }, at: function () { return 0; } };
let canvas = null, ctx = null, playerLook = 0, start = 0, vents = null;
const reduce = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;

function registerLooks() {
  art3.look('player', PLAYER_LOOKS[playerLook].parts);
  PLAYER_LOOKS.forEach(function (lk, i) { art3.look('look' + i, lk.parts); });
  CREW.forEach(function (c) { art3.look(c.who, c.parts); });
  Object.keys(GUEST_LOOKS).forEach(function (who) { art3.look(who, GUEST_LOOKS[who]); });
}

function frameAt(t) {
  const g = ctx;
  const items = [];
  let order = 0;
  function push(k, l, x, fn) { items.push({ k: k, l: l, x: x, o: order++, fn: fn }); }
  const over = { bubbles: [] }, heads = [];
  const props = TABLES.map(function (T) { return tableProp(T.ax, T.ay); }).concat([counterProp(COUNTER)]);

  g.setTransform(1, 0, 0, 1, 0, 0);
  g.imageSmoothingEnabled = false;
  g.fillStyle = A.K; g.fillRect(0, 0, CW, CHT);
  drawHud(g, t);
  g.save();
  g.beginPath(); g.rect(0, HUD_H, CW, HEAD + art3.VH); g.clip();
  g.translate(0, WORLD_Y);

  // backdrop, ground, back walls (the barn wall and the back left fence stand behind everything)
  yard.draw(g, 'backdrop', 0, -64, 0);
  art3.ground(g, MAP, GROUND);
  const fp = yard.placeTile('fence_diag', 4, 0); yard.draw(g, 'fence_diag', fp.x, fp.y, 0);
  const bp = yard.placeTile('wall_barn', 4, 0); yard.draw(g, 'wall_barn', bp.x, bp.y, 0);

  // ground pass: cast shadows
  TABLES.forEach(function (T) { yard.drawAt(g, 'picnic', T.ax, T.ay, 1); });
  KIT.forEach(function (it) { kit.drawShadow(g, it.name, it.ax, it.ay); });

  // posts, sign, light string (sorted with the back posts; it hangs high overhead)
  push(POST_L.y, 0, POST_L.x, function () { yard.drawAt(g, 'lights_post', POST_L.x, POST_L.y, 0); });
  push(SIGN_POST.y, 0, SIGN_POST.x, function () {
    const a = yard.anchor('sign'), x = SIGN_POST.x - a.ax, y = SIGN_POST.y - a.ay;
    yard.draw(g, 'sign', x, y, 1); art3.signText(g, SIGN_TEXT, x, y);
  });
  const hookL = { x: POST_L.x + yard.LIGHT_HOOK.x - 16, y: POST_L.y + yard.LIGHT_HOOK.y - 30 };
  const sa = yard.anchor('sign'), hookR = yard.signHook(SIGN_POST.x - sa.ax, SIGN_POST.y - sa.ay);
  push(Math.min(POST_L.y, SIGN_POST.y) - 0.5, 0, 0, function () {
    yard.lightsString(g, hookL.x + 4, hookL.y, hookR.x, hookR.y, 22, reduce && reduce.matches ? 0 : Math.floor(t / 1000) % 2);
  });

  // kit (the serving table carries its plates)
  KIT.forEach(function (it) {
    push(it.ay, 0, it.ax, function () {
      kit.drawAt(g, it.name, it.ax, it.ay, it.frame);
      if (it === COUNTER) {
        const a = kit.anchor(it.name), slots = kit.slots(it.name);
        COUNTER_PLATES.forEach(function (cp) {
          const s = slots[cp[0]];
          kit.drawAt(g, 'plate_' + cp[1], it.ax - a.ax + s[0], it.ay - a.ay + s[1], 0);
        });
      }
    });
  });

  // tree trunk, flower box
  push(TREE.y, 0, TREE.x, function () { yard.drawAt(g, 'tree_trunk', TREE.x, TREE.y, 0); });
  push(FLOWERS.y, 0, FLOWERS.x, function () { yard.drawAt(g, 'flower_box', FLOWERS.x, FLOWERS.y, 0); });

  // picnic tables with their guests
  TABLES.forEach(function (T) { pushTable(push, g, T, t, over, heads); });

  // the line at the serving table
  QUEUE.forEach(function (q, i) {
    art3.drawPersonShadow(g, q.x, q.y);
    const f = art3.people.clipFrame(q.pose, 'idle', t + i * 700, q.who);
    push(walkerKey(props, q.x, q.y), 0, q.x, function () { art3.drawPerson(g, q.who, q.pose, f, q.x, q.y, q.flip); });
    heads.push({ x: q.x - 13, y: headTop(q.y), w: 26, h: 26, owner: q.who });
    if (q.want) over.bubbles.push({ x: q.x, headTop: headTop(q.y), meat: q.want });
  });

  // pitmaster
  const pm = along(PLAYER_PATH, t);
  const pPose = poseFor(pm.dir, false);
  const pFrame = pm.moving ? art3.people.clipFrame(pPose, 'walk', t) : art3.people.clipFrame(pPose, 'idle', t, 'player');
  art3.drawPersonShadow(g, pm.x, pm.y);
  push(walkerKey(props, pm.x, pm.y), 0, pm.x, function () { art3.drawPerson(g, 'player', pPose, pFrame, pm.x, pm.y, pm.dir === 'right'); });
  heads.push({ x: pm.x - 13, y: headTop(pm.y) - 3, w: 26, h: 28, owner: 'player' });

  // runner with two platters on the stepping stones
  const rn = along(RUN_PATH, t);
  const rPose = poseFor(rn.dir, true), rFlip = rn.dir === 'right';
  const rFrame = rn.moving ? art3.people.clipFrame(rPose, 'walk', t) : art3.people.clipFrame(rPose, 'idle', t, 'crew2');
  art3.drawPersonShadow(g, rn.x, rn.y);
  push(walkerKey(props, rn.x, rn.y), 0, rn.x, function () {
    art3.drawPerson(g, 'crew2', rPose, rFrame, rn.x, rn.y, rFlip);
    const hands = art3.personHands('crew2', rPose, rFrame, rFlip);
    kit.drawAt(g, 'platter_brisket', rn.x + hands[0].x - 2, rn.y + hands[0].y - 1, 0);
    kit.drawAt(g, 'platter_chicken', rn.x + hands[1].x + 2, rn.y + hands[1].y - 1, 0);
  });
  heads.push({ x: rn.x - 13, y: headTop(rn.y), w: 26, h: 26, owner: 'crew2' });

  // the dog trails the pitmaster and sits when it catches up
  const dg = along(PLAYER_PATH, t - 1500);
  const dx = dg.x + (dg.moving ? 0 : (pm.x >= dg.x ? -16 : 16)), dy = dg.y + 4;
  const dFrame = dg.moving ? Math.floor(t / 125) % 4 : 4;
  const dFlip = dg.moving ? dg.dir === 'right' : pm.x > dx;
  push(walkerKey(props, dx, dy), 0, dx, function () { yard.drawAt(g, 'dog', dx, dy, dFrame, dFlip); });

  art3.ysort(items);
  for (let i = 0; i < items.length; i++) items[i].fn();

  // overhead: canopy and smoke, then every mark after every world sprite
  yard.drawAt(g, 'tree_canopy', TREE.x, TREE.y, 0);
  smoke(g, t);
  drawMarks(g, t, over, heads, pm);
  g.restore();
  drawDock(g, DOCK_Y);
}

// The dish dock: an umber tray under the yard with four dish cards, the active one raised and
// ringed (kit.dishCard: plated meat at card size, labels in the pixel font).
function drawDock(g, y0) {
  g.fillStyle = A.U; g.fillRect(0, y0, CW, DOCK_H);
  g.fillStyle = A.O; g.fillRect(0, y0, CW, 2);
  g.fillStyle = UI.tray; g.fillRect(0, y0 + 2, CW, 1);
  const BW = 74, BH = 80, gap = (CW - 4 * BW) / 5;
  DOCK_DISHES.forEach(function (m, k) {
    kit.dishCard(g, Math.round(gap + k * (BW + gap)), y0 + 14, BW, BH, m, { selected: k === 0 });
  });
}

// Bubbles, hearts, sparkles and floating numbers: always the last thing drawn, inside the canvas.
function drawMarks(g, t, over, heads, pm) {
  const spots = fx.placeBubbles(over.bubbles, heads, { x0: 0, x1: CW });
  spots.forEach(function (s, i) { fx.bubbleAt(g, s.tipX, s.tipY, s.dx, over.bubbles[i].meat, 'done'); });
  const T0 = TABLES[0], h0 = yard.PICNIC.far[0], hx = T0.ax + h0.dx, hy = headTop(T0.ay + h0.dy, true);
  const bob = Math.floor(t / 300) % 2;
  fx.drawAt(g, 'heart', hx + 1, hy - 3 - bob, bob);
  fx.drawAt(g, 'sparkle', hx - 10, hy - 6, Math.floor(t / 200) % 3);
  fx.drawAt(g, 'sparkle', hx + 12, hy - 12, (Math.floor(t / 200) + 1) % 3);
  const rise = reduce && reduce.matches ? 0 : Math.floor((t % 1600) / 160);
  // round 2: the tip follows the pitmaster across the patio but floats in the clear band between
  // the light string (world y about 0 to 10) and the serving table's back edge, right of the kettle
  // smoke: x from 118 to 176, '+2 TIP' at y 14, '+8' under it. No light prop is ever behind it.
  const tx = Math.max(118, Math.min(176, pm.x + 10)), ty = 14 - rise;
  art3.floatNum(g, '+2 TIP', tx, ty, 'tip', { clamp: [0, CW] });
  art3.floatNum(g, '+8', tx + 18, ty + 16, 'cash', { clamp: [0, CW] });
}

// Drum: mock B's tall column at the vent. Kettle: the short straight column from the lid vent.
function smoke(g, t) {
  const drum = KIT[0], kettle = KIT[2];
  const dv = vents.drum, kv = vents.kettle;
  g.globalAlpha = 0.9;
  fx.drawAt(g, 'smoke_column', drum.ax + dv.dx, drum.ay + dv.dy + 2, Math.floor(t / 166) % 3);
  fx.drawAt(g, 'smoke_column_short', kettle.ax + kv.dx, kettle.ay + kv.dy + 2, (Math.floor(t / 166) + 1) % 3);
  g.globalAlpha = 1;
}

/* ================================================================ evidence strips */
// Strip 1, z-order: one walker (Deon) at three depths round a picnic table and round the serving
// table: behind (partly hidden), at the end overlapping the prop, and in front. Same sort as the scene.
function zStrip(g, kind) {
  const W = CW, H = 150, OY = 60;
  g.fillStyle = A.K; g.fillRect(0, 0, W, H);
  art3.ground(g, MAP, { iso: { corner: [176, -400], vertex: [176, -300], stones: [] } });
  g.save();
  g.translate(0, OY);
  const items = []; let order = 0;
  const push = function (k, l, x, fn) { items.push({ k: k, l: l, x: x, o: order++, fn: fn }); };
  let props, spots;
  if (kind === 'table') {
    const T = { ax: 176, ay: 70, far: ['cust0', 'cust1'], near: ['cust5'], plates: { far: ['ribs', 'sausage'], near: ['brisket'] }, eat: {} };
    yard.drawAt(g, 'picnic', T.ax, T.ay, 1);
    pushTable(push, g, T, 1200, { bubbles: [] }, []);
    props = [tableProp(T.ax, T.ay)];
    spots = [[222, -6, 'BEHIND'], [242, 50, 'OVERLAP'], [116, 86, 'IN FRONT']];
  } else {
    const c = { name: 'counter_long', ax: 0, ay: 0 }, a = kit.anchor('counter_long');
    const B = [196, -14], F = [B[0] + 20 - 76, B[1] + 48];
    c.ax = F[0] - 21 + a.ax; c.ay = F[1];
    kit.drawShadow(g, c.name, c.ax, c.ay);
    push(c.ay, 0, c.ax, function () {
      kit.drawAt(g, c.name, c.ax, c.ay, 0);
      const slots = kit.slots(c.name);
      [[0, 'sausage'], [2, 'ribs'], [4, 'brisket']].forEach(function (cp) { kit.drawAt(g, 'plate_' + cp[1], c.ax - a.ax + slots[cp[0]][0], c.ay - a.ay + slots[cp[0]][1], 0); });
    });
    props = [counterProp(c)];
    spots = [[176, -16, 'BEHIND'], [214, 30, 'OVERLAP'], [120, 62, 'IN FRONT']];
  }
  spots.forEach(function (s, i) {
    art3.drawPersonShadow(g, s[0], s[1]);
    push(walkerKey(props, s[0], s[1]), 0, s[0], function () { art3.drawPerson(g, 'crew2', i === 2 ? 'down' : 'side', 0, s[0], s[1], i === 1); });
  });
  art3.ysort(items);
  items.forEach(function (it) { it.fn(); });
  g.restore();
  spots.forEach(function (s) {
    const tw = art3.textWidth(s[2], { bold: true });
    const x = Math.max(2, Math.min(W - tw - 4, s[0] + 16));
    const y = Math.max(14, Math.min(H - 10, OY + s[1] - 26));
    g.fillStyle = A.K; g.fillRect(x - 2, y - 2, tw + 5, 11);
    art3.text(g, s[2], x, y, UI.gold, { bold: true });
  });
  art3.text(g, kind === 'table' ? 'Z ORDER: PICNIC TABLE' : 'Z ORDER: SERVING TABLE', 4, 3, A.C, { bold: true, shadow: 'K' });
}
// Strip 2: the three look presets as full figures, 2x, side by side.
function looksStrip(g) {
  const W = CW, H = 124;
  g.fillStyle = A.U; g.fillRect(0, 0, W, H);
  g.fillStyle = R.paver.base; g.fillRect(0, 102, W, 22);
  g.fillStyle = R.paver.dark; g.fillRect(0, 102, W, 1);
  art3.text(g, 'LOOK PRESETS', 4, 3, A.C, { bold: true, shadow: 'K' });
  PLAYER_LOOKS.forEach(function (lk, i) {
    const cx = Math.round(W * (i + 0.5) / 3);
    const c = document.createElement('canvas'); c.width = 32; c.height = 48;
    const cg = c.getContext('2d'); cg.imageSmoothingEnabled = false;
    art3.drawPerson(cg, 'look' + i, 'down', 0, 16, 48);
    g.save(); g.imageSmoothingEnabled = false;
    g.globalAlpha = 0.28; g.fillStyle = A.K; g.fillRect(cx - 26, 102, 52, 4); g.globalAlpha = 1;
    g.drawImage(c, cx - 32, 10, 64, 96);
    g.restore();
    const name = lk.label.toUpperCase(), tw = art3.textWidth(name, { bold: true });
    art3.text(g, name, cx - Math.round(tw / 2), 111, A.K, { bold: true });
  });
}

/* ================================================================ DOM: canvas, toggles, cards */
function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}
// A canvas of w by h art px shown at about cssPerPx CSS px each (never more than maxCss), backed
// at an integer device scale so every art px is a whole block of device px.
function pixelCanvas(w, h, cssPerPx, paint, maxCss) {
  const dpr = window.devicePixelRatio || 1;
  let k = Math.max(1, Math.round(cssPerPx * dpr));
  if (maxCss) k = Math.max(1, Math.min(k, Math.floor(maxCss * dpr)));
  const c = document.createElement('canvas');
  c.width = w * k; c.height = h * k;
  c.style.width = (w * k / dpr) + 'px'; c.style.height = (h * k / dpr) + 'px';
  const g = c.getContext('2d');
  g.imageSmoothingEnabled = false;
  g.scale(k, k);
  paint(g);
  return c;
}
function label(str, color, cssPerPx, opts) {
  const o = opts || {};
  const w = art3.textWidth(str, { bold: o.bold }) + 2, h = 9;
  const c = pixelCanvas(w, h, cssPerPx, function (g) { art3.text(g, str, 0, 0, color, { bold: o.bold, shadow: o.shadow }); });
  c.setAttribute('aria-hidden', 'true');
  return c;
}
function starsCanvas(n, cssPerPx) {
  return pixelCanvas(5 * 8, 7, cssPerPx, function (g) {
    for (let k = 0; k < 5; k++) {
      const full = k + 1 <= n, half = !full && k + 0.5 <= n;
      for (let r = 0; r < STAR.length; r++) for (let c = 0; c < 7; c++) {
        if (STAR[r][c] !== '#') continue;
        g.fillStyle = full || (half && c < 4) ? UI.gold : UI.starOff;
        g.fillRect(k * 8 + c, r, 1, 1);
      }
    }
  });
}
function crewCard(c) {
  const card = el('div', 'card role-' + c.role.toLowerCase());
  card.setAttribute('role', 'listitem');
  card.appendChild(el('span', 'sr', c.name + ', ' + c.role + ', ' + c.stars + ' stars, wage ' + c.wage));
  const win = el('div', 'win');
  const bust = pixelCanvas(32, 32, 2.5, function (g) { g.drawImage(art3.portrait(c.who), 0, 0); }, 2.6);
  bust.className = 'bust';
  bust.setAttribute('aria-hidden', 'true');
  win.appendChild(bust);
  const badge = el('div', 'badge');
  badge.appendChild(label(c.role, UI.white, 2, { bold: true }));
  win.appendChild(badge);
  if (c.rookie) {
    const rk = el('div', 'rookie');
    rk.appendChild(label('R', UI.gold, 2, { bold: true }));
    win.appendChild(rk);
  }
  card.appendChild(win);
  const info = el('div', 'info');
  const nm = el('div', 'name');
  nm.appendChild(label(c.name, UI.white, 2, { bold: true, shadow: 'K' }));
  info.appendChild(nm);
  const stars = el('div', 'stars');
  stars.appendChild(starsCanvas(c.stars, 2));
  info.appendChild(stars);
  const wage = el('div', 'wage');
  wage.appendChild(label('WAGE', UI.blueL, 1.5, { bold: true, shadow: 'K' }));
  wage.appendChild(pixelCanvas(14, 14, 1, function (g) { fx.drawAt(g, 'coin', 7, 14, 0); }));
  wage.appendChild(label(String(c.wage), UI.goldL, 2, { bold: true, shadow: 'K' }));
  info.appendChild(wage);
  card.appendChild(info);
  return card;
}

function sizeCanvas() {
  const dpr = window.devicePixelRatio || 1;
  const sc = art3.scaleFor(document.documentElement.clientWidth || window.innerWidth, dpr);
  [canvas].concat(strips).forEach(function (c) {
    c.style.width = (c.width * sc.k / dpr) + 'px';
    c.style.height = (c.height * sc.k / dpr) + 'px';
  });
}

let raf = 0;
const strips = [];
function loop(now) {
  frameAt(Math.max(0, now - start));
  raf = window.requestAnimationFrame(loop);
}
function run() {
  if (raf) { window.cancelAnimationFrame(raf); raf = 0; }
  if (reduce && reduce.matches) frameAt(1200);
  else raf = window.requestAnimationFrame(loop);
}
function stripCanvas(h, paint, labelText) {
  const c = el('canvas', 'yard strip');
  c.width = CW; c.height = h;
  c.setAttribute('role', 'img');
  c.setAttribute('aria-label', labelText);
  const g = c.getContext('2d');
  g.imageSmoothingEnabled = false;
  paint(g);
  strips.push(c);
  return c;
}

function boot() {
  const root = document.getElementById('proof');
  const m = /look=(\d)/.exec(window.location.hash || '');
  if (m && PLAYER_LOOKS[+m[1]]) playerLook = +m[1];
  // The main canvas first: the browser's first draw into a large canvas sets up its raster
  // context (about 400 ms in a fresh headless profile). Paying it here keeps that browser cost
  // out of the build() timing; the game pays it on its own first frame either way.
  canvas = el('canvas', 'yard');
  canvas.width = CW; canvas.height = CHT;
  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label', 'The backyard pit in the v3 look on the iso angle: barn wall, patio with the smokers and the serving table, lawn with three picnic tables, and the dish dock with sausage, chicken, ribs and brisket');
  ctx = canvas.getContext('2d');
  const tc = performance.now();
  ctx.fillStyle = A.K; ctx.fillRect(0, 0, CW, CHT);
  const canvasInit = performance.now() - tc;
  root.appendChild(canvas);

  const t0 = performance.now();
  registerLooks();
  const rep = art3.build();
  const total = performance.now() - t0;
  vents = { kettle: ventOf('kettle', 2), drum: ventOf('drum', 2) };

  const bar = el('div', 'toggles');
  bar.setAttribute('role', 'group');
  bar.setAttribute('aria-label', 'Pitmaster look');
  // round 2: labels in the pixel font (cream on umber, white on orange when pressed)
  function paintTog(b, lk, on) {
    b.textContent = '';
    b.appendChild(label(lk.label.toUpperCase(), on ? UI.white : A.C, 1.5, { bold: true, shadow: 'K' }));
    b.setAttribute('aria-pressed', on ? 'true' : 'false');
  }
  const buttons = PLAYER_LOOKS.map(function (lk, i) {
    const b = el('button', 'tog');
    b.type = 'button';
    b.setAttribute('aria-label', lk.label);
    paintTog(b, lk, i === playerLook);
    b.addEventListener('click', function () {
      playerLook = i;
      art3.look('player', lk.parts);
      buttons.forEach(function (o, j) { paintTog(o, PLAYER_LOOKS[j], j === i); });
      if (reduce && reduce.matches) frameAt(1200);
      try { window.history.replaceState(null, '', '#look=' + i); } catch (e) { /* file: pages may refuse */ }
    });
    bar.appendChild(b);
    return b;
  });
  root.appendChild(bar);

  const stats = el('p', 'stats', 'build ' + rep.ms + ' ms (kit ' + rep.parts.kit + ', yard ' + rep.parts.yard + ', fx ' + rep.parts.fx +
    ', people ' + rep.parts.people + ' for ' + rep.looks + ' looks), ' + rep.names + ' world sprites, ' + rep.frames + ' frames; first canvas fill ' + Math.round(canvasInit) + ' ms');
  stats.id = 'stats';
  root.appendChild(stats);

  root.appendChild(stripCanvas(150, function (g) { zStrip(g, 'table'); }, 'Z order: one walker behind, overlapping and in front of a picnic table'));
  root.appendChild(stripCanvas(150, function (g) { zStrip(g, 'counter'); }, 'Z order: one walker behind, overlapping and in front of the serving table'));
  root.appendChild(stripCanvas(124, looksStrip, 'The three pitmaster look presets as full figures: cap, cowboy hat, bandana'));

  const strip = el('div', 'crew');
  strip.setAttribute('role', 'list');
  strip.setAttribute('aria-label', 'Crew cards');
  CREW.forEach(function (c) { strip.appendChild(crewCard(c)); });
  root.appendChild(strip);

  sizeCanvas();
  window.addEventListener('resize', sizeCanvas);
  window.PitSimProof = { report: rep, bootMs: total, canvasInitMs: canvasInit, frameAt: function (t) { frameAt(t); } };
  start = performance.now();
  run();
  if (reduce && reduce.addEventListener) reduce.addEventListener('change', run);
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
else boot();
})();
