'use strict';
/*
 * games/pit-sim/sprites.js  (Art builder, v3.1)
 * Attaches PitSim.art as defined in docs/superpowers/specs/2026-10-18-pit-sim-contract.md,
 * section 3 as amended by the v2 delta D11, with the rules of [V2.10] (palette) and
 * [V2.11] (sprites) of docs/superpowers/specs/2026-10-18-pit-sim-design.md, and for v2.1 the
 * contract section K9 with section 4 of docs/superpowers/specs/2026-10-18-pit-sim-v2-1-tutorial.md.
 *
 * Deviations
 * - build() pre-renders a mirrored canvas for every frame, plus one tinted font strip per COLOR
 *   key, so draw(..., flip), drawScaled(..., flip) and textTinted() never create a canvas
 *   outside build() and canvasFor() (section 3.1 keeps DOM use to those two; v3.0 W16.3 adds
 *   setLook() and uiText(), which make canvases too).
 * - textTinted() with a colorKey that is not in COLOR throws an Error naming it, the same way
 *   draw() treats an unknown sprite name. drawScaled() with w or h under 1 draws nothing.
 * - drawScaled() saves and restores ctx.imageSmoothingEnabled around its one drawImage call.
 * - Review round 1 (2026-10-18, now contract D11): two names added, 113 in all. fence_back (16x16,
 *   frame 0 rail, frame 1 corner) is the back fence row drawn inside the canvas; shelf (16x24) is the
 *   sauce rack prop. The drum is painted red with a highlight stripe, the empty board carries a
 *   cleaver and a leg crossbar (the busy frame stamps its meat on the plain board, since the
 *   cleaver is in the player's hand then), and the napping dog curls its head at the right end.
 * - Review round 2 (2026-10-18, now contract D11): no names added, two frames. hedge gains frame 1
 *   (pink and yellow blossoms on the lit top); bed gains frame 3 (an unplanted bed: the same box
 *   with tilled soil, no flowers). cooler frame 0 is repainted as a small red cooler with a white
 *   lid and a white band, so it reads as the meat cooler on day 1; frames 1 and 2 stay the blue
 *   gear cooler. 113 names, 268 frames.
 * - v2.1 (2026-10-18, late, contract K9): pile (16x16, 4 frames) and hand_charcoal (8x8) are
 *   redrawn in place as black pillow briquettes beside a paper sack, and a scoop of briquettes;
 *   piece_* gain frame 4 (about to burn); font gains frames 38 "." and 39 ","; arrow (8x12, 4)
 *   and bubble_warn (8x10, 2) are new. 115 names, 281 frames. No palette entry, no charcoal icon.
 *   Two choices inside the rules of [T 4]: the pile's shadow row is a checker of paverD and
 *   outline brown (paverD alone vanishes into the paver joint row the pile sits on), and the low
 *   frame's sack slumps four rows so the four frames read apart at a glance.
 *   Piece frame 4 also paints the inner shade cells outline brown and the light cells done red, so
 *   the char reads along the bottom right as well; bones and the brisket fat cap stay cream.
 * - v3.0 (2026-10-18, night, contract docs/superpowers/specs/2026-10-18-pit-sim-v3-0-contract.md
 *   W16): palette 36 (w x y z skin tones), legend 0-9 a-z; font gains ' and - (42 frames); sign is
 *   62x12 with posts at x 7 and 53; new font_s (3x5, 42), ev_birthday, ev_picnic, ev_yard,
 *   ev_finale, star, flame, check. 123 names, 334 frames. The pitmaster is composed from a Look
 *   (W16.4): setLook(), lookKey(), LOOK, plus textWidthS(), textFit() and uiText().
 *   v3.0 deviations, all inside the art's own freedom:
 *   - Hair shade G is not in the W16.4 swap table (H and J only). The player's G is derived from the
 *     hair color inside this file (HAIR_SHADE: 1 1 5 6 r t), so blond and gray hair get a brown and
 *     a steel shade instead of v2's near black. art.LOOK still holds exactly the W16.4 tables.
 *   - Hat templates use the authoring symbol K for "keep the head's pixel" on rows the hat does not
 *     cover (the bandana keeps row 5, so the hair style shows under the band). Cap and cowboy hat
 *     replace rows 0 to 5 outright, as W16.4 says.
 *   - Every hair template ends its bangs with a stippled G fringe on row 5, so hair reads apart
 *     from a skin tone of the same lightness (blond on skin tone 3). With a cap or cowboy hat on,
 *     rows 0 to 5 are the hat's, so the default pitmaster's head is v2's pixel for pixel; only
 *     the apron differs (red, W4.3). The buddy, tender and customers are unchanged.
 *   - The mustache sits on row 10 with the mouth moved to row 11 as a toothy grin (G corners,
 *     white teeth), so it reads as a mustache over a smile rather than a second mouth.
 *   - Curly hair puffs out one column past the head outline (columns 1 and 14); a cap or cowboy
 *     hat still sits on rows 0 to 5 and the puffs show below the brim.
 *   - The side view glasses carry a one pixel arm back to the ear (columns 6 and 7, row 8) and the
 *     side beard runs along the jaw to column 9; both sit outside the 4 by 5 side patch of W16.4,
 *     which alone read as a monocle and a goatee at 2x.
 * - Playtest round 3 (2026-10-19, contract W26, Overseer's calls):
 *   - Q-1. The Blue apron (index 3, cloth f and clothD g) is the shirt's own two colors, so it
 *     vanished. The palette is full (36 entries, lowercase legend only, W21 item 13), so lookMap
 *     paints the shirt cream (T 3, V white h, U paverD a) when the Blue apron is on; every other
 *     apron keeps the blue shirt (T g, V f, U t). art.LOOK's apron row is unchanged for Blue.
 *   - Q-2. The Charcoal apron's body is smokeD v (was steelD t), so it can never merge with the
 *     shirt's shade column U t; its shade stays U 2.
 *   - uiText() rounds scale * dpr to a whole number of device pixels per font pixel (at least 1),
 *     so a fractional dpr (Android 2.625) still lands every font pixel on the device grid.
 * - v3.1 (2026-10-19, contract docs/superpowers/specs/2026-10-19-pit-sim-v3-1-contract.md X12): star
 *   grows to 4 frames (2 half, 3 hollow); new mood (10x10, 5 frames), prep_down/up/side and
 *   prep_slice on PREP_DEFAULT_LOOK. 128 names, 352 frames, palette still 36. New art members
 *   setCrewLook(), crewKey(), bustRows(), portrait() and CREW_OUTFIT. build() keeps v2's buddy and
 *   tender grids until the first setCrewLook. v3.1 deviations, all inside the art's own freedom:
 *   - The RUN bust's name tag has a top band in the look's apron color, so the apron swatch shows on
 *     every role's card (the in-yard RUN sprite has no apron, as X12.3 says). FIRE shows it as the
 *     apron, PREP as the neckerchief.
 *   - CREW_OUTFIT also carries the legs (L N Z) per role, and FIRE's cream shirt for the Red apron as
 *     T2 V2 U2; values are palette characters only.
 *   - The bust's face is one fixed calm expression for every mood (mood is the badge). Eye whites are
 *     drawn for skin tones 5 and 6 only, as in the mock, so the pupils read on the deep tones.
 *   - Every hair style leaves pixels below the hat line (sideburns, side puffs, strands or a ring), and
 *     the bun's knot is drawn after the hat on empty cells, so each style reads under a cap or bandana.
 *   - Bust glasses are round rims with smokeL lenses and a white glint (rims alone read as sunglasses).
 *   - The shirt's light tone is a rim along the left shoulder, not the mock's two columns (which read
 *     as stripes with a white light tone).
 *   - setCrewLook keeps up to 24 built looks per role (grids and canvases), so a drawing site can call
 *     it every frame: the same key returns at once, a known key swaps canvases with no render. An
 *     unknown role throws, the way draw() treats an unknown sprite; crewKey of one returns ''.
 *   - mood frames: a light pixel top left and a shade arc bottom right in the face's own ramp (yellow
 *     k h 8, orange 4 8 r, red o p r); the fired up grin has white teeth over a red tongue.
 * - Review round 1 (2026-10-19, contract X20.8, Overseer's call): a crew card's cap takes one of four
 *   ramps by look.apron % 4 (CAP_RAMPS: rust, navy, forest, grey; palette characters only) on the
 *   bust and in the yard, so a grid of capped cards no longer reads as one uniform; the player's
 *   own cap stays rust. Under a cap, long hair shows only from bust row 7 down, so the strands never
 *   run up beside the cap like a hood. How often a crew look wears a hat is sim.js's (C.HAT_SHARE).
 * Nothing else is added to the shared surface: PitSim.art only.
 *
 * LEGEND (W16.1): one character per pixel, the palette index in base 36, lowercase only.
 *   0 transparent   1 K #1b1714       2 U #2a2015       3 C #E6D8B8       4 O #D06129
 *   5 outline       6 woodD           7 woodM           8 woodL           9 paver
 *   a paverD        b lawnA           c lawnB           d leafD           e leafL
 *   f cloth         g clothD          h white           i pink            j magenta
 *   k yellow        l skinL           m skinM           n skinD           o red
 *   p raw           q cooking         r done            s steelL          t steelD
 *   u smokeL        v smokeD          w skinPale        x skinTan         y skinTanD
 *   z skinDeep
 *
 * Authoring: grids below are written in those characters plus '.' for transparent. Some
 * templates use uppercase symbols (people, meat, fire cells, font) that paint() swaps for
 * palette characters before a grid is stored; uppercase can never collide with the legend.
 * Light comes from the top left everywhere: light edge top left, shade bottom right, dark
 * brown outline (5) around wood, props and people, near black (1) for eyes and soot.
 * Every sprite is anchored bottom left: its feet or base sit on its bottom rows.
 */
