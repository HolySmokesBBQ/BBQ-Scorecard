#!/usr/bin/env node
// games/pit-sim/dev/smoke.mjs
// Headless smoke test for the pit sim backyard prototype, v2.1 (guided tutorial, gentler burn with
// a warning, new charcoal art) on top of v2 (dense yard, seating, feedback). Never shipped, never linked.
//
// Run from the repo root:
//   node games/pit-sim/dev/smoke.mjs [--out <dir>] [--desktop] [--seed <n>] [--dir <folder>]
//
// What it does, in order (contract K11, the 45 step list: the 38 v2 steps with seven inserted):
//   1. Node checks with no browser: files present, node --check on the three scripts, sim.js loaded
//      under vm with the v2.1 surface and counts, validateSave rejects, clamps and migrates v1 and v2
//      to v3, a customer BFS on sim.custWalkable reaches every owned seat for all 64 decor sets, then
//      three headless sims: the whole tutorial by walkTo and ticks, skipTutorial in the morning and in
//      service, and the burn warning on a hot and a good fire.
//   2. Launches Chrome headless with a fresh profile, connects over CDP with the global WebSocket,
//      collects every console message, exception, log entry and network request, emulates a phone
//      (375 by 812, dpr 2, mobile, touch) unless --desktop is passed (1024 by 820, dpr 1), and opens
//      index.html?seed=<n>.
//   3. Checks the sprite list, palette and the v2.1 charcoal, piece, arrow and bubble grids, the
//      integer canvas scale on phone and desktop, then plays day 1 through the DOM ids and
//      PitSim.game.sim. Day 1 is the tutorial day: the v2 day 1 flow now RUNS THROUGH the tutorial
//      (it is not skipped first). Every tap of the v2 flow is the tap the tutorial asks for, so each
//      v2 step keeps its assertions and gains the tutorial's (target before the tap, step after it),
//      and step 28 asserts the whole walk in order. The one change to the v2 flow: only one sausage
//      goes on while the tutorial runs, the second goes on in step 29. Skip is tested on fresh games
//      in step 38, and the burn warning on that skipped day in step 39. Reloads into seeded saves for
//      the decor purchase, the v1 and v2 migrations, checks pause and Controls, that no draw record
//      leaves the canvas, that the dog never stands on a station use tile, layout and keyboard at 375
//      by 740, and reduced motion.
//   4. Writes <out>/report.json and the screenshots (clipboard, tutorial (step b), tutorial-cook
//      (step f), tutorial-customer (step i), mid-service, seated, till, decor, warning), prints one
//      summary line, exits 1 on any failed step, and always kills Chrome and removes the profile.
//
// Every DOM read comes right after PitSim.game.advance (contract D14), which updates the DOM and
// draws one frame, never after a guessed frame delay.
//
// Every selector, sim field path, tile, key and number the script depends on lives in the
// constants block below, so a contract change is one edit here.
//
// Deviations from contract D15 (kept from v2, step numbers are now K11's):
//   1. Step 15 checks the integer scale in both modes in one run: it checks the run's own mode,
//      switches the emulation to the other mode (phone 375 by 812 dpr 2, desktop 1024 by 820 dpr 1),
//      checks again, then restores the run's mode.
//   2. Step 42 "dog never on a station use tile": 60 s of service sampled tick by tick through
//      advance; PitSim.game.dog never stands on (or centers over) any use tile of any station, owned
//      or not. The dog is timed in real seconds (V2.9), so if it never moves under advance the step
//      also polls it in real time for up to 15 s and notes that.
//   3. Step 43 checks the 44 px buttons before the reload (service) and again after it (morning).
//   4. Seeded saves (steps 35, 36, 37) are written with Page.addScriptToEvaluateOnNewDocument before
//      the reload and the script is removed after, so the page cannot overwrite them on unload.
// Deviations from contract K11 (v2.1):
//   5. Browser clocks are compared within 0.1 s, not exactly (step 26 set down and gate open, step 38
//      gate_soon and gate_open). The page's own animation loop also ticks the sim between harness
//      calls and the probe stamps each event with the clock at drain time. The exact rules
//      (clock === GATE_OPENS on the plate tick, gate at 20 and 30) are asserted headless in steps 8
//      and 9, where every tick is the harness's own.
//   6. Step 8 reads "fire 60" after the light within 1 of C.FIRE_LIGHT: the light lands inside a tick
//      whose fire stage has already decayed it, so the first value a harness can read is just under 60.
//   7. The #live record starts when the probe is installed (after each page load), not at step 28:
//      a MutationObserver on #live plus a read after every advance the probe makes. Step 28 and 39 read
//      the same record the contract describes, only longer.
//   8. The page's live queue speaks one message a second in real time and holds 8. The harness steps
//      the sim far faster than real time, so steps 20 to 27 pause 1.2 s of real time after each
//      tutorial step change, and step 28 (and 39) poll real time for up to 12 s for a missing text.
//   9. Three screenshots beyond K11's two: tutorial.png is step b (charcoal), tutorial-cook.png is
//      step f (the cook banner once the box turns green) and tutorial-customer.png is step i (the
//      first customer walking in). warning.png is step 39 as K11 says.
//  10. Headless walks (steps 8 to 10) call walkTo and tick; if the arrival auto action did not do the
//      expected thing once the walk settled, they call interact() once and say so in the step note.
//  11. Step 39 feeds the fire once more right after piece_done when kettle 1 is under FIRE_GOOD + 15,
//      so a low band does not stretch the warning past the 0.6 * 14 + 2 s wait.

import fs from 'node:fs';
import os from 'node:os';
import net from 'node:net';
import path from 'node:path';
import vm from 'node:vm';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

// ---------------------------------------------------------------------------------------------
// CONSTANTS: the only place that knows the contract's names
// ---------------------------------------------------------------------------------------------

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const HERE = path.dirname(fileURLToPath(import.meta.url));
// --dir <folder> points the harness at another copy of the four files (stub runs); default is the game folder.
const DIR_ARG = (() => { const i = process.argv.indexOf('--dir'); return i >= 0 && process.argv[i + 1] ? path.resolve(process.argv[i + 1]) : null; })();
const GAME_DIR = DIR_ARG || path.resolve(HERE, '..');
const FILES = {
  index: path.join(GAME_DIR, 'index.html'),
  sprites: path.join(GAME_DIR, 'sprites.js'),
  sim: path.join(GAME_DIR, 'sim.js'),
  game: path.join(GAME_DIR, 'game.js')
};
const EXPECTED_REQUEST_FILES = ['index.html', 'sprites.js', 'sim.js', 'game.js'];

const DEFAULT_SEED = 1;
const SAVE_KEY = 'hs.pitsim.save';
const GLOBAL_NAME = 'PitSim';
const GAME_VERSION = '0.4.0';
const SIM_SURFACE = ['C', 'MEATS', 'MEAT_IDS', 'MAP', 'CATALOG', 'STRINGS', 'createSim', 'validateSave', 'fireBand', 'fireMult', 'tileOwned', 'SAVE_KEY'];
const SURFACE_COUNTS = { tiles: 132, stations: 8, seats: 6, decor: 6, props: 19, catalog: 21 };
const MAP_SIZE = { w: 11, h: 12 };
const TILE_PX = 16;
const VIRTUAL = { w: MAP_SIZE.w * TILE_PX, h: MAP_SIZE.h * TILE_PX };   // 176 by 192
const CSS_SCALE = { phone: 2, desktop: 3 };                              // contract D13
// Review round 2, contract D13: sizes where the old rule left the device scale fractional.
// controls: the action button and the meat chips must end inside the viewport.
const DEVICE_SIZES = [
  { width: 412, height: 915, deviceScaleFactor: 2.625, mobile: true },
  { width: 360, height: 800, deviceScaleFactor: 3, mobile: true },
  { width: 393, height: 873, deviceScaleFactor: 2.75, mobile: true },
  { width: 1366, height: 657, deviceScaleFactor: 1, mobile: false, controls: true },
  { width: 1280, height: 720, deviceScaleFactor: 1.5, mobile: false, controls: true }
];

// Contract D2 and D3.
const C_EXPECT = { WALK_TILES_PER_S: 6, SAVE_VERSION: 3, PATIENCE_MID_FRAC: 0.5, GEAR_RESERVE: 30, QUEUE_SPOTS: 3, QUEUE_SPOTS_BIG: 5, TABLE_SPOTS: 3, TABLE_SPOTS_BIG: 5 };
const C_NEW_KEYS = ['EAT_MIN', 'EAT_MAX', 'HEART_SECONDS', 'SEAT_BONUS_BASE', 'SEAT_BONUS_MAX', 'CHARM_STEP', 'CHARM_MAX', 'REP_TOGO_QUICK', 'SWEAT_FRAC', 'ZZZ_AFTER', 'FX', 'PATIENCE_MID_FRAC', 'GEAR_RESERVE'];
const FX_KEYS = ['NUMBER_S', 'NUMBER_RISE_PX', 'NUMBER_FADE_AT', 'TIP_GAP_PX', 'SPARKLE_S', 'SPARKLE_FRAME_S', 'SPARKLE_STAGGER_S',
  'HEART_S', 'HEART_FRAME_S', 'HEART_RISE_PX', 'HEART_FADE_S', 'EAT_FRAME_S', 'PUFF_EVERY_LOW', 'PUFF_EVERY_GOOD', 'PUFF_EVERY_HOT',
  'PUFF_LIFE_MIN', 'PUFF_LIFE_MAX', 'PUFF_RISE_PX_S', 'PUFF_DRIFT_PX_S', 'BURNT_BURST_S', 'BURNT_RISE_PX_S', 'SHAKE_MS',
  'BURNT_COLUMN_EVERY', 'BURNT_COLUMN_LIFE', 'BURNT_COLUMN_RISE_PX_S', 'BURNT_COLUMN_SWAY_PX', 'SWEAT_EVERY', 'SWEAT_SLIDE_S',
  'SWEAT_SLIDE_PX', 'SWEAT_SPLASH_S', 'ZZZ_FRAME_S', 'ZZZ_DRIFT_PX', 'SQUASH_S', 'WALKOUT_MARK_S', 'TAP_RING_S', 'FIRE_FPS',
  'TWINKLE_S', 'BIRD_SHOW_S', 'BIRD_GAP_MIN', 'BIRD_GAP_MAX', 'DOG_TILES_PER_S', 'DOG_WAIT_MIN', 'DOG_WAIT_SPREAD', 'NOTICE_S'];
const MEAT_COOK = { sausage: 14, chicken: 22, ribs: 32, butt: 40, brisket: 50 };   // unchanged in v2.1
// Contract K2 and [T 5].
const C_V21 = { WARN_FRAC: 0.4, HOT_BURN_MULT: 1, TUTORIAL_FIRE_FLOOR: 30, TUTORIAL_END_S: 6 };
const FX_V21 = { ARROW_BOB_S: 0.3, WARN_BLINK_S: 0.25 };
const MEAT_WINDOW = { sausage: 14, chicken: 16, ribs: 18, butt: 22, brisket: 26 };
// Contract K1 and K8.
const TUTORIAL_ORDER = ['open', 'charcoal', 'light', 'meat', 'puton', 'cook', 'slice', 'plate', 'customer', 'seated', 'end'];
const TUTORIAL_TEXT = {
  open: 'This is your morning. The cart is already filled. Tap Open the yard.',
  charcoal: 'Grab charcoal from the pile.',
  light: 'Tap the kettle to light it.',
  meat: 'Grab meat from the cooler.',
  puton: 'Put it on the kettle.',
  cook: 'Watch the box fill. Pull it when it turns green.',
  slice: 'Slice it at the board.',
  plate: 'Set the plate on the counter.',
  customer: 'Here comes your first customer.',
  seated: 'Served. They will sit and eat, then tip a little more.',
  end: 'You have the hang of it. Keep the fire fed and keep them happy.'
};
const PULL_NOW = 'Pull it now';
const BURN_WARN = {
  sausage: 'The sausage is about to burn.',
  chicken: 'The chicken is about to burn.',
  ribs: 'The ribs are about to burn.',
  butt: 'The pork butt is about to burn.',
  brisket: 'The brisket is about to burn.'
};
// [T 2.6] and K10: banner lines, arrow and bubble positions on this map.
const BANNER_CHARCOAL = ['GRAB CHARCOAL FROM THE PILE.'];
const ARROW_AT = {
  pile: { x: 68, y: 48, frames: [2, 3] }, kettle1: { x: 84, y: 48, frames: [2, 3] }, cooler: { x: 100, y: 32, frames: [2, 3] },
  board: { x: 84, y: 52, frames: [0, 1] }, table: { x: 108, y: 76, frames: [0, 1] }
};
const WARN_DRAW = {
  piece: { name: 'piece_sausage', frame: 4, x: 80, y: 25 },
  bubble: { name: 'bubble_warn', x: 78, y: 13 },   // round 1: draw.x - 2, left of the vent
  smoke: { name: 'smoke_dark', xMin: 80, xMax: 100, yMax: 24 }
};
const PULSE = 'tut-pulse';
const DAY1_HINT = 'Tap the charcoal pile';
const MEAT_IDS = ['sausage', 'chicken', 'ribs', 'butt', 'brisket'];
const GEAR_IDS = ['kettle2', 'cooler', 'bigtable', 'tray', 'canopy', 'drum'];
const DECOR_IDS = ['chair1', 'chair2', 'flowers', 'birdbath', 'lights', 'picnic2'];
const SEAT_IDS = ['pt1b', 'pt1a', 'chair1', 'chair2', 'pt2b', 'pt2a'];
const DOG_HOME = { x: 4, y: 7, px: 64, py: 112, frame: 2 };

// Contract K9, copied verbatim (replaces the D11 literal).
const REQUIRED_SPRITES = [   // [name, w, h, frames]
  ['player_down', 16, 24, 3], ['player_up', 16, 24, 3], ['player_side', 16, 24, 3], ['player_slice', 16, 24, 2],
  ['buddy_down', 16, 24, 3], ['buddy_up', 16, 24, 3], ['buddy_side', 16, 24, 3], ['tender_down', 16, 24, 3],
  ['tender_up', 16, 24, 3], ['tender_side', 16, 24, 3], ['cust0_down', 16, 24, 5], ['cust0_up', 16, 24, 3],
  ['cust0_side', 16, 24, 4], ['cust0_sit', 16, 24, 3], ['cust1_down', 16, 24, 5], ['cust1_up', 16, 24, 3],
  ['cust1_side', 16, 24, 4], ['cust1_sit', 16, 24, 3], ['cust2_down', 16, 24, 5], ['cust2_up', 16, 24, 3],
  ['cust2_side', 16, 24, 4], ['cust2_sit', 16, 24, 3], ['cust3_down', 16, 24, 5], ['cust3_up', 16, 24, 3],
  ['cust3_side', 16, 24, 4], ['cust3_sit', 16, 24, 3], ['shadow', 12, 4, 1], ['dog', 16, 16, 4],
  ['hand_charcoal', 8, 8, 1], ['hand_raw_sausage', 8, 8, 1], ['hand_raw_chicken', 8, 8, 1], ['hand_raw_ribs', 8, 8, 1],
  ['hand_raw_butt', 8, 8, 1], ['hand_raw_brisket', 8, 8, 1], ['hand_cooked_sausage', 8, 8, 1], ['hand_cooked_chicken', 8, 8, 1],
  ['hand_cooked_ribs', 8, 8, 1], ['hand_cooked_butt', 8, 8, 1], ['hand_cooked_brisket', 8, 8, 1], ['hand_burnt', 8, 8, 1],
  ['hand_plate_sausage', 8, 8, 1], ['hand_plate_chicken', 8, 8, 1], ['hand_plate_ribs', 8, 8, 1], ['hand_plate_butt', 8, 8, 1],
  ['hand_plate_brisket', 8, 8, 1], ['hand_tray_sausage', 8, 8, 1], ['hand_tray_chicken', 8, 8, 1], ['hand_tray_ribs', 8, 8, 1],
  ['hand_tray_butt', 8, 8, 1], ['hand_tray_brisket', 8, 8, 1], ['hand_tray', 8, 8, 1], ['hand_togo', 8, 8, 1],
  ['icon_sausage', 8, 8, 1], ['icon_chicken', 8, 8, 1], ['icon_ribs', 8, 8, 1], ['icon_butt', 8, 8, 1],
  ['icon_brisket', 8, 8, 1], ['plate_sausage', 8, 6, 1], ['plate_chicken', 8, 6, 1], ['plate_ribs', 8, 6, 1],
  ['plate_butt', 8, 6, 1], ['plate_brisket', 8, 6, 1], ['piece_sausage', 10, 10, 5], ['piece_chicken', 10, 10, 5],
  ['piece_ribs', 10, 10, 5], ['piece_butt', 10, 10, 5], ['piece_brisket', 10, 10, 5], ['mark_x', 8, 8, 1],
  ['kettle', 16, 24, 4], ['drum', 16, 32, 4], ['cooler', 16, 16, 3], ['board', 16, 16, 2],
  ['counter', 32, 24, 2], ['counter_ext', 16, 24, 1], ['pile', 16, 16, 4], ['trash', 16, 16, 1],
  ['paver', 16, 16, 2], ['lawn_a', 16, 16, 2], ['lawn_b', 16, 16, 2], ['fence_h', 16, 24, 1],
  ['fence_v', 16, 24, 1], ['fence_corner', 16, 24, 1], ['fence_back', 16, 16, 2], ['gate', 16, 24, 2], ['hedge', 16, 24, 2],
  ['bed', 16, 20, 4], ['shed', 48, 32, 1], ['sign', 44, 12, 1], ['tree', 32, 48, 1],
  ['woodpile', 16, 16, 1], ['hose', 16, 16, 1], ['tools', 16, 24, 1], ['pot', 16, 16, 1],
  ['planter', 16, 24, 1], ['shelf', 16, 24, 1], ['mailbox', 16, 24, 1], ['picnic', 32, 24, 1], ['picnic_bench', 32, 8, 1],
  ['chair', 16, 24, 1], ['lights_post', 16, 32, 1], ['lights_string', 66, 10, 2], ['birdbath', 16, 24, 2],
  ['canopy', 40, 32, 1], ['bubble', 16, 12, 1], ['heart', 8, 8, 2], ['sparkle', 7, 7, 3],
  ['smoke', 8, 8, 3], ['smoke_dark', 8, 8, 3], ['fire', 8, 8, 3], ['coin', 8, 8, 2],
  ['sweat', 4, 6, 2], ['zzz', 8, 8, 3], ['font', 4, 6, 40],
  ['arrow', 8, 12, 4], ['bubble_warn', 8, 10, 2]
];
const SPRITE_COUNT = 115;
const PALETTE_LEN = 32;
const COLOR_KEYS = 'K U C O outline woodD woodM woodL paver paverD lawnA lawnB leafD leafL cloth clothD white pink magenta yellow skinL skinM skinD red raw cooking done steelL steelD smokeL smokeD'.split(' ');

// DOM ids (contract 4.4 and D14). Functions build the per item ids.
const ID = {
  root: 'root', cv: 'cv', act: 'act', status: 'status', live: 'live', chips: 'chips',
  clipboard: 'clipboard', open: 'open', openWhy: 'open-why', cart: 'cart', clipNew: 'clip-new',
  seats: 'seats',
  till: 'till', tillH: 'till-h', tillBody: 'till-body', next: 'next',
  pause: 'pause', resume: 'resume', howto: 'howto', newgame: 'newgame', broke: 'broke',
  clipTop: 'clip-top', howtoBtn: 'howto-btn', tutClip: 'tut-clip', tutSkip: 'tut-skip',
  pauseControls: 'pause-controls', pauseSkip: 'pause-skip', pauseNew: 'pause-new', confirmYes: 'confirm-yes',
  hireBuddy: 'hire-buddy',
  qty: (id) => 'qty-' + id,
  inc: (id) => 'inc-' + id,
  dec: (id) => 'dec-' + id,
  chip: (id) => 'chip-' + id,
  buy: (id) => 'buy-' + id,
  // Game deviation 6 adds #howto-btn; the other names are fallbacks if a later build renames it.
  howtoButtons: ['howto-btn', 'help', 'how-to', 'btn-howto', 'controls']
};
const PHASE = { morning: 'morning', service: 'service', evening: 'evening' };
const TEXT = {
  needCharcoal: 'Buy at least one bag of charcoal.',
  gateOpensIn: 'Gate opens in',
  walk: 'Walk',
  notice: 'Your save was updated for the new yard.',
  controls: 'Controls',
  skipTutorial: 'Skip tutorial',
  handsEmpty: 'Hands empty',
  seatTipsRow: 'Seat tips',
  tillHeading: (day) => 'Day ' + day + ' till',
  cartLine: (total, after) => 'Total ' + total + '. Cash after ' + after + '.',
  seats: (n, charm, bonus) => 'Seats ' + n + '. Charm ' + charm + '. Each seated customer tips ' + bonus + ' more.'
};

