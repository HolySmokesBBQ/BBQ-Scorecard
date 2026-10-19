#!/usr/bin/env node
// games/pit-sim/dev/smoke.mjs
// Headless smoke test for the pit sim, v3.0 (the season: the week hub, bookings, the ticket rail,
// client stars, the inventory, the character creator and the season end card) on top of v2.1
// (guided tutorial, gentler burn with a warning, new charcoal art) and v2 (dense yard, seating,
// feedback). Never shipped, never linked.
//
// Run from the repo root:
//   node games/pit-sim/dev/smoke.mjs [--out <dir>] [--desktop] [--seed <n>] [--dir <folder>]
//
// v3.0 (contract docs/superpowers/specs/2026-10-18-pit-sim-v3-0-contract.md, W19, the 62 step list).
// Steps 1 to 17 run in Node with no browser: the K11 checks moved to the v4 save and the v3.0
// surface, then seven new headless steps (tutorial strands, the booking generator against a
// reference model of W3.4, client stars and pay, the week loop, inventory caps and spoilage, the
// season end by the settle() fast path, names and looks). Steps 18 to 41 are the v2.1 browser run
// (day 1 is still the tutorial day) with the W19 additions; the till now leads to the creator.
// Steps 42 to 51 are new: names typed through CDP Input.insertText, the creator by real taps, the
// pit name on the yard sign and the hub header, the week hub, a full week by real taps (pick, shop,
// load up, cook by canvas taps, report, next), inventory rollover, the two tap week, cooler
// capacity spoilage, the season end after week 9 and the v2.1 save migration, each from v4 save
// fixtures written before a reload. Steps 52 to 62 are the K11 tail moved onto the hub.
//
// What the v2.1 part does, in order (contract K11, the 45 step list: the 38 v2 steps with seven inserted):
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
//      (step f), tutorial-customer (step i), mid-service, seated, till, decor, warning, and in v3.0
//      creator, week, offers, inventory, sheet-shop, report, season-end), prints one summary line,
//      exits 1 on any failed step, and always kills Chrome and removes the profile.
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
// Deviations from contract W19 (v3.0); step numbers are W19's:
//  12. Step 11 (b) lights kettle 1 with the one bag before taking the sausage: with kettle 1 cold the
//      tutorial's own rows put the step at charcoal, so the step meat with target cooler that W19
//      asks for is only reachable on a lit kettle. The charcoal refill is (c)'s job.
//  13. Step 12 checks the generator against a reference model of W3.4 written here from the
//      contract (mix32, mulberry32, the Fisher Yates draws, the safe swap, the invite, the display
//      order and the host draws), so ids, order and hosts are compared exactly, not only shaped.
//  14. Step 21 "every index of a look key differs": hair indexes are compared with the default cap;
//      a pair the cap hides completely is compared again with hat 0 (none) and passes when the bare
//      heads differ, with a note. The cap covering the crown is the design, not a defect.
//  15. Text drawn in the UI font (art.uiText canvases, aria-hidden) is read through the element's
//      text plus the aria-label of it and its children; a heading that is a canvas with a .sr span
//      reads as the .sr text. Checks use the exact W15 sentence wherever one is pinned, and
//      "includes" where the contract puts two texts in one element (#week-label, offer cards).
//  16. Step 46 waits for a served booked guest up to the event's end: a guest at the front who wants
//      pork butt holds the line, so the chicken plate is served when a chicken guest reaches it.
//      The rail check is left === want - sold for chicken right after the first booked serve.
//  17. Steps 49 and 50 load v4 fixtures with cash the prefill fits; step 50 loads rep 40 so the
//      season end card's word of mouth line has a number above the floor to carry.
//  18. Step 60 builds the report fixture with sim.settle(3) (a W5 method the browser steps may call)
//      instead of an idle cook, and the season end card from a v4 save with nine results.
//  19. Steps 60 and 61 start from a cleared save (reloadFresh) instead of the v2.1 new game routes:
//      a reload in v3.0 can land on the creator, which has no New game button.
//  20. Two screenshots beyond W19's five: offers.png (the offer cards) and inventory.png (the
//      Inventory card), clipped to the element when the browser allows it.
// Integration (v3.0 integrator, recorded in contract W23):
//  I-1. Step 14 also checks that bookOffer emits one booking_picked typed as such, carrying id and booking.
//  I-3. Step 12's reference model lists an Offer's menu in MEAT_IDS order (W3.3), as genOffers does,
//       even when a stub row lists its meats in another order (the stretch stub lists brisket first).
// Playtest round 1 (2026-10-19, contract W24):
//  P-1. Step 12's reference model has the grate time test (sim.js P-1): with no gear the Church picnic
//       is a stretch with ui.needsKettle2 and with the second kettle it is safe, at every length.
//  P-2. Step 13 carries the W24 score table (quality by the share fed, cold plates) and pay literals at
//       PAY_BASE 0.3 and PAY_PER_STAR 0.14; its picnic buys the second kettle first from cash 111,
//       which also checks that a gear buy may lean on the picked offer's deposit (sim.js P-4).
//  P-3. Step 14's literals: nobody fed scores 0 and the 1 star Birthday rest is 14; the cart covers the
//       rail with the spare only when a cooler is owned (sim.js P-5).
//  P-4. Step 11 (a): the full grate points at the cooler, where the verb is "Put Sausage back".
//  P-5. Step 21 checks that every tutorial text the banner shows wraps to at most two 164 px lines
//       (the clipboard's open text excepted).
//  P-6. Step 46 picks the Church picnic first and checks it is a stretch (#go disabled, #go-why and the
//       card's Needs line read ui.needsKettle2), then plays the week as a Birthday, buying the 20 bags
//       with inc5-charcoal (four taps).
// Playtest round 2 (2026-10-19, contract W25):
//  R-1. Step 12's reference model sizes the Season finale to the owned grate (sim.js R-3) and checks
//       the literals 9, 25 and 40 guests (fees 105, 295, 560) at Normal.
//  R-2. Step 13 buys the second kettle from cash 103 (the playtest's week 1) and checks sim.canBuy()
//       first; step 14 also slices a second pork butt onto a board holding the first butt's four
//       plates, opens a second butt stack, and reads "Board is full. Use the trash" on a full board.
//  R-3. Step 15's refused increase with no cooler reads ui.coolerFullNone.
//  R-4. Step 39 checks the tutorial till's information rows and Paid at the shop; step 46 checks that
//       week start + Take today + Gear bought + the kept or drawn stock row equals Cash on the report,
//       with the new rows in the W17.4 order; steps 46 and 50 read ui.reportHLow at 1 or 2 stars.
//  R-5. Steps 41 and 51 read the creator's defaults as placeholders over empty fields.
//  R-6. Step 45 reads the week 1 goal through the Gear tile (#goal hidden as a repeat, #news hidden).
//  R-7. Step 62 (new) picks the picnic from cash 103 in week 1 and buys the second kettle by real taps
//       on the Gear sheet; Load up and go then opens. The console step is 63.
// Playtest round 3 (2026-10-19, contract W26):
//  Q-1. Step 5 carries the W26 strings (missedLine, coolerRoom, coolerNone, rowKept, rowDrawn and the
//       new keys), C.FINALE_SECONDS and C.DRIVEWAY_BUYABLE, the Birthday's 60 s window and the
//       finale's 105 s window, and sim.gateWaiting among the methods.
//  Q-2. Step 11 (a2): with the grate full, a tap on the cooler (walkTo its tile, the call a canvas tap
//       makes) puts the raw piece back with no button; (b) checks the put back stays a button verb
//       while a grate has room.
//  Q-3. Step 12's reference model reads the finale at Normal whatever the length (sim.js Q-2); the
//       literals are 16, 33 and 40 guests (fees 190, 390, 560) at every length, and the Birthday's
//       window is 60 (41.25 at Short, 78.75 at Long).
//  Q-4. Step 13 (pay): after the 3 star picnic the next week opens on the picnic again (sim.js Q-7).
//       Step 14 (W7.3): the idle Birthday's last call is 90 (W26 literal); guests_missed fires after
//       last_call, at the hard end, with the report's missed count. Step 16 (season end): the finale
//       loads up with endAt C.FINALE_SECONDS and last call at 135.
//  Q-5. Step 46: #title reads the pit name; the Birthday's shop lists only its rail meats (no
//       qty-ribs or qty-butt, Other meats folded) with a Covers line; the ledger reads the renamed
//       stock rows.

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
const GAME_VERSION = '0.5.0';
const SIM_SURFACE = ['C', 'MEATS', 'MEAT_IDS', 'MAP', 'CATALOG', 'STRINGS', 'createSim', 'validateSave', 'fireBand', 'fireMult', 'tileOwned', 'SAVE_KEY',
  // v3.0 (W1): the nine new top level names.
  'BOOKINGS', 'BOOKING_IDS', 'LOOK_KEYS', 'LOOK_COUNTS', 'DEFAULT_LOOK', 'genOffers', 'scoreEvent', 'cleanName', 'filterName'];
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
const C_EXPECT = { WALK_TILES_PER_S: 6, SAVE_VERSION: 4, PATIENCE_MID_FRAC: 0.5, GEAR_RESERVE: 30, QUEUE_SPOTS: 3, QUEUE_SPOTS_BIG: 5, TABLE_SPOTS: 3, TABLE_SPOTS_BIG: 5 };
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

// Contract W16.2, copied verbatim (replaces the K9 literal).
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
  ['bed', 16, 20, 4], ['shed', 48, 32, 1], ['sign', 62, 12, 1], ['tree', 32, 48, 1],
  ['woodpile', 16, 16, 1], ['hose', 16, 16, 1], ['tools', 16, 24, 1], ['pot', 16, 16, 1],
  ['planter', 16, 24, 1], ['shelf', 16, 24, 1], ['mailbox', 16, 24, 1], ['picnic', 32, 24, 1], ['picnic_bench', 32, 8, 1],
  ['chair', 16, 24, 1], ['lights_post', 16, 32, 1], ['lights_string', 66, 10, 2], ['birdbath', 16, 24, 2],
  ['canopy', 40, 32, 1], ['bubble', 16, 12, 1], ['heart', 8, 8, 2], ['sparkle', 7, 7, 3],
  ['smoke', 8, 8, 3], ['smoke_dark', 8, 8, 3], ['fire', 8, 8, 3], ['coin', 8, 8, 2],
  ['sweat', 4, 6, 2], ['zzz', 8, 8, 3], ['font', 4, 6, 42],
  ['arrow', 8, 12, 4], ['bubble_warn', 8, 10, 2],
  ['font_s', 3, 5, 42], ['ev_birthday', 16, 16, 1], ['ev_picnic', 16, 16, 1], ['ev_yard', 16, 16, 1],
  ['ev_finale', 16, 16, 1], ['star', 9, 9, 2], ['flame', 8, 10, 2], ['check', 8, 8, 1]
];
const SPRITE_COUNT = 123;
const PALETTE_LEN = 36;
const PALETTE_NEW = { 32: '#f7d9c4', 33: '#b87a4b', 34: '#714227', 35: '#5f3a25' };   // W16.1
const COLOR_KEYS = 'K U C O outline woodD woodM woodL paver paverD lawnA lawnB leafD leafL cloth clothD white pink magenta yellow skinL skinM skinD red raw cooking done steelL steelD smokeL smokeD skinPale skinTan skinTanD skinDeep'.split(' ');

// ---------------------------------------------------------------------------------------------
// v3.0 constants (contract W1 to W19). Every number a rule of play may move is read through C at
// run time (W22.18); the literals here are the contract's starting values, used to print and
// assert the W19 literals only while C still holds them.
// ---------------------------------------------------------------------------------------------

// W2: the new C keys. FIXED keys must equal; the rest are tunable starting values (same kind).
const C_W2 = {
  SEASON_WEEKS: 9, YEAR_MAX: 99,
  LENGTHS: { short: { seconds: 90, window: 55, factor: 0.7 }, normal: { seconds: 125, window: 80, factor: 1.0 }, long: { seconds: 160, window: 105, factor: 1.3 } },
  LENGTH_ORDER: ['short', 'normal', 'long'],
  BASE_WINDOW: 80, LAST_CALL_GUARD: 5,
  FEE_MULT: 1.25, FEE_ROUND: 5, DEPOSIT_FRAC: 0.3, PAY_BASE: 0.3, PAY_PER_STAR: 0.14,
  ADDON_SHARE: 0.25, MENU_BONUS: 0.1, SPARE_FRAC: 0.1, BAGS_PER_COOKER: 6, LOW_CASH_BIRTHDAY: 60, SAFE_LOAD: 0.8,
  FINALE_SECONDS: 160, DRIVEWAY_BUYABLE: false,   // W26 Q-1 and Q-8
  THIRD_EDGES: [34, 67], OFFER_SLOTS: [2, 3, 3], INVITE_THIRD: 2,
  SCORE_FED: 60, SCORE_WAIT: 20, SCORE_QUALITY: 20, WAIT_FULL_S: 20, WAIT_ZERO_S: 60,
  BURNT_PENALTY: 4, OFFMENU_PENALTY: 2, COLD_PENALTY: 2,
  STAR_EDGES: [40, 60, 75, 90], STAR_FANS: [-5, -2, 2, 4, 6],
  ARRIVAL_CURVE: 1.3, ARRIVAL_SPAN: 0.9, PARTY_MIN: 1, PARTY_MAX: 4, PARTY_GAP_S: 0.6,
  COOLER_CAP: [0, 12, 24, 40], CHARCOAL_MAX: 200, WOOD_MAX: 100,
  NAME_MAX: 14, NAME_PUNCT: " '.-",
  SEASON_CARRY_REP: 0.75, SEASON_REP_FLOOR: 20,
  DRIVEWAY_REP: 34
};
const C_W2_FIXED = ['SAVE_VERSION', 'SEASON_WEEKS', 'NAME_MAX', 'NAME_PUNCT', 'LENGTHS', 'LENGTH_ORDER'];
// W2 changed values and the v2.1 keys that stay (W2 last paragraph).
const C_W2_EXACT = { SAVE_VERSION: 4, DRIVEWAY_PRICE: 400, GATE_OPENS: 30, LAST_CALL: 110, DAY_SECONDS: 125, STEPPER_MAX: 99, START_CASH: 80, START_REP: 20 };
// W22.18: the keys whose starting values the W19 literals assume.
const LITERAL_KEYS = ['FEE_MULT', 'FEE_ROUND', 'DEPOSIT_FRAC', 'PAY_BASE', 'PAY_PER_STAR', 'STAR_FANS', 'REP_DAY_MIN', 'SPARE_FRAC', 'BAGS_PER_COOKER',
  'SCORE_FED', 'SCORE_WAIT', 'SCORE_QUALITY', 'STAR_EDGES', 'WAIT_FULL_S', 'WAIT_ZERO_S', 'BURNT_PENALTY', 'OFFMENU_PENALTY', 'COOLER_CAP', 'SEASON_CARRY_REP', 'SEASON_REP_FLOOR',
  'SAFE_LOAD', 'COLD_PENALTY'];
// K10 banner box (game.js BANNER_TEXT_W, BANNER_MAX_LINES); the open text shows only on the clipboard (P-5).
const BANNER = { textW: 164, maxLines: 2, clipOnly: ['open'] };

// W3.1
const BOOKING_IDS = ['birthday', 'picnic', 'finale', 'yard'];
const BOOKINGS_EXPECT = {
  birthday: { id: 'birthday', label: 'Birthday', guests: 12, menu: ['sausage', 'chicken'], patience: 45, window: 60, flames: 1, venue: 'backyard', icon: 'ev_birthday', unlock: null },   // W26 Q-5
  picnic: { id: 'picnic', label: 'Church picnic', guests: 20, menu: ['chicken', 'butt'], patience: 50, window: 80, flames: 2, venue: 'backyard', icon: 'ev_picnic', unlock: null },
  finale: { id: 'finale', label: 'Season finale', guests: 40, menu: null, patience: 50, window: 105, flames: 3, venue: 'backyard', icon: 'ev_finale', unlock: null },   // W26 Q-2
  yard: { id: 'yard', label: 'Yard day', guests: 0, menu: [], patience: 'PATIENCE_BASE', window: 80, flames: 1, venue: 'backyard', icon: 'ev_yard', unlock: null }
};
// W4.3
const LOOK_KEYS = ['skin', 'hair', 'hairColor', 'face', 'hat', 'apron'];
const LOOK_COUNTS = { skin: 6, hair: 6, hairColor: 6, face: 4, hat: 4, apron: 6 };
const DEFAULT_LOOK = { skin: 1, hair: 0, hairColor: 1, face: 0, hat: 1, apron: 0 };
const DEFAULT_LOOK_KEY = '1-0-1-0-1-0';
const lookKeyOf = (l) => LOOK_KEYS.map((k) => l[k]).join('-');
// W16.4, the swap tables as art.LOOK holds them.
const LOOK_TABLES = {
  skin: [
    { S: 'w', R: 'l', M: 'm', P: 'i' }, { S: 'l', R: 'm', M: 'n', P: 'i' }, { S: 'm', R: '7', M: 'n', P: 'q' },
    { S: 'x', R: 'n', M: '5', P: 'q' }, { S: 'n', R: 'y', M: '5', P: 'r' }, { S: 'z', R: '5', M: '1', P: 'r' }
  ],
  hairColor: [{ H: '2', J: '5' }, { H: '5', J: '6' }, { H: 'r', J: 'q' }, { H: '8', J: '9' }, { H: '4', J: '8' }, { H: 's', J: 'u' }],
  apron: [{ A: 'o', B: 'r' }, { A: '4', B: 'r' }, { A: 'c', B: 'd' }, { A: 'f', B: 'g' }, { A: 'v', B: '2' }, { A: 'i', B: 'j' }],   // W26: Charcoal on smokeD v
  hat: [null, { C: '4', F: '8', D: 'r' }, { C: '7', F: '8', D: '6' }, { C: 'o', F: 'h', D: 'r' }],
  hair: ['short', 'curly', 'long', 'buzz', 'bun', 'bald'],
  face: ['none', 'mustache', 'beard', 'glasses']
};
const LEGEND = '0123456789abcdefghijklmnopqrstuvwxyz';
const PLAYER_SPRITES = [['player_down', 3], ['player_up', 3], ['player_side', 3], ['player_slice', 2]];
// W16.5 and W19 step 44.
const SIGN_TEXT = { x: 67, y: 5, w: 58 };
const SIGN_DRAW = { x: 65, y: 2 };
const FONT_FRAME = (ch) => {   // W16.2 font frame mapping
  if (ch >= '0' && ch <= '9') return ch.charCodeAt(0) - 48;
  if (ch >= 'A' && ch <= 'Z') return 10 + ch.charCodeAt(0) - 65;
  return { '+': 36, ':': 37, '.': 38, ',': 39, "'": 40, '-': 41 }[ch];
};
// W5.1: every new sim method (own properties).
const SIM_METHODS_V3 = ['bookOffer', 'setAddon', 'railFor', 'canLoadUp', 'loadUp', 'finishReport', 'startSeason', 'seasonEndPreview',
  'setPlayer', 'randomLook', 'look', 'setLength', 'fanThird', 'offerSlots', 'coolerCap', 'inventory', 'meatRoom', 'prefill', 'settle',
  'gateWaiting'];   // W26 Q-6