(function () {
const PitSim = globalThis.PitSim || (globalThis.PitSim = {});

/* ------------------------------------------------------------------ palette */

const PALETTE = Object.freeze([
  '',        //  0 transparent
  '#1b1714', //  1 K
  '#2a2015', //  2 U
  '#E6D8B8', //  3 C
  '#D06129', //  4 O
  '#3b2417', //  5 outline
  '#7a4a26', //  6 woodD
  '#a8693a', //  7 woodM
  '#d79a5b', //  8 woodL
  '#e8c890', //  9 paver
  '#c9a46b', //  a paverD
  '#6cc24a', //  b lawnA
  '#4fa83d', //  c lawnB
  '#2f7a32', //  d leafD
  '#a6e05a', //  e leafL
  '#5bb8f0', //  f cloth
  '#3a86c8', //  g clothD
  '#fbf7ef', //  h white
  '#f27aa8', //  i pink
  '#d94a8c', //  j magenta
  '#ffd84a', //  k yellow
  '#f6c49a', //  l skinL
  '#d9935f', //  m skinM
  '#8f5634', //  n skinD
  '#d8402f', //  o red
  '#f29a9a', //  p raw
  '#d0663e', //  q cooking
  '#8e3b1f', //  r done
  '#9aa4ae', //  s steelL
  '#4d5560', //  t steelD
  '#ddd8cf', //  u smokeL
  '#6e6863', //  v smokeD
  '#f7d9c4', //  w skinPale (v3.0)
  '#b87a4b', //  x skinTan
  '#714227', //  y skinTanD
  '#5f3a25'  //  z skinDeep
]);
const CHARS = '0123456789abcdefghijklmnopqrstuvwxyz';
const KEYS = ['', 'K', 'U', 'C', 'O', 'outline', 'woodD', 'woodM', 'woodL', 'paver', 'paverD',
  'lawnA', 'lawnB', 'leafD', 'leafL', 'cloth', 'clothD', 'white', 'pink', 'magenta', 'yellow',
  'skinL', 'skinM', 'skinD', 'red', 'raw', 'cooking', 'done', 'steelL', 'steelD', 'smokeL', 'smokeD',
  'skinPale', 'skinTan', 'skinTanD', 'skinDeep'];
const COLOR = {};
for (let i = 1; i < KEYS.length; i++) COLOR[KEYS[i]] = PALETTE[i];
Object.freeze(COLOR);

/* ------------------------------------------------------------------ helpers */

// Swap authoring symbols for palette characters. '.' becomes '0'. Palette characters pass
// through unless `map` names them. Anything else is an authoring error and throws at load.
function paint(rows, map) {
  map = map || {};
  return rows.map(function (row) {
    let out = '';
    for (let i = 0; i < row.length; i++) {
      const ch = row[i];
      if (Object.prototype.hasOwnProperty.call(map, ch)) out += map[ch];
      else if (ch === '.') out += '0';
      else if (CHARS.indexOf(ch) >= 0) out += ch;
      else throw new Error('sprites: unmapped symbol "' + ch + '" in row "' + row + '"');
    }
    return out;
  });
}

// Overlay `over` onto `base` at (dx, dy); '0' and '.' in `over` leave the base alone.
function stamp(base, over, dx, dy) {
  const out = base.slice();
  for (let j = 0; j < over.length; j++) {
    const y = dy + j;
    if (y < 0 || y >= out.length) continue;
    const row = out[y].split('');
    for (let i = 0; i < over[j].length; i++) {
      const x = dx + i;
      if (x < 0 || x >= row.length) continue;
      const ch = over[j][i];
      if (ch === '0' || ch === '.') continue;
      row[x] = ch;
    }
    out[y] = row.join('');
  }
  return out;
}

// Replace whole rows: patch(rows, { 7: '....', 9: '....' }).
function patch(rows, byIndex) {
  const out = rows.slice();
  Object.keys(byIndex).forEach(function (k) { out[Number(k)] = byIndex[k]; });
  return out;
}

// Swap characters cell by cell: recolor(rows, { a: 'b' }).
function recolor(rows, map) {
  return rows.map(function (r) {
    let s = '';
    for (let i = 0; i < r.length; i++) s += Object.prototype.hasOwnProperty.call(map, r[i]) ? map[r[i]] : r[i];
    return s;
  });
}

function hflip(rows) {
  return rows.map(function (r) { return r.split('').reverse().join(''); });
}

function blank(w, h) {
  const row = '0'.repeat(w);
  const out = [];
  for (let i = 0; i < h; i++) out.push(row);
  return out;
}

// Small procedural painter for tiles and props that are mostly fills plus shapes.
function Grid(w, h, fill) {
  this.w = w; this.h = h; this.rows = [];
  for (let y = 0; y < h; y++) this.rows.push(new Array(w).fill(fill || '0'));
}
Grid.prototype.set = function (x, y, c) {
  if (x >= 0 && y >= 0 && x < this.w && y < this.h) this.rows[y][x] = c;
  return this;
};
Grid.prototype.get = function (x, y) {
  return (x >= 0 && y >= 0 && x < this.w && y < this.h) ? this.rows[y][x] : '0';
};
Grid.prototype.rect = function (x, y, w, h, c) {
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, c);
  return this;
};
Grid.prototype.stamp = function (rows, dx, dy) {
  for (let j = 0; j < rows.length; j++) {
    for (let i = 0; i < rows[j].length; i++) {
      const ch = rows[j][i];
      if (ch !== '0' && ch !== '.') this.set(dx + i, dy + j, ch);
    }
  }
  return this;
};
// Filled ellipse inside the box (x, y, w, h).
Grid.prototype.ellipse = function (x, y, w, h, c) {
  const cx = x + (w - 1) / 2, cy = y + (h - 1) / 2, rx = w / 2, ry = h / 2;
  for (let j = y; j < y + h; j++) {
    for (let i = x; i < x + w; i++) {
      const dx = (i - cx) / rx, dy = (j - cy) / ry;
      if (dx * dx + dy * dy <= 1.0) this.set(i, j, c);
    }
  }
  return this;
};
// Wrap every opaque region in a 1 px outline of `c` (4 connected), on transparent cells only.
Grid.prototype.outline = function (c) {
  const self = this;
  const add = [];
  function solid(x, y) { const v = self.get(x, y); return v !== '0' && v !== c; }
  for (let y = 0; y < this.h; y++) {
    for (let x = 0; x < this.w; x++) {
      if (this.rows[y][x] !== '0') continue;
      if (solid(x - 1, y) || solid(x + 1, y) || solid(x, y - 1) || solid(x, y + 1)) add.push([x, y]);
    }
  }
  add.forEach(function (p) { self.rows[p[1]][p[0]] = c; });
  return this;
};
Grid.prototype.done = function () {
  return this.rows.map(function (r) { return r.join(''); });
};

// Deterministic texture scatter (this file never calls Math.random).
function hash(x, y, s) {
  let n = (Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(s || 0, 982451653)) | 0;
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}

function sprite(w, h, frames) { return { w: w, h: h, frames: frames }; }

/* ------------------------------------------------------------------ people (16x24) */
/*
 * Person symbols (painted per role by PEOPLE below):
 *   O outline   H hair   J hair light   G hair shade   S skin   R skin shade   P cheek
 *   M mouth     E eye    W eye white    T shirt   V shirt light   U shirt shade
 *   A apron     B apron shade   L pants   N pants shade   Z shoes
 *   C cap or hat   F cap light   D cap shade   X fork or blade   Y blade shine
 * Head rows 0 to 12, body rows 13 to 23, feet on row 23 (the bottom row of the tile).
 */

const HEAD = {
  short: {
    down: [
      '................',
      '....OOOOOOOO....',
      '...OJJHHHHHHO...',
      '..OJHHHHHHHHGO..',
      '..OHHHHHHHHHGO..',
      '..OHHHHHHHHGGO..',
      '..OHSSSSSSSSGO..',
      '..OSSSSSSSSSRO..',
      '..OSWESSSSEWRO..',
      '..OSSESSSSESRO..',
      '..OSPSSMMSSPRO..',
      '...ORSSSSSSRO...',
      '....OOOOOOOO....'
    ],
    up: [
      '................',
      '....OOOOOOOO....',
      '...OJJHHHHHHO...',
      '..OJHHHHHHHHGO..',
      '..OHHHHHHHHHGO..',
      '..OHHHHHHHHHGO..',
      '..OHHHHHHHHHGO..',
      '..OHHHHHHHHHGO..',
      '..OHHHHHHHHGGO..',
      '..OSHHHHHHHGRO..',
      '..OSHHHHHHGGRO..',
      '...OGHHHHHGGO...',
      '....OOSSSSOO....'
    ],
    side: [
      '................',
      '....OOOOOOOO....',
      '...OJJHHHHHHO...',
      '..OJHHHHHHHHGO..',
      '..OHHHHHHHHHGO..',
      '..OHHHHHHHHHGO..',
      '..OSSSSSHHHHGO..',
      '..OSSSSSSHHHGO..',
      '..OWESSSSSHHGO..',
      '.OSSESSSRSHHGO..',
      '..OMSSSSSSSGGO..',
      '...OSSSSSSRRO...',
      '....OOOOOOOO....'
    ]
  },
  long: {
    down: [
      '................',
      '....OOOOOOOO....',
      '...OJJHHHHHHO...',
      '..OJHHHHHHHHGO..',
      '..OHHHHHHHHHGO..',
      '..OHHHHHHHHGGO..',
      '..OHSSSSSSSSGO..',
      '..OHSSSSSSSSGO..',
      '..OHWESSSSEWGO..',
      '..OHSESSSSESGO..',
      '..OHPSSMMSSPGO..',
      '..OHRSSSSSSRGO..',
      '..OHOOOOOOOOGO..'
    ],
    up: [
      '................',
      '....OOOOOOOO....',
      '...OJJHHHHHHO...',
      '..OJHHHHHHHHGO..',
      '..OHHHHHHHHHGO..',
      '..OHHHHHHHHHGO..',
      '..OHHHHHHHHHGO..',
      '..OHHHHHHHHHGO..',
      '..OHHHHHHHHHGO..',
      '..OHHHHHHHHHGO..',
      '..OHHHHHHHHHGO..',
      '..OHHHHHHHHGGO..',
      '..OOGHHHHHGGOO..'
    ],
    side: [
      '................',
      '....OOOOOOOO....',
      '...OJJHHHHHHO...',
      '..OJHHHHHHHHGO..',
      '..OHHHHHHHHHGO..',
      '..OHHHHHHHHHGO..',
      '..OSSSSSHHHHGO..',
      '..OSSSSSSHHHGO..',
      '..OWESSSSSHHGO..',
      '.OSSESSSRSHHGO..',
      '..OMSSSSSHHHGO..',
      '...OSSSSSHHGO...',
      '....OOOOOHHGO...'
    ]
  }
};

// Down facing face rows, columns 4 to 11 only, so one patch fits both hair lengths.
const FACE = {
  happy:   { 7: 'SSSSSSSS', 8: 'WESSSSEW', 9: 'SESSSSES', 10: 'PSSMMSSP', 11: 'RSSSSSSR' },
  unhappy: { 7: 'SOSSSSOS', 8: 'WESSSSEW', 9: 'SESSSSES', 10: 'PSSMMSSP', 11: 'RSMSSMSR' },
  content: { 7: 'SSSSSSSS', 8: 'SOSSSSOS', 9: 'OSOSSOSO', 10: 'PSMSSMSP', 11: 'RSSMMSSR' }
};
// Side facing frown: a brow over the eye and the mouth turned down, columns 3 to 4.
const SIDE_FROWN = { 7: 'SO', 10: 'SS', 11: 'OM' };

// Cap (player, buddy) and wide hat (tender) replace the top rows of the head.
const HAT = {
  cap: {
    down: ['................', '....OOOOOOOO....', '...OFFCCCCCCO...', '..OFCCCCCCCCDO..', '..OCCCCCCCCCDO..', '.ODDDDDDDDDDDDO.'],
    up:   ['................', '....OOOOOOOO....', '...OFFCCCCCCO...', '..OFCCCCCCCCDO..', '..OCCCCCCCCCDO..', '..ODCCCCCCCDDO..'],
    side: ['................', '....OOOOOOOO....', '...OFFCCCCCCO...', '..OFCCCCCCCCDO..', '..OCCCCCCCCCDO..', 'ODDDDCCCCCCCDO..']
  },
  wide: {
    down: ['....OOOOOOOO....', '...OFCCCCCCDO...', '...OCCCCCCCDO...', '...ODDDDDDDDO...', 'OFFCCCCCCCCCCCDO', '.OOOOOOOOOOOOOO.'],
    up:   ['....OOOOOOOO....', '...OFCCCCCCDO...', '...OCCCCCCCDO...', '...ODDDDDDDDO...', 'OFFCCCCCCCCCCCDO', '.OOOOOOOOOOOOOO.'],
    side: ['....OOOOOOOO....', '...OFCCCCCCDO...', '...OCCCCCCCDO...', '...ODDDDDDDDO...', 'OFFCCCCCCCCCCCDO', '.OOOOOOOOOOOOOO.']
  }
};

/* ---------------------------------------------- the pitmaster's look (v3.0, contract W16.4) */
/*
 * Six hair templates per facing (16 wide, head rows 0 to 12), three hats per facing (rows 0 to 5),
 * four face options. Only the player is built from these; HEAD and HAT above stay the buddy's,
 * the tender's and the customers' (untouched in v3.0). Short and long are v2's, with a stippled G
 * fringe on row 5 (see Deviations). Hat symbol K keeps the head's own pixel.
 */
const LOOK_HEAD = {
  short: {
    down: [
      '................',
      '....OOOOOOOO....',
      '...OJJHHHHHHO...',
      '..OJHHHHHHHHGO..',
      '..OHHHHHHHHHGO..',
      '..OHGHHGHHGHGO..',
      '..OHSSSSSSSSGO..',
      '..OSSSSSSSSSRO..',
      '..OSWESSSSEWRO..',
      '..OSSESSSSESRO..',
      '..OSPSSMMSSPRO..',
      '...ORSSSSSSRO...',
      '....OOOOOOOO....'
    ],
    up: HEAD.short.up,
    side: [
      '................',
      '....OOOOOOOO....',
      '...OJJHHHHHHO...',
      '..OJHHHHHHHHGO..',
      '..OHHHHHHHHHGO..',
      '..OHGHGHHHHHGO..',
      '..OSSSSSHHHHGO..',
      '..OSSSSSSHHHGO..',
      '..OWESSSSSHHGO..',
      '.OSSESSSRSHHGO..',
      '..OMSSSSSSSGGO..',
      '...OSSSSSSRRO...',
      '....OOOOOOOO....'
    ]
  },
  curly: {
    down: [
      '....OO.OO.OO....',
      '...OJJOJHOHHO...',
      '..OJHHJHHHJHHO..',
      '.OJHHHHHJHHHHGO.',
      '.OHHJHHHHHHJHGO.',
      '.OHGHHGHHGHHGGO.',
      '.OHHSSSSSSSSHGO.',
      '.OHGSSSSSSSSGHO.',
      '.OGHSSSSSSSSHGO.',
      '..OHSSSSSSSSGO..',
      '..OSSSSSSSSSRO..',
      '...ORSSSSSSRO...',
      '....OOOOOOOO....'
    ],
    up: [
      '....OO.OO.OO....',
      '...OJJOJHOHHO...',
      '..OJHHJHHHJHHO..',
      '.OJHHHHHJHHHHGO.',
      '.OHHJHHHHHHJHGO.',
      '.OHGHHGHHGHHGGO.',
      '.OHHJHHHHJHHHGO.',
      '.OHGHHGHHHGHGGO.',
      '.OHHHHHHJHHHHGO.',
      '..OGHHGHHHGHGO..',
      '..OHHHHHHHHGGO..',
      '...OGHHGHHGGO...',
      '....OOSSSSOO....'
    ],
    side: [
      '....OO.OO.OO....',
      '...OJJOJHOHHO...',
      '..OJHHJHHHJHHO..',
      '.OJHHHHHJHHHHGO.',
      '.OHHJHHHHHHJHGO.',
      '.OHGHGHHHGHHGGO.',
      '..OSSSSSHHJHHGO.',
      '..OSSSSSSHHHGHO.',
      '..OWESSSSSHJHGO.',
      '.OSSESSSRSHHGGO.',
      '..OMSSSSSSHGHO..',
      '...OSSSSSSRGO...',
      '....OOOOOOOO....'
    ]
  },
  long: {
    down: [
      '................',
      '....OOOOOOOO....',
      '...OJJHHHHHHO...',
      '..OJHHHHHHHHGO..',
      '..OHHHHHHHHHGO..',
      '..OHGHHGHHGHGO..',
      '..OHSSSSSSSSGO..',
      '..OHSSSSSSSSGO..',
      '..OHWESSSSEWGO..',
      '..OHSESSSSESGO..',
      '..OHPSSMMSSPGO..',
      '..OHRSSSSSSRGO..',
      '..OHOOOOOOOOGO..'
    ],
    up: HEAD.long.up,
    side: [
      '................',
      '....OOOOOOOO....',
      '...OJJHHHHHHO...',
      '..OJHHHHHHHHGO..',
      '..OHHHHHHHHHGO..',
      '..OHGHGHHHHHGO..',
      '..OSSSSSHHHHGO..',
      '..OSSSSSSHHHGO..',
      '..OWESSSSSHHGO..',
      '.OSSESSSRSHHGO..',
      '..OMSSSSSHHHGO..',
      '...OSSSSSHHGO...',
      '....OOOOOHHGO...'
    ]
  },
  buzz: {
    down: [
      '................',
      '....OOOOOOOO....',
      '...OHJHJHHHHO...',
      '..OJHJHHHHHHGO..',
      '..OHHHHHHHHGGO..',
      '..OGSGSGSGSGRO..',
      '..OJSSSSSSSSJO..',
      '..OSSSSSSSSSRO..',
      '..OSWESSSSEWRO..',
      '..OSSESSSSESRO..',
      '..OSPSSMMSSPRO..',
      '...ORSSSSSSRO...',
      '....OOOOOOOO....'
    ],
    up: [
      '................',
      '....OOOOOOOO....',
      '...OHJHJHHHHO...',
      '..OJHJHHHHHHGO..',
      '..OHHHHHHHHHGO..',
      '..OHHHHHHHHHGO..',
      '..OHHHHHHHHGGO..',
      '..OHJHHJHHHGGO..',
      '..OSHHHHHHHGRO..',
      '..OSGSGSGSGSRO..',
      '..OSSSSSSSSRRO..',
      '...ORSSSSSSRO...',
      '....OOSSSSOO....'
    ],
    side: [
      '................',
      '....OOOOOOOO....',
      '...OHJHJHHHHO...',
      '..OJHJHHHHHHGO..',
      '..OHHHHHHHHHGO..',
      '..OGSGSGHHHHGO..',
      '..OSSSSSSHHHGO..',
      '..OSSSSSSSJHGO..',
      '..OWESSSSSSJRO..',
      '.OSSESSSRSSSRO..',
      '..OMSSSSSSSSRO..',
      '...OSSSSSSRRO...',
      '....OOOOOOOO....'
    ]
  },
  bun: {
    down: [
      '......OOOO......',
      '....OOJHHGOO....',
      '...OJJGGGGHHO...',
      '..OJHHHHHHHHGO..',
      '..OHHHHHHHHHGO..',
      '..OHGHHGHHGHGO..',
      '..OHSSSSSSSSGO..',
      '..OHSSSSSSSSGO..',
      '..OSWESSSSEWRO..',
      '..OSSESSSSESRO..',
      '..OSPSSMMSSPRO..',
      '...ORSSSSSSRO...',
      '....OOOOOOOO....'
    ],
    up: [
      '................',
      '....OOOOOOOO....',
      '...OJJHHHHHHO...',
      '..OJHHHHHHHHGO..',
      '..OHHHHHHHHHGO..',
      '..OHHHHOOHHHGO..',
      '..OHHHOJHOHHGO..',
      '..OHHOJHHGOHGO..',
      '..OHHOHHGGOHGO..',
      '..OSHHOOOOHGRO..',
      '..OSHHHHHHGGRO..',
      '...OGHHHHHGGO...',
      '....OOSSSSOO....'
    ],
    side: [
      '................',
      '....OOOOOOOO....',
      '...OJJHHHHHHO...',
      '..OJHHHHHHHHGO..',
      '..OHHHHHHHHHGO..',
      '..OHGHGHHHHHGOO.',
      '..OSSSSSHHHHGJHO',
      '..OSSSSSSHHHGHGO',
      '..OWESSSSSHHGOO.',
      '.OSSESSSRSHHGO..',
      '..OMSSSSSSSGGO..',
      '...OSSSSSSRRO...',
      '....OOOOOOOO....'
    ]
  },
  bald: {
    down: [
      '................',
      '....OOOOOOOO....',
      '...OSWWSSSSSO...',
      '..OSWSSSSSSSRO..',
      '..OSSSSSSSSSRO..',
      '..OSSSSSSSSSRO..',
      '..OSSSSSSSSSRO..',
      '..OSSSSSSSSSRO..',
      '.OSSWESSSSEWRRO.',
      '.ORSSESSSSESRRO.',
      '..OSPSSMMSSPRO..',
      '...ORSSSSSSRO...',
      '....OOOOOOOO....'
    ],
    up: [
      '................',
      '....OOOOOOOO....',
      '...OSWWSSSSSO...',
      '..OSWSSSSSSSRO..',
      '..OSSSSSSSSSRO..',
      '..OSSSSSSSSSRO..',
      '..OSSSSSSSSSRO..',
      '..OSSSSSSSSRRO..',
      '.OSSSSSSSSSSRRO.',
      '.ORSSSSSSSSRRRO.',
      '..OSSSSSSSSRRO..',
      '...ORSSSSSRRO...',
      '....OOSSSSOO....'
    ],
    side: [
      '................',
      '....OOOOOOOO....',
      '...OSWWSSSSSO...',
      '..OSWSSSSSSSRO..',
      '..OSSSSSSSSSRO..',
      '..OSSSSSSSSSRO..',
      '..OSSSSSSSSSRO..',
      '..OSSSSSSSSSRO..',
      '..OWESSSSOOSRO..',
      '.OSSESSSOSRSRO..',
      '..OMSSSSSOOSRO..',
      '...OSSSSSSRRO...',
      '....OOOOOOOO....'
    ]
  }
};

// Hats, rows 0 to 5 by facing. cap and cowboy are v2's cap and wide hat; the bandana is a cloth
// band over rows 1 to 4 with white dots, knotted at the back (tails out on the right when the
// pitmaster faces down or left, centered when he faces away). K keeps the head's pixel.
const LOOK_HAT = {
  cap: HAT.cap,
  cowboy: HAT.wide,
  bandana: {
    down: ['................', '....OOOOOOOO....', '...OFCCCCFCCO...', '..OCCFCCCCCFDOO.', '..ODDDDDDDDDDCDO', 'KKKKKKKKKKKKKODO'],
    up:   ['................', '....OOOOOOOO....', '...OFCCCCFCCO...', '..OCCFCCCCCFDO..', '..ODDDDOODDDDO..', 'KKKKKKOCDOKKKKKK'],
    side: ['................', '....OOOOOOOO....', '...OFCCCCFCCO...', '..OCCFCCCCCFDOO.', '..ODDDDDDDDDDCDO', 'KKKKKKKKKKKKKODO']
  }
};
const HAT_IDS = [null, 'cap', 'cowboy', 'bandana'];

// Face patches ('.' keeps): down head columns 4 to 11, side head from column 2, rows 7 to 11.
const LOOK_FACE = {
  none: null,
  mustache: {
    down: { 10: '.GHJJHG.', 11: '..GWWG..' },
    side: { 10: 'OHHG', 11: '..M.' }
  },
  beard: {
    down: { 9: 'H......G', 10: 'HJHHHHHG', 11: 'GHHMMHGG' },
    side: { 9: '....', 10: 'OHHHHHHG', 11: '.OHMHHGG' }
  },
  glasses: {
    down: { 7: '111..111', 8: 'sE1111Es', 9: 'sE1..1Es' },
    side: { 7: '.111', 8: '1sE111', 9: '.sE1' }
  }
};

// Hair shade G by hair color index (not in the W16.4 table; see Deviations).
const HAIR_SHADE = ['1', '1', '5', '6', 'r', 't'];

// Torso rows 13 to 18 by facing; arms swing a little on the walk frames.
const TORSO = {
  down: [
    ['...OOTTTTTTOO...', '..OVTATTTTATUO..', '..OVTAAAAAATUO..', '..OVTAAAAABTUO..', '..OSTAAAAABTRO..', '...OTAAAAABTO...'],
    ['...OOTTTTTTOO...', '..OVTATTTTATUO..', '..OVTAAAAAATUO..', '..OSTAAAAABTUO..', '..OOTAAAAABTRO..', '...OTAAAAABTO...'],
    ['...OOTTTTTTOO...', '..OVTATTTTATUO..', '..OVTAAAAAATUO..', '..OVTAAAAABTRO..', '..OSTAAAAABTOO..', '...OTAAAAABTO...']
  ],
  up: [
    ['...OOTTTTTTOO...', '..OVTATTTTATUO..', '..OVTTTTTTTTUO..', '..OVTTTTTTTUUO..', '..OSTTTAATTTRO..', '...OTTTAATTTO...'],
    ['...OOTTTTTTOO...', '..OVTATTTTATUO..', '..OVTTTTTTTTUO..', '..OSTTTTTTTUUO..', '..OOTTTAATTTRO..', '...OTTTAATTTO...'],
    ['...OOTTTTTTOO...', '..OVTATTTTATUO..', '..OVTTTTTTTTUO..', '..OVTTTTTTTURO..', '..OSTTTAATTTOO..', '...OTTTAATTTO...']
  ],
  side: [
    ['....OOTTTTOO....', '...OAATTTTTUO...', '...OAATVUTTUO...', '...OAATVUTTUO...', '...OAABSRTTUO...', '...OAABOOTTUO...'],
    ['....OOTTTTOO....', '...OAATTTTTUO...', '...OAAVUTTTUO...', '...OAAVUTTTUO...', '...OAASRBTTUO...', '...OAAOOBTTUO...'],
    ['....OOTTTTOO....', '...OAATTTTTUO...', '...OAATTVUTUO...', '...OAATTVUTUO...', '...OAABTSRTUO...', '...OAABTOOTUO...']
  ],
  sit: [
    ['...OOTTTTTTOO...', '..OVTTTTTTTTUO..', '..OVTTTTTTTTUO..', '..OVTTTTTTTTUO..', '..OOSSOTTOSSOO..', '...OOOOTTOOOO...']
  ]
};

// Legs rows 19 to 23: stand, walk a, walk b.
const LEGS = {
  front: [
    ['....OLLLLLLO....', '....OLLOOLNO....', '....OLNOOLNO....', '...OZZZOOZZZO...', '...OOOO..OOOO...'],
    ['....OLLLLLLO....', '....OLLOOLNO....', '...OZZZOOLNO....', '...OOOO.OZZZO...', '.........OOOO...'],
    ['....OLLLLLLO....', '....OLLOOLNO....', '....OLNOOZZZO...', '...OZZZO.OOOO...', '...OOOO.........']
  ],
  side: [
    ['....OLLLLLLO....', '.....OLLLNO.....', '.....OLLLNO.....', '....OZZZZZO.....', '....OOOOOOO.....'],
    ['....OLLLLLLO....', '....OLLOOLNO....', '...OLLO..OLNO...', '..OZZZO..OZZO...', '..OOOOO..OOOO...'],
    ['....OLLLLLLO....', '.....OLLLNO.....', '....OLLOLNO.....', '...OZZZOZZO.....', '...OOOOOOOO.....']
  ],
  sit: [
    ['....OLLLLLLO....', '....OLLLLLNO....', '....OLLOOLNO....', '....OZZOOZZO....', '....OOOOOOOO....']
  ]
};

function splice(row, at, str) { return row.slice(0, at) + str + row.slice(at + str.length); }

// Assemble one 16x24 person in symbols. dir: 'down' | 'up' | 'side' | 'sit'.
function personRows(cfg, dir, frame, face) {
  const hd = dir === 'sit' ? 'down' : dir;
  let head = HEAD[cfg.hair][hd].slice();
  if (cfg.hat) {
    const top = HAT[cfg.hat][hd];
    for (let i = 0; i < top.length; i++) head[i] = top[i];
  }
  if (hd === 'down') {
    const f = FACE[face || 'happy'];
    Object.keys(f).forEach(function (k) { head[k] = splice(head[k], 4, f[k]); });
  } else if (hd === 'side' && face === 'unhappy') {
    Object.keys(SIDE_FROWN).forEach(function (k) { head[k] = splice(head[k], 3, SIDE_FROWN[k]); });
  }
  const torso = dir === 'sit' ? TORSO.sit[0] : TORSO[dir][frame];
  const legs = dir === 'sit' ? LEGS.sit[0] : (dir === 'side' ? LEGS.side[frame] : LEGS.front[frame]);
  return head.concat(torso, legs);
}

function paintPerson(cfg, rows) {
  const out = paint(rows, cfg.map);
  if (!cfg.stripe) return out;
  // A chest stripe across row 15 (customer 3).
  const s = cfg.stripe;
  return out.map(function (r, y) {
    if (y !== 15) return r;
    return r.split('').map(function (ch) { return ch === s.from ? s.to : (ch === s.fromShade ? s.toShade : ch); }).join('');
  });
}

const PEOPLE = {
  buddy: { hair: 'short', hat: 'cap', map: { O: '5', H: '6', J: '7', G: '5', C: 'k', F: 'h', D: '8',
    S: 'm', R: 'n', P: 'q', M: 'n', E: '1', W: 'h', T: 'f', V: 'h', U: 'g', A: 'f', B: 'g',
    L: 't', N: '1', Z: '5' } },
  tender: { hair: 'short', hat: 'wide', map: { O: '5', H: '1', J: 'v', G: '1', C: '7', F: '8', D: '6',
    S: 'm', R: 'n', P: 'q', M: 'n', E: '1', W: 'h', T: 'o', V: 'p', U: 'r', A: '6', B: '5',
    L: 't', N: '1', Z: '1' } },
  cust0: { hair: 'short', map: { O: '5', H: '5', J: '6', G: '1', S: 'l', R: 'm', P: 'i', M: 'n',
    E: '1', W: 'h', T: '4', V: '8', U: 'r', A: '4', B: 'r', L: 'g', N: 't', Z: '6', X: 's' } },
  cust1: { hair: 'long', map: { O: '5', H: 'o', J: 'q', G: 'r', S: 'm', R: 'n', P: 'i', M: 'n',
    E: '1', W: 'h', T: 'f', V: 'h', U: 'g', A: 'f', B: 'g', L: '7', N: '6', Z: '5', X: 's' } },
  cust2: { hair: 'long', map: { O: '5', H: 'k', J: 'h', G: '8', S: 'l', R: 'm', P: 'i', M: 'n',
    E: '1', W: 'h', T: 'i', V: 'p', U: 'j', A: 'i', B: 'j', L: 'g', N: 't', Z: 'o', X: 's' } },
  cust3: { hair: 'short', stripe: { from: 'h', to: 'o', fromShade: 'u', toShade: 'r' },
    map: { O: '5', H: '1', J: 'v', G: '1', S: 'n', R: '6', P: 'r', M: '5', E: '1', W: 'h',
      T: 'h', V: 'h', U: 'u', A: 'h', B: 'u', L: 't', N: '1', Z: '1', X: 's' } }
};

function person(id, dir, frame, face) {
  const cfg = PEOPLE[id];
  return paintPerson(cfg, personRows(cfg, dir, frame, face));
}

function staffSet(id) {
  const out = {};
  ['down', 'up', 'side'].forEach(function (dir) {
    out[id + '_' + dir] = sprite(16, 24, [person(id, dir, 0), person(id, dir, 1), person(id, dir, 2)]);
  });
  return out;
}

// Eating poses: fork down to the plate, fork up to the mouth, then the content face.
function sitFrames(id) {
  const cfg = PEOPLE[id];
  const base = personRows(cfg, 'sit', 0, 'happy');
  const forkDown = patch(base, {
    18: splice(base[18], 4, 'X'),
    19: splice(base[19], 4, 'X')
  });
  const forkUp = patch(base, {
    11: splice(base[11], 7, 'X'),
    12: splice(base[12], 5, 'SS'),
    17: splice(base[17], 4, 'VT')
  });
  const content = personRows(cfg, 'sit', 0, 'content');
  return [paintPerson(cfg, forkDown), paintPerson(cfg, forkUp), paintPerson(cfg, content)];
}

function custSet(id) {
  const out = {};
  out[id + '_down'] = sprite(16, 24, [
    person(id, 'down', 0), person(id, 'down', 1), person(id, 'down', 2),
    person(id, 'down', 1, 'unhappy'), person(id, 'down', 2, 'unhappy')
  ]);
  out[id + '_up'] = sprite(16, 24, [person(id, 'up', 0), person(id, 'up', 1), person(id, 'up', 2)]);
  out[id + '_side'] = sprite(16, 24, [
    person(id, 'side', 0), person(id, 'side', 1), person(id, 'side', 2), person(id, 'side', 0, 'unhappy')
  ]);
  out[id + '_sit'] = sprite(16, 24, sitFrames(id));
  return out;
}

/* ------------------------------------------------ the look compositor (v3.0, W16.3, W16.4) */

const LOOK_KEYS = ['skin', 'hair', 'hairColor', 'face', 'hat', 'apron'];
const DEFAULT_LOOK = Object.freeze({ skin: 1, hair: 0, hairColor: 1, face: 0, hat: 1, apron: 0 });
function freezeAll(list) { return Object.freeze(list.map(function (o) { return o && typeof o === 'object' ? Object.freeze(o) : o; })); }
// Exactly the W16.4 tables, in mock order.
const LOOK = Object.freeze({
  skin: freezeAll([{ S: 'w', R: 'l', M: 'm', P: 'i' }, { S: 'l', R: 'm', M: 'n', P: 'i' }, { S: 'm', R: '7', M: 'n', P: 'q' },
    { S: 'x', R: 'n', M: '5', P: 'q' }, { S: 'n', R: 'y', M: '5', P: 'r' }, { S: 'z', R: '5', M: '1', P: 'r' }]),
  hairColor: freezeAll([{ H: '2', J: '5' }, { H: '5', J: '6' }, { H: 'r', J: 'q' }, { H: '8', J: '9' }, { H: '4', J: '8' }, { H: 's', J: 'u' }]),
  apron: freezeAll([{ A: 'o', B: 'r' }, { A: '4', B: 'r' }, { A: 'c', B: 'd' }, { A: 'f', B: 'g' }, { A: 'v', B: '2' }, { A: 'i', B: 'j' }]),
  hat: freezeAll([null, { C: '4', F: '8', D: 'r' }, { C: '7', F: '8', D: '6' }, { C: 'o', F: 'h', D: 'r' }]),
  hair: Object.freeze(['short', 'curly', 'long', 'buzz', 'bun', 'bald']),
  face: Object.freeze(['none', 'mustache', 'beard', 'glasses'])
});
const LOOK_COUNT = { skin: 6, hair: 6, hairColor: 6, face: 4, hat: 4, apron: 6 };

// Any input to a valid look: a bad or missing index falls back to the default for that key.
function normLook(look) {
  const out = {};
  const src = look && typeof look === 'object' ? look : {};
  LOOK_KEYS.forEach(function (k) {
    let v;
    try { v = src[k]; } catch (e) { v = undefined; }
    out[k] = (typeof v === 'number' && Number.isInteger(v) && v >= 0 && v < LOOK_COUNT[k]) ? v : DEFAULT_LOOK[k];
  });
  return out;
}

// Overlay a patch row: '.' keeps the row's own pixel.
function overlay(row, at, str) {
  let out = row.slice(0, at);
  for (let i = 0; i < str.length; i++) out += str[i] === '.' ? row[at + i] : str[i];
  return out + row.slice(at + str.length);
}

// Q-1 (round 3): the shirt under each apron. The Blue apron is the blue shirt's own colors, so with
// it the shirt goes cream; every other apron keeps v2's blue shirt.
const SHIRT_BLUE = Object.freeze({ T: 'g', V: 'f', U: 't' });
const SHIRT_CREAM = Object.freeze({ T: '3', V: 'h', U: 'a' });
const APRON_BLUE = 3;

// The player's symbol map for a look: the v2 map with the four swap tables applied.
function lookMap(L) {
  const sk = LOOK.skin[L.skin], hc = LOOK.hairColor[L.hairColor], ap = LOOK.apron[L.apron], ht = LOOK.hat[L.hat];
  const sh = L.apron === APRON_BLUE ? SHIRT_CREAM : SHIRT_BLUE;
  return {
    O: '5', H: hc.H, J: hc.J, G: HAIR_SHADE[L.hairColor],
    C: ht ? ht.C : '0', F: ht ? ht.F : '0', D: ht ? ht.D : '0',
    S: sk.S, R: sk.R, P: sk.P, M: sk.M, E: '1', W: 'h',
    T: sh.T, V: sh.V, U: sh.U, A: ap.A, B: ap.B, L: '6', N: '5', Z: '1', X: 's', Y: 'h'
  };
}

// One 16x24 pitmaster in symbols. Order (W16.4): hair, hat rows, face expression (v2 happy),
// face patch, then torso and legs.
function lookRows(L, dir, frame) {
  const head = LOOK_HEAD[LOOK.hair[L.hair]][dir].slice();
  const hatId = HAT_IDS[L.hat];
  if (hatId) {
    const top = LOOK_HAT[hatId][dir];
    for (let i = 0; i < top.length; i++) {
      let r = '';
      for (let x = 0; x < 16; x++) r += top[i][x] === 'K' ? head[i][x] : top[i][x];
      head[i] = r;
    }
  }
  if (dir === 'down') Object.keys(FACE.happy).forEach(function (k) { head[k] = splice(head[k], 4, FACE.happy[k]); });
  const face = LOOK_FACE[LOOK.face[L.face]];
  if (face && face[dir]) {
    const at = dir === 'down' ? 4 : 2;
    Object.keys(face[dir]).forEach(function (k) { head[k] = overlay(head[k], at, face[dir][k]); });
  }
  const torso = TORSO[dir][frame];
  const legs = dir === 'side' ? LEGS.side[frame] : LEGS.front[frame];
  return head.concat(torso, legs);
}

function lookPerson(L, dir, frame) { return paint(lookRows(L, dir, frame), lookMap(L)); }

// The four player sprites for a look: { player_down, player_up, player_side, player_slice }.
function playerFrames(L) {
  const out = {};
  ['down', 'up', 'side'].forEach(function (dir) {
    out['player_' + dir] = [lookPerson(L, dir, 0), lookPerson(L, dir, 1), lookPerson(L, dir, 2)];
  });
  out.player_slice = sliceFrames(lookRows(L, 'down', 0), lookMap(L));
  return out;
}

// The pitmaster slicing, any facing: knife raised, then knife down on the board.
function sliceFrames(base, map) {
  const up = stamp(patch(base, { 17: splice(base[17], 12, 'U') }), [
    '..............Y.',
    '..............X.',
    '..............X.',
    '..............X.',
    '..............X.',
    '..............O.',
    '.............OSO',
    '.............OSO',
    '.............UO.',
    '.............U..'
  ], 0, 4);
  const down = stamp(base, [
    '.............O..',
    '............SSO.',
    '............OXXY'
  ], 0, 16);
  return [paint(up, map), paint(down, map)];
}

/* ---------------------------------------------- crew looks (v3.1, contract X12.2, X12.3) */
/*
 * One body system: the in-yard crew sprite is lookRows() with the role outfit in place of the
 * player's shirt and apron, and the card portrait is a 26 by 22 bust built from parts authored once
 * at bust size, one per look option, painted with the same swap tables. Bust symbols:
 *   O outline   S skin   R skin shade   Y skin light   P cheek   M mouth   E eye   W eye white
 *   H hair   J hair light   G hair shade (also brows)   C hat crown   F hat light   D hat shade
 *   T shirt   V shirt light   U shirt shade   A apron   B apron shade   K accent (the look's apron)
 */
const ROLES = Object.freeze(['run', 'fire', 'prep']);
// Per role: shirt T V U (fire's T2 V2 U2 are the cream shirt worn with the Red apron), the run
// role's A and B (no apron: the shirt's own colors), and the legs L N Z. Palette characters only.
const CREW_OUTFIT = Object.freeze({
  run:  Object.freeze({ T: 'f', V: 'h', U: 'g', A: 'f', B: 'g', L: 't', N: '1', Z: '5' }),
  fire: Object.freeze({ T: 'o', V: 'p', U: 'r', T2: '3', V2: 'h', U2: 'a', L: 't', N: '1', Z: '1' }),
  prep: Object.freeze({ T: 'h', V: 'h', U: 'u', L: 'v', N: 't', Z: '1' })
});
const CREW_SPRITE = Object.freeze({ run: 'buddy', fire: 'tender', prep: 'prep' });
const PREP_DEFAULT_LOOK = Object.freeze({ skin: 2, hair: 4, hairColor: 0, face: 0, hat: 0, apron: 2 });
const APRON_RED = 0;

function isRole(role) { return typeof role === 'string' && ROLES.indexOf(role) >= 0; }
function lookKeyOf(L) { return LOOK_KEYS.map(function (k) { return L[k]; }).join('-'); }

// Review 1: a crew cap takes one of four ramps by the look's apron index (rust, navy, forest, grey;
// the rust ramp is v2's cap), so a grid of capped cards does not read as one uniform. Palette
// characters only. The player's own cap (lookMap) stays rust.
const CAP_RAMPS = Object.freeze([
  Object.freeze({ C: '4', F: '8', D: 'r' }),
  Object.freeze({ C: 'g', F: 'f', D: 't' }),
  Object.freeze({ C: 'd', F: 'c', D: '2' }),
  Object.freeze({ C: 't', F: 's', D: '1' })
]);
const HAT_CAP = 1;
function crewHat(L) {
  return L.hat === HAT_CAP ? CAP_RAMPS[L.apron % CAP_RAMPS.length] : LOOK.hat[L.hat];
}

// The crew member's symbol map: the look's map with the role outfit over the shirt, apron and legs.
function crewMap(L, role) {
  const m = lookMap(L);
  const ch = crewHat(L);
  if (ch) { m.C = ch.C; m.F = ch.F; m.D = ch.D; }
  const o = CREW_OUTFIT[role];
  const cream = role === 'fire' && L.apron === APRON_RED;
  m.T = cream ? o.T2 : o.T; m.V = cream ? o.V2 : o.V; m.U = cream ? o.U2 : o.U;
  if (role === 'run') { m.A = o.A; m.B = o.B; }
  m.L = o.L; m.N = o.N; m.Z = o.Z;
  return m;
}

// The in-yard frames for a role and look: { <base>_down, <base>_up, <base>_side[, prep_slice] }.
function crewFrames(L, role) {
  const map = crewMap(L, role);
  const base = CREW_SPRITE[role];
  const out = {};
  ['down', 'up', 'side'].forEach(function (dir) {
    out[base + '_' + dir] = [0, 1, 2].map(function (f) { return paint(lookRows(L, dir, f), map); });
  });
  if (role === 'prep') out.prep_slice = sliceFrames(lookRows(L, 'down', 0), map);
  return out;
}

// Bust swap extras: skin light Y by skin index, the mouth stays the skin table's M.
const BUST_SKIN_HI = ['h', 'w', 'l', 'm', 'x', 'y'];
const BUST_W = 26, BUST_H = 22, BUST_T = 14;   // the shoulders start on row 14

// Hair, at bust size: each style keeps something below the hat line (row 7 and down, or outside
// columns 7 to 18), so every style still reads under a cap.
const BUST_HAIR = {
  short: function (g, span) {
    span(2, 9, 16, 'H'); span(3, 8, 17, 'H'); span(4, 8, 17, 'G');
    for (let y = 5; y <= 7; y++) { g.set(8, y, 'H'); g.set(17, y, 'G'); }
    g.set(10, 2, 'J'); g.set(11, 2, 'J'); g.set(9, 3, 'J');
  },
  curly: function (g, span) {
    span(1, 9, 16, 'H');
    for (let y = 2; y <= 4; y++) span(y, 7, 18, 'H');
    [7, 10, 13, 16].forEach(function (x) { g.set(x, 1, 'H'); });
    for (let y = 5; y <= 9; y++) { g.set(7, y, 'H'); g.set(18, y, 'G'); if (y < 8) { g.set(8, y, 'H'); g.set(17, y, 'G'); } }
    span(5, 9, 11, 'H'); span(5, 14, 16, 'H');
    [[9, 2], [12, 3], [15, 2], [10, 4], [14, 4], [8, 6], [17, 7], [13, 1]].forEach(function (p) { g.set(p[0], p[1], 'G'); });
    [[9, 1], [8, 3], [11, 2]].forEach(function (p) { g.set(p[0], p[1], 'J'); });
    g.set(6, 5, 'H'); g.set(6, 7, 'H'); g.set(19, 5, 'G'); g.set(19, 7, 'G');
  },
  long: function (g, span) {
    span(2, 9, 16, 'H');
    for (let y = 3; y <= 4; y++) span(y, 8, 17, 'H');
    span(5, 8, 12, 'H'); span(5, 15, 17, 'G');
    g.set(8, 6, 'H'); g.set(17, 6, 'G'); g.set(8, 7, 'H'); g.set(17, 7, 'G');
    for (let y = 4; y <= 18; y++) { span(y, 6, 7, 'H'); span(y, 18, 19, 'G'); }
    g.set(5, 17, 'H'); g.set(5, 18, 'H'); g.set(20, 17, 'G'); g.set(20, 18, 'G');
    g.set(10, 2, 'J'); g.set(11, 2, 'J'); g.set(9, 3, 'J'); g.set(6, 8, 'J'); g.set(6, 9, 'J');
  },
  buzz: function (g, span) {
    span(2, 10, 15, 'H'); span(3, 9, 16, 'H');
    for (let x = 8; x <= 17; x++) g.set(x, 4, x % 2 === 0 ? 'H' : 'G');   // stubble hairline
    for (let y = 5; y <= 8; y++) { g.set(8, y, 'G'); g.set(17, y, 'G'); }
    g.set(10, 3, 'J'); g.set(12, 3, 'J'); g.set(11, 2, 'J');
  },
  bun: function (g, span) {
    span(2, 9, 16, 'H'); span(3, 8, 17, 'H'); span(4, 8, 17, 'H'); span(4, 11, 14, 'G');
    for (let y = 5; y <= 10; y++) { g.set(8, y, 'H'); g.set(17, y, 'G'); }
    g.set(7, 6, 'H'); g.set(18, 6, 'G'); g.set(10, 3, 'J'); g.set(9, 4, 'J');
  },
  bald: function (g) {
    for (let y = 6; y <= 9; y++) { g.set(8, y, 'H'); g.set(17, y, 'G'); }
    g.set(10, 4, 'Y'); g.set(11, 4, 'Y'); g.set(10, 3, 'Y');
  }
};
// The bun's knot, drawn after any hat on empty cells only, so it shows above a cap or a bandana.
const BUST_KNOT = [[12, 0, 'J'], [13, 0, 'H'], [11, 1, 'J'], [12, 1, 'H'], [13, 1, 'H'], [14, 1, 'G']];

// Hats: clear the box the hat covers, then paint it; row 6 under a brim takes the skin's shade.
const BUST_HAT = {
  cap: function (g, span) {
    clearBox(g, 7, 0, 18, 5);
    span(1, 10, 15, 'C');
    for (let y = 2; y <= 4; y++) span(y, 8, 17, 'C');
    g.set(12, 1, 'F'); g.set(10, 2, 'F'); g.set(11, 2, 'F'); g.set(9, 3, 'F');
    for (let y = 2; y <= 4; y++) { g.set(16, y, 'D'); g.set(17, y, 'D'); }
    span(5, 7, 18, 'D');
    span(6, 8, 17, 'R');
  },
  cowboy: function (g, span) {
    clearBox(g, 3, 0, 22, 5);
    span(0, 10, 15, 'C'); span(1, 9, 16, 'C'); span(2, 9, 16, 'C'); span(3, 9, 16, 'D');
    g.set(10, 0, 'F'); g.set(9, 1, 'F'); g.set(10, 1, 'F'); g.set(9, 2, 'F');
    g.set(16, 1, 'D'); g.set(16, 2, 'D'); g.set(12, 0, 'D'); g.set(13, 0, 'D');   // the crease
    g.set(4, 3, 'C'); g.set(21, 3, 'D');                                            // brim tips turned up
    span(4, 4, 21, 'C'); g.set(4, 4, 'F'); g.set(5, 4, 'F'); g.set(6, 4, 'F'); g.set(20, 4, 'D'); g.set(21, 4, 'D');
    span(5, 5, 20, 'D');
    span(6, 8, 17, 'R');
  },
  bandana: function (g, span) {
    clearBox(g, 7, 0, 18, 4);
    span(2, 9, 16, 'C'); span(3, 8, 17, 'C'); span(4, 8, 17, 'D');
    [[10, 2], [14, 2], [9, 3], [12, 3], [16, 3]].forEach(function (p) { g.set(p[0], p[1], 'F'); });
    g.set(18, 3, 'C'); g.set(18, 4, 'D'); g.set(19, 4, 'C'); g.set(19, 5, 'D'); g.set(20, 5, 'C'); g.set(20, 6, 'D');   // the knot's tails
  }
};
function clearBox(g, x0, y0, x1, y1) {
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) g.set(x, y, '0');
}