// Sim field paths (contract 2.5.1 and D6), written as JS expressions over S() which returns sim.state.
const F = {
  phase: 'S().phase', day: 'S().day', cash: 'S().cash', rep: 'S().rep', paused: 'S().paused', clock: 'S().clock',
  carrying: 'S().player.carrying', busy: 'S().player.busy', walking: 'S().player.walking',
  nextTile: 'S().player.next', pathLen: 'S().player.path.length', target: 'S().player.target',
  playerX: 'S().player.x', playerY: 'S().player.y',
  cooker: (id) => 'S().stations.' + id,
  fire: (id) => 'S().stations.' + id + '.fire',
  pieces: (id) => 'S().stations.' + id + '.pieces',
  boardStacks: 'S().stations.board.stacks',
  tableSpots: 'S().stations.table.spots',
  customers: 'S().customers',
  seats: 'S().seats',
  decor: 'S().decor',
  today: 'S().today',
  till: 'S().till',
  stock: 'S().stock',
  charcoal: 'S().charcoal',
  gear: 'S().gear',
  hires: 'S().hires'
};
const COOKERS = ['kettle1', 'kettle2', 'drum'];
const PIECE_STATE = { cooking: 'cooking', done: 'done', burnt: 'burnt' };
const CARRY_KIND = { charcoal: 'charcoal', raw: 'raw', cooked: 'cooked', burnt: 'burnt', plates: 'plates' };
const CUSTOMER_PRESENT_MODES = ['arriving', 'waiting'];
const MODE = { eating: 'eating', toSeat: 'toSeat', leaving: 'leaving' };
const REASON = { seated: 'seated' };
const EVENT = {
  yardOpen: 'yard_open', gateOpen: 'gate_open', pieceDone: 'piece_done', sliceDone: 'slice_done',
  setDown: 'set_down', served: 'served', walkOut: 'walk_out', dayOver: 'day_over', saveWanted: 'save_wanted',
  seatTaken: 'seat_taken', toGo: 'to_go', seatDone: 'seat_done', purchase: 'purchase', customerArrived: 'customer_arrived',
  tutorialStep: 'tutorial_step', tutorialDone: 'tutorial_done', burnWarning: 'burn_warning', gateSoon: 'gate_soon',
  pieceBurnt: 'piece_burnt', fireLow: 'fire_low', fireOut: 'fire_out'
};
const FX_KIND = { cash: 'cash', seatTip: 'seatTip', heart: 'heart', ring: 'ring', squash: 'squash', warn: 'warn' };
const OUTLINE = '#outline';
const C_NAMES = {
  gateOpens: 'GATE_OPENS', daySeconds: 'DAY_SECONDS', fireLight: 'FIRE_LIGHT', fireGood: 'FIRE_GOOD', fireLowWarn: 'FIRE_LOW_WARN',
  tick: 'TICK_SECONDS', repQuick: 'REP_QUICK', repOk: 'REP_OK', repTogoQuick: 'REP_TOGO_QUICK', repDayMin: 'REP_DAY_MIN',
  startCash: 'START_CASH', startRep: 'START_REP', dailyCosts: 'DAILY_COSTS', eatMax: 'EAT_MAX', heartSeconds: 'HEART_SECONDS',
  fireMax: 'FIRE_MAX', coldUnder: 'COLD_UNDER', fireFloor: 'TUTORIAL_FIRE_FLOOR', tutorialEnd: 'TUTORIAL_END_S',
  warnFrac: 'WARN_FRAC', hotMult: 'HOT_MULT'
};
const SIM_METHODS = { walkTo: 'walkTo', interact: 'interact', drainEvents: 'drainEvents', serialize: 'serialize', skipTutorial: 'skipTutorial', tutorialStep: 'tutorialStep' };
const GAME_FIELDS = { version: 'version', advance: 'advance', reduced: 'reduced', sim: 'sim', dog: 'dog', fxLog: 'fxLog', captureFrame: 'captureFrame', banner: 'banner' };
const ART_FIELDS = { built: 'built' };

// Tiles the player taps (contract D15; tapping a station walks to its use tile).
const TILE = {
  pile: { x: 4, y: 2 },
  kettle1: { x: 5, y: 2 },
  cooler: { x: 6, y: 1 },
  board: { x: 5, y: 4 },
  table: { x: 6, y: 6 }
};
const SPAWN = { x: 6, y: 3 };
const ARROW_LEFT_X = 5;

// What the morning yard must draw (step 13), the first seat (step 23) and the chair (step 30).
const MORNING_DRAWS = [
  { name: 'picnic', x: 80, y: 136 },
  { name: 'picnic_bench', x: 80, y: 136 },
  { name: 'dog', x: DOG_HOME.px, y: DOG_HOME.py, frame: DOG_HOME.frame }
];
// Unowned gear and decor also draw a see-through ghost (records marked ghost: true).
const MORNING_GHOSTS = [
  { name: 'kettle', x: 112, y: 24 },
  { name: 'chair', x: 112, y: 136 }
];
const MORNING_OUTLINES = [
  { what: 'kettle2', x: 112, y: 32, w: 16, h: 16 },
  { what: 'chair1', x: 112, y: 144, w: 16, h: 16 }
];
const CASH_ABOVE = 26;   // review round 2: the cash number sits over the served customer, at py - 26
const FIRST_SEAT = { id: 'pt1b', x: 6, y: 8, px: 96, py: 128, bonus: 1, heart: { x: 96, y: 104 } };
const DECOR_BUY = { id: 'chair1', draw: { name: 'chair', x: 112, y: 136 }, outlineGone: { x: 112, y: 144 }, seatsAfter: [3, 3, 1] };
const DECOR_SAVE = { day: 2, cash: 200 };

// Step 33: records that may extend past a canvas edge (people at the gate or the spawn only;
// the back fence row is drawn inside the canvas).
const EDGE_OK = {
  bottom: /^(player_|buddy_|tender_|cust\d_|shadow$|hand_)/
};

// Section 2.8 v1 sample and section 5.1 item 3 dirty sample.
const SAVE_V1_SAMPLE = {
  v: 1, day: 5, cash: 187, rep: 80,
  stock: { sausage: 0, chicken: 2, ribs: 0, butt: 1, brisket: 0 },
  charcoal: 3,
  gear: { kettle2: true, cooler: false, bigtable: false, tray: false, canopy: false, drum: false },
  hires: { buddy: false, tender: false },
  stats: { days: 4, served: 45, walkouts: 1, past: 3, burnt: 0 },
  drivewayShown: false
};
const SAVE_DIRTY = { v: 1, day: 'abc', cash: -50, rep: 400, stock: { sausage: 200, bogus: 1 }, gear: { drum: true, kettle2: false }, hires: { tender: true }, extra: 1 };
const INVALID_SAVES = [null, 'x', [], {}, undefined, 42, { v: 4 }, { v: 0 }, { v: '3' }];

// The shopping list for day 1 and later days. Two sausage units give four plates, so later
// customers walk out and the walk out step has something to assert.
const BUY_DAY1 = { charcoal: 4, meat: 'sausage', units: 2 };
const BUY_LATER = { charcoal: 1, meat: 'sausage', units: 1 };
const MEAT = 'sausage';
const PLATE_CYCLES_MAX = 2;      // pieces to pull, slice and carry during the day

const KEYS = {
  escape: { key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 },
  p: { key: 'p', code: 'KeyP', windowsVirtualKeyCode: 80 },
  left: { key: 'ArrowLeft', code: 'ArrowLeft', windowsVirtualKeyCode: 37 }
};
const PHONE = { width: 375, height: 812, deviceScaleFactor: 2, mobile: true };
const DESKTOP = { width: 1024, height: 820, deviceScaleFactor: 1, mobile: false };
const LAYOUT_VIEW = { width: 375, height: 740, deviceScaleFactor: 2, mobile: true };
const MIN_CONTROL_PX = 44;
const TIMEOUT_MS = { launch: 20000, load: 20000, cdp: 90000, resize: 400 };
// Simulated seconds the harness will advance while waiting for a condition.
const WAIT_S = {
  walk: 10, settle: 0.15, fire: 45, cook: 70, slice: 15, serve: 75, serveRetry: 25, day: 170, afterOpen: 0.2,
  toEating: 15, eatSlack: 3, toLeaving: 3, service: 45, dogSample: 60, arrow: 0.5,
  headlessStep: 5, headlessDone: 20, headlessServe: 15, headlessSeat: 20, holdTicks: 1200, idleTicks: 800,
  burnPage: 0.6 * 14 + 2, liveAfterWarn: 6, liveStep: 0.5
};
const LIVE_BREATH_MS = 1200;   // deviation 8: real time for the one a second live queue after a step change
const LIVE_POLL_MS = 12000;
const DOG_REALTIME_MS = 15000;
const SCREENSHOTS = {
  clipboard: 'clipboard.png', tutorial: 'tutorial.png', tutorialCook: 'tutorial-cook.png', tutorialCustomer: 'tutorial-customer.png',
  midService: 'mid-service.png', seated: 'seated.png', decor: 'decor.png', till: 'till.png', warning: 'warning.png'
};

// ---------------------------------------------------------------------------------------------
// Arguments and report
// ---------------------------------------------------------------------------------------------

const argv = process.argv.slice(2);
function argValue(flag, fallback) {
  const i = argv.indexOf(flag);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : fallback;
}
const DESKTOP_MODE = argv.includes('--desktop');
const SEED = Number.parseInt(argValue('--seed', String(DEFAULT_SEED)), 10) || DEFAULT_SEED;
const OUT_DIR = path.resolve(argValue('--out', path.join(os.tmpdir(), 'pit-sim-smoke')));
fs.mkdirSync(OUT_DIR, { recursive: true });
const RUN_METRICS = DESKTOP_MODE ? DESKTOP : PHONE;

const report = {
  startedAt: new Date().toISOString(),
  mode: DESKTOP_MODE ? 'desktop' : 'phone',
  seed: SEED,
  outDir: OUT_DIR,
  steps: [],
  console: [],
  exceptions: [],
  logEntries: [],
  requests: [],
  metrics: {},
  screenshots: [],
  summary: ''
};
let failed = 0;
let fatal = false;

function record(name, ok, note) {
  report.steps.push({ n: report.steps.length + 1, name, ok, note: note || '' });
  if (!ok) failed += 1;
  console.log((ok ? 'ok   ' : 'FAIL ') + String(report.steps.length).padStart(2) + ' ' + name + (note ? '  (' + note + ')' : ''));
}
function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}
async function step(name, fn, opts = {}) {
  if (fatal) { record(name, false, 'skipped after a fatal failure'); return; }
  try {
    const note = await fn();
    record(name, true, typeof note === 'string' ? note : '');
  } catch (e) {
    record(name, false, (e && e.message) || String(e));
    if (opts.fatal) fatal = true;
  }
}
function describe(v) {
  try { return JSON.stringify(v); } catch (_e) { return String(v); }
}
function sameJSON(a, b) { return describe(a) === describe(b); }
// Key order free deep equality (validateSave and serialize may build keys in different orders).
function canon(v) {
  if (Array.isArray(v)) return v.map(canon);
  if (v && typeof v === 'object') { const o = {}; for (const k of Object.keys(v).sort()) o[k] = canon(v[k]); return o; }
  return v;
}
function deepEq(a, b) { return JSON.stringify(canon(a)) === JSON.stringify(canon(b)); }
// Collapse consecutive repeats: [a, a, b] gives [a, b].
function distinctRuns(list) { return list.filter((x, i) => i === 0 || x !== list[i - 1]); }
const nearly = (a, b, tol) => typeof a === 'number' && Math.abs(a - b) <= tol;

// A complete v2 save with defaults, for the Node BFS step and the seeded decor and v2 saves.
function saveV2(over = {}, startRep = 20) {
  const s = {
    v: 2, day: 1, cash: 80, rep: startRep,
    stock: Object.fromEntries(MEAT_IDS.map((m) => [m, 0])),
    charcoal: 0,
    gear: Object.fromEntries(GEAR_IDS.map((g) => [g, false])),
    decor: Object.fromEntries(DECOR_IDS.map((d) => [d, false])),
    hires: { buddy: false, tender: false },
    stats: { days: 0, served: 0, walkouts: 0, past: 0, burnt: 0, seated: 0 },
    drivewayShown: false
  };
  for (const [k, v] of Object.entries(over)) {
    if (v && typeof v === 'object' && !Array.isArray(v) && s[k] && typeof s[k] === 'object') Object.assign(s[k], v);
    else s[k] = v;
  }
  return s;
}

// ---------------------------------------------------------------------------------------------
// 1. Node checks (no browser): steps 1 to 7
// ---------------------------------------------------------------------------------------------

async function nodeChecks() {
  await step('files present', () => {
    const missing = Object.entries(FILES).filter(([, p]) => !fs.existsSync(p)).map(([k]) => k);
    assert(missing.length === 0, 'missing ' + missing.join(', '));
    return 'index, sprites, sim, game';
  }, { fatal: true });

  for (const key of ['sprites', 'sim', 'game']) {
    await step('node --check ' + key + '.js', () => {
      const r = spawnSync(process.execPath, ['--check', FILES[key]], { encoding: 'utf8' });
      assert(r.status === 0, (r.stderr || r.stdout || '').trim().split('\n')[0] || 'exit ' + r.status);
    });
  }

  await step('sim.js loads headless with the full surface', () => {
    const src = fs.readFileSync(FILES.sim, 'utf8');
    vm.runInThisContext(src, { filename: FILES.sim });
    const P = globalThis[GLOBAL_NAME];
    assert(P && typeof P === 'object', 'globalThis.' + GLOBAL_NAME + ' missing');
    const missing = SIM_SURFACE.filter((n) => !(n in P));
    assert(missing.length === 0, 'missing ' + missing.join(', '));
    assert(P.SAVE_KEY === SAVE_KEY, 'SAVE_KEY is ' + describe(P.SAVE_KEY));
    const M = P.MAP;
    assert(M.W === MAP_SIZE.w && M.H === MAP_SIZE.h, 'MAP.W, MAP.H are ' + M.W + ', ' + M.H);
    assert(M.tiles.length === SURFACE_COUNTS.tiles, 'MAP.tiles.length ' + M.tiles.length);
    assert(M.stations.length === SURFACE_COUNTS.stations, 'MAP.stations.length ' + M.stations.length);
    assert(Array.isArray(M.seats) && M.seats.length === SURFACE_COUNTS.seats, 'MAP.seats.length ' + (M.seats && M.seats.length));
    assert(Array.isArray(M.decor) && M.decor.length === SURFACE_COUNTS.decor, 'MAP.decor.length ' + (M.decor && M.decor.length));
    assert(Array.isArray(M.props) && M.props.length === SURFACE_COUNTS.props, 'MAP.props.length ' + (M.props && M.props.length));
    assert(P.CATALOG.length === SURFACE_COUNTS.catalog, 'CATALOG.length ' + P.CATALOG.length);
    assert(sameJSON(M.seats.map((s) => s.id), SEAT_IDS), 'seat order ' + describe(M.seats.map((s) => s.id)));
    assert(sameJSON(M.decor.map((d) => d.id), DECOR_IDS), 'decor order ' + describe(M.decor.map((d) => d.id)));
    for (const [k, v] of Object.entries(C_EXPECT)) assert(P.C[k] === v, 'C.' + k + ' is ' + describe(P.C[k]) + ', wanted ' + v);
    const missingC = C_NEW_KEYS.filter((k) => !(k in P.C));
    assert(missingC.length === 0, 'C missing ' + missingC.join(', '));
    assert(P.C.FX && Object.isFrozen(P.C.FX), 'C.FX is not a frozen object');
    const missingFx = FX_KEYS.filter((k) => typeof P.C.FX[k] !== 'number');
    assert(missingFx.length === 0, 'C.FX missing ' + missingFx.join(', '));
    for (const [m, s] of Object.entries(MEAT_COOK)) assert(P.MEATS[m].cook === s, 'MEATS.' + m + '.cook is ' + P.MEATS[m].cook);
    assert(M.dogHome && M.dogHome.x === DOG_HOME.x && M.dogHome.y === DOG_HOME.y, 'MAP.dogHome is ' + describe(M.dogHome));
    // v2.1 (K11 step 5): constants, windows, strings, the two new methods.
    for (const [k, v] of Object.entries(C_V21)) assert(P.C[k] === v, 'C.' + k + ' is ' + describe(P.C[k]) + ', wanted ' + v);
    for (const [k, v] of Object.entries(FX_V21)) assert(P.C.FX[k] === v, 'C.FX.' + k + ' is ' + describe(P.C.FX[k]) + ', wanted ' + v);
    assert(sameJSON(P.MEAT_IDS, MEAT_IDS), 'MEAT_IDS ' + describe(P.MEAT_IDS));
    const windows = P.MEAT_IDS.map((m) => P.MEATS[m].window);
    assert(sameJSON(windows, MEAT_IDS.map((m) => MEAT_WINDOW[m])), 'windows ' + describe(windows) + ', wanted ' + describe(MEAT_IDS.map((m) => MEAT_WINDOW[m])));
    const S = P.STRINGS;
    assert(S.tutorial && typeof S.tutorial === 'object', 'STRINGS.tutorial missing');
    assert(sameJSON(Object.keys(S.tutorial).sort(), Object.keys(TUTORIAL_TEXT).sort()), 'STRINGS.tutorial ids ' + describe(Object.keys(S.tutorial)));
    for (const [id, t] of Object.entries(TUTORIAL_TEXT)) assert(S.tutorial[id] === t, 'STRINGS.tutorial.' + id + ' is ' + describe(S.tutorial[id]));
    assert(sameJSON(S.tutorialOrder, TUTORIAL_ORDER), 'STRINGS.tutorialOrder ' + describe(S.tutorialOrder));
    assert(S.pullNow === PULL_NOW, 'STRINGS.pullNow ' + describe(S.pullNow));
    assert(S.burnWarn && sameJSON(Object.keys(S.burnWarn).sort(), Object.keys(BURN_WARN).sort()), 'STRINGS.burnWarn keys ' + describe(S.burnWarn && Object.keys(S.burnWarn)));
    for (const [m, t] of Object.entries(BURN_WARN)) assert(S.burnWarn[m] === t, 'STRINGS.burnWarn.' + m + ' is ' + describe(S.burnWarn[m]));
    const fresh = P.createSim(null, 1);
    assert(typeof fresh[SIM_METHODS.skipTutorial] === 'function', 'sim.skipTutorial is not a function');
    assert(typeof fresh[SIM_METHODS.tutorialStep] === 'function', 'sim.tutorialStep is not a function');
    return SIM_SURFACE.length + ' names, ' + C_NEW_KEYS.length + ' new C keys, ' + FX_KEYS.length + ' FX keys, v2.1 windows ' + windows.join(' ');
  });

  await step('validateSave rejects, clamps and migrates', () => {
    const P = globalThis[GLOBAL_NAME];
    assert(P && typeof P.validateSave === 'function', 'validateSave missing');
    for (const bad of INVALID_SAVES) {
      let r;
      try { r = P.validateSave(bad); } catch (e) { throw new Error('threw on ' + describe(bad) + ': ' + e.message); }
      assert(r === null, 'expected null for ' + describe(bad) + ', got ' + describe(r));
    }
    const allFalse = (o) => o && DECOR_IDS.every((d) => o[d] === false) && Object.keys(o).length === DECOR_IDS.length;
    const v = P.validateSave(JSON.parse(JSON.stringify(SAVE_DIRTY)));
    assert(v && v.v === 3, 'dirty v1 sample returned v ' + describe(v && v.v));
    assert(v.day === 1, 'day ' + describe(v.day));
    assert(v.cash === 0, 'cash ' + v.cash);
    assert(v.rep === 100, 'rep ' + v.rep);
    assert(v.stock.sausage === 99, 'stock.sausage ' + v.stock.sausage);
    assert(!('bogus' in v.stock), 'bogus kept');
    assert(v.gear.drum === false, 'gear.drum not forced false');
    assert(v.hires.tender === false, 'hires.tender not forced false');
    assert(!('extra' in v), 'extra kept');
    assert(allFalse(v.decor), 'dirty sample decor ' + describe(v.decor));
    assert(v.stats && v.stats.seated === 0, 'dirty sample stats.seated ' + describe(v.stats && v.stats.seated));
    const s = P.validateSave(JSON.parse(JSON.stringify(SAVE_V1_SAMPLE)));
    assert(s && s.v === 3, 'v1 sample returned v ' + describe(s && s.v));
    assert(s.tutorial && s.tutorial.done === true, 'v1 sample tutorial ' + describe(s.tutorial));
    for (const k of ['day', 'cash', 'rep', 'stock', 'charcoal', 'gear', 'hires', 'drivewayShown']) {
      assert(sameJSON(s[k], SAVE_V1_SAMPLE[k]), 'v1 sample ' + k + ' is ' + describe(s[k]) + ', wanted ' + describe(SAVE_V1_SAMPLE[k]));
    }
    for (const [k, n] of Object.entries(SAVE_V1_SAMPLE.stats)) assert(s.stats[k] === n, 'v1 sample stats.' + k + ' is ' + s.stats[k]);
    assert(s.stats.seated === 0, 'v1 sample stats.seated ' + s.stats.seated);
    assert(allFalse(s.decor), 'v1 sample decor ' + describe(s.decor));
    const d = P.validateSave({ v: 2, decor: { chair2: true, bogus: true } });
    assert(d && d.v === 3, 'v2 decor sample returned ' + describe(d));
    assert(d.decor.chair2 === false, 'decor.chair2 not forced false without chair1');
    assert(!('bogus' in d.decor), 'decor.bogus kept');
    const cyclic = { v: 1 }; cyclic.self = cyclic; cyclic.decor = cyclic;
    let threw = null;
    try { P.validateSave(cyclic); } catch (e) { threw = e; }
    assert(!threw, 'cyclic threw: ' + (threw && threw.message));
    // v2.1 (K6, K11 step 6).
    const v2 = P.validateSave(saveV2({}, P.C.START_REP));
    assert(v2 && v2.v === 3 && v2.tutorial && v2.tutorial.done === true, 'v2 day 1 sample returned ' + describe(v2 && { v: v2.v, tutorial: v2.tutorial }));
    const t1 = P.validateSave({ v: 3, day: 1, tutorial: { done: false, bogus: 1 } });
    assert(t1 && t1.v === 3 && t1.tutorial && t1.tutorial.done === false, 'v3 day 1 done false returned ' + describe(t1 && t1.tutorial));
    assert(!('bogus' in t1.tutorial), 'tutorial.bogus kept');
    const t3 = P.validateSave({ v: 3, day: 3, tutorial: { done: false, bogus: 1 } });
    assert(t3 && t3.tutorial && t3.tutorial.done === true, 'v3 day 3 done false returned ' + describe(t3 && t3.tutorial));
    const t0 = P.validateSave({ v: 3 });
    assert(t0 && t0.v === 3 && t0.tutorial && t0.tutorial.done === true, '{ v: 3 } returned ' + describe(t0 && t0.tutorial));
    const ser = P.createSim(null, 1)[SIM_METHODS.serialize]();
    assert(ser && ser.v === 3, 'serialize() v ' + describe(ser && ser.v));
    assert(ser.tutorial && ser.tutorial.done === false, 'serialize() tutorial ' + describe(ser.tutorial));
    const back = P.validateSave(JSON.parse(JSON.stringify(ser)));
    assert(deepEq(back, ser), 'serialize() does not round trip: ' + describe(ser) + ' became ' + describe(back));
    return INVALID_SAVES.length + ' rejected, v1 and v2 to v3 migrated with the tutorial done, v3 tutorial rules, chair2 forced, cyclic safe, serialize round trips';
  });

  await step('seat reachability', () => {
    const P = globalThis[GLOBAL_NAME];
    const M = P.MAP;
    const startRep = P.C.START_REP;
    const bfs = (sim, from, goal) => {
      const key = (x, y) => x + ',' + y;
      const seen = new Set([key(from.x, from.y)]);
      const q = [from];
      const dirs = [[0, -1], [0, 1], [-1, 0], [1, 0]];   // up, down, left, right
      while (q.length) {
        const c = q.shift();
        if (c.x === goal.x && c.y === goal.y) return true;
        for (const [dx, dy] of dirs) {
          const nx = c.x + dx, ny = c.y + dy;
          if (nx < 0 || nx >= M.W || ny < 0 || ny > M.H) continue;   // row H is the off canvas spawn row
          const k = key(nx, ny);
          if (seen.has(k)) continue;
          if (!sim.custWalkable(nx, ny, goal.x, goal.y)) continue;
          seen.add(k);
          q.push({ x: nx, y: ny });
        }
      }
      return false;
    };
    let checks = 0;
    const fails = [];
    for (let mask = 0; mask < 64; mask++) {
      for (const big of [false, true]) {
        const decor = Object.fromEntries(DECOR_IDS.map((id, i) => [id, (mask & (1 << i)) !== 0]));
        const saved = P.validateSave(saveV2({ day: 3, decor, gear: { bigtable: big } }, startRep));
        assert(saved, 'validateSave refused the mask ' + mask + ' save');
        const sim = P.createSim(saved, 1);
        assert(typeof sim.custWalkable === 'function', 'sim.custWalkable missing');
        const st = sim.state;
        const queue = M.queue.filter((qs) => P.tileOwned(qs, st.gear, st.decor));
        const seats = M.seats.filter((s) => P.tileOwned(s, st.gear, st.decor));
        for (const seat of seats) {
          for (const qs of queue) {
            checks += 1;
            if (!bfs(sim, qs, seat)) fails.push('mask ' + mask + (big ? ' big' : '') + ': queue (' + qs.x + ',' + qs.y + ') to ' + seat.id);
          }
          checks += 1;
          if (!bfs(sim, seat, M.custSpawn)) fails.push('mask ' + mask + (big ? ' big' : '') + ': ' + seat.id + ' to spawn');
        }
      }
    }
    assert(fails.length === 0, fails.length + ' unreachable, first ' + fails.slice(0, 3).join('; '));
    return checks + ' routes over 128 yards';
  });

  await step('tutorial rules, headless', () => tutorialHeadless(globalThis[GLOBAL_NAME]));
  await step('skipTutorial, headless', () => skipHeadless(globalThis[GLOBAL_NAME]));
  await step('burn warning at hot fire, headless', () => burnHeadless(globalThis[GLOBAL_NAME]));
}