const LOOP = { tutorial: 'tutorial', creator: 'creator', week: 'week', prep: 'prep', cook: 'cook', report: 'report', seasonEnd: 'seasonEnd' };
const EV3 = {
  offersReady: 'offers_ready', bookingPicked: 'booking_picked', deposit: 'deposit', guestsMissed: 'guests_missed',
  clientStars: 'client_stars', spoiled: 'spoiled', weekStart: 'week_start', seasonEnd: 'season_end', seasonStart: 'season_start',
  playerSet: 'player_set', tutorialRefill: 'tutorial_refill', walkPast: 'walk_past'
};
const BANNED_NAMES = ['Striker', 'Peyton', 'Joel'];
// W4.4 examples (the curly apostrophe written as an escape).
const NAME_CASES = [
  { fn: 'clean', args: ['  Ana<b>!  Q  ', 'X'], want: 'Anab Q' },
  { fn: 'clean', args: ['Marty’s Pit', 'X'], want: "Marty's Pit" },
  { fn: 'clean', args: ['ABCDEFGHIJKLMNOPQRST', 'X'], want: 'ABCDEFGHIJKLMN' },
  { fn: 'clean', args: ['', 'Your Pit'], want: 'Your Pit' },
  { fn: 'clean', args: ['\u{1F600}', 'Pitmaster'], want: 'Pitmaster' },
  { fn: 'filter', args: ['Bo  b '], want: 'Bo b ' }
];
// v3.0 DOM ids (W17, W18).
const ID3 = {
  hudDay: 'hud-day', week: 'week', weekH: 'week-h', weekSign: 'week-sign', weekLabel: 'week-label', weekWhen: 'week-when',
  weekPips: 'week-pips', weekCash: 'week-cash', weekFans: 'week-fans', strip: 'season-strip', wk: (w) => 'wk-' + w,
  offers: 'offers', offer: (id) => 'offer-' + id, book: (id) => 'book-' + id, nextEvent: 'next-event', go: 'go', goWhy: 'go-why',
  goDeposit: 'go-deposit', cardShop: 'card-shop', cardGear: 'card-gear', cardMenu: 'card-menu', cardCrew: 'card-crew',
  invCard: 'inv-card', invCharcoal: 'inv-charcoal', invEmpty: 'inv-empty', invCooler: 'inv-cooler', invSpoil: 'inv-spoil',
  inv: (m) => 'inv-' + m, goal: 'goal', len: (id) => 'len-' + id, lenHelp: 'len-help', weekControls: 'week-controls', weekNew: 'week-new',
  sheet: 'sheet', sheetH: 'sheet-h', sheetBack: 'sheet-back', have: (id) => 'have-' + id, after: (id) => 'after-' + id, shopRoom: 'shop-room',
  creator: 'creator', creatorH: 'creator-h', crSub: 'cr-sub', crSign: 'cr-sign', crScene: 'cr-scene', crRandom: 'cr-random',
  crName: 'cr-name', crNameCount: 'cr-name-count', crPit: 'cr-pit', crPitCount: 'cr-pit-count', crGo: 'cr-go', crBack: 'cr-back', crNote: 'cr-note',
  crSwatch: (row, i) => 'cr-' + row + '-' + i, crPrev: (row) => 'cr-' + row + '-prev', crNext: (row) => 'cr-' + row + '-next', crVal: (row) => 'cr-' + row + '-val',
  repTop: 'rep-top', repScore: 'rep-score', repParts: 'rep-parts', repResult: 'rep-result', repMoney: 'rep-money', repFans: 'rep-fans',
  repHost: 'rep-host', repCooler: 'rep-cooler', repCharcoal: 'rep-charcoal', repSpoil: 'rep-spoil', tillNew: 'till-new',
  seasonEnd: 'season-end', seasonEndH: 'season-end-h', sePit: 'se-pit', seWk: (w) => 'se-wk-' + w, seCash: 'se-cash', seRep: 'se-rep',
  seMeat: 'se-meat', seCharcoal: 'se-charcoal', seasonNext: 'season-next', pauseLook: 'pause-look', chipCharcoal: 'chip-charcoal'
};
const SEASON_WEEKS = 9;
// W19 step 51: the v2.1 (v3) save sample.
const SAVE_V3_SAMPLE = {
  v: 3, day: 5, cash: 150, rep: 20,
  stock: { sausage: 0, chicken: 0, ribs: 0, butt: 0, brisket: 0 },
  charcoal: 12,
  gear: { kettle2: true, cooler: false, bigtable: false, tray: false, canopy: false, drum: false },
  decor: { chair1: false, chair2: false, flowers: false, birdbath: false, lights: false, picnic2: false },
  hires: { buddy: false, tender: false },
  stats: { days: 4, served: 40, walkouts: 2, past: 1, burnt: 0, seated: 20 },
  drivewayShown: false,
  tutorial: { done: true }
};
// W13.1, the v4 sample, copied (it must round trip through validateSave unchanged).
const SAVE_V4_SAMPLE = {
  v: 4, day: 9, cash: 340, rep: 31,
  stock: { sausage: 0, chicken: 2, ribs: 0, butt: 1, brisket: 0 },
  charcoal: 34, wood: 0,
  gear: { kettle2: true, cooler: true, bigtable: false, tray: false, canopy: false, drum: false },
  decor: { chair1: false, chair2: false, flowers: false, birdbath: false, lights: false, picnic2: false },
  hires: { buddy: false, tender: false },
  stats: { days: 8, served: 120, walkouts: 4, past: 2, burnt: 1, seated: 60 },
  drivewayShown: false,
  tutorial: { done: true },
  season: { year: 1, week: 8, seed: 123456789, pick: 'picnic', addon: null, weekCash: 340,
    results: [{ type: 'birthday', stars: 3 }, { type: 'picnic', stars: 4 }, { type: 'yard', stars: 0 },
      { type: 'picnic', stars: 3 }, { type: 'picnic', stars: 5 }, { type: 'birthday', stars: 2 },
      { type: 'picnic', stars: 4 }] },
  player: { name: 'Marty', look: { skin: 3, hair: 1, hairColor: 1, face: 1, hat: 2, apron: 0 } },
  pitName: "Marty's Pit",
  settings: { length: 'normal' }
};
const MARTY = { name: 'Marty', pit: "Marty's Pit", look: { skin: 3, hair: 1, hairColor: 1, face: 1, hat: 2, apron: 0 } };
// Step 43: the taps and the look key after each (from DEFAULT_LOOK; the hat goes cap to cowboy hat).
const CREATOR_TAPS = [
  { id: 'cr-skin-3', key: '3-0-1-0-1-0', pressed: 'cr-skin-3' },
  { id: 'cr-hair-next', key: '3-1-1-0-1-0', val: ['hair', 'CURLY'] },
  { id: 'cr-haircolor-1', key: '3-1-1-0-1-0', pressed: 'cr-haircolor-1' },
  { id: 'cr-face-next', key: '3-1-1-1-1-0', val: ['face', 'MUSTACHE'] },
  { id: 'cr-hat-next', key: '3-1-1-1-2-0', val: ['hat', 'COWBOY HAT'] },
  { id: 'cr-apron-0', key: '3-1-1-1-2-0', pressed: 'cr-apron-0' }
];
const SWATCH_ROWS = { 'cr-skin-': 6, 'cr-haircolor-': 6, 'cr-apron-': 6 };
// W15, copied verbatim as the expectation (step 5 compares every key and its exact text).
const W15 = ({
  tutorial: { /* the 11 K8 entries, plus */
    full: 'The grate is full. Put it back in the cooler.',
    fullGrate: 'Kettle 1 is full. Put this piece on the other cooker.'
  },
  booking: Object.freeze({ birthday: 'Birthday', picnic: 'Church picnic', finale: 'Season finale', yard: 'Yard day' }),
  venue: Object.freeze({ backyard: 'Backyard' }),
  weekLabel: Object.freeze(['Early spring', 'Spring', 'Late spring', 'Early summer', 'Summer', 'Late summer', 'Early fall', 'Fall', 'Season finale']),
  thirdName: Object.freeze(['Neighbors', "Word's out", 'In demand']),
  flames: Object.freeze(['Easy', 'Medium', 'Hard']),
  lengthLabel: Object.freeze({ short: 'Short', normal: 'Normal', long: 'Long' }),
  defaultName: 'Pitmaster',
  defaultPit: 'Your Pit',
  names: Object.freeze(['June', 'Marcus', 'Rosa', 'Theo', 'Maya', 'Dale', 'Nora', 'Gus', 'Ivy', 'Hank',
    'Lena', 'Otis', 'Ruth', 'Cal', 'Bea', 'Walt', 'Faye', 'Abe', 'Dot', 'Lou',
    'Edna', 'Hal', 'Mae', 'Vern', 'Gail', 'Ray', 'Opal', 'Earl', 'Jo', 'Mack',
    'Pearl', 'Ned', 'Iris', 'Clem', 'Wanda', 'Russ', 'Hazel', 'Burt', 'Lottie', 'Wes',
    'Greta', 'Roy', 'Della', 'Floyd', 'Tess', 'Amos', 'Lucille', 'Chet', 'Nell', 'Boyd',
    'Dora', 'Lyle', 'Vi', 'Hollis', 'Ada', 'Mel', 'Rita', 'Sid', 'Fern', 'Tad']),          // 60, fixed order
  look: Object.freeze({
    skin: Object.freeze(['Skin tone 1', 'Skin tone 2', 'Skin tone 3', 'Skin tone 4', 'Skin tone 5', 'Skin tone 6']),
    hair: Object.freeze(['Short', 'Curly', 'Long', 'Buzz', 'Bun', 'Bald']),
    hairColor: Object.freeze(['Black', 'Dark brown', 'Auburn', 'Blond', 'Ginger', 'Gray']),
    face: Object.freeze(['None', 'Mustache', 'Beard', 'Glasses']),
    hat: Object.freeze(['None', 'Cap', 'Cowboy hat', 'Bandana']),
    apron: Object.freeze(['Red', 'Orange', 'Green', 'Blue', 'Charcoal', 'Pink'])
  }),
  hostSays: Object.freeze([
    'Folks went home hungry, {name}.',
    'The line was slow, {name}. Some folks gave up.',
    'Thanks, {name}. The food was good.',
    'Thanks, {name}. Everyone ate well.',
    'Thanks, {name}. We will call you again next year.'
  ]),                                                     // index stars - 1; {name} is state.player.name
  say: Object.freeze({
    picked: '{label}. {n} guests. Pay {fee}.',
    pickedYard: 'Yard day. Guests pay for each plate.',
    deposit: 'The host paid a deposit of {d}.',
    open: '{label}. {n} guests: {list}. Gate opens in {s} seconds.',   // {list}: "10 Chicken thighs, 10 Pulled pork" (plateLabel, rail order)
    servedBooked: 'Served {L}, {tip} tip.',
    servedBookedNoTip: 'Served {L}.',
    missed: '{n} guests gave up at the gate.',
    missedOne: 'One guest gave up at the gate.',
    stars: 'The host gave {n} stars.',
    starsOne: 'The host gave 1 star.',
    reportOpen: 'Done. Opening the report.',
    week: 'Week {w}. {when}.',
    seasonEnd: 'Season {y} is done.',
    refillMeat: 'One more {label} is in the cooler.',               // {label}: MEATS[meat].label
    refillCharcoal: 'One more bag is on the pile.'
  }),
  ui: Object.freeze({
    // header and HUD
    hudWeek: 'Week {w}',
    weekOf: 'Week {w} of 9',
    weekOfYear: 'Season {y}, week {w} of 9',
    seasonWhen: 'Season {y}, {when}',
    cash: 'Cash',
    fans: 'Word of mouth',
    fansAria: 'Word of mouth {n} of 100, {third}',
    // season strip
    stripAria: 'Season {y}',
    wkDone: 'Week {w}, {label}, {stars}',
    starsOne: '1 star',
    starsMany: '{n} stars',
    noStars: 'no stars on a Yard day',
    wkNow: 'Week {w}, this week',
    wkLater: 'Week {w}, {when}',
    wkFinale: 'Week 9, Season finale',
    nowTag: 'NOW',
    // offers
    thisWeek: 'This week',
    pickOne: 'Pick one',
    host: 'Host {name}',
    guests: '{n} guests',
    walkIns: 'Walk-ins',
    yourPick: 'Your pick of meat',
    perPlate: 'Sales per plate',
    noFee: 'No fee',
    pay: 'Pay {fee}',
    deposit: 'Deposit {d}',
    book: 'Pick',
    booked: 'Picked',
    bookAria: 'Pick the {label}',
    needsKettle2: 'Needs a second kettle.',
    needsDrum: 'Needs the drum smoker.',
    finaleDrum: 'With the drum smoker: {n} guests, pay {fee}.',
    mixHint: 'Tip: cook one {big} at a time and keep {small} on the other grate, so plates are ready at the gate.',
    mixShort: 'One {big} at a time.',
    // next event and Load up and go
    nextEvent: 'Next event',
    depositLine: 'The host pays {d} when you load up. The rest comes after the cook.',
    yardLine: 'Guests pay for each plate.',
    loadUp: 'Load up and go',
    goPick: 'Pick a booking first.',
    goCash: 'Not enough cash for this cart. Take something out.',
    // the 2 by 2 grid
    crew: 'Crew',
    crewLine: '{n} of 2 hired',
    crewSub: 'Buddy and fire tender',
    gear: 'Gear',
    gearLine: '{n} of 6 owned',
    gearNext: 'Next: {label}, {price}',
    gearAll: 'All gear owned',
    menu: 'Menu',
    menuOne: '1 meat',
    menuMany: '{n} meats',
    menuYard: 'Your pick',
    shop: 'Shop',
    shopLine: 'Cart {t}',
    shopOne: '1 item',
    shopMany: '{n} items',
    // inventory
    inventory: 'Inventory',
    invCharcoalOne: 'Charcoal: 1 bag',
    invCharcoal: 'Charcoal: {n} bags',
    invWood: 'Wood: {n} splits',
    invMeat: '{n} {label}',
    invEmpty: 'The cooler is empty.',
    invCooler: 'Cooler {u} of {cap}',
    invNoCooler: 'No cooler. Meat left after the cook spoils tonight.',
    invOver: '{n} more than the cooler holds. Cook it or it spoils tonight.',
    // news, settings, foot
    news: 'Pit news',
    finaleNews: 'The finale is week 9. With the drum smoker it is a {n} guest cook.',
    finaleTable: 'The finale is {n} guests. A bigger table lets five wait in line.',
    lengthH: 'Event length',
    lengthHelp: '{s} seconds a cook.',
    controls: 'Controls',
    newGame: 'New game',
    // sheets
    back: 'Back',
    youHave: 'You have {n}',
    afterBags: 'After this: {n} bags',
    afterUnits: 'After this: {n}',
    pileFull: 'The pile holds 200 bags.',
    coolerRoom: 'The cooler holds {cap} units overnight. This cook can use about {e} more units of meat.',
    coolerNone: 'No cooler. This cook can use about {e} more units of meat.',
    covers: 'Covers {p} of {r} plates',
    otherMeats: 'Other meats',
    offMenu: 'Not on this menu. Add one in Menu.',
    noSpare: 'No spare. One burnt piece leaves guests without a plate.',
    practice: 'A practice day before your first season.',
    coolerFull: 'No more room. The cooler holds {cap} overnight.',
    coolerFullNone: 'No more room. There is no cooler to keep the rest.',
    cartLine: 'Total {t}. Deposit {d}. Cash after {c}.',
    cartLineYard: 'Total {t}. Cash after {c}.',
    menuAsk: '{label}: {n} plates',
    addonH: 'Add one meat',
    addonNone: 'None',
    addonNote: 'About a quarter of the guests order it. Serve it with none burnt and the host adds {b} to the pay.',
    addonNo: 'That meat is already on the menu or needs gear you do not have.',
    yardMenu: 'Yard day. Guests order what you cook.',
    // report
    reportH: '{label}: done',
    reportHLow: '{label}: over',
    score: 'Score',
    of5: '{n} of 5',
    partFed: 'Fed',
    partWait: 'Wait',
    partQuality: 'Quality',
    partOf: '{p} of {max}',
    result: 'Guests fed {f} of {b}. {w} walked out. Average wait {s} s.',
    missedLine: '{n} gave up at the gate. The line stayed full to the end.',
    missedTable: 'A bigger table lets five wait.',
    missedOutLine: '{n} gave up at the gate. The food ran out.',
    howWent: 'How it went',
    coldLine: '{n} plates sat too long before they went out.',
    coldLineOne: '1 plate sat too long before it went out.',
    counted: 'counted in food cost',
    cashFrom: '{a} at week start',
    fansWas: 'was {a}',
    inc5: '+5',
    inc5Aria: 'Five more bags',
    money: 'Money',
    rowFeeOne: 'Fee at 1 star',
    rowFee: 'Fee at {n} stars',
    rowDeposit: 'Deposit paid before',
    rowTips: 'Tips',
    rowMenuBonus: 'Menu bonus',
    rowSeatTips: 'Seat tips',
    rowFood: 'Food cost',
    rowCharcoal: 'Charcoal used',
    rowWages: 'Wages',
    rowDaily: 'Daily costs',
    rowSpoiled: 'Spoiled tonight',
    rowThrown: 'Thrown out',
    rowGrate: 'Left on the grate',
    rowBurnt: 'Burnt',
    rowTake: 'Take today',
    takeDetail: 'pay and tips after what the cook used',
    rowGear: 'Gear bought',
    rowKept: 'Bought for later',
    rowDrawn: 'Paid for in an earlier week',
    rowShop: 'Paid at the shop',
    rowCash: 'Cash',
    fansH: 'Word of mouth',
    fansLine: 'Word of mouth {a} to {b}',
    fansReasonOne: '1 star event {d}',
    fansReason: '{n} star event {d}',
    fansServes: 'From the plates you served.',
    hostH: 'What the host said',
    cooler: 'In the cooler now: {list}.',
    coolerNothing: 'In the cooler now: nothing.',
    charcoalLeftOne: 'Charcoal left: 1 bag.',
    charcoalLeft: 'Charcoal left: {n} bags.',
    spoilFull: 'The cooler holds {cap}. {n} spoiled.',
    spoilNone: 'No cooler. {n} spoiled.',
    nextWeek: 'Next week',
    seeSeason: 'See the season',
    cont: 'Continue',
    // season end
    seasonH: 'Season {y} done',
    record: 'Your season',
    seCash: 'Cash carries over: {c}.',
    seRep: 'Word of mouth starts at {b}. It ended at {a}.',
    seMeat: 'Meat in the cooler spoils over the break: {list}.',
    seMeatNone: 'Nothing in the cooler to spoil.',
    seCharcoal: 'Charcoal keeps: {n} bags.',
    seNext: 'Start season {n}',
    // creator
    creatorH: 'Your pitmaster',
    crSubDone: 'Tutorial done. Make it yours.',
    crSub: 'Make it yours.',
    crRandom: 'Random',
    crName: 'Your name',
    crPit: 'Pit name',
    crCount: '{n}/14',
    crSkin: 'Skin',
    crHair: 'Hair',
    crHairColor: 'Hair color',
    crFace: 'Face',
    crHat: 'Hat',
    crApron: 'Apron',
    crPrev: 'Previous {row}',
    crNext: 'Next {row}',
    crSwatch: '{row}: {label}',
    crGo: 'Fire it up',
    crNote: 'Names stay in this browser.',
    crBack: 'Back',
    pauseLook: 'Pitmaster',
    // save notice
    notice: 'Your save was updated for the season.'
  })
});
const fill = (str, tokens) => String(str).replace(/\{(\w+)\}/g, (m, k) => (k in tokens ? String(tokens[k]) : m));
const SAY = W15.say, UI = W15.ui;

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
  notice: 'Your save was updated for the season.',   // W15 ui.notice (v3.0)
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
const INVALID_SAVES = [null, 'x', [], {}, undefined, 42, { v: 5 }, { v: 0 }, { v: '3' }, { v: '4' }];   // W13.3: v 1 to 4 accepted

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
  midService: 'mid-service.png', seated: 'seated.png', decor: 'decor.png', till: 'till.png', warning: 'warning.png',
  // v3.0 (W19), plus offers and inventory (deviation 20)
  creator: 'creator.png', week: 'week.png', offers: 'offers.png', inventory: 'inventory.png', sheetShop: 'sheet-shop.png',
  report: 'report.png', seasonEnd: 'season-end.png'
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
    // v3.0 (W19 step 5): the 11 K8 entries plus full and fullGrate, 13 keys.
    const tutWant = Object.assign({}, TUTORIAL_TEXT, W15.tutorial);
    assert(sameJSON(Object.keys(S.tutorial).sort(), Object.keys(tutWant).sort()), 'STRINGS.tutorial ids ' + describe(Object.keys(S.tutorial)) + ', wanted the 13 of K8 plus W15');
    for (const [id, t] of Object.entries(tutWant)) assert(S.tutorial[id] === t, 'STRINGS.tutorial.' + id + ' is ' + describe(S.tutorial[id]));
    assert(sameJSON(S.tutorialOrder, TUTORIAL_ORDER), 'STRINGS.tutorialOrder ' + describe(S.tutorialOrder));
    assert(S.pullNow === PULL_NOW, 'STRINGS.pullNow ' + describe(S.pullNow));
    assert(S.burnWarn && sameJSON(Object.keys(S.burnWarn).sort(), Object.keys(BURN_WARN).sort()), 'STRINGS.burnWarn keys ' + describe(S.burnWarn && Object.keys(S.burnWarn)));
    for (const [m, t] of Object.entries(BURN_WARN)) assert(S.burnWarn[m] === t, 'STRINGS.burnWarn.' + m + ' is ' + describe(S.burnWarn[m]));
    const fresh = P.createSim(null, 1);
    assert(typeof fresh[SIM_METHODS.skipTutorial] === 'function', 'sim.skipTutorial is not a function');
    assert(typeof fresh[SIM_METHODS.tutorialStep] === 'function', 'sim.tutorialStep is not a function');
    const v3 = surfaceV3(P, fresh);
    return SIM_SURFACE.length + ' names, ' + C_NEW_KEYS.length + ' new C keys, ' + FX_KEYS.length + ' FX keys, v2.1 windows ' + windows.join(' ') + '; ' + v3;
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
    assert(v && v.v === 4, 'dirty v1 sample returned v ' + describe(v && v.v));
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
    assert(s && s.v === 4, 'v1 sample returned v ' + describe(s && s.v));
    migratedDefaults(s, 'v1 sample');
    assert(s.tutorial && s.tutorial.done === true, 'v1 sample tutorial ' + describe(s.tutorial));
    for (const k of ['day', 'cash', 'rep', 'stock', 'charcoal', 'gear', 'hires', 'drivewayShown']) {
      assert(sameJSON(s[k], SAVE_V1_SAMPLE[k]), 'v1 sample ' + k + ' is ' + describe(s[k]) + ', wanted ' + describe(SAVE_V1_SAMPLE[k]));
    }
    for (const [k, n] of Object.entries(SAVE_V1_SAMPLE.stats)) assert(s.stats[k] === n, 'v1 sample stats.' + k + ' is ' + s.stats[k]);
    assert(s.stats.seated === 0, 'v1 sample stats.seated ' + s.stats.seated);
    assert(allFalse(s.decor), 'v1 sample decor ' + describe(s.decor));
    const d = P.validateSave({ v: 2, decor: { chair2: true, bogus: true } });
    assert(d && d.v === 4, 'v2 decor sample returned ' + describe(d));
    migratedDefaults(d, 'v2 decor sample');
    assert(d.decor.chair2 === false, 'decor.chair2 not forced false without chair1');
    assert(!('bogus' in d.decor), 'decor.bogus kept');
    const cyclic = { v: 1 }; cyclic.self = cyclic; cyclic.decor = cyclic;
    let threw = null;
    try { P.validateSave(cyclic); } catch (e) { threw = e; }
    assert(!threw, 'cyclic threw: ' + (threw && threw.message));
    // v2.1 (K6, K11 step 6).
    const v2 = P.validateSave(saveV2({}, P.C.START_REP));
    assert(v2 && v2.v === 4 && v2.tutorial && v2.tutorial.done === true, 'v2 day 1 sample returned ' + describe(v2 && { v: v2.v, tutorial: v2.tutorial }));
    migratedDefaults(v2, 'v2 day 1 sample');
    const t1 = P.validateSave({ v: 3, day: 1, tutorial: { done: false, bogus: 1 } });
    assert(t1 && t1.v === 4 && t1.tutorial && t1.tutorial.done === false, 'v3 day 1 done false returned ' + describe(t1 && t1.tutorial));
    assert(!('bogus' in t1.tutorial), 'tutorial.bogus kept');
    const t3 = P.validateSave({ v: 3, day: 3, tutorial: { done: false, bogus: 1 } });
    assert(t3 && t3.tutorial && t3.tutorial.done === true, 'v3 day 3 done false returned ' + describe(t3 && t3.tutorial));
    const t0 = P.validateSave({ v: 3 });
    assert(t0 && t0.v === 4 && t0.tutorial && t0.tutorial.done === true, '{ v: 3 } returned ' + describe(t0 && t0.tutorial));
    migratedDefaults(t0, '{ v: 3 }');
    migratedDefaults(P.validateSave(JSON.parse(JSON.stringify(SAVE_V3_SAMPLE))), 'v3 sample');
    const ser = P.createSim(null, 1)[SIM_METHODS.serialize]();
    assert(ser && ser.v === 4, 'serialize() v ' + describe(ser && ser.v));
    assert(ser.tutorial && ser.tutorial.done === false, 'serialize() tutorial ' + describe(ser.tutorial));
    const back = P.validateSave(JSON.parse(JSON.stringify(ser)));
    assert(deepEq(back, ser), 'serialize() does not round trip: ' + describe(ser) + ' became ' + describe(back));
    const v4note = validateV4(P);
    return INVALID_SAVES.length + ' rejected, v1, v2 and v3 to v4 migrated with the W13.3 defaults, tutorial rules, chair2 forced, cyclic safe, serialize round trips; ' + v4note;
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
  // v3.0 (W19 steps 11 to 17).
  await step('tutorial strands, headless', () => strandsHeadless(globalThis[GLOBAL_NAME]));
  await step('booking generator, headless', () => generatorHeadless(globalThis[GLOBAL_NAME]));
  await step('client stars and pay, headless', () => starsHeadless(globalThis[GLOBAL_NAME]));
  await step('week loop, headless', () => weekLoopHeadless(globalThis[GLOBAL_NAME]));
  await step('inventory, caps and spoilage, headless', () => inventoryHeadless(globalThis[GLOBAL_NAME]));
  await step('season end by the fast path, headless', () => seasonEndHeadless(globalThis[GLOBAL_NAME]));
  await step('names and looks, headless', () => namesHeadless(globalThis[GLOBAL_NAME]));
}

// ---------------------------------------------------------------------------------------------
// Headless sims (steps 8 to 10). The harness owns every tick here; events are stamped with the
// clock, the tick count and a drain batch number right after each drain.
// ---------------------------------------------------------------------------------------------

function headless(P, saved, seed) {
  const sim = P.createSim(saved, seed);
  const h = { sim, P, C: P.C, log: [], batch: 0, ticks: 0, fixture: null, notes: [], loops: new Set([sim.state.loop]) };
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
    h.loops.add(sim.state.loop);
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
  // v3.0 (W19 step 8): the loop stays tutorial to the till, then finishReport() opens the creator.
  assert(h.until(() => st().phase === PHASE.evening, C.DAY_SECONDS + 10), 'the tutorial day did not reach the till; phase ' + st().phase + ', clock ' + st().clock);
  assert(sameJSON([...h.loops], [LOOP.tutorial]), 'loops seen on the tutorial day ' + describe([...h.loops]));
  assert(st().loop === LOOP.tutorial, 'loop at the till ' + describe(st().loop));
  assert(!h.has(EV3.clientStars), 'client_stars on the tutorial day');
  assert(sameJSON(st().season.results, []), 'season.results after the tutorial day ' + describe(st().season.results));
  h.sim.finishReport();
  h.drain();
  assert(st().loop === LOOP.creator && st().phase === PHASE.morning, 'after finishReport() loop ' + describe(st().loop) + ', phase ' + describe(st().phase));
  assert(st().profile === null, 'state.profile after the tutorial ' + describe(st().profile));
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
  // v3.0 (W19 step 9 a): the morning skip goes to the creator, where openGate() is refused; the
  // gate timings are then checked on the first Yard day of week 1.
  assert(a.st().loop === LOOP.creator, '(a) loop after the morning skip ' + describe(a.st().loop));
  const og = a.sim.openGate();
  a.drain();
  assert(og && og.ok === false, '(a) openGate in the creator ' + describe(og));
  assert(a.st().phase === PHASE.morning, '(a) phase after the refused openGate ' + a.st().phase);
  a.sim.setPlayer(DEFAULT_LOOK, 'Pitmaster', 'Your Pit');
  a.drain();
  const by = a.sim.bookOffer('yard');
  const lu = a.sim.loadUp();
  a.drain();
  assert(by && by.ok && lu && lu.ok, '(a) bookOffer yard ' + describe(by) + ', loadUp ' + describe(lu));
  assert(a.st().today.gateAt === C.GATE_OPENS, '(a) today.gateAt ' + a.st().today.gateAt);
  assert(a.st().spawnAt === a.st().today.gateAt, '(a) spawnAt ' + a.st().spawnAt);
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
  // v3.0: the skipped day plays on as a Yard day and its till stays in loop tutorial.
  assert(b.until(() => b.st().phase === PHASE.evening, C.DAY_SECONDS + 10), '(b) the skipped day did not reach the till');
  assert(b.st().loop === LOOP.tutorial, '(b) loop at the till ' + describe(b.st().loop));
  assert(sameJSON([...b.loops], [LOOP.tutorial]), '(b) loops seen ' + describe([...b.loops]));
  // (c) reset starts it again
  const r0 = b.log.length;
  b.sim.reset();
  b.drain();
  assert(deepEq(b.st().tutorial, { step: 'open', done: false }), '(c) state.tutorial after reset ' + describe(b.st().tutorial));
  assert(b.of(EVENT.tutorialStep, r0).some((e) => e.id === 'open'), '(c) no tutorial_step open after reset; got ' + describe(b.log.slice(r0).map((e) => e.type)));
  assert(b.st().loop === LOOP.tutorial && b.st().profile === null, '(c) after reset loop ' + describe(b.st().loop) + ', profile ' + describe(b.st().profile));
  // (d) a v3 save with done false runs it
  const d = headless(P, P.validateSave({ v: 3, day: 1, tutorial: { done: false } }), 4);
  assert(d.stepIs('open'), '(d) tutorialStep() ' + describe(d.step()));
  assert(deepEq(d.st().tutorial, { step: 'open', done: false }), '(d) state.tutorial ' + describe(d.st().tutorial));
  assert(d.st().loop === LOOP.tutorial, '(d) loop ' + describe(d.st().loop));
  return notes.join('; ') + '; (a) creator refuses openGate; (b) till in loop tutorial; (c) reset restarts at open; (d) v3 save with done false starts at open';
}