// Face options at bust size (none paints nothing).
const BUST_FACE = {
  mustache: function (g, span) { span(11, 10, 15, 'H'); g.set(10, 12, 'H'); g.set(15, 12, 'G'); g.set(11, 11, 'J'); },
  beard: function (g, span) {
    span(11, 11, 14, 'H'); g.set(8, 11, 'H'); g.set(9, 11, 'H'); g.set(16, 11, 'G'); g.set(17, 11, 'G');
    span(12, 8, 10, 'H'); span(12, 15, 17, 'G');
    span(13, 9, 16, 'H'); span(14, 10, 15, 'G'); g.set(16, 13, 'G');
    for (let y = 8; y <= 10; y++) { g.set(8, y, 'H'); g.set(17, y, 'G'); }
    g.set(12, 13, 'J');
  },
  // Two round lenses (rims near black, clear lenses in smokeL around the eyes) and a bridge.
  glasses: function (g, span) {
    span(7, 9, 11, '1'); span(7, 14, 16, '1'); span(10, 9, 11, '1'); span(10, 14, 16, '1');
    [8, 12, 13, 17].forEach(function (x) { g.set(x, 8, '1'); g.set(x, 9, '1'); });
    g.set(9, 8, 'u'); g.set(9, 9, 'u'); g.set(11, 8, 'u'); g.set(11, 9, 'u');
    g.set(14, 8, 'u'); g.set(14, 9, 'u'); g.set(16, 8, 'u'); g.set(16, 9, 'u');
    g.set(11, 8, 'h'); g.set(16, 8, 'h');   // glint, top right of each lens
  }
};

// Role outfits at bust size, over the shirt (T is the shoulder row, BUST_T).
const BUST_OUTFIT = {
  // RUN: a polo with a white collar and a white name tag; the tag's top band wears the look's apron color.
  run: function (g, span, T) {
    span(T, 7, 9, 'h'); span(T, 16, 18, 'h'); span(T + 1, 9, 10, 'h'); span(T + 1, 15, 16, 'h');
    span(T + 1, 11, 14, 'R');
    for (let y = T + 2; y < BUST_H; y++) g.set(12, y, 'U');
    g.set(13, T + 2, 'U'); g.set(12, T + 2, 'h');
    span(T + 2, 16, 19, 'K'); span(T + 3, 16, 19, 'h'); g.set(17, T + 3, 't'); g.set(18, T + 3, 't');
  },
  // FIRE: the work apron with a neck strap and a chest pocket holding a thermometer.
  fire: function (g, span, T) {
    for (let y = T + 1; y < BUST_H; y++) span(y, 8, 17, 'A');
    for (let y = T + 2; y < BUST_H; y++) span(y, 7, 18, 'A');
    g.set(9, T, 'A'); g.set(10, T, 'A'); g.set(15, T, 'A'); g.set(16, T, 'A');
    for (let y = T + 1; y < BUST_H; y++) { g.set(17, y, 'B'); g.set(18, y, 'B'); }
    span(T + 3, 10, 15, 'B'); g.set(10, T + 2, 'B'); g.set(15, T + 2, 'B');
    g.set(13, T + 2, 's'); g.set(13, T + 1, 'h');
  },
  // PREP: a white chef coat, a neckerchief in the look's apron color, two rows of buttons.
  prep: function (g, span, T) {
    span(T, 7, 9, 'V'); span(T, 16, 18, 'V');
    span(T + 1, 10, 15, 'K'); g.set(12, T + 2, 'K'); g.set(13, T + 2, 'B');
    for (let y = T + 2; y < BUST_H; y++) g.set(15, y, 'U');
    [[9, T + 2], [9, T + 4], [17, T + 2], [17, T + 4]].forEach(function (p) { g.set(p[0], p[1], 't'); });
  }
};