// ---------------------------------------------------------------------------------------------
// Headless sims (steps 8 to 10). The harness owns every tick here; events are stamped with the
// clock, the tick count and a drain batch number right after each drain.
// ---------------------------------------------------------------------------------------------

function headless(P, saved, seed) {
  const sim = P.createSim(saved, seed);
  const h = { sim, P, C: P.C, log: [], batch: 0, ticks: 0, fixture: null, notes: [] };
  h.st = () => sim.state;
  h.drain = () => {
    const out = sim[SIM_METHODS.drainEvents]();
    h.batch += 1;
    for (const e of out) h.log.push(Object.assign({}, e, { _at: sim.state.clock, _b: h.batch, _t: h.ticks }));
    return out;
  };
  h.drain();   // creation events (the morning, then tutorial_step open)
  h.tick = () => {
    if (h.fixture) h.fixture(sim.state);
    sim.tick();
    h.ticks += 1;
    h.drain();
  };
  h.ticksFor = (sec) => Math.ceil(sec / P.C.TICK_SECONDS - 1e-9);
  h.until = (pred, maxSec) => {
    const n = h.ticksFor(maxSec);
    for (let i = 0; i < n; i++) { if (pred()) return true; h.tick(); }
    return !!pred();
  };
  h.settled = () => { const pl = sim.state.player; return !pl.walking && pl.next === null && pl.path.length === 0; };
  // Walk to a station by walkTo and ticks; interact() once if the arrival did not do it (deviation 10).
  h.go = (name, pred, maxSec = WAIT_S.headlessStep) => {
    const t = TILE[name];
    sim[SIM_METHODS.walkTo](t.x, t.y);
    h.drain();
    if (h.until(pred, maxSec)) return true;
    if (h.settled()) {
      sim[SIM_METHODS.interact]();
      h.drain();
      h.notes.push(name + ' via interact');
      if (h.until(pred, 1)) return true;
    }
    return false;
  };
  h.goSettled = (name, pred, maxSec = WAIT_S.headlessStep) => {
    // Like go, but waits for the walk to settle first so an arrival effect has its tick.
    const t = TILE[name];
    sim[SIM_METHODS.walkTo](t.x, t.y);
    h.drain();
    h.until(() => pred() || h.settled(), maxSec);
    if (pred()) return true;
    h.until(pred, WAIT_S.settle);
    if (pred()) return true;
    if (h.settled()) {
      sim[SIM_METHODS.interact]();
      h.drain();
      h.notes.push(name + ' via interact');
      return h.until(pred, 1);
    }
    return false;
  };
  h.step = () => { const t = sim[SIM_METHODS.tutorialStep](); return t ? { id: t.id, text: t.text, target: t.target } : null; };
  h.stepIs = (id, target) => { const t = h.step(); return !!t && t.id === id && (target === undefined || t.target === target); };
  h.idx = (type, from = 0, pred = () => true) => { for (let i = from; i < h.log.length; i++) if (h.log[i].type === type && pred(h.log[i])) return i; return -1; };
  h.of = (type, from = 0) => h.log.slice(from).filter((e) => e.type === type);
  h.has = (type, from = 0) => h.idx(type, from) >= 0;
  return h;
}
const strip = (e) => { const o = {}; for (const k of Object.keys(e)) if (k[0] !== '_') o[k] = e[k]; return o; };
const carryIs = (h, kind, meat) => { const c = h.st().player.carrying; return !!c && c.kind === kind && (meat === undefined || c.meat === meat); };

function tutorialHeadless(P) {
  const C = P.C;
  const h = headless(P, null, 1);
  const st = h.st;
  const k1 = () => st().stations.kettle1;
  const s0 = h.step();
  assert(s0 && s0.id === 'open' && s0.target === 'open', 'new game tutorialStep() ' + describe(s0));
  const o = h.sim.openGate();
  h.drain();
  assert(o && o.ok, 'openGate with the default cart: ' + describe(o));
  for (let i = 0; i < WAIT_S.idleTicks; i++) h.tick();
  assert(st().clock === 0, 'clock ' + st().clock + ' after ' + WAIT_S.idleTicks + ' idle ticks, wanted 0');
  assert(h.stepIs('charcoal'), 'step after the idle ticks ' + describe(h.step()));
  for (const t of [EVENT.gateSoon, EVENT.gateOpen, EVENT.customerArrived]) assert(!h.has(t), t + ' fired with the clock held');
  assert(k1().fire === 0, 'kettle1.fire ' + k1().fire + ' with no input');

  assert(h.goSettled('pile', () => h.stepIs('light')), 'pile did not give step light: ' + describe(h.step()) + ', carrying ' + describe(st().player.carrying));
  assert(h.goSettled('kettle1', () => h.stepIs('meat')), 'kettle 1 did not give step meat: ' + describe(h.step()) + ', fire ' + k1().fire);
  assert(nearly(k1().fire, C.FIRE_LIGHT, 1), 'fire after the light ' + k1().fire + ', wanted ' + C.FIRE_LIGHT + ' (deviation 6)');
  assert(h.goSettled('cooler', () => h.stepIs('puton')), 'cooler did not give step puton: ' + describe(h.step()));
  assert(h.goSettled('kettle1', () => h.stepIs('cook', null)), 'kettle 1 did not give step cook with target null: ' + describe(h.step()));
  const putIdx = h.log.length;
  assert(h.until(() => h.has(EVENT.pieceDone, putIdx), WAIT_S.headlessDone), 'no piece_done within ' + WAIT_S.headlessDone + ' s; pieces ' + describe(k1().pieces));
  const doneIdx = h.idx(EVENT.pieceDone, putIdx);
  h.until(() => h.has(EVENT.tutorialStep, doneIdx), 1);
  const nextStep = h.log[h.idx(EVENT.tutorialStep, doneIdx)];
  assert(nextStep && nextStep.id === 'cook' && nextStep.target === 'kettle1', 'the tutorial_step after piece_done is ' + describe(nextStep && strip(nextStep)));
  const piece = k1().pieces[0];
  const prog0 = piece.prog;
  const holdIdx = h.log.length;
  for (let i = 0; i < WAIT_S.holdTicks; i++) h.tick();
  const p1 = k1().pieces[0];
  assert(p1 && p1.state === PIECE_STATE.done, 'held piece is ' + describe(p1));
  assert(p1.prog === prog0, 'held piece prog moved from ' + prog0 + ' to ' + p1.prog);
  assert(p1.warn === false, 'held piece warn ' + describe(p1.warn));
  for (const t of [EVENT.burnWarning, EVENT.pieceBurnt, EVENT.fireLow, EVENT.fireOut]) assert(!h.has(t, holdIdx), t + ' fired during the hold');
  assert(k1().fire === C.TUTORIAL_FIRE_FLOOR, 'kettle1.fire ' + k1().fire + ' after the hold, wanted the floor ' + C.TUTORIAL_FIRE_FLOOR);

  assert(h.goSettled('kettle1', () => h.stepIs('slice') && carryIs(h, CARRY_KIND.cooked, MEAT)), 'the pull did not give step slice with cooked sausage: ' + describe(h.step()) + ', carrying ' + describe(st().player.carrying));
  const sliceIdx = h.log.length;
  assert(h.go('board', () => h.has(EVENT.sliceDone, sliceIdx) && h.stepIs('plate'), 10), 'board: no slice_done and step plate; step ' + describe(h.step()));
  assert(h.stepIs('plate', 'table'), 'after slice_done the step is ' + describe(h.step()) + ', wanted plate with target table');

  const tableIdx = h.log.length;
  assert(h.go('table', () => h.has(EVENT.setDown, tableIdx)), 'table: no set_down; carrying ' + describe(st().player.carrying));
  const setDown = h.log[h.idx(EVENT.setDown, tableIdx)];
  const batch = h.log.filter((e) => e._b === setDown._b);
  const order = [EVENT.setDown, EVENT.tutorialStep, EVENT.gateOpen, EVENT.customerArrived];
  const at = order.map((t) => batch.findIndex((e) => e.type === t && (t !== EVENT.tutorialStep || e.id === 'customer')));
  assert(at.every((i) => i >= 0) && at.every((i, j) => j === 0 || i > at[j - 1]), 'the set down drain is ' + describe(batch.map((e) => e.type + (e.id !== undefined ? ':' + e.id : ''))) + ', wanted ' + order.join(', ') + ' in order');
  const arrived = batch[at[3]];
  assert(arrived.id === 1 && arrived.meat === MEAT, 'scripted customer_arrived ' + describe(strip(arrived)));
  assert(st().clock === C.GATE_OPENS, 'clock after the plate ' + st().clock + ', wanted ' + C.GATE_OPENS);

  const servedIdx0 = h.log.length;
  assert(h.until(() => h.has(EVENT.served, servedIdx0), WAIT_S.headlessServe), 'no served within ' + WAIT_S.headlessServe + ' s');
  const servedIdx = h.idx(EVENT.served, servedIdx0);
  assert(h.idx(EVENT.tutorialStep, servedIdx, (e) => e.id === 'seated') > servedIdx, 'no tutorial_step seated after served');
  assert(h.until(() => h.has(EVENT.seatDone, servedIdx), WAIT_S.headlessSeat), 'no seat_done within ' + WAIT_S.headlessSeat + ' s');
  const seatDoneIdx = h.idx(EVENT.seatDone, servedIdx);
  h.until(() => h.has(EVENT.tutorialStep, seatDoneIdx), 1);
  const endIdx = h.idx(EVENT.tutorialStep, seatDoneIdx, (e) => e.id === 'end');
  assert(endIdx > seatDoneIdx, 'no tutorial_step end after seat_done');
  const endEv = h.log[endIdx];
  const arrivals = h.log.slice(0, endIdx).filter((e) => e.type === EVENT.customerArrived);
  assert(arrivals.length === 1, arrivals.length + ' customer_arrived before step end, wanted the scripted one only');
  const tick0 = h.ticks;
  h.until(() => h.has(EVENT.customerArrived, endIdx), 2 * C.TICK_SECONDS);
  const nextArr = h.log[h.idx(EVENT.customerArrived, endIdx)];
  assert(nextArr && nextArr._t - endEv._t <= 2, 'no customer_arrived within 2 ticks of step end (ticks waited ' + (h.ticks - tick0) + ')');
  const cust = () => st().customers.find((c) => c.id === nextArr.id);
  let frozen = true;
  const doneOk = h.until(() => {
    const c = cust();
    if (c && c.patience !== c.patienceMax) frozen = false;
    return h.has(EVENT.tutorialDone, endIdx);
  }, C.TUTORIAL_END_S + 0.5);
  assert(doneOk, 'no tutorial_done within ' + (C.TUTORIAL_END_S + 0.5) + ' s of step end');
  assert(frozen, 'customer ' + nextArr.id + ' lost patience while the tutorial ran');
  const done = h.log[h.idx(EVENT.tutorialDone, endIdx)];
  assert(done.skipped === false, 'tutorial_done skipped ' + describe(done.skipped));
  assert(done._at - endEv._at <= C.TUTORIAL_END_S + 0.1 + 1e-9, 'tutorial_done ' + (done._at - endEv._at) + ' s after step end');
  assert(deepEq(st().tutorial, { step: null, done: true }), 'state.tutorial ' + describe(st().tutorial));
  assert(h.step() === null, 'tutorialStep() ' + describe(h.step()) + ' after the end');
  let how = 'waiting at tutorial_done';
  if (!st().customers.some((c) => c.mode === 'waiting')) {
    how = 'after waiting for a customer to stand in line';
    h.until(() => st().customers.some((c) => c.mode === 'waiting'), 10);
  }
  const w = st().customers.find((c) => c.mode === 'waiting');
  assert(w, 'no waiting customer after the tutorial');
  const pBefore = w.patience;
  h.tick();
  const w2 = st().customers.find((c) => c.id === w.id);
  assert(w2 && w2.patience < pBefore, 'customer ' + w.id + ' patience ' + pBefore + ' did not drop on the next tick (' + (w2 && w2.patience) + ')');
  const ids = distinctRuns(h.log.filter((e) => e.type === EVENT.tutorialStep).map((e) => e.id));
  assert(sameJSON(ids, TUTORIAL_ORDER) || sameJSON(ids, TUTORIAL_ORDER.slice(1)), 'tutorial_step ids ' + describe(ids));
  for (const e of h.log.filter((x) => x.type === EVENT.tutorialStep)) assert(e.text === TUTORIAL_TEXT[e.id], 'tutorial_step ' + e.id + ' text ' + describe(e.text));
  assert(!h.has(EVENT.gateSoon), 'gate_soon fired on the tutorial day');
  return 'steps ' + ids.join(' ') + '; end to done ' + Math.round((done._at - endEv._at) * 100) / 100 + ' s; patience ' + how + (h.notes.length ? '; ' + h.notes.join(', ') : '');
}

function skipHeadless(P) {
  const C = P.C;
  const notes = [];
  // (a) skip in the morning
  const a = headless(P, null, 2);
  const n0 = a.log.length;
  assert(a.sim[SIM_METHODS.skipTutorial]() === true, '(a) skipTutorial() did not return true');
  a.drain();
  const doneA = a.of(EVENT.tutorialDone, n0);
  assert(doneA.length === 1 && doneA[0].skipped === true, '(a) tutorial_done events ' + describe(doneA.map(strip)));
  const saveA = a.of(EVENT.saveWanted, n0);
  assert(saveA.some((e) => e.reason === 'tutorial'), '(a) no save_wanted tutorial; got ' + describe(saveA.map(strip)));
  assert(deepEq(a.st().tutorial, { step: null, done: true }), '(a) state.tutorial ' + describe(a.st().tutorial));
  assert(a.sim[SIM_METHODS.serialize]().tutorial.done === true, '(a) serialize().tutorial ' + describe(a.sim[SIM_METHODS.serialize]().tutorial));
  const n1 = a.log.length;
  assert(a.sim[SIM_METHODS.skipTutorial]() === false, '(a) a second skipTutorial() did not return false');
  a.drain();
  assert(a.log.length === n1, '(a) the second skip emitted ' + describe(a.log.slice(n1).map(strip)));
  const og = a.sim.openGate();
  a.drain();
  assert(og && og.ok, '(a) openGate ' + describe(og));
  assert(a.st().spawnAt === C.GATE_OPENS, '(a) spawnAt ' + a.st().spawnAt);
  const n2 = a.log.length;
  a.until(() => a.has(EVENT.customerArrived, n2), C.GATE_OPENS + 2);
  const soon = a.of(EVENT.gateSoon, n2)[0], open = a.of(EVENT.gateOpen, n2)[0], arr = a.of(EVENT.customerArrived, n2)[0];
  const tick = C.TICK_SECONDS + 1e-6;
  assert(soon && nearly(soon._at, C.GATE_OPENS - 10, tick), '(a) gate_soon at ' + (soon && soon._at));
  assert(open && nearly(open._at, C.GATE_OPENS, tick), '(a) gate_open at ' + (open && open._at));
  assert(arr && nearly(arr._at, C.GATE_OPENS, tick), '(a) first customer_arrived at ' + (arr && arr._at));
  notes.push('(a) gate_soon ' + soon._at + ', gate_open ' + open._at);
  // (b) skip in service before the plate
  const b = headless(P, null, 3);
  const ogb = b.sim.openGate();
  b.drain();
  assert(ogb && ogb.ok, '(b) openGate ' + describe(ogb));
  for (let i = 0; i < 100; i++) b.tick();
  assert(b.st().clock === 0, '(b) clock ' + b.st().clock + ' after 100 ticks');
  const m0 = b.log.length;
  assert(b.sim[SIM_METHODS.skipTutorial]() === true, '(b) skipTutorial() in service did not return true');
  b.drain();
  assert(b.of(EVENT.tutorialDone, m0).some((e) => e.skipped === true), '(b) no tutorial_done skipped');
  assert(b.of(EVENT.saveWanted, m0).length === 0, '(b) save_wanted in service: ' + describe(b.of(EVENT.saveWanted, m0).map(strip)));
  assert(b.st().spawnAt === C.GATE_OPENS, '(b) spawnAt ' + b.st().spawnAt);
  b.tick();
  assert(nearly(b.st().clock, C.TICK_SECONDS, 1e-9), '(b) clock after one tick ' + b.st().clock);
  b.until(() => b.has(EVENT.gateOpen, m0), C.GATE_OPENS + 1);
  const openB = b.of(EVENT.gateOpen, m0)[0];
  assert(openB && nearly(openB._at, C.GATE_OPENS, tick), '(b) gate_open at ' + (openB && openB._at));
  notes.push('(b) gate_open ' + openB._at);
  // (c) reset starts it again
  const r0 = b.log.length;
  b.sim.reset();
  b.drain();
  assert(deepEq(b.st().tutorial, { step: 'open', done: false }), '(c) state.tutorial after reset ' + describe(b.st().tutorial));
  assert(b.of(EVENT.tutorialStep, r0).some((e) => e.id === 'open'), '(c) no tutorial_step open after reset; got ' + describe(b.log.slice(r0).map((e) => e.type)));
  // (d) a v3 save with done false runs it
  const d = headless(P, P.validateSave({ v: 3, day: 1, tutorial: { done: false } }), 4);
  assert(d.stepIs('open'), '(d) tutorialStep() ' + describe(d.step()));
  assert(deepEq(d.st().tutorial, { step: 'open', done: false }), '(d) state.tutorial ' + describe(d.st().tutorial));
  return notes.join('; ') + '; (c) reset restarts at open; (d) v3 save with done false starts at open';
}

