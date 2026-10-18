'use strict';
/*
 * games/pit-sim/sprites.js  (builder A)
 * Attaches PitSim.art as defined in docs/superpowers/specs/2026-10-18-pit-sim-contract.md, section 3.
 *
 * Deviations
 * - The file body sits inside one function so its `const PitSim` does not land in the shared
 *   global lexical scope. Classic scripts share that scope, and a second top level
 *   `const PitSim` in sim.js or game.js would throw a SyntaxError on load. The shared surface
 *   is exactly PitSim.art, nothing else is added.
 * - build() pre-renders a mirrored canvas for every frame so draw(..., flip) never creates a
 *   canvas outside build() and canvasFor().
 *
 * LEGEND (authored once, used by every grid in this file)
 *
 *   Palette characters, the only characters a finished grid may hold:
 *     0 transparent      1 K near black    2 U umber        3 C cream        4 O orange
 *     5 Y gold           6 M muted         7 H hairline     8 I ink          9 S charcoal grey
 *     a g grass dark     b G grass light   c h hedge        d d dirt         e b board brown
 *     f p raw pink       g r cooking       h n done brown   i f fire bright  j y fire yellow
 *     k s smoke light    l t smoke dark    m w sky
 *
 *   Authoring symbols, replaced by paint() before a grid is stored (uppercase only, so they can
 *   never collide with the lowercase palette letters):
 *     .  transparent (becomes 0)
 *     People:  H hat or hair   S skin   T shirt   A apron (shirt color when there is none)
 *              P pants         B boots
 *     Meat:    o outline       X fill   x shade (bottom right)   L highlight (top left)
 *              B bone or fat   i inner dark line
 *     Cookers: F fire glow cells, filled per band (cold, low, good, hot)
 *     Font:    # glyph pixel
 *
 *   Light comes from the top left: highlights sit top left, shade sits bottom right.
 */