// The bust in symbols. Order: torso, neck, outfit, head and face, facial hair, hair, hat, the bun's
// knot, glasses, then the outline pass.
function bustSymbols(L, role) {
  const g = new Grid(BUST_W, BUST_H, '0');
  const span = function (y, x0, x1, c) { for (let x = x0; x <= x1; x++) g.set(x, y, c); };
  const T = BUST_T;
  span(T, 6, 19, 'T'); span(T + 1, 4, 21, 'T');
  for (let y = T + 2; y < BUST_H; y++) span(y, 2, 23, 'T');
  for (let y = T + 1; y < BUST_H; y++) { g.set(20, y, 'U'); g.set(21, y, 'U'); }
  for (let y = T + 2; y < BUST_H; y++) { g.set(22, y, 'U'); g.set(23, y, 'U'); g.set(2, y, 'V'); }
  span(T, 6, 7, 'V'); span(T + 1, 4, 6, 'V'); g.set(3, T + 2, 'V');   // rim light along the left shoulder
  for (let y = 12; y <= T + 1; y++) span(y, 11, 14, 'R');
  BUST_OUTFIT[role](g, span, T);
  // head, light from the top left
  span(3, 9, 16, 'S');
  for (let y = 4; y <= 12; y++) span(y, 8, 17, 'S');
  span(13, 9, 16, 'S'); span(14, 10, 15, 'S');
  for (let y = 4; y <= 12; y++) g.set(17, y, 'R');
  g.set(16, 13, 'R'); g.set(15, 14, 'R');
  g.set(9, 5, 'Y'); g.set(9, 6, 'Y'); g.set(10, 4, 'Y');
  for (let y = 8; y <= 10; y++) { g.set(7, y, 'S'); g.set(18, y, 'R'); }
  g.set(7, 9, 'R');
  // face: eyes two pixels tall, brows in the hair shade, nose, mouth, cheeks
  g.set(10, 8, 'E'); g.set(10, 9, 'E'); g.set(15, 8, 'E'); g.set(15, 9, 'E');
  if (L.skin >= 4) { g.set(11, 9, 'W'); g.set(14, 9, 'W'); }
  span(7, 9, 10, 'G'); span(7, 15, 16, 'G');
  g.set(13, 10, 'R'); g.set(12, 11, 'R');
  span(12, 11, 14, 'M');
  g.set(9, 11, 'P'); g.set(16, 11, 'P');
  const faceId = LOOK.face[L.face];
  if (faceId === 'mustache' || faceId === 'beard') BUST_FACE[faceId](g, span);
  const hairId = LOOK.hair[L.hair];
  BUST_HAIR[hairId](g, span);
  const hatId = HAT_IDS[L.hat];
  if (hatId) BUST_HAT[hatId](g, span);
  // Review 1: under a cap, long hair shows only from row 7 down (below the brim), so the strands
  // never run up beside the cap like a hood.
  if (hatId === 'cap' && hairId === 'long') {
    for (let y = 0; y <= 6; y++) for (let x = 0; x < BUST_W; x++) {
      const v = g.get(x, y);
      if ((x < 7 || x > 18) && (v === 'H' || v === 'J' || v === 'G')) g.set(x, y, '0');
    }
  }
  if (hairId === 'bun') BUST_KNOT.forEach(function (p) { if (g.get(p[0], p[1]) === '0') g.set(p[0], p[1], p[2]); });
  if (faceId === 'glasses') BUST_FACE.glasses(g, span);
  g.outline('O');
  return g.done();
}

function bustMap(L, role) {
  const sk = LOOK.skin[L.skin], hc = LOOK.hairColor[L.hairColor], ap = LOOK.apron[L.apron], ht = crewHat(L);
  const m = crewMap(L, role);
  return {
    O: '5', S: sk.S, R: sk.R, Y: BUST_SKIN_HI[L.skin], P: sk.P, M: sk.M, E: '1', W: 'h',
    H: hc.H, J: hc.J, G: HAIR_SHADE[L.hairColor],
    C: ht ? ht.C : '0', F: ht ? ht.F : '0', D: ht ? ht.D : '0',
    T: m.T, V: m.V, U: m.U, A: ap.A, B: ap.B, K: ap.A
  };
}

// art.bustRows (X12.2): 22 rows of 26 legend characters, '0' transparent.
function bustRows(look, role) {
  if (!isRole(role)) throw new Error('sprites: unknown crew role "' + role + '"');
  const L = normLook(look);
  return paint(bustSymbols(L, role), bustMap(L, role));
}

// Soft shadow under people: a checker ellipse in dark brown.
function shadowRows() {
  const g = new Grid(12, 4, '0');
  for (let y = 0; y < 4; y++) {
    for (let x = 0; x < 12; x++) {
      const dx = (x - 5.5) / 6, dy = (y - 1.5) / 2;
      if (dx * dx + dy * dy <= 1 && (x + y) % 2 === 0) g.set(x, y, '5');
    }
  }
  return g.done();
}

/* ------------------------------------------------------------------ the dog (16x16, faces left) */

function dogWalk(step) {
  const g = new Grid(16, 16, '0');
  g.ellipse(5, 7, 10, 6, '8');                       // body
  for (let x = 5; x < 15; x++) {
    if (g.get(x, 7) === '8') g.set(x, 7, '9');       // light back
    if (g.get(x, 12) === '8') g.set(x, 12, '7');     // shaded belly
  }
  // legs: front pair and back pair, swapping on the step
  const legs = step === 0 ? [[5, '8'], [8, '7'], [11, '8'], [13, '7']] : [[4, '7'], [6, '8'], [10, '7'], [12, '8']];
  legs.forEach(function (l) { g.rect(l[0], 12, 2, 3, l[1]); });
  g.rect(14, 5, 1, 3, '8'); g.set(15, 4, '8');       // tail up
  g.ellipse(1, 3, 7, 7, '8');                        // head
  g.set(2, 4, '9'); g.set(3, 4, '9'); g.set(2, 5, '9');
  g.rect(0, 7, 3, 2, '9');                           // snout
  g.set(0, 7, '1');                                  // nose
  g.set(3, 6, '1');                                  // eye
  g.rect(4, 3, 2, 4, '7'); g.set(5, 7, '6');         // floppy ear
  g.rect(6, 9, 2, 2, 'o');                           // red collar
  g.outline('5');
  return g.done();
}

function dogSit() {
  const g = new Grid(16, 16, '0');
  g.ellipse(4, 8, 8, 7, '8');                        // body
  g.ellipse(6, 9, 4, 5, '9');                        // light chest
  g.rect(12, 12, 2, 2, '7');                         // tail on the ground
  g.rect(5, 12, 2, 3, '9'); g.rect(9, 12, 2, 3, '9');// front legs
  g.set(6, 14, '7'); g.set(10, 14, '7');
  g.ellipse(4, 2, 8, 7, '8');                        // head
  g.set(5, 3, '9'); g.set(6, 3, '9'); g.set(5, 4, '9');
  g.rect(3, 3, 2, 4, '7'); g.rect(11, 3, 2, 4, '6');  // ears, the right one in shade
  g.set(6, 5, '1'); g.set(9, 5, '1');                // eyes
  g.rect(6, 6, 4, 2, '9');                           // muzzle
  g.rect(7, 6, 2, 1, '1');                           // nose
  g.set(7, 8, 'o'); g.set(8, 8, 'o');
  g.rect(5, 9, 6, 1, 'o');                           // collar
  g.set(8, 10, 'k');                                 // tag
  g.outline('5');
  return g.done();
}

function dogNap() {
  // Curled up: the body an oval on the left, the head resting on its right end with the ear up,
  // shut eyes and the red collar showing. Body and head carry their own outlines so they read apart.
  const body = new Grid(16, 16, '0');
  body.ellipse(1, 7, 12, 8, '8');
  for (let y = 7; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      if (body.get(x, y) !== '8') continue;
      if (body.get(x, y - 1) === '0') body.set(x, y, '9');          // back in the light
      else if (body.get(x, y + 1) === '0') body.set(x, y, '7');     // shade underneath
    }
  }
  body.rect(3, 12, 6, 1, '9');                       // light belly line where the legs tuck in
  body.set(5, 9, '7'); body.set(6, 9, '7'); body.set(6, 10, '7');   // a darker patch
  body.rect(10, 13, 4, 1, '7'); body.set(13, 12, '8');              // tail curled round the front
  body.outline('5');
  const head = new Grid(16, 16, '0');
  head.ellipse(8, 5, 7, 6, '8');
  head.set(9, 6, '9'); head.set(10, 6, '9'); head.set(9, 7, '9');   // light on the brow
  head.rect(12, 3, 2, 3, '6');                       // ear up, in shade
  head.rect(10, 8, 2, 1, '1');                       // shut eye
  head.rect(13, 8, 2, 2, '9'); head.set(14, 8, '1'); // muzzle and nose
  head.set(9, 10, 'o'); head.set(10, 10, 'o');       // collar
  head.outline('5');
  return stamp(body.done(), head.done(), 0, 0);
}

/* ------------------------------------------------------------------ meat */

const MEAT_IDS = ['sausage', 'chicken', 'ribs', 'butt', 'brisket'];

// Meat symbols: Q outline, X fill, Y shade (bottom right), L light (top left), B bone or fat.
const MEAT_STATE = {
  raw:        { Q: '5', X: 'p', Y: 'i', L: 'h', B: 'h' },
  cooking:    { Q: '5', X: 'q', Y: 'r', L: 'p', B: '3' },
  done:       { Q: '3', X: 'r', Y: '6', L: 'q', B: '3' },   // the cream ring
  cookedHand: { Q: '5', X: 'r', Y: '6', L: 'q', B: '3' },
  burnt:      { Q: '5', X: '1', Y: '1', L: 'v', B: 'v' }
};

// 8x8 shapes for the hand overlays.
const HAND_SHAPE = {
  sausage: ['........', '........', '.QQQQQQ.', 'QLXXXXXQ', 'QXXXXXYQ', '.QQQQQQ.', '........', '........'],
  chicken: ['..QQQQ..', '.QLXXXQ.', 'QLXXXXXQ', 'QXXXXXXQ', '.QXXXYQ.', '..QQXQ..', '...QBBQ.', '....QQ..'],
  ribs:    ['........', 'QQQQQQQQ', 'QLBXBXBQ', 'QXBXBXBQ', 'QXXXXXXQ', 'QYYYYYYQ', 'QQQQQQQQ', '........'],
  butt:    ['..QQQQ..', '.QLLXXQ.', 'QLXXXXXQ', 'QXXXXXXQ', 'QXXXXXXQ', 'QXXXXXYQ', '.QXYYYQ.', '..QQQQ..'],
  brisket: ['........', '........', 'QQQQQQQQ', 'QBBBBBBQ', 'QLXXXXXQ', 'QYYYYYYQ', 'QQQQQQQQ', '........']
};

// 10x10 shapes for the grate pieces.
const PIECE_SHAPE = {
  sausage: ['..........', '.QQQQQQQQ.', 'QLXXXXXXXQ', 'QXXXXXXXYQ', '.QQQQQQQQ.', '.QQQQQQQQ.', 'QLXXXXXXXQ', 'QXXXXXXXYQ', '.QQQQQQQQ.', '..........'],
  chicken: ['..........', '...QQQQQ..', '..QLXXXXQ.', '.QLXXXXXXQ', '.QXXXXXXXQ', '.QXXXXXXYQ', '..QXXXXYQ.', '...QXXQQ..', '....QBBQ..', '.....QQ...'],
  ribs:    ['..........', 'QQQQQQQQQQ', 'QLBXBXBXBQ', 'QXBXBXBXBQ', 'QXXXXXXXXQ', 'QXXXXXXXXQ', 'QXXXXXXXYQ', 'QYYYYYYYYQ', 'QQQQQQQQQQ', '..........'],
  butt:    ['...QQQQ...', '..QLLXXQ..', '.QLXXXXXQ.', 'QLXXXXXXXQ', 'QXXXXXXXXQ', 'QXXXXXXXYQ', 'QXXXXXXYYQ', '.QXXXXYYQ.', '..QYYYYQ..', '...QQQQ...'],
  brisket: ['..........', '..........', 'QQQQQQQQQQ', 'QBBBBBBBBQ', 'QLXXXXXXXQ', 'QXXXXXXXXQ', 'QXXXXXXXYQ', 'QYYYYYYYYQ', 'QQQQQQQQQQ', '..........']
};

// Where the check sits on a done piece (top left of a 4x3 check).
const CHECK_AT = { sausage: [5, 1], chicken: [3, 3], ribs: [3, 4], butt: [3, 4], brisket: [3, 4] };
const CHECK = ['...k', 'k.k.', '.k..'];

// v2.1 frame 4, about to burn ([T 4]): the done shape charred at the rim, the outline near black
// ('1'), the meat cells next to it umber ('2'), the shade side black, so a black and umber band
// rings a red center; no check mark, two smoke wisps above. Round 2: a thin piece (the sausage)
// whose rim band would leave under 4 red cells chars only its side neighbors, so it never reads
// as the burnt frame.
const WISP_AT = { sausage: [7, 0], chicken: [5, 0], ribs: [6, 0], butt: [7, 0], brisket: [6, 1] };
function warnRows(meat) {
  const shape = PIECE_SHAPE[meat];
  const isQ = function (x, y) { return y >= 0 && y < shape.length && x >= 0 && x < shape[y].length && shape[y][x] === 'Q'; };
  function rim(vertical) {
    return shape.map(function (r, y) {
      let o = '';
      for (let x = 0; x < r.length; x++) {
        const near = isQ(x - 1, y) || isQ(x + 1, y) || (vertical && (isQ(x, y - 1) || isQ(x, y + 1)));
        o += r[x] === 'X' && near ? '2' : r[x];
      }
      return o;
    });
  }
  let sym = rim(true);
  if (sym.join('').split('X').length - 1 < 4) sym = rim(false);
  const rows = paint(sym, { Q: '1', X: 'r', Y: '1', L: '2', B: '3' });
  const w = WISP_AT[meat];
  const out = stamp(rows, ['v'], w[0], w[1]);
  // The second wisp goes one row up when there is room, else to the first clear cell on the same row.
  const spots = [[w[0] + 1, w[1] - 1], [w[0] - 3, w[1]], [w[0] + 2, w[1]], [w[0] - 2, w[1]]];
  for (let i = 0; i < spots.length; i++) {
    const x = spots[i][0], y = spots[i][1];
    if (y >= 0 && y < out.length && x >= 0 && x < out[y].length && out[y][x] === '0') return stamp(out, ['v'], x, y);
  }
  return out;
}
function pieceFrames(meat) {
  const shape = PIECE_SHAPE[meat];
  const done = stamp(paint(shape, MEAT_STATE.done), CHECK, CHECK_AT[meat][0], CHECK_AT[meat][1]);
  return [paint(shape, MEAT_STATE.raw), paint(shape, MEAT_STATE.cooking), done, paint(shape, MEAT_STATE.burnt), warnRows(meat)];
}

// 6x2 toppings for an 8x6 plate, in cooked colors.
const TOPPING = {
  sausage: ['qrrr..', '..qrrr'],
  chicken: ['qqrrrh', 'rrrr..'],
  ribs:    ['qhrhrh', 'rrrrrr'],
  butt:    ['q8q8r8', '8rq8rr'],
  brisket: ['111111', 'prrrrr']
};
// 2x1 toppings for the tray's small plates.
const TOPPING_SMALL = { sausage: 'qr', chicken: 'qh', ribs: 'rh', butt: '8r', brisket: '1r' };

const PLATE_BASE = paint(['..5555..', '.5hhhh5.', '5hhhhhh5', '5uhhhhu5', '.5uuuu5.', '..5555..']);

function plateRows(meat) { return stamp(PLATE_BASE, TOPPING[meat], 1, 1); }

const TRAY_BASE = paint(['........', '.55..55.', '5hh55hh5', '5uu55uu5', '55555555', '58888885', '57777775', '55555555']);
function trayRows(meat) {
  const t = [TOPPING_SMALL[meat]];
  return stamp(stamp(TRAY_BASE, t, 1, 2), t, 5, 2);
}
const HAND_TRAY_EMPTY = paint(['........', '........', '........', '........', '55555555', '58888885', '57777775', '55555555']);

// v2.1 ([T 4], round 2): a steel scoop heaped with black briquettes, single pixel grey glints and
// one ember, no cream, so it reads as coals over the head and on the chest alike. The steel is only
// the scoop rim ('s') and bowl ('t'); the charcoal itself never uses 't'.
const HAND_CHARCOAL = paint(['..1111..', '.1v2111.', '1211v211', '12214221', '5ssssss5', '.5tttt5.', '..5555..', '........']);
const HAND_BURNT = paint(['........', '..5555..', '.5v1115.', '5vv11115', '51111115', '51111115', '.511115.', '..5555..']);
const HAND_TOGO = paint(['...55...', '..5..5..', '.555555.', '5hhhhhu5', '5ooooor5', '5hhhhhu5', '5uuuuuu5', '.555555.']);

const ICON = {
  sausage: paint(['.....55.', '....5qq5', '...5qrr5', '..5qrr5.', '.5qrr5..', '5qrr5...', '5rr5....', '.55.....']),
  chicken: paint(['.5555...', '5qqrr5..', '5qrrrr5.', '5rrrrr5.', '.5rrr5..', '..55h5..', '...5hh5.', '...5555.']),
  ribs:    paint(['........', '55555555', '5qhrhrh5', '5rhrhrh5', '5rhrhrh5', '5rrrrrr5', '55555555', '........']),
  butt:    paint(['..5555..', '.5qqrr5.', '5qqrrrr5', '5qrrrrr5', '5rrrr1r5', '5rr1rrr5', '.5rrrr5.', '..5555..']),
  brisket: paint(['........', '.555555.', '51111115', '5pppppp5', '5qrrrrr5', '5rrrrrr5', '55555555', '........'])
};

const MARK_X = paint(['55....55', '5o5..5o5', '.5o55o5.', '..5oo5..', '..5oo5..', '.5o55r5.', '5o5..5r5', '55....55']);

/* ------------------------------------------------------------------ cookers */

// F cells are fire, painted by band: 0 out, 1 low, 2 good, 3 hot. `core(x, y)` marks hot cores.
function glow(rows, band, core) {
  return rows.map(function (r, y) {
    let s = '';
    for (let x = 0; x < r.length; x++) {
      const ch = r[x];
      if (ch !== 'F') { s += ch; continue; }
      if (band === 0) s += ((x * 3 + y) % 4 === 0) ? 'v' : '1';
      else if (band === 1) s += ((x + y) % 3 === 0) ? '4' : 'r';
      else if (band === 2) s += ((x + y) % 2 === 0) ? 'k' : '4';
      else if (core(x, y)) s += ((x + y) % 2 === 0) ? 'h' : 'k';
      else s += ((x + y) % 2 === 0) ? 'k' : '4';
    }
    return s;
  });
}

// Kettle on three legs: the lid hinged open behind the grate with a vent knob at column 11,
// the grate over the coals on rows 5 to 9, the bowl, an ash pan between the legs.
const KETTLE = [
  '..........5s5...',
  '....5555555555..',
  '...5sstttttttt5.',
  '..5sttttttttt15.',
  '.55555555555555.',
  '.5sF1FF1FF1FFt5.',
  '5sFF1FF1FF1FF1t5',
  '5sFF1FF1FF1FF1t5',
  '5sFF1FF1FF1FF1t5',
  '.5sF1FF1FF1FFt5.',
  '5hsssstttttttt15',
  '5hsstttttttttt15',
  '5sstttttttttt115',
  '.5stttttttttt15.',
  '.5sttttttttt115.',
  '..55tttttttt55..',
  '....55555555....',
  '...5s5.55.5t5...',
  '...5s5.55.5t5...',
  '..5s5tttttt5t5..',
  '..5s5......5t5..',
  '..5s5......5t5..',
  '.5s5........5t5.',
  '.555........555.'
];
function kettleFrames() {
  const core = function (x, y) { return x >= 5 && x <= 10 && y >= 6 && y <= 8; };
  return [0, 1, 2, 3].map(function (b) { return paint(glow(KETTLE, b, core)); });
}