function burnRun(P, fire, seed) {
  const C = P.C;
  const h = headless(P, null, seed);
  assert(h.sim[SIM_METHODS.skipTutorial]() === true, 'skipTutorial() did not return true');
  h.drain();
  const og = h.sim.openGate();
  h.drain();
  assert(og && og.ok, 'openGate ' + describe(og));
  const k1 = () => h.st().stations.kettle1;
  assert(h.goSettled('pile', () => carryIs(h, CARRY_KIND.charcoal)), 'pile: carrying ' + describe(h.st().player.carrying));
  assert(h.goSettled('kettle1', () => k1().fire >= C.FIRE_LIGHT - 1), 'kettle 1 not lit: ' + k1().fire);
  assert(h.goSettled('cooler', () => carryIs(h, CARRY_KIND.raw, MEAT)), 'cooler: carrying ' + describe(h.st().player.carrying));
  assert(h.goSettled('kettle1', () => k1().pieces.length >= 1), 'kettle 1 has no piece');
  const piece0 = k1().pieces.find((p) => p.slot === 0) || k1().pieces[0];
  const putOn = piece0.putOn;
  h.fixture = (state) => { state.stations.kettle1.fire = fire; };
  assert(h.sim.reach() === 'kettle1', 'reach() after the put on is ' + describe(h.sim.reach()));
  const n0 = h.log.length;
  const labels = [];   // verbAt().label after each tick, with the tick's warning flag
  let warnLost = false;
  let doneAt = null, warnAt = null, burntAt = null;
  const total = h.ticksFor(MEAT_COOK[MEAT] + MEAT_WINDOW[MEAT] + 6);
  for (let i = 0; i < total && burntAt === null; i++) {
    const before = h.log.length;
    h.tick();
    const fresh = h.log.slice(before);
    if (doneAt === null && fresh.some((e) => e.type === EVENT.pieceDone && e.cooker === 'kettle1')) doneAt = h.st().clock;
    const warned = fresh.some((e) => e.type === EVENT.burnWarning);
    if (warned && warnAt === null) warnAt = h.st().clock;
    if (fresh.some((e) => e.type === EVENT.pieceBurnt && e.cooker === 'kettle1')) burntAt = h.st().clock;
    const p = k1().pieces.find((x) => x.id === piece0.id);
    if (warnAt !== null && p && !warned && p.warn !== true) warnLost = true;
    labels.push({ warned, label: h.sim.verbAt().label });
  }
  return { h, n0, putOn, doneAt, warnAt, burntAt, labels, warnLost };
}

function burnHeadless(P) {
  const C = P.C;
  const tol = 0.1 + 1e-6;
  const hot = burnRun(P, C.FIRE_MAX, 5);
  assert(hot.doneAt !== null, 'no piece_done at hot fire');
  const cookTime = hot.doneAt - hot.putOn;
  assert(nearly(cookTime, MEAT_COOK[MEAT] / C.HOT_MULT, tol), 'hot cook took ' + cookTime + ' s, wanted ' + (MEAT_COOK[MEAT] / C.HOT_MULT));
  const warns = hot.h.of(EVENT.burnWarning, hot.n0);
  assert(warns.length === 1, warns.length + ' burn_warning events, wanted 1');
  assert(deepEq(strip(warns[0]), { type: EVENT.burnWarning, station: 'kettle1', slot: 0, meat: MEAT }), 'burn_warning ' + describe(strip(warns[0])));
  const warnAfter = MEAT_WINDOW[MEAT] * (1 - C.WARN_FRAC);
  assert(nearly(hot.warnAt - hot.doneAt, warnAfter, tol), 'warning ' + (hot.warnAt - hot.doneAt) + ' s after done, wanted ' + warnAfter);
  assert(!hot.warnLost, 'warn did not stay true after the warning');
  assert(hot.burntAt !== null, 'the piece never burnt at hot fire');
  const burnSpan = hot.burntAt - hot.doneAt;
  assert(burnSpan >= MEAT_WINDOW[MEAT] - tol && burnSpan <= MEAT_WINDOW[MEAT] + tol, 'burnt ' + burnSpan + ' s after done, wanted ' + MEAT_WINDOW[MEAT]);
  assert(hot.warnAt < hot.burntAt, 'burn_warning did not come before piece_burnt');
  const wi = hot.labels.findIndex((l) => l.warned);
  assert(wi >= 1, 'no label record around the warning');
  const meatLabel = P.MEATS[MEAT].label;
  assert(hot.labels[wi - 1].label === 'Pull ' + meatLabel, 'label one tick before the warning ' + describe(hot.labels[wi - 1].label));
  assert(hot.labels[wi].label === PULL_NOW && (!hot.labels[wi + 1] || hot.labels[wi + 1].label === PULL_NOW), 'label after the warning ' + describe(hot.labels.slice(wi, wi + 2).map((l) => l.label)));
  const good = burnRun(P, 70, 5);
  assert(good.doneAt !== null && good.burntAt !== null, 'good fire run: done ' + good.doneAt + ', burnt ' + good.burntAt);
  const goodSpan = good.burntAt - good.doneAt;
  assert(nearly(goodSpan, MEAT_WINDOW[MEAT], tol), 'good fire burnt ' + goodSpan + ' s after done, wanted ' + MEAT_WINDOW[MEAT]);
  const r2 = (x) => Math.round(x * 100) / 100;
  return 'hot: cook ' + r2(cookTime) + ' s, warn +' + r2(hot.warnAt - hot.doneAt) + ' s, burnt +' + r2(burnSpan) + ' s; good: burnt +' + r2(goodSpan) + ' s' + (hot.h.notes.length ? '; ' + hot.h.notes.join(', ') : '');
}

// ---------------------------------------------------------------------------------------------
// 2. Chrome and CDP
// ---------------------------------------------------------------------------------------------

function freePort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.unref();
    srv.on('error', reject);
    srv.listen(0, '127.0.0.1', () => {
      const port = srv.address().port;
      srv.close(() => resolve(port));
    });
  });
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

class CDP {
  constructor(ws) {
    this.ws = ws;
    this.nextId = 0;
    this.pending = new Map();
    this.handlers = new Map();
    ws.addEventListener('message', (ev) => {
      let m;
      try { m = JSON.parse(typeof ev.data === 'string' ? ev.data : String(ev.data)); } catch (_e) { return; }
      if (m.id) {
        const p = this.pending.get(m.id);
        if (!p) return;
        this.pending.delete(m.id);
        if (m.error) p.reject(new Error(m.error.message + ' (' + p.method + ')'));
        else p.resolve(m.result);
      } else if (m.method) {
        const hs = this.handlers.get(m.method);
        if (hs) for (const h of hs.slice()) h(m.params);
      }
    });
  }
  send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = ++this.nextId;
      this.pending.set(id, { resolve, reject, method });
      this.ws.send(JSON.stringify({ id, method, params }));
      const t = setTimeout(() => {
        if (this.pending.has(id)) { this.pending.delete(id); reject(new Error('CDP timeout: ' + method)); }
      }, TIMEOUT_MS.cdp);
      if (t.unref) t.unref();
    });
  }
  on(method, fn) {
    if (!this.handlers.has(method)) this.handlers.set(method, []);
    this.handlers.get(method).push(fn);
  }
  off(method, fn) {
    const hs = this.handlers.get(method);
    if (hs) { const i = hs.indexOf(fn); if (i >= 0) hs.splice(i, 1); }
  }
  once(method, timeoutMs = TIMEOUT_MS.load) {
    return new Promise((resolve, reject) => {
      const handler = (p) => { clearTimeout(t); this.off(method, handler); resolve(p); };
      const t = setTimeout(() => { this.off(method, handler); reject(new Error('timeout waiting for ' + method)); }, timeoutMs);
      this.on(method, handler);
    });
  }
}

let chrome = null;
let profileDir = null;
let cdp = null;

function killChrome() {
  if (!chrome) return;
  try {
    if (process.platform === 'win32') spawnSync('taskkill', ['/PID', String(chrome.pid), '/T', '/F'], { stdio: 'ignore' });
    else chrome.kill('SIGKILL');
  } catch (_e) { /* already gone */ }
  chrome = null;
}
async function removeProfile() {
  if (!profileDir) return;
  for (let i = 0; i < 6; i++) {
    try { fs.rmSync(profileDir, { recursive: true, force: true }); return; } catch (_e) { await sleep(300); }
  }
}
process.on('exit', killChrome);
process.on('SIGINT', () => { killChrome(); process.exit(130); });
process.on('SIGTERM', () => { killChrome(); process.exit(143); });

async function emulate(metrics, touch) {
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: metrics.width, height: metrics.height, deviceScaleFactor: metrics.deviceScaleFactor, mobile: metrics.mobile });
  await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: touch === undefined ? metrics.mobile : touch, maxTouchPoints: 5 });
}

async function launch() {
  const port = await freePort();
  profileDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pit-sim-smoke-'));
  chrome = spawn(CHROME, [
    '--headless=new',
    '--remote-debugging-port=' + port,
    '--user-data-dir=' + profileDir,
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-extensions',
    '--allow-file-access-from-files',
    '--hide-scrollbars',
    'about:blank'
  ], { stdio: ['ignore', 'ignore', 'pipe'] });
  let stderr = '';
  chrome.stderr.on('data', (d) => { stderr += d; });
  const deadline = Date.now() + TIMEOUT_MS.launch;
  let targets = null;
  while (Date.now() < deadline) {
    try {
      const r = await fetch('http://127.0.0.1:' + port + '/json/list');
      if (r.ok) { targets = await r.json(); if (targets.some((t) => t.type === 'page')) break; }
    } catch (_e) { /* not up yet */ }
    if (chrome.exitCode !== null) throw new Error('Chrome exited early: ' + stderr.trim().split('\n').pop());
    await sleep(150);
  }
  assert(targets, 'Chrome did not answer on port ' + port + ' within ' + TIMEOUT_MS.launch + ' ms');
  const page = targets.find((t) => t.type === 'page');
  assert(page && page.webSocketDebuggerUrl, 'no page target in /json/list');
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    ws.addEventListener('open', resolve, { once: true });
    ws.addEventListener('error', (e) => reject(new Error('WebSocket error: ' + (e.message || 'connect'))), { once: true });
  });
  cdp = new CDP(ws);
  cdp.on('Runtime.consoleAPICalled', (p) => {
    report.console.push({ type: p.type, text: (p.args || []).map((a) => a.value !== undefined ? String(a.value) : (a.description || a.type)).join(' ') });
  });
  cdp.on('Runtime.exceptionThrown', (p) => {
    const d = p.exceptionDetails || {};
    report.exceptions.push({ text: d.text, description: d.exception && d.exception.description, line: d.lineNumber, url: d.url });
  });
  cdp.on('Log.entryAdded', (p) => {
    const e = p.entry || {};
    report.logEntries.push({ level: e.level, source: e.source, text: e.text, url: e.url });
  });
  cdp.on('Network.requestWillBeSent', (p) => { report.requests.push(p.request.url); });
  await cdp.send('Runtime.enable');
  await cdp.send('Page.enable');
  await cdp.send('Log.enable');
  await cdp.send('Network.enable');
  await emulate(RUN_METRICS);
  return port;
}

function errorCount() {
  const consoleErrors = report.console.filter((c) => c.type === 'error').length;
  const logErrors = report.logEntries.filter((l) => l.level === 'error').length;
  return { consoleErrors, exceptions: report.exceptions.length, logErrors, total: consoleErrors + report.exceptions.length + logErrors };
}

// ---------------------------------------------------------------------------------------------
// Page helpers
// ---------------------------------------------------------------------------------------------

const PRELUDE = `
  const g = globalThis.${GLOBAL_NAME} && globalThis.${GLOBAL_NAME}.game;
  const sim = g && g.${GAME_FIELDS.sim};
  const S = () => sim.state;
  const C = globalThis.${GLOBAL_NAME}.C;
  const MAP = globalThis.${GLOBAL_NAME}.MAP;
  const $ = (id) => document.getElementById(id);
  const txt = (id) => { const e = $(id); if (!e) throw new Error('#' + id + ' missing'); return (e.textContent || '').trim(); };
  const vis = (id) => { const e = $(id); return !!e && !e.hidden && !e.closest('[hidden]') && e.getClientRects().length > 0; };
  const click = (id) => { const e = $(id); if (!e) throw new Error('#' + id + ' missing'); if (e.disabled) throw new Error('#' + id + ' is disabled'); e.click(); return true; };
`;

async function ev(expr) {
  const r = await cdp.send('Runtime.evaluate', { expression: '(() => {' + PRELUDE + ' return (' + expr + '); })()', returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) {
    const d = r.exceptionDetails;
    throw new Error('page: ' + ((d.exception && d.exception.description) || d.text).split('\n')[0]);
  }
  return r.result.value;
}
async function run(body) {
  const r = await cdp.send('Runtime.evaluate', { expression: '(() => {' + PRELUDE + body + '\n})()', returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) {
    const d = r.exceptionDetails;
    throw new Error('page: ' + ((d.exception && d.exception.description) || d.text).split('\n')[0]);
  }
  return r.result.value;
}
const click = (id) => ev('click(' + JSON.stringify(id) + ')');
const text = (id) => ev('txt(' + JSON.stringify(id) + ')');
const visible = (id) => ev('vis(' + JSON.stringify(id) + ')');
// advance(s) steps the sim, pumps events, refreshes the DOM and draws one frame (D14).
const advance = (s) => ev('(g.' + GAME_FIELDS.advance + '(' + s + '), globalThis.__smoke && globalThis.__smoke.rec(), true)');
const captureFrame = () => ev('g.' + GAME_FIELDS.captureFrame + '()');
const fxLog = () => ev('JSON.parse(JSON.stringify(g.' + GAME_FIELDS.fxLog + '))');

// The probe wraps sim.drainEvents so the harness sees every event game.js pumps, and samples the
// clock between advances for the boredom metric. Reinstalled after a reload; totals are carried.
const PROBE = `
  if (globalThis.__smoke) return 'present';
  const P = { events: [], live: [], bored: 0, boredPrep: 0, service: 0, lastClock: S().clock, lastDay: S().day };
  // Deviation 7: every new #live text, from a MutationObserver and from a read after each advance.
  const liveEl = document.getElementById('${ID.live}');
  P.rec = function () {
    if (!liveEl) return;
    const t = (liveEl.textContent || '').trim();
    const last = P.live.length ? P.live[P.live.length - 1].text : null;
    if (t && t !== last) P.live.push({ text: t, at: Math.round(S().clock * 100) / 100, day: S().day, ms: Date.now() });
  };
  if (liveEl) new MutationObserver(P.rec).observe(liveEl, { childList: true, characterData: true, subtree: true });
  P.rec();
  const orig = sim.${SIM_METHODS.drainEvents};
  sim.${SIM_METHODS.drainEvents} = function () {
    const out = orig.apply(sim, arguments);
    for (const e of out) P.events.push(Object.assign({ at: Math.round(S().clock * 100) / 100, day: S().day }, e));
    return out;
  };
  P.sample = function () {
    const s = S();
    let d = s.clock - P.lastClock;
    if (s.day !== P.lastDay || d < 0) d = 0;
    P.lastClock = s.clock; P.lastDay = s.day;
    if (s.phase !== '${PHASE.service}' || d <= 0) return;
    const cooking = ${describe(COOKERS)}.some((id) => s.stations[id].pieces.length > 0);
    const present = s.customers.some((c) => ${describe(CUSTOMER_PRESENT_MODES)}.includes(c.mode));
    const fireUp = ${describe(COOKERS)}.some((id) => s.stations[id].fire > C.${C_NAMES.fireLowWarn});
    const idle = !cooking && !present && fireUp;
    if (s.clock >= C.${C_NAMES.gateOpens}) { P.service += d; if (idle) P.bored += d; }
    else if (idle) P.boredPrep += d;
  };
  P.until = function (pred, maxSec) {
    const dt = C.${C_NAMES.tick};
    let t = 0;
    P.sample();
    while (t < maxSec) {
      if (pred()) return { ok: true, t: Math.round(t * 100) / 100 };
      g.${GAME_FIELDS.advance}(dt);
      t += dt;
      P.sample();
      P.rec();
    }
    return { ok: !!pred(), t: Math.round(t * 100) / 100 };
  };
  globalThis.__smoke = P;
  return 'installed';
`;
const installProbe = () => run(PROBE);

// Advance the sim until pred (a JS expression over S(), C, MAP, g, sim) holds, at most maxSec simulated seconds.
async function until(pred, maxSec) {
  return run('return globalThis.__smoke.until(() => (' + pred + '), ' + maxSec + ');');
}
async function eventsOfType(type) {
  return run('return globalThis.__smoke.events.filter((e) => e.type === ' + JSON.stringify(type) + ');');
}
async function eventCount() {
  return run('return globalThis.__smoke.events.length;');
}
async function eventsSince(n, type) {
  return run('return globalThis.__smoke.events.slice(' + n + ').filter((e) => e.type === ' + JSON.stringify(type) + ');');
}
async function eventsFrom(n) {
  return run('return globalThis.__smoke.events.slice(' + n + ');');
}
async function allEvents() {
  return run('return globalThis.__smoke.events;');
}
async function liveTexts() {
  return run('return globalThis.__smoke.live.map((l) => l.text);');
}
// v2.1 page reads.
const tut = () => ev('(() => { const t = sim.' + SIM_METHODS.tutorialStep + '(); return t ? { id: t.id, text: t.text, target: t.target } : null; })()');
const banner = () => ev('g.' + GAME_FIELDS.banner + ' ? JSON.parse(JSON.stringify(g.' + GAME_FIELDS.banner + ')) : null');
const hasPulse = (id) => ev('!!$(' + JSON.stringify(id) + ') && $(' + JSON.stringify(id) + ').classList.contains(' + JSON.stringify(PULSE) + ')');
const anyPulse = () => ev('document.querySelectorAll(".' + PULSE + '").length');
const present = (id) => ev('!!$(' + JSON.stringify(id) + ')');
const hintShown = () => ev('!!$(' + JSON.stringify(ID.clipTop) + ') && $(' + JSON.stringify(ID.clipTop) + ').textContent.includes(' + JSON.stringify(DAY1_HINT) + ')');
const arrows = (frame) => frame.filter((d) => d.name === 'arrow');
// Deviation 8: let the one a second live queue speak after a tutorial step change.
const liveBreath = () => sleep(LIVE_BREATH_MS);
async function expectStep(id, target, label) {
  const t = await tut();
  assert(t && t.id === id && (target === undefined || t.target === target),
    (label || 'tutorial') + ': step is ' + describe(t) + ', wanted ' + id + (target === undefined ? '' : ' with target ' + describe(target)));
  return t;
}
async function newGame(fromId) {
  await click(fromId);
  await advance(0);
  await click(ID.confirmYes);
  await advance(0);
}
async function probeMetrics() {
  return run('const P = globalThis.__smoke; return { bored: P.bored, boredPrep: P.boredPrep, service: P.service, events: P.events.length };');
}

let taps = 0;        // canvas taps, action button clicks and walkTo fallbacks during service
const tapNotes = [];

async function canvasPoint(tx, ty) {
  const r = await ev('(() => { const b = $(' + JSON.stringify(ID.cv) + ').getBoundingClientRect(); return { l: b.left, t: b.top, w: b.width, h: b.height }; })()');
  return { x: r.l + (tx + 0.5) * r.w / MAP_SIZE.w, y: r.t + (ty + 0.5) * r.h / MAP_SIZE.h };
}
async function mouseTap(x, y) {
  await cdp.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y });
  await cdp.send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 });
  await cdp.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 });
}
async function canvasTap(tx, ty) {
  const { x, y } = await canvasPoint(tx, ty);
  if (DESKTOP_MODE) {
    await mouseTap(x, y);
  } else {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, radiusX: 4, radiusY: 4, force: 1 }] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  }
  taps += 1;
}
async function settle(maxSec = WAIT_S.walk) {
  const r = await until('!' + F.walking + ' && ' + F.nextTile + ' === null && ' + F.pathLen + ' === 0', maxSec);
  await until('false', WAIT_S.settle);   // let the arrival auto action tick
  return r;
}
// Walk to a station with a real tap, settle, check the expected effect; fall back to sim.walkTo,
// then to the action button, noting which path worked.
async function goto(name, expectExpr) {
  const t = TILE[name];
  let how = 'tap';
  await canvasTap(t.x, t.y);
  await settle();
  let ok = await ev(expectExpr);
  if (!ok) {
    how = 'walkTo';
    await ev('sim.' + SIM_METHODS.walkTo + '(' + t.x + ', ' + t.y + ')');
    taps += 1;
    await settle();
    ok = await ev(expectExpr);
  }
  if (!ok) {
    how += '+act';
    await click(ID.act).catch(() => {});
    taps += 1;
    await until('false', WAIT_S.settle);
    ok = await ev(expectExpr);
  }
  if (how !== 'tap') tapNotes.push(name + ' via ' + how);
  return { ok, how };
}
const hasKind = (kind) => F.carrying + ' !== null && ' + F.carrying + '.kind === ' + JSON.stringify(kind);
const anyPiece = (state) => F.pieces('kettle1') + '.some((p) => p.state === ' + JSON.stringify(state) + ')';
const boardHasPlates = F.boardStacks + '.some((st) => st.times.length > 0)';
const tableHas = (meat) => F.tableSpots + '.some((sp) => sp && sp.meat === ' + JSON.stringify(meat) + ' && sp.times.length > 0)';
const inService = F.phase + ' === ' + JSON.stringify(PHASE.service);