(function () {
const PitSim = globalThis.PitSim || (globalThis.PitSim = {});

/* ------------------------------------------------------------------ palette */

const PALETTE = Object.freeze([
  '',        // 0 transparent
  '#1b1714', // 1 K near black
  '#2a2015', // 2 U umber
  '#E6D8B8', // 3 C cream
  '#D06129', // 4 O orange
  '#F3CF6D', // 5 Y gold
  '#bfb39a', // 6 M muted
  '#3a332c', // 7 H hairline
  '#33211A', // 8 I ink
  '#444947', // 9 S charcoal grey
  '#4a6741', // a g grass dark
  '#5f7f4c', // b G grass light
  '#2f4a2d', // c h hedge
  '#6b4a2a', // d d dirt
  '#8a6a3f', // e b board brown
  '#e8a0a0', // f p raw pink
  '#b5583a', // g r cooking meat
  '#7a3f22', // h n done meat
  '#ff9a2e', // i f fire bright
  '#ffd85c', // j y fire yellow
  '#8d8a86', // k s smoke light
  '#5a5753', // l t smoke dark
  '#a9c4d9'  // m w sky
]);
const CHARS = '0123456789abcdefghijklm';
const KEYS = ['', 'K', 'U', 'C', 'O', 'Y', 'M', 'H', 'I', 'S', 'g', 'G', 'h', 'd', 'b', 'p', 'r', 'n', 'f', 'y', 's', 't', 'w'];
const COLOR = {};
for (let i = 1; i < KEYS.length; i++) COLOR[KEYS[i]] = PALETTE[i];
Object.freeze(COLOR);

/* ------------------------------------------------------------------ helpers */

// Replace authoring symbols with palette characters. '.' becomes '0'. Palette characters pass
// through. Anything else must be in `map`, or authoring is wrong and we throw at load.
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

// Overlay `over` onto `base` at (dx, dy); transparent cells ('0' or '.') leave the base alone.
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

function hflip(rows) {
  return rows.map(function (r) { return r.split('').reverse().join(''); });
}

function rep(rows, n) {
  const out = [];
  for (let i = 0; i < n; i++) out.push(rows);
  return out;
}

// Small procedural painter for tiles that are mostly fill plus a few shapes.
function Grid(w, h, fill) {
  this.w = w; this.h = h; this.rows = [];
  for (let y = 0; y < h; y++) this.rows.push(new Array(w).fill(fill || '0'));
}
Grid.prototype.set = function (x, y, c) {
  if (x >= 0 && y >= 0 && x < this.w && y < this.h) this.rows[y][x] = c;
  return this;
};
Grid.prototype.rect = function (x, y, w, h, c) {
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, c);
  return this;
};
Grid.prototype.done = function () {
  return this.rows.map(function (r) { return r.join(''); });
};

function sprite(w, h, frames) { return { w: w, h: h, frames: frames }; }

/* ------------------------------------------------------------------ people */

const HEAD_TOP = {
  brim: {
    down: ['.....111111.....', '....1HHHHHH1....', '....1HHHHHH1....', '..11HHHHHHHH11..'],
    side: ['.....111111.....', '....1HHHHHH1....', '....1HHHHHH1....', '..11HHHHHHHH11..'],
    up:   ['.....111111.....', '....1HHHHHH1....', '....1HHHHHH1....', '..11HHHHHHHH11..']
  },
  cap: {
    down: ['................', '.....111111.....', '....1HHHHHH1....', '...11HHHHHH11...'],
    side: ['................', '.....111111.....', '....1HHHHHH1....', '..1HHHHHHHH1....'],
    up:   ['................', '.....111111.....', '....1HHHHHH1....', '...11HHHHHH11...']
  },
  hair: {
    down: ['................', '.....111111.....', '....1HHHHHH1....', '....1HHHHHH1....'],
    side: ['................', '.....111111.....', '....1HHHHHH1....', '....1HHHHHH1....'],
    up:   ['................', '.....111111.....', '....1HHHHHH1....', '....1HHHHHH1....']
  },
  bucket: {
    down: ['.....111111.....', '....1HHHHHH1....', '...1HHHHHHHH1...', '...1HHHHHHHH1...'],
    side: ['.....111111.....', '....1HHHHHH1....', '...1HHHHHHHH1...', '...1HHHHHHHH1...'],
    up:   ['.....111111.....', '....1HHHHHH1....', '...1HHHHHHHH1...', '...1HHHHHHHH1...']
  }
};

function headRows(style, dir, unhappy) {
  const top = HEAD_TOP[style][dir];
  let face;
  if (dir === 'up') {
    face = ['....1HHHHHH1....', '....1HHHHHH1....', '....1SSSSSS1....', '.....1SSSS1.....'];
  } else if (dir === 'side') {
    face = ['....1SSSSSS1....', '....1S1SSSS1....', '....1SSSSSS1....', '.....1SSSS1.....'];
    if (style === 'hair') face[0] = '....1SSSSHH1....';
  } else if (unhappy) {
    face = ['....1S1SS1S1....', '....1SS11SS1....', '....1S1111S1....', '.....1SSSS1.....'];
  } else {
    face = ['....1SSSSSS1....', '....1S1SS1S1....', '....1SSSSSS1....', '.....1SSSS1.....'];
    if (style === 'hair') face[0] = '....1HSSSSH1....';
  }
  return ['................'].concat(top, face);
}

// Rows 9 to 15. Index 0 stands, 1 and 2 are the walk cycle.
const BODY = {
  down: [
    ['....11TTTT11....', '..11TTAAAATT11..', '..1S1TAAAAT1S1..', '...11TAAAAT11...',
     '....1PP11PP1....', '....1PP11PP1....', '....1BB11BB1....'],
    ['....11TTTT11....', '..1S1TAAAATT11..', '..11TTAAAAT1S1..', '...11TAAAAT11...',
     '....1PP11PP1....', '....1BB11PP1....', '........1BB1....'],
    ['....11TTTT11....', '..11TTAAAAT1S1..', '..1S1TAAAATT11..', '...11TAAAAT11...',
     '....1PP11PP1....', '....1PP11BB1....', '....1BB1........']
  ],
  side: [
    ['....11TTTT11....', '....1TAATTT1....', '...1S1AATTT1....', '....1TAATTT1....',
     '....1PPPPPP1....', '....1PPPPPP1....', '....1BBBBBB1....'],
    ['....11TTTT11....', '...1S1AATTT1....', '....1TAATTT1....', '....1TAATTT1....',
     '....1PPPPPP1....', '...1PP1..1PP1...', '...1BB1..1BB1...'],
    ['....11TTTT11....', '....1TAATTT1....', '....1TAATTT1....', '...1S1AATTT1....',
     '....1PPPPPP1....', '....1PP11PP1....', '....1BB11BB1....']
  ]
};

// Hat or hair, skin, shirt, apron, pants, boots. Shirts O, w, G; caps I, S, Y; skin C or b.
// G (grid b) is the exact grass color, so a G shirt only works with the cream apron over it:
// the tender wears one, and no customer wears G. cust2 wears gold so the three bodies differ.
const PEOPLE = {
  player: { style: 'brim',   H: '8', S: '3', T: '4', A: '3', P: '2', B: '1' },
  buddy:  { style: 'cap',    H: '5', S: '3', T: 'm', A: 'm', P: '7', B: '1' },
  tender: { style: 'brim',   H: '9', S: 'e', T: 'b', A: '3', P: '2', B: '1' },
  cust0:  { style: 'cap',    H: '9', S: 'e', T: '4', A: '4', P: '7', B: '1' },
  cust1:  { style: 'hair',   H: '8', S: '3', T: 'm', A: 'm', P: '2', B: '1' },
  cust2:  { style: 'bucket', H: '8', S: 'e', T: '5', A: '5', P: '7', B: '1' }
};

function person(id, dir, frame, unhappy) {
  const v = PEOPLE[id];
  const map = { H: v.H, S: v.S, T: v.T, A: dir === 'up' ? v.T : v.A, P: v.P, B: v.B };
  const body = BODY[dir === 'side' ? 'side' : 'down'][frame];
  return paint(headRows(v.style, dir, unhappy).concat(body), map);
}

function staffSet(id) {
  const out = {};
  out[id + '_down'] = sprite(16, 16, [person(id, 'down', 0), person(id, 'down', 1), person(id, 'down', 2)]);
  out[id + '_up'] = sprite(16, 16, [person(id, 'up', 0), person(id, 'up', 1), person(id, 'up', 2)]);
  out[id + '_side'] = sprite(16, 16, [person(id, 'side', 0), person(id, 'side', 1), person(id, 'side', 2)]);
  return out;
}

function custSet(id) {
  const out = {};
  out[id + '_down'] = sprite(16, 16, [person(id, 'down', 0), person(id, 'down', 1), person(id, 'down', 2), person(id, 'down', 0, true)]);
  out[id + '_up'] = sprite(16, 16, [person(id, 'up', 1), person(id, 'up', 2)]);
  out[id + '_side'] = sprite(16, 16, [person(id, 'side', 1), person(id, 'side', 2)]);
  return out;
}

const PLAYER_MAP = { H: '8', S: '3', T: '4', A: '3', P: '2', B: '1' };
const PLAYER_SLICE = [
  paint([
    '................',
    '.....111111.....',
    '....1HHHHHH1....',
    '....1HHHHHH1....',
    '..11HHHHHHHH11..',
    '....1SSSSSS1....',
    '....1S1SS1S1.3..',
    '....1SSSSSS1.3..',
    '.....1SSSS1..3..',
    '....11TTTT11S1..',
    '..11TTAAAATT11..',
    '..1S1TAAAAT11...',
    '...11TAAAAT11...',
    '....1PP11PP1....',
    '....1PP11PP1....',
    '....1BB11BB1....'
  ], PLAYER_MAP),
  paint([
    '................',
    '.....111111.....',
    '....1HHHHHH1....',
    '....1HHHHHH1....',
    '..11HHHHHHHH11..',
    '....1SSSSSS1....',
    '....1S1SS1S1....',
    '....1SSSSSS1....',
    '.....1SSSS1.....',
    '....11TTTT11....',
    '..11TTAAAATT11..',
    '..1S1TAAAAT1S1..',
    '...11TAAAAT11333',
    '....1PP11PP1....',
    '....1PP11PP1....',
    '....1BB11BB1....'
  ], PLAYER_MAP)
];

const SHADOW = paint([
  '...777777...',
  '.7777777777.',
  '.7777777777.',
  '...777777...'
]);

/* ------------------------------------------------------------------ meat */

const MEAT_IDS = ['sausage', 'chicken', 'ribs', 'butt', 'brisket'];

// 8 by 8 shapes for the hand overlays.
const HAND_SHAPE = {
  sausage: [
    '........',
    '........',
    '.oooooo.',
    'oLXXXXXo',
    'oXXXXXxo',
    '.oooooo.',
    '........',
    '........'
  ],
  chicken: [
    '..oooo..',
    '.oLXXXo.',
    'oLXXXXXo',
    'oXXXXXXo',
    '.oXXXxo.',
    '..ooXo..',
    '...oBBo.',
    '....oo..'
  ],
  ribs: [
    '........',
    'oooooooo',
    'oLBXBXBo',
    'oXBXBXBo',
    'oXXXXXXo',
    'oxxxxxxo',
    'oooooooo',
    '........'
  ],
  butt: [
    '..oooo..',
    '.oLLXXo.',
    'oLXXXXXo',
    'oXXXXXXo',
    'oXXXXXXo',
    'oXXXXXxo',
    '.oXxxxo.',
    '..oooo..'
  ],
  brisket: [
    '........',
    '........',
    'oooooooo',
    'oBBBBBBo',
    'oLXXXXXo',
    'oxxxxxxo',
    'oooooooo',
    '........'
  ]
};

// 10 by 10 shapes for the grate pieces.
const PIECE_SHAPE = {
  sausage: [
    '..........',
    '.oooooooo.',
    'oLXXXXXXXo',
    'oXXXXXXXxo',
    '.oooooooo.',
    '.oooooooo.',
    'oLXXXXXXXo',
    'oXXXXXXXxo',
    '.oooooooo.',
    '..........'
  ],
  chicken: [
    '..........',
    '...ooooo..',
    '..oLXXXXo.',
    '.oLXXXXXXo',
    '.oXXXXXXXo',
    '.oXXXXXXxo',
    '..oXXXXxo.',
    '...oXXoo..',
    '....oBBo..',
    '.....oo...'
  ],
  ribs: [
    '..........',
    'oooooooooo',
    'oLBXBXBXBo',
    'oXBXBXBXBo',
    'oXXXXXXXXo',
    'oXXXXXXXXo',
    'oXXXXXXXxo',
    'oxxxxxxxxo',
    'oooooooooo',
    '..........'
  ],
  butt: [
    '...oooo...',
    '..oLLXXo..',
    '.oLXXXXXo.',
    'oLXXXXXXXo',
    'oXXXXXXXXo',
    'oXXXXXXXxo',
    'oXXXXXXxxo',
    '.oXXXXxxo.',
    '..oxxxxo..',
    '...oooo...'
  ],
  brisket: [
    '..........',
    '..........',
    'oooooooooo',
    'oBBBBBBBBo',
    'oLXXXXXXXo',
    'oXXXXXXXXo',
    'oXXXXXXXxo',
    'oxxxxxxxxo',
    'oooooooooo',
    '..........'
  ]
};

// Where the gold check sits on a done piece (top left of a 4 by 3 check).
const CHECK_AT = { sausage: [5, 1], chicken: [3, 3], ribs: [3, 4], butt: [3, 4], brisket: [3, 4] };
const CHECK = ['...5', '5.5.', '.5..'];

const MEAT_STATE = {
  raw:        { o: '1', X: 'f', x: 'f', L: '3', B: '3', i: '1' },
  cooking:    { o: '1', X: 'g', x: 'h', L: 'f', B: '3', i: '1' },
  done:       { o: '3', X: 'h', x: 'h', L: 'g', B: '3', i: '1' },   // cream ring
  cookedHand: { o: '1', X: 'h', x: 'h', L: 'g', B: '3', i: '1' },
  burnt:      { o: '1', X: '1', x: '1', L: 'l', B: 'l', i: '1' }
};

function pieceFrames(meat) {
  const shape = PIECE_SHAPE[meat];
  const done = stamp(paint(shape, MEAT_STATE.done), CHECK, CHECK_AT[meat][0], CHECK_AT[meat][1]);
  return [
    paint(shape, MEAT_STATE.raw),
    paint(shape, MEAT_STATE.cooking),
    done,
    paint(shape, MEAT_STATE.burnt)
  ];
}

// 6 by 2 toppings for plates, in cooked colors.
const TOPPING = {
  sausage: ['hhhh..', '..hhhh'],
  chicken: ['hhhhh3', 'hhhh..'],
  ribs:    ['h3h3h3', 'hhhhhh'],
  butt:    ['hehehe', 'ehehhe'],
  brisket: ['111111', 'hhhhhh']
};
// 2 by 2 toppings for the tray's small plates.
const TOPPING_SMALL = {
  sausage: ['hh', 'hh'],
  chicken: ['h3', 'hh'],
  ribs:    ['h3', 'h3'],
  butt:    ['he', 'eh'],
  brisket: ['11', 'hh']
};

const PLATE_BASE = paint([
  '..3333..',
  '.333333.',
  '33333333',
  '33333333',
  '.366663.',
  '..6666..'
]);

function plateRows(meat) {
  return stamp(PLATE_BASE, TOPPING[meat], 1, 1);
}

const TRAY_BASE = paint([
  '.33..33.',
  '33333333',
  '33333333',
  '.33..33.',
  '11111111',
  '1eeeeee1',
  '1eeeeee1',
  '11111111'
]);

function trayRows(meat) {
  let rows = stamp(TRAY_BASE, TOPPING_SMALL[meat], 1, 1);
  rows = stamp(rows, TOPPING_SMALL[meat], 5, 1);
  return rows;
}

const HAND_TRAY_EMPTY = paint([
  '........',
  '........',
  '........',
  '11111111',
  '1eeeeee1',
  '1eeeeee1',
  '1eeeeee1',
  '11111111'
]);

const HAND_CHARCOAL = paint([
  '...11...',
  '..1661..',
  '.116611.',
  '.166661.',
  '.111111.',
  '.166661.',
  '.166661.',
  '.111111.'
]);

const HAND_BURNT = paint([
  '........',
  '..1111..',
  '.1l11111',
  '11111111',
  '11111111',
  '.111111.',
  '..1111..',
  '........'
]);

const ICON = {
  sausage: paint([
    '........',
    '..1111..',
    '.1gggg1.',
    '1ghhhhg1',
    '1hh11hh1',
    '1h1..1h1',
    '.1....1.',
    '........'
  ]),
  chicken: paint([
    '..1111..',
    '.1gghh1.',
    '1ghhhhh1',
    '1hhhhhh1',
    '.1hhhh1.',
    '..11h1..',
    '...1331.',
    '....11..'
  ]),
  ribs: paint([
    '........',
    '11111111',
    '1g3h3h31',
    '1h3h3h31',
    '1hhhhhh1',
    '1h3h3h31',
    '11111111',
    '........'
  ]),
  butt: paint([
    '..1111..',
    '.1gggh1.',
    '1gghhhh1',
    '1hhhhhh1',
    '1hhhhhh1',
    '1hhhhhh1',
    '.1hhhh1.',
    '..1111..'
  ]),
  brisket: paint([
    '........',
    '11111111',
    '11111111',
    '1ffffff1',
    '1hhhhhh1',
    '1hhhhhh1',
    '11111111',
    '........'
  ])
};

const MARK_X = paint([
  '44....44',
  '.44..44.',
  '..4444..',
  '...44...',
  '..4444..',
  '.44..44.',
  '44....44',
  '........'
]);

/* ------------------------------------------------------------------ cookers */

function glow(rows, band, ventRow) {
  return rows.map(function (r, y) {
    return r.split('').map(function (ch, x) {
      if (ch !== 'F') return ch;
      if (band === 0) return y === ventRow ? '1' : '2';
      if (band === 1) return '4';
      if (band === 2) return 'i';
      return (x >= 5 && x <= 10) ? 'j' : 'i';
    }).join('');
  });
}

const KETTLE_LIT = [
  '................',
  '....11111111....',
  '..119999999911..',
  '.19FFFFFFFFFF91.',
  '.19999999999991.',
  '19FFFFFFFFFFFF91',
  '1999999999999991',
  '19FFFFFFFFFFFF91',
  '1999999999999991',
  '.19FFFFFFFFFF91.',
  '.19888888888881.',
  '..118888888811..',
  '...1188888811...',
  '....11111111....',
  '....1......1....',
  '...11......11...'
];
const KETTLE_LID = [
  '.19kk9999999991.',
  '.19k99999999991.',
  '1999999911999991',
  '1999999911999991',
  '1999999999999991',
  '1999999999999991',
  '.19999999999991.'
];
const KETTLE_COLD = KETTLE_LIT.slice(0, 3).concat(KETTLE_LID, KETTLE_LIT.slice(10));

function kettleFrames() {
  return [
    paint(KETTLE_COLD),
    paint(glow(KETTLE_LIT, 1)),
    paint(glow(KETTLE_LIT, 2)),
    paint(glow(KETTLE_LIT, 3))
  ];
}

const DRUM_WINDOW = [
  '12FFFFFFFFFFFF21',
  '12FFFFFFFFFFFF21',
  '12FFFFFFFFFFFF21',
  '1299999999999921',
  '12FFFFFFFFFFFF21',
  '12FFFFFFFFFFFF21',
  '1299999999999921',
  '12FFFFFFFFFFFF21',
  '12FFFFFFFFFFFF21',
  '12FFFFFFFFFFFF21'
];
const DRUM_BASE = [
  '.......11.......',
  '.......11.......',
  '....11111111....',
  '..11k999999911..',
  '.19999999999991.'
].concat(DRUM_WINDOW, [
  '1777777777777771',
  '1222222222222221'
], DRUM_WINDOW, [
  '1777777777777771',
  '1222222222222221',
  '122222FFFF222221',
  '1111111111111111',
  '..11........11..'
]);

function drumFrames() {
  return [
    paint(glow(DRUM_BASE, 0, 29)),
    paint(glow(DRUM_BASE, 1)),
    paint(glow(DRUM_BASE, 2)),
    paint(glow(DRUM_BASE, 3))
  ];
}

/* ------------------------------------------------------------------ stations */

function outlineFrame(top, bottom) {
  const g = new Grid(16, 16, '0');
  for (let i = 0; i < 16; i++) {
    const dash = (i % 4) < 2;
    if (!dash) continue;
    if (top) g.set(i, 0, '6');
    if (bottom) g.set(i, 15, '6');
    g.set(0, i, '6');
    g.set(15, i, '6');
  }
  return g.done();
}

const COOLER_CRATE = paint([
  '................',
  '................',
  '................',
  '..111111111111..',
  '.1eeeeeeeeeeed1.',
  '.1eeeeeeeeeeed1.',
  '.1dddddddddddd1.',
  '.1eeeeeeeeeeed1.',
  '.1eeeeeeeeeeed1.',
  '.1dddddddddddd1.',
  '.1eeeeeeeeeeed1.',
  '.1eeeeeeeeeeed1.',
  '.1dddddddddddd1.',
  '.1eeeeeeeeeeed1.',
  '..111111111111..',
  '................'
]);
const COOLER_BODY = [
  '.13333333333361.',
  '.13333333333361.',
  '.13333333333361.',
  '.13333333333361.',
  '.13333333333361.',
  '.16666666666661.',
  '..111111111111..',
  '................'
];
const COOLER_SHUT = paint([
  '................',
  '................',
  '......1111......',
  '..111111111111..',
  '.1mmmmmmmmmmmm1.',
  '.1mmmmmmmmmmmm1.',
  '.1mmmmmmmmmmmm1.',
  '.11111111111111.'
].concat(COOLER_BODY));
const COOLER_OPEN = paint([
  '..111111111111..',
  '.1mmmmmmmmmmmm1.',
  '.1mmmmmmmmmmmm1.',
  '..111111111111..',
  '.1m3m3m3m3m3m31.',
  '.13m3m3m3m3m3m1.',
  '.1m3m3m3m3m3m31.',
  '.11111111111111.'
].concat(COOLER_BODY));

const BOARD_EMPTY = paint([
  '................',
  '..111111111111..',
  '.1dddddddddddd1.',
  '.1d1111111111d1.',
  '.1d1eeeeeeee1d1.',
  '.1d1eeeeeeee1d1.',
  '.1d1eeeeeeee1d1.',
  '.1d1eeeeeeee1d1.',
  '.1d1eeeeeeee1d1.',
  '.1d1eeeeeeee1d1.',
  '.1d1eeeeeeee1d1.',
  '.1d1111111111d1.',
  '.1dddddddddddd1.',
  '..111111111111..',
  '..1..........1..',
  '..1..........1..'
]);
const BOARD_LUMP = paint([
  '.1111.',
  '1ghhh1',
  '1hhhh1',
  '1hhhh1',
  '.1111.'
]);
const BOARD_BUSY = stamp(BOARD_EMPTY, BOARD_LUMP, 5, 5);

const TABLE_MID = paint([
  '................',
  '1111111111111111',
  '3333333333333333',
  '3333333333333333',
  '3333333333333333',
  '3333333333333333',
  '3333333333333333',
  '3333333333333333',
  '3333333333333333',
  '3333333333333333',
  '1111111111111111',
  '3333333333333333',
  '6666666666666666',
  '1111111111111111',
  '7777777777777777',
  '................'
]);
const TABLE_END = paint([
  '................',
  '1111111111111111',
  '1333333333333333',
  '1333333333333333',
  '1333333333333333',
  '1333333333333333',
  '1333333333333333',
  '1333333333333333',
  '1333333333333333',
  '1333333333333333',
  '1111111111111111',
  '1333333333333333',
  '1666666666666666',
  '1111111111111111',
  '.777777777777777',
  '................'
]);

function canopyRows() {
  const g = new Grid(80, 24, '0');
  g.rect(0, 0, 80, 1, '1');
  g.rect(0, 1, 1, 13, '1');
  g.rect(79, 1, 1, 13, '1');
  for (let y = 1; y < 13; y++) {
    for (let x = 1; x < 79; x++) g.set(x, y, ((x - 1) % 12) < 3 ? '4' : '3');
  }
  g.rect(0, 13, 80, 1, '1');
  for (let x = 0; x < 80; x++) {
    const m = x % 8;
    if (m === 1 || m === 6) g.set(x, 14, '1');
    else if (m >= 2 && m <= 5) g.set(x, 14, '3');
    if (m >= 2 && m <= 5) g.set(x, 15, '1');
  }
  [1, 75].forEach(function (px) {
    g.rect(px, 16, 1, 8, '1');
    g.rect(px + 1, 16, 1, 8, 'k');
    g.rect(px + 2, 16, 1, 8, '9');
    g.rect(px + 3, 16, 1, 8, '1');
  });
  return g.done();
}

function canopyPoleRows() {
  const g = new Grid(4, 20, '0');
  g.rect(0, 0, 1, 19, '1');
  g.rect(1, 0, 1, 19, 'k');
  g.rect(2, 0, 1, 19, '9');
  g.rect(3, 0, 1, 19, '1');
  g.rect(0, 19, 4, 1, '1');
  return g.done();
}

const PILE_BASE = paint([
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '....dddddddd....',
  '..dddddddddddd..',
  '.dddddddddddddd.',
  '..dddddddddddd..',
  '....dddddddd....'
]);
const BAG = paint([
  '.1111.',
  '116611',
  '166661',
  '166661',
  '.1111.'
]);
const CRUMBS = paint([
  '.11.....1.',
  '....11..11',
  '.1....1...'
]);

function pileFrames() {
  let full = PILE_BASE;
  [[0, 10], [5, 10], [10, 10], [2, 6], [8, 6], [5, 2]].forEach(function (p) { full = stamp(full, BAG, p[0], p[1]); });
  let half = PILE_BASE;
  [[2, 10], [8, 10], [5, 6]].forEach(function (p) { half = stamp(half, BAG, p[0], p[1]); });
  const low = stamp(PILE_BASE, BAG, 5, 10);
  const bare = stamp(PILE_BASE, CRUMBS, 3, 12);
  return [full, half, low, bare];
}

const TRASH = paint([
  '................',
  '......1111......',
  '...1111111111...',
  '..1kkkkkkkkkk1..',
  '..111111111111..',
  '...1999999991...',
  '...1k99999971...',
  '...1k99999971...',
  '...1777777771...',
  '...1k99999971...',
  '...1k99999971...',
  '...1777777771...',
  '...1k99999971...',
  '...1999999991...',
  '...1111111111...',
  '................'
]);

function gateBase() {
  const g = new Grid(16, 16, 'b');
  g.rect(5, 0, 6, 16, 'd');
  g.rect(0, 0, 1, 16, '1'); g.rect(1, 0, 1, 16, '2');
  g.rect(14, 0, 1, 16, '2'); g.rect(15, 0, 1, 16, '1');
  return g;
}
function gateShut() {
  const g = gateBase();
  [4, 10].forEach(function (y) { g.rect(2, y, 12, 1, '1'); g.rect(2, y + 1, 12, 1, '2'); });
  [3, 7, 11].forEach(function (x) {
    g.set(x, 1, '1'); g.set(x + 1, 1, '1');
    g.rect(x, 2, 1, 12, '1'); g.rect(x + 1, 2, 1, 12, '2');
    g.set(x, 14, '1'); g.set(x + 1, 14, '1');
  });
  return g.done();
}
function gateOpen() {
  const g = gateBase();
  g.rect(12, 1, 1, 14, '1'); g.rect(13, 1, 1, 14, '2');
  g.rect(12, 0, 2, 1, '1'); g.rect(12, 15, 2, 1, '1');
  return g.done();
}

function fenceH() {
  const g = new Grid(16, 16, 'b');
  [2, 8].forEach(function (y) {
    g.rect(0, y, 16, 1, '1'); g.rect(0, y + 1, 16, 2, '2'); g.rect(0, y + 3, 16, 1, '7');
  });
  g.rect(6, 1, 1, 13, '1'); g.rect(7, 1, 2, 13, '2'); g.rect(9, 1, 1, 13, '1');
  g.rect(6, 1, 4, 1, '1'); g.rect(6, 13, 4, 1, '1');
  return g.done();
}
function fenceV() {
  const g = new Grid(16, 16, 'b');
  [3, 9].forEach(function (y) { g.rect(0, y, 16, 1, '1'); g.rect(0, y + 1, 16, 2, '2'); });
  [2, 9].forEach(function (x) {
    g.rect(x, 0, 1, 16, '1'); g.rect(x + 1, 0, 2, 16, '2'); g.rect(x + 3, 0, 1, 16, '7');
  });
  return g.done();
}

function hedgeRows() {
  const g = new Grid(16, 16, 'c');
  for (let y = 0; y < 14; y++) {
    for (let x = 0; x < 16; x++) {
      if (((x * 7 + y * 3) % 11) === 0 && x < 13 && y < 11) g.set(x, y, 'b');
      else if (((x * 5 + y * 7) % 13) === 0 && (x > 8 || y > 8)) g.set(x, y, 'a');
    }
  }
  g.rect(0, 14, 16, 1, 'a');
  g.rect(0, 15, 16, 1, 'a');
  g.rect(1, 15, 14, 1, '7');
  return g.done();
}

const GRASS_A = paint([
  'bbbbbbbbbbbbbbbb',
  'bbbbbbbbbbbbbbbb',
  'bbbabbbbbbbbbbbb',
  'bbaabbbbbbbbbabb',
  'bbbbbbbbbbbbbbbb',
  'bbbbbbbbbabbbbbb',
  'bbbbbbbbaabbbbbb',
  'bbbbbbbbbbbbbbbb',
  'bbbbbbbbbbbbbbbb',
  'bbbbbbbbbbbbbbbb',
  'bbbbabbbbbbbbbbb',
  'bbbaabbbbbbbabbb',
  'bbbbbbbbbbbaabbb',
  'bbbbbbbbbbbbbbbb',
  'bbbbbbbabbbbbbbb',
  'bbbbbbbbbbbbbbbb'
]);
const GRASS_B = GRASS_A.slice().reverse().map(function (r) { return r.slice(8) + r.slice(0, 8); });

function pathRows() {
  const g = new Grid(16, 16, 'd');
  [[2, 1], [13, 1], [9, 3], [10, 3], [4, 6], [14, 8], [1, 9], [7, 11], [8, 11], [12, 13], [3, 14]]
    .forEach(function (p) { g.set(p[0], p[1], 'e'); });
  [[6, 2], [12, 5], [2, 12], [10, 14]].forEach(function (p) { g.set(p[0], p[1], '2'); });
  return g.done();
}

/* ------------------------------------------------------------------ effects */

const BUBBLE = paint([
  '.11111111111111.',
  '1333333333333331',
  '1333333333333331',
  '1333333333333331',
  '1333333333333331',
  '1333333333333331',
  '1333333333333331',
  '1333333333333331',
  '1333333333333331',
  '1333333333333331',
  '.11111133111111.',
  '.......11.......'
]);

const SMOKE = [
  paint([
    '........',
    '........',
    '........',
    '...kk...',
    '..kkkl..',
    '...ll...',
    '........',
    '........'
  ]),
  paint([
    '........',
    '...kk...',
    '..kkkk..',
    '.kkkkkl.',
    '.kkklll.',
    '..llll..',
    '........',
    '........'
  ]),
  paint([
    '..kkkk..',
    '.kkkkkk.',
    'kkkkkkkl',
    'kkkkklll',
    'kkkkllll',
    '.llllll.',
    '..llll..',
    '........'
  ])
];

const FIRE = [
  paint([
    '........',
    '...i....',
    '...ii...',
    '..iji...',
    '..ijji..',
    '.iijjii.',
    '.4iiii4.',
    '..4444..'
  ]),
  paint([
    '........',
    '....i...',
    '...ii...',
    '...iji..',
    '..ijjii.',
    '.iijjii.',
    '.4iiii4.',
    '..4444..'
  ]),
  paint([
    '........',
    '........',
    '..i.i...',
    '..ii.i..',
    '.iijii..',
    '.ijjjii.',
    '.4iiii4.',
    '..4444..'
  ])
];

const COIN = [
  paint([
    '..1111..',
    '.1jj551.',
    '1j555541',
    '15555441',
    '15554441',
    '15444441',
    '.144441.',
    '..1111..'
  ]),
  paint([
    '...11...',
    '..1551..',
    '..1541..',
    '..1541..',
    '..1541..',
    '..1541..',
    '..1441..',
    '...11...'
  ])
];

// 4 by 6 glyphs: 0 to 9, A to Z, +, :
const FONT_GLYPHS = [
  ['.##.', '#..#', '#..#', '#..#', '#..#', '.##.'],   // 0
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
  ['....', '.#..', '....', '....', '.#..', '....']    // :
];
const FONT_MAP = { '#': '3' };

function glyphIndex(ch) {
  const c = ch.charCodeAt(0);
  if (c >= 48 && c <= 57) return c - 48;
  if (c >= 65 && c <= 90) return 10 + (c - 65);
  if (ch === '+') return 36;
  if (ch === ':') return 37;
  return -1;
}

/* ------------------------------------------------------------------ the set */

const SPRITES = {};
function add(name, w, h, frames) { SPRITES[name] = sprite(w, h, frames); }
function merge(set) { Object.keys(set).forEach(function (k) { SPRITES[k] = set[k]; }); }

// People
merge(staffSet('player'));
add('player_slice', 16, 16, PLAYER_SLICE);
merge(staffSet('buddy'));
merge(staffSet('tender'));
merge(custSet('cust0'));
merge(custSet('cust1'));
merge(custSet('cust2'));
add('shadow', 12, 4, [SHADOW]);

// Hands
add('hand_charcoal', 8, 8, [HAND_CHARCOAL]);
MEAT_IDS.forEach(function (m) { add('hand_raw_' + m, 8, 8, [paint(HAND_SHAPE[m], MEAT_STATE.raw)]); });
MEAT_IDS.forEach(function (m) { add('hand_cooked_' + m, 8, 8, [paint(HAND_SHAPE[m], MEAT_STATE.cookedHand)]); });
add('hand_burnt', 8, 8, [HAND_BURNT]);
MEAT_IDS.forEach(function (m) {
  add('hand_plate_' + m, 8, 8, [stamp(paint(rep('........', 8)), plateRows(m), 0, 1)]);
});
MEAT_IDS.forEach(function (m) { add('hand_tray_' + m, 8, 8, [trayRows(m)]); });
add('hand_tray', 8, 8, [HAND_TRAY_EMPTY]);

// Icons and plates
MEAT_IDS.forEach(function (m) { add('icon_' + m, 8, 8, [ICON[m]]); });
MEAT_IDS.forEach(function (m) { add('plate_' + m, 8, 6, [plateRows(m)]); });
MEAT_IDS.forEach(function (m) { add('piece_' + m, 10, 10, pieceFrames(m)); });
add('mark_x', 8, 8, [MARK_X]);

// Stations
add('kettle', 16, 16, kettleFrames());
add('drum', 16, 32, drumFrames());
add('outline', 16, 16, [outlineFrame(true, true), outlineFrame(true, false), outlineFrame(false, true)]);
add('cooler', 16, 16, [COOLER_CRATE, COOLER_SHUT, COOLER_OPEN]);
add('board', 16, 16, [BOARD_EMPTY, BOARD_BUSY]);
add('table_mid', 16, 16, [TABLE_MID]);
add('table_end', 16, 16, [TABLE_END]);
add('canopy', 80, 24, [canopyRows()]);
add('canopy_pole', 4, 20, [canopyPoleRows()]);
add('pile', 16, 16, pileFrames());
add('trash', 16, 16, [TRASH]);
add('gate', 16, 16, [gateShut(), gateOpen()]);
add('fence_h', 16, 16, [fenceH()]);
add('fence_v', 16, 16, [fenceV()]);
add('hedge', 16, 16, [hedgeRows()]);
add('grass', 16, 16, [GRASS_A, GRASS_B]);
add('path', 16, 16, [pathRows()]);

// Effects and text
add('bubble', 16, 12, [BUBBLE]);
add('smoke', 8, 8, SMOKE);
add('fire', 8, 8, FIRE);
add('coin', 8, 8, COIN);
add('font', 4, 6, FONT_GLYPHS.map(function (g) { return paint(g, FONT_MAP); }));

/* ------------------------------------------------------------------ build and draw */

let built = false;
const cache = {};      // name -> canvas per frame
const flipCache = {};  // name -> mirrored canvas per frame

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
            throw new Error('sprite ' + name + ' frame ' + i + ' row ' + j + ': character "' + row[x] + '" at column ' + x + ' is not in the palette');
          }
        }
      });
    });
  });
}

function render(rows, w, h) {
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
      g.fillStyle = PALETTE[CHARS.indexOf(ch)];
      g.fillRect(x, y, x2 - x, 1);
      x = x2;
    }
  }
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
  built = true;
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
  canvasFor: canvasFor,
  text: text,
  textWidth: textWidth
};
Object.defineProperty(art, 'built', { enumerable: true, get: function () { return built; } });

PitSim.art = art;
})();