// Upright drum on short legs: lid and vent on top (vent column 7), hoops, the intake low down.
// Painted 55 gallon drum: red body, a highlight stripe at columns 4 and 5, mahogany shade on the right.
const DRUM_BODY = '5ooohhoooooorr15';
const DRUM_HOOP = '5ssshhsssssstt15';
const DRUM = [
  '......5s5.......',
  '....555s5555....',
  '..55sssttttt55..',
  '.5ssttttttttt15.',
  '5555555555555555',
  DRUM_BODY, DRUM_BODY, DRUM_BODY, DRUM_BODY,
  DRUM_HOOP,
  DRUM_BODY, DRUM_BODY, DRUM_BODY, DRUM_BODY, DRUM_BODY, DRUM_BODY, DRUM_BODY,
  DRUM_HOOP,
  DRUM_BODY, DRUM_BODY,
  '5oooo555555rr115',
  '5oooo5FFFF5rr115',
  '5oooo5FFFF5rr115',
  '5oooo5FFFF5rr115',
  '5oooo555555rr115',
  DRUM_HOOP,
  '.55555555555555.',
  '..5s5......5t5..',
  '..5s5......5t5..',
  '..5s5......5t5..',
  '.5s5........5t5.',
  '.555........555.'
];
function drumFrames() {
  const core = function (x) { return x === 7 || x === 8; };
  return [0, 1, 2, 3].map(function (b) { return paint(glow(DRUM, b, core)); });
}

/* ------------------------------------------------------------------ stations */

function inner(c12) { return '.5' + c12 + '5.'; }

// Day 1 cooler (frame 0): a small red cooler, white lid with a handle, white band on the body.
const COOLER_CRATE = paint([
  '................', '................', '................',
  '..555555555555..',
  inner('hhhhhhhhhhh3'),
  inner('hhhhhsshhhh3'),
  inner('333333333333'),
  '.55555555555555.',
  inner('ooooooooooor'),
  inner('hhhhhhhhhhh3'),
  inner('ooooooooooor'),
  inner('ooooooooooor'),
  inner('ooooooooooor'),
  inner('rrrrrrrrrrrr'),
  '.55555555555555.',
  '................'
]);
const COOLER_BODY = [
  '.55555555555555.',
  inner('ffgggggggggg'),
  inner('fggggggggggt'),
  inner('fgggg55ggggt'),
  inner('fggggggggggt'),
  inner('fggggggggggt'),
  inner('gggggggggggt'),
  '.55555555555555.',
  '................'
];
const COOLER_SHUT = paint([
  '................', '................', '................',
  '..555555555555..',
  inner('hhhhhhhhhhhu'),
  inner('hhhh5555hhhu'),
  inner('uuuuuuuuuuuu')
].concat(COOLER_BODY));
const COOLER_OPEN = paint([
  '..555555555555..',
  inner('hhhhhhhhhhhu'),
  inner('uuuuuuuuuuuu'),
  inner('uuuuuuuuuuuu'),
  '.55555555555555.',
  inner('hfhhppfhhfhg'),
  inner('fhfpphhfhfhg')
].concat(COOLER_BODY));

const BOARD_BASE = paint([
  '................', '................',
  '.55555555555555.',
  inner('999999999998'),
  inner('988888888887'),
  inner('988888888887'),
  inner('988878888887'),
  inner('988888888887'),
  inner('988888788887'),
  inner('988888888887'),
  inner('988888888887'),
  inner('877777777776'),
  '.55555555555555.',
  '..5765....5765..',
  '..576577775765..',
  '..555555555555..'
]);
// The empty board shows a cleaver so it reads as the place to slice.
const BOARD_EMPTY = stamp(BOARD_BASE, paint(['.......5555.', '5555555shhs5', '5111115ssst5', '5555555tttt5', '.......5555.']), 2, 5);
const BOARD_BUSY = stamp(BOARD_BASE, paint(['555555555', '511111115', '5pppp5pp5', '5rrrr5rr5', '555555555']), 3, 4);

// The serving table under a sky blue cloth. Left or right end caps are optional so the
// extension can join on the left (counter frame 1 plus counter_ext).
function clothTable(w, leftCap, rightCap) {
  const g = new Grid(w, 24, '0');
  const x0 = leftCap ? 1 : 0, x1 = rightCap ? w - 2 : w - 1;
  for (let x = x0; x <= x1; x++) {
    for (let y = 2; y <= 10; y++) g.set(x, y, 'f');           // top of the cloth
    g.set(x, 2, 'h');                                          // light edge
    g.set(x, 11, 'h');                                         // the fold over the front edge
    for (let y = 12; y <= 19; y++) g.set(x, y, ((x - x0) % 6 === 5) ? 'g' : 'f');
    g.set(x, 19, 'g');
    g.set(x, 20, (x % 4 < 2) ? 'g' : 'f');                     // scalloped hem
  }
  if (leftCap) for (let y = 2; y <= 19; y++) g.set(x0, y, y === 11 ? 'h' : (y < 11 ? 'h' : 'f'));
  if (rightCap) for (let y = 3; y <= 20; y++) g.set(x1, y, 'g');
  // table legs peeking under the cloth
  const legs = [];
  if (leftCap) legs.push(x0 + 2);
  if (rightCap) legs.push(x1 - 3);
  if (!leftCap && !rightCap) legs.push(Math.floor(w / 2) - 1);
  legs.forEach(function (lx) { g.rect(lx, 21, 2, 2, '6'); g.set(lx, 21, '7'); });
  g.outline('5');
  return g.done();
}

// v2.1 charcoal ([T 4], round 2 repaint). The heap is pillow briquettes, each a warm near black body
// ('2', U) ringed in near black ('1') with one grey glint ('v') on its top left corner, glints
// staggered course to course so no two line up into a pattern, and no 't' (the kettle's steel). Every
// frame keeps a mound with a single peak. One ember with a yellow core ('4', 'k') glows low on the
// right of the full and half heaps. The paper sack stands behind on the right: kraft brown, wider
// than tall, a crimped rolled top, and a black flame with an orange core printed straight on the
// brown (no cream label). The heap stands in front of the sack's lower left corner. The shadow falls
// on the paver joint row (row 15) as solid outline brown with paverD ends.
const SACK_UP = [
  '.5.5.5.5.',
  '.5878785.',
  '.5666665.',
  '588888775',
  '588818775',
  '588111775',
  '581141775',
  '581111775',
  '588111765',
  '587777665',
  '.5555555.'
];
// Low pile: the same sack slumped, a shorter body under the same rolled top.
const SACK_SLUMP = [
  '.5.5.5.5.',
  '.5878785.',
  '.5666665.',
  '588818775',
  '581141775',
  '581111765',
  '587777665',
  '.5555555.'
];
const HEAP = {
  full: [
    '.....11.....',
    '....1v21....',
    '..1112211...',
    '.1v211v211..',
    '.1222122211.',
    '1v2114v21v21',
    '122214k22221',
    '111111111111'
  ],
  half: [
    '............',
    '...11.111...',
    '..1v21v221..',
    '.11221122211',
    '1v2114v21v21',
    '122214k22221',
    '111111111111'
  ],
  // A small mound of three pillows plus one loose crumb.
  low: [
    '............',
    '..111.......',
    '.1v2211.....',
    '1v211v21....',
    '12221222111.',
    '11111111.1v1'
  ]
};
// Empty: the sack folded flat on the pavers, crimped ends, the rolled end on the left, a small black
// flame lying on the kraft brown, and a loose crumb on the pavers to the right (no grey glint and no
// ember: the empty frame carries no t, v, u, 4 or k, contract K11 step 14).
const SACK_FLAT = [
  '................',
  '..5.5.5.5555....',
  '.5876888888885..',
  '58766881118775..',
  '.5776811118875.1',
  '..555555555555.1'
];
const PILE_SHADOW = '.a555555555555a.';
function pileFrames() {
  function frame(sack, sackY, heap) {
    let rows = blank(16, 16);
    rows = stamp(rows, sack, 7, sackY);
    if (heap) rows = stamp(rows, heap, 0, 15 - heap.length);
    rows[15] = PILE_SHADOW;
    return paint(rows);
  }
  const empty = paint(patch(stamp(blank(16, 16), SACK_FLAT, 0, 9), { 15: '.a55555555555a..' }));
  return [
    frame(SACK_UP, 4, HEAP.full),
    frame(SACK_UP, 4, HEAP.half),
    frame(SACK_SLUMP, 7, HEAP.low),
    empty
  ];
}

const TRASH = paint([
  '................',
  '......5555......',
  '......5ss5......',
  '..555555555555..',
  '.5hhssssssssst5.',
  '.5sssssssssst15.',
  '.55555555555555.',
  '..5stttttttt15..',
  '..5stttttttt15..',
  '..5sssssssst15..',
  '..5stttttttt15..',
  '..5stttttttt15..',
  '..5sssssssst15..',
  '..5stttttttt15..',
  '...5555555555...',
  '................'
]);

/* ------------------------------------------------------------------ ground */

// Warm pavers. Joints run along row 15 and column 15 in both frames, so any mix tiles.
function paverFrame(alt) {
  const g = new Grid(16, 16, '9');
  const stones = alt ? [[0, 0, 16, 8], [0, 8, 8, 8], [8, 8, 8, 8]] : [[0, 0, 8, 8], [8, 0, 8, 8], [0, 8, 8, 8], [8, 8, 8, 8]];
  stones.forEach(function (s, i) {
    const x = s[0], y = s[1], w = s[2], h = s[3];
    g.rect(x, y + h - 1, w, 1, 'a');                        // joint below
    g.rect(x + w - 1, y, 1, h, 'a');                        // joint right
    g.rect(x, y, w - 1, 1, '3');                            // light top edge
    g.rect(x, y, 1, h - 1, '3');                            // light left edge
    g.set(x + w - 2, y + h - 2, 'a');                       // shaded corner
    for (let j = 1; j < h - 2; j++) {
      for (let k = 1; k < w - 2; k++) if (hash(x + k, y + j, 7 + i + (alt ? 9 : 0)) < 0.06) g.set(x + k, y + j, 'a');
    }
  });
  return g.done();
}

// Mowed lawn: stripe a is light, stripe b darker. Frame 1 adds a clover patch.
function lawnFrame(base, tuft, hi, clover, seed) {
  const g = new Grid(16, 16, base);
  const spots = [[3, 4], [10, 2], [7, 9], [13, 12], [2, 13]];
  spots.forEach(function (p, i) {
    const x = p[0] + (hash(i, seed, 3) < 0.5 ? 0 : 1), y = p[1];
    g.set(x - 1, y - 1, tuft); g.set(x + 1, y - 1, tuft); g.set(x, y, tuft);
    g.set(x - 1, y - 2, hi);
  });
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) if (hash(x, y, seed) < 0.04 && g.get(x, y) === base) g.set(x, y, hi);
  }
  if (clover) {
    [[5, 6], [11, 8], [8, 12]].forEach(function (p) {
      const x = p[0], y = p[1];
      g.set(x, y - 1, 'e'); g.set(x - 1, y, 'e'); g.set(x + 1, y, 'e'); g.set(x, y + 1, 'd');
      g.set(x, y, 'h');
    });
  }
  return g.done();
}

// Back and bottom fence: a post with a cap, two rails running left to right.
function fenceH() {
  const g = new Grid(16, 24, '0');
  [[6, 8], [14, 16]].forEach(function (r) {
    g.rect(0, r[0], 16, 1, '8'); g.rect(0, r[0] + 1, 16, 1, '7'); g.rect(0, r[1], 16, 1, '6');
  });
  g.rect(1, 3, 3, 19, '7'); g.rect(1, 3, 1, 19, '8'); g.rect(3, 3, 1, 19, '6');
  g.rect(1, 2, 3, 1, '9');
  g.outline('5');
  return g.done();
}

// Side fence seen edge on: the rail tops as a strip, one post per tile.
function fenceV() {
  const g = new Grid(16, 24, '0');
  g.rect(6, 0, 4, 24, '7'); g.rect(6, 0, 1, 24, '8'); g.rect(9, 0, 1, 24, '6');
  g.rect(5, 3, 6, 15, '7'); g.rect(5, 3, 1, 15, '8'); g.rect(10, 3, 1, 15, '6');
  g.rect(5, 2, 6, 2, '9'); g.rect(10, 2, 1, 2, '8');
  g.outline('5');
  return g.done();
}

// Back fence row (y = 0) in 16 px so it sits inside the canvas: the post cap, two rails.
function fenceBack(corner) {
  const g = new Grid(16, 16, '0');
  if (corner) {
    g.rect(4, 2, 8, 12, '7'); g.rect(4, 2, 2, 12, '8'); g.rect(10, 2, 2, 12, '6');
    g.rect(4, 1, 8, 1, '9'); g.rect(10, 1, 2, 1, '8');
    g.rect(6, 5, 4, 1, '6'); g.rect(6, 10, 4, 1, '6');
  } else {
    [3, 9].forEach(function (y) { g.rect(0, y, 16, 1, '8'); g.rect(0, y + 1, 16, 1, '7'); g.rect(0, y + 2, 16, 1, '6'); });
    g.rect(1, 2, 3, 12, '7'); g.rect(1, 2, 1, 12, '8'); g.rect(3, 2, 1, 12, '6');
    g.rect(1, 1, 3, 1, '9');
  }
  g.outline('5');
  return g.done();
}

function fenceCorner() {
  const g = new Grid(16, 24, '0');
  g.rect(4, 3, 8, 19, '7'); g.rect(4, 3, 2, 19, '8'); g.rect(10, 3, 2, 19, '6');
  g.rect(4, 1, 8, 2, '9'); g.rect(10, 1, 2, 2, '8');
  g.rect(6, 7, 4, 1, '6'); g.rect(6, 15, 4, 1, '6');
  g.outline('5');
  return g.done();
}

function gateShut() {
  const g = new Grid(16, 24, '0');
  g.rect(1, 5, 14, 3, '7'); g.rect(1, 5, 14, 1, '8');          // top rail
  g.rect(1, 17, 14, 3, '7'); g.rect(1, 17, 14, 1, '8');        // bottom rail
  g.rect(1, 5, 2, 16, '7'); g.rect(1, 5, 1, 16, '8');          // stiles
  g.rect(13, 5, 2, 16, '7'); g.rect(14, 5, 1, 16, '6');
  for (let i = 0; i < 9; i++) { g.set(3 + i, 16 - i, '6'); g.set(4 + i, 16 - i, '7'); }  // brace
  [5, 8, 11].forEach(function (x) { g.rect(x, 8, 1, 9, '7'); });                       // pickets
  g.set(13, 11, 's'); g.set(13, 12, 't');                       // latch
  g.outline('5');
  return g.done();
}
function gateOpen() {
  const g = new Grid(16, 24, '0');
  g.rect(12, 1, 3, 20, '7'); g.rect(12, 1, 1, 20, '8'); g.rect(14, 1, 1, 20, '6');
  g.rect(12, 1, 3, 1, '9');
  g.rect(12, 5, 3, 1, '6'); g.rect(12, 17, 3, 1, '6');
  g.outline('5');
  return g.done();
}

// Rounded boxwood with height. hedgeBlossomRows() is the same bush with blossoms on the lit top.
function hedgeBlossomRows() { return hedgeRows(true); }
function hedgeRows(blossom) {
  const g = new Grid(16, 24, '0');
  g.ellipse(1, 1, 14, 14, 'c');
  g.rect(1, 8, 14, 13, 'c');
  g.set(1, 20, '0'); g.set(14, 20, '0');
  for (let y = 0; y < 24; y++) {
    for (let x = 0; x < 16; x++) {
      if (g.get(x, y) !== 'c') continue;
      const h = hash(x, y, 11);
      if (y >= 12) g.set(x, y, h < 0.25 ? 'c' : 'd');                 // front face in shade
      else if (x + y < 10) g.set(x, y, h < 0.35 ? 'e' : 'b');          // lit top left
      else if (h < 0.2) g.set(x, y, 'b');
      else if (h > 0.85) g.set(x, y, 'd');
      if (y === 11 || y === 12) g.set(x, y, h < 0.5 ? 'c' : 'd');
    }
  }
  if (blossom) {
    [[4, 4, 'i', 'j'], [9, 3, 'k', '8'], [12, 7, 'i', 'j'], [6, 8, 'k', '8']].forEach(function (b) {
      if (g.get(b[0], b[1]) === '0' || g.get(b[0], b[1] + 1) === '0') return;
      g.set(b[0], b[1], b[2]); g.set(b[0] + 1, b[1], b[2]); g.set(b[0], b[1] + 1, b[3]);
    });
  }
  g.outline('5');
  return g.done();
}

// Wood edged flower bed, blooms poking 4 px above the tile. kinds: 0 pink, 1 yellow, 2 mixed.
const BLOOM = {
  pink:   { p: 'i', s: 'j', c: 'k' },
  yellow: { p: 'k', s: '8', c: '6' },
  white:  { p: 'h', s: 'u', c: 'k' }
};
function bedFrame(kind) {
  const g = new Grid(16, 20, '0');
  g.rect(1, 6, 14, 9, 'n');                                    // soil
  for (let x = 1; x < 15; x++) if (hash(x, 3, kind) < 0.3) g.set(x, 7 + (x % 3), '6');
  g.rect(1, 15, 14, 3, '7'); g.rect(1, 15, 14, 1, '8'); g.rect(1, 17, 14, 1, '6');   // front board
  g.rect(1, 5, 1, 10, '7'); g.rect(14, 5, 1, 10, '6'); g.rect(1, 5, 14, 1, '7');     // side boards
  [[3, 9], [7, 8], [11, 10], [5, 12], [10, 13], [13, 7]].forEach(function (p, i) {   // foliage clumps
    g.ellipse(p[0] - 2, p[1] - 2, 5, 4, i % 2 ? 'd' : 'c');
    g.set(p[0] - 1, p[1] - 2, 'e');
  });
  g.outline('5');
  const kinds = kind === 0 ? ['pink', 'pink', 'pink', 'pink', 'pink'] :
    kind === 1 ? ['yellow', 'yellow', 'yellow', 'yellow', 'yellow'] : ['pink', 'yellow', 'white', 'yellow', 'pink'];
  [[3, 2], [8, 1], [12, 3], [5, 7], [10, 6]].forEach(function (p, i) {
    const b = BLOOM[kinds[i]], x = p[0], y = p[1];
    g.set(x, y + 2, 'd'); g.set(x, y + 3, 'd');                 // stem
    g.set(x, y - 1, b.p); g.set(x - 1, y, b.p); g.set(x + 1, y, b.s); g.set(x, y + 1, b.s);
    g.set(x - 1, y - 1, '0'); g.set(x, y, b.c);
  });
  return g.done();
}

// Bed frame 3: the same wood box with tilled soil and nothing planted (the Flower bed not bought).
function soilFrame() {
  const g = new Grid(16, 20, '0');
  g.rect(1, 6, 14, 9, '6');                                    // tilled soil
  for (let y = 7; y < 15; y += 3) g.rect(2, y, 12, 1, '7');    // furrow ridges, lit
  for (let x = 2; x < 14; x++) if (hash(x, 9, 7) < 0.3) g.set(x, 8 + (x % 2) * 3, 'n');
  g.rect(1, 15, 14, 3, '7'); g.rect(1, 15, 14, 1, '8'); g.rect(1, 17, 14, 1, '6');   // front board
  g.rect(1, 5, 1, 10, '7'); g.rect(14, 5, 1, 10, '6'); g.rect(1, 5, 14, 1, '7');     // side boards
  g.outline('5');
  return g.done();
}

/* ------------------------------------------------------------------ fixed props */