async function feedFireIfLow() {
  const low = await ev(F.fire('kettle1') + ' < C.' + C_NAMES.fireGood + ' && ' + F.carrying + ' === null && ' + F.charcoal + ' > 0');
  if (!low) return false;
  const before = await ev(F.fire('kettle1'));
  const a = await goto('pile', hasKind(CARRY_KIND.charcoal));
  if (!a.ok) return false;
  const b = await goto('kettle1', F.fire('kettle1') + ' > ' + before);
  return b.ok;
}
async function waitForDone() {
  const deadline = WAIT_S.cook;
  let spent = 0;
  for (let i = 0; i < 8 && spent < deadline; i++) {
    const r = await until(anyPiece(PIECE_STATE.done) + ' || ' + F.fire('kettle1') + ' < C.' + C_NAMES.fireGood + ' || !(' + inService + ')', deadline - spent);
    spent += r.t;
    if (await ev(anyPiece(PIECE_STATE.done))) return true;
    if (!(await ev(inService))) return false;
    await feedFireIfLow();
  }
  return ev(anyPiece(PIECE_STATE.done));
}
async function keyPress(k) {
  await cdp.send('Input.dispatchKeyEvent', { type: 'keyDown', key: k.key, code: k.code, windowsVirtualKeyCode: k.windowsVirtualKeyCode });
  await cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', key: k.key, code: k.code, windowsVirtualKeyCode: k.windowsVirtualKeyCode });
}
async function screenshot(name) {
  const r = await cdp.send('Page.captureScreenshot', { format: 'png' });
  const file = path.join(OUT_DIR, name);
  fs.writeFileSync(file, Buffer.from(r.data, 'base64'));
  report.screenshots.push(file);
  return file;
}
// On the phone the morning clipboard covers the canvas: hide the panels for the one shot.
const PANELS_ID = 'panels';
async function screenshotYard(name) {
  if (DESKTOP_MODE) return screenshot(name);
  await ev('(document.getElementById(' + JSON.stringify(PANELS_ID) + ').style.visibility = "hidden", true)');
  try {
    return await screenshot(name);
  } finally {
    await ev('(document.getElementById(' + JSON.stringify(PANELS_ID) + ').style.visibility = "", true)');
  }
}
async function waitForGame() {
  const deadline = Date.now() + TIMEOUT_MS.load;
  while (Date.now() < deadline) {
    const ready = await cdp.send('Runtime.evaluate', { expression: 'typeof ' + GLOBAL_NAME + ' !== "undefined" && !!' + GLOBAL_NAME + '.game && !!' + GLOBAL_NAME + '.game.' + GAME_FIELDS.sim, returnByValue: true });
    if (ready.result && ready.result.value === true) return true;
    await sleep(100);
  }
  return false;
}
// Reload the page. With a save object, it is written to SAVE_KEY by a script that runs before any
// page script on the new document, then that script is removed.
async function reload(saveObj) {
  let scriptId = null;
  if (saveObj !== undefined) {
    const src = 'try { localStorage.setItem(' + JSON.stringify(SAVE_KEY) + ', ' + JSON.stringify(JSON.stringify(saveObj)) + '); } catch (e) {}';
    const r = await cdp.send('Page.addScriptToEvaluateOnNewDocument', { source: src });
    scriptId = r.identifier;
  }
  try {
    const loaded = cdp.once('Page.loadEventFired');
    await cdp.send('Page.reload', { ignoreCache: true });
    await loaded;
  } finally {
    if (scriptId) await cdp.send('Page.removeScriptToEvaluateOnNewDocument', { identifier: scriptId }).catch(() => {});
  }
  assert(await waitForGame(), GLOBAL_NAME + '.game did not come back after reload');
  await sleep(250);
  await installProbe();
  await advance(0);
}
async function shop(list) {
  for (let i = 0; i < list.charcoal; i++) await click(ID.inc('charcoal'));
  for (let i = 0; i < list.units; i++) await click(ID.inc(list.meat));
}
async function openYard(list) {
  await shop(list);
  await click(ID.open);
  await until('false', WAIT_S.afterOpen);
  assert(await ev(inService), 'the yard did not open; phase ' + (await ev(F.phase)));
}
// Day 1 opens with a prefilled cart (sim.js deviation 12). Click every line down to zero through
// the DOM so the buy steps below start from the contract's empty cart.
async function emptyCart() {
  const cart = await ev('JSON.parse(JSON.stringify(S().cart))');
  let clicks = 0;
  for (let i = 0; i < (cart.charcoal | 0); i++) { await click(ID.dec('charcoal')); clicks += 1; }
  for (const m of Object.keys(cart.meat || {})) {
    for (let i = 0; i < (cart.meat[m] | 0); i++) { await click(ID.dec(m)); clicks += 1; }
  }
  return clicks;
}
// Canvas rect and backing store, after the emulation settles.
async function canvasScale() {
  return ev('(() => { const c = $(' + JSON.stringify(ID.cv) + '); const b = c.getBoundingClientRect(); return { w: b.width, h: b.height, left: b.left, top: b.top, bw: c.width, bh: c.height, dpr: window.devicePixelRatio || 1, vw: document.documentElement.clientWidth, vh: window.innerHeight }; })()');
}
function checkScale(r, css, label) {
  const k = Math.max(1, Math.round(css * r.dpr));
  assert(r.w === VIRTUAL.w * css && r.h === VIRTUAL.h * css, label + ': #cv rect ' + r.w + ' by ' + r.h + ', wanted ' + (VIRTUAL.w * css) + ' by ' + (VIRTUAL.h * css) + ' (viewport ' + r.vw + ' by ' + r.vh + ')');
  assert(r.bw === VIRTUAL.w * k && r.bh === VIRTUAL.h * k, label + ': backing store ' + r.bw + ' by ' + r.bh + ', wanted k ' + k);
  assert(Number.isInteger(r.w / VIRTUAL.w), label + ': ' + r.w + ' / ' + VIRTUAL.w + ' is not an integer');
  return label + ' ' + r.w + 'x' + r.h + ' k ' + k;
}
// Ghost records (unowned previews) never count as the real draw.
const hasRecord = (frame, want) => frame.some((d) => !d.ghost && d.name === want.name && d.x === want.x && d.y === want.y && (want.frame === undefined || d.frame === want.frame));
const hasGhost = (frame, want) => frame.some((d) => d.ghost === true && d.name === want.name && d.x === want.x && d.y === want.y);
const outlineAt = (frame, o) => frame.find((d) => d.name === OUTLINE && d.x === o.x && d.y === o.y && (o.w === undefined || (d.w === o.w && d.h === o.h)));
// Every visible button in the document, smaller than the minimum.
const SMALL_BUTTONS = '[...document.querySelectorAll("button")].filter((b) => !b.hidden && !b.closest("[hidden]") && b.getClientRects().length > 0).map((b) => { const r = b.getBoundingClientRect(); return { id: b.id || b.textContent.trim().slice(0, 20), w: Math.round(r.width), h: Math.round(r.height) }; }).filter((r) => r.w < ' + MIN_CONTROL_PX + ' || r.h < ' + MIN_CONTROL_PX + ')';

// ---------------------------------------------------------------------------------------------
// 3. The browser run: steps 9 onward
// ---------------------------------------------------------------------------------------------

// K11 step 14, from the art.SPRITES grids. '0' and '.' are both transparent.
function checkGrids(G) {
  const bad = [];
  const cnt = (rows, ch) => rows.join('').split(ch).length - 1;
  const clear = (row) => /^[0.]*$/.test(row);
  const pile = G.pile;
  if (!pile || pile.length !== 4) return ['pile has ' + (pile && pile.length) + ' frames'];
  for (let i = 0; i < 4; i++) {
    const f = pile[i];
    if (cnt(f, '8') < 1) bad.push('pile frame ' + i + ' has no 8 (the sack)');
    if (!f[15] || !f[15].includes('a')) bad.push('pile frame ' + i + ' row 15 has no a (the shadow)');
    if (i <= 2) {
      if (cnt(f, 's') > 0) bad.push('pile frame ' + i + ' has ' + cnt(f, 's') + ' s');
      if (cnt(f, 'u') > 3) bad.push('pile frame ' + i + ' has ' + cnt(f, 'u') + ' u');
      const dark = cnt(f, '1') + cnt(f, 't'), light = cnt(f, 'v') + cnt(f, 's') + cnt(f, 'u');
      if (dark < 4 * light) bad.push('pile frame ' + i + ': 1 + t is ' + dark + ', under 4 times v + s + u (' + light + ')');
    }
    if (i <= 1) {
      const e = cnt(f, '4');
      if (e < 1 || e > 3) bad.push('pile frame ' + i + ' has ' + e + ' ember (4) pixels, wanted 1 to 3');
    }
    if (i === 3) for (const ch of ['t', 'v', 'u', '4', 'k']) if (cnt(f, ch) > 0) bad.push('pile frame 3 (empty) has ' + ch);
  }
  const hc = G.hand_charcoal && G.hand_charcoal[0];
  if (!hc) bad.push('hand_charcoal missing');
  else {
    if (cnt(hc, '1') < 6) bad.push('hand_charcoal has ' + cnt(hc, '1') + ' 1 pixels, wanted 6 or more');
    const dark = cnt(hc, '1') + cnt(hc, 't'), light = cnt(hc, 'v') + cnt(hc, 's') + cnt(hc, 'u');
    if (dark < 2 * light) bad.push('hand_charcoal: 1 + t is ' + dark + ', under twice v + s + u (' + light + ')');
  }
  for (const m of MEAT_IDS) {
    const f = G['piece_' + m];
    if (!f || f.length < 5) { bad.push('piece_' + m + ' has ' + (f && f.length) + ' frames'); continue; }
    if (sameJSON(f[4], f[2])) bad.push('piece_' + m + ' frame 4 equals frame 2');
    if (cnt(f[4], '1') < cnt(f[2], '1') + 4) bad.push('piece_' + m + ' frame 4 has ' + cnt(f[4], '1') + ' 1 pixels, frame 2 ' + cnt(f[2], '1') + ' (wanted 4 more)');
  }
  const ar = G.arrow;
  if (!ar || ar.length !== 4) bad.push('arrow has ' + (ar && ar.length) + ' frames');
  else {
    const h = ar[0].length;
    const shifted = ar[1].every((row, r) => (r < 2 ? clear(row) : row === ar[0][r - 2])) && ar[0].slice(h - 2).every(clear);
    if (!shifted) bad.push('arrow frame 1 is not frame 0 shifted down 2 rows');
    if (!sameJSON(ar[2], ar[0].slice().reverse())) bad.push('arrow frame 2 is not frame 0 in reversed row order');
    if (!sameJSON(ar[3], ar[1].slice().reverse())) bad.push('arrow frame 3 is not frame 1 in reversed row order');
    const stray = [...new Set(ar.flat().join('').split(''))].filter((ch) => !'0.5kh'.includes(ch));
    if (stray.length) bad.push('arrow uses ' + stray.join(' ') + ' (only 0 5 k h allowed)');
  }
  const bw = G.bubble_warn && G.bubble_warn[0];
  if (!bw) bad.push('bubble_warn missing');
  else if (cnt(bw, 'o') < 1 || cnt(bw, '3') < 1) bad.push('bubble_warn frame 0 lacks o or 3');
  return bad;
}