function burnRun(P, fire, seed) {
  const C = P.C;
  const h = headless(P, null, seed);
  assert(h.sim[SIM_METHODS.skipTutorial]() === true, 'skipTutorial() did not return true');
  h.drain();
  // v3.0 (W19 step 10): service through the creator and a Yard day.
  h.sim.setPlayer(DEFAULT_LOOK, 'Pitmaster', 'Your Pit');
  const by = h.sim.bookOffer('yard');
  const og = h.sim.loadUp();
  h.drain();
  assert(by && by.ok, 'bookOffer yard ' + describe(by));
  assert(og && og.ok, 'loadUp ' + describe(og));
  assert(h.st().today.kind === 'yard', 'today.kind ' + describe(h.st().today.kind));
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
// v3.0 headless checks (W19 steps 5, 6 and 11 to 17). Expectations are computed from C with the
// W3.2, W8 and W9 formulas (W22.18); the W19 literals are asserted too while C holds the
// starting values those literals assume.
// ---------------------------------------------------------------------------------------------

const START = Object.assign({}, C_W2, { REP_DAY_MIN: -15 });
const atStart = (C, keys) => keys.every((k) => deepEq(C[k], START[k]));
const zeroMeat = () => Object.fromEntries(MEAT_IDS.map((m) => [m, 0]));
const sumOf = (o) => Object.values(o || {}).reduce((a, b) => a + (b | 0), 0);
// "{n} {label}" joined by ", " in MEAT_IDS order (the cooler, season end and open lists).
const meatListText = (P, counts) => MEAT_IDS.filter((m) => (counts[m] | 0) > 0).map((m) => counts[m] + ' ' + P.MEATS[m].label).join(', ');

function refMulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function refMix32(a, b, c) {   // W3.4, verbatim
  let h = (a >>> 0) ^ Math.imul(b | 0, 0x9E3779B1) ^ Math.imul(c | 0, 0x85EBCA77);
  h ^= h >>> 16; h = Math.imul(h, 0x7FEB352D); h ^= h >>> 15; h = Math.imul(h, 0x846CA68B); h ^= h >>> 16;
  return h >>> 0;
}

// The reference model: W3.2 numbers, W8 score and pay, W10 helpers, W3.4 generator.
function refModel(P) {
  const C = P.C, M = P.MEATS;
  const R = {};
  // W26 Q-2: the Season finale reads Normal whatever the length.
  R.headcount = (row, L) => Math.round(row.guests * C.LENGTHS[row.id === 'finale' ? 'normal' : L].factor);
  R.windowAt = (row, L) => row.window * C.LENGTHS[row.id === 'finale' ? 'normal' : L].window / C.BASE_WINDOW;
  // W3.3: an Offer's menu is in MEAT_IDS order, whatever order the row lists it in (the stretch stub lists brisket first).
  R.menuOf = (row, gear) => (row.menu === null ? MEAT_IDS.filter((m) => m !== 'brisket' || (gear && gear.drum === true)) : MEAT_IDS.filter((m) => row.menu.includes(m)));
  R.fee = (n, menu) => (menu.length ? Math.round(n * (menu.reduce((a, m) => a + M[m].price, 0) / menu.length) * C.FEE_MULT / C.FEE_ROUND) * C.FEE_ROUND : 0);
  R.deposit = (fee) => Math.round(fee * C.DEPOSIT_FRAC);
  R.split = (out, n, menu) => {
    const base = Math.floor(n / menu.length), extra = n % menu.length;
    menu.forEach((m, i) => { out[m] += base + (i < extra ? 1 : 0); });
    return out;
  };
  R.rail = (n, menu, addon) => {
    const out = zeroMeat();
    if (!menu.length || n <= 0) return out;
    if (addon) { const a = Math.round(C.ADDON_SHARE * n); out[addon] += a; return R.split(out, n - a, menu); }
    return R.split(out, n, menu);
  };
  // W24 P-1 and W25 R-3: slot seconds of a rail, and the grate seconds the cookers give at SAFE_LOAD.
  R.slotSec = (rail) => MEAT_IDS.reduce((a, m) => a + (rail[m] > 0 ? Math.ceil(rail[m] / M[m].plates) * M[m].slots * M[m].cook : 0), 0);
  R.grateSec = (gear, win) => (C.KETTLE_SLOTS * (gear && gear.kettle2 === true ? 2 : 1) + (gear && gear.drum === true ? C.DRUM_SLOTS : 0)) * (C.GATE_OPENS + win) * C.SAFE_LOAD;
  // W25 R-3: the finale books the most guests up to its row's headcount whose rail fits the grate.
  R.finaleCount = (row, L, gear) => {
    const menu = R.menuOf(row, gear);
    const top = R.headcount(row, L), least = Math.min(top, menu.length);
    const cap = R.grateSec(gear, R.windowAt(row, L)) + 1e-9;
    for (let h = top; h > least; h--) if (R.slotSec(R.rail(h, menu, null)) <= cap) return h;
    return least;
  };
  R.payTotal = (fee, stars) => Math.round(fee * (C.PAY_BASE + C.PAY_PER_STAR * stars));
  R.payRest = (fee, dep, stars) => Math.max(0, R.payTotal(fee, stars) - dep);
  R.starsOf = (score) => { const E = C.STAR_EDGES; return score >= E[3] ? 5 : score >= E[2] ? 4 : score >= E[1] ? 3 : score >= E[0] ? 2 : 1; };
  // W24 (playtest round 1): quality scales with the share fed; cold booked plates cost COLD_PENALTY.
  R.score = (i) => {
    const unfed = Math.max(0, i.booked - i.fed);
    const avg = i.booked > 0 ? (i.waitSum + C.WAIT_ZERO_S * unfed) / i.booked : C.WAIT_ZERO_S;
    const fedPts = i.booked > 0 ? C.SCORE_FED * i.fed / i.booked : 0;
    const waitPts = C.SCORE_WAIT * Math.min(1, Math.max(0, (C.WAIT_ZERO_S - avg) / (C.WAIT_ZERO_S - C.WAIT_FULL_S)));
    const qualRaw = Math.max(0, C.SCORE_QUALITY - C.BURNT_PENALTY * i.burnt - C.OFFMENU_PENALTY * i.offMenu - C.COLD_PENALTY * (i.cold || 0));
    const qualPts = i.booked > 0 ? qualRaw * Math.min(1, i.fed / i.booked) : 0;
    const score = Math.round(fedPts + waitPts + qualPts);
    return { score, stars: R.starsOf(score), parts: { fed: Math.round(fedPts), wait: Math.round(waitPts), quality: Math.round(qualPts) }, avgWait: Math.round(avg) };
  };
  R.cookable = (m, gear) => m !== 'brisket' || (gear && gear.drum === true);
  R.unlockMet = (row, rep, gear) => !row.unlock || ((row.unlock.rep === undefined || rep >= row.unlock.rep) && (row.unlock.gear === undefined || (gear && gear[row.unlock.gear] === true)));
  // W24 P-1: the grate time test. Slot seconds of the rail against grate slots x (gate + window) x SAFE_LOAD.
  R.capNeeds = (row, input) => {
    if (row.id === 'yard' || row.id === 'finale') return '';
    const L = input.length;
    const rail = R.rail(R.headcount(row, L), R.menuOf(row, input.gear), null);
    let need = 0;
    for (const m of MEAT_IDS) if (rail[m] > 0) need += Math.ceil(rail[m] / M[m].plates) * M[m].slots * M[m].cook;
    const span = C.GATE_OPENS + R.windowAt(row, L);
    const g = input.gear || {};
    const fits = (k2, dr) => need <= (C.KETTLE_SLOTS * (k2 ? 2 : 1) + (dr ? C.DRUM_SLOTS : 0)) * span * C.SAFE_LOAD + 1e-9;
    const k2 = g.kettle2 === true, dr = g.drum === true;
    if (fits(k2, dr)) return '';
    if (!k2 && fits(true, dr)) return P.STRINGS.ui.needsKettle2;
    if (!dr && fits(true, true)) return P.STRINGS.ui.needsDrum;
    return '';
  };
  R.safe = (row, input) => R.menuOf(row, input.gear).every((m) => R.cookable(m, input.gear)) && R.unlockMet(row, input.rep, input.gear) && R.capNeeds(row, input) === '';
  R.offer = (row, input) => {
    const L = input.length;
    const menu = R.menuOf(row, input.gear);
    const n = row.id === 'yard' ? 0 : (row.id === 'finale' ? R.finaleCount(row, L, input.gear) : R.headcount(row, L));
    const fee = row.id === 'yard' ? 0 : R.fee(n, menu);
    return { id: row.id, type: row.id, label: row.label, venue: row.venue, host: null, headcount: n, menu,
      rail: R.rail(n, menu, null), pay: fee, deposit: R.deposit(fee), difficulty: row.flames,
      window: R.windowAt(row, L), patience: row.patience, safe: R.safe(row, input) };
  };
  // W3.4 with W22.13: returns the offers plus how the picks were made (for notes).
  R.gen = (input) => {
    const B = P.BOOKINGS;
    const names = P.STRINGS.names;
    const types = input.types || BOOKING_IDS.filter((id) => id !== 'finale' && id !== 'yard').map((id) => B[id]);
    const r = refMulberry32(refMix32(input.seed, input.year, input.week));
    const hostFor = (used) => {
      let k = Math.floor(r() * names.length);
      while (used.has(names[k])) k = (k + 1) % names.length;
      used.add(names[k]);
      return names[k];
    };
    if (input.week === C.SEASON_WEEKS) {
      const f = R.offer(B.finale, input);
      f.host = hostFor(new Set());
      return { offers: [f], swapped: false, rawStretch: false };
    }
    const third = input.rep >= C.THIRD_EDGES[1] ? 2 : input.rep >= C.THIRD_EDGES[0] ? 1 : 0;
    const slots = C.OFFER_SLOTS[third];
    const invite = third === C.INVITE_THIRD;
    const idx = (row) => types.indexOf(row);
    const unlocked = types.filter((row) => R.unlockMet(row, input.rep, input.gear));
    const feeOf = (row) => R.offer(row, input).pay;
    const isSafe = (row) => R.safe(row, input);
    const picked = [];
    const bday = unlocked.find((row) => row.id === 'birthday');
    if (input.cash < C.LOW_CASH_BIRTHDAY && bday) picked.push(bday);
    const rest = unlocked.filter((row) => !picked.includes(row));
    for (let i = rest.length - 1; i >= 1; i--) {
      const j = Math.floor(r() * (i + 1));
      const t = rest[i]; rest[i] = rest[j]; rest[j] = t;
    }
    for (const row of rest) if (picked.length < slots && !picked.includes(row)) picked.push(row);
    let swapped = false;
    const rawStretch = picked.length > 0 && !picked.some(isSafe);
    if (rawStretch) {
      const safeRows = unlocked.filter(isSafe).sort((a, b) => feeOf(a) - feeOf(b) || idx(a) - idx(b));
      if (safeRows.length) { picked[picked.length - 1] = safeRows[0]; swapped = true; }
    }
    if (invite) {
      const cand = unlocked.filter((row) => isSafe(row) && !picked.includes(row)).sort((a, b) => feeOf(b) - feeOf(a) || idx(a) - idx(b));
      if (cand.length) picked.push(cand[0]);
    }
    const offers = picked.map((row) => ({ row, o: R.offer(row, input) }));
    const order = (a, b) => (a.o.difficulty - b.o.difficulty) || (a.o.pay - b.o.pay) || (idx(a.row) - idx(b.row));
    const sorted = offers.filter((x) => x.o.safe).sort(order).concat(offers.filter((x) => !x.o.safe).sort(order)).map((x) => x.o);
    const used = new Set();
    for (const o of sorted) o.host = hostFor(used);
    sorted.push(R.offer(B.yard, input));
    return { offers: sorted, swapped, rawStretch };
  };
  // W10.4: keep units by unit cost, highest first, up to cap.
  R.keepByCost = (stock, cap) => {
    const order = MEAT_IDS.slice().sort((a, b) => M[b].unit - M[a].unit);
    const keep = zeroMeat(), spoil = zeroMeat();
    let room = cap;
    for (const m of order) { const k = Math.min(stock[m] | 0, room); keep[m] = k; spoil[m] = (stock[m] | 0) - k; room -= k; }
    return { keep, spoil };
  };
  R.eventUnits = (rail) => MEAT_IDS.reduce((a, m) => a + (rail[m] > 0 ? Math.ceil(rail[m] * 1.5 / M[m].plates) : 0), 0);
  return R;
}
// The projection of an Offer the harness compares (W3.3 fields).
const offerView = (o) => ({ id: o.id, type: o.type, label: o.label, venue: o.venue, host: o.host, headcount: o.headcount, menu: o.menu,
  rail: o.rail, pay: o.pay, deposit: o.deposit, difficulty: o.difficulty, window: o.window, patience: o.patience, safe: o.safe });

function surfaceV3(P, sim) {
  const C = P.C;
  const notes = [];
  for (const [k, v] of Object.entries(C_W2_EXACT)) assert(deepEq(C[k], v), 'C.' + k + ' is ' + describe(C[k]) + ', wanted ' + describe(v));
  const tuned = [];
  for (const [k, v] of Object.entries(C_W2)) {
    assert(k in C, 'C.' + k + ' missing (W2)');
    if (C_W2_FIXED.includes(k)) { assert(deepEq(C[k], v), 'C.' + k + ' is ' + describe(C[k]) + ', wanted exactly ' + describe(v)); continue; }
    if (Array.isArray(v)) {
      assert(Array.isArray(C[k]) && C[k].length === v.length && C[k].every((x) => Number.isFinite(x)), 'C.' + k + ' is ' + describe(C[k]) + ', wanted ' + v.length + ' numbers');
    } else if (typeof v === 'number') {
      assert(typeof C[k] === 'number' && Number.isFinite(C[k]), 'C.' + k + ' is ' + describe(C[k]) + ', wanted a number');
    }
    if (!deepEq(C[k], v)) tuned.push(k + ' ' + describe(v) + ' to ' + describe(C[k]));
  }
  assert(C.COOLER_CAP[0] === 0, 'C.COOLER_CAP[0] is ' + C.COOLER_CAP[0] + ', wanted 0 (fixed)');
  assert(sameJSON(P.BOOKING_IDS, BOOKING_IDS), 'BOOKING_IDS ' + describe(P.BOOKING_IDS));
  const rowKeys = ['id', 'label', 'guests', 'menu', 'patience', 'window', 'flames', 'venue', 'icon', 'unlock'];
  for (const id of BOOKING_IDS) {
    const row = P.BOOKINGS[id];
    assert(row && Object.isFrozen(row), 'BOOKINGS.' + id + ' missing or not frozen');
    const want = Object.assign({}, BOOKINGS_EXPECT[id]);
    if (want.patience === 'PATIENCE_BASE') want.patience = C.PATIENCE_BASE;
    const got = Object.fromEntries(rowKeys.map((k) => [k, row[k]]));
    assert(deepEq(got, want), 'BOOKINGS.' + id + ' is ' + describe(got) + ', wanted ' + describe(want));
    assert(P.STRINGS.booking[id] === row.label, 'BOOKINGS.' + id + '.label differs from STRINGS.booking');
  }
  assert(sameJSON(P.LOOK_KEYS, LOOK_KEYS), 'LOOK_KEYS ' + describe(P.LOOK_KEYS));
  assert(deepEq(P.LOOK_COUNTS, LOOK_COUNTS), 'LOOK_COUNTS ' + describe(P.LOOK_COUNTS));
  assert(deepEq(P.DEFAULT_LOOK, DEFAULT_LOOK), 'DEFAULT_LOOK ' + describe(P.DEFAULT_LOOK));
  for (const n of ['genOffers', 'scoreEvent', 'cleanName', 'filterName']) assert(typeof P[n] === 'function', 'PitSim.' + n + ' is not a function');
  // W15: every key with its exact text.
  const S = P.STRINGS;
  let texts = 0;
  const extra = [];
  for (const [k, want] of Object.entries(W15)) {
    if (k === 'tutorial') continue;
    const got = S[k];
    if (want && typeof want === 'object' && !Array.isArray(want)) {
      assert(got && typeof got === 'object', 'STRINGS.' + k + ' missing');
      for (const [kk, ww] of Object.entries(want)) {
        assert(deepEq(got[kk], ww), 'STRINGS.' + k + '.' + kk + ' is ' + describe(got[kk]) + ', wanted ' + describe(ww));
        texts += 1;
      }
      for (const kk of Object.keys(got)) if (!(kk in want)) extra.push(k + '.' + kk);
    } else {
      assert(deepEq(got, want), 'STRINGS.' + k + ' is ' + describe(got) + ', wanted ' + describe(want));
      texts += 1;
    }
  }
  const names = S.names;
  assert(Array.isArray(names) && names.length === 60, 'STRINGS.names has ' + (names && names.length) + ' entries');
  assert(new Set(names).size === names.length, 'STRINGS.names has duplicates');
  const banned = names.filter((n) => BANNED_NAMES.includes(n));
  assert(banned.length === 0, 'STRINGS.names holds ' + banned.join(', '));
  const missingM = SIM_METHODS_V3.filter((m) => !Object.prototype.hasOwnProperty.call(sim, m) || typeof sim[m] !== 'function');
  assert(missingM.length === 0, 'sim methods missing (own function properties): ' + missingM.join(', '));
  assert(typeof sim.continueFromTill === 'function', 'sim.continueFromTill (the alias) missing');
  assert(deepEq(P.MAP.signText, SIGN_TEXT), 'MAP.signText is ' + describe(P.MAP.signText) + ', wanted ' + describe(SIGN_TEXT));
  const sign = P.MAP.props.find((p) => p.id === 'sign');
  assert(sign && sign.draw && sign.draw.x === SIGN_DRAW.x && sign.draw.y === SIGN_DRAW.y, 'the sign prop draws at ' + describe(sign && sign.draw) + ', wanted ' + describe(SIGN_DRAW));
  const gameSrc = fs.readFileSync(FILES.game, 'utf8');
  assert(!gameSrc.includes('settle('), 'game.js source contains settle(');
  if (tuned.length) notes.push('tuned: ' + tuned.join('; '));
  if (extra.length) notes.push('extra STRINGS keys ' + extra.slice(0, 6).join(', ') + (extra.length > 6 ? ' and ' + (extra.length - 6) + ' more' : ''));
  report.metrics.cTuned = tuned;
  return 'v3.0: ' + Object.keys(C_W2).length + ' W2 keys, ' + texts + ' W15 texts exact, 60 names, ' + SIM_METHODS_V3.length + ' methods, sign at ' + SIGN_DRAW.x + ',' + SIGN_DRAW.y + (notes.length ? '; ' + notes.join('; ') : '; every C value at its starting value');
}

function migratedDefaults(s, label) {
  assert(s && s.v === 4, label + ': v ' + describe(s && s.v));
  assert(s.player === null, label + ': player ' + describe(s.player));
  assert(s.pitName === W15.defaultPit, label + ': pitName ' + describe(s.pitName));
  assert(s.season && s.season.year === 1 && s.season.week === 1 && sameJSON(s.season.results, []), label + ': season ' + describe(s.season));
  assert(s.season.pick === null && s.season.addon === null, label + ': pick and addon ' + describe(s.season && [s.season.pick, s.season.addon]));
  assert(Number.isInteger(s.season.seed) && s.season.seed >= 0, label + ': season.seed ' + describe(s.season.seed));
  assert(s.settings && s.settings.length === 'normal', label + ': settings ' + describe(s.settings));
  assert(s.wood === 0, label + ': wood ' + describe(s.wood));
}

function validateV4(P) {
  const V = (o) => P.validateSave(JSON.parse(JSON.stringify(o)));
  const base = () => JSON.parse(JSON.stringify(SAVE_V4_SAMPLE));
  const rt = V(SAVE_V4_SAMPLE);
  assert(deepEq(rt, SAVE_V4_SAMPLE), 'the W13.1 sample does not round trip: ' + describe(rt));
  const cases = [
    ['charcoal 500', (s) => { s.charcoal = 500; }, (r) => r.charcoal === 200],
    ['wood -3', (s) => { s.wood = -3; }, (r) => r.wood === 0],
    ['week 7 with 3 results', (s) => { s.season.week = 7; s.season.results = s.season.results.slice(0, 3); s.season.pick = null; }, (r) => r.season.week === 4 && r.season.results.length === 3],
    ['9 results with week 2', (s) => { s.season.week = 2; s.season.results = s.season.results.concat([{ type: 'birthday', stars: 3 }, { type: 'finale', stars: 4 }]); s.season.pick = null; }, (r) => r.season.week === 9 && r.season.results.length === 9 && r.season.pick === null],
    ['a bad result type', (s) => { s.season.week = 3; s.season.results = [{ type: 'bogus', stars: 3 }, { type: 'birthday', stars: 3 }]; s.season.pick = null; }, (r) => deepEq(r.season.results, [{ type: 'birthday', stars: 3 }]) && r.season.week === 2],
    ['stars 9', (s) => { s.season.week = 2; s.season.results = [{ type: 'picnic', stars: 9 }]; s.season.pick = null; }, (r) => r.season.results[0] && r.season.results[0].stars === 5],
    ['yard stars 4', (s) => { s.season.week = 2; s.season.results = [{ type: 'yard', stars: 4 }]; s.season.pick = null; }, (r) => r.season.results[0] && r.season.results[0].stars === 0],
    ['pick finale in week 3', (s) => { s.season.week = 3; s.season.results = s.season.results.slice(0, 2); s.season.pick = 'finale'; }, (r) => r.season.week === 3 && r.season.pick === null],
    ['addon brisket without the drum', (s) => { s.season.addon = 'brisket'; }, (r) => r.season.addon === null],
    ['player.name Ana<b>!', (s) => { s.player.name = 'Ana<b>!'; }, (r) => r.player && r.player.name === 'Anab'],
    ['look.skin 9', (s) => { s.player.look.skin = 9; }, (r) => r.player && r.player.look.skin === DEFAULT_LOOK.skin],
    ["pitName ''", (s) => { s.pitName = ''; }, (r) => r.pitName === W15.defaultPit],
    ['settings.length turbo', (s) => { s.settings.length = 'turbo'; }, (r) => r.settings.length === 'normal'],
    ['day 1 owing the tutorial with a player', (s) => { s.day = 1; s.tutorial = { done: false }; }, (r) => r.player === null && r.tutorial.done === false && r.season.week === 1 && r.season.results.length === 0]
  ];
  for (const [label, mut, ok] of cases) {
    const s = base();
    mut(s);
    let r;
    try { r = V(s); } catch (e) { throw new Error('v4 ' + label + ' threw: ' + e.message); }
    assert(r && r.v === 4, 'v4 ' + label + ' returned ' + describe(r && r.v));
    assert(ok(r), 'v4 ' + label + ' gave ' + describe({ charcoal: r.charcoal, wood: r.wood, season: r.season, player: r.player, pitName: r.pitName, settings: r.settings }));
  }
  const cyc = base(); cyc.season.self = cyc; cyc.player.look.loop = cyc;
  let threw = null;
  try { P.validateSave(cyc); } catch (e) { threw = e; }
  assert(!threw, 'cyclic v4 threw: ' + (threw && threw.message));
  return 'W13.1 sample round trips, ' + cases.length + ' dirty v4 cases clamp as W19 says';
}

// A headless sim on the week 1 hub (skip, then the creator with the default look).
function toWeek(P, seed, look, name, pit) {
  const h = headless(P, null, seed);
  assert(h.sim.skipTutorial() === true, 'skipTutorial() did not return true');
  h.drain();
  h.sim.setPlayer(look || DEFAULT_LOOK, name || W15.defaultName, pit || W15.defaultPit);
  h.drain();
  assert(h.st().loop === LOOP.week && h.st().phase === PHASE.morning, 'not on the week hub: loop ' + describe(h.st().loop) + ', phase ' + h.st().phase);
  return h;
}
const toReport = (h, extra = 10) => h.until(() => h.st().loop === LOOP.report, (h.st().today && h.st().today.endAt ? h.st().today.endAt : 160) + extra);
const cartView = (st) => ({ meat: Object.assign({}, st.cart.meat), charcoal: st.cart.charcoal });

// Step 11 setup: kettle 1 lit, two sausages on it, a third in hand.
function fullGrateSetup(P, seed) {
  const C = P.C;
  const h = headless(P, null, seed);
  const og = h.sim.openGate();
  h.drain();
  assert(og && og.ok, 'openGate ' + describe(og));
  const k1 = () => h.st().stations.kettle1;
  assert(h.goSettled('pile', () => carryIs(h, CARRY_KIND.charcoal)), 'pile: carrying ' + describe(h.st().player.carrying));
  assert(h.goSettled('kettle1', () => k1().fire >= C.FIRE_LIGHT - 1), 'kettle 1 not lit: ' + k1().fire);
  for (let i = 1; i <= 2; i++) {
    assert(h.goSettled('cooler', () => carryIs(h, CARRY_KIND.raw, MEAT)), 'cooler ' + i + ': carrying ' + describe(h.st().player.carrying));
    assert(h.goSettled('kettle1', () => k1().pieces.length >= i), 'kettle 1 has ' + k1().pieces.length + ' pieces after put on ' + i);
  }
  assert(h.goSettled('cooler', () => carryIs(h, CARRY_KIND.raw, MEAT)), 'third sausage: carrying ' + describe(h.st().player.carrying));
  h.tick();
  return h;
}

function strandsHeadless(P) {
  const C = P.C, T = P.STRINGS.tutorial;
  const notes = [];
  // (a) a full grate points at the cooler (W24 P-6, harness P-4); putting the piece back clears the row.
  const a = fullGrateSetup(P, 21);
  assert(a.st().stations.kettle1.pieces.length === 2, '(a) kettle 1 pieces ' + a.st().stations.kettle1.pieces.length);
  const sa = a.step();
  assert(sa && sa.id === 'full' && sa.target === 'cooler' && sa.text === T.full, '(a) tutorialStep() ' + describe(sa));
  assert(a.log.some((e) => e.type === EVENT.tutorialStep && e.id === 'full'), '(a) no tutorial_step full');
  assert(carryIs(a, CARRY_KIND.raw, MEAT), '(a) not holding the raw sausage at the cooler: ' + describe(a.st().player.carrying));
  const stockA = a.st().stock[MEAT];
  const label = a.sim.verbAt().label;
  assert(label === 'Put ' + P.MEATS[MEAT].label + ' back', '(a) verbAt().label at the cooler ' + describe(label));
  a.sim.interact();
  a.drain();
  const after = a.step();
  assert(!after || after.id !== 'full', '(a) the step stayed full after the put back');
  assert(a.st().stock[MEAT] === stockA + 1 && a.st().player.carrying === null, '(a) put back left stock ' + a.st().stock[MEAT] + ', hands ' + describe(a.st().player.carrying));
  notes.push('(a) full at the cooler, ' + describe(label) + ', then ' + (after ? after.id : 'null'));
  // (a2) W26 Q-3: the arrow points at the cooler, so a tap on the cooler (walkTo its tile, the call a
  // canvas tap makes) puts the piece back with no button.
  const a2 = fullGrateSetup(P, 25);
  const s2 = a2.step();
  assert(s2 && s2.id === 'full' && s2.target === 'cooler', '(a2) tutorialStep() ' + describe(s2));
  const v2 = a2.sim.verbAt();
  assert(v2.label === label && v2.auto === true, '(a2) verbAt() at the cooler ' + describe(v2) + ', wanted ' + describe(label) + ' on a tap');
  const stockA2 = a2.st().stock[MEAT];
  const ct = P.MAP.station('cooler').tiles[0];
  assert(a2.sim.walkTo(ct.x, ct.y) === true, '(a2) walkTo the cooler tile refused');
  a2.drain();
  assert(a2.until(() => a2.st().player.carrying === null, 2), '(a2) still holding ' + describe(a2.st().player.carrying) + ' after the tap');
  assert(a2.st().stock[MEAT] === stockA2 + 1, '(a2) stock ' + a2.st().stock[MEAT] + ', wanted ' + (stockA2 + 1));
  notes.push('(a2) a tap on the cooler put it back');
  // (b) trashing the only meat refills one sausage (deviation 12: kettle 1 lit first).
  const b = headless(P, null, 22);
  b.sim.buy('chicken', -99);
  for (const m of MEAT_IDS) if (m !== MEAT) b.sim.buy(m, -99);
  b.sim.buy(MEAT, 1 - b.st().cart.meat[MEAT]);
  b.sim.buy('charcoal', 1 - b.st().cart.charcoal);
  assert(deepEq(cartView(b.st()), { meat: Object.assign(zeroMeat(), { [MEAT]: 1 }), charcoal: 1 }), '(b) cart ' + describe(cartView(b.st())));
  const ogb = b.sim.openGate();
  b.drain();
  assert(ogb && ogb.ok, '(b) openGate ' + describe(ogb));
  assert(b.goSettled('pile', () => carryIs(b, CARRY_KIND.charcoal)), '(b) pile: carrying ' + describe(b.st().player.carrying));
  assert(b.goSettled('kettle1', () => b.st().stations.kettle1.fire >= C.FIRE_LIGHT - 1), '(b) kettle 1 not lit');
  assert(b.goSettled('cooler', () => carryIs(b, CARRY_KIND.raw, MEAT)), '(b) cooler: carrying ' + describe(b.st().player.carrying));
  assert(b.st().stock[MEAT] === 0, '(b) stock after the grab ' + describe(b.st().stock));
  // W26 Q-3: with room on the grate the put back stays a button verb, so a second tap never undoes a take.
  const vb = b.sim.verbAt();
  assert(vb.label === 'Put ' + P.MEATS[MEAT].label + ' back' && vb.auto === false, '(b) verbAt() at the cooler with room on the grate ' + describe(vb));
  const cash0 = b.st().cash;
  const n0 = b.log.length;
  b.sim.walkTo(3, 4);
  b.drain();
  b.until(() => b.settled(), WAIT_S.headlessStep);
  b.sim.interact();
  b.drain();
  b.tick();
  const refills = b.of(EV3.tutorialRefill, n0);
  assert(refills.length === 1 && deepEq(strip(refills[0]), { type: EV3.tutorialRefill, kind: 'meat', meat: MEAT }), '(b) tutorial_refill events ' + describe(refills.map(strip)));
  assert(b.st().stock[MEAT] === 1, '(b) stock.' + MEAT + ' ' + b.st().stock[MEAT]);
  assert(b.stepIs('meat', 'cooler'), '(b) step ' + describe(b.step()));
  assert(b.st().cash === cash0, '(b) cash ' + cash0 + ' became ' + b.st().cash);
  notes.push('(b) one meat refill, step meat at the cooler');
  // (c) no charcoal and a cold kettle refill one bag.
  const c = headless(P, null, 23);
  const ogc = c.sim.openGate();
  c.drain();
  assert(ogc && ogc.ok, '(c) openGate ' + describe(ogc));
  const m0 = c.log.length;
  c.st().charcoal = 0;   // fixture (W0: Node steps may write a headless state)
  c.tick();
  const rc = c.of(EV3.tutorialRefill, m0);
  assert(rc.length === 1 && rc[0].kind === 'charcoal', '(c) tutorial_refill events ' + describe(rc.map(strip)));
  assert(c.st().charcoal === 1, '(c) charcoal ' + c.st().charcoal);
  assert(c.stepIs('charcoal'), '(c) step ' + describe(c.step()));
  notes.push('(c) one charcoal refill');
  // (d) a second cooker with room gives fullGrate.
  const d = fullGrateSetup(P, 24);
  d.st().gear.kettle2 = true;   // fixture
  d.tick();
  const sd = d.step();
  assert(sd && sd.id === 'fullGrate' && sd.target === 'kettle2' && sd.text === T.fullGrate, '(d) tutorialStep() ' + describe(sd));
  notes.push('(d) fullGrate at kettle2');
  return notes.join('; ');
}

function generatorHeadless(P) {
  const C = P.C;
  const R = refModel(P);
  const notes = [];
  const noGear = Object.fromEntries(GEAR_IDS.map((g) => [g, false]));
  const base = { seed: 7, year: 1, rep: 20, cash: 80, gear: noGear, length: 'normal' };
  const cmp = (input, label) => {
    const got = P.genOffers(input);
    const want = R.gen(input);
    assert(Array.isArray(got), label + ': genOffers returned ' + describe(got));
    assert(got.every((o) => Object.isFrozen(o)), label + ': an offer is not frozen');
    assert(deepEq(got.map(offerView), want.offers.map(offerView)), label + ': genOffers ' + describe(got.map((o) => [o.id, o.host, o.pay])) + ', reference ' + describe(want.offers.map((o) => [o.id, o.host, o.pay])));
    for (const o of got) {
      assert(typeof o.needs === 'string' && (o.safe ? o.needs === '' : o.needs.length > 0), label + ': ' + o.id + ' needs ' + describe(o.needs) + ' with safe ' + o.safe);
    }
    const hosts = got.filter((o) => o.type !== 'yard').map((o) => o.host);
    assert(hosts.every((h) => P.STRINGS.names.includes(h)), label + ': hosts ' + describe(hosts));
    assert(new Set(hosts).size === hosts.length, label + ': hosts repeat ' + describe(hosts));
    const y = got.find((o) => o.type === 'yard');
    if (y) assert(y.host === null, label + ': the Yard day host ' + describe(y.host));
    return { got, want };
  };
  for (let w = 1; w <= 8; w++) {
    const { got } = cmp(Object.assign({}, base, { week: w }), 'week ' + w);
    assert(sameJSON(got.map((o) => o.id), ['birthday', 'picnic', 'yard']), 'week ' + w + ' ids ' + describe(got.map((o) => o.id)));
  }
  const w1 = P.genOffers(Object.assign({}, base, { week: 1 }));
  assert(deepEq(w1, P.genOffers(Object.assign({}, base, { week: 1 }))), 'the same input twice differs');
  const by = (list, id) => list.find((o) => o.id === id);
  const lit = atStart(C, ['FEE_MULT', 'FEE_ROUND', 'DEPOSIT_FRAC']);
  const bd = by(w1, 'birthday'), pc = by(w1, 'picnic'), yd = by(w1, 'yard');
  const expectOffer = (o, want, label) => {
    for (const [k, v] of Object.entries(want)) assert(deepEq(o[k], v), label + '.' + k + ' is ' + describe(o[k]) + ', wanted ' + describe(v));
  };
  expectOffer(bd, { headcount: 12, menu: ['sausage', 'chicken'], rail: Object.assign(zeroMeat(), { sausage: 6, chicken: 6 }), difficulty: 1, window: 60, patience: 45, pay: R.fee(12, ['sausage', 'chicken']), deposit: R.deposit(R.fee(12, ['sausage', 'chicken'])) }, 'birthday');   // W26 Q-5: window 60
  expectOffer(pc, { headcount: 20, menu: ['chicken', 'butt'], rail: Object.assign(zeroMeat(), { chicken: 10, butt: 10 }), difficulty: 2, window: 80, patience: 50, pay: R.fee(20, ['chicken', 'butt']), deposit: R.deposit(R.fee(20, ['chicken', 'butt'])) }, 'picnic');
  expectOffer(yd, { headcount: 0, menu: [], pay: 0, deposit: 0, rail: zeroMeat() }, 'yard');
  if (lit) {
    assert(bd.pay === 100 && bd.deposit === 30 && pc.pay === 275 && pc.deposit === 83, 'literals: birthday ' + bd.pay + '/' + bd.deposit + ', picnic ' + pc.pay + '/' + pc.deposit + ', wanted 100/30 and 275/83');
    notes.push('fees 100 and 275, deposits 30 and 83 (literal)');
  } else notes.push('fees ' + bd.pay + ' and ' + pc.pay + ' from tuned C');
  // W24 P-1: one kettle cannot feed the Church picnic, two can; the Birthday fits one at every length.
  for (const L of C.LENGTH_ORDER) {
    const one = P.genOffers(Object.assign({}, base, { week: 1, length: L }));
    const two = P.genOffers(Object.assign({}, base, { week: 1, length: L, gear: Object.assign({}, noGear, { kettle2: true }) }));
    const p1 = by(one, 'picnic'), p2 = by(two, 'picnic'), b1 = by(one, 'birthday');
    assert(p1.safe === false && p1.needs === P.STRINGS.ui.needsKettle2, L + ': one kettle picnic safe ' + p1.safe + ', needs ' + describe(p1.needs));
    assert(p2.safe === true && p2.needs === '', L + ': two kettle picnic safe ' + p2.safe + ', needs ' + describe(p2.needs));
    assert(b1.safe === true, L + ': one kettle Birthday is not safe: ' + describe(b1.needs));
  }
  notes.push('the picnic needs the second kettle at every length');
  const LENS = { short: { bd: 8, pc: 14, bdWin: 41.25, win: 55, fees: [65, 195] }, long: { bd: 16, pc: 26, bdWin: 78.75, win: 105, fees: [130, 360] } };
  for (const [L, want] of Object.entries(LENS)) {
    const list = cmp(Object.assign({}, base, { week: 1, length: L }), L).got;
    const b2 = by(list, 'birthday'), p2 = by(list, 'picnic');
    assert(b2.headcount === want.bd && p2.headcount === want.pc, L + ' headcounts ' + b2.headcount + ', ' + p2.headcount);
    assert(b2.window === want.bdWin && p2.window === want.win, L + ' windows ' + b2.window + ', ' + p2.window + ', wanted ' + want.bdWin + ' and ' + want.win);
    if (lit) assert(b2.pay === want.fees[0] && p2.pay === want.fees[1], L + ' fees ' + b2.pay + ', ' + p2.pay + ', wanted ' + want.fees.join(', '));
  }
  // W25 R-3 and W26 Q-2: the finale is sized to the owned grate (16, 33 and 40 guests) and reads the
  // same at every length.
  for (const L of ['short', 'long']) {
    for (const gear of [noGear, Object.assign({}, noGear, { kettle2: true }), Object.assign({}, noGear, { kettle2: true, drum: true })]) {
      const n = P.genOffers(Object.assign({}, base, { week: 9, gear }))[0], o = P.genOffers(Object.assign({}, base, { week: 9, gear, length: L }))[0];
      assert(o.headcount === n.headcount && o.pay === n.pay && o.window === n.window, L + ' finale ' + describe(offerView(o)) + ' differs from Normal ' + describe(offerView(n)));
    }
  }
  const f9 = cmp(Object.assign({}, base, { week: 9 }), 'week 9').got;
  assert(f9.length === 1 && f9[0].id === 'finale', 'week 9 offers ' + describe(f9.map((o) => o.id)));
  assert(sameJSON(f9[0].menu, ['sausage', 'chicken', 'ribs', 'butt']) && f9[0].safe === true, 'finale ' + describe(offerView(f9[0])));
  const f9k = cmp(Object.assign({}, base, { week: 9, gear: Object.assign({}, noGear, { kettle2: true }) }), 'week 9 on two kettles').got;
  const f9d = cmp(Object.assign({}, base, { week: 9, gear: Object.assign({}, noGear, { kettle2: true, drum: true }) }), 'week 9 with the drum').got;
  assert(f9d[0].menu.length === 5 && f9d[0].headcount === Math.round(40 * C.LENGTHS.normal.factor), 'finale with the drum ' + describe(offerView(f9d[0])));
  for (const [f, gear] of [[f9[0], noGear], [f9k[0], Object.assign({}, noGear, { kettle2: true })], [f9d[0], Object.assign({}, noGear, { kettle2: true, drum: true })]]) {
    assert(R.slotSec(f.rail) <= R.grateSec(gear, f.window) + 1e-9 || f.headcount === f.menu.length, 'finale ' + f.headcount + ' guests overruns the grate: ' + R.slotSec(f.rail) + ' of ' + R.grateSec(gear, f.window));
  }
  assert(f9[0].headcount < f9k[0].headcount && f9k[0].headcount < f9d[0].headcount, 'finale headcounts ' + [f9[0].headcount, f9k[0].headcount, f9d[0].headcount].join(', '));
  if (atStart(C, ['SAFE_LOAD'])) {
    assert(f9[0].headcount === 16 && f9k[0].headcount === 33 && f9d[0].headcount === 40, 'finale headcounts ' + [f9[0].headcount, f9k[0].headcount, f9d[0].headcount].join(', ') + ', W26 literal 16, 33, 40');
    assert(deepEq(f9d[0].rail, Object.fromEntries(MEAT_IDS.map((m) => [m, 8]))), 'finale rail with the drum ' + describe(f9d[0].rail));
    if (lit) assert(f9[0].pay === 190 && f9k[0].pay === 390 && f9d[0].pay === 560, 'finale fees ' + [f9[0].pay, f9k[0].pay, f9d[0].pay].join(', ') + ', wanted 190, 390 and 560');
    assert(f9[0].window === 105, 'finale window ' + f9[0].window + ', W26 literal 105');
  }
  notes.push('finale ' + [f9[0].headcount, f9k[0].headcount, f9d[0].headcount].join(', ') + ' guests on one kettle, two, and the drum');
  const low = cmp(Object.assign({}, base, { week: 2, cash: 50 }), 'cash 50').got;
  assert(low.some((o) => o.id === 'birthday'), 'cash 50 has no Birthday ' + describe(low.map((o) => o.id)));
  // offerSlots() by third, on a sim with a rep fixture.
  const sim = P.createSim(null, 1);
  for (const rep of [33, 34, 66, 67]) {
    sim.state.rep = rep;   // fixture
    const third = rep >= C.THIRD_EDGES[1] ? 2 : rep >= C.THIRD_EDGES[0] ? 1 : 0;
    assert(sim.fanThird() === third, 'fanThird() at rep ' + rep + ' is ' + sim.fanThird());
    assert(deepEq(sim.offerSlots(), { slots: C.OFFER_SLOTS[third], invite: third === C.INVITE_THIRD }), 'offerSlots() at rep ' + rep + ' is ' + describe(sim.offerSlots()));
  }
  // Stub types: five safe rows; slots, dedupe, invite and display order.
  const stub = (id, guests, menu, flames) => Object.freeze({ id, label: 'Stub ' + id, guests, menu: Object.freeze(menu), patience: 45, window: 80, flames, venue: 'backyard', icon: 'ev_birthday', unlock: null });
  const five = [stub('s1', 10, ['sausage'], 1), stub('s2', 12, ['chicken'], 2), stub('s3', 14, ['ribs'], 1), stub('s4', 8, ['butt'], 3), stub('s5', 16, ['sausage', 'chicken'], 2)];
  for (const [rep, n] of [[20, 2], [50, 3], [80, 4]]) {
    for (let w = 1; w <= 8; w++) {
      const got = cmp(Object.assign({}, base, { week: w, rep, types: five }), 'stub rep ' + rep + ' week ' + w).got;
      const books = got.filter((o) => o.type !== 'yard');
      assert(books.length === n, 'stub rep ' + rep + ' week ' + w + ': ' + books.length + ' bookings, wanted ' + n);
      assert(new Set(books.map((o) => o.type)).size === books.length, 'stub rep ' + rep + ': a type twice');
      for (let i = 1; i < books.length; i++) {
        const a = books[i - 1], b = books[i];
        assert(a.difficulty < b.difficulty || (a.difficulty === b.difficulty && a.pay <= b.pay), 'stub rep ' + rep + ' week ' + w + ' order ' + describe(books.map((o) => [o.id, o.difficulty, o.pay])));
      }
      assert(got[got.length - 1].type === 'yard', 'stub rep ' + rep + ': the Yard day is not last');
      if (rep === 80) {
        // Three shuffled picks plus the invite: the one left out is never the best paying of the two the shuffle left.
        const left = five.filter((r) => !books.some((o) => o.id === r.id));
        assert(left.length === 1, 'stub rep 80 left out ' + describe(left.map((r) => r.id)));
      }
    }
  }
  // A stub list of stretch rows (brisket without the drum) and one safe row.
  const stretch = [stub('b1', 10, ['brisket'], 1), stub('b2', 12, ['brisket'], 2), stub('b3', 14, ['brisket'], 3), stub('b4', 8, ['brisket', 'sausage'], 1), stub('ok', 10, ['sausage'], 2)];
  let swaps = 0;
  for (let w = 1; w <= 8; w++) {
    const input = Object.assign({}, base, { week: w, types: stretch });
    const { got, want } = cmp(input, 'stretch week ' + w);
    if (want.swapped) swaps += 1;
    const books = got.filter((o) => o.type !== 'yard');
    assert(books.some((o) => o.safe), 'stretch week ' + w + ': no safe offer ' + describe(books.map((o) => [o.id, o.safe])));
    const firstStretch = books.findIndex((o) => !o.safe);
    assert(firstStretch < 0 || books.slice(firstStretch).every((o) => !o.safe), 'stretch week ' + w + ': a safe offer after a stretch one');
  }
  notes.push('stub slots 2, 3, 3 plus invite; stretch list kept a safe offer every week (' + swaps + ' of 8 weeks took the safe swap)');
  if (swaps === 0) notes.push('no week drew two stretch picks, so the swap path ran 0 times on seed 7');
  return '8 weeks match the W3.4 reference (ids, hosts, numbers), short and long, week 9 finale 4 or 5 meats; ' + notes.join('; ');
}

function starsHeadless(P) {
  const C = P.C;
  const R = refModel(P);
  const notes = [];
  // W24 table: quality by the share fed (cases 2, 4, 5 changed), and cold plates (cases 6 and 7).
  const cases = [
    { in: { booked: 12, fed: 12, waitSum: 15 * 12, burnt: 0, offMenu: 0 }, lit: { score: 100, stars: 5 } },
    { in: { booked: 12, fed: 0, waitSum: 0, burnt: 0, offMenu: 0 }, lit: { score: 0, stars: 1, parts: { fed: 0, wait: 0, quality: 0 } } },
    { in: { booked: 12, fed: 12, waitSum: 40 * 12, burnt: 1, offMenu: 0 }, lit: { score: 86, stars: 4, parts: { fed: 60, wait: 10, quality: 16 } } },
    { in: { booked: 20, fed: 15, waitSum: 30 * 15, burnt: 0, offMenu: 0 }, lit: { score: 71, stars: 3 } },
    { in: { booked: 20, fed: 12, waitSum: 45 * 12, burnt: 2, offMenu: 0 }, lit: { score: 48, stars: 2 } },
    { in: { booked: 12, fed: 12, waitSum: 15 * 12, burnt: 0, offMenu: 0, cold: 5 }, lit: { score: 90, stars: 5, parts: { fed: 60, wait: 20, quality: 10 } } },
    { in: { booked: 12, fed: 12, waitSum: 15 * 12, burnt: 0, offMenu: 0, cold: 6 }, lit: { score: 88, stars: 4 } }
  ];
  const scoreLit = atStart(C, ['SCORE_FED', 'SCORE_WAIT', 'SCORE_QUALITY', 'WAIT_FULL_S', 'WAIT_ZERO_S', 'BURNT_PENALTY', 'OFFMENU_PENALTY', 'COLD_PENALTY', 'STAR_EDGES']);
  for (const c of cases) {
    const got = P.scoreEvent(c.in);
    const want = R.score(c.in);
    assert(deepEq(got, want), 'scoreEvent(' + describe(c.in) + ') is ' + describe(got) + ', reference ' + describe(want));
    if (scoreLit) for (const [k, v] of Object.entries(c.lit)) assert(deepEq(got[k], v), 'scoreEvent(' + describe(c.in) + ').' + k + ' is ' + describe(got[k]) + ', W8.1 table ' + describe(v));
  }
  // Star edges: find inputs that score exactly each edge score.
  const edges = [39, 40, 59, 60, 74, 75, 89, 90];
  const found = {};
  for (let fed = 0; fed <= 60 && Object.keys(found).length < edges.length; fed++) {
    for (let w = 0; w <= 60; w += 1) {
      for (let burnt = 0; burnt <= 5; burnt++) {
        for (let off = 0; off <= 2; off++) {
          const inp = { booked: 60, fed, waitSum: fed * w, burnt, offMenu: off };
          const s = R.score(inp).score;
          if (edges.includes(s) && !(s in found)) found[s] = inp;
        }
      }
    }
  }
  for (const e of edges) {
    assert(found[e], 'no input reaches score ' + e + ' with these C values');
    const got = P.scoreEvent(found[e]);
    assert(got.score === e && got.stars === R.starsOf(e), 'score ' + e + ': scoreEvent gave ' + describe(got) + ', stars wanted ' + R.starsOf(e));
  }
  notes.push('edges ' + edges.map((e) => e + ':' + R.starsOf(e)).join(' '));
  // Pay at 1, 3 and 5 stars on a real Church picnic (fee 275, deposit 83 at the starting values).
  // W24: the picnic needs the second kettle; from cash 103 (W25 R-2, the playtest's week 1) the kettle
  // (90) is bought leaning on the picked picnic's deposit for the cart (sim.js P-4, R-1), and Load up
  // and go then opens.
  const payLit = atStart(C, ['FEE_MULT', 'FEE_ROUND', 'DEPOSIT_FRAC', 'PAY_BASE', 'PAY_PER_STAR']);
  const LIT = { 1: [38, 121], 3: [115, 198], 5: [192, 275] };
  const rests = [];
  for (const stars of [1, 3, 5]) {
    const h = toWeek(P, 60 + stars);
    h.st().cash = 103;   // fixture: the playtest's week 1 cash (W25)
    const ok = h.sim.bookOffer('picnic');
    assert(ok && ok.ok, 'bookOffer picnic ' + describe(ok));
    const why = h.sim.canLoadUp();
    assert(why.ok === false && why.reason === P.STRINGS.ui.needsKettle2, 'canLoadUp on one kettle ' + describe(why));
    const cb = h.sim.canBuy('kettle2');
    const dep0 = h.st().season.booking.deposit, cart0 = h.sim.cartTotal();
    assert(cb && cb.ok === true && cb.left === 103 + dep0 - cart0 - 90, 'canBuy kettle2 from cash 103 ' + describe(cb) + ', deposit ' + dep0 + ', cart ' + cart0);
    const k2 = h.sim.buy('kettle2', 1);
    h.drain();
    assert(k2 && k2.ok === true, 'buy kettle2 from cash 103 with the picnic picked ' + describe(k2));
    assert(h.sim.canBuy('kettle2').ok === false && h.sim.canBuy('kettle2').message === 'Owned', 'canBuy kettle2 once owned ' + describe(h.sim.canBuy('kettle2')));
    assert(h.st().season.booking.id === 'picnic' && h.st().season.booking.safe === true, 'the picnic after the kettle ' + describe(h.st().season.booking && [h.st().season.booking.id, h.st().season.booking.safe]));
    assert(h.st().cash >= 0 && h.sim.canLoadUp().ok === true, 'canLoadUp after the kettle ' + describe(h.sim.canLoadUp()) + ', cash ' + h.st().cash);
    const offer = h.st().season.booking;
    const lu = h.sim.loadUp();
    h.drain();
    assert(lu && lu.ok, 'loadUp ' + describe(lu) + ', canLoadUp ' + describe(h.sim.canLoadUp()));
    const n0 = h.log.length;
    assert(h.sim.settle(stars) === true, 'settle(' + stars + ') did not return true');
    h.drain();
    const t = h.st().till;
    const wantRest = R.payRest(offer.pay, offer.deposit, stars);
    assert(t.payRest === wantRest, stars + ' stars: payRest ' + t.payRest + ', wanted ' + wantRest);
    const cs = h.of(EV3.clientStars, n0);
    assert(cs.length === 1 && cs[0].stars === stars && cs[0].pay === R.payTotal(offer.pay, stars) && cs[0].bonus === 0, stars + ' stars: client_stars ' + describe(cs.map(strip)));
    if (payLit) assert(offer.pay === 275 && offer.deposit === 83 && t.payRest === LIT[stars][0] && cs[0].pay === LIT[stars][1], stars + ' stars: fee ' + offer.pay + ', deposit ' + offer.deposit + ', rest ' + t.payRest + ', total ' + cs[0].pay + ', W19 literal ' + LIT[stars].join(' and '));
    rests.push(t.payRest + ' (' + cs[0].pay + ')');
    if (stars === 3) {
      // W26 Q-7: the next week opens on last week's booking when it is offered and safe.
      h.sim.finishReport();
      h.drain();
      const nb = h.st().season.booking;
      assert(h.st().season.week === 2 && nb && nb.id === 'picnic' && nb.safe === true, 'week 2 after the picnic opens on ' + describe(nb && [nb.id, nb.safe]) + ', offers ' + describe(h.st().season.offers.map((o) => o.id)));
      notes.push('week 2 opens on the picnic again');
    }
  }
  notes.push('pay rest at 1, 3, 5 stars ' + rests.join(', '));
  return cases.length + ' W8.1 and W24 cases' + (scoreLit ? ' (literal)' : ' (reference, C tuned)') + '; ' + notes.join('; ');
}

function weekLoopHeadless(P) {
  const C = P.C;
  const R = refModel(P);
  const notes = [];
  const h = headless(P, null, 31);
  const st = h.st;
  assert(h.sim.skipTutorial() === true, 'skipTutorial() did not return true');
  h.drain();
  assert(st().loop === LOOP.creator, 'loop after the skip ' + describe(st().loop));
  const n0 = h.log.length;
  const set = h.sim.setPlayer(MARTY.look, MARTY.name, MARTY.pit);
  h.drain();
  assert(set && set.ok === true && set.name === MARTY.name && set.pitName === MARTY.pit && deepEq(set.look, MARTY.look), 'setPlayer returned ' + describe(set));
  assert(st().loop === LOOP.week, 'loop after setPlayer ' + describe(st().loop));
  assert(deepEq(st().profile, { name: MARTY.name, look: MARTY.look }), 'state.profile ' + describe(st().profile));
  assert(st().pitName === MARTY.pit, 'state.pitName ' + describe(st().pitName));
  const seq = h.log.slice(n0).map((e) => e.type);
  const order = [EV3.playerSet, EV3.weekStart, EV3.offersReady, EVENT.saveWanted].map((t) => seq.indexOf(t));
  assert(order.every((i) => i >= 0) && order.every((i, j) => j === 0 || i > order[j - 1]), 'events after setPlayer ' + describe(seq) + ', wanted player_set, week_start, offers_ready, save_wanted (W22.2)');
  const ws = h.of(EV3.weekStart, n0)[0];
  assert(ws.year === 1 && ws.week === 1, 'week_start ' + describe(strip(ws)));
  const sw = h.of(EVENT.saveWanted, n0);
  assert(sw.some((e) => e.reason === 'player'), 'no save_wanted player: ' + describe(sw.map(strip)));
  const bk = st().season.booking;
  assert(bk && bk.id === 'birthday', 'season.booking ' + describe(bk && bk.id));
  assert(deepEq(cartView(st()), h.sim.prefill()), 'cart ' + describe(cartView(st())) + ' is not prefill() ' + describe(h.sim.prefill()));
  const rail = h.sim.railFor(bk, null);
  // W24 P-5: the spare only with a cooler (none here), so the cart covers the rail exactly.
  const spare = h.sim.coolerCap() > 0 ? C.SPARE_FRAC : 0;
  for (const m of MEAT_IDS) {
    if (!(rail[m] > 0)) continue;
    const plates = (st().stock[m] + st().cart.meat[m]) * P.MEATS[m].plates;
    assert(plates >= Math.ceil(rail[m] * (1 + spare) - 1e-9), m + ': cart covers ' + plates + ' plates, rail ' + rail[m] + (spare ? ' plus the spare' : ''));
    if (!spare) assert(plates - rail[m] < P.MEATS[m].plates, m + ': ' + plates + ' plates for a rail of ' + rail[m] + ' with no cooler (a whole spare unit)');
  }
  assert(h.sim.canLoadUp().ok === true, 'canLoadUp() ' + describe(h.sim.canLoadUp()));
  const cash0 = st().cash, total = h.sim.cartTotal();
  const n1 = h.log.length;
  const lu = h.sim.loadUp();
  h.drain();
  assert(lu && lu.ok, 'loadUp() ' + describe(lu));
  assert(st().cash === cash0 + bk.deposit - total, 'cash after loadUp ' + st().cash + ', wanted ' + cash0 + ' + ' + bk.deposit + ' - ' + total);
  const dep = h.of(EV3.deposit, n1);
  assert(dep.length === 1 && dep[0].amount === bk.deposit, 'deposit events ' + describe(dep.map(strip)));
  if (atStart(C, ['FEE_MULT', 'FEE_ROUND', 'DEPOSIT_FRAC'])) assert(bk.deposit === 30, 'deposit ' + bk.deposit + ', W19 literal 30');
  assert(st().loop === LOOP.prep, 'loop after loadUp ' + describe(st().loop));
  const td = st().today;
  const L = C.LENGTHS.normal;
  const lastCall = Math.min(td.gateAt + bk.window, L.seconds - C.LAST_CALL_GUARD);
  assert(td.gateAt === C.GATE_OPENS && td.lastCallAt === lastCall && td.endAt === L.seconds, 'timings ' + describe([td.gateAt, td.lastCallAt, td.endAt]) + ', wanted ' + describe([C.GATE_OPENS, lastCall, L.seconds]));
  assert(td.gateAt === 30 && td.lastCallAt === 90 && td.endAt === 125, 'timings ' + describe([td.gateAt, td.lastCallAt, td.endAt]) + ', W26 literal 30, 90, 125 (the Birthday window is 60)');
  assert(td.kind === 'booking' && td.booked === bk.headcount && td.pending === bk.headcount && bk.headcount === 12, 'today booked ' + td.booked + ', pending ' + td.pending + ', kind ' + td.kind);
  // Idle to the gate, then to the end, watching every customer.
  let maxLine = 0, unbooked = 0, loopAtGate = null;
  const watch = () => {
    const s = st();
    const line = s.customers.filter((c) => c.queueIndex >= 0).length;
    if (line > maxLine) maxLine = line;
    unbooked += s.customers.filter((c) => c.booked !== true).length;
  };
  const gateIdx0 = h.log.length;
  h.until(() => { watch(); return h.has(EVENT.gateOpen, gateIdx0); }, td.gateAt + 2);
  loopAtGate = st().loop;
  assert(loopAtGate === LOOP.cook, 'loop at gate_open ' + describe(loopAtGate));
  assert(h.until(() => { watch(); return st().loop === LOOP.report; }, td.endAt + 10), 'the Birthday did not reach the report; loop ' + describe(st().loop) + ', clock ' + st().clock);
  const arrived = h.of(EVENT.customerArrived, n1);
  const orders = zeroMeat();
  for (const a of arrived) orders[a.meat] = (orders[a.meat] | 0) + 1;
  const t = st().till;
  assert(unbooked === 0, unbooked + ' customer samples without booked true');
  assert(MEAT_IDS.every((m) => orders[m] <= rail[m]), 'orders ' + describe(orders) + ' exceed the rail ' + describe(rail));
  assert(arrived.length + t.missed === bk.headcount, 'spawned ' + arrived.length + ' plus missed ' + t.missed + ' is not ' + bk.headcount);
  // W26 Q-1 (the W7.3 rule as amended): booked guests keep joining after last call while the line
  // frees, and the ones still waiting give up at the hard end, after last_call.
  const evs = h.log.slice(n1);
  const lcI = evs.findIndex((e) => e.type === 'last_call');
  assert(lcI >= 0, 'no last_call on the Birthday');
  const lateJoins = evs.slice(lcI + 1).filter((e) => e.type === EVENT.customerArrived).length;
  const gm = evs.filter((e) => e.type === EV3.guestsMissed);
  if (t.missed > 0) {
    assert(gm.length === 1 && gm[0].n === t.missed && evs.indexOf(gm[0]) > lcI, 'guests_missed ' + describe(gm.map(strip)) + ' for ' + t.missed + ' missed, last_call at ' + lcI);
  } else {
    assert(gm.length === 0, 'guests_missed with nobody missed ' + describe(gm.map(strip)));
  }
  notes.push(lateJoins + ' joined after last call, ' + t.missed + ' gave up at the hard end');
  assert(h.of(EV3.walkPast, n1).length === 0, 'walk_past fired for booked guests');
  assert(maxLine <= C.QUEUE_SPOTS, maxLine + ' in line at once, over ' + C.QUEUE_SPOTS);
  const cs = h.of(EV3.clientStars, n1);
  const want = R.score({ booked: 12, fed: 0, waitSum: 0, burnt: 0, offMenu: 0 });
  assert(cs.length === 1 && cs[0].stars === want.stars && cs[0].score === want.score && cs[0].fed === 0 && cs[0].booked === 12, 'client_stars ' + describe(cs.map(strip)) + ', wanted stars ' + want.stars + ' score ' + want.score);
  assert(cs[0].stars === 1 && cs[0].score === 0, 'client_stars ' + describe(strip(cs[0])) + ', W24 literal 1 star, score 0');
  assert(t.payRest === R.payRest(bk.pay, bk.deposit, 1), 'till.payRest ' + t.payRest + ', wanted ' + R.payRest(bk.pay, bk.deposit, 1));
  if (atStart(C, ['FEE_MULT', 'FEE_ROUND', 'DEPOSIT_FRAC', 'PAY_BASE', 'PAY_PER_STAR'])) assert(t.payRest === 14, 'till.payRest ' + t.payRest + ', W24 literal 14');
  // W24 P-3: a booking's take is the pay and tips after the meat, charcoal and spoilage used.
  const netWant = t.deposit + t.payRest + t.menuBonus + t.tips + t.seatTips - t.foodCost - t.rawWaste - t.bags * C.CHARCOAL_PRICE - t.spoilCost - t.wages - C.DAILY_COSTS;
  assert(t.net === netWant, 'till.net ' + t.net + ', wanted ' + netWant);
  const repWant = Math.min(100, Math.max(0, C.START_REP + Math.min(Math.max(C.STAR_FANS[0], C.REP_DAY_MIN), t.repMax !== undefined ? t.repMax : Infinity)));
  assert(st().rep === repWant, 'rep ' + C.START_REP + ' to ' + st().rep + ', wanted ' + repWant);
  if (atStart(C, ['STAR_FANS', 'REP_DAY_MIN'])) assert(st().rep === 15, 'rep ' + st().rep + ', W19 literal 15');
  assert(t.repReason === 'stars' && t.kind === 'booking' && t.stars === 1, 'till repReason ' + t.repReason + ', kind ' + t.kind + ', stars ' + t.stars);
  assert(deepEq(st().season.results, [{ type: 'birthday', stars: 1 }]), 'season.results ' + describe(st().season.results));
  assert(st().phase === PHASE.evening, 'phase at the report ' + st().phase);
  const n2 = h.log.length;
  h.sim.finishReport();
  h.drain();
  assert(st().loop === LOOP.week && st().season.week === 2 && st().phase === PHASE.morning, 'after finishReport() loop ' + st().loop + ', week ' + st().season.week);
  assert(st().season.offers.length >= 2, 'week 2 offers ' + describe(st().season.offers.map((o) => o.id)));
  const seq2 = h.log.slice(n2).map((e) => e.type);
  const o2 = [EV3.weekStart, EV3.offersReady].map((x) => seq2.indexOf(x));
  assert(o2[0] >= 0 && o2[1] > o2[0], 'events after finishReport ' + describe(seq2));
  assert(h.of(EVENT.saveWanted, n2).some((e) => e.reason === 'week'), 'no save_wanted week after finishReport');
  const ws2 = h.of(EV3.weekStart, n2)[0];
  assert(ws2.year === 1 && ws2.week === 2, 'week_start ' + describe(strip(ws2)));
  // The picnic with an add-on, a refused add-on and a length change.
  const nb = h.log.length;
  assert(h.sim.bookOffer('picnic').ok, 'bookOffer picnic');
  h.drain();
  // Integration I-1 (contract W23): the event keeps its own type; the booking rides in id and booking.
  const bp = h.of(EV3.bookingPicked, nb);
  assert(bp.length === 1 && bp[0].id === 'picnic' && bp[0].booking === 'picnic', 'booking_picked events ' + describe(h.log.slice(nb).map(strip)));
  const ad = h.sim.setAddon('ribs');
  assert(ad && ad.ok, 'setAddon ribs ' + describe(ad));
  assert(st().season.addon === 'ribs', 'season.addon ' + describe(st().season.addon));
  const r2 = h.sim.railFor(st().season.booking, 'ribs');
  const r2want = R.rail(20, ['chicken', 'butt'], 'ribs');
  assert(deepEq(r2, r2want), 'railFor picnic + ribs ' + describe(r2) + ', wanted ' + describe(r2want));
  if (atStart(C, ['ADDON_SHARE'])) assert(r2.chicken === 8 && r2.butt === 7 && r2.ribs === 5, 'rail ' + describe(r2) + ', W19 literal 8, 7, 5');
  assert(deepEq(cartView(st()), h.sim.prefill()), 'cart after setAddon is not prefill()');
  const bad = h.sim.setAddon('chicken');
  assert(bad && bad.ok === false && bad.message === UI.addonNo, 'setAddon chicken ' + describe(bad));
  const sl = h.sim.setLength('short');
  assert(sl && sl.ok, 'setLength short ' + describe(sl));
  assert(st().season.booking.id === 'picnic' && st().season.booking.headcount === Math.round(20 * C.LENGTHS.short.factor), 'after setLength short the pick is ' + describe(st().season.booking && [st().season.booking.id, st().season.booking.headcount]));
  assert(st().settings.length === 'short', 'settings.length ' + st().settings.length);
  notes.push('max line ' + maxLine + ', spawned ' + arrived.length + ', missed ' + t.missed + ', orders ' + describe(orders));
  notes.push(boardHeadless(P));
  return 'creator to week 1, Birthday idle to 1 star and rest pay ' + t.payRest + ', week 2 picnic plus ribs ' + describe(r2) + ', short picnic 14; ' + notes.join('; ');
}

// W25 R-2 (sim.js R-2): the second pork butt slices onto a board that holds the first butt's plates;
// a stack that would overrun opens a second one; a board with no room says to use the trash.
function boardHeadless(P) {
  const C = P.C;
  const h = toWeek(P, 33);
  const lu = h.sim.loadUp();
  h.drain();
  assert(lu && lu.ok, 'board: loadUp ' + describe(lu));
  const st = h.st;
  const board = () => st().stations.board;
  const plates = (m) => board().stacks.filter((s) => s.meat === m).reduce((a, s) => a + s.times.length, 0);
  const t0 = st().clock;
  // Fixture: the first butt was sliced and one plate went to the table; the second butt is in hand.
  board().stacks = [{ meat: 'butt', times: [t0, t0, t0, t0] }];
  st().player.carrying = { kind: 'cooked', meat: 'butt' };
  assert(h.goSettled('board', () => st().player.busy !== null), 'board: the second butt did not start a slice; verb ' + describe(h.sim.verbAt().label));
  assert(h.until(() => st().player.busy === null, P.MEATS.butt.slice + 2), 'board: the slice did not finish');
  const held = st().player.carrying && st().player.carrying.kind === 'plates' ? st().player.carrying.times.length : 0;
  assert(plates('butt') + held === 4 + P.MEATS.butt.plates, 'board: ' + plates('butt') + ' butt plates on the board and ' + held + ' in hand, wanted ' + (4 + P.MEATS.butt.plates));
  // Fixture: an overrun stack opens a second one while a stack is free.
  board().stacks = [{ meat: 'sausage', times: [t0, t0] }, { meat: 'butt', times: new Array(C.BOARD_STACK - 2).fill(t0) }];
  st().player.carrying = { kind: 'cooked', meat: 'butt' };
  const v1 = h.sim.verbAt();
  assert(v1.enabled === true && v1.label === 'Slice ' + P.MEATS.butt.label, 'board: an overrun stack gives ' + describe(v1));
  // Fixture: every stack full.
  board().stacks = MEAT_IDS.map((m) => ({ meat: m, times: new Array(C.BOARD_STACK).fill(t0) }));
  const v2 = h.sim.verbAt();
  assert(v2.enabled === false && v2.label === 'Board is full. Use the trash', 'board: a full board gives ' + describe(v2));
  board().stacks = [];
  st().player.carrying = null;
  return 'board: a second butt sliced onto 4 plates, an overrun opens a second stack, a full board names the trash';
}

function inventoryHeadless(P) {
  const C = P.C;
  const R = refModel(P);
  const notes = [];
  // Caps, in a week with a cash fixture so the caps bind before the money does.
  const h = toWeek(P, 41);
  h.st().cash = 5000;   // fixture
  const ch0 = h.st().charcoal;
  h.sim.buy('charcoal', 999);
  assert(h.st().cart.charcoal === C.CHARCOAL_MAX - ch0, 'charcoal line ' + h.st().cart.charcoal + ', wanted ' + (C.CHARCOAL_MAX - ch0));
  const bk = h.st().season.booking;
  const cap = h.sim.coolerCap();
  assert(cap === C.COOLER_CAP[0], 'coolerCap() with no cooler ' + cap);
  h.sim.buy(MEAT, 999);
  assert(h.sim.meatRoom() === 0, 'meatRoom() after a 999 buy ' + h.sim.meatRoom());
  const units = sumOf(h.st().cart.meat) + sumOf(h.st().stock);
  const bound = cap + R.eventUnits(h.sim.railFor(bk, null));
  assert(units === bound, 'meat units ' + units + ', wanted cooler plus event ' + bound);
  const more = h.sim.buy(MEAT, 1);
  const fullMsg = cap === 0 ? UI.coolerFullNone : fill(UI.coolerFull, { cap });   // W25 R-3
  assert(more && more.ok === false && more.message === fullMsg, 'a refused increase ' + describe(more) + ', wanted ' + describe(fullMsg));
  notes.push('charcoal to ' + C.CHARCOAL_MAX + ', meat to ' + bound + ' units');
  // No cooler: an idle booking spoils every committed unit.
  const a = toWeek(P, 42);
  const chBefore = a.st().charcoal, bagsCart = a.st().cart.charcoal;
  const lu = a.sim.loadUp();
  a.drain();
  assert(lu && lu.ok, 'loadUp ' + describe(lu));
  const committed = Object.assign({}, a.st().stock);
  assert(sumOf(committed) > 0, 'nothing in stock after loadUp');
  assert(toReport(a), 'the idle booking did not reach the report');
  const t = a.st().till;
  assert(t.spoilReason === 'nocooler', 'spoilReason ' + describe(t.spoilReason));
  assert(deepEq(t.spoiled, committed), 'till.spoiled ' + describe(t.spoiled) + ', wanted ' + describe(committed));
  assert(deepEq(t.coolerAfter, zeroMeat()), 'coolerAfter ' + describe(t.coolerAfter));
  assert(t.coolerCap === 0, 'till.coolerCap ' + t.coolerCap);
  assert(t.charcoalAfter === chBefore + bagsCart - t.bags, 'charcoalAfter ' + t.charcoalAfter + ', wanted ' + chBefore + ' + ' + bagsCart + ' - ' + t.bags);
  assert(a.of(EV3.spoiled).length === 1, 'spoiled events ' + a.of(EV3.spoiled).length);
  a.sim.finishReport();
  a.drain();
  const inv = a.sim.inventory();
  assert(inv.charcoal === t.charcoalAfter && inv.units === 0 && inv.cap === 0 && inv.over === 0, 'next week inventory() ' + describe(inv));
  notes.push('no cooler spoiled ' + sumOf(t.spoiled) + ', charcoal ' + chBefore + ' + ' + bagsCart + ' - ' + t.bags + ' kept');
  // A cooler with 20 sausage and 5 butt: keep the costliest up to the cap.
  const b = toWeek(P, 43);
  const s = b.st();
  s.gear.cooler = true; s.stock.sausage = 20; s.stock.butt = 5;   // fixture
  assert(b.sim.bookOffer('birthday').ok, 'bookOffer birthday');
  for (const m of MEAT_IDS) b.sim.buy(m, -999);
  assert(sumOf(s.cart.meat) === 0, 'meat lines not empty ' + describe(s.cart.meat));
  const capB = b.sim.coolerCap();
  assert(capB === C.COOLER_CAP[1], 'coolerCap() with the cooler ' + capB);
  const stockB = Object.assign({}, s.stock);
  const lub = b.sim.loadUp();
  b.drain();
  assert(lub && lub.ok, 'loadUp with the cooler ' + describe(lub) + ', canLoadUp ' + describe(b.sim.canLoadUp()));
  assert(toReport(b), 'the cooler booking did not reach the report');
  const tb = b.st().till;
  const want = R.keepByCost(stockB, capB);
  assert(deepEq(tb.coolerAfter, want.keep) && deepEq(tb.spoiled, want.spoil), 'kept ' + describe(tb.coolerAfter) + ', spoiled ' + describe(tb.spoiled) + ', wanted ' + describe(want));
  assert(tb.spoilReason === 'full' && tb.coolerCap === capB, 'spoilReason ' + tb.spoilReason + ', coolerCap ' + tb.coolerCap);
  if (capB === 12) assert(tb.coolerAfter.butt === 5 && tb.coolerAfter.sausage === 7 && tb.spoiled.sausage === 13, 'W19 literal 5 butt, 7 sausage kept, 13 sausage spoiled; got ' + describe([tb.coolerAfter, tb.spoiled]));
  assert(deepEq(b.st().stock, want.keep), 'stock after the report ' + describe(b.st().stock));
  notes.push('cooler ' + capB + ' kept ' + describe(meatListText(P, tb.coolerAfter)) + ', spoiled ' + sumOf(tb.spoiled));
  return notes.join('; ');
}

function seasonEndHeadless(P) {
  const C = P.C;
  const h = toWeek(P, 51);
  const st = h.st;
  for (let w = 1; w <= SEASON_WEEKS; w++) {
    assert(st().loop === LOOP.week && st().season.week === w, 'week ' + w + ': loop ' + st().loop + ', week ' + st().season.week);
    const ids = st().season.offers.map((o) => o.id);
    if (w === SEASON_WEEKS) assert(sameJSON(ids, ['finale']), 'week 9 offers ' + describe(ids));
    const first = st().season.offers[0];
    assert(h.sim.bookOffer(first.id).ok, 'week ' + w + ': bookOffer ' + first.id);
    const lu = h.sim.loadUp();
    h.drain();
    assert(lu && lu.ok, 'week ' + w + ': loadUp ' + describe(lu) + ', canLoadUp ' + describe(h.sim.canLoadUp()) + ', cash ' + st().cash);
    if (w === SEASON_WEEKS) {
      // W26 Q-2: the finale runs C.FINALE_SECONDS whatever the length, with last call at 135.
      const ft = st().today;
      assert(ft.endAt === C.FINALE_SECONDS && ft.lastCallAt === Math.min(ft.gateAt + first.window, C.FINALE_SECONDS - C.LAST_CALL_GUARD), 'finale timings ' + describe([ft.gateAt, ft.lastCallAt, ft.endAt]));
      if (atStart(C, ['FINALE_SECONDS'])) assert(ft.endAt === 160 && ft.lastCallAt === 135, 'finale timings ' + describe([ft.lastCallAt, ft.endAt]) + ', W26 literal 135, 160');
    }
    assert(h.sim.settle(3) === true, 'week ' + w + ': settle(3) refused (kind ' + st().today.kind + ')');
    h.drain();
    assert(st().loop === LOOP.report, 'week ' + w + ': loop after settle ' + st().loop);
    if (w === SEASON_WEEKS) break;
    h.sim.finishReport();
    h.drain();
  }
  const n0 = h.log.length;
  h.sim.finishReport();
  h.drain();
  assert(st().loop === LOOP.seasonEnd && st().phase === PHASE.morning, 'after week 9 loop ' + st().loop + ', phase ' + st().phase);
  const se = h.of(EV3.seasonEnd, n0);
  assert(se.length === 1 && se[0].year === 1 && sameJSON(se[0].stars, new Array(9).fill(3)), 'season_end ' + describe(se.map(strip)));
  const repBefore = st().rep, cashBefore = st().cash, chBefore = st().charcoal, stockBefore = Object.assign({}, st().stock);
  const repTo = Math.max(C.SEASON_REP_FLOOR, Math.floor(repBefore * C.SEASON_CARRY_REP));
  const pv = h.sim.seasonEndPreview();
  assert(pv && pv.year === 1 && sameJSON(pv.stars, new Array(9).fill(3)) && pv.cash === cashBefore && pv.repFrom === repBefore && pv.repTo === repTo && pv.charcoal === chBefore && deepEq(pv.spoiled, stockBefore), 'seasonEndPreview() ' + describe(pv) + ', wanted rep ' + repBefore + ' to ' + repTo);
  assert(st().rep === repBefore && st().cash === cashBefore, 'seasonEndPreview() changed state');
  const n1 = h.log.length;
  assert(h.sim.startSeason() === true, 'startSeason() did not return true');
  h.drain();
  const s = st();
  assert(s.season.year === 2 && s.season.week === 1 && sameJSON(s.season.results, []), 'season after startSeason ' + describe({ year: s.season.year, week: s.season.week, results: s.season.results }));
  assert(s.rep === repTo, 'rep ' + repBefore + ' to ' + s.rep + ', wanted ' + repTo);
  assert(deepEq(s.stock, zeroMeat()), 'stock after startSeason ' + describe(s.stock));
  assert(s.charcoal === chBefore && s.cash === cashBefore, 'charcoal ' + s.charcoal + ', cash ' + s.cash + ', wanted ' + chBefore + ', ' + cashBefore);
  assert(s.loop === LOOP.week, 'loop after startSeason ' + s.loop);
  const seq = h.log.slice(n1).map((e) => e.type);
  const o = [EV3.seasonStart, EV3.weekStart, EV3.offersReady].map((x) => seq.indexOf(x));
  assert(o.every((i) => i >= 0) && o[1] > o[0] && o[2] > o[1], 'events after startSeason ' + describe(seq) + ' (W22.2)');
  assert(h.of(EVENT.saveWanted, n1).some((e) => e.reason === 'season'), 'no save_wanted season');
  assert(h.sim.startSeason() === false, 'a second startSeason() outside seasonEnd did not return false');
  return 'nine settle(3) weeks, season_end with nine 3s, rep ' + repBefore + ' to ' + repTo + ', cash ' + cashBefore + ' and charcoal ' + chBefore + ' kept, year 2 week 1';
}

function namesHeadless(P) {
  for (const c of NAME_CASES) {
    const got = c.fn === 'clean' ? P.cleanName(...c.args) : P.filterName(...c.args);
    assert(got === c.want, (c.fn === 'clean' ? 'cleanName' : 'filterName') + '(' + describe(c.args) + ') is ' + describe(got) + ', wanted ' + describe(c.want));
  }
  for (const odd of [undefined, null, 42, {}, [], { toString() { throw new Error('x'); } }]) {
    let r;
    try { r = P.cleanName(odd, 'Fallback'); P.filterName(odd); } catch (e) { throw new Error('cleanName or filterName threw on ' + describe(odd) + ': ' + e.message); }
    assert(typeof r === 'string' && r.length > 0, 'cleanName(' + describe(odd) + ') is ' + describe(r));
  }
  const sim = P.createSim(null, 71);
  const r = sim.setPlayer({ skin: 9, hair: -1, hairColor: 2.5, face: 'x', hat: 3, apron: 5 }, '  Bo  ', '');
  const want = { skin: 1, hair: 0, hairColor: 1, face: 0, hat: 3, apron: 5 };
  assert(r && r.ok === true && deepEq(r.look, want) && r.name === 'Bo' && r.pitName === W15.defaultPit, 'setPlayer odd input returned ' + describe(r));
  assert(deepEq(sim.state.profile, { name: 'Bo', look: want }) && sim.state.pitName === W15.defaultPit, 'state after setPlayer ' + describe({ profile: sim.state.profile, pitName: sim.state.pitName }));
  assert(sim.state.loop === LOOP.tutorial, 'setPlayer moved the loop outside the creator: ' + sim.state.loop);
  assert(deepEq(sim.look(), want), 'look() ' + describe(sim.look()));
  const valid = (l) => l && LOOK_KEYS.every((k) => Number.isInteger(l[k]) && l[k] >= 0 && l[k] < LOOK_COUNTS[k]) && Object.keys(l).length === LOOK_KEYS.length;
  const a = P.createSim(null, 72), b = P.createSim(null, 72);
  const la = [a.randomLook(), a.randomLook(), a.randomLook()];
  const lb = [b.randomLook(), b.randomLook(), b.randomLook()];
  assert(la.every(valid), 'randomLook() gave ' + describe(la));
  assert(deepEq(la, lb), 'the same seed gave different randomLook() sequences');
  assert(!deepEq(la[0], la[1]) || valid(la[1]), 'randomLook() twice');
  const c = P.createSim(null, 73), d = P.createSim(null, 73);
  c.randomLook(); c.randomLook();
  assert(c.rng() === d.rng(), 'randomLook() moved sim.rng()');
  assert(deepEq(P.createSim(null, 74).look(), DEFAULT_LOOK), 'look() on a new game ' + describe(P.createSim(null, 74).look()));
  return NAME_CASES.length + ' W4.4 examples, odd inputs safe, setPlayer cleans to ' + describe(want) + ', randomLook seeded and apart from rng()';
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
  await cdp.send('Emulation.setFocusEmulationEnabled', { enabled: true }).catch(() => {});   // Input.insertText needs a focused field
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
  // v3.0 (deviation 15): text plus the aria-label of any part that has no text of its own.
  const acc = (id) => {
    const e = typeof id === 'string' ? $(id) : id;
    if (!e) throw new Error('#' + id + ' missing');
    const parts = [];
    const walk = (n) => {
      if (n.nodeType === 3) { parts.push(n.nodeValue); return; }
      if (n.nodeType !== 1) return;
      const al = n.getAttribute('aria-label');
      if (al && n.getAttribute('aria-hidden') !== 'true' && !(n.textContent || '').trim()) { parts.push(' ' + al + ' '); return; }
      for (const c of n.childNodes) walk(c);
    };
    walk(e);
    return parts.join('').replace(/\\s+/g, ' ').trim();
  };
  const sr = (id) => { const e = $(id); if (!e) throw new Error('#' + id + ' missing'); const s = e.querySelector('.sr'); return s ? (s.textContent || '').trim() : null; };
  const attr = (id, a) => { const e = $(id); return e ? e.getAttribute(a) : null; };
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
// v3.0 page reads.
const accText = (id) => ev('acc(' + JSON.stringify(id) + ')');
const srText = (id) => ev('sr(' + JSON.stringify(id) + ')');
const attrOf = (id, a) => ev('attr(' + JSON.stringify(id) + ', ' + JSON.stringify(a) + ')');
const valueOf = (id) => ev('$(' + JSON.stringify(id) + ').value');
const loop = () => ev('S().loop');
const lookKeyNow = () => ev('globalThis.' + GLOBAL_NAME + '.art.lookKey()');
const storedSave = () => run('try { return JSON.parse(localStorage.getItem(' + JSON.stringify(SAVE_KEY) + ')); } catch (e) { return null; }');
const starsText = (n) => (n === 1 ? UI.starsOne : fill(UI.starsMany, { n }));
const charcoalLine = (n, one, many) => (n === 1 ? one : fill(many, { n }));
const commas = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',');   // W25: game.js fmt()
// W19: text goes in through CDP Input.insertText into the focused field after selecting its value.
async function typeInto(id, str) {
  await ev('($(' + JSON.stringify(id) + ').focus(), $(' + JSON.stringify(id) + ').select(), true)');
  await cdp.send('Input.insertText', { text: str });
  await advance(0);
  return valueOf(id);
}
// Click a stepper's minus until its quantity reads 0.
async function stepDown(id, max = 300) {
  for (let i = 0; i < max; i++) {
    const q = await text(ID.qty(id));
    if (q === '0') return i;
    await click(ID.dec(id));
  }
  throw new Error('#' + ID.qty(id) + ' never reached 0');
}
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
async function reload(saveObj, opts = {}) {
  let scriptId = null;
  if (saveObj !== undefined || opts.clear) {
    const src = opts.clear
      ? 'try { localStorage.removeItem(' + JSON.stringify(SAVE_KEY) + '); } catch (e) {}'
      : 'try { localStorage.setItem(' + JSON.stringify(SAVE_KEY) + ', ' + JSON.stringify(JSON.stringify(saveObj)) + '); } catch (e) {}';
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
// Deviation 19: a reload with the save cleared, so the page opens a new game on the tutorial morning.
const reloadFresh = () => reload(undefined, { clear: true });
// A v4 save fixture: week 1 of season 1 with a player, unless `over` says otherwise.
function resultsOf(n) { const out = []; for (let i = 0; i < n; i++) out.push({ type: i % 2 ? 'picnic' : 'birthday', stars: 3 }); return out; }
function saveV4(over = {}) {
  const s = JSON.parse(JSON.stringify(SAVE_V4_SAMPLE));
  Object.assign(s, { cash: 200, rep: 20, stock: Object.fromEntries(MEAT_IDS.map((m) => [m, 0])), charcoal: 10, wood: 0,
    gear: Object.fromEntries(GEAR_IDS.map((g) => [g, false])), decor: Object.fromEntries(DECOR_IDS.map((d) => [d, false])),
    hires: { buddy: false, tender: false }, stats: { days: 1, served: 10, walkouts: 0, past: 0, burnt: 0, seated: 3 },
    drivewayShown: false, tutorial: { done: true },
    season: { year: 1, week: 1, seed: 4242, pick: null, addon: null, weekCash: 200, results: [] },
    player: { name: MARTY.name, look: Object.assign({}, MARTY.look) }, pitName: MARTY.pit, settings: { length: 'normal' } });
  for (const [k, v] of Object.entries(over)) {
    if (v && typeof v === 'object' && !Array.isArray(v) && s[k] && typeof s[k] === 'object') Object.assign(s[k], v);
    else s[k] = v;
  }
  if (!(over.season && 'weekCash' in over.season)) s.season.weekCash = s.cash;
  if (!('day' in over)) s.day = s.season.results.length + 2;
  return s;
}
// Element screenshot (deviation 20): scroll it into view and clip; a full shot if that fails.
async function shotOf(name, id) {
  const r = await ev('(() => { const e = $(' + JSON.stringify(id) + '); if (!e || !vis(' + JSON.stringify(id) + ')) return null; e.scrollIntoView({ block: "start" }); const b = e.getBoundingClientRect(); return { x: b.left + window.scrollX, y: Math.max(0, b.top) + window.scrollY, w: b.width, h: Math.min(b.height, window.innerHeight - Math.max(0, b.top)) }; })()');
  if (!r || r.w < 1 || r.h < 1) return screenshot(name);
  try {
    const shot = await cdp.send('Page.captureScreenshot', { format: 'png', clip: { x: r.x, y: r.y, width: r.w, height: r.h, scale: 1 } });
    const file = path.join(OUT_DIR, name);
    fs.writeFileSync(file, Buffer.from(shot.data, 'base64'));
    report.screenshots.push(file);
    return file;
  } catch (_e) {
    return screenshot(name);
  }
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
// v3.0: buttons and text fields (W19 steps 45 and 60).
const SMALL_CONTROLS = '[...document.querySelectorAll("button, input:not([type=hidden]), select")].filter((b) => !b.hidden && !b.closest("[hidden]") && b.getClientRects().length > 0).map((b) => { const r = b.getBoundingClientRect(); return { id: b.id || b.textContent.trim().slice(0, 20), w: Math.round(r.width), h: Math.round(r.height) }; }).filter((r) => r.w < ' + MIN_CONTROL_PX + ' || r.h < ' + MIN_CONTROL_PX + ')';
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

// ---------------------------------------------------------------------------------------------
// v3.0 browser checks: the look system (step 21) and steps 42 to 51
// ---------------------------------------------------------------------------------------------

// W19 step 21, the look part. Runs in the page; restores the game's own look after.
async function lookChecks() {
  const r = await run(`
    const A = globalThis.${GLOBAL_NAME}.art;
    const out = { bad: [], notes: [] };
    if (typeof A.setLook !== 'function' || typeof A.lookKey !== 'function') { out.bad.push('art.setLook or art.lookKey missing'); return out; }
    const PL = ${describe(PLAYER_SPRITES)};
    const KEYS = ${describe(LOOK_KEYS)};
    const COUNTS = ${describe(LOOK_COUNTS)};
    const DEF = ${describe(DEFAULT_LOOK)};
    const LEG = ${describe(LEGEND)} + '.';
    out.key0 = A.lookKey();
    out.widths = { q: A.textWidth("'-"), s: typeof A.textWidthS === 'function' ? A.textWidthS('MARTY') : null };
    out.fns = { textFit: typeof A.textFit, uiText: typeof A.uiText };
    const font = A.SPRITES.font;
    out.fontGlyphs = [40, 41].map((i) => (font && font.frames[i] ? font.frames[i].join('').replace(/[0.]/g, '').length : 0));
    out.LOOK = A.LOOK ? JSON.parse(JSON.stringify(A.LOOK)) : null;
    const snap = () => PL.map(([n]) => A.SPRITES[n].frames.map((f) => f.slice()));
    const base = JSON.stringify(snap());
    const keyOf = (l) => KEYS.map((k) => l[k]).join('-');
    const gridFor = (look) => {
      const ret = A.setLook(look);
      if (ret !== keyOf(look)) out.bad.push('setLook(' + keyOf(look) + ') returned ' + JSON.stringify(ret));
      for (const [n, fr] of PL) {
        const sp = A.SPRITES[n];
        if (!sp || sp.w !== 16 || sp.h !== 24 || sp.frames.length !== fr) { out.bad.push(n + ' is ' + (sp && sp.w) + 'x' + (sp && sp.h) + ' with ' + (sp && sp.frames.length) + ' frames after setLook(' + keyOf(look) + ')'); continue; }
        const stray = [...new Set(sp.frames.join('').split(''))].filter((ch) => ch !== ',' && !LEG.includes(ch));
        if (stray.length) out.bad.push(n + ' uses ' + stray.join(' ') + ' after setLook(' + keyOf(look) + ')');
      }
      return A.SPRITES.player_down.frames[0].join('/');
    };
    for (const k of KEYS) {
      const grids = [];
      for (let i = 0; i < COUNTS[k]; i++) grids.push(gridFor(Object.assign({}, DEF, { [k]: i })));
      for (let i = 0; i < grids.length; i++) {
        for (let j = i + 1; j < grids.length; j++) {
          if (grids[i] !== grids[j]) continue;
          if (k === 'hair') {
            const a = gridFor(Object.assign({}, DEF, { hair: i, hat: 0 })), b = gridFor(Object.assign({}, DEF, { hair: j, hat: 0 }));
            if (a !== b) { out.notes.push('hair ' + i + ' and ' + j + ' differ only bare headed'); continue; }
          }
          out.bad.push(k + ' ' + i + ' and ' + j + ' draw the same player_down frame 0');
        }
      }
    }
    A.setLook(DEF);
    if (JSON.stringify(snap()) !== base) out.bad.push('setLook(DEFAULT_LOOK) did not restore the build grids');
    out.keyBack = A.lookKey();
    try { A.setLook(sim.look()); } catch (e) { out.bad.push('setLook(sim.look()) threw ' + e.message); }
    return out;
  `);
  assert(r.bad.length === 0, r.bad.length + ' look problem(s), first ' + r.bad.slice(0, 4).join('; '));
  assert(r.key0 === DEFAULT_LOOK_KEY && r.keyBack === DEFAULT_LOOK_KEY, 'art.lookKey() ' + describe(r.key0) + ' at load, ' + describe(r.keyBack) + ' after the restore');
  assert(r.widths.q === 9, 'art.textWidth("\'-") is ' + r.widths.q + ', wanted 9');
  assert(r.widths.s === 19, 'art.textWidthS("MARTY") is ' + r.widths.s + ', wanted 19');
  assert(r.fns.textFit === 'function' && r.fns.uiText === 'function', 'art.textFit / art.uiText ' + describe(r.fns));
  assert(r.fontGlyphs.every((n) => n > 0), 'font frames 40 and 41 are empty: ' + describe(r.fontGlyphs));
  assert(deepEq(r.LOOK, LOOK_TABLES), 'art.LOOK is ' + describe(r.LOOK) + ', wanted the W16.4 tables');
  return 'looks: every index distinct per key, legend only, sizes kept, default restores the build' + (r.notes.length ? ' (' + r.notes.join('; ') + ', deviation 14)' : '');
}

async function v3BrowserSteps(captures) {
  const PM = await ev('({ MEATS: JSON.parse(JSON.stringify(globalThis.' + GLOBAL_NAME + '.MEATS)) })').catch(() => ({ MEATS: {} }));
  const CC = await ev('JSON.parse(JSON.stringify(C))').catch(() => ({}));
  const rowLabels = (stars) => [stars === 1 ? UI.rowFeeOne : fill(UI.rowFee, { n: stars }), UI.rowDeposit, UI.rowTips, UI.rowMenuBonus, UI.rowSeatTips, UI.rowFood,
    UI.rowCharcoal, UI.rowWages, UI.rowDaily, UI.rowSpoiled, UI.rowThrown, UI.rowGrate, UI.rowBurnt, UI.rowTake, UI.rowGear, UI.rowKept, UI.rowDrawn, UI.rowCash];
  // Labels of #rep-money rows in page order, matched to the W17.4 list.
  async function moneyOrder(stars, addon) {
    const names = await ev('[...$(' + JSON.stringify(ID3.repMoney) + ').querySelectorAll(".row")].map((r) => ((r.querySelector(".name") || r).textContent || "").replace(/\\s+/g, " ").trim())');
    const labels = rowLabels(stars);
    const idx = names.map((n) => {
      let best = -1, len = -1;
      labels.forEach((l, i) => { if (n.startsWith(l) && l.length > len) { best = i; len = l.length; } });
      return best;
    });
    assert(idx.every((i) => i >= 0), '#rep-money rows ' + describe(names) + ' hold a label outside W17.4');
    assert(idx.every((i, j) => j === 0 || i > idx[j - 1]), '#rep-money rows out of W17.4 order: ' + describe(names));
    for (const must of [0, 1, 13, 17]) assert(idx.includes(must), '#rep-money has no ' + describe(labels[must]) + ' row: ' + describe(names));
    if (!addon) assert(!idx.includes(3), '#rep-money shows ' + describe(UI.rowMenuBonus) + ' with no add-on');
    return names.length;
  }
  // W25 R-4: week start + Take today + Gear bought + the kept or drawn stock row = Cash, as the rows read.
  async function ledgerAddsUp(boxId) {
    const rows = await ev('[...$(' + JSON.stringify(boxId) + ').querySelectorAll(".row")].map((r) => ({ n: ((r.querySelector(".name") || r).firstChild || {}).textContent || "", d: ((r.querySelector(".effect") || {}).textContent || "").trim(), v: ((r.querySelector(".price") || {}).textContent || "").trim() }))');
    const num = (v) => Number(String(v).replace(/,/g, ''));
    const find = (label) => rows.find((r) => r.n.trim() === label);
    const take = find(UI.rowTake), cash = find(UI.rowCash);
    assert(take && cash, '#' + boxId + ' rows ' + describe(rows.map((r) => r.n)));
    const tail = UI.cashFrom.split('{a}')[1];
    assert(cash.d.endsWith(tail), '#' + boxId + ' Cash detail ' + describe(cash.d));
    const start = num(cash.d.slice(0, cash.d.length - tail.length));
    let sum = start + num(take.v);
    const parts = [start, take.v];
    for (const label of [UI.rowGear, UI.rowShop, UI.rowKept, UI.rowDrawn]) {
      const r = find(label);
      if (r) { sum += num(r.v); parts.push(label + ' ' + r.v); }
    }
    assert(sum === num(cash.v), '#' + boxId + ': ' + parts.join(' ') + ' is ' + sum + ', Cash reads ' + cash.v);
    return parts.join(' ') + ' = ' + cash.v;
  }
  const untilLoop = (id, maxSec) => until('S().loop === ' + JSON.stringify(id), maxSec);
  const secondsLeft = async (slack = 5) => (await ev('S().today && S().today.endAt ? S().today.endAt - S().clock : 160')) + slack;

  await step('names filtered to the allowed set', async () => {
    assert(await visible(ID3.creator), '#creator hidden');
    const v1 = await typeInto(ID3.crName, 'Ana<b>!\u{1F600} Q');
    assert(v1 === 'Anab Q', '#cr-name value ' + describe(v1) + ', wanted "Anab Q"');
    const c1 = await accText(ID3.crNameCount);
    assert(c1 === fill(UI.crCount, { n: 6 }), '#cr-name-count ' + describe(c1));
    const v2 = await typeInto(ID3.crPit, 'ABCDEFGHIJKLMNOPQRST');
    assert(v2.length === 14, '#cr-pit value ' + describe(v2) + ' after 20 letters');
    const c2 = await accText(ID3.crPitCount);
    assert(c2 === fill(UI.crCount, { n: 14 }), '#cr-pit-count ' + describe(c2));
    const v3 = await typeInto(ID3.crPit, 'Marty’s Pit');
    assert(v3 === MARTY.pit, '#cr-pit value ' + describe(v3) + ', wanted ' + describe(MARTY.pit));
    return describe(v1) + ' (' + c1 + '), 20 letters to ' + c2 + ', curly apostrophe to ' + describe(v3);
  });

  await step('creator by real taps', async () => {
    assert(await visible(ID3.creator), '#creator hidden');
    let key = await lookKeyNow();
    assert(key === DEFAULT_LOOK_KEY, 'art.lookKey() on the creator ' + describe(key));
    for (const t of CREATOR_TAPS) {
      await click(t.id);
      await advance(0);
      key = await lookKeyNow();
      assert(key === t.key, 'after #' + t.id + ' art.lookKey() is ' + describe(key) + ', wanted ' + t.key);
      if (t.pressed) {
        const prefix = Object.keys(SWATCH_ROWS).find((p) => t.id.startsWith(p));
        for (let i = 0; i < SWATCH_ROWS[prefix]; i++) {
          const want = prefix + i === t.pressed ? 'true' : 'false';
          const got = await attrOf(prefix + i, 'aria-pressed');
          assert(got === want, '#' + prefix + i + ' aria-pressed ' + describe(got) + ' after #' + t.id);
        }
      }
      if (t.val) {
        const v = (await accText(ID3.crVal(t.val[0]))).toUpperCase();
        assert(v.includes(t.val[1]), '#' + ID3.crVal(t.val[0]) + ' reads ' + describe(v) + ', wanted ' + t.val[1]);
      }
    }
    const nm = await typeInto(ID3.crName, MARTY.name);
    assert(nm === MARTY.name && (await accText(ID3.crNameCount)) === fill(UI.crCount, { n: 5 }), '#cr-name ' + describe(nm) + ', count ' + describe(await accText(ID3.crNameCount)));
    const pt = await valueOf(ID3.crPit);
    assert(pt === MARTY.pit && (await accText(ID3.crPitCount)) === fill(UI.crCount, { n: 11 }), '#cr-pit ' + describe(pt) + ', count ' + describe(await accText(ID3.crPitCount)));
    const sign = await srText(ID3.crSign);
    assert(sign === MARTY.pit, '#cr-sign .sr text ' + describe(sign));
    await screenshot(SCREENSHOTS.creator);
    await click(ID3.crGo);
    await advance(0);
    const s = await ev('({ loop: S().loop, profile: S().profile, pitName: S().pitName })');
    assert(s.loop === LOOP.week, 'loop after Fire it up ' + describe(s.loop));
    assert(deepEq(s.profile, { name: MARTY.name, look: MARTY.look }), 'state.profile ' + describe(s.profile));
    assert(s.pitName === MARTY.pit, 'state.pitName ' + describe(s.pitName));
    key = await lookKeyNow();
    assert(key === lookKeyOf(MARTY.look), 'art.lookKey() after Fire it up ' + describe(key));
    const raw = await storedSave();
    assert(raw && raw.v === 4 && raw.player && raw.player.name === MARTY.name && deepEq(raw.player.look, MARTY.look) && raw.pitName === MARTY.pit, 'stored save ' + describe(raw && { v: raw.v, player: raw.player, pitName: raw.pitName }));
    return CREATOR_TAPS.length + ' taps to ' + key + ', Marty of ' + MARTY.pit + ', saved';
  }, { fatal: true });

  await step('name on the sign and the header', async () => {
    await advance(0);
    const sign = await ev('JSON.parse(JSON.stringify(g.sign))');
    const width = MARTY.pit.length * 5 - 1;
    const want = { text: MARTY.pit.toUpperCase(), font: 'font', x: SIGN_TEXT.x + Math.floor((SIGN_TEXT.w - width) / 2), width };
    assert(deepEq(sign, want), 'PitSim.game.sign ' + describe(sign) + ', wanted ' + describe(want));
    const frame = await captureFrame();
    captures.week = frame;
    const glyphs = frame.filter((d) => d.name === 'font' && d.y === SIGN_TEXT.y && d.x >= SIGN_TEXT.x && d.x < SIGN_TEXT.x + SIGN_TEXT.w).sort((a, b) => a.x - b.x);
    const letters = MARTY.pit.toUpperCase().replace(/ /g, '').split('');
    assert(glyphs.length === letters.length, glyphs.length + ' font records on the sign, wanted ' + letters.length + ': ' + describe(glyphs));
    assert(glyphs[0].x === want.x && glyphs[glyphs.length - 1].x === want.x + width - 4, 'sign glyphs from x ' + glyphs[0].x + ' to ' + glyphs[glyphs.length - 1].x);
    assert(sameJSON(glyphs.map((d) => d.frame), letters.map(FONT_FRAME)), 'sign frames ' + describe(glyphs.map((d) => d.frame)) + ', wanted ' + describe(letters.map(FONT_FRAME)));
    const ws = await srText(ID3.weekSign);
    assert(ws === MARTY.pit, '#week-sign .sr text ' + describe(ws));
    const wh = await text(ID3.weekH);
    const whWant = MARTY.pit + ', ' + fill(UI.weekOf, { w: 1 });
    assert(wh === whWant, '#week-h is ' + describe(wh) + ', wanted ' + describe(whWant));
    return describe(sign.text) + ' in ' + sign.font + ' at x ' + sign.x + ', ' + glyphs.length + ' glyphs; header ' + describe(wh);
  });

  await step('week hub', async () => {
    await advance(0);
    assert(await visible(ID3.week), '#week hidden');
    const label = await accText(ID3.weekLabel);
    assert(label.includes(fill(UI.weekOf, { w: 1 })), '#week-label reads ' + describe(label));
    const when = await accText(ID3.weekWhen);
    assert(when === W15.weekLabel[0], '#week-when reads ' + describe(when));
    for (let w = 1; w <= SEASON_WEEKS; w++) {
      const want = w === 1 ? fill(UI.wkNow, { w }) : w === SEASON_WEEKS ? UI.wkFinale : fill(UI.wkLater, { w, when: W15.weekLabel[w - 1] });
      const got = await attrOf(ID3.wk(w), 'aria-label');
      assert(got === want, '#wk-' + w + ' aria-label ' + describe(got) + ', wanted ' + describe(want));
    }
    const offers = await ev('S().season.offers.map((o) => ({ id: o.id, type: o.type, label: o.label, host: o.host, headcount: o.headcount, menu: o.menu, pay: o.pay, deposit: o.deposit, difficulty: o.difficulty }))');
    const order = await ev('[...$(' + JSON.stringify(ID3.offers) + ').querySelectorAll("article")].map((a) => a.id)');
    assert(sameJSON(order, ['offer-birthday', 'offer-picnic', 'offer-yard']), 'offer cards ' + describe(order));
    for (const o of offers) {
      const card = await accText(ID3.offer(o.id));
      const lines = o.type === 'yard'
        ? [o.label, UI.walkIns, UI.yourPick, W15.venue.backyard, W15.flames[o.difficulty - 1], UI.perPlate, UI.noFee]
        : [o.label, fill(UI.host, { name: o.host }), fill(UI.guests, { n: o.headcount })].concat(o.menu.map((m) => PM.MEATS[m].plateLabel),
          [W15.venue.backyard, W15.flames[o.difficulty - 1], fill(UI.pay, { fee: o.pay }), fill(UI.deposit, { d: o.deposit })]);
      const missing = lines.filter((l) => !card.includes(l));
      assert(missing.length === 0, '#offer-' + o.id + ' lacks ' + describe(missing) + '; it reads ' + describe(card));
    }
    assert((await attrOf(ID3.book('birthday'), 'aria-pressed')) === 'true', '#book-birthday not pressed');
    const bt = await accText(ID3.book('birthday'));
    assert(bt === UI.booked, '#book-birthday reads ' + describe(bt));
    assert(await ev('$(' + JSON.stringify(ID3.go) + ').disabled === false'), '#go disabled; #go-why ' + describe(await accText(ID3.goWhy)));
    const bd = offers.find((o) => o.id === 'birthday');
    const dep = await accText(ID3.goDeposit);
    assert(dep === fill(UI.depositLine, { d: bd.deposit }), '#go-deposit reads ' + describe(dep));
    const ch = await ev(F.charcoal);
    const inv = await accText(ID3.invCharcoal);
    assert(inv === charcoalLine(ch, UI.invCharcoalOne, UI.invCharcoal), '#inv-charcoal reads ' + describe(inv) + ' with ' + ch + ' bags');
    // W25 R-6: in week 1 the goal is the Gear tile's next item, so #goal is hidden as a repeat and
    // Pit news, with nothing else to say before the rain days, is hidden too.
    const goal = await ev('sim.goal()');
    const gl = await accText(ID3.goal);
    const glWant = 'Next goal: ' + goal.label + ', ' + goal.price + '.';
    assert(gl === glWant, '#goal reads ' + describe(gl) + ', wanted ' + describe(glWant));
    assert(gl === 'Next goal: Second kettle, 90.', '#goal reads ' + describe(gl) + ', W19 literal "Next goal: Second kettle, 90."');
    assert(!(await visible(ID3.goal)) && !(await visible('news')), '#goal or #news visible in week 1');
    const gearTile = await attrOf(ID3.cardGear, 'aria-label');
    assert(gearTile && gearTile.includes(fill(UI.gearNext, { label: goal.label, price: goal.price })), '#card-gear reads ' + describe(gearTile));
    assert((await attrOf(ID3.len('normal'), 'aria-pressed')) === 'true', '#len-normal not pressed');
    // Height at 375 by 812 (W17.2), every control 44 px.
    let height;
    try {
      if (DESKTOP_MODE) { await emulate(PHONE); await sleep(TIMEOUT_MS.resize); await advance(0); }
      height = await ev('({ h: $(' + JSON.stringify(ID3.week) + ').scrollHeight, ih: window.innerHeight })');
      assert(height.h <= 2 * height.ih, '#week is ' + height.h + ' px tall, over twice ' + height.ih);
      const small = await ev(SMALL_CONTROLS);
      assert(small.length === 0, 'controls under ' + MIN_CONTROL_PX + ' px on the hub: ' + describe(small.slice(0, 6)));
    } finally {
      if (DESKTOP_MODE) { await emulate(RUN_METRICS); await sleep(TIMEOUT_MS.resize); await advance(0); }
    }
    await screenshot(SCREENSHOTS.week);
    await shotOf(SCREENSHOTS.offers, ID3.offers);
    await shotOf(SCREENSHOTS.inventory, ID3.invCard);
    await ev('($(' + JSON.stringify(ID3.week) + ').scrollTop = 0, true)');
    return 'week 1 of 9, ' + order.length + ' cards, hub ' + height.h + ' of ' + (2 * height.ih) + ' px, ' + describe(inv);
  }, { fatal: true });

  let s46 = null;
  await step('full week loop by real taps', async () => {
    // Harness P-6: the Church picnic is a stretch on one kettle (W24 P-1).
    await click(ID3.book('picnic'));
    await advance(0);
    assert((await attrOf(ID3.book('picnic'), 'aria-pressed')) === 'true', '#book-picnic not pressed');
    const st0 = await ev('({ dis: $(' + JSON.stringify(ID3.go) + ').disabled, why: $(' + JSON.stringify(ID3.goWhy) + ').textContent, needs: $("offer-picnic-needs").textContent, shown: !$("offer-picnic-needs").hidden })');
    assert(st0.dis === true && st0.why === UI.needsKettle2 && st0.needs === UI.needsKettle2 && st0.shown, 'the picked one kettle picnic ' + describe(st0));
    // Pick the Birthday.
    await click(ID3.book('birthday'));
    await advance(0);
    assert((await attrOf(ID3.book('birthday'), 'aria-pressed')) === 'true', '#book-birthday not pressed');
    const pk = await ev('(() => { const b = S().season.booking; return { id: b.id, label: b.label, pay: b.pay, deposit: b.deposit, rail: b.rail }; })()');
    assert(pk.id === 'birthday', 'season.booking ' + describe(pk.id));
    const ne = await accText(ID3.nextEvent);
    assert(ne.includes(pk.label) && ne.includes(fill(UI.pay, { fee: pk.pay })), '#next-event reads ' + describe(ne));
    // W26 Q-1: the header names the pit.
    const ti = await text('title');
    const pitNow = await ev('S().pitName');
    assert(ti === String(pitNow).toUpperCase(), '#title reads ' + describe(ti) + ', wanted ' + describe(String(pitNow).toUpperCase()));
    // Prep in the shop sheet.
    await click(ID3.cardShop);
    await advance(0);
    assert(await visible(ID3.sheet), '#sheet hidden after #card-shop');
    // W26 Q-2: the Birthday's shop lists its rail meats only, each with what the pile covers.
    const sh = await ev('({ ribs: !!$("qty-ribs"), butt: !!$("qty-butt"), other: !!$("shop-other"), exp: attr("shop-other", "aria-expanded"), cs: $("covers-sausage") ? $("covers-sausage").textContent : null, cc: $("covers-chicken") ? $("covers-chicken").textContent : null })');
    assert(!sh.ribs && !sh.butt && sh.other && sh.exp === 'false', 'the Birthday shop rows ' + describe(sh));
    assert(sh.cs === fill(UI.covers, { p: pk.rail.sausage, r: pk.rail.sausage }) && sh.cc === fill(UI.covers, { p: pk.rail.chicken, r: pk.rail.chicken }), 'the covers lines ' + describe(sh));
    await stepDown('charcoal');
    for (let i = 0; i < 4; i++) await click('inc5-charcoal');   // harness P-6: four taps of +5
    await advance(0);
    const q = await text(ID.qty('charcoal'));
    assert(q === '20', '#qty-charcoal ' + describe(q));
    const have = await ev(F.charcoal);
    const hv = await accText(ID3.have('charcoal'));
    assert(hv === fill(UI.youHave, { n: have }), '#have-charcoal reads ' + describe(hv));
    const af = await accText(ID3.after('charcoal'));
    assert(af === fill(UI.afterBags, { n: have + 20 }), '#after-charcoal reads ' + describe(af));
    const m = await ev('({ total: sim.cartTotal(), cash: S().cash })');
    const cart = await accText(ID.cart);
    const cartWant = fill(UI.cartLine, { t: m.total, d: pk.deposit, c: m.cash + pk.deposit - m.total });
    assert(cart === cartWant, '#cart reads ' + describe(cart) + ', wanted ' + describe(cartWant));
    await screenshot(SCREENSHOTS.sheetShop);
    await click(ID3.sheetBack);
    await advance(0);
    assert(await visible(ID3.week), '#week did not come back after #sheet-back');
    // Go.
    const n0 = await eventCount();
    await click(ID3.go);
    await advance(0);
    const dep = await eventsSince(n0, EV3.deposit);
    assert(dep.length === 1 && dep[0].amount === pk.deposit, 'deposit events ' + describe(dep));
    assert((await loop()) === LOOP.prep, 'loop after #go ' + describe(await loop()));
    const committed = await ev('Object.assign({}, S().stock)');
    const rail = await ev('g.rail ? JSON.parse(JSON.stringify(g.rail)) : null');
    const railWant = { kind: 'booking', items: MEAT_IDS.filter((x) => pk.rail[x] > 0).map((x) => ({ meat: x, want: pk.rail[x], sold: 0, left: pk.rail[x] })) };
    assert(deepEq(rail, railWant), 'PitSim.game.rail ' + describe(rail) + ', wanted ' + describe(railWant));
    captures.booking = await captureFrame();
    // Cook one chicken by canvas taps.
    const via = [];
    const a1 = await goto('pile', hasKind(CARRY_KIND.charcoal)); via.push(a1.how);
    assert(a1.ok, 'pile: carrying ' + describe(await ev(F.carrying)));
    const a2 = await goto('kettle1', F.fire('kettle1') + ' >= C.' + C_NAMES.fireLight + ' - 1'); via.push(a2.how);
    assert(a2.ok, 'kettle 1 fire ' + (await ev(F.fire('kettle1'))));
    await click(ID.chip('chicken'));
    await advance(0);
    const a3 = await goto('cooler', hasKind(CARRY_KIND.raw) + ' && ' + F.carrying + '.meat === "chicken"'); via.push(a3.how);
    assert(a3.ok, 'cooler: carrying ' + describe(await ev(F.carrying)) + ', selected ' + describe(await ev('S().selected')));
    const a4 = await goto('kettle1', F.pieces('kettle1') + '.length >= 1'); via.push(a4.how);
    assert(a4.ok, 'kettle 1 has no piece');
    assert(await waitForDone(), 'no piece_done; pieces ' + describe(await ev(F.pieces('kettle1'))));
    const a5 = await goto('kettle1', hasKind(CARRY_KIND.cooked)); via.push(a5.how);
    assert(a5.ok, 'the pull gave ' + describe(await ev(F.carrying)));
    const a6 = await goto('board', F.busy + ' !== null || ' + boardHasPlates + ' || ' + hasKind(CARRY_KIND.plates)); via.push(a6.how);
    assert(a6.ok, 'the slice did not start');
    await until('(' + boardHasPlates + ' || ' + hasKind(CARRY_KIND.plates) + ') && ' + F.busy + ' === null', WAIT_S.slice);
    if (!(await ev(hasKind(CARRY_KIND.plates)))) { const a7 = await goto('board', hasKind(CARRY_KIND.plates)); via.push(a7.how); }
    const a8 = await goto('table', tableHas('chicken')); via.push(a8.how);
    assert(a8.ok, 'the chicken plate did not land on the table');
    const servedExpr = 'globalThis.__smoke.events.slice(' + n0 + ').some((e) => e.type === "served" && e.booked === true)';
    const sv = await until(servedExpr + ' || S().loop === "report"', await secondsLeft(0));
    const served = (await eventsSince(n0, EVENT.served)).filter((e) => e.booked === true);
    assert(served.length >= 1, 'no booked serve within ' + sv.t + ' s (deviation 16); customers ' + describe(await ev(F.customers + '.map((c) => c.want + ":" + c.mode)')));
    assert(served[0].price === 0, 'a booked serve with price ' + served[0].price);
    await advance(0);
    const r2 = await ev('g.rail ? JSON.parse(JSON.stringify(g.rail)) : null');
    const soldChicken = await ev('S().today.sold.chicken');
    const ci = r2 && r2.items.find((x) => x.meat === 'chicken');
    assert(ci && soldChicken >= 1 && ci.left === pk.rail.chicken - soldChicken && ci.sold === soldChicken, 'rail chicken ' + describe(ci) + ' with ' + soldChicken + ' sold');
    // Report.
    const rr = await untilLoop(LOOP.report, await secondsLeft());
    assert(rr.ok, 'loop ' + describe(await loop()) + ' after ' + rr.t + ' s');
    await advance(0);
    assert(await visible(ID.till), '#till hidden at the report');
    const th = await text(ID.tillH);
    const till = await ev(F.till);
    assert(th === fill(till.stars <= 2 ? UI.reportHLow : UI.reportH, { label: pk.label }), '#till-h is ' + describe(th) + ' at ' + till.stars + ' stars');
    const cs = await eventsSince(n0, EV3.clientStars);
    assert(cs.length === 1, cs.length + ' client_stars events');
    const sc = await accText(ID3.repScore);
    assert(sc.includes(fill(UI.of5, { n: till.stars })) && till.stars === cs[0].stars, '#rep-score reads ' + describe(sc) + ' for ' + till.stars + ' stars');
    const rows = await moneyOrder(till.stars, null);
    assert(till.cashAfter === (await ev(F.cash)), 'till.cashAfter ' + till.cashAfter + ', cash ' + (await ev(F.cash)));
    const ledger = await ledgerAddsUp(ID3.repMoney);
    const rc = await accText(ID3.repCharcoal);
    assert(rc === charcoalLine(till.charcoalAfter, UI.charcoalLeftOne, UI.charcoalLeft), '#rep-charcoal reads ' + describe(rc));
    const spoilText = (await visible(ID3.repSpoil)) ? await accText(ID3.repSpoil) : null;
    await screenshot(SCREENSHOTS.report);
    s46 = { till, have, committed, spoilText };
    // Next.
    await click(ID.next);
    await advance(0);
    const wk = await ev('({ loop: S().loop, week: S().season.week })');
    assert(wk.loop === LOOP.week && wk.week === 2, 'after #next ' + describe(wk));
    const w1 = await attrOf(ID3.wk(1), 'aria-label');
    const w1Want = fill(UI.wkDone, { w: 1, label: pk.label, stars: starsText(till.stars) });
    assert(w1 === w1Want, '#wk-1 aria-label ' + describe(w1) + ', wanted ' + describe(w1Want));
    return 'picnic a stretch on one kettle; birthday: deposit ' + pk.deposit + ', ' + served.length + ' booked serve(s), ' + till.stars + ' stars, ' + rows + ' money rows (' + ledger + '), cash ' + till.cashAfter + '; taps ' + via.join(' ');
  }, { fatal: true });

  await step('inventory rollover', async () => {
    assert(s46, 'step 46 left nothing to check');
    const t = s46.till;
    assert(t.charcoalAfter === s46.have + 20 - t.bags, 'charcoalAfter ' + t.charcoalAfter + ', wanted ' + s46.have + ' + 20 - ' + t.bags);
    assert((await ev(F.charcoal)) === t.charcoalAfter, 'charcoal now ' + (await ev(F.charcoal)));
    const inv = await accText(ID3.invCharcoal);
    assert(inv === charcoalLine(t.charcoalAfter, UI.invCharcoalOne, UI.invCharcoal), '#inv-charcoal reads ' + describe(inv));
    await click(ID3.cardShop);
    await advance(0);
    const hv = await accText(ID3.have('charcoal'));
    assert(hv === fill(UI.youHave, { n: t.charcoalAfter }), '#have-charcoal reads ' + describe(hv));
    await click(ID3.sheetBack);
    await advance(0);
    const spoiled = sumOf(t.spoiled);
    assert(t.spoilReason === 'nocooler' && spoiled > 0 && spoiled <= sumOf(s46.committed), 'spoiled ' + spoiled + ' (' + t.spoilReason + ') of ' + sumOf(s46.committed) + ' committed');
    assert(deepEq(t.coolerAfter, zeroMeat()), 'coolerAfter ' + describe(t.coolerAfter));
    assert(s46.spoilText === fill(UI.spoilNone, { n: spoiled }), "step 46's #rep-spoil read " + describe(s46.spoilText));
    assert(sumOf(await ev('S().stock')) === 0, 'stock now ' + describe(await ev('S().stock')));
    assert(await visible(ID3.invEmpty), '#inv-empty hidden with an empty cooler');
    assert((await accText(ID3.invEmpty)) === UI.invEmpty, '#inv-empty reads ' + describe(await accText(ID3.invEmpty)));
    return describe(inv) + ', ' + spoiled + ' units spoiled overnight, cooler empty';
  });

  await step('two tap week', async () => {
    const first = await ev('S().season.offers[0].id');
    await click(ID3.book(first));
    await advance(0);
    await click(ID3.go);
    await advance(0);
    assert(await ev(inService), 'phase ' + (await ev(F.phase)) + ' after two taps');
    const c = await ev('({ stock: S().stock, rail: S().today.rail, charcoal: S().charcoal, plates: Object.fromEntries(Object.entries(globalThis.' + GLOBAL_NAME + '.MEATS).map(([k, v]) => [k, v.plates])) })');
    for (const m of MEAT_IDS) if (c.rail[m] > 0) assert(c.stock[m] * c.plates[m] >= c.rail[m], m + ': ' + c.stock[m] + ' units for ' + c.rail[m] + ' plates');
    assert(c.charcoal >= 1, 'charcoal ' + c.charcoal);
    const r = await untilLoop(LOOP.report, await secondsLeft());
    assert(r.ok, 'no report after ' + r.t + ' s');
    await advance(0);
    await click(ID.next);
    await advance(0);
    assert((await loop()) === LOOP.week, 'loop after #next ' + describe(await loop()));
    return 'book-' + first + ' then go; rail ' + describe(c.rail) + ' covered, ' + c.charcoal + ' bags; report after ' + r.t + ' s';
  });

  await step('cooler capacity spoilage on the report', async () => {
    await reload(saveV4({ season: { week: 3, results: resultsOf(2) }, gear: { cooler: true }, stock: { sausage: 20, butt: 5 }, charcoal: 10, cash: 100 }));
    assert((await loop()) === LOOP.week && (await visible(ID3.week)), 'the fixture loaded as ' + describe(await loop()));
    await click(ID3.book('birthday'));
    await advance(0);
    await click(ID3.cardShop);
    await advance(0);
    for (const m of MEAT_IDS) if (await present(ID.qty(m))) await stepDown(m);
    await click(ID3.sheetBack);
    await advance(0);
    const stock0 = await ev('Object.assign({}, S().stock)');
    await click(ID3.go);
    await advance(0);
    assert(await ev(inService), 'not in service after #go; #go-why ' + describe(await accText(ID3.goWhy).catch(() => '')));
    const r = await untilLoop(LOOP.report, await secondsLeft());
    assert(r.ok, 'no report after ' + r.t + ' s');
    await advance(0);
    const t = await ev(F.till);
    const R = refModel({ MEATS: PM.MEATS, C: CC, STRINGS: {}, BOOKINGS: {} });
    const want = R.keepByCost(stock0, t.coolerCap);
    assert(deepEq(t.coolerAfter, want.keep), 'coolerAfter ' + describe(t.coolerAfter) + ', wanted ' + describe(want.keep));
    const n = sumOf(want.spoil);
    const sp = await accText(ID3.repSpoil);
    assert(sp === fill(UI.spoilFull, { cap: t.coolerCap, n }), '#rep-spoil reads ' + describe(sp));
    const cl = await accText(ID3.repCooler);
    assert(cl === fill(UI.cooler, { list: meatListText(PM, want.keep) }), '#rep-cooler reads ' + describe(cl));
    if (t.coolerCap === 12) {
      assert(sp === 'The cooler holds 12. 13 spoiled.', '#rep-spoil ' + describe(sp) + ', W19 literal');
      assert(cl === 'In the cooler now: 7 Sausage, 5 Pork butt.', '#rep-cooler ' + describe(cl) + ', W19 literal');
    }
    await click(ID.next);
    await advance(0);
    const units = sumOf(want.keep);
    const ic = await ev('({ label: attr(' + JSON.stringify(ID3.invCooler) + ', "aria-label"), text: acc(' + JSON.stringify(ID3.invCooler) + '), now: attr(' + JSON.stringify(ID3.invCooler) + ', "aria-valuenow"), max: attr(' + JSON.stringify(ID3.invCooler) + ', "aria-valuemax"), role: attr(' + JSON.stringify(ID3.invCooler) + ', "role") })');
    const icWant = fill(UI.invCooler, { u: units, cap: t.coolerCap });
    assert((ic.label === icWant || ic.text === icWant) && ic.now === String(units) && ic.max === String(t.coolerCap) && ic.role === 'meter', '#inv-cooler ' + describe(ic) + ', wanted ' + describe(icWant));
    return describe(sp) + ' ' + describe(cl) + '; next week ' + describe(icWant);
  });

  await step('season end after week 9', async () => {
    await reload(saveV4({ season: { week: 9, results: resultsOf(8) }, cash: 300, rep: 40, charcoal: 10 }));
    const cards = await ev('[...$(' + JSON.stringify(ID3.offers) + ').querySelectorAll("article")].map((a) => a.id)');
    assert(sameJSON(cards, ['offer-finale']), 'week 9 cards ' + describe(cards));
    await click(ID3.go);
    await advance(0);
    assert(await ev(inService), 'the finale did not start; #go-why ' + describe(await accText(ID3.goWhy).catch(() => '')));
    const r = await untilLoop(LOOP.report, await secondsLeft());
    assert(r.ok, 'no report after ' + r.t + ' s');
    await advance(0);
    const th = await text(ID.tillH);
    const ft = await ev(F.till);
    assert(th === fill(ft.stars <= 2 ? UI.reportHLow : UI.reportH, { label: W15.booking.finale }), '#till-h is ' + describe(th) + ' at ' + ft.stars + ' stars');
    const nx = await accText(ID.next);
    assert(nx === UI.seeSeason, '#next reads ' + describe(nx));
    await click(ID.next);
    await advance(0);
    assert(await visible(ID3.seasonEnd), '#season-end hidden');
    for (let w = 1; w <= SEASON_WEEKS; w++) assert(await present(ID3.seWk(w)), '#se-wk-' + w + ' missing');
    const pv = await ev('sim.seasonEndPreview()');
    const rep = await ev(F.rep);
    const b = Math.max(CC.SEASON_REP_FLOOR, Math.floor(CC.SEASON_CARRY_REP * rep));
    assert(pv && pv.repTo === b && pv.repFrom === rep, 'seasonEndPreview() ' + describe(pv));
    const lines = {
      [ID3.seCash]: fill(UI.seCash, { c: commas(await ev(F.cash)) }),
      [ID3.seRep]: fill(UI.seRep, { b, a: rep }),
      [ID3.seMeat]: sumOf(pv.spoiled) ? fill(UI.seMeat, { list: meatListText(PM, pv.spoiled) }) : UI.seMeatNone,
      [ID3.seCharcoal]: fill(UI.seCharcoal, { n: await ev(F.charcoal) })
    };
    for (const [id, want] of Object.entries(lines)) {
      const got = await accText(id);
      assert(got === want, '#' + id + ' reads ' + describe(got) + ', wanted ' + describe(want));
    }
    await screenshot(SCREENSHOTS.seasonEnd);
    await click(ID3.seasonNext);
    await advance(0);
    const s = await ev('({ loop: S().loop, year: S().season.year, week: S().season.week })');
    assert(s.loop === LOOP.week && s.year === 2 && s.week === 1, 'after #season-next ' + describe(s));
    const wl = await accText(ID3.weekLabel);
    assert(wl.includes(fill(UI.weekOf, { w: 1 })), '#week-label reads ' + describe(wl));
    const raw = await storedSave();
    assert(raw && raw.v === 4 && raw.season && raw.season.year === 2 && sameJSON(raw.season.results, []), 'stored save season ' + describe(raw && raw.season));
    return 'finale report, season end ' + describe(lines[ID3.seRep]) + ', season 2 week 1';
  });

  await step('v2.1 save migrates', async () => {
    await reload(SAVE_V3_SAMPLE);
    await advance(0);
    assert(await visible(ID3.creator), '#creator hidden for a v3 save');
    const sub = await accText(ID3.crSub);
    assert(sub === UI.crSub, '#cr-sub reads ' + describe(sub));
    const nf = await ev('({ nv: $(' + JSON.stringify(ID3.crName) + ').value, np: $(' + JSON.stringify(ID3.crName) + ').placeholder, pv: $(' + JSON.stringify(ID3.crPit) + ').value, pp: $(' + JSON.stringify(ID3.crPit) + ').placeholder })');
    assert(nf.nv === '' && nf.np === W15.defaultName && nf.pv === '' && nf.pp === W15.defaultPit, 'name fields ' + describe(nf));
    assert((await lookKeyNow()) === DEFAULT_LOOK_KEY, 'art.lookKey() ' + describe(await lookKeyNow()));
    const status = await text(ID.status);
    assert(status === UI.notice, '#status is ' + describe(status) + ', wanted ' + describe(UI.notice));
    await click(ID3.crGo);
    await advance(0);
    assert((await loop()) === LOOP.week && (await visible(ID3.week)), 'after Fire it up: loop ' + describe(await loop()));
    const raw = await storedSave();
    assert(raw && raw.v === 4 && raw.player && deepEq(raw.player.look, DEFAULT_LOOK) && raw.cash === SAVE_V3_SAMPLE.cash && raw.charcoal === SAVE_V3_SAMPLE.charcoal && raw.gear.kettle2 === true,
      'stored save ' + describe(raw && { v: raw.v, player: raw.player, cash: raw.cash, charcoal: raw.charcoal, gear: raw.gear }));
    return 'creator with ' + describe(sub) + ', notice shown, week 1 hub, stored v 4 cash ' + raw.cash + ' charcoal ' + raw.charcoal;
  });
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
    const v3hooks = await ev('({ rail: "rail" in g, sign: "sign" in g, panel: "panel" in g })');
    assert(v3hooks.rail && v3hooks.sign && v3hooks.panel, 'PitSim.game v3.0 hooks ' + describe(v3hooks));
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
    const pal = await ev('globalThis.' + GLOBAL_NAME + '.art.PALETTE.slice(32, 36)');
    assert(sameJSON(pal.map((c) => String(c).toLowerCase()), Object.values(PALETTE_NEW)), 'PALETTE 32 to 35 ' + describe(pal) + ', wanted ' + describe(Object.values(PALETTE_NEW)));
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
    // Playtest round 1 (P-5): every tutorial text the banner shows fits the K10 box.
    const wraps = await run('const A = globalThis.' + GLOBAL_NAME + '.art; const T = globalThis.' + GLOBAL_NAME + '.STRINGS.tutorial; const out = {};'
      + ' for (const k of Object.keys(T)) { if (' + describe(BANNER.clipOnly) + '.includes(k)) continue;'
      + '   const words = String(T[k]).toUpperCase().split(/\\s+/).filter(Boolean); let lines = 0, cur = "";'
      + '   for (const w of words) { const n = cur ? cur + " " + w : w; if (!cur || A.textWidth(n) <= ' + BANNER.textW + ') cur = n; else { lines++; cur = w; } }'
      + '   out[k] = lines + (cur ? 1 : 0); }'
      + ' return out;');
    const longBanners = Object.entries(wraps).filter(([, n]) => n > BANNER.maxLines);
    assert(longBanners.length === 0, 'tutorial banners over ' + BANNER.maxLines + ' lines: ' + describe(longBanners));
    const lookNote = await lookChecks();
    return REQUIRED_SPRITES.length + ' sprites, ' + r.pal + ' colors, ' + COLOR_KEYS.length + ' keys; charcoal, piece frame 4, arrow and bubble grids pass; ' + lookNote;
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
    const s = await ev('({ phase: ' + F.phase + ', day: ' + F.day + ', cash: ' + F.cash + ', start: C.' + C_NAMES.startCash + ', loop: S().loop })');
    assert(s.phase === PHASE.morning, 'phase ' + s.phase);
    assert(s.day === 1, 'day ' + s.day);
    assert(s.cash === s.start, 'cash ' + s.cash);
    assert(await visible(ID.clipboard), '#clipboard hidden');
    // v3.0 (W19 step 24).
    assert(s.loop === LOOP.tutorial, 'loop ' + describe(s.loop));
    const hud = await accText(ID3.hudDay);
    assert(hud === 'Day 1', '#hud-day is ' + describe(hud));
    assert(!(await visible(ID3.week)), '#week visible on the tutorial morning');
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
    // v3.0 (W19 step 27): the tutorial day, and no rail while the banner shows.
    const kind = await ev('S().today.kind');
    assert(kind === 'tutorial', 'today.kind ' + describe(kind));
    const railNow = await ev('g.rail === null');
    assert(railNow, 'PitSim.game.rail while the banner shows ' + describe(await ev('g.rail')));
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
    // v3.0 (W19 step 37).
    const lp = await ev('({ loop: S().loop, phase: S().phase, results: S().season.results })');
    assert(lp.loop === LOOP.tutorial && lp.phase === PHASE.evening, 'loop ' + describe(lp.loop) + ', phase ' + lp.phase);
    assert(sameJSON(lp.results, []), 'season.results ' + describe(lp.results));
    assert((await eventsOfType(EV3.clientStars)).length === 0, 'client_stars on the tutorial day');
    return 'day ' + (await ev(F.day)) + ', loop tutorial, no client stars';
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
    const body = (await present(ID.tillBody)) ? await text(ID.tillBody) : await text(ID.till);
    assert(body.includes(TEXT.seatTipsRow), '#till-body has no ' + describe(TEXT.seatTipsRow) + ' row');
    const t = await ev(F.till);
    const daily = await ev('C.' + C_NAMES.dailyCosts);
    const want = t.revenue + t.tips + t.seatTips - t.wages - daily;
    assert(t.net === want, 'till.net ' + t.net + ', wanted ' + want);
    // W25 R-4: the shop's rows are information, and Paid at the shop makes the rows reach Cash.
    const tr = await ev('[...$(' + JSON.stringify(ID.till) + ').querySelectorAll(".row")].map((r) => ({ n: ((r.querySelector(".name") || r).firstChild || {}).textContent || "", v: ((r.querySelector(".price") || {}).textContent || "").trim(), info: r.classList.contains("info") }))');
    for (const label of ['Food cost (what you cooked)', 'Charcoal used', 'Spoiled overnight', 'Thrown out', 'Left on the grate']) {
      const r = tr.find((x) => x.n.trim() === label);
      assert(r && r.info && !/^-/.test(r.v), '#till row ' + describe(label) + ' ' + describe(r));
    }
    const shop = tr.find((x) => x.n.trim() === UI.rowShop);
    assert(shop && typeof t.cashStart === 'number', '#till has no ' + describe(UI.rowShop) + ' row (cashStart ' + describe(t.cashStart) + ')');
    const paid = -Number(shop.v === '0' ? 0 : shop.v);
    assert(t.cashStart + t.net - (t.gearSpent | 0) - paid === t.cashAfter && paid >= 0, 'start ' + t.cashStart + ' + take ' + t.net + ' - gear ' + (t.gearSpent | 0) + ' - shop ' + paid + ' is not cash ' + t.cashAfter);
    // v3.0 (W19 step 39): Continue, and the cooler and charcoal lines.
    const nx = await accText(ID.next);
    assert(nx === UI.cont, '#next is ' + describe(nx) + ', wanted ' + describe(UI.cont));
    const meatsP = await ev('JSON.parse(JSON.stringify(globalThis.' + GLOBAL_NAME + '.MEATS))');
    const list = meatListText({ MEATS: meatsP }, t.coolerAfter || {});
    const coolWant = list ? fill(UI.cooler, { list }) : UI.coolerNothing;
    const cool = await accText(ID3.repCooler);
    assert(cool === coolWant, '#rep-cooler is ' + describe(cool) + ', wanted ' + describe(coolWant));
    const chWant = charcoalLine(t.charcoalAfter, UI.charcoalLeftOne, UI.charcoalLeft);
    const ch = await accText(ID3.repCharcoal);
    assert(ch === chWant, '#rep-charcoal is ' + describe(ch) + ', wanted ' + describe(chWant));
    await screenshot(SCREENSHOTS.till);
    return 'served ' + t.served + ', seated ' + t.seated + ', revenue ' + t.revenue + ', tips ' + t.tips + ', seat tips ' + t.seatTips + ', net ' + t.net + ', cash ' + t.cashAfter;
  });

  let savedCash = null;
  let savedCharcoal = null;
  await step('save key present and valid', async () => {
    const r = await run('const raw = localStorage.getItem(' + JSON.stringify(SAVE_KEY) + '); let parsed = null; try { parsed = JSON.parse(raw); } catch (e) { return { raw, error: String(e) }; } return { raw: !!raw, parsed, v: ' + GLOBAL_NAME + '.validateSave(parsed), cash: ' + F.cash + ', day: ' + F.day + ' };');
    assert(r.raw, SAVE_KEY + ' missing');
    assert(!r.error, 'save is not JSON: ' + r.error);
    assert(r.v, 'validateSave returned null');
    assert(r.v.day === 2 && r.day === 2, 'save day ' + r.v.day + ', state day ' + r.day);
    assert(r.v.cash === r.cash, 'save cash ' + r.v.cash + ', state cash ' + r.cash);
    assert(r.parsed.v === 4, 'raw save v is ' + describe(r.parsed.v));
    assert(r.parsed.tutorial && r.parsed.tutorial.done === true, 'raw save tutorial is ' + describe(r.parsed.tutorial));
    assert(r.parsed.decor && typeof r.parsed.decor === 'object', 'raw save has no decor');
    assert(r.parsed.stats && r.parsed.stats.seated >= 1, 'raw save stats.seated is ' + describe(r.parsed.stats && r.parsed.stats.seated));
    assert(r.parsed.player === null, 'raw save player is ' + describe(r.parsed.player));
    assert(r.parsed.season && r.parsed.season.week === 1 && sameJSON(r.parsed.season.results, []), 'raw save season ' + describe(r.parsed.season));
    savedCash = r.cash;
    savedCharcoal = await ev(F.charcoal);
    return 'day ' + r.v.day + ', cash ' + r.v.cash + ', seated ' + r.parsed.stats.seated + ', v 4, tutorial done, player null, week 1';
  });

  const before = await probeMetrics().catch(() => ({ bored: 0, boredPrep: 0, service: 0, events: 0 }));
  const eventsDay1 = await run('return globalThis.__smoke.events;').catch(() => []);

  await step('reload persists', async () => {
    await reload();
    const s = await ev('({ phase: ' + F.phase + ', day: ' + F.day + ', cash: ' + F.cash + ', charcoal: ' + F.charcoal + ', tutorial: S().tutorial, loop: S().loop, profile: S().profile })');
    assert(s.phase === PHASE.morning, 'phase ' + s.phase);
    assert(s.day === 2, 'day ' + s.day);
    assert(savedCash === null || s.cash === savedCash, 'cash ' + s.cash + ', saved ' + savedCash);
    assert(savedCharcoal === null || s.charcoal === savedCharcoal, 'charcoal ' + s.charcoal + ', the till left ' + savedCharcoal);
    assert(s.tutorial && s.tutorial.done === true, 'state.tutorial on day 2 ' + describe(s.tutorial));
    // v3.0 (W19 step 41): the reload lands on the creator.
    assert(s.loop === LOOP.creator && s.profile === null, 'loop ' + describe(s.loop) + ', profile ' + describe(s.profile));
    assert(await visible(ID3.creator), '#creator hidden after the reload');
    assert(!(await visible(ID.clipboard)), '#clipboard visible after the reload');
    assert(!(await present(ID.tutClip)), '#tut-clip present on day 2');
    const sub = await accText(ID3.crSub);
    assert(sub === UI.crSubDone, '#cr-sub is ' + describe(sub) + ', wanted ' + describe(UI.crSubDone));
    // W25 R-5: the defaults are placeholders over empty fields.
    const nf = await ev('({ nv: $(' + JSON.stringify(ID3.crName) + ').value, np: $(' + JSON.stringify(ID3.crName) + ').placeholder, pv: $(' + JSON.stringify(ID3.crPit) + ').value, pp: $(' + JSON.stringify(ID3.crPit) + ').placeholder })');
    assert(nf.nv === '' && nf.np === W15.defaultName && nf.pv === '' && nf.pp === W15.defaultPit, '#cr-name and #cr-pit ' + describe(nf));
    return 'creator after the reload, cash ' + s.cash + ', charcoal ' + s.charcoal + ', placeholders ' + describe(nf.np) + ' and ' + describe(nf.pp) + ' over empty fields';
  }, { fatal: true });

  await v3BrowserSteps(captures);

  await step('decor purchase shows the sprite', async () => {
    // v3.0 (W19 step 52): through the hub's Gear sheet on a week 2 fixture.
    await reload(saveV4({ season: { week: 2, results: resultsOf(1) }, cash: DECOR_SAVE.cash }));
    const s = await ev('({ loop: S().loop, phase: ' + F.phase + ', cash: ' + F.cash + ', week: S().season.week })');
    assert(s.loop === LOOP.week && s.phase === PHASE.morning && s.cash === DECOR_SAVE.cash && s.week === 2, 'seeded save loaded as ' + describe(s));
    await click(ID3.cardGear);
    await advance(0);
    assert(await visible(ID3.sheet), '#sheet hidden after #card-gear');
    const n0 = await eventCount();
    await click(ID.buy(DECOR_BUY.id));
    await advance(0);
    const bought = (await eventsSince(n0, EVENT.purchase)).filter((e) => e.kind === 'decor');
    assert(bought.length === 1 && bought[0].id === DECOR_BUY.id, 'decor purchase events ' + describe(bought));
    assert(await ev(F.decor + '.' + DECOR_BUY.id + ' === true'), 'state.decor.' + DECOR_BUY.id + ' is not true');
    const seats = await text(ID.seats);
    const want = TEXT.seats(...DECOR_BUY.seatsAfter);
    assert(seats === want, '#seats is ' + describe(seats) + ', wanted ' + describe(want));
    await click(ID3.sheetBack);
    await advance(0);
    const frame = await captureFrame();
    assert(hasRecord(frame, DECOR_BUY.draw), 'captureFrame has no ' + describe(DECOR_BUY.draw));
    assert(!outlineAt(frame, DECOR_BUY.outlineGone), 'the ' + OUTLINE + ' at ' + describe(DECOR_BUY.outlineGone) + ' is still drawn');
    const stored = await run('try { const raw = JSON.parse(localStorage.getItem(' + JSON.stringify(SAVE_KEY) + ')); return { raw: raw && raw.v, v: ' + GLOBAL_NAME + '.validateSave(raw) }; } catch (e) { return { error: String(e) }; }');
    assert(stored && stored.v && stored.v.decor && stored.v.decor[DECOR_BUY.id] === true, 'stored save decor ' + describe(stored && ((stored.v && stored.v.decor) || stored.error)));
    assert(stored.v.v === 4 && stored.raw === 4, 'stored save v ' + describe(stored.raw));
    await screenshotYard(SCREENSHOTS.decor);
    return seats + ' cash ' + (await ev(F.cash)) + ', stored v 4';
  });

  await step('v1 save migrates', async () => {
    await reload(SAVE_V1_SAMPLE);
    await advance(0);
    const read = '({ loop: S().loop, phase: ' + F.phase + ', day: ' + F.day + ', cash: ' + F.cash + ', rep: ' + F.rep + ', stock: ' + F.stock + ', charcoal: ' + F.charcoal + ', gear: ' + F.gear + ', hires: ' + F.hires + ', decor: ' + F.decor + ' })';
    const s = await ev(read);
    assert(s.phase === PHASE.morning, 'phase ' + s.phase);
    assert(s.loop === LOOP.creator && (await visible(ID3.creator)), 'loop ' + describe(s.loop) + ', #creator visible ' + (await visible(ID3.creator)));
    for (const k of ['day', 'cash', 'rep', 'stock', 'charcoal', 'gear', 'hires']) {
      assert(sameJSON(s[k], SAVE_V1_SAMPLE[k]), k + ' is ' + describe(s[k]) + ', wanted ' + describe(SAVE_V1_SAMPLE[k]));
    }
    assert(s.decor && DECOR_IDS.every((d) => s.decor[d] === false), 'decor ' + describe(s.decor));
    const status = await text(ID.status);
    assert(status === TEXT.notice, '#status is ' + describe(status) + ', wanted ' + describe(TEXT.notice));
    const raw = await storedSave();
    assert(raw && raw.v === 4, 'stored save v is ' + describe(raw && raw.v));
    assert(raw.tutorial && raw.tutorial.done === true, 'stored save tutorial ' + describe(raw.tutorial));
    await click(ID3.crGo);
    await advance(0);
    const s2 = await ev(read);
    assert(s2.loop === LOOP.week && (await visible(ID3.week)), 'after Fire it up loop ' + describe(s2.loop));
    for (const k of ['day', 'cash', 'rep', 'stock', 'charcoal', 'gear', 'hires']) {
      assert(sameJSON(s2[k], SAVE_V1_SAMPLE[k]), 'on the hub ' + k + ' is ' + describe(s2[k]) + ', wanted ' + describe(SAVE_V1_SAMPLE[k]));
    }
    return 'creator then week 1 hub, day ' + s.day + ', cash ' + s.cash + ', rep ' + s.rep + ', stored v ' + raw.v + ', tutorial done';
  });

  await step('v2 save loads with the tutorial done', async () => {
    const startRep = await ev('C.' + C_NAMES.startRep);
    await reload(saveV2({ day: 1, cash: 80, charcoal: 5, stock: { sausage: 3 } }, startRep));
    await advance(0);
    const s = await ev('({ loop: S().loop, phase: ' + F.phase + ', day: ' + F.day + ', tutorial: S().tutorial })');
    assert(s.phase === PHASE.morning && s.day === 1, 'loaded as ' + describe(s));
    assert(s.loop === LOOP.creator && (await visible(ID3.creator)), 'loop ' + describe(s.loop));
    assert(deepEq(s.tutorial, { step: null, done: true }), 'state.tutorial ' + describe(s.tutorial));
    assert((await tut()) === null, 'tutorialStep() ' + describe(await tut()));
    for (const id of [ID.tutClip, ID.tutSkip]) assert(!(await present(id)), '#' + id + ' present after a v2 save');
    assert((await anyPulse()) === 0, PULSE + ' on ' + (await anyPulse()) + ' element(s)');
    const status = await text(ID.status);
    assert(status === TEXT.notice, '#status is ' + describe(status) + ', wanted the W13.3 notice for a v2 save');
    await click(ID3.crGo);
    await advance(0);
    assert((await loop()) === LOOP.week, 'after Fire it up loop ' + describe(await loop()));
    assert(await ev('$(' + JSON.stringify(ID3.go) + ').disabled === false'), '#go disabled; #go-why ' + describe(await accText(ID3.goWhy)));
    await click(ID3.go);
    await until('false', WAIT_S.afterOpen);
    await advance(0);
    assert(await ev(inService), 'the cook did not start; phase ' + (await ev(F.phase)));
    const st2 = await text(ID.status);
    assert(st2.startsWith(TEXT.gateOpensIn), '#status is ' + describe(st2) + ', wanted the gate countdown');
    assert((await banner()) === null, 'banner ' + describe(await banner()));
    const ar = arrows(await captureFrame());
    assert(ar.length === 0, 'arrow drawn with the tutorial done: ' + describe(ar));
    const ser = await ev('sim.' + SIM_METHODS.serialize + '()');
    assert(ser.v === 4 && ser.tutorial && ser.tutorial.done === true, 'serialize() ' + describe({ v: ser.v, tutorial: ser.tutorial }));
    return 'v2 day 1 save: creator, no tutorial, notice, then a cook with ' + describe(st2);
  });

  await step('skip tutorial', async () => {
    await reloadFresh();
    const s = await ev('({ loop: S().loop, phase: ' + F.phase + ', day: ' + F.day + ' })');
    assert(s.loop === LOOP.tutorial && s.phase === PHASE.morning && s.day === 1, 'a cleared save loaded as ' + describe(s));
    await expectStep('open', 'open', 'new game');
    assert(await visible(ID.tutSkip), '#tut-skip not visible on a new game');
    const n0 = await eventCount();
    await click(ID.tutSkip);
    await advance(0);
    const dn = await eventsSince(n0, EVENT.tutorialDone);
    assert(dn.length === 1 && dn[0].skipped === true, 'tutorial_done after #tut-skip ' + describe(dn));
    // v3.0 (W19 step 55): the skip goes straight to the creator.
    assert((await loop()) === LOOP.creator, 'loop after #tut-skip ' + describe(await loop()));
    assert(await visible(ID3.creator), '#creator hidden after #tut-skip');
    assert(!(await visible(ID.clipboard)), '#clipboard still visible after the skip');
    const stored = await run('try { return ' + GLOBAL_NAME + '.validateSave(JSON.parse(localStorage.getItem(' + JSON.stringify(SAVE_KEY) + '))); } catch (e) { return null; }');
    assert(stored && stored.tutorial && stored.tutorial.done === true, 'stored save after the skip ' + describe(stored && stored.tutorial));
    // Skip from the pause panel in service, on a second fresh game.
    await reloadFresh();
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
    assert((await loop()) === LOOP.tutorial, 'loop after the service skip ' + describe(await loop()));
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
    return 'clipboard skip to the creator and pause skip; gate_soon ' + soon.at + ', gate_open ' + open.at;
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
    // v3.0 (W19 step 57): Pitmaster opens the creator with Back; a tap there is undone by Back.
    const key0 = await lookKeyNow();
    const loop0 = await loop();
    await click(ID3.pauseLook);
    await advance(0);
    assert(await visible(ID3.creator), '#creator hidden after #pause-look');
    assert(await visible(ID3.crBack), '#cr-back hidden on the creator opened from pause');
    assert(!(await present(ID3.crSub)) || !(await visible(ID3.crSub)), '#cr-sub shown on the creator opened from pause');
    const swatch = key0.split('-')[0] === '3' ? 'cr-skin-0' : 'cr-skin-3';
    await click(swatch);
    await advance(0);
    const key1 = await lookKeyNow();
    assert(key1 !== key0 && key1.split('-')[0] === swatch.slice(-1), 'art.lookKey() after #' + swatch + ' is ' + describe(key1) + ' (was ' + key0 + ')');
    await click(ID3.crBack);
    await advance(0);
    assert(await visible(ID.pause), '#pause did not come back after #cr-back');
    assert((await lookKeyNow()) === key0, 'art.lookKey() after #cr-back ' + describe(await lookKeyNow()) + ', wanted ' + key0);
    assert((await loop()) === loop0 && (await ev(F.paused + ' === true')), 'loop ' + describe(await loop()) + ' or pause changed by the creator');
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
    return 'Pitmaster from the pause panel and back with the look restored; Controls from the pause panel and back; P pauses and resumes';
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
    if (await visible(ID3.weekNew)) { await newGame(ID3.weekNew); return 'new game from the hub'; }
    await reloadFresh();
    return 'a cleared save';
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
      await reloadFresh();   // deviation 19
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
      // v3.0 (W19 step 60): the hub, a sheet, the creator, a report and the season end card.
      const measure = async (label, controls) => {
        await advance(0);
        const l = await ev('({ sw: document.documentElement.scrollWidth, iw: window.innerWidth })');
        assert(l.sw <= l.iw, label + ': scrollWidth ' + l.sw + ' over innerWidth ' + l.iw);
        const sm = await ev(controls ? SMALL_CONTROLS : SMALL_BUTTONS);
        assert(sm.length === 0, label + ': controls under ' + MIN_CONTROL_PX + ' px ' + describe(sm.slice(0, 5)));
        notes.push(label + ' ok');
      };
      await reload(saveV4({ season: { week: 2, results: resultsOf(1) } }));
      assert(await visible(ID3.week), '#week hidden for the layout measure');
      await measure('hub', true);
      await click(ID3.cardShop);
      await measure('shop sheet', true);
      await click(ID3.sheetBack);
      await reload(SAVE_V3_SAMPLE);
      assert(await visible(ID3.creator), '#creator hidden for the layout measure');
      await measure('creator', true);
      const fields = await ev('[' + JSON.stringify(ID3.crName) + ', ' + JSON.stringify(ID3.crPit) + '].map((id) => Math.round($(id).getBoundingClientRect().height))');
      assert(fields.every((h) => h >= MIN_CONTROL_PX), 'creator fields ' + describe(fields) + ' px tall');
      await reload(saveV4({ season: { week: 2, results: resultsOf(1) } }));
      await click(ID3.go);
      await advance(0);
      assert(await ev('sim.settle(3)'), 'sim.settle(3) refused for the report fixture (deviation 18)');
      await advance(0);
      assert(await visible(ID.till), '#till hidden for the layout measure');
      await measure('report', true);
      await reload(saveV4({ season: { week: 9, results: resultsOf(9) } }));
      assert(await visible(ID3.seasonEnd), '#season-end hidden for a nine result save');
      await measure('season end', true);
    } finally {
      await emulate(RUN_METRICS);
      await sleep(TIMEOUT_MS.resize);
    }
    return notes.join('; ');
  });

  await step('reduced motion', async () => {
    await cdp.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
    await reloadFresh();   // deviation 19
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

  // W25 R-7: the one bold week 1 play. From cash 103 the picked picnic (a stretch on one kettle) turns
  // safe once the second kettle is bought by a real tap on the Gear sheet, leaning on the deposit.
  await step('second kettle on the deposit by real taps', async () => {
    await cdp.send('Emulation.setEmulatedMedia', { features: [] });
    await reload(saveV4({ cash: 103 }));
    assert((await loop()) === LOOP.week && (await visible(ID3.week)), 'the fixture loaded as ' + describe(await loop()));
    await click(ID3.book('picnic'));
    await advance(0);
    const s0 = await ev('({ go: $(' + JSON.stringify(ID3.go) + ').disabled, needs: S().season.booking.needs, cash: S().cash, cart: sim.cartTotal(), dep: S().season.booking.deposit })');
    assert(s0.go === true && s0.needs === UI.needsKettle2, 'the one kettle picnic ' + describe(s0));
    const oldRule = s0.cash - s0.cart >= 90;
    await click(ID3.cardGear);
    await advance(0);
    assert(await visible(ID3.sheet), '#sheet hidden after #card-gear');
    const b = await ev('({ dis: $("buy-kettle2").disabled, eff: ($("buy-kettle2").closest(".row").querySelector(".effect") || {}).textContent || "" })');
    assert(b.dis === false, '#buy-kettle2 disabled with cash ' + s0.cash + ', deposit ' + s0.dep + ', cart ' + s0.cart);
    assert(!/Leaves /.test(b.eff), 'the kettle row warns ' + describe(b.eff) + ' with a booking picked');
    await click('buy-kettle2');
    await advance(0);
    const s1 = await ev('({ k2: S().gear.kettle2, cash: S().cash, id: S().season.booking.id, safe: S().season.booking.safe, can: sim.canLoadUp() })');
    assert(s1.k2 === true && s1.id === 'picnic' && s1.safe === true && s1.can.ok === true && s1.cash >= 0, 'after the buy ' + describe(s1));
    await click(ID3.sheetBack);
    await advance(0);
    const s2 = await ev('({ go: $(' + JSON.stringify(ID3.go) + ').disabled, needsShown: !$("offer-picnic-needs").hidden, why: $(' + JSON.stringify(ID3.goWhy) + ').textContent })');
    assert(s2.go === false && s2.needsShown === false && s2.why === '', 'the hub after the buy ' + describe(s2));
    return 'cash ' + s0.cash + ', deposit ' + s0.dep + ', cart ' + s0.cart + ': Buy enabled (the old cash - cart rule ' + (oldRule ? 'allowed it' : 'greyed it') + '), cash after ' + s1.cash + ', the picnic safe, #go open';
  });

  await step('zero console errors across the run', () => {
    const e = errorCount();
    assert(e.total === 0, describe(e) + ' first: ' + describe(report.console.find((c) => c.type === 'error') || report.exceptions[0] || report.logEntries.find((l) => l.level === 'error')));
    return 'console ' + report.console.length + ' messages';
  });

  // Metrics, day 1 only.
  const served = eventsDay1.filter((e) => e.type === EVENT.served).length;
  const daySecondsOfService = before.service;
  report.metrics = Object.assign({ cTuned: report.metrics.cTuned || [] }, {
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
  });
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