// Shed wall along the top edge: red roof edge, boards, a window with a flower box, a door.
function shedRows() {
  const g = new Grid(48, 32, '0');
  for (let y = 0; y <= 5; y++) {
    for (let x = 0; x < 48; x++) {
      let c = 'o';
      if (y === 2 || y === 5) c = 'r';
      else if ((y < 2 && x % 6 === 0) || (y > 2 && x % 6 === 3)) c = 'r';
      else if ((y === 0 && x % 6 === 1) || (y === 3 && x % 6 === 4)) c = 'p';
      g.set(x, y, c);
    }
  }
  g.rect(0, 6, 48, 1, '5'); g.rect(1, 7, 46, 1, '6');           // eave and its shadow
  for (let y = 8; y <= 30; y++) {
    for (let x = 1; x < 47; x++) g.set(x, y, x % 4 === 0 ? '6' : (x % 4 === 1 ? '8' : '7'));
  }
  // window
  g.rect(5, 10, 12, 9, '5');
  g.rect(6, 11, 10, 7, 'h');
  g.rect(7, 12, 3, 2, 'f'); g.rect(11, 12, 4, 2, 'f');
  g.rect(7, 15, 3, 2, 'f'); g.rect(11, 15, 4, 2, 'f');
  g.set(7, 12, 'h'); g.set(11, 12, 'h'); g.set(9, 16, 'g'); g.set(14, 16, 'g'); g.set(14, 13, 'g');
  // flower box under the window
  g.rect(4, 19, 14, 4, '5'); g.rect(5, 20, 12, 2, '7'); g.rect(5, 20, 12, 1, '8');
  [[6, 18, 'i'], [8, 17, 'k'], [10, 18, 'j'], [12, 17, 'i'], [14, 18, 'k'], [16, 17, 'h']].forEach(function (f) {
    g.set(f[0], f[1], f[2]); g.set(f[0] + 1, f[1] + 1, 'd'); g.set(f[0] - 1, f[1] + 1, 'c');
  });
  // door
  g.rect(28, 11, 13, 20, '5');
  g.rect(29, 12, 11, 19, '6');
  g.rect(30, 13, 4, 7, '7'); g.rect(35, 13, 4, 7, '7');
  g.rect(30, 22, 4, 7, '7'); g.rect(35, 22, 4, 7, '7');
  g.rect(30, 13, 4, 1, '8'); g.rect(35, 13, 4, 1, '8'); g.rect(30, 22, 4, 1, '8'); g.rect(35, 22, 4, 1, '8');
  g.set(38, 21, 'k'); g.set(38, 20, 'h');
  // a lantern by the door
  g.rect(43, 12, 3, 4, '5'); g.set(44, 13, 'k'); g.set(44, 14, 'k');
  g.rect(0, 31, 48, 1, '5'); g.rect(0, 7, 1, 25, '5'); g.rect(47, 7, 1, 25, '5');
  return g.done();
}

// The yard sign (v3.0, W16.2): umber board, orange border, 62 wide, posts at x 7 and 53. The pit
// name is drawn on it by game.js through textFit (text area x 2 to 59, rows 3 to 8).
function signRows() {
  const g = new Grid(62, 12, '0');
  g.rect(0, 0, 62, 10, '5');
  g.rect(1, 1, 60, 8, '4');
  g.rect(2, 2, 58, 7, '2');
  g.rect(1, 9, 60, 1, '4');
  g.rect(2, 2, 58, 1, '1');
  g.rect(7, 10, 2, 2, '6'); g.rect(53, 10, 2, 2, '6');
  g.set(7, 10, '5'); g.set(53, 10, '5');
  return g.done();
}

// Round leafy canopy 32x32 over a trunk standing in the anchor tile (columns 16 to 31).
function treeRows() {
  const g = new Grid(32, 48, '0');
  g.rect(19, 26, 6, 19, '7'); g.rect(19, 26, 1, 19, '8'); g.rect(24, 26, 1, 19, '6');
  g.rect(17, 43, 10, 2, '7'); g.rect(17, 43, 2, 2, '8'); g.rect(25, 43, 2, 2, '6');
  g.set(21, 32, '6'); g.set(22, 36, '6'); g.set(21, 40, '6');
  [[1, 7, 14, 14], [6, 1, 16, 14], [14, 2, 16, 14], [17, 10, 14, 14], [3, 14, 17, 14], [12, 15, 18, 14], [8, 6, 16, 16]]
    .forEach(function (b) { g.ellipse(b[0], b[1], b[2], b[3], 'c'); });
  const leaf = function (x, y) { return 'bcde'.indexOf(g.get(x, y)) >= 0; };
  const shade = [];
  for (let y = 0; y < 32; y++) {
    for (let x = 0; x < 32; x++) {
      if (g.get(x, y) !== 'c') continue;
      const h = hash(x, y, 21);
      if (!leaf(x - 1, y - 1) || !leaf(x, y - 1)) shade.push([x, y, 'b']);
      else if (!leaf(x + 1, y + 1) || !leaf(x, y + 1)) shade.push([x, y, 'd']);
      else if (y > 20 && x > 10) shade.push([x, y, h < 0.5 ? 'd' : 'c']);
      else if (h < 0.10) shade.push([x, y, 'e']);
      else if (h < 0.25) shade.push([x, y, 'b']);
      else if (h > 0.88) shade.push([x, y, 'd']);
    }
  }
  shade.forEach(function (s) { g.set(s[0], s[1], s[2]); });
  [[7, 10], [16, 6], [23, 14], [11, 20], [20, 22]].forEach(function (a) {       // apples
    g.set(a[0], a[1], 'o'); g.set(a[0] + 1, a[1], 'o'); g.set(a[0], a[1] + 1, 'r'); g.set(a[0] + 1, a[1] + 1, 'o');
    g.set(a[0], a[1], 'p');
  });
  g.outline('5');
  return g.done();
}

const LOG = ['.555.', '59885', '58785', '58875', '.555.'];
function woodpileRows() {
  let rows = blank(16, 16);
  [[2, 11], [6, 11], [10, 11], [4, 7], [8, 7], [6, 3]].forEach(function (p) { rows = stamp(rows, LOG, p[0], p[1]); });
  return paint(rows);
}

function hoseRows() {
  const g = new Grid(16, 16, '0');
  g.rect(6, 0, 4, 2, '7'); g.rect(6, 0, 4, 1, '8'); g.set(9, 1, '6');           // wall hanger
  // two loops of green hose, each a 2 px ring, the front one lower, so the coil reads
  [[1, 1, 13, 10], [2, 3, 13, 10]].forEach(function (b) {
    const cx = b[0] + (b[2] - 1) / 2, cy = b[1] + (b[3] - 1) / 2, rx = b[2] / 2, ry = b[3] / 2;
    for (let y = b[1]; y < b[1] + b[3]; y++) {
      for (let x = b[0]; x < b[0] + b[2]; x++) {
        const dx = (x - cx) / rx, dy = (y - cy) / ry, r = Math.sqrt(dx * dx + dy * dy);
        const inner = 1 - 2.2 / Math.min(rx, ry);
        if (r > 1 || r < inner) continue;
        g.set(x, y, (dx < -0.2 && dy < 0.1) || dy < -0.6 ? 'b' : (dx > 0.3 && dy > 0.1 ? 'd' : 'c'));
      }
    }
  });
  g.set(3, 4, 'e'); g.set(4, 3, 'e');
  g.rect(13, 10, 1, 2, 'c'); g.rect(12, 12, 2, 2, 'k'); g.set(13, 13, '8');     // hose end and brass nozzle
  g.outline('5');
  return g.done();
}

function toolsRows() {
  const g = new Grid(16, 24, '0');
  g.rect(7, 3, 2, 18, '7'); g.set(7, 3, '8'); g.rect(7, 4, 1, 17, '8');
  g.rect(5, 20, 6, 2, '6'); g.rect(5, 20, 6, 1, '7');            // foot
  g.rect(1, 3, 14, 2, '7'); g.rect(1, 3, 14, 1, '8');            // rack bar
  g.rect(3, 5, 1, 5, '6'); g.rect(2, 10, 3, 4, 's'); g.rect(2, 10, 1, 4, 'h'); g.rect(4, 11, 1, 3, 't');   // spatula
  g.rect(10, 5, 1, 9, 's'); g.rect(12, 5, 1, 9, 't'); g.set(11, 5, 's'); g.set(10, 14, 't'); g.set(12, 14, 't');  // tongs
  g.rect(14, 5, 1, 5, '7'); g.rect(13, 10, 3, 3, 'k'); g.rect(13, 12, 3, 1, '8');   // brush
  g.outline('5');
  return g.done();
}

function potRows() {
  const g = new Grid(16, 16, '0');
  g.ellipse(2, 0, 12, 10, 'c');
  for (let y = 0; y < 10; y++) {
    for (let x = 0; x < 16; x++) {
      if (g.get(x, y) !== 'c') continue;
      const h = hash(x, y, 31);
      if (x + y < 9) g.set(x, y, h < 0.4 ? 'e' : 'b');
      else if (x > 9 || y > 7) g.set(x, y, h < 0.5 ? 'd' : 'c');
      else if (h < 0.2) g.set(x, y, 'e');
    }
  }
  g.rect(3, 8, 10, 2, '8'); g.rect(3, 8, 10, 1, 'q');            // rim
  g.rect(4, 10, 8, 4, 'q'); g.rect(4, 10, 1, 4, '8'); g.rect(10, 10, 2, 4, 'r');
  g.rect(5, 14, 6, 1, 'r');
  g.outline('5');
  return g.done();
}

// Sauce rack: two planks on wooden posts, three bottles with cream labels on the top plank and
// a steel tub on the bottom one.
function shelfRows() {
  const g = new Grid(16, 24, '0');
  g.rect(2, 4, 2, 19, '6'); g.rect(12, 4, 2, 19, '6');          // posts
  [[4, 'o'], [7, 'k'], [10, 'r']].forEach(function (b) {          // bottles, 2x5 on the top plank
    g.rect(b[0], 6, 2, 5, b[1]); g.rect(b[0], 8, 2, 1, '3');
  });
  g.rect(5, 15, 6, 4, 't'); g.rect(5, 15, 6, 1, 's'); g.set(5, 16, 's');   // tub on the bottom plank
  [11, 19].forEach(function (y) { g.rect(1, y, 14, 1, '8'); g.rect(1, y + 1, 14, 1, '7'); });   // planks
  g.outline('5');
  return g.done();
}

const SUNFLOWER = ['.kkk.', 'kh66k', 'k666k', 'kk6k8', '.k88.'];
function planterRows() {
  const g = new Grid(16, 24, '0');
  [[4, 6, 14], [8, 3, 14], [12, 7, 14]].forEach(function (s) { g.rect(s[0], s[1], 1, s[2] - s[1], 'd'); });
  [[2, 10], [5, 8], [9, 9], [12, 11]].forEach(function (l) { g.rect(l[0], l[1], 3, 2, 'c'); g.set(l[0], l[1], 'e'); });
  g.rect(2, 14, 12, 8, '7');
  for (let x = 2; x < 14; x++) if (x % 3 === 1) g.rect(x, 14, 1, 8, '6');
  g.rect(2, 14, 1, 8, '8'); g.rect(13, 14, 1, 8, '6');
  g.rect(2, 15, 12, 1, 't'); g.rect(2, 20, 12, 1, 't');
  g.rect(2, 14, 12, 1, '8');
  g.outline('5');
  let rows = g.done();
  [[2, 2], [6, 0], [10, 3]].forEach(function (p) {
    const s = new Grid(7, 7, '0');
    s.stamp(SUNFLOWER, 1, 1);
    s.outline('5');
    rows = stamp(rows, s.done(), p[0] - 1, p[1] - 1);
  });
  return rows;
}

function mailboxRows() {
  const g = new Grid(16, 24, '0');
  g.rect(7, 12, 2, 11, '7'); g.rect(7, 12, 1, 11, '8');          // post
  g.rect(2, 5, 11, 8, 'o');
  g.rect(3, 4, 9, 1, 'o');
  g.rect(3, 4, 6, 1, 'p'); g.rect(2, 5, 1, 7, 'p');               // light edge
  g.rect(3, 11, 10, 1, 'r'); g.rect(12, 5, 1, 7, 'r');            // shade
  g.rect(2, 6, 2, 6, 'r'); g.set(2, 6, 'o');                     // the door seam
  g.rect(13, 1, 1, 8, 's');                                       // flag pole
  g.rect(13, 1, 3, 3, 'k'); g.set(15, 3, '8');                   // flag up
  g.outline('5');
  return g.done();
}

// Picnic table: the top 8 rows stay empty (the far bench is its own sprite), then the top,
// the legs and the near bench.
function picnicRows() {
  const g = new Grid(32, 24, '0');
  g.rect(3, 15, 3, 7, '6'); g.rect(26, 15, 3, 7, '6');            // legs
  g.rect(1, 8, 30, 6, '8');
  g.rect(1, 8, 30, 1, '9');
  g.rect(1, 10, 30, 1, '7'); g.rect(1, 12, 30, 1, '7');           // plank seams
  g.rect(1, 14, 30, 1, '7'); g.rect(1, 15, 30, 1, '6');           // front edge
  g.rect(1, 18, 30, 2, '8'); g.rect(1, 18, 30, 1, '9');           // near bench
  g.rect(1, 20, 30, 1, '7');
  g.rect(3, 21, 2, 2, '6'); g.rect(27, 21, 2, 2, '6');
  g.outline('5');
  return g.done();
}
function picnicBenchRows() {
  const g = new Grid(32, 8, '0');
  g.rect(1, 1, 30, 3, '8'); g.rect(1, 1, 30, 1, '9'); g.rect(1, 4, 30, 1, '6');
  g.rect(3, 5, 2, 2, '6'); g.rect(27, 5, 2, 2, '6');
  g.outline('5');
  return g.done();
}

/* ------------------------------------------------------------------ decor and gear props */

function chairRows() {
  const g = new Grid(16, 24, '0');
  for (let x = 1; x <= 14; x++) {
    const k = (x - 1) % 4;
    if (k === 3) continue;
    g.rect(x, x >= 4 && x <= 11 ? 1 : 3, 1, 11 - (x >= 4 && x <= 11 ? 0 : 2), k === 0 ? '8' : '7');
  }
  g.rect(1, 9, 14, 1, '6');                                      // back cross rail
  g.rect(0, 12, 3, 2, '8'); g.rect(13, 12, 3, 2, '7');            // arm rests
  g.rect(0, 14, 2, 1, '6'); g.rect(14, 14, 2, 1, '6');
  g.rect(2, 13, 12, 4, '7'); g.rect(2, 13, 12, 2, '8');           // seat
  g.rect(2, 17, 12, 1, '6');
  g.rect(2, 18, 2, 4, '7'); g.rect(12, 18, 2, 4, '6');            // legs
  g.outline('5');
  return g.done();
}

function lightsPostRows() {
  const g = new Grid(16, 32, '0');
  g.rect(6, 3, 4, 28, '7'); g.rect(6, 3, 1, 28, '8'); g.rect(9, 3, 1, 28, '6');
  g.rect(6, 2, 4, 1, '9');
  g.outline('5');
  g.set(7, 0, 't'); g.set(8, 0, 't'); g.set(7, 1, 's'); g.set(8, 1, '5');   // the hook
  [[4, 28], [10, 27], [11, 29], [3, 30], [5, 26]].forEach(function (p) { g.set(p[0], p[1], 'c'); g.set(p[0], p[1] + 1, 'd'); });
  return g.done();
}

// The sagging wire from hook to hook (columns 0 and 65), ten bulbs; frames swap which glow.
function lightsStringFrame(frame) {
  const g = new Grid(66, 10, '0');
  const sag = function (x) { const t = (x - 32.5) / 32.5; return 1 + Math.round(5 * (1 - t * t)); };
  for (let x = 0; x < 66; x++) g.set(x, sag(x), '5');
  g.set(0, 0, '5'); g.set(65, 0, '5');
  const lit = { k: 'k', i: 'i', f: 'f', h: 'h' };
  const dim = { k: '8', i: 'j', f: 'g', h: 'u' };
  const colors = ['k', 'i', 'f', 'h'];
  for (let b = 0; b < 10; b++) {
    const x = 4 + b * 6, y = sag(x);
    const c = colors[b % 4];
    const on = (b + frame) % 2 === 0;
    g.set(x, y + 1, 't'); g.set(x + 1, y + 1, 't');
    if (on) {
      g.set(x, y + 2, 'h'); g.set(x + 1, y + 2, lit[c]); g.set(x, y + 3, lit[c]); g.set(x + 1, y + 3, lit[c]);
    } else {
      g.set(x, y + 2, dim[c]); g.set(x + 1, y + 2, dim[c]); g.set(x, y + 3, dim[c]); g.set(x + 1, y + 3, dim[c]);
    }
  }
  return g.done();
}

function birdbathFrame(bird) {
  const g = new Grid(16, 24, '0');
  g.rect(4, 20, 8, 2, 's'); g.rect(4, 20, 8, 1, 'h'); g.rect(10, 21, 2, 1, 't');   // base
  g.rect(6, 12, 4, 8, 's'); g.rect(6, 12, 1, 8, 'h'); g.rect(9, 12, 1, 8, 't');    // pedestal
  g.ellipse(1, 6, 14, 7, 's');                                    // bowl
  g.rect(2, 11, 12, 1, 't');
  g.ellipse(3, 7, 10, 3, 'f');                                    // water
  g.set(5, 7, 'h'); g.set(6, 7, 'h'); g.set(10, 9, 'g'); g.set(11, 8, 'g');
  g.set(2, 8, 'h');
  if (bird) {
    g.rect(11, 3, 3, 3, '6'); g.set(11, 4, 'o'); g.set(11, 5, 'o');   // body, red breast
    g.set(10, 3, '6'); g.set(10, 2, '6'); g.set(9, 3, 'k');           // head and beak
    g.set(10, 3, '1');
    g.set(14, 4, '6'); g.set(15, 4, '6');                              // tail
  }
  g.outline('5');
  return g.done();
}

// The Canopy gear: a striped patio umbrella; canvas on rows 0 to 11, pole on columns 19 and 20.
function canopyRows() {
  const g = new Grid(40, 32, '0');
  g.rect(19, 12, 1, 19, 's'); g.rect(20, 12, 1, 19, 't');
  g.rect(18, 30, 4, 1, 't');
  for (let y = 1; y <= 10; y++) {
    const hw = Math.min(19, 2 + y * 1.8);
    for (let x = 0; x < 40; x++) {
      const u = (x - 19.5) / hw;
      if (u < -1 || u > 1) continue;
      const panel = Math.floor((u + 1) * 4);
      let c = panel % 2 === 0 ? '4' : '3';
      if (y === 10) c = (x % 4 < 2) ? c : '0';               // scalloped edge
      if (y === 1 || (u < -0.7 && y < 8)) c = c === '4' ? '8' : (c === '3' ? 'h' : c);   // light side
      g.set(x, y, c);
    }
  }
  g.set(19, 0, 's'); g.set(20, 0, 't');
  g.outline('5');
  return g.done();
}

/* ------------------------------------------------------------------ effects */

// Speech bubble, tail at the bottom left corner. Icon slot (4,2), plate slot (4,3).
const BUBBLE = paint([
  '.55555555555555.',
  '5hh33333333333a5',
  '5h333333333333a5',
  '5h333333333333a5',
  '5h333333333333a5',
  '5h333333333333a5',
  '5h333333333333a5',
  '5h333333333333a5',
  '5h333333333333a5',
  '5333333333333aa5',
  '5355555555555555',
  '55..............'
]);

const HEART = [
  paint(['.55..55.', '5hi55ij5', '5iijjjj5', '5ijjjjj5', '.5jjjj5.', '..5jj5..', '...55...', '........']),
  paint(['........', '.55.55..', '5hj5jj5.', '5jjjjj5.', '.5jjj5..', '..5j5...', '...5....', '........'])
];

const SPARKLE = [
  paint(['.......', '.......', '...k...', '..khk..', '...k...', '.......', '.......']),
  paint(['...k...', '...h...', '..khk..', 'khhhhhk', '..khk..', '...h...', '...k...']),
  paint(['.......', '...k...', '.......', '.k.h.k.', '.......', '...k...', '.......'])
];

const SMOKE = [
  paint(['........', '........', '........', '...uu...', '..huuu..', '..uuus..', '...ss...', '........']),
  paint(['........', '...uu...', '..huuu..', '.huuuuu.', '.uuuuus.', '.uuusss.', '..ssss..', '........']),
  paint(['..uuuu..', '.huuuuu.', 'huuuuuuu', 'uuuuuuus', 'uuuuusss', '.uuussss', '..ssss..', '........'])
];
const SMOKE_DARK = SMOKE.map(function (f) { return recolor(f, { u: 'v', h: 's', s: 't' }); });

// v2.1 tutorial arrow ([T 2.6], [T 4]): chunky gold, one white glint, outline brown, 8 wide and
// 9 tall. Frame 1 is frame 0 two rows lower (the bob toward the target); frames 2 and 3 are
// frames 0 and 1 with the row order reversed, pointing up.
const ARROW_DOWN = paint([
  '..5555..',
  '..5hk5..',
  '..5kk5..',
  '..5kk5..',
  '555kk555',
  '5kkkkkk5',
  '.5kkkk5.',
  '..5kk5..',
  '...55...',
  '........',
  '........',
  '........'
]);
const ARROW_BOB = blank(8, 2).concat(ARROW_DOWN.slice(0, 10));
const ARROW = [ARROW_DOWN, ARROW_BOB, ARROW_DOWN.slice().reverse(), ARROW_BOB.slice().reverse()];