async function browserChecks() {
  const url = pathToFileURL(FILES.index).href + '?seed=' + SEED;
  const captures = {};

  await step('page loaded with zero errors', async () => {
    const loaded = cdp.once('Page.loadEventFired');
    await cdp.send('Page.navigate', { url });
    await loaded;
    assert(await waitForGame(), GLOBAL_NAME + '.game did not appear within ' + TIMEOUT_MS.load + ' ms');
    await sleep(250);
    const e = errorCount();
    assert(e.total === 0, describe(e) + ' first: ' + describe(report.console.find((c) => c.type === 'error') || report.exceptions[0] || report.logEntries.find((l) => l.level === 'error')));
    const art = await ev(GLOBAL_NAME + '.art && ' + GLOBAL_NAME + '.art.' + ART_FIELDS.built + ' === true');
    assert(art, 'art.built is not true');
    const ver = await ev('g.' + GAME_FIELDS.version);
    assert(ver === GAME_VERSION, 'game.version is ' + describe(ver) + ', wanted ' + GAME_VERSION);
    const hooks = await ev('({ dog: !!g.' + GAME_FIELDS.dog + ', fxLog: Array.isArray(g.' + GAME_FIELDS.fxLog + '), captureFrame: typeof g.' + GAME_FIELDS.captureFrame + ' === "function", advance: typeof g.' + GAME_FIELDS.advance + ' === "function", banner: ' + JSON.stringify(GAME_FIELDS.banner) + ' in g })');
    assert(hooks.dog && hooks.fxLog && hooks.captureFrame && hooks.advance && hooks.banner, 'PitSim.game hooks ' + describe(hooks));
    await installProbe();
    await advance(0);
    return 'version ' + ver;
  }, { fatal: true });

  await step('only the four file:// requests', () => {
    const bad = report.requests.filter((u) => !(u.startsWith('file:') && EXPECTED_REQUEST_FILES.some((f) => u.includes('/' + f))));
    assert(bad.length === 0, 'unexpected: ' + bad.slice(0, 3).join(', '));
    return report.requests.length + ' requests';
  });

  await step('sprite list and palette', async () => {
    const r = await run('const A = globalThis.' + GLOBAL_NAME + '.art; const list = ' + describe(REQUIRED_SPRITES) + ';'
      + ' const bad = []; for (const [n, w, h, f] of list) {'
      + '   if (!A.has(n)) { bad.push(n + " missing"); continue; }'
      + '   if (A.frames(n) !== f) bad.push(n + " frames " + A.frames(n));'
      + '   const s = A.SPRITES[n]; if (!s || s.w !== w || s.h !== h) bad.push(n + " size " + (s && s.w) + "x" + (s && s.h));'
      + ' }'
      + ' return { bad, count: Object.keys(A.SPRITES).length, pal: A.PALETTE.length, pal0: A.PALETTE[0], colorKeys: Object.keys(A.COLOR) };');
    assert(r.bad.length === 0, r.bad.length + ' sprite problems, first ' + r.bad.slice(0, 4).join('; '));
    assert(r.count === SPRITE_COUNT, 'SPRITES has ' + r.count + ' names, wanted ' + SPRITE_COUNT);
    assert(r.pal === PALETTE_LEN && r.pal0 === '', 'PALETTE length ' + r.pal + ', [0] ' + describe(r.pal0));
    const missing = COLOR_KEYS.filter((k) => !r.colorKeys.includes(k));
    const extra = r.colorKeys.filter((k) => !COLOR_KEYS.includes(k));
    assert(missing.length === 0 && extra.length === 0, 'COLOR missing ' + missing.join(' ') + ', extra ' + extra.join(' '));
    // v2.1 (K11 step 14): the charcoal, piece, arrow and bubble grids, and the two font glyphs.
    const grids = await run('const A = globalThis.' + GLOBAL_NAME + '.art; const names = ["pile", "hand_charcoal", "arrow", "bubble_warn"].concat(' + describe(MEAT_IDS) + '.map((m) => "piece_" + m));'
      + ' const out = {}; for (const n of names) out[n] = A.SPRITES[n] ? A.SPRITES[n].frames.map((f) => f.slice()) : null;'
      + ' return { grids: out, dots: A.textWidth(".,") };');
    const problems = checkGrids(grids.grids);
    assert(problems.length === 0, problems.length + ' grid rule(s) broken, first ' + problems.slice(0, 4).join('; '));
    assert(grids.dots === 9, 'art.textWidth(".,") is ' + grids.dots + ', wanted 9');
    return REQUIRED_SPRITES.length + ' sprites, ' + r.pal + ' colors, ' + COLOR_KEYS.length + ' keys; charcoal, piece frame 4, arrow and bubble grids pass';
  });

  await step('canvas scale is an integer', async () => {
    const own = DESKTOP_MODE ? 'desktop' : 'phone';
    const other = DESKTOP_MODE ? 'phone' : 'desktop';
    const notes = [];
    await advance(0);
    notes.push(checkScale(await canvasScale(), CSS_SCALE[own], own));
    try {
      await emulate(DESKTOP_MODE ? PHONE : DESKTOP);
      await sleep(TIMEOUT_MS.resize);
      await advance(0);
      notes.push(checkScale(await canvasScale(), CSS_SCALE[other], other));
    } finally {
      await emulate(RUN_METRICS);
      await sleep(TIMEOUT_MS.resize);
      await advance(0);
    }
    const back = await canvasScale();
    assert(back.w === VIRTUAL.w * CSS_SCALE[own], 'after restoring ' + own + ' the canvas is ' + back.w + ' wide');
    return notes.join('; ');
  });

  await step('canvas is device pixel exact on Android and laptop sizes', async () => {
    const notes = [];
    try {
      for (const m of DEVICE_SIZES) {
        const label = m.width + 'x' + m.height + '@' + m.deviceScaleFactor;
        await emulate(m);
        await sleep(TIMEOUT_MS.resize);
        await advance(0);
        const r = await canvasScale();
        const k = r.bw / VIRTUAL.w;
        assert(Number.isInteger(k) && k >= 1, label + ': backing store ' + r.bw + ' is not a whole multiple of ' + VIRTUAL.w);
        assert(r.bh === VIRTUAL.h * k, label + ': backing store ' + r.bw + ' by ' + r.bh + ' is not k ' + k + ' on both axes');
        assert(Math.abs(r.w * r.dpr - r.bw) < 0.1 && Math.abs(r.h * r.dpr - r.bh) < 0.1,
          label + ': rect ' + r.w + ' by ' + r.h + ' at dpr ' + r.dpr + ' is ' + (r.w * r.dpr) + ' device px, backing store ' + r.bw);
        const fx = Math.abs(r.left * r.dpr - Math.round(r.left * r.dpr)), fy = Math.abs(r.top * r.dpr - Math.round(r.top * r.dpr));
        assert(fx < 0.05 && fy < 0.05, label + ': canvas top left (' + r.left + ', ' + r.top + ') is not on a whole device pixel');
        const lay = await ev('({ sw: document.documentElement.scrollWidth, iw: window.innerWidth, chips: $(' + JSON.stringify(ID.chips) + ').getBoundingClientRect().bottom })');
        assert(lay.sw <= lay.iw, label + ': scrollWidth ' + lay.sw + ' over innerWidth ' + lay.iw);
        if (m.controls) assert(lay.chips <= m.height, label + ': the meat chips end at ' + lay.chips + ', below the ' + m.height + ' px viewport');
        notes.push(label + ' k ' + k + ', ' + (Math.round(r.w * 100) / 100) + ' css px');
      }
    } finally {
      await emulate(RUN_METRICS);
      await sleep(TIMEOUT_MS.resize);
      await advance(0);
    }
    const back = await canvasScale();
    assert(back.w === VIRTUAL.w * CSS_SCALE[DESKTOP_MODE ? 'desktop' : 'phone'], 'after restoring the run size the canvas is ' + back.w + ' wide');
    return notes.join('; ');
  });

  await step('clipboard: morning, day 1, start cash', async () => {
    await advance(0);
    const s = await ev('({ phase: ' + F.phase + ', day: ' + F.day + ', cash: ' + F.cash + ', start: C.' + C_NAMES.startCash + ' })');
    assert(s.phase === PHASE.morning, 'phase ' + s.phase);
    assert(s.day === 1, 'day ' + s.day);
    assert(s.cash === s.start, 'cash ' + s.cash);
    assert(await visible(ID.clipboard), '#clipboard hidden');
    const seats = await text(ID.seats);
    assert(seats === TEXT.seats(2, 0, 1), '#seats is ' + describe(seats));
    // v2.1: the tutorial's morning, checked before the cart is emptied.
    await expectStep('open', 'open', 'morning');
    assert(await present(ID.tutClip), '#tut-clip missing');
    const tc = await text(ID.tutClip);
    assert(tc === TUTORIAL_TEXT.open, '#tut-clip is ' + describe(tc));
    assert(await visible(ID.tutSkip), '#tut-skip not visible');
    const sk = await text(ID.tutSkip);
    assert(sk === TEXT.skipTutorial, '#tut-skip is ' + describe(sk));
    assert(await hasPulse(ID.open), '#open has no ' + PULSE);
    const hb = await text(ID.howtoBtn);
    assert(hb === TEXT.controls, '#howto-btn is ' + describe(hb));
    assert(!(await visible(ID.howto)), '#howto visible on its own');
    assert(!(await hintShown()), 'the day 1 hint shows while the tutorial runs');
    const bn = await banner();
    assert(bn === null, 'PitSim.game.banner in the morning is ' + describe(bn));
    await screenshot(SCREENSHOTS.clipboard);
    const frame = await captureFrame();
    captures.morning = frame;
    for (const want of MORNING_DRAWS) assert(hasRecord(frame, want), 'captureFrame has no ' + describe(want) + '; dog records ' + describe(frame.filter((d) => d.name === 'dog')));
    for (const o of MORNING_OUTLINES) assert(outlineAt(frame, o), 'no ' + OUTLINE + ' for ' + o.what + ' at ' + describe(o) + '; outlines ' + describe(frame.filter((d) => d.name === OUTLINE).slice(0, 12)));
    for (const g of MORNING_GHOSTS) assert(hasGhost(frame, g), 'captureFrame has no ghost ' + describe(g) + '; ghosts ' + describe(frame.filter((d) => d.ghost).slice(0, 12)));
    const prefilled = await ev('JSON.parse(JSON.stringify(S().cart))');
    const prefillTotal = await ev('sim.cartTotal()');
    if (prefillTotal > 0) {
      assert(await ev('$(' + JSON.stringify(ID.open) + ').disabled === false'), '#open disabled with a prefilled cart');
      const openBox = await ev('(() => { const b = $(' + JSON.stringify(ID.open) + ').getBoundingClientRect(); return { top: b.top, bottom: b.bottom, h: window.innerHeight }; })()');
      assert(openBox.top >= 0 && openBox.bottom <= openBox.h, '#open is not inside the viewport before scrolling: ' + describe(openBox));
    }
    const emptied = await emptyCart();
    await advance(0);
    assert(await ev('$(' + JSON.stringify(ID.open) + ').disabled === true'), '#open should be disabled with an empty cart');
    const why = await text(ID.openWhy);
    assert(why === TEXT.needCharcoal, '#open-why is ' + describe(why));
    return frame.length + ' draw records; tutorial at open; ' + (prefillTotal > 0 ? 'prefilled ' + describe(prefilled) + ' (total ' + prefillTotal + '), emptied in ' + emptied + ' clicks' : 'cart started empty');
  }, { fatal: true });

  await step('controls', async () => {
    assert(!(await visible(ID.howto)), '#howto visible before #howto-btn');
    await click(ID.howtoBtn);
    await advance(0);
    assert(await visible(ID.howto), '#howto not visible after clicking #' + ID.howtoBtn);
    await keyPress(KEYS.escape);
    await advance(0);
    assert(await visible(ID.clipboard), '#clipboard did not come back after Escape on #howto');
    assert(!(await visible(ID.howto)), '#howto still visible after Escape');
    return 'clicked #' + ID.howtoBtn + ' (Controls), Escape returned to the clipboard';
  });

  let cartTotal = 0;
  await step('bought', async () => {
    const prices = await ev('({ charcoal: ' + GLOBAL_NAME + '.CATALOG.find((r) => r.id === "charcoal").price, meat: ' + GLOBAL_NAME + '.CATALOG.find((r) => r.id === ' + JSON.stringify(BUY_DAY1.meat) + ').price, cash: ' + F.cash + ' })');
    await shop(BUY_DAY1);
    await advance(0);
    cartTotal = BUY_DAY1.charcoal * prices.charcoal + BUY_DAY1.units * prices.meat;
    const qty = await text(ID.qty('charcoal'));
    assert(qty === String(BUY_DAY1.charcoal), '#qty-charcoal is ' + describe(qty));
    const cart = await text(ID.cart);
    const want = TEXT.cartLine(cartTotal, prices.cash - cartTotal);
    assert(cart === want, '#cart is ' + describe(cart) + ', wanted ' + describe(want));
    assert(await ev('$(' + JSON.stringify(ID.open) + ').disabled === false'), '#open still disabled');
    return cart;
  }, { fatal: true });

  await step('gate open', async () => {
    const before = await ev(F.cash);
    await click(ID.open);
    await until('false', WAIT_S.afterOpen);
    await advance(0);
    const s = await ev('({ phase: ' + F.phase + ', cash: ' + F.cash + ' })');
    assert(s.phase === PHASE.service, 'phase ' + s.phase);
    assert(s.cash === before - cartTotal, 'cash ' + s.cash + ', wanted ' + (before - cartTotal));
    assert(!(await visible(ID.clipboard)), '#clipboard still visible');
    const status = await text(ID.status);
    assert(!status.startsWith(TEXT.gateOpensIn), '#status shows the gate countdown during the tutorial: ' + describe(status));
    assert(status === TEXT.handsEmpty, '#status is ' + describe(status) + ', wanted ' + describe(TEXT.handsEmpty));
    const act = await text(ID.act);
    assert(act === TEXT.walk, '#act is ' + describe(act));
    const opened = await eventsOfType(EVENT.yardOpen);
    assert(opened.length === 1, EVENT.yardOpen + ' events: ' + opened.length);
    // v2.1 step b: banner and arrow at the pile, clock held.
    await expectStep('charcoal', 'pile', 'after Open the yard');
    const bn = await banner();
    assert(bn && sameJSON(bn.lines, BANNER_CHARCOAL), 'banner ' + describe(bn) + ', wanted lines ' + describe(BANNER_CHARCOAL));
    const frame = await captureFrame();
    const ar = arrows(frame);
    const want = ARROW_AT.pile;
    assert(ar.some((d) => d.x === want.x && d.y === want.y && want.frames.includes(d.frame)), 'no arrow at (' + want.x + ',' + want.y + ') frame 2 or 3; arrows ' + describe(ar));
    captures.tutorial = frame;
    await screenshot(SCREENSHOTS.tutorial);
    const n0 = await eventCount();
    await advance(25);
    const clock = await ev(F.clock);
    assert(clock === 0, 'clock ' + clock + ' after advance(25), wanted 0');
    assert((await eventsSince(n0, EVENT.gateSoon)).length === 0, EVENT.gateSoon + ' fired with the clock held');
    await liveBreath();
    return 'cash ' + s.cash + ', status ' + describe(status) + ', banner ' + describe(bn.lines) + ', clock held at 0';
  }, { fatal: true });

  await step('fire raised', async () => {
    await expectStep('charcoal', 'pile', 'before the pile');
    const a = await goto('pile', hasKind(CARRY_KIND.charcoal));
    assert(a.ok, 'not carrying charcoal after the pile; carrying ' + describe(await ev(F.carrying)));
    await advance(0);
    await expectStep('light', 'kettle1', 'before the light');
    await liveBreath();
    const b = await goto('kettle1', F.fire('kettle1') + ' >= C.' + C_NAMES.fireLight + ' - 1');
    const fire = await ev(F.fire('kettle1'));
    assert(b.ok, 'kettle 1 fire is ' + fire);
    await advance(0);
    await expectStep('meat', undefined, 'after the light');
    await liveBreath();
    return 'fire ' + Math.round(fire) + ' (' + a.how + ', ' + b.how + ')';
  }, { fatal: true });

  await step('meat on', async () => {
    await expectStep('meat', 'cooler', 'before the cooler');
    const a = await goto('cooler', hasKind(CARRY_KIND.raw) + ' && ' + F.carrying + '.meat === ' + JSON.stringify(MEAT));
    assert(a.ok, 'not carrying raw ' + MEAT + '; carrying ' + describe(await ev(F.carrying)));
    await advance(0);
    await expectStep('puton', 'kettle1', 'before the put on');
    await liveBreath();
    const b = await goto('kettle1', F.pieces('kettle1') + '.length >= 1');
    assert(b.ok, 'kettle 1 has no piece');
    await advance(0);
    // v2.1: one unit only while the tutorial runs; the second goes on in step 29.
    if ((await tut()) === null && (await ev(F.stock + '.' + MEAT + ' > 0'))) {
      const c = await goto('cooler', hasKind(CARRY_KIND.raw));
      if (c.ok) await goto('kettle1', F.pieces('kettle1') + '.length >= 2');
    } else {
      await expectStep('cook', null, 'after the put on');
    }
    await liveBreath();
    return (await ev(F.pieces('kettle1') + '.length')) + ' piece(s) on kettle 1, step cook with no target';
  }, { fatal: true });

  await step('piece done', async () => {
    let ok;
    if (await tut()) {
      // The tutorial floor keeps the fire at 30 or more, so no feeding (feeding would walk the
      // tutorial back to the light step and break the in order check of step 28).
      const r = await until(anyPiece(PIECE_STATE.done), WAIT_S.cook);
      ok = r.ok;
    } else ok = await waitForDone();
    const states = await ev(F.pieces('kettle1') + '.map((p) => p.state + "@" + Math.round(p.prog))');
    assert(ok, 'no piece reached done; pieces ' + describe(states) + ', fire ' + (await ev(F.fire('kettle1'))));
    const done = await eventsOfType(EVENT.pieceDone);
    assert(done.length >= 1, 'no ' + EVENT.pieceDone + ' event');
    await advance(0);
    await expectStep('cook', 'kettle1', 'at done');
    await screenshot(SCREENSHOTS.tutorialCook);
    const n0 = await eventCount();
    await advance(20);
    const p = await ev(F.pieces('kettle1') + '.map((x) => ({ state: x.state, warn: x.warn }))');
    assert(p.length >= 1 && p.every((x) => x.state === PIECE_STATE.done && x.warn === false), 'after advance(20) the pieces are ' + describe(p));
    assert((await eventsSince(n0, EVENT.burnWarning)).length === 0, EVENT.burnWarning + ' fired during the tutorial');
    const fire = await ev(F.fire('kettle1'));
    const floor = await ev('C.' + C_NAMES.fireFloor);
    assert(fire >= floor, 'kettle1.fire ' + fire + ' under the tutorial floor ' + floor);
    await liveBreath();
    return 'done, held 20 s, fire ' + Math.round(fire) + ', clock ' + (await ev(F.clock));
  }, { fatal: true });

  await step('sliced', async () => {
    const t0 = await tut();
    if (t0) assert(t0.target === 'kettle1', 'the pull target is ' + describe(t0.target));
    const a = await goto('kettle1', hasKind(CARRY_KIND.cooked));
    assert(a.ok, 'did not pull the done piece; carrying ' + describe(await ev(F.carrying)));
    await advance(0);
    if (t0) await expectStep('slice', 'board', 'after the pull');
    await liveBreath();
    const b = await goto('board', F.busy + ' !== null || ' + boardHasPlates + ' || ' + hasKind(CARRY_KIND.plates));
    assert(b.ok, 'slice did not start at the board');
    const r = await until('(' + boardHasPlates + ' || ' + hasKind(CARRY_KIND.plates) + ') && ' + F.busy + ' === null', WAIT_S.slice);
    assert(r.ok, 'slice did not finish within ' + WAIT_S.slice + 's');
    const sliced = await eventsOfType(EVENT.sliceDone);
    assert(sliced.length >= 1, 'no ' + EVENT.sliceDone + ' event');
    await advance(0);
    if (t0) await expectStep('plate', 'table', 'after slice_done');
    await liveBreath();
    return sliced[0].plates + ' plates sliced; board ' + (await ev(F.boardStacks + '.reduce((a, st) => a + st.times.length, 0)')) + ', in hand ' + (await ev(F.carrying + ' ? ' + F.carrying + '.times.length : 0'));
  }, { fatal: true });

  await step('carried', async () => {
    const a = await goto('board', hasKind(CARRY_KIND.plates));
    assert(a.ok, 'did not pick up plates; carrying ' + describe(await ev(F.carrying)));
    return (await ev(F.carrying + '.times.length')) + ' plate(s) in hand';
  }, { fatal: true });

  await step('served with cash up and a served event', async () => {
    const t0 = await tut();
    if (t0) assert(t0.id === 'plate' && t0.target === 'table', 'the plate target is ' + describe(t0));
    const nSet = await eventCount();
    const a = await goto('table', tableHas(MEAT));
    assert(a.ok, 'plate did not land on the table');
    const setDown = await eventsOfType(EVENT.setDown);
    assert(setDown.length >= 1, 'no ' + EVENT.setDown + ' event');
    let custId = null, tnote = '';
    if (t0) {
      // v2.1 step i: right after the set down, the gate opens on the plate and customer 1 walks in.
      const evs = await eventsFrom(nSet);
      const iSet = evs.findIndex((e) => e.type === EVENT.setDown);
      const iStep = evs.findIndex((e) => e.type === EVENT.tutorialStep && e.id === 'customer');
      const iGate = evs.findIndex((e) => e.type === EVENT.gateOpen);
      const iArr = evs.findIndex((e) => e.type === EVENT.customerArrived);
      assert(iSet >= 0 && iStep > iSet && iGate > iStep && iArr > iGate, 'events after the set down ' + describe(evs.map((e) => e.type + (e.id !== undefined ? ':' + e.id : ''))));
      const gateOpens = await ev('C.' + C_NAMES.gateOpens);
      assert(nearly(evs[iGate].at, gateOpens, 0.1), EVENT.gateOpen + ' at clock ' + evs[iGate].at + ', wanted ' + gateOpens + ' (deviation 5)');
      assert(await ev(F.clock + ' >= C.' + C_NAMES.gateOpens), 'clock ' + (await ev(F.clock)) + ' under GATE_OPENS after the plate');
      const opens = await eventsOfType(EVENT.gateOpen);
      assert(opens.length === 1, opens.length + ' ' + EVENT.gateOpen + ' events on day 1');
      const arr = evs[iArr];
      assert(arr.id === 1 && arr.meat === MEAT, 'first customer_arrived ' + describe(arr));
      custId = arr.id;
      await advance(0);
      const t1 = await tut();
      assert(t1 && (t1.id === 'customer' || t1.id === 'seated'), 'step after the set down ' + describe(t1));
      await screenshot(SCREENSHOTS.tutorialCustomer);
      tnote = '; gate open at ' + evs[iGate].at + ', banner ' + describe((await banner()) && (await banner()).lines);
      await liveBreath();
    }
    // Carry any plate still on the board while the first one waits for a customer.
    for (let i = 0; i < 3 && (await ev(boardHasPlates)); i++) {
      const p = await goto('board', hasKind(CARRY_KIND.plates));
      if (!p.ok) break;
      await goto('table', F.carrying + ' === null');
    }
    const cashBefore = await ev(F.cash);
    const servedBefore = await ev(F.today + '.served');
    let r = await until(F.today + '.served >= 1 || !(' + inService + ')', WAIT_S.serve);
    if (!(await ev(F.today + '.served >= 1'))) {
      // Serving may need the player at the table; try once more from there.
      await goto('table', 'true');
      r = await until(F.today + '.served >= 1 || !(' + inService + ')', WAIT_S.serveRetry);
    }
    await advance(0);
    const served = await eventsOfType(EVENT.served);
    const cash = await ev(F.cash);
    assert(served.length >= 1, 'no ' + EVENT.served + ' event after ' + r.t + 's; customers ' + describe(await ev(F.customers + '.map((c) => c.want + ":" + c.mode)')));
    assert(cash > cashBefore || servedBefore >= 1, 'cash ' + cash + ' not above ' + cashBefore);
    const e = served[0];
    if (custId !== null) assert(e.id === custId, 'the first served event is for customer ' + e.id + ', wanted ' + custId);
    const spots = await ev('MAP.station("table").spotPx');
    assert(Array.isArray(spots) && spots.some((sp) => sp.x === e.x && sp.y === e.y), 'served at (' + e.x + ',' + e.y + ') is not a spotPx ' + describe(spots));
    const fx = await fxLog();
    const queue = await ev('MAP.queue.map((q) => ({ x: q.x, y: q.y }))');
    const overQueue = (f) => queue.some((q) => f.y === q.y * TILE_PX - CASH_ABOVE && f.x >= q.x * TILE_PX - 9 && f.x <= q.x * TILE_PX + 16);
    const cashFx = fx.find((f) => f.kind === FX_KIND.cash && overQueue(f));
    assert(cashFx, 'fxLog has no ' + FX_KIND.cash + ' over a queue spot (py - ' + CASH_ABOVE + '); cash entries ' + describe(fx.filter((f) => f.kind === FX_KIND.cash)));
    captures.midService = await captureFrame();
    await screenshot(SCREENSHOTS.midService);
    return 'cash ' + cashBefore + ' to ' + cash + ', tip ' + e.tip + ', plate spot (' + e.x + ',' + e.y + ')' + tnote;
  }, { fatal: true });

  let tutorialRan = false;
  await step('a served customer sits and a heart fires', async () => {
    const first = (await eventsOfType(EVENT.served))[0];
    assert(first, 'no served event to follow');
    const cid = first.id;
    const taken = (await eventsOfType(EVENT.seatTaken)).find((e) => e.id === cid);
    const togo = (await eventsOfType(EVENT.toGo)).find((e) => e.id === cid);
    assert(taken, 'no ' + EVENT.seatTaken + ' for customer ' + cid + (togo ? '; got ' + EVENT.toGo : ''));
    assert(taken.seat === FIRST_SEAT.id, EVENT.seatTaken + ' seat ' + describe(taken.seat) + ', wanted ' + FIRST_SEAT.id);
    const cust = (expr) => F.customers + '.some((c) => c.id === ' + cid + ' && ' + expr + ')';
    const eat = await until(cust('c.mode === ' + JSON.stringify(MODE.eating) + ' && c.x === ' + FIRST_SEAT.x + ' && c.y === ' + FIRST_SEAT.y), WAIT_S.toEating);
    assert(eat.ok, 'customer ' + cid + ' not eating on (' + FIRST_SEAT.x + ',' + FIRST_SEAT.y + ') within ' + WAIT_S.toEating + 's; ' + describe(await ev(F.customers + '.filter((c) => c.id === ' + cid + ').map((c) => ({ mode: c.mode, x: c.x, y: c.y, seat: c.seat }))')));
    await advance(0);
    await screenshot(SCREENSHOTS.seated);
    const maxEat = (await ev('C.' + C_NAMES.eatMax)) + WAIT_S.eatSlack;
    const doneExpr = 'globalThis.__smoke.events.some((e) => e.type === ' + JSON.stringify(EVENT.seatDone) + ' && e.id === ' + cid + ')';
    const d = await until(doneExpr, maxEat);
    assert(d.ok, 'no ' + EVENT.seatDone + ' within ' + maxEat + 's of sitting');
    await advance(0);
    const sd = (await eventsOfType(EVENT.seatDone)).find((e) => e.id === cid);
    assert(sd.bonus === FIRST_SEAT.bonus, 'bonus ' + sd.bonus);
    assert(sd.atClose === false, 'atClose ' + sd.atClose);
    assert(sd.x === FIRST_SEAT.px && sd.y === FIRST_SEAT.py, 'seat_done at (' + sd.x + ',' + sd.y + ')');
    assert(sd.seat === FIRST_SEAT.id, 'seat_done seat ' + describe(sd.seat));
    const fx = await fxLog();
    const heart = fx.find((f) => f.kind === FX_KIND.heart && f.x === FIRST_SEAT.heart.x && f.y === FIRST_SEAT.heart.y);
    assert(heart, 'fxLog has no heart at (' + FIRST_SEAT.heart.x + ',' + FIRST_SEAT.heart.y + '); hearts ' + describe(fx.filter((f) => f.kind === FX_KIND.heart)));
    assert(fx.some((f) => f.kind === FX_KIND.seatTip), 'fxLog has no ' + FX_KIND.seatTip);
    // v2.1: step seated after served, step end after seat_done.
    const all = await allEvents();
    const iServed = all.findIndex((x) => x.type === EVENT.served && x.id === cid);
    const iSeated = all.findIndex((x) => x.type === EVENT.tutorialStep && x.id === 'seated');
    const iSeatDone = all.findIndex((x) => x.type === EVENT.seatDone && x.id === cid);
    const iEnd = all.findIndex((x) => x.type === EVENT.tutorialStep && x.id === 'end');
    tutorialRan = all.some((x) => x.type === EVENT.tutorialStep);
    if (tutorialRan) {
      assert(iSeated > iServed, 'tutorial_step seated at ' + iSeated + ', served at ' + iServed);
      assert(iEnd > iSeatDone, 'tutorial_step end at ' + iEnd + ', seat_done at ' + iSeatDone);
    }
    const lv = await until(cust('c.mode === ' + JSON.stringify(MODE.leaving) + ' && c.reason === ' + JSON.stringify(REASON.seated)) + ' && ' + F.seats + '.' + FIRST_SEAT.id + ' === null', WAIT_S.toLeaving);
    assert(lv.ok, 'customer ' + cid + ' not leaving seated with the seat freed within ' + WAIT_S.toLeaving + 's; seats ' + describe(await ev(F.seats)));
    return 'customer ' + cid + ' sat ' + eat.t + 's after the serve, ate ' + d.t + 's, left ' + lv.t + 's later' + (tutorialRan ? '; steps seated and end in place' : '');
  });

  await step('tutorial walked in order', async () => {
    const endS = await ev('C.' + C_NAMES.tutorialEnd);
    const r = await until('globalThis.__smoke.events.some((e) => e.type === ' + JSON.stringify(EVENT.tutorialDone) + ')', endS + 1);
    assert(r.ok, 'no ' + EVENT.tutorialDone + ' within ' + (endS + 1) + ' s');
    await advance(0);
    const all = await allEvents();
    const iDone = all.findIndex((e) => e.type === EVENT.tutorialDone);
    assert(all[iDone].skipped === false, 'tutorial_done skipped ' + describe(all[iDone].skipped));
    const steps = all.filter((e) => e.type === EVENT.tutorialStep);
    const ids = distinctRuns(steps.map((e) => e.id));
    assert(sameJSON(ids, TUTORIAL_ORDER) || sameJSON(ids, TUTORIAL_ORDER.slice(1)), 'tutorial_step ids ' + describe(ids));
    const cookTargets = steps.filter((e) => e.id === 'cook').map((e) => e.target);
    assert(sameJSON(cookTargets, [null, 'kettle1']), 'cook targets ' + describe(cookTargets));
    for (const e of steps) assert(e.text === TUTORIAL_TEXT[e.id], 'tutorial_step ' + e.id + ' text ' + describe(e.text));
    const bn = await banner();
    assert(bn === null, 'banner after the tutorial ' + describe(bn));
    const ar = arrows(await captureFrame());
    assert(ar.length === 0, 'arrow drawn after the tutorial: ' + describe(ar));
    const before = all.slice(0, iDone).filter((e) => e.day === 1 && [EVENT.burnWarning, EVENT.walkOut, EVENT.fireLow].includes(e.type));
    assert(before.length === 0, 'during the tutorial: ' + describe(before.map((e) => e.type)));
    // #live spoke every step from charcoal on (deviation 8: poll real time for the queue).
    const want = TUTORIAL_ORDER.slice(1).map((id) => TUTORIAL_TEXT[id]);
    let missing = want;
    const deadline = Date.now() + LIVE_POLL_MS;
    while (Date.now() < deadline) {
      await advance(0);
      const spoken = await liveTexts();
      missing = want.filter((t) => !spoken.includes(t));
      if (missing.length === 0) break;
      await sleep(500);
    }
    assert(missing.length === 0, '#live never said ' + describe(missing) + '; it said ' + describe((await liveTexts()).slice(0, 30)));
    return 'steps ' + ids.join(' ') + '; cook targets ' + describe(cookTargets) + '; #live spoke all ' + want.length;
  });

  await step('rest of the day cooked and carried', async () => {
    let cycles = 0;
    let loaded = 0;
    // v2.1: the tutorial put one unit on (step 22); the second goes on here.
    if ((await ev(inService)) && (await ev(F.stock + '.' + MEAT + ' > 0')) && (await ev(F.carrying + ' === null'))) {
      await feedFireIfLow();
      const c = await goto('cooler', hasKind(CARRY_KIND.raw));
      if (c.ok) {
        const k = await goto('kettle1', F.carrying + ' === null');
        if (k.ok) loaded += 1;
      }
    }
    for (let i = 0; i < PLATE_CYCLES_MAX + 2; i++) {
      if (!(await ev(inService))) break;
      const hasDone = await ev(anyPiece(PIECE_STATE.done));
      const hasCooking = await ev(anyPiece(PIECE_STATE.cooking));
      if (hasDone && (await ev(F.carrying + ' === null'))) {
        const a = await goto('kettle1', hasKind(CARRY_KIND.cooked));
        if (!a.ok) break;
        await goto('board', F.busy + ' !== null || ' + boardHasPlates);
        await until('(' + boardHasPlates + ' || ' + hasKind(CARRY_KIND.plates) + ') && ' + F.busy + ' === null', WAIT_S.slice);
        if (await ev(hasKind(CARRY_KIND.plates))) await goto('table', F.carrying + ' === null');
        for (let j = 0; j < 3 && (await ev(boardHasPlates)); j++) {
          const p = await goto('board', hasKind(CARRY_KIND.plates));
          if (!p.ok) break;
          await goto('table', F.carrying + ' === null');
        }
        cycles += 1;
      } else if (hasCooking) {
        await waitForDone();
      } else break;
    }
    return loaded + ' unit(s) put on, ' + cycles + ' extra plate cycle(s)';
  });

  await step('day over', async () => {
    const r = await until(F.phase + ' === ' + JSON.stringify(PHASE.evening), WAIT_S.day);
    assert(r.ok, 'phase still ' + (await ev(F.phase)) + ' after ' + r.t + 's');
    await advance(0);
    const over = await eventsOfType(EVENT.dayOver);
    assert(over.length === 1, EVENT.dayOver + ' events: ' + over.length);
    assert(await ev(F.till + ' !== null'), 'till is null');
    const seats = await ev(F.seats);
    assert(seats && SEAT_IDS.every((id) => seats[id] === null), 'state.seats after the till ' + describe(seats));
    const sitting = await ev(F.customers + '.filter((c) => c.mode === ' + JSON.stringify(MODE.toSeat) + ' || c.mode === ' + JSON.stringify(MODE.eating) + ').length');
    assert(sitting === 0, sitting + ' customer(s) still in toSeat or eating');
    return 'day ' + (await ev(F.day));
  }, { fatal: true });

  await step('a walk-out with rep down, or the day sold out early', async () => {
    const t = await ev(F.till);
    const k = await ev('({ q: C.' + C_NAMES.repQuick + ', o: C.' + C_NAMES.repOk + ', tq: C.' + C_NAMES.repTogoQuick + ', min: C.' + C_NAMES.repDayMin + ', ds: C.' + C_NAMES.daySeconds + ' })');
    const outs = await eventsOfType(EVENT.walkOut);
    const positive = t.happy * k.q + (t.togoQuick | 0) * k.tq + t.ok * k.o;
    const clamped = Math.min(Math.max(positive, k.min), t.repMax);
    if (outs.length === 0) {
      // Sold out ends the day (sim.js deviation 8): nothing left anywhere, so nobody could walk out.
      const over = (await eventsOfType(EVENT.dayOver))[0];
      const stockLeft = await ev('Object.values(' + F.stock + ').reduce((a, b) => a + b, 0)');
      assert(over && over.at < k.ds, 'no walk-out and the day ran the full ' + k.ds + 's; till customers ' + t.customers + ', served ' + t.served + ', past ' + t.past + ', close ' + t.close);
      assert(t.walkouts === 0, 'till.walkouts is ' + t.walkouts + ' with no walk_out event');
      assert(stockLeft === 0, 'stock left ' + stockLeft + ' after an early day end');
      assert(t.repDelta === clamped, 'repDelta ' + t.repDelta + ' differs from the serve credit ' + positive + ' (clamped ' + clamped + ') with no walk-out');
      return 'sold out at ' + over.at + 's, ' + t.served + ' served, repDelta ' + t.repDelta;
    }
    assert(t.walkouts >= 1, 'till.walkouts is ' + t.walkouts);
    assert(t.repDelta < clamped, 'repDelta ' + t.repDelta + ' is not below the serve credit ' + positive + ' (clamped ' + clamped + ')');
    return outs.length + ' walk-out(s), repDelta ' + t.repDelta + ' (serve credit ' + positive + ', happy ' + t.happy + ', togoQuick ' + t.togoQuick + ', ok ' + t.ok + ')';
  });

  await step('till shown', async () => {
    await advance(0);
    assert(await visible(ID.till), '#till hidden');
    const h = await text(ID.tillH);
    assert(h === TEXT.tillHeading(1), '#till-h is ' + describe(h));
    const body = await text(ID.tillBody);
    assert(body.includes(TEXT.seatTipsRow), '#till-body has no ' + describe(TEXT.seatTipsRow) + ' row');
    const t = await ev(F.till);
    const daily = await ev('C.' + C_NAMES.dailyCosts);
    const want = t.revenue + t.tips + t.seatTips - t.wages - daily;
    assert(t.net === want, 'till.net ' + t.net + ', wanted ' + want);
    await screenshot(SCREENSHOTS.till);
    return 'served ' + t.served + ', seated ' + t.seated + ', revenue ' + t.revenue + ', tips ' + t.tips + ', seat tips ' + t.seatTips + ', net ' + t.net + ', cash ' + t.cashAfter;
  });

  let savedCash = null;
  await step('save key present and valid', async () => {
    const r = await run('const raw = localStorage.getItem(' + JSON.stringify(SAVE_KEY) + '); let parsed = null; try { parsed = JSON.parse(raw); } catch (e) { return { raw, error: String(e) }; } return { raw: !!raw, parsed, v: ' + GLOBAL_NAME + '.validateSave(parsed), cash: ' + F.cash + ', day: ' + F.day + ' };');
    assert(r.raw, SAVE_KEY + ' missing');
    assert(!r.error, 'save is not JSON: ' + r.error);
    assert(r.v, 'validateSave returned null');
    assert(r.v.day === 2 && r.day === 2, 'save day ' + r.v.day + ', state day ' + r.day);
    assert(r.v.cash === r.cash, 'save cash ' + r.v.cash + ', state cash ' + r.cash);
    assert(r.parsed.v === 3, 'raw save v is ' + describe(r.parsed.v));
    assert(r.parsed.tutorial && r.parsed.tutorial.done === true, 'raw save tutorial is ' + describe(r.parsed.tutorial));
    assert(r.parsed.decor && typeof r.parsed.decor === 'object', 'raw save has no decor');
    assert(r.parsed.stats && r.parsed.stats.seated >= 1, 'raw save stats.seated is ' + describe(r.parsed.stats && r.parsed.stats.seated));
    savedCash = r.cash;
    return 'day ' + r.v.day + ', cash ' + r.v.cash + ', seated ' + r.parsed.stats.seated + ', v 3, tutorial done';
  });

  const before = await probeMetrics().catch(() => ({ bored: 0, boredPrep: 0, service: 0, events: 0 }));
  const eventsDay1 = await run('return globalThis.__smoke.events;').catch(() => []);

  await step('reload persists', async () => {
    await reload();
    const s = await ev('({ phase: ' + F.phase + ', day: ' + F.day + ', cash: ' + F.cash + ', tutorial: S().tutorial })');
    assert(s.phase === PHASE.morning, 'phase ' + s.phase);
    assert(s.day === 2, 'day ' + s.day);
    assert(savedCash === null || s.cash === savedCash, 'cash ' + s.cash + ', saved ' + savedCash);
    assert(await visible(ID.clipboard), '#clipboard hidden on day 2');
    assert(await ev('!!$(' + JSON.stringify(ID.hireBuddy) + ') && !$(' + JSON.stringify(ID.hireBuddy) + ').disabled'), '#hire-buddy missing or disabled on day 2');
    assert(s.tutorial && s.tutorial.done === true, 'state.tutorial on day 2 ' + describe(s.tutorial));
    assert(!(await present(ID.tutClip)), '#tut-clip present on day 2');
    return 'day 2, cash ' + s.cash + ', tutorial done';
  }, { fatal: true });

  await step('decor purchase shows the sprite', async () => {
    const startRep = await ev('C.' + C_NAMES.startRep);
    await reload(saveV2({ day: DECOR_SAVE.day, cash: DECOR_SAVE.cash }, startRep));
    const s = await ev('({ phase: ' + F.phase + ', day: ' + F.day + ', cash: ' + F.cash + ' })');
    assert(s.phase === PHASE.morning && s.day === DECOR_SAVE.day && s.cash === DECOR_SAVE.cash, 'seeded save loaded as ' + describe(s));
    const n0 = await eventCount();
    await click(ID.buy(DECOR_BUY.id));
    await advance(0);
    const bought = (await eventsSince(n0, EVENT.purchase)).filter((e) => e.kind === 'decor');
    assert(bought.length === 1 && bought[0].id === DECOR_BUY.id, 'decor purchase events ' + describe(bought));
    assert(await ev(F.decor + '.' + DECOR_BUY.id + ' === true'), 'state.decor.' + DECOR_BUY.id + ' is not true');
    const seats = await text(ID.seats);
    const want = TEXT.seats(...DECOR_BUY.seatsAfter);
    assert(seats === want, '#seats is ' + describe(seats) + ', wanted ' + describe(want));
    await advance(0);
    const frame = await captureFrame();
    assert(hasRecord(frame, DECOR_BUY.draw), 'captureFrame has no ' + describe(DECOR_BUY.draw));
    assert(!outlineAt(frame, DECOR_BUY.outlineGone), 'the ' + OUTLINE + ' at ' + describe(DECOR_BUY.outlineGone) + ' is still drawn');
    const stored = await run('try { const raw = JSON.parse(localStorage.getItem(' + JSON.stringify(SAVE_KEY) + ')); return { raw: raw && raw.v, v: ' + GLOBAL_NAME + '.validateSave(raw) }; } catch (e) { return { error: String(e) }; }');
    assert(stored && stored.v && stored.v.decor && stored.v.decor[DECOR_BUY.id] === true, 'stored save decor ' + describe(stored && ((stored.v && stored.v.decor) || stored.error)));
    assert(stored.v.v === 3, 'stored save validates as v ' + describe(stored.v.v));
    assert(stored.raw === 3, 'stored raw save v ' + describe(stored.raw));
    await screenshotYard(SCREENSHOTS.decor);
    return seats + ' cash ' + (await ev(F.cash)) + ', stored v 3';
  });

  await step('v1 save migrates', async () => {
    await reload(SAVE_V1_SAMPLE);
    await advance(0);
    const s = await ev('({ phase: ' + F.phase + ', day: ' + F.day + ', cash: ' + F.cash + ', rep: ' + F.rep + ', stock: ' + F.stock + ', charcoal: ' + F.charcoal + ', gear: ' + F.gear + ', hires: ' + F.hires + ', decor: ' + F.decor + ' })');
    assert(s.phase === PHASE.morning, 'phase ' + s.phase);
    for (const k of ['day', 'cash', 'rep', 'stock', 'charcoal', 'gear', 'hires']) {
      assert(sameJSON(s[k], SAVE_V1_SAMPLE[k]), k + ' is ' + describe(s[k]) + ', wanted ' + describe(SAVE_V1_SAMPLE[k]));
    }
    assert(s.decor && DECOR_IDS.every((d) => s.decor[d] === false), 'decor ' + describe(s.decor));
    const status = await text(ID.status);
    assert(status === TEXT.notice, '#status is ' + describe(status) + ', wanted ' + describe(TEXT.notice));
    const raw = await run('try { return JSON.parse(localStorage.getItem(' + JSON.stringify(SAVE_KEY) + ')); } catch (e) { return null; }');
    assert(raw && raw.v === 3, 'stored save v is ' + describe(raw && raw.v));
    assert(raw.tutorial && raw.tutorial.done === true, 'stored save tutorial ' + describe(raw.tutorial));
    return 'day ' + s.day + ', cash ' + s.cash + ', rep ' + s.rep + ', stored v ' + raw.v + ', tutorial done';
  });

  await step('v2 save loads with the tutorial done', async () => {
    const startRep = await ev('C.' + C_NAMES.startRep);
    await reload(saveV2({ day: 1, cash: 80, charcoal: 5, stock: { sausage: 3 } }, startRep));
    await advance(0);
    const s = await ev('({ phase: ' + F.phase + ', day: ' + F.day + ', tutorial: S().tutorial })');
    assert(s.phase === PHASE.morning && s.day === 1, 'loaded as ' + describe(s));
    assert(deepEq(s.tutorial, { step: null, done: true }), 'state.tutorial ' + describe(s.tutorial));
    assert((await tut()) === null, 'tutorialStep() ' + describe(await tut()));
    for (const id of [ID.tutClip, ID.tutSkip]) assert(!(await present(id)), '#' + id + ' present after a v2 save');
    assert((await anyPulse()) === 0, PULSE + ' on ' + (await anyPulse()) + ' element(s)');
    assert(await hintShown(), 'the day 1 hint is missing with the tutorial done');
    const status = await text(ID.status);
    assert(status !== TEXT.notice, '#status shows the v1 notice for a v2 save');
    if (await ev('$(' + JSON.stringify(ID.open) + ').disabled')) await shop(BUY_LATER);
    await click(ID.open);
    await until('false', WAIT_S.afterOpen);
    await advance(0);
    assert(await ev(inService), 'the yard did not open; phase ' + (await ev(F.phase)));
    const st2 = await text(ID.status);
    assert(st2.startsWith(TEXT.gateOpensIn), '#status is ' + describe(st2) + ', wanted the gate countdown');
    assert((await banner()) === null, 'banner ' + describe(await banner()));
    const ar = arrows(await captureFrame());
    assert(ar.length === 0, 'arrow drawn with the tutorial done: ' + describe(ar));
    const ser = await ev('sim.' + SIM_METHODS.serialize + '()');
    assert(ser.v === 3 && ser.tutorial && ser.tutorial.done === true, 'serialize() ' + describe({ v: ser.v, tutorial: ser.tutorial }));
    return 'v2 day 1 save: no tutorial, hint shown, ' + describe(st2);
  });

  await step('skip tutorial', async () => {
    // Step 37 left the yard open.
    await keyPress(KEYS.escape);
    await advance(0);
    assert(await visible(ID.pause), '#pause not visible after Escape');
    await newGame(ID.pauseNew);
    const s = await ev('({ phase: ' + F.phase + ', day: ' + F.day + ' })');
    assert(s.phase === PHASE.morning && s.day === 1, 'new game is ' + describe(s));
    await expectStep('open', 'open', 'new game');
    assert(await visible(ID.tutSkip), '#tut-skip not visible on a new game');
    const n0 = await eventCount();
    await click(ID.tutSkip);
    await advance(0);
    const dn = await eventsSince(n0, EVENT.tutorialDone);
    assert(dn.length === 1 && dn[0].skipped === true, 'tutorial_done after #tut-skip ' + describe(dn));
    for (const id of [ID.tutSkip, ID.tutClip]) assert(!(await visible(id)), '#' + id + ' still shown after the skip');
    assert(!(await hasPulse(ID.open)), '#open still has ' + PULSE);
    assert(await hintShown(), 'the day 1 hint is missing after the skip');
    const stored = await run('try { return ' + GLOBAL_NAME + '.validateSave(JSON.parse(localStorage.getItem(' + JSON.stringify(SAVE_KEY) + '))); } catch (e) { return null; }');
    assert(stored && stored.tutorial && stored.tutorial.done === true, 'stored save after the skip ' + describe(stored && stored.tutorial));
    // Skip from the pause panel in service.
    await newGame(ID.clipNew);
    await expectStep('open', 'open', 'second new game');
    if (await ev('$(' + JSON.stringify(ID.open) + ').disabled')) await shop(BUY_DAY1);
    await click(ID.open);
    await until('false', WAIT_S.afterOpen);
    await advance(0);
    assert(await ev(inService), 'the yard did not open; phase ' + (await ev(F.phase)));
    await keyPress(KEYS.escape);
    await advance(0);
    assert(await visible(ID.pause), '#pause not visible after Escape');
    assert(await visible(ID.pauseSkip), '#pause-skip not visible while the tutorial runs');
    assert(!(await visible(ID.howto)), '#howto visible beside the pause panel');
    const n1 = await eventCount();
    await click(ID.pauseSkip);
    await advance(0);
    const dn2 = await eventsSince(n1, EVENT.tutorialDone);
    assert(dn2.length === 1 && dn2[0].skipped === true, 'tutorial_done after #pause-skip ' + describe(dn2));
    assert(!(await visible(ID.pauseSkip)), '#pause-skip still shown after the skip');
    assert(await visible(ID.pause) && (await ev(F.paused + ' === true')), 'not paused after #pause-skip');
    await click(ID.resume);
    await advance(0);
    assert(await ev(F.paused + ' === false'), 'still paused after #resume');
    const n2 = await eventCount();
    await until('false', 31);
    const soon = (await eventsSince(n2, EVENT.gateSoon))[0];
    const open = (await eventsSince(n2, EVENT.gateOpen))[0];
    const go = await ev('C.' + C_NAMES.gateOpens);
    assert(soon && nearly(soon.at, go - 10, 0.1), EVENT.gateSoon + ' at ' + (soon && soon.at) + ', wanted ' + (go - 10) + ' (deviation 5)');
    assert(open && nearly(open.at, go, 0.1), EVENT.gateOpen + ' at ' + (open && open.at) + ', wanted ' + go + ' (deviation 5)');
    assert((await banner()) === null, 'banner after the pause skip ' + describe(await banner()));
    return 'clipboard skip and pause skip; gate_soon ' + soon.at + ', gate_open ' + open.at;
  });

  await step('burn warning in the page', async () => {
    assert(await ev(inService), 'not in service; phase ' + (await ev(F.phase)));
    assert((await tut()) === null, 'the tutorial is running on the skipped day');
    const a = await goto('pile', hasKind(CARRY_KIND.charcoal));
    assert(a.ok, 'pile: carrying ' + describe(await ev(F.carrying)));
    const b = await goto('kettle1', F.fire('kettle1') + ' >= C.' + C_NAMES.fireLight + ' - 1');
    assert(b.ok, 'kettle 1 fire ' + (await ev(F.fire('kettle1'))));
    assert(await ev(F.stock + '.' + MEAT + ' > 0'), 'no ' + MEAT + ' in stock on the skipped day: ' + describe(await ev(F.stock)));
    const c = await goto('cooler', hasKind(CARRY_KIND.raw) + ' && ' + F.carrying + '.meat === ' + JSON.stringify(MEAT));
    assert(c.ok, 'cooler: carrying ' + describe(await ev(F.carrying)));
    const d = await goto('kettle1', F.pieces('kettle1') + '.length >= 1');
    assert(d.ok, 'kettle 1 has no piece');
    const nDone = await eventCount();
    assert(await waitForDone(), 'no piece_done; pieces ' + describe(await ev(F.pieces('kettle1'))));
    const good = await ev('C.' + C_NAMES.fireGood);
    if ((await ev(F.fire('kettle1'))) < good + 15 && (await ev(F.carrying + ' === null && ' + F.charcoal + ' > 0'))) {   // deviation 11
      await goto('pile', hasKind(CARRY_KIND.charcoal));
      await goto('kettle1', F.carrying + ' === null');
    }
    const w = await until('globalThis.__smoke.events.slice(' + nDone + ').some((e) => e.type === ' + JSON.stringify(EVENT.burnWarning) + ')', WAIT_S.burnPage);
    assert(w.ok, 'no ' + EVENT.burnWarning + ' within ' + WAIT_S.burnPage + ' s; pieces ' + describe(await ev(F.pieces('kettle1'))) + ', fire ' + (await ev(F.fire('kettle1'))));
    const warnEv = (await eventsSince(nDone, EVENT.burnWarning))[0];
    if ((await ev('sim.reach()')) !== 'kettle1') {
      await ev('sim.' + SIM_METHODS.walkTo + '(5, 3)');
      await settle();
      await ev('sim.move("up")');
    }
    await advance(0);
    const act = await text(ID.act);
    assert(act === PULL_NOW, '#act is ' + describe(act) + ', wanted ' + describe(PULL_NOW));
    const frame = await captureFrame();
    captures.warning = frame;
    assert(hasRecord(frame, WARN_DRAW.piece), 'no ' + describe(WARN_DRAW.piece) + '; pieces drawn ' + describe(frame.filter((x) => x.name.startsWith('piece_'))));
    assert(hasRecord(frame, WARN_DRAW.bubble), 'no ' + describe(WARN_DRAW.bubble) + '; bubbles drawn ' + describe(frame.filter((x) => x.name === 'bubble_warn')));
    await advance(1);
    const frame2 = await captureFrame();
    const sm = WARN_DRAW.smoke;
    assert(frame2.some((x) => x.name === sm.name && x.x >= sm.xMin && x.x <= sm.xMax && x.y <= sm.yMax), 'no ' + sm.name + ' over kettle 1; dark smoke ' + describe(frame2.filter((x) => x.name === sm.name)));
    const fx = await fxLog();
    assert(fx.some((f) => f.kind === FX_KIND.warn && f.x === WARN_DRAW.bubble.x && f.y === WARN_DRAW.bubble.y), 'fxLog has no warn at (' + WARN_DRAW.bubble.x + ',' + WARN_DRAW.bubble.y + '); warn entries ' + describe(fx.filter((f) => f.kind === FX_KIND.warn)));
    await screenshot(SCREENSHOTS.warning);
    const nPull = await eventCount();
    const p = await goto('kettle1', hasKind(CARRY_KIND.cooked) + ' && ' + F.carrying + '.meat === ' + JSON.stringify(MEAT));
    assert(p.ok, 'the pull in the warning stage gave ' + describe(await ev(F.carrying)));
    const burnt = await eventsSince(nDone, EVENT.pieceBurnt);
    assert(burnt.length === 0, 'a piece burnt: ' + describe(burnt));
    // #live: the warning sentence within 6 s (deviation 8: real time for the queue too).
    let heard = false;
    for (let t = 0; t <= WAIT_S.liveAfterWarn && !heard; t += WAIT_S.liveStep) {
      heard = (await liveTexts()).includes(BURN_WARN[MEAT]);
      if (heard) break;
      await advance(WAIT_S.liveStep);
      await sleep(550);
    }
    assert(heard, '#live never said ' + describe(BURN_WARN[MEAT]) + '; it said ' + describe((await liveTexts()).slice(-12)));
    return 'warning at clock ' + warnEv.at + ', #act ' + describe(act) + ', pulled in time (' + (await eventsSince(nPull, EVENT.pieceBurnt)).length + ' burnt), #live heard it';
  });

  await step('pause and resume', async () => {
    if (!(await ev(inService))) await openYard(BUY_LATER);
    await keyPress(KEYS.escape);
    await advance(0);
    assert(await visible(ID.pause), '#pause not visible after Escape');
    assert(await ev(F.paused + ' === true'), 'state.paused is not true');
    assert(await ev('$(' + JSON.stringify(ID.root) + ').dataset.paused === "1"'), '#root data-paused is not 1');
    assert(!(await visible(ID.howto)), '#howto visible beside the pause panel');
    assert(!(await visible(ID.pauseSkip)), '#pause-skip visible with the tutorial done');
    await click(ID.pauseControls);
    await advance(0);
    assert(await visible(ID.howto), '#howto not visible after #pause-controls');
    assert(!(await visible(ID.pause)), '#pause still visible with the Controls card open');
    await keyPress(KEYS.escape);
    await advance(0);
    assert(await visible(ID.pause), '#pause did not come back after Escape on the Controls card');
    assert(await ev(F.paused + ' === true'), 'not paused after closing the Controls card');
    await keyPress(KEYS.escape);
    await advance(0);
    assert(!(await visible(ID.pause)), '#pause still visible after the second Escape');
    assert(await ev(F.paused + ' === false'), 'state.paused still true');
    await keyPress(KEYS.p);
    await advance(0);
    assert(await visible(ID.pause), '#pause not visible after P');
    assert(await ev(F.paused + ' === true'), 'state.paused is not true after P');
    await keyPress(KEYS.p);
    await advance(0);
    assert(!(await visible(ID.pause)), '#pause still visible after the second P');
    assert(await ev(F.paused + ' === false'), 'state.paused still true after the second P');
    return 'Controls from the pause panel and back; P pauses and resumes';
  });

  await step('no sprite drawn outside the canvas', async () => {
    if (await ev(F.paused)) await keyPress(KEYS.escape);
    await until('false', WAIT_S.service);
    captures.service = await captureFrame();
    const bad = [];
    let total = 0;
    for (const [label, frame] of Object.entries(captures)) {
      if (!Array.isArray(frame)) continue;
      for (const d of frame) {
        total += 1;
        const hits = d.x < VIRTUAL.w && d.x + d.w > 0 && d.y < VIRTUAL.h && d.y + d.h > 0;
        const inside = d.x >= 0 && d.y >= 0 && d.x + d.w <= VIRTUAL.w && d.y + d.h <= VIRTUAL.h;
        if (!hits) { bad.push(label + ': ' + describe(d) + ' misses the canvas'); continue; }
        if (inside) continue;
        const sides = d.x >= 0 && d.x + d.w <= VIRTUAL.w;
        const bottom = EDGE_OK.bottom.test(d.name) && sides && d.y >= 0 && d.y + d.h > VIRTUAL.h;
        if (!bottom) bad.push(label + ': ' + describe(d));
      }
    }
    assert(bad.length === 0, bad.length + ' record(s) past the edge, first ' + bad.slice(0, 4).join('; '));
    return total + ' records over ' + Object.keys(captures).join(', ');
  });

  await step('dog never on a station use tile', async () => {
    const r = await run(`
      const use = new Set();
      for (const st of MAP.stations) for (const u of st.use) use.add(u.x + ',' + u.y);
      const dt = C.${C_NAMES.tick};
      const seen = new Set();
      const bad = [];
      let t = 0, moves = 0, lastPx = null, samples = 0;
      const check = () => {
        const d = g.${GAME_FIELDS.dog};
        const cx = Math.floor((d.px + 8) / 16), cy = Math.floor((d.py + 8) / 16);
        samples += 1;
        seen.add(d.x + ',' + d.y);
        if (use.has(d.x + ',' + d.y)) bad.push({ t, x: d.x, y: d.y });
        else if (use.has(cx + ',' + cy)) bad.push({ t, cx, cy });
        if (lastPx !== null && (lastPx.x !== d.px || lastPx.y !== d.py)) moves += 1;
        lastPx = { x: d.px, y: d.py };
      };
      check();
      while (t < ${WAIT_S.dogSample} && S().phase === '${PHASE.service}' && bad.length < 5) {
        g.${GAME_FIELDS.advance}(dt);
        t += dt;
        globalThis.__smoke.sample();
        check();
      }
      return { bad, moves, samples, tiles: [...seen], t: Math.round(t * 100) / 100, useTiles: use.size, reduced: !!g.${GAME_FIELDS.reduced} };
    `);
    assert(r.bad.length === 0, 'dog on a use tile: ' + describe(r.bad.slice(0, 3)));
    let note = r.samples + ' samples over ' + r.t + 's, ' + r.moves + ' moves, tiles ' + r.tiles.join(' ');
    if (r.moves === 0 && !r.reduced) {
      // The dog runs on real seconds (V2.9); poll it while the page runs on its own.
      const deadline = Date.now() + DOG_REALTIME_MS;
      const use = await ev('[...new Set(MAP.stations.flatMap((st) => st.use.map((u) => u.x + "," + u.y)))]');
      const seen = new Set();
      let last = null, rtMoves = 0;
      while (Date.now() < deadline && (await ev(inService))) {
        const d = await ev('({ x: g.' + GAME_FIELDS.dog + '.x, y: g.' + GAME_FIELDS.dog + '.y, px: g.' + GAME_FIELDS.dog + '.px, py: g.' + GAME_FIELDS.dog + '.py })');
        assert(!use.includes(d.x + ',' + d.y), 'dog on use tile (' + d.x + ',' + d.y + ') in real time');
        seen.add(d.x + ',' + d.y);
        if (last && (last.px !== d.px || last.py !== d.py)) rtMoves += 1;
        last = d;
        await sleep(100);
      }
      note += '; did not move under advance, real time poll saw ' + rtMoves + ' moves over ' + [...seen].join(' ');
    }
    return note;
  });

  // Steps 43 and 44 measure and test with the tutorial running: a new game when a reload has none.
  async function ensureTutorialMorning() {
    if ((await tut()) !== null && (await ev(F.phase + ' === ' + JSON.stringify(PHASE.morning)))) return 'reloaded into a running tutorial';
    if (!(await ev(F.phase + ' === ' + JSON.stringify(PHASE.morning)))) {
      await keyPress(KEYS.escape);
      await advance(0);
      if (await visible(ID.pause)) { await newGame(ID.pauseNew); return 'new game from the pause panel'; }
    }
    if (await present(ID.clipNew)) { await newGame(ID.clipNew); return 'new game from the clipboard'; }
    return 'no way to start a new game';
  }

  await step('layout and keyboard at 375 by 740', async () => {
    const notes = [];
    try {
      await emulate(LAYOUT_VIEW);
      await sleep(TIMEOUT_MS.resize);
      await advance(0);
      const lay = await ev('({ sw: document.documentElement.scrollWidth, iw: window.innerWidth })');
      assert(lay.sw <= lay.iw, 'scrollWidth ' + lay.sw + ' over innerWidth ' + lay.iw);
      const small = await ev(SMALL_BUTTONS);
      assert(small.length === 0, 'buttons under ' + MIN_CONTROL_PX + ' px in service: ' + describe(small.slice(0, 5)));
      const sc = await canvasScale();
      assert(sc.w === VIRTUAL.w * CSS_SCALE.phone && sc.h === VIRTUAL.h * CSS_SCALE.phone, '#cv ' + sc.w + ' by ' + sc.h);
      notes.push('service ok, #cv ' + sc.w + 'x' + sc.h);
      await reload();
      notes.push(await ensureTutorialMorning());
      await expectStep('open', 'open', 'layout morning');
      assert(await visible(ID.tutSkip), '#tut-skip not visible for the morning measure');
      const lay2 = await ev('({ sw: document.documentElement.scrollWidth, iw: window.innerWidth })');
      assert(lay2.sw <= lay2.iw, 'morning scrollWidth ' + lay2.sw + ' over innerWidth ' + lay2.iw);
      const small2 = await ev(SMALL_BUTTONS);
      assert(small2.length === 0, 'buttons under ' + MIN_CONTROL_PX + ' px on the clipboard: ' + describe(small2.slice(0, 5)));
      await openYard(BUY_LATER);
      await advance(0);
      const p = await ev('({ x: ' + F.playerX + ', y: ' + F.playerY + ' })');
      assert(p.x === SPAWN.x && p.y === SPAWN.y, 'player at (' + p.x + ',' + p.y + '), wanted the spawn (' + SPAWN.x + ',' + SPAWN.y + ')');
      await keyPress(KEYS.left);
      await advance(WAIT_S.arrow);
      const x = await ev(F.playerX);
      assert(x === ARROW_LEFT_X, 'after ArrowLeft player.x is ' + x);
      notes.push('ArrowLeft to x ' + x);
      // One pause in service with the tutorial running: #pause-controls and #pause-skip.
      await keyPress(KEYS.escape);
      await advance(0);
      assert(await visible(ID.pause), '#pause not visible for the pause measure');
      const sizes = await ev('[' + JSON.stringify(ID.pauseControls) + ', ' + JSON.stringify(ID.pauseSkip) + '].map((id) => { const e = $(id); if (!e || !vis(id)) return { id, missing: true }; const r = e.getBoundingClientRect(); return { id, w: Math.round(r.width), h: Math.round(r.height) }; })');
      for (const z of sizes) assert(!z.missing && z.w >= MIN_CONTROL_PX && z.h >= MIN_CONTROL_PX, '#' + z.id + ' ' + describe(z));
      const small3 = await ev(SMALL_BUTTONS);
      assert(small3.length === 0, 'buttons under ' + MIN_CONTROL_PX + ' px on the pause panel: ' + describe(small3.slice(0, 5)));
      notes.push('pause ' + sizes.map((z) => z.id + ' ' + z.w + 'x' + z.h).join(', '));
      await keyPress(KEYS.escape);
      await advance(0);
    } finally {
      await emulate(RUN_METRICS);
      await sleep(TIMEOUT_MS.resize);
    }
    return notes.join('; ');
  });

  await step('reduced motion', async () => {
    await cdp.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
    await reload();
    const how = await ensureTutorialMorning();
    assert(await ev('g.' + GAME_FIELDS.reduced + ' === true'), 'game.reduced is not true');
    const frame = await captureFrame();
    const dogWant = { name: 'dog', x: DOG_HOME.px, y: DOG_HOME.py, frame: DOG_HOME.frame };
    assert(hasRecord(frame, dogWant), 'no ' + describe(dogWant) + '; dog records ' + describe(frame.filter((d) => d.name === 'dog')));
    await expectStep('open', 'open', 'reduced morning');
    assert(await hasPulse(ID.open), '#open has no ' + PULSE + ' in the reduced morning');
    const anim = await ev('getComputedStyle($(' + JSON.stringify(ID.open) + ')).animationName');
    assert(anim === 'none', '#open animationName ' + describe(anim) + ' under reduced motion');
    await openYard(BUY_LATER);
    await advance(0);
    const want = ARROW_AT.pile;
    const a1 = arrows(await captureFrame());
    assert(a1.some((d) => d.x === want.x && d.y === want.y && d.frame === 2), 'reduced arrow ' + describe(a1) + ', wanted frame 2 at (' + want.x + ',' + want.y + ')');
    await advance(0.6);
    const a2 = arrows(await captureFrame());
    assert(a2.some((d) => d.x === want.x && d.y === want.y && d.frame === 2), 'reduced arrow after 0.6 s ' + describe(a2) + ', wanted frame 2 again');
    const n0 = (await fxLog()).length;
    const pt = await canvasPoint(TILE.pile.x, TILE.pile.y);
    await mouseTap(pt.x, pt.y);
    await advance(await ev('C.' + C_NAMES.tick));
    const walking = await ev(F.walking + ' || ' + F.nextTile + ' !== null || ' + F.pathLen + ' > 0');
    assert(walking, 'the walk did not start after a mouse tap on the pile; player ' + describe(await ev('({ x: ' + F.playerX + ', y: ' + F.playerY + ' })')));
    const fx = (await fxLog()).slice(n0);
    assert(fx.some((f) => f.kind === FX_KIND.ring), 'no ' + FX_KIND.ring + ' in fxLog after the tap; got ' + describe(fx.map((f) => f.kind)));
    assert(!fx.some((f) => f.kind === FX_KIND.squash), 'a ' + FX_KIND.squash + ' was logged under reduced motion');
    return 'reduced (' + how + '), static pulse, arrow frame 2 twice, dog home in frame ' + DOG_HOME.frame + ', ring without squash';
  });

  await step('zero console errors across the run', () => {
    const e = errorCount();
    assert(e.total === 0, describe(e) + ' first: ' + describe(report.console.find((c) => c.type === 'error') || report.exceptions[0] || report.logEntries.find((l) => l.level === 'error')));
    return 'console ' + report.console.length + ' messages';
  });

  // Metrics, day 1 only.
  const served = eventsDay1.filter((e) => e.type === EVENT.served).length;
  const daySecondsOfService = before.service;
  report.metrics = {
    platesServed: served,
    seated: eventsDay1.filter((e) => e.type === EVENT.seatDone).length,
    toGo: eventsDay1.filter((e) => e.type === EVENT.toGo).length,
    taps,
    tapsPerPlate: served ? Math.round((taps / served) * 100) / 100 : null,
    tapFallbacks: tapNotes,
    boredomSeconds: Math.round(before.bored * 100) / 100,
    boredomPrepSeconds: Math.round(before.boredPrep * 100) / 100,
    serviceSeconds: Math.round(daySecondsOfService * 100) / 100,
    boredomFraction: daySecondsOfService ? Math.round((before.bored / daySecondsOfService) * 1000) / 1000 : null,
    day1Events: eventsDay1.length,
    walkOuts: eventsDay1.filter((e) => e.type === EVENT.walkOut).length,
    customersArrived: eventsDay1.filter((e) => e.type === EVENT.customerArrived).length,
    drawRecords: Object.fromEntries(Object.entries(captures).map(([k, v]) => [k, Array.isArray(v) ? v.length : 0])),
    errors: errorCount()
  };
  report.events = eventsDay1;
}

