'use strict';
/*
 * games/pit-sim/art3/palette.js  (v3 art library, palette)
 * Registers PitSim.art3.PAL. Spec: docs/superpowers/specs/2026-10-18-pit-sim-art3-bible.md.
 * Every hex below is measured from docs/superpowers/mocks/pit-sim-v3/b-iso-pixel.html (mock B,
 * the look Joel picked) or screen-6-creator.html (the six skin, hair and apron swatches), unless
 * its comment says "filled" (a tone mock B never needed, picked on the same hue line).
 *
 * A ramp is four tones, light to dark: [hi, base, shade, dark].
 *   hi    top faces, lit left columns (light comes from the top left)
 *   base  front faces
 *   shade right side faces, the bottom right shade band
 *   dark  deepest crease, grooves, the 1 px shadow under a lip
 * Optional extras on a ramp: rim (the 1 px lit front edge of a top face), spec (1 px specular),
 * ol (outline override; most ramps use the shared outline OL).
 * Not loaded by the game yet; v3.4 swaps it in. No dependencies, no DOM.
 */
(function () {
const PitSim = globalThis.PitSim || (globalThis.PitSim = {});
const art3 = PitSim.art3 || (PitSim.art3 = {});

/* --------------------------------------------------------------- helpers (pure) */
function hexToRgb(hex) {
  const n = parseInt(String(hex).slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function rgbToHex(c) {
  return '#' + c.map(function (v) {
    const k = Math.max(0, Math.min(255, Math.round(v)));
    return (k < 16 ? '0' : '') + k.toString(16);
  }).join('');
}
function mix(a, b, t) {
  const x = hexToRgb(a), y = hexToRgb(b);
  return rgbToHex([x[0] + (y[0] - x[0]) * t, x[1] + (y[1] - x[1]) * t, x[2] + (y[2] - x[2]) * t]);
}
function rgba(hex, a) {
  const c = hexToRgb(hex);
  return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + a + ')';
}

/* --------------------------------------------------------------- anchors */
// The four site tones. Fixed: never retune these to suit a sprite.
const ANCHOR = Object.freeze({ K: '#1b1714', U: '#2a2015', C: '#E6D8B8', O: '#D06129' });

// The shared outline. Every solid object's silhouette, the eyes, the shoe line. Round 1 deepened
// it from mock B's #2a1a14 toward the near black anchor K so props pop off the warmer ground.
const OL = '#1e1510';

/* --------------------------------------------------------------- ramps */
function ramp(hi, base, shade, dark, extra) {
  const r = [hi, base, shade, dark];
  r.hi = hi; r.base = base; r.shade = shade; r.dark = dark;
  if (extra) Object.keys(extra).forEach(function (k) { r[k] = extra[k]; });
  return Object.freeze(r);
}

const RAMP = {
  // ground (never outlined)
  // round 1 (art director): warmer and more saturated than the first pass, to match mock B's PNG
  // round 2 (art director): the round 1 lawn read lime and the grout made a loud orange checker.
  // Lawn one step greener and darker toward mock B's PNG; cobbles soft cream with a light grout
  // and a narrow base to alt step, so the patio reads as texture, not a checkerboard.
  // v3.4 review: lawn and cobbles one step darker so stations, guests and plates pop.
  lawnA:    ramp('#86c45a', '#6aae42', '#5c9e38', '#4c8a2e'),           // the lit checker diamond (mock #7cc84a)
  lawnB:    ramp('#7ab650', '#5e9e3a', '#529030', '#447e28'),           // the darker checker diamond (mock #6cb840)
  paver:    ramp('#e4d0a8', '#d2b484', '#c8a878', '#a87646', { alt: '#dabe92', grout: '#b5844e' }), // soft cream cobbles; light tan grout
  stone:    ramp('#e8e1d1', '#cfc6b4', '#b3a994', '#8e8572'),           // stepping stone; shade, dark filled
  sky:      ramp('#ffffff', '#b9e6f8', '#9fd9f4', '#7cc4e6'),           // hi = cloud; dark filled
  // plants
  leaf:     ramp('#7fcf63', '#58ad4f', '#3d8f3f', '#2f7a35'),           // tree canopy
  hedge:    ramp('#56ad57', '#3f9248', '#2f7a3b', '#24602e'),           // backdrop tree line; dark filled
  stem:     ramp('#5cbf55', '#3f9a45', '#2f7a35', '#24602e'),           // flower stems
  soil:     ramp('#8a6040', '#6e4a2e', '#56391f', '#3e2814'),           // hi, dark filled
  // wood: three ramps, light to dark stock
  woodL:    ramp('#f2c58a', '#e2a866', '#c98a4b', '#a26a36', { rim: '#f6d6a4' }), // planks, table tops; rim filled
  woodM:    ramp('#e2a866', '#c98a4b', '#a26a36', '#7c4c25', { rim: '#f2c58a' }), // posts, boxes, sign frame
  woodD:    ramp('#9c6438', '#7a4a28', '#5e3a1e', '#4a2c16'),           // legs, log sides; shade filled
  logEnd:   ramp('#f6d9a4', '#e8bc7e', '#c8935a', '#9c6438'),           // cut log faces, rings
  bark:     ramp('#a8744a', '#8a5a34', '#6b4426', '#4e301a'),           // tree trunk; dark filled
  board:    ramp('#f3cf94', '#d6a362', '#b8844a', '#8e6232'),           // cutting board; dark filled
  // buildings and fences
  barn:     ramp('#de6e55', '#c9553d', '#a8432f', '#8f3928', { trim: '#fbf3e2' }), // red wall; dark = end wall plank line
  roof:     ramp('#7385a6', '#5b6b8a', '#47546f', '#36405a'),           // slate shingles; dark filled
  glass:    ramp('#d7f2ff', '#8fd3f5', '#6ab8e0', '#4a96c0'),           // window; shade, dark filled
  fence:    ramp('#fbf3e2', '#f4ead2', '#d8c9a6', '#b5a37f'),           // pickets lit face, shaded face, rails
  // cook gear
  kettle:   ramp('#575769', '#383844', '#24242c', '#141418', { spec: '#9a9ab0' }),
  drum:     ramp('#e8604c', '#c63d2c', '#94291d', '#5c1d16'),
  coolerRed:   ramp('#d8443a', '#c43a30', '#9c2a22', '#6e1c16'),        // dark filled
  coolerWhite: ramp('#fbf8f0', '#e2ddd2', '#c9c2b4', '#a89f8e', { rim: '#ffffff', handle: '#f4ece0' }), // dark filled
  cloth:    ramp('#6ea6f2', '#3f82e0', '#2c63b8', '#214c90', { rim: '#a9cbff', check: '#8fbaf5' }),
  steel:    ramp('#e6e8ee', '#b9bcc6', '#8a8e9a', '#5c606c'),           // tongs, knife; shade, dark filled
  plate:    ramp('#ffffff', '#fbf8f0', '#d4cec2', '#b0a898'),           // dark filled
  // charcoal and fire
  charcoal: ramp('#5a5450', '#3a3532', '#262220', '#161312', { ash: '#c9c2b4', ashD: '#8a8478' }), // filled
  ember:    ramp('#ffd25a', '#ff9a3c', '#e0531f', '#8a2a12'),           // kettle seam glow; shade, dark filled
  // smoke: opaque tones, drawn at the ALPHA.smoke* levels
  smoke:    ramp('#ffffff', '#f3f3f6', '#d2d3dc', '#9d9eae', { ol: '#9d9eae' }),
  smokeDark: ramp('#9a948e', '#6e6863', '#544f4b', '#3a3633', { ol: '#3a3633' }), // burning; filled
  // food on plates and in bubbles (the done state of each meat)
  sausage:  ramp('#e07a4c', '#b84d2a', '#92381c', '#7a2c14'),
  chicken:  ramp('#f2c36a', '#d9973d', '#b8762a', '#8a541c'),           // shade, dark filled
  ribs:     ramp('#b8603c', '#8a3a22', '#6e2c18', '#5e2412'),           // dark = bone-gap line
  brisket:  ramp('#d07a5c', '#b0563c', '#9c4a34', '#6e2e1e', { bark: '#3e2318', barkL: '#5a3424', ring: '#ff7f72', fat: '#f6dcae' }),
  butt:     ramp('#d9905e', '#b86a3e', '#94502c', '#6a3418', { bark: '#4a2414' }), // pork butt: filled, not in mock B
  bone:     ramp('#fffaf0', '#f7ecd2', '#e2d2b0', '#bca67c'),
  heart:    ramp('#ffb0bd', '#ff4f6d', '#d83652', '#a8243c'),
  coin:     ramp('#fff2b8', '#F3CF6D', '#e0a82e', '#c98a1e'),
  // added by the assembler (index.js) on the category builders' requests, all filled
  clay:     ramp('#e8916a', '#c96a42', '#a4502f', '#7a3820'),           // flower pots (yard asked; was the barn ramp)
  bloom:    ramp('#fff6d0', '#ffe9a0', '#f2cf6a', '#d8a83a'),           // flower centres; base = the bible's #ffe9a0
  fur:      ramp('#f0c690', '#d49a5c', '#a8703c', '#7a4c26'),           // the dog (yard asked)
  orange:   ramp('#f08a4c', '#D06129', '#a84a1c', '#7a3410'),           // UI orange around anchor O (fx asked); shade, dark from mock B
  ironRed:  ramp('#a8504a', '#7e3430', '#5e2422', '#401614'),           // maroon tank of the gear card trailer (kit asked)
  bulbs:    Object.freeze(['#ffd84f', '#ff8a4f', '#76d2ff', '#9cf06a', '#ff6f9a']),
  flowers:  Object.freeze(['#ff7aa8', '#ffd84f', '#ffffff', '#ff8a4f', '#c792ff'])
};

// Doneness ramps, one set of four per meat: raw, cooking, done, burnt. done is the food ramp above.
const MEAT = {
  sausage: { raw: ramp('#f8c0b4', '#ee9a8e', '#d47a70', '#a85850'), cooking: ramp('#ec9466', '#d0663e', '#b04e2c', '#86381c') },
  chicken: { raw: ramp('#fde8d8', '#f4ccb4', '#dca890', '#b0806a'), cooking: ramp('#f6d690', '#e8b060', '#c88a40', '#9a6428') },
  ribs:    { raw: ramp('#f8b4b0', '#f29a9a', '#d97a7c', '#a85458'), cooking: ramp('#d8805a', '#b85a36', '#94442a', '#6e3020') },
  butt:    { raw: ramp('#fac0b8', '#f2a4a0', '#d8847e', '#aa5e5a'), cooking: ramp('#e49468', '#c87046', '#a65432', '#7a3a20') },
  brisket: { raw: ramp('#f4a8a0', '#e07c74', '#c05a56', '#8e3c3c'), cooking: ramp('#c8704e', '#a04a30', '#7e3622', '#5a2416') }
};
const BURNT = ramp('#4a3a32', '#2e221c', ANCHOR.K, '#1f110b');          // near black kept for burnt meat; dark = char
Object.keys(MEAT).forEach(function (m) {
  MEAT[m].done = RAMP[m];
  MEAT[m].burnt = BURNT;
  Object.freeze(MEAT[m]);
});

/* --------------------------------------------------------------- people swaps */
// Skin: [hi, base, shade, dark] plus cheek. Creator swatch order, light to deep.
function skin(hi, base, shade, dark, cheek) { return ramp(hi, base, shade, dark, { cheek: cheek }); }
const SKIN = Object.freeze([
  skin('#ffeadb', '#f7d9c4', '#e2b79c', '#b88a70', '#f2a493'),
  skin('#f8d7b6', '#edc29b', '#d3a278', '#a87850', '#e8957c'),
  skin('#e8b98c', '#d9a06e', '#bc8052', '#8e5a34', '#d57e62'),
  skin('#cc9264', '#b87a4b', '#985e35', '#6e4024', '#c0604a'),
  skin('#a46a45', '#8e5634', '#714227', '#4e2c18', '#a04a36'),
  skin('#734932', '#5f3a25', '#4a2c1b', '#2e1a10', '#7e3a2a')
]);
const HAIR = Object.freeze([                                              // [light, base, dark, deepest]
  ramp('#4a3426', '#2a1c14', '#170f0a', '#0e0906'),                       // black
  ramp('#86573a', '#5a3620', '#3a2212', '#24140a'),                       // brown
  ramp('#c0603a', '#9a4424', '#6e2e16', '#4a1e0e'),                       // auburn
  ramp('#f4d488', '#e2b65a', '#b88c38', '#8a6424'),                       // blond
  ramp('#f4a060', '#e07a32', '#b0561c', '#7e3a10'),                       // ginger
  ramp('#e2ded8', '#b9b4ae', '#8e8984', '#66625e')                        // gray
]);
const APRON = Object.freeze([
  ramp('#e8604c', '#d2412f', '#a8301f', '#7e2016'),                       // red
  ramp('#f4a050', '#e8862e', '#c0661c', '#8a4410'),                       // orange
  ramp('#5cba5a', '#3f9a42', '#2e7a32', '#1e5a22'),                       // green
  ramp('#4f8ae0', '#2f6ac0', '#22509a', '#183a72'),                       // blue
  ramp('#625a52', '#4a423c', '#38312c', '#24201c'),                       // charcoal
  ramp('#f080b4', '#e0609a', '#b8467a', '#8a305a')                        // pink
]);
// Shirts and pants: [hi, base, shade]; base and shade from mock B guests, hi filled.
function cloth3(hi, base, shade) { return Object.freeze([hi, base, shade]); }
const SHIRT = Object.freeze({
  white:   cloth3('#ffffff', '#fbf8f0', '#d8d2c6'),
  purple:  cloth3('#a87ee0', '#8a5cc9', '#6a42a3'),
  red:     cloth3('#f07a62', '#e0533d', '#b53d2b'),
  teal:    cloth3('#52c2b8', '#2fa39a', '#20807a'),
  yellow:  cloth3('#ffda60', '#f2c230', '#cf9e1a'),
  green:   cloth3('#9ede88', '#7cc46a', '#5aa04c'),
  sky:     cloth3('#66bce8', '#3aa0d8', '#2a7fb0'),
  pink:    cloth3('#ffb4cc', '#ff8fb0', '#d96a8c'),
  orange:  cloth3('#ffac66', '#f08a3c', '#c86a24'),
  blue:    cloth3('#7090e8', '#4a6fd8', '#3452b0'),
  magenta: cloth3('#e070a8', '#c94a8a', '#a3366c'),
  denim:   cloth3('#86cede', '#5fb4c9', '#3f8ea6')                        // creator tee
});
// Crew shirt by role, on the hue of the card bands in design doc 12.3.
const ROLE_SHIRT = Object.freeze({ FIRE: 'orange', PREP: 'green', RUN: 'blue', DRIVE: 'denim', TILL: 'yellow' });
const PANTS = Object.freeze([
  cloth3('#50648e', '#3c4f7a', '#2c3b5e'),                                // navy (mock B default)
  cloth3('#6e5e4c', '#5a4a3a', '#44382a'),                                // khaki brown
  cloth3('#5e4c40', '#4a3a30', '#362a22')                                 // dark brown
]);
const SHOE = '#3a2a22';
const FACE = Object.freeze({ eye: OL, catch: '#ffffff', mouth: '#b0443a', mouthIn: '#6a2a1c', teeth: '#fff6ea', blush: '#f7a493', glint: '#ffffff' });
const HAT = Object.freeze({
  cap:     ramp('#6a7898', '#46506c', '#2e3448', '#1c2030'),             // slate cap: reads apart from black hair (round 1)
  cowboy:  ramp('#e2b373', '#c9934f', '#97672f', '#6e4820', { band: '#5a2a1a' }),
  bandana: ramp('#e8604c', '#d2412f', '#a8301f', '#7e2016', { dot: '#ffffff' })
});

/* --------------------------------------------------------------- UI and effects */
const UI = Object.freeze({
  gold: '#F3CF6D', goldD: '#c9962e', goldL: '#fff6c8', starOff: '#5a4a36',
  tip: '#a8ff78', white: '#ffffff', bubbleEdge: '#dfe6ee', wire: '#3a2a20',
  umber2: '#3a2c1d', tray: '#4a3622', blue: '#3a6df0', blueD: '#2550c9', blueDD: '#1a3a96', blueL: '#a9c2ff', ink: '#13235c'
});

// Alpha entries: { rgb, a, css }. Shadows are the warm near black anchor over whatever is beneath
// (mock B multiplies by 0.72 to 0.80; a black at 1 - f darkens the same amount).
function alpha(rgb, a) { return Object.freeze({ rgb: rgb, a: a, css: rgba(rgb, a) }); }
const ALPHA = Object.freeze({
  shadowPerson: alpha(ANCHOR.K, 0.28),   // people, posts, kettle, drum (mock f 0.72)
  shadowProp:   alpha(ANCHOR.K, 0.25),   // cooler, pile, board station, woodpile, tree (f 0.75)
  shadowWide:   alpha(ANCHOR.K, 0.20),   // tables, benches, counter, beds, stones (f 0.78 to 0.80)
  smokeNear:    alpha('#f3f3f6', 0.70),  // puffs 1 to 3 above the vent
  smokeFar:     alpha('#f3f3f6', 0.50),  // puffs 4 and up
  smokeDark:    alpha('#6e6863', 0.70),  // a burning cook
  emberGlow:    alpha('#ff9a3c', 0.35),  // halo around a lit vent or an open lid
  spec:         alpha('#ffffff', 0.60),  // 1 px streak on lids, counters, glass
  dim:          alpha(ANCHOR.K, 0.55)    // modal backdrop over the yard
});

/* --------------------------------------------------------------- ramp helpers */
function rampOf(r) {
  if (typeof r === 'string') {
    if (!Object.prototype.hasOwnProperty.call(RAMP, r)) throw new Error('art3 palette: unknown ramp "' + r + '"');
    return RAMP[r];
  }
  return r;
}

// Outline color for a ramp (name or array): its own ol if it has one (smoke), else the shared OL.
function outline(r) {
  const x = rampOf(r);
  return (x && x.ol) || OL;
}

// Hue-shifted darken toward warm purple brown. t in 0..1, default one ramp step (0.22).
const SHADE_TO = '#2e1a2c';
function shade(hex, t) { return mix(hex, SHADE_TO, t === undefined ? 0.22 : t); }

// Rim tone for a ramp (name or array) or a hex: the ramp's pinned rim, else hi lifted toward warm cream.
const RIM_TO = '#fff4d6';
function rim(r, t) {
  const k = t === undefined ? 0.35 : t;
  if (typeof r === 'string' && r.charAt(0) === '#') return mix(r, RIM_TO, k);
  const x = rampOf(r);
  return x.rim || mix(x[0], RIM_TO, k);
}

// Every distinct opaque hex: world (props, ground, effects, UI, face, hats) and total (plus swap sets).
function all() {
  const seen = {};
  function take(v) {
    if (typeof v === 'string') { if (/^#[0-9a-fA-F]{6}$/.test(v)) seen[v.toLowerCase()] = true; return; }
    if (v && typeof v === 'object') Object.keys(v).forEach(function (k) { if (k !== 'css' && k !== 'rgb') take(v[k]); });
  }
  take(ANCHOR); take(OL); take(RAMP); take(MEAT); take(UI); take(FACE); take(HAT); take(SHOE);
  const world = Object.keys(seen).length;
  take(SKIN); take(HAIR); take(APRON); take(SHIRT); take(PANTS);
  return { world: world, total: Object.keys(seen).length, list: Object.keys(seen).sort() };
}

art3.PAL = Object.freeze({
  ANCHOR: ANCHOR,
  OL: OL,
  RAMP: Object.freeze(RAMP),
  MEAT: Object.freeze(MEAT),
  SKIN: SKIN,
  HAIR: HAIR,
  APRON: APRON,
  SHIRT: SHIRT,
  ROLE_SHIRT: ROLE_SHIRT,
  PANTS: PANTS,
  SHOE: SHOE,
  FACE: FACE,
  HAT: HAT,
  UI: UI,
  ALPHA: ALPHA,
  SHADE_TO: SHADE_TO,
  RIM_TO: RIM_TO,
  ramp: rampOf,
  outline: outline,
  shade: shade,
  rim: rim,
  mix: mix,
  rgba: rgba,
  hexToRgb: hexToRgb,
  rgbToHex: rgbToHex,
  all: all
});
})();