// v2.1 about to burn bubble ([T 3.4], [T 4]), round 2: a red card ('o') with a white '!' ('h'), a
// cream glint on its lit top left corner and a short tail at the bottom center, so it pops against
// the pavers and the cream and orange sign. The blink frame turns the card yellow and the mark dark.
const BUBBLE_WARN_RED = paint([
  '.555555.',
  '53ooooo5',
  '5oohhoo5',
  '5oohhoo5',
  '5oohhoo5',
  '5oooooo5',
  '5oohhoo5',
  '5oooooo5',
  '.555o55.',
  '....5...'
]);
const BUBBLE_WARN = [BUBBLE_WARN_RED, recolor(BUBBLE_WARN_RED, { o: 'k', h: '5' })];

const FIRE = [
  paint(['........', '...4....', '...44...', '..4k4...', '..4kk4..', '.44khk4.', '.4kkkk4.', '..4444..']),
  paint(['....4...', '...44...', '...4k4..', '..4kk4..', '.44khk4.', '.4khhk4.', '.4kkkk4.', '..4444..']),
  paint(['........', '..4..4..', '..44.4..', '.4k44k4.', '.4kkkk4.', '.4khhk4.', '.44kk44.', '..4444..'])
];

const COIN = [
  paint(['..5555..', '.5hkkk5.', '5hk88k85', '5k8kk885', '5k8kk885', '5kk88885', '.588885.', '..5555..']),
  paint(['...55...', '..5hk5..', '..5k85..', '..5k85..', '..5k85..', '..5k85..', '..5885..', '...55...'])
];

const SWEAT = [
  paint(['.g..', '.fg.', 'ghfg', 'gffg', '.gg.', '....']),
  paint(['....', '....', 'h..h', 'f..f', '.ff.', 'g..g'])
];

const Z3 = ['hhh', '.h.', 'hhh'];
function zFrame(spots) {
  let rows = blank(8, 8);
  spots.forEach(function (p) { rows = stamp(rows, recolor(Z3, { h: '5' }), p[0] + 1, p[1] + 1); });
  spots.forEach(function (p) { rows = stamp(rows, Z3, p[0], p[1]); });
  return rows;
}
const ZZZ = [zFrame([[2, 4]]), zFrame([[0, 4], [4, 1]]), zFrame([[0, 5], [3, 2], [5, -1]])];

// 4x6 glyphs: 0 to 9, A to Z, +, :, (v2.1) . and , and (v3.0) ' and -
const FONT_GLYPHS = [
  ['.##.', '#..#', '#.##', '##.#', '#..#', '.##.'],   // 0 (slashed, so it never reads as O)
  ['.#..', '##..', '.#..', '.#..', '.#..', '###.'],   // 1
  ['###.', '...#', '.##.', '#...', '#...', '####'],   // 2
  ['###.', '...#', '.##.', '...#', '...#', '###.'],   // 3
  ['#..#', '#..#', '####', '...#', '...#', '...#'],   // 4
  ['####', '#...', '###.', '...#', '...#', '###.'],   // 5
  ['.##.', '#...', '###.', '#..#', '#..#', '.##.'],   // 6
  ['####', '...#', '..#.', '..#.', '.#..', '.#..'],   // 7
  ['.##.', '#..#', '.##.', '#..#', '#..#', '.##.'],   // 8
  ['.##.', '#..#', '#..#', '.###', '...#', '.##.'],   // 9
  ['.##.', '#..#', '#..#', '####', '#..#', '#..#'],   // A
  ['###.', '#..#', '###.', '#..#', '#..#', '###.'],   // B
  ['.###', '#...', '#...', '#...', '#...', '.###'],   // C
  ['###.', '#..#', '#..#', '#..#', '#..#', '###.'],   // D
  ['####', '#...', '###.', '#...', '#...', '####'],   // E
  ['####', '#...', '###.', '#...', '#...', '#...'],   // F
  ['.###', '#...', '#...', '#.##', '#..#', '.###'],   // G
  ['#..#', '#..#', '####', '#..#', '#..#', '#..#'],   // H
  ['###.', '.#..', '.#..', '.#..', '.#..', '###.'],   // I
  ['..##', '...#', '...#', '...#', '#..#', '.##.'],   // J
  ['#..#', '#.#.', '##..', '#.#.', '#..#', '#..#'],   // K
  ['#...', '#...', '#...', '#...', '#...', '####'],   // L
  ['#..#', '####', '####', '#..#', '#..#', '#..#'],   // M
  ['#..#', '##.#', '####', '#.##', '#..#', '#..#'],   // N
  ['.##.', '#..#', '#..#', '#..#', '#..#', '.##.'],   // O
  ['###.', '#..#', '#..#', '###.', '#...', '#...'],   // P
  ['.##.', '#..#', '#..#', '#..#', '#.##', '.###'],   // Q
  ['###.', '#..#', '#..#', '###.', '#.#.', '#..#'],   // R
  ['.###', '#...', '.##.', '...#', '...#', '###.'],   // S
  ['####', '.#..', '.#..', '.#..', '.#..', '.#..'],   // T
  ['#..#', '#..#', '#..#', '#..#', '#..#', '.##.'],   // U
  ['#..#', '#..#', '#..#', '#..#', '.##.', '.#..'],   // V
  ['#..#', '#..#', '#..#', '####', '####', '#..#'],   // W
  ['#..#', '#..#', '.##.', '.##.', '#..#', '#..#'],   // X
  ['#..#', '#..#', '.##.', '.#..', '.#..', '.#..'],   // Y
  ['####', '...#', '..#.', '.#..', '#...', '####'],   // Z
  ['....', '.#..', '###.', '.#..', '....', '....'],   // +
  ['....', '.#..', '....', '....', '.#..', '....'],   // :
  ['....', '....', '....', '....', '....', '.#..'],   // . (v2.1)
  ['....', '....', '....', '....', '.#..', '#...'],   // , (v2.1)
  ['.#..', '.#..', '....', '....', '....', '....'],   // ' (v3.0)
  ['....', '....', '###.', '....', '....', '....']    // - (v3.0)
];
const FONT_MAP = { '#': '3' };

// v3.0 font_s, 3x5, the same index mapping as font: 0 to 9, A to Z, + : . , ' -. The zero is a
// narrow oval so it never reads as the square O.
const FONT_S_GLYPHS = [
  ['.#.', '#.#', '#.#', '#.#', '.#.'],   // 0
  ['.#.', '##.', '.#.', '.#.', '###'],   // 1
  ['##.', '..#', '.#.', '#..', '###'],   // 2
  ['##.', '..#', '.#.', '..#', '##.'],   // 3
  ['#.#', '#.#', '###', '..#', '..#'],   // 4
  ['###', '#..', '##.', '..#', '##.'],   // 5
  ['.##', '#..', '###', '#.#', '###'],   // 6
  ['###', '..#', '.#.', '.#.', '.#.'],   // 7
  ['###', '#.#', '###', '#.#', '###'],   // 8
  ['###', '#.#', '###', '..#', '##.'],   // 9
  ['.#.', '#.#', '###', '#.#', '#.#'],   // A
  ['##.', '#.#', '##.', '#.#', '##.'],   // B
  ['.##', '#..', '#..', '#..', '.##'],   // C
  ['##.', '#.#', '#.#', '#.#', '##.'],   // D
  ['###', '#..', '##.', '#..', '###'],   // E
  ['###', '#..', '##.', '#..', '#..'],   // F
  ['.##', '#..', '#.#', '#.#', '.##'],   // G
  ['#.#', '#.#', '###', '#.#', '#.#'],   // H
  ['###', '.#.', '.#.', '.#.', '###'],   // I
  ['..#', '..#', '..#', '#.#', '.#.'],   // J
  ['#.#', '#.#', '##.', '#.#', '#.#'],   // K
  ['#..', '#..', '#..', '#..', '###'],   // L
  ['#.#', '###', '###', '#.#', '#.#'],   // M
  ['##.', '#.#', '#.#', '#.#', '#.#'],   // N
  ['###', '#.#', '#.#', '#.#', '###'],   // O
  ['##.', '#.#', '##.', '#..', '#..'],   // P
  ['.#.', '#.#', '#.#', '##.', '.##'],   // Q
  ['##.', '#.#', '##.', '#.#', '#.#'],   // R
  ['.##', '#..', '.#.', '..#', '##.'],   // S
  ['###', '.#.', '.#.', '.#.', '.#.'],   // T
  ['#.#', '#.#', '#.#', '#.#', '###'],   // U
  ['#.#', '#.#', '#.#', '#.#', '.#.'],   // V
  ['#.#', '#.#', '###', '###', '#.#'],   // W
  ['#.#', '#.#', '.#.', '#.#', '#.#'],   // X
  ['#.#', '#.#', '.#.', '.#.', '.#.'],   // Y
  ['###', '..#', '.#.', '#..', '###'],   // Z
  ['...', '.#.', '###', '.#.', '...'],   // +
  ['...', '.#.', '...', '.#.', '...'],   // :
  ['...', '...', '...', '...', '.#.'],   // .
  ['...', '...', '...', '.#.', '#..'],   // ,
  ['.#.', '.#.', '...', '...', '...'],   // '
  ['...', '...', '###', '...', '...']    // -
];

function glyphIndex(ch) {
  const c = ch.charCodeAt(0);
  if (c >= 48 && c <= 57) return c - 48;
  if (c >= 65 && c <= 90) return 10 + (c - 65);
  if (ch === '+') return 36;
  if (ch === ':') return 37;
  if (ch === '.') return 38;
  if (ch === ',') return 39;
  if (ch === "'") return 40;
  if (ch === '-') return 41;
  return -1;
}

/* ------------------------------------------------------------------ v3.0 icons (W16.2) */

// Event icons, 16x16, light from the top left, outline brown all round.
function evBirthday() {
  const g = new Grid(16, 16, '0');
  [3, 7, 11].forEach(function (x, i) {                          // candles, striped, with flames
    for (let y = 3; y <= 6; y++) g.set(x, y, (y + i) % 2 === 0 ? 'h' : (i === 1 ? 'i' : 'f'));
    g.set(x, 1, '4'); g.set(x, 2, 'k');
  });
  g.rect(1, 7, 13, 2, 'h');                                     // frosting top
  g.rect(1, 9, 13, 5, 'i');                                     // cake
  g.rect(12, 9, 2, 5, 'j'); g.rect(1, 13, 13, 1, 'j');           // shade right and under
  g.rect(1, 11, 13, 1, '3'); g.rect(12, 11, 2, 1, 'a');          // cream filling
  [[2, 9], [2, 10], [5, 9], [8, 9], [8, 10], [11, 9]].forEach(function (p) { g.set(p[0], p[1], 'h'); });   // drips
  g.set(5, 7, 'k'); g.set(9, 8, 'f'); g.set(2, 8, 'o'); g.set(12, 7, 'k');    // sprinkles
  g.rect(0, 14, 15, 1, 's'); g.set(0, 14, 'h'); g.set(1, 14, 'h'); g.rect(12, 14, 3, 1, 't');   // plate
  g.outline('5');
  return g.done();
}

function evPicnic() {
  const g = new Grid(16, 16, '0');
  for (let y = 5; y <= 7; y++) {                               // gingham cloth over the rim
    for (let x = 2; x <= 13; x++) {
      const a = (x >> 1) % 2, b = y % 2;
      g.set(x, y, a && b ? 'r' : (a || b ? 'o' : 'h'));
    }
  }
  g.set(1, 7, 'o'); g.set(1, 8, 'h'); g.set(14, 6, 'h'); g.set(14, 7, 'o');   // cloth corners
  g.rect(2, 8, 12, 1, '6');                                     // rim
  for (let y = 9; y <= 12; y++) {                              // woven body
    for (let x = 2; x <= 13; x++) g.set(x, y, ((x + (y % 2) * 2) % 4) < 2 ? '8' : '7');
  }
  g.rect(13, 9, 1, 4, '6');
  g.rect(3, 13, 10, 1, '6');                                    // base
  [[5, 8, 6], [6, 9, 4], [7, 10, 2]].forEach(function (f) {     // the cloth's flap over the front
    for (let x = f[0]; x < f[0] + f[2]; x++) g.set(x, f[1], ((x >> 1) + f[1]) % 2 ? 'o' : 'h');
  });
  g.outline('5');
  // The handle: a one pixel wood arch with a dark outer edge, the inside left clear.
  [[6, 1], [7, 1], [8, 1], [9, 1], [5, 2], [10, 2], [4, 3], [11, 3], [4, 4], [11, 4]].forEach(function (p) { g.set(p[0], p[1], p[0] < 8 ? '8' : '7'); });
  [[6, 0], [7, 0], [8, 0], [9, 0], [5, 1], [10, 1], [4, 2], [11, 2], [3, 3], [12, 3], [3, 4], [12, 4]].forEach(function (p) { g.set(p[0], p[1], '5'); });
  return g.done();
}

function evYard() {
  const g = new Grid(16, 16, '0');
  g.rect(10, 1, 2, 3, '6'); g.set(10, 1, '7');                  // chimney
  for (let y = 2; y <= 6; y++) {                               // roof
    const half = y + 1;
    for (let x = 8 - half; x < 8 + half; x++) g.set(x, y, x < 8 - half + 1 ? 'p' : (x >= 8 + half - 2 ? 'r' : 'o'));
  }
  g.rect(2, 7, 12, 1, 'r');                                     // eave shadow
  g.rect(3, 8, 10, 5, '3'); g.rect(12, 8, 1, 5, 'a');           // walls
  g.rect(7, 9, 2, 4, '6'); g.set(7, 9, '7'); g.set(8, 11, 'k');  // door
  g.rect(4, 9, 2, 2, 'f'); g.set(4, 9, 'h');                    // windows
  g.rect(10, 9, 2, 2, 'f'); g.set(10, 9, 'h');
  g.rect(1, 13, 14, 2, 'b'); g.rect(1, 14, 14, 1, 'c');         // lawn
  g.set(2, 13, 'e'); g.set(13, 13, 'e');
  g.outline('5');
  return g.done();
}

function evFinale() {
  const g = new Grid(16, 16, '0');
  g.rect(3, 1, 10, 2, 'k');                                     // cup
  g.rect(4, 3, 8, 3, 'k');
  g.rect(5, 6, 6, 1, 'k');
  g.rect(6, 7, 4, 1, 'k');
  g.rect(4, 1, 1, 4, 'h'); g.set(5, 1, 'h');                    // glint
  g.rect(11, 1, 2, 2, '8'); g.rect(10, 3, 2, 3, '8'); g.set(9, 6, '8'); g.set(9, 7, '8');   // shade
  g.rect(1, 2, 1, 3, 'k'); g.set(2, 2, 'k'); g.set(2, 5, 'k');  // handles
  g.rect(14, 2, 1, 3, '8'); g.set(13, 2, '8'); g.set(13, 5, '8');
  g.rect(7, 8, 2, 3, 'k'); g.set(8, 8, '8'); g.set(8, 9, '8'); g.set(8, 10, '8');   // stem
  g.rect(5, 11, 6, 1, 'k'); g.rect(9, 11, 2, 1, '8');            // collar
  g.rect(4, 12, 8, 2, '7'); g.rect(4, 12, 8, 1, '8'); g.rect(10, 13, 2, 1, '6');   // base
  g.outline('5');
  return g.done();
}

const STAR_ROWS = ['....5....', '...5k5...', '5555kk555', '5hkkkkkk5', '.5kkkkk5.', '..5kkk5..', '.5kk5kk5.', '.5k5.5k5.', '.55...55.'];
// v3.1 (X12.1): frame 2 half (frame 0's columns 0 to 4, frame 1's columns 5 to 8), frame 3 hollow
// (the outline in yellow, the body transparent) for potential.
const STAR_FULL = paint(STAR_ROWS);
const STAR_EMPTY = recolor(STAR_FULL, { k: 'v', h: 'v' });
const STAR_HALF = STAR_FULL.map(function (r, y) { return r.slice(0, 5) + STAR_EMPTY[y].slice(5); });
const STAR_HOLLOW = STAR_FULL.map(function (r) { return r.replace(/[^5]/g, '0').replace(/5/g, 'k'); });
const STAR = [STAR_FULL, STAR_EMPTY, STAR_HALF, STAR_HOLLOW];

// v3.1 mood faces (X12.1), 10x10, frame 2 - mood: 0 Fired up, 1 Happy, 2 OK, 3 Grumpy, 4 Done.
// A round face, outline brown edge, a light pixel top left and a shade arc bottom right in the
// face's own ramp, near black eyes two pixels tall; only the mouth and brows change with the mood.
const MOOD_BODY = ['..555555..', '.5XXXXXX5.', '5XXXXXXXX5', '5XXXXXXXX5', '5XX1XX1XX5',
  '5XX1XX1XX5', '5XXXXXXXX5', '5XXXXXXXX5', '.5XXXXXX5.', '..555555..'];
const MOOD_RAMP = { k: { X: 'k', L: 'h', Z: '8' }, 4: { X: '4', L: '8', Z: 'r' }, o: { X: 'o', L: 'p', Z: 'r' } };
function moodFrame(fill, mouth) {
  const g = new Grid(10, 10, '0');
  g.stamp(MOOD_BODY, 0, 0);
  for (let y = 1; y < 9; y++) {
    for (let x = 1; x < 9; x++) {
      if (g.get(x, y) !== 'X') continue;
      const edgeBR = g.get(x + 1, y) === '5' || g.get(x, y + 1) === '5';
      if (edgeBR && x + y >= 12) g.set(x, y, 'Z');
    }
  }
  g.set(3, 1, 'L'); g.set(2, 2, 'L');
  mouth.forEach(function (p) { g.set(p[0], p[1], p[2] || '1'); });
  return paint(g.done(), MOOD_RAMP[fill]);
}
const MOOD = [
  moodFrame('k', [[2, 6], [3, 6, 'h'], [4, 6, 'h'], [5, 6, 'h'], [6, 6, 'h'], [7, 6], [3, 7], [4, 7, 'o'], [5, 7, 'o'], [6, 7]]),
  moodFrame('k', [[2, 6], [7, 6], [3, 7], [4, 7], [5, 7], [6, 7]]),
  moodFrame('k', [[3, 7], [4, 7], [5, 7], [6, 7]]),
  moodFrame('4', [[3, 6], [4, 6], [5, 6], [6, 6], [2, 7], [7, 7]]),
  moodFrame('o', [[2, 2], [3, 3], [7, 2], [6, 3], [3, 6], [4, 6], [5, 6], [6, 6], [2, 7], [7, 7]])
];

const FLAME_ROWS = ['....5...', '...545..', '..5445..', '..54445.', '.544k45.', '.54kk45.', '54kkhk45', '54khhk45', '.54kk45.', '..5555..'];
const FLAME = [paint(FLAME_ROWS), recolor(paint(FLAME_ROWS), { 4: 'v', k: '2', h: '2' })];

const CHECK_BOX = paint(['.555555.', '5bcccch5', '5bccchh5', '5hcchhc5', '5hhhhcc5', '5chhccd5', '5dddddd5', '.555555.']);

/* ------------------------------------------------------------------ the set (X12.1, 128 names, 352 frames) */

const SPRITES = {};
function add(name, w, h, frames) { SPRITES[name] = sprite(w, h, frames); }
function merge(set) { Object.keys(set).forEach(function (k) { SPRITES[k] = set[k]; }); }

// People and animals: 28 names, 94 frames
(function () {
  const pf = playerFrames(DEFAULT_LOOK);
  ['player_down', 'player_up', 'player_side', 'player_slice'].forEach(function (n) { add(n, 16, 24, pf[n]); });
})();
merge(staffSet('buddy'));
merge(staffSet('tender'));
merge(custSet('cust0'));
merge(custSet('cust1'));
merge(custSet('cust2'));
merge(custSet('cust3'));
add('shadow', 12, 4, [shadowRows()]);
add('dog', 16, 16, [dogWalk(0), dogWalk(1), dogSit(), dogNap()]);

// Hand overlays: 24 names
add('hand_charcoal', 8, 8, [HAND_CHARCOAL]);
MEAT_IDS.forEach(function (m) { add('hand_raw_' + m, 8, 8, [paint(HAND_SHAPE[m], MEAT_STATE.raw)]); });
MEAT_IDS.forEach(function (m) { add('hand_cooked_' + m, 8, 8, [paint(HAND_SHAPE[m], MEAT_STATE.cookedHand)]); });
add('hand_burnt', 8, 8, [HAND_BURNT]);
MEAT_IDS.forEach(function (m) { add('hand_plate_' + m, 8, 8, [stamp(blank(8, 8), plateRows(m), 0, 1)]); });
MEAT_IDS.forEach(function (m) { add('hand_tray_' + m, 8, 8, [trayRows(m)]); });
add('hand_tray', 8, 8, [HAND_TRAY_EMPTY]);
add('hand_togo', 8, 8, [HAND_TOGO]);