// ---------------------------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------------------------

async function main() {
  await nodeChecks();
  if (!fatal) {
    try {
      await step('Chrome launched and CDP connected', async () => {
        const port = await launch();
        return 'port ' + port + ', ' + report.mode + ' ' + RUN_METRICS.width + 'x' + RUN_METRICS.height + ' dpr ' + RUN_METRICS.deviceScaleFactor;
      }, { fatal: true });
      if (!fatal) await browserChecks();
    } catch (e) {
      record('browser run', false, (e && e.stack) || String(e));
    } finally {
      try { if (cdp) await Promise.race([cdp.send('Browser.close').catch(() => {}), sleep(2000)]); } catch (_e) { /* ignore */ }
      try { if (cdp && cdp.ws) cdp.ws.close(); } catch (_e) { /* ignore */ }
      killChrome();
      await removeProfile();
    }
  }
  const total = report.steps.length;
  const ok = total - failed;
  const m = report.metrics;
  const parts = [
    'smoke: ' + ok + '/' + total + ' steps ok',
    m.boredomSeconds !== undefined ? 'boredom ' + m.boredomSeconds + 's of ' + m.serviceSeconds + 's service' + (m.boredomFraction !== null && m.boredomFraction !== undefined ? ' (' + Math.round(m.boredomFraction * 100) + '%)' : '') : null,
    m.tapsPerPlate !== undefined && m.tapsPerPlate !== null ? m.tapsPerPlate + ' taps/plate (' + m.taps + ' taps, ' + m.platesServed + ' plates, ' + m.seated + ' seated)' : null,
    (m.errors ? m.errors.total : errorCount().total) + ' errors',
    'report ' + path.join(OUT_DIR, 'report.json')
  ].filter(Boolean);
  report.summary = parts.join(', ');
  report.finishedAt = new Date().toISOString();
  fs.writeFileSync(path.join(OUT_DIR, 'report.json'), JSON.stringify(report, null, 2) + '\n', 'utf8');
  console.log(report.summary);
  process.exitCode = failed > 0 ? 1 : 0;
}

main().catch((e) => {
  console.error('smoke: crashed: ' + ((e && e.stack) || e));
  killChrome();
  try { fs.writeFileSync(path.join(OUT_DIR, 'report.json'), JSON.stringify(Object.assign(report, { crash: String(e && e.stack || e) }), null, 2) + '\n', 'utf8'); } catch (_e) { /* ignore */ }
  process.exitCode = 1;
});