// Food, icons and marks: 16 names, 36 frames
MEAT_IDS.forEach(function (m) { add('icon_' + m, 8, 8, [ICON[m]]); });
MEAT_IDS.forEach(function (m) { add('plate_' + m, 8, 6, [plateRows(m)]); });
MEAT_IDS.forEach(function (m) { add('piece_' + m, 10, 10, pieceFrames(m)); });
add('mark_x', 8, 8, [MARK_X]);

// Stations: 8 names, 21 frames
add('kettle', 16, 24, kettleFrames());
add('drum', 16, 32, drumFrames());
add('cooler', 16, 16, [COOLER_CRATE, COOLER_SHUT, COOLER_OPEN]);
add('board', 16, 16, [BOARD_EMPTY, BOARD_BUSY]);
add('counter', 32, 24, [clothTable(32, true, true), clothTable(32, false, true)]);
add('counter_ext', 16, 24, [clothTable(16, true, false)]);
add('pile', 16, 16, pileFrames());
add('trash', 16, 16, [TRASH]);

// Ground, fence and hedge: 10 names, 17 frames
add('paver', 16, 16, [paverFrame(false), paverFrame(true)]);
add('lawn_a', 16, 16, [lawnFrame('b', 'c', 'e', false, 1), lawnFrame('b', 'c', 'e', true, 1)]);
add('lawn_b', 16, 16, [lawnFrame('c', 'd', 'b', false, 2), lawnFrame('c', 'd', 'b', true, 2)]);
add('fence_h', 16, 24, [fenceH()]);
add('fence_v', 16, 24, [fenceV()]);
add('fence_corner', 16, 24, [fenceCorner()]);
add('fence_back', 16, 16, [fenceBack(false), fenceBack(true)]);
add('gate', 16, 24, [gateShut(), gateOpen()]);
add('hedge', 16, 24, [hedgeRows(), hedgeBlossomRows()]);
add('bed', 16, 20, [bedFrame(0), bedFrame(1), bedFrame(2), soilFrame()]);

// Fixed props: 12 names
add('shed', 48, 32, [shedRows()]);
add('sign', 62, 12, [signRows()]);
add('tree', 32, 48, [treeRows()]);
add('woodpile', 16, 16, [woodpileRows()]);
add('hose', 16, 16, [hoseRows()]);
add('tools', 16, 24, [toolsRows()]);
add('pot', 16, 16, [potRows()]);
add('planter', 16, 24, [planterRows()]);
add('shelf', 16, 24, [shelfRows()]);
add('mailbox', 16, 24, [mailboxRows()]);
add('picnic', 32, 24, [picnicRows()]);
add('picnic_bench', 32, 8, [picnicBenchRows()]);

// Decor and gear props: 5 names, 7 frames
add('chair', 16, 24, [chairRows()]);
add('lights_post', 16, 32, [lightsPostRows()]);
add('lights_string', 66, 10, [lightsStringFrame(0), lightsStringFrame(1)]);
add('birdbath', 16, 24, [birdbathFrame(false), birdbathFrame(true)]);
add('canopy', 40, 32, [canopyRows()]);

// Effects and text: 12 names, 70 frames
add('bubble', 16, 12, [BUBBLE]);
add('heart', 8, 8, HEART);
add('sparkle', 7, 7, SPARKLE);
add('smoke', 8, 8, SMOKE);
add('smoke_dark', 8, 8, SMOKE_DARK);
add('fire', 8, 8, FIRE);
add('coin', 8, 8, COIN);
add('sweat', 4, 6, SWEAT);
add('zzz', 8, 8, ZZZ);
add('font', 4, 6, FONT_GLYPHS.map(function (g) { return paint(g, FONT_MAP); }));
add('arrow', 8, 12, ARROW);
add('bubble_warn', 8, 10, BUBBLE_WARN);

// v3.0 (W16.2): 8 names, 53 frames
add('font_s', 3, 5, FONT_S_GLYPHS.map(function (g) { return paint(g, FONT_MAP); }));
add('ev_birthday', 16, 16, [evBirthday()]);
add('ev_picnic', 16, 16, [evPicnic()]);
add('ev_yard', 16, 16, [evYard()]);
add('ev_finale', 16, 16, [evFinale()]);
add('star', 9, 9, STAR);
add('flame', 8, 10, FLAME);
add('check', 8, 8, [CHECK_BOX]);

// v3.1 (X12.1): 5 names, 16 frames (star grew by 2 above). 128 names, 352 frames in all.
(function () {
  const pf = crewFrames(normLook(PREP_DEFAULT_LOOK), 'prep');
  ['prep_down', 'prep_up', 'prep_side', 'prep_slice'].forEach(function (n) { add(n, 16, 24, pf[n]); });
})();
add('mood', 10, 10, MOOD);

/* ------------------------------------------------------------------ build and draw */

let built = false;
const cache = {};      // name -> canvas per frame
const flipCache = {};  // name -> mirrored canvas per frame
const tintCache = {};  // COLOR key -> one strip canvas holding all 42 glyphs in that color
let lookNow = normLook(DEFAULT_LOOK);   // the look the player sprites show (W16.3)

function validate() {
  Object.keys(SPRITES).forEach(function (name) {
    const s = SPRITES[name];
    if (!s || !Array.isArray(s.frames) || s.frames.length === 0) {
      throw new Error('sprite ' + name + ' frame 0 row 0: no frames');
    }
    s.frames.forEach(function (fr, i) {
      if (!Array.isArray(fr) || fr.length !== s.h) {
        throw new Error('sprite ' + name + ' frame ' + i + ' row 0: expected ' + s.h + ' rows, got ' + (Array.isArray(fr) ? fr.length : typeof fr));
      }
      fr.forEach(function (row, j) {
        if (typeof row !== 'string' || row.length !== s.w) {
          throw new Error('sprite ' + name + ' frame ' + i + ' row ' + j + ': expected width ' + s.w + ', got ' + (typeof row === 'string' ? row.length : typeof row));
        }
        for (let x = 0; x < row.length; x++) {
          if (CHARS.indexOf(row[x]) < 0) {
            throw new Error('sprite ' + name + ' frame ' + i + ' row ' + j + ': character "' + row[x] + '" at column ' + x + ' is not in the legend');
          }
        }
      });
    });
  });
}

function render(rows, w, h, only) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d');
  for (let y = 0; y < h; y++) {
    const row = rows[y];
    let x = 0;
    while (x < w) {
      const ch = row[x];
      if (ch === '0') { x++; continue; }
      let x2 = x + 1;
      while (x2 < w && row[x2] === ch) x2++;
      g.fillStyle = only || PALETTE[CHARS.indexOf(ch)];
      g.fillRect(x, y, x2 - x, 1);
      x = x2;
    }
  }
  return c;
}

function fontStrip(color) {
  const f = SPRITES.font;
  const c = document.createElement('canvas');
  c.width = f.w * f.frames.length;
  c.height = f.h;
  const g = c.getContext('2d');
  g.fillStyle = color;
  f.frames.forEach(function (rows, i) {
    for (let y = 0; y < f.h; y++) {
      for (let x = 0; x < f.w; x++) if (rows[y][x] !== '0') g.fillRect(i * f.w + x, y, 1, 1);
    }
  });
  return c;
}

function build() {
  if (built) return;
  validate();
  Object.keys(SPRITES).forEach(function (name) {
    const s = SPRITES[name];
    cache[name] = s.frames.map(function (fr) { return render(fr, s.w, s.h); });
    flipCache[name] = s.frames.map(function (fr) { return render(hflip(fr), s.w, s.h); });
  });
  Object.keys(COLOR).forEach(function (k) { tintCache[k] = fontStrip(COLOR[k]); });
  built = true;
  setLook(DEFAULT_LOOK);
}

const PLAYER_NAMES = ['player_down', 'player_up', 'player_side', 'player_slice'];

// Rebuild the four player sprites in place for a look (grids, then canvases and flips once built).
function setLook(look) {
  const L = normLook(look);
  const pf = playerFrames(L);
  PLAYER_NAMES.forEach(function (name) {
    const s = SPRITES[name];
    for (let i = 0; i < s.frames.length; i++) s.frames[i] = pf[name][i];
    if (built) {
      cache[name] = s.frames.map(function (fr) { return render(fr, s.w, s.h); });
      flipCache[name] = s.frames.map(function (fr) { return render(hflip(fr), s.w, s.h); });
    }
  });
  lookNow = L;
  return lookKey();
}

function lookKey() {
  return lookKeyOf(lookNow);
}

/* ------------------------------------------------ crew looks: setCrewLook, crewKey, portrait (X12.2) */

const CREW_NAMES = Object.freeze({
  run: ['buddy_down', 'buddy_up', 'buddy_side'],
  fire: ['tender_down', 'tender_up', 'tender_side'],
  prep: ['prep_down', 'prep_up', 'prep_side', 'prep_slice']
});
// The key in effect per role: '' for run and fire until the first setCrewLook (v2's buddy and
// tender grids), the prep default from load.
const crewNow = { run: '', fire: '', prep: 'prep:' + lookKeyOf(normLook(PREP_DEFAULT_LOOK)) };
// Built looks per role, so the drawing sites can call setCrewLook every frame for free: key ->
// { grids, canvas, flip }. Cleared when it reaches CREW_MEMO_MAX looks for a role.
const CREW_MEMO_MAX = 24;
const crewMemo = { run: {}, fire: {}, prep: {} };

function setCrewLook(role, look) {
  if (!isRole(role)) throw new Error('sprites: unknown crew role "' + role + '"');
  const L = normLook(look);
  const key = role + ':' + lookKeyOf(L);
  if (crewNow[role] === key) return key;
  let entry = crewMemo[role][key];
  if (!entry) {
    if (Object.keys(crewMemo[role]).length >= CREW_MEMO_MAX) crewMemo[role] = {};
    entry = { grids: crewFrames(L, role), canvas: null, flip: null };
    crewMemo[role][key] = entry;
  }
  CREW_NAMES[role].forEach(function (name) {
    const s = SPRITES[name];
    for (let i = 0; i < s.frames.length; i++) s.frames[i] = entry.grids[name][i];
  });
  if (built) {
    if (!entry.canvas) {
      entry.canvas = {}; entry.flip = {};
      CREW_NAMES[role].forEach(function (name) {
        const s = SPRITES[name];
        entry.canvas[name] = entry.grids[name].map(function (fr) { return render(fr, s.w, s.h); });
        entry.flip[name] = entry.grids[name].map(function (fr) { return render(hflip(fr), s.w, s.h); });
      });
    }
    CREW_NAMES[role].forEach(function (name) {
      cache[name] = entry.canvas[name];
      flipCache[name] = entry.flip[name];
    });
  }
  crewNow[role] = key;
  return key;
}

function crewKey(role) {
  return isRole(role) ? crewNow[role] : '';
}

// The bust drawn at scale CSS px per art pixel, a whole number of device px per art pixel.
function portrait(look, role, opts) {
  const rows = bustRows(look, role);
  const o = opts && typeof opts === 'object' ? opts : {};
  const scale = Math.max(1, Math.trunc(Number(o.scale) || 1));
  const dpr = Number(o.dpr) > 0 ? Number(o.dpr) : 1;
  const k = Math.max(1, Math.round(scale * dpr));
  const c = document.createElement('canvas');
  c.width = BUST_W * k;
  c.height = BUST_H * k;
  if (c.style) { c.style.width = (BUST_W * scale) + 'px'; c.style.height = (BUST_H * scale) + 'px'; }
  if (typeof c.setAttribute === 'function') c.setAttribute('aria-hidden', 'true');
  const g = c.getContext('2d');
  g.imageSmoothingEnabled = false;
  for (let y = 0; y < BUST_H; y++) {
    const row = rows[y];
    let x = 0;
    while (x < BUST_W) {
      const ch = row[x];
      if (ch === '0') { x++; continue; }
      let x2 = x + 1;
      while (x2 < BUST_W && row[x2] === ch) x2++;
      g.fillStyle = PALETTE[CHARS.indexOf(ch)];
      g.fillRect(x * k, y * k, (x2 - x) * k, k);
      x = x2;
    }
  }
  return c;
}

function has(name) {
  return Object.prototype.hasOwnProperty.call(SPRITES, name);
}

function frames(name) {
  return has(name) ? SPRITES[name].frames.length : 0;
}

function frameCanvas(name, frame, flip) {
  if (!built) build();
  if (!has(name)) throw new Error('sprites: unknown sprite "' + name + '"');
  const list = flip ? flipCache[name] : cache[name];
  const n = list.length;
  let f = Math.trunc(Number(frame) || 0);
  f = ((f % n) + n) % n;
  return list[f];
}

function draw(ctx, name, x, y, frame, flip) {
  ctx.drawImage(frameCanvas(name, frame, flip === true), x, y);
}

// One frame stretched into a w by h box with smoothing off (the squash and stretch).
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
  c.width = src.width * k;
  c.height = src.height * k;
  const g = c.getContext('2d');
  g.imageSmoothingEnabled = false;
  g.drawImage(src, 0, 0, c.width, c.height);
  return c;
}

function text(ctx, str, x, y) {
  const s = String(str).toUpperCase();
  let cx = x;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch === ' ') { cx += 5; continue; }
    const idx = glyphIndex(ch);
    if (idx < 0) continue;
    draw(ctx, 'font', cx, y, idx, false);
    cx += 5;
  }
}

// Like text(), with the cream glyph pixels drawn in COLOR[colorKey].
function textTinted(ctx, str, x, y, colorKey) {
  if (!built) build();
  if (!Object.prototype.hasOwnProperty.call(COLOR, colorKey)) throw new Error('sprites: unknown color key "' + colorKey + '"');
  const strip = tintCache[colorKey];
  const s = String(str).toUpperCase();
  let cx = x;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch === ' ') { cx += 5; continue; }
    const idx = glyphIndex(ch);
    if (idx < 0) continue;
    ctx.drawImage(strip, idx * 4, 0, 4, 6, cx, y, 4, 6);
    cx += 5;
  }
}

function textS(ctx, s, x, y) {
  let cx = x;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch === ' ') { cx += 4; continue; }
    const idx = glyphIndex(ch);
    if (idx < 0) continue;
    draw(ctx, 'font_s', cx, y, idx, false);
    cx += 4;
  }
}

// font_s width: glyph count (space counts) times 4 minus 1.
function textWidthS(str) {
  const s = String(str).toUpperCase();
  let n = 0;
  for (let i = 0; i < s.length; i++) {
    if (s[i] === ' ' || glyphIndex(s[i]) >= 0) n++;
  }
  return n === 0 ? 0 : n * 4 - 1;
}

// The yard sign's text (W16.3, W16.5): font when it fits w, else font_s one row lower; centered.
function textFit(ctx, str, x, y, w) {
  const s = String(str == null ? '' : str).toUpperCase();
  const big = textWidth(s);
  if (big <= w) {
    const x0 = x + Math.floor((w - big) / 2);
    text(ctx, s, x0, y);
    return { font: 'font', x: x0, width: big };
  }
  const small = textWidthS(s);
  const x0 = x + Math.floor((w - small) / 2);
  textS(ctx, s, x0, y + 1);
  return { font: 'font_s', x: x0, width: small };
}

// The screen mocks' 5x7 UI font: the glyph table of screen-1-season.html, plus '-'. Rows 7 and 8
// are descenders. Unknown characters advance 3 font pixels and draw nothing, as in the mocks.
const UI_GLYPHS = {
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
  0: ['.###.', '#...#', '#..##', '#.#.#', '##..#', '#...#', '.###.'],
  1: ['.#.', '##.', '.#.', '.#.', '.#.', '.#.', '###'],
  2: ['.###.', '#...#', '....#', '...#.', '..#..', '.#...', '#####'],
  3: ['####.', '....#', '....#', '.###.', '....#', '....#', '####.'],
  4: ['...#.', '..##.', '.#.#.', '#..#.', '#####', '...#.', '...#.'],
  5: ['#####', '#....', '####.', '....#', '....#', '#...#', '.###.'],
  6: ['.###.', '#....', '#....', '####.', '#...#', '#...#', '.###.'],
  7: ['#####', '....#', '...#.', '..#..', '.#...', '.#...', '.#...'],
  8: ['.###.', '#...#', '#...#', '.###.', '#...#', '#...#', '.###.'],
  9: ['.###.', '#...#', '#...#', '.####', '....#', '....#', '.###.'],
  '.': ['.', '.', '.', '.', '.', '.', '#'],
  ',': ['..', '..', '..', '..', '..', '.#', '.#', '#.'],
  ':': ['.', '.', '#', '.', '.', '#', '.'],
  '/': ['....#', '....#', '...#.', '..#..', '.#...', '#....', '#....'],
  '!': ['#', '#', '#', '#', '#', '.', '#'],
  '?': ['.###.', '#...#', '....#', '..##.', '..#..', '.....', '..#..'],
  '+': ['.....', '..#..', '..#..', '#####', '..#..', '..#..', '.....'],
  "'": ['#', '#', '.', '.', '.', '.', '.'],
  '-': ['...', '...', '...', '###', '...', '...', '...'],
  ' ': ['..', '..', '..', '..', '..', '..', '..']
};
function uiGlyph(ch) { return Object.prototype.hasOwnProperty.call(UI_GLYPHS, ch) ? UI_GLYPHS[ch] : null; }

// Draws str in the UI font into a fresh canvas (W16.3): scale CSS px per font pixel, a whole number
// of device px per font pixel (round(scale * dpr), at least 1), smoothing off, aria-hidden.
function uiText(str, opts) {
  const o = opts && typeof opts === 'object' ? opts : {};
  const chars = Array.from(String(str == null ? '' : str));
  const scale = Math.max(1, Math.trunc(Number(o.scale) || 1));
  const dpr = Number(o.dpr) > 0 ? Number(o.dpr) : 1;
  const k = Math.max(1, Math.round(scale * dpr));
  const bold = o.bold === true;
  const color = typeof o.color === 'string' && o.color ? o.color : COLOR.C;
  const shadow = typeof o.shadow === 'string' && o.shadow ? o.shadow : '';
  let w = 0, rows = 7;
  chars.forEach(function (ch) {
    const g = uiGlyph(ch);
    w += (g ? g[0].length : 3) + (bold ? 1 : 0) + 1;
    if (g && g.length > rows) rows = g.length;
  });
  w = Math.max(0, w - 1);
  const h = rows + (shadow ? 1 : 0);
  const c = document.createElement('canvas');
  c.width = Math.max(1, w * k);
  c.height = h * k;
  if (c.style) { c.style.width = (w * scale) + 'px'; c.style.height = (h * scale) + 'px'; }
  if (typeof c.setAttribute === 'function') c.setAttribute('aria-hidden', 'true');
  const g2 = c.getContext('2d');
  g2.imageSmoothingEnabled = false;
  function pass(dy, fill) {
    g2.fillStyle = fill;
    let cx = 0;
    chars.forEach(function (ch) {
      const g = uiGlyph(ch);
      if (g) {
        for (let r = 0; r < g.length; r++) {
          for (let i = 0; i < g[r].length; i++) {
            if (g[r][i] === '#') g2.fillRect((cx + i) * k, (r + dy) * k, k * (bold ? 2 : 1), k);
          }
        }
      }
      cx += (g ? g[0].length : 3) + (bold ? 1 : 0) + 1;
    });
  }
  if (shadow) pass(1, shadow);
  pass(0, color);
  return c;
}

function textWidth(str) {
  const s = String(str).toUpperCase();
  let n = 0;
  for (let i = 0; i < s.length; i++) {
    if (s[i] === ' ' || glyphIndex(s[i]) >= 0) n++;
  }
  return n === 0 ? 0 : n * 5 - 1;
}

const art = {
  TILE: 16,
  PALETTE: PALETTE,
  COLOR: COLOR,
  SPRITES: SPRITES,
  build: build,
  has: has,
  frames: frames,
  draw: draw,
  drawScaled: drawScaled,
  canvasFor: canvasFor,
  text: text,
  textTinted: textTinted,
  textWidth: textWidth,
  textWidthS: textWidthS,
  textFit: textFit,
  uiText: uiText,
  setLook: setLook,
  lookKey: lookKey,
  LOOK: LOOK,
  setCrewLook: setCrewLook,
  crewKey: crewKey,
  bustRows: bustRows,
  portrait: portrait,
  CREW_OUTFIT: CREW_OUTFIT
};
Object.defineProperty(art, 'built', { enumerable: true, get: function () { return built; } });

PitSim.art = art;
})();
